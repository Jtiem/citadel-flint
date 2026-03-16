/**
 * OnboardingNudge — src/components/ui/OnboardingNudge.tsx
 *
 * A non-blocking contextual prompt card pinned above the right-panel tab bar.
 * Shown once after a new project is scaffolded, when the workspace is in its
 * "empty shell" state:
 *
 *   • The file tree has exactly one file (the starter template entry point)
 *   • No Figma design tokens have been imported yet
 *   • The user has not previously dismissed this nudge
 *
 * Dismissal is persisted to localStorage under 'bridge-onboarding-nudge-dismissed'
 * so it does not re-appear on subsequent opens of the same session.
 *
 * This component does NOT block the canvas or use a backdrop. It is purely
 * additive — a card that the user can act on or close.
 */

import { useState, useEffect } from 'react'
import { X, Figma, MousePointer2 } from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { useTokenStore } from '../../store/tokenStore'

const DISMISSED_KEY = 'bridge-onboarding-nudge-dismissed'

/** Count the total number of leaf files in the workspace tree. */
function countFiles(node: { type: string; children?: { type: string; children?: unknown[] }[] } | null): number {
    if (!node) return 0
    if (node.type === 'file') return 1
    return (node.children ?? []).reduce(
        (acc, child) => acc + countFiles(child as { type: string; children?: { type: string; children?: unknown[] }[] }),
        0
    )
}

interface OnboardingNudgeProps {
    /** Called when the user clicks "Connect Figma". */
    onConnectFigma?: () => void
    /** Called when the user clicks "Start editing" — should focus the canvas. */
    onStartEditing?: () => void
}

export function OnboardingNudge({ onConnectFigma, onStartEditing }: OnboardingNudgeProps) {
    const workspaceFiles = useCanvasStore((s) => s.workspaceFiles)
    const tokens = useTokenStore((s) => s.tokens)

    const [dismissed, setDismissed] = useState(() =>
        Boolean(localStorage.getItem(DISMISSED_KEY))
    )

    // Re-check localStorage in case another tab dismissed it
    useEffect(() => {
        if (localStorage.getItem(DISMISSED_KEY)) {
            setDismissed(true)
        }
    }, [])

    const fileCount = countFiles(workspaceFiles as Parameters<typeof countFiles>[0])
    const hasTokens = tokens.length > 0

    // Conditions: show only when workspace is in the "fresh scaffold" state
    const shouldShow =
        !dismissed &&
        workspaceFiles !== null &&
        fileCount <= 1 &&
        !hasTokens

    if (!shouldShow) return null

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, 'true')
        setDismissed(true)
    }

    const handleConnectFigma = () => {
        onConnectFigma?.()
        handleDismiss()
    }

    const handleStartEditing = () => {
        onStartEditing?.()
        handleDismiss()
    }

    return (
        <div
            className="mx-2 mb-2 rounded-lg border border-indigo-500/30 bg-indigo-950/50 p-3"
            role="status"
            aria-label="Getting started suggestions"
        >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-indigo-300">
                    Get started
                </p>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                    aria-label="Dismiss onboarding nudge"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Hint text */}
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                Your project is ready. Import tokens from Figma or start editing the canvas.
            </p>

            {/* Action buttons */}
            <div className="mt-2.5 flex flex-col gap-1.5">
                <button
                    type="button"
                    onClick={handleConnectFigma}
                    className="flex items-center gap-2 rounded border border-indigo-500/30 bg-indigo-600/20 px-2.5 py-1.5 text-[11px] font-medium text-indigo-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-600/30 hover:text-indigo-200"
                >
                    <Figma size={12} />
                    Connect Figma
                </button>
                <button
                    type="button"
                    onClick={handleStartEditing}
                    className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800/60 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700/60 hover:text-zinc-100"
                >
                    <MousePointer2 size={12} />
                    Start editing
                </button>
            </div>
        </div>
    )
}
