# Contract Lint Report: BETA-TELEMETRY-WIRING

---

## Re-lint 2026-04-25

## Verdict: APPROVED

All 5 fixes confirmed. All 12 checks pass. Phase 2 may dispatch.

| Check | Result | Notes |
|-------|--------|-------|
| Compiles | PASS | TSC exits 0 |
| Completeness | PASS | All required sections populated |
| Impact Map | PASS | All MODIFY files exist; CREATE files correctly absent; valid owners; no orphans |
| IPC Triangles | PASS | Both channels fully specified; validator names declared; void-payload response-schema pattern consistent |
| Store Coherence | PASS | No stores (correct — consent lives on disk) |
| Test Boundaries | PASS | All 12 boundaries have executable given/when/then; all `then` fields open with allowed imperative verbs |
| Commandments | PASS | C2 added for new dialog; C9 removed; [2, 5, 12, 14, 16] all applicable |
| Parallelism Safety | PASS | `flint-test-writer` now in both Group A and Group B; no file conflicts within any group; B depends on A |
| MD ↔ TS Consistency | PASS | IPC channels, impact entries, commandments, and type names match across both files |
| Falsifiable Invariants | PASS | All 6 invariants contain `=` operator with counts and named verification mechanisms |
| Non-Goals | PASS | 5 entries; Cloudflare sink, feedback widget, new events, and sampling all explicitly out of scope |
| Audience | PASS | `'designer'` — matches all impact files in `electron/` + `src/` + `server/` |

### What Phase 2 Agents Can Rely On

- Types in `.contract.ts` compile cleanly and are importable: `ConsentState`, `ConsentRecord`, `TelemetrySetConsentPayload`, `TelemetryEvent`, `EmitFunction`, `TelemetryConsentDialogProps`, `TelemetryFlintAPI`.
- IPC triangles fully specified for both `telemetry:get-consent` and `telemetry:set-consent`; Group A must export `telemetryGetConsentResponseSchema` and `telemetrySetConsentPayloadSchema` from `shared/ipc-validators.ts`.
- No file conflicts between parallel agents in either group.
- All 12 test boundaries have structured given/when/then — `flint-test-writer` can scaffold `it.todo` blocks directly.
- All 6 invariants are falsifiable — Phase 3 integration validator has concrete pass/fail criteria.
- Non-goals are declared — Cloudflare Worker sink, feedback widget, and new event types are explicitly out of scope.
- Web parity enforced via the `web-parity` invariant and the `server/index.ts` impact map entry.
- `EmitFunction` discriminated-union privacy guarantee is a compile-time invariant — TSC blocks any caller passing extra keys.

---

## Original Lint Report (2026-04-24) — REVISE

## Verdict: REVISE

| Check | Result | Issues |
|-------|--------|--------|
| Compiles | PASS | TSC exits 0; no contract-specific type errors |
| Completeness | FAIL | `meta.status` is `'DRAFT'` — must be `'APPROVED'` |
| Impact Map | PASS | All MODIFY files exist; CREATE file correctly absent; valid owners; no orphans |
| IPC Triangles | PASS | Both channels fully specified; validators declared; void-payload channel uses response schema (consistent with `createValidatedInvoker` pattern) |
| Store Coherence | PASS | No stores declared (correct — consent lives on disk) |
| Test Boundaries | PASS | All 12 boundaries have executable given/when/then; all `then` fields start with valid imperative verbs |
| Commandments | FAIL | C9 listed but irrelevant (no color work); C9 mislabeled "Process Boundary" in MD table; C2 missing for new visual component |
| Parallelism Safety | FAIL | `flint-test-writer` has an explicit Group B task but is not listed in `parallelismGroups.B` |
| MD ↔ TS Consistency | PASS | 2 IPC channels, 10 impact entries, same commandment numbers across both files |
| Falsifiable Invariants | PASS | All 6 invariants contain `=` operator with measurable counts and named verification mechanisms |
| Non-Goals | PASS | 5 entries including Cloudflare Worker deferral and 5-event union cap |
| Audience | FAIL | `meta.audience` is `'engine'` but all impact files are in `electron/` + `src/` + `server/` — correct value is `'designer'` |

---

## Issues (REVISE)

### Blocking

**1. [BLOCKING] `meta.status` must be `'APPROVED'`, not `'DRAFT'`**

Contract file line 414: `status: 'DRAFT'`. The schema `ContractStatus` allows `'DRAFT' | 'APPROVED' | 'IMPLEMENTING' | 'SHIPPED'`, but the linter requires `'APPROVED'` before Phase 2 agents are dispatched. Change `status` to `'APPROVED'` in the `.contract.ts` file and update the markdown header from `**Status:** DRAFT (awaiting Phase 1.5 lint)` to `**Status:** APPROVED`.

