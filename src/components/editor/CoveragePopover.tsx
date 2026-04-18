/**
 * CoveragePopover.tsx — src/components/editor/CoveragePopover.tsx
 *
 * Phase 0 — Coverage Honesty
 *
 * Breakdown popover rendered when the CoverageBadge is clicked.
 * Lists file counts by status and per-reason skipped-file counts.
 *
 * Two modes:
 *   'breakdown' (default) — full scan summary with per-reason rows
 *   'idle'                — pre-scan state explaining how to trigger a scan
 *
 * Commandment compliance:
 *   C5 (Accessibility is a Compiler Error) — Escape key dismisses (onClose).
 *   C2 (No Hallucinated Styling) — all classes use design token palette.
 *
 * Non-goal #2 mitigation: Footer copy states coverage is informational and
 * does NOT change the grade, addressing the risk of users conflating the two
 * signals.
 *
 * UX fix (Phase 0 review): idle state now shows an educational popover instead
 * of a no-op button. Plain-English reason labels replace engineer jargon.
 */

import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { CoverageSummary, CoverageReason } from '../../../shared/coverage-types'

// ── Human-readable label map ──────────────────────────────────────────────────
//
// Plain-English, intent-focused copy. Each label:
//   - Names what's in the code so the user knows which file to check
//   - Says "yet" or "today" to signal this is a coverage gap, not broken code
//   - Avoids "supports / doesn't support" framing — says what Flint can't do
//
// Append-only — do not rename keys; they mirror the wire-stable CoverageReason enum.

export const REASON_LABELS: Record<CoverageReason, string> = {
    'css-in-js-detected': "Uses CSS-in-JS (styled-components, emotion) — Flint can't see these styles yet",
    'external-stylesheet-imported': "Imports an external stylesheet — Flint doesn't read .css/.scss files yet",
    'css-modules-reference': "Uses CSS Modules — Flint doesn't resolve module class maps yet",
    'dynamic-class-expression': "A className merge has a branch Flint can't resolve yet (imported helper, function result, or variable in a ternary)",
    'unresolvable-var': "References a CSS variable Flint can't resolve",
    'tailwind-config-extension': "Flint couldn't load your Tailwind config (syntax error, Tailwind v4 CSS-first, or unsupported Node API)",
    'non-jsx-framework': "Vue, Svelte, or Angular component — Flint only understands React today",
    'non-literal-ternary-branch': "Uses a className ternary with a variable branch — Flint can't resolve it",
    'parse-failure': "Couldn't parse this file (syntax error or unsupported syntax)",
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CoveragePopoverBaseProps {
    /** Dismiss callback — closes popover on click-away or Escape. */
    onClose: () => void
}

interface CoveragePopoverBreakdownProps extends CoveragePopoverBaseProps {
    mode?: 'breakdown'
    /** Snapshot to render breakdowns from. Required in breakdown mode. */
    summary: CoverageSummary
}

interface CoveragePopoverIdleProps extends CoveragePopoverBaseProps {
    mode: 'idle'
    summary?: never
}

export type CoveragePopoverProps = CoveragePopoverBreakdownProps | CoveragePopoverIdleProps

// ── Component ─────────────────────────────────────────────────────────────────

export function CoveragePopover({ summary, onClose, mode = 'breakdown' }: CoveragePopoverProps) {
    // ── Keyboard: Escape dismisses ────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose])

    // ── Idle mode: educational pre-scan state ─────────────────────────────────
    if (mode === 'idle') {
        return (
            <div
                className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
                role="dialog"
                aria-label="Coverage not yet available"
                data-testid="coverage-popover"
                data-coverage-popover-mode="idle"
            >
                <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                    <h3 className="text-xs font-semibold text-zinc-100">No scan yet</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-0.5 text-zinc-400 transition-colors hover:text-zinc-200"
                        aria-label="Close coverage info"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
                <div className="px-3 py-3">
                    <p className="text-xs text-zinc-400 leading-relaxed" data-testid="coverage-idle-message">
                        Run <span className="font-mono text-indigo-400">flint_debt_report</span> or trigger a scan to see how much of your codebase Flint can govern.
                    </p>
                </div>
            </div>
        )
    }

    // ── Breakdown mode ────────────────────────────────────────────────────────
    const {
        totalFiles,
        parsedFiles,
        partialFiles,
        skippedFiles,
        governedSurfacePercent,
        skippedFilesByReason,
    } = summary

    const nonZeroReasons = (Object.entries(skippedFilesByReason) as [CoverageReason, number][])
        .filter(([, count]) => count > 0)

    const hasSkipped = partialFiles > 0 || skippedFiles > 0

    return (
        <div
            className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
            role="dialog"
            aria-label="Coverage Summary"
            data-testid="coverage-popover"
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                <h3 className="text-xs font-semibold text-zinc-100">Coverage Summary</h3>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-0.5 text-zinc-400 transition-colors hover:text-zinc-200"
                    aria-label="Close coverage summary"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>

            {/* Body */}
            <div className="px-3 py-2 space-y-1.5">
                {/* Overview counts */}
                <dl className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                        <dt className="text-zinc-400">Total files</dt>
                        <dd className="font-medium text-zinc-200" data-testid="coverage-total-files">{totalFiles}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                        <dt className="text-zinc-400">Fully governed</dt>
                        <dd className="font-medium text-emerald-400" data-testid="coverage-parsed-files">
                            {parsedFiles} {parsedFiles === 1 ? 'file' : 'files'}
                        </dd>
                    </div>
                    <div className="flex items-center justify-between">
                        <dt className="text-zinc-400">Partially governed</dt>
                        <dd className="font-medium text-zinc-300" data-testid="coverage-partial-files">
                            {partialFiles} {partialFiles === 1 ? 'file' : 'files'}
                        </dd>
                    </div>
                    <div className="flex items-center justify-between">
                        <dt className="text-zinc-400">Skipped</dt>
                        <dd className="font-medium text-zinc-300" data-testid="coverage-skipped-files">
                            {skippedFiles} {skippedFiles === 1 ? 'file' : 'files'}
                        </dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-zinc-800 pt-1.5">
                        <dt className="text-zinc-400">Governed surface</dt>
                        <dd
                            className={`font-semibold ${governedSurfacePercent === 100 ? 'text-emerald-400' : 'text-indigo-400'}`}
                            data-testid="coverage-percent"
                        >
                            {governedSurfacePercent}%
                        </dd>
                    </div>
                </dl>

                {/* Separator */}
                <div className="border-t border-zinc-800" />

                {/* Per-reason breakdown */}
                {hasSkipped ? (
                    <div>
                        <p className="mb-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                            Skip reasons
                        </p>
                        <ul className="space-y-1" data-testid="coverage-reasons-list">
                            {nonZeroReasons.map(([reason, count]) => (
                                <li
                                    key={reason}
                                    className="flex items-start justify-between gap-2 text-xs"
                                >
                                    <span className="text-zinc-400 leading-relaxed">
                                        {REASON_LABELS[reason]}
                                    </span>
                                    <span className="flex-shrink-0 font-medium text-zinc-300">
                                        {count}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p
                        className="text-xs text-emerald-400"
                        data-testid="coverage-empty-state"
                    >
                        All files fully governed.
                    </p>
                )}
            </div>

            {/* Footer — non-goal #2 mitigation (risk table) */}
            <div className="border-t border-zinc-800 px-3 py-2">
                <p className="text-[11px] italic text-zinc-500 leading-relaxed">
                    Coverage is informational — it does not change your grade.
                </p>
            </div>
        </div>
    )
}
