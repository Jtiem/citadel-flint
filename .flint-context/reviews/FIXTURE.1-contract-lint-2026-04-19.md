# Contract Lint Report: FIXTURE.1 — Audit Context System

**Linted:** 2026-04-19
**Contract artifact:** `.flint-context/contracts/FIXTURE.1-contract.md`
**Executable contract:** `.flint-context/contracts/FIXTURE.1.contract.ts`
**Schema version:** `shared/contract-schema.ts` (v2.1 — 12 checks)

---

## Verdict: REVISE

Five blocking issues found. Phase 2 cannot start until all five are resolved.

---

## Lint Check Results

| # | Check | Result | Issues |
|---|-------|--------|--------|
| 1 | Compiles | PASS | `npx tsc --noEmit` produced zero errors |
| 2 | Completeness | FAIL | `meta.status` is `'DRAFT'` — must be `'APPROVED'` before Phase 2 |
| 3 | Impact Map | FAIL | 4 file path errors (2 wrong names, 2 wrong changeType); see Issues §1-4 |
| 4 | IPC Triangles | PASS | `ipc: []` is intentional and explicitly declared in §5 |
| 5 | Store Coherence | PASS | `stores: []` is intentional and explicitly declared in §6 |
| 6 | Test Boundaries | PASS | 9 boundaries; all `given`/`when`/`then` non-empty; all `then` fields begin with an allowed THEN_VERB |
| 7 | Commandments | PASS | C5, C6, C13, C14, C15 — all applicable; no missing or irrelevant entries |
| 8 | Parallelism Safety | PASS | No intra-group file conflicts; test-writer (B) correctly follows implementors (A); design-engineer (C) correctly follows Group A |
| 9 | MD ↔ TS Consistency | WARN | Markdown intro states "32 affected files"; table adds to 34; `.contract.ts` has 35 impact entries |
| 10 | Falsifiable Invariants | PASS | 8 invariants; all contain comparison operators; all have `measuredBy` mechanisms, not just "tests" |
| 11 | Non-Goals | PASS | 14 entries — exemplary |
| 12 | Audience | PASS | `meta.audience: 'engine'` — valid; markdown parenthetical "(with a small designer surface)" is prose-only and does not pollute the typed field |

---

## Special Checks (per brief)

| Check | Result | Detail |
| --- | --- | --- |
| Beta canary — compliant demo audits clean | PASS | Invariant `demo-compliant-clean` declares `threshold: "=== 0"` measured by `audit-ui-component.test.ts` |
| Beta canary — broken demo produces ≥5 violations | PASS | Invariant `demo-broken-distinguishable` declares `threshold: ">= 5"` measured by `audit-ui-component.test.ts` |
| Territory coordination (RUNTIME.1 + FIGMA-LINT.1 on A11yLinter) | PASS | All three swarms are registered as append-only in ACTIVE-SWARM-TERRITORY.md; no structural restructuring declared |
| 5 deliverables vs invariants and testBoundaries | PASS | Every invariant threshold is covered by at least one testBoundary; no orphaned invariants |

---

## Issues

### Issue 1 — [BLOCKING] `meta.status` must be `'APPROVED'`, not `'DRAFT'`

`.contract.ts` line 108: `status: 'DRAFT'`

The schema requires `'APPROVED'` before Phase 2 agents are gated in. The markdown header also reads "Status: DRAFT (awaiting Phase 1.5 lint)". After lint approval both must be updated.

**Fix:** Change `.contract.ts` line 108 to `status: 'APPROVED'` and update the markdown header line 4 to `**Status:** APPROVED`.

---

### Issue 2 — [BLOCKING] `audit-ui-component.ts` does not exist — wrong MODIFY target

`.contract.ts` lines 260-265 and the impact summary table list:
```
file: 'flint-mcp/src/tools/audit-ui-component.ts',
changeType: 'MODIFY',
```

This file does not exist on disk. The `audit_ui_component` MCP tool is implemented inline inside `flint-mcp/src/server.ts` (confirmed at line 1941: `case "audit_ui_component": {`), not in a separate tool file.

Phase 2 agents executing a MODIFY on a nonexistent file will fail immediately.

