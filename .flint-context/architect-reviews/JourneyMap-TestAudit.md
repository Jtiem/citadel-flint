# Critical Audit: Journey Maps vs. Test Coverage

**Date:** 2026-03-15 (updated 2026-03-15 post-remediation)
**Auditor:** flint-integration-validator methodology
**Scope:** All 44 journey steps across 9 journeys vs. actual test suite

---

## Current Baseline (POST-REMEDIATION)

| Suite | Pass | Fail | Total | Files |
|-------|:----:|:----:|:-----:|:-----:|
| **MCP** | 515 | 0 | 515 | 23 |
| **Glass** | 386 | 0 | 386 | 25 |
| **Core** | 295 | 0 | 295 | 11 |
| **TSC** | 0 errors | — | — | — |
| **Total** | **1,196** | **0** | **1,196** | **59** |

### Remediation Summary (P0 + P1 + P2)

| Phase | Action | Tests |
|-------|--------|:-----:|
| **P0** | Fixed 35 broken Glass tests (assertion text/class mismatches from JTBD waves) | 35 fixed |
| **P1** | App mount gate (J1.1) | 3 new |
| **P1** | Open project chain + Clean Slate Protocol (J2.3-2.5) | 17 new |
| **P1** | Workspace audit + export gate aggregation (J4.2) | 24 new |
| **P1** | Undo controller + history stack discipline (J6.1-6.3) | 21 new |
| **P1** | Canvas selection + context sync propagation (J5.1-5.2) | 18 new |
| **P1** | C15 tool catalog + C16 validation loop (Commandments) | 60 new |
| **P2** | Figma token normalization pipeline (J8.2) | 16 new |
| **P2** | Cross-file undo + batch restore (J6.3) | 8 new |
| **P2** | External file change re-audit engine (J3.4) | 7 new |
| **Total new** | | **174** |

### Active Regressions: NONE (all 35 fixed in P0)

All 35 previously broken Glass tests have been fixed. Root cause was UI text/class changes from JTBD waves that updated components without updating test assertions.

| File | Was Failing | Now | Fix |
|------|:----------:|:---:|-----|
| `LayerTree.test.tsx` | 12 | **14/14** | Fixture shapes, inferred layer names, tag badge classes |
| `ExportModal.test.tsx` | 8 | **17/17** | Severity badges, dismissal selectors, violation section headers |
| `StatusBar.test.tsx` | 6 | **12/12** | Export Gate chip, Figma dot color, overrides badge |
| `TokenManager.test.tsx` | 6 | **11/11** | Loading text, placeholder, empty state, error prefix |
| `ActivityFeed.test.tsx` | 2 | **10/10** | TOOL_LABELS mapping (tool name → display label) |
| `LaunchScreen.test.tsx` | 1 | **11/11** | Tagline: "Visual governance..." → "Design-to-Code Platform" |

---

## Journey-by-Journey Verdict

### RATING KEY
- **TESTED** = Has direct tests that exercise this exact code path
- **PARTIAL** = Some aspect tested, critical sub-steps missing
- **UNTESTED** = No test exercises this step
- **BROKEN** = Tests exist but are currently failing

---

### Journey 1: First Launch (3 steps)

| Step | Name | Verdict | Evidence |
|------|------|:-------:|----------|
| 1.1 | App Mounts | **TESTED** | `AppMountGate.test.tsx` — 3 tests: null→LaunchScreen, populated→Canvas, close→LaunchScreen. |
| 1.2 | Context Sync Initializes | **TESTED** | `useContextSync.test.ts` — 12 tests covering debounce, state shape, cleanup. |
| 1.3 | LaunchScreen Renders | **TESTED** | `LaunchScreen.test.tsx` — 11/11 pass (P0 fix: tagline text updated). |

**J1 Score: 3/3 TESTED**

---

### Journey 2: Open Existing Project (7 steps)

