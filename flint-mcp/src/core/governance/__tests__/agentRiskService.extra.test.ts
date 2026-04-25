/**
 * agentRiskService.extra.test.ts — Coverage backfill for AGV.2
 *
 * Companion to agentRiskService.test.ts. Adds tests for branches the primary
 * file does not exercise:
 *
 *   - tier='high' mapping → amberCount (primary file only checks critical/medium)
 *   - tier values outside the known set are excluded from all tier counters
 *   - getAgentProfile passes periodDays through to getAgentRiskSummary
 *   - avgRiskScore rounds to 2 decimal places (boundary)
 *   - Multiple agents with overrides are matched by agent_id, not by index
 *
 * Hermetic: in-memory SQLite, no disk artefacts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { AgentRiskService } from '../agentRiskService.js'

// ---------------------------------------------------------------------------
// Helpers (mirrors agentRiskService.test.ts)
// ---------------------------------------------------------------------------

function createProvenanceDb(): Database.Database {
    const db = new BetterSqlite3(':memory:')
    db.exec(`
        CREATE TABLE IF NOT EXISTS mutation_provenance (
            mutation_id             TEXT PRIMARY KEY,
            timestamp               TEXT NOT NULL,
            provenance_source       TEXT NOT NULL,
            provenance_agent_id     TEXT,
            provenance_session_id   TEXT,
            provenance_reasoning    TEXT,
            provenance_confidence   REAL
        );
        CREATE TABLE IF NOT EXISTS mutation_risk_scores (
            mutation_id     TEXT PRIMARY KEY,
            score           REAL NOT NULL,
            tier            TEXT NOT NULL,
            factors_json    TEXT NOT NULL DEFAULT '[]',
            scored_at       TEXT NOT NULL
        );
    `)
    return db
}

function createOverridesDb(): Database.Database {
    const db = new BetterSqlite3(':memory:')
    db.exec(`
        CREATE TABLE IF NOT EXISTS override_events (
            id              TEXT PRIMARY KEY,
            node_id         TEXT,
            rule_id         TEXT NOT NULL,
            session_id      TEXT,
            agent_id        TEXT,
            timestamp       TEXT NOT NULL,
            project_root    TEXT NOT NULL,
            reason          TEXT
        );
    `)
    return db
}

function insertProvenance(
    db: Database.Database,
    mutationId: string,
    agentId: string,
    timestamp: string,
): void {
    db.prepare(`
        INSERT INTO mutation_provenance (mutation_id, timestamp, provenance_source, provenance_agent_id)
        VALUES (?, ?, 'agent', ?)
    `).run(mutationId, timestamp, agentId)
}

function insertRiskScore(
    db: Database.Database,
    mutationId: string,
    score: number,
    tier: string,
): void {
    db.prepare(`
        INSERT INTO mutation_risk_scores (mutation_id, score, tier, scored_at)
        VALUES (?, ?, ?, ?)
    `).run(mutationId, score, tier, new Date().toISOString())
}

function insertOverride(
    db: Database.Database,
    id: string,
    agentId: string,
    projectRoot: string,
    timestamp: string,
): void {
    db.prepare(`
        INSERT INTO override_events (id, rule_id, agent_id, timestamp, project_root)
        VALUES (?, 'CLR-001', ?, ?, ?)
    `).run(id, agentId, timestamp, projectRoot)
}

function recent(): string {
    return new Date(Date.now() - 30 * 60 * 1000).toISOString()
}

function daysAgo(n: number): string {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentRiskService — tier mapping coverage', () => {
    let provenanceDb: Database.Database
    let overridesDb: Database.Database
    let service: AgentRiskService

    beforeEach(() => {
        provenanceDb = createProvenanceDb()
        overridesDb = createOverridesDb()
        service = new AgentRiskService(provenanceDb, overridesDb)
    })

    afterEach(() => {
        provenanceDb.close()
        overridesDb.close()
    })

    it("tier='high' maps to amberCount", () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm1', 'agent-a', ts)
        insertRiskScore(provenanceDb, 'm1', 65, 'high')

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents).toHaveLength(1)
        expect(summary.agents[0].amberCount).toBe(1)
        expect(summary.agents[0].redCount).toBe(0)
        expect(summary.agents[0].greenCount).toBe(0)
    })

    it("tier='low' and tier='medium' both map to greenCount", () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm-low', 'agent-a', ts)
        insertProvenance(provenanceDb, 'm-med', 'agent-a', ts)
        insertRiskScore(provenanceDb, 'm-low', 10, 'low')
        insertRiskScore(provenanceDb, 'm-med', 40, 'medium')

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents[0].greenCount).toBe(2)
        expect(summary.agents[0].amberCount).toBe(0)
        expect(summary.agents[0].redCount).toBe(0)
    })

    it('mixes critical/high/medium/low across all tier counters in one summary', () => {
        const ts = recent()
        const samples: Array<[string, number, string, 'redCount' | 'amberCount' | 'greenCount']> = [
            ['m-c', 95, 'critical', 'redCount'],
            ['m-h', 70, 'high', 'amberCount'],
            ['m-m', 40, 'medium', 'greenCount'],
            ['m-l', 10, 'low', 'greenCount'],
        ]
        for (const [id, score, tier] of samples) {
            insertProvenance(provenanceDb, id, 'agent-mix', ts)
            insertRiskScore(provenanceDb, id, score, tier)
        }

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents[0].redCount).toBe(1)
        expect(summary.agents[0].amberCount).toBe(1)
        expect(summary.agents[0].greenCount).toBe(2)
    })

    it("unknown tier values are excluded from all tier counters", () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm-unknown', 'agent-a', ts)
        insertRiskScore(provenanceDb, 'm-unknown', 50, 'mystery-tier')

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents[0].redCount).toBe(0)
        expect(summary.agents[0].amberCount).toBe(0)
        expect(summary.agents[0].greenCount).toBe(0)
        // mutationCount still reflects the provenance row
        expect(summary.agents[0].mutationCount).toBe(1)
    })
})

describe('AgentRiskService — getAgentProfile period passthrough', () => {
    let provenanceDb: Database.Database
    let overridesDb: Database.Database
    let service: AgentRiskService

    beforeEach(() => {
        provenanceDb = createProvenanceDb()
        overridesDb = createOverridesDb()
        service = new AgentRiskService(provenanceDb, overridesDb)
    })

    afterEach(() => {
        provenanceDb.close()
        overridesDb.close()
    })

    it('honours custom periodDays in getAgentProfile', () => {
        insertProvenance(provenanceDb, 'm-old', 'agent-a', daysAgo(20))
        insertProvenance(provenanceDb, 'm-new', 'agent-a', daysAgo(2))

        // 7-day window: only one mutation visible
        const profile7 = service.getAgentProfile('agent-a', '/test/project', 7)
        expect(profile7).not.toBeNull()
        expect(profile7!.mutationCount).toBe(1)

        // 30-day window: both mutations visible
        const profile30 = service.getAgentProfile('agent-a', '/test/project', 30)
        expect(profile30!.mutationCount).toBe(2)
    })

    it('returns null when agent has activity outside the requested period', () => {
        insertProvenance(provenanceDb, 'm-old', 'agent-a', daysAgo(20))

        const profile = service.getAgentProfile('agent-a', '/test/project', 7)
        expect(profile).toBeNull()
    })
})

describe('AgentRiskService — avgRiskScore rounding', () => {
    let provenanceDb: Database.Database
    let overridesDb: Database.Database
    let service: AgentRiskService

    beforeEach(() => {
        provenanceDb = createProvenanceDb()
        overridesDb = createOverridesDb()
        service = new AgentRiskService(provenanceDb, overridesDb)
    })

    afterEach(() => {
        provenanceDb.close()
        overridesDb.close()
    })

    it('rounds avgRiskScore to 2 decimal places', () => {
        const ts = recent()
        // 33.333... → should round to 33.33
        insertProvenance(provenanceDb, 'm1', 'agent-a', ts)
        insertProvenance(provenanceDb, 'm2', 'agent-a', ts)
        insertProvenance(provenanceDb, 'm3', 'agent-a', ts)
        insertRiskScore(provenanceDb, 'm1', 33, 'medium')
        insertRiskScore(provenanceDb, 'm2', 33, 'medium')
        insertRiskScore(provenanceDb, 'm3', 34, 'medium')
        // average = 33.3333... → expect 33.33

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents[0].avgRiskScore).toBe(33.33)
    })
})

describe('AgentRiskService — multi-agent override matching', () => {
    let provenanceDb: Database.Database
    let overridesDb: Database.Database
    let service: AgentRiskService

    beforeEach(() => {
        provenanceDb = createProvenanceDb()
        overridesDb = createOverridesDb()
        service = new AgentRiskService(provenanceDb, overridesDb)
    })

    afterEach(() => {
        provenanceDb.close()
        overridesDb.close()
    })

    it('matches override counts to the correct agent_id, not by index', () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm-a', 'agent-a', ts)
        insertProvenance(provenanceDb, 'm-b', 'agent-b', ts)
        insertProvenance(provenanceDb, 'm-c', 'agent-c', ts)

        // Only agent-b has overrides
        insertOverride(overridesDb, 'o1', 'agent-b', '/test/project', ts)
        insertOverride(overridesDb, 'o2', 'agent-b', '/test/project', ts)
        insertOverride(overridesDb, 'o3', 'agent-b', '/test/project', ts)

        const summary = service.getAgentRiskSummary('/test/project')
        const byId = new Map(summary.agents.map((a) => [a.agentId, a]))

        expect(byId.get('agent-a')!.overrideCount).toBe(0)
        expect(byId.get('agent-b')!.overrideCount).toBe(3)
        expect(byId.get('agent-c')!.overrideCount).toBe(0)
    })
})
