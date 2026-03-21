#!/usr/bin/env bash
# build-zip.sh — Build the full Flint beta distribution package
#
# Includes:
#   - Flint Glass (Electron app)
#   - Flint MCP server (compiled)
#   - VS Code / Cursor extension (.vsix)
#   - Governance starter kit
#   - Quick-start README
#
# Usage:
#   npm run build:zip
#
# Output:  release/Flint-<version>-<date>-<arch>.zip
# No code signing or paid licenses required.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)

VERSION=$(node -p "require('./package.json').version")
DATE=$(date +%Y%m%d)
ARCH=$(uname -m)

case "$ARCH" in
  arm64|aarch64) ARCH_LABEL="arm64" ;;
  x86_64|x64)    ARCH_LABEL="x64" ;;
  *)             ARCH_LABEL="$ARCH" ;;
esac

BUILD_ID="beta-${VERSION}-${DATE}"
EXPIRY=$(node -p "new Date(Date.now()+30*864e5).toISOString().split('T')[0]+'T00:00:00Z'")
STAGE_DIR="release/_stage/Flint-${VERSION}"
ZIP_NAME="Flint-${VERSION}-${DATE}-${ARCH_LABEL}.zip"

echo ""
echo "══════════════════════════════════════════════"
echo "  Flint Beta — Full Distribution Build"
echo "  Version:  ${VERSION}"
echo "  Build ID: ${BUILD_ID}"
echo "  Expires:  ${EXPIRY}"
echo "  Arch:     ${ARCH_LABEL}"
echo "══════════════════════════════════════════════"
echo ""

# ── Step 1: Compile Flint Glass (TypeScript + Vite) ─────────────────────────
echo "[1/5] Compiling Flint Glass..."
npm run build

# ── Step 2: Package Electron app (unsigned, directory output) ────────────────
echo "[2/5] Packaging Electron app..."
FLINT_BETA_EXPIRY="$EXPIRY" \
FLINT_BETA_BUILD_ID="$BUILD_ID" \
  npx electron-builder --mac --dir --config electron-builder.yml

# ── Step 3: Build Flint MCP server ──────────────────────────────────────────
echo "[3/5] Building Flint MCP server..."
cd flint-mcp
npm run build 2>/dev/null || npx tsc 2>/dev/null || echo "  (MCP already compiled)"
cd "$ROOT"

# ── Step 4: Assemble the staging directory ───────────────────────────────────
echo "[4/5] Assembling distribution package..."

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

# 4a. Copy the .app bundle
APP_DIR=""
for candidate in "release/mac-arm64" "release/mac-x64" "release/mac"; do
  if [ -d "$candidate" ]; then
    APP_DIR="$candidate"
    break
  fi
done

if [ -z "$APP_DIR" ]; then
  echo "ERROR: Could not find packaged app in release/"
  ls -la release/ 2>/dev/null
  exit 1
fi

APP_PATH=$(find "$APP_DIR" -maxdepth 1 -name "*.app" -type d | head -1)
if [ -z "$APP_PATH" ]; then
  echo "ERROR: No .app bundle found in $APP_DIR"
  exit 1
fi

cp -R "$APP_PATH" "$STAGE_DIR/"

# 4b. Copy Flint MCP server (compiled dist + deps manifest)
mkdir -p "$STAGE_DIR/flint-mcp"
if [ -d "flint-mcp/dist" ]; then
  cp -R flint-mcp/dist "$STAGE_DIR/flint-mcp/"
fi
cp flint-mcp/package.json "$STAGE_DIR/flint-mcp/"
if [ -f "flint-mcp/package-lock.json" ]; then
  cp flint-mcp/package-lock.json "$STAGE_DIR/flint-mcp/"
fi

# 4c. Copy VS Code extension (.vsix)
mkdir -p "$STAGE_DIR/extensions"
VSIX=$(find flint-vscode -name "*.vsix" -type f 2>/dev/null | head -1)
if [ -n "$VSIX" ]; then
  cp "$VSIX" "$STAGE_DIR/extensions/"
  echo "  Included: $(basename "$VSIX")"
