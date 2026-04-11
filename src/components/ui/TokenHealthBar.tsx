/**
 * TokenHealthBar — src/components/ui/TokenHealthBar.tsx
 *
 * MINT.1a: Compact health summary bar displayed above the token list.
 * Shows three indicator pills:
 *   - Total token count
 *   - Sync status (in sync / N drifted) when Figma is connected
 *   - Coverage (used in N files) when scanUsage data is available
 *
 * Renderer Process only — no Node.js imports.
 */

import type { SyncBadgeStatus } from './TokenGrid'

export interface TokenHealthBarProps {
    totalTokens: number
    syncStatuses: SyncBadgeStatus[]
    figmaConnected: boolean
    usageFileCount: number
}

export function TokenHealthBar({
    totalTokens,
    syncStatuses,
    figmaConnected,
    usageFileCount,
}: TokenHealthBarProps) {
    const driftedCount = syncStatuses.filter((s) => s === 'drifted').length
    const allSynced = figmaConnected && driftedCount === 0

    return (
        <div
            className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800/60 px-3 py-2"
            role="status"
            aria-label="Token health summary"
            data-testid="token-health-bar"
        >
            {/* Total tokens pill */}
            <span
                className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300"
                data-testid="health-total"
            >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
                {totalTokens} token{totalTokens !== 1 ? 's' : ''}
            </span>

            {/* Sync status pill — only when Figma is connected */}
            {figmaConnected && (
                <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        allSynced
                            ? 'bg-emerald-400/10 text-emerald-400'
                            : 'bg-amber-400/10 text-amber-400'
                    }`}
                    data-testid="health-sync"
                >
                    <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                            allSynced ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                    />
                    {allSynced ? 'In sync' : `${driftedCount} token${driftedCount !== 1 ? 's' : ''} drifted`}
                </span>
            )}

            {/* Coverage pill — only when usage data is available */}
            {usageFileCount > 0 && (
                <span
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400"
                    data-testid="health-coverage"
                >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                    Used in {usageFileCount} file{usageFileCount !== 1 ? 's' : ''}
                </span>
            )}
        </div>
    )
}
