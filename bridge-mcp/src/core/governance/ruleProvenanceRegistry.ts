/**
 * ruleProvenanceRegistry — bridge-mcp/src/core/governance/ruleProvenanceRegistry.ts
 *
 * Static provenance registry mapping every known ruleId to its regulatory
 * metadata. This is the single source of truth for GOV.1 (Rule Provenance).
 *
 * Rules not present in this map receive a fallback provenance with
 * sourceAuthority: 'Bridge Design System' and regulatoryReference: 'N/A'.
 *
 * All 20 rules enforced by Bridge MCP v1 are registered here:
 *   - 10 A11y rules (A11Y-001..010)   — WCAG 2.1 AA
 *   - 5  Mithril typography rules (MITHRIL-TYP-001..005)
 *   - 1  Mithril color rule (MITHRIL-COL)
 *   - 1  Mithril spacing rule (MITHRIL-SPC-001)
 *   - 1  Mithril shadow rule (MITHRIL-SHD-001)
 *   - 1  Mithril opacity rule (MITHRIL-OPC-001)
 *   - 1  Export gate rule (EXP-001)
 */

import type { RuleProvenance, ComplianceSummary, SourceAuthority } from './types.js'

// ── Static provenance map ──────────────────────────────────────────────────────

/**
 * Static provenance registry. Key is the stable ruleId string.
 * Entries are ordered: A11y rules first, then Mithril, then system.
 */
