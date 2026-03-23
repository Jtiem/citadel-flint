/**
 * orchestrator.ts — electron/orchestrator.ts
 *
 * The Flint Auditor: LLM adapter for the Orchestration Engine (Phase M).
 *
 * Responsibilities:
 *   1. Reads ~/.flint/config.json for the API key + provider setting.
 *   2. Exposes sendChatMessage() — streams Anthropic responses with tool use.
 *   3. Defines the Flint Tool Catalog (Phase M — Commandment 15): the exact
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
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { BRAND, logTag } from '../shared/brand.ts'
import { tsLspClient } from './lsp/TypeScriptLspClient'
import { vueLspClient } from './lsp/VueLspClient'
import type { ILspClient } from './lsp/types'
// ── AGV.3: Auto-Escalation Engine ───────────────────────────────────────────
import { escalationEngine } from './agentEscalation.js'
// ── V.4: Epistemic Consensus Gate ────────────────────────────────────────────
import {
    resolveConfig as resolveConsensusConfig,
    shouldFireGate,
    evaluate as runConsensusGate,
    type ConsensusOutcome,
} from './consensusGateService.js'

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
        input.priorToolNames.includes('flint_insert_node') ||
        input.priorToolNames.includes('flint_wrap_node') ||
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

    if (input.priorToolNames.includes('flint_insert_node') || input.priorToolNames.includes('flint_wrap_node')) {
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
        const row = _violationCountStmt.get({}) as { count: number } | undefined
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

export interface FlintAIConfig {
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

const CONFIG_PATH = path.join(homedir(), BRAND.configDir, 'config.json')

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
 * Reads `~/.flint/config.json` and resolves the API key securely.
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
export async function readConfig(): Promise<Partial<FlintAIConfig>> {
    try {
        if (!existsSync(CONFIG_PATH)) return {}
        const raw = await readFile(CONFIG_PATH, 'utf-8')
        const cfg = JSON.parse(raw) as Partial<FlintAIConfig>

        // Preferred path: encrypted key present.
        if (typeof cfg.apiKeyEncrypted === 'string' && cfg.apiKeyEncrypted.length > 0) {
            if (safeStorage.isEncryptionAvailable()) {
                const decrypted = decryptApiKey(cfg.apiKeyEncrypted)
                if (decrypted !== null) {
                    // Return the live key as `apiKey` so all call sites remain unchanged.
                    return { ...cfg, apiKey: decrypted }
                }
                // Decryption failed — fall through to legacy path (may be undefined).
                console.warn(`${BRAND.logPrefix} safeStorage: failed to decrypt apiKeyEncrypted; key unavailable`)
                return { ...cfg, apiKey: undefined }
            }
            // safeStorage unavailable (CI/headless) — key is not accessible.
            console.warn(`${BRAND.logPrefix} safeStorage: encryption unavailable; apiKeyEncrypted cannot be decrypted`)
            return { ...cfg, apiKey: undefined }
        }

        // Legacy path: plaintext apiKey still on disk.
        if (typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0) {
            if (!safeStorage.isEncryptionAvailable()) {
                // Headless / CI fallback — use plaintext with a warning.
                console.warn(`${BRAND.logPrefix} safeStorage: encryption unavailable; using plaintext API key fallback`)
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
 * Persists a config patch to `~/.flint/config.json`.
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
export async function writeConfig(config: Partial<FlintAIConfig>): Promise<void> {
    const dir = path.dirname(CONFIG_PATH)
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })

    // Read the raw disk bytes to preserve fields we are not explicitly patching.
    // We read raw JSON (not via readConfig) to avoid inadvertently decrypting
    // and re-encrypting the key on every write, which would change the ciphertext.
    let existing: Partial<FlintAIConfig> = {}
    try {
        if (existsSync(CONFIG_PATH)) {
            existing = JSON.parse(await readFile(CONFIG_PATH, 'utf-8')) as Partial<FlintAIConfig>
        }
    } catch { /* ignore */ }

    const merged: Partial<FlintAIConfig> = { ...existing, ...config }

    // SEC.4: If a live apiKey is being written and safeStorage is available,
    // encrypt it and strip the plaintext field from disk.
    // Note: the first call to safeStorage triggers a macOS Keychain permission
    // dialog. This only happens when the user explicitly saves an API key, so
    // the context is clear ("I entered a key → the app wants to store it safely").
    if (typeof merged.apiKey === 'string' && merged.apiKey.length > 0) {
        if (safeStorage.isEncryptionAvailable()) {
            merged.apiKeyEncrypted = encryptApiKey(merged.apiKey)
            delete merged.apiKey   // no plaintext at rest
        } else {
            // Headless / CI fallback — keep plaintext with a warning.
            console.warn(`${BRAND.logPrefix} safeStorage: encryption unavailable; API key stored in plaintext`)
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

// ── Flint Tool Catalog (Phase M — Commandment 15) ───────────────────────────
//
// These are the ONLY operations the AI is allowed to request (Commandment 15).
// Raw code strings, full-file replacements, and regex patches are
// structurally prohibited — the LLM cannot emit them because no tool
// in this catalog accepts them.

export const FLINT_TOOLS: Anthropic.Tool[] = [
    {
        name: 'flint_read_code',
        description:
            'Read the current source code of the active file. Use this FIRST to understand component structure before proposing any changes.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
        name: 'flint_read_tokens',
        description:
            'Read all design tokens from the Flint token store. You MUST call this before proposing any className or style change. Only use token values that appear in this list. Never invent hex colours or pixel values.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
        name: 'flint_audit_mithril',
        description:
            'Read all current Mithril Safety violations (color drift ΔE, typography, spacing, shadow, opacity). Use this to understand design system debt before proposing changes.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
        name: 'flint_audit_a11y',
        description:
            'Read all current WCAG 2.1 AA accessibility violations. Verify your proposed changes do not introduce new violations.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    // ── Mutation tools (Phase M — strictly granular, node-targeted) ─────────────
    {
        name: 'flint_update_props',
        description:
            `Modify one or more JSX attributes on a single target node.

Commandment 15 rules (mandatory):
- targetId MUST be a data-flint-id value read from flint_read_code. Never invent IDs.
- Never remove or change a data-flint-id attribute.
- className values MUST use Tailwind classes mapped to tokens from flint_read_tokens.
- Only call flint_read_tokens first if you haven't already in this turn.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the target JSX element.' },
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
        name: 'flint_update_text',
        description: 'Modify the visible text content of a single JSX element. Use this for copy changes, label updates, and heading edits.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the target JSX element.' },
                text: { type: 'string', description: 'New text content to set.' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'text', 'reasoning'],
        },
    },
    {
        name: 'flint_insert_node',
        description:
            `Insert a new JSX element relative to an existing target node.
position: 'before' | 'after' | 'firstChild' | 'lastChild'
Only use element types that exist in the design system read from flint_read_tokens or the source file imports.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the reference node.' },
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
        name: 'flint_wrap_node',
        description: 'Wrap an existing JSX element in a new parent element. Use for layout restructuring only.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the node to wrap.' },
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
        name: 'flint_delete_node',
        description: 'Remove a JSX element and all its children from the tree. This also clears any component_overrides rows for the deleted node.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the element to remove.' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'reasoning'],
        },
    },
    {
        name: 'flint_add_class',
        description: 'Append one design-token Tailwind class to a node\'s className. Call flint_read_tokens first to find valid class names.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the target node.' },
                className: { type: 'string', description: 'Single Tailwind class to add, e.g. "mt-4" or "bg-brand-primary".' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'className', 'reasoning'],
        },
    },
    {
        name: 'flint_remove_class',
        description: 'Remove one specific Tailwind class from a node\'s className.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the target node.' },
                className: { type: 'string', description: 'Exact class string to remove.' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'className', 'reasoning'],
        },
    },
    // ── CATALOG.1: Hook + Handler + Callback + Import emission ─────────────────
    {
        name: 'flint_emit_hook',
        description: 'Inject a React hook call (useState, useEffect, useRef, etc.) at the top of a component function body. Respects Rules of Hooks.',
        input_schema: {
            type: 'object' as const,
            properties: {
                componentName: { type: 'string', description: 'Name of the target component function.' },
                hookStatement: { type: 'string', description: 'Full hook call, e.g. "const [count, setCount] = useState(0)"' },
                importSnippet: { type: 'string', description: 'Import to add if needed.' },
                reasoning: { type: 'string', description: 'One-sentence explanation.' },
            },
            required: ['componentName', 'hookStatement', 'reasoning'],
        },
    },
    {
        name: 'flint_emit_handler',
        description: 'Inject a named handler function inside a component body (below hooks, above return).',
        input_schema: {
            type: 'object' as const,
            properties: {
                componentName: { type: 'string', description: 'Name of the target component function.' },
                handlerCode: { type: 'string', description: 'Full handler declaration.' },
                reasoning: { type: 'string', description: 'One-sentence explanation.' },
            },
            required: ['componentName', 'handlerCode', 'reasoning'],
        },
    },
    {
        name: 'flint_emit_callback',
        description: 'Wire a handler reference to an event prop on a JSX element. Creates onClick={expression}.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the target element.' },
                propName: { type: 'string', description: 'Event prop name, e.g. "onClick".' },
                expression: { type: 'string', description: 'JS expression, e.g. "handleClick".' },
                reasoning: { type: 'string', description: 'One-sentence explanation.' },
            },
            required: ['targetId', 'propName', 'expression', 'reasoning'],
        },
    },
    {
        name: 'flint_emit_import',
        description: 'Add an import declaration to the file. Deduplicates at the specifier level.',
        input_schema: {
            type: 'object' as const,
            properties: {
                importSnippet: { type: 'string', description: 'Full import statement.' },
                reasoning: { type: 'string', description: 'One-sentence explanation.' },
            },
            required: ['importSnippet', 'reasoning'],
        },
    },
    // ── CATALOG.2: Conditional rendering + array mapping ───────────────────────
    {
        name: 'flint_emit_conditional',
        description:
            'Wrap a JSX element in a conditional guard. Mode "and" produces {condition && <Element/>}. Mode "ternary" produces {condition ? <Element/> : <Fallback/>}.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the element to conditionally render.' },
                condition: { type: 'string', description: 'JS boolean expression, e.g. "isOpen" or "items.length > 0".' },
                mode: { type: 'string', enum: ['and', 'ternary'], description: '"and" for && guard, "ternary" for ternary with fallback.' },
                fallback: { type: 'string', description: 'For ternary mode: fallback JSX or "null". Ignored in "and" mode.' },
                reasoning: { type: 'string', description: 'One-sentence explanation.' },
            },
            required: ['targetId', 'condition', 'mode', 'reasoning'],
        },
    },
    {
        name: 'flint_emit_map',
        description:
            'Wrap a JSX element in an array.map() to render it for each item. Automatically injects a key prop (Commandment 3). The keyExpression must reference a stable identifier, not the array index.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-flint-id of the template element to repeat.' },
                arrayExpression: { type: 'string', description: 'Array to iterate, e.g. "items" or "users.filter(u => u.active)".' },
                iteratorName: { type: 'string', description: 'Iterator parameter name, e.g. "item".' },
                keyExpression: { type: 'string', description: 'Stable key expression, e.g. "item.id". Must not be "index".' },
                reasoning: { type: 'string', description: 'One-sentence explanation.' },
            },
            required: ['targetId', 'arrayExpression', 'iteratorName', 'keyExpression', 'reasoning'],
        },
    },
    // ── CATALOG.3: Compound component support ─────────────────────────────────
    {
        name: 'flint_compose_slot',
        description:
            'Insert content into a compound component slot (e.g., Dialog.Header, Tabs.Panel). If the slot does not exist, it is created.',
        input_schema: {
            type: 'object' as const,
            properties: {
                parentId: { type: 'string', description: 'data-flint-id of the compound component root.' },
                slotName: { type: 'string', description: 'Dotted slot name, e.g. "Dialog.Header".' },
                jsxSnippet: { type: 'string', description: 'JSX content to inject into the slot.' },
                importSnippet: { type: 'string', description: 'Optional import to add.' },
                reasoning: { type: 'string', description: 'One-sentence explanation.' },
            },
            required: ['parentId', 'slotName', 'jsxSnippet', 'reasoning'],
        },
    },
    // ── Phase M: Design System RAG Search ─────────────────────────────────────
    {
        name: 'flint_search_design_system',
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
    // ── CATALOG.4: Prop validation (advisory, read-only) ─────────────────────
    {
        name: 'flint_validate_props',
        description: 'Type-check props against a component interface from the registry. Advisory: use before proposing prop changes. Returns validation errors or confirms compatibility.',
        input_schema: {
            type: 'object' as const,
            properties: {
                componentName: { type: 'string', description: 'Component name to validate against.' },
                props: { type: 'object', description: 'Props to validate.' },
                reasoning: { type: 'string', description: 'Why this validation is needed.' },
            },
            required: ['componentName', 'props', 'reasoning'],
        },
    },
]

