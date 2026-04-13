/**
 * Executable Contract — Sprint 1: Governor Linters + Services Fixes
 *
 * Phase 1 artifact. Phase 2 agents import the types below instead of
 * re-deriving them from the prose contract.
 *
 * Scope: type-level additions only. No runtime behavior lives here.
 *
 * Companion doc: sprint-1-governor-fixes.md
 */

import type { FlintContract } from '../../shared/contract-schema'

// ---------------------------------------------------------------------------
// 1. LinterWarning type union — already complete in flint-mcp/src/types.ts
// ---------------------------------------------------------------------------
// Re-export the existing union as the canonical shape agents must honor.
// No additions — 'visual-regression' and 'dark-mode-drift' already exist.
// This block is informational so flint-ast-surgeon can grep for it without
// touching types.ts.
export type Sprint1LinterWarningType =
    | 'color-drift'
    | 'typography-drift'
    | 'spacing-drift'
    | 'shadow-drift'
    | 'opacity-drift'
    | 'a11y'
    | 'sync'
    | 'inline-style-drift'
    | 'registry'
    | 'tailwind-version-drift'
    | 'dark-mode-drift'
    | 'composition'
    | 'hydration'
    | 'motion-drift'
    | 'fluid-suggestion'
    | 'visual-regression'

// Discriminants the planner MUST handle exhaustively after Sprint 1.
// Enforced via a static exhaustiveness switch in mutationPlanner.ts.
export type PlannerHandledWarningType = Sprint1LinterWarningType

// ---------------------------------------------------------------------------
// 2. MRS op-type enum — extension for mutationPlanner ↔ riskScoringService
// ---------------------------------------------------------------------------
/**
 * Authoritative op-type list that MUST appear as keys in
 * `MRS_OP_WEIGHTS` (flint-mcp/src/core/governance/riskScoringService.ts).
 * Sprint 1 adds `replaceElement` (LOCKED to 0.9) and `swapMotionToken`
 * (LOCKED to 0.4) per R2 decision 2026-04-12. These values are binding
 * and must not drift during Phase 2. The rest are the pre-existing
 * weights, listed here for completeness so Phase 2 agents can assert
 * the full shape.
 */
export type MrsOpType =
    | 'updateClassName'
    | 'fixToken'
    | 'updateTextContent'
    | 'updateProp'
    | 'injectNode'
    | 'inject'
    | 'wrapNode'
    | 'moveNode'
    | 'move'
    | 'deleteNode'
    | 'assembleLayout'
    | 'crossFileMove'
    | 'insertNode'
    // Sprint 1 additions:
    | 'replaceElement'
    | 'swapMotionToken'

/**
 * Op types that MUST appear in `ALWAYS_RISK_GATED_OPS`.
 * Sprint 1 adds `replaceElement` (structural DOM element swap).
 */
export type AlwaysRiskGatedOp =
    | 'insertNode'
    | 'wrapNode'
    | 'deleteNode'
    | 'crossFileMove'
    | 'replaceElement'

// ---------------------------------------------------------------------------
// 3. Type-aware drift confidence — signature for computeDriftConfidence
// ---------------------------------------------------------------------------
/**
 * Shape of the narrow slice of a LinterWarning that
 * `computeDriftConfidence` reads.
 */
export interface DriftConfidenceInput {
    readonly type: Sprint1LinterWarningType
    readonly value?: number | string | undefined
    readonly nearestToken?: string | undefined
    readonly fixable?: boolean | undefined
}

/**
 * Confidence MUST be in [0, 1]. Callers may coerce with a clamp.
 */
export type DriftConfidence = number

export type ComputeDriftConfidence = (
    input: DriftConfidenceInput,
) => DriftConfidence

// ---------------------------------------------------------------------------
// 4. Classifier branch tags
// ---------------------------------------------------------------------------
export type ClassificationCategory =
    | 'deterministic'
    | 'semantic'
    | 'riskGated'

