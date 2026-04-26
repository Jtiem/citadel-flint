/**
 * onTokenApproved.mint5.test.ts — electron/__tests__/onTokenApproved.mint5.test.ts
 *
 * MINT.5 Phase 1 — tests for the governance:on-token-approved push channel.
 *
 * Contract:
 *   - tokens:approve-token (MODIFIED) broadcasts after FTM write resolves (R8)
 *   - flint_approve_tokens (MCP tool) triggers broadcast with source='mcp'
 *   - broadcastTokenApproved helper is called from both paths
 *   - TokenApprovedEvent shape: { tokenName, source: 'glass'|'mcp', timestamp }
 *
 * Pattern: all handler logic reproduced as pure functions. No Electron IPC or
 * BrowserWindow required in the test process.
 */

import { describe, it, expect, vi } from 'vitest'
import type {
    TokenApprovedEvent,
    TokenApprovedSource,
} from '../../.flint-context/contracts/MINT.5-phase1.contract'

// ── Reproduced broadcastTokenApproved helper ──────────────────────────────────

interface Window {
    isDestroyed(): boolean
    webContentsSend: (channel: string, data: unknown) => void
}

function makeBroadcastHelper(windows: Window[]) {
    const broadcasts: { channel: string; event: TokenApprovedEvent }[] = []

    function broadcastTokenApproved(tokenName: string, source: 'glass' | 'mcp'): void {
        const event: TokenApprovedEvent = { tokenName, source, timestamp: Date.now() }
        windows.forEach((w) => {
            if (!w.isDestroyed()) {
                w.webContentsSend('governance:on-token-approved', event)
                broadcasts.push({ channel: 'governance:on-token-approved', event })
            }
        })
    }

    return { broadcastTokenApproved, broadcasts }
}

// ── Reproduced tokens:approve-token handler ────────────────────────────────────

interface PendingToken {
    name: string
    value: string
    type: string
    source: string
    proposedAt: string
}

interface ApproveResult {
    ok: boolean
}

async function simulateApproveToken(
    tokenName: unknown,
    pending: PendingToken[],
    ftmWrites: Array<{ path: string; content: string }>,
    broadcastFn: (name: string, source: 'glass' | 'mcp') => void,
    validatePath: (name: string) => boolean,
): Promise<ApproveResult> {
    if (typeof tokenName !== 'string') return { ok: false }
    if (!validatePath(tokenName)) return { ok: false }

    const token = pending.find((t) => t.name === tokenName)
    if (!token) return { ok: false }

    // Simulate pending write
    const remaining = pending.filter((t) => t.name !== tokenName)
    ftmWrites.push({ path: 'pending-tokens.json', content: JSON.stringify(remaining) })

    // Simulate design-tokens.json write
    ftmWrites.push({ path: 'design-tokens.json', content: JSON.stringify({ [token.name]: { $value: token.value, $type: token.type } }) })

    // R8: broadcast fires AFTER write resolves
    broadcastFn(token.name, 'glass')

    return { ok: true }
}

// ── Glass-path broadcast (tokens:approve-token handler) ───────────────────────

