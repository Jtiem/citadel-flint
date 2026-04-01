/**
 * LaunchScreen — src/components/ui/LaunchScreen.tsx
 *
 * FORGE.1a — Three-Path LaunchScreen
 *
 * Simplified to 3 primary paths:
 *   1. "Try Flint"         — demo scenario picker (new users)
 *   2. "Open My Project"   — folder picker (returning users)
 *   3. "Audit a Folder"    — quick health grade (secondary text link)
 *
 * Layout (top → bottom):
 *   1. Header  — gradient brand + subtitle
 *   2. MCP context banner  — dominant position when active
 *   3. "Try Flint" primary CTA
 *   4. "Open My Project" primary CTA
 *   5. "Audit a Folder" text link
 *   6. Demo scenario picker (inline, revealed when "Try Flint" clicked)
 *   7. Recent projects list with health grades
 *   8. Web-mode path input (footer)
 */

import { useState, useEffect, useCallback, useId } from 'react'
import { BRAND } from '../../../shared/brand'
import { resolveWebOpenFolder, cancelWebOpenFolder, hasWebOpenFolderPending } from '../../adapters/web-api'
import {
    FolderOpen,
    Clock,
    Trash2,
    Shield,
    ArrowRight,
    Loader2,
    ChevronRight,
    Link2,
    X,
    Play,
    FileSearch,
} from 'lucide-react'
import type { RecentProject } from '../../types/flint-api'

// ── Types ─────────────────────────────────────────────────────────────────────

// Health grade colour mapping — A→green, B→teal, C→yellow, D→orange, F→red
const GRADE_COLORS: Record<string, string> = {
    A: 'text-emerald-400',
    B: 'text-teal-400',
    C: 'text-yellow-400',
    D: 'text-orange-400',
    F: 'text-red-400',
}

function gradeColor(grade: string | undefined): string {
    if (!grade) return 'text-zinc-500'
    const letter = grade[0]?.toUpperCase() ?? ''
    return GRADE_COLORS[letter] ?? 'text-zinc-500'
}

interface LaunchScreenProps {
    onOpenFolder: () => Promise<void>
    onNewProject: () => Promise<void>
    onOpenRecent: (projectPath: string) => Promise<void>
    onLoadDemo: (demoName: string) => Promise<void>
    /** Opens the SetupWizard as a non-blocking modal for IDE/MCP configuration */
    onConnectIDE?: () => void
    /** Error message to surface when demo project load fails */
    demoError?: string
}

// ── Demo scenario definitions ─────────────────────────────────────────────────

const DEMO_SCENARIOS = [
    {
        name: 'a11y-audit',
        title: 'A11y Audit',
        time: '5 min',
        topic: 'WCAG 2.1 AA',
        description: 'Plain-language accessibility fixes across a real form component.',
    },
    {
        name: 'token-drift',
        title: 'Token Drift',
        time: '2 min',
        topic: 'Fix color & spacing',
        description: 'Catch perceptual drift that your eyes would miss.',
    },
    {
        name: 'design-system-migration',
        title: 'DS Migration',
        time: '3 min',
        topic: 'v3→v4 upgrade',
        description: 'Migrate your design system safely with AST surgery.',
    },
    {
        name: 'multi-component-app',
        title: 'Full App Scan',
        time: '8 min',
        topic: 'Full workflow',
        description: 'Design debt report + Export Gate on a real-world app.',
    },
] as const

// ── Detect web mode ────────────────────────────────────────────────────────────
const isWebMode = typeof (globalThis as Record<string, unknown>).__FLINT_WEB__ !== 'undefined'

// ── Component ─────────────────────────────────────────────────────────────────

