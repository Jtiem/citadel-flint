/**
 * PendingApprovalsAccordion.tsx — C14
 *
 * S8.3 MRS Pending Approvals accordion section.
 * Shows mutations awaiting Amber/Red risk-tier approval.
 * Pure presentational — all data and callbacks passed as props.
 */

import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PendingMutation } from '../../../types/flint-api'

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_TIER_STYLE: Record<string, string> = {
    Amber: 'border-amber-500/40 bg-amber-900/20 text-amber-400',
    Red: 'border-red-500/40 bg-red-900/20 text-red-400',
}

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface PendingApprovalsAccordionProps {
    /** Whether the accordion is expanded. */
    isOpen: boolean
    /** Toggle callback. */
    onToggle: () => void
    /** List of pending mutations awaiting approval. */
    pendingMutations: PendingMutation[]
    /** Handler: approve mutation by ID. */
    onApprove: (id: number) => void
    /** Handler: reject mutation by ID. */
    onReject: (id: number) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PendingApprovalsAccordion({
    isOpen,
    onToggle,
    pendingMutations,
    onApprove,
    onReject,
}: PendingApprovalsAccordionProps) {
    if (pendingMutations.length === 0) return null

    return (
        <div className="border-t border-zinc-800/60" data-testid="pending-approvals-section">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
                aria-expanded={isOpen}
                aria-controls="pending-approvals-accordion"
            >
                {isOpen
                    ? <ChevronDown size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />
                    : <ChevronRight size={12} className="shrink-0 text-zinc-500" aria-hidden="true" />}
                <span className="flex-1 text-xs text-zinc-400">Pending Approvals</span>
                <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    {pendingMutations.length} pending
                </span>
            </button>
            {isOpen && (
                <div
                    id="pending-approvals-accordion"
                    className="px-3 py-2 space-y-1.5"
                    data-testid="pending-approvals-list"
                >
                    {pendingMutations.map((m) => (
                        <div
                            key={m.id}
                            className={`rounded border px-3 py-2 ${RISK_TIER_STYLE[m.riskTier] ?? 'border-zinc-700 bg-zinc-800/50 text-zinc-400'}`}
                            data-testid={`pending-mutation-${m.id}`}
                        >
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                        {m.type} — {m.filePath.split('/').pop() ?? m.filePath}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-mono">
                                            Risk: {m.riskScore}
                                        </span>
                                        <span className={`text-[10px] rounded px-1 py-px ${
                                            m.riskTier === 'Red'
                                                ? 'bg-red-900/40 text-red-300'
                                                : 'bg-amber-900/40 text-amber-300'
                                        }`}>
                                            {m.riskTier}
                                        </span>
                                        {m.agentId && (
                                            <span className="text-[10px] text-zinc-400 truncate">
                                                Agent: {m.agentId}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => void onApprove(m.id)}
                                        className="rounded border border-emerald-500/40 bg-emerald-900/20 px-2 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-900/40 transition-colors"
                                        aria-label={`Approve mutation ${m.id}`}
                                        data-testid={`approve-mutation-${m.id}`}
                                    >
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void onReject(m.id)}
                                        className="rounded border border-red-500/40 bg-red-900/20 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-900/40 transition-colors"
                                        aria-label={`Reject mutation ${m.id}`}
                                        data-testid={`reject-mutation-${m.id}`}
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
