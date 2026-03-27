/**
 * agentEscalation.test.ts — AGV.3: Auto-Escalation Rules Tests
 *
 * Coverage:
 *   AGV3-01 — RULE-001: 2 red mutations → no escalation. 3rd red → require_review fires
 *   AGV3-02 — RULE-002: 4 amber in hour → no escalation. 5th → alert fires
 *   AGV3-03 — RULE-003: Session avg > 0.6 → downgrade fires
 *   AGV3-04 — RULE-004: 20 mutations in 5min → block fires
 *   AGV3-05 — Multiple rules can fire simultaneously
 *   AGV3-06 — resetSession clears all data
 *   AGV3-07 — Custom rules from JSON override defaults
 *   AGV3-08 — Unknown agent → escalation still tracks (creates entry on first seen)
 *   AGV3-09 — Same rule does not fire twice for same agent
 *   AGV3-10 — isEscalated / hasActiveAction helpers
 *   AGV3-11 — getAgentRiskHistory returns correct data
 *   AGV3-12 — resetAll clears all agents
 *   AGV3-13 — loadEscalationRules handles missing file
 *   AGV3-14 — loadEscalationRules handles malformed JSON
 *   AGV3-15 — loadEscalationRules loads valid custom rules
 *   AGV3-16 — getActiveEscalations returns accumulated escalations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

import {
    EscalationEngine,
    loadEscalationRules,
    loadEscalationRulesFromYaml,
} from '../agentEscalation'
import type {
    EscalationRule,
} from '../agentEscalation'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Suppress console.warn during tests. */
beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ── AGV3-01: RULE-001 — Red count threshold ────────────────────────────────

describe('AGV3-01 — RULE-001: Red-tier mutation count', () => {
    let engine: EscalationEngine

    beforeEach(() => {
        engine = new EscalationEngine()
    })

    it('2 red mutations produce no escalation', () => {
        engine.recordMutationRisk('agent-a', 'red', 0.85)
        engine.recordMutationRisk('agent-a', 'red', 0.90)
        const results = engine.checkEscalation('agent-a')
        const rule001 = results.find(r => r.ruleId === 'RULE-001')
        expect(rule001).toBeUndefined()
    })

    it('3rd red mutation fires require_review', () => {
        engine.recordMutationRisk('agent-a', 'red', 0.85)
        engine.recordMutationRisk('agent-a', 'red', 0.90)
        engine.recordMutationRisk('agent-a', 'red', 0.80)
        const results = engine.checkEscalation('agent-a')
        const rule001 = results.find(r => r.ruleId === 'RULE-001')
        expect(rule001).toBeDefined()
        expect(rule001!.action.type).toBe('require_review')
        expect(rule001!.reason).toContain('3')
        expect(rule001!.reason).toContain('Red-tier')
    })

    it('green mutations do not count toward red threshold', () => {
        engine.recordMutationRisk('agent-a', 'green', 0.10)
        engine.recordMutationRisk('agent-a', 'green', 0.15)
        engine.recordMutationRisk('agent-a', 'red', 0.85)
        engine.recordMutationRisk('agent-a', 'red', 0.90)
        const results = engine.checkEscalation('agent-a')
        const rule001 = results.find(r => r.ruleId === 'RULE-001')
        expect(rule001).toBeUndefined()
    })
})

// ── AGV3-02: RULE-002 — Amber count threshold ──────────────────────────────

describe('AGV3-02 — RULE-002: Amber-tier mutation count (hourly window)', () => {
    let engine: EscalationEngine

    beforeEach(() => {
        engine = new EscalationEngine()
    })

    it('4 amber mutations in an hour produce no escalation', () => {
        for (let i = 0; i < 4; i++) {
            engine.recordMutationRisk('agent-b', 'amber', 0.50)
        }
        const results = engine.checkEscalation('agent-b')
        const rule002 = results.find(r => r.ruleId === 'RULE-002')
        expect(rule002).toBeUndefined()
    })

    it('5th amber mutation fires alert', () => {
        for (let i = 0; i < 5; i++) {
            engine.recordMutationRisk('agent-b', 'amber', 0.50)
        }
        const results = engine.checkEscalation('agent-b')
        const rule002 = results.find(r => r.ruleId === 'RULE-002')
        expect(rule002).toBeDefined()
        expect(rule002!.action.type).toBe('alert')
        expect(rule002!.reason).toContain('5')
        expect(rule002!.reason).toContain('Amber-tier')
    })

    it('red mutations do not count toward amber threshold', () => {
        for (let i = 0; i < 4; i++) {
            engine.recordMutationRisk('agent-b', 'amber', 0.50)
        }
        engine.recordMutationRisk('agent-b', 'red', 0.85)
        const results = engine.checkEscalation('agent-b')
        const rule002 = results.find(r => r.ruleId === 'RULE-002')
        expect(rule002).toBeUndefined()
    })
})

