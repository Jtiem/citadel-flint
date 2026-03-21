/**
 * SYNC.4 — Sync Check Service (CI/CD integration).
 *
 * Produces a structured health report for CI pipelines and the dashboard.
 */

import type Database from 'better-sqlite3'
import { ConflictService } from './conflictService.js'
import { SyncHistoryService } from './syncHistoryService.js'
import { TokenSourceService } from './tokenSourceService.js'
import { ConnectionService } from './connectionService.js'
import { type TokenFileIO, defaultFileIO, readLocalTokens } from './tokenFileIO.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncRecommendation = 'ok' | 'pull_needed' | 'push_needed' | 'conflicts_pending'

export interface SyncCheckReport {
    inSync: boolean
    pendingConflicts: number
    staleSince: string | null
    tokensDrifted: number
    recommendation: SyncRecommendation
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SyncCheckService {
    private readonly conflictSvc: ConflictService
    private readonly historySvc: SyncHistoryService
    private readonly tokenSourceSvc: TokenSourceService
    private readonly connectionSvc: ConnectionService
    private readonly io: TokenFileIO

    constructor(db: Database.Database, io?: TokenFileIO) {
        this.conflictSvc = new ConflictService(db)
        this.historySvc = new SyncHistoryService(db)
        this.tokenSourceSvc = new TokenSourceService(db)
        this.connectionSvc = new ConnectionService(db)
        this.io = io ?? defaultFileIO
    }

    /**
     * Run a sync health check for a project.
     * Compares local design-tokens.json against the token_source baseline
     * and checks for unresolved conflicts.
     */
    runSyncCheck(projectRoot: string): SyncCheckReport {
        // 1. Pending conflicts
        const conflicts = this.conflictSvc.getConflicts(projectRoot)
        const pendingConflicts = conflicts.length

        // 2. Last sync timestamp
        const lastSync = this.historySvc.getLastSync(projectRoot)
        const staleSince = lastSync?.completedAt ?? null

        // 3. Token drift: compare local tokens to baseline
        const baseline = this.tokenSourceSvc.getBaseline(projectRoot)
        const localTokens = this.readLocalTokens(projectRoot)
        let tokensDrifted = 0

        const baselineMap = new Map<string, string>()
        for (const b of baseline) {
            baselineMap.set(b.tokenName, b.hash)
        }

        // Count tokens that exist locally but differ from baseline
        for (const [name, value] of localTokens) {
            const expectedHash = baselineMap.get(name)
            const actualHash = TokenSourceService.getTokenHash(name, value)
            if (!expectedHash) {
                // New local token not in baseline
                tokensDrifted++
            } else if (expectedHash !== actualHash) {
                tokensDrifted++
            }
        }

        // Count baseline tokens missing locally
        for (const [name] of baselineMap) {
            if (!localTokens.has(name)) {
                tokensDrifted++
            }
        }

        // 4. Determine recommendation
        let recommendation: SyncRecommendation = 'ok'
        if (pendingConflicts > 0) {
            recommendation = 'conflicts_pending'
        } else if (tokensDrifted > 0) {
            // If there's a connection, we might need a pull; otherwise push
            const connection = this.connectionSvc.getConnection(projectRoot)
            if (connection) {
                recommendation = 'pull_needed'
            } else {
                recommendation = 'push_needed'
            }
        }

        const inSync = pendingConflicts === 0 && tokensDrifted === 0

        return {
            inSync,
            pendingConflicts,
            staleSince,
            tokensDrifted,
            recommendation,
        }
    }

    // -----------------------------------------------------------------------
    // Private
    // -----------------------------------------------------------------------

    private readLocalTokens(projectRoot: string): Map<string, string> {
        return readLocalTokens(projectRoot, this.io)
    }
}
