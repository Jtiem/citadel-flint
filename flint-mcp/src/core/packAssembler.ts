/**
 * Pack Assembler -- flint-mcp/src/core/packAssembler.ts
 *
 * GPX.1 Phase 2b: 7-step assembly pipeline for building .flint-pack archives.
 *
 * Steps:
 *   1. Read .flint/policy.json, validate via policy engine
 *   2. Read .flint/agent-policy.json, validate shape
 *   3. Collect customized rules from the policy's rule-mode map
 *   4. Collect .claude/ fragments if include_claude_fragments paths provided
 *   5. Run security scanner on all collected files
 *   6. Generate manifest.json with SHA-256 checksums
 *   7. If not dry_run, write the pack directory atomically
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadPolicy, validatePolicy } from './policyEngine.js'
import type { ResolvedPolicy, GovernanceDomain } from './policyEngine.js'
import { scanPackContents } from './packSecurityScanner.js'
import type {
    PackManifest,
    PackFileEntry,
    PackContents,
    PackContentsDeclaration,
    PackValidationError,
    PackExportResult,
    PackExportDryRunResult,
    PackExportWriteResult,
    PackAuthor,
} from './packTypes.js'

// ── Assembly Options ────────────────────────────────────────────────────────

export interface PackAssemblyOptions {
    id: string;
    name: string;
    version: string;
    description: string;
    author: PackAuthor;
    projectRoot: string;
    domain?: GovernanceDomain;
    stack_tags?: string[];
    include_claude_fragments?: string[];
    output_path?: string;
    dry_run?: boolean;
}

// ── SHA-256 Helper ──────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hex digest of a string.
 */
export function sha256(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex')
}

// ── Step 1: Collect Policy ──────────────────────────────────────────────────

/**
 * Reads .flint/policy.json from the project root.
 * Returns a PackFileEntry if the file exists, null otherwise.
 * Also returns validation errors if the policy is invalid.
 */
export function collectPolicy(projectRoot: string): {
    entry: PackFileEntry | null;
    resolvedPolicy: ResolvedPolicy;
    errors: PackValidationError[];
} {
    const policyPath = path.join(projectRoot, '.flint', 'policy.json')
    const errors: PackValidationError[] = []

    if (!fs.existsSync(policyPath)) {
        // No policy file -- use defaults. Not an error.
        return {
            entry: null,
            resolvedPolicy: loadPolicy(projectRoot),
            errors: [],
        }
    }

    let rawContent: string
    try {
        rawContent = fs.readFileSync(policyPath, 'utf-8')
    } catch {
        errors.push({
            severity: 'error',
            file: 'policy.json',
            message: 'Failed to read .flint/policy.json',
            code: 'POLICY_INVALID',
        })
        return {
            entry: null,
            resolvedPolicy: loadPolicy(projectRoot),
            errors,
        }
    }

    // Validate the raw policy
    let parsed: unknown
    try {
        parsed = JSON.parse(rawContent)
    } catch {
        errors.push({
            severity: 'error',
            file: 'policy.json',
            message: 'policy.json is not valid JSON',
            code: 'POLICY_INVALID',
        })
        return {
            entry: null,
            resolvedPolicy: loadPolicy(projectRoot),
            errors,
        }
    }

    const validation = validatePolicy(parsed)
    if (!validation.valid) {
        for (const errMsg of validation.errors) {
            errors.push({
                severity: 'error',
                file: 'policy.json',
                message: errMsg,
                code: 'POLICY_INVALID',
            })
        }
    }

    const checksum = sha256(rawContent)
    const resolvedPolicy = loadPolicy(projectRoot)

    return {
        entry: {
            packPath: 'policy.json',
            content: rawContent,
            checksum,
        },
        resolvedPolicy,
        errors,
    }
}

// ── Step 2: Collect Agent Policy ────────────────────────────────────────────

/**
 * Reads .flint/agent-policy.json from the project root.
 * Validates shape: top-level object, optional version (number), optional agents (array
 * of objects with agentId string), optional defaultTier (string in valid tier set).
 */
