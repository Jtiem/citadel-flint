/**
 * rulePacks.ts — ERM Phase 1 tool handlers
 *
 * Implements 5 MCP tools:
 *   flint_list_rule_packs      — filtered catalog listing
 *   flint_enable_pack          — add preset to flint.config.yaml extends
 *   flint_disable_pack         — remove preset from flint.config.yaml extends
 *   flint_set_rule_mode        — set per-rule mode in flint.config.yaml
 *   flint_compliance_coverage  — per-jurisdiction coverage analysis
 */

import fs from 'node:fs'
import path from 'node:path'
import {
    RULE_PACK_REGISTRY,
    getPackById,
    getPacksByDomain,
    getPacksByJurisdiction,
    getActivePackIds,
    type RulePack,
    type JurisdictionCoverage,
} from '../core/rulePackRegistry.js'

// ---------------------------------------------------------------------------
// Tool definition constants (used in server.ts ListTools handler)
// ---------------------------------------------------------------------------

export const FLINT_LIST_RULE_PACKS_TOOL = {
    name: 'flint_list_rule_packs',
    description:
        'List available governance rule packs, optionally filtered by domain, jurisdiction, or status. ' +
        'Returns pack metadata including rule count, jurisdictions covered, and activation status.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            domain: {
                type: 'string',
                enum: ['accessibility', 'privacy', 'security', 'brand', 'cognitive', 'design-system'],
                description: 'Filter packs by compliance domain.',
            },
            jurisdiction: {
                type: 'string',
                description: 'Filter packs that cover a specific jurisdiction, e.g. "EU/GDPR", "US/ADA", "US/HIPAA".',
            },
            status: {
                type: 'string',
                enum: ['active', 'available', 'coming-soon'],
                description: 'Filter by pack availability status.',
            },
        },
        required: [],
    },
}

export const FLINT_ENABLE_PACK_TOOL = {
    name: 'flint_enable_pack',
    description:
        'Enable a governance rule pack by adding its preset to the project\'s flint.config.yaml extends list. ' +
        'Idempotent — safe to call if the preset is already enabled.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            pack_id: {
                type: 'string',
                description: 'The rule pack ID to enable, e.g. "wcag-2.2", "hipaa-ui", "gdpr-consent".',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root. Defaults to process.cwd().',
            },
        },
        required: ['pack_id'],
    },
}

export const FLINT_DISABLE_PACK_TOOL = {
    name: 'flint_disable_pack',
    description:
        'Disable a governance rule pack by removing its preset from the project\'s flint.config.yaml extends list.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            pack_id: {
                type: 'string',
                description: 'The rule pack ID to disable, e.g. "wcag-2.2", "hipaa-ui".',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root. Defaults to process.cwd().',
            },
        },
        required: ['pack_id'],
    },
}

export const FLINT_SET_RULE_MODE_TOOL = {
    name: 'flint_set_rule_mode',
    description:
        'Set the enforcement mode for a specific rule in the project\'s flint.config.yaml. ' +
        'Modes: "coercive" (blocks export), "normative" (error, no block), "advisory" (warning), "off" (disabled).',
    inputSchema: {
        type: 'object' as const,
        properties: {
            rule_id: {
                type: 'string',
                description: 'The rule ID to configure, e.g. "A11Y-001", "MITHRIL-COL".',
            },
            mode: {
                type: 'string',
                enum: ['coercive', 'normative', 'advisory', 'off'],
                description: 'Enforcement mode for the rule.',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root. Defaults to process.cwd().',
            },
        },
        required: ['rule_id', 'mode'],
    },
}

export const FLINT_COMPLIANCE_COVERAGE_TOOL = {
    name: 'flint_compliance_coverage',
    description:
        'Analyze rule coverage per jurisdiction. Returns coverage percentage and identifies gaps (rules available ' +
        'but not yet active). Useful for compliance reporting and gap analysis.',
    inputSchema: {
        type: 'object' as const,
        properties: {
            jurisdictions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Jurisdictions to analyze, e.g. ["EU/GDPR", "US/ADA"]. If omitted, all known jurisdictions are returned.',
            },
            projectRoot: {
                type: 'string',
                description: 'Absolute path to the project root. Defaults to process.cwd().',
            },
        },
        required: [],
    },
}

