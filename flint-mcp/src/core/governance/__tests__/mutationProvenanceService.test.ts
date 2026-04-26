/**
 * mutationProvenanceService.test.ts — Core surface coverage
 *
 * Companion to mutationProvenanceService.chron1.test.ts which only covers
 * the CHRON.1 reason-on-override boundaries (TB-9..TB-12). This file fills
 * in the rest of the public API:
 *
 *   - recordProvenance: happy path, all source kinds, timestamp override
 *   - recordProvenanceBatch: atomic insert, empty input, single-row input
 *   - getProvenance: missing id returns null
 *   - getProvenanceBySource: filter by source, limit, ordering, empty case
 *   - getProvenanceSummary: total, bySource keying, last24h boundary,
 *     topAgents ordering and null-agent exclusion
 *   - getAuditTrail: date filtering (start/end/both), empty result
 *   - pruneProvenance: returns deleted count, leaves newer rows untouched
 *
 * Hermetic: in-memory SQLite, no disk artefacts.
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { MutationProvenanceService } from '../mutationProvenanceService.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database.Database {
    return new Database(':memory:')
}

function makeService(): { svc: MutationProvenanceService; db: Database.Database } {
    const db = makeDb()
    db.exec(`
        CREATE TABLE IF NOT EXISTS mutations_ledger (
            id                   TEXT PRIMARY KEY,
            timestamp            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            file_path            TEXT NOT NULL,
            node_id              TEXT,
            operation_type       TEXT NOT NULL,
            source               TEXT NOT NULL,
            source_intent_hash   TEXT,
            registry_artifact_id TEXT,
            before_snapshot      TEXT,
            after_snapshot       TEXT,
            session_id           TEXT,
            approved_by          TEXT,
            justification        TEXT,
            metadata             TEXT DEFAULT '{}'
        );
    `)
    return { svc: new MutationProvenanceService(db), db }
}

function insertLedgerRow(db: Database.Database, id: string, filePath: string, timestamp?: string): void {
    if (timestamp) {
        db.prepare(`
            INSERT INTO mutations_ledger (id, timestamp, file_path, operation_type, source, metadata)
            VALUES (?, ?, ?, 'updateClassName', 'mcp_tool', '{}')
        `).run(id, timestamp, filePath)
    } else {
        db.prepare(`
            INSERT INTO mutations_ledger (id, file_path, operation_type, source, metadata)
            VALUES (?, ?, 'updateClassName', 'mcp_tool', '{}')
        `).run(id, filePath)
    }
}

// ---------------------------------------------------------------------------
// recordProvenance — basic round-trip
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — recordProvenance + getProvenance', () => {
    it('round-trips a minimally-populated record', () => {
        const { svc } = makeService()
        svc.recordProvenance('m-001', 'human')

        const result = svc.getProvenance('m-001')
        expect(result).not.toBeNull()
        expect(result!.mutationId).toBe('m-001')
        expect(result!.provenanceSource).toBe('human')
        expect(result!.provenanceAgentId).toBeNull()
        expect(result!.provenanceSessionId).toBeNull()
        expect(result!.provenanceConfidence).toBeNull()
        expect(result!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('round-trips a fully-populated record', () => {
        const { svc } = makeService()
        svc.recordProvenance(
            'm-002',
            'agent',
            'claude-orchestrator',
            'session-xyz',
            'reasoning text',
            0.87,
            '2026-04-20T10:00:00.000Z',
        )

        const result = svc.getProvenance('m-002')
        expect(result!.provenanceSource).toBe('agent')
        expect(result!.provenanceAgentId).toBe('claude-orchestrator')
        expect(result!.provenanceSessionId).toBe('session-xyz')
        expect(result!.provenanceReasoning).toBe('reasoning text')
        expect(result!.provenanceConfidence).toBe(0.87)
        expect(result!.timestamp).toBe('2026-04-20T10:00:00.000Z')
    })

    it('returns null for unknown mutationId', () => {
        const { svc } = makeService()
        expect(svc.getProvenance('nonexistent')).toBeNull()
    })

    it('accepts every valid ProvenanceSource value', () => {
        const { svc } = makeService()
        const sources = ['human', 'agent', 'auto-heal', 'auto-fix', 'import'] as const
        for (const src of sources) {
            svc.recordProvenance(`m-${src}`, src)
        }
        for (const src of sources) {
            const r = svc.getProvenance(`m-${src}`)
            expect(r).not.toBeNull()
            expect(r!.provenanceSource).toBe(src)
        }
    })

    it('rejects invalid ProvenanceSource via CHECK constraint', () => {
        const { svc } = makeService()
        // 'invalid' is not in the CHECK list — better-sqlite3 throws synchronously
        expect(() =>
            svc.recordProvenance('m-bad', 'invalid' as 'human'),
        ).toThrow()
    })

    it('rejects confidence outside [0, 1] via CHECK constraint', () => {
        const { svc } = makeService()
        expect(() =>
            svc.recordProvenance('m-bad-conf', 'agent', null, null, null, 1.5),
        ).toThrow()
        expect(() =>
            svc.recordProvenance('m-bad-conf-neg', 'agent', null, null, null, -0.1),
        ).toThrow()
    })
})

// ---------------------------------------------------------------------------
// recordProvenanceBatch
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — recordProvenanceBatch', () => {
    it('inserts multiple rows in a single call', () => {
        const { svc } = makeService()
        svc.recordProvenanceBatch([
            { mutationId: 'b-1', source: 'human' },
            { mutationId: 'b-2', source: 'agent', agentId: 'a' },
            { mutationId: 'b-3', source: 'auto-fix' },
        ])

        expect(svc.getProvenance('b-1')).not.toBeNull()
        expect(svc.getProvenance('b-2')!.provenanceAgentId).toBe('a')
        expect(svc.getProvenance('b-3')!.provenanceSource).toBe('auto-fix')
    })

    it('handles an empty batch as a no-op', () => {
        const { svc } = makeService()
        expect(() => svc.recordProvenanceBatch([])).not.toThrow()
        expect(svc.getProvenanceSummary().total).toBe(0)
    })

    it('rolls back the entire batch when one row fails (atomicity)', () => {
        const { svc } = makeService()
        svc.recordProvenance('exists', 'human')

        // Second row collides on PRIMARY KEY — whole batch should fail.
        expect(() =>
            svc.recordProvenanceBatch([
                { mutationId: 'new-row', source: 'human' },
                { mutationId: 'exists', source: 'human' },
            ]),
        ).toThrow()

        // 'new-row' must NOT have been persisted (transaction rollback).
        expect(svc.getProvenance('new-row')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// getProvenanceBySource
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — getProvenanceBySource', () => {
    it('returns only records matching the requested source', () => {
        const { svc } = makeService()
        svc.recordProvenance('h-1', 'human')
        svc.recordProvenance('h-2', 'human')
        svc.recordProvenance('a-1', 'agent')

        const humans = svc.getProvenanceBySource('human')
        expect(humans).toHaveLength(2)
        expect(humans.every((r) => r.provenanceSource === 'human')).toBe(true)
    })

    it('returns newest-first ordering', () => {
        const { svc } = makeService()
        svc.recordProvenance('old', 'agent', null, null, null, null, '2026-01-01T00:00:00.000Z')
        svc.recordProvenance('mid', 'agent', null, null, null, null, '2026-02-01T00:00:00.000Z')
        svc.recordProvenance('new', 'agent', null, null, null, null, '2026-03-01T00:00:00.000Z')

        const rows = svc.getProvenanceBySource('agent')
        expect(rows.map((r) => r.mutationId)).toEqual(['new', 'mid', 'old'])
    })

    it('respects the limit parameter', () => {
        const { svc } = makeService()
        for (let i = 0; i < 5; i++) {
            svc.recordProvenance(`m-${i}`, 'human')
        }
        expect(svc.getProvenanceBySource('human', 2)).toHaveLength(2)
    })

    it('returns empty array when no rows match', () => {
        const { svc } = makeService()
        svc.recordProvenance('h-1', 'human')
        expect(svc.getProvenanceBySource('agent')).toEqual([])
    })

    it('uses default limit of 100 when not specified', () => {
        const { svc } = makeService()
        for (let i = 0; i < 150; i++) {
            svc.recordProvenance(`m-${i}`, 'human')
        }
        expect(svc.getProvenanceBySource('human')).toHaveLength(100)
    })
})

// ---------------------------------------------------------------------------
// getProvenanceSummary
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — getProvenanceSummary', () => {
    it('returns zero/empty for an empty table', () => {
        const { svc } = makeService()
        const summary = svc.getProvenanceSummary()

        expect(summary.total).toBe(0)
        expect(summary.bySource).toEqual({
            human: 0,
            agent: 0,
            'auto-heal': 0,
            'auto-fix': 0,
            import: 0,
        })
        expect(summary.last24hCount).toBe(0)
        expect(summary.topAgents).toEqual([])
    })

    it('aggregates total and bySource counts correctly', () => {
        const { svc } = makeService()
        svc.recordProvenance('h-1', 'human')
        svc.recordProvenance('h-2', 'human')
        svc.recordProvenance('a-1', 'agent')
        svc.recordProvenance('f-1', 'auto-fix')

        const summary = svc.getProvenanceSummary()
        expect(summary.total).toBe(4)
        expect(summary.bySource.human).toBe(2)
        expect(summary.bySource.agent).toBe(1)
        expect(summary.bySource['auto-fix']).toBe(1)
        expect(summary.bySource['auto-heal']).toBe(0)
        expect(summary.bySource.import).toBe(0)
    })

    it('last24hCount excludes records older than 24 hours', () => {
        const { svc } = makeService()
        const oldTs = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
        const recentTs = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()

        svc.recordProvenance('old', 'human', null, null, null, null, oldTs)
        svc.recordProvenance('recent-1', 'agent', null, null, null, null, recentTs)
        svc.recordProvenance('recent-2', 'human', null, null, null, null, recentTs)

        const summary = svc.getProvenanceSummary()
        expect(summary.last24hCount).toBe(2)
    })

    it('topAgents lists agents in descending mutation-count order', () => {
        const { svc } = makeService()
        // agent-a: 3, agent-b: 5, agent-c: 1
        for (let i = 0; i < 3; i++) svc.recordProvenance(`a-${i}`, 'agent', 'agent-a')
        for (let i = 0; i < 5; i++) svc.recordProvenance(`b-${i}`, 'agent', 'agent-b')
        svc.recordProvenance('c-0', 'agent', 'agent-c')

        const summary = svc.getProvenanceSummary()
        expect(summary.topAgents.map((t) => t.agentId)).toEqual([
            'agent-b',
            'agent-a',
            'agent-c',
        ])
        expect(summary.topAgents[0].count).toBe(5)
    })

    it('topAgents excludes null agent IDs', () => {
        const { svc } = makeService()
        svc.recordProvenance('h-1', 'human') // no agent_id
        svc.recordProvenance('a-1', 'agent', 'a')

        const summary = svc.getProvenanceSummary()
        expect(summary.topAgents).toHaveLength(1)
        expect(summary.topAgents[0].agentId).toBe('a')
    })

    it('topAgents caps at 5 entries', () => {
        const { svc } = makeService()
        for (let i = 0; i < 8; i++) {
            svc.recordProvenance(`m-${i}`, 'agent', `agent-${i}`)
        }
        expect(svc.getProvenanceSummary().topAgents).toHaveLength(5)
    })
})

// ---------------------------------------------------------------------------
// getAuditTrail — date filtering
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — getAuditTrail date filtering', () => {
    it('returns empty array when no ledger rows exist for the file', () => {
        const { svc } = makeService()
        expect(svc.getAuditTrail('/no/such/file.tsx')).toEqual([])
    })

    it('respects startDate (inclusive lower bound)', () => {
        const { svc, db } = makeService()
        const file = '/src/A.tsx'
        const t1 = '2026-01-01T00:00:00.000Z'
        const t2 = '2026-02-01T00:00:00.000Z'
        const t3 = '2026-03-01T00:00:00.000Z'

        insertLedgerRow(db, 'm1', file, t1)
        insertLedgerRow(db, 'm2', file, t2)
        insertLedgerRow(db, 'm3', file, t3)
        svc.recordProvenance('m1', 'agent', null, null, null, null, t1)
        svc.recordProvenance('m2', 'agent', null, null, null, null, t2)
        svc.recordProvenance('m3', 'agent', null, null, null, null, t3)

        const trail = svc.getAuditTrail(file, '2026-02-01T00:00:00.000Z')
        expect(trail.map((e) => e.mutationId).sort()).toEqual(['m2', 'm3'])
    })

    it('respects endDate (inclusive upper bound)', () => {
        const { svc, db } = makeService()
        const file = '/src/B.tsx'
        const t1 = '2026-01-01T00:00:00.000Z'
        const t2 = '2026-02-01T00:00:00.000Z'
        const t3 = '2026-03-01T00:00:00.000Z'

        insertLedgerRow(db, 'm1', file, t1)
        insertLedgerRow(db, 'm2', file, t2)
        insertLedgerRow(db, 'm3', file, t3)
        svc.recordProvenance('m1', 'agent', null, null, null, null, t1)
        svc.recordProvenance('m2', 'agent', null, null, null, null, t2)
        svc.recordProvenance('m3', 'agent', null, null, null, null, t3)

        const trail = svc.getAuditTrail(file, undefined, '2026-02-01T00:00:00.000Z')
        expect(trail.map((e) => e.mutationId).sort()).toEqual(['m1', 'm2'])
    })

    it('respects both startDate and endDate together', () => {
        const { svc, db } = makeService()
        const file = '/src/C.tsx'
        const t1 = '2026-01-01T00:00:00.000Z'
        const t2 = '2026-02-15T00:00:00.000Z'
        const t3 = '2026-03-01T00:00:00.000Z'

        insertLedgerRow(db, 'm1', file, t1)
        insertLedgerRow(db, 'm2', file, t2)
        insertLedgerRow(db, 'm3', file, t3)
        svc.recordProvenance('m1', 'agent', null, null, null, null, t1)
        svc.recordProvenance('m2', 'agent', null, null, null, null, t2)
        svc.recordProvenance('m3', 'agent', null, null, null, null, t3)

        const trail = svc.getAuditTrail(
            file,
            '2026-02-01T00:00:00.000Z',
            '2026-02-28T00:00:00.000Z',
        )
        expect(trail).toHaveLength(1)
        expect(trail[0].mutationId).toBe('m2')
    })
})

// ---------------------------------------------------------------------------
// pruneProvenance
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — pruneProvenance', () => {
    it('returns 0 and changes nothing when no rows are older than cutoff', () => {
        const { svc } = makeService()
        svc.recordProvenance('m-1', 'human', null, null, null, null, '2026-04-20T00:00:00.000Z')

        const removed = svc.pruneProvenance('2020-01-01T00:00:00.000Z')
        expect(removed).toBe(0)
        expect(svc.getProvenance('m-1')).not.toBeNull()
    })

    it('deletes rows strictly older than cutoff and returns the count', () => {
        const { svc } = makeService()
        svc.recordProvenance('old-1', 'human', null, null, null, null, '2025-01-01T00:00:00.000Z')
        svc.recordProvenance('old-2', 'human', null, null, null, null, '2025-06-01T00:00:00.000Z')
        svc.recordProvenance('keep', 'human', null, null, null, null, '2026-04-20T00:00:00.000Z')

        const removed = svc.pruneProvenance('2026-01-01T00:00:00.000Z')
        expect(removed).toBe(2)
        expect(svc.getProvenance('old-1')).toBeNull()
        expect(svc.getProvenance('old-2')).toBeNull()
        expect(svc.getProvenance('keep')).not.toBeNull()
    })

    it('uses strict less-than: rows exactly at cutoff are NOT pruned', () => {
        const { svc } = makeService()
        const cutoff = '2026-04-01T00:00:00.000Z'
        svc.recordProvenance('boundary', 'human', null, null, null, null, cutoff)

        const removed = svc.pruneProvenance(cutoff)
        expect(removed).toBe(0)
        expect(svc.getProvenance('boundary')).not.toBeNull()
    })
})
