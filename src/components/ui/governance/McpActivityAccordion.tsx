/**
 * McpActivityAccordion.tsx — C12
 *
 * MCP Activity Feed accordion section (S4.11).
 * Displays recent AI agent actions with severity dots and undo controls.
 * Pure presentational — all data and callbacks passed as props.
 */

import { ChevronDown, ChevronRight, Activity } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface McpActivityEvent {
    id: string | number
    title: string
    message?: string
    severity?: 'error' | 'critical' | 'warning' | 'info' | string
    type?: 'mutation' | 'audit' | 'fix' | 'violation' | 'override' | 'anomaly' | 'info'
}

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface McpActivityAccordionProps {
    /** Whether the accordion is expanded. */
    isOpen: boolean
    /** Toggle callback. */
    onToggle: () => void
    /** List of MCP activity events to display. */
    events: McpActivityEvent[]
    /** Callback for "Undo this" on mutation events. */
    onUndo: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityDot(severity: string | undefined): string {
    if (severity === 'error' || severity === 'critical') return 'bg-red-400'
    if (severity === 'warning') return 'bg-amber-400'
    return 'bg-indigo-400'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function McpActivityAccordion({
    isOpen,
    onToggle,
    events,
    onUndo,
}: McpActivityAccordionProps) {
    return (
        <div className="border-t border-zinc-800/60">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                aria-expanded={isOpen}
                aria-controls="activity-accordion"
                data-testid="activity-accordion-toggle"
            >
                {isOpen
                    ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                    : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                <span className="flex-1 text-xs text-zinc-400">Agent Activity</span>
                {events.length > 0 && (
                    <span className="text-[10px] text-zinc-600">{events.length}</span>
                )}
            </button>
            {isOpen && (
                <div
                    id="activity-accordion"
                    className="px-3 py-2"
                    data-testid="activity-feed-section"
                >
                    {events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                            <Activity className="h-5 w-5 text-zinc-600" aria-hidden="true" />
                            <p className="text-sm text-zinc-400">
                                This feed tracks AI agent actions. Connect an MCP client to start seeing activity.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {events.map((event) => (
                                <div
                                    key={event.id}
                                    className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-zinc-800/40"
                                >
                                    <span
                                        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${severityDot(event.severity)}`}
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs text-zinc-300">{event.title}</p>
                                        {event.message && (
                                            <p className="truncate text-[10px] text-zinc-400">{event.message}</p>
                                        )}
                                    </div>
                                    {event.type === 'mutation' && (
                                        <button
                                            type="button"
                                            onClick={() => void onUndo()}
                                            className="shrink-0 self-center rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500 hover:border-indigo-500/40 hover:text-indigo-400 transition-colors"
                                            aria-label="Undo this agent action"
                                        >
                                            Undo this
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
