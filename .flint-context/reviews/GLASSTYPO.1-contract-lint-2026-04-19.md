# Contract Lint Report: GLASSTYPO.1
## Glass Interaction Schema + Figma-Rhythm Type Scale + Primitive Vocabulary (Governance-Panel Canary)

**Linted:** 2026-04-19
**Contract files:**
- `.flint-context/contracts/GLASSTYPO.1-contract.md`
- `.flint-context/contracts/GLASSTYPO.1.contract.ts`

---

## Verdict: REVISE

Two BLOCKING issues must be fixed before Phase 2 begins. Both are mechanical — no architectural rethink required.

---

## Check Results

| Check | Result | Issues |
|-------|--------|--------|
| 1. Compiles | PASS | `npx tsc --noEmit` exits 0 on project; contract file compiles clean against `shared/contract-schema.ts` |
| 2. Completeness | PASS | All required sections populated; `meta.status = 'APPROVED'`, `meta.audience = 'designer'`, 23 test boundaries, 12 invariants, 15 non-goals, 7 risk entries |
| 3. Impact Map Integrity | WARN | MODIFY files confirmed on disk (`src/index.css`, `GovernanceDashboard.tsx`, `governance/*.tsx`). CREATE targets correctly absent (`primitives/` does not exist). Agents `flint-code-reviewer` and `flint-integration-validator` in Group D are not in the known specialist roster — but they carry no impact files and serve review-only roles (see Check 8). Governance glob entry claims ~19 files; actual count is 24 (.contract.ts uses an open glob so Phase 2 is not scope-locked, but the parenthetical is stale). |
| 4. IPC Triangle Completeness | PASS | `ipc: []` — zero IPC channels. Correct for a pure renderer refactor; no validator requirement triggered. |
| 5. Store Coherence | PASS | `stores: []` — no store changes. All new state is local `useState` inside primitives. Correct. |
| 6. Test Boundaries | FAIL (BLOCKING) | 23 boundaries defined; all `given`/`when` fields are non-empty. 22 of 23 `then` fields begin with a verb from the allowed set. **One boundary fails**: `Canary panel — 320px min-width no overflow` — `then` begins with `"satisfies"`, which is not in the `THEN_VERBS` set defined in `shared/contract-schema.ts`. Fix: change to `"returns root.scrollWidth <= root.clientWidth === true (zero horizontal overflow)"` or `"renders the panel without horizontal overflow (scrollWidth <= clientWidth)"`. |
| 7. Commandments | PASS | C2, C13, C14 listed and applicable. C13 annotation (`N/A for mutation pipeline`) is acceptable — correctly explains the commandment applies to dev-time determinism via TSC+Vitest gates. C5 (Accessibility) is arguable given new components with `aria-expanded`/`role=tooltip` surface, but C5 targets the export gate; the canary's `aria-expanded` / tooltip ARIA are covered by test boundaries, not export-gate policy. |
| 8. Parallelism Safety | WARN | No file conflicts within any group. Group D agents (`flint-code-reviewer`, `flint-integration-validator`) are not in the known specialist agent list and own no impact files — but this is the standard review-phase convention. The `flint-test-writer` is correctly in Groups B and C. One operational concern: the MD labels Group B as "Parallel with A" but `flint-design-engineer` is in both A and B — a single agent cannot run both simultaneously. The `.contract.ts` encodes no explicit parallelism semantics (letters A < B imply sequence), so this is a MD prose error, not a TS contract error. |
| 9. MD ↔ TS Consistency | FAIL (BLOCKING) | Two divergences found: (a) The MD Invariants table includes `canary-all-caps-only-via-primitive` — this invariant is absent from `CONTRACT.invariants` in the `.contract.ts`. The TS file has 12 invariants; the MD table has 13. Phase 2 agents and Phase 3 validator consume the `.contract.ts` as the binding spec — the missing invariant will not be enforced. (b) The MD states "18 executable boundaries" in the Test Boundaries section; the `.contract.ts` defines 23. The count discrepancy is not a logic error but the stale claim in MD creates confusion for Phase 2 agents reading the prose. |
| 10. Falsifiable Invariants | PASS | All 12 invariants carry a comparison operator (`=`, `>`, `>=`, `<=`). All `measurable` and `measuredBy` fields are non-empty. `measuredBy` mechanisms are concrete: `grep` commands with explicit patterns, `vitest` test references, `npm run test:react`. No adjective-only thresholds. Note: `primitive-test-pass-rate` threshold `">= 100% (0 failures)"` is valid — the `>=` operator is present and the parenthetical clarifies intent. |
| 11. Non-Goals | PASS | 15 non-goals declared. Explicitly names: non-canary panel migration (entry 1), font-weight beyond spec (entry 3), new MCP tool (entry 6), Mithril Glass-self-audit rule deferred to GLASSTYPO.2 (entry 8). StatusBar non-change is called out (entry 10). |
| 12. Audience | PASS | `meta.audience === 'designer'`. Single value, valid enum member. No MCP/CLI surface. Correct. |

