# Contract: EXP.6 -- Accessibility Compliance Automation

## Architectural Summary

EXP.6 expands the A11yLinter from 10 rules to 50+ WCAG 2.1 AA rules, adds deterministic auto-fix for a subset of those rules, and introduces a new `flint_accessibility_report` MCP tool. This is the largest single expansion of the governance engine since Phase B.

### Key Architectural Decisions

**1. Single Source of Truth -- MCP-side owns the linter.**
Today the codebase has two near-identical A11yLinter files: `flint-mcp/src/core/A11yLinter.ts` (MCP server) and `src/core/A11yLinter.ts` (renderer). With 50+ rules and an auto-fix engine, maintaining two copies is untenable. The solution:
- The canonical implementation lives in `flint-mcp/src/core/a11y/` as a modular rule directory.
- The renderer-side `src/core/A11yLinter.ts` becomes a thin re-export facade that imports the shared rule definitions from a process-neutral shared types package. However, because the process boundary law prohibits the renderer from importing Node.js code, and the MCP server runs in a separate process entirely, the actual sharing mechanism is: **the MCP server is the single source of truth**, and the renderer-side linter is deprecated in favor of calling `flint_audit` via IPC or consuming `flint://violations/{filePath}` resources. For the transition period, we build a code-generation script (`scripts/sync-a11y-rules.ts`) that copies the rule catalog to `src/core/A11yLinter.ts` at build time.

**2. Modular rule files organized by WCAG success criterion category.**
A single 1500-line file is unmaintainable. Rules are organized into category modules under `flint-mcp/src/core/a11y/rules/`, each exporting a standard `A11yRule` interface. The linter becomes a rule runner that loads and executes all registered rules.

**3. Auto-fix is a separate concern from detection.**
Each rule optionally exports a `fix` function. The fix function receives the AST and the violation location, and returns the mutated AST. Fix functions are only called via the `flint_fix` tool or the new `flint_accessibility_report` tool with `autoFix: true`. Detection and fix are never coupled.

**4. `flint_accessibility_report` is a new dedicated tool, not an extension of `flint_audit`.**
Rationale: `flint_audit` returns a combined Mithril + A11y result optimized for the IDE workflow. The new tool returns a WCAG-structured compliance report with pass/fail per success criterion, compliance percentage, and is designed for compliance officers and CI/CD gates. Different audiences, different output shapes.

**5. Three-phase implementation (EXP.6a, EXP.6b, EXP.6c).**
- EXP.6a (30 rules): Core infrastructure + high-impact rules (names/labels, ARIA, contrast, landmarks, forms, headings). This phase delivers the modular architecture and auto-fix engine.
- EXP.6b (15 rules): Focus management, keyboard navigation, live regions, motion preferences.
- EXP.6c (10+ rules): Advanced semantic analysis, custom component ARIA patterns, document structure.

### Commandments That Apply

| # | Commandment | How Satisfied |
|---|------------|---------------|
| 5 | Accessibility is a Compiler Error | This IS the commandment. All new rules are `severity: 'critical'` and block export. |
| 6 | The Gatekeeper Rule | New A11y violations block export in ExportModal. Already enforced. |
| 9 | Process Boundary | New rules live in `flint-mcp/` (Node.js). Renderer gets results via IPC/MCP resource. |
| 13 | Deterministic Surgery | All rules use Babel AST traversal. Auto-fix uses Babel AST mutation. No regex. |
| 15 | Granular AST Tools Only | Auto-fix emits `flint_ast_mutate` ops, not raw code strings. |
| 16 | In-Memory Validation | Auto-fix output is type-checked before confirmation. |

---

## Impact Map

