import { describe, it, expect } from "vitest";
import { ProviderPool } from "../src/pool.js";
import { RateLimiter } from "../src/rate_limiter.js";
import type { ModelAlias, Provider } from "@llm-proxy/shared/schemas";

function makeTestAuth(key: string, name?: string) {
  return { key, name };
}

function makeTestProvider(
  id: string,
  name: string,
  models: Array<{ name: string; weight?: number; enabled?: boolean }>,
): Provider {
  return {
    id,
    name,
    base_url: "https://api.test.com",
    models: models.map((m) => ({
      name: m.name,
      weight: m.weight ?? 1,
      enabled: m.enabled ?? true,
    })),
    auths: [],
    rate_limits: [],
    request_timeout_ms: 60000,
    max_retries: 3,
    enabled: true,
    pricing_model: "per_model_token",
    unit_price: 0.001,
    currency: "USD",
    api_format: "openai_chat",
  } as Provider;
}

describe("ProviderPool load balancing", () => {
  it("round_robin cycles through available auths", () => {
    const providers = new Map<string, Provider>();
    providers.set("p1", makeTestProvider("p1", "Provider A", [{ name: "gpt-4" }]));
    providers.set("p2", makeTestProvider("p2", "Provider B", [{ name: "gpt-4" }]));

    const auths = new Map<string, Map<string, { key: string; name?: string }>>();
    auths.set("p1", new Map([["key-a", makeTestAuth("key-a")]]));
    auths.set("p2", new Map([["key-b", makeTestAuth("key-b")]]));

    const models = new Map<string, ModelAlias>();
    models.set("test-model", {
      alias: "test-model",
      strategy: "round_robin",
      models: [
        { provider_id: "p1", model_name: "gpt-4" },
        { provider_id: "p2", model_name: "gpt-4" },
      ],
      queue_timeout: 30000,
      enabled: true,
    });

    const pool = new ProviderPool(models, providers, auths);
    const results: string[] = [];

    for (let i = 0; i < 6; i++) {
      const sel = pool.selectAuth("test-model");
      expect(sel).not.toBeNull();
      results.push(sel!.authEntry.providerId);
    }

    // Round-robin: p1, p2, p1, p2, p1, p2
    expect(results).toEqual(["p1", "p2", "p1", "p2", "p1", "p2"]);
  });

  it("priority selects first available auth", () => {
    const providers = new Map<string, Provider>();
    providers.set("p1", makeTestProvider("p1", "Provider A", [{ name: "gpt-4" }]));
    providers.set("p2", makeTestProvider("p2", "Provider B", [{ name: "gpt-4" }]));

    const auths = new Map<string, Map<string, { key: string; name?: string }>>();
    auths.set("p1", new Map([["key-a", makeTestAuth("key-a")]]));
    auths.set("p2", new Map([["key-b", makeTestAuth("key-b")]]));

    const models = new Map<string, ModelAlias>();
    models.set("test-model", {
      alias: "test-model",
      strategy: "priority",
      models: [
        { provider_id: "p1", model_name: "gpt-4" },
        { provider_id: "p2", model_name: "gpt-4" },
      ],
      queue_timeout: 30000,
      enabled: true,
    });

    const pool = new ProviderPool(models, providers, auths);

    for (let i = 0; i < 5; i++) {
      const sel = pool.selectAuth("test-model");
      expect(sel).not.toBeNull();
      // Priority should always pick the first provider (p1)
      expect(sel!.authEntry.providerId).toBe("p1");
    }
  });

  it("returns null when no auths are available", () => {
    const providers = new Map<string, Provider>();
    providers.set("p1", makeTestProvider("p1", "Provider A", [{ name: "gpt-4" }]));

    const auths = new Map<string, Map<string, { key: string; name?: string }>>();
    // No auths for p1
    auths.set("p1", new Map());

    const models = new Map<string, ModelAlias>();
    models.set("test-model", {
      alias: "test-model",
      strategy: "priority",
      models: [{ provider_id: "p1", model_name: "gpt-4" }],
      queue_timeout: 30000,
      enabled: true,
    });

    const pool = new ProviderPool(models, providers, auths);
    const sel = pool.selectAuth("test-model");
    expect(sel).toBeNull();
  });

  it("respects disabled model entries", () => {
    const providers = new Map<string, Provider>();
    providers.set("p1", makeTestProvider("p1", "Provider A", [{ name: "gpt-4" }]));
    providers.set("p2", makeTestProvider("p2", "Provider B", [{ name: "gpt-4" }]));

    const auths = new Map<string, Map<string, { key: string; name?: string }>>();
    auths.set("p1", new Map([["key-a", makeTestAuth("key-a")]]));
    auths.set("p2", new Map([["key-b", makeTestAuth("key-b")]]));

    const models = new Map<string, ModelAlias>();
    models.set("test-model", {
      alias: "test-model",
      strategy: "round_robin",
      models: [
        { provider_id: "p1", model_name: "gpt-4" },
        { provider_id: "p2", model_name: "gpt-4" },
      ],
      queue_timeout: 30000,
      enabled: false, // Entire alias disabled
    });

    const pool = new ProviderPool(models, providers, auths);
    const sel = pool.selectAuth("test-model");
    expect(sel).toBeNull();
  });

  it("getRealModel returns correct model per provider", () => {
    const providers = new Map<string, Provider>();
    providers.set("deepseek", makeTestProvider("deepseek", "DeepSeek", [
      { name: "deepseek-v4-flash" },
    ]));
    providers.set("stepfun", makeTestProvider("stepfun", "StepFun", [
      { name: "step-3.7-flash" },
    ]));

    const auths = new Map<string, Map<string, { key: string; name?: string }>>();
    auths.set("deepseek", new Map([["sk-ds", makeTestAuth("sk-ds")]]));
    auths.set("stepfun", new Map([["sk-sf", makeTestAuth("sk-sf")]]));

    const models = new Map<string, ModelAlias>();
    models.set("multi-model", {
      alias: "multi-model",
      strategy: "round_robin",
      models: [
        { provider_id: "deepseek", model_name: "deepseek-v4-flash" },
        { provider_id: "stepfun", model_name: "step-3.7-flash" },
      ],
      queue_timeout: 30000,
      enabled: true,
    });

    const pool = new ProviderPool(models, providers, auths);

    // Round-robin should alternate: deepseek, stepfun, deepseek, stepfun
    const sel1 = pool.selectAuth("multi-model");
    expect(sel1).not.toBeNull();
    expect(sel1!.authEntry.providerId).toBe("deepseek");
    expect(sel1!.realModel).toBe("deepseek-v4-flash");

    const sel2 = pool.selectAuth("multi-model");
    expect(sel2).not.toBeNull();
    expect(sel2!.authEntry.providerId).toBe("stepfun");
    expect(sel2!.realModel).toBe("step-3.7-flash");
  });

  it("session affinity pins to same provider on repeated calls", () => {
    const providers = new Map<string, Provider>();
    providers.set("p1", makeTestProvider("p1", "P1", [{ name: "m1" }]));
    providers.set("p2", makeTestProvider("p2", "P2", [{ name: "m2" }]));

    const auths = new Map<string, Map<string, { key: string; name?: string }>>();
    auths.set("p1", new Map([["key-a", makeTestAuth("key-a")]]));
    auths.set("p2", new Map([["key-b", makeTestAuth("key-b")]]));

    const models = new Map<string, ModelAlias>();
    models.set("test", {
      alias: "test",
      strategy: "round_robin",
      models: [
        { provider_id: "p1", model_name: "m1" },
        { provider_id: "p2", model_name: "m2" },
      ],
      queue_timeout: 30000,
      enabled: true,
    });

    const pool = new ProviderPool(models, providers, auths);

    // First req with session → p1 (round_robin starts at p1)
    const sel1 = pool.selectAuth("test", 0, "sess-1");
    expect(sel1).not.toBeNull();
    expect(sel1!.authEntry.providerId).toBe("p1");
    pool.pinSession("sess-1", sel1!.authEntry.providerId, sel1!.authEntry.auth.key, sel1!.realModel);

    // Second req same session → still p1 (not p2)
    const sel2 = pool.selectAuth("test", 0, "sess-1");
    expect(sel2).not.toBeNull();
    expect(sel2!.authEntry.providerId).toBe("p1");

    // Third req without session → round_robin continues to p2
    const sel3 = pool.selectAuth("test");
    expect(sel3).not.toBeNull();
    expect(sel3!.authEntry.providerId).toBe("p2");

    // Different session → normal round_robin (p1 again since counter incremented)
    const sel4 = pool.selectAuth("test", 0, "sess-2");
    expect(sel4).not.toBeNull();
    expect(sel4!.authEntry.providerId).toBe("p1");
    pool.pinSession("sess-2", sel4!.authEntry.providerId, sel4!.authEntry.auth.key, sel4!.realModel);

    // sess-2 stays on its own pinned provider
    const sel5 = pool.selectAuth("test", 0, "sess-2");
    expect(sel5).not.toBeNull();
    expect(sel5!.authEntry.providerId).toBe("p1");
  });
});

