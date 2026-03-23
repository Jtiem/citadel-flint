import { useState, useEffect, useCallback, useRef } from 'react'
import { BRAND } from '../shared/brand'
import './index.css'
// ── Phase N.1: Bootstrap the Abstract Syntax Protocol (ASP) ──────────────────
import { LanguageRegistry } from './core/adapters/types'
import { reactAdapter } from './core/adapters/ReactAdapter'
import { htmlAdapter } from './core/adapters/HtmlAdapter'
import { vueAdapter } from './core/adapters/VueAdapter'
LanguageRegistry.register(['ts', 'tsx', 'js', 'jsx'], reactAdapter)
LanguageRegistry.register(['html'], htmlAdapter)
LanguageRegistry.register(['vue'], vueAdapter)
// ─────────────────────────────────────────────────────────────────────────────
import { XYCanvas } from './components/editor/XYCanvas'
import { LayerTree } from './components/ui/LayerTree'
import { AssetsPanel } from './components/editor/AssetsPanel'

import { PropertiesPanel } from './components/ui/PropertiesPanel'
import { TokenManager } from './components/ui/TokenManager'
import { ActivityFeed } from './components/ui/ActivityFeed'
import { RecoveryPanel } from './components/ui/RecoveryPanel'
import { ExportModal } from './components/ui/ExportModal'
import { GovernancePanel } from './components/ui/GovernancePanel'
import { GovernanceDashboard } from './components/ui/GovernanceDashboard'
import { AgentDashboard } from './components/ui/AgentDashboard'
import { ComponentScopePanel } from './components/ui/ComponentScopePanel'
import { NotificationCenter } from './components/ui/NotificationCenter'
import { OnboardingOverlay } from './components/ui/OnboardingOverlay'
// Phase ING.2: Import Summary toast + panel
import { ImportSummaryToastMount, ImportSummaryPanelView } from './components/ui/ImportSummary'
import { useImportSummaryStore } from './store/importSummaryStore'
import { StatusBar } from './components/editor/StatusBar'
import { ResizeHandle } from './components/ui/ResizeHandle'
import { useTokenStore } from './store/tokenStore'
import { useNotificationStore } from './store/notificationStore'
import { useCanvasStore } from './store/canvasStore'
import { useEditorStore } from './store/editorStore'
import { useAnnotationStore } from './store/annotationStore'
import { useComponentCardStore } from './store/componentCardStore'
import type { FileTreeNode } from './types/flint-api'
import { applyUndo, applyRedo } from './core/recoveryController'
import { MithrilProvider } from './components/mithril/MithrilProvider'
import { LaunchScreen } from './components/ui/LaunchScreen'
import { SetupWizard } from './components/ui/SetupWizard'
import { BetaWelcome, shouldShowBetaWelcome } from './components/ui/BetaWelcome'
import { useContextSync } from './hooks/useContextSync'
import { useMCPEventListener } from './hooks/useMCPEventListener'
import { useAutopilot } from './hooks/useAutopilot'
import { ShieldAlert, ShieldCheck, Settings2, SlidersHorizontal, Palette, Activity, Bot, History, Layers, MoreHorizontal } from 'lucide-react'
import { OnboardingNudge } from './components/ui/OnboardingNudge'
import { CommandPalette } from './components/ui/CommandPalette'

// ── Panel width constraints ───────────────────────────────────────────────────
const PANEL_MIN = 160
const PANEL_MAX = 400

