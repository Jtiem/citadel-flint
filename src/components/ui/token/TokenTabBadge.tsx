/**
 * TokenTabBadge — src/components/ui/token/TokenTabBadge.tsx
 *
 * MINT.2d: Small amber badge showing drifted token count.
 * Designed to be rendered next to the "Tokens" tab label in App.tsx.
 *
 * Usage in App.tsx (Group A should wire this):
 *   import { TokenTabBadge } from './components/ui/token/TokenTabBadge'
 *   // In the tab header: <span>Tokens <TokenTabBadge count={driftCount} /></span>
 *
 * Renderer Process only — no Node.js imports.
 */

interface TokenTabBadgeProps {
    /** Number of tokens drifted from Figma. Hidden when 0. */
    count: number
}

export function TokenTabBadge({ count }: TokenTabBadgeProps) {
    if (count <= 0) return null

    return (
        <span
            className="ml-1 inline-flex items-center rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-medium tabular-nums text-amber-400"
            title={`${count} token${count !== 1 ? 's' : ''} drifted from Figma`}
            data-testid="token-drift-badge"
        >
            {count}
        </span>
    )
}
