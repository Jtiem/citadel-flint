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
 * Severity escalation (Phase B.1-d):
 *   - amber   — ΔE 2.0–10.0: amber badge, amber section header
 *   - critical — ΔE > 10.0:  red badge, red section header, red modal header
 *
 * Renderer Process only — no Node.js imports.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldAlert, ShieldCheck, X, Copy, Check, AlertTriangle, FileDown, Download, Wrench } from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { useEditorStore } from '../../store/editorStore'
import type { LinterWarning, OverrideRow, ComplianceSummary } from '../../types/flint-api'

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
    const linterWarnings = useEditorStore((s) => s.linterWarnings)

    const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([])
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)
    const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null)
    const [reportCopied, setReportCopied] = useState(false)
    const [dbomDownloading, setDbomDownloading] = useState(false)
    const [dbomError, setDbomError] = useState<string | null>(null)

    // OPP-11: Audit progress — tracked across the two async phases (overrides + summary).
    // Total steps = 2 (overrides fetch is step 1, compliance summary is step 2).
    const [auditProgress, setAuditProgress] = useState<{ current: number; total: number }>({ current: 0, total: 2 })
    // Ensures the loading state is shown for at least 200 ms so the user sees it.
    const minDisplayRef = useRef(false)

    // ── Fetch active overrides + compliance summary on mount ───────────────────
    useEffect(() => {
        setLoading(true)
        setAuditProgress({ current: 0, total: 2 })
        minDisplayRef.current = false

        // Enforce the 200 ms minimum-display window for the progress indicator.
        const minDisplayTimer = setTimeout(() => {
            minDisplayRef.current = true
        }, 200)

        // Collect all unique ruleIds from both violation sources
        const ruleIds: string[] = []
        for (const [, warning] of linterWarnings) {
            // Extract ruleId from message prefix (e.g. "MITHRIL-COL: ...")
            const match = warning.message.match(/^([A-Z][-A-Z0-9]+)(?::\s|$)/)
            const ruleId = match?.[1] ?? warning.type.toUpperCase()
            if (!ruleIds.includes(ruleId)) ruleIds.push(ruleId)
        }
        for (const messages of Object.values(a11yViolations)) {
            for (const msg of messages) {
                const match = msg.match(/^(A11Y-\d{3})/)
                const ruleId = match?.[1]
                if (ruleId && !ruleIds.includes(ruleId)) ruleIds.push(ruleId)
            }
        }

        // Phase 1 — overrides fetch
        const overridesPromise: Promise<OverrideRow[]> = (() => {
            const readOverrides = window.flintAPI.tokens.readOverrides
            if (readOverrides === undefined) return Promise.resolve([])
            return readOverrides()
        })()

        // Phase 2 — compliance summary
        const summaryPromise: Promise<ComplianceSummary | null> =
            ruleIds.length > 0
                ? window.flintAPI.governance.getComplianceSummary(ruleIds)
                      .catch((err: Error) => {
                          console.error('[ExportModal] getComplianceSummary error:', err.message)
                          return null
                      })
                : Promise.resolve(null)

        // Advance progress bar as each phase resolves
        overridesPromise.then((rows) => {
            setOverrideRows(rows)
            setAuditProgress((p) => ({ ...p, current: 1 }))
        }).catch(() => {
            setAuditProgress((p) => ({ ...p, current: 1 }))
        })

        summaryPromise.then((summary) => {
            setComplianceSummary(summary)
            setAuditProgress((p) => ({ ...p, current: 2 }))
        }).catch(() => {
            setAuditProgress((p) => ({ ...p, current: 2 }))
        })

        Promise.all([overridesPromise, summaryPromise])
            .catch((err: Error) => {
                console.error('[ExportModal] mount fetch error:', err.message)
            })
            .finally(() => {
                // Respect the 200 ms minimum before hiding the loading state.
                if (minDisplayRef.current) {
                    setLoading(false)
                } else {
                    setTimeout(() => setLoading(false), 200)
                }
            })

        return () => clearTimeout(minDisplayTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const canExport =
        overrideRows.length === 0 &&
        mithrilViolations.length === 0 &&
        Object.keys(a11yViolations).length === 0

    // B.1-d: Severity escalation — true when any Mithril violation is critical (ΔE > 10).
    const hasCriticalMithril = mithrilViolations.some(
        (id) => linterWarnings.get(id)?.severity === 'critical'
    )

    // ── Snap-select a node when user clicks its ID in the violation list ───────
    const handleSelectNode = useCallback((flintId: string) => {
        setSelectedNode(flintId)
        setActiveSelection(flintId)
        onClose()
    }, [setSelectedNode, setActiveSelection, onClose])

    // ── Copy source to clipboard ───────────────────────────────────────────────
    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(rawCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [rawCode])

    // ── Copy compliance summary as JSON audit report ───────────────────────────
    const handleExportReport = useCallback(async () => {
        if (!complianceSummary) return
        await navigator.clipboard.writeText(JSON.stringify(complianceSummary, null, 2))
        setReportCopied(true)
        setTimeout(() => setReportCopied(false), 2000)
    }, [complianceSummary])

    // ── Download DBOM as JSON file ─────────────────────────────────────────────
    const handleDownloadDBOM = useCallback(async () => {
        setDbomDownloading(true)
        setDbomError(null)
        try {
            const mcp = window.flintAPI.mcp
            if (!mcp?.callTool) {
                throw new Error('MCP flint not available')
            }
            const result = await mcp.callTool('flint_generate_dbom', { format: 'json' })
            // result is { content: [{ type: 'text', text: string }] }
            const content = (result as { content?: Array<{ type: string; text: string }> })?.content
            const text = Array.isArray(content) ? (content[0]?.text ?? '{}') : '{}'
            // Trigger browser download
            const blob = new Blob([text], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'dbom.json'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            setDbomError(msg)
        } finally {
            setDbomDownloading(false)
        }
    }, [])

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
                        : hasCriticalMithril
                            ? 'border-red-700/40 bg-red-900/10'
                            : 'border-amber-700/40 bg-amber-900/10'
                    }`}>
                    {loading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-400" />
                    ) : canExport ? (
                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    ) : hasCriticalMithril ? (
                        <ShieldAlert className="h-5 w-5 text-red-400" />
                    ) : (
                        <ShieldAlert className="h-5 w-5 text-amber-400" />
                    )}
                    <h2 className="flex-1 text-sm font-semibold text-gray-100">
                        {loading
                            ? 'Running pre-flight audit…'
                            : canExport
                                ? 'Export Gate — All Clear'
                                : hasCriticalMithril
                                    ? 'Export Gate — Critical Violations'
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
                        <div className="space-y-3 py-2">
                            <p className="text-xs text-zinc-400">
                                Auditing{' '}
                                <span className="font-medium text-zinc-100">{auditProgress.current}</span>
                                {' '}of{' '}
                                <span className="font-medium text-zinc-100">{auditProgress.total}</span>
                                {' '}audit steps…
                            </p>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                                <div
                                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                                    style={{ width: `${Math.round((auditProgress.current / auditProgress.total) * 100)}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-zinc-500">
                                {auditProgress.current === 0
                                    ? 'Querying component overrides…'
                                    : auditProgress.current === 1
                                        ? 'Fetching compliance summary…'
                                        : 'Finalizing audit…'}
                            </p>
                        </div>
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
                                    <h3 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                                        <AlertTriangle className="h-3 w-3" />
                                        Property Overrides ({overrideRows.length})
                                    </h3>
                                    <p className="mb-2 text-[11px] text-gray-400">
                                        Values you manually changed that differ from the design system. Reset them in the Properties panel or apply the design token to clear.
                                    </p>
                                    <ul className="space-y-1.5">
                                        {overrideRows.map((row) => (
                                            <li
                                                key={`${row.flint_id}::${row.property_key}`}
                                                className="rounded border border-gray-700 bg-gray-800/60 px-3 py-2"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectNode(row.flint_id)}
                                                            className="truncate font-mono text-[10px] text-indigo-400 transition-colors hover:text-indigo-300 hover:underline"
                                                            title={`Navigate to ${row.flint_id}`}
                                                        >
                                                            {row.flint_id}
                                                        </button>
                                                        <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
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
                                        {Object.entries(a11yViolations).map(([flintId, messages]) =>
                                            messages.map((msg) => (
                                                <li
                                                    key={`${flintId}::${msg}`}
                                                    className="rounded border border-red-900/40 bg-red-900/10 px-3 py-2"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectNode(flintId)}
                                                        className="font-mono text-[10px] text-red-400 transition-colors hover:text-red-300 hover:underline"
                                                        title={`Navigate to ${flintId}`}
                                                    >
                                                        {flintId}
                                                    </button>
                                                    <p className="mt-0.5 text-[10px] text-zinc-400">
                                                        {msg}
                                                    </p>
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                </div>
                            )}

                            {/* Mithril ΔE violations — OPP-12: sorted by fixability */}
                            {mithrilViolations.length > 0 && (() => {
                                const fixable = mithrilViolations.filter(
                                    (id) => (linterWarnings.get(id)?.nearestToken ?? null) !== null
                                )
                                const manual = mithrilViolations.filter(
                                    (id) => (linterWarnings.get(id)?.nearestToken ?? null) === null
                                )

                                const renderViolationRow = (id: string) => {
                                    const warning: LinterWarning | undefined = linterWarnings.get(id)
                                    const isCritical = warning?.severity === 'critical'
                                    const isFixable = (warning?.nearestToken ?? null) !== null
                                    const deltaE = warning?.type === 'color-drift' && warning.value > 0
                                        ? warning.value
                                        : null
                                    return (
                                        <li
                                            key={id}
                                            className={`rounded border px-3 py-2 ${isCritical
                                                ? 'border-red-700/50 bg-red-900/20'
                                                : 'border-amber-900/40 bg-amber-900/10'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectNode(id)}
                                                    className={`flex-1 truncate text-left font-mono text-[10px] transition-colors hover:underline ${isCritical
                                                        ? 'text-red-400 hover:text-red-300'
                                                        : 'text-amber-400 hover:text-amber-300'
                                                    }`}
                                                    title={`Navigate to ${id}`}
                                                >
                                                    {id}
                                                </button>
                                                {isCritical && (
                                                    <span className="shrink-0 rounded bg-red-900/60 px-1 py-0.5 text-[10px] font-bold uppercase text-red-300">
                                                        Critical
                                                    </span>
                                                )}
                                                {isFixable ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectNode(id)}
                                                        className="shrink-0 flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/10 px-1.5 py-0.5 text-[10px] text-indigo-400 transition-colors hover:bg-indigo-900/30 hover:text-indigo-300"
                                                        title={`Auto-fix: apply token ${warning?.nearestToken ?? ''}`}
                                                    >
                                                        <Wrench className="h-2.5 w-2.5" />
                                                        Fix
                                                    </button>
                                                ) : (
                                                    <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                                                        Manual
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-[10px] text-zinc-400">
                                                {warning?.message
                                                    ? warning.message
                                                    : deltaE !== null
                                                        ? `Color drift ΔE ${deltaE.toFixed(1)} — token not applied`
                                                        : 'Design system violation — token not applied'
                                                }
                                            </p>
                                        </li>
                                    )
                                }

                                return (
                                    <div>
                                        <h3 className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${hasCriticalMithril ? 'text-red-400' : 'text-amber-400'}`}>
                                            <ShieldAlert className="h-3 w-3" />
                                            Mithril Violations ({mithrilViolations.length})
                                            {hasCriticalMithril && (
                                                <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
                                                    Critical
                                                </span>
                                            )}
                                        </h3>

                                        {/* Auto-fixable group */}
                                        {fixable.length > 0 && (
                                            <div className="mb-2">
                                                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium text-indigo-400">
                                                    <Wrench className="h-2.5 w-2.5" />
                                                    Auto-fixable ({fixable.length})
                                                </p>
                                                <ul className="space-y-1.5">
                                                    {fixable.map(renderViolationRow)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Divider between groups */}
                                        {fixable.length > 0 && manual.length > 0 && (
                                            <div className="my-3 border-t border-zinc-800" />
                                        )}

                                        {/* Manual-fix group */}
                                        {manual.length > 0 && (
                                            <div>
                                                <p className="mb-1.5 text-[10px] font-medium text-zinc-500">
                                                    Manual fix required ({manual.length})
                                                </p>
                                                <ul className="space-y-1.5">
                                                    {manual.map(renderViolationRow)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* ── Compliance Summary (GOV.1) ─────────────────────── */}
                            {complianceSummary !== null && (
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                                            <ShieldAlert className="h-3 w-3" />
                                            Compliance Summary
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => { void handleExportReport() }}
                                            className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/10 px-2 py-0.5 text-[10px] text-indigo-400 transition-colors hover:bg-indigo-900/30 hover:text-indigo-300"
                                            title="Copy JSON audit report to clipboard"
                                        >
                                            {reportCopied ? (
                                                <><Check className="h-2.5 w-2.5" /> Copied!</>
                                            ) : (
                                                <><FileDown className="h-2.5 w-2.5" /> Export Audit Report (JSON)</>
                                            )}
                                        </button>
                                    </div>

                                    {/* Authority breakdown badges */}
                                    {Object.keys(complianceSummary.byAuthority).length > 0 && (
                                        <div className="mb-2 flex flex-wrap gap-1.5">
                                            {Object.entries(complianceSummary.byAuthority).map(([authority, count]) => (
                                                <span
                                                    key={authority}
                                                    className="rounded border border-zinc-700/50 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                                                >
                                                    {authority}: {count}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Per-rule regulatory references */}
                                    {complianceSummary.violatedRules.length > 0 && (
                                        <ul className="space-y-1">
                                            {complianceSummary.violatedRules.map((rule) => (
                                                <li
                                                    key={rule.ruleId}
                                                    className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-[10px] text-indigo-400">
                                                            {rule.ruleId}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400">
                                                            {rule.ruleName}
                                                        </span>
                                                        <span className="ml-auto shrink-0 rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-500">
                                                            {rule.sourceAuthority}
                                                        </span>
                                                    </div>
                                                    <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                                                        {rule.regulatoryReference}
                                                    </p>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!loading && (
                    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-800 px-5 py-3">
                        {/* Left: DBOM download */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => { void handleDownloadDBOM() }}
                                disabled={dbomDownloading}
                                title="Download Design Bill of Materials (DBOM) as JSON"
                                className="flex items-center gap-1.5 rounded border border-indigo-500/40 bg-indigo-900/10 px-2.5 py-1.5 text-xs text-indigo-400 transition-colors hover:bg-indigo-900/30 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download className="h-3 w-3" />
                                {dbomDownloading ? 'Generating DBOM…' : 'Download DBOM'}
                            </button>
                            {dbomError !== null && (
                                <span className="text-[10px] text-red-400" title={dbomError}>
                                    DBOM failed
                                </span>
                            )}
                        </div>
                        {/* Right: Close + Copy Source */}
                        <div className="flex items-center gap-2">
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
                    </div>
                )}
            </div>
        </div>
    )
}
