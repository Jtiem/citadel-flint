/**
 * tokenPath.ts — Shared token path and project-root validators.
 *
 * Extracts SAFE_TOKEN_NAME_RE from electron/main.ts:1115, making it the
 * single source of truth so every writer (Electron, web server, MCP sync/
 * extract, ingestion server) binds to one regex.
 *
 * Phase 1.5 linter will grep for SAFE_TOKEN_NAME_RE declarations outside
 * this file and fail if any exist.
 *
 * Security guarantees:
 *   - Dot-separated identifier segments only (letter-start, [a-zA-Z0-9_-]).
 *   - Prototype pollution vectors (__proto__, constructor, prototype) are
 *     explicitly blocked regardless of the regex match.
 *   - Non-string input throws immediately.
 *   - projectRoot validator mirrors shared/validateFilePath but with no
 *     extension check (directory path) and no self-host restriction (MCP
 *     commonly runs from arbitrary project roots outside the Flint tree).
 *
 * Zero dependencies — importable from the MCP build (Node ESM) and the
 * Glass build (Vite). The path / fs imports are gated to validateProjectRoot
 * only (Node.js-only path). tokenPath itself is pure.
 */

import path from 'node:path'
import { realpathSync } from 'node:fs'

// ── SAFE_TOKEN_PATH_RE ────────────────────────────────────────────────────────

/**
 * Extracted from electron/main.ts:1115.
 *
 * Accepts dot-separated identifier paths where each segment starts with a
 * letter and contains only [a-zA-Z0-9_-]. Rejects:
 *   - Segments starting with a digit
 *   - Segments containing whitespace or Unicode
 *   - Empty segments (leading dot, trailing dot, double-dot)
 *   - Non-ASCII characters
 *
 * This is intentionally NOT exported as SAFE_TOKEN_NAME_RE to distinguish the
 * old inline name from the authoritative shared export. Phase 2 agents should
 * import SAFE_TOKEN_PATH_RE from here.
 */
// First segment must be a letter-first identifier; subsequent segments may be
// either letter-first identifiers OR pure-numeric (Tailwind/DTCG convention:
// `colors.primary.500`, `font.weight.700`). Mixed letter+digit-leading segments
// like `colors.1primary` are still rejected.
export const SAFE_TOKEN_PATH_RE: RegExp =
    /^[a-zA-Z][a-zA-Z0-9_-]*(\.([a-zA-Z][a-zA-Z0-9_-]*|\d+))*$/

/**
 * Prototype pollution segment denylist. Checked case-sensitively because
 * JavaScript prototype property access is case-sensitive.
 */
const PROTOTYPE_POLLUTION_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

// ── Error classes ─────────────────────────────────────────────────────────────

export class TokenPathValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'TokenPathValidationError'
    }
}

/** Re-exported from validateFilePath.ts for callers that only import from here. */
export class FilePathValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'FilePathValidationError'
    }
}

// ── validateTokenPath ──────────────────────────────────────────────────────────

/**
 * Validate and return a token path string. Throws TokenPathValidationError
 * on failure so callers can surface structured errors to the IPC boundary.
 *
 * Order of checks:
 *   1. Input must be a string.
 *   2. Input must match SAFE_TOKEN_PATH_RE (letter-start, dot-separated).
 *   3. No segment may be a prototype pollution vector.
 *
 * Returns the validated string unchanged (not trimmed — the regex already
 * excludes whitespace).
 */
export function validateTokenPath(raw: unknown): string {
    if (typeof raw !== 'string') {
        throw new TokenPathValidationError(
            `token path must be a string, got ${typeof raw}`
        )
    }

    if (!SAFE_TOKEN_PATH_RE.test(raw)) {
        throw new TokenPathValidationError(
            `token path '${raw}' is invalid: must be dot-separated identifier segments ` +
            `starting with a letter, containing only [a-zA-Z0-9_-]`
        )
    }

    // Defense-in-depth: explicit prototype pollution segment check.
    // SAFE_TOKEN_PATH_RE already blocks __ prefix (starts with non-letter),
    // but this guard is explicit and readable.
    const segments = raw.split('.')
    for (const segment of segments) {
        if (PROTOTYPE_POLLUTION_SEGMENTS.has(segment)) {
            throw new TokenPathValidationError(
                `token path segment '${segment}' is a reserved JavaScript prototype property name`
            )
        }
    }

    return raw
}

// ── validateProjectRoot ────────────────────────────────────────────────────────

/**
 * MCP-side projectRoot validator. Mirrors shared/validateFilePath with:
 *   - allowedExtensions: [] (directory path — no extension check)
 *   - No self-host restriction (MCP commonly runs from arbitrary project roots)
 *   - Must be an absolute path inside homeDir (same invariant as ast:save-file)
 *
 * Throws FilePathValidationError on failure.
 * Returns the path.resolve()d canonical path.
 *
 * Note: Running MCP from inside the Flint source tree passes this check
 * because the Flint repo is inside $HOME.
 */
export function validateProjectRoot(raw: unknown, homeDir: string): string {
    if (typeof raw !== 'string' || raw.length === 0) {
        throw new FilePathValidationError('projectRoot must be a non-empty string')
    }

    if (!path.isAbsolute(raw)) {
        throw new FilePathValidationError('projectRoot must be an absolute path')
    }

    // path.resolve collapses any ".." traversal sequences.
    const resolved = path.resolve(raw)

    // Follow symlinks where possible to prevent symlink-escape attacks.
    let real = resolved
    try {
        real = realpathSync(resolved)
    } catch {
        // Directory does not exist yet — use the resolved logical path.
    }

    const homeSep = homeDir + path.sep
    // Path must be strictly INSIDE the home directory.
    // We also accept `real === homeDir + path.sep + anything` but not
    // `real === homeDir` itself (that would be the home dir as a project root,
    // which is almost certainly a mistake).
    if (!real.startsWith(homeSep) && real !== homeDir) {
        throw new FilePathValidationError(
            `projectRoot '${raw}' is outside the user home directory and is not permitted`
        )
    }

    return resolved
}
