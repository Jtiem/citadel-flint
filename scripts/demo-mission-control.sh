#!/usr/bin/env zsh
# ─────────────────────────────────────────────────────────────────────────────
#  Flint "Mission Control" — Demo + Integration Test Script
#
#  What this does:
#    1. Verifies the web server is running
#    2. Walks through all 5 demo beats by simulating VS Code file navigation
#       (writes .flint/ide-active-file.json, exactly what the extension does)
#    3. Pauses between beats so you can watch Glass react in real time
#
#  Usage:
#    Terminal 1:  npm run dev:web          (start the web server + Glass)
#    Browser:     open http://localhost:4200
#    Terminal 2:  zsh scripts/demo-mission-control.sh
#
#  Flags:
#    --auto       Skip pauses — runs all beats automatically (for CI / timing tests)
#    --beat N     Run only beat N (1-5)
#    --reset      Just write the reset file and exit (clears Glass state)
#    --debug      Print server sync state after each beat (requires debug endpoint)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Ensure standard system paths are available (needed in some shell environments)
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# ── Config ────────────────────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLINT_DIR="$ROOT/.flint"
SYNC_FILE="$FLINT_DIR/ide-active-file.json"
SERVER_URL="${FLINT_URL:-http://localhost:4201}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Flags
AUTO=false
ONLY_BEAT=""
RESET_ONLY=false
DEBUG=false

for arg in "$@"; do
  case "$arg" in
    --auto)   AUTO=true ;;
    --reset)  RESET_ONLY=true ;;
    --beat*)  ONLY_BEAT="${arg#--beat}" ;;
    --debug)  DEBUG=true ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