| File | Change Type | Owner Agent |
|------|------------|-------------|
| `flint-mcp/src/core/a11y/types.ts` | NEW FILE -- A11yRule interface, A11yViolation, A11yFixResult types | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/runner.ts` | NEW FILE -- Rule runner (loads rules, executes audit, aggregates results) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/helpers.ts` | NEW FILE -- Shared AST helpers (extracted from current A11yLinter) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/rules/names-labels.ts` | NEW FILE -- A11Y-001 through A11Y-006 (migrated + enhanced) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/rules/keyboard.ts` | NEW FILE -- A11Y-007, A11Y-020..025 (tab order, interactive keyboard) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/rules/structure.ts` | NEW FILE -- A11Y-008..A11Y-010 (tables, lang, headings, migrated + enhanced) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/rules/aria.ts` | NEW FILE -- A11Y-030..A11Y-042 (valid roles, required children/parent, required attrs) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/rules/landmarks.ts` | NEW FILE -- A11Y-050..A11Y-054 (main, nav, banner, contentinfo, complementary) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/rules/contrast.ts` | NEW FILE -- A11Y-060..A11Y-063 (AA ratio, APCA, large text, UI components) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/rules/forms.ts` | NEW FILE -- A11Y-070..A11Y-077 (fieldset/legend, error, required, autocomplete) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/rules/live-regions.ts` | NEW FILE -- A11Y-080..A11Y-083 (aria-live, aria-atomic, role=alert, aria-relevant) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/rules/motion.ts` | NEW FILE -- A11Y-090..A11Y-091 (prefers-reduced-motion, autoplay) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/fixer.ts` | NEW FILE -- Auto-fix engine: applies deterministic fixes via AST mutation | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/index.ts` | NEW FILE -- Public API barrel (re-exports runner, fixer, types) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/contrast-utils.ts` | NEW FILE -- APCA Lc calculation + WCAG 2.x AA contrast ratio helpers | flint-ast-surgeon |
| `flint-mcp/src/core/A11yLinter.ts` | MODIFY -- Delegate to new `a11y/runner.ts`, keep backward-compat API | flint-ast-surgeon |
| `flint-mcp/src/types.ts` | MODIFY -- Add `'a11y-fix'` to LinterWarning type union, add A11yReportResult type | flint-ast-surgeon |
| `flint-mcp/src/tools/accessibility.ts` | NEW FILE -- `flint_accessibility_report` tool handler | flint-ast-surgeon |
| `flint-mcp/src/server.ts` | MODIFY -- Register `flint_accessibility_report` tool + import | flint-electron-ipc |
| `flint-mcp/src/core/dashboard/debtReportService.ts` | MODIFY -- Update A11y scanning to use new runner | flint-ast-surgeon |
| `src/core/A11yLinter.ts` | MODIFY -- Delegate to shared rule definitions (build-time sync) | flint-ast-surgeon |
| `flint-mcp/src/core/a11y/__tests__/runner.test.ts` | NEW FILE -- Runner unit tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/fixer.test.ts` | NEW FILE -- Auto-fix unit tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/rules-names-labels.test.ts` | NEW FILE -- Names/labels rule tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/rules-aria.test.ts` | NEW FILE -- ARIA rule tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/rules-landmarks.test.ts` | NEW FILE -- Landmark rule tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/rules-contrast.test.ts` | NEW FILE -- Contrast rule tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/rules-forms.test.ts` | NEW FILE -- Forms rule tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/rules-keyboard.test.ts` | NEW FILE -- Keyboard rule tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/rules-live-regions.test.ts` | NEW FILE -- Live regions rule tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/rules-motion.test.ts` | NEW FILE -- Motion rule tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/contrast-utils.test.ts` | NEW FILE -- APCA/WCAG contrast math tests | flint-test-writer |
| `flint-mcp/src/core/a11y/__tests__/accessibility-tool.test.ts` | NEW FILE -- MCP tool integration tests | flint-test-writer |

---

## Type Contracts (Source of Truth for Phase 2)

### Core Types -- `flint-mcp/src/core/a11y/types.ts`

