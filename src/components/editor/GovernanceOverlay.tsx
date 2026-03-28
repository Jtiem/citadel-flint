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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Loader2, Settings2, ShieldCheck, Wrench, X } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import type { LinterWarning } from '../../types/flint-api'

// ── EDU-05: Error taxonomy lookup ────────────────────────────────────────────

/**
 * Minimal subset of the errorTaxonomy ErrorEntry needed for the "Why?" expansion.
 * We keep this inline (no cross-package import) to respect the process boundary.
 */
interface TaxonomyEntry {
    title: string
    explanation: string
    recovery: string
}

/**
 * Maps rule ID prefixes (as they appear in LinterWarning.message) to plain-language
 * explanations sourced from flint-mcp/src/core/errorTaxonomy.ts.
 *
 * Keys intentionally match the rule ID extracted by `extractRuleId()` — the
 * short prefix without a numeric suffix (e.g. "MITHRIL-COL", "A11Y-001").
 * Lookup uses `startsWith` so "MITHRIL-COL-001" still matches "MITHRIL-COL".
 */
const TAXONOMY: Record<string, TaxonomyEntry> = {
    'MITHRIL-COL': {
        title: 'Color Token Drift',
        explanation:
            'A color in this element does not match any registered design token. ' +
            'Design systems rely on a controlled color palette to maintain visual consistency. ' +
            'Unregistered colors make future rebranding or theming unreliable.',
        recovery:
            'Replace the arbitrary color with the suggested token class shown below. ' +
            'If no token fits, add the new color to your design tokens and re-run the audit.',
    },
    'MITHRIL-TYP': {
        title: 'Typography Token Drift',
        explanation:
            'A font value (size, weight, family, line height, or letter spacing) does not match a registered typography token. ' +
            'Typography tokens define the type scale and ensure visual rhythm across your product.',
        recovery:
            'Replace the arbitrary value with a token-backed typography class. ' +
            'If the value is intentional, add it as a typography token.',
    },
    'MITHRIL-SPC': {
        title: 'Spacing Token Drift',
        explanation:
            'A spacing value (padding, margin, gap, width, or height) does not match a registered dimension token. ' +
            'Spacing tokens define the layout grid — arbitrary values break alignment across breakpoints.',
        recovery:
            'Replace the arbitrary spacing class with a token-backed spacing utility. ' +
            'If the value is intentional, add it as a dimension token.',
    },
    'MITHRIL-SHD': {
        title: 'Shadow Token Drift',
        explanation:
            'A shadow value does not match a registered shadow token. ' +
            'Shadow tokens control depth hierarchy; arbitrary values break the elevation system.',
        recovery: 'Replace the arbitrary shadow class with a token-backed shadow utility.',
    },
    'MITHRIL-OPC': {
        title: 'Opacity Token Drift',
        explanation:
            'An opacity value does not match a registered opacity token. ' +
            'Opacity tokens define the transparency vocabulary for disabled states, overlays, and ghost elements.',
        recovery: 'Replace the arbitrary opacity class with a token-backed opacity utility.',
    },
    'MITHRIL-IST': {
        title: 'Inline Style Token Drift',
        explanation:
            'A hardcoded value in a style={{}} prop bypasses the design system entirely. ' +
            'These values are invisible to theme switching and rebranding operations.',
        recovery:
            'Replace the hardcoded value with a CSS variable or token reference.',
    },
    'A11Y': {
        title: 'Accessibility Issue',
        explanation:
            'This element does not meet WCAG 2.1 AA accessibility requirements. ' +
            'Accessibility violations block export and may prevent users with disabilities from using your product.',
        recovery:
            'Follow the specific guidance in the violation message. ' +
            'Accessibility issues must be fixed or overridden before you can export.',
    },
}

/**
 * Looks up the taxonomy entry for a given rule ID string.
 * Matches by prefix so "MITHRIL-COL-001" resolves to the "MITHRIL-COL" entry.
 */
