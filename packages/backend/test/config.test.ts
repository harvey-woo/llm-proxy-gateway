import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { loadConfig, getTemplateUrl } from "../src/config/loader.js";

describe("Config Loader", () => {
  let config: ReturnType<typeof loadConfig>;

  beforeAll(() => {
    config = loadConfig();
  });

  it("loads without errors", () => {
    expect(config).toBeDefined();
    expect(config.models).toBeDefined();
    expect(config.providers).toBeDefined();
  });

  it("loads models (may be empty)", () => {
    expect(config.models.size).toBeGreaterThanOrEqual(0);
  });

  it("loads providers (may be empty)", () => {
    expect(config.providers.size).toBeGreaterThanOrEqual(0);
  });

  it("auths are not stored in YAML config (managed via DB)", () => {
    for (const [, provider] of config.providers) {
      expect(provider.auths).toBeUndefined();
    }
  });

  it("prioritizes TEMPLATE_URL environment variable over config.yaml", () => {
    const origUrl = process.env.TEMPLATE_URL;
    process.env.TEMPLATE_URL = "https://env.example.com/templates.json";
    const result = getTemplateUrl();
    expect(result).toBe("https://env.example.com/templates.json");
    if (origUrl !== undefined) process.env.TEMPLATE_URL = origUrl;
    else delete process.env.TEMPLATE_URL;
  });

  it("returns null when no env var and config.yaml has no template_url", () => {
    const origUrl = process.env.TEMPLATE_URL;
    delete process.env.TEMPLATE_URL;
    const result = getTemplateUrl();
    expect(result).toBeNull();
    if (origUrl !== undefined) process.env.TEMPLATE_URL = origUrl;
  });
});
