/**
 * orchestrator.ts — electron/orchestrator.ts
 *
 * The Bridge Auditor: LLM adapter for the Orchestration Engine (Phase M).
 *
 * Responsibilities:
 *   1. Reads ~/.bridge/config.json for the API key + provider setting.
 *   2. Exposes sendChatMessage() — streams Anthropic responses with tool use.
 *   3. Defines the Bridge Tool Catalog (Phase M — Commandment 15): the exact
 *      7 granular AST operations an AI agent may request. Raw code strings
 *      and full-file replacements are structurally prohibited.
 *   4. Validates proposed mutations in-memory using Babel before surfacing
 *      any tool_call to the renderer (Commandment 16 — In-Memory Validation).
 *      TS/syntax errors feed back to the AI as invisible recovery prompts.
 *
 * Complexity Tiers (Commandment 8 — Audit-First Execution):
 *   Atomic   → 1–3 mutation ops, single node.
 *   Compound → multi-step sequences, structural changes.
 *
 * Security:
 *   • API key is read from disk in the main process. It never reaches the renderer.
 *   • All tool_use results route back through the existing IPC channels (applyBatch,
 *     saveFileBatch) so Commandments 1, 12, and 13 are structurally enforced.
 */

import Anthropic from '@anthropic-ai/sdk'
import { safeStorage } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { tsLspClient } from './lsp/TypeScriptLspClient'
import { vueLspClient } from './lsp/VueLspClient'
import type { ILspClient } from './lsp/types'
// ── AGV.3: Auto-Escalation Engine ───────────────────────────────────────────
import { escalationEngine } from './agentEscalation.js'

// ── Commandment 17: Mithril pre-commit check ──────────────────────────────────
import db from './store.js'
import { checkClassNameForColorDrift, formatViolationsForAI } from './mithrilPreCommit.js'
import type { MithrilToken } from './mithrilPreCommit.js'

// ── Complexity Router Types (ACX) ─────────────────────────────────────────────
//
// All types live here alongside the router implementation per the ACX contract.
// No renderer-side types are needed — the assessment never crosses the IPC boundary.

export type ComplexityTier = 'atomic' | 'compound' | 'architectural'

/**
 * A single signal that contributed to the complexity assessment.
 * Stored in ComplexityAssessment.signals for logging and transparency.
 */
export interface ComplexitySignal {
    /** Identifier for the signal source. */
    source:
        | 'architectural_keyword'
        | 'compound_keyword'
        | 'message_length'
        | 'multi_sentence'
        | 'quantifier'
        | 'violation_count'
        | 'session_depth'
        | 'file_count'
        | 'vue_sfc'
        | 'prior_tool_depth'
        | 'prior_structural_tool'
        | 'prior_multi_target'
    /** Human-readable description of why this signal fired. */
    reason: string
    /** The tier floor this signal established or confirmed. */
    tierContribution: ComplexityTier
}

/**
 * The output of classifyComplexity(). Carries the selected model, the full
 * escalation path, and the audit trail of signals that produced the decision.
 */
export interface ComplexityAssessment {
    tier: ComplexityTier
    selectedModel: string
    reasoning: string
    signals: ComplexitySignal[]
    escalationPath: string[]
}

/**
 * All inputs available to the router synchronously at call time.
 * Constructed in sendChatMessage() before the Anthropic SDK call.
 */
export interface RouterInput {
    lastUserMessage: string
    violationCount: number
    sessionTurns: number
    openFileCount: number
    activeFileExtension: string
    priorToolCallCount: number
    priorToolNames: string[]
    priorUniqueTargetIds: number
}

// ── Keyword lists (module-level const — never re-allocated per call) ──────────

const COMPOUND_VERBS = [
    'restyle', 'restructure', 'fix all', 'fix the violations', 'align',
    'update all', 'clean up', 'apply tokens', 'change the color scheme',
    'reorder', 'refactor layout', 'adjust spacing', 'wrap', 'insert',
    'add a new', 'delete', 'remove the',
]
const COMPOUND_NOUNS = [
    'violations', 'accessibility issues', 'design debt', 'the form',
    'the nav', 'the card', 'the layout', 'all the',
]
const ARCHITECTURAL_VERBS = [
    'create', 'extract', 'move', 'migrate', 'scaffold', 'build',
    'introduce', 'set up', 'implement', 'generate', 'compose',
    'new component', 'refactor', 'redesign',
]
const ARCHITECTURAL_NOUNS = [
    'component', 'page', 'layout', 'across files', 'shared', 'library',
    'token system', 'multiple files', 'new file', 'pattern',
]

const QUANTIFIER_WORDS = ['all', 'every', 'each', 'multiple', 'several']

// ── Model mapping and escalation paths ───────────────────────────────────────

export const TIER_TO_MODEL: Record<ComplexityTier, string> = {
    atomic:        'claude-3-5-haiku-20241022',
    compound:      'claude-3-5-sonnet-20241022',
    architectural: 'claude-opus-4-5',
}

export const ESCALATION_PATH: Record<ComplexityTier, string[]> = {
    atomic:        ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-opus-4-5'],
    compound:      ['claude-3-5-sonnet-20241022', 'claude-opus-4-5'],
    architectural: ['claude-opus-4-5'],
}

// ── Complexity classification helpers ─────────────────────────────────────────

function containsAny(msg: string, keywords: string[]): boolean {
    return keywords.some((kw) => msg.includes(kw))
}

function countSentences(msg: string): number {
    // Count sentence-ending punctuation: . ! ? followed by whitespace or end
    const matches = msg.match(/[.!?](\s|$)/g)
    return matches ? matches.length : 1
}

function containsQuantifier(msg: string): boolean {
    return QUANTIFIER_WORDS.some((q) => msg.includes(q))
}

function mentionsViolations(msg: string): boolean {
    return msg.includes('violation') || msg.includes('issue') || msg.includes('error') || msg.includes('fix')
}

/** Raise only — never lower a tier. */
function raise(current: ComplexityTier, target: ComplexityTier): ComplexityTier {
    const rank: Record<ComplexityTier, number> = { atomic: 0, compound: 1, architectural: 2 }
    return rank[target] > rank[current] ? target : current
}

/**
 * Classify a task into a complexity tier.
 * Deterministic, synchronous, O(K) where K is total keyword count (~50).
 * Must complete in < 10ms on any message up to 2,000 characters.
 */
