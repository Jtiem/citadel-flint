import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { SyncSchema } from '../syncSchema.js'
import { SyncCheckService } from '../syncCheckService.js'
import { ConflictService } from '../conflictService.js'
import { SyncHistoryService } from '../syncHistoryService.js'
import { TokenSourceService } from '../tokenSourceService.js'
import { ConnectionService } from '../connectionService.js'

describe('SyncCheckService', () => {
    let db: BetterSqlite3.Database
    let svc: SyncCheckService
    let conflictSvc: ConflictService
    let historySvc: SyncHistoryService
    let tokenSourceSvc: TokenSourceService
    let connectionSvc: ConnectionService
    let tmpDir: string

    beforeEach(() => {
        db = new BetterSqlite3(':memory:')
        new SyncSchema(db)
        svc = new SyncCheckService(db)
        conflictSvc = new ConflictService(db)
        historySvc = new SyncHistoryService(db)
        tokenSourceSvc = new TokenSourceService(db)
        connectionSvc = new ConnectionService(db)

        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-check-'))
        fs.mkdirSync(path.join(tmpDir, '.flint'), { recursive: true })
    })

    it('returns ok when no tokens, no conflicts, no history', () => {
        const report = svc.runSyncCheck(tmpDir)
        expect(report.inSync).toBe(true)
        expect(report.pendingConflicts).toBe(0)
        expect(report.staleSince).toBeNull()
        expect(report.tokensDrifted).toBe(0)
        expect(report.recommendation).toBe('ok')
    })

    it('returns conflicts_pending when unresolved conflicts exist', () => {
        conflictSvc.createConflict({
            projectRoot: tmpDir,
            tokenName: 'color.primary',
            localValue: '"#ff0000"',
            remoteValue: '"#00ff00"',
        })
        const report = svc.runSyncCheck(tmpDir)
        expect(report.inSync).toBe(false)
        expect(report.pendingConflicts).toBe(1)
        expect(report.recommendation).toBe('conflicts_pending')
    })

    it('returns pull_needed when tokens drifted and connection exists', () => {
        // Set baseline
        tokenSourceSvc.updateBaseline(tmpDir, [
            { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'local' },
        ])

        // Write different local tokens
        fs.writeFileSync(
            path.join(tmpDir, '.flint', 'design-tokens.json'),
            JSON.stringify({ color: { primary: { $value: '#00ff00' } } }),
        )

        // Add a connection
        connectionSvc.createConnection(
            tmpDir,
            'abc123',
            'encrypted-token',
            'Test File',
        )

        const report = svc.runSyncCheck(tmpDir)
        expect(report.inSync).toBe(false)
        expect(report.tokensDrifted).toBe(1)
        expect(report.recommendation).toBe('pull_needed')
    })

    it('returns push_needed when tokens drifted and no connection', () => {
        tokenSourceSvc.updateBaseline(tmpDir, [
            { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'local' },
        ])

        fs.writeFileSync(
            path.join(tmpDir, '.flint', 'design-tokens.json'),
            JSON.stringify({ color: { primary: { $value: '#00ff00' } } }),
        )

        const report = svc.runSyncCheck(tmpDir)
        expect(report.inSync).toBe(false)
        expect(report.tokensDrifted).toBe(1)
        expect(report.recommendation).toBe('push_needed')
    })

    it('reports staleSince from last sync history', () => {
        historySvc.recordSync({
            projectRoot: tmpDir,
            syncType: 'pull',
            status: 'success',
            tokensAdded: 1,
            tokensModified: 0,
            tokensRemoved: 0,
            conflictsDetected: 0,
        })

        const report = svc.runSyncCheck(tmpDir)
        expect(report.staleSince).not.toBeNull()
        expect(report.staleSince).toMatch(/^\d{4}-\d{2}-\d{2}/)
    })

    it('detects new local tokens not in baseline as drifted', () => {
        // No baseline, but local tokens exist
        fs.writeFileSync(
            path.join(tmpDir, '.flint', 'design-tokens.json'),
            JSON.stringify({ spacing: { sm: { $value: '4px' } } }),
        )

        const report = svc.runSyncCheck(tmpDir)
        expect(report.tokensDrifted).toBe(1)
        expect(report.inSync).toBe(false)
    })

    it('detects baseline tokens missing locally as drifted', () => {
        tokenSourceSvc.updateBaseline(tmpDir, [
            { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'local' },
        ])

        // Empty local tokens
        fs.writeFileSync(
            path.join(tmpDir, '.flint', 'design-tokens.json'),
            '{}',
        )

        const report = svc.runSyncCheck(tmpDir)
        expect(report.tokensDrifted).toBe(1)
    })

    it('returns ok when local tokens match baseline exactly', () => {
        tokenSourceSvc.updateBaseline(tmpDir, [
            { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'local' },
        ])

        fs.writeFileSync(
            path.join(tmpDir, '.flint', 'design-tokens.json'),
            JSON.stringify({ color: { primary: { $value: '#ff0000' } } }),
        )

        const report = svc.runSyncCheck(tmpDir)
        expect(report.inSync).toBe(true)
        expect(report.tokensDrifted).toBe(0)
        expect(report.recommendation).toBe('ok')
    })
})
