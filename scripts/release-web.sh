#!/usr/bin/env bash
# release-web.sh — Build, package, and publish Flint Glass Web to GitHub
#
# Usage:
#   npm run release:web              # patch bump (0.2.0 → 0.2.1)
#   npm run release:web -- minor     # minor bump (0.2.0 → 0.3.0)
#   npm run release:web -- major     # major bump (0.2.0 → 1.0.0)
#   npm run release:web -- current   # no bump, re-release current version
#
# Requires: gh CLI authenticated with repo access to jtiem/citadel-flint

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd)

BUMP_TYPE="${1:-patch}"
GH_REPO="jtiem/citadel-flint"

# ── Step 1: Version bump ────────────────────────────────────────────────────
if [ "$BUMP_TYPE" = "current" ]; then
  VERSION=$(node -p "require('./package.json').version")
  echo "[1/6] Keeping current version: ${VERSION}"
else
  VERSION=$(npm version "$BUMP_TYPE" --no-git-tag-version | tr -d 'v')
  echo "[1/6] Bumped version to: ${VERSION}"
fi

TAG="v${VERSION}-beta"
DATE=$(date +%Y-%m-%d)
TARBALL="flint-glass-web-${VERSION}.tar.gz"

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║  Flint Glass Web Release                 ║"
echo "  ║  Version: ${VERSION}                     "
echo "  ║  Tag:     ${TAG}                         "
echo "  ║  Date:    ${DATE}                        "
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ── Step 2: Type check ──────────────────────────────────────────────────────
echo "[2/6] Type checking..."
npx tsc -b --force
echo "  TSC: 0 errors"

# ── Step 3: Build web frontend ──────────────────────────────────────────────
echo "[3/6] Building web frontend..."
npx vite build --config vite.config.web.ts --mode production
echo "  Frontend built → dist-web/"

# ── Step 4: Assemble release package ────────────────────────────────────────
echo "[4/6] Assembling release package..."

STAGE_DIR=$(mktemp -d)/flint-glass-web-${VERSION}
mkdir -p "$STAGE_DIR"

# Frontend SPA
cp -R dist-web "$STAGE_DIR/dist-web"

# Server (Express + WebSocket)
cp -R server "$STAGE_DIR/server"

# Shared modules (brand, CIEDE2000, IPC validators, MRS weights)
cp -R shared "$STAGE_DIR/shared"

# MCP governance engine (source — runs via tsx at dev time)
mkdir -p "$STAGE_DIR/flint-mcp"
cp -R flint-mcp/src "$STAGE_DIR/flint-mcp/src"
cp flint-mcp/package.json "$STAGE_DIR/flint-mcp/package.json"
[ -f flint-mcp/tsconfig.json ] && cp flint-mcp/tsconfig.json "$STAGE_DIR/flint-mcp/tsconfig.json" || true

# Demo project for first-launch
mkdir -p "$STAGE_DIR/build-resources"
cp -R build-resources/demo-project "$STAGE_DIR/build-resources/demo-project"

# Config files
cp package.json "$STAGE_DIR/package.json"
cp tsconfig.json "$STAGE_DIR/tsconfig.json"
cp tsconfig.node.json "$STAGE_DIR/tsconfig.node.json"
cp tsconfig.app.json "$STAGE_DIR/tsconfig.app.json"
cp vite.config.web.ts "$STAGE_DIR/vite.config.web.ts"
[ -f .flint/policy.json ] && mkdir -p "$STAGE_DIR/.flint" && cp .flint/policy.json "$STAGE_DIR/.flint/policy.json" || true
[ -f .flint/design-tokens.json ] && cp .flint/design-tokens.json "$STAGE_DIR/.flint/design-tokens.json" || true

# Quick-start README
cat > "$STAGE_DIR/README.md" << README_EOF
# Flint Glass Web v${VERSION}

Governance observability for AI-generated UI code.

## Quick Start

