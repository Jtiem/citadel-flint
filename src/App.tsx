import { useState, useEffect, useCallback } from 'react'
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
import { NotificationCenter } from './components/ui/NotificationCenter'
import { OnboardingOverlay } from './components/ui/OnboardingOverlay'
import { StatusBar } from './components/editor/StatusBar'
import { ResizeHandle } from './components/ui/ResizeHandle'
import { useTokenStore } from './store/tokenStore'
import { useNotificationStore } from './store/notificationStore'
import { useCanvasStore } from './store/canvasStore'
import { useEditorStore } from './store/editorStore'
import { useAnnotationStore } from './store/annotationStore'
import type { FileTreeNode } from './types/bridge-api'
import { applyUndo, applyRedo } from './core/recoveryController'
import { MithrilProvider } from './components/mithril/MithrilProvider'
import { LaunchScreen } from './components/ui/LaunchScreen'
import { useContextSync } from './hooks/useContextSync'
import { useMCPEventListener } from './hooks/useMCPEventListener'
import { ShieldAlert, ShieldCheck, Settings2 } from 'lucide-react'
import { OnboardingNudge } from './components/ui/OnboardingNudge'

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

    // ── Context Bridge (Phase 1A) ─────────────────────────────────────────────
    useContextSync()

    // ── Phase W.1: MCP-to-Glass Push Channel ─────────────────────────────────
    // Subscribes to bridge:mcp-event IPC events and dispatches to stores.
    // Must be called once at the App root — never inside child components.
    useMCPEventListener()

    // ── Shared hydrate helper ─────────────────────────────────────────────────
    const hydrateWorkspace = async (tree: FileTreeNode) => {
        setWorkspaceFiles(tree)
        const primaryPath = findPrimaryFile(tree)
        if (primaryPath) await setActiveFile(primaryPath)
    }

    const handleOpenFolder = async () => {
        const tree = await window.bridgeAPI.openFolder()
        if (!tree) return
        void window.bridgeAPI.registry.upsertProject({ name: tree.name, path: tree.path })
        await hydrateWorkspace(tree as FileTreeNode)
    }

    // One click → canvas. No folder picker. Scaffolds instantly into
    // ~/Bridge Projects/Untitled-N via the project:create-scratchpad IPC handler.
    const handleNewProject = async () => {
        try {
            const tree = await window.bridgeAPI.project.createScratchpad()
            await hydrateWorkspace(tree as FileTreeNode)
        } catch (err) {
            pushNotification({
                type: 'error',
                title: 'Failed to create project',
                message: err instanceof Error ? err.message : 'Unknown error',
                severity: 'error',
                autoDismissMs: 0,
            })
        }
    }

    // "Save Project As..." — lets users relocate a scratchpad to a permanent home.
    // Shows the folder picker and, if a new folder is chosen, opens it as the
    // active project. A full file-copy "relocate" is a planned follow-up; for
    // now this opens the chosen folder so the user can move files manually.
    const handleSaveProjectAs = async () => {
        const targetPath = await window.bridgeAPI.selectFolder()
        if (!targetPath) return
        try {
            const tree = await window.bridgeAPI.project.openPath(targetPath)
            if (tree) {
                void window.bridgeAPI.registry.upsertProject({ name: tree.name, path: tree.path })
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
        const tree = await window.bridgeAPI.project.openPath(projectPath)
        if (!tree) return
        await hydrateWorkspace(tree as FileTreeNode)
    }

    const handleLoadDemo = async () => {
        const targetPath = await window.bridgeAPI.selectFolder()
        if (!targetPath) return
        const tree = await window.bridgeAPI.project.initialize({
            targetPath,
            templateId: 'bridge-demo',
        })
        await hydrateWorkspace(tree as FileTreeNode)
    }

    // ── IPC health check ──────────────────────────────────────────────────────
    useEffect(() => {
        window.bridgeAPI
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
        window.bridgeAPI.onTokensUpdated(() => {
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
            window.bridgeAPI.removeTokensUpdatedListener()
        }
    }, [fetchTokens, pushNotification])

    // ── File watcher (Phase 1C) ───────────────────────────────────────────────
    useEffect(() => {
        if (!window.bridgeAPI?.onFileChanged) return

        window.bridgeAPI.onFileChanged((data: { filePath: string; content: string }) => {
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
            window.bridgeAPI.removeFileChangedListener?.()
        }
    }, [pushNotification])

    // ── Phase COLLAB.4: Annotation push subscription ──────────────────────────
    // Mounts once on workspace load. The main process fs.watch sends
    // 'bridge:annotations-changed' whenever .bridge/annotations.json is written
    // by an MCP tool. We re-fetch immediately so the store and UI are always
    // current without polling.
    useEffect(() => {
        if (!window.bridgeAPI?.annotations) return

        // Fetch on mount to populate initial state
        void fetchAnnotations()

        // Subscribe to push events from the main-process fs.watch
        window.bridgeAPI.annotations.onChanged(() => {
            void fetchAnnotations()
        })

        return () => {
            window.bridgeAPI.annotations?.removeChangedListener()
        }
    }, [fetchAnnotations])

    // ── Global keyboard shortcuts ─────────────────────────────────────────────
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent): void {
            if (document.activeElement?.closest('.monaco-editor') != null) return
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
        window.bridgeAPI.menu.onNewProject(() => { void handleNewProject() })
        window.bridgeAPI.menu.onOpenProject(() => { void handleOpenFolder() })
        window.bridgeAPI.menu.onCloseProject(() => { closeWorkspace() })
        window.bridgeAPI.menu.onSaveProjectAs(() => { void handleSaveProjectAs() })
        return () => { window.bridgeAPI.menu.removeMenuListeners() }
    }, [closeWorkspace])

    // ── bridge:save-project-as custom event (fired by StatusBar scratchpad chip) ──
    useEffect(() => {
        const handler = () => { void handleSaveProjectAs() }
        window.addEventListener('bridge:save-project-as', handler)
        return () => { window.removeEventListener('bridge:save-project-as', handler) }
    }, [])

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
                        Bridge Glass
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
                        title="Open Governance Rules"
                        className="flex items-center gap-1.5 rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-indigo-500/50 hover:bg-gray-700 hover:text-white"
                    >
                        <Settings2 className="h-3 w-3" />
                        Governance
                    </button>

                    <button
                        type="button"
                        onClick={() => { void handleOpenFolder() }}
                        className="rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-indigo-500/50 hover:bg-gray-700 hover:text-white"
                    >
                        Open Folder
                    </button>

                    <button
                        type="button"
                        onClick={closeWorkspace}
                        className="rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-red-500/40 hover:bg-gray-700 hover:text-red-400"
                    >
                        Close Project
                    </button>
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
                        {(['properties', 'tokens', 'activity', 'health', 'recovery'] as const).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setRightTab(tab)}
                                className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${rightTab === tab
                                    ? 'border-b-2 border-indigo-500 text-indigo-400'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {rightTab === 'properties' && <PropertiesPanel />}
                        {rightTab === 'tokens' && <TokenManager />}
                        {rightTab === 'activity' && <ActivityFeed />}
                        {rightTab === 'health' && <GovernanceDashboard />}
                        {rightTab === 'recovery' && <RecoveryPanel />}
                    </div>
                </section>
            </main>

            <StatusBar />

            {/* Overlays */}
            <OnboardingOverlay />
            {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
            {showGovernancePanel && <GovernancePanel onClose={() => setShowGovernancePanel(false)} />}
            <NotificationCenter />
        </div>
    )
}

export default App