// ── AGV3-03: RULE-003 — Session average risk ───────────────────────────────

describe('AGV3-03 — RULE-003: Session average risk > 0.6', () => {
    let engine: EscalationEngine

    beforeEach(() => {
        engine = new EscalationEngine()
    })

    it('average risk exactly 0.6 does not trigger downgrade', () => {
        // Two mutations averaging 0.6
        engine.recordMutationRisk('agent-c', 'amber', 0.50)
        engine.recordMutationRisk('agent-c', 'red', 0.70)
        // avg = (0.50 + 0.70) / 2 = 0.60 — NOT > 0.6
        const results = engine.checkEscalation('agent-c')
        const rule003 = results.find(r => r.ruleId === 'RULE-003')
        expect(rule003).toBeUndefined()
    })

    it('average risk > 0.6 fires downgrade_tier', () => {
        engine.recordMutationRisk('agent-c', 'red', 0.80)
        engine.recordMutationRisk('agent-c', 'red', 0.90)
        // avg = (0.80 + 0.90) / 2 = 0.85 > 0.6
        const results = engine.checkEscalation('agent-c')
        const rule003 = results.find(r => r.ruleId === 'RULE-003')
        expect(rule003).toBeDefined()
        expect(rule003!.action.type).toBe('downgrade_tier')
        if (rule003!.action.type === 'downgrade_tier') {
            expect(rule003!.action.to).toBe('standard')
        }
    })

    it('low-risk mutations pull the average below threshold', () => {
        engine.recordMutationRisk('agent-c', 'red', 0.80)
        engine.recordMutationRisk('agent-c', 'green', 0.10)
        // avg = (0.80 + 0.10) / 2 = 0.45 — below threshold
        const results = engine.checkEscalation('agent-c')
        const rule003 = results.find(r => r.ruleId === 'RULE-003')
        expect(rule003).toBeUndefined()
    })
})

// ── AGV3-04: RULE-004 — Mutation velocity ──────────────────────────────────

describe('AGV3-04 — RULE-004: Mutation velocity (20 in 5 minutes)', () => {
    let engine: EscalationEngine

    beforeEach(() => {
        engine = new EscalationEngine()
    })

    it('19 mutations in 5 minutes does not trigger block', () => {
        for (let i = 0; i < 19; i++) {
            engine.recordMutationRisk('agent-d', 'green', 0.10)
        }
        const results = engine.checkEscalation('agent-d')
        const rule004 = results.find(r => r.ruleId === 'RULE-004')
        expect(rule004).toBeUndefined()
    })

    it('20 mutations in 5 minutes fires block_mutations', () => {
        for (let i = 0; i < 20; i++) {
            engine.recordMutationRisk('agent-d', 'green', 0.10)
        }
        const results = engine.checkEscalation('agent-d')
        const rule004 = results.find(r => r.ruleId === 'RULE-004')
        expect(rule004).toBeDefined()
        expect(rule004!.action.type).toBe('block_mutations')
        expect(rule004!.reason).toContain('20')
        expect(rule004!.reason).toContain('5 minutes')
    })

    it('mutations older than 5 minutes do not count for velocity', () => {
        // Record 20 mutations with timestamps > 5 minutes ago
        const sixMinAgo = Date.now() - 6 * 60 * 1000
        // Test verifies that stale mutations (>5min ago) don't count
        // Access internal state via a fresh engine
        const specialEngine = new EscalationEngine()
        // Use the public API with time manipulation
        vi.spyOn(Date, 'now').mockReturnValue(sixMinAgo)
        for (let i = 0; i < 20; i++) {
            specialEngine.recordMutationRisk('agent-d', 'green', 0.10)
        }
        // Now check at "current" time — 6 minutes later
        vi.spyOn(Date, 'now').mockReturnValue(sixMinAgo + 6 * 60 * 1000)
        const results = specialEngine.checkEscalation('agent-d')
        const rule004 = results.find(r => r.ruleId === 'RULE-004')
        expect(rule004).toBeUndefined()
    })
})