```typescript
import type { File as BabelFile, JSXOpeningElement, JSXElement } from '@babel/types'
import type { NodePath } from '@babel/traverse'

/**
 * WCAG 2.1 success criterion identifier.
 * Format: "X.Y.Z" (e.g., "1.1.1", "2.4.7")
 */
export type WCAGCriterion = string

/**
 * Rule severity. All A11y rules default to 'critical' per Commandment 5.
 * 'warning' is reserved for WCAG AAA or informational best-practice rules.
 */
export type A11yRuleSeverity = 'critical' | 'warning' | 'info'

/**
 * Rule category for organizational grouping.
 */
export type A11yRuleCategory =
    | 'names-labels'      // SC 1.1.1, 1.3.1, 4.1.2
    | 'keyboard'          // SC 2.1.1, 2.1.2, 2.4.3, 2.4.7
    | 'structure'         // SC 1.3.1, 2.4.1, 2.4.6, 2.4.10
    | 'aria'              // SC 4.1.2, 1.3.1
    | 'landmarks'         // SC 1.3.1, 2.4.1
    | 'contrast'          // SC 1.4.3, 1.4.6, 1.4.11
    | 'forms'             // SC 1.3.1, 3.3.1, 3.3.2
    | 'live-regions'      // SC 4.1.3
    | 'motion'            // SC 2.3.1, 2.3.3

/**
 * A single A11y rule definition.
 * Each rule module exports an array of these.
 */
export interface A11yRule {
    /** Unique rule identifier (e.g., "A11Y-001"). */
    id: string
    /** Human-readable rule name. */
    name: string
    /** WCAG 2.1 success criterion this rule maps to. */
    wcag: WCAGCriterion
    /** WCAG conformance level. */
    level: 'A' | 'AA' | 'AAA'
    /** Organizational category. */
    category: A11yRuleCategory
    /** Default severity. */
    severity: A11yRuleSeverity
    /** Human-readable description of what the rule checks. */
    description: string
    /**
     * The detection function. Called once per JSXElement during traversal.
     * Returns null if no violation, or an A11yViolationDetail if violated.
     *
     * For rules that need document-level context (e.g., heading order,
     * landmark presence), use `auditDocument` instead.
     */
    visitElement?: (
        path: NodePath<JSXElement>,
        context: A11yRuleContext,
    ) => A11yViolationDetail | null
    /**
     * Document-level audit. Called once after full traversal with
     * accumulated context. Used for rules that need global view
     * (e.g., "page must have <main>", heading order).
     */
    auditDocument?: (context: A11yRuleContext) => A11yViolationDetail[]
    /**
     * Optional deterministic auto-fix function.
     * Returns the fix description and the AST mutations to apply.
     * If undefined, the rule is detection-only.
     */
    fix?: (
        violation: A11yViolationDetail,
        ast: BabelFile,
    ) => A11yFixResult | null
}

/**
 * Accumulated context passed to each rule during traversal.
 * Rules can read and write to this to share state (e.g., heading tracker).
 */
export interface A11yRuleContext {
    /** File path being audited. */
    filePath: string
    /** All heading levels encountered so far, in document order. */
    headingLevels: number[]
    /** Set of landmark roles encountered (main, nav, banner, contentinfo). */
    landmarksFound: Set<string>
    /** Map of element flint-id to its ARIA role (explicit or implicit). */
    elementRoles: Map<string, string>
    /** Map of id attribute values to their flint-ids (for label associations). */
    idToElementMap: Map<string, string>
    /** Set of aria-labelledby / htmlFor target IDs referenced in the document. */
    labelTargetIds: Set<string>
    /** Design tokens (for contrast checking). */
    tokens: import('../../types.js').DesignToken[]
    /** Extracted className-to-color mappings for contrast analysis. */
    colorContext: Map<string, { foreground: string | null; background: string | null; fontSize: string | null; fontWeight: string | null }>
}

/**
 * Detail object for a single violation.
 */
export interface A11yViolationDetail {
    /** The rule ID that was violated (e.g., "A11Y-001"). */
    ruleId: string
    /** The flint-id of the offending element (or positional fallback). */
    elementId: string
    /** Human-readable violation message with remediation guidance. */
    message: string
    /** Severity inherited from the rule. */
    severity: A11yRuleSeverity
    /** WCAG criterion. */
    wcag: WCAGCriterion
    /** Whether this violation has a deterministic auto-fix available. */
    fixable: boolean
}

/**
 * Result of applying an auto-fix.
 */
export interface A11yFixResult {
    /** Description of what the fix did. */
    description: string
    /**
     * The mutations to apply via flint_ast_mutate.
     * Each mutation maps to a catalog op (updateProp, updateClassName, wrap, inject).
     */
    mutations: A11yFixMutation[]
}

/**
 * A single AST mutation produced by an auto-fix.
 * These map 1:1 to flint_ast_mutate operation types.
 */
export interface A11yFixMutation {
    type: 'updateProp' | 'updateClassName' | 'wrap' | 'inject' | 'delete'
    args: Record<string, unknown>
}

/**
 * The output of a full accessibility audit.
 */
export interface A11yAuditResult {
    /** File path audited. */
    filePath: string
    /** Total rules evaluated. */
    totalRules: number
    /** Number of rules that passed (no violations found). */
    passed: number
    /** Number of rules that failed (at least one violation). */
    failed: number
    /** Compliance percentage: passed / totalRules * 100. */
    compliancePercent: number
    /** All violations found, grouped by rule ID. */
    violations: A11yViolationDetail[]
    /** Per-criterion pass/fail breakdown. */
    criterionResults: A11yCriterionResult[]
    /** Number of violations with available auto-fixes. */
    fixableCount: number
    /** ISO 8601 timestamp. */
    timestamp: string
}

/**
 * Pass/fail result for a single WCAG success criterion.
 */
export interface A11yCriterionResult {
    /** WCAG criterion (e.g., "1.1.1"). */
    criterion: WCAGCriterion
    /** Human-readable criterion name. */
    name: string
    /** Conformance level. */
    level: 'A' | 'AA' | 'AAA'
    /** Whether all rules for this criterion passed. */
    passed: boolean
    /** Rule IDs that failed for this criterion. */
    failedRules: string[]
    /** Total violations for this criterion. */
    violationCount: number
}
```