export function collectAgentPolicy(projectRoot: string): {
    entry: PackFileEntry | null;
    errors: PackValidationError[];
} {
    const agentPolicyPath = path.join(projectRoot, '.flint', 'agent-policy.json')
    const errors: PackValidationError[] = []

    if (!fs.existsSync(agentPolicyPath)) {
        return { entry: null, errors: [] }
    }

    let rawContent: string
    try {
        rawContent = fs.readFileSync(agentPolicyPath, 'utf-8')
    } catch {
        errors.push({
            severity: 'error',
            file: 'agent-policy.json',
            message: 'Failed to read .flint/agent-policy.json',
            code: 'AGENT_POLICY_INVALID',
        })
        return { entry: null, errors }
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(rawContent)
    } catch {
        errors.push({
            severity: 'error',
            file: 'agent-policy.json',
            message: 'agent-policy.json is not valid JSON',
            code: 'AGENT_POLICY_INVALID',
        })
        return { entry: null, errors }
    }

    // Validate shape
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        errors.push({
            severity: 'error',
            file: 'agent-policy.json',
            message: 'agent-policy.json must be a plain object',
            code: 'AGENT_POLICY_INVALID',
        })
        return { entry: null, errors }
    }

    const obj = parsed as Record<string, unknown>
    const validTiers = new Set(['sandbox', 'standard', 'trusted', 'admin'])

    if (obj.version !== undefined && typeof obj.version !== 'number') {
        errors.push({
            severity: 'error',
            file: 'agent-policy.json',
            message: 'agent-policy.json "version" must be a number',
            code: 'AGENT_POLICY_INVALID',
        })
    }

    if (obj.defaultTier !== undefined) {
        if (typeof obj.defaultTier !== 'string' || !validTiers.has(obj.defaultTier)) {
            errors.push({
                severity: 'error',
                file: 'agent-policy.json',
                message: `agent-policy.json "defaultTier" must be one of: ${[...validTiers].join(', ')}`,
                code: 'AGENT_POLICY_INVALID',
            })
        }
    }

    if (obj.agents !== undefined) {
        if (!Array.isArray(obj.agents)) {
            errors.push({
                severity: 'error',
                file: 'agent-policy.json',
                message: 'agent-policy.json "agents" must be an array',
                code: 'AGENT_POLICY_INVALID',
            })
        } else {
            for (let i = 0; i < obj.agents.length; i++) {
                const agent = obj.agents[i]
                if (typeof agent !== 'object' || agent === null || Array.isArray(agent)) {
                    errors.push({
                        severity: 'error',
                        file: 'agent-policy.json',
                        message: `agent-policy.json agents[${i}] must be an object`,
                        code: 'AGENT_POLICY_INVALID',
                    })
                } else if (typeof (agent as Record<string, unknown>).agentId !== 'string') {
                    errors.push({
                        severity: 'error',
                        file: 'agent-policy.json',
                        message: `agent-policy.json agents[${i}] must have a string "agentId"`,
                        code: 'AGENT_POLICY_INVALID',
                    })
                }
            }
        }
    }

    const checksum = sha256(rawContent)
    return {
        entry: {
            packPath: 'agent-policy.json',
            content: rawContent,
            checksum,
        },
        errors,
    }
}

// ── Step 3: Collect Customized Rules ────────────────────────────────────────

/**
 * Collects rule config files for rules that have non-default mode overrides.
 * Each entry captures the rule ID, its override mode, and source ("policy").
 */
export function collectCustomizedRules(
    resolvedPolicy: ResolvedPolicy,
): PackFileEntry[] {
    const entries: PackFileEntry[] = []

    // Collect mithril rule overrides
    for (const [ruleId, mode] of Object.entries(resolvedPolicy.mithril.rules)) {
        const ruleConfig = JSON.stringify({ id: ruleId, mode, source: 'policy' }, null, 2)
        entries.push({
            packPath: `rules/${ruleId}.json`,
            content: ruleConfig,
            checksum: sha256(ruleConfig),
        })
    }

    // Collect a11y rule overrides
    for (const [ruleId, mode] of Object.entries(resolvedPolicy.a11y.rules)) {
        const ruleConfig = JSON.stringify({ id: ruleId, mode, source: 'policy' }, null, 2)
        entries.push({
            packPath: `rules/${ruleId}.json`,
            content: ruleConfig,
            checksum: sha256(ruleConfig),
        })
    }

    return entries
}

// ── Step 4: Collect Claude Fragments ────────────────────────────────────────

/**
 * Reads and collects specified .claude/ fragment files.
 * Scrubs absolute paths from fragment content.
 */
export function collectClaudeFragments(
    projectRoot: string,
    fragmentPaths: string[],
): { entries: PackFileEntry[]; errors: PackValidationError[] } {
    const entries: PackFileEntry[] = []
    const errors: PackValidationError[] = []

    for (const relPath of fragmentPaths) {
        const fullPath = path.join(projectRoot, '.claude', relPath)

        if (!fs.existsSync(fullPath)) {
            errors.push({
                severity: 'error',
                file: `claude-fragments/${relPath}`,
                message: `Fragment file not found: .claude/${relPath}`,
                code: 'FILE_NOT_FOUND',
            })
            continue
        }

        let content: string
        try {
            content = fs.readFileSync(fullPath, 'utf-8')
        } catch {
            errors.push({
                severity: 'error',
                file: `claude-fragments/${relPath}`,
                message: `Failed to read .claude/${relPath}`,
                code: 'FILE_NOT_FOUND',
            })
            continue
        }

        // Scrub absolute paths from fragment content
        content = scrubAbsolutePaths(content)

        const checksum = sha256(content)
        entries.push({
            packPath: `claude-fragments/${relPath}`,
            content,
            checksum,
        })
    }

    return { entries, errors }
}

