# MINT.5 Phase 3 Contract — Sync Polish + Type Safety

**Phase:** MINT.5 (Phase 3 of 4)
**Status:** APPROVED
**Owner:** flint-architect
**Date:** 2026-04-18
**Citadel Name:** Envoy (sync) + Scout (emit)
**Builds on:** `MINT.5-phase2.contract.ts` — imports `SyncOp`, `SyncActionError`, `UseSyncActionsResult`, `ResolveStrategy`. Coexists with `RUNTIME.1.contract.ts` (parallel, append-only Zod additions to `shared/ipc-validators.ts`).

---

## Summary

Phase 2 shipped the visible Pull/Push/Resolve cluster, the drift sub-tab, the Connect Figma empty state, and the asymmetric confirm flow. Phase 3 closes four polish/type-safety items the Phase 2 contract explicitly deferred:

1. **Emit/handoff dropdown (Scout) on `TokenHealthBar`.** A presentation-only `EmitDropdown` adjacent to the Pull/Push/Resolve cluster. Targets the existing `flint_emit_tokens` MCP tool with a per-platform menu (Tailwind, CSS variables, React Native, Swift, Kotlin). The tool is not currently in `RENDERER_ALLOWED_MCP_TOOLS` — Phase 3 adds it (read-shaped from a renderer perspective: the dryRun-by-default flow returns generated text without writing). The destructive variant — actually writing files to `outputDir` — is gated behind a confirmation dialog mirroring `ConfirmPushDialog`.

2. **Sync staleness banner (Envoy) above the health bar.** A `SyncStalenessBanner` that surfaces when `SyncCheckReport.staleSince` (already returned by `flint_sync_check`) exceeds a configurable threshold. The threshold ships with a hardcoded default of 24 hours (`SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT`); reading the value from `flint.config.yaml` lands in Phase 4. Banner is inline-dismissible per session via a session-store flag (`useSyncStalenessStore`); dismissal persists across reloads of the same session and is cleared when a successful sync resets `staleSince`.

3. **Structured `MCPCallResult.classification` field.** Replaces the `isAuthExpiredError` keyword classifier in `useSyncActions.ts` with a discriminated union surfaced on the MCP result envelope itself: `'auth-expired' | 'rate-limited' | 'network-error' | 'tool-error' | 'validation-error' | 'unknown'`. Classification is computed once in `electron/mcpClient.ts` (and the web parity at `server/mcpClient.ts`), so every renderer consumer benefits — not just sync. `useSyncActions` consumes the new field and drops the keyword-matching helper. `MCPCallResult` is extended additively (the field is required on the new shape but shipped with a runtime default of `'unknown'` from existing handlers — see Risks R3).

4. **Per-tool Zod schemas for sync tool arguments.** Phase 2 added `mcpCallToolSchema`, the generic `[name, args]` envelope. Phase 3 adds five per-tool schemas in `shared/ipc-validators.ts` — `flintSyncPullArgsSchema`, `flintSyncPushArgsSchema`, `flintResolveAllArgsSchema`, `flintResolveConflictArgsSchema`, `flintSyncCheckArgsSchema` — registered into a `MCP_TOOL_ARG_SCHEMAS` lookup. The preload bridge in `electron/preload.ts` and the web bridge in `server/index.ts` consult the lookup before forwarding the call; failures surface as `MCPCallResult.classification = 'validation-error'` with a sanitized message and DO NOT reach the MCP server. This composes cleanly with RUNTIME.1's append-only `runtime:run-axe` schema additions because both are pure additions to the same module.

Phase 3 does NOT add new IPC channels, modify Sync engine logic, change the OAuth flow, or restructure the existing notification toast pattern.

---

## Open Questions Resolved

All 5 design decisions are resolved at architect default per the brief — no Justin gate required for Phase 3 to start.

| # | Decision | Default chosen | Rationale |
|---|----------|----------------|-----------|
| 1 | Emit dropdown trigger label | "Emit…" with platform menu | Matches existing visual cadence (Pull/Push/Resolve are verbs); the ellipsis signals "opens picker" per the existing ConfirmDialog pattern |
| 2 | Emit destructive flow | Dry-run by default, file-write gated by ConfirmEmitDialog | Mirrors Phase 2's Push/Resolve asymmetry. Emit-to-text is read-shaped (renderer-safe); emit-with-write is destructive |
| 3 | Staleness threshold default | 24 hours | Matches typical CI cadence; longer than a workday, shorter than a sprint |
| 4 | Staleness configurability | Hardcoded constant in Phase 3, `flint.config.yaml` policy in Phase 4 | Avoids touching the policy schema in a polish phase. The constant lives in `shared/syncStaleness.ts` so Phase 4 has a single replacement target |
| 5 | Banner dismissal scope | Per-session (zustand store, no localStorage) | Persistence across reloads is intentional inside a session; new session resets — the user is more likely to want to be re-warned the next day |

