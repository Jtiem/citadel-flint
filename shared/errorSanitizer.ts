/**
 * errorSanitizer.ts — Sanitizer for user-visible MCP error strings.
 *
 * MINT.5 Phase 2 consensus fix (Security WARN-2):
 *   The MCP policy layer embeds a full renderer-allowlist dump in its rejection
 *   message (`electron/mcp-policy.ts:72-77`). That raw string flows through
 *   `useSyncActions` into `notificationStore.push` and is rendered verbatim in
 *   the toast. Two problems: (1) the user sees a noisy tool-list dump, and
 *   (2) any MCP tool that includes a secret in its error path would leak it
 *   into the renderer.
 *
 * Mirrors CHRON.1's `reasonSanitizer.ts` but for a user-visible surface rather
 * than a persisted audit field. Two behaviours:
 *   - Trojan-Source + secret redaction (same shape as reasonSanitizer).
 *   - Allowlist-dump collapse: the "Only these tools can be called from Glass:
 *     …" pattern is replaced with a short, human-safe message.
 *
 * This is a pure string helper — no IPC, no stores, no React. Safe to import
 * anywhere in the renderer and the server.
 *
 * Precedence:
 *   1. Non-string → fallback string
 *   2. Allowlist-dump collapse
 *   3. Control/format-char strip (Trojan-Source defense)
 *   4. Secret redaction
 *   5. Length cap (500 chars)
 *   6. Trim
 */

/** Max length of a sanitized user-visible error. */
export const ERROR_MESSAGE_MAX_LENGTH = 500

/**
 * Fallback text surfaced when the incoming message is empty, non-string, or
 * stripped down to whitespace.
 */
const FALLBACK_MESSAGE = 'Sync failed. Please try again.'

/**
 * Short, human-safe replacement for the SEC.3 renderer-allowlist dump.
 * Keeps the user oriented without leaking the tool catalog into the UI.
 */
const ALLOWLIST_COLLAPSE_MESSAGE =
    "This tool isn't available from the Glass UI. Run it from the host IDE (Claude Code, Cursor, or VS Code)."

/**
 * Pattern that matches the renderer-allowlist dump emitted by
 * `electron/mcp-policy.ts:72-77`. The mcp-policy message has the shape:
 *
 *   mcp:call-tool — tool "<name>" is not in the renderer allowlist. Only
 *   these tools can be called from Glass: flint_status, flint_audit, …
 *
 * We match both halves so any message containing either sentinel collapses.
 */
const ALLOWLIST_DUMP_PATTERN = /(?:not in the renderer allowlist|Only these tools can be called from Glass)/i

/**
 * Ordered list of secret patterns. Order matters — longer, more specific
 * patterns run first so shorter prefixes don't steal matches.
 *
 * Kept in sync with `shared/reasonSanitizer.ts` SECRET_PATTERNS.
 */
const SECRET_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
    // Anthropic API keys (sk-ant-…)
    { name: 'anthropic', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
    // GitHub personal access tokens (ghp_…, 36 chars of payload)
    { name: 'github', regex: /ghp_[A-Za-z0-9]{36,}/g },
    // AWS access key ID (AKIA + 16 uppercase alphanumerics)
    { name: 'aws', regex: /AKIA[0-9A-Z]{16}/g },
    // Generic OpenAI-style key (sk-…). Must not overlap sk-ant-… above.
    { name: 'openai', regex: /sk-(?!ant-)[A-Za-z0-9]{20,}/g },
    // Bearer tokens (Authorization: Bearer <token>).
    { name: 'bearer', regex: /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
    // High-entropy base64/hex-looking tokens ≥ 32 chars with mixed-class chars.
    {
        name: 'high-entropy',
        regex: /\b(?=[A-Za-z0-9+/_-]{32,}={0,2}\b)(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[A-Za-z0-9+/_-]{32,}={0,2}\b/g,
    },
]

/** Control chars (\p{Cc}) + format chars (\p{Cf}, includes bidi-override + zero-width). */
const CONTROL_AND_FORMAT_CHARS = /[\p{Cc}\p{Cf}]/gu

/**
 * Sanitize a user-visible MCP error string before passing it to
 * `notificationStore.push`.
 *
 * Always returns a non-empty string (never null) so callers can pass the
 * return value straight to the toast. Non-string input, empty/whitespace
 * input, and post-redaction empties all collapse to FALLBACK_MESSAGE.
 *
 * @param input — raw MCP error text, possibly null / undefined / non-string.
 * @returns a sanitized, single-line, bounded-length string safe to render.
 */
export function sanitizeError(input: unknown): string {
    // Type guard — anything non-string becomes the fallback immediately.
    if (typeof input !== 'string') return FALLBACK_MESSAGE
    if (input.length === 0) return FALLBACK_MESSAGE

    // Allowlist dump collapse — check BEFORE secret redaction so the collapsed
    // message isn't itself scanned for secrets (it contains none).
    if (ALLOWLIST_DUMP_PATTERN.test(input)) {
        return ALLOWLIST_COLLAPSE_MESSAGE
    }

    // Strip control + format chars (Trojan-Source / NUL-truncation defense).
    let working = input.replace(CONTROL_AND_FORMAT_CHARS, '')

    // Secret redaction.
    for (const { regex } of SECRET_PATTERNS) {
        regex.lastIndex = 0
        if (regex.test(working)) {
            regex.lastIndex = 0
            working = working.replace(regex, '[REDACTED]')
        }
    }

    // Length cap (after redaction so token replacement happens first).
    if (working.length > ERROR_MESSAGE_MAX_LENGTH) {
        working = working.slice(0, ERROR_MESSAGE_MAX_LENGTH - 1) + '\u2026'
    }

    const trimmed = working.trim()
    if (trimmed.length === 0) return FALLBACK_MESSAGE

    return trimmed
}
