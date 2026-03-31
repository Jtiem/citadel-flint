/**
 * BetaWelcome — src/components/ui/BetaWelcome.tsx
 *
 * First-launch welcome screen shown only for beta builds (FLINT_BETA_EXPIRY set).
 * Explains Flint's core value loop in 30 seconds and offers a "Try the Demo"
 * button that copies a bundled demo project with intentional violations so the
 * tester can experience the governance engine immediately.
 *
 * Dismissed state is persisted to localStorage — shown once per device.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { BRAND } from '../../../shared/brand'
import {
    ShieldCheck,
    Sparkles,
    ArrowRight,
    Eye,
    Wrench,
    PackageCheck,
    MessageSquare,
} from 'lucide-react'

const STORAGE_KEY = `${BRAND.productLower}-beta-welcome-seen`

interface BetaWelcomeProps {
    /** Called when the user wants to try the bundled demo project. */
    onTryDemo: () => void
    /** Called when the user wants to skip the demo and go to the LaunchScreen. */
    onSkip: () => void
    /** Build info from betaGuard. */
    buildId?: string
    daysRemaining?: number | null
}

const VALUE_STEPS = [
    {
        icon: Eye,
        title: 'See drift instantly',
        description: `Open any component — ${BRAND.product} scans it against your design system tokens and WCAG rules. Issues light up in the canvas and properties panel.`,
        color: 'text-amber-400',
    },
    {
        icon: Wrench,
        title: 'Auto-fix with one click',
        description: `Each issue has a deterministic fix. Click "Auto-Fix" and ${BRAND.product} surgically rewrites the AST — no regex, no guessing. The preview updates live.`,
        color: 'text-emerald-400',
    },
    {
        icon: PackageCheck,
        title: 'Export when clean',
        description: 'The Export Gate blocks shipping until all issues are resolved. When the shield turns green, your component is safe to ship.',
        color: 'text-indigo-400',
    },
]

const TEST_CHECKLIST = [
    'Open the demo project and see drift items appear',
    'Click "Auto-Fix" on an issue and watch the preview update',
    'Try the Export Gate — can you export with issues?',
    'Check the governance dashboard (Health tab in the sidebar)',
    'Send us feedback via the Beta chip in the status bar',
]

export function BetaWelcome({ onTryDemo, onSkip, buildId, daysRemaining }: BetaWelcomeProps) {
    const [loading, setLoading] = useState(false)
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    const handleTryDemo = useCallback(() => {
        setLoading(true)
        localStorage.setItem(STORAGE_KEY, 'true')
        onTryDemo()
    }, [onTryDemo])

    const handleSkip = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, 'true')
        onSkip()
    }, [onSkip])

    return (
        <div className="flex h-screen flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20">
                        <ShieldCheck className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white">
                            {BRAND.product}
                        </h1>
                        <p className="text-[10px] text-zinc-400">Governance Engine for AI-Generated UI</p>
                    </div>
                </div>
                {buildId && (
                    <span className="rounded border border-indigo-700/40 bg-indigo-900/10 px-2 py-0.5 text-xs text-indigo-400">
                        Beta {daysRemaining != null ? `\u00b7 ${daysRemaining}d remaining` : ''}
                    </span>
                )}
            </header>

            {/* Main content */}
            <main className="flex flex-1 items-start justify-center overflow-y-auto px-6 pt-12 pb-12">
                <div className="w-full max-w-2xl space-y-10">

                    {/* Hero */}
                    <div className="text-center">
                        <h2
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-2xl font-bold text-zinc-100 outline-none"
                        >
                            Welcome to the {BRAND.product} Beta
                        </h2>
                        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-300">
                            {BRAND.product} catches design system drift and accessibility gaps
                            at the AST level — before AI-generated UI code reaches production.
                            Here&apos;s how it works.
                        </p>
                    </div>

                    {/* Value loop — 3 steps */}
                    <div className="grid gap-4">
                        {VALUE_STEPS.map((step, i) => (
                            <div
                                key={step.title}
                                className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4"
                            >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                                    <step.icon className={`h-5 w-5 ${step.color}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-zinc-500">
                                            Step {i + 1}
                                        </span>
                                        {i < VALUE_STEPS.length - 1 && (
                                            <ArrowRight className="h-3 w-3 text-zinc-700" />
                                        )}
                                    </div>
                                    <h3 className="mt-0.5 text-sm font-semibold text-zinc-200">
                                        {step.title}
                                    </h3>
                                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* What to test */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-5 py-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                            <Sparkles className="h-4 w-4 text-amber-400" />
                            What to test
                        </h3>
                        <ul className="mt-3 space-y-2">
                            {TEST_CHECKLIST.map((item) => (
                                <li
                                    key={item}
                                    className="flex items-start gap-2 text-xs text-zinc-400"
                                >
                                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-center gap-3">
                        <button
                            type="button"
                            onClick={handleTryDemo}
                            disabled={loading}
                            className="flex items-center gap-2 rounded-xl border border-indigo-500 bg-indigo-500/10 px-8 py-3 text-sm font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Sparkles className="h-4 w-4" />
                            {loading ? 'Setting up demo...' : 'Try the Demo Project'}
                        </button>
                        <button
                            type="button"
                            onClick={handleSkip}
                            className="text-xs text-zinc-500 transition-colors hover:text-zinc-400"
                        >
                            Skip — I'll open my own project
                        </button>
                    </div>

                    {/* Feedback callout */}
                    <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
                        <MessageSquare className="h-3 w-3" />
                        <span>
                            Found something? Click the{' '}
                            <span className="font-medium text-indigo-400">Beta</span>{' '}
                            chip in the status bar to send feedback.
                        </span>
                    </div>
                </div>
            </main>
        </div>
    )
}

/** Returns true if this is a beta build and the welcome hasn't been shown yet. */
export function shouldShowBetaWelcome(): boolean {
    if (localStorage.getItem(STORAGE_KEY)) return false
    // Will be confirmed via IPC in the parent component
    return true
}
