import { Hono } from "hono";
import { getTemplateUrl } from "../config/loader.js";

// In-memory cache
let cachedData: { version?: number; updated_at?: string; templates: unknown[] } | null = null;
let lastFetch = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchTemplates(refresh = false): Promise<{
  version?: number;
  updated_at?: string;
  templates: unknown[];
}> {
  const url = getTemplateUrl();
  if (!url) {
    return { templates: [] };
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
      console.warn(`[templates] fetch failed: ${response.status} ${response.statusText}`);
      return { templates: [] };
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
    // Return stale cache if available, otherwise empty
    return cachedData ?? { templates: [] };
  }
}

export function createTemplatesRoutes(): Hono {
  const router = new Hono();

  // GET /api/templates - Get provider templates
  router.get("/api/templates", async (c) => {
    const refresh = c.req.query("refresh") === "true";
    const data = await fetchTemplates(refresh);
    return c.json({
      success: true,
      data,
    });
  });

  return router;
}