---

## Impact Map

Owner legend:
- `flint-electron-ipc` — IPC validators, preload bridge, mcpClient classification, web parity
- `flint-state-architect` — `useSyncStalenessStore` slice, `useSyncActions` refactor to consume classification
- `flint-design-engineer` — `EmitDropdown`, `ConfirmEmitDialog`, `SyncStalenessBanner`, TokenHealthBar/TokenManager wiring
- `flint-test-writer` — unit + integration tests against every new public API
- `flint-mcp-specialist` — appends `flint_emit_tokens` to `RENDERER_ALLOWED_MCP_TOOLS` and updates the related test

### 3.1 — Emit/Handoff Dropdown (Scout)

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/components/ui/mint/EmitDropdown.tsx` | CREATE | flint-design-engineer | Presentational menu rendering 5 platform options. Calls `onEmit(platform, mode)` where `mode` is `'preview' \| 'write'`. Closed-on-outside-click, Escape-to-close, ARIA menu role. No store access. |
| `src/components/ui/mint/ConfirmEmitDialog.tsx` | CREATE | flint-design-engineer | Confirm dialog for destructive emit (write-to-disk). Lists target `outputDir`, the platforms about to be written, and a cancel/confirm pair. Reuses the FocusTrap pattern from `ConfirmPushDialog`. |
| `src/hooks/useEmitTokens.ts` | CREATE | flint-state-architect | Hook owning emit state. Wraps `mcp.callTool('flint_emit_tokens', { platforms, dryRun, outputDir? })`. Surfaces preview text via notification or modal (out of scope: Phase 3 only emits the toast — UX-deeper preview drawer lands in Phase 4). |
| `src/components/ui/mint/__tests__/EmitDropdown.test.tsx` | CREATE | flint-test-writer | Menu opens on click; closes on outside click; closes on Escape; arrow-key navigation; click forwards `(platform, mode)`. |
| `src/components/ui/mint/__tests__/ConfirmEmitDialog.test.tsx` | CREATE | flint-test-writer | FocusTrap; Escape cancels; Confirm fires once with selected platforms. |
| `src/hooks/__tests__/useEmitTokens.test.ts` | CREATE | flint-test-writer | preview-mode calls with `dryRun=true`; write-mode requires confirmation; error propagates classification. |
| `shared/mcp-allowed-tools.ts` | MODIFY | flint-mcp-specialist | Append `'flint_emit_tokens'` to the frozen array. Update the JSDoc to call out the dryRun-default safety posture. |
| `electron/__tests__/mcp-policy.test.ts` | MODIFY | flint-test-writer | Update SEC.3 frozen-list assertion to include the new tool. |
| `src/components/ui/TokenHealthBar.tsx` | MODIFY | flint-design-engineer | Render `<EmitDropdown>` adjacent to `<SyncActionCluster>` when `figmaConnected || tokenCount > 0`. Thread `onEmit` callback through props. |

(`src/components/ui/TokenManager.tsx` modifications for emit wiring are consolidated into the Section 3.2 entry below — see that row's summary which now covers both the emit and staleness wiring.)

### 3.2 — Sync Staleness Banner (Envoy)

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `shared/syncStaleness.ts` | CREATE | flint-electron-ipc | Pure helpers: `SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT = 24`, `isSyncStale(staleSince, thresholdHours, nowMs)`, `formatStaleness(ms)`. Renderer + main both consume this; no I/O. |
| `src/components/ui/mint/SyncStalenessBanner.tsx` | CREATE | flint-design-engineer | Renderless when not stale or dismissed. Renders an amber banner with the staleness duration ("Last sync 26 hours ago"), a "Pull now" CTA (calls `onPull`), and a dismiss "X". `role="status"`, `aria-live="polite"`. |
| `src/store/syncStalenessStore.ts` | CREATE | flint-state-architect | Zustand slice. State: `dismissedAt: number \| null`. Actions: `dismiss()`, `clearDismissal()`. `dismiss()` sets `dismissedAt = Date.now()`; `clearDismissal()` resets to null. No localStorage; lives only for the session lifetime. |
| `src/hooks/useSyncStaleness.ts` | CREATE | flint-state-architect | Composes `flint_sync_check` polling cadence (every 60s while figmaConnected) with the dismissal store. Returns `{ isStale, hoursSinceSync, dismiss }`. Polls staleSince via `mcp.callTool('flint_sync_check', { projectRoot })`. |
| `src/components/ui/mint/__tests__/SyncStalenessBanner.test.tsx` | CREATE | flint-test-writer | Renders banner when `isStale=true && !dismissed`; null when dismissed; null when `staleSince` is null; CTA fires `onPull` once; dismiss button fires `dismiss` once. |
| `src/store/__tests__/syncStalenessStore.test.ts` | CREATE | flint-test-writer | `dismiss()` sets timestamp; `clearDismissal()` resets; selector returns falsy when `dismissedAt` newer than current `staleSince`. |
| `src/hooks/__tests__/useSyncStaleness.test.ts` | CREATE | flint-test-writer | Auto-clears dismissal when `staleSince` advances after a successful pull; polling interval cleaned up on unmount; `isStale=true` only crosses the threshold AND not dismissed. |
| `shared/__tests__/syncStaleness.test.ts` | CREATE | flint-test-writer | `isSyncStale` boundary (just under, just over threshold); `formatStaleness` formatting (minutes/hours/days). |
| `src/components/ui/TokenManager.tsx` | MODIFY | flint-design-engineer | Mount `<SyncStalenessBanner>` above `<TokenHealthBar>`. Wire `useSyncStaleness()` + `syncActions.pull` to its CTA. Also wire `useEmitTokens()` (Section 3.1) and forward the `onEmit` callback through to `TokenHealthBar`. Single MODIFY entry covers both Section 3.1 and Section 3.2 wirings. |

### 3.3 — Structured `MCPCallResult.classification` Field

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/types/flint-api.d.ts` | MODIFY | flint-electron-ipc | Extend `MCPCallResult` with the new optional `classification?: MCPCallClassification` field. Add the `MCPCallClassification` discriminated union export. Mark required only at the narrowed-type boundary in `useSyncActions`. |
| `shared/mcp-classification.ts` | CREATE | flint-electron-ipc | Pure module: `MCPCallClassification` type, `classifyMCPError(rawText, isError, status?): MCPCallClassification`, lookup tables for known status text patterns (auth/rate-limit/network/validation). No I/O. Mirrors the renderer-side existing keyword logic, lifted out of the hook. |
| `electron/mcpClient.ts` | MODIFY | flint-electron-ipc | After receiving the MCP server result, run `classifyMCPError` and attach `classification` to the returned `MCPCallResult`. Preserve every other field unchanged. Defaults to `'unknown'` for non-error results. |
| `server/mcpClient.ts` | MODIFY | flint-electron-ipc | Web parity — same classification attach. The `server/` build mirrors `electron/mcpClient.ts` exactly; this is a 4-line append to keep parity. |
| `src/hooks/useSyncActions.ts` | MODIFY | flint-state-architect | Drop `isAuthExpiredError` keyword helper. Read `result.classification` for `persistent` calculation (`persistent = classification === 'auth-expired' \|\| classification === 'rate-limited'`). Behavior preserved for tests; only the source of truth changes. |
| `shared/__tests__/mcp-classification.test.ts` | CREATE | flint-test-writer | 6 classifications × known-trigger inputs + unknown fallback. |
| `shared/__tests__/mcp-classification.bench.ts` | CREATE | flint-test-writer | vitest bench harness for `classifyMCPError` — 1000-call loop verifying the `classification-attach-overhead` invariant (`< 5ms per call at p95`). |
| `electron/__tests__/mcpClient.classification.test.ts` | CREATE | flint-test-writer | Result with auth-expired text gets `classification: 'auth-expired'`. Successful result gets `classification: 'unknown'` (or absent). |
| `src/hooks/__tests__/useSyncActions.test.ts` | MODIFY | flint-test-writer | Update existing auth-expired test to assert it triggers from the new `classification` field, not from text matching. Add a test that an unclassified error still surfaces the message but with `persistent=false`. |

