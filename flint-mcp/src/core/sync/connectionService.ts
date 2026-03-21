/**
 * SYNC.1 — Figma Connection Service.
 *
 * CRUD operations for the figma_connections table.
 * Constructor takes a better-sqlite3 Database instance (must already have
 * the sync schema initialized via SyncSchema).
 *
 * Access tokens are stored encrypted. The encrypt/decrypt functions are
 * injectable so Electron can wire in `safeStorage` (SEC.4) and headless
 * MCP / tests can pass identity functions.
 */

import type Database from 'better-sqlite3'
import crypto from 'node:crypto'
import type { FigmaConnection, ConnectionStatus } from './types.js'

/** Injectable crypto interface for access token encryption (SEC.4 compliance). */
export interface TokenCrypto {
    encrypt(plaintext: string): string
    decrypt(ciphertext: string): string
}

/** Identity (no-op) crypto for tests and headless MCP where safeStorage is unavailable. */
export const identityCrypto: TokenCrypto = {
    encrypt: (s) => s,
    decrypt: (s) => s,
}

// ---------------------------------------------------------------------------
// Row shape from better-sqlite3
// ---------------------------------------------------------------------------

interface ConnectionRow {
    id: string
    project_root: string
    figma_file_key: string
    figma_file_name: string
    access_token_encrypted: string
    refresh_token_encrypted: string | null
    token_expiry: string | null
    connected_at: string
    last_sync_at: string | null
    status: string
}

function rowToConnection(row: ConnectionRow): FigmaConnection {
    return {
        id: row.id,
        projectRoot: row.project_root,
        figmaFileKey: row.figma_file_key,
        figmaFileName: row.figma_file_name,
        accessTokenEncrypted: row.access_token_encrypted,
        refreshTokenEncrypted: row.refresh_token_encrypted,
        tokenExpiry: row.token_expiry,
        connectedAt: row.connected_at,
        lastSyncAt: row.last_sync_at,
        status: row.status as ConnectionStatus,
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ConnectionService {
    private readonly db: Database.Database
    private readonly crypto: TokenCrypto

    constructor(db: Database.Database, crypto?: TokenCrypto) {
        this.db = db
        this.crypto = crypto ?? identityCrypto
    }

    /** Decrypt an access token for API use. */
    decryptAccessToken(connection: FigmaConnection): string {
        return this.crypto.decrypt(connection.accessTokenEncrypted)
    }

    /**
     * Create a new Figma connection for a project root.
     * If a connection already exists for this project, it is replaced.
     */
    createConnection(
        projectRoot: string,
        fileKey: string,
        accessToken: string,
        fileName?: string,
    ): FigmaConnection {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        // Disconnect any existing connection for this project
        this.db
            .prepare(
                `UPDATE figma_connections SET status = 'disconnected' WHERE project_root = ? AND status = 'active'`
            )
            .run(projectRoot)

        this.db
            .prepare(
                `INSERT INTO figma_connections (id, project_root, figma_file_key, figma_file_name, access_token_encrypted, connected_at, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'active')`
            )
            .run(id, projectRoot, fileKey, fileName ?? '', this.crypto.encrypt(accessToken), now)

        return {
            id,
            projectRoot,
            figmaFileKey: fileKey,
            figmaFileName: fileName ?? '',
            accessTokenEncrypted: this.crypto.encrypt(accessToken),
            refreshTokenEncrypted: null,
            tokenExpiry: null,
            connectedAt: now,
            lastSyncAt: null,
            status: 'active',
        }
    }

    /**
     * Get the active connection for a project root.
     * Returns null if no active connection exists.
     */
    getConnection(projectRoot: string): FigmaConnection | null {
        const row = this.db
            .prepare(
                `SELECT * FROM figma_connections WHERE project_root = ? AND status = 'active' ORDER BY connected_at DESC LIMIT 1`
            )
            .get(projectRoot) as ConnectionRow | undefined

        return row !== undefined ? rowToConnection(row) : null
    }

    /**
     * Disconnect the active connection for a project root.
     * Returns true if a connection was disconnected, false if none was active.
     */
    disconnectConnection(projectRoot: string): boolean {
        const result = this.db
            .prepare(
                `UPDATE figma_connections SET status = 'disconnected' WHERE project_root = ? AND status = 'active'`
            )
            .run(projectRoot)
        return result.changes > 0
    }

    /**
     * Update last_sync_at to the current timestamp for the active connection.
     */
    updateLastSync(projectRoot: string): boolean {
        const now = new Date().toISOString()
        const result = this.db
            .prepare(
                `UPDATE figma_connections SET last_sync_at = ? WHERE project_root = ? AND status = 'active'`
            )
            .run(now, projectRoot)
        return result.changes > 0
    }

    /**
     * Set connection status to 'error' with an optional error detail.
     */
    setError(projectRoot: string): boolean {
        const result = this.db
            .prepare(
                `UPDATE figma_connections SET status = 'error' WHERE project_root = ? AND status = 'active'`
            )
            .run(projectRoot)
        return result.changes > 0
    }

    /**
     * Get all connections for a project root (any status).
     */
    getAllConnections(projectRoot: string): FigmaConnection[] {
        const rows = this.db
            .prepare(
                `SELECT * FROM figma_connections WHERE project_root = ? ORDER BY connected_at DESC`
            )
            .all(projectRoot) as ConnectionRow[]
        return rows.map(rowToConnection)
    }
}