### Updated LinterWarning type -- `flint-mcp/src/types.ts`

```typescript
export interface LinterWarning {
    id: string
    type: 'color-drift' | 'typography-drift' | 'spacing-drift' | 'shadow-drift' | 'opacity-drift' | 'a11y'
    severity: 'amber' | 'critical'
    value: number
    message: string
    nearestToken: string | null
    nearestTokenValue: string | null
    /** WCAG criterion, populated only for a11y warnings. */
    wcag?: string
    /** Whether an auto-fix is available for this warning. */
    fixable?: boolean
}
```

### MCP Tool Input/Output -- `flint_accessibility_report`

```typescript
/** Tool input schema */
export interface AccessibilityReportArgs {
    /** Source code string to audit (mutually exclusive with filePath). */
    source?: string
    /** Absolute path to file to audit (mutually exclusive with source). */
    filePath?: string
    /** Only check rules for specific WCAG criteria (e.g., ["1.1.1", "4.1.2"]). */
    criteria?: string[]
    /** Only check rules in specific categories. */
    categories?: A11yRuleCategory[]
    /** If true, apply deterministic auto-fixes and return the fixed source. */
    autoFix?: boolean
    /** If true, return results even for passing rules. */
    includePassingRules?: boolean
}

/** Tool output (serialized as JSON in MCP content) */
export interface AccessibilityReportOutput {
    status: 'PASS' | 'FAIL'
    auditResult: A11yAuditResult
    /** Present only when autoFix is true and fixes were applied. */
    fixedSource?: string
    /** Mutations that were applied (for audit trail). */
    appliedFixes?: Array<{ ruleId: string; description: string }>
}
```

---

## Store Contracts

No new Zustand store slices are needed. The A11y linter results are already consumed by `editorStore.linterWarnings` and `canvasStore.mithrilViolations` via the existing audit pipeline. The new rules will flow through the same channels.

The only store change is extending the `LinterWarning` type with optional `wcag` and `fixable` fields (backward compatible).

---

## Component Contracts

No new Glass UI components are needed for EXP.6a. The existing `GovernanceOverlay`, `ExportModal`, and `ShieldOverlay` already render `LinterWarning` objects and will display the new rules automatically.

Future consideration (EXP.6c): A dedicated "Accessibility Report Panel" in Glass could be added, but that is out of scope for this contract.

---

## Rule Catalog

### EXP.6a -- 30 Rules (Priority 1)

#### Names and Labels (migrated + enhanced)

| Rule ID | WCAG | Element | Check | Fixable | Migrated From |
|---------|------|---------|-------|---------|---------------|
| A11Y-001 | 1.1.1 | `<img>` | Must have `alt` attribute | YES -- add `alt=""` | Existing |
| A11Y-002 | 4.1.2 | `<button>` | Must have accessible name | YES -- add `aria-label` placeholder | Existing |
| A11Y-003 | 4.1.2 | `<a>` | Must have accessible name | YES -- add `aria-label` placeholder | Existing |
| A11Y-004 | 1.3.1 | `<input>` | Must have programmatic label | YES -- add `aria-label` placeholder | Existing |
| A11Y-005 | 1.3.1 | `<select>` | Must have accessible label | YES -- add `aria-label` placeholder | Existing |
| A11Y-006 | 1.3.1 | `<textarea>` | Must have accessible label | YES -- add `aria-label` placeholder | Existing |
| A11Y-011 | 1.1.1 | `<img>` | `alt` must not be filename pattern | YES -- replace with `alt=""` | NEW |
| A11Y-012 | 1.1.1 | `<svg>` | Must have `<title>`, `aria-label`, or `role="img" + aria-label` | YES -- add `aria-hidden="true"` (decorative default) | NEW |
| A11Y-013 | 4.1.2 | `<input type="image">` | Must have `alt` | YES -- add `alt=""` | NEW |
| A11Y-014 | 2.4.4 | `<a>` | Link text must not be generic ("click here", "read more") | NO | NEW |

#### Keyboard (migrated + new)

| Rule ID | WCAG | Element | Check | Fixable |
|---------|------|---------|-------|---------|
| A11Y-007 | 2.4.3 | Any | `tabIndex > 0` disrupts tab order | YES -- set to `tabIndex={0}` | Existing |
| A11Y-020 | 2.1.1 | `<div>`, `<span>` with onClick | Non-interactive with click handler must have `role`, `tabIndex`, `onKeyDown` | YES -- add `role="button" tabIndex={0}` |
| A11Y-021 | 2.1.1 | Any with `onMouseDown/onMouseUp/onMouseOver` | Mouse-only handlers must have keyboard equivalents | NO |
| A11Y-022 | 2.4.7 | Any with `outline: none/0` | Must not remove focus indicator without replacement | NO |

