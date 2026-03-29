/**
 * LaunchScreen — src/components/ui/LaunchScreen.tsx
 *
 * Phase LAUNCH.2 — Context-aware entry system.
 *
 * Layout (top → bottom):
 *   1. Header  — gradient brand + subtitle
 *   2. MCP context banner  — shown when MCP is already connected
 *   3. Primary CTA  — "Open Canvas" (always visible, first tab stop)
 *   4. "Or connect something" label
 *   5. Four compact horizontal tiles (Figma / codebase / audit / dashboard)
 *   6. Inline expanded flow  — renders below tiles when a tile is active
 *   7. Recent projects  — conditional; only when records exist
 *   8. Footer escape hatch  — "Open any folder..."
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

// ── Types ─────────────────────────────────────────────────────────────────────

type JTBDPath = null | 'prototype' | 'connect' | 'audit' | 'dashboard'
type FlowStep = 'choose' | 'folder' | 'figma' | 'progress' | 'done'

interface LaunchScreenProps {
    onOpenFolder: () => Promise<void>
    onNewProject: () => Promise<void>
    onOpenRecent: (projectPath: string) => Promise<void>
    onLoadDemo: (demoName: string) => Promise<void>
    /** WS1: Opens the SetupWizard as a non-blocking modal for IDE/MCP configuration */
    onConnectIDE?: () => void
    /** Error message to surface when demo project load fails */
    demoError?: string
}

// ── Demo project definitions ──────────────────────────────────────────────────

const DEMO_PROJECTS = [
    {
        name: 'token-drift',
        title: 'Token Drift',
        time: '2 min',
        topic: 'Fix color & spacing',
        outcome: 'Catch drift your eyes miss',
    },
    {
        name: 'a11y-audit',
        title: 'A11y Audit',
        time: '5 min',
        topic: 'WCAG 2.1 AA',
        outcome: 'Plain-language a11y fixes',
    },
    {
        name: 'design-system-migration',
        title: 'DS Migration',
        time: '3 min',
        topic: 'v3→v4 upgrade',
        outcome: 'Migrate your DS safely',
    },
    {
        name: 'multi-component-app',
        title: 'Full App Scan',
        time: '8 min',
        topic: 'Full workflow',
        outcome: 'Debt report + Export Gate',
    },
] as const

// ── Tile definitions ──────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

// Detect web mode — true when running in browser via Express server
const isWebMode = typeof (globalThis as Record<string, unknown>).__FLINT_WEB__ !== 'undefined'

