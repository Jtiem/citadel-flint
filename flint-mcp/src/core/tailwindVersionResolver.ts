/**
 * tailwindVersionResolver — flint-mcp/src/core/tailwindVersionResolver.ts
 *
 * P1c: Resolves the Tailwind CSS version for a project.
 *
 * Resolution order:
 *   1. `.flint/detected-environment.json` (FORGE.2 caches this on project open)
 *   2. `package.json` direct read (dependencies + devDependencies)
 *   3. Default to v4 if unable to determine
 *
 * Exports:
 *   resolveTailwindVersion(projectRoot)  — resolve TW version for a project
 *   TailwindVersion                       — version descriptor type
 */

import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TailwindVersion {
    /** Major version number: 3 or 4. */
    major: number
    /** Full semver string (e.g. "4.1.0"). When source is 'default', this is "4.0.0". */
    full: string
    /** How the version was determined. */
    source: 'detected-environment' | 'package.json' | 'default'
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip semver range prefixes (^, ~, >=, etc.) to get a clean version string. */
function cleanVersion(raw: string): string {
    return raw.replace(/^[\^~>=<\s]+/, '').split(' ')[0] ?? raw
}

/** Extract major version number from a cleaned semver string. */
function parseMajor(version: string): number {
    const first = version.split('.')[0]
    const n = parseInt(first ?? '', 10)
    return isNaN(n) ? 0 : n
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the Tailwind CSS version for the project rooted at `projectRoot`.
 *
 * Returns `null` when Tailwind is not detected at all (no dependency, no
 * cached environment entry). Callers should skip TW version drift checks
 * when the result is null.
 */
export function resolveTailwindVersion(projectRoot: string): TailwindVersion | null {
    // Guard empty/missing projectRoot — avoid reading cwd's package.json.
    if (!projectRoot || projectRoot.length === 0) return null

    // ── 1. Try .flint/detected-environment.json (FORGE.2 cache) ──────────
    try {
        const envPath = path.join(projectRoot, '.flint', 'detected-environment.json')
        if (fs.existsSync(envPath)) {
            const raw = fs.readFileSync(envPath, 'utf-8')
            const env = JSON.parse(raw) as {
                cssFramework?: { name?: string; version?: string }
            }
            if (env.cssFramework?.name === 'tailwindcss' && env.cssFramework.version) {
                const cleaned = cleanVersion(env.cssFramework.version)
                const major = parseMajor(cleaned)
                if (major === 3 || major === 4) {
                    return { major, full: cleaned, source: 'detected-environment' }
                }
            }
        }
    } catch {
        // Parse error or read error — fall through
    }

    // ── 2. Try package.json directly ─────────────────────────────────────
    try {
        const pkgPath = path.join(projectRoot, 'package.json')
        if (fs.existsSync(pkgPath)) {
            const raw = fs.readFileSync(pkgPath, 'utf-8')
            const pkg = JSON.parse(raw) as {
                dependencies?: Record<string, string>
                devDependencies?: Record<string, string>
            }
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
            const twVersion = allDeps['tailwindcss']
            if (twVersion) {
                const cleaned = cleanVersion(twVersion)
                const major = parseMajor(cleaned)
                if (major === 3 || major === 4) {
                    return { major, full: cleaned, source: 'package.json' }
                }
            }
        }
    } catch {
        // Parse error or read error — fall through
    }

    // ── 3. No Tailwind detected ──────────────────────────────────────────
    return null
}