export function classifyComplexity(input: RouterInput): ComplexityTier {
    const msg = input.lastUserMessage.toLowerCase()

    let floor: ComplexityTier = 'atomic'

    // Phase 1: Message-based floor
    if (containsAny(msg, ARCHITECTURAL_VERBS) || containsAny(msg, ARCHITECTURAL_NOUNS)) {
        floor = 'architectural'
    } else if (
        containsAny(msg, COMPOUND_VERBS) ||
        containsAny(msg, COMPOUND_NOUNS) ||
        countSentences(msg) >= 2 ||
        (msg.length > 120 && containsQuantifier(msg))
    ) {
        floor = 'compound'
    }

    // Phase 2: Workspace signal raises (never lower)

    // Violation count raise
    if (floor !== 'architectural' && input.violationCount >= 5 && mentionsViolations(msg)) {
        floor = raise(floor, 'compound')
    }
    if (floor !== 'architectural' && input.violationCount >= 13 && mentionsViolations(msg)) {
        floor = raise(floor, 'compound')
    }

    // Session depth raise
    if (floor === 'atomic' && input.sessionTurns >= 4) {
        floor = 'compound'
    }

    // File count raise
    if (floor !== 'architectural' && input.openFileCount >= 2) {
        if (containsAny(msg, ARCHITECTURAL_VERBS) || containsAny(msg, ARCHITECTURAL_NOUNS)) {
            floor = 'architectural'
        }
    }

    // Vue SFC raise
    if (input.activeFileExtension === 'vue' && floor === 'atomic') {
        floor = 'compound'
    }

    // Phase 3: Prior turn evidence raises
    if (floor === 'atomic' && (
        input.priorToolCallCount >= 5 ||
        input.priorToolNames.includes('bridge_insert_node') ||
        input.priorToolNames.includes('bridge_wrap_node') ||
        input.priorUniqueTargetIds >= 2
    )) {
        floor = 'compound'
    }

    return floor
}

/**
 * Build a ComplexityAssessment from a RouterInput.
 * Wraps classifyComplexity and captures which signals fired.
 */
export function buildAssessment(input: RouterInput): ComplexityAssessment {
    const msg = input.lastUserMessage.toLowerCase()
    const signals: ComplexitySignal[] = []

    // Capture signals in firing order
    if (containsAny(msg, ARCHITECTURAL_VERBS) || containsAny(msg, ARCHITECTURAL_NOUNS)) {
        signals.push({
            source: 'architectural_keyword',
            reason: 'Message contains an architectural verb or noun',
            tierContribution: 'architectural',
        })
    } else if (containsAny(msg, COMPOUND_VERBS) || containsAny(msg, COMPOUND_NOUNS)) {
        signals.push({
            source: 'compound_keyword',
            reason: 'Message contains a compound-scope verb or noun',
            tierContribution: 'compound',
        })
    }

    if (countSentences(msg) >= 2) {
        signals.push({
            source: 'multi_sentence',
            reason: 'Message contains 2+ sentences indicating compound intent',
            tierContribution: 'compound',
        })
    }

    if (msg.length > 120 && containsQuantifier(msg)) {
        signals.push({
            source: 'message_length',
            reason: 'Long message with quantifier signals compound intent',
            tierContribution: 'compound',
        })
    }

    if (input.violationCount >= 5 && mentionsViolations(msg)) {
        signals.push({
            source: 'violation_count',
            reason: `${input.violationCount} active violations mentioned in message`,
            tierContribution: 'compound',
        })
    }

    if (input.sessionTurns >= 4) {
        signals.push({
            source: 'session_depth',
            reason: `Session turn ${input.sessionTurns} — extended sessions escalate to compound`,
            tierContribution: 'compound',
        })
    }

    if (input.openFileCount >= 2 && (containsAny(msg, ARCHITECTURAL_VERBS) || containsAny(msg, ARCHITECTURAL_NOUNS))) {
        signals.push({
            source: 'file_count',
            reason: `${input.openFileCount} files open with cross-file language`,
            tierContribution: 'architectural',
        })
    }

    if (input.activeFileExtension === 'vue') {
        signals.push({
            source: 'vue_sfc',
            reason: 'Vue SFC has multiple zones — raises to compound minimum',
            tierContribution: 'compound',
        })
    }

    if (input.priorToolCallCount >= 5) {
        signals.push({
            source: 'prior_tool_depth',
            reason: `Prior turn used ${input.priorToolCallCount} tool calls`,
            tierContribution: 'compound',
        })
    }

    if (input.priorToolNames.includes('bridge_insert_node') || input.priorToolNames.includes('bridge_wrap_node')) {
        signals.push({
            source: 'prior_structural_tool',
            reason: 'Prior turn used structural insert/wrap operation',
            tierContribution: 'compound',
        })
    }

    if (input.priorUniqueTargetIds >= 2) {
        signals.push({
            source: 'prior_multi_target',
            reason: `Prior turn referenced ${input.priorUniqueTargetIds} unique targetIds`,
            tierContribution: 'compound',
        })
    }

    const tier = classifyComplexity(input)
    const selectedModel = TIER_TO_MODEL[tier]
    const escalationPath = ESCALATION_PATH[tier]

    const primarySignal = signals[0]
    const reasoning = primarySignal
        ? `${tier} tier: ${primarySignal.reason}`
        : `${tier} tier: no escalating signals detected`

    return { tier, selectedModel, reasoning, signals, escalationPath }
}

// ── Module-level prepared statement for violation count ───────────────────────
// Prepared lazily on first call so a missing governance_events table on fresh
// databases does not crash the module at import time (Commandment 12).

let _violationCountStmt: ReturnType<typeof db.prepare> | null = null

function loadCurrentViolationCount(): number {
    try {
        if (_violationCountStmt === null) {
            // governance_events may not exist in the Glass DB (it lives in the MCP
            // engine's DB). Prepare lazily and catch any table-not-found error.
            _violationCountStmt = db.prepare(
                `SELECT COUNT(*) as count FROM governance_events WHERE event_type = 'violation'`,
            )
        }
        const row = _violationCountStmt.get() as { count: number } | undefined
        return row?.count ?? 0
    } catch {
        return 0  // safe default — never block routing on a DB error
    }
}

// ── Build RouterInput from message history ────────────────────────────────────

function extractPriorToolCalls(messages: ChatMessage[]): ChatMessage[] {
    // Scan in reverse to find the last assistant turn's tool_call entries
    const result: ChatMessage[] = []
    let passedLastUser = false
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m.role === 'user' && !passedLastUser) {
            passedLastUser = true
            continue
        }
        if (m.role === 'tool_call') {
            result.push(m)
        } else if (m.role === 'assistant') {
            // Continue scanning — there may be more tool_calls in the same segment
        } else if (passedLastUser) {
            // Hit a non-tool boundary before the last user message — stop
            break
        }
    }
    return result
}

