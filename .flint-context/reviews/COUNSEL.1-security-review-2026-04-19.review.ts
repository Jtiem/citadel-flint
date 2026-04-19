import type { ReviewReport } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings = [
  {
    id: 'SUG-1',
    title: 'Parity-test adapters route through canonical helper instead of importing the real consumer call sites',
    severity: 'suggestion' as const,
    evidence: [
      {
        file: 'shared/__tests__/healthScore.parity.test.ts',
        line: 242,
        excerpt: 'function dbomGeneratorAdapter(input: HealthScoreInput) { ... return canonicalCompute({ ... }) }',
        note: 'Comment claims the adapter "mirrors the exact call path" inside generateDBOM, but it actually re-derives the result from the canonical helper. A future regression in dbom/generator.ts that re-inlines the formula would not fail this test.',
      },
      {
        file: 'shared/__tests__/healthScore.parity.test.ts',
        line: 265,
        excerpt: 'function dbomServicePerComponentAdapter(input: HealthScoreInput) { ... return canonicalCompute({ ... }) }',
      },
    ],
    observed:
      'The COUNSEL.1 16-row parity matrix exercises four "surfaces" but two of them (dbom/generator project healthScore and dbomService per-component score) are stubbed via local adapters that call canonicalCompute directly rather than importing the actual production functions.',
    rationale:
      'This is a defense-in-depth observation, not an exploitable bug. The parity test is positioned as the canary against future drift; if its adapters do not invoke production code paths, a re-introduction of an inline formula (the original divergence) would slip past this canary and only be caught by per-module unit tests. Hardening the canary keeps future security-sensitive math (severity weights, compliance gating) honest.',
    proposedFix:
      'Extract the bucketing-then-call shape from dbom/generator.ts and dbomService.ts into small exported helpers and have the adapters import them, OR run generateDBOM against an in-memory project fixture and assert on its returned posture.healthScore / per-component auditResult.score.',
    scope: 'one-file' as const,
    status: 'open' as const,
    commandment: 16,
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'COUNSEL.1',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-19',
    round: 1,
    scope: [
      'flint-mcp/src/core/dashboard/debtReportService.ts',
      'flint-mcp/src/core/dbom/generator.ts',
      'flint-mcp/src/core/governance/dbomService.ts',
      'flint-mcp/src/core/dashboard/types.ts',
      'src/hooks/useGovernanceHealth.ts',
      'shared/__tests__/healthScore.parity.test.ts',
    ],
    markdownFile: 'COUNSEL.1-security-review-2026-04-19.md',
  },
  rubric: [
    { criterion: 'No new IPC channels or preload surface added', result: 'pass' },
    { criterion: 'No new fs.write* / child_process / net call sites', result: 'pass' },
    { criterion: 'No new dependencies introduced', result: 'pass' },
    { criterion: 'No Node.js module imports added under src/', result: 'pass' },
    { criterion: 'DBOM advisoryCount restoration exposes no previously-redacted fields', result: 'pass' },
    { criterion: '@deprecated shims accept the same primitive number inputs as the canonical form (no widened input surface)', result: 'pass' },
    { criterion: 'Parity test fixtures contain no secrets, tokens, file paths, or PII', result: 'pass' },
    { criterion: 'Test fixtures do not mock fs / BetterSqlite3 / IPC and do not mutate process.env', result: 'pass' },
    { criterion: 'Atomic write discipline (.tmp → renameSync) preserved in dbomService.ts', result: 'pass' },
    { criterion: 'Parity-test adapters invoke production call sites end-to-end', result: 'fail', evidence: 'Adapters at shared/__tests__/healthScore.parity.test.ts:242 and :265 call canonicalCompute directly instead of generateDBOM / per-component logic.', relatedFindings: ['SUG-1'] },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'flint-mcp/src/core/dashboard/debtReportService.ts',
      'flint-mcp/src/core/dbom/generator.ts',
      'flint-mcp/src/core/governance/dbomService.ts',
      'flint-mcp/src/core/dashboard/types.ts',
      'src/hooks/useGovernanceHealth.ts',
      'shared/__tests__/healthScore.parity.test.ts',
      'electron/preload.ts (sanity grep — confirmed not touched by COUNSEL.1)',
      'electron/main.ts (sanity grep — confirmed not touched by COUNSEL.1)',
    ],
    skipped: [
      'flint-mcp/src/core/dashboard/__tests__/debtReportService.test.ts — Group C regression test, out of security scope',
      'flint-mcp/src/core/governance/__tests__/dbomService.test.ts — Group C regression test, out of security scope',
    ],
  },
};