### 3.4 — Per-Tool Zod Schemas

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `shared/ipc-validators.ts` | MODIFY | flint-electron-ipc | APPEND-ONLY: 5 new exported Zod schemas (`flintSyncPullArgsSchema`, `flintSyncPushArgsSchema`, `flintResolveAllArgsSchema`, `flintResolveConflictArgsSchema`, `flintSyncCheckArgsSchema`) and a `MCP_TOOL_ARG_SCHEMAS` lookup map. Composes cleanly with RUNTIME.1's `runtime:run-axe` addition (different region of the same file, no merge conflict). |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | At the `mcp.callTool` entrypoint, look up the schema in `MCP_TOOL_ARG_SCHEMAS`. If present and parse fails, return `{ content: [{ type: 'text', text: <sanitized> }], isError: true, classification: 'validation-error' }` WITHOUT calling `ipcRenderer.invoke`. If absent (tool not in lookup), pass through. |
| `server/index.ts` | MODIFY | flint-electron-ipc | Web-parity mirror of the preload validation gate. The same lookup is consulted before forwarding to `mcpClient.callTool`. |
| `shared/__tests__/ipc-validators.mcp-tool-schemas.test.ts` | CREATE | flint-test-writer | Each schema accepts well-formed args and rejects: missing `projectRoot`, wrong type, extra unknown keys (strict-mode parse). |
| `electron/__tests__/preload.mcp-validation.test.ts` | CREATE | flint-test-writer | Bad payload short-circuits without calling `ipcRenderer.invoke`. Good payload passes through unchanged. Unknown tool name falls through (no schema = no validation). |
| `server/__tests__/mcpClient.validation.test.ts` | CREATE | flint-test-writer | Web-parity mirror of the preload test. |

