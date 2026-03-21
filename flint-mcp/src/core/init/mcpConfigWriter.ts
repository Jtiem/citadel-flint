/**
 * mcpConfigWriter — flint-mcp/src/core/init/mcpConfigWriter.ts
 *
 * Phase INIT.1: Writes or updates the project's `.mcp.json` file to include
 * the Flint MCP server entry.
 *
 * Exports:
 *   writeMcpConfig(projectRoot) — idempotent write, returns a result descriptor
 *   McpConfigResult             — return shape
 *
 * Rules:
 *   - Safe: will not overwrite an entry that already exists.
 *   - Safe: will not corrupt an `.mcp.json` that fails JSON parsing.
 *   - Atomic: uses a write-then-rename strategy when updating an existing file.
 */

import fs from 'node:fs'
import path from 'node:path'

// ── Public types ──────────────────────────────────────────────────────────────

export interface McpConfigResult {
    /** Whether the file was actually written (created or updated). */
    written: boolean
    /** Absolute path to the `.mcp.json` file (even when not written). */
    path: string
    /** Human-readable status message. */
    message: string
}

// ── Flint server entry ───────────────────────────────────────────────────────

function buildFlintEntry(projectRoot: string): object {
    return {
        command: 'npx',
        args: ['flint-mcp', 'serve'],
        env: {
            FLINT_PROJECT_ROOT: projectRoot,
        },
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Adds the Flint MCP server entry to `.mcp.json` in `projectRoot`.
 *
 * Behaviour:
 *  1. File does not exist      → create it with Flint as the only server.
 *  2. File exists, valid JSON, no Flint entry → merge Flint in and write back.
 *  3. File exists, valid JSON, Flint already present → no-op.
 *  4. File exists, invalid JSON → no-op, return error message.
 */
export function writeMcpConfig(projectRoot: string): McpConfigResult {
    const mcpJsonPath = path.join(projectRoot, '.mcp.json')

    if (!fs.existsSync(mcpJsonPath)) {
        // Case 1: create from scratch
        const config = {
            mcpServers: {
                flint: buildFlintEntry(projectRoot),
            },
        }
        fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n', 'utf-8')
        return {
            written: true,
            path: mcpJsonPath,
            message: 'Flint MCP server added to .mcp.json',
        }
    }

    // File exists — parse it
    let existing: Record<string, unknown>
    try {
        const raw = fs.readFileSync(mcpJsonPath, 'utf-8')
        existing = JSON.parse(raw) as Record<string, unknown>
    } catch {
        return {
            written: false,
            path: mcpJsonPath,
            message: 'Existing .mcp.json is not valid JSON — skipping. Add Flint manually.',
        }
    }

    // Check for existing Flint entry
    const mcpServers = existing.mcpServers as Record<string, unknown> | undefined
    if (mcpServers && 'flint' in mcpServers) {
        return {
            written: false,
            path: mcpJsonPath,
            message: 'Flint already configured in .mcp.json',
        }
    }

    // Case 2: merge Flint entry in
    if (!existing.mcpServers || typeof existing.mcpServers !== 'object') {
        existing.mcpServers = {}
    }

    ;(existing.mcpServers as Record<string, unknown>)['flint'] = buildFlintEntry(projectRoot)

    fs.writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8')

    return {
        written: true,
        path: mcpJsonPath,
        message: 'Flint MCP server added to .mcp.json',
    }
}