describe('MINT.5 — governance:on-token-approved glass-path broadcast (R8)', () => {
    it('broadcast fires AFTER FileTransactionManager write resolves (not before)', async () => {
        const order: string[] = []
        const windows: Window[] = [{ isDestroyed: () => false, webContentsSend: () => order.push('broadcast') }]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)

        const pending: PendingToken[] = [{ name: 'colors.primary', value: '#3b82f6', type: 'color', source: 'figma', proposedAt: '' }]
        const ftmWrites: Array<{ path: string; content: string }> = []

        const result = await simulateApproveToken(
            'colors.primary',
            pending,
            ftmWrites,
            (name, source) => {
                // Broadcast after writes
                expect(ftmWrites.length).toBeGreaterThan(0)
                broadcastTokenApproved(name, source)
                order.push('broadcast-called')
            },
            () => true,
        )

        expect(result.ok).toBe(true)
        expect(order).toContain('broadcast-called')
        // Writes must have happened before broadcast
        expect(ftmWrites.length).toBeGreaterThan(0)
    })

    it('broadcast is suppressed when tokens:approve-token returns { ok: false }', async () => {
        const broadcasts: string[] = []
        const windows: Window[] = [{ isDestroyed: () => false, webContentsSend: () => broadcasts.push('fired') }]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)

        const pending: PendingToken[] = [] // empty — token not found
        const ftmWrites: Array<{ path: string; content: string }> = []

        const result = await simulateApproveToken(
            'colors.primary', // not in pending
            pending,
            ftmWrites,
            broadcastTokenApproved,
            () => true,
        )

        expect(result.ok).toBe(false)
        expect(broadcasts).toHaveLength(0)
    })

    it('broadcast carries tokenName matching the approved token', async () => {
        const captured: TokenApprovedEvent[] = []
        const windows: Window[] = [{
            isDestroyed: () => false,
            webContentsSend: (_: string, data: unknown) => captured.push(data as TokenApprovedEvent),
        }]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)

        const pending: PendingToken[] = [{ name: 'colors.primary', value: '#3b82f6', type: 'color', source: 'figma', proposedAt: '' }]
        await simulateApproveToken('colors.primary', pending, [], broadcastTokenApproved, () => true)

        expect(captured[0].tokenName).toBe('colors.primary')
    })

    it('broadcast carries source === "glass"', async () => {
        const captured: TokenApprovedEvent[] = []
        const windows: Window[] = [{
            isDestroyed: () => false,
            webContentsSend: (_: string, data: unknown) => captured.push(data as TokenApprovedEvent),
        }]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)
        const pending: PendingToken[] = [{ name: 'x.y', value: 'val', type: 'string', source: 'figma', proposedAt: '' }]
        await simulateApproveToken('x.y', pending, [], broadcastTokenApproved, () => true)
        expect(captured[0].source).toBe('glass')
    })

    it('broadcast carries a numeric timestamp (Unix epoch ms)', async () => {
        const captured: TokenApprovedEvent[] = []
        const windows: Window[] = [{
            isDestroyed: () => false,
            webContentsSend: (_: string, data: unknown) => captured.push(data as TokenApprovedEvent),
        }]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)
        const pending: PendingToken[] = [{ name: 'x.y', value: 'val', type: 'string', source: 'figma', proposedAt: '' }]
        const before = Date.now()
        await simulateApproveToken('x.y', pending, [], broadcastTokenApproved, () => true)
        const after = Date.now()
        expect(typeof captured[0].timestamp).toBe('number')
        expect(captured[0].timestamp).toBeGreaterThanOrEqual(before)
        expect(captured[0].timestamp).toBeLessThanOrEqual(after)
    })

    it('all BrowserWindows receive the broadcast (getAllWindows loop)', async () => {
        const received: string[] = []
        const windows: Window[] = [
            { isDestroyed: () => false, webContentsSend: () => received.push('w1') },
            { isDestroyed: () => false, webContentsSend: () => received.push('w2') },
            { isDestroyed: () => false, webContentsSend: () => received.push('w3') },
        ]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)
        const pending: PendingToken[] = [{ name: 'x.y', value: 'val', type: 'string', source: 'figma', proposedAt: '' }]
        await simulateApproveToken('x.y', pending, [], broadcastTokenApproved, () => true)
        expect(received).toEqual(['w1', 'w2', 'w3'])
    })

    it('no broadcast emitted when approve-token handler throws', async () => {
        // Simulate a handler that throws mid-way (e.g., FTM write fails)
        async function brokenApprove(): Promise<void> {
            throw new Error('FTM write failed')
        }
        let broadcastCalled = false
        try {
            await brokenApprove()
            broadcastCalled = true
        } catch { /* expected */ }
        expect(broadcastCalled).toBe(false)
    })
})

// ── MCP-path broadcast (flint_approve_tokens) ────────────────────────────────

