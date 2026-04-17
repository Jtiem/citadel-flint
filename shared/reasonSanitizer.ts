/**
 * reasonSanitizer.ts — Shared sanitization for CHRON.1 override reasons.
 *
 * Runs in both the Electron main process and the web server to produce
 * identical sanitization behavior across the two deployment targets.
 *
 * Security model:
 *   - M1: Cap length at 1000 chars to defeat SQLite/UI DoS.
 *   - M2: Strip Unicode control chars (\p{Cc}) and format chars (\p{Cf})
 *         to defeat Trojan-Source (CVE-2021-42574) attacks against audit
 *         log readers. NUL bytes truncate strings in C-based downstream
 *         tools (e.g., terminal SARIF output) — this prevents that too.
 *   - M4: Redact common secret patterns (API keys, AWS keys, GitHub tokens,
 *         high-entropy base64-like strings ≥ 32 chars) so compliance
 *         artifacts don't accidentally leak credentials. We never reject
 *         — redaction + log so a human pasting about a key is not blocked.
 *
 * Precedence: length-cap → control/format strip → secret redaction → trim.
 * Trimming last means a string that is all-whitespace after stripping
 * returns null (the caller's "no reason" signal).
 */

/** Absolute upper bound on stored reason length, in characters. */
export const REASON_MAX_LENGTH = 1000

/**
 * Ordered list of secret patterns. Order matters: the longer, more
 * distinctive patterns run first so shorter prefixes don't steal matches.
 *
 * Each pattern uses the `g` flag so all occurrences in one string are
 * redacted (not just the first one).
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
    // High-entropy base64/hex-looking tokens ≥ 32 chars, whole-word, AND
    // containing a mix of lowercase + uppercase + digit (to avoid matching
    // plain English words or runs of a single char like "xxxx…xxxx").
    // Uses lookaheads — the Node.js regex engine handles these cheaply.
    {
        name: 'high-entropy',
        regex: /\b(?=[A-Za-z0-9+/_-]{32,}={0,2}\b)(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[A-Za-z0-9+/_-]{32,}={0,2}\b/g,
    },
]

/** Control chars (\p{Cc}) + format chars (\p{Cf}, includes bidi-override + zero-width). */
const CONTROL_AND_FORMAT_CHARS = /[\p{Cc}\p{Cf}]/gu

/**
 * Result shape — callers get the cleaned string plus diagnostic info.
 * The two boolean flags let callers (or tests) warn when a redaction
 * or a truncation happened without re-running the pipeline.
 */
export interface SanitizeReasonResult {
    /** The sanitized reason string, or null if the input was effectively empty. */
    sanitized: string | null
    /** True if the input was truncated by the length cap. */
    truncated: boolean
    /** True if one or more secret patterns were redacted. */
    redacted: boolean
    /** True if control or format characters were stripped. */
    strippedControlChars: boolean
}

/**
 * Sanitize a CHRON.1 reason string.
 *
 * Non-string input and undefined return { sanitized: null, … }.
 * An all-whitespace or effectively-empty post-strip string also returns null —
 * callers interpret null as "no meaningful reason, store NULL in SQLite".
 */
export function sanitizeReason(input: unknown): SanitizeReasonResult {
    // Type guard — anything non-string becomes null immediately.
    if (typeof input !== 'string') {
        return { sanitized: null, truncated: false, redacted: false, strippedControlChars: false }
    }

    // M1: Length cap (cut before sanitization so regex work is bounded).
    const truncated = input.length > REASON_MAX_LENGTH
    let working = truncated ? input.slice(0, REASON_MAX_LENGTH) : input

    // M2: Strip control (\p{Cc}) + format (\p{Cf}) chars. Prevents Trojan-Source
    // and NUL-truncation attacks against downstream audit readers.
    const strippedWorking = working.replace(CONTROL_AND_FORMAT_CHARS, '')
    const strippedControlChars = strippedWorking !== working
    working = strippedWorking

    // M4: Secret redaction. Replace each matched substring with [REDACTED].
    let redacted = false
    for (const { regex } of SECRET_PATTERNS) {
        // Reset lastIndex in case the regex has the `g` flag (it does).
        regex.lastIndex = 0
        if (regex.test(working)) {
            redacted = true
            regex.lastIndex = 0
            working = working.replace(regex, '[REDACTED]')
        }
    }

    // Final trim — after sanitization so leading/trailing control chars
    // that got stripped don't leave stranded whitespace.
    const trimmed = working.trim()
    if (trimmed.length === 0) {
        return { sanitized: null, truncated, redacted, strippedControlChars }
    }

    return { sanitized: trimmed, truncated, redacted, strippedControlChars }
}