function lookupTaxonomy(ruleId: string | null): TaxonomyEntry | null {
    if (!ruleId) return null
    // First try exact match
    if (TAXONOMY[ruleId]) return TAXONOMY[ruleId]
    // Then try prefix match (e.g. "A11Y-001" → "A11Y")
    for (const key of Object.keys(TAXONOMY)) {
        if (ruleId.startsWith(key)) return TAXONOMY[key]
    }
    return null
}

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
 * Extracts the rule ID from the leading prefix of a linter message.
 *
 * Messages are formatted as `"<RULE-ID>: <description>"`, e.g.:
 *   "MITHRIL-COL: ΔE 4.5 – use text-red-500"
 *   "A11Y-002: <button> has no accessible name."
 *   "MITHRIL-TYP-001: arbitrary 'Comic Sans' not in token set"
 *
 * Returns null when the message does not start with a recognisable rule prefix.
 */
function extractRuleId(message: string): string | null {
    const match = /^([A-Z0-9-]+):/.exec(message)
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface GovernanceOverlayProps {
    /**
     * Called when the user clicks the "Configure rule" icon on a violation row.
     * Receives the rule ID extracted from the violation message (e.g. "MITHRIL-COL").
     * When omitted the configure icon is not rendered.
     */
    onConfigureRule?: (ruleId: string) => void
}

// ── GovernanceOverlay ─────────────────────────────────────────────────────────

export function GovernanceOverlay({ onConfigureRule }: GovernanceOverlayProps = {}) {
    // Selector pattern — never destructure the whole store
    const linterWarnings = useEditorStore((s) => s.linterWarnings)

    // GLASS.1d: Scroll-to-violation when ShieldOverlay badge is clicked
    const scrollToViolationId = useCanvasStore((s) => s.scrollToViolationId)
    const setScrollToViolationId = useCanvasStore((s) => s.setScrollToViolationId)
    const violationListRef = useRef<HTMLDivElement>(null)

    // GLASS.1e: Rule filter set by GovernanceDashboard
    const governanceRuleFilter = useCanvasStore((s) => s.governanceRuleFilter)
    const setGovernanceRuleFilter = useCanvasStore((s) => s.setGovernanceRuleFilter)

    useEffect(() => {
        if (!scrollToViolationId || !violationListRef.current) return
        const target = violationListRef.current.querySelector(
            `[data-violation-node="${CSS.escape(scrollToViolationId)}"]`
        )
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            // Brief highlight flash
            target.classList.add('ring-1', 'ring-indigo-500/60')
            const timer = setTimeout(() => {
                target.classList.remove('ring-1', 'ring-indigo-500/60')
            }, 2000)
            // Clear the scroll target so repeat clicks still work
            setScrollToViolationId(null)
            return () => clearTimeout(timer)
        }
        setScrollToViolationId(null)
    }, [scrollToViolationId, setScrollToViolationId])

    /**
     * OPP-08: Diff preview state.
     * Holds the composite key `${nodeId}-${warning.id}` of the violation row
     * whose Auto-Fix button is currently hovered or focused. When set, an
     * inline before→after diff card is rendered below that button.
     */
    const [previewFixId, setPreviewFixId] = useState<string | null>(null)

    /**
     * EDU-05: "Why?" expansion state.
     * Holds the composite key `${nodeId}-${warning.id}` of the row whose
     * explanation panel is currently expanded. Only one at a time.
     */
    const [expandedWhyId, setExpandedWhyId] = useState<string | null>(null)

    // ── GLASS.1e: Fix All state ──────────────────────────────────────────────
    const [fixAllState, setFixAllState] = useState<
        | { status: 'idle' }
        | { status: 'fixing'; fixed: number; total: number }
        | { status: 'done'; fixed: number; failed: number }
    >({ status: 'idle' })

    // Auto-dismiss "done" state after 4 seconds
    useEffect(() => {
        if (fixAllState.status !== 'done') return
        const timer = setTimeout(() => setFixAllState({ status: 'idle' }), 4000)
        return () => clearTimeout(timer)
    }, [fixAllState.status])

    // Convert the Map to an array for rendering
    const allEntries = useMemo(
        () => Array.from(linterWarnings.entries()),
        [linterWarnings],
    )

    // GLASS.1e: Compute auto-fixable entries (across all violations, unfiltered)
    const autoFixableEntries = useMemo(
        () =>
            allEntries.filter(
                ([, w]) => w.nearestToken !== null && extractHardcodedClass(w.message) !== null,
            ),
        [allEntries],
    )

    // GLASS.1e: Apply rule filter for display
    const entries = useMemo(
        () =>
            governanceRuleFilter
                ? allEntries.filter(([, w]) => w.type === governanceRuleFilter)
                : allEntries,
        [allEntries, governanceRuleFilter],
    )

    const handleAutoFix = useCallback((nodeId: string, warning: LinterWarning) => {
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
    }, [])

    // ── GLASS.1e: Fix All handler ────────────────────────────────────────────
    const handleFixAll = useCallback(() => {
        const fixable = autoFixableEntries
        if (fixable.length === 0) return

        setFixAllState({ status: 'fixing', fixed: 0, total: fixable.length })

        // Build all mutations at once for a single atomic batch
        const mutations: Array<{
            op: 'applyTokenFix'
            nodeId: string
            hardcodedClass: string
            tokenClass: string
        }> = []
        const failedCount = { value: 0 }

        for (const [nodeId, warning] of fixable) {
            const hardcodedClass = extractHardcodedClass(warning.message)
            if (!hardcodedClass || !warning.nearestToken) {
                failedCount.value += 1
                continue
            }
            mutations.push({
                op: 'applyTokenFix',
                nodeId,
                hardcodedClass,
                tokenClass: warning.nearestToken,
            })
        }

        // Apply all mutations in a single batch (Commandment 12: atomic batching)
        if (mutations.length > 0) {
            useEditorStore.getState().applyBatch(mutations)
        }

        setFixAllState({
            status: 'done',
            fixed: mutations.length,
            failed: failedCount.value,
        })
    }, [autoFixableEntries])

    if (linterWarnings.size === 0) {
        return (
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                {/* EDU-03: plain language — "design system" instead of "Mithril" */}
                <span className="text-xs text-emerald-400">No design system violations</span>
            </div>
        )
    }

    return (
        <div className="flex flex-col">
            {/* Section header with Fix All button */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 shrink-0">
                <div className="flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Governance
                    </h3>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {entries.length}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* GLASS.1e: Fix All button */}
                    {fixAllState.status === 'fixing' ? (
                        <span className="flex items-center gap-1 text-xs text-indigo-400">
                            <Loader2 size={10} className="animate-spin" />
                            <span>
                                Fixing... ({fixAllState.fixed}/{fixAllState.total})
                            </span>
                        </span>
                    ) : fixAllState.status === 'done' ? (
                        <span className="text-xs text-emerald-400" data-testid="fix-all-result">
                            {fixAllState.failed === 0
                                ? `Fixed ${fixAllState.fixed} violations`
                                : `Fixed ${fixAllState.fixed}/${fixAllState.fixed + fixAllState.failed}. ${fixAllState.failed} require manual review.`}
                        </span>
                    ) : autoFixableEntries.length > 0 ? (
                        <button
                            type="button"
                            onClick={handleFixAll}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded transition-colors"
                            data-testid="fix-all-button"
                        >
                            Fix {autoFixableEntries.length} Auto-Fixable
                        </button>
                    ) : (
                        <span
                            className="bg-zinc-800 text-zinc-500 text-xs px-2 py-1 rounded cursor-not-allowed"
                            data-testid="fix-all-disabled"
                        >
                            No auto-fixable
                        </span>
                    )}
                </div>
            </div>

            {/* GLASS.1e: Active filter indicator */}
            {governanceRuleFilter && (
                <div className="flex items-center gap-2 border-b border-zinc-800 bg-indigo-900/10 px-3 py-1.5">
                    <span className="text-[10px] text-indigo-400">
                        Filtered: {violationTypeLabel(governanceRuleFilter)}
                    </span>
                    <button
                        type="button"
                        onClick={() => setGovernanceRuleFilter(null)}
                        className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                        title="Clear filter"
                        data-testid="clear-rule-filter"
                    >
                        <X size={10} />
                    </button>
                </div>
            )}

            {/* Violation list */}
            <div ref={violationListRef} className="flex flex-col divide-y divide-zinc-800/60 overflow-y-auto max-h-64">
                {entries.map(([nodeId, warning]) => {
                    const canAutoFix   = warning.nearestToken !== null
                    const isCritical   = warning.severity === 'critical'
                    const hardcodedCls = extractHardcodedClass(warning.message)
                    const ruleId       = extractRuleId(warning.message)

                    const fixKey = `${nodeId}-${warning.id}`
                    const isWhyExpanded = expandedWhyId === fixKey
                    const taxonomy = lookupTaxonomy(ruleId)

                    return (
                        <div
                            key={fixKey}
                            data-violation-node={nodeId}
                            className={`px-3 py-2 flex flex-col gap-1 transition-shadow ${
                                isCritical ? 'bg-red-900/10' : 'bg-amber-900/10'
                            }`}
                        >
                            {/* Violation type + severity badge + configure icon */}
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

                                <div className="flex items-center gap-1 shrink-0">
                                    {/* EDU-05: "Why?" toggle — expands the explanation panel */}
                                    {taxonomy && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedWhyId(isWhyExpanded ? null : fixKey)
                                            }
                                            className="flex items-center gap-0.5 p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                                            title="Show explanation for this violation"
                                            aria-expanded={isWhyExpanded}
                                        >
                                            {isWhyExpanded ? (
                                                <ChevronDown size={10} />
                                            ) : (
                                                <ChevronRight size={10} />
                                            )}
                                            <span className="text-[10px]">Why?</span>
                                        </button>
                                    )}
                                    {/* OPP-15: Configure rule link — only rendered when handler + ruleId are present */}
                                    {onConfigureRule && ruleId && (
                                        <button
                                            type="button"
                                            onClick={() => onConfigureRule(ruleId)}
                                            className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors"
                                            title={`Configure rule ${ruleId}`}
                                            aria-label={`Configure rule ${ruleId}`}
                                        >
                                            <Settings2 size={10} />
                                        </button>
                                    )}
                                    {/* EDU-02: severity badge tooltips */}
                                    <span
                                        className={`text-xs px-1.5 py-0.5 rounded ${
                                            isCritical
                                                ? 'bg-red-900/20 text-red-400 border border-red-700/40'
                                                : 'bg-amber-900/20 text-amber-400 border border-amber-500/30'
                                        }`}
                                        title={
                                            isCritical
                                                ? 'Blocks export — must be fixed or overridden before you can export.'
                                                : 'Warning — does not match your design tokens. Will not block export unless escalated.'
                                        }
                                    >
                                        {isCritical ? 'critical' : 'amber'}
                                    </span>
                                </div>
                            </div>

                            {/* EDU-05: Expandable explanation panel */}
                            {isWhyExpanded && taxonomy && (
                                <div className="mt-1 rounded border border-zinc-700/50 bg-zinc-900 px-2.5 py-2 space-y-1.5">
                                    <p className="text-[10px] font-medium text-zinc-300">{taxonomy.title}</p>
                                    <p className="text-[10px] text-zinc-500 leading-relaxed">{taxonomy.explanation}</p>
                                    <div className="border-t border-zinc-800 pt-1.5">
                                        <p className="text-[10px] font-medium text-emerald-400 mb-0.5">How to fix</p>
                                        <p className="text-[10px] text-zinc-500 leading-relaxed">{taxonomy.recovery}</p>
                                    </div>
                                    {onConfigureRule && ruleId && (
                                        <button
                                            type="button"
                                            onClick={() => onConfigureRule(ruleId)}
                                            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            Configure rule
                                        </button>
                                    )}
                                </div>
                            )}

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
