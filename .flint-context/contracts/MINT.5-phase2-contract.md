# MINT.5 Phase 2 Contract — Sync Action Surfaces

**Phase:** MINT.5 (Phase 2 of 4)
**Status:** APPROVED — Justin confirmed all 5 defaults on 2026-04-18 (sub-tab drift closure, bulk Resolve, asymmetric Push-confirm, direct empty-state copy, split toast/persistent-chip error surfacing)
**Owner:** flint-architect
**Date:** 2026-04-18
**Citadel Name:** Envoy (token sync) + Alliance (Figma connection) + Mint (token surface)
**Binds against:** `.flint-context/reviews/mint-{ux,code,security}-review-2026-04-17.md`
**Builds on:** `MINT.5-phase1.contract.ts` — imports `TokenDrift`, `HealthGrade`, `TokenHealthData`, `ChipSeverity`, `TokenApprovedEvent`, `TOKEN_VALUE_MAX_LENGTH`.

---

## Summary

Phase 1 fixed the Mint foundation — drift is live, health score is canonical, severity vocabulary is shared. Phase 2 turns Mint from an observability display into a workbench by routing the deferred A2/C1/C4 items from the UX review onto the Mint surface. No net-new engine work — every action wires to an MCP tool that already exists (`flint_sync_pull`, `flint_sync_push`, `flint_resolve_all`, `flint_sync_check`, `flint_figma_connect`).

Three work items:

1. **Sync action cluster (UX A2).** Add three trailing buttons to `TokenHealthBar` — Pull, Push, Resolve — each wired to the corresponding MCP tool via `window.flintAPI.mcp.callTool`. Disabled-state matrix drives affordance: no Figma connection → hide Pull/Push/Resolve and swap in a single "Connect Figma" CTA; no drift → disable Pull with tooltip "Up to date"; no local edits → disable Push; no pending conflicts → disable Resolve. State (idle | running | success | error) reuses `notificationStore.push` exactly as `FigmaConnectionPanel` already does today — we do not invent a new toast flow.

2. **Drift closure (UX C1) — sub-tab in `TokenGrid`.** `driftedTokens[]` has been live since Phase 1 but has no UI beyond a count. We add a third view mode to the existing `grid | list` radiogroup: **Drift (N)**. When selected, `TokenGrid` filters to the `driftedTokens` set and renders each row with a `TokenDriftRow` specialized cell — local value swatch, Figma value swatch, ΔE chip (if color), and a per-row "Pull this" button that calls `flint_sync_pull` with `{ scope: 'token', tokenPath }`. This is option (b) from the agent brief. Rationale: reuses `TokenGrid`, `SyncBadge`, and `SeverityChip` primitives already in the tree; avoids a new drawer component; fits a narrow sidebar layout; matches existing radiogroup pattern.

3. **Connect Figma empty state (UX C4 elevation).** When `flint://figma-connection` reports `status: 'disconnected'` AND `tokens.length === 0`, `TokenManager` replaces its current "No design tokens loaded" empty state with a `ConnectFigmaEmptyState` card — a single hero CTA that calls `flint_figma_connect` via `window.flintAPI.mcp.callTool`. The existing Import JSON button becomes a text link ("or import a tokens JSON file"). This elevates the FirstSyncPrompt concern raised in UX C4 by making the connection itself the primary first-run action.

Phase 2 does **not** touch OAuth internals, does **not** modify sync engine logic, and does **not** add new MCP tools. The entire scope is renderer UI wiring.

---

## Open Questions for Justin

These block Phase 2 implementation. Answer before Phase 1.5 lint.

1. **Drift closure UX — sub-tab in `TokenGrid` (recommended) vs. drawer?**
   Recommendation: **sub-tab (option b)**. Lighter weight — reuses `TokenGrid`, radiogroup, `SeverityChip`; no new overlay surface; one-key keyboard flow already works; fits the narrow Mint sidebar. A drawer gives better per-token diff UX at the cost of a whole new component, a new focus-trap site, and a second scroll context inside a panel that already scrolls. Only pick the drawer if Justin wants side-by-side local/remote swatches with a "Compare Figma URL" link — otherwise sub-tab is enough.

