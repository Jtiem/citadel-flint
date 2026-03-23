/**
 * ConsensusQueryService — Unit Tests (V.4 Epistemic Consensus Gate)
 *
 * Uses an in-memory SQLite database for hermetic, disk-free tests.
 * The full consensus_records DDL from V.4 contract is applied in beforeEach.
 *
 * Coverage:
 *   - getSummary(): zero-state when table absent, aggregates counts,
 *     disagreement rate, last24hCount, recentDisagreements
 *   - getBySession(): filters by session_id, enforces limit ≤ 100
 *   - getByAgent(): filters by agent_id, enforces limit ≤ 100
 *   - getDisagreements(): only returns disagree rows, enforces limit ≤ 100
 *   - pruneRecords(): returns count of deleted rows
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { ConsensusQueryService } from '../consensusQueryService.js'

// ---------------------------------------------------------------------------
// DDL (mirrors the schema in V.4 contract / electron/store.ts)
// ---------------------------------------------------------------------------

const CONSENSUS_DDL = `
CREATE TABLE IF NOT EXISTS consensus_records (
    id                    TEXT    PRIMARY KEY,
    mutation_id           TEXT,
    tool_name             TEXT    NOT NULL,
    tool_input_json       TEXT    NOT NULL DEFAULT '{}',
    mrs_score             REAL    NOT NULL,
    mrs_tier              TEXT    NOT NULL,
    primary_judgment      TEXT    NOT NULL,
    primary_reasoning     TEXT    NOT NULL DEFAULT '',
    primary_confidence    REAL,
    primary_duration_ms   INTEGER NOT NULL DEFAULT 0,
    secondary_judgment    TEXT    NOT NULL,
    secondary_reasoning   TEXT    NOT NULL DEFAULT '',
    secondary_confidence  REAL,
    secondary_duration_ms INTEGER NOT NULL DEFAULT 0,
    outcome               TEXT    NOT NULL,
    session_id            TEXT,
    agent_id              TEXT    NOT NULL DEFAULT 'orchestrator',
    domain                TEXT    NOT NULL DEFAULT 'general',
    timestamp             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database.Database {
    return new Database(':memory:')
}

function makeService(): { service: ConsensusQueryService; db: Database.Database } {
    const db = makeDb()
    return { service: new ConsensusQueryService(db), db }
}

function makeServiceWithTable(): { service: ConsensusQueryService; db: Database.Database } {
    const db = makeDb()
    db.exec(CONSENSUS_DDL)
    return { service: new ConsensusQueryService(db), db }
}

let idCounter = 0
function insertRecord(
    db: Database.Database,
    overrides: Partial<{
        id: string
        outcome: string
        session_id: string | null
        agent_id: string
        mrs_tier: string
        primary_judgment: string
        secondary_judgment: string
        primary_duration_ms: number
        secondary_duration_ms: number
        timestamp: string
    }> = {},
): void {
    idCounter += 1
    const defaults = {
        id: `rec-${idCounter}`,
        mutation_id: null,
        tool_name: 'flint_ast_mutate',
        tool_input_json: '{}',
        mrs_score: 0.5,
        mrs_tier: 'amber',
        primary_judgment: 'approve',
        primary_reasoning: 'looks good',
        primary_confidence: 0.9,
        primary_duration_ms: 100,
        secondary_judgment: 'approve',
        secondary_reasoning: 'looks good too',
        secondary_confidence: 0.85,
        secondary_duration_ms: 200,
        outcome: 'agree_approve',
        session_id: null,
        agent_id: 'orchestrator',
        domain: 'general',
        timestamp: new Date().toISOString(),
    }
    const row = { ...defaults, ...overrides }
    db.prepare(`
        INSERT INTO consensus_records (
            id, mutation_id, tool_name, tool_input_json, mrs_score, mrs_tier,
            primary_judgment, primary_reasoning, primary_confidence, primary_duration_ms,
            secondary_judgment, secondary_reasoning, secondary_confidence, secondary_duration_ms,
            outcome, session_id, agent_id, domain, timestamp
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?
        )
    `).run(
        row.id, row.mutation_id, row.tool_name, row.tool_input_json, row.mrs_score, row.mrs_tier,
        row.primary_judgment, row.primary_reasoning, row.primary_confidence, row.primary_duration_ms,
        row.secondary_judgment, row.secondary_reasoning, row.secondary_confidence, row.secondary_duration_ms,
        row.outcome, row.session_id, row.agent_id, row.domain, row.timestamp,
    )
}

// ---------------------------------------------------------------------------
// Tests: getSummary()
// ---------------------------------------------------------------------------

describe('ConsensusQueryService.getSummary()', () => {
    it('returns zero-state summary when the consensus_records table does not exist', () => {
        // Database with no tables at all
        const { service } = makeService()
        const summary = service.getSummary()

        expect(summary.totalEvaluations).toBe(0)
        expect(summary.disagreementRate).toBe(0)
        expect(summary.avgSecondaryDurationMs).toBe(0)
        expect(summary.last24hCount).toBe(0)
        expect(summary.recentDisagreements).toHaveLength(0)
        expect(summary.byOutcome).toEqual({
            agree_approve: 0,
            agree_reject: 0,
            disagree: 0,
            error: 0,
            skipped: 0,
        })
    })

    it('returns zero counts when table exists but is empty', () => {
        const { service } = makeServiceWithTable()
        const summary = service.getSummary()

        expect(summary.totalEvaluations).toBe(0)
        expect(summary.byOutcome.agree_approve).toBe(0)
        expect(summary.disagreementRate).toBe(0)
    })

    it('correctly aggregates outcome counts', () => {
        const { service, db } = makeServiceWithTable()

        insertRecord(db, { outcome: 'agree_approve' })
        insertRecord(db, { outcome: 'agree_approve' })
        insertRecord(db, { outcome: 'agree_reject' })
        insertRecord(db, { outcome: 'disagree' })
        insertRecord(db, { outcome: 'error' })
        insertRecord(db, { outcome: 'skipped' })

        const summary = service.getSummary()

        expect(summary.totalEvaluations).toBe(6)
        expect(summary.byOutcome.agree_approve).toBe(2)
        expect(summary.byOutcome.agree_reject).toBe(1)
        expect(summary.byOutcome.disagree).toBe(1)
        expect(summary.byOutcome.error).toBe(1)
        expect(summary.byOutcome.skipped).toBe(1)
    })

    it('computes disagreement rate correctly', () => {
        const { service, db } = makeServiceWithTable()

        // 2 out of 4 are disagree → rate = 0.5
        insertRecord(db, { outcome: 'agree_approve' })
        insertRecord(db, { outcome: 'agree_approve' })
        insertRecord(db, { outcome: 'disagree' })
        insertRecord(db, { outcome: 'disagree' })

        const summary = service.getSummary()
        expect(summary.disagreementRate).toBe(0.5)
    })

    it('returns disagreementRate = 0 when there are no evaluations', () => {
        const { service } = makeServiceWithTable()
        const summary = service.getSummary()
        expect(summary.disagreementRate).toBe(0)
    })

    it('computes avgSecondaryDurationMs excluding error and skipped rows', () => {
        const { service, db } = makeServiceWithTable()

        // Two valid rows with durations 100 and 300 (avg = 200)
        insertRecord(db, { outcome: 'agree_approve', secondary_duration_ms: 100 })
        insertRecord(db, { outcome: 'agree_reject', secondary_duration_ms: 300 })
        // These should be excluded
        insertRecord(db, { outcome: 'error', secondary_duration_ms: 9999 })
        insertRecord(db, { outcome: 'skipped', secondary_duration_ms: 9999 })

        const summary = service.getSummary()
        expect(summary.avgSecondaryDurationMs).toBe(200)
    })

    it('counts last24hCount correctly for recent records', () => {
        const { service, db } = makeServiceWithTable()

        // Recent record (now)
        insertRecord(db, { outcome: 'agree_approve', timestamp: new Date().toISOString() })
        // Old record (2 days ago) — should not count
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        insertRecord(db, { outcome: 'agree_approve', timestamp: twoDaysAgo })

        const summary = service.getSummary()
        expect(summary.last24hCount).toBe(1)
    })

    it('includes up to 10 recent disagreements in recentDisagreements', () => {
        const { service, db } = makeServiceWithTable()

        // Insert 12 disagree records
        for (let i = 0; i < 12; i++) {
            insertRecord(db, { outcome: 'disagree' })
        }
        // Insert some non-disagree records that should not appear
        insertRecord(db, { outcome: 'agree_approve' })
        insertRecord(db, { outcome: 'agree_reject' })

        const summary = service.getSummary()
        expect(summary.recentDisagreements).toHaveLength(10)
        for (const rec of summary.recentDisagreements) {
            expect(rec.outcome).toBe('disagree')
        }
    })

    it('maps row fields to ConsensusRecord correctly', () => {
        const { service, db } = makeServiceWithTable()

        insertRecord(db, {
            id: 'test-id-1',
            outcome: 'disagree',
            session_id: 'sess-abc',
            agent_id: 'agent-xyz',
            mrs_tier: 'red',
            primary_judgment: 'approve',
            secondary_judgment: 'reject',
            primary_duration_ms: 150,
            secondary_duration_ms: 250,
        })

        const summary = service.getSummary()
        expect(summary.recentDisagreements).toHaveLength(1)
        const rec = summary.recentDisagreements[0]
        expect(rec.id).toBe('test-id-1')
        expect(rec.sessionId).toBe('sess-abc')
        expect(rec.agentId).toBe('agent-xyz')
        expect(rec.mrsTier).toBe('red')
        expect(rec.primaryVerdict.judgment).toBe('approve')
        expect(rec.secondaryVerdict.judgment).toBe('reject')
        expect(rec.primaryVerdict.durationMs).toBe(150)
        expect(rec.secondaryVerdict.durationMs).toBe(250)
    })
})

// ---------------------------------------------------------------------------
// Tests: getBySession()
// ---------------------------------------------------------------------------

describe('ConsensusQueryService.getBySession()', () => {
    let service: ConsensusQueryService
    let db: Database.Database

    beforeEach(() => {
        ;({ service, db } = makeServiceWithTable())
    })

    it('returns only records matching the given sessionId', () => {
        insertRecord(db, { session_id: 'sess-A' })
        insertRecord(db, { session_id: 'sess-A' })
        insertRecord(db, { session_id: 'sess-B' })

        const results = service.getBySession('sess-A')
        expect(results).toHaveLength(2)
        for (const rec of results) {
            expect(rec.sessionId).toBe('sess-A')
        }
    })

    it('returns empty array when no records match the sessionId', () => {
        insertRecord(db, { session_id: 'sess-Z' })
        const results = service.getBySession('sess-nonexistent')
        expect(results).toHaveLength(0)
    })

    it('respects the limit parameter', () => {
        for (let i = 0; i < 10; i++) {
            insertRecord(db, { session_id: 'sess-limit' })
        }
        const results = service.getBySession('sess-limit', 5)
        expect(results).toHaveLength(5)
    })

    it('enforces maximum limit of 100', () => {
        for (let i = 0; i < 110; i++) {
            insertRecord(db, { session_id: 'sess-big' })
        }
        // Requesting more than 100 should still return at most 100
        const results = service.getBySession('sess-big', 200)
        expect(results.length).toBeLessThanOrEqual(100)
    })

    it('uses default limit of 20 when limit is omitted', () => {
        for (let i = 0; i < 30; i++) {
            insertRecord(db, { session_id: 'sess-default' })
        }
        const results = service.getBySession('sess-default')
        expect(results).toHaveLength(20)
    })

    it('returns records ordered by timestamp descending', () => {
        const now = Date.now()
        insertRecord(db, { session_id: 'sess-order', timestamp: new Date(now - 2000).toISOString() })
        insertRecord(db, { session_id: 'sess-order', timestamp: new Date(now - 1000).toISOString() })
        insertRecord(db, { session_id: 'sess-order', timestamp: new Date(now).toISOString() })

        const results = service.getBySession('sess-order')
        expect(results[0].timestamp >= results[1].timestamp).toBe(true)
        expect(results[1].timestamp >= results[2].timestamp).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Tests: getByAgent()
// ---------------------------------------------------------------------------

describe('ConsensusQueryService.getByAgent()', () => {
    let service: ConsensusQueryService
    let db: Database.Database

    beforeEach(() => {
        ;({ service, db } = makeServiceWithTable())
    })

    it('returns only records matching the given agentId', () => {
        insertRecord(db, { agent_id: 'agent-1' })
        insertRecord(db, { agent_id: 'agent-1' })
        insertRecord(db, { agent_id: 'agent-2' })

        const results = service.getByAgent('agent-1')
        expect(results).toHaveLength(2)
        for (const rec of results) {
            expect(rec.agentId).toBe('agent-1')
        }
    })

    it('returns empty array when no records match the agentId', () => {
        insertRecord(db, { agent_id: 'agent-known' })
        const results = service.getByAgent('agent-unknown')
        expect(results).toHaveLength(0)
    })

    it('respects the limit parameter', () => {
        for (let i = 0; i < 10; i++) {
            insertRecord(db, { agent_id: 'agent-limited' })
        }
        const results = service.getByAgent('agent-limited', 4)
        expect(results).toHaveLength(4)
    })

    it('enforces maximum limit of 100', () => {
        for (let i = 0; i < 110; i++) {
            insertRecord(db, { agent_id: 'agent-capped' })
        }
        const results = service.getByAgent('agent-capped', 999)
        expect(results.length).toBeLessThanOrEqual(100)
    })

    it('uses default limit of 20 when limit is omitted', () => {
        for (let i = 0; i < 25; i++) {
            insertRecord(db, { agent_id: 'agent-default' })
        }
        const results = service.getByAgent('agent-default')
        expect(results).toHaveLength(20)
    })
})

// ---------------------------------------------------------------------------
// Tests: getDisagreements()
// ---------------------------------------------------------------------------

describe('ConsensusQueryService.getDisagreements()', () => {
    let service: ConsensusQueryService
    let db: Database.Database

    beforeEach(() => {
        ;({ service, db } = makeServiceWithTable())
    })

    it('returns only records with outcome = disagree', () => {
        insertRecord(db, { outcome: 'agree_approve' })
        insertRecord(db, { outcome: 'disagree' })
        insertRecord(db, { outcome: 'agree_reject' })
        insertRecord(db, { outcome: 'disagree' })
        insertRecord(db, { outcome: 'error' })

        const results = service.getDisagreements()
        expect(results).toHaveLength(2)
        for (const rec of results) {
            expect(rec.outcome).toBe('disagree')
        }
    })

    it('returns empty array when no disagreements exist', () => {
        insertRecord(db, { outcome: 'agree_approve' })
        const results = service.getDisagreements()
        expect(results).toHaveLength(0)
    })

    it('respects the limit parameter', () => {
        for (let i = 0; i < 15; i++) {
            insertRecord(db, { outcome: 'disagree' })
        }
        const results = service.getDisagreements(5)
        expect(results).toHaveLength(5)
    })

    it('enforces maximum limit of 100', () => {
        for (let i = 0; i < 110; i++) {
            insertRecord(db, { outcome: 'disagree' })
        }
        const results = service.getDisagreements(200)
        expect(results.length).toBeLessThanOrEqual(100)
    })

    it('uses default limit of 20 when limit is omitted', () => {
        for (let i = 0; i < 30; i++) {
            insertRecord(db, { outcome: 'disagree' })
        }
        const results = service.getDisagreements()
        expect(results).toHaveLength(20)
    })

    it('returns records ordered by timestamp descending', () => {
        const now = Date.now()
        insertRecord(db, { outcome: 'disagree', timestamp: new Date(now - 3000).toISOString() })
        insertRecord(db, { outcome: 'disagree', timestamp: new Date(now - 1000).toISOString() })
        insertRecord(db, { outcome: 'disagree', timestamp: new Date(now).toISOString() })

        const results = service.getDisagreements()
        expect(results[0].timestamp >= results[1].timestamp).toBe(true)
        expect(results[1].timestamp >= results[2].timestamp).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Tests: pruneRecords()
// ---------------------------------------------------------------------------

describe('ConsensusQueryService.pruneRecords()', () => {
    let service: ConsensusQueryService
    let db: Database.Database

    beforeEach(() => {
        ;({ service, db } = makeServiceWithTable())
    })

    it('deletes records older than the given timestamp and returns the count', () => {
        const now = Date.now()
        const old = new Date(now - 10000).toISOString()
        const recent = new Date(now - 1000).toISOString()
        const cutoff = new Date(now - 5000).toISOString()

        insertRecord(db, { timestamp: old })
        insertRecord(db, { timestamp: old })
        insertRecord(db, { timestamp: recent })

        const deleted = service.pruneRecords(cutoff)
        expect(deleted).toBe(2)

        // Verify only 1 remains
        const remaining = db.prepare('SELECT COUNT(*) as count FROM consensus_records').get() as { count: number }
        expect(remaining.count).toBe(1)
    })

    it('returns 0 when no records are older than the given timestamp', () => {
        const recent = new Date().toISOString()
        insertRecord(db, { timestamp: recent })

        // cutoff in the past — nothing should be older than 10 years ago
        const cutoff = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
        const deleted = service.pruneRecords(cutoff)
        expect(deleted).toBe(0)
    })

    it('returns 0 when table is empty', () => {
        const deleted = service.pruneRecords(new Date().toISOString())
        expect(deleted).toBe(0)
    })

    it('deletes all records when cutoff is in the future', () => {
        insertRecord(db, {})
        insertRecord(db, {})
        insertRecord(db, {})

        const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        const deleted = service.pruneRecords(future)
        expect(deleted).toBe(3)

        const remaining = db.prepare('SELECT COUNT(*) as count FROM consensus_records').get() as { count: number }
        expect(remaining.count).toBe(0)
    })
})
