import { randomBytes, createHash } from "node:crypto";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";

// ============================================================
// Codex OAuth 2.0 PKCE Flow — Session Store & Helpers
// ============================================================
//
// References:
//   - CPA OAuth flow: https://github.com/router-for-me/CLIProxyAPIHome
//   - Codex OAuth client_id: app_EMoamEEZ73f0CkXaXp7hrann
//   - Authorize endpoint: https://auth.openai.com/oauth/authorize
//   - Token endpoint:     https://auth.openai.com/oauth/token
//
// Flow:
//   1. User clicks "Start Codex Login"
//   2. Backend starts temporary HTTP server on port 1455 (CPA registered redirect_uri)
//   3. Backend generates PKCE+state, returns auth URL
//   4. User authorizes in browser → OpenAI → port 1455 → callback
//   5. Exchange code → store tokens → stop port 1455 server → done
//   6. Frontend polls /api/oauth/codex/status until completed
// ============================================================

// ── On-demand Codex callback server (port 1455) ──
// CPA 注册的 OAuth app 固定回调地址为 http://localhost:1455/auth/callback
// 这个 server 只在用户点击"开始 Codex 登录"后才启动，授权完成后就关闭。
// 5 分钟无活动自动超时关闭，防止端口残留。

const CODEX_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

let codexCallbackServer: ServerType | null = null;
let codexAppFetch: ((req: Request) => Promise<Response>) | null = null;
let codexCallbackTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Register the Hono app's fetch handler so the 1455 callback server can use it.
 */
export function setCodexAppFetch(fetch: (req: Request) => Promise<Response>): void {
  codexAppFetch = fetch;
}

/** 重置 5 分钟超时定时器 */
function resetCallbackTimeout(): void {
  if (codexCallbackTimer) clearTimeout(codexCallbackTimer);
  codexCallbackTimer = setTimeout(() => {
    console.log("[oauth] Codex OAuth callback server timed out (5 min)");
    stopCodexCallbackServer();
  }, CODEX_CALLBACK_TIMEOUT_MS);
}

/**
 * Start a temporary HTTP server on port 1455 to receive the OAuth callback.
 * Returns true on success (or already running), false if port is already in use.
 */
export function startCodexCallbackServer(): boolean {
  if (codexCallbackServer) {
    // 已运行，重置超时
    resetCallbackTimeout();
    return true;
  }

  if (!codexAppFetch) {
    console.warn("[oauth] Codex app fetch not registered yet");
    return false;
  }

  try {
    codexCallbackServer = serve(
      { fetch: codexAppFetch, port: 1455 },
      () => {
        console.log("[oauth] Codex OAuth callback server started on port 1455");
      },
    );
    resetCallbackTimeout();
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("EADDRINUSE") || msg.includes("listen")) {
      console.warn("[oauth] Port 1455 is already in use — cannot start Codex OAuth callback server");
    } else {
      console.error("[oauth] Failed to start Codex OAuth callback server:", msg);
    }
    codexCallbackServer = null;
    return false;
  }
}

/**
 * Stop the temporary 1455 callback server after OAuth flow completes.
 */
export function stopCodexCallbackServer(): void {
  if (codexCallbackTimer) {
    clearTimeout(codexCallbackTimer);
    codexCallbackTimer = null;
  }
  if (codexCallbackServer) {
    try {
      codexCallbackServer.close();
    } catch { /* ignore close errors */ }
    codexCallbackServer = null;
    console.log("[oauth] Codex OAuth callback server stopped");
  }
}

/**
 * 检查 1455 回调服务器是否正在运行。
 */
export function isCodexCallbackServerRunning(): boolean {
  return codexCallbackServer !== null;
}

// ── Constants ──

export const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const CODEX_AUTH_URL = "https://auth.openai.com/oauth/authorize";
export const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
// CPA 固定的回调地址 — 必须在 OAuth app 注册列表中
export const CODEX_REDIRECT_URI = "http://localhost:1455/auth/callback";
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── PKCE helpers ──

/**
 * Generate a cryptographically random code_verifier (RFC 7636).
 * 64 bytes → base64url-encoded → ~86 characters.
 */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(64));
}

/**
 * Derive S256 code_challenge from code_verifier.
 */
export function generateCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate a random state string for CSRF protection.
 */
export function generateState(): string {
  return base64url(randomBytes(32));
}

// ── OAuth Session ──

export interface OAuthSession {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  providerId: string;
  redirectUri: string;
  status: "pending" | "completed" | "error";
  error?: string;
  createdAt: number;
}

/**
 * In-memory OAuth session store.
 * Sessions expire after SESSION_TTL_MS.
 */
class OAuthSessionStore {
  private sessions = new Map<string, OAuthSession>();

  set(session: OAuthSession): void {
    this.cleanup();
    this.sessions.set(session.state, session);
  }