2. **Resolve button behavior — bulk only, or per-conflict view?**
   Specified: **bulk-first.** `Resolve` calls `flint_resolve_all` with a confirmation dialog listing the N conflicts and a radio for strategy (`prefer-figma` | `prefer-local`). The existing `ConflictResolutionPanel.tsx` supports per-conflict, but it lives behind the sync panel, not Mint. A future phase can add a "Review each…" link in the confirm dialog. Confirm this is acceptable.

3. **Push confirmation dialog — required?**
   Specified: **yes, required for Push, optional for Pull.** Push is destructive (overwrites Figma variables); Pull is additive (populates local with Figma values but pending tokens land in `ApprovalStagingArea` for review). CHRON.1 precedent is confirmation on destructive-ish. Confirm dialog copy: "About to push N local token changes to Figma. This will overwrite Figma values. Continue?" Pull fires immediately after button click.

4. **Empty-state messaging tone.**
   Current Mint copy: "No design tokens loaded. Connect Figma or import a tokens JSON file." — mechanical. Proposed Phase 2 copy: "Start by connecting Figma — your design system will sync here automatically." with `or import a tokens JSON file` as a muted text link. Feeds the "plain-language output" feedback entry. Confirm tone and copy.

5. **Error surfacing — toast-only, or persistent badge on `TokenHealthBar`?**
   Specified: **toast-only for transient errors** (network flake, auth expiry) — `notificationStore.push({ severity: 'error', autoDismissMs: 8000 })`, matches `FigmaConnectionPanel`. **Persistent badge** for structural errors (Figma connection expired / revoked) — a `<SeverityChip severity="critical" label="sync error">` appears in the bar until dismissed or connection restored. The distinction comes from the error type on the MCP tool response (`result.isError === true` with a `status: 'auth-expired'` header → persistent; everything else → toast). Confirm this split.

---

## Impact Map

Owner legend:
- `flint-electron-ipc` — IPC handlers, preload bridge, web adapter parity (no NEW IPC in Phase 2 — we wire to existing `mcp.callTool`)
- `flint-state-architect` — hook for connection state, `ViewMode` extension, bucket drift filter
- `flint-design-engineer` — React components, dialog, empty state
- `flint-test-writer` — component + hook tests

