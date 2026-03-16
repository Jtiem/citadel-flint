/**
 * contextPush.ts — Phase ACX.2: Event-Driven Context Push Manager
 *
 * Watches .bridge/context.json (and .bridge/design-tokens.json) for changes
 * via fs.watch. On each change it reads the new context, computes a
 * ContextDelta by comparing against the previously-seen snapshot, and — if the
 * change is significant — writes the delta to .bridge/mcp-events.jsonl using
 * the existing appendMCPEvent infrastructure so Glass receives a proactive
 * push notification.
 *
 * Significance thresholds (contract §8.2):
 *   file-switched        — always when activeFile path changes
 *   violations-changed   — when violation count changes by >= 1
 *   export-gate-changed  — when exportBlocked boolean toggles
 *   tokens-updated       — on any modification of design-tokens.json
 *   health-score-changed — when the grade letter changes
 *
 * Debounce: 300 ms per watched file to avoid thrashing on rapid saves.
 *
 * Constraints (Commandment 13 / process boundary):
 *   - Runs in the MCP server child process — direct fs access is permitted.
 *   - Uses only node:fs / node:path — no chokidar dependency.
 *   - All file reads are wrapped in try/catch; missing files are silently skipped.
 *   - Errors in the watch loop are swallowed — push is best-effort.
 */

import fs from 'node:fs'
import path from 'node:path'
import { appendMCPEvent, bridgeEvents, EVENTS } from './events.js'
import type {
    ContextDelta,
    ContextDeltaTrigger,
    ContextDeltaPayload,
    FileSwitchedPayload,
    ViolationsChangedPayload,
    ExportGatePayload,
    TokensUpdatedPayload,
    HealthScorePayload,
    FigmaImportPayload,
} from '../types.js'

// ── Internal snapshot shape — mirrors the BridgeContext fields we care about ─

interface ContextSnapshot {
    activeFile: string | null
    violationTotal: number
    exportBlocked: boolean
    exportBlockReason: string | null
    healthGrade: string | null
}

// ── ContextPushManager ────────────────────────────────────────────────────────

export class ContextPushManager {
    private projectRoot: string | null = null
    private prevSnapshot: ContextSnapshot | null = null

    /** fs.WatchHandle for context.json */
    private contextWatcher: fs.FSWatcher | null = null
    /** fs.WatchHandle for design-tokens.json */
    private tokensWatcher: fs.FSWatcher | null = null

    /** Debounce timer handles (one per watched file). */
    private contextDebounceTimer: ReturnType<typeof setTimeout> | null = null
    private tokensDebounceTimer: ReturnType<typeof setTimeout> | null = null

    /** Debounce interval in ms. */
    private readonly DEBOUNCE_MS = 300

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /**
     * Start watching the project's .bridge/ directory for state changes.
     * Safe to call multiple times — subsequent calls stop the previous watch.
     */
    start(projectRoot: string): void {
        // If already running for the same root, do nothing.
        if (this.projectRoot === projectRoot && this.contextWatcher !== null) return

        this.stop()

        this.projectRoot = projectRoot

        // Seed the initial snapshot so the first real change can be diffed.
        this.prevSnapshot = this.readContextSnapshot()

        // Watch context.json
        const contextPath = path.join(projectRoot, '.bridge', 'context.json')
        this.contextWatcher = this.watchFile(contextPath, () => this.handleContextChange())

        // Watch design-tokens.json
        const tokensPath = path.join(projectRoot, '.bridge', 'design-tokens.json')
        this.tokensWatcher = this.watchFile(tokensPath, () => this.handleTokensChange())

        // Listen for TOKENS_UPDATED from the in-process event bus (fired by
        // the ingestion server on a successful Figma import).
        bridgeEvents.on(EVENTS.TOKENS_UPDATED, this.onTokensUpdated)
    }

    /** Stop all watchers and release resources. */
    stop(): void {
        bridgeEvents.off(EVENTS.TOKENS_UPDATED, this.onTokensUpdated)

        if (this.contextDebounceTimer !== null) {
            clearTimeout(this.contextDebounceTimer)
            this.contextDebounceTimer = null
        }
        if (this.tokensDebounceTimer !== null) {
            clearTimeout(this.tokensDebounceTimer)
            this.tokensDebounceTimer = null
        }

        try { this.contextWatcher?.close() } catch { /* ignore */ }
        try { this.tokensWatcher?.close() } catch { /* ignore */ }

        this.contextWatcher = null
        this.tokensWatcher = null
        this.projectRoot = null
        this.prevSnapshot = null
    }

