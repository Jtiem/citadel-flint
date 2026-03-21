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
})
