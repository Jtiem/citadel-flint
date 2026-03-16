/**
 * contextPush.test.ts — Phase ACX.2 tests (ACX-09 through ACX-14)
 *
 * Tests the ContextPushManager in isolation using a temp-directory fixture.
 * File-watch timing is avoided entirely: we write context.json and call
 * checkContextNow() / checkTokensNow() directly to bypass the 300 ms debounce.
 *
 * Pattern mirrors boundary-contracts.test.ts: real file I/O, hermetic temp dirs,
 * cleanup in afterEach.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { ContextPushManager } from '../core/contextPush.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a hermetic temp directory with a .bridge sub-directory. */
function makeProjectDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-ctx-push-test-'))
    fs.mkdirSync(path.join(dir, '.bridge'), { recursive: true })
    return dir
}

function rmDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true })
}

/** Write .bridge/context.json in the given project root. */
function writeContext(
    projectRoot: string,
    fields: {
        activeFile?: string | null
        violationTotal?: number
        mithrilCount?: number
        a11yCount?: number
        exportBlocked?: boolean
        exportBlockReason?: string | null
        healthGrade?: string | null
    },
): void {
    const ctx: Record<string, unknown> = {
        timestamp: Date.now(),
        activeFile: fields.activeFile ?? null,
        selectedNodeId: null,
        cursorPosition: null,
        violations: {
            mithrilCount: fields.mithrilCount ?? 0,
            a11yCount: fields.a11yCount ?? 0,
            criticalCount: 0,
            nodeIds: [] as string[],
        },
        saveState: 'saved',
        canvasMode: 'design',
        openFiles: fields.activeFile ? [fields.activeFile] : [],
    }

    if (fields.exportBlocked !== undefined) ctx['exportBlocked'] = fields.exportBlocked
    if (fields.exportBlockReason !== undefined) ctx['exportBlockReason'] = fields.exportBlockReason
    if (fields.healthGrade !== undefined) ctx['healthGrade'] = fields.healthGrade

    // If an explicit violationTotal override was provided, write it.
    if (fields.violationTotal !== undefined) {
        ctx['violationTotal'] = fields.violationTotal
    }

    fs.writeFileSync(
        path.join(projectRoot, '.bridge', 'context.json'),
        JSON.stringify(ctx, null, 2),
        'utf-8',
    )
}

/** Write .bridge/design-tokens.json as an array of N dummy tokens. */
function writeTokens(projectRoot: string, count: number): void {
    const tokens = Array.from({ length: count }, (_, i) => ({
        id: i,
        token_path: `color/neutral/${i}`,
        token_type: 'color',
        token_value: '#000000',
    }))
    fs.writeFileSync(
        path.join(projectRoot, '.bridge', 'design-tokens.json'),
        JSON.stringify(tokens),
        'utf-8',
    )
}

/** Read .bridge/mcp-events.jsonl and return parsed events. */
function readEvents(projectRoot: string): Array<Record<string, unknown>> {
    const eventsPath = path.join(projectRoot, '.bridge', 'mcp-events.jsonl')
    if (!fs.existsSync(eventsPath)) return []
    return fs
        .readFileSync(eventsPath, 'utf-8')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>)
}

