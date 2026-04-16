# /connect — Figma Connection Setup

Connect your Figma project to Flint via OAuth. Handles authorization, first token pull, and registry seeding.

## Usage

- `/connect` — Start Figma OAuth flow and connect
- `/connect status` — Check current Figma connection status
- `/connect disconnect` — Disconnect from Figma

## Behavior

### /connect (default — new connection)

#### Step 1: Check existing connection

Call `flint_figma_connect` with action `status` to check if already connected.

If already connected, present:
```
Already connected to Figma.
**Last sync:** [timestamp]
**Status:** Connected

Run `/connect disconnect` first if you want to reconnect to a different file.
```

If not connected, proceed to Step 2.

#### Step 2: Start OAuth flow

Call `flint_figma_connect` with action `connect`.

This triggers the Alliance OAuth flow:
1. Opens browser for Figma authorization
2. Receives OAuth callback
3. Stores credentials via safeStorage (SEC.4)

Present: "Authorizing with Figma... Check your browser for the login prompt."

Wait for the OAuth flow to complete. On success: "Connected to Figma."

#### Step 3: First token pull

Once connected, automatically run the first sync:
1. Call `flint_sync_pull` to pull design tokens
2. Call `flint_extract_tokens` if Figma variables are available

Present:
```
## First Sync Complete

**Tokens pulled:** 42
**Categories:** color (18), spacing (8), typography (10), shadow (6)
**Conflicts:** 0
```

#### Step 4: Seed the registry

Call `flint_reindex_registry` to seed the Armory with project components + tokens.

Present: "Armory seeded with N components and M tokens. You're ready to go."

#### Step 5: Summary

```
## Figma Connected

**Status:** Connected via Alliance OAuth
**Tokens:** 42 synced to design-tokens.json
**Registry:** Seeded and indexed

Next steps:
- `/figma <url>` — Turn a Figma frame into code
- `/tokens pull` — Pull latest token changes
- `/tokens check` — Verify sync health
```

### /connect status

1. Call `flint_figma_connect` with action `status`
2. Present: connection state, last sync time, token count, staleness indicator

### /connect disconnect

1. Call `flint_figma_connect` with action `disconnect`
2. Confirm: "Disconnected from Figma. Local tokens are preserved. Run `/connect` to reconnect."

## Notes

- Uses Citadel vocabulary: Alliance (OAuth flow), Scout (token extraction), Envoy (sync), Armory (registry)
- Figma MCP is the only Figma integration path. No plugin setup required.
- OAuth credentials are encrypted via Electron safeStorage (SEC.4)
- Connection status is visible in the Glass StatusBar and via `flint://figma-connection` MCP resource

Arguments: $ARGUMENTS
