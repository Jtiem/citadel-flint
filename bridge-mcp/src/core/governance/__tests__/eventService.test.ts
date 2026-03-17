/**
 * GovernanceEventService — Unit Tests
 *
 * Scope: pure SQLite logic. No Electron, no IPC, no MCP server.
 *
 * All tests use an in-memory SQLite database so they are:
 *   - Hermetic  (no shared state between suites)
 *   - Fast      (no disk I/O)
 *   - Portable  (no path assumptions)
 *
 * What we verify:
 *   1. Schema creation   — table + indexes created on construction
 *   2. recordEvent       — inserts and round-trips correctly
 *   3. queryEvents       — each filter works independently
 *   4. getEventCounts    — groups by event_type since a timestamp
 *   5. getTopViolatedRules  — aggregates and sorts correctly
 *   6. getTopViolatedFiles  — aggregates and sorts correctly
 *   7. pruneEvents       — deletes old rows, returns count
 *   8. concurrent inserts — synchronous SQLite is not corrupted by rapid calls
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { GovernanceEventService } from '../eventService.js'
import type { GovernanceEvent } from '../types.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_EVENT: Omit<GovernanceEvent, 'id' | 'timestamp'> = {
    eventType: 'violation',
    ruleId: 'CLR-001',
    severity: 'critical',
    filePath: '/src/components/Button.tsx',
    actor: 'mithril-linter',
    metadata: {},
}

/**
 * Build a complete event with explicit id + timestamp for deterministic tests.
 * Only the supplied fields override the BASE_EVENT defaults.
 */
function makeEvent(
    overrides: Partial<GovernanceEvent> & { id?: string; timestamp?: string } = {},
): Omit<GovernanceEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string } {
    return { ...BASE_EVENT, ...overrides }
}

// ── Test helpers ──────────────────────────────────────────────────────────────

/** ISO 8601 UTC timestamp offset from now by the given number of seconds. */
function isoOffset(seconds: number): string {
    return new Date(Date.now() + seconds * 1000).toISOString()
}

// ── Suite factory — each suite gets a fresh in-memory DB ──────────────────────

function createService(): { service: GovernanceEventService; db: Database.Database } {
    const db = new Database(':memory:')
    const service = new GovernanceEventService(db)
    return { service, db }
}

// ── 1. Schema creation ────────────────────────────────────────────────────────

describe('GovernanceEventService — schema', () => {
    it('creates the governance_events table on construction', () => {
        const { db } = createService()
        const row = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='governance_events'")
            .get() as { name: string } | undefined
        expect(row?.name).toBe('governance_events')
    })

    it('creates the four required indexes', () => {
        const { db } = createService()
        const rows = db
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='governance_events'")
            .all() as Array<{ name: string }>
        const names = rows.map((r) => r.name)
        expect(names).toContain('idx_gov_events_timestamp')
        expect(names).toContain('idx_gov_events_rule')
        expect(names).toContain('idx_gov_events_file')
        expect(names).toContain('idx_gov_events_type')
    })

    it('is idempotent — constructing a second service on the same DB does not throw', () => {
        const { db } = createService()
        expect(() => new GovernanceEventService(db)).not.toThrow()
    })
})

// ── 2. recordEvent + round-trip ───────────────────────────────────────────────

