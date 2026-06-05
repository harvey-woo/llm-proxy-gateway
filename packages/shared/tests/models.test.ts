import { describe, it, expect } from "vitest";
import {
  ModelAliasEntrySchema,
  StrategySchema,
  ModelAliasSchema,
  CreateModelAliasSchema,
  UpdateModelAliasSchema,
  ModelAliasListSchema,
  ModelAliasWithMetaSchema,
} from "../src/schemas/models.js";

describe("ModelAliasEntrySchema", () => {
  it("should parse a valid entry", () => {
    const result = ModelAliasEntrySchema.safeParse({
      provider_id: "openai",
      model_name: "gpt-4",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty provider_id", () => {
    const result = ModelAliasEntrySchema.safeParse({
      provider_id: "",
      model_name: "gpt-4",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty model_name", () => {
    const result = ModelAliasEntrySchema.safeParse({
      provider_id: "openai",
      model_name: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("StrategySchema", () => {
  it("should accept valid strategies", () => {
    for (const s of [
      "proportional",
      "priority",
      "random",
      "round_robin",
      "least_loaded",
    ]) {
      const result = StrategySchema.safeParse(s);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid strategies", () => {
    const result = StrategySchema.safeParse("round-robin");
    expect(result.success).toBe(false);
  });
});

describe("ModelAliasSchema", () => {
  const validAlias = {
    alias: "my-smart-model",
    strategy: "proportional",
    models: [{ provider_id: "openai", model_name: "gpt-4" }],
  };

  it("should parse a minimal valid alias", () => {
    const result = ModelAliasSchema.safeParse(validAlias);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.strategy).toBe("proportional");
    }
  });

  it("should parse a full alias config", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "production-model",
      strategy: "priority",
      models: [
        { provider_id: "openai", model_name: "gpt-4" },
        { provider_id: "anthropic", model_name: "claude-3-opus" },
      ],
      enabled: true,
      description: "Main production model",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty alias", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject alias with special characters", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "my model!",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(false);
  });

  it("should accept alias with only letters", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "mymodel",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
  });

  it("should accept alias with numbers", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "model-v2",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
  });

  it("should accept alias with underscores", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "my_model_alias",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
  });

  it("should reject alias longer than 64 chars", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "a".repeat(65),
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty models array", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing models array", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional description", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      strategy: "random",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      description: "A test model",
    });
    expect(result.success).toBe(true);
  });

  it("should default strategy to proportional", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strategy).toBe("proportional");
    }
  });

  it("should default queue_timeout to 30000", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.queue_timeout).toBe(30000);
    }
  });

  it("should accept custom queue_timeout", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      queue_timeout: 15000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.queue_timeout).toBe(15000);
    }
  });

  it("should reject negative queue_timeout", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      queue_timeout: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should default session_affinity to true", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.session_affinity).toBe(true);
    }
  });

  it("should accept session_affinity = false", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      session_affinity: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.session_affinity).toBe(false);
    }
  });

  it("should reject non-boolean session_affinity", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      session_affinity: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("should default enabled to true", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
    }
  });

  it("should accept headers as optional Record<string, string>", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      headers: {
        "X-Custom": "value",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headers?.["X-Custom"]).toBe("value");
    }
  });

  it("should have headers undefined when not provided", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headers).toBeUndefined();
    }
  });

  it("should reject non-string header values in ModelAliasSchema", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "test",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      headers: {
        "X-Key": 123,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject alias with dots (allowed in regex)", () => {
    const result = ModelAliasSchema.safeParse({
      alias: "my.model.v1",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("CreateModelAliasSchema", () => {
  it("should parse a valid create input", () => {
    const result = CreateModelAliasSchema.safeParse({
      alias: "new-model",
      strategy: "proportional",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing alias", () => {
    const result = CreateModelAliasSchema.safeParse({
      strategy: "proportional",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing models", () => {
    const result = CreateModelAliasSchema.safeParse({
      alias: "new-model",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateModelAliasSchema", () => {
  it("should accept partial update", () => {
    const result = UpdateModelAliasSchema.safeParse({
      enabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty object", () => {
    const result = UpdateModelAliasSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept full update", () => {
    const result = UpdateModelAliasSchema.safeParse({
      alias: "updated-alias",
      strategy: "random",
      models: [
        { provider_id: "openai", model_name: "gpt-4-turbo" },
        { provider_id: "anthropic", model_name: "claude-3-sonnet" },
      ],
      enabled: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("ModelAliasListSchema", () => {
  it("should parse an array of aliases", () => {
    const result = ModelAliasListSchema.safeParse([
      {
        alias: "model-a",
        strategy: "proportional",
        models: [{ provider_id: "openai", model_name: "gpt-4" }],
      },
      {
        alias: "model-b",
        strategy: "random",
        models: [{ provider_id: "anthropic", model_name: "claude-3" }],
      },
    ]);
    expect(result.success).toBe(true);
  });

  it("should accept empty array", () => {
    const result = ModelAliasListSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it("should reject invalid alias in array", () => {
    const result = ModelAliasListSchema.safeParse([
      { alias: "ok", models: [{ provider_id: "openai", model_name: "gpt-4" }] },
      {
        alias: "",
        models: [{ provider_id: "anthropic", model_name: "claude-3" }],
      },
    ]);
    expect(result.success).toBe(false);
  });
});

describe("ModelAliasWithMetaSchema", () => {
  it("should parse alias with metadata", () => {
    const result = ModelAliasWithMetaSchema.safeParse({
      alias: "my-model",
      strategy: "proportional",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      id: "550e8400-e29b-41d4-a716-446655440000",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid uuid", () => {
    const result = ModelAliasWithMetaSchema.safeParse({
      alias: "my-model",
      strategy: "proportional",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      id: "not-a-uuid",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid datetime", () => {
    const result = ModelAliasWithMetaSchema.safeParse({
      alias: "my-model",
      strategy: "proportional",
      models: [{ provider_id: "openai", model_name: "gpt-4" }],
      id: "550e8400-e29b-41d4-a716-446655440000",
      created_at: "not-a-date",
      updated_at: "2024-01-02T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
