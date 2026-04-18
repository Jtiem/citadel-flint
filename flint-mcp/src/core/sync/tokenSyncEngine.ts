/**
 * SYNC.2 — Three-Way Diff Sync Engine.
 *
 * Computes diffs between Figma Variables (remote), token_source baseline,
 * and the current design-tokens.json (local). Executes pull/push operations.
 */

import type Database from 'better-sqlite3'
import type { FigmaVariable, FigmaVariablesResponse, TokenSourceType } from './types.js'
import { TokenSourceService } from './tokenSourceService.js'
import { SyncHistoryService } from './syncHistoryService.js'
import { ConflictService } from './conflictService.js'
import { ConnectionService } from './connectionService.js'
import { FigmaApiService } from './figmaApiService.js'
import { type TokenFileIO, defaultFileIO, readLocalTokens, writeLocalTokens, flattenTokens } from './tokenFileIO.js'
import { sanitizeTokenValue } from '../../shared/tokenValueSanitizer.js'

// ---------------------------------------------------------------------------
// Diff categories
// ---------------------------------------------------------------------------

export type DiffCategory =
    | 'added_remote'
    | 'added_local'
    | 'modified_remote'
    | 'modified_local'
    | 'modified_both'
    | 'removed_remote'
    | 'removed_local'

export interface DiffEntry {
    category: DiffCategory
    tokenName: string
    localValue: string | null
    remoteValue: string | null
    baselineValue: string | null
    figmaVariableId: string | null
}

export interface DiffResult {
    entries: DiffEntry[]
    summary: Record<DiffCategory, number>
}

export interface PullResult {
    pulled: number
    conflicts: number
    syncHistoryId: string
}

