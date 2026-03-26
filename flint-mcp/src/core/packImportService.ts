/**
 * Pack Import Service -- flint-mcp/src/core/packImportService.ts
 *
 * GPX.2: Import a governance pack into the active project.
 * Handles manifest validation, conflict detection, merge strategies,
 * snapshot creation, and rollback.
 *
 * Pure service with no MCP coupling. Called by the tool handler
 * in tools/packImport.ts.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml'
import type { PackManifest } from './packTypes.js'
import type { GovernanceDomain } from './policyEngine.js'
import { validatePolicy, coerceToResolved, loadPolicy } from './policyEngine.js'
import type { ResolvedPolicy } from './policyEngine.js'
import { scanForSecrets, scanForAbsolutePaths } from './packSecurityScanner.js'
import { sha256 } from './packAssembler.js'
import type {
    MergeStrategy,
    PackConflict,
    ConflictResolution,
    PackSnapshot,
    PackImportResult,
    PackRollbackResult,
} from './governance/types.js'

// ── Constants ────────────────────────────────────────────────────────────────

const PACK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?(?:\+[a-zA-Z0-9.]+)?$/
const MAX_SNAPSHOTS = 10

const VALID_DOMAINS = new Set<string>([
    'general', 'healthcare', 'fintech', 'e-commerce', 'government', 'enterprise-saas',
])

// ── Manifest Validation ─────────────────────────────────────────────────────

/**
 * Validates a parsed manifest object against the PackManifest schema.
 * Returns an array of error strings. Empty array means valid.
 */
export function validateManifest(manifest: unknown): string[] {
    const errors: string[] = []

    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        return ['Manifest must be a non-null object']
    }

    const m = manifest as Record<string, unknown>

    if (m.schema_version !== 1) {
        errors.push(`schema_version must be 1, got ${JSON.stringify(m.schema_version)}`)
    }

    if (typeof m.id !== 'string' || !PACK_ID_PATTERN.test(m.id)) {
        errors.push(`id must be a lowercase slug with hyphens only, got ${JSON.stringify(m.id)}`)
    }

    if (typeof m.name !== 'string' || m.name.trim().length === 0) {
        errors.push('name must be a non-empty string')
    }

    if (typeof m.version !== 'string' || !SEMVER_PATTERN.test(m.version)) {
        errors.push(`version must be valid semver, got ${JSON.stringify(m.version)}`)
    }

    if (typeof m.description !== 'string') {
        errors.push('description must be a string')
    }

    if (!m.author || typeof m.author !== 'object') {
        errors.push('author must be an object with a name field')
    } else {
        const author = m.author as Record<string, unknown>
        if (typeof author.name !== 'string' || author.name.trim().length === 0) {
            errors.push('author.name must be a non-empty string')
        }
    }

    if (typeof m.domain !== 'string' || !VALID_DOMAINS.has(m.domain)) {
        errors.push(`domain must be a valid GovernanceDomain, got ${JSON.stringify(m.domain)}`)
    }

    if (!m.contents || typeof m.contents !== 'object') {
        errors.push('contents must be an object')
    }

    if (!m.checksums || typeof m.checksums !== 'object') {
        errors.push('checksums must be an object')
    }

    return errors
}

// ── Checksum Verification ───────────────────────────────────────────────────

/**
 * Verifies pack file checksums against the manifest's checksums map.
 * Returns an array of error strings. Empty array means all checksums match.
 */
export function verifyChecksums(
    packDir: string,
    checksums: Record<string, string>,
): string[] {
    const errors: string[] = []

    for (const [filename, expectedChecksum] of Object.entries(checksums)) {
        const filePath = path.join(packDir, filename)
        if (!fs.existsSync(filePath)) {
            errors.push(`File listed in checksums not found: ${filename}`)
            continue
        }

        const content = fs.readFileSync(filePath, 'utf-8')
        const actualChecksum = `sha256:${sha256(content)}`

        if (actualChecksum !== expectedChecksum) {
            errors.push(
                `Checksum mismatch for ${filename}: ` +
                `expected ${expectedChecksum}, got ${actualChecksum}`,
            )
        }
    }

    return errors
}

// ── Security Scan ───────────────────────────────────────────────────────────

/**
 * Scans all text files in a pack directory for secrets and absolute paths.
 * Returns an array of error strings for any security violations found.
 */
export function securityScanPack(packDir: string): string[] {
    const errors: string[] = []
    const textExtensions = new Set(['.json', '.md', '.txt', '.yml', '.yaml', '.ts', '.js'])

    function scanDir(dir: string, relativeBase: string): void {
        if (!fs.existsSync(dir)) return
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            const relativePath = path.join(relativeBase, entry.name)
            if (entry.isDirectory()) {
                scanDir(fullPath, relativePath)
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase()
                if (textExtensions.has(ext) || entry.name === 'manifest.json') {
                    const content = fs.readFileSync(fullPath, 'utf-8')
                    const secretErrors = scanForSecrets(content, relativePath)
                    for (const err of secretErrors) {
                        errors.push(`Security: ${err.message} in ${err.file}`)
                    }
                    // Only flag absolute paths in claude-fragments as errors
                    if (relativePath.startsWith('claude-fragments')) {
                        const pathErrors = scanForAbsolutePaths(content, relativePath)
                        const absErrs = pathErrors.filter(e => e.severity === 'error')
                        for (const err of absErrs) {
                            errors.push(`Security: ${err.message} in ${err.file}`)
                        }
                    }
                }
            }
        }
    }

    scanDir(packDir, '')
    return errors
}

// ── Conflict Detection ──────────────────────────────────────────────────────

interface ProjectState {
    policy: ResolvedPolicy | null
    agentPolicy: AgentPolicyFile | null
    existingFragments: Map<string, string> // relativePath -> content
    existingRules: Set<string>             // filenames in .flint/rules/
}

interface AgentPolicyEntry {
    agentId: string
    tier: string
    allowedTools?: string[]
    deniedTools?: string[]
}

interface AgentPolicyFile {
    agents: AgentPolicyEntry[]
}

/**
 * Reads the current project state for conflict comparison.
 */
