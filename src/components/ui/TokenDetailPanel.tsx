/**
 * TokenDetailPanel — src/components/ui/TokenDetailPanel.tsx
 *
 * MINT.4d: Per-token detail view. Slides in from the right when a token
 * is clicked in the grid/list. Shows:
 *   - Full token path
 *   - Current value (with visual swatch for colors)
 *   - Usage count + file list
 *   - Contrast pairings (when available)
 *   - Drift status (local vs Figma)
 *   - Provenance (collection, mode, source)
 *
 * Close with Escape or X button.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useRef } from 'react'
import { X, FileText, Palette, Layers, AlertTriangle, CheckCircle } from 'lucide-react'
import type { DesignToken, TokenUsageResult, ContrastPair } from '../../types/flint-api'
import type { TokenDrift } from '../../hooks/useTokenUsage'
import type { SyncBadgeStatus } from './TokenGrid'
import { FocusTrap } from './FocusTrap'

// ── Props ────────────────────────────────────────────────────────────────────

export interface TokenDetailPanelProps {
    token: DesignToken
    /** Close the detail panel. */
    onClose: () => void
    /** Usage data for this token. */
    usageResult?: TokenUsageResult | null
    /** Drift data if this token has drifted from Figma. */
    drift?: TokenDrift | null
    /** Sync status badge. */
    syncStatus?: SyncBadgeStatus | null
    /** Contrast pairs involving this token. */
    contrastPairs?: ContrastPair[]
    /** Dark mode counterpart token (if any). */
    darkModeToken?: DesignToken | null
}

// ── Component ────────────────────────────────────────────────────────────────