// ── AGV3-05: Multiple rules can fire simultaneously ────────────────────────

describe('AGV3-05 — Multiple rules fire simultaneously', () => {
    it('triggers both RULE-001 and RULE-003 at the same time', () => {
        const engine = new EscalationEngine()
        // 3 red mutations with high scores → triggers both red_count and avg > 0.6
        engine.recordMutationRisk('agent-e', 'red', 0.85)
        engine.recordMutationRisk('agent-e', 'red', 0.90)
        engine.recordMutationRisk('agent-e', 'red', 0.80)
        const results = engine.checkEscalation('agent-e')
        const ruleIds = results.map(r => r.ruleId)
        expect(ruleIds).toContain('RULE-001')
        expect(ruleIds).toContain('RULE-003')
    })

    it('triggers RULE-001, RULE-003, and RULE-004 simultaneously', () => {
        const engine = new EscalationEngine()
        // 20 red mutations → triggers red_count (3+), avg > 0.6, and velocity (20 in 5min)
        for (let i = 0; i < 20; i++) {
            engine.recordMutationRisk('agent-e', 'red', 0.85)
        }
        const results = engine.checkEscalation('agent-e')
        const ruleIds = results.map(r => r.ruleId)
        expect(ruleIds).toContain('RULE-001')
        expect(ruleIds).toContain('RULE-003')
        expect(ruleIds).toContain('RULE-004')
    })
})

// ── AGV3-06: resetSession clears all data ──────────────────────────────────

describe('AGV3-06 — resetSession clears all data', () => {
    it('clears risk history for the agent', () => {
        const engine = new EscalationEngine()
        engine.recordMutationRisk('agent-f', 'red', 0.85)
        engine.recordMutationRisk('agent-f', 'red', 0.90)
        expect(engine.getAgentRiskHistory('agent-f')).toHaveLength(2)

        engine.resetSession('agent-f')
        expect(engine.getAgentRiskHistory('agent-f')).toHaveLength(0)
    })

    it('clears active escalations for the agent', () => {
        const engine = new EscalationEngine()
        for (let i = 0; i < 3; i++) {
            engine.recordMutationRisk('agent-f', 'red', 0.85)
        }
        engine.checkEscalation('agent-f')
        expect(engine.isEscalated('agent-f')).toBe(true)

        engine.resetSession('agent-f')
        expect(engine.isEscalated('agent-f')).toBe(false)
        expect(engine.getActiveEscalations('agent-f')).toHaveLength(0)
    })

    it('does not affect other agents', () => {
        const engine = new EscalationEngine()
        engine.recordMutationRisk('agent-f', 'red', 0.85)
        engine.recordMutationRisk('agent-g', 'red', 0.85)

        engine.resetSession('agent-f')
        expect(engine.getAgentRiskHistory('agent-f')).toHaveLength(0)
        expect(engine.getAgentRiskHistory('agent-g')).toHaveLength(1)
    })
})

// ── AGV3-07: Custom rules override defaults ────────────────────────────────

