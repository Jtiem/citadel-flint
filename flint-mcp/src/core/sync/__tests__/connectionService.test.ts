import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { SyncSchema } from '../syncSchema.js'
import { ConnectionService } from '../connectionService.js'

describe('ConnectionService', () => {
    let db: BetterSqlite3.Database
    let svc: ConnectionService

    beforeEach(() => {
        db = new BetterSqlite3(':memory:')
        new SyncSchema(db) // initialize tables
        svc = new ConnectionService(db)
    })

    it('createConnection stores and returns a connection', () => {
        const conn = svc.createConnection('/tmp/proj', 'abc123', 'tok-encrypted', 'My File')
        expect(conn.projectRoot).toBe('/tmp/proj')
        expect(conn.figmaFileKey).toBe('abc123')
        expect(conn.figmaFileName).toBe('My File')
        expect(conn.accessTokenEncrypted).toBe('tok-encrypted')
        expect(conn.status).toBe('active')
        expect(conn.id).toBeTruthy()
        expect(conn.authMethod).toBe('pat')
    })

    it('getConnection retrieves the active connection', () => {
        svc.createConnection('/tmp/proj', 'abc123', 'tok')
        const conn = svc.getConnection('/tmp/proj')
        expect(conn).not.toBeNull()
        expect(conn!.figmaFileKey).toBe('abc123')
        expect(conn!.status).toBe('active')
    })

    it('getConnection returns null when no active connection', () => {
        expect(svc.getConnection('/tmp/proj')).toBeNull()
    })

    it('createConnection disconnects previous active connection', () => {
        svc.createConnection('/tmp/proj', 'old-key', 'tok1')
        svc.createConnection('/tmp/proj', 'new-key', 'tok2')

        const active = svc.getConnection('/tmp/proj')
        expect(active!.figmaFileKey).toBe('new-key')

        const all = svc.getAllConnections('/tmp/proj')
        expect(all.length).toBe(2)
        const disconnected = all.find((c) => c.figmaFileKey === 'old-key')
        expect(disconnected!.status).toBe('disconnected')
    })

    it('disconnectConnection sets status to disconnected', () => {
        svc.createConnection('/tmp/proj', 'abc', 'tok')
        const result = svc.disconnectConnection('/tmp/proj')
        expect(result).toBe(true)
        expect(svc.getConnection('/tmp/proj')).toBeNull()
    })

    it('disconnectConnection returns false when no active connection', () => {
        expect(svc.disconnectConnection('/tmp/proj')).toBe(false)
    })

    it('updateLastSync updates the timestamp', () => {
        svc.createConnection('/tmp/proj', 'abc', 'tok')
        const updated = svc.updateLastSync('/tmp/proj')
        expect(updated).toBe(true)

        const conn = svc.getConnection('/tmp/proj')
        expect(conn!.lastSyncAt).not.toBeNull()
    })

    it('updateLastSync returns false when no active connection', () => {
        expect(svc.updateLastSync('/tmp/proj')).toBe(false)
    })

    it('setError transitions status to error', () => {
        svc.createConnection('/tmp/proj', 'abc', 'tok')
        svc.setError('/tmp/proj')
        // Active query should find nothing
        expect(svc.getConnection('/tmp/proj')).toBeNull()
        const all = svc.getAllConnections('/tmp/proj')
        expect(all[0].status).toBe('error')
    })

    it('getAllConnections returns empty for unknown project', () => {
        expect(svc.getAllConnections('/unknown')).toEqual([])
    })

    it('connections for different projects are independent', () => {
        svc.createConnection('/proj-a', 'key-a', 'tok-a')
        svc.createConnection('/proj-b', 'key-b', 'tok-b')

        expect(svc.getConnection('/proj-a')!.figmaFileKey).toBe('key-a')
        expect(svc.getConnection('/proj-b')!.figmaFileKey).toBe('key-b')
    })

    // -------------------------------------------------------------------------
    // OAUTH.1 — OAuth connection tests
    // -------------------------------------------------------------------------

    it('OAUTH.1: createOAuthConnection stores and returns an oauth connection', () => {
        const expiry = Date.now() + 3600 * 1000
        const conn = svc.createOAuthConnection('/tmp/proj', 'fkey', 'access-tok', 'refresh-tok', expiry, 'My File')
        expect(conn.projectRoot).toBe('/tmp/proj')
        expect(conn.figmaFileKey).toBe('fkey')
        expect(conn.figmaFileName).toBe('My File')
        expect(conn.authMethod).toBe('oauth')
        expect(conn.status).toBe('active')
        expect(conn.refreshTokenEncrypted).not.toBeNull()
        expect(conn.tokenExpiry).not.toBeNull()
    })

    it('OAUTH.1: createOAuthConnection disconnects existing active connection', () => {
        svc.createConnection('/tmp/proj', 'pat-key', 'pat-tok')
        svc.createOAuthConnection('/tmp/proj', 'oauth-key', 'at', 'rt', Date.now() + 3600000)

        const active = svc.getConnection('/tmp/proj')
        expect(active!.figmaFileKey).toBe('oauth-key')
        expect(active!.authMethod).toBe('oauth')

        const all = svc.getAllConnections('/tmp/proj')
        const patConn = all.find((c) => c.figmaFileKey === 'pat-key')
        expect(patConn!.status).toBe('disconnected')
    })

    it('OAUTH.1: getConnection returns authMethod = oauth for oauth rows', () => {
        svc.createOAuthConnection('/tmp/proj', 'fkey', 'at', 'rt', Date.now() + 3600000)
        const conn = svc.getConnection('/tmp/proj')
        expect(conn!.authMethod).toBe('oauth')
    })

    it('OAUTH.1: updateOAuthTokens updates access token and expiry', () => {
        svc.createOAuthConnection('/tmp/proj', 'fkey', 'old-at', 'rt', Date.now() + 1000)
        const newExpiry = Date.now() + 7200000
        const updated = svc.updateOAuthTokens('/tmp/proj', 'new-at', null, newExpiry)
        expect(updated).toBe(true)

        const conn = svc.getConnection('/tmp/proj')
        // access token should be new-at (stored directly since no crypto override)
        expect(conn!.accessTokenEncrypted).toBe('new-at')
        expect(new Date(conn!.tokenExpiry!).getTime()).toBeCloseTo(newExpiry, -3)
    })

    it('OAUTH.1: updateOAuthTokens updates refresh token when provided', () => {
        svc.createOAuthConnection('/tmp/proj', 'fkey', 'at', 'old-rt', Date.now() + 1000)
        svc.updateOAuthTokens('/tmp/proj', 'new-at', 'new-rt', Date.now() + 7200000)

        const conn = svc.getConnection('/tmp/proj')
        expect(conn!.refreshTokenEncrypted).toBe('new-rt')
    })

    it('OAUTH.1: updateOAuthTokens returns false when no active oauth connection', () => {
        expect(svc.updateOAuthTokens('/tmp/proj', 'at', null, Date.now() + 3600000)).toBe(false)
    })

    it('OAUTH.1: setStatus transitions to expired', () => {
        svc.createOAuthConnection('/tmp/proj', 'fkey', 'at', 'rt', Date.now() - 1000)
        const result = svc.setStatus('/tmp/proj', 'expired')
        expect(result).toBe(true)

        // getConnection only returns 'active' rows so it should be null now
        expect(svc.getConnection('/tmp/proj')).toBeNull()

        const all = svc.getAllConnections('/tmp/proj')
        expect(all[0].status).toBe('expired')
    })

    it('OAUTH.1: rowToConnection defaults authMethod to pat for legacy rows', () => {
        // Insert a row without auth_method column value (it defaults to 'pat' in schema)
        db.prepare(
            `INSERT INTO figma_connections (id, project_root, figma_file_key, access_token_encrypted, connected_at)
             VALUES ('legacy-1', '/legacy', 'lkey', 'tok', datetime('now'))`
        ).run()

        const conn = svc.getConnection('/legacy')
        expect(conn).not.toBeNull()
        expect(conn!.authMethod).toBe('pat')
    })
})