### 2.1 — Sync action cluster in `TokenHealthBar`

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/components/ui/TokenHealthBar.tsx` | MODIFY | flint-design-engineer | Add trailing `<SyncActionCluster>` group: Pull / Push / Resolve buttons + in-flight `syncOp` state. Compute disabled states from `health.buckets.drifted`, `health.buckets.pendingConflicts`, and the new `figmaConnected` prop (already passed). Mirror `FigmaConnectionPanel`'s notification push shape — do NOT invent a new feedback pattern. |
| `src/components/ui/mint/SyncActionCluster.tsx` | CREATE | flint-design-engineer | Extracted sub-component so `TokenHealthBar` stays readable. Accepts `{ figmaConnected, driftCount, pendingConflictCount, localEditCount, onPull, onPush, onResolve }`. Renders 3 buttons + loading state + disabled affordances. No store access — pure props. |
| `src/components/ui/mint/ConfirmPushDialog.tsx` | CREATE | flint-design-engineer | Modal shown before Push fires. Lists N changes, calls `flint_sync_check` on open to populate diff summary, submits to `flint_sync_push` on confirm. `FocusTrap` + `role="dialog"` + `aria-modal`. Matches `ImportModal` pattern exactly. |
| `src/components/ui/mint/ConfirmResolveDialog.tsx` | CREATE | flint-design-engineer | Modal shown before Resolve fires. Lists N conflicts, radio for `prefer-figma | prefer-local`, submits to `flint_resolve_all`. Same pattern as ConfirmPushDialog. |
| `src/hooks/useSyncActions.ts` | CREATE | flint-state-architect | Hook that owns `syncOp: 'pull' \| 'push' \| 'resolve' \| null` state and returns `{ pull, push, resolve, syncOp, lastError }`. Wraps `mcp.callTool` + `notificationStore.push` + confirmation-dialog orchestration. Keeps `TokenHealthBar` purely presentational. |
| `src/components/ui/__tests__/SyncActionCluster.test.tsx` | CREATE | flint-test-writer | Disabled-state matrix + loading spinner + disconnected fallback. |
| `src/hooks/__tests__/useSyncActions.test.ts` | CREATE | flint-test-writer | Tests pull/push/resolve flows. Mocks `window.flintAPI.mcp.callTool`. Tests confirm dialog path for push+resolve. Tests toast surface for errors. |

### 2.2 — Drift sub-tab in `TokenGrid`

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/components/ui/TokenGrid.tsx` | MODIFY | flint-design-engineer | Extend `ViewMode` type from `'grid' | 'list'` to `'grid' | 'list' | 'drift'`. Add a third radiogroup button in `TokenManager` labeled "Drift (N)". When `viewMode === 'drift'`, render a new `<DriftGroupSection>` that filters to `driftedTokens` and uses `TokenDriftRow` instead of `TokenRow`. Remove the old per-cell `SyncBadge` for drifted rows in grid/list modes when drift sub-tab is primary (keeps drift surface singular). |
| `src/components/ui/mint/TokenDriftRow.tsx` | CREATE | flint-design-engineer | Single-row renderer for a drifted token. Local swatch | "→" arrow | Figma swatch | ΔE chip (if color) | per-row "Pull this" button. Keyboard: Enter on row opens `TokenDetailPanel`, ArrowLeft/Right on Pull button. Calls `onPullOne(tokenPath)` when button fired. |
| `src/components/ui/mint/DriftGroupSection.tsx` | CREATE | flint-design-engineer | Groups drifted tokens by collection. Renders heading + list of `TokenDriftRow`. Empty state when `driftedTokens.length === 0` (which means the button itself is disabled, but render defensively). |
| `src/components/ui/TokenManager.tsx` | MODIFY | flint-design-engineer | Add `'drift'` to the `viewMode` state + radio UI. Badge-count the radio button with `driftedTokens.length`. Extend the passthrough props to `TokenGroupSection` → forward `driftedTokens` set to the new sub-tab path. Wire `onPullOne(tokenPath)` through `useSyncActions`. |
| `src/hooks/useSyncActions.ts` | MODIFY | flint-state-architect | Extend the hook with a `pullOne(tokenPath: string)` action. Calls `flint_sync_pull` with `{ scope: 'token', tokenPath }` — which is supported via `tokenSyncEngine.executePull`'s existing per-token filter (if a scope arg is absent, add a guard check that `flint_sync_pull` accepts the payload; if not, fall back to full pull and let the user-level diff settle). Per-token should be possible; confirm with the MCP tool author during implementation. |
| `src/components/ui/mint/__tests__/TokenDriftRow.test.tsx` | CREATE | flint-test-writer | Render color drift row with ΔE; render non-color (dimension) row without ΔE; click Pull-this fires `onPullOne` with correct path; keyboard Enter opens detail. |
| `src/components/ui/mint/__tests__/DriftGroupSection.test.tsx` | CREATE | flint-test-writer | Groups-by-collection correct; empty-state render. |
| `src/components/ui/__tests__/TokenGrid.drift-tab.test.tsx` | CREATE | flint-test-writer | ViewMode='drift' filters tokens correctly; radiogroup ARIA; counter badge updates. |

### 2.3 — Connect Figma empty state

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/components/ui/mint/ConnectFigmaEmptyState.tsx` | CREATE | flint-design-engineer | Full-panel empty state card. Hero CTA "Connect Figma" → calls `flint_figma_connect` via MCP. Secondary text link "or import a tokens JSON file" opens existing `ImportModal`. `role="region"` + `aria-labelledby`. |
| `src/components/ui/TokenManager.tsx` | MODIFY | flint-design-engineer | Replace the existing `tokens-empty-state` div (lines 659-676) with `<ConnectFigmaEmptyState figmaConnected={figmaConnected} onOpenImport={() => setShowImport(true)} onConnect={handleConnect} />`. When `figmaConnected === true` but `tokens.length === 0`, render a narrower "Pull from Figma" CTA instead of the Connect CTA. Keep the existing `FirstSyncPrompt` untouched — C4 elevation is through the empty state, not relocating FirstSyncPrompt. |
| `src/hooks/useSyncActions.ts` | MODIFY | flint-state-architect | Add `connect()` action: `mcp.callTool('flint_figma_connect', { action: 'connect' })`, surfaces toast on completion, re-fetches `figma.status()` on success. |
| `src/components/ui/mint/__tests__/ConnectFigmaEmptyState.test.tsx` | CREATE | flint-test-writer | Render without connection; render with connection but no tokens; CTA fires correct MCP tool; text link opens import modal. |

### 2.4 — Ipc-validator entry (for defensive runtime validation only)

No NEW IPC channels are introduced in Phase 2. Sync actions route entirely through `window.flintAPI.mcp.callTool`, which has its own validator entry (`mcp:call-tool`) already in `shared/ipc-validators.ts`. The CONTRACT lists `mcp:call-tool` as the only IPC channel touched (as a consumer, not as a modification).

---

## Type Contracts

See `MINT.5-phase2.contract.ts` for the full TypeScript surface. Summary of new types:

### Sync action hook

```ts
export type SyncOp = 'pull' | 'push' | 'resolve' | 'pull-one' | 'connect' | null

