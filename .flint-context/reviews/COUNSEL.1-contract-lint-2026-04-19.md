# Contract Lint Report: COUNSEL.1 — Unify the Health Score

**Date:** 2026-04-19
**Linter:** flint-contract-linter (v2.1)
**Verdict:** REVISE

| Check | Result | Issues |
|-------|--------|--------|
| 1. Compiles | PASS | No TSC errors |
| 2. Completeness | FAIL | `meta.status` is `'DRAFT'` — must be `'APPROVED'` before Phase 2 |
| 3. Impact Map | FAIL | `shared/__tests__/healthScore.parity.test.ts` is marked `CREATE` but already exists on disk |
| 4. IPC Triangles | PASS | No IPC channels declared (correct for engine-only sprint) |
| 5. Store Coherence | PASS | No store changes declared (correct) |
| 6. Test Boundaries | FAIL | TestBoundary "shared/__tests__/healthScore.parity.test.ts (parity matrix)" — `then` field begins with "asserts", which is not in the allowed verb set |
| 7. Commandments | WARN | C13 listed but its rationale in the markdown explicitly says "Babel AST traversal not applicable here" — listing it signals the wrong intent to implementers |
| 8. Parallelism Safety | PASS | No file conflicts across groups; group ordering is correct (A→B/C); test-writer in Group C runs after Group A refactors |
| 9. MD ↔ TS Consistency | PASS | Impact map, IPC, commandments, invariants align between markdown and .contract.ts |
| 10. Falsifiable Invariants | PASS | All five invariants carry comparison operators (`===`, `<`); units present where applicable |
| 11. Non-Goals | PASS | 11 explicit non-goals declared |
| 12. Audience | PASS | `meta.audience: 'engine'` — valid, matches feature scope |

---

## Issues (REVISE required)

### Blocking

1. **[BLOCKING] `meta.status` must be `'APPROVED'`, not `'DRAFT'`**

   `.contract.ts` line 59: `status: 'DRAFT'`. The schema (`ContractStatus`) allows `'DRAFT'` as a lifecycle value, but Phase 1.5 requires `'APPROVED'` before Phase 2 agents are unblocked. A contract in `DRAFT` state is not a contract — it is a work in progress. The architect must set `status: 'APPROVED'` in both the `.contract.ts` and update the companion markdown header (`**Status:** DRAFT → APPROVED`) to signal the contract is ready for implementation.

2. **[BLOCKING] Impact map marks `shared/__tests__/healthScore.parity.test.ts` as `CREATE` but the file already exists on disk**

   Check 3 requires that files marked `CREATE` must not exist yet. `shared/__tests__/healthScore.parity.test.ts` is present on disk. This means either:
   - The file was pre-created by a prior session (likely from the earlier CHRON.1-repair / C2 work referenced in the background), or
   - The contract's change type is wrong and should be `MODIFY`.

   The architect must inspect the existing file and determine whether (a) its content is a stub/placeholder that will be replaced wholesale — in which case `MODIFY` is the correct change type, or (b) the existing test already covers part of the parity contract — in which case the test boundary scope in the contract needs to match what will actually change.

3. **[BLOCKING] TestBoundary "parity matrix" `then` field begins with "asserts" — not in the allowed imperative verb set**

   `.contract.ts` lines 204–206: `then: 'asserts every adapter returned exactly {score: 95, grade: "B"}; fails build if any surface diverges'`

   `validateTestBoundaries()` requires `then` to begin with one of: `returns | throws | rejects | resolves | emits | sets | calls | renders | dispatches | updates | writes | reads | broadcasts | blocks | allows`.

   "asserts" is not in this set. This is a proxy for prose — the word describes what the test framework does, not what the system under test does. Rewrite to begin with an imperative verb that describes the observable outcome. Example:

   ```
   then: 'returns {score: 95, grade: "B"} from every adapter — any surface returning a different value causes the test suite to fail'
   ```

---

### Warnings (non-blocking)

4. **[WARNING] Commandment 13 is listed but explicitly inapplicable to this sprint**

   The markdown (Section 7) states: "Implementation will edit .ts files via direct edits (not source code mutation of user projects). Babel AST traversal not applicable here." Listing C13 (Deterministic Surgery) in `commandments: [5, 6, 13, 14]` is misleading — it tells Group A implementers they should be thinking about Babel, when the work is simply importing a shared module. Remove C13 from the commandments array. The justification in the markdown is the correct call; the `.contract.ts` should reflect it.

   Note: C13 is defined as "Babel AST traversal only — never regex on source code" for mutations to _user project files_. This sprint mutates only Flint's own source code in a conventional TypeScript refactor; Commandment 13 does not apply and its presence is noise.

