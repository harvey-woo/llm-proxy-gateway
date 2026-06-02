#!/bin/bash
# bundle-resources.sh
# After electrobun build, copy backend dist, config, and frontend into the .app bundle.
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$CLIENT_DIR/../.." && pwd)"
APP_BUNDLE=$(ls -dt "$CLIENT_DIR/build/"LLM\ Proxy\ Gateway*.app 2>/dev/null | head -1)
if [ -z "$APP_BUNDLE" ]; then
  APP_BUNDLE=$(ls -dt "$CLIENT_DIR/build/"*/"LLM Proxy Gateway"*.app 2>/dev/null | head -1)
fi

if [ -z "$APP_BUNDLE" ]; then
  echo "[bundle] No .app bundle found. Run electrobun build first."
  exit 1
fi

RESOURCES="$APP_BUNDLE/Contents/Resources"
echo "[bundle] → $RESOURCES"

# Backend dist (compiled JS for production)
if [ -d "$PROJECT_ROOT/packages/backend/dist" ]; then
  mkdir -p "$RESOURCES/backend"
  cp -r "$PROJECT_ROOT/packages/backend/dist/." "$RESOURCES/backend/"
  echo "  backend/ ✓"
else
  echo "  Warning: backend dist not found"
fi

# Config
if [ -d "$PROJECT_ROOT/config" ]; then
  mkdir -p "$RESOURCES/config"
  cp "$PROJECT_ROOT/config/config.yaml" "$RESOURCES/config/" 2>/dev/null || true
  echo "  config/ ✓"
fi

# Frontend dist (served by electrobun views://)
if [ -d "$PROJECT_ROOT/packages/frontend/dist" ]; then
  mkdir -p "$RESOURCES/frontend"
  cp -r "$PROJECT_ROOT/packages/frontend/dist/." "$RESOURCES/frontend/"
  echo "  frontend/ ✓"
fi

echo "[bundle] Done."
