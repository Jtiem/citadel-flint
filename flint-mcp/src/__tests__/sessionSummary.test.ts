/**
 * sessionSummary.test.ts — Strategy 4: Context-First Briefing
 *
 * Tests for the sessionSummary and sessionPersona fields added to
 * assembleSessionContext():
 *   - sessionSummary populated from recent mutations + deferred violations
 *   - sessionSummary with no prior session data
 *   - sessionSummary with deferred violations file
 *   - sessionPersona read from context.json
 *   - sessionPersona defaults to null
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { assembleSessionContext, invalidateSessionContextCache } from '../core/sessionContext.js'

// ── Test helpers ─────────────────────────────────────────────────────────

function createTempProject(): string {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flint-summary-test-'))
    const flintDir = path.join(tmpDir, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })
    return tmpDir
}

function writeFlintFile(projectRoot: string, name: string, content: object | string): void {
    const flintDir = path.join(projectRoot, '.flint')
    fs.writeFileSync(
        path.join(flintDir, name),
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

// ── Fixtures ──────────────────────────────────────────────────────────────

const SAMPLE_CONTEXT = {
    activeFile: '/tmp/test/src/Button.tsx',
    selectedNodeId: 'flint-btn-root',
    canvasMode: 'design',
    saveState: 'saved',
}

const SAMPLE_FIX_EVENTS = [
    JSON.stringify({ batchId: 'b1', timestamp: '2026-03-15T10:00:00Z', tool: 'flint_fix', filePath: '/tmp/Button.tsx', mutationCount: 3, outcome: 'Success' }),
    JSON.stringify({ batchId: 'b2', timestamp: '2026-03-15T10:05:00Z', tool: 'flint_fix', filePath: '/tmp/Card.tsx', mutationCount: 2, outcome: 'Success' }),
    JSON.stringify({ batchId: 'b3', timestamp: '2026-03-15T10:10:00Z', tool: 'flint_ast_mutate', filePath: '/tmp/Header.tsx', mutationCount: 1, outcome: 'Success' }),
].join('\n')

const SAMPLE_DEFERRED_VIOLATIONS = [
    {
        file: '/src/Button.tsx',
        ruleId: 'MITH-COL-001',
        nodeId: 'flint-btn-root',
        reason: 'Will fix after design review',
        deferredAt: '2026-03-15T10:00:00Z',
    },
    {
        file: '/src/Card.tsx',
        ruleId: 'A11Y-001',
        nodeId: null,
        reason: null,
        deferredAt: '2026-03-15T10:05:00Z',
    },
]

// ── Tests ────────────────────────────────────────────────────────────────

describe('sessionSummary in assembleSessionContext', () => {
    let projectRoot: string

    beforeEach(() => {
        projectRoot = createTempProject()
        invalidateSessionContextCache(projectRoot)
    })

    afterEach(() => {
        invalidateSessionContextCache(projectRoot)
        cleanup(projectRoot)
    })

    // ── sessionSummary basic population ──────────────────────────────────

    it('returns sessionSummary with lastSessionDate from mutations', async () => {
        writeFlintFile(projectRoot, 'context.json', SAMPLE_CONTEXT)
        writeFlintFile(projectRoot, 'mcp-events.jsonl', SAMPLE_FIX_EVENTS)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionSummary).not.toBeNull()
        expect(ctx.sessionSummary!.lastSessionDate).toBe('2026-03-15T10:10:00Z')
    })

    it('returns fixedFiles and fixedViolationCount from flint_fix mutations', async () => {
        writeFlintFile(projectRoot, 'context.json', SAMPLE_CONTEXT)
        writeFlintFile(projectRoot, 'mcp-events.jsonl', SAMPLE_FIX_EVENTS)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionSummary!.fixedFiles).toContain('/tmp/Button.tsx')
        expect(ctx.sessionSummary!.fixedFiles).toContain('/tmp/Card.tsx')
        expect(ctx.sessionSummary!.fixedViolationCount).toBe(5) // 3 + 2
    })

    it('returns empty fixedFiles when no flint_fix mutations exist', async () => {
        const nonFixEvents = [
            JSON.stringify({ batchId: 'b1', timestamp: '2026-03-15T10:00:00Z', tool: 'flint_ast_mutate', filePath: '/tmp/Button.tsx', mutationCount: 1, outcome: 'Success' }),
        ].join('\n')
        writeFlintFile(projectRoot, 'context.json', SAMPLE_CONTEXT)
        writeFlintFile(projectRoot, 'mcp-events.jsonl', nonFixEvents)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionSummary!.fixedFiles).toEqual([])
        expect(ctx.sessionSummary!.fixedViolationCount).toBe(0)
    })

    // ── sessionSummary with no prior session data ────────────────────────

    it('returns null lastSessionDate when no mutations exist', async () => {
        writeFlintFile(projectRoot, 'context.json', SAMPLE_CONTEXT)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionSummary).not.toBeNull()
        expect(ctx.sessionSummary!.lastSessionDate).toBeNull()
        expect(ctx.sessionSummary!.fixedFiles).toEqual([])
        expect(ctx.sessionSummary!.fixedViolationCount).toBe(0)
    })

    it('returns empty sessionSummary when all files are missing', async () => {
        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionSummary).not.toBeNull()
        expect(ctx.sessionSummary!.lastSessionDate).toBeNull()
        expect(ctx.sessionSummary!.deferredViolations).toEqual([])
    })

    // ── Deferred violations ──────────────────────────────────────────────

    it('populates deferredViolations from deferred-violations.json', async () => {
        writeFlintFile(projectRoot, 'context.json', SAMPLE_CONTEXT)
        writeFlintFile(projectRoot, 'deferred-violations.json', SAMPLE_DEFERRED_VIOLATIONS)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionSummary!.deferredViolations).toHaveLength(2)
        expect(ctx.sessionSummary!.deferredViolations[0].file).toBe('/src/Button.tsx')
        expect(ctx.sessionSummary!.deferredViolations[0].ruleId).toBe('MITH-COL-001')
        expect(ctx.sessionSummary!.deferredViolations[0].nodeId).toBe('flint-btn-root')
        expect(ctx.sessionSummary!.deferredViolations[0].reason).toBe('Will fix after design review')
        expect(ctx.sessionSummary!.deferredViolations[1].nodeId).toBeNull()
    })

    it('returns empty deferredViolations when file is missing', async () => {
        writeFlintFile(projectRoot, 'context.json', SAMPLE_CONTEXT)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionSummary!.deferredViolations).toEqual([])
    })

    it('handles malformed deferred-violations.json gracefully', async () => {
        writeFlintFile(projectRoot, 'context.json', SAMPLE_CONTEXT)
        writeFlintFile(projectRoot, 'deferred-violations.json', '{ bad json')

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionSummary!.deferredViolations).toEqual([])
    })

    it('filters out invalid entries from deferred-violations.json', async () => {
        const mixedEntries = [
            { file: '/src/Button.tsx', ruleId: 'MITH-COL-001', nodeId: null, reason: null, deferredAt: '2026-03-15T10:00:00Z' },
            { notAFile: true }, // Invalid
            'string entry',    // Invalid
            null,              // Invalid
            { file: '/src/Card.tsx', ruleId: 'A11Y-001', nodeId: null, reason: null, deferredAt: '2026-03-15T10:05:00Z' },
        ]
        writeFlintFile(projectRoot, 'context.json', SAMPLE_CONTEXT)
        writeFlintFile(projectRoot, 'deferred-violations.json', mixedEntries)

        const ctx = await assembleSessionContext(projectRoot)

        // Only 2 valid entries should survive
        expect(ctx.sessionSummary!.deferredViolations).toHaveLength(2)
    })
})

describe('sessionPersona in assembleSessionContext', () => {
    let projectRoot: string

    beforeEach(() => {
        projectRoot = createTempProject()
        invalidateSessionContextCache(projectRoot)
    })

    afterEach(() => {
        invalidateSessionContextCache(projectRoot)
        cleanup(projectRoot)
    })

    it('returns null sessionPersona by default', async () => {
        writeFlintFile(projectRoot, 'context.json', SAMPLE_CONTEXT)

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionPersona).toBeNull()
    })

    it('reads designer persona from context.json', async () => {
        writeFlintFile(projectRoot, 'context.json', {
            ...SAMPLE_CONTEXT,
            sessionPersona: 'designer',
        })

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionPersona).toBe('designer')
    })

    it('reads developer persona from context.json', async () => {
        writeFlintFile(projectRoot, 'context.json', {
            ...SAMPLE_CONTEXT,
            sessionPersona: 'developer',
        })

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionPersona).toBe('developer')
    })

    it('returns null for invalid persona values', async () => {
        writeFlintFile(projectRoot, 'context.json', {
            ...SAMPLE_CONTEXT,
            sessionPersona: 'hacker',
        })

        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionPersona).toBeNull()
    })

    it('returns null when context.json is missing', async () => {
        const ctx = await assembleSessionContext(projectRoot)

        expect(ctx.sessionPersona).toBeNull()
    })
})
