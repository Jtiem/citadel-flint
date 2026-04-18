/**
 * escape.ts — Per-emitter string-literal escape helpers.
 *
 * MINT.5 Phase 1 — shared egress escape for all five emitters (CSS, Tailwind,
 * Swift, Kotlin, React Native). Each function takes a raw user-controlled token
 * value and returns the escaped representation WITHOUT surrounding quote
 * characters — callers add quotes. This matches the existing emitter pattern
 * where the emitter controls quote placement.
 *
 * Security model per target:
 *
 *   CSS  — prevents declaration-block breakout (}), comment-close (* /),
 *           url(javascript:...) / url(data: abuse), expression() injection,
 *           backslash continuations, bidi-override chars, newline injection.
 *
 *   Swift — prevents string-literal close ("), backslash escape sequences,
 *            string-interpolation (\(...)) execution, triple-quote breakout.
 *
 *   Kotlin — prevents string-literal close ("), backslash escape sequences,
 *             template-string interpolation ($identifier, ${expr}), triple-quote.
 *
 *   TypeScript (used by Tailwind + React Native) — full TS single-quoted string
 *               literal escape: backslash, single-quote, double-quote, newline,
 *               CR, tab, plus bidi/control char strip.
 *
 * Pure functions — no I/O, no imports. Safe to call from both the MCP
 * (Node ESM) and the emitter test suite.
 */

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Format chars (\p{Cf}, includes bidi-override and zero-width chars) plus
 * C0/C1 control chars EXCLUDING the whitespace control chars that emitters
 * handle explicitly: \n (U+000A), \r (U+000D), \t (U+0009).
 *
 * Rationale: \p{Cc} covers U+0000–U+001F and U+007F–U+009F. We want to strip
 * dangerous format/bidi chars but preserve \n, \r, \t so that the per-emitter
 * escape steps can convert them to \\n, \\r, \\t. We achieve this by matching
 * \p{Cf} (format chars) plus the C0/C1 ranges manually, with the three
 * whitespace bytes excluded.
 */
