# Sprint Clarity 2 — Contract Artifact

**Phase:** CLARITY-2
**Date:** 2026-03-29
**Owner:** flint-architect
**Status:** APPROVED
**Depends on:** Sprint Clarity 1 (SHIPPED)

## Sprint Goal

Turn passive indicators into active coaching surfaces. The health ring tells you what to do, tabs explain themselves, MCP tools guide next steps, and every surface speaks the same language.

---

## Feature Budget 6-Gate Check

| Item | Gate 1: Who | Gate 2: Behavior | Gate 3: 80% or 5%? | Gate 4: Maintenance | Gate 5: Validate w/o building? | Gate 6: Trade-off |
|------|-------------|------------------|---------------------|---------------------|-------------------------------|-------------------|
| 1. Health Ring Next Step | Designer (Glass) | User can see what's pulling their score down and what to do about it | 80% — every session | Low (pure derived text) | No — needs live data | Defers Sprint 6 canvas work |
| 2. Tab Unlock Narration | Designer (Glass) | User understands why a new tab appeared | 80% — every first encounter | Low (localStorage + text) | No — timing matters | Defers Sprint 6 canvas work |
| 3. Response Shaping Extension | Both (MCP engine) | AI agents receive actionable next steps from all tools | 80% — every tool call | Low (string append) | Already validated on 3 tools | Defers Sprint 6 canvas work |
| 4. Shared Health Signal | Both (Glass + CLI) | Same 3-number summary in both Glass and CLI | 80% — every debt check | Low (shared function) | Yes — compare outputs now | Defers Sprint 6 canvas work |
| 5. Progressive Tool Surfacing | Both (MCP engine) | New agents see only the 5 most relevant tools | 5% demo moment BUT differentiator | Medium (context-dependent logic) | Could ship static top-5 first | Defers Sprint 6 canvas work |

All 5 items pass. Item 5 is a demo moment but justified as an MCP-ecosystem differentiator.

---

## Item 1: Health Ring "Next Step" Prompt

**What it does:** Below the grade letter inside the score accordion, add one dynamic sentence that names the top issue category and tells the user how to fix it.

**Data source:** Already computed — `mithrilCount`, `a11yCount`, `overrideCount`, `topRules`, `score` are all available in the component. The `scoreTrendHint` memo (line 603) already computes a similar string but it's generic. We replace it with a richer, action-oriented sentence.

**Copy rules:**
- Score 100: "Perfect score — your design system is fully in sync."
- Score >= 90, issues exist: "Nearly perfect. {N} {category} {issues} remain — say 'fix it' in your IDE to clean up."
- a11y issues dominate: "{N} accessibility gaps are pulling your score down. Run an a11y audit for details."
- mithril issues dominate: "{N} color drifts are lowering your score. Say 'fix it' in your IDE to auto-remediate."
- overrides dominate: "{N} rule overrides are active. Review them in the Governance panel to restore full compliance."
- mixed: "{N} drifts and {M} accessibility gaps need attention. Start with accessibility — it has the biggest score impact."

**Affected files:**

| File | Change | Owner |
|------|--------|-------|
| `src/components/ui/GovernanceDashboard.tsx` | MODIFY — add `nextStepPrompt` useMemo + render below grade letter | flint-design-engineer |
| `src/components/ui/__tests__/GovernanceDashboard.nextstep.test.tsx` | CREATE — test all 6 copy variants | flint-test-writer |

**Acceptance criteria:**
1. A single sentence appears below the grade letter inside the score accordion section
2. The sentence is dynamic — it changes based on violation counts
3. All 6 copy variants are covered by tests
4. The sentence includes an actionable verb ("say", "run", "review")
5. `data-testid="next-step-prompt"` for test targeting

**Process boundary:** None. Renderer-only.

---

## Item 2: Tab Unlock Narration

**What it does:** When a right-sidebar tab appears for the first time (tokens tab unlocking), show a tooltip below the tab button explaining what it does and why it appeared.

**Existing infra:** `useOnboardingTooltip(key)` returns `{ shouldShow, dismiss }`. Persists to localStorage. Already used elsewhere.

