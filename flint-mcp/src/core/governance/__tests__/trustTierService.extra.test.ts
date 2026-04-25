/**
 * trustTierService.extra.test.ts — Coverage backfill for AGV.4
 *
 * Companion to trustTier.test.ts. Adds tests for public-API surface that the
 * primary file does not exercise:
 *
 *   - manualDemote: happy path, no-op at restricted, multi-step demotion
 *   - sliding-window promotion: historical reds outside window do not block
 *     promotion (MAJOR-8 fix in trustTierService.ts)
 *   - evaluatePromotion: no-op when sessionCount below threshold
 *   - evaluateDemotion: standalone red-mutation path (no escalation flag)
 *   - getAgentTrustProfile: idempotent record creation (single row only)
 *
 * Hermetic: in-memory SQLite, no disk artefacts.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { TrustTierService } from '../trustTierService.js'
import type { SessionStats } from '../trustTierService.js'

let db: Database.Database
let svc: TrustTierService

const clean: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: false }

beforeEach(() => {
    db = new BetterSqlite3(':memory:')
    svc = new TrustTierService(db)
})

// ---------------------------------------------------------------------------
// manualDemote
// ---------------------------------------------------------------------------

describe('TrustTierService — manualDemote', () => {
    it('demotes one tier from elevated -> standard', () => {
        svc.manualPromote('agent-001', 'elevated')
        const profile = svc.manualDemote('agent-001')
        expect(profile.currentTier).toBe('standard')
        expect(profile.demotedAt).not.toBeNull()
    })

    it('demotes one tier from admin -> elevated', () => {
        svc.manualPromote('agent-001', 'admin')
        const profile = svc.manualDemote('agent-001')
        expect(profile.currentTier).toBe('elevated')
    })

    it('is a no-op when already at restricted', () => {
        const profile = svc.manualDemote('agent-001')
        expect(profile.currentTier).toBe('restricted')
        expect(profile.demotedAt).toBeNull()
    })

    it('demotes step-by-step (admin -> elevated -> standard -> restricted)', () => {
        svc.manualPromote('agent-001', 'admin')
        expect(svc.manualDemote('agent-001').currentTier).toBe('elevated')
        expect(svc.manualDemote('agent-001').currentTier).toBe('standard')
        expect(svc.manualDemote('agent-001').currentTier).toBe('restricted')
        // Further demotion is a no-op
        expect(svc.manualDemote('agent-001').currentTier).toBe('restricted')
    })

    it('creates the agent at restricted when demoting an unknown id', () => {
        const profile = svc.manualDemote('never-seen')
        expect(profile.currentTier).toBe('restricted')
        expect(profile.agentId).toBe('never-seen')
    })
})

// ---------------------------------------------------------------------------
// Sliding-window promotion (MAJOR-8 fix in trustTierService.ts)
// ---------------------------------------------------------------------------

describe('TrustTierService — sliding-window promotion', () => {
    it('promotes when a historical red mutation is older than 30 days', () => {
        // Backdate a red mutation to 60 days ago by writing the row directly.
        const oldTs = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        const now = new Date().toISOString()
        db.prepare(`
            INSERT INTO agent_trust (
                agent_id, current_tier, session_count,
                red_mutation_count, override_count, escalation_count,
                last_red_at, created_at, updated_at
            ) VALUES (?, 'restricted', 3, 1, 0, 0, ?, ?, ?)
        `).run('agent-historic-red', oldTs, now, now)

        const newTier = svc.evaluatePromotion('agent-historic-red')
        // Historical red >30d ago should NOT block promotion.
        expect(newTier).toBe('standard')
    })

    it('does NOT promote when a recent red is within the 30-day window', () => {
        const recentTs = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        const now = new Date().toISOString()
        db.prepare(`
            INSERT INTO agent_trust (
                agent_id, current_tier, session_count,
                red_mutation_count, override_count, escalation_count,
                last_red_at, created_at, updated_at
            ) VALUES (?, 'restricted', 5, 1, 0, 0, ?, ?, ?)
        `).run('agent-recent-red', recentTs, now, now)

        const newTier = svc.evaluatePromotion('agent-recent-red')
        expect(newTier).toBe('restricted')
    })
})

// ---------------------------------------------------------------------------
// evaluatePromotion / evaluateDemotion edge cases
// ---------------------------------------------------------------------------

describe('TrustTierService — evaluate* edge cases', () => {
    it('evaluatePromotion does not advance when sessionCount is below threshold', () => {
        // 2 clean sessions — below default threshold of 3
        for (let i = 0; i < 2; i++) svc.recordSessionEnd('agent-001', clean)
        expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('restricted')
        expect(svc.evaluatePromotion('agent-001')).toBe('restricted')
    })

    it('evaluateDemotion: 3+ red mutations forces restricted regardless of escalation flag', () => {
        svc.manualPromote('agent-001', 'elevated')
        const stats: SessionStats = { redMutationCount: 5, overrideCount: 0, escalationTriggered: false }
        const tier = svc.evaluateDemotion('agent-001', stats)
        expect(tier).toBe('restricted')
    })

    it('evaluateDemotion: agent already at restricted with 3+ reds stays at restricted', () => {
        const stats: SessionStats = { redMutationCount: 3, overrideCount: 0, escalationTriggered: false }
        const tier = svc.evaluateDemotion('agent-001', stats)
        expect(tier).toBe('restricted')
    })
})

// ---------------------------------------------------------------------------
// getAgentTrustProfile — idempotency
// ---------------------------------------------------------------------------

describe('TrustTierService — getAgentTrustProfile idempotency', () => {
    it('does not create duplicate rows when called repeatedly', () => {
        svc.getAgentTrustProfile('agent-001')
        svc.getAgentTrustProfile('agent-001')
        svc.getAgentTrustProfile('agent-001')

        const rows = db.prepare(
            'SELECT COUNT(*) as cnt FROM agent_trust WHERE agent_id = ?',
        ).get('agent-001') as { cnt: number }
        expect(rows.cnt).toBe(1)
    })

    it('preserves counters across repeated profile lookups', () => {
        svc.recordSessionEnd('agent-001', { redMutationCount: 2, overrideCount: 1, escalationTriggered: false })

        const a = svc.getAgentTrustProfile('agent-001')
        const b = svc.getAgentTrustProfile('agent-001')

        expect(a.redMutationCount).toBe(2)
        expect(b.redMutationCount).toBe(2)
        expect(a.sessionCount).toBe(1)
        expect(b.sessionCount).toBe(1)
    })
})
