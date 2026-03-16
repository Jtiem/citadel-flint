# Plan: Make "Connect Figma" Instructions Best-in-Class

**Date:** 2026-03-15
**Scope:** LaunchScreen Figma setup + StatusBar Figma popover
**Philosophy:** Guide, don't document. The best instructions are the ones users don't need to read.

---

## Current Problems

### 1. Instructions assume context users don't have
- "Search for Bridge IDE in Figma Community" — plugin doesn't exist there yet
- No explanation of WHY a secret header is needed
- No indication of what "success" looks like until you notice a tiny green dot

### 2. No progressive disclosure
- All 4 steps shown at once — cognitive overload for a setup flow
- No distinction between "do once" steps and "do every time" steps

### 3. No feedback loop
- After clicking "Sync Variables" in Figma, user has to manually check the StatusBar
- No toast notification on successful connection
- No error message if connection fails

### 4. No troubleshooting
- Port 4545 busy? No guidance.
- Secret wrong? No guidance.
- Figma plugin can't reach localhost? No guidance.

### 5. StatusBar popover is passive
- Shows status but offers no actions
- No "Sync Now" button
- No "Copy endpoint" for quick paste into Figma plugin

---

## Design: Three-State Connection Flow

The Figma connection has three states. The UI should guide users through each:

### State 1: Never Connected (zinc dot)
**LaunchScreen:** Show "Connect Figma" button
**On click:** Show a streamlined setup wizard (not a wall of text)

### State 2: Connected but Stale (amber dot)
**StatusBar popover:** Show "Last synced 3 days ago" + "Sync Now" action
**Notification:** Passive amber toast after 72h

### State 3: Connected and Fresh (emerald dot)
**StatusBar popover:** Show token count, last sync, "Copy endpoint" utility

---

## Proposed Changes

### A. LaunchScreen — Replace text block with guided steps

Instead of showing all 4 steps at once, use a step-by-step flow with visual state:

```
┌─────────────────────────────────────────────┐
│  Connect Figma                               │
│                                              │
│  ● Step 1: Start Bridge                      │
│    Bridge's ingestion server is running.     │
│    ✓ Listening on 127.0.0.1:4545            │
│                                              │
│  ○ Step 2: Configure Figma plugin            │
│    In the Figma plugin, paste this endpoint: │
│    ┌──────────────────────────────────┐      │
│    │ http://127.0.0.1:4545     [Copy]│      │
│    └──────────────────────────────────┘      │
│    Secret header (x-bridge-secret):          │
│    ┌──────────────────────────────────┐      │
│    │ bridge-dev-secret-ph...   [Copy]│      │
│    └──────────────────────────────────┘      │
│                                              │
│  ○ Step 3: Sync                              │
│    Click "Sync Variables" in Figma.          │
│    Waiting for first sync...                 │
│                                              │
│  Troubleshooting                     [v]     │
│                                              │
└─────────────────────────────────────────────┘
```

**Key improvements:**
- Step 1 auto-completes (checks if ingestion server is running via IPC)
- Endpoint and secret have "Copy" buttons (no manual typing)
- Step 3 shows a live spinner until first webhook arrives
- Troubleshooting is collapsed by default (expandable)

### B. Auto-detect connection success

When the ingestion server receives its first POST /ingest:
- Fire `bridge:figma-connected` IPC event to renderer
- LaunchScreen Step 3 auto-completes with emerald check
- Toast notification: "Figma connected — {N} design tokens synced"
- Wizard closes after 2 seconds

### C. StatusBar popover — Add actions

Current: passive status display
Proposed: status + actions

```
┌─────────────────────────────────┐
│  Figma Connection          [×]  │
│                                 │
│  Server      Running ●          │
│  Last sync   2 minutes ago      │
│  Tokens      147                │
│                                 │
│  ─────────────────────────────  │
│  Endpoint  127.0.0.1:4545 [📋] │
│  Secret    bridge-dev...  [📋] │
│                                 │
│  ─────────────────────────────  │
│  [  Sync Now  ]  [Disconnect]   │
│                                 │
│  Need help? Setup guide ↗       │
└─────────────────────────────────┘
```

**Key improvements:**
- Copy buttons for endpoint and secret (one-click paste into Figma plugin)
- "Sync Now" button triggers a re-pull from Figma
- "Disconnect" stops the ingestion server
- "Setup guide" links back to the LaunchScreen wizard

### D. Troubleshooting section (collapsed)

```
▼ Troubleshooting

  Port 4545 is busy
  → Bridge will try ports 4546-4554 automatically.
    Current port: {activePort}

  Figma plugin can't reach localhost
  → Ensure the Figma desktop app (not browser) is running.
    Browser Figma sandboxes network requests.

  Secret mismatch
  → Set BRIDGE_SECRET env var before launching Bridge,
    then paste the same value in the Figma plugin.

  Tokens didn't appear
  → Check that your Figma file uses Variables (not Styles).
    Bridge syncs Variables → DTCG tokens.
```

### E. Error states

| Error | Current behavior | Proposed behavior |
|-------|-----------------|-------------------|
| Port 4545 busy | Silent fallback to 4546+ | Toast: "Figma server on port {port} (4545 was busy)" |
| Secret mismatch | HTTP 403, no Glass feedback | Toast: "Figma plugin sent wrong secret — check x-bridge-secret" |
| Malformed payload | HTTP 400, no Glass feedback | Toast: "Figma payload rejected — update plugin to latest version" |
| Connection lost (72h stale) | Dot turns amber, no notification | Ambient amber toast: "Figma hasn't synced in 3 days" |

---

## Implementation

### Files Changed

| File | Change | Agent |
|------|--------|-------|
| `src/components/ui/LaunchScreen.tsx` | Replace text block with step-by-step wizard | bridge-design-engineer |
| `src/components/editor/StatusBar.tsx` | Add copy buttons, Sync Now, Disconnect to popover | bridge-design-engineer |
| `electron/ingestion-server.ts` | Fire `bridge:figma-connected` on first ingest, expose `syncNow()` | bridge-electron-ipc |
| `electron/preload.ts` | Add `figma.syncNow()`, `figma.disconnect()`, `figma.onConnected()` | bridge-electron-ipc |
| `src/types/bridge-api.d.ts` | Extend FigmaAPI with new methods | bridge-state-architect |

### Not Changed

- No new stores (connection state is transient, lives in component useState)
- No new MCP tools (Figma connection is Glass-only UX)
- No new test files (extend existing LaunchScreen + StatusBar tests)

---

## Success Criteria

1. User can connect Figma in under 60 seconds with zero documentation reading
2. Every step has visual feedback (auto-check, spinner, toast)
3. Copy buttons eliminate all manual typing
4. Troubleshooting covers the 4 most common failure modes
5. StatusBar popover is actionable, not just informational
