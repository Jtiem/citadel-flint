# COUNSEL.2.1 -- Defer Button in Glass

**Phase:** COUNSEL.2.1
**Status:** DRAFT
**Owner:** flint-architect
**Date:** 2026-03-31

---

## Situation Assessment

COUNSEL.2.1 is partially implemented. The GovernanceDashboard already has:
- Defer button on every Mithril and a11y violation row
- Inline form with reason textarea + duration radio (1 day / 1 week / 1 sprint / Manually)
- `submitDefer()` callback that calls `window.flintAPI.governance.deferViolation` or falls back to `window.flintAPI.deferViolation`
- Success confirmation with auto-dismiss after 4 seconds

What is **missing** (the actual scope of this contract):

| Gap | Severity | Description |
|-----|----------|-------------|
| **G1: ExportModal has no defer** | P0 | Zero defer buttons on any violation row in ExportModal. Users cannot snooze a blocking violation from the export gate. |
| **G2: Duration not persisted** | P1 | The GovernanceDashboard sends `duration` to `governance.deferViolation` but the IPC handler (`governance:defer-violation`) ignores it. The SQLite schema has no `duration` or `expires_at` column. Duration is cosmetic-only today. |
| **G3: governance.deferViolation not wired** | P1 | `flint-api.d.ts` declares `governance.deferViolation?(opts)` but the preload `governance` namespace does not expose it. The GovernanceDashboard's `submitDefer` silently falls through to the top-level `window.flintAPI.deferViolation` which has no duration param. |
| **G4: No post-defer visual state** | P2 | After deferring, the violation stays in the list unchanged. It should either be removed or visually dimmed with a "Deferred" badge. |
| **G5: Web build parity** | P2 | `server/index.ts` has the IPC handler but also lacks the duration column. Must stay in sync. |

---

## Scope

This contract addresses all 5 gaps. The implementation order is:

1. **Schema + IPC (G2, G3)** -- Add `duration` and `expires_at` columns, wire `governance.deferViolation` in preload
2. **ExportModal defer UI (G1)** -- Add defer buttons and inline form to ExportModal violation rows
3. **Post-defer visual state (G4)** -- Filter/dim deferred violations in both components
4. **Web parity (G5)** -- Mirror schema + handler changes in `server/index.ts`

---

## Impact Map

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `electron/main.ts` | MODIFY | flint-electron-ipc | Add `duration` and `expires_at` to `deferred_violations` DDL; update upsert prepared statement; compute `expires_at` from duration string; update `governance:defer-violation` handler signature |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | Add `deferViolation` to `governance` namespace; pass `duration` param |
| `src/types/flint-api.d.ts` | MODIFY | flint-electron-ipc | Make `governance.deferViolation` non-optional; align param shape |
| `src/components/ui/ExportModal.tsx` | MODIFY | flint-design-engineer | Add defer button + inline form to Mithril and a11y violation rows |
| `src/components/ui/GovernanceDashboard.tsx` | MODIFY | flint-design-engineer | After successful defer, remove violation from visible list (or dim with badge); fix fallback path to use governance namespace |
| `server/index.ts` | MODIFY | flint-electron-ipc | Mirror schema + handler changes for web build parity |
| `src/components/ui/__tests__/ExportModal.defer.test.tsx` | CREATE | flint-test-writer | Defer button render, form interaction, submit, success state |
| `src/components/ui/__tests__/GovernanceDashboard.defer.test.tsx` | CREATE | flint-test-writer | Post-defer visual state, duration persistence |
| `electron/__tests__/defer-ipc.test.ts` | CREATE | flint-test-writer | IPC handler accepts duration, computes expires_at, round-trip |

---

## Type Contracts

### DeferralFormState (renderer-side form state)

```typescript
interface DeferralFormState {
  reason: string
  duration: DeferDuration
}

type DeferDuration = '1 day' | '3 days' | '1 week' | '1 sprint' | 'Manually'
```

### DeferViolationPayload (IPC payload: renderer to main)

```typescript
interface DeferViolationPayload {
  filePath: string
  ruleId: string
  nodeId?: string
  reason?: string
  duration: DeferDuration
}
```

### DeferredViolationRow (SQLite row shape returned by get-deferred-violations)

```typescript
interface DeferredViolationRow {
  id: number
  file_path: string
  rule_id: string
  node_id: string | null
  reason: string | null
  duration: string | null
  session_id: string
  deferred_at: string
  expires_at: string | null
  resolved_at: string | null
}
```

---

## IPC Channels

No new channels. Existing channel `governance:defer-violation` is modified:

| Channel | Direction | Current Payload | New Payload | Return |
|---------|-----------|----------------|-------------|--------|
| `governance:defer-violation` | renderer -> main | `(filePath, ruleId, nodeId?, reason?)` | `(filePath, ruleId, nodeId?, reason?, duration?)` | `void` |
| `governance:get-deferred-violations` | renderer -> main | (none) | (none) | `DeferredViolationRow[]` |

The `governance.deferViolation` method in the preload's `governance` namespace must be wired to invoke `governance:defer-violation` with the full 5-param signature. The existing top-level `window.flintAPI.deferViolation` is deprecated but kept for backward compatibility.

---

## Store Contracts

No new store slices. All defer state is component-local (`useState` in GovernanceDashboard and ExportModal). The deferred violation list is fetched on-demand via IPC, not cached in a Zustand store.

