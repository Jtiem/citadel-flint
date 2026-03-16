/**
 * Policy Loader — bridge-mcp/src/core/policyLoader.ts
 *
 * High-level policy read/write operations for the MCP server.
 * Provides:
 *   - readPolicy()   — load and validate .bridge/policy.json
 *   - writePolicy()  — atomically write .bridge/policy.json
 *   - mergePolicy()  — partial update (read → merge → write)
 *
 * All operations are synchronous because the MCP server handles one
 * request at a time (stdio transport) and the file is small.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { BridgePolicy } from './config.js'
import { DEFAULT_POLICY } from './config.js'
import { loadPolicy } from './config-loader.js'

/**
 * Reads the policy for the given project root.
 * Returns DEFAULT_POLICY when the file is missing or invalid.
 */
export function readPolicy(projectRoot: string): BridgePolicy {
    return loadPolicy(projectRoot)
}

/**
 * Writes a complete policy to `.bridge/policy.json`.
 * Creates the `.bridge/` directory if it does not exist.
 *
 * The write is direct (not via FileTransactionManager) because policy.json
 * is a metadata file, not source code. Commandment 12 applies to source
 * files routed through the mutation pipeline.
 */
export function writePolicy(projectRoot: string, policy: BridgePolicy): void {
    const bridgeDir = path.join(projectRoot, '.bridge')
    if (!fs.existsSync(bridgeDir)) {
        fs.mkdirSync(bridgeDir, { recursive: true })
    }

    const policyPath = path.join(bridgeDir, 'policy.json')
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
    partial: Partial<BridgePolicy>,
): BridgePolicy {
    const current = readPolicy(projectRoot)

    const merged: BridgePolicy = {
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
 * Returns the default policy. Useful for the `bridge_set_policy` tool
 * to offer a "reset to defaults" operation.
 */
export function getDefaultPolicy(): BridgePolicy {
    return { ...DEFAULT_POLICY }
}
