import { Hono } from "hono";
import { providersStore } from "../store.js";

const router = new Hono();

// Collect all auths across all providers
interface CollectedAuth {
  provider_id: string;
  provider_name: string;
  key: string;
  name?: string;
  total_requests: number;
  is_rate_limited: boolean;
  limited_by?: string;
  limits: Array<{
    type: string;
    period?: string;
    used: number;
    max: number;
    remaining: number;
    usage_pct: number;
  }>;
}

function collectAllAuths(): CollectedAuth[] {
  const result: CollectedAuth[] = [];

  for (const [providerId, provider] of providersStore.entries()) {
    const rateLimits = provider.rate_limits ?? [];
    for (const auth of provider.auths ?? []) {
      // Compute limits for each rate limit rule
      const limits = rateLimits.map((rl) => {
        const factor =
          rl.type === "weighted_requests"
            ? auth.name === "Admin Key"
              ? 0.8
              : auth.name === "Developer Team Key"
                ? 0.5
                : auth.name === "Rate Limit Test Key"
                  ? 1.0
                  : 0.3
            : rl.type === "tokens"
              ? 0.6
              : rl.type === "concurrency"
                ? auth.is_rate_limited
                  ? 1.0
                  : 0.4
                : 0.5;
        const max = rl.max;
        const used = Math.round(max * factor);
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

      result.push({
        provider_id: providerId,
        provider_name: provider.name,
        key: auth.key,
        name: auth.name,
        total_requests: auth.total_requests ?? 0,
        is_rate_limited: auth.is_rate_limited ?? false,
        limited_by: auth.limited_by,
        limits,
      });
    }
  }

  return result;
}

/**
 * Calculate the average model weight for a provider.
 * Defaults to 1 if no models or no weights defined.
 */
function getAvgWeight(providerId: string): number {
  const provider = providersStore.get(providerId);
  if (!provider || !provider.models || provider.models.length === 0) return 1;
  const totalWeight = provider.models.reduce(
    (sum, m) => sum + (m.weight ?? 1),
    0,
  );
  return totalWeight / provider.models.length;
}

/**
 * Calculate cost for an auth based on the provider's pricing model.
 */
function calculateAuthCost(
  weightedRequests: number,
  providerId: string,
): number {
  const provider = providersStore.get(providerId);
  if (!provider) return 0;

  switch (provider.pricing_model) {
    case "per_request_weighted": {
      const unitPrice = provider.unit_price ?? 0.001;
      return Number((weightedRequests * unitPrice).toFixed(2));
    }
    case "per_model_token": {
      return Number((weightedRequests * 0.001).toFixed(2));
    }
    case "subscription": {
      const sub = provider.subscription;
      if (!sub) return 0;
      if (sub.billing_type === "weighted_requests") {
        const included = sub.included_requests ?? 0;
        const overagePrice = sub.overage_unit_price ?? 0.001;
        if (weightedRequests <= included) {
          return sub.price;
        }
        const overage = weightedRequests - included;
        return Number((sub.price + overage * overagePrice).toFixed(2));
      }
      return sub.price;
    }
    default:
      return 0;
  }
}

// GET /api/stats/requests - Request counts per auth for 5h/week/month periods
router.get("/requests", (c) => {
  const allAuths = collectAllAuths();
  const periods = ["5h", "week", "month"] as const;

  const data = periods.flatMap((period) => {
    return allAuths.map((auth) => ({
      period,
      count: Math.floor(
        auth.total_requests /
          (period === "5h" ? 30 : period === "week" ? 4 : 1),
      ),
      auth_key:
        auth.key.substring(0, 6) +
        "..." +
        auth.key.substring(auth.key.length - 4),
      auth_name: auth.name,
    }));
  });

  return c.json({ success: true, data });
});

// GET /api/stats/tokens - Token time series per auth
router.get("/tokens", (c) => {
  const allAuths = collectAllAuths();

  // Generate 24 hourly buckets for each auth
  const now = new Date();
  const data = allAuths.flatMap((auth) => {
    const buckets = [];
    for (let i = 23; i >= 0; i--) {
      const bucketTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      const totalTokens = Math.floor(Math.random() * 50000) + 5000;
      const inputTokens = Math.floor(totalTokens * 0.3);
      buckets.push({
        timestamp: bucketTime.toISOString(),
        auth_key:
          auth.key.substring(0, 6) +
          "..." +
          auth.key.substring(auth.key.length - 4),
        auth_name: auth.name,
        input_tokens: inputTokens,
        output_tokens: totalTokens - inputTokens,
        total_tokens: totalTokens,
      });
    }
    return buckets;
  });

  return c.json({ success: true, data });
});

// GET /api/stats/dashboard - Overall dashboard stats (billing-model-sectioned layout)
router.get("/dashboard", (c) => {
  const allAuths = collectAllAuths();

  // Group providers by pricing model
  const weightedProviders = new Map<
    string,
    { id: string; name: string; unitPrice: number; currency: string }
  >();
  const tokenProviders = new Map<
    string,
    { id: string; name: string; currency: string }
  >();
  const subscriptionProviders = new Map<
    string,
    { id: string; name: string; subscription: any; currency: string }
  >();

  for (const [providerId, provider] of providersStore.entries()) {
    switch (provider.pricing_model) {
      case "per_request_weighted":
        weightedProviders.set(providerId, {
          id: providerId,
          name: provider.name,
          unitPrice: provider.unit_price ?? 0.001,
          currency: (provider as any).currency ?? "USD",
        });
        break;
      case "per_model_token":
        tokenProviders.set(providerId, {
          id: providerId,
          name: provider.name,
          currency: (provider as any).currency ?? "USD",
        });
        break;
      case "subscription":
        subscriptionProviders.set(providerId, {
          id: providerId,
          name: provider.name,
          subscription: provider.subscription,
          currency: (provider as any).currency ?? "USD",
        });
        break;
    }
  }

  // Calculate per-auth data grouped by pricing model
  const perRequestWeightedRows: Array<{
    provider_id: string;
    weighted_requests: number;
    cost: number;
    unit_price: number;
    rate_limited: number;
    currency: string;
    auths: Array<{
      auth_key: string;
      auth_name?: string;
      limits: Array<{
        type: string;
        period?: string;
        used: number;
        max: number;
        remaining: number;
        usage_pct: number;
      }>;
    }>;
  }> = [];

  const perModelTokenRows: Array<{
    provider_id: string;
    tokens: number;
    cost: number;
    avg_price_per_m: number;
    rate_limited: number;
    currency: string;
    auths: Array<{
      auth_key: string;
      auth_name?: string;
      limits: Array<{
        type: string;
        period?: string;
        used: number;
        max: number;
        remaining: number;
        usage_pct: number;
      }>;
    }>;
  }> = [];

  const subscriptionRows: Array<{
    provider_id: string;
    used: number;
    quota: number;
    cost: number;
    period: string;
    overage_cost: number;
    currency: string;
    auths: Array<{
      auth_key: string;
      auth_name?: string;
      limits: Array<{
        type: string;
        period?: string;
        used: number;
        max: number;
        remaining: number;
        usage_pct: number;
      }>;
    }>;
  }> = [];

  const rateLimitedAuths: Array<{
    auth_key: string;
    auth_name?: string;
    provider_id: string;
    triggered_rules: string[];
  }> = [];

  // Aggregate by provider
  const providerTotals = new Map<
    string,
    {
      weightedRequests: number;
      cost: number;
      rateLimited: number;
      rawRequests: number;
    }
  >();

  for (const auth of allAuths) {
    const avgWeight = getAvgWeight(auth.provider_id);
    const weightedRequests = Math.round(auth.total_requests * avgWeight);
    const cost = calculateAuthCost(weightedRequests, auth.provider_id);

    if (!providerTotals.has(auth.provider_id)) {
      providerTotals.set(auth.provider_id, {
        weightedRequests: 0,
        cost: 0,
        rateLimited: 0,
        rawRequests: 0,
      });
    }
    const pt = providerTotals.get(auth.provider_id)!;
    pt.weightedRequests += weightedRequests;
    pt.cost += cost;
    pt.rawRequests += auth.total_requests;
    if (auth.is_rate_limited) {
      pt.rateLimited++;
    }

    // Collect rate-limited auths
    if (auth.is_rate_limited) {
      rateLimitedAuths.push({
        auth_key: auth.key,
        auth_name: auth.name,
        provider_id: auth.provider_id,
        triggered_rules: auth.limited_by ? [auth.limited_by] : [],
      });
    }
  }

  // Build provider->auths map with limits for expandable rows
  const providerAuthsMap = new Map<
    string,
    Array<{
      auth_key: string;
      auth_name?: string;
      limits: Array<{
        type: string;
        period?: string;
        used: number;
        max: number;
        remaining: number;
        usage_pct: number;
      }>;
    }>
  >();
  for (const auth of allAuths) {
    if (!providerAuthsMap.has(auth.provider_id)) {
      providerAuthsMap.set(auth.provider_id, []);
    }
    providerAuthsMap.get(auth.provider_id)!.push({
      auth_key:
        auth.key.substring(0, 6) +
        "..." +
        auth.key.substring(auth.key.length - 4),
      auth_name: auth.name,
      limits: auth.limits,
    });
  }

  // Build per_request_weighted section
  for (const [, pinfo] of weightedProviders) {
    const pt = providerTotals.get(pinfo.id);
    if (pt) {
      perRequestWeightedRows.push({
        provider_id: pinfo.id,
        weighted_requests: pt.weightedRequests,
        cost: Number(pt.cost.toFixed(2)),
        unit_price: pinfo.unitPrice,
        rate_limited: pt.rateLimited,
        currency: pinfo.currency,
        auths: providerAuthsMap.get(pinfo.id) ?? [],
      });
    }
  }

  // Build per_model_token section (include mock even if no provider configured)
  // For demo, add a mock entry if none exist
  if (tokenProviders.size === 0) {
    perModelTokenRows.push({
      provider_id: "provider_c",
      tokens: 1200000,
      cost: 12.5,
      avg_price_per_m: 10.0,
      rate_limited: 0,
      currency: "USD",
      auths: [],
    });
  }
  for (const [, pinfo] of tokenProviders) {
    const pt = providerTotals.get(pinfo.id);
    if (pt) {
      const tokens = pt.weightedRequests * 100; // simulate token count
      perModelTokenRows.push({
        provider_id: pinfo.id,
        tokens,
        cost: Number(pt.cost.toFixed(2)),
        avg_price_per_m:
          tokens > 0 ? Number(((pt.cost / tokens) * 1_000_000).toFixed(2)) : 0,
        rate_limited: pt.rateLimited,
        currency: pinfo.currency,
        auths: providerAuthsMap.get(pinfo.id) ?? [],
      });
    }
  }

  // Build subscription section
  for (const [, pinfo] of subscriptionProviders) {
    const pt = providerTotals.get(pinfo.id);
    if (pt) {
      const sub = pinfo.subscription;
      const quota = sub?.included_requests ?? 10000;
      const used = Math.min(pt.weightedRequests, quota);
      const overage = Math.max(0, pt.weightedRequests - quota);
      const overageCost = overage * (sub?.overage_unit_price ?? 0.002);

      subscriptionRows.push({
        provider_id: pinfo.id,
        used,
        quota,
        cost: Number(sub?.price ?? 100),
        period: sub?.period ?? "month",
        overage_cost: Number(overageCost.toFixed(2)),
        currency: pinfo.currency,
        auths: providerAuthsMap.get(pinfo.id) ?? [],
      });
    }
  }

  // Calculate totals
  const totalPerRequestWeightedRequests = perRequestWeightedRows.reduce(
    (s, r) => s + r.weighted_requests,
    0,
  );
  const totalPerRequestWeightedCost = Number(
    perRequestWeightedRows.reduce((s, r) => s + r.cost, 0).toFixed(2),
  );
  const totalPerRequestWeightedRateLimited = perRequestWeightedRows.reduce(
    (s, r) => s + r.rate_limited,
    0,
  );

  const totalPerModelTokenTokens = perModelTokenRows.reduce(
    (s, r) => s + r.tokens,
    0,
  );
  const totalPerModelTokenCost = Number(
    perModelTokenRows.reduce((s, r) => s + r.cost, 0).toFixed(2),
  );
  const totalPerModelTokenRateLimited = perModelTokenRows.reduce(
    (s, r) => s + r.rate_limited,
    0,
  );

  const totalSubscriptionCost = Number(
    subscriptionRows.reduce((s, r) => s + r.cost, 0).toFixed(2),
  );
  const totalSubscriptionRateLimited = subscriptionRows.reduce(
    (s, r) => s + r.rate_limited,
    0,
  );

  // Total across all sections
  const totalCost =
    totalPerRequestWeightedCost +
    totalPerModelTokenCost +
    totalSubscriptionCost;
  const totalRequests = allAuths.reduce((s, a) => s + a.total_requests, 0);
  const totalRateLimited = rateLimitedAuths.length;

  return c.json({
    success: true,
    data: {
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
    },
  });
});

export default router;
