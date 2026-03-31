/**
 * TypographySpecimen — src/components/ui/token/TypographySpecimen.tsx
 *
 * Renders typography tokens as live specimen previews. The inline style
 * on the specimen text is purely for display — not governance class injection.
 */

import type { DesignToken } from '../../../types/flint-api'

interface TypographySpecimenProps {
    tokens: DesignToken[]
}

/** Builds an inline style from a typography token for the specimen preview. */
function buildSpecimenStyle(token: DesignToken): React.CSSProperties {
    switch (token.token_type) {
        case 'fontFamily':
            return { fontFamily: token.token_value }
        case 'fontWeight':
            return { fontWeight: token.token_value }
        case 'lineHeight':
            return { lineHeight: token.token_value }
        case 'letterSpacing':
            return { letterSpacing: token.token_value }
        default:
            return {}
    }
}

export function TypographySpecimen({ tokens }: TypographySpecimenProps) {
    if (tokens.length === 0) return null

    return (
        <div className="flex flex-col divide-y divide-zinc-800/60" data-testid="typography-specimen">
            {tokens.map((token) => (
                <div key={token.id} className="px-3 py-2">
                    <p
                        className="truncate text-sm text-zinc-200"
                        style={buildSpecimenStyle(token)}
                        title={`${token.token_path}: ${token.token_value}`}
                    >
                        The quick brown fox
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="font-mono text-[10px] text-zinc-400">{token.token_path}</span>
                        <span className="font-mono text-[10px] text-zinc-500">{token.token_value}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}
