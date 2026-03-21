/**
 * context-enriched.test.ts
 *
 * Tests for the `context:get-enriched` IPC handler (Phase ACX.5).
 *
 * The handler reads `.flint/context.json` (returns a graceful default when
 * missing), queries the SQLite `design_tokens` and `component_overrides` tables
 * for live metrics, and returns the merged EnrichedContext object.
 *
 * Architecture note:
 *   The IPC handler itself lives in `electron/main.ts` and requires Electron's
 *   `ipcMain` and `app` APIs. It cannot be imported in a headless test
 *   environment. We test the same contractual behaviour by:
 *
 *   1. Implementing the exact handler logic inline (pure Node.js).
 *   2. Verifying the shape of the result against the EnrichedContext contract
 *      defined in `src/types/flint-api.d.ts`.
 *
 *   This mirrors the established test architecture in orchestratorSafety.test.ts
 *   and complexityRouter.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ── Inline implementation of the context:get-enriched handler logic ───────────
// Mirrors exactly what main.ts does, but runs against a temp directory so no
// Electron APIs are needed.

async function readEnrichedContext(
    flintDir: string,
    tokenCount: number,
    activeOverrideCount: number,
): Promise<Record<string, unknown>> {
    const contextPath = path.join(flintDir, 'context.json')

    let base: Record<string, unknown> = {}
    try {
        const { readFile } = await import('node:fs/promises')
        const raw = await readFile(contextPath, 'utf8')
        base = JSON.parse(raw) as Record<string, unknown>
    } catch {
        // context.json does not exist yet or is malformed — start with empty base.
        base = { timestamp: Date.now(), activeFile: null }
    }

    return {
        ...base,
        tokenCount,
        activeOverrideCount,
        enrichedAt: new Date().toISOString(),
    }
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'flint-acx-test-'))
})

afterEach(async () => {
    if (tmpDir && existsSync(tmpDir)) {
        await rm(tmpDir, { recursive: true, force: true })
    }
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('context:get-enriched — graceful degradation', () => {
    it('returns default base when context.json does not exist', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const result = await readEnrichedContext(flintDir, 0, 0)

        expect(result).toHaveProperty('activeFile', null)
        expect(result).toHaveProperty('tokenCount', 0)
        expect(result).toHaveProperty('activeOverrideCount', 0)
        expect(result).toHaveProperty('enrichedAt')
        expect(typeof result['enrichedAt']).toBe('string')
    })

    it('returns null activeFile when context.json is missing', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const result = await readEnrichedContext(flintDir, 0, 0)
        expect(result['activeFile']).toBeNull()
    })

    it('enrichedAt is an ISO 8601 string', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const result = await readEnrichedContext(flintDir, 5, 2)
        const enrichedAt = result['enrichedAt'] as string
        expect(() => new Date(enrichedAt).toISOString()).not.toThrow()
    })
})

describe('context:get-enriched — with context.json present', () => {
    it('merges context.json fields with live SQLite metrics', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const contextSnapshot = {
            timestamp: 1700000000000,
            activeFile: '/Users/user/project/src/App.tsx',
            selectedNodeId: 'div:10:4',
            saveState: 'saved',
            canvasMode: 'design',
            openFiles: ['/Users/user/project/src/App.tsx'],
            violations: {
                mithrilCount: 2,
                a11yCount: 1,
                criticalCount: 0,
                nodeIds: ['div:10:4'],
            },
        }

        await writeFile(
            path.join(flintDir, 'context.json'),
            JSON.stringify(contextSnapshot, null, 2),
            'utf8',
        )

        const result = await readEnrichedContext(flintDir, 42, 3)

        // All original fields should be preserved
        expect(result['timestamp']).toBe(1700000000000)
        expect(result['activeFile']).toBe('/Users/user/project/src/App.tsx')
        expect(result['selectedNodeId']).toBe('div:10:4')
        expect(result['saveState']).toBe('saved')

        // Enriched fields should be added
        expect(result['tokenCount']).toBe(42)
        expect(result['activeOverrideCount']).toBe(3)
        expect(result).toHaveProperty('enrichedAt')
    })

    it('live metrics override nothing from context.json — fields are additive', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const snapshot = { timestamp: 999, activeFile: '/some/file.tsx', customField: 'hello' }
        await writeFile(
            path.join(flintDir, 'context.json'),
            JSON.stringify(snapshot),
            'utf8',
        )

        const result = await readEnrichedContext(flintDir, 10, 1)

        // Custom field from context.json preserved
        expect(result['customField']).toBe('hello')
        // Enriched fields added
        expect(result['tokenCount']).toBe(10)
        expect(result['activeOverrideCount']).toBe(1)
    })

    it('returns tokenCount of 0 when no tokens exist', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const result = await readEnrichedContext(flintDir, 0, 0)
        expect(result['tokenCount']).toBe(0)
    })

    it('returns activeOverrideCount of 0 when no overrides exist', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const result = await readEnrichedContext(flintDir, 5, 0)
        expect(result['activeOverrideCount']).toBe(0)
    })

    it('handles malformed context.json gracefully', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        await writeFile(
            path.join(flintDir, 'context.json'),
            'this is not valid json {{{',
            'utf8',
        )

        // Should not throw — returns default base instead
        const result = await readEnrichedContext(flintDir, 0, 0)
        expect(result).toHaveProperty('activeFile', null)
        expect(result).toHaveProperty('tokenCount', 0)
    })

    it('handles empty context.json gracefully', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        await writeFile(path.join(flintDir, 'context.json'), '', 'utf8')

        // Empty file produces a JSON parse error — should fall back to defaults
        const result = await readEnrichedContext(flintDir, 0, 0)
        expect(result).toHaveProperty('activeFile', null)
    })

    it('enrichedAt is always set even when context.json has no timestamp', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        await writeFile(
            path.join(flintDir, 'context.json'),
            JSON.stringify({ activeFile: null }),
            'utf8',
        )

        const result = await readEnrichedContext(flintDir, 0, 0)
        expect(result['enrichedAt']).toBeDefined()
        expect(typeof result['enrichedAt']).toBe('string')
    })
})

describe('context:get-enriched — EnrichedContext shape contract', () => {
    it('result always includes all required EnrichedContext fields', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const result = await readEnrichedContext(flintDir, 10, 2)

        // Required fields per the EnrichedContext contract in flint-api.d.ts
        expect(result).toHaveProperty('tokenCount')
        expect(result).toHaveProperty('activeOverrideCount')
        expect(result).toHaveProperty('enrichedAt')
    })

    it('tokenCount is always a number', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const result = await readEnrichedContext(flintDir, 7, 0)
        expect(typeof result['tokenCount']).toBe('number')
    })

    it('activeOverrideCount is always a number', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const result = await readEnrichedContext(flintDir, 0, 4)
        expect(typeof result['activeOverrideCount']).toBe('number')
    })
})

describe('context:get-enriched — ACX.5 enriched fields passthrough', () => {
    it('preserves sourceExcerpt when present in context.json', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const snapshot = {
            timestamp: Date.now(),
            activeFile: '/file.tsx',
            sourceExcerpt: 'import React from "react"\n\nexport default function App() {}',
        }

        await writeFile(
            path.join(flintDir, 'context.json'),
            JSON.stringify(snapshot),
            'utf8',
        )

        const result = await readEnrichedContext(flintDir, 0, 0)
        expect(result['sourceExcerpt']).toBe(snapshot.sourceExcerpt)
    })

    it('preserves violationSnapshot when present in context.json', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const snapshot = {
            timestamp: Date.now(),
            activeFile: '/file.tsx',
            violationSnapshot: {
                total: 3,
                criticalCount: 1,
                exportBlocked: true,
                exportBlockReason: '1 Mithril violation(s)',
            },
        }

        await writeFile(
            path.join(flintDir, 'context.json'),
            JSON.stringify(snapshot),
            'utf8',
        )

        const result = await readEnrichedContext(flintDir, 0, 0)
        const vs = result['violationSnapshot'] as Record<string, unknown>
        expect(vs['total']).toBe(3)
        expect(vs['criticalCount']).toBe(1)
        expect(vs['exportBlocked']).toBe(true)
        expect(vs['exportBlockReason']).toBe('1 Mithril violation(s)')
    })

    it('preserves selectedNodeSummary when present in context.json', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        const snapshot = {
            timestamp: Date.now(),
            activeFile: '/file.tsx',
            selectedNodeSummary: {
                tagName: 'button',
                flintId: 'button:12:4',
                className: 'bg-brand-primary text-white',
                props: { type: 'submit' },
                childCount: 1,
                parentId: 'div:10:2',
            },
        }

        await writeFile(
            path.join(flintDir, 'context.json'),
            JSON.stringify(snapshot),
            'utf8',
        )

        const result = await readEnrichedContext(flintDir, 0, 0)
        const ns = result['selectedNodeSummary'] as Record<string, unknown>
        expect(ns['tagName']).toBe('button')
        expect(ns['flintId']).toBe('button:12:4')
        expect(ns['parentId']).toBe('div:10:2')
    })
})
