import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'INSPECTOR.1-UX-F1',
    title: 'Auto-expand registry is not enforced at render',
    severity: 'high',
    category: 'ux',
    observed:
      'All Group B inspector sections pass expandedWhen={() => true} or a violation-based predicate, never consulting getAutoExpandedSections(tagName). On first render every relevant section opens simultaneously.',
    rationale:
      'Violates contract invariant #4 (auto-expand-matches-registry) and ODQ-3 answer (primary-only). Re-introduces the visual churn the registry was designed to eliminate — selecting <h1> opens Typography + Layout + A11y + NodeProperties together.',
    evidence: [
      { file: 'src/components/inspector/TypographySection.tsx', line: 159, snippet: 'expandedWhen={() => true}' },
      { file: 'src/components/inspector/MediaPropsSection.tsx', line: 154, snippet: 'expandedWhen={() => true}' },
      { file: 'src/components/inspector/FormPropsSection.tsx', line: 66, snippet: 'expandedWhen={() => true}' },
      { file: '.flint-context/contracts/INSPECTOR.1-contract.md', line: 157, snippet: 'auto-expand-matches-registry — rendered Sections with aria-expanded="true" === getAutoExpandedSections(tag) exactly' },
    ],
    suggestedFix:
      'Pass an initiallyExpanded boolean from PropertiesPanel to each section (derived from getAutoExpandedSections(layer.tagName).includes(sectionName)); wire through to Section.expandedWhen.',
  },
  {
    id: 'INSPECTOR.1-UX-F2',
    title: '3-second focus-steal cooldown referenced in prompt is not implemented',
    severity: 'medium',
    category: 'ux',
    observed:
      'useAutoTabSwitch gates solely on the userOverrodeTab boolean; no time-based cooldown exists. Review prompt asked me to evaluate the 3s duration.',
    rationale:
      'Either the cooldown was dropped silently or the review prompt is stale. Recommendation is to keep the boolean-only model — time-based tab-reassertion mid-workflow would be worse than both alternatives. Flag the divergence so Justin chooses deliberately.',
    evidence: [
      { file: 'src/hooks/useAutoTabSwitch.ts', line: 36, snippet: 'useEffect(() => { const prev = prevSelectionRef.current; const curr = activeSelection; if (prev === null && curr !== null) { if (!userOverrodeTab) setRightTab("properties"); } })' },
      { file: '.flint-context/contracts/INSPECTOR.1-contract.md', line: 55, snippet: 'No cross-session persistence of userOverrodeTab. Override is session-scoped.' },
    ],
    suggestedFix:
      'Ratify the boolean-only model in contract + HANDOFF, or add a 3s guard. My recommendation: keep boolean-only; update review prompt.',
  },
  {
    id: 'INSPECTOR.1-UX-F3',
    title: 'Empty alt="" flagged as critical conflicts with decorative-image WCAG intent',
    severity: 'medium',
    category: 'ux',
    observed:
      'MediaPropsSection renders StatBadge variant="critical" with label "empty alt" whenever alt === "". Missing alt (undefined) is silently filtered out earlier in the loop.',
    rationale:
      'WCAG 2.1 H67 treats alt="" as valid and required for decorative images. Flagging it critical creates false positives on hero images, icon lockups, and Figma-imported illustrations. Critical severity also conflicts with Warden\'s own convention where "empty alt" is informational, not blocking.',
    evidence: [
      { file: 'src/components/inspector/MediaPropsSection.tsx', line: 91, snippet: '<StatBadge variant="critical" compact>empty alt</StatBadge>' },
      { file: 'src/components/inspector/MediaPropsSection.tsx', line: 74, snippet: 'if (rawValue === undefined) return null;' },
    ],
    suggestedFix:
      'Downgrade empty-alt to variant="warning" with label "decorative?"; reserve critical for alt entirely absent (which currently never fires because of the undefined-skip guard at line 74).',
  },
  {
    id: 'INSPECTOR.1-UX-F4',
    title: 'Generic fallback ranks Typography above Layout for custom components',
    severity: 'low',
    category: 'ux',
    observed:
      'GENERIC_SECTIONS is ordered [Typography, Layout, Appearance, A11y, NodeProperties]. Custom components (<Card>, <UserAvatar>) — the real fallback consumers — are overwhelmingly container-shaped.',
    rationale:
      'ODQ-4 justified the generic fallback for <div>, but <div> is in CONTAINER_TAGS — it never hits the generic path. Real consumers are custom components, where typography-first ordering adds a mostly-empty row at the top.',
    evidence: [
      { file: 'src/core/elementTypePropertyMap.ts', line: 91, snippet: "const GENERIC_SECTIONS: InspectorSection[] = ['Typography', 'Layout', 'Appearance', 'A11y', 'NodeProperties']" },
      { file: 'src/core/elementTypePropertyMap.ts', line: 50, snippet: "const CONTAINER_TAGS = new Set(['section', 'article', 'main', 'aside', 'nav', 'div', 'header', 'footer'])" },
    ],
    suggestedFix:
      "Reorder to ['Layout', 'Appearance', 'Typography', 'A11y', 'NodeProperties'].",
  },
  {
    id: 'INSPECTOR.1-UX-F5',
    title: 'Off-token warning badge says what is wrong but not what to do',
    severity: 'low',
    category: 'ux',
    observed:
      'TypographySection off-token branch renders a bare "off-token" StatBadge. matchValueToToken already returns result.nearestTokenName, but it is only surfaced on the on-token branch.',
    rationale:
      "Flags the problem without offering the fix. Users see '17px [off-token]' and must reason about the replacement. The nearest-token name is computed and discarded.",
    evidence: [
      { file: 'src/components/inspector/TypographySection.tsx', line: 179, snippet: '<StatBadge variant="warning" compact>off-token</StatBadge>' },
      { file: 'src/components/inspector/TypographySection.tsx', line: 189, snippet: '{result.nearestTokenName ?? value}' },
    ],
    suggestedFix:
      "When off-token, surface 'closest: text-lg (16px)' inline or in a tooltip on the badge.",
  },
  {
    id: 'INSPECTOR.1-UX-F6',
    title: 'No visual differentiation of the auto-expanded (primary) section',
    severity: 'low',
    category: 'ux',
    observed:
      'All four inspector sections pass schemaRole="primary-content". Once F1 is fixed, structural differentiation (open vs collapsed) resolves this. In current shipped state, everything is open and every section is primary.',
    rationale:
      "Eye needs an anchor on first render. Fixing F1 (primary-only expansion) handles this incidentally; noted as a no-op if F1 lands.",
    evidence: [
      { file: 'src/components/inspector/TypographySection.tsx', line: 157, snippet: 'schemaRole="primary-content"' },
      { file: 'src/components/inspector/MediaPropsSection.tsx', line: 152, snippet: 'schemaRole="primary-content"' },
    ],
    suggestedFix:
      "No separate action required if F1 lands.",
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'INSPECTOR.1',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-20',
    round: 1,
    scope: [
      'src/core/elementTypePropertyMap.ts',
      'src/hooks/useAutoTabSwitch.ts',
      'src/components/inspector/TypographySection.tsx',
      'src/components/inspector/FormPropsSection.tsx',
      'src/components/inspector/MediaPropsSection.tsx',
      'src/components/inspector/A11ySection.tsx',
    ],
    markdownFile: 'INSPECTOR.1-ux-review-2026-04-20.md',
  },
  rubric: [
    { criterion: 'Context-aware registry covers all named tags (ask #2)', result: 'pass' },
    { criterion: 'Primary-only auto-expand per ODQ-3 answer', result: 'fail', evidence: 'All sections pass expandedWhen={() => true}' },
    { criterion: 'Off-token raw value displayed inline and flagged (ask #3)', result: 'pass' },
    { criterion: 'Off-token badge offers actionable next step', result: 'fail', evidence: 'Bare "off-token" label; nearestTokenName discarded on the warn branch' },
    { criterion: 'Auto-tab-switch on null→id with manual-override respected (ask #1)', result: 'pass' },
    { criterion: 'Focus-steal cooldown behavior matches stated prompt', result: 'fail', evidence: 'No time-based cooldown; divergence from prompt' },
    { criterion: 'Fallback ordering appropriate for capitalized custom components', result: 'fail', evidence: 'Typography ranked above Layout in GENERIC_SECTIONS' },
    { criterion: 'Empty alt severity aligns with WCAG H67 decorative-image guidance', result: 'fail', evidence: 'alt="" flagged critical; should be warning' },
    { criterion: 'Selection plumbing read-only (Commandment 13)', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'ux'),
  scopeCoverage: {
    reviewed: [
      'elementTypePropertyMap registry (24 tags + fallback)',
      'useAutoTabSwitch hook transition semantics',
      'Group B inspector sections — Typography, Media, Form, A11y',
    ],
    skipped: [
      'PropertiesPanel.tsx dynamic assembly — not in scope files; F1 integration fix lives here',
      'tokenMatcher.matchValueToToken pure utility — covered by unit tests per contract',
      'canvasStore.userOverrodeTab slice — trivial boolean, not UX-facing',
    ],
  },
};
