# Sprint Clarity — Contract Artifact

**Phase:** CLARITY
**Date:** 2026-03-29
**Owner:** flint-architect
**Status:** APPROVED

## Sprint Goal

Make Flint discoverable and approachable by softening language, enriching MCP responses with next steps, adding a conversational CLI entry point, and wiring the onboarding prompt to the workflow guide.

---

## Item 1: Language Pass — "violations" to "drift" in Glass UI

**Scope:** User-facing strings only in `src/components/**` and `src/store/**`. Variable names, function names, IPC channels, file names, and type names are NOT renamed.

**Vocabulary mapping:**
| Before | After |
|--------|-------|
| "violation(s)" (user-facing label) | "drift" or "gap(s)" |
| "N Mithril Violation(s)" | "N Design Drift Issues" (already done in StatusBar) |
| "violations" in GovernanceDashboard headings/labels | "drift items" or "gaps" |
| "violation" in tooltip text, aria-labels, button labels | "drift" or "gap" |

**Keep "violations" in:**
- MCP tool responses (developer audience)
- CLI output (developer audience)
- Code identifiers (variables, types, store keys, IPC channels)
- Test assertion strings that match code identifiers

**Affected files (MODIFY):**

| File | Owner | What changes |
|------|-------|-------------|
| `src/components/ui/GovernanceDashboard.tsx` | flint-design-engineer | User-facing strings: headings, labels, tooltips, confirmation messages |
| `src/components/editor/StatusBar.tsx` | flint-design-engineer | Chip labels, tooltip text, aria-labels |
| `src/components/ui/ExportModal.tsx` | flint-design-engineer | Export gate messaging |
| `src/components/ui/CommandPalette.tsx` | flint-design-engineer | Command descriptions |
| `src/components/ui/LaunchScreen.tsx` | flint-design-engineer | Onboarding text |
| `src/components/ui/DemoWalkthrough.tsx` | flint-design-engineer | Demo step descriptions |
| `src/components/ui/PolicySettings.tsx` | flint-design-engineer | Policy UI labels |
| `src/components/ui/LayerTree.tsx` | flint-design-engineer | Tooltip/badge text |
| `src/components/ui/PropertiesPanel.tsx` | flint-design-engineer | Label text |
| `src/components/ui/BetaWelcome.tsx` | flint-design-engineer | Welcome copy |
| `src/components/mithril/MithrilProvider.tsx` | flint-design-engineer | User-facing messages |
| `src/hooks/useOnboardingTooltip.ts` | flint-design-engineer | Tooltip copy |
| `src/hooks/useMCPEventListener.ts` | flint-design-engineer | User-facing notification text (if any) |

**NOT affected:** `src/store/canvasStore.ts` (store key `mithrilViolations` stays), `src/core/MithrilLinter.ts` (code identifier), all test files (update only if they assert on rendered user-facing text).

**Acceptance criteria:**
1. Zero occurrences of user-facing "violation" in Glass UI (search rendered strings, not code identifiers)
2. All existing tests pass (update test assertions that match rendered text)
3. TSC 0 errors
4. MCP/CLI output still says "violations"

**Process boundary:** None. Renderer-only change.

---

## Item 2: Fidelity-First MCP Response Shaping

**Scope:** Add a `nextStep` plain-English sentence to MCP tool responses.

**Affected files (MODIFY):**

| File | Owner | What changes |
|------|-------|-------------|
| `flint-mcp/src/server.ts` | flint-ast-surgeon | `flint_get_context` handler — append `nextStep` field when violations exist |
| `flint-mcp/src/server.ts` | flint-ast-surgeon | `audit_ui_component` handler — append `recommendation` field to response |
| `flint-mcp/src/server.ts` | flint-ast-surgeon | `flint_audit` handler — append `recommendation` field to response |

**Response shaping rules:**
- `flint_get_context`: If `violations.length > 0`, add `"nextStep": "Run 'audit my component' on <top-violated-file> to see what Mithril flagged, then say 'fix it' to auto-remediate."`
- `audit_ui_component`: Always add `"recommendation"` based on verdict — if BLOCKED: `"Say 'fix it' to auto-remediate the <N> issues Mithril found."` If APPROVED: `"Clean bill of health. No action needed."`
- `flint_audit`: Same pattern as `audit_ui_component`.

**Acceptance criteria:**
1. `flint_get_context` response includes `nextStep` when violations present, omits it when clean
2. `audit_ui_component` response includes `recommendation` field always
3. `flint_audit` response includes `recommendation` field always
4. Existing MCP tests pass; new tests cover the added fields
5. TSC 0 errors

**Process boundary:** None. MCP engine only.

---

## Item 3: `flint-gate help` CLI Command

**Scope:** New `help` subcommand in flint-ci CLI that prints a conversational "pick your situation" guide.

