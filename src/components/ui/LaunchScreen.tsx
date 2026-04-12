/**
 * LaunchScreen — src/components/ui/LaunchScreen.tsx
 *
 * Context-aware entry system with JTBD tiles.
 *
 * Layout (top → bottom):
 *   1. Header  — gradient brand + subtitle
 *   2. MCP context banner  — shown when MCP is already connected
 *   3. Primary CTA  — "New Project" (always visible, first tab stop)
 *   4. "Or connect something" label
 *   5. Four compact horizontal tiles (Figma / codebase / audit / dashboard)
 *   6. Inline expanded flow  — renders below tiles when a tile is active
 *   7. Demo section  — primary demo CTA + expandable gallery
 *   8. Recent projects  — conditional; only when records exist
 *   9. Footer escape hatch  — "Open any folder..." + "Connect to IDE"
 */

import { useState, useEffect, useCallback } from 'react'
import { BRAND } from '../../../shared/brand'
import { resolveWebOpenFolder, cancelWebOpenFolder, hasWebOpenFolderPending } from '../../adapters/web-api'
import {
    FolderOpen,
    Clock,
    Trash2,
    Paintbrush,
    Shield,
    FileSearch,
    BarChart2,
    ArrowRight,
    Loader2,
    CheckCircle,
    ChevronRight,
    Zap,
    Link2,
    X,
} from 'lucide-react'
import type { RecentProject } from '../../types/flint-api'
import { FigmaSetupWizard } from './FigmaSetupWizard'
import { DemoScenarioPicker } from './DemoScenarioPicker'

// ── Types ─────────────────────────────────────────────────────────────────────

type JTBDPath = null | 'prototype' | 'connect' | 'audit' | 'dashboard'
type FlowStep = 'choose' | 'folder' | 'figma' | 'progress' | 'done'

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

// ── Tile definitions ─────────────────────────────────────────────────────────

const TILES = [
    {
        id: 'prototype' as const,
        icon: Paintbrush,
        label: 'From Figma',
        description: 'Requires Figma plugin (one-time setup)',
    },
    {
        id: 'connect' as const,
        icon: Shield,
        label: 'Connect codebase',
        description: 'Scan & score your design system',
    },
    {
        id: 'audit' as const,
        icon: FileSearch,
        label: 'Audit a folder',
        description: '50 WCAG + token rules',
    },
    {
        id: 'dashboard' as const,
        icon: BarChart2,
        label: 'Governance dashboard',
        description: 'Live governance in your IDE',
    },
] as const

// ── Detect web mode ──────────────────────────────────────────────────────────
const isWebMode = typeof (globalThis as Record<string, unknown>).__FLINT_WEB__ !== 'undefined'

// ── Component ────────────────────────────────────────────────────────────────

