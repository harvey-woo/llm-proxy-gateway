/**
 * Token Refresher — 定时刷新 OAuth access tokens
 *
 * 每隔 CHECK_INTERVAL 扫描所有 auth_type = 'oauth' 的凭证，
 * 对将在 REFRESH_THRESHOLD 内过期的 access_token，用 refresh_token
 * 调用上游 OAuth provider 的 token 端点续期，更新 DB 和 in-memory store。
 *
 * 当前仅支持 Codex (auth.openai.com)，扩展其他 OAuth provider 时
 * 在此文件追加 provider 配置即可。
 */

import { getDb } from "./db/database.js";
import type { StoreState } from "./routes/admin.js";
import type { Auth } from "@llm-proxy/shared/schemas";

// ── Constants ──

/** 扫描间隔 */
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** 在过期前多久触发刷新 */
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

// ── OAuth Provider 配置 ──

interface OAuthProviderConfig {
  tokenEndpoint: string;
  clientId: string;
  scopes: string;
}

const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  codex: {
    tokenEndpoint: "https://auth.openai.com/oauth/token",
    clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
    scopes: "openid profile email",
  },
};

// ── Helpers ──

interface OAuthMetadata {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  account_id?: string;
  email?: string;
  plan_type?: string;
  expires_at?: string;
  token_refreshed_at?: string;
}

function parseMetadata(raw: string | undefined | null): OAuthMetadata | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OAuthMetadata;
  } catch {
    return null;
  }
}

/**
 * 判断 token 是否快过期
 */
function isExpiringSoon(meta: OAuthMetadata): boolean {
  if (!meta.expires_at) return false; // no expiry info — assume valid
  const expiresAt = new Date(meta.expires_at).getTime();
  if (isNaN(expiresAt)) return false;
  return expiresAt - Date.now() < REFRESH_THRESHOLD_MS;
}

/**
 * 判断 token 是否已过期
 */
export function isTokenExpired(meta: OAuthMetadata | string | undefined | null): boolean {
  const parsed = typeof meta === "string" ? parseMetadata(meta) : meta;
  if (!parsed?.expires_at) return false;
  const expiresAt = new Date(parsed.expires_at).getTime();
  if (isNaN(expiresAt)) return false;
  return expiresAt < Date.now();
}

/**
 * 调用 OAuth provider 刷新 token
 */
async function refreshOAuthToken(
  provider: string,
  refreshToken: string,
): Promise<OAuthMetadata | null> {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    console.warn(`[token_refresher] Unknown OAuth provider: ${provider}`);
    return null;
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: config.scopes,
  });

  try {
    const response = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[token_refresher] Refresh failed for ${provider}: ${response.status} ${text}`);
      return null;
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
    };

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (data.expires_in ?? 3600) * 1000);

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refreshToken,
      id_token: data.id_token,
      token_refreshed_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
  } catch (err) {
    console.warn(`[token_refresher] Network error refreshing ${provider}:`, err);
    return null;
  }
}

// ── Scheduler ──

let _timer: ReturnType<typeof setInterval> | null = null;

/**
 * 启动 token 刷新调度器（在 server 启动时调用）
 */
export function startTokenRefresher(storeRef: { current: StoreState }): void {
  if (_timer) return; // already started

  console.log("[token_refresher] Started (interval: 5min)");
  _timer = setInterval(async () => {
    try {
      await refreshCycle(storeRef);
    } catch (err) {
      console.error("[token_refresher] Cycle error:", err);
    }
  }, CHECK_INTERVAL_MS);

  // 立即执行一次
  refreshCycle(storeRef).catch((err) =>
    console.error("[token_refresher] Initial cycle error:", err),
  );
}

/**
 * 停止刷新调度器
 */
export function stopTokenRefresher(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log("[token_refresher] Stopped");
  }
}

/**
 * 单次刷新周期：扫描所有 oauth auth，刷新快过期的 token
 */
async function refreshCycle(storeRef: { current: StoreState }): Promise<void> {
  const db = await getDb();
  const rows = await db
    .selectFrom("provider_auths")
    .selectAll()
    .where("auth_type", "=", "oauth")
    .execute();

  for (const row of rows) {
    const meta = parseMetadata(row.metadata);
    if (!meta?.refresh_token) {
      console.warn(`[token_refresher] Skipping ${row.id}: no refresh_token in metadata`);
      continue;
    }

    if (!isExpiringSoon(meta)) continue; // not yet due

    console.log(`[token_refresher] Refreshing token for ${row.id} (${row.key?.slice(0, 12)}...)`);

    const newMeta = await refreshOAuthToken("codex", meta.refresh_token);
    if (!newMeta) {
      console.warn(`[token_refresher] Failed to refresh token for ${row.id}`);
      continue;
    }

    // Update DB
    await db
      .updateTable("provider_auths")
      .set({
        key: newMeta.access_token,
        metadata: JSON.stringify({
          ...meta,
          ...newMeta,
        }),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", row.id)
      .execute();

    // Update in-memory store
    for (const provider of storeRef.current.providers.values()) {
      const authIndex = (provider.auths ?? []).findIndex(
        (a: Auth) => a.key === row.key,
      );
      if (authIndex !== -1) {
        const auth = provider.auths![authIndex] as Record<string, unknown>;
        auth.key = newMeta.access_token;
        auth.oauth_metadata = JSON.stringify({ ...meta, ...newMeta });
        break;
      }
    }

    console.log(`[token_refresher] Refreshed token for ${row.id} (expires: ${newMeta.expires_at})`);
  }
}