export interface UseSyncActionsResult {
    syncOp: SyncOp
    lastError: { tool: string; message: string; timestamp: number } | null
    pull: () => Promise<void>
    push: () => Promise<void>
    resolve: (strategy: 'prefer-figma' | 'prefer-local') => Promise<void>
    pullOne: (tokenPath: string) => Promise<void>
    connect: () => Promise<void>
}

export type UseSyncActionsHook = (options?: { onAfterSync?: () => void }) => UseSyncActionsResult
```

### Sync cluster props

```ts
export interface SyncActionClusterProps {
    figmaConnected: boolean
    driftCount: number
    pendingConflictCount: number
    localEditCount: number
    syncOp: SyncOp
    onPull: () => void
    onPush: () => void
    onResolve: () => void
}
```

### Drift row + group

```ts
export interface TokenDriftRowProps {
    drift: TokenDrift
    tokenType: TokenType
    onPullOne: (tokenPath: string) => void
    onSelect: (tokenPath: string) => void
    isPulling: boolean
}

export interface DriftGroupSectionProps {
    driftedTokens: TokenDrift[]
    tokensByPath: Map<string, DesignToken>
    onPullOne: (tokenPath: string) => void
    onSelect: (tokenPath: string) => void
    currentPullingPath: string | null
}
```

### Extended ViewMode

```ts
export type ViewMode = 'grid' | 'list' | 'drift'  // extends Phase 1 'grid' | 'list'
```

### Empty state

```ts
export interface ConnectFigmaEmptyStateProps {
    figmaConnected: boolean
    tokenCount: number
    syncOp: SyncOp
    onConnect: () => void
    onPullFromFigma: () => void
    onOpenImport: () => void
}
```

### Confirm dialogs

```ts
export interface ConfirmPushDialogProps {
    isOpen: boolean
    localEditCount: number
    onConfirm: () => void
    onCancel: () => void
}

