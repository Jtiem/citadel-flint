/**
 * MutationLedgerService tests — INFRA.2
 *
 * Uses an in-memory SQLite database so tests are hermetic, fast, and leave
 * no artifacts on disk. Each test constructs a fresh service instance so
 * there is no shared state between test cases.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { MutationLedgerService } from '../mutationLedgerService.js'
import type { MutationLedgerEntry } from '../types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database.Database {
    return new Database(':memory:')
}

function makeService(db?: Database.Database): { service: MutationLedgerService; db: Database.Database } {
    const database = db ?? makeDb()
    return { service: new MutationLedgerService(database), db: database }
}

const BASE_ENTRY: Omit<MutationLedgerEntry, 'id' | 'timestamp'> = {
    filePath: '/src/components/Button.tsx',
    operationType: 'updateClassName',
    source: 'mcp_tool',
    metadata: {},
}

// ---------------------------------------------------------------------------
// Schema initialisation
// ---------------------------------------------------------------------------

describe('MutationLedgerService — initialisation', () => {
    it('creates mutations_ledger table on construction', () => {
        const { db } = makeService()
        const row = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mutations_ledger'")
            .get() as { name: string } | undefined
        expect(row?.name).toBe('mutations_ledger')
    })

    it('creates all five indexes', () => {
        const { db } = makeService()
        const rows = db
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='mutations_ledger'")
            .all() as Array<{ name: string }>
        const names = rows.map((r) => r.name)
        expect(names).toContain('idx_mutations_timestamp')
        expect(names).toContain('idx_mutations_file')
        expect(names).toContain('idx_mutations_node')
        expect(names).toContain('idx_mutations_source')
        expect(names).toContain('idx_mutations_session')
    })

    it('is idempotent — second construction does not throw', () => {
        const { db } = makeService()
        expect(() => new MutationLedgerService(db)).not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// Insert + query round-trip
// ---------------------------------------------------------------------------

describe('MutationLedgerService — insert + query round-trip', () => {
    it('stores and retrieves all scalar fields', () => {
        const { service } = makeService()

        service.recordMutation({
            ...BASE_ENTRY,
            id: 'test-id-001',
            timestamp: '2026-03-14T10:00:00.000Z',
            nodeId: 'bridge-btn-root',
            sourceIntentHash: 'sha256-abc',
            registryArtifactId: 'registry-001',
            beforeSnapshot: '<button class="old">',
            afterSnapshot: '<button class="new">',
            sessionId: 'session-001',
            approvedBy: 'user@example.com',
            justification: 'Token drift fix',
            metadata: { batchId: 'batch-xyz' },
        })

        const results = service.queryMutations()
        expect(results).toHaveLength(1)

        const entry = results[0]
        expect(entry.id).toBe('test-id-001')
        expect(entry.timestamp).toBe('2026-03-14T10:00:00.000Z')
        expect(entry.filePath).toBe('/src/components/Button.tsx')
        expect(entry.nodeId).toBe('bridge-btn-root')
        expect(entry.operationType).toBe('updateClassName')
        expect(entry.source).toBe('mcp_tool')
        expect(entry.sourceIntentHash).toBe('sha256-abc')
        expect(entry.registryArtifactId).toBe('registry-001')
        expect(entry.beforeSnapshot).toBe('<button class="old">')
        expect(entry.afterSnapshot).toBe('<button class="new">')
        expect(entry.sessionId).toBe('session-001')
        expect(entry.approvedBy).toBe('user@example.com')
        expect(entry.justification).toBe('Token drift fix')
        expect(entry.metadata).toEqual({ batchId: 'batch-xyz' })
    })

    it('auto-generates id and timestamp when omitted', () => {
        const { service } = makeService()

        service.recordMutation(BASE_ENTRY)

        const results = service.queryMutations()
        expect(results).toHaveLength(1)
        expect(results[0].id).toBeTruthy()
        expect(results[0].timestamp).toBeTruthy()
        // Timestamp should be a valid ISO 8601 string
        expect(new Date(results[0].timestamp).toISOString()).toBeTruthy()
    })

    it('defaults optional fields to undefined', () => {
        const { service } = makeService()

        service.recordMutation(BASE_ENTRY)

        const entry = service.queryMutations()[0]
        expect(entry.nodeId).toBeUndefined()
        expect(entry.sourceIntentHash).toBeUndefined()
        expect(entry.registryArtifactId).toBeUndefined()
        expect(entry.beforeSnapshot).toBeUndefined()
        expect(entry.afterSnapshot).toBeUndefined()
        expect(entry.sessionId).toBeUndefined()
        expect(entry.approvedBy).toBeUndefined()
        expect(entry.justification).toBeUndefined()
    })

    it('stores metadata as parsed JSON, not a string', () => {
        const { service } = makeService()

        service.recordMutation({ ...BASE_ENTRY, metadata: { key: 'value', n: 42 } })

        const entry = service.queryMutations()[0]
        expect(entry.metadata).toEqual({ key: 'value', n: 42 })
    })

    it('handles empty metadata object', () => {
        const { service } = makeService()

        service.recordMutation({ ...BASE_ENTRY, metadata: {} })

        const entry = service.queryMutations()[0]
        expect(entry.metadata).toEqual({})
    })
})

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe('MutationLedgerService — queryMutations filters', () => {
    let service: MutationLedgerService

    beforeEach(() => {
        service = makeService().service

        service.recordMutation({
            ...BASE_ENTRY,
            id: 'mut-1',
            timestamp: '2026-01-01T00:00:00.000Z',
            filePath: '/src/A.tsx',
            nodeId: 'node-a',
            operationType: 'updateProp',
            source: 'ai_orchestrator',
            sessionId: 'session-alpha',
        })
        service.recordMutation({
            ...BASE_ENTRY,
            id: 'mut-2',
            timestamp: '2026-02-01T00:00:00.000Z',
            filePath: '/src/B.tsx',
            nodeId: 'node-b',
            operationType: 'fixToken',
            source: 'auto_fix',
            sessionId: 'session-beta',
        })
        service.recordMutation({
            ...BASE_ENTRY,
            id: 'mut-3',
            timestamp: '2026-03-01T00:00:00.000Z',
            filePath: '/src/A.tsx',
            nodeId: 'node-a',
            operationType: 'move',
            source: 'user_action',
            sessionId: 'session-alpha',
        })
    })

    it('since filter returns rows on or after the timestamp', () => {
        const results = service.queryMutations({ since: '2026-02-01T00:00:00.000Z' })
        const ids = results.map((r) => r.id)
        expect(ids).toContain('mut-2')
        expect(ids).toContain('mut-3')
        expect(ids).not.toContain('mut-1')
    })

    it('until filter returns rows on or before the timestamp', () => {
        const results = service.queryMutations({ until: '2026-02-01T00:00:00.000Z' })
        const ids = results.map((r) => r.id)
        expect(ids).toContain('mut-1')
        expect(ids).toContain('mut-2')
        expect(ids).not.toContain('mut-3')
    })

    it('since + until together creates a closed range', () => {
        const results = service.queryMutations({
            since: '2026-01-15T00:00:00.000Z',
            until: '2026-02-15T00:00:00.000Z',
        })
        expect(results).toHaveLength(1)
        expect(results[0].id).toBe('mut-2')
    })

    it('filePath filter returns only rows for that file', () => {
        const results = service.queryMutations({ filePath: '/src/A.tsx' })
        expect(results).toHaveLength(2)
        expect(results.every((r) => r.filePath === '/src/A.tsx')).toBe(true)
    })

    it('nodeId filter returns only rows for that node', () => {
        const results = service.queryMutations({ nodeId: 'node-b' })
        expect(results).toHaveLength(1)
        expect(results[0].id).toBe('mut-2')
    })

    it('operationType filter returns only rows of that type', () => {
        const results = service.queryMutations({ operationType: 'fixToken' })
        expect(results).toHaveLength(1)
        expect(results[0].id).toBe('mut-2')
    })

    it('source filter returns only rows from that source', () => {
        const results = service.queryMutations({ source: 'ai_orchestrator' })
        expect(results).toHaveLength(1)
        expect(results[0].id).toBe('mut-1')
    })

    it('sessionId filter returns only rows from that session', () => {
        const results = service.queryMutations({ sessionId: 'session-alpha' })
        const ids = results.map((r) => r.id)
        expect(ids).toContain('mut-1')
        expect(ids).toContain('mut-3')
        expect(ids).not.toContain('mut-2')
    })

    it('limit restricts the number of rows returned', () => {
        const results = service.queryMutations({ limit: 2 })
        expect(results).toHaveLength(2)
    })

    it('offset skips the specified number of rows', () => {
        const all = service.queryMutations()
        const offsetResults = service.queryMutations({ offset: 1 })
        expect(offsetResults).toHaveLength(all.length - 1)
        expect(offsetResults[0].id).toBe(all[1].id)
    })

    it('returns empty array when no rows match filters', () => {
        const results = service.queryMutations({ filePath: '/src/DoesNotExist.tsx' })
        expect(results).toHaveLength(0)
    })

    it('returns all rows when no filters are supplied', () => {
        const results = service.queryMutations()
        expect(results).toHaveLength(3)
    })
})

// ---------------------------------------------------------------------------
// Session grouping
// ---------------------------------------------------------------------------

describe('MutationLedgerService — getMutationsBySession', () => {
    it('returns all mutations for a session ordered oldest-first', () => {
        const { service } = makeService()

        service.recordMutation({
            ...BASE_ENTRY,
            id: 'a',
            timestamp: '2026-03-14T12:00:00.000Z',
            sessionId: 'session-1',
        })
        service.recordMutation({
            ...BASE_ENTRY,
            id: 'b',
            timestamp: '2026-03-14T11:00:00.000Z',
            sessionId: 'session-1',
        })
        service.recordMutation({
            ...BASE_ENTRY,
            id: 'c',
            timestamp: '2026-03-14T10:00:00.000Z',
            sessionId: 'session-2',
        })

        const results = service.getMutationsBySession('session-1')
        expect(results).toHaveLength(2)
        // Oldest-first ordering
        expect(results[0].id).toBe('b')
        expect(results[1].id).toBe('a')
    })

    it('returns empty array for an unknown session', () => {
        const { service } = makeService()
        service.recordMutation(BASE_ENTRY)
        const results = service.getMutationsBySession('ghost-session')
        expect(results).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// getRecentMutations
// ---------------------------------------------------------------------------

describe('MutationLedgerService — getRecentMutations', () => {
    it('returns the most recent N mutations newest-first', () => {
        const { service } = makeService()

        for (let i = 1; i <= 5; i++) {
            service.recordMutation({
                ...BASE_ENTRY,
                id: `m${i}`,
                timestamp: `2026-03-${String(i).padStart(2, '0')}T00:00:00.000Z`,
            })
        }

        const results = service.getRecentMutations(3)
        expect(results).toHaveLength(3)
        expect(results[0].id).toBe('m5')
        expect(results[1].id).toBe('m4')
        expect(results[2].id).toBe('m3')
    })

    it('returns all rows when limit exceeds total count', () => {
        const { service } = makeService()
        service.recordMutation(BASE_ENTRY)
        const results = service.getRecentMutations(100)
        expect(results).toHaveLength(1)
    })

    it('returns empty array from empty table', () => {
        const { service } = makeService()
        const results = service.getRecentMutations(10)
        expect(results).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// Aggregation — getMutationCountsByType
// ---------------------------------------------------------------------------

describe('MutationLedgerService — getMutationCountsByType', () => {
    it('returns correct counts per operation type', () => {
        const { service } = makeService()

        const base = { ...BASE_ENTRY, timestamp: '2026-03-14T00:00:00.000Z' }
        service.recordMutation({ ...base, operationType: 'updateProp' })
        service.recordMutation({ ...base, operationType: 'updateProp' })
        service.recordMutation({ ...base, operationType: 'fixToken' })
        service.recordMutation({ ...base, operationType: 'move' })

        const counts = service.getMutationCountsByType('2026-01-01T00:00:00.000Z')
        expect(counts['updateProp']).toBe(2)
        expect(counts['fixToken']).toBe(1)
        expect(counts['move']).toBe(1)
        expect(counts['updateClassName']).toBeUndefined()
    })

    it('excludes rows before the since threshold', () => {
        const { service } = makeService()

        service.recordMutation({
            ...BASE_ENTRY,
            operationType: 'updateProp',
            timestamp: '2026-01-01T00:00:00.000Z',
        })
        service.recordMutation({
            ...BASE_ENTRY,
            operationType: 'fixToken',
            timestamp: '2026-03-14T00:00:00.000Z',
        })

        const counts = service.getMutationCountsByType('2026-02-01T00:00:00.000Z')
        expect(counts['fixToken']).toBe(1)
        expect(counts['updateProp']).toBeUndefined()
    })

    it('returns empty object when no rows are in range', () => {
        const { service } = makeService()
        service.recordMutation({
            ...BASE_ENTRY,
            timestamp: '2026-01-01T00:00:00.000Z',
        })
        const counts = service.getMutationCountsByType('2026-12-31T00:00:00.000Z')
        expect(Object.keys(counts)).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// Aggregation — getMutationCountsByFile
// ---------------------------------------------------------------------------

describe('MutationLedgerService — getMutationCountsByFile', () => {
    it('returns top files ordered by count descending', () => {
        const { service } = makeService()

        const base = { ...BASE_ENTRY, timestamp: '2026-03-14T00:00:00.000Z' }
        service.recordMutation({ ...base, filePath: '/src/A.tsx' })
        service.recordMutation({ ...base, filePath: '/src/A.tsx' })
        service.recordMutation({ ...base, filePath: '/src/A.tsx' })
        service.recordMutation({ ...base, filePath: '/src/B.tsx' })
        service.recordMutation({ ...base, filePath: '/src/B.tsx' })
        service.recordMutation({ ...base, filePath: '/src/C.tsx' })

        const results = service.getMutationCountsByFile('2026-01-01T00:00:00.000Z', 10)
        expect(results[0]).toEqual({ filePath: '/src/A.tsx', count: 3 })
        expect(results[1]).toEqual({ filePath: '/src/B.tsx', count: 2 })
        expect(results[2]).toEqual({ filePath: '/src/C.tsx', count: 1 })
    })

    it('respects the limit parameter', () => {
        const { service } = makeService()

        const base = { ...BASE_ENTRY, timestamp: '2026-03-14T00:00:00.000Z' }
        for (const f of ['/src/A.tsx', '/src/B.tsx', '/src/C.tsx']) {
            service.recordMutation({ ...base, filePath: f })
        }

        const results = service.getMutationCountsByFile('2026-01-01T00:00:00.000Z', 2)
        expect(results).toHaveLength(2)
    })

    it('excludes rows before the since threshold', () => {
        const { service } = makeService()

        service.recordMutation({
            ...BASE_ENTRY,
            filePath: '/src/Old.tsx',
            timestamp: '2025-12-31T00:00:00.000Z',
        })
        service.recordMutation({
            ...BASE_ENTRY,
            filePath: '/src/New.tsx',
            timestamp: '2026-03-14T00:00:00.000Z',
        })

        const results = service.getMutationCountsByFile('2026-01-01T00:00:00.000Z', 10)
        expect(results).toHaveLength(1)
        expect(results[0].filePath).toBe('/src/New.tsx')
    })

    it('returns empty array when no rows are in range', () => {
        const { service } = makeService()
        const results = service.getMutationCountsByFile('2099-01-01T00:00:00.000Z', 10)
        expect(results).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

describe('MutationLedgerService — pruneMutations', () => {
    it('deletes rows older than the threshold and returns the count', () => {
        const { service } = makeService()

        service.recordMutation({ ...BASE_ENTRY, id: 'old-1', timestamp: '2025-01-01T00:00:00.000Z' })
        service.recordMutation({ ...BASE_ENTRY, id: 'old-2', timestamp: '2025-06-01T00:00:00.000Z' })
        service.recordMutation({ ...BASE_ENTRY, id: 'new-1', timestamp: '2026-03-01T00:00:00.000Z' })

        const deleted = service.pruneMutations('2026-01-01T00:00:00.000Z')
        expect(deleted).toBe(2)

        const remaining = service.queryMutations()
        expect(remaining).toHaveLength(1)
        expect(remaining[0].id).toBe('new-1')
    })

    it('returns 0 when no rows are old enough to prune', () => {
        const { service } = makeService()

        service.recordMutation({ ...BASE_ENTRY, timestamp: '2026-03-14T00:00:00.000Z' })

        const deleted = service.pruneMutations('2020-01-01T00:00:00.000Z')
        expect(deleted).toBe(0)
    })

    it('returns 0 on empty table', () => {
        const { service } = makeService()
        const deleted = service.pruneMutations('2026-01-01T00:00:00.000Z')
        expect(deleted).toBe(0)
    })

    it('prunes all rows when threshold is in the future', () => {
        const { service } = makeService()

        service.recordMutation({ ...BASE_ENTRY, timestamp: '2026-03-14T00:00:00.000Z' })
        service.recordMutation({ ...BASE_ENTRY, timestamp: '2026-01-01T00:00:00.000Z' })

        const deleted = service.pruneMutations('2099-12-31T00:00:00.000Z')
        expect(deleted).toBe(2)
        expect(service.queryMutations()).toHaveLength(0)
    })
})
