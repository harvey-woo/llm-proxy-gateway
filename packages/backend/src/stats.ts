import { randomUUID } from "node:crypto";
import { getDb } from "./db/database.js";
import type { RequestLog } from "./db/database.js";
import type { Provider } from "@llm-proxy/shared/schemas";

export interface LogRequestOptions {
  authKey: string;
  providerId: string;
  modelAlias: string;
  realModel: string;
  format: string;
  status: RequestLog["status"];
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  cacheCreateTokens: number;
  latencyMs: number;
  errorMessage?: string;
  rateLimitedBy?: string;
}

export async function logRequest(opts: LogRequestOptions): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const totalTokens = opts.inputTokens + opts.outputTokens + opts.cacheHitTokens + opts.cacheCreateTokens;

  await db
    .insertInto("request_logs")
    .values({
      id: randomUUID(),
      timestamp: now,
      auth_key: opts.authKey,
      provider_id: opts.providerId,
      model_alias: opts.modelAlias,
      real_model: opts.realModel,
      format: opts.format,
      status: opts.status,
      input_tokens: opts.inputTokens,
      output_tokens: opts.outputTokens,
      cache_hit_tokens: opts.cacheHitTokens,
      cache_create_tokens: opts.cacheCreateTokens,
      total_tokens: totalTokens,
      latency_ms: opts.latencyMs,
      error_message: opts.errorMessage ?? null,
      rate_limited_by: opts.rateLimitedBy ?? null,
    })
    .execute();
}

// ============================================================
// Stats aggregation helpers
// ============================================================

export interface StatsQueryOptions {
  from?: string;
  to?: string;
  modelAlias?: string;
  providerId?: string;
  authKey?: string;
}

export interface PerRequestWeightedRow {
  provider_id: string;
  weighted_requests: number;
  cost: number;
  unit_price: number;
  currency?: string;
  rate_limited: number;
  auths: Array<{ auth_key: string; auth_name?: string; limits: Array<{ type: string; period?: string; used: number; max: number; remaining: number; usage_pct: number }> }>;
}

export interface PerModelTokenRow {
  provider_id: string;
  tokens: number;
  cost: number;
  currency?: string;
  avg_price_per_m: number;
  rate_limited: number;
  auths: Array<{ auth_key: string; auth_name?: string; limits: Array<{ type: string; period?: string; used: number; max: number; remaining: number; usage_pct: number }> }>;
}

export interface SubscriptionRow {
  provider_id: string;
  used: number;
  quota: number | null; // null = unlimited
  cost: number;
  period: string;
  overage_cost: number;
  currency?: string;
  auths: Array<{ auth_key: string; auth_name?: string; limits: Array<{ type: string; period?: string; used: number; max: number; remaining: number; usage_pct: number }> }>;
}

export interface ByPricingModel {
  per_request_weighted: {
    label: string;
    rows: PerRequestWeightedRow[];
    total_weighted_requests: number;
    total_cost: number;
    total_rate_limited: number;
  };
  per_model_token: {
    label: string;
    rows: PerModelTokenRow[];
    total_tokens: number;
    total_cost: number;
    total_rate_limited: number;
  };
  subscription: {
    label: string;
    rows: SubscriptionRow[];
    total_cost: number;
    total_rate_limited: number;
  };
}

export interface RateLimitedAuthEntry {
  auth_key: string;
  auth_name?: string;
  provider_id: string;
  triggered_rules: string[];
}

export interface DashboardStats {
  total_cost: number;
  total_requests: number;
  total_rate_limited: number;
  by_pricing_model: ByPricingModel;
  rate_limited_auths: RateLimitedAuthEntry[];
}

export interface TimeBucket {
  timestamp: string;
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
}

export interface ModelStats {
  modelAlias: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  errorRate: number;
}

export interface ProviderStats {
  providerId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  uptimePercentage: number;
}

export interface AuthStats {
  keyId: string;
  keyName: string;
  totalRequests: number;
  totalTokens: number;
}

/**
 * Get average model weight for a provider.
 */
