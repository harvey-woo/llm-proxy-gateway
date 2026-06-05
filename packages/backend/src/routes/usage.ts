import { Hono } from "hono";
import { getDb } from "../db/database.js";
import type { ProviderPool } from "../pool.js";
import type { StoreState } from "./admin.js";
import { createRateLimitState } from "../rate_limiter.js";
import { refreshAndSaveCodexToken } from "../oauth.js";

const CODEX_WHAM_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_USER_AGENT =
  "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal";

/**
 * 计算某个时间周期的起始时间戳（毫秒）。
 */
function getPeriodStart(period: string, now: number = Date.now()): number {
  const d = new Date(now);
  switch (period) {
    case "second":
      return new Date(d).setUTCSeconds(d.getUTCSeconds(), 0);
    case "minute":
      return new Date(d).setUTCSeconds(0, 0);
    case "hour":
      return new Date(d).setUTCMinutes(0, 0, 0);
    case "day":
      return new Date(d).setUTCHours(0, 0, 0, 0);
    case "5h": {
      const hoursSinceEpoch = Math.floor(now / (5 * 60 * 60 * 1000));
      return hoursSinceEpoch * 5 * 60 * 60 * 1000;
    }
    case "week": {
      const dayOfWeek = d.getUTCDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday start
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - diff);
      monday.setUTCHours(0, 0, 0, 0);
      return monday.getTime();
    }
    case "month":
      return new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
      ).getTime();
    case "30d": {
      // 30-day rolling window
      const epoch30 = Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000));
      return epoch30 * 30 * 24 * 60 * 60 * 1000;
    }
    default:
      return 0;
  }
}

/**
 * 读取 request_logs 表，按 auth_key + 时间窗口统计请求数和 token 消耗。
 */
async function queryUsageFromDB(
  authKey: string,
  period: string,
): Promise<{ requests: number; tokens: number }> {
  const db = await getDb();
  const periodStart = getPeriodStart(period);
  const periodStartISO = new Date(periodStart).toISOString();

  const row = await db
    .selectFrom("request_logs")
    .select((eb) => [
      eb.fn.countAll().as("requests"),
      eb.fn.sum("total_tokens").as("tokens"),
    ])
    .where("auth_key", "=", authKey)
    .where("timestamp", ">=", periodStartISO)
    .executeTakeFirst();

  return {
    requests: Number(row?.requests ?? 0),
    tokens: Number(row?.tokens ?? 0),
  };
}

/** 将秒数转为可读的中文周期 */
function humanPeriod(seconds: number): string {
  if (seconds >= 86400) {
    const days = Math.round(seconds / 86400);
    return `${days}天`;
  }
  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return `${hours}小时`;
  }
  if (seconds >= 60) {
    const mins = Math.round(seconds / 60);
    return `${mins}分钟`;
  }
  return `${seconds}秒`;
}

/** 将 rate_limits period 字符串转成秒数 */
function periodToSeconds(period: string): number {
  switch (period) {
    case "second":
      return 1;
    case "minute":
      return 60;
    case "hour":
      return 3600;
    case "day":
      return 86400;
    case "5h":
      return 18000;
    case "week":
      return 604800;
    case "month":
      return 2592000;
    case "30d":
      return 2592000;
    default:
      return 0;
  }
}