---

## What Phase 2 Agents Can Rely On (once APPROVED)

- Types in `.contract.ts` compile and are complete (`HealthScoreInput`, `HealthScoreResult`, `ParityMatrixRow`, `HealthScoreSurface` are all well-formed)
- IPC array is correctly empty — no preload-bridge work required
- No file conflicts between Group A, B, or C agents (three independent MODIFY targets in Group A)
- All five invariants are falsifiable with comparison operators and named measurement mechanisms
- 11 non-goals are explicit — scope is tightly bounded to the three formula sites and one JSDoc fix
- `meta.audience: 'engine'` is correct — no dual-audience split required
- Group ordering (A→B, A→C) is correct — state-architect and test-writer both depend on Group A's refactors

---

## Fixes Required from flint-architect

1. Set `meta.status: 'APPROVED'` in `.contract.ts` and `**Status:** APPROVED` in the markdown header.
2. Change `changeType: 'CREATE'` to `changeType: 'MODIFY'` for `shared/__tests__/healthScore.parity.test.ts` (after confirming the existing file's content).
3. Rewrite the parity matrix `then` field to begin with an allowed imperative verb (`returns`, `blocks`, etc.).
4. (Optional but recommended) Remove `13` from `commandments` array — C13 is not applicable to this sprint.

Re-lint after fixes. The contract is otherwise well-formed and Phase 2 may begin immediately after the three blocking issues are resolved.

---

## Re-lint 2026-04-19

**Linter:** flint-contract-linter (v2.1)
**Trigger:** Architect revision — status promoted DRAFT→APPROVED, parity test changeType CREATE→MODIFY, parity matrix `then` rewritten, C13 removed from commandments.

| Check | Result | Notes |
|-------|--------|-------|
| 1. Compiles | PASS | `npx tsc --noEmit` — 0 errors |
| 2. Completeness | PASS | `meta.status: 'APPROVED'`; all required sections populated |
| 3. Impact Map | PASS | All 8 files are MODIFY; all exist on disk; all owners are recognized specialist agents; all parallelism-group agents own at least one file |
| 4. IPC Triangles | PASS | `ipc: []` — correct for engine-only sprint |
| 5. Store Coherence | PASS | `stores: []` — correct |
| 6. Test Boundaries | PASS | All 8 `then` fields begin with allowed imperative verbs (`returns`, `emits`, `blocks`); all `given`/`when`/`then` non-empty |
| 7. Commandments | PASS | `[5, 6, 14]` — C13 removed; remaining three are applicable; no missing required commandments for this sprint scope |
| 8. Parallelism Safety | PASS | No file conflicts within any group; B and C both sequential after A; test-writer in C covers A's targets |
| 9. MD ↔ TS Consistency | PASS | Status, impact map, commandments, invariants align between markdown and `.contract.ts` |
| 10. Falsifiable Invariants | PASS | All 5 invariants carry comparison operators (`===`, `<`) with named measurement mechanisms |
| 11. Non-Goals | PASS | 12 explicit non-goals |
| 12. Audience | PASS | `'engine'` — valid single-audience value |

**Verdict: APPROVED — 0 blocking, 0 warnings.**

Phase 2 may begin. All three blocking issues from the initial lint are resolved:
- `meta.status` is `'APPROVED'` in both files.
- `shared/__tests__/healthScore.parity.test.ts` is now `MODIFY` (file exists from CHRON.1-repair, confirmed on disk).
- Parity matrix `then` field now begins with `returns`.

### What Phase 2 Agents Can Rely On

- Types in `.contract.ts` compile cleanly: `HealthScoreInput`, `HealthScoreResult`, `ParityMatrixRow`, `HealthScoreSurface`.
- `ipc: []` — no preload-bridge work required.
- No file conflicts between Group A (3 engine files + 1 JSDoc fix), Group B (1 hook deprecation), or Group C (3 test files).
- All 5 invariants are falsifiable with comparison operators and named vitest/grep measurement mechanisms.
- 12 non-goals explicitly bound the sprint to engine math only — no UI, IPC, store, or new MCP tools.
- Group ordering (A → B, A → C) is correct; test-writer in Group C runs after Group A refactors land so parity assertions can be real rather than stubs.
