/**
 * Mutation Provenance Ledger tests — V.2-mp
 *
 * Uses an in-memory SQLite database for hermetic, fast, disk-free tests.
 * Each describe block constructs a fresh service instance so there is no
 * shared state between test cases.
 *
 * Coverage:
 *   - CRUD: record + retrieve provenance
 *   - Query by source type (getProvenanceBySource)
 *   - Summary aggregation (getProvenanceSummary)
 *   - Audit trail for a file — chronological join with mutations_ledger
 *   - Unknown mutationId → null (getProvenance)
 *   - Concurrent writes via transaction (recordProvenanceBatch)
 *   - Edge cases: empty table, null optional fields, boundary confidence values
 *   - Pruning (pruneProvenance)
 *   - Duplicate insertion rejection (PRIMARY KEY constraint)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { MutationProvenanceService } from '../core/governance/mutationProvenanceService.js'
import { MutationLedgerService } from '../core/governance/mutationLedgerService.js'
import type { ProvenanceSource } from '../core/governance/types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database.Database {
    return new Database(':memory:')
}

function makeServices(db?: Database.Database): {
    provenance: MutationProvenanceService
    ledger: MutationLedgerService
    db: Database.Database
} {
    const database = db ?? makeDb()
    return {
        provenance: new MutationProvenanceService(database),
        ledger: new MutationLedgerService(database),
        db: database,
    }
}

/** Insert a ledger row and a corresponding provenance row. */
function seedPair(
    provenance: MutationProvenanceService,
    ledger: MutationLedgerService,
    opts: {
        mutationId: string
        filePath?: string
        source?: ProvenanceSource
        agentId?: string | null
        sessionId?: string | null
        reasoning?: string | null
        confidence?: number | null
        timestamp?: string
    },
): void {
    ledger.recordMutation({
        id: opts.mutationId,
        filePath: opts.filePath ?? '/src/components/Button.tsx',
        operationType: 'updateClassName',
        source: 'mcp_tool',
        metadata: {},
    })
    provenance.recordProvenance(
        opts.mutationId,
        opts.source ?? 'agent',
        opts.agentId ?? null,
        opts.sessionId ?? null,
        opts.reasoning ?? null,
        opts.confidence ?? null,
        opts.timestamp,
    )
}

