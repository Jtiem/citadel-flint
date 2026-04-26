import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'INSPECTOR.1-code-F1',
    severity: 'blocker',
    category: 'code',
    title: 'Contract-scoped matrix test PropertiesPanel.inspector1.test.tsx is not implemented',
    observed:
      'ls src/components/ui/__tests__/PropertiesPanel.inspector1.test.tsx returns "No such file or directory". The contract lists this file in impact[] at INSPECTOR.1.contract.ts:248-252.',
    rationale:
      'Invariants relevant-sections-only-rendered, auto-expand-matches-registry, auto-tab-switch-on-selection (n>=20), and respects-manual-tab-switch are specified to be measured at the rendered PropertiesPanel boundary. Pure-function and hook unit tests prove the data and logic in isolation; they do not prove that PropertiesPanel consumes the registry correctly or that aria-expanded on rendered Sections equals getAutoExpandedSections.',
    evidence: [
      { file: '.flint-context/contracts/INSPECTOR.1.contract.ts', line: 248, quote: "file: 'src/components/ui/__tests__/PropertiesPanel.inspector1.test.tsx'" },
      { file: '.flint-context/contracts/INSPECTOR.1.contract.ts', line: 462, quote: "measuredBy: 'vitest matrix renders PropertiesPanel with each tag and asserts equality'" },
    ],
    fix: 'Create the matrix test. Iterate 24 tags, render PropertiesPanel with layer.tagName=T, assert rendered Section count equals getRelevantSections(T).length, assert Sections with aria-expanded="true" equals getAutoExpandedSections(T). Add a 20-trial starting-tab loop for auto-switch and a 5-selection post-override loop.',
  },
  {
    id: 'INSPECTOR.1-code-F2',
    severity: 'warning',
    category: 'code',
    title: 'Duplicate CIEDE2000 implementation violates token-match-reuses-mithril as written',
    observed:
      'grep -rnE "CIEDE2000|deltaE2000" src/ --include=*.ts --include=*.tsx excluding tests finds two definitions of deltaE2000: src/utils/tokenMatcher.ts:131 and src/utils/color/colorMath.ts:114.',
    rationale:
      'Invariant token-match-reuses-mithril measures "= 1 file (tokenMatcher.ts only)". colorMath.ts predates INSPECTOR.1, so the phase did not introduce the drift, but the invariant as written currently fails.',
    evidence: [
      { file: 'src/utils/tokenMatcher.ts', line: 131 },
      { file: 'src/utils/color/colorMath.ts', line: 114 },
      { file: '.flint-context/contracts/INSPECTOR.1.contract.ts', line: 486, quote: "threshold: '= 1 (tokenMatcher.ts only)'" },
    ],
    fix: 'Either collapse colorMath.ts::deltaE2000 to a re-export of tokenMatcher.ts (or vice versa) so one definition exists, or amend the invariant to accept colorMath.ts as a shared primitive.',
  },
  {
    id: 'INSPECTOR.1-code-F3',
    severity: 'warning',
    category: 'code',
    title: 'Hook test coverage narrower than contract invariant thresholds',
    observed:
      'useAutoTabSwitch.test.ts contains 7 tests covering single-trial null->id, id->id, override-blocks, and deselect-resets paths.',
    rationale:
      'Invariant auto-tab-switch-on-selection requires n>=20 random-starting-tab trials. Invariant respects-manual-tab-switch requires 5 selection changes after markTabOverridden. Neither loop is present.',
    evidence: [
      { file: 'src/hooks/__tests__/useAutoTabSwitch.test.ts' },
      { file: '.flint-context/contracts/INSPECTOR.1.contract.ts', line: 452, quote: "threshold: '= 100% over n >= 20 jsdom trials'" },
    ],
    fix: 'Either add the loops here or cover them in the F1 integration matrix test.',
  },
  {
    id: 'INSPECTOR.1-code-F4',
    severity: 'warning',
    category: 'code',
    title: 'TypographySection named-extractor may misclassify non-size text-* utilities as fontSize',
    observed:
      'extractNamed(cls, "text-") matches [\\w\\-./]+ and feeds fontSize. text-center, text-ellipsis, text-justify would be captured and passed to matchValueToToken as fontSize, flagging off-token with incorrect rationale.',
    rationale:
      'Font-* parsing is already guarded via the weightWords set; the text-* path lacks the analogous guard. The off-token warning would fire on a valid Tailwind alignment utility.',
    evidence: [
      { file: 'src/components/inspector/TypographySection.tsx', line: 73 },
      { file: 'src/components/inspector/TypographySection.tsx', line: 82 },
    ],
    fix: 'Gate the named text-* fallback on a known Tailwind size-scale set (xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl, 7xl, 8xl, 9xl) before treating as fontSize.',
  },
  {
    id: 'INSPECTOR.1-code-F5',
    severity: 'info',
    category: 'code',
    title: 'TypographySection hard-codes expandedWhen=true; expansion control moved to PropertiesPanel',
    observed:
      'TypographySection.tsx:159 renders <Section expandedWhen={() => true}>, whereas the contract text suggests expandedWhen reads the registry.',
    rationale:
      'Responsibility for relevance/expansion moved up to PropertiesPanel which gates mount + controls expansion on the outer Section wrapper. The invariant remains satisfiable but a reader of the child component could be misled.',
    evidence: [
      { file: 'src/components/inspector/TypographySection.tsx', line: 159 },
      { file: 'src/components/ui/PropertiesPanel.tsx', line: 346 },
    ],
    fix: 'Add a short comment in TypographySection documenting that expansion is controlled by the parent PropertiesPanel.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'INSPECTOR.1',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-20',
    round: 1,
    scope: [
      '11 source files (registry, tokenMatcher, astScanner, hook, store slice, App wiring, PropertiesPanel, 4 section components)',
      '5 test files (registry, hook, 4 section tests — 145 tests total)',
      'INSPECTOR.1 contract artifacts (.md + .contract.ts)',
    ],
    markdownFile: 'INSPECTOR.1-code-review-2026-04-20.md',
  },
  rubric: [
    { criterion: 'Commandment 2 — off-token surfaced, not silently substituted', result: 'pass', evidence: 'TypographySection.tsx:168-191 renders raw value + warning badge' },
    { criterion: 'Commandment 13 — no regex source-code surgery', result: 'pass', evidence: 'className parsing is runtime string parsing; no AST writes in inspector' },
    { criterion: 'Commandment 14 — no fs/electron/child_process in src/', result: 'pass', evidence: 'grep of process-boundary imports returns none in src/components/inspector' },
    { criterion: 'TypeScript strict, no any escape hatches', result: 'pass' },
    { criterion: 'userOverrodeTab reset in setActiveSelection(null) and closeWorkspace', result: 'pass', evidence: 'canvasStore.ts:755 and :1071' },
    { criterion: 'Matrix test PropertiesPanel.inspector1.test.tsx exists', result: 'fail', evidence: 'file absent on disk' },
    { criterion: 'Single-source CIEDE2000', result: 'fail', evidence: 'duplicate in src/utils/color/colorMath.ts:114' },
    { criterion: 'npx tsc --noEmit = 0 errors', result: 'pass' },
    { criterion: 'Inspector vitest suite passes', result: 'pass', evidence: '6 files, 145 tests, 0 failures' },
    { criterion: 'no-new-ipc invariant', result: 'pass' },
    { criterion: 'no-new-mcp-surface invariant', result: 'pass' },
    { criterion: 'off-token warning present for known-bad fixtures', result: 'pass', evidence: 'TypographySection.test.tsx' },
    { criterion: 'off-token warning absent for known-good fixtures', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'src/core/elementTypePropertyMap.ts',
      'src/core/__tests__/elementTypePropertyMap.test.ts',
      'src/utils/tokenMatcher.ts',
      'src/utils/astScanner.ts',
      'src/hooks/useAutoTabSwitch.ts',
      'src/hooks/__tests__/useAutoTabSwitch.test.ts',
      'src/store/canvasStore.ts',
      'src/App.tsx',
      'src/components/ui/PropertiesPanel.tsx',
      'src/components/inspector/TypographySection.tsx',
      'src/components/inspector/FormPropsSection.tsx',
      'src/components/inspector/MediaPropsSection.tsx',
      'src/components/inspector/A11ySection.tsx',
      'src/components/inspector/__tests__/TypographySection.test.tsx',
      'src/components/inspector/__tests__/FormPropsSection.test.tsx',
      'src/components/inspector/__tests__/MediaPropsSection.test.tsx',
      'src/components/inspector/__tests__/A11ySection.test.tsx',
    ],
    skipped: [
      'DriftDetector.tsx, ClassBuilder.tsx, LayoutPanel.tsx — declared non-goals',
      'electron/**, server/**, flint-mcp/** — out of scope per contract nonGoals',
    ],
  },
};
