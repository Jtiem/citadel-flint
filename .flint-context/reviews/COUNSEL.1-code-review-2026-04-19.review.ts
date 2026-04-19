import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
    {
        id: 'WARN-1',
        title: 'Parity matrix adapters for surfaces 3 & 4 are tautological — never import the real generator/service code',
        severity: 'warning',
        evidence: [
            {
                file: 'shared/__tests__/healthScore.parity.test.ts',
                line: 242,
                excerpt:
                    'function dbomGeneratorAdapter(input) { return canonicalCompute({ ...input }) }',
                note: 'Adapter does not import flint-mcp/src/core/dbom/generator.ts; it reproduces the formula by calling the canonical helper directly.',
            },
            {
                file: 'shared/__tests__/healthScore.parity.test.ts',
                line: 265,
                excerpt:
                    'function dbomServicePerComponentAdapter(input) { return canonicalCompute({ ...input }) }',
                note: 'Same pattern — never imports flint-mcp/src/core/governance/dbomService.ts.',
            },
            {
                file: 'shared/__tests__/healthScore.parity.test.ts',
                line: 336,
                excerpt:
                    'expect(Math.abs(s1.score - s3.score)).toBe(0); expect(Math.abs(s1.score - s4.score)).toBe(0);',
                note: 'Both deltas reduce to canonical === canonical, true by construction.',
            },
        ],
        observed:
            'Surfaces 3 (dbom/generator) and 4 (governance/dbomService) in the parity matrix are exercised by local wrapper functions that call shared/healthScore::computeHealthScore directly. Neither wrapper imports the production module being tested.',
        rationale:
            'The contract invariant `score-parity-across-surfaces` is the headline guarantee of COUNSEL.1, and only two of the four advertised surfaces are actually under test. A future PR re-inlining the formula in dbomService.ts would not fail this matrix. The protection is reduced to a code-review honor system for two of the four call paths.',
        proposedFix:
            'Extract a pure scoreComponent(comp): number helper from dbomService.ts and import it into the test, or call generateDBOM against a fixture project per matrix row. Either way the assertion must transit the production call-path so future drift fails red.',
        scope: 'one-file',
        status: 'open',
    },
    {
        id: 'WARN-2',
        title: 'initRunner.ts carries an unaudited fork of the health-score formula with different weights',
        severity: 'warning',
        evidence: [
            {
                file: 'flint-mcp/src/core/init/initRunner.ts',
                line: 89,
                excerpt:
                    '* Formula: 100 - (critical * 10) - (warning * 1) - (advisory * 0.5), clamped [0, 100].',
                note: 'JSDoc explicitly admits the divergence from the canonical formula.',
            },
            {
                file: 'flint-mcp/src/core/init/initRunner.ts',
                line: 98,
                excerpt: 'const raw = 100 - (critical * 10) - (warning * 1) - (advisory * 0.5)',
            },
            {
                file: '.flint-context/contracts/COUNSEL.1.contract.ts',
                line: 256,
                excerpt:
                    "name: 'formula-source-uniqueness', threshold: '=== 0 after Sprint 1 lands'",
                note: 'Contract invariant claims zero forks remain. initRunner.ts contradicts this.',
            },
        ],
        observed:
            'A fifth implementation of the health score formula exists in flint-mcp/src/core/init/initRunner.ts using weights (critical×10, warning×1, advisory×0.5) different from the canonical (×10, ×3, ×1). The architect audit in Section 1 of the contract enumerated only divergences A–D inside dashboard/ and dbom/ and missed this site.',
        rationale:
            'The contract invariant formula-source-uniqueness is stated as `=== 0` but the codebase contains at least one violating file. Either the invariant is false as written, or initRunner needs to migrate. Today the contract claim and the codebase disagree, which silently weakens the COUNSEL.1 guarantee that "every visible surface returns the same number for the same input."',
        proposedFix:
            'Either (a) migrate initRunner.ts to call canonical computeHealthScore in this sprint, or (b) document the intentional weight divergence in shared/healthScore.ts and add initRunner.ts to nonGoals with a one-line rationale (e.g., "init-time bootstrap score uses softer weights to avoid F-grading new projects").',
        scope: 'one-file',
        status: 'open',
    },
    {
        id: 'SUG-1',
        title: 'formula-source-uniqueness invariant is not codified as an executable test',
        severity: 'suggestion',
        evidence: [
            {
                file: '.flint-context/contracts/COUNSEL.1.contract.ts',
                line: 259,
                excerpt:
                    "measuredBy: 'grep audit codified as a unit test in shared/__tests__/healthScore.parity.test.ts'",
            },
            {
                file: 'shared/__tests__/healthScore.parity.test.ts',
                note: 'No it() block walks the repo for forbidden formula expressions. Invariant is enforced only by reviewer attention.',
            },
        ],
        observed:
            'The contract states the formula-uniqueness invariant is "codified as a unit test" in the parity test file. No such test block exists.',
        rationale:
            'WARN-2 (initRunner fork) would have been caught automatically by an executable grep test. Today the invariant survives only by manual audit.',
        proposedFix:
            "Add an it('formula-source-uniqueness') block that walks src/, flint-mcp/src/, electron/, server/, shared/ (excluding healthScore.ts itself, tests, and dist*), and asserts no file matches the formula regex from the contract.",
        scope: 'one-file',
        status: 'open',
    },
    {
        id: 'SUG-2',
        title: '@deprecated tags do not produce tsc diagnostics in this repo',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/hooks/useGovernanceHealth.ts',
                line: 52,
                excerpt: '@deprecated COUNSEL.1 — Use the object-arg form …',
            },
            {
                file: 'flint-mcp/src/core/dashboard/debtReportService.ts',
                line: 122,
                excerpt: '@deprecated Use the object-arg form …',
            },
            {
                file: '.flint-context/contracts/COUNSEL.1.contract.ts',
                line: 218,
                excerpt:
                    "then: 'emits a deprecation diagnostic referencing the object-arg replacement'",
                note: 'Contract claims tsc emits a diagnostic. Repo has no eslint deprecation rule wired and tsc does not surface JSDoc @deprecated by default.',
            },
        ],
        observed:
            'JSDoc @deprecated tags are present on both shims, but the repo lacks an ESLint rule (e.g., deprecation/deprecation) and tsc does not emit deprecation diagnostics by default. The TestBoundary `deprecated-shim-still-correct` then-clause is therefore unverifiable in CI.',
        rationale:
            'Without enforcement, future contributors can call the positional shims indefinitely with no signal that they are migrating away from the form responsible for divergence B in the first place.',
        proposedFix:
            'Either lower the contract claim to "IDE-surface deprecation" or wire eslint-plugin-deprecation into the lint suite so deprecated callers fail CI.',
        scope: 'one-file',
        status: 'open',
    },
];

