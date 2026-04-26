/**
 * GLASSTYPO.1 — UX Review (machine-readable sibling)
 *
 * Reviewer: flint-ux-critic
 * Round: 1
 *
 * Severity mapping (narrative → schema):
 *   "major" → "warning" (leaky migration; fix-forward candidates)
 *   "minor" / "info" → "suggestion"
 *
 * No blocking findings. The schema, tokens, and primitives work; the enforcement
 * net has holes. The verdict derives to FIX-FORWARD — ship with follow-up.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Schema-role coverage is enforced on a handful of components, not the canary surface',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/governance/__tests__/canary-visual.test.tsx',
        line: 55,
        note: 'schema-role coverage test covers only GovernanceHeader/AnomalyBanner/BatchActionBar/PendingApprovalsAccordion (4 of ~20 canary files)',
      },
      {
        file: 'src/components/ui/governance/FixAllCta.tsx',
        line: 27,
        note: 'Full-width primary-looking button; no data-schema-role, no @schemaRole JSDoc, not asserted by canary-visual test',
      },
      {
        file: 'src/components/ui/governance/ZeroViolationCelebration.tsx',
        line: 35,
        note: 'Container, hero, title, description, grade — none tagged',
      },
      {
        file: 'src/components/ui/governance/ViolationCard.tsx',
        line: 411,
        note: 'Navigation-index marker, flag/unflag/defer buttons, copy button, snippet code — 20+ interactive elements without schema roles',
      },
    ],
    observed:
      'The contract invariant `canary-schema-role-coverage = 0 missing` is measured by a vitest test that renders a hand-picked subset of components, not the full GovernanceDashboard tree. Dozens of interactive elements across FixAllCta, ZeroViolationCelebration, and ViolationCard carry no data-schema-role or @schemaRole JSDoc.',
    rationale:
      'The Interaction Schema (§Q4) assumes every surface carries an unambiguous role so the accent/cta/nav-link discipline can be enforced mechanically. If the role is optional in practice, the schema degrades to documentation and the next migration inherits ambiguity.',
    proposedFix:
      'Either (a) tag every button/badge/row in the 25 canary files and extend canary-visual.test.tsx to render the full panel and assert every interactive descendant has a role, or (b) narrow the invariant scope to tagged surfaces and document the gap. Option (a) matches the contract\'s stated intent.',
    scope: 'cross-file',
    status: 'open',
  },
  {
    id: 'WARN-2',
    title: 'Accent color leaks outside CTA subtrees via raw text-indigo-300/400 utilities',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/governance/ViolationCard.tsx',
        line: 220,
        excerpt: '<code className="... text-indigo-300">',
        note: 'Accent-colored snippet display with no CTA ancestor',
      },
      {
        file: 'src/components/ui/governance/ViolationCard.tsx',
        line: 411,
        note: 'Wayfinding "start here" badge uses bg-indigo-500/30 text-indigo-300 ring-indigo-400/50 — not a CTA',
      },
      {
        file: 'src/components/ui/governance/FixAllCta.tsx',
        line: 33,
        note: 'Primary-looking button uses text-indigo-300 but has no cta-* role',
      },
      {
        file: 'src/components/ui/governance',
        note: 'grep -rc "text-(indigo|emerald|amber|red|blue)-(300|400|500|600)" → 99 occurrences across 18 files',
      },
    ],
    observed:
      'The canary-accent-confined-to-cta test walks elements whose computed color resolves to --text-accent (oklch exact match). Tailwind text-indigo-300 resolves to a lighter oklch that escapes the test, while still reading visually as accent to users. 99 indigo/semantic-colored text utilities live outside CTA subtrees in the canary.',
    rationale:
      'Schema §Q4 rule is "accent = actionable." The user-facing contract is visual, not computed-color-exact. A read-only code snippet colored indigo-300 still reads as "clickable" to the user, defeating the schema\'s promise.',
    proposedFix:
      'Expand the invariant to flag any text-indigo-{200..500} (and equivalent accent-adjacent hues) outside a data-schema-role="cta-*" subtree. Migrate call sites to var(--text-accent) behind a CTA tag or retag structural markers (e.g., navigation-index badge → state-signal with neutral color).',
    scope: 'cross-file',
    status: 'open',
  },
  {
    id: 'WARN-3',
    title: 'Arbitrary font-size utilities persist in 82 sites across the governance canary',
    severity: 'warning',
    evidence: [
      {
        file: 'src/components/ui/governance',
        note: 'grep for text-xs|text-sm|text-[10px]|text-[11px]|text-[12px]|text-[13px] → 82 occurrences across 10 files',
      },
      {
        file: 'src/components/ui/governance/ViolationCard.tsx',
        line: 473,
        note: 'Multiple buttons/badges (lines 473, 477, 485, 488, 492, 495, 498) use text-xs instead of [font-size:var(--text-label)]',
      },
      {
        file: 'src/components/ui/governance/ZeroViolationCelebration.tsx',
        line: 53,
        note: 'Hero uses text-xl (line 53), text-sm (56), text-xs (59) in sequence — legacy Tailwind sizes, not tokens',
      },
      {
        file: 'src/components/ui/governance/FixAllCta.tsx',
        line: 33,
        note: 'Primary fix-all button uses text-xs',
      },
    ],
    observed:
      'The contract banned text-[var(--spacing.*)] (original sin) and text-zinc-{400..700} (ad-hoc color) but did not ban Tailwind\'s built-in text-xs/text-sm/text-[Npx]. 82 arbitrary-size call sites remain in the canary scope.',
    rationale:
      'GLASSTYPO.1\'s stated purpose was "typography unifies behind 5 tokens." An unclamped parallel vocabulary (Tailwind sizes, arbitrary px brackets) means the discipline is partial; new code will imitate these patterns and re-fragment the hierarchy.',
    proposedFix:
      'Add a GLASSTYPO.1.1 hotfix invariant: `canary-no-raw-text-size = 0` matching /text-(xs|sm|base|lg|xl|2xl|3xl)|text-\\[\\d+px\\]/ in canary files. Mechanical migration to [font-size:var(--text-{token})].',
    scope: 'cross-file',
    status: 'open',
  },
  {
    id: 'SUG-1',
    title: 'FixAllCta has no schemaRole and uses raw indigo utilities',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/governance/FixAllCta.tsx',
        line: 27,
        excerpt:
          'className="flex w-full items-center justify-center gap-2 rounded border border-indigo-500/50 bg-indigo-900/20 px-3 py-2 text-xs font-medium text-indigo-300"',
      },
    ],
    observed:
      'FixAllCta is visually the most prominent button in the violation-panel viewport when auto-fixable issues exist, yet it has no data-schema-role. GovernanceHeader\'s Run Audit is tagged cta-primary; two visually-primary buttons compete, only one is tagged.',
    rationale:
      'The cta-primary-cap rule exists to prevent exactly this visual competition. Enforcement by tag without sight check allows the panel to violate the rule in practice while passing the invariant.',
    proposedFix:
      'Tag FixAllCta as cta-primary and retag GovernanceHeader\'s Run Audit as cta-secondary when violations > 0 (because the user\'s headline action when issues exist is to fix them, not re-audit). Alternatively, redesign FixAllCta into a compact cta-secondary.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-2',
    title: 'Properties-panel "Element Properties" Section trivializes the expandedWhen predicate',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/PropertiesPanel.tsx',
        line: 567,
        excerpt: 'expandedWhen={() => true}',
      },
      {
        file: 'src/components/ui/__tests__/properties-canary.test.tsx',
        line: 283,
        note: 'Test comment reads "Since Element Properties starts collapsed…" which contradicts the () => true predicate',
      },
    ],
    observed:
      'The Section predicate is a constant () => true with no SectionContext dependency. The contract prose defends this ("editing props IS an actionable lever") but the call site no longer encodes any conditional logic — the predicate becomes decorative, and the accompanying test contradicts the call-site behavior.',
    rationale:
      'Contract rev-2 Q1 decided `expandedWhen` must encode the actionable-state rule structurally. A constant predicate loses the teeth of the pattern; future developers copy-paste `() => true` and the discipline erodes.',
    proposedFix:
      'Either pass `expandedWhen={(ctx) => ctx.hasSelectedNode}` threading SectionContext through PropertiesPanel, or add a JSDoc above the call site explaining why () => true is correct here so future copy-pasters read before imitating.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-3',
    title: 'ZeroViolationCelebration ignores the new vocabulary entirely',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/governance/ZeroViolationCelebration.tsx',
        line: 53,
        excerpt: '<span className="text-xl font-black text-emerald-300" data-testid="celebration-grade">A+</span>',
      },
      {
        file: 'src/components/ui/governance/ZeroViolationCelebration.tsx',
        line: 56,
        excerpt: '<p className="text-sm font-semibold text-emerald-300" data-testid="celebration-title">',
      },
      {
        file: 'src/components/ui/governance/ZeroViolationCelebration.tsx',
        line: 59,
        note: 'Description uses text-xs [color:var(--text-secondary)] — half-migrated',
      },
    ],
    observed:
      'The Perfect-score celebration state was in the canary but was not migrated. It uses text-xl/text-sm/text-xs and text-emerald-300, carries no schemaRole tags, and therefore participates in no Interaction Schema rule.',
    rationale:
      'This is the one legitimate second use of --text-display (20px) outside CompactScoreSummary — it is the headline of a celebration state. Leaving it on legacy Tailwind sizes makes the canary internally inconsistent: two "hero number" components, two different typographic stacks.',
    proposedFix:
      'Mechanical migration: text-xl → [font-size:var(--text-display)]; text-sm/xs → [font-size:var(--text-body|label)]; add data-schema-role="primary-content" on hero and "support-evidence" on description.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-4',
    title: 'MetadataTooltip migration may hurt first-encounter discoverability',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/primitives/MetadataTooltip.tsx',
        line: 88,
        note: 'Tooltip content renders only on hover/focus; trigger is a cursor-default <button> with an (i) icon',
      },
      {
        file: '.flint-context/contracts/GLASSTYPO.1-contract.md',
        note: 'Contract rev-2 Q2/Q3 prescribes MetadataTooltip for passive prose like "Tracking starts after first audit"',
      },
    ],
    observed:
      'Users who previously saw onboarding prose always-visible ("Tracking starts after first audit") must now hover an (i) icon. The trigger has cursor-default which reads as "not clickable"; keyboard users can focus but the affordance is weak.',
    rationale:
      'Metadata compression is legitimate — panels were overcrowded. But onboarding context is "first-encounter explanation," not "reminder metadata." Tooltips serve the latter well, the former poorly.',
    proposedFix:
      'Non-blocking. Phase 3 visual review at 320/360/400px: if the tooltipped strings feel hidden, consider inline --text-tertiary on first-run state, collapsing to tooltip after acknowledgement.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-5',
    title: 'Section body padding rhythm is subtly asymmetric (10px left, 12px right)',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/primitives/Section.tsx',
        line: 169,
        excerpt:
          'style={isOpen ? { ..., paddingLeft: "10px", paddingTop: "8px", paddingBottom: "8px", paddingRight: "12px" } : undefined}',
      },
      {
        file: 'src/components/ui/primitives/Section.tsx',
        line: 115,
        note: 'Header has px-3 py-2 (12px horizontal)',
      },
    ],
    observed:
      'Body paddingLeft = 10px; header padding-left = 12px (from px-3). The 2px mismatch is sub-perceptual at 320px and faintly visible at 400px+ as a left-lean.',
    rationale:
      'The contract chose 10px deliberately (chevron width + gap = 6+4) to create a visible inset relative to the header title. The math holds but the inset relates to chevron not to nested content, so at scale the offset may read as a flaw rather than intent.',
    proposedFix:
      'Accept as-is and Phase 3 visual check, or tighten body paddingLeft to 12px (still distinct from 0-offset panel because the 1px accent border already does the inset work). Not load-bearing for invariants.',
    scope: 'one-line',
    status: 'open',
  },
];

const report: ReviewReport = {
  meta: {
    phase: 'GLASSTYPO.1',
    dimension: 'ux',
    reviewer: 'flint-ux-critic',
    date: '2026-04-19',
    round: 1,
    scope: [
      'src/index.css (token declarations)',
      'src/components/ui/primitives/ (6 primitives)',
      'src/components/ui/GovernanceDashboard.tsx + governance/ (20 files)',
      'src/components/ui/PropertiesPanel.tsx + inspector/ (5 files)',
      'canary-visual.test.tsx + properties-canary.test.tsx',
    ],
    markdownFile: 'GLASSTYPO.1-ux-review-2026-04-19.md',
  },
  rubric: [
    {
      criterion: '5 type tokens declared in src/index.css @theme block',
      result: 'pass',
      evidence: 'src/index.css:12-17 declares --text-display/title/body/label/micro',
    },
    {
      criterion: '4 color hierarchy tokens declared in src/index.css @theme block',
      result: 'pass',
      evidence: 'src/index.css:37-45 declares --text-primary/secondary/tertiary/accent',
    },
    {
      criterion: '6 primitives created under src/components/ui/primitives/',
      result: 'pass',
      evidence: 'Section, PropertyRow, FooterActionBar, MetadataTooltip, StatBadge, PanelTabLabel all exist',
    },
    {
      criterion: 'Legacy --spacing.N vars preserved for 483 out-of-canary call sites',
      result: 'pass',
      evidence: 'src/index.css:56-78 preserves --spacing.0..24',
    },
    {
      criterion: 'Zero text-[var(--spacing.*)] occurrences in canary scope',
      result: 'pass',
      evidence:
        'grep -rE "text-\\[var\\(--spacing" over governance + PropertiesPanel + inspector returns no runtime matches (only JSDoc comment strings mentioning the pattern)',
    },
    {
      criterion: 'Zero text-zinc-{400..700} occurrences in canary scope',
      result: 'pass',
      evidence: 'grep over canary returns 0 matches',
    },
    {
      criterion: 'Zero inline `uppercase` utility classes in canary (all-caps via PanelTabLabel only)',
      result: 'pass',
      evidence: 'grep for className="...uppercase..." over canary returns 0 matches',
    },
    {
      criterion: 'Accordion export deleted from inspector/primitives.tsx (Properties canary migration)',
      result: 'pass',
      evidence: 'inspector/primitives.tsx:5 declares Accordion DELETED; no call sites import it from inspector/primitives',
    },
    {
      criterion: 'Every component in canary carries schemaRole (prop or JSDoc)',
      result: 'fail',
      evidence:
        'FixAllCta, ZeroViolationCelebration, and 20+ descendants of ViolationCard lack data-schema-role and @schemaRole. See WARN-1.',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'cta-primary count ≤ 1 in rendered GovernanceDashboard',
      result: 'pass',
      evidence: 'GovernanceHeader Run Audit is the sole cta-primary-tagged element',
    },
    {
      criterion: 'cta-primary count = 0 in rendered PropertiesPanel (inspector)',
      result: 'pass',
      evidence: 'properties-canary.test.tsx:284-285 asserts zero cta-primary; confirmed by source inspection',
    },
    {
      criterion: '--text-accent text confined to CTA subtrees',
      result: 'fail',
      evidence:
        'Raw text-indigo-300/400 utilities (99 total in governance) appear outside CTA subtrees but escape the computed-color invariant. See WARN-2.',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'All font-sizes route through --text-{token} (no arbitrary Tailwind sizes in canary)',
      result: 'fail',
      evidence:
        '82 text-xs/text-sm/text-[Npx] occurrences remain in governance canary. Contract did not ban them; pattern was omitted. See WARN-3.',
      relatedFindings: ['WARN-3'],
    },
    {
      criterion: 'Section open-state background distinct from panel background',
      result: 'pass',
      evidence: 'src/components/ui/primitives/Section.tsx:170 sets background to color-mix 3% --text-primary when expanded',
    },
    {
      criterion: 'Section open-state left border ≥ 1px',
      result: 'pass',
      evidence: 'Section.tsx:171 sets borderLeft 1px solid color-mix(--text-accent 40%)',
    },
    {
      criterion: 'Section open-state paddingLeft ≥ 10px (parent-child indent)',
      result: 'pass',
      evidence: 'Section.tsx:172 paddingLeft: "10px"',
    },
    {
      criterion: 'Between-section gap ≥ 2× inside-section top padding (16 vs 8)',
      result: 'pass',
      evidence: 'Section.tsx:112 marginTop 16px; inside padding-top 8px',
    },
    {
      criterion: 'expandedWhen predicate encodes actionable-state rule (not a constant true/false)',
      result: 'fail',
      evidence:
        'PropertiesPanel.tsx:567 uses expandedWhen={() => true} with no SectionContext dependency. Contract rev-2 Q1 required predicate form to encode the rule structurally. See SUG-2.',
      relatedFindings: ['SUG-2'],
    },
    {
      criterion: 'FooterActionBar + FooterLink migration moves "Manage rules / Policy settings" out of CTA space',
      result: 'pass',
      evidence: 'GovernanceFooter.tsx uses FooterActionBar + FooterLink; nav-links use --text-secondary, not accent',
    },
    {
      criterion: 'MetadataTooltip primitive exists and delivers role="tooltip" on hover/focus',
      result: 'pass',
      evidence: 'MetadataTooltip.tsx:87-105 renders role="tooltip" content conditionally on hover/focus state',
    },
  ],
  findings,
  counts: countFindings(findings),
  scopeCoverage: {
    reviewed: [
      'src/index.css — token declarations',
      'src/components/ui/primitives/ — all 6 primitives',
      'src/components/ui/GovernanceDashboard.tsx composition',
      'src/components/ui/governance/ — spot-check on ViolationCard, FixAllCta, ZeroViolationCelebration, GovernanceHeader, GovernanceFooter, HealthScoreAccordion, CompactScoreSummary',
      'src/components/ui/PropertiesPanel.tsx migration',
      'src/components/inspector/ — Accordion deletion + token migration',
      'canary-visual.test.tsx + properties-canary.test.tsx',
    ],
    skipped: [
      'Tokens tab, StatusBar, Assets, ExportModal, Command Palette — explicit contract non-goals',
      'Runtime visual check at 320/360/400px — jsdom-only review; Justin to spot-check in Phase 3',
      'Screen-reader audio walkthrough — keyboard focus order verified structurally, not by audio',
      'Hover-state color ramps — only static declarations reviewed',
    ],
  },
  verdict: deriveVerdict(findings, 'ux'),
};

export const REPORT = report;
