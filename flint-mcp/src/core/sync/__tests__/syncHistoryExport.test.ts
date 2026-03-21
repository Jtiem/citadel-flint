import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { SyncSchema } from '../syncSchema.js'
import { SyncHistoryService } from '../syncHistoryService.js'

describe('SyncHistoryService.exportHistory', () => {
    let db: BetterSqlite3.Database
    let svc: SyncHistoryService

    beforeEach(() => {
        db = new BetterSqlite3(':memory:')
        new SyncSchema(db)
        svc = new SyncHistoryService(db)
    })

    it('exports empty history as JSON', () => {
        const result = svc.exportHistory('/proj', 'json')
        expect(JSON.parse(result)).toEqual([])
    })

    it('exports history entries as JSON', () => {
        svc.recordSync({
            projectRoot: '/proj',
            syncType: 'pull',
            status: 'success',
            tokensAdded: 5,
            tokensModified: 2,
            tokensRemoved: 0,
            conflictsDetected: 0,
        })

        const result = JSON.parse(svc.exportHistory('/proj', 'json'))
        expect(result).toHaveLength(1)
        expect(result[0].syncType).toBe('pull')
        expect(result[0].tokensAdded).toBe(5)
    })

    it('exports empty history as CSV with headers only', () => {
        const result = svc.exportHistory('/proj', 'csv')
        const lines = result.split('\n')
        expect(lines).toHaveLength(1)
        expect(lines[0]).toContain('id,projectRoot,syncType')
    })

    it('exports history entries as CSV', () => {
        svc.recordSync({
            projectRoot: '/proj',
            syncType: 'push',
            status: 'partial',
            tokensAdded: 0,
            tokensModified: 3,
            tokensRemoved: 1,
            conflictsDetected: 2,
            errorMessage: 'partial failure',
        })

        const result = svc.exportHistory('/proj', 'csv')
        const lines = result.split('\n')
        expect(lines).toHaveLength(2)
        expect(lines[1]).toContain('push')
        expect(lines[1]).toContain('partial')
    })

    it('escapes commas and quotes in CSV', () => {
        svc.recordSync({
            projectRoot: '/proj',
            syncType: 'pull',
            status: 'failed',
            tokensAdded: 0,
            tokensModified: 0,
            tokensRemoved: 0,
            conflictsDetected: 0,
            errorMessage: 'error with "quotes" and, commas',
        })

        const result = svc.exportHistory('/proj', 'csv')
        // The error message should be properly escaped
        expect(result).toContain('"error with ""quotes"" and, commas"')
    })

    it('only exports history for the specified project', () => {
        svc.recordSync({
            projectRoot: '/proj-a',
            syncType: 'pull',
            status: 'success',
            tokensAdded: 1,
            tokensModified: 0,
            tokensRemoved: 0,
            conflictsDetected: 0,
        })
        svc.recordSync({
            projectRoot: '/proj-b',
            syncType: 'push',
            status: 'success',
            tokensAdded: 2,
            tokensModified: 0,
            tokensRemoved: 0,
            conflictsDetected: 0,
        })

        const resultA = JSON.parse(svc.exportHistory('/proj-a', 'json'))
        expect(resultA).toHaveLength(1)
        expect(resultA[0].tokensAdded).toBe(1)
    })
})
