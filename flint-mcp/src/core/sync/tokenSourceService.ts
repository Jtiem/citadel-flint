/**
 * SYNC.2 — Token Source Service.
 *
 * Manages the token_source table — the "last known sync state" baseline
 * used for three-way diff comparisons.
 */

import type Database from 'better-sqlite3'
import crypto from 'node:crypto'
import type { TokenSource, TokenSourceType } from './types.js'

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface TokenSourceRow {
    id: string
    project_root: string
    token_name: string
    token_value: string
    source: string
    figma_variable_id: string | null
    last_synced_at: string | null
    hash: string
}

function rowToTokenSource(row: TokenSourceRow): TokenSource {
    return {
        id: row.id,
        projectRoot: row.project_root,
        tokenName: row.token_name,
        tokenValue: row.token_value,
        source: row.source as TokenSourceType,
        figmaVariableId: row.figma_variable_id,
        lastSyncedAt: row.last_synced_at,
        hash: row.hash,
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TokenSourceService {
    private readonly db: Database.Database

    constructor(db: Database.Database) {
        this.db = db
    }

    /** Compute a SHA-256 hash for a token name + value pair. */
    static getTokenHash(name: string, value: string): string {
        return crypto.createHash('sha256').update(`${name}::${value}`).digest('hex')
    }

    /** Get all baseline token_source rows for a project. */
    getBaseline(projectRoot: string): TokenSource[] {
        const rows = this.db
            .prepare('SELECT * FROM token_source WHERE project_root = ? ORDER BY token_name')
            .all(projectRoot) as TokenSourceRow[]
        return rows.map(rowToTokenSource)
    }

    /** Get a single baseline entry by project + token name. */
    getByName(projectRoot: string, tokenName: string): TokenSource | null {
        const row = this.db
            .prepare('SELECT * FROM token_source WHERE project_root = ? AND token_name = ?')
            .get(projectRoot, tokenName) as TokenSourceRow | undefined
        return row ? rowToTokenSource(row) : null
    }

    /**
     * Replace the entire baseline for a project with a new set of tokens.
     * Runs inside a transaction for atomicity.
     */
    updateBaseline(
        projectRoot: string,
        tokens: Array<{
            tokenName: string
            tokenValue: string
            source: TokenSourceType
            figmaVariableId?: string | null
        }>,
    ): void {
        const now = new Date().toISOString()
        const tx = this.db.transaction(() => {
            this.db.prepare('DELETE FROM token_source WHERE project_root = ?').run(projectRoot)

            const insert = this.db.prepare(
                `INSERT INTO token_source (id, project_root, token_name, token_value, source, figma_variable_id, last_synced_at, hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )

            for (const t of tokens) {
                const id = crypto.randomUUID()
                const hash = TokenSourceService.getTokenHash(t.tokenName, t.tokenValue)
                insert.run(id, projectRoot, t.tokenName, t.tokenValue, t.source, t.figmaVariableId ?? null, now, hash)
            }
        })
        tx()
    }

    /**
     * Upsert a single token in the baseline.
     */
    upsertToken(
        projectRoot: string,
        tokenName: string,
        tokenValue: string,
        source: TokenSourceType,
        figmaVariableId?: string | null,
    ): void {
        const now = new Date().toISOString()
        const hash = TokenSourceService.getTokenHash(tokenName, tokenValue)
        const existing = this.getByName(projectRoot, tokenName)

        if (existing) {
            this.db
                .prepare(
                    `UPDATE token_source SET token_value = ?, source = ?, figma_variable_id = ?, last_synced_at = ?, hash = ?
                     WHERE project_root = ? AND token_name = ?`,
                )
                .run(tokenValue, source, figmaVariableId ?? null, now, hash, projectRoot, tokenName)
        } else {
            const id = crypto.randomUUID()
            this.db
                .prepare(
                    `INSERT INTO token_source (id, project_root, token_name, token_value, source, figma_variable_id, last_synced_at, hash)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(id, projectRoot, tokenName, tokenValue, source, figmaVariableId ?? null, now, hash)
        }
    }

    /** Remove a single token from the baseline. */
    removeToken(projectRoot: string, tokenName: string): boolean {
        const result = this.db
            .prepare('DELETE FROM token_source WHERE project_root = ? AND token_name = ?')
            .run(projectRoot, tokenName)
        return result.changes > 0
    }
}