**Tab narration copy:**
- `tokens`: "Tokens loaded — this tab shows your design tokens and lets you search them."
- `health` (governance): Always unlocked, no narration needed.
- `properties`: Always unlocked, no narration needed.

Only the `tokens` tab currently unlocks dynamically (on first token load). Future tabs will use the same pattern.

**Implementation:** In App.tsx where tabs render (line 969-1000), wrap newly-unlocked tabs with a small tooltip component that calls `useOnboardingTooltip('tab-unlock-tokens')`.

**Affected files:**

| File | Change | Owner |
|------|--------|-------|
| `src/App.tsx` | MODIFY — add tooltip wrapper around dynamically-unlocked tab buttons | flint-design-engineer |
| `src/components/ui/TabUnlockTooltip.tsx` | CREATE — small tooltip component using useOnboardingTooltip | flint-design-engineer |
| `src/components/ui/__tests__/TabUnlockTooltip.test.tsx` | CREATE — renders tooltip, dismiss hides it | flint-test-writer |

**Acceptance criteria:**
1. When the tokens tab appears for the first time, a tooltip shows "Tokens loaded — this tab shows your design tokens and lets you search them."
2. Tooltip has a dismiss button (X or click-away)
3. After dismiss, the tooltip never appears again (localStorage persistence)
4. No tooltip on always-visible tabs (governance, properties)
5. TSC 0 errors

**Process boundary:** None. Renderer-only.

---

## Item 3: Extend Response Shaping to All Actionable MCP Tools

**What it does:** Add `recommendation` or `nextStep` fields to all MCP tool responses that return actionable results.

**Already shaped (Sprint Clarity 1):**
- `flint_get_context` — has `nextStep`
- `audit_ui_component` — has `recommendation`
- `flint_audit` — has `recommendation`

**Tools to shape in this sprint:**

| Tool | File | Shape field | Example |
|------|------|-------------|---------|
| `flint_fix` | `fix.ts` | `recommendation` | "Fixed 5 drifts. Run 'audit' to verify compliance." / "0 fixable issues — nothing to remediate." |
| `flint_debt_report` | `debtReport.ts` | `recommendation` | "Grade C — focus on the 12 color drifts in Button.tsx to reach B." / "Grade A — your project is healthy." |
| `flint_accessibility_report` | `accessibility.ts` | `recommendation` | "3 WCAG failures found. Say 'fix it' to auto-remediate, or 'explain' for details." / "Full WCAG compliance." |
| `flint_swarm_audit_fix` | `swarm.ts` | `recommendation` | "Cleaned 14 files. 3 files still have unfixable issues — review manually." |
| `flint_migrate_tw` | `server.ts` (inline handler) | `recommendation` | "Migration complete. Run 'audit' to check for residual drift." |
| `flint_sync_check` | `sync.ts` | `recommendation` | "2 tokens drifted from Figma. Run 'sync pull' to update." / "All tokens in sync." |
| `flint_risk_score` | (in `server.ts`) | `recommendation` | "Amber risk — consider reviewing before applying." / "Green — safe to proceed." |
| `flint_generate_dbom` | `dbom.ts` | `recommendation` | "DBOM exported. Share with stakeholders or attach to your PR." |

**Affected files:**

| File | Change | Owner |
|------|--------|-------|
| `flint-mcp/src/tools/fix.ts` | MODIFY — add `recommendation` to response | flint-ast-surgeon |
| `flint-mcp/src/tools/debtReport.ts` | MODIFY — add `recommendation` to response | flint-ast-surgeon |
| `flint-mcp/src/tools/accessibility.ts` | MODIFY — add `recommendation` to response | flint-ast-surgeon |
| `flint-mcp/src/tools/swarm.ts` | MODIFY — add `recommendation` to response | flint-ast-surgeon |
| `flint-mcp/src/tools/sync.ts` | MODIFY — add `recommendation` to sync_check handler | flint-ast-surgeon |
| `flint-mcp/src/tools/dbom.ts` | MODIFY — add `recommendation` to response | flint-ast-surgeon |
| `flint-mcp/src/server.ts` | MODIFY — add `recommendation` to risk_score handler | flint-ast-surgeon |
| `flint-mcp/src/tools/__tests__/response-shaping.test.ts` | CREATE — test recommendation field on all 8 tools | flint-test-writer |

