/**
 * ruleProvenanceRegistry — bridge-mcp/src/core/governance/ruleProvenanceRegistry.ts
 *
 * Static provenance registry mapping every known ruleId to its regulatory
 * metadata. This is the single source of truth for GOV.1 (Rule Provenance).
 *
 * Rules not present in this map receive a fallback provenance with
 * sourceAuthority: 'Bridge Design System' and regulatoryReference: 'N/A'.
 *
 * All rules enforced by Bridge MCP are registered here:
 *   - 10 Original A11y rules (A11Y-001..010)   — WCAG 2.1 AA
 *   - 20 EXP.6a A11y rules (A11Y-011..073)     — WCAG 2.1 AA/AAA
 *   - 5  Mithril typography rules (MITHRIL-TYP-001..005)
 *   - 1  Mithril color rule (MITHRIL-COL)
 *   - 1  Mithril spacing rule (MITHRIL-SPC-001)
 *   - 1  Mithril shadow rule (MITHRIL-SHD-001)
 *   - 1  Mithril opacity rule (MITHRIL-OPC-001)
 *   - 1  Export gate rule (EXP-001)
 *
 * Query API:
 *   getProvenance(ruleId)       — single lookup (returns fallback for unknown)
 *   getAllProvenance()           — full registry as array
 *   getByAuthority(authority)   — filter by SourceAuthority
 *   getByCategory(category)     — filter by RuleCategory
 */

import type { RuleProvenance, RuleProvenanceEntry, RuleCategory, ComplianceSummary, SourceAuthority } from './types.js'

// ── Static provenance map ──────────────────────────────────────────────────────

/**
 * Internal provenance registry with extended metadata (category, severity, description).
 * The public API exposes both the base RuleProvenance shape and the extended entry.
 */
