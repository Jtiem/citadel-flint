/**
 * COUNSEL.1 — Unify the Health Score (Sprint 1 of 4)
 *
 * Executable contract. Phase 2 agents import types from this file; Phase 1.5
 * linter validates this CONTRACT constant; Phase 3 integration validator
 * checks that every TestBoundary has a real assertion in the test suite.
 *
 * Sprint 1 is engine math only. Visual redesign deferred to Sprints 2-4.
 *
 * See companion: COUNSEL.1-contract.md
 */

import type { FlintContract } from '../../shared/contract-schema'

// ─── Type contracts (Phase 2 imports these) ────────────────────────────────

/**
 * Canonical health score input. Re-exported from shared/healthScore.ts shape
 * so Phase 2 implementers have a single import surface for the contract.
 */
export interface HealthScoreInput {
    criticalCount: number
    amberCount: number
    advisoryCount: number
    overrideCount: number
}

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface HealthScoreResult {
    score: number
    grade: HealthGrade
}

/**
 * Parity matrix row used by shared/__tests__/healthScore.parity.test.ts.
 * Phase 2 test author iterates this and asserts every consumer surface
 * returns identical { score, grade } for each row.
 */
export interface ParityMatrixRow {
    label: string
    input: HealthScoreInput
    expectedScore: number
    expectedGrade: HealthGrade
}

/**
 * Public-surface adapter signature. Each consumer that exposes a health-score
 * computation MUST be wrappable to this signature for the parity test.
 */
export type HealthScoreSurface = (input: HealthScoreInput) => HealthScoreResult

