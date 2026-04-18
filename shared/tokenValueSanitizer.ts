/**
 * tokenValueSanitizer.ts — Shared sanitization for MINT.5 token values.
 *
 * Mirrors shared/reasonSanitizer.ts exactly in structure. Same security
 * pipeline (length-cap → control/format strip → secret redaction → trim)
 * with an additional per-type shape allowlist that validates the semantic
 * content of the value against its declared token type.
 *
 * Security model:
 *   - M1: Cap length at TOKEN_VALUE_MAX_LENGTH (1000 chars) to defeat
 *         SQLite/UI DoS.
 *   - M2: Strip Unicode control chars (\p{Cc}) and format chars (\p{Cf})
 *         to defeat Trojan-Source (CVE-2021-42574) attacks and NUL-
 *         truncation in downstream audit readers.
 *   - M4: Redact common secret patterns (Anthropic, OpenAI, AWS, GitHub,
 *         high-entropy base64-like strings ≥ 32 chars) so emitter output
 *         cannot accidentally leak credentials.
 *   - M5: Per-type shape allowlist rejects values whose shape is
 *         inconsistent with the declared token type (CSS breakout vectors,
 *         boolean impersonation, etc.).
 *
 * Precedence: length-cap → control/format strip → secret redaction → trim
 *             → shape validation.
 *
 * Caller contract:
 *   - Check `rejected` before writing to SQLite / disk.
 *   - `sanitized: null` means post-sanitize content is empty — treat the
 *     same as rejected.
 *   - Sanitization is not rejection: a value that passes shape validation
 *     may still have had control chars stripped (check `strippedControlChars`).
 *
 * Zero dependencies — importable from the MCP build (Node ESM) and the
 * Glass build (Vite). Do NOT add any imports.
 */

/** Absolute upper bound on stored token_value length, in characters. */
export const TOKEN_VALUE_MAX_LENGTH = 1000

/** Absolute upper bound on stored description length, in characters. */
export const TOKEN_DESCRIPTION_MAX_LENGTH = 4096

/**
 * Sanitizer version stamped into _report.json headers produced by emitters.
 * Bump on every material change to sanitize() behavior so emitter output is
 * traceable to the sanitizer revision that produced it.
 */
export const SANITIZER_VERSION = 'mint5.1.0' as const

/**
 * The canonical set of token-type categories understood by the shape-allowlist
 * validator. Matches the DTCG subset Flint already emits.
 */
export type TokenShapeCategory =
    | 'color'
    | 'dimension'
    | 'fontFamily'
    | 'fontWeight'
    | 'fontSize'
    | 'lineHeight'
    | 'letterSpacing'
    | 'shadow'
    | 'opacity'
    | 'string'
    | 'boolean'

/**
 * Result shape returned by sanitizeTokenValue. Callers read `rejected` before
 * writing to SQLite / disk. `sanitized: null` means post-sanitize content is
 * empty — caller treats it the same as rejected.
 */
export interface SanitizeTokenValueResult {
    /** The sanitized value, or null when post-sanitize content is empty. */
    sanitized: string | null
    /** True when the value fails the per-type shape allowlist. */
    rejected: boolean
    /** Human-readable rejection reason, null when not rejected. */
    rejectionReason: string | null
    /** True if the input was truncated at TOKEN_VALUE_MAX_LENGTH. */
    truncated: boolean
    /** True if one or more secret patterns were redacted. */
    redacted: boolean
    /** True if control or format characters (\p{Cc}, \p{Cf}) were stripped. */
    strippedControlChars: boolean
}

// ── Secret patterns (mirrors reasonSanitizer.ts — keep in sync) ──────────────

/**
 * Ordered list of secret patterns. Order matters: longer, more distinctive
 * patterns run first so shorter prefixes don't steal matches.
 *
 * Each pattern uses the `g` flag so all occurrences in one string are
 * redacted (not just the first one).
 */
