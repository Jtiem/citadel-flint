#!/usr/bin/env bash
# package-standalone.sh — Build a self-contained Flint Glass .app (macOS)
#
# Output: release/Flint Glass.app — double-click to run, opens in browser.
# No Node.js, npm, or developer tools required on the target machine.
#
# Usage:
#   npm run package:standalone
#   npm run package:standalone -- --skip-build   # reuse existing dist-web/

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)
VERSION=$(node -p "require('./package.json').version")
ARCH=$(uname -m)
SKIP_BUILD=false

for arg in "$@"; do
  [ "$arg" = "--skip-build" ] && SKIP_BUILD=true
done

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║  Flint Glass — Standalone Package        ║"
echo "  ║  Version: ${VERSION} (${ARCH})           "
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Build frontend + bundle server ──────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo "[1/5] Type checking..."
  npx tsc -b --force
  echo "  0 errors"

  echo "[2/5] Building web frontend..."
  npx vite build --config vite.config.web.ts --mode production 2>&1 | tail -1
fi

echo "[3/5] Bundling server..."
npx esbuild server/cli.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --outfile=dist-server/standalone.mjs \
  --external:better-sqlite3 \
  --external:sqlite-vec \
  --external:'sqlite-vec-*' \
  --external:fsevents \
  --external:lightningcss \
  --external:playwright-core \
  --external:'chromium-bidi' \
  --external:'@babel/preset-typescript' \
  --external:puppeteer \
  --external:puppeteer-core \
  --external:esbuild \
  --log-level=error \
  --minify \
  --banner:js="import{createRequire as __cr}from'module';const require=__cr(import.meta.url);"

echo "  Server bundled ($(du -sh dist-server/standalone.mjs | cut -f1))"

# ── Step 2: Rebuild native modules for current arch ─────────────────────────
echo "[4/5] Compiling native modules..."
npm rebuild better-sqlite3 2>/dev/null

# ── Step 3: Assemble .app bundle ───────────────────────────────────────────
echo "[5/5] Assembling Flint Glass.app..."

APP="release/Flint Glass.app"
CONTENTS="$APP/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

rm -rf "$APP"
mkdir -p "$MACOS" "$RESOURCES"

# Info.plist
cat > "$CONTENTS/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Flint Glass</string>
    <key>CFBundleDisplayName</key>
    <string>Flint Glass</string>
    <key>CFBundleIdentifier</key>
    <string>com.flint.glass</string>
    <key>CFBundleVersion</key>
    <string>VERSION_PLACEHOLDER</string>
    <key>CFBundleShortVersionString</key>
    <string>VERSION_PLACEHOLDER</string>
    <key>CFBundleExecutable</key>
    <string>flint-glass</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
PLIST

# Inject version
sed -i '' "s/VERSION_PLACEHOLDER/${VERSION}/g" "$CONTENTS/Info.plist"

# Launcher script
cat > "$MACOS/flint-glass" << 'LAUNCHER'
#!/bin/bash
# Flint Glass — standalone launcher
# Starts the server and opens the browser.

DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
export NODE_PATH="$DIR/node_modules"

# Find a free port (default 4201, scan up to 4210)
PORT=4201
while lsof -i :"$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ "$PORT" -gt 4210 ]; then
    PORT=4201
    break
  fi
done

# Start server in background
"$DIR/node" "$DIR/server.mjs" --no-open --port "$PORT" --demo &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 0.3
done

# Open browser
open "http://localhost:$PORT"

# Show a macOS notification
osascript -e "display notification \"Running at http://localhost:$PORT\" with title \"Flint Glass\" subtitle \"Governance observability layer\"" 2>/dev/null || true

# Keep running until the user quits (Cmd+Q or close terminal)
wait "$SERVER_PID" 2>/dev/null
LAUNCHER

chmod +x "$MACOS/flint-glass"

# ── Copy resources ──────────────────────────────────────────────────────────

# Node.js binary — extract single-arch slice from universal binary to save ~120MB
NODE_SRC="$(which node)"
if file "$NODE_SRC" | grep -q "universal binary"; then
  echo "  Extracting ${ARCH} slice from universal Node.js binary..."
  lipo "$NODE_SRC" -extract "$ARCH" -output "$RESOURCES/node"
else
  cp "$NODE_SRC" "$RESOURCES/node"
fi
chmod +x "$RESOURCES/node"

# Bundled server
cp dist-server/standalone.mjs "$RESOURCES/server.mjs"

# Built frontend SPA
cp -R dist-web "$RESOURCES/dist-web"

# Native modules — only the needed files
mkdir -p "$RESOURCES/node_modules/better-sqlite3/build/Release"
cp node_modules/better-sqlite3/build/Release/better_sqlite3.node \
   "$RESOURCES/node_modules/better-sqlite3/build/Release/"
cp -R node_modules/better-sqlite3/lib \
   "$RESOURCES/node_modules/better-sqlite3/lib"
cp node_modules/better-sqlite3/package.json \
   "$RESOURCES/node_modules/better-sqlite3/"

