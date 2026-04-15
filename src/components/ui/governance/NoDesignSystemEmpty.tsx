/**
 * NoDesignSystemEmpty.tsx — C18 — extracted from GovernanceDashboard (Sprint 2 refactor)
 *
 * Empty state shown when no design system / tokens are loaded.
 * Prompts the user to import tokens. Pure presentational.
 *
 * Source lines: GovernanceDashboard.tsx ~1688-1704
 */

import { ShieldOff } from 'lucide-react'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NoDesignSystemEmptyProps {
    /** Show the empty state (true when tokenCount === 0). */
    visible: boolean
    /** Called when the user clicks "Import Tokens". */
    onImportTokens: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NoDesignSystemEmpty({ visible, onImportTokens }: NoDesignSystemEmptyProps) {
    if (!visible) return null

    return (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center border-b border-zinc-800">
            <ShieldOff className="h-8 w-8 text-zinc-600 mb-3" aria-hidden="true" />
            <p className="text-sm text-zinc-400 leading-relaxed max-w-[240px]">
                Health score measures against your design tokens. Connect Figma or import tokens to start measuring.
            </p>
            <button
                type="button"
                onClick={onImportTokens}
                className="mt-4 rounded border border-indigo-500/40 bg-indigo-900/20 px-3 py-1.5 text-xs text-indigo-400 transition-colors hover:bg-indigo-900/40 hover:text-indigo-300"
            >
                Import Tokens
            </button>
        </div>
    )
}
