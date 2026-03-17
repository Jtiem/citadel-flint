/**
 * sessionContext.test.ts — Phase ACX.1
 *
 * Tests for assembleSessionContext():
 *   - Assembly with all files present
 *   - Assembly with individual files missing (graceful degradation)
 *   - Cache TTL behaviour
 *   - Performance budget (< 100ms)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { assembleSessionContext, invalidateSessionContextCache } from '../../src/core/sessionContext.js'

// ── Test helpers ─────────────────────────────────────────────────────────────

function createTempProject(): string {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-'))
    const bridgeDir = path.join(tmpDir, '.bridge')
    fs.mkdirSync(bridgeDir, { recursive: true })
    return tmpDir
}

function writeBridgeFile(projectRoot: string, name: string, content: object | string): void {
    const bridgeDir = path.join(projectRoot, '.bridge')
    fs.writeFileSync(
        path.join(bridgeDir, name),
        typeof content === 'string' ? content : JSON.stringify(content, null, 2),
        'utf-8'
    )
}

function cleanup(projectRoot: string): void {
    try {
        fs.rmSync(projectRoot, { recursive: true, force: true })
    } catch {
        // Ignore cleanup errors
    }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_CONTEXT_JSON = {
    activeFile: '/tmp/test-project/src/components/Button.tsx',
    selectedNodeId: 'bridge-btn-root',
    canvasMode: 'design',
    figmaConnected: true,
    saveState: 'saved',
    violations: [
        { id: 'v1', type: 'color-drift', severity: 'amber', nodeId: 'bridge-btn-root', fixable: true },
        { id: 'v2', type: 'a11y', severity: 'critical', nodeId: 'bridge-btn-label', fixable: false },
    ],
}

const SAMPLE_TOKENS = [
    { id: 1, token_path: 'color.brand.primary', token_type: 'color', token_value: '#0062ff', description: null, collection_name: 'brand', mode: 'default' },
    { id: 2, token_path: 'spacing.sm', token_type: 'dimension', token_value: '8px', description: null, collection_name: 'spacing', mode: 'default' },
    { id: 3, token_path: 'color.brand.secondary', token_type: 'color', token_value: '#ffd700', description: null, collection_name: 'brand', mode: 'default' },
]

const SAMPLE_EVENTS_JSONL = [
    JSON.stringify({ batchId: 'b1', timestamp: '2026-03-15T10:00:00Z', tool: 'bridge_ast_mutate', filePath: '/tmp/Button.tsx', mutationCount: 2, outcome: 'Success' }),
    JSON.stringify({ batchId: 'b2', timestamp: '2026-03-15T10:05:00Z', tool: 'bridge_fix', filePath: '/tmp/Card.tsx', mutationCount: 1, outcome: 'Success' }),
].join('\n')

const SAMPLE_DEBT_HISTORY = {
    snapshots: [
        { score: 72, grade: 'C', timestamp: '2026-03-14T00:00:00Z' },
        { score: 78, grade: 'B', timestamp: '2026-03-15T00:00:00Z' },
    ],
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('assembleSessionContext', () => {
    let projectRoot: string

    beforeEach(() => {
        projectRoot = createTempProject()
        invalidateSessionContextCache(projectRoot)
    })

    afterEach(() => {
        invalidateSessionContextCache(projectRoot)
        cleanup(projectRoot)
    })

    // ── All files present ──────────────────────────────────────────────────

    it('assembles context when all files are present', async () => {
        writeBridgeFile(projectRoot, 'context.json', SAMPLE_CONTEXT_JSON)
        writeBridgeFile(projectRoot, 'design-tokens.json', SAMPLE_TOKENS)
        writeBridgeFile(projectRoot, 'mcp-events.jsonl', SAMPLE_EVENTS_JSONL)
        writeBridgeFile(projectRoot, 'debt-history.json', SAMPLE_DEBT_HISTORY)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.projectRoot).toBe(projectRoot)
        expect(ctx.assembledAt).toBeTruthy()
        expect(ctx.partial).toBe(false)
    })

    it('returns correct canvas state when context.json is present', async () => {
        writeBridgeFile(projectRoot, 'context.json', SAMPLE_CONTEXT_JSON)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.canvas.canvasMode).toBe('design')
        expect(ctx.canvas.figmaConnected).toBe(true)
        expect(ctx.canvas.saveState).toBe('saved')
        expect(ctx.canvas.selectedNodeId).toBe('bridge-btn-root')
    })

    it('returns correct violation summary', async () => {
        writeBridgeFile(projectRoot, 'context.json', SAMPLE_CONTEXT_JSON)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.violations.mithrilCount).toBe(1)
        expect(ctx.violations.a11yCount).toBe(1)
        expect(ctx.violations.amberCount).toBe(1)
        expect(ctx.violations.criticalCount).toBe(1)
        expect(ctx.violations.affectedNodeIds).toContain('bridge-btn-root')
        expect(ctx.violations.affectedNodeIds).toContain('bridge-btn-label')
        expect(ctx.violations.hasFixableViolations).toBe(true)
    })

    it('returns correct token summary', async () => {
        writeBridgeFile(projectRoot, 'context.json', SAMPLE_CONTEXT_JSON)
        writeBridgeFile(projectRoot, 'design-tokens.json', SAMPLE_TOKENS)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.tokens.totalCount).toBe(3)
        expect(ctx.tokens.byType['color']).toBe(2)
        expect(ctx.tokens.byType['dimension']).toBe(1)
        expect(ctx.tokens.top20.length).toBeLessThanOrEqual(20)
        expect(ctx.tokens.top20[0].path).toBe('color.brand.primary')
    })

    it('returns last 5 mutations from mcp-events.jsonl', async () => {
        writeBridgeFile(projectRoot, 'mcp-events.jsonl', SAMPLE_EVENTS_JSONL)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.recentMutations.length).toBe(2)
        expect(ctx.recentMutations[0].tool).toBe('bridge_ast_mutate')
        expect(ctx.recentMutations[1].tool).toBe('bridge_fix')
    })

    it('returns health score and grade from debt-history.json', async () => {
        writeBridgeFile(projectRoot, 'debt-history.json', SAMPLE_DEBT_HISTORY)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.healthScore).toBe(78)
        expect(ctx.healthGrade).toBe('B')
    })

    // ── Graceful degradation ───────────────────────────────────────────────

    it('returns partial=true when context.json is missing', async () => {
        // No context.json written

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.partial).toBe(true)
        expect(ctx.canvas.activeFile).toBeNull()
        expect(ctx.canvas.canvasMode).toBeNull()
        expect(ctx.violations.mithrilCount).toBe(0)
        expect(ctx.violations.a11yCount).toBe(0)
    })

    it('returns partial=true when design-tokens.json is missing', async () => {
        writeBridgeFile(projectRoot, 'context.json', SAMPLE_CONTEXT_JSON)
        // No tokens file

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.partial).toBe(true)
        expect(ctx.tokens.totalCount).toBe(0)
        expect(ctx.tokens.byType).toEqual({})
        expect(ctx.tokens.top20).toEqual([])
    })

    it('returns empty mutations when mcp-events.jsonl is missing', async () => {
        // No events file

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.recentMutations).toEqual([])
    })

    it('returns null health score when debt-history.json is missing', async () => {
        // No debt history file

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.healthScore).toBeNull()
        expect(ctx.healthGrade).toBeNull()
    })

    it('does not throw when all .bridge/ files are missing', async () => {
        // Empty .bridge directory
        await expect(assembleSessionContext(projectRoot)).resolves.toBeDefined()
    })

    it('handles malformed context.json gracefully', async () => {
        writeBridgeFile(projectRoot, 'context.json', '{ invalid json ,,, }')

        await expect(assembleSessionContext(projectRoot)).resolves.toBeDefined()
        const ctx = await assembleSessionContext(projectRoot)
        expect(ctx.canvas.activeFile).toBeNull()
    })

    it('handles malformed design-tokens.json gracefully', async () => {
        writeBridgeFile(projectRoot, 'design-tokens.json', 'not-json')

        await expect(assembleSessionContext(projectRoot)).resolves.toBeDefined()
        const ctx = await assembleSessionContext(projectRoot)
        expect(ctx.tokens.totalCount).toBe(0)
    })

    it('skips malformed lines in mcp-events.jsonl', async () => {
        const mixedEvents = [
            JSON.stringify({ batchId: 'good', timestamp: '2026-03-15T10:00:00Z', tool: 'bridge_fix', filePath: '/tmp/x.tsx', mutationCount: 1, outcome: 'Success' }),
            '{ bad json',
            JSON.stringify({ batchId: 'good2', timestamp: '2026-03-15T10:01:00Z', tool: 'bridge_audit', filePath: '/tmp/y.tsx', mutationCount: 0, outcome: 'Pass' }),
        ].join('\n')
        writeBridgeFile(projectRoot, 'mcp-events.jsonl', mixedEvents)

        const ctx = await assembleSessionContext(projectRoot)
        // Should have 2 valid entries, skip the malformed one
        expect(ctx.recentMutations.length).toBe(2)
    })

    it('handles debt-history.json with empty snapshots array', async () => {
        writeBridgeFile(projectRoot, 'debt-history.json', { snapshots: [] })

        const ctx = await assembleSessionContext(projectRoot)
        expect(ctx.healthScore).toBeNull()
        expect(ctx.healthGrade).toBeNull()
    })

    // ── Cache TTL ──────────────────────────────────────────────────────────

    it('returns cached result within TTL', async () => {
        writeBridgeFile(projectRoot, 'context.json', SAMPLE_CONTEXT_JSON)

        const ctx1 = await assembleSessionContext(projectRoot)

        // Modify the file — the cached result should still be returned within TTL
        writeBridgeFile(projectRoot, 'context.json', { ...SAMPLE_CONTEXT_JSON, canvasMode: 'interact' })

        const ctx2 = await assembleSessionContext(projectRoot)

        // Same reference within TTL — assembledAt should match
        expect(ctx2.assembledAt).toBe(ctx1.assembledAt)
        // Canvas mode should still be 'design' (cached value)
        expect(ctx2.canvas.canvasMode).toBe('design')
    })

    it('invalidates cache and re-assembles after invalidation', async () => {
        writeBridgeFile(projectRoot, 'context.json', SAMPLE_CONTEXT_JSON)

        const ctx1 = await assembleSessionContext(projectRoot)

        // Invalidate cache
        invalidateSessionContextCache(projectRoot)

        // Modify the file
        writeBridgeFile(projectRoot, 'context.json', { ...SAMPLE_CONTEXT_JSON, canvasMode: 'interact' })

        const ctx2 = await assembleSessionContext(projectRoot)

        // Should be a fresh assembly — canvas mode should be the new value
        expect(ctx2.canvas.canvasMode).toBe('interact')
    })

    it('cache entries are independent per projectRoot', async () => {
        const projectRoot2 = createTempProject()
        invalidateSessionContextCache(projectRoot2)

        try {
            writeBridgeFile(projectRoot, 'context.json', { ...SAMPLE_CONTEXT_JSON, canvasMode: 'design' })
            writeBridgeFile(projectRoot2, 'context.json', { ...SAMPLE_CONTEXT_JSON, canvasMode: 'interact' })

            const ctx1 = await assembleSessionContext(projectRoot)
            const ctx2 = await assembleSessionContext(projectRoot2)

            expect(ctx1.canvas.canvasMode).toBe('design')
            expect(ctx2.canvas.canvasMode).toBe('interact')
        } finally {
            invalidateSessionContextCache(projectRoot2)
            cleanup(projectRoot2)
        }
    })

    // ── Performance ────────────────────────────────────────────────────────

    it('assembles context in under 100ms', async () => {
        writeBridgeFile(projectRoot, 'context.json', SAMPLE_CONTEXT_JSON)
        writeBridgeFile(projectRoot, 'design-tokens.json', SAMPLE_TOKENS)
        writeBridgeFile(projectRoot, 'mcp-events.jsonl', SAMPLE_EVENTS_JSONL)
        writeBridgeFile(projectRoot, 'debt-history.json', SAMPLE_DEBT_HISTORY)

        const start = Date.now()
        await assembleSessionContext(projectRoot)
        const elapsed = Date.now() - start

        expect(elapsed).toBeLessThan(100)
    })

    it('assembles missing-files context in under 100ms', async () => {
        // All files missing — should still be fast

        const start = Date.now()
        await assembleSessionContext(projectRoot)
        const elapsed = Date.now() - start

        expect(elapsed).toBeLessThan(100)
    })

    // ── Edge cases ─────────────────────────────────────────────────────────

    it('caps affectedNodeIds at 20 entries', async () => {
        // Create a context with 30 violations
        const violations = Array.from({ length: 30 }, (_, i) => ({
            id: `v${i}`,
            type: 'color-drift',
            severity: 'amber',
            nodeId: `bridge-node-${i}`,
            fixable: false,
        }))
        writeBridgeFile(projectRoot, 'context.json', { ...SAMPLE_CONTEXT_JSON, violations })

        const ctx = await assembleSessionContext(projectRoot)
        expect(ctx.violations.affectedNodeIds.length).toBeLessThanOrEqual(20)
    })

    it('caps token top20 at 20 entries', async () => {
        // Create 30 tokens
        const tokens = Array.from({ length: 30 }, (_, i) => ({
            id: i + 1,
            token_path: `color.brand.token-${i}`,
            token_type: 'color',
            token_value: '#ffffff',
            description: null,
            collection_name: 'brand',
            mode: 'default',
        }))
        writeBridgeFile(projectRoot, 'design-tokens.json', tokens)

        const ctx = await assembleSessionContext(projectRoot)
        expect(ctx.tokens.top20.length).toBeLessThanOrEqual(20)
        expect(ctx.tokens.totalCount).toBe(30)
    })

    it('reads only the last 5 lines from mcp-events.jsonl', async () => {
        // Write 10 events
        const manyEvents = Array.from({ length: 10 }, (_, i) =>
            JSON.stringify({ batchId: `b${i}`, timestamp: `2026-03-15T10:0${i}:00Z`, tool: 'bridge_fix', filePath: '/tmp/x.tsx', mutationCount: 1, outcome: 'Success' })
        ).join('\n')
        writeBridgeFile(projectRoot, 'mcp-events.jsonl', manyEvents)

        const ctx = await assembleSessionContext(projectRoot)
        expect(ctx.recentMutations.length).toBeLessThanOrEqual(5)
    })

    it('handles tokens.json as object (not array) gracefully', async () => {
        // Some projects store tokens as an object map
        const tokensAsObject = {
            'color.brand.primary': { token_path: 'color.brand.primary', token_type: 'color', token_value: '#0062ff' },
        }
        writeBridgeFile(projectRoot, 'design-tokens.json', tokensAsObject)

        // Should not throw; totals may be 0 since it's not an array
        const ctx = await assembleSessionContext(projectRoot)
        expect(ctx).toBeDefined()
    })

    it('returns null activeFileSource when active file does not exist on disk', async () => {
        writeBridgeFile(projectRoot, 'context.json', {
            ...SAMPLE_CONTEXT_JSON,
            activeFile: '/nonexistent/path/Button.tsx',
        })

        const ctx = await assembleSessionContext(projectRoot)
        expect(ctx.activeFileSource).toBeNull()
        expect(ctx.activeFilePath).toBe('/nonexistent/path/Button.tsx')
    })
})
