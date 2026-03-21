/**
 * Tests for AgentRiskService — AGV.2: Agent Risk Dashboard
 *
 * Tests cover:
 *   - Empty database (no agents, no provenance)
 *   - Single agent with mutations and risk scores
 *   - Multiple agents sorted by risk
 *   - Override count integration
 *   - Period filtering (boundary dates)
 *   - getAgentProfile for existing and missing agents
 *   - Graceful handling of missing tables
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { AgentRiskService } from '../agentRiskService.js'

// ── Test helpers ────────────────────────────────────────────────────────────

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

/** Returns an ISO timestamp N days ago from now. */
function daysAgo(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/** Returns a recent ISO timestamp (within 1 hour). */
function recent(): string {
    return new Date(Date.now() - 30 * 60 * 1000).toISOString()
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('AgentRiskService', () => {
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

    // ── Empty state ─────────────────────────────────────────────────────────

    it('returns empty summary when no provenance records exist', () => {
        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents).toEqual([])
        expect(summary.topRiskiest).toEqual([])
        expect(summary.period).toBe('last_7_days')
    })

    it('returns empty summary when all provenance records are outside the period', () => {
        insertProvenance(provenanceDb, 'm1', 'agent-a', daysAgo(30))
        const summary = service.getAgentRiskSummary('/test/project', 7)
        expect(summary.agents).toEqual([])
    })

    // ── Single agent ────────────────────────────────────────────────────────

    it('returns profile for a single agent with mutations', () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm1', 'agent-a', ts)
        insertProvenance(provenanceDb, 'm2', 'agent-a', ts)
        insertRiskScore(provenanceDb, 'm1', 45, 'medium')
        insertRiskScore(provenanceDb, 'm2', 80, 'critical')

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents).toHaveLength(1)

        const profile = summary.agents[0]
        expect(profile.agentId).toBe('agent-a')
        expect(profile.mutationCount).toBe(2)
        expect(profile.avgRiskScore).toBe(62.5)
        expect(profile.redCount).toBe(1)    // critical
        expect(profile.greenCount).toBe(1)  // medium -> low+medium
        expect(profile.amberCount).toBe(0)
    })

    it('includes override count for agent', () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm1', 'agent-a', ts)
        insertOverride(overridesDb, 'o1', 'agent-a', '/test/project', ts)
        insertOverride(overridesDb, 'o2', 'agent-a', '/test/project', ts)

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents[0].overrideCount).toBe(2)
    })

    it('does not count overrides from different project root', () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm1', 'agent-a', ts)
        insertOverride(overridesDb, 'o1', 'agent-a', '/other/project', ts)

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents[0].overrideCount).toBe(0)
    })

    // ── Multiple agents ─────────────────────────────────────────────────────

    it('sorts agents by avgRiskScore descending', () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm1', 'safe-agent', ts)
        insertProvenance(provenanceDb, 'm2', 'risky-agent', ts)
        insertRiskScore(provenanceDb, 'm1', 10, 'low')
        insertRiskScore(provenanceDb, 'm2', 90, 'critical')

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents).toHaveLength(2)
        expect(summary.agents[0].agentId).toBe('risky-agent')
        expect(summary.agents[1].agentId).toBe('safe-agent')
    })

    it('topRiskiest returns at most 5 agents', () => {
        const ts = recent()
        for (let i = 0; i < 8; i++) {
            insertProvenance(provenanceDb, `m${i}`, `agent-${i}`, ts)
            insertRiskScore(provenanceDb, `m${i}`, 10 + i * 10, i > 5 ? 'critical' : 'low')
        }

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents.length).toBe(8)
        expect(summary.topRiskiest.length).toBe(5)
    })

    // ── Period filtering ────────────────────────────────────────────────────

    it('respects custom periodDays', () => {
        insertProvenance(provenanceDb, 'm1', 'agent-a', daysAgo(5))
        insertProvenance(provenanceDb, 'm2', 'agent-a', daysAgo(2))

        const summary3 = service.getAgentRiskSummary('/test/project', 3)
        expect(summary3.agents).toHaveLength(1)
        expect(summary3.agents[0].mutationCount).toBe(1)  // only m2
        expect(summary3.period).toBe('last_3_days')

        const summary7 = service.getAgentRiskSummary('/test/project', 7)
        expect(summary7.agents[0].mutationCount).toBe(2)
    })

    // ── getAgentProfile ─────────────────────────────────────────────────────

    it('getAgentProfile returns profile for existing agent', () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm1', 'agent-a', ts)
        insertRiskScore(provenanceDb, 'm1', 50, 'medium')

        const profile = service.getAgentProfile('agent-a', '/test/project')
        expect(profile).not.toBeNull()
        expect(profile!.agentId).toBe('agent-a')
        expect(profile!.avgRiskScore).toBe(50)
    })

    it('getAgentProfile returns null for unknown agent', () => {
        const profile = service.getAgentProfile('nonexistent', '/test/project')
        expect(profile).toBeNull()
    })

    // ── Edge cases ──────────────────────────────────────────────────────────

    it('handles agent with provenance but no risk scores', () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm1', 'agent-a', ts)
        // No risk score inserted

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents).toHaveLength(1)
        expect(summary.agents[0].avgRiskScore).toBe(0)
        expect(summary.agents[0].redCount).toBe(0)
        expect(summary.agents[0].amberCount).toBe(0)
        expect(summary.agents[0].greenCount).toBe(0)
    })

    it('ignores provenance records with null agent_id', () => {
        const ts = recent()
        provenanceDb.prepare(`
            INSERT INTO mutation_provenance (mutation_id, timestamp, provenance_source, provenance_agent_id)
            VALUES (?, ?, 'human', NULL)
        `).run('m1', ts)

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents).toEqual([])
    })

    it('reports lastActive timestamp', () => {
        const older = daysAgo(3)
        const newer = daysAgo(1)
        insertProvenance(provenanceDb, 'm1', 'agent-a', older)
        insertProvenance(provenanceDb, 'm2', 'agent-a', newer)

        const summary = service.getAgentRiskSummary('/test/project')
        expect(summary.agents[0].lastActive).toBe(newer)
    })

    // ── Graceful degradation ────────────────────────────────────────────────

    it('returns empty arrays when provenance table does not exist', () => {
        const emptyDb = new BetterSqlite3(':memory:')
        const svc = new AgentRiskService(emptyDb, overridesDb)

        const summary = svc.getAgentRiskSummary('/test/project')
        expect(summary.agents).toEqual([])
        emptyDb.close()
    })

    it('returns empty arrays when overrides table does not exist', () => {
        const ts = recent()
        insertProvenance(provenanceDb, 'm1', 'agent-a', ts)

        const emptyDb = new BetterSqlite3(':memory:')
        const svc = new AgentRiskService(provenanceDb, emptyDb)

        const summary = svc.getAgentRiskSummary('/test/project')
        expect(summary.agents).toHaveLength(1)
        expect(summary.agents[0].overrideCount).toBe(0)
        emptyDb.close()
    })
})
