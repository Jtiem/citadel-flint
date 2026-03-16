/**
 * DBOM Types — bridge-mcp/src/core/dbom/types.ts
 *
 * Design Bill of Materials (DBOM) — machine-readable manifest of all design
 * tokens, their usage, component compliance, and governance status.
 *
 * Analogous to a Software Bill of Materials (SBOM, e.g. Snyk) but for design
 * system governance: tokens instead of packages, Mithril/A11y violations
 * instead of CVEs, token coverage instead of dependency health.
 *
 * Version: 1.0
 */

// ── DBOM Root ────────────────────────────────────────────────────────────────

export interface DesignBillOfMaterials {
    /** Schema version. Always '1.0'. */
    version: '1.0'
    /** ISO 8601 UTC timestamp of when this DBOM was generated. */
    generatedAt: string
    /** Absolute path to the project root that was scanned. */
    projectRoot: string

    /** Governance policy settings in effect at generation time. */
    policy: DBOMPolicy

    /** Project-wide summary statistics. */
    summary: DBOMSummary

    /** All design tokens defined in the project's token store. */
    tokens: DBOMToken[]

    /** Per-component compliance analysis. */
    components: DBOMComponent[]

    /**
     * Active component property overrides from the component_overrides table.
     * Each entry is a value that has been manually overridden outside the
     * design token system and represents an unresolved export blocker.
     */
    overrides: DBOMOverride[]

    /**
     * Baseline comparison data.
     * Present only when a violation baseline has been set via the baseline API.
     */
    baseline?: DBOMBaseline
}

// ── Policy ────────────────────────────────────────────────────────────────────

/** Governance policy settings captured at DBOM generation time. */
export interface DBOMPolicy {
    /** ΔE threshold for amber-level Mithril color drift violations. */
    deltaE_threshold: number
    /** WCAG conformance level in force (A, AA, AAA). */
    a11y_level: string
    /** Mithril enforcement mode: 'blocking' | 'advisory' | 'off'. */
    mode: string
}

// ── Summary ───────────────────────────────────────────────────────────────────

/** Project-wide aggregate statistics. */
export interface DBOMSummary {
    /** Number of source files scanned. */
    totalFiles: number
    /** Number of unique component names discovered. */
    totalComponents: number
    /** Number of tokens in the project's design token store. */
    totalTokens: number
    /** Health score (0-100). Formula: 100 - (criticals×10 + warnings×3). */
    healthScore: number
    /** Letter grade derived from healthScore: A (90-100), B (80-89), C (70-79), D (60-69), F (<60). */
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    /** Overall compliance status derived from violation severity distribution. */
    complianceStatus: 'compliant' | 'non-compliant' | 'partial'
}

// ── Token ─────────────────────────────────────────────────────────────────────

/** A design token entry with usage provenance data. */
export interface DBOMToken {
    /** Dot-separated token path (e.g. 'colors.brand.primary'). */
    path: string
    /** Token type: 'color' | 'dimension' | 'fontFamily' | 'fontWeight' | etc. */
    type: string
    /** Raw token value (e.g. '#1A73E8', '16px', 'Inter'). */
    value: string
    /**
     * Collection name the token belongs to (from the token store).
     * Tokens ingested from Figma carry their collection name; manually created
     * tokens use 'default'.
     */
    collection: string
    /**
     * Number of components that reference this token.
     * A token with usageCount=0 is a "dead token" — not referenced anywhere
     * in the scanned codebase.
     */
    usageCount: number
    /** Relative file paths where this token's CSS class is detected. */
    usedIn: string[]
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Per-component compliance analysis result. */
export interface DBOMComponent {
    /** Absolute path to the source file. */
    filePath: string
    /**
     * Component name inferred from the filename (PascalCase basename without
     * extension, e.g. 'Button', 'HeroSection').
     */
    name: string
    /** Mithril governance violations found in this component. */
    violations: DBOMViolation[]
    /** Accessibility violations found in this component. */
    a11yViolations: DBOMA11yViolation[]
    /**
     * Percentage of className values that use design system token-derived
     * classes vs arbitrary CSS values. Range: 0-100.
     *
     * Formula: tokenClasses / totalClasses * 100, rounded to one decimal.
     * A component with 100% tokenCoverage uses no arbitrary values.
     */
    tokenCoverage: number
    /**
     * Rolled-up status for this component.
     *   'clean'    — no violations of any kind.
     *   'warning'  — only amber-severity Mithril violations.
     *   'critical' — at least one critical Mithril violation OR any A11y violation.
     */
    status: 'clean' | 'warning' | 'critical'
}

/** A Mithril design-system governance violation on a specific node. */
export interface DBOMViolation {
    /** Bridge rule identifier (e.g. 'MITHRIL-COL', 'MITHRIL-TYP-001'). */
    ruleId: string
    /** Severity: 'amber' (ΔE 2-10) or 'critical' (ΔE > 10). */
    severity: 'amber' | 'critical'
    /** Human-readable violation message. */
    message: string
    /** The data-bridge-id of the JSX element with the violation. */
    nodeId: string
}

/** An accessibility (WCAG) violation on a specific node. */
export interface DBOMA11yViolation {
    /** Bridge rule identifier (e.g. 'A11Y-001', 'A11Y-007'). */
    ruleId: string
    /** Human-readable violation message. */
    message: string
}

// ── Override ──────────────────────────────────────────────────────────────────

/**
 * A component property override — a value that has been set directly in the
 * component_overrides table rather than resolved to a design token.
 * Each override is an unresolved export blocker.
 */
export interface DBOMOverride {
    /** The data-bridge-id of the overridden element. */
    nodeId: string
    /** The property key that was overridden (e.g. 'style', 'textContent'). */
    property: string
    /** The raw override value (may be truncated to 255 chars for readability). */
    value: string
}

// ── Baseline ──────────────────────────────────────────────────────────────────

/**
 * Baseline comparison data. Populated when a violation baseline has been
 * established via `bridge baseline:set` or the Glass baseline API.
 */
export interface DBOMBaseline {
    /** ISO 8601 timestamp of when the baseline was last set. */
    setAt: string
    /** Total violation count when the baseline was established. */
    violationsAtBaseline: number
    /** Net-new violations discovered since the baseline was set (may be negative if violations were fixed). */
    newViolationsSinceBaseline: number
}
