/**
 * Registry Resolver — flint-mcp/src/core/registryResolver.ts
 *
 * Resolves a registry pack reference by checking the local pack cache at
 * `.flint-packs/<pack-dir>/flint.config.yaml`. Pack directory names are
 * derived from the reference string by replacing "/" with "--".
 *
 * Example: "acme/healthcare-base" → .flint-packs/acme--healthcare-base/flint.config.yaml
 *
 * This is a cache-first resolver. Network registry resolution (GPX.3) is
 * deferred — if the pack is not in the local cache, null is returned with an
 * informational log message.
 *
 * Phase: UCFG.6 — GPX registry extends resolution (partial implementation)
 *
 * Sprint 5 MAJOR M6 — Path-traversal sandbox. Refs are validated against a
 * strict character allowlist before any filesystem call, then the resolved
 * path is canonicalized via `fs.realpathSync` and boundary-checked against
 * `<projectRoot>/.flint-packs`. This mirrors the `resolveExtendsRef` sandbox
 * in `config-loader.ts` (Sprint 3 MAJOR-3/4).
 */

import fs from 'node:fs'
import path from 'node:path'

/**
 * Thrown when a registry ref attempts to escape the `.flint-packs` sandbox
 * via path traversal, backslash injection, absolute paths, or forbidden
 * characters.
 *
 * Sprint 5 MAJOR M6 — parallel to `ConfigPathSandboxError` in config-loader.
 */
export class RegistryPathSandboxError extends Error {
    readonly code = 'FLINT_REGISTRY_PATH_SANDBOX' as const
    readonly attemptedRef: string
    readonly reason: string
    constructor(attemptedRef: string, reason: string) {
        super(
            `[Flint Registry] ref '${attemptedRef}' rejected by sandbox: ${reason}`
        )
        this.name = 'RegistryPathSandboxError'
        this.attemptedRef = attemptedRef
        this.reason = reason
    }
}

/**
 * Strict character allowlist for registry refs. Matches the review spec:
 *   reject `/[^a-zA-Z0-9_/-]/` with a clear error.
 *
 * Allowed: alphanumerics, underscore, hyphen, and forward slash (segment
 * separator). Everything else — including dot, backslash, whitespace, and
 * shell metacharacters — is rejected outright.
 */
const ALLOWED_REF_PATTERN = /^[a-zA-Z0-9_/-]+$/

/**
 * Validates a registry ref against the sandbox rules. Throws
 * `RegistryPathSandboxError` on any violation.
 *
 * Rejection cases:
 *   - empty or non-string ref
 *   - contains `..` (path traversal)
 *   - contains `\` (Windows path injection)
 *   - starts with `/` (absolute path)
 *   - starts or ends with `/` or `-` (malformed segment)
 *   - contains any character outside `[a-zA-Z0-9_/-]`
 */
function validateRegistryRef(ref: string): void {
    if (typeof ref !== 'string' || ref.length === 0) {
        throw new RegistryPathSandboxError(String(ref), 'ref must be a non-empty string')
    }
    if (ref.includes('..')) {
        throw new RegistryPathSandboxError(ref, 'ref contains ".." (path traversal)')
    }
    if (ref.includes('\\')) {
        throw new RegistryPathSandboxError(ref, 'ref contains "\\" (backslash injection)')
    }
    if (ref.startsWith('/')) {
        throw new RegistryPathSandboxError(ref, 'ref is an absolute path')
    }
    if (path.isAbsolute(ref)) {
        throw new RegistryPathSandboxError(ref, 'ref is an absolute path')
    }
    if (!ALLOWED_REF_PATTERN.test(ref)) {
        throw new RegistryPathSandboxError(
            ref,
            'ref contains characters outside [a-zA-Z0-9_/-]'
        )
    }
    // Defense-in-depth: ensure no segment is empty or dot-only after splitting.
    for (const segment of ref.split('/')) {
        if (segment.length === 0) {
            throw new RegistryPathSandboxError(ref, 'ref contains empty path segment')
        }
        if (segment === '.' || segment === '..') {
            throw new RegistryPathSandboxError(ref, `ref contains reserved segment "${segment}"`)
        }
    }
}

/**
 * Sanitise a registry reference into a local directory name.
 * Replaces all "/" with "--" so the result is a valid directory name.
 *
 * Examples:
 *   "acme/pack"           → "acme--pack"
 *   "org/sub/pack"        → "org--sub--pack"
 *   "healthcare-base"     → "healthcare-base"  (no slash → unchanged)
 */
function refToDirectoryName(ref: string): string {
    return ref.replace(/\//g, '--')
}

/**
 * Resolves a registry pack reference by checking the local pack cache.
 *
 * Format: "org/pack-name" → .flint-packs/org--pack-name/flint.config.yaml
 *
 * Returns the absolute (canonical) path to the pack's flint.config.yaml if
 * found in the local cache, or null if the pack has not been installed.
 *
 * Throws `RegistryPathSandboxError` if the ref fails input validation
 * (path traversal, backslash, absolute path, forbidden characters). Returns
 * null (not throw) when the resolved path escapes the `.flint-packs`
 * boundary via a symlink — symlink escape is treated as "not found" rather
 * than a hard error to preserve the cache-first semantics.
 *
 * Network registry resolution is deferred to GPX.3. Install the pack first
 * with `flint pack install <ref>` or use a local file path in extends[].
 */
export function resolveRegistryRef(ref: string, projectRoot: string): string | null {
    // 1. Input validation (throws on violation)
    validateRegistryRef(ref)

    // 2. Canonicalize the sandbox base (.flint-packs) once for boundary checks.
    const packsBase = path.join(projectRoot, '.flint-packs')
    let canonicalBase: string
    try {
        canonicalBase = fs.realpathSync(packsBase)
    } catch {
        // .flint-packs may not exist yet — fall back to the resolved path so
        // the boundary check still compares apples-to-apples.
        canonicalBase = path.resolve(packsBase)
    }
    const baseWithSep = canonicalBase.endsWith(path.sep)
        ? canonicalBase
        : canonicalBase + path.sep

    // 3. Build the candidate config path under the sandbox.
    const dirName = refToDirectoryName(ref)
    const packDir = path.join(packsBase, dirName)
    const configPath = path.join(packDir, 'flint.config.yaml')

    // 4. Pre-realpath normalize check — reject if the joined path already
    //    escapes the sandbox via a rogue directory name (belt and suspenders;
    //    validation should have caught this, but normalize catches edge cases).
    const normalized = path.normalize(configPath)
    if (!normalized.startsWith(path.normalize(packsBase) + path.sep)) {
        throw new RegistryPathSandboxError(ref, 'normalized path escapes .flint-packs')
    }

    if (!fs.existsSync(configPath)) {
        // Not in local cache — log and defer to GPX.3
        console.info(
            `[Flint Config] Pack "${ref}" not found in local cache (.flint-packs/${dirName}/). ` +
            'Install the pack first or use a local file path.'
        )
        return null
    }

    // 5. Post-existence symlink canonicalization. If the pack dir is a
    //    symlink pointing outside `.flint-packs`, the boundary check fails
    //    and we return null (treat as not-found rather than throw).
    let canonical: string
    try {
        canonical = fs.realpathSync(configPath)
    } catch {
        canonical = path.resolve(configPath)
    }

    if (canonical !== canonicalBase && !canonical.startsWith(baseWithSep)) {
        console.warn(
            `[Flint Registry] Pack "${ref}" resolves outside .flint-packs via symlink (${canonical}); ignoring.`
        )
        return null
    }

    return canonical
}
