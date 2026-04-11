# IDE-Glass Sync UX — Design Spec

**Date:** 2026-04-11
**Status:** APPROVED
**Feature Budget Gates:** All 6 passed
**Citadel Name:** Herald (IDE ↔ Glass handshake)

## Problem

The IDE→Glass file sync pipeline works (verified E2E, 2-second latency), but has **zero discoverability**. Users don't know the feature exists, can't tell if it's working, and have no way to intentionally send a file to Glass.

## Design Principles

1. **Show outcomes, not plumbing** — "Glass is following your editor," not "WebSocket connected to port 4201"
2. **Discoverable where people already look** — context menus, status bars, not docs
3. **Progressive disclosure** — hidden until relevant, never nags unconfigured users
4. **Plain language** — designed for UX designers, not backend engineers

## Two Modes

| Mode | Gesture | When |
|------|---------|------|
| **Push** (intentional) | Right-click → "Open in Flint Glass" | User deliberately sends a file |
| **Follow** (ambient) | Switch files normally, Glass follows | Passive auto-sync |

Both use the same mechanism (`ide-active-file.json`). Push is how users discover the feature. Follow is what keeps them productive.

---

## Layer 1: VS Code Context Menu — "Find it where you look"

**Priority:** P0 — highest impact, most discoverable

### Commands

| Command ID | Title | Icon |
|------------|-------|------|
| `flint.openInGlass` | Open in Flint Glass | `$(eye)` |

### Menu Placements

| Menu | When | Group |
|------|------|-------|
| `explorer/context` | File is `.tsx/.ts/.jsx/.js` | `navigation` |
| `editor/context` | Active editor is a source file | `navigation` |
| `editor/title/context` | Tab is a source file | `navigation` |

### Keyboard Shortcut

`Cmd+Shift+G` (Mac) / `Ctrl+Shift+G` (Windows/Linux)

### Behavior

1. Write `{ path, ts }` to `.flint/ide-active-file.json` (same as auto-follow)
2. If Glass web server is running (port 4201 reachable): done — Glass picks it up in 1-2s
3. If Glass is NOT running: show VS Code notification with "Start Glass" button
4. Status bar briefly flashes "Sent to Glass" (2s, then reverts)

### Files

- `flint-vscode/package.json` — command + menu registrations
- `flint-vscode/src/extension.ts` — command handler

---

## Layer 2: Glass StatusBar Chip — "See it working"

**Priority:** P1 — ongoing confidence indicator

### Pattern

Clone the Figma status chip already in `StatusBar.tsx`.

### States

| State | Dot | Label | Trigger |
|-------|-----|-------|---------|
| **Hidden** | — | — | No IDE activity ever detected |
| **Connected** | Emerald | IDE | File change received in last 30s |
| **Idle** | Zinc | IDE | No file change for 60s+ |
| **Interrupted** | Amber | IDE | Extension reported write failure |

### Progressive Disclosure

Chip is HIDDEN until the first `flint:ide-file-selected` event. Add `ideSyncActive` boolean to `canvasStore`. Once true, chip is permanently visible for the session.

### Popover (on click)

- Status line: "Connected — following your editor" / "Idle — waiting for file changes" / "Interrupted — check that VS Code is open"
- Last file: `PatientForm.tsx` (relative name, timestamp)
- Link: "Set up IDE sync" → opens Setup Wizard

### Files

- `src/components/editor/StatusBar.tsx` — new chip + popover
- `src/store/canvasStore.ts` — `ideSyncActive` boolean
- `src/hooks/useIDEFileSync.ts` — flip `ideSyncActive` on first event

---

## Layer 3: First-Encounter Tooltip — "Notice the magic"

**Priority:** P1 — one-time contextual education

### Trigger

First time `useIDEFileSync` receives a file change event.

### Content

"Glass is following your editor. Switch files in VS Code and the preview updates automatically."

### Implementation

- Use existing `useOnboardingTooltip` hook with key `'ide-file-sync'`
- Anchor near the StatusBar IDE chip (which just appeared via progressive disclosure)
- Dismiss: X button (standard `TabUnlockTooltip` pattern)
- Shows once per user (localStorage persistence)

### Files

- `src/hooks/useIDEFileSync.ts` — trigger tooltip
- Reuse `src/components/ui/TabUnlockTooltip.tsx`

---

## Layer 4: Setup Wizard Step — "Learn it exists"

**Priority:** P2 — first-launch education

### Where

New step in Garrison wizard: `ide-sync`, between `verify` and `done`.

### Content

"Your IDE and Glass are now connected. When you switch files in [IDE name], Glass follows automatically — your preview updates within 2 seconds."

### Condition

Only shown when detected IDE is VS Code or Cursor.

### Files

- `src/components/ui/SetupWizard.tsx` — new step

---

## Layer 5: Command Palette — "Find it again later"

**Priority:** P2 — re-accessible

### Entry

"IDE Sync Status" → focuses the StatusBar IDE chip popover

### Files

- `src/components/ui/CommandPalette.tsx` — new entry

---

## What NOT to do

- No "IDE not connected" nag for users who never installed the extension
- No toast on every file sync event
- No new sidebar panels
- No blocking banners
- No LaunchScreen tile for IDE sync (that's a runtime concern, not project initiation)

---

## Implementation Order

1. **VS Code context menu** (P0) — `flint-vscode/package.json` + `extension.ts`
2. **Glass StatusBar chip** (P1) — `StatusBar.tsx` + `canvasStore.ts` + `useIDEFileSync.ts`
3. **First-encounter tooltip** (P1) — `useIDEFileSync.ts` + existing tooltip system
4. **Setup wizard step** (P2) — `SetupWizard.tsx`
5. **Command palette entry** (P2) — `CommandPalette.tsx`

## Research Sources

- React DevTools: tri-state toolbar icon (blue/red/grey) — gold standard for ambient status
- GitHub Copilot: status bar + click-for-details quick-pick
- Figma for VS Code: sidebar presence = connected, OAuth gate
- Storybook: blocking reconnection banner (rejected — wrong topology)
- Vercel: outcome-first panels (show results, not connections)
- Arc Browser: multiple entry points to the same feature
- Raycast: progressive walkthrough during companion setup
- Expo: terminal as status dashboard + QR code pairing (rejected — overkill)
