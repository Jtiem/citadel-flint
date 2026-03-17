/**
 * SARIF Builder -- bridge-ci/src/sarif-builder.ts
 *
 * Generates GitHub Code Scanning-compatible SARIF 2.1.0 output from
 * an AuditSummary. This lets Bridge violations appear as native code
 * annotations in GitHub pull request diffs.
 *
 * Schema: https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json
 */

import type {
    AuditSummary,
    SarifReport,
    SarifResult,
    SarifRule,
} from './types.js'

// -- Known Rule Definitions ----------------------------------------------------

const RULE_DEFINITIONS: Record<string, SarifRule> = {
    'MITHRIL-COL': {
        id: 'MITHRIL-COL',
        name: 'ColorDrift',
        shortDescription: { text: 'Arbitrary color value drifts from design token (CIEDE2000 deltaE > 2.0)' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-001': {
        id: 'MITHRIL-TYP-001',
        name: 'FontFamilyDrift',
        shortDescription: { text: 'Arbitrary font-family not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-002': {
        id: 'MITHRIL-TYP-002',
        name: 'FontSizeDrift',
        shortDescription: { text: 'Arbitrary font-size not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-003': {
        id: 'MITHRIL-TYP-003',
        name: 'FontWeightDrift',
        shortDescription: { text: 'Arbitrary font-weight not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-004': {
        id: 'MITHRIL-TYP-004',
        name: 'LineHeightDrift',
        shortDescription: { text: 'Arbitrary line-height not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-TYP-005': {
        id: 'MITHRIL-TYP-005',
        name: 'LetterSpacingDrift',
        shortDescription: { text: 'Arbitrary letter-spacing not in design token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-SPC-001': {
        id: 'MITHRIL-SPC-001',
        name: 'SpacingDrift',
        shortDescription: { text: 'Arbitrary spacing/sizing value not in dimension token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-SHD-001': {
        id: 'MITHRIL-SHD-001',
        name: 'ShadowDrift',
        shortDescription: { text: 'Arbitrary box-shadow not in shadow token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'MITHRIL-OPC-001': {
        id: 'MITHRIL-OPC-001',
        name: 'OpacityDrift',
        shortDescription: { text: 'Arbitrary opacity not in opacity token set' },
        defaultConfiguration: { level: 'warning' },
    },
    'A11Y-001': {
        id: 'A11Y-001',
        name: 'ImgMissingAlt',
        shortDescription: { text: '<img> must have an alt attribute (WCAG 2.1 SC 1.1.1)' },
        defaultConfiguration: { level: 'error' },
    },
    'A11Y-002': {
        id: 'A11Y-002',
        name: 'ButtonMissingName',
        shortDescription: { text: '<button> must have an accessible name (WCAG 2.1 SC 4.1.2)' },
        defaultConfiguration: { level: 'error' },
    },
    'A11Y-003': {
        id: 'A11Y-003',
        name: 'LinkMissingName',
        shortDescription: { text: '<a> must have an accessible name (WCAG 2.1 SC 2.4.4)' },
        defaultConfiguration: { level: 'error' },
    },
    'A11Y-004': {
        id: 'A11Y-004',
        name: 'InputMissingLabel',
        shortDescription: { text: '<input> must have a programmatic label (WCAG 2.1 SC 1.3.1)' },
        defaultConfiguration: { level: 'error' },
    },
    'A11Y-005': {
        id: 'A11Y-005',
        name: 'SelectMissingLabel',
        shortDescription: { text: '<select> must have an accessible label (WCAG 2.1 SC 1.3.1)' },
        defaultConfiguration: { level: 'error' },
    },
    'A11Y-006': {
        id: 'A11Y-006',
        name: 'TextareaMissingLabel',
        shortDescription: { text: '<textarea> must have an accessible label (WCAG 2.1 SC 1.3.1)' },
        defaultConfiguration: { level: 'error' },
    },
    'A11Y-007': {
        id: 'A11Y-007',
        name: 'PositiveTabIndex',
        shortDescription: { text: 'tabIndex > 0 disrupts natural tab order (WCAG 2.1 SC 2.4.3)' },
        defaultConfiguration: { level: 'warning' },
    },
    'A11Y-008': {
        id: 'A11Y-008',
        name: 'TableMissingSummary',
        shortDescription: { text: '<table> must have an accessible summary (WCAG 2.1 SC 1.3.1)' },
        defaultConfiguration: { level: 'error' },
    },
    'A11Y-009': {
        id: 'A11Y-009',
        name: 'HtmlMissingLang',
        shortDescription: { text: '<html> must have a lang attribute (WCAG 2.1 SC 3.1.1)' },
        defaultConfiguration: { level: 'error' },
    },
    'A11Y-010': {
        id: 'A11Y-010',
        name: 'HeadingSkip',
        shortDescription: { text: 'Heading levels must not be skipped (WCAG 2.1 SC 1.3.1)' },
        defaultConfiguration: { level: 'warning' },
    },
}

// -- Rule ID Extraction --------------------------------------------------------

/**
 * Extracts a SARIF rule ID from a violation message string.
 * Looks for patterns like "MITHRIL-COL:", "MITHRIL-TYP-001:", "A11Y-001:".
 */
function extractRuleId(message: string): string {
    // Match MITHRIL-COL (no number suffix)
    const mithrilColMatch = /^(MITHRIL-COL):/.exec(message)
    if (mithrilColMatch) return mithrilColMatch[1]

    // Match MITHRIL-XXX-NNN
    const mithrilMatch = /^(MITHRIL-[A-Z]+-\d{3}):/.exec(message)
    if (mithrilMatch) return mithrilMatch[1]

    // Match A11Y-NNN
    const a11yMatch = /^(A11Y-\d{3}):/.exec(message)
    if (a11yMatch) return a11yMatch[1]

    return 'UNKNOWN'
}

// -- SARIF Builder -------------------------------------------------------------

/**
 * Builds a SARIF 2.1.0 report from an AuditSummary.
 * Each Mithril warning and A11y violation becomes a SARIF result with
 * file location, rule ID, severity level, and human-readable message.
 */
export function buildSarifReport(summary: AuditSummary): SarifReport {
    const results: SarifResult[] = []
    const usedRuleIds = new Set<string>()

    for (const fileResult of summary.results) {
        // -- Mithril warnings --
        for (const warning of fileResult.mithrilWarnings) {
            const ruleId = extractRuleId(warning.message)
            usedRuleIds.add(ruleId)

            results.push({
                ruleId,
                level: warning.severity === 'critical' ? 'error' : 'warning',
                message: { text: warning.message },
                locations: [{
                    physicalLocation: {
                        artifactLocation: {
                            uri: normalizeUri(fileResult.filePath),
                            uriBaseId: '%SRCROOT%',
                        },
                    },
                }],
            })
        }

        // -- A11y violations --
        for (const [elementId, messages] of Object.entries(fileResult.a11yViolations)) {
            for (const message of messages) {
                const ruleId = extractRuleId(message)
                usedRuleIds.add(ruleId)

                results.push({
                    ruleId,
                    level: 'error',
                    message: { text: `[${elementId}] ${message}` },
                    locations: [{
                        physicalLocation: {
                            artifactLocation: {
                                uri: normalizeUri(fileResult.filePath),
                                uriBaseId: '%SRCROOT%',
                            },
                        },
                    }],
                })
            }
        }

        // -- Parse errors --
        if (fileResult.parseError) {
            results.push({
                ruleId: 'BRIDGE-PARSE',
                level: 'error',
                message: { text: fileResult.parseError },
                locations: [{
                    physicalLocation: {
                        artifactLocation: {
                            uri: normalizeUri(fileResult.filePath),
                            uriBaseId: '%SRCROOT%',
                        },
                    },
                }],
            })
            usedRuleIds.add('BRIDGE-PARSE')
        }
    }

    // Collect rules used in this run
    const rules: SarifRule[] = []
    for (const ruleId of usedRuleIds) {
        if (RULE_DEFINITIONS[ruleId]) {
            rules.push(RULE_DEFINITIONS[ruleId])
        } else if (ruleId === 'BRIDGE-PARSE') {
            rules.push({
                id: 'BRIDGE-PARSE',
                name: 'ParseError',
                shortDescription: { text: 'Source file could not be parsed by Babel' },
                defaultConfiguration: { level: 'error' },
            })
        } else {
            rules.push({
                id: ruleId,
                name: ruleId,
                shortDescription: { text: `Bridge governance rule ${ruleId}` },
            })
        }
    }

    return {
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [{
            tool: {
                driver: {
                    name: 'Bridge Governance',
                    version: '1.0.0',
                    informationUri: 'https://github.com/ruvnet/bridge',
                    rules,
                },
            },
            results,
        }],
    }
}

// -- Helpers -------------------------------------------------------------------

/**
 * Normalizes a file path to a relative URI for SARIF.
 * Strips leading ./ and converts backslashes to forward slashes.
 */
function normalizeUri(filePath: string): string {
    return filePath
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
}