#### Structure (migrated + enhanced)

| Rule ID | WCAG | Element | Check | Fixable |
|---------|------|---------|-------|---------|
| A11Y-008 | 1.3.1 | `<table>` | Must have accessible summary | NO | Existing |
| A11Y-009 | 3.1.1 | `<html>` | Must have `lang` attribute | YES -- add `lang="en"` | Existing |
| A11Y-010 | 1.3.1 | Headings | Must not skip heading levels | NO | Existing |
| A11Y-015 | 1.3.1 | `<ul>`, `<ol>` | Direct children must be `<li>` | NO |
| A11Y-016 | 1.3.1 | `<dl>` | Direct children must be `<dt>` or `<dd>` | NO |
| A11Y-017 | 2.4.2 | Document | Page must have exactly one `<h1>` | NO |

#### ARIA

| Rule ID | WCAG | Element | Check | Fixable |
|---------|------|---------|-------|---------|
| A11Y-030 | 4.1.2 | Any with `role` | Role value must be a valid WAI-ARIA role | YES -- remove invalid role |
| A11Y-031 | 4.1.2 | Any with `role` | Required ARIA children must be present (e.g., `role="list"` needs `role="listitem"`) | NO |
| A11Y-032 | 4.1.2 | Any with `role` | Element must be inside required ARIA parent (e.g., `role="listitem"` inside `role="list"`) | NO |
| A11Y-033 | 4.1.2 | Any with `role` | Required ARIA attributes must be present (e.g., `role="checkbox"` needs `aria-checked`) | YES -- add required attr with default value |
| A11Y-034 | 4.1.2 | Any | ARIA attribute names must be valid (no typos like `aria-lable`) | YES -- remove invalid attr |
| A11Y-035 | 4.1.2 | Any | ARIA attribute values must match allowed value types | NO |
| A11Y-036 | 4.1.2 | Any | `aria-hidden="true"` must not be on focusable elements | YES -- remove `aria-hidden` |
| A11Y-037 | 4.1.2 | Any | No duplicate ARIA attributes on same element | YES -- remove duplicate |
| A11Y-038 | 4.1.2 | `<input>`, `<select>` | Interactive elements must not have `role="presentation"` or `role="none"` | YES -- remove role |

#### Landmarks

| Rule ID | WCAG | Element | Check | Fixable |
|---------|------|---------|-------|---------|
| A11Y-050 | 1.3.1 | Document | Page must have a `<main>` or `role="main"` | NO |
| A11Y-051 | 1.3.1 | Document | Page should have a `<nav>` or `role="navigation"` | NO (warning-level) |
| A11Y-052 | 1.3.1 | Document | `<main>` must not appear more than once | NO |
| A11Y-053 | 1.3.1 | Landmarks | Multiple landmarks of same type must have distinct `aria-label` | NO |

#### Contrast

| Rule ID | WCAG | Element | Check | Fixable |
|---------|------|---------|-------|---------|
| A11Y-060 | 1.4.3 | Text | Normal text contrast ratio >= 4.5:1 (AA) | NO |
| A11Y-061 | 1.4.3 | Text | Large text contrast ratio >= 3:1 (AA) | NO |
| A11Y-062 | 1.4.11 | UI components | Non-text contrast >= 3:1 (borders, icons) | NO |

#### Forms

| Rule ID | WCAG | Element | Check | Fixable |
|---------|------|---------|-------|---------|
| A11Y-070 | 1.3.1 | `<fieldset>` | Must contain a `<legend>` child | YES -- add empty `<legend>` |
| A11Y-071 | 3.3.2 | `<input>` with `required` | Must have visible required indicator or `aria-required` | YES -- add `aria-required="true"` |
| A11Y-072 | 3.3.1 | `<input>` with `aria-invalid` | Must have `aria-describedby` pointing to error message | NO |
| A11Y-073 | 1.3.5 | `<input>` | Autocomplete attribute must use valid values | YES -- remove invalid autocomplete |

### EXP.6b -- 15 Rules (Priority 2, future contract)