  get(state: string): OAuthSession | undefined {
    this.cleanup();
    return this.sessions.get(state);
  }

  updateStatus(
    state: string,
    status: "completed" | "error",
    error?: string,
  ): void {
    const session = this.sessions.get(state);
    if (session) {
      session.status = status;
      session.error = error;
    }
  }

  /** Remove expired sessions. */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, s] of this.sessions) {
      if (now - s.createdAt > SESSION_TTL_MS) {
        this.sessions.delete(key);
      }
    }
  }
}

export const oauthSessionStore = new OAuthSessionStore();

// ── Build Codex authorization URL ──

export function buildCodexAuthURL(params: {
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(CODEX_AUTH_URL);
  url.searchParams.set("client_id", CODEX_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", CODEX_REDIRECT_URI);
  url.searchParams.set("scope", "openid email profile offline_access");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "login");
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  return url.toString();
}

// ── Token exchange ──

export interface CodexTokenData {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  email: string;
  accountId: string;
  planType: string;
  expiresAt: string;
}

/**
 * Exchange authorization code for tokens via auth.openai.com/oauth/token.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<CodexTokenData> {
  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("client_id", CODEX_CLIENT_ID);
  form.set("code", code);
  form.set("redirect_uri", redirectUri);
  form.set("code_verifier", codeVerifier);

  const response = await fetch(CODEX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    id_token: string;
    token_type: string;
    expires_in: number;
  };

  // Parse ID token JWT for account info
  let email = "";
  let accountId = "";
  let planType = "free";
  try {
    const parts = data.id_token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );
      email = payload.email ?? "";
      accountId = payload.sub ?? "";
      // Extract ChatGPT plan type from custom claim
      const codexAuth = payload["https://api.openai.com/auth"];
      if (codexAuth?.chatgpt_plan_type) {
        planType = codexAuth.chatgpt_plan_type;
      }
    }
  } catch {
    // Non-fatal: fall through with empty values
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    email,
    accountId,
    planType,
    expiresAt,
  };
}

// ── Token refresh ──

/**
 * Refresh OAuth tokens using refresh_token.
 */
export async function refreshOAuthTokens(
  refreshToken: string,
): Promise<CodexTokenData> {
  const form = new URLSearchParams();
  form.set("client_id", CODEX_CLIENT_ID);
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", refreshToken);
  form.set("scope", "openid profile email");

  const response = await fetch(CODEX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    id_token: string;
    token_type: string;
    expires_in: number;
  };

  let email = "";
  let accountId = "";
  let planType = "free";
  try {
    const parts = data.id_token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );
      email = payload.email ?? "";
      accountId = payload.sub ?? "";
      const codexAuth = payload["https://api.openai.com/auth"];
      if (codexAuth?.chatgpt_plan_type) {
        planType = codexAuth.chatgpt_plan_type;
      }
    }
  } catch {
    // non-fatal
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    email,
    accountId,
    planType,
    expiresAt,
  };
}

// ── Refresh + persist helper ──

export interface OAuthMetadata {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  refresh_url?: string;
  expires_at?: string;
  token_refreshed_at?: string;
  [key: string]: unknown;
}

/**
 * 刷新 Codex OAuth token 并持久化到 DB 和内存状态。
 * 供 gateway（401 自动刷新）和 usage（同步用量前刷新）统一调用。
 *
 * @returns 刷新后的 metadata JSON 字符串（已更新 access_token / refresh_token / expires_at）
 */
export async function refreshAndSaveCodexToken(
  metadata: OAuthMetadata,
  providerId: string,
  authKey: string,
  opts?: {
    updateKey?: (newKey: string, metadataJson: string) => void; // 更新内存中的 auth key
  },
): Promise<string> {
  const refreshToken = metadata.refresh_token;
  if (!refreshToken) throw new Error("No refresh_token available");

  const result = await refreshOAuthTokens(refreshToken);

  const now = new Date().toISOString();
  metadata.access_token = result.accessToken;
  if (result.refreshToken) metadata.refresh_token = result.refreshToken;
  metadata.expires_at = result.expiresAt;
  metadata.token_refreshed_at = now;

  const metadataJson = JSON.stringify(metadata);

  // 持久化到 DB
  const { getDb } = await import("./db/database.js");
  try {
    const db = await getDb();
    await db
      .updateTable("provider_auths")
      .set({
        key: result.accessToken,
        metadata: metadataJson,
        updated_at: now,
      })
      .where("provider_id", "=", providerId)
      .where("key", "=", authKey)
      .execute();
  } catch (err) {
    console.warn("[oauth] Failed to persist refreshed token:", err);
  }

  // 更新内存
  opts?.updateKey?.(result.accessToken, metadataJson);

  return metadataJson;
}