// ─── Contract ──────────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'COUNSEL.1-UnifyHealthScore',
        phase: 'COUNSEL.1',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-19',
        audience: 'engine',
    },

    impact: [
        {
            file: 'flint-mcp/src/core/dashboard/debtReportService.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Replace inline computeHealthScore body with delegating call to shared/healthScore.ts. ' +
                'Preserve positional signature as @deprecated shim. scoreToGrade becomes @deprecated re-export of gradeFromScore.',
        },
        {
            file: 'flint-mcp/src/core/dbom/generator.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Switch import to shared/healthScore.ts. Replace computeHealthScore(c, w, 0) with object-arg ' +
                'call that includes advisoryCount aggregated from comp.violations advisory severity.',
        },
        {
            file: 'flint-mcp/src/core/governance/dbomService.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Replace inline Math.max(0, Math.min(100, 100 - (criticals*10 + warnings*3))) per-component ' +
                'score expression with computeHealthScore({...}).score from canonical module. Bucket advisory severity from comp.violations.',
        },
        {
            file: 'flint-mcp/src/core/dashboard/types.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'Fix DebtReport JSDoc — current comment claims `100 - mithrilCount × 5 - a11yCount × 10` which has never been the formula.',
        },
        {
            file: 'src/hooks/useGovernanceHealth.ts',
            changeType: 'MODIFY',
            owner: 'flint-state-architect',
            summary:
                'Mark computeCanonicalHealthScore positional shim @deprecated with migration guidance to object-arg computeHealthScore({...}). No behavior change.',
        },
        {
            file: 'shared/__tests__/healthScore.parity.test.ts',
            changeType: 'MODIFY',
            owner: 'flint-test-writer',
            summary:
                'Extend existing parity test (created in CHRON.1-repair) with the 16-row ParityMatrixRow[] matrix and add adapters that exercise debtReportService, dbom generator, and dbomService per-component paths so every consumer is asserted to return identical { score, grade } for each row.',
        },
        {
            file: 'flint-mcp/src/core/dashboard/__tests__/debtReportService.test.ts',
            changeType: 'MODIFY',
            owner: 'flint-test-writer',
            summary:
                'Add advisory-bucket regression test that would have caught divergence B. Update any snapshot assertions whose numeric values change because the deprecated 4-arg shim no longer silently zeros advisory.',
        },
        {
            file: 'flint-mcp/src/core/governance/__tests__/dbomService.test.ts',
            changeType: 'MODIFY',
            owner: 'flint-test-writer',
            summary:
                'Add per-component advisory-bucket regression test. Update any expected per-component scores affected by inclusion of advisory penalty.',
        },
    ],

    ipc: [],

    stores: [],

    components: [],

    commandments: [5, 6, 14],

    testBoundaries: [
        {
            target: 'shared/healthScore.ts::computeHealthScore',
            kind: 'service',
            behavior: 'Canonical formula remains the source of truth — no change to its arithmetic.',
            assertion: 'returns HealthScoreResult with score = clamp(100 - c*10 - a*3 - adv*1 - o*3, 0, 100)',
            edgeCases: [
                'all-zero input returns { score: 100, grade: "A" }',
                'critical=10 saturates to score 0',
                'negative inputs are floored to 0',
                'fractional inputs are floored',
            ],
            given: 'HealthScoreInput { criticalCount: 1, amberCount: 2, advisoryCount: 3, overrideCount: 0 }',
            when: 'computeHealthScore is invoked',
            then: 'returns { score: 81, grade: "B" } (100 - 10 - 6 - 3 - 0)',
        },
        {
            target: 'flint-mcp/src/core/dashboard/debtReportService.ts::computeHealthScore (deprecated shim)',
            kind: 'service',
            behavior: 'Positional 4-arg shim delegates to canonical module — no fork-copy arithmetic.',
            assertion: 'returns identical numeric score to shared/healthScore.computeHealthScore for same buckets',
            edgeCases: [
                'omitted overrideCount defaults to 0',
                'random fuzz of 100 inputs all match canonical output',
            ],
            given: 'positional call computeHealthScore(2, 1, 4, 1)',
            when: 'invoked from a legacy MCP caller path',
            then: 'returns the same integer as shared computeHealthScore({criticalCount:2, amberCount:1, advisoryCount:4, overrideCount:1}).score',
        },
        {
            target: 'flint-mcp/src/core/dbom/generator.ts::generateDBOM (project healthScore)',
            kind: 'service',
            behavior: 'DBOM project-level healthScore deducts advisoryCount * 1 (divergence B fix).',
            assertion: 'returns DBOM where summary.healthScore equals canonical computeHealthScore including advisory bucket',
            edgeCases: [
                'project with only advisory violations no longer reports score 100',
                'project with mixed severities matches debtReport summary score exactly',
            ],
            given: 'a project with 0 critical, 0 amber, 5 advisory violations',
            when: 'generateDBOM resolves',
            then: 'returns DBOM with summary.healthScore === 95 (was 100 before fix)',
        },
        {
            target: 'flint-mcp/src/core/governance/dbomService.ts::generateDBOM (per-component score)',
            kind: 'service',
            behavior: 'Per-component DBOMComponentEntry.auditResult.score uses canonical helper, not inline arithmetic.',
            assertion: 'returns auditResult.score equal to computeHealthScore({...}).score for the component buckets',
            edgeCases: [
                'component with advisory-only violations gets score < 100',
                'component with overrides counted upstream gets penalty applied (if includeOverrides flag passes through)',
            ],
            given: 'a component with 1 critical, 2 amber, 3 advisory MithrilLinter violations',
            when: 'generateDBOM resolves',
            then: 'returns DBOMComponentEntry where auditResult.score === computeHealthScore({criticalCount:1, amberCount:2, advisoryCount:3, overrideCount:0}).score',
        },
        {
            target: 'shared/__tests__/healthScore.parity.test.ts (parity matrix)',
            kind: 'service',
            behavior: 'For a fixed input matrix, every public surface returns the identical { score, grade }.',
            assertion: 'asserts |delta| === 0 between every pairwise surface combination across 16 input rows',
            edgeCases: [
                'all-zero input',
                'critical-only',
                'advisory-only (the divergence-B canary)',
                'override-only',
                'saturation at score 0',
                'mixed severities at score boundaries 89/90, 79/80, 69/70, 59/60',
            ],
            given: 'a ParityMatrixRow with input {criticalCount:0, amberCount:0, advisoryCount:5, overrideCount:0} and expectedScore: 95',
            when: 'each surface adapter is invoked with that input',
            then: 'returns exactly {score: 95, grade: "B"} from every adapter — any pairwise delta blocks the build',
        },
        {
            target: 'src/hooks/useGovernanceHealth.ts::computeCanonicalHealthScore (deprecated)',
            kind: 'hook',
            behavior: 'Positional shim continues to delegate; @deprecated JSDoc instructs callers to migrate.',
            assertion: 'returns identical value to canonical object-arg call for 100 fuzz inputs',
            edgeCases: [
                'JSDoc contains @deprecated tag',
                'JSDoc references object-arg migration target',
            ],
            given: 'a TypeScript caller importing computeCanonicalHealthScore',
            when: 'tsc compiles with deprecation warnings enabled',
            then: 'emits a deprecation diagnostic referencing the object-arg replacement',
        },
        {
            target: 'coverage-grade-independence invariant',
            kind: 'service',
            behavior: 'Phase 0 governedSurfacePercent must not feed into the score (preserve Coverage Honesty contract).',
            assertion: 'returns the same score for varying coverage with fixed bucket counts',
            edgeCases: [
                'coverage=0% with 1 critical → same score as coverage=100% with 1 critical',
                'all-skipped project still computes a score from whatever violations were collected',
            ],
            given: 'two projects with identical violation counts but governedSurfacePercent of 25 vs 100',
            when: 'computeHealthScore runs on each',
            then: 'returns identical {score, grade} for both — coverage does NOT modulate the score',
        },
        {
            target: 'export-gate independence from score',
            kind: 'service',
            behavior: 'Sprint 1 must not change export-gate behavior — gate reads counts, not score.',
            assertion: 'blocks export iff critical violation count > 0 OR active overrides exist, regardless of score value',
            edgeCases: [
                'score 100 with 1 critical violation still blocks',
                'score 0 with no criticals and no overrides still allows',
            ],
            given: 'a project with score=100 but 1 critical A11y violation',
            when: 'ExportModal canExport selector evaluates',
            then: 'blocks export (Commandment 6 preserved)',
        },
    ],

    invariants: [
        {
            name: 'score-parity-across-surfaces',
            measurable: 'Pairwise absolute difference between health-score outputs of the four public surfaces (canonical, debtReportService, dbom generator, dbom service per-component) for an identical input',
            threshold: '|delta| === 0 across every row of the 16-row parity matrix',
            measuredBy: 'shared/__tests__/healthScore.parity.test.ts (vitest) — fails CI if any pairwise delta is non-zero',
        },
        {
            name: 'formula-source-uniqueness',
            measurable: 'Count of source files containing a numeric expression matching the regex /100\\s*-.*(critical|amber|warning|advisory).*\\*\\s*\\d+/ outside of shared/healthScore.ts',
            threshold: '=== 0 after Sprint 1 lands',
            measuredBy: 'grep audit codified as a unit test in shared/__tests__/healthScore.parity.test.ts',
        },
        {
            name: 'advisory-bucket-respected',
            measurable: 'DBOM project healthScore for input {criticalCount:0, amberCount:0, advisoryCount:5, overrideCount:0}',
            threshold: '=== 95 (was 100 before fix; this single number is the divergence-B regression canary)',
            measuredBy: 'flint-mcp/src/core/dbom/__tests__/dbom.test.ts',
        },
        {
            name: 'coverage-grade-independence',
            measurable: 'Difference in score for two inputs that differ ONLY in their associated governedSurfacePercent',
            threshold: '=== 0',
            measuredBy: 'parity test row pair (coverage=25%, coverage=100%) with identical violation buckets',
        },
        {
            name: 'parity-test-runtime-cost',
            measurable: 'Wall-clock duration of shared/__tests__/healthScore.parity.test.ts in vitest run',
            threshold: '< 500ms on CI baseline runner',
            measuredBy: 'vitest --reporter=verbose timing line',
        },
    ],

    risks: [
        {
            risk: 'flint-mcp tsconfig rootDir may reject ../../../../shared/healthScore.js import path.',
            severity: 'medium',
            mitigation:
                'debtReportService.ts already imports ../../../../shared/coverage-types.js — same pattern is proven. If TSC rejects healthScore specifically (it should not), align rootDir or add to includes; document the resolution in the implementation PR.',
        },
        {
            risk: 'Existing DBOM snapshot tests assert numeric scores that change once the advisory bucket is restored.',
            severity: 'medium',
            mitigation:
                'Group C tests update fixtures with corrected expected values; the snapshot drift IS the bug being fixed. Document each updated number in the test commit message.',
        },
        {
            risk: 'Downstream MCP consumers may have memorized DBOM scores for projects with advisory violations and notice the score change.',
            severity: 'low',
            mitigation:
                'Document the score-formula correction in HANDOFF.md. The contract change is "DBOM now respects the advisory penalty it always claimed to" — the new number is the correct one.',
        },
        {
            risk: 'Per-component score change in DBOM could surprise CycloneDX consumers parsing flint:score property.',
            severity: 'low',
            mitigation:
                'Property type and key unchanged; only numeric value moves for components with advisory violations. CycloneDX consumers treat properties as opaque.',
        },
        {
            risk: 'Marking the positional shim @deprecated may emit warnings in downstream Glass code that has not migrated yet.',
            severity: 'low',
            mitigation:
                'Sprint 1 only adds the @deprecated tag; no removal. One-release migration window per spec. Migration of internal callers is a Sprint 2 cleanup task, not blocking.',
        },
        {
            risk: 'Parity test could become a brittle gatekeeper if a future intentional formula change is contemplated.',
            severity: 'low',
            mitigation:
                'Test failure points to shared/healthScore.ts as the single edit site. That is the correct UX — any future formula change must be deliberate and update all surfaces in the same commit.',
        },
    ],

    parallelismGroups: {
        A: ['flint-ast-surgeon'],
        B: ['flint-state-architect'],
        C: ['flint-test-writer'],
    },

    nonGoals: [
        'Counsel visual redesign (deferred to Sprints 2–4)',
        'New dashboard layout',
        'Plain-language verdict copy changes (Sprint 3)',
        'Any Mithril or Warden rule modifications',
        'Any new MCP tools or resources',
        'Removal of legacy positional computeHealthScore signatures (deprecation only — one-release migration window)',
        'Coverage Honesty contract changes — Phase 0 CoverageVerdict and governedSurfacePercent remain authoritative and continue to NOT modulate the health score',
        'New IPC channels or modifications to window.flintAPI surface',
        'New Zustand stores or store-slice additions',
        'StatusBar visual changes',
        'GovernanceDashboard component-tree changes',
        'Token-health math changes (useTokenHealth already delegates correctly)',
    ],
}