export interface PushResult {
    pushed: number
    syncHistoryId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Figma variables to flat name/value map. */
export function figmaVariablesToMap(
    response: FigmaVariablesResponse,
): Map<string, { value: string; variableId: string }> {
    const result = new Map<string, { value: string; variableId: string }>()
    const vars = response.meta?.variables ?? {}
    const collections = response.meta?.variableCollections ?? {}

    for (const [id, variable] of Object.entries(vars)) {
        if (variable.hiddenFromPublishing) continue

        // Find the collection to get the default mode
        const collection = collections[variable.variableCollectionId]
        const defaultModeId = collection?.defaultModeId
        const modeValue = defaultModeId
            ? variable.valuesByMode[defaultModeId]
            : Object.values(variable.valuesByMode)[0]

        const name = variable.name.replace(/\//g, '.')
        result.set(name, {
            value: JSON.stringify(modeValue),
            variableId: id,
        })
    }
    return result
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class TokenSyncEngine {
    private readonly tokenSourceSvc: TokenSourceService
    private readonly historySvc: SyncHistoryService
    private readonly conflictSvc: ConflictService
    private readonly connectionSvc: ConnectionService
    private readonly figmaApi: FigmaApiService
    private readonly io: TokenFileIO

    constructor(
        db: Database.Database,
        figmaApi?: FigmaApiService,
        io?: TokenFileIO,
    ) {
        this.tokenSourceSvc = new TokenSourceService(db)
        this.historySvc = new SyncHistoryService(db)
        this.conflictSvc = new ConflictService(db)
        this.connectionSvc = new ConnectionService(db)
        this.figmaApi = figmaApi ?? new FigmaApiService()
        this.io = io ?? defaultFileIO
    }

    // Expose sub-services for direct access
    get conflicts(): ConflictService { return this.conflictSvc }
    get history(): SyncHistoryService { return this.historySvc }
    get tokenSource(): TokenSourceService { return this.tokenSourceSvc }

    /**
     * Compute the three-way diff between remote (Figma), baseline (token_source),
     * and local (design-tokens.json).
     */
    async computeDiff(projectRoot: string): Promise<DiffResult> {
        // 1. Load local tokens
        const localTokens = this.readLocalTokens(projectRoot)

        // 2. Load baseline
        const baselineRows = this.tokenSourceSvc.getBaseline(projectRoot)
        const baseline = new Map<string, { value: string; figmaVariableId: string | null }>()
        for (const row of baselineRows) {
            baseline.set(row.tokenName, { value: row.tokenValue, figmaVariableId: row.figmaVariableId })
        }

        // 3. Fetch remote from Figma
        const connection = this.connectionSvc.getConnection(projectRoot)
        let remote = new Map<string, { value: string; variableId: string }>()
        if (connection) {
            const response = await this.figmaApi.getFileVariables(
                connection.figmaFileKey,
                this.connectionSvc.decryptAccessToken(connection),
            )
            remote = figmaVariablesToMap(response)
        }

        // 4. Three-way diff
        const entries: DiffEntry[] = []
        const allNames = new Set([...localTokens.keys(), ...baseline.keys(), ...remote.keys()])

        for (const name of allNames) {
            const localVal = localTokens.get(name) ?? null
            const baseVal = baseline.get(name)?.value ?? null
            const remoteEntry = remote.get(name)
            const remoteVal = remoteEntry?.value ?? null
            const figmaVarId = remoteEntry?.variableId ?? baseline.get(name)?.figmaVariableId ?? null

            const localChanged = localVal !== baseVal
            const remoteChanged = remoteVal !== baseVal

            const inLocal = localTokens.has(name)
            const inBaseline = baseline.has(name)
            const inRemote = remote.has(name)

            let category: DiffCategory | null = null

            if (inRemote && !inBaseline && !inLocal) {
                category = 'added_remote'
            } else if (inLocal && !inBaseline && !inRemote) {
                category = 'added_local'
            } else if (inBaseline && !inRemote && inLocal) {
                category = 'removed_remote'
            } else if (inBaseline && inRemote && !inLocal) {
                category = 'removed_local'
            } else if (inBaseline && inRemote && inLocal) {
                if (remoteChanged && localChanged) {
                    category = 'modified_both'
                } else if (remoteChanged) {
                    category = 'modified_remote'
                } else if (localChanged) {
                    category = 'modified_local'
                }
                // If neither changed, no diff entry
            } else if (inRemote && inLocal && !inBaseline) {
                // Both added independently — treat as conflict if different
                if (localVal !== remoteVal) {
                    category = 'modified_both'
                }
                // If same value, no conflict
            }

            if (category) {
                entries.push({ category, tokenName: name, localValue: localVal, remoteValue: remoteVal, baselineValue: baseVal, figmaVariableId: figmaVarId })
            }
        }

        const summary: Record<DiffCategory, number> = {
            added_remote: 0, added_local: 0,
            modified_remote: 0, modified_local: 0, modified_both: 0,
            removed_remote: 0, removed_local: 0,
        }
        for (const e of entries) summary[e.category]++

        return { entries, summary }
    }

    /**
     * Execute a pull: apply remote changes to local tokens.
     * Auto-pulls added_remote and modified_remote. Creates conflicts for modified_both.
     */
    async executePull(projectRoot: string): Promise<PullResult> {
        const diff = await this.computeDiff(projectRoot)
        const localTokens = this.readLocalTokens(projectRoot)
        let pulled = 0
        let conflicts = 0

        for (const entry of diff.entries) {
            switch (entry.category) {
                case 'added_remote':
                case 'modified_remote': {
                    if (entry.remoteValue !== null) {
                        // MINT.5 Phase 1: sanitize incoming remote value before apply.
                        // Rejected values become conflicts instead of silent auto-merges.
                        const sanitizeResult = sanitizeTokenValue(entry.remoteValue, 'string')
                        if (sanitizeResult.rejected || sanitizeResult.sanitized === null) {
                            // Treat as a conflict so the user sees the bad value
                            this.conflictSvc.createConflict({
                                projectRoot,
                                tokenName: entry.tokenName,
                                localValue: entry.localValue ?? '',
                                remoteValue: entry.remoteValue,
                                figmaVariableId: entry.figmaVariableId,
                            })
                            conflicts++
                        } else {
                            localTokens.set(entry.tokenName, sanitizeResult.sanitized)
                            pulled++
                        }
                    }
                    break
                }
                case 'removed_remote': {
                    localTokens.delete(entry.tokenName)
                    pulled++
                    break
                }
                case 'modified_both': {
                    this.conflictSvc.createConflict({
                        projectRoot,
                        tokenName: entry.tokenName,
                        localValue: entry.localValue ?? '',
                        remoteValue: entry.remoteValue ?? '',
                        figmaVariableId: entry.figmaVariableId,
                    })
                    conflicts++
                    break
                }
            }
        }

        // Write updated local tokens
        this.writeLocalTokens(projectRoot, localTokens)

        // Update baseline with current state
        this.updateBaselineFromMaps(projectRoot, localTokens, diff)

        // Update connection timestamp
        this.connectionSvc.updateLastSync(projectRoot)

        // Record history
        const historyEntry = this.historySvc.recordSync({
            projectRoot,
            syncType: 'pull',
            status: conflicts > 0 ? 'partial' : 'success',
            tokensAdded: diff.summary.added_remote,
            tokensModified: diff.summary.modified_remote,
            tokensRemoved: diff.summary.removed_remote,
            conflictsDetected: conflicts,
        })

        return { pulled, conflicts, syncHistoryId: historyEntry.id }
    }

    /**
     * Execute a push: push local changes to Figma.
     * Pushes added_local and modified_local.
     */
    async executePush(projectRoot: string): Promise<PushResult> {
        const connection = this.connectionSvc.getConnection(projectRoot)
        if (!connection) {
            throw new Error('No active Figma connection for this project.')
        }

        const diff = await this.computeDiff(projectRoot)
        const updates: Array<{ action: 'CREATE' | 'UPDATE' | 'DELETE'; id?: string; name?: string; resolvedType?: string; valuesByMode?: Record<string, unknown> }> = []

        for (const entry of diff.entries) {
            switch (entry.category) {
                case 'added_local': {
                    if (entry.localValue !== null) {
                        updates.push({
                            action: 'CREATE',
                            name: entry.tokenName.replace(/\./g, '/'),
                            resolvedType: 'STRING',
                            valuesByMode: { default: JSON.parse(entry.localValue) },
                        })
                    }
                    break
                }
                case 'modified_local': {
                    if (entry.figmaVariableId && entry.localValue !== null) {
                        updates.push({
                            action: 'UPDATE',
                            id: entry.figmaVariableId,
                            valuesByMode: { default: JSON.parse(entry.localValue) },
                        })
                    }
                    break
                }
                case 'removed_local': {
                    if (entry.figmaVariableId) {
                        updates.push({
                            action: 'DELETE',
                            id: entry.figmaVariableId,
                        })
                    }
                    break
                }
            }
        }

        let pushed = updates.length
        if (pushed > 0) {
            await this.figmaApi.updateFileVariables(
                connection.figmaFileKey,
                this.connectionSvc.decryptAccessToken(connection),
                { variables: updates },
            )
        }

        // Update baseline
        const localTokens = this.readLocalTokens(projectRoot)
        this.updateBaselineFromMaps(projectRoot, localTokens, diff)

        // Update connection timestamp
        this.connectionSvc.updateLastSync(projectRoot)

        const historyEntry = this.historySvc.recordSync({
            projectRoot,
            syncType: 'push',
            status: 'success',
            tokensAdded: diff.summary.added_local,
            tokensModified: diff.summary.modified_local,
            tokensRemoved: diff.summary.removed_local,
            conflictsDetected: 0,
        })

        return { pushed, syncHistoryId: historyEntry.id }
    }

    /**
     * Resolve a single pending conflict.
     */
    resolveConflict(
        conflictId: string,
        resolution: 'local' | 'remote' | 'merged',
        mergedValue?: string,
    ): { resolved: boolean; tokenName: string | null } {
        const conflict = this.conflictSvc.getById(conflictId)
        if (!conflict) return { resolved: false, tokenName: null }

        this.conflictSvc.resolveConflict(conflictId, resolution, mergedValue)

        // Apply the resolution to local tokens
        const localTokens = this.readLocalTokens(conflict.projectRoot)
        let finalValue: string
        switch (resolution) {
            case 'local':
                finalValue = conflict.localValue
                break
            case 'remote':
                finalValue = conflict.remoteValue
                break
            case 'merged':
                finalValue = mergedValue ?? conflict.localValue
                break
        }
        localTokens.set(conflict.tokenName, finalValue)
        this.writeLocalTokens(conflict.projectRoot, localTokens)

        // Update baseline for this token
        this.tokenSourceSvc.upsertToken(
            conflict.projectRoot,
            conflict.tokenName,
            finalValue,
            resolution === 'merged' ? 'merged' : resolution === 'remote' ? 'figma' : 'local',
            conflict.figmaVariableId,
        )

        return { resolved: true, tokenName: conflict.tokenName }
    }

    /**
     * Bulk resolve all unresolved conflicts for a project.
     */
    resolveAllConflicts(
        projectRoot: string,
        resolution: 'local' | 'remote',
    ): { resolvedCount: number } {
        const conflicts = this.conflictSvc.getConflicts(projectRoot)
        const localTokens = this.readLocalTokens(projectRoot)

        for (const c of conflicts) {
            const value = resolution === 'local' ? c.localValue : c.remoteValue
            localTokens.set(c.tokenName, value)
            this.tokenSourceSvc.upsertToken(
                projectRoot,
                c.tokenName,
                value,
                resolution === 'remote' ? 'figma' : 'local',
                c.figmaVariableId,
            )
        }

        this.writeLocalTokens(projectRoot, localTokens)
        const resolvedCount = this.conflictSvc.resolveAll(projectRoot, resolution)
        return { resolvedCount }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private readLocalTokens(projectRoot: string): Map<string, string> {
        return readLocalTokens(projectRoot, this.io)
    }

    private writeLocalTokens(projectRoot: string, tokens: Map<string, string>): void {
        writeLocalTokens(projectRoot, tokens, this.io)
    }

    private updateBaselineFromMaps(
        projectRoot: string,
        localTokens: Map<string, string>,
        _diff: DiffResult,
    ): void {
        const tokens: Array<{ tokenName: string; tokenValue: string; source: TokenSourceType; figmaVariableId?: string | null }> = []
        for (const [name, value] of localTokens) {
            tokens.push({ tokenName: name, tokenValue: value, source: 'local' })
        }
        this.tokenSourceSvc.updateBaseline(projectRoot, tokens)
    }
}

// Re-export for convenience
export { flattenTokens }