export const SECRET_PATTERNS_EXT: ReadonlyArray<{ name: string; regex: RegExp }> = [
    // Anthropic API keys (sk-ant-…)
    { name: 'anthropic', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
    // GitHub personal access tokens (ghp_…)
    { name: 'github', regex: /ghp_[A-Za-z0-9]{36,}/g },
    // AWS access key ID (AKIA + 12+ uppercase alphanumerics — real AWS keys are
    // 16-char suffix, but test stubs and partial leaks may be shorter; lenient
    // match favors recall over precision for secret-redaction).
    { name: 'aws', regex: /AKIA[0-9A-Z]{12,}/g },
    // Generic OpenAI-style key (sk-…). Must not overlap sk-ant-… above.
    { name: 'openai', regex: /sk-(?!ant-)[A-Za-z0-9]{20,}/g },
    // High-entropy base64/hex-looking tokens ≥ 32 chars, whole-word, AND
    // containing a mix of lowercase + uppercase + digit.
    {
        name: 'high-entropy',
        regex: /\b(?=[A-Za-z0-9+/_-]{32,}={0,2}\b)(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[A-Za-z0-9+/_-]{32,}={0,2}\b/g,
    },
]

/** Control chars (\p{Cc}) + format chars (\p{Cf}, includes bidi-override + zero-width). */
const CONTROL_AND_FORMAT_CHARS = /[\p{Cc}\p{Cf}]/gu

// ── Shape validators ──────────────────────────────────────────────────────────

/**
 * CSS declaration breakout sequences — any value containing these is rejected
 * regardless of token type.
 *
 * Covers the canonical set of CSS injection vectors:
 *   - `}` closes a declaration block
 *   - `* /` closes a CSS comment
 *   - `url(` with non-data-URI scheme (handled separately per type)
 *   - `expression(` IE CSS expression injection
 */
const CSS_BREAKOUT_RE = /[{}]|\*\/|expression\s*\(|url\s*\(\s*(?!['"]?data:)/i

/**
 * Named CSS color keywords (CSS Color Level 4, subset covering common values).
 * Intentionally broad to avoid false-positive rejections.
 */
const NAMED_CSS_COLORS = new Set([
    'transparent', 'currentcolor', 'currentColor',
    'black', 'silver', 'gray', 'grey', 'white', 'maroon', 'red', 'purple',
    'fuchsia', 'green', 'lime', 'olive', 'yellow', 'navy', 'blue', 'teal',
    'aqua', 'orange', 'aliceblue', 'antiquewhite', 'aquamarine', 'azure',
    'beige', 'bisque', 'blanchedalmond', 'blueviolet', 'brown', 'burlywood',
    'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
    'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod',
    'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
    'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon',
    'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey',
    'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray',
    'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
    'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'greenyellow',
    'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki',
    'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue',
    'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray',
    'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen',
    'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
    'lightyellow', 'limegreen', 'linen', 'magenta', 'mediumaquamarine',
    'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen',
    'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred',
    'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite',
    'oldlace', 'olivedrab', 'orangered', 'orchid', 'palegoldenrod',
    'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff',
    'peru', 'pink', 'plum', 'powderblue', 'rosybrown', 'royalblue',
    'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna',
    'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
    'steelblue', 'tan', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat',
    'whitesmoke', 'yellowgreen', 'rebeccapurple',
    // CSS system colors
    'inherit', 'initial', 'unset', 'revert',
])

/**
 * Hex color: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
 */
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/

/**
 * Functional CSS color notations — accepts modern CSS Color 4 formats.
 * Intentionally permissive on internal structure; M5 handles breakout
 * detection via CSS_BREAKOUT_RE before we reach here.
 */
const FUNCTIONAL_COLOR_RE = /^(rgba?|hsla?|oklch|oklab|lab|lch|color|hwb|display-p3)\s*\(/i

/**
 * Valid CSS dimension units (CSS Values and Units Module Level 4).
 */
const VALID_CSS_UNITS = new Set([
    'px', 'rem', 'em', '%', 'vh', 'vw', 'vmin', 'vmax',
    'pt', 'pc', 'ex', 'ch', 'mm', 'cm', 'in',
    'svh', 'svw', 'dvh', 'dvw', 'cqi', 'cqb', 'fr',
])

/**
 * Valid CSS dimension: optional leading minus, number (int or decimal),
 * followed by a valid unit. Zero with no unit is also valid.
 */
function isValidDimension(value: string): boolean {
    // Zero is always valid (unitless zero is valid in CSS)
    if (value === '0') return true

    // No whitespace between number and unit: "16 px" must be rejected.
    const match = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]+)$/i.exec(value)
    if (!match) return false
    return VALID_CSS_UNITS.has(match[2].toLowerCase())
}

/**
 * Validate a color value against the allowed shape set.
 * Returns null on pass, rejection reason string on fail.
 */
function validateColorShape(value: string): string | null {
    // Named colors (case-insensitive lookup)
    if (NAMED_CSS_COLORS.has(value) || NAMED_CSS_COLORS.has(value.toLowerCase())) {
        return null
    }

    // Hex colors
    if (HEX_COLOR_RE.test(value)) return null

    // Functional colors: rgb(), rgba(), hsl(), hsla(), oklch(), lab(), etc.
    if (FUNCTIONAL_COLOR_RE.test(value)) return null

    return `value does not match a recognized CSS color format`
}

/**
 * Run the shape allowlist for a given token type.
 * Returns null when the value passes, or a rejection reason string.
 */
function validateShape(value: string, tokenType: TokenShapeCategory): string | null {
    // Universal CSS breakout check — applies to all types
    if (CSS_BREAKOUT_RE.test(value)) {
        return `value contains CSS declaration breakout sequence`
    }

    switch (tokenType) {
        case 'color':
            return validateColorShape(value)

        case 'dimension':
        case 'fontSize':
        case 'lineHeight':
        case 'letterSpacing':
            if (!isValidDimension(value)) {
                return `value '${value}' is not a valid CSS dimension (number + valid unit)`
            }
            return null

        case 'fontWeight':
            // Numeric weight (100–900) or keyword
            if (/^(normal|bold|bolder|lighter|[1-9]00)$/.test(value)) return null
            return `value '${value}' is not a valid CSS font-weight`

        case 'opacity': {
            const n = parseFloat(value)
            if (isNaN(n) || n < 0 || n > 1) {
                return `value '${value}' is not a valid opacity (0.0 – 1.0)`
            }
            return null
        }

        case 'boolean':
            if (value !== 'true' && value !== 'false') {
                return `value '${value}' is not a valid boolean (must be 'true' or 'false')`
            }
            return null

        case 'fontFamily':
        case 'shadow':
        case 'string':
            // Passthrough after sanitization — no additional shape constraint
            return null

        default:
            // Unknown types pass through (forward-compatible)
            return null
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sanitize a single token_value against the MINT.5 ingress bar:
 * length cap → control/format strip → secret redaction → trim → shape validation.
 *
 * Pure function — no I/O. Safe to call from both the Electron main process
 * and the web server.
 */
export function sanitizeTokenValue(
    value: unknown,
    tokenType: TokenShapeCategory,
): SanitizeTokenValueResult {
    const rejected = (reason: string, extras?: Partial<SanitizeTokenValueResult>): SanitizeTokenValueResult => ({
        sanitized: null,
        rejected: true,
        rejectionReason: reason,
        truncated: false,
        redacted: false,
        strippedControlChars: false,
        ...extras,
    })

    // Type guard — non-string input becomes null immediately.
    if (typeof value !== 'string') {
        return rejected('value must be a string')
    }

    // Empty / whitespace-only input
    if (value.trim().length === 0) {
        return rejected('value is empty or whitespace-only')
    }

    // M1: Length cap (cut before sanitization so regex work is bounded).
    const truncated = value.length > TOKEN_VALUE_MAX_LENGTH
    let working = truncated ? value.slice(0, TOKEN_VALUE_MAX_LENGTH) : value

    // M2: Strip control (\p{Cc}) + format (\p{Cf}) chars.
    const strippedWorking = working.replace(CONTROL_AND_FORMAT_CHARS, '')
    const strippedControlChars = strippedWorking !== working
    working = strippedWorking

    // M4: Secret redaction.
    let redacted = false
    for (const { regex } of SECRET_PATTERNS_EXT) {
        regex.lastIndex = 0
        if (regex.test(working)) {
            redacted = true
            regex.lastIndex = 0
            working = working.replace(regex, '[REDACTED]')
        }
    }

    // Final trim — after sanitization so stranded whitespace from stripped chars
    // doesn't survive.
    const trimmed = working.trim()
    if (trimmed.length === 0) {
        return rejected('value is empty after sanitization', { truncated, redacted, strippedControlChars })
    }

    // M5: Per-type shape validation.
    const shapeFailure = validateShape(trimmed, tokenType)
    if (shapeFailure !== null) {
        return {
            sanitized: null,
            rejected: true,
            rejectionReason: shapeFailure,
            truncated,
            redacted,
            strippedControlChars,
        }
    }

    return {
        sanitized: trimmed,
        rejected: false,
        rejectionReason: null,
        truncated,
        redacted,
        strippedControlChars,
    }
}

/**
 * Sanitize a token description. Uses TOKEN_DESCRIPTION_MAX_LENGTH (4096)
 * and the same secret-redaction pipeline. Returns a SanitizeReasonResult-
 * compatible shape so callers can share the same result handling.
 *
 * This intentionally does NOT import SanitizeReasonResult to keep zero deps —
 * the return shape is structurally identical.
 */
export function sanitizeTokenDescription(value: unknown): {
    sanitized: string | null
    truncated: boolean
    redacted: boolean
    strippedControlChars: boolean
} {
    if (typeof value !== 'string') {
        return { sanitized: null, truncated: false, redacted: false, strippedControlChars: false }
    }

    const truncated = value.length > TOKEN_DESCRIPTION_MAX_LENGTH
    let working = truncated ? value.slice(0, TOKEN_DESCRIPTION_MAX_LENGTH) : value

    const strippedWorking = working.replace(CONTROL_AND_FORMAT_CHARS, '')
    const strippedControlChars = strippedWorking !== working
    working = strippedWorking

    let redacted = false
    for (const { regex } of SECRET_PATTERNS_EXT) {
        regex.lastIndex = 0
        if (regex.test(working)) {
            redacted = true
            regex.lastIndex = 0
            working = working.replace(regex, '[REDACTED]')
        }
    }

    const trimmed = working.trim()
    if (trimmed.length === 0) {
        return { sanitized: null, truncated, redacted, strippedControlChars }
    }

    return { sanitized: trimmed, truncated, redacted, strippedControlChars }
}
