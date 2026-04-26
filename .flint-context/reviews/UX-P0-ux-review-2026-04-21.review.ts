import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Gate label button has weak visual affordance',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/editor/StatusBar.tsx',
        line: 616,
        excerpt: "className={`flex flex-shrink-0 min-h-[24px] cursor-pointer items-center gap-1.5 text-sm font-medium transition-colors ${canExport ? 'text-emerald-500 hover:text-emerald-400' : 'text-amber-400 hover:text-amber-300'}`}",
        note: 'No border, underline, chevron, or non-color hover hint; reads as a passive label in the dense StatusBar row.',
      },
    ],
    observed:
      'The T1.3 gate label is now a <button> and semantically actionable, but its only differentiation from a static label is color plus cursor:pointer on hover. No chevron, underline, or border is used.',
    rationale:
      'Trust-gap fixes depend on the designer discovering the entry point. The StatusBar already mixes labels, chips, and dots; a button rendered as plain text raises friction at the exact moment the designer is trying to resolve a block. Affordance weakness partially undermines the intent of T1.3.',
    proposedFix:
      'Add a ChevronRight icon or dotted underline when !canExport; alternatively a faint ring-1 ring-amber-500/20 on hover to signal interactivity.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-2',
    title: 'Category chip counts ignore the new rule-enabled filter',
    severity: 'warning',
    evidence: [
      {
        file: 'src/hooks/useGovernanceCategories.ts',
        line: 43,
        excerpt:
          "const syncCount = allLinterWarnings.filter((w) => w.type === 'sync').length\nconst designSystemCount = allLinterWarnings.filter((w) => w.type !== 'sync').length\nconst accessibilityCount = allA11yWarnings.length",
        note: 'Counts derived from pre-filter arrays.',
      },
      {
        file: 'src/hooks/useGovernanceCategories.ts',
        line: 64,
        excerpt: 'const enabled = allLinterWarnings.filter(isRuleEnabled)',
        note: 'Lists use post-filter; counts do not.',
      },
    ],
    observed:
      'visibleLinterWarnings and visibleA11yWarnings apply isRuleEnabled, but chipCounts are computed from allLinterWarnings/allA11yWarnings without the filter applied.',
    rationale:
      'Designer disables a rule in GovernancePanel, returns to the dashboard, and sees e.g. a chip showing "5" but a list showing "3". The divergence reads as either a broken filter or unreliable governance — the exact trust erosion UX-P0 aims to fix.',
    proposedFix:
      'Compute counts from allLinterWarnings.filter(isRuleEnabled) and allA11yWarnings.filter(isRuleEnabled).',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-3',
    title: 'Gate count excludes overrides when both violations and overrides block export',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/editor/StatusBar.tsx',
        line: 317,
        excerpt:
          "const totalIssues = mithrilViolations.length + a11yViolationCount;\nconst gateLabel = (() => {\n  if (canExport) return null;\n  if (totalIssues > 0) {\n    return `${totalIssues} ${totalIssues === 1 ? 'issue' : 'issues'} blocking export`;\n  }\n  return 'Overrides blocking export';\n})();",
        note: 'Overrides only surface in the fallback branch; hidden when violations also exist.',
      },
    ],
    observed:
      'totalIssues sums only Mithril + a11y counts. When overrides AND violations both block export, the label only cites violations; overrides become invisible until every violation is resolved.',
    rationale:
      'Designer resolves N violations expecting "Export Ready", then still sees "Overrides blocking export" appearing out of nowhere. Violates the "count matches remedy" contract that makes the new label trustworthy.',
    proposedFix:
      'Append override indicator when both conditions hold, e.g. "3 issues blocking export (plus overrides)".',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-1',
    title: 'Resize handle visual bar is near-invisible at rest',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/ResizeHandle.tsx',
        line: 82,
        excerpt:
          "<div className={['w-px h-full', 'bg-transparent', 'transition-colors duration-100', 'group-hover:bg-indigo-500/20', 'group-data-[dragging=true]:bg-indigo-500/30'].join(' ')} />",
        note: '1px bar with transparent default background.',
      },
    ],
    observed:
      'T1.4 raised the handle above React Flow via z-50 and expanded the hit zone to 24px. The visible bar remains w-px with bg-transparent by default.',
    rationale:
      'Pointer events now reach the handle, but discoverability is still low — designers have no at-rest signal that the panel boundary is adjustable. Not a regression introduced by T1.4; just an adjacent polish that would amplify its intent.',
    proposedFix:
      'Base class bg-zinc-700/20 (or similar low-opacity tint) so the bar hints at rest and intensifies on hover.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-2',
    title: 'handleLoadDemo clears undo unconditionally from launch screen',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 442,
        excerpt:
          'useHistoryStore.getState().clear()\nawait hydrateWorkspace(tree as FileTreeNode)',
        note: 'No confirmation when canUndo is true.',
      },
    ],
    observed:
      'handleLoadDemo clears the undo stack before hydrating the demo project. The subsequent workspace replacement makes the lost undo mostly irrelevant, but the action is destructive without warning.',
    rationale:
      'Consistent with the trust theme: a "load demo" action mid-session silently throws away undo history. Minor concern — bounded by hydrateWorkspace replacing the tree — but worth a confirm toast when canUndo is true.',
    proposedFix:
      'If useHistoryStore.getState().canUndo, prompt "Load demo? Unsaved changes will be lost" before calling clear().',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-3',
    title: '"Nothing to undo" toast can thrash on held Cmd+Z',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 610,
        excerpt:
          "if (e.key === 'z' && !e.shiftKey) {\n  e.preventDefault()\n  if (!useHistoryStore.getState().canUndo) {\n    useNotificationStore.getState().push({ type: 'undo', title: 'Nothing to undo', ... })",
        note: 'No dedupe/throttle; each keyrepeat pushes a new toast.',
      },
    ],
    observed:
      'Holding Cmd+Z when the undo stack is empty fires the toast repeatedly. The notification store caps concurrent toasts at 5, but visual thrash during a keyrepeat burst is distracting.',
    rationale:
      'Small polish; prevents the fix itself from creating new friction.',
    proposedFix:
      'Debounce the empty-stack push (e.g. suppress if last push <500ms ago) or dedupe by title in the notification store.',
    scope: 'one-file',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'UX-P0',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-21',
    round: 1,
    scope: [
      'src/hooks/useGovernanceCategories.ts',
      'src/components/ui/GovernancePanel.tsx',
      'src/components/editor/StatusBar.tsx',
      'src/components/ui/ResizeHandle.tsx',
      'src/App.tsx',
    ],
    markdownFile: 'UX-P0-ux-review-2026-04-21.md',
  },
  rubric: [
    { criterion: 'Disabling a rule removes its violations from the list', result: 'pass' },
    {
      criterion: 'Chip counts stay in sync with visible violations',
      result: 'fail',
      evidence:
        'useGovernanceCategories.ts:43 — counts from allLinterWarnings pre-filter; lists from allLinterWarnings.filter(isRuleEnabled)',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'Toggle-back to default clears "modified" when no severity drift remains',
      result: 'pass',
    },
    {
      criterion: 'Toggle-back preserves override when severity is still non-default',
      result: 'pass',
    },
    { criterion: 'Gate label communicates cause + remedy', result: 'pass' },
    {
      criterion: 'Gate label is visibly interactive (button affordance)',
      result: 'fail',
      evidence:
        'StatusBar.tsx:616 — color-only differentiation, no chevron/underline/border',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'Gate count reflects all blockers (violations + overrides)',
      result: 'fail',
      evidence:
        'StatusBar.tsx:317 — totalIssues sums only Mithril + a11y; overrides hidden when violations also present',
      relatedFindings: ['WARN-3'],
    },
    { criterion: 'Resize handle captures pointer events reliably', result: 'pass' },
    { criterion: 'Undo after demo load does not rewind into pre-demo state', result: 'pass' },
    { criterion: 'Empty-stack Cmd+Z provides user-visible feedback', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'ux'),
  scopeCoverage: {
    reviewed: [
      'src/hooks/useGovernanceCategories.ts',
      'src/components/ui/GovernancePanel.tsx (handleToggle, RuleRow, modified badge)',
      'src/components/editor/StatusBar.tsx (Export Gate button + gateLabel)',
      'src/components/ui/ResizeHandle.tsx (z-index + 24px hit zone)',
      'src/App.tsx (handleLoadDemo, first-launch demo load, Cmd+Z handler)',
    ],
    skipped: [
      'Full GovernancePanel tab/profile flows — unchanged by UX-P0',
      'LivePreview iframe interaction with resize handle — not touched by T1.4 beyond z-index',
      'OverflowMenu items in StatusBar — out of scope for T1.3',
    ],
  },
};
