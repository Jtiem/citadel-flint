/**
 * Unit tests for the DB-backed RiskScoringService class (V.1-rs)
 *
 * Distinct from riskScoringService.test.ts which covers the stateless
 * scoreMutation function. These tests cover the class-based API with
 * SQLite persistence: scoreMutation (class method), scoreBatch,
 * getFileRiskProfile, getProjectRiskSummary, getScore, pruneScores.
 *
 * Uses in-memory SQLite so tests are hermetic and fast.
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { RiskScoringService } from '../riskScoringService.js'
import { MutationLedgerService } from '../mutationLedgerService.js'
import { MutationProvenanceService } from '../mutationProvenanceService.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0

function nextId(): string {
    idCounter += 1
    return `test-mutation-${idCounter.toString().padStart(6, '0')}`
}

function makeAll() {
    const db = new Database(':memory:')
    const riskService = new RiskScoringService(db)
    const ledger = new MutationLedgerService(db)
    const provenance = new MutationProvenanceService(db)
    return { db, riskService, ledger, provenance }
}

/** Insert a ledger entry and optionally provenance, returning the mutation ID. */
function insertMutation(
    ledger: MutationLedgerService,
    provenance: MutationProvenanceService,
    opts: {
        filePath?: string
        operationType?: string
        provenanceSource?: string
        agentId?: string | null
    } = {},
): string {
    const id = nextId()
    const opType = (opts.operationType ?? 'updateClassName') as 'updateClassName'
    ledger.recordMutation({
        id,
        filePath: opts.filePath ?? '/src/components/Button.tsx',
        operationType: opType,
        source: 'mcp_tool',
        metadata: {},
    })
    provenance.recordProvenance(
        id,
        (opts.provenanceSource ?? 'human') as 'human',
        opts.agentId ?? null,
    )
    return id
}

// ---------------------------------------------------------------------------
// Schema initialisation
// ---------------------------------------------------------------------------

describe('RiskScoringService — initialisation', () => {
    it('creates mutation_risk_scores table on construction', () => {
        const { db } = makeAll()
        const row = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mutation_risk_scores'")
            .get() as { name: string } | undefined
        expect(row?.name).toBe('mutation_risk_scores')
    })

    it('creates indexes for tier, scored_at, score', () => {
        const { db } = makeAll()
        const rows = db
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='mutation_risk_scores'")
            .all() as Array<{ name: string }>
        const names = rows.map((r) => r.name)
        expect(names).toContain('idx_risk_tier')
        expect(names).toContain('idx_risk_scored_at')
        expect(names).toContain('idx_risk_score')
    })
})

// ---------------------------------------------------------------------------
// scoreMutation (class method)
// ---------------------------------------------------------------------------

describe('RiskScoringService.scoreMutation', () => {
    it('returns a valid RiskScore for a known mutation', () => {
        const { riskService, ledger, provenance } = makeAll()
        const id = insertMutation(ledger, provenance)

        const result = riskService.scoreMutation(id)
        expect(result).not.toBeNull()
        expect(result!.mutationId).toBe(id)
        expect(result!.score).toBeGreaterThanOrEqual(0)
        expect(result!.score).toBeLessThanOrEqual(100)
        expect(['low', 'medium', 'high', 'critical']).toContain(result!.tier)
        expect(result!.factors).toHaveLength(5)
        expect(typeof result!.scoredAt).toBe('string')
    })

    it('returns null for a non-existent mutation ID', () => {
        const { riskService } = makeAll()
        const result = riskService.scoreMutation('nonexistent-id-xyz')
        expect(result).toBeNull()
    })

    it('persists the score to the database', () => {
        const { db, riskService, ledger, provenance } = makeAll()
        const id = insertMutation(ledger, provenance)

        riskService.scoreMutation(id)

        const row = db
            .prepare('SELECT * FROM mutation_risk_scores WHERE mutation_id = ?')
            .get(id) as Record<string, unknown> | undefined
        expect(row).toBeDefined()
        expect(row!.mutation_id).toBe(id)
        expect(typeof row!.score).toBe('number')
    })

    it('upserts on re-score (INSERT OR REPLACE)', () => {
        const { db, riskService, ledger, provenance } = makeAll()
        const id = insertMutation(ledger, provenance)

        riskService.scoreMutation(id)
        riskService.scoreMutation(id)

        const count = (db
            .prepare('SELECT COUNT(*) AS cnt FROM mutation_risk_scores WHERE mutation_id = ?')
            .get(id) as { cnt: number }).cnt
        expect(count).toBe(1)
    })

    it('agent provenance scores higher than human provenance', () => {
        const { riskService, ledger, provenance } = makeAll()
        const humanId = insertMutation(ledger, provenance, { provenanceSource: 'human' })
        const agentId = insertMutation(ledger, provenance, { provenanceSource: 'agent' })

        const humanScore = riskService.scoreMutation(humanId)!.score
        const agentScore = riskService.scoreMutation(agentId)!.score
        expect(agentScore).toBeGreaterThan(humanScore)
    })

    it('deleteNode scores higher than updateClassName', () => {
        const { riskService, ledger, provenance } = makeAll()
        const updateId = insertMutation(ledger, provenance, { operationType: 'updateClassName' })
        const deleteId = insertMutation(ledger, provenance, { operationType: 'deleteNode' })

        const updateScore = riskService.scoreMutation(updateId)!.score
        const deleteScore = riskService.scoreMutation(deleteId)!.score
        expect(deleteScore).toBeGreaterThan(updateScore)
    })

    it('violation context increases the score', () => {
        const { riskService, ledger, provenance } = makeAll()
        const id1 = insertMutation(ledger, provenance)
        const id2 = insertMutation(ledger, provenance)

        const noViolation = riskService.scoreMutation(id1, {})!.score
        const withViolation = riskService.scoreMutation(id2, {
            violationCount: 3,
            hasCritical: true,
        })!.score
        expect(withViolation).toBeGreaterThan(noViolation)
    })

    it('wasAutoFixedFromCritical gives the highest violation score', () => {
        const { riskService, ledger, provenance } = makeAll()
        const id1 = insertMutation(ledger, provenance)
        const id2 = insertMutation(ledger, provenance)

        const critical = riskService.scoreMutation(id1, {
            violationCount: 1,
            hasCritical: true,
        })!.score
        const autoFixed = riskService.scoreMutation(id2, {
            wasAutoFixedFromCritical: true,
        })!.score
        expect(autoFixed).toBeGreaterThan(critical)
    })
})

