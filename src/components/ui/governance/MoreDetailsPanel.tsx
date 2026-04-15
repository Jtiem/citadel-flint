/**
 * MoreDetailsPanel.tsx — C9
 *
 * Outer accordion container for all secondary "More details" sections.
 * Hosts an expand/collapse toggle that reveals an inner panel slot.
 * Pure presentational — open state and children are passed in as props.
 */

import { ChevronDown, ChevronRight } from 'lucide-react'

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface MoreDetailsPanelProps {
    /** Whether the "More details" section is expanded. */
    isOpen: boolean
    /** Toggle callback. */
    onToggle: () => void
    /** Whether delta mode is active (shows "Delta on" badge). */
    isBaselineSet?: boolean
    /** Child accordion sections rendered inside the expanded panel. */
    children?: React.ReactNode
    /** Visibility guard — hidden when no design system is loaded. */
    tokenCount: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MoreDetailsPanel({
    isOpen,
    onToggle,
    isBaselineSet = false,
    children,
    tokenCount,
}: MoreDetailsPanelProps) {
    if (tokenCount <= 0) return null

    return (
        <div className="border-t border-zinc-800" data-testid="more-details-disclosure">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                aria-expanded={isOpen}
                aria-controls="more-details-panel"
                data-testid="more-details-toggle"
            >
                {isOpen
                    ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                    : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                <span className="flex-1 text-xs text-zinc-500">More details</span>
                {isBaselineSet && <span className="text-[10px] text-indigo-400">Delta on</span>}
            </button>

            {isOpen && (
                <div id="more-details-panel">
                    {children}
                </div>
            )}
        </div>
    )
}
