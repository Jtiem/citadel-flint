/**
 * ViolationTooltip — src/components/editor/ViolationTooltip.tsx
 *
 * Phase U.1 — Ghost Canvas (Spatial Governance Overlays)
 *
 * A hover popover that shows governance violation details for a canvas node.
 * Rendered by ShieldOverlay when the user hovers a violation badge.
 *
 * Positioning contract:
 *   `position` is in iframe-relative pixels (same coordinate space as
 *   nodeLayouts). The component is translated so it never clips the left/top
 *   edges; the caller is responsible for ensuring it fits within the overlay's
 *   bounding box.
 *
 * Mithril Safety: all classes from Flint design token palette.
 * No hardcoded hex values. No arbitrary spacing values.
 */

import { useEffect, useRef } from 'react'
import { AlertTriangle, ArrowRight, ShieldAlert, X } from 'lucide-react'
import type { LinterWarning } from '../../types/flint-api'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ViolationTooltipProps {
    /** data-flint-id of the node whose violations are shown. */
    nodeId: string
    /**
     * Top-left anchor in iframe-relative pixels.
     * Typically placed just below-right of the badge icon.
     */
    position: { x: number; y: number }
    /** Mithril warnings that belong to this node. May be empty. */
    mithrilWarnings: LinterWarning[]
    /** A11y violation messages that belong to this node. May be empty. */
    a11yMessages: string[]
    /** Called when the user clicks the close button or presses Escape. */
    onClose: () => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Stable label shown for each LinterWarning type. */
function typeLabel(type: LinterWarning['type']): string {
    switch (type) {
        case 'color-drift':      return 'Color Drift'
        case 'typography-drift': return 'Typography Drift'
        case 'spacing-drift':    return 'Spacing Drift'
        case 'shadow-drift':     return 'Shadow Drift'
        case 'opacity-drift':    return 'Opacity Drift'
        case 'a11y':             return 'Accessibility'
        case 'semantic-drift':   return 'Semantic Drift'
    }
}

/** Extract the rule ID prefix from a LinterWarning message (e.g. "MITHRIL-COL-001"). */
function extractRuleId(message: string): string {
    const match = /^([A-Z0-9]+-[A-Z0-9]+-\d+)/.exec(message)
    return match ? match[1] : message.split(':')[0] ?? message
}

/** Extract the rule ID from an a11y message (e.g. "A11Y-001: …"). */
function extractA11yRuleId(message: string): string {
    const match = /^(A11Y-\d+)/.exec(message)
    return match ? match[1] : 'A11Y'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ViolationTooltip({
    nodeId,
    position,
    mithrilWarnings,
    a11yMessages,
    onClose,
}: ViolationTooltipProps) {
    const cardRef = useRef<HTMLDivElement>(null)

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [onClose])

    const hasCritical = mithrilWarnings.some((w) => w.severity === 'critical')
    const totalCount  = mithrilWarnings.length + a11yMessages.length

    return (
        <div
            ref={cardRef}
            data-flint-id={`violation-tooltip-${nodeId}`}
            role="dialog"
            aria-label={`Governance violations for ${nodeId}`}
            className="pointer-events-auto absolute z-50"
            style={{ left: position.x, top: position.y }}
        >
            {/* Card */}
            <div className="w-72 max-w-xs rounded-lg border border-zinc-700/50 bg-zinc-900 p-3 shadow-xl">
                {/* Header */}
                <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <ShieldAlert
                            size={14}
                            className={hasCritical ? 'text-red-400' : 'text-amber-400'}
                        />
                        <span className="text-xs font-semibold text-zinc-100">
                            {totalCount} Violation{totalCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-0.5 rounded text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                        aria-label="Close violation tooltip"
                    >
                        <X size={12} />
                    </button>
                </div>

                {/* Node ID chip */}
                <div className="mb-3">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                        {nodeId}
                    </span>
                </div>

                {/* Mithril violations */}
                {mithrilWarnings.length > 0 && (
                    <div className="mb-2 space-y-1.5">
                        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                            Design Drift
                        </p>
                        {mithrilWarnings.map((w, i) => (
                            <div
                                key={`mithril-${i}`}
                                className={`rounded border px-2 py-1.5 ${
                                    w.severity === 'critical'
                                        ? 'border-red-700/40 bg-red-900/10'
                                        : 'border-amber-500/30 bg-amber-900/20'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span
                                        className={`text-xs font-medium font-mono ${
                                            w.severity === 'critical'
                                                ? 'text-red-400'
                                                : 'text-amber-400'
                                        }`}
                                    >
                                        {extractRuleId(w.message)}
                                    </span>
                                    <span
                                        className={`text-xs px-1 py-0.5 rounded ${
                                            w.severity === 'critical'
                                                ? 'bg-red-900/30 text-red-400'
                                                : 'bg-amber-900/30 text-amber-400'
                                        }`}
                                    >
                                        {w.severity}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400">{typeLabel(w.type)}</p>
                                {w.value > 0 && w.type === 'color-drift' && (
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        ΔE {w.value.toFixed(1)} (limit: 2.0) — {w.value > 10 ? 'very different from token' : w.value > 5 ? 'noticeably different' : 'slightly off'}
                                    </p>
                                )}
                                {w.nearestToken && (
                                    <div className="flex items-center gap-1 mt-1 pl-1">
                                        <ArrowRight size={10} className="text-emerald-400 shrink-0" />
                                        <p className="text-[10px] text-emerald-400">
                                            Suggested fix:{' '}
                                            <code className="font-mono">{w.nearestToken}</code>
                                            {w.nearestTokenValue
                                                ? ` (${w.nearestTokenValue})`
                                                : ''}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* A11y violations */}
                {a11yMessages.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                            Accessibility
                        </p>
                        {a11yMessages.map((msg, i) => (
                            <div
                                key={`a11y-${i}`}
                                className="rounded border border-red-700/40 bg-red-900/10 px-2 py-1.5"
                            >
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <AlertTriangle size={10} className="text-red-400 shrink-0" />
                                    <span className="text-xs font-medium font-mono text-red-400">
                                        {extractA11yRuleId(msg)}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-snug">
                                    {msg.replace(/^A11Y-\d+:\s*/, '')}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