/**
 * Scrub absolute paths from content by replacing them with <PROJECT_ROOT> placeholder.
 */
function scrubAbsolutePaths(content: string): string {
    let scrubbed = content
    // Replace Unix absolute paths
    scrubbed = scrubbed.replace(
        /\/(?:Users|home|tmp|var|opt|etc|root)\/[^\s"')\]]+/g,
        '<PROJECT_ROOT>',
    )
    // Replace Windows absolute paths
    scrubbed = scrubbed.replace(
        /[A-Z]:\\[^\s"')\]]+/g,
        '<PROJECT_ROOT>',
    )
    return scrubbed
}

// ── Step 6: Generate Manifest ───────────────────────────────────────────────

/**
 * Builds the PackManifest from the assembly options, collected contents,
 * and resolved policy.
 */
export function generateManifest(
    options: PackAssemblyOptions,
    contents: PackContents,
    resolvedPolicy: ResolvedPolicy,
): PackManifest {
    // Build checksums map from all files
    const checksums: Record<string, string> = {}
    const allEntries: PackFileEntry[] = []

    if (contents.policy) allEntries.push(contents.policy)
    if (contents.agentPolicy) allEntries.push(contents.agentPolicy)
    allEntries.push(...contents.rules)
    allEntries.push(...contents.claudeFragments)

    for (const entry of allEntries) {
        checksums[entry.packPath] = `sha256:${entry.checksum}`
    }

    // Build contents declaration
    const contentsDecl: PackContentsDeclaration = {
        policy: contents.policy !== null,
        agent_policy: contents.agentPolicy !== null,
        rules: contents.rules.map(r => {
            // Extract rule ID from pack path like "rules/MITHRIL-COL.json"
            const basename = path.basename(r.packPath, '.json')
            return basename
        }),
        claude_fragments: contents.claudeFragments.map(f => {
            // Remove "claude-fragments/" prefix
            return f.packPath.replace('claude-fragments/', '')
        }),
    }

    const manifest: PackManifest = {
        schema_version: 1,
        id: options.id,
        name: options.name,
        version: options.version,
        description: options.description,
        author: options.author,
        trust_tier: 'community',
        domain: options.domain ?? resolvedPolicy.domain,
        stack_tags: options.stack_tags ?? [],
        compatibility: {
            flint_min_version: '7.0.0',
            flint_max_version: null,
        },
        dependencies: [],
        contents: contentsDecl,
        checksums,
        published_at: new Date().toISOString(),
    }

    return manifest
}

// ── Step 7: Write Pack Directory ────────────────────────────────────────────

/**
 * Writes the pack as a directory at the output path using atomic writes.
 * Creates a .flint-pack/ directory containing manifest.json and all pack files.
 *
 * Uses atomic pattern: write to .tmp directory, then rename.
 */
export function writePackDirectory(
    manifest: PackManifest,
    contents: PackContents,
    outputPath: string,
): { archivePath: string; archiveSizeBytes: number } {
    const tmpPath = outputPath + '.tmp.' + process.pid

    try {
        // Clean up any leftover tmp directory
        if (fs.existsSync(tmpPath)) {
            fs.rmSync(tmpPath, { recursive: true, force: true })
        }

        // Create the tmp directory
        fs.mkdirSync(tmpPath, { recursive: true })

        // Write manifest.json first
        const manifestContent = JSON.stringify(manifest, null, 2)
        fs.writeFileSync(path.join(tmpPath, 'manifest.json'), manifestContent, 'utf-8')

        let totalSize = Buffer.byteLength(manifestContent, 'utf-8')

        // Write all collected files in deterministic alphabetical order
        const allEntries: PackFileEntry[] = []
        if (contents.policy) allEntries.push(contents.policy)
        if (contents.agentPolicy) allEntries.push(contents.agentPolicy)
        allEntries.push(...contents.rules)
        allEntries.push(...contents.claudeFragments)

        // Sort entries by packPath for deterministic output
        allEntries.sort((a, b) => a.packPath.localeCompare(b.packPath))

        for (const entry of allEntries) {
            const filePath = path.join(tmpPath, entry.packPath)
            const fileDir = path.dirname(filePath)

            // Ensure subdirectory exists
            if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir, { recursive: true })
            }

            fs.writeFileSync(filePath, entry.content, 'utf-8')
            totalSize += Buffer.byteLength(entry.content, 'utf-8')
        }

        // Atomic rename: tmp -> final
        if (fs.existsSync(outputPath)) {
            fs.rmSync(outputPath, { recursive: true, force: true })
        }
        fs.renameSync(tmpPath, outputPath)

        return {
            archivePath: outputPath,
            archiveSizeBytes: totalSize,
        }
    } catch (err) {
        // Clean up tmp on failure
        try {
            if (fs.existsSync(tmpPath)) {
                fs.rmSync(tmpPath, { recursive: true, force: true })
            }
        } catch {
            // Ignore cleanup errors
        }
        throw err
    }
}