export interface Classification {
    readonly category: ClassificationCategory
    readonly confidence: DriftConfidence
    readonly reason: string
}

export type ClassifyViolation = (warning: {
    readonly type: Sprint1LinterWarningType
    readonly nearestToken?: string
    readonly fixable?: boolean
    readonly value?: number | string
}) => Classification

// ---------------------------------------------------------------------------
// 5. Visual regression return shape — adds `degraded`
// ---------------------------------------------------------------------------
export interface VisualRegressionAuditResult {
    readonly ok: boolean
    readonly degraded?: boolean
    readonly error?: string
    readonly violations: readonly {
        readonly id: string
        readonly message: string
    }[]
}

// ---------------------------------------------------------------------------
// 6. DetectorFS interface — exists() becomes async
// ---------------------------------------------------------------------------
export interface DetectorFS {
    readFile(path: string): Promise<string>
    exists(path: string): Promise<boolean>
    readdir?(
        path: string,
        opts?: { withFileTypes: true },
    ): Promise<ReadonlyArray<{ name: string; isDirectory(): boolean; isSymbolicLink(): boolean }>>
    realpath?(path: string): Promise<string>
}

// ---------------------------------------------------------------------------
// 7. VisualAuditor Babel transform — replaces regex stripping
// ---------------------------------------------------------------------------
/**
 * The Babel plugin pass MUST:
 *  - Remove every ImportDeclaration node.
 *  - Rewrite ExportDefaultDeclaration to
 *    `window.__FlintVisualComponent = <identifier>` regardless of form
 *    (function/class/arrow/memo/named re-export).
 * It MUST NOT touch any other node.
 */
export interface VisualTransformResult {
    readonly code: string
    readonly componentIdentifier: string | null
}

export type TransformVisualSource = (
    source: string,
) => VisualTransformResult

// ---------------------------------------------------------------------------
// 8. Healthcare policy escalation — dynamic rule enumeration helper
// ---------------------------------------------------------------------------
/**
 * Any helper extracted for enumerating a11y rule IDs dynamically
 * should match this signature so government.ts inherits automatically.
 */
export type EscalateAllA11yRulesToBlocking = (
    rules: Readonly<Record<string, string>>,
) => Record<string, 'blocking'>

// ---------------------------------------------------------------------------
// CONTRACT metadata
// ---------------------------------------------------------------------------

