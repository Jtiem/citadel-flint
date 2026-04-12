/**
 * ApprovalStagingArea — src/components/ui/ApprovalStagingArea.tsx
 *
 * MINT.3c: Token Approval Staging Area
 *
 * Displays pending tokens awaiting approval before they're merged
 * into design-tokens.json. Supports approve/reject per token and bulk actions.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useCallback } from 'react'
import { Clock, Check, X, AlertTriangle, CheckCheck, XCircle } from 'lucide-react'
import type { PendingToken } from '../../types/flint-api'

export interface ApprovalStagingAreaProps {
    /** Pending tokens from getPendingApprovals(). */
    pendingTokens: PendingToken[]
    /** Whether a load or action is in progress. */
    isLoading: boolean
    /** Approve a single token. */
    onApprove: (tokenName: string) => Promise<void>
    /** Reject a single token. */
    onReject: (tokenName: string) => Promise<void>
    /** Approve all pending tokens. */
    onApproveAll: () => Promise<void>
    /** Reject all pending tokens. */
    onRejectAll: () => Promise<void>
    /** Optional: tokens that would cause drift issues if approved. */
    driftWarnings?: Set<string>
}

function formatRelativeTime(isoDate: string): string {
    try {
        const date = new Date(isoDate)
        const now = Date.now()
        const diffMs = now - date.getTime()
        const diffMin = Math.floor(diffMs / 60000)
        if (diffMin < 1) return 'just now'
        if (diffMin < 60) return `${diffMin}m ago`
        const diffHr = Math.floor(diffMin / 60)
        if (diffHr < 24) return `${diffHr}h ago`
        const diffDay = Math.floor(diffHr / 24)
        return `${diffDay}d ago`
    } catch {
        return isoDate
    }
}

/** Color swatch for color-type pending tokens. */
function PendingColorSwatch({ value }: { value: string }) {
    if (!value.startsWith('#') && !value.startsWith('rgb')) return null
    return (
        <span
            className="inline-block h-4 w-4 shrink-0 rounded-full border border-white/20"
            style={{ backgroundColor: value }}
            aria-label={`Color preview: ${value}`}
            role="img"
        />
    )
}

interface PendingTokenRowProps {
    token: PendingToken
    onApprove: (name: string) => Promise<void>
    onReject: (name: string) => Promise<void>
    isProcessing: boolean
    hasDriftWarning: boolean
}

function PendingTokenRow({ token, onApprove, onReject, isProcessing, hasDriftWarning }: PendingTokenRowProps) {
    return (
        <div
            className="flex items-center gap-2 border-b border-amber-500/10 px-3 py-2 hover:bg-amber-500/5"
            data-testid="pending-token-row"
        >
            {/* Color preview if applicable */}
            <PendingColorSwatch value={token.value} />

            {/* Token info */}
            <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[11px] text-zinc-300" title={token.name}>
                    {token.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] text-zinc-500">{token.value}</span>
                    <span className="text-[9px] text-zinc-600">from {token.source}</span>
                    <span className="text-[9px] text-zinc-600">{formatRelativeTime(token.proposedAt)}</span>
                </div>
            </div>

            {/* Drift warning */}
            {hasDriftWarning && (
                <span
                    className="flex items-center gap-1 rounded border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[9px] text-amber-400"
                    data-testid="drift-warning"
                    aria-label="Approving may cause drift issues"
                    title="Mithril: approving this token may create color drift"
                >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Drift risk
                </span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onApprove(token.name)}
                    disabled={isProcessing}
                    className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
                    aria-label={`Approve token ${token.name}`}
                >
                    <Check className="h-3 w-3" />
                </button>
                <button
                    type="button"
                    onClick={() => onReject(token.name)}
                    disabled={isProcessing}
                    className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                    aria-label={`Reject token ${token.name}`}
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
        </div>
    )
}

export function ApprovalStagingArea({
    pendingTokens,
    isLoading,
    onApprove,
    onReject,
    onApproveAll,
    onRejectAll,
    driftWarnings = new Set(),
}: ApprovalStagingAreaProps) {
    const [processingSet, setProcessingSet] = useState<Set<string>>(new Set())
    const [isBulkProcessing, setIsBulkProcessing] = useState(false)

    const handleApprove = useCallback(async (name: string) => {
        setProcessingSet((prev) => new Set(prev).add(name))
        try {
            await onApprove(name)
        } finally {
            setProcessingSet((prev) => {
                const next = new Set(prev)
                next.delete(name)
                return next
            })
        }
    }, [onApprove])

    const handleReject = useCallback(async (name: string) => {
        setProcessingSet((prev) => new Set(prev).add(name))
        try {
            await onReject(name)
        } finally {
            setProcessingSet((prev) => {
                const next = new Set(prev)
                next.delete(name)
                return next
            })
        }
    }, [onReject])

    const handleApproveAll = useCallback(async () => {
        setIsBulkProcessing(true)
        try {
            await onApproveAll()
        } finally {
            setIsBulkProcessing(false)
        }
    }, [onApproveAll])

    const handleRejectAll = useCallback(async () => {
        setIsBulkProcessing(true)
        try {
            await onRejectAll()
        } finally {
            setIsBulkProcessing(false)
        }
    }, [onRejectAll])

    if (isLoading) {
        return (
            <div
                className="border-b border-amber-500/20 bg-amber-500/5 px-3 py-3"
                data-testid="approval-staging-area"
            >
                <p className="text-center text-[11px] text-zinc-500">Loading pending approvals\u2026</p>
            </div>
        )
    }

    if (pendingTokens.length === 0) return null

    const driftWarningCount = pendingTokens.filter((t) => driftWarnings.has(t.name)).length

    return (
        <div
            className="border-b border-amber-500/20 bg-amber-950/20"
            data-testid="approval-staging-area"
            role="region"
            aria-label="Tokens awaiting approval"
        >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-amber-500/10 px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-amber-300">
                    Awaiting approval
                </span>
                <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    {pendingTokens.length}
                </span>

                {driftWarningCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        {driftWarningCount} with drift risk
                    </span>
                )}

                <div className="ml-auto flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={handleApproveAll}
                        disabled={isBulkProcessing}
                        className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
                        aria-label="Approve all pending tokens"
                    >
                        <CheckCheck className="h-3 w-3" />
                        Approve all
                    </button>
                    <button
                        type="button"
                        onClick={handleRejectAll}
                        disabled={isBulkProcessing}
                        className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                        aria-label="Reject all pending tokens"
                    >
                        <XCircle className="h-3 w-3" />
                        Reject all
                    </button>
                </div>
            </div>

            {/* Pending token rows */}
            <div className="max-h-[200px] overflow-y-auto" role="list" aria-label="Pending token list">
                {pendingTokens.map((token) => (
                    <div key={token.name} role="listitem">
                        <PendingTokenRow
                            token={token}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            isProcessing={processingSet.has(token.name) || isBulkProcessing}
                            hasDriftWarning={driftWarnings.has(token.name)}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