export function LaunchScreen({
    onOpenFolder,
    onNewProject,
    onOpenRecent,
    onLoadDemo,
    onConnectIDE,
    demoError,
}: LaunchScreenProps) {
    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
    const [loading, setLoading] = useState(true)
    const [openingPath, setOpeningPath] = useState<string | null>(null)
    const [mcpConnected, setMcpConnected] = useState(false)
    const [showScenarioPicker, setShowScenarioPicker] = useState(false)
    const [isAuditLoading, setIsAuditLoading] = useState(false)
    // Web mode: text input for project path
    const [webPathInput, setWebPathInput] = useState('')
    const [webPathError, setWebPathError] = useState<string | null>(null)
    const [showWebPathInput, setShowWebPathInput] = useState(false)
    // Demo load error banner
    const [demoBannerDismissed, setDemoBannerDismissed] = useState(false)

    // FORGE.4b: Map of project path → health grade letter
    const [healthGrades, setHealthGrades] = useState<Map<string, string>>(new Map())

    const scenarioPickerId = useId()

    // ── Web-mode open-folder signal listener ──────────────────────────────────
    const handleOpenFolderRequest = useCallback(() => {
        setShowWebPathInput(true)
    }, [])

    useEffect(() => {
        if (!isWebMode) return
        window.addEventListener('flint:open-folder-request', handleOpenFolderRequest)
        return () => {
            window.removeEventListener('flint:open-folder-request', handleOpenFolderRequest)
            cancelWebOpenFolder()
        }
    }, [handleOpenFolderRequest])

    // ── Context detection ─────────────────────────────────────────────────────
    useEffect(() => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 500)

        Promise.allSettled([
            window.flintAPI.mcp?.status(),
            window.flintAPI.registry.getRecent(),
        ]).then(([mcpResult, recentsResult]) => {
            clearTimeout(timeout)
            if (mcpResult.status === 'fulfilled' && mcpResult.value?.connected) {
                setMcpConnected(true)
            }
            if (recentsResult.status === 'fulfilled') {
                setRecentProjects(recentsResult.value ?? [])
            }
            setLoading(false)
        })

        return () => {
            clearTimeout(timeout)
            controller.abort()
        }
    }, [])

    // ── FORGE.4b: Fetch health grades for recent projects ──────────────────
    useEffect(() => {
        if (recentProjects.length === 0) return
        const getGrade = window.flintAPI.project?.getHealthGrade
        if (!getGrade) return

        let cancelled = false
        const gradeMap = new Map<string, string>()

        Promise.allSettled(
            recentProjects.slice(0, 5).map(async (p) => {
                const result = await getGrade(p.path)
                if (result?.grade && !cancelled) {
                    gradeMap.set(p.path, result.grade)
                }
            }),
        ).then(() => {
            if (!cancelled && gradeMap.size > 0) {
                setHealthGrades(new Map(gradeMap))
            }
        })

        return () => { cancelled = true }
    }, [recentProjects])

    // ── Handlers ──────────────────────────────────────────────────────────────

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

    const handleOpenProject = async () => {
        if (isWebMode) {
            setShowWebPathInput(true)
            return
        }
        await onOpenFolder()
    }

    const handleAuditFolder = async () => {
        if (isWebMode) {
            setShowWebPathInput(true)
            return
        }
        setIsAuditLoading(true)
        try {
            await onOpenFolder()
        } finally {
            setIsAuditLoading(false)
        }
    }

    const handleWebPathSubmit = async () => {
        const trimmed = webPathInput.trim()
        if (!trimmed) {
            setWebPathError('Please enter a project path')
            return
        }
        setWebPathError(null)
        setShowWebPathInput(false)
        try {
            if (hasWebOpenFolderPending()) {
                await resolveWebOpenFolder(trimmed)
            } else {
                await onOpenRecent(trimmed)
            }
        } catch {
            setWebPathError('Could not open that path. Check that it exists and try again.')
            setShowWebPathInput(true)
        }
    }

    // Resolved project name for MCP context banner
    const connectedProjectName = mcpConnected && recentProjects.length > 0
        ? recentProjects[0].name
        : null

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex h-screen flex-col bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">

            {/* Demo load error banner */}
            {demoError && !demoBannerDismissed && (
                <div
                    role="alert"
                    className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-900/20 px-4 py-2.5"
                >
                    <p className="text-xs text-amber-300">
                        Demo project couldn't load. Try opening your own project below.
                    </p>
                    <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={() => setDemoBannerDismissed(true)}
                        className="shrink-0 rounded p-0.5 text-amber-400 transition-colors hover:text-amber-200"
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                </div>
            )}

            {/* 1. Header */}
            <header
                aria-label={`${BRAND.product} launch screen`}
                className="flex shrink-0 items-center border-b border-zinc-800 px-6 py-4"
            >
                <div>
                    <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                        {BRAND.product}
                    </h1>
                    <p className="mt-0.5 text-xs text-zinc-400">AI governance for your design system</p>
                </div>
            </header>

            {/* Main scroll container */}
            <main className="flex flex-1 items-start justify-center overflow-y-auto pt-10 pb-10">
                <div className="w-full max-w-md px-4">

                    {/* 2. MCP context banner — dominant position when active */}
                    {mcpConnected && (
                        <div
                            role="status"
                            aria-label="MCP connection status"
                            className="mb-6 flex items-center justify-between rounded-xl border border-indigo-500/40 bg-indigo-900/25 px-4 py-3"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="h-2 w-2 rounded-full bg-indigo-400" aria-hidden="true" />
                                <span className="text-sm text-zinc-300">
                                    MCP connected
                                    {connectedProjectName && (
                                        <> · <span className="font-semibold text-zinc-100">{connectedProjectName}</span></>
                                    )}
                                </span>
                            </div>
                            <button
                                type="button"
                                aria-label={connectedProjectName ? `Open ${connectedProjectName}` : 'Open connected project'}
                                onClick={() => {
                                    if (recentProjects[0]) {
                                        void handleOpenRecent(recentProjects[0])
                                    }
                                }}
                                className="flex items-center gap-1 text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                            >
                                Open this project
                                <ArrowRight size={11} aria-hidden="true" />
                            </button>
                        </div>
                    )}

                    {/* 3. "Try Flint" — primary CTA */}
                    <button
                        type="button"
                        data-testid="try-flint-cta"
                        aria-expanded={showScenarioPicker}
                        aria-controls={scenarioPickerId}
                        onClick={() => setShowScenarioPicker((v) => !v)}
                        className="group mb-3 flex w-full items-center gap-3 rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-600/25 to-indigo-500/15 px-5 py-4 text-left transition-all hover:border-indigo-500/60 hover:from-indigo-600/35 hover:to-indigo-500/25"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600/35 text-indigo-300 transition-colors group-hover:bg-indigo-600/50">
                            <Play size={18} aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-zinc-100">Try Flint</p>
                            <p className="text-xs text-zinc-400">Load a demo and see governance in action.</p>
                        </div>
                        <ChevronRight
                            size={16}
                            aria-hidden="true"
                            className={[
                                'shrink-0 transition-transform text-zinc-500',
                                showScenarioPicker ? 'rotate-90' : 'group-hover:translate-x-0.5',
                            ].join(' ')}
                        />
                    </button>

                    {/* Demo scenario picker — revealed inline */}
                    {showScenarioPicker && (
                        <div
                            id={scenarioPickerId}
                            data-testid="demo-scenario-picker"
                            className="mb-4 flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
                        >
                            <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                                Choose a scenario
                            </p>
                            {DEMO_SCENARIOS.map((scenario) => (
                                <button
                                    key={scenario.name}
                                    type="button"
                                    aria-label={`Load ${scenario.title} demo — ${scenario.time}, ${scenario.topic}`}
                                    onClick={() => { void onLoadDemo(scenario.name) }}
                                    className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3 text-left transition-colors hover:border-zinc-700/60 hover:bg-zinc-800/50"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-xs font-semibold text-zinc-200">{scenario.title}</p>
                                            <span className="text-[10px] text-zinc-500">{scenario.time} · {scenario.topic}</span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                                            {scenario.description}
                                        </p>
                                    </div>
                                    <ArrowRight size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-zinc-600" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 4. "Open My Project" — primary CTA */}
                    <button
                        type="button"
                        data-testid="open-project-cta"
                        onClick={() => { void handleOpenProject() }}
                        className="group mb-5 flex w-full items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-5 py-4 text-left transition-all hover:border-zinc-600/60 hover:bg-zinc-800/70"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-700/50 text-zinc-300 transition-colors group-hover:bg-zinc-700/70">
                            <FolderOpen size={18} aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-zinc-100">Open My Project</p>
                            <p className="text-xs text-zinc-400">Pick a folder and run a live governance scan.</p>
                        </div>
                        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                    </button>

                    {/* Web mode: path input (shown instead of native dialog) */}
                    {isWebMode && showWebPathInput && (
                        <div className="mb-4">
                            <label htmlFor="web-project-path" className="mb-1.5 block text-xs font-medium text-zinc-400">
                                Project path (absolute)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="web-project-path"
                                    type="text"
                                    value={webPathInput}
                                    aria-label="Project folder path (absolute path)"
                                    onChange={(e) => { setWebPathInput(e.target.value); setWebPathError(null) }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') void handleWebPathSubmit() }}
                                    placeholder="/Users/you/my-project"
                                    autoFocus
                                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500/50"
                                />
                                <button
                                    type="button"
                                    onClick={() => { void handleWebPathSubmit() }}
                                    className="shrink-0 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-4 py-2.5 text-xs font-medium text-indigo-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-600/30"
                                >
                                    Open
                                </button>
                            </div>
                            {webPathError && (
                                <p role="alert" className="mt-1.5 text-[11px] text-red-400">{webPathError}</p>
                            )}
                        </div>
                    )}

                    {/* 5. "Audit a Folder" — secondary text link */}
                    <div className="mb-8 flex items-center justify-center">
                        <button
                            type="button"
                            data-testid="audit-folder-link"
                            onClick={() => { void handleAuditFolder() }}
                            disabled={isAuditLoading}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-50"
                        >
                            {isAuditLoading ? (
                                <Loader2 size={11} aria-hidden="true" className="motion-safe:animate-spin" />
                            ) : (
                                <FileSearch size={11} aria-hidden="true" />
                            )}
                            Audit a Folder
                        </button>
                    </div>

                    {/* 7. Recent projects */}
                    {!loading && recentProjects.length > 0 && (
                        <section aria-labelledby="recent-projects-label" className="mb-6">
                            <div className="mb-2 flex items-center gap-2">
                                <Clock size={11} aria-hidden="true" className="text-zinc-600" />
                                <span
                                    id="recent-projects-label"
                                    className="text-[10px] font-medium uppercase tracking-wider text-zinc-500"
                                >
                                    Reopen a project
                                </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                {recentProjects.slice(0, 5).map((project) => {
                                    const isOpening = openingPath === project.path
                                    const displayPath = project.path.length > 40
                                        ? '...' + project.path.slice(-37)
                                        : project.path
                                    // FORGE.4b: look up grade from fetched health grades map
                                    const grade = healthGrades.get(project.path)
                                    return (
                                        <div
                                            key={project.id}
                                            className="group flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 transition-colors hover:border-zinc-700/50 hover:bg-zinc-800/30"
                                        >
                                            <FolderOpen
                                                size={13}
                                                aria-hidden="true"
                                                className="shrink-0 text-zinc-600 group-hover:text-indigo-400/70 transition-colors"
                                            />
                                            <button
                                                type="button"
                                                aria-label={`Open ${project.name}`}
                                                onClick={() => { void handleOpenRecent(project) }}
                                                disabled={isOpening}
                                                className="flex flex-1 min-w-0 items-center gap-2 text-left"
                                            >
                                                <span className="text-xs font-medium text-zinc-300 truncate">
                                                    {isOpening ? 'Opening...' : project.name}
                                                </span>
                                                {grade && (
                                                    <span
                                                        className={`shrink-0 text-[10px] font-bold tabular-nums ${gradeColor(grade)}`}
                                                        aria-label={`Health grade: ${grade}`}
                                                    >
                                                        {grade}
                                                    </span>
                                                )}
                                                <span className="text-[11px] text-zinc-600 truncate min-w-0">
                                                    {displayPath}
                                                </span>
                                            </button>
                                            <ArrowRight
                                                size={12}
                                                aria-hidden="true"
                                                className="shrink-0 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                            />
                                            <button
                                                type="button"
                                                aria-label={`Remove ${project.name} from recent projects`}
                                                onClick={(e) => handleRemove(e, project.id)}
                                                className="shrink-0 rounded p-0.5 text-zinc-700 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
                                            >
                                                <Trash2 size={11} aria-hidden="true" />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    )}

                    {/* 8. Footer — Connect to IDE + web-mode input */}
                    <div className="flex flex-col items-center gap-3">
                        {/* Standalone web-mode path input (when picker not open) */}
                        {isWebMode && !showWebPathInput && (
                            <div className="w-full">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        aria-label="Project folder path (absolute path)"
                                        value={webPathInput}
                                        onChange={(e) => { setWebPathInput(e.target.value); setWebPathError(null) }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') void handleWebPathSubmit() }}
                                        placeholder="Enter project path..."
                                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500/40"
                                    />
                                    <button
                                        type="button"
                                        aria-label="Open project at entered path"
                                        onClick={() => { void handleWebPathSubmit() }}
                                        className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800/40 px-3 py-2 text-xs text-zinc-400 transition-colors hover:text-zinc-300"
                                    >
                                        Open
                                    </button>
                                </div>
                                {webPathError && (
                                    <p role="alert" className="mt-1 text-center text-[11px] text-red-400">{webPathError}</p>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            {onConnectIDE && (
                                <button
                                    type="button"
                                    onClick={onConnectIDE}
                                    className="flex items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-indigo-400"
                                >
                                    <Link2 size={11} aria-hidden="true" />
                                    Connect to IDE
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}
