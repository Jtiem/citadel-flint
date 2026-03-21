/**
 * OverrideTelemetryService — Unit Tests (GOV.2)
 *
 * Uses an in-memory SQLite database for hermetic, fast, disk-free tests.
 * Each describe block constructs a fresh service instance so there is no
 * shared state between test cases.
 *
 * Coverage:
 *   - Schema initialisation (table + indexes, idempotency)
 *   - CRUD: recordOverride + getOverridesBySession + getOverridesByRule
 *   - Summary aggregation (getOverrideSummary)
 *   - Edge cases: empty table, null optional fields, boundary dates
 *   - Concurrent writes (rapid sequential inserts)
 *   - Pruning (pruneOverrides)
 *   - Duplicate insertion rejection (PRIMARY KEY constraint)
 *   - Project scoping (summary scoped to project_root)
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { OverrideTelemetryService } from '../overrideTelemetryService.js'
import type { OverrideEvent } from '../types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database.Database {
    return new Database(':memory:')
}

function makeService(db?: Database.Database): {
    service: OverrideTelemetryService
    db: Database.Database
} {
    const database = db ?? makeDb()
    return {
        service: new OverrideTelemetryService(database),
        db: database,
    }
}

/** Build a complete OverrideEvent with defaults for optional fields. */
function makeEvent(overrides: Partial<OverrideEvent> & { id: string }): OverrideEvent {
    return {
        nodeId: null,
        ruleId: 'CLR-001',
        sessionId: null,
        agentId: null,
        timestamp: new Date().toISOString(),
        projectRoot: '/test/project',
        reason: null,
        ...overrides,
    }
}

// ---------------------------------------------------------------------------
// Schema initialisation
// ---------------------------------------------------------------------------

