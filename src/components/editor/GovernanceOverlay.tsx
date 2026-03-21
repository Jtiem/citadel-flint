/**
 * GovernanceOverlay — src/components/editor/GovernanceOverlay.tsx
 *
 * Phase 5A: Deterministic Auto-Fix panel.
 *
 * Renders the active Mithril linter warnings as a scrollable list anchored
 * below the LivePreview mode toggle. For each violation that has a known
 * `nearestToken`, an "Auto-Fix" button is shown. Clicking it dispatches a
 * deterministic `applyTokenFix` mutation directly to `editorStore.applyBatch`
 * — bypassing the AI orchestrator entirely.
 *
 * Rules enforced here:
 *   - The panel only mounts when there are active warnings.
 *   - Auto-Fix is only offered when `warning.nearestToken` is non-null.
 *   - The hardcoded class being replaced is extracted from `warning.message`
 *     (the quoted token between single-quotes in the linter message string).
 *   - All colors and spacing use the Flint design token palette.
 *   - No hardcoded hex values. No arbitrary spacing values.
 *
 * Mithril Safety: all classes from Flint design token palette.
 */

import { useState } from 'react'
import { AlertTriangle, ArrowRight, ShieldCheck, Wrench } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { LinterWarning } from '../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts the hardcoded class string from a linter warning message.
 *
 * The linter formats messages like:
 *   "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set"
 *   "MITHRIL-TYP-002: arbitrary 'text-[14px]' not in typography token set"
 *
 * This extracts the first single-quoted token, which is the offending value.
 * Returns null when the message does not contain a recognisable quoted token.
 */
function extractHardcodedClass(message: string): string | null {
    const match = /'([^']+)'/.exec(message)
    return match ? match[1] : null
}

/**
 * Returns a human-readable label for the violation type.
 */
function violationTypeLabel(type: LinterWarning['type']): string {
    switch (type) {
        case 'color-drift':      return 'Color Drift'
        case 'typography-drift': return 'Typography Drift'
        case 'spacing-drift':    return 'Spacing Drift'
        case 'shadow-drift':     return 'Shadow Drift'
        case 'opacity-drift':    return 'Opacity Drift'
        case 'a11y':             return 'Accessibility'
        case 'semantic-drift':   return 'Semantic Drift'
        default:                 return 'Violation'
    }
}

// ── GovernanceOverlay ─────────────────────────────────────────────────────────