---

## Issues

### BLOCKING

**1. [BLOCKING] Test boundary `then` verb: "satisfies" is not in the allowed verb set**

- Boundary: `Canary panel — 320px min-width no overflow`
- Current `then`: `"satisfies root.scrollWidth <= root.clientWidth (zero horizontal overflow)"`
- `validateTestBoundaries()` from `shared/contract-schema.ts` will reject `"satisfies"` — it is not in `THEN_VERBS`.
- Fix: Change to `"returns root.scrollWidth <= root.clientWidth (zero horizontal overflow)"` (the test `expect(el.scrollWidth).toBeLessThanOrEqualTo(el.clientWidth)` is a return-value assertion) or `"renders the canary panel without horizontal overflow (root.scrollWidth <= root.clientWidth)"`.
- Location: `.flint-context/contracts/GLASSTYPO.1.contract.ts`, `testBoundaries[22].then`

**2. [BLOCKING] Invariant `canary-all-caps-only-via-primitive` exists in the markdown but is absent from `CONTRACT.invariants` in the `.contract.ts`**

- The MD Invariants table (13 rows) includes:
  `canary-all-caps-only-via-primitive | Uppercase treatments outside PanelTabLabel in canary | = 0 | grep text-transform:\s*uppercase outside PanelTabLabel.tsx`
- The `.contract.ts` `invariants` array has 12 entries — this one is missing.
- Consequence: Phase 2 agents import `CONTRACT.invariants` as the binding spec. The CI grep check that enforces "no `text-transform: uppercase` outside `PanelTabLabel.tsx`" will not be specified in any machine-readable form Phase 3 can verify.
- Fix: Add the missing invariant to `CONTRACT.invariants` in the `.contract.ts`. The content is fully specified in the MD table and is a straightforward copy.

---

### SUGGESTIONS (non-blocking)

**3. [SUGGESTION] MD prose says "18 executable boundaries"; .contract.ts has 23**

- The sentence "See `.contract.ts` — 18 executable boundaries" in the Test Boundaries section of the markdown is stale.
- Not a blocking inconsistency (the `.contract.ts` is the binding spec and all 23 are valid), but creates confusion for humans reading the markdown.
- Fix: Update the MD sentence to `"See .contract.ts — 23 executable boundaries"`.

**4. [SUGGESTION] Governance `*.tsx` parenthetical count is stale (claims ~19, actual is 24)**

- Impact entry: `src/components/ui/governance/*.tsx (~19 files)` — actual file count is 24.
- The open glob in `.contract.ts` (`src/components/ui/governance/*.tsx (19 files)`) is not scope-restricting (Phase 2 will refactor whichever files need it), but the wrong count in the summary string is misleading.
- Fix: Change `(19 files)` to `(24 files)` in both the MD impact table and the `.contract.ts` impact entry summary.

**5. [SUGGESTION] Group B labeled "Parallel with A" in MD, but flint-design-engineer is in both groups**

- A single agent cannot run two groups simultaneously. The intent is clearly sequential: A (CSS tokens) must complete before B (primitives) can begin, because B imports the tokens.
- The `.contract.ts` `parallelismGroups` keys A < B < C < D correctly encode sequencing by letter convention. The mismatch is only in the MD prose.
- Fix: Change Group B's "Runs when" from "Parallel with A" to "After A — A's @theme block must exist before primitives can apply tokens."