**Acceptance criteria:**
1. All 8 tools above include a `recommendation` or `nextStep` string in their response
2. The string is plain English, action-oriented, and under 200 characters
3. Each tool has at least 2 test cases (issues found vs. clean)
4. Existing MCP tests still pass
5. TSC 0 errors

**Process boundary:** None. MCP engine only.

---

## Item 4: Shared Health Signal (Glass + CLI)

**What it does:** Both GovernanceDashboard and `flint-gate debt` display the same 3-number health summary with consistent labels: **Fidelity Score**, **Accessibility Score**, **Override Count**.

**Current state:**
- Glass: shows `score` (computed), grade letter, mithrilCount, a11yCount, overrideCount — but no "Fidelity Score" or "Accessibility Score" labels
- CLI: shows `healthScore`, `grade`, `totalViolations` — different decomposition

**Design:**
- Extract a pure function `formatHealthSignal(mithrilCount, a11yCount, overrideCount)` that returns `{ fidelityScore, a11yScore, overrideCount, grade, overallScore }` where:
  - `fidelityScore = max(0, 100 - mithrilCount * 5)`
  - `a11yScore = max(0, 100 - a11yCount * 10)`
  - `overallScore = computeHealthScore(mithrilCount, a11yCount, overrideCount)`
- Glass uses this in GovernanceDashboard to label the breakdown rows
- CLI uses this in `debt.ts` stderr summary

**Shared type location:** `shared/healthSignal.ts` — a new file with zero dependencies (pure math).

**Affected files:**

| File | Change | Owner |
|------|--------|-------|
| `shared/healthSignal.ts` | CREATE — pure function + types | flint-state-architect |
| `shared/__tests__/healthSignal.test.ts` | CREATE — unit tests for all score computations | flint-test-writer |
| `src/components/ui/GovernanceDashboard.tsx` | MODIFY — import and use `formatHealthSignal`, update breakdown labels | flint-design-engineer |
| `flint-ci/src/commands/debt.ts` | MODIFY — import `formatHealthSignal`, update stderr summary labels | flint-design-engineer |

**Acceptance criteria:**
1. `formatHealthSignal` is a pure function with no imports beyond types
2. Glass and CLI both display "Fidelity: X/100", "Accessibility: Y/100", "Overrides: N"
3. The function is tested independently (boundary: 0 issues, 1 issue, many issues, overflow clamping)
4. TSC 0 errors

**Process boundary:** None. Shared pure function consumed by both renderer and CLI.

---

## Item 5: Progressive MCP Tool Surfacing

**What it does:** The `flint://capabilities` resource and `flint_get_context` response include a `suggestedTools` array (max 5) derived from project state.

**Suggestion rules (priority order):**

| Condition | Suggested tool | Why |
|-----------|---------------|-----|
| No tokens exist (`tokens.totalCount === 0`) | `flint_extract_tokens` | Can't govern without tokens |
| No manifest exists | `flint_reindex_registry` | Registry needs seeding |
| Violations exist (`violations.mithrilCount > 0`) | `flint_fix` | Most common next action |
| A11y violations exist (`violations.a11yCount > 0`) | `flint_accessibility_report` | Understand what's wrong |
| Health score < 70 | `flint_debt_report` | See the big picture |
| Figma not connected | `flint_figma_connect` | Unlock sync workflow |
| Everything clean | `flint_audit` | Verify compliance |

Pick top 5 from this priority list based on which conditions are true.

**Affected files:**