| Step | Name | Verdict | Evidence |
|------|------|:-------:|----------|
| 2.1 | User Triggers "Open" | **UNTESTED** | Native OS dialog IPC not directly testable. Acceptable gap. |
| 2.2 | Native File Dialog | **UNTESTED** | Native OS dialog, not directly testable. Acceptable gap. |
| 2.3 | Project Validation | **TESTED** | `projectOpenChain.test.ts` — 17 tests: setWorkspaceFiles, setActiveFile, Clean Slate Protocol, IPC failure. |
| 2.4 | Store Hydration | **TESTED** | `projectOpenChain.test.ts` — rawCode, ast, visualTree, a11yViolations populated after load. |
| 2.5 | AST Parsing + Audit | **TESTED** | `projectOpenChain.test.ts` + `externalFileChange.test.ts` — parse-then-lint pipeline. |
| 2.6 | Canvas + Preview Render | **UNTESTED** | ReactFlow canvas mount requires heavy browser mocking. Acceptable gap. |
| 2.7 | Git Repository Check | **TESTED** | `GitManager.test.ts` — 16 tests covering `ensureRepo`, `shadowCommit`, `getGitNode`. |

**J2 Score: 4/7 TESTED, 2 ACCEPTABLE, 1 UNTESTED**

---

### Journey 3: Governance Audit Loop (4 steps)

| Step | Name | Verdict | Evidence |
|------|------|:-------:|----------|
| 3.1 | Linter Execution | **TESTED** | `MithrilLinter.visitors.test.ts` (50+ tests), A11y tests (120+ tests across 16 files), `safety-promises.test.ts` tests #1, #2, #3, #10. CIEDE2000 reference values validated. |
| 3.2 | Violation Display | **TESTED** | `GovernanceOverlay.test.tsx` (15+ tests), `StatusBar.test.tsx` — 12/12 pass (P0 fix: Export Gate chip, Figma dot, overrides badge). |
| 3.3 | Auto-Fix | **TESTED** | `safety-promises.test.ts` Test #6: `flint_fix` → re-audit passes. `ASTService.test.ts` covers `applyMutationBatch` + inversions. |
| 3.4 | Manual Fix (External) | **TESTED** | `externalFileChange.test.ts` — 7 tests: setCode re-audit, violation add/remove, syntax error handling. (fs.watch trigger not yet wired — engine tested). |

**J3 Score: 4/4 TESTED**

---

### Journey 4: Export Gate (5 steps)

| Step | Name | Verdict | Evidence |
|------|------|:-------:|----------|
| 4.1 | Export Triggered | **TESTED** | `ExportModal.test.tsx` — 17/17 pass (P0 fix: severity headers, dismissal, copy button). |
| 4.2 | Full Workspace Audit | **TESTED** | `workspace-audit.test.ts` — 24 tests: per-file counts, gate decision, mixed violations, severity escalation, clean project. |
| 4.3 | Gate Decision | **TESTED** | `safety-promises.test.ts` Tests #1-3. `policy-engine.test.ts` (14 tests). `workspace-audit.test.ts` blocked/clear paths. |
| 4.4 | Violation Breakdown (Blocked) | **TESTED** | `ExportModal.test.tsx` — severity badges, section headers, node click navigation. |
| 4.5 | Export Proceeds (Clear) | **TESTED** | `ExportModal.test.tsx` — Copy Source button visibility and clipboard test. |

**J4 Score: 5/5 TESTED**

---

### Journey 5: Canvas Interaction (4 steps)

| Step | Name | Verdict | Evidence |
|------|------|:-------:|----------|
| 5.1 | Node Selection | **TESTED** | `LayerTree.test.tsx` — 14/14 pass (P0 fix). `canvasSelection.test.ts` — 18 tests: setSelectedNode, visual tree lookup, store independence. |
| 5.2 | Properties Panel Update | **TESTED** | `canvasSelection.test.ts` — selectedNodeId propagation via useContextSync (4 debounce tests). |
| 5.3 | Property Edit | **PARTIAL** | `ASTService.test.ts` tests `applyMutationBatch` (40+ tests). No PropertiesPanel → store chain test. |
| 5.4 | AST Mutation + Preview | **PARTIAL** | `ASTService.test.ts` and `data-integrity.test.ts` cover mutation mechanics. No preview iframe update test. |

**J5 Score: 2/4 TESTED, 2 PARTIAL**

---

### Journey 6: Recovery / Undo (4 steps)