// ── System Prompt (Phase M) ───────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are the Flint Auditor, an AI assistant integrated into Flint IDE — the world's first Agentic UI Operating System. Your role is to make precise, design-system-compliant, accessible component edits using the Flint tool catalog.

## Non-Negotiable Rules (Commandments 15 & 16)

1. **Granular Tools Only**: You MUST only use the tools provided. You may NEVER generate raw source code strings or full-file replacements. Every edit must target a specific data-flint-id.

2. **No Hallucinated IDs**: Every targetId you use MUST come from the source code returned by flint_read_code. Never invent or guess a flint ID.

3. **No Hallucinated Styling**: Before proposing any className, call flint_read_tokens. Only use token classes in the result.

4. **Preserve data-flint-id**: Never remove or change a data-flint-id attribute in any mutation.

5. **Accessibility First**: If your task touches interactive elements (button, a, input, img), call flint_audit_a11y first. Fix violations as part of your response.

## Workflow

For every task:
1. flint_read_code → understand the structure and collect real flint IDs
2. flint_read_tokens → get valid token classes (skip only for non-style tasks)
3. Propose the minimum set of granular tool calls needed
4. Always include concise reasoning in every tool call

Always be concise. The user is an engineer; skip preamble.

## Interactive UI Workflow

When adding interactivity to a component:
1. flint_emit_hook — add state (useState, useRef, etc.)
2. flint_emit_handler — add event handler functions that reference the state
3. flint_emit_callback — wire the handlers to JSX event props (onClick, onChange)
4. flint_emit_conditional — add conditional rendering guards for state-dependent UI
5. flint_emit_map — render lists with automatic key prop injection

