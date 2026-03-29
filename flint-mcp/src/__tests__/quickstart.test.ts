import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { handleFlintQuickstart } from '../tools/quickstart.js'
import { DEFAULT_CONFIG } from '../core/config.js'
import type { FlintConfig } from '../core/config.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-quickstart-'))
}

function makeConfig(projectRoot: string): FlintConfig {
    return { ...DEFAULT_CONFIG, projectRoot }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleFlintQuickstart', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('scaffolds FlintDemo.tsx in the specified outputDir', async () => {
        const config = makeConfig(tmpDir)
        await handleFlintQuickstart({ outputDir: tmpDir }, config)
        const demoPath = path.join(tmpDir, 'FlintDemo.tsx')
        expect(fs.existsSync(demoPath)).toBe(true)
    })

    it('scaffolds design-tokens.json next to FlintDemo.tsx', async () => {
        const config = makeConfig(tmpDir)
        await handleFlintQuickstart({ outputDir: tmpDir }, config)
        const tokensPath = path.join(tmpDir, 'design-tokens.json')
        expect(fs.existsSync(tokensPath)).toBe(true)
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
        expect(tokens.color?.brand?.primary?.['$value']).toBe('#005B94')
        expect(tokens.color?.feedback?.error?.['$value']).toBe('#C41E1E')
    })

    it('defaults outputDir to config.projectRoot when not provided', async () => {
        const config = makeConfig(tmpDir)
        await handleFlintQuickstart({}, config)
        expect(fs.existsSync(path.join(tmpDir, 'FlintDemo.tsx'))).toBe(true)
    })

    it('returns text content containing FlintDemo.tsx', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintQuickstart({ outputDir: tmpDir }, config)
        expect(result.content).toHaveLength(1)
        expect(result.content[0].type).toBe('text')
        expect(result.content[0].text).toContain('FlintDemo.tsx')
    })

    it('returns a next-step instruction referencing flint_fix', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintQuickstart({ outputDir: tmpDir }, config)
        expect(result.content[0].text).toMatch(/flint_fix/i)
    })

    it('audit results contain at least 3 violations', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintQuickstart({ outputDir: tmpDir }, config)
        const text = result.content[0].text

        // Extract the violations count from the heading "X violation(s) found"
        const match = text.match(/(\d+) violation/)
        expect(match).not.toBeNull()
        const count = parseInt(match![1], 10)
        expect(count).toBeGreaterThanOrEqual(3)
    })

    it('returns content even when outputDir does not yet exist', async () => {
        const nonExistentDir = path.join(tmpDir, 'nested', 'new')
        const config = makeConfig(tmpDir)
        const result = await handleFlintQuickstart({ outputDir: nonExistentDir }, config)
        expect(fs.existsSync(path.join(nonExistentDir, 'FlintDemo.tsx'))).toBe(true)
        expect(result.content[0].text).toContain('FlintDemo.tsx')
    })

    it('returns structured markdown with audit table', async () => {
        const config = makeConfig(tmpDir)
        const result = await handleFlintQuickstart({ outputDir: tmpDir }, config)
        const text = result.content[0].text
        expect(text).toContain('Mithril')
        expect(text).toContain('Warden')
    })
})
