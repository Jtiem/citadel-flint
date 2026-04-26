/**
 * Sprint Clarity 2 — Executable Contract
 *
 * Phase: CLARITY-2
 * Date: 2026-03-29
 *
 * Phase 2 agents import types from this file. TypeScript enforces alignment.
 */

import type {
    LegacyFlintContract,
    LegacyContractMeta,
    LegacyTestBoundary,
    ImpactEntry,
    RiskEntry,
    ComponentContract,
} from '../../shared/contract-schema'

// ─── Item 1: Health Ring Next Step ─────────────────────────────────────────

/** The 6 prompt variants derived from violation state */
export type NextStepVariant =
    | 'perfect'         // score === 100
    | 'nearly-perfect'  // score >= 90, issues exist
    | 'a11y-dominant'   // a11yCount > mithrilCount
    | 'mithril-dominant' // mithrilCount >= a11yCount
    | 'override-dominant' // overrideCount > mithrilCount + a11yCount
    | 'mixed'           // mithrilCount > 0 && a11yCount > 0

export interface NextStepResult {
    variant: NextStepVariant
    text: string
}

/**
 * Pure function that produces the next-step coaching sentence.
 * Lives inside GovernanceDashboard.tsx as a useMemo dependency.
 */
export type ComputeNextStep = (
    mithrilCount: number,
    a11yCount: number,
    overrideCount: number,
    score: number,
) => NextStepResult

// ─── Item 2: Tab Unlock Narration ──────────────────────────────────────────

export interface TabUnlockTooltipProps {
    /** Key for useOnboardingTooltip persistence (e.g. 'tab-unlock-tokens') */
    tooltipKey: string
    /** The narration text to display */
    text: string
    /** The tab button element to wrap */
    children: React.ReactNode
}

/** Narration copy for each dynamically-unlocked tab */
export const TAB_NARRATION: Record<string, string> = {
    tokens: 'Tokens loaded — this tab shows your design tokens and lets you search them.',
}

// ─── Item 3: Response Shaping Types ────────────────────────────────────────

/** Tools that receive response shaping in this sprint */
export const SHAPED_TOOLS = [
    'flint_fix',
    'flint_debt_report',
    'flint_accessibility_report',
    'flint_swarm_audit_fix',
    'flint_migrate_tw',
    'flint_sync_check',
    'flint_risk_score',
    'flint_generate_dbom',
] as const

export type ShapedTool = (typeof SHAPED_TOOLS)[number]

/** Every shaped tool response includes this field */
export interface ResponseShapingFields {
    recommendation: string
}

// ─── Item 4: Shared Health Signal ──────────────────────────────────────────