export function readProjectState(projectRoot: string): ProjectState {
    // Load policy
    let policy: ResolvedPolicy | null = null
    const policyPath = path.join(projectRoot, '.flint', 'policy.json')
    if (fs.existsSync(policyPath)) {
        policy = loadPolicy(projectRoot)
    }

    // Load agent policy
    let agentPolicy: AgentPolicyFile | null = null
    const agentPolicyPath = path.join(projectRoot, '.flint', 'agent-policy.json')
    if (fs.existsSync(agentPolicyPath)) {
        try {
            agentPolicy = JSON.parse(fs.readFileSync(agentPolicyPath, 'utf-8'))
        } catch {
            // Ignore malformed file
        }
    }

    // Inventory existing fragments
    const existingFragments = new Map<string, string>()
    const claudeAgentsDir = path.join(projectRoot, '.claude', 'agents')
    if (fs.existsSync(claudeAgentsDir)) {
        const files = fs.readdirSync(claudeAgentsDir)
        for (const file of files) {
            const fullPath = path.join(claudeAgentsDir, file)
            if (fs.statSync(fullPath).isFile()) {
                const content = fs.readFileSync(fullPath, 'utf-8')
                existingFragments.set(`agents/${file}`, content)
            }
        }
    }

    // Inventory existing rules
    const existingRules = new Set<string>()
    const rulesDir = path.join(projectRoot, '.flint', 'rules')
    if (fs.existsSync(rulesDir)) {
        const files = fs.readdirSync(rulesDir)
        for (const file of files) {
            existingRules.add(file)
        }
    }

    return { policy, agentPolicy, existingFragments, existingRules }
}

/**
 * Detects conflicts between the incoming pack and the current project state.
 */
export function detectConflicts(
    manifest: PackManifest,
    packDir: string,
    projectState: ProjectState,
): PackConflict[] {
    const conflicts: PackConflict[] = []

    // Policy conflicts
    if (manifest.contents.policy && projectState.policy) {
        const packPolicyPath = path.join(packDir, 'policy.json')
        if (fs.existsSync(packPolicyPath)) {
            try {
                const packPolicyRaw = JSON.parse(fs.readFileSync(packPolicyPath, 'utf-8'))
                const current = projectState.policy

                // Compare key policy fields
                if (packPolicyRaw.mithril?.deltaE_threshold !== undefined &&
                    packPolicyRaw.mithril.deltaE_threshold !== current.mithril.deltaE_threshold) {
                    conflicts.push({
                        domain: 'policy_value',
                        key: 'mithril.deltaE_threshold',
                        currentValue: current.mithril.deltaE_threshold,
                        incomingValue: packPolicyRaw.mithril.deltaE_threshold,
                        message: `deltaE threshold differs: project=${current.mithril.deltaE_threshold}, pack=${packPolicyRaw.mithril.deltaE_threshold}`,
                        severity: 'advisory',
                    })
                }

                if (packPolicyRaw.mithril?.mode !== undefined &&
                    packPolicyRaw.mithril.mode !== current.mithril.mode) {
                    conflicts.push({
                        domain: 'policy_value',
                        key: 'mithril.mode',
                        currentValue: current.mithril.mode,
                        incomingValue: packPolicyRaw.mithril.mode,
                        message: `Mithril mode differs: project=${current.mithril.mode}, pack=${packPolicyRaw.mithril.mode}`,
                        severity: 'advisory',
                    })
                }

                if (packPolicyRaw.a11y?.level !== undefined &&
                    packPolicyRaw.a11y.level !== current.a11y.level) {
                    conflicts.push({
                        domain: 'policy_value',
                        key: 'a11y.level',
                        currentValue: current.a11y.level,
                        incomingValue: packPolicyRaw.a11y.level,
                        message: `A11y level differs: project=${current.a11y.level}, pack=${packPolicyRaw.a11y.level}`,
                        severity: 'advisory',
                    })
                }

                if (packPolicyRaw.a11y?.mode !== undefined &&
                    packPolicyRaw.a11y.mode !== current.a11y.mode) {
                    conflicts.push({
                        domain: 'policy_value',
                        key: 'a11y.mode',
                        currentValue: current.a11y.mode,
                        incomingValue: packPolicyRaw.a11y.mode,
                        message: `A11y mode differs: project=${current.a11y.mode}, pack=${packPolicyRaw.a11y.mode}`,
                        severity: 'advisory',
                    })
                }

                if (packPolicyRaw.export_gate?.severity_floor !== undefined &&
                    packPolicyRaw.export_gate.severity_floor !== current.exportGate.severity_floor) {
                    conflicts.push({
                        domain: 'policy_value',
                        key: 'exportGate.severity_floor',
                        currentValue: current.exportGate.severity_floor,
                        incomingValue: packPolicyRaw.export_gate.severity_floor,
                        message: `Export gate severity floor differs: project=${current.exportGate.severity_floor}, pack=${packPolicyRaw.export_gate.severity_floor}`,
                        severity: 'advisory',
                    })
                }

                if (packPolicyRaw.export_gate?.block_on_overrides !== undefined &&
                    packPolicyRaw.export_gate.block_on_overrides !== current.exportGate.block_on_overrides) {
                    conflicts.push({
                        domain: 'policy_value',
                        key: 'exportGate.block_on_overrides',
                        currentValue: current.exportGate.block_on_overrides,
                        incomingValue: packPolicyRaw.export_gate.block_on_overrides,
                        message: `Export gate block_on_overrides differs`,
                        severity: 'advisory',
                    })
                }

                if (packPolicyRaw.domain !== undefined &&
                    packPolicyRaw.domain !== current.domain) {
                    conflicts.push({
                        domain: 'policy_value',
                        key: 'domain',
                        currentValue: current.domain,
                        incomingValue: packPolicyRaw.domain,
                        message: `Governance domain differs: project=${current.domain}, pack=${packPolicyRaw.domain}`,
                        severity: 'blocking',
                    })
                }
            } catch {
                // If pack policy is malformed, it will be caught by validation
            }
        }
    }

    // Rule mode conflicts
    if (manifest.contents.rules && manifest.contents.rules.length > 0 && projectState.policy) {
        const packPolicyPath = path.join(packDir, 'policy.json')
        if (fs.existsSync(packPolicyPath)) {
            try {
                const packPolicyRaw = JSON.parse(fs.readFileSync(packPolicyPath, 'utf-8'))
                const currentPolicy = projectState.policy

                // Check mithril rule overrides
                const packMithrilRules = packPolicyRaw.mithril?.rules ?? {}
                for (const [ruleId, packMode] of Object.entries(packMithrilRules)) {
                    if (ruleId in currentPolicy.mithril.rules &&
                        currentPolicy.mithril.rules[ruleId] !== packMode) {
                        conflicts.push({
                            domain: 'rule_mode',
                            key: `mithril.rules.${ruleId}`,
                            currentValue: currentPolicy.mithril.rules[ruleId],
                            incomingValue: packMode,
                            message: `Rule ${ruleId} mode differs: project=${currentPolicy.mithril.rules[ruleId]}, pack=${packMode}`,
                            severity: 'advisory',
                        })
                    }
                }

                // Check a11y rule overrides
                const packA11yRules = packPolicyRaw.a11y?.rules ?? {}
                for (const [ruleId, packMode] of Object.entries(packA11yRules)) {
                    if (ruleId in currentPolicy.a11y.rules &&
                        currentPolicy.a11y.rules[ruleId] !== packMode) {
                        conflicts.push({
                            domain: 'rule_mode',
                            key: `a11y.rules.${ruleId}`,
                            currentValue: currentPolicy.a11y.rules[ruleId],
                            incomingValue: packMode,
                            message: `Rule ${ruleId} mode differs: project=${currentPolicy.a11y.rules[ruleId]}, pack=${packMode}`,
                            severity: 'advisory',
                        })
                    }
                }
            } catch {
                // Ignore parse errors here
            }
        }
    }

    // Agent ID conflicts
    if (manifest.contents.agent_policy) {
        const packAgentPath = path.join(packDir, 'agent-policy.json')
        if (fs.existsSync(packAgentPath)) {
            try {
                const packAgentPolicy = JSON.parse(
                    fs.readFileSync(packAgentPath, 'utf-8'),
                ) as AgentPolicyFile

                const currentAgentMap = new Map(
                    (projectState.agentPolicy?.agents ?? []).map(a => [a.agentId, a]),
                )

                for (const packAgent of (packAgentPolicy.agents ?? [])) {
                    const existing = currentAgentMap.get(packAgent.agentId)
                    if (existing) {
                        if (existing.tier !== packAgent.tier) {
                            conflicts.push({
                                domain: 'agent_id',
                                key: `agent:${packAgent.agentId}`,
                                currentValue: existing.tier,
                                incomingValue: packAgent.tier,
                                message: `Agent "${packAgent.agentId}" tier differs: project=${existing.tier}, pack=${packAgent.tier}`,
                                severity: 'advisory',
                            })
                        }
                    }

                    // Trust tier cap for community packs
                    if (manifest.trust_tier === 'community' &&
                        (packAgent.tier === 'elevated' || packAgent.tier === 'admin')) {
                        conflicts.push({
                            domain: 'agent_id',
                            key: `agent:${packAgent.agentId}:trust-cap`,
                            currentValue: null,
                            incomingValue: packAgent.tier,
                            message: `Community packs cannot grant ${packAgent.tier} agent tiers`,
                            severity: 'blocking',
                        })
                    }
                }
            } catch {
                // Ignore parse errors
            }
        }
    }

    // Fragment file conflicts
    if (manifest.contents.claude_fragments && manifest.contents.claude_fragments.length > 0) {
        const fragmentsDir = path.join(packDir, 'claude-fragments')
        if (fs.existsSync(fragmentsDir)) {
            for (const fragmentPath of manifest.contents.claude_fragments) {
                const packFragmentFile = path.join(fragmentsDir, fragmentPath)
                if (!fs.existsSync(packFragmentFile)) continue

                const existingContent = projectState.existingFragments.get(fragmentPath)
                if (existingContent !== undefined) {
                    const packContent = fs.readFileSync(packFragmentFile, 'utf-8')
                    if (existingContent !== packContent) {
                        conflicts.push({
                            domain: 'fragment_file',
                            key: `fragment:${fragmentPath}`,
                            currentValue: `[existing file, ${existingContent.length} chars]`,
                            incomingValue: `[pack file, ${packContent.length} chars]`,
                            message: `Fragment file "${fragmentPath}" already exists with different content`,
                            severity: 'advisory',
                        })
                    }
                }
            }
        }
    }

    return conflicts
}