Always declare hooks before handlers, and handlers before wiring them to elements.
Do not inline complex logic in flint_emit_callback — use flint_emit_handler first.`

// ── Chat Message Types ────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'assistant' | 'tool_call' | 'tool_result'
    content: string
    toolUseId?: string
    toolName?: string
    toolInput?: Record<string, unknown>
}

// ── V.1: Mutation Risk Score (MRS) — re-exports from mrsEngine.ts ─────────────
export type { MRSTier, MRSFactor, MRSAssessment } from './mrsEngine.js'
import type { MRSTier, MRSFactor } from './mrsEngine.js'

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
    // ── V.4: Consensus Gate annotation ───────────────────────────────────────
    /** Consensus outcome when the gate fired (amber/red mutations only). */
    consensusOutcome?: ConsensusOutcome
    /** Secondary agent's reasoning (only present when consensus gate fired). */
    consensusReasoning?: string
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
    'flint_update_props',
    'flint_update_text',
    'flint_insert_node',
    'flint_wrap_node',
    'flint_delete_node',
    'flint_add_class',
    'flint_remove_class',
    // CATALOG.1
    'flint_emit_hook',
    'flint_emit_handler',
    'flint_emit_callback',
    'flint_emit_import',
    // CATALOG.2
    'flint_emit_conditional',
    'flint_emit_map',
    // CATALOG.3
    'flint_compose_slot',
])

// ── V.1: Stateless Mutation Risk Scorer — imported from mrsEngine.ts ─────────
import { computeMRS } from './mrsEngine.js'

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
 *   • data-flint-id tampering check
 *   • compound className guard
 *   • prop value type check
 *   • Commandment 17: Mithril color-drift pre-commit check
 *
 * Then async LSP validation fires for structural ops that produce JSX snippets:
 *   • flint_insert_node  — checks the new element's JSX is valid TypeScript
 *   • flint_wrap_node    — checks the wrapper element's JSX is valid TypeScript
 *
 * @param lsp  The ILspClient to use. Defaults to the shared tsLspClient singleton.
 */
async function validateToolInput(
    toolName: string,
    input: Record<string, unknown>,
    lsp: ILspClient = tsLspClient,
): Promise<string | null> {
    if (!MUTATION_TOOL_NAMES.has(toolName)) return null  // read-only tools always pass

    // ── CR.2: Registry membership check ──────────────────────────────────────────
    // Uses activeRegistry (scope-filtered) set at the beginning of sendChatMessage.
    const membershipError = validateRegistryMembership(toolName, input, activeRegistry)
    if (membershipError !== null) return membershipError

    // ── Synchronous guards (no I/O) ─────────────────────────────────────────────
    if (toolName === 'flint_update_props') {
        const props = (input.props as Record<string, string>) ?? {}
        for (const [k, v] of Object.entries(props)) {
            if (k === 'data-flint-id') {
                return 'Commandment 7 violation: data-flint-id must never be modified.'
            }
            if (typeof v !== 'string') {
                return `Prop "${k}" value must be a plain string, not a JS expression.`
            }
        }
        // ── Commandment 17: Mithril pre-commit check on className prop ────────
        // Only fires when the AI is setting className directly via flint_update_props.
        const proposedClassName = typeof props['className'] === 'string' ? props['className'] : null
        if (proposedClassName !== null) {
            const mithrilError = mithrilClassCheck(proposedClassName)
            if (mithrilError !== null) {
                console.warn(`${BRAND.logPrefix} Commandment 17 blocked flint_update_props: ${mithrilError}`)
                return mithrilError
            }
        }
        // CATALOG.4: If the target component is in the registry, validate prop types via LSP
        const targetComponent = typeof input.targetId === 'string' ? extractComponentNameFromId(input.targetId) : null
        if (targetComponent) {
            const typeStub = buildPropTypeStub(targetComponent)
            if (typeStub) {
                const propEntries = Object.entries(props).map(([k, v]) => `${k}="${v}"`).join(' ')
                const augmentedSnippet = `${typeStub}\nconst __v = <${targetComponent} ${propEntries} />;`
                const lspError = await lsp.validateSnippet(augmentedSnippet)
                if (lspError !== null) return `Prop type mismatch: ${lspError}`
            }
        }
        return null
    }

    if (toolName === 'flint_add_class' || toolName === 'flint_remove_class') {
        const className = typeof input.className === 'string' ? input.className : ''
        if (className.trim().includes(' ')) {
            return `className must be a single class token, not a compound string. Got: "${className}". Call this tool once per class.`
        }
        // ── Commandment 17: Mithril pre-commit check on the single class ──────
        // Only fires for flint_add_class — removing a class can never introduce drift.
        if (toolName === 'flint_add_class' && className.length > 0) {
            const mithrilError = mithrilClassCheck(className)
            if (mithrilError !== null) {
                console.warn(`${BRAND.logPrefix} Commandment 17 blocked flint_add_class: ${mithrilError}`)
                return mithrilError
            }
        }
        return null  // class-level changes don't need LSP
    }

    // ── Async LSP validation (structural JSX ops) ──────────────────────────────
    let snippet: string | null = null

    if (toolName === 'flint_insert_node') {
        const nodeType = typeof input.nodeType === 'string' ? input.nodeType : 'div'
        const children = typeof input.children === 'string' ? input.children : ''
        snippet = `const __v = <${nodeType}>${children}</${nodeType}>;`
    } else if (toolName === 'flint_wrap_node') {
        const wrapperType = typeof input.wrapperType === 'string' ? input.wrapperType : 'div'
        snippet = `const __v = <${wrapperType}><div /></${wrapperType}>;`
    }

    if (snippet !== null) {
        const lspError = await lsp.validateSnippet(snippet)
        if (lspError !== null) return lspError

        // ── Commandment 17: Mithril pre-commit check on insert/wrap props ─────
        // Check className in the props object for flint_insert_node.
        if (toolName === 'flint_insert_node') {
            const insertProps = (input.props as Record<string, string> | undefined) ?? {}
            const insertClassName = typeof insertProps['className'] === 'string' ? insertProps['className'] : null
            if (insertClassName !== null) {
                const mithrilError = mithrilClassCheck(insertClassName)
                if (mithrilError !== null) {
                    console.warn(`${BRAND.logPrefix} Commandment 17 blocked flint_insert_node: ${mithrilError}`)
                    return mithrilError
                }
            }
        }

        return null
    }

    // ── CATALOG.1: hook / handler / callback / import validation ──────────────
    if (toolName === 'flint_emit_hook') {
        const hookStatement = typeof input.hookStatement === 'string' ? input.hookStatement : ''
        const syntheticFn = `function __FlintValidate() {\n  ${hookStatement}\n  return null;\n}`
        const lspError = await lsp.validateSnippet(syntheticFn)
        if (lspError !== null) return `flint_emit_hook: invalid hookStatement — ${lspError}`
        return null
    }

    if (toolName === 'flint_emit_handler') {
        const handlerCode = typeof input.handlerCode === 'string' ? input.handlerCode : ''
        const syntheticFn = `function __FlintValidate() {\n  ${handlerCode}\n  return null;\n}`
        const lspError = await lsp.validateSnippet(syntheticFn)
        if (lspError !== null) return `flint_emit_handler: invalid handlerCode — ${lspError}`
        return null
    }

    if (toolName === 'flint_emit_callback') {
        const propName = typeof input.propName === 'string' ? input.propName : 'onClick'
        const expression = typeof input.expression === 'string' ? input.expression : ''
        const syntheticJSX = `const __v = <div ${propName}={${expression}} />;`
        const lspError = await lsp.validateSnippet(syntheticJSX)
        if (lspError !== null) return `flint_emit_callback: invalid expression — ${lspError}`
        return null
    }

    // ── CATALOG.2: conditional / map validation ────────────────────────────────
    if (toolName === 'flint_emit_conditional') {
        const condition = typeof input.condition === 'string' ? input.condition : ''
        const mode = typeof input.mode === 'string' ? input.mode : 'and'
        const fallback = typeof input.fallback === 'string' ? input.fallback : 'null'
        const syntheticJSX = mode === 'ternary'
            ? `const __v = <>{${condition} ? <div /> : ${fallback}}</>;`
            : `const __v = <>{${condition} && <div />}</>;`
        const lspError = await lsp.validateSnippet(syntheticJSX)
        if (lspError !== null) return `flint_emit_conditional: invalid condition — ${lspError}`
        return null
    }

    if (toolName === 'flint_emit_map') {
        const keyExpression = typeof input.keyExpression === 'string' ? input.keyExpression : ''
        if (keyExpression === 'index' || keyExpression.endsWith('.index')) {
            return 'Commandment 3 violation: keyExpression must not be "index". Use a stable identifier like "item.id".'
        }
        const arrayExpression = typeof input.arrayExpression === 'string' ? input.arrayExpression : 'items'
        const iteratorName = typeof input.iteratorName === 'string' ? input.iteratorName : 'item'
        const syntheticJSX = `const __v = <>{${arrayExpression}.map((${iteratorName}) => <div key={${keyExpression}} />)}</>;`
        const lspError = await lsp.validateSnippet(syntheticJSX)
        if (lspError !== null) return `flint_emit_map: invalid expression — ${lspError}`
        return null
    }

    return null  // all other ops pass by default
}

// ── CATALOG.4: LSP-backed prop validation ─────────────────────────────────────

interface PropDef { type: string; required: boolean; default?: string }
interface RegistryEntry {
    name: string
    props?: Record<string, PropDef>
    /** Allowed variant string values (e.g. ["primary", "secondary", "ghost"]) */
    variants?: string[]
    /** Design token names consumed by this component (e.g. ["color.primary"]) */
    tokens?: string[]
    /** Optional import path for reference */
    importPath?: string
    /** Optional description */
    description?: string
}

/** Cached registry — reloaded at the start of each sendChatMessage call. */
let cachedRegistry: Record<string, RegistryEntry> = {}

/**
 * Active (scope-filtered) registry for the current sendChatMessage invocation.
 * Updated at the start of each call. Equals cachedRegistry when no scope is set.
 */
let activeRegistry: Record<string, RegistryEntry> = {}

// ── HTML intrinsic tag set — never require registry membership ─────────────────
const HTML_INTRINSICS = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'section', 'article', 'nav', 'main', 'header', 'footer', 'aside',
    'ul', 'ol', 'li', 'a', 'img', 'button', 'input', 'textarea', 'select',
    'form', 'label', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot',
    'details', 'summary', 'dialog', 'figure', 'figcaption', 'blockquote',
    'pre', 'code', 'hr', 'br', 'svg', 'path',
])

/**
 * CR.1 — Serialize the component registry into a BINDING markdown constraint block.
 *
 * The block instructs the model to use only registered components. Empty registry
 * returns an empty string (backward compatible — no constraint on token-less projects).
 *
 * @param registry  The (optionally scope-filtered) registry map.
 * @param scope     Optional allow-list of component names. When non-empty, only
 *                  entries whose key appears in scope are included.
 */
export function serializeRegistryConstraints(
    registry: Record<string, RegistryEntry>,
    scope?: string[],
): string {
    if (!registry || Object.keys(registry).length === 0) return ''

    // Apply scope filter when provided and non-empty
    let entries = Object.entries(registry)
    if (scope && scope.length > 0) {
        const scopeSet = new Set(scope)
        entries = entries.filter(([key]) => scopeSet.has(key))
    }

    if (entries.length === 0) return ''

    const MAX_COMPONENTS = 40
    const total = entries.length
    const truncated = entries.length > MAX_COMPONENTS
    const slice = truncated ? entries.slice(0, MAX_COMPONENTS) : entries

    const lines: string[] = [
        '## Project Component Registry (BINDING)',
        '',
        'You MUST only compose UI from components in this registry. Do NOT reference, create, or import components not listed here. If the user\'s request cannot be fulfilled with these components, explain what\'s missing.',
        '',
        'Available components:',
    ]

    for (const [key, entry] of slice) {
        const name = entry.name ?? key
        const parts: string[] = []

        // Props — mark required ones with [required]
        if (entry.props && Object.keys(entry.props).length > 0) {
            const propList = Object.entries(entry.props)
                .map(([pName, pDef]) => pDef.required ? `${pName}[required]` : pName)
                .join(', ')
            parts.push(`props: ${propList}`)
        }

        // Variants
        if (entry.variants && entry.variants.length > 0) {
            parts.push(`variants: ${entry.variants.join(', ')}`)
        }

        // Consumed tokens
        if (entry.tokens && entry.tokens.length > 0) {
            parts.push(`tokens: ${entry.tokens.join(', ')}`)
        }

        const detail = parts.length > 0 ? ` (${parts.join(') (')})` : ''
        lines.push(`- ${name}${detail}`)
    }

    if (truncated) {
        lines.push(`\n${MAX_COMPONENTS} of ${total} components shown. Use flint_search_design_system for the full catalog.`)
    }

    return lines.join('\n')
}

/**
 * CR.1 — Serialize the design token palette into a BINDING markdown constraint block.
 *
 * Tokens are grouped by token_type. Empty token array returns an empty string.
 *
 * @param tokens  All MithrilToken rows from the SQLite design_tokens table.
 */
export function serializeTokenConstraints(tokens: MithrilToken[]): string {
    if (!tokens || tokens.length === 0) return ''

    // Group by token_type
    const groups: Record<string, MithrilToken[]> = {}
    for (const token of tokens) {
        const type = token.token_type ?? 'other'
        if (!groups[type]) groups[type] = []
        groups[type].push(token)
    }

    const lines: string[] = [
        '## Design Token Palette (BINDING)',
        '',
        'All visual properties MUST use these tokens. Do NOT use arbitrary hex colors, pixel values, or spacing values not in this list.',
        '',
    ]

    // Irregular/uncountable token type labels
    const TOKEN_TYPE_LABELS: Record<string, string> = {
        color: 'Colors',
        typography: 'Typography',
        spacing: 'Spacing',
        shadow: 'Shadows',
        opacity: 'Opacity',
        radius: 'Radius',
        other: 'Other',
    }

    for (const [type, group] of Object.entries(groups)) {
        // Capitalize type name; use lookup table for irregular forms
        const label = TOKEN_TYPE_LABELS[type] ?? (type.charAt(0).toUpperCase() + type.slice(1) + 's')
        // Format: "Type: token-path (value), token-path (value)"
        const entries = group
            .map(t => `${t.token_path} (${t.token_value})`)
            .join(', ')
        lines.push(`${label}: ${entries}`)
    }

    return lines.join('\n')
}

/**
 * CR.2 — Validate that a component-creating tool call targets a registered component.
 *
 * Only checks tools that create or reference component types:
 *   - flint_insert_node  → checks input.nodeType
 *   - flint_wrap_node    → checks input.wrapperType
 *   - flint_compose_slot → checks root component of input.slotName (e.g. "Dialog" from "Dialog.Header")
 *
 * HTML intrinsics are always allowed.
 * When the registry is empty, all components pass (no constraint imposed).
 *
 * @returns Error string if the component is not in the registry; null if it passes.
 */
export function validateRegistryMembership(
    toolName: string,
    input: Record<string, unknown>,
    registry: Record<string, RegistryEntry>,
): string | null {
    // Only check component-creating tools
    if (
        toolName !== 'flint_insert_node' &&
        toolName !== 'flint_wrap_node' &&
        toolName !== 'flint_compose_slot'
    ) {
        return null
    }

    // Empty registry — no constraint
    if (!registry || Object.keys(registry).length === 0) return null

    // Extract the component name from the correct field per tool
    let componentName: string | null = null

    if (toolName === 'flint_insert_node') {
        componentName = typeof input.nodeType === 'string' ? input.nodeType : null
    } else if (toolName === 'flint_wrap_node') {
        componentName = typeof input.wrapperType === 'string' ? input.wrapperType : null
    } else if (toolName === 'flint_compose_slot') {
        const slotName = typeof input.slotName === 'string' ? input.slotName : ''
        // Extract root: "Dialog.Header" → "Dialog"
        componentName = slotName.split('.')[0] ?? null
    }

    if (!componentName || componentName.trim() === '') return null

    // Allow HTML intrinsics (case-sensitive — JSX elements are always lowercase for intrinsics)
    if (HTML_INTRINSICS.has(componentName.toLowerCase()) && componentName[0] === componentName[0]?.toLowerCase()) {
        return null
    }

    // Only validate PascalCase names (component conventions)
    const firstChar = componentName[0]
    if (!firstChar || firstChar === firstChar.toLowerCase()) {
        // Lowercase first char → HTML intrinsic or custom element; skip registry check
        return null
    }

    // Check registry membership
    if (registry[componentName]) return null

    const available = Object.keys(registry).join(', ')
    return `Component '${componentName}' is not in the project registry. Available components: ${available}. Use only registered components or HTML intrinsics.`
}

function loadComponentRegistry(workspaceRoot: string): void {
    try {
        const manifestPath = path.join(workspaceRoot, BRAND.manifestFile)
        if (!existsSync(manifestPath)) { cachedRegistry = {}; return }
        const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'))
        cachedRegistry = raw.components ?? raw ?? {}
    } catch { cachedRegistry = {} }
}

/**
 * Build a minimal TypeScript interface stub from the component registry.
 * Returns null if the component is not in the registry or has no props.
 */
function buildPropTypeStub(componentName: string): string | null {
    const entry = cachedRegistry[componentName]
    if (!entry?.props || Object.keys(entry.props).length === 0) return null

    const propLines = Object.entries(entry.props).map(([name, def]) => {
        const opt = def.required ? '' : '?'
        return `  ${name}${opt}: ${def.type};`
    })

    return [
        `interface ${componentName}Props {`,
        ...propLines,
        `}`,
        `declare function ${componentName}(props: ${componentName}Props): JSX.Element;`,
    ].join('\n')
}

/**
 * Best-effort extraction of a component name from a flint ID.
 * Flint IDs often follow "ComponentName-variant" or "component-name" patterns.
 * Returns null if no PascalCase component name can be inferred.
 */
function extractComponentNameFromId(flintId: string): string | null {
    // Check if the first segment is PascalCase (starts with uppercase)
    const firstPart = flintId.split('-')[0]
    if (firstPart && firstPart[0] === firstPart[0].toUpperCase() && firstPart[0] !== firstPart[0].toLowerCase()) {
        return firstPart
    }
    return null
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

    // CATALOG.4 + CR.3: Load component registry for prop-aware validation.
    // activeRegistry is initialized to the full cachedRegistry here; the policy
    // read block below will apply any componentScope filter (CR.3).
    const workspaceRoot = activeFilePath ? path.dirname(activeFilePath) : process.cwd()
    loadComponentRegistry(workspaceRoot)
    activeRegistry = cachedRegistry

    if (!config.apiKey) {
        onChunk({ type: 'error', error: 'No API key configured. Open AI Settings to set a key.' })
        return
    }

    // SEC P0-4: Only the Anthropic provider supports the constrained Flint Tool
    // Catalog (Commandment 15) and in-memory validation loop (Commandment 16).
    // Non-Anthropic providers send plain chat completions with no tool-use,
    // which means governance enforcement is completely absent.
    if (config.provider && config.provider !== 'anthropic') {
        onChunk({
            type: 'error',
            error:
                'Flint requires an Anthropic API key for AI-assisted editing. ' +
                'The Flint Tool Catalog (Commandment 15) and in-memory validation ' +
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
            // Anthropic branch — fully supports the Flint Tool Catalog
            const client = new Anthropic({
                apiKey: config.apiKey,
                ...(config.baseURL ? { baseURL: config.baseURL } : {}),
            })
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
            console.log(`${logTag('ACX')} tier=${assessment.tier} model=${resolvedModel} reason="${assessment.reasoning}"`)

            // ── ACX.4 + CR.3: Sentinel domain prepend + component scope ──────────
            // Read .flint/policy.json for:
            //   - domain: optional domain governance prefix for the system prompt
            //   - componentScope: optional allow-list of component names (CR.3)
            // Policy read failures are non-fatal — use base system prompt and full registry.
            let domain = 'general'   // V.4: hoisted so runStream closure can read it
            let systemPromptForCall = SYSTEM_PROMPT
            try {
                const policyPath = path.join(
                    activeFilePath ? path.dirname(activeFilePath) : path.join(homedir(), BRAND.configDir),
                    BRAND.configDir, 'policy.json',
                )
                if (existsSync(policyPath)) {
                    const policyRaw = await readFile(policyPath, 'utf-8')
                    const policy = JSON.parse(policyRaw) as { domain?: string; componentScope?: string[] }

                    // V.4: Capture domain for consensus gate
                    if (policy.domain) {
                        domain = policy.domain
                    }

                    // CR.3: Apply component scope filter to build activeRegistry
                    const scope = Array.isArray(policy.componentScope) && policy.componentScope.length > 0
                        ? policy.componentScope
                        : undefined
                    if (scope) {
                        const scopeSet = new Set(scope)
                        activeRegistry = Object.fromEntries(
                            Object.entries(cachedRegistry).filter(([key]) => scopeSet.has(key)),
                        )
                    } else {
                        activeRegistry = cachedRegistry
                    }

                    if (policy.domain && policy.domain !== 'general') {
                        systemPromptForCall = `[${BRAND.product} Sentinel: domain=${policy.domain}]\n\n${SYSTEM_PROMPT}`
                    }

                    // CR.1: Build and prepend constraint blocks
                    // activeRegistry is already scope-filtered above — no second filter needed.
                    const tokens = loadMithrilTokens()
                    const registryBlock = serializeRegistryConstraints(activeRegistry)
                    const tokenBlock = serializeTokenConstraints(tokens)
                    const constraintPrefix = [registryBlock, tokenBlock].filter(Boolean).join('\n\n')
                    if (constraintPrefix.length > 0) {
                        systemPromptForCall = `${constraintPrefix}\n\n${systemPromptForCall}`
                    }
                } else {
                    // No policy file — use full registry
                    activeRegistry = cachedRegistry

                    // CR.1: Still inject constraints when registry/tokens are available
                    const tokens = loadMithrilTokens()
                    const registryBlock = serializeRegistryConstraints(activeRegistry)
                    const tokenBlock = serializeTokenConstraints(tokens)
                    const constraintPrefix = [registryBlock, tokenBlock].filter(Boolean).join('\n\n')
                    if (constraintPrefix.length > 0) {
                        systemPromptForCall = `${constraintPrefix}\n\n${systemPromptForCall}`
                    }
                }
            } catch {
                // Policy read failure is non-fatal — use base system prompt and full registry.
                activeRegistry = cachedRegistry
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
                    tools: FLINT_TOOLS,
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
                                    console.warn(`${BRAND.logPrefix} Phase M validation blocked tool ${block.name}: ${validationError}`)
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
                                        if (block.name === 'flint_ast_mutate') {
                                            const mutations = (toolInput as Record<string, unknown>).mutations
                                            if (Array.isArray(mutations)) {
                                                blastRadius = mutations.length
                                            }
                                        }
                                        // flint_insert_node, flint_wrap_node, flint_delete_node → 1 (default)

                                        const mrs = computeMRS(block.name, blastRadius, violationsActive)
                                        console.log(`${logTag('MRS')} tool=${block.name} score=${mrs.score} tier=${mrs.tier} blast=${blastRadius}`)

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

                                        // ── V.4: Epistemic Consensus Gate ─────────────────────────────────────────
                                        let consensusOutcome: ConsensusOutcome | undefined
                                        let consensusReasoning: string | undefined

                                        if (mrs.tier === 'amber' || mrs.tier === 'red') {
                                            try {
                                                // Read active file source for the secondary agent's context
                                                let astSnapshot = ''
                                                if (activeFilePath) {
                                                    try {
                                                        astSnapshot = await readFile(activeFilePath, 'utf-8')
                                                    } catch {
                                                        // Non-fatal — secondary agent will evaluate with empty snapshot
                                                    }
                                                }

                                                const consensusConfig = resolveConsensusConfig(domain)
                                                if (shouldFireGate(mrs.tier, consensusConfig)) {
                                                    const gateResult = await runConsensusGate({
                                                        toolName: block.name,
                                                        toolInput: block.input as Record<string, unknown>,
                                                        mrs: {
                                                            score: mrs.score,
                                                            tier: mrs.tier,
                                                            factors: mrs.factors as unknown as Record<string, unknown>,
                                                        },
                                                        astSnapshot,
                                                        domain,
                                                        sessionId: undefined,
                                                        projectRoot: workspaceRoot,
                                                    })

                                                    consensusOutcome = gateResult.outcome
                                                    consensusReasoning = gateResult.secondaryVerdict.reasoning

                                                    if (gateResult.outcome === 'disagree') {
                                                        // Force human review even if the tool was amber (not red)
                                                        requiresReview = true
                                                    } else if (gateResult.outcome === 'agree_reject') {
                                                        // Both agents agree: unsafe — block before surfacing approval UI
                                                        onChunk({
                                                            type: 'validation_error',
                                                            error: `Consensus gate: both primary and secondary agents rejected this mutation.\nReason: ${gateResult.secondaryVerdict.reasoning}`,
                                                        })
                                                        hadValidationFailure = true
                                                        continue
                                                    }
                                                    // 'error' and 'skipped' fall through — gate is advisory, never blocks on its own errors
                                                }
                                            } catch (gateErr) {
                                                // Consensus gate is advisory — never block the primary flow on gate errors
                                                console.warn(`${BRAND.logPrefix} Consensus gate error (non-fatal):`, gateErr)
                                            }
                                        }
                                        // ── end V.4 ────────────────────────────────────────────────────────────────

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
                                            consensusOutcome,
                                            consensusReasoning,
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
                    console.log(`${logTag('ACX')} escalating to model=${escalationPath[currentModelIndex]}`)
                    await runStream(escalationPath[currentModelIndex])
                }
            }
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        onChunk({ type: 'error', error: `API error: ${msg}` })
    }
}
