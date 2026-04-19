/**
 * useSyncStaleness — src/hooks/useSyncStaleness.ts
 *
 * MINT.5 Phase 3 — Sync Staleness Banner (Envoy)
 *
 * Polls `flint_sync_check` every 60s (configurable) while mounted and the
 * `enabled` flag is true (i.e. Figma is connected). Computes `isStale` by
 * comparing `staleSince` against the configurable threshold (default 24h).
 *
 * Auto-clears the per-session dismissal when a fresh sync is detected:
 *   If `staleSince` is a timestamp *newer* than `dismissedAt`, the user has
 *   completed a sync since they last dismissed — the banner should re-appear
 *   the next time staleness crosses the threshold. `clearDismissal()` is
 *   called once to reset the store.
 *
 * Return shape: UseSyncStalenessResult
 *   isStale        — true when elapsed time ≥ threshold
 *   hoursSinceSync — hours since last sync, or null if no sync recorded
 *   staleSince     — raw ISO timestamp from SyncCheckReport, or null
 *   dismiss        — marks the banner dismissed for this session
 *
 * Note: `isStale` reflects the *pre-dismissal* staleness state. The banner
 * component decides whether to render based on both `isStale` and the
 * `dismissedAt` from the store.
 *
 * IPC path: `window.flintAPI.mcp.callTool('flint_sync_check', { projectRoot })`
 *   - Degrades gracefully when `window.flintAPI` is unavailable: polling never
 *     starts, `isStale` stays false, `hoursSinceSync` stays null.
 *
 * Commandments honored:
 *   - C14 (Bypass Prohibition): no direct fs/git calls.
 *   - C12 (Atomic Queuing): poll state updates are atomic Zustand `set` calls.
 *   - Process boundary: IPC only through `window.flintAPI`.
 *
 * Contract: MINT.5-phase3.contract.ts / UseSyncStalenessResult
 * Owner: flint-state-architect
 * Renderer process only — no Node.js imports.
 */

import { useEffect, useRef, useState } from 'react'
import {
    SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT,
    isSyncStale,
} from '../../shared/syncStaleness'
import { useSyncStalenessStore } from '../store/syncStalenessStore'
import type {
    UseSyncStalenessOptions,
    UseSyncStalenessResult,
} from '../../.flint-context/contracts/MINT.5-phase3.contract'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL_MS = 60_000

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * SyncCheckReport shape — the portion we care about.
 * Full type lives in flint-mcp/src/core/sync/syncCheckService.ts but we
 * cannot import across the process boundary, so we mirror only what we need.
 */
interface SyncCheckReport {
    staleSince?: string | null
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSyncStaleness(options: UseSyncStalenessOptions): UseSyncStalenessResult {
    const {
        projectRoot,
        thresholdHours = SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT,
        pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
        enabled = true,
    } = options

    // Local state: mirrors the latest poll result.
    const [staleSince, setStaleSince] = useState<string | null>(null)
    const [hoursSinceSync, setHoursSinceSync] = useState<number | null>(null)
    const [isStale, setIsStale] = useState<boolean>(false)

    // Store: access dismiss/clearDismissal actions.
    const dismiss = useSyncStalenessStore((s) => s.dismiss)
    const clearDismissal = useSyncStalenessStore((s) => s.clearDismissal)

    // Stable refs to avoid stale closures inside the polling interval.
    // These are updated on every render so the interval always uses current values.
    const mountedRef = useRef(true)
    const thresholdRef = useRef(thresholdHours)
    const projectRootRef = useRef(projectRoot)

    // Keep refs in sync with props on every render.
    thresholdRef.current = thresholdHours
    projectRootRef.current = projectRoot

    // ── Polling effect ───────────────────────────────────────────────────────

    useEffect(() => {
        mountedRef.current = true

        if (!enabled) {
            // When disabled, reset derived state and register no timer.
            setStaleSince(null)
            setHoursSinceSync(null)
            setIsStale(false)
            return () => {
                mountedRef.current = false
            }
        }

        // Single poll execution — reads from refs to avoid stale closure issues.
        async function runPoll(): Promise<void> {
            if (!mountedRef.current) return

            const callTool = typeof window !== 'undefined'
                ? window.flintAPI?.mcp?.callTool
                : undefined
            if (typeof callTool !== 'function') return

            try {
                const result = await callTool('flint_sync_check', { projectRoot: projectRootRef.current })

                if (!mountedRef.current) return

                // SyncCheckReport is returned as JSON text in content[0].text.
                const raw = result?.content?.[0]?.text
                if (typeof raw !== 'string' || result?.isError) {
                    return
                }

                let report: SyncCheckReport
                try {
                    report = JSON.parse(raw) as SyncCheckReport
                } catch {
                    return
                }

                const nextStaleSince = report.staleSince ?? null
                const nowMs = Date.now()
                const stale = isSyncStale(nextStaleSince, thresholdRef.current, nowMs)

                // Compute hours elapsed for display.
                let hours: number | null = null
                if (nextStaleSince !== null) {
                    const syncMs = Date.parse(nextStaleSince)
                    if (!isNaN(syncMs)) {
                        hours = (nowMs - syncMs) / 3_600_000
                    }
                }

                setStaleSince(nextStaleSince)
                setHoursSinceSync(hours)
                setIsStale(stale)

                // Auto-clear dismissal when a fresh sync is detected.
                // Read current dismissedAt directly from the store (not from React
                // state) to avoid the stale-closure problem.
                const currentDismissedAt = useSyncStalenessStore.getState().dismissedAt
                if (currentDismissedAt !== null && nextStaleSince !== null) {
                    const syncMs = Date.parse(nextStaleSince)
                    if (!isNaN(syncMs) && syncMs > currentDismissedAt) {
                        clearDismissal()
                    }
                }
            } catch {
                // Ignore poll errors silently.
            }
        }

        // Fire immediately on mount (avoid 60s wait on first load).
        void runPoll()

        const intervalId = setInterval(() => {
            void runPoll()
        }, pollIntervalMs)

        return () => {
            // Invariant: staleness-poll-cleanup — zero active timers after unmount.
            clearInterval(intervalId)
            mountedRef.current = false
        }
    // Re-run when enabled/pollIntervalMs change. projectRoot and thresholdHours
    // changes are handled via refs — they take effect on the next poll tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, pollIntervalMs])

    // ── Return ───────────────────────────────────────────────────────────────

    return {
        isStale,
        hoursSinceSync,
        staleSince,
        dismiss,
    }
}
