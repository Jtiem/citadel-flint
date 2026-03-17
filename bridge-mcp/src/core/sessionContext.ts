/**
 * sessionContext.ts — bridge-mcp/src/core/sessionContext.ts
 *
 * Assembles a rich session context object from `.bridge/` files on disk.
 * This is the backing implementation for:
 *   - MCP resource:  bridge://session-context
 *   - MCP tool:      bridge_get_context
 *
 * Design principles:
 *   - Assembly budget < 100ms (reads small files, no AST traversal)
 *   - In-memory cache with 500ms TTL, keyed by projectRoot
 *   - Graceful degradation: any missing file → that section is null/empty, never throws
 *   - Reads ONLY .bridge/ files (no bridge.db SQLite — those live in the Electron process)
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
    ViolationSummary,
    TokenSummary,
    MutationEntry,
    CanvasState,
    SessionContext,
} from '../types.js'

// Re-export for consumers that import from this module
export type { ViolationSummary, TokenSummary, MutationEntry, CanvasState, SessionContext }

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
    context: SessionContext
    expiresAt: number
}

const CACHE_TTL_MS = 500

const cache = new Map<string, CacheEntry>()

function getCached(projectRoot: string): SessionContext | null {
    const entry = cache.get(projectRoot)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
        cache.delete(projectRoot)
        return null
    }
    return entry.context
}

function setCached(projectRoot: string, context: SessionContext): void {
    cache.set(projectRoot, {
        context,
        expiresAt: Date.now() + CACHE_TTL_MS,
    })
}

/**
 * Invalidate the cache for a given project root.
 * Call this when you know the underlying files have changed.
 */
export function invalidateSessionContextCache(projectRoot: string): void {
    cache.delete(projectRoot)
}

// ── File readers (all graceful) ──────────────────────────────────────────────

