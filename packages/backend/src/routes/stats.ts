import { Hono } from "hono";
import type { LoadedConfig } from "../config/loader.js";
import { getDb } from "../db/database.js";
import {
  getDashboardStats,
  getTimeSeriesStats,
  getModelStats,
  getProviderStats,
  getAuthStats,
} from "../stats.js";

export function createStatsRoutes(configRef?: { current: LoadedConfig }): Hono {
  const router = new Hono();

  // GET /api/stats/dashboard
  router.get("/api/stats/dashboard", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");

    const config = configRef?.current;
    const providers = config?.providers ?? new Map();

    const stats = await getDashboardStats({ from, to }, providers);

    return c.json({
      success: true,
      data: stats,
    });
  });

  // GET /api/stats/timeseries
  router.get("/api/stats/timeseries", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    const granularity = c.req.query("granularity") as
      | "minute"
      | "hour"
      | "day"
      | undefined;
    const modelAlias = c.req.query("model_alias");
    const providerId = c.req.query("provider_id");
    const authKey = c.req.query("auth_key");

    const buckets = await getTimeSeriesStats(granularity ?? "hour", {
      from,
      to,
      modelAlias,
      providerId,
      authKey,
    });

    const totalRequests = buckets.reduce((s, b) => s + b.requests, 0);
    const totalTokens = buckets.reduce((s, b) => s + b.totalTokens, 0);

    return c.json({
      success: true,
      data: {
        buckets,
        total_requests: totalRequests,
        total_tokens: totalTokens,
      },
    });
  });

  // GET /api/stats/models
  router.get("/api/stats/models", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    const providerId = c.req.query("provider_id");
    const authKey = c.req.query("auth_key");

    const stats = await getModelStats({
      from,
      to,
      providerId,
      authKey,
    });

    return c.json({
      success: true,
      data: stats,
    });
  });

  // GET /api/stats/providers
  router.get("/api/stats/providers", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    const modelAlias = c.req.query("model_alias");
    const authKey = c.req.query("auth_key");

    const stats = await getProviderStats({
      from,
      to,
      modelAlias,
      authKey,
    });

    return c.json({
      success: true,
      data: stats,
    });
  });

  // GET /api/stats/auths
  router.get("/api/stats/auths", async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    const modelAlias = c.req.query("model_alias");
    const providerId = c.req.query("provider_id");

    const stats = await getAuthStats({
      from,
      to,
      modelAlias,
      providerId,
    });

    return c.json({
      success: true,
      data: stats,
    });
  });

  // GET /api/stats/requests - Request counts per auth per period
  router.get("/api/stats/requests", async (c) => {
    if (!configRef) {
      return c.json({ success: true, data: [] });
    }

    const db = await getDb();
    const now = new Date();
    const data: Array<{
      period: string;
      count: number;
      auth_key: string;
      auth_name?: string;
    }> = [];

    const periodDefs: Array<{ key: string; hours: number }> = [
      { key: "5h", hours: 5 },
      { key: "week", hours: 168 },
      { key: "month", hours: 720 },
    ];

    const config = configRef.current;
    const authNameMap = new Map<string, string>();
    for (const [, provider] of config.providers.entries()) {
      for (const auth of provider.auths ?? []) {
        authNameMap.set(auth.key, auth.name ?? "");
      }
    }

    const allAuths = new Set<string>();
    for (const [, provider] of config.providers.entries()) {
      for (const auth of provider.auths ?? []) {
        allAuths.add(auth.key);
      }
    }

    const logs = await db.selectFrom("request_logs").selectAll().execute();

    for (const authKey of allAuths) {
      for (const { key, hours } of periodDefs) {
        const since = new Date(
          now.getTime() - hours * 60 * 60 * 1000,
        ).toISOString();
        const count = logs.filter(
          (l) => l.auth_key === authKey && l.timestamp >= since,
        ).length;
        const displayKey =
          authKey.length > 10
            ? authKey.substring(0, 6) +
              "..." +
              authKey.substring(authKey.length - 4)
            : authKey;
        data.push({
          period: key,
          count,
          auth_key: displayKey,
          auth_name: authNameMap.get(authKey),
        });
      }
    }

    return c.json({ success: true, data });
  });

  // GET /api/stats/tokens - Token time series per auth
  router.get("/api/stats/tokens", async (c) => {
    if (!configRef) {
      return c.json({ success: true, data: [] });
    }

    const db = await getDb();
    const config = configRef.current;

    const granularity = (c.req.query("granularity") ?? "hour") as
      | "hour"
      | "day"
      | "month";
    const authKeyFilter = c.req.query("auth_key");
    const hoursParam = c.req.query("hours");
    const hours = hoursParam
      ? parseInt(hoursParam, 10)
      : granularity === "hour"
        ? 24
        : granularity === "day"
          ? 168
          : 720;

    const now = new Date();
    const since = new Date(
      now.getTime() - hours * 60 * 60 * 1000,
    ).toISOString();

    const authNameMap = new Map<string, string>();
    const allAuths = new Set<string>();
    for (const [, provider] of config.providers.entries()) {
      for (const auth of provider.auths ?? []) {
        authNameMap.set(auth.key, auth.name ?? "");
        allAuths.add(auth.key);
      }
    }

    // Build base query
    let query = db
      .selectFrom("request_logs")
      .selectAll()
      .where("timestamp", ">=", since);

    if (authKeyFilter) {
      query = query.where("auth_key", "=", authKeyFilter);
    }

    const logs = await query.execute();

    // Bucket by granularity
    const bucketMap = new Map<string, typeof logs>();
    for (const log of logs) {
      const ts = new Date(log.timestamp);
      let bucketKey: string;

      switch (granularity) {
        case "hour":
          ts.setMinutes(0, 0, 0);
          bucketKey = ts.toISOString();
          break;
        case "day":
          ts.setHours(0, 0, 0, 0);
          bucketKey = ts.toISOString();
          break;
        case "month":
          ts.setDate(1);
          ts.setHours(0, 0, 0, 0);
          bucketKey = ts.toISOString();
          break;
        default:
          bucketKey = ts.toISOString();
      }

      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, []);
      }
      bucketMap.get(bucketKey)!.push(log);
    }

    // Determine which auth keys to include
    const targetAuths = authKeyFilter ? [authKeyFilter] : Array.from(allAuths);
    const data: Array<{
      timestamp: string;
      auth_key: string;
      auth_name?: string;
      input_tokens: number;
      output_tokens: number;
      cache_tokens: number;
      total_tokens: number;
    }> = [];

    for (const authKey of targetAuths) {
      // Generate all time buckets (fill gaps with 0)
      const bucketCount =
        granularity === "hour" ? hours : Math.ceil(hours / 24);
      for (let i = bucketCount - 1; i >= 0; i--) {
        const msPerBucket =
          granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        const bucketStart = new Date(now.getTime() - (i + 1) * msPerBucket);
        const bucketEnd = new Date(now.getTime() - i * msPerBucket);

        if (granularity === "hour") {
          bucketStart.setMinutes(0, 0, 0);
          bucketEnd.setMinutes(0, 0, 0);
        } else if (granularity === "day") {
          bucketStart.setHours(0, 0, 0, 0);
          bucketEnd.setHours(0, 0, 0, 0);
        }

        const bucketLogs = (
          bucketMap.get(bucketStart.toISOString()) ?? []
        ).filter((l) => l.auth_key === authKey);

        const inputTokens = bucketLogs.reduce((s, l) => s + l.input_tokens, 0);
        const outputTokens = bucketLogs.reduce(
          (s, l) => s + l.output_tokens,
          0,
        );
        const cacheTokens = bucketLogs.reduce(
          (s, l) => s + l.cache_hit_tokens + l.cache_create_tokens,
          0,
        );
        const totalTokens = inputTokens + outputTokens + cacheTokens;

        const displayKey =
          authKey.length > 10
            ? authKey.substring(0, 6) +
              "..." +
              authKey.substring(authKey.length - 4)
            : authKey;

        data.push({
          timestamp: bucketStart.toISOString(),
          auth_key: displayKey,
          auth_name: authNameMap.get(authKey),
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_tokens: cacheTokens,
          total_tokens: totalTokens,
        });
      }
    }

    return c.json({ success: true, data });
  });

  return router;
}