// ---------------------------------------------------------------------------
// YAML helpers
// ---------------------------------------------------------------------------

/**
 * Minimal YAML reader for flint.config.yaml.
 * Extracts the extends array and the rules section as raw strings.
 * We use simple regex/string manipulation to avoid adding a YAML dep.
 */
function readConfigYaml(configPath: string): string {
    if (!fs.existsSync(configPath)) {
        return ''
    }
    return fs.readFileSync(configPath, 'utf-8')
}

function writeConfigYaml(configPath: string, content: string): void {
    fs.writeFileSync(configPath, content, 'utf-8')
}

/**
 * Parse the extends list from YAML content.
 * Handles two forms:
 *   extends: [@flint/a, @flint/b]       (inline array)
 *   extends:                            (block sequence)
 *     - @flint/a
 *     - @flint/b
 */
function parseExtends(yaml: string): string[] {
    // Inline array form: extends: [@flint/a, @flint/b]
    const inlineMatch = yaml.match(/^extends\s*:\s*\[([^\]]*)\]/m)
    if (inlineMatch) {
        return inlineMatch[1]
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
    }
    // Block sequence form
    const blockMatch = yaml.match(/^extends\s*:\s*\n((?:[ \t]+-[^\n]*\n?)*)/)
    if (blockMatch) {
        return blockMatch[1]
            .split('\n')
            .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
    }
    return []
}

/**
 * Rebuild the YAML with an updated extends list.
 * Preserves all other content.
 */
function setExtends(yaml: string, presets: string[]): string {
    const extendsBlock = presets.length === 0
        ? 'extends: []\n'
        : `extends:\n${presets.map((p) => `  - ${p}`).join('\n')}\n`

    // Replace existing extends block
    const inlinePattern = /^extends\s*:\s*\[[^\]]*\]\n?/m
    const blockPattern = /^extends\s*:\s*\n(?:[ \t]+-[^\n]*\n?)*/m

    if (inlinePattern.test(yaml)) {
        return yaml.replace(inlinePattern, extendsBlock)
    }
    if (blockPattern.test(yaml)) {
        return yaml.replace(blockPattern, extendsBlock)
    }
    // No existing extends — prepend
    return extendsBlock + yaml
}

/**
 * Parse the rules section from YAML content.
 * Returns a map of ruleId -> mode.
 */
function parseRuleModes(yaml: string): Map<string, string> {
    const modes = new Map<string, string>()
    // Look for rules: section with entries like "  A11Y-001: advisory"
    const rulesMatch = yaml.match(/^rules\s*:\s*\n((?:[ \t]+\S+[^\n]*\n?)*)/)
    if (!rulesMatch) return modes

    const lines = rulesMatch[1].split('\n')
    for (const line of lines) {
        const match = line.match(/^\s+([\w-]+)\s*:\s*(\w+)/)
        if (match) {
            modes.set(match[1], match[2])
        }
    }
    return modes
}

/**
 * Set or update a rule mode in the YAML.
 */
function setRuleMode(yaml: string, ruleId: string, mode: string): string {
    const rulesBlockPattern = /^(rules\s*:\s*\n)((?:[ \t]+\S+[^\n]*\n?)*)/m

    const rulesMatch = yaml.match(rulesBlockPattern)
    if (rulesMatch) {
        const rulesBody = rulesMatch[2]
        // Check if rule already exists
        const ruleLinePattern = new RegExp(`^([ \\t]+)${ruleId}\\s*:[^\\n]*`, 'm')
        if (ruleLinePattern.test(rulesBody)) {
            // Update existing
            const newBody = rulesBody.replace(ruleLinePattern, `$1${ruleId}: ${mode}`)
            return yaml.replace(rulesMatch[2], newBody)
        }
        // Append to rules section
        const newRulesBody = rulesBody + `  ${ruleId}: ${mode}\n`
        return yaml.replace(rulesMatch[0], rulesMatch[1] + newRulesBody)
    }

    // No rules section — append one
    return yaml + `\nrules:\n  ${ruleId}: ${mode}\n`
}