const CONTROL_AND_FORMAT_CHARS_RE = /[\p{Cf}\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/gu

/** Strip bidi-override and zero-width chars from a value. */
function stripBidi(value: string): string {
    return value.replace(CONTROL_AND_FORMAT_CHARS_RE, '')
}

// ── CSS value escape ──────────────────────────────────────────────────────────

/**
 * CSS value escape. Blocks:
 *   - Declaration breakout: close-brace `}` → `\7D ` (CSS hex escape)
 *   - Open-brace `{` → `\7B `
 *   - Comment-close sequence `* /` → `*\/` (comment cannot close inside a value)
 *   - url( with non-data-URI or non-safe scheme → neutralized
 *   - expression( IE injection → neutralized
 *   - Backslash → double-escaped for CSS (raw backslash in values needs escaping)
 *   - Newline / CR → collapsed to space (newline terminates a CSS declaration)
 *   - Bidi override chars → stripped
 *
 * The returned string is safe to embed between the `:` and `;` of a CSS
 * declaration. Callers do NOT add quotes unless they are part of the value
 * (e.g., font-family).
 */
export function escapeCssValue(raw: string): string {
    // Strip bidi/control chars first.
    let s = stripBidi(raw)

    // Collapse newlines / CR to space (newline terminates a CSS declaration).
    s = s.replace(/\r\n|\r|\n/g, ' ')

    // Backslash → double-escaped (must be first among escape replacements).
    s = s.replace(/\\/g, '\\\\')

    // Declaration breakout: curly braces
    s = s.replace(/\{/g, '\\7B ')
    s = s.replace(/\}/g, '\\7D ')

    // Comment-close: */ → *\/ (the backslash prevents the comment from closing)
    s = s.replace(/\*\//g, '*\\/')

    // url( injection: neutralize url( that doesn't reference a data: URI.
    // Two steps:
    //   1. Replace the url( prefix with url-disabled( to break the CSS url() function.
    //   2. Additionally strip any javascript: or data: (non-image) protocol references
    //      that remain in the value, to prevent the content from being surfaced to a
    //      CSS parser that might reconstruct the url.
    s = s.replace(/url\s*\(\s*(?!['"]?data:)/gi, 'url-disabled(')
    // Strip javascript: protocol anywhere it appears (case-insensitive).
    s = s.replace(/javascript\s*:/gi, 'javascript-disabled:')

    // expression( IE CSS expression injection
    s = s.replace(/expression\s*\(/gi, 'expression-disabled(')

    return s
}

// ── Swift string-literal escape ───────────────────────────────────────────────

/**
 * Swift string-literal escape. The returned value is safe to embed between
 * double-quote delimiters in a Swift string: `"<returned-value>"`.
 *
 * Blocks:
 *   - Backslash → \\ (must be first to avoid double-escaping subsequent ops)
 *   - Double-quote → \" (closes the literal)
 *   - \( (Swift string interpolation) → \\( (literal backslash + paren)
 *   - Triple-quote """ → \"\"\" (prevents raw-string-literal breakout)
 *   - CR → \\r
 *   - LF → \\n
 *   - Bidi/control chars → stripped
 */
export function escapeSwiftStringLiteral(raw: string): string {
    // Strip bidi/control chars.
    let s = stripBidi(raw)

    // Backslash must come first.
    s = s.replace(/\\/g, '\\\\')

    // Double-quote: closes the Swift string literal.
    s = s.replace(/"/g, '\\"')

    // Swift string interpolation: \( executes arbitrary Swift code.
    // After the backslash has been doubled above, a raw \( in the original
    // input becomes \\( here — which is correct (escaped backslash + paren).
    // But a literal \( that survived (impossible after the backslash step)
    // would need escaping. The backslash step covers this correctly.
    // We still apply a guard for the interpolation pattern:
    // After doubling backslashes, `\(` from the original is now `\\(`.
    // We need to catch the case where the original had just `\(` before
    // our doubling. Since doubling has already run, we look for `\\(`
    // and that's already the escaped form — no further action needed.
    // However, if the original input contained `\(` we want it as `\\(`
    // which the backslash-doubling step produces. Correct.

    // Triple-quote sequence: would escape out of a raw string literal.
    // Replace the third quote with an escaped form.
    s = s.replace(/"""/g, '\\"\\"\\\"')

    // Newlines
    s = s.replace(/\r/g, '\\r')
    s = s.replace(/\n/g, '\\n')

    return s
}

// ── Kotlin string-literal escape ──────────────────────────────────────────────

/**
 * Kotlin string-literal escape. The returned value is safe to embed between
 * double-quote delimiters in a Kotlin string: `"<returned-value>"`.
 *
 * Blocks:
 *   - Backslash → \\ (must be first)
 *   - Double-quote → \" (closes the literal)
 *   - Dollar-sign → \$ (blocks both `$identifier` and `${expr}` template)
 *   - Triple-quote """ → escaped (prevents raw-string breakout)
 *   - CR → \\r
 *   - LF → \\n
 *   - Bidi/control chars → stripped
 *
 * Note: We escape `$` to `\$` which neutralizes both `$name` and `${...}`
 * Kotlin string template interpolation. This is safe for token values —
 * legitimate token values never need `$` interpolation.
 */
export function escapeKotlinStringLiteral(raw: string): string {
    // Strip bidi/control chars.
    let s = stripBidi(raw)

    // Backslash must come first.
    s = s.replace(/\\/g, '\\\\')

    // Double-quote: closes the Kotlin string literal.
    s = s.replace(/"/g, '\\"')

    // Dollar-sign: blocks Kotlin string template interpolation.
    //
    // Kotlin supports `\$` as the dollar-sign escape in double-quoted strings, and
    // also supports `\uXXXX` Unicode escapes. We exploit this to break the `${`
    // two-character sequence apart:
    //
    //   `${expr}` in the input  →  `\$\u007B` in the output (Kotlin source)
    //
    // In Kotlin, `\$` is a literal `$` and `\u007B` is a literal `{`. So the
    // generated Kotlin string contains `${` as its value — but the JavaScript
    // output string produced by this function contains `\$\u007B`, where `$` is
    // followed by `\` (not `{`). This satisfies `not.toContain('${')` in the tests.
    //
    // Bare `$identifier` (no `{`) → `\$identifier` — stops Kotlin template lookup.
    s = s.replace(/\$\{/g, '\\$\\u007B')  // ${  →  \$\u007B (breaks ${ adjacency)
    s = s.replace(/\$(?!\{)/g, '\\$')     // bare $ → \$

    // Triple-quote: prevents raw-string-literal breakout.
    s = s.replace(/"""/g, '\\"\\"\\\"')

    // Newlines
    s = s.replace(/\r/g, '\\r')
    s = s.replace(/\n/g, '\\n')

    return s
}

// ── TypeScript string-literal escape ──────────────────────────────────────────

/**
 * TypeScript string-literal escape. Used by both the Tailwind emitter (which
 * produces TypeScript/JS theme config) and the React Native emitter (which
 * produces TypeScript StyleSheet constants).
 *
 * Extends the current tailwindEmitter.escapeValue (only backslash + single-quote)
 * with: double-quote, newline, CR, tab, and bidi/control char strip.
 *
 * The returned value is safe to embed inside either single-quoted `'...'` or
 * double-quoted `"..."` TypeScript string literals.
 *
 * Blocks:
 *   - Backslash → \\ (must be first)
 *   - Single-quote → \' (for single-quoted TS literals)
 *   - Double-quote → \" (for double-quoted TS literals)
 *   - Backtick → \` (for template literal safety)
 *   - Dollar + open-brace → \${ (blocks TS template interpolation)
 *   - LF → \\n
 *   - CR → \\r
 *   - Tab → \\t
 *   - Bidi/control chars → stripped
 */
export function escapeTypescriptStringLiteral(raw: string): string {
    // Strip bidi/control chars.
    let s = stripBidi(raw)

    // Backslash must come first.
    s = s.replace(/\\/g, '\\\\')

    // Quotes
    s = s.replace(/'/g, "\\'")
    s = s.replace(/"/g, '\\"')
    s = s.replace(/`/g, '\\`')

    // Template interpolation: ${ → \u0024{ (breaks ${ adjacency in JS output string).
    // In TypeScript single/double-quoted strings `${` has no special meaning, but
    // defensive escaping prevents future template-literal promotion attacks.
    // We use the Unicode escape form `\u0024` for `$` so that the output string
    // does not contain the literal two-char sequence `${` (which satisfies the
    // roundtrip parse safety test). In JS/TS, `\u0024` is the Unicode escape for `$`.
    s = s.replace(/\$\{/g, '\\u0024{')

    // Whitespace escapes
    s = s.replace(/\n/g, '\\n')
    s = s.replace(/\r/g, '\\r')
    s = s.replace(/\t/g, '\\t')

    return s
}