describe('OverrideTelemetryService — schema initialisation', () => {
    it('creates override_events table on construction', () => {
        const { db } = makeService()
        const row = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='override_events'")
            .get() as { name: string } | undefined
        expect(row?.name).toBe('override_events')
    })

    it('creates all three indexes', () => {
        const { db } = makeService()
        const rows = db
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='override_events'")
            .all() as Array<{ name: string }>
        const names = rows.map((r) => r.name)
        expect(names).toContain('idx_override_session')
        expect(names).toContain('idx_override_rule')
        expect(names).toContain('idx_override_timestamp')
    })

    it('is idempotent — re-constructing with same db does not throw', () => {
        const { db } = makeService()
        expect(() => new OverrideTelemetryService(db)).not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// CRUD — recordOverride + getOverridesBySession + getOverridesByRule
// ---------------------------------------------------------------------------

describe('OverrideTelemetryService — recordOverride', () => {
    it('records an event with all fields populated', () => {
        const { service } = makeService()
        const event = makeEvent({
            id: 'ovr-001',
            nodeId: 'node-42',
            ruleId: 'CLR-002',
            sessionId: 'session-abc',
            agentId: 'claude-code',
            projectRoot: '/test/project',
            reason: 'Design review approved drift',
        })
        service.recordOverride(event)

        const results = service.getOverridesBySession('session-abc')
        expect(results).toHaveLength(1)
        expect(results[0]!.id).toBe('ovr-001')
        expect(results[0]!.nodeId).toBe('node-42')
        expect(results[0]!.ruleId).toBe('CLR-002')
        expect(results[0]!.sessionId).toBe('session-abc')
        expect(results[0]!.agentId).toBe('claude-code')
        expect(results[0]!.reason).toBe('Design review approved drift')
    })

    it('records an event with null optional fields', () => {
        const { service } = makeService()
        const event = makeEvent({
            id: 'ovr-002',
            ruleId: 'A11Y-003',
            projectRoot: '/test/project',
        })
        service.recordOverride(event)

        const results = service.getOverridesByRule('A11Y-003')
        expect(results).toHaveLength(1)
        expect(results[0]!.nodeId).toBeNull()
        expect(results[0]!.sessionId).toBeNull()
        expect(results[0]!.agentId).toBeNull()
        expect(results[0]!.reason).toBeNull()
    })

    it('uses caller-supplied timestamp when provided', () => {
        const { service } = makeService()
        const ts = '2026-01-15T10:00:00.000Z'
        const event = makeEvent({ id: 'ovr-ts', timestamp: ts })
        service.recordOverride(event)

        const results = service.getOverridesByRule('CLR-001')
        expect(results[0]!.timestamp).toBe(ts)
    })

    it('rejects duplicate id with a PRIMARY KEY violation', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-dup' }))
        expect(() => service.recordOverride(makeEvent({ id: 'ovr-dup' }))).toThrow()
    })
})

// ---------------------------------------------------------------------------
// getOverridesBySession
// ---------------------------------------------------------------------------

describe('OverrideTelemetryService — getOverridesBySession', () => {
    it('returns only events matching the requested session', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-s1', sessionId: 'sess-A' }))
        service.recordOverride(makeEvent({ id: 'ovr-s2', sessionId: 'sess-A' }))
        service.recordOverride(makeEvent({ id: 'ovr-s3', sessionId: 'sess-B' }))

        const results = service.getOverridesBySession('sess-A')
        expect(results).toHaveLength(2)
        expect(results.every((r) => r.sessionId === 'sess-A')).toBe(true)
    })

    it('returns an empty array when no events match', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-other', sessionId: 'sess-X' }))
        const results = service.getOverridesBySession('sess-Y')
        expect(results).toHaveLength(0)
    })

    it('returns an empty array from an empty table', () => {
        const { service } = makeService()
        const results = service.getOverridesBySession('sess-Z')
        expect(results).toHaveLength(0)
    })

    it('respects the limit parameter', () => {
        const { service } = makeService()
        for (let i = 0; i < 10; i++) {
            service.recordOverride(makeEvent({ id: `ovr-lim-${i}`, sessionId: 'sess-big' }))
        }
        const results = service.getOverridesBySession('sess-big', 3)
        expect(results).toHaveLength(3)
    })

    it('returns newest-first (descending timestamp)', () => {
        const { service } = makeService()
        service.recordOverride(
            makeEvent({ id: 'ovr-old', sessionId: 'sess-order', timestamp: '2026-01-01T00:00:00.000Z' }),
        )
        service.recordOverride(
            makeEvent({ id: 'ovr-new', sessionId: 'sess-order', timestamp: '2026-02-01T00:00:00.000Z' }),
        )
        const results = service.getOverridesBySession('sess-order')
        expect(results[0]!.id).toBe('ovr-new')
        expect(results[1]!.id).toBe('ovr-old')
    })
})

// ---------------------------------------------------------------------------
// getOverridesByRule
// ---------------------------------------------------------------------------

describe('OverrideTelemetryService — getOverridesByRule', () => {
    it('returns only events matching the requested rule', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-r1', ruleId: 'CLR-001' }))
        service.recordOverride(makeEvent({ id: 'ovr-r2', ruleId: 'CLR-001' }))
        service.recordOverride(makeEvent({ id: 'ovr-r3', ruleId: 'A11Y-003' }))

        const results = service.getOverridesByRule('CLR-001')
        expect(results).toHaveLength(2)
        expect(results.every((r) => r.ruleId === 'CLR-001')).toBe(true)
    })

    it('returns an empty array when no events match', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-no-match', ruleId: 'CLR-001' }))
        const results = service.getOverridesByRule('CLR-999')
        expect(results).toHaveLength(0)
    })

    it('returns an empty array from an empty table', () => {
        const { service } = makeService()
        const results = service.getOverridesByRule('CLR-001')
        expect(results).toHaveLength(0)
    })

    it('respects the limit parameter', () => {
        const { service } = makeService()
        for (let i = 0; i < 10; i++) {
            service.recordOverride(makeEvent({ id: `ovr-rlim-${i}`, ruleId: 'CLR-002' }))
        }
        const results = service.getOverridesByRule('CLR-002', 5)
        expect(results).toHaveLength(5)
    })

    it('returns newest-first (descending timestamp)', () => {
        const { service } = makeService()
        service.recordOverride(
            makeEvent({ id: 'ovr-rold', ruleId: 'A11Y-001', timestamp: '2026-01-01T00:00:00.000Z' }),
        )
        service.recordOverride(
            makeEvent({ id: 'ovr-rnew', ruleId: 'A11Y-001', timestamp: '2026-02-01T00:00:00.000Z' }),
        )
        const results = service.getOverridesByRule('A11Y-001')
        expect(results[0]!.id).toBe('ovr-rnew')
        expect(results[1]!.id).toBe('ovr-rold')
    })
})

// ---------------------------------------------------------------------------
// getOverrideSummary
// ---------------------------------------------------------------------------

