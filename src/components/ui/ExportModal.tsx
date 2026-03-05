/**
 * ExportModal — src/components/ui/ExportModal.tsx
 *
 * The Mithril Safety Export Gate UI (Phase B.2, Commandment 6).
 *
 * Triggered by the "Export" button in the top bar. Performs a live pre-flight
 * audit before showing the result:
 *
 *   BLOCKED — one or both of the following disqualifiers are active:
 *     1. `component_overrides` table has rows → unapplied property overrides.
 *     2. `canvasStore.mithrilViolations` has entries → ΔE > 2.0 drift detected.
 *
 *   PASS — all checks green. Shows the current file's raw source for copy/review.
 *
 * Clicking a blocked node ID snap-selects that node in the canvas so the
 * developer can immediately navigate to and fix the violation.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useCallback, useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck, X, Copy, Check, AlertTriangle } from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { useEditorStore } from '../../store/editorStore'
import type { OverrideRow } from '../../types/bridge-api'

// ── Props ──────────────────────────────────────────────────────────────────────

interface ExportModalProps {
    onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExportModal({ onClose }: ExportModalProps) {
    const mithrilViolations = useCanvasStore((s) => s.mithrilViolations)
    const a11yViolations = useCanvasStore((s) => s.a11yViolations)
    const setActiveSelection = useCanvasStore((s) => s.setActiveSelection)
    const setSelectedNode = useEditorStore((s) => s.setSelectedNode)
    const rawCode = useEditorStore((s) => s.rawCode)

    const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([])
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    // ── Fetch active overrides on mount ────────────────────────────────────────
    useEffect(() => {
        setLoading(true)
        const readOverrides = window.bridgeAPI.tokens.readOverrides
        if (readOverrides === undefined) {
            setLoading(false)
            return
        }
        readOverrides()
            .then((rows) => {
                setOverrideRows(rows)
            })
            .catch((err: Error) => {
                console.error('[ExportModal] readOverrides error:', err.message)
            })
            .finally(() => setLoading(false))
    }, [])

    const canExport =
        overrideRows.length === 0 &&
        mithrilViolations.length === 0 &&
        Object.keys(a11yViolations).length === 0

    // ── Snap-select a node when user clicks its ID in the violation list ───────
    const handleSelectNode = useCallback((bridgeId: string) => {
        setSelectedNode(bridgeId)
        setActiveSelection(bridgeId)
        onClose()
    }, [setSelectedNode, setActiveSelection, onClose])

    // ── Copy source to clipboard ───────────────────────────────────────────────
    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(rawCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [rawCode])

    // ── Close on Escape key ────────────────────────────────────────────────────
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent): void {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    return (
        // Backdrop
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            {/* Modal */}
            <div className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
                {/* Header */}
                <div className={`flex shrink-0 items-center gap-3 border-b px-5 py-4 ${loading
                    ? 'border-gray-700'
                    : canExport
                        ? 'border-emerald-700/40 bg-emerald-900/10'
                        : 'border-amber-700/40 bg-amber-900/10'
                    }`}>
                    {loading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-400" />
                    ) : canExport ? (
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    ) : (
                        <ShieldAlert className="h-5 w-5 text-amber-400" />
                    )}
                    <h2 className="flex-1 text-sm font-semibold text-gray-100">
                        {loading
                            ? 'Running pre-flight audit…'
                            : canExport
                                ? 'Export Gate — All Clear'
                                : 'Export Gate — Blocked'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close export modal"
                        className="rounded p-1 text-gray-500 transition-colors hover:text-gray-300"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {loading && (
                        <p className="text-xs text-gray-500">Querying SQLite component_overrides…</p>
                    )}

                    {!loading && canExport && (
                        <div className="space-y-4">
                            <p className="text-xs text-emerald-300">
                                No Mithril violations or property overrides detected.
                                This file is fully export-ready.
                            </p>
                            {/* Source preview */}
                            <div className="rounded border border-gray-700 bg-gray-950">
                                <div className="flex items-center justify-between border-b border-gray-700 px-3 py-1.5">
                                    <span className="font-mono text-[10px] text-gray-500">Source</span>
                                    <button
                                        type="button"
                                        onClick={() => { void handleCopy() }}
                                        className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
                                    >
                                        {copied ? (
                                            <><Check className="h-3 w-3 text-emerald-400" /> Copied!</>
                                        ) : (
                                            <><Copy className="h-3 w-3" /> Copy to clipboard</>
                                        )}
                                    </button>
                                </div>
                                <pre className="max-h-60 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed text-gray-300">
                                    {rawCode}
                                </pre>
                            </div>
                        </div>
                    )}

                    {!loading && !canExport && (
                        <div className="space-y-4">
                            <p className="text-xs text-amber-300">
                                The following issues must be resolved before exporting.
                                Click a node ID to navigate directly to it.
                            </p>

                            {/* Property overrides */}
                            {overrideRows.length > 0 && (
                                <div>
                                    <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                                        <AlertTriangle className="h-3 w-3" />
                                        Property Overrides ({overrideRows.length})
                                    </h3>
                                    <ul className="space-y-1.5">
                                        {overrideRows.map((row) => (
                                            <li
                                                key={`${row.bridge_id}::${row.property_key}`}
                                                className="rounded border border-gray-700 bg-gray-800/60 px-3 py-2"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectNode(row.bridge_id)}
                                                            className="truncate font-mono text-[10px] text-indigo-400 transition-colors hover:text-indigo-300 hover:underline"
                                                            title={`Navigate to ${row.bridge_id}`}
                                                        >
                                                            {row.bridge_id}
                                                        </button>
                                                        <p className="mt-0.5 font-mono text-[9px] text-gray-500">
                                                            <span className="text-gray-400">{row.property_key}</span>
                                                            {' → '}
                                                            <span className="text-amber-500/80">{row.property_value.slice(0, 60)}{row.property_value.length > 60 ? '…' : ''}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Accessibility violations — A11Y rules (Commandment 5) */}
                            {Object.keys(a11yViolations).length > 0 && (
                                <div>
                                    <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                                        <AlertTriangle className="h-3 w-3" />
                                        Accessibility Violations ({Object.keys(a11yViolations).length})
                                    </h3>
                                    <ul className="space-y-1.5">
                                        {Object.entries(a11yViolations).map(([bridgeId, messages]) =>
                                            messages.map((msg) => (
                                                <li
                                                    key={`${bridgeId}::${msg}`}
                                                    className="rounded border border-red-900/40 bg-red-900/10 px-3 py-2"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectNode(bridgeId)}
                                                        className="font-mono text-[10px] text-red-400 transition-colors hover:text-red-300 hover:underline"
                                                        title={`Navigate to ${bridgeId}`}
                                                    >
                                                        {bridgeId}
                                                    </button>
                                                    <p className="mt-0.5 text-[9px] text-gray-400">
                                                        {msg}
                                                    </p>
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                </div>
                            )}

                            {/* Mithril ΔE violations */}
                            {mithrilViolations.length > 0 && (
                                <div>
                                    <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                                        <ShieldAlert className="h-3 w-3" />
                                        Mithril ΔE Violations ({mithrilViolations.length})
                                    </h3>
                                    <ul className="space-y-1.5">
                                        {mithrilViolations.map((id) => (
                                            <li key={id} className="rounded border border-red-900/40 bg-red-900/10 px-3 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectNode(id)}
                                                    className="font-mono text-[10px] text-red-400 transition-colors hover:text-red-300 hover:underline"
                                                    title={`Navigate to ${id}`}
                                                >
                                                    {id}
                                                </button>
                                                <p className="mt-0.5 text-[9px] text-gray-500">
                                                    Color drift ΔE &gt; 2.0 — token not applied
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!loading && (
                    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-800 px-5 py-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
                        >
                            {canExport ? 'Close' : 'Dismiss'}
                        </button>
                        {canExport && (
                            <button
                                type="button"
                                onClick={() => { void handleCopy() }}
                                className="flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
                            >
                                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copied ? 'Copied!' : 'Copy Source'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