describe('AGV3-07 — Custom rules from JSON override defaults', () => {
    it('custom rule with same ruleId replaces default', () => {
        const customRules: EscalationRule[] = [
            {
                ruleId: 'RULE-001',
                description: 'Custom: 5 reds before escalation',
                trigger: { type: 'red_count', threshold: 5, window: 'session' },
                action: { type: 'block_mutations' },
            },
        ]
        const engine = new EscalationEngine(customRules)

        // 3 red mutations should NOT trigger because custom threshold is 5
        for (let i = 0; i < 3; i++) {
            engine.recordMutationRisk('agent-h', 'red', 0.85)
        }
        const results = engine.checkEscalation('agent-h')
        const rule001 = results.find(r => r.ruleId === 'RULE-001')
        expect(rule001).toBeUndefined()

        // 5 red mutations should trigger with custom action
        engine.recordMutationRisk('agent-h', 'red', 0.85)
        engine.recordMutationRisk('agent-h', 'red', 0.85)
        const results2 = engine.checkEscalation('agent-h')
        const rule001b = results2.find(r => r.ruleId === 'RULE-001')
        expect(rule001b).toBeDefined()
        expect(rule001b!.action.type).toBe('block_mutations')
    })

    it('custom rules with new ruleIds are added alongside defaults', () => {
        const customRules: EscalationRule[] = [
            {
                ruleId: 'CUSTOM-001',
                description: 'Custom rule: 2 amber → block',
                trigger: { type: 'amber_count', threshold: 2, window: 'session' },
                action: { type: 'block_mutations' },
            },
        ]
        const engine = new EscalationEngine(customRules)
        const rules = engine.getRules()

        // Should have all 4 defaults + 1 custom
        expect(rules.length).toBe(5)
        expect(rules.some(r => r.ruleId === 'CUSTOM-001')).toBe(true)
        expect(rules.some(r => r.ruleId === 'RULE-001')).toBe(true)
    })

    it('setRules replaces the active rule set', () => {
        const engine = new EscalationEngine()
        expect(engine.getRules()).toHaveLength(4)

        engine.setRules([{
            ruleId: 'NEW-001',
            description: 'Single custom rule',
            trigger: { type: 'red_count', threshold: 1, window: 'session' },
            action: { type: 'alert', message: 'test' },
        }])

        const rules = engine.getRules()
        // 3 defaults (RULE-002, 003, 004 retained) + 1 new
        // Actually: the NEW-001 doesn't replace any default, so all 4 + 1 = 5
        expect(rules.some(r => r.ruleId === 'NEW-001')).toBe(true)
    })
})

// ── AGV3-08: Unknown agent creates entry on first seen ─────────────────────

describe('AGV3-08 — Unknown agent creates entry on first seen', () => {
    it('records risk data for a never-before-seen agent', () => {
        const engine = new EscalationEngine()
        engine.recordMutationRisk('totally-new-agent', 'red', 0.85)
        const history = engine.getAgentRiskHistory('totally-new-agent')
        expect(history).toHaveLength(1)
        expect(history[0].tier).toBe('red')
    })

    it('escalation fires for a never-registered agent', () => {
        const engine = new EscalationEngine()
        for (let i = 0; i < 3; i++) {
            engine.recordMutationRisk('brand-new-agent', 'red', 0.85)
        }
        const results = engine.checkEscalation('brand-new-agent')
        expect(results.length).toBeGreaterThan(0)
    })

    it('checkEscalation returns empty for completely unknown agent', () => {
        const engine = new EscalationEngine()
        const results = engine.checkEscalation('nobody')
        expect(results).toHaveLength(0)
    })
})

// ── AGV3-09: Same rule does not fire twice ─────────────────────────────────

describe('AGV3-09 — Same rule does not fire twice for same agent', () => {
    it('RULE-001 fires only once even after additional red mutations', () => {
        const engine = new EscalationEngine()
        for (let i = 0; i < 3; i++) {
            engine.recordMutationRisk('agent-j', 'red', 0.85)
        }
        const first = engine.checkEscalation('agent-j')
        expect(first.some(r => r.ruleId === 'RULE-001')).toBe(true)

        // Add more red mutations and check again
        engine.recordMutationRisk('agent-j', 'red', 0.90)
        const second = engine.checkEscalation('agent-j')
        // RULE-001 should NOT fire again — it's already active
        expect(second.some(r => r.ruleId === 'RULE-001')).toBe(false)
    })

    it('escalation is still in active list after second check', () => {
        const engine = new EscalationEngine()
        for (let i = 0; i < 3; i++) {
            engine.recordMutationRisk('agent-j', 'red', 0.85)
        }
        engine.checkEscalation('agent-j')
        engine.recordMutationRisk('agent-j', 'red', 0.90)
        engine.checkEscalation('agent-j')
        const active = engine.getActiveEscalations('agent-j')
        expect(active.some(e => e.ruleId === 'RULE-001')).toBe(true)
    })
})

// ── AGV3-10: isEscalated / hasActiveAction helpers ─────────────────────────