function getAvgWeight(provider: Provider): number {
  if (!provider.models || provider.models.length === 0) return 1;
  const totalWeight = provider.models.reduce((sum, m) => sum + (m.weight ?? 1), 0);
  return totalWeight / provider.models.length;
}

/**
 * Calculate cost based on provider's pricing model.
 */
function calcCost(weightedRequests: number, provider: Provider, actualTokens?: number): number {
  switch (provider.pricing_model) {
    case "per_request_weighted": {
      const unitPrice = provider.unit_price ?? 0.001;
      return Number((weightedRequests * unitPrice).toFixed(2));
    }
    case "per_model_token": {
      const tokens = actualTokens ?? weightedRequests * 1000;
      // Use average model pricing if available
      const avgInputPrice = provider.models.reduce((s, m) => s + (m.input_price ?? 0), 0) / (provider.models.length || 1);
      const avgOutputPrice = provider.models.reduce((s, m) => s + (m.output_price ?? 0), 0) / (provider.models.length || 1);
      const avgPricePerM = (avgInputPrice + avgOutputPrice) / 2;
      return Number(((tokens / 1_000_000) * avgPricePerM).toFixed(2));
    }
    case "subscription": {
      const sub = provider.subscription;
      if (!sub) return 0;
      return sub.price;
    }
    default:
      return 0;
  }
}

/**
 * Calculate cost for per_model_token pricing with cache-aware token breakdown.
 * Uses per-model cache prices if available; falls back to input_price.
 */
function calcTokenCost(
  inputTokens: number,
  outputTokens: number,
  cacheHitTokens: number,
  cacheCreateTokens: number,
  provider: Provider,
): number {
  if (provider.pricing_model !== "per_model_token") return 0;

  // Use average model pricing across all models of the provider
  const avgInputPrice = provider.models.reduce((s, m) => s + (m.input_price ?? 0), 0) / (provider.models.length || 1);
  const avgOutputPrice = provider.models.reduce((s, m) => s + (m.output_price ?? 0), 0) / (provider.models.length || 1);
  const avgCacheHitPrice = provider.models.reduce((s, m) => s + ((m as any).cache_hit_price ?? m.input_price ?? 0), 0) / (provider.models.length || 1);
  const avgCacheCreatePrice = provider.models.reduce((s, m) => s + ((m as any).cache_create_price ?? m.input_price ?? 0), 0) / (provider.models.length || 1);

  const missTokens = Math.max(0, inputTokens - cacheHitTokens - cacheCreateTokens);
  const cost = (missTokens * avgInputPrice + cacheHitTokens * avgCacheHitPrice + cacheCreateTokens * avgCacheCreatePrice + outputTokens * avgOutputPrice) / 1_000_000;

  return Number(cost.toFixed(2));
}

/**
 * Calculate subscription overage cost.
 * If included_requests is not set (unlimited), overage is always 0.
 */
function calcOverageCost(weightedRequests: number, provider: Provider): number {
  const sub = provider.subscription;
  if (!sub || sub.billing_type !== "weighted_requests") return 0;
  // No included_requests means unlimited — no overage
  if (sub.included_requests === undefined) return 0;
  const included = sub.included_requests;
  const overagePrice = sub.overage_unit_price ?? 0.001;
  if (weightedRequests <= included) return 0;
  return Number(((weightedRequests - included) * overagePrice).toFixed(2));
}

/**
 * Compute limit usage info for an auth.
 */
function computeAuthLimits(
  auth: { key: string; name?: string },
  provider: Provider,
  isRateLimited: boolean,
  requestCount: number = 0,
): Array<{ type: string; period?: string; used: number; max: number; remaining: number; usage_pct: number }> {
  return (provider.rate_limits ?? []).map((rl) => {
    const max = rl.max;
    // Use actual request count for weighted_requests/tokens limits, capped at max
    const used = Math.min(requestCount, max);
    const remaining = Math.max(0, max - used);
    const usage_pct = max > 0 ? Math.round((used / max) * 100) : 0;
    return {
      type: rl.type,
      period: (rl as any).period,
      used,
      max,
      remaining,
      usage_pct,
    };
  });
}

