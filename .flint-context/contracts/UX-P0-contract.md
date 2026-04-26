# UX-P0 — Trust Gap Fixes (Beta Gate 2)

**Phase:** UX-P0
**Status:** APPROVED
**Owner:** flint-architect
**Date:** 2026-04-21
**Audience:** designer

Closes the 5 P0 trust-gap defects from `docs/strategy/UX-AUDIT-2026-04-04.md` Theme 1 before private beta. These are dead interactions — toggles without effect, labels without handlers, resize handles that don't grab. Each one individually tells a designer "this product is a mockup." Collectively they block beta.

## 1. Impact Map

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `electron/preload.ts` | MODIFY | flint-electron-ipc | Wire `saveRuleOverrides` / `getRuleOverrides` through `contextBridge` with Zod validation |
| `electron/main.ts` | MODIFY | flint-electron-ipc | Register `governance:save-overrides` / `governance:get-overrides` handlers; persist to `.flint/rule-overrides.json` via FileTransactionManager |
| `server/index.ts` | MODIFY | flint-electron-ipc | Web-parity handlers for same two channels |
| `shared/ipc-validators.ts` | MODIFY | flint-electron-ipc | Add `governanceSaveOverridesValidator`, `governanceGetOverridesValidator` |
| `src/hooks/useGovernanceCategories.ts` | MODIFY | flint-state-architect | Filter `visibleLinterWarnings` / `visibleA11yWarnings` by `governanceStore.overrides[ruleId].enabled === false` |
| `src/components/ui/GovernancePanel.tsx` | MODIFY | flint-design-engineer | `handleToggle` — compute reset against rule's `defaultEnabled`, not only severity; call `resetOverride` on round-trip |
| `src/components/editor/StatusBar.tsx` | MODIFY | flint-design-engineer | Rename the save-state / gate-pending label to "N issues blocking export — view" and make it a button that sets `rightTab='governance'` |
| `src/App.tsx` | MODIFY | flint-design-engineer | Raise right-sidebar resize handle z-index above React Flow pane; widen hit area to 8px transparent with 1px visible rail |
| `src/App.tsx` (demo-load sites) | MODIFY | flint-state-architect | Before `loadDemoProject` `syncCode`/hydrate, push a `historyStore` no-op marker (or call `recoveryController.markCheckpoint`) so Undo becomes safe |
| `src/components/ui/__tests__/GovernancePanel.test.tsx` | MODIFY | flint-test-writer | Add round-trip toggle test asserting `resetOverride` is called |
| `src/components/ui/__tests__/GovernanceDashboard.test.tsx` | MODIFY | flint-test-writer | Add filter test: disabled rule → violation not in `visibleLinterWarnings` |
| `src/components/editor/__tests__/StatusBar.test.tsx` | MODIFY | flint-test-writer | Pending-issues button navigates to governance tab |
| `electron/__tests__/governance-ipc.test.ts` | CREATE | flint-test-writer | Round-trip save/load of overrides via IPC |

## 2. IPC Channels

| Channel | Direction | Payload | Return | Handler | Validator |
|---------|-----------|---------|--------|---------|-----------|
| `governance:save-overrides` | renderer→main | `SaveRuleOverridesPayload` | `{ ok: true }` | `electron/main.ts` + `server/index.ts` | `governanceSaveOverridesValidator` |
| `governance:get-overrides` | renderer→main | `void` | `RuleOverridesFile \| null` | `electron/main.ts` + `server/index.ts` | `governanceGetOverridesValidator` |

## 3. Store Contracts

| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| `governanceStore` | — (uses existing `overrides`) | — | `selectVisibleWarnings(warnings)` helper exported from hook, not store |

No new state. `useGovernanceCategories` consumes `useGovernanceStore(s => s.overrides)` and filters.

## 4. Component Contracts

| Component | Props | Stores | IPC |
|-----------|-------|--------|-----|
| `GovernancePanel` | unchanged | `governanceStore` | `governance:recordOverride` (existing) |
| `StatusBar` | unchanged | `canvasStore` | — |
| `App` (resize handle) | unchanged | — | — |

## 5. Commandment Checklist

- **C1 — Code is Truth** — demo-load checkpoint must persist state correctly; historyStore mutations are authoritative.
- **C2 — No Hallucinated Styling** — StatusBar label and resize rail visual changes must reference design tokens.
- **C4 — Local-First** — overrides persisted to local `.flint/rule-overrides.json`, no network.
- **C12 — Atomic Queuing** — `governance:save-overrides` routes writes through `FileTransactionManager`, not raw `fs.writeFile`.
- **C14 — Bypass Prohibition** — no direct `fs` in main handler; use FileTransactionManager.
- **C6 — Gatekeeper Rule** — StatusBar gate click navigates to governance tab so blockers are actionable.

## 6. Implementation Order

**Group A (parallel):**
- flint-electron-ipc: preload + main + server + validators
- flint-state-architect: `useGovernanceCategories` filter + demo-load undo fix
- flint-design-engineer: `handleToggle` round-trip + StatusBar button + resize handle

**Group B (after A):**
- flint-test-writer: all 4 test files, assertions from `testBoundaries`

**Group C:**
- flint-integration-validator: Phase 3 validation

## 7. Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Raising resize-handle z-index breaks React Flow pan/drag in that strip | medium | — | Handle only intercepts events within its 8px hit area; uses `pointer-events: auto` on handle only |
| `visibleLinterWarnings` filter applied in hook but other consumers of raw warnings diverge | high | C6 | All violation UI reads from `useGovernanceCategories`; dashboard already funnels through it |
| Demo-load undo "checkpoint" masks real bug where syncCode bypasses history | medium | C1 | Checkpoint is explicit — pushes a named marker so redo is deterministic |
| Overrides JSON schema drift between main and renderer | high | — | Zod validator is the single source of truth imported by both sides |

## 8. Non-Goals

- Redesigning the GovernancePanel visual layout (scope for Counsel).
- Migrating `overrides` to the unified `flint.config.yaml` (scope for UCFG follow-up).
- Adding per-file override scoping (beta scope only supports project-level).
- Server/web build wiring is in scope for IPC parity, but the web-specific UI polish for these fixes is out of scope.
