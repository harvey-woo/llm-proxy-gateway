import { Hono } from "hono";
import { getTemplateUrl, saveProvidersToConfig } from "../config/loader.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoreState } from "./admin.js";

// In-memory cache
let cachedData: {
  version?: number;
  updated_at?: string;
  templates: unknown[];
} | null = null;
let lastFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve the config/ directory that contains templates.json.
 * Priority:
 *   1. CONFIG_DIR env var
 *   2. process.cwd()/config (works when run from monorepo root)
 *   3. Walk up from this source file to find a config/templates.json
 *   4. process.cwd()/../config (works when cwd is a workspace package dir)
 */
function resolveConfigDir(): string {
  const envDir = process.env.CONFIG_DIR;
  if (envDir) return envDir;

  // Check cwd/config first (monorepo root)
  const cwdCandidate = join(process.cwd(), "config");
  if (existsSync(join(cwdCandidate, "templates.json"))) return cwdCandidate;

  // Check cwd/../config (workspace package dir)
  const parentCandidate = resolve(process.cwd(), "..", "config");
  if (existsSync(join(parentCandidate, "templates.json")))
    return parentCandidate;

  // Walk up from this file — skip node_modules and build dirs
  const selfPath = dirname(fileURLToPath(import.meta.url));
  for (let p = selfPath; p !== dirname(p); p = dirname(p)) {
    const candidate = join(p, "config");
    if (
      existsSync(candidate) &&
      existsSync(join(candidate, "templates.json")) &&
      !candidate.includes("node_modules") &&
      !candidate.includes("/build/")
    ) {
      return candidate;
    }
  }

  return cwdCandidate;
}

/**
 * Read templates from local config/templates.json.
 */
function readLocalTemplates(): {
  version?: number;
  updated_at?: string;
  templates: unknown[];
} {
  const configDir = resolveConfigDir();
  const filePath = join(configDir, "templates.json");
  if (!existsSync(filePath)) {
    return { templates: [] };
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as {
      version?: number;
      updated_at?: string;
      templates?: unknown[];
    };
    return {
      version: data.version,
      updated_at: data.updated_at,
      templates: Array.isArray(data.templates) ? data.templates : [],
    };
  } catch (err) {
    console.warn(`[templates] local read error: ${err}`);
    return { templates: [] };
  }
}

async function fetchTemplates(refresh = false): Promise<{
  version?: number;
  updated_at?: string;
  templates: unknown[];
}> {
  const url = getTemplateUrl();

  // No external URL → serve from local templates.json
  if (!url) {
    if (!refresh && cachedData) {
      return cachedData;
    }
    cachedData = readLocalTemplates();
    lastFetch = Date.now();
    return cachedData;
  }

  const now = Date.now();
  if (!refresh && cachedData && now - lastFetch < CACHE_TTL_MS) {
    return cachedData;
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "LLM-Proxy-Gateway/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn(
        `[templates] fetch failed: ${response.status} ${response.statusText}`,
      );
      return cachedData ?? readLocalTemplates();
    }
    const data = (await response.json()) as {
      version?: number;
      updated_at?: string;
      templates?: unknown[];
    };
    cachedData = {
      version: data.version,
      updated_at: data.updated_at,
      templates: Array.isArray(data.templates) ? data.templates : [],
    };
    lastFetch = now;
    return cachedData;
  } catch (err) {
    console.warn(`[templates] fetch error: ${err}`);
    // Return stale cache, then local as last resort
    return cachedData ?? readLocalTemplates();
  }
}

export function createTemplatesRoutes(
  storeRef: { current: StoreState },
  onAuthChange?: () => void,
): Hono {
  const router = new Hono();

  /** Seed providers from a template list into the in-memory store + config.yaml */
  function seedFromTemplates(templates: Array<Record<string, unknown>>): void {
    let seeded = 0;
    for (const tmpl of templates) {
      const id = tmpl.id as string;
      if (!id || storeRef.current.providers.has(id)) continue;

      const models = (tmpl.models as Array<Record<string, unknown>>) ?? [];
      storeRef.current.providers.set(id, {
        id,
        name: (tmpl.name as string) ?? id,
        base_url: (tmpl.base_url as string) ?? "",
        models: models.map((m) => ({
          name: m.name as string,
          alias: m.alias as string | undefined,
          input_price: (m.input_price as number) ?? 0,
          output_price: (m.output_price as number) ?? 0,
        })),
        auths: [],
        rate_limits: [],
        request_timeout_ms: 60000,
        max_retries: 3,
        enabled: true,
        pricing_model: "per_request_weighted",
        unit_price: 0.001,
        currency: "USD",
        api_format: (tmpl.api_format as any) ?? "openai_chat",
        description: tmpl.description as string | undefined,
      });
      seeded++;
    }
    if (seeded > 0) {
      saveProvidersToConfig(storeRef.current.providers);
      onAuthChange?.();
      console.log(
        `[templates] Seeded ${seeded} new provider(s) from templates`,
      );
    }
  }

  // GET /api/templates - Get provider templates
  router.get("/api/templates", async (c) => {
    const refresh = c.req.query("refresh") === "true";
    const data = await fetchTemplates(refresh);

    // Real-time seed: create providers from templates on every fetch
    const templates = Array.isArray(data.templates) ? data.templates : [];
    seedFromTemplates(templates as Array<Record<string, unknown>>);

    return c.json({
      success: true,
      data,
    });
  });

  return router;
}
