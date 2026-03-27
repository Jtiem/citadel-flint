/**
 * styleGuideService.ts — flint-mcp/src/core/styleGuideService.ts
 *
 * Resolves and returns style guide content based on the `content.style_guide`
 * field in `flint.config.yaml`.
 *
 * Resolution order:
 *   1. If value is one of the three built-in names ('google', 'microsoft', 'apple'),
 *      return the corresponding embedded snippet.
 *   2. If value starts with './' or '../' (relative path), or is an absolute path,
 *      read that file from disk relative to projectRoot. Truncate to 2000 chars.
 *   3. Otherwise return null (unknown built-in name, null, or undefined input).
 *
 * Design principles:
 *   - Never throws — returns null on any error
 *   - Custom file content is truncated to 2000 chars for prompt efficiency
 *   - Built-in snippets are under 500 chars each
 */

import fs from 'node:fs'
import path from 'node:path'

// ── Built-in guide snippets ────────────────────────────────────────────────
// Each kept under 500 chars for prompt efficiency.

const BUILTIN_GUIDES: Record<string, string> = {
    google: `Use present tense. Use active voice. Address the user as "you." Use "we" for the product team. Write in second person. Keep sentences short (26 words max). Use simple words over complex ones. Avoid jargon unless the audience expects it. Use sentence case for headings. Use serial commas.`,

    microsoft: `Use simple words and short sentences. Lead with what matters most. Be warm but not too casual. Use contractions (it's, you'll, we're). Write like you speak. Use sentence case for headings. Say "select" not "click." Say "turn on" not "enable." Avoid "please" in instructions.`,

    apple: `Be direct. Use short sentences. Address people, not users. Use verbs, not nouns. Avoid technical jargon. Use "tap" for touch, "click" for mouse. Capitalize proper nouns only. Use the Oxford comma. Write inclusively. Prefer "you can" over "you must."`,
}

const BUILTIN_NAMES = new Set(Object.keys(BUILTIN_GUIDES))

/** Maximum character length for custom file content injected into prompts. */
const MAX_CUSTOM_CHARS = 2000

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolves and returns style guide content based on the config value.
 *
 * @param styleGuide  - The `content.style_guide` field from flint.config.yaml.
 *                      May be a built-in name ('google', 'microsoft', 'apple'),
 *                      a relative file path ('./style-guide.md'), or null/undefined.
 * @param projectRoot - Absolute path to the project root. Used to resolve relative
 *                      file paths. Ignored when styleGuide is a built-in name.
 * @returns           - The resolved style guide content string, or null if the
 *                      guide cannot be resolved (missing input, unknown name,
 *                      unreadable file).
 */
export function resolveStyleGuide(
    styleGuide: string | null | undefined,
    projectRoot: string,
): string | null {
    // Null / undefined / empty string — nothing to resolve
    if (!styleGuide || typeof styleGuide !== 'string') return null

    const trimmed = styleGuide.trim()
    if (trimmed.length === 0) return null

    // 1. Built-in guide
    if (BUILTIN_NAMES.has(trimmed)) {
        return BUILTIN_GUIDES[trimmed] ?? null
    }

    // 2. File path — relative or absolute
    if (
        trimmed.startsWith('./') ||
        trimmed.startsWith('../') ||
        path.isAbsolute(trimmed)
    ) {
        return readCustomGuideFile(trimmed, projectRoot)
    }

    // 3. Unknown built-in name (not a path, not a known name)
    return null
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Reads a custom style guide file and returns its content, truncated to
 * MAX_CUSTOM_CHARS. Returns null if the file cannot be read.
 */
function readCustomGuideFile(filePath: string, projectRoot: string): string | null {
    try {
        const resolved = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(projectRoot, filePath)

        if (!fs.existsSync(resolved)) return null

        const content = fs.readFileSync(resolved, 'utf-8')
        return content.slice(0, MAX_CUSTOM_CHARS)
    } catch {
        return null
    }
}
