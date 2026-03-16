/**
 * Config Loader — bridge-mcp/src/core/config-loader.ts
 *
 * Resolves the project root directory and loads the Bridge configuration,
 * including the `.bridge/policy.json` policy file.
 *
 * Resolution priority for project root:
 *   1. --project-root <path> CLI argument
 *   2. BRIDGE_PROJECT_ROOT environment variable
 *   3. process.cwd() fallback
 *
 * The policy file is optional. When absent, all fields fall back to
 * DEFAULT_POLICY values. When present, the file is deep-merged with
 * defaults so partial policy files are safe.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { BridgeConfig, BridgePolicy } from './config.js'
import { DEFAULT_POLICY, DEFAULT_CONFIG } from './config.js'

// ── Project root resolution ─────────────────────────────────────────────────

/**
 * Resolves the project root directory from CLI args, env, or cwd.
 */
export function resolveProjectRoot(): string {
    // 1. CLI argument: --project-root <path>
    const args = process.argv
    const rootArgIdx = args.indexOf('--project-root')
    if (rootArgIdx !== -1 && rootArgIdx + 1 < args.length) {
        const rootArg = args[rootArgIdx + 1]
        if (rootArg && fs.existsSync(rootArg)) {
            return path.resolve(rootArg)
        }
    }

    // 2. Environment variable
    const envRoot = process.env.BRIDGE_PROJECT_ROOT
    if (envRoot && fs.existsSync(envRoot)) {
        return path.resolve(envRoot)
    }

    // 3. Fallback to cwd
    return process.cwd()
}

// ── Policy loading ──────────────────────────────────────────────────────────

/**
 * Loads the `.bridge/policy.json` file from the given project root.
 * Returns DEFAULT_POLICY if the file is missing or malformed.
 *
 * Performs a shallow-then-deep merge: each top-level section is individually
 * merged with its default so partial sections are safe. Unknown keys are
 * silently preserved (forward compatibility).
 */
export function loadPolicy(projectRoot: string): BridgePolicy {
    const policyPath = path.join(projectRoot, '.bridge', 'policy.json')

    if (!fs.existsSync(policyPath)) {
        return { ...DEFAULT_POLICY }
    }

    try {
        const raw = fs.readFileSync(policyPath, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<BridgePolicy>

        // Validate version
        if (parsed.version !== undefined && parsed.version !== 1) {
            console.error(
                `[Bridge Policy] Unsupported policy version ${parsed.version}, using defaults`
            )
            return { ...DEFAULT_POLICY }
        }

        // Deep merge each section with its default
        return {
            version: 1,
            mithril: {
                ...DEFAULT_POLICY.mithril,
                ...(parsed.mithril ?? {}),
            },
            a11y: {
                ...DEFAULT_POLICY.a11y,
                ...(parsed.a11y ?? {}),
            },
            export_gate: {
                ...DEFAULT_POLICY.export_gate,
                ...(parsed.export_gate ?? {}),
            },
            baseline: {
                ...DEFAULT_POLICY.baseline,
                ...(parsed.baseline ?? {}),
            },
        }
    } catch (err) {
        console.error(
            `[Bridge Policy] Failed to load ${policyPath}, using defaults:`,
            err instanceof Error ? err.message : err
        )
        return { ...DEFAULT_POLICY }
    }
}

// ── Full config loading ─────────────────────────────────────────────────────

/**
 * Loads the full BridgeConfig for a given project root.
 * Reads the policy from `.bridge/policy.json` and discovers active domains.
 */
export function loadConfig(projectRoot: string): BridgeConfig {
    const policy = loadPolicy(projectRoot)

    // Discover active domains — check for .bridge/domains/ subdirectories
    let domains = ['ui']
    const domainsDir = path.join(projectRoot, '.bridge', 'domains')
    if (fs.existsSync(domainsDir)) {
        try {
            const entries = fs.readdirSync(domainsDir, { withFileTypes: true })
            const domainNames = entries
                .filter((e) => e.isDirectory())
                .map((e) => e.name)
            if (domainNames.length > 0) {
                domains = domainNames
            }
        } catch {
            // Fallback to default domains
        }
    }

    return {
        projectRoot,
        domains,
        policy,
    }
}
