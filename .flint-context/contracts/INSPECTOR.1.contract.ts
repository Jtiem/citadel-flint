/**
 * INSPECTOR.1 — Context-Aware Properties Panel
 *
 * Executable contract — Phase 2 agents import the types below and implement
 * exactly these signatures. Phase 1.5 validates this file compiles in
 * isolation (no src/ imports). Phase 3 checks invariants against reality.
 *
 * Status: DRAFT pending Justin's sign-off on 5 Open Design Questions
 * (see INSPECTOR.1-contract.md).
 */

import type { FlintContract } from '../../shared/contract-schema';
import type { ReactNode } from 'react';

// ─── Element-Type Registry ────────────────────────────────────────────────

/** The 7 inspector section kinds surfaced to end users. */
export type InspectorSection =
  | 'Typography'
  | 'Layout'
  | 'Appearance'
  | 'MediaProps'
  | 'FormProps'
  | 'A11y'
  | 'NodeProperties';

/**
 * Pure-function registry API. Given a JSX tagName (lowercase intrinsic OR
 * capitalized component), returns the relevant section list and the subset
 * to auto-expand on first render after selection.
 *
 * Unknown tags and capitalized components fall back to the generic inspector:
 *   relevant  = all 5 non-media/form sections (collapsed)
 *   autoExpand = [] (user picks)
 */
export interface ElementTypePropertyMap {
  getRelevantSections(tagName: string): InspectorSection[];
  getAutoExpandedSections(tagName: string): InspectorSection[];
}

// ─── Off-Token Match Wrapper ──────────────────────────────────────────────

/** Which token category to resolve the value against. */
export type TokenMatchCategory =
  | 'color'
  | 'fontSize'
  | 'fontFamily'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
  | 'spacing'
  | 'borderRadius';

export interface TokenMatchResult {
  /** True when deltaE (or categorical equality) places the value inside the token set. */
  inTokenSet: boolean;
  /** Closest token name, even when inTokenSet is false. null when the category has no tokens. */
  nearestTokenName: string | null;
  /** CIEDE2000 deltaE for color category; categorical distance (0 or Infinity) otherwise. */
  deltaE: number | null;
}

/**
 * Single shared resolver. MUST live in src/utils/tokenMatcher.ts and reuse
 * findClosestToken. Any parallel implementation in a new file is a contract
 * violation (invariant `token-match-reuses-mithril`).
 */
export type MatchValueToToken = (
  value: string,
  category: TokenMatchCategory,
) => TokenMatchResult;

// ─── Auto-Tab-Switch Hook ─────────────────────────────────────────────────

/**
 * useAutoTabSwitch — side-effect hook mounted once at the PropertiesPanel
 * parent (or App root). Watches canvasStore.activeSelection and fires
 * setRightTab('properties') on null→id transitions, UNLESS userOverrodeTab
 * is true.
 *
 * On selection clear (id→null), userOverrodeTab resets to false so the next
 * selection is allowed to auto-switch again.
 */
export interface UseAutoTabSwitchReturn {
  /** No public surface — purely reactive side effect. */
  readonly __effect: 'installed';
}

// ─── New canvasStore slice additions ──────────────────────────────────────

/** Net-new state + actions added to canvasStore. */
export interface CanvasStoreInspector1Additions {
  /**
   * True when the user has manually clicked a non-Properties tab while a
   * node was selected. Blocks further auto-switches until selection clears.
   */
  userOverrodeTab: boolean;
  /** Sets userOverrodeTab = true. Idempotent. */
  markTabOverridden: () => void;
}

// ─── Inspector Section Component Props ────────────────────────────────────

// Imported structurally to avoid cross-file type coupling.
export interface VisualLayerShape {
  id: string;
  tagName: string;
  className?: string;
  style?: string;
  textContent?: string;
  props?: Record<string, string | boolean>;
  line: number;
  col: number;
  children: VisualLayerShape[];
}

