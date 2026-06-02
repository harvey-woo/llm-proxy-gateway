import { homedir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { mkdirSync, accessSync, constants } from "node:fs";
import { BrowserWindow } from "electrobun/bun";

const PORT = 9000;
type RuntimeMode = "development" | "production" | "test";

function detectMode(): RuntimeMode {
  if (process.env.VITEST) return "test";
  if (process.env.DEV_WORKSPACE) return "development";
  if (import.meta.dirname?.includes(".app/Contents/")) return "production";
  return "development";
}

function findWorkspaceRoot(): string {
  if (process.env.DEV_WORKSPACE) return process.env.DEV_WORKSPACE;
  throw new Error("DEV_WORKSPACE not set. Run: DEV_WORKSPACE=$(cd ../.. && pwd) bunx electrobun dev");
}

function ensureWritableDir(dir: string): boolean {
  try { mkdirSync(dir, { recursive: true }); accessSync(dir, constants.W_OK); return true; }
  catch { return false; }
}

function resolveDbPath(preferred: string, label: string): string {
  if (ensureWritableDir(dirname(preferred))) return preferred;
  for (const base of [process.env.HOME || homedir(), "/tmp", process.cwd()]) {
    const fb = join(base, "llm-proxy-gateway", `${label}.db`);
    if (ensureWritableDir(dirname(fb))) { console.warn(`[GW] DB fallback: ${fb}`); return fb; }
  }
  throw new Error(`Cannot find writable location for ${label} database`);
}

function getPaths(mode: RuntimeMode) {
  switch (mode) {
    case "development": {
      const root = findWorkspaceRoot();
      return {
        configDir: join(root, "config"),
        dbPath: resolveDbPath(join(root, "data", "test.db"), "dev"),
        frontendDist: join(root, "packages/frontend/dist"),
      };
    }
    case "production": {
      const resources = join(import.meta.dirname, "..", "Resources");
      const appSupport = join(process.env.HOME || homedir(), "Library", "Application Support", "LLM Proxy Gateway");
      return {
        configDir: join(resources, "config"),
        dbPath: resolveDbPath(join(appSupport, "data", "gateway.db"), "prod"),
        frontendDist: join(resources, "frontend"),
      };
    }
    case "test": {
      const tmp = join(process.env.TMPDIR || "/tmp", "llm-proxy-gateway-test");
      return {
        configDir: join(tmp, "config"),
        dbPath: resolveDbPath(join(tmp, "data", "test.db"), "test"),
        frontendDist: join(tmp, "frontend"),
      };
    }
  }
}

async function main() {
  const mode = detectMode();
  const paths = getPaths(mode);

  console.log(`[GW] Mode: ${mode}`);
  console.log(`[GW] Config: ${paths.configDir}`);
  console.log(`[GW] Database: ${paths.dbPath}`);

  // Backend serves both API and frontend — the full app in one call
  console.log("[GW] Initializing backend...");
  const { createApp } = await import("@llm-proxy/backend/src/server.js");
  const { app, stop } = await createApp({
    configDir: paths.configDir,
    dbPath: paths.dbPath,
    frontendDist: paths.frontendDist,
  });
  console.log("[GW] Backend initialized");

  // Single HTTP server for everything
  Bun.serve({ port: PORT, fetch: app.fetch });
  console.log(`[GW] Ready at http://localhost:${PORT}`);

  // Open desktop window — frameless via titleBarStyle, drag region in frontend
  const win = new BrowserWindow({
    title: "LLM Proxy Gateway",
    url: `http://localhost:${PORT}`,
    frame: { x: 0, y: 0, width: 640, height: 520 },
    titleBarStyle: "hiddenInset",
  });

  process.on("SIGINT", async () => { await stop(); process.exit(0); });
}

main().catch((err) => { console.error("[GW] Fatal:", err); process.exit(1); });
