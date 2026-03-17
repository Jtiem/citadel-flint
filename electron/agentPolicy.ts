/**
 * electron/agentPolicy.ts — AGV.1: Per-Agent Tool ACL
 *
 * Extends the SEC.3 renderer allowlist to a per-agent permission model.
 * Each registered agent (identified by agent_id from MCP session metadata)
 * gets its own ACL: which tools it can call and at which tier.
 *
 * Tier hierarchy (most restrictive to least):
 *   untrusted  — read-only tools only (default for unknown agents)
 *   standard   — read + audit + fix tools
 *   elevated   — all tools except destructive ast_mutate operations
 *   admin      — all tools, no restrictions
 *
 * Storage:
 *   - Runtime: in-memory Map<string, AgentPermission>
 *   - Persistent: .bridge/agent-policy.json (optional, per-project)
 *
 * Usage from main.ts:
 *   import { isToolAllowed, loadAgentPolicy } from './agentPolicy.js'
 */

import { readFile } from 'node:fs/promises'
import { existsSync, watchFile, unwatchFile } from 'node:fs'
import path from 'node:path'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentTier = 'untrusted' | 'standard' | 'elevated' | 'admin'

export interface AgentPermission {
    agentId: string
    displayName?: string
    tier: AgentTier
    allowedTools: string[]    // specific tool names, or ['*'] for all
    deniedTools: string[]     // explicit denials override allows
    maxMutationsPerSession?: number  // rate limit per session
    requireManualReview?: boolean    // force all mutations through review
}

export interface ToolAccessResult {
    allowed: boolean
    reason?: string
}

/**
 * Shape of the optional .bridge/agent-policy.json file.
 * All fields are optional — missing fields fall back to tier defaults.
 */
export interface AgentPolicyFile {
    version?: number
    agents?: Array<{
        agentId: string
        displayName?: string
        tier?: AgentTier
        allowedTools?: string[]
        deniedTools?: string[]
        maxMutationsPerSession?: number
        requireManualReview?: boolean
    }>
    /** Default tier for agents not listed in the agents array. */
    defaultTier?: AgentTier
}

// ── Tier Default Tool Lists ──────────────────────────────────────────────────

const UNTRUSTED_TOOLS: readonly string[] = Object.freeze([
    'bridge_status',
    'bridge_read_code',
    'bridge_read_tokens',
    'bridge_audit',
    'bridge_query_registry',
    'bridge_get_context',
])

const STANDARD_TOOLS: readonly string[] = Object.freeze([
    ...UNTRUSTED_TOOLS,
    'bridge_fix',
    'bridge_debt_report',
    'bridge_plan',
])

const ELEVATED_TOOLS: readonly string[] = Object.freeze([
    ...STANDARD_TOOLS,
    'bridge_ast_mutate',
    'bridge_ingest_figma',
    'bridge_sync_tokens',
    'bridge_annotate',
    'bridge_generate_dbom',
    'bridge_accessibility_report',
    'bridge_audit_report',
    'bridge_add_remote_library',
    'bridge_swarm_audit_fix',
])

// Elevated denies destructive delete operations on ast_mutate
const ELEVATED_DENIED_TOOLS: readonly string[] = Object.freeze([
    // Elevated agents cannot use delete-type operations.
    // This is enforced by checking the tool args, but for the ACL layer
    // we keep it as a marker. Actual arg-level checking is in the handler.
])

// Admin: wildcard — no restrictions
const ADMIN_TOOLS: readonly string[] = Object.freeze(['*'])

// ── Module State ─────────────────────────────────────────────────────────────

/** Runtime agent permission registry. */
const agentRegistry = new Map<string, AgentPermission>()

/** Per-agent mutation counters for rate limiting. Key: agentId, Value: mutation count this session. */
const mutationCounters = new Map<string, number>()

/** Default tier for unknown agents. Can be overridden by agent-policy.json. */
let defaultTier: AgentTier = 'untrusted'

