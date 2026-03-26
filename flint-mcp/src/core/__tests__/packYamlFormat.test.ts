/**
 * YAML Pack Format Tests -- flint-mcp/src/core/__tests__/packYamlFormat.test.ts
 *
 * UCFG.6: Tests for the YAML-format Governance Pack Exchange.
 * Covers assembleYamlPack (export) and importYamlPack / isYamlFormatPack (import).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parse as parseYaml } from 'yaml'
import {
    assembleYamlPack,
    sha256,
} from '../packAssembler.js'
import type { PackMetadata } from '../packAssembler.js'
import {
    isYamlFormatPack,
    importYamlPack,
} from '../packImportService.js'
import type { PackManifest } from '../packTypes.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-yaml-test-'))
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

function makeMetadata(overrides: Partial<PackMetadata> = {}): PackMetadata {
    return {
        id: 'test-yaml-pack',
        name: 'Test YAML Pack',
        version: '1.0.0',
        description: 'A test governance pack in YAML format',
        author: { name: 'Test Author' },
        dry_run: false,
        ...overrides,
    }
}

function makeYamlPackDir(
    files: Record<string, string> = {},
    manifestOverrides: Partial<PackManifest> = {},
): string {
    const packDir = path.join(tmpDir, 'pack')
    fs.mkdirSync(packDir, { recursive: true })

    // Write all provided files and compute checksums
    const checksums: Record<string, string> = {}
    for (const [relPath, content] of Object.entries(files)) {
        const fullPath = path.join(packDir, relPath)
        fs.mkdirSync(path.dirname(fullPath), { recursive: true })
        fs.writeFileSync(fullPath, content, 'utf-8')
        checksums[relPath] = `sha256:${sha256(content)}`
    }

    const manifest: PackManifest = {
        schema_version: 1,
        id: 'test-yaml-pack',
        name: 'Test YAML Pack',
        version: '1.0.0',
        description: 'A test governance pack',
        author: { name: 'Test Author' },
        trust_tier: 'community',
        domain: 'general',
        stack_tags: ['react'],
        compatibility: { flint_min_version: '7.2.0', flint_max_version: null },
        dependencies: [],
        contents: {
            policy: 'flint.config.yaml' in files,
            agent_policy: false,
            rules: [],
            claude_fragments: [],
        },
        checksums,
        published_at: '2026-03-25T00:00:00Z',
        format: 'yaml',
        ...manifestOverrides,
    }

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

// ── isYamlFormatPack ─────────────────────────────────────────────────────────

describe('isYamlFormatPack', () => {
    it('returns true when format is "yaml"', () => {
        const manifest = { format: 'yaml' } as PackManifest
        expect(isYamlFormatPack(manifest)).toBe(true)
    })

    it('returns false when format is "json"', () => {
        const manifest = { format: 'json' } as PackManifest
        expect(isYamlFormatPack(manifest)).toBe(false)
    })

    it('returns false when format is absent (backward compat)', () => {
        const manifest = {} as PackManifest
        expect(isYamlFormatPack(manifest)).toBe(false)
    })
})

// ── assembleYamlPack ─────────────────────────────────────────────────────────

describe('assembleYamlPack', () => {
    it('assembles pack from existing flint.config.yaml', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        const yamlConfig = [
            'schema_version: 1.0.0',
            'project: my-app',
            'domain: healthcare',
            'rules:',
            '  mithril:',
            '    mode: coercive',
        ].join('\n')
        fs.writeFileSync(path.join(projectDir, 'flint.config.yaml'), yamlConfig, 'utf-8')

        const result = await assembleYamlPack(projectDir, makeMetadata({ dry_run: true }))

        expect(result.validationErrors.filter(e => e.severity === 'error')).toHaveLength(0)
        const yamlEntry = result.entries.find(e => e.packPath === 'flint.config.yaml')
        expect(yamlEntry).toBeDefined()
        expect(yamlEntry!.content).toContain('healthcare')
        expect(yamlEntry!.checksum).toHaveLength(64)
        expect(result.manifest.format).toBe('yaml')
    })

    it('strips project field from flint.config.yaml when assembling', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        const yamlConfig = [
            'schema_version: 1.0.0',
            'project: my-secret-project-name',
            'domain: fintech',
        ].join('\n')
        fs.writeFileSync(path.join(projectDir, 'flint.config.yaml'), yamlConfig, 'utf-8')

        const result = await assembleYamlPack(projectDir, makeMetadata({ dry_run: true }))

        const yamlEntry = result.entries.find(e => e.packPath === 'flint.config.yaml')
        expect(yamlEntry).toBeDefined()
        // The "project" field must not appear in the pack
        const parsed = parseYaml(yamlEntry!.content) as Record<string, unknown>
        expect(parsed).not.toHaveProperty('project')
        // But domain should be preserved
        expect(parsed.domain).toBe('fintech')
    })

    it('falls back to legacy JSON assembly when no flint.config.yaml exists', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        // Write legacy policy.json only — no flint.config.yaml
        const legacyPolicy = {
            version: 2,
            domain: 'e-commerce',
            mithril: { deltaE_threshold: 2.5, mode: 'blocking' },
            a11y: { level: 'AA', mode: 'blocking' },
            export_gate: { block_on_mithril: true, block_on_a11y: true },
        }
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'policy.json'),
            JSON.stringify(legacyPolicy, null, 2),
            'utf-8',
        )

        const result = await assembleYamlPack(projectDir, makeMetadata({ dry_run: true }))

        expect(result.validationErrors.filter(e => e.severity === 'error')).toHaveLength(0)
        const yamlEntry = result.entries.find(e => e.packPath === 'flint.config.yaml')
        expect(yamlEntry).toBeDefined()
        // Should have converted the legacy domain
        expect(yamlEntry!.content).toContain('e-commerce')
        expect(result.manifest.format).toBe('yaml')
    })

    it('includes design-tokens.json when present', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        // Write flint.config.yaml
        fs.writeFileSync(
            path.join(projectDir, 'flint.config.yaml'),
            'schema_version: 1.0.0\nproject: test\ndomain: general\n',
            'utf-8',
        )

        // Write design-tokens.json
        const tokens = { color: { primary: { value: '#0070f3' } } }
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'design-tokens.json'),
            JSON.stringify(tokens, null, 2),
            'utf-8',
        )

        const result = await assembleYamlPack(projectDir, makeMetadata({ dry_run: true }))

        const tokenEntry = result.entries.find(e => e.packPath === 'design-tokens.json')
        expect(tokenEntry).toBeDefined()
        expect(tokenEntry!.content).toContain('0070f3')
        expect(tokenEntry!.checksum).toHaveLength(64)
        // Checksum in manifest
        expect(result.manifest.checksums['design-tokens.json']).toBe(`sha256:${tokenEntry!.checksum}`)
    })

    it('omits design-tokens.json when not present', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        fs.writeFileSync(
            path.join(projectDir, 'flint.config.yaml'),
            'schema_version: 1.0.0\nproject: test\n',
            'utf-8',
        )

        const result = await assembleYamlPack(projectDir, makeMetadata({ dry_run: true }))

        const tokenEntry = result.entries.find(e => e.packPath === 'design-tokens.json')
        expect(tokenEntry).toBeUndefined()
    })

    it('generates manifest with format: yaml', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        fs.writeFileSync(
            path.join(projectDir, 'flint.config.yaml'),
            'schema_version: 1.0.0\nproject: test\ndomain: general\n',
            'utf-8',
        )

        const result = await assembleYamlPack(projectDir, makeMetadata({ dry_run: true }))

        expect(result.manifest.schema_version).toBe(1)
        expect(result.manifest.id).toBe('test-yaml-pack')
        expect(result.manifest.format).toBe('yaml')
        expect(result.manifest.trust_tier).toBe('community')
        // agent_policy slot must be false (subsumed into YAML)
        expect(result.manifest.contents.agent_policy).toBe(false)
    })

    it('generates valid checksums for all entries', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        fs.writeFileSync(
            path.join(projectDir, 'flint.config.yaml'),
            'schema_version: 1.0.0\nproject: test\ndomain: general\n',
            'utf-8',
        )
        const tokens = { color: { brand: { value: '#ff0000' } } }
        fs.writeFileSync(
            path.join(projectDir, '.flint', 'design-tokens.json'),
            JSON.stringify(tokens),
            'utf-8',
        )

        const result = await assembleYamlPack(projectDir, makeMetadata({ dry_run: true }))

        for (const entry of result.entries) {
            const expectedChecksum = `sha256:${sha256(entry.content)}`
            expect(result.manifest.checksums[entry.packPath]).toBe(expectedChecksum)
        }
    })

    it('writes pack directory when dry_run is false', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        fs.writeFileSync(
            path.join(projectDir, 'flint.config.yaml'),
            'schema_version: 1.0.0\nproject: test\ndomain: general\n',
            'utf-8',
        )

        const outputPath = path.join(tmpDir, 'output', 'test-yaml-pack.flint-pack')
        const result = await assembleYamlPack(
            projectDir,
            makeMetadata({ dry_run: false, output_path: outputPath }),
        )

        expect(result.written).toBe(true)
        expect(result.archivePath).toBe(outputPath)
        expect(fs.existsSync(path.join(outputPath, 'manifest.json'))).toBe(true)
        expect(fs.existsSync(path.join(outputPath, 'flint.config.yaml'))).toBe(true)

        // Verify the written manifest has format: yaml
        const writtenManifest = JSON.parse(
            fs.readFileSync(path.join(outputPath, 'manifest.json'), 'utf-8'),
        ) as PackManifest
        expect(writtenManifest.format).toBe('yaml')
    })

    it('does not write when dry_run is true', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        fs.writeFileSync(
            path.join(projectDir, 'flint.config.yaml'),
            'schema_version: 1.0.0\nproject: test\n',
            'utf-8',
        )

        const outputPath = path.join(tmpDir, 'output', 'test-yaml-pack.flint-pack')
        const result = await assembleYamlPack(
            projectDir,
            makeMetadata({ dry_run: true, output_path: outputPath }),
        )

        expect(result.written).toBe(false)
        expect(fs.existsSync(outputPath)).toBe(false)
    })

    it('returns blocking error when yaml config cannot be read', async () => {
        const projectDir = path.join(tmpDir, 'project')
        fs.mkdirSync(path.join(projectDir, '.flint'), { recursive: true })

        // Write a flint.config.yaml that exists but has a read issue —
        // we simulate this by writing something that causes YAML parse to fail
        // (yaml library is lenient, so we make it invalid enough to cause an error)
        // Actually, since yaml is lenient, we instead simulate a read error by
        // making it a directory (unreadable as a file)
        const fakePath = path.join(projectDir, 'flint.config.yaml')
        fs.mkdirSync(fakePath, { recursive: true }) // directory, not file

        const result = await assembleYamlPack(projectDir, makeMetadata({ dry_run: true }))

        expect(result.validationErrors.filter(e => e.severity === 'error').length).toBeGreaterThan(0)
        expect(result.written).toBe(false)
    })
})

// ── importYamlPack ───────────────────────────────────────────────────────────

describe('importYamlPack', () => {
    it('detects YAML-format pack via isYamlFormatPack', () => {
        const manifest: PackManifest = {
            schema_version: 1,
            id: 'my-pack',
            name: 'My Pack',
            version: '1.0.0',
            description: 'desc',
            author: { name: 'Author' },
            trust_tier: 'community',
            domain: 'general',
            stack_tags: [],
            compatibility: { flint_min_version: '7.2.0', flint_max_version: null },
            dependencies: [],
            contents: { policy: true, agent_policy: false, rules: [], claude_fragments: [] },
            checksums: {},
            published_at: '2026-03-25T00:00:00Z',
            format: 'yaml',
        }
        expect(isYamlFormatPack(manifest)).toBe(true)
    })

    it('copies pack flint.config.yaml to .flint-packs directory', async () => {
        const projectDir = createProjectDir()
        const yamlContent = 'schema_version: 1.0.0\ndomain: fintech\n'
        const packDir = makeYamlPackDir({ 'flint.config.yaml': yamlContent })

        const result = await importYamlPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(true)
        const destPath = path.join(projectDir, '.flint-packs', 'test-yaml-pack', 'flint.config.yaml')
        expect(fs.existsSync(destPath)).toBe(true)
        expect(fs.readFileSync(destPath, 'utf-8')).toBe(yamlContent)
        expect(result.filesWritten).toContain('.flint-packs/test-yaml-pack/flint.config.yaml')
    })

    it('creates minimal flint.config.yaml with extends when project has none', async () => {
        const projectDir = createProjectDir()
        const yamlContent = 'schema_version: 1.0.0\ndomain: general\n'
        const packDir = makeYamlPackDir({ 'flint.config.yaml': yamlContent })

        // No project flint.config.yaml exists
        expect(fs.existsSync(path.join(projectDir, 'flint.config.yaml'))).toBe(false)

        const result = await importYamlPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(true)
        expect(fs.existsSync(path.join(projectDir, 'flint.config.yaml'))).toBe(true)

        const projectConfig = parseYaml(
            fs.readFileSync(path.join(projectDir, 'flint.config.yaml'), 'utf-8'),
        ) as Record<string, unknown>
        expect(Array.isArray(projectConfig.extends)).toBe(true)
        expect(projectConfig.extends as string[]).toContain(
            './.flint-packs/test-yaml-pack/flint.config.yaml',
        )
    })

    it('adds pack ref to existing extends list', async () => {
        const projectDir = createProjectDir()
        const existingRef = './.flint-packs/other-pack/flint.config.yaml'

        // Project already has a flint.config.yaml with one extends
        fs.writeFileSync(
            path.join(projectDir, 'flint.config.yaml'),
            `schema_version: 1.0.0\nproject: my-project\nextends:\n  - "${existingRef}"\n`,
            'utf-8',
        )

        const yamlContent = 'schema_version: 1.0.0\ndomain: general\n'
        const packDir = makeYamlPackDir({ 'flint.config.yaml': yamlContent })

        const result = await importYamlPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(true)

        const projectConfig = parseYaml(
            fs.readFileSync(path.join(projectDir, 'flint.config.yaml'), 'utf-8'),
        ) as Record<string, unknown>
        const extendsList = projectConfig.extends as string[]
        expect(extendsList).toContain(existingRef)
        expect(extendsList).toContain('./.flint-packs/test-yaml-pack/flint.config.yaml')
    })

    it('does not add duplicate extends entry (idempotent)', async () => {
        const projectDir = createProjectDir()
        const packRef = './.flint-packs/test-yaml-pack/flint.config.yaml'

        // Project already has the pack in its extends
        fs.writeFileSync(
            path.join(projectDir, 'flint.config.yaml'),
            `schema_version: 1.0.0\nproject: my-project\nextends:\n  - "${packRef}"\n`,
            'utf-8',
        )

        const yamlContent = 'schema_version: 1.0.0\ndomain: general\n'
        const packDir = makeYamlPackDir({ 'flint.config.yaml': yamlContent })

        const result = await importYamlPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(true)
        expect(result.summary).toContain('already up to date')

        const projectConfig = parseYaml(
            fs.readFileSync(path.join(projectDir, 'flint.config.yaml'), 'utf-8'),
        ) as Record<string, unknown>
        const extendsList = projectConfig.extends as string[]
        // Should appear exactly once
        const count = extendsList.filter(e => e === packRef).length
        expect(count).toBe(1)
    })

    it('copies design-tokens.json when present in pack', async () => {
        const projectDir = createProjectDir()
        const tokens = { color: { primary: { value: '#abc123' } } }
        const tokensContent = JSON.stringify(tokens, null, 2)

        const packDir = makeYamlPackDir({
            'flint.config.yaml': 'schema_version: 1.0.0\ndomain: general\n',
            'design-tokens.json': tokensContent,
        })

        const result = await importYamlPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(true)
        const tokensDest = path.join(projectDir, '.flint-packs', 'test-yaml-pack', 'design-tokens.json')
        expect(fs.existsSync(tokensDest)).toBe(true)
        expect(fs.readFileSync(tokensDest, 'utf-8')).toBe(tokensContent)
        expect(result.filesWritten).toContain('.flint-packs/test-yaml-pack/design-tokens.json')
    })

    it('falls back to legacy JSON import for non-yaml packs', async () => {
        // This tests that importPack (the main function) delegates correctly.
        // We test importYamlPack directly with a legacy-format manifest (no format field)
        // — it should still succeed since importYamlPack is called directly here.
        // The delegation test lives in the importPack wrapper. We verify isYamlFormatPack
        // returns false for a legacy manifest.
        const legacyManifest = { format: undefined } as unknown as PackManifest
        expect(isYamlFormatPack(legacyManifest)).toBe(false)

        const jsonManifest = { format: 'json' } as PackManifest
        expect(isYamlFormatPack(jsonManifest)).toBe(false)
    })

    it('returns error when pack path does not exist', async () => {
        const projectDir = createProjectDir()
        const result = await importYamlPack({
            packPath: '/nonexistent/pack/path',
            projectRoot: projectDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('does not exist')
    })

    it('returns error when pack path is not a directory', async () => {
        const projectDir = createProjectDir()
        const fakePack = path.join(tmpDir, 'not-a-dir.txt')
        fs.writeFileSync(fakePack, 'not a directory', 'utf-8')

        const result = await importYamlPack({
            packPath: fakePack,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('not a directory')
    })

    it('returns error when manifest.json is missing', async () => {
        const projectDir = createProjectDir()
        const packDir = path.join(tmpDir, 'empty-pack')
        fs.mkdirSync(packDir, { recursive: true })

        const result = await importYamlPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('missing manifest.json')
    })

    it('returns error on checksum mismatch', async () => {
        const projectDir = createProjectDir()
        const yamlContent = 'schema_version: 1.0.0\ndomain: general\n'
        const packDir = makeYamlPackDir({ 'flint.config.yaml': yamlContent })

        // Corrupt the yaml file after writing (checksum will no longer match)
        fs.writeFileSync(
            path.join(packDir, 'flint.config.yaml'),
            yamlContent + '\n# tampered\n',
            'utf-8',
        )

        const result = await importYamlPack({
            packPath: packDir,
            projectRoot: projectDir,
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Checksum')
    })

    it('previews changes without writing when dryRun is true', async () => {
        const projectDir = createProjectDir()
        const yamlContent = 'schema_version: 1.0.0\ndomain: general\n'
        const packDir = makeYamlPackDir({ 'flint.config.yaml': yamlContent })

        const result = await importYamlPack({
            packPath: packDir,
            projectRoot: projectDir,
            dryRun: true,
        })

        // Should not have written the pack directory
        expect(fs.existsSync(path.join(projectDir, '.flint-packs'))).toBe(false)
        expect(result.summary).toContain('Dry run')
        expect(result.filesWritten.length).toBeGreaterThan(0)
    })
})

// ── PackManifest format field ────────────────────────────────────────────────

describe('PackManifest.format field', () => {
    it('format field is optional and defaults to undefined (json compat)', () => {
        const manifest: PackManifest = {
            schema_version: 1,
            id: 'my-pack',
            name: 'My Pack',
            version: '1.0.0',
            description: 'desc',
            author: { name: 'Author' },
            trust_tier: 'community',
            domain: 'general',
            stack_tags: [],
            compatibility: { flint_min_version: '7.0.0', flint_max_version: null },
            dependencies: [],
            contents: { policy: false, agent_policy: false, rules: [], claude_fragments: [] },
            checksums: {},
            published_at: '2026-03-25T00:00:00Z',
            // format intentionally omitted
        }
        expect(manifest.format).toBeUndefined()
        expect(isYamlFormatPack(manifest)).toBe(false)
    })

    it('format field accepts "json" value', () => {
        const manifest: PackManifest = {
            schema_version: 1,
            id: 'my-pack',
            name: 'My Pack',
            version: '1.0.0',
            description: 'desc',
            author: { name: 'Author' },
            trust_tier: 'community',
            domain: 'general',
            stack_tags: [],
            compatibility: { flint_min_version: '7.0.0', flint_max_version: null },
            dependencies: [],
            contents: { policy: false, agent_policy: false, rules: [], claude_fragments: [] },
            checksums: {},
            published_at: '2026-03-25T00:00:00Z',
            format: 'json',
        }
        expect(manifest.format).toBe('json')
    })

    it('format field accepts "yaml" value', () => {
        const manifest: PackManifest = {
            schema_version: 1,
            id: 'my-pack',
            name: 'My Pack',
            version: '1.0.0',
            description: 'desc',
            author: { name: 'Author' },
            trust_tier: 'community',
            domain: 'general',
            stack_tags: [],
            compatibility: { flint_min_version: '7.2.0', flint_max_version: null },
            dependencies: [],
            contents: { policy: false, agent_policy: false, rules: [], claude_fragments: [] },
            checksums: {},
            published_at: '2026-03-25T00:00:00Z',
            format: 'yaml',
        }
        expect(manifest.format).toBe('yaml')
    })
})