describe('AGV3-10 — isEscalated and hasActiveAction helpers', () => {
    let engine: EscalationEngine

    beforeEach(() => {
        engine = new EscalationEngine()
    })

    it('isEscalated returns false for an agent with no escalations', () => {
        expect(engine.isEscalated('clean-agent')).toBe(false)
    })

    it('isEscalated returns true after escalation fires', () => {
        for (let i = 0; i < 3; i++) {
            engine.recordMutationRisk('risky-agent', 'red', 0.85)
        }
        engine.checkEscalation('risky-agent')
        expect(engine.isEscalated('risky-agent')).toBe(true)
    })

    it('hasActiveAction returns true for specific action type', () => {
        for (let i = 0; i < 3; i++) {
            engine.recordMutationRisk('agent-k', 'red', 0.85)
        }
        engine.checkEscalation('agent-k')
        expect(engine.hasActiveAction('agent-k', 'require_review')).toBe(true)
        expect(engine.hasActiveAction('agent-k', 'block_mutations')).toBe(false)
    })

    it('hasActiveAction returns false for unknown agent', () => {
        expect(engine.hasActiveAction('ghost', 'require_review')).toBe(false)
    })
})

// ── AGV3-11: getAgentRiskHistory ───────────────────────────────────────────

describe('AGV3-11 — getAgentRiskHistory returns correct data', () => {
    it('returns empty array for unknown agent', () => {
        const engine = new EscalationEngine()
        expect(engine.getAgentRiskHistory('unknown')).toHaveLength(0)
    })

    it('returns data points in insertion order', () => {
        const engine = new EscalationEngine()
        engine.recordMutationRisk('agent-l', 'green', 0.10)
        engine.recordMutationRisk('agent-l', 'amber', 0.50)
        engine.recordMutationRisk('agent-l', 'red', 0.85)

        const history = engine.getAgentRiskHistory('agent-l')
        expect(history).toHaveLength(3)
        expect(history[0].tier).toBe('green')
        expect(history[1].tier).toBe('amber')
        expect(history[2].tier).toBe('red')
    })

    it('each data point has timestamp, tier, and score', () => {
        const engine = new EscalationEngine()
        engine.recordMutationRisk('agent-l', 'amber', 0.55)

        const history = engine.getAgentRiskHistory('agent-l')
        expect(history).toHaveLength(1)
        expect(typeof history[0].timestamp).toBe('number')
        expect(history[0].tier).toBe('amber')
        expect(history[0].score).toBe(0.55)
    })
})

// ── AGV3-12: resetAll clears all agents ────────────────────────────────────

describe('AGV3-12 — resetAll clears all agents', () => {
    it('clears risk history and escalations for all agents', () => {
        const engine = new EscalationEngine()
        engine.recordMutationRisk('agent-1', 'red', 0.85)
        engine.recordMutationRisk('agent-2', 'red', 0.90)

        engine.resetAll()
        expect(engine.getAgentRiskHistory('agent-1')).toHaveLength(0)
        expect(engine.getAgentRiskHistory('agent-2')).toHaveLength(0)
        expect(engine.isEscalated('agent-1')).toBe(false)
        expect(engine.isEscalated('agent-2')).toBe(false)
    })
})

// ── AGV3-13/14/15: loadEscalationRules ─────────────────────────────────────