// ── Snapshot Management ─────────────────────────────────────────────────────

interface PackSnapshotIndex {
    snapshots: PackSnapshot[]
}

/**
 * Creates a snapshot of the current .flint/ and relevant .claude/ files
 * before an import modifies them.
 */
export function createSnapshot(
    projectRoot: string,
    manifest: PackManifest,
): PackSnapshot {
    const snapshotId = crypto.randomUUID()
    const snapshotsDir = path.join(projectRoot, '.flint', 'pack-snapshots')
    const snapshotDir = path.join(snapshotsDir, snapshotId)

    fs.mkdirSync(snapshotDir, { recursive: true })

    const backedUpFiles: string[] = []

    // Backup .flint/policy.json
    const policyPath = path.join(projectRoot, '.flint', 'policy.json')
    if (fs.existsSync(policyPath)) {
        fs.copyFileSync(policyPath, path.join(snapshotDir, 'policy.json'))
        backedUpFiles.push('.flint/policy.json')
    }

    // Backup .flint/agent-policy.json
    const agentPolicyPath = path.join(projectRoot, '.flint', 'agent-policy.json')
    if (fs.existsSync(agentPolicyPath)) {
        fs.copyFileSync(agentPolicyPath, path.join(snapshotDir, 'agent-policy.json'))
        backedUpFiles.push('.flint/agent-policy.json')
    }

    // Backup .flint/rules/
    const rulesDir = path.join(projectRoot, '.flint', 'rules')
    if (fs.existsSync(rulesDir)) {
        const destRulesDir = path.join(snapshotDir, 'rules')
        fs.mkdirSync(destRulesDir, { recursive: true })
        for (const file of fs.readdirSync(rulesDir)) {
            const src = path.join(rulesDir, file)
            if (fs.statSync(src).isFile()) {
                fs.copyFileSync(src, path.join(destRulesDir, file))
                backedUpFiles.push(`.flint/rules/${file}`)
            }
        }
    }

    // Backup .claude/agents/
    const claudeAgentsDir = path.join(projectRoot, '.claude', 'agents')
    if (fs.existsSync(claudeAgentsDir)) {
        const destDir = path.join(snapshotDir, 'claude-agents')
        fs.mkdirSync(destDir, { recursive: true })
        for (const file of fs.readdirSync(claudeAgentsDir)) {
            const src = path.join(claudeAgentsDir, file)
            if (fs.statSync(src).isFile()) {
                fs.copyFileSync(src, path.join(destDir, file))
                backedUpFiles.push(`.claude/agents/${file}`)
            }
        }
    }

    const snapshot: PackSnapshot = {
        id: snapshotId,
        packId: manifest.id,
        packVersion: manifest.version,
        createdAt: new Date().toISOString(),
        snapshotPath: snapshotDir,
        backedUpFiles,
        addedFiles: [], // Populated after import
    }

    // Write snapshot metadata
    fs.writeFileSync(
        path.join(snapshotDir, 'snapshot-meta.json'),
        JSON.stringify(snapshot, null, 2),
        'utf-8',
    )

    // Update index
    const indexPath = path.join(snapshotsDir, 'index.json')
    let index: PackSnapshotIndex = { snapshots: [] }
    if (fs.existsSync(indexPath)) {
        try {
            index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
        } catch {
            index = { snapshots: [] }
        }
    }

    index.snapshots.push(snapshot)

    // Prune oldest if over max
    while (index.snapshots.length > MAX_SNAPSHOTS) {
        const oldest = index.snapshots.shift()!
        if (fs.existsSync(oldest.snapshotPath)) {
            fs.rmSync(oldest.snapshotPath, { recursive: true, force: true })
        }
    }

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')

    return snapshot
}

/**
 * Updates a snapshot's addedFiles list in both the snapshot meta and the index.
 */
