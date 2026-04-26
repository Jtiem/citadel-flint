/**
 * GLASSTYPO.1 — Glass Interaction Schema + Figma-Rhythm Type Scale
 *                + Primitive Vocabulary (Governance + Properties Canary)
 *
 * Rev 3 — adds Section open-state visual spec and Properties-panel canary.
 *   Section body: tint (color-mix 3% --text-primary) + 1px left accent border
 *     (color-mix 40% --text-accent) + 10px padding-left + 8/12px v-padding.
 *   Between-section spacing 16px (strictly > 8px inside-section padding).
 *   Properties-panel scope joins Governance under the same rigor; Accordion
 *     in inspector/primitives.tsx migrates to Section.
 *   Properties cta-primary cap = 0 (inspector has no headline action).
 *
 * Rev 2 — incorporates Justin's binding decisions on Q1–Q5.
 *   Q1: Sections expand IFF user has an actionable lever inside → `expandedWhen` required.
 *   Q2: `--text-display` reserved for the single headline metric. Primary+Secondary are
 *       the everyday color pair; `--text-tertiary` is compression-only.
 *   Q3: All-caps adopted as a disciplined role — `PanelTabLabel` primitive, nowhere else.
 *   Q4: Interaction Schema is foundational. Accent is CTA-only; Nav-links are secondary.
 *   Q5: Primitive subfolder is `src/components/ui/primitives/`.
 *
 * This file declares no src/ imports — standalone types so Phase 2 agents
 * (and Phase 1.5 linter) can compile it in isolation.
 */

import type { FlintContract } from '../../shared/contract-schema';
import type { ReactNode } from 'react';

// ─── Interaction Schema ───────────────────────────────────────────────

/**
 * The Glass Interaction Schema. Every element on a Glass panel is tagged
 * with exactly one role. The role dictates token + primitive choice.
 */
export type GlassSchemaRole =
  | 'cta-primary'       // "Do the main thing" — at most 1 per panel surface
  | 'cta-secondary'     // "Do a supporting thing"
  | 'nav-link'          // "Go somewhere else" (NOT accent-colored)
  | 'primary-content'   // The main thing the user is reading
  | 'support-evidence'  // Explains / backs up primary-content
  | 'metadata'          // Context, timestamps, tracking (muted but visible)
  | 'state-signal';     // Badges / pills showing current state

/**
 * SectionContext — reactive inputs that `expandedWhen` evaluates against.
 * Phase 2 composes this from already-visible state at the call site; no new store.
 */
export interface SectionContext {
  score: number;
  totalViolations: number;
  pendingApprovals: number;
  hasRuntimeViolations: boolean;
  /** Free-form extension for call-site-specific actionable-state inputs. */
  [key: string]: unknown;
}

/** Predicate required on every Section instance. Literal true/false is a type error. */
export type ExpandedWhen = (ctx: SectionContext) => boolean;

// ─── Typography Tokens ────────────────────────────────────────────────

/** The 5 font-size tokens declared in src/index.css's @theme block. */
export type GlassTypeToken =
  | '--text-title'    // 13px / 1.4 / 600
  | '--text-body'     // 12px / 1.5 / 400
  | '--text-label'    // 11px / 1.4 / 500
  | '--text-micro'    // 10px / 1.3 / 500
  | '--text-display'; // 20px / 1.2 / 600 — reserved for single headline metric

/** The 4 text-color hierarchy tokens. */
export type GlassTextColorToken =
  | '--text-primary'   // near-white, Primary-content default
  | '--text-secondary' // mid-gray, Support-evidence + Nav-link default
  | '--text-tertiary'  // dim gray, Metadata under density pressure ONLY
  | '--text-accent';   // indigo, CTA-* roles ONLY

// ─── Primitive Component Prop Contracts ───────────────────────────────

export interface SectionProps {
  title: string;
  /** Fixed to 'primary-content' — encoded as a literal so the role is unambiguous. */
  schemaRole: 'primary-content';
  /**
   * REQUIRED predicate. Section expands IFF the user has an actionable lever
   * inside. Passive info must not live in a Section — use MetadataTooltip instead.
   * Literal values are disallowed at the type level (must be a function).
   */
  expandedWhen: ExpandedWhen;
  /** Optional right-aligned header slot (e.g., a CTA button). */
  action?: ReactNode;
  id?: string;
  children: ReactNode;
}

export interface PropertyRowProps {
  label: string;
  value: ReactNode;
  /** Defaults to 'support-evidence'. 'metadata' triggers --text-tertiary compression. */
  schemaRole?: 'support-evidence' | 'metadata';
  hint?: string;
  actions?: ReactNode;
  mono?: boolean;
}

export type FooterActionBarAlign = 'start' | 'end' | 'between';

export interface FooterActionBarProps {
  /** Role fixed to nav-link container. Children are Nav-link items, not CTAs. */
  align?: FooterActionBarAlign;
  children: ReactNode;
}

export type MetadataTooltipSide = 'top' | 'right' | 'bottom' | 'left';

export interface MetadataTooltipProps {
  /** Role fixed to 'metadata'. Delivers passive explanatory info behind an (i) icon. */
  children: ReactNode;
  side?: MetadataTooltipSide;
}

export type StatBadgeVariant = 'success' | 'warning' | 'critical' | 'neutral';

export interface StatBadgeProps {
  /** Role fixed to 'state-signal'. */
  variant: StatBadgeVariant;
  compact?: boolean;
  children: ReactNode;
}

