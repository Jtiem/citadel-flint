# Contract Lint Report: COUNSEL.2.1 — Defer Button in Glass

**Re-lint date:** 2026-03-31
**Contract file:** `docs/contracts/counsel-2-1.contract.ts`
**Markdown file:** `docs/contracts/COUNSEL-2-1.md`

---

## Verdict: APPROVED

| Check | Result | Notes |
|-------|--------|-------|
| Compiles | PASS | Zero TypeScript errors. `durationToMs` switch is exhaustive over all 5 `DeferDuration` values plus `undefined`. |
| Completeness | PASS | All required sections present and non-empty. `meta.status` is `'APPROVED'`. Date is `2026-03-31`. |
| Impact Map | PASS | All 6 MODIFY files exist on disk. All 5 CREATE files correctly absent. All owner agents are known Flint specialist agents. All agents in `parallelismGroups` own at least one impact entry. |
| IPC Triangles | PASS | Both channels specify name, payload type, return type, and handler. Both are `renderer→main`. No duplicate channel names. |
| Store Coherence | PASS | `stores: []` — no store changes, consistent with the markdown rationale (defer state is component-local). |
| Test Boundaries | PASS | 5 test boundaries covering all new public API surfaces. `shared/__tests__/deferralUtils.test.ts` is in the impact map so the test import target is unambiguous. Edge cases present on all 5 boundaries. |
| Commandments | PASS | C4, C5, C6, C12, C14 all present and applicable. C9 (CIEDE2000) correctly absent. C13, C1 correctly absent (no AST surgery). |
| Parallelism Safety | PASS | Group A (`flint-electron-ipc`) and Group B (`flint-test-writer`) share no files. Group B is explicitly constrained to `it.todo()` scaffolds only. Group C (`flint-design-engineer`) after A. Group D (`flint-test-writer`, full assertions) after A and C. |
| MD ↔ TS Consistency | PASS | IPC channels (2), type names, impact entries (11), commandment list [4,5,6,12,14], and `DeferDuration` values (5) all match between markdown and `.contract.ts`. |

---

## Previously Blocked Items — All Resolved

| # | Original Blocker | Resolution |
|---|-----------------|------------|
| 1 | `meta.status` was `'DRAFT'` | `CONTRACT.meta.status` is now `'APPROVED'` (contract line 172) |
| 2 | Duration optionality contradictory between IPC table and `DeferViolationPayload` | `DeferViolationPayload.duration` is now `duration?: DeferDuration` (optional) in both the type definition and the IPC table |
| 3 | `DeferDuration` union missing `'3 days'`; markdown listed only 4 values | Both the TypeScript union and the markdown now specify all 5 values: `'1 day' \| '3 days' \| '1 week' \| '1 sprint' \| 'Manually'` |
| 4 | `durationToMs`/`computeExpiresAt` had no named production file | `shared/deferralUtils.ts` is a named CREATE entry in the impact map; test boundary imports are unambiguous |
| 5 | Group B had no `it.todo()` constraint; no Group D existed | Group B comment in `.contract.ts` is "it.todo() scaffolds only, parallel with A"; Group D exists for full assertions after A and C |
| 6 | `GovernanceAPI.deferViolation` final signature was underspecified | `GovernanceAPIDeferSignature` interface exports the exact non-optional signature; the markdown quotes it verbatim |

---

## What Phase 2 Agents Can Rely On

- **Types compile and are complete.** Import `DeferDuration`, `DeferViolationPayload`, `DeferredViolationRow`, `DeferralFormState`, `ExportModalDeferState`, and `GovernanceAPIDeferSignature` directly from `docs/contracts/counsel-2-1.contract.ts`. No `any` fields anywhere.
- **IPC triangles are fully specified.** `governance:defer-violation` (renderer→main, returns `void`) and `governance:get-deferred-violations` (renderer→main, returns `DeferredViolationRow[]`) have all three legs — channel, payload type, return type, handler file.
- **Shared utility file is contractually named.** `flint-electron-ipc` creates `shared/deferralUtils.ts` in Group A. `flint-design-engineer` and `flint-test-writer` can import `DeferDuration` and helpers from it once Group A completes.
- **No file conflicts between parallel agents.** Group A (`flint-electron-ipc`) and Group B (`flint-test-writer`) touch entirely disjoint files.
- **Test scaffolds in Group B are `it.todo()` only.** `flint-test-writer` fills real assertions in Group D, after A and C complete.
- **The final `GovernanceAPI.deferViolation` call site is unambiguous.** Non-optional, takes `{ ruleId, filePath, nodeId?, reason?, duration? }`, returns `Promise<void>`. The targets to replace are the optional `deferViolation?` at `flint-api.d.ts` lines 1678 and 2003.
- **`durationToMs` switch is exhaustive.** All 5 `DeferDuration` values plus `undefined` are handled. TypeScript will error at compile time if a new union member is added without updating the switch.
- **Deferred violations do not unblock the export gate.** This is an explicit non-goal. Agents must not add gate-clearing logic.
- **SQLite schema migration is safe.** `ALTER TABLE ... ADD COLUMN` with NULL default is non-destructive for existing rows.
- **Web parity is in the same group.** `server/index.ts` is in Group A alongside `electron/main.ts` — they ship in the same implementation pass, preventing build drift.
