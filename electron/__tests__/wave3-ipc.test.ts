/**
 * wave3-ipc.test.ts — electron/__tests__/wave3-ipc.test.ts
 *
 * Unit tests for the Wave 3 Core Governance Loop IPC handler logic.
 *
 * Pattern: handler logic is reproduced as standalone pure functions that
 * accept injectable dependencies (mcpClient, db) so no Electron APIs
 * (ipcMain, BrowserWindow) or SQLite bindings are required in tests.
 *
 * Covers:
 *   W3-01 — governance:preview-fix returns null when ruleId is not a string
 *   W3-02 — governance:preview-fix returns null when filePath is not a string
 *   W3-03 — governance:preview-fix returns null when MCP client is disconnected
 *   W3-04 — governance:preview-fix returns null when MCP throws
 *   W3-05 — governance:preview-fix returns null when fixes array is empty
 *   W3-06 — governance:preview-fix maps currentValue + proposedValue correctly
 *   W3-07 — governance:preview-fix maps current + proposed fallback fields
 *   W3-08 — governance:preview-fix sets isColor=true for type==="color"
 *   W3-09 — governance:preview-fix sets isColor=true for explicit isColor flag
 *   W3-10 — governance:batch-fix-a11y returns error when filePath is empty string
 *   W3-11 — governance:batch-fix-a11y returns error when filePath is not a string
 *   W3-12 — governance:batch-fix-a11y returns error when MCP throws
 *   W3-13 — governance:batch-fix-a11y returns correct fixedCount on happy path
 *   W3-14 — governance:batch-fix-a11y returns 0/0 for non-JSON MCP response
 *   W3-15 — tokens:get-sync-summary returns zero totals when design_tokens is empty
 *   W3-16 — tokens:get-sync-summary aggregates byType counts correctly
 *   W3-17 — tokens:get-sync-summary returns lastSyncAt=null when MCP disconnected
 *   W3-18 — tokens:get-sync-summary returns lastSyncAt from completedAt field
 *   W3-19 — tokens:get-sync-summary returns lastSyncAt from startedAt fallback
 *   W3-20 — tokens:get-sync-summary returns null lastSyncAt when MCP throws
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FixPreviewResult {
    current: string
    proposed: string
    tokenName: string
    isColor: boolean
}

interface BatchFixA11yResult {
    success: boolean
    fixedCount: number
    manualCount: number
    error?: string
}

interface SyncSummaryResult {
    lastSyncAt: string | null
    tokenCount: number
    byType: Array<{ token_type: string; count: number }>
}

interface MockMCPClient {
    connected: boolean
    callTool: (name: string, args: Record<string, unknown>) => Promise<{
        content: Array<{ text?: string }>
    }>
}

interface MockDB {
    prepare: (sql: string) => { all: () => Array<{ token_type: string; count: number }> }
}

// ---------------------------------------------------------------------------
// governance:preview-fix — pure handler logic
// ---------------------------------------------------------------------------

async function previewFixLogic(
    ruleId: unknown,
    filePath: unknown,
    mcp: MockMCPClient,
): Promise<FixPreviewResult | null> {
    if (typeof ruleId !== 'string' || typeof filePath !== 'string') return null
    try {
        if (!mcp.connected) return null
        const rawResult = await mcp.callTool('flint_fix', {
            file: filePath,
            ruleId,
            dry_run: true,
        })
        if (!rawResult.content?.length || !rawResult.content[0].text) return null
        const parsed = JSON.parse(rawResult.content[0].text) as {
            fixes?: Array<{
                currentValue?: string
                current?: string
                proposedValue?: string
                proposed?: string
                tokenName?: string
                token_name?: string
                isColor?: boolean
                type?: string
            }>
        }
        const fixes = parsed.fixes ?? []
        if (fixes.length === 0) return null
        const fix = fixes[0]
        return {
            current: fix.currentValue ?? fix.current ?? '',
            proposed: fix.proposedValue ?? fix.proposed ?? '',
            tokenName: fix.tokenName ?? fix.token_name ?? '',
            isColor: fix.isColor ?? fix.type === 'color',
        }
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// governance:batch-fix-a11y — pure handler logic
// ---------------------------------------------------------------------------

async function batchFixA11yLogic(
    filePath: unknown,
    mcp: MockMCPClient,
): Promise<BatchFixA11yResult> {
    if (typeof filePath !== 'string' || filePath.length === 0) {
        return { success: false, fixedCount: 0, manualCount: 0, error: 'filePath must be a non-empty string' }
    }
    try {
        const rawResult = await mcp.callTool('flint_fix', {
            file: filePath,
            ruleCategory: 'a11y',
            dry_run: false,
        })
        let fixedCount = 0
        let manualCount = 0
        if (rawResult.content?.length > 0 && rawResult.content[0].text) {
            try {
                const parsed = JSON.parse(rawResult.content[0].text) as {
                    fixesApplied?: number
                    manualCount?: number
                }
                fixedCount = parsed.fixesApplied ?? 0
                manualCount = parsed.manualCount ?? 0
            } catch {
                // Non-JSON response — 0 counts.
            }
        }
        return { success: true, fixedCount, manualCount }
    } catch (err) {
        return { success: false, error: String(err), fixedCount: 0, manualCount: 0 }
    }
}

// ---------------------------------------------------------------------------
// tokens:get-sync-summary — pure handler logic
// ---------------------------------------------------------------------------

async function getSyncSummaryLogic(
    db: MockDB,
    mcp: MockMCPClient,
    projectRoot: string | null,
): Promise<SyncSummaryResult> {
    let tokenCount = 0
    let byType: Array<{ token_type: string; count: number }> = []
    try {
        const counts = db.prepare(`
            SELECT token_type, COUNT(*) as count
            FROM design_tokens
            GROUP BY token_type
            ORDER BY token_type
        `).all()
        byType = counts
        tokenCount = counts.reduce((sum, r) => sum + r.count, 0)
    } catch {
        // degrade gracefully
    }

    let lastSyncAt: string | null = null
    try {
        if (!mcp.connected) throw new Error('disconnected')
        if (!projectRoot) throw new Error('no project')
        const rawResult = await mcp.callTool('flint_sync_history', {
            projectRoot,
            format: 'json',
        })
        if (rawResult.content?.length > 0 && rawResult.content[0].text) {
            const entries = JSON.parse(rawResult.content[0].text) as Array<{
                completedAt?: string | null
                startedAt?: string
            }>
            if (entries.length > 0) {
                lastSyncAt = entries[0].completedAt ?? entries[0].startedAt ?? null
            }
        }
    } catch {
        // MCP not connected or no sync history — null is fine.
    }

    return { lastSyncAt, tokenCount, byType }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMCP(
    connected: boolean,
    responseText: string | null = null,
): MockMCPClient {
    return {
        connected,
        callTool: async () => ({
            content: responseText !== null ? [{ text: responseText }] : [],
        }),
    }
}

function makeThrowingMCP(): MockMCPClient {
    return {
        connected: true,
        callTool: async () => { throw new Error('MCP error') },
    }
}

function makeDB(rows: Array<{ token_type: string; count: number }>): MockDB {
    return {
        prepare: () => ({ all: () => rows }),
    }
}

// ---------------------------------------------------------------------------
// Tests: governance:preview-fix
// ---------------------------------------------------------------------------

describe('governance:preview-fix handler logic', () => {
    it('W3-01: returns null when ruleId is not a string', async () => {
        const result = await previewFixLogic(42, '/path/to/file.tsx', makeMCP(true))
        expect(result).toBeNull()
    })

    it('W3-02: returns null when filePath is not a string', async () => {
        const result = await previewFixLogic('color-drift', null, makeMCP(true))
        expect(result).toBeNull()
    })

    it('W3-03: returns null when MCP client is disconnected', async () => {
        const result = await previewFixLogic('color-drift', '/src/App.tsx', makeMCP(false))
        expect(result).toBeNull()
    })

    it('W3-04: returns null when MCP callTool throws', async () => {
        const result = await previewFixLogic('color-drift', '/src/App.tsx', makeThrowingMCP())
        expect(result).toBeNull()
    })

    it('W3-05: returns null when fixes array is empty', async () => {
        const mcp = makeMCP(true, JSON.stringify({ fixes: [] }))
        const result = await previewFixLogic('color-drift', '/src/App.tsx', mcp)
        expect(result).toBeNull()
    })

    it('W3-06: maps currentValue and proposedValue fields correctly', async () => {
        const payload = {
            fixes: [{
                currentValue: '#ff0000',
                proposedValue: 'var(--color-danger)',
                tokenName: 'color.danger',
                isColor: true,
            }],
        }
        const mcp = makeMCP(true, JSON.stringify(payload))
        const result = await previewFixLogic('color-drift', '/src/App.tsx', mcp)

        expect(result).not.toBeNull()
        expect(result!.current).toBe('#ff0000')
        expect(result!.proposed).toBe('var(--color-danger)')
        expect(result!.tokenName).toBe('color.danger')
        expect(result!.isColor).toBe(true)
    })

    it('W3-07: maps current/proposed fallback fields when currentValue/proposedValue absent', async () => {
        const payload = {
            fixes: [{
                current: 'old-class',
                proposed: 'new-class',
                token_name: 'spacing.sm',
            }],
        }
        const mcp = makeMCP(true, JSON.stringify(payload))
        const result = await previewFixLogic('spacing-drift', '/src/App.tsx', mcp)

        expect(result!.current).toBe('old-class')
        expect(result!.proposed).toBe('new-class')
        expect(result!.tokenName).toBe('spacing.sm')
    })

    it('W3-08: sets isColor=true when fix.type === "color"', async () => {
        const payload = {
            fixes: [{
                current: '#333',
                proposed: 'var(--color-text)',
                tokenName: 'color.text',
                type: 'color',
            }],
        }
        const mcp = makeMCP(true, JSON.stringify(payload))
        const result = await previewFixLogic('color-drift', '/src/App.tsx', mcp)
        expect(result!.isColor).toBe(true)
    })

    it('W3-09: sets isColor=true when fix.isColor is explicitly true', async () => {
        const payload = {
            fixes: [{
                current: '#333',
                proposed: 'var(--color-text)',
                tokenName: 'color.text',
                isColor: true,
            }],
        }
        const mcp = makeMCP(true, JSON.stringify(payload))
        const result = await previewFixLogic('color-drift', '/src/App.tsx', mcp)
        expect(result!.isColor).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Tests: governance:batch-fix-a11y
// ---------------------------------------------------------------------------

describe('governance:batch-fix-a11y handler logic', () => {
    it('W3-10: returns error when filePath is empty string', async () => {
        const result = await batchFixA11yLogic('', makeMCP(true))
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/filePath/)
        expect(result.fixedCount).toBe(0)
        expect(result.manualCount).toBe(0)
    })

    it('W3-11: returns error when filePath is not a string (number)', async () => {
        const result = await batchFixA11yLogic(42, makeMCP(true))
        expect(result.success).toBe(false)
        expect(result.fixedCount).toBe(0)
    })

    it('W3-12: returns error when MCP callTool throws', async () => {
        const result = await batchFixA11yLogic('/src/App.tsx', makeThrowingMCP())
        expect(result.success).toBe(false)
        expect(result.error).toBeTruthy()
        expect(result.fixedCount).toBe(0)
        expect(result.manualCount).toBe(0)
    })

    it('W3-13: returns correct fixedCount and manualCount on happy path', async () => {
        const payload = JSON.stringify({ fixesApplied: 3, manualCount: 2 })
        const mcp = makeMCP(true, payload)
        const result = await batchFixA11yLogic('/src/App.tsx', mcp)

        expect(result.success).toBe(true)
        expect(result.fixedCount).toBe(3)
        expect(result.manualCount).toBe(2)
        expect(result.error).toBeUndefined()
    })

    it('W3-14: returns 0/0 counts when MCP returns non-JSON text', async () => {
        const mcp = makeMCP(true, 'All fixes applied successfully.')
        const result = await batchFixA11yLogic('/src/App.tsx', mcp)

        expect(result.success).toBe(true)
        expect(result.fixedCount).toBe(0)
        expect(result.manualCount).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// Tests: tokens:get-sync-summary
// ---------------------------------------------------------------------------

describe('tokens:get-sync-summary handler logic', () => {
    it('W3-15: returns zero totals when design_tokens table is empty', async () => {
        const db = makeDB([])
        const mcp = makeMCP(false)
        const result = await getSyncSummaryLogic(db, mcp, '/project')

        expect(result.tokenCount).toBe(0)
        expect(result.byType).toEqual([])
        expect(result.lastSyncAt).toBeNull()
    })

    it('W3-16: aggregates byType counts and sums tokenCount correctly', async () => {
        const db = makeDB([
            { token_type: 'color', count: 12 },
            { token_type: 'spacing', count: 8 },
            { token_type: 'typography', count: 5 },
        ])
        const mcp = makeMCP(false)
        const result = await getSyncSummaryLogic(db, mcp, '/project')

        expect(result.tokenCount).toBe(25)
        expect(result.byType).toHaveLength(3)
        expect(result.byType.find(r => r.token_type === 'color')?.count).toBe(12)
        expect(result.byType.find(r => r.token_type === 'spacing')?.count).toBe(8)
    })

    it('W3-17: returns lastSyncAt=null when MCP client is disconnected', async () => {
        const db = makeDB([{ token_type: 'color', count: 5 }])
        const mcp = makeMCP(false)
        const result = await getSyncSummaryLogic(db, mcp, '/project')

        expect(result.lastSyncAt).toBeNull()
    })

    it('W3-18: returns lastSyncAt from completedAt field of most recent entry', async () => {
        const entries = [
            { completedAt: '2026-03-29T12:00:00.000Z', startedAt: '2026-03-29T11:59:00.000Z' },
            { completedAt: '2026-03-28T10:00:00.000Z', startedAt: '2026-03-28T09:59:00.000Z' },
        ]
        const mcp = makeMCP(true, JSON.stringify(entries))
        const db = makeDB([])
        const result = await getSyncSummaryLogic(db, mcp, '/project')

        expect(result.lastSyncAt).toBe('2026-03-29T12:00:00.000Z')
    })

    it('W3-19: returns lastSyncAt from startedAt when completedAt is null', async () => {
        const entries = [
            { completedAt: null, startedAt: '2026-03-29T11:59:00.000Z' },
        ]
        const mcp = makeMCP(true, JSON.stringify(entries))
        const db = makeDB([])
        const result = await getSyncSummaryLogic(db, mcp, '/project')

        expect(result.lastSyncAt).toBe('2026-03-29T11:59:00.000Z')
    })

    it('W3-20: returns lastSyncAt=null when MCP callTool throws', async () => {
        const db = makeDB([{ token_type: 'color', count: 3 }])
        const mcp = makeThrowingMCP()
        const result = await getSyncSummaryLogic(db, mcp, '/project')

        expect(result.lastSyncAt).toBeNull()
        // Token counts still work even though MCP failed
        expect(result.tokenCount).toBe(3)
    })
})

// ---------------------------------------------------------------------------
// COUNSEL.2.1 — governance:defer-violation IPC handler (it.todo scaffolds)
// Full assertions added in Group D after flint-electron-ipc completes Group A.
// ---------------------------------------------------------------------------

describe('governance:defer-violation IPC handler — COUNSEL.2.1', () => {
    it.todo('invokes with duration and persists expires_at')
    it.todo('with undefined duration sets expires_at to null')
    it.todo('backward compat: omitting duration does not error')
    it.todo('returns error shape on invalid violationId')
})