// ── Main Assembly Pipeline ──────────────────────────────────────────────────

/**
 * Assembles a .flint-pack from the project's governance configuration.
 *
 * 7-step pipeline:
 *   1. Read and validate .flint/policy.json
 *   2. Read and validate .flint/agent-policy.json
 *   3. Collect customized rules from the policy's rule-mode map
 *   4. Collect .claude/ fragments if include_claude_fragments paths provided
 *   5. Run security scanner on all collected files
 *   6. Generate manifest.json with SHA-256 checksums
 *   7. If not dry_run, write the pack directory atomically
 */
export async function assemblePack(options: PackAssemblyOptions): Promise<PackExportResult> {
    const allErrors: PackValidationError[] = []

    // Step 1: Collect policy
    const {
        entry: policyEntry,
        resolvedPolicy,
        errors: policyErrors,
    } = collectPolicy(options.projectRoot)
    allErrors.push(...policyErrors)

    // Step 2: Collect agent policy
    const {
        entry: agentPolicyEntry,
        errors: agentPolicyErrors,
    } = collectAgentPolicy(options.projectRoot)
    allErrors.push(...agentPolicyErrors)

    // Step 3: Collect customized rules
    const ruleEntries = collectCustomizedRules(resolvedPolicy)

    // Step 4: Collect claude fragments
    let fragmentEntries: PackFileEntry[] = []
    if (options.include_claude_fragments && options.include_claude_fragments.length > 0) {
        const {
            entries,
            errors: fragmentErrors,
        } = collectClaudeFragments(options.projectRoot, options.include_claude_fragments)
        fragmentEntries = entries
        allErrors.push(...fragmentErrors)
    }

    // Assemble PackContents
    const contents: PackContents = {
        policy: policyEntry,
        agentPolicy: agentPolicyEntry,
        rules: ruleEntries,
        claudeFragments: fragmentEntries,
    }

    // Step 5: Security scan
    const securityErrors = scanPackContents(contents)
    allErrors.push(...securityErrors)

    // Check for blocking errors (error-severity)
    const blockingErrors = allErrors.filter(e => e.severity === 'error')

    // Step 6: Generate manifest
    const manifest = generateManifest(options, contents, resolvedPolicy)

    if (blockingErrors.length > 0) {
        // Return error result -- do not write
        const dryResult: PackExportDryRunResult = {
            dry_run: true,
            manifest,
            files: getAllFileEntries(contents).map(e => ({
                path: e.packPath,
                size_bytes: Buffer.byteLength(e.content, 'utf-8'),
                checksum: e.checksum,
            })),
            validation_errors: allErrors,
            summary: `Export blocked: ${blockingErrors.length} error(s) found. Fix errors and retry.`,
        }
        return dryResult
    }

    // Dry run path
    if (options.dry_run) {
        const dryResult: PackExportDryRunResult = {
            dry_run: true,
            manifest,
            files: getAllFileEntries(contents).map(e => ({
                path: e.packPath,
                size_bytes: Buffer.byteLength(e.content, 'utf-8'),
                checksum: e.checksum,
            })),
            validation_errors: allErrors,
            summary: `Dry run: ${getAllFileEntries(contents).length} files would be bundled into ${options.id}.flint-pack/`,
        }
        return dryResult
    }

    // Step 7: Write pack directory
    const outputPath = options.output_path ?? path.join(options.projectRoot, `${options.id}.flint-pack`)

    const { archivePath, archiveSizeBytes } = writePackDirectory(manifest, contents, outputPath)

    const writeResult: PackExportWriteResult = {
        dry_run: false,
        manifest,
        archive_path: archivePath,
        archive_size_bytes: archiveSizeBytes,
        file_count: getAllFileEntries(contents).length + 1, // +1 for manifest.json
        validation_errors: allErrors, // Warnings only at this point
        summary: `Exported ${getAllFileEntries(contents).length + 1} files to ${archivePath}`,
    }

    return writeResult
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Collects all non-null file entries from PackContents into a flat array.
 */
function getAllFileEntries(contents: PackContents): PackFileEntry[] {
    const entries: PackFileEntry[] = []
    if (contents.policy) entries.push(contents.policy)
    if (contents.agentPolicy) entries.push(contents.agentPolicy)
    entries.push(...contents.rules)
    entries.push(...contents.claudeFragments)
    return entries
}