export function TokenDetailPanel({
    token,
    onClose,
    usageResult,
    drift,
    syncStatus,
    contrastPairs,
    darkModeToken,
}: TokenDetailPanelProps) {
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    const isColor = token.token_type === 'color'
    const usageCount = usageResult?.usageCount ?? 0
    const files = usageResult?.files ?? []

    return (
        <FocusTrap initialFocusRef={closeButtonRef} onClose={onClose}>
        <div
            className="fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-zinc-700 bg-zinc-900 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Token detail: ${token.token_path}`}
            data-testid="token-detail-panel"
        >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h3 className="truncate text-sm font-semibold text-zinc-100">
                    Token Detail
                </h3>
                <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close token detail panel"
                    className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-300"
                    data-testid="token-detail-close"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {/* Token path */}
                <section>
                    <SectionLabel label="Token path" />
                    <p
                        className="mt-1 break-all font-mono text-xs text-zinc-200"
                        data-testid="token-detail-path"
                    >
                        {token.token_path}
                    </p>
                </section>

                {/* Current value */}
                <section>
                    <SectionLabel label="Value" />
                    <div className="mt-1.5 flex items-center gap-2">
                        {isColor && (
                            <span
                                className="inline-block h-8 w-8 shrink-0 rounded-lg border border-white/20 shadow-sm"
                                style={{ backgroundColor: token.token_value }}
                                aria-label={`Color swatch: ${token.token_value}`}
                                role="img"
                                data-testid="token-detail-swatch"
                            />
                        )}
                        <span
                            className="font-mono text-sm text-zinc-200"
                            data-testid="token-detail-value"
                        >
                            {token.token_value}
                        </span>
                    </div>
                    {/* Dark mode counterpart */}
                    {darkModeToken && (
                        <div className="mt-2 flex items-center gap-2">
                            {isColor && (
                                <span
                                    className="inline-block h-6 w-6 shrink-0 rounded border border-white/20 shadow-sm"
                                    style={{ backgroundColor: darkModeToken.token_value }}
                                    aria-label={`Dark mode swatch: ${darkModeToken.token_value}`}
                                    role="img"
                                />
                            )}
                            <span className="text-xs text-zinc-400">
                                Dark: {darkModeToken.token_value}
                            </span>
                        </div>
                    )}
                </section>

                {/* Usage */}
                <section>
                    <SectionLabel label="Usage" />
                    <div className="mt-1.5" data-testid="token-detail-usage">
                        {usageCount === 0 ? (
                            <div className="flex items-center gap-1.5 text-xs text-red-400">
                                <AlertTriangle size={12} aria-hidden="true" />
                                Not used in any file (dead token)
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-zinc-300">
                                    Used in{' '}
                                    <span className="font-medium text-zinc-100">
                                        {usageCount} file{usageCount !== 1 ? 's' : ''}
                                    </span>
                                </p>
                                {files.length > 0 && (
                                    <ul className="mt-1.5 space-y-0.5" data-testid="token-detail-file-list">
                                        {files.slice(0, 10).map((f) => (
                                            <li
                                                key={f}
                                                className="flex items-center gap-1.5 truncate text-[11px] text-zinc-400"
                                            >
                                                <FileText size={10} className="shrink-0 text-zinc-600" aria-hidden="true" />
                                                {f}
                                            </li>
                                        ))}
                                        {files.length > 10 && (
                                            <li className="text-[11px] text-zinc-500">
                                                and {files.length - 10} more
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                </section>

                {/* Drift status */}
                {drift && (
                    <section data-testid="token-detail-drift">
                        <SectionLabel label="Drift" />
                        <div className="mt-1.5 rounded border border-amber-500/20 bg-amber-900/10 px-3 py-2 text-xs">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={12} className="shrink-0 text-amber-400" aria-hidden="true" />
                                <span className="text-amber-300">Drifted from Figma</span>
                            </div>
                            <div className="mt-1.5 grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-[10px] text-zinc-500">Local</span>
                                    <p className="font-mono text-xs text-zinc-300">{drift.localValue}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-zinc-500">Figma</span>
                                    <p className="font-mono text-xs text-zinc-300">{drift.figmaValue}</p>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Sync status */}
                {syncStatus && (
                    <section data-testid="token-detail-sync">
                        <SectionLabel label="Sync" />
                        <div className="mt-1.5 flex items-center gap-2 text-xs">
                            {syncStatus === 'synced' && (
                                <>
                                    <CheckCircle size={12} className="text-emerald-400" aria-hidden="true" />
                                    <span className="text-emerald-400">In sync with Figma</span>
                                </>
                            )}
                            {syncStatus === 'local-only' && (
                                <>
                                    <Layers size={12} className="text-zinc-400" aria-hidden="true" />
                                    <span className="text-zinc-400">Local only (not in Figma)</span>
                                </>
                            )}
                            {syncStatus === 'drifted' && (
                                <>
                                    <AlertTriangle size={12} className="text-amber-400" aria-hidden="true" />
                                    <span className="text-amber-400">Drifted from Figma</span>
                                </>
                            )}
                            {syncStatus === 'figma-only' && (
                                <>
                                    <Palette size={12} className="text-blue-400" aria-hidden="true" />
                                    <span className="text-blue-400">Figma only (not local)</span>
                                </>
                            )}
                        </div>
                    </section>
                )}

                {/* Contrast pairings */}
                {contrastPairs && contrastPairs.length > 0 && (
                    <section data-testid="token-detail-contrast">
                        <SectionLabel label="Contrast pairings" />
                        <div className="mt-1.5 space-y-1">
                            {contrastPairs.slice(0, 5).map((pair, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-800/40 px-2 py-1.5 text-[11px]"
                                >
                                    <span className="truncate text-zinc-300">
                                        vs {pair.bg}
                                    </span>
                                    <span
                                        className={`shrink-0 font-medium ${
                                            pair.passAAA
                                                ? 'text-emerald-400'
                                                : pair.passAA
                                                    ? 'text-emerald-400'
                                                    : 'text-red-400'
                                        }`}
                                    >
                                        {pair.ratio.toFixed(1)}:1{' '}
                                        {pair.passAAA ? 'AAA' : pair.passAA ? 'AA' : 'Fail'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Provenance */}
                <section data-testid="token-detail-provenance">
                    <SectionLabel label="Provenance" />
                    <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                        <dt className="text-zinc-500">Collection</dt>
                        <dd className="text-zinc-300">{token.collection_name}</dd>
                        <dt className="text-zinc-500">Mode</dt>
                        <dd className="text-zinc-300">{token.mode}</dd>
                        <dt className="text-zinc-500">Type</dt>
                        <dd className="text-zinc-300">{token.token_type}</dd>
                        {token.description && (
                            <>
                                <dt className="text-zinc-500">Description</dt>
                                <dd className="text-zinc-300">{token.description}</dd>
                            </>
                        )}
                    </dl>
                </section>
            </div>
        </div>
        </FocusTrap>
    )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
    return (
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
        </span>
    )
}