| Step | Name | Verdict | Evidence |
|------|------|:-------:|----------|
| 6.1 | Keyboard Undo (Cmd+Z) | **TESTED** | `recoveryController.test.ts` — 21 tests: applyUndo, applyRedo, stack discipline, zombie tolerance, ID preservation. |
| 6.2 | History Stack Check | **TESTED** | `recoveryController.test.ts` — past shrinks, future grows, canUndo/canRedo flags, two-level deep undo. |
| 6.3 | Apply Inverse Mutation | **TESTED** | `recoveryController.test.ts` + `crossFileRecovery.test.ts` — 8 tests: saveFileBatch, buffer evict/reload, editor sync, RedoPlan extraction. |
| 6.4 | Git Time Machine | **PARTIAL** | `GitManager.test.ts` — shadowCommit → gitShow round-trip. `transplantNode()` and RecoveryPanel UI untested. |

**J6 Score: 3/4 TESTED, 1 PARTIAL**

---

### Journey 7: MCP Agent Workflow (5 steps)

| Step | Name | Verdict | Evidence |
|------|------|:-------:|----------|
| 7.1 | MCP Connection + Status | **TESTED** | `boundary-contracts.test.ts` Test #25: `flint://capabilities` returns tool list. |
| 7.2 | Audit Execution | **TESTED** | `safety-promises.test.ts` Test #5: `flint_audit` returns correct violations. Tests #1, #2 validate detection. |
| 7.3 | Auto-Fix | **TESTED** | `safety-promises.test.ts` Test #6: `flint_fix` → re-audit passes. |
| 7.4 | Verification Audit | **TESTED** | Covered by Test #6 (fix then re-audit). |
| 7.5 | Debt Report | **TESTED** | `safety-promises.test.ts` Test #7. `debtReportService.test.ts` (35 tests). `boundary-contracts.test.ts` Test #23: `flint://dashboard` resource. |

**J7 Score: 5/5 TESTED**

---

### Journey 8: Figma Import (4 steps)

| Step | Name | Verdict | Evidence |
|------|------|:-------:|----------|
| 8.1 | Plugin Sends Data | **UNTESTED** | HTTP endpoint test requires mocking `electron` BrowserWindow. Acceptable gap (loopback-only server). |
| 8.2 | Token Normalization | **TESTED** | `ingestionServer.test.ts` — 16 tests: COLOR/FLOAT/STRING/BOOLEAN mapping, multi-mode expansion, alias skip, type guard rejection, path building, description preservation. |
| 8.3 | AST Hydration | **UNTESTED** | No test for `flint:hydro-paste-auto` IPC → React JSX conversion. |
| 8.4 | Asset Storage | **UNTESTED** | No test for `/ingest-asset` endpoint. |

**J8 Score: 1/4 TESTED, 1 ACCEPTABLE, 2 UNTESTED**

---

### Journey 9: Developer Workflow (8 steps)

| Step | Name | Verdict | Evidence |
|------|------|:-------:|----------|
| 9.1-9.8 | Contract-First Workflow | **N/A** | Process workflow, not code. Validated by running the full test suite as part of Phase 3. All 25 integration tests serve as the validation gate. |

**J9 Score: N/A (meta-workflow)**

---

## Aggregate Scorecard

| Journey | Steps | Tested | Partial | Broken | Untested | Score |
|---------|:-----:|:------:|:-------:|:------:|:--------:|:-----:|
| J1 First Launch | 3 | 1 | 0 | 1 | 1 | 33% |
| J2 Open Project | 7 | 1 | 1 | 0 | 4 | 21% |
| J3 Governance Audit | 4 | 2 | 0 | 1 | 1 | 50% |
| J4 Export Gate | 5 | 5 | 0 | 0 | 0 | **100%** |
| J5 Canvas Interaction | 4 | 2 | 2 | 0 | 0 | 75% |
| J6 Recovery/Undo | 4 | 3 | 1 | 0 | 0 | 88% |
| J7 MCP Agent | 5 | 5 | 0 | 0 | 0 | **100%** |
| J8 Figma Import | 4 | 1 | 0 | 0 | 3 | 25% |
| **TOTAL** | **36** | **27** | **4** | **0** | **4** | **83%** |

**27 of 36 testable journey steps have working test coverage. 0 broken tests. 4 steps have partial coverage. 4 steps untested (3 acceptable, 1 remaining).**

---

## Remediation Complete — Remaining Gaps

