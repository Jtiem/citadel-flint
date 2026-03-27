/**
 * rulePackRegistryClient.ts — src/core/rulePackRegistryClient.ts
 *
 * Lightweight renderer-side mirror of the MCP rule pack registry.
 * Contains ONLY pack metadata (names, domains, rule counts, statuses)
 * NOT the full rule implementations — those live in flint-mcp/src/core/.
 *
 * This module exists because the renderer cannot import across the
 * process boundary (Commandment 14). The MCP server owns the authoritative
 * rulePackRegistry.ts; this client module is a ~2 KB static snapshot
 * of pack metadata for use in Glass UI components.
 *
 * Mithril Safety: no styling — pure data module.
 */

// ── Types (renderer-side mirror of contract 3a) ────────────────────────────

export type ComplianceDomain =
    | 'accessibility'
    | 'privacy'
    | 'security'
    | 'brand'
    | 'cognitive'
    | 'design-system'

export type PackStatus = 'active' | 'available' | 'coming-soon'

export interface RulePackClient {
    /** Unique pack identifier, e.g. "wcag-2.1-aa" */
    id: string
    /** Human-readable display name */
    name: string
    /** Compliance domain this pack addresses */
    domain: ComplianceDomain
    /** Short description of the pack's purpose */
    description: string
    /** Total rules in the pack */
    ruleCount: number
    /** Jurisdictions this pack addresses, e.g. ["US/ADA", "EU/EAA"] */
    jurisdictions: string[]
    /** The @flint/ preset that enables this pack, if any */
    preset?: string
    /** Availability status */
    status: PackStatus
}

// ── Static registry ────────────────────────────────────────────────────────

export const RULE_PACK_REGISTRY: RulePackClient[] = [
    // ── Accessibility ──────────────────────────────────────────────────────
    {
        id: 'wcag-2.1-aa',
        name: 'WCAG 2.1 AA',
        domain: 'accessibility',
        description: '50 rules covering perceivability, operability, understandability, and robustness for the WCAG 2.1 Level AA standard.',
        ruleCount: 50,
        jurisdictions: ['US/ADA', 'EU/EAA', 'US/Section508'],
        preset: '@flint/wcag-aa',
        status: 'active',
    },
    {
        id: 'wcag-2.2',
        name: 'WCAG 2.2',
        domain: 'accessibility',
        description: '8 new success criteria from WCAG 2.2 covering focus appearance, target size, and redundant entry.',
        ruleCount: 8,
        jurisdictions: ['US/ADA', 'EU/EAA'],
        preset: '@flint/wcag-2.2',
        status: 'coming-soon',
    },
    {
        id: 'coga-cognitive',
        name: 'COGA Cognitive Accessibility',
        domain: 'cognitive',
        description: '8 rules addressing cognitive accessibility guidance from the W3C COGA Task Force.',
        ruleCount: 8,
        jurisdictions: ['EU/EAA'],
        preset: '@flint/coga',
        status: 'coming-soon',
    },

    // ── Privacy ────────────────────────────────────────────────────────────
    {
        id: 'gdpr-consent',
        name: 'GDPR Consent Patterns',
        domain: 'privacy',
        description: '12 rules enforcing correct consent UI patterns, cookie banners, and data subject rights flows per GDPR.',
        ruleCount: 12,
        jurisdictions: ['EU/GDPR'],
        preset: '@flint/gdpr',
        status: 'coming-soon',
    },
    {
        id: 'ccpa-cpra',
        name: 'CCPA/CPRA Privacy',
        domain: 'privacy',
        description: '6 rules for California Consumer Privacy Act / CPRA UI requirements including opt-out flows.',
        ruleCount: 6,
        jurisdictions: ['US/CCPA'],
        preset: '@flint/ccpa',
        status: 'coming-soon',
    },

    // ── Security ───────────────────────────────────────────────────────────
    {
        id: 'hipaa-phi',
        name: 'HIPAA UI',
        domain: 'security',
        description: '6 rules for healthcare UI compliance — PHI display, session timeout, and secure form patterns.',
        ruleCount: 6,
        jurisdictions: ['US/HIPAA'],
        preset: '@flint/healthcare',
        status: 'available',
    },
    {
        id: 'pci-dss-ui',
        name: 'PCI-DSS UI',
        domain: 'security',
        description: '7 rules for payment card industry UI — masked card fields, secure input indicators, and form hardening.',
        ruleCount: 7,
        jurisdictions: ['US/PCI-DSS'],
        preset: '@flint/fintech',
        status: 'coming-soon',
    },

    // ── Brand / Design System ──────────────────────────────────────────────
    {
        id: 'mithril-design-system',
        name: 'Mithril Design System',
        domain: 'brand',
        description: '9 rules enforcing CIEDE2000 ΔE color accuracy, token-bound spacing, typography, shadow, and opacity.',
        ruleCount: 9,
        jurisdictions: [],
        preset: '@flint/mithril',
        status: 'active',
    },
    {
        id: 'custom-brand-rules',
        name: 'Custom Brand Rules',
        domain: 'brand',
        description: 'Project-specific brand governance rules defined in your local flint.config.yaml.',
        ruleCount: 0,
        jurisdictions: [],
        status: 'available',
    },
]

