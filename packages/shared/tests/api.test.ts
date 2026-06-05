import { describe, it, expect } from "vitest";
import {
  ListModelAliasesQuerySchema,
  ListModelAliasesResponseSchema,
  GetModelAliasResponseSchema,
  CreateModelAliasResponseSchema,
  UpdateModelAliasResponseSchema,
  DeleteModelAliasResponseSchema,
  ListProvidersQuerySchema,
  ListProvidersResponseSchema,
  GetProviderResponseSchema,
  CreateProviderResponseSchema,
  UpdateProviderResponseSchema,
  DeleteProviderResponseSchema,
  ListAuthsQuerySchema,
  ListAuthsResponseSchema,
  GetAuthResponseSchema,
  CreateAuthResponseSchema,
  UpdateAuthResponseSchema,
  DeleteAuthResponseSchema,
  ValidateAuthKeyResponseSchema,
  DashboardStatsQuerySchema,
  DashboardStatsResponseSchema,
  RequestStatsQuerySchema,
  RequestStatsResponseSchema,
  TokenStatsQuerySchema,
  TokenStatsResponseSchema,
  AuthStatsResponseSchema,
  ApiStatsQuerySchema,
  ProxyChatCompletionRequestSchema,
  HealthCheckResponseSchema,
  ConfigReloadResponseSchema,
  ApiErrorSchema,
  ModelAliasRoutes,
  ProviderRoutes,
  AuthRoutes,
  StatsRoutes,
  GatewayRoutes,
  AllRoutes,
} from "../src/schemas/api.js";
import {
  ApiFormatSchema,
  ProxyRequestSchema,
  ProxyResponseSchema,
} from "../src/schemas/gateway.js";

// ============================================================
// Model Alias API Schemas
// ============================================================

describe("ListModelAliasesQuerySchema", () => {
  it("should parse empty query with defaults", () => {
    const result = ListModelAliasesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.page_size).toBe(20);
    }
  });

  it("should coerce string query params", () => {
    const result = ListModelAliasesQuerySchema.safeParse({
      page: "2",
      page_size: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.page_size).toBe(50);
    }
  });

  it("should accept enabled filter", () => {
    const result = ListModelAliasesQuerySchema.safeParse({ enabled: "true" });
    expect(result.success).toBe(true);
  });

  it("should accept provider_id filter", () => {
    const result = ListModelAliasesQuerySchema.safeParse({
      provider_id: "openai",
    });
    expect(result.success).toBe(true);
  });
});