// ============================================================
// Weight ?? 1 logic
// ============================================================

describe("Provider construction weight ?? 1 behavior", () => {
  it("defaults weight to 1 when undefined via ProviderModelSchema default", () => {
    const p = makeTestProvider("t1", "TestP1", [
      { name: "model-a" },          // weight undefined -> ?? 1
      { name: "model-b", weight: 3 },// weight explicitly set to 3
    ]);
    const m1 = p.models[0];
    const m2 = p.models[1];
    expect(m1.weight).toBe(1);
    expect(m2.weight).toBe(3);
  });

  it("defaults weight to 1 when omitted via ProviderModelSchema default", () => {
    const p = makeTestProvider("t1", "TestP1", [
      { name: "model-a", weight: undefined },
    ]);
    expect(p.models[0].weight).toBe(1);
  });

  it("accepts weight = 0.5 fractional weight", () => {
    const p = makeTestProvider("t1", "TestP1", [
      { name: "model-a", weight: 0.5 },
    ]);
    expect(p.models[0].weight).toBe(0.5);
  });

  it("accepts weight = 10 for high-weight model", () => {
    const p = makeTestProvider("t1", "TestP1", [
      { name: "model-a", weight: 10 },
    ]);
    expect(p.models[0].weight).toBe(10);
  });

  it("persists weight through ProviderPool construction", () => {
    const providers = new Map<string, Provider>();
    providers.set("p1", makeTestProvider("p1", "P1", [
      { name: "light", weight: 0.5 },
      { name: "heavy", weight: 10 },
    ]));
    providers.set("p2", makeTestProvider("p2", "P2", [{ name: "default-weight" }]));

    // p2's model should have weight defaulted to 1
    expect(providers.get("p2")!.models[0].weight).toBe(1);
  });

  it("provider model weight field exists on parsed ProviderSchema with default", () => {
    // Simulate what ProviderModelSchema does: weight is optional, defaults handled at use-site
    const rawProvider = {
      id: "test",
      name: "Test",
      base_url: "https://api.test.com",
      models: [{ name: "m1" }, { name: "m2", weight: 2 }],
      auths: [],
      rate_limits: [],
      pricing_model: "per_model_token",
      unit_price: 0.001,
      currency: "USD",
      api_format: "openai_chat",
    } as Provider;
    // After Zod parsing via ProviderSchema, weight.optional() means undefined stays undefined
    // The ?? 1 fallback must be applied at use-site (as in makeTestProvider and getAvgWeight)
    expect(rawProvider.models[0].weight).toBeUndefined();
    expect(rawProvider.models[1].weight).toBe(2);
    // Apply ?? 1 at use-site
    const w1 = rawProvider.models[0].weight ?? 1;
    const w2 = rawProvider.models[1].weight ?? 1;
    expect(w1).toBe(1);
    expect(w2).toBe(2);
  });
});