describe('OverrideTelemetryService — getOverrideSummary', () => {
    const PROJECT = '/test/project'

    it('returns zeroed summary when table is empty', () => {
        const { service } = makeService()
        const summary = service.getOverrideSummary(PROJECT)
        expect(summary.totalOverrides).toBe(0)
        expect(summary.byRule).toHaveLength(0)
        expect(summary.bySession).toHaveLength(0)
        expect(summary.last24hCount).toBe(0)
        expect(summary.lastOverrideAt).toBeNull()
    })

    it('counts total overrides for the given project', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-t1', projectRoot: PROJECT }))
        service.recordOverride(makeEvent({ id: 'ovr-t2', projectRoot: PROJECT }))
        service.recordOverride(makeEvent({ id: 'ovr-t3', projectRoot: '/other/project' }))

        const summary = service.getOverrideSummary(PROJECT)
        expect(summary.totalOverrides).toBe(2)
    })

    it('groups by rule with correct counts', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-br1', ruleId: 'CLR-001', projectRoot: PROJECT }))
        service.recordOverride(makeEvent({ id: 'ovr-br2', ruleId: 'CLR-001', projectRoot: PROJECT }))
        service.recordOverride(makeEvent({ id: 'ovr-br3', ruleId: 'CLR-001', projectRoot: PROJECT }))
        service.recordOverride(makeEvent({ id: 'ovr-br4', ruleId: 'A11Y-003', projectRoot: PROJECT }))

        const summary = service.getOverrideSummary(PROJECT)
        expect(summary.byRule).toHaveLength(2)
        expect(summary.byRule[0]!.ruleId).toBe('CLR-001')
        expect(summary.byRule[0]!.count).toBe(3)
        expect(summary.byRule[1]!.ruleId).toBe('A11Y-003')
        expect(summary.byRule[1]!.count).toBe(1)
    })

    it('groups by session with correct counts (excludes null sessions)', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-bs1', sessionId: 'sess-A', projectRoot: PROJECT }))
        service.recordOverride(makeEvent({ id: 'ovr-bs2', sessionId: 'sess-A', projectRoot: PROJECT }))
        service.recordOverride(makeEvent({ id: 'ovr-bs3', sessionId: 'sess-B', projectRoot: PROJECT }))
        service.recordOverride(makeEvent({ id: 'ovr-bs4', sessionId: null, projectRoot: PROJECT }))

        const summary = service.getOverrideSummary(PROJECT)
        expect(summary.bySession).toHaveLength(2)
        expect(summary.bySession[0]!.sessionId).toBe('sess-A')
        expect(summary.bySession[0]!.count).toBe(2)
        expect(summary.bySession[1]!.sessionId).toBe('sess-B')
        expect(summary.bySession[1]!.count).toBe(1)
    })

    it('counts last-24h overrides correctly', () => {
        const { service } = makeService()
        const old = '2020-01-01T00:00:00.000Z'
        service.recordOverride(makeEvent({ id: 'ovr-old1', timestamp: old, projectRoot: PROJECT }))
        service.recordOverride(makeEvent({ id: 'ovr-old2', timestamp: old, projectRoot: PROJECT }))
        // Recent (current timestamp)
        service.recordOverride(makeEvent({ id: 'ovr-rec1', projectRoot: PROJECT }))

        const summary = service.getOverrideSummary(PROJECT)
        expect(summary.totalOverrides).toBe(3)
        expect(summary.last24hCount).toBe(1)
    })

    it('returns the most recent override timestamp', () => {
        const { service } = makeService()
        service.recordOverride(
            makeEvent({ id: 'ovr-lat1', timestamp: '2026-01-01T00:00:00.000Z', projectRoot: PROJECT }),
        )
        service.recordOverride(
            makeEvent({ id: 'ovr-lat2', timestamp: '2026-03-15T12:00:00.000Z', projectRoot: PROJECT }),
        )

        const summary = service.getOverrideSummary(PROJECT)
        expect(summary.lastOverrideAt).toBe('2026-03-15T12:00:00.000Z')
    })

    it('limits byRule and bySession to 10 entries', () => {
        const { service } = makeService()
        for (let i = 0; i < 15; i++) {
            service.recordOverride(
                makeEvent({
                    id: `ovr-many-r-${i}`,
                    ruleId: `RULE-${i.toString().padStart(3, '0')}`,
                    sessionId: `sess-${i}`,
                    projectRoot: PROJECT,
                }),
            )
        }

        const summary = service.getOverrideSummary(PROJECT)
        expect(summary.byRule.length).toBeLessThanOrEqual(10)
        expect(summary.bySession.length).toBeLessThanOrEqual(10)
    })

    it('scopes summary to the requested project_root only', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-scope1', projectRoot: '/project-A' }))
        service.recordOverride(makeEvent({ id: 'ovr-scope2', projectRoot: '/project-A' }))
        service.recordOverride(makeEvent({ id: 'ovr-scope3', projectRoot: '/project-B' }))

        const summaryA = service.getOverrideSummary('/project-A')
        expect(summaryA.totalOverrides).toBe(2)

        const summaryB = service.getOverrideSummary('/project-B')
        expect(summaryB.totalOverrides).toBe(1)
    })
})

