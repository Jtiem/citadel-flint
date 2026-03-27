/**
 * extractTokens.ts — Tool Handler Tests
 * flint-mcp/src/tools/__tests__/extractTokens.test.ts
 *
 * Phase D2C.4 Feature 2: Token Extraction from Figma
 *
 * What we verify:
 *   1. flint_extract_tokens returns proposals without writing to disk
 *   2. flint_extract_tokens rejects non-JSON figmaPayload
 *   3. flint_extract_tokens returns reviewInstructions string
 *   4. flint_extract_tokens applies minUsageCount filter
 *   5. flint_approve_tokens writes approved tokens to design-tokens.json
 *   6. flint_approve_tokens preserves existing tokens (merge-with-preserve)
 *   7. flint_approve_tokens records governance event (returns a governanceEventId)
 *   8. flint_approve_tokens rejects empty tokens array
 *   9. flint_approve_tokens skips tokens whose path already exists
 *  10. flint_approve_tokens rejects tokens with missing required fields
 *  11. Round-trip: extract → approve → tokens on disk
 *  12. flint_approve_tokens returns correct writtenCount / skippedCount / rejectedCount
 *  13. flint_extract_tokens with empty Figma payload returns zero proposals
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { handleExtractTokens } from '../extractTokens.js'
import { handleApproveTokens } from '../extractTokens.js'
import type { DesignToken } from '../../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-extract-test-'))
}

function cleanupDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true })
}

function writeTokens(dir: string, tokens: DesignToken[]): void {
    const flintDir = path.join(dir, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })
    fs.writeFileSync(
        path.join(flintDir, 'design-tokens.json'),
        JSON.stringify(tokens, null, 2) + '\n',
        'utf-8',
    )
}

function readTokensFromDir(dir: string): DesignToken[] {
    const p = path.join(dir, '.flint', 'design-tokens.json')
    if (!fs.existsSync(p)) return []
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function makeColor(r: number, g: number, b: number) {
    return { r: r / 255, g: g / 255, b: b / 255 }
}

function makeFigmaPayload(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
        id: 'root',
        name: 'Brand Primary',
        type: 'FRAME',
        fills: [{ type: 'SOLID', color: makeColor(37, 99, 235) }], // #2563EB
        strokes: [],
        effects: [],
        children: [],
        ...overrides,
    })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('handleExtractTokens', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
    })

    afterEach(() => {
        cleanupDir(tmpDir)
    })

    // 1. Returns proposals without writing to disk
    it('returns proposed tokens without writing to disk', () => {
        const result = handleExtractTokens({
            figmaPayload: makeFigmaPayload(),
            projectRoot: tmpDir,
        })

        expect(result.isError).toBeFalsy()
        const output = JSON.parse(result.content[0].text)
        expect(output.proposedTokens).toBeDefined()
        expect(Array.isArray(output.proposedTokens)).toBe(true)

        // Verify no tokens file was written
        const tokensPath = path.join(tmpDir, '.flint', 'design-tokens.json')
        expect(fs.existsSync(tokensPath)).toBe(false)
    })

    // 2. Rejects non-JSON figmaPayload
    it('returns error for non-JSON figmaPayload', () => {
        const result = handleExtractTokens({
            figmaPayload: 'not valid json {{',
            projectRoot: tmpDir,
        })

        expect(result.isError).toBe(true)
        const output = JSON.parse(result.content[0].text)
        expect(output.error).toContain('JSON parse failed')
    })

    // 3. Returns reviewInstructions string
    it('returns reviewInstructions in the response', () => {
        const result = handleExtractTokens({
            figmaPayload: makeFigmaPayload(),
            projectRoot: tmpDir,
        })

        const output = JSON.parse(result.content[0].text)
        expect(typeof output.reviewInstructions).toBe('string')
        expect(output.reviewInstructions.length).toBeGreaterThan(10)
    })

    // 4. Applies minUsageCount filter (single-use colors with minUsageCount=2)
    it('applies minUsageCount filter correctly', () => {
        const result = handleExtractTokens({
            figmaPayload: makeFigmaPayload(),
            projectRoot: tmpDir,
            minUsageCount: 2,
        })

        const output = JSON.parse(result.content[0].text)
        // The payload has one fill appearing once — should be filtered out
        const colorTokens = output.proposedTokens.filter((t: { type: string }) => t.type === 'color')
        expect(colorTokens.every((t: { usageCount: number }) => t.usageCount >= 2)).toBe(true)
    })

    // 13. Empty Figma payload returns zero proposals
    it('returns zero proposals for empty Figma payload', () => {
        const result = handleExtractTokens({
            figmaPayload: JSON.stringify({}),
            projectRoot: tmpDir,
        })

        const output = JSON.parse(result.content[0].text)
        expect(output.proposedTokens).toHaveLength(0)
        expect(output.stats.proposedCount).toBe(0)
    })

    it('returns existingMatches and nearMatches in output', () => {
        // Seed an existing token that matches the payload color
        writeTokens(tmpDir, [{
            id: 1,
            token_path: 'colors.brand.primary',
            token_type: 'color',
            token_value: '#2563EB',
            description: null,
            collection_name: 'test',
            mode: 'default',
        }])

        const result = handleExtractTokens({
            figmaPayload: makeFigmaPayload(),
            projectRoot: tmpDir,
        })

        const output = JSON.parse(result.content[0].text)
        expect(Array.isArray(output.existingMatches)).toBe(true)
        expect(output.existingMatches.length).toBeGreaterThan(0)
        expect(output.existingMatches[0].existingPath).toBe('colors.brand.primary')
    })
})

describe('handleApproveTokens', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
    })

    afterEach(() => {
        cleanupDir(tmpDir)
    })

    // 5. Writes approved tokens to design-tokens.json
    it('writes approved tokens to design-tokens.json', () => {
        const result = handleApproveTokens({
            tokens: [
                { path: 'colors.brand.blue', value: '#2563EB', type: 'color' },
                { path: 'spacing.16', value: '16', type: 'dimension' },
            ],
            projectRoot: tmpDir,
        })

        expect(result.isError).toBeFalsy()
        const output = JSON.parse(result.content[0].text)
        expect(output.writtenCount).toBe(2)

        const onDisk = readTokensFromDir(tmpDir)
        expect(onDisk).toHaveLength(2)
        expect(onDisk.some(t => t.token_path === 'colors.brand.blue')).toBe(true)
        expect(onDisk.some(t => t.token_path === 'spacing.16')).toBe(true)
    })

    // 6. Preserves existing tokens
    it('preserves existing tokens (merge-with-preserve semantics)', () => {
        writeTokens(tmpDir, [{
            id: 1,
            token_path: 'colors.existing.red',
            token_type: 'color',
            token_value: '#EF4444',
            description: null,
            collection_name: 'test',
            mode: 'default',
        }])

        const result = handleApproveTokens({
            tokens: [
                { path: 'colors.brand.blue', value: '#2563EB', type: 'color' },
            ],
            projectRoot: tmpDir,
        })

        const output = JSON.parse(result.content[0].text)
        expect(output.writtenCount).toBe(1)

        const onDisk = readTokensFromDir(tmpDir)
        expect(onDisk).toHaveLength(2)
        // Original token preserved
        expect(onDisk.some(t => t.token_path === 'colors.existing.red')).toBe(true)
        // New token added
        expect(onDisk.some(t => t.token_path === 'colors.brand.blue')).toBe(true)
    })

    // 7. Records governance event (returns non-empty governanceEventId)
    it('records governance event and returns governanceEventId', () => {
        const result = handleApproveTokens({
            tokens: [{ path: 'colors.brand.primary', value: '#2563EB', type: 'color' }],
            projectRoot: tmpDir,
            source: 'Figma — Marketing Landing Page',
        })

        const output = JSON.parse(result.content[0].text)
        expect(typeof output.governanceEventId).toBe('string')
        expect(output.governanceEventId.length).toBeGreaterThan(5)
    })

    // 8. Rejects empty tokens array
    it('rejects empty tokens array with isError: true', () => {
        const result = handleApproveTokens({
            tokens: [],
            projectRoot: tmpDir,
        })

        expect(result.isError).toBe(true)
        const output = JSON.parse(result.content[0].text)
        expect(output.error).toBeDefined()
    })

    // 9. Skips tokens whose path already exists
    it('skips tokens that already exist at the same path', () => {
        writeTokens(tmpDir, [{
            id: 1,
            token_path: 'colors.brand.primary',
            token_type: 'color',
            token_value: '#1D4ED8',
            description: null,
            collection_name: 'test',
            mode: 'default',
        }])

        const result = handleApproveTokens({
            tokens: [
                { path: 'colors.brand.primary', value: '#2563EB', type: 'color' }, // same path → skip
                { path: 'colors.brand.secondary', value: '#7C3AED', type: 'color' }, // new path → write
            ],
            projectRoot: tmpDir,
        })

        const output = JSON.parse(result.content[0].text)
        expect(output.writtenCount).toBe(1)
        expect(output.skippedCount).toBe(1)

        const onDisk = readTokensFromDir(tmpDir)
        // Original value at colors.brand.primary is preserved (not overwritten)
        const existing = onDisk.find(t => t.token_path === 'colors.brand.primary')
        expect(existing?.token_value).toBe('#1D4ED8')
    })

    // 10. Rejects tokens with missing required fields
    it('rejects tokens with missing required fields', () => {
        const result = handleApproveTokens({
            tokens: [
                { path: '', value: '#2563EB', type: 'color' },     // missing path
                { path: 'colors.a.b', value: '', type: 'color' },  // missing value
                { path: 'colors.c.d', value: '#abc', type: '' },   // missing type
            ],
            projectRoot: tmpDir,
        })

        const output = JSON.parse(result.content[0].text)
        expect(output.rejectedCount).toBe(3)
        expect(output.writtenCount).toBe(0)
    })

    // 12. Returns correct writtenCount / skippedCount / rejectedCount
    it('returns accurate counts for mixed batch', () => {
        writeTokens(tmpDir, [{
            id: 1,
            token_path: 'colors.existing',
            token_type: 'color',
            token_value: '#000000',
            description: null,
            collection_name: 'test',
            mode: 'default',
        }])

        const result = handleApproveTokens({
            tokens: [
                { path: 'colors.new.one', value: '#111111', type: 'color' },   // new → write
                { path: 'colors.existing', value: '#222222', type: 'color' },  // exists → skip
                { path: '', value: '#333333', type: 'color' },                  // missing path → reject
            ],
            projectRoot: tmpDir,
        })

        const output = JSON.parse(result.content[0].text)
        expect(output.writtenCount).toBe(1)
        expect(output.skippedCount).toBe(1)
        expect(output.rejectedCount).toBe(1)
    })

    // 11. Round-trip: extract → approve → tokens on disk
    it('round-trip: extract then approve writes correct tokens to disk', () => {
        const figmaPayload = makeFigmaPayload({
            name: 'Primary Background',
            fills: [{ type: 'SOLID', color: makeColor(37, 99, 235) }],
        })

        // Step 1: Extract
        const extractResult = handleExtractTokens({
            figmaPayload,
            projectRoot: tmpDir,
        })
        expect(extractResult.isError).toBeFalsy()
        const extracted = JSON.parse(extractResult.content[0].text)
        expect(extracted.proposedTokens.length).toBeGreaterThan(0)

        // Step 2: Approve all proposed tokens (convert to approve format)
        const tokensToApprove = extracted.proposedTokens.map((t: {
            proposedName: string
            value: string
            type: string
        }) => ({
            path: t.proposedName,
            value: t.value,
            type: t.type,
        }))

        const approveResult = handleApproveTokens({
            tokens: tokensToApprove,
            source: 'test-figma-file',
            projectRoot: tmpDir,
        })
        expect(approveResult.isError).toBeFalsy()
        const approved = JSON.parse(approveResult.content[0].text)
        expect(approved.writtenCount).toBe(tokensToApprove.length)

        // Step 3: Verify tokens are on disk
        const onDisk = readTokensFromDir(tmpDir)
        expect(onDisk).toHaveLength(tokensToApprove.length)
        for (const t of tokensToApprove) {
            expect(onDisk.some(d => d.token_path === t.path && d.token_value === t.value)).toBe(true)
        }
    })
})