describe('GovernanceEventService — recordEvent', () => {
    let service: GovernanceEventService

    beforeEach(() => {
        ;({ service } = createService())
    })

    it('inserts a row and the round-trip matches the input', () => {
        service.recordEvent(makeEvent({
            id: 'aaa',
            timestamp: '2026-03-14T12:00:00.000Z',
            eventType: 'violation',
            ruleId: 'CLR-001',
            severity: 'critical',
            filePath: '/src/components/Button.tsx',
            actor: 'mithril-linter',
            metadata: { deltaE: 3.2 },
        }))

        const [event] = service.queryEvents({})
        expect(event.id).toBe('aaa')
        expect(event.timestamp).toBe('2026-03-14T12:00:00.000Z')
        expect(event.eventType).toBe('violation')
        expect(event.ruleId).toBe('CLR-001')
        expect(event.severity).toBe('critical')
        expect(event.filePath).toBe('/src/components/Button.tsx')
        expect(event.actor).toBe('mithril-linter')
        expect(event.metadata).toEqual({ deltaE: 3.2 })
    })

    it('stores optional fields correctly', () => {
        service.recordEvent(makeEvent({
            id: 'bbb',
            timestamp: '2026-03-14T12:01:00.000Z',
            nodeId: 'bridge-btn-root',
            message: 'Color drift detected',
            sessionId: 'sess-xyz',
        }))

        const [event] = service.queryEvents({})
        expect(event.nodeId).toBe('bridge-btn-root')
        expect(event.message).toBe('Color drift detected')
        expect(event.sessionId).toBe('sess-xyz')
    })

    it('stores undefined optional fields as undefined (not null) on retrieval', () => {
        service.recordEvent(makeEvent({ id: 'ccc', timestamp: '2026-03-14T12:02:00.000Z' }))

        const [event] = service.queryEvents({})
        expect(event.nodeId).toBeUndefined()
        expect(event.message).toBeUndefined()
        expect(event.sessionId).toBeUndefined()
    })

    it('auto-generates id when not supplied', () => {
        service.recordEvent(makeEvent())
        const results = service.queryEvents({})
        expect(results).toHaveLength(1)
        expect(results[0]!.id).toBeTruthy()
        expect(results[0]!.id.length).toBeGreaterThan(0)
    })

    it('auto-generates timestamp when not supplied', () => {
        const before = new Date().toISOString()
        service.recordEvent(makeEvent())
        const after = new Date().toISOString()

        const [event] = service.queryEvents({})
        expect(event.timestamp >= before).toBe(true)
        expect(event.timestamp <= after).toBe(true)
    })

    it('serialises metadata object correctly', () => {
        service.recordEvent(makeEvent({
            id: 'ddd',
            timestamp: '2026-03-14T12:03:00.000Z',
            metadata: { rule: 'CLR-001', file: 'Button.tsx', extra: { nested: true } },
        }))

        const [event] = service.queryEvents({})
        expect(event.metadata).toEqual({ rule: 'CLR-001', file: 'Button.tsx', extra: { nested: true } })
    })

    it('rejects an unknown event_type via CHECK constraint', () => {
        expect(() =>
            service.recordEvent(makeEvent({ eventType: 'unknown' as GovernanceEvent['eventType'] }))
        ).toThrow()
    })

    it('rejects an unknown severity via CHECK constraint', () => {
        expect(() =>
            service.recordEvent(makeEvent({ severity: 'low' as GovernanceEvent['severity'] }))
        ).toThrow()
    })
})

// ── 3. queryEvents filters ────────────────────────────────────────────────────

