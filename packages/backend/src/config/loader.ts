import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
  ModelAliasSchema,
  ProviderSchema,
} from "@llm-proxy/shared/schemas";
import type { ModelAlias, Provider } from "@llm-proxy/shared/schemas";

export interface LoadedConfig {
  models: Map<string, ModelAlias>;
  providers: Map<string, Provider>;
}

export interface ConfigWatcher {
  stop: () => void;
}

let _configDir: string | null = null;

function getConfigDir(): string {
  if (_configDir) return _configDir;
  const envDir = process.env.CONFIG_DIR;
  if (envDir) {
    _configDir = envDir;
    return _configDir;
  }
  // Default: look for config/ relative to project root
  // Try several common locations
  const candidates = [
    join(process.cwd(), "config"),
    // Fallback: look relative to this file
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "config"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) {
      _configDir = dir;
      return dir;
    }
  }
  _configDir = candidates[0];
  return _configDir;
}

function loadYamlFile<T>(filePath: string): T {
  const content = readFileSync(filePath, "utf-8");
  return parse(content) as T;
}

/**
 * Load configuration from a single config.yaml file.
 * Structure:
 *   providers: { ... }        # Provider definitions (no auths)
 *   model_aliases: { ... }    # Model alias definitions
 */
export function loadConfig(configDir?: string): LoadedConfig {
  const dir = configDir ?? getConfigDir();
  const filePath = join(dir, "config.yaml");

  if (!existsSync(filePath)) {
    console.warn("[config] config.yaml not found, using empty config");
    return { models: new Map(), providers: new Map() };
  }

  const raw = loadYamlFile<Record<string, unknown>>(filePath);
  const providers = new Map<string, Provider>();
  const models = new Map<string, ModelAlias>();

  // Load providers
  const providerSource = raw.providers as Record<string, unknown> | undefined;
  if (providerSource) {
    for (const [id, value] of Object.entries(providerSource)) {
      const providerData = value as Record<string, unknown>;

      // auths are managed via database — strip if present in YAML
      delete providerData.auths;

      const parsed = ProviderSchema.safeParse({
        id,
        name: providerData.name ?? id,
        ...providerData,
      });
      if (parsed.success) {
        providers.set(id, parsed.data);
      } else {
        console.warn(`[config] Invalid provider "${id}":`, parsed.error.message);
      }
    }
  }

  // Load model aliases
  const aliasSource = raw.model_aliases as Record<string, unknown> | undefined;
  if (aliasSource) {
    for (const [alias, value] of Object.entries(aliasSource)) {
      const parsed = ModelAliasSchema.safeParse({
        alias,
        ...(value as Record<string, unknown>),
      });
      if (parsed.success) {
        models.set(alias, parsed.data);
      } else {
        console.warn(`[config] Invalid model alias "${alias}":`, parsed.error.message);
      }
    }
  }

  return { models, providers };
}

/**
 * Get the template URL from environment variable or config.yaml.
 * Priority: TEMPLATE_URL env var > config.yaml template_url > null (disabled)
 */
export function getTemplateUrl(): string | null {
  const envUrl = process.env.TEMPLATE_URL;
  if (envUrl) return envUrl;

  const dir = getConfigDir();
  const filePath = join(dir, "config.yaml");
  if (!existsSync(filePath)) return null;

  try {
    const raw = loadYamlFile<Record<string, unknown>>(filePath);
    const url = raw.template_url as string | undefined;
    return url?.trim() || null;
  } catch {
    return null;
  }
}

export function watchConfig(
  onChange: (config: LoadedConfig) => void,
  configDir?: string,
): ConfigWatcher {
  const dir = configDir ?? getConfigDir();
  const filePath = join(dir, "config.yaml");

  const mtimes = new Map<string, number>();
  if (existsSync(filePath)) {
    const stat = require("node:fs").statSync(filePath);
    mtimes.set(filePath, stat.mtimeMs);
  }

  const interval = setInterval(() => {
    if (!existsSync(filePath)) return;
    const stat = require("node:fs").statSync(filePath);
    const old = mtimes.get(filePath) ?? 0;
    if (stat.mtimeMs > old) {
      mtimes.set(filePath, stat.mtimeMs);
      onChange(loadConfig(dir));
    }
  }, 2000);

  return {
    stop: () => clearInterval(interval),
  };
}

// ESM-compatible version using dynamic import for fs
export function watchConfigESM(
  onChange: (config: LoadedConfig) => void,
  configDir?: string,
): ConfigWatcher {
  const dir = configDir ?? getConfigDir();
  const filePath = join(dir, "config.yaml");

  let contentHash = -1;
  try {
    const content = readFileSync(filePath, "utf-8");
    contentHash = content.length;
  } catch {
    // File doesn't exist
  }

  const interval = setInterval(() => {
    try {
      const content = readFileSync(filePath, "utf-8");
      const hash = content.length;
      if (hash !== contentHash) {
        contentHash = hash;
        onChange(loadConfig(dir));
      }
    } catch {
      // File not readable
    }
  }, 2000);

  return {
    stop: () => clearInterval(interval),
  };
}
