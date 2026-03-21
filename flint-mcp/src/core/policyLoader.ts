/**
 * Policy Loader — flint-mcp/src/core/policyLoader.ts
 *
 * High-level policy read/write operations for the MCP server.
 * Provides:
 *   - readPolicy()   — load and validate .flint/policy.json
 *   - writePolicy()  — atomically write .flint/policy.json
 *   - mergePolicy()  — partial update (read → merge → write)
 *
 * All operations are synchronous because the MCP server handles one
 * request at a time (stdio transport) and the file is small.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { FlintPolicy } from './config.js'
import { DEFAULT_POLICY } from './config.js'
import { loadPolicy } from './config-loader.js'

/**
 * Reads the policy for the given project root.
 * Returns DEFAULT_POLICY when the file is missing or invalid.
 */
export function readPolicy(projectRoot: string): FlintPolicy {
    return loadPolicy(projectRoot)
}

/**
 * Writes a complete policy to `.flint/policy.json`.
 * Creates the `.flint/` directory if it does not exist.
 *
 * The write is direct (not via FileTransactionManager) because policy.json
 * is a metadata file, not source code. Commandment 12 applies to source
 * files routed through the mutation pipeline.
 */
export function writePolicy(projectRoot: string, policy: FlintPolicy): void {
    const flintDir = path.join(projectRoot, '.flint')
    if (!fs.existsSync(flintDir)) {
        fs.mkdirSync(flintDir, { recursive: true })
    }

    const policyPath = path.join(flintDir, 'policy.json')
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 4) + '\n', 'utf-8')
}

/**
 * Merges a partial policy update into the existing policy.
 * Reads the current policy, deep-merges the partial update, and writes back.
 *
 * Returns the resulting merged policy.
 */
export function mergePolicy(
    projectRoot: string,
    partial: Partial<FlintPolicy>,
): FlintPolicy {
    const current = readPolicy(projectRoot)

    const merged: FlintPolicy = {
        version: 1,
        mithril: {
            ...current.mithril,
            ...(partial.mithril ?? {}),
        },
        a11y: {
            ...current.a11y,
            ...(partial.a11y ?? {}),
        },
        export_gate: {
            ...current.export_gate,
            ...(partial.export_gate ?? {}),
        },
        baseline: {
            ...current.baseline,
            ...(partial.baseline ?? {}),
        },
    }

    writePolicy(projectRoot, merged)
    return merged
}

/**
 * Returns the default policy. Useful for the `flint_set_policy` tool
 * to offer a "reset to defaults" operation.
 */
export function getDefaultPolicy(): FlintPolicy {
    return { ...DEFAULT_POLICY }
}
