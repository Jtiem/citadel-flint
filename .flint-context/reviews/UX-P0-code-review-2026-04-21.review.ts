import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'UX-P0-CODE-W1',
    severity: 'warning',
    title: 'Hook-layer test coverage gap for new violation filter',
    observed:
      'useGovernanceCategories.ts lines 55-76 add an isRuleEnabled filter that reads useGovernanceStore.overrides via a Zustand selector. The hook test file src/hooks/__tests__/useGovernanceCategories.test.ts contains zero matches for "isRuleEnabled", "governanceStore", or "enabled: false". The filter is verified as a pure-function reproduction in electron/__tests__/governance-ipc.test.ts (GOVERR-15..18).',
    rationale:
      'Reproducing logic in a sibling test validates the algorithm but decouples the assertion from the real React wiring (useMemo dep array, selector subscription). A regression that breaks the subscription without breaking the pure function (e.g., selector returns stale reference) would not be caught. The hook is the public unit under test.',
    evidence: [
      { file: 'src/hooks/useGovernanceCategories.ts', line: 55 },
      { file: 'src/hooks/useGovernanceCategories.ts', line: 64 },
      { file: 'src/hooks/__tests__/useGovernanceCategories.test.ts' },
      { file: 'electron/__tests__/governance-ipc.test.ts', line: 290 },
    ],
    fix: 'Add a renderHook test that seeds useGovernanceStore with one { ruleId: "X", override: { enabled: false } } entry and one warning without ruleId; assert visibleLinterWarnings excludes X and includes the no-ruleId warning.',
    commandmentRefs: [],
  },
  {
    id: 'UX-P0-CODE-W2',
    severity: 'warning',
    title: 'No concurrent-write invariant test for override persistence',
    observed:
      'governance-ipc.test.ts covers single-writer save/get round-trip (GOVERR-19) but does not assert behavior under concurrent save calls. The handler delegates serialization to fileTransactionManager.write() on the Electron side and atomicWrite on the server side.',
    rationale:
      'The channel contract promises atomic persistence (UX-P0.contract.ts invariants). FTM is tested at its own seam, but this channel does not re-assert the promise. A regression where a future handler edit bypasses FTM would silently break atomicity.',
    evidence: [
      { file: 'electron/__tests__/governance-ipc.test.ts', line: 319 },
      { file: 'electron/main.ts', line: 4450 },
      { file: 'server/index.ts', line: 2088 },
    ],
    fix: 'Add GOVERR-20: await Promise.all([saveHandler(A), saveHandler(B)]) against an in-memory FTM double and assert the final written JSON parses to exactly A or exactly B (no interleaved bytes).',
    commandmentRefs: ['C12'],
  },
  {
    id: 'UX-P0-CODE-I1',
    severity: 'info',
    title: 'Inline Zod schema reproduction in test creates a second source of truth',
    observed:
      'electron/__tests__/governance-ipc.test.ts lines 44-54 inline a local copy of governanceSaveOverridesValidator rather than importing from shared/ipc-validators.ts. A comment at lines 36-42 explains the vitest module-resolution workaround.',
    rationale:
      'The inlined schema can drift from the production export — e.g., a future severity enum addition might update the real schema but not the copy. Tests would continue to pass while real payloads start failing.',
    evidence: [
      { file: 'electron/__tests__/governance-ipc.test.ts', line: 44 },
      { file: 'shared/ipc-validators.ts', line: 519 },
    ],
    fix: 'Either fix the vitest alias so shared/ipc-validators.ts imports cleanly, or add a meta-assertion that parses the same canonical payload through both schemas and asserts success parity.',
    commandmentRefs: [],
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'UX-P0',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-21',
    round: 1,
    scope: [
      '11 production files (hook, panel, status bar, resize handle, App, electron main, preload, server, shared validators, flint-api types, web-api adapter)',
      '4 test files (governance-ipc, useGovernanceCategories, GovernancePanel, ResizeHandle)',
    ],
    markdownFile: 'UX-P0-code-review-2026-04-21.md',
  },
  rubric: [
    { criterion: 'All renderer→main IPC channels declare a Zod validator', result: 'pass', evidence: 'governanceSaveOverridesValidator + governanceGetOverridesValidator exported from shared/ipc-validators.ts:528,537' },
    { criterion: 'File writes route through FileTransactionManager (C12 + C14)', result: 'pass', evidence: 'electron/main.ts:4450 uses fileTransactionManager.write; server/index.ts:2088 uses atomicWrite' },
    { criterion: 'No raw fs.writeFile for persisted governance state', result: 'pass' },
    { criterion: 'Zod validator style consistent with existing channels', result: 'pass', evidence: 'Matches FORGE.1 / CHRON.1 naming + block-comment banner convention' },
    { criterion: 'Web build parity — server/index.ts mirrors electron/main.ts handler', result: 'pass', evidence: 'server/index.ts:2073-2108 mirrors electron/main.ts:4432-4472' },
    { criterion: 'historyStore.clear() is correct API for demo load (not pushCheckpoint)', result: 'pass', evidence: 'historyStore.ts:21 documents clear() as file-open reset' },
    { criterion: 'GovernancePanel isReturningToDefault handles severity-only overrides', result: 'pass', evidence: 'GovernancePanel.tsx:282-284 checks both enabled and severity; setOverride merges via spread at governanceStore.ts:66' },
    { criterion: 'useGovernanceCategories filter fail-open when ruleId missing', result: 'pass', evidence: 'useGovernanceCategories.ts:57 returns true when !w.ruleId' },
    { criterion: 'Edge cases covered: empty, malformed JSON, missing file', result: 'pass', evidence: 'GOVERR-04, GOVERR-08, GOVERR-07' },
    { criterion: 'Hook-layer React integration test for new filter', result: 'fail', evidence: 'useGovernanceCategories.test.ts has no tests exercising the overrides filter with real store wiring' },
    { criterion: 'Concurrent-write invariant asserted', result: 'fail', evidence: 'No test pairs await Promise.all of save calls' },
    { criterion: 'Test file imports production Zod schema (no drift risk)', result: 'fail', evidence: 'governance-ipc.test.ts:44-54 inlines local copy' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'src/hooks/useGovernanceCategories.ts',
      'src/components/ui/GovernancePanel.tsx',
      'src/components/editor/StatusBar.tsx',
      'src/components/ui/ResizeHandle.tsx',
      'src/App.tsx',
      'electron/main.ts',
      'electron/preload.ts',
      'server/index.ts',
      'shared/ipc-validators.ts',
      'src/types/flint-api.d.ts',
      'src/adapters/web-api.ts',
      'electron/__tests__/governance-ipc.test.ts',
      'src/hooks/__tests__/useGovernanceCategories.test.ts',
    ],
    skipped: [
      'src/components/ui/__tests__/GovernancePanel.test.tsx — presence verified, content skimmed (not blocking)',
      'src/components/ui/__tests__/ResizeHandle.test.tsx — presence verified (no behavioral change to ResizeHandle in this phase)',
      'src/components/editor/__tests__/StatusBar.test.tsx — StatusBar surface unchanged for UX-P0',
    ],
  },
};