---

## Type Contracts

See `MINT.5-phase3.contract.ts` for the binding TypeScript surface. Summary:

### Emit dropdown

```ts
export type EmitPlatform = 'tailwind' | 'css' | 'react-native' | 'swift' | 'kotlin'
export type EmitMode = 'preview' | 'write'

export interface EmitDropdownProps {
  disabled?: boolean
  emitOp: 'preview' | 'write' | null
  onEmit: (platforms: EmitPlatform[], mode: EmitMode) => void
}

export interface ConfirmEmitDialogProps {
  isOpen: boolean
  platforms: EmitPlatform[]
  outputDir: string
  onConfirm: () => void
  onCancel: () => void
}

export interface UseEmitTokensResult {
  emitOp: 'preview' | 'write' | null
  lastError: SyncActionError | null
  ready: boolean
  emit: (platforms: EmitPlatform[], mode: EmitMode) => Promise<void>
}
```

### Sync staleness banner

```ts
export const SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT = 24

export interface SyncStalenessBannerProps {
  hoursSinceSync: number
  isStale: boolean
  isDismissed: boolean
  onPull: () => void
  onDismiss: () => void
}

export interface UseSyncStalenessResult {
  isStale: boolean
  hoursSinceSync: number | null
  staleSince: string | null
  dismiss: () => void
}

export interface SyncStalenessStoreState {
  dismissedAt: number | null
  dismiss: () => void
  clearDismissal: () => void
}
```

### MCPCallResult classification

```ts
export type MCPCallClassification =
  | 'auth-expired'
  | 'rate-limited'
  | 'network-error'
  | 'tool-error'
  | 'validation-error'
  | 'unknown'

export interface MCPCallResultV3 {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
  classification?: MCPCallClassification
}

export function classifyMCPError(args: {
  rawText: string
  isError: boolean
  status?: string
}): MCPCallClassification
```

### Per-tool Zod schemas (shape only — schemas live in `shared/ipc-validators.ts`)

```ts
export interface FlintSyncPullArgs { projectRoot: string; scope?: 'token'; tokenPath?: string }
export interface FlintSyncPushArgs { projectRoot: string }
export interface FlintResolveAllArgs { projectRoot: string; resolution: 'local' | 'remote' }
export interface FlintResolveConflictArgs { conflictId: string; resolution: 'local' | 'remote' | 'merged'; mergedValue?: string }
export interface FlintSyncCheckArgs { projectRoot: string }

export const MCP_TOOL_ARG_SCHEMA_NAMES = [
  'flint_sync_pull',
  'flint_sync_push',
  'flint_resolve_all',
  'flint_resolve_conflict',
  'flint_sync_check',
] as const
```

---

## IPC Channel Contracts

No new channels. Phase 3 reuses the existing `mcp:call-tool` channel and tightens its preload validation to consult per-tool schemas. The renderer-callable allowlist gains one tool (`flint_emit_tokens`).

| Channel | Direction | Payload | Response | Handler | Validator | New? |
|---------|-----------|---------|----------|---------|-----------|------|
| `mcp:call-tool` | renderer→main | `[name: string, args: Record<string, unknown>]` | `MCPCallResult` (now with `classification`) | `electron/main.ts` (existing) + `server/index.ts` (existing) | `mcpCallToolSchema` (envelope) + per-tool entries from `MCP_TOOL_ARG_SCHEMAS` | EXISTING (consumer + per-tool validation tightening) |

