/**
 * Pack Import Service Tests -- flint-mcp/src/core/__tests__/packImportService.test.ts
 *
 * GPX.2: Tests for the core import engine — manifest validation, conflict
 * detection, merge strategies, snapshot/rollback, and security scanning.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {
    validateManifest,
    verifyChecksums,
    securityScanPack,
    readProjectState,
    detectConflicts,
    createSnapshot,
    importPack,
    rollbackImport,
} from '../packImportService.js'
import { sha256 } from '../packAssembler.js'
import type { PackManifest } from '../packTypes.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-import-test-'))
})

afterEach(() => {
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

function writeFile(relPath: string, content: string): void {
    const fullPath = path.join(tmpDir, relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
}

function readFile(relPath: string): string {
    return fs.readFileSync(path.join(tmpDir, relPath), 'utf-8')
}

function fileExists(relPath: string): boolean {
    return fs.existsSync(path.join(tmpDir, relPath))
}

function makeManifest(overrides: Partial<PackManifest> = {}): PackManifest {
    return {
        schema_version: 1,
        id: 'test-pack',
        name: 'Test Pack',
        version: '1.0.0',
        description: 'A test governance pack',
        author: { name: 'Test Author' },
        trust_tier: 'community',
        domain: 'general',
        stack_tags: ['react'],
        compatibility: { flint_min_version: '1.0.0', flint_max_version: null },
        dependencies: [],
        contents: {
            policy: false,
            agent_policy: false,
            rules: [],
            claude_fragments: [],
        },
        checksums: {},
        published_at: '2026-03-21T00:00:00Z',
        ...overrides,
    } as PackManifest
}

function createPackDir(manifest: PackManifest, files: Record<string, string> = {}): string {
    const packDir = path.join(tmpDir, 'pack')
    fs.mkdirSync(packDir, { recursive: true })

    // Compute checksums for all files
    const checksums: Record<string, string> = {}
    for (const [relPath, content] of Object.entries(files)) {
        const fullPath = path.join(packDir, relPath)
        fs.mkdirSync(path.dirname(fullPath), { recursive: true })
        fs.writeFileSync(fullPath, content, 'utf-8')
        checksums[relPath] = `sha256:${sha256(content)}`
    }

    manifest.checksums = checksums

    fs.writeFileSync(
        path.join(packDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf-8',
    )

    return packDir
}

function createProjectDir(): string {
    const projectDir = path.join(tmpDir, 'project')
    fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })
    return projectDir
}

// ── validateManifest ────────────────────────────────────────────────────────

describe('validateManifest', () => {
    it('valid manifest passes validation', () => {
        const manifest = makeManifest()
        expect(validateManifest(manifest)).toEqual([])
    })

    it('missing schema_version fails', () => {
        const manifest = makeManifest()
        delete (manifest as Record<string, unknown>).schema_version
        const errors = validateManifest(manifest)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0]).toContain('schema_version')
    })

    it('invalid id format (uppercase) fails', () => {
        const manifest = makeManifest({ id: 'TestPack' } as Partial<PackManifest>)
        const errors = validateManifest(manifest)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0]).toContain('id')
    })

    it('invalid id format (spaces) fails', () => {
        const manifest = makeManifest({ id: 'test pack' } as Partial<PackManifest>)
        const errors = validateManifest(manifest)
        expect(errors.length).toBeGreaterThan(0)
    })

    it('invalid semver version fails', () => {
        const manifest = makeManifest({ version: 'not-semver' } as Partial<PackManifest>)
        const errors = validateManifest(manifest)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0]).toContain('version')
    })

    it('invalid domain fails', () => {
        const manifest = makeManifest()
        ;(manifest as Record<string, unknown>).domain = 'invalid-domain'
        const errors = validateManifest(manifest)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0]).toContain('domain')
    })

    it('non-object input fails', () => {
        const errors = validateManifest('not-an-object')
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0]).toContain('non-null object')
    })

    it('null input fails', () => {
        const errors = validateManifest(null)
        expect(errors.length).toBeGreaterThan(0)
    })
})

// ── verifyChecksums ─────────────────────────────────────────────────────────

describe('verifyChecksums', () => {
    it('valid checksums pass', () => {
        const content = '{"test": true}'
        const packDir = path.join(tmpDir, 'checksum-pack')
        fs.mkdirSync(packDir, { recursive: true })
        fs.writeFileSync(path.join(packDir, 'test.json'), content, 'utf-8')

        const checksums = { 'test.json': `sha256:${sha256(content)}` }
        const errors = verifyChecksums(packDir, checksums)
        expect(errors).toEqual([])
    })

    it('checksum mismatch fails', () => {
        const packDir = path.join(tmpDir, 'checksum-pack')
        fs.mkdirSync(packDir, { recursive: true })
        fs.writeFileSync(path.join(packDir, 'test.json'), '{"test": true}', 'utf-8')

        const checksums = { 'test.json': 'sha256:0000000000000000' }
        const errors = verifyChecksums(packDir, checksums)
        expect(errors.length).toBe(1)
        expect(errors[0]).toContain('Checksum mismatch')
    })

    it('missing file in checksums fails', () => {
        const packDir = path.join(tmpDir, 'checksum-pack')
        fs.mkdirSync(packDir, { recursive: true })

        const checksums = { 'missing.json': 'sha256:abc' }
        const errors = verifyChecksums(packDir, checksums)
        expect(errors.length).toBe(1)
        expect(errors[0]).toContain('not found')
    })
})

// ── securityScanPack ────────────────────────────────────────────────────────

describe('securityScanPack', () => {
    it('clean pack passes security scan', () => {
        const packDir = path.join(tmpDir, 'clean-pack')
        fs.mkdirSync(packDir, { recursive: true })
        fs.writeFileSync(
            path.join(packDir, 'policy.json'),
            '{"version": 2, "domain": "general"}',
            'utf-8',
        )
        const errors = securityScanPack(packDir)
        expect(errors).toEqual([])
    })

    it('detects secrets in pack files', () => {
        const packDir = path.join(tmpDir, 'secret-pack')
        fs.mkdirSync(packDir, { recursive: true })
        fs.writeFileSync(
            path.join(packDir, 'config.json'),
            '{"api_key": "sk-ant-abcdefghijklmnopqrstuvwxyz"}',
            'utf-8',
        )
        const errors = securityScanPack(packDir)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0]).toContain('Security')
    })
})

// ── readProjectState ────────────────────────────────────────────────────────

describe('readProjectState', () => {
    it('reads empty project state', () => {
        const projectDir = createProjectDir()
        const state = readProjectState(projectDir)
        expect(state.policy).toBeNull()
        expect(state.agentPolicy).toBeNull()
        expect(state.existingFragments.size).toBe(0)
        expect(state.existingRules.size).toBe(0)
    })

    it('reads existing policy', () => {
        const projectDir = createProjectDir()
        const policy = {
            version: 2,
            domain: 'general',
            mithril: { deltaE_threshold: 2.0, mode: 'blocking' },
            a11y: { level: 'AA', mode: 'blocking' },
        }
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify(policy),
            'utf-8',
        )
        const state = readProjectState(projectDir)
        expect(state.policy).not.toBeNull()
        expect(state.policy!.mithril.deltaE_threshold).toBe(2.0)
    })

    it('reads existing fragments', () => {
        const projectDir = createProjectDir()
        const claudeDir = path.join(projectDir, '.claude', 'agents')
        fs.mkdirSync(claudeDir, { recursive: true })
        fs.writeFileSync(path.join(claudeDir, 'sentinel.md'), '# Sentinel', 'utf-8')

        const state = readProjectState(projectDir)
        expect(state.existingFragments.has('agents/sentinel.md')).toBe(true)
        expect(state.existingFragments.get('agents/sentinel.md')).toBe('# Sentinel')
    })
})

// ── detectConflicts ─────────────────────────────────────────────────────────

describe('detectConflicts', () => {
    it('no conflicts when project has no policy and pack has policy', () => {
        const projectDir = createProjectDir()
        const state = readProjectState(projectDir)
        const manifest = makeManifest({ contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] } })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 3.0 } }),
        })
        const conflicts = detectConflicts(manifest, packDir, state)
        expect(conflicts).toEqual([])
    })

    it('detects policy value conflict: deltaE_threshold', () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 2.0 } }),
            'utf-8',
        )
        const state = readProjectState(projectDir)
        const manifest = makeManifest({ contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] } })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 5.0 } }),
        })

        const conflicts = detectConflicts(manifest, packDir, state)
        expect(conflicts.length).toBeGreaterThan(0)
        const deConflict = conflicts.find(c => c.key === 'mithril.deltaE_threshold')
        expect(deConflict).toBeDefined()
        expect(deConflict!.currentValue).toBe(2.0)
        expect(deConflict!.incomingValue).toBe(5.0)
    })

    it('detects policy value conflict: a11y level', () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, a11y: { level: 'AA' } }),
            'utf-8',
        )
        const state = readProjectState(projectDir)
        const manifest = makeManifest({ contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] } })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, a11y: { level: 'AAA' } }),
        })

        const conflicts = detectConflicts(manifest, packDir, state)
        const a11yConflict = conflicts.find(c => c.key === 'a11y.level')
        expect(a11yConflict).toBeDefined()
    })

    it('detects domain conflict as blocking severity', () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, domain: 'general' }),
            'utf-8',
        )
        const state = readProjectState(projectDir)
        const manifest = makeManifest({
            domain: 'healthcare',
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        } as Partial<PackManifest>)
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'healthcare' }),
        })

        const conflicts = detectConflicts(manifest, packDir, state)
        const domainConflict = conflicts.find(c => c.key === 'domain')
        expect(domainConflict).toBeDefined()
        expect(domainConflict!.severity).toBe('blocking')
    })

    it('detects agent ID conflict: different tier', () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'agent-policy.json'),
            JSON.stringify({ agents: [{ agentId: 'sentinel', tier: 'standard' }] }),
            'utf-8',
        )
        const state = readProjectState(projectDir)
        const manifest = makeManifest({ contents: { policy: false, agent_policy: true, rules: [], claude_fragments: [] } })
        const packDir = createPackDir(manifest, {
            'agent-policy.json': JSON.stringify({ agents: [{ agentId: 'sentinel', tier: 'restricted' }] }),
        })

        const conflicts = detectConflicts(manifest, packDir, state)
        const agentConflict = conflicts.find(c => c.key === 'agent:sentinel')
        expect(agentConflict).toBeDefined()
        expect(agentConflict!.domain).toBe('agent_id')
    })

    it('trust tier cap: community pack requesting elevated agent tier', () => {
        const projectDir = createProjectDir()
        const state = readProjectState(projectDir)
        const manifest = makeManifest({
            trust_tier: 'community',
            contents: { policy: false, agent_policy: true, rules: [], claude_fragments: [] },
        } as Partial<PackManifest>)
        const packDir = createPackDir(manifest, {
            'agent-policy.json': JSON.stringify({ agents: [{ agentId: 'rogue', tier: 'elevated' }] }),
        })

        const conflicts = detectConflicts(manifest, packDir, state)
        const trustConflict = conflicts.find(c => c.key === 'agent:rogue:trust-cap')
        expect(trustConflict).toBeDefined()
        expect(trustConflict!.severity).toBe('blocking')
        expect(trustConflict!.message).toContain('Community packs cannot grant')
    })

    it('detects fragment file conflict: file exists with different content', () => {
        const projectDir = createProjectDir()
        const claudeDir = path.join(projectDir, '.claude', 'agents')
        fs.mkdirSync(claudeDir, { recursive: true })
        fs.writeFileSync(path.join(claudeDir, 'sentinel.md'), '# Old Sentinel', 'utf-8')
        const state = readProjectState(projectDir)

        const manifest = makeManifest({
            contents: {
                policy: false,
                agent_policy: false,
                rules: [],
                claude_fragments: ['agents/sentinel.md'],
            },
        })
        const packDir = createPackDir(manifest, {
            'claude-fragments/agents/sentinel.md': '# New Sentinel',
        })

        const conflicts = detectConflicts(manifest, packDir, state)
        const fragConflict = conflicts.find(c => c.key === 'fragment:agents/sentinel.md')
        expect(fragConflict).toBeDefined()
        expect(fragConflict!.domain).toBe('fragment_file')
    })

    it('no conflict when fragment file exists with identical content', () => {
        const projectDir = createProjectDir()
        const claudeDir = path.join(projectDir, '.claude', 'agents')
        fs.mkdirSync(claudeDir, { recursive: true })
        fs.writeFileSync(path.join(claudeDir, 'sentinel.md'), '# Same Content', 'utf-8')
        const state = readProjectState(projectDir)

        const manifest = makeManifest({
            contents: {
                policy: false,
                agent_policy: false,
                rules: [],
                claude_fragments: ['agents/sentinel.md'],
            },
        })
        const packDir = createPackDir(manifest, {
            'claude-fragments/agents/sentinel.md': '# Same Content',
        })

        const conflicts = detectConflicts(manifest, packDir, state)
        const fragConflict = conflicts.find(c => c.key === 'fragment:agents/sentinel.md')
        expect(fragConflict).toBeUndefined()
    })
})

// ── importPack: merge strategies ─────────────────────────────────────────────

describe('importPack', () => {
    it('import from directory with policy.json only', async () => {
        const projectDir = createProjectDir()
        const policyContent = JSON.stringify({
            version: 2,
            domain: 'general',
            mithril: { deltaE_threshold: 3.0 },
        })
        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, { 'policy.json': policyContent })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'override',
        })

        expect(result.success).toBe(true)
        expect(result.filesWritten).toContain('.flint/policy.json')
        expect(result.snapshotId).toBeTruthy()
    })

    it('import with agent-policy.json', async () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest({
            contents: { policy: false, agent_policy: true, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'agent-policy.json': JSON.stringify({
                agents: [{ agentId: 'new-agent', tier: 'standard' }],
            }),
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'override',
        })

        expect(result.success).toBe(true)
        expect(result.filesWritten).toContain('.flint/agent-policy.json')
    })

    it('import with CLAUDE fragments', async () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest({
            contents: {
                policy: false,
                agent_policy: false,
                rules: [],
                claude_fragments: ['agents/hipaa-sentinel.md'],
            },
        })
        const packDir = createPackDir(manifest, {
            'claude-fragments/agents/hipaa-sentinel.md': '# HIPAA Sentinel\nGovernance agent',
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'override',
        })

        expect(result.success).toBe(true)
        expect(result.filesWritten).toContain('.claude/agents/hipaa-sentinel.md')

        // Verify file written
        const written = fs.readFileSync(
            path.join(projectDir, '.claude', 'agents', 'hipaa-sentinel.md'),
            'utf-8',
        )
        expect(written).toContain('HIPAA Sentinel')
    })

    it('override strategy applies all incoming values', async () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 2.0 } }),
            'utf-8',
        )

        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 5.0 } }),
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'override',
        })

        expect(result.success).toBe(true)
        const updatedPolicy = JSON.parse(
            fs.readFileSync(path.join(projectDir, '.flint', 'policy.json'), 'utf-8'),
        )
        expect(updatedPolicy.mithril.deltaE_threshold).toBe(5.0)
    })

    it('skip-conflicts strategy skips conflicting values', async () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 2.0 } }),
            'utf-8',
        )

        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 5.0 } }),
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'skip-conflicts',
        })

        expect(result.success).toBe(true)
        expect(result.skippedConflicts.length).toBeGreaterThan(0)

        // Project value should be retained
        const updatedPolicy = JSON.parse(
            fs.readFileSync(path.join(projectDir, '.flint', 'policy.json'), 'utf-8'),
        )
        expect(updatedPolicy.mithril.deltaE_threshold).toBe(2.0)
    })

    it('interactive strategy returns needsResolution when no resolutions provided', async () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 2.0 } }),
            'utf-8',
        )

        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 5.0 } }),
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'interactive',
        })

        expect(result.success).toBe(false)
        expect(result.conflicts.length).toBeGreaterThan(0)
        expect(result.snapshotId).toBeNull()
    })

    it('interactive with resolutions applies them', async () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 2.0 } }),
            'utf-8',
        )

        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 5.0 } }),
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'interactive',
            resolutions: [
                { key: 'mithril.deltaE_threshold', action: 'accept_incoming' },
            ],
        })

        expect(result.success).toBe(true)
        const updatedPolicy = JSON.parse(
            fs.readFileSync(path.join(projectDir, '.flint', 'policy.json'), 'utf-8'),
        )
        expect(updatedPolicy.mithril.deltaE_threshold).toBe(5.0)
    })

    it('interactive with keep_current resolution retains project value', async () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 2.0 } }),
            'utf-8',
        )

        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 5.0 } }),
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'interactive',
            resolutions: [
                { key: 'mithril.deltaE_threshold', action: 'keep_current' },
            ],
        })

        expect(result.success).toBe(true)
        const updatedPolicy = JSON.parse(
            fs.readFileSync(path.join(projectDir, '.flint', 'policy.json'), 'utf-8'),
        )
        expect(updatedPolicy.mithril.deltaE_threshold).toBe(2.0)
    })

    it('dry run returns preview without writing files', async () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 3.0 } }),
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            dryRun: true,
        })

        expect(result.success).toBe(false)
        expect(result.filesWritten.length).toBeGreaterThan(0)
        expect(result.snapshotId).toBeNull()
        // Verify no actual files written
        expect(fs.existsSync(path.join(projectDir, '.flint', 'policy.json'))).toBe(false)
    })

    it('security scan blocks import with secrets', async () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest({
            contents: {
                policy: false,
                agent_policy: false,
                rules: [],
                claude_fragments: ['agents/evil.md'],
            },
        })
        const packDir = createPackDir(manifest, {
            'claude-fragments/agents/evil.md': 'Use this key: sk-ant-abcdefghijklmnopqrstuvwxyz',
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Security scan failed')
    })

    it('missing pack path returns error', async () => {
        const result = await importPack({
            packPath: '/nonexistent/path',
            projectRoot: tmpDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('does not exist')
    })

    it('invalid manifest returns error', async () => {
        const packDir = path.join(tmpDir, 'bad-pack')
        fs.mkdirSync(packDir, { recursive: true })
        fs.writeFileSync(
            path.join(packDir, 'manifest.json'),
            JSON.stringify({ schema_version: 99, id: 'INVALID' }),
            'utf-8',
        )

        const result = await importPack({
            packPath: packDir,
            projectRoot: tmpDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid manifest')
    })

    it('missing manifest.json returns error', async () => {
        const packDir = path.join(tmpDir, 'empty-pack')
        fs.mkdirSync(packDir, { recursive: true })

        const result = await importPack({
            packPath: packDir,
            projectRoot: tmpDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('missing manifest.json')
    })

    it('empty pack (no policy, no agents, no fragments) succeeds', async () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest()
        const packDir = createPackDir(manifest)

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'override',
        })

        expect(result.success).toBe(true)
        expect(result.filesWritten).toEqual([])
    })

    it('pack with only fragments merges correctly', async () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest({
            contents: {
                policy: false,
                agent_policy: false,
                rules: [],
                claude_fragments: ['agents/test.md'],
            },
        })
        const packDir = createPackDir(manifest, {
            'claude-fragments/agents/test.md': '# Test Agent',
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(true)
        expect(result.filesWritten).toContain('.claude/agents/test.md')
    })

    it('skip-conflicts skips existing fragment files', async () => {
        const projectDir = createProjectDir()
        const claudeDir = path.join(projectDir, '.claude', 'agents')
        fs.mkdirSync(claudeDir, { recursive: true })
        fs.writeFileSync(path.join(claudeDir, 'existing.md'), '# Old', 'utf-8')

        const manifest = makeManifest({
            contents: {
                policy: false,
                agent_policy: false,
                rules: [],
                claude_fragments: ['agents/existing.md', 'agents/new.md'],
            },
        })
        const packDir = createPackDir(manifest, {
            'claude-fragments/agents/existing.md': '# New',
            'claude-fragments/agents/new.md': '# Brand New',
        })

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'skip-conflicts',
        })

        expect(result.success).toBe(true)
        expect(result.skippedConflicts.length).toBe(1)
        expect(result.filesWritten).toContain('.claude/agents/new.md')

        // Old file untouched
        const oldContent = fs.readFileSync(path.join(claudeDir, 'existing.md'), 'utf-8')
        expect(oldContent).toBe('# Old')
    })

    it('checksum mismatch blocks import', async () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        // Create pack with wrong checksums
        const packDir = path.join(tmpDir, 'bad-checksum-pack')
        fs.mkdirSync(packDir, { recursive: true })
        const policyContent = JSON.stringify({ version: 2, domain: 'general' })
        fs.writeFileSync(path.join(packDir, 'policy.json'), policyContent, 'utf-8')
        manifest.checksums = { 'policy.json': 'sha256:wrong' }
        fs.writeFileSync(
            path.join(packDir, 'manifest.json'),
            JSON.stringify(manifest),
            'utf-8',
        )

        const result = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Checksum verification failed')
    })
})

// ── Snapshot + Rollback ─────────────────────────────────────────────────────

describe('createSnapshot', () => {
    it('snapshot directory created with correct files', () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2 }),
            'utf-8',
        )

        const manifest = makeManifest()
        const snapshot = createSnapshot(projectDir, manifest)

        expect(snapshot.id).toBeTruthy()
        expect(fs.existsSync(snapshot.snapshotPath)).toBe(true)
        expect(snapshot.backedUpFiles).toContain('.flint/policy.json')

        // Verify snapshot-meta.json exists
        expect(fs.existsSync(path.join(snapshot.snapshotPath, 'snapshot-meta.json'))).toBe(true)

        // Verify index.json exists
        const indexPath = path.join(projectDir, '.flint', 'pack-snapshots', 'index.json')
        expect(fs.existsSync(indexPath)).toBe(true)
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
        expect(index.snapshots.length).toBe(1)
    })

    it('11th snapshot prunes oldest', () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest()

        const snapshots: string[] = []
        for (let i = 0; i < 11; i++) {
            const s = createSnapshot(projectDir, manifest)
            snapshots.push(s.id)
        }

        const indexPath = path.join(projectDir, '.flint', 'pack-snapshots', 'index.json')
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
        expect(index.snapshots.length).toBe(10)

        // First snapshot should be pruned
        expect(index.snapshots.find((s: { id: string }) => s.id === snapshots[0])).toBeUndefined()
        // Last snapshot should exist
        expect(index.snapshots.find((s: { id: string }) => s.id === snapshots[10])).toBeDefined()
    })
})

describe('rollbackImport', () => {
    it('rollback restores files', async () => {
        const projectDir = createProjectDir()
        const originalPolicy = JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 2.0 } })
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            originalPolicy,
            'utf-8',
        )

        // Import a pack
        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 8.0 } }),
        })

        const importResult = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'override',
        })
        expect(importResult.success).toBe(true)

        // Verify policy changed
        const changedPolicy = JSON.parse(
            fs.readFileSync(path.join(projectDir, '.flint', 'policy.json'), 'utf-8'),
        )
        expect(changedPolicy.mithril.deltaE_threshold).toBe(8.0)

        // Rollback
        const rollbackResult = await rollbackImport({
            snapshotId: importResult.snapshotId!,
            projectRoot: projectDir,
        })

        expect(rollbackResult.success).toBe(true)
        expect(rollbackResult.filesRestored.length).toBeGreaterThan(0)

        // Verify policy restored
        const restoredPolicy = JSON.parse(
            fs.readFileSync(path.join(projectDir, '.flint', 'policy.json'), 'utf-8'),
        )
        expect(restoredPolicy.mithril.deltaE_threshold).toBe(2.0)
    })

    it('rollback removes import-added files', async () => {
        const projectDir = createProjectDir()

        const manifest = makeManifest({
            contents: {
                policy: false,
                agent_policy: false,
                rules: [],
                claude_fragments: ['agents/new-sentinel.md'],
            },
        })
        const packDir = createPackDir(manifest, {
            'claude-fragments/agents/new-sentinel.md': '# New Sentinel',
        })

        const importResult = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'override',
        })
        expect(importResult.success).toBe(true)
        expect(fs.existsSync(path.join(projectDir, '.claude', 'agents', 'new-sentinel.md'))).toBe(true)

        // Rollback
        const rollbackResult = await rollbackImport({
            snapshotId: importResult.snapshotId!,
            projectRoot: projectDir,
        })

        expect(rollbackResult.success).toBe(true)
        // Added file should be removed
        expect(fs.existsSync(path.join(projectDir, '.claude', 'agents', 'new-sentinel.md'))).toBe(false)
    })

    it('rollback with invalid snapshotId returns error', async () => {
        const projectDir = createProjectDir()
        // Create empty index
        fs.mkdirSync(path.join(projectDir, '.flint', 'pack-snapshots'), { recursive: true })
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'pack-snapshots', 'index.json'),
            JSON.stringify({ snapshots: [] }),
            'utf-8',
        )

        const result = await rollbackImport({
            snapshotId: 'nonexistent-id',
            projectRoot: projectDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('not found')
    })

    it('rollback with no snapshot index returns error', async () => {
        const projectDir = createProjectDir()

        const result = await rollbackImport({
            snapshotId: 'any-id',
            projectRoot: projectDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('No snapshot index found')
    })

    it('snapshot removed from index after rollback', async () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general' }),
        })

        const importResult = await importPack({
            packPath: packDir,
            projectRoot: projectDir,
            strategy: 'override',
        })

        await rollbackImport({
            snapshotId: importResult.snapshotId!,
            projectRoot: projectDir,
        })

        // Check index
        const indexPath = path.join(projectDir, '.flint', 'pack-snapshots', 'index.json')
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
        expect(index.snapshots.find((s: { id: string }) => s.id === importResult.snapshotId)).toBeUndefined()
    })
})
