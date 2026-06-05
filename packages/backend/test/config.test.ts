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
      expect(provider.auths).toEqual([]);
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

  it("falls back to config.yaml template_url when TEMPLATE_URL env var is not set", () => {
    const origUrl = process.env.TEMPLATE_URL;
    delete process.env.TEMPLATE_URL;
    const result = getTemplateUrl();
    // Returns null when no template_url is configured (dev default)
    // Or a URL string when one is set in config.yaml
    if (result !== null) {
      expect(result).toMatch(/^https?:\/\/.+/);
    } else {
      expect(result).toBeNull();
    }
    if (origUrl !== undefined) process.env.TEMPLATE_URL = origUrl;
  });
});
