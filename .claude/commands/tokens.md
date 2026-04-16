# /tokens — Token Sync Lifecycle

Manage design tokens in one command: pull from Figma, push local changes, emit to platform formats, or check sync health.

## Usage

- `/tokens pull` — Pull latest tokens from Figma (Envoy sync pull)
- `/tokens push` — Push local token changes to Figma (Envoy sync push)
- `/tokens emit [format]` — Emit tokens to platform format (css, tailwind, swift, kotlin). Defaults to all.
- `/tokens check` — Check sync health (drift detection)
- `/tokens map <library>` — Map DTCG tokens to a library format (shadcn, mui, primeng)
- `/tokens` (no args) — Show current token count and sync status

## Behavior

### /tokens pull

1. Call `flint_sync_pull` to fetch remote Figma token changes
2. If conflicts are detected, present them as a table:
   | Token | Local Value | Remote Value | Category |
   |-------|------------|--------------|----------|
3. Ask: "Resolve all conflicts using remote values?" If yes, call `flint_resolve_all` with strategy `remote`. If no, walk through each conflict with `flint_resolve_conflict`.
4. After resolution, show: "Pulled N tokens. M conflicts resolved."

### /tokens push

1. Call `flint_sync_push` to push local token changes to Figma
2. Present results: tokens pushed, any rejections
3. If push fails due to stale state, suggest: "Run `/tokens pull` first to sync, then try pushing again."

### /tokens emit

1. If a format argument was given (e.g., `css`, `tailwind`, `swift`, `kotlin`), call `flint_emit_tokens` with that format
2. If no format specified, call `flint_emit_tokens` for all platform formats
3. Present: files generated, output paths, token count per format

### /tokens check

1. Call `flint_sync_check` for CI-grade sync health
2. Present:
   - Sync status (IN_SYNC / DRIFT_DETECTED / DISCONNECTED)
   - Token drift count (SYNC-001 violations)
   - Orphaned tokens (SYNC-002 violations)
   - Last sync timestamp
3. If drift detected, suggest: "Run `/tokens pull` to sync, or `/audit <file>` to see which components are affected."

### /tokens map

1. Call `flint_map_tokens` with the specified library
2. Present the mapped token output and file path
3. Note any tokens that couldn't be mapped (no library equivalent)

### /tokens (no args)

1. Call `flint_get_context` to get current token state
2. Present: total token count, categories, sync status, last pull/push time
3. Suggest available subcommands

## Notes

- Uses Citadel vocabulary: Scout (extraction), Envoy (sync), Alliance (OAuth connection)
- Token sync requires an active Figma connection. If disconnected, suggest: "Run `/connect` to link your Figma project first."
- All token operations respect the project's `design-tokens.json` as the local source of truth

Arguments: $ARGUMENTS