function safeReadJson<T>(filePath: string): T | null {
    try {
        if (!fs.existsSync(filePath)) return null
        const raw = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

function safeReadLines(filePath: string, maxLines: number): string[] {
    try {
        if (!fs.existsSync(filePath)) return []
        const raw = fs.readFileSync(filePath, 'utf-8')
        return raw.split('\n').filter(l => l.trim().length > 0).slice(-maxLines)
    } catch {
        return []
    }
}

// ── Canvas state assembly ────────────────────────────────────────────────────

function assembleCanvas(contextJson: Record<string, unknown> | null): CanvasState {
    if (!contextJson) {
        return {
            activeFile: null,
            selectedNodeId: null,
            canvasMode: null,
            figmaConnected: false,
            saveState: null,
        }
    }

    return {
        activeFile: typeof contextJson['activeFile'] === 'string' ? contextJson['activeFile'] : null,
        selectedNodeId: typeof contextJson['selectedNodeId'] === 'string' ? contextJson['selectedNodeId'] : null,
        canvasMode: (contextJson['canvasMode'] === 'design' || contextJson['canvasMode'] === 'interact')
            ? contextJson['canvasMode']
            : null,
        figmaConnected: contextJson['figmaConnected'] === true,
        saveState: (['saved', 'unsaved', 'saving'].includes(contextJson['saveState'] as string))
            ? (contextJson['saveState'] as 'saved' | 'unsaved' | 'saving')
            : null,
    }
}

// ── Active file source assembly ──────────────────────────────────────────────

function assembleActiveFileSource(
    activeFilePath: string | null,
): { source: string | null; filePath: string | null } {
    if (!activeFilePath) return { source: null, filePath: null }

    try {
        if (!fs.existsSync(activeFilePath)) return { source: null, filePath: activeFilePath }
        const raw = fs.readFileSync(activeFilePath, 'utf-8')
        const lines = raw.split('\n').slice(0, 200)
        return { source: lines.join('\n'), filePath: activeFilePath }
    } catch {
        return { source: null, filePath: activeFilePath }
    }
}

// ── Violation summary assembly ───────────────────────────────────────────────

function assembleViolations(contextJson: Record<string, unknown> | null): ViolationSummary {
    const empty: ViolationSummary = {
        mithrilCount: 0,
        a11yCount: 0,
        amberCount: 0,
        criticalCount: 0,
        affectedNodeIds: [],
        hasFixableViolations: false,
    }

    if (!contextJson) return empty

    try {
        const violations = contextJson['violations'] ?? contextJson['linterWarnings']
        if (!Array.isArray(violations)) return empty

        let mithrilCount = 0
        let a11yCount = 0
        let amberCount = 0
        let criticalCount = 0
        const nodeIds = new Set<string>()
        let hasFixable = false

        for (const v of violations) {
            if (typeof v !== 'object' || v === null) continue
            const vObj = v as Record<string, unknown>

            if (vObj['type'] === 'a11y') {
                a11yCount++
            } else {
                mithrilCount++
            }

            if (vObj['severity'] === 'amber') amberCount++
            if (vObj['severity'] === 'critical') criticalCount++

            if (typeof vObj['nodeId'] === 'string' && vObj['nodeId'].length > 0) {
                nodeIds.add(vObj['nodeId'] as string)
            }
            if (vObj['fixable'] === true) hasFixable = true
        }

        return {
            mithrilCount,
            a11yCount,
            amberCount,
            criticalCount,
            affectedNodeIds: Array.from(nodeIds).slice(0, 20),
            hasFixableViolations: hasFixable,
        }
    } catch {
        return empty
    }
}

// ── Token summary assembly ───────────────────────────────────────────────────

function assembleTokens(tokensJson: unknown[] | null): TokenSummary {
    const empty: TokenSummary = { totalCount: 0, byType: {}, top20: [] }

    if (!Array.isArray(tokensJson)) return empty

    try {
        const byType: Record<string, number> = {}
        const top20: TokenSummary['top20'] = []

        for (const token of tokensJson) {
            if (typeof token !== 'object' || token === null) continue
            const t = token as Record<string, unknown>
            const tokenType = typeof t['token_type'] === 'string' ? t['token_type'] : 'unknown'
            byType[tokenType] = (byType[tokenType] ?? 0) + 1

            if (top20.length < 20) {
                top20.push({
                    path: typeof t['token_path'] === 'string' ? t['token_path'] : '',
                    value: typeof t['token_value'] === 'string' ? t['token_value'] : '',
                    type: tokenType,
                })
            }
        }

        return {
            totalCount: tokensJson.length,
            byType,
            top20,
        }
    } catch {
        return empty
    }
}

// ── Recent mutations assembly ────────────────────────────────────────────────

function assembleRecentMutations(eventsJsonlPath: string): MutationEntry[] {
    const lines = safeReadLines(eventsJsonlPath, 5)
    const results: MutationEntry[] = []

    for (const line of lines) {
        try {
            const event = JSON.parse(line) as Record<string, unknown>
            results.push({
                batchId: typeof event['batchId'] === 'string' ? event['batchId'] : '',
                timestamp: typeof event['timestamp'] === 'string' ? event['timestamp'] : '',
                tool: typeof event['tool'] === 'string' ? event['tool'] : '',
                filePath: typeof event['filePath'] === 'string' ? event['filePath'] : '',
                mutationCount: typeof event['mutationCount'] === 'number' ? event['mutationCount'] : 0,
                outcome: typeof event['outcome'] === 'string' ? event['outcome'] : '',
            })
        } catch {
            // Skip malformed lines
        }
    }

    return results
}

// ── Health score assembly ────────────────────────────────────────────────────

interface DebtHistory {
    snapshots?: Array<{ score?: number; grade?: string }>
}

function assembleHealth(debtHistoryJson: DebtHistory | null): { score: number | null; grade: string | null } {
    if (!debtHistoryJson) return { score: null, grade: null }

    try {
        const snapshots = debtHistoryJson.snapshots
        if (!Array.isArray(snapshots) || snapshots.length === 0) return { score: null, grade: null }

        const latest = snapshots[snapshots.length - 1]
        return {
            score: typeof latest.score === 'number' ? latest.score : null,
            grade: typeof latest.grade === 'string' ? latest.grade : null,
        }
    } catch {
        return { score: null, grade: null }
    }
}

// ── Main assembly function ───────────────────────────────────────────────────

/**
 * Assemble a SessionContext for the given project root.
 *
 * Files read:
 *   .bridge/context.json         — canvas state + violations from Glass
 *   .bridge/design-tokens.json   — full token set
 *   .bridge/mcp-events.jsonl     — last 5 mutation events
 *   .bridge/debt-history.json    — health score + grade trend
 *
 * @param projectRoot - Absolute path to the project root containing `.bridge/`
 * @returns           - Assembled SessionContext (never throws)
 */
export async function assembleSessionContext(projectRoot: string): Promise<SessionContext> {
    // Check cache first
    const cached = getCached(projectRoot)
    if (cached) return cached

    const bridgeDir = path.join(projectRoot, '.bridge')
    let partial = false

    // Read context.json (Glass state)
    const contextJsonPath = path.join(bridgeDir, 'context.json')
    const contextJson = safeReadJson<Record<string, unknown>>(contextJsonPath)
    if (!contextJson) partial = true

    // Read design-tokens.json
    const tokensJsonPath = path.join(bridgeDir, 'design-tokens.json')
    const tokensJson = safeReadJson<unknown[]>(tokensJsonPath)
    if (!tokensJson) partial = true

    // Read debt-history.json
    const debtHistoryPath = path.join(bridgeDir, 'debt-history.json')
    const debtHistoryJson = safeReadJson<DebtHistory>(debtHistoryPath)

    // Assemble canvas state
    const canvas = assembleCanvas(contextJson)

    // Assemble active file source (first 200 lines)
    const { source: activeFileSource, filePath: activeFilePath } = assembleActiveFileSource(
        canvas.activeFile
    )

    // Assemble violations from context.json
    const violations = assembleViolations(contextJson)

    // Assemble token summary
    const tokens = assembleTokens(tokensJson)

    // Read last 5 mutation events
    const eventsPath = path.join(bridgeDir, 'mcp-events.jsonl')
    const recentMutations = assembleRecentMutations(eventsPath)

    // Assemble health score
    const { score: healthScore, grade: healthGrade } = assembleHealth(debtHistoryJson)

    const context: SessionContext = {
        assembledAt: new Date().toISOString(),
        projectRoot,
        canvas,
        activeFileSource,
        activeFilePath,
        violations,
        tokens,
        recentMutations,
        healthScore,
        healthGrade,
        partial,
    }

    setCached(projectRoot, context)
    return context
}