describe('GovernanceEventService — queryEvents filters', () => {
    let service: GovernanceEventService

    beforeEach(() => {
        ;({ service } = createService())

        // Insert five events with varied attributes for filter testing.
        service.recordEvent(makeEvent({ id: 'e1', timestamp: '2026-01-01T00:00:00.000Z', ruleId: 'CLR-001', eventType: 'violation',   severity: 'critical', filePath: '/a.tsx', actor: 'linter',  sessionId: 's1' }))
        service.recordEvent(makeEvent({ id: 'e2', timestamp: '2026-02-01T00:00:00.000Z', ruleId: 'A11Y-002', eventType: 'override',    severity: 'warning',  filePath: '/b.tsx', actor: 'user',    sessionId: 's1' }))
        service.recordEvent(makeEvent({ id: 'e3', timestamp: '2026-03-01T00:00:00.000Z', ruleId: 'CLR-001', eventType: 'violation',   severity: 'info',     filePath: '/a.tsx', actor: 'linter',  sessionId: 's2' }))
        service.recordEvent(makeEvent({ id: 'e4', timestamp: '2026-04-01T00:00:00.000Z', ruleId: 'EXP-001', eventType: 'export_block',severity: 'critical', filePath: '/c.tsx', actor: 'system',  sessionId: 's2' }))
        service.recordEvent(makeEvent({ id: 'e5', timestamp: '2026-05-01T00:00:00.000Z', ruleId: 'A11Y-002', eventType: 'auto_fix',   severity: 'warning',  filePath: '/b.tsx', actor: 'bridge',  sessionId: 's3' }))
    })

    it('returns all events when no filters are applied', () => {
        const results = service.queryEvents({})
        expect(results).toHaveLength(5)
    })

    it('filters by since (inclusive)', () => {
        const results = service.queryEvents({ since: '2026-03-01T00:00:00.000Z' })
        const ids = results.map((e) => e.id)
        expect(ids).toContain('e3')
        expect(ids).toContain('e4')
        expect(ids).toContain('e5')
        expect(ids).not.toContain('e1')
        expect(ids).not.toContain('e2')
    })

    it('filters by until (inclusive)', () => {
        const results = service.queryEvents({ until: '2026-02-01T00:00:00.000Z' })
        const ids = results.map((e) => e.id)
        expect(ids).toContain('e1')
        expect(ids).toContain('e2')
        expect(ids).not.toContain('e3')
    })

    it('filters by since and until together', () => {
        const results = service.queryEvents({
            since: '2026-02-01T00:00:00.000Z',
            until: '2026-03-01T00:00:00.000Z',
        })
        expect(results.map((e) => e.id).sort()).toEqual(['e2', 'e3'])
    })

    it('filters by ruleId', () => {
        const results = service.queryEvents({ ruleId: 'CLR-001' })
        expect(results).toHaveLength(2)
        expect(results.every((e) => e.ruleId === 'CLR-001')).toBe(true)
    })

    it('filters by eventType', () => {
        const results = service.queryEvents({ eventType: 'violation' })
        expect(results).toHaveLength(2)
        expect(results.every((e) => e.eventType === 'violation')).toBe(true)
    })

    it('filters by filePath', () => {
        const results = service.queryEvents({ filePath: '/b.tsx' })
        expect(results).toHaveLength(2)
        expect(results.every((e) => e.filePath === '/b.tsx')).toBe(true)
    })

    it('filters by severity', () => {
        const results = service.queryEvents({ severity: 'critical' })
        expect(results).toHaveLength(2)
        expect(results.every((e) => e.severity === 'critical')).toBe(true)
    })

    it('respects limit', () => {
        const results = service.queryEvents({ limit: 2 })
        expect(results).toHaveLength(2)
    })

    it('respects offset', () => {
        const all = service.queryEvents({})
        const paged = service.queryEvents({ limit: 2, offset: 2 })
        // Offset 2 skips the two newest; the third newest should be first here.
        expect(paged[0]!.id).toBe(all[2]!.id)
    })

    it('returns empty array when no events match the filters', () => {
        const results = service.queryEvents({ ruleId: 'NONEXISTENT' })
        expect(results).toHaveLength(0)
    })

    it('combines multiple filters (ruleId + severity)', () => {
        const results = service.queryEvents({ ruleId: 'CLR-001', severity: 'critical' })
        expect(results).toHaveLength(1)
        expect(results[0]!.id).toBe('e1')
    })
})

// ── 4. getEventCounts ─────────────────────────────────────────────────────────