function updateSnapshotAddedFiles(
    projectRoot: string,
    snapshotId: string,
    addedFiles: string[],
): void {
    const snapshotsDir = path.join(projectRoot, '.flint', 'pack-snapshots')
    const snapshotDir = path.join(snapshotsDir, snapshotId)

    // Update snapshot-meta.json
    const metaPath = path.join(snapshotDir, 'snapshot-meta.json')
    if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as PackSnapshot
        meta.addedFiles = addedFiles
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
    }

    // Update index
    const indexPath = path.join(snapshotsDir, 'index.json')
    if (fs.existsSync(indexPath)) {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as PackSnapshotIndex
        const entry = index.snapshots.find(s => s.id === snapshotId)
        if (entry) {
            entry.addedFiles = addedFiles
            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')
        }
    }
}

// ── Merge Engine ─────────────────────────────────────────────────────────────

interface MergeResult {
    filesWritten: string[]
    skippedConflicts: PackConflict[]
}

/**
 * Deep-merges pack policy into project policy based on strategy and resolutions.
 */
function mergePolicy(
    packDir: string,
    projectRoot: string,
    conflicts: PackConflict[],
    strategy: MergeStrategy,
    resolutions: ConflictResolution[],
): { written: boolean; skipped: PackConflict[] } {
    const packPolicyPath = path.join(packDir, 'policy.json')
    if (!fs.existsSync(packPolicyPath)) {
        return { written: false, skipped: [] }
    }

    const packPolicyRaw = JSON.parse(fs.readFileSync(packPolicyPath, 'utf-8'))

    // Validate incoming policy
    const validation = validatePolicy(packPolicyRaw)
    if (!validation.valid) {
        throw new Error(`Pack policy validation failed: ${validation.errors.join(', ')}`)
    }

    const currentPolicy = loadPolicy(projectRoot)
    const policyConflicts = conflicts.filter(c => c.domain === 'policy_value')
    const conflictKeys = new Set(policyConflicts.map(c => c.key))
    const resolutionMap = new Map(resolutions.map(r => [r.key, r]))
    const skipped: PackConflict[] = []

    // Build merged raw policy
    const mergedRaw: Record<string, unknown> = {
        version: 2,
        domain: currentPolicy.domain,
        mithril: {
            deltaE_threshold: currentPolicy.mithril.deltaE_threshold,
            deltaE_critical_threshold: currentPolicy.mithril.deltaE_critical_threshold,
            mode: currentPolicy.mithril.mode,
            ignore_patterns: currentPolicy.mithril.ignore_patterns,
            rules: { ...currentPolicy.mithril.rules },
        },
        a11y: {
            level: currentPolicy.a11y.level,
            mode: currentPolicy.a11y.mode,
            rules: { ...currentPolicy.a11y.rules },
        },
        export_gate: {
            severity_floor: currentPolicy.exportGate.severity_floor,
            block_on_overrides: currentPolicy.exportGate.block_on_overrides,
        },
    }

    // Apply non-conflicting and resolved values
    const applyField = (key: string, section: string, field: string, value: unknown): void => {
        if (conflictKeys.has(key)) {
            if (strategy === 'override') {
                // Pack wins
            } else if (strategy === 'skip-conflicts') {
                skipped.push(policyConflicts.find(c => c.key === key)!)
                return // Keep project value
            } else if (strategy === 'interactive') {
                const resolution = resolutionMap.get(key)
                if (!resolution) return
                if (resolution.action === 'keep_current') return
                if (resolution.action === 'custom') {
                    value = resolution.customValue
                }
                // accept_incoming falls through
            }
        }

        const sectionObj = mergedRaw[section] as Record<string, unknown>
        if (sectionObj) {
            sectionObj[field] = value
        }
    }

    // Apply pack policy fields
    if (packPolicyRaw.domain !== undefined) {
        applyField('domain', '', '', packPolicyRaw.domain)
        if (!skipped.find(c => c.key === 'domain')) {
            mergedRaw.domain = packPolicyRaw.domain
        }
    }

    if (packPolicyRaw.mithril?.deltaE_threshold !== undefined) {
        applyField('mithril.deltaE_threshold', 'mithril', 'deltaE_threshold', packPolicyRaw.mithril.deltaE_threshold)
    }
    if (packPolicyRaw.mithril?.mode !== undefined) {
        applyField('mithril.mode', 'mithril', 'mode', packPolicyRaw.mithril.mode)
    }
    if (packPolicyRaw.a11y?.level !== undefined) {
        applyField('a11y.level', 'a11y', 'level', packPolicyRaw.a11y.level)
    }
    if (packPolicyRaw.a11y?.mode !== undefined) {
        applyField('a11y.mode', 'a11y', 'mode', packPolicyRaw.a11y.mode)
    }
    if (packPolicyRaw.export_gate?.severity_floor !== undefined) {
        applyField('exportGate.severity_floor', 'export_gate', 'severity_floor', packPolicyRaw.export_gate.severity_floor)
    }
    if (packPolicyRaw.export_gate?.block_on_overrides !== undefined) {
        applyField('exportGate.block_on_overrides', 'export_gate', 'block_on_overrides', packPolicyRaw.export_gate.block_on_overrides)
    }

    // Merge rule overrides (non-conflicting rules are always applied)
    const ruleConflictKeys = new Set(
        conflicts.filter(c => c.domain === 'rule_mode').map(c => c.key),
    )

    if (packPolicyRaw.mithril?.rules) {
        const mithrilSection = mergedRaw.mithril as Record<string, unknown>
        const rules = mithrilSection.rules as Record<string, string>
        for (const [ruleId, mode] of Object.entries(packPolicyRaw.mithril.rules as Record<string, string>)) {
            const ruleKey = `mithril.rules.${ruleId}`
            if (ruleConflictKeys.has(ruleKey)) {
                const conflict = conflicts.find(c => c.key === ruleKey)!
                if (strategy === 'skip-conflicts') {
                    skipped.push(conflict)
                    continue
                } else if (strategy === 'interactive') {
                    const resolution = resolutionMap.get(ruleKey)
                    if (!resolution || resolution.action === 'keep_current') continue
                    if (resolution.action === 'custom') {
                        rules[ruleId] = resolution.customValue as string
                        continue
                    }
                }
            }
            rules[ruleId] = mode
        }
    }

    if (packPolicyRaw.a11y?.rules) {
        const a11ySection = mergedRaw.a11y as Record<string, unknown>
        const rules = a11ySection.rules as Record<string, string>
        for (const [ruleId, mode] of Object.entries(packPolicyRaw.a11y.rules as Record<string, string>)) {
            const ruleKey = `a11y.rules.${ruleId}`
            if (ruleConflictKeys.has(ruleKey)) {
                const conflict = conflicts.find(c => c.key === ruleKey)!
                if (strategy === 'skip-conflicts') {
                    skipped.push(conflict)
                    continue
                } else if (strategy === 'interactive') {
                    const resolution = resolutionMap.get(ruleKey)
                    if (!resolution || resolution.action === 'keep_current') continue
                    if (resolution.action === 'custom') {
                        rules[ruleId] = resolution.customValue as string
                        continue
                    }
                }
            }
            rules[ruleId] = mode
        }
    }

    // Coerce and write
    const resolved = coerceToResolved(mergedRaw as Parameters<typeof coerceToResolved>[0])
    const flintDir = path.join(projectRoot, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })
    fs.writeFileSync(
        path.join(flintDir, 'policy.json'),
        JSON.stringify(resolved, null, 4) + '\n',
        'utf-8',
    )

    return { written: true, skipped }
}