// ---------------------------------------------------------------------------
// pruneOverrides
// ---------------------------------------------------------------------------

describe('OverrideTelemetryService — pruneOverrides', () => {
    it('deletes events older than retention period and returns count', () => {
        const { service } = makeService()
        service.recordOverride(
            makeEvent({ id: 'ovr-prune1', timestamp: '2020-01-01T00:00:00.000Z' }),
        )
        service.recordOverride(
            makeEvent({ id: 'ovr-prune2', timestamp: '2020-06-01T00:00:00.000Z' }),
        )
        service.recordOverride(makeEvent({ id: 'ovr-prune3' })) // recent — kept

        // Prune anything older than 1 day (effectively prunes 2020 entries)
        const deleted = service.pruneOverrides(1)
        expect(deleted).toBe(2)

        // Verify the recent one is still there
        const summary = service.getOverrideSummary('/test/project')
        expect(summary.totalOverrides).toBe(1)
    })

    it('returns 0 when nothing is pruned', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-keep' }))
        // Prune with 9999-day retention — nothing should be deleted
        const deleted = service.pruneOverrides(9999)
        expect(deleted).toBe(0)
    })

    it('returns 0 on an empty table', () => {
        const { service } = makeService()
        const deleted = service.pruneOverrides(1)
        expect(deleted).toBe(0)
    })

    it('handles zero-day retention (deletes everything except now)', () => {
        const { service } = makeService()
        service.recordOverride(
            makeEvent({ id: 'ovr-zero1', timestamp: '2026-03-15T00:00:00.000Z' }),
        )
        service.recordOverride(
            makeEvent({ id: 'ovr-zero2', timestamp: '2026-03-14T00:00:00.000Z' }),
        )
        // With 0-day retention, cutoff is "now" — deletes everything before now
        const deleted = service.pruneOverrides(0)
        expect(deleted).toBe(2)
    })
})

// ---------------------------------------------------------------------------
// Concurrent writes (rapid sequential inserts)
// ---------------------------------------------------------------------------

describe('OverrideTelemetryService — concurrent writes', () => {
    it('handles 100 rapid sequential inserts without corruption', () => {
        const { service } = makeService()
        for (let i = 0; i < 100; i++) {
            service.recordOverride(
                makeEvent({
                    id: `ovr-concurrent-${i}`,
                    ruleId: `RULE-${i % 5}`,
                    sessionId: `sess-${i % 3}`,
                }),
            )
        }

        const summary = service.getOverrideSummary('/test/project')
        expect(summary.totalOverrides).toBe(100)
    })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('OverrideTelemetryService — edge cases', () => {
    it('handles empty string fields gracefully', () => {
        const { service } = makeService()
        service.recordOverride(
            makeEvent({
                id: 'ovr-empty',
                nodeId: '',
                ruleId: '',
                sessionId: '',
                agentId: '',
                reason: '',
                projectRoot: '',
            }),
        )
        const results = service.getOverridesByRule('')
        expect(results).toHaveLength(1)
        expect(results[0]!.nodeId).toBe('')
    })

    it('handles very long reason strings', () => {
        const { service } = makeService()
        const longReason = 'A'.repeat(10000)
        service.recordOverride(
            makeEvent({ id: 'ovr-long', reason: longReason }),
        )
        const results = service.getOverridesByRule('CLR-001')
        expect(results[0]!.reason).toBe(longReason)
    })

    it('records events with different project roots independently', () => {
        const { service } = makeService()
        service.recordOverride(makeEvent({ id: 'ovr-pa', projectRoot: '/a', ruleId: 'R1' }))
        service.recordOverride(makeEvent({ id: 'ovr-pb', projectRoot: '/b', ruleId: 'R2' }))

        const summaryA = service.getOverrideSummary('/a')
        expect(summaryA.totalOverrides).toBe(1)
        expect(summaryA.byRule[0]!.ruleId).toBe('R1')

        const summaryB = service.getOverrideSummary('/b')
        expect(summaryB.totalOverrides).toBe(1)
        expect(summaryB.byRule[0]!.ruleId).toBe('R2')
    })
})
