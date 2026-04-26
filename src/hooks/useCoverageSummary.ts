/**
 * useCoverageSummary.ts — src/hooks/useCoverageSummary.ts
 *
 * Phase 0 — Coverage Honesty
 *
 * Fetches the aggregate CoverageSummary from the main process via
 * `window.flintAPI.coverage.getSummary()` on mount, and re-fetches
 * whenever the existing MCP push channel fires an event with
 * `eventType === "debt-scan-complete"`.
 *
 * Architectural decisions (from contract):
 *   - No Zustand store — coverage is derived, not owned. The IPC handler
 *     (backed by DebtReportService in the main process) is the source of truth.
 *   - Uses the existing `window.flintAPI.mcp.onEvent` push channel; does NOT
 *     introduce any new IPC surface.
 *   - IPC calls live in this hook, not in a store (per Flint architectural
 *     anti-pattern guidance).
 *
 * Invariant enforced: the `summary` returned never feeds the grade formula.
 * The hook exposes `CoverageSummary` directly from the engine; nothing here
 * derives a score or grade from coverage data (coverage-grade-independence = 0).
 *
 * Renderer process only — no Node.js imports.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CoverageSummary } from '../../shared/coverage-types'

// ─── Local type shim ─────────────────────────────────────────────────────────
//
// `window.flintAPI.coverage` is declared by the `flint-electron-ipc` agent in
// `src/types/flint-api.d.ts` and `electron/preload.ts`. We reference it via an
// interface-only declaration here so this hook compiles independently of that
// agent's delivery. When both agents land, the declaration merges cleanly.
//
// If TypeScript cannot find the property at compile time, this cast ensures the
// hook still type-checks. The runtime guard (`window.flintAPI?.coverage`) is the
// true safety net.

interface FlintAPICoverageNamespace {
    getSummary(): Promise<CoverageSummary>
}

/**
 * Narrow event shape. The full MCPEvent type lives in flint-api.d.ts but we
 * only need `eventType` here. Using a minimal local interface avoids a hard
 * dependency on that file during parallel Group A work.
 */
interface MinimalMCPEvent {
    type?: string
    eventType?: string
    [key: string]: unknown
}

// ─── Return type ─────────────────────────────────────────────────────────────

export interface UseCoverageSummaryResult {
    /** The most recently fetched CoverageSummary. `null` on the initial render
     *  while the first IPC request is in flight. */
    summary: CoverageSummary | null
    /** True while the initial fetch (or any triggered refetch) is in progress. */
    isLoading: boolean
    /** Manually re-fetches the summary from the main process. */
    refetch: () => Promise<void>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Fetches and subscribes to the CoverageSummary produced by DebtReportService.
 *
 * Lifecycle:
 *   1. On mount: calls `window.flintAPI.coverage.getSummary()` once.
 *   2. Subscribes to `window.flintAPI.mcp.onEvent` for the push channel.
 *      Ignores all events except those where `eventType === "debt-scan-complete"`.
 *   3. On unmount: calls `window.flintAPI.mcp.removeEventListener()` to clean up.
 *
 * Degrades gracefully in test/headless environments where `window.flintAPI` or
 * its sub-namespaces are absent.
 */
export function useCoverageSummary(): UseCoverageSummaryResult {
    const [summary, setSummary] = useState<CoverageSummary | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)

    // Track mounted state to prevent state updates after unmount.
    const isMountedRef = useRef(true)

    const refetch = useCallback(async (): Promise<void> => {
        const api = (window as unknown as { flintAPI?: { coverage?: FlintAPICoverageNamespace } }).flintAPI

        if (!api?.coverage?.getSummary) {
            // IPC layer not available (e.g. Vitest with a partial mock, or web
            // build before the coverage namespace ships). Treat as no-op but
            // ensure isLoading is cleared so the UI doesn't spin forever.
            if (isMountedRef.current) {
                setIsLoading(false)
            }
            return
        }

        if (isMountedRef.current) {
            setIsLoading(true)
        }

        try {
            const result = await api.coverage.getSummary()
            if (isMountedRef.current) {
                setSummary(result)
            }
        } catch {
            // Silently swallow — the badge renders a placeholder when summary is null.
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false)
            }
        }
    }, [])

    useEffect(() => {
        isMountedRef.current = true

        // ── Initial fetch ──────────────────────────────────────────────────
        void refetch()

        // ── Subscribe to the existing MCP push channel ────────────────────
        //
        // The push channel delivers batches of MCPEvent objects. We filter for
        // events whose `eventType` (or `type`) equals "debt-scan-complete" and
        // call refetch(). Every other event is ignored — this hook only cares
        // about coverage data becoming stale after a debt scan.
        const mcpApi = (window as unknown as {
            flintAPI?: {
                mcp?: {
                    onEvent: (cb: (events: unknown[]) => void) => void
                    removeEventListener: () => void
                }
            }
        }).flintAPI?.mcp

        if (mcpApi?.onEvent) {
            const handleEvents = (events: unknown[]): void => {
                for (const raw of events) {
                    const event = raw as MinimalMCPEvent
                    // The push channel uses `type` for standard event types.
                    // The contract specifies filtering on `eventType === "debt-scan-complete"`.
                    // We check both fields to be resilient to any payload variation.
                    const matchType = event.type === 'debt-scan-complete'
                    const matchEventType = event.eventType === 'debt-scan-complete'
                    if (matchType || matchEventType) {
                        void refetch()
                        // Only need one match per batch to trigger a refetch.
                        break
                    }
                }
            }

            mcpApi.onEvent(handleEvents)
        }

        return () => {
            isMountedRef.current = false

            // Remove the MCP event listener registered above.
            const cleanupMcp = (window as unknown as {
                flintAPI?: {
                    mcp?: { removeEventListener: () => void }
                }
            }).flintAPI?.mcp

            cleanupMcp?.removeEventListener()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    // `refetch` is stable (useCallback with [] deps) — including it in the dep
    // array would cause re-subscription on every render. The effect intentionally
    // runs once on mount.

    return { summary, isLoading, refetch }
}
