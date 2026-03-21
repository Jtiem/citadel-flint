import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { SyncSchema } from '../syncSchema.js'
import { TokenSourceService } from '../tokenSourceService.js'

describe('TokenSourceService', () => {
    let db: BetterSqlite3.Database
    let svc: TokenSourceService

    beforeEach(() => {
        db = new BetterSqlite3(':memory:')
        new SyncSchema(db)
        svc = new TokenSourceService(db)
    })

    describe('getTokenHash', () => {
        it('produces consistent SHA-256 hash', () => {
            const h1 = TokenSourceService.getTokenHash('color.primary', '"#ff0000"')
            const h2 = TokenSourceService.getTokenHash('color.primary', '"#ff0000"')
            expect(h1).toBe(h2)
            expect(h1).toHaveLength(64) // SHA-256 hex
        })

        it('produces different hash for different values', () => {
            const h1 = TokenSourceService.getTokenHash('color.primary', '"#ff0000"')
            const h2 = TokenSourceService.getTokenHash('color.primary', '"#00ff00"')
            expect(h1).not.toBe(h2)
        })
    })

    describe('getBaseline / updateBaseline', () => {
        it('returns empty array for unknown project', () => {
            expect(svc.getBaseline('/no/such/project')).toEqual([])
        })

        it('stores and retrieves baseline tokens', () => {
            svc.updateBaseline('/proj', [
                { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'figma' },
                { tokenName: 'spacing.sm', tokenValue: '"4px"', source: 'local' },
            ])
            const baseline = svc.getBaseline('/proj')
            expect(baseline).toHaveLength(2)
            expect(baseline[0].tokenName).toBe('color.primary')
            expect(baseline[1].tokenName).toBe('spacing.sm')
        })

        it('replaces entire baseline on re-call', () => {
            svc.updateBaseline('/proj', [
                { tokenName: 'a', tokenValue: '1', source: 'local' },
                { tokenName: 'b', tokenValue: '2', source: 'local' },
            ])
            svc.updateBaseline('/proj', [
                { tokenName: 'c', tokenValue: '3', source: 'figma' },
            ])
            const baseline = svc.getBaseline('/proj')
            expect(baseline).toHaveLength(1)
            expect(baseline[0].tokenName).toBe('c')
        })

        it('does not affect other projects', () => {
            svc.updateBaseline('/proj-a', [{ tokenName: 'x', tokenValue: '1', source: 'local' }])
            svc.updateBaseline('/proj-b', [{ tokenName: 'y', tokenValue: '2', source: 'figma' }])
            expect(svc.getBaseline('/proj-a')).toHaveLength(1)
            expect(svc.getBaseline('/proj-b')).toHaveLength(1)
        })
    })

    describe('getByName', () => {
        it('returns null for missing token', () => {
            expect(svc.getByName('/proj', 'nonexistent')).toBeNull()
        })

        it('returns the correct token', () => {
            svc.updateBaseline('/proj', [
                { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'figma', figmaVariableId: 'var-1' },
            ])
            const token = svc.getByName('/proj', 'color.primary')
            expect(token).not.toBeNull()
            expect(token!.tokenValue).toBe('"#ff0000"')
            expect(token!.figmaVariableId).toBe('var-1')
        })
    })

    describe('upsertToken', () => {
        it('inserts a new token', () => {
            svc.upsertToken('/proj', 'new.token', '"value"', 'local')
            const token = svc.getByName('/proj', 'new.token')
            expect(token).not.toBeNull()
            expect(token!.tokenValue).toBe('"value"')
        })

        it('updates an existing token', () => {
            svc.upsertToken('/proj', 'tok', '"old"', 'local')
            svc.upsertToken('/proj', 'tok', '"new"', 'figma')
            const token = svc.getByName('/proj', 'tok')
            expect(token!.tokenValue).toBe('"new"')
            expect(token!.source).toBe('figma')
        })
    })

    describe('removeToken', () => {
        it('returns false for missing token', () => {
            expect(svc.removeToken('/proj', 'nope')).toBe(false)
        })

        it('removes an existing token', () => {
            svc.upsertToken('/proj', 'tok', '"v"', 'local')
            expect(svc.removeToken('/proj', 'tok')).toBe(true)
            expect(svc.getByName('/proj', 'tok')).toBeNull()
        })
    })
})
