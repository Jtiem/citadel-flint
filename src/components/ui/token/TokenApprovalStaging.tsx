/**
 * TokenApprovalStaging — src/components/ui/token/TokenApprovalStaging.tsx
 *
 * MINT.3c: Displays pending tokens awaiting approval before merging into
 * the design token set. Each token shows name, value, source, and
 * Approve/Reject buttons.
 *
 * Only visible when pending tokens exist. Amber left border signals
 * items require attention.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useCallback } from 'react'
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import type { PendingToken } from '../../../types/flint-api'

interface TokenApprovalStagingProps {
    /** Called after a token is approved or rejected so the parent can refresh. */
    onTokenResolved?: () => void
}

export function TokenApprovalStaging({ onTokenResolved }: TokenApprovalStagingProps) {
    const [pending, setPending] = useState<PendingToken[]>([])
    const [collapsed, setCollapsed] = useState(false)
    const [processing, setProcessing] = useState<string | null>(null)

    const fetchPending = useCallback(async () => {
        const fn = window.flintAPI.tokens?.getPendingApprovals
        if (!fn) return
        try {
            const result = await fn()
            setPending(result)
        } catch {
            // IPC not wired — silent
        }
    }, [])

    useEffect(() => {
        fetchPending()
    }, [fetchPending])

    const handleApprove = async (tokenName: string) => {
        const fn = window.flintAPI.tokens?.approveToken
        if (!fn) return
        setProcessing(tokenName)
        try {
            await fn(tokenName)
            setPending((prev) => prev.filter((t) => t.name !== tokenName))
            onTokenResolved?.()
        } catch {
            // silent
        } finally {
            setProcessing(null)
        }
    }

    const handleReject = async (tokenName: string) => {
        const fn = window.flintAPI.tokens?.rejectToken
        if (!fn) return
        setProcessing(tokenName)
        try {
            await fn(tokenName)
            setPending((prev) => prev.filter((t) => t.name !== tokenName))
            onTokenResolved?.()
        } catch {
            // silent
        } finally {
            setProcessing(null)
        }
    }

    if (pending.length === 0) return null

    return (
        <div
            className="border-b border-zinc-800 border-l-2 border-l-amber-500 bg-zinc-900/60"
            data-testid="token-approval-staging"
        >
            {/* Header */}
            <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
                aria-expanded={!collapsed}
            >
                {collapsed ? (
                    <ChevronRight className="h-3 w-3 text-zinc-500" aria-hidden="true" />
                ) : (
                    <ChevronDown className="h-3 w-3 text-zinc-500" aria-hidden="true" />
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    {pending.length} pending approval{pending.length !== 1 ? 's' : ''}
                </span>
            </button>

            {/* Token list */}
            {!collapsed && (
                <div className="space-y-1 px-3 pb-2">
                    {pending.map((token) => (
                        <div
                            key={token.name}
                            className="flex items-center gap-2 rounded bg-zinc-800/60 px-2 py-1.5"
                            data-testid="pending-token-row"
                        >
                            {/* Color swatch if it looks like a hex color */}
                            {token.value.startsWith('#') && (
                                <div
                                    className="h-4 w-4 shrink-0 rounded border border-white/10"
                                    style={{ backgroundColor: token.value }}
                                    aria-hidden="true"
                                />
                            )}

                            <div className="min-w-0 flex-1">
                                <p className="truncate font-mono text-[10px] text-zinc-300">
                                    {token.name}
                                </p>
                                <p className="flex items-center gap-2 text-[9px] text-zinc-500">
                                    <span>{token.value}</span>
                                    <span className="rounded bg-zinc-700/50 px-1">{token.source}</span>
                                </p>
                            </div>

                            {/* Actions */}
                            <button
                                type="button"
                                onClick={() => handleApprove(token.name)}
                                disabled={processing === token.name}
                                className="rounded p-1 text-emerald-400 hover:bg-emerald-900/30 disabled:opacity-40"
                                aria-label={`Approve ${token.name}`}
                                title="Approve"
                            >
                                <Check className="h-3 w-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReject(token.name)}
                                disabled={processing === token.name}
                                className="rounded p-1 text-red-400 hover:bg-red-900/30 disabled:opacity-40"
                                aria-label={`Reject ${token.name}`}
                                title="Reject"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
