import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { SyncSchema } from '../syncSchema.js'
import { ConflictService } from '../conflictService.js'

describe('ConflictService', () => {
    let db: BetterSqlite3.Database
    let svc: ConflictService

    beforeEach(() => {
        db = new BetterSqlite3(':memory:')
        new SyncSchema(db)
        svc = new ConflictService(db)
    })

    describe('createConflict', () => {
        it('creates and returns a conflict', () => {
            const c = svc.createConflict({
                projectRoot: '/proj',
                tokenName: 'color.primary',
                localValue: '"#ff0000"',
                remoteValue: '"#00ff00"',
                figmaVariableId: 'var-1',
            })
            expect(c.id).toBeTruthy()
            expect(c.tokenName).toBe('color.primary')
            expect(c.localValue).toBe('"#ff0000"')
            expect(c.remoteValue).toBe('"#00ff00"')
            expect(c.resolvedAt).toBeNull()
            expect(c.resolution).toBeNull()
        })
    })

    describe('getConflicts', () => {
        it('returns empty for no conflicts', () => {
            expect(svc.getConflicts('/proj')).toEqual([])
        })

        it('returns only unresolved conflicts', () => {
            const c1 = svc.createConflict({
                projectRoot: '/proj',
                tokenName: 'a',
                localValue: '1',
                remoteValue: '2',
            })
            svc.createConflict({
                projectRoot: '/proj',
                tokenName: 'b',
                localValue: '3',
                remoteValue: '4',
            })
            svc.resolveConflict(c1.id, 'local')

            const pending = svc.getConflicts('/proj')
            expect(pending).toHaveLength(1)
            expect(pending[0].tokenName).toBe('b')
        })

        it('scopes to project', () => {
            svc.createConflict({ projectRoot: '/a', tokenName: 'x', localValue: '1', remoteValue: '2' })
            svc.createConflict({ projectRoot: '/b', tokenName: 'y', localValue: '3', remoteValue: '4' })
            expect(svc.getConflicts('/a')).toHaveLength(1)
            expect(svc.getConflicts('/b')).toHaveLength(1)
        })
    })

    describe('getById', () => {
        it('returns null for unknown id', () => {
            expect(svc.getById('nonexistent')).toBeNull()
        })

        it('returns the conflict', () => {
            const c = svc.createConflict({ projectRoot: '/proj', tokenName: 'x', localValue: '1', remoteValue: '2' })
            expect(svc.getById(c.id)!.tokenName).toBe('x')
        })
    })

    describe('resolveConflict', () => {
        it('marks conflict as resolved', () => {
            const c = svc.createConflict({ projectRoot: '/proj', tokenName: 'x', localValue: '1', remoteValue: '2' })
            const resolved = svc.resolveConflict(c.id, 'remote')
            expect(resolved).not.toBeNull()
            expect(resolved!.resolution).toBe('remote')
            expect(resolved!.resolvedAt).not.toBeNull()
        })

        it('returns null for unknown id', () => {
            expect(svc.resolveConflict('nope', 'local')).toBeNull()
        })
    })

    describe('resolveAll', () => {
        it('resolves all unresolved conflicts', () => {
            svc.createConflict({ projectRoot: '/proj', tokenName: 'a', localValue: '1', remoteValue: '2' })
            svc.createConflict({ projectRoot: '/proj', tokenName: 'b', localValue: '3', remoteValue: '4' })
            svc.createConflict({ projectRoot: '/other', tokenName: 'c', localValue: '5', remoteValue: '6' })

            const count = svc.resolveAll('/proj', 'local')
            expect(count).toBe(2)
            expect(svc.getConflicts('/proj')).toHaveLength(0)
            expect(svc.getConflicts('/other')).toHaveLength(1)
        })

        it('returns 0 when no conflicts exist', () => {
            expect(svc.resolveAll('/proj', 'remote')).toBe(0)
        })
    })
})
