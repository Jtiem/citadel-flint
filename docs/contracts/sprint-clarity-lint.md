# Contract Lint Report: Sprint Clarity

**Linted by:** flint-contract-linter
**Date:** 2026-03-29
**Contract files:**
- `/Users/tiemann/Lunar-Elevator-Bridge/docs/contracts/SPRINT-CLARITY.md`
- `/Users/tiemann/Lunar-Elevator-Bridge/docs/contracts/sprint-clarity.contract.ts`

---

## Verdict: APPROVED

| Check | Result | Notes |
|-------|--------|-------|
| Compiles | PASS | `npx tsc --noEmit` — 0 errors |
| Completeness | PASS | All required sections populated |
| Impact Map | PASS | All MODIFY files confirmed on disk; all CREATE files confirmed absent |
| IPC Triangles | PASS | `ipc: []` — correctly empty, no IPC changes in this sprint |
| Store Coherence | PASS | `stores: []` — correctly empty, no store shape changes |
| Test Boundaries | PASS | 8 boundaries covering all 4 items; each has edge cases |
| Commandments | PASS (with note) | See commandment analysis below |
| Parallelism Safety | PASS | No file conflicts; dependency ordering correct |
| MD ↔ TS Consistency | PASS | Impact entries, type names, and non-goals match across both files |

---

## Check-by-Check Detail

### Check 1: Executable Contract Compiles

`npx tsc --noEmit docs/contracts/sprint-clarity.contract.ts` — no output, zero errors. Types compile cleanly.

### Check 2: Contract Completeness

All required `FlintContract` sections are present and populated:

| Section | Status |
|---------|--------|
| `meta.name` | "Sprint-Clarity" — present |
| `meta.phase` | "CLARITY" — present |
| `meta.status` | "DRAFT" — see note below |
| `meta.date` | "2026-03-29" — valid ISO date |
| `impact` | 17 entries — present |
| `ipc` | `[]` — explicitly empty, correct |
| `stores` | `[]` — explicitly empty, correct |
| `components` | `[]` — explicitly empty, correct |
| `commandments` | `[4, 13]` — see commandment analysis below |
| `testBoundaries` | 8 entries — present |
| `risks` | 2 entries — present |
| `parallelismGroups` | Groups A and B — present |
| `nonGoals` | 8 entries — present |

**Note on `meta.status: 'DRAFT'`:** The schema requires `status` to be one of `'DRAFT' | 'APPROVED' | 'IMPLEMENTING' | 'SHIPPED'`. DRAFT is a valid value. The contract linter gates Phase 2 — agents should not begin until the architect explicitly sets this to `'APPROVED'` after linting passes. This is a process note, not a blocking defect; per the workflow, flint-contract-linter returning APPROVED is the signal. The architect should update `status` to `'APPROVED'` in both files before agents begin work.

### Check 3: Impact Map Integrity

**MODIFY files — all confirmed on disk:**
- `src/components/ui/GovernanceDashboard.tsx` — exists
- `src/components/editor/StatusBar.tsx` — exists
- `src/components/ui/ExportModal.tsx` — exists
- `src/components/ui/CommandPalette.tsx` — exists
- `src/components/ui/LaunchScreen.tsx` — exists
- `src/components/ui/DemoWalkthrough.tsx` — exists
- `src/components/ui/PolicySettings.tsx` — exists
- `src/components/ui/LayerTree.tsx` — exists
- `src/components/ui/PropertiesPanel.tsx` — exists
- `src/components/ui/BetaWelcome.tsx` — exists
- `src/components/mithril/MithrilProvider.tsx` — exists
- `src/hooks/useOnboardingTooltip.ts` — exists
- `flint-mcp/src/server.ts` — exists
- `flint-ci/src/cli.ts` — exists
- `flint-mcp/src/prompts/onboard-project.ts` — exists

**CREATE files — confirmed absent (correct):**
- `flint-ci/src/commands/help.ts` — does not exist
- `flint-ci/src/__tests__/help.test.ts` — does not exist