MCP tools consumed by Phase 3 (no signature changes):

- `flint_emit_tokens` — Scout — newly renderer-callable
- `flint_sync_pull` — already callable, now Zod-validated at preload
- `flint_sync_push` — already callable, now Zod-validated
- `flint_resolve_all` — already callable, now Zod-validated
- `flint_resolve_conflict` — already callable, now Zod-validated
- `flint_sync_check` — already callable, now Zod-validated

---

## Store Contracts

| Store | New state | New actions | New selectors |
|-------|-----------|-------------|---------------|
| `syncStalenessStore` (NEW slice) | `dismissedAt: number \| null` | `dismiss(): void`, `clearDismissal(): void` | `useSyncStalenessStore(s => s.dismissedAt)` |

`tokenStore`, `notificationStore`, `canvasStore`, `editorStore`, etc. — unchanged.

---

## Component Contracts

| Component | File | Props type | Consumes stores | Emits IPC |
|-----------|------|------------|-----------------|-----------|
| `EmitDropdown` (NEW) | `src/components/ui/mint/EmitDropdown.tsx` | `EmitDropdownProps` | — | — |
| `ConfirmEmitDialog` (NEW) | `src/components/ui/mint/ConfirmEmitDialog.tsx` | `ConfirmEmitDialogProps` | — | — |
| `SyncStalenessBanner` (NEW) | `src/components/ui/mint/SyncStalenessBanner.tsx` | `SyncStalenessBannerProps` | — | — |
| `TokenHealthBar` (MODIFY) | `src/components/ui/TokenHealthBar.tsx` | `TokenHealthBarProps` (extended with `onEmit` and `emitOp`) | — | — (callbacks only) |
| `TokenManager` (MODIFY) | `src/components/ui/TokenManager.tsx` | `TokenManagerProps` (unchanged) | `tokenStore`, `useSyncStalenessStore`, `useNotificationStore` | `mcp:call-tool` (via `useEmitTokens`, `useSyncStaleness`) |

---

## Test Boundaries

40 testBoundaries in `MINT.5-phase3.contract.ts`. Every boundary has executable `given/when/then` with allowed imperative verbs. Highlights:

- **EmitDropdown** — opens/closes correctly; arrow keys navigate platforms; click forwards `(platform, mode)`.
- **ConfirmEmitDialog** — FocusTrap; Escape cancels; Confirm fires once.
- **useEmitTokens.preview** — calls `mcp.callTool('flint_emit_tokens', { platforms: ['css'], dryRun: true })`.
- **useEmitTokens.write** — gated by confirm; calls with `dryRun: false`.
- **SyncStalenessBanner** — renders banner when `isStale && !isDismissed`; null otherwise.
- **useSyncStaleness.threshold** — `isStale` flips at exactly `SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT` hours.
- **useSyncStaleness.dismissal cleared on fresh sync** — `staleSince` advancing past `dismissedAt` resets dismissal.
- **MCPCallResult.classification (auth-expired)** — `classifyMCPError({ rawText: 'auth-expired', isError: true })` returns `'auth-expired'`.
- **MCPCallResult.classification (validation)** — preload schema rejection produces `classification: 'validation-error'`.
- **useSyncActions.persistent (post-refactor)** — `result.classification === 'auth-expired'` sets `lastError.persistent = true`; keyword text alone no longer triggers it.
- **flintSyncPullArgsSchema (strict)** — accepts `{ projectRoot: '/x' }`; accepts optional `scope/tokenPath`; rejects `{}`; rejects unknown keys.
- **preload validation gate** — bad payload returns the validation-error envelope WITHOUT calling `ipcRenderer.invoke`.
- **server validation gate (web parity)** — same behavior as preload gate.

---

## Invariants