describe('GovernanceEventService — getEventCounts', () => {
    let service: GovernanceEventService

    beforeEach(() => {
        ;({ service } = createService())
        service.recordEvent(makeEvent({ id: 'c1', timestamp: '2026-01-01T00:00:00.000Z', eventType: 'violation' }))
        service.recordEvent(makeEvent({ id: 'c2', timestamp: '2026-01-02T00:00:00.000Z', eventType: 'violation' }))
        service.recordEvent(makeEvent({ id: 'c3', timestamp: '2026-01-03T00:00:00.000Z', eventType: 'override' }))
        service.recordEvent(makeEvent({ id: 'c4', timestamp: '2026-01-04T00:00:00.000Z', eventType: 'auto_fix' }))
        service.recordEvent(makeEvent({ id: 'c5', timestamp: '2025-12-31T00:00:00.000Z', eventType: 'violation' }))
    })

    it('returns correct counts per event_type since the given timestamp', () => {
        const counts = service.getEventCounts('2026-01-01T00:00:00.000Z')
        expect(counts['violation']).toBe(2)
        expect(counts['override']).toBe(1)
        expect(counts['auto_fix']).toBe(1)
    })

    it('excludes events before the since timestamp', () => {
        const counts = service.getEventCounts('2026-01-01T00:00:00.000Z')
        // c5 is in 2025, so violation count should be 2 (c1 + c2), not 3
        expect(counts['violation']).toBe(2)
    })

    it('returns empty object when no events match the window', () => {
        const counts = service.getEventCounts('2030-01-01T00:00:00.000Z')
        expect(counts).toEqual({})
    })

    it('only returns keys for event types that actually exist in the window', () => {
        const counts = service.getEventCounts('2026-01-04T00:00:00.000Z')
        expect(Object.keys(counts)).toEqual(['auto_fix'])
    })
})

// ── 5. getTopViolatedRules ────────────────────────────────────────────────────

describe('GovernanceEventService — getTopViolatedRules', () => {
    let service: GovernanceEventService

    beforeEach(() => {
        ;({ service } = createService())
        // CLR-001: 3 violations, A11Y-002: 2 violations, EXP-001: 1 violation
        for (let i = 0; i < 3; i++) service.recordEvent(makeEvent({ eventType: 'violation', ruleId: 'CLR-001' }))
        for (let i = 0; i < 2; i++) service.recordEvent(makeEvent({ eventType: 'violation', ruleId: 'A11Y-002' }))
        service.recordEvent(makeEvent({ eventType: 'violation', ruleId: 'EXP-001' }))
        // override events should NOT appear in violation counts
        service.recordEvent(makeEvent({ eventType: 'override', ruleId: 'CLR-001' }))
    })

    it('returns rules ordered by violation count descending', () => {
        const top = service.getTopViolatedRules(3)
        expect(top[0]!.ruleId).toBe('CLR-001')
        expect(top[0]!.count).toBe(3)
        expect(top[1]!.ruleId).toBe('A11Y-002')
        expect(top[1]!.count).toBe(2)
        expect(top[2]!.ruleId).toBe('EXP-001')
        expect(top[2]!.count).toBe(1)
    })

    it('respects the limit parameter', () => {
        const top = service.getTopViolatedRules(1)
        expect(top).toHaveLength(1)
        expect(top[0]!.ruleId).toBe('CLR-001')
    })

    it('excludes non-violation events from the counts', () => {
        const top = service.getTopViolatedRules(10)
        const allViolationCount = top.reduce((sum, r) => sum + r.count, 0)
        expect(allViolationCount).toBe(6) // 3 + 2 + 1 — not 7
    })

    it('returns empty array when no violation events exist', () => {
        const { service: emptyService } = createService()
        emptyService.recordEvent(makeEvent({ eventType: 'override' }))
        expect(emptyService.getTopViolatedRules(5)).toHaveLength(0)
    })
})

// ── 6. getTopViolatedFiles ────────────────────────────────────────────────────

