/**
 * rulePackRegistry.ts — ERM Phase 1
 *
 * Static TypeScript registry of all available governance rule packs.
 * This is NOT a database — it is a bundled constant exported from this module.
 *
 * 10 initial packs:
 *   Active (2): wcag-2.1-aa, mithril-design-system
 *   Available (3): brand-custom, hipaa-ui, section-508-report
 *   Coming soon (5): wcag-2.2, gdpr-consent, ccpa-privacy, pci-dss-ui, coga-cognitive
 */

import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Compliance domain taxonomy.
 * Maps to regulatory frameworks and design system governance categories.
 */
export type ComplianceDomain =
    | 'accessibility'
    | 'privacy'
    | 'security'
    | 'brand'
    | 'cognitive'
    | 'design-system'

/**
 * A jurisdiction or regulatory framework that a rule pack addresses.
 * Examples: "EU/EAA" (European Accessibility Act), "US/ADA", "US/HIPAA".
 */
export type Jurisdiction = string

/**
 * A single rule within a pack with its metadata.
 */
export interface RulePackEntry {
    /** Rule ID, e.g. "A11Y-001", "MITHRIL-COL" */
    id: string
    /** Human-readable rule name */
    name: string
    /** Detailed description of what the rule checks */
    description: string
    /** WCAG criterion if applicable, e.g. "1.1.1", "2.5.8" */
    wcagCriterion?: string
    /** Regulatory reference, e.g. "GDPR Art. 7", "PCI-DSS 3.4" */
    regulation?: string
    /** Current enforcement mode in the active config */
    defaultMode: 'coercive' | 'normative' | 'advisory' | 'off'
    /** Whether the rule has an auto-fix implementation */
    autoFixable: boolean
    /** Category for grouping in UI */
    category: string
}

/**
 * A governance rule pack — a logical grouping of rules addressing
 * a compliance domain or regulatory requirement.
 */
export interface RulePack {
    /** Unique pack identifier, e.g. "wcag-2.1-aa", "gdpr-consent", "pci-dss-ui" */
    id: string
    /** Human-readable display name */
    name: string
    /** Compliance domain this pack addresses */
    domain: ComplianceDomain
    /** Description of the pack's purpose and coverage */
    description: string
    /** Number of rules in the pack */
    ruleCount: number
    /** The individual rules in this pack */
    rules: RulePackEntry[]
    /** Jurisdictions/regulations this pack addresses */
    jurisdictions: Jurisdiction[]
    /** Which @flint/ preset enables this pack, if any */
    preset?: string
    /** Pack availability status */
    status: 'active' | 'available' | 'coming-soon'
    /** Reserved for future marketplace */
    requiresLicense?: boolean
}

/**
 * Per-jurisdiction coverage analysis result.
 */
export interface JurisdictionCoverage {
    /** Jurisdiction name, e.g. "EU/EAA" */
    jurisdiction: Jurisdiction
    /** Total rules addressing this jurisdiction */
    total: number
    /** Number of active rules covering this jurisdiction */
    covered: number
    /** Coverage percentage (0–100) */
    percentage: number
    /** Rule IDs in available/coming-soon packs not yet active (the "gaps") */
    gaps: string[]
}

// ---------------------------------------------------------------------------
// Pack definitions
// ---------------------------------------------------------------------------

// ── WCAG 2.1 AA — 50 active rules ────────────────────────────────────────────

