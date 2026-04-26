import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'INSPECTOR.1-SEC-LOW-1',
    title: 'markTabOverridden() accepts calls with no active selection',
    severity: 'low',
    category: 'security',
    commandment: 14,
    status: 'open',
    observed:
      'markTabOverridden sets userOverrodeTab = true unconditionally with no precondition on activeSelection. If wired to a tab click while nothing is selected, a subsequent legitimate null→id auto-switch would be suppressed.',
    rationale:
      'Not exploitable — cannot bypass a security gate or leak data. UX regression only. Flagged here for completeness since the store invariant was named in scope.',
    evidence: [
      { file: 'src/store/canvasStore.ts', line: 1018, snippet: 'markTabOverridden: () => { if (get().userOverrodeTab) return; set({ userOverrodeTab: true }); }' },
      { file: 'src/hooks/useAutoTabSwitch.ts', line: 41, snippet: 'if (prev === null && curr !== null) { if (!userOverrodeTab) setRightTab(\'properties\') }' },
    ],
    proposedFix:
      'Optionally gate the setter on get().activeSelection !== null, or add JSDoc stating callers must only invoke this action while a selection is live.',
  },
  {
    id: 'INSPECTOR.1-SEC-LOW-2',
    title: 'Element-type bucket arrays are mutable module-level references',
    severity: 'low',
    category: 'security',
    commandment: 14,
    status: 'open',
    observed:
      'TEXT_SECTIONS / CONTAINER_SECTIONS / MEDIA_SECTIONS / INTERACTIVE_SECTIONS / FORM_SECTIONS / GENERIC_SECTIONS are exported-by-reference from resolveBucket. A future mutation bug in any consumer would poison the module singleton.',
    rationale:
      'Defense-in-depth. No current consumer mutates the returned array; React re-renders treat them as stable references. Low residual risk.',
    evidence: [
      { file: 'src/core/elementTypePropertyMap.ts', line: 43, snippet: 'const TEXT_SECTIONS: InspectorSection[] = [\'Typography\', \'Layout\', \'A11y\', \'NodeProperties\']' },
      { file: 'src/core/elementTypePropertyMap.ts', line: 122, snippet: 'return resolveBucket(tagName).sections' },
    ],
    proposedFix: 'Apply `as const` to each bucket array, or Object.freeze() at module load.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'INSPECTOR.1',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-20',
    round: 1,
    scope: [
      'src/core/elementTypePropertyMap.ts',
      'src/hooks/useAutoTabSwitch.ts',
      'src/store/canvasStore.ts (userOverrodeTab + markTabOverridden + setActiveSelection reset)',
      'src/utils/tokenMatcher.ts (matchValueToToken non-color paths)',
      'src/utils/astScanner.ts (scanArbitraryTypography + scanArbitrarySpacing)',
      'src/components/inspector/{Typography,FormProps,MediaProps,A11y}Section.tsx',
      'src/components/ui/PropertiesPanel.tsx',
      'src/App.tsx (useAutoTabSwitch mount point)',
    ],
    markdownFile: 'INSPECTOR.1-security-review-2026-04-20.md',
  },
  rubric: [
    { criterion: 'No dangerouslySetInnerHTML / innerHTML= in inspector sections', result: 'pass' },
    { criterion: 'Element-type map uses Set.has (no prototype-pollution bracket access)', result: 'pass' },
    { criterion: 'New regexes are anchored with bounded/negated classes (no ReDoS)', result: 'pass' },
    { criterion: 'userOverrodeTab reset logic is race-free; auto-switch gated on selection transition', result: 'pass' },
    { criterion: 'Babel traversal uses standard visitors (no custom recursion / stack-overflow risk)', result: 'pass' },
    { criterion: 'Commandment 13 — regexes operate on AST string literals, not source text', result: 'pass' },
    { criterion: 'Commandment 14 — no fs/electron/Node imports in src/ production code', result: 'pass' },
    { criterion: 'No new IPC channels introduced — preload surface unchanged', result: 'pass' },
    { criterion: 'No secrets introduced or touched by this phase', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'src/core/elementTypePropertyMap.ts',
      'src/hooks/useAutoTabSwitch.ts',
      'src/store/canvasStore.ts:INSPECTOR.1-slice',
      'src/utils/tokenMatcher.ts:matchValueToToken',
      'src/utils/astScanner.ts:scanArbitraryTypography+scanArbitrarySpacing',
      'src/components/inspector/*Section.tsx',
    ],
    skipped: [
      'electron/** — INSPECTOR.1 introduced no main-process changes',
      'flint-mcp/** — INSPECTOR.1 introduced no MCP surface changes',
    ],
  },
};