    // ── File-watch helpers ───────────────────────────────────────────────────

    /**
     * Create an fs.watch on a file path that is tolerant of the file not
     * existing yet. Returns the watcher handle (or null if unsupported).
     *
     * We watch the *directory* containing the file so that the watcher
     * survives atomic rename-based writes (write to .tmp then rename).
     */
    private watchFile(filePath: string, onChange: () => void): fs.FSWatcher | null {
        try {
            const dir = path.dirname(filePath)
            const base = path.basename(filePath)

            // Ensure the directory exists before watching it.
            if (!fs.existsSync(dir)) return null

            return fs.watch(dir, (eventType, filename) => {
                if (filename === base) {
                    onChange()
                }
            })
        } catch {
            // fs.watch may not be available (e.g. certain CI environments).
            return null
        }
    }

    // ── Change handlers ──────────────────────────────────────────────────────

    /** Called on every raw change event for context.json (debounced). */
    private handleContextChange(): void {
        if (this.contextDebounceTimer !== null) clearTimeout(this.contextDebounceTimer)
        this.contextDebounceTimer = setTimeout(() => {
            this.contextDebounceTimer = null
            this.processContextChange()
        }, this.DEBOUNCE_MS)
    }

    /** Called on every raw change event for design-tokens.json (debounced). */
    private handleTokensChange(): void {
        if (this.tokensDebounceTimer !== null) clearTimeout(this.tokensDebounceTimer)
        this.tokensDebounceTimer = setTimeout(() => {
            this.tokensDebounceTimer = null
            this.processTokensChange()
        }, this.DEBOUNCE_MS)
    }

    /**
     * Synchronously process the current context.json state without going
     * through the debounce timer. Used by tests to avoid timing dependencies.
     *
     * @internal — public only for testing purposes.
     */
    checkContextNow(): void {
        this.processContextChange()
    }

    /**
     * Synchronously process the current design-tokens.json state without
     * going through the debounce timer. Used by tests.
     *
     * @internal — public only for testing purposes.
     */
    checkTokensNow(): void {
        this.processTokensChange()
    }

    /**
     * Arrow function so `this` is always bound when used as an event listener
     * on bridgeEvents.
     */
    private readonly onTokensUpdated = (): void => {
        if (this.projectRoot === null) return

        const tokenCount = this.readTokenCount()
        const delta = this.buildDelta('figma-import-completed', {
            trigger: 'figma-import-completed',
            newTokenCount: tokenCount,
        } satisfies FigmaImportPayload)

        this.emitDelta(delta)
    }

    // ── Core delta computation ────────────────────────────────────────────────

    private processContextChange(): void {
        if (this.projectRoot === null) return

        const next = this.readContextSnapshot()
        const prev = this.prevSnapshot

        const deltas: ContextDelta[] = []

        if (prev !== null) {
            // 1. File switched
            if (next.activeFile !== prev.activeFile) {
                deltas.push(this.buildDelta('file-switched', {
                    trigger: 'file-switched',
                    filePath: next.activeFile ?? '',
                } satisfies FileSwitchedPayload))
            }

            // 2. Violation count changed by >= 1
            const violationDelta = next.violationTotal - prev.violationTotal
            if (violationDelta !== 0) {
                deltas.push(this.buildDelta('violations-changed', {
                    trigger: 'violations-changed',
                    filePath: next.activeFile ?? '',
                    added: Math.max(0, violationDelta),
                    resolved: Math.max(0, -violationDelta),
                    currentTotal: next.violationTotal,
                } satisfies ViolationsChangedPayload))
            }

            // 3. Export gate toggled
            if (next.exportBlocked !== prev.exportBlocked) {
                deltas.push(this.buildDelta('export-gate-changed', {
                    trigger: 'export-gate-changed',
                    blocked: next.exportBlocked,
                    reason: next.exportBlockReason,
                } satisfies ExportGatePayload))
            }

            // 4. Health grade changed
            if (
                next.healthGrade !== null &&
                prev.healthGrade !== null &&
                next.healthGrade !== prev.healthGrade
            ) {
                deltas.push(this.buildDelta('health-score-changed', {
                    trigger: 'health-score-changed',
                    previousGrade: prev.healthGrade,
                    newGrade: next.healthGrade,
                } satisfies HealthScorePayload))
            }
        }

        // Update snapshot before emitting so re-entrant calls see fresh state.
        this.prevSnapshot = next

        for (const delta of deltas) {
            this.emitDelta(delta)
        }
    }

