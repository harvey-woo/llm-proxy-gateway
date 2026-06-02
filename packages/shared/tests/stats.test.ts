import { describe, it, expect } from "vitest";
import {
  StatsRequestPeriodSchema,
  StatsTokenGranularitySchema,
  RequestsPerPeriodSchema,
  TokensPerHourSchema,
  AuthStatsSchema,
  DashboardStatsSchema,
  PerRequestWeightedRowSchema,
  PerRequestWeightedSectionSchema,
  PerModelTokenRowSchema,
  PerModelTokenSectionSchema,
  SubscriptionRowSchema,
  SubscriptionSectionSchema,
  RateLimitedAuthEntrySchema,
  ByPricingModelSchema,
  StatsQuerySchema,
  LimitInfoSchema,
  SectionAuthInfoSchema,
} from "../src/schemas/stats.js";

describe("StatsRequestPeriodSchema", () => {
  it("should accept valid periods", () => {
    for (const p of ["5h", "week", "month"]) {
      const result = StatsRequestPeriodSchema.safeParse(p);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid periods", () => {
    const result = StatsRequestPeriodSchema.safeParse("day");
    expect(result.success).toBe(false);
  });
});

describe("StatsTokenGranularitySchema", () => {
  it("should accept valid granularities", () => {
    for (const g of ["hour", "day", "month"]) {
      const result = StatsTokenGranularitySchema.safeParse(g);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid granularities", () => {
    const result = StatsTokenGranularitySchema.safeParse("week");
    expect(result.success).toBe(false);
  });
});

describe("RequestsPerPeriodSchema", () => {
  it("should parse valid requests per period", () => {
    const result = RequestsPerPeriodSchema.safeParse({
      period: "5h",
      count: 100,
      auth_key: "sk-test-key",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with optional auth_name", () => {
    const result = RequestsPerPeriodSchema.safeParse({
      period: "week",
      count: 500,
      auth_key: "sk-test-key",
      auth_name: "Test Key",
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative count", () => {
    const result = RequestsPerPeriodSchema.safeParse({
      period: "5h",
      count: -1,
      auth_key: "sk-test-key",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing auth_key", () => {
    const result = RequestsPerPeriodSchema.safeParse({
      period: "5h",
      count: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe("TokensPerHourSchema", () => {
  it("should parse valid tokens per period", () => {
    const result = TokensPerHourSchema.safeParse({
      timestamp: "2024-01-01T00:00:00Z",
      auth_key: "sk-test-key",
      input_tokens: 50000,
      output_tokens: 30000,
      total_tokens: 80000,
    });
    expect(result.success).toBe(true);
  });

  it("should parse with optional auth_name", () => {
    const result = TokensPerHourSchema.safeParse({
      timestamp: "2024-01-01T00:00:00Z",
      auth_key: "sk-test-key",
      auth_name: "Test Key",
      input_tokens: 50000,
      output_tokens: 30000,
      total_tokens: 80000,
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative tokens", () => {
    const result = TokensPerHourSchema.safeParse({
      timestamp: "2024-01-01T00:00:00Z",
      auth_key: "sk-test-key",
      input_tokens: -100,
      output_tokens: 0,
      total_tokens: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing auth_key", () => {
    const result = TokensPerHourSchema.safeParse({
      timestamp: "2024-01-01T00:00:00Z",
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("AuthStatsSchema", () => {
  it("should parse valid auth stats", () => {
    const result = AuthStatsSchema.safeParse({
      key_id: "key-123",
      key_name: "Production Key",
      total_requests: 10000,
      successful_requests: 9500,
      failed_requests: 400,
      rate_limited_requests: 100,
      total_tokens: 5000000,
      is_rate_limited: false,
    });
    expect(result.success).toBe(true);
  });

  it("should parse minimal auth stats", () => {
    const result = AuthStatsSchema.safeParse({
      key_id: "key-1",
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      rate_limited_requests: 0,
      total_tokens: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_rate_limited).toBe(false);
    }
  });

  it("should reject negative total_requests", () => {
    const result = AuthStatsSchema.safeParse({
      key_id: "key-1",
      total_requests: -1,
      successful_requests: 0,
      failed_requests: 0,
      rate_limited_requests: 0,
      total_tokens: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative total_tokens", () => {
    const result = AuthStatsSchema.safeParse({
      key_id: "key-1",
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      rate_limited_requests: 0,
      total_tokens: -100,
    });
    expect(result.success).toBe(false);
  });
});

describe("PerRequestWeightedRowSchema", () => {
  it("should parse valid per-request-weighted row", () => {
    const result = PerRequestWeightedRowSchema.safeParse({
      provider_id: "provider_a",
      weighted_requests: 8000,
      cost: 8.0,
      unit_price: 0.001,
      rate_limited: 2,
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative weighted_requests", () => {
    const result = PerRequestWeightedRowSchema.safeParse({
      provider_id: "provider_a",
      weighted_requests: -1,
      cost: 0,
      unit_price: 0.001,
      rate_limited: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should parse row with currency (optional field)", () => {
    const result = PerRequestWeightedRowSchema.safeParse({
      provider_id: "provider_a",
      weighted_requests: 8000,
      cost: 8.0,
      unit_price: 0.001,
      rate_limited: 2,
      currency: "USD",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
    }
  });

  it("should parse row without currency (optional field omitted)", () => {
    const result = PerRequestWeightedRowSchema.safeParse({
      provider_id: "provider_a",
      weighted_requests: 5000,
      cost: 5.0,
      unit_price: 0.001,
      rate_limited: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBeUndefined();
    }
  });
});

describe("PerRequestWeightedSectionSchema", () => {
  it("should parse valid section", () => {
    const result = PerRequestWeightedSectionSchema.safeParse({
      label: "按请求加权",
      rows: [
        { provider_id: "provider_a", weighted_requests: 8000, cost: 8.0, unit_price: 0.001, rate_limited: 2 },
        { provider_id: "provider_b", weighted_requests: 3000, cost: 3.0, unit_price: 0.001, rate_limited: 0 },
      ],
      total_weighted_requests: 11000,
      total_cost: 11.0,
      total_rate_limited: 2,
    });
    expect(result.success).toBe(true);
  });

  it("should parse empty rows", () => {
    const result = PerRequestWeightedSectionSchema.safeParse({
      label: "按请求加权",
      rows: [],
      total_weighted_requests: 0,
      total_cost: 0,
      total_rate_limited: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("PerModelTokenRowSchema", () => {
  it("should parse valid per-model-token row", () => {
    const result = PerModelTokenRowSchema.safeParse({
      provider_id: "provider_c",
      tokens: 1200000,
      cost: 12.5,
      avg_price_per_m: 10.0,
      rate_limited: 0,
    });
    expect(result.success).toBe(true);
  });

  it("should parse row with currency (optional field)", () => {
    const result = PerModelTokenRowSchema.safeParse({
      provider_id: "provider_c",
      tokens: 1200000,
      cost: 12.5,
      currency: "CNY",
      avg_price_per_m: 10.0,
      rate_limited: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("CNY");
    }
  });

  it("should parse row without currency (optional field omitted)", () => {
    const result = PerModelTokenRowSchema.safeParse({
      provider_id: "provider_c",
      tokens: 800000,
      cost: 8.0,
      avg_price_per_m: 10.0,
      rate_limited: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBeUndefined();
    }
  });
});

describe("PerModelTokenSectionSchema", () => {
  it("should parse valid section", () => {
    const result = PerModelTokenSectionSchema.safeParse({
      label: "按 Token",
      rows: [
        { provider_id: "provider_c", tokens: 1200000, cost: 12.5, avg_price_per_m: 10.0, rate_limited: 0 },
      ],
      total_tokens: 1200000,
      total_cost: 12.5,
      total_rate_limited: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("SubscriptionRowSchema", () => {
  it("should parse valid subscription row", () => {
    const result = SubscriptionRowSchema.safeParse({
      provider_id: "provider_d",
      used: 8000,
      quota: 10000,
      cost: 100,
      period: "month",
      overage_cost: 0,
    });
    expect(result.success).toBe(true);
  });

  it("should parse row with currency (optional field)", () => {
    const result = SubscriptionRowSchema.safeParse({
      provider_id: "provider_d",
      used: 8000,
      quota: 10000,
      cost: 100,
      period: "month",
      overage_cost: 0,
      currency: "EUR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("EUR");
    }
  });

  it("should parse row without currency (optional field omitted)", () => {
    const result = SubscriptionRowSchema.safeParse({
      provider_id: "provider_d",
      used: 5000,
      quota: 10000,
      cost: 50,
      period: "month",
      overage_cost: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBeUndefined();
    }
  });

  it("should parse row with null quota", () => {
    const result = SubscriptionRowSchema.safeParse({
      provider_id: "provider_d",
      used: 8000,
      quota: null,
      cost: 100,
      period: "month",
      overage_cost: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quota).toBeNull();
    }
  });
});

describe("SubscriptionSectionSchema", () => {
  it("should parse valid section", () => {
    const result = SubscriptionSectionSchema.safeParse({
      label: "订阅制",
      rows: [
        { provider_id: "provider_d", used: 8000, quota: 10000, cost: 100, period: "month", overage_cost: 0 },
      ],
      total_cost: 100,
      total_rate_limited: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("RateLimitedAuthEntrySchema", () => {
  it("should parse valid rate-limited auth entry", () => {
    const result = RateLimitedAuthEntrySchema.safeParse({
      auth_key: "sk-xxx",
      auth_name: "Test Key",
      provider_id: "provider_c",
      triggered_rules: ["weighted_requests/5h"],
    });
    expect(result.success).toBe(true);
  });

  it("should parse minimal entry (no auth_name)", () => {
    const result = RateLimitedAuthEntrySchema.safeParse({
      auth_key: "sk-xxx",
      provider_id: "provider_c",
      triggered_rules: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("ByPricingModelSchema", () => {
  it("should parse valid by-pricing-model data", () => {
    const result = ByPricingModelSchema.safeParse({
      per_request_weighted: {
        label: "按请求加权",
        rows: [],
        total_weighted_requests: 0,
        total_cost: 0,
        total_rate_limited: 0,
      },
      per_model_token: {
        label: "按 Token",
        rows: [],
        total_tokens: 0,
        total_cost: 0,
        total_rate_limited: 0,
      },
      subscription: {
        label: "订阅制",
        rows: [],
        total_cost: 0,
        total_rate_limited: 0,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("LimitInfoSchema", () => {
  it("should parse valid limit info", () => {
    const result = LimitInfoSchema.safeParse({
      type: "weighted_requests",
      period: "5h",
      used: 80,
      max: 100,
      remaining: 20,
      usage_pct: 80,
    });
    expect(result.success).toBe(true);
  });

  it("should parse limit info without period", () => {
    const result = LimitInfoSchema.safeParse({
      type: "concurrency",
      used: 4,
      max: 10,
      remaining: 6,
      usage_pct: 40,
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative used", () => {
    const result = LimitInfoSchema.safeParse({
      type: "weighted_requests",
      used: -1,
      max: 100,
      remaining: 101,
      usage_pct: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("SectionAuthInfoSchema", () => {
  it("should parse valid section auth info with limits", () => {
    const result = SectionAuthInfoSchema.safeParse({
      auth_key: "sk-adm...9i0j",
      auth_name: "Admin Key",
      limits: [
        { type: "weighted_requests", period: "5h", used: 80, max: 100, remaining: 20, usage_pct: 80 },
        { type: "tokens", period: "month", used: 500000, max: 1000000, remaining: 500000, usage_pct: 50 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should parse minimal section auth info without auth_name", () => {
    const result = SectionAuthInfoSchema.safeParse({
      auth_key: "sk-xxx",
      limits: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("PerRequestWeightedRowSchema with auths", () => {
  it("should parse row with auths", () => {
    const result = PerRequestWeightedRowSchema.safeParse({
      provider_id: "provider_a",
      weighted_requests: 8000,
      cost: 8.0,
      unit_price: 0.001,
      rate_limited: 2,
      auths: [
        {
          auth_key: "sk-adm...9i0j",
          auth_name: "Admin Key",
          limits: [{ type: "weighted_requests", period: "5h", used: 80, max: 100, remaining: 20, usage_pct: 80 }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should parse row without auths (default to [])", () => {
    const result = PerRequestWeightedRowSchema.safeParse({
      provider_id: "provider_a",
      weighted_requests: 8000,
      cost: 8.0,
      unit_price: 0.001,
      rate_limited: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auths).toEqual([]);
    }
  });
});

describe("PerModelTokenRowSchema with auths", () => {
  it("should parse row with auths", () => {
    const result = PerModelTokenRowSchema.safeParse({
      provider_id: "provider_c",
      tokens: 1200000,
      cost: 12.5,
      avg_price_per_m: 10.0,
      rate_limited: 0,
      auths: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("SubscriptionRowSchema with auths", () => {
  it("should parse row with auths", () => {
    const result = SubscriptionRowSchema.safeParse({
      provider_id: "provider_d",
      used: 8000,
      quota: 10000,
      cost: 100,
      period: "month",
      overage_cost: 0,
      auths: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("DashboardStatsSchema", () => {
  it("should parse valid dashboard stats with all sections", () => {
    const result = DashboardStatsSchema.safeParse({
      total_cost: 219.43,
      total_requests: 16752,
      total_rate_limited: 23,
      by_pricing_model: {
        per_request_weighted: {
          label: "按请求加权",
          rows: [
            { provider_id: "provider_a", weighted_requests: 8000, cost: 8.0, unit_price: 0.001, rate_limited: 2 },
            { provider_id: "provider_b", weighted_requests: 3000, cost: 3.0, unit_price: 0.001, rate_limited: 0 },
          ],
          total_weighted_requests: 11000,
          total_cost: 11.0,
          total_rate_limited: 2,
        },
        per_model_token: {
          label: "按 Token",
          rows: [
            { provider_id: "provider_c", tokens: 1200000, cost: 12.5, avg_price_per_m: 10.0, rate_limited: 0 },
          ],
          total_tokens: 1200000,
          total_cost: 12.5,
          total_rate_limited: 0,
        },
        subscription: {
          label: "订阅制",
          rows: [
            { provider_id: "provider_d", used: 8000, quota: 10000, cost: 100, period: "month", overage_cost: 0 },
          ],
          total_cost: 100,
          total_rate_limited: 0,
        },
      },
      rate_limited_auths: [
        { auth_key: "sk-xxx", auth_name: "Test Key", provider_id: "provider_c", triggered_rules: ["weighted_requests/5h"] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should parse minimal dashboard stats (empty sections)", () => {
    const result = DashboardStatsSchema.safeParse({
      total_cost: 0,
      total_requests: 0,
      total_rate_limited: 0,
      by_pricing_model: {
        per_request_weighted: {
          label: "按请求加权",
          rows: [],
          total_weighted_requests: 0,
          total_cost: 0,
          total_rate_limited: 0,
        },
        per_model_token: {
          label: "按 Token",
          rows: [],
          total_tokens: 0,
          total_cost: 0,
          total_rate_limited: 0,
        },
        subscription: {
          label: "订阅制",
          rows: [],
          total_cost: 0,
          total_rate_limited: 0,
        },
      },
      rate_limited_auths: [],
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative total_cost", () => {
    const result = DashboardStatsSchema.safeParse({
      total_cost: -1,
      total_requests: 0,
      total_rate_limited: 0,
      by_pricing_model: {
        per_request_weighted: {
          label: "按请求加权",
          rows: [],
          total_weighted_requests: 0,
          total_cost: 0,
          total_rate_limited: 0,
        },
        per_model_token: {
          label: "按 Token",
          rows: [],
          total_tokens: 0,
          total_cost: 0,
          total_rate_limited: 0,
        },
        subscription: {
          label: "订阅制",
          rows: [],
          total_cost: 0,
          total_rate_limited: 0,
        },
      },
      rate_limited_auths: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative total_requests", () => {
    const result = DashboardStatsSchema.safeParse({
      total_cost: 0,
      total_requests: -1,
      total_rate_limited: 0,
      by_pricing_model: {
        per_request_weighted: {
          label: "按请求加权",
          rows: [],
          total_weighted_requests: 0,
          total_cost: 0,
          total_rate_limited: 0,
        },
        per_model_token: {
          label: "按 Token",
          rows: [],
          total_tokens: 0,
          total_cost: 0,
          total_rate_limited: 0,
        },
        subscription: {
          label: "订阅制",
          rows: [],
          total_cost: 0,
          total_rate_limited: 0,
        },
      },
      rate_limited_auths: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative total_rate_limited", () => {
    const result = DashboardStatsSchema.safeParse({
      total_cost: 0,
      total_requests: 0,
      total_rate_limited: -1,
      by_pricing_model: {
        per_request_weighted: {
          label: "按请求加权",
          rows: [],
          total_weighted_requests: 0,
          total_cost: 0,
          total_rate_limited: 0,
        },
        per_model_token: {
          label: "按 Token",
          rows: [],
          total_tokens: 0,
          total_cost: 0,
          total_rate_limited: 0,
        },
        subscription: {
          label: "订阅制",
          rows: [],
          total_cost: 0,
          total_rate_limited: 0,
        },
      },
      rate_limited_auths: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("StatsQuerySchema", () => {
  it("should parse with all filters", () => {
    const result = StatsQuerySchema.safeParse({
      auth_key: "sk-xxx",
      period: "week",
      token_granularity: "day",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.period).toBe("week");
      expect(result.data.token_granularity).toBe("day");
    }
  });

  it("should parse empty query with defaults", () => {
    const result = StatsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.period).toBe("5h");
      expect(result.data.token_granularity).toBe("hour");
    }
  });

  it("should reject invalid period", () => {
    const result = StatsQuerySchema.safeParse({ period: "year" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid token_granularity", () => {
    const result = StatsQuerySchema.safeParse({ token_granularity: "year" });
    expect(result.success).toBe(false);
  });
});
