/**
 * Migrate Config Tool — flint-mcp/src/tools/migrateConfig.ts
 *
 * UCFG.4: MCP tool that generates flint.config.yaml from existing
 * legacy JSON config files (.flint/policy.json, .flint/agent-policy.json,
 * .flint/escalation-rules.json).
 *
 * Optionally renames legacy files to *.bak after migration.
 */

import fs from 'node:fs'
import path from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import type { FlintConfig, FlintProjectConfig, FlintPolicy } from '../core/config.js'
import { policyToRuleMode } from '../core/config.js'

interface MigrateConfigArgs {
    project_name?: string
    backup?: boolean
    dry_run?: boolean
}

interface AgentPolicyFile {
    version?: number
    agents?: Array<{
        agentId: string
        displayName?: string
        tier?: string
        allowedTools?: string[]
        deniedTools?: string[]
        maxMutationsPerSession?: number
        requireManualReview?: boolean
    }>
    defaultTier?: string
}

interface EscalationRulesFile {
    version?: number
    rules?: Array<{
        ruleId?: string
        description?: string
        trigger?: {
            type?: string
            threshold?: number
            window?: string
        }
        action?: {
            type?: string
            to?: string
            message?: string
        }
    }>
}

/**
 * Maps a legacy trust tier name to the new TrustTier name.
 */
function mapLegacyTier(tier: string): string {
    const map: Record<string, string> = {
        untrusted: 'intern',
        standard: 'junior',
        elevated: 'senior',
        admin: 'principal',
    }
    return map[tier] ?? tier
}

/**
 * Reads a JSON file and parses it. Returns null if missing or invalid.
 */
function readJsonFile<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) return null
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
    } catch {
        return null
    }
}

/**
 * Builds a FlintProjectConfig from legacy JSON config files.
 */
export function buildProjectConfigFromLegacy(
    projectRoot: string,
    projectName: string
): FlintProjectConfig {
    const config: FlintProjectConfig = {
        schema_version: '1.0.0',
        project: projectName,
    }

    // ── Read policy.json ────────────────────────────────────────────────
    const policy = readJsonFile<FlintPolicy>(
        path.join(projectRoot, '.flint', 'policy.json')
    )

    if (policy) {
        config.domain = policy.domain

        config.rules = {
            mithril: {
                mode: policyToRuleMode(policy.mithril?.mode ?? 'blocking'),
                delta_e: policy.mithril?.deltaE_threshold,
                delta_e_critical: policy.mithril?.deltaE_critical_threshold,
                ignore: policy.mithril?.ignore_patterns,
            },
            accessibility: {
                level: policy.a11y?.level,
                mode: policyToRuleMode(policy.a11y?.mode ?? 'blocking'),
                disabled: policy.a11y?.disabled_rules?.length
                    ? policy.a11y.disabled_rules
                    : undefined,
            },
            export_gate: {
                block_on_mithril: policy.export_gate?.block_on_mithril,
                block_on_a11y: policy.export_gate?.block_on_a11y,
                block_on_overrides: policy.export_gate?.block_on_overrides,
            },
            baseline: policy.baseline?.enabled ? { enabled: true } : undefined,
        }
    }

    // ── Read agent-policy.json ──────────────────────────────────────────
    const agentPolicy = readJsonFile<AgentPolicyFile>(
        path.join(projectRoot, '.flint', 'agent-policy.json')
    )

    if (agentPolicy) {
        config.trust = {
            default_tier: agentPolicy.defaultTier
                ? (mapLegacyTier(agentPolicy.defaultTier) as 'intern' | 'junior' | 'senior' | 'principal')
                : undefined,
            profiles: agentPolicy.agents?.map((a) => ({
                id: a.agentId,
                name: a.displayName,
                tier: mapLegacyTier(a.tier ?? 'standard') as 'intern' | 'junior' | 'senior' | 'principal',
                max_mutations: a.maxMutationsPerSession,
                require_review: a.requireManualReview,
            })),
        }
    }

    // ── Read escalation-rules.json ─────────────────────────────────────
    const escalation = readJsonFile<EscalationRulesFile>(
        path.join(projectRoot, '.flint', 'escalation-rules.json')
    )

    if (escalation?.rules?.length) {
        if (!config.trust) config.trust = {}
        config.trust.escalation = escalation.rules.map((r) => ({
            when: {
                ...(r.trigger?.type ? { [r.trigger.type]: `>= ${r.trigger.threshold}` } : {}),
                ...(r.trigger?.window ? { window: r.trigger.window } : {}),
            },
            then: r.action?.type ?? 'alert',
            to: r.action?.to,
            message: r.action?.message,
        }))
    }

    // Clean undefined values for cleaner YAML output
    return JSON.parse(JSON.stringify(config)) as FlintProjectConfig
}