export const REPORT: ReviewReport = {
    meta: {
        phase: 'COUNSEL.1',
        dimension: 'code',
        reviewer: 'flint-code-reviewer',
        date: '2026-04-19',
        round: 1,
        scope: [
            'flint-mcp/src/core/dashboard/debtReportService.ts',
            'flint-mcp/src/core/dbom/generator.ts',
            'flint-mcp/src/core/governance/dbomService.ts',
            'flint-mcp/src/core/dashboard/types.ts',
            'src/hooks/useGovernanceHealth.ts',
            'shared/__tests__/healthScore.parity.test.ts',
            'contract artifacts (COUNSEL.1-contract.md / COUNSEL.1.contract.ts)',
        ],
        markdownFile: 'COUNSEL.1-code-review-2026-04-19.md',
    },
    rubric: [
        {
            criterion:
                'Three divergence sites (debtReportService, dbom/generator, governance/dbomService) delegate to shared/healthScore.ts',
            result: 'pass',
            evidence:
                'debtReportService.ts:130-142 + dbom/generator.ts:473-478 + governance/dbomService.ts:347-352 all call computeHealthScore({...}) from shared.',
        },
        {
            criterion: 'No inline 100 - (critical|amber|advisory) * N expression remains in the four scoped files',
            result: 'pass',
        },
        {
            criterion: 'formula-source-uniqueness invariant holds repo-wide',
            result: 'fail',
            evidence:
                'flint-mcp/src/core/init/initRunner.ts:98 contains an unaudited variant with different weights.',
            relatedFindings: ['WARN-2'],
        },
        {
            criterion: 'Parity matrix asserts |delta|===0 against the production call-paths of all four surfaces',
            result: 'fail',
            evidence:
                'Surfaces 3 & 4 adapters (parity.test.ts:242,265) call canonicalCompute directly; never import the dbom modules under test.',
            relatedFindings: ['WARN-1'],
        },
        {
            criterion: '@deprecated shims include real deprecation tags with migration guidance',
            result: 'pass',
            evidence: 'useGovernanceHealth.ts:52 and debtReportService.ts:122 both carry full JSDoc @deprecated blocks pointing to the object-arg form.',
        },
        {
            criterion: 'Coverage Honesty (Phase 0 governedSurfacePercent) is preserved — score is independent of coverage',
            result: 'pass',
            evidence:
                'parity.test.ts:357-365 asserts coverage-grade-independence; computeCoverageSummary at debtReportService.ts:179 untouched.',
        },
        {
            criterion: 'No new IPC channels / no window.flintAPI changes / no Zustand store contamination',
            result: 'pass',
        },
        {
            criterion: 'No new fs/git callsites; engine-only scope held (Commandment 14)',
            result: 'pass',
        },
        {
            criterion: 'Export Gate behavior unchanged — gate reads counts, not score (Commandment 6)',
            result: 'pass',
        },
        {
            criterion: 'A11y bucket (×10) preserved — Commandment 5',
            result: 'pass',
        },
        {
            criterion: 'TypeScript strict build passes (npx tsc --noEmit, 0 errors)',
            result: 'pass',
            evidence: 'Reported by submitter; no new any/ts-ignore introduced.',
        },
        {
            criterion: 'Test suites green (MCP 5550/5550, Core 2556/2556, Glass unrelated failures only)',
            result: 'pass',
        },
    ],
    findings,
    counts: countFindings(findings),
    verdict: deriveVerdict(findings, 'code'),
    scopeCoverage: {
        reviewed: [
            'flint-mcp/src/core/dashboard/debtReportService.ts',
            'flint-mcp/src/core/dbom/generator.ts (lines 440-540)',
            'flint-mcp/src/core/governance/dbomService.ts (lines 300-400)',
            'flint-mcp/src/core/dashboard/types.ts',
            'src/hooks/useGovernanceHealth.ts',
            'shared/healthScore.ts (canonical reference)',
            'shared/__tests__/healthScore.parity.test.ts (entire file)',
            'flint-mcp/src/core/init/initRunner.ts (grep follow-up)',
            '.flint-context/contracts/COUNSEL.1-contract.md',
            '.flint-context/contracts/COUNSEL.1.contract.ts',
        ],
        skipped: [
            'flint-mcp/src/core/dashboard/__tests__/debtReportService.test.ts — relied on submitter-reported pass count',
            'flint-mcp/src/core/governance/__tests__/dbomService.test.ts — relied on submitter-reported pass count',
            'src/components/ui/GovernanceDashboard.tsx — contract states unmodified; not re-audited',
            'src/components/editor/StatusBar.tsx — contract states unmodified; not re-audited',
        ],
    },
};
