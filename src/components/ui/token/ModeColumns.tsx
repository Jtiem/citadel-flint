/**
 * ModeColumns — src/components/ui/token/ModeColumns.tsx
 *
 * Groups tokens that share the same token_path and shows their values
 * side-by-side across mode columns (e.g. Light | Dark | High Contrast).
 * Only rendered when tokens actually have multiple modes.
 */

import { useMemo } from 'react'
import type { DesignToken } from '../../../types/flint-api'

interface ModeColumnsProps {
    tokens: DesignToken[]
}

interface TokenGroup {
    path: string
    byMode: Map<string, DesignToken>
}

export function ModeColumns({ tokens }: ModeColumnsProps) {
    const { modes, groups } = useMemo(() => {
        // Collect all distinct modes (preserving insertion order)
        const modeSet = new Set<string>()
        const groupMap = new Map<string, Map<string, DesignToken>>()

        for (const token of tokens) {
            modeSet.add(token.mode)
            if (!groupMap.has(token.token_path)) {
                groupMap.set(token.token_path, new Map())
            }
            groupMap.get(token.token_path)!.set(token.mode, token)
        }

        const groups: TokenGroup[] = [...groupMap.entries()].map(([path, byMode]) => ({
            path,
            byMode,
        }))

        return { modes: [...modeSet], groups }
    }, [tokens])

    if (groups.length === 0) return null

    return (
        <div className="overflow-x-auto" data-testid="mode-columns">
            {/* Column headers */}
            <div className="flex items-center border-b border-zinc-800 px-3 py-1.5">
                {/* Path column */}
                <div className="min-w-0 flex-1 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Token
                </div>
                {modes.map((mode) => (
                    <div
                        key={mode}
                        className="w-28 shrink-0 text-center font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-500"
                    >
                        {mode}
                    </div>
                ))}
            </div>

            {/* Token rows */}
            {groups.map((group) => (
                <div
                    key={group.path}
                    className="flex items-center border-b border-zinc-800/40 px-3 py-1.5 hover:bg-zinc-800/30"
                >
                    {/* Token path */}
                    <div
                        className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400"
                        title={group.path}
                    >
                        {group.path}
                    </div>

                    {/* Mode value cells */}
                    {modes.map((mode) => {
                        const token = group.byMode.get(mode)
                        if (!token) {
                            return (
                                <div key={mode} className="w-28 shrink-0 text-center font-mono text-[10px] text-zinc-700">
                                    —
                                </div>
                            )
                        }
                        return (
                            <div key={mode} className="flex w-28 shrink-0 items-center justify-center gap-1.5">
                                {token.token_type === 'color' && (
                                    <span
                                        role="img"
                                        aria-label={`Color token: ${token.token_path}, value: ${token.token_value}`}
                                        className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
                                        style={{ backgroundColor: token.token_value }}
                                    />
                                )}
                                <span
                                    className="truncate font-mono text-[9px] text-zinc-400"
                                    title={token.token_value}
                                >
                                    {token.token_value}
                                </span>
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}
