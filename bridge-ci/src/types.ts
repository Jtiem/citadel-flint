/**
 * Bridge CI Types -- bridge-ci/src/types.ts
 *
 * Standalone type definitions for the CI governance gate.
 * These are intentionally decoupled from src/types/bridge-api.d.ts and
 * electron/token-types.ts to avoid cross-boundary imports (Process Boundary Law).
 *
 * Kept structurally compatible so that JSON files produced by Bridge can be
 * consumed directly by the CI gate without transformation.
 */

// -- Design Token Types (mirror of bridge-api.d.ts DesignToken) ----------------

export type TokenType =
    | 'color'
    | 'dimension'
    | 'fontFamily'
    | 'fontWeight'
    | 'lineHeight'
    | 'letterSpacing'
    | 'shadow'
    | 'opacity'
    | 'string'
    | 'boolean'

export interface DesignToken {
    id: number
    token_path: string
    token_type: TokenType
    token_value: string
    description: string | null
    mode: string
    collection_name: string
}

// -- Linter Warning (mirror of bridge-api.d.ts LinterWarning) ------------------

export interface LinterWarning {
    id: string
    type: 'color-drift' | 'typography-drift' | 'spacing-drift' | 'shadow-drift' | 'opacity-drift' | 'a11y'
    severity: 'amber' | 'critical'
    value: number
    message: string
    nearestToken: string | null
    nearestTokenValue: string | null
}

// -- A11y Violations -----------------------------------------------------------

export type A11yViolations = Record<string, string[]>

// -- Policy Configuration (mirror of bridge-api.d.ts BridgePolicy) -------------

export type PolicyMode = 'blocking' | 'advisory' | 'off'

export interface BridgePolicy {
    version: number
    mithril: {
        deltaE_threshold: number
        deltaE_critical_threshold: number
        mode: PolicyMode
        ignore_patterns: string[]
    }
    a11y: {
        level: 'A' | 'AA' | 'AAA'
        mode: PolicyMode
        disabled_rules: string[]
    }
    export_gate: {
        block_on_mithril: boolean
        block_on_a11y: boolean
        block_on_overrides: boolean
    }
    baseline: {
        enabled: boolean
    }
}

// -- SARIF Types (subset of SARIF 2.1.0) ---------------------------------------

export interface SarifReport {
    $schema: string
    version: string
    runs: SarifRun[]
}

export interface SarifRun {
    tool: {
        driver: {
            name: string
            version: string
            informationUri?: string
            rules?: SarifRule[]
        }
    }
    results: SarifResult[]
}

export interface SarifRule {
    id: string
    name?: string
    shortDescription?: { text: string }
    defaultConfiguration?: { level: string }
}

export interface SarifResult {
    ruleId: string
    level: 'error' | 'warning' | 'note' | 'none'
    message: { text: string }
    locations?: SarifLocation[]
}

export interface SarifLocation {
    physicalLocation: {
        artifactLocation: {
            uri: string
            uriBaseId?: string
        }
        region?: {
            startLine?: number
            startColumn?: number
            endLine?: number
            endColumn?: number
        }
    }
}

// -- CI Result Aggregation -----------------------------------------------------

export interface FileAuditResult {
    filePath: string
    mithrilWarnings: LinterWarning[]
    a11yViolations: A11yViolations
    parseError: string | null
}

export interface AuditSummary {
    totalFiles: number
    filesWithViolations: number
    totalMithrilWarnings: number
    totalA11yViolations: number
    criticalCount: number
    amberCount: number
    results: FileAuditResult[]
}

// -- Default Policy ------------------------------------------------------------

export const DEFAULT_POLICY: BridgePolicy = {
    version: 1,
    mithril: {
        deltaE_threshold: 2.0,
        deltaE_critical_threshold: 10.0,
        mode: 'blocking',
        ignore_patterns: [],
    },
    a11y: {
        level: 'AA',
        mode: 'blocking',
        disabled_rules: [],
    },
    export_gate: {
        block_on_mithril: true,
        block_on_a11y: true,
        block_on_overrides: true,
    },
    baseline: {
        enabled: false,
    },
}