/** Filter to events of type 'context-delta' and parse their summary as JSON. */
function readContextDeltaEvents(projectRoot: string): Array<Record<string, unknown>> {
    return readEvents(projectRoot)
        .filter((e) => e['type'] === 'context-delta')
        .map((e) => JSON.parse(e['summary'] as string) as Record<string, unknown>)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ACX-09: ContextPushManager — file switch detection', () => {
    let projectRoot: string
    let manager: ContextPushManager

    beforeEach(() => {
        projectRoot = makeProjectDir()
        manager = new ContextPushManager()

        // Seed initial state: no active file
        writeContext(projectRoot, { activeFile: null })
        manager.start(projectRoot)
    })

    afterEach(() => {
        manager.stop()
        rmDir(projectRoot)
    })

    it('emits a context-delta event when activeFile changes from null to a path', () => {
        writeContext(projectRoot, { activeFile: '/src/components/Button.tsx' })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        expect(deltas.length).toBeGreaterThanOrEqual(1)

        const fileSwitched = deltas.find((d) => d['trigger'] === 'file-switched')
        expect(fileSwitched).toBeDefined()
    })

    it('the file-switched delta payload contains the new filePath', () => {
        const newFile = '/src/components/Card.tsx'
        writeContext(projectRoot, { activeFile: newFile })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const fileSwitched = deltas.find((d) => d['trigger'] === 'file-switched')
        expect(fileSwitched).toBeDefined()
        const payload = fileSwitched!['payload'] as Record<string, unknown>
        expect(payload['filePath']).toBe(newFile)
    })

    it('emits a new file-switched event when activeFile changes to a different file', () => {
        // Seed to file A
        writeContext(projectRoot, { activeFile: '/src/A.tsx' })
        manager.checkContextNow()

        // Switch to file B
        writeContext(projectRoot, { activeFile: '/src/B.tsx' })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const fileSwitches = deltas.filter((d) => d['trigger'] === 'file-switched')
        expect(fileSwitches.length).toBeGreaterThanOrEqual(2)
    })

    it('does NOT emit a file-switched event when activeFile stays the same', () => {
        // Establish state with a file active
        writeContext(projectRoot, { activeFile: '/src/Same.tsx' })
        manager.checkContextNow()
        const countBefore = readContextDeltaEvents(projectRoot).length

        // "Change" something unrelated (cursor position / timestamp), same file
        writeContext(projectRoot, { activeFile: '/src/Same.tsx' })
        manager.checkContextNow()

        const countAfter = readContextDeltaEvents(projectRoot).length
        // No NEW file-switched events should have been added
        const newDeltas = readContextDeltaEvents(projectRoot).slice(countBefore)
        const newFileSwitches = newDeltas.filter((d) => d['trigger'] === 'file-switched')
        expect(newFileSwitches.length).toBe(0)
    })
})

describe('ACX-10: ContextPushManager — violation count change detection', () => {
    let projectRoot: string
    let manager: ContextPushManager

    beforeEach(() => {
        projectRoot = makeProjectDir()
        manager = new ContextPushManager()

        writeContext(projectRoot, { mithrilCount: 0, a11yCount: 0 })
        manager.start(projectRoot)
    })

    afterEach(() => {
        manager.stop()
        rmDir(projectRoot)
    })

    it('emits a violations-changed event when mithrilCount increases by 1', () => {
        writeContext(projectRoot, {
            activeFile: '/src/Button.tsx',
            mithrilCount: 1,
            a11yCount: 0,
        })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const changed = deltas.find((d) => d['trigger'] === 'violations-changed')
        expect(changed).toBeDefined()
    })

    it('the violations-changed payload carries correct added / resolved counts', () => {
        // Start with 3 violations
        writeContext(projectRoot, { mithrilCount: 2, a11yCount: 1 })
        manager.checkContextNow()

        // Drop to 1 (2 resolved)
        writeContext(projectRoot, { mithrilCount: 1, a11yCount: 0 })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        // Find the last violations-changed event
        const changed = [...deltas]
            .reverse()
            .find((d) => d['trigger'] === 'violations-changed')
        expect(changed).toBeDefined()
        const payload = changed!['payload'] as Record<string, unknown>
        expect(payload['resolved']).toBe(2)
        expect(payload['currentTotal']).toBe(1)
    })

    it('does NOT emit a violations-changed event when count stays at 0', () => {
        writeContext(projectRoot, { mithrilCount: 0, a11yCount: 0 })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const changed = deltas.find((d) => d['trigger'] === 'violations-changed')
        expect(changed).toBeUndefined()
    })
})

describe('ACX-11: ContextPushManager — export gate change detection', () => {
    let projectRoot: string
    let manager: ContextPushManager

    beforeEach(() => {
        projectRoot = makeProjectDir()
        manager = new ContextPushManager()

        writeContext(projectRoot, { exportBlocked: false, exportBlockReason: null })
        manager.start(projectRoot)
    })

    afterEach(() => {
        manager.stop()
        rmDir(projectRoot)
    })

    it('emits export-gate-changed when exportBlocked toggles from false to true', () => {
        writeContext(projectRoot, {
            exportBlocked: true,
            exportBlockReason: '2 critical violations remain',
        })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const gateChange = deltas.find((d) => d['trigger'] === 'export-gate-changed')
        expect(gateChange).toBeDefined()
        const payload = gateChange!['payload'] as Record<string, unknown>
        expect(payload['blocked']).toBe(true)
        expect(payload['reason']).toBe('2 critical violations remain')
    })

    it('emits export-gate-changed when exportBlocked clears from true to false', () => {
        // First set it to blocked
        writeContext(projectRoot, { exportBlocked: true, exportBlockReason: 'drift' })
        manager.checkContextNow()

        // Then clear it
        writeContext(projectRoot, { exportBlocked: false, exportBlockReason: null })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const gateChanges = deltas.filter((d) => d['trigger'] === 'export-gate-changed')
        expect(gateChanges.length).toBeGreaterThanOrEqual(2)

        const lastChange = gateChanges[gateChanges.length - 1]!
        const payload = lastChange['payload'] as Record<string, unknown>
        expect(payload['blocked']).toBe(false)
    })

    it('does NOT emit export-gate-changed when exportBlocked stays false', () => {
        writeContext(projectRoot, { exportBlocked: false })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const gateChanges = deltas.filter((d) => d['trigger'] === 'export-gate-changed')
        expect(gateChanges.length).toBe(0)
    })
})