| Name | Measurable | Threshold | Measured by |
|------|------------|-----------|-------------|
| `staleness-banner-render-latency` | time from `staleSince` crossing threshold to banner appearing | `< 16ms` (one render frame) at 60Hz | vitest `performance.now()` markers around RTL `render()` triggered by store mutation |
| `classification-attach-overhead` | time spent in `classifyMCPError` per MCP call | `< 5ms` per call at p95 | vitest bench in `shared/__tests__/mcp-classification.bench.ts` |
| `per-tool-schema-rejection-latency` | time for `MCP_TOOL_ARG_SCHEMAS[name].safeParse(badArgs)` to return | `< 1ms` per rejection at p95 | vitest bench in `shared/__tests__/ipc-validators.mcp-tool-schemas.test.ts` |
| `staleness-poll-cleanup` | active timers after `useSyncStaleness` unmount | `= 0 timers` | vitest `vi.useFakeTimers()` + assert `vi.getTimerCount() === 0` after unmount |
| `validation-gate-zero-network` | `ipcRenderer.invoke` calls when preload-side validation fails | `= 0 calls` | preload test asserts mock not invoked on bad payload |
| `emit-renderer-allowlist-frozen` | mutability of `RENDERER_ALLOWED_MCP_TOOLS` after Phase 3 add | `= 0 mutations possible` (Object.isFrozen returns true) | `electron/__tests__/mcp-policy.test.ts` updated assertion |
| `staleness-banner-zero-when-fresh` | banner-render assertions while `staleSince` is within threshold | `= 0 banner mounts` across 100 simulated time advances | hook test loops through threshold-1 down to 0 hours and asserts no mount |

---

## Commandment Checklist

| # | Commandment | Applies | How Phase 3 satisfies it |
|---|-------------|---------|---------------------------|
| 1 | Code is Truth | ✓ | `flint_emit_tokens` write path goes through the existing tool which writes via `fs` in the main process; preview path is read-only. No renderer-side disk writes. |
| 4 | Local-First Only | ✓ | All emit output goes to local files; no external URLs. The staleness check polls a local SQLite-backed sync history; no network call beyond what existed in Phase 2. |
| 5 | Accessibility is a Compiler Error | ✓ | `EmitDropdown` uses ARIA menu role + keyboard navigation. `ConfirmEmitDialog` uses FocusTrap + `role="dialog"` + `aria-modal`. `SyncStalenessBanner` uses `role="status"` + `aria-live="polite"` + visible focus on dismiss. |
| 12 | Atomic Queuing | ✓ | The destructive emit path is the existing `flint_emit_tokens` tool which already routes file writes through atomic writes in main. Phase 3 adds zero new write paths. |
| 14 | Bypass Prohibition | ✓ | Zero `fs` or `git` imports added in `src/`. Validation runs in preload (allowed — preload is part of the secure surface but only consumes Zod, no fs). |
| 15 | Granular AST Tools Only | — | n/a — no AST work. |
| 16 | In-Memory Validation | ✓ (analogous) | Per-tool Zod schemas are the moral equivalent at the IPC boundary — pre-flight validation before the call reaches the engine. |

C2, C3, C6, C7, C8, C9, C10, C11, C13 — n/a (no styling, array rendering, export gate, ID injection, AI orchestration, color drift, undo, git, or AST work in Phase 3).

---

## Implementation Order

### Group A (parallel) — Foundation

- **flint-electron-ipc** — Add per-tool Zod schemas + `MCP_TOOL_ARG_SCHEMAS` lookup to `shared/ipc-validators.ts` (APPEND-ONLY; coordinate with RUNTIME.1 sequencing). Create `shared/syncStaleness.ts` and `shared/mcp-classification.ts` pure helpers. Extend `MCPCallResult` in `src/types/flint-api.d.ts` and attach `classification` in both `electron/mcpClient.ts` and `server/mcpClient.ts`.
- **flint-mcp-specialist** — Append `flint_emit_tokens` to `RENDERER_ALLOWED_MCP_TOOLS` in `shared/mcp-allowed-tools.ts`. Update `electron/__tests__/mcp-policy.test.ts` assertion.
- **flint-state-architect** — Create `src/store/syncStalenessStore.ts`, `src/hooks/useSyncStaleness.ts`, and `src/hooks/useEmitTokens.ts`. Refactor `src/hooks/useSyncActions.ts` to consume `result.classification`.
- **flint-design-engineer** — Create `EmitDropdown.tsx`, `ConfirmEmitDialog.tsx`, `SyncStalenessBanner.tsx` (presentational only; pure props).
- **flint-test-writer** — Scaffold all 8 new test files with `it.todo` against the contract testBoundaries.

### Group B (parallel, after A) — Consumers

- **flint-design-engineer** — Modify `TokenHealthBar.tsx` to render `<EmitDropdown>` next to `<SyncActionCluster>`; thread `onEmit`/`emitOp` props.
- **flint-design-engineer** — Modify `TokenManager.tsx` to mount `<SyncStalenessBanner>` above `<TokenHealthBar>`; wire `useSyncStaleness` and `useEmitTokens`.
- **flint-electron-ipc** — Tighten `electron/preload.ts` to consult `MCP_TOOL_ARG_SCHEMAS` before forwarding `mcp:call-tool`; mirror in `server/index.ts`.