/**
 * Merges agent policy from the pack into the project.
 */
function mergeAgentPolicy(
    packDir: string,
    projectRoot: string,
    manifest: PackManifest,
    conflicts: PackConflict[],
    strategy: MergeStrategy,
    resolutions: ConflictResolution[],
): { filesWritten: string[]; skipped: PackConflict[] } {
    const packAgentPath = path.join(packDir, 'agent-policy.json')
    if (!fs.existsSync(packAgentPath)) {
        return { filesWritten: [], skipped: [] }
    }

    const packAgentPolicy = JSON.parse(
        fs.readFileSync(packAgentPath, 'utf-8'),
    ) as AgentPolicyFile

    const skipped: PackConflict[] = []
    const agentConflicts = conflicts.filter(c => c.domain === 'agent_id')
    const conflictAgentKeys = new Set(agentConflicts.map(c => c.key))
    const resolutionMap = new Map(resolutions.map(r => [r.key, r]))

    // Read current agent policy or create empty
    const projectAgentPath = path.join(projectRoot, '.flint', 'agent-policy.json')
    let currentAgentPolicy: AgentPolicyFile = { agents: [] }
    if (fs.existsSync(projectAgentPath)) {
        try {
            currentAgentPolicy = JSON.parse(fs.readFileSync(projectAgentPath, 'utf-8'))
        } catch {
            currentAgentPolicy = { agents: [] }
        }
    }

    const currentMap = new Map(currentAgentPolicy.agents.map(a => [a.agentId, a]))

    for (const packAgent of packAgentPolicy.agents) {
        const agentKey = `agent:${packAgent.agentId}`
        const trustCapKey = `agent:${packAgent.agentId}:trust-cap`

        // Community pack trust tier cap — always enforce
        let effectiveTier = packAgent.tier
        if (manifest.trust_tier === 'community' &&
            (packAgent.tier === 'elevated' || packAgent.tier === 'admin')) {
            if (conflictAgentKeys.has(trustCapKey)) {
                const trustConflict = agentConflicts.find(c => c.key === trustCapKey)!
                if (strategy === 'skip-conflicts') {
                    skipped.push(trustConflict)
                    continue
                } else if (strategy === 'interactive') {
                    const resolution = resolutionMap.get(trustCapKey)
                    if (!resolution || resolution.action === 'keep_current') continue
                }
            }
            effectiveTier = 'standard'
        }

        if (conflictAgentKeys.has(agentKey)) {
            const conflict = agentConflicts.find(c => c.key === agentKey)!
            if (strategy === 'skip-conflicts') {
                skipped.push(conflict)
                continue
            } else if (strategy === 'interactive') {
                const resolution = resolutionMap.get(agentKey)
                if (!resolution || resolution.action === 'keep_current') continue
                if (resolution.action === 'custom' && typeof resolution.customValue === 'string') {
                    effectiveTier = resolution.customValue
                }
            }
            // override: falls through to overwrite
        }

        currentMap.set(packAgent.agentId, {
            ...packAgent,
            tier: effectiveTier,
        })
    }

    const mergedPolicy: AgentPolicyFile = {
        agents: [...currentMap.values()],
    }

    const flintDir = path.join(projectRoot, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })
    fs.writeFileSync(
        projectAgentPath,
        JSON.stringify(mergedPolicy, null, 4) + '\n',
        'utf-8',
    )

    return {
        filesWritten: ['.flint/agent-policy.json'],
        skipped,
    }
}

/**
 * Copies rule files from the pack to the project.
 */
function copyRuleFiles(
    packDir: string,
    projectRoot: string,
    projectState: ProjectState,
    strategy: MergeStrategy,
): { filesWritten: string[]; skipped: string[] } {
    const filesWritten: string[] = []
    const skipped: string[] = []
    const rulesDir = path.join(packDir, 'rules')

    if (!fs.existsSync(rulesDir)) return { filesWritten, skipped }

    const destRulesDir = path.join(projectRoot, '.flint', 'rules')
    fs.mkdirSync(destRulesDir, { recursive: true })

    for (const file of fs.readdirSync(rulesDir)) {
        const srcPath = path.join(rulesDir, file)
        if (!fs.statSync(srcPath).isFile()) continue

        const destPath = path.join(destRulesDir, file)
        const exists = projectState.existingRules.has(file)

        if (exists && strategy === 'skip-conflicts') {
            skipped.push(file)
            continue
        }

        try {
            fs.copyFileSync(srcPath, destPath)
            filesWritten.push(`.flint/rules/${file}`)
        } catch {
            // Individual file copy errors do not abort
        }
    }

    return { filesWritten, skipped }
}

/**
 * Copies claude fragment files from the pack to the project.
 */
function copyFragmentFiles(
    packDir: string,
    projectRoot: string,
    manifest: PackManifest,
    conflicts: PackConflict[],
    strategy: MergeStrategy,
    resolutions: ConflictResolution[],
): { filesWritten: string[]; skipped: PackConflict[] } {
    const filesWritten: string[] = []
    const skippedConflicts: PackConflict[] = []
    const fragmentsDir = path.join(packDir, 'claude-fragments')

    if (!fs.existsSync(fragmentsDir) || !manifest.contents.claude_fragments?.length) {
        return { filesWritten, skipped: skippedConflicts }
    }

    const fragmentConflicts = conflicts.filter(c => c.domain === 'fragment_file')
    const conflictKeys = new Set(fragmentConflicts.map(c => c.key))
    const resolutionMap = new Map(resolutions.map(r => [r.key, r]))

    for (const fragmentPath of manifest.contents.claude_fragments) {
        const srcPath = path.join(fragmentsDir, fragmentPath)
        if (!fs.existsSync(srcPath)) continue

        const destPath = path.join(projectRoot, '.claude', fragmentPath)
        const conflictKey = `fragment:${fragmentPath}`

        if (conflictKeys.has(conflictKey)) {
            const conflict = fragmentConflicts.find(c => c.key === conflictKey)!
            if (strategy === 'skip-conflicts') {
                skippedConflicts.push(conflict)
                continue
            } else if (strategy === 'interactive') {
                const resolution = resolutionMap.get(conflictKey)
                if (!resolution || resolution.action === 'keep_current') continue
            }
            // override: falls through
        }

        try {
            fs.mkdirSync(path.dirname(destPath), { recursive: true })
            fs.copyFileSync(srcPath, destPath)
            filesWritten.push(`.claude/${fragmentPath}`)
        } catch {
            // Individual file copy errors do not abort
        }
    }

    return { filesWritten, skipped: skippedConflicts }
}