describe('GovernanceEventService — getTopViolatedFiles', () => {
    let service: GovernanceEventService

    beforeEach(() => {
        ;({ service } = createService())
        // /a.tsx: 4 violations, /b.tsx: 2 violations, /c.tsx: 1 violation
        for (let i = 0; i < 4; i++) service.recordEvent(makeEvent({ eventType: 'violation', filePath: '/a.tsx' }))
        for (let i = 0; i < 2; i++) service.recordEvent(makeEvent({ eventType: 'violation', filePath: '/b.tsx' }))
        service.recordEvent(makeEvent({ eventType: 'violation', filePath: '/c.tsx' }))
        // export_block on /a.tsx should NOT count
        service.recordEvent(makeEvent({ eventType: 'export_block', filePath: '/a.tsx' }))
    })

    it('returns files ordered by violation count descending', () => {
        const top = service.getTopViolatedFiles(3)
        expect(top[0]!.filePath).toBe('/a.tsx')
        expect(top[0]!.count).toBe(4)
        expect(top[1]!.filePath).toBe('/b.tsx')
        expect(top[1]!.count).toBe(2)
        expect(top[2]!.filePath).toBe('/c.tsx')
        expect(top[2]!.count).toBe(1)
    })

    it('respects the limit parameter', () => {
        const top = service.getTopViolatedFiles(2)
        expect(top).toHaveLength(2)
    })

    it('excludes non-violation events from the counts', () => {
        const top = service.getTopViolatedFiles(10)
        const total = top.reduce((sum, f) => sum + f.count, 0)
        expect(total).toBe(7) // 4 + 2 + 1 — not 8
    })
})

// ── 7. pruneEvents ────────────────────────────────────────────────────────────

describe('GovernanceEventService — pruneEvents', () => {
    let service: GovernanceEventService

    beforeEach(() => {
        ;({ service } = createService())
        service.recordEvent(makeEvent({ id: 'p1', timestamp: '2025-01-01T00:00:00.000Z' }))
        service.recordEvent(makeEvent({ id: 'p2', timestamp: '2025-06-01T00:00:00.000Z' }))
        service.recordEvent(makeEvent({ id: 'p3', timestamp: '2026-01-01T00:00:00.000Z' }))
        service.recordEvent(makeEvent({ id: 'p4', timestamp: '2026-03-01T00:00:00.000Z' }))
    })

    it('deletes rows strictly older than the olderThan timestamp', () => {
        service.pruneEvents('2026-01-01T00:00:00.000Z')
        const remaining = service.queryEvents({})
        const ids = remaining.map((e) => e.id)
        expect(ids).not.toContain('p1')
        expect(ids).not.toContain('p2')
        expect(ids).toContain('p3')
        expect(ids).toContain('p4')
    })

    it('returns the number of deleted rows', () => {
        const deleted = service.pruneEvents('2026-01-01T00:00:00.000Z')
        expect(deleted).toBe(2)
    })

    it('returns 0 when no rows fall within the prune window', () => {
        const deleted = service.pruneEvents('2020-01-01T00:00:00.000Z')
        expect(deleted).toBe(0)
    })

    it('prunes all rows when olderThan is in the future', () => {
        const deleted = service.pruneEvents(isoOffset(3600))
        expect(deleted).toBe(4)
        expect(service.queryEvents({})).toHaveLength(0)
    })

    it('does not delete the row exactly at the olderThan boundary', () => {
        // pruneEvents uses strict less-than (<), so the boundary row survives.
        service.pruneEvents('2026-01-01T00:00:00.000Z')
        const ids = service.queryEvents({}).map((e) => e.id)
        expect(ids).toContain('p3')
    })
})

// ── 8. Concurrent inserts ─────────────────────────────────────────────────────

