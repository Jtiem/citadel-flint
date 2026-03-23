/**
 * AppMountGate.test.tsx
 *
 * Journey 1, Step 1.1 — App.tsx conditional render gate.
 *
 * Validates the LaunchScreen <-> 3-panel workspace toggle that is driven
 * entirely by `canvasStore.workspaceFiles` being null or populated.
 *
 * All heavy children (XYCanvas, LivePreview, etc.) are mocked with lightweight
 * stubs so jsdom never has to execute canvas/iframe/ReactFlow code.
 *
 * Test coverage:
 *   1. workspaceFiles === null  →  renders <LaunchScreen>, NOT the workspace
 *   2. workspaceFiles populated →  renders 3-panel layout, NOT LaunchScreen
 *   3. workspaceFiles null → populated → null  →  returns to LaunchScreen
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// ── Store ────────────────────────────────────────────────────────────────────
import { useCanvasStore } from '../../store/canvasStore'
import type { FileTreeNode } from '../../types/flint-api'

// ── Stub setup helpers from existing test infrastructure ─────────────────────
import { createMockFlintAPI, resetAllStores } from './setup'

// ── Heavy component mocks ─────────────────────────────────────────────────────
// These stubs prevent jsdom from choking on @xyflow/react, ResizeObserver,
// iframe, Monaco, and other browser-only APIs.

vi.mock('../../components/editor/XYCanvas', () => ({
    XYCanvas: () => <div data-testid="xy-canvas" />,
}))

vi.mock('../../components/editor/LivePreview', () => ({
    LivePreview: () => <div data-testid="live-preview" />,
}))

vi.mock('../../components/editor/StatusBar', () => ({
    StatusBar: () => <div data-testid="status-bar" />,
}))

vi.mock('../../components/ui/LayerTree', () => ({
    LayerTree: () => <div data-testid="layer-tree" />,
}))

vi.mock('../../components/editor/AssetsPanel', () => ({
    AssetsPanel: () => <div data-testid="assets-panel" />,
}))

vi.mock('../../components/ui/PropertiesPanel', () => ({
    PropertiesPanel: () => <div data-testid="properties-panel" />,
}))

vi.mock('../../components/ui/TokenManager', () => ({
    TokenManager: () => <div data-testid="token-manager" />,
}))

vi.mock('../../components/ui/ActivityFeed', () => ({
    ActivityFeed: () => <div data-testid="activity-feed" />,
}))

vi.mock('../../components/ui/RecoveryPanel', () => ({
    RecoveryPanel: () => <div data-testid="recovery-panel" />,
}))

vi.mock('../../components/ui/ExportModal', () => ({
    ExportModal: () => <div data-testid="export-modal" />,
}))

vi.mock('../../components/ui/GovernancePanel', () => ({
    GovernancePanel: () => <div data-testid="governance-panel" />,
}))

vi.mock('../../components/ui/GovernanceDashboard', () => ({
    GovernanceDashboard: () => <div data-testid="governance-dashboard" />,
}))

vi.mock('../../components/ui/NotificationCenter', () => ({
    NotificationCenter: () => <div data-testid="notification-center" />,
}))

vi.mock('../../components/ui/OnboardingOverlay', () => ({
    OnboardingOverlay: () => <div data-testid="onboarding-overlay" />,
}))

vi.mock('../../components/ui/ImportSummary', () => ({
    ImportSummaryToastMount: () => <div data-testid="import-summary-toast" />,
    ImportSummaryPanelView: () => <div data-testid="import-summary-panel" />,
}))

vi.mock('../../store/importSummaryStore', () => ({
    useImportSummaryStore: vi.fn((selector: (s: { isPanelMode: boolean }) => unknown) =>
        selector({ isPanelMode: false })
    ),
}))

vi.mock('../../components/ui/ResizeHandle', () => ({
    ResizeHandle: () => <div data-testid="resize-handle" />,
}))

vi.mock('../../components/mithril/MithrilProvider', () => ({
    MithrilProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Silence the LaunchScreen's FigmaSetupWizard which fetches IPC on mount
vi.mock('../../components/ui/FigmaSetupWizard', () => ({
    FigmaSetupWizard: () => <div data-testid="figma-setup-wizard" />,
}))

// Stub SetupWizard so we can verify it renders without running its internal IPC
vi.mock('../../components/ui/SetupWizard', () => ({
    SetupWizard: ({ onComplete }: { onComplete: () => void }) => (
        <div data-testid="setup-wizard">
            <button onClick={onComplete}>Complete Wizard</button>
        </div>
    ),
}))

// Stub BetaWelcome — shouldShowBetaWelcome returns false in tests (no beta env var)
vi.mock('../../components/ui/BetaWelcome', () => ({
    BetaWelcome: ({ onSkip }: { onSkip: () => void }) => (
        <div data-testid="beta-welcome">
            <button onClick={onSkip}>Skip</button>
        </div>
    ),
    shouldShowBetaWelcome: () => false,
}))

// Mock components added after initial test authoring
vi.mock('../../components/ui/FileExplorer', () => ({
    FileExplorer: () => <div data-testid="file-explorer" />,
}))

vi.mock('../../components/ui/AgentDashboard', () => ({
    AgentDashboard: () => <div data-testid="agent-dashboard" />,
}))

vi.mock('../../components/ui/ComponentScopePanel', () => ({
    ComponentScopePanel: () => <div data-testid="component-scope-panel" />,
}))

vi.mock('../../components/ui/OnboardingNudge', () => ({
    OnboardingNudge: () => <div data-testid="onboarding-nudge" />,
}))

vi.mock('../../components/ui/CommandPalette', () => ({
    CommandPalette: () => <div data-testid="command-palette" />,
}))

// Silence hooks that use IPC or timers
vi.mock('../../hooks/useContextSync', () => ({
    useContextSync: vi.fn(),
}))

vi.mock('../../hooks/useMCPEventListener', () => ({
    useMCPEventListener: vi.fn(),
}))

vi.mock('../../hooks/useAutopilot', () => ({
    useAutopilot: vi.fn(),
}))

// Silence seedTokens dynamic import
vi.mock('../../core/seedTokens', () => ({
    seedTokens: vi.fn(),
}))

// ── System under test ────────────────────────────────────────────────────────
// Import AFTER vi.mock calls so hoisting applies correctly
import App from '../../App'

// ── Shared fixture ────────────────────────────────────────────────────────────

const POPULATED_TREE: FileTreeNode = {
    name: 'my-project',
    path: '/tmp/my-project',
    type: 'directory',
    children: [
        { name: 'App.tsx', path: '/tmp/my-project/App.tsx', type: 'file', children: [] },
    ],
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('App — LaunchScreen mount gate (Journey 1, Step 1.1)', () => {
    beforeEach(() => {
        // resetAllStores() sets workspaceFiles: null, which is our baseline.
        // createMockFlintAPI() is already applied by the global beforeEach in
        // setup.ts, but we augment it here to add the missing removeChangedListener
        // and to ensure annotations.onChanged is callable.
        resetAllStores()
        ;(window as any).flintAPI = createMockFlintAPI()
    })

    // ── Test 1 ────────────────────────────────────────────────────────────────
    it('renders LaunchScreen when workspaceFiles is null', async () => {
        // Baseline: store is already null from resetAllStores()
        expect(useCanvasStore.getState().workspaceFiles).toBeNull()

        await act(async () => {
            render(<App />)
        })

        // LaunchScreen always shows "Design System Governance" in its header
        expect(screen.getByText('Design System Governance')).toBeInTheDocument()

        // Workspace panels must NOT be present
        expect(screen.queryByTestId('xy-canvas')).not.toBeInTheDocument()
        expect(screen.queryByTestId('status-bar')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layer-tree')).not.toBeInTheDocument()
    })

    // ── Test 2 ────────────────────────────────────────────────────────────────
    it('renders the 3-panel workspace layout when workspaceFiles is populated', async () => {
        // Pre-load the store with a file tree BEFORE render so the gate is
        // already open when App mounts. This avoids async IPC round-trips.
        useCanvasStore.setState({ workspaceFiles: POPULATED_TREE })

        await act(async () => {
            render(<App />)
        })

        // Workspace panels must be present
        expect(screen.getByTestId('xy-canvas')).toBeInTheDocument()
        expect(screen.getByTestId('status-bar')).toBeInTheDocument()
        expect(screen.getByTestId('layer-tree')).toBeInTheDocument()

        // LaunchScreen must NOT appear
        expect(screen.queryByText('Design System Governance')).not.toBeInTheDocument()

        // The workspace header always shows "Flint Glass"
        expect(screen.getByRole('heading', { name: /flint glass/i })).toBeInTheDocument()
    })

    // ── Test 3 ────────────────────────────────────────────────────────────────
    // U.3 — Immersive Canvas: Glass must never render IDE panels
    it('never renders CodeEditorPanel in the workspace layout (U.3)', async () => {
        useCanvasStore.setState({ workspaceFiles: POPULATED_TREE })

        await act(async () => {
            render(<App />)
        })

        // XYCanvas occupies center; no code editor panel should be present
        expect(screen.getByTestId('xy-canvas')).toBeInTheDocument()
        expect(screen.queryByTestId('code-editor-panel')).not.toBeInTheDocument()
    })

    // ── Test 4 ────────────────────────────────────────────────────────────────
    // U.3 — Immersive Canvas: Glass must never render a terminal panel
    it('never renders TerminalPanel in the workspace layout (U.3)', async () => {
        useCanvasStore.setState({ workspaceFiles: POPULATED_TREE })

        await act(async () => {
            render(<App />)
        })

        expect(screen.getByTestId('xy-canvas')).toBeInTheDocument()
        expect(screen.queryByTestId('terminal-panel')).not.toBeInTheDocument()
    })

    // ── Test 5 ────────────────────────────────────────────────────────────────
    it('returns to LaunchScreen when workspaceFiles goes from populated back to null', async () => {
        // Start with an open project
        useCanvasStore.setState({ workspaceFiles: POPULATED_TREE })

        await act(async () => {
            render(<App />)
        })

        // Workspace is visible
        expect(screen.getByTestId('xy-canvas')).toBeInTheDocument()
        expect(screen.queryByText('Design System Governance')).not.toBeInTheDocument()

        // Simulate closing the project (equivalent to clicking "Close Project"
        // or the native menu event triggering closeWorkspace())
        await act(async () => {
            useCanvasStore.getState().closeWorkspace()
        })

        // LaunchScreen must reappear
        expect(screen.getByText('Design System Governance')).toBeInTheDocument()

        // Workspace panels must be gone
        expect(screen.queryByTestId('xy-canvas')).not.toBeInTheDocument()
        expect(screen.queryByTestId('status-bar')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layer-tree')).not.toBeInTheDocument()
    })
})

// ── ONBOARD.1: Setup Wizard gate in App.tsx ───────────────────────────────────
//
// The wizard gate sits BEFORE the LaunchScreen gate. When checkFirstLaunch
// returns isFirstLaunch: true, the app renders SetupWizard. When it returns
// isFirstLaunch: false, the app proceeds past the wizard to LaunchScreen or
// the workspace. While waiting for checkFirstLaunch to resolve, the app
// renders null (no flash of content).

describe('App — Setup Wizard gate (ONBOARD.1)', () => {
    beforeEach(() => {
        resetAllStores()
        ;(window as any).flintAPI = createMockFlintAPI()
    })

    // ── Wizard gate test 1 ────────────────────────────────────────────────────
    it('renders SetupWizard when checkFirstLaunch returns { isFirstLaunch: true }', async () => {
        ;(window.flintAPI.setup!.checkFirstLaunch as ReturnType<typeof vi.fn>).mockResolvedValue({
            isFirstLaunch: true,
        })

        await act(async () => {
            render(<App />)
        })

        expect(screen.getByTestId('setup-wizard')).toBeInTheDocument()
        // LaunchScreen must NOT appear while wizard is shown
        expect(screen.queryByText('Design System Governance')).not.toBeInTheDocument()
    })

    // ── Wizard gate test 2 ────────────────────────────────────────────────────
    it('renders LaunchScreen (not wizard) when checkFirstLaunch returns { isFirstLaunch: false }', async () => {
        ;(window.flintAPI.setup!.checkFirstLaunch as ReturnType<typeof vi.fn>).mockResolvedValue({
            isFirstLaunch: false,
        })
        // workspaceFiles is null (from resetAllStores) so LaunchScreen should appear
        expect(useCanvasStore.getState().workspaceFiles).toBeNull()

        await act(async () => {
            render(<App />)
        })

        expect(screen.getByText('Design System Governance')).toBeInTheDocument()
        expect(screen.queryByTestId('setup-wizard')).not.toBeInTheDocument()
    })

    // ── Wizard gate test 3 ────────────────────────────────────────────────────
    it('renders null while waiting for checkFirstLaunch to resolve', async () => {
        // Never resolve — the promise hangs so setupComplete stays null
        ;(window.flintAPI.setup!.checkFirstLaunch as ReturnType<typeof vi.fn>).mockReturnValue(
            new Promise(() => {}),
        )

        let container!: HTMLElement
        await act(async () => {
            ;({ container } = render(<App />))
        })

        // App returns null when setupComplete === null, so no content in DOM
        expect(container.firstChild).toBeNull()
        // Neither wizard nor LaunchScreen should be present
        expect(screen.queryByTestId('setup-wizard')).not.toBeInTheDocument()
        expect(screen.queryByText('Design System Governance')).not.toBeInTheDocument()
    })
})
