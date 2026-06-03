import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { loadConfig, getTemplateUrl } from "../src/config/loader.js";

function extractAuths(config: ReturnType<typeof loadConfig>) {
  const auths = new Map<string, Map<string, { key: string; name?: string }>>();
  for (const [providerId, provider] of config.providers.entries()) {
    if (provider.auths && provider.auths.length > 0) {
      const providerAuths = new Map<string, { key: string; name?: string }>();
      for (const a of provider.auths) {
        providerAuths.set(a.key, a);
      }
      auths.set(providerId, providerAuths);
    }
  }
  return auths;
}

describe("Config Loader", () => {
  let config: ReturnType<typeof loadConfig>;

  beforeAll(() => {
    // Use the project's config directory
    config = loadConfig();
  });

  it("loads models from YAML", () => {
    expect(config.models.size).toBeGreaterThan(0);
    expect(config.models.has("qwen3.6-plus")).toBe(true);
    expect(config.models.has("deepseek-v4-flash")).toBe(true);
    expect(config.models.has("step-3.7-flash")).toBe(true);
  });

  it("model has correct structure", () => {
    const model = config.models.get("qwen3.6-plus");
    expect(model).toBeDefined();
    expect(model?.alias).toBe("qwen3.6-plus");
    expect(model?.strategy).toBe("proportional");
    expect(model?.models.length).toBeGreaterThan(0);
    expect(model?.models[0].provider_id).toBe("aliyun");
    expect(model?.models[0].model_name).toBe("qwen3.6-plus");
    expect(model?.enabled).toBe(true);
  });

  it("loads providers from YAML", () => {
    expect(config.providers.size).toBeGreaterThan(0);
    expect(config.providers.has("aliyun")).toBe(true);
    expect(config.providers.has("ikuncode")).toBe(true);
    expect(config.providers.has("deepseek")).toBe(true);
    expect(config.providers.has("stepfun")).toBe(true);
  });

  it("provider has correct structure", () => {
    const provider = config.providers.get("aliyun");
    expect(provider).toBeDefined();
    expect(provider?.id).toBe("aliyun");
    expect(provider?.name).toBe("阿里云百炼");
    expect(provider?.base_url).toBe("https://coding.dashscope.aliyuncs.com");
    expect(provider?.models.length).toBeGreaterThan(0);
    expect(provider?.rate_limits.length).toBeGreaterThan(0);
  });

  it("provider has rate limits configured", () => {
    const provider = config.providers.get("aliyun");
    expect(provider).toBeDefined();

    const requestsLimit = provider?.rate_limits.find(
      (r) => r.type === "weighted_requests",
    );
    expect(requestsLimit).toBeDefined();
    expect(requestsLimit?.type).toBe("weighted_requests");
    expect(requestsLimit?.max).toBe(6000);
    expect(requestsLimit?.period).toBe("5h");
  });

  it("auths are not stored in YAML config (managed via DB)", () => {
    const auths = extractAuths(config);
    expect(auths.size).toBe(0);
  });
});

// ============================================================
// getTemplateUrl — template_url loading priority
// ============================================================
// Priority: TEMPLATE_URL env var > config.yaml template_url > null
//
// Note: config.yaml has template_url commented out, so the config
// file fallback returns null. For mock-based tests of the config
// file reading path, see config.getTemplateUrl.test.ts.

describe("getTemplateUrl", () => {
  const ORIGINAL_TEMPLATE_URL = process.env.TEMPLATE_URL;

  beforeEach(() => {
    delete process.env.TEMPLATE_URL;
  });

  afterEach(() => {
    // Restore original env
    if (ORIGINAL_TEMPLATE_URL === undefined) {
      delete process.env.TEMPLATE_URL;
    } else {
      process.env.TEMPLATE_URL = ORIGINAL_TEMPLATE_URL;
    }
  });

  it("prioritizes TEMPLATE_URL environment variable over config.yaml", () => {
    process.env.TEMPLATE_URL = "https://env.example.com/templates.json";
    const result = getTemplateUrl();
    expect(result).toBe("https://env.example.com/templates.json");
  });

  it("returns null when no env var and config.yaml has no template_url", () => {
    const origUrl = process.env.TEMPLATE_URL;
    delete process.env.TEMPLATE_URL;
    // config.yaml has template_url commented out, so raw.template_url is undefined
    const result = getTemplateUrl();
    expect(result).toBeNull();
    if (origUrl !== undefined) process.env.TEMPLATE_URL = origUrl;
  });
});
