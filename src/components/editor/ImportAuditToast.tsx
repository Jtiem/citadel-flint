/**
 * ImportAuditToast — src/components/editor/ImportAuditToast.tsx
 *
 * Phase O.2 / Phase 7: Post-import notification toast.
 *
 * Shown after a Figma → Bridge hydro-paste import completes.
 * Displays a grouped count of non-aligned style values by property category
 * (colors, spacing, typography) and links to the Export Gate for review.
 *
 * Design rules:
 *  - Amber border/icon — these are warnings, not blockers (Mithril amber tier)
 *  - Auto-dismisses after 8 s; user can dismiss early with ×
 *  - Stays mounted until dismissed or a new project is opened
 *  - Zero values → not rendered (nothing to report)
 */

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import type { ImportWarning } from '../../types/bridge-api'

// ── Grouping helpers ──────────────────────────────────────────────────────────

const COLOR_PROPS = new Set(['fillColor', 'textColor', 'strokeColor'])
const SPACING_PROPS = new Set(['itemSpacing', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'width', 'height'])
const TYPOGRAPHY_PROPS = new Set(['fontSize', 'letterSpacing', 'lineHeight'])

function groupWarnings(warnings: ImportWarning[]): { colors: number; spacing: number; typography: number; other: number } {
    let colors = 0, spacing = 0, typography = 0, other = 0
    for (const w of warnings) {
        if (COLOR_PROPS.has(w.property)) colors++
        else if (SPACING_PROPS.has(w.property)) spacing++
        else if (TYPOGRAPHY_PROPS.has(w.property)) typography++
        else other++
    }
    return { colors, spacing, typography, other }
}

function buildSummary(groups: ReturnType<typeof groupWarnings>): string[] {
    const parts: string[] = []
    if (groups.colors > 0) parts.push(`${groups.colors} color${groups.colors > 1 ? 's' : ''}`)
    if (groups.spacing > 0) parts.push(`${groups.spacing} spacing value${groups.spacing > 1 ? 's' : ''}`)
    if (groups.typography > 0) parts.push(`${groups.typography} typography value${groups.typography > 1 ? 's' : ''}`)
    if (groups.other > 0) parts.push(`${groups.other} other`)
    return parts
}

// ── Component ─────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 8000

export default function ImportAuditToast() {
    const warnings = useCanvasStore((s) => s.lastImportWarnings)
    const clearImportWarnings = useCanvasStore((s) => s.clearImportWarnings)
    const [dismissed, setDismissed] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Reset dismissed state whenever new warnings arrive
    useEffect(() => {
        if (warnings && warnings.length > 0) {
            setDismissed(false)
            timerRef.current = setTimeout(() => {
                setDismissed(true)
            }, AUTO_DISMISS_MS)
        }
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }
    }, [warnings])

    if (!warnings || warnings.length === 0 || dismissed) return null

    const groups = groupWarnings(warnings)
    const summaryParts = buildSummary(groups)
    if (summaryParts.length === 0) return null

    const handleDismiss = () => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
        setDismissed(true)
        clearImportWarnings()
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
