# Contract Lint Report: Sprint Clarity 2

**Contract:** `docs/contracts/SPRINT-CLARITY-2.md`
**Executable:** `docs/contracts/sprint-clarity-2.contract.ts`
**Linted:** 2026-03-29
**Linter:** flint-contract-linter

---

## Verdict: REVISE

| Check | Result | Issues |
|-------|--------|--------|
| Compiles | PASS | 0 TSC errors |
| Completeness | PASS | All required sections present |
| Impact Map | FAIL | `flint_migrate_tw` file attribution wrong in markdown; CREATE files correctly absent |
| IPC Triangles | PASS | No IPC channels — correctly empty |
| Store Coherence | PASS | No store changes — correctly empty |
| Test Boundaries | FAIL | 5 of 8 Item 3 shaped tools have no test boundary entries |
| Commandments | FAIL | C2 (No Hallucinated Styling) missing — new visual component added |
| Parallelism Safety | PASS | File conflict between Groups A and C is sequenced correctly |
| MD ↔ TS Consistency | PASS | Impact map, types, and commandments agree between files |

---

## Issues (REVISE)

### 1. [BLOCKING] `flint_migrate_tw` file attribution is wrong in the markdown

In the "Tools to shape" table at Item 3 (line 112 of the markdown), `flint_migrate_tw` is listed as living in `migrateConfig.ts`. That is incorrect. `migrateConfig.ts` handles `flint_migrate_config`. The `flint_migrate_tw` handler is inline in `flint-mcp/src/server.ts` (verified at line 3139).

The formal impact table in the markdown (and the `.contract.ts` impact array) correctly lists only `flint-mcp/src/server.ts` as a MODIFY target, but attributes it solely to `flint_risk_score`. An agent reading the tool description table will go to the wrong file.

**Fix required:** In the "Tools to shape" table, change `flint_migrate_tw`'s file column from `migrateConfig.ts` to `server.ts`. The impact map entry for `flint-mcp/src/server.ts` should also clarify that it covers both `flint_risk_score` and `flint_migrate_tw`.

---

### 2. [BLOCKING] Test boundaries missing for 5 of 8 Item 3 shaped tools

The `testBoundaries` array in the `.contract.ts` defines test boundaries for only 3 of the 8 tools that receive response shaping in Item 3: `flint_fix`, `flint_debt_report`, and `flint_accessibility_report`. The following 5 tools have no test boundary entry:

- `flint_swarm_audit_fix`
- `flint_migrate_tw`
- `flint_sync_check`
- `flint_risk_score`
- `flint_generate_dbom`

The contract schema requires at least one test boundary per new public API surface. Each of these tools gains a new `recommendation` field — that is a new public API surface. The acceptance criterion in the markdown says "each tool has at least 2 test cases (issues found vs. clean)", confirming coverage is expected. The `testBoundaries` array is the machine-readable specification `flint-test-writer` scaffolds from — omitting these 5 means the test scaffolds will be incomplete.

**Fix required:** Add one `TestBoundary` entry per missing tool (5 entries). Each must include `edgeCases` covering at minimum: result-present case and clean/empty case.

---

### 3. [BLOCKING] Commandment C2 (No Hallucinated Styling) not listed but applies

Item 2 creates `TabUnlockTooltip.tsx` — a new visible UI component. The 16 Commandments state that any visual change requires C2 (No Hallucinated Styling: every visual edit tied to a `design_token`). The new tooltip component will render text and a dismiss button with Tailwind CSS classes. If those classes are not tied to design tokens, it violates C2.

The contract's commandment list contains only `[4]` (Local-First Only). C2 must be added, and the "How satisfied" column in the markdown commandment table must state how the tooltip's styling is token-compliant (e.g., "uses only existing Tailwind utility classes from the design token system, no hardcoded hex or raw pixel values").

**Fix required:** Add `2` to the `commandments` array in the `.contract.ts`. Add a C2 row to the commandment checklist table in the markdown with how it is satisfied.

---

## Warnings (not blocking — approve after blocking issues are fixed)

### W1. `overallScore` not defined in `FormatHealthSignal` contract

The `HealthSignal` interface includes `overallScore` but the `FormatHealthSignal` function type signature does not document how `overallScore` differs from the weighted `computeHealthScore` already in the Glass codebase. The markdown references `computeHealthScore(mithrilCount, a11yCount, overrideCount)` as the formula, but that function is not imported or typed in the contract. The implementing agent may need to re-derive this formula.

Recommendation: Add a comment in the `.contract.ts` specifying the `overallScore` formula explicitly, or reference the existing function by file path.

### W2. Group A assigns both Items 1 and 2 to `flint-design-engineer` simultaneously

The parallelism group A lists `flint-design-engineer` as the sole implementation agent for both Item 1 (GovernanceDashboard.tsx) and Item 2 (App.tsx + TabUnlockTooltip.tsx). A single agent cannot safely modify two files in true parallel — in practice this means the agent will serialize them. This is fine operationally but the contract implies parallelism that does not exist within one agent's execution. No action required unless a second design engineer agent is available.

### W3. Item 4 `debt.ts` owner is `flint-design-engineer` but work is in a CLI command file

`flint-ci/src/commands/debt.ts` is a CLI output formatter. Assigning it to `flint-design-engineer` is unusual — CLI output is typically owned by `flint-ast-surgeon` or `flint-state-architect`. This will work but may confuse agents about scope boundaries. Low severity.

---

## What Phase 2 Agents Can Rely On (once APPROVED)

- All types in `sprint-clarity-2.contract.ts` compile cleanly (0 TSC errors confirmed)
- All MODIFY files verified to exist on disk
- All CREATE files verified to be absent (clean slate for new files)
- No IPC channels — process boundary is clean
- No store mutations — no cross-store contamination risk
- Parallelism sequencing (A → C for GovernanceDashboard) is correct
- `useOnboardingTooltip` hook confirmed at `src/hooks/useOnboardingTooltip.ts`
- `flint_migrate_tw` confirmed inline in `flint-mcp/src/server.ts` (not `migrateConfig.ts`)