/** Path being watched for policy file changes. */
let watchedPolicyPath: string | null = null

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the default tool list for a given tier.
 */
export function getDefaultTierTools(tier: AgentTier): readonly string[] {
    switch (tier) {
        case 'untrusted':
            return UNTRUSTED_TOOLS
        case 'standard':
            return STANDARD_TOOLS
        case 'elevated':
            return ELEVATED_TOOLS
        case 'admin':
            return ADMIN_TOOLS
        default:
            return UNTRUSTED_TOOLS
    }
}

/**
 * Returns the default denied tools for a given tier.
 */
function getDefaultTierDeniedTools(tier: AgentTier): readonly string[] {
    switch (tier) {
        case 'elevated':
            return ELEVATED_DENIED_TOOLS
        default:
            return []
    }
}

/**
 * Registers or updates an agent's permissions.
 * Overrides merge with tier defaults: explicit allowedTools/deniedTools
 * replace the tier defaults entirely if provided.
 */
export function registerAgent(
    agentId: string,
    tier: AgentTier,
    overrides?: Partial<Omit<AgentPermission, 'agentId' | 'tier'>>
): void {
    const defaultTools = getDefaultTierTools(tier)
    const defaultDenied = getDefaultTierDeniedTools(tier)

    const permission: AgentPermission = {
        agentId,
        tier,
        displayName: overrides?.displayName,
        allowedTools: overrides?.allowedTools ?? [...defaultTools],
        deniedTools: overrides?.deniedTools ?? [...defaultDenied],
        maxMutationsPerSession: overrides?.maxMutationsPerSession,
        requireManualReview: overrides?.requireManualReview,
    }

    agentRegistry.set(agentId, permission)
}

/**
 * Returns the agent's permission record, falling back to tier defaults
 * if the agent is not registered.
 */
export function getAgentPermission(agentId: string): AgentPermission {
    const existing = agentRegistry.get(agentId)
    if (existing) return existing

    // Fall back to default tier
    const tier = defaultTier
    const defaultTools = getDefaultTierTools(tier)
    const defaultDenied = getDefaultTierDeniedTools(tier)

    return {
        agentId,
        tier,
        allowedTools: [...defaultTools],
        deniedTools: [...defaultDenied],
    }
}

/**
 * Checks whether a specific tool is allowed for the given agent.
 * Returns { allowed: true } or { allowed: false, reason: '...' }.
 *
 * Evaluation order:
 *   1. Explicit deniedTools always block (deny overrides allow)
 *   2. Wildcard '*' in allowedTools permits everything not denied
 *   3. Tool must be in allowedTools
 *   4. maxMutationsPerSession rate limit check (for mutation tools)
 */
export function isToolAllowed(agentId: string, toolName: string): ToolAccessResult {
    const permission = getAgentPermission(agentId)

    // 1. Explicit deny always wins
    if (permission.deniedTools.includes(toolName)) {
        return {
            allowed: false,
            reason: `Tool "${toolName}" is explicitly denied for agent "${agentId}" (tier: ${permission.tier})`,
        }
    }

    // 2. Wildcard allows everything not denied
    if (permission.allowedTools.includes('*')) {
        return { allowed: true }
    }

    // 3. Must be in the allowed list
    if (!permission.allowedTools.includes(toolName)) {
        return {
            allowed: false,
            reason: `Tool "${toolName}" is not in the allowed tools for agent "${agentId}" (tier: ${permission.tier}). ` +
                `Allowed tools: ${permission.allowedTools.join(', ')}`,
        }
    }

    // 4. Rate limit check for mutation tools
    if (permission.maxMutationsPerSession != null && isMutationTool(toolName)) {
        const count = mutationCounters.get(agentId) ?? 0
        if (count >= permission.maxMutationsPerSession) {
            return {
                allowed: false,
                reason: `Agent "${agentId}" has reached the maximum mutations per session ` +
                    `(${permission.maxMutationsPerSession}). Current count: ${count}`,
            }
        }
    }

    return { allowed: true }
}