// ── YAML Pack Import (UCFG.6) ────────────────────────────────────────────────

/**
 * Returns true if the manifest's format field indicates a YAML-format pack.
 * Backward-compatible: packs without a `format` field are treated as 'json'.
 */
export function isYamlFormatPack(manifest: PackManifest): boolean {
    return manifest.format === 'yaml'
}

/**
 * Reads the project's existing flint.config.yaml `extends` list.
 * Returns the parsed config object (or a minimal one if the file doesn't exist).
 * Returns null on parse error.
 */
function readProjectYamlConfig(projectRoot: string): Record<string, unknown> | null {
    const configPath = path.join(projectRoot, 'flint.config.yaml')
    if (!fs.existsSync(configPath)) {
        return null
    }
    try {
        const raw = fs.readFileSync(configPath, 'utf-8')
        return parseYaml(raw) as Record<string, unknown>
    } catch {
        return null
    }
}

/**
 * Writes a minimal flint.config.yaml for the project with just the `extends` list.
 * Merges into the existing file if one already exists.
 */
function writeProjectYamlExtends(projectRoot: string, packRef: string): void {
    const configPath = path.join(projectRoot, 'flint.config.yaml')
    let config: Record<string, unknown>

    if (fs.existsSync(configPath)) {
        try {
            config = parseYaml(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown> ?? {}
        } catch {
            config = {}
        }
    } else {
        config = {
            schema_version: '1.0.0',
            project: path.basename(projectRoot),
        }
    }

    // Merge extends list (deduplicated)
    const existing: string[] = Array.isArray(config.extends) ? config.extends as string[] : []
    if (!existing.includes(packRef)) {
        config.extends = [...existing, packRef]
    }

    const header = '# flint.config.yaml\n# Managed by flint_pack_import (UCFG.6).\n\n'
    fs.writeFileSync(configPath, header + stringifyYaml(config, { lineWidth: 100 }), 'utf-8')
}

/**
 * Returns true if the given pack's flint.config.yaml is already in the project's extends list.
 */
function isAlreadyExtended(projectRoot: string, packRef: string): boolean {
    const config = readProjectYamlConfig(projectRoot)
    if (!config) return false
    const existing: string[] = Array.isArray(config.extends) ? config.extends as string[] : []
    return existing.includes(packRef)
}

/**
 * Imports a YAML-format governance pack (UCFG.6).
 *
 * Strategy:
 *  1. Create `.flint-packs/<pack-id>/` directory in the project
 *  2. Copy the pack's `flint.config.yaml` there
 *  3. Add the path to the project's `flint.config.yaml` `extends` list
 *     (creating a minimal flint.config.yaml if none exists)
 *  4. Copy design-tokens.json if present
 *  5. Copy claude-fragments if present
 */
export async function importYamlPack(options: ImportPackOptions): Promise<PackImportResult> {
    const {
        packPath,
        projectRoot,
        strategy = 'skip-conflicts',
        dryRun = false,
    } = options

    // 1. Validate pack path
    if (!fs.existsSync(packPath)) {
        return makeErrorResult(`Pack path does not exist: ${packPath}`, strategy)
    }
    if (!fs.statSync(packPath).isDirectory()) {
        return makeErrorResult(`Pack path is not a directory: ${packPath}`, strategy)
    }

    // 2. Parse and validate manifest
    const manifestPath = path.join(packPath, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
        return makeErrorResult('Pack is missing manifest.json', strategy)
    }

    let manifest: PackManifest
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PackManifest
    } catch (err) {
        return makeErrorResult(`Failed to parse manifest.json: ${(err as Error).message}`, strategy)
    }

    const manifestErrors = validateManifest(manifest)
    if (manifestErrors.length > 0) {
        return makeErrorResult(`Invalid manifest: ${manifestErrors.join('; ')}`, strategy)
    }

    // 3. Verify checksums
    if (manifest.checksums && Object.keys(manifest.checksums).length > 0) {
        const checksumErrors = verifyChecksums(packPath, manifest.checksums)
        if (checksumErrors.length > 0) {
            return makeErrorResult(`Checksum verification failed: ${checksumErrors.join('; ')}`, strategy)
        }
    }

    // 4. Security scan
    const securityErrors = securityScanPack(packPath)
    if (securityErrors.length > 0) {
        return {
            success: false,
            manifest,
            strategy,
            conflicts: [],
            skippedConflicts: [],
            resolvedConflicts: [],
            filesWritten: [],
            snapshotId: null,
            error: `Security scan failed: ${securityErrors.join('; ')}`,
            summary: `Import blocked: security violations found in pack "${manifest.name}"`,
        }
    }

    // 5. Determine destination paths
    const packDestDir = path.join(projectRoot, '.flint-packs', manifest.id)
    const packRef = `./.flint-packs/${manifest.id}/flint.config.yaml`

    // 6. Check if already extended (idempotency)
    const alreadyExtended = isAlreadyExtended(projectRoot, packRef)

    // 7. Dry run: report what would happen
    if (dryRun) {
        const plannedFiles: string[] = []
        const packYamlSrc = path.join(packPath, 'flint.config.yaml')
        if (fs.existsSync(packYamlSrc)) {
            plannedFiles.push(`.flint-packs/${manifest.id}/flint.config.yaml`)
        }
        const tokensSrc = path.join(packPath, 'design-tokens.json')
        if (fs.existsSync(tokensSrc)) {
            plannedFiles.push(`.flint-packs/${manifest.id}/design-tokens.json`)
        }
        if (!alreadyExtended) {
            plannedFiles.push('flint.config.yaml (extends list updated)')
        }

        return {
            success: false,
            manifest,
            strategy,
            conflicts: [],
            skippedConflicts: [],
            resolvedConflicts: [],
            filesWritten: plannedFiles,
            snapshotId: null,
            summary: `Dry run: ${plannedFiles.length} file(s) would be written for YAML pack "${manifest.name}"`,
        }
    }

    // 8. Write the pack config directory
    fs.mkdirSync(packDestDir, { recursive: true })
    const filesWritten: string[] = []

    const packYamlSrc = path.join(packPath, 'flint.config.yaml')
    if (fs.existsSync(packYamlSrc)) {
        const packYamlDest = path.join(packDestDir, 'flint.config.yaml')
        fs.copyFileSync(packYamlSrc, packYamlDest)
        filesWritten.push(`.flint-packs/${manifest.id}/flint.config.yaml`)
    }

    // Copy design-tokens.json if present
    const tokensSrc = path.join(packPath, 'design-tokens.json')
    if (fs.existsSync(tokensSrc)) {
        fs.copyFileSync(tokensSrc, path.join(packDestDir, 'design-tokens.json'))
        filesWritten.push(`.flint-packs/${manifest.id}/design-tokens.json`)
    }

    // Copy claude-fragments if present
    const fragmentsSrc = path.join(packPath, 'claude-fragments')
    if (fs.existsSync(fragmentsSrc) && manifest.contents.claude_fragments?.length) {
        for (const fragPath of manifest.contents.claude_fragments) {
            const src = path.join(fragmentsSrc, fragPath)
            if (!fs.existsSync(src)) continue
            const dest = path.join(projectRoot, '.claude', fragPath)
            fs.mkdirSync(path.dirname(dest), { recursive: true })
            fs.copyFileSync(src, dest)
            filesWritten.push(`.claude/${fragPath}`)
        }
    }

    // 9. Update project's extends list
    if (!alreadyExtended) {
        writeProjectYamlExtends(projectRoot, packRef)
        filesWritten.push('flint.config.yaml')
    }

    return {
        success: true,
        manifest,
        strategy,
        conflicts: [],
        skippedConflicts: [],
        resolvedConflicts: options.resolutions ?? [],
        filesWritten,
        snapshotId: null,
        summary: `Successfully imported YAML pack "${manifest.name}" v${manifest.version}. ` +
            `${filesWritten.length} file(s) written.` +
            (alreadyExtended ? ' (extends list already up to date)' : ''),
    }
}

