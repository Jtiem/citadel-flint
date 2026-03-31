/**
 * SpacingRuler — src/components/ui/token/SpacingRuler.tsx
 *
 * Renders spacing/dimension tokens as proportional horizontal bars.
 * Bar width is proportional to the numeric value, capped at the largest
 * dimension in the set.
 */

import { useMemo } from 'react'
import type { DesignToken } from '../../../types/flint-api'

interface SpacingRulerProps {
    tokens: DesignToken[]
}

function parseDimensionNumber(value: string): number {
    const m = /^(\d+(?:\.\d+)?)/.exec(value)
    return m ? parseFloat(m[1]) : 0
}

const MIN_BAR_PX = 4
const MAX_BAR_PX = 180

export function SpacingRuler({ tokens }: SpacingRulerProps) {
    if (tokens.length === 0) return null

    const maxValue = useMemo(() => {
        const nums = tokens.map((t) => parseDimensionNumber(t.token_value))
        return Math.max(...nums, 1)
    }, [tokens])

    return (
        <div className="flex flex-col gap-1 px-3 py-2" data-testid="spacing-ruler">
            {tokens.map((token) => {
                const num = parseDimensionNumber(token.token_value)
                const barWidth = Math.max(MIN_BAR_PX, Math.round((num / maxValue) * MAX_BAR_PX))
                return (
                    <div
                        key={token.id}
                        className="flex items-center gap-3"
                        aria-label={`Spacing ${token.token_path}: ${token.token_value}`}
                    >
                        <div
                            className="h-2 shrink-0 rounded-sm bg-indigo-400/40"
                            style={{ width: barWidth }}
                        />
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-mono text-[10px] text-zinc-400">{token.token_path}</span>
                            <span className="font-mono text-[10px] text-zinc-500">{token.token_value}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
