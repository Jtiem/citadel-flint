#!/usr/bin/env bash
# build-beta.sh — Produce a beta build with expiry + telemetry baked in.
#
# Computes FLINT_BETA_EXPIRY and FLINT_BETA_BUILD_ID once and exports them so
# BOTH the vite build (inlines them into the main-process bundle via define:)
# AND electron-builder see the same values.
#
# Accepts extra args that get passed to electron-builder, e.g.:
#   ./scripts/build-beta.sh --mac
#   ./scripts/build-beta.sh --mac --dir
#   ./scripts/build-beta.sh --publish always
#
# Environment (optional — set these before running):
#   FLINT_BETA_DAYS                — days until expiry (default: 60)
#   FLINT_TELEMETRY_URL            — Cloudflare Worker endpoint
#   FLINT_TELEMETRY_SECRET         — shared secret for the Worker
#   FLINT_FEEDBACK_GITHUB_TOKEN    — PAT with issues:write on lunar-elevator-bridge

set -euo pipefail

DAYS="${FLINT_BETA_DAYS:-60}"
VERSION="$(node -p "require('./package.json').version")"
DATE_TAG="$(date +%Y%m%d)"

export FLINT_BETA_EXPIRY="$(node -p "new Date(Date.now()+${DAYS}*864e5).toISOString().split('T')[0]+'T00:00:00Z'")"
export FLINT_BETA_BUILD_ID="beta-${VERSION}-${DATE_TAG}"

echo "──────────────────────────────────────────────"
echo "  Flint Beta Build"
echo "──────────────────────────────────────────────"
echo "  Build ID  : ${FLINT_BETA_BUILD_ID}"
echo "  Expires   : ${FLINT_BETA_EXPIRY}  (${DAYS} days)"
echo "  Telemetry : ${FLINT_TELEMETRY_URL:-<not set — events will queue locally>}"
echo "  Feedback  : ${FLINT_FEEDBACK_GITHUB_TOKEN:+configured}${FLINT_FEEDBACK_GITHUB_TOKEN:-<no GitHub token — feedback saved locally only>}"
echo "──────────────────────────────────────────────"

# Vite bakes process.env.FLINT_* into the main-process bundle at build time
# (see vite.config.ts → electron main entry → define:).
#
# We deliberately bypass `npm run build` (which runs `tsc -b` first) and call
# vite directly. Historically the repo had pre-existing strict-mode TSC
# errors that made `tsc -b` slow and noisy; that baseline was driven to 0
# on 2026-04-26 (see commit chore(tsc): drive baseline 505 → 0 errors). Even
# so the build script keeps the explicit vite invocation: vite/esbuild
# transpilation is what actually produces the runtime artifacts, and we
# don't want a future TSC regression to block a beta cut.
#
# Two vite builds run here:
#   1. Electron build (vite.config.ts) — produces dist/ (legacy renderer,
#      preserved for npm run dev) AND dist-electron/ (main + preload bundles
#      with FLINT_BETA_* env vars baked in).
#   2. Web build (vite.config.web.ts) — produces dist-web/, the React SPA
#      that the embedded Express server serves to the BrowserWindow at runtime.
#      THIS is what testers see.
npx vite build --mode production
# Clear vite's dep-optimizer cache between builds — vite-plugin-electron's
# config from the first run can leave stale resolutions that break the SPA
# build (e.g. "Missing './internal' specifier in 'vite' package"). Each
# vite config needs a clean slate.
rm -rf node_modules/.vite
npx vite build --mode production --config vite.config.web.ts

# Bundle the web server (server/cli.ts → dist-server/cli.mjs). This is what
# the Electron main process spawns at runtime to serve the SPA + 94 IPC handlers.
npm run build:server

# Ensure shared/*.js exists. flint-mcp/dist/* uses `../../../shared/X.js` paths
# at runtime, and those .js files are produced by `tsc -b` (gitignored). If we
# skipped the implicit tsc build, the .app would ship an empty shared/ and the
# spawned MCP child process would crash with ERR_MODULE_NOT_FOUND. Build only
# what's missing rather than re-running the full root tsc.
if [ ! -f shared/brand.js ] || [ ! -f shared/fixture-schema.js ]; then
  echo "→ Compiling shared/*.ts (missing .js artifacts)"
  npx tsc -b tsconfig.app.json
fi

npx electron-builder --config electron-builder.yml "$@"
