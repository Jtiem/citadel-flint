import { describe, it, expect, beforeEach, vi } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { SyncSchema } from '../syncSchema.js'
import { TokenSyncEngine } from '../tokenSyncEngine.js'
import { flattenTokens } from '../tokenFileIO.js'
import { ConnectionService } from '../connectionService.js'
import { TokenSourceService } from '../tokenSourceService.js'
import { FigmaApiService } from '../figmaApiService.js'
import type { FigmaVariablesResponse, FigmaHttpClient } from '../types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpProject(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'))
    const flintDir = path.join(dir, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })
    return dir
}

function writeTokens(projectRoot: string, tokens: Record<string, unknown>): void {
    fs.writeFileSync(
        path.join(projectRoot, '.flint', 'design-tokens.json'),
        JSON.stringify(tokens, null, 2),
    )
}

function readTokens(projectRoot: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, '.flint', 'design-tokens.json'), 'utf-8'))
}

function makeFigmaResponse(
    vars: Array<{ id: string; name: string; value: unknown }>,
): FigmaVariablesResponse {
    const variables: Record<string, any> = {}
    for (const v of vars) {
        variables[v.id] = {
            id: v.id,
            name: v.name,
            key: v.id,
            variableCollectionId: 'col-1',
            resolvedType: 'STRING',
            valuesByMode: { 'mode-1': v.value },
            description: '',
            hiddenFromPublishing: false,
            scopes: [],
        }
    }
    return {
        status: 200,
        error: false,
        meta: {
            variables,
            variableCollections: {
                'col-1': {
                    id: 'col-1',
                    name: 'Default',
                    key: 'col-1',
                    modes: [{ modeId: 'mode-1', name: 'Default' }],
                    defaultModeId: 'mode-1',
                    variableIds: vars.map((v) => v.id),
                },
            },
        },
    }
}