**Affected files:**

| File | Change | Owner |
|------|--------|-------|
| `flint-ci/src/commands/help.ts` | CREATE | flint-design-engineer |
| `flint-ci/src/cli.ts` | MODIFY | flint-design-engineer |
| `flint-ci/src/__tests__/help.test.ts` | CREATE | flint-test-writer |

**The 7 situations:**
1. "I just installed Flint" -> `flint-gate init` + `flint-gate audit`
2. "I want to check my component" -> `flint-gate audit src/MyComponent.tsx`
3. "I want to fix drift automatically" -> `flint-gate fix --no-dry-run`
4. "I want to add Flint to CI" -> `flint-gate audit --format sarif`
5. "I want to track design debt over time" -> `flint-gate debt --track`
6. "I want to adopt Flint incrementally" -> `flint-gate baseline` + `flint-gate audit --baseline`
7. "I want to export a governance snapshot" -> `flint-gate dbom`

**Output format:** Plain text, no flags list. Conversational narrative with the exact command to run for each situation.

**Acceptance criteria:**
1. `flint-gate help` prints all 7 situations to stdout
2. Exit code 0
3. No external dependencies added
4. Test covers output contains all 7 situation headers
5. TSC 0 errors

**Process boundary:** None. CLI only.

---

## Item 4: Wire Workflow Guide to Onboard-Project

**Scope:** When `flint-onboard-project` runs, it should invoke the workflow guide with the user's stated goal after setup completes.

**Affected files (MODIFY):**

| File | Owner | What changes |
|------|-------|-------------|
| `flint-mcp/src/prompts/onboard-project.ts` | flint-ast-surgeon | Add step 6: invoke workflow guide with detected intent |

**Wiring logic:**
- After step 5 (the final message), add: "If the user stated a specific goal (e.g., 'I want to import a Figma design'), invoke the `flint-workflow-guide` prompt with that goal as the `intent` argument to give them a focused next-step workflow."
- This is prompt text, not code logic. The LLM reading the prompt will follow the instruction.

**Acceptance criteria:**
1. `getOnboardProjectContent()` output includes a step referencing `flint-workflow-guide`
2. The step mentions passing the user's goal as `intent`
3. Existing onboard tests pass
4. TSC 0 errors

**Process boundary:** None. MCP prompts only.

---

## Process Boundary Analysis

| Item | Crosses Electron/Renderer? | IPC changes? |
|------|---------------------------|-------------|
| 1 — Language pass | No | None |
| 2 — Response shaping | No | None |
| 3 — CLI help | No | None |
| 4 — Prompt wiring | No | None |

No items cross the process boundary. No new IPC channels needed.

---

## Testing Requirements

| Item | Test type | Location |
|------|-----------|---------|
| 1 | Update existing Glass component tests that assert on "violation" text | `src/components/**/__tests__/` |
| 2 | New MCP tests for `nextStep`/`recommendation` fields | `flint-mcp/src/__tests__/` |
| 3 | New CLI test for help output | `flint-ci/src/__tests__/help.test.ts` |
| 4 | Update existing onboard prompt test (if any) for step 6 | `flint-mcp/src/prompts/__tests__/` |

---

## What Is NOT In Scope

1. Renaming code identifiers (`mithrilViolations`, `a11yViolations`, `LinterWarning`, etc.)
2. Renaming IPC channels or file names
3. Changing MCP tool names or resource URIs
4. Changing CLI output language (stays "violations" for developers)
5. New UI components or panels
6. New IPC channels
7. Any changes to the linter engine, AST service, or recovery controller
8. Store shape changes

---

## Commandment Checklist

| # | Commandment | Applies? | How satisfied |
|---|------------|----------|--------------|
| 1 | Code is Truth | No | No AST mutations |
| 4 | Local-First Only | No | No network calls |
| 13 | Deterministic Surgery | No | No code modification |

This sprint is entirely UI text, MCP response shaping, CLI output, and prompt text. No commandments are at risk.

---

## Implementation Order

**Group A (parallel):** Items 1, 3, 4 — independent, no shared files
- Item 1: `flint-design-engineer` — Glass language pass
- Item 3: `flint-design-engineer` — CLI help command
- Item 4: `flint-ast-surgeon` — Prompt wiring

**Group B (after A starts, parallel with A):** Item 2
- Item 2: `flint-ast-surgeon` — MCP response shaping (touches `server.ts` which item 4 does NOT touch)

All 4 items can run in parallel.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Language pass misses a rendered string | Low | Grep audit post-implementation; reviewer checks all 44 files from search |
| Test assertions break on renamed text | Low | Update test strings in same PR |
| Response shaping bloats MCP response size | Low | `nextStep`/`recommendation` are single sentences, <200 chars |
