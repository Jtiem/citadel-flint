/**
 * DemoWalkthrough — src/components/ui/DemoWalkthrough.tsx
 *
 * 3-step tooltip overlay that guides users through the core
 * "violation → fix → gate clears" loop after the a11y-audit demo loads.
 *
 * localStorage key: `flint-demo-walkthrough-complete`
 * If already set to 'true', returns null immediately.
 *
 * Mount/unmount is controlled by App.tsx via the demoAutoLoaded flag.
 */

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'flint-demo-walkthrough-complete'

interface Step {
    title: string
    body: string
    targetTestId: string
    buttonLabel: string
}

const STEPS: Step[] = [
    {
        title: 'These are drift items',
        body: 'Flint found 8 issues in this form — missing labels, contrast failures, and hardcoded colors.',
        targetTestId: 'governance-dashboard-violations',
        buttonLabel: 'Next →',
    },
    {
        title: 'Click Fix to resolve them',
        body: 'Each issue has an auto-fix. Click Fix to let Flint correct it automatically.',
        targetTestId: 'fix-all-button',
        buttonLabel: 'Next →',
    },
    {
        title: 'The gate clears',
        body: 'Once all issues are resolved, the Export Gate opens. Your code is compliant.',
        targetTestId: 'export-gate-indicator',
        buttonLabel: 'Done',
    },
]

interface TooltipPos {
    top: string
    left: string
}

const FALLBACK_POS: TooltipPos = { top: '50%', left: '50%' }

export interface DemoWalkthroughProps {
    onDismiss: () => void
}

export function DemoWalkthrough({ onDismiss }: DemoWalkthroughProps) {
    const [completed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
    const [step, setStep] = useState(0)
    const [pos, setPos] = useState<TooltipPos>(FALLBACK_POS)

    const current = STEPS[step]

    useEffect(() => {
        const el = document.querySelector<HTMLElement>(
            `[data-testid="${current.targetTestId}"]`
        )
        if (el) {
            const rect = el.getBoundingClientRect()
            setPos({
                top: rect.bottom + 12 + 'px',
                left: rect.left + 'px',
            })
        } else {
            setPos(FALLBACK_POS)
        }
    }, [step, current.targetTestId])

    if (completed) return null

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, 'true')
        onDismiss()
    }

    const handleNext = () => {
        if (step < STEPS.length - 1) {
            setStep((s) => s + 1)
        } else {
            dismiss()
        }
    }

    // When FALLBACK_POS is active, center the card with CSS transforms
    const isFallback = pos === FALLBACK_POS
    const posStyle: React.CSSProperties = isFallback
        ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        : { top: pos.top, left: pos.left }

    return (
        // Transparent overlay — doesn't block interaction, just layers the tooltip
        <div className="fixed inset-0 z-50 pointer-events-none">
            {/* Tooltip card — pointer-events re-enabled for buttons */}
            <div
                className="absolute w-72 rounded-lg border border-indigo-500 bg-zinc-900 p-4 shadow-xl shadow-black/40 pointer-events-auto"
                style={posStyle}
                role="dialog"
                aria-label={`Walkthrough step ${step + 1} of ${STEPS.length}`}
            >
                {/* Skip link */}
                <button
                    type="button"
                    onClick={dismiss}
                    className="absolute right-2 top-2 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                    aria-label="Skip walkthrough"
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

                    {/* Next / Done */}
                    <button
                        type="button"
                        onClick={handleNext}
                        className="rounded px-3 py-1.5 text-xs font-medium bg-indigo-600 text-zinc-100 hover:bg-indigo-500 transition-colors"
                    >
                        {current.buttonLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