export function GovernanceOverlay() {
    // Selector pattern — never destructure the whole store
    const linterWarnings = useEditorStore((s) => s.linterWarnings)

    /**
     * OPP-08: Diff preview state.
     * Holds the composite key `${nodeId}-${warning.id}` of the violation row
     * whose Auto-Fix button is currently hovered or focused. When set, an
     * inline before→after diff card is rendered below that button.
     */
    const [previewFixId, setPreviewFixId] = useState<string | null>(null)

    if (linterWarnings.size === 0) {
        return (
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-400">No Mithril violations</span>
            </div>
        )
    }

    // Convert the Map to an array for rendering
    const entries = Array.from(linterWarnings.entries())

    const handleAutoFix = (nodeId: string, warning: LinterWarning) => {
        if (!warning.nearestToken) return

        const hardcodedClass = extractHardcodedClass(warning.message)
        if (!hardcodedClass) {
            // Message did not contain a parseable class — cannot fix deterministically
            console.warn(
                '[GovernanceOverlay] Auto-Fix: could not extract hardcoded class from message:',
                warning.message
            )
            return
        }

        // Deterministic token replacement — no AI orchestrator involved
        useEditorStore.getState().applyBatch([
            {
                op: 'applyTokenFix',
                nodeId,
                hardcodedClass,
                tokenClass: warning.nearestToken,
            },
        ])
    }

    return (
        <div className="flex flex-col">
            {/* Section header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 shrink-0">
                <div className="flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Governance
                    </h3>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {entries.length}
                </span>
            </div>

            {/* Violation list */}
            <div className="flex flex-col divide-y divide-zinc-800/60 overflow-y-auto max-h-64">
                {entries.map(([nodeId, warning]) => {
                    const canAutoFix   = warning.nearestToken !== null
                    const isCritical   = warning.severity === 'critical'
                    const hardcodedCls = extractHardcodedClass(warning.message)

                    return (
                        <div
                            key={`${nodeId}-${warning.id}`}
                            className={`px-3 py-2 flex flex-col gap-1 ${
                                isCritical ? 'bg-red-900/10' : 'bg-amber-900/10'
                            }`}
                        >
                            {/* Violation type + severity badge */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <AlertTriangle
                                        size={10}
                                        className={`shrink-0 ${
                                            isCritical ? 'text-red-400' : 'text-amber-400'
                                        }`}
                                    />
                                    <span
                                        className={`text-xs font-medium truncate ${
                                            isCritical ? 'text-red-400' : 'text-amber-400'
                                        }`}
                                    >
                                        {violationTypeLabel(warning.type)}
                                    </span>
                                </div>

                                <span
                                    className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                                        isCritical
                                            ? 'bg-red-900/20 text-red-400 border border-red-700/40'
                                            : 'bg-amber-900/20 text-amber-400 border border-amber-500/30'
                                    }`}
                                >
                                    {isCritical ? 'critical' : 'amber'}
                                </span>
                            </div>

                            {/* Node ID */}
                            <p className="font-mono text-[10px] text-zinc-500 truncate">
                                #{nodeId}
                            </p>

                            {/* Violation message */}
                            <p className="text-xs text-zinc-400 leading-snug line-clamp-2">
                                {warning.message}
                            </p>

                            {/* Inline token suggestion — only when a nearest token is known */}
                            {warning.nearestToken && (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <ArrowRight size={10} className="text-emerald-400 shrink-0" />
                                    <p className="text-[10px] text-emerald-400">
                                        Use{' '}
                                        <code className="font-mono">{warning.nearestToken}</code>
                                        {warning.nearestTokenValue
                                            ? ` (${warning.nearestTokenValue})`
                                            : ''}{' '}
                                        instead
                                    </p>
                                </div>
                            )}

                            {/* Token swap preview + Auto-Fix — only when fix is known */}
                            {canAutoFix && warning.nearestToken && (() => {
                                const fixKey = `${nodeId}-${warning.id}`
                                const isPreviewOpen = previewFixId === fixKey
                                return (
                                    <div className="flex flex-col gap-1 mt-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            {/* Compact swatch comparison */}
                                            <div className="flex items-center gap-1 min-w-0">
                                                {hardcodedCls && (
                                                    <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[72px]">
                                                        {hardcodedCls}
                                                    </span>
                                                )}
                                                {hardcodedCls && (
                                                    <span className="text-[10px] text-zinc-600">→</span>
                                                )}
                                                <span className="text-[10px] font-mono text-indigo-400 truncate max-w-[96px]">
                                                    {warning.nearestToken}
                                                </span>
                                            </div>

                                            {/* Auto-Fix button — deterministic, no orchestrator */}
                                            <button
                                                type="button"
                                                onClick={() => handleAutoFix(nodeId, warning)}
                                                onMouseEnter={() => setPreviewFixId(fixKey)}
                                                onMouseLeave={() => setPreviewFixId(null)}
                                                onFocus={() => setPreviewFixId(fixKey)}
                                                onBlur={() => setPreviewFixId(null)}
                                                className="flex shrink-0 items-center gap-1 rounded border border-indigo-500/30 bg-indigo-600/10 px-1.5 py-0.5 text-[10px] text-indigo-400 transition-colors hover:bg-indigo-600/20 hover:text-indigo-300"
                                                title={`Replace with ${warning.nearestToken}`}
                                            >
                                                <Wrench size={9} />
                                                Auto-Fix
                                            </button>
                                        </div>

                                        {/* OPP-08: Inline diff preview — shown on hover/focus */}
                                        {isPreviewOpen && hardcodedCls && (
                                            <div
                                                className="flex items-center gap-1.5 rounded border border-zinc-700/50 bg-zinc-900 px-2 py-1"
                                                aria-label="Auto-Fix preview"
                                            >
                                                {/* Before: hardcoded class (red strikethrough) */}
                                                <span className="font-mono text-[10px] text-red-400 line-through truncate max-w-[88px]">
                                                    {hardcodedCls}
                                                </span>
                                                <ArrowRight size={9} className="shrink-0 text-zinc-500" />
                                                {/* After: token class (green) */}
                                                <span className="font-mono text-[10px] text-emerald-400 truncate max-w-[96px]">
                                                    {warning.nearestToken}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
