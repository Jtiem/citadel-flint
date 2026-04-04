/**
 * TokenDetailView — src/components/ui/token/TokenDetailView.tsx
 *
 * MINT.4d: Slide-out panel showing per-token detail: large swatch, usage files,
 * contrast pairs involving this token, drift info, and provenance.
 *
 * MINT.3d: A11y insights — motion tip (animation/transition tokens),
 * scale tip (spacing/size/radius tokens), mode switcher.
 *
 * MINT.4c: Scale gap analysis — show prev/next neighbors in the scale.
 *
 * MINT.4e: Alias chain display — resolve aliasOf chains up to depth 10.
 *
 * 320px wide, slides in from the right edge of the TokenPanel.
 * Close with the X button or the Escape key.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { DesignToken, TokenUsageResult, ContrastPair } from '../../../types/flint-api'

// ── Extended token type used by MINT features ────────────────────────────────

type ExtendedToken = DesignToken & {
    aliasOf?: string
    modes?: Record<string, string>
}

interface TokenDetailViewProps {
    token: ExtendedToken
    /** All tokens in the project — used for alias chain resolution and scale context. */
    allTokens?: ExtendedToken[]
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
    allTokens,
    usage,
    contrastPairs,
    drift,
    onClose,
}: TokenDetailViewProps) {
    const panelRef = useRef<HTMLDivElement>(null)

    // MINT.3d: Mode switcher state
    const [activeMode, setActiveMode] = useState<string>(() => {
        const modeKeys = Object.keys(token.modes ?? {})
        return modeKeys[0] ?? 'default'
    })

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

    // Effective value (may be overridden by mode switcher)
    const modes = token.modes ?? {}
    const hasModes = Object.keys(modes).length > 0
    const effectiveValue = hasModes && modes[activeMode] !== undefined
        ? modes[activeMode]
        : token.token_value

    const isColor = token.token_type === 'color' && effectiveValue.startsWith('#')

    // Filter contrast pairs for this token
    const relevantPairs = contrastPairs?.filter(
        (p) => p.fg === token.token_path || p.bg === token.token_path,
    ) ?? []
    const failingPairs = relevantPairs.filter((p) => !p.passAA)

    // ── MINT.4e: Alias chain resolution ─────────────────────────────────────
    const aliasChain = buildAliasChain(token, allTokens ?? [])

    // ── MINT.4c: Scale gap analysis ──────────────────────────────────────────
    const scaleContext = buildScaleContext(token, allTokens ?? [])

    // ── MINT.3d: A11y insights flags ─────────────────────────────────────────
    const path = token.token_path.toLowerCase()
    const isMotionToken = /animation|transition|duration|delay/.test(path)
    const isScaleToken = /spacing|size|radius|border\.radius/.test(path) && token.token_type === 'dimension'
    const hasA11yInsights = isMotionToken || isScaleToken

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
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-4">
                {/* MINT.3d: Mode switcher */}
                {hasModes && (
                    <div
                        className="flex gap-1"
                        data-testid="detail-mode-switcher"
                        role="tablist"
                        aria-label="Token modes"
                    >
                        {Object.keys(modes).map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                role="tab"
                                aria-selected={activeMode === mode}
                                onClick={() => setActiveMode(mode)}
                                className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                                    activeMode === mode
                                        ? 'bg-zinc-700 text-zinc-200'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                )}

                {/* Large swatch */}
                {isColor && (
                    <div className="flex flex-col items-center gap-2">
                        <div
                            className="h-20 w-20 rounded-lg border border-white/10 shadow-lg"
                            style={{ backgroundColor: effectiveValue }}
                            role="img"
                            aria-label={`Color: ${effectiveValue}`}
                            data-testid="detail-swatch"
                        />
                        <span className="font-mono text-xs text-zinc-400">
                            {effectiveValue}
                        </span>
                    </div>
                )}

                {/* Non-color value display */}
                {!isColor && (
                    <div className="rounded bg-zinc-900 px-3 py-2">
                        <p className="font-mono text-sm text-zinc-200" data-testid="detail-value">
                            {token.token_value}
                        </p>
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

                {/* MINT.4e: Alias chain */}
                {aliasChain.length > 0 && (
                    <div data-testid="detail-alias-chain">
                        <SectionHeader title="Alias Chain" />
                        <ol className="space-y-0.5">
                            {aliasChain.map((segment, i) => (
                                <li
                                    key={`${segment}-${i}`}
                                    className="flex items-center gap-1 font-mono text-[10px]"
                                >
                                    {i > 0 && (
                                        <span className="text-zinc-600" aria-hidden="true">→</span>
                                    )}
                                    <span className={i === 0 ? 'text-zinc-300' : 'text-zinc-500'}>
                                        {segment}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}

                {/* MINT.4c: Scale gap analysis */}
                {scaleContext && (
                    <div data-testid="detail-scale-context">
                        <SectionHeader title="Scale Context" />
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                            <span className="text-zinc-500">{scaleContext.prev ?? '—'}</span>
                            <span className="text-zinc-600" aria-hidden="true">‹</span>
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                                {scaleContext.current}
                            </span>
                            <span className="text-zinc-600" aria-hidden="true">›</span>
                            <span className="text-zinc-500">{scaleContext.next ?? '—'}</span>
                        </div>
                    </div>
                )}

                {/* MINT.3d: A11y insights */}
                {hasA11yInsights && (
                    <details
                        open
                        data-testid="detail-a11y-insights"
                    >
                        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-indigo-400 outline-none">
                            A11y Insights
                        </summary>
                        <div className="mt-2 space-y-2">
                            {isMotionToken && (
                                <div
                                    className="rounded bg-indigo-900/20 px-2 py-1.5"
                                    data-testid="detail-motion-tip"
                                >
                                    <p className="text-[10px] text-indigo-300">
                                        Respect <code className="font-mono">prefers-reduced-motion</code> when using this token.
                                        Wrap motion in <code className="font-mono">@media (prefers-reduced-motion: no-preference)</code>.
                                    </p>
                                </div>
                            )}
                            {isScaleToken && (
                                <div
                                    className="rounded bg-emerald-900/20 px-2 py-1.5"
                                    data-testid="detail-scale-tip"
                                >
                                    <p className="text-[10px] text-emerald-300">
                                        WCAG 1.4.4 (Resize Text): ensure UI remains functional at 200% zoom.
                                        Use relative units (rem/em) instead of px where possible.
                                    </p>
                                </div>
                            )}
                        </div>
                    </details>
                )}

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

/**
 * MINT.4e: Build the full alias chain starting from the given token.
 * Returns an array of token_path strings in resolution order, starting with
 * the original token. Returns an empty array if the token has no aliasOf.
 */
function buildAliasChain(
    token: ExtendedToken,
    allTokens: ExtendedToken[],
    maxDepth = 10,
): string[] {
    if (!token.aliasOf) return []

    const chain: string[] = [token.token_path]
    const seen = new Set<string>([token.token_path])

    let currentAlias: string | undefined = token.aliasOf
    let depth = 0

    while (currentAlias && depth < maxDepth) {
        if (seen.has(currentAlias)) break // cycle guard
        chain.push(currentAlias)
        seen.add(currentAlias)

        const next = allTokens.find((t) => t.token_path === currentAlias)
        currentAlias = next?.aliasOf
        depth++
    }

    return chain
}

/**
 * MINT.4c: Build scale context (prev / current / next) for dimension tokens
 * in a spacing/size/radius scale group.
 */
function buildScaleContext(
    token: ExtendedToken,
    allTokens: ExtendedToken[],
): { prev: string | null; current: string; next: string | null } | null {
    if (token.token_type !== 'dimension') return null

    // Determine the scale group prefix — e.g. "spacing", "size", "icon.size", "border.radius"
    const path = token.token_path
    const scalePattern = /^(spacing|size|icon\.size|border\.radius)\./
    if (!scalePattern.test(path)) return null

    const prefix = path.replace(/\.[^.]+$/, '') // everything before the last segment

    // Collect all tokens in the same scale group
    const siblings = allTokens
        .filter((t) => t.token_type === 'dimension' && t.token_path.startsWith(prefix + '.'))
        .sort((a, b) => parsePx(a.token_value) - parsePx(b.token_value))

    if (siblings.length < 2) return null

    const idx = siblings.findIndex((t) => t.token_path === token.token_path)
    if (idx === -1) return null

    return {
        prev: siblings[idx - 1]?.token_value ?? null,
        current: token.token_value,
        next: siblings[idx + 1]?.token_value ?? null,
    }
}

function parsePx(value: string): number {
    const num = parseFloat(value)
    return isNaN(num) ? 0 : num
}