export interface TypographySectionProps {
  layer: VisualLayerShape;
  onCommit: (newClassName: string) => void;
  children?: ReactNode;
}

export interface FormPropsSectionProps {
  layer: VisualLayerShape;
  onCommitProp: (propName: string, value: string | undefined) => void;
}

export interface MediaPropsSectionProps {
  layer: VisualLayerShape;
  onCommitProp: (propName: string, value: string | undefined) => void;
}

export interface A11ySectionProps {
  layer: VisualLayerShape;
  onCommitProp: (propName: string, value: string | undefined) => void;
}

// ─── Off-Token Badge Contract ─────────────────────────────────────────────

/**
 * Visual contract for an input row whose current value is NOT in the active
 * token set. Phase 2 MUST render a StatBadge variant='warning' alongside
 * the raw value, never silently substitute a chip.
 */
export interface OffTokenRowVisual {
  renderedBadgeCount: 1;
  badgeSchemaRole: 'state-signal';
  badgeVariant: 'warning';
  rawValueVisible: true;
}

// ─── Contract ─────────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'INSPECTOR.1-ContextAwarePropertiesPanel',
    phase: 'INSPECTOR.1',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-19',
    audience: 'designer',
  },
  impact: [
    {
      file: 'src/core/elementTypePropertyMap.ts',
      changeType: 'CREATE',
      owner: 'flint-state-architect',
      summary: 'Pure-function registry. Exports getRelevantSections + getAutoExpandedSections. 24 tags + generic fallback. No store, no IPC.',
    },
    {
      file: 'src/core/__tests__/elementTypePropertyMap.test.ts',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Matrix test across all 24 tags + unknown-tag fallback.',
    },
    {
      file: 'src/utils/tokenMatcher.ts',
      changeType: 'MODIFY',
      owner: 'flint-state-architect',
      summary: 'Add matchValueToToken(value, category). Additive; wraps existing findClosestToken for colors and categorical lookup for other token families.',
    },
    {
      file: 'src/utils/astScanner.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: 'Extend to scanArbitraryTypography + scanArbitrarySpacing. Same Babel traversal pattern as scanArbitraryColors.',
    },
    {
      file: 'src/hooks/useAutoTabSwitch.ts',
      changeType: 'CREATE',
      owner: 'flint-state-architect',
      summary: 'useEffect on activeSelection. null→id triggers setRightTab("properties") unless userOverrodeTab. id→null resets userOverrodeTab.',
    },
    {
      file: 'src/hooks/__tests__/useAutoTabSwitch.test.ts',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'null→id switches; manual override blocks; deselect resets.',
    },
    {
      file: 'src/store/canvasStore.ts',
      changeType: 'MODIFY',
      owner: 'flint-state-architect',
      summary: 'Add userOverrodeTab: boolean (default false) + markTabOverridden() action. Reset to false in setActiveSelection(null) and closeWorkspace.',
    },
    {
      file: 'src/App.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Wire markTabOverridden() into the right-sidebar tab click handler so user-initiated tab switches flip userOverrodeTab=true. Without this wiring, the override flag stays permanently false and selection-driven tab switch cannot be suppressed.',
    },
    {
      file: 'src/components/ui/PropertiesPanel.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Replace single Element Properties Section with dynamic list sourced from getRelevantSections(tagName). Each Section uses expandedWhen = () => getAutoExpandedSections(tag).includes(section).',
    },
    {
      file: 'src/components/inspector/TypographySection.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: 'Typography rows (family/weight/size/line-height/letter-spacing/color). Each reads className+style, calls matchValueToToken, renders StatBadge variant="warning" when inTokenSet === false.',
    },
    {
      file: 'src/components/inspector/FormPropsSection.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: 'name/value/placeholder/type rows for input/textarea/select.',
    },
    {
      file: 'src/components/inspector/MediaPropsSection.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: 'src/alt/object-fit rows for img/video/picture.',
    },
    {
      file: 'src/components/inspector/A11ySection.tsx',
      changeType: 'CREATE',
      owner: 'flint-design-engineer',
      summary: 'aria-label/role/tabIndex rows. Rendered for all interactive tags.',
    },
    {
      file: 'src/components/inspector/__tests__/TypographySection.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Off-token flag present for text-[17px]; absent for text-body.',
    },
    {
      file: 'src/components/ui/__tests__/PropertiesPanel.inspector1.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Element-type matrix (24 tags), auto-tab-switch, manual-override respects user, relevant-sections-only.',
    },
  ],
  ipc: [],
  stores: [
    {
      store: 'canvasStore',
      newState: { userOverrodeTab: 'boolean' },
      newActions: { markTabOverridden: '() => void' },
      newSelectors: {},
    },
  ],
  components: [
    {
      name: 'TypographySection',
      file: 'src/components/inspector/TypographySection.tsx',
      propsType: 'TypographySectionProps',
      consumesStores: ['editorStore', 'tokenStore'],
      emitsIPC: [],
    },
    {
      name: 'FormPropsSection',
      file: 'src/components/inspector/FormPropsSection.tsx',
      propsType: 'FormPropsSectionProps',
      consumesStores: ['editorStore'],
      emitsIPC: [],
    },
    {
      name: 'MediaPropsSection',
      file: 'src/components/inspector/MediaPropsSection.tsx',
      propsType: 'MediaPropsSectionProps',
      consumesStores: ['editorStore'],
      emitsIPC: [],
    },
    {
      name: 'A11ySection',
      file: 'src/components/inspector/A11ySection.tsx',
      propsType: 'A11ySectionProps',
      consumesStores: ['editorStore'],
      emitsIPC: [],
    },
  ],
  commandments: [2, 7, 12, 13],
  testBoundaries: [
    {
      target: 'useAutoTabSwitch — null→id transition switches to Properties',
      kind: 'hook',
      behavior: 'Selecting a node from a state where rightTab is not properties auto-switches the tab',
      assertion: 'rightTab === "properties" after the effect runs',
      edgeCases: ['id→id transition does not re-switch', 'governance tab currently active'],
      given: 'canvasStore with { activeSelection: null, rightTab: "governance", userOverrodeTab: false } and hook mounted',
      when: 'setActiveSelection("div:5:2") is called',
      then: 'sets canvasStore.rightTab === "properties" on the next microtask',
    },
    {
      target: 'useAutoTabSwitch — userOverrodeTab blocks auto-switch',
      kind: 'hook',
      behavior: 'When the user has manually chosen a different tab during the current selection, subsequent selection changes do not yank them back',
      assertion: 'rightTab remains unchanged after the selection change',
      edgeCases: ['deselect resets the override flag'],
      given: 'canvasStore with { activeSelection: "div:5:2", rightTab: "tokens", userOverrodeTab: true } and hook mounted',
      when: 'setActiveSelection("h1:8:4") is called',
      then: 'reads canvasStore.rightTab === "tokens" (no change)',
    },
    {
      target: 'useAutoTabSwitch — deselect resets override',
      kind: 'hook',
      behavior: 'Clearing selection returns userOverrodeTab to false so the next node selection can auto-switch',
      assertion: 'userOverrodeTab === false after deselect',
      edgeCases: ['immediate re-selection triggers auto-switch again'],
      given: 'canvasStore with { activeSelection: "div:5:2", userOverrodeTab: true }',
      when: 'setActiveSelection(null) is called',
      then: 'sets canvasStore.userOverrodeTab === false',
    },
    {
      target: 'elementTypePropertyMap — text tag returns typography-primary section set',
      kind: 'service',
      behavior: 'Text tags map to Typography + Layout + A11y + NodeProperties; no MediaProps, no FormProps',
      assertion: 'returned section list matches the text-bucket spec',
      edgeCases: ['h1..h6, p, span, label all return same list'],
      given: 'tagName === "h1"',
      when: 'getRelevantSections("h1") is invoked',
      then: 'returns ["Typography", "Layout", "A11y", "NodeProperties"] and excludes "MediaProps" and "FormProps"',
    },
    {
      target: 'elementTypePropertyMap — img returns media section set, no typography',
      kind: 'service',
      behavior: 'img/video/picture tags do not surface Typography',
      assertion: 'Typography not in the returned list',
      edgeCases: ['svg falls into media bucket'],
      given: 'tagName === "img"',
      when: 'getRelevantSections("img") is invoked',
      then: 'returns a list containing "MediaProps" and excluding "Typography"',
    },
    {
      target: 'elementTypePropertyMap — unknown/custom tag falls back to generic set',
      kind: 'service',
      behavior: 'Unknown lowercase tag and capitalized component both fall back to the generic full inspector',
      assertion: 'all non-specialized sections present; autoExpand empty',
      edgeCases: ['Card (capitalized)', 'mystery (unknown lowercase)'],
      given: 'tagName === "Card"',
      when: 'getRelevantSections("Card") and getAutoExpandedSections("Card") are invoked',
      then: 'returns the full generic section list from getRelevantSections and returns [] from getAutoExpandedSections',
    },
    {
      target: 'elementTypePropertyMap — auto-expand rule picks the primary section',
      kind: 'service',
      behavior: 'Auto-expand returns exactly one section for each specialized bucket',
      assertion: 'returned list length === 1 for h1, img, button, input',
      edgeCases: ['generic fallback returns empty'],
      given: 'each of tagName ∈ {"h1", "img", "button", "input"}',
      when: 'getAutoExpandedSections(tag) is invoked for each',
      then: 'returns a list of length 1 for each specialized tag (primary section only)',
    },
    {
      target: 'matchValueToToken — value present in token set returns inTokenSet=true',
      kind: 'service',
      behavior: 'Wrapper delegates to findClosestToken and reports membership',
      assertion: 'inTokenSet === true when value exactly equals a token value',
      edgeCases: ['hex equality for color; string equality for fontFamily'],
      given: 'tokenStore contains a fontSize token {name: "body", value: "14px"}',
      when: 'matchValueToToken("14px", "fontSize") is invoked',
      then: 'returns { inTokenSet: true, nearestTokenName: "body", deltaE: 0 }',
    },
    {
      target: 'matchValueToToken — arbitrary value flags off-token',
      kind: 'service',
      behavior: 'Off-token values surface inTokenSet=false and the nearest token',
      assertion: 'inTokenSet === false; nearestTokenName populated',
      edgeCases: ['17px when scale is 12/14/16/20'],
      given: 'tokenStore fontSize tokens {small:"12px", body:"14px", lg:"16px", xl:"20px"}',
      when: 'matchValueToToken("17px", "fontSize") is invoked',
      then: 'returns { inTokenSet: false, nearestTokenName: "lg" } (deltaE numeric)',
    },
    {
      target: 'TypographySection — off-token size renders warning StatBadge',
      kind: 'component',
      behavior: 'Font-size input for text-[17px] renders a StatBadge variant="warning" next to the raw value',
      assertion: 'exactly one data-schema-role="state-signal" badge visible; raw "17px" visible in input',
      edgeCases: ['in-token value text-lg renders zero warning badges'],
      given: '<TypographySection layer={{tagName:"h1", className:"text-[17px]"}} ... /> mounted',
      when: 'the component renders in jsdom',
      then: 'renders exactly one element with data-schema-role="state-signal" and data-variant="warning" and the string "17px" in the size input',
    },
    {
      target: 'TypographySection — in-token size renders no warning',
      kind: 'component',
      behavior: 'Font-size input for text-body renders a chip with the token name and no warning badge',
      assertion: 'zero warning StatBadges; token chip visible',
      edgeCases: ['text-body, text-lg, text-title'],
      given: '<TypographySection layer={{tagName:"h1", className:"text-body"}} ... /> mounted with tokenStore containing "body"',
      when: 'the component renders',
      then: 'renders zero elements with data-variant="warning" and renders a chip showing the token name "body"',
    },
    {
      target: 'PropertiesPanel — selecting <img> renders MediaProps, not Typography',
      kind: 'component',
      behavior: 'Element-type registry gates which sections appear',
      assertion: 'MediaProps section visible; Typography absent',
      edgeCases: ['deselecting clears the panel'],
      given: 'PropertiesPanel with selected layer tagName="img"',
      when: 'the panel renders',
      then: 'renders a Section with title "Media" and does not render any Section with title "Typography"',
    },
    {
      target: 'PropertiesPanel — auto-tab-switch on selection',
      kind: 'component',
      behavior: 'Selecting a node while another tab is active switches to Properties',
      assertion: 'rightTab resolves to "properties" after selection dispatch',
      edgeCases: ['repeated selections of different nodes remain on Properties'],
      given: 'App rendered with rightTab="governance" and activeSelection=null',
      when: 'CANVAS_CLICK is dispatched for a layer id',
      then: 'updates canvasStore.rightTab === "properties" within one render cycle',
    },
    {
      target: 'PropertiesPanel — manual tab switch during selection persists',
      kind: 'component',
      behavior: 'If the user clicks Tokens tab while a node is selected, selection changes do not revert them to Properties',
      assertion: 'rightTab stays at "tokens" after a subsequent selection change',
      edgeCases: ['deselect clears the override and allows auto-switch again'],
      given: 'App rendered with a node selected, user has clicked the Tokens tab (markTabOverridden fired)',
      when: 'CANVAS_CLICK dispatches a different layer id',
      then: 'reads canvasStore.rightTab === "tokens"',
    },
    {
      target: 'Shared module invariant — no duplicate CIEDE2000 implementation',
      kind: 'service',
      behavior: 'Token-matching logic lives in one place',
      assertion: 'grep for CIEDE2000 or deltaE2000 returns 1 file (tokenMatcher.ts)',
      edgeCases: ['test files excluded'],
      given: 'INSPECTOR.1 landed to src/',
      when: 'grep -rnE "CIEDE2000|deltaE2000" src/ --exclude-dir=__tests__ --exclude="*.test.*" executes',
      then: 'returns matches only in src/utils/tokenMatcher.ts (single source of truth)',
    },
  ],
  invariants: [
    {
      name: 'auto-tab-switch-on-selection',
      measurable: 'probability that a null→id selection transition leaves rightTab === "properties"',
      threshold: '= 100% over n >= 20 jsdom trials',
      measuredBy: 'vitest matrix: 20 random starting tabs, each followed by setActiveSelection, assert rightTab',
    },
    {
      name: 'respects-manual-tab-switch',
      measurable: 'count of auto-switches that override userOverrodeTab=true',
      threshold: '= 0',
      measuredBy: 'vitest: after markTabOverridden, dispatch 5 selection changes, assert rightTab never changes',
    },
    {
      name: 'relevant-sections-only-rendered',
      measurable: 'for each tag T in registry, rendered Section count minus getRelevantSections(T).length',
      threshold: '= 0 for all 24 tags',
      measuredBy: 'vitest matrix renders PropertiesPanel with each tag and asserts equality',
    },
    {
      name: 'auto-expand-matches-registry',
      measurable: 'for each tag T, set of Sections with aria-expanded="true" XOR getAutoExpandedSections(T)',
      threshold: '= empty set for all 24 tags',
      measuredBy: 'vitest matrix reads aria-expanded on each rendered Section',
    },
    {
      name: 'off-token-flag-present-when-value-unknown',
      measurable: 'count of data-variant="warning" StatBadges when className contains a non-token value',
      threshold: '>= 1 per known-bad fixture',
      measuredBy: 'vitest with fixtures: text-[17px], p-[13px], font-[\'Helvetica Neue\']',
    },
    {
      name: 'off-token-flag-absent-when-value-matches',
      measurable: 'count of data-variant="warning" StatBadges when className uses only token values',
      threshold: '= 0 per known-good fixture',
      measuredBy: 'vitest with fixtures: text-body, p-4, font-sans',
    },
    {
      name: 'token-match-reuses-mithril',
      measurable: 'count of files under src/ defining CIEDE2000 or deltaE2000 (excluding tests)',
      threshold: '= 1 (tokenMatcher.ts only)',
      measuredBy: 'grep -rlE "CIEDE2000|deltaE2000" src/ --exclude-dir=__tests__ --exclude="*.test.*" | wc -l',
    },
    {
      name: 'no-new-ipc',
      measurable: 'count of new channels added to shared/ipc-validators.ts in this phase',
      threshold: '= 0',
      measuredBy: 'git diff shared/ipc-validators.ts between base and HEAD',
    },
    {
      name: 'no-new-mcp-surface',
      measurable: 'count of new MCP tool/resource/prompt registrations in flint-mcp/',
      threshold: '= 0',
      measuredBy: 'git diff flint-mcp/src/server.ts between base and HEAD',
    },
  ],
  risks: [
    {
      risk: 'Registry bottleneck — every new element type requires a code change',
      severity: 'medium',
      commandment: 2,
      mitigation: 'Unknown tag falls back to generic inspector (all sections, all collapsed). Extension is additive.',
    },
    {
      risk: 'Off-token scanner misses a utility class pattern, producing a silent "all clean" verdict',
      severity: 'high',
      commandment: 2,
      mitigation: 'Test boundaries for known-bad fixtures (text-[17px], p-[13px]) must render a warning badge. Phase 3 integration validator compares scanner output against MithrilLinter violation set for parity.',
    },
    {
      risk: 'Auto-tab-switch feels intrusive when user is mid-flow in Tokens tab',
      severity: 'medium',
      mitigation: 'userOverrodeTab flag — manual switches stick until selection clears. Session-only per ODQ-5.',
    },
    {
      risk: 'matchValueToToken implementation drifts from MithrilLinter token resolution rules',
      severity: 'high',
      commandment: 13,
      mitigation: 'matchValueToToken MUST import findClosestToken from tokenMatcher.ts. Invariant token-match-reuses-mithril asserts zero parallel CIEDE2000 files.',
    },
    {
      risk: 'expandedWhen predicates conflict with GLASSTYPO.1 Rev 3 rule ("expand only when actionable lever exists")',
      severity: 'low',
      mitigation: 'Every section in the registry contains editable inputs. Passive-info sections are not permitted in this phase.',
    },
    {
      risk: 'Capitalized-component heuristic misclassifies lowercase custom elements',
      severity: 'low',
      mitigation: 'Both unknown lowercase and capitalized tags route to the generic fallback.',
    },
  ],
  parallelismGroups: {
    A: ['flint-state-architect', 'flint-ast-surgeon', 'flint-test-writer'],
    B: ['flint-design-engineer'],
    C: ['flint-design-engineer', 'flint-test-writer'],
    D: ['flint-code-reviewer', 'flint-integration-validator'],
  },
  nonGoals: [
    'No changes to canvasStore.activeSelection, editorStore.selectedNodeId, or any AST write path — inspector is read-only wrt selection plumbing',
    'No new MCP tool, resource, or prompt',
    'No new token category — tokenStore is consumed as-is',
    'No user-facing custom-component registration API — registry is static in this phase',
    'No changes to MithrilLinter.ts — its resolver is consumed, not modified',
    'No cross-session persistence of userOverrodeTab — session-scoped only per ODQ-5',
    'No multi-section auto-expand — exactly one primary section per specialized tag (generic fallback expands zero)',
    'No keyboard shortcut to toggle relevant-only vs. show-all — deferred',
    'No changes to LayoutPanel, ClassBuilder, DriftDetector, AnnotationList internals — composed unchanged',
    'No changes to electron/, server/, flint-mcp/, or shared/ directories',
  ],
};