// ---------------------------------------------------------------------------
// Schema initialisation
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — schema initialisation', () => {
    it('creates mutation_provenance table on construction', () => {
        const { db } = makeServices()
        const row = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mutation_provenance'")
            .get() as { name: string } | undefined
        expect(row?.name).toBe('mutation_provenance')
    })

    it('creates all four indexes', () => {
        const { db } = makeServices()
        const rows = db
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='mutation_provenance'")
            .all() as Array<{ name: string }>
        const names = rows.map((r) => r.name)
        expect(names).toContain('idx_provenance_source')
        expect(names).toContain('idx_provenance_session')
        expect(names).toContain('idx_provenance_agent')
        expect(names).toContain('idx_provenance_timestamp')
    })

    it('is idempotent — re-constructing with same db does not throw', () => {
        const { db } = makeServices()
        expect(() => new MutationProvenanceService(db)).not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// CRUD — record and retrieve provenance
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — recordProvenance + getProvenance', () => {
    it('retrieves a full record with all fields populated', () => {
        const { provenance } = makeServices()
        const mutationId = 'mut-001'
        provenance.recordProvenance(
            mutationId,
            'agent',
            'claude-code',
            'session-abc',
            'Fixing color drift on Button',
            0.97,
        )
        const result = provenance.getProvenance(mutationId)
        expect(result).not.toBeNull()
        expect(result!.mutationId).toBe(mutationId)
        expect(result!.provenanceSource).toBe('agent')
        expect(result!.provenanceAgentId).toBe('claude-code')
        expect(result!.provenanceSessionId).toBe('session-abc')
        expect(result!.provenanceReasoning).toBe('Fixing color drift on Button')
        expect(result!.provenanceConfidence).toBe(0.97)
        expect(result!.timestamp).toBeTruthy()
    })

    it('retrieves a minimal record — null optional fields are preserved', () => {
        const { provenance } = makeServices()
        const mutationId = 'mut-002'
        provenance.recordProvenance(mutationId, 'human')
        const result = provenance.getProvenance(mutationId)
        expect(result).not.toBeNull()
        expect(result!.provenanceSource).toBe('human')
        expect(result!.provenanceAgentId).toBeNull()
        expect(result!.provenanceSessionId).toBeNull()
        expect(result!.provenanceReasoning).toBeNull()
        expect(result!.provenanceConfidence).toBeNull()
    })

    it('returns null for an unknown mutationId', () => {
        const { provenance } = makeServices()
        const result = provenance.getProvenance('does-not-exist')
        expect(result).toBeNull()
    })

    it('uses caller-supplied timestamp when provided', () => {
        const { provenance } = makeServices()
        const ts = '2026-01-15T10:00:00.000Z'
        provenance.recordProvenance('mut-ts', 'auto-fix', null, null, null, null, ts)
        const result = provenance.getProvenance('mut-ts')
        expect(result!.timestamp).toBe(ts)
    })

    it('generates a timestamp automatically when not provided', () => {
        const { provenance } = makeServices()
        const before = new Date().toISOString()
        provenance.recordProvenance('mut-auto-ts', 'import')
        const after = new Date().toISOString()
        const result = provenance.getProvenance('mut-auto-ts')
        expect(result!.timestamp >= before).toBe(true)
        expect(result!.timestamp <= after).toBe(true)
    })

    it('rejects duplicate mutationId with a PRIMARY KEY violation', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('mut-dup', 'agent')
        expect(() => provenance.recordProvenance('mut-dup', 'human')).toThrow()
    })
})

// ---------------------------------------------------------------------------
// Boundary values — confidence
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — confidence boundary values', () => {
    it('accepts confidence = 0.0 (lower boundary)', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('mut-conf-0', 'agent', null, null, null, 0.0)
        const result = provenance.getProvenance('mut-conf-0')
        expect(result!.provenanceConfidence).toBe(0.0)
    })

    it('accepts confidence = 1.0 (upper boundary)', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('mut-conf-1', 'agent', null, null, null, 1.0)
        const result = provenance.getProvenance('mut-conf-1')
        expect(result!.provenanceConfidence).toBe(1.0)
    })

    it('rejects confidence > 1.0 (out of range)', () => {
        const { provenance } = makeServices()
        expect(() =>
            provenance.recordProvenance('mut-conf-bad', 'agent', null, null, null, 1.01),
        ).toThrow()
    })

    it('rejects confidence < 0 (out of range)', () => {
        const { provenance } = makeServices()
        expect(() =>
            provenance.recordProvenance('mut-conf-neg', 'agent', null, null, null, -0.01),
        ).toThrow()
    })
})

// ---------------------------------------------------------------------------
// All provenance source types
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — all ProvenanceSource values', () => {
    const ALL_SOURCES: ProvenanceSource[] = ['human', 'agent', 'auto-heal', 'auto-fix', 'import']

    it.each(ALL_SOURCES)('accepts source = %s', (source) => {
        const { provenance } = makeServices()
        const id = `mut-src-${source}`
        provenance.recordProvenance(id, source)
        const result = provenance.getProvenance(id)
        expect(result!.provenanceSource).toBe(source)
    })

    it('rejects an invalid source value', () => {
        const { provenance } = makeServices()
        expect(() =>
            // @ts-expect-error intentionally invalid
            provenance.recordProvenance('mut-bad-src', 'robot'),
        ).toThrow()
    })
})