/**
 * Increments the mutation counter for an agent.
 * Called after a mutation tool is successfully invoked.
 */
export function recordMutation(agentId: string): void {
    const count = mutationCounters.get(agentId) ?? 0
    mutationCounters.set(agentId, count + 1)
}

/**
 * Returns the current mutation count for an agent in this session.
 */
export function getMutationCount(agentId: string): number {
    return mutationCounters.get(agentId) ?? 0
}

/**
 * Resets mutation counters for all agents.
 * Typically called at session start.
 */
export function resetMutationCounters(): void {
    mutationCounters.clear()
}

/**
 * Loads per-project agent policy from `.bridge/agent-policy.json`.
 * If the file does not exist, the system operates with tier defaults only.
 *
 * Sets up a file watcher so changes are reloaded automatically.
 */
export async function loadAgentPolicy(projectRoot: string): Promise<void> {
    const policyPath = path.join(projectRoot, '.bridge', 'agent-policy.json')

    // Stop watching previous policy file
    if (watchedPolicyPath !== null) {
        try {
            unwatchFile(watchedPolicyPath)
        } catch {
            // Ignore errors on unwatch
        }
        watchedPolicyPath = null
    }

    await _loadPolicyFromDisk(policyPath)

    // Watch for changes (fs.watchFile is more reliable than fs.watch for JSON files)
    if (existsSync(policyPath)) {
        watchedPolicyPath = policyPath
        watchFile(policyPath, { interval: 2000 }, () => {
            void _loadPolicyFromDisk(policyPath)
        })
    }
}

/**
 * Clears all registered agents and resets to defaults.
 * Useful for testing and session reset.
 */
export function resetAgentRegistry(): void {
    agentRegistry.clear()
    mutationCounters.clear()
    defaultTier = 'untrusted'
    if (watchedPolicyPath !== null) {
        try {
            unwatchFile(watchedPolicyPath)
        } catch {
            // Ignore
        }
        watchedPolicyPath = null
    }
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

/** Tools considered "mutations" for rate-limiting purposes. */
const MUTATION_TOOLS = new Set([
    'bridge_ast_mutate',
    'bridge_fix',
    'bridge_sync_tokens',
    'bridge_ingest_figma',
])

function isMutationTool(toolName: string): boolean {
    return MUTATION_TOOLS.has(toolName)
}

/**
 * Reads and parses the policy file from disk.
 * On any error (missing file, invalid JSON, bad schema), logs a warning
 * and leaves the existing in-memory state unchanged.
 */
async function _loadPolicyFromDisk(policyPath: string): Promise<void> {
    if (!existsSync(policyPath)) {
        return
    }

    try {
        const raw = await readFile(policyPath, 'utf-8')
        const data = JSON.parse(raw) as AgentPolicyFile

        // Apply default tier if specified
        if (data.defaultTier && isValidTier(data.defaultTier)) {
            defaultTier = data.defaultTier
        }

        // Register each agent from the policy file
        if (Array.isArray(data.agents)) {
            for (const entry of data.agents) {
                if (!entry.agentId || typeof entry.agentId !== 'string') continue

                const tier = (entry.tier && isValidTier(entry.tier)) ? entry.tier : defaultTier

                registerAgent(entry.agentId, tier, {
                    displayName: entry.displayName,
                    allowedTools: entry.allowedTools,
                    deniedTools: entry.deniedTools,
                    maxMutationsPerSession: entry.maxMutationsPerSession,
                    requireManualReview: entry.requireManualReview,
                })
            }
        }

        console.log('[Bridge] agentPolicy: loaded %d agents from %s', data.agents?.length ?? 0, policyPath)
    } catch (err) {
        console.warn('[Bridge] agentPolicy: failed to load %s:', policyPath, err)
    }
}

const VALID_TIERS = new Set<string>(['untrusted', 'standard', 'elevated', 'admin'])

function isValidTier(value: string): value is AgentTier {
    return VALID_TIERS.has(value)
}
