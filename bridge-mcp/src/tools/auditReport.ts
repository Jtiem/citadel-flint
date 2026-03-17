/**
 * bridge_audit_report MCP tool handler — bridge-mcp/src/tools/auditReport.ts
 *
 * Generates a structured compliance audit report for a TSX/JSX component.
 * Violations are enriched with provenance metadata (sourceAuthority,
 * regulatoryReference) suitable for SOC2/FDA SaMD audit trails.
 *
 * Output formats:
 *   - json:  ComplianceSummary + full annotated violation list
 *   - sarif: SARIF 2.1.0 envelope
 *
 * Registration: imported by server.ts and added to ListToolsRequestSchema
 * and CallToolRequestSchema handlers.
 *
 * GOV.1: Rule Provenance
 */

import { parse } from '@babel/parser'
import { auditAll } from '../core/MithrilLinter.js'
import { A11yLinter } from '../core/A11yLinter.js'
import { resolveProvenance, buildComplianceSummary } from '../core/governance/ruleProvenanceRegistry.js'
import type { RuleProvenance, ComplianceSummary } from '../core/governance/types.js'
import type { DesignToken } from '../types.js'

// ── Tool definition (MCP ListTools schema) ────────────────────────────────────

export const BRIDGE_AUDIT_REPORT_TOOL = {
    name: 'bridge_audit_report',
    description:
        'Generate a structured compliance audit report for a component file. ' +
        'Returns violations enriched with provenance metadata (sourceAuthority, ' +
        'regulatoryReference) in JSON format suitable for SOC2/FDA SaMD audit trails.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            source: {
                type: 'string',
                description: 'Raw TSX/JSX source code to audit.',
            },
            filePath: {
                type: 'string',
                description: 'Absolute path to the file (for reporting context).',
            },
            format: {
                type: 'string',
                enum: ['json', 'sarif'],
                description:
                    "Output format. 'json' returns a ComplianceSummary + full violation list. " +
                    "'sarif' returns SARIF 2.1.0 compatible output. Default: 'json'.",
            },
            tokens: {
                type: 'array',
                description:
                    'Optional design token array for Mithril color/typography/spacing checks. ' +
                    'If omitted, Mithril violations will reflect the absence of token context.',
            },
            sourceAuthority: {
                type: 'string',
                description:
                    'Optional: filter violations to only include rules from this regulatory authority. ' +
                    'Values: "WCAG 2.1 AA", "WCAG 2.2 AA", "SOC2", "FDA SaMD", "HIPAA", "Section 508", "Bridge Design System", "Custom".',
            },
        },
        required: ['source', 'filePath'],
    },
} as const

// ── Handler args ──────────────────────────────────────────────────────────────

export interface AuditReportArgs {
    source: string
    filePath: string
    format?: 'json' | 'sarif'
    tokens?: DesignToken[]
    /** Optional: filter violations to only include rules from this regulatory authority. */
    sourceAuthority?: string
}

// ── Annotated violation shape ──────────────────────────────────────────────────

export interface AnnotatedViolation {
    bridgeId: string
    ruleId: string
    message: string
    severity: string
    provenance: RuleProvenance
}

// ── A11y ruleId extraction ────────────────────────────────────────────────────

/**
 * Extract a structured ruleId from an A11y violation message.
 * The A11yLinter embeds the ruleId as a prefix: "A11Y-001: ..."
 * Returns null for malformed messages — does not throw.
 */
export function extractA11yRuleId(message: string): string | null {
    const match = message.match(/^(A11Y-\d{3})/)
    return match?.[1] ?? null
}

// ── Handler ───────────────────────────────────────────────────────────────────

export interface AuditReportResult {
    content: Array<{ type: 'text'; text: string }>
    isError?: boolean
}