| File | Change | Owner |
|------|--------|-------|
| `flint-mcp/src/core/toolSuggester.ts` | CREATE — `suggestTools(context: SessionContext): string[]` | flint-ast-surgeon |
| `flint-mcp/src/core/__tests__/toolSuggester.test.ts` | CREATE — test all 7 conditions | flint-test-writer |
| `flint-mcp/src/core/sessionContext.ts` | MODIFY — call `suggestTools()` and add to SessionContext | flint-ast-surgeon |
| `flint-mcp/src/core/capabilities/index.ts` | MODIFY — include `suggestedTools` in capabilities response | flint-ast-surgeon |
| `flint-mcp/src/types.ts` | MODIFY — add `suggestedTools?: string[]` to SessionContext type | flint-ast-surgeon |

**Acceptance criteria:**
1. `flint_get_context` response includes `suggestedTools: string[]` (max 5 entries)
2. `flint://capabilities` response includes `suggestedTools` when context is available
3. Each suggestion rule is tested independently
4. Empty project gets `flint_extract_tokens` + `flint_reindex_registry`
5. Clean project gets `flint_audit`
6. TSC 0 errors

**Process boundary:** None. MCP engine only.

---

## Commandment Checklist

| # | Commandment | Applies? | How satisfied |
|---|------------|----------|--------------|
| 1 | Code is Truth | No | No AST mutations in this sprint |
| 2 | No Hallucinated Styling | Yes (Item 2) | TabUnlockTooltip uses design tokens for colors/spacing, no hardcoded values |
| 4 | Local-First Only | No | No network calls |
| 9 | CIEDE2000 | No | No color logic changes |
| 13 | Deterministic Surgery | No | No code modification |

This sprint is entirely UI text, MCP response shaping, and pure functions. No commandments are at risk.

---

## Implementation Order

**Group A (all parallel — no shared files):**
- Item 1: `flint-design-engineer` — Health ring next step (GovernanceDashboard.tsx)
- Item 2: `flint-design-engineer` — Tab unlock narration (App.tsx + new component)
- Item 3: `flint-ast-surgeon` — Response shaping extension (flint-mcp/src/tools/*)
- Item 4: `flint-state-architect` + `flint-design-engineer` — Shared health signal (shared/ + GovernanceDashboard + debt.ts)
- Item 5: `flint-ast-surgeon` — Progressive tool surfacing (flint-mcp/src/core/*)

**Dependencies:**
- Item 4 modifies GovernanceDashboard.tsx (same as Item 1). Run Item 4's shared/ function first, then Item 1 and Item 4's Glass integration can merge sequentially. OR: Item 1 goes first (smaller change), Item 4 follows.
- All other items are fully independent.

**Recommended sequence:**
1. Items 2, 3, 5 — fully parallel, zero overlap
2. Item 4 shared function — parallel with above
3. Item 1 + Item 4 Glass/CLI wiring — after Item 4 shared function lands; Item 1 first, then Item 4 GovernanceDashboard changes

---

## IPC Channels

None. No new IPC channels in this sprint.

---

## Store Contracts

None. No new store state in this sprint. All data is already available in existing stores.

---

## Component Contracts

| Component | File | Props | Store Dependencies | IPC Calls |
|-----------|------|-------|--------------------|-----------|
| `TabUnlockTooltip` | `src/components/ui/TabUnlockTooltip.tsx` | `{ tooltipKey: string; text: string; children: ReactNode }` | None (uses useOnboardingTooltip hook) | None |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Item 1 + Item 4 both touch GovernanceDashboard.tsx | Low | Sequence: Item 1 first, Item 4 Glass wiring second |
| Response shaping bloats MCP response size | Low | Each `recommendation` is a single sentence < 200 chars |
| Tool suggestion logic becomes stale as tools are added | Low | `toolSuggester.ts` is a single file — easy to update |
| `shared/healthSignal.ts` import path differs between Electron and CLI | Medium | Use relative imports; both `src/` and `flint-ci/` can reach `shared/` |

---

## What Is NOT In Scope

1. New store slices or state shapes
2. New IPC channels
3. Changes to the linter engine, AST service, or recovery controller
4. CLI language changes (still says "violations" for developers)
5. UI layout or panel changes beyond the tooltip and one-line text additions
6. Figma integration changes
7. Canvas rendering changes