// ---------------------------------------------------------------------------
// scoreBatch
// ---------------------------------------------------------------------------

describe('RiskScoringService.scoreBatch', () => {
    it('scores multiple mutations in a single call', () => {
        const { riskService, ledger, provenance } = makeAll()
        const ids = Array.from({ length: 5 }, () => insertMutation(ledger, provenance))

        const results = riskService.scoreBatch(ids)
        expect(results).toHaveLength(5)
        for (const result of results) {
            expect(result.score).toBeGreaterThanOrEqual(0)
            expect(result.score).toBeLessThanOrEqual(100)
        }
    })

    it('skips mutations that do not exist in ledger', () => {
        const { riskService, ledger, provenance } = makeAll()
        const realId = insertMutation(ledger, provenance)
        const results = riskService.scoreBatch([realId, 'fake-id-123'])
        expect(results).toHaveLength(1)
        expect(results[0].mutationId).toBe(realId)
    })

    it('returns empty array for empty input', () => {
        const { riskService } = makeAll()
        const results = riskService.scoreBatch([])
        expect(results).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// getFileRiskProfile
// ---------------------------------------------------------------------------

describe('RiskScoringService.getFileRiskProfile', () => {
    it('returns null for a file with no scored mutations', () => {
        const { riskService } = makeAll()
        const profile = riskService.getFileRiskProfile('/nonexistent/file.tsx')
        expect(profile).toBeNull()
    })

    it('returns correct profile for a file with scored mutations', () => {
        const { riskService, ledger, provenance } = makeAll()
        const filePath = '/src/components/Card.tsx'

        // Insert and score 3 mutations for this file
        for (let i = 0; i < 3; i++) {
            const id = insertMutation(ledger, provenance, { filePath })
            riskService.scoreMutation(id)
        }

        const profile = riskService.getFileRiskProfile(filePath)
        expect(profile).not.toBeNull()
        expect(profile!.filePath).toBe(filePath)
        expect(profile!.mutationCount).toBe(3)
        expect(profile!.meanScore).toBeGreaterThanOrEqual(0)
        expect(profile!.maxScore).toBeGreaterThanOrEqual(profile!.meanScore)
        expect(['rising', 'falling', 'stable']).toContain(profile!.trend)
    })

    it('trend is stable when all scores are the same', () => {
        const { riskService, ledger, provenance } = makeAll()
        const filePath = '/src/components/Stable.tsx'

        // Insert 6 identical mutations (need >= 4 for trend detection)
        for (let i = 0; i < 6; i++) {
            const id = insertMutation(ledger, provenance, { filePath })
            riskService.scoreMutation(id)
        }

        const profile = riskService.getFileRiskProfile(filePath)
        expect(profile!.trend).toBe('stable')
    })
})

// ---------------------------------------------------------------------------
// getProjectRiskSummary
// ---------------------------------------------------------------------------

describe('RiskScoringService.getProjectRiskSummary', () => {
    it('returns zeroed summary when no mutations have been scored', () => {
        const { riskService } = makeAll()
        const summary = riskService.getProjectRiskSummary()
        expect(summary.totalScored).toBe(0)
        expect(summary.distribution.low).toBe(0)
        expect(summary.distribution.medium).toBe(0)
        expect(summary.distribution.high).toBe(0)
        expect(summary.distribution.critical).toBe(0)
        expect(summary.riskiestFiles).toHaveLength(0)
        expect(summary.riskiestAgents).toHaveLength(0)
    })

    it('returns correct counts after scoring mutations', () => {
        const { riskService, ledger, provenance } = makeAll()

        // Insert and score 3 mutations
        for (let i = 0; i < 3; i++) {
            const id = insertMutation(ledger, provenance)
            riskService.scoreMutation(id)
        }

        const summary = riskService.getProjectRiskSummary()
        expect(summary.totalScored).toBe(3)
        const total =
            summary.distribution.low +
            summary.distribution.medium +
            summary.distribution.high +
            summary.distribution.critical
        expect(total).toBe(3)
    })

    it('riskiestFiles returns up to 5 files sorted by mean score', () => {
        const { riskService, ledger, provenance } = makeAll()

        // Create mutations across 3 different files
        const files = ['/a.tsx', '/b.tsx', '/c.tsx']
        for (const filePath of files) {
            const id = insertMutation(ledger, provenance, { filePath })
            riskService.scoreMutation(id)
        }

        const summary = riskService.getProjectRiskSummary()
        expect(summary.riskiestFiles.length).toBeGreaterThan(0)
        expect(summary.riskiestFiles.length).toBeLessThanOrEqual(5)
        for (const file of summary.riskiestFiles) {
            expect(typeof file.filePath).toBe('string')
            expect(typeof file.meanScore).toBe('number')
        }
    })

    it('riskiestAgents includes agent provenance entries', () => {
        const { riskService, ledger, provenance } = makeAll()

        // Insert mutations with agent provenance
        for (let i = 0; i < 2; i++) {
            const id = insertMutation(ledger, provenance, {
                filePath: '/src/components/AgentTest.tsx',
                operationType: 'insertNode',
                provenanceSource: 'agent',
                agentId: 'test-agent-001',
            })
            riskService.scoreMutation(id)
        }

        const summary = riskService.getProjectRiskSummary()
        expect(summary.riskiestAgents.length).toBeGreaterThanOrEqual(1)
        expect(summary.riskiestAgents[0].agentId).toBe('test-agent-001')
    })
})

// ---------------------------------------------------------------------------
// getScore — retrieve persisted score
// ---------------------------------------------------------------------------

describe('RiskScoringService.getScore', () => {
    it('returns null for a never-scored mutation', () => {
        const { riskService } = makeAll()
        expect(riskService.getScore('never-scored-id')).toBeNull()
    })

    it('returns the persisted score after scoring', () => {
        const { riskService, ledger, provenance } = makeAll()
        const id = insertMutation(ledger, provenance)

        const original = riskService.scoreMutation(id)!
        const retrieved = riskService.getScore(id)!

        expect(retrieved.mutationId).toBe(id)
        expect(retrieved.score).toBe(original.score)
        expect(retrieved.tier).toBe(original.tier)
        expect(retrieved.factors).toHaveLength(5)
    })
})

// ---------------------------------------------------------------------------
// pruneScores
// ---------------------------------------------------------------------------

describe('RiskScoringService.pruneScores', () => {
    it('removes scores older than the given timestamp', () => {
        const { riskService, ledger, provenance } = makeAll()
        const id = insertMutation(ledger, provenance)
        riskService.scoreMutation(id)

        // Prune everything older than future date
        const futureDate = new Date(Date.now() + 60_000).toISOString()
        const deleted = riskService.pruneScores(futureDate)
        expect(deleted).toBe(1)
        expect(riskService.getScore(id)).toBeNull()
    })

    it('does not remove scores newer than the given timestamp', () => {
        const { riskService, ledger, provenance } = makeAll()
        const id = insertMutation(ledger, provenance)
        riskService.scoreMutation(id)

        // Prune with a past date — nothing should be deleted
        const pastDate = new Date(Date.now() - 60_000).toISOString()
        const deleted = riskService.pruneScores(pastDate)
        expect(deleted).toBe(0)
        expect(riskService.getScore(id)).not.toBeNull()
    })

    it('returns 0 when no scores exist', () => {
        const { riskService } = makeAll()
        const deleted = riskService.pruneScores(new Date().toISOString())
        expect(deleted).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// getRiskTier — boundary values on the 0-100 scale
// ---------------------------------------------------------------------------

describe('RiskScoringService.getRiskTier', () => {
    it('0 → low', () => {
        const { riskService } = makeAll()
        expect(riskService.getRiskTier(0)).toBe('low')
    })

    it('25 → low', () => {
        const { riskService } = makeAll()
        expect(riskService.getRiskTier(25)).toBe('low')
    })

    it('26 → medium', () => {
        const { riskService } = makeAll()
        expect(riskService.getRiskTier(26)).toBe('medium')
    })

    it('50 → medium', () => {
        const { riskService } = makeAll()
        expect(riskService.getRiskTier(50)).toBe('medium')
    })

    it('51 → high', () => {
        const { riskService } = makeAll()
        expect(riskService.getRiskTier(51)).toBe('high')
    })

    it('75 → high', () => {
        const { riskService } = makeAll()
        expect(riskService.getRiskTier(75)).toBe('high')
    })

    it('76 → critical', () => {
        const { riskService } = makeAll()
        expect(riskService.getRiskTier(76)).toBe('critical')
    })

    it('100 → critical', () => {
        const { riskService } = makeAll()
        expect(riskService.getRiskTier(100)).toBe('critical')
    })
})