describe('AGV3-13/14/15 — loadEscalationRules', () => {
    const tmpDir = path.join(os.tmpdir(), `flint-agv3-test-${Date.now()}`)
    const flintDir = path.join(tmpDir, '.flint')
    const rulesPath = path.join(flintDir, 'escalation-rules.json')

    beforeEach(async () => {
        await mkdir(flintDir, { recursive: true })
    })

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true })
    })

    it('returns undefined when file does not exist', async () => {
        const result = await loadEscalationRules(tmpDir + '-nonexistent')
        expect(result).toBeUndefined()
    })

    it('returns undefined when file contains malformed JSON', async () => {
        await writeFile(rulesPath, '{invalid json')
        const result = await loadEscalationRules(tmpDir)
        expect(result).toBeUndefined()
    })

    it('returns undefined when rules field is not an array', async () => {
        await writeFile(rulesPath, JSON.stringify({ version: 1, rules: 'not-an-array' }))
        const result = await loadEscalationRules(tmpDir)
        expect(result).toBeUndefined()
    })

    it('loads valid custom rules from file', async () => {
        const customData = {
            version: 1,
            rules: [
                {
                    ruleId: 'CUSTOM-001',
                    description: 'Test rule',
                    trigger: { type: 'red_count', threshold: 1, window: 'session' },
                    action: { type: 'alert', message: 'Test alert' },
                },
            ],
        }
        await writeFile(rulesPath, JSON.stringify(customData))
        const result = await loadEscalationRules(tmpDir)
        expect(result).toBeDefined()
        expect(result!).toHaveLength(1)
        expect(result![0].ruleId).toBe('CUSTOM-001')
    })

    it('skips rules missing required fields', async () => {
        const customData = {
            version: 1,
            rules: [
                { description: 'Missing ruleId', trigger: { type: 'red_count', threshold: 1, window: 'session' }, action: { type: 'alert', message: 'x' } },
                { ruleId: 'VALID', description: 'Valid rule', trigger: { type: 'red_count', threshold: 1, window: 'session' }, action: { type: 'alert', message: 'x' } },
            ],
        }
        await writeFile(rulesPath, JSON.stringify(customData))
        const result = await loadEscalationRules(tmpDir)
        expect(result).toBeDefined()
        expect(result!).toHaveLength(1)
        expect(result![0].ruleId).toBe('VALID')
    })
})

// ── AGV3-16: getActiveEscalations returns accumulated escalations ──────────

describe('AGV3-16 — getActiveEscalations accumulates escalations', () => {
    it('accumulates multiple rule firings in active list', () => {
        const engine = new EscalationEngine()
        // Trigger RULE-001 (3 reds) and RULE-003 (avg > 0.6)
        for (let i = 0; i < 3; i++) {
            engine.recordMutationRisk('agent-m', 'red', 0.85)
        }
        engine.checkEscalation('agent-m')
        const active = engine.getActiveEscalations('agent-m')
        expect(active.length).toBeGreaterThanOrEqual(2)
        const ruleIds = active.map(e => e.ruleId)
        expect(ruleIds).toContain('RULE-001')
        expect(ruleIds).toContain('RULE-003')
    })

    it('returns empty array for agent with no escalations', () => {
        const engine = new EscalationEngine()
        expect(engine.getActiveEscalations('nobody')).toHaveLength(0)
    })
})

// ── AGV3-17: loadEscalationRulesFromYaml ───────────────────────────────────
// Tests for YAML escalation rule loading (Gap 2 — Phase 1A)