export function createUsageRoutes(
  pool: ProviderPool,
  storeRef: { current: StoreState },
): Hono {
  const router = new Hono();

  /**
   * GET /api/auths/usage
   * 返回所有 auth 的用量统计（从 request_logs 查询）。
   *
   * 返回格式：
   * {
   *   success: true,
   *   data: {
   *     auths: [{
   *       provider_id, auth_key, name, auth_type,
   *       usage: [{ type, period, used, max }]
   *     }]
   *   }
   * }
   */
  router.get("/api/auths/usage", async (c) => {
    const data: Array<{
      provider_id: string;
      auth_key: string;
      name?: string;
      auth_type: string;
      usage: Array<{
        type: string;
        period: string;
        used: number;
        max: number;
      }>;
    }> = [];

    for (const [providerId, provider] of storeRef.current.providers) {
      const auths = provider.auths ?? [];
      for (const auth of auths) {
        const usage: Array<{
          type: string;
          period: string;
          used: number;
          max: number;
        }> = [];

        // 按 rate_limits 配置查询每个时间窗口的用量
        for (const limit of provider.rate_limits ?? []) {
          if (limit.type === "concurrency") continue; // 并发不适用持久化统计
          const { requests, tokens } = await queryUsageFromDB(
            auth.key,
            limit.period,
          );
          const used = limit.type === "tokens" ? tokens : requests;
          usage.push({
            type: limit.type,
            period: limit.period,
            used,
            max: limit.max,
          });
        }

        // 如果是 OAuth 且有上游同步的用量，用上游百分比覆盖本地 month 窗口
        if (auth.auth_type === "oauth" && auth.oauth_metadata) {
          try {
            const oauthMeta = JSON.parse(auth.oauth_metadata) as Record<
              string,
              unknown
            >;
            const codexUsage = oauthMeta.codex_usage as
              | Record<string, unknown>
              | undefined;
            if (codexUsage?.rate_limit) {
              const rl = codexUsage.rate_limit as Record<string, unknown>;

              // 将上游 primary/secondary 窗口映射到已有 rate_limits（按窗口秒数匹配）
              const upstreamWindows: Array<{
                usedPct: number;
                seconds: number;
              }> = [];

              const primary = rl.primary_window as
                | Record<string, unknown>
                | undefined;
              if (primary?.used_percent !== undefined) {
                upstreamWindows.push({
                  usedPct: Number(primary.used_percent),
                  seconds: Number(primary.limit_window_seconds) || 2592000,
                });
              }

              const secondary = rl.secondary_window as
                | Record<string, unknown>
                | undefined;
              if (secondary?.used_percent !== undefined) {
                upstreamWindows.push({
                  usedPct: Number(secondary.used_percent),
                  seconds: Number(secondary.limit_window_seconds) || 18000,
                });
              }

              for (const uw of upstreamWindows) {
                // 根据秒数找到匹配的已有窗口
                const match = usage.find((u) => {
                  const periodSec = periodToSeconds(u.period);
                  return (
                    periodSec > 0 && Math.abs(periodSec - uw.seconds) < 3600
                  ); // 1小时内误差算匹配
                });
                if (match && match.max > 0) {
                  match.used = Math.round((match.max * uw.usedPct) / 100);
                }
              }
            }

            // code_review_rate_limit
            const crl = codexUsage?.code_review_rate_limit as
              | Record<string, unknown>
              | undefined;
            if (crl) {
              const used = Number((crl as any).used ?? 0);
              const max = Number((crl as any).max ?? 0);
              if (max > 0) {
                usage.push({
                  type: "reviews",
                  period: "30天",
                  used,
                  max,
                });
              }
            }

            // credits
            const credits = codexUsage?.credits as
              | Record<string, unknown>
              | undefined;
            if (credits && (credits as any).has_credits) {
              const balance = (credits as any).balance;
              const approxLocal = (credits as any).approx_local_messages;
              if (balance !== null || approxLocal !== null) {
                usage.push({
                  type: "credits",
                  period: "余额",
                  used: approxLocal ?? balance ?? 0,
                  max: balance ?? approxLocal ?? 0,
                });
              }
            }
          } catch {
            /* ignore metadata parse errors */
          }
        }

        data.push({
          provider_id: providerId,
          auth_key: auth.key,
          name: auth.name,
          auth_type: auth.auth_type ?? "api_key",
          usage,
        });
      }
    }

    return c.json({ success: true, data });
  });

  /**
   * POST /api/auths/reset-usage
   * 清空所有 in-memory rate limiter 计数。
   * 注意：这只影响限流的实时判断，request_logs 中的历史数据不受影响。
   */
  router.post("/api/auths/reset-usage", async (c) => {
    // 清空 rate limiter 状态 — 替换为全新空状态
    const limiter = pool.getRateLimiter();
    const freshState = createRateLimitState();
    // 通过 getState() 拿到引用后清空 Map
    const state = limiter.getState();
    state.requestCounts.clear();
    state.tokenCounts.clear();
    state.currentConcurrency.clear();
    state.tpmWindow.clear();

    return c.json({ success: true, message: "Rate limiter counters reset" });
  });

  /**
   * POST /api/auths/sync-usage
   * 从上游同步指定 Codex OAuth 的用量。
   * Body: { provider_id, auth_key }
   */
  router.post("/api/auths/sync-usage", async (c) => {
    const body = (await c.req.json()) as {
      provider_id: string;
      auth_key: string;
    };

    if (!body.provider_id || !body.auth_key) {
      return c.json({
        success: false,
        error: "provider_id and auth_key are required",
      });
    }

    try {
      const usageData = await syncCodexUsage(
        body.provider_id,
        body.auth_key,
        storeRef,
        pool,
      );
      return c.json({ success: true, data: usageData });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown sync error";
      return c.json({ success: false, error: message });
    }
  });

  return router;
}