export function handleAuditReport(args: AuditReportArgs): AuditReportResult {
    const { source, filePath, format = 'json', tokens = [], sourceAuthority } = args

    // Parse source with Babel
    let ast: ReturnType<typeof parse>
    try {
        ast = parse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
            isError: true,
            content: [{ type: 'text', text: `Parse error: ${message}` }],
        }
    }

    // Run Mithril audit
    const mithrilWarnings = auditAll(ast as Parameters<typeof auditAll>[0], tokens)

    // Run A11y audit
    const a11yViolations = A11yLinter.audit(ast as Parameters<typeof A11yLinter.audit>[0])

    // Build annotated violation list
    const annotated: AnnotatedViolation[] = []

    for (const [bridgeId, warning] of mithrilWarnings) {
        const ruleId = warning.ruleId ?? extractRuleIdFromMessage(warning.message) ?? 'MITHRIL-UNKNOWN'
        annotated.push({
            bridgeId,
            ruleId,
            message: warning.message,
            severity: warning.severity,
            provenance: resolveProvenance(ruleId),
        })
    }

    for (const [bridgeId, messages] of Object.entries(a11yViolations)) {
        for (const message of messages) {
            const ruleId = extractA11yRuleId(message) ?? 'A11Y-UNKNOWN'
            annotated.push({
                bridgeId,
                ruleId,
                message,
                severity: 'critical',
                provenance: resolveProvenance(ruleId),
            })
        }
    }

    // GOV.1: Apply optional sourceAuthority filter
    const filtered = sourceAuthority
        ? annotated.filter((v) => v.provenance.sourceAuthority === sourceAuthority)
        : annotated

    // Build compliance summary from filtered violations
    const summary = buildComplianceSummary(
        filtered.map((v) => ({ ruleId: v.ruleId, severity: v.severity }))
    )

    if (format === 'sarif') {
        const sarif = buildSarifOutput(filePath, filtered)
        return { content: [{ type: 'text', text: JSON.stringify(sarif, null, 2) }] }
    }

    // Default: json
    const output = {
        filePath,
        timestamp: new Date().toISOString(),
        summary,
        violations: filtered,
    }
    return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }] }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fallback ruleId extraction from Mithril message strings.
 * Used when the warning object's ruleId field is absent (legacy path).
 * Pattern: "MITHRIL-COL: ..." -> "MITHRIL-COL"
 *          "MITHRIL-TYP-001: ..." -> "MITHRIL-TYP-001"
 */
function extractRuleIdFromMessage(message: string): string | null {
    const match = message.match(/^((?:MITHRIL-[A-Z]+-?\d*|A11Y-\d+))/)
    return match?.[1] ?? null
}

// ── SARIF builder ─────────────────────────────────────────────────────────────

interface SarifOutput {
    version: string
    $schema: string
    runs: SarifRun[]
}

interface SarifRun {
    tool: {
        driver: {
            name: string
            version: string
            rules: SarifRule[]
        }
    }
    results: SarifResult[]
}

interface SarifRule {
    id: string
    name: string
    shortDescription: { text: string }
    help: { text: string }
    properties: { tags: string[] }
}

interface SarifResult {
    ruleId: string
    level: 'error' | 'warning' | 'note'
    message: { text: string }
    locations: Array<{
        logicalLocations: Array<{ name: string }>
    }>
    properties: {
        bridgeId: string
        sourceAuthority: string
        regulatoryReference: string
    }
}

function buildSarifOutput(filePath: string, violations: AnnotatedViolation[]): SarifOutput {
    // Deduplicate rules
    const seenRules = new Map<string, SarifRule>()
    for (const v of violations) {
        if (!seenRules.has(v.ruleId)) {
            seenRules.set(v.ruleId, {
                id: v.ruleId,
                name: v.provenance.ruleName,
                shortDescription: { text: v.provenance.rationale },
                help: { text: `${v.provenance.sourceAuthority}: ${v.provenance.regulatoryReference}` },
                properties: { tags: [v.provenance.sourceAuthority] },
            })
        }
    }

    const results: SarifResult[] = violations.map((v) => ({
        ruleId: v.ruleId,
        level: v.severity === 'critical' ? 'error' : 'warning',
        message: { text: v.message },
        locations: [{ logicalLocations: [{ name: filePath }] }],
        properties: {
            bridgeId: v.bridgeId,
            sourceAuthority: v.provenance.sourceAuthority,
            regulatoryReference: v.provenance.regulatoryReference,
        },
    }))

    return {
        version: '2.1.0',
        $schema: 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'bridge-mcp',
                        version: '1.0.0',
                        rules: Array.from(seenRules.values()),
                    },
                },
                results,
            },
        ],
    }
}

// ── getComplianceSummary helper (used by IPC handler in electron/main.ts) ────

/**
 * Resolve a ComplianceSummary for a list of ruleIds.
 * Violations are assigned 'warning' severity by default because we don't
 * have per-violation severity context from the ruleId alone. Callers that
 * have full violation data should use buildComplianceSummary directly.
 *
 * Used by the `governance:compliance-summary` IPC channel.
 */
export function getComplianceSummaryForRuleIds(ruleIds: string[]): ComplianceSummary {
    const violations = ruleIds.map((ruleId) => {
        // A11y violations are critical; Mithril violations are warning by default
        const severity = ruleId.startsWith('A11Y-') ? 'critical' : 'warning'
        return { ruleId, severity }
    })
    return buildComplianceSummary(violations)
}