export const RULE_PROVENANCE_REGISTRY: ReadonlyMap<string, RuleProvenance> = new Map([

    // ── Accessibility rules (WCAG 2.1 AA) ─────────────────────────────────────

    ['A11Y-001', {
        ruleId: 'A11Y-001',
        ruleName: 'Image Missing Alt Text',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.1.1 (Non-text Content)',
        lastUpdated: '2025-06-05',
        rationale: 'Images must have text alternatives so screen reader users receive equivalent information.',
    }],

    ['A11Y-002', {
        ruleId: 'A11Y-002',
        ruleName: 'Button Missing Accessible Name',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 4.1.2 (Name, Role, Value)',
        lastUpdated: '2025-06-05',
        rationale: 'Buttons must have an accessible name so assistive technology can identify their purpose.',
    }],

    ['A11Y-003', {
        ruleId: 'A11Y-003',
        ruleName: 'Anchor Missing Accessible Name',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 2.4.4 (Link Purpose)',
        lastUpdated: '2025-06-05',
        rationale: 'Links must have descriptive text or aria-label so users understand where they navigate.',
    }],

    ['A11Y-004', {
        ruleId: 'A11Y-004',
        ruleName: 'Input Missing Programmatic Label',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Form inputs must be programmatically linked to a visible or screen-reader-accessible label.',
    }],

    ['A11Y-005', {
        ruleId: 'A11Y-005',
        ruleName: 'Select Missing Accessible Label',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Select elements must have an accessible label so screen reader users can identify the control.',
    }],

    ['A11Y-006', {
        ruleId: 'A11Y-006',
        ruleName: 'Textarea Missing Accessible Label',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Textarea elements must be labelled so assistive technology can identify their purpose.',
    }],

    ['A11Y-007', {
        ruleId: 'A11Y-007',
        ruleName: 'Positive tabIndex Disrupts Tab Order',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 2.4.3 (Focus Order)',
        lastUpdated: '2025-06-05',
        rationale: 'tabIndex values greater than 0 create an unintuitive keyboard navigation order.',
    }],

    ['A11Y-008', {
        ruleId: 'A11Y-008',
        ruleName: 'Table Missing Accessible Summary',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Data tables need an accessible summary (<caption> or aria-label) for screen reader orientation.',
    }],

    ['A11Y-009', {
        ruleId: 'A11Y-009',
        ruleName: 'HTML Element Missing Lang Attribute',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 3.1.1 (Language of Page)',
        lastUpdated: '2025-06-05',
        rationale: 'The html element must declare its language so screen readers use the correct pronunciation rules.',
    }],

    ['A11Y-010', {
        ruleId: 'A11Y-010',
        ruleName: 'Heading Levels Skipped',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.3.1 (Info and Relationships)',
        lastUpdated: '2025-06-05',
        rationale: 'Heading levels must be sequential to allow screen reader users to navigate document structure.',
    }],

    // ── Mithril color rule ─────────────────────────────────────────────────────

    ['MITHRIL-COL', {
        ruleId: 'MITHRIL-COL',
        ruleName: 'Color Drift from Design Token (CIEDE2000)',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Color Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Arbitrary color values that deviate more than ΔE 2.0 from the nearest design token create visual inconsistency and brand drift.',
    }],

    // ── Mithril typography rules ───────────────────────────────────────────────

    ['MITHRIL-TYP-001', {
        ruleId: 'MITHRIL-TYP-001',
        ruleName: 'Arbitrary Font Family Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Font families must be sourced from design tokens to maintain typographic consistency across the product.',
    }],

    ['MITHRIL-TYP-002', {
        ruleId: 'MITHRIL-TYP-002',
        ruleName: 'Arbitrary Font Size Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Font sizes must map to dimension tokens to preserve the typographic scale.',
    }],

    ['MITHRIL-TYP-003', {
        ruleId: 'MITHRIL-TYP-003',
        ruleName: 'Arbitrary Font Weight Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Font weights must be sourced from design tokens to ensure consistent text emphasis.',
    }],

    ['MITHRIL-TYP-004', {
        ruleId: 'MITHRIL-TYP-004',
        ruleName: 'Arbitrary Line Height Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Line heights must come from tokens so vertical rhythm is preserved across the design system.',
    }],

    ['MITHRIL-TYP-005', {
        ruleId: 'MITHRIL-TYP-005',
        ruleName: 'Arbitrary Letter Spacing Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Typography Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Letter spacing must use design tokens to maintain consistent tracking across typefaces.',
    }],

    // ── Mithril spacing rule ───────────────────────────────────────────────────

    ['MITHRIL-SPC-001', {
        ruleId: 'MITHRIL-SPC-001',
        ruleName: 'Arbitrary Spacing Value Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Spacing Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Margin, padding, gap, and dimension values must be sourced from dimension tokens to maintain spatial rhythm.',
    }],

    // ── Mithril shadow rule ────────────────────────────────────────────────────

    ['MITHRIL-SHD-001', {
        ruleId: 'MITHRIL-SHD-001',
        ruleName: 'Arbitrary Box Shadow Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Shadow Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Box shadow values must come from shadow tokens to preserve elevation consistency.',
    }],

    // ── Mithril opacity rule ───────────────────────────────────────────────────

    ['MITHRIL-OPC-001', {
        ruleId: 'MITHRIL-OPC-001',
        ruleName: 'Arbitrary Opacity Not in Token Set',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Design System — Opacity Token Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Opacity values must be sourced from tokens to ensure consistent transparency levels.',
    }],

    // ── Export gate rule ───────────────────────────────────────────────────────

    ['EXP-001', {
        ruleId: 'EXP-001',
        ruleName: 'Export Blocked — Active Governance Violations',
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'Bridge Governance — Export Gate Contract',
        lastUpdated: '2025-06-05',
        rationale: 'Exports are blocked when active Mithril or A11y violations remain unresolved to prevent non-compliant code from reaching production.',
    }],
])

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve provenance for a ruleId. Returns a fallback provenance
 * when the ruleId is not in the registry (unknown or custom rules).
 */
export function resolveProvenance(ruleId: string): RuleProvenance {
    return RULE_PROVENANCE_REGISTRY.get(ruleId) ?? {
        ruleId,
        ruleName: ruleId,
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'N/A',
        lastUpdated: new Date().toISOString().slice(0, 10),
        rationale: 'Custom or unregistered rule.',
    }
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
