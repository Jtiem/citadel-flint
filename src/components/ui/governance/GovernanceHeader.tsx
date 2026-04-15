/**
 * GovernanceHeader.tsx — C5 — extracted from GovernanceDashboard (Sprint 2 refactor)
 *
 * Header row for the governance health dashboard. Contains the Run Audit
 * button, Delta Mode badge, override count, Autopilot toggle, and the
 * "Undo to clean" Rewind button.
 *
 * Pure presentational — all state and handlers passed as props.
 *
 * Source lines: GovernanceDashboard.tsx ~1621-1685
 */

import { Loader2, Play, Undo2 } from 'lucide-react'
import { formatRelativeTime } from '../../../utils/relativeTime'

// ── Clean state snapshot shape ────────────────────────────────────────────────

export interface CleanStateSnapshot {
    score: number
    timestamp: string
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GovernanceHeaderProps {
    isAuditing: boolean
    activeFilePath: string | null
    totalViolations: number
    lastAuditRanAt: number | null
    isBaselineSet: boolean
    govOverrideCount: number
    autopilotEnabled: boolean
    lastCleanState: CleanStateSnapshot | null
    score: number
    onRunAudit: () => void
    onToggleAutopilot: () => void
    onRewindToClean: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GovernanceHeader({
    isAuditing,
    activeFilePath,
    totalViolations,
    lastAuditRanAt,
    isBaselineSet,
    govOverrideCount,
    autopilotEnabled,
    lastCleanState,
    score,
    onRunAudit,
    onToggleAutopilot,
    onRewindToClean,
}: GovernanceHeaderProps) {
    const isStale = totalViolations > 0 && lastAuditRanAt !== null && Date.now() - lastAuditRanAt > 120_000

    return (
        <div className="border-b border-zinc-800 px-3 py-2 flex items-end justify-end">
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={onRunAudit}
                    disabled={isAuditing || !activeFilePath}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed"
                    data-testid="run-audit-button"
                    aria-label={isAuditing ? 'Auditing in progress' : 'Run governance audit'}
                    title="Live linting runs continuously. Run Audit performs a deeper check and syncs results to your IDE."
                >
                    {isAuditing
                        ? <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                        : <Play size={10} aria-hidden="true" />}
                    {isAuditing ? 'Auditing...' : isStale ? 'Refresh Audit' : 'Run Audit'}
                </button>

                {isBaselineSet && (
                    <span
                        className="inline-flex items-center gap-1 rounded border border-indigo-500/40 bg-indigo-900/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400"
                        title="New Issues Only — issues present at baseline are excluded"
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
                        New Issues Only
                    </span>
                )}

                {govOverrideCount > 0 && (
                    <span
                        className="text-xs text-amber-400"
                        aria-label={`${govOverrideCount} governance rule ${govOverrideCount === 1 ? 'override' : 'overrides'} recorded this session`}
                    >
                        {govOverrideCount} {govOverrideCount === 1 ? 'override' : 'overrides'}
                    </span>
                )}

                {totalViolations > 0 && (
                    <button
                        type="button"
                        data-testid="autopilot-header-toggle"
                        onClick={onToggleAutopilot}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                            autopilotEnabled
                                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                        }`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${autopilotEnabled ? 'bg-indigo-400' : 'bg-zinc-600'}`} />
                        Autopilot {autopilotEnabled ? 'On' : 'Off'}
                    </button>
                )}

                <button
                    type="button"
                    data-testid="undo-to-clean-btn"
                    onClick={onRewindToClean}
                    disabled={!lastCleanState || score >= 95}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed"
                    aria-label={
                        lastCleanState
                            ? `Undo to last clean state from ${formatRelativeTime(lastCleanState.timestamp)}`
                            : 'No clean baseline recorded'
                    }
                    title={
                        lastCleanState
                            ? `Revert to clean state from ${formatRelativeTime(lastCleanState.timestamp)}`
                            : 'No clean baseline recorded'
                    }
                >
                    <Undo2 size={10} aria-hidden="true" />
                    Undo to clean
                </button>
            </div>
        </div>
    )
}