**Owner agents — all valid Flint specialists:**
- `flint-design-engineer` — recognized specialist
- `flint-ast-surgeon` — recognized specialist
- `flint-test-writer` — recognized specialist

**Orphan check:** All three agents in `parallelismGroups` own at least one file in `impact`.

**Observation — `useMCPEventListener.ts` discrepancy:** The markdown contract lists `src/hooks/useMCPEventListener.ts` as an affected file in Item 1's table, but it is absent from the `.contract.ts` impact map. The markdown scopes it with "(if any)" — meaning the architect intentionally left it conditional. This is acceptable but agents should be aware: if `useMCPEventListener.ts` contains user-facing notification text with "violation", it must be updated. The omission from the `.contract.ts` impact map means `flint-design-engineer` has no contract-level obligation to touch it. This is a **WARNING**, not a blocking issue.

### Check 4: IPC Triangle Completeness

`ipc: []` — No IPC changes. Process boundary analysis in the markdown confirms no cross-boundary work. Correct.

### Check 5: Store Coherence

`stores: []` — No store shape changes. Explicitly listed in non-goals. `canvasStore.mithrilViolations` key is correctly preserved as a code identifier. Correct.

### Check 6: Test Boundary Coverage

8 test boundaries cover all new public API surfaces:

| Surface | Boundary | Edge Cases |
|---------|----------|-----------|
| GovernanceDashboard string pass | present | zero-state, baseline confirmation, plural forms |
| StatusBar string pass | present | singular/plural, tooltip, aria-label |
| ExportModal string pass | present | blocked state, approved state |
| `flint_get_context` nextStep field | present | no violations (absent case), cold start |
| `audit_ui_component` recommendation field | present | BLOCKED, APPROVED, file not found |
| `flint_audit` recommendation field | present | BLOCKED, APPROVED, multiple files |
| `helpCommand` output | present | plain text, no ANSI |
| `getOnboardProjectContent` step 6 | present | with/without projectRoot |

All 4 items in scope have at least one test boundary. All test boundaries have at least one edge case. Coverage is complete.

**Observation:** The contract lists only 3 component test boundaries (GovernanceDashboard, StatusBar, ExportModal) for Item 1, but the impact map lists 9 Glass components plus 2 hooks. The remaining components (CommandPalette, LaunchScreen, DemoWalkthrough, PolicySettings, LayerTree, PropertiesPanel, BetaWelcome, MithrilProvider, useOnboardingTooltip) have no individual test boundaries. This is a **WARNING** — the contract's test coverage for Item 1 is sampling rather than exhaustive. The risk entry for "Language pass misses a rendered string" partially acknowledges this. Phase 2 agents should use a grep-based assertion across all 9 components rather than file-by-file test boundaries, which the contract implicitly allows. Not blocking given the low risk severity and grep-audit mitigation.

### Check 7: Commandment Applicability

The contract lists `commandments: [4, 13]` with the note "neither at risk, listed for completeness."

Evaluating all 16 commandments against this sprint's scope:

| Commandment | Applicable? | Contract lists it? | Verdict |
|-------------|------------|-------------------|---------|
| C1 Code is Truth | No — no AST mutations | No | Correct |
| C2 No Hallucinated Styling | No — no visual edits | No | Correct |
| C4 Local-First Only | No — no network calls | Yes | Correct (harmless to list) |
| C12 Atomic Queuing | No — no file saves | No | Correct |
| C13 Deterministic Surgery | No — no code modification | Yes | Correct (harmless to list) |
| C14 Bypass Prohibition | Borderline — `flint-ci` CLI writes stdout, not disk | No | Acceptable |
| All others | No | No | Correct |

The commandment list is accurate. C4 and C13 are listed "for completeness" despite not being at risk — this is acceptable and does not mislead agents.

### Check 8: Parallelism Safety

**Group A:** `flint-design-engineer`, `flint-test-writer`
**Group B:** `flint-ast-surgeon`

