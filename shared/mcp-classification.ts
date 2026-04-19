/**
 * shared/mcp-classification.ts — MCP call result classifier (MINT.5 Phase 3)
 *
 * Pure module — no I/O, no store access. Consumed by both the renderer (src/)
 * and the main process (electron/, server/) via TypeScript module imports.
 * Single source of truth (R8) ensures renderer + main classification never drift.
 *
 * The discriminated union `MCPCallClassification` is the canonical error taxonomy
 * for all MCP call results flowing through Flint Glass. Phase 2's inline keyword
 * matching in `useSyncActions` is superseded by this module.
 */

// ── Classification type ───────────────────────────────────────────────────────

/**
 * Discriminated union for MCP call result classification.
 *
 * - `'auth-expired'`     — Figma OAuth token expired or revoked.
 * - `'rate-limited'`     — Upstream API rate limit hit (Figma 429 / "too many requests").
 * - `'network-error'`    — Network unreachable, DNS failure, or ECONNREFUSED.
 * - `'tool-error'`       — Tool ran but returned `isError=true` with a domain message.
 * - `'validation-error'` — Renderer-side preload Zod gate rejected the call before IPC.
 * - `'unknown'`          — No classifier matched, OR the call succeeded (`isError=false`).
 */
export type MCPCallClassification =
    | 'auth-expired'
    | 'rate-limited'
    | 'network-error'
    | 'tool-error'
    | 'validation-error'
    | 'unknown'

// ── Lookup tables ─────────────────────────────────────────────────────────────

/**
 * Text patterns that map to `'auth-expired'`.
 * All matched against the lowercased first content block.
 * Order matters: more specific patterns first.
 */
const AUTH_EXPIRED_PATTERNS: readonly string[] = [
    'auth-expired',
    'token expired',
    'token_expired',
    'unauthorized',
    'connection revoked',
    'oauth expired',
    'refresh token',
    '401',
]

/**
 * Text patterns that map to `'rate-limited'`.
 */
const RATE_LIMITED_PATTERNS: readonly string[] = [
    'rate limit',
    'rate_limit',
    'too many requests',
    'ratelimit',
    '429',
]

/**
 * Text patterns that map to `'network-error'`.
 */
const NETWORK_ERROR_PATTERNS: readonly string[] = [
    'econnrefused',
    'enotfound',
    'econnreset',
    'etimedout',
    'network error',
    'network_error',
    'dns failure',
    'dns_failure',
    'fetch failed',
    'socket hang up',
    'connection refused',
    'connection timeout',
]

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Classifies an MCP call result into a `MCPCallClassification`.
 *
 * Priority order (most specific wins):
 *   1. Non-error results → always `'unknown'`
 *   2. Auth patterns → `'auth-expired'`
 *   3. Rate-limit patterns → `'rate-limited'`
 *   4. Network patterns → `'network-error'`
 *   5. Validation-error is injected by the preload gate, not by this function
 *      (the preload sets it directly on the envelope — see electron/preload.ts)
 *   6. Any other error with `isError=true` → `'tool-error'`
 *   7. Fallthrough → `'unknown'`
 *
 * @param rawText  First text block from `MCPCallResult.content`, or empty string.
 *                 The classifier lowercases this internally.
 * @param isError  Whether the result has `isError=true`.
 * @param status   Optional structured status field surfaced by some tools.
 */
export function classifyMCPError(args: {
    rawText: string
    isError: boolean
    status?: string
}): MCPCallClassification {
    const { rawText, isError, status } = args

    // Non-error results are always 'unknown' — successful calls have no classification.
    if (!isError) return 'unknown'

    const lower = rawText.toLowerCase()
    const lowerStatus = (status ?? '').toLowerCase()

    // Auth-expired check (highest specificity)
    for (const pattern of AUTH_EXPIRED_PATTERNS) {
        if (lower.includes(pattern) || lowerStatus.includes(pattern)) {
            return 'auth-expired'
        }
    }

    // Rate-limited
    for (const pattern of RATE_LIMITED_PATTERNS) {
        if (lower.includes(pattern) || lowerStatus.includes(pattern)) {
            return 'rate-limited'
        }
    }

    // Network error
    for (const pattern of NETWORK_ERROR_PATTERNS) {
        if (lower.includes(pattern) || lowerStatus.includes(pattern)) {
            return 'network-error'
        }
    }

    // Anything else that is an error → tool-error
    return 'tool-error'
}
