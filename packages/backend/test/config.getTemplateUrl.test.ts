import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Use real temp directories with CONFIG_DIR env var to control where
// getConfigDir() looks for config.yaml. Each test gets a fresh module
// import via vi.resetModules() so _configDir cache is cleared.

describe("getTemplateUrl — config file reading priority", () => {
  const ORIGINAL_TEMPLATE_URL = process.env.TEMPLATE_URL;
  const ORIGINAL_CONFIG_DIR = process.env.CONFIG_DIR;
  let tmpDir: string;

  beforeEach(() => {
    delete process.env.TEMPLATE_URL;
    delete process.env.CONFIG_DIR;
    tmpDir = mkdtempSync(join(tmpdir(), "config-test-"));
  });

  afterEach(() => {
    if (ORIGINAL_TEMPLATE_URL === undefined) {
      delete process.env.TEMPLATE_URL;
    } else {
      process.env.TEMPLATE_URL = ORIGINAL_TEMPLATE_URL;
    }
    if (ORIGINAL_CONFIG_DIR === undefined) {
      delete process.env.CONFIG_DIR;
    } else {
      process.env.CONFIG_DIR = ORIGINAL_CONFIG_DIR;
    }
    if (tmpDir) {
      try {
        rmSync(tmpDir, { recursive: true });
      } catch {
        /* ignore */
      }
    }
  });

  it("uses TEMPLATE_URL env var over config.yaml", async () => {
    vi.resetModules();
    process.env.TEMPLATE_URL = "https://env.example.com/templates.json";
    process.env.CONFIG_DIR = tmpDir;
    writeFileSync(
      join(tmpDir, "config.yaml"),
      'template_url: "https://config.example.com/templates.json"\nproviders: {}\nmodel_aliases: {}',
    );
    const { getTemplateUrl: gtu } = await import("../src/config/loader.js");
    expect(gtu()).toBe("https://env.example.com/templates.json");
  });

  it("reads template_url from config.yaml when env var is not set", async () => {
    vi.resetModules();
    process.env.CONFIG_DIR = tmpDir;
    writeFileSync(
      join(tmpDir, "config.yaml"),
      'template_url: "https://config.example.com/templates.json"\nproviders: {}\nmodel_aliases: {}',
    );
    const { getTemplateUrl: gtu } = await import("../src/config/loader.js");
    expect(gtu()).toBe("https://config.example.com/templates.json");
  });

  it("returns null when config.yaml exists but template_url is missing", async () => {
    vi.resetModules();
    process.env.CONFIG_DIR = tmpDir;
    writeFileSync(
      join(tmpDir, "config.yaml"),
      "providers: {}\nmodel_aliases: {}\n",
    );
    const { getTemplateUrl: gtu } = await import("../src/config/loader.js");
    expect(gtu()).toBeNull();
  });

  it("returns null when template_url is empty string", async () => {
    vi.resetModules();
    process.env.CONFIG_DIR = tmpDir;
    writeFileSync(
      join(tmpDir, "config.yaml"),
      'template_url: ""\nproviders: {}\nmodel_aliases: {}',
    );
    const { getTemplateUrl: gtu } = await import("../src/config/loader.js");
    expect(gtu()).toBeNull();
  });

  it("returns null when template_url is whitespace-only", async () => {
    vi.resetModules();
    process.env.CONFIG_DIR = tmpDir;
    writeFileSync(
      join(tmpDir, "config.yaml"),
      'template_url: "  "\nproviders: {}\nmodel_aliases: {}',
    );
    const { getTemplateUrl: gtu } = await import("../src/config/loader.js");
    expect(gtu()).toBeNull();
  });

  it("returns null when config.yaml does not exist", async () => {
    vi.resetModules();
    process.env.CONFIG_DIR = tmpDir;
    // No config.yaml written to tmpDir
    const { getTemplateUrl: gtu } = await import("../src/config/loader.js");
    expect(gtu()).toBeNull();
  });

  it("handles malformed YAML gracefully", async () => {
    vi.resetModules();
    process.env.CONFIG_DIR = tmpDir;
    writeFileSync(join(tmpDir, "config.yaml"), "{{ invalid yaml ::: }");
    const { getTemplateUrl: gtu } = await import("../src/config/loader.js");
    expect(gtu()).toBeNull();
  });
});
