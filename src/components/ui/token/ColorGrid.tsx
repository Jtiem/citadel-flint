/**
 * ColorGrid — src/components/ui/token/ColorGrid.tsx
 *
 * Renders color tokens as a visual swatch grid (4–6 swatches per row).
 * The backgroundColor inline style is purely for displaying the token value
 * visually — it is NOT injecting Tailwind classes into governance logic.
 */

import type { DesignToken } from '../../../types/flint-api'

interface ColorGridProps {
    tokens: DesignToken[]
}

export function ColorGrid({ tokens }: ColorGridProps) {
    if (tokens.length === 0) return null

    return (
        <div className="grid grid-cols-5 gap-2 px-3 py-2" data-testid="color-grid">
            {tokens.map((token) => (
                <div
                    key={token.id}
                    className="flex flex-col items-center gap-1"
                    title={token.token_path}
                >
                    <div
                        role="img"
                        aria-label={`Color token: ${token.token_path}, value: ${token.token_value}`}
                        className="h-8 w-8 rounded border border-white/10 shadow-sm"
                        style={{ backgroundColor: token.token_value }}
                    />
                    <span className="max-w-full truncate text-center font-mono text-[9px] text-zinc-400" title={token.token_path}>
                        {token.token_path.split('.').pop()}
                    </span>
                    <span className="max-w-full truncate text-center font-mono text-[9px] text-zinc-500">
                        {token.token_value}
                    </span>
                </div>
            ))}
        </div>
    )
}
