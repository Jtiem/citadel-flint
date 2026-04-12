#!/bin/bash
# scripts/dev-web.sh — Start Glass web server + Vite dev server
# Ensures both processes die on Ctrl+C (no stale port zombies).
#
# Self-hosting escape hatch:
#   By default, running this script from the Flint repo root activates
#   write-guard mode — all file writes to the source tree are blocked
#   (prevents the Vite HMR → reload → flash loop).
#
#   To point the server at a real project instead:
#     FLINT_DEV_WORKSPACE=/path/to/my-project npm run dev:web
#   or equivalently:
#     FLINT_DEV_WORKSPACE=~/my-app bash scripts/dev-web.sh
#
#   The FLINT_DEV_WORKSPACE directory must already exist.

# Kill any stale processes from previous runs
lsof -ti:4200 -ti:4201 -ti:4545 2>/dev/null | xargs kill -9 2>/dev/null
sleep 0.5

# Rebuild native modules if needed
npm rebuild better-sqlite3 2>/dev/null

# Start the Express+WS backend in the background
npx tsx server/cli.ts --no-open "$@" &
SERVER_PID=$!

# Kill the server when this script exits (Ctrl+C, terminal close, etc.)
trap "kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null; exit 0" SIGINT SIGTERM EXIT

# Start Vite in the foreground — you see the URL and HMR output directly
vite --config vite.config.web.ts --open