function countUniqueTargetIds(priorToolCalls: ChatMessage[]): number {
    const ids = new Set<string>()
    for (const m of priorToolCalls) {
        const targetId = m.toolInput?.['targetId']
        if (typeof targetId === 'string' && targetId.length > 0) {
            ids.add(targetId)
        }
    }
    return ids.size
}

function buildRouterInput(messages: ChatMessage[], activeFilePath?: string | null): RouterInput {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    const lastUserMessage = lastUserMsg?.content ?? ''

    const sessionTurns = messages.filter((m) => m.role === 'user').length

    const priorToolCalls = extractPriorToolCalls(messages)
    const priorToolCallCount = priorToolCalls.length
    const priorToolNames = priorToolCalls.map((m) => m.toolName ?? '').filter(Boolean)
    const priorUniqueTargetIds = countUniqueTargetIds(priorToolCalls)

    const violationCount = loadCurrentViolationCount()

    const activeFileExtension = activeFilePath
        ? (activeFilePath.split('.').pop()?.toLowerCase() ?? 'tsx')
        : 'tsx'

    // openFileCount defaults to 1 until IPC payload extends with workspace tree.
    const openFileCount = 1

    return {
        lastUserMessage,
        violationCount,
        sessionTurns,
        openFileCount,
        activeFileExtension,
        priorToolCallCount,
        priorToolNames,
        priorUniqueTargetIds,
    }
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface BridgeAIConfig {
    /**
     * Plaintext API key — legacy field kept for backward compatibility.
     * Present only in configs that predate SEC.4. Migrated to `apiKeyEncrypted`
     * on first read when `safeStorage.isEncryptionAvailable()` is true.
     * Removed from disk after migration.
     */
    apiKey?: string
    /**
     * Base64-encoded encrypted API key produced by `safeStorage.encryptString`.
     * This is the canonical storage field as of SEC.4. Takes precedence over
     * the legacy `apiKey` field during reads.
     */
    apiKeyEncrypted?: string
    provider: 'anthropic' | 'openai' | 'gemini'
    model?: string
    /** Optional custom API base URL for routing through corporate gateways (e.g., Cloudflare AI Gateway, Helicone). */
    baseURL?: string
}

// Canonical Anthropic model roster (updated March 2025)
export const ANTHROPIC_MODELS: { id: string; label: string; tier: 'fast' | 'balanced' | 'powerful' }[] = [
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', tier: 'fast' },
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', tier: 'balanced' },
    { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', tier: 'balanced' },
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', tier: 'powerful' },
]

const CONFIG_PATH = path.join(homedir(), '.bridge', 'config.json')
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219'

// ── safeStorage helpers (SEC.4) ───────────────────────────────────────────────
//
// These helpers are module-level so they can be tested via dependency injection.
// Production code uses the real `safeStorage` from Electron; tests supply mocks.

/**
 * Encrypts `key` using the OS keychain via `safeStorage.encryptString` and
 * returns the ciphertext as a base64 string suitable for JSON storage.
 *
 * Callers MUST check `safeStorage.isEncryptionAvailable()` before calling.
 */
export function encryptApiKey(key: string): string {
    return safeStorage.encryptString(key).toString('base64')
}

/**
 * Decrypts a base64-encoded ciphertext produced by `encryptApiKey`.
 * Returns the plaintext key, or `null` if decryption fails (corrupt data,
 * wrong machine/user, or `safeStorage` unavailable).
 *
 * Never throws — callers must handle the `null` case.
 */
export function decryptApiKey(encrypted: string): string | null {
    try {
        return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    } catch {
        return null
    }
}

/**
 * Reads `~/.bridge/config.json` and resolves the API key securely.
 *
 * Resolution order:
 *   1. `apiKeyEncrypted` present → decrypt with safeStorage and return as
 *      `apiKey` in the result so callers use the same field regardless of
 *      which storage path is active.
 *   2. `apiKey` present (legacy plaintext) → use as-is and schedule a
 *      migration on next write (idempotent: migration only fires once).
 *   3. Neither present → `apiKey` is undefined in the result.
 *
 * The returned object always has `apiKey` set to the live plaintext value
 * (or undefined) so `sendChatMessage` can pass it to the Anthropic SDK
 * without any change to the call site.
 *
 * Fallback: if `safeStorage` is not available (CI, headless Linux without
 * libsecret), the legacy plaintext `apiKey` field is used with a warning.
 */
export async function readConfig(): Promise<Partial<BridgeAIConfig>> {
    try {
        if (!existsSync(CONFIG_PATH)) return {}
        const raw = await readFile(CONFIG_PATH, 'utf-8')
        const cfg = JSON.parse(raw) as Partial<BridgeAIConfig>

        // Preferred path: encrypted key present.
        if (typeof cfg.apiKeyEncrypted === 'string' && cfg.apiKeyEncrypted.length > 0) {
            if (safeStorage.isEncryptionAvailable()) {
                const decrypted = decryptApiKey(cfg.apiKeyEncrypted)
                if (decrypted !== null) {
                    // Return the live key as `apiKey` so all call sites remain unchanged.
                    return { ...cfg, apiKey: decrypted }
                }
                // Decryption failed — fall through to legacy path (may be undefined).
                console.warn('[Bridge] safeStorage: failed to decrypt apiKeyEncrypted; key unavailable')
                return { ...cfg, apiKey: undefined }
            }
            // safeStorage unavailable (CI/headless) — key is not accessible.
            console.warn('[Bridge] safeStorage: encryption unavailable; apiKeyEncrypted cannot be decrypted')
            return { ...cfg, apiKey: undefined }
        }

        // Legacy path: plaintext apiKey still on disk.
        if (typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0) {
            if (!safeStorage.isEncryptionAvailable()) {
                // Headless / CI fallback — use plaintext with a warning.
                console.warn('[Bridge] safeStorage: encryption unavailable; using plaintext API key fallback')
            }
            // Migration will fire on next writeConfig call (SEC.4 idempotent migration).
            return cfg
        }

        return cfg
    } catch {
        return {}
    }
}

/**
 * Persists a config patch to `~/.bridge/config.json`.
 *
 * When `config.apiKey` is provided and `safeStorage.isEncryptionAvailable()`:
 *   - Encrypts the key and stores it in `apiKeyEncrypted`.
 *   - Removes the plaintext `apiKey` field from disk (SEC.4 — no plaintext at rest).
 *
 * When `safeStorage` is unavailable (CI/headless):
 *   - Falls back to writing plaintext `apiKey` with a console warning.
 *
 * The function is idempotent: writing the same config twice does not
 * double-encrypt or produce a different file hash.
 */
export async function writeConfig(config: Partial<BridgeAIConfig>): Promise<void> {
    const dir = path.dirname(CONFIG_PATH)
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })

    // Read the raw disk bytes to preserve fields we are not explicitly patching.
    // We read raw JSON (not via readConfig) to avoid inadvertently decrypting
    // and re-encrypting the key on every write, which would change the ciphertext.
    let existing: Partial<BridgeAIConfig> = {}
    try {
        if (existsSync(CONFIG_PATH)) {
            existing = JSON.parse(await readFile(CONFIG_PATH, 'utf-8')) as Partial<BridgeAIConfig>
        }
    } catch { /* ignore */ }

    const merged: Partial<BridgeAIConfig> = { ...existing, ...config }

    // SEC.4: If a live apiKey is being written and safeStorage is available,
    // encrypt it and strip the plaintext field from disk.
    if (typeof merged.apiKey === 'string' && merged.apiKey.length > 0) {
        if (safeStorage.isEncryptionAvailable()) {
            merged.apiKeyEncrypted = encryptApiKey(merged.apiKey)
            delete merged.apiKey   // no plaintext at rest
        } else {
            // Headless / CI fallback — keep plaintext with a warning.
            console.warn('[Bridge] safeStorage: encryption unavailable; API key stored in plaintext')
        }
    }

    await writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8')
}