else
  echo "  Warning: No .vsix found in flint-vscode/ — skipping extension"
fi

# 4d. Copy governance starter kit
if [ -f "docs/governance-starter.zip" ]; then
  cp docs/governance-starter.zip "$STAGE_DIR/"
  echo "  Included: governance-starter.zip"
fi

# 4e. Write the quick-start README
cat > "$STAGE_DIR/START-HERE.txt" << 'STARTEOF'
============================================================
  Flint — Quick Start Guide
============================================================

This package contains everything you need to run Flint:

  Flint Glass.app     The visual governance dashboard (Electron)
  flint-mcp/          The MCP governance engine (headless)
  extensions/          VS Code / Cursor extension (.vsix)
  governance-starter.zip   Template governance config for your project


STEP 1 — Install Flint Glass (the app)
────────────────────────────────────────
  macOS:
    1. Drag "Flint Glass.app" to your Applications folder
    2. Right-click the app → Open (bypasses unsigned-app warning)
       — OR run in Terminal: xattr -cr "/Applications/Flint Glass.app"
    3. Launch normally after the first open

  If you see "damaged" or "can't be opened":
    Run: xattr -cr "Flint Glass.app"


STEP 2 — Install Flint MCP Server
───────────────────────────────────
  The MCP server is what does the actual governance work.
  Claude Code, Cursor, and VS Code call it automatically.

  a) Install dependencies (one time):
       cd flint-mcp && npm install --production

  b) Add to your Claude Code MCP config (~/.claude/mcp.json):
       {
         "mcpServers": {
           "flint": {
             "command": "node",
             "args": ["<PATH_TO>/flint-mcp/dist/cli.js"],
             "env": {}
           }
         }
       }

     Replace <PATH_TO> with the actual path where you extracted this package.

  c) For Cursor / VS Code, add the same config to your editor's MCP settings.


STEP 3 — Install VS Code / Cursor Extension (optional)
───────────────────────────────────────────────────────
  Adds inline diagnostics and quick-fix actions in your editor.

  a) Open VS Code or Cursor
  b) Cmd+Shift+P → "Extensions: Install from VSIX..."
  c) Select the .vsix file from the extensions/ folder


STEP 4 — Set Up Governance in Your Project (optional)
─────────────────────────────────────────────────────
  Unzip governance-starter.zip into your project root.
  It creates a .flint/ folder with default design tokens and rules.


NOTES
─────
  - This is a beta build. It expires in 30 days.
  - No internet connection required — Flint runs 100% offline.
  - Node.js 20+ is required for the MCP server.
  - Questions? Contact the Flint team.

============================================================
STARTEOF

# ── Step 5: Create the final zip ─────────────────────────────────────────────
echo "[5/5] Creating zip..."

cd release/_stage
ditto -c -k --sequesterRsrc "Flint-${VERSION}" "../${ZIP_NAME}"
cd "$ROOT"

# Clean up staging
rm -rf "$STAGE_DIR"

ZIP_SIZE=$(du -sh "release/$ZIP_NAME" | cut -f1)
FILE_COUNT=$(ditto -c -k --sequesterRsrc --keepParent "release/$ZIP_NAME" /dev/null 2>&1 | wc -l || echo "?")

echo ""
echo "══════════════════════════════════════════════"
echo "  Build complete!"
echo ""
echo "  File:     release/${ZIP_NAME}"
echo "  Size:     ${ZIP_SIZE}"
echo "  Expires:  ${EXPIRY}"
echo ""
echo "  Contents:"
echo "    Flint Glass.app       — Desktop app"
echo "    flint-mcp/            — MCP governance engine"
if [ -n "$VSIX" ]; then
echo "    extensions/*.vsix      — VS Code / Cursor extension"
fi
echo "    governance-starter.zip — Project starter kit"
echo "    START-HERE.txt         — Quick-start guide"
echo ""
echo "  Upload anywhere and share the zip."
echo "══════════════════════════════════════════════"
echo ""
