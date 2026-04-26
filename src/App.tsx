import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { BRAND } from '../shared/brand'
import './index.css'
// ── Phase N.1: Bootstrap the Abstract Syntax Protocol (ASP) ──────────────────
import { LanguageRegistry } from './core/adapters/types'
import { reactAdapter } from './core/adapters/ReactAdapter'
import { htmlAdapter } from './core/adapters/HtmlAdapter'
import { vueAdapter } from './core/adapters/VueAdapter'
import { svelteAdapter } from './core/adapters/SvelteAdapter'
LanguageRegistry.register(['ts', 'tsx', 'js', 'jsx'], reactAdapter)
LanguageRegistry.register(['html'], htmlAdapter)
LanguageRegistry.register(['vue'], vueAdapter as unknown as Parameters<typeof LanguageRegistry.register>[1])
LanguageRegistry.register(['svelte'], svelteAdapter as unknown as Parameters<typeof LanguageRegistry.register>[1])
// ─────────────────────────────────────────────────────────────────────────────
import { XYCanvas } from './components/editor/XYCanvas'
import { LayerTree } from './components/ui/LayerTree'
import { AssetsPanel } from './components/editor/AssetsPanel'
import { PropertiesPanel } from './components/ui/PropertiesPanel'
import { TokenManager } from './components/ui/TokenManager'
import { ExportModal } from './components/ui/ExportModal'
import { GovernancePanel } from './components/ui/GovernancePanel'
import { GovernanceDashboard } from './components/ui/GovernanceDashboard'
import { PanelErrorBoundary } from './components/ui/PanelErrorBoundary'
import { NotificationCenter } from './components/ui/NotificationCenter'
import { OnboardingOverlay } from './components/ui/OnboardingOverlay'
import { DemoWalkthrough } from './components/ui/DemoWalkthrough'
// Phase ING.2: Import Summary toast + panel
import { ImportSummaryToastMount, ImportSummaryPanelView } from './components/ui/ImportSummary'
import { useImportSummaryStore } from './store/importSummaryStore'
import { StatusBar } from './components/editor/StatusBar'
import { ResizeHandle } from './components/ui/ResizeHandle'
import { useTokenStore } from './store/tokenStore'
import { useNotificationStore } from './store/notificationStore'
import { useCanvasStore } from './store/canvasStore'
import { useEditorStore } from './store/editorStore'
import { useAnnotationStore, useAnnotations } from './store/annotationStore'
import { useComponentCardStore } from './store/componentCardStore'
import { useOrchestratorStore } from './store/orchestratorStore'
import type { FileTreeNode } from './types/flint-api'
import { applyUndo, applyRedo } from './core/recoveryController'
import { MithrilProvider } from './components/mithril/MithrilProvider'
import { LaunchScreen } from './components/ui/LaunchScreen'
import { tryAutoResume } from './lib/autoResume'
import { SetupWizard } from './components/ui/SetupWizard'
import { BetaWelcome, shouldShowBetaWelcome } from './components/ui/BetaWelcome'
import { TelemetryConsentDialog } from './components/ui/TelemetryConsentDialog'
import { FocusTrap } from './components/ui/FocusTrap'
import { TabUnlockTooltip } from './components/ui/TabUnlockTooltip'
import { TAB_NARRATION } from '../docs/contracts/sprint-clarity-2.contract'
import { useContextSync } from './hooks/useContextSync'
import { useMCPEventListener } from './hooks/useMCPEventListener'
import { useAutoTabSwitch } from './hooks/useAutoTabSwitch'
import { useAutopilot } from './hooks/useAutopilot'
import { useIDEFileSync } from './hooks/useIDEFileSync'
import { useTokenUsage } from './hooks/useTokenUsage'
import { Settings2, SlidersHorizontal, Palette, BarChart2, MoreHorizontal, ChevronLeft, ChevronRight, Layers, LayoutGrid, Image, Search, MessageSquare, Play, Loader2 } from 'lucide-react'
import { OnboardingNudge } from './components/ui/OnboardingNudge'
import { CommandPalette } from './components/ui/CommandPalette'
import { ComponentPanel } from './components/ui/ComponentPanel'
import { DetectionBanner } from './components/ui/DetectionBanner'
import type { ProjectEnvironment } from './types/flint-api'
import { AnnotationList } from './components/ui/AnnotationList'

// ── Panel width constraints ───────────────────────────────────────────────────
const PANEL_MIN = 160
const PANEL_MAX = 400

