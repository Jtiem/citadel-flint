/**
 * LaunchScreen — src/components/ui/LaunchScreen.tsx
 *
 * JTBD-driven onboarding flow. Replaces the feature-menu approach with
 * three goal-oriented paths:
 *
 *   1. "Prototype from Figma" — designer wants to build working React
 *      from their designs using real components
 *   2. "Connect my design system" — DS lead wants Figma tokens synced
 *      and governance enforced on AI output
 *   3. "Audit existing code" — tech lead wants a governance report on
 *      an existing codebase
 *
 * Each path triggers a guided inline flow — no context switching.
 * The screen transforms in place as the user progresses through steps.
 *
 * Recent projects appear as a subtle footer for returning users.
 */

import { useState, useEffect } from 'react'
import { BRAND } from '../../../shared/brand'
import {
    FolderOpen,
    Clock,
    Trash2,
    Paintbrush,
    Shield,
    FileSearch,
    ArrowLeft,
    Loader2,
    CheckCircle,
    ChevronRight,
} from 'lucide-react'
import type { RecentProject } from '../../types/flint-api'
import { FigmaSetupWizard } from './FigmaSetupWizard'

// ── Types ────────────────────────────────────────────────────────────────────

type JTBDPath = null | 'prototype' | 'connect' | 'audit'
type FlowStep = 'choose' | 'folder' | 'figma' | 'progress' | 'done'

interface LaunchScreenProps {
    onOpenFolder: () => Promise<void>
    onNewProject: () => Promise<void>
    onOpenRecent: (projectPath: string) => Promise<void>
    onLoadDemo: () => Promise<void>
}

// ── Path Cards ───────────────────────────────────────────────────────────────

const PATHS = [
    {
        id: 'prototype' as const,
        icon: Paintbrush,
        title: 'Prototype from Figma',
        description: `Connect your Figma file, then choose your component library folder. ${BRAND.product} indexes your components, extracts design tokens, and opens a canvas where Figma frames become working React.`,
        whatYouNeed: 'A Figma file and a React project with components',
        steps: '1. Connect Figma  2. Choose folder  3. Start building',
        accent: 'indigo',
    },
    {
        id: 'connect' as const,
        icon: Shield,
        title: 'Connect my design system',
        description: `Choose your codebase folder. ${BRAND.product} auto-detects your stack (Tailwind, CSS variables, etc.), extracts every design token, indexes all components, and runs a governance health check.`,
        whatYouNeed: 'A React, Vue, or Angular project folder',
        steps: '1. Choose folder  2. Review health score  3. Connect Figma (optional)',
        accent: 'purple',
    },
    {
        id: 'audit' as const,
        icon: FileSearch,
        title: 'Audit existing code',
        description: `Choose any folder with components. ${BRAND.product} scans every file against 50 WCAG accessibility rules and your design token set, then shows exactly what needs fixing.`,
        whatYouNeed: 'Any folder with .tsx, .jsx, or .html files',
        steps: '1. Choose folder  2. See violations  3. Auto-fix what you can',
        accent: 'emerald',
    },
] as const

// ── Accent color utilities ───────────────────────────────────────────────────

function accentClasses(accent: string, variant: 'card' | 'active') {
    const map: Record<string, { card: string; active: string }> = {
        indigo: {
            card: 'border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-950/30',
            active: 'border-indigo-500/60 bg-indigo-950/40',
        },
        purple: {
            card: 'border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-950/30',
            active: 'border-purple-500/60 bg-purple-950/40',
        },
        emerald: {
            card: 'border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-950/30',
            active: 'border-emerald-500/60 bg-emerald-950/40',
        },
    }
    return map[accent]?.[variant] ?? ''
}

function iconColor(accent: string) {
    const map: Record<string, string> = {
        indigo: 'text-indigo-400',
        purple: 'text-purple-400',
        emerald: 'text-emerald-400',
    }
    return map[accent] ?? 'text-gray-400'
}

// ── Component ────────────────────────────────────────────────────────────────

