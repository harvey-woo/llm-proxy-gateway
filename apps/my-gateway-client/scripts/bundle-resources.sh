#!/usr/bin/env bash
set -euo pipefail

# bundle-resources.sh
# Copies frontend dist and config files into the .app bundle after electrobun build.
#
# Usage:
#   bash scripts/bundle-resources.sh                    # auto-detect the .app
#   bash scripts/bundle-resources.sh /path/to/App.app   # explicit path

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(cd "$CLIENT_DIR/../.." && pwd)"

# ── Find the .app bundle ───────────────────────────────────────────────
if [ $# -ge 1 ]; then
  APP_BUNDLE="$1"
else
  # Auto-detect: look for the most recently built .app
  APP_BUNDLE=$(find "$CLIENT_DIR/build" -name "*.app" -maxdepth 2 -type d 2>/dev/null | head -1)
  if [ -z "$APP_BUNDLE" ]; then
    echo "ERROR: No .app bundle found. Run 'yarn build' first, or pass the path."
    exit 1
  fi
fi

if [ ! -d "$APP_BUNDLE" ]; then
  echo "ERROR: '$APP_BUNDLE' is not a directory."
  exit 1
fi

echo "[bundle] App bundle: $APP_BUNDLE"

RESOURCES_DIR="$APP_BUNDLE/Contents/Resources"

# ── 1. Copy frontend dist ──────────────────────────────────────────────
FRONTEND_DIST="$WORKSPACE_DIR/packages/frontend/dist"
if [ ! -d "$FRONTEND_DIST" ]; then
  echo "ERROR: Frontend dist not found at $FRONTEND_DIST"
  echo "       Run 'yarn build:frontend' first."
  exit 1
fi

echo "[bundle] Copying frontend dist..."
rm -rf "$RESOURCES_DIR/frontend"
cp -r "$FRONTEND_DIST" "$RESOURCES_DIR/frontend"
echo "[bundle] Frontend copied ($(du -sh "$RESOURCES_DIR/frontend" | cut -f1))"

# ── 2. Copy config files ───────────────────────────────────────────────
echo "[bundle] Copying config..."
mkdir -p "$RESOURCES_DIR/config"

if [ -f "$WORKSPACE_DIR/config/config.yaml" ]; then
  cp "$WORKSPACE_DIR/config/config.yaml" "$RESOURCES_DIR/config/"
else
  echo "[bundle] WARNING: config.yaml not found, copying config.sample.yaml instead"
fi
cp "$WORKSPACE_DIR/config/config.sample.yaml" "$RESOURCES_DIR/config/"

if [ -f "$WORKSPACE_DIR/config/templates.json" ]; then
  cp "$WORKSPACE_DIR/config/templates.json" "$RESOURCES_DIR/config/"
fi

echo "[bundle] Config copied"

# ── 3. Copy tray icon (fallback if not in frontend dist) ───────────────
if [ ! -f "$RESOURCES_DIR/frontend/tray-icon.png" ]; then
  if [ -f "$WORKSPACE_DIR/packages/frontend/public/tray-icon.png" ]; then
    cp "$WORKSPACE_DIR/packages/frontend/public/tray-icon.png" "$RESOURCES_DIR/frontend/"
    echo "[bundle] Tray icon copied"
  fi
fi

# ── 4. Re-sign the app bundle (ad-hoc) ─────────────────────────────────
echo "[bundle] Re-signing app bundle..."
codesign --force --deep --sign - "$APP_BUNDLE" 2>/dev/null
echo "[bundle] Done! App bundle is ready."

echo ""
echo "  Open with: open '$APP_BUNDLE'"
echo ""
