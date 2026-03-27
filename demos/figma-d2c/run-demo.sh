#!/usr/bin/env bash
# run-demo.sh — Offline D2C demo runner
# Passes a pre-built Figma payload through the flint_design_to_code MCP tool
# without requiring a Figma account or active connection.
#
# Usage:
#   ./run-demo.sh [payload] [library]
#
# Examples:
#   ./run-demo.sh payloads/hero-banner.json shadcn
#   ./run-demo.sh payloads/account-settings.json mui
#   ./run-demo.sh payloads/landing-page.json tailwind
#   ./run-demo.sh payloads/account-settings.json primeng

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD="${1:-payloads/hero-banner.json}"
LIBRARY="${2:-shadcn}"

# Resolve payload path relative to this script
if [[ "$PAYLOAD" != /* ]]; then
  PAYLOAD="$SCRIPT_DIR/$PAYLOAD"
fi

if [[ ! -f "$PAYLOAD" ]]; then
  echo "Error: payload file not found: $PAYLOAD"
  echo ""
  echo "Available payloads:"
  ls "$SCRIPT_DIR/payloads/"
  exit 1
fi

VALID_LIBRARIES="shadcn mui primeng tailwind"
if ! echo "$VALID_LIBRARIES" | grep -wq "$LIBRARY"; then
  echo "Error: unsupported library '$LIBRARY'"
  echo "Supported: $VALID_LIBRARIES"
  exit 1
fi

PAYLOAD_NAME="$(basename "$PAYLOAD" .json)"
echo "D2C Demo: $PAYLOAD_NAME -> $LIBRARY"
echo "---"

# Find the MCP server entry point
MCP_ENTRY="$SCRIPT_DIR/../../flint-mcp/dist/server.js"
if [[ ! -f "$MCP_ENTRY" ]]; then
  echo "Note: flint-mcp not built. Building now..."
  (cd "$SCRIPT_DIR/../../flint-mcp" && npm run build --if-present 2>/dev/null || true)
fi

# If the MCP server is available, call it directly via Node
if [[ -f "$MCP_ENTRY" ]]; then
  node - <<NODE_SCRIPT
const fs = require('fs');
const path = require('path');

// Load the payload
const payloadPath = '$PAYLOAD';
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const payloadStr = JSON.stringify(payload);

// Dynamic import (ESM)
import('$MCP_ENTRY').then(async ({ handleDesignToCode }) => {
  if (typeof handleDesignToCode !== 'function') {
    console.log('handleDesignToCode not directly exported — use the MCP tool call pattern below.');
    printMcpInstructions();
    return;
  }
  const result = await handleDesignToCode(
    { figmaPayload: payloadStr, library: '$LIBRARY' },
    { projectRoot: process.cwd() }
  );
  console.log('Status:', result.status);
  console.log('Library:', result.library);
  console.log('Component:', result.component.name);
  console.log('');
  console.log('--- Generated Code ---');
  console.log(result.component.code);
  if (result.themeFile) {
    console.log('');
    console.log('--- Theme File (' + result.themeFile.filename + ') ---');
    console.log(result.themeFile.code);
  }
}).catch(() => {
  printMcpInstructions();
});

function printMcpInstructions() {
  const payload = JSON.parse(fs.readFileSync('$PAYLOAD', 'utf8'));
  console.log('To run this demo via MCP, call flint_design_to_code with:');
  console.log('');
  console.log('  flint_design_to_code(');
  console.log('    figmaPayload: <contents of $PAYLOAD>,');
  console.log('    library: "$LIBRARY"');
  console.log('  )');
  console.log('');
  console.log('Payload name:', payload.name || '(unnamed)');
  console.log('Payload type:', payload.type || '(unknown)');
  console.log('Top-level children:', (payload.children || []).length);
}
NODE_SCRIPT

else
  # Fallback: print the MCP tool call template the user can paste into their IDE
  echo "flint-mcp not built. Here is the MCP tool call to run in your IDE:"
  echo ""
  echo "  flint_design_to_code("
  echo "    figmaPayload: $(cat "$PAYLOAD" | head -3)..."
  echo "    library: \"$LIBRARY\""
  echo "  )"
  echo ""
  echo "Or load the full payload programmatically:"
  echo ""
  echo "  const payload = fs.readFileSync('$PAYLOAD', 'utf8');"
  echo "  flint_design_to_code({ figmaPayload: payload, library: '$LIBRARY' })"
  echo ""
  echo "Reference output for this payload + library:"
  EXPECTED="$SCRIPT_DIR/expected-output/$LIBRARY"
  if [[ -d "$EXPECTED" ]]; then
    ls "$EXPECTED"
  else
    echo "  (no reference output for library '$LIBRARY')"
  fi
fi
