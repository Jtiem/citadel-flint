/**
 * FixAllCta.tsx — C8 — extracted from GovernanceDashboard (Sprint 2 refactor)
 *
 * Primary "Fix all auto-fixable" CTA button. Shown when there are
 * auto-fixable violations. Pure presentational.
 *
 * Source lines: GovernanceDashboard.tsx ~2057-2070
 */

import { Wand2 } from 'lucide-react'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FixAllCtaProps {
    /** Number of auto-fixable issues. When 0, the component renders nothing. */
    autoFixableCount: number
    /** Whether to show this section (tokenCount > 0). */
    visible: boolean
    onFixAll: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FixAllCta({ autoFixableCount, visible, onFixAll }: FixAllCtaProps) {
    if (!visible || autoFixableCount === 0) return null

    return (
        <div className="px-3 py-2 border-b border-zinc-800/60">
            <button
                type="button"
                onClick={onFixAll}
                data-testid="fix-all-autofixable-cta"
                className="flex w-full items-center justify-center gap-2 rounded border border-indigo-500/50 bg-indigo-900/20 px-3 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-900/40 hover:text-indigo-200 hover:border-indigo-400/60"
            >
                <Wand2 size={12} aria-hidden="true" />
                Fix {autoFixableCount} auto-fixable {autoFixableCount === 1 ? 'issue' : 'issues'}
            </button>
        </div>
    )
}