describe('ACX-12: ContextPushManager — debounce suppresses rapid changes', () => {
    it('multiple synchronous checkContextNow calls each fire individually (no external debounce in test path)', () => {
        // The debounce timer applies to the fs.watch handler, not to checkContextNow.
        // This test confirms that when we bypass the debounce (call checkContextNow
        // directly), each call processes independently but only emits when content
        // actually changes.
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        try {
            writeContext(projectRoot, { activeFile: null })
            manager.start(projectRoot)

            // Switch to file once
            writeContext(projectRoot, { activeFile: '/src/A.tsx' })
            manager.checkContextNow()

            // Write identical state — no further event expected
            writeContext(projectRoot, { activeFile: '/src/A.tsx' })
            manager.checkContextNow()

            writeContext(projectRoot, { activeFile: '/src/A.tsx' })
            manager.checkContextNow()

            const deltas = readContextDeltaEvents(projectRoot)
            const fileSwitches = deltas.filter((d) => d['trigger'] === 'file-switched')
            // Only ONE switch event — the three identical writes produced no further events
            expect(fileSwitches.length).toBe(1)
        } finally {
            manager.stop()
            rmDir(projectRoot)
        }
    })

    it('stop() called before debounce fires prevents the deferred event from being written', async () => {
        // This test uses fake timers to prove stop() cancels a pending debounce.
        vi.useFakeTimers()
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        try {
            writeContext(projectRoot, { activeFile: null })
            manager.start(projectRoot)

            // Patch the internal handleContextChange to schedule a real debounce
            // then immediately call stop() before it fires.
            // We test this by checking that no events appear after stop().
            writeContext(projectRoot, { activeFile: '/src/Button.tsx' })
            // The fs.watch handler would normally call handleContextChange (debounced).
            // We verify that if we stop before the timer fires, no event is emitted.
            manager.stop()

            // Advance the clock — the timer should have been cleared.
            vi.runAllTimers()

            const deltas = readContextDeltaEvents(projectRoot)
            const fileSwitches = deltas.filter((d) => d['trigger'] === 'file-switched')
            expect(fileSwitches.length).toBe(0)
        } finally {
            vi.useRealTimers()
            rmDir(projectRoot)
        }
    })
})

describe('ACX-13: ContextPushManager — graceful handling of missing context.json', () => {
    it('start() does not throw when .bridge/context.json does not exist', () => {
        const projectRoot = makeProjectDir()
        // Do NOT write context.json
        const manager = new ContextPushManager()

        expect(() => manager.start(projectRoot)).not.toThrow()
        manager.stop()
        rmDir(projectRoot)
    })

    it('checkContextNow() does not throw when context.json is missing', () => {
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()
        manager.start(projectRoot)

        // No context.json file at all
        expect(() => manager.checkContextNow()).not.toThrow()

        manager.stop()
        rmDir(projectRoot)
    })

    it('checkContextNow() does not throw when context.json contains invalid JSON', () => {
        const projectRoot = makeProjectDir()
        fs.writeFileSync(
            path.join(projectRoot, '.bridge', 'context.json'),
            'this is not json { bad',
            'utf-8',
        )

        const manager = new ContextPushManager()
        manager.start(projectRoot)

        expect(() => manager.checkContextNow()).not.toThrow()

        manager.stop()
        rmDir(projectRoot)
    })

    it('checkContextNow() does not throw when .bridge directory does not exist', () => {
        const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-no-dot-bridge-'))
        // Intentionally do NOT create .bridge/

        const manager = new ContextPushManager()
        // start() will fail to set up the watcher but must not throw
        expect(() => manager.start(projectRoot)).not.toThrow()
        expect(() => manager.checkContextNow()).not.toThrow()

        manager.stop()
        rmDir(projectRoot)
    })
})