\`\`\`bash
npm install
npm run dev:web
# Open http://localhost:4200
\`\`\`

## What's Included

| Directory | Purpose |
|-----------|---------|
| \`dist-web/\` | Built frontend SPA (React 19 + Tailwind 4) |
| \`server/\` | Express + WebSocket backend (94 IPC handlers) |
| \`flint-mcp/\` | MCP governance engine (54 tools) |
| \`shared/\` | Brand config, color math, IPC validators |
| \`build-resources/\` | Demo project for first-launch |

## Requirements

- Node.js 22+
- npm 10+

## Build Info

- Version: ${VERSION}
- Built: ${DATE}
- Vite 7.3 | React 19 | TypeScript 5.9
README_EOF

echo "  Package assembled ($(du -sh "$STAGE_DIR" | cut -f1))"

# ── Step 5: Create tarball ──────────────────────────────────────────────────
echo "[5/6] Creating tarball..."
PARENT_DIR=$(dirname "$STAGE_DIR")
cd "$PARENT_DIR"
tar czf "$ROOT/$TARBALL" "flint-glass-web-${VERSION}"
cd "$ROOT"
rm -rf "$PARENT_DIR"

TARBALL_SIZE=$(du -sh "$TARBALL" | cut -f1)
echo "  ${TARBALL} (${TARBALL_SIZE})"

# ── Step 6: Publish to GitHub ───────────────────────────────────────────────
echo "[6/6] Publishing to GitHub..."

# Delete existing release with same tag if present
gh release delete "$TAG" --repo "$GH_REPO" --yes 2>/dev/null || true

# Count MCP tools for release notes
TOOL_COUNT=$(grep -c 'server.tool' flint-mcp/src/server.ts 2>/dev/null || echo "54")

# Write release notes to temp file (avoids heredoc quoting issues)
NOTES_FILE=$(mktemp)
cat > "$NOTES_FILE" <<NOTES_EOF
## Flint Glass Web ${TAG}

Full web build of Flint Glass — governance observability for AI-generated UI code.

### Install (pick one)

**Docker (recommended):**
\`\`\`bash
docker run -p 4201:4201 ghcr.io/jtiem/flint-glass:${TAG}
\`\`\`

**From source:**
\`\`\`bash
tar xzf ${TARBALL}
cd flint-glass-web-${VERSION}
npm install
npm run dev:web
\`\`\`

### Included
- Glass UI: 3-panel layout, infinite canvas, LivePreview
- Express + WebSocket server: 94 IPC handlers
- MCP governance engine: ${TOOL_COUNT} tools (Mithril, Warden, Gate, Sentry, Mason, and more)
- Demo project: bundled for first-launch experience

### Build info
- Version: ${VERSION} | Built: ${DATE}
- Node 22 | Vite 7.3 | React 19 | TypeScript 5.9
NOTES_EOF

gh release create "$TAG" \
  --repo "$GH_REPO" \
  --title "Flint Glass Web ${TAG}" \
  --prerelease \
  --notes-file "$NOTES_FILE" \
  "$TARBALL"

rm -f "$NOTES_FILE"

# Clean up local tarball
rm -f "$TARBALL"

# ── Step 7 (optional): Docker image ────────────────────────────────────────
DOCKER_IMAGE="ghcr.io/jtiem/flint-glass"

if command -v docker &>/dev/null; then
  echo "[7/7] Building Docker image..."
  docker build -t "${DOCKER_IMAGE}:${TAG}" -t "${DOCKER_IMAGE}:latest" .

  # Push to GitHub Container Registry (requires ghcr.io auth)
  if docker push "${DOCKER_IMAGE}:${TAG}" 2>/dev/null; then
    docker push "${DOCKER_IMAGE}:latest" 2>/dev/null || true
    DOCKER_STATUS="pushed to ghcr.io"
  else
    DOCKER_STATUS="built locally (push manually: docker push ${DOCKER_IMAGE}:${TAG})"
  fi
else
  DOCKER_STATUS="skipped (Docker not installed)"
fi

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║  Release published!                      ║"
echo "  ║                                          ║"
echo "  ║  GitHub: https://github.com/${GH_REPO}/releases/tag/${TAG}"
echo "  ║  Docker: ${DOCKER_STATUS}"
echo "  ╚══════════════════════════════════════════╝"
echo ""