| Rule ID | Category | WCAG | Check |
|---------|----------|------|-------|
| A11Y-023 | keyboard | 2.1.2 | No keyboard trap (focus must be escapable) |
| A11Y-024 | keyboard | 2.4.1 | Skip navigation link must exist |
| A11Y-025 | keyboard | 2.4.7 | Focus must be visible (no `outline: 0` without custom) |
| A11Y-040 | aria | 4.1.2 | `aria-expanded` on triggering element must match state |
| A11Y-041 | aria | 4.1.2 | `aria-controls` must reference existing ID |
| A11Y-042 | aria | 4.1.2 | `aria-describedby` must reference existing ID |
| A11Y-054 | landmarks | 1.3.1 | `<header>` should be `role="banner"` only at top level |
| A11Y-063 | contrast | 1.4.3 | APCA Lc value for WCAG 3.0 readiness |
| A11Y-074 | forms | 3.3.3 | Error suggestion must be provided |
| A11Y-075 | forms | 3.3.4 | Legal/financial submissions must be reversible |
| A11Y-076 | forms | 1.3.1 | Radio buttons must be grouped in `<fieldset>` |
| A11Y-077 | forms | 4.1.2 | `<label>` must reference valid `<input>` id |
| A11Y-080 | live-regions | 4.1.3 | Status messages must use `role="status"` or `aria-live` |
| A11Y-081 | live-regions | 4.1.3 | Alert dialogs must use `role="alertdialog"` |
| A11Y-090 | motion | 2.3.3 | Animations must respect `prefers-reduced-motion` |

### EXP.6c -- 10+ Rules (Priority 3, future contract)

Advanced semantic analysis, composite widget ARIA patterns, `aria-owns` graph validation, etc. Scope TBD based on EXP.6a learnings.

---

## Auto-Fix Classification

Rules are classified into three fix tiers:

| Tier | Description | Examples | Risk |
|------|------------|---------|------|
| **Safe** | Deterministic, never changes behavior | Add `alt=""`, add `lang="en"`, remove invalid ARIA attr | Zero |
| **Placeholder** | Adds a valid but placeholder value that needs human review | Add `aria-label="[NEEDS LABEL]"`, add empty `<legend>` | Low -- code compiles, but content is placeholder |
| **Structural** | Wraps or injects elements, may affect layout | Wrap `<div onClick>` in `<button>`, inject `<legend>` into `<fieldset>` | Medium -- layout may shift |

All Placeholder fixes include `[NEEDS LABEL]` or `[NEEDS DESCRIPTION]` as the value, which will trigger a separate lint warning to ensure human review.

---

## Contrast Checking Architecture

Color contrast (A11Y-060..062) requires font-size and font-weight context to determine if text is "large text" (>= 18pt or >= 14pt bold). The approach:

1. During traversal, the runner builds a `colorContext` map in `A11yRuleContext`.
2. For each element with a `className` containing color-related Tailwind classes (text-*, bg-*), extract:
   - Foreground color from `text-[#hex]` or `text-{token}` classes.
   - Background color from `bg-[#hex]` or `bg-{token}` classes (walk up ancestors if not found on element).
   - Font size from `text-{size}` classes.
   - Font weight from `font-{weight}` classes.
3. The contrast rules read from `colorContext` and compute WCAG 2.x contrast ratio (relative luminance formula) or APCA Lc.
4. Token resolution: if a color references a design token (e.g., `text-brand-primary`), look it up in the token store. If not resolvable, skip the check (conservative -- no false positives).

The `contrast-utils.ts` module provides:
- `wcagContrastRatio(fg: string, bg: string): number` -- standard (L1+0.05)/(L2+0.05) formula.
- `meetsAA(ratio: number, isLargeText: boolean): boolean` -- 4.5:1 normal, 3:1 large.
- `apcaLc(fg: string, bg: string): number` -- APCA perceptual contrast (WCAG 3.0 draft).
- `isLargeText(fontSize: string | null, fontWeight: string | null): boolean` -- >= 18pt or >= 14pt bold.

---

## Integration with Existing `flint_fix` Tool

The existing `flint_fix` MCP tool handles Mithril token fixes. EXP.6 extends it:

1. `flint_fix` currently receives `violationIds` and applies fixes.
2. We add A11y violations to the fixable set. When `flint_fix` receives an A11Y violation ID, it delegates to `a11y/fixer.ts`.
3. The fixer receives the AST and the violation detail, runs the rule's `fix()` function, and returns the mutations.
4. `flint_fix` applies the mutations via the same AST mutation pipeline used for Mithril fixes.

No new IPC channels needed -- this is entirely within the MCP server process.

---

## Implementation Order

### Group 0 -- Prerequisites (sequential)

1. **Types** (`flint-mcp/src/core/a11y/types.ts`) -- Define all interfaces. No dependencies. Owner: `flint-ast-surgeon`.
2. **Helpers** (`flint-mcp/src/core/a11y/helpers.ts`) -- Extract shared AST helpers from current A11yLinter. Owner: `flint-ast-surgeon`.
3. **Contrast Utils** (`flint-mcp/src/core/a11y/contrast-utils.ts`) -- WCAG contrast ratio + APCA math. Owner: `flint-ast-surgeon`.