// ============================================================
// Dashboard Stats (reads from DB + provider config)
// ============================================================

export async function getDashboardStats(
  opts: StatsQueryOptions,
  providers: Map<string, Provider>,
): Promise<DashboardStats> {
  const db = await getDb();

  // Get all request logs for the time range
  const logs = await db
    .selectFrom("request_logs")
    .selectAll()
    .$if(!!opts?.from, (qb) => qb.where("timestamp", ">=", opts!.from!))
    .$if(!!opts?.to, (qb) => qb.where("timestamp", "<=", opts!.to!))
    .execute();

  // Count requests per auth key
  const authRequestCounts = new Map<string, number>();
  const authRateLimitedCounts = new Map<string, number>();
  for (const log of logs) {
    const key = `${log.provider_id}:${log.auth_key}`;
    authRequestCounts.set(key, (authRequestCounts.get(key) ?? 0) + 1);
    if (log.status === "rate_limited") {
      authRateLimitedCounts.set(key, (authRateLimitedCounts.get(key) ?? 0) + 1);
    }
  }

  // Collect all auths and compute stats
  const rateLimitedAuths: RateLimitedAuthEntry[] = [];
  const providerAuthsMap = new Map<string, Array<{ auth_key: string; auth_name?: string; limits: Array<{ type: string; period?: string; used: number; max: number; remaining: number; usage_pct: number }> }>>();

  // Provider-level aggregations
  const providerData = new Map<string, {
    weightedRequests: number;
    cost: number;
    rawRequests: number;
    rateLimited: number;
  }>();

  for (const [providerId, provider] of providers.entries()) {
    const avgWeight = getAvgWeight(provider);
    let totalWeighted = 0;
    let totalRaw = 0;
    let totalRateLimited = 0;

    const authInfos: Array<{ auth_key: string; auth_name?: string; limits: Array<{ type: string; period?: string; used: number; max: number; remaining: number; usage_pct: number }> }> = [];

    for (const auth of (provider.auths ?? [])) {
      const key = `${providerId}:${auth.key}`;
      const rawRequests = authRequestCounts.get(key) ?? 0;
      const weightedRequests = Math.round(rawRequests * avgWeight);
      const isRateLimited = (authRateLimitedCounts.get(key) ?? 0) > 0;

      totalWeighted += weightedRequests;
      totalRaw += rawRequests;
      if (isRateLimited) totalRateLimited++;

      // Mask auth key
      const maskedKey = auth.key.length > 10
        ? auth.key.substring(0, 6) + "..." + auth.key.substring(auth.key.length - 4)
        : auth.key;

      authInfos.push({
        auth_key: maskedKey,
        auth_name: auth.name,
        limits: computeAuthLimits(auth, provider, isRateLimited, rawRequests),
      });

      if (isRateLimited) {
        rateLimitedAuths.push({
          auth_key: auth.key,
          auth_name: auth.name,
          provider_id: providerId,
          triggered_rules: [],
        });
      }
    }

    providerAuthsMap.set(providerId, authInfos);

    const cost = calcCost(totalWeighted, provider);
    providerData.set(providerId, {
      weightedRequests: totalWeighted,
      cost,
      rawRequests: totalRaw,
      rateLimited: totalRateLimited,
    });
  }

  // Build sections by pricing model
  const perRequestWeightedRows: PerRequestWeightedRow[] = [];
  const perModelTokenRows: PerModelTokenRow[] = [];
  const subscriptionRows: SubscriptionRow[] = [];

  for (const [providerId, provider] of providers.entries()) {
    const pd = providerData.get(providerId);
    if (!pd) continue;

    // Skip no_billing providers — they don't appear in cost sections
    if (provider.pricing_model === "no_billing") continue;

    switch (provider.pricing_model) {
      case "per_request_weighted":
        perRequestWeightedRows.push({
          provider_id: providerId,
          weighted_requests: pd.weightedRequests,
          cost: calcCost(pd.weightedRequests, provider, providerTokens),
          currency: provider.currency,
          unit_price: provider.unit_price ?? 0.001,
          rate_limited: pd.rateLimited,
          auths: providerAuthsMap.get(providerId) ?? [],
        });
        break;
      case "per_model_token": {
        // Aggregate real tokens from request logs for this provider
        const providerLogs = logs.filter((l) => l.provider_id === providerId);
        const providerTokens = providerLogs.reduce((s, l) => s + l.total_tokens, 0);
        const providerInputTokens = providerLogs.reduce((s, l) => s + l.input_tokens, 0);
        const providerOutputTokens = providerLogs.reduce((s, l) => s + l.output_tokens, 0);
        const providerCacheHitTokens = providerLogs.reduce((s, l) => s + l.cache_hit_tokens, 0);
        const providerCacheCreateTokens = providerLogs.reduce((s, l) => s + l.cache_create_tokens, 0);
        const cacheCost = calcTokenCost(providerInputTokens, providerOutputTokens, providerCacheHitTokens, providerCacheCreateTokens, provider);
        perModelTokenRows.push({
          provider_id: providerId,
          tokens: providerTokens,
          cost: cacheCost,
          currency: provider.currency,
          avg_price_per_m: providerTokens > 0 ? Number(((cacheCost / providerTokens) * 1_000_000).toFixed(2)) : 0,
          rate_limited: pd.rateLimited,
          auths: providerAuthsMap.get(providerId) ?? [],
        });
        break;
      }
      case "subscription": {
        const sub = provider.subscription;
        const quota = sub?.included_requests ?? null; // null = unlimited
        const used = quota !== null ? Math.min(pd.weightedRequests, quota) : pd.weightedRequests;
        const overageCost = calcOverageCost(pd.weightedRequests, provider);
        subscriptionRows.push({
          provider_id: providerId,
          used,
          quota,
          cost: sub?.price ?? 100,
          period: sub?.period ?? "month",
          overage_cost: overageCost,
          currency: provider.currency,
          auths: providerAuthsMap.get(providerId) ?? [],
        });
        break;
      }
    }
  }

  const totalPerRequestWeightedRequests = perRequestWeightedRows.reduce((s, r) => s + r.weighted_requests, 0);
  const totalPerRequestWeightedCost = Number(perRequestWeightedRows.reduce((s, r) => s + r.cost, 0).toFixed(2));
  const totalPerRequestWeightedRateLimited = perRequestWeightedRows.reduce((s, r) => s + r.rate_limited, 0);

  const totalPerModelTokenTokens = perModelTokenRows.reduce((s, r) => s + r.tokens, 0);
  const totalPerModelTokenCost = Number(perModelTokenRows.reduce((s, r) => s + r.cost, 0).toFixed(2));
  const totalPerModelTokenRateLimited = perModelTokenRows.reduce((s, r) => s + r.rate_limited, 0);

  const totalSubscriptionCost = Number(subscriptionRows.reduce((s, r) => s + r.cost, 0).toFixed(2));
  const totalSubscriptionRateLimited = subscriptionRows.reduce((s, r) => s + r.rate_limited, 0);

  const totalCost = totalPerRequestWeightedCost + totalPerModelTokenCost + totalSubscriptionCost;
  const totalRequests = logs.length;
  const totalRateLimited = logs.filter((l) => l.status === "rate_limited").length;

  return {
    total_cost: totalCost,
    total_requests: totalRequests,
    total_rate_limited: totalRateLimited,
    by_pricing_model: {
      per_request_weighted: {
        label: "按请求加权",
        rows: perRequestWeightedRows,
        total_weighted_requests: totalPerRequestWeightedRequests,
        total_cost: totalPerRequestWeightedCost,
        total_rate_limited: totalPerRequestWeightedRateLimited,
      },
      per_model_token: {
        label: "按 Token",
        rows: perModelTokenRows,
        total_tokens: totalPerModelTokenTokens,
        total_cost: totalPerModelTokenCost,
        total_rate_limited: totalPerModelTokenRateLimited,
      },
      subscription: {
        label: "订阅制",
        rows: subscriptionRows,
        total_cost: totalSubscriptionCost,
        total_rate_limited: totalSubscriptionRateLimited,
      },
    },
    rate_limited_auths: rateLimitedAuths,
  };
}