/**
 * Handles the flint_migrate_config MCP tool call.
 */
export function handleMigrateConfig(
    args: MigrateConfigArgs,
    config: FlintConfig
): { content: Array<{ type: 'text'; text: string }> } {
    const projectRoot = config.projectRoot
    const projectName = args.project_name ?? path.basename(projectRoot)
    const dryRun = args.dry_run ?? false
    const backup = args.backup ?? true

    // Check if flint.config.yaml already exists
    const yamlPath = path.join(projectRoot, 'flint.config.yaml')
    if (fs.existsSync(yamlPath) && !dryRun) {
        return {
            content: [
                {
                    type: 'text',
                    text: '## Migration Skipped\n\n`flint.config.yaml` already exists at project root. Delete or rename it to re-run migration.',
                },
            ],
        }
    }

    // Check if any legacy files exist
    const legacyFiles = [
        '.flint/policy.json',
        '.flint/agent-policy.json',
        '.flint/escalation-rules.json',
    ]
    const existingLegacy = legacyFiles.filter((f) =>
        fs.existsSync(path.join(projectRoot, f))
    )

    if (existingLegacy.length === 0) {
        return {
            content: [
                {
                    type: 'text',
                    text: '## Migration Skipped\n\nNo legacy config files found (`.flint/policy.json`, `.flint/agent-policy.json`, `.flint/escalation-rules.json`). Nothing to migrate.',
                },
            ],
        }
    }

    // Build the unified config
    const projectConfig = buildProjectConfigFromLegacy(projectRoot, projectName)

    // Generate YAML
    const yamlContent =
        '# flint.config.yaml — Generated by flint_migrate_config\n' +
        '# Review and customize as needed.\n' +
        '# Spec: docs/strategy/UNIFIED-CONFIG-SPEC.md\n\n' +
        stringifyYaml(projectConfig, { lineWidth: 100 })

    if (dryRun) {
        return {
            content: [
                {
                    type: 'text',
                    text:
                        '## Migration Preview (dry run)\n\n' +
                        `**Source files:** ${existingLegacy.join(', ')}\n\n` +
                        '```yaml\n' +
                        yamlContent +
                        '```\n\n' +
                        'Run without `dry_run: true` to write this file.',
                },
            ],
        }
    }

    // Write the YAML config
    fs.writeFileSync(yamlPath, yamlContent, 'utf-8')

    // Backup legacy files
    const backedUp: string[] = []
    if (backup) {
        for (const f of existingLegacy) {
            const fullPath = path.join(projectRoot, f)
            const bakPath = fullPath + '.bak'
            fs.renameSync(fullPath, bakPath)
            backedUp.push(f)
        }
    }

    return {
        content: [
            {
                type: 'text',
                text:
                    '## Migration Complete\n\n' +
                    `**Created:** \`flint.config.yaml\`\n` +
                    (backedUp.length > 0
                        ? `**Backed up:** ${backedUp.map((f) => `\`${f}\` → \`${f}.bak\``).join(', ')}\n`
                        : '') +
                    '\n```yaml\n' +
                    yamlContent +
                    '```\n\n' +
                    'Review the generated file and customize as needed. ' +
                    'Legacy `.bak` files can be deleted once verified.',
            },
        ],
    }
}