export function LaunchScreen({ onOpenFolder, onNewProject, onOpenRecent, onLoadDemo, onConnectIDE, demoError }: LaunchScreenProps) {
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
    // Demo gallery — show more / collapse
    const [showMoreDemos, setShowMoreDemos] = useState(false)

    // ── Web-mode open-folder signal listener ──────────────────────────────────
    // When web-api's openFolder() is called from App.tsx (e.g. project menu),
    // it dispatches this event. We surface the path-input UI so the user can
    // provide the folder path, which then resolves the deferred promise.
    const handleOpenFolderRequest = useCallback(() => {
        setShowWebPathInput(true)
        setSelectedPath(null) // ensure footer input is visible
        setFlowStep('choose')
    }, [])

    useEffect(() => {
        if (!isWebMode) return
        window.addEventListener('flint:open-folder-request', handleOpenFolderRequest)
        return () => {
            window.removeEventListener('flint:open-folder-request', handleOpenFolderRequest)
            // Cancel any pending deferred promise when LaunchScreen unmounts
            cancelWebOpenFolder()
        }
    }, [handleOpenFolderRequest])

    // ── Context detection — runs once on mount ────────────────────────────────
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

    const handleSelectTile = (pathId: JTBDPath) => {
        // Toggle: clicking the active tile collapses it
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
            // In web mode, show the path input instead of triggering the native dialog
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
                // An openFolder() deferred promise is in flight (dispatched from
                // App.tsx, e.g. via the "Open Folder" project-menu button).
                // Resolve it — App.tsx's handleOpenFolder will hydrate the workspace.
                await resolveWebOpenFolder(trimmed)
            } else {
                // Normal tile/footer path: open the project via the standard
                // onOpenRecent callback.
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
            // Scroll to visible area
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

    // ── Folder step copy by path ──────────────────────────────────────────────
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
                        `Show which violations are auto-fixable and which need manual work`,
                        `Generate a governance report with a health score`,
                    ]
                    : selectedPath === 'dashboard'
                        ? [
                            `Connect ${BRAND.viewer} to your active IDE session`,
                            `Show live governance state without interrupting your editor`,
                            `Surface violations, overrides, and drift as they happen`,
                        ]
                        : [
                            `Detect your stack (Tailwind, CSS custom properties, Chakra, MUI, etc.)`,
                            `Extract all design tokens into ${BRAND.product}'s token format`,
                            `Index every component with its TypeScript prop types`,
                            `Show your design system health score (A-F grade)`,
                        ],
    }

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
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* 1. Header */}
            <header className="flex shrink-0 items-center border-b border-zinc-800 px-6 py-4">
                <div>
                    <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                        {BRAND.product}
                    </h1>
                    <p className="mt-0.5 text-xs text-zinc-500">AI governance for your design system</p>
                </div>
            </header>

            {/* Main scroll container */}
            <main className="flex flex-1 items-start justify-center overflow-y-auto pt-10 pb-10">
                <div className="w-full max-w-md px-4">

                    {/* 2. MCP context banner */}
                    {mcpConnected && (
                        <div className="mb-4 flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-900/20 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                <span className="text-xs text-zinc-400">
                                    MCP connected
                                    {connectedProjectName && (
                                        <> · <span className="font-medium text-zinc-300">{connectedProjectName}</span></>
                                    )}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (recentProjects[0]) {
                                        void handleOpenRecent(recentProjects[0])
                                    }
                                }}
                                className="flex items-center gap-1 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                            >
                                Open this project
                                <ArrowRight size={11} />
                            </button>
                        </div>
                    )}

                    {/* 3. Primary CTA — Open Canvas */}
                    <button
                        type="button"
                        onClick={() => { void onNewProject() }}
                        aria-label="Start a new project"
                        className="group mb-6 flex w-full items-center gap-3 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/20 to-indigo-500/10 px-5 py-4 text-left transition-all hover:border-indigo-500/50 hover:from-indigo-600/30 hover:to-indigo-500/20"
                    >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-300 transition-colors group-hover:bg-indigo-600/40">
                            <Zap size={18} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-zinc-100">New Project</p>
                            <p className="text-xs text-zinc-400">Start building immediately. No setup required.</p>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
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
                                        <tile.icon size={15} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={[
                                            'text-xs font-medium leading-none',
                                            isActive ? 'text-zinc-100' : 'text-zinc-300',
                                        ].join(' ')}>
                                            {tile.label}
                                        </p>
                                        <p className="mt-1 text-[11px] leading-none text-zinc-500">
                                            {tile.description}
                                        </p>
                                    </div>
                                    <ChevronRight
                                        size={13}
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
                                    {/* Prerequisite callout */}
                                    <div className="border border-amber-400 bg-amber-950/30 rounded-lg p-3 mb-4">
                                        <p className="text-xs font-medium text-amber-300 mb-1">
                                            Install the {BRAND.product} Figma plugin before continuing.
                                        </p>
                                        <a
                                            href="https://figma.com/community"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-amber-400 underline hover:text-amber-300 transition-colors"
                                        >
                                            Get plugin →
                                        </a>
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
                                    {/* Web mode: path text input (no native file dialog) */}
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
                                                <p className="mt-1.5 text-[11px] text-red-400">{webPathError}</p>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => { void handleFolderStep() }}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-6 py-3.5 text-sm font-medium text-indigo-300 transition-colors hover:border-indigo-500/60 hover:bg-indigo-600/30"
                                    >
                                        <FolderOpen size={16} />
                                        {isWebMode ? 'Enter project path' : 'Choose folder'}
                                    </button>
                                    <SkipLink onClick={handleSkip} />
                                </div>
                            )}

                            {/* Progress step */}
                            {flowStep === 'progress' && (
                                <div className="flex flex-col items-center py-8">
                                    <Loader2 size={28} className="animate-spin text-indigo-400" />
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

                    {/* 7. Demo section */}
                    <div className="mt-8">
                        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                            Try a demo project
                        </p>
                        {/* Primary demo CTA */}
                        <button
                            type="button"
                            onClick={() => { void onLoadDemo('a11y-audit') }}
                            className="group mb-3 flex w-full items-center gap-3 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/20 to-indigo-500/10 px-5 py-4 text-left transition-all hover:border-indigo-500/50 hover:from-indigo-600/30 hover:to-indigo-500/20"
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-300 transition-colors group-hover:bg-indigo-600/40">
                                <Shield size={18} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-zinc-100">Try the demo</p>
                                <p className="text-xs text-zinc-400">A11y Audit · 5 min · WCAG 2.1 AA</p>
                            </div>
                            <ChevronRight size={16} className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
                        </button>
                        {/* More demos toggle */}
                        <button
                            type="button"
                            onClick={() => setShowMoreDemos((v) => !v)}
                            className="mb-2 flex w-full items-center justify-center gap-1 text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
                        >
                            {showMoreDemos ? 'Hide demos' : 'More demos'}
                            <ChevronRight
                                size={11}
                                className={['shrink-0 transition-transform', showMoreDemos ? 'rotate-90' : ''].join(' ')}
                            />
                        </button>
                        {/* Collapsible additional demos */}
                        {showMoreDemos && (
                            <div className="flex gap-2 overflow-x-auto pb-1" data-testid="more-demos-section">
                                {DEMO_PROJECTS.map((demo) => (
                                    <div
                                        key={demo.name}
                                        className="flex w-40 shrink-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                                    >
                                        <p className="text-xs font-semibold text-zinc-200">{demo.title}</p>
                                        <p className="mt-0.5 text-[11px] text-zinc-500">
                                            {demo.time} · {demo.topic}
                                        </p>
                                        <p className="mt-2 flex-1 text-[11px] leading-relaxed text-zinc-400">
                                            {demo.outcome}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => { void onLoadDemo(demo.name) }}
                                            className="mt-3 w-full rounded-md border border-zinc-700 bg-zinc-800/60 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700/60 hover:text-zinc-100"
                                        >
                                            Load
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 8. Recent projects */}
                    {!loading && recentProjects.length > 0 && (
                        <div className="mt-8">
                            <div className="mb-2 flex items-center gap-2">
                                <Clock size={11} className="text-zinc-600" />
                                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                                    Reopen a project
                                </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                {recentProjects.slice(0, 5).map((project) => {
                                    const isOpening = openingPath === project.path
                                    // Show up to ~40 chars of path, truncating from the left
                                    const displayPath = project.path.length > 40
                                        ? '...' + project.path.slice(-37)
                                        : project.path
                                    return (
                                        <div key={project.id} className="group flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 transition-colors hover:border-zinc-700/50 hover:bg-zinc-800/30">
                                            <FolderOpen size={13} className="shrink-0 text-zinc-600 group-hover:text-indigo-400/70 transition-colors" />
                                            <button
                                                type="button"
                                                onClick={() => { void handleOpenRecent(project) }}
                                                disabled={isOpening}
                                                className="flex flex-1 min-w-0 items-center gap-2 text-left"
                                            >
                                                <span className="text-xs font-medium text-zinc-300 truncate">
                                                    {isOpening ? 'Opening...' : project.name}
                                                </span>
                                                <span className="text-[11px] text-zinc-600 truncate min-w-0">
                                                    {displayPath}
                                                </span>
                                            </button>
                                            <ArrowRight size={12} className="shrink-0 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <button
                                                type="button"
                                                aria-label="Remove from recent"
                                                onClick={(e) => handleRemove(e, project.id)}
                                                className="shrink-0 rounded p-0.5 text-zinc-700 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* 9. Footer actions */}
                    <div className="mt-6 flex flex-col items-center gap-3">
                        {/* Web mode: standalone path input when no tile is expanded */}
                        {isWebMode && !selectedPath && (
                            <div className="w-full">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={webPathInput}
                                        onChange={(e) => { setWebPathInput(e.target.value); setWebPathError(null) }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') void handleWebPathSubmit() }}
                                        placeholder="Enter project path..."
                                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-indigo-500/40"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { void handleWebPathSubmit() }}
                                        className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800/40 px-3 py-2 text-xs text-zinc-400 transition-colors hover:text-zinc-300"
                                    >
                                        Open
                                    </button>
                                </div>
                                {webPathError && !selectedPath && (
                                    <p className="mt-1 text-center text-[11px] text-red-400">{webPathError}</p>
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
                                        <Link2 size={11} />
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StepHeader({ number, title, subtitle }: { number: number; title: string; subtitle: string }) {
    return (
        <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600/30 text-[10px] font-bold text-indigo-300">
                    {number}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
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
                className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
                Skip — open canvas instead
            </button>
        </div>
    )
}
