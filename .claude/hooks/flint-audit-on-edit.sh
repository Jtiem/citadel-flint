#!/usr/bin/env bash
# PostToolUse hook: run Flint audit on .tsx/.jsx writes inside governed directories.
# Surfaces the result back to the model via PostToolUse additionalContext so the
# assistant can't claim UI work is done without seeing what Flint found.

set -uo pipefail

REPO_ROOT="/Users/tiemann/Lunar-Elevator-Bridge"
CLI="$REPO_ROOT/flint-ci/dist/cli.js"

emit_passthrough() { exit 0; }

input="$(cat)"
[ -z "$input" ] && emit_passthrough

tool_name=$(printf '%s' "$input" | jq -r '.tool_name // ""')
case "$tool_name" in
  Write|Edit|MultiEdit) ;;
  *) emit_passthrough ;;
esac

file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')
[ -z "$file_path" ] && emit_passthrough

case "$file_path" in
  *.tsx|*.jsx) ;;
  *) emit_passthrough ;;
esac

case "$file_path" in
  *"$REPO_ROOT/src/components/"*) ;;
  *"$REPO_ROOT/build-resources/"*) ;;
  *"/__tests__/"*) ;;
  *) emit_passthrough ;;
esac

[ -f "$file_path" ] || emit_passthrough
[ -f "$CLI" ] || emit_passthrough

audit_output=$(node "$CLI" audit "$file_path" --format terminal 2>&1)
audit_exit=$?

context="Flint audit on $file_path (exit=$audit_exit):

$audit_output

Per dogfood-flint rule: verify the report matches the file's intent before
declaring this work done. Run \`mcp__flint__flint_fix\` if violations are
auto-fixable, or update the file/docstring to match reality."

jq -nc --arg ctx "$context" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