export interface ConfirmResolveDialogProps {
    isOpen: boolean
    conflictCount: number
    onConfirm: (strategy: 'prefer-figma' | 'prefer-local') => void
    onCancel: () => void
}
```

---

## IPC Channel Contracts

No new channels. Consumer of the existing `mcp:call-tool` channel (already in `shared/ipc-validators.ts` with validator `mcpCallToolSchema`).

| Channel | Direction | Payload | Response | Handler | Validator | New? |
|---------|-----------|---------|----------|---------|-----------|------|
| `mcp:call-tool` | renderer→main | `{ tool: string; args: unknown }` | MCP tool response | `electron/main.ts` (existing) | `mcpCallToolSchema` | EXISTING (consumer only) |

MCP tools consumed by Phase 2 (no code change to any of them — these already exist):

- `flint_sync_pull` — Envoy pull
- `flint_sync_push` — Envoy push
- `flint_resolve_all` — bulk conflict resolution
- `flint_sync_check` — connection + counts
- `flint_figma_connect` — Alliance OAuth entry

---

## Store Contracts

No new Zustand slices. Phase 2 adds one hook (`useSyncActions`) that consumes `useNotificationStore` and reads `window.flintAPI.mcp` directly (IPC in a hook is the sanctioned pattern per the Architectural Anti-Patterns note — IPC is NOT allowed inside stores, but is allowed in hooks).

---

## Component Contracts

| Component | File | Props | Consumes | IPC Calls |
|-----------|------|-------|----------|-----------|
| `SyncActionCluster` (NEW) | `src/components/ui/mint/SyncActionCluster.tsx` | `SyncActionClusterProps` | — | — (pure presentational) |
| `TokenDriftRow` (NEW) | `src/components/ui/mint/TokenDriftRow.tsx` | `TokenDriftRowProps` | — | — |
| `DriftGroupSection` (NEW) | `src/components/ui/mint/DriftGroupSection.tsx` | `DriftGroupSectionProps` | — | — |
| `ConnectFigmaEmptyState` (NEW) | `src/components/ui/mint/ConnectFigmaEmptyState.tsx` | `ConnectFigmaEmptyStateProps` | — | — |
| `ConfirmPushDialog` (NEW) | `src/components/ui/mint/ConfirmPushDialog.tsx` | `ConfirmPushDialogProps` | — | `mcp:call-tool` → `flint_sync_check` |
| `ConfirmResolveDialog` (NEW) | `src/components/ui/mint/ConfirmResolveDialog.tsx` | `ConfirmResolveDialogProps` | — | — |
| `TokenHealthBar` | `src/components/ui/TokenHealthBar.tsx` | existing + `figmaConnected` + `driftCount` + `pendingConflictCount` + `onPull/onPush/onResolve` OR embed `useSyncActions` directly | `useNotificationStore` (via hook) | `mcp:call-tool` (via hook) |
| `TokenManager` | `src/components/ui/TokenManager.tsx` | existing | `tokenStore`, `useSyncActions` | `mcp:call-tool` (via hook) |

---

## Test Boundaries

Every NEW file gets unit tests. All assertions have executable `given/when/then` per Contract Schema v2.

### 2.1 — Sync action cluster

- **SyncActionCluster (disconnected)** — Given Figma disconnected, When rendered, Then hides Pull/Push/Resolve and renders a single "Connect Figma" CTA.
- **SyncActionCluster (no drift)** — Given driftCount=0, When rendered, Then disables Pull button with aria-label "Up to date".
- **SyncActionCluster (no local edits)** — Given localEditCount=0, When rendered, Then disables Push button with tooltip "No local changes".
- **SyncActionCluster (no conflicts)** — Given pendingConflictCount=0, When rendered, Then disables Resolve button.
- **SyncActionCluster (in-flight)** — Given syncOp='pull', When rendered, Then renders Loader2 spinner on Pull button and disables Push/Resolve.
- **useSyncActions.pull** — Given figmaConnected=true, When pull() invoked, Then calls `mcp.callTool('flint_sync_pull', {})` and emits success notification.
- **useSyncActions.push** — Given confirm dialog accepted, When push() invoked, Then calls `mcp.callTool('flint_sync_push', {})` once.
- **useSyncActions.resolve** — Given strategy='prefer-figma', When resolve() invoked, Then calls `mcp.callTool('flint_resolve_all', { strategy: 'prefer-figma' })`.
- **useSyncActions.error** — Given MCP tool returns `isError: true`, When pull() invoked, Then emits error notification with `severity: 'error'` and message from `result.content[0].text`.
- **useSyncActions.auth-expired** — Given MCP response indicates auth expiry, When any action invoked, Then sets `lastError.tool` and emits persistent `severity: 'critical'` notification.

### 2.2 — Drift sub-tab

- **ViewMode type extension** — Given ViewMode includes 'drift', When TypeScript compiles, Then no type error in `TokenManager` radiogroup.
- **Radio badge count** — Given driftedTokens.length=3, When TokenManager renders, Then "Drift" radio button renders "Drift (3)".
- **TokenGrid drift filter** — Given viewMode='drift', When TokenGrid renders, Then renders DriftGroupSection and not TokenGroupSection.
- **TokenDriftRow (color)** — Given TokenDrift with deltaE=3.2, When rendered, Then renders both swatches and an amber ΔE chip.
- **TokenDriftRow (dimension)** — Given TokenDrift without deltaE, When rendered, Then renders local and figma values and no ΔE chip.
- **TokenDriftRow.pullOne** — Given user clicks "Pull this", When fired, Then calls onPullOne with the row's tokenPath.
- **TokenDriftRow keyboard** — Given focus on row, When Enter pressed, Then calls onSelect with tokenPath.
- **DriftGroupSection empty** — Given driftedTokens=[], When rendered, Then renders placeholder "No drift" message.

### 2.3 — Connect Figma empty state

- **ConnectFigmaEmptyState (disconnected)** — Given figmaConnected=false and tokenCount=0, When rendered, Then renders "Connect Figma" primary CTA and "or import a tokens JSON file" link.
- **ConnectFigmaEmptyState (connected, no tokens)** — Given figmaConnected=true and tokenCount=0, When rendered, Then renders "Pull from Figma" primary CTA and suppresses Connect CTA.
- **ConnectFigmaEmptyState (has tokens)** — Given tokenCount > 0, When rendered, Then returns null (empty state suppressed).
- **onConnect** — Given user clicks "Connect Figma", When fired, Then calls onConnect prop exactly once.
- **onOpenImport** — Given user clicks "or import…", When fired, Then calls onOpenImport prop exactly once.

### 2.4 — Confirm dialogs

- **ConfirmPushDialog** — Given isOpen=true and localEditCount=12, When rendered, Then renders dialog with "12 local token changes" text.
- **ConfirmPushDialog focus trap** — Given dialog mounted, When Tab cycled, Then focus stays within dialog.
- **ConfirmPushDialog confirm** — Given user clicks Confirm, When fired, Then calls onConfirm exactly once.
- **ConfirmPushDialog cancel (Escape)** — Given dialog mounted, When Escape pressed, Then calls onCancel.
- **ConfirmResolveDialog strategy** — Given user selects "Prefer Figma" and clicks Confirm, When fired, Then calls onConfirm with 'prefer-figma'.

---

## Invariants

These are falsifiable thresholds. See `.contract.ts` for machine-readable versions.

- **sync-latency-p95** — End-to-end sync action latency (user click → notification push): `< 400ms` at N≤500 tokens. Measured by: manual timing via `performance.now()` markers around `handleSync` in `useSyncActions` tests.
- **zero-unauth-sync-calls** — No MCP sync tool call fires when `figma.status().running === false`: `= 0 calls` across all user paths. Measured by: component test asserts `mcp.callTool` is NOT invoked when rendered with `figmaConnected={false}`.
- **drift-render-memory** — `DriftGroupSection` with 500 drifted tokens renders: `< 120ms` cold mount. Measured by: vitest `performance.now()` around RTL `render()`.
- **confirm-dialog-blocks-action** — `flint_sync_push` call count after Cancel pressed: `= 0 calls`. Measured by: component test.
- **sync-op-serialization** — Concurrent sync actions while `syncOp !== null`: `= 0 additional calls`. Measured by: hook test — call pull() twice in quick succession, assert `mcp.callTool` invoked exactly once.

---

## Commandment Checklist

| # | Commandment | Applies | How Phase 2 satisfies it |
|---|-------------|---------|---------------------------|
| 1 | Code is Truth | ✓ | Sync actions mutate `.flint/design-tokens.json` + SQLite via existing MCP tool handlers — which already route writes through FTM. Phase 2 adds no new write paths. |
| 2 | No Hallucinated Styling | — | No visual mutations proposed — only UI surfaces + MCP tool invocation. |
| 3 | Composite IDs for Arrays | — | n/a — no array.map rendering of component instances. Drifted-token list uses `tokenName` as key (stable). |
| 4 | Local-First Only | ✓ | No external URLs. `flint_sync_pull` / `flint_sync_push` already handle Figma network I/O inside the main process. Renderer only calls `mcp:call-tool`. |
| 5 | Accessibility is a Compiler Error | ✓ | Radiogroup extension keeps ARIA contract. Confirm dialogs add `role="dialog"` + `aria-modal` + `FocusTrap`. Disabled buttons keep `aria-label` + `title` for the reason. Every new button/CTA has `data-testid`. |
| 6 | Gatekeeper Rule | — | No export-gate changes. |
| 7 | ID Preservation | — | n/a. |
| 8 | Audit-First Execution | — | n/a. |
| 9 | CIEDE2000 ΔE | ✓ | `TokenDriftRow` consumes `drift.deltaE` from Phase 1's `TokenDrift` — no new ΔE computation, just display. |
| 10 | Targeted Micro-Recovery | — | n/a. |
| 11 | Surgical Git Transplants | — | n/a. |
| 12 | Atomic Queuing | ✓ | Writes are downstream of the MCP tool (main process). Phase 2 doesn't queue writes — it calls tools that already queue correctly. |
| 13 | Deterministic Surgery | — | No AST work in Phase 2. |
| 14 | Bypass Prohibition | ✓ | Zero `fs` or `git` imports in Phase 2 renderer files. All writes go via MCP tools → Electron main → FTM. |
| 15 | Granular AST Tools Only | — | n/a — no AI orchestration in Phase 2. |
| 16 | In-Memory Validation | — | n/a. |

---

## Implementation Order

### Group A (parallel) — Foundation (no cross-deps)

- **flint-design-engineer (1)** — Create `src/components/ui/mint/SyncActionCluster.tsx` + test file. Pure presentational, no store access.
- **flint-design-engineer (2)** — Create `src/components/ui/mint/TokenDriftRow.tsx` + `DriftGroupSection.tsx` + tests.
- **flint-design-engineer (3)** — Create `src/components/ui/mint/ConnectFigmaEmptyState.tsx` + test.
- **flint-design-engineer (4)** — Create `src/components/ui/mint/ConfirmPushDialog.tsx` + `ConfirmResolveDialog.tsx` + tests (mirror ImportModal pattern).
- **flint-state-architect** — Create `src/hooks/useSyncActions.ts` + test. Owns syncOp state, wraps all MCP calls, emits notifications.
- **flint-test-writer** — Scaffold empty test files for Group B consumers using `it.todo` against the contract testBoundaries.

### Group B (parallel, after Group A) — Consumers

- **flint-design-engineer (5)** — Modify `TokenHealthBar.tsx` to accept sync-action props (or embed useSyncActions) and render `<SyncActionCluster>` at the trailing edge.
- **flint-design-engineer (6)** — Extend `TokenGrid.tsx` `ViewMode` to include `'drift'`; wire radiogroup; route drift mode to `<DriftGroupSection>`.
- **flint-design-engineer (7)** — Modify `TokenManager.tsx`: add 'drift' to radiogroup, replace empty state with `<ConnectFigmaEmptyState>`, wire `useSyncActions` hook, pass actions down to TokenHealthBar + TokenDriftRow.

### Group C (after Group B) — Validation

- **flint-test-writer** — Fill in all Group B test `it.todo` with real assertions. Add the parity test that confirms `window.flintAPI.mcp.callTool` is NOT invoked while `figmaConnected={false}` (invariant: zero-unauth-sync-calls).
- **flint-integration-validator** — Run full suite. Verify every testBoundary has a matching test. Verify invariants thresholds hold (sync-latency-p95, drift-render-memory). Confirm no `fs` / `git` imports in renderer. Confirm no new Zustand slices.

---

## Risks

| # | Risk | Severity | Commandment | Mitigation |
|---|------|----------|-------------|-------------|
| R1 | `flint_sync_pull` does not support `{ scope: 'token', tokenPath }` → per-row "Pull this" falls back to full pull and appears to do nothing specific | medium | — | Implementation: verify tool signature BEFORE writing `pullOne`. If scope arg absent, ship Phase 2 without per-row Pull (Pull-this button disabled with tooltip "Full pull only — click Pull above"). File a Phase 3 MCP change request. Do not silently upgrade to full-pull on Pull-this — user expectation would be violated. |
| R2 | `notificationStore.push` swallowed by the 5-concurrent cap during a burst (e.g., three quick Pull→Push→Resolve) | low | — | The store silently dismisses oldest auto-dismissible on push #6. Sync toasts are 4s auto-dismiss — 3 back-to-back syncs fit comfortably. No mitigation required beyond awareness. |
| R3 | `useSyncActions` IPC reference read directly from `window.flintAPI` without null-check → test env without `flintAPI` stub throws on mount | medium | — | Hook checks `window.flintAPI?.mcp?.callTool` and returns a `ready: false` flag if absent. All tests stub `window.flintAPI` in setup. Covered by existing Mint test pattern. |
| R4 | Confirm-dialog focus management regression — tab trap doesn't restore focus to the source button on close | low | 5 | Reuse FocusTrap from ImportModal which already handles this. Test asserts focus on original button after Escape. |
| R5 | `SyncActionCluster` renders on narrow sidebar and overflows to a third row | medium | — | Use `flex-wrap`. When width < 360px, collapse labels to icons only (tooltip stays). Matches `TokenHealthBar`'s existing `flex-wrap` behavior. Snapshot test at 280px / 360px / 480px widths. |
| R6 | User confirms Push, sync engine rejects due to Figma API rate limit — no retry path | medium | — | Surface the error via persistent `notificationStore` toast with Retry action callback. User can re-fire Push from the toast. Covered by useSyncActions error-path test. |
| R7 | Drift sub-tab ViewMode persists to localStorage (existing behavior) — user returns to Mint with `drift` selected but no drift tokens → shows empty "no drift" banner forever | low | — | Hook auto-reverts `viewMode` from 'drift' to 'grid' when `driftedTokens.length === 0` and the user reloads. Phase 2 preserves the Phase 1 ViewMode persistence; only adds revert-to-grid logic. |
| R8 | `ConnectFigmaEmptyState` races with `fetchTokens` — empty state flashes before the token list loads | medium | — | Gate on `isLoading === false` AND `tokens.length === 0`. Pattern already used at TokenManager.tsx:659. |
| R9 | Web-build parity — `server/index.ts` does not expose `mcp:call-tool` identically to Electron | high | — | `flint_sync_*` tools are already wired through `mcp:call-tool` on both surfaces (StatusBar uses them today). Parity is inherited. Integration validator confirms this. |
| R10 | New `src/components/ui/mint/` subdirectory collides with or duplicates Counsel-style subdirs | low | — | Check before creating. Existing pattern: `src/components/ui/governance/` for Counsel. `src/components/ui/mint/` for Mint. No collision. |

---

## Rollback Plan

Phase 2 is purely additive UI (new components, extended ViewMode, new hook) — no schema changes, no IPC additions, no AST or DB mutations. Rollback = revert the feature branch. No data migration needed.

If `flint_sync_pull` scope arg proves unusable (R1), ship Phase 2 with `pullOne` disabled and file a Phase 3 MCP change request. The sub-tab, Pull/Push/Resolve cluster, and empty state still ship.

---

## Non-Goals

Explicit to prevent Phase 2 scope creep. These are **not** part of Phase 2.

- **No Emit/Export dropdown** (UX A3) — Phase 3.
- **No TokenImpactAccordion in TokenDetailPanel** (UX A5) — Phase 4.
- **No read-only banner on TokenGrid** (UX A6) — Phase 4.
- **No ApprovalStagingArea collapse/count pill** (UX A7) — Phase 4.
- **No aria-live sync event announcements** (UX A9) — Phase 4 a11y polish.
- **No sync staleness banner ("Synced 12m ago · 3 local edits pending · 2 conflicts")** (UX A4) — deferred until `flint_sync_history` shape is normalized. Phase 3 or 4.
- **No OAuth flow modification** — `electron/figmaOAuth.ts` untouched. `flint_figma_connect` handles the flow as it does today.
- **No new MCP tools** — strictly UI wiring to existing tools.
- **No modification to `flint_sync_pull`/`flint_sync_push`/`flint_resolve_all` signatures** — R1 resolved by capability discovery, not by tool change.
- **No new IPC channel** — all sync calls route through the existing `mcp:call-tool`.
- **No new Zustand store** — `useSyncActions` is a hook, not a slice.
- **No FirstSyncPrompt relocation** — Phase 2 elevates the empty state instead. FirstSyncPrompt continues to render as it does today for users who land in Mint mid-session after a sync.
- **No UX items 5-8 from the ceremony review** — hierarchy reordering, health-bar density revamp, approval visual weight, and contrast-panel inversion. Phase 4. Justification: Phase 2 already adds 3 buttons, a confirm dialog, and a new tab to the bar — layout changes on top of that compound risk. Ship Phase 2, measure, revisit density in Phase 4.

---

## References

- Phase 1 contract: `.flint-context/contracts/MINT.5-phase1.contract.ts` + `.md`
- Mint reviews: `.flint-context/reviews/mint-{ux,code,security}-review-2026-04-17.md`
- Existing sync surfaces to mirror: `src/components/ui/FigmaConnectionPanel.tsx`, `src/components/editor/StatusBar.tsx:390-430`, `src/components/ui/ConflictResolutionPanel.tsx`
- Existing modal pattern: `src/components/ui/TokenManager.tsx:43-184` (ImportModal)
- Existing resource: `flint://figma-connection` at `flint-mcp/src/server.ts:1627`
- Existing validator registry: `shared/ipc-validators.ts:39+` (`mcp:call-tool` already registered)
- MCP tools consumed: `flint_sync_pull`, `flint_sync_push`, `flint_resolve_all`, `flint_sync_check`, `flint_figma_connect`
