/**
 * Pack Import Tool Tests -- flint-mcp/src/tools/__tests__/packImport.test.ts
 *
 * GPX.2: Tests for the flint_pack_import and flint_pack_rollback MCP tool handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
    handlePackImport,
    handlePackRollback,
    FLINT_PACK_IMPORT_TOOL,
    FLINT_PACK_ROLLBACK_TOOL,
} from '../packImport.js'
import { sha256 } from '../../core/packAssembler.js'
import type { PackManifest } from '../../core/packTypes.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-import-tool-test-'))
})

afterEach(() => {
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

function parseResponse(result: { content: Array<{ type: string; text: string }> }): Record<string, unknown> {
    return JSON.parse(result.content[0].text)
}

function makeManifest(overrides: Partial<PackManifest> = {}): PackManifest {
    return {
        schema_version: 1,
        id: 'test-tool-pack',
        name: 'Test Tool Pack',
        version: '1.0.0',
        description: 'A test governance pack for tool testing',
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

// ── Tool definitions ────────────────────────────────────────────────────────

describe('FLINT_PACK_IMPORT_TOOL', () => {
    it('has the correct tool name', () => {
        expect(FLINT_PACK_IMPORT_TOOL.name).toBe('flint_pack_import')
    })

    it('requires source and projectRoot', () => {
        expect(FLINT_PACK_IMPORT_TOOL.inputSchema.required).toEqual(['source', 'projectRoot'])
    })
})

describe('FLINT_PACK_ROLLBACK_TOOL', () => {
    it('has the correct tool name', () => {
        expect(FLINT_PACK_ROLLBACK_TOOL.name).toBe('flint_pack_rollback')
    })

    it('requires snapshotId and projectRoot', () => {
        expect(FLINT_PACK_ROLLBACK_TOOL.inputSchema.required).toEqual(['snapshotId', 'projectRoot'])
    })
})

// ── handlePackImport ────────────────────────────────────────────────────────

describe('handlePackImport', () => {
    it('valid source returns success', async () => {
        const projectDir = createProjectDir()
        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general' }),
        })

        const result = await handlePackImport({
            source: packDir,
            projectRoot: projectDir,
        })

        const parsed = parseResponse(result)
        expect(parsed.success).toBe(true)
        expect(parsed.snapshotId).toBeTruthy()
    })

    it('missing source param returns error', async () => {
        const result = await handlePackImport({
            source: '',
            projectRoot: tmpDir,
        })

        const parsed = parseResponse(result)
        expect(parsed.error).toBe(true)
        expect(parsed.code).toBe('MISSING_SOURCE')
    })

    it('nonexistent source path returns error', async () => {
        const result = await handlePackImport({
            source: '/nonexistent/path/to/pack',
            projectRoot: tmpDir,
        })

        const parsed = parseResponse(result)
        expect(parsed.success).toBe(false)
        expect(parsed.error).toContain('does not exist')
    })

    it('missing projectRoot param returns error', async () => {
        const result = await handlePackImport({
            source: tmpDir,
            projectRoot: '',
        })

        const parsed = parseResponse(result)
        expect(parsed.error).toBe(true)
        expect(parsed.code).toBe('MISSING_PROJECT_ROOT')
    })

    it('dry_run returns conflicts without writing', async () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, mithril: { deltaE_threshold: 2.0 } }),
            'utf-8',
        )

        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, mithril: { deltaE_threshold: 5.0 } }),
        })

        const result = await handlePackImport({
            source: packDir,
            projectRoot: projectDir,
            dry_run: true,
        })

        const parsed = parseResponse(result)
        expect(parsed.success).toBe(false)
        expect((parsed.filesWritten as string[]).length).toBeGreaterThan(0)
        expect(parsed.snapshotId).toBeNull()
    })

    it('interactive strategy returns conflicts first', async () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, mithril: { deltaE_threshold: 2.0 } }),
            'utf-8',
        )

        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, mithril: { deltaE_threshold: 5.0 } }),
        })

        const result = await handlePackImport({
            source: packDir,
            projectRoot: projectDir,
            strategy: 'interactive',
        })

        const parsed = parseResponse(result)
        expect(parsed.success).toBe(false)
        expect((parsed.conflicts as unknown[]).length).toBeGreaterThan(0)
    })

    it('interactive with resolutions writes files', async () => {
        const projectDir = createProjectDir()
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify({ version: 2, mithril: { deltaE_threshold: 2.0 } }),
            'utf-8',
        )

        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, mithril: { deltaE_threshold: 5.0 } }),
        })

        const result = await handlePackImport({
            source: packDir,
            projectRoot: projectDir,
            strategy: 'interactive',
            resolutions: [
                { key: 'mithril.deltaE_threshold', action: 'accept_incoming' },
            ],
        })

        const parsed = parseResponse(result)
        expect(parsed.success).toBe(true)
        expect(parsed.snapshotId).toBeTruthy()
    })
})

// ── handlePackRollback ──────────────────────────────────────────────────────

describe('handlePackRollback', () => {
    it('valid snapshotId restores files', async () => {
        const projectDir = createProjectDir()
        const originalPolicy = { version: 2, domain: 'general', mithril: { deltaE_threshold: 2.0 } }
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify(originalPolicy),
            'utf-8',
        )

        const manifest = makeManifest({
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
        })
        const packDir = createPackDir(manifest, {
            'policy.json': JSON.stringify({ version: 2, domain: 'general', mithril: { deltaE_threshold: 9.0 } }),
        })

        // Import first
        const importResult = await handlePackImport({
            source: packDir,
            projectRoot: projectDir,
            strategy: 'override',
        })
        const importParsed = parseResponse(importResult)
        expect(importParsed.success).toBe(true)

        // Rollback
        const rollbackResult = await handlePackRollback({
            snapshotId: importParsed.snapshotId as string,
            projectRoot: projectDir,
        })

        const parsed = parseResponse(rollbackResult)
        expect(parsed.success).toBe(true)
        expect((parsed.filesRestored as string[]).length).toBeGreaterThan(0)
    })

    it('invalid snapshotId returns error', async () => {
        const projectDir = createProjectDir()
        fs.mkdirSync(path.join(projectDir, '.flint', 'pack-snapshots'), { recursive: true })
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'pack-snapshots', 'index.json'),
            JSON.stringify({ snapshots: [] }),
            'utf-8',
        )

        const result = await handlePackRollback({
            snapshotId: 'nonexistent',
            projectRoot: projectDir,
        })

        const parsed = parseResponse(result)
        expect(parsed.success).toBe(false)
        expect(parsed.error).toContain('not found')
    })

    it('missing snapshotId param returns error', async () => {
        const result = await handlePackRollback({
            snapshotId: '',
            projectRoot: tmpDir,
        })

        const parsed = parseResponse(result)
        expect(parsed.error).toBe(true)
        expect(parsed.code).toBe('MISSING_SNAPSHOT_ID')
    })

    it('missing projectRoot param returns error', async () => {
        const result = await handlePackRollback({
            snapshotId: 'some-id',
            projectRoot: '',
        })

        const parsed = parseResponse(result)
        expect(parsed.error).toBe(true)
        expect(parsed.code).toBe('MISSING_PROJECT_ROOT')
    })
})