// ---------------------------------------------------------------------------
// getProvenanceBySource
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — getProvenanceBySource', () => {
    it('returns only rows matching the requested source', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('mut-a1', 'agent', 'claude-code')
        provenance.recordProvenance('mut-a2', 'agent', 'cursor')
        provenance.recordProvenance('mut-h1', 'human')
        provenance.recordProvenance('mut-af1', 'auto-fix')

        const agents = provenance.getProvenanceBySource('agent')
        expect(agents).toHaveLength(2)
        expect(agents.every((r) => r.provenanceSource === 'agent')).toBe(true)

        const humans = provenance.getProvenanceBySource('human')
        expect(humans).toHaveLength(1)
        expect(humans[0]!.mutationId).toBe('mut-h1')
    })

    it('returns an empty array when no rows match the source', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('mut-only-agent', 'agent')
        const result = provenance.getProvenanceBySource('auto-heal')
        expect(result).toHaveLength(0)
    })

    it('returns an empty array from an empty table', () => {
        const { provenance } = makeServices()
        const result = provenance.getProvenanceBySource('agent')
        expect(result).toHaveLength(0)
    })

    it('respects the limit parameter', () => {
        const { provenance } = makeServices()
        for (let i = 0; i < 10; i++) {
            provenance.recordProvenance(`mut-lim-${i}`, 'agent')
        }
        const result = provenance.getProvenanceBySource('agent', 3)
        expect(result).toHaveLength(3)
    })

    it('returns newest-first (descending timestamp)', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('mut-old', 'agent', null, null, null, null, '2026-01-01T00:00:00.000Z')
        provenance.recordProvenance('mut-new', 'agent', null, null, null, null, '2026-02-01T00:00:00.000Z')
        const result = provenance.getProvenanceBySource('agent')
        expect(result[0]!.mutationId).toBe('mut-new')
        expect(result[1]!.mutationId).toBe('mut-old')
    })
})

// ---------------------------------------------------------------------------
// getProvenanceSummary
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — getProvenanceSummary', () => {
    it('returns zeroed summary when table is empty', () => {
        const { provenance } = makeServices()
        const summary = provenance.getProvenanceSummary()
        expect(summary.total).toBe(0)
        expect(summary.last24hCount).toBe(0)
        expect(summary.topAgents).toHaveLength(0)
        expect(summary.bySource.human).toBe(0)
        expect(summary.bySource.agent).toBe(0)
        expect(summary.bySource['auto-heal']).toBe(0)
        expect(summary.bySource['auto-fix']).toBe(0)
        expect(summary.bySource.import).toBe(0)
    })

    it('counts each source independently', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('mut-s1', 'human')
        provenance.recordProvenance('mut-s2', 'human')
        provenance.recordProvenance('mut-s3', 'agent', 'claude-code')
        provenance.recordProvenance('mut-s4', 'auto-fix')
        provenance.recordProvenance('mut-s5', 'auto-heal')
        provenance.recordProvenance('mut-s6', 'import')

        const summary = provenance.getProvenanceSummary()
        expect(summary.total).toBe(6)
        expect(summary.bySource.human).toBe(2)
        expect(summary.bySource.agent).toBe(1)
        expect(summary.bySource['auto-fix']).toBe(1)
        expect(summary.bySource['auto-heal']).toBe(1)
        expect(summary.bySource.import).toBe(1)
    })

    it('counts last-24h rows correctly (recent entries counted, old ones not)', () => {
        const { provenance } = makeServices()
        const old = '2020-01-01T00:00:00.000Z'
        provenance.recordProvenance('mut-old-1', 'agent', null, null, null, null, old)
        provenance.recordProvenance('mut-old-2', 'agent', null, null, null, null, old)
        // Recent (no timestamp — DB default fires as now())
        provenance.recordProvenance('mut-recent-1', 'human')
        provenance.recordProvenance('mut-recent-2', 'auto-fix')

        const summary = provenance.getProvenanceSummary()
        expect(summary.total).toBe(4)
        expect(summary.last24hCount).toBe(2)
    })

    it('returns top agents sorted by count descending', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('mut-ag-1', 'agent', 'agent-A')
        provenance.recordProvenance('mut-ag-2', 'agent', 'agent-A')
        provenance.recordProvenance('mut-ag-3', 'agent', 'agent-A')
        provenance.recordProvenance('mut-ag-4', 'agent', 'agent-B')
        provenance.recordProvenance('mut-ag-5', 'agent', 'agent-B')
        provenance.recordProvenance('mut-ag-6', 'human')  // null agent — not counted

        const summary = provenance.getProvenanceSummary()
        expect(summary.topAgents[0]!.agentId).toBe('agent-A')
        expect(summary.topAgents[0]!.count).toBe(3)
        expect(summary.topAgents[1]!.agentId).toBe('agent-B')
        expect(summary.topAgents[1]!.count).toBe(2)
    })

    it('limits topAgents to at most 5 entries', () => {
        const { provenance } = makeServices()
        for (let i = 0; i < 10; i++) {
            provenance.recordProvenance(`mut-topag-${i}`, 'agent', `agent-${i}`)
        }
        const summary = provenance.getProvenanceSummary()
        expect(summary.topAgents.length).toBeLessThanOrEqual(5)
    })
})