const wcag21AARules: RulePackEntry[] = [
    // names-labels (11 rules)
    { id: 'A11Y-001', name: 'Image Missing Alt Text', description: '<img> elements must have an alt attribute.', wcagCriterion: '1.1.1', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    { id: 'A11Y-002', name: 'Button Missing Accessible Name', description: '<button> elements must have an accessible name.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    { id: 'A11Y-003', name: 'Link Missing Accessible Name', description: '<a> elements must have an accessible name.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    { id: 'A11Y-004', name: 'Input Missing Label', description: '<input> elements must have a programmatic label.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    { id: 'A11Y-005', name: 'Select Missing Label', description: '<select> elements must have an accessible label.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    { id: 'A11Y-006', name: 'Textarea Missing Label', description: '<textarea> elements must have an accessible label.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    { id: 'A11Y-011', name: 'Image Alt Is Filename', description: '<img> alt attribute must not be a filename.', wcagCriterion: '1.1.1', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    { id: 'A11Y-012', name: 'SVG Missing Accessible Name', description: '<svg> elements must have a <title>, aria-label, or role="img" + aria-label.', wcagCriterion: '1.1.1', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    { id: 'A11Y-013', name: 'Image Input Missing Alt', description: '<input type="image"> must have an alt attribute.', wcagCriterion: '1.1.1', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    { id: 'A11Y-014', name: 'Generic Link Text', description: 'Link text must not be generic ("click here", "read more", etc.).', wcagCriterion: '2.4.4', defaultMode: 'coercive', autoFixable: false, category: 'names-labels' },
    { id: 'A11Y-018', name: 'IFrame Missing Title', description: '<iframe> elements must have a title attribute describing the embedded content.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'names-labels' },
    // keyboard (4 rules)
    { id: 'A11Y-007', name: 'Positive TabIndex', description: 'tabIndex > 0 disrupts the natural tab order.', wcagCriterion: '2.4.3', defaultMode: 'coercive', autoFixable: true, category: 'keyboard' },
    { id: 'A11Y-020', name: 'Non-Interactive Element With Click Handler', description: 'Non-interactive elements with onClick must have role, tabIndex, and onKeyDown.', wcagCriterion: '2.1.1', defaultMode: 'coercive', autoFixable: true, category: 'keyboard' },
    { id: 'A11Y-021', name: 'Mouse-Only Event Handler', description: 'Mouse-only event handlers must have keyboard equivalents.', wcagCriterion: '2.1.1', defaultMode: 'coercive', autoFixable: false, category: 'keyboard' },
    { id: 'A11Y-022', name: 'Focus Indicator Removed', description: 'Elements must not remove the focus indicator via outline: none or outline: 0.', wcagCriterion: '2.4.7', defaultMode: 'coercive', autoFixable: false, category: 'keyboard' },
    // structure (6 rules)
    { id: 'A11Y-008', name: 'Table Missing Accessible Summary', description: '<table> elements must have an accessible summary.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: false, category: 'structure' },
    { id: 'A11Y-009', name: 'HTML Missing Lang Attribute', description: '<html> must have a lang attribute.', wcagCriterion: '3.1.1', defaultMode: 'coercive', autoFixable: true, category: 'structure' },
    { id: 'A11Y-010', name: 'Heading Level Skipped', description: 'Heading levels must not be skipped.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: false, category: 'structure' },
    { id: 'A11Y-015', name: 'List Contains Non-List-Item Children', description: '<ul> and <ol> direct children must be <li> elements.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: false, category: 'structure' },
    { id: 'A11Y-016', name: 'Definition List Contains Invalid Children', description: '<dl> direct children must be <dt> or <dd> elements.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: false, category: 'structure' },
    { id: 'A11Y-017', name: 'Page Must Have Exactly One H1', description: 'The page must have exactly one <h1> element.', wcagCriterion: '2.4.2', defaultMode: 'coercive', autoFixable: false, category: 'structure' },
    // aria (9 rules)
    { id: 'A11Y-030', name: 'Invalid ARIA Role', description: 'role attribute must be a valid WAI-ARIA role.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'aria' },
    { id: 'A11Y-031', name: 'Required ARIA Children Missing', description: 'Elements with certain ARIA roles must have required child roles present.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: false, category: 'aria' },
    { id: 'A11Y-032', name: 'Element Outside Required ARIA Parent', description: 'Elements with certain ARIA roles must be inside a required parent role.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: false, category: 'aria' },
    { id: 'A11Y-033', name: 'Required ARIA Attribute Missing', description: 'Elements with certain ARIA roles must have required ARIA attributes.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'aria' },
    { id: 'A11Y-034', name: 'Invalid ARIA Attribute Name', description: 'ARIA attribute names must be valid WAI-ARIA attributes.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'aria' },
    { id: 'A11Y-035', name: 'Invalid ARIA Attribute Value', description: 'ARIA attribute values must match allowed types.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: false, category: 'aria' },
    { id: 'A11Y-036', name: 'Aria-Hidden On Focusable Element', description: 'aria-hidden="true" must not be applied to focusable elements.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'aria' },
    { id: 'A11Y-037', name: 'Duplicate ARIA Attributes', description: 'Elements must not have duplicate ARIA attributes.', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'aria' },
    { id: 'A11Y-038', name: 'Interactive Element With Presentation Role', description: 'Interactive elements must not have role="presentation" or role="none".', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'aria' },
    // landmarks (4 rules)
    { id: 'A11Y-050', name: 'Missing Main Landmark', description: 'The page must have a <main> element or an element with role="main".', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: false, category: 'landmarks' },
    { id: 'A11Y-051', name: 'Missing Navigation Landmark', description: 'The page should have a <nav> element or an element with role="navigation".', wcagCriterion: '1.3.1', defaultMode: 'advisory', autoFixable: false, category: 'landmarks' },
    { id: 'A11Y-052', name: 'Multiple Main Landmarks', description: '<main> must not appear more than once per page.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: false, category: 'landmarks' },
    { id: 'A11Y-053', name: 'Duplicate Landmark Without Distinct Label', description: 'Multiple landmarks of the same type must have distinct aria-labels.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: false, category: 'landmarks' },
    // contrast (3 rules)
    { id: 'A11Y-060', name: 'Normal Text Insufficient Contrast', description: 'Normal text must have a contrast ratio of at least 4.5:1.', wcagCriterion: '1.4.3', defaultMode: 'coercive', autoFixable: false, category: 'contrast' },
    { id: 'A11Y-061', name: 'Large Text Insufficient Contrast', description: 'Large text must have a contrast ratio of at least 3:1.', wcagCriterion: '1.4.3', defaultMode: 'coercive', autoFixable: false, category: 'contrast' },
    { id: 'A11Y-062', name: 'UI Component Insufficient Contrast', description: 'UI components must have a non-text contrast ratio of at least 3:1.', wcagCriterion: '1.4.11', defaultMode: 'coercive', autoFixable: false, category: 'contrast' },
    // forms (6 rules)
    { id: 'A11Y-070', name: 'Fieldset Missing Legend', description: '<fieldset> elements must contain a <legend> child.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: true, category: 'forms' },
    { id: 'A11Y-071', name: 'Required Input Missing aria-required', description: '<input> with required attribute must also have aria-required="true".', wcagCriterion: '3.3.2', defaultMode: 'normative', autoFixable: true, category: 'forms' },
    { id: 'A11Y-072', name: 'Invalid Input Missing Error Description', description: '<input> with aria-invalid must have aria-describedby pointing to an error message.', wcagCriterion: '3.3.1', defaultMode: 'coercive', autoFixable: false, category: 'forms' },
    { id: 'A11Y-073', name: 'Invalid Autocomplete Value', description: 'The autocomplete attribute must use valid HTML5 autofill detail tokens.', wcagCriterion: '1.3.5', defaultMode: 'coercive', autoFixable: true, category: 'forms' },
    { id: 'A11Y-074', name: 'Password Input Missing Autocomplete', description: '<input type="password"> must have an autocomplete attribute of "current-password" or "new-password".', wcagCriterion: '1.3.5', defaultMode: 'normative', autoFixable: true, category: 'forms' },
    { id: 'A11Y-075', name: 'Output Element Missing Association', description: '<output> elements should be associated with form controls via htmlFor, or must have aria-live.', wcagCriterion: '1.3.1', defaultMode: 'coercive', autoFixable: true, category: 'forms' },
    // live-regions (4 rules)
    { id: 'A11Y-080', name: 'Alert Role With Wrong aria-live', description: 'Elements with role="alert" must not set aria-live="polite". Elements with role="status" must not set aria-live="assertive".', wcagCriterion: '4.1.3', defaultMode: 'coercive', autoFixable: true, category: 'live-regions' },
    { id: 'A11Y-081', name: 'Dialog Missing aria-modal', description: 'Elements with role="dialog" or role="alertdialog" must have aria-modal="true".', wcagCriterion: '4.1.2', defaultMode: 'coercive', autoFixable: true, category: 'live-regions' },
    { id: 'A11Y-082', name: 'Unnecessary Assertive Live Region', description: 'aria-live="assertive" on non-alert elements interrupts the user. Use aria-live="polite" or role="status" for non-urgent updates.', wcagCriterion: '4.1.3', defaultMode: 'normative', autoFixable: true, category: 'live-regions' },
    { id: 'A11Y-083', name: 'Live Region Missing aria-atomic', description: 'Elements with aria-live should set aria-atomic to clarify whether the whole region or only changed nodes should be announced.', wcagCriterion: '4.1.3', defaultMode: 'advisory', autoFixable: true, category: 'live-regions' },
    // motion (3 rules)
    { id: 'A11Y-090', name: 'Animation Without Reduced-Motion Guard', description: 'Tailwind animate-* classes must be guarded with motion-safe: or motion-reduce: to respect prefers-reduced-motion.', wcagCriterion: '2.3.3', defaultMode: 'advisory', autoFixable: false, category: 'motion' },
    { id: 'A11Y-091', name: 'Video Missing Controls', description: '<video> elements must have a controls attribute unless purely decorative (muted + autoplay).', wcagCriterion: '1.2.2', defaultMode: 'coercive', autoFixable: true, category: 'motion' },
    { id: 'A11Y-092', name: 'Audio Missing Controls', description: '<audio> elements must have a controls attribute.', wcagCriterion: '1.2.1', defaultMode: 'coercive', autoFixable: true, category: 'motion' },
]

// ── Mithril Design System — 9 active rules ────────────────────────────────────

const mithrilDesignSystemRules: RulePackEntry[] = [
    { id: 'MITHRIL-COL', name: 'Color Token Drift', description: 'Detects hardcoded colors that deviate > ΔE 2.0 from the nearest design token using CIEDE2000 color distance.', defaultMode: 'coercive', autoFixable: true, category: 'color' },
    { id: 'MITHRIL-IST-COL', name: 'Inline Style Color', description: 'Inline style color values must map to a design token.', defaultMode: 'coercive', autoFixable: true, category: 'color' },
    { id: 'MITHRIL-IST-TYP', name: 'Inline Style Typography', description: 'Inline style font-family/font-size values must use design system typography tokens.', defaultMode: 'coercive', autoFixable: true, category: 'typography' },
    { id: 'MITHRIL-IST-SPC', name: 'Inline Style Spacing', description: 'Inline style spacing (margin/padding/gap) values must map to design system spacing tokens.', defaultMode: 'coercive', autoFixable: true, category: 'spacing' },
    { id: 'MITHRIL-IST-SHD', name: 'Inline Style Shadow', description: 'Inline style box-shadow values must map to design system shadow tokens.', defaultMode: 'coercive', autoFixable: true, category: 'shadow' },
    { id: 'MITHRIL-IST-OPC', name: 'Inline Style Opacity', description: 'Inline style opacity values must map to design system opacity tokens.', defaultMode: 'coercive', autoFixable: true, category: 'opacity' },
    { id: 'MITHRIL-SPC-001', name: 'Spacing Token Drift', description: 'Detects hardcoded spacing values (margin/padding/gap) that deviate from design system spacing tokens.', defaultMode: 'coercive', autoFixable: true, category: 'spacing' },
    { id: 'MITHRIL-SHD-001', name: 'Shadow Token Drift', description: 'Detects hardcoded box-shadow values that do not match a design system shadow token.', defaultMode: 'coercive', autoFixable: true, category: 'shadow' },
    { id: 'MITHRIL-OPC-001', name: 'Opacity Token Drift', description: 'Detects hardcoded opacity values that do not map to a design system opacity token.', defaultMode: 'coercive', autoFixable: true, category: 'opacity' },
]

// ── HIPAA UI — 6 available rules ──────────────────────────────────────────────

const hipaaUIRules: RulePackEntry[] = [
    { id: 'HIPAA-001', name: 'Session Timeout Warning Missing', description: 'PHI-bearing pages must display a session timeout warning before automatic logout.', regulation: 'HIPAA 164.312(a)(2)(iii)', defaultMode: 'coercive', autoFixable: false, category: 'session' },
    { id: 'HIPAA-002', name: 'PHI Field Masking', description: 'Sensitive PHI fields (SSN, DOB, MRN) must be masked by default with a reveal control.', regulation: 'HIPAA 164.312(a)(2)(iv)', defaultMode: 'coercive', autoFixable: false, category: 'privacy' },
    { id: 'HIPAA-003', name: 'MFA Indicator Missing', description: 'Authentication flows must include a visible multi-factor authentication step indicator.', regulation: 'HIPAA 164.312(d)', defaultMode: 'normative', autoFixable: false, category: 'authentication' },
    { id: 'HIPAA-004', name: 'Audit Log UI Access', description: 'HIPAA-covered applications must provide an accessible UI path to audit log review for authorized users.', regulation: 'HIPAA 164.312(b)', defaultMode: 'normative', autoFixable: false, category: 'audit' },
    { id: 'HIPAA-005', name: 'Privacy Notice Accessibility', description: 'Privacy notices and consent forms must be fully keyboard-accessible with proper heading structure.', regulation: 'HIPAA 164.520', defaultMode: 'coercive', autoFixable: false, category: 'accessibility' },
    { id: 'HIPAA-006', name: 'Autocomplete Off For PHI', description: 'Input fields collecting PHI must have autocomplete="off" to prevent browser caching of sensitive data.', regulation: 'HIPAA 164.312(a)(2)(iv)', defaultMode: 'coercive', autoFixable: true, category: 'forms' },
]

// ── WCAG 2.2 — 8 coming-soon rules ───────────────────────────────────────────

const wcag22Rules: RulePackEntry[] = [
    { id: 'A11Y-100', name: 'Dragging Movements Alternative', description: 'All functionality that uses dragging must be operable with a single pointer without dragging.', wcagCriterion: '2.5.7', defaultMode: 'coercive', autoFixable: false, category: 'pointer' },
    { id: 'A11Y-101', name: 'Target Size Minimum', description: 'The size of the target for pointer inputs must be at least 24x24 CSS pixels.', wcagCriterion: '2.5.8', defaultMode: 'coercive', autoFixable: false, category: 'pointer' },
    { id: 'A11Y-102', name: 'Focus Not Obscured (Minimum)', description: 'When a user interface component receives keyboard focus, the component is not entirely hidden due to author-created content.', wcagCriterion: '2.4.11', defaultMode: 'coercive', autoFixable: false, category: 'keyboard' },
    { id: 'A11Y-103', name: 'Focus Not Obscured (Enhanced)', description: 'When a user interface component receives keyboard focus, the component is fully visible.', wcagCriterion: '2.4.12', defaultMode: 'advisory', autoFixable: false, category: 'keyboard' },
    { id: 'A11Y-104', name: 'Focus Appearance', description: 'When the keyboard focus indicator is visible, the focus indicator must meet minimum size and contrast requirements.', wcagCriterion: '2.4.13', defaultMode: 'coercive', autoFixable: false, category: 'keyboard' },
    { id: 'A11Y-105', name: 'Accessible Authentication (Minimum)', description: 'A cognitive function test must not be the only means of authentication unless alternative is provided.', wcagCriterion: '3.3.8', defaultMode: 'coercive', autoFixable: false, category: 'forms' },
    { id: 'A11Y-106', name: 'Accessible Authentication (Enhanced)', description: 'A cognitive function test must not be required for any step in an authentication process.', wcagCriterion: '3.3.9', defaultMode: 'advisory', autoFixable: false, category: 'forms' },
    { id: 'A11Y-107', name: 'Redundant Entry', description: 'Information previously entered by or provided to the user that is required to be entered again must be auto-populated or available for selection.', wcagCriterion: '3.3.7', defaultMode: 'normative', autoFixable: false, category: 'forms' },
]

// ── GDPR Consent UI — 12 coming-soon rules ────────────────────────────────────

const gdprConsentRules: RulePackEntry[] = [
    { id: 'GDPR-001', name: 'Accept/Reject Button Parity', description: 'Consent UI must offer equally prominent accept and reject buttons — reject must not require more steps than accept.', regulation: 'GDPR Art. 7', defaultMode: 'coercive', autoFixable: false, category: 'consent' },
    { id: 'GDPR-002', name: 'Pre-Ticked Checkbox', description: 'Consent checkboxes must not be pre-ticked — silence or inactivity does not constitute consent.', regulation: 'GDPR Art. 7(2)', defaultMode: 'coercive', autoFixable: true, category: 'consent' },
    { id: 'GDPR-003', name: 'Dismiss Equals Consent', description: 'Closing a consent banner must not be treated as consent — a clear affirmative action is required.', regulation: 'GDPR Art. 7', defaultMode: 'coercive', autoFixable: false, category: 'consent' },
    { id: 'GDPR-004', name: 'Granular Consent Controls', description: 'Users must be able to grant or withhold consent for each distinct processing purpose independently.', regulation: 'GDPR Art. 7(2), Rec. 32', defaultMode: 'coercive', autoFixable: false, category: 'consent' },
    { id: 'GDPR-005', name: 'Script Blocking Before Consent', description: 'Third-party tracking scripts must not execute until explicit consent is granted.', regulation: 'GDPR Art. 6, ePrivacy', defaultMode: 'coercive', autoFixable: false, category: 'tracking' },
    { id: 'GDPR-006', name: 'GPC Signal Honored', description: 'The Global Privacy Control (GPC) signal must be respected as a valid opt-out signal.', regulation: 'GDPR, CCPA', defaultMode: 'normative', autoFixable: false, category: 'signals' },
    { id: 'GDPR-007', name: 'Consent Withdrawal Ease', description: 'Withdrawing consent must be as easy as giving it — no dark patterns in the withdrawal flow.', regulation: 'GDPR Art. 7(3)', defaultMode: 'coercive', autoFixable: false, category: 'consent' },
    { id: 'GDPR-008', name: 'Data Purpose Disclosure', description: 'Consent UI must clearly disclose each data processing purpose before consent is given.', regulation: 'GDPR Art. 13', defaultMode: 'coercive', autoFixable: false, category: 'transparency' },
    { id: 'GDPR-009', name: 'Third-Party Disclosure', description: 'Consent UI must list all third parties that will receive data as part of the consent.', regulation: 'GDPR Art. 13(1)(e)', defaultMode: 'normative', autoFixable: false, category: 'transparency' },
    { id: 'GDPR-010', name: 'Cookie Duration Disclosure', description: 'Cookie consent banners must disclose the retention period for each cookie category.', regulation: 'GDPR Art. 13(2)(a)', defaultMode: 'normative', autoFixable: false, category: 'transparency' },
    { id: 'GDPR-011', name: 'Legitimate Interest Toggle', description: 'Processing based on legitimate interest must provide a clear objection mechanism in the consent UI.', regulation: 'GDPR Art. 21', defaultMode: 'normative', autoFixable: false, category: 'consent' },
    { id: 'GDPR-012', name: 'Consent Record Link', description: 'Users must be able to access a record of their consent decisions from the privacy settings UI.', regulation: 'GDPR Art. 7(1)', defaultMode: 'advisory', autoFixable: false, category: 'consent' },
]

// ── CCPA Privacy — 6 coming-soon rules ───────────────────────────────────────

const ccpaPrivacyRules: RulePackEntry[] = [
    { id: 'CCPA-001', name: 'Do Not Sell Link', description: 'California-served UIs must include a "Do Not Sell or Share My Personal Information" link in the footer.', regulation: 'CCPA § 1798.135', defaultMode: 'coercive', autoFixable: false, category: 'opt-out' },
    { id: 'CCPA-002', name: 'Opt-Out Button Symmetry', description: 'Opt-out controls must be as visually prominent as opt-in controls — no asymmetric dark patterns.', regulation: 'CCPA § 1798.185(a)(4)', defaultMode: 'coercive', autoFixable: false, category: 'opt-out' },
    { id: 'CCPA-003', name: 'Two-Step Opt-Out Parity', description: 'If a two-step confirmation is required for opt-out, the same pattern must apply to opt-in.', regulation: 'CCPA § 1798.185', defaultMode: 'normative', autoFixable: false, category: 'opt-out' },
    { id: 'CCPA-004', name: 'GPC Signal Compliance', description: 'The Global Privacy Control (GPC) browser signal must be treated as a valid opt-out of sale/sharing.', regulation: 'CCPA § 1798.135(b)', defaultMode: 'coercive', autoFixable: false, category: 'signals' },
    { id: 'CCPA-005', name: 'Opt-Out Confirmation', description: 'Users must receive clear in-UI confirmation when their opt-out request has been processed.', regulation: 'CCPA § 1798.185(a)(1)', defaultMode: 'normative', autoFixable: false, category: 'opt-out' },
    { id: 'CCPA-006', name: 'Privacy Policy Link Visibility', description: 'A link to the full privacy policy must be present in the footer of every page served to California users.', regulation: 'CCPA § 1798.130', defaultMode: 'coercive', autoFixable: false, category: 'transparency' },
]

// ── PCI-DSS UI — 7 coming-soon rules ─────────────────────────────────────────

const pciDssUIRules: RulePackEntry[] = [
    { id: 'PCI-001', name: 'PAN Masking', description: 'Primary Account Numbers (PAN) must be masked in UI — only last 4 digits displayed.', regulation: 'PCI-DSS 3.4', defaultMode: 'coercive', autoFixable: false, category: 'data-masking' },
    { id: 'PCI-002', name: 'Script Integrity Attributes', description: 'Third-party scripts loaded on payment pages must have integrity and crossOrigin attributes.', regulation: 'PCI-DSS 6.4.3', defaultMode: 'coercive', autoFixable: true, category: 'security' },
    { id: 'PCI-003', name: 'Card Input Isolation', description: 'Card input fields must be isolated in an iframe or hosted field — not inline in the merchant page DOM.', regulation: 'PCI-DSS 4.2.1', defaultMode: 'coercive', autoFixable: false, category: 'payment' },
    { id: 'PCI-004', name: 'CVV Pattern Prohibition', description: 'CVV/CVC fields must have autocomplete="off" and must not persist values after form submission.', regulation: 'PCI-DSS 3.3', defaultMode: 'coercive', autoFixable: true, category: 'payment' },
    { id: 'PCI-005', name: 'Payment Page CSP Header', description: 'Payment pages must declare a Content Security Policy that restricts script-src and form-action.', regulation: 'PCI-DSS 6.4.1', defaultMode: 'normative', autoFixable: false, category: 'security' },
    { id: 'PCI-006', name: 'No Full PAN in URL', description: 'Payment card numbers must never appear in URL parameters, query strings, or browser history.', regulation: 'PCI-DSS 3.5.1', defaultMode: 'coercive', autoFixable: false, category: 'data-masking' },
    { id: 'PCI-007', name: 'Session Termination on Payment Complete', description: 'Payment sessions must be terminated and tokens invalidated after transaction completion.', regulation: 'PCI-DSS 8.2.6', defaultMode: 'normative', autoFixable: false, category: 'session' },
]

// ── COGA Cognitive — 8 coming-soon rules ──────────────────────────────────────

const cogaCognitiveRules: RulePackEntry[] = [
    { id: 'COGA-001', name: 'Visible Label Required', description: 'Form controls must have a visible label — placeholder text alone is not sufficient as a label.', wcagCriterion: '3.3.2', defaultMode: 'coercive', autoFixable: false, category: 'labels' },
    { id: 'COGA-002', name: 'Timeout Warning', description: 'When sessions have a time limit, users must be warned at least 20 seconds before timeout and given a way to extend.', wcagCriterion: '2.2.1', defaultMode: 'coercive', autoFixable: false, category: 'timing' },
    { id: 'COGA-003', name: 'Form Complexity Limit', description: 'Forms requiring more than 7 distinct input fields must be split across multiple focused steps.', defaultMode: 'advisory', autoFixable: false, category: 'forms' },
    { id: 'COGA-004', name: 'Clear Error Identification', description: 'Errors must be identified in text — color alone is not sufficient to indicate an error state.', wcagCriterion: '3.3.1', defaultMode: 'coercive', autoFixable: false, category: 'errors' },
    { id: 'COGA-005', name: 'Help Link Consistency', description: 'Help mechanisms (links, chat, phone numbers) must appear in the same location on every page.', wcagCriterion: '3.2.6', defaultMode: 'normative', autoFixable: false, category: 'navigation' },
    { id: 'COGA-006', name: 'Redundant Entry Avoidance', description: 'Users must not be asked to re-enter information they have already provided in the same session.', wcagCriterion: '3.3.7', defaultMode: 'normative', autoFixable: false, category: 'forms' },
    { id: 'COGA-007', name: 'Plain Language Preference', description: 'Error messages and instructions should use plain language at or below a 8th-grade reading level.', defaultMode: 'advisory', autoFixable: false, category: 'language' },
    { id: 'COGA-008', name: 'Input Purpose Autocomplete', description: 'Inputs collecting personal data must set the autocomplete attribute to help users with cognitive disabilities.', wcagCriterion: '1.3.5', defaultMode: 'normative', autoFixable: false, category: 'forms' },
]

// ---------------------------------------------------------------------------
// Rule Pack catalog
// ---------------------------------------------------------------------------

export const RULE_PACK_REGISTRY: RulePack[] = [
    // ── Active packs ─────────────────────────────────────────────────────────
    {
        id: 'wcag-2.1-aa',
        name: 'WCAG 2.1 Level AA',
        domain: 'accessibility',
        description: 'The 50 WCAG 2.1 Level AA rules enforced by Flint\'s A11y linter. Covers names/labels, keyboard, structure, ARIA, landmarks, contrast, forms, live regions, and motion. Required for ADA, EU EAA, AODA, DDA, and JIS compliance.',
        ruleCount: 50,
        rules: wcag21AARules,
        jurisdictions: ['US/ADA', 'EU/EAA', 'CA/AODA', 'AU/DDA', 'JP/JIS', 'UK/EQA'],
        preset: '@flint/wcag-2.1-aa',
        status: 'active',
    },
    {
        id: 'mithril-design-system',
        name: 'Mithril Design System',
        domain: 'brand',
        description: 'Design system governance rules using CIEDE2000 perceptual color distance. Enforces token conformance for color, typography, spacing, shadow, and opacity. Blocks hardcoded values that deviate > ΔE 2.0 from the design token palette.',
        ruleCount: 9,
        rules: mithrilDesignSystemRules,
        jurisdictions: [],
        preset: '@flint/mithril',
        status: 'active',
    },

    // ── Available packs ───────────────────────────────────────────────────────
    {
        id: 'brand-custom',
        name: 'Custom Brand Rules',
        domain: 'brand',
        description: 'Placeholder pack for project-specific brand governance rules. Enable this pack to define custom color palette enforcement, typography constraints, and component naming conventions unique to your design system.',
        ruleCount: 0,
        rules: [],
        jurisdictions: [],
        preset: '@flint/brand-custom',
        status: 'available',
    },
    {
        id: 'hipaa-ui',
        name: 'HIPAA UI Controls',
        domain: 'security',
        description: 'Six UI-layer rules for HIPAA compliance: session timeout warnings, PHI field masking, MFA step indicators, audit log access, privacy notice accessibility, and autocomplete-off for PHI fields.',
        ruleCount: 6,
        rules: hipaaUIRules,
        jurisdictions: ['US/HIPAA'],
        preset: '@flint/healthcare',
        status: 'available',
    },
    {
        id: 'section-508-report',
        name: 'Section 508 Reporting',
        domain: 'accessibility',
        description: 'Maps the existing WCAG 2.1 AA rules to Section 508 chapter references for US federal compliance reporting. Adds no new rules — generates Section 508 VPAT-compatible audit output from existing WCAG violations.',
        ruleCount: 0,
        rules: [],
        jurisdictions: ['US/Section508'],
        preset: '@flint/federal',
        status: 'available',
    },

    // ── Coming soon packs ─────────────────────────────────────────────────────
    {
        id: 'wcag-2.2',
        name: 'WCAG 2.2 New Criteria',
        domain: 'accessibility',
        description: 'Eight new success criteria added in WCAG 2.2 (October 2023): dragging movements alternative (2.5.7), target size minimum (2.5.8), focus not obscured (2.4.11/12), focus appearance (2.4.13), accessible authentication (3.3.8/9), and redundant entry (3.3.7).',
        ruleCount: 8,
        rules: wcag22Rules,
        jurisdictions: ['US/ADA', 'EU/EAA', 'CA/AODA', 'AU/DDA'],
        preset: '@flint/wcag-2.2',
        status: 'coming-soon',
    },
    {
        id: 'gdpr-consent',
        name: 'GDPR Consent UI',
        domain: 'privacy',
        description: 'Twelve rules covering GDPR consent UI requirements: button parity, pre-ticked checkbox prevention, dismiss-equals-consent detection, granular consent, script blocking, GPC signal compliance, withdrawal ease, and transparency disclosures.',
        ruleCount: 12,
        rules: gdprConsentRules,
        jurisdictions: ['EU/GDPR', 'UK/GDPR', 'EU/ePrivacy'],
        preset: '@flint/gdpr',
        status: 'coming-soon',
    },
    {
        id: 'ccpa-privacy',
        name: 'CCPA Privacy Controls',
        domain: 'privacy',
        description: 'Six CCPA-required UI controls: "Do Not Sell" link presence, opt-out button symmetry, two-step parity, GPC signal compliance, opt-out confirmation, and privacy policy link visibility.',
        ruleCount: 6,
        rules: ccpaPrivacyRules,
        jurisdictions: ['US/CCPA', 'US/CPRA'],
        preset: '@flint/ccpa',
        status: 'coming-soon',
    },
    {
        id: 'pci-dss-ui',
        name: 'PCI-DSS UI Controls',
        domain: 'security',
        description: 'Seven PCI-DSS UI-layer rules: PAN masking, script integrity attributes, card input isolation, CVV autocomplete prohibition, CSP declaration, no full PAN in URL, and session termination on payment complete.',
        ruleCount: 7,
        rules: pciDssUIRules,
        jurisdictions: ['PCI/DSS-v4'],
        preset: '@flint/payment',
        status: 'coming-soon',
    },
    {
        id: 'coga-cognitive',
        name: 'Cognitive Accessibility (COGA)',
        domain: 'cognitive',
        description: 'Eight cognitive accessibility rules aligned with WCAG 2.1/2.2 and W3C COGA guidance: visible labels, timeout warnings, form complexity limits, clear error identification, help link consistency, redundant entry avoidance, plain language, and autocomplete for personal data.',
        ruleCount: 8,
        rules: cogaCognitiveRules,
        jurisdictions: ['EU/EAA', 'US/ADA'],
        preset: '@flint/cognitive',
        status: 'coming-soon',
    },
]

// ---------------------------------------------------------------------------
// Accessor functions
// ---------------------------------------------------------------------------

/** Look up a single pack by its id. Returns undefined if not found. */
export function getPackById(id: string): RulePack | undefined {
    return RULE_PACK_REGISTRY.find((p) => p.id === id)
}

/** Return all packs matching a given domain. */
export function getPacksByDomain(domain: string): RulePack[] {
    return RULE_PACK_REGISTRY.filter((p) => p.domain === domain)
}

/** Return all packs that cover a given jurisdiction string. */
export function getPacksByJurisdiction(jurisdiction: string): RulePack[] {
    return RULE_PACK_REGISTRY.filter((p) =>
        p.jurisdictions.some((j) => j === jurisdiction),
    )
}

// ---------------------------------------------------------------------------
// Reverse-lookup: rule ID → owning pack
// ---------------------------------------------------------------------------

/**
 * Lazy-memoized reverse index from rule ID to the pack that owns it.
 * Built on the first call to findPackForRule; not rebuilt on subsequent calls.
 */
let reverseIndex: Map<string, RulePack> | null = null

/**
 * Tracks rule IDs for which a duplicate-pack-ownership warning has already
 * been emitted, so we warn at most once per conflicting rule ID.
 */
const warnedDuplicateRuleIds = new Set<string>()

/**
 * Find the rule pack that owns a given rule ID.
 *
 * When multiple packs declare the same rule ID the first pack in
 * RULE_PACK_REGISTRY wins and a `console.warn` is emitted (once per
 * duplicate rule ID).
 *
 * @param ruleId - Rule identifier, e.g. "A11Y-001" or "MITHRIL-COL"
 * @returns The owning RulePack, or null if no pack claims the rule ID.
 */
export function findPackForRule(ruleId: string): RulePack | null {
    if (reverseIndex === null) {
        reverseIndex = new Map<string, RulePack>()
        for (const pack of RULE_PACK_REGISTRY) {
            for (const rule of pack.rules) {
                if (reverseIndex.has(rule.id)) {
                    if (!warnedDuplicateRuleIds.has(rule.id)) {
                        const firstPack = reverseIndex.get(rule.id)!
                        console.warn(
                            `[rulePackRegistry] Duplicate rule ID "${rule.id}" found in packs ` +
                            `"${firstPack.id}" and "${pack.id}". Returning first match.`,
                        )
                        warnedDuplicateRuleIds.add(rule.id)
                    }
                    // Keep the first match — do not overwrite.
                } else {
                    reverseIndex.set(rule.id, pack)
                }
            }
        }
    }
    return reverseIndex.get(ruleId) ?? null
}

/**
 * Reset the memoized reverse index and warned-duplicate tracking.
 * Intended for use in unit tests only — do not call in production code.
 * @internal
 */
export function _resetReverseIndexForTesting(): void {
    reverseIndex = null
    warnedDuplicateRuleIds.clear()
}

// ---------------------------------------------------------------------------

/**
 * Read flint.config.yaml and return the list of active pack IDs based on the
 * `extends` field. Falls back to ['wcag-2.1-aa', 'mithril-design-system']
 * when no config is found (default active packs).
 */
export function getActivePackIds(projectRoot: string): string[] {
    const defaults = () =>
        RULE_PACK_REGISTRY.filter((p) => p.status === 'active').map((p) => p.id)

    const configPath = path.join(projectRoot, 'flint.config.yaml')
    if (!fs.existsSync(configPath)) {
        return defaults()
    }

    try {
        // Use the proper YAML parser instead of regex (MAJOR-9 fix).
        // YAML spec disallows unquoted `@` at scalar start, but `@flint/`
        // preset refs are idiomatic in Flint configs. Preprocess to quote them.
        const raw = fs.readFileSync(configPath, 'utf-8')
        const sanitized = raw
            // Block sequence: `  - @flint/foo` → `  - "@flint/foo"`
            .replace(/^(\s*-\s*)(@flint\/[^\s,\]]+)/gm, '$1"$2"')
            // Inline array: `[@flint/foo, @flint/bar]` → `["@flint/foo", "@flint/bar"]`
            .replace(/(?<=[\[,]\s*)(@flint\/[^\s,\]]+)/g, '"$1"')
        const parsed = parseYaml(sanitized)

        if (!parsed || typeof parsed !== 'object') {
            return defaults()
        }

        const extendsRefs = parsed.extends
        if (!extendsRefs || !Array.isArray(extendsRefs)) {
            return defaults()
        }

        if (extendsRefs.length === 0) {
            return []
        }

        const activeIds: string[] = []
        for (const pack of RULE_PACK_REGISTRY) {
            if (!pack.preset) continue
            if (extendsRefs.includes(pack.preset)) activeIds.push(pack.id)
        }
        return activeIds
    } catch {
        return defaults()
    }
}
