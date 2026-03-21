/**
 * governanceRulesManifest.ts — src/core/governanceRulesManifest.ts
 *
 * Static list of all 49 governance rules known to Flint.
 * The GovernanceStore only tracks *overrides* from these defaults —
 * this manifest is the single source of truth for display metadata.
 */

export type RuleSeverity = 'critical' | 'warning' | 'info'

/**
 * `status: 'active'`  — rule has a corresponding linter that actually fires violations.
 * `status: 'planned'` — rule is declared for roadmap visibility but has no linter enforcement yet.
 */
export type RuleStatus = 'active' | 'planned'

export interface GovernanceRule {
    id: string
    name: string
    category: string
    defaultSeverity: RuleSeverity
    status: RuleStatus
}

export const GOVERNANCE_RULES_MANIFEST: GovernanceRule[] = [
    // ── Accessibility ──────────────────────────────────────────────────────────
    // A11Y-001..006 and A11Y-010: src/core/A11yLinter.ts
    // A11Y-007..009: src/core/A11yLinter.ts (A11Y-007 = tabIndex, A11Y-008 = table, A11Y-009 = html lang)
    { id: 'A11Y-001', name: 'Image Missing Alt Text', category: 'Accessibility', defaultSeverity: 'critical', status: 'active' },
    { id: 'A11Y-002', name: 'Button Missing Label', category: 'Accessibility', defaultSeverity: 'critical', status: 'active' },
    { id: 'A11Y-003', name: 'Link Missing Text', category: 'Accessibility', defaultSeverity: 'critical', status: 'active' },
    { id: 'A11Y-004', name: 'Form Input Missing Label', category: 'Accessibility', defaultSeverity: 'critical', status: 'active' },
    { id: 'A11Y-005', name: 'Select Missing Label', category: 'Accessibility', defaultSeverity: 'critical', status: 'active' },
    { id: 'A11Y-006', name: 'Textarea Missing Label', category: 'Accessibility', defaultSeverity: 'critical', status: 'active' },
    { id: 'A11Y-007', name: 'Positive tabIndex Detected', category: 'Accessibility', defaultSeverity: 'warning', status: 'active' },
    { id: 'A11Y-008', name: 'Table Missing Accessible Summary', category: 'Accessibility', defaultSeverity: 'warning', status: 'active' },
    { id: 'A11Y-009', name: 'HTML Missing Lang Attribute', category: 'Accessibility', defaultSeverity: 'critical', status: 'active' },
    { id: 'A11Y-010', name: 'Heading Level Skipped', category: 'Accessibility', defaultSeverity: 'info', status: 'active' },
    // ── Color ──────────────────────────────────────────────────────────────────
    // MITHRIL-COL: src/core/MithrilLinter.ts visitClassNames — emits ruleId 'MITHRIL-COL'
    { id: 'MITHRIL-COL', name: 'Arbitrary Color Class (Color Drift)', category: 'Color', defaultSeverity: 'warning', status: 'active' },
    // ── Typography ────────────────────────────────────────────────────────────
    { id: 'MITHRIL-TYP-001', name: 'Arbitrary Font Family', category: 'Typography', defaultSeverity: 'warning', status: 'active' },
    { id: 'MITHRIL-TYP-002', name: 'Arbitrary Font Size', category: 'Typography', defaultSeverity: 'warning', status: 'active' },
    { id: 'MITHRIL-TYP-003', name: 'Arbitrary Font Weight', category: 'Typography', defaultSeverity: 'warning', status: 'active' },
    { id: 'MITHRIL-TYP-004', name: 'Arbitrary Line Height', category: 'Typography', defaultSeverity: 'warning', status: 'active' },
    { id: 'MITHRIL-TYP-005', name: 'Arbitrary Letter Spacing', category: 'Typography', defaultSeverity: 'warning', status: 'active' },
    // ── Spacing ───────────────────────────────────────────────────────────────
    { id: 'MITHRIL-SPC-001', name: 'Arbitrary Spacing Value', category: 'Spacing', defaultSeverity: 'warning', status: 'active' },
    // ── Effects ───────────────────────────────────────────────────────────────
    { id: 'MITHRIL-SHD-001', name: 'Arbitrary Shadow Value', category: 'Effects', defaultSeverity: 'warning', status: 'active' },
    { id: 'MITHRIL-OPC-001', name: 'Arbitrary Opacity Value', category: 'Effects', defaultSeverity: 'warning', status: 'active' },
    // ── Brand ─────────────────────────────────────────────────────────────────
    { id: 'BRAND-TYP-001', name: 'Text Too Small', category: 'Brand', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-TYP-002', name: 'Empty Heading', category: 'Brand', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-TYP-003', name: 'Uppercase Body Text', category: 'Brand', defaultSeverity: 'info', status: 'planned' },
    { id: 'BRAND-TYP-004', name: 'Truncate Without Title', category: 'Brand', defaultSeverity: 'info', status: 'planned' },
    // ── Layout ────────────────────────────────────────────────────────────────
    { id: 'BRAND-LAY-001', name: 'Touch Target Too Small', category: 'Layout', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-LAY-002', name: 'Excessive Z-Index', category: 'Layout', defaultSeverity: 'info', status: 'planned' },
    { id: 'BRAND-LAY-003', name: 'Negative Margin Usage', category: 'Layout', defaultSeverity: 'info', status: 'planned' },
    { id: 'BRAND-LAY-004', name: 'Missing Max-Width Constraint', category: 'Layout', defaultSeverity: 'info', status: 'planned' },
    { id: 'BRAND-LAY-005', name: 'Non-Standard Border Radius', category: 'Layout', defaultSeverity: 'info', status: 'planned' },
    { id: 'BRAND-LAY-006', name: 'Non-Standard Border Width', category: 'Layout', defaultSeverity: 'info', status: 'planned' },
    // ── Components ────────────────────────────────────────────────────────────
    { id: 'BRAND-CMP-001', name: 'Image Missing Dimensions', category: 'Components', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-CMP-002', name: 'Button Color-Only Indication', category: 'Components', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-CMP-003', name: 'Inline Event Handler', category: 'Components', defaultSeverity: 'critical', status: 'planned' },
    { id: 'BRAND-CMP-004', name: 'Input Missing Type', category: 'Components', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-CMP-005', name: 'Link Opens New Tab Without Warning', category: 'Components', defaultSeverity: 'critical', status: 'planned' },
    { id: 'BRAND-CMP-006', name: 'Form Missing Name', category: 'Components', defaultSeverity: 'warning', status: 'planned' },
    // ── Content ───────────────────────────────────────────────────────────────
    { id: 'BRAND-CNT-001', name: 'Lorem Ipsum Placeholder Text', category: 'Content', defaultSeverity: 'critical', status: 'planned' },
    { id: 'BRAND-CNT-002', name: 'TODO/FIXME Comment in Production', category: 'Content', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-CNT-003', name: 'Hardcoded Email Address', category: 'Content', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-CNT-004', name: 'Hardcoded Phone Number', category: 'Content', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-CNT-005', name: 'Hardcoded Copyright Year', category: 'Content', defaultSeverity: 'warning', status: 'planned' },
    // ── Motion ────────────────────────────────────────────────────────────────
    { id: 'BRAND-MOT-001', name: 'Animation Without Reduced-Motion Fallback', category: 'Motion', defaultSeverity: 'warning', status: 'planned' },
    { id: 'BRAND-MOT-002', name: 'Excessive Animation Duration', category: 'Motion', defaultSeverity: 'info', status: 'planned' },
    { id: 'BRAND-MOT-003', name: 'Non-Standard Transition Timing', category: 'Motion', defaultSeverity: 'info', status: 'planned' },
    // ── Quality ───────────────────────────────────────────────────────────────
    { id: 'QUAL-001', name: 'Placeholder Test Selector', category: 'Quality', defaultSeverity: 'warning', status: 'planned' },
    { id: 'QUAL-002', name: 'Simultaneous Loading and Error State', category: 'Quality', defaultSeverity: 'warning', status: 'planned' },
    { id: 'QUAL-003', name: 'aria-disabled Without Tooltip', category: 'Quality', defaultSeverity: 'info', status: 'planned' },
    { id: 'QUAL-004', name: 'Inline Pixel Style', category: 'Quality', defaultSeverity: 'info', status: 'planned' },
    { id: 'QUAL-005', name: 'SVG Missing aria-hidden', category: 'Quality', defaultSeverity: 'info', status: 'planned' },
]

/** All distinct category names in display order. */
export const GOVERNANCE_CATEGORIES = [
    'Accessibility',
    'Color',
    'Typography',
    'Spacing',
    'Effects',
    'Brand',
    'Layout',
    'Components',
    'Content',
    'Motion',
    'Quality',
] as const

export type GovernanceCategory = (typeof GOVERNANCE_CATEGORIES)[number]