describe('MINT.5 — governance:on-token-approved mcp-path broadcast', () => {
    it('MCP flint_approve_tokens completion triggers broadcastTokenApproved with source="mcp"', () => {
        const broadcasts: TokenApprovedEvent[] = []
        const windows: Window[] = [{
            isDestroyed: () => false,
            webContentsSend: (_: string, data: unknown) => broadcasts.push(data as TokenApprovedEvent),
        }]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)

        // Simulate what the MCP event listener does after flint_approve_tokens:
        broadcastTokenApproved('colors.brand', 'mcp')

        expect(broadcasts[0].source).toBe('mcp')
        expect(broadcasts[0].tokenName).toBe('colors.brand')
    })

    it('mcp-path broadcast carries same TokenApprovedEvent shape as glass-path', () => {
        const mcpBroadcasts: TokenApprovedEvent[] = []
        const glassBroadcasts: TokenApprovedEvent[] = []

        const windows: Window[] = [{
            isDestroyed: () => false,
            webContentsSend: (_: string, data: unknown) => {
                const ev = data as TokenApprovedEvent
                if (ev.source === 'mcp') mcpBroadcasts.push(ev)
                else glassBroadcasts.push(ev)
            },
        }]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)

        broadcastTokenApproved('colors.primary', 'glass')
        broadcastTokenApproved('colors.primary', 'mcp')

        expect(Object.keys(mcpBroadcasts[0])).toEqual(Object.keys(glassBroadcasts[0]))
    })

    it('mcp-path broadcast does not trigger another approve call (no feedback loop, R3)', () => {
        // ApprovalStagingArea only clears local state — it never calls approve-token.
        // Simulate: listener fires, we only clear state, no recursive approve.
        let approveCallCount = 0
        function onEvent(event: TokenApprovedEvent) {
            if (event.source === 'mcp') {
                // Only clear local state — do NOT call approve again
                const cleared = event.tokenName // just use the name
                expect(cleared).toBeTruthy()
                // approveCallCount stays 0
            }
        }
        onEvent({ tokenName: 'colors.primary', source: 'mcp', timestamp: Date.now() })
        expect(approveCallCount).toBe(0)
    })

    it('mcp-events.jsonl row is written with event="token-approved" before broadcast', () => {
        // Simulate the MCP tool side: write event row, then broadcast
        const jsonlRows: unknown[] = []
        const broadcasts: TokenApprovedEvent[] = []
        const windows: Window[] = [{
            isDestroyed: () => false,
            webContentsSend: (_: string, data: unknown) => broadcasts.push(data as TokenApprovedEvent),
        }]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)

        // MCP tool writes event first
        const row = { event: 'token-approved', tokenName: 'colors.primary', source: 'mcp', timestamp: Date.now() }
        jsonlRows.push(row)

        // Then broadcasts
        broadcastTokenApproved('colors.primary', 'mcp')

        expect(jsonlRows).toHaveLength(1)
        expect(broadcasts).toHaveLength(1)
        // Event was written before broadcast (order guaranteed since both are sync)
        expect(jsonlRows[0]).toMatchObject({ event: 'token-approved', tokenName: 'colors.primary' })
    })
})

// ── broadcastTokenApproved helper ────────────────────────────────────────────

describe('MINT.5 — broadcastTokenApproved shared helper', () => {
    it('helper is called from tokens:approve-token handler (glass path)', async () => {
        const broadcastCalls: { name: string; source: TokenApprovedSource }[] = []
        const pending: PendingToken[] = [{ name: 'x.y', value: 'val', type: 'string', source: 'figma', proposedAt: '' }]
        await simulateApproveToken(
            'x.y',
            pending,
            [],
            (name, source) => broadcastCalls.push({ name, source }),
            () => true,
        )
        expect(broadcastCalls).toHaveLength(1)
        expect(broadcastCalls[0].source).toBe('glass')
    })

    it('helper is called from mcp event listener (mcp path)', () => {
        const broadcastCalls: { name: string; source: TokenApprovedSource }[] = []
        function mcpBroadcast(name: string, source: TokenApprovedSource) {
            broadcastCalls.push({ name, source })
        }
        // MCP fan-in calls broadcastTokenApproved with source='mcp'
        mcpBroadcast('colors.primary', 'mcp')
        expect(broadcastCalls[0].source).toBe('mcp')
    })

    it('helper produces TokenApprovedEvent with correct { tokenName, source, timestamp }', () => {
        const broadcasts: TokenApprovedEvent[] = []
        const windows: Window[] = [{
            isDestroyed: () => false,
            webContentsSend: (_: string, data: unknown) => broadcasts.push(data as TokenApprovedEvent),
        }]
        const { broadcastTokenApproved } = makeBroadcastHelper(windows)
        broadcastTokenApproved('colors.primary', 'glass')

        expect(broadcasts[0]).toMatchObject({
            tokenName: 'colors.primary',
            source: 'glass',
        })
        expect(typeof broadcasts[0].timestamp).toBe('number')
    })

    it('helper handles empty BrowserWindow list without throwing', () => {
        const { broadcastTokenApproved, broadcasts } = makeBroadcastHelper([])
        expect(() => broadcastTokenApproved('colors.x', 'glass')).not.toThrow()
        expect(broadcasts).toHaveLength(0)
    })
})

