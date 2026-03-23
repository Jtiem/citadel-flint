/**
 * Test Setup — src/components/__tests__/setup.ts
 *
 * Global setup for React component tests (jsdom environment).
 * - Mocks window.flintAPI with typed vi.fn() stubs
 * - Resets Zustand stores between tests
 * - Polyfills browser APIs not available in jsdom
 */

import { beforeEach, vi } from 'vitest'

// ── Polyfills ────────────────────────────────────────────────────────────────

// scrollIntoView is not implemented in jsdom
Element.prototype.scrollIntoView = vi.fn()

// crypto.randomUUID
if (!globalThis.crypto?.randomUUID) {
    let counter = 0
    Object.defineProperty(globalThis, 'crypto', {
        value: {
            ...globalThis.crypto,
            randomUUID: () => `test-uuid-${++counter}`,
        },
    })
}

// navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
    value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
    },
    writable: true,
})

// localStorage mock (jsdom has one but it can be flaky)
const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value }),
        removeItem: vi.fn((key: string) => { delete store[key] }),
        clear: vi.fn(() => { store = {} }),
        get length() { return Object.keys(store).length },
        key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ── Mock window.flintAPI ────────────────────────────────────────────────────

export function createMockFlintAPI() {
    return {
        ping: vi.fn().mockResolvedValue('pong'),
        openFolder: vi.fn().mockResolvedValue(null),
        selectFolder: vi.fn().mockResolvedValue(null),
        saveFile: vi.fn().mockResolvedValue(undefined),
        saveFileBatch: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(''),
        gitShow: vi.fn().mockResolvedValue(''),
        gitLog: vi.fn().mockResolvedValue([]),
        getServerStatus: vi.fn().mockResolvedValue({ running: false }),
        syncPresence: vi.fn().mockResolvedValue(undefined),
        readPresence: vi.fn().mockResolvedValue([]),
        syncContext: vi.fn().mockResolvedValue({ ok: true }),
        onTokensUpdated: vi.fn(),
        removeTokensUpdatedListener: vi.fn(),
        onFileChanged: vi.fn(),
        removeFileChangedListener: vi.fn(),
        watchTokens: vi.fn(),
        transformCode: vi.fn().mockResolvedValue(''),
        applyBatch: vi.fn().mockResolvedValue({ ok: true }),
        tokens: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            readAll: vi.fn().mockResolvedValue([]),
            update: vi.fn().mockResolvedValue({ changes: 0 }),
            delete: vi.fn().mockResolvedValue({ changes: 0 }),
            clearAll: vi.fn().mockResolvedValue({ changes: 0 }),
            upsertOverride: vi.fn().mockResolvedValue(undefined),
            readOverrides: vi.fn().mockResolvedValue([]),
            clearOverride: vi.fn().mockResolvedValue(undefined),
        },
        assets: {
            getMetadata: vi.fn().mockResolvedValue([]),
            getBinary: vi.fn().mockResolvedValue(null),
            auditZombies: vi.fn().mockResolvedValue({ audited: 0, zombies: 0 }),
        },
        registry: {
            getRecent: vi.fn().mockResolvedValue([]),
            upsertProject: vi.fn().mockResolvedValue(undefined),
            removeProject: vi.fn().mockResolvedValue(undefined),
            reindex: vi.fn().mockResolvedValue(undefined),
        },
        session: {
            getLastSession: vi.fn().mockResolvedValue(null),
        },
        project: {
            initialize: vi.fn().mockResolvedValue({ name: 'test', path: '/tmp/test', type: 'directory', children: [] }),
            openPath: vi.fn().mockResolvedValue(null),
            resetToDemo: vi.fn().mockResolvedValue({ name: 'demo', path: '/tmp/demo', type: 'directory', children: [] }),
            createScratchpad: vi.fn().mockResolvedValue({ name: 'scratchpad', path: '/tmp/scratchpad', type: 'directory', children: [] }),
        },
        menu: {
            onNewProject: vi.fn(),
            onOpenProject: vi.fn(),
            onCloseProject: vi.fn(),
            onSaveProjectAs: vi.fn(),
            onResetState: vi.fn(),
            removeMenuListeners: vi.fn(),
        },
        ai: {
            chat: vi.fn().mockResolvedValue(undefined),
            onChunk: vi.fn(),
            removeChunkListener: vi.fn(),
            getConfig: vi.fn().mockResolvedValue({ hasKey: false }),
            saveConfig: vi.fn().mockResolvedValue(undefined),
            queryRAG: vi.fn().mockResolvedValue([]),
            ingestRAG: vi.fn().mockResolvedValue({ ingested: 0 }),
            queryRegistry: vi.fn().mockResolvedValue(''),
            hydroPaste: vi.fn().mockResolvedValue(undefined),
        },
        getRuleOverrides: vi.fn().mockResolvedValue({}),
        saveRuleOverrides: vi.fn().mockResolvedValue(undefined),
        preview: {
            start: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn().mockResolvedValue(undefined),
            getUrl: vi.fn().mockResolvedValue(''),
        },
        governance: {
            recordOverride: vi.fn().mockResolvedValue(undefined),
            getOverrideCount: vi.fn().mockResolvedValue(0),
            getComplianceSummary: vi.fn().mockResolvedValue({
                totalViolations: 0,
                byAuthority: {},
                bySeverity: { critical: 0, warning: 0, info: 0 },
                violatedRules: [],
                generatedAt: new Date().toISOString(),
            }),
            onOverrideRecorded: vi.fn().mockReturnValue(() => {}),
        },
        figma: {
            status: vi.fn().mockResolvedValue({ running: false, lastWebhookAt: null, tokenCount: 0, port: 4545 }),
            disconnect: vi.fn().mockResolvedValue(undefined),
            onConnected: vi.fn().mockReturnValue(() => {}),
            onError: vi.fn().mockReturnValue(() => {}),
            removeListeners: vi.fn(),
        },
        mcp: {
            callTool: vi.fn().mockResolvedValue({}),
            readResource: vi.fn().mockResolvedValue(''),
            status: vi.fn().mockResolvedValue({ connected: false }),
            onEvent: vi.fn().mockReturnValue(() => {}),
        },
        setup: {
            detectIDEs: vi.fn().mockResolvedValue({
                ides: [],
                mcpServerPath: '/mock/flint-mcp/dist/server.js',
            }),
            checkFirstLaunch: vi.fn().mockResolvedValue({ isFirstLaunch: false }),
            completeFirstLaunch: vi.fn().mockResolvedValue(undefined),
            writeMCPConfig: vi.fn().mockResolvedValue({ written: true }),
            resetState: vi.fn().mockResolvedValue(undefined),
        },
        annotations: {
            readAll: vi.fn().mockResolvedValue([]),
            onChanged: vi.fn().mockReturnValue(() => {}),
            removeChangedListener: vi.fn(),
        },
        autopilot: {
            enable: vi.fn().mockResolvedValue(undefined),
            disable: vi.fn().mockResolvedValue(undefined),
            onResult: vi.fn().mockReturnValue(() => {}),
        },
        components: {
            list: vi.fn().mockResolvedValue([]),
            savePositions: vi.fn().mockResolvedValue(undefined),
            loadPositions: vi.fn().mockResolvedValue({}),
        },
        context: {
            getEnriched: vi.fn().mockResolvedValue({
                timestamp: Date.now(),
                activeFile: null,
                tokenCount: 0,
                activeOverrideCount: 0,
                enrichedAt: new Date().toISOString(),
            }),
        },
        scope: {
            getRegistryAndScope: vi.fn().mockResolvedValue({
                registry: {},
                scope: null,
                registryAvailable: false,
            }),
            setScope: vi.fn().mockResolvedValue({ ok: true }),
        },
        enrichment: {
            getDrafts: vi.fn().mockResolvedValue({ drafts: {}, enrichmentStats: { bare: 0, draft: 0, enriched: 0, total: 0 } }),
            approve: vi.fn().mockResolvedValue({ ok: true, remainingDrafts: 0 }),
        },
        beta: {
            getInfo: vi.fn().mockResolvedValue({ buildId: 'dev-local', expiryDate: null, daysRemaining: null, isBeta: false }),
            submitFeedback: vi.fn().mockResolvedValue({ saved: true }),
            loadDemoProject: vi.fn().mockResolvedValue({ error: 'not available in test' }),
            onUpdateAvailable: vi.fn().mockReturnValue(() => {}),
            onExpiredRemote: vi.fn().mockReturnValue(() => {}),
            removeListeners: vi.fn(),
        },
    }
}