const REGISTRY_ENTRIES: ReadonlyArray<RuleProvenanceEntry> = [

    // ── Accessibility rules — Names & Labels (WCAG 2.1 AA) ─────────────────────

    {
        ruleId: 'A11Y-001',
        ruleName: 'Image Missing Alt Text',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.1.1 (Non-text Content)',
        lastUpdated: '2025-06-05',
        rationale: 'Images must have text alternatives so screen reader users receive equivalent information.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: '<img> elements must have an alt attribute.',
    },

    {
        ruleId: 'A11Y-002',
        ruleName: 'Button Missing Accessible Name',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'Buttons must have an accessible name so assistive technology can identify their purpose.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: '<button> elements must have an accessible name.',
    },

    {
        ruleId: 'A11Y-003',
        ruleName: 'Anchor Missing Accessible Name',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 2.4.4 (Link Purpose)',
        lastUpdated: '2025-06-05',
        rationale: 'Links must have descriptive text or aria-label so users understand where they navigate.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: '<a> elements must have an accessible name.',
    },

    {
        ruleId: 'A11Y-004',
        ruleName: 'Input Missing Programmatic Label',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Form inputs must be programmatically linked to a visible or screen-reader-accessible label.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: '<input> elements must have a programmatic label.',
    },

    {
        ruleId: 'A11Y-005',
        ruleName: 'Select Missing Accessible Label',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Select elements must have an accessible label so screen reader users can identify the control.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: '<select> elements must have an accessible label.',
    },

    {
        ruleId: 'A11Y-006',
        ruleName: 'Textarea Missing Accessible Label',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Textarea elements must be labelled so assistive technology can identify their purpose.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: '<textarea> elements must have an accessible label.',
    },

    // ── EXP.6a — Names & Labels expansion ────────────────────────────────────────

    {
        ruleId: 'A11Y-011',
        ruleName: 'Image Alt Is Filename',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.1.1 (Non-text Content)',
        lastUpdated: '2025-06-05',
        rationale: 'Alt text that is a filename provides no meaningful description to assistive technology users.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: '<img> alt attribute must not be a filename.',
    },

    {
        ruleId: 'A11Y-012',
        ruleName: 'SVG Missing Accessible Name',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.1.1 (Non-text Content)',
        lastUpdated: '2025-06-05',
        rationale: 'SVG elements need accessible names or aria-hidden for screen reader users to understand or skip them.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: '<svg> must have <title>, aria-label, or aria-hidden="true".',
    },

    {
        ruleId: 'A11Y-013',
        ruleName: 'Image Input Missing Alt',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.1.1 (Non-text Content)',
        lastUpdated: '2025-06-05',
        rationale: 'Image inputs act as submit buttons and must have alt text describing their function.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: '<input type="image"> must have an alt attribute.',
    },

    {
        ruleId: 'A11Y-014',
        ruleName: 'Generic Link Text',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 2.4.4 (Link Purpose)',
        lastUpdated: '2025-06-05',
        rationale: 'Generic link text like "click here" does not describe the link destination, confusing screen reader users.',
        category: 'names-labels',
        defaultSeverity: 'critical',
        description: 'Link text must not be generic ("click here", "read more", etc.).',
    },

    // ── Accessibility rules — Keyboard ───────────────────────────────────────────

    {
        ruleId: 'A11Y-007',
        ruleName: 'Positive tabIndex Disrupts Tab Order',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 2.4.3 (Focus Order)',
        lastUpdated: '2025-06-05',
        rationale: 'tabIndex values greater than 0 create an unintuitive keyboard navigation order.',
        category: 'keyboard',
        defaultSeverity: 'critical',
        description: 'tabIndex > 0 disrupts the natural tab order.',
    },

    {
        ruleId: 'A11Y-020',
        ruleName: 'Non-Interactive Element With Click Handler',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 2.1.1 (Keyboard)',
        lastUpdated: '2025-06-05',
        rationale: 'Non-interactive elements with click handlers are inaccessible to keyboard-only users without role, tabIndex, and onKeyDown.',
        category: 'keyboard',
        defaultSeverity: 'critical',
        description: 'Non-interactive elements with onClick must have role, tabIndex, and onKeyDown.',
    },

    {
        ruleId: 'A11Y-021',
        ruleName: 'Mouse-Only Event Handler',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 2.1.1 (Keyboard)',
        lastUpdated: '2025-06-05',
        rationale: 'Mouse-only event handlers exclude keyboard and touch users from interactive functionality.',
        category: 'keyboard',
        defaultSeverity: 'critical',
        description: 'Mouse-only event handlers must have keyboard equivalents.',
    },

    {
        ruleId: 'A11Y-022',
        ruleName: 'Focus Indicator Removed',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 2.4.7 (Focus Visible)',
        lastUpdated: '2025-06-05',
        rationale: 'Removing focus indicators via outline:none prevents keyboard users from seeing which element is focused.',
        category: 'keyboard',
        defaultSeverity: 'critical',
        description: 'Elements must not remove the focus indicator without a replacement.',
    },

    // ── Accessibility rules — Structure ──────────────────────────────────────────

    {
        ruleId: 'A11Y-008',
        ruleName: 'Table Missing Accessible Summary',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Data tables need an accessible summary (<caption> or aria-label) for screen reader orientation.',
        category: 'structure',
        defaultSeverity: 'critical',
        description: '<table> elements must have an accessible summary.',
    },

    {
        ruleId: 'A11Y-009',
        ruleName: 'HTML Element Missing Lang Attribute',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 3.1.1 (Language of Page)',
        lastUpdated: '2025-06-05',
        rationale: 'The html element must declare its language so screen readers use the correct pronunciation rules.',
        category: 'structure',
        defaultSeverity: 'critical',
        description: '<html> must have a lang attribute.',
    },

    {
        ruleId: 'A11Y-010',
        ruleName: 'Heading Levels Skipped',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Heading levels must be sequential to allow screen reader users to navigate document structure.',
        category: 'structure',
        defaultSeverity: 'critical',
        description: 'Heading levels must not be skipped.',
    },

    {
        ruleId: 'A11Y-015',
        ruleName: 'List Contains Non-List-Item Children',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Lists with non-li children break the semantic structure that assistive technology relies on.',
        category: 'structure',
        defaultSeverity: 'critical',
        description: '<ul> and <ol> direct children must be <li> elements.',
    },

    {
        ruleId: 'A11Y-016',
        ruleName: 'Definition List Contains Invalid Children',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Definition lists with invalid children break semantic structure for screen readers.',
        category: 'structure',
        defaultSeverity: 'critical',
        description: '<dl> direct children must be <dt> or <dd> elements.',
    },

    {
        ruleId: 'A11Y-017',
        ruleName: 'Page Must Have Exactly One H1',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 2.4.2 (Page Titled)',
        lastUpdated: '2025-06-05',
        rationale: 'Multiple h1 elements confuse document structure for screen reader navigation.',
        category: 'structure',
        defaultSeverity: 'critical',
        description: 'The page must have exactly one <h1> element.',
    },

    // ── Accessibility rules — ARIA ───────────────────────────────────────────────

    {
        ruleId: 'A11Y-030',
        ruleName: 'Invalid ARIA Role',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'Invalid ARIA roles are ignored by assistive technology, causing widgets to lose their semantic meaning.',
        category: 'aria',
        defaultSeverity: 'critical',
        description: 'role attribute must be a valid WAI-ARIA role.',
    },

    {
        ruleId: 'A11Y-031',
        ruleName: 'Required ARIA Children Missing',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'ARIA composite widgets require specific child roles to be correctly understood by assistive technology.',
        category: 'aria',
        defaultSeverity: 'critical',
        description: 'Elements with certain ARIA roles must have required child roles present.',
    },

    {
        ruleId: 'A11Y-032',
        ruleName: 'Element Outside Required ARIA Parent',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'Child roles without the required parent role lose their semantic meaning in the accessibility tree.',
        category: 'aria',
        defaultSeverity: 'critical',
        description: 'Elements with certain ARIA roles must be inside a required parent role.',
    },

    {
        ruleId: 'A11Y-033',
        ruleName: 'Required ARIA Attribute Missing',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'ARIA widget roles require specific state attributes to communicate their current state to assistive technology.',
        category: 'aria',
        defaultSeverity: 'critical',
        description: 'Elements with certain ARIA roles must have required ARIA attributes.',
    },

    {
        ruleId: 'A11Y-034',
        ruleName: 'Invalid ARIA Attribute Name',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'Invalid ARIA attribute names are ignored by browsers, causing accessibility metadata to be lost.',
        category: 'aria',
        defaultSeverity: 'critical',
        description: 'ARIA attribute names must be valid WAI-ARIA attributes.',
    },

    {
        ruleId: 'A11Y-035',
        ruleName: 'Invalid ARIA Attribute Value',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'Invalid ARIA attribute values cause unpredictable behavior in assistive technology.',
        category: 'aria',
        defaultSeverity: 'critical',
        description: 'ARIA attribute values must match allowed types.',
    },

    {
        ruleId: 'A11Y-036',
        ruleName: 'Aria-Hidden On Focusable Element',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'Focusable elements with aria-hidden are still reachable by keyboard but invisible to screen readers, creating a confusing experience.',
        category: 'aria',
        defaultSeverity: 'critical',
        description: 'aria-hidden="true" must not be on focusable elements.',
    },

    {
        ruleId: 'A11Y-037',
        ruleName: 'Duplicate ARIA Attributes',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'Duplicate ARIA attributes result in only the last value being used, potentially overriding intended semantics.',
        category: 'aria',
        defaultSeverity: 'critical',
        description: 'Elements must not have duplicate ARIA attributes.',
    },

    {
        ruleId: 'A11Y-038',
        ruleName: 'Interactive Element With Presentation Role',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'role="presentation" removes semantic meaning from interactive elements, making them unusable for AT users.',
        category: 'aria',
        defaultSeverity: 'critical',
        description: 'Interactive elements must not have role="presentation" or role="none".',
    },

    // ── Accessibility rules — Landmarks ──────────────────────────────────────────

    {
        ruleId: 'A11Y-050',
        ruleName: 'Missing Main Landmark',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'A main landmark helps screen reader users quickly navigate to the primary content area.',
        category: 'landmarks',
        defaultSeverity: 'critical',
        description: 'The page must have a <main> element or role="main".',
    },

    {
        ruleId: 'A11Y-051',
        ruleName: 'Missing Navigation Landmark',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Navigation landmarks help screen reader users find and skip navigation blocks.',
        category: 'landmarks',
        defaultSeverity: 'warning',
        description: 'The page should have a <nav> element or role="navigation".',
    },

    {
        ruleId: 'A11Y-052',
        ruleName: 'Multiple Main Landmarks',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Multiple main landmarks confuse screen reader navigation by creating ambiguity about which is the primary content.',
        category: 'landmarks',
        defaultSeverity: 'critical',
        description: '<main> must not appear more than once per page.',
    },

    {
        ruleId: 'A11Y-053',
        ruleName: 'Duplicate Landmark Without Distinct Label',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Multiple landmarks of the same type without distinct labels are indistinguishable in the accessibility tree.',
        category: 'landmarks',
        defaultSeverity: 'critical',
        description: 'Multiple landmarks of the same type must have distinct aria-labels.',
    },

    // ── Accessibility rules — Contrast ───────────────────────────────────────────

    {
        ruleId: 'A11Y-060',
        ruleName: 'Normal Text Insufficient Contrast',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.4.3 (Contrast Minimum)',
        lastUpdated: '2025-06-05',
        rationale: 'Insufficient text contrast makes content unreadable for users with low vision.',
        category: 'contrast',
        defaultSeverity: 'critical',
        description: 'Normal text must have a contrast ratio of at least 4.5:1.',
    },

    {
        ruleId: 'A11Y-061',
        ruleName: 'Large Text Insufficient Contrast',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.4.3 (Contrast Minimum)',
        lastUpdated: '2025-06-05',
        rationale: 'Large text with insufficient contrast is difficult to read for users with low vision.',
        category: 'contrast',
        defaultSeverity: 'critical',
        description: 'Large text must have a contrast ratio of at least 3:1.',
    },

    {
        ruleId: 'A11Y-062',
        ruleName: 'UI Component Insufficient Contrast',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.4.11 (Non-text Contrast)',
        lastUpdated: '2025-06-05',
        rationale: 'UI components with insufficient contrast are difficult to perceive for users with low vision.',
        category: 'contrast',
        defaultSeverity: 'critical',
        description: 'UI components must have a non-text contrast ratio of at least 3:1.',
    },

    // ── Accessibility rules — Forms ──────────────────────────────────────────────

    {
        ruleId: 'A11Y-070',
        ruleName: 'Fieldset Missing Legend',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Fieldsets without legends fail to convey the grouping purpose to screen reader users.',
        category: 'forms',
        defaultSeverity: 'critical',
        description: '<fieldset> elements must contain a <legend> child.',
    },

    {
        ruleId: 'A11Y-071',
        ruleName: 'Required Input Missing aria-required',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 3.3.2 (Labels or Instructions)',
        lastUpdated: '2025-06-05',
        rationale: 'Without aria-required, assistive technology cannot announce that a field is mandatory.',
        category: 'forms',
        defaultSeverity: 'critical',
        description: '<input> with required must also have aria-required="true".',
    },

    {
        ruleId: 'A11Y-072',
        ruleName: 'Invalid Input Missing Error Description',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 3.3.1 (Error Identification)',
        lastUpdated: '2025-06-05',
        rationale: 'Inputs marked invalid without aria-describedby fail to communicate the error to assistive technology users.',
        category: 'forms',
        defaultSeverity: 'critical',
        description: '<input> with aria-invalid must have aria-describedby pointing to an error message.',
    },

    {
        ruleId: 'A11Y-073',
        ruleName: 'Invalid Autocomplete Value',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.5 (Identify Input Purpose)',
        lastUpdated: '2025-06-05',
        rationale: 'Invalid autocomplete values prevent browsers and AT from autofilling form fields correctly.',
        category: 'forms',
        defaultSeverity: 'critical',
        description: 'The autocomplete attribute must use valid HTML5 autofill detail tokens.',
    },

    // ── Mithril color rule ─────────────────────────────────────────────────────

    {
        ruleId: 'MITHRIL-COL',
        ruleName: 'Color Drift from Design Token (CIEDE2000)',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Color Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Arbitrary color values that deviate more than Delta-E 2.0 from the nearest design token create visual inconsistency and brand drift.',
        category: 'color',
        defaultSeverity: 'warning',
        description: 'Arbitrary color values must match design tokens within CIEDE2000 Delta-E threshold.',
    },

    // ── Mithril typography rules ───────────────────────────────────────────────

    {
        ruleId: 'MITHRIL-TYP-001',
        ruleName: 'Arbitrary Font Family Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Font families must be sourced from design tokens to maintain typographic consistency across the product.',
        category: 'typography',
        defaultSeverity: 'warning',
        description: 'Font family values must come from fontFamily design tokens.',
    },

    {
        ruleId: 'MITHRIL-TYP-002',
        ruleName: 'Arbitrary Font Size Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Font sizes must map to dimension tokens to preserve the typographic scale.',
        category: 'typography',
        defaultSeverity: 'warning',
        description: 'Font size values must come from dimension design tokens.',
    },

    {
        ruleId: 'MITHRIL-TYP-003',
        ruleName: 'Arbitrary Font Weight Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Font weights must be sourced from design tokens to ensure consistent text emphasis.',
        category: 'typography',
        defaultSeverity: 'warning',
        description: 'Font weight values must come from fontWeight design tokens.',
    },

    {
        ruleId: 'MITHRIL-TYP-004',
        ruleName: 'Arbitrary Line Height Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Line heights must come from tokens so vertical rhythm is preserved across the design system.',
        category: 'typography',
        defaultSeverity: 'warning',
        description: 'Line height values must come from lineHeight design tokens.',
    },

    {
        ruleId: 'MITHRIL-TYP-005',
        ruleName: 'Arbitrary Letter Spacing Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Letter spacing must use design tokens to maintain consistent tracking across typefaces.',
        category: 'typography',
        defaultSeverity: 'warning',
        description: 'Letter spacing values must come from letterSpacing design tokens.',
    },

    // ── Mithril spacing rule ───────────────────────────────────────────────────

    {
        ruleId: 'MITHRIL-SPC-001',
        ruleName: 'Arbitrary Spacing Value Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Spacing Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Margin, padding, gap, and dimension values must be sourced from dimension tokens to maintain spatial rhythm.',
        category: 'spacing',
        defaultSeverity: 'warning',
        description: 'Spacing values must come from dimension design tokens.',
    },

    // ── Mithril shadow rule ────────────────────────────────────────────────────

    {
        ruleId: 'MITHRIL-SHD-001',
        ruleName: 'Arbitrary Box Shadow Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Shadow Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Box shadow values must come from shadow tokens to preserve elevation consistency.',
        category: 'shadow',
        defaultSeverity: 'warning',
        description: 'Box shadow values must come from shadow design tokens.',
    },

    // ── Mithril opacity rule ───────────────────────────────────────────────────

    {
        ruleId: 'MITHRIL-OPC-001',
        ruleName: 'Arbitrary Opacity Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Opacity Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Opacity values must be sourced from tokens to ensure consistent transparency levels.',
        category: 'opacity',
        defaultSeverity: 'warning',
        description: 'Opacity values must come from opacity design tokens.',
    },

    // ── Export gate rule ───────────────────────────────────────────────────────

    {
        ruleId: 'EXP-001',
        ruleName: 'Export Blocked — Active Governance Violations',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Governance — Export Gate Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Exports are blocked when active Mithril or A11y violations remain unresolved to prevent non-compliant code from reaching production.',
        category: 'export-gate',
        defaultSeverity: 'critical',
        description: 'Export is blocked while governance violations remain.',
    },
]

