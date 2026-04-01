/**
 * ColorGrid — src/components/ui/token/ColorGrid.tsx
 *
 * Renders color tokens as a visual swatch grid (4–6 swatches per row).
 * The backgroundColor inline style is purely for displaying the token value
 * visually — it is NOT injecting Tailwind classes into governance logic.
 *
 * MINT.2b: Usage count badges and dead-token indicators per swatch.
 * MINT.2c: Amber drift dot when token value differs from Figma.
 */

import type { DesignToken, TokenUsageResult } from '../../../types/flint-api'

interface ColorGridProps {
    tokens: DesignToken[]
    /** MINT.2b: Per-token usage map (tokenName → usage result). Optional. */
    usageMap?: Map<string, TokenUsageResult>
    /** MINT.2c: Per-token drift info (tokenPath → { localValue, figmaValue }). Optional. */
    driftMap?: Map<string, { localValue: string; figmaValue: string }>
}

export function ColorGrid({ tokens, usageMap, driftMap }: ColorGridProps) {
    if (tokens.length === 0) return null

    return (
        <div className="grid grid-cols-5 gap-2 px-3 py-2" data-testid="color-grid">
            {tokens.map((token) => {
                const usage = usageMap?.get(token.token_path)
                const drift = driftMap?.get(token.token_path)
                const isDead = usage !== undefined && usage.usageCount === 0

                return (
                    <div
                        key={token.id}
                        className="flex flex-col items-center gap-1"
                        title={token.token_path}
                    >
                        {/* Swatch with optional drift dot */}
                        <div className="relative">
                            <div
                                role="img"
                                aria-label={`Color token: ${token.token_path}, value: ${token.token_value}`}
                                className="h-8 w-8 rounded border border-white/10 shadow-sm"
                                style={{ backgroundColor: token.token_value }}
                            />
                            {/* MINT.2c: Drift indicator */}
                            {drift && (
                                <span
                                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400"
                                    title={`Drifted from Figma \u2014 local: ${drift.localValue}, Figma: ${drift.figmaValue}`}
                                    data-testid="drift-indicator"
                                    aria-label={`Token drifted: local ${drift.localValue}, Figma ${drift.figmaValue}`}
                                />
                            )}
                        </div>

                        <span className="max-w-full truncate text-center font-mono text-[9px] text-zinc-400" title={token.token_path}>
                            {token.token_path.split('.').pop()}
                        </span>
                        <span className="max-w-full truncate text-center font-mono text-[9px] text-zinc-500">
                            {token.token_value}
                        </span>

                        {/* MINT.2b: Usage badge or dead-token indicator */}
                        {usage !== undefined && (
                            isDead ? (
                                <span
                                    className="rounded bg-red-900/20 px-1 text-[10px] text-red-400"
                                    data-testid="dead-token-badge"
                                >
                                    Unused
                                </span>
                            ) : (
                                <span
                                    className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-500"
                                    data-testid="usage-count-badge"
                                >
                                    &times;{usage.usageCount}
                                </span>
                            )
                        )}
                    </div>
                )
            })}
        </div>
    )
}
