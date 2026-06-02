import { describe, it, expect } from "vitest";
import {
  RateLimitTypeSchema,
  RateLimitPeriodSchema,
  WeightedRequestRateLimitSchema,
  ConcurrencyRateLimitSchema,
  TokenRateLimitSchema,
  RateLimitSchema,
  ProviderModelSchema,
  ProviderSchema,
  CreateProviderSchema,
  UpdateProviderSchema,
  ProviderWithMetaSchema,
  ProviderListSchema,
  SubscriptionBillingTypeSchema,
} from "../src/schemas/providers.js";

describe("RateLimitTypeSchema", () => {
  it("should accept valid types", () => {
    for (const t of ["weighted_requests", "concurrency", "tokens"]) {
      const result = RateLimitTypeSchema.safeParse(t);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid types", () => {
    const result = RateLimitTypeSchema.safeParse("bandwidth");
    expect(result.success).toBe(false);
  });
});

describe("RateLimitPeriodSchema", () => {
  it("should accept valid periods", () => {
    for (const p of ["second", "minute", "hour", "day"]) {
      const result = RateLimitPeriodSchema.safeParse(p);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid periods", () => {
    const result = RateLimitPeriodSchema.safeParse("invalid_period");
    expect(result.success).toBe(false);
  });
});

describe("WeightedRequestRateLimitSchema", () => {
  it("should parse a valid weighted request rate limit", () => {
    const result = WeightedRequestRateLimitSchema.safeParse({
      type: "weighted_requests",
      max: 100,
      period: "minute",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("weighted_requests");
      expect(result.data.max).toBe(100);
      expect(result.data.period).toBe("minute");
    }
  });

  it("should reject non-positive max", () => {
    const result = WeightedRequestRateLimitSchema.safeParse({
      type: "weighted_requests",
      max: 0,
      period: "minute",
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative max", () => {
    const result = WeightedRequestRateLimitSchema.safeParse({
      type: "weighted_requests",
      max: -5,
      period: "hour",
    });
    expect(result.success).toBe(false);
  });

  it("should reject non-integer max", () => {
    const result = WeightedRequestRateLimitSchema.safeParse({
      type: "weighted_requests",
      max: 10.5,
      period: "minute",
    });
    expect(result.success).toBe(false);
  });
});

describe("ConcurrencyRateLimitSchema", () => {
  it("should parse a valid concurrency limit", () => {
    const result = ConcurrencyRateLimitSchema.safeParse({
      type: "concurrency",
      max: 10,
    });
    expect(result.success).toBe(true);
  });

  it("should reject max of 0", () => {
    const result = ConcurrencyRateLimitSchema.safeParse({
      type: "concurrency",
      max: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("TokenRateLimitSchema", () => {
  it("should parse a valid token rate limit", () => {
    const result = TokenRateLimitSchema.safeParse({
      type: "tokens",
      max: 50000,
      period: "minute",
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-positive max", () => {
    const result = TokenRateLimitSchema.safeParse({
      type: "tokens",
      max: 0,
      period: "minute",
    });
    expect(result.success).toBe(false);
  });
});

describe("SubscriptionBillingTypeSchema", () => {
  it("should accept unlimited", () => {
    const result = SubscriptionBillingTypeSchema.safeParse("unlimited");
    expect(result.success).toBe(true);
  });

  it("should accept weighted_requests", () => {
    const result = SubscriptionBillingTypeSchema.safeParse("weighted_requests");
    expect(result.success).toBe(true);
  });

  it("should accept tokens", () => {
    const result = SubscriptionBillingTypeSchema.safeParse("tokens");
    expect(result.success).toBe(true);
  });

  it("should reject invalid billing type", () => {
    const result = SubscriptionBillingTypeSchema.safeParse("invalid_type");
    expect(result.success).toBe(false);
  });
});

describe("RateLimitSchema (discriminated union)", () => {
  it("should discriminate weighted_requests type", () => {
    const result = RateLimitSchema.safeParse({
      type: "weighted_requests",
      max: 100,
      period: "hour",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("weighted_requests");
    }
  });

  it("should discriminate concurrency type", () => {
    const result = RateLimitSchema.safeParse({
      type: "concurrency",
      max: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("concurrency");
      // Concurrency should not have period
      expect("period" in result.data).toBe(false);
    }
  });

  it("should discriminate tokens type", () => {
    const result = RateLimitSchema.safeParse({
      type: "tokens",
      max: 100000,
      period: "day",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("tokens");
    }
  });

  it("should reject invalid type discriminator", () => {
    const result = RateLimitSchema.safeParse({
      type: "bandwidth",
      max: 100,
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing period for weighted_requests type", () => {
    const result = RateLimitSchema.safeParse({
      type: "weighted_requests",
      max: 100,
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing period for tokens type", () => {
    const result = RateLimitSchema.safeParse({
      type: "tokens",
      max: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe("ProviderModelSchema", () => {
  it("should parse a minimal provider model", () => {
    const result = ProviderModelSchema.safeParse({ name: "gpt-4" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
    }
  });

  it("should parse a full provider model", () => {
    const result = ProviderModelSchema.safeParse({
      name: "gpt-4-turbo",
      display_name: "GPT-4 Turbo",
      alias: "turbo-model",
      enabled: true,
      weight: 2,
      input_price: 10.0,
      output_price: 30.0,
      max_tokens: 8192,
      context_window: 128000,
      input_price_per_million: 10.0,
      output_price_per_million: 30.0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weight).toBe(2);
      expect(result.data.input_price).toBe(10.0);
      expect(result.data.output_price).toBe(30.0);
    }
  });

  it("should reject empty name", () => {
    const result = ProviderModelSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("should reject negative max_tokens", () => {
    const result = ProviderModelSchema.safeParse({
      name: "test",
      max_tokens: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should reject zero max_tokens", () => {
    const result = ProviderModelSchema.safeParse({
      name: "test",
      max_tokens: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should accept zero input_price_per_million", () => {
    const result = ProviderModelSchema.safeParse({
      name: "free-model",
      input_price_per_million: 0,
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative price", () => {
    const result = ProviderModelSchema.safeParse({
      name: "test",
      input_price_per_million: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional alias field", () => {
    const result = ProviderModelSchema.safeParse({
      name: "gpt-4",
      alias: "my-custom-alias",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alias).toBe("my-custom-alias");
    }
  });

  it("should be undefined when weight not provided", () => {
    const result = ProviderModelSchema.safeParse({ name: "gpt-4" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weight).toBeUndefined();
    }
  });

  it("should accept custom weight", () => {
    const result = ProviderModelSchema.safeParse({ name: "gpt-4", weight: 2.5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weight).toBe(2.5);
    }
  });

  it("should reject zero weight", () => {
    const result = ProviderModelSchema.safeParse({ name: "gpt-4", weight: 0 });
    expect(result.success).toBe(false);
  });

  it("should reject negative weight", () => {
    const result = ProviderModelSchema.safeParse({ name: "gpt-4", weight: -1 });
    expect(result.success).toBe(false);
  });

  it("should accept input_price and output_price", () => {
    const result = ProviderModelSchema.safeParse({
      name: "gpt-4",
      input_price: 2.5,
      output_price: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.input_price).toBe(2.5);
      expect(result.data.output_price).toBe(10);
    }
  });

  it("should reject negative input_price", () => {
    const result = ProviderModelSchema.safeParse({
      name: "gpt-4",
      input_price: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should accept zero price", () => {
    const result = ProviderModelSchema.safeParse({
      name: "free-model",
      input_price: 0,
      output_price: 0,
    });
    expect(result.success).toBe(true);
  });

  it("should accept cache_hit_price and cache_create_price as optional", () => {
    const result = ProviderModelSchema.safeParse({ name: "gpt-4" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cache_hit_price).toBeUndefined();
      expect(result.data.cache_create_price).toBeUndefined();
    }
  });

  it("should accept positive cache_hit_price", () => {
    const result = ProviderModelSchema.safeParse({
      name: "claude-opus",
      cache_hit_price: 1.5,
      cache_create_price: 2.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cache_hit_price).toBe(1.5);
      expect(result.data.cache_create_price).toBe(2.5);
    }
  });

  it("should reject negative cache_hit_price", () => {
    const result = ProviderModelSchema.safeParse({
      name: "test",
      cache_hit_price: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative cache_create_price", () => {
    const result = ProviderModelSchema.safeParse({
      name: "test",
      cache_create_price: -5,
    });
    expect(result.success).toBe(false);
  });

  it("should accept zero cache prices", () => {
    const result = ProviderModelSchema.safeParse({
      name: "free-model",
      cache_hit_price: 0,
      cache_create_price: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("ProviderSchema", () => {
  const validProvider = {
    id: "openai",
    name: "OpenAI",
    base_url: "https://api.openai.com/v1",
    models: [{ name: "gpt-4" }],
  };

  it("should parse a minimal valid provider", () => {
    const result = ProviderSchema.safeParse(validProvider);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.request_timeout_ms).toBe(60000);
      expect(result.data.max_retries).toBe(3);
      expect(result.data.rate_limits).toEqual([]);
      expect(result.data.pricing_model).toBe("per_request_weighted");
      expect(result.data.unit_price).toBe(0.001);
      expect(result.data.currency).toBe("USD");
      expect(result.data.subscription).toBeUndefined();
    }
  });

  it("should parse a full provider config", () => {
    const result = ProviderSchema.safeParse({
      id: "anthropic",
      name: "Anthropic",
      base_url: "https://api.anthropic.com/v1",
      models: [
        { name: "claude-3-opus", display_name: "Claude 3 Opus", enabled: true },
        { name: "claude-3-sonnet", enabled: false },
      ],
      rate_limits: [
        { type: "weighted_requests", max: 100, period: "minute" },
        { type: "concurrency", max: 10 },
      ],
      request_timeout_ms: 120000,
      max_retries: 5,
      enabled: true,
      description: "Anthropic provider",
      health_check_endpoint: "/health",
      metadata: { region: "us" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty id", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      id: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject id with special characters", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      id: "open ai!",
    });
    expect(result.success).toBe(false);
  });

  it("should accept id with hyphens and underscores", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      id: "my-provider_01",
    });
    expect(result.success).toBe(true);
  });

  it("should reject id longer than 64 chars", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      id: "a".repeat(65),
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid base_url", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      base_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty models array", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      models: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative timeouts", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      request_timeout_ms: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should accept zero timeouts", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      request_timeout_ms: 0,
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative max_retries", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      max_retries: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should parse provider with per_request_weighted pricing", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "per_request_weighted",
      unit_price: 0.005,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricing_model).toBe("per_request_weighted");
      expect(result.data.unit_price).toBe(0.005);
      expect(result.data.subscription).toBeUndefined();
    }
  });

  it("should parse provider with per_model_token pricing", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "per_model_token",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricing_model).toBe("per_model_token");
      expect(result.data.unit_price).toBe(0.001);
    }
  });

  it("should parse provider with subscription pricing", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      unit_price: 0.002,
      subscription: {
        price: 499,
        period: "month",
        included_requests: 10000,
        overage_unit_price: 0.003,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricing_model).toBe("subscription");
      expect(result.data.unit_price).toBe(0.002);
      expect(result.data.subscription?.price).toBe(499);
      expect(result.data.subscription?.period).toBe("month");
      expect(result.data.subscription?.billing_type).toBe("weighted_requests");
      expect(result.data.subscription?.included_requests).toBe(10000);
      expect(result.data.subscription?.overage_unit_price).toBe(0.003);
    }
  });

  it("should parse subscription with billing_type=tokens", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 200,
        period: "year",
        billing_type: "tokens",
        included_tokens: 1000000,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscription?.billing_type).toBe("tokens");
      expect(result.data.subscription?.included_tokens).toBe(1000000);
      expect(result.data.subscription?.included_requests).toBeUndefined();
      expect(result.data.subscription?.overage_unit_price).toBeUndefined();
    }
  });

  it("should default billing_type to weighted_requests", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 100,
        period: "month",
        included_requests: 5000,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscription?.billing_type).toBe("weighted_requests");
    }
  });

  it("should default subscription currency to USD", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 100,
        period: "month",
        included_requests: 5000,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscription?.currency).toBe("USD");
    }
  });

  it("should accept custom currency in subscription", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 100,
        period: "month",
        currency: "CNY",
        included_requests: 5000,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscription?.currency).toBe("CNY");
    }
  });

  it("should parse provider with no_billing pricing", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "no_billing",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricing_model).toBe("no_billing");
    }
  });

  it("should reject invalid pricing_model value", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "invalid_model",
    });
    expect(result.success).toBe(false);
  });

  it("should reject subscription with negative price", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: -100,
        period: "month",
        included_requests: 10000,
        overage_unit_price: 0.002,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject subscription with negative overage_unit_price", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 100,
        period: "month",
        included_requests: 10000,
        overage_unit_price: -0.5,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative unit_price", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      unit_price: -0.5,
    });
    expect(result.success).toBe(false);
  });

  it("should default api_format to openai_chat", () => {
    const result = ProviderSchema.safeParse(validProvider);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.api_format).toBe("openai_chat");
    }
  });

  it("should accept api_format = openai_chat", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      api_format: "openai_chat",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.api_format).toBe("openai_chat");
    }
  });

  it("should accept api_format = anthropic_messages", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      api_format: "anthropic_messages",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.api_format).toBe("anthropic_messages");
    }
  });

  it("should accept api_format = openai_responses", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      api_format: "openai_responses",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.api_format).toBe("openai_responses");
    }
  });

  it("should reject invalid api_format", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      api_format: "unknown_format",
    });
    expect(result.success).toBe(false);
  });

  it("should default headers to empty object", () => {
    const result = ProviderSchema.safeParse(validProvider);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headers).toEqual({});
    }
  });

  it("should accept custom headers as Record<string, string>", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      headers: {
        "X-Custom-Header": "value1",
        "Authorization": "Bearer token123",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headers["X-Custom-Header"]).toBe("value1");
      expect(result.data.headers["Authorization"]).toBe("Bearer token123");
    }
  });

  it("should accept empty headers object", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      headers: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headers).toEqual({});
    }
  });

  it("should reject non-string header values", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      headers: {
        "X-Key": 123,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should accept subscription with billing_type = unlimited", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 500,
        period: "month",
        billing_type: "unlimited",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscription?.billing_type).toBe("unlimited");
    }
  });

  it("should accept subscription with included_tokens and no overage_unit_price", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 300,
        period: "year",
        billing_type: "tokens",
        included_tokens: 2000000,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subscription?.included_tokens).toBe(2000000);
      expect(result.data.subscription?.overage_unit_price).toBeUndefined();
    }
  });

  it("should reject subscription with invalid period", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 100,
        period: "week",
        included_requests: 1000,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject subscription with negative included_requests", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 100,
        period: "month",
        included_requests: -1,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject subscription with negative included_tokens", () => {
    const result = ProviderSchema.safeParse({
      ...validProvider,
      pricing_model: "subscription",
      subscription: {
        price: 100,
        period: "month",
        billing_type: "tokens",
        included_tokens: -100,
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateProviderSchema", () => {
  it("should parse a valid create input", () => {
    const result = CreateProviderSchema.safeParse({
      id: "new-provider",
      name: "New Provider",
      base_url: "https://api.example.com/v1",
      models: [{ name: "model-1" }],
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing id", () => {
    const result = CreateProviderSchema.safeParse({
      name: "Test",
      base_url: "https://api.example.com/v1",
      models: [{ name: "m" }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing models", () => {
    const result = CreateProviderSchema.safeParse({
      id: "test",
      name: "Test",
      base_url: "https://api.example.com/v1",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateProviderSchema", () => {
  it("should accept partial update", () => {
    const result = UpdateProviderSchema.safeParse({ name: "Updated" });
    expect(result.success).toBe(true);
  });

  it("should accept empty object", () => {
    const result = UpdateProviderSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept full update", () => {
    const result = UpdateProviderSchema.safeParse({
      id: "new-id",
      name: "New Name",
      base_url: "https://api.new.com/v1",
      enabled: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("ProviderWithMetaSchema", () => {
  it("should parse provider with metadata", () => {
    const result = ProviderWithMetaSchema.safeParse({
      id: "openai",
      name: "OpenAI",
      base_url: "https://api.openai.com/v1",
      models: [{ name: "gpt-4" }],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.health_status).toBe("unknown");
    }
  });

  it("should accept null last_health_check", () => {
    const result = ProviderWithMetaSchema.safeParse({
      id: "openai",
      name: "OpenAI",
      base_url: "https://api.openai.com/v1",
      models: [{ name: "gpt-4" }],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
      last_health_check: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid health_status", () => {
    const result = ProviderWithMetaSchema.safeParse({
      id: "openai",
      name: "OpenAI",
      base_url: "https://api.openai.com/v1",
      models: [{ name: "gpt-4" }],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
      health_status: "degraded",
    });
    expect(result.success).toBe(false);
  });
});

describe("ProviderListSchema", () => {
  it("should parse an array of providers", () => {
    const result = ProviderListSchema.safeParse([
      { id: "openai", name: "OpenAI", base_url: "https://api.openai.com/v1", models: [{ name: "gpt-4" }] },
      { id: "anthropic", name: "Anthropic", base_url: "https://api.anthropic.com/v1", models: [{ name: "claude" }] },
    ]);
    expect(result.success).toBe(true);
  });

  it("should accept empty array", () => {
    const result = ProviderListSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it("should reject invalid provider in array", () => {
    const result = ProviderListSchema.safeParse([
      { id: "ok", name: "OK", base_url: "https://ok.com/v1", models: [{ name: "m" }] },
      { id: "", name: "Bad", base_url: "https://bad.com/v1", models: [{ name: "m" }] },
    ]);
    expect(result.success).toBe(false);
  });
});