**File conflict check within Group A:**
- `flint-design-engineer` owns: all 11 Glass UI/hook files + `flint-ci/src/commands/help.ts` + `flint-ci/src/cli.ts`
- `flint-test-writer` owns: `flint-ci/src/__tests__/help.test.ts`
- No overlap — clean.

**File conflict check between groups:**
- Group A touches `flint-ci/src/cli.ts` and `flint-ci/src/commands/help.ts`
- Group B touches `flint-mcp/src/server.ts` and `flint-mcp/src/prompts/onboard-project.ts`
- No overlap — clean.

**Dependency ordering:** The markdown states "All 4 items can run in parallel" and places all agents in Group A or B. Group B (`flint-ast-surgeon`) does not depend on Group A output. The grouping is logically sound — the split reflects the two different codebases (Glass/CLI vs MCP), not a dependency chain.

**Test writer placement:** `flint-test-writer` is in Group A (same group as the agent whose code it tests — `flint-design-engineer`). This is correct for test scaffolding; tests for `help.ts` can be written as `it.todo` scaffolds while the implementation proceeds in parallel.

### Check 9: Markdown ↔ TypeScript Consistency

Cross-referencing both files:

| Dimension | MD | TS | Match? |
|-----------|----|----|--------|
| Number of impact entries | 17 (16 in table + useMCPEventListener) | 16 | Near-match — useMCPEventListener in MD only (see Check 3 note) |
| IPC channels | 0 | 0 | Match |
| Store changes | 0 | 0 | Match |
| Commandments | C1 No, C4 No-risk, C13 No-risk | [4, 13] | Match |
| Non-goals | 8 items | 8 items | Match (wording equivalent) |
| Type names | ContextNextStep, AuditRecommendation, HelpSituation | Defined in .contract.ts | Match |
| Acceptance criteria ↔ testBoundaries | 4 items × ~4 criteria each | 8 test boundaries | Covered |

The one divergence (useMCPEventListener in MD but not TS) is documented above as a warning.

---

## Warnings (non-blocking)

1. **[WARNING]** `src/hooks/useMCPEventListener.ts` appears in the markdown's Item 1 file table with a "(if any)" qualifier but is absent from the `.contract.ts` impact map. If this file contains user-facing "violation" strings in notification text, agents have no contract obligation to update it. Recommend the architect either add it to the impact map as MODIFY or explicitly list it as out-of-scope in `nonGoals`.

2. **[WARNING]** Test boundaries for Item 1 cover only 3 of 11 Glass files (GovernanceDashboard, StatusBar, ExportModal). The remaining 8 files have no per-file test boundary. This is acknowledged by the "grep audit" mitigation in the risks section. Phase 2 agents should implement a single cross-component assertion (e.g., render each component and assert no "violation" text) rather than relying on manual inspection.

3. **[WARNING]** `meta.status` is `'DRAFT'` in both files. Before Phase 2 begins, the architect should flip this to `'APPROVED'` in both `SPRINT-CLARITY.md` and `sprint-clarity.contract.ts` so agents importing the contract see a confirmed status.

---

## What Phase 2 Agents Can Rely On

- All types in `sprint-clarity.contract.ts` compile with 0 TypeScript errors.
- No IPC channels are involved — this sprint is entirely within its respective layer (Glass renderer, MCP engine, CLI, MCP prompts).
- No process boundary is crossed — no `window.flintAPI` calls, no `fs` in `src/`, no new preload surface.
- All MODIFY files confirmed present on disk. No stale file references.
- All CREATE files confirmed absent. No accidental overwrites.
- No file conflicts between `flint-design-engineer`, `flint-ast-surgeon`, and `flint-test-writer` in either group.
- The language pass (Item 1) is explicitly scoped to user-facing strings only. Code identifiers (`mithrilViolations`, `LinterWarning`, etc.) must not be renamed.
- `flint-ast-surgeon` works exclusively in `flint-mcp/` — no Glass files, no CLI files.
- `flint-design-engineer` works exclusively in `src/` and `flint-ci/` — no MCP engine files.
- `flint-test-writer` owns only the new `help.test.ts` file — no overlap with implementation files.
