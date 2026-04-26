/**
 * SyncActionCluster — src/components/ui/mint/SyncActionCluster.tsx
 *
 * MINT.5 Phase 2 — Sync Action Surfaces (Group A)
 *
 * Purely presentational cluster of three buttons — Pull, Push, Resolve —
 * rendered at the trailing edge of TokenHealthBar. Falls back to a single
 * "Connect Figma" CTA when Figma is disconnected.
 *
 * This component does NOT call window.flintAPI or any store. All orchestration
 * lives in useSyncActions; callbacks flow in via props. Disabled-state matrix:
 *
 *   figmaConnected=false         → show "Connect Figma" button only
 *                                  (Pull/Push/Resolve not rendered)
 *   driftCount=0                 → disable Pull with aria-label "Up to date"
 *   localEditCount=0             → disable Push with title "No local changes"
 *   pendingConflictCount=0       → disable Resolve
 *   syncOp !== null              → disable all three; spinner on the active one
 *
 * Renderer Process only — no Node.js imports.
 */

import { Download, Upload, GitMerge, Loader2, Unplug } from 'lucide-react'
import type { SyncActionClusterProps } from '../../../../.flint-context/contracts/MINT.5-phase2.contract'

// ── Component ────────────────────────────────────────────────────────────────

export function SyncActionCluster({
    figmaConnected,
    driftCount,
    pendingConflictCount,
    localEditCount,
    syncOp,
    onPull,
    onPush,
    onResolve,
    onConnect,
}: SyncActionClusterProps) {
    // ── Disconnected fallback ────────────────────────────────────────────────
    // When Figma is not connected we short-circuit the cluster to a single
    // Connect CTA. If no onConnect handler was provided there is no meaningful
    // action to surface, so we render nothing at all (Test: "Renders no cluster
    // when onConnect undefined and disconnected").
    if (!figmaConnected) {
        if (!onConnect) return null
        return (
            <div
                className="flex flex-wrap items-center gap-1.5"
                data-testid="sync-action-cluster"
                data-connected="false"
            >
                <button
                    type="button"
                    onClick={onConnect}
                    disabled={syncOp === 'connect'}
                    data-testid="sync-connect"
                    aria-label="Connect Figma"
                    className="inline-flex items-center gap-1.5 rounded-md border border-indigo-600 bg-indigo-600/20 px-2.5 py-1 text-xs font-medium text-indigo-100 transition-colors hover:bg-indigo-600/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {syncOp === 'connect' ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                        <Unplug className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span>Connect Figma</span>
                </button>
            </div>
        )
    }

    // ── Connected cluster ────────────────────────────────────────────────────
    // Invariant: any in-flight op disables ALL buttons so two simultaneous
    // actions cannot collide. The spinner replaces the icon on the active op.
    const opInFlight = syncOp !== null

    const pullDisabled = opInFlight || driftCount === 0
    const pushDisabled = opInFlight || localEditCount === 0
    const resolveDisabled = opInFlight || pendingConflictCount === 0

    const pullLabel = driftCount === 0 ? 'Up to date' : `Pull ${driftCount} from Figma`
    const pushLabel = localEditCount === 0 ? 'No local changes' : `Push ${localEditCount} to Figma`
    const resolveLabel =
        pendingConflictCount === 0
            ? 'No conflicts to resolve'
            : `Resolve ${pendingConflictCount} conflicts`

    return (
        <div
            className="flex flex-wrap items-center gap-1.5"
            data-testid="sync-action-cluster"
            data-connected="true"
        >
            {/* ── Pull ─────────────────────────────────────────────────────── */}
            <button
                type="button"
                onClick={onPull}
                disabled={pullDisabled}
                data-testid="sync-pull"
                aria-label={pullLabel}
                title={driftCount === 0 ? 'No drift to pull' : pullLabel}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {syncOp === 'pull' ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" data-testid="sync-pull-spinner" />
                ) : (
                    <Download className="h-3 w-3" aria-hidden="true" />
                )}
                <span>Pull</span>
            </button>

            {/* ── Push ─────────────────────────────────────────────────────── */}
            <button
                type="button"
                onClick={onPush}
                disabled={pushDisabled}
                data-testid="sync-push"
                aria-label={pushLabel}
                title={localEditCount === 0 ? 'No local changes' : pushLabel}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {syncOp === 'push' ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" data-testid="sync-push-spinner" />
                ) : (
                    <Upload className="h-3 w-3" aria-hidden="true" />
                )}
                <span>Push</span>
            </button>

            {/* ── Resolve ──────────────────────────────────────────────────── */}
            <button
                type="button"
                onClick={onResolve}
                disabled={resolveDisabled}
                data-testid="sync-resolve"
                aria-label={resolveLabel}
                title={resolveLabel}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {syncOp === 'resolve' ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" data-testid="sync-resolve-spinner" />
                ) : (
                    <GitMerge className="h-3 w-3" aria-hidden="true" />
                )}
                <span>Resolve{pendingConflictCount > 0 ? ` (${pendingConflictCount})` : ''}</span>
            </button>
        </div>
    )
}