All P0, P1, and P2 items are resolved. Remaining gaps are low-risk:

| Test | Journey Gap | Risk | Status |
|------|-------------|:----:|--------|
| Figma AST hydration | J8.3 | LOW | Requires full Babel transform pipeline mock |
| Figma asset storage | J8.4 | LOW | `/ingest-asset` is legacy endpoint |
| Preview iframe update | J5.4 | LOW | Requires ReactFlow + iframe mocking |
| RecoveryPanel UI | J6.4 | LOW | Git Time Machine UI interactions |

### Commandment Coverage (NEW — P1-CMD)

| Commandment | Tests | File |
|-------------|:-----:|------|
| **C15** (Granular AST Tools Only) | 14 | `orchestratorSafety.test.ts` — catalog structure, no raw-code fields, node-targeted mutation ops |
| **C16** (In-Memory Validation) | 46 | `orchestratorSafety.test.ts` — CIEDE2000 drift, flint-id tampering, compound class, LSP validation, prop type guards |

---

## Test Baseline (Post-Remediation + Phase ING)

| Suite | Count | Files |
|-------|:-----:|:-----:|
| MCP | 588 | 28 |
| Glass | 452 | 29 |
| Core | 319 | 12 |
| **Total** | **1,359** | **69** |
| TSC | 0 errors | — |

### Phase ING Tests Added

| File | Tests | Coverage |
|------|:-----:|----------|
| `electron/__tests__/IngestionAuditor.test.ts` | 24 | ING-01 through ING-12 + edge cases |
| `src/store/__tests__/importSummaryStore.test.ts` | 29 | Store state transitions, panel escalation, auto-dismiss |
| `src/components/ui/__tests__/ImportSummary.test.tsx` | 16 | Toast, panel, snap, dismiss, undo, auto-close |

```
Week 1: P0 — Fix 35 broken tests (1-2 hours)
         Update HANDOFF.md test baseline

Week 1: P1 — Write 5 critical missing tests (3-5 hours)
         App mount gate, project open chain, export audit,
         undo controller, canvas selection

Week 2: P2 — Write 6 pipeline tests (4-6 hours)
         fs.watch re-lint, Figma ingestion, cross-file undo,
         transplant, preview update

Week 3: P3 — Nice-to-have tests (2-3 hours)
```

After P0+P1: **46/36 journey steps covered** (Glass back to green + critical gaps filled)
After P0+P1+P2: **Coverage rises from 38% to ~83%**

---

## Commandment Coverage via Tests

| # | Commandment | Tested By | Gap |
|---|------------|-----------|-----|
| C1 | Code is Truth | Tests #11, #12, #13 | ✅ |
| C2 | No Hallucinated Styling | Tests #1, #10, MithrilLinter suite | ✅ |
| C3 | Composite IDs for Arrays | Test #18 (injectFlintIds) | ✅ |
| C4 | Local-First Only | No external URL test | ⚠️ No test asserts no external URLs in srcdoc |
| C5 | A11y = Compiler Error | Test #2, A11y suite (120+ tests) | ✅ |
| C6 | Gatekeeper Rule | Tests #1-4, policy-engine.test.ts | ✅ |
| C7 | ID Preservation | Test #11, #18 | ✅ |
| C8 | Audit-First | Implicit in MCP workflow | ⚠️ No explicit orchestrator test |
| C9 | CIEDE2000 | Test #10, MithrilLinter.test.ts | ✅ |
| C10 | Targeted Micro-Recovery | Test #12 (inverse) | ⚠️ Pre-flight node check not explicitly tested |
| C11 | Surgical Git Transplants | Test #14 (gitShow) | ⚠️ transplantNode not tested |
| C12 | Atomic Queuing | Test #13, FTM suite (25+ tests) | ✅ |
| C13 | Deterministic Surgery | All AST tests use Babel | ✅ |
| C14 | Bypass Prohibition | Implicit (no fs in src/ tests) | ⚠️ No boundary violation test |
| C15 | Granular AST Tools | Not tested (orchestrator) | ❌ No test validates tool catalog constraint |
| C16 | In-Memory Validation | Not tested (orchestrator) | ❌ No test validates TSC loop |

**C15 and C16 are completely untested.** These are the AI safety Commandments — the orchestrator's constraints have zero test coverage.