export function LaunchScreen({ onOpenFolder, onNewProject, onOpenRecent, onLoadDemo: _onLoadDemo }: LaunchScreenProps) {
    const [selectedPath, setSelectedPath] = useState<JTBDPath>(null)
    const [flowStep, setFlowStep] = useState<FlowStep>('choose')
    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
    const [loading, setLoading] = useState(true)
    const [openingPath, setOpeningPath] = useState<string | null>(null)
    const [figmaSetupOpen, setFigmaSetupOpen] = useState(false)
    const [progressMessage, setProgressMessage] = useState('')

    useEffect(() => {
        window.flintAPI.registry
            .getRecent()
            .then(setRecentProjects)
            .finally(() => setLoading(false))
    }, [])

    const handleRemove = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        void window.flintAPI.registry.removeProject(id).then(() => {
            setRecentProjects((prev) => prev.filter((p) => p.id !== id))
        })
    }

    const handleOpenRecent = async (project: RecentProject) => {
        setOpeningPath(project.path)
        try {
            await onOpenRecent(project.path)
        } finally {
            setOpeningPath(null)
        }
    }

    const handleBack = () => {
        setSelectedPath(null)
        setFlowStep('choose')
        setFigmaSetupOpen(false)
    }

    // ── Path selection → start the guided flow ──────────────────────────────
    const handleSelectPath = (pathId: JTBDPath) => {
        setSelectedPath(pathId)

        switch (pathId) {
            case 'prototype':
                // Step 1: Connect Figma first, then pick component library
                setFigmaSetupOpen(true)
                setFlowStep('figma')
                break
            case 'connect':
                // Step 1: Pick the codebase folder
                setFlowStep('folder')
                break
            case 'audit':
                // Step 1: Pick the folder, then auto-audit
                setFlowStep('folder')
                break
        }
    }

    // ── Folder step: open folder then proceed ───────────────────────────────
    const handleFolderStep = async () => {
        setFlowStep('progress')
        setProgressMessage('Setting up your project...')
        try {
            await onOpenFolder()
            // onOpenFolder triggers the full scan flow in App.tsx
            // which unmounts LaunchScreen when workspaceFiles is set
        } catch {
            setFlowStep('folder')
        }
    }

    // ── Figma done → pick component library ─────────────────────────────────
    const handleFigmaDone = () => {
        setFigmaSetupOpen(false)
        setFlowStep('folder')
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex h-screen flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-6 py-4">
                <div>
                    <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                        {BRAND.product}
                    </h1>
                    <p className="mt-0.5 text-xs text-gray-500">Design System Governance</p>
                </div>
                {selectedPath && (
                    <button
                        type="button"
                        onClick={handleBack}
                        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
                    >
                        <ArrowLeft size={13} />
                        Back
                    </button>
                )}
            </header>

            {/* Main */}
            <main className="flex flex-1 items-start justify-center overflow-y-auto pt-12">
                <div className="w-full max-w-lg px-4">

                    {/* ── Step: Choose your job ──────────────────────────── */}
                    {flowStep === 'choose' && (
                        <>
                            <h2 className="mb-6 text-center text-lg font-medium text-gray-200">
                                What brings you to {BRAND.product}?
                            </h2>

                            <div className="flex flex-col gap-3">
                                {PATHS.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleSelectPath(p.id)}
                                        className={`group flex items-start gap-4 rounded-xl border p-5 text-left transition-all ${accentClasses(p.accent, 'card')}`}
                                    >
                                        <div className={`mt-0.5 rounded-lg bg-gray-800/80 p-2.5 ${iconColor(p.accent)}`}>
                                            <p.icon size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-gray-100">
                                                    {p.title}
                                                </span>
                                                <ChevronRight size={14} className="text-gray-600 transition-transform group-hover:translate-x-0.5" />
                                            </div>
                                            <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
                                                {p.description}
                                            </p>
                                            <div className="mt-3 flex flex-col gap-1.5">
                                                <p className="text-[11px] text-gray-500">
                                                    <span className="font-medium text-gray-400">You'll need:</span> {p.whatYouNeed}
                                                </p>
                                                <p className="text-[11px] font-medium text-gray-500">
                                                    {p.steps}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Recent projects — subtle, for returning users */}
                            {!loading && recentProjects.length > 0 && (
                                <div className="mt-10">
                                    <div className="mb-2 flex items-center gap-2">
                                        <Clock size={11} className="text-gray-600" />
                                        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-600">
                                            or reopen
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {recentProjects.slice(0, 5).map((project) => {
                                            const isOpening = openingPath === project.path
                                            return (
                                                <button
                                                    key={project.id}
                                                    type="button"
                                                    onClick={() => { void handleOpenRecent(project) }}
                                                    disabled={isOpening}
                                                    className="group flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-xs text-gray-400 transition-colors hover:border-gray-700 hover:bg-gray-800/50 hover:text-gray-300"
                                                >
                                                    <FolderOpen size={12} className="text-gray-600 group-hover:text-indigo-400/70" />
                                                    {isOpening ? 'Opening...' : project.name}
                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-label="Remove from recent"
                                                        onClick={(e) => handleRemove(e, project.id)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRemove(e as any, project.id) } }}
                                                        className="ml-1 rounded p-0.5 text-gray-700 opacity-0 transition-opacity hover:text-gray-400 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={10} />
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Step: Connect Figma ────────────────────────────── */}
                    {flowStep === 'figma' && (
                        <div>
                            <StepHeader
                                number={1}
                                title="Connect your Figma file"
                                subtitle={`Open the ${BRAND.product} plugin in Figma, paste the endpoint and secret shown below, then click 'Sync Variables'. ${BRAND.product} will pull your colors, spacing, and typography tokens automatically.`}
                            />
                            <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                                <p className="text-xs font-medium text-gray-300 mb-2">What happens next:</p>
                                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-400">
                                    <li>Install the {BRAND.product} Figma plugin (one-time setup)</li>
                                    <li>Enter the endpoint and secret from below</li>
                                    <li>Click "Sync Variables" to pull your design tokens</li>
                                    <li>Click &quot;Export Selection&quot; to send components to {BRAND.product}</li>
                                </ol>
                            </div>
                            <FigmaSetupWizard
                                visible={figmaSetupOpen}
                                onClose={handleFigmaDone}
                            />
                            <button
                                type="button"
                                onClick={handleFigmaDone}
                                className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-800/40 px-4 py-2.5 text-xs text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-gray-300"
                            >
                                Skip for now — I'll connect Figma later
                            </button>
                        </div>
                    )}

                    {/* ── Step: Pick folder ──────────────────────────────── */}
                    {flowStep === 'folder' && (
                        <div>
                            <StepHeader
                                number={selectedPath === 'prototype' ? 2 : 1}
                                title={
                                    selectedPath === 'prototype'
                                        ? 'Where is your component library?'
                                        : selectedPath === 'audit'
                                            ? `Which folder should ${BRAND.product} audit?`
                                            : 'Where is your codebase?'
                                }
                                subtitle={
                                    selectedPath === 'prototype'
                                        ? `Choose the root folder of your React project — the one with package.json. ${BRAND.product} will find all .tsx/.jsx components inside.`
                                        : selectedPath === 'audit'
                                            ? `Choose any project folder. ${BRAND.product} will scan every component file it finds inside.`
                                            : `Choose the root of your project. ${BRAND.product} will detect your CSS framework and extract tokens.`
                                }
                            />

                            <div className="mb-4 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                                <p className="text-xs font-medium text-gray-300 mb-2">{BRAND.product} will automatically:</p>
                                <ul className="space-y-1 text-xs text-gray-400">
                                    {selectedPath === 'prototype' && (
                                        <>
                                            <li>- Find and index every component with its props</li>
                                            <li>- Extract design tokens from Tailwind, CSS variables, or token files</li>
                                            <li>- Open a canvas where you can drag Figma frames into working code</li>
                                        </>
                                    )}
                                    {selectedPath === 'connect' && (
                                        <>
                                            <li>- Detect your stack (Tailwind, CSS custom properties, Chakra, MUI, etc.)</li>
                                            <li>- Extract all design tokens into {BRAND.product}&apos;s token format</li>
                                            <li>- Index every component with its TypeScript prop types</li>
                                            <li>- Show your design system health score (A-F grade)</li>
                                        </>
                                    )}
                                    {selectedPath === 'audit' && (
                                        <>
                                            <li>- Run 50 WCAG 2.1 AA accessibility rules on every component</li>
                                            <li>- Check all colors, spacing, and typography against your token set</li>
                                            <li>- Show which violations are auto-fixable and which need manual work</li>
                                            <li>- Generate a governance report with a health score</li>
                                        </>
                                    )}
                                </ul>
                            </div>

                            <button
                                type="button"
                                onClick={() => { void handleFolderStep() }}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-6 py-4 text-sm font-medium text-indigo-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-600/30"
                            >
                                <FolderOpen size={18} />
                                Choose folder
                            </button>

                            {selectedPath === 'prototype' && (
                                <button
                                    type="button"
                                    onClick={() => { void onNewProject() }}
                                    className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-800/40 px-4 py-2.5 text-xs text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-gray-300"
                                >
                                    New Project
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── Step: Progress ─────────────────────────────────── */}
                    {flowStep === 'progress' && (
                        <div className="flex flex-col items-center py-12">
                            <Loader2 size={32} className="animate-spin text-indigo-400" />
                            <p className="mt-4 text-sm text-gray-300">{progressMessage}</p>
                            <p className="mt-1 text-xs text-gray-500">
                                Detecting stack, extracting tokens, indexing components...
                            </p>
                        </div>
                    )}

                    {/* ── Step: Done ─────────────────────────────────────── */}
                    {flowStep === 'done' && (
                        <div className="flex flex-col items-center py-12">
                            <CheckCircle size={40} className="text-emerald-400" />
                            <p className="mt-4 text-sm font-medium text-gray-200">You're all set.</p>
                            <p className="mt-1 text-xs text-gray-500">
                                {BRAND.product} is ready. Your canvas is loading...
                            </p>
                        </div>
                    )}

                </div>
            </main>
        </div>
    )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({ number, title, subtitle }: { number: number; title: string; subtitle: string }) {
    return (
        <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600/30 text-[10px] font-bold text-indigo-300">
                    {number}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Step {number}
                </span>
            </div>
            <h2 className="text-lg font-medium text-gray-100">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-400">{subtitle}</p>
        </div>
    )
}
