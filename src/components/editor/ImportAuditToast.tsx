/**
 * ImportAuditToast — src/components/editor/ImportAuditToast.tsx
 *
 * Phase O.2 / Phase ING: Post-import notification toast.
 *
 * Shown after a Figma → Flint hydro-paste import completes.
 * Displays a grouped count of non-aligned style values by property category
 * (colors, spacing, typography) and links to the Export Gate for review.
 *
 * Design rules:
 *  - Amber border/icon — these are warnings, not blockers (Mithril amber tier)
 *  - Auto-dismisses after 8 s; user can dismiss early with ×
 *  - Stays mounted until dismissed or a new project is opened
 *  - Zero values → not rendered (nothing to report)
 *
 * Store wiring: reads from importSummaryStore (tier2Flagged + tier3Unknown
 * are the unresolved non-aligned values). Calls dismiss() to clear.
 */

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useImportSummaryStore } from '../../store/importSummaryStore'

// ── Component ─────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 8000

export default function ImportAuditToast() {
    const summary = useImportSummaryStore((s) => s.summary)
    const isVisible = useImportSummaryStore((s) => s.isVisible)
    const dismiss = useImportSummaryStore((s) => s.dismiss)
    const [dismissed, setDismissed] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Reset dismissed state whenever a new summary arrives
    useEffect(() => {
        if (summary && isVisible) {
            setDismissed(false)
            timerRef.current = setTimeout(() => {
                setDismissed(true)
                dismiss()
            }, AUTO_DISMISS_MS)
        }
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }
    }, [summary, isVisible, dismiss])

    if (!summary || !isVisible || dismissed) return null

    // Map importSummaryStore fields to the warning categories this toast displays.
    // tier2Flagged items are non-aligned values that need review (amber-tier).
    // tier3Unknown items are values with no matching token at all.
    const needsReviewCount = summary.tier2Flagged.length
    const unknownCount = summary.tier3Unknown
    const totalWarnings = needsReviewCount + unknownCount

    if (totalWarnings === 0) return null

    const summaryParts: string[] = []
    if (needsReviewCount > 0)
        summaryParts.push(`${needsReviewCount} value${needsReviewCount > 1 ? 's' : ''} need review`)
    if (unknownCount > 0)
        summaryParts.push(`${unknownCount} value${unknownCount > 1 ? 's' : ''} unmatched`)

    const handleDismiss = () => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        setDismissed(true)
        dismiss()
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className="absolute bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-amber-600/40 bg-zinc-900/95 p-3 shadow-lg backdrop-blur-sm"
        >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-amber-300">Import complete — non-aligned values</p>
                <p className="mt-0.5 text-zinc-400">
                    {summaryParts.join(', ')} not aligned to design tokens.
                    {' '}These render as arbitrary Tailwind classes and will appear as amber warnings in the Export Gate.
                </p>
            </div>
            <button
                onClick={handleDismiss}
                aria-label="Dismiss import warning"
                className="ml-1 shrink-0 rounded p-0.5 text-zinc-500 transition-colors hover:text-zinc-300"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}
