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

vi.mock('../../hooks/useIDEFileSync', () => ({
    useIDEFileSync: vi.fn(),
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

        // LaunchScreen always shows the subtitle "AI governance for your design system"
        expect(screen.getByText('AI governance for your design system')).toBeInTheDocument()

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
        expect(screen.queryByText('AI governance for your design system')).not.toBeInTheDocument()

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
        expect(screen.queryByText('AI governance for your design system')).not.toBeInTheDocument()

        // Simulate closing the project (equivalent to clicking "Close Project"
        // or the native menu event triggering closeWorkspace())
        await act(async () => {
            useCanvasStore.getState().closeWorkspace()
        })

        // LaunchScreen must reappear
        expect(screen.getByText('AI governance for your design system')).toBeInTheDocument()

        // Workspace panels must be gone
        expect(screen.queryByTestId('xy-canvas')).not.toBeInTheDocument()
        expect(screen.queryByTestId('status-bar')).not.toBeInTheDocument()
        expect(screen.queryByTestId('layer-tree')).not.toBeInTheDocument()
    })
})

// ── WS1: Demo-first onboarding gate in App.tsx ────────────────────────────────
//
// The blocking SetupWizard gate is replaced by demo-first onboarding. When
// checkFirstLaunch returns isFirstLaunch: true, the app auto-loads the demo
// project and marks first launch complete. The SetupWizard is no longer shown
// as a blocking gate — it's available later as a non-blocking modal.

describe('App — Demo-first onboarding gate (WS1)', () => {
    beforeEach(() => {
        resetAllStores()
        ;(window as any).flintAPI = createMockFlintAPI()
    })

    // ── WS1 test 1 ────────────────────────────────────────────────────────────
    it('auto-loads demo project on first launch instead of showing SetupWizard', async () => {
        const demoTree = {
            name: 'demo-project',
            path: '/tmp/flint-demo-123',
            type: 'directory' as const,
            children: [
                { name: 'DemoCard.tsx', path: '/tmp/flint-demo-123/DemoCard.tsx', type: 'file' as const, children: [] },
            ],
        }

        const api = window.flintAPI as ReturnType<typeof createMockFlintAPI>
        ;(api.setup!.checkFirstLaunch as ReturnType<typeof vi.fn>).mockResolvedValue({
            isFirstLaunch: true,
        })
        ;(api.beta!.loadDemoProject as ReturnType<typeof vi.fn>).mockResolvedValue({
            projectPath: '/tmp/flint-demo-123',
        })
        ;(api.project.openPath as ReturnType<typeof vi.fn>).mockResolvedValue(demoTree)
        ;(api.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
            'export default function DemoCard() { return <div /> }'
        )

        await act(async () => {
            render(<App />)
        })

        // SetupWizard must NOT appear — demo-first replaces the blocking gate
        expect(screen.queryByTestId('setup-wizard')).not.toBeInTheDocument()
        // Demo project auto-loaded — workspace canvas is visible
        expect(screen.getByTestId('xy-canvas')).toBeInTheDocument()
        // completeFirstLaunch is NOT called during demo load — it's deferred
        // until the user dismisses the OnboardingOverlay (first meaningful action)
        expect(api.setup!.completeFirstLaunch).not.toHaveBeenCalled()
    })

    // ── WS1 test 2 ────────────────────────────────────────────────────────────
    it('falls through to LaunchScreen when demo load fails on first launch', async () => {
        const api = window.flintAPI as ReturnType<typeof createMockFlintAPI>
        ;(api.setup!.checkFirstLaunch as ReturnType<typeof vi.fn>).mockResolvedValue({
            isFirstLaunch: true,
        })
        // Demo load returns an error
        ;(api.beta!.loadDemoProject as ReturnType<typeof vi.fn>).mockResolvedValue({
            error: 'demo not available',
        })

        await act(async () => {
            render(<App />)
        })

        // Should fall through to LaunchScreen gracefully
        expect(screen.getByText('AI governance for your design system')).toBeInTheDocument()
        // SetupWizard must NOT appear as a blocker
        expect(screen.queryByTestId('setup-wizard')).not.toBeInTheDocument()
    })

    // ── WS1 test 3 (unchanged) ───────────────────────────────────────────────
    it('renders LaunchScreen (not wizard) when checkFirstLaunch returns { isFirstLaunch: false }', async () => {
        ;(window.flintAPI.setup!.checkFirstLaunch as ReturnType<typeof vi.fn>).mockResolvedValue({
            isFirstLaunch: false,
        })
        // workspaceFiles is null (from resetAllStores) so LaunchScreen should appear
        expect(useCanvasStore.getState().workspaceFiles).toBeNull()

        await act(async () => {
            render(<App />)
        })

        expect(screen.getByText('AI governance for your design system')).toBeInTheDocument()
        expect(screen.queryByTestId('setup-wizard')).not.toBeInTheDocument()
    })

    // ── WS1 test 4 (unchanged) ───────────────────────────────────────────────
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
        expect(screen.queryByText('AI governance for your design system')).not.toBeInTheDocument()
    })
})

