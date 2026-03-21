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
})
