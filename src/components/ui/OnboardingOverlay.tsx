/**
 * OnboardingOverlay — src/components/ui/OnboardingOverlay.tsx
 *
 * Lightweight 3-step tooltip overlay shown once on first project open.
 * Reads/writes `bridge-onboarding-complete` in localStorage to track
 * completion state across sessions.
 *
 * Steps:
 *   1. "Your Canvas"     — explains the infinite canvas / live preview
 *   2. "Inspect & Edit"  — explains the properties / governance sidebar
 *   3. "Talk to Bridge"  — explains the MCP chat interface
 *
 * Mount it in the top-level IDE layout. It self-unmounts once the user
 * clicks "Got it" on the final step.
 */

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'bridge-onboarding-complete'

interface Step {
    title: string
    body: string
    /** Which side of the screen the tooltip card anchors to. */
    side: 'center' | 'right'
}

const STEPS: Step[] = [
    {
        title: 'Your Canvas',
        body: 'This is your infinite canvas with a live preview of your components. Pan and zoom freely — your work is always auto-saved.',
        side: 'center',
    },
    {
        title: 'Inspect & Edit',
        body: 'Select any element to view its properties, design tokens, and governance status. Mithril warnings appear here when a token drifts beyond the ΔE threshold.',
        side: 'right',
    },
    {
        title: 'Talk to Bridge',
        body: 'Use the chat panel to ask Bridge to audit, fix, or generate components via MCP. It has full context of your open file and selected node.',
        side: 'right',
    },
]

interface OnboardingOverlayProps {
    /** Called after the user dismisses or completes the overlay. */
    onDismiss?: () => void
}

export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
    const [visible, setVisible] = useState(false)
    const [step, setStep] = useState(0)

    // Only show when localStorage flag is absent
    useEffect(() => {
        if (!localStorage.getItem(STORAGE_KEY)) {
            setVisible(true)
        }
    }, [])

    if (!visible) return null

    const current = STEPS[step]
    const isLast = step === STEPS.length - 1

    const handleNext = () => {
        if (isLast) {
            complete()
        } else {
            setStep((s) => s + 1)
        }
    }

    const complete = () => {
        localStorage.setItem(STORAGE_KEY, 'true')
        setVisible(false)
        onDismiss?.()
    }

    // ── Tooltip horizontal position ───────────────────────────────────────────
    const tooltipPositionClass =
        current.side === 'right'
            ? 'right-72 top-1/2 -translate-y-1/2'
            : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'

    return (
        // Full-screen backdrop
        <div className="fixed inset-0 z-50 bg-black/50">
            {/* Tooltip card */}
            <div
                className={`absolute ${tooltipPositionClass} w-72 rounded-lg border border-indigo-500 bg-zinc-900 p-4 shadow-xl shadow-black/40`}
            >
                {/* Dismiss button */}
                <button
                    type="button"
                    onClick={complete}
                    className="absolute right-2 top-2 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                    aria-label="Skip onboarding"
                >
                    <X size={14} />
                </button>

                {/* Step counter */}
                <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-indigo-400">
                    Step {step + 1} of {STEPS.length}
                </p>

                {/* Title */}
                <h2 className="mb-1.5 text-sm font-semibold text-zinc-100">
                    {current.title}
                </h2>

                {/* Body */}
                <p className="text-xs leading-relaxed text-zinc-400">{current.body}</p>

                {/* Step dots + action button */}
                <div className="mt-4 flex items-center justify-between">
                    {/* Dot indicators */}
                    <div className="flex items-center gap-1.5">
                        {STEPS.map((_, i) => (
                            <span
                                key={i}
                                className={`block h-1.5 rounded-full transition-all ${
                                    i === step
                                        ? 'w-4 bg-indigo-400'
                                        : 'w-1.5 bg-zinc-700'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Next / Got it */}
                    <button
                        type="button"
                        onClick={handleNext}
                        className="rounded px-3 py-1.5 text-xs font-medium bg-indigo-600 text-zinc-100 hover:bg-indigo-500 transition-colors"
                    >
                        {isLast ? 'Got it' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    )
}