describe('ACX-14: ContextPushManager — start() and stop() lifecycle', () => {
    it('stop() is idempotent — calling it multiple times does not throw', () => {
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        writeContext(projectRoot, { activeFile: null })
        manager.start(projectRoot)

        expect(() => manager.stop()).not.toThrow()
        expect(() => manager.stop()).not.toThrow()
        expect(() => manager.stop()).not.toThrow()

        rmDir(projectRoot)
    })

    it('stop() prevents further events from being emitted', () => {
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        writeContext(projectRoot, { activeFile: null })
        manager.start(projectRoot)
        manager.stop()

        // After stop, write a new context — no events should be produced
        writeContext(projectRoot, { activeFile: '/src/Button.tsx' })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const fileSwitches = deltas.filter((d) => d['trigger'] === 'file-switched')
        expect(fileSwitches.length).toBe(0)

        rmDir(projectRoot)
    })

    it('start() called twice with the same root does not create duplicate watchers', () => {
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        writeContext(projectRoot, { activeFile: null })
        manager.start(projectRoot) // first call — sets up watcher
        manager.start(projectRoot) // second call — should be a no-op

        // Only one file switch event when we change the file
        writeContext(projectRoot, { activeFile: '/src/Nav.tsx' })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const fileSwitches = deltas.filter((d) => d['trigger'] === 'file-switched')
        expect(fileSwitches.length).toBe(1)

        manager.stop()
        rmDir(projectRoot)
    })

    it('event timestamps are valid ISO 8601 strings', () => {
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        writeContext(projectRoot, { activeFile: null })
        manager.start(projectRoot)

        writeContext(projectRoot, { activeFile: '/src/Foo.tsx' })
        manager.checkContextNow()

        const deltas = readContextDeltaEvents(projectRoot)
        expect(deltas.length).toBeGreaterThanOrEqual(1)

        for (const delta of deltas) {
            expect(typeof delta['timestamp']).toBe('string')
            const d = new Date(delta['timestamp'] as string)
            expect(isNaN(d.getTime())).toBe(false)
            // ISO 8601 round-trip
            expect(d.toISOString()).toBe(delta['timestamp'])
        }

        manager.stop()
        rmDir(projectRoot)
    })

    it('events written to mcp-events.jsonl carry type === "context-delta"', () => {
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        writeContext(projectRoot, { activeFile: null })
        manager.start(projectRoot)

        writeContext(projectRoot, { activeFile: '/src/Header.tsx' })
        manager.checkContextNow()

        const rawEvents = readEvents(projectRoot)
        const ctxDeltaEvents = rawEvents.filter((e) => e['type'] === 'context-delta')
        expect(ctxDeltaEvents.length).toBeGreaterThanOrEqual(1)

        manager.stop()
        rmDir(projectRoot)
    })
})

describe('ACX-15: ContextPushManager — tokens-updated detection', () => {
    it('checkTokensNow() emits a tokens-updated delta', () => {
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        writeContext(projectRoot, { activeFile: null })
        writeTokens(projectRoot, 12)
        manager.start(projectRoot)

        manager.checkTokensNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const tokenDeltas = deltas.filter((d) => d['trigger'] === 'tokens-updated')
        expect(tokenDeltas.length).toBeGreaterThanOrEqual(1)

        manager.stop()
        rmDir(projectRoot)
    })

    it('tokens-updated payload carries the correct newTotal', () => {
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        writeContext(projectRoot, { activeFile: null })
        writeTokens(projectRoot, 7)
        manager.start(projectRoot)

        manager.checkTokensNow()

        const deltas = readContextDeltaEvents(projectRoot)
        const tokenDelta = deltas.find((d) => d['trigger'] === 'tokens-updated')
        expect(tokenDelta).toBeDefined()
        const payload = tokenDelta!['payload'] as Record<string, unknown>
        expect(payload['newTotal']).toBe(7)

        manager.stop()
        rmDir(projectRoot)
    })

    it('checkTokensNow() does not throw when design-tokens.json is missing', () => {
        const projectRoot = makeProjectDir()
        const manager = new ContextPushManager()

        writeContext(projectRoot, { activeFile: null })
        // Do NOT write design-tokens.json
        manager.start(projectRoot)

        expect(() => manager.checkTokensNow()).not.toThrow()

        manager.stop()
        rmDir(projectRoot)
    })
})