### Group 1 -- Core Engine (parallel after Group 0)

4. **Runner** (`flint-mcp/src/core/a11y/runner.ts`) -- Rule loading + execution engine. Depends on types + helpers. Owner: `flint-ast-surgeon`.
5. **Fixer** (`flint-mcp/src/core/a11y/fixer.ts`) -- Auto-fix engine. Depends on types. Owner: `flint-ast-surgeon`.

### Group 2 -- Rule Modules (fully parallel after Group 1)

Each rule module can be implemented independently. All depend on types + helpers.

6a. `rules/names-labels.ts` -- Owner: `flint-ast-surgeon`
6b. `rules/keyboard.ts` -- Owner: `flint-ast-surgeon`
6c. `rules/structure.ts` -- Owner: `flint-ast-surgeon`
6d. `rules/aria.ts` -- Owner: `flint-ast-surgeon`
6e. `rules/landmarks.ts` -- Owner: `flint-ast-surgeon`
6f. `rules/contrast.ts` -- Owner: `flint-ast-surgeon`
6g. `rules/forms.ts` -- Owner: `flint-ast-surgeon`
6h. `rules/live-regions.ts` -- Owner: `flint-ast-surgeon` (EXP.6b)
6i. `rules/motion.ts` -- Owner: `flint-ast-surgeon` (EXP.6b)

### Group 3 -- Integration (after Group 2)

7. **Barrel export** (`flint-mcp/src/core/a11y/index.ts`) -- Owner: `flint-ast-surgeon`.
8. **Backward-compat shim** (modify `flint-mcp/src/core/A11yLinter.ts`) -- Delegate to new runner, preserve `audit()` API. Owner: `flint-ast-surgeon`.
9. **MCP tool handler** (`flint-mcp/src/tools/accessibility.ts`) -- Owner: `flint-ast-surgeon`.
10. **Server registration** (modify `flint-mcp/src/server.ts`) -- Owner: `flint-electron-ipc`.
11. **Types update** (modify `flint-mcp/src/types.ts`) -- Add `wcag` and `fixable` fields. Owner: `flint-ast-surgeon`.
12. **DebtReport integration** (modify `flint-mcp/src/core/dashboard/debtReportService.ts`) -- Use new runner. Owner: `flint-ast-surgeon`.
13. **Renderer-side sync** (modify `src/core/A11yLinter.ts`) -- Delegate to shared rules. Owner: `flint-ast-surgeon`.

### Group 4 -- Tests (parallel with Groups 2-3)

14. All test files listed in Impact Map. Owner: `flint-test-writer`.

### Group 5 -- Review (after all above)

15. Full integration review. Owner: `flint-code-reviewer`.

---

## Parallelism Diagram

```
Group 0:  types.ts -> helpers.ts -> contrast-utils.ts
              |
              v
Group 1:  runner.ts  |  fixer.ts     (parallel)
              |
              v
Group 2:  names-labels | keyboard | structure | aria     (all parallel)
          landmarks    | contrast | forms     | live-regions | motion
              |
              v
Group 3:  index.ts -> A11yLinter.ts shim -> tool handler -> server.ts
              |                          -> debtReport update
              v
Group 4:  All __tests__/ files         (parallel with Groups 2-3)
              |
              v
Group 5:  flint-code-reviewer
```

---

## Risks

### R1 -- Contrast Analysis False Positives (Medium)
**Commandment threatened:** 5 (a11y is a compiler error -- false positives would block legitimate exports).
**Mitigation:** Contrast rules (A11Y-060..062) default to skipping when color values are not statically resolvable (dynamic expressions, CSS variables, inherited styles). Only flag when both foreground and background are statically known hex values or resolvable design tokens. Accept that coverage is imperfect rather than producing false positives.

### R2 -- ARIA Role Lookup Data Staleness (Low)
**Commandment threatened:** None directly, but correctness.
**Mitigation:** The valid ARIA roles and required attributes are defined as a static lookup table in `rules/aria.ts`, sourced from WAI-ARIA 1.2 spec. Include a version comment and a script to regenerate from the spec if needed.

### R3 -- Auto-Fix Placeholder Values Create New Warnings (Low)
**Mitigation:** Placeholder values like `aria-label="[NEEDS LABEL]"` will pass the "has aria-label" check (rule satisfied) but should be flagged by a separate informational rule or by Mithril's string-content auditor in a future phase. This is intentional -- fix the compiler error now, flag the content gap separately.