// ── Lookup maps (built once at module load) ────────────────────────────────────

const entryByRuleId = new Map<string, RuleProvenanceEntry>()
for (const entry of REGISTRY_ENTRIES) {
    entryByRuleId.set(entry.ruleId, entry)
}

/**
 * Legacy-compatible ReadonlyMap keyed by ruleId.
 * Returns `RuleProvenance` (without extended fields) for backward compatibility
 * with existing callers that use `RULE_PROVENANCE_REGISTRY.get(ruleId)`.
 */
export const RULE_PROVENANCE_REGISTRY: ReadonlyMap<string, RuleProvenance> = entryByRuleId

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve provenance for a ruleId. Returns a fallback provenance
 * when the ruleId is not in the registry (unknown or custom rules).
 */
export function resolveProvenance(ruleId: string): RuleProvenance {
    return entryByRuleId.get(ruleId) ?? {
        ruleId,
        ruleName: ruleId,
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'N/A',
        lastUpdated: new Date().toISOString().slice(0, 10),
        rationale: 'Custom or unregistered rule.',
    }
}

/**
 * Get the full provenance entry for a ruleId, including category and severity.
 * Returns undefined for unknown rule IDs (unlike resolveProvenance which returns a fallback).
 */
export function getProvenance(ruleId: string): RuleProvenanceEntry | undefined {
    return entryByRuleId.get(ruleId)
}

