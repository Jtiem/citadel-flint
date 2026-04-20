import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'BLK-1',
    title: 'Element Properties default-state test fails; test and implementation contradict',
    severity: 'blocking',
    evidence: [
      {
        file: 'src/components/ui/PropertiesPanel.tsx',
        line: 567,
        excerpt: 'expandedWhen={() => true}',
        note: 'Implementation cites rev-3 directive from Justin that an actionable section opens on select.',
      },
      {
        file: 'src/components/ui/PropertiesPanel.tsx',
        line: 557,
        excerpt: 'expandedWhen: () => true — Element Properties expands when a node is selected.',
        note: 'Inline comment records the binding rationale.',
      },
      {
        file: 'src/components/ui/__tests__/properties-canary.test.tsx',
        line: 161,
        excerpt: "it('Element Properties section starts collapsed (expandedWhen: () => false)', ...)",
        note: 'Test searches for aria-expanded="false" trigger; no such trigger exists on mount. Test currently fails.',
      },
    ],
    observed:
      'Running `npm run test:react -- src/components/ui/__tests__/properties-canary.test.tsx` produces 1 failure (34/35 pass): the Element Properties section is expected to mount collapsed but the implementation mounts it expanded.',
    rationale:
      'The implementation and the test disagree on the default state of the Element Properties Section. The implementation includes a justification comment citing Justin\'s rev-3 directive. The test was likely written against an earlier expectation and not updated. Either side can be correct — but a red test blocks the contract invariant that primitive/canary test pass rate be 100%.',
    proposedFix:
      'If the rev-3 directive stands: update properties-canary.test.tsx:155-168 to assert aria-expanded="true" and rename the test to match. If Justin has since reversed the directive: change PropertiesPanel.tsx:567 to `expandedWhen={() => false}` and update the comment. Surface the question to Justin; one of the two must change before SHIP.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'WARN-1',
    title: '`measuredBy` grep commands in contract match JSDoc comments and test files',
    severity: 'warning',
    evidence: [
      {
        file: '.flint-context/contracts/GLASSTYPO.1.contract.ts',
        line: 754,
        excerpt:
          'measuredBy: \'grep -rnE "text-transform:\\\\s*uppercase" ... | grep -v PanelTabLabel.tsx | wc -l\'',
        note: 'The `grep -v PanelTabLabel.tsx` filter does not exclude PanelTabLabel.test.tsx — the JSDoc header and `it(...)` description strings in the test file match the regex.',
      },
      {
        file: 'src/components/ui/primitives/__tests__/PanelTabLabel.test.tsx',
        line: 5,
        excerpt: ' *  - text-transform: uppercase applied via inline style (not a utility class)',
        note: 'JSDoc comment line that the contract\'s grep erroneously counts as a violation.',
      },
      {
        file: '.flint-context/contracts/GLASSTYPO.1.contract.ts',
        line: 814,
        excerpt:
          'measuredBy: \'grep -rnE "text-\\\\[var\\\\(--spacing\\\\." src/components/ui/PropertiesPanel.tsx src/components/inspector | wc -l\'',
        note: 'The grep returns 4 matches, all in file-header JSDoc comments announcing that the pattern was removed.',
      },
      {
        file: 'src/components/inspector/primitives.tsx',
        line: 7,
        excerpt: ' *  - All `text-[var(--spacing.*)]` font-size references replaced with',
        note: 'JSDoc comment that the contract\'s grep erroneously counts as a violation.',
      },
    ],
    observed:
      'Two invariants (`canary-all-caps-only-via-primitive`, `properties-zero-spacing-font-size`) have raw `measuredBy` grep commands that return non-zero counts when executed verbatim, yet the functional intent of both invariants is satisfied across production code.',
    rationale:
      'Phase 1.5 linting and any CI gate that runs these greps verbatim will report a false failure. This is a contract-authoring defect, not a code defect, but because the contract is the binding spec the discrepancy needs to be resolved before the invariants can be mechanically checked. Contract risk #1 already anticipated this ("Schema-role audit is brittle (prop + JSDoc + grep mix)") and proposed promoting to a Babel visitor in GLASSTYPO.2.',
    proposedFix:
      'Tighten the `measuredBy` regexes to exclude JSDoc-comment lines and test files: add `--exclude-dir=__tests__ --exclude="*.test.tsx"` and pipe through `grep -vE "^[^:]+:[0-9]+:\\s*\\*"` to drop star-prefixed comment lines. Or switch to the `className=[^>]*\\buppercase\\b` pattern used by `canary-zero-inline-uppercase`, which is comment-free by construction.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-2',
    title: 'Inline `style={{ ... var(--text-*) ... }}` mixed with utility classes — 120 inline uses',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/primitives/PropertyRow.tsx',
        excerpt:
          "style={{ fontSize: 'var(--text-label)', lineHeight: 'var(--text-label-lh)', fontWeight: 'var(--text-label-weight)', color: 'var(--text-primary)' }}",
        note: 'Primitive uses inline style for the size/LH/weight/color quadruple rather than composite utility classes.',
      },
      {
        file: 'src/components/ui/primitives/Section.tsx',
        line: 136,
        excerpt:
          "style={{ fontSize: 'var(--text-title)', lineHeight: 'var(--text-title-lh)', fontWeight: 'var(--text-title-weight)', color: 'var(--text-primary)' }}",
      },
      {
        file: 'src/components/ui/primitives/PanelTabLabel.tsx',
        line: 46,
        excerpt: "style={{ fontSize: 'var(--text-label)', ..., textTransform: 'uppercase', color: ... }}",
      },
    ],
    observed:
      '120 inline `style` lines referencing `var(--text-*)` across canary scope, alongside 81 uses of Tailwind utility classes (`text-primary`, `text-title`, etc.) generated by the `@theme` block. The two patterns coexist without a documented rule for which to use.',
    rationale:
      'Inline style is partially justified at the primitive level because Tailwind utilities only set `font-size` — the companion `lineHeight` and `fontWeight` come from separate custom properties (`--text-label-lh`, `--text-label-weight`). Bundling all four into one `style` block atomically ties the triple. But mixing utility classes at non-primitive call sites with inline style at primitive call sites produces an inconsistent canary that is harder to audit and harder to extend. Without a decision, this pattern will propagate to GLASSTYPO.2 and harden into a de-facto standard.',
    proposedFix:
      'Pick one: (1) Add a composite `text-scale-title` / `text-scale-body` / ... utility via `@utility` in `src/index.css` that sets size+LH+weight atomically, and migrate primitives to className-only. (2) Document in the contract that primitives use inline style for size-family bundling and every non-primitive canary call site uses utility classes; enforce via a Mithril rule in GLASSTYPO.2.',
    scope: 'cross-file',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'GLASSTYPO.1',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-19',
    round: 1,
    scope: [
      'src/index.css (@theme block)',
      '6 primitives under src/components/ui/primitives/',
      '6 primitive test files',
      'src/components/ui/GovernanceDashboard.tsx',
      '19 files under src/components/ui/governance/',
      'src/components/ui/PropertiesPanel.tsx',
      '4 files under src/components/inspector/',
      '2 canary test files (canary-visual, properties-canary)',
      'Contract artifacts (GLASSTYPO.1.contract.ts + .md)',
    ],
    markdownFile: 'GLASSTYPO.1-code-review-2026-04-19.md',
  },
  rubric: [
    {
      criterion: 'npx tsc --noEmit exits 0',
      result: 'pass',
    },
    {
      criterion: 'All primitive component tests pass',
      result: 'pass',
      evidence: '74/74 passing in src/components/ui/primitives/__tests__/',
    },
    {
      criterion: 'Canary visual-regression tests all pass',
      result: 'fail',
      evidence: 'properties-canary.test.tsx 1/16 failing (Element Properties default-state)',
      relatedFindings: ['BLK-1'],
    },
    {
      criterion:
        '5 --text-{size} tokens and 4 --text-{color} tokens declared in src/index.css @theme block',
      result: 'pass',
      evidence: 'grep confirms 5 size + 4 color tokens in src/index.css:13-45',
    },
    {
      criterion: 'Legacy --spacing.* vars preserved (non-breaking migration)',
      result: 'pass',
      evidence: '17 --spacing.* declarations preserved in src/index.css:61-77',
    },
    {
      criterion:
        'Governance canary: 0 text-[var(--spacing.*)], 0 text-zinc-{400..700}, 0 inline uppercase',
      result: 'pass',
    },
    {
      criterion:
        'Properties canary: 0 text-[var(--spacing.*)], 0 text-zinc-{400..700}, 0 inline uppercase',
      result: 'pass',
      evidence:
        'Functional greps return zero real matches; contract measuredBy greps pick up JSDoc comments only (WARN-1).',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'Section open-state invariants (distinct bg, >=1px left border, >=10px padding-left, outer>=2x inner spacing) all covered by passing tests',
      result: 'pass',
    },
    {
      criterion: 'ExpandedWhen type rejects literal true/false (compile-time error)',
      result: 'pass',
      evidence: 'type signature `(ctx: SectionContext) => boolean` forbids literal assignment; verified via TSC.',
    },
    {
      criterion: 'No Node.js imports (fs, path, child_process, sqlite3) anywhere in src/',
      result: 'pass',
    },
    {
      criterion: 'No direct ipcRenderer usage in React components',
      result: 'pass',
      evidence: 'Pure renderer refactor; no IPC touched.',
    },
    {
      criterion: 'Commandment 2 (No Hallucinated Styling): every visual value routes through a declared token',
      result: 'pass',
      evidence: 'No raw hex/px font-sizes in primitives; color-mix uses existing --text-* tokens.',
    },
    {
      criterion: 'Commandment 13 (Deterministic Surgery): no regex source-code modification introduced',
      result: 'pass',
    },
    {
      criterion: 'Commandment 14 (Bypass Prohibition): no fs/git direct access',
      result: 'n/a',
      evidence: 'Renderer refactor does not touch persistence.',
    },
    {
      criterion: 'Accordion export deleted from inspector/primitives.tsx with no dangling call sites',
      result: 'pass',
      evidence: 'Confirmed via grep; only doc-comment references remain in ClassBuilder.tsx and inspector/primitives.tsx header.',
    },
    {
      criterion: 'color-mix(in oklch, ...) supported in target runtime',
      result: 'pass',
      evidence: 'Electron 35.7.5 ships Chromium 130; color-mix available since Chromium 111.',
    },
    {
      criterion: 'Inline style vs utility class pattern is consistent across canary',
      result: 'fail',
      evidence: '120 inline-style uses vs 81 utility-class uses without a documented rule (WARN-2).',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'Contract measuredBy commands are self-consistent (run cleanly over the canary)',
      result: 'fail',
      evidence: 'Two invariant greps match JSDoc comments and test files (WARN-1).',
      relatedFindings: ['WARN-1'],
    },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'src/index.css',
      'src/components/ui/primitives/Section.tsx',
      'src/components/ui/primitives/PropertyRow.tsx',
      'src/components/ui/primitives/FooterActionBar.tsx',
      'src/components/ui/primitives/MetadataTooltip.tsx',
      'src/components/ui/primitives/StatBadge.tsx',
      'src/components/ui/primitives/PanelTabLabel.tsx',
      'src/components/ui/primitives/__tests__/*.test.tsx (6 files)',
      'src/components/ui/GovernanceDashboard.tsx',
      'src/components/ui/governance/*.tsx (24 files)',
      'src/components/ui/governance/__tests__/canary-visual.test.tsx',
      'src/components/ui/PropertiesPanel.tsx',
      'src/components/inspector/primitives.tsx',
      'src/components/inspector/ClassBuilder.tsx',
      'src/components/inspector/DriftDetector.tsx',
      'src/components/inspector/LayoutPanel.tsx',
      'src/components/ui/__tests__/properties-canary.test.tsx',
      '.flint-context/contracts/GLASSTYPO.1.contract.ts',
      '.flint-context/contracts/GLASSTYPO.1-contract.md',
    ],
    skipped: [
      'src/components/ui/governance/__tests__/* individual rule tests — invariant-level canary-visual test covers the schema contract',
      'Visual verification at 320/360/400px widths — Phase 3 Justin visual sign-off (non-goal for code review)',
      'Panels outside canary (Tokens, Assets, StatusBar, ExportModal) — explicit non-goal per contract',
    ],
  },
};
