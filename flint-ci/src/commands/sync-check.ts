/**
 * Sync Check command -- flint-ci/src/commands/sync-check.ts
 *
 * Reads token sync status from .flint/sync-state.json and checks for
 * token drift between the local design tokens and the remote Figma source.
 *
 * In CI, this acts as a drift detector: if local tokens have diverged
 * from the Figma source without an explicit push/pull, the build fails.
 *
 * Exit codes: 0=in sync, 1=drift detected, 3=config/read error.
 */

import fs from 'node:fs'
import path from 'node:path'
import { ANSI } from '../utils/ansi.js'

// ── Types ────────────────────────────────────────────────────────────────────

interface SyncState {
    /** ISO timestamp of last successful sync. */
    lastSyncAt: string | null
    /** Whether a Figma connection is active. */
    connected: boolean
    /** Number of tokens that have drifted since last sync. */
    driftedTokens: number
    /** Number of unresolved sync conflicts. */
    pendingConflicts: number
    /** Token hashes for drift detection. */
    localHash?: string
    remoteHash?: string
    /** Detailed drift entries. */
    drifts?: Array<{
        tokenPath: string
        localValue: string
        remoteValue: string
        category: string
    }>
}

// ── Command ──────────────────────────────────────────────────────────────────

export interface SyncCheckOptions {
    projectRoot?: string
}

export async function syncCheckCommand(opts: SyncCheckOptions): Promise<number> {
    const projectRoot = path.resolve(opts.projectRoot ?? process.cwd())

    console.log(
        `${ANSI.dim}Checking token sync health for ${projectRoot}...${ANSI.reset}`,
    )

    // 1. Try the MCP engine's sync check service if available
    const syncCheckResult = await tryMcpSyncCheck(projectRoot)
    if (syncCheckResult !== null) {
        return syncCheckResult
    }

    // 2. Fall back to reading .flint/sync-state.json directly
    const statePath = path.join(projectRoot, '.flint', 'sync-state.json')
    if (!fs.existsSync(statePath)) {
        console.log(
            `${ANSI.dim}No sync state found at ${statePath}${ANSI.reset}`,
        )
        console.log(
            `${ANSI.green}No Figma sync configured. Sync check passed.${ANSI.reset}`,
        )
        return 0
    }

    let state: SyncState
    try {
        const raw = fs.readFileSync(statePath, 'utf-8')
        state = JSON.parse(raw) as SyncState
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(
            `${ANSI.red}Error reading sync state: ${msg}${ANSI.reset}`,
        )
        return 3
    }

    // Print sync status
    const divider = '-'.repeat(50)
    console.log()
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log(`${ANSI.bold}  Flint Token Sync Check${ANSI.reset}`)
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log()

    console.log(
        `  Connected:          ${state.connected ? `${ANSI.green}yes${ANSI.reset}` : `${ANSI.yellow}no${ANSI.reset}`}`,
    )
    console.log(
        `  Last sync:          ${state.lastSyncAt ?? `${ANSI.dim}never${ANSI.reset}`}`,
    )
    console.log(
        `  Drifted tokens:     ${state.driftedTokens > 0 ? `${ANSI.red}${state.driftedTokens}${ANSI.reset}` : `${ANSI.green}0${ANSI.reset}`}`,
    )
    console.log(
        `  Pending conflicts:  ${state.pendingConflicts > 0 ? `${ANSI.red}${state.pendingConflicts}${ANSI.reset}` : `${ANSI.green}0${ANSI.reset}`}`,
    )

    // Print drift details if available
    if (state.drifts && state.drifts.length > 0) {
        console.log()
        console.log(`${ANSI.bold}  Drifted Tokens:${ANSI.reset}`)
        for (const drift of state.drifts.slice(0, 20)) {
            console.log(
                `    ${ANSI.yellow}${drift.tokenPath}${ANSI.reset} (${drift.category})`,
            )
            console.log(
                `      local:  ${ANSI.dim}${drift.localValue}${ANSI.reset}`,
            )
            console.log(
                `      remote: ${ANSI.dim}${drift.remoteValue}${ANSI.reset}`,
            )
        }
        if (state.drifts.length > 20) {
            console.log(
                `    ${ANSI.dim}... and ${state.drifts.length - 20} more${ANSI.reset}`,
            )
        }
    }

    // Hash comparison
    if (state.localHash && state.remoteHash) {
        const hashMatch = state.localHash === state.remoteHash
        console.log()
        console.log(
            `  Hash match:         ${hashMatch ? `${ANSI.green}yes${ANSI.reset}` : `${ANSI.red}no${ANSI.reset}`}`,
        )
    }

    console.log()
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)

    // Determine result
    const hasDrift = state.driftedTokens > 0
    const hasConflicts = state.pendingConflicts > 0

    if (hasDrift || hasConflicts) {
        console.log(
            `${ANSI.red}${ANSI.bold}  RESULT: DRIFT DETECTED${ANSI.reset}`,
        )
        console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
        console.log()

        if (hasDrift) {
            console.error(
                `${ANSI.yellow}${state.driftedTokens} token(s) have drifted from Figma source.${ANSI.reset}`,
            )
            console.error(
                `${ANSI.dim}Run "flint-gate sync" locally or "flint_sync_pull" to resolve.${ANSI.reset}`,
            )
        }
        if (hasConflicts) {
            console.error(
                `${ANSI.yellow}${state.pendingConflicts} unresolved sync conflict(s).${ANSI.reset}`,
            )
            console.error(
                `${ANSI.dim}Run "flint_resolve_all" to resolve conflicts before pushing.${ANSI.reset}`,
            )
        }

        return 1
    }

    console.log(
        `${ANSI.green}${ANSI.bold}  RESULT: IN SYNC${ANSI.reset}`,
    )
    console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
    console.log()

    return 0
}