describe('GovernanceEventService — concurrent inserts', () => {
    it('handles many rapid synchronous inserts without data corruption', () => {
        const { service } = createService()
        const COUNT = 200

        for (let i = 0; i < COUNT; i++) {
            service.recordEvent(makeEvent({
                ruleId: `RULE-${i % 5}`,
                severity: i % 2 === 0 ? 'critical' : 'warning',
                filePath: `/file-${i % 10}.tsx`,
            }))
        }

        const all = service.queryEvents({ limit: COUNT + 10 })
        expect(all).toHaveLength(COUNT)
    })

    it('does not duplicate rows under rapid inserts', () => {
        const { service, db } = createService()

        for (let i = 0; i < 50; i++) {
            service.recordEvent(makeEvent())
        }

        const row = db
            .prepare('SELECT COUNT(*) AS total FROM governance_events')
            .get() as { total: number }
        expect(row.total).toBe(50)
    })

    it('aggregation queries are consistent after many inserts', () => {
        const { service } = createService()

        for (let i = 0; i < 30; i++) service.recordEvent(makeEvent({ ruleId: 'CLR-001' }))
        for (let i = 0; i < 20; i++) service.recordEvent(makeEvent({ ruleId: 'A11Y-002' }))

        const top = service.getTopViolatedRules(2)
        expect(top[0]!.count).toBe(30)
        expect(top[1]!.count).toBe(20)
    })
})

// ── 9. getOverrideCount (GOV.2) ───────────────────────────────────────────────

describe('GovernanceEventService — getOverrideCount', () => {
    it('returns 0 for a brand-new session with no events', () => {
        const { service } = createService()
        expect(service.getOverrideCount('new-session-xyz')).toBe(0)
    })

    it('counts only override events, not other event types', () => {
        const { service } = createService()
        service.recordEvent(makeEvent({ eventType: 'override',   ruleId: 'A11Y-001', sessionId: 'sess-A' }))
        service.recordEvent(makeEvent({ eventType: 'override',   ruleId: 'A11Y-002', sessionId: 'sess-A' }))
        service.recordEvent(makeEvent({ eventType: 'violation',  ruleId: 'A11Y-003', sessionId: 'sess-A' }))
        service.recordEvent(makeEvent({ eventType: 'auto_fix',   ruleId: 'A11Y-004', sessionId: 'sess-A' }))

        expect(service.getOverrideCount('sess-A')).toBe(2)
    })

    it('filters by sessionId — does not count overrides from other sessions', () => {
        const { service } = createService()
        service.recordEvent(makeEvent({ eventType: 'override', ruleId: 'A11Y-001', sessionId: 'sess-A' }))
        service.recordEvent(makeEvent({ eventType: 'override', ruleId: 'A11Y-002', sessionId: 'sess-B' }))
        service.recordEvent(makeEvent({ eventType: 'override', ruleId: 'A11Y-003', sessionId: 'sess-B' }))

        expect(service.getOverrideCount('sess-A')).toBe(1)
        expect(service.getOverrideCount('sess-B')).toBe(2)
    })

    it('counts all override events when no sessionId is provided', () => {
        const { service } = createService()
        service.recordEvent(makeEvent({ eventType: 'override', ruleId: 'A11Y-001', sessionId: 'sess-A' }))
        service.recordEvent(makeEvent({ eventType: 'override', ruleId: 'A11Y-002', sessionId: 'sess-B' }))
        service.recordEvent(makeEvent({ eventType: 'violation', ruleId: 'A11Y-003', sessionId: 'sess-A' }))

        expect(service.getOverrideCount()).toBe(2)
    })

    it('ignores non-override events when counting with null sessionId', () => {
        const { service } = createService()
        service.recordEvent(makeEvent({ eventType: 'violation',    ruleId: 'R1' }))
        service.recordEvent(makeEvent({ eventType: 'export_block', ruleId: 'R2' }))
        service.recordEvent(makeEvent({ eventType: 'auto_fix',     ruleId: 'R3' }))
        service.recordEvent(makeEvent({ eventType: 'rule_change',  ruleId: 'R4' }))

        expect(service.getOverrideCount()).toBe(0)
    })
})

// ── Cleanup ───────────────────────────────────────────────────────────────────

describe('GovernanceEventService — cleanup', () => {
    it('closing the database after use does not throw', () => {
        const { db } = createService()
        expect(() => db.close()).not.toThrow()
    })
})