/**
 * PanelTabLabel — the ONLY primitive permitted to render all-caps text in Glass.
 * Used for right-sidebar tab labels ("GOVERNANCE", "PROPERTIES", "TOKENS") and
 * hypothetical cross-panel dividers ("ISSUES", "HEALTH"). Nested section headers
 * stay title-case 13/600.
 */
export interface PanelTabLabelProps {
  children: ReactNode;
  active?: boolean;
}

// ─── CTA Button contracts (schema-governed — not new primitives, but typed) ──

export interface CTAPrimaryProps {
  schemaRole: 'cta-primary';
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}

export interface CTASecondaryProps {
  schemaRole: 'cta-secondary';
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}

// ─── Canary Collapsed-Default Policy (rev 2: predicate-based) ────────

/**
 * Canary-panel collapse contract. Phase 2 composes SectionContext at the panel
 * level and each Section's `expandedWhen` evaluates independently.
 */
export interface CanaryCollapseSpec {
  /** Score breakdown is ALWAYS collapsed — passive metric, no user action inside. */
  scoreBreakdownExpandedWhen: ExpandedWhen; // () => false
  /** Issues expand when count > 0. */
  violationsExpandedWhen: ExpandedWhen; // (ctx) => ctx.totalViolations > 0
  /** Pending approvals expand when there's something to approve. */
  pendingApprovalsExpandedWhen: ExpandedWhen; // (ctx) => ctx.pendingApprovals > 0
  /** Runtime audit section expands when runtime violations exist. */
  runtimeAuditExpandedWhen: ExpandedWhen; // (ctx) => ctx.hasRuntimeViolations
}

