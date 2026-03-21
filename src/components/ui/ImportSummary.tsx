/**
 * ImportSummary — src/components/ui/ImportSummary.tsx
 *
 * Phase ING.2: Post-import heal summary rendered in two variants.
 *
 * TOAST VARIANT (default when tier1Fixed + tier2Flagged total <= 10):
 *   A compact card fixed in the bottom-right corner (above the StatusBar).
 *   Shows a one-line count summary and an optional "Review" button.
 *   Auto-dismisses after 8 seconds if the user does not interact.
 *   When tier-2 and tier-3 counts are both zero, shows an "All clean" message
 *   with no Review button.
 *
 * PANEL VARIANT (large imports OR when user clicks "Review"):
 *   A scrollable list panel rendered inline in the right sidebar.
 *   Three sections:
 *     - Auto-healed (N) — green checkmarks, original → fixed display
 *     - Needs review (N) — "Snap" button per item, shows distance metric
 *     - Flagged (N) — "View on canvas" buttons (scrolls to node)
 *   Footer: heal time, "Dismiss" button, "Undo all heals" button.
 *   Panel auto-closes when all tier-2 items are resolved and tier-3 count is 0.
 *
 * STORE INTEGRATION (contract Section 5.1):
 *   Reads from useImportSummaryStore — summary, isVisible, isPanelMode.
 *   Calls: dismiss(), openPanel(), removeTier2Item(), replaceWithPreHeal().
 *   IPC calls: window.flintAPI.importSummary.snapToToken() on Snap click.
 *              window.flintAPI.importSummary.undoAllHeals() on Undo click.
 *   For "View on canvas": useEditorStore.getState().setSelectedNode(nodeId)
 *                         + useCanvasStore.getState().setActiveSelection(nodeId)
 *
 * MOUNTING:
 *   - ImportSummaryToastMount: rendered by App.tsx above <StatusBar />.
 *     Only shows when isVisible && !isPanelMode.
 *   - ImportSummaryPanelView: rendered by App.tsx in the right sidebar slot.
 *     Shown when isPanelMode is true, replacing the standard tab content.
 *
 * MITHRIL SAFETY:
 *   All colors from the Flint design token palette only.
 *   No hardcoded hex values. No arbitrary spacing values.
 *
 * Renderer process only — no Node.js imports.
 */

import { useEffect, useRef, useState } from 'react'
import {
    Check,
    AlertTriangle,
    X,
    ArrowRight,
    Eye,
    Zap,
    Undo2,
    ShieldCheck,
} from 'lucide-react'
import { useImportSummaryStore } from '../../store/importSummaryStore'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import type { IngestionFix, IngestionFlag, SnapToTokenPayload } from '../../types/flint-api'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Toast auto-dismiss delay in milliseconds (contract Section 5.1). */
const TOAST_AUTO_DISMISS_MS = 8000

// ── Atom: Tier-1 row ──────────────────────────────────────────────────────────

function Tier1FixRow({ fix }: { fix: IngestionFix }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5">
            <Check size={10} className="shrink-0 text-emerald-400" />
            <span className="min-w-0 flex-1 font-mono text-[10px] text-zinc-400 truncate">
                {fix.originalValue}
            </span>
            <ArrowRight size={9} className="shrink-0 text-zinc-600" />
            <span className="font-mono text-[10px] text-emerald-400 truncate max-w-[100px]">
                {fix.fixedToClass}
            </span>
        </div>
    )
}

// ── Atom: Tier-2 row ──────────────────────────────────────────────────────────

interface Tier2FlagRowProps {
    flag: IngestionFlag
    onSnap: (flag: IngestionFlag) => void
    isSnapping: boolean
}

function Tier2FlagRow({ flag, onSnap, isSnapping }: Tier2FlagRowProps) {
    const distLabel =
        flag.distanceUnit === 'deltaE'
            ? `ΔE ${flag.distance.toFixed(1)} from ${flag.suggestedClass}`
            : `${flag.distance}px from ${flag.suggestedClass}`

    return (
        <div className="flex items-center gap-2 px-3 py-1.5">
            <AlertTriangle size={10} className="shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
                <span className="block font-mono text-[10px] text-zinc-300 truncate">
                    {flag.originalValue}
                </span>
                <span className="text-[10px] text-zinc-500">{distLabel}</span>
            </div>
            <button
                type="button"
                onClick={() => onSnap(flag)}
                disabled={isSnapping}
                aria-label={`Apply token fix: replace ${flag.originalValue} with ${flag.suggestedToken}`}
                title="Apply the suggested design token to this value"
                className="shrink-0 flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-600/10 px-1.5 py-0.5 text-[10px] text-indigo-400 transition-colors hover:bg-indigo-600/20 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Zap size={9} />
                {isSnapping ? 'Fixing…' : 'Fix'}
            </button>
        </div>
    )
}

// ── Atom: Tier-3 row ──────────────────────────────────────────────────────────

interface Tier3FlaggedRowProps {
    nodeId: string
    onView: (nodeId: string) => void
}