// ── Domain grouping helpers ────────────────────────────────────────────────

export const DOMAIN_LABELS: Record<ComplianceDomain, string> = {
    accessibility: 'Accessibility',
    privacy: 'Privacy',
    security: 'Security',
    brand: 'Brand',
    cognitive: 'Cognitive',
    'design-system': 'Design System',
}

/** Returns all unique domains present in the registry, in a stable display order. */
export const ORDERED_DOMAINS: ComplianceDomain[] = [
    'accessibility',
    'cognitive',
    'privacy',
    'security',
    'brand',
    'design-system',
]

/** Groups packs by domain, in ORDERED_DOMAINS order. */
export function groupPacksByDomain(
    packs: RulePackClient[],
): Array<{ domain: ComplianceDomain; label: string; packs: RulePackClient[] }> {
    const result: Array<{ domain: ComplianceDomain; label: string; packs: RulePackClient[] }> = []

    for (const domain of ORDERED_DOMAINS) {
        const domainPacks = packs.filter((p) => p.domain === domain)
        if (domainPacks.length > 0) {
            result.push({
                domain,
                label: DOMAIN_LABELS[domain],
                packs: domainPacks,
            })
        }
    }

    return result
}

/** Returns all unique jurisdictions from the registry. */
export function getAllJurisdictions(): string[] {
    const seen = new Set<string>()
    for (const pack of RULE_PACK_REGISTRY) {
        for (const j of pack.jurisdictions) {
            seen.add(j)
        }
    }
    return Array.from(seen).sort()
}

/**
 * Derives per-jurisdiction coverage from the active packs and the registry.
 * Returns a map of jurisdiction -> { covered, total }.
 *
 * "total" = total rules across all packs addressing that jurisdiction.
 * "covered" = rules from packs that are currently active.
 */
export function computeJurisdictionCoverage(
    activePresets: string[],
): Record<string, { covered: number; total: number }> {
    const result: Record<string, { covered: number; total: number }> = {}

    for (const pack of RULE_PACK_REGISTRY) {
        for (const jurisdiction of pack.jurisdictions) {
            if (!result[jurisdiction]) {
                result[jurisdiction] = { covered: 0, total: 0 }
            }
            result[jurisdiction].total += pack.ruleCount

            // A pack is "active" if its preset is in activePresets OR its status is 'active'
            const isActive =
                pack.status === 'active' ||
                (pack.preset !== undefined && activePresets.includes(pack.preset))

            if (isActive) {
                result[jurisdiction].covered += pack.ruleCount
            }
        }
    }

    return result
}