Rationale: Defer is a low-frequency action (a few times per session). A store would add cross-component coupling for no benefit. Each component manages its own form open/close, reason text, and duration selection.

---

## Component Contracts

### ExportModal (modified)

New internal state:
- `deferFormOpen: Set<string>` -- which violation rows have the defer form expanded
- `deferReasons: Map<string, string>` -- per-row reason text
- `deferDurations: Map<string, DeferDuration>` -- per-row selected duration
- `deferSuccess: Set<string>` -- which rows show success confirmation
- `deferredIds: Set<string>` -- IDs of already-deferred violations (fetched on mount)

Behavior:
- On mount: fetch `governance:get-deferred-violations` to populate `deferredIds`
- Each Mithril and a11y violation row gets a "Defer" button (same pattern as GovernanceDashboard)
- Clicking "Defer" expands inline form below the row (reason + duration + submit/cancel)
- Submit calls `window.flintAPI.governance.deferViolation(payload)`
- On success: show confirmation, add to `deferredIds`, row shows "Deferred" badge instead of "Defer" button
- Deferred violations still count toward the block (they are deferred, not resolved) but the user can see which ones they have acknowledged

### GovernanceDashboard (modified)

Changes:
- After successful `submitDefer`, add the cardKey to a `deferredCardKeys` set
- Deferred rows show a "Deferred" badge instead of the "Defer" button
- Optional: visually dim deferred rows (reduce opacity to 0.5)
- Fix `submitDefer` to use `window.flintAPI.governance.deferViolation` as primary path (not fallback)

---

## Commandment Checklist

| # | Commandment | Applies | How |
|---|------------|---------|-----|
| 4 | Local-First Only | Yes | No external URLs. Defer writes to local SQLite + `.flint/deferred-violations.json`. |
| 5 | Accessibility is a Compiler Error | Yes | Defer form uses proper ARIA: `role="radiogroup"`, `aria-label`, `aria-expanded`. Does not bypass the a11y gate -- deferred a11y violations still block export. |
| 6 | The Gatekeeper Rule | Yes | Deferred violations still block export. Defer is an acknowledgment, not an override. The ExportModal defer is informational ("I know about this, will fix later") but does NOT unblock the gate. |
| 9 | Process Boundary | Yes | No `fs` in renderer. All persistence via IPC to main process. |
| 12 | Atomic Queuing | Partial | Defer writes go through SQLite prepared statements (atomic), not FileTransactionManager (which is for .tsx file writes). This is correct -- deferrals are metadata, not source code. |

---

## Implementation Order

**Group A (parallel -- flint-electron-ipc):**
1. Schema migration: add `duration TEXT`, `expires_at TEXT` columns to `deferred_violations` in `electron/main.ts`
2. Update upsert prepared statement to accept and store duration + computed expires_at
3. Update `governance:defer-violation` handler to accept 5th param
4. Wire `governance.deferViolation` in preload's governance namespace
5. Update `flint-api.d.ts` to make `governance.deferViolation` non-optional
6. Mirror all changes in `server/index.ts`

**Group B (parallel with A -- flint-test-writer):**
1. Write `electron/__tests__/defer-ipc.test.ts` -- IPC round-trip with duration
2. Write `src/components/ui/__tests__/ExportModal.defer.test.tsx` -- button render, form, submit
3. Write `src/components/ui/__tests__/GovernanceDashboard.defer.test.tsx` -- post-defer badge

**Group C (after A completes -- flint-design-engineer):**
1. Add defer UI to ExportModal (button + inline form + success state)
2. Update GovernanceDashboard post-defer visual state (badge + dim)
3. Fix GovernanceDashboard `submitDefer` to prefer `governance.deferViolation`

---

## Duration-to-ExpiresAt Computation

The main process computes `expires_at` from the duration string:

| Duration | expires_at |
|----------|-----------|
| `1 day` | `deferred_at + 1 day` |
| `3 days` | `deferred_at + 3 days` |
| `1 week` | `deferred_at + 7 days` |
| `1 sprint` | `deferred_at + 14 days` |
| `Manually` | `NULL` (no auto-expiry) |

The `expires_at` column is informational for now. A future phase (COUNSEL.2.2) can use it to auto-resurface expired deferrals.

---

## Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Deferred violations perceived as "dismissed" by users | Medium | 6 | Deferred violations still block export. ExportModal shows "Deferred" badge but keeps them in the blocked list. |
| SQLite ALTER TABLE on existing databases | Low | -- | Use `ALTER TABLE ... ADD COLUMN` which is safe for SQLite. Column defaults to NULL for existing rows. |
| GovernanceDashboard is already 1700+ lines | Low | -- | Defer UI is inline (no new component extraction needed). The form pattern already exists and is being reused. |
| Web build drift | Medium | -- | server/index.ts changes are in Group A, same PR. CI parity check catches drift. |

---

## Non-Goals

- **Auto-expiry enforcement** -- This contract adds `expires_at` but does not implement a watcher that auto-resurfaces expired deferrals. That is COUNSEL.2.2.
- **Deferred violations unblocking export** -- Deferring does NOT clear the export gate. It is an acknowledgment, not an override.
- **Defer from canvas overlay** -- Only GovernanceDashboard and ExportModal. No spatial/canvas integration.
- **MCP tool modification** -- `flint_defer_violation` already works. This contract only adds the Glass surface.