const IMPACT = [
    { file: 'flint-mcp/src/core/mutationPlanner.ts',                   changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add dark-mode-drift + visual-regression classification branches; normalize MRS opType; type-aware confidence; add replaceElement to ALWAYS_RISK_GATED_OPS' },
    { file: 'flint-mcp/src/core/governance/riskScoringService.ts',     changeType: 'MODIFY', owner: 'coder',             summary: 'Extend MRS_OP_WEIGHTS with replaceElement (0.9) and swapMotionToken (0.4)' },
    { file: 'flint-mcp/src/core/compositionValidator.ts',              changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Mirror mode003 guard in exit branch; tighten isPascalCase to require a lowercase letter' },
    { file: 'flint-mcp/src/core/darkModeSafety.ts',                    changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Filter non-color utilities (shadow/ring/outline-offset) from COLOR_UTILITY_RE; severity ceiling critical→amber; fix findSemanticAlternatives companion filter' },
    { file: 'flint-mcp/src/core/hydrationLinter.ts',                   changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Gate value/defaultValue scans behind figma-informed path; /i flag on name patterns; stable line-column IDs' },
    { file: 'flint-mcp/src/core/AnimationLinter.ts',                   changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Collapse dead warnings buffer; add ease-initial to safe list' },
    { file: 'flint-mcp/src/core/tailwindVersionResolver.ts',           changeType: 'MODIFY', owner: 'coder',             summary: 'Guard empty-string projectRoot' },
    { file: 'flint-mcp/src/core/governance/driftTrendService.ts',      changeType: 'MODIFY', owner: 'coder',             summary: 'Fix adoption-score unit mismatch — both sides count DISTINCT file_path' },
    { file: 'flint-mcp/src/core/visualRegressionStub.ts',              changeType: 'MODIFY', owner: 'coder',             summary: 'Return degraded:true / ok:false when Glass bridge unavailable — no silent green' },
    { file: 'flint-mcp/src/core/domains/healthcare.ts',                changeType: 'MODIFY', owner: 'coder',             summary: 'Enumerate all active a11y rules dynamically; cascade cleanly into government.ts' },
    { file: 'flint-mcp/src/core/domains/fintech.ts',                   changeType: 'MODIFY', owner: 'coder',             summary: 'R1 Assert+Defer — keep policy unchanged; add once-per-process startup warning from MithrilLinter.ts when MITHRIL-SPC-TOUCH has no registered visitor; FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS env + __resetDeferredWarningState test helper' },
    { file: 'flint-mcp/src/core/MithrilLinter.ts',                     changeType: 'MODIFY', owner: 'coder',             summary: 'R1 Assert+Defer stopgap — add module-scoped deferred-warning registry (Set<string>) reconciling declared policy rule IDs against registered visitors; on first linter invocation per process, emit a one-shot console.warn per unmatched rule ID with exact message "[Flint] MITHRIL-SPC-TOUCH declared in policy but no visitor registered — deferred to Mithril expansion sprint"; respect process.env.FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS==="1"; export __resetDeferredWarningState() test helper that clears the Set so tests can re-exercise the once-per-process guard. Acceptance: test proves (a) first invocation logs once, (b) second invocation logs zero additional, (c) env flag silences, (d) reset helper re-arms emission.' },
    { file: 'electron/visualAuditor.ts',                               changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Replace regex-based import/export stripping with Babel traversal; settled-guard for render-timeout race' },
    { file: 'shared/projectDetector.ts',                               changeType: 'MODIFY', owner: 'coder',             summary: 'Symlink cycle protection via realpath+depth cap; make DetectorFS.exists async' },
] as const

export const CONTRACT: FlintContract = {
    meta: {
        name: 'sprint-1-governor-fixes',
        phase: 'SPRINT-1',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-12',
    },
    impact: IMPACT.map((e) => ({
        file: e.file,
        changeType: e.changeType as 'MODIFY',
        owner: e.owner,
        summary: e.summary,
    })),
    ipc: [],
    stores: [],
    components: [],
    commandments: [4, 5, 6, 9, 13, 14, 15],
    testBoundaries: [
        {
            target: 'mutationPlanner.classifyViolation',
            kind: 'service',
            behavior: 'Exhaustively classifies every Sprint1LinterWarningType; no type falls through to "Unrecognized violation type".',
            assertion: 'returns Classification with category in {deterministic, semantic, riskGated}',
            edgeCases: [
                'dark-mode-drift with nearestToken + fixable → deterministic, confidence >= 0.8',
                'dark-mode-drift without nearestToken → semantic',
                'visual-regression → riskGated',
                'typography-drift with value=2 vs value=20 → distinct confidence buckets',
            ],
        },
        {
            target: 'mutationPlanner → riskScoringService MRS op weights',
            kind: 'service',
            behavior: 'replaceElement and swapMotionToken resolve to real weights, not the unknown-op fallback of 0.5.',
            assertion: 'scoreMutation returns non-default values for new op types',
            edgeCases: [
                'opType=replaceElement on P0 profile scores > 0.5 (proves weight wired)',
                'opType=swapMotionToken on low-risk file scores below default threshold',
                'opType=replaceElement always routes riskGated via ALWAYS_RISK_GATED_OPS',
            ],
        },
        {
            target: 'compositionValidator depth tracking',
            kind: 'service',
            behavior: 'Depth counter does not drift when MITHRIL-COMP-003 is disabled; isPascalCase rejects ALLCAPS names.',
            assertion: 'produces zero warnings when rule is off; depthStack remains empty',
            edgeCases: [
                'MITHRIL-COMP-003=off with nested Cards → zero warnings, no depth drift',
                '<HTML/> name → does NOT match isPascalCase',
                'sibling Card trees → no cross-contamination (regression)',
            ],
        },
        {
            target: 'darkModeSafety COLOR_UTILITY_RE filter',
            kind: 'service',
            behavior: 'Non-color Tailwind utilities (shadow-md, ring-2, outline-offset-*) no longer trigger dark-mode warnings; severity ceiling is amber not critical.',
            assertion: 'audit returns zero warnings for non-color utilities; severity=amber on real primitive-color misses',
            edgeCases: [
                'shadow-md → zero warnings',
                'ring-2 outline-offset-2 → zero warnings',
                'primitive color without dark variant → severity amber (not critical)',
                'semantic companion token set → findSemanticAlternatives surfaces light-mode token',
            ],
        },
        {
            target: 'hydrationLinter attribute split',
            kind: 'service',
            behavior: 'value/defaultValue only scanned when figma context provides matching placeholder.',
            assertion: 'no false positives on zero-state currency inputs',
            edgeCases: [
                '<input value="$0.00" /> without figma context → zero warnings',
                '<input value="Lorem ipsum" /> with figmaPlaceholders={Lorem ipsum} → one warning',
                'john smith lowercase literal → one warning (case insensitive)',
                'IDs stable across two sequential audits (line-column keyed)',
            ],
        },
        {
            target: 'AnimationLinter buffer refactor + ease-initial',
            kind: 'service',
            behavior: 'Single warnings buffer (no dead dual-buffer); ease-initial produces zero noise.',
            assertion: 'ease-initial → zero advisories; existing tests pass after rename',
            edgeCases: [
                'ease-initial → zero motion advisories',
                'existing 205L tests remain green',
                'regression guard: no double-push of warnings',
            ],
        },
        {
            target: 'tailwindVersionResolver empty-root guard',
            kind: 'service',
            behavior: 'Resolver returns null instead of reading cwd package.json on empty input.',
            assertion: 'returns null for falsy projectRoot',
            edgeCases: [
                "projectRoot='' → null",
                'projectRoot=undefined (cast) → null',
            ],
        },
        {
            target: 'driftTrendService.getAdoptionScore unit alignment',
            kind: 'service',
            behavior: 'Rogue and registered counts use the same unit (DISTINCT file_path); percentage is meaningful.',
            assertion: 'denominator is distinct-file count',
            edgeCases: [
                'seeded 3 rogue events across 2 files + 5 mutations across 3 files → denom = distinct files',
                'empty ledger → percentage 0 (not NaN)',
            ],
        },
        {
            target: 'visualRegressionStub degraded path',
            kind: 'service',
            behavior: 'Unregistered Glass bridge returns ok:false + degraded:true instead of silent green.',
            assertion: 'result.ok === false when bridge not registered',
            edgeCases: [
                'unregistered bridge → ok:false, degraded:true',
                'registered bridge → ok:true, unchanged',
                'runVisualRegressionForLinter still emits advisory warning when degraded',
            ],
        },
        {
            target: 'healthcare.applyHealthcareEscalation dynamic a11y enumeration',
            kind: 'service',
            behavior: 'All a11y rules (not just A11Y-001..010) are escalated to blocking in healthcare mode; government inherits.',
            assertion: 'every key in policy.a11y.rules has mode=blocking',
            edgeCases: [
                'policy with 20 a11y rules → all 20 → blocking',
                'zero a11y rules → no crash, top-level blocking mode',
                'applyGovernmentEscalation inherits (all 20 blocking)',
            ],
        },
        {
            target: 'electron/visualAuditor.transformVisualSource',
            kind: 'service',
            behavior: 'Babel-based removal of ImportDeclarations and rewrite of ExportDefaultDeclaration for all export forms. No regex on source.',
            assertion: 'returns VisualTransformResult with valid JS and componentIdentifier',
            edgeCases: [
                'arrow-fn default export (export default () => <div/>) → mountable harness',
                'multi-line import (import {\\n a,\\n b\\n} from) → cleanly removed',
                'export default memo(Foo) → componentIdentifier resolved',
                'export { Foo as default } → componentIdentifier resolved',
                'existing diffBoxes/suggestCssFix/buildVisualHarnessHtml tests remain green',
            ],
        },
        {
            target: 'electron/visualAuditor render-timeout settled guard',
            kind: 'service',
            behavior: 'Promise resolves or rejects exactly once; late did-fail-load after timeout cannot double-settle.',
            assertion: 'reject called exactly once under race',
            edgeCases: [
                'did-fail-load AFTER timeout fires → no double-settle',
                'did-finish-load AFTER timeout → no double-settle',
            ],
        },
        {
            target: 'shared/projectDetector symlink protection + async exists',
            kind: 'service',
            behavior: 'Walker terminates on symlink cycles; DetectorFS.exists returns Promise<boolean>.',
            assertion: 'no infinite loop; exists is async',
            edgeCases: [
                'injected FS with symlink cycle → walker terminates within depth cap',
                'DetectorFS.exists returns Promise<boolean>',
                'all existing projectDetector tests pass after signature migration',
            ],
        },
    ],
    risks: [
        {
            risk: 'R1 RESOLVED 2026-04-12 (Assert+Defer). MITHRIL-SPC-TOUCH policy declaration is preserved in fintech.ts + policyEngine.ts. MithrilLinter emits a once-per-process startup warning when a declared rule has no registered visitor. Suppressible in tests via FLINT_SUPPRESS_DEFERRED_RULE_WARNINGS=1 env flag and __resetDeferredWarningState() helper.',
            severity: 'low',
            commandment: 6,
            mitigation: 'Deferred-work tracker in .flint-context/deferred-work.md owns the real implementation path. Sprint 1 adds no visitor.',
        },
        {
            risk: 'R2 RESOLVED 2026-04-12. MRS weights LOCKED: replaceElement=0.9, swapMotionToken=0.4. replaceElement additionally added to ALWAYS_RISK_GATED_OPS as belt-and-braces gate regardless of score.',
            severity: 'low',
            commandment: 6,
            mitigation: 'Values are binding. Phase 2 agents must assert these exact numerics in tests.',
        },
        {
            risk: 'R3 RESOLVED 2026-04-12. darkModeSafety severity ceiling relaxed critical → amber. Rationale: dark-mode-drift is Mithril advisory, not Warden/WCAG. Commandment 5 applies to A11yLinter rules (unchanged, still critical). Reviewers must not escalate back without a WCAG citation.',
            severity: 'low',
            commandment: 5,
            mitigation: 'Rationale block embedded in darkModeSafety section of the prose contract.',
        },
        {
            risk: 'DetectorFS.exists async migration breaks shared interface for any in-flight consumer.',
            severity: 'low',
            mitigation: 'Check .flint-context/ACTIVE-SWARM-TERRITORY.md before Group A ships. No external consumers exist today.',
        },
        {
            risk: 'R5 RESOLVED 2026-04-12. fluidInterpolator.ts removed from Sprint 1 entirely. MINOR fixes tracked in deferred-work.md.',
            severity: 'low',
            mitigation: 'Do not touch fluidInterpolator.ts in Sprint 1.',
        },
    ],
    parallelismGroups: {
        'A — independent file fixes (parallel, includes fintech Assert+Defer)': [
            'flint-ast-surgeon',
            'coder',
        ],
        'B — MRS weights then planner (sequential pair)': [
            'coder',
            'flint-ast-surgeon',
        ],
        'D — tests (parallel with A+B)': [
            'flint-test-writer',
        ],
    },
    nonGoals: [
        'No new linter rules (MITHRIL-SPC-TOUCH stays unshipped pending R1).',
        'No new MCP tools.',
        'No store/IPC changes.',
        'No Glass UI changes.',
        'No MINOR fixes from the reviews unless trivially included in a MAJOR fix.',
    ],
}