export interface HealthSignal {
    /** 0-100, computed as max(0, 100 - mithrilCount * 5) */
    fidelityScore: number
    /** 0-100, computed as max(0, 100 - a11yCount * 10) */
    a11yScore: number
    /** Raw count of active rule overrides */
    overrideCount: number
    /** Overall health score (0-100) factoring all three */
    overallScore: number
    /** Letter grade: A >= 90, B >= 80, C >= 70, D >= 60, F < 60 */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

/**
 * Pure function — zero dependencies. Lives in shared/healthSignal.ts.
 * Both Glass GovernanceDashboard and flint-ci debt command import this.
 */
export type FormatHealthSignal = (
    mithrilCount: number,
    a11yCount: number,
    overrideCount: number,
) => HealthSignal

// ─── Item 5: Progressive Tool Surfacing ────────────────────────────────────

export interface ToolSuggestion {
    tool: string
    reason: string
}

/** Max number of tools to suggest */
export const MAX_SUGGESTED_TOOLS = 5

/**
 * Pure function that selects the top N tools based on project state.
 * Lives in flint-mcp/src/core/toolSuggester.ts.
 */
export type SuggestTools = (context: {
    tokenCount: number
    mithrilCount: number
    a11yCount: number
    healthScore: number | null
    figmaConnected: boolean
    hasManifest: boolean
}) => ToolSuggestion[]

// ─── Contract Metadata ─────────────────────────────────────────────────────

const meta: LegacyContractMeta = {
    name: 'Sprint-Clarity-2',
    phase: 'CLARITY-2',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-03-29',
}

const impact: ImpactEntry[] = [
    // Item 1
    { file: 'src/components/ui/GovernanceDashboard.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Add nextStepPrompt useMemo + render below grade letter' },
    { file: 'src/components/ui/__tests__/GovernanceDashboard.nextstep.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Test all 6 next-step copy variants' },
    // Item 2
    { file: 'src/App.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Add TabUnlockTooltip wrapper around dynamically-unlocked tabs' },
    { file: 'src/components/ui/TabUnlockTooltip.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Tooltip component using useOnboardingTooltip' },
    { file: 'src/components/ui/__tests__/TabUnlockTooltip.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Render + dismiss + persistence tests' },
    // Item 3
    { file: 'flint-mcp/src/tools/fix.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add recommendation field' },
    { file: 'flint-mcp/src/tools/debtReport.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add recommendation field' },
    { file: 'flint-mcp/src/tools/accessibility.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add recommendation field' },
    { file: 'flint-mcp/src/tools/swarm.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add recommendation field' },
    { file: 'flint-mcp/src/tools/sync.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add recommendation to sync_check' },
    { file: 'flint-mcp/src/tools/dbom.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add recommendation field' },
    { file: 'flint-mcp/src/server.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add recommendation to risk_score handler' },
    { file: 'flint-mcp/src/tools/__tests__/response-shaping.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Test recommendation on all 8 tools' },
    // Item 4
    { file: 'shared/healthSignal.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'Pure health signal function + types' },
    { file: 'shared/__tests__/healthSignal.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Unit tests for score computation' },
    { file: 'flint-ci/src/commands/debt.ts', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Use formatHealthSignal for stderr summary' },
    // Item 5
    { file: 'flint-mcp/src/core/toolSuggester.ts', changeType: 'CREATE', owner: 'flint-ast-surgeon', summary: 'suggestTools pure function' },
    { file: 'flint-mcp/src/core/__tests__/toolSuggester.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Test all 7 suggestion conditions' },
    { file: 'flint-mcp/src/core/sessionContext.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Call suggestTools, add to SessionContext' },
    { file: 'flint-mcp/src/core/capabilities/index.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Include suggestedTools in response' },
    { file: 'flint-mcp/src/types.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add suggestedTools to SessionContext type' },
]

const components: ComponentContract[] = [
    {
        name: 'TabUnlockTooltip',
        file: 'src/components/ui/TabUnlockTooltip.tsx',
        propsType: 'TabUnlockTooltipProps',
        consumesStores: [],
        emitsIPC: [],
    },
]

const testBoundaries: LegacyTestBoundary[] = [
    // Item 1
    {
        target: 'computeNextStep',
        kind: 'service',
        behavior: 'Returns "perfect" variant when score is 100',
        assertion: 'result.variant === "perfect"',
        edgeCases: ['score 100 with 0 issues', 'score 95 with 1 mithril issue', 'a11y dominant', 'override dominant', 'mixed issues'],
    },
    {
        target: 'GovernanceDashboard next-step-prompt',
        kind: 'component',
        behavior: 'Renders next-step prompt text below grade letter',
        assertion: 'getByTestId("next-step-prompt") contains actionable text',
        edgeCases: ['zero violations shows perfect message', 'many violations shows dominant category'],
    },
    // Item 2
    {
        target: 'TabUnlockTooltip',
        kind: 'component',
        behavior: 'Shows tooltip on first render, hides after dismiss',
        assertion: 'tooltip text visible initially, gone after dismiss click',
        edgeCases: ['already dismissed in localStorage', 'multiple tabs unlocking simultaneously'],
    },
    // Item 3
    {
        target: 'flint_fix recommendation',
        kind: 'service',
        behavior: 'Response includes recommendation string',
        assertion: 'result.recommendation is a non-empty string',
        edgeCases: ['0 fixes applied', 'many fixes applied', 'dry_run mode'],
    },
    {
        target: 'flint_debt_report recommendation',
        kind: 'service',
        behavior: 'Response includes recommendation based on grade',
        assertion: 'result.recommendation mentions grade and action',
        edgeCases: ['grade A (healthy)', 'grade F (critical)', 'empty project'],
    },
    {
        target: 'flint_accessibility_report recommendation',
        kind: 'service',
        behavior: 'Response includes recommendation based on failures',
        assertion: 'result.recommendation mentions fix action or clean status',
        edgeCases: ['0 failures', 'many failures', 'auto-fix available'],
    },
    {
        target: 'flint_swarm_audit_fix recommendation',
        kind: 'service',
        behavior: 'Response includes recommendation summarizing sweep results',
        assertion: 'result.recommendation is a non-empty string',
        edgeCases: ['all files clean', 'some files have unfixable issues'],
    },
    {
        target: 'flint_migrate_tw recommendation',
        kind: 'service',
        behavior: 'Response includes recommendation after migration',
        assertion: 'result.recommendation mentions post-migration audit',
        edgeCases: ['0 classes migrated', 'many classes migrated'],
    },
    {
        target: 'flint_sync_check recommendation',
        kind: 'service',
        behavior: 'Response includes recommendation based on sync status',
        assertion: 'result.recommendation mentions sync action or clean status',
        edgeCases: ['all tokens in sync', 'tokens drifted from Figma'],
    },
    {
        target: 'flint_risk_score recommendation',
        kind: 'service',
        behavior: 'Response includes recommendation based on risk tier',
        assertion: 'result.recommendation mentions risk tier and action',
        edgeCases: ['green risk', 'amber risk', 'red risk'],
    },
    {
        target: 'flint_generate_dbom recommendation',
        kind: 'service',
        behavior: 'Response includes recommendation for DBOM usage',
        assertion: 'result.recommendation is a non-empty string',
        edgeCases: ['empty project', 'project with many components'],
    },
    // Item 4
    {
        target: 'formatHealthSignal',
        kind: 'service',
        behavior: 'Computes fidelityScore, a11yScore, grade from counts',
        assertion: 'fidelityScore === max(0, 100 - mithrilCount * 5)',
        edgeCases: ['all zeros', 'overflow (100+ issues)', 'boundary at grade thresholds (89/90, 79/80)'],
    },
    // Item 5
    {
        target: 'suggestTools',
        kind: 'service',
        behavior: 'Returns max 5 tools based on project state conditions',
        assertion: 'result.length <= 5 && each has tool + reason',
        edgeCases: ['empty project', 'clean project', 'violations only', 'no Figma connection', 'all conditions true'],
    },
]

const risks: RiskEntry[] = [
    {
        risk: 'Items 1 and 4 both modify GovernanceDashboard.tsx',
        severity: 'low',
        mitigation: 'Sequence: Item 1 first (small useMemo), Item 4 second (label changes)',
    },
    {
        risk: 'shared/healthSignal.ts import path compatibility across packages',
        severity: 'medium',
        mitigation: 'Use relative imports; verify both src/ and flint-ci/ can resolve the path',
    },
    {
        risk: 'Tool suggestion logic becomes stale as tools are added',
        severity: 'low',
        mitigation: 'Single-file toolSuggester.ts with clear condition table',
    },
]

export const CONTRACT: LegacyFlintContract = {
    meta,
    impact,
    ipc: [], // No new IPC channels
    stores: [], // No new store state
    components,
    commandments: [2, 4], // C2: TabUnlockTooltip uses design tokens; C4: Local-first only
    testBoundaries,
    risks,
    parallelismGroups: {
        A: ['flint-design-engineer', 'flint-test-writer'], // Items 1, 2
        B: ['flint-ast-surgeon', 'flint-test-writer'],     // Items 3, 5
        C: ['flint-state-architect', 'flint-design-engineer', 'flint-test-writer'], // Item 4
    },
    nonGoals: [
        'Renaming code identifiers or IPC channels',
        'New store slices or state shapes',
        'Changes to linter engine or AST service',
        'CLI language changes (still says "violations" for developers)',
        'Canvas rendering or layout changes',
        'Figma integration changes',
    ],
}
