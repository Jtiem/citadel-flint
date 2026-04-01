/**
 * TokenDetailView — src/components/ui/token/TokenDetailView.tsx
 *
 * MINT.4d: Slide-out panel showing per-token detail: large swatch, usage files,
 * contrast pairs involving this token, drift info, and provenance.
 *
 * 320px wide, slides in from the right edge of the TokenPanel.
 * Close with the X button or the Escape key.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { DesignToken, TokenUsageResult, ContrastPair } from '../../../types/flint-api'

interface TokenDetailViewProps {
    token: DesignToken
    /** Usage data for this token, if available. */
    usage?: TokenUsageResult
    /** Contrast pairs involving this token (as fg or bg). */
    contrastPairs?: ContrastPair[]
    /** Drift info if this token has drifted from Figma. */
    drift?: { localValue: string; figmaValue: string }
    onClose: () => void
}

export function TokenDetailView({
    token,
    usage,
    contrastPairs,
    drift,
    onClose,
}: TokenDetailViewProps) {
    const panelRef = useRef<HTMLDivElement>(null)

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose])

    // Focus trap: focus the panel on mount
    useEffect(() => {
        panelRef.current?.focus()
    }, [])

    const isColor = token.token_type === 'color' && token.token_value.startsWith('#')

    // Filter contrast pairs for this token
    const relevantPairs = contrastPairs?.filter(
        (p) => p.fg === token.token_path || p.bg === token.token_path,
    ) ?? []
    const failingPairs = relevantPairs.filter((p) => !p.passAA)

    return (
        <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label={`Token detail: ${token.token_path}`}
            className="absolute inset-y-0 right-0 z-10 flex w-80 flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl outline-none"
            data-testid="token-detail-view"
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                <span className="truncate font-mono text-[11px] font-semibold text-zinc-200">
                    {token.token_path}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    aria-label="Close detail view"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-4">
                {/* Large swatch */}
                {isColor && (
                    <div className="flex flex-col items-center gap-2">
                        <div
                            className="h-20 w-20 rounded-lg border border-white/10 shadow-lg"
                            style={{ backgroundColor: token.token_value }}
                            role="img"
                            aria-label={`Color: ${token.token_value}`}
                            data-testid="detail-swatch"
                        />
                        <span className="font-mono text-xs text-zinc-400">
                            {token.token_value}
                        </span>
                    </div>
                )}

                {/* Non-color value display */}
                {!isColor && (
                    <div className="rounded bg-zinc-900 px-3 py-2">
                        <p className="font-mono text-sm text-zinc-200">{token.token_value}</p>
                    </div>
                )}

                {/* Metadata */}
                <div className="space-y-1.5">
                    <DetailRow label="Type" value={token.token_type} />
                    <DetailRow label="Collection" value={token.collection_name} />
                    <DetailRow label="Mode" value={token.mode} />
                    {token.description && (
                        <DetailRow label="Description" value={token.description} />
                    )}
                </div>

                {/* Drift info */}
                {drift && (
                    <div data-testid="detail-drift">
                        <SectionHeader title="Drift from Figma" />
                        <div className="flex items-center gap-3 rounded bg-amber-900/20 px-2 py-1.5">
                            {isColor && (
                                <>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <div
                                            className="h-6 w-6 rounded border border-white/10"
                                            style={{ backgroundColor: drift.localValue }}
                                            aria-hidden="true"
                                        />
                                        <span className="text-[9px] text-zinc-500">Local</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500">vs</span>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <div
                                            className="h-6 w-6 rounded border border-white/10"
                                            style={{ backgroundColor: drift.figmaValue }}
                                            aria-hidden="true"
                                        />
                                        <span className="text-[9px] text-zinc-500">Figma</span>
                                    </div>
                                </>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-amber-300">
                                    {drift.localValue} (local) vs {drift.figmaValue} (Figma)
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Usage files */}
                {usage && (
                    <div data-testid="detail-usage">
                        <SectionHeader title={`Usage (${usage.usageCount} file${usage.usageCount !== 1 ? 's' : ''})`} />
                        {usage.usageCount === 0 ? (
                            <p className="text-[10px] text-red-400">Unused across all project files</p>
                        ) : (
                            <ul className="space-y-0.5">
                                {usage.files.map((f) => (
                                    <li
                                        key={f}
                                        className="truncate font-mono text-[10px] text-zinc-400"
                                        title={f}
                                    >
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Contrast pairs */}
                {relevantPairs.length > 0 && (
                    <div data-testid="detail-contrast">
                        <SectionHeader
                            title={`Contrast (${failingPairs.length} issue${failingPairs.length !== 1 ? 's' : ''})`}
                        />
                        <div className="space-y-1">
                            {relevantPairs.slice(0, 8).map((pair, i) => (
                                <div
                                    key={`${pair.fg}-${pair.bg}-${i}`}
                                    className="flex items-center gap-2 text-[10px]"
                                >
                                    <div
                                        className="h-4 w-4 rounded border border-white/10"
                                        style={{ backgroundColor: pair.fgValue }}
                                        aria-hidden="true"
                                    />
                                    <div
                                        className="h-4 w-4 rounded border border-white/10"
                                        style={{ backgroundColor: pair.bgValue }}
                                        aria-hidden="true"
                                    />
                                    <span className="font-mono text-zinc-400">
                                        {pair.ratio.toFixed(2)}:1
                                    </span>
                                    {pair.passAA ? (
                                        <span className="rounded bg-emerald-900/30 px-1 text-emerald-400">
                                            AA
                                        </span>
                                    ) : (
                                        <span className="rounded bg-red-900/30 px-1 text-red-400">
                                            Fails AA
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
    return (
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {title}
        </h4>
    )
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] text-zinc-500">{label}</span>
            <span className="truncate text-right font-mono text-[10px] text-zinc-300">{value}</span>
        </div>
    )
}