// ── Primary file selection ────────────────────────────────────────────────────
function findPrimaryFile(tree: FileTreeNode): string | null {
    const files: { name: string; path: string }[] = []
    function walk(node: FileTreeNode) {
        if (node.type === 'file') files.push({ name: node.name, path: node.path })
        node.children?.forEach(walk)
    }
    walk(tree)
    const PRIORITY = ['App.tsx', 'index.tsx', 'main.tsx', 'App.ts', 'index.ts']
    for (const p of PRIORITY) {
        const found = files.find((f) => f.name === p)
        if (found) return found.path
    }
    return files[0]?.path ?? null
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
    const [leftTab, setLeftTab] = useState<'layers' | 'assets'>('layers')
    const rightTab    = useCanvasStore((s) => s.rightTab)
    const setRightTab = useCanvasStore((s) => s.setRightTab)
    const [ipcStatus, setIpcStatus] = useState<string>('Connecting…')
    const [ipcOk, setIpcOk] = useState<boolean>(false)
    const [showExportModal, setShowExportModal] = useState(false)
    const [showGovernancePanel, setShowGovernancePanel] = useState(false)
    const [showProjectMenu, setShowProjectMenu] = useState(false)
    const [isLoadingProject, setIsLoadingProject] = useState(false)

    // ── Setup Wizard gate (ONBOARD.1) ─────────────────────────────────────────
    const [setupComplete, setSetupComplete] = useState<boolean | null>(null)
    // ── Beta Welcome gate ──────────────────────────────────────────────────────
    // Default to done (no blank flash). The useEffect below flips this to false
    // only when we confirm this is a beta build AND the welcome hasn't been shown.
    const [betaWelcomeDone, setBetaWelcomeDone] = useState(true)
    // ── Auto-resume gate (LAUNCH.2) ──────────────────────────────────────────
    // Tracks whether we've attempted to restore the last session.
    // null = not checked yet, true = attempted (regardless of outcome)
    const [autoResumeChecked, setAutoResumeChecked] = useState(false)
    const [betaInfo, setBetaInfo] = useState<{ buildId: string; daysRemaining: number | null } | null>(null)
    // Phase ING.2: true when Import Summary panel takes over the right sidebar
    const importSummaryPanelMode = useImportSummaryStore((s) => s.isPanelMode)

    // ── Resizable panel widths ────────────────────────────────────────────────
    const [leftWidth, setLeftWidth] = useState(224)   // w-56 default
    const [rightWidth, setRightWidth] = useState(288) // w-72 default

    const handleLeftDrag = useCallback((delta: number) => {
        setLeftWidth((w) => Math.max(PANEL_MIN, Math.min(PANEL_MAX, w + delta)))
    }, [])

    const handleRightDrag = useCallback((delta: number) => {
        setRightWidth((w) => Math.max(PANEL_MIN, Math.min(PANEL_MAX, w - delta)))
    }, [])

    const fetchTokens = useTokenStore((s) => s.fetchTokens)
    const pushNotification = useNotificationStore((s) => s.push)
    const fetchAnnotations = useAnnotationStore((s) => s.fetchAnnotations)

    // Workspace state
    const setActiveFile = useCanvasStore((s) => s.setActiveFile)
    const setWorkspaceFiles = useCanvasStore((s) => s.setWorkspaceFiles)
    const workspaceFiles = useCanvasStore((s) => s.workspaceFiles)
    const saveState = useCanvasStore((s) => s.saveState)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)
    const closeWorkspace = useCanvasStore((s) => s.closeWorkspace)
    const canExport = useCanvasStore((s) => s.canExport)

    const activeFileName = activeFilePath ? activeFilePath.split('/').pop() ?? null : null

    // ── Context Flint (Phase 1A) ─────────────────────────────────────────────
    useContextSync()

    // ── Phase W.1: MCP-to-Glass Push Channel ─────────────────────────────────
    // Subscribes to flint:mcp-event IPC events and dispatches to stores.
    // Must be called once at the App root — never inside child components.
    useMCPEventListener()

    // ── Phase REM.2.2: Governance Autopilot lifecycle ─────────────────────────
    // Enables/disables the autopilot watcher and stores governed diff results.
    // Must be called once at App root so the effect is tied to workspace lifetime.
    useAutopilot()

    // ── Shared hydrate helper ─────────────────────────────────────────────────
    const hydrateWorkspace = async (tree: FileTreeNode) => {
        setWorkspaceFiles(tree)
        const primaryPath = findPrimaryFile(tree)
        if (primaryPath) await setActiveFile(primaryPath)
    }

    const handleOpenFolder = async () => {
        const tree = await window.flintAPI.openFolder()
        if (!tree) return
        setIsLoadingProject(true)
        try {
            void window.flintAPI.registry.upsertProject({ name: tree.name, path: tree.path })
            await hydrateWorkspace(tree as FileTreeNode)
        } finally {
            setIsLoadingProject(false)
        }
    }

    // One click → canvas. No folder picker. Scaffolds instantly into
    // ~/{Product} Projects/Untitled-N via the project:create-scratchpad IPC handler.
    const handleNewProject = async () => {
        setIsLoadingProject(true)
        try {
            const tree = await window.flintAPI.project.createScratchpad()
            await hydrateWorkspace(tree as FileTreeNode)
        } catch (err) {
            pushNotification({
                type: 'error',
                title: 'Failed to create project',
                message: err instanceof Error ? err.message : 'Unknown error',
                severity: 'error',
                autoDismissMs: 0,
            })
        } finally {
            setIsLoadingProject(false)
        }
    }

    // "Save Project As..." — lets users relocate a scratchpad to a permanent home.
    // Shows the folder picker and, if a new folder is chosen, opens it as the
    // active project. A full file-copy "relocate" is a planned follow-up; for
    // now this opens the chosen folder so the user can move files manually.
    const handleSaveProjectAs = async () => {
        const targetPath = await window.flintAPI.selectFolder()
        if (!targetPath) return
        try {
            const tree = await window.flintAPI.project.openPath(targetPath)
            if (tree) {
                void window.flintAPI.registry.upsertProject({ name: tree.name, path: tree.path })
                await hydrateWorkspace(tree as FileTreeNode)
            } else {
                pushNotification({
                    type: 'error',
                    title: 'Save Project As Failed',
                    message: 'Could not open the selected folder as a project.',
                    severity: 'error',
                    autoDismissMs: 0,
                })
            }
        } catch (err) {
            pushNotification({
                type: 'error',
                title: 'Save Project As Failed',
                message: err instanceof Error ? err.message : 'Unknown error',
                severity: 'error',
                autoDismissMs: 0,
            })
        }
    }

    const handleOpenRecent = async (projectPath: string) => {
        const tree = await window.flintAPI.project.openPath(projectPath)
        if (!tree) return
        await hydrateWorkspace(tree as FileTreeNode)
    }

    const handleLoadDemo = async () => {
        const targetPath = await window.flintAPI.selectFolder()
        if (!targetPath) return
        const tree = await window.flintAPI.project.initialize({
            targetPath,
            templateId: 'flint-demo',
        })
        await hydrateWorkspace(tree as FileTreeNode)
    }

    // ── IPC health check ──────────────────────────────────────────────────────
    useEffect(() => {
        window.flintAPI
            .ping()
            .then((response) => {
                setIpcStatus(response)
                setIpcOk(true)
            })
            .catch((err: Error) => {
                setIpcStatus(`IPC Error: ${err.message}`)
                setIpcOk(false)
            })
    }, [])

    // ── Token sync + Figma notification ───────────────────────────────────────
    useEffect(() => {
        window.flintAPI.onTokensUpdated(() => {
            fetchTokens()
            pushNotification({
                type: 'sync',
                title: 'Figma Sync',
                message: 'Design tokens updated from Figma',
                severity: 'success',
                autoDismissMs: 4000,
            })
        })

        const tokens = useTokenStore.getState().tokens
        if (tokens.length === 0) {
            import('./core/seedTokens').then(({ seedTokens }) => seedTokens())
        }

        return () => {
            window.flintAPI.removeTokensUpdatedListener()
        }
    }, [fetchTokens, pushNotification])

    // ── File watcher (Phase 1C) ───────────────────────────────────────────────
    useEffect(() => {
        if (!window.flintAPI?.onFileChanged) return

        window.flintAPI.onFileChanged((data: { filePath: string; content: string }) => {
            const currentFile = useCanvasStore.getState().activeFilePath
            if (data.filePath === currentFile) {
                useEditorStore.getState().syncCode(data.content)
                pushNotification({
                    type: 'mutation',
                    title: 'File Updated',
                    message: `${data.filePath.split('/').pop()} was modified externally`,
                    severity: 'info',
                    autoDismissMs: 3000,
                })
            }
        })

        return () => {
            window.flintAPI.removeFileChangedListener?.()
        }
    }, [pushNotification])

    // ── Phase COLLAB.4: Annotation push subscription ──────────────────────────
    // Mounts once on workspace load. The main process fs.watch sends
    // 'flint:annotations-changed' whenever .flint/annotations.json is written
    // by an MCP tool. We re-fetch immediately so the store and UI are always
    // current without polling.
    useEffect(() => {
        if (!window.flintAPI?.annotations) return

        // Fetch on mount to populate initial state
        void fetchAnnotations()

        // Subscribe to push events from the main-process fs.watch
        window.flintAPI.annotations.onChanged(() => {
            void fetchAnnotations()
        })

        return () => {
            window.flintAPI.annotations?.removeChangedListener()
        }
    }, [fetchAnnotations])

    // ── CV2.3: Cross-store coordination (selectedCardId → activeFile) ────────
    // When a component card is selected on the canvas, load its source file in
    // the preview and switch the right sidebar to the Properties tab.
    //
    // This effect intentionally uses getState() reads (not selectors) for the
    // canvasStore calls — it only needs to call actions, not subscribe to state.
    // The selectedCardId and cards subscriptions are the only reactive triggers.
    //
    // Cross-store contamination rule: this is the ONLY place where componentCardStore
    // data drives canvasStore actions. The stores themselves do NOT import each other.
    const selectedCardId = useComponentCardStore((s) => s.selectedCardId)
    const cards = useComponentCardStore((s) => s.cards)
    // Track the previous selectedCardId to avoid firing the effect on every render
    const prevSelectedCardIdRef = useRef<string | null>(null)

    useEffect(() => {
        // Skip if no change in selection
        if (selectedCardId === prevSelectedCardIdRef.current) return
        prevSelectedCardIdRef.current = selectedCardId

        if (selectedCardId) {
            const card = cards.find((c) => c.id === selectedCardId)
            if (card?.filePath) {
                void useCanvasStore.getState().setActiveFile(card.filePath)
                useCanvasStore.getState().setRightTab('properties')
            }
        }
    }, [selectedCardId, cards])

    // ── Global keyboard shortcuts ─────────────────────────────────────────────
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent): void {
            // ⌘K — Command Palette (fires even when an input is focused)
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'k') {
                e.preventDefault()
                useCanvasStore.getState().setCommandPaletteOpen(true)
                return
            }

            if (
                document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA' ||
                document.activeElement?.tagName === 'SELECT'
            ) return

            if (e.key === 'Backspace' || e.key === 'Delete') {
                const activeSelection = useCanvasStore.getState().activeSelection
                if (activeSelection) {
                    e.preventDefault()
                    useEditorStore.getState().applyBatch([{ op: 'deleteNode', nodeId: activeSelection }])
                    useCanvasStore.getState().setActiveSelection(null)
                }
                return
            }

            const meta = e.metaKey || e.ctrlKey
            if (!meta) return

            // ── CV2.1: Canvas View shortcuts ─────────────────────────────────
            if (!e.shiftKey) {
                if (e.key === '1') {
                    e.preventDefault()
                    useCanvasStore.getState().setCanvasView('preview')
                    return
                }
                if (e.key === '2') {
                    e.preventDefault()
                    useCanvasStore.getState().setCanvasView('build')
                    return
                }
                if (e.key === '3') {
                    e.preventDefault()
                    useCanvasStore.getState().setCanvasView('govern')
                    return
                }
            }

            // Cmd/Ctrl+Shift+G — Apply Governed Version (Autopilot)
            if (e.shiftKey && (e.key === 'g' || e.key === 'G')) {
                e.preventDefault()
                const { governedCode, autopilotEnabled, clearGovernedResult } = useCanvasStore.getState()
                if (autopilotEnabled && governedCode) {
                    useEditorStore.getState().setCode(governedCode)
                    clearGovernedResult()
                    useNotificationStore.getState().push({
                        type: 'mutation',
                        title: 'Governance Applied',
                        message: 'Auto-fixes applied to active file.',
                        severity: 'success',
                        autoDismissMs: 4000,
                    })
                }
                return
            }

            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault()
                const desc = applyUndo()
                if (desc) {
                    useNotificationStore.getState().push({
                        type: 'undo',
                        title: 'Undone',
                        message: typeof desc === 'string' ? desc : 'AST mutation reversed',
                        severity: 'info',
                        autoDismissMs: 2500,
                        actionLabel: 'Redo',
                        actionCallback: () => { void applyRedo() },
                    })
                }
            } else if (
                (e.key === 'z' && e.shiftKey) ||
                (e.ctrlKey && !e.metaKey && e.key === 'y')
            ) {
                e.preventDefault()
                const desc = applyRedo()
                if (desc) {
                    useNotificationStore.getState().push({
                        type: 'undo',
                        title: 'Redone',
                        message: typeof desc === 'string' ? desc : 'AST mutation reapplied',
                        severity: 'info',
                        autoDismissMs: 2500,
                    })
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => { window.removeEventListener('keydown', handleKeyDown) }
    }, [])

    // ── Native OS menu events ─────────────────────────────────────────────────
    useEffect(() => {
        window.flintAPI.menu.onNewProject(() => { void handleNewProject() })
        window.flintAPI.menu.onOpenProject(() => { void handleOpenFolder() })
        window.flintAPI.menu.onCloseProject(() => { closeWorkspace() })
        window.flintAPI.menu.onSaveProjectAs(() => { void handleSaveProjectAs() })
        window.flintAPI.menu.onResetState(async () => {
            try {
                await window.flintAPI.setup?.resetState()
            } catch {
                // IPC failure — setup.json may still exist, but proceed with
                // the local clear+reload so the renderer resets cleanly.
            }
            localStorage.clear()
            window.location.reload()
        })
        return () => { window.flintAPI.menu.removeMenuListeners() }
    }, [closeWorkspace])

    // ── save-project-as custom event (fired by StatusBar scratchpad chip) ──
    useEffect(() => {
        const handler = () => { void handleSaveProjectAs() }
        const eventName = `${BRAND.productLower}:save-project-as`
        window.addEventListener(eventName, handler)
        return () => { window.removeEventListener(eventName, handler) }
    }, [])

    // ── Project overflow menu: close on outside click ─────────────────────────
    useEffect(() => {
        if (!showProjectMenu) return
        const handler = (e: MouseEvent) => {
            const target = e.target as Node
            const menu = document.getElementById('project-overflow-menu')
            const btn  = document.getElementById('project-overflow-btn')
            if (menu && !menu.contains(target) && btn && !btn.contains(target)) {
                setShowProjectMenu(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => { document.removeEventListener('mousedown', handler) }
    }, [showProjectMenu])

    // ── Setup Wizard first-launch check (ONBOARD.1) ──────────────────────────
    useEffect(() => {
        // 3-second timeout fallback — if the IPC call hangs, skip the wizard
        const timer = setTimeout(() => setSetupComplete(true), 3000)
        window.flintAPI.setup
            ?.checkFirstLaunch()
            .then(({ isFirstLaunch }: { isFirstLaunch: boolean }) => {
                clearTimeout(timer)
                setSetupComplete(!isFirstLaunch)
            })
            .catch(() => {
                clearTimeout(timer)
                // On IPC failure skip the wizard so the app isn't blocked
                setSetupComplete(true)
            })
        return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Beta Welcome check (runs once after setup wizard resolves) ────────────
    // Defaults to done=true so non-beta builds never flash. Only flips to false
    // when we confirm this is a beta build AND the welcome hasn't been shown.
    useEffect(() => {
        if (!shouldShowBetaWelcome()) return
        window.flintAPI.beta?.getInfo()
            .then((info) => {
                if (info.isBeta) {
                    setBetaInfo({ buildId: info.buildId, daysRemaining: info.daysRemaining })
                    setBetaWelcomeDone(false)
                }
            })
            .catch(() => { /* not a beta build or API unavailable */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Auto-resume: restore last session if available (LAUNCH.2) ────────────
    // Runs once after setup + beta gates resolve. If a prior session exists on
    // disk, opens it directly — the user never sees the LaunchScreen.
    useEffect(() => {
        if (setupComplete !== true || !betaWelcomeDone) return
        if (autoResumeChecked) return
        if (workspaceFiles) return // already hydrated (e.g. demo loaded)

        setAutoResumeChecked(true)
        window.flintAPI.session
            ?.getLastSession()
            .then(async (session) => {
                if (!session) return
                // Don't auto-resume empty scratchpads — let the user choose
                if (session.isScratchpad) return
                try {
                    const tree = await window.flintAPI.project.openPath(session.path)
                    if (tree) await hydrateWorkspace(tree as FileTreeNode)
                } catch {
                    // Path no longer valid — fall through to LaunchScreen
                }
            })
            .catch(() => {
                // IPC unavailable — fall through to LaunchScreen
            })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setupComplete, betaWelcomeDone])

    // Loading project — show a neutral screen instead of flashing white
    if (isLoadingProject) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-gray-950 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-500" />
                <p className="text-xs text-gray-500 tracking-wide">Opening project…</p>
            </div>
        )
    }

    // While checking first-launch status, render nothing (avoids flash)
    if (setupComplete === null) return null

    // If first launch, show the wizard instead of LaunchScreen
    if (!setupComplete) {
        return <SetupWizard onComplete={() => setSetupComplete(true)} />
    }

    // ── Beta Welcome gate ─────────────────────────────────────────────────────
    if (!betaWelcomeDone && betaInfo) {
        return (
            <BetaWelcome
                buildId={betaInfo.buildId}
                daysRemaining={betaInfo.daysRemaining}
                onTryDemo={async () => {
                    const result = await window.flintAPI.beta?.loadDemoProject()
                    if (result && 'projectPath' in result) {
                        const tree = await window.flintAPI.project.openPath(result.projectPath)
                        if (tree) {
                            setBetaWelcomeDone(true)
                            await hydrateWorkspace(tree as FileTreeNode)
                        }
                    } else {
                        setBetaWelcomeDone(true)
                    }
                }}
                onSkip={() => setBetaWelcomeDone(true)}
            />
        )
    }

    // ── LaunchScreen gate ─────────────────────────────────────────────────────
    if (!workspaceFiles) {
        return (
            <LaunchScreen
                onOpenFolder={() => handleOpenFolder()}
                onNewProject={() => handleNewProject()}
                onOpenRecent={(p) => handleOpenRecent(p)}
                onLoadDemo={() => handleLoadDemo()}
            />
        )
    }

    return (
        <div className="flex h-screen flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
            {/* ── Top bar ────────────────────────────────────────────────── */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-6 py-3">
                <div className="flex flex-col">
                    <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                        {BRAND.viewerTitle}
                    </h1>
                    {activeFileName && (
                        <span
                            className="max-w-[200px] truncate font-mono text-[10px] text-zinc-400"
                            title={activeFilePath ?? ''}
                        >
                            {activeFileName}
                        </span>
                    )}
                </div>

                {/* IPC health pill */}
                <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-2">
                    <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${ipcOk
                            ? 'bg-emerald-400 shadow-lg shadow-emerald-400/40'
                            : 'animate-pulse bg-amber-400'
                            }`}
                    />
                    <span className="font-mono text-xs text-gray-300">
                        {ipcStatus}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {saveState !== 'idle' && (
                        <div className="flex items-center gap-1.5">
                            <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${saveState === 'editing'
                                    ? 'bg-amber-400'
                                    : saveState === 'saving'
                                        ? 'animate-pulse bg-blue-400'
                                        : 'bg-emerald-400'
                                    }`}
                            />
                            <span className="font-mono text-[10px] text-gray-400">
                                {saveState === 'editing' ? 'Editing…' : saveState === 'saving' ? 'Saving…' : 'Saved'}
                            </span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowExportModal(true)}
                        title={canExport() ? 'Export-ready' : 'Export blocked by violations'}
                        className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${canExport()
                            ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40'
                            : 'border-amber-700/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/40'
                            }`}
                    >
                        {canExport() ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                        Export
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowGovernancePanel(true)}
                        title="Governance Rules"
                        aria-label="Governance Rules"
                        className="flex items-center rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-300 transition-colors hover:border-indigo-500/50 hover:bg-gray-700 hover:text-white"
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                    </button>

                    <div className="relative">
                        <button
                            id="project-overflow-btn"
                            type="button"
                            onClick={() => setShowProjectMenu((v) => !v)}
                            title="Project options"
                            aria-label="Project options"
                            className="flex items-center rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-300 transition-colors hover:border-indigo-500/50 hover:bg-gray-700 hover:text-white"
                        >
                            <MoreHorizontal size={14} />
                        </button>

                        {showProjectMenu && (
                            <div
                                id="project-overflow-menu"
                                className="absolute right-0 top-full mt-1 z-50 w-44 rounded border border-zinc-700 bg-zinc-900 shadow-xl"
                            >
                                <button
                                    type="button"
                                    onClick={() => { setShowProjectMenu(false); void handleOpenFolder() }}
                                    className="flex w-full items-center px-3 py-2 text-[11px] text-zinc-100 hover:bg-zinc-800 transition-colors"
                                >
                                    Open Folder
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowProjectMenu(false); closeWorkspace() }}
                                    className="flex w-full items-center px-3 py-2 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
                                >
                                    Close Project
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Three-panel Glass workspace ────────────────────────────── */}
            {/*  [Left: Layers/Assets]  [Center: Canvas]  [Right: Properties/Tokens/Activity]  */}
            <main className="flex min-h-0 flex-1">
                {/* Left panel: Navigation (Layers / Assets) */}
                <section
                    style={{ width: leftWidth, minWidth: PANEL_MIN, maxWidth: PANEL_MAX }}
                    className="flex min-h-0 shrink-0 flex-col border-r border-gray-800"
                >
                    <div className="flex shrink-0 border-b border-gray-800">
                        {(['layers', 'assets'] as const).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setLeftTab(tab)}
                                className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${leftTab === tab
                                    ? 'border-b-2 border-indigo-500 text-indigo-400'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {leftTab === 'layers' && <LayerTree />}
                        {leftTab === 'assets' && <AssetsPanel />}

                    </div>
                </section>

                <ResizeHandle onDrag={handleLeftDrag} />

                {/* Center: Infinite canvas */}
                <section className="flex min-h-0 flex-1 flex-col">
                    <MithrilProvider>
                        <XYCanvas />
                    </MithrilProvider>
                </section>

                <ResizeHandle onDrag={handleRightDrag} />

                {/* Right panel: Inspection (Properties / Tokens / Activity) */}
                <section
                    style={{ width: rightWidth, minWidth: PANEL_MIN, maxWidth: PANEL_MAX }}
                    className="flex min-h-0 shrink-0 flex-col border-l border-gray-800"
                >
                    {/* Onboarding nudge — shown above the tab bar for fresh projects */}
                    <OnboardingNudge
                        onConnectFigma={() => setRightTab('tokens')}
                        onStartEditing={() => setRightTab('properties')}
                    />

                    <div className="flex shrink-0 border-b border-gray-800">
                        {([
                            { tab: 'properties', Icon: SlidersHorizontal, label: 'Properties' },
                            { tab: 'tokens',     Icon: Palette,           label: 'Tokens'     },
                            { tab: 'activity',   Icon: Activity,          label: 'Activity'   },
                            { tab: 'health',     Icon: ShieldCheck,       label: 'Health'     },
                            { tab: 'agents',     Icon: Bot,               label: 'Agents'     },
                            { tab: 'scope',      Icon: Layers,            label: 'Scope'      },
                            { tab: 'recovery',   Icon: History,           label: 'Recovery'   },
                        ] as const).map(({ tab, Icon, label }) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setRightTab(tab)}
                                title={label}
                                className={`py-2 px-3 transition-colors ${rightTab === tab
                                    ? 'border-b-2 border-indigo-500 text-indigo-400'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <Icon size={14} />
                            </button>
                        ))}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {/* Phase ING.2: Import Summary panel takes priority */}
                        {importSummaryPanelMode ? (
                            <ImportSummaryPanelView />
                        ) : (
                            <>
                                {rightTab === 'properties' && <PropertiesPanel />}
                                {rightTab === 'tokens' && <TokenManager />}
                                {rightTab === 'activity' && <ActivityFeed />}
                                {rightTab === 'health' && <GovernanceDashboard />}
                                {rightTab === 'agents' && <AgentDashboard />}
                                {rightTab === 'scope' && <ComponentScopePanel />}
                                {rightTab === 'recovery' && <RecoveryPanel />}
                            </>
                        )}
                    </div>
                </section>
            </main>

            <StatusBar />

            {/* Phase ING.2: Import Summary toast (fixed bottom-right, above StatusBar) */}
            <ImportSummaryToastMount />

            {/* Overlays */}
            <OnboardingOverlay />
            {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
            {showGovernancePanel && <GovernancePanel onClose={() => setShowGovernancePanel(false)} />}
            {/* CP.1 — ⌘K Command Palette */}
            <CommandPalette
                onOpenExportModal={() => setShowExportModal(true)}
                onOpenGovernancePanel={() => setShowGovernancePanel(true)}
            />
            <NotificationCenter />
        </div>
    )
}

export default App