// ---------------------------------------------------------------------------
// Handler functions
// ---------------------------------------------------------------------------

export interface ListRulePacksParams {
    domain?: string
    jurisdiction?: string
    status?: string
}

export function handleListRulePacks(params: ListRulePacksParams) {
    let packs: RulePack[] = RULE_PACK_REGISTRY

    if (params.domain) {
        packs = packs.filter((p) => p.domain === params.domain)
    }
    if (params.jurisdiction) {
        packs = packs.filter((p) => p.jurisdictions.includes(params.jurisdiction!))
    }
    if (params.status) {
        packs = packs.filter((p) => p.status === params.status)
    }

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify(
                    {
                        packs,
                        total: packs.length,
                        filters: params,
                    },
                    null,
                    2,
                ),
            },
        ],
    }
}

export interface EnablePackParams {
    pack_id: string
    projectRoot?: string
}

export function handleEnablePack(params: EnablePackParams) {
    const { pack_id } = params
    const projectRoot = params.projectRoot ?? process.cwd()

    const pack = getPackById(pack_id)
    if (!pack) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: false,
                        error: `Unknown pack ID: "${pack_id}". Call flint_list_rule_packs to see available packs.`,
                    }),
                },
            ],
        }
    }

    if (!pack.preset) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: false,
                        error: `Pack "${pack_id}" has no preset and cannot be enabled via extends.`,
                    }),
                },
            ],
        }
    }

    const configPath = path.join(projectRoot, 'flint.config.yaml')
    let yaml = readConfigYaml(configPath)
    const currentPresets = parseExtends(yaml)

    // Idempotent — don't add if already present
    if (currentPresets.includes(pack.preset)) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        message: `Pack "${pack_id}" (${pack.preset}) is already enabled.`,
                        pack_id,
                        preset: pack.preset,
                        extends: currentPresets,
                        changed: false,
                    }),
                },
            ],
        }
    }

    const newPresets = [...currentPresets, pack.preset]
    yaml = setExtends(yaml, newPresets)
    writeConfigYaml(configPath, yaml)

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    success: true,
                    message: `Pack "${pack_id}" enabled. Added "${pack.preset}" to flint.config.yaml extends.`,
                    pack_id,
                    preset: pack.preset,
                    extends: newPresets,
                    changed: true,
                    ruleCount: pack.ruleCount,
                }),
            },
        ],
    }
}

export interface DisablePackParams {
    pack_id: string
    projectRoot?: string
}

export function handleDisablePack(params: DisablePackParams) {
    const { pack_id } = params
    const projectRoot = params.projectRoot ?? process.cwd()

    const pack = getPackById(pack_id)
    if (!pack) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: false,
                        error: `Unknown pack ID: "${pack_id}". Call flint_list_rule_packs to see available packs.`,
                    }),
                },
            ],
        }
    }

    if (!pack.preset) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: false,
                        error: `Pack "${pack_id}" has no preset and cannot be managed via extends.`,
                    }),
                },
            ],
        }
    }

    const configPath = path.join(projectRoot, 'flint.config.yaml')
    let yaml = readConfigYaml(configPath)
    const currentPresets = parseExtends(yaml)

    if (!currentPresets.includes(pack.preset)) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: true,
                        message: `Pack "${pack_id}" (${pack.preset}) was not in extends — nothing to remove.`,
                        pack_id,
                        preset: pack.preset,
                        extends: currentPresets,
                        changed: false,
                    }),
                },
            ],
        }
    }

    const newPresets = currentPresets.filter((p) => p !== pack.preset)
    yaml = setExtends(yaml, newPresets)
    writeConfigYaml(configPath, yaml)

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    success: true,
                    message: `Pack "${pack_id}" disabled. Removed "${pack.preset}" from flint.config.yaml extends.`,
                    pack_id,
                    preset: pack.preset,
                    extends: newPresets,
                    changed: true,
                }),
            },
        ],
    }
}