// ── MCP engine sync check ────────────────────────────────────────────────────

/**
 * Attempts to use the MCP engine's SyncCheckService for a more thorough check.
 * Returns null if the service is unavailable (missing DB, missing dependency).
 */
async function tryMcpSyncCheck(projectRoot: string): Promise<number | null> {
    try {
        const dbPath = path.join(projectRoot, '.flint', 'sync.db')
        if (!fs.existsSync(dbPath)) return null

        // Dynamic imports — cross-package boundary, typed loosely with graceful fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const BetterSqlite3 = ((await import('better-sqlite3')) as any).default
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const syncCheckMod: any = await import(
            '../../../flint-mcp/src/core/sync/syncCheckService.js'
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const syncSchemaMod: any = await import(
            '../../../flint-mcp/src/core/sync/syncSchema.js'
        )

        const db = new BetterSqlite3(dbPath)
        try {
            new syncSchemaMod.SyncSchema(db)
            const checkSvc = new syncCheckMod.SyncCheckService(db)
            const report = checkSvc.runSyncCheck(projectRoot)

            const divider = '-'.repeat(50)
            console.log()
            console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
            console.log(`${ANSI.bold}  Flint Token Sync Check (engine)${ANSI.reset}`)
            console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
            console.log()
            console.log(
                `  In sync:            ${report.inSync ? `${ANSI.green}yes${ANSI.reset}` : `${ANSI.red}no${ANSI.reset}`}`,
            )
            console.log(`  Tokens drifted:     ${report.tokensDrifted}`)
            console.log(`  Pending conflicts:  ${report.pendingConflicts}`)
            console.log(
                `  Stale since:        ${report.staleSince ?? `${ANSI.dim}n/a${ANSI.reset}`}`,
            )
            console.log()
            console.log(`${ANSI.bold}${divider}${ANSI.reset}`)

            if (report.inSync) {
                console.log(
                    `${ANSI.green}${ANSI.bold}  RESULT: IN SYNC${ANSI.reset}`,
                )
                console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
                console.log()
                return 0
            }

            console.log(
                `${ANSI.red}${ANSI.bold}  RESULT: DRIFT DETECTED${ANSI.reset}`,
            )
            console.log(`${ANSI.bold}${divider}${ANSI.reset}`)
            console.log()
            return 1
        } finally {
            db.close()
        }
    } catch {
        // better-sqlite3 or sync service not available -- fall back to file-based check
        return null
    }
}