header() {
  echo ""
  echo "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo "${BOLD}${BLUE}  $1${RESET}"
  echo "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}

beat() {
  echo ""
  echo "${BOLD}${CYAN}  Beat $1 — $2${RESET}"
  echo "${DIM}  $3${RESET}"
}

navigate() {
  local label="$1"
  local path="$2"
  local rel="${path#$ROOT/}"

  /bin/mkdir -p "$FLINT_DIR"
  printf '{ "path": "%s" }\n' "$path" > "$SYNC_FILE"

  echo ""
  echo "  ${GREEN}→ IDE navigated to:${RESET} ${BOLD}$rel${RESET}"
  echo "  ${DIM}Glass should update within 1 second...${RESET}"
}

pause() {
  local msg="${1:-Press ENTER to continue to the next beat}"
  if [ "$AUTO" = true ]; then
    echo "  ${DIM}(auto: waiting ${2:-8}s)${RESET}"
    sleep "${2:-8}"
  else
    echo ""
    echo "  ${YELLOW}$msg${RESET}"
    read -r
  fi
}

check_server() {
  echo ""
  echo "${DIM}  Checking web server at $SERVER_URL ...${RESET}"
  if /usr/bin/curl -sf "$SERVER_URL" -o /dev/null --connect-timeout 3 2>/dev/null; then
    echo "  ${GREEN}✓ Server is running${RESET}"
  else
    echo ""
    echo "  ${RED}✗ Cannot reach $SERVER_URL${RESET}"
    echo "  ${YELLOW}Start the web server first:  npm run dev:web${RESET}"
    echo ""
    exit 1
  fi

  # Wait for at least one Glass browser tab to be connected via WebSocket.
  # Without this, broadcasts go to 0 clients and are lost.
  echo "${DIM}  Waiting for Glass browser to connect ...${RESET}"
  local attempts=0
  while [ $attempts -lt 30 ]; do
    local ws_clients=$(/usr/bin/curl -sf http://localhost:4201/api/debug/ide-sync 2>/dev/null \
      | /usr/bin/python3 -c "import sys,json; print(json.load(sys.stdin).get('wsClients',0))" 2>/dev/null)
    if [ "${ws_clients:-0}" -gt 0 ]; then
      echo "  ${GREEN}✓ Glass connected (${ws_clients} client(s))${RESET}"
      return
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  echo "  ${RED}✗ No Glass browser tab connected after 30s${RESET}"
  echo "  ${YELLOW}Open http://localhost:4200 in your browser${RESET}"
  exit 1
}

open_project() {
  echo "  ${DIM}  Opening project in Glass (${ROOT##*/})...${RESET}"
  /usr/bin/curl -sf -X POST http://localhost:4201/api/ipc \
    -H 'Content-Type: application/json' \
    -d "{\"channel\":\"project:openPath\",\"args\":[\"$ROOT\"]}" \
    -o /dev/null 2>/dev/null && echo "  ${GREEN}✓ Project opened${RESET}" || echo "  ${DIM}  (Glass will open project automatically)${RESET}"
  sleep 2
}

debug_sync() {
  if [ "$DEBUG" = true ]; then
    echo ""
    echo "  ${DIM}[debug] Server sync state:${RESET}"
    /usr/bin/curl -sf http://localhost:4201/api/debug/ide-sync 2>/dev/null \
      | /usr/bin/python3 -c "import sys,json; d=json.load(sys.stdin); print(f'    root: {d[\"activeProjectRoot\"]}\n    lastPath: {d[\"lastPath\"]}')" \
      2>/dev/null || echo "  ${DIM}  (debug endpoint not available)${RESET}"
  fi
}

# ── Reset-only mode ───────────────────────────────────────────────────────────
if [ "$RESET_ONLY" = true ]; then
  /bin/rm -f "$SYNC_FILE"
  echo "${GREEN}✓ Cleared .flint/ide-active-file.json — Glass state reset${RESET}"
  exit 0
fi

# ── Preamble ──────────────────────────────────────────────────────────────────
header "Flint — Mission Control Demo"
echo ""
echo "  ${BOLD}Setup:${RESET}"
echo "  • Flint Glass open in browser  →  http://localhost:4200"
echo "  • This terminal simulates VS Code file navigation"
echo "  • Watch Glass react in real time — no clicks needed"
echo ""
echo "  ${DIM}Each beat writes .flint/ide-active-file.json — exactly what the"
echo "  VS Code extension does when you switch files.${RESET}"

check_server
open_project

if [ "$AUTO" = false ]; then
  echo ""
  echo "  ${YELLOW}Ready? Switch to Glass in your browser, then press ENTER to start.${RESET}"
  read -r
fi

# ── Beat 1: The Reveal ────────────────────────────────────────────────────────
run_beat_1() {
  beat 1 "The Reveal" "A file called 'compliant' — is it?"
  navigate "banner-compliant.tsx" "$ROOT/demos/01-rag-ui-builder/banner-compliant.tsx"
  echo ""
  echo "  ${DIM}Look at the Governance tab in Glass:${RESET}"
  echo "  • Health score: not A"
  echo "  • Export gate: BLOCKED"
  echo "  • Punchline: 'This file is called compliant.'"
  pause "Watch Glass react, then press ENTER to escalate →"
  debug_sync
}

# ── Beat 2: The Escalation ────────────────────────────────────────────────────
run_beat_2() {
  beat 2 "The Escalation" "31 violations. Grade F. This is AI output, unaudited."
  navigate "violating-ux.tsx" "$ROOT/demos/04-sentinel/violating-ux.tsx"
  echo ""
  echo "  ${DIM}Glass should show:${RESET}"
  echo "  • 31 violations (18 critical a11y)"
  echo "  • Grade: ${RED}F${RESET}"
  echo "  • StatusBar: ${RED}BLOCKED${RESET}"
  echo ""
  echo "  ${DIM}Don't fix it yet. Let the tension sit.${RESET}"
  pause "When you're ready to show the science, press ENTER →"
  debug_sync
}

# ── Beat 3: The Science ───────────────────────────────────────────────────────
run_beat_3() {
  beat 3 "The Science" "Not guessing — measuring. ΔE to 4 decimal places."
  navigate "drift-component.tsx" "$ROOT/demos/03-mithril-shadow-audit/drift-component.tsx"
  echo ""
  echo "  ${DIM}Glass should show:${RESET}"
  echo "  • Mithril violations (color drift)"
  echo "  • ΔE 4.6 on the header — a human will notice"
  echo "  • ΔE 8.1 on the badge — obvious to anyone"
  echo ""
  echo "  ${DIM}Quote: 'The same algorithm as ISO print calibration.'${RESET}"
  pause "Ready to fix? Press ENTER — then type in Claude Code →"
  debug_sync
}

# ── Beat 4: The Fix ───────────────────────────────────────────────────────────
run_beat_4() {
  beat 4 "The Fix" "Two commands. Two categories. One governance system."
  echo ""
  echo "  ${BOLD}Now, in Claude Code (VS Code), type:${RESET}"
  echo "  ${CYAN}  \"Fix the color drift in drift-component.tsx\"${RESET}"
  echo ""
  echo "  ${DIM}Watch Glass: violations disappear, score rises, gate clears.${RESET}"
  echo "  ${DIM}Then navigate back to violating-ux.tsx and say:${RESET}"
  echo "  ${CYAN}  \"Fix the accessibility issues in violating-ux.tsx\"${RESET}"
  echo ""
  echo "  ${DIM}Two fixes. Two categories. Same elegant flow.${RESET}"

  if [ "$AUTO" = true ]; then
    # In auto mode, simulate the fix by navigating between files
    echo ""
    echo "  ${DIM}(auto mode: simulating navigation post-fix)${RESET}"
    sleep 3
    navigate "drift-component.tsx (post-fix)" "$ROOT/demos/03-mithril-shadow-audit/drift-component.tsx"
    sleep 2
    navigate "violating-ux.tsx (post-fix)" "$ROOT/demos/04-sentinel/violating-ux.tsx"
    sleep 3
    debug_sync
  else
    pause "When the fixes land in Glass, press ENTER for the closing beat →"
    debug_sync
  fi
}

# ── Beat 5: The Gate ──────────────────────────────────────────────────────────
run_beat_5() {
  beat 5 "The Gate" "Nothing ships until the gate opens."
  echo ""
  echo "  ${DIM}StatusBar should now read:${RESET}"
  echo "  ${GREEN}  ✓ Export Ready${RESET}"
  echo ""
  echo "  ${BOLD}Closing line:${RESET}"
  echo "  'The gate doesn't care who wrote the code — human or AI."
  echo "   If it passes governance, it ships. If it doesn't, it waits.'"
  echo ""
  echo "  ${DIM}End on the green gate.${RESET}"

  if [ "$AUTO" = false ]; then
    echo ""
    echo "  ${GREEN}${BOLD}Demo complete.${RESET}"
  fi
  debug_sync
}

# ── Runner ────────────────────────────────────────────────────────────────────
if [ -n "$ONLY_BEAT" ]; then
  "run_beat_$ONLY_BEAT"
else
  run_beat_1
  run_beat_2
  run_beat_3
  run_beat_4
  run_beat_5
fi

# ── Results ───────────────────────────────────────────────────────────────────
echo ""
echo "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo "${BOLD}${GREEN}  Mission Control — Complete${RESET}"
echo "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "  ${DIM}Sync file written to: .flint/ide-active-file.json${RESET}"
echo "  ${DIM}To reset Glass state: zsh scripts/demo-mission-control.sh --reset${RESET}"
echo "  ${DIM}To re-run one beat:   zsh scripts/demo-mission-control.sh --beat 2${RESET}"
echo "  ${DIM}To run automatically: zsh scripts/demo-mission-control.sh --auto${RESET}"
echo ""