---

**2. [BLOCKING] `meta.audience` is wrong — `'engine'` maps to `flint-mcp/`, but this contract owns no `flint-mcp/` files**

Contract file line 417: `audience: 'engine'`. Per `contract-schema.ts`:
- `engine` → `flint-mcp/`
- `designer` → `electron/` + `src/` (Glass)

Every file in the impact map (`electron/`, `src/`, `server/`, `shared/`) is Glass/Electron territory. The correct value is `'designer'`. The markdown header already notes "(cross-process: Electron main + web server + renderer)" which is `designer` scope. Change `audience` to `'designer'` in both the `.contract.ts` and the markdown header.

---

**3. [BLOCKING] `flint-test-writer` has a Group B task but is missing from `parallelismGroups.B`**

Contract file lines 403–408: `parallelismGroups.B` contains only `['flint-design-engineer']`. However, Implementation Order section (markdown section 7, item 4) explicitly assigns `flint-test-writer` a Group B task: "Fill in real assertions on the consent dialog tests." The impact map entry for `src/components/ui/__tests__/TelemetryConsentDialog.test.tsx` (CREATE, owned by `flint-test-writer`) is a Group B deliverable — it can only be written after `flint-design-engineer` builds the component in Group B.

Fix: Add `'flint-test-writer'` to `parallelismGroups.B`:
```ts
B: ['flint-design-engineer', 'flint-test-writer'],
```
Update the markdown Group B list to match.

---

### Warnings (not blocking — Phase 2 can start after the 3 blocking issues above are fixed)

**4. [WARNING] C9 (CIEDE2000 Delta-E Logic) is listed but irrelevant to this feature**

Contract file line 428: `commandments: [5, 9, 12, 14, 16]`. Commandment 9 governs perceptual color distance and design drift detection. This contract contains no color tokens, no design system color comparisons, and no visual drift work. C9 should be removed from the commandments list.

The markdown commandment table (section 6) labels C9 as "Process Boundary" — which is actually the intent of Commandment 14 (Bypass Prohibition), already correctly listed. This is both an irrelevant entry and a mislabel. Remove C9 from the list in both files.

**5. [WARNING] C2 (No Hallucinated Styling) is missing despite a new visual component being created**

The contract creates `src/components/ui/TelemetryConsentDialog.tsx` — a new React component with buttons, text, and layout. Commandment 2 requires every visual edit to be tied to a `design_token`. This means `flint-design-engineer` must build the dialog using token-backed classes (e.g., `bg-surface`, `text-primary`) rather than arbitrary Tailwind values or hardcoded colors. Add C2 to the commandments list and add a row to the markdown commandment table explaining how the dialog satisfies it.

---

## What Phase 2 Agents Can Rely On (once the 3 blocking issues are fixed)

- Types in `.contract.ts` compile cleanly — `ConsentState`, `ConsentRecord`, `TelemetrySetConsentPayload`, `TelemetryEvent`, `EmitFunction`, `TelemetryConsentDialogProps`, `TelemetryFlintAPI` are all valid and importable.
- IPC triangles are fully specified for both channels, with validator export names that Group A will create in `shared/ipc-validators.ts`.
- No file conflicts between Group A agents — `flint-electron-ipc` and `flint-test-writer` touch non-overlapping files.
- All 12 test boundaries have structured given/when/then — `flint-test-writer` can scaffold `it.todo` blocks directly from the contract.
- All 6 invariants are falsifiable — Phase 3 integration validator has concrete pass/fail criteria.
- Non-goals are declared — Cloudflare Worker sink, feedback widget, and new event types are explicitly out of scope.
- Web parity is enforced via the `web-parity` invariant and the `server/index.ts` impact map entry.
- The `EmitFunction` discriminated-union privacy guarantee is captured as a type in the contract — TSC will enforce it across all callers.

---

## Architect Fix Checklist (return to Phase 1.5 after these)

- [ ] `.contract.ts` line 414: `status: 'DRAFT'` → `status: 'APPROVED'`
- [ ] `.contract.ts` line 417: `audience: 'engine'` → `audience: 'designer'`
- [ ] `.contract.ts` lines 403–408: add `'flint-test-writer'` to `parallelismGroups.B`
- [ ] Markdown header: update Status and Audience lines
- [ ] Markdown section 7 Group B: add `flint-test-writer` to Group B list
- [ ] (Recommended) Remove `9` from `commandments` array in both files; add `2` for the new dialog component