**Fix:** Change this impact entry to:
```ts
{
  file: 'flint-mcp/src/server.ts',
  changeType: 'MODIFY',
  owner: 'flint-ast-surgeon',
  summary: 'APPEND-ONLY: in the audit_ui_component case handler (line ~1941), call resolveFixture before invoking linters, load tokens from resolvedTokensPath, pass surface into MithrilLinter and A11yLinter options, apply ruleOverrides, include fixtureContext in tool response. Coordinate with RUNTIME.1 + FIGMA-LINT.1 — all append-only to server.ts.',
}
```

Also update the markdown §3 table entry accordingly.

---

### Issue 3 — [BLOCKING] `swarm-audit-fix.ts` does not exist — wrong MODIFY target

`.contract.ts` lines 273-278 list:
```
file: 'flint-mcp/src/tools/swarm-audit-fix.ts',
changeType: 'MODIFY',
```

This file does not exist. The `flint_swarm_audit_fix` handler lives in `flint-mcp/src/tools/swarm.ts` (confirmed by file listing and the tool's case handler at `flint-mcp/src/server.ts` line 2636).

**Fix:** Change `file` to `'flint-mcp/src/tools/swarm.ts'`. Update the markdown table accordingly.

---

### Issue 4 — [BLOCKING] Two test files listed as MODIFY do not exist — must be CREATE

`.contract.ts` lines 281-290 list both of these with `changeType: 'MODIFY'`:

```
flint-mcp/src/tools/__tests__/audit-ui-component.test.ts
flint-mcp/src/tools/__tests__/audit.test.ts
```

Neither file exists on disk. A MODIFY on a nonexistent file is a contract error — Phase 2 agents will error out. Both must be `CREATE`.

Note: the `audit-ui-component.test.ts` name is also potentially wrong given Issue 2 above. If the tool handler is now in `server.ts`, consider naming the test `server.audit-ui-component.test.ts` or placing it in `flint-mcp/src/__tests__/` alongside other server-level tests. The architect should decide the canonical location.

**Fix:** Change both `changeType` values from `'MODIFY'` to `'CREATE'`. Resolve the naming question for `audit-ui-component.test.ts` in light of Issue 2.

---

### Warning — MD ↔ TS file-count mismatch (not blocking)

The markdown `§3` introduction states "32 affected files" but the section table's per-category counts add to 34 (4+3+11+5+9+2=34, where Warden lists "11" but enumerates 12 entries), and the `.contract.ts` impact array contains 35 entries (the Warden section has 12 files, not 11 as stated in the MD table).

This does not affect correctness of the implementation scope but will confuse the integration validator's file-count reconciliation in Phase 3.

**Suggested fix:** Update the markdown intro to "34 affected files" and correct the Warden row from "11" to "12 (1 modify types.ts, 9 rule modules, 1 modify A11yLinter, 1 test)".

---

## What Phase 2 Agents Can Rely On (after REVISE fixes are applied)

- Types in `.contract.ts` compile cleanly against `shared/contract-schema.ts`
- `FlintFixture`, `ResolvedFixture`, `RuleAppliesTo`, `MithrilAppliesToMap`, `ApplicabilityDecision` are fully typed and importable
- All CREATE targets are confirmed net-new (no pre-existing files will be clobbered)
- All MODIFY targets (after fixes) exist on disk
- IPC array is correctly empty — no preload-bridge changes, no Zod validators needed
- All 9 test boundaries have executable given/when/then with allowed verbs
- All 8 invariants have measurable thresholds with comparison operators
- No intra-group file conflicts between parallel agents
- Both beta-gate canary invariants are present and falsifiable
- Territory map confirms append-only coordination with RUNTIME.1 and FIGMA-LINT.1

---

## Required Architect Actions (one-pass fix)

Apply all five in a single revision:

1. `.contract.ts` line 108: `status: 'DRAFT'` → `status: 'APPROVED'`
2. `.contract.ts` lines 258-265: change `file: 'flint-mcp/src/tools/audit-ui-component.ts'` to `file: 'flint-mcp/src/server.ts'` and update summary to reference the inline handler
3. `.contract.ts` lines 273-278: change `file: 'flint-mcp/src/tools/swarm-audit-fix.ts'` to `file: 'flint-mcp/src/tools/swarm.ts'`
4. `.contract.ts` lines 281-284: change `changeType: 'MODIFY'` to `changeType: 'CREATE'` for `audit-ui-component.test.ts`
5. `.contract.ts` lines 285-290: change `changeType: 'MODIFY'` to `changeType: 'CREATE'` for `audit.test.ts`
6. Markdown header line 4: `DRAFT` → `APPROVED`
7. Markdown §3 intro: "32 affected files" → "34 affected files"; Warden row: "11" → "12"

Re-lint after applying. All other sections are solid — this should return APPROVED on the first re-lint.

---

## Round 2 — Re-lint (2026-04-19)

### Verdict: APPROVED

All five blocking fixes confirmed applied. Zero new issues introduced. Phase 2 may begin.

### Round 2 Check Results

| # | Check | Result | Notes |
| --- | --- | --- | --- |
| 1 | Compiles | PASS | No type changes; zero TSC errors confirmed from Round 1 still hold |
| 2 | Completeness | PASS | `meta.status: 'APPROVED'`; all required sections populated |
| 3 | Impact Map | PASS | 33 entries match markdown count; all MODIFY targets confirmed on disk; all CREATE targets confirmed net-new; all owners are valid specialist agents |
| 4 | IPC Triangles | PASS | `ipc: []` — intentional, no new channels declared |
| 5 | Store Coherence | PASS | `stores: []` — intentional, no new slices declared |
| 6 | Test Boundaries | PASS | 9 boundaries; all `given`/`when`/`then` non-empty; all `then` fields begin with an allowed THEN_VERB; target paths updated to real locations |
| 7 | Commandments | PASS | C5, C6, C13, C14, C15 — no changes; still applicable and complete |
| 8 | Parallelism Safety | PASS | No intra-group file conflicts; Group A has no file overlap between flint-state-architect and flint-ast-surgeon; test-writer (B) correctly follows Group A; design-engineer (C) correctly parallel with B |
| 9 | MD ↔ TS Consistency | PASS | Both say 33 affected files; pipeline row now correctly describes server.ts + swarm.ts + server.audit-fixture.test.ts; Warden row corrected to "12"; commandment and testBoundary counts match |
| 10 | Falsifiable Invariants | PASS | 8 invariants; all thresholds contain comparison operators; `measuredBy` fields now reference real file paths |
| 11 | Non-Goals | PASS | 14 entries |
| 12 | Audience | PASS | `meta.audience: 'engine'` — single valid value |

### Special Checks (Round 2)

| Check | Result | Detail |
| --- | --- | --- |
| Beta canary — compliant demo audits clean | PASS | Invariant `demo-compliant-clean`: `threshold: "=== 0"`, `measuredBy: "flint-mcp/src/__tests__/server.audit-fixture.test.ts"` — path now real |
| Beta canary — broken demo produces ≥5 violations | PASS | Invariant `demo-broken-distinguishable`: `threshold: ">= 5"`, `measuredBy: "server.audit-fixture.test.ts"` |
| Territory coordination | PASS | Unchanged; RUNTIME.1 and FIGMA-LINT.1 both append-only on A11yLinter.ts per ACTIVE-SWARM-TERRITORY.md |
| Deliverables vs invariants and testBoundaries | PASS | No orphaned invariants; all 8 covered by at least one testBoundary |

### What Phase 2 Agents Can Rely On

- Types in `.contract.ts` compile cleanly and are ready to import
- `FlintFixture`, `ResolvedFixture`, `RuleAppliesTo`, `MithrilAppliesToMap`, `ApplicabilityDecision` are fully typed and exportable
- All 33 impact entries point to real files (MODIFY) or confirmed net-new paths (CREATE)
- IPC array is correctly empty — no preload changes, no Zod validators needed
- All 9 test boundaries have executable given/when/then
- All 8 invariants are falsifiable with comparison operators and named verification mechanisms
- No intra-group file conflicts across the three parallelism groups
- Both beta-gate canary invariants are present, falsifiable, and point to a real test file