/**
 * Return all registered provenance entries.
 */
export function getAllProvenance(): RuleProvenanceEntry[] {
    return [...REGISTRY_ENTRIES]
}

/**
 * Filter provenance entries by source authority.
 */
export function getByAuthority(authority: SourceAuthority): RuleProvenanceEntry[] {
    return REGISTRY_ENTRIES.filter((e) => e.sourceAuthority === authority)
}

/**
 * Filter provenance entries by rule category.
 */
export function getByCategory(category: RuleCategory): RuleProvenanceEntry[] {
    return REGISTRY_ENTRIES.filter((e) => e.category === category)
}

/**
 * Build a ComplianceSummary from a list of violated ruleIds + severity labels.
 *
 * Severity mapping:
 *   - Mithril 'critical' severity  -> 'critical'
 *   - Mithril 'amber' severity     -> 'warning'
 *   - A11y violations              -> 'critical'
 *   - Unknown / fallback           -> 'warning'
 *
 * @param violations - Each entry has a ruleId and a severity string.
 *   Accepted severity values: 'critical' | 'amber' | 'warning' | 'info'.
 *   'amber' is mapped to 'warning' for the ComplianceSummary output.
 */
export function buildComplianceSummary(
    violations: Array<{ ruleId: string; severity: string }>
): ComplianceSummary {
    const totalViolations = violations.length

    // Seed byAuthority with all known authorities at 0.
    const byAuthority: Record<SourceAuthority, number> = {
        'WCAG 2.1 AA': 0,
        'WCAG 2.2 AA': 0,
        'SOC2': 0,
        'FDA SaMD': 0,
        'HIPAA': 0,
        'Section 508': 0,
        'Bridge Design System': 0,
        'Custom': 0,
    }

    const bySeverity: Record<'critical' | 'warning' | 'info', number> = {
        critical: 0,
        warning: 0,
        info: 0,
    }

    const seenRuleIds = new Set<string>()
    const violatedRules: RuleProvenance[] = []

    for (const { ruleId, severity } of violations) {
        const provenance = resolveProvenance(ruleId)

        byAuthority[provenance.sourceAuthority] = (byAuthority[provenance.sourceAuthority] ?? 0) + 1

        // Normalize severity: 'amber' -> 'warning', unknown -> 'warning'
        const normalized =
            severity === 'critical' ? 'critical'
            : severity === 'info' ? 'info'
            : 'warning'

        bySeverity[normalized] += 1

        if (!seenRuleIds.has(ruleId)) {
            seenRuleIds.add(ruleId)
            violatedRules.push(provenance)
        }
    }

    return {
        totalViolations,
        byAuthority,
        bySeverity,
        violatedRules,
        generatedAt: new Date().toISOString(),
    }
}