// ── Main Import Function ────────────────────────────────────────────────────

export interface ImportPackOptions {
    /** Path to the unpacked .flint-pack/ directory. */
    packPath: string
    /** Absolute path to the target project root. */
    projectRoot: string
    /** Merge strategy. Default: 'skip-conflicts'. */
    strategy?: MergeStrategy
    /** Conflict resolutions for interactive mode. */
    resolutions?: ConflictResolution[]
    /** When true, preview changes without writing. */
    dryRun?: boolean
}

/**
 * Imports a governance pack into the target project.
 *
 * Pipeline:
 *  1. Parse and validate manifest
 *  2. Verify checksums
 *  3. Run security scan
 *  4. Read current project state
 *  5. Detect conflicts
 *  6. Apply merge strategy
 *  7. Snapshot, write, return result
 */
export async function importPack(options: ImportPackOptions): Promise<PackImportResult> {
    const {
        packPath,
        projectRoot,
        strategy = 'skip-conflicts',
        resolutions = [],
        dryRun = false,
    } = options

    // 1. Validate pack path exists
    if (!fs.existsSync(packPath)) {
        return makeErrorResult(`Pack path does not exist: ${packPath}`, strategy)
    }

    const stat = fs.statSync(packPath)
    if (!stat.isDirectory()) {
        return makeErrorResult(`Pack path is not a directory: ${packPath}`, strategy)
    }

    // 2. Parse manifest
    const manifestPath = path.join(packPath, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
        return makeErrorResult('Pack is missing manifest.json', strategy)
    }

    let manifestRaw: unknown
    try {
        manifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    } catch (err) {
        return makeErrorResult(`Failed to parse manifest.json: ${(err as Error).message}`, strategy)
    }

    // 3. Validate manifest
    const manifestErrors = validateManifest(manifestRaw)
    if (manifestErrors.length > 0) {
        return makeErrorResult(
            `Invalid manifest: ${manifestErrors.join('; ')}`,
            strategy,
        )
    }

    const manifest = manifestRaw as PackManifest

    // 4a. YAML format delegation (UCFG.6)
    // If the pack declares format: 'yaml', use the dedicated YAML import path.
    if (isYamlFormatPack(manifest)) {
        return importYamlPack(options)
    }

    // 4. Verify checksums
    if (manifest.checksums && Object.keys(manifest.checksums).length > 0) {
        const checksumErrors = verifyChecksums(packPath, manifest.checksums)
        if (checksumErrors.length > 0) {
            return makeErrorResult(
                `Checksum verification failed: ${checksumErrors.join('; ')}`,
                strategy,
            )
        }
    }

    // 5. Security scan
    const securityErrors = securityScanPack(packPath)
    if (securityErrors.length > 0) {
        return {
            success: false,
            manifest,
            strategy,
            conflicts: [],
            skippedConflicts: [],
            resolvedConflicts: [],
            filesWritten: [],
            snapshotId: null,
            error: `Security scan failed: ${securityErrors.join('; ')}`,
            summary: `Import blocked: security violations found in pack "${manifest.name}"`,
        }
    }

    // 6. Read current project state
    const projectState = readProjectState(projectRoot)

    // 7. Detect conflicts
    const conflicts = detectConflicts(manifest, packPath, projectState)

    // 8. Interactive mode (phase A): return conflicts for user resolution
    if (strategy === 'interactive' && conflicts.length > 0 && resolutions.length === 0) {
        return {
            success: false,
            manifest,
            strategy,
            conflicts,
            skippedConflicts: [],
            resolvedConflicts: [],
            filesWritten: [],
            snapshotId: null,
            summary: `${conflicts.length} conflict(s) detected. Provide resolutions to proceed.`,
        }
    }

    // 9. Dry run: return preview without writing
    if (dryRun) {
        const plannedFiles = planFiles(manifest, packPath)
        return {
            success: false,
            manifest,
            strategy,
            conflicts,
            skippedConflicts: strategy === 'skip-conflicts' ? conflicts : [],
            resolvedConflicts: [],
            filesWritten: plannedFiles,
            snapshotId: null,
            summary: `Dry run: ${plannedFiles.length} file(s) would be written, ${conflicts.length} conflict(s) detected`,
        }
    }

    // 10. Create snapshot
    const snapshot = createSnapshot(projectRoot, manifest)
    const allFilesWritten: string[] = []
    const allSkippedConflicts: PackConflict[] = []

    try {
        // 11. Merge policy
        if (manifest.contents.policy) {
            const policyResult = mergePolicy(
                packPath, projectRoot, conflicts, strategy, resolutions,
            )
            if (policyResult.written) {
                allFilesWritten.push('.flint/policy.json')
            }
            allSkippedConflicts.push(...policyResult.skipped)
        }

        // 12. Merge agent policy
        if (manifest.contents.agent_policy) {
            const agentResult = mergeAgentPolicy(
                packPath, projectRoot, manifest, conflicts, strategy, resolutions,
            )
            allFilesWritten.push(...agentResult.filesWritten)
            allSkippedConflicts.push(...agentResult.skipped)
        }

        // 13. Copy rule files
        const ruleResult = copyRuleFiles(packPath, projectRoot, projectState, strategy)
        allFilesWritten.push(...ruleResult.filesWritten)

        // 14. Copy fragment files
        const fragmentResult = copyFragmentFiles(
            packPath, projectRoot, manifest, conflicts, strategy, resolutions,
        )
        allFilesWritten.push(...fragmentResult.filesWritten)
        allSkippedConflicts.push(...fragmentResult.skipped)

        // 15. Track added files in snapshot
        const preImportFiles = new Set(snapshot.backedUpFiles)
        const addedFiles = allFilesWritten.filter(f => !preImportFiles.has(f))
        updateSnapshotAddedFiles(projectRoot, snapshot.id, addedFiles)

    } catch (err) {
        return {
            success: false,
            manifest,
            strategy,
            conflicts,
            skippedConflicts: allSkippedConflicts,
            resolvedConflicts: resolutions,
            filesWritten: allFilesWritten,
            snapshotId: snapshot.id,
            error: `Import failed during merge: ${(err as Error).message}`,
            summary: `Import of "${manifest.name}" failed. Snapshot ${snapshot.id} available for inspection.`,
        }
    }

    return {
        success: true,
        manifest,
        strategy,
        conflicts,
        skippedConflicts: allSkippedConflicts,
        resolvedConflicts: resolutions,
        filesWritten: allFilesWritten,
        snapshotId: snapshot.id,
        summary: `Successfully imported "${manifest.name}" v${manifest.version}. ` +
            `${allFilesWritten.length} file(s) written, ` +
            `${allSkippedConflicts.length} conflict(s) skipped. ` +
            `Snapshot: ${snapshot.id}`,
    }
}

