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
 */

import fs from 'node:fs'
import path from 'node:path'

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
 * Returns the absolute path to the pack's flint.config.yaml if found in the
 * local cache, or null if the pack has not been installed.
 *
 * Network registry resolution is deferred to GPX.3. Install the pack first
 * with `flint pack install <ref>` or use a local file path in extends[].
 */
export function resolveRegistryRef(ref: string, projectRoot: string): string | null {
    const dirName = refToDirectoryName(ref)
    const packDir = path.join(projectRoot, '.flint-packs', dirName)
    const configPath = path.join(packDir, 'flint.config.yaml')

    if (fs.existsSync(configPath)) {
        return configPath
    }

    // Not in local cache — log and defer to GPX.3
    console.info(
        `[Flint Config] Pack "${ref}" not found in local cache (.flint-packs/${dirName}/). ` +
        'Install the pack first or use a local file path.'
    )
    return null
}