export interface SetRuleModeParams {
    rule_id: string
    mode: 'coercive' | 'normative' | 'advisory' | 'off'
    projectRoot?: string
}

export function handleSetRuleMode(params: SetRuleModeParams) {
    const { rule_id, mode } = params
    const projectRoot = params.projectRoot ?? process.cwd()

    // Validate mode
    const validModes = ['coercive', 'normative', 'advisory', 'off']
    if (!validModes.includes(mode)) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: false,
                        error: `Invalid mode "${mode}". Must be one of: ${validModes.join(', ')}.`,
                    }),
                },
            ],
        }
    }

    // Find the rule in any pack to validate it exists
    const allRules = RULE_PACK_REGISTRY.flatMap((p) => p.rules)
    const ruleEntry = allRules.find((r) => r.id === rule_id)
    if (!ruleEntry) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        success: false,
                        error: `Unknown rule ID: "${rule_id}". Use flint_list_rule_packs to browse available rules.`,
                    }),
                },
            ],
        }
    }

    const configPath = path.join(projectRoot, 'flint.config.yaml')
    let yaml = readConfigYaml(configPath)
    yaml = setRuleMode(yaml, rule_id, mode)
    writeConfigYaml(configPath, yaml)

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    success: true,
                    message: `Rule "${rule_id}" mode set to "${mode}" in flint.config.yaml.`,
                    rule_id,
                    rule_name: ruleEntry.name,
                    mode,
                    previous_mode: ruleEntry.defaultMode,
                }),
            },
        ],
    }
}

export interface ComplianceCoverageParams {
    jurisdictions?: string[]
    projectRoot?: string
}

export function handleComplianceCoverage(params: ComplianceCoverageParams) {
    const projectRoot = params.projectRoot ?? process.cwd()

    // Collect all known jurisdictions from the registry
    const allJurisdictions = new Set<string>()
    for (const pack of RULE_PACK_REGISTRY) {
        for (const j of pack.jurisdictions) {
            allJurisdictions.add(j)
        }
    }

    const targetJurisdictions = params.jurisdictions && params.jurisdictions.length > 0
        ? params.jurisdictions
        : Array.from(allJurisdictions).sort()

    const activeIds = new Set(getActivePackIds(projectRoot))

    const coverage: JurisdictionCoverage[] = targetJurisdictions.map((jurisdiction) => {
        const packsForJurisdiction = RULE_PACK_REGISTRY.filter((p) =>
            p.jurisdictions.includes(jurisdiction),
        )

        const activePacks = packsForJurisdiction.filter((p) => activeIds.has(p.id))
        const inactivePacks = packsForJurisdiction.filter((p) => !activeIds.has(p.id))

        const totalRules = packsForJurisdiction.reduce((sum, p) => sum + p.ruleCount, 0)
        const coveredRules = activePacks.reduce((sum, p) => sum + p.ruleCount, 0)

        const gaps = inactivePacks.flatMap((p) => p.rules.map((r) => r.id))

        const percentage = totalRules === 0
            ? 100
            : Math.round((coveredRules / totalRules) * 100)

        return {
            jurisdiction,
            total: totalRules,
            covered: coveredRules,
            percentage,
            gaps,
        }
    })

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify(
                    {
                        coverage,
                        summary: {
                            jurisdictions_analyzed: coverage.length,
                            fully_covered: coverage.filter((c) => c.percentage === 100).length,
                            partial_coverage: coverage.filter((c) => c.percentage > 0 && c.percentage < 100).length,
                            no_coverage: coverage.filter((c) => c.percentage === 0).length,
                        },
                    },
                    null,
                    2,
                ),
            },
        ],
    }
}