// ── 上游用量同步 ──

/**
 * POST /api/oauth/codex/sync-usage
 * 从上游同步 Codex OAuth 的用量数据。
 * 调用 https://chatgpt.com/backend-api/wham/usage，
 * 把结果写入 metadata.codex_usage 并返回。
 */
export async function syncCodexUsage(
  providerId: string,
  authKey: string,
  storeRef: { current: StoreState },
  pool: ProviderPool,
): Promise<Record<string, unknown>> {
  const provider = storeRef.current.providers.get(providerId);
  if (!provider) throw new Error("Provider not found");

  const auth = (provider.auths ?? []).find((a) => a.key === authKey);
  if (!auth) throw new Error("Auth not found");
  if (auth.auth_type !== "oauth" || !auth.oauth_metadata) {
    throw new Error("Not a Codex OAuth credential");
  }

  let metadata: Record<string, unknown>;
  try {
    metadata = JSON.parse(auth.oauth_metadata) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid OAuth metadata");
  }

  async function callUsageAPI(token: string): Promise<Record<string, unknown>> {
    const resp = await fetch(CODEX_WHAM_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": CODEX_USER_AGENT,
      },
    });
    if (!resp.ok) {
      throw new Error(
        `Codex usage API returned ${resp.status}: ${await resp.text()}`,
      );
    }
    return (await resp.json()) as Record<string, unknown>;
  }

  let accessToken = metadata.access_token as string | undefined;
  if (!accessToken) throw new Error("Missing access_token in metadata");

  async function callAndSave(token: string): Promise<Record<string, unknown>> {
    const usageData = await callUsageAPI(token);
    // 保存用量结果到 metadata
    metadata.usage_synced_at = new Date().toISOString();
    metadata.codex_usage = usageData;
    const metadataJson = JSON.stringify(metadata);
    try {
      const db = await getDb();
      await db
        .updateTable("provider_auths")
        .set({ metadata: metadataJson, updated_at: new Date().toISOString() })
        .where("provider_id", "=", providerId)
        .where("key", "=", authKey)
        .execute();
    } catch (err) {
      console.warn("[usage] Failed to persist synced usage:", err);
    }
    auth.oauth_metadata = metadataJson;
    return usageData;
  }

  try {
    return await callAndSave(accessToken);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "";
    // 401 → token 过期，用共享逻辑刷新
    if (errMsg.includes("401")) {
      await refreshAndSaveCodexToken(metadata, providerId, authKey, {
        updateKey: (newKey, mJson) => {
          auth.oauth_metadata = mJson;
          auth.key = newKey;
          if (pool) pool.updateAuthKey(authKey, newKey, mJson);
        },
      });
      accessToken = metadata.access_token as string;
      if (!accessToken)
        throw new Error("Token refresh did not return access_token");
      return await callAndSave(accessToken);
    }
    throw err;
  }
}