// ---------------------------------------------------------------------------
// getAuditTrail — joined query with mutations_ledger
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — getAuditTrail', () => {
    it('returns full audit trail in ascending timestamp order', () => {
        const { provenance, ledger } = makeServices()
        const file = '/src/components/Card.tsx'

        seedPair(provenance, ledger, {
            mutationId: 'mut-trail-1',
            filePath: file,
            source: 'agent',
            timestamp: '2026-01-01T08:00:00.000Z',
        })
        seedPair(provenance, ledger, {
            mutationId: 'mut-trail-2',
            filePath: file,
            source: 'auto-fix',
            timestamp: '2026-01-01T09:00:00.000Z',
        })
        seedPair(provenance, ledger, {
            mutationId: 'mut-trail-3',
            filePath: file,
            source: 'human',
            timestamp: '2026-01-01T10:00:00.000Z',
        })

        const trail = provenance.getAuditTrail(file)
        expect(trail).toHaveLength(3)
        expect(trail[0]!.mutationId).toBe('mut-trail-1')
        expect(trail[1]!.mutationId).toBe('mut-trail-2')
        expect(trail[2]!.mutationId).toBe('mut-trail-3')
    })

    it('scopes results to the requested file path', () => {
        const { provenance, ledger } = makeServices()

        seedPair(provenance, ledger, {
            mutationId: 'mut-file-a',
            filePath: '/src/components/Button.tsx',
            source: 'agent',
        })
        seedPair(provenance, ledger, {
            mutationId: 'mut-file-b',
            filePath: '/src/components/Card.tsx',
            source: 'human',
        })

        const trail = provenance.getAuditTrail('/src/components/Button.tsx')
        expect(trail).toHaveLength(1)
        expect(trail[0]!.mutationId).toBe('mut-file-a')
    })

    it('returns an empty array for an unknown file', () => {
        const { provenance } = makeServices()
        const trail = provenance.getAuditTrail('/no/such/file.tsx')
        expect(trail).toHaveLength(0)
    })

    it('respects the startDate lower bound (inclusive)', () => {
        const { provenance, ledger } = makeServices()
        const file = '/src/components/Badge.tsx'

        seedPair(provenance, ledger, {
            mutationId: 'mut-date-1',
            filePath: file,
            timestamp: '2026-01-01T00:00:00.000Z',
        })
        seedPair(provenance, ledger, {
            mutationId: 'mut-date-2',
            filePath: file,
            timestamp: '2026-02-01T00:00:00.000Z',
        })

        const trail = provenance.getAuditTrail(file, '2026-01-15T00:00:00.000Z')
        expect(trail).toHaveLength(1)
        expect(trail[0]!.mutationId).toBe('mut-date-2')
    })

    it('respects the endDate upper bound (inclusive)', () => {
        const { provenance, ledger } = makeServices()
        const file = '/src/components/Modal.tsx'

        seedPair(provenance, ledger, {
            mutationId: 'mut-end-1',
            filePath: file,
            timestamp: '2026-01-01T00:00:00.000Z',
        })
        seedPair(provenance, ledger, {
            mutationId: 'mut-end-2',
            filePath: file,
            timestamp: '2026-03-01T00:00:00.000Z',
        })

        const trail = provenance.getAuditTrail(file, undefined, '2026-02-01T00:00:00.000Z')
        expect(trail).toHaveLength(1)
        expect(trail[0]!.mutationId).toBe('mut-end-1')
    })

    it('populates ledger fields from the joined mutations_ledger row', () => {
        const { provenance, ledger } = makeServices()
        ledger.recordMutation({
            id: 'mut-joined',
            filePath: '/src/components/Tag.tsx',
            operationType: 'updateProp',
            source: 'mcp_tool',
            nodeId: 'node-42',
            metadata: {},
        })
        provenance.recordProvenance('mut-joined', 'agent', 'my-agent')

        const trail = provenance.getAuditTrail('/src/components/Tag.tsx')
        expect(trail).toHaveLength(1)
        expect(trail[0]!.filePath).toBe('/src/components/Tag.tsx')
        expect(trail[0]!.operationType).toBe('updateProp')
        expect(trail[0]!.nodeId).toBe('node-42')
        expect(trail[0]!.provenanceAgentId).toBe('my-agent')
    })
})