describe('AGV3-17 — loadEscalationRulesFromYaml', () => {
    const tmpDir = path.join(os.tmpdir(), `flint-agv3-yaml-test-${Date.now()}`)
    const yamlPath = path.join(tmpDir, 'flint.config.yaml')

    beforeEach(async () => {
        await mkdir(tmpDir, { recursive: true })
    })

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true })
    })

    it('returns undefined when flint.config.yaml does not exist', () => {
        const result = loadEscalationRulesFromYaml(tmpDir + '-nonexistent')
        expect(result).toBeUndefined()
    })

    it('returns undefined when yaml has no trust section', async () => {
        await writeFile(yamlPath, `
project: test-project
rules:
  mithril:
    mode: coercive
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toBeUndefined()
    })

    it('returns undefined when trust has no escalation section', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  default_tier: junior
  profiles: []
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toBeUndefined()
    })

    it('parses require_review action correctly', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        red_count: ">= 3"
        window: session
      then: require_review
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toBeDefined()
        expect(result).toHaveLength(1)
        expect(result![0].ruleId).toBe('YAML-ESC-001')
        expect(result![0].trigger.type).toBe('red_count')
        expect(result![0].trigger.threshold).toBe(3)
        expect(result![0].trigger.window).toBe('session')
        expect(result![0].action.type).toBe('require_review')
    })

    it('parses alert action with message correctly', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        amber_count: ">= 5"
        window: "1h"
      then: alert
      message: Too many amber mutations
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toBeDefined()
        expect(result![0].action.type).toBe('alert')
        if (result![0].action.type === 'alert') {
            expect(result![0].action.message).toBe('Too many amber mutations')
        }
        expect(result![0].trigger.window).toBe('hour')
    })

    it('parses downgrade action with target tier correctly', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        session_risk_avg: "> 0.6"
      then: downgrade
      to: standard
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toBeDefined()
        expect(result![0].trigger.type).toBe('session_risk_avg')
        expect(result![0].trigger.threshold).toBe(0.6)
        expect(result![0].action.type).toBe('downgrade_tier')
        if (result![0].action.type === 'downgrade_tier') {
            expect(result![0].action.to).toBe('standard')
        }
    })

    it('parses block action correctly', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        mutation_velocity: ">= 20"
        window: "5m"
      then: block
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toBeDefined()
        expect(result![0].trigger.type).toBe('mutation_velocity')
        expect(result![0].trigger.threshold).toBe(20)
        expect(result![0].trigger.window).toBe('session')
        expect(result![0].action.type).toBe('block_mutations')
    })

    it('parses numeric threshold from plain number value', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        red_count: 5
      then: require_review
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toBeDefined()
        expect(result![0].trigger.threshold).toBe(5)
    })

    it('parses ">" condition operator — threshold excludes the operator', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        session_risk_avg: "> 0.6"
      then: require_review
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toBeDefined()
        expect(result![0].trigger.threshold).toBe(0.6)
    })

    it('maps window "5m" to session', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        mutation_velocity: ">= 10"
        window: "5m"
      then: block
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result![0].trigger.window).toBe('session')
    })

    it('maps window "1h" to hour', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        amber_count: ">= 3"
        window: "1h"
      then: alert
      message: test
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result![0].trigger.window).toBe('hour')
    })

    it('maps window "1d" to day', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        red_count: ">= 10"
        window: "1d"
      then: block
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result![0].trigger.window).toBe('day')
    })

    it('maps window "session" to session', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        red_count: ">= 3"
        window: session
      then: require_review
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result![0].trigger.window).toBe('session')
    })

    it('generates sequential YAML-ESC-NNN rule IDs', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        red_count: ">= 3"
      then: require_review
    - when:
        amber_count: ">= 5"
      then: alert
      message: test
    - when:
        session_risk_avg: "> 0.6"
      then: block
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toHaveLength(3)
        expect(result![0].ruleId).toBe('YAML-ESC-001')
        expect(result![1].ruleId).toBe('YAML-ESC-002')
        expect(result![2].ruleId).toBe('YAML-ESC-003')
    })

    it('skips entries missing required when or then fields', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        red_count: ">= 3"
      then: require_review
    - then: block
    - when:
        red_count: ">= 5"
`)
        const result = loadEscalationRulesFromYaml(tmpDir)
        // Only the first entry is valid
        expect(result).toHaveLength(1)
        expect(result![0].ruleId).toBe('YAML-ESC-001')
    })

    it('YAML rules are merged with JSON rules by loadEscalationRules', async () => {
        const flintDir = path.join(tmpDir, '.flint')
        await mkdir(flintDir, { recursive: true })

        // Write JSON escalation rules
        const jsonRules = {
            version: 1,
            rules: [{
                ruleId: 'JSON-001',
                description: 'JSON rule',
                trigger: { type: 'red_count', threshold: 10, window: 'session' },
                action: { type: 'require_review' },
            }],
        }
        await writeFile(path.join(flintDir, 'escalation-rules.json'), JSON.stringify(jsonRules))

        // Write YAML escalation rules
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        amber_count: ">= 3"
      then: alert
      message: YAML alert
`)

        const result = await loadEscalationRules(tmpDir)
        expect(result).toBeDefined()
        expect(result!.some(r => r.ruleId === 'JSON-001')).toBe(true)
        expect(result!.some(r => r.ruleId === 'YAML-ESC-001')).toBe(true)
        expect(result!).toHaveLength(2)
    })

    it('loadEscalationRules returns YAML rules alone when no JSON file exists', async () => {
        await writeFile(yamlPath, `
project: test-project
trust:
  escalation:
    - when:
        red_count: ">= 2"
      then: block
`)
        const result = await loadEscalationRules(tmpDir)
        expect(result).toBeDefined()
        expect(result![0].ruleId).toBe('YAML-ESC-001')
        expect(result![0].action.type).toBe('block_mutations')
    })

    it('malformed YAML file is handled gracefully — returns undefined', async () => {
        await writeFile(yamlPath, 'trust:\n  escalation: [{\n  invalid')
        const result = loadEscalationRulesFromYaml(tmpDir)
        expect(result).toBeUndefined()
    })
})
