import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ProviderPool } from "./pool.js";
import type { Auth } from "@llm-proxy/shared/schemas";
import type { Provider } from "@llm-proxy/shared/schemas";
import { RateLimiter } from "./rate_limiter.js";
import { loadConfig, watchConfigESM, type LoadedConfig } from "./config/loader.js";
import { initDb, closeDb, getDb } from "./db/database.js";
import { createGatewayRoutes } from "./routes/gateway.js";
import { createAdminRoutes, createStoreState, type StoreState } from "./routes/admin.js";
import { createStatsRoutes } from "./routes/stats.js";
import { createRatesRoutes } from "./routes/rates.js";
import { createTemplatesRoutes } from "./routes/templates.js";

// ============================================================
// App state
// ============================================================

export interface AppState {
  pool: ProviderPool;
  configRef: { current: LoadedConfig };
  storeRef: { current: StoreState };
}

// ============================================================
// Create Hono app
// ============================================================

export async function createApp(opts?: {
  configDir?: string;
  dbPath?: string;
  frontendDist?: string;
}): Promise<{
  app: Hono;
  state: AppState;
  stop: () => Promise<void>;
}> {
  const app = new Hono();

  // Load initial config with optional configDir
  const initialConfig = loadConfig(opts?.configDir);
  const configRef = { current: initialConfig };

  // Initialize rate limiter
  const rateLimiter = new RateLimiter();

  // Extract auths map from providers (nested structure)
  function extractAuths(providers: Map<string, Provider>): Map<string, Map<string, Auth>> {
    const auths = new Map<string, Map<string, Auth>>();
    for (const [providerId, provider] of providers.entries()) {
      if (provider.auths && provider.auths.length > 0) {
        const providerAuths = new Map<string, Auth>();
        for (const a of provider.auths) {
          providerAuths.set(a.key, a);
        }
        auths.set(providerId, providerAuths);
      }
    }
    return auths;
  }

  // Initialize provider pool
  const pool = new ProviderPool(
    initialConfig.models,
    initialConfig.providers,
    extractAuths(initialConfig.providers),
    rateLimiter,
  );

  const storeRef = { current: createStoreState(initialConfig) };
  const state: AppState = { pool, configRef, storeRef };

  // Initialize database
  await initDb(opts?.dbPath);

  // Load provider auths from database into in-memory store
  try {
    const authRows = await getDb(opts?.dbPath)
      .selectFrom("provider_auths")
      .selectAll()
      .execute();
    for (const row of authRows) {
      const provider = storeRef.current.providers.get(row.provider_id);
      if (provider) {
        if (!provider.auths) {
          provider.auths = [];
        }
        const existingIndex = provider.auths.findIndex((a) => a.key === row.key);
        if (existingIndex === -1) {
          provider.auths.push({ key: row.key, name: row.name ?? undefined });
        }
      }
    }
    // Update pool auths map after loading from DB (pool was created before DB load)
    pool.setConfig(initialConfig.models, initialConfig.providers, extractAuths(storeRef.current.providers));
  } catch (err) {
    console.warn("[server] Failed to load auths from DB:", err);
  }

  // Set up config hot reload
  const watcher = watchConfigESM((newConfig) => {
    console.log("[config] Configuration reloaded");
    configRef.current = newConfig;
    pool.setConfig(newConfig.models, newConfig.providers, extractAuths(newConfig.providers));
    // Also update admin store so API routes reflect changes immediately
    storeRef.current.models = new Map(newConfig.models);
    storeRef.current.providers = new Map(newConfig.providers);
  });

  // Middleware
  app.use("*", logger());
  app.use("*", cors());

  // Health check
  app.get("/health", (c) => {
    return c.json({
      status: "healthy",
      uptime_seconds: process.uptime(),
      version: "0.1.0",
    });
  });

  // Root endpoint — serves frontend SPA if configured, otherwise JSON
  app.get("/", async (c) => {
    if (opts?.frontendDist) {
      const { readFileSync, existsSync } = await import("node:fs");
      const { join } = await import("node:path");
      const indexPath = join(opts.frontendDist, "index.html");
      if (existsSync(indexPath)) return c.html(readFileSync(indexPath, "utf-8"));
    }
    return c.json({ status: "ok", name: "llm-proxy-gateway" });
  });

  // Gateway proxy routes
  app.route("/", createGatewayRoutes(pool, configRef));

  // Admin routes with in-memory store
  const reloadConfig = async (): Promise<LoadedConfig> => {
    const newConfig = loadConfig();
    configRef.current = newConfig;
    pool.setConfig(newConfig.models, newConfig.providers, extractAuths(newConfig.providers));
    return newConfig;
  };
  app.route("/", createAdminRoutes(configRef, storeRef, reloadConfig, () => {
    pool.setConfig(
      storeRef.current.models,
      storeRef.current.providers,
      extractAuths(storeRef.current.providers),
    );
  }));

  // Rates routes
  app.route("/", createRatesRoutes());

  // Templates routes
  app.route("/", createTemplatesRoutes());

  // Stats routes
  app.route("/", createStatsRoutes(configRef));

  // Frontend static files (served at the end — API routes take priority)
  if (opts?.frontendDist) {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join, extname } = await import("node:path");

    app.get("/assets/*", async (c) => {
      const filePath = join(opts.frontendDist!, c.req.path);
      if (!existsSync(filePath)) return c.notFound();
      const content = readFileSync(filePath);
      const ext = extname(filePath);
      const mime: Record<string, string> = {
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
        ".woff2": "font/woff2",
        ".json": "application/json",
      };
      return c.body(content, 200, { "Content-Type": mime[ext] || "application/octet-stream" });
    });

    // SPA fallback: any unmatched GET → index.html
    app.get("/*", async (c) => {
      const indexPath = join(opts.frontendDist!, "index.html");
      if (!existsSync(indexPath)) return c.notFound();
      const html = readFileSync(indexPath, "utf-8");
      return c.html(html);
    });
  }

  // Cleanup function
  const stop = async () => {
    watcher.stop();
    await closeDb();
  };

  return { app, state, stop };
}

// ============================================================
// Default export for testing
// ============================================================

let _appState: Awaited<ReturnType<typeof createApp>> | null = null;

async function getApp() {
  if (!_appState) {
    _appState = await createApp();
  }
  return _appState;
}

// For direct Hono testing
const { app } = await getApp();

export { getApp };
export default app;