// ---------------------------------------------------------------------------
// recordProvenanceBatch — concurrent atomic writes
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — recordProvenanceBatch', () => {
    it('inserts all rows atomically', () => {
        const { provenance } = makeServices()
        provenance.recordProvenanceBatch([
            { mutationId: 'batch-1', source: 'agent', agentId: 'claude' },
            { mutationId: 'batch-2', source: 'human' },
            { mutationId: 'batch-3', source: 'auto-fix' },
        ])
        expect(provenance.getProvenance('batch-1')!.provenanceSource).toBe('agent')
        expect(provenance.getProvenance('batch-2')!.provenanceSource).toBe('human')
        expect(provenance.getProvenance('batch-3')!.provenanceSource).toBe('auto-fix')
    })

    it('rolls back the entire batch when one row has a duplicate key', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('existing', 'human')

        // The batch includes 'existing' which will fail on PRIMARY KEY constraint
        expect(() =>
            provenance.recordProvenanceBatch([
                { mutationId: 'new-row-1', source: 'agent' },
                { mutationId: 'existing', source: 'auto-fix' }, // duplicate — will throw
            ]),
        ).toThrow()

        // 'new-row-1' must NOT have been committed (transaction rolled back)
        expect(provenance.getProvenance('new-row-1')).toBeNull()
    })

    it('handles an empty batch without error', () => {
        const { provenance } = makeServices()
        expect(() => provenance.recordProvenanceBatch([])).not.toThrow()
        const summary = provenance.getProvenanceSummary()
        expect(summary.total).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// pruneProvenance
// ---------------------------------------------------------------------------

describe('MutationProvenanceService — pruneProvenance', () => {
    it('deletes rows older than the given date and returns the count', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('prune-1', 'human', null, null, null, null, '2020-01-01T00:00:00.000Z')
        provenance.recordProvenance('prune-2', 'agent', null, null, null, null, '2020-06-01T00:00:00.000Z')
        provenance.recordProvenance('prune-3', 'auto-fix') // recent — kept

        const deleted = provenance.pruneProvenance('2021-01-01T00:00:00.000Z')
        expect(deleted).toBe(2)
        expect(provenance.getProvenance('prune-1')).toBeNull()
        expect(provenance.getProvenance('prune-2')).toBeNull()
        expect(provenance.getProvenance('prune-3')).not.toBeNull()
    })

    it('returns 0 when nothing is pruned', () => {
        const { provenance } = makeServices()
        provenance.recordProvenance('prune-keep', 'human')
        const deleted = provenance.pruneProvenance('2020-01-01T00:00:00.000Z')
        expect(deleted).toBe(0)
    })

    it('returns 0 on an empty table', () => {
        const { provenance } = makeServices()
        const deleted = provenance.pruneProvenance('2099-01-01T00:00:00.000Z')
        expect(deleted).toBe(0)
    })
})
