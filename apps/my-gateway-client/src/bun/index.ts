import { homedir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { mkdirSync, accessSync, constants, readFileSync, writeFileSync, existsSync } from "node:fs";
import { BrowserWindow, BrowserView } from "electrobun/bun";
import Electrobun from "electrobun/bun";

const DEFAULT_PORT = 9000;
const SETTINGS_FILE = "settings.json";
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

function resolveSettingsPath(mode: RuntimeMode): string {
  if (mode === "production") {
    const appSupport = join(process.env.HOME || homedir(), "Library", "Application Support", "LLM Proxy Gateway");
    mkdirSync(appSupport, { recursive: true });
    return join(appSupport, SETTINGS_FILE);
  }
  const root = mode === "development" ? findWorkspaceRoot() : join(process.env.TMPDIR || "/tmp", "llm-proxy-gateway-test");
  return join(root, SETTINGS_FILE);
}

function readPort(settingsPath: string): number {
  if (existsSync(settingsPath)) {
    const raw = JSON.parse(readFileSync(settingsPath, "utf-8"));
    const p = parseInt(raw.port, 10);
    if (!isNaN(p) && p >= 1 && p <= 65535) return p;
  }
  return DEFAULT_PORT;
}

function writePort(settingsPath: string, port: number): void {
  const existing = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf-8")) : {};
  writeFileSync(settingsPath, JSON.stringify({ ...existing, port }, null, 2));
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
      const resources = join(import.meta.dirname, "..", "..");
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
  const settingsPath = resolveSettingsPath(mode);
  const PORT = readPort(settingsPath);

  console.log(`[GW] Mode: ${mode}`);
  console.log(`[GW] Config: ${paths.configDir}`);
  console.log(`[GW] Database: ${paths.dbPath}`);
  console.log(`[GW] Settings: ${settingsPath}`);

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

  // Open desktop window — hidden native title bar, custom buttons in AppNav
  const win = new BrowserWindow({
    title: "LLM Proxy Gateway",
    url: `http://localhost:${PORT}`,
    frame: { x: 0, y: 0, width: 640, height: 520 },
    titleBarStyle: "hiddenInset",
  });

  // IPC: listen for window control and settings commands from frontend
  Electrobun.events.on("host-message", (event: { data: { detail: unknown } }) => {
    const msg = event.data.detail as Record<string, unknown>;
    if (!msg) return;

    if (msg.type === "window-control") {
      const action = msg.action as "minimize" | "maximize" | "close";
      switch (action) {
        case "minimize": win.minimize(); break;
        case "maximize": win.isMaximized() ? win.unmaximize() : win.maximize(); break;
        case "close": win.close(); break;
      }
    }

    if (msg.type === "save-port") {
      const port = parseInt(msg.port as string, 10);
      if (!isNaN(port) && port >= 1 && port <= 65535) {
        writePort(settingsPath, port);
        console.log(`[GW] Port saved: ${port} (restart required)`);
      }
    }
  });

  process.on("SIGINT", async () => { await stop(); process.exit(0); });
}

main().catch((err) => { console.error("[GW] Fatal:", err); process.exit(1); });
