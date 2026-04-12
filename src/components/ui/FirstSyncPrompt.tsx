/**
 * FirstSyncPrompt — src/components/ui/FirstSyncPrompt.tsx
 *
 * MINT.4a: Prominent prompt shown when Figma connects for the first time
 * and tokens are pulled. Shows once per project, persists dismissal to
 * localStorage.
 *
 * "Your first Figma sync is ready. N tokens imported. Review them?"
 * One-click action to navigate to the Tokens tab.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useCallback, useEffect } from 'react'
import { ArrowRight, X, CheckCircle } from 'lucide-react'

// ── localStorage key builder ──────────────────────────────────────────────────

function dismissalKey(projectPath: string): string {
    return `flint:first-sync-dismissed:${projectPath}`
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface FirstSyncPromptProps {
    /** Whether Figma is currently connected with tokens. */
    figmaConnected: boolean
    /** Number of tokens imported from Figma. */
    tokenCount: number
    /** Current project path — used for per-project dismissal persistence. */
    projectPath: string
    /** Callback to navigate user to the Tokens tab. */
    onNavigateToTokens: () => void
}

// ── Component ────────────────────────────────────────────────────────────────

export function FirstSyncPrompt({
    figmaConnected,
    tokenCount,
    projectPath,
    onNavigateToTokens,
}: FirstSyncPromptProps) {
    const [dismissed, setDismissed] = useState(false)
    const [alreadyDismissed, setAlreadyDismissed] = useState(true)

    // Check localStorage on mount
    useEffect(() => {
        if (!projectPath) {
            setAlreadyDismissed(true)
            return
        }
        const key = dismissalKey(projectPath)
        const stored = localStorage.getItem(key)
        setAlreadyDismissed(stored === 'true')
    }, [projectPath])

    const handleDismiss = useCallback(() => {
        setDismissed(true)
        if (projectPath) {
            localStorage.setItem(dismissalKey(projectPath), 'true')
        }
    }, [projectPath])

    const handleReview = useCallback(() => {
        onNavigateToTokens()
        handleDismiss()
    }, [onNavigateToTokens, handleDismiss])

    // Don't show if: already dismissed, not connected, no tokens, or user dismissed this session
    if (alreadyDismissed || dismissed || !figmaConnected || tokenCount === 0) {
        return null
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 border-b border-emerald-500/30 bg-emerald-900/15 px-3 py-2.5"
            data-testid="first-sync-prompt"
        >
            <CheckCircle
                size={16}
                className="shrink-0 text-emerald-400"
                aria-hidden="true"
            />
            <span className="flex-1 text-xs text-emerald-300">
                Your first Figma sync is ready.{' '}
                <span className="font-medium" data-testid="first-sync-count">
                    {tokenCount} token{tokenCount !== 1 ? 's' : ''} imported
                </span>.{' '}
                Review them?
            </span>
            <button
                type="button"
                onClick={handleReview}
                className="flex shrink-0 items-center gap-1 rounded bg-emerald-600/80 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500"
                data-testid="first-sync-review-button"
            >
                Review tokens
                <ArrowRight size={11} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss first sync prompt"
                className="shrink-0 rounded p-0.5 text-emerald-500/60 transition-colors hover:text-emerald-300"
                data-testid="first-sync-dismiss"
            >
                <X size={14} aria-hidden="true" />
            </button>
        </div>
    )
}