// ============================================================
// Time Series Stats
// ============================================================

export async function getTimeSeriesStats(
  granularity: "minute" | "hour" | "day" = "hour",
  opts?: StatsQueryOptions,
): Promise<TimeBucket[]> {
  const db = await getDb();

  const logs = await db
    .selectFrom("request_logs")
    .selectAll()
    .$if(!!opts?.from, (qb) => qb.where("timestamp", ">=", opts!.from!))
    .$if(!!opts?.to, (qb) => qb.where("timestamp", "<=", opts!.to!))
    .$if(!!opts?.modelAlias, (qb) =>
      qb.where("model_alias", "=", opts!.modelAlias!),
    )
    .$if(!!opts?.providerId, (qb) =>
      qb.where("provider_id", "=", opts!.providerId!),
    )
    .$if(!!opts?.authKey, (qb) => qb.where("auth_key", "=", opts!.authKey!))
    .orderBy("timestamp", "asc")
    .execute();

  // Group by time buckets
  const bucketMap = new Map<string, typeof logs>();

  for (const log of logs) {
    const ts = new Date(log.timestamp);
    let bucketKey: string;

    switch (granularity) {
      case "minute":
        ts.setSeconds(0, 0);
        bucketKey = ts.toISOString();
        break;
      case "hour":
        ts.setMinutes(0, 0, 0);
        bucketKey = ts.toISOString();
        break;
      case "day":
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

  const buckets: TimeBucket[] = [];
  for (const [timestamp, bucketLogs] of bucketMap.entries()) {
    const requests = bucketLogs.length;
    const successfulRequests = bucketLogs.filter(
      (l) => l.status === "success",
    ).length;
    const failedRequests = bucketLogs.filter(
      (l) => l.status === "error" || l.status === "timeout",
    ).length;
    const rateLimitedRequests = bucketLogs.filter(
      (l) => l.status === "rate_limited",
    ).length;
    const inputTokens = bucketLogs.reduce((s, l) => s + l.input_tokens, 0);
    const outputTokens = bucketLogs.reduce((s, l) => s + l.output_tokens, 0);
    const totalTokens = bucketLogs.reduce((s, l) => s + l.total_tokens, 0);
    const avgLatencyMs =
      requests > 0
        ? bucketLogs.reduce((s, l) => s + l.latency_ms, 0) / requests
        : 0;

    buckets.push({
      timestamp,
      requests,
      successfulRequests,
      failedRequests,
      rateLimitedRequests,
      inputTokens,
      outputTokens,
      totalTokens,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
    });
  }

  return buckets;
}

// ============================================================
// Model Stats
// ============================================================

export async function getModelStats(
  opts?: StatsQueryOptions,
): Promise<ModelStats[]> {
  const db = await getDb();

  const logs = await db
    .selectFrom("request_logs")
    .selectAll()
    .$if(!!opts?.from, (qb) => qb.where("timestamp", ">=", opts!.from!))
    .$if(!!opts?.to, (qb) => qb.where("timestamp", "<=", opts!.to!))
    .$if(!!opts?.providerId, (qb) =>
      qb.where("provider_id", "=", opts!.providerId!),
    )
    .$if(!!opts?.authKey, (qb) => qb.where("auth_key", "=", opts!.authKey!))
    .execute();

  const modelMap = new Map<string, typeof logs>();
  for (const log of logs) {
    if (!modelMap.has(log.model_alias)) {
      modelMap.set(log.model_alias, []);
    }
    modelMap.get(log.model_alias)!.push(log);
  }

  return Array.from(modelMap.entries()).map(([modelAlias, modelLogs]) => {
    const totalRequests = modelLogs.length;
    const successfulRequests = modelLogs.filter(
      (l) => l.status === "success",
    ).length;
    const failedRequests = modelLogs.filter(
      (l) => l.status === "error" || l.status === "timeout",
    ).length;
    const rateLimitedRequests = modelLogs.filter(
      (l) => l.status === "rate_limited",
    ).length;
    const totalInputTokens = modelLogs.reduce((s, l) => s + l.input_tokens, 0);
    const totalOutputTokens = modelLogs.reduce(
      (s, l) => s + l.output_tokens,
      0,
    );
    const totalTokens = modelLogs.reduce((s, l) => s + l.total_tokens, 0);
    const avgLatencyMs =
      totalRequests > 0
        ? modelLogs.reduce((s, l) => s + l.latency_ms, 0) / totalRequests
        : 0;
    const errorRate =
      totalRequests > 0
        ? (failedRequests + rateLimitedRequests) / totalRequests
        : 0;

    return {
      modelAlias,
      totalRequests,
      successfulRequests,
      failedRequests,
      rateLimitedRequests,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      errorRate: Number(errorRate.toFixed(4)),
    };
  });
}

// ============================================================
// Provider Stats
// ============================================================

export async function getProviderStats(
  opts?: StatsQueryOptions,
): Promise<ProviderStats[]> {
  const db = await getDb();

  const logs = await db
    .selectFrom("request_logs")
    .selectAll()
    .$if(!!opts?.from, (qb) => qb.where("timestamp", ">=", opts!.from!))
    .$if(!!opts?.to, (qb) => qb.where("timestamp", "<=", opts!.to!))
    .$if(!!opts?.modelAlias, (qb) =>
      qb.where("model_alias", "=", opts!.modelAlias!),
    )
    .$if(!!opts?.authKey, (qb) => qb.where("auth_key", "=", opts!.authKey!))
    .execute();

  const providerMap = new Map<string, typeof logs>();
  for (const log of logs) {
    if (!providerMap.has(log.provider_id)) {
      providerMap.set(log.provider_id, []);
    }
    providerMap.get(log.provider_id)!.push(log);
  }

  return Array.from(providerMap.entries()).map(
    ([providerId, providerLogs]) => {
      const totalRequests = providerLogs.length;
      const successfulRequests = providerLogs.filter(
        (l) => l.status === "success",
      ).length;
      const failedRequests = providerLogs.filter(
        (l) => l.status === "error" || l.status === "timeout",
      ).length;
      const avgLatencyMs =
        totalRequests > 0
          ? providerLogs.reduce((s, l) => s + l.latency_ms, 0) / totalRequests
          : 0;
      const uptimePercentage =
        totalRequests > 0
          ? ((totalRequests - failedRequests) / totalRequests) * 100
          : 100;

      return {
        providerId,
        totalRequests,
        successfulRequests,
        failedRequests,
        avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
        uptimePercentage: Number(uptimePercentage.toFixed(2)),
      };
    },
  );
}

// ============================================================
// Auth Stats
// ============================================================

export async function getAuthStats(
  opts?: StatsQueryOptions,
): Promise<AuthStats[]> {
  const db = await getDb();

  const logs = await db
    .selectFrom("request_logs")
    .selectAll()
    .$if(!!opts?.from, (qb) => qb.where("timestamp", ">=", opts!.from!))
    .$if(!!opts?.to, (qb) => qb.where("timestamp", "<=", opts!.to!))
    .$if(!!opts?.modelAlias, (qb) =>
      qb.where("model_alias", "=", opts!.modelAlias!),
    )
    .$if(!!opts?.providerId, (qb) =>
      qb.where("provider_id", "=", opts!.providerId!),
    )
    .execute();

  const authMap = new Map<string, typeof logs>();
  for (const log of logs) {
    if (!authMap.has(log.auth_key)) {
      authMap.set(log.auth_key, []);
    }
    authMap.get(log.auth_key)!.push(log);
  }

  return Array.from(authMap.entries()).map(([authKey, authLogs]) => ({
    keyId: authKey.substring(0, 8) + "...",
    keyName: authKey,
    totalRequests: authLogs.length,
    totalTokens: authLogs.reduce((s, l) => s + l.total_tokens, 0),
  }));
}
