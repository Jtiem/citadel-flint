/**
 * DemoScenarioPicker.tsx — FORGE.3c
 *
 * Scenario-based demo picker for LaunchScreen. Replaces the flat demo list
 * with goal-oriented scenario cards that show: title, one-line description,
 * estimated time, and a load button.
 *
 * Max 4 scenarios. Each maps to a demo project name that LaunchScreen's
 * `onLoadDemo` handler understands.
 */

import { useState } from 'react'
import { FileSearch, Wrench, BarChart2, Shield, Loader2 } from 'lucide-react'
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
        id: 'audit-component',
        title: 'Audit a component',
        description: 'Scan a React component for token drift and accessibility issues',
        time: '~2 min',
        demoName: 'token-drift',
        icon: FileSearch,
    },
    {
        id: 'fix-violations',
        title: 'Fix violations',
        description: 'Auto-remediate color, spacing, and a11y violations in one pass',
        time: '~2 min',
        demoName: 'a11y-audit',
        icon: Wrench,
    },
    {
        id: 'design-system-health',
        title: 'Design system health',
        description: 'See your health score, grade, and top violated rules',
        time: '~3 min',
        demoName: 'multi-component-app',
        icon: BarChart2,
    },
    {
        id: 'ds-migration',
        title: 'Migrate a design system',
        description: 'Upgrade Tailwind v3 to v4 with AST-level class transforms',
        time: '~3 min',
        demoName: 'design-system-migration',
        icon: Shield,
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