// ── Rollback ─────────────────────────────────────────────────────────────────

export interface RollbackOptions {
    /** UUID of the snapshot to restore. */
    snapshotId: string
    /** Absolute path to the target project root. */
    projectRoot: string
}

/**
 * Rolls back an import by restoring the snapshot.
 */
export async function rollbackImport(options: RollbackOptions): Promise<PackRollbackResult> {
    const { snapshotId, projectRoot } = options

    // Read index
    const indexPath = path.join(projectRoot, '.flint', 'pack-snapshots', 'index.json')
    if (!fs.existsSync(indexPath)) {
        return {
            success: false,
            snapshotId,
            filesRestored: [],
            error: 'No snapshot index found',
            summary: 'Rollback failed: no snapshot index exists',
        }
    }

    let index: PackSnapshotIndex
    try {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
    } catch {
        return {
            success: false,
            snapshotId,
            filesRestored: [],
            error: 'Failed to parse snapshot index',
            summary: 'Rollback failed: corrupt snapshot index',
        }
    }

    const snapshotEntry = index.snapshots.find(s => s.id === snapshotId)
    if (!snapshotEntry) {
        return {
            success: false,
            snapshotId,
            filesRestored: [],
            error: `Snapshot "${snapshotId}" not found in index`,
            summary: `Rollback failed: snapshot "${snapshotId}" does not exist`,
        }
    }

    const snapshotDir = snapshotEntry.snapshotPath
    if (!fs.existsSync(snapshotDir)) {
        return {
            success: false,
            snapshotId,
            filesRestored: [],
            error: `Snapshot directory does not exist: ${snapshotDir}`,
            summary: 'Rollback failed: snapshot directory missing',
        }
    }

    const filesRestored: string[] = []

    try {
        // Restore backed up files
        for (const relFile of snapshotEntry.backedUpFiles) {
            let snapshotFile: string

            if (relFile.startsWith('.claude/agents/')) {
                // Fragment files stored in claude-agents/ subdirectory
                const fragName = relFile.replace('.claude/agents/', '')
                snapshotFile = path.join(snapshotDir, 'claude-agents', fragName)
            } else if (relFile.startsWith('.flint/rules/')) {
                const ruleName = relFile.replace('.flint/rules/', '')
                snapshotFile = path.join(snapshotDir, 'rules', ruleName)
            } else if (relFile === '.flint/policy.json') {
                snapshotFile = path.join(snapshotDir, 'policy.json')
            } else if (relFile === '.flint/agent-policy.json') {
                snapshotFile = path.join(snapshotDir, 'agent-policy.json')
            } else {
                continue
            }

            if (!fs.existsSync(snapshotFile)) continue

            const destFile = path.join(projectRoot, relFile)
            fs.mkdirSync(path.dirname(destFile), { recursive: true })
            fs.copyFileSync(snapshotFile, destFile)
            filesRestored.push(relFile)
        }

        // Remove files that were added by the import
        for (const addedFile of (snapshotEntry.addedFiles ?? [])) {
            const fullPath = path.join(projectRoot, addedFile)
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath)
            }
        }

        // Remove snapshot from index (one-time use)
        index.snapshots = index.snapshots.filter(s => s.id !== snapshotId)
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')

    } catch (err) {
        return {
            success: false,
            snapshotId,
            filesRestored,
            error: `Rollback error: ${(err as Error).message}`,
            summary: `Rollback of snapshot "${snapshotId}" partially failed`,
        }
    }

    return {
        success: true,
        snapshotId,
        filesRestored,
        summary: `Rollback complete. ${filesRestored.length} file(s) restored from snapshot "${snapshotId}".`,
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Plans which files would be written by the import (for dry run).
 */
function planFiles(manifest: PackManifest, packDir: string): string[] {
    const planned: string[] = []

    if (manifest.contents.policy) {
        const policyPath = path.join(packDir, 'policy.json')
        if (fs.existsSync(policyPath)) {
            planned.push('.flint/policy.json')
        }
    }

    if (manifest.contents.agent_policy) {
        const agentPath = path.join(packDir, 'agent-policy.json')
        if (fs.existsSync(agentPath)) {
            planned.push('.flint/agent-policy.json')
        }
    }

    const rulesDir = path.join(packDir, 'rules')
    if (fs.existsSync(rulesDir)) {
        for (const file of fs.readdirSync(rulesDir)) {
            planned.push(`.flint/rules/${file}`)
        }
    }

    if (manifest.contents.claude_fragments) {
        for (const fragPath of manifest.contents.claude_fragments) {
            planned.push(`.claude/${fragPath}`)
        }
    }

    return planned
}

/**
 * Creates an error result with an empty manifest placeholder.
 */
function makeErrorResult(error: string, strategy: MergeStrategy): PackImportResult {
    return {
        success: false,
        manifest: {
            schema_version: 1,
            id: 'unknown',
            name: 'Unknown',
            version: '0.0.0',
            description: '',
            author: { name: '' },
            trust_tier: 'community',
            domain: 'general' as GovernanceDomain,
            stack_tags: [],
            compatibility: { flint_min_version: '0.0.0', flint_max_version: null },
            dependencies: [],
            contents: { policy: false, agent_policy: false, rules: [], claude_fragments: [] },
            checksums: {},
            published_at: new Date().toISOString(),
        },
        strategy,
        conflicts: [],
        skippedConflicts: [],
        resolvedConflicts: [],
        filesWritten: [],
        snapshotId: null,
        error,
        summary: `Import failed: ${error}`,
    }
}
