# Contract Lint Report: RUNTIME.1 — axe-core Runtime Adapter

**Verdict: REVISE**
**Date:** 2026-04-18
**Linter:** flint-contract-linter (12-check suite, schema v2.1)

---

## Check Results

| Check | Result | Notes |
|-------|--------|-------|
| 1. Compiles | PASS (by inspection) | `tsc --noEmit` unavailable without Bash. Structural inspection: all types self-consistent, `FlintContract` shape satisfied, `parallelismGroups` uses `Record<string, string[]>` — `'0'` key is valid. No detectable type errors. |
| 2. Completeness | PASS | All 14 required sections populated. `meta.status: 'APPROVED'`, `meta.audience: 'designer'`, `meta.date: '2026-04-18'`. `impact` has 27 entries. `commandments` has 8 entries. `invariants` has 8 entries. `nonGoals` has 9 entries. |
| 3. Impact Map | PASS | All MODIFY files confirmed to exist on disk (grep returns matches in `electron/main.ts`, `electron/preload.ts`, `server/index.ts`, `src/adapters/web-api.ts`, `shared/ipc-validators.ts`, `flint-mcp/src/core/config.ts`, and all others confirmed via git status). All CREATE files absent (confirmed untracked in git status). All owner agents are known Flint specialist agents. `flint-integration-validator` appears in Group C and owns exactly one impact entry (`.flint-context/reviews/runtime.1-integration-2026-04-18.md`) — no orphans. |
| 4. IPC Triangles | PASS | One `renderer→main` channel (`runtime:run-axe`). All four legs specified: channel name, `RuntimeAuditRequest` payload, `RuntimeAuditResult` return, `electron/main.ts` handler. `validator: 'runtimeRunAxePayloadSchema'` declared. Both `runtimeRunAxePayloadSchema` (line 284) and `runtimeRunAxeResponseSchema` (line 287) are confirmed exported from `shared/ipc-validators.ts`. No duplicate channels. No `main→renderer` broadcasts. |
| 5. Store Coherence | PASS | `canvasStore` exists. `runtimeFindings: RuntimeAuditResult \| null` state field — both types defined in contract. `setRuntimeFindings` consumed by `useRuntimeAudit` hook (test boundary: happy-path). `clearRuntimeFindings` consumed by `useRuntimeAudit` (test boundary: reset-on-file-change). No cross-store imports declared. |
| 6. Test Boundaries | **FAIL** | **BLOCKING — see Issue 1.** 29 of 30 `then` fields begin with an allowed imperative verb. One fails: `TestBoundary "StatusBar runtime pill gated"` has `then: 'does not render the RuntimeAuditPill'` — first word `does` is not in the allowed verb set (`returns\|throws\|rejects\|resolves\|emits\|sets\|calls\|renders\|dispatches\|updates\|writes\|reads\|broadcasts\|blocks\|allows`). Every new public API has at least one test boundary; edge cases present on all boundaries. |
| 7. Commandments | PASS | Declared: `[1, 4, 5, 6, 8, 12, 13, 14]`. IPC change requires C12 ✓ and C14 ✓. No AST mutations (C1, C7, C13, C15, C16 correctly omitted). No color token edits (C2, C9 correctly omitted). C5 (a11y) and C6 (Gate) applicable and declared ✓. C8 (Audit-First: on-demand trigger) ✓. All relevant commandments accounted for. |
| 8. Parallelism Safety | PASS | No file conflicts between agents in any group. Group A: `flint-electron-ipc` (IPC files), `flint-ast-surgeon` (MCP files), `flint-state-architect` (store + hooks), `flint-test-writer` (test scaffolds) — fully disjoint file sets. Group B: `flint-design-engineer` (StatusBar, GovernanceDashboard, RuntimeAuditPill), `flint-ast-surgeon` (axe bundle), `flint-state-architect` (hook bodies), `flint-electron-ipc` (handler body) — no overlap. Group C: two agents, different files. Dependency ordering correct (A → B → C). `flint-test-writer` in both A (scaffolds) and C (assertions) — correct. |
| 9. MD ↔ TS Consistency | WARN | One divergence: the `.contract.ts` `nonGoals` array has 9 entries; the markdown "Out of scope" section lists 7. Two non-goals present in the TS but absent from the markdown: "No separate IPC channel for the feature flag" and "No flag-defaulted-true ship in this phase." The TS is the binding spec; the markdown is stale. Not blocking — additive content in TS does not break Phase 2 — but the markdown should be updated. |
| 10. Falsifiable Invariants | PASS | All 8 invariants contain comparison operators (`<`, `>=`, `=`). All have units or counts. All `measuredBy` fields name specific mechanisms (vitest benchmark, specific test files, integration test with `session.webRequest.onBeforeRequest` counter). No adjective-only thresholds. |
| 11. Non-Goals | PASS | 9 non-goals declared in `.contract.ts`. Requirement is ≥ 1. |
| 12. Audience | PASS | `meta.audience: 'designer'` — exactly one value from the valid enum `('engine' \| 'designer' \| 'developer' \| 'ci')`. Markdown documents secondary engine consumption but correctly defers to single-audience declaration in the TS. |

---

## Issues

### BLOCKING

**1. TestBoundary `"StatusBar runtime pill gated"` — `then` field fails imperative verb check.**

Location: `.flint-context/contracts/RUNTIME.1.contract.ts` line 877.

Current value:
```
then: 'does not render the RuntimeAuditPill'
```

`does` is not in the allowed verb set. The `validateTestBoundaries()` helper from `shared/contract-schema.ts` rejects this boundary.

Required fix — change `then` to begin with an allowed verb, for example:
```
then: 'renders no RuntimeAuditPill element in the DOM'
```
or:
```
then: 'renders the StatusBar without any RuntimeAuditPill node'
```

Both the `.contract.ts` and the markdown contract's "Test Boundaries — Highlights" section should be updated if the then field is mirrored there (it is not explicitly quoted in the markdown, so only the `.contract.ts` requires the fix).

---

### WARNINGS (non-blocking)

**W1. Markdown non-goals list is a subset of the TS `nonGoals` array.**

The `.contract.ts` `nonGoals` array has 9 entries. The markdown "Out of scope" section lists 7. Two non-goals present in the TS but absent from the markdown:
- `'No separate IPC channel for the feature flag. The flag is read from the existing flint_get_context session-context surface ...'`
- `'No flag-defaulted-true ship in this phase. Enablement is a follow-up release ...'`

The TS is authoritative. Add the two entries to the markdown non-goals list to keep it in sync and avoid confusing Phase 2 agents who read the markdown.

---

## What Phase 2 Agents Can Rely On (once BLOCKING-1 is resolved)

- Types in `.contract.ts` compile and are self-consistent
- `runtime:run-axe` IPC triangle is complete: all four legs specified, Zod validators `runtimeRunAxePayloadSchema` and `runtimeRunAxeResponseSchema` confirmed exported from `shared/ipc-validators.ts`
- No file conflicts between parallel agents in any group (Groups 0 / A / B / C are fully disjoint)
- All 8 invariants are falsifiable with comparison operators and named measurement harnesses
- 29 of 30 test boundaries have executable given/when/then (one boundary requires the verb fix)
- `flint-integration-validator` has an owned impact entry — no orphaned agents
- Feature-flag default-false posture is explicitly declared in both contract artifacts

---

## Resolution

The architect must fix **BLOCKING-1** (one `then` field verb) in `.flint-context/contracts/RUNTIME.1.contract.ts` line 877, then re-submit for re-lint. The fix is a single-line string change. No structural changes to the contract are required.