// ── Store Reset Utility ──────────────────────────────────────────────────────

// Import stores directly — Vitest handles ESM correctly
import { useNotificationStore } from '../../store/notificationStore'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useGovernanceStore } from '../../store/governanceStore'
import { useImportSummaryStore } from '../../store/importSummaryStore'
import { useComponentCardStore } from '../../store/componentCardStore'

export function resetAllStores() {
    useNotificationStore.setState({ notifications: [], history: [] })

    useEditorStore.setState({
        rawCode: '',
        selectedNodeId: null,
        hoveredId: null,
        visualTree: [],
        jumpToLine: null,
        linterWarnings: new Map(),
    })

    useCanvasStore.setState({
        dragSourceId: null,
        activeSelection: null,
        canvasMode: 'design' as const,
        nodeLayouts: {},
        mithrilViolations: [],
        a11yViolations: {},
        overridesExist: false,
        saveState: 'idle' as const,
        activeFilePath: null,
        workspaceFiles: null,
        autopilotEnabled: false,
        governedCode: null,
        governedFixCount: 0,
        governedTimestamp: null,
        commandPaletteOpen: false,
    })

    // ACX.5: reset governance and import summary stores
    useGovernanceStore.setState({ overrides: {} })
    useImportSummaryStore.setState({ summary: null, isVisible: false, isPanelMode: false })

    // CV2.3: reset component card store
    useComponentCardStore.setState({
        cards: [],
        selectedCardId: null,
        cardPositions: {},
        isLoaded: false,
        isLoading: false,
        error: null,
    })
}

// ── Global Hooks ─────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    resetAllStores()
    ;(window as any).flintAPI = createMockFlintAPI()
    localStorageMock.clear()
})
