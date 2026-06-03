import { homedir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { mkdirSync, accessSync, constants, readFileSync, writeFileSync, existsSync } from "node:fs";
import { BrowserWindow, BrowserView, Tray } from "electrobun/bun";
import type { MenuItemConfig } from "electrobun/bun";
import Electrobun from "electrobun/bun";

  // Default port (production); dev mode overrides to 28950
  const DEFAULT_PORT = 28920;
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
    titleBarStyle: "hidden",
  });

  // Prevent electrobun from quitting the app on window close
  let quitAllowed = false;
  const origExit = process.exit.bind(process);
  (process as any).exit = ((code?: number) => {
    if (quitAllowed) origExit(code);
    // Otherwise — silently ignore, app stays alive in tray
  }) as typeof process.exit;

  let tray: Tray;

  // ── Helper to create/recreate the window ──
  let _win: BrowserWindow | null = win;

  function showWindow() {
    if (_win) {
      _win.show();
      _win.focus();
    } else {
      _win = new BrowserWindow({
        title: "LLM Proxy Gateway",
        url: `http://localhost:${PORT}`,
        frame: { x: 0, y: 0, width: 640, height: 520 },
        titleBarStyle: "hiddenInset",
      });
      _win.show();
      _win.focus();
    }
  }

  // ── System tray ──
  const trayIcon = mode === "production"
    ? join(paths.configDir, "..", "tray-icon.png")
    : join(findWorkspaceRoot(), "packages", "frontend", "public", "tray-icon.png");
  console.log(`[GW] Tray icon: ${trayIcon} exists=${existsSync(trayIcon)}`);
  // Use zero-width space to avoid taking space, but prevent width calculation bug in Electrobun
  tray = new Tray({
    title: "\u200B",
    image: existsSync(trayIcon) ? trayIcon : "",
    width: 16,
    height: 16,
  });

  const trayMenu: MenuItemConfig[] = [
    { label: "Show Window", action: "show-window", enabled: true },
    { type: "separator" },
    { label: "Quit", action: "quit-app", enabled: true },
  ];
  tray.setMenu(trayMenu);

  // Show window on tray click (left-click)
  tray.on("tray-clicked", () => {
    showWindow();
  });

  // Handle tray menu actions via generic host events
  // Menu item clicks fire "tray-menu-item-clicked" with { action, data }
  Electrobun.events.on("tray-menu-item-clicked", (event: { detail: { action: string; data?: unknown } }) => {
    const action = event?.detail?.action;
    if (action === "show-window") {
      showWindow();
    } else if (action === "quit-app") {
      quitAllowed = true;
      tray.remove();
      if (_win) _win.close();
      stop().then(() => origExit(0));
    }
  });

  // IPC: listen for window control and settings commands from frontend
  Electrobun.events.on("host-message", (event: { data: { detail: unknown } }) => {
    const msg = event.data.detail as Record<string, unknown>;
    if (!msg) return;

    if (msg.type === "window-control") {
      const action = msg.action as "minimize" | "maximize" | "close";
      switch (action) {
        case "minimize": if (_win) _win.minimize(); break;
        case "maximize": if (_win) _win.isMaximized() ? _win.unmaximize() : _win.maximize(); break;
        case "close":
          if (_win) {
            _win.hide();
          } else {
            showWindow();
          }
          break;
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

  // Listen for window close (native red X, Cmd+W) — mark as destroyed
  Electrobun.events.on("close", (event: { data: { id: number } }) => {
    if (_win && event.data.id === (_win as any).id) {
      _win = null;
    }
  });

  process.on("SIGINT", async () => { quitAllowed = true; tray.remove(); if (_win) _win.close(); await stop(); origExit(0); });
}

main().catch((err) => { console.error("[GW] Fatal:", err); process.exit(1); });
