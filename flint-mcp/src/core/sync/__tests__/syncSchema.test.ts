import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { SyncSchema } from '../syncSchema.js'

describe('SyncSchema', () => {
    let db: BetterSqlite3.Database

    beforeEach(() => {
        db = new BetterSqlite3(':memory:')
    })

    it('creates all four tables on construction', () => {
        const schema = new SyncSchema(db)
        const tables = schema.verifyTables()
        expect(tables).toEqual([
            'figma_connections',
            'pending_conflicts',
            'sync_history',
            'token_source',
        ])
    })

    it('is idempotent — calling constructor twice does not error', () => {
        new SyncSchema(db)
        expect(() => new SyncSchema(db)).not.toThrow()
    })

    it('figma_connections has correct columns', () => {
        new SyncSchema(db)
        const info = db.prepare('PRAGMA table_info(figma_connections)').all() as Array<{ name: string }>
        const colNames = info.map((c) => c.name)
        expect(colNames).toContain('id')
        expect(colNames).toContain('project_root')
        expect(colNames).toContain('figma_file_key')
        expect(colNames).toContain('access_token_encrypted')
        expect(colNames).toContain('status')
    })

    it('token_source has correct columns', () => {
        new SyncSchema(db)
        const info = db.prepare('PRAGMA table_info(token_source)').all() as Array<{ name: string }>
        const colNames = info.map((c) => c.name)
        expect(colNames).toContain('token_name')
        expect(colNames).toContain('token_value')
        expect(colNames).toContain('source')
        expect(colNames).toContain('hash')
    })

    it('sync_history has correct columns', () => {
        new SyncSchema(db)
        const info = db.prepare('PRAGMA table_info(sync_history)').all() as Array<{ name: string }>
        const colNames = info.map((c) => c.name)
        expect(colNames).toContain('sync_type')
        expect(colNames).toContain('tokens_added')
        expect(colNames).toContain('error_message')
    })

    it('pending_conflicts has correct columns', () => {
        new SyncSchema(db)
        const info = db.prepare('PRAGMA table_info(pending_conflicts)').all() as Array<{ name: string }>
        const colNames = info.map((c) => c.name)
        expect(colNames).toContain('local_value')
        expect(colNames).toContain('remote_value')
        expect(colNames).toContain('resolution')
    })

    it('enforces status CHECK constraint on figma_connections', () => {
        new SyncSchema(db)
        expect(() =>
            db.prepare(
                `INSERT INTO figma_connections (id, project_root, figma_file_key, access_token_encrypted, status)
                 VALUES ('x', '/tmp', 'key', 'tok', 'invalid')`
            ).run()
        ).toThrow()
    })

    it('enforces source CHECK constraint on token_source', () => {
        new SyncSchema(db)
        expect(() =>
            db.prepare(
                `INSERT INTO token_source (id, project_root, token_name, token_value, source, hash)
                 VALUES ('x', '/tmp', 'color', '#fff', 'badval', 'abc')`
            ).run()
        ).toThrow()
    })

    it('enforces sync_type CHECK constraint on sync_history', () => {
        new SyncSchema(db)
        expect(() =>
            db.prepare(
                `INSERT INTO sync_history (id, project_root, sync_type)
                 VALUES ('x', '/tmp', 'badtype')`
            ).run()
        ).toThrow()
    })

    it('enforces unique project_root + token_name on token_source', () => {
        new SyncSchema(db)
        db.prepare(
            `INSERT INTO token_source (id, project_root, token_name, token_value, source, hash)
             VALUES ('a', '/tmp', 'color.primary', '#000', 'local', 'h1')`
        ).run()
        expect(() =>
            db.prepare(
                `INSERT INTO token_source (id, project_root, token_name, token_value, source, hash)
                 VALUES ('b', '/tmp', 'color.primary', '#fff', 'figma', 'h2')`
            ).run()
        ).toThrow()
    })

    it('getDb returns the database handle', () => {
        const schema = new SyncSchema(db)
        expect(schema.getDb()).toBe(db)
    })
})