/**
 * Returns true when a usable API key is present (either encrypted or plaintext).
 * Does not expose or log the key.
 */
export async function hasApiKey(): Promise<boolean> {
    const cfg = await readConfig()
    return typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0
}

// ── Bridge Tool Catalog (Phase M — Commandment 15) ───────────────────────────
//
// These are the ONLY 7 operations the AI is allowed to request.
// Raw code strings, full-file replacements, and regex patches are
// structurally prohibited — the LLM cannot emit them because no tool
// in this catalog accepts them.

export const BRIDGE_TOOLS: Anthropic.Tool[] = [
    {
        name: 'bridge_read_code',
        description:
            'Read the current source code of the active file. Use this FIRST to understand component structure before proposing any changes.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
        name: 'bridge_read_tokens',
        description:
            'Read all design tokens from the Bridge token store. You MUST call this before proposing any className or style change. Only use token values that appear in this list. Never invent hex colours or pixel values.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
        name: 'bridge_audit_mithril',
        description:
            'Read all current Mithril Safety violations (color drift ΔE, typography, spacing, shadow, opacity). Use this to understand design system debt before proposing changes.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
        name: 'bridge_audit_a11y',
        description:
            'Read all current WCAG 2.1 AA accessibility violations. Verify your proposed changes do not introduce new violations.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    // ── Mutation tools (Phase M — strictly granular, node-targeted) ─────────────
    {
        name: 'bridge_update_props',
        description:
            `Modify one or more JSX attributes on a single target node.

Commandment 15 rules (mandatory):
- targetId MUST be a data-bridge-id value read from bridge_read_code. Never invent IDs.
- Never remove or change a data-bridge-id attribute.
- className values MUST use Tailwind classes mapped to tokens from bridge_read_tokens.
- Only call bridge_read_tokens first if you haven't already in this turn.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the target JSX element.' },
                props: {
                    type: 'object',
                    description: 'Key-value pairs of JSX attribute names to new string values. E.g. { "className": "bg-brand-primary", "aria-label": "Submit" }',
                    additionalProperties: { type: 'string' },
                },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'props', 'reasoning'],
        },
    },
    {
        name: 'bridge_update_text',
        description: 'Modify the visible text content of a single JSX element. Use this for copy changes, label updates, and heading edits.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the target JSX element.' },
                text: { type: 'string', description: 'New text content to set.' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'text', 'reasoning'],
        },
    },
    {
        name: 'bridge_insert_node',
        description:
            `Insert a new JSX element relative to an existing target node.
position: 'before' | 'after' | 'firstChild' | 'lastChild'
Only use element types that exist in the design system read from bridge_read_tokens or the source file imports.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the reference node.' },
                position: { type: 'string', enum: ['before', 'after', 'firstChild', 'lastChild'] },
                nodeType: { type: 'string', description: 'JSX element tag name, e.g. "div", "Button", "p".' },
                props: {
                    type: 'object',
                    description: 'Optional JSX attributes for the new element.',
                    additionalProperties: { type: 'string' },
                },
                children: { type: 'string', description: 'Optional text content or JSX children (must be safe JSX).' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'position', 'nodeType', 'reasoning'],
        },
    },
    {
        name: 'bridge_wrap_node',
        description: 'Wrap an existing JSX element in a new parent element. Use for layout restructuring only.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the node to wrap.' },
                wrapperType: { type: 'string', description: 'JSX tag for the new wrapper, e.g. "div", "section".' },
                props: {
                    type: 'object',
                    description: 'Optional JSX attributes for the wrapper element.',
                    additionalProperties: { type: 'string' },
                },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'wrapperType', 'reasoning'],
        },
    },
    {
        name: 'bridge_delete_node',
        description: 'Remove a JSX element and all its children from the tree. This also clears any component_overrides rows for the deleted node.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the element to remove.' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'reasoning'],
        },
    },
    {
        name: 'bridge_add_class',
        description: 'Append one design-token Tailwind class to a node\'s className. Call bridge_read_tokens first to find valid class names.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the target node.' },
                className: { type: 'string', description: 'Single Tailwind class to add, e.g. "mt-4" or "bg-brand-primary".' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'className', 'reasoning'],
        },
    },
    {
        name: 'bridge_remove_class',
        description: 'Remove one specific Tailwind class from a node\'s className.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the target node.' },
                className: { type: 'string', description: 'Exact class string to remove.' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'className', 'reasoning'],
        },
    },
    // ── Phase M: Design System RAG Search ─────────────────────────────────────
    {
        name: 'bridge_search_design_system',
        description:
            'Search the design system knowledge base for component patterns, usage guidelines, and documentation. Use this when you need context about how components should be structured, which patterns to follow, or to find existing design system conventions before proposing changes.',
        input_schema: {
            type: 'object' as const,
            properties: {
                query: { type: 'string', description: 'Natural language search query describing what you need to know about the design system.' },
            },
            required: ['query'],
        },
    },
]

