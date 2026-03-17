/**
 * agentPolicy.test.ts — AGV.1: Per-Agent Tool ACL Tests
 *
 * Coverage:
 *   AGV1-01 — Default untrusted agent: read-only tools allowed, mutation tools denied
 *   AGV1-02 — Standard agent: audit + fix allowed, ast_mutate denied
 *   AGV1-03 — Elevated agent: all except destructive delete
 *   AGV1-04 — Admin agent: everything allowed
 *   AGV1-05 — Explicit deny overrides allow
 *   AGV1-06 — Unknown agent defaults to untrusted
 *   AGV1-07 — registerAgent updates permissions
 *   AGV1-08 — loadAgentPolicy reads from JSON file
 *   AGV1-09 — isToolAllowed returns reason on denial
 *   AGV1-10 — maxMutationsPerSession enforcement
 *   AGV1-11 — Backward compatibility: renderer calls still work with existing allowlist
 *   AGV1-12 — getDefaultTierTools returns correct lists for each tier
 *   AGV1-13 — getAgentPermission returns registered or fallback
 *   AGV1-14 — recordMutation increments counter
 *   AGV1-15 — resetAgentRegistry clears all state
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    getDefaultTierTools,
    registerAgent,
    getAgentPermission,
    isToolAllowed,
    recordMutation,
    getMutationCount,
    resetMutationCounters,
    resetAgentRegistry,
    loadAgentPolicy,
} from '../agentPolicy'
import type { AgentTier } from '../agentPolicy'
import { checkToolAccess, RENDERER_ALLOWED_MCP_TOOLS } from '../mcp-policy'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

// ── Test Setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
    resetAgentRegistry()
})

// ── AGV1-01: Default untrusted agent — read-only tools allowed ──────────────

describe('AGV1-01 — untrusted tier (default for unknown agents)', () => {
    const READ_ONLY_TOOLS = [
        'bridge_status',
        'bridge_read_code',
        'bridge_read_tokens',
        'bridge_audit',
        'bridge_query_registry',
        'bridge_get_context',
    ]

    const MUTATION_TOOLS = [
        'bridge_ast_mutate',
        'bridge_fix',
        'bridge_ingest_figma',
        'bridge_sync_tokens',
        'bridge_swarm_audit_fix',
        'bridge_annotate',
    ]

    for (const tool of READ_ONLY_TOOLS) {
        it(`allows read-only tool '${tool}' for untrusted agent`, () => {
            registerAgent('test-untrusted', 'untrusted')
            const result = isToolAllowed('test-untrusted', tool)
            expect(result.allowed).toBe(true)
        })
    }

    for (const tool of MUTATION_TOOLS) {
        it(`denies mutation tool '${tool}' for untrusted agent`, () => {
            registerAgent('test-untrusted', 'untrusted')
            const result = isToolAllowed('test-untrusted', tool)
            expect(result.allowed).toBe(false)
        })
    }
})

// ── AGV1-02: Standard agent — audit + fix allowed, ast_mutate denied ────────

describe('AGV1-02 — standard tier', () => {
    beforeEach(() => {
        registerAgent('test-standard', 'standard')
    })

    it('allows bridge_fix for standard agent', () => {
        const result = isToolAllowed('test-standard', 'bridge_fix')
        expect(result.allowed).toBe(true)
    })

    it('allows bridge_debt_report for standard agent', () => {
        const result = isToolAllowed('test-standard', 'bridge_debt_report')
        expect(result.allowed).toBe(true)
    })

    it('allows bridge_plan for standard agent', () => {
        const result = isToolAllowed('test-standard', 'bridge_plan')
        expect(result.allowed).toBe(true)
    })

    it('allows bridge_audit for standard agent', () => {
        const result = isToolAllowed('test-standard', 'bridge_audit')
        expect(result.allowed).toBe(true)
    })

    it('denies bridge_ast_mutate for standard agent', () => {
        const result = isToolAllowed('test-standard', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
    })

    it('denies bridge_ingest_figma for standard agent', () => {
        const result = isToolAllowed('test-standard', 'bridge_ingest_figma')
        expect(result.allowed).toBe(false)
    })

    it('denies bridge_sync_tokens for standard agent', () => {
        const result = isToolAllowed('test-standard', 'bridge_sync_tokens')
        expect(result.allowed).toBe(false)
    })
})

// ── AGV1-03: Elevated agent — all tools accessible ──────────────────────────

describe('AGV1-03 — elevated tier', () => {
    beforeEach(() => {
        registerAgent('test-elevated', 'elevated')
    })

    it('allows bridge_ast_mutate for elevated agent', () => {
        const result = isToolAllowed('test-elevated', 'bridge_ast_mutate')
        expect(result.allowed).toBe(true)
    })

    it('allows bridge_ingest_figma for elevated agent', () => {
        const result = isToolAllowed('test-elevated', 'bridge_ingest_figma')
        expect(result.allowed).toBe(true)
    })

    it('allows bridge_sync_tokens for elevated agent', () => {
        const result = isToolAllowed('test-elevated', 'bridge_sync_tokens')
        expect(result.allowed).toBe(true)
    })

    it('allows bridge_fix for elevated agent', () => {
        const result = isToolAllowed('test-elevated', 'bridge_fix')
        expect(result.allowed).toBe(true)
    })

    it('allows all untrusted-tier tools for elevated agent', () => {
        const readTools = ['bridge_status', 'bridge_read_code', 'bridge_audit', 'bridge_query_registry']
        for (const tool of readTools) {
            const result = isToolAllowed('test-elevated', tool)
            expect(result.allowed).toBe(true)
        }
    })
})

// ── AGV1-04: Admin agent — everything allowed ───────────────────────────────

describe('AGV1-04 — admin tier', () => {
    beforeEach(() => {
        registerAgent('test-admin', 'admin')
    })

    it('allows bridge_ast_mutate for admin agent', () => {
        const result = isToolAllowed('test-admin', 'bridge_ast_mutate')
        expect(result.allowed).toBe(true)
    })

    it('allows any arbitrary tool name for admin agent', () => {
        const result = isToolAllowed('test-admin', 'some_unknown_future_tool')
        expect(result.allowed).toBe(true)
    })

    it('allows all read-only tools for admin agent', () => {
        for (const tool of ['bridge_status', 'bridge_audit', 'bridge_query_registry']) {
            const result = isToolAllowed('test-admin', tool)
            expect(result.allowed).toBe(true)
        }
    })

    it('allows all mutation tools for admin agent', () => {
        for (const tool of ['bridge_fix', 'bridge_ingest_figma', 'bridge_sync_tokens']) {
            const result = isToolAllowed('test-admin', tool)
            expect(result.allowed).toBe(true)
        }
    })
})

// ── AGV1-05: Explicit deny overrides allow ──────────────────────────────────

describe('AGV1-05 — explicit deny overrides allow', () => {
    it('denies a tool that is in both allowedTools and deniedTools', () => {
        registerAgent('test-deny-override', 'admin', {
            deniedTools: ['bridge_ast_mutate'],
        })
        const result = isToolAllowed('test-deny-override', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('explicitly denied')
    })

    it('allows other tools not in the denied list', () => {
        registerAgent('test-deny-override', 'admin', {
            deniedTools: ['bridge_ast_mutate'],
        })
        const result = isToolAllowed('test-deny-override', 'bridge_status')
        expect(result.allowed).toBe(true)
    })

    it('deny overrides wildcard allow', () => {
        registerAgent('test-deny-wildcard', 'admin', {
            deniedTools: ['bridge_fix'],
        })
        // Admin has wildcard '*' but bridge_fix is explicitly denied
        const result = isToolAllowed('test-deny-wildcard', 'bridge_fix')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('explicitly denied')
    })
})

// ── AGV1-06: Unknown agent defaults to untrusted ────────────────────────────

describe('AGV1-06 — unknown agent defaults to untrusted', () => {
    it('allows read-only tools for a never-registered agent', () => {
        const result = isToolAllowed('completely-unknown-agent', 'bridge_status')
        expect(result.allowed).toBe(true)
    })

    it('denies mutation tools for a never-registered agent', () => {
        const result = isToolAllowed('completely-unknown-agent', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
    })

    it('getAgentPermission returns untrusted tier for unknown agent', () => {
        const perm = getAgentPermission('never-seen-before')
        expect(perm.tier).toBe('untrusted')
        expect(perm.agentId).toBe('never-seen-before')
    })
})

// ── AGV1-07: registerAgent updates permissions ──────────────────────────────

describe('AGV1-07 — registerAgent updates permissions', () => {
    it('registers a new agent and retrieves it', () => {
        registerAgent('new-agent', 'standard')
        const perm = getAgentPermission('new-agent')
        expect(perm.tier).toBe('standard')
        expect(perm.agentId).toBe('new-agent')
    })

    it('updates an existing agent to a new tier', () => {
        registerAgent('upgrade-agent', 'untrusted')
        expect(getAgentPermission('upgrade-agent').tier).toBe('untrusted')

        registerAgent('upgrade-agent', 'elevated')
        expect(getAgentPermission('upgrade-agent').tier).toBe('elevated')
    })

    it('applies custom overrides when registering', () => {
        registerAgent('custom-agent', 'standard', {
            displayName: 'Custom Agent',
            maxMutationsPerSession: 5,
            requireManualReview: true,
        })
        const perm = getAgentPermission('custom-agent')
        expect(perm.displayName).toBe('Custom Agent')
        expect(perm.maxMutationsPerSession).toBe(5)
        expect(perm.requireManualReview).toBe(true)
    })

    it('allows custom allowedTools to override tier defaults', () => {
        registerAgent('custom-tools-agent', 'untrusted', {
            allowedTools: ['bridge_status', 'bridge_ast_mutate'],
        })
        const result = isToolAllowed('custom-tools-agent', 'bridge_ast_mutate')
        expect(result.allowed).toBe(true)
    })
})

// ── AGV1-08: loadAgentPolicy reads from JSON file ───────────────────────────

describe('AGV1-08 — loadAgentPolicy reads from JSON file', () => {
    const tmpDir = path.join(os.tmpdir(), `bridge-agv1-test-${Date.now()}`)
    const bridgeDir = path.join(tmpDir, '.bridge')
    const policyPath = path.join(bridgeDir, 'agent-policy.json')

    beforeEach(async () => {
        await mkdir(bridgeDir, { recursive: true })
    })

    afterEach(async () => {
        resetAgentRegistry()
        await rm(tmpDir, { recursive: true, force: true })
    })

    it('loads agents from a valid policy file', async () => {
        const policy = {
            version: 1,
            agents: [
                { agentId: 'claude-code', tier: 'elevated', displayName: 'Claude Code' },
                { agentId: 'cursor', tier: 'standard' },
            ],
        }
        await writeFile(policyPath, JSON.stringify(policy))
        await loadAgentPolicy(tmpDir)

        const claude = getAgentPermission('claude-code')
        expect(claude.tier).toBe('elevated')
        expect(claude.displayName).toBe('Claude Code')

        const cursor = getAgentPermission('cursor')
        expect(cursor.tier).toBe('standard')
    })

    it('applies defaultTier from policy file', async () => {
        const policy = {
            version: 1,
            defaultTier: 'standard',
            agents: [],
        }
        await writeFile(policyPath, JSON.stringify(policy))
        await loadAgentPolicy(tmpDir)

        // Unknown agents should now default to standard, not untrusted
        const perm = getAgentPermission('some-new-agent')
        expect(perm.tier).toBe('standard')
    })

    it('works when policy file does not exist', async () => {
        // No policy file created — should not throw
        await loadAgentPolicy(tmpDir)
        // Defaults still apply
        const perm = getAgentPermission('any-agent')
        expect(perm.tier).toBe('untrusted')
    })

    it('loads agents with custom denied tools from policy file', async () => {
        const policy = {
            version: 1,
            agents: [
                {
                    agentId: 'restricted-claude',
                    tier: 'elevated',
                    deniedTools: ['bridge_ast_mutate', 'bridge_sync_tokens'],
                },
            ],
        }
        await writeFile(policyPath, JSON.stringify(policy))
        await loadAgentPolicy(tmpDir)

        const result = isToolAllowed('restricted-claude', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('explicitly denied')
    })

    it('loads agents with maxMutationsPerSession from policy file', async () => {
        const policy = {
            version: 1,
            agents: [
                {
                    agentId: 'rate-limited',
                    tier: 'elevated',
                    maxMutationsPerSession: 3,
                },
            ],
        }
        await writeFile(policyPath, JSON.stringify(policy))
        await loadAgentPolicy(tmpDir)

        const perm = getAgentPermission('rate-limited')
        expect(perm.maxMutationsPerSession).toBe(3)
    })

    it('ignores entries with missing agentId', async () => {
        const policy = {
            version: 1,
            agents: [
                { tier: 'admin' },  // Missing agentId
                { agentId: 'valid-agent', tier: 'standard' },
            ],
        }
        await writeFile(policyPath, JSON.stringify(policy))
        await loadAgentPolicy(tmpDir)

        const valid = getAgentPermission('valid-agent')
        expect(valid.tier).toBe('standard')
    })

    it('handles malformed JSON gracefully', async () => {
        await writeFile(policyPath, '{not valid json')
        // Should not throw — logs a warning and continues
        await loadAgentPolicy(tmpDir)
        const perm = getAgentPermission('any-agent')
        expect(perm.tier).toBe('untrusted')
    })
})

// ── AGV1-09: isToolAllowed returns reason on denial ─────────────────────────

describe('AGV1-09 — isToolAllowed returns reason on denial', () => {
    it('includes agent ID in denial reason', () => {
        const result = isToolAllowed('my-agent', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('my-agent')
    })

    it('includes tool name in denial reason', () => {
        const result = isToolAllowed('my-agent', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('bridge_ast_mutate')
    })

    it('includes tier in denial reason', () => {
        const result = isToolAllowed('my-agent', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('untrusted')
    })

    it('includes allowed tools list in denial reason for non-allowed tool', () => {
        const result = isToolAllowed('my-agent', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Allowed tools:')
    })

    it('returns no reason when access is allowed', () => {
        const result = isToolAllowed('my-agent', 'bridge_status')
        expect(result.allowed).toBe(true)
        expect(result.reason).toBeUndefined()
    })
})

// ── AGV1-10: maxMutationsPerSession enforcement ─────────────────────────────

describe('AGV1-10 — maxMutationsPerSession enforcement', () => {
    beforeEach(() => {
        registerAgent('rate-limited-agent', 'elevated', {
            maxMutationsPerSession: 3,
        })
    })

    it('allows mutations below the limit', () => {
        const result = isToolAllowed('rate-limited-agent', 'bridge_ast_mutate')
        expect(result.allowed).toBe(true)
    })

    it('denies mutation after reaching the limit', () => {
        // Record 3 mutations (the limit)
        recordMutation('rate-limited-agent')
        recordMutation('rate-limited-agent')
        recordMutation('rate-limited-agent')

        const result = isToolAllowed('rate-limited-agent', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('maximum mutations per session')
        expect(result.reason).toContain('3')
    })

    it('still allows read-only tools after mutation limit is hit', () => {
        recordMutation('rate-limited-agent')
        recordMutation('rate-limited-agent')
        recordMutation('rate-limited-agent')

        const result = isToolAllowed('rate-limited-agent', 'bridge_status')
        expect(result.allowed).toBe(true)
    })

    it('getMutationCount returns the correct count', () => {
        expect(getMutationCount('rate-limited-agent')).toBe(0)
        recordMutation('rate-limited-agent')
        expect(getMutationCount('rate-limited-agent')).toBe(1)
        recordMutation('rate-limited-agent')
        expect(getMutationCount('rate-limited-agent')).toBe(2)
    })

    it('resetMutationCounters resets all counts', () => {
        recordMutation('rate-limited-agent')
        recordMutation('rate-limited-agent')
        expect(getMutationCount('rate-limited-agent')).toBe(2)

        resetMutationCounters()
        expect(getMutationCount('rate-limited-agent')).toBe(0)
    })

    it('agents without maxMutationsPerSession have no limit', () => {
        registerAgent('unlimited-agent', 'elevated')
        // Record many mutations — should never be blocked
        for (let i = 0; i < 100; i++) {
            recordMutation('unlimited-agent')
        }
        const result = isToolAllowed('unlimited-agent', 'bridge_ast_mutate')
        expect(result.allowed).toBe(true)
    })

    it('non-mutation tools are not rate-limited', () => {
        recordMutation('rate-limited-agent')
        recordMutation('rate-limited-agent')
        recordMutation('rate-limited-agent')

        // bridge_audit is read-only, not a mutation tool — not rate-limited
        const result = isToolAllowed('rate-limited-agent', 'bridge_audit')
        expect(result.allowed).toBe(true)
    })
})

// ── AGV1-11: Backward compatibility — renderer calls ────────────────────────

describe('AGV1-11 — backward compatibility with renderer allowlist', () => {
    it('renderer can call all tools in RENDERER_ALLOWED_MCP_TOOLS', () => {
        for (const tool of RENDERER_ALLOWED_MCP_TOOLS) {
            const result = checkToolAccess('renderer', tool)
            expect(result.allowed).toBe(true)
        }
    })

    it('renderer is blocked from calling mutation tools', () => {
        const result = checkToolAccess('renderer', 'bridge_ast_mutate')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('renderer allowlist')
    })

    it('renderer is blocked from calling unknown tools', () => {
        const result = checkToolAccess('renderer', 'nonexistent_tool')
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('renderer allowlist')
    })

    it('non-renderer agents use per-agent ACL, not renderer allowlist', () => {
        registerAgent('my-agent', 'standard')
        // bridge_fix is not in RENDERER_ALLOWED_MCP_TOOLS but is in standard tier
        const result = checkToolAccess('my-agent', 'bridge_fix')
        expect(result.allowed).toBe(true)
    })

    it('RENDERER_ALLOWED_MCP_TOOLS is still a frozen array', () => {
        expect(Array.isArray(RENDERER_ALLOWED_MCP_TOOLS)).toBe(true)
        expect(Object.isFrozen(RENDERER_ALLOWED_MCP_TOOLS)).toBe(true)
    })
})

// ── AGV1-12: getDefaultTierTools returns correct lists ──────────────────────

describe('AGV1-12 — getDefaultTierTools returns correct lists', () => {
    it('untrusted tier has read-only tools', () => {
        const tools = getDefaultTierTools('untrusted')
        expect(tools).toContain('bridge_status')
        expect(tools).toContain('bridge_audit')
        expect(tools).toContain('bridge_query_registry')
        expect(tools).not.toContain('bridge_fix')
        expect(tools).not.toContain('bridge_ast_mutate')
    })

    it('standard tier includes untrusted tools plus fix/debt/plan', () => {
        const tools = getDefaultTierTools('standard')
        expect(tools).toContain('bridge_status')  // from untrusted
        expect(tools).toContain('bridge_fix')
        expect(tools).toContain('bridge_debt_report')
        expect(tools).toContain('bridge_plan')
        expect(tools).not.toContain('bridge_ast_mutate')
    })

    it('elevated tier includes standard tools plus mutation tools', () => {
        const tools = getDefaultTierTools('elevated')
        expect(tools).toContain('bridge_status')       // from untrusted
        expect(tools).toContain('bridge_fix')           // from standard
        expect(tools).toContain('bridge_ast_mutate')    // elevated addition
        expect(tools).toContain('bridge_ingest_figma')  // elevated addition
        expect(tools).toContain('bridge_sync_tokens')   // elevated addition
    })

    it('admin tier returns wildcard', () => {
        const tools = getDefaultTierTools('admin')
        expect(tools).toContain('*')
        expect(tools.length).toBe(1)
    })

    it('invalid tier falls back to untrusted', () => {
        const tools = getDefaultTierTools('nonexistent' as AgentTier)
        expect(tools).toEqual(getDefaultTierTools('untrusted'))
    })
})

// ── AGV1-13: getAgentPermission returns registered or fallback ──────────────

describe('AGV1-13 — getAgentPermission', () => {
    it('returns registered permission for known agent', () => {
        registerAgent('known-agent', 'elevated', { displayName: 'Known' })
        const perm = getAgentPermission('known-agent')
        expect(perm.tier).toBe('elevated')
        expect(perm.displayName).toBe('Known')
        expect(perm.agentId).toBe('known-agent')
    })

    it('returns fallback permission for unknown agent', () => {
        const perm = getAgentPermission('unknown-agent')
        expect(perm.tier).toBe('untrusted')
        expect(perm.agentId).toBe('unknown-agent')
        expect(perm.displayName).toBeUndefined()
    })

    it('fallback permission has untrusted tool list', () => {
        const perm = getAgentPermission('unknown-agent')
        expect(perm.allowedTools).toContain('bridge_status')
        expect(perm.allowedTools).not.toContain('bridge_ast_mutate')
    })
})

// ── AGV1-14: recordMutation increments counter ──────────────────────────────

describe('AGV1-14 — recordMutation', () => {
    it('increments the mutation counter for an agent', () => {
        expect(getMutationCount('counter-agent')).toBe(0)
        recordMutation('counter-agent')
        expect(getMutationCount('counter-agent')).toBe(1)
        recordMutation('counter-agent')
        expect(getMutationCount('counter-agent')).toBe(2)
    })

    it('counters are independent per agent', () => {
        recordMutation('agent-a')
        recordMutation('agent-a')
        recordMutation('agent-b')

        expect(getMutationCount('agent-a')).toBe(2)
        expect(getMutationCount('agent-b')).toBe(1)
    })
})

// ── AGV1-15: resetAgentRegistry clears all state ────────────────────────────

describe('AGV1-15 — resetAgentRegistry', () => {
    it('clears registered agents', () => {
        registerAgent('temp-agent', 'admin')
        expect(getAgentPermission('temp-agent').tier).toBe('admin')

        resetAgentRegistry()
        expect(getAgentPermission('temp-agent').tier).toBe('untrusted')
    })

    it('clears mutation counters', () => {
        recordMutation('temp-agent')
        expect(getMutationCount('temp-agent')).toBe(1)

        resetAgentRegistry()
        expect(getMutationCount('temp-agent')).toBe(0)
    })
})