describe("ListModelAliasesResponseSchema", () => {
  it("should parse valid paginated response", () => {
    const result = ListModelAliasesResponseSchema.safeParse({
      success: true,
      data: [
        {
          alias: "model-a",
          strategy: "proportional",
          models: [{ provider_id: "openai", model_name: "gpt-4" }],
          id: "550e8400-e29b-41d4-a716-446655440000",
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing pagination fields", () => {
    const result = ListModelAliasesResponseSchema.safeParse({
      success: true,
      data: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("GetModelAliasResponseSchema", () => {
  it("should parse valid get response", () => {
    const result = GetModelAliasResponseSchema.safeParse({
      success: true,
      data: {
        alias: "my-model",
        strategy: "proportional",
        models: [{ provider_id: "openai", model_name: "gpt-4" }],
        id: "550e8400-e29b-41d4-a716-446655440000",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject success: false", () => {
    const result = GetModelAliasResponseSchema.safeParse({
      success: false,
      data: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateModelAliasResponseSchema", () => {
  it("should parse valid create response", () => {
    const result = CreateModelAliasResponseSchema.safeParse({
      success: true,
      data: {
        alias: "new-model",
        strategy: "proportional",
        models: [{ provider_id: "openai", model_name: "gpt-4" }],
        id: "550e8400-e29b-41d4-a716-446655440000",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateModelAliasResponseSchema", () => {
  it("should parse valid update response", () => {
    const result = UpdateModelAliasResponseSchema.safeParse({
      success: true,
      data: {
        alias: "updated-model",
        strategy: "priority",
        models: [{ provider_id: "openai", model_name: "gpt-4-turbo" }],
        id: "550e8400-e29b-41d4-a716-446655440000",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-02T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("DeleteModelAliasResponseSchema", () => {
  it("should parse { success: true }", () => {
    const result = DeleteModelAliasResponseSchema.safeParse({ success: true });
    expect(result.success).toBe(true);
  });

  it("should reject { success: false }", () => {
    const result = DeleteModelAliasResponseSchema.safeParse({ success: false });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Provider API Schemas
// ============================================================

describe("ListProvidersQuerySchema", () => {
  it("should parse with defaults", () => {
    const result = ListProvidersQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept enabled filter", () => {
    const result = ListProvidersQuerySchema.safeParse({ enabled: "true" });
    expect(result.success).toBe(true);
  });
});

describe("ListProvidersResponseSchema", () => {
  it("should parse valid paginated response", () => {
    const result = ListProvidersResponseSchema.safeParse({
      success: true,
      data: [
        {
          id: "openai",
          name: "OpenAI",
          base_url: "https://api.openai.com/v1",
          models: [{ name: "gpt-4" }],
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-01T00:00:00.000Z",
          health_status: "healthy",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    expect(result.success).toBe(true);
  });
});

describe("GetProviderResponseSchema", () => {
  it("should parse valid get response", () => {
    const result = GetProviderResponseSchema.safeParse({
      success: true,
      data: {
        id: "anthropic",
        name: "Anthropic",
        base_url: "https://api.anthropic.com/v1",
        models: [{ name: "claude-3" }],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("CreateProviderResponseSchema", () => {
  it("should parse valid create response", () => {
    const result = CreateProviderResponseSchema.safeParse({
      success: true,
      data: {
        id: "new-provider",
        name: "New Provider",
        base_url: "https://api.example.com/v1",
        models: [{ name: "model-1" }],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateProviderResponseSchema", () => {
  it("should parse valid update response", () => {
    const result = UpdateProviderResponseSchema.safeParse({
      success: true,
      data: {
        id: "openai",
        name: "Updated OpenAI",
        base_url: "https://api.openai.com/v1",
        models: [{ name: "gpt-4" }],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-02T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("DeleteProviderResponseSchema", () => {
  it("should parse { success: true }", () => {
    const result = DeleteProviderResponseSchema.safeParse({ success: true });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Auth API Schemas (simplified, nested under providers)
// ============================================================

describe("ListAuthsQuerySchema", () => {
  it("should parse with defaults", () => {
    const result = ListAuthsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("ListAuthsResponseSchema", () => {
  it("should parse valid paginated response", () => {
    const result = ListAuthsResponseSchema.safeParse({
      success: true,
      data: [
        {
          key: "sk-tes...5678",
          name: "Test Key",
          id: "550e8400-e29b-41d4-a716-446655440000",
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-01T00:00:00.000Z",
          total_requests: 0,
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    expect(result.success).toBe(true);
  });
});

describe("GetAuthResponseSchema", () => {
  it("should parse valid get response", () => {
    const result = GetAuthResponseSchema.safeParse({
      success: true,
      data: {
        key: "***masked***",
        name: "Production Key",
        id: "550e8400-e29b-41d4-a716-446655440000",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        total_requests: 100,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("CreateAuthResponseSchema", () => {
  it("should parse valid create response", () => {
    const result = CreateAuthResponseSchema.safeParse({
      success: true,
      data: {
        key: "sk-new...1234",
        name: "New Key",
        id: "550e8400-e29b-41d4-a716-446655440000",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        total_requests: 0,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateAuthResponseSchema", () => {
  it("should parse valid update response", () => {
    const result = UpdateAuthResponseSchema.safeParse({
      success: true,
      data: {
        key: "sk-upd...5678",
        name: "Updated Key",
        id: "550e8400-e29b-41d4-a716-446655440000",
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-02T00:00:00.000Z",
        total_requests: 50,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("DeleteAuthResponseSchema", () => {
  it("should parse { success: true }", () => {
    const result = DeleteAuthResponseSchema.safeParse({ success: true });
    expect(result.success).toBe(true);
  });
});

describe("ValidateAuthKeyResponseSchema", () => {
  it("should parse valid validation response", () => {
    const result = ValidateAuthKeyResponseSchema.safeParse({
      success: true,
      data: {
        valid: true,
        key_name: "Production Key",
        rate_limited: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it("should parse invalid key response", () => {
    const result = ValidateAuthKeyResponseSchema.safeParse({
      success: true,
      data: {
        valid: false,
      },
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Stats API Schemas (simplified)
// ============================================================

describe("DashboardStatsQuerySchema", () => {
  it("should parse empty query", () => {
    const result = DashboardStatsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("DashboardStatsResponseSchema", () => {
  it("should parse valid dashboard response", () => {
    const result = DashboardStatsResponseSchema.safeParse({
      success: true,
      data: {
        total_cost: 219.43,
        total_requests: 16752,
        total_rate_limited: 23,
        by_pricing_model: {
          per_request_weighted: {
            label: "按请求加权",
            rows: [
              {
                provider_id: "provider_a",
                weighted_requests: 8000,
                cost: 8.0,
                unit_price: 0.001,
                rate_limited: 2,
              },
              {
                provider_id: "provider_b",
                weighted_requests: 3000,
                cost: 3.0,
                unit_price: 0.001,
                rate_limited: 0,
              },
            ],
            total_weighted_requests: 11000,
            total_cost: 11.0,
            total_rate_limited: 2,
          },
          per_model_token: {
            label: "按 Token",
            rows: [
              {
                provider_id: "provider_c",
                tokens: 1200000,
                cost: 12.5,
                avg_price_per_m: 10.0,
                rate_limited: 0,
              },
            ],
            total_tokens: 1200000,
            total_cost: 12.5,
            total_rate_limited: 0,
          },
          subscription: {
            label: "订阅制",
            rows: [
              {
                provider_id: "provider_d",
                used: 8000,
                quota: 10000,
                cost: 100,
                period: "month",
                overage_cost: 0,
              },
            ],
            total_cost: 100,
            total_rate_limited: 0,
          },
        },
        rate_limited_auths: [
          {
            auth_key: "sk-xxx",
            auth_name: "Test Key",
            provider_id: "provider_c",
            triggered_rules: ["weighted_requests/5h"],
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("RequestStatsQuerySchema", () => {
  it("should parse with defaults", () => {
    const result = RequestStatsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.period).toBe("5h");
    }
  });

  it("should accept all filters", () => {
    const result = RequestStatsQuerySchema.safeParse({
      auth_key: "sk-test",
      period: "week",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid period", () => {
    const result = RequestStatsQuerySchema.safeParse({ period: "day" });
    expect(result.success).toBe(false);
  });
});

describe("RequestStatsResponseSchema", () => {
  it("should parse valid request stats response", () => {
    const result = RequestStatsResponseSchema.safeParse({
      success: true,
      data: [
        {
          period: "5h",
          count: 100,
          auth_key: "sk-test-key",
          auth_name: "Test Key",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("TokenStatsQuerySchema", () => {
  it("should parse with defaults", () => {
    const result = TokenStatsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token_granularity).toBe("hour");
    }
  });

  it("should accept granularity filter", () => {
    const result = TokenStatsQuerySchema.safeParse({
      token_granularity: "day",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid granularity", () => {
    const result = TokenStatsQuerySchema.safeParse({
      token_granularity: "week",
    });
    expect(result.success).toBe(false);
  });
});

describe("TokenStatsResponseSchema", () => {
  it("should parse valid token stats response", () => {
    const result = TokenStatsResponseSchema.safeParse({
      success: true,
      data: [
        {
          timestamp: "2024-01-01T00:00:00Z",
          auth_key: "sk-test-key",
          input_tokens: 50000,
          output_tokens: 30000,
          total_tokens: 80000,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("AuthStatsResponseSchema", () => {
  it("should parse valid auth stats response", () => {
    const result = AuthStatsResponseSchema.safeParse({
      success: true,
      data: [
        {
          key_id: "key-123",
          key_name: "Production Key",
          total_requests: 10000,
          successful_requests: 9500,
          failed_requests: 400,
          rate_limited_requests: 100,
          total_tokens: 5000000,
          is_rate_limited: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("ApiStatsQuerySchema", () => {
  it("should parse with defaults", () => {
    const result = ApiStatsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.period).toBe("5h");
      expect(result.data.token_granularity).toBe("hour");
    }
  });

  it("should accept all filters", () => {
    const result = ApiStatsQuerySchema.safeParse({
      auth_key: "sk-xxx",
      period: "week",
      token_granularity: "day",
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Gateway Proxy API Schemas
// ============================================================

describe("ProxyChatCompletionRequestSchema", () => {
  it("should parse minimal valid request", () => {
    const result = ProxyChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("should parse with streaming", () => {
    const result = ProxyChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      stream: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty model", () => {
    const result = ProxyChatCompletionRequestSchema.safeParse({
      model: "",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty messages", () => {
    const result = ProxyChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// API Format Enum & Proxy Schemas
// ============================================================

describe("ApiFormatSchema", () => {
  it("should accept openai_chat", () => {
    const result = ApiFormatSchema.safeParse("openai_chat");
    expect(result.success).toBe(true);
  });

  it("should accept anthropic_messages", () => {
    const result = ApiFormatSchema.safeParse("anthropic_messages");
    expect(result.success).toBe(true);
  });

  it("should accept openai_responses", () => {
    const result = ApiFormatSchema.safeParse("openai_responses");
    expect(result.success).toBe(true);
  });

  it("should reject unknown format", () => {
    const result = ApiFormatSchema.safeParse("custom");
    expect(result.success).toBe(false);
  });

  it("should reject empty string", () => {
    const result = ApiFormatSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("ProxyRequestSchema", () => {
  it("should parse valid proxy request", () => {
    const result = ProxyRequestSchema.safeParse({
      format: "openai_chat",
      raw: { model: "gpt-4", messages: [{ role: "user", content: "Hello" }] },
      model_alias: "my-model",
      auth_key: "sk-test...1234",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with metadata", () => {
    const result = ProxyRequestSchema.safeParse({
      format: "anthropic_messages",
      raw: { model: "claude-3" },
      model_alias: "claude-model",
      auth_key: "sk-test...5678",
      metadata: { trace_id: "abc-123" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid format", () => {
    const result = ProxyRequestSchema.safeParse({
      format: "invalid_format",
      raw: {},
      model_alias: "my-model",
      auth_key: "sk-test...1234",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty model_alias", () => {
    const result = ProxyRequestSchema.safeParse({
      format: "openai_chat",
      raw: {},
      model_alias: "",
      auth_key: "sk-test...1234",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing auth_key", () => {
    const result = ProxyRequestSchema.safeParse({
      format: "openai_chat",
      raw: {},
      model_alias: "my-model",
    });
    expect(result.success).toBe(false);
  });
});

describe("ProxyResponseSchema", () => {
  it("should parse valid proxy response", () => {
    const result = ProxyResponseSchema.safeParse({
      format: "openai_chat",
      raw: { id: "chatcmpl-xxx", choices: [] },
      routed_provider: "openai",
      routed_auth_key: "sk-test...1234",
      latency_ms: 350,
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid format", () => {
    const result = ProxyResponseSchema.safeParse({
      format: "bad_format",
      raw: {},
      routed_provider: "openai",
      routed_auth_key: "sk-test...1234",
      latency_ms: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing routed_provider", () => {
    const result = ProxyResponseSchema.safeParse({
      format: "openai_chat",
      raw: {},
      routed_auth_key: "sk-test...1234",
      latency_ms: 100,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative latency_ms", () => {
    const result = ProxyResponseSchema.safeParse({
      format: "openai_chat",
      raw: {},
      routed_provider: "openai",
      routed_auth_key: "sk-test...1234",
      latency_ms: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("HealthCheckResponseSchema", () => {
  it("should parse minimal healthy response", () => {
    const result = HealthCheckResponseSchema.safeParse({
      status: "healthy",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with optional fields", () => {
    const result = HealthCheckResponseSchema.safeParse({
      status: "healthy",
      uptime_seconds: 3600,
      version: "1.0.0",
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-healthy status", () => {
    const result = HealthCheckResponseSchema.safeParse({
      status: "degraded",
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative uptime", () => {
    const result = HealthCheckResponseSchema.safeParse({
      status: "healthy",
      uptime_seconds: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("ConfigReloadResponseSchema", () => {
  it("should parse valid config reload response", () => {
    const result = ConfigReloadResponseSchema.safeParse({
      success: true,
      data: {
        models_count: 5,
        providers_count: 3,
        auths_count: 10,
        reloaded_at: "2024-01-01T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing counts", () => {
    const result = ConfigReloadResponseSchema.safeParse({
      success: true,
      data: {
        reloaded_at: "2024-01-01T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Error Schema
// ============================================================

describe("ApiErrorSchema", () => {
  it("should parse standard error", () => {
    const result = ApiErrorSchema.safeParse({
      success: false,
      error: "Not found",
      code: "NOT_FOUND",
    });
    expect(result.success).toBe(true);
  });

  it("should parse error with details", () => {
    const result = ApiErrorSchema.safeParse({
      success: false,
      error: "Validation failed",
      details: ["alias is required", "provider_id is required"],
      code: "VALIDATION_ERROR",
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Route Definitions
// ============================================================

describe("ModelAliasRoutes", () => {
  it("should have all CRUD routes defined", () => {
    expect(ModelAliasRoutes.list).toBeDefined();
    expect(ModelAliasRoutes.get).toBeDefined();
    expect(ModelAliasRoutes.create).toBeDefined();
    expect(ModelAliasRoutes.update).toBeDefined();
    expect(ModelAliasRoutes.delete).toBeDefined();
  });

  it("should have correct paths", () => {
    expect(ModelAliasRoutes.list.path).toBe("/api/models");
    expect(ModelAliasRoutes.get.path).toBe("/api/models/:id");
    expect(ModelAliasRoutes.create.path).toBe("/api/models");
    expect(ModelAliasRoutes.update.path).toBe("/api/models/:id");
    expect(ModelAliasRoutes.delete.path).toBe("/api/models/:id");
  });

  it("should have correct methods", () => {
    expect(ModelAliasRoutes.list.method).toBe("GET");
    expect(ModelAliasRoutes.get.method).toBe("GET");
    expect(ModelAliasRoutes.create.method).toBe("POST");
    expect(ModelAliasRoutes.update.method).toBe("PATCH");
    expect(ModelAliasRoutes.delete.method).toBe("DELETE");
  });

  it("should have request schemas where appropriate", () => {
    expect(ModelAliasRoutes.list.requestSchema).toBeDefined();
    expect(ModelAliasRoutes.get.requestSchema).toBeDefined();
    expect(ModelAliasRoutes.create.requestSchema).toBeDefined();
    expect(ModelAliasRoutes.update.requestSchema).toBeDefined();
    expect(ModelAliasRoutes.delete.requestSchema).toBeDefined();
  });

  it("should have response schemas for all routes", () => {
    for (const [, route] of Object.entries(ModelAliasRoutes)) {
      expect(route.responseSchema).toBeDefined();
    }
  });
});

describe("ProviderRoutes", () => {
  it("should have all CRUD routes defined", () => {
    expect(ProviderRoutes.list).toBeDefined();
    expect(ProviderRoutes.get).toBeDefined();
    expect(ProviderRoutes.create).toBeDefined();
    expect(ProviderRoutes.update).toBeDefined();
    expect(ProviderRoutes.delete).toBeDefined();
  });

  it("should have correct paths", () => {
    expect(ProviderRoutes.list.path).toBe("/api/providers");
    expect(ProviderRoutes.get.path).toBe("/api/providers/:id");
    expect(ProviderRoutes.create.path).toBe("/api/providers");
    expect(ProviderRoutes.update.path).toBe("/api/providers/:id");
    expect(ProviderRoutes.delete.path).toBe("/api/providers/:id");
  });

  it("should have correct methods", () => {
    expect(ProviderRoutes.list.method).toBe("GET");
    expect(ProviderRoutes.create.method).toBe("POST");
    expect(ProviderRoutes.update.method).toBe("PATCH");
    expect(ProviderRoutes.delete.method).toBe("DELETE");
  });
});

describe("AuthRoutes", () => {
  it("should have all CRUD + validate routes", () => {
    expect(AuthRoutes.list).toBeDefined();
    expect(AuthRoutes.get).toBeDefined();
    expect(AuthRoutes.create).toBeDefined();
    expect(AuthRoutes.update).toBeDefined();
    expect(AuthRoutes.delete).toBeDefined();
    expect(AuthRoutes.validate).toBeDefined();
  });

  it("should have nested provider paths for CRUD", () => {
    expect(AuthRoutes.list.path).toBe("/api/providers/:id/auths");
    expect(AuthRoutes.get.path).toBe("/api/providers/:id/auths/:key");
    expect(AuthRoutes.create.path).toBe("/api/providers/:id/auths");
    expect(AuthRoutes.update.path).toBe("/api/providers/:id/auths/:key");
    expect(AuthRoutes.delete.path).toBe("/api/providers/:id/auths/:key");
  });

  it("should have correct validate path", () => {
    expect(AuthRoutes.validate.path).toBe("/api/auths/validate");
    expect(AuthRoutes.validate.method).toBe("POST");
  });
});

describe("StatsRoutes", () => {
  it("should have all stats routes", () => {
    expect(StatsRoutes.dashboard).toBeDefined();
    expect(StatsRoutes.requests).toBeDefined();
    expect(StatsRoutes.tokens).toBeDefined();
    expect(StatsRoutes.auths).toBeDefined();
  });

  it("should have correct dashboard path", () => {
    expect(StatsRoutes.dashboard.path).toBe("/api/stats/dashboard");
    expect(StatsRoutes.dashboard.method).toBe("GET");
  });

  it("should have correct requests path", () => {
    expect(StatsRoutes.requests.path).toBe("/api/stats/requests");
    expect(StatsRoutes.requests.method).toBe("GET");
  });

  it("should have correct tokens path", () => {
    expect(StatsRoutes.tokens.path).toBe("/api/stats/tokens");
    expect(StatsRoutes.tokens.method).toBe("GET");
  });
});

describe("GatewayRoutes", () => {
  it("should have proxy and health routes", () => {
    expect(GatewayRoutes.chatCompletions).toBeDefined();
    expect(GatewayRoutes.health).toBeDefined();
    expect(GatewayRoutes.configReload).toBeDefined();
  });

  it("should have correct chat completions path", () => {
    expect(GatewayRoutes.chatCompletions.path).toBe("/v1/chat/completions");
    expect(GatewayRoutes.chatCompletions.method).toBe("POST");
  });

  it("should have correct health path", () => {
    expect(GatewayRoutes.health.path).toBe("/health");
    expect(GatewayRoutes.health.method).toBe("GET");
  });

  it("should have correct config reload path", () => {
    expect(GatewayRoutes.configReload.path).toBe("/api/config/reload");
    expect(GatewayRoutes.configReload.method).toBe("POST");
  });
});

describe("AllRoutes", () => {
  it("should combine all route groups", () => {
    const allKeys = Object.keys(AllRoutes);
    expect(allKeys.length).toBeGreaterThan(10);
  });

  it("should include model routes", () => {
    expect(AllRoutes.list).toBeDefined();
    expect(AllRoutes.create).toBeDefined();
  });

  it("should include gateway routes", () => {
    expect(AllRoutes.chatCompletions).toBeDefined();
    expect(AllRoutes.health).toBeDefined();
  });

  it("should all have valid route shape", () => {
    for (const [, route] of Object.entries(AllRoutes)) {
      expect(route.method).toMatch(/^(GET|POST|PUT|PATCH|DELETE)$/);
      expect(route.path).toBeDefined();
      expect(route.path.startsWith("/")).toBe(true);
      expect(route.responseSchema).toBeDefined();
    }
  });
});