**6. [SUGGESTION] FIXTURE.1 not called out in risk register**

- The brief notes RUNTIME.1 as an append-only coordination risk on `GovernanceDashboard.tsx`. FIXTURE.1 (`882343a` in git) also landed context-system changes against the Governance region.
- Neither contract nor git log shows an open conflict today, but the risk register would be stronger with a single line acknowledging FIXTURE.1 was reviewed and confirmed non-conflicting.
- Fix: Add a `low`-severity risk entry: `"FIXTURE.1 (audit context system) also touched GovernanceDashboard region — confirmed non-conflicting; GLASSTYPO.1 lands after both RUNTIME.1 and FIXTURE.1 merge."` with `mitigation: "Sequence enforced via branch dependencies."`.

**7. [SUGGESTION] Group D agents are not in the known Flint specialist roster**

- `flint-code-reviewer` and `flint-integration-validator` are not in the eight known specialist agents: `flint-electron-ipc`, `flint-state-architect`, `flint-design-engineer`, `flint-test-writer`, `flint-ast-surgeon`, `flint-mcp-specialist`, `flint-database`, `flint-accessibility`.
- This is convention (review-phase agents are not source-file owners), but Check 3 technically flags them as unknown.
- Fix: Either register these as known review-phase agent names in the project's agent roster, or move them outside the `parallelismGroups` key into a separate `reviewPhase` field. Absent a schema change, noting them in a comment in the `.contract.ts` is sufficient.

---

## Verified Specifics (per the brief)

| Item | Status | Detail |
|------|--------|--------|
| `meta.audience === 'designer'` | PASS | Single-valued, correct enum |
| `meta.status === 'APPROVED'` | PASS | Set correctly |
| All 6 named invariants falsifiable | PASS | `canary-schema-role-coverage` = 0, `canary-cta-primary-cap` <= 1, `canary-accent-confined-to-cta` = 0, `canary-zero-inline-uppercase` = 0, `canary-legacy-spacing-vars-preserved` > 0, `primitive-count` >= 6 — all carry comparison operators + `measuredBy` mechanisms |
| `expandedWhen` API test boundaries executable | PASS | 4 boundaries cover the predicate API (mount-true, mount-false, action-slot, HealthScore passive, ViolationsList active) — all have valid given/when/then |
| IPC zero channels | PASS | `ipc: []` correct for a pure renderer refactor |
| Every parallelism-group agent owns an impact file | WARN | A, B, C agents covered; Group D (review agents) own no files — conventional but technically flagged |
| Non-goals name the four required items | PASS | Non-canary migration, no new MCP tool, no Mithril self-audit rule, no GLASSTYPO.2+ work |
| Commandments C2 + C13 + C14 addressed | PASS | All three listed with correct justifications |
| Risk register mentions RUNTIME.1 | PASS | Present as high-severity with sequencing mitigation |
| Risk register mentions FIXTURE.1 | MISSING | Not called out — see Suggestion 6 |

---

## What Phase 2 Agents Can Rely On (after REVISE is addressed)

Once the two BLOCKING items are fixed:

- All types in `.contract.ts` compile against the project `tsconfig.json` (0 TSC errors).
- IPC surface is correctly declared empty — no preload bridge changes, no validator required.
- All 12 invariants are falsifiable with concrete grep/vitest mechanisms.
- 22 of 23 test boundaries have executable given/when/then (1 needs verb fix).
- No file conflicts exist between any agents within the same parallelism group.
- All CREATE targets are confirmed absent on disk; all MODIFY targets are confirmed present.
- The `SectionContext`, `ExpandedWhen`, `GlassSchemaRole`, and all six primitive prop interfaces are fully typed and importable by Phase 2 agents.
- The canary scope is tightly bounded — `src/components/ui/primitives/`, `src/components/ui/GovernanceDashboard.tsx`, `src/components/ui/governance/*` — with zero changes to `electron/`, `server/`, `flint-mcp/`, or `shared/`.