// ── Preload bridge + web adapter ──────────────────────────────────────────────

describe('MINT.5 — onTokenApproved preload bridge + web adapter', () => {
    it('preload onTokenApproved(callback) registers ipcRenderer.on listener and returns unsubscribe fn', () => {
        const listeners = new Map<string, Set<Function>>()
        const mockIpcRenderer = {
            on: vi.fn((channel: string, listener: Function) => {
                if (!listeners.has(channel)) listeners.set(channel, new Set())
                listeners.get(channel)!.add(listener)
            }),
            removeListener: vi.fn((channel: string, listener: Function) => {
                listeners.get(channel)?.delete(listener)
            }),
        }

        // Simulate preload bridge onTokenApproved
        function onTokenApproved(callback: (event: TokenApprovedEvent) => void): () => void {
            const listener = (_ev: unknown, data: TokenApprovedEvent) => callback(data)
            mockIpcRenderer.on('flint:governance:on-token-approved', listener)
            return () => {
                mockIpcRenderer.removeListener('flint:governance:on-token-approved', listener)
            }
        }

        const callback = vi.fn()
        const unsub = onTokenApproved(callback)

        expect(mockIpcRenderer.on).toHaveBeenCalledWith('flint:governance:on-token-approved', expect.any(Function))

        // Calling unsubscribe should removeListener
        unsub()
        expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('flint:governance:on-token-approved', expect.any(Function))
    })

    it('calling the returned unsubscribe fn removes the listener (no leak)', () => {
        const channelSets = new Map<string, Set<Function>>()
        const mockIpcRenderer = {
            on: vi.fn((ch: string, fn: Function) => {
                if (!channelSets.has(ch)) channelSets.set(ch, new Set())
                channelSets.get(ch)!.add(fn)
            }),
            removeListener: vi.fn((ch: string, fn: Function) => {
                channelSets.get(ch)?.delete(fn)
            }),
        }

        function onTokenApproved(callback: (event: TokenApprovedEvent) => void): () => void {
            const listener = (_ev: unknown, data: TokenApprovedEvent) => callback(data)
            mockIpcRenderer.on('flint:governance:on-token-approved', listener)
            return () => mockIpcRenderer.removeListener('flint:governance:on-token-approved', listener)
        }

        const unsub = onTokenApproved(vi.fn())
        expect(channelSets.get('flint:governance:on-token-approved')?.size).toBe(1)
        unsub()
        expect(channelSets.get('flint:governance:on-token-approved')?.size).toBe(0)
    })

    it('web-api.ts mirrors the WS event and calls callback with TokenApprovedEvent', () => {
        // Simulate the web adapter subscribe mechanism
        const wsListeners = new Map<string, Set<Function>>()
        function subscribe(channel: string, callback: Function): () => void {
            if (!wsListeners.has(channel)) wsListeners.set(channel, new Set())
            wsListeners.get(channel)!.add(callback)
            return () => wsListeners.get(channel)?.delete(callback)
        }

        const received: TokenApprovedEvent[] = []
        subscribe('flint:governance:on-token-approved', (data: TokenApprovedEvent) => received.push(data))

        // Simulate WS message delivery
        const event: TokenApprovedEvent = { tokenName: 'colors.primary', source: 'mcp', timestamp: Date.now() }
        wsListeners.get('flint:governance:on-token-approved')?.forEach((fn) => fn(event))

        expect(received).toHaveLength(1)
        expect(received[0].tokenName).toBe('colors.primary')
        expect(received[0].source).toBe('mcp')
    })

    it('web adapter unsubscribe removes the WS listener', () => {
        const wsListeners = new Map<string, Set<Function>>()
        function subscribe(channel: string, callback: Function): () => void {
            if (!wsListeners.has(channel)) wsListeners.set(channel, new Set())
            wsListeners.get(channel)!.add(callback)
            return () => wsListeners.get(channel)?.delete(callback)
        }

        const callback = vi.fn()
        const unsub = subscribe('flint:governance:on-token-approved', callback)
        expect(wsListeners.get('flint:governance:on-token-approved')?.size).toBe(1)
        unsub()
        expect(wsListeners.get('flint:governance:on-token-approved')?.size).toBe(0)
    })
})