// ── Left sidebar tab display config ──────────────────────────────────────────
const LEFT_TAB_CONFIG: Record<string, { label: string; Icon: React.ElementType }> = {
    layers:     { label: 'Layers',     Icon: Layers },
    components: { label: 'Components', Icon: LayoutGrid },
    assets:     { label: 'Assets',     Icon: Image },
}

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
    const [leftTab, setLeftTab] = useState<'layers' | 'components' | 'assets'>('layers')
    const rightTab          = useCanvasStore((s) => s.rightTab)
    const setRightTab       = useCanvasStore((s) => s.setRightTab)
    const markTabOverridden = useCanvasStore((s) => s.markTabOverridden)
    const governanceRuleFilter = useCanvasStore((s) => s.governanceRuleFilter)
    const [ipcStatus, setIpcStatus] = useState<string>('Connecting…')
    const [ipcOk, setIpcOk] = useState<boolean>(false)
    const [showExportModal, setShowExportModal] = useState(false)
    // Mint UX A+ (C3): pending-token count for the ExportModal pre-emission row.
    // Fetched when the modal opens; undefined until then ("Not configured").
    const [pendingTokenCount, setPendingTokenCount] = useState<number | undefined>(undefined)
    useEffect(() => {
        if (!showExportModal) return
        const getPending = window.flintAPI?.tokens?.getPendingApprovals
        if (typeof getPending !== 'function') return
        let cancelled = false
        ;(async () => {
            try {
                const pending = await getPending()
                if (!cancelled) setPendingTokenCount(Array.isArray(pending) ? pending.length : 0)
            } catch (err) {
                if (!cancelled) {
                    console.warn('[Flint] App: failed to fetch pending tokens for ExportModal', err)
                    setPendingTokenCount(0)
                }
            }
        })()
        return () => { cancelled = true }
    }, [showExportModal])
    const [showGovernancePanel, setShowGovernancePanel] = useState(false)
    // OPP-15: rule ID to focus when GovernancePanel opens via "Configure rule" link
    const [governanceFocusRuleId, setGovernanceFocusRuleId] = useState<string | undefined>(undefined)
    // COUNSEL.4.3: Which tab to open GovernancePanel to
    const [governancePanelTab, setGovernancePanelTab] = useState<'rules' | 'packs' | 'profiles' | undefined>(undefined)
    const [showProjectMenu, setShowProjectMenu] = useState(false)
    const [isLoadingProject, setIsLoadingProject] = useState(false)
    // Server readiness indicator for web mode
    const [serverConnecting, setServerConnecting] = useState(false)

    // ── Setup Wizard gate (ONBOARD.1 / WS1 demo-first) ────────────────────────
    const [setupComplete, setSetupComplete] = useState<boolean | null>(null)
    // WS1: When true, the first-launch path auto-loaded a demo project
    const [demoAutoLoaded, setDemoAutoLoaded] = useState(false)
    // WS1: SetupWizard as a modal (deferred, not blocking)
    const [showSetupWizardModal, setShowSetupWizardModal] = useState(false)
    // ── Beta Welcome gate ──────────────────────────────────────────────────────
    // Default to done (no blank flash). The useEffect below flips this to false
    // only when we confirm this is a beta build AND the welcome hasn't been shown.
    const [betaWelcomeDone, setBetaWelcomeDone] = useState(true)
    // ── BETA.TEL: Telemetry consent gate ──────────────────────────────────────
    // null  = not yet checked (IPC in-flight)
    // true  = dialog should be visible (consent.state === 'unset')
    // false = dialog dismissed or consent already decided
    const [showTelemetryConsent, setShowTelemetryConsent] = useState<boolean | null>(null)
    // ── Auto-resume gate (LAUNCH.2) ──────────────────────────────────────────
    // Tracks whether we've attempted to restore the last session.
    // null = not checked yet, true = attempted (regardless of outcome)
    const [autoResumeChecked, setAutoResumeChecked] = useState(false)
    const [betaInfo, setBetaInfo] = useState<{ buildId: string; daysRemaining: number | null } | null>(null)
    // Phase ING.2: true when Import Summary panel takes over the right sidebar
    const importSummaryPanelMode = useImportSummaryStore((s) => s.isPanelMode)

    // ── FORGE.2d: Project environment detection state ─────────────────────────
    const [detectedEnvironment, setDetectedEnvironment] = useState<ProjectEnvironment | null>(null)
    // FORGE.4c: Scanning state for DetectionBanner progress bar
    const [isScanning, setIsScanning] = useState(false)

    // ── GLASS.3.2: Resizable + collapsible panel widths (from canvasStore) ──
    const leftWidth          = useCanvasStore((s) => s.leftPanelWidth)
    const rightWidth         = useCanvasStore((s) => s.rightPanelWidth)
    const leftCollapsed      = useCanvasStore((s) => s.leftPanelCollapsed)
    const rightCollapsed     = useCanvasStore((s) => s.rightPanelCollapsed)
    const setLeftPanelWidth  = useCanvasStore((s) => s.setLeftPanelWidth)
    const setRightPanelWidth = useCanvasStore((s) => s.setRightPanelWidth)
    const toggleLeftPanel    = useCanvasStore((s) => s.toggleLeftPanel)
    const toggleRightPanel   = useCanvasStore((s) => s.toggleRightPanel)

    const handleLeftDrag = useCallback((delta: number) => {
        const next = Math.max(PANEL_MIN, Math.min(PANEL_MAX, leftWidth + delta))
        setLeftPanelWidth(next)
    }, [leftWidth, setLeftPanelWidth])

    const handleRightDrag = useCallback((delta: number) => {
        const next = Math.max(PANEL_MIN, Math.min(PANEL_MAX, rightWidth - delta))
        setRightPanelWidth(next)
    }, [rightWidth, setRightPanelWidth])

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

    // ── OPP-10/11: Progressive disclosure selectors ───────────────────────────
    const unlockTab        = useCanvasStore((s) => s.unlockTab)
    const markTabSeen      = useCanvasStore((s) => s.markTabSeen)
    const unlockLeftTab    = useCanvasStore((s) => s.unlockLeftTab)
    // Subscribe to the Sets directly. Zustand v5 uses Object.is comparison, so
    // a new Set reference (from unlockTab / markTabSeen) correctly triggers a
    // re-render. Derive the tab-level predicates from these subscribed values
    // so we never read stale store state in JSX.
    const unlockedTabs     = useCanvasStore((s) => s.unlockedTabs)
    const seenTabs         = useCanvasStore((s) => s.seenTabs)
    const unlockedLeftTabs = useCanvasStore((s) => s.unlockedLeftTabs)

    // Stable predicate helpers derived from the subscribed Sets
    const isTabUnlocked    = useCallback((tab: string) => unlockedTabs.has(tab),    [unlockedTabs])
    const isTabNew         = useCallback((tab: string) => unlockedTabs.has(tab) && !seenTabs.has(tab), [unlockedTabs, seenTabs])
    const isLeftTabUnlocked = useCallback((tab: string) => unlockedLeftTabs.has(tab), [unlockedLeftTabs])

    // OPP-10 unlock trigger data — subscribe to each source store
    const tokenCount           = useTokenStore((s) => s.tokens.length)
    const tokensForDrift       = useTokenStore((s) => s.tokens)
    const registryCards        = useComponentCardStore((s) => s.cards)
    const hasOrchestratorConfig = useOrchestratorStore((s) => s.hasConfig)

    // MINT.2d: Token drift data for silent badge on Tokens tab
    const localTokensForTabDrift = useMemo(
        () => tokensForDrift.map((t) => ({ token_path: t.token_path, token_value: t.token_value })),
        [tokensForDrift],
    )
    const { driftCount: tabDriftCount } = useTokenUsage(tokenCount, localTokensForTabDrift)

    // OPP-16: Selection-based right panel auto-switch
    const activeSelection = useCanvasStore((s) => s.activeSelection)
    // Timestamp of the last manual tab click. Auto-switch is suppressed for
    // 3 s after the user has deliberately chosen a tab.
    const lastManualTabSwitchRef = useRef<number>(0)

    // Wrap setRightTab so manual tab clicks record the timestamp, mark seen,
    // and set userOverrodeTab so useAutoTabSwitch respects the user's choice.
    // INSPECTOR.1 Group C: markTabOverridden() is called here (manual click path).
    // useAutoTabSwitch calls setRightTab directly (programmatic path) — it does
    // NOT call markTabOverridden, so the flag stays false unless the user acts.
    const handleSetRightTab = useCallback((tab: typeof rightTab) => {
        lastManualTabSwitchRef.current = Date.now()
        markTabSeen(tab)
        setRightTab(tab)
        markTabOverridden()  // INSPECTOR.1: flag this as a user-initiated switch
    }, [markTabSeen, setRightTab, markTabOverridden])

    const activeFileName = activeFilePath ? activeFilePath.split('/').pop() ?? null : null

    // ── Notes tab: selected node for annotation context ───────────────────────
    const selectedNodeId = useEditorStore((s) => s.selectedNodeId)

    // ── T2.7: Annotation count badge ─────────────────────────────────────────
    const annotations = useAnnotations()
    const openAnnotationCount = useMemo(
        () => annotations.filter((a) => a.status === 'open').length,
        [annotations],
    )

    // ── Run Audit header button ───────────────────────────────────────────────
    const [isAuditingGlobal, setIsAuditingGlobal] = useState(false)
    const handleGlobalRunAudit = useCallback(async () => {
        const file = useCanvasStore.getState().activeFilePath
        if (!file || !window.flintAPI.mcp?.callTool) return
        setIsAuditingGlobal(true)
        try { await window.flintAPI.mcp.callTool('flint_audit', { file }) }
        catch (err) { console.warn('[Flint] App: global audit failed', err) }
        finally { setIsAuditingGlobal(false) }
    }, [])

    // ── INSPECTOR.1: Auto tab switch on selection (Group C) ──────────────────
    // Watches activeSelection; null→id transitions switch to Properties tab
    // unless the user manually overrode the tab this session.
    useAutoTabSwitch()

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
    useIDEFileSync()

    // ── Server readiness overlay (web mode) ──────────────────────────────────
    useEffect(() => {
        const onConnecting = () => setServerConnecting(true)
        const onConnected = () => setServerConnecting(false)
        const onTimeout = () => setServerConnecting(false)
        window.addEventListener('flint:server-connecting', onConnecting)
        window.addEventListener('flint:server-connected', onConnected)
        window.addEventListener('flint:server-timeout', onTimeout)
        return () => {
            window.removeEventListener('flint:server-connecting', onConnecting)
            window.removeEventListener('flint:server-connected', onConnected)
            window.removeEventListener('flint:server-timeout', onTimeout)
        }
    }, [])

    // ── OPP-10: Right panel tab unlock triggers ───────────────────────────────
    // Each effect watches a single data source and unlocks the appropriate tab
    // when the threshold is met. Effects fire on every dependency change but
    // unlockTab is a no-op when the tab is already unlocked, so there is no
    // churn after the first trigger.

    // tokens tab — unlocks when the project has at least one design token
    useEffect(() => {
        if (tokenCount > 0) unlockTab('tokens')
    }, [tokenCount, unlockTab])

    // notes tab — always visible (annotations are a core workflow, not progressive)
    useEffect(() => {
        unlockTab('notes')
    }, [unlockTab])

    // ── OPP-11: Left panel tab unlock triggers ────────────────────────────────

    // assets tab — unlocks when registry has ≥ 1 entry
    useEffect(() => {
        if (registryCards.length >= 1) unlockLeftTab('assets')
    }, [registryCards.length, unlockLeftTab])

    // GLASS.1b: components tab — unlocks when registry has ≥ 1 card
    useEffect(() => {
        if (registryCards.length >= 1) unlockLeftTab('components')
    }, [registryCards.length, unlockLeftTab])

    // files tab — unlocks when MCP is connected (polled in StatusBar; here we
    // use the orchestratorStore hasConfig flag as a proxy for MCP availability)
    useEffect(() => {
        if (hasOrchestratorConfig) unlockLeftTab('files')
    }, [hasOrchestratorConfig, unlockLeftTab])

    // ── OPP-16: Selection-based right panel auto-switch ───────────────────────
    // Smart routing:
    //  - If the user is actively reviewing violations in the Governance tab
    //    (governanceRuleFilter is set), canvas selection keeps the governance
    //    tab so they don't lose their place mid-investigation.
    //  - Otherwise, element selection → Properties; deselect → Governance.
    useEffect(() => {
        const MANUAL_LOCK_MS = 3000
        const timeSinceManual = Date.now() - lastManualTabSwitchRef.current
        if (timeSinceManual < MANUAL_LOCK_MS) return

        // If user is actively filtering violations, don't disrupt their flow
        if (governanceRuleFilter !== null) return

        if (activeSelection && isTabUnlocked('properties')) {
            setRightTab('properties')
        } else if (!activeSelection && isTabUnlocked('governance')) {
            setRightTab('governance')
        }
    // setRightTab and isTabUnlocked are stable; governanceRuleFilter is primitive
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSelection, governanceRuleFilter])

    // ── Shared hydrate helper ─────────────────────────────────────────────────
    const hydrateWorkspace = async (tree: FileTreeNode) => {
        setWorkspaceFiles(tree)
        // Seed the design token store from the project's DTCG file before any
        // component renders, so LivePreview's CSS var injection has the right
        // values. Falls back to baseline tokens if the project ships no DTCG.
        try {
            const result = await window.flintAPI.tokens.seedFromProject(tree.path)
            if (result.source === 'none') {
                const tokens = useTokenStore.getState().tokens
                if (tokens.length === 0) {
                    const { seedTokens } = await import('./core/seedTokens')
                    await seedTokens()
                }
            }
        } catch (err) {
            console.warn('[Flint] tokens.seedFromProject failed:', err)
        }
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

    const handleLoadDemo = async (demoName: string) => {
        if (!window.flintAPI.beta) {
            setDemoLoadError('Demo loading is not available in this environment')
            return
        }
        try {
            const result = await window.flintAPI.beta.loadDemoProject(demoName)
            if (result && 'projectPath' in result) {
                const tree = await window.flintAPI.project.openPath(result.projectPath)
                if (tree) {
                    await hydrateWorkspace(tree as FileTreeNode)
                } else {
                    setDemoLoadError('Demo project created but could not be opened. Try again.')
                }
            } else if (result && 'error' in result) {
                setDemoLoadError(`Demo project couldn't load: ${(result as { error: string }).error}`)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            setDemoLoadError(`Demo project couldn't load: ${message}`)
        }
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

    // ── Token sync ────────────────────────────────────────────────────────────
    // onTokensUpdated fires for ALL token mutations (demo seed, MCP tools,
    // manual import, Figma ingest).
    useEffect(() => {
        window.flintAPI.onTokensUpdated(() => {
            fetchTokens()
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
                        message: typeof desc === 'string' ? desc : 'Change undone',
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
                        message: typeof desc === 'string' ? desc : 'Change reapplied',
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

    // ── open-export custom event (fired by StatusBar export gate chip) ───────
    useEffect(() => {
        const handler = () => { setShowExportModal(true) }
        const eventName = `${BRAND.productLower}:open-export`
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

    // ── WS1: Demo-first onboarding (replaces ONBOARD.1 blocking wizard) ──────
    // When isFirstLaunch is true AND no project was specified via CLI, auto-load
    // the demo project. The wizard is accessible later via "Connect to IDE."
    //
    // Fix #1: If --project was passed (detected via URL param or global), skip demo.
    // Fix #3: Don't call completeFirstLaunch() until the user's first auto-fix.
    useEffect(() => {
        // 3-second timeout fallback — if the IPC call hangs, skip to LaunchScreen
        const timer = setTimeout(() => setSetupComplete(true), 3000)

        // Check if a project was explicitly specified (CLI --project flag)
        const params = new URLSearchParams(window.location.search)
        const projectSpecified = typeof (globalThis as Record<string, unknown>).__FLINT_PROJECT__ === 'string'
            || params.has('project')
        // --demo flag: force demo load regardless of first-launch state
        const demoForced = params.has('demo')

        window.flintAPI.setup
            ?.checkFirstLaunch()
            .then(async ({ isFirstLaunch }: { isFirstLaunch: boolean }) => {
                clearTimeout(timer)
                if (!isFirstLaunch && !demoForced) {
                    setSetupComplete(true)
                    return
                }
                // First launch (or --demo flag) + no explicit project: auto-load demo
                if (!projectSpecified) {
                    if (!window.flintAPI.beta) {
                        setDemoLoadError('Demo loading is not available in this environment')
                    } else {
                        try {
                            const result = await window.flintAPI.beta.loadDemoProject('multi-component-app')
                            if (result && 'projectPath' in result) {
                                const tree = await window.flintAPI.project.openPath(result.projectPath)
                                if (tree) {
                                    await hydrateWorkspace(tree as FileTreeNode)
                                    setDemoAutoLoaded(true)
                                }
                            }
                        } catch {
                            // Demo load failed — fall through to LaunchScreen gracefully
                        }
                    }
                }
                // Don't call completeFirstLaunch() here — defer until first meaningful
                // action (auto-fix, overlay dismiss, or 60s engagement). This ensures
                // users who close immediately get the demo again on next launch.
                setSetupComplete(true)
            })
            .catch((err) => {
                console.warn('[Flint] App: setup wizard IPC failed', err)
                clearTimeout(timer)
                // On IPC failure skip to LaunchScreen so the app isn't blocked
                setSetupComplete(true)
            })
        return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // WS1: Error string when demo project load fails (surfaces to LaunchScreen)
    const [demoLoadError, setDemoLoadError] = useState<string | null>(null)

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
            .catch((err) => console.warn('[Flint] App: beta info check failed', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── BETA.TEL: Read consent state on mount ────────────────────────────────
    // Reads the persisted consent record via IPC. If state === 'unset', the
    // dialog becomes visible. If the IPC is not wired yet (Group A not landed)
    // or throws, we default to not showing the dialog — privacy-safe fallback.
    useEffect(() => {
        const api = window.flintAPI as unknown as Record<string, unknown> & typeof window.flintAPI
        const telemetryApi = api?.telemetry as
            | { getConsent?: () => Promise<{ state: string }> }
            | undefined
        if (typeof telemetryApi?.getConsent !== 'function') {
            // IPC not wired yet — skip silently
            setShowTelemetryConsent(false)
            return
        }
        void telemetryApi
            .getConsent!()
            .then((record) => {
                setShowTelemetryConsent(record.state === 'unset')
            })
            .catch((err) => {
                console.warn('[Flint] App: telemetry.getConsent failed', err)
                // On IPC failure, default to not showing the dialog
                setShowTelemetryConsent(false)
            })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Auto-resume: last-file → session → demo precedence (LAUNCH.2/3) ─────────
    // Runs once after the setup + beta gates resolve. Priority order:
    //   1. URL hash / query param — reserved for future deep-link support
    //   2. Recent file:focus event (≤60s) — skip LaunchScreen, open Claude's file
    //   3. lastActiveFile from localStorage — restores the exact file open at the
    //      time of the last tab close / refresh; verified to still exist on disk
    //      before loading so a deleted file falls through gracefully
    //   4. Last saved session from SQLite — existing session-restore behaviour
    //   5. Web-mode active project root (--project CLI flag)
    //   6. Nothing — show LaunchScreen. The first-launch demo is NOT triggered here.
    //      Demo auto-load happens only in the WS1 effect above, which is gated on
    //      isFirstLaunch === true (i.e. ~/.flint/setup.json absent/incomplete).
    //      Returning users who simply have nothing open see the LaunchScreen, which
    //      is the correct empty state.
    // Ref guard prevents double-fire in React StrictMode (effect runs twice
    // but autoResumeChecked state hasn't propagated back yet on the second run).
    const _autoResumeStarted = useRef(false)

    useEffect(() => {
        if (setupComplete !== true || !betaWelcomeDone) return
        if (autoResumeChecked) return
        if (workspaceFiles) {
            // Already hydrated by the WS1 demo-load effect — skip the resume
            // ladder but still flip the gate so the RestoringSplash clears.
            setAutoResumeChecked(true)
            return
        }
        if (_autoResumeStarted.current) return
        _autoResumeStarted.current = true

        // Code M2 / UX#3: setAutoResumeChecked(true) moves to the finally block
        // inside the async call so RestoringSplash stays visible until the full
        // ladder has resolved. This prevents the LaunchScreen from flashing in
        // during the async IPC calls (200-800ms) and prevents a race where the
        // user clicking "Open Project" on an early flash gets clobbered by the
        // resume resolving. The splash is a cheap spinner — no functional change.

        void (async () => {
            try {
                await tryAutoResume({
                    readFile: (p) => window.flintAPI.readFile(p),
                    findRootForFile: window.flintAPI.project?.findRootForFile
                        ? (p) => window.flintAPI.project.findRootForFile!(p)
                        : null,
                    openPath: (root) => window.flintAPI.project.openPath(root) as Promise<FileTreeNode | null>,
                    getRecentFileFocus: () => window.flintAPI.mcp?.getRecentFileFocus?.() ?? Promise.resolve(null),
                    setWorkspaceFiles: (tree) => setWorkspaceFiles(tree as FileTreeNode),
                    setActiveFile,
                    hydrateWorkspace,
                    clearLastActiveFile: () => useCanvasStore.getState().clearLastActiveFile(),
                    recordLastActiveFile: (p, root) => useCanvasStore.getState().recordLastActiveFile(p, root),
                    upsertProject: window.flintAPI.registry?.upsertProject
                        ? (entry) => void window.flintAPI.registry?.upsertProject?.(entry)
                        : undefined,
                    getLastSession: () => window.flintAPI.session?.getLastSession() ?? Promise.resolve(null),
                    getActiveRoot: window.flintAPI.project?.getActiveRoot
                        ? () => window.flintAPI.project.getActiveRoot!()
                        : null,
                    notify: (opts) => pushNotification({
                        type: 'info',
                        title: opts.message.slice(0, 80),
                        message: opts.message,
                        severity: opts.severity,
                        autoDismissMs: (opts as { autoDismiss?: number }).autoDismiss ?? 0,
                    }),
                    // shouldContinue: abort resume if the user already opened
                    // something while we were awaiting (race fix Code M2).
                    shouldContinue: () => {
                        const s = useCanvasStore.getState()
                        return s.workspaceFiles == null && s.activeFilePath == null
                    },
                    isWebMode: () =>
                        typeof (globalThis as Record<string, unknown>).__FLINT_WEB__ !== 'undefined',
                })
            } finally {
                // Always flip the gate so the RestoringSplash disappears even
                // if tryAutoResume throws or the user aborted via shouldContinue.
                setAutoResumeChecked(true)
            }
        })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setupComplete, betaWelcomeDone])

    // ── IDE.2: React to external project-open events (demo script, CLI curl) ─────
    // When the server's active project changes via an external HTTP call (not
    // from the Glass browser), broadcast 'flint:project-opened' arrives here so
    // Glass can re-open the correct project and unblock IDE sync.
    useEffect(() => {
        if (!window.flintAPI?.onProjectOpened) return
        const unsub = window.flintAPI.onProjectOpened(({ path: projectPath }) => {
            // Skip if Glass already has this project open
            if (useCanvasStore.getState().workspaceFiles?.path === projectPath) return
            void (async () => {
                try {
                    const tree = await window.flintAPI.project.openPath(projectPath)
                    if (tree) await hydrateWorkspace(tree as FileTreeNode)
                } catch (err) {
                    console.warn('[Flint] App: auto-open from project-opened event failed', err)
                }
            })()
        })
        return () => { if (typeof unsub === 'function') unsub() }
    // hydrateWorkspace is stable (defined in component body, not re-created)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── FORGE.2d: Trigger environment detection when a project opens ──────────
    useEffect(() => {
        if (!workspaceFiles) {
            setDetectedEnvironment(null)
            setIsScanning(false)
            return
        }
        let cancelled = false
        setIsScanning(true)
        window.flintAPI.project?.detectEnvironment?.()
            .then((env) => {
                if (!cancelled && env) {
                    setDetectedEnvironment(env as ProjectEnvironment)
                    // FORGE.2c: If detection succeeded but auditSummary is missing
                    // (MCP was not connected during detection), kick off a full
                    // baseline audit in the background. Non-blocking, best-effort.
                    const detected = env as ProjectEnvironment
                    if (!detected.auditSummary) {
                        window.flintAPI.project?.runBaseline?.().then((result) => {
                            if (result && !cancelled) {
                                setDetectedEnvironment((prev) =>
                                    prev ? { ...prev, auditSummary: { violations: result.violations, grade: result.grade } } : prev
                                )
                            }
                        }).catch((err) => {
                            console.warn('[Flint] App: baseline audit failed', err)
                        })
                    }
                }
            })
            .catch((err) => {
                console.warn('[Flint] App: environment detection failed', err)
            })
            .finally(() => {
                if (!cancelled) setIsScanning(false)
            })
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceFiles])

    // While checking first-launch status, render nothing (avoids flash)
    if (setupComplete === null) return null

    // WS1: The blocking SetupWizard gate is removed. First launch now auto-loads
    // the demo project (handled in the useEffect above). If setupComplete is false
    // but the demo auto-load already set workspaceFiles, we proceed to the canvas.
    // The SetupWizard is still accessible via "Connect to IDE" in the StatusBar
    // and LaunchScreen (rendered as a non-blocking modal).
    // (setupComplete === true is guaranteed by the timeout fallback useEffect above)

    // ── Beta Welcome gate ─────────────────────────────────────────────────────
    if (!betaWelcomeDone && betaInfo) {
        return (
            <BetaWelcome
                buildId={betaInfo.buildId}
                daysRemaining={betaInfo.daysRemaining}
                onTryDemo={async () => {
                    const result = await window.flintAPI.beta?.loadDemoProject('multi-component-app')
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

    // ── RestoringSplash gate (Code M2 / UX#3) ────────────────────────────────
    // Block the LaunchScreen from rendering until tryAutoResume has fully
    // resolved. This prevents a 200-800ms flash of the LaunchScreen while IPC
    // calls are in-flight, and prevents a race where the user clicks
    // "Open Project" on that transient LaunchScreen before the resume resolves.
    if (!autoResumeChecked) {
        return (
            <div className="absolute inset-0 z-[110] flex items-center justify-center bg-zinc-950">
                <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/95 px-5 py-3 shadow-2xl">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
                    <p className="text-xs text-zinc-400">Restoring session…</p>
                </div>
            </div>
        )
    }

    // ── LaunchScreen gate ─────────────────────────────────────────────────────
    if (!workspaceFiles) {
        return (
            <>
                <LaunchScreen
                    onNewProject={() => handleNewProject()}
                    onOpenFolder={() => handleOpenFolder()}
                    onOpenRecent={(p) => handleOpenRecent(p)}
                    onLoadDemo={(demoName) => handleLoadDemo(demoName)}
                    onConnectIDE={() => setShowSetupWizardModal(true)}
                    demoError={demoLoadError ?? undefined}
                />
                {/* SetupWizard modal is rendered once at the App root (below) to avoid duplication */}
            </>
        )
    }

    // GLASS.2.2: When any modal is open, the main app content is aria-hidden
    // so screen readers focus on the dialog. Modals render as siblings outside
    // the aria-hidden wrapper via a React Fragment.
    const isAnyModalOpen = showExportModal || showGovernancePanel || showSetupWizardModal || showTelemetryConsent === true

    return (
        <>
        <div
            className="flex h-screen flex-col bg-zinc-950"
            aria-hidden={isAnyModalOpen || undefined}
        >
            {/* ── Server connecting overlay (web mode startup) */}
            {serverConnecting && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/95 px-5 py-3 shadow-2xl">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
                        <p className="text-xs text-zinc-400">Connecting to server…</p>
                    </div>
                </div>
            )}
            {/* ── Project loading overlay (non-destructive — keeps workspace mounted) */}
            {isLoadingProject && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm">
                    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/95 px-5 py-3 shadow-2xl">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
                        <p className="text-xs text-zinc-400">Opening project…</p>
                    </div>
                </div>
            )}
            {/* ── Top bar ────────────────────────────────────────────────── */}
            <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-2">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold tracking-tight text-indigo-400">
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

                {/* IPC health pill — dev-only debug telemetry (GLASS.3.4-A) */}
                {import.meta.env.DEV && (
                <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2">
                    <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${ipcOk
                            ? 'bg-emerald-400 shadow-lg shadow-emerald-400/40'
                            : 'animate-pulse bg-amber-400'
                            }`}
                    />
                    <span className="font-mono text-xs text-zinc-300">
                        {ipcStatus}
                    </span>
                </div>
                )}

                <div className="flex items-center gap-2">
                    {saveState !== 'idle' && (
                        <div className="flex items-center gap-1.5">
                            <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${saveState === 'editing'
                                    ? 'bg-amber-400'
                                    : saveState === 'saving'
                                        ? 'motion-safe:animate-pulse bg-blue-400'
                                        : 'bg-emerald-400'
                                    }`}
                            />
                            <span className="font-mono text-[10px] text-zinc-400">
                                {saveState === 'editing' ? 'Editing…' : saveState === 'saving' ? 'Saving…' : 'Saved'}
                            </span>
                        </div>
                    )}

                    {/* T2.7: Open annotation count badge */}
                    {openAnnotationCount > 0 && (
                        <button
                            type="button"
                            onClick={() => { useCanvasStore.getState().setRightTab('properties') }}
                            className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/10 px-2 py-1 text-indigo-400 transition-colors hover:bg-indigo-900/20"
                            aria-label={`${openAnnotationCount} open annotations`}
                        >
                            <MessageSquare size={12} />
                            <span className="text-[10px] font-medium">{openAnnotationCount}</span>
                        </button>
                    )}

                    {/* T2.3: Wider command palette search bar */}
                    <button
                        type="button"
                        onClick={() => useCanvasStore.getState().setCommandPaletteOpen(true)}
                        aria-label="Command palette (⌘K)"
                        className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-400 transition-colors hover:border-indigo-500/50 hover:bg-zinc-700 hover:text-white min-w-[180px]"
                    >
                        <Search size={14} />
                        <span className="text-xs text-zinc-400">Search...</span>
                        <kbd className="ml-auto text-[10px] font-mono text-zinc-500">⌘K</kbd>
                    </button>

                    {/* Run Audit button */}
                    {activeFilePath && (
                        <button
                            type="button"
                            onClick={() => void handleGlobalRunAudit()}
                            disabled={isAuditingGlobal}
                            className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/20 px-2 py-1 text-xs text-indigo-400 transition-colors hover:bg-indigo-900/40 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={isAuditingGlobal ? 'Auditing in progress' : 'Run governance audit'}
                        >
                            {isAuditingGlobal ? <Loader2 size={12} className="motion-safe:animate-spin" /> : <Play size={12} />}
                            {isAuditingGlobal ? 'Auditing...' : 'Audit'}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => { setGovernanceFocusRuleId(undefined); setShowGovernancePanel(true) }}
                        title="Governance Rules"
                        aria-label="Governance Rules"
                        className="flex items-center rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300 transition-colors hover:border-indigo-500/50 hover:bg-zinc-700 hover:text-white"
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
                            className="flex items-center rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300 transition-colors hover:border-indigo-500/50 hover:bg-zinc-700 hover:text-white"
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
            {/*  [Left: Layers/Assets]  [Center: Canvas]  [Right: Governance/Properties/Tokens]  */}
            <main className="flex min-h-0 flex-1">
                {/* GLASS.3.2: Left panel collapse rail */}
                {leftCollapsed ? (
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label="Expand left panel"
                        onClick={toggleLeftPanel}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleLeftPanel() }}
                        className="flex w-1.5 shrink-0 cursor-pointer items-center justify-center border-r border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors"
                    >
                        <ChevronRight size={10} className="text-zinc-500" />
                    </div>
                ) : (
                    <>
                        {/* Left panel: Navigation (Layers / Assets) */}
                        <section
                            style={{ width: leftWidth, minWidth: PANEL_MIN, maxWidth: PANEL_MAX }}
                            className="flex min-h-0 shrink-0 flex-col border-r border-zinc-800"
                        >
                            <div role="tablist" aria-label="Left sidebar sections" className="flex shrink-0 border-b border-zinc-800">
                                {/* OPP-11: Left panel progressive tabs — filter by unlocked set */}
                                {/* GLASS.1b: Components tab added between Layers and Assets */}
                                {(['layers', 'components', 'assets'] as const)
                                    .filter((tab) => isLeftTabUnlocked(tab))
                                    .map((tab) => {
                                        const { label, Icon: LeftTabIcon } = LEFT_TAB_CONFIG[tab]
                                        return (
                                            <button
                                                key={tab}
                                                type="button"
                                                role="tab"
                                                aria-selected={leftTab === tab}
                                                onClick={() => setLeftTab(tab)}
                                                className={`flex flex-1 flex-col items-center py-2 transition-colors ${leftTab === tab
                                                    ? 'border-b-2 border-indigo-500 text-indigo-400'
                                                    : 'text-zinc-500 hover:text-zinc-300'
                                                    }`}
                                            >
                                                <LeftTabIcon size={12} />
                                                <span className="mt-0.5 text-[10px] font-medium leading-none">{label}</span>
                                            </button>
                                        )
                                    })}
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {leftTab === 'layers' && (
                                    <PanelErrorBoundary panelName="Layers">
                                        <LayerTree />
                                    </PanelErrorBoundary>
                                )}
                                {leftTab === 'components' && (
                                    <PanelErrorBoundary panelName="Components">
                                        <ComponentPanel />
                                    </PanelErrorBoundary>
                                )}
                                {leftTab === 'assets' && (
                                    <PanelErrorBoundary panelName="Assets">
                                        <AssetsPanel />
                                    </PanelErrorBoundary>
                                )}
                            </div>
                        </section>

                        <ResizeHandle onDrag={handleLeftDrag} onDoubleClick={toggleLeftPanel} />
                    </>
                )}

                {/* Center: Detection banner + Infinite canvas */}
                <section className="flex min-h-0 flex-1 flex-col">
                    <DetectionBanner
                        environment={detectedEnvironment}
                        isScanning={isScanning}
                        onRunAudit={() => {
                            // Trigger a full audit via MCP and update the banner
                            setIsScanning(true)
                            window.flintAPI.project?.detectEnvironment?.()
                                .then((env) => {
                                    if (env) setDetectedEnvironment(env as ProjectEnvironment)
                                })
                                .catch((err) => console.warn('[Flint] App: re-scan environment detection failed', err))
                                .finally(() => { setIsScanning(false) })
                        }}
                    />
                    <PanelErrorBoundary panelName="Canvas">
                        <MithrilProvider>
                            <XYCanvas />
                        </MithrilProvider>
                    </PanelErrorBoundary>
                </section>

                {/* GLASS.3.2: Right panel collapse rail or full panel */}
                {rightCollapsed ? (
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label="Expand right panel"
                        onClick={toggleRightPanel}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleRightPanel() }}
                        className="flex w-1.5 shrink-0 cursor-pointer items-center justify-center border-l border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors"
                    >
                        <ChevronLeft size={10} className="text-zinc-500" />
                    </div>
                ) : (
                    <>
                        <ResizeHandle onDrag={handleRightDrag} onDoubleClick={toggleRightPanel} />

                        {/* Right panel: Inspection (Governance / Properties / Tokens) */}
                        <section
                            style={{ width: rightWidth, minWidth: PANEL_MIN, maxWidth: PANEL_MAX }}
                            className="flex min-h-0 shrink-0 flex-col border-l border-zinc-800"
                        >
                            {/* Onboarding nudge — shown above the tab bar for fresh projects */}
                            <OnboardingNudge
                                onConnectFigma={() => setShowSetupWizardModal(true)}
                                onStartEditing={() => handleSetRightTab('properties')}
                            />

                            <div role="tablist" aria-label="Right sidebar sections" className="flex shrink-0 border-b border-zinc-800">
                                {/* OPP-10: Right panel progressive tabs — filter by unlocked set,
                                    show one-time indigo dot on newly-unlocked tabs */}
                                {([
                                    /* GLASS.1a: Consolidated right sidebar tabs */
                                    { tab: 'governance',  Icon: BarChart2,         label: 'Governance' },
                                    { tab: 'properties',  Icon: SlidersHorizontal, label: 'Properties' },
                                    { tab: 'tokens',      Icon: Palette,           label: 'Tokens'     },
                                    { tab: 'notes',       Icon: MessageSquare,     label: 'Notes'      },
                                ] as const)
                                    .filter(({ tab }) => isTabUnlocked(tab))
                                    .map(({ tab, Icon, label }) => {
                                        // MINT.2d: Token tab label with drift count badge
                                        const displayLabel = tab === 'tokens' && tabDriftCount > 0
                                            ? `Tokens (${tabDriftCount})`
                                            : label
                                        const tabButton = (
                                            <button
                                                key={tab}
                                                type="button"
                                                role="tab"
                                                onClick={() => handleSetRightTab(tab)}
                                                title={tab === 'tokens' && tabDriftCount > 0
                                                    ? `Tokens — ${tabDriftCount} drifted from Figma`
                                                    : label}
                                                aria-label={tab === 'tokens' && tabDriftCount > 0
                                                    ? `Tokens, ${tabDriftCount} drifted from Figma`
                                                    : label}
                                                aria-selected={rightTab === tab}
                                                className={`relative flex flex-col items-center gap-0.5 py-2 px-3 transition-colors ${rightTab === tab
                                                    ? 'border-b-2 border-indigo-500 text-indigo-400'
                                                    : 'text-zinc-500 hover:text-zinc-300'
                                                    }`}
                                            >
                                                <Icon size={14} />
                                                <span className="text-[10px] font-medium leading-none">{displayLabel}</span>
                                                {/* MINT.2d: Amber drift dot on Tokens tab */}
                                                {tab === 'tokens' && tabDriftCount > 0 && (
                                                    <span
                                                        className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400 animate-[pulse_1s_ease-in-out_1]"
                                                        data-testid="tokens-drift-dot"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                {/* OPP-10: One-time "new" dot — indigo, 4px, top-right of icon */}
                                                {isTabNew(tab) && !(tab === 'tokens' && tabDriftCount > 0) && (
                                                    <span
                                                        className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-indigo-500"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </button>
                                        )
                                        /* CLARITY-2 Item 2: Tab Unlock Narration — wrap dynamically-unlocked tabs */
                                        const narration = TAB_NARRATION[tab]
                                        return narration ? (
                                            <TabUnlockTooltip key={tab} tooltipKey={`tab-unlock-${tab}`} text={narration}>
                                                {tabButton}
                                            </TabUnlockTooltip>
                                        ) : (
                                            <React.Fragment key={tab}>{tabButton}</React.Fragment>
                                        )
                                    })}
                            </div>
                            <div role="tabpanel" id={`right-tabpanel-${rightTab}`} aria-labelledby={`right-tab-${rightTab}`} className="min-h-0 flex-1 overflow-y-auto">
                                {/* Phase ING.2: Import Summary panel takes priority */}
                                {importSummaryPanelMode ? (
                                    <ImportSummaryPanelView />
                                ) : (
                                    <>
                                        {rightTab === 'properties' && (
                                            <PanelErrorBoundary panelName="Properties">
                                                <PropertiesPanel />
                                            </PanelErrorBoundary>
                                        )}
                                        {rightTab === 'tokens' && (
                                            <PanelErrorBoundary panelName="Tokens">
                                                <TokenManager />
                                            </PanelErrorBoundary>
                                        )}
                                        {rightTab === 'governance' && (
                                            <PanelErrorBoundary panelName="Governance">
                                                <GovernanceDashboard
                                                    onOpenExportModal={() => setShowExportModal(true)}
                                                    onOpenGovernancePanel={() => { setGovernanceFocusRuleId(undefined); setGovernancePanelTab(undefined); setShowGovernancePanel(true) }}
                                                    onManageRules={() => { setGovernanceFocusRuleId(undefined); setGovernancePanelTab('rules'); setShowGovernancePanel(true) }}
                                                    onPolicySettings={() => { setGovernanceFocusRuleId(undefined); setGovernancePanelTab('profiles'); setShowGovernancePanel(true) }}
                                                />
                                            </PanelErrorBoundary>
                                        )}
                                        {rightTab === 'notes' && (
                                            <div className="flex-1 overflow-y-auto">
                                                {selectedNodeId ? (
                                                    <AnnotationList nodeId={selectedNodeId} />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                                                        <MessageSquare className="h-6 w-6 text-zinc-600 mb-2" />
                                                        <p className="text-[11px] font-medium text-zinc-400">No notes yet</p>
                                                        <p className="text-[10px] text-zinc-600 mt-1">Select a layer to view or add notes</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </main>

            <StatusBar
                onConnectIDE={() => setShowSetupWizardModal(true)}
                isDemo={demoAutoLoaded}
                onOpenOwnProject={() => {
                    // Complete first launch and show LaunchScreen
                    void window.flintAPI.setup?.completeFirstLaunch()
                    setDemoAutoLoaded(false)
                    setWorkspaceFiles(null)
                }}
            />

            {/* Phase ING.2: Import Summary toast (fixed bottom-right, above StatusBar) */}
            <ImportSummaryToastMount />

            {/* Non-modal overlays (inside the aria-hidden wrapper) */}
            {demoAutoLoaded && (
                <DemoWalkthrough
                    onDismiss={() => setDemoAutoLoaded(false)}
                    onProjectHandoff={() => {
                        setDemoAutoLoaded(false)
                        void handleOpenFolder()
                    }}
                />
            )}
            {/* Mutual exclusion: OnboardingOverlay is suppressed while the demo walkthrough
                is active (demoAutoLoaded) — the two onboarding flows must never overlap. */}
            {!demoAutoLoaded && (
                <OnboardingOverlay onDismiss={() => {
                    // Fix #3: Complete first launch when user finishes the onboarding tour.
                    // Users who close before finishing get the demo again on next launch.
                    void window.flintAPI.setup?.completeFirstLaunch()
                }} />
            )}
            {/* CP.1 — ⌘K Command Palette */}
            <CommandPalette
                onOpenExportModal={() => setShowExportModal(true)}
                onOpenGovernancePanel={() => { setGovernanceFocusRuleId(undefined); setShowGovernancePanel(true) }}
                onOpenSetupWizard={() => setShowSetupWizardModal(true)}
            />
            <NotificationCenter />
        </div>

        {/* GLASS.2.2: Modal dialogs render outside the aria-hidden wrapper */}
        {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} pendingTokenCount={pendingTokenCount} />}
        {showGovernancePanel && (
            <GovernancePanel
                onClose={() => {
                    setShowGovernancePanel(false)
                    setGovernanceFocusRuleId(undefined)
                    setGovernancePanelTab(undefined)
                }}
                focusRuleId={governanceFocusRuleId}
                initialTab={governancePanelTab}
            />
        )}
        {/* WS1: SetupWizard as non-blocking modal, triggered from StatusBar "Connect IDE".
             SetupWizard owns its own fixed inset-0 backdrop — no wrapper needed. */}
        {showSetupWizardModal && (
            <FocusTrap>
                <SetupWizard onComplete={() => setShowSetupWizardModal(false)} />
            </FocusTrap>
        )}
        {/* BETA.TEL: Telemetry consent gate — shown once on first launch when
             consent.state === 'unset'. Dismisses on Accept or Decline. */}
        {showTelemetryConsent === true && (
            <TelemetryConsentDialog
                onDecided={() => setShowTelemetryConsent(false)}
            />
        )}
        </>
    )
}

export default App
