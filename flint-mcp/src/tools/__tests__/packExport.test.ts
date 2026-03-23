/**
 * Pack Export Tool Tests -- flint-mcp/src/tools/__tests__/packExport.test.ts
 *
 * Tests the flint_pack_export MCP tool handler for GPX.1.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { handlePackExport, FLINT_PACK_EXPORT_TOOL } from '../packExport.js'

// ── Test helpers ────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-export-test-'))
})

afterEach(() => {
    if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    }
})

function writeFlintFile(relPath: string, content: string): void {
    const fullPath = path.join(tmpDir, relPath)
    const dir = path.dirname(fullPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
}

function parseResponse(result: { content: Array<{ type: string; text: string }> }): unknown {
    return JSON.parse(result.content[0].text)
}

const baseArgs = {
    id: 'test-pack',
    name: 'Test Pack',
    version: '1.0.0',
    description: 'A test governance pack',
    author: { name: 'Test Author' },
}

// ── Tool definition ─────────────────────────────────────────────────────────

describe('FLINT_PACK_EXPORT_TOOL', () => {
    it('has the correct tool name', () => {
        expect(FLINT_PACK_EXPORT_TOOL.name).toBe('flint_pack_export')
    })

    it('requires id, name, version, description, author', () => {
        expect(FLINT_PACK_EXPORT_TOOL.inputSchema.required).toEqual(
            ['id', 'name', 'version', 'description', 'author'],
        )
    })
})

// ── handlePackExport ────────────────────────────────────────────────────────

describe('handlePackExport', () => {
    it('with valid project returns success result', async () => {
        writeFlintFile('.flint/policy.json', JSON.stringify({ version: 2 }))

        const result = await handlePackExport(
            { ...baseArgs, dry_run: true, projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.dry_run).toBe(true)
        expect(parsed.manifest.id).toBe('test-pack')
        expect(parsed.manifest.name).toBe('Test Pack')
    })

    it('dry_run returns preview without writing', async () => {
        writeFlintFile('.flint/policy.json', JSON.stringify({ version: 2 }))

        const result = await handlePackExport(
            { ...baseArgs, dry_run: true, projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.dry_run).toBe(true)

        // No pack directory should exist
        const packPath = path.join(tmpDir, 'test-pack.flint-pack')
        expect(fs.existsSync(packPath)).toBe(false)
    })

    it('rejects invalid pack ID (spaces)', async () => {
        const result = await handlePackExport(
            { ...baseArgs, id: 'invalid pack id', projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.error).toBe(true)
        expect(parsed.code).toBe('INVALID_PACK_ID')
    })

    it('rejects invalid pack ID (uppercase)', async () => {
        const result = await handlePackExport(
            { ...baseArgs, id: 'InvalidPack', projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.error).toBe(true)
        expect(parsed.code).toBe('INVALID_PACK_ID')
    })

    it('rejects invalid semver version', async () => {
        const result = await handlePackExport(
            { ...baseArgs, version: 'not-a-version', projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.error).toBe(true)
        expect(parsed.code).toBe('INVALID_SEMVER')
    })

    it('blocks export when secrets detected in policy', async () => {
        writeFlintFile('.flint/policy.json', JSON.stringify({
            version: 2,
            api_key: 'sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        }))

        const result = await handlePackExport(
            { ...baseArgs, projectRoot: tmpDir, dry_run: false },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        // Export should be blocked (returns dry_run=true with errors)
        expect(parsed.dry_run).toBe(true)
        expect(parsed.validation_errors.some((e: any) => e.code === 'SECRET_DETECTED')).toBe(true)
    })

    it('blocks export when secrets detected in fragments', async () => {
        writeFlintFile('.flint/policy.json', JSON.stringify({ version: 2 }))
        writeFlintFile('.claude/agents/secret-agent.md',
            '# Agent\napi_key = "sk-ant-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"')

        const result = await handlePackExport(
            {
                ...baseArgs,
                projectRoot: tmpDir,
                include_claude_fragments: ['agents/secret-agent.md'],
                dry_run: false,
            },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.dry_run).toBe(true)
        expect(parsed.validation_errors.some((e: any) => e.code === 'SECRET_DETECTED')).toBe(true)
    })

    it('succeeds with empty project (no policy, no agent-policy)', async () => {
        const result = await handlePackExport(
            { ...baseArgs, dry_run: true, projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.dry_run).toBe(true)
        expect(parsed.manifest.contents.policy).toBe(false)
        expect(parsed.manifest.contents.agent_policy).toBe(false)
    })

    it('includes customized rules in result', async () => {
        writeFlintFile('.flint/policy.json', JSON.stringify({
            version: 2,
            mithril: { rules: { 'MITHRIL-COL': 'advisory' } },
        }))

        const result = await handlePackExport(
            { ...baseArgs, dry_run: true, projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.manifest.contents.rules).toContain('MITHRIL-COL')
    })

    it('respects custom output_path', async () => {
        writeFlintFile('.flint/policy.json', JSON.stringify({ version: 2 }))

        const customOutput = path.join(tmpDir, 'custom-dir', 'my-pack.flint-pack')

        const result = await handlePackExport(
            { ...baseArgs, output_path: customOutput, projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.dry_run).toBe(false)
        expect(parsed.archive_path).toBe(customOutput)
        expect(fs.existsSync(customOutput)).toBe(true)
    })

    it('with missing author name returns error', async () => {
        const result = await handlePackExport(
            { ...baseArgs, author: { name: '' }, projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.error).toBe(true)
        expect(parsed.code).toBe('INVALID_AUTHOR')
    })

    it('uses defaultProjectRoot when projectRoot not provided', async () => {
        // Create .flint in tmpDir (used as defaultProjectRoot)
        writeFlintFile('.flint/policy.json', JSON.stringify({ version: 2 }))

        const result = await handlePackExport(
            { ...baseArgs, dry_run: true },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.dry_run).toBe(true)
        expect(parsed.manifest.id).toBe('test-pack')
    })

    it('accepts valid semver with prerelease', async () => {
        writeFlintFile('.flint/policy.json', JSON.stringify({ version: 2 }))

        const result = await handlePackExport(
            { ...baseArgs, version: '1.0.0-beta.1', dry_run: true, projectRoot: tmpDir },
            tmpDir,
        )

        const parsed = parseResponse(result) as any
        expect(parsed.manifest.version).toBe('1.0.0-beta.1')
    })

    it('produces deterministic manifest for same inputs', async () => {
        writeFlintFile('.flint/policy.json', JSON.stringify({ version: 2 }))

        const result1 = await handlePackExport(
            { ...baseArgs, dry_run: true, projectRoot: tmpDir },
            tmpDir,
        )

        const result2 = await handlePackExport(
            { ...baseArgs, dry_run: true, projectRoot: tmpDir },
            tmpDir,
        )

        const parsed1 = parseResponse(result1) as any
        const parsed2 = parseResponse(result2) as any

        // Checksums should match (published_at may differ)
        expect(parsed1.manifest.checksums).toEqual(parsed2.manifest.checksums)
    })
})