// ── LAUNCH.2 regression: LaunchScreen loop bug ────────────────────────────────
//
// Root cause: server/index.ts `project:get-last-session` returned activeProjectRoot
// (the CLI default) unconditionally. App.tsx auto-resume called project.openPath()
// concurrently with any user-triggered open (e.g. createScratchpad). The two async
// hydrateWorkspace calls raced: one set workspaceFiles to the scratchpad tree, the
// other overwrote it with the CLI root tree. If openPath took longer than
// createScratchpad, the final workspaceFiles value oscillated — LaunchScreen loop.
//
// Fix: server returns null from project:get-last-session until a project has been
// explicitly opened (sessionExplicitlyOpened flag). The React side is validated here:
// when getLastSession returns null, auto-resume does nothing and LaunchScreen stays.

describe('App — auto-resume LaunchScreen loop regression (LAUNCH.2)', () => {
    beforeEach(() => {
        resetAllStores()
        ;(window as any).flintAPI = createMockFlintAPI()
    })

    // ── Regression test 1 ─────────────────────────────────────────────────────
    // When getLastSession returns null (the corrected server behaviour on fresh
    // load), auto-resume must NOT call project.openPath and must NOT change
    // workspaceFiles — the app stays on LaunchScreen.
    it('stays on LaunchScreen when getLastSession returns null (no previous session)', async () => {
        // getLastSession already returns null in the default createMockFlintAPI()
        // (see setup.ts line ~105). Confirm this is the case.
        const api = window.flintAPI as ReturnType<typeof createMockFlintAPI>
        expect(api.session.getLastSession).toBeDefined()

        await act(async () => {
            render(<App />)
        })

        // LaunchScreen must be showing
        expect(screen.getByText('AI governance for your design system')).toBeInTheDocument()

        // project.openPath must NOT have been called — auto-resume skipped
        expect((api.project.openPath as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)

        // workspaceFiles must still be null
        expect(useCanvasStore.getState().workspaceFiles).toBeNull()
    })

    // ── Regression test 2 ─────────────────────────────────────────────────────
    // When getLastSession returns a real session, auto-resume calls openPath.
    // If openPath succeeds, the workspace is hydrated and the canvas shows.
    // This verifies the happy path is NOT broken by the fix.
    it('hydrates workspace when getLastSession returns a non-scratchpad session', async () => {
        const sessionTree: FileTreeNode = {
            name: 'my-app',
            path: '/tmp/my-app',
            type: 'directory',
            children: [
                { name: 'App.tsx', path: '/tmp/my-app/App.tsx', type: 'file', children: [] },
            ],
        }

        const api = window.flintAPI as ReturnType<typeof createMockFlintAPI>
        // Override getLastSession to return a real non-scratchpad session
        ;(api.session.getLastSession as ReturnType<typeof vi.fn>).mockResolvedValue({
            path: '/tmp/my-app',
            name: 'my-app',
            isScratchpad: false,
        })
        // openPath returns the tree
        ;(api.project.openPath as ReturnType<typeof vi.fn>).mockResolvedValue(sessionTree)
        // readFile returns stub content so setActiveFile doesn't throw
        ;(api.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
            'export default function App() { return <div /> }'
        )

        await act(async () => {
            render(<App />)
        })

        // project.openPath must have been called with the session path
        expect((api.project.openPath as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('/tmp/my-app')

        // workspaceFiles should be populated — workspace canvas shows
        expect(useCanvasStore.getState().workspaceFiles).toEqual(sessionTree)
        expect(screen.getByTestId('xy-canvas')).toBeInTheDocument()
        expect(screen.queryByText('AI governance for your design system')).not.toBeInTheDocument()
    })

    // ── Regression test 3 ─────────────────────────────────────────────────────
    // When getLastSession returns a scratchpad session, auto-resume must skip it
    // (the guard `if (session.isScratchpad) return`). LaunchScreen stays.
    it('stays on LaunchScreen when getLastSession returns a scratchpad session', async () => {
        const api = window.flintAPI as ReturnType<typeof createMockFlintAPI>
        ;(api.session.getLastSession as ReturnType<typeof vi.fn>).mockResolvedValue({
            path: '/Users/test/Flint Projects/Untitled-1',
            name: 'Untitled-1',
            isScratchpad: true,
        })

        await act(async () => {
            render(<App />)
        })

        // Scratchpad sessions are skipped — openPath must NOT be called
        expect((api.project.openPath as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)

        // LaunchScreen stays
        expect(screen.getByText('AI governance for your design system')).toBeInTheDocument()
        expect(useCanvasStore.getState().workspaceFiles).toBeNull()
    })
})