### R4 -- Two-Copy Sync Drift (Medium)
**Commandment threatened:** Correctness of renderer-side linting.
**Mitigation:** Short-term: build-time sync script. Medium-term (EXP.6c): deprecate renderer-side A11yLinter entirely and have Glass consume `flint://violations/{filePath}` for all A11y data. The MCP server is always the source of truth.

### R5 -- Rule Count Explosion Slows Audit (Low)
**Mitigation:** The runner uses a single Babel traversal pass. All rules attach visitors to the same `JSXElement` visitor. Document-level rules run once post-traversal. 50 rules in a single pass should add < 10ms to audit time for typical component files (< 500 LOC).

### R6 -- Keyboard Trap Detection is Undecidable (Medium)
**Mitigation:** A11Y-023 (keyboard trap) is deferred to EXP.6b and limited to heuristic detection of known patterns (e.g., `onKeyDown` handlers that call `preventDefault` without an escape path). False negatives are acceptable; false positives are not.

---

## Testing Requirements

### Per-Rule Test Structure

Each rule test file follows this pattern:

```typescript
describe('A11Y-XXX: <rule name>', () => {
    it('flags violation on known-bad input', () => {
        const ast = parse(`<img src="x" />`, { ... })
        const result = runner.audit(ast, { filePath: 'test.tsx', tokens: [] })
        expect(result.violations).toContainEqual(
            expect.objectContaining({ ruleId: 'A11Y-XXX' })
        )
    })

    it('passes on known-good input', () => {
        const ast = parse(`<img src="x" alt="desc" />`, { ... })
        const result = runner.audit(ast, { filePath: 'test.tsx', tokens: [] })
        expect(result.violations.filter(v => v.ruleId === 'A11Y-XXX')).toHaveLength(0)
    })

    // If fixable:
    it('auto-fix produces correct AST mutation', () => {
        const ast = parse(`<img src="x" />`, { ... })
        const result = runner.audit(ast, { filePath: 'test.tsx', tokens: [] })
        const violation = result.violations.find(v => v.ruleId === 'A11Y-XXX')!
        const fix = rule.fix!(violation, ast)
        expect(fix).not.toBeNull()
        expect(fix!.mutations).toContainEqual(
            expect.objectContaining({ type: 'updateProp', args: { propName: 'alt', value: '' } })
        )
    })

    // Edge cases:
    it('handles dynamic expressions conservatively (no false positive)', () => { ... })
    it('works with JSX fragments', () => { ... })
    it('works with conditional rendering', () => { ... })
    it('works with nested components', () => { ... })
})
```

### Report Format

```
[flint-mcp]: 120/120 passing (110 new)
TSC: 0 errors
```

### Coverage Targets

- Every rule: minimum 3 tests (violation, pass, edge case).
- Auto-fix rules: minimum 2 additional tests (fix output, fix on already-compliant input returns null).
- Runner: 10+ tests (empty file, file with no JSX, mixed violations, category filtering, criterion filtering).
- Contrast utils: 15+ tests (known contrast ratios from WCAG spec examples, APCA reference values, edge cases for large text detection).
- MCP tool: 5+ integration tests (source input, file input, autoFix, criteria filter, empty file).

---

## WCAG 2.1 AA Success Criteria Coverage Map

This maps each WCAG SC to the rules that cover it:

| SC | Name | Level | Rules |
|----|------|-------|-------|
| 1.1.1 | Non-text Content | A | A11Y-001, A11Y-011, A11Y-012, A11Y-013 |
| 1.3.1 | Info and Relationships | A | A11Y-004..006, A11Y-010, A11Y-015..017, A11Y-050..053, A11Y-070 |
| 1.3.5 | Identify Input Purpose | AA | A11Y-073 |
| 1.4.3 | Contrast (Minimum) | AA | A11Y-060, A11Y-061 |
| 1.4.11 | Non-text Contrast | AA | A11Y-062 |
| 2.1.1 | Keyboard | A | A11Y-020, A11Y-021 |
| 2.4.2 | Page Titled | A | (not applicable to JSX components) |
| 2.4.3 | Focus Order | A | A11Y-007 |
| 2.4.4 | Link Purpose | A | A11Y-014 |
| 2.4.7 | Focus Visible | AA | A11Y-022 |
| 3.1.1 | Language of Page | A | A11Y-009 |
| 3.3.1 | Error Identification | A | A11Y-072 |
| 3.3.2 | Labels or Instructions | A | A11Y-071 |
| 4.1.2 | Name, Role, Value | A | A11Y-002, A11Y-003, A11Y-030..038 |
| 4.1.3 | Status Messages | AA | A11Y-080, A11Y-081 |