    private processTokensChange(): void {
        if (this.projectRoot === null) return

        const tokenCount = this.readTokenCount()
        const delta = this.buildDelta('tokens-updated', {
            trigger: 'tokens-updated',
            newTotal: tokenCount,
        } satisfies TokensUpdatedPayload)

        this.emitDelta(delta)
    }

    // ── File readers (all try/catch) ─────────────────────────────────────────

    /**
     * Read .bridge/context.json and extract the fields needed for diffing.
     * Returns a zeroed snapshot if the file is missing or malformed.
     */
    private readContextSnapshot(): ContextSnapshot {
        if (this.projectRoot === null) {
            return {
                activeFile: null,
                violationTotal: 0,
                exportBlocked: false,
                exportBlockReason: null,
                healthGrade: null,
            }
        }

        try {
            const contextPath = path.join(this.projectRoot, '.bridge', 'context.json')
            const raw = fs.readFileSync(contextPath, 'utf-8')
            const ctx = JSON.parse(raw) as Record<string, unknown>

            // violationTotal: prefer explicit field; fall back to summing counts
            let violationTotal = 0
            if (typeof ctx['violationTotal'] === 'number') {
                violationTotal = ctx['violationTotal']
            } else {
                const v = ctx['violations'] as Record<string, unknown> | undefined
                if (v !== null && typeof v === 'object') {
                    const mithril = typeof v['mithrilCount'] === 'number' ? v['mithrilCount'] : 0
                    const a11y = typeof v['a11yCount'] === 'number' ? v['a11yCount'] : 0
                    violationTotal = mithril + a11y
                }
            }

            return {
                activeFile: typeof ctx['activeFile'] === 'string' ? ctx['activeFile'] : null,
                violationTotal,
                exportBlocked: ctx['exportBlocked'] === true,
                exportBlockReason: typeof ctx['exportBlockReason'] === 'string' ? ctx['exportBlockReason'] : null,
                healthGrade: typeof ctx['healthGrade'] === 'string' ? ctx['healthGrade'] : null,
            }
        } catch {
            return {
                activeFile: null,
                violationTotal: 0,
                exportBlocked: false,
                exportBlockReason: null,
                healthGrade: null,
            }
        }
    }

    /**
     * Read .bridge/design-tokens.json and return the total token count.
     * Returns 0 if the file is missing or malformed.
     */
    private readTokenCount(): number {
        if (this.projectRoot === null) return 0

        try {
            const tokensPath = path.join(this.projectRoot, '.bridge', 'design-tokens.json')
            const raw = fs.readFileSync(tokensPath, 'utf-8')
            const tokens = JSON.parse(raw) as unknown

            if (Array.isArray(tokens)) return tokens.length

            // Some token files are objects keyed by token path
            if (tokens !== null && typeof tokens === 'object') {
                return Object.keys(tokens as Record<string, unknown>).length
            }

            return 0
        } catch {
            return 0
        }
    }

    // ── Delta construction + emission ─────────────────────────────────────────

    private buildDelta(trigger: ContextDeltaTrigger, payload: ContextDeltaPayload): ContextDelta {
        return {
            timestamp: new Date().toISOString(),
            trigger,
            payload,
        }
    }

    /**
     * Write the delta to mcp-events.jsonl and fire the MCP
     * notifications/resources/list_changed signal via the in-process
     * bridgeEvents bus (server.ts listens to this and calls server.notification).
     */
    private emitDelta(delta: ContextDelta): void {
        if (this.projectRoot === null) return

        // Write to .bridge/mcp-events.jsonl
        appendMCPEvent(this.projectRoot, {
            timestamp: Date.now(),
            type: 'context-delta',
            severity: 'info',
            summary: JSON.stringify(delta),
        })

        // Signal server.ts to send notifications/resources/list_changed.
        // We use CONTEXT_DELTA (not TOKENS_UPDATED) to avoid recursion:
        // server.ts can listen to either; TOKENS_UPDATED is reserved for the
        // ingestion server's own events.
        bridgeEvents.emit(EVENTS.CONTEXT_DELTA)
    }
}

// ── Module-level singleton ────────────────────────────────────────────────────

/**
 * Singleton instance used by server.ts.
 * Exported separately so tests can create isolated instances.
 */
export const contextPushManager = new ContextPushManager()