### Group C (after B) — Validation

- **flint-test-writer** — Replace `it.todo` with real assertions across all 8 new test files. Update existing `useSyncActions.test.ts` for the classification refactor. Update `electron/__tests__/mcp-policy.test.ts` for the new allowlist entry.
- **flint-integration-validator** — Run full suite: `cd flint-mcp && npm test`, `npm run test:react`, `npm test`, `npx tsc --noEmit`. Verify every testBoundary has a matching test. Verify invariants. Confirm no `fs`/`git` in renderer. Confirm `RENDERER_ALLOWED_MCP_TOOLS` is still frozen.

---

## Risks

| # | Risk | Severity | Commandment | Mitigation |
|---|------|----------|-------------|-------------|
| R1 | `shared/ipc-validators.ts` merge collision with RUNTIME.1's `runtime:run-axe` addition | medium | — | Both phases append to the same file in distinct regions: RUNTIME.1 inside `ipcSchemas` + named exports; Phase 3 adds 5 new top-level `export const` schemas + a `MCP_TOOL_ARG_SCHEMAS` lookup at the bottom of the file. Sequence the two phases serially in git, but the changes do not overlap textually. |
| R2 | `flint_emit_tokens` write path lets a renderer-issued call write outside `projectRoot` | high | 14 | The tool already validates `projectRoot` via `validateProjectRoot` and confines `outputDir` under it. Phase 3 does not weaken this. The `ConfirmEmitDialog` displays the resolved `outputDir` path before write; user cannot accidentally target an unintended directory. Renderer Zod schema constrains `outputDir` to a string (no path traversal handled here — that's the tool's job, and it already does it). |
| R3 | `MCPCallResult.classification` is optional; older code paths receive `undefined` and the `useSyncActions` refactor may regress | medium | — | The field default is computed in `mcpClient.ts` for every result (success → `'unknown'`, error → real classification). The hook treats `undefined` as `'unknown'` defensively. A legacy non-classified result from a stale build of the main process degrades gracefully — auth-expired errors fall back to text matching only if `classification` is absent (kept as a fallback in the helper for one phase, removed in Phase 4). |
| R4 | Per-tool schemas reject calls that the main process accepts today (drift between Zod and the MCP server's looser validation) | high | — | Phase 3 schemas are derived directly from the existing `case` blocks in `flint-mcp/src/server.ts` — every required field, every optional field, every union member matches verbatim. Phase 1.5 lint asserts the schemas import nothing from `flint-mcp/` (boundary-clean). Phase 3 tests round-trip a known-good payload through both the Zod schema and the live tool case to assert acceptance parity. |
| R5 | Sync staleness polling adds 1 background timer per mount of `TokenManager`; if the user opens/closes the panel rapidly, timers leak | medium | — | `useSyncStaleness` uses `useEffect` cleanup to clear the interval on unmount. Invariant `staleness-poll-cleanup` asserts `vi.getTimerCount() === 0` after unmount. |
| R6 | Banner shows the dreaded "Last sync NaN hours ago" when `staleSince` is null but the threshold logic isn't gated correctly | low | — | `isStale` is `false` when `staleSince === null`. `SyncStalenessBanner` returns null when `!isStale`. Tested explicitly. |
| R7 | `EmitDropdown` overflows the narrow Mint sidebar when sitting next to the existing 3-button `SyncActionCluster` (already known to be tight per Phase 2 R5) | medium | — | Render the dropdown trigger as an icon-only button with `title="Emit tokens"` when container width < 360px (matches the SyncActionCluster collapse pattern). Snapshot test at 280/360/480px widths. |
| R8 | Classification logic in renderer + main goes out of sync (one process upgrades, the other doesn't) | medium | — | `classifyMCPError` lives in `shared/mcp-classification.ts` — single source consumed by both processes via TS module import (renderer) and Node module import (main). One-source guarantee. |
| R9 | Adding `flint_emit_tokens` to the renderer allowlist enables an agent (via `agentId='renderer'`) to exfiltrate tokens by emitting to a writable directory | medium | 14 | The tool already enforces `outputDir` traversal containment via `validateProjectRoot`. The dryRun-default surface limits the renderer's first-step exposure to text returns. The destructive surface is gated by `ConfirmEmitDialog` (user-driven). The write target is shown to the user before the click. AGV.1 per-agent ACL still applies on top of the renderer allowlist. |
| R10 | Web-build parity drift — `server/mcpClient.ts` is updated for classification but `server/index.ts` validation gate is forgotten | medium | — | Impact map lists both files. Phase 3 integration validator diffs `electron/preload.ts` and `server/index.ts` MCP-related sections to confirm parity (per `feedback_web_parity_drift`). |
| R11 | `useSyncStaleness` polls `flint_sync_check` every 60 seconds, hammering SQLite if many panels mount | low | — | Phase 3 ships only one consumer (`TokenManager`). Polling is intentionally coarse (60s). Future consumers should share a singleton context — out of scope for Phase 3 but called out as a Phase 4 watchpoint. |
| R12 | The 5-platform emit dropdown's option text appears too dense in a narrow sidebar | low | — | Emit menu is rendered as a portal overlay anchored to the trigger; it does not respect the sidebar width. Standard `<DropdownMenu>` pattern. |

---

## Rollback Plan

Phase 3 is additive: 4 new components, 1 new store slice, 2 new hooks, 1 file extended (`MCPCallResult`), 5 new Zod schemas. Rollback = revert the feature branch. No data migration, no schema changes, no IPC channel additions. The classification field is optional, so reverting `mcpClient.ts` does not break consumers.

If `flint_emit_tokens` proves problematic in the renderer allowlist (R9), revert `shared/mcp-allowed-tools.ts` only; the rest of Phase 3 remains shippable (the dropdown is simply hidden because the call would 403). The staleness banner and classification field are independent.

---

## Non-Goals

Explicit to prevent Phase 3 scope creep.

- **No staleness threshold configurability via `flint_set_policy`** — hardcoded constant in Phase 3, policy schema landing in Phase 4.
- **No emit preview drawer** — Phase 3 surfaces emit text via a single notification toast. The full preview/diff drawer is Phase 4 work.
- **No emit-as-Code-Connect** — Bridge integration is out of scope; emit goes to platform files only.
- **No new MCP tools** — every consumed tool exists today.
- **No new IPC channels** — the preload validation tightening reuses `mcp:call-tool`.
- **No `MCPCallResult.classification` enforcement on every result yet** — the field is optional in the type; main process attaches it for sync-tool calls, default `'unknown'` elsewhere. Marking it required is a future tightening pass.
- **No removal of Phase 2's keyword fallback inside `useSyncActions`** — keyword check survives one phase as a backstop in case a stale main process returns an unclassified result. Removed in Phase 4.
- **No Phase 2 deferred items beyond the four named** — TokenImpactAccordion (A5), read-only banner (A6), ApprovalStagingArea collapse (A7), aria-live announcements (A9), density revamp, `prefers-reduced-motion`, Figma-logo SVG accuracy all remain Phase 4.
- **No `flint_emit_tokens` UI for `flint_map_tokens` (library mapper)** — separate semantic; Phase 4 if user signal warrants it.
- **No localStorage persistence of the staleness dismissal** — per-session by design.
- **No notification deduplication for repeated emit toasts** — Phase 4 polish if it becomes annoying.
- **No changes to `flint_sync_pull` / `flint_sync_push` / `flint_resolve_all` tool signatures** — Zod schemas mirror the existing case blocks exactly.

---

## References

- Phase 2 contract: `.flint-context/contracts/MINT.5-phase2.contract.ts` + `.md`
- Phase 1.5 lint: `.flint-context/reviews/MINT.5-phase2-contract-lint-2026-04-18.md`
- Existing emit tool: `flint-mcp/src/tools/emitTokens.ts`
- Existing emit handler in server: `flint-mcp/src/server.ts:3528`
- Existing sync tool case blocks: `flint-mcp/src/server.ts:3224-3298`
- SyncCheckReport shape: `flint-mcp/src/core/sync/syncCheckService.ts:20`
- IPC validators (entry point): `shared/ipc-validators.ts:39`
- Renderer allowlist: `shared/mcp-allowed-tools.ts`
- MCP API types: `src/types/flint-api.d.ts:914` (MCPCallResult)
- Phase 2 useSyncActions (refactor target): `src/hooks/useSyncActions.ts`
- Phase 2 TokenHealthBar (modify target): `src/components/ui/TokenHealthBar.tsx`
- Coordination: `.flint-context/ACTIVE-SWARM-TERRITORY.md` (RUNTIME.1 also touches `shared/ipc-validators.ts` — append-only, coordinate)
