/**
 * Tests for TrustTierService — AGV.4: Dynamic Agent Trust Tiers
 *
 * Tests cover:
 *   - New agent starts at restricted
 *   - Promotion after qualifying sessions
 *   - Demotion on escalation
 *   - Demotion to restricted on 3+ red mutations
 *   - Manual promotion works (including to admin)
 *   - Reset returns to restricted
 *   - Admin tier requires manual promotion only
 *   - listAll ordering
 *   - Edge cases: double promotion, promote already-admin, reset unknown agent
 */

import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'
import { TrustTierService } from '../trustTierService.js'
import type { SessionStats } from '../trustTierService.js'
import type { PromotionGates } from '../../config.js'

let db: Database.Database
let svc: TrustTierService

beforeEach(() => {
    db = new BetterSqlite3(':memory:')
    svc = new TrustTierService(db)
})

describe('TrustTierService', () => {
    // ── New agent starts at restricted ───────────────────────────────────────

    it('new agent starts at restricted tier', () => {
        const profile = svc.getAgentTrustProfile('agent-001')
        expect(profile.currentTier).toBe('restricted')
        expect(profile.sessionCount).toBe(0)
        expect(profile.redMutationCount).toBe(0)
        expect(profile.overrideCount).toBe(0)
        expect(profile.escalationCount).toBe(0)
    })

    it('getAgentTrustProfile is idempotent', () => {
        svc.getAgentTrustProfile('agent-001')
        const profile = svc.getAgentTrustProfile('agent-001')
        expect(profile.currentTier).toBe('restricted')
    })

    // ── Promotion after qualifying sessions ──────────────────────────────────

    it('promotes restricted -> standard after 3 clean sessions', () => {
        const clean: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: false }

        for (let i = 0; i < 3; i++) {
            svc.recordSessionEnd('agent-001', clean)
        }

        const profile = svc.getAgentTrustProfile('agent-001')
        expect(profile.currentTier).toBe('standard')
        expect(profile.sessionCount).toBe(3)
        expect(profile.promotedAt).not.toBeNull()
    })

    it('does NOT promote restricted -> standard with overrides', () => {
        const withOverride: SessionStats = { redMutationCount: 0, overrideCount: 1, escalationTriggered: false }
        const clean: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: false }

        svc.recordSessionEnd('agent-001', withOverride)
        svc.recordSessionEnd('agent-001', clean)
        svc.recordSessionEnd('agent-001', clean)

        const profile = svc.getAgentTrustProfile('agent-001')
        expect(profile.currentTier).toBe('restricted')
        expect(profile.overrideCount).toBe(1)
    })

    it('promotes standard -> elevated after 10 clean sessions', () => {
        const clean: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: false }

        // First get to standard (3 sessions)
        for (let i = 0; i < 3; i++) {
            svc.recordSessionEnd('agent-001', clean)
        }
        expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')

        // Then 7 more to reach 10 total
        for (let i = 0; i < 7; i++) {
            svc.recordSessionEnd('agent-001', clean)
        }

        const profile = svc.getAgentTrustProfile('agent-001')
        expect(profile.currentTier).toBe('elevated')
        expect(profile.sessionCount).toBe(10)
    })

    it('does NOT auto-promote elevated -> admin', () => {
        const clean: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: false }

        // Get to elevated
        for (let i = 0; i < 10; i++) {
            svc.recordSessionEnd('agent-001', clean)
        }
        expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('elevated')

        // Many more clean sessions
        for (let i = 0; i < 50; i++) {
            svc.recordSessionEnd('agent-001', clean)
        }

        expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('elevated')
    })

    // ── Demotion ─────────────────────────────────────────────────────────────

    it('demotes one tier on escalation trigger', () => {
        // Get agent to standard first
        const clean: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: false }
        for (let i = 0; i < 3; i++) {
            svc.recordSessionEnd('agent-001', clean)
        }
        expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')

        // Escalation -> demote to restricted
        const escalation: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: true }
        svc.recordSessionEnd('agent-001', escalation)

        const profile = svc.getAgentTrustProfile('agent-001')
        expect(profile.currentTier).toBe('restricted')
        expect(profile.demotedAt).not.toBeNull()
        expect(profile.escalationCount).toBe(1)
    })

    it('demotes to restricted on 3+ red mutations in a session', () => {
        // Get to elevated
        const clean: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: false }
        for (let i = 0; i < 10; i++) {
            svc.recordSessionEnd('agent-001', clean)
        }
        expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('elevated')

        // 3 red mutations -> straight to restricted
        const redSession: SessionStats = { redMutationCount: 3, overrideCount: 0, escalationTriggered: false }
        svc.recordSessionEnd('agent-001', redSession)

        expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('restricted')
    })

    it('does not demote below restricted', () => {
        const escalation: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: true }
        svc.recordSessionEnd('agent-001', escalation)

        expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('restricted')
    })

    // ── Manual promotion ─────────────────────────────────────────────────────

    it('manual promote to admin works', () => {
        const profile = svc.manualPromote('agent-001', 'admin')
        expect(profile.currentTier).toBe('admin')
        expect(profile.promotedAt).not.toBeNull()
    })

    it('manual promote to same or lower tier is a no-op', () => {
        svc.manualPromote('agent-001', 'standard')
        const profile = svc.manualPromote('agent-001', 'restricted')
        expect(profile.currentTier).toBe('standard')
    })

    it('manual promote skips tiers', () => {
        const profile = svc.manualPromote('agent-001', 'elevated')
        expect(profile.currentTier).toBe('elevated')
    })

    // ── Reset ────────────────────────────────────────────────────────────────

    it('reset returns to restricted with zeroed counters', () => {
        const clean: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: false }
        for (let i = 0; i < 3; i++) {
            svc.recordSessionEnd('agent-001', clean)
        }
        expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')

        const profile = svc.resetTrust('agent-001')
        expect(profile.currentTier).toBe('restricted')
        expect(profile.sessionCount).toBe(0)
        expect(profile.redMutationCount).toBe(0)
        expect(profile.overrideCount).toBe(0)
        expect(profile.escalationCount).toBe(0)
    })

    it('reset on unknown agent creates it at restricted', () => {
        const profile = svc.resetTrust('never-seen')
        expect(profile.currentTier).toBe('restricted')
        expect(profile.agentId).toBe('never-seen')
    })

    // ── listAll ──────────────────────────────────────────────────────────────

    it('listAll returns agents ordered by tier then session count', () => {
        svc.manualPromote('admin-agent', 'admin')
        svc.manualPromote('elevated-agent', 'elevated')
        svc.getAgentTrustProfile('restricted-agent')

        const all = svc.listAll()
        expect(all.length).toBe(3)
        expect(all[0].agentId).toBe('admin-agent')
        expect(all[1].agentId).toBe('elevated-agent')
        expect(all[2].agentId).toBe('restricted-agent')
    })

    it('listAll on empty table returns empty array', () => {
        expect(svc.listAll()).toEqual([])
    })

    // ── evaluatePromotion standalone ─────────────────────────────────────────

    it('evaluatePromotion returns current tier when not eligible', () => {
        svc.getAgentTrustProfile('agent-001')
        expect(svc.evaluatePromotion('agent-001')).toBe('restricted')
    })

    // ── evaluateDemotion standalone ──────────────────────────────────────────

    it('evaluateDemotion with clean stats is a no-op', () => {
        svc.manualPromote('agent-001', 'elevated')
        const tier = svc.evaluateDemotion('agent-001', { redMutationCount: 0, overrideCount: 0, escalationTriggered: false })
        expect(tier).toBe('elevated')
    })

    // ── Session counter accumulation ─────────────────────────────────────────

    it('accumulates counters across sessions', () => {
        svc.recordSessionEnd('agent-001', { redMutationCount: 1, overrideCount: 2, escalationTriggered: false })
        svc.recordSessionEnd('agent-001', { redMutationCount: 1, overrideCount: 1, escalationTriggered: false })

        const profile = svc.getAgentTrustProfile('agent-001')
        expect(profile.sessionCount).toBe(2)
        expect(profile.redMutationCount).toBe(2)
        expect(profile.overrideCount).toBe(3)
    })

    // ── PromotionGates — Gap 4 ────────────────────────────────────────────────

    describe('PromotionGates (Gap 4)', () => {
        const clean: SessionStats = { redMutationCount: 0, overrideCount: 0, escalationTriggered: false }

        it('uses default threshold (3) when no gates provided for restricted→standard', () => {
            for (let i = 0; i < 3; i++) svc.recordSessionEnd('agent-001', clean)
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')
        })

        it('custom clean_sessions threshold is respected for restricted→standard', () => {
            const gates: PromotionGates = { clean_sessions: 5 }
            // 3 sessions with gates requiring 5 — should NOT promote
            for (let i = 0; i < 3; i++) svc.recordSessionEnd('agent-001', clean, gates)
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('restricted')

            // 2 more — now at 5 — should promote
            for (let i = 0; i < 2; i++) svc.recordSessionEnd('agent-001', clean, gates)
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')
        })

        it('custom clean_sessions = 1 promotes after just 1 clean session', () => {
            const gates: PromotionGates = { clean_sessions: 1 }
            svc.recordSessionEnd('agent-001', clean, gates)
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')
        })

        it('custom clean_sessions threshold is respected for standard→elevated', () => {
            // Manually promote to standard first
            svc.manualPromote('agent-001', 'standard')
            const gates: PromotionGates = { clean_sessions: 5 }

            // 4 sessions — should NOT promote (need 5)
            for (let i = 0; i < 4; i++) svc.recordSessionEnd('agent-001', clean, gates)
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')

            // 1 more — now at 5 total sessions — should promote
            svc.recordSessionEnd('agent-001', clean, gates)
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('elevated')
        })

        it('default threshold (10) used for standard→elevated when no gates provided', () => {
            // Get to standard first
            for (let i = 0; i < 3; i++) svc.recordSessionEnd('agent-001', clean)
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')

            // 6 more sessions (9 total) — should NOT promote (need 10)
            for (let i = 0; i < 6; i++) svc.recordSessionEnd('agent-001', clean)
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')

            // 1 more (10 total) — should promote
            svc.recordSessionEnd('agent-001', clean)
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('elevated')
        })

        it('security_validation: true is a no-op placeholder (promotion proceeds normally)', () => {
            const gates: PromotionGates = { security_validation: true, clean_sessions: 3 }
            for (let i = 0; i < 3; i++) svc.recordSessionEnd('agent-001', clean, gates)
            // Should still promote — security_validation is a no-op pending real implementation
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')
        })

        it('governance_signoff: true is a no-op placeholder (promotion proceeds normally)', () => {
            const gates: PromotionGates = { governance_signoff: true, clean_sessions: 3 }
            for (let i = 0; i < 3; i++) svc.recordSessionEnd('agent-001', clean, gates)
            // Should still promote — governance_signoff is a no-op pending real implementation
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('standard')
        })

        it('evaluatePromotion directly with custom gates respects threshold', () => {
            // Manually get 3 sessions recorded without promotion
            // (by adding overrides so auto-promotion is blocked)
            const withOverride: SessionStats = { redMutationCount: 0, overrideCount: 1, escalationTriggered: false }
            for (let i = 0; i < 3; i++) svc.recordSessionEnd('agent-001', withOverride)
            // Override count is non-zero — no promotion regardless of sessions
            expect(svc.getAgentTrustProfile('agent-001').currentTier).toBe('restricted')

            // Call evaluatePromotion directly — still restricted because overrideCount > 0
            const gates: PromotionGates = { clean_sessions: 3 }
            const tier = svc.evaluatePromotion('agent-001', gates)
            expect(tier).toBe('restricted')
        })

        it('evaluatePromotion with no gates returns current tier when not yet eligible', () => {
            svc.getAgentTrustProfile('agent-001')
            // 0 sessions — not eligible even with no gates (default is 3)
            expect(svc.evaluatePromotion('agent-001')).toBe('restricted')
        })
    })
})