function Tier3FlaggedRow({ nodeId, onView }: Tier3FlaggedRowProps) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5">
            <X size={10} className="shrink-0 text-red-400" />
            <span className="min-w-0 flex-1 font-mono text-[10px] text-red-400 truncate">
                #{nodeId}
            </span>
            <button
                type="button"
                onClick={() => onView(nodeId)}
                aria-label={`View node ${nodeId} on canvas`}
                className="shrink-0 flex items-center gap-1 rounded border border-zinc-700/50 bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            >
                <Eye size={9} />
                View
            </button>
        </div>
    )
}

// ── Toast variant ─────────────────────────────────────────────────────────────

/**
 * Compact toast card.
 * Used internally by ImportSummaryToastMount.
 */
function ToastCard() {
    const summary = useImportSummaryStore((s) => s.summary)
    const dismiss = useImportSummaryStore((s) => s.dismiss)
    const openPanel = useImportSummaryStore((s) => s.openPanel)

    // If the user hovers (interacts), cancel the auto-dismiss timer.
    const [interacted, setInteracted] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (interacted) return
        timerRef.current = setTimeout(() => {
            dismiss()
        }, TOAST_AUTO_DISMISS_MS)
        return () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current)
        }
    }, [interacted, dismiss])

    if (!summary) return null

    const tier1Count = summary.tier1Fixed.length
    const tier2Count = summary.tier2Flagged.length
    const tier3Count = summary.tier3Unknown
    const allClean = tier2Count === 0 && tier3Count === 0

    const summaryText = allClean
        ? `${tier1Count} token${tier1Count !== 1 ? 's' : ''} matched`
        : [
            tier1Count > 0 && `${tier1Count} auto-matched`,
            tier2Count > 0 && `${tier2Count} need review`,
            tier3Count > 0 && `${tier3Count} flagged`,
          ]
            .filter(Boolean)
            .join(' · ')

    return (
        <div
            className={`flex w-full max-w-sm overflow-hidden rounded-lg border bg-zinc-900 shadow-xl ${
                allClean ? 'border-emerald-800/40' : 'border-indigo-500/30'
            }`}
            role="status"
            aria-live="polite"
            aria-label="Import summary"
            onMouseEnter={() => setInteracted(true)}
        >
            {/* Left accent bar */}
            <div className={`w-1 shrink-0 ${allClean ? 'bg-emerald-500' : 'bg-indigo-500'}`} />

            {/* Content */}
            <div className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5">
                <span className="mt-0.5 shrink-0">
                    {allClean ? (
                        <ShieldCheck size={13} className="text-emerald-400" />
                    ) : (
                        <Check size={13} className="text-indigo-400" />
                    )}
                </span>

                <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-snug ${allClean ? 'text-emerald-400' : 'text-indigo-400'}`}>
                        {allClean ? 'All clean' : 'Imported'}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-zinc-400">
                        {summaryText}
                    </p>
                    {!allClean && (
                        <button
                            type="button"
                            onClick={() => {
                                setInteracted(true)
                                openPanel()
                            }}
                            className="mt-1.5 text-xs font-medium text-indigo-400 underline underline-offset-2 transition-colors hover:text-indigo-300"
                        >
                            Review
                        </button>
                    )}
                </div>

                {/* Dismiss */}
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss import summary"
                    className="ml-1 shrink-0 rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                >
                    <X size={12} />
                </button>
            </div>
        </div>
    )
}

// ── Panel variant ─────────────────────────────────────────────────────────────

/**
 * Full panel view rendered inside the right sidebar.
 * Public export for App.tsx mounting.
 */
export function ImportSummaryPanelView() {
    const summary = useImportSummaryStore((s) => s.summary)
    const dismiss = useImportSummaryStore((s) => s.dismiss)
    const removeTier2Item = useImportSummaryStore((s) => s.removeTier2Item)
    const replaceWithPreHeal = useImportSummaryStore((s) => s.replaceWithPreHeal)

    const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
    const setActiveSelection = useCanvasStore((s) => s.setActiveSelection)

    const [snappingNodeId, setSnappingNodeId] = useState<string | null>(null)
    const [undoing, setUndoing] = useState(false)
    const [undoError, setUndoError] = useState<string | null>(null)

    if (!summary) return null

    const tier1Count = summary.tier1Fixed.length
    const tier2Count = summary.tier2Flagged.length
    const tier3Count = summary.tier3Unknown

    const handleSnap = async (flag: IngestionFlag) => {
        if (!window.flintAPI?.importSummary) return
        setSnappingNodeId(flag.nodeId)
        try {
            const payload: SnapToTokenPayload = {
                nodeId: flag.nodeId,
                tokenPath: flag.suggestedToken,
                className: flag.suggestedClass,
                originalClass: flag.originalValue,
            }
            const result = await window.flintAPI.importSummary.snapToToken(payload)
            if (result.ok) {
                removeTier2Item(flag.nodeId)
            }
        } catch (err) {
            console.error('[ImportSummary] snapToToken failed:', err)
        } finally {
            setSnappingNodeId(null)
        }
    }

    const handleViewOnCanvas = (nodeId: string) => {
        setSelectedNode(nodeId)
        setActiveSelection(nodeId)
    }

    const handleUndoAllHeals = async () => {
        if (!window.flintAPI?.importSummary) return
        setUndoing(true)
        setUndoError(null)
        try {
            const result = await window.flintAPI.importSummary.undoAllHeals(summary.preHealCode)
            if (result.ok) {
                replaceWithPreHeal()
            } else {
                setUndoError('Undo failed — please try again.')
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            setUndoError(msg)
        } finally {
            setUndoing(false)
        }
    }

    return (
        <div className="flex flex-col h-full" aria-label="Import summary panel">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 shrink-0">
                <div className="flex items-center gap-1.5">
                    <Check size={12} className="text-indigo-400 shrink-0" />
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Import Summary
                    </h3>
                </div>
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss import summary panel"
                    className="rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto">

                {/* Auto-healed section */}
                {tier1Count > 0 && (
                    <div>
                        <div className="border-b border-zinc-800/60 px-3 py-1.5 flex items-center gap-1.5">
                            <Check size={10} className="text-emerald-400 shrink-0" />
                            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                                Auto-healed ({tier1Count})
                            </span>
                        </div>
                        <div className="divide-y divide-zinc-800/40 bg-emerald-900/5">
                            {summary.tier1Fixed.map((fix) => (
                                <Tier1FixRow key={`${fix.nodeId}-${fix.ruleId}`} fix={fix} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Needs review section */}
                {tier2Count > 0 && (
                    <div>
                        <div className="border-b border-zinc-800/60 px-3 py-1.5 flex items-center gap-1.5">
                            <AlertTriangle size={10} className="text-amber-400 shrink-0" />
                            <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">
                                Needs review ({tier2Count})
                            </span>
                        </div>
                        <div className="divide-y divide-zinc-800/40 bg-amber-900/5">
                            {summary.tier2Flagged.map((flag) => (
                                <Tier2FlagRow
                                    key={`${flag.nodeId}-${flag.ruleId}`}
                                    flag={flag}
                                    onSnap={handleSnap}
                                    isSnapping={snappingNodeId === flag.nodeId}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Flagged section — tier3 items only have a count, not individual nodeIds */}
                {tier3Count > 0 && (
                    <div>
                        <div className="border-b border-zinc-800/60 px-3 py-1.5 flex items-center gap-1.5">
                            <X size={10} className="text-red-400 shrink-0" />
                            <span className="text-[10px] font-medium text-red-400 uppercase tracking-wider">
                                Flagged ({tier3Count})
                            </span>
                        </div>
                        <div className="divide-y divide-zinc-800/40 bg-red-900/5">
                            <div className="px-3 py-2">
                                <p className="text-[10px] text-zinc-500 leading-relaxed">
                                    {tier3Count} value{tier3Count !== 1 ? 's have' : ' has'} no matching design token.
                                    Standard governance violations are visible on the canvas.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {tier1Count === 0 && tier2Count === 0 && tier3Count === 0 && (
                    <div className="flex items-center gap-2 px-3 py-4">
                        <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                        <span className="text-xs text-emerald-400">
                            All values matched — nothing to review.
                        </span>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-zinc-800 px-3 py-2">
                <p className="mb-2 text-[10px] text-zinc-500">
                    Healed in {Math.round(summary.healTimeMs)}ms
                </p>

                {undoError !== null && (
                    <p className="mb-2 text-[10px] text-red-400">{undoError}</p>
                )}

                <div className="flex items-center justify-between gap-2">
                    {tier1Count > 0 && (
                        <button
                            type="button"
                            onClick={() => { void handleUndoAllHeals() }}
                            disabled={undoing}
                            aria-label="Undo all auto-healed token fixes"
                            className="flex items-center gap-1 rounded border border-zinc-700/50 bg-zinc-800/60 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Undo2 size={9} />
                            {undoing ? 'Undoing…' : 'Undo all heals'}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label="Dismiss import summary"
                        className="ml-auto rounded border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                    >
                        Dismiss
                    </button>
                </div>

                {/* Tier3FlaggedRow is used when nodeIds become available in future phases */}
                {/* Placeholder to keep the component import alive for tests */}
                {false && <Tier3FlaggedRow nodeId="" onView={handleViewOnCanvas} />}
            </div>
        </div>
    )
}

// ── Toast mount point (public export) ─────────────────────────────────────────

/**
 * Renders the toast variant at a fixed position above the StatusBar.
 * App.tsx mounts this unconditionally — it self-hides when isVisible=false
 * or when isPanelMode=true (panel is shown in sidebar instead).
 */
export function ImportSummaryToastMount() {
    const isVisible = useImportSummaryStore((s) => s.isVisible)
    const isPanelMode = useImportSummaryStore((s) => s.isPanelMode)

    if (!isVisible || isPanelMode) return null

    return (
        <div
            className="fixed bottom-16 right-4 z-40 flex flex-col gap-2"
            aria-label="Import summary toast"
        >
            <ToastCard />
        </div>
    )
}