function makeMockHttpClient(response: FigmaVariablesResponse): FigmaHttpClient {
    return {
        async get() {
            return { status: 200, json: async () => response }
        },
        async post() {
            return { status: 200, json: async () => ({ status: 200, error: false, meta: {} }) }
        },
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TokenSyncEngine', () => {
    let db: BetterSqlite3.Database
    let projectRoot: string

    beforeEach(() => {
        db = new BetterSqlite3(':memory:')
        new SyncSchema(db)
        projectRoot = makeTmpProject()
    })

    function setupEngine(figmaVars: Array<{ id: string; name: string; value: unknown }>) {
        const response = makeFigmaResponse(figmaVars)
        const httpClient = makeMockHttpClient(response)
        const figmaApi = new FigmaApiService(httpClient, async () => {})
        const engine = new TokenSyncEngine(db, figmaApi)

        // Create a connection so the engine can fetch from Figma
        const connSvc = new ConnectionService(db)
        connSvc.createConnection(projectRoot, 'file-key-1', 'fake-token')

        return engine
    }

    describe('flattenTokens', () => {
        it('flattens nested DTCG tokens', () => {
            const result = flattenTokens({
                color: { primary: { $value: '#ff0000' }, secondary: { $value: '#00ff00' } },
                spacing: { sm: { $value: '4px' } },
            })
            expect(result.get('color.primary')).toBe('"#ff0000"')
            expect(result.get('color.secondary')).toBe('"#00ff00"')
            expect(result.get('spacing.sm')).toBe('"4px"')
        })

        it('handles flat values', () => {
            const result = flattenTokens({ simple: 'val' })
            expect(result.get('simple')).toBe('"val"')
        })
    })

    describe('computeDiff — 7 categories', () => {
        it('detects added_remote (new in Figma, not local)', async () => {
            writeTokens(projectRoot, {})
            const engine = setupEngine([{ id: 'v1', name: 'color/new', value: '#fff' }])
            const diff = await engine.computeDiff(projectRoot)
            expect(diff.summary.added_remote).toBe(1)
            expect(diff.entries[0].category).toBe('added_remote')
            expect(diff.entries[0].tokenName).toBe('color.new')
        })

        it('detects added_local (new locally, not in Figma)', async () => {
            writeTokens(projectRoot, { brand: { $value: 'blue' } })
            const engine = setupEngine([])
            const diff = await engine.computeDiff(projectRoot)
            expect(diff.summary.added_local).toBe(1)
            expect(diff.entries[0].category).toBe('added_local')
        })

        it('detects modified_remote (changed in Figma, not locally)', async () => {
            writeTokens(projectRoot, { color: { primary: { $value: '#ff0000' } } })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([{ id: 'v1', name: 'color/primary', value: '#00ff00' }])
            const diff = await engine.computeDiff(projectRoot)
            expect(diff.summary.modified_remote).toBe(1)
        })

        it('detects modified_local (changed locally, not in Figma)', async () => {
            writeTokens(projectRoot, { color: { primary: { $value: '#changed' } } })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#original"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([{ id: 'v1', name: 'color/primary', value: '#original' }])
            const diff = await engine.computeDiff(projectRoot)
            expect(diff.summary.modified_local).toBe(1)
        })

        it('detects modified_both (changed in both — CONFLICT)', async () => {
            writeTokens(projectRoot, { color: { primary: { $value: '#local-change' } } })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#original"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([{ id: 'v1', name: 'color/primary', value: '#remote-change' }])
            const diff = await engine.computeDiff(projectRoot)
            expect(diff.summary.modified_both).toBe(1)
        })

        it('detects removed_remote (deleted from Figma)', async () => {
            writeTokens(projectRoot, { color: { primary: { $value: '#ff0000' } } })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([]) // Figma has no variables
            const diff = await engine.computeDiff(projectRoot)
            expect(diff.summary.removed_remote).toBe(1)
        })

        it('detects removed_local (deleted locally)', async () => {
            writeTokens(projectRoot, {}) // local tokens empty
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([{ id: 'v1', name: 'color/primary', value: '#ff0000' }])
            const diff = await engine.computeDiff(projectRoot)
            expect(diff.summary.removed_local).toBe(1)
        })

        it('reports no diff when everything is in sync', async () => {
            writeTokens(projectRoot, { color: { primary: { $value: '#ff0000' } } })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#ff0000"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([{ id: 'v1', name: 'color/primary', value: '#ff0000' }])
            const diff = await engine.computeDiff(projectRoot)
            expect(diff.entries).toHaveLength(0)
        })
    })

    describe('executePull', () => {
        it('applies remote additions and modifications to local tokens', async () => {
            writeTokens(projectRoot, { existing: { $value: 'keep' } })
            const engine = setupEngine([
                { id: 'v1', name: 'color/new', value: '#added' },
            ])

            const result = await engine.executePull(projectRoot)
            expect(result.pulled).toBeGreaterThanOrEqual(1)
            expect(result.conflicts).toBe(0)

            const tokens = readTokens(projectRoot)
            expect((tokens as any).color.new.$value).toBe('#added')
        })

        it('creates conflicts for modified_both entries', async () => {
            writeTokens(projectRoot, { color: { primary: { $value: '#local' } } })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#original"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([{ id: 'v1', name: 'color/primary', value: '#remote' }])

            const result = await engine.executePull(projectRoot)
            expect(result.conflicts).toBe(1)

            const conflicts = engine.conflicts.getConflicts(projectRoot)
            expect(conflicts).toHaveLength(1)
            expect(conflicts[0].tokenName).toBe('color.primary')
        })

        it('records sync history', async () => {
            writeTokens(projectRoot, {})
            const engine = setupEngine([{ id: 'v1', name: 'color/new', value: '#fff' }])
            const result = await engine.executePull(projectRoot)

            const history = engine.history.getLastSync(projectRoot)
            expect(history).not.toBeNull()
            expect(history!.id).toBe(result.syncHistoryId)
            expect(history!.syncType).toBe('pull')
        })
    })

    describe('executePush', () => {
        it('pushes local additions to Figma', async () => {
            writeTokens(projectRoot, { brand: { $value: 'blue' } })
            const engine = setupEngine([])
            const result = await engine.executePush(projectRoot)
            expect(result.pushed).toBeGreaterThanOrEqual(1)
        })

        it('throws when no connection exists', async () => {
            const figmaApi = new FigmaApiService(makeMockHttpClient(makeFigmaResponse([])), async () => {})
            const engine = new TokenSyncEngine(db, figmaApi)
            writeTokens(projectRoot, { x: { $value: '1' } })

            await expect(engine.executePush(projectRoot)).rejects.toThrow('No active Figma connection')
        })

        it('records sync history', async () => {
            writeTokens(projectRoot, { brand: { $value: 'blue' } })
            const engine = setupEngine([])
            const result = await engine.executePush(projectRoot)

            const history = engine.history.getLastSync(projectRoot)
            expect(history!.syncType).toBe('push')
            expect(history!.id).toBe(result.syncHistoryId)
        })
    })

    describe('resolveConflict', () => {
        it('resolves with local value', async () => {
            writeTokens(projectRoot, { color: { primary: { $value: '#local' } } })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#original"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([{ id: 'v1', name: 'color/primary', value: '#remote' }])
            await engine.executePull(projectRoot)

            const conflicts = engine.conflicts.getConflicts(projectRoot)
            expect(conflicts).toHaveLength(1)

            const result = engine.resolveConflict(conflicts[0].id, 'local')
            expect(result.resolved).toBe(true)
            expect(result.tokenName).toBe('color.primary')

            const tokens = readTokens(projectRoot)
            expect((tokens as any).color.primary.$value).toBe('#local')
        })

        it('resolves with remote value', async () => {
            writeTokens(projectRoot, { color: { primary: { $value: '#local' } } })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#original"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([{ id: 'v1', name: 'color/primary', value: '#remote' }])
            await engine.executePull(projectRoot)

            const conflicts = engine.conflicts.getConflicts(projectRoot)
            engine.resolveConflict(conflicts[0].id, 'remote')

            const tokens = readTokens(projectRoot)
            expect((tokens as any).color.primary.$value).toBe('#remote')
        })

        it('resolves with merged value', async () => {
            writeTokens(projectRoot, { color: { primary: { $value: '#local' } } })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#original"', source: 'figma', figmaVariableId: 'v1' },
            ])
            const engine = setupEngine([{ id: 'v1', name: 'color/primary', value: '#remote' }])
            await engine.executePull(projectRoot)

            const conflicts = engine.conflicts.getConflicts(projectRoot)
            engine.resolveConflict(conflicts[0].id, 'merged', '"#merged-value"')

            const tokens = readTokens(projectRoot)
            expect((tokens as any).color.primary.$value).toBe('#merged-value')
        })

        it('returns resolved:false for unknown id', () => {
            const engine = setupEngine([])
            const result = engine.resolveConflict('nonexistent', 'local')
            expect(result.resolved).toBe(false)
        })
    })

    describe('resolveAllConflicts', () => {
        it('bulk resolves all conflicts', async () => {
            writeTokens(projectRoot, {
                color: { primary: { $value: '#local1' }, secondary: { $value: '#local2' } },
            })
            const tsSvc = new TokenSourceService(db)
            tsSvc.updateBaseline(projectRoot, [
                { tokenName: 'color.primary', tokenValue: '"#orig1"', source: 'figma', figmaVariableId: 'v1' },
                { tokenName: 'color.secondary', tokenValue: '"#orig2"', source: 'figma', figmaVariableId: 'v2' },
            ])
            const engine = setupEngine([
                { id: 'v1', name: 'color/primary', value: '#remote1' },
                { id: 'v2', name: 'color/secondary', value: '#remote2' },
            ])
            await engine.executePull(projectRoot)

            expect(engine.conflicts.getConflicts(projectRoot)).toHaveLength(2)

            const result = engine.resolveAllConflicts(projectRoot, 'remote')
            expect(result.resolvedCount).toBe(2)
            expect(engine.conflicts.getConflicts(projectRoot)).toHaveLength(0)

            const tokens = readTokens(projectRoot)
            expect((tokens as any).color.primary.$value).toBe('#remote1')
            expect((tokens as any).color.secondary.$value).toBe('#remote2')
        })
    })
})