// ─── Contract ─────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'GLASSTYPO.1-GlassInteractionSchema-Governance-Properties-Canary',
    phase: 'GLASSTYPO.1',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-19',
    audience: 'designer',
  },
  impact: [
    {
      file: 'src/index.css',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Add @theme block: 5 --text-* size tokens + 4 text-color tokens + LH/weight companions. Keep existing --spacing.* variables defined (non-breaking for out-of-canary call sites).',
    },
    {
      file: 'src/components/ui/primitives/Section.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: 'Collapsible section primitive. REQUIRES expandedWhen predicate; schemaRole fixed to primary-content. Rev 3: open-state body tint (color-mix 3% of --text-primary), 1px left accent border (color-mix 40% of --text-accent), 10px padding-left, 8/12px vertical padding, 16px between-section margin when stacked.',
    },
    {
      file: 'src/components/ui/primitives/PropertyRow.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: '2-col label/value row with hover-reveal actions. schemaRole defaults to support-evidence.',
    },
    {
      file: 'src/components/ui/primitives/FooterActionBar.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: 'Nav-link container. Chevron suffix, --text-secondary. Not for CTAs.',
    },
    {
      file: 'src/components/ui/primitives/MetadataTooltip.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: 'Hover (i) tooltip — delivery surface for Metadata role.',
    },
    {
      file: 'src/components/ui/primitives/StatBadge.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: 'Small semantic pill with 4 variants. Role fixed to state-signal.',
    },
    {
      file: 'src/components/ui/primitives/PanelTabLabel.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: 'Uppercase 11px/500 with letter-spacing 0.06em. The sole all-caps primitive.',
    },
    {
      file: 'src/components/ui/primitives/__tests__/Section.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Open/close, expandedWhen evaluation, action slot, aria-expanded.',
    },
    {
      file: 'src/components/ui/primitives/__tests__/PropertyRow.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Label/value sizes, hover action reveal, mono variant, schemaRole switch.',
    },
    {
      file: 'src/components/ui/primitives/__tests__/FooterActionBar.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Align variants, layout.',
    },
    {
      file: 'src/components/ui/primitives/__tests__/MetadataTooltip.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Hover reveal, role=tooltip, side positioning.',
    },
    {
      file: 'src/components/ui/primitives/__tests__/StatBadge.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Variant color distinction, font-size token, compact variant.',
    },
    {
      file: 'src/components/ui/primitives/__tests__/PanelTabLabel.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Uppercase text-transform applied via primitive; computed fontSize === 11px; letter-spacing === 0.06em.',
    },
    {
      file: 'src/components/ui/GovernanceDashboard.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Compose canary from primitives. Tag every component with schemaRole (prop or JSDoc). Remove all text-[var(--spacing.* and ad-hoc text-zinc-{400..700}. At most one cta-primary.',
    },
    {
      file: 'src/components/ui/governance/*.tsx (19 files)',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Convert to schema + primitives. Passive accordions demote to MetadataTooltip. Actionable accordions become Sections with expandedWhen. FooterActionBar gets Manage rules / Policy settings.',
    },
    {
      file: 'src/components/ui/governance/__tests__/canary-visual.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Visual regression: rendered font-sizes match tokens; no overflow at 320px; every canary component has a schemaRole; cta-primary count <= 1; --text-accent confined to CTA subtrees; expandedWhen evaluates correctly under given SectionContext.',
    },
    {
      file: 'src/components/ui/PropertiesPanel.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Rev 3 canary: remove 10 text-[var(--spacing.*)] sites, 7 ad-hoc text-zinc-{400..700} sites, 1 inline uppercase. Replace Accordion usage with Section(expandedWhen). Tag every component with schemaRole. Zero cta-primary (inspector has no headline action).',
    },
    {
      file: 'src/components/inspector/ClassBuilder.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Rev 3 canary: remove 4 spacing-token font-sizes, 1 ad-hoc zinc. MithrilViolationCard Auto-Fix tagged cta-secondary.',
    },
    {
      file: 'src/components/inspector/DriftDetector.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Rev 3 canary: remove 10 spacing-token font-sizes, 5 ad-hoc zinc, 1 inline uppercase. Legend ("ΔE<2 auto-fixable") is metadata role.',
    },
    {
      file: 'src/components/inspector/LayoutPanel.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Rev 3 canary: remove 2 spacing-token font-sizes, 3 ad-hoc zinc, 1 inline uppercase. Section titles use PanelTabLabel.',
    },
    {
      file: 'src/components/inspector/primitives.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Rev 3 canary: remove 8 spacing-token font-sizes, 3 ad-hoc zinc, 1 inline uppercase. Delete Accordion export if no non-canary call sites remain. Update CompactSelect/ColorPickerSwatch/TokenAutocomplete to use --text-* tokens.',
    },
    {
      file: 'src/components/ui/__tests__/properties-canary.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Properties canary visual regression: font-sizes match tokens, no overflow at 320px, schemaRole on every component, cta-primary count === 0, --text-accent confined to CTA subtrees, Accordion import count === 0 in canary scope, Section open-state visual invariants fire (distinct bg, >=1px left border, >=10px padding-left, between-section gap >= 2x inside-section padding-top).',
    },
  ],
  ipc: [],
  stores: [],
  components: [
    {
      name: 'Section',
      file: 'src/components/ui/primitives/Section.tsx',
      propsType: 'SectionProps',
      consumesStores: [],
      emitsIPC: [],
    },
    {
      name: 'PropertyRow',
      file: 'src/components/ui/primitives/PropertyRow.tsx',
      propsType: 'PropertyRowProps',
      consumesStores: [],
      emitsIPC: [],
    },
    {
      name: 'FooterActionBar',
      file: 'src/components/ui/primitives/FooterActionBar.tsx',
      propsType: 'FooterActionBarProps',
      consumesStores: [],
      emitsIPC: [],
    },
    {
      name: 'MetadataTooltip',
      file: 'src/components/ui/primitives/MetadataTooltip.tsx',
      propsType: 'MetadataTooltipProps',
      consumesStores: [],
      emitsIPC: [],
    },
    {
      name: 'StatBadge',
      file: 'src/components/ui/primitives/StatBadge.tsx',
      propsType: 'StatBadgeProps',
      consumesStores: [],
      emitsIPC: [],
    },
    {
      name: 'PanelTabLabel',
      file: 'src/components/ui/primitives/PanelTabLabel.tsx',
      propsType: 'PanelTabLabelProps',
      consumesStores: [],
      emitsIPC: [],
    },
  ],
  commandments: [2, 13, 14],
  testBoundaries: [
    {
      target: 'Section primitive — expandedWhen evaluates on mount',
      kind: 'component',
      behavior: 'Section defers to the expandedWhen predicate at mount time',
      assertion: 'aria-expanded matches predicate return value',
      edgeCases: ['predicate returns false → aria-expanded="false"', 'predicate returns true → child DOM present'],
      given: '<Section title="Issues" schemaRole="primary-content" expandedWhen={(ctx) => ctx.totalViolations > 0}>child</Section> mounted with SectionContext where totalViolations=3',
      when: 'the component mounts in jsdom',
      then: 'sets aria-expanded="true" on the title control and renders the child text in the DOM',
    },
    {
      target: 'Section primitive — predicate returning false keeps section collapsed',
      kind: 'component',
      behavior: 'Passive Section (predicate always false) remains collapsed',
      assertion: 'aria-expanded="false" and child not in DOM',
      edgeCases: ['user can still click to force open'],
      given: '<Section title="Score Breakdown" schemaRole="primary-content" expandedWhen={() => false}>metrics</Section> mounted',
      when: 'the component mounts',
      then: 'sets aria-expanded="false" and renders only the title control (metrics child is not in the DOM)',
    },
    {
      target: 'Section primitive — action slot',
      kind: 'component',
      behavior: 'Action node renders in header right-side slot',
      assertion: 'action children present in header subtree',
      edgeCases: ['action omitted → no empty slot', 'action click does not toggle section'],
      given: '<Section title="X" schemaRole="primary-content" expandedWhen={() => true} action={<button>Run Audit</button>}>c</Section>',
      when: 'the component mounts',
      then: 'renders the <button>Run Audit</button> element inside the section header',
    },
    {
      target: 'PropertyRow primitive — support-evidence tokens',
      kind: 'component',
      behavior: 'Default role renders label at --text-label / --text-primary and value at --text-body / --text-secondary',
      assertion: 'getComputedStyle fontSize matches token values',
      edgeCases: ['mono=true swaps value to font-mono family', 'long value truncates'],
      given: '<PropertyRow label="Score" value="98" /> rendered with post-migration src/index.css',
      when: 'getComputedStyle is queried on the label and value spans',
      then: 'returns fontSize === "11px" for the label and fontSize === "12px" for the value',
    },
    {
      target: 'PropertyRow primitive — metadata role demotes to --text-tertiary',
      kind: 'component',
      behavior: 'schemaRole="metadata" renders value in --text-tertiary (compression)',
      assertion: 'computed color matches --text-tertiary',
      edgeCases: ['default role keeps secondary, not tertiary'],
      given: '<PropertyRow schemaRole="metadata" label="Tracking since" value="2 days ago" />',
      when: 'getComputedStyle is queried on the value span',
      then: 'returns a color value matching --text-tertiary (dimmer than --text-secondary)',
    },
    {
      target: 'PropertyRow primitive — hover actions reveal',
      kind: 'component',
      behavior: 'Secondary actions fade in on row hover',
      assertion: 'computed opacity transitions from 0 to 1',
      edgeCases: ['actions remain visible on focus-within'],
      given: '<PropertyRow label="X" value="Y" actions={<button>A</button>} />',
      when: 'the user hovers the row',
      then: 'renders the <button>A</button> element with computed opacity transitioning from 0 to 1',
    },
    {
      target: 'FooterActionBar primitive — layout',
      kind: 'component',
      behavior: 'Renders children in a horizontal row with configurable align',
      assertion: 'justify-content matches align prop',
      edgeCases: ['align="between" pins first and last to edges'],
      given: '<FooterActionBar align="between"><a>Manage rules</a><a>Policy settings</a></FooterActionBar>',
      when: 'the component mounts',
      then: 'renders both anchor children in a flex row with computed justify-content: space-between',
    },
    {
      target: 'MetadataTooltip primitive — hover reveal',
      kind: 'component',
      behavior: 'Hovering the trigger surfaces tooltip content with role=tooltip',
      assertion: 'content enters DOM with ARIA role tooltip',
      edgeCases: ['content hides on mouseleave', 'side prop positions content'],
      given: '<MetadataTooltip><Trigger/><Content>hello</Content></MetadataTooltip> mounted',
      when: 'the user hovers the trigger',
      then: 'renders the content with role="tooltip" containing the text "hello"',
    },
    {
      target: 'StatBadge primitive — size and variant',
      kind: 'component',
      behavior: 'Renders at --text-label with distinct background per variant',
      assertion: 'fontSize 11px; backgroundColor differs across variants',
      edgeCases: ['compact=true tighter padding', 'all 4 variants pass contrast'],
      given: '<StatBadge variant="critical">3</StatBadge> alongside <StatBadge variant="success">0</StatBadge>',
      when: 'getComputedStyle is queried on both badges',
      then: 'returns fontSize === "11px" on both and distinct backgroundColor values between critical and success',
    },
    {
      target: 'PanelTabLabel primitive — uppercase treatment',
      kind: 'component',
      behavior: 'Renders all-caps at 11px/500 with letter-spacing 0.06em via primitive (no inline utility)',
      assertion: 'text-transform uppercase; fontSize 11px; letterSpacing 0.06em',
      edgeCases: ['active=true adds underline or indicator', 'children case-preserved in DOM (CSS does the uppercase)'],
      given: '<PanelTabLabel>Governance</PanelTabLabel> mounted',
      when: 'getComputedStyle is queried on the element',
      then: 'returns textTransform === "uppercase", fontSize === "11px", letterSpacing matching "0.06em"',
    },
    {
      target: 'src/index.css — --text-title resolution',
      kind: 'component',
      behavior: 'text-title utility resolves to 13px / weight 600',
      assertion: 'fontSize 13px; fontWeight 600',
      edgeCases: ['utility compiles under Tailwind v4 without name collision'],
      given: '<p class="text-title">X</p> mounted with post-migration src/index.css',
      when: 'getComputedStyle is queried on the paragraph',
      then: 'returns fontSize === "13px" and fontWeight === "600"',
    },
    {
      target: 'src/index.css — --text-display resolution',
      kind: 'component',
      behavior: 'text-display utility resolves to 20px',
      assertion: 'fontSize 20px',
      edgeCases: ['display is the only size token above 13px'],
      given: '<p class="text-display">98</p> mounted',
      when: 'getComputedStyle is queried',
      then: 'returns fontSize === "20px"',
    },
    {
      target: 'src/index.css — color hierarchy resolution',
      kind: 'component',
      behavior: 'Primary/secondary/tertiary/accent resolve to four distinct color values',
      assertion: 'all four computed colors differ',
      edgeCases: ['primary > secondary > tertiary in lightness; accent chromatic'],
      given: 'Four paragraphs each carrying text-primary, text-secondary, text-tertiary, text-accent',
      when: 'getComputedStyle is queried on each',
      then: 'returns four distinct color values with primary lighter than secondary than tertiary',
    },
    {
      target: 'src/index.css — legacy --spacing vars preserved',
      kind: 'service',
      behavior: 'Existing --spacing.* variables remain defined so out-of-canary call sites keep rendering',
      assertion: '> 0 declarations of --spacing',
      edgeCases: ['non-breaking migration invariant'],
      given: 'post-migration src/index.css',
      when: 'grep -cE "^\\s*--spacing" src/index.css executes',
      then: 'returns a count greater than 0 (legacy variables still present)',
    },
    {
      target: 'Canary scope — no spacing-token font-sizes',
      kind: 'service',
      behavior: 'text-[var(--spacing.*)] eliminated from canary',
      assertion: 'grep exit code 1',
      edgeCases: ['includes GovernanceDashboard.tsx and every governance/* child'],
      given: 'canary surface post-refactor',
      when: 'grep -rnE "text-\\[var\\(--spacing\\." src/components/ui/governance src/components/ui/GovernanceDashboard.tsx executes',
      then: 'returns exit code 1 (zero matches)',
    },
    {
      target: 'Canary scope — no ad-hoc zinc text colors',
      kind: 'service',
      behavior: 'text-zinc-{400..700} removed from canary markup',
      assertion: 'grep exit code 1',
      edgeCases: ['excludes comments and test fixtures'],
      given: 'canary surface post-refactor',
      when: 'grep -rnE "text-zinc-(400|500|600|700)\\b" over canary scope executes',
      then: 'returns exit code 1 (zero matches)',
    },
    {
      target: 'Canary scope — no inline uppercase utility',
      kind: 'service',
      behavior: 'All-caps treatments route exclusively through PanelTabLabel',
      assertion: 'grep exit code 1 for inline uppercase outside PanelTabLabel.tsx',
      edgeCases: ['PanelTabLabel internal uppercase allowed'],
      given: 'canary surface post-refactor',
      when: 'grep -rnE "className=[^>]*\\buppercase\\b" src/components/ui/governance src/components/ui/GovernanceDashboard.tsx executes',
      then: 'returns exit code 1 (zero inline uppercase utilities in canary)',
    },
    {
      target: 'Canary — every component carries a schemaRole',
      kind: 'service',
      behavior: 'Every component in canary is tagged with an explicit schemaRole (prop or @schemaRole JSDoc)',
      assertion: 'grep count of components == grep count of schemaRole tags',
      edgeCases: ['JSDoc form accepted for primitives with fixed roles'],
      given: 'canary surface post-refactor',
      when: 'the test counts exported component declarations vs. schemaRole markers in the canary tree',
      then: 'returns equal counts (every component has a role)',
    },
    {
      target: 'Canary — cta-primary cap',
      kind: 'component',
      behavior: 'A rendered panel surface contains at most one cta-primary instance',
      assertion: 'count of schemaRole="cta-primary" in rendered tree <= 1',
      edgeCases: ['empty state may have zero cta-primary'],
      given: 'GovernanceDashboard rendered with SectionContext {score: 92, totalViolations: 5, pendingApprovals: 2, hasRuntimeViolations: true}',
      when: 'the test queries all nodes with data-schema-role="cta-primary"',
      then: 'returns at most 1 matching node',
    },
    {
      target: 'Canary — --text-accent confined to CTA roles',
      kind: 'component',
      behavior: 'No accent-colored text appears outside cta-primary or cta-secondary subtrees',
      assertion: 'every node whose computed color == --text-accent has a CTA-* ancestor',
      edgeCases: ['Nav-links explicitly stay secondary, not accent'],
      given: 'GovernanceDashboard rendered',
      when: 'the test walks every element whose computed color matches --text-accent and inspects ancestry for schemaRole',
      then: 'returns that every such node has a cta-primary or cta-secondary ancestor (zero violations)',
    },
    {
      target: 'Canary — HealthScore breakdown stays collapsed (passive)',
      kind: 'component',
      behavior: 'Score breakdown is passive info; expandedWhen returns false',
      assertion: 'aria-expanded === "false" regardless of score value',
      edgeCases: ['score=100 and score=50 both collapse the breakdown'],
      given: 'GovernanceDashboard rendered with score=50 (not 100)',
      when: 'the Score-breakdown Section title control is queried',
      then: 'returns aria-expanded === "false" (breakdown is Metadata, not actionable)',
    },
    {
      target: 'Canary — ViolationsList expands when count > 0',
      kind: 'component',
      behavior: 'Violations Section expandedWhen returns totalViolations > 0',
      assertion: 'aria-expanded === "true" when violations present, "false" when zero',
      edgeCases: ['totalViolations=0 collapses, count=1 expands'],
      given: 'GovernanceDashboard rendered with totalViolations=3',
      when: 'the Violations Section title control is queried',
      then: 'returns aria-expanded === "true"',
    },
    {
      target: 'Canary panel — 320px min-width no overflow',
      kind: 'component',
      behavior: 'Panel renders without horizontal scroll at 320px viewport',
      assertion: 'scrollWidth <= clientWidth',
      edgeCases: ['long violation messages wrap, not overflow'],
      given: 'GovernanceDashboard rendered inside a 320px container in jsdom',
      when: 'the root element is measured',
      then: 'returns root.scrollWidth <= root.clientWidth (zero horizontal overflow)',
    },
    {
      target: 'Section primitive — open-state background is distinct from panel',
      kind: 'component',
      behavior: 'Expanded Section body renders a backgroundColor that differs from its enclosing panel',
      assertion: 'getComputedStyle(body).backgroundColor !== getComputedStyle(panel).backgroundColor',
      edgeCases: ['collapsed Section body is hidden, so treatment only applies when expanded'],
      given: 'a panel <div style="background: #000"><Section expandedWhen={() => true}>body</Section></div>',
      when: 'getComputedStyle is queried on the panel and on the Section body region',
      then: 'returns two distinct backgroundColor values (body tinted vs. panel base)',
    },
    {
      target: 'Section primitive — open-state left border',
      kind: 'component',
      behavior: 'Expanded Section body renders a non-zero left border',
      assertion: 'parseFloat(borderLeftWidth) >= 1',
      edgeCases: ['collapsed Section body has no measurable border (hidden)'],
      given: '<Section expandedWhen={() => true}>body</Section> mounted',
      when: 'getComputedStyle(body).borderLeftWidth is queried',
      then: 'returns a width parseFloat(value) >= 1 (pixels)',
    },
    {
      target: 'Section primitive — open-state left indent',
      kind: 'component',
      behavior: 'Expanded Section body renders a positive left padding for parent-child inset',
      assertion: 'parseFloat(paddingLeft) >= 10',
      edgeCases: ['indent applies only when expanded'],
      given: '<Section expandedWhen={() => true}>body</Section> mounted',
      when: 'getComputedStyle(body).paddingLeft is queried',
      then: 'returns parseFloat(value) >= 10 (pixels)',
    },
    {
      target: 'Section primitive — between-section spacing exceeds inside-section padding',
      kind: 'component',
      behavior: 'When two Sections are stacked, the gap between them is strictly greater than the content padding inside one Section',
      assertion: 'betweenGap >= 2 * insidePaddingTop',
      edgeCases: ['airy-between / dense-inside rhythm enforced structurally'],
      given: 'two stacked <Section expandedWhen={() => true}> siblings mounted',
      when: 'the test measures the margin between the two Sections and the padding-top inside the first',
      then: 'returns betweenGap >= 2 * insidePaddingTop (e.g. 16px gap vs 8px inner top padding)',
    },
    {
      target: 'Properties canary — no spacing-token font-sizes',
      kind: 'service',
      behavior: 'text-[var(--spacing.*)] eliminated from Properties panel scope',
      assertion: 'grep exit code 1',
      edgeCases: ['includes PropertiesPanel.tsx + all inspector/*.tsx'],
      given: 'Properties canary surface post-refactor',
      when: 'grep -rnE "text-\\[var\\(--spacing\\." src/components/ui/PropertiesPanel.tsx src/components/inspector executes',
      then: 'returns exit code 1 (zero matches)',
    },
    {
      target: 'Properties canary — no ad-hoc zinc text colors',
      kind: 'service',
      behavior: 'text-zinc-{400..700} removed from Properties canary markup',
      assertion: 'grep exit code 1',
      edgeCases: ['excludes comments'],
      given: 'Properties canary surface post-refactor',
      when: 'grep -rnE "text-zinc-(400|500|600|700)\\b" src/components/ui/PropertiesPanel.tsx src/components/inspector executes',
      then: 'returns exit code 1 (zero matches)',
    },
    {
      target: 'Properties canary — no inline uppercase utility',
      kind: 'service',
      behavior: 'All-caps routes exclusively through PanelTabLabel inside the Properties panel scope',
      assertion: 'grep exit code 1',
      edgeCases: ['Accordion inline uppercase eliminated as part of migration'],
      given: 'Properties canary surface post-refactor',
      when: 'grep -rnE "className=[^>]*\\buppercase\\b" src/components/ui/PropertiesPanel.tsx src/components/inspector executes',
      then: 'returns exit code 1 (zero inline uppercase utilities in Properties canary)',
    },
    {
      target: 'Properties canary — zero cta-primary (inspector)',
      kind: 'component',
      behavior: 'The Properties panel has no cta-primary — it is an inspector; every action is secondary or state-signal',
      assertion: 'count of schemaRole="cta-primary" in rendered PropertiesPanel === 0',
      edgeCases: ['MithrilViolationCard Auto-Fix is cta-secondary'],
      given: 'PropertiesPanel rendered with a selected layer that triggers MithrilViolationCard',
      when: 'the test queries all nodes with data-schema-role="cta-primary"',
      then: 'returns exactly 0 matching nodes',
    },
    {
      target: 'Properties canary — --text-accent confined to CTA roles',
      kind: 'component',
      behavior: 'No accent-colored text outside cta-primary or cta-secondary subtrees in PropertiesPanel',
      assertion: 'every accent-colored node has a CTA-* ancestor',
      edgeCases: ['Section open-state left-border uses accent color-mix but is a border, not text'],
      given: 'PropertiesPanel rendered with a drift violation',
      when: 'the test walks every element whose computed color matches --text-accent and inspects ancestry',
      then: 'returns that every such node has a cta-primary or cta-secondary ancestor (zero violations)',
    },
    {
      target: 'Properties canary — Accordion import eliminated from canary scope',
      kind: 'service',
      behavior: 'No call site within the Properties canary imports Accordion from inspector/primitives',
      assertion: 'grep exit code 1',
      edgeCases: ['non-canary call sites, if any exist, keep the import until their panel migrates'],
      given: 'Properties canary surface post-refactor',
      when: 'grep -rnE "import\\s*\\{[^}]*\\bAccordion\\b[^}]*\\}\\s*from\\s*[\\"\\\']\\.\\.?/inspector/primitives" src/components/ui/PropertiesPanel.tsx src/components/inspector executes',
      then: 'returns exit code 1 (zero Accordion imports in Properties canary)',
    },
    {
      target: 'Properties canary panel — 320px min-width no overflow',
      kind: 'component',
      behavior: 'PropertiesPanel renders without horizontal scroll at 320px viewport',
      assertion: 'scrollWidth <= clientWidth',
      edgeCases: ['long token names truncate, not overflow'],
      given: 'PropertiesPanel rendered inside a 320px container in jsdom',
      when: 'the root element is measured',
      then: 'returns root.scrollWidth <= root.clientWidth (zero horizontal overflow)',
    },
  ],
  invariants: [
    {
      name: 'type-scale-token-count',
      measurable: 'count of --text-{title,body,label,micro,display} declarations in src/index.css @theme block',
      threshold: '= 5',
      measuredBy: 'grep -cE "^\\s*--text-(title|body|label|micro|display)\\s*:" src/index.css',
    },
    {
      name: 'color-hierarchy-token-count',
      measurable: 'count of --text-{primary,secondary,tertiary,accent} declarations in src/index.css @theme block',
      threshold: '= 4',
      measuredBy: 'grep -cE "^\\s*--text-(primary|secondary|tertiary|accent)\\s*:" src/index.css',
    },
    {
      name: 'primitive-count',
      measurable: 'primitive components under src/components/ui/primitives/ each with a passing test',
      threshold: '>= 6',
      measuredBy: 'file count in primitives/ matched against passing suites in primitives/__tests__/',
    },
    {
      name: 'canary-legacy-spacing-vars-preserved',
      measurable: 'count of --spacing.* declarations remaining in src/index.css (non-breaking migration)',
      threshold: '> 0',
      measuredBy: 'grep -cE "^\\s*--spacing" src/index.css',
    },
    {
      name: 'canary-zero-spacing-font-size',
      measurable: 'count of text-[var(--spacing. matches in canary scope',
      threshold: '= 0',
      measuredBy: 'grep -rnE "text-\\[var\\(--spacing\\." src/components/ui/governance src/components/ui/GovernanceDashboard.tsx | wc -l',
    },
    {
      name: 'canary-zero-adhoc-zinc-text',
      measurable: 'count of text-zinc-{400,500,600,700} matches in canary scope',
      threshold: '= 0',
      measuredBy: 'grep -rnE "text-zinc-(400|500|600|700)\\b" src/components/ui/governance src/components/ui/GovernanceDashboard.tsx | wc -l',
    },
    {
      name: 'canary-zero-inline-uppercase',
      measurable: 'count of className containing uppercase utility within canary files (outside PanelTabLabel.tsx)',
      threshold: '= 0',
      measuredBy: 'grep -rnE "className=[^>]*\\buppercase\\b" src/components/ui/governance src/components/ui/GovernanceDashboard.tsx | wc -l',
    },
    {
      name: 'canary-all-caps-only-via-primitive',
      measurable: 'count of text-transform: uppercase usages outside PanelTabLabel.tsx in canary scope',
      threshold: '= 0',
      // Excludes test files (__tests__ dirs and *.test.tsx) and JSDoc comment lines (lines
      // beginning with optional whitespace + *). The grep-v chain drops both categories.
      measuredBy: 'grep -rnE "text-transform:\\s*uppercase" --exclude="*.test.tsx" --exclude-dir=__tests__ src/components/ui/governance src/components/ui/GovernanceDashboard.tsx src/components/ui/primitives | grep -v PanelTabLabel | grep -vE "^[^:]+:[0-9]+:\\s*\\*" | wc -l',
    },
    {
      name: 'canary-schema-role-coverage',
      measurable: 'count of canary components missing a schemaRole prop or @schemaRole JSDoc tag',
      threshold: '= 0',
      measuredBy: 'vitest canary-visual test comparing exported component declarations to schemaRole markers in rendered tree',
    },
    {
      name: 'canary-cta-primary-cap',
      measurable: 'count of schemaRole="cta-primary" instances in the rendered canary panel',
      threshold: '<= 1',
      measuredBy: 'vitest canary-visual test counting data-schema-role="cta-primary" nodes',
    },
    {
      name: 'canary-accent-confined-to-cta',
      measurable: 'count of --text-accent-colored nodes lacking a cta-primary or cta-secondary ancestor',
      threshold: '= 0',
      measuredBy: 'vitest canary-visual test walking accent-colored nodes and asserting ancestor role',
    },
    {
      name: 'canary-min-width-no-overflow',
      measurable: 'horizontal overflow (scrollWidth - clientWidth) on canary root at width 320px',
      threshold: '<= 0',
      measuredBy: 'vitest canary-visual regression test',
    },
    {
      name: 'primitive-test-pass-rate',
      measurable: 'passing tests among src/components/ui/primitives/__tests__/*',
      threshold: '>= 100% (0 failures)',
      measuredBy: 'npm run test:react filtered to primitives path',
    },
    {
      name: 'section-open-state-background-distinct',
      measurable: 'computed backgroundColor of expanded Section body vs. enclosing panel',
      threshold: '!= (strictly different RGB)',
      measuredBy: 'vitest jsdom test compares getComputedStyle backgroundColor on Section body and its parent panel',
    },
    {
      name: 'section-open-state-left-border',
      measurable: 'computed borderLeftWidth (px) on expanded Section body',
      threshold: '>= 1',
      measuredBy: 'vitest jsdom test parses getComputedStyle(body).borderLeftWidth',
    },
    {
      name: 'section-open-state-indented',
      measurable: 'computed paddingLeft (px) on expanded Section body',
      threshold: '>= 10',
      measuredBy: 'vitest jsdom test parses getComputedStyle(body).paddingLeft',
    },
    {
      name: 'between-section-spacing-greater-than-inside-section',
      measurable: 'gap between two stacked Sections vs. content padding-top inside one Section',
      threshold: 'outerGap >= 2 * innerPaddingTop',
      measuredBy: 'vitest jsdom renders two stacked Sections, compares offsetTop delta minus header height against inside padding-top',
    },
    {
      name: 'properties-zero-spacing-font-size',
      measurable: 'count of text-[var(--spacing. matches in Properties canary scope',
      threshold: '= 0',
      // Excludes test files and JSDoc comment lines to prevent false positives from
      // file-header comments that announce the removed pattern.
      measuredBy: 'grep -rnE "text-\\[var\\(--spacing\\." --exclude="*.test.tsx" --exclude-dir=__tests__ src/components/ui/PropertiesPanel.tsx src/components/inspector | grep -vE "^[^:]+:[0-9]+:\\s*[/*]" | wc -l',
    },
    {
      name: 'properties-zero-adhoc-zinc-text',
      measurable: 'count of text-zinc-{400,500,600,700} matches in Properties canary scope',
      threshold: '= 0',
      measuredBy: 'grep -rnE "text-zinc-(400|500|600|700)\\b" src/components/ui/PropertiesPanel.tsx src/components/inspector | wc -l',
    },
    {
      name: 'properties-zero-inline-uppercase',
      measurable: 'count of className containing uppercase utility in Properties canary scope',
      threshold: '= 0',
      measuredBy: 'grep -rnE "className=[^>]*\\buppercase\\b" src/components/ui/PropertiesPanel.tsx src/components/inspector | wc -l',
    },
    {
      name: 'properties-schema-role-coverage',
      measurable: 'count of Properties-canary components lacking a schemaRole prop or @schemaRole JSDoc',
      threshold: '= 0',
      measuredBy: 'vitest properties-canary test comparing component declarations to schemaRole markers',
    },
    {
      name: 'properties-cta-primary-cap',
      measurable: 'count of schemaRole="cta-primary" instances in rendered PropertiesPanel',
      threshold: '= 0',
      measuredBy: 'vitest properties-canary test counts data-schema-role="cta-primary" nodes (inspector has no headline action)',
    },
    {
      name: 'properties-accent-confined-to-cta',
      measurable: 'count of --text-accent-colored text nodes in PropertiesPanel lacking a CTA-* ancestor',
      threshold: '= 0',
      measuredBy: 'vitest properties-canary ancestry walk',
    },
    {
      name: 'properties-accordion-eliminated',
      measurable: 'count of Accordion imports from inspector/primitives in Properties canary files',
      threshold: '= 0',
      measuredBy: 'grep for Accordion import statement across PropertiesPanel.tsx + inspector/*.tsx',
    },
    {
      name: 'properties-min-width-no-overflow',
      measurable: 'horizontal overflow (scrollWidth - clientWidth) on PropertiesPanel root at 320px',
      threshold: '<= 0',
      measuredBy: 'vitest properties-canary regression test',
    },
  ],
  risks: [
    {
      risk: 'Schema-role audit is brittle (prop + JSDoc + grep mix)',
      severity: 'medium',
      mitigation: 'AST-lite grep in CI matches either form; Phase 3 validator spot-checks. If brittle in practice, promote to a Babel visitor in GLASSTYPO.2.',
    },
    {
      risk: 'Territorial conflict with RUNTIME.1 — both touch GovernanceDashboard region',
      severity: 'high',
      mitigation: 'Sequence: GLASSTYPO.1 lands AFTER RUNTIME.1 merges. Convert RuntimeAuditAccordion to a Section with expandedWhen: (ctx) => ctx.hasRuntimeViolations without touching its IPC/flag-gate logic.',
    },
    {
      risk: 'Tailwind v4 cannot resolve text-title utility due to name collision with built-in text-* utilities',
      severity: 'medium',
      commandment: 2,
      mitigation: 'Test boundary pins getComputedStyle on text-title. Fallback: rename prefix --text-* to --type-* (mechanical rename across 5 token names).',
    },
    {
      risk: '320px min-width forces illegible crush (badges truncate, labels collide)',
      severity: 'medium',
      mitigation: 'Overflow test + Justin visual sign-off at 320/360/400 widths during Phase 3.',
    },
    {
      risk: 'Demoting passive accordions to MetadataTooltip hides information users currently see — may feel like regression',
      severity: 'medium',
      mitigation: 'Canary panel mockup review with Justin BEFORE Group C implementation. Demotion is a remapping, not a data prune — reversible.',
    },
    {
      risk: 'expandedWhen predicate prop-drills context into Sections',
      severity: 'low',
      mitigation: 'SectionContext composed at call site from already-visible state (score, violationCount, pendingCount). No new store needed.',
    },
    {
      risk: 'Post-landing someone reintroduces banned patterns',
      severity: 'low',
      commandment: 2,
      mitigation: 'Invariants (spacing, zinc, uppercase, accent-outside-CTA, cta-primary cap) enforced as scoped CI checks.',
    },
  ],
  parallelismGroups: {
    A: ['flint-design-engineer'],
    B: ['flint-design-engineer', 'flint-test-writer'],
    C: ['flint-design-engineer', 'flint-test-writer'],
    D: ['flint-design-engineer', 'flint-test-writer'],
    E: ['flint-code-reviewer', 'flint-integration-validator'],
  },
  nonGoals: [
    'No migration of panels outside the TWO canary scopes (Governance + Properties). Tokens, Assets, StatusBar, ExportModal, ComponentPanel, Command Palette, App chrome all defer to GLASSTYPO.2+',
    'Explicit: no migration of the remaining text-[var(--spacing.*)] sites outside the two canary scopes — legacy --spacing.* vars stay defined so those sites keep rendering',
    'No deletion of Accordion from inspector/primitives.tsx if any non-canary call site remains — Phase 2 grep confirms; if non-canary usage exists, the export stays until its owning panel migrates',
    'No font-weight scale beyond the weights wired to the 5 size tokens (600/400/500/500/600)',
    'No new font-family token — system stack continues as-is',
    'No letter-spacing / tracking tokens beyond PanelTabLabel 0.06em',
    'No new MCP tool, resource, or prompt — internal Glass chrome only',
    'No changes to electron/**, server/**, flint-mcp/**, or shared/**',
    'No Mithril Glass-self-audit rule in this phase — grep invariants suffice; formal rule = GLASSTYPO.2',
    'No changes to demo fixture design-tokens.json — Glass shell tokens stay private',
    'No StatusBar redesign — RUNTIME.1 is append-only; StatusBar keeps its current vocabulary',
    'No codemod / one-shot script — hand-authored structural refactor only',
    'No adoption of ALL-CAPS anywhere except PanelTabLabel (panel tab labels + cross-panel dividers only)',
    'No use of --text-accent outside cta-primary / cta-secondary roles',
    'No use of --text-tertiary outside the metadata role (compression-only)',
    'No use of --text-display outside the single headline metric per panel',
  ],
};