export function LaunchScreen({
    onOpenFolder,
    onNewProject,
    onOpenRecent,
    onLoadDemo,
    onConnectIDE,
    demoError,
}: LaunchScreenProps) {
    const [selectedPath, setSelectedPath] = useState<JTBDPath>(null)
    const [flowStep, setFlowStep] = useState<FlowStep>('choose')
    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
    const [loading, setLoading] = useState(true)
    const [openingPath, setOpeningPath] = useState<string | null>(null)
    const [figmaSetupOpen, setFigmaSetupOpen] = useState(false)
    const [progressMessage, setProgressMessage] = useState('')
    const [mcpConnected, setMcpConnected] = useState(false)
    // Web mode: text input for project path (no native file dialog available)
    const [webPathInput, setWebPathInput] = useState('')
    const [webPathError, setWebPathError] = useState<string | null>(null)
    const [showWebPathInput, setShowWebPathInput] = useState(false)
    // Demo load error banner — dismissed via local state
    const [demoBannerDismissed, setDemoBannerDismissed] = useState(false)
    // (FORGE.3c: showMoreDemos removed — replaced by DemoScenarioPicker)
    // MAJOR-4: Double-click guard for New Project
    const [creating, setCreating] = useState(false)

    // FORGE.4b: Map of project path → health grade letter
    const [healthGrades, setHealthGrades] = useState<Map<string, string>>(new Map())

    // ── Web-mode open-folder signal listener ──────────────────────────────────
    const handleOpenFolderRequest = useCallback(() => {
        setShowWebPathInput(true)
        setSelectedPath(null)
        setFlowStep('choose')
    }, [])

    useEffect(() => {
        if (!isWebMode) return
        window.addEventListener('flint:open-folder-request', handleOpenFolderRequest)
        return () => {
            window.removeEventListener('flint:open-folder-request', handleOpenFolderRequest)
            cancelWebOpenFolder()
        }
    }, [handleOpenFolderRequest])

    // ── Context detection — runs once on mount ───────────────────────────────
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

    // ── FORGE.4b: Fetch health grades for recent projects ────────────────────
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

    // ── Handlers ─────────────────────────────────────────────────────────────

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

    const handleSelectTile = (pathId: JTBDPath) => {
        if (selectedPath === pathId) {
            setSelectedPath(null)
            setFlowStep('choose')
            setFigmaSetupOpen(false)
            return
        }

        setSelectedPath(pathId)

        switch (pathId) {
            case 'prototype':
                setFigmaSetupOpen(true)
                setFlowStep('figma')
                break
            case 'connect':
            case 'audit':
            case 'dashboard':
                setFlowStep('folder')
                break
        }
    }

    const handleFolderStep = async () => {
        if (isWebMode) {
            setShowWebPathInput(true)
            return
        }
        setFlowStep('progress')
        setProgressMessage('Setting up your project...')
        try {
            await onOpenFolder()
        } catch {
            setFlowStep('folder')
        }
    }

    const handleWebPathSubmit = async () => {
        const trimmed = webPathInput.trim()
        if (!trimmed) {
            setWebPathError('Please enter a project path')
            return
        }
        setWebPathError(null)
        setFlowStep('progress')
        setProgressMessage('Opening project...')
        setShowWebPathInput(false)
        try {
            if (hasWebOpenFolderPending()) {
                await resolveWebOpenFolder(trimmed)
            } else {
                await onOpenRecent(trimmed)
            }
        } catch {
            setWebPathError('Could not open that path. Check that it exists and try again.')
            setFlowStep('folder')
            setShowWebPathInput(true)
        }
    }

    const handleOpenFolderFooter = async () => {
        if (isWebMode) {
            setShowWebPathInput(true)
            return
        }
        await onOpenFolder()
    }

    const handleFigmaDone = () => {
        setFigmaSetupOpen(false)
        setFlowStep('folder')
    }

    const handleSkip = () => {
        setSelectedPath(null)
        setFlowStep('choose')
        setFigmaSetupOpen(false)
        void onNewProject()
    }

    // Resolved project name for MCP context banner
    const connectedProjectName = mcpConnected && recentProjects.length > 0
        ? recentProjects[0].name
        : null

    // ── Folder step copy by path ─────────────────────────────────────────────
    const folderCopy = {
        title:
            selectedPath === 'prototype'
                ? 'Where is your component library?'
                : selectedPath === 'audit'
                    ? `Which folder should ${BRAND.product} audit?`
                    : selectedPath === 'dashboard'
                        ? 'Which project is your IDE working on?'
                        : 'Where is your codebase?',
        subtitle:
            selectedPath === 'prototype'
                ? `Choose the root folder of your React project — the one with package.json. ${BRAND.product} will find all .tsx/.jsx components inside.`
                : selectedPath === 'audit'
                    ? `Choose any project folder. ${BRAND.product} will scan every component file it finds inside.`
                    : selectedPath === 'dashboard'
                        ? `Choose the project folder your IDE is working with. ${BRAND.viewer} will show live governance state.`
                        : `Choose the root of your project. ${BRAND.product} will detect your CSS framework and extract tokens.`,
        bullets:
            selectedPath === 'prototype'
                ? [
                    `Find and index every component with its props`,
                    `Extract design tokens from Tailwind, CSS variables, or token files`,
                    `Open a canvas where you can drag Figma frames into working code`,
                ]
                : selectedPath === 'audit'
                    ? [
                        `Run 50 WCAG 2.1 AA accessibility rules on every component`,
                        `Check all colors, spacing, and typography against your token set`,
                        `Show which issues are auto-fixable and which need manual work`,
                        `Generate a governance report with a health score`,
                    ]
                    : selectedPath === 'dashboard'
                        ? [
                            `Connect ${BRAND.viewer} to your active IDE session`,
                            `Show live governance state without interrupting your editor`,
                            `Surface drift, overrides, and gaps as they happen`,
                        ]
                        : [
                            `Detect your stack (Tailwind, CSS custom properties, Chakra, MUI, etc.)`,
                            `Extract all design tokens into ${BRAND.product}'s token format`,
                            `Index every component with its TypeScript prop types`,
                            `Show your design system health score (A-F grade)`,
                        ],
    }

    // ── Render ───────────────────────────────────────────────────────────────

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

                    {/* 3. Primary CTA — New Project */}
                    <button
                        type="button"
                        data-testid="new-project-cta"
                        disabled={creating}
                        onClick={() => {
                            if (creating) return
                            setCreating(true)
                            void onNewProject().finally(() => setCreating(false))
                        }}
                        aria-label="Start a new project"
                        className={[
                            'group mb-6 flex w-full items-center gap-3 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/20 to-indigo-500/10 px-5 py-4 text-left transition-all hover:border-indigo-500/50 hover:from-indigo-600/30 hover:to-indigo-500/20',
                            creating ? 'pointer-events-none opacity-60' : '',
                        ].join(' ')}
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-300 transition-colors group-hover:bg-indigo-600/40">
                            {creating
                                ? <Loader2 size={18} aria-hidden="true" className="motion-safe:animate-spin" />
                                : <Zap size={18} aria-hidden="true" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-zinc-100">{creating ? 'Creating...' : 'New Project'}</p>
                            <p className="text-xs text-zinc-400">Start building immediately. No setup required.</p>
                        </div>
                        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                    </button>

                    {/* 4. Section label */}
                    <p className="mb-3 text-xs font-medium text-zinc-500">Or connect something</p>

                    {/* 5. Compact horizontal tiles */}
                    <div className="flex flex-col gap-2">
                        {TILES.map((tile) => {
                            const isActive = selectedPath === tile.id
                            return (
                                <button
                                    key={tile.id}
                                    type="button"
                                    onClick={() => handleSelectTile(tile.id)}
                                    aria-expanded={selectedPath === tile.id}
                                    aria-controls="launch-flow-panel"
                                    className={[
                                        'flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all',
                                        isActive
                                            ? 'border-indigo-500/40 bg-indigo-950/30'
                                            : 'border-zinc-800 hover:border-zinc-700/50 hover:bg-zinc-800/40',
                                    ].join(' ')}
                                >
                                    <div className={[
                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                                        isActive ? 'bg-indigo-600/20 text-indigo-400' : 'bg-zinc-800 text-zinc-400',
                                    ].join(' ')}>
                                        <tile.icon size={15} aria-hidden="true" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={[
                                            'text-xs font-medium leading-none',
                                            isActive ? 'text-zinc-100' : 'text-zinc-300',
                                        ].join(' ')}>
                                            {tile.label}
                                        </p>
                                        <p className="mt-1 text-xs leading-none text-zinc-500">
                                            {tile.description}
                                        </p>
                                    </div>
                                    <ChevronRight
                                        size={13}
                                        aria-hidden="true"
                                        className={[
                                            'shrink-0 transition-transform',
                                            isActive ? 'rotate-90 text-indigo-400' : 'text-zinc-700',
                                        ].join(' ')}
                                    />
                                </button>
                            )
                        })}
                    </div>

                    {/* 6. Inline expanded flow */}
                    {selectedPath !== null && (
                        <div id="launch-flow-panel" className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">

                            {/* Figma step */}
                            {flowStep === 'figma' && (
                                <div>
                                    <div className="border border-amber-400 bg-amber-950/30 rounded-lg p-3 mb-4">
                                        <p className="text-xs font-medium text-amber-300 mb-1">
                                            Install the {BRAND.product} Figma plugin before continuing.
                                        </p>
                                        <p className="text-xs text-amber-400">
                                            Open Figma → Plugins → Search &ldquo;{BRAND.product}&rdquo; → Install
                                        </p>
                                    </div>
                                    <StepHeader
                                        number={1}
                                        title="Connect your Figma file"
                                        subtitle={`Open the ${BRAND.product} plugin in Figma, paste the endpoint and secret shown below, then click 'Sync Variables'. ${BRAND.product} will pull your colors, spacing, and typography tokens automatically.`}
                                    />
                                    <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                                        <p className="mb-2 text-xs font-medium text-zinc-300">What happens next:</p>
                                        <ol className="list-decimal list-inside space-y-1 text-xs text-zinc-400">
                                            <li>Install the {BRAND.product} Figma plugin (one-time setup)</li>
                                            <li>Enter the endpoint and secret from below</li>
                                            <li>Click &quot;Sync Variables&quot; to pull your design tokens</li>
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
                                        className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-2.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
                                    >
                                        Skip for now — I'll connect Figma later
                                    </button>
                                    <SkipLink onClick={handleSkip} />
                                </div>
                            )}

                            {/* Folder step */}
                            {flowStep === 'folder' && (
                                <div>
                                    <StepHeader
                                        number={selectedPath === 'prototype' ? 2 : 1}
                                        title={folderCopy.title}
                                        subtitle={folderCopy.subtitle}
                                    />
                                    <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                                        <p className="mb-2 text-xs font-medium text-zinc-300">{BRAND.product} will automatically:</p>
                                        <ul className="space-y-1 text-xs text-zinc-400">
                                            {folderCopy.bullets.map((bullet) => (
                                                <li key={bullet}>- {bullet}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    {/* Web mode: path text input */}
                                    {showWebPathInput && (
                                        <div className="mb-3">
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
                                                <p role="alert" className="mt-1.5 text-xs text-red-400">{webPathError}</p>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => { void handleFolderStep() }}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-6 py-3.5 text-sm font-medium text-indigo-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-600/30"
                                    >
                                        <FolderOpen size={16} aria-hidden="true" />
                                        {isWebMode ? 'Enter project path' : 'Choose folder'}
                                    </button>
                                    <SkipLink onClick={handleSkip} />
                                </div>
                            )}

                            {/* Progress step */}
                            {flowStep === 'progress' && (
                                <div className="flex flex-col items-center py-8">
                                    <Loader2 size={28} className="motion-safe:animate-spin text-indigo-400" />
                                    <p className="mt-4 text-sm text-zinc-300">{progressMessage}</p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        Detecting stack, extracting tokens, indexing components...
                                    </p>
                                </div>
                            )}

                            {/* Done step */}
                            {flowStep === 'done' && (
                                <div className="flex flex-col items-center py-8">
                                    <CheckCircle size={36} className="text-emerald-400" />
                                    <p className="mt-4 text-sm font-medium text-zinc-200">You're all set.</p>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {BRAND.product} is ready. Your canvas is loading...
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 7. Demo section — FORGE.3c: Scenario picker */}
                    <div className="mt-8">
                        <DemoScenarioPicker onLoadDemo={onLoadDemo} />
                    </div>

                    {/* 8. Recent projects */}
                    {!loading && recentProjects.length > 0 && (
                        <section aria-labelledby="recent-projects-label" className="mt-8">
                            <div className="mb-2 flex items-center gap-2">
                                <Clock size={11} aria-hidden="true" className="text-zinc-600" />
                                <span
                                    id="recent-projects-label"
                                    className="text-xs font-medium uppercase tracking-wider text-zinc-500"
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
                                                        className={`shrink-0 text-xs font-bold tabular-nums ${gradeColor(grade)}`}
                                                        aria-label={`Health grade: ${grade}`}
                                                    >
                                                        {grade}
                                                    </span>
                                                )}
                                                <span className="text-xs text-zinc-600 truncate min-w-0">
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

                    {/* 9. Footer actions */}
                    <div className="mt-6 flex flex-col items-center gap-3">
                        {/* Web mode: standalone path input when no tile is expanded */}
                        {isWebMode && !selectedPath && (
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
                                {webPathError && !selectedPath && (
                                    <p role="alert" className="mt-1 text-center text-xs text-red-400">{webPathError}</p>
                                )}
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            {!isWebMode && (
                                <button
                                    type="button"
                                    onClick={() => { void handleOpenFolderFooter() }}
                                    className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
                                >
                                    Open any folder...
                                </button>
                            )}
                            {onConnectIDE && (
                                <>
                                    {!isWebMode && <span className="text-zinc-700" aria-hidden="true">|</span>}
                                    <button
                                        type="button"
                                        onClick={onConnectIDE}
                                        className="flex items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-indigo-400"
                                    >
                                        <Link2 size={11} aria-hidden="true" />
                                        Connect to IDE
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

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
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600/30 text-xs font-bold text-indigo-300">
                    {number}
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Step {number}
                </span>
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{subtitle}</p>
        </div>
    )
}

function SkipLink({ onClick }: { onClick: () => void }) {
    return (
        <div className="mt-4 flex justify-center">
            <button
                type="button"
                onClick={onClick}
                className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
            >
                Skip — open canvas instead
            </button>
        </div>
    )
}
