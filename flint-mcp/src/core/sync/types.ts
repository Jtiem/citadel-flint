/**
 * SYNC.1 — Types for Figma Token Sync infrastructure.
 *
 * Covers: figma_connections, token_source, sync_history, pending_conflicts tables
 * and Figma REST API shapes.
 */

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'active' | 'disconnected' | 'error'

export interface FigmaConnection {
    id: string
    projectRoot: string
    figmaFileKey: string
    figmaFileName: string
    accessTokenEncrypted: string
    refreshTokenEncrypted: string | null
    tokenExpiry: string | null
    connectedAt: string
    lastSyncAt: string | null
    status: ConnectionStatus
}

// ---------------------------------------------------------------------------
// Token Source
// ---------------------------------------------------------------------------

export type TokenSourceType = 'figma' | 'local' | 'merged'

export interface TokenSource {
    id: string
    projectRoot: string
    tokenName: string
    tokenValue: string
    source: TokenSourceType
    figmaVariableId: string | null
    lastSyncedAt: string | null
    hash: string
}

// ---------------------------------------------------------------------------
// Sync History
// ---------------------------------------------------------------------------

export type SyncType = 'pull' | 'push' | 'auto'
export type SyncStatus = 'success' | 'partial' | 'failed'

export interface SyncHistoryEntry {
    id: string
    projectRoot: string
    syncType: SyncType
    startedAt: string
    completedAt: string | null
    status: SyncStatus
    tokensAdded: number
    tokensModified: number
    tokensRemoved: number
    conflictsDetected: number
    errorMessage: string | null
}

// ---------------------------------------------------------------------------
// Pending Conflicts
// ---------------------------------------------------------------------------

export type ConflictResolution = 'local' | 'remote' | 'merged' | null

export interface PendingConflict {
    id: string
    projectRoot: string
    tokenName: string
    localValue: string
    remoteValue: string
    figmaVariableId: string | null
    detectedAt: string
    resolvedAt: string | null
    resolution: ConflictResolution
}

// ---------------------------------------------------------------------------
// Figma REST API shapes
// ---------------------------------------------------------------------------

export interface FigmaVariable {
    id: string
    name: string
    key: string
    variableCollectionId: string
    resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR'
    valuesByMode: Record<string, unknown>
    description: string
    hiddenFromPublishing: boolean
    scopes: string[]
}

export interface FigmaVariableCollection {
    id: string
    name: string
    key: string
    modes: Array<{ modeId: string; name: string }>
    defaultModeId: string
    variableIds: string[]
}

export interface FigmaVariablesResponse {
    status: number
    error: boolean
    meta: {
        variables: Record<string, FigmaVariable>
        variableCollections: Record<string, FigmaVariableCollection>
    }
}

export interface FigmaVariableUpdate {
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    id?: string
    name?: string
    variableCollectionId?: string
    resolvedType?: string
    valuesByMode?: Record<string, unknown>
    description?: string
}

export interface FigmaVariableUpdateRequest {
    variables: FigmaVariableUpdate[]
    variableCollections?: Array<{
        action: 'CREATE' | 'UPDATE'
        id?: string
        name: string
    }>
}

export interface FigmaVariableUpdateResponse {
    status: number
    error: boolean
    meta?: {
        variables: Record<string, FigmaVariable>
    }
}

// ---------------------------------------------------------------------------
// HTTP client interface (injectable for testing)
// ---------------------------------------------------------------------------

export interface FigmaHttpClient {
    get(url: string, headers: Record<string, string>): Promise<{ status: number; json(): Promise<unknown> }>
    post(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; json(): Promise<unknown> }>
}
