/**
 * BatchActionBar.tsx — Extracted from GovernanceDashboard (Sprint 3A refactor)
 *
 * Renders the batch action buttons above the violations list:
 * - Apply N accepted fixes
 * - Auto-fix N Mithril issues
 * - Fix all a11y (N)
 * - Review N manually (expands those cards)
 * - Session fix progress indicator
 *
 * Mithril compliance:
 * - No hardcoded hex colours — token palette only.
 * - No arbitrary spacing — 4px grid scale only.
 */

import { Check, Wand2 } from 'lucide-react'

export interface BatchActionBarProps {
    acceptedCount: number
    autoFixableCount: number
    a11yFixableCount: number
    manualCount: number
    onApplyAccepted: () => void
    onAutoFixMithril: () => void
    onFixAllA11y: () => void
    onReviewManual: () => void
    sessionProgress?: { fixed: number; total: number }
    isBaselineSet?: boolean
    /** COUNSEL.2.4: Effort estimate text (detailed breakdown) */
    effortEstimate?: string
}

export function BatchActionBar({
    acceptedCount,
    autoFixableCount,
    a11yFixableCount,
    manualCount,
    onApplyAccepted,
    onAutoFixMithril,
    onFixAllA11y,
    onReviewManual,
    sessionProgress,
    isBaselineSet = false,
    effortEstimate,
}: BatchActionBarProps) {
    const allFixed = sessionProgress && sessionProgress.total > 0 && sessionProgress.fixed >= sessionProgress.total
    return (
        <div className="border-b border-zinc-800">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <h3 className="flex-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
                Issues
                {isBaselineSet && <span className="ml-1.5 text-indigo-400">(new only)</span>}
            </h3>

            {/* COUNSEL.2.5: Session fix progress indicator */}
            {sessionProgress && sessionProgress.total > 0 && !allFixed && (
                <span
                    data-testid="session-progress-indicator"
                    className="text-[10px] text-zinc-500"
                    aria-live="polite"
                >
                    Fixed {Math.max(0, sessionProgress.fixed)} of {sessionProgress.total} this session
                </span>
            )}

            {/* COUNSEL.1.4: Apply accepted fixes queue */}
            {acceptedCount > 0 && (
                <button
                    type="button"
                    onClick={onApplyAccepted}
                    data-testid="apply-accepted-fixes-button"
                    className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-900/20 px-2.5 py-1 text-[10px] text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 transition-colors"
                    aria-label={`Apply ${acceptedCount} accepted ${acceptedCount === 1 ? 'fix' : 'fixes'}`}
                >
                    <Check size={9} aria-hidden="true" />
                    Apply {acceptedCount} {acceptedCount === 1 ? 'fix' : 'fixes'}
                </button>
            )}

            {/* Auto-fix Mithril issues */}
            {autoFixableCount > 0 && (
                <button
                    type="button"
                    onClick={onAutoFixMithril}
                    className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/20 px-2.5 py-1 text-[10px] text-indigo-400 hover:bg-indigo-900/40 hover:text-indigo-300 transition-colors"
                    aria-label={`Fix all ${autoFixableCount} auto-fixable issues`}
                >
                    <Wand2 size={9} aria-hidden="true" />
                    Auto-fix {autoFixableCount} {autoFixableCount === 1 ? 'issue' : 'issues'}
                </button>
            )}

            {/* COUNSEL.1.6: Fix all a11y */}
            {a11yFixableCount > 0 && (
                <button
                    type="button"
                    onClick={onFixAllA11y}
                    data-testid="fix-all-a11y-button"
                    className="flex items-center gap-1 rounded border border-red-500/30 bg-red-900/20 px-2.5 py-1 text-[10px] text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-colors"
                    aria-label={`Fix all ${a11yFixableCount} auto-fixable accessibility issues`}
                >
                    <Wand2 size={9} aria-hidden="true" />
                    Fix all a11y ({a11yFixableCount})
                </button>
            )}

            {/* Review manual a11y */}
            {manualCount > 0 && (
                <button
                    type="button"
                    onClick={onReviewManual}
                    data-testid="review-manual-a11y-button"
                    className="text-[10px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline transition-colors"
                    aria-label={`Review ${manualCount} accessibility issues that need manual input`}
                >
                    Review {manualCount} manually
                </button>
            )}
            </div>

            {/* COUNSEL.2.4: Effort estimate */}
            {effortEstimate && !allFixed && (
                <p
                    data-testid="effort-estimate"
                    className="px-3 pb-1 text-[10px] text-zinc-500"
                >
                    {effortEstimate}
                </p>
            )}

            {/* COUNSEL.2.5: Progress bar */}
            {sessionProgress && sessionProgress.total > 0 && !allFixed && (
                <div
                    className="mx-3 mb-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.max(0, sessionProgress.fixed)}
                    aria-valuemin={0}
                    aria-valuemax={sessionProgress.total}
                    aria-label={`Fix progress: ${Math.max(0, sessionProgress.fixed)} of ${sessionProgress.total}`}
                    data-testid="session-progress-bar"
                >
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, (Math.max(0, sessionProgress.fixed) / sessionProgress.total) * 100)}%` }}
                    />
                </div>
            )}

            {/* COUNSEL.2.5: Celebration state */}
            {allFixed && (
                <div
                    data-testid="session-all-fixed"
                    className="flex items-center gap-2 px-3 pb-2"
                    role="status"
                    aria-live="polite"
                >
                    <Check size={12} className="shrink-0 text-emerald-400" aria-hidden="true" />
                    <span className="text-xs font-medium text-emerald-400">
                        All clear! Zero violations.
                    </span>
                </div>
            )}
        </div>
    )
}