# bindings (required by better-sqlite3)
mkdir -p "$RESOURCES/node_modules/bindings"
cp node_modules/bindings/bindings.js "$RESOURCES/node_modules/bindings/"
cp node_modules/bindings/package.json "$RESOURCES/node_modules/bindings/"

# file-uri-to-path (required by bindings)
mkdir -p "$RESOURCES/node_modules/file-uri-to-path"
cp node_modules/file-uri-to-path/index.js "$RESOURCES/node_modules/file-uri-to-path/"
cp node_modules/file-uri-to-path/package.json "$RESOURCES/node_modules/file-uri-to-path/"

# sqlite-vec native library
SQLITE_VEC_PKG=""
case "$ARCH" in
  arm64) SQLITE_VEC_PKG="sqlite-vec-darwin-arm64" ;;
  x86_64) SQLITE_VEC_PKG="sqlite-vec-darwin-x64" ;;
esac

if [ -n "$SQLITE_VEC_PKG" ] && [ -d "node_modules/$SQLITE_VEC_PKG" ]; then
  mkdir -p "$RESOURCES/node_modules/$SQLITE_VEC_PKG"
  cp -R "node_modules/$SQLITE_VEC_PKG/"* "$RESOURCES/node_modules/$SQLITE_VEC_PKG/"
fi

mkdir -p "$RESOURCES/node_modules/sqlite-vec"
cp node_modules/sqlite-vec/package.json "$RESOURCES/node_modules/sqlite-vec/"
cp node_modules/sqlite-vec/index.mjs "$RESOURCES/node_modules/sqlite-vec/" 2>/dev/null || true
cp node_modules/sqlite-vec/index.cjs "$RESOURCES/node_modules/sqlite-vec/" 2>/dev/null || true
cp node_modules/sqlite-vec/index.d.ts "$RESOURCES/node_modules/sqlite-vec/" 2>/dev/null || true

# MCP server source (spawned as child process)
mkdir -p "$RESOURCES/flint-mcp"
cp -R flint-mcp/src "$RESOURCES/flint-mcp/src"
cp flint-mcp/package.json "$RESOURCES/flint-mcp/package.json"

# MCP engine deps (needed at runtime) — prune heavyweight optional deps
if [ -d "flint-mcp/node_modules" ]; then
  cp -R flint-mcp/node_modules "$RESOURCES/flint-mcp/node_modules"
  # Remove AI/ML runtimes (158MB) — not needed for governance engine
  rm -rf "$RESOURCES/flint-mcp/node_modules/onnxruntime-node"
  rm -rf "$RESOURCES/flint-mcp/node_modules/onnxruntime-web"
  rm -rf "$RESOURCES/flint-mcp/node_modules/onnxruntime-common"
  rm -rf "$RESOURCES/flint-mcp/node_modules/@xenova"
  rm -rf "$RESOURCES/flint-mcp/node_modules/@huggingface"
  # Remove sharp (24MB) — image processing, optional
  rm -rf "$RESOURCES/flint-mcp/node_modules/sharp"
  # Remove typescript (23MB) — only needed at build time
  rm -rf "$RESOURCES/flint-mcp/node_modules/typescript"
  # Remove protobufjs (21MB) — transitive dep of onnxruntime
  rm -rf "$RESOURCES/flint-mcp/node_modules/protobufjs"
  # Remove esbuild (19MB) — build tool, not runtime
  rm -rf "$RESOURCES/flint-mcp/node_modules/esbuild"
  rm -rf "$RESOURCES/flint-mcp/node_modules/@esbuild"
  # Remove ts-node — not needed in pre-built package
  rm -rf "$RESOURCES/flint-mcp/node_modules/ts-node"
fi

# Demo project
mkdir -p "$RESOURCES/build-resources"
cp -R build-resources/demo-project "$RESOURCES/build-resources/demo-project"

# shared/ modules (brand.ts etc — imported by server)
cp -R shared "$RESOURCES/shared"

# package.json (for version reads)
cp package.json "$RESOURCES/package.json"

# ── Symlinks for path resolution ─────────────────────────────────────────────
# server.mjs resolves dist-web as path.resolve(__dirname, '..', 'dist-web')
# In the .app, __dirname = Resources/, so '../dist-web' = Contents/dist-web
# Create a symlink so that resolves correctly.
ln -sf Resources/dist-web "$CONTENTS/dist-web"

# MCP client looks for flint-mcp relative to Contents/
ln -sf Resources/flint-mcp "$CONTENTS/flint-mcp"

# ── Ad-hoc sign (prevents macOS quarantine issues) ──────────────────────────
codesign --deep --force --sign - "$APP" 2>/dev/null || true

# ── Summary ─────────────────────────────────────────────────────────────────
APP_SIZE=$(du -sh "$APP" | cut -f1)

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║  Package complete!                       ║"
echo "  ║                                          ║"
echo "  ║  release/Flint Glass.app                 ║"
echo "  ║  Size: ${APP_SIZE}                       "
echo "  ║                                          ║"
echo "  ║  Double-click to run.                    ║"
echo "  ║  Browser opens automatically.            ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