// ── System Prompt (Phase M) ───────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are the Bridge Auditor, an AI assistant integrated into Bridge IDE — the world's first Agentic UI Operating System. Your role is to make precise, design-system-compliant, accessible component edits using the Bridge tool catalog.

## Non-Negotiable Rules (Commandments 15 & 16)

1. **Granular Tools Only**: You MUST only use the tools provided. You may NEVER generate raw source code strings or full-file replacements. Every edit must target a specific data-bridge-id.

2. **No Hallucinated IDs**: Every targetId you use MUST come from the source code returned by bridge_read_code. Never invent or guess a bridge ID.

3. **No Hallucinated Styling**: Before proposing any className, call bridge_read_tokens. Only use token classes in the result.

4. **Preserve data-bridge-id**: Never remove or change a data-bridge-id attribute in any mutation.

5. **Accessibility First**: If your task touches interactive elements (button, a, input, img), call bridge_audit_a11y first. Fix violations as part of your response.

## Workflow

For every task:
1. bridge_read_code → understand the structure and collect real bridge IDs
2. bridge_read_tokens → get valid token classes (skip only for non-style tasks)
3. Propose the minimum set of granular tool calls needed
4. Always include concise reasoning in every tool call

Always be concise. The user is an engineer; skip preamble.`

// ── Chat Message Types ────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'assistant' | 'tool_call' | 'tool_result'
    content: string
    toolUseId?: string
    toolName?: string
    toolInput?: Record<string, unknown>
}

// ── V.1: Mutation Risk Score (MRS) types ──────────────────────────────────────
//
// Three-tier risk classification for the approval flow (0.0–1.0 scale).
//   green  (0.00–0.30) — auto-approve eligible
//   amber  (0.31–0.69) — requires human review
//   red    (0.70–1.00) — requires explicit sign-off

export type MRSTier = 'green' | 'amber' | 'red'

export interface MRSFactor {
    name: string
    contribution: number
    description: string
}

export interface MRSAssessment {
    tier: MRSTier
    score: number
    factors: MRSFactor[]
}

export interface OrchestratorChunk {
    type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'validation_error'
    text?: string
    toolName?: string
    toolInput?: Record<string, unknown>
    toolUseId?: string
    error?: string
    // ── V.1: MRS risk annotation (only present on mutation tool_call chunks) ──
    riskTier?: MRSTier
    riskScore?: number
    riskFactors?: MRSFactor[]
    requiresReview?: boolean
    requiresSignoff?: boolean
}

// ── LspRouter — maps active file extension to the correct ILspClient ──────────

/**
 * Returns the appropriate ILspClient for the given file path.
 * Falls back to the TypeScript LSP for unknown/unregistered extensions.
 */
function lspForFile(filePath?: string | null): ILspClient {
    if (!filePath) return tsLspClient
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'vue') return vueLspClient
    // html — no async snippet validation needed (HtmlAdapter stub returns null)
    if (ext === 'html') return tsLspClient
    return tsLspClient  // ts / tsx / js / jsx
}

// ── Phase M → N.3/N.5: ILspClient-backed Validator (Commandment 16) ──────────
//
// Before any mutation tool call is emitted to the UI for user confirmation,
// we assemble a minimal JSX/HTML fragment from the proposed operation and run
// it through an ILspClient. If validation fails, the error is returned so the
// orchestrator can feed it back to the AI invisibly.
//
// Using ILspClient (instead of direct Babel) makes this loop framework-agnostic:
// a VueAdapter or AngularAdapter can supply a Volar or Angular LS client.

const MUTATION_TOOL_NAMES = new Set([
    'bridge_update_props',
    'bridge_update_text',
    'bridge_insert_node',
    'bridge_wrap_node',
    'bridge_delete_node',
    'bridge_add_class',
    'bridge_remove_class',
])

// ── V.1: Stateless Mutation Risk Scorer (inline, no SQLite) ──────────────────
//
// A lightweight, purely functional MRS scorer. It mirrors the four-factor
// formula in bridge-mcp/src/core/governance/riskScoringService.ts (the
// stateless V.1-rs API section) but lives here so the main process does not
// need to import across the bridge-mcp package boundary.
//
// Formula:
//   mrs = clamp(opWeight×0.40 + blastRadius×0.35 + severity×0.15 + familiarity×0.10)
//
// Provenance source is always 'agent' in the orchestrator context — the AI
// is the only actor here.

/** Op risk weights (0.0–1.0) for each tool name. */
const MRS_OP_WEIGHTS: Record<string, number> = {
    bridge_update_text:    0.15,
    bridge_update_props:   0.20,
    bridge_add_class:      0.10,
    bridge_remove_class:   0.10,
    bridge_insert_node:    0.55,   // structural — above the 0.50 threshold
    bridge_wrap_node:      0.60,   // structural
    bridge_delete_node:    0.90,   // destructive — structural, highest weight
}

const MRS_UNKNOWN_OP_WEIGHT = 0.50

/**
 * Minimum tier floor for specific tools.
 * Ensures that destructive operations always reach a baseline tier regardless
 * of blast radius or violation context. The formula alone cannot guarantee the
 * correct tier with small affectedNodeCount, so policy floors enforce intent.
 *
 *   bridge_insert_node  → at least amber (structural insertion)
 *   bridge_wrap_node    → at least amber (structural wrapping)
 *   bridge_delete_node  → red (destructive — always requires sign-off)
 */
const MRS_TIER_FLOORS: Record<string, MRSTier> = {
    bridge_insert_node: 'amber',
    bridge_wrap_node:   'amber',
    bridge_delete_node: 'red',
}

function mrsClamped(n: number): number {
    return Math.round(Math.max(0.0, Math.min(1.0, n)) * 10000) / 10000
}

function mrsTier(score: number): MRSTier {
    if (score <= 0.30) return 'green'
    if (score <= 0.69) return 'amber'
    return 'red'
}

const MRS_TIER_RANK: Record<MRSTier, number> = { green: 0, amber: 1, red: 2 }

/** Apply a tier floor — never lower a computed tier. */
function applyTierFloor(computed: MRSTier, floor: MRSTier | undefined): MRSTier {
    if (!floor) return computed
    return MRS_TIER_RANK[floor] > MRS_TIER_RANK[computed] ? floor : computed
}

/**
 * Compute a stateless MRS assessment for a proposed mutation tool call.
 *
 * Formula:
 *   mrs = clamp(opWeight×0.40 + blastRadius×0.35 + severity×0.15 + familiarity×0.10)
 *
 * Policy tier floors are applied after the formula to guarantee minimum tiers
 * for structurally significant operations regardless of node count.
 *
 * Never throws — returns a green/0.0 assessment on any internal error.
 *
 * @param toolName         The Bridge tool name (e.g. 'bridge_delete_node').
 * @param affectedNodes    Number of nodes the op will touch (default 1).
 * @param hasViolations    True if the current file has active violations.
 */
function computeMRS(
    toolName: string,
    affectedNodes: number = 1,
    hasViolations: boolean = false,
): MRSAssessment {
    try {
        // Factor 1: operation weight (40%)
        const opWeightRaw = MRS_OP_WEIGHTS[toolName] ?? MRS_UNKNOWN_OP_WEIGHT
        const opContribution = mrsClamped(opWeightRaw * 0.40)
        const opFactor: MRSFactor = {
            name: 'opWeight',
            contribution: opContribution,
            description: `Operation '${toolName}' has base risk weight ${opWeightRaw.toFixed(2)}`,
        }

        // Factor 2: blast radius (35%)
        const blastRaw = Math.min(affectedNodes / 10, 1.0)
        const blastContribution = mrsClamped(blastRaw * 0.35)
        const blastFactor: MRSFactor = {
            name: 'blastRadius',
            contribution: blastContribution,
            description: `${affectedNodes} affected node(s); blast radius ${blastRaw.toFixed(2)}`,
        }

        // Factor 3: severity context (15%)
        const isStructural = opWeightRaw >= 0.50
        let severityRaw: number
        if (isStructural && !hasViolations) {
            severityRaw = 0.70  // structural op, no audit baseline
        } else if (hasViolations) {
            severityRaw = 0.30  // mutation on a file with known violations
        } else {
            severityRaw = 0.00
        }
        const severityContribution = mrsClamped(severityRaw * 0.15)
        const severityFactor: MRSFactor = {
            name: 'severity',
            contribution: severityContribution,
            description: isStructural && !hasViolations
                ? 'Structural op with no audit baseline'
                : hasViolations
                ? 'File has active violations'
                : 'No violation context',
        }

        // Factor 4: familiarity — always 'agent' provenance in orchestrator, neutral (10%)
        const familiarityContribution = mrsClamped(0.10 * 0.10)
        const familiarityFactor: MRSFactor = {
            name: 'familiarity',
            contribution: familiarityContribution,
            description: 'Agent-provenance mutation — neutral familiarity',
        }

        const rawScore =
            opContribution +
            blastContribution +
            severityContribution +
            familiarityContribution

        const score = mrsClamped(rawScore)
        const formulaTier = mrsTier(score)

        // Apply policy tier floor (never lower a computed tier)
        const tier = applyTierFloor(formulaTier, MRS_TIER_FLOORS[toolName])

        return {
            tier,
            score,
            factors: [opFactor, blastFactor, severityFactor, familiarityFactor],
        }
    } catch {
        // Fallback — never block the approval flow on a scorer error
        return { tier: 'green', score: 0.0, factors: [] }
    }
}

// ── Commandment 17: Mithril token loader ──────────────────────────────────────
//
// Reads all design tokens from the SQLite store synchronously (better-sqlite3
// is always synchronous). Returns an empty array if the table is missing or
// the query fails, so a token-less project is never blocked by this check.

const _loadTokensStmt = db.prepare(
    'SELECT token_path, token_type, token_value FROM design_tokens ORDER BY token_type, token_path',
)

function loadMithrilTokens(): MithrilToken[] {
    try {
        return _loadTokensStmt.all() as MithrilToken[]
    } catch {
        return []
    }
}

/**
 * Commandment 17: run the Mithril color-drift pre-commit check on a
 * proposed className string.
 *
 * Returns an error string if any arbitrary-color class deviates by more than
 * ΔE 2.0 from the nearest design token, or null if the className is compliant.
 * Returns null immediately when the project has no color tokens.
 */
function mithrilClassCheck(classNameString: string): string | null {
    const tokens = loadMithrilTokens()
    const violations = checkClassNameForColorDrift(classNameString, tokens)
    if (violations.length === 0) return null
    return formatViolationsForAI(violations)
}

/**
 * Validates a single mutation tool call.
 *
 * Synchronous guards (fast, zero I/O) fire first:
 *   • data-bridge-id tampering check
 *   • compound className guard
 *   • prop value type check
 *   • Commandment 17: Mithril color-drift pre-commit check
 *
 * Then async LSP validation fires for structural ops that produce JSX snippets:
 *   • bridge_insert_node  — checks the new element's JSX is valid TypeScript
 *   • bridge_wrap_node    — checks the wrapper element's JSX is valid TypeScript
 *
 * @param lsp  The ILspClient to use. Defaults to the shared tsLspClient singleton.
 */
async function validateToolInput(
    toolName: string,
    input: Record<string, unknown>,
    lsp: ILspClient = tsLspClient,
): Promise<string | null> {
    if (!MUTATION_TOOL_NAMES.has(toolName)) return null  // read-only tools always pass

    // ── Synchronous guards (no I/O) ─────────────────────────────────────────────
    if (toolName === 'bridge_update_props') {
        const props = (input.props as Record<string, string>) ?? {}
        for (const [k, v] of Object.entries(props)) {
            if (k === 'data-bridge-id') {
                return 'Commandment 7 violation: data-bridge-id must never be modified.'
            }
            if (typeof v !== 'string') {
                return `Prop "${k}" value must be a plain string, not a JS expression.`
            }
        }
        // ── Commandment 17: Mithril pre-commit check on className prop ────────
        // Only fires when the AI is setting className directly via bridge_update_props.
        const proposedClassName = typeof props['className'] === 'string' ? props['className'] : null
        if (proposedClassName !== null) {
            const mithrilError = mithrilClassCheck(proposedClassName)
            if (mithrilError !== null) {
                console.warn(`[Bridge] Commandment 17 blocked bridge_update_props: ${mithrilError}`)
                return mithrilError
            }
        }
        return null  // prop-only changes don't need LSP
    }

    if (toolName === 'bridge_add_class' || toolName === 'bridge_remove_class') {
        const className = typeof input.className === 'string' ? input.className : ''
        if (className.trim().includes(' ')) {
            return `className must be a single class token, not a compound string. Got: "${className}". Call this tool once per class.`
        }
        // ── Commandment 17: Mithril pre-commit check on the single class ──────
        // Only fires for bridge_add_class — removing a class can never introduce drift.
        if (toolName === 'bridge_add_class' && className.length > 0) {
            const mithrilError = mithrilClassCheck(className)
            if (mithrilError !== null) {
                console.warn(`[Bridge] Commandment 17 blocked bridge_add_class: ${mithrilError}`)
                return mithrilError
            }
        }
        return null  // class-level changes don't need LSP
    }

    // ── Async LSP validation (structural JSX ops) ──────────────────────────────
    let snippet: string | null = null

    if (toolName === 'bridge_insert_node') {
        const nodeType = typeof input.nodeType === 'string' ? input.nodeType : 'div'
        const children = typeof input.children === 'string' ? input.children : ''
        snippet = `const __v = <${nodeType}>${children}</${nodeType}>;`
    } else if (toolName === 'bridge_wrap_node') {
        const wrapperType = typeof input.wrapperType === 'string' ? input.wrapperType : 'div'
        snippet = `const __v = <${wrapperType}><div /></${wrapperType}>;`
    }

    if (snippet !== null) {
        const lspError = await lsp.validateSnippet(snippet)
        if (lspError !== null) return lspError

        // ── Commandment 17: Mithril pre-commit check on insert/wrap props ─────
        // Check className in the props object for bridge_insert_node.
        if (toolName === 'bridge_insert_node') {
            const insertProps = (input.props as Record<string, string> | undefined) ?? {}
            const insertClassName = typeof insertProps['className'] === 'string' ? insertProps['className'] : null
            if (insertClassName !== null) {
                const mithrilError = mithrilClassCheck(insertClassName)
                if (mithrilError !== null) {
                    console.warn(`[Bridge] Commandment 17 blocked bridge_insert_node: ${mithrilError}`)
                    return mithrilError
                }
            }
        }

        return null
    }

    return null  // all other ops pass by default
}

// ── Core: sendChatMessage ─────────────────────────────────────────────────────

/**
 * Sends a conversation to Anthropic and streams chunks back via the `onChunk`
 * callback, which is invoked for each text delta, tool_use block, and at completion.
 *
 * The caller (main.ts IPC handler) is responsible for forwarding each chunk to
 * the renderer via `event.sender.send('ai:chunk', chunk)`.
 */
export async function sendChatMessage(
    messages: ChatMessage[],
    onChunk: (chunk: OrchestratorChunk) => void,
    activeFilePath?: string | null,
): Promise<void> {
    const lsp = lspForFile(activeFilePath)
    const config = await readConfig()

    if (!config.apiKey) {
        onChunk({ type: 'error', error: 'No API key configured. Open AI Settings to set a key.' })
        return
    }

    // SEC P0-4: Only the Anthropic provider supports the constrained Bridge Tool
    // Catalog (Commandment 15) and in-memory validation loop (Commandment 16).
    // Non-Anthropic providers send plain chat completions with no tool-use,
    // which means governance enforcement is completely absent.
    if (config.provider && config.provider !== 'anthropic') {
        onChunk({
            type: 'error',
            error:
                'Bridge requires an Anthropic API key for AI-assisted editing. ' +
                'The Bridge Tool Catalog (Commandment 15) and in-memory validation ' +
                '(Commandment 16) are only enforced via Anthropic tool-use. ' +
                'Non-Anthropic providers bypass all governance checks. ' +
                'Please configure an Anthropic API key in AI Settings.',
        })
        return
    }

    try {
        // TODO: Option A — implement tool-use parity for OpenAI and Gemini providers.
        // The OpenAI branch (former lines 862-883) and Gemini branch (former lines 884-902)
        // sent plain chat completions with no tool declarations — Commandments 15 and 16
        // were completely unenforced. They have been removed per ADR P0-4 (Option B: hard gate).
        // When demand exists, implement provider-specific tool-use adapters in
        // electron/providers/openai-adapter.ts and electron/providers/gemini-adapter.ts.
        {
            // Anthropic branch — fully supports the Bridge Tool Catalog
            const client = new Anthropic({
                apiKey: config.apiKey,
                ...(config.baseURL ? { baseURL: config.baseURL } : {}),
            })
            const model = (config.model && config.model.length > 0 ? config.model : DEFAULT_MODEL) as Parameters<typeof client.messages.stream>[0]['model']

            const anthropicMessages: Anthropic.MessageParam[] = []

            for (const m of messages) {
                if (m.role === 'user' || m.role === 'assistant') {
                    const lastMsg = anthropicMessages[anthropicMessages.length - 1]
                    if (lastMsg && lastMsg.role === m.role) {
                        if (typeof lastMsg.content === 'string') {
                            lastMsg.content = [{ type: 'text', text: lastMsg.content }, { type: 'text', text: m.content }]
                        } else {
                            lastMsg.content.push({ type: 'text', text: m.content })
                        }
                    } else {
                        anthropicMessages.push({ role: m.role, content: m.content })
                    }
                } else if (m.role === 'tool_call') {
                    const lastMsg = anthropicMessages[anthropicMessages.length - 1]
                    const toolUseBlock = {
                        type: 'tool_use' as const,
                        id: m.toolUseId!,
                        name: m.toolName!,
                        input: m.toolInput || {}
                    }
                    if (lastMsg && lastMsg.role === 'assistant') {
                        if (typeof lastMsg.content === 'string') {
                            lastMsg.content = [{ type: 'text', text: lastMsg.content }]
                        }
                        // Anthropic SDK's ContentBlock union is strict on discriminant fields;
                        // use unknown intermediate to satisfy the type checker at the push site.
                        ; (lastMsg.content as unknown as Anthropic.MessageParam['content'] & unknown[]).push(toolUseBlock)
                    } else {
                        anthropicMessages.push({
                            role: 'assistant',
                            content: [toolUseBlock]
                        })
                    }
                } else if (m.role === 'tool_result') {
                    const lastMsg = anthropicMessages[anthropicMessages.length - 1]
                    const toolResultBlock = {
                        type: 'tool_result' as const,
                        tool_use_id: m.toolUseId!,
                        content: m.content,
                    }
                    if (lastMsg && lastMsg.role === 'user') {
                        if (typeof lastMsg.content === 'string') {
                            lastMsg.content = [{ type: 'text', text: lastMsg.content }]
                        }
                        ; (lastMsg.content as unknown as Anthropic.MessageParam['content'] & unknown[]).push(toolResultBlock)
                    } else {
                        anthropicMessages.push({
                            role: 'user',
                            content: [toolResultBlock]
                        })
                    }
                }
            }

            // ── ACX.4: Complexity Router (Commandment 8 — Audit-First Execution) ──
            // Classify the task before the Anthropic SDK call. Model selection is
            // overridden per-invocation; the user's saved config.model is not mutated.
            const routerInput = buildRouterInput(messages, activeFilePath)
            const assessment = buildAssessment(routerInput)
            const resolvedModel = assessment.selectedModel
            console.log(`[Bridge ACX] tier=${assessment.tier} model=${resolvedModel} reason="${assessment.reasoning}"`)

            // ── ACX.4: Sentinel domain prepend ────────────────────────────────
            // Read .bridge/policy.json for the optional domain field. If domain
            // is set and non-general, prepend a domain governance notice to the
            // system prompt so the model is context-aware during the call.
            let systemPromptForCall = SYSTEM_PROMPT
            try {
                const policyPath = path.join(
                    activeFilePath ? path.dirname(activeFilePath) : path.join(homedir(), '.bridge'),
                    '.bridge', 'policy.json',
                )
                if (existsSync(policyPath)) {
                    const policyRaw = await readFile(policyPath, 'utf-8')
                    const policy = JSON.parse(policyRaw) as { domain?: string }
                    if (policy.domain && policy.domain !== 'general') {
                        systemPromptForCall = `[Bridge Sentinel: domain=${policy.domain}]\n\n${SYSTEM_PROMPT}`
                    }
                }
            } catch {
                // Policy read failure is non-fatal — use base system prompt.
            }

            // ── ACX.4: Escalation state (local to this invocation) ────────────
            let currentModelIndex = 0
            const escalationPath = assessment.escalationPath
            let consecutiveValidationFailures = 0

            // Helper: run the Anthropic stream and process events.
            // Extracted to a nested async function so we can restart on escalation.
            const runStream = async (streamModel: string): Promise<boolean> => {
                const stream = await client.messages.stream({
                    model: streamModel as Parameters<typeof client.messages.stream>[0]['model'],
                    max_tokens: streamModel === 'claude-opus-4-5' ? 8192 : 4096,
                    system: systemPromptForCall,
                    tools: BRIDGE_TOOLS,
                    messages: anthropicMessages,
                })

                let hadValidationFailure = false

                for await (const event of stream) {
                    if (event.type === 'content_block_delta') {
                        if (event.delta.type === 'text_delta') {
                            onChunk({ type: 'text', text: event.delta.text })
                        }
                    } else if (event.type === 'content_block_start') {
                        if (event.content_block.type === 'tool_use') {
                            onChunk({
                                type: 'tool_call',
                                toolName: event.content_block.name,
                                toolUseId: event.content_block.id,
                                toolInput: {},
                            })
                        }
                    } else if (event.type === 'message_stop') {
                        const finalMsg = await stream.finalMessage()
                        for (const block of finalMsg.content) {
                            if (block.type === 'tool_use') {
                                const toolInput = block.input as Record<string, unknown>

                                // ── Commandment 16: ILspClient Validation (Phase N.3) ──────
                                const validationError = await validateToolInput(block.name, toolInput, lsp)
                                if (validationError) {
                                    console.warn(`[Bridge] Phase M validation blocked tool ${block.name}: ${validationError}`)
                                    onChunk({
                                        type: 'validation_error',
                                        toolName: block.name,
                                        toolUseId: block.id,
                                        error: validationError,
                                    })
                                    hadValidationFailure = true
                                } else {
                                    // ── V.1: MRS risk annotation ─────────────────────────
                                    // Risk scoring only applies to mutation tools. Read-only
                                    // tools pass through with no risk annotation.
                                    if (MUTATION_TOOL_NAMES.has(block.name)) {
                                        const violationsActive = loadCurrentViolationCount() > 0

                                        // ── 1C: Extract real blast radius from tool input ────
                                        let blastRadius = 1
                                        if (block.name === 'bridge_ast_mutate') {
                                            const mutations = (toolInput as Record<string, unknown>).mutations
                                            if (Array.isArray(mutations)) {
                                                blastRadius = mutations.length
                                            }
                                        }
                                        // bridge_insert_node, bridge_wrap_node, bridge_delete_node → 1 (default)

                                        const mrs = computeMRS(block.name, blastRadius, violationsActive)
                                        console.log(`[Bridge MRS] tool=${block.name} score=${mrs.score} tier=${mrs.tier} blast=${blastRadius}`)

                                        // ── 1A: Record risk + check escalation ───────────────
                                        const agentId = 'orchestrator'
                                        escalationEngine.recordMutationRisk(agentId, mrs.tier, mrs.score)
                                        const escalations = escalationEngine.checkEscalation(agentId)

                                        // If any escalation has block_mutations action, reject
                                        const blocked = escalationEngine.hasActiveAction(agentId, 'block_mutations')
                                        if (blocked) {
                                            const blockEsc = escalations.find(e => e.action.type === 'block_mutations')
                                                ?? escalationEngine.getActiveEscalations(agentId).find(e => e.action.type === 'block_mutations')
                                            onChunk({
                                                type: 'error',
                                                error: `[AGV.3] Mutation blocked by escalation rule ${blockEsc?.ruleId ?? 'unknown'}: ${blockEsc?.reason ?? 'agent risk threshold exceeded'}`,
                                            })
                                            hadValidationFailure = true
                                            continue
                                        }

                                        // If any escalation requires review, force it
                                        let requiresReview = mrs.tier === 'amber'
                                        if (escalationEngine.hasActiveAction(agentId, 'require_review')) {
                                            requiresReview = true
                                        }

                                        onChunk({
                                            type: 'tool_call',
                                            toolName: block.name,
                                            toolUseId: block.id,
                                            toolInput,
                                            riskTier: mrs.tier,
                                            riskScore: mrs.score,
                                            riskFactors: mrs.factors,
                                            requiresReview,
                                            requiresSignoff: mrs.tier === 'red',
                                        })
                                    } else {
                                        onChunk({
                                            type: 'tool_call',
                                            toolName: block.name,
                                            toolUseId: block.id,
                                            toolInput,
                                        })
                                    }
                                }
                            }
                        }
                        onChunk({ type: 'done' })
                    }
                }

                return hadValidationFailure
            }

            // ── ACX.4: Run with escalation on consecutive validation failures ──
            const hadFailure = await runStream(escalationPath[currentModelIndex])
            if (hadFailure) {
                consecutiveValidationFailures++
                // Escalate if we have failures and there is a next model in the path.
                if (consecutiveValidationFailures >= 2 && currentModelIndex < escalationPath.length - 1) {
                    currentModelIndex++
                    consecutiveValidationFailures = 0
                    console.log(`[Bridge ACX] escalating to model=${escalationPath[currentModelIndex]}`)
                    await runStream(escalationPath[currentModelIndex])
                }
            }
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        onChunk({ type: 'error', error: `API error: ${msg}` })
    }
}
