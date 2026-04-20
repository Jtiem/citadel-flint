/**
 * DemoScenarioPicker.tsx — FORGE.3c
 *
 * Scenario-based demo picker for LaunchScreen. Replaces the flat demo list
 * with goal-oriented scenario cards that show: title, one-line description,
 * estimated time, and a load button.
 *
 * 3 scenarios mapped to the 3 projects in `build-resources/demos/`. Each maps to
 * a demo project name that LaunchScreen's `onLoadDemo` handler understands.
 */

import { useState } from 'react'
import { Wrench, Sparkles, ShieldAlert, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Scenario definitions ─────────────────────────────────────────────────────

export interface DemoScenario {
    id: string
    title: string
    description: string
    time: string
    demoName: string
    icon: LucideIcon
}

export const DEMO_SCENARIOS: DemoScenario[] = [
    {
        id: 'full-workflow',
        title: 'Try the full workflow',
        description: 'Audit a 5-component app, auto-fix what Flint can, watch the Export Gate block what it can\'t',
        time: '~3 min',
        demoName: 'multi-component-app',
        icon: Wrench,
    },
    {
        id: 'ai-ungoverned',
        title: 'AI without governance',
        description: 'See what AI ships when nothing is enforcing your design system',
        time: '~1 min',
        demoName: 'dashboard-before',
        icon: ShieldAlert,
    },
    {
        id: 'ai-governed',
        title: 'AI with Flint',
        description: 'Same dashboard, generated with token + a11y + brand constraints on',
        time: '~1 min',
        demoName: 'dashboard-after',
        icon: Sparkles,
    },
]

// ── Component ────────────────────────────────────────────────────────────────

interface DemoScenarioPickerProps {
    onLoadDemo: (demoName: string) => Promise<void>
}

export function DemoScenarioPicker({ onLoadDemo }: DemoScenarioPickerProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null)

    const handleLoad = async (scenario: DemoScenario) => {
        if (loadingId) return
        setLoadingId(scenario.id)
        try {
            await onLoadDemo(scenario.demoName)
        } finally {
            setLoadingId(null)
        }
    }

    return (
        <div data-testid="demo-scenario-picker">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                Try a demo scenario
            </p>
            <div className="grid grid-cols-2 gap-2">
                {DEMO_SCENARIOS.map((scenario) => {
                    const isLoading = loadingId === scenario.id
                    const isDisabled = loadingId !== null
                    const Icon = scenario.icon
                    return (
                        <button
                            key={scenario.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => { void handleLoad(scenario) }}
                            data-testid={`demo-scenario-${scenario.id}`}
                            className={[
                                'flex flex-col items-start rounded-lg border p-3 text-left transition-all',
                                isLoading
                                    ? 'border-indigo-500/40 bg-indigo-950/30'
                                    : isDisabled
                                        ? 'pointer-events-none border-zinc-800 opacity-50'
                                        : 'border-zinc-800 hover:border-zinc-700/50 hover:bg-zinc-800/40',
                            ].join(' ')}
                        >
                            <div className="mb-2 flex w-full items-center justify-between">
                                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                                    {isLoading
                                        ? <Loader2 size={14} className="motion-safe:animate-spin text-indigo-400" aria-hidden="true" />
                                        : <Icon size={14} aria-hidden="true" />}
                                </div>
                                <span className="text-[10px] text-zinc-600">{scenario.time}</span>
                            </div>
                            <p className="text-xs font-medium text-zinc-200">{scenario.title}</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{scenario.description}</p>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
