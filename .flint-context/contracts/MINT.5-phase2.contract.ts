/**
 * MINT.5 Phase 2 — Sync Action Surfaces
 * Executable Contract
 *
 * Phase: MINT.5 (Phase 2 of 4)
 * Status: DRAFT
 * Date: 2026-04-18
 * Binds against: .flint-context/reviews/mint-{ux,code,security}-review-2026-04-17.md
 * Builds on:   MINT.5-phase1.contract.ts — imports TokenDrift, TokenHealthData, etc.
 *
 * Phase 2 agents import these types directly. No implementation lives here.
 * This file must compile cleanly with `npx tsc --noEmit`.
 *
 * Scope:
 *   2.1  Sync action cluster (Pull / Push / Resolve) in TokenHealthBar.
 *   2.2  Drift sub-tab in TokenGrid (ViewMode 'drift' + DriftGroupSection + TokenDriftRow).
 *   2.3  Connect Figma empty state (replaces tokens-empty-state in TokenManager).
 *   2.4  Confirm dialogs for destructive actions (Push, Resolve).
 *   + useSyncActions hook that owns syncOp state and wraps all MCP calls.
 *
 * Non-goals (Phase 3+): emit/export dropdown, TokenImpactAccordion embed,
 * aria-live announcements, read-only banner, ApprovalStagingArea collapse,
 * sync staleness narration, OAuth flow changes, MCP tool signature changes,
 * new IPC channels, new Zustand stores.
 */

import type { FlintContract } from '../../shared/contract-schema.js'
import type { TokenDrift } from './MINT.5-phase1.contract.js'

// ─── Sync Action Hook ──────────────────────────────────────────────────────────

/**
 * Current in-flight sync operation. `null` means idle.
 * `pull-one` is distinguished from `pull` so SyncActionCluster can keep the
 * cluster-level Pull button enabled while a row-level Pull-this is running.
 */
export type SyncOp =
    | 'pull'
    | 'push'
    | 'resolve'
    | 'pull-one'
    | 'connect'
    | null

/**
 * Resolution strategy passed to flint_resolve_all.
 * Matches the existing MCP tool's accepted values.
 */
export type ResolveStrategy = 'prefer-figma' | 'prefer-local'

/**
 * Last-error payload surfaced to the hook consumer. Populated on any MCP tool
 * call that returns `isError: true`. Separated from the notification toast so
 * persistent UI (e.g. a SeverityChip in the health bar) can reflect an
 * auth-expired state without polling the notification store.
 */
export interface SyncActionError {
    tool: string
    message: string
    timestamp: number
    /**
     * When true, the error is structural (auth expired, connection revoked)
     * and the UI should render a persistent badge rather than a transient
     * toast. Derived from the MCP tool response headers.
     */
    persistent: boolean
}

/**
 * Return shape of useSyncActions. Implementation lives in
 * src/hooks/useSyncActions.ts.
 */
export interface UseSyncActionsResult {
    /** Current in-flight op, or null. Driven from a single setState. */
    syncOp: SyncOp
    /** Last error observed, or null. */
    lastError: SyncActionError | null
    /** True when window.flintAPI.mcp.callTool is available. */
    ready: boolean

    /** Full pull from Figma. Idempotent. */
    pull: () => Promise<void>
    /** Push local changes to Figma. Shows ConfirmPushDialog before firing. */
    push: () => Promise<void>
    /** Bulk-resolve conflicts. Shows ConfirmResolveDialog before firing. */
    resolve: (strategy: ResolveStrategy) => Promise<void>
    /** Pull a single token. Calls flint_sync_pull with { scope: 'token', tokenPath }. */
    pullOne: (tokenPath: string) => Promise<void>
    /** Trigger Alliance OAuth connection flow via flint_figma_connect. */
    connect: () => Promise<void>
}

export interface UseSyncActionsOptions {
    /** Optional callback fired after any successful sync. Used to refetch tokens. */
    onAfterSync?: () => void
    /**
     * Confirm callback for destructive actions. Tests substitute a no-prompt
     * variant. Production uses a dialog-state setter.
     */
    confirmPush?: () => Promise<boolean>
    confirmResolve?: () => Promise<ResolveStrategy | null>
}

export type UseSyncActionsHook = (
    options?: UseSyncActionsOptions,
) => UseSyncActionsResult

// ─── Sync Action Cluster ──────────────────────────────────────────────────────

/**
 * Cluster of 3 sync buttons — Pull, Push, Resolve — rendered at the trailing
 * edge of TokenHealthBar when Figma is connected. Falls back to a single
 * "Connect Figma" CTA when disconnected.
 *
 * Component is purely presentational. All MCP orchestration lives in
 * useSyncActions.
 */
export interface SyncActionClusterProps {
    figmaConnected: boolean
    /** Count of tokens whose local value differs from Figma. */
    driftCount: number
    /** Count of sync conflicts awaiting resolution. */
    pendingConflictCount: number
    /**
     * Count of local token edits not yet pushed. Disables the Push button
     * when 0. Sourced from useSyncActions via flint_sync_check.
     */
    localEditCount: number
    /** Current in-flight op. Drives loading spinners + disabled states. */
    syncOp: SyncOp
    onPull: () => void
    onPush: () => void
    onResolve: () => void
    /** Called when Figma is disconnected and user clicks the Connect CTA. */
    onConnect?: () => void
}

// ─── Drift Sub-Tab ────────────────────────────────────────────────────────────

/**
 * ViewMode extension. Phase 1 shipped 'grid' | 'list'. Phase 2 adds 'drift'
 * as a third radiogroup option in TokenManager. When selected, TokenGrid
 * renders DriftGroupSection instead of TokenGroupSection.
 */
export type Phase2ViewMode = 'grid' | 'list' | 'drift'

/**
 * Single-row renderer for a drifted token. Shown inside DriftGroupSection
 * when ViewMode === 'drift'.
 *
 * Layout:
 *   [localSwatch]  →  [figmaSwatch]   ΔE N (chip, if color)   [Pull this]
 *
 * Local + Figma values rendered as swatches (for colors) or raw text
 * (dimension / typography). ΔE chip only for tokens with drift.deltaE
 * defined — Phase 1 contract guarantees deltaE is set only for color tokens.
 */
export interface TokenDriftRowProps {
    drift: TokenDrift
    /** DesignToken.token_type — drives swatch-vs-text rendering. */
    tokenType: string
    /** Fires when user clicks the per-row Pull button. */
    onPullOne: (tokenPath: string) => void
    /** Fires when user activates the row (click or Enter). */
    onSelect: (tokenPath: string) => void
    /** True while this specific row's pullOne is in flight. */
    isPulling: boolean
}

/**
 * Container rendered when ViewMode === 'drift'. Groups drifted tokens by
 * collection (matches TokenGroupSection grouping convention).
 */
export interface DriftGroupSectionProps {
    driftedTokens: TokenDrift[]
    /**
     * Lookup from tokenPath to the full DesignToken row, so the section can
     * render the token_type swatch and join collection_name for grouping.
     */
    tokensByPath: Map<string, { token_path: string; token_type: string; collection_name: string }>
    onPullOne: (tokenPath: string) => void
    onSelect: (tokenPath: string) => void
    /**
     * Path of the currently-pulling token (or null). Used to show the
     * spinner on only the correct row when pullOne is in flight.
     */
    currentPullingPath: string | null
}

// ─── Connect Figma Empty State ────────────────────────────────────────────────

/**
 * Full-panel empty state shown when tokens.length === 0. Renders one of
 * three variants:
 *   1. figmaConnected=false → "Connect Figma" primary CTA, import link.
 *   2. figmaConnected=true + tokenCount=0 → "Pull from Figma" primary CTA.
 *   3. tokenCount > 0 → returns null (empty state suppressed).
 */
export interface ConnectFigmaEmptyStateProps {
    figmaConnected: boolean
    tokenCount: number
    syncOp: SyncOp
    onConnect: () => void
    onPullFromFigma: () => void
    onOpenImport: () => void
}

// ─── Confirm Dialogs ──────────────────────────────────────────────────────────

export interface ConfirmPushDialogProps {
    isOpen: boolean
    /** Count of local token changes that will be pushed. */
    localEditCount: number
    /** Fired when user clicks Confirm. */
    onConfirm: () => void
    /** Fired when user clicks Cancel or presses Escape. */
    onCancel: () => void
}

export interface ConfirmResolveDialogProps {
    isOpen: boolean
    /** Count of pending conflicts that will be resolved. */
    conflictCount: number
    /** Fired when user clicks Confirm. Argument is the selected strategy. */
    onConfirm: (strategy: ResolveStrategy) => void
    /** Fired when user clicks Cancel or presses Escape. */
    onCancel: () => void
}

// ─── TokenHealthBar Prop Extension ────────────────────────────────────────────

/**
 * Phase 2 extension to TokenHealthBarProps. Phase 1 shipped totalTokens,
 * figmaConnected, usageFileCount, health. Phase 2 adds the sync-cluster
 * props, which are passed through to <SyncActionCluster>.
 *
 * Implementation may instead consume useSyncActions directly inside
 * TokenHealthBar and drop these new props — architect preference: pass props
 * so the component remains presentational. flint-design-engineer may choose
 * the inline-hook path if testing proves easier.
 */
export interface TokenHealthBarPhase2Extension {
    /** Count of local edits needing push. From flint_sync_check. */
    localEditCount?: number
    /** Count of pending conflicts. From flint_sync_check. */
    pendingConflictCount?: number
    /** Current syncOp (for loading indicators). */
    syncOp?: SyncOp
    onPull?: () => void
    onPush?: () => void
    onResolve?: () => void
    onConnect?: () => void
}

// ─── Contract Metadata ────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'MINT.5-phase2-SyncActionSurfaces',
        phase: 'MINT.5.2',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-18',
        audience: 'designer',
    },
    impact: [
        // 2.1 — Sync action cluster
        { file: 'src/components/ui/mint/SyncActionCluster.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Pull / Push / Resolve cluster (purely presentational). Disabled-state matrix + loading spinners.' },
        { file: 'src/components/ui/mint/ConfirmPushDialog.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Confirm dialog for destructive Push action. FocusTrap + role=dialog + aria-modal.' },
        { file: 'src/components/ui/mint/ConfirmResolveDialog.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Confirm dialog for Resolve with strategy radio (prefer-figma | prefer-local).' },
        { file: 'src/hooks/useSyncActions.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'Hook owning syncOp + lastError. Wraps mcp.callTool for all 5 sync tools. Emits notifications.' },
        { file: 'src/components/ui/__tests__/SyncActionCluster.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Disabled-state matrix + loading + disconnected fallback.' },
        { file: 'src/hooks/__tests__/useSyncActions.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'pull / push / resolve / pullOne / connect flows + error paths + serialization.' },
        { file: 'src/components/ui/mint/__tests__/ConfirmPushDialog.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Focus trap + confirm/cancel + Escape + content reflects localEditCount.' },
        { file: 'src/components/ui/mint/__tests__/ConfirmResolveDialog.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Strategy radio + confirm returns selected strategy.' },
        { file: 'src/components/ui/TokenHealthBar.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Add trailing SyncActionCluster. Thread new Phase 2 props through.' },

        // 2.2 — Drift sub-tab
        { file: 'src/components/ui/mint/TokenDriftRow.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Row renderer: local swatch | → | figma swatch | ΔE chip (color only) | Pull-this button.' },
        { file: 'src/components/ui/mint/DriftGroupSection.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Groups drifted tokens by collection. Empty state when zero.' },
        { file: 'src/components/ui/TokenGrid.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Extend ViewMode to include "drift". Route viewMode=="drift" → DriftGroupSection.' },
        { file: 'src/components/ui/mint/__tests__/TokenDriftRow.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Color row with ΔE; non-color row without; Pull-this fires onPullOne; Enter opens detail.' },
        { file: 'src/components/ui/mint/__tests__/DriftGroupSection.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Groups-by-collection; empty state.' },
        { file: 'src/components/ui/__tests__/TokenGrid.drift-tab.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'ViewMode=drift filters tokens; radiogroup ARIA; badge-count updates.' },

        // 2.3 — Connect Figma empty state
        { file: 'src/components/ui/mint/ConnectFigmaEmptyState.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Full-panel empty state. 3 variants: disconnected / connected-no-tokens / has-tokens(null).' },
        { file: 'src/components/ui/mint/__tests__/ConnectFigmaEmptyState.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'All 3 variants render; CTAs fire props; has-tokens returns null.' },

        // 2.3 + 2.4 — TokenManager integration
        { file: 'src/components/ui/TokenManager.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Add "drift" to radiogroup with badge count. Replace empty state with ConnectFigmaEmptyState. Wire useSyncActions. Pass actions down to TokenHealthBar and drift sub-tab.' },
    ],
    ipc: [
        // No NEW IPC in Phase 2. Reference the existing mcp:call-tool that is consumed.
        {
            channel: 'mcp:call-tool',
            direction: 'renderer\u2192main',
            payloadType: '{ tool: string; args: unknown }',
            returnType: 'MCPToolResponse',
            handler: 'electron/main.ts (existing) + server/index.ts (existing)',
            validator: 'mcpCallToolSchema',
        },
    ],
    stores: [],
    components: [
        {
            name: 'SyncActionCluster',
            file: 'src/components/ui/mint/SyncActionCluster.tsx',
            propsType: 'SyncActionClusterProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'TokenDriftRow',
            file: 'src/components/ui/mint/TokenDriftRow.tsx',
            propsType: 'TokenDriftRowProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'DriftGroupSection',
            file: 'src/components/ui/mint/DriftGroupSection.tsx',
            propsType: 'DriftGroupSectionProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'ConnectFigmaEmptyState',
            file: 'src/components/ui/mint/ConnectFigmaEmptyState.tsx',
            propsType: 'ConnectFigmaEmptyStateProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'ConfirmPushDialog',
            file: 'src/components/ui/mint/ConfirmPushDialog.tsx',
            propsType: 'ConfirmPushDialogProps',
            consumesStores: [],
            emitsIPC: ['mcp:call-tool'],
        },
        {
            name: 'ConfirmResolveDialog',
            file: 'src/components/ui/mint/ConfirmResolveDialog.tsx',
            propsType: 'ConfirmResolveDialogProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'TokenHealthBar',
            file: 'src/components/ui/TokenHealthBar.tsx',
            propsType: 'TokenHealthBarProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'TokenGrid',
            file: 'src/components/ui/TokenGrid.tsx',
            propsType: 'TokenGridProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'TokenManager',
            file: 'src/components/ui/TokenManager.tsx',
            propsType: 'TokenManagerProps',
            consumesStores: ['tokenStore'],
            emitsIPC: ['mcp:call-tool'],
        },
    ],
    commandments: [1, 4, 5, 9, 12, 14],
    invariants: [
        {
            name: 'sync-latency-p95',
            measurable: 'end-to-end sync action latency (user click → notification push)',
            threshold: '< 400ms at N=500 tokens',
            measuredBy: 'performance.now() markers around handleSync in useSyncActions tests',
        },
        {
            name: 'zero-unauth-sync-calls',
            measurable: 'MCP sync tool invocations while Figma is disconnected',
            threshold: '= 0 calls across all user paths',
            measuredBy: 'component test asserts mcp.callTool not invoked when figmaConnected=false',
        },
        {
            name: 'drift-render-memory',
            measurable: 'DriftGroupSection cold-mount render time with 500 drifted tokens',
            threshold: '< 120ms',
            measuredBy: 'vitest performance.now() around RTL render() in drift-tab test',
        },
        {
            name: 'confirm-dialog-blocks-action',
            measurable: 'flint_sync_push tool calls after Cancel pressed',
            threshold: '= 0 calls',
            measuredBy: 'ConfirmPushDialog.test asserts mcp.callTool not invoked on Cancel path',
        },
        {
            name: 'sync-op-serialization',
            measurable: 'additional tool calls fired while syncOp != null',
            threshold: '= 0 additional calls',
            measuredBy: 'useSyncActions.test invokes pull() twice in quick succession, asserts mcp.callTool called exactly 1 time',
        },
    ],
    testBoundaries: [
        // ── 2.1 — Sync action cluster ────────────────────────────────────────
        {
            target: 'SyncActionCluster',
            kind: 'component',
            behavior: 'Renders Connect CTA when Figma is disconnected',
            assertion: 'queryByRole("button", { name: /connect figma/i }) exists; Pull / Push / Resolve not rendered',
            edgeCases: ['Also renders Connect when onConnect prop is provided', 'Renders no cluster when onConnect undefined and disconnected'],
            given: 'figmaConnected=false and onConnect prop provided',
            when: 'the component mounts',
            then: 'renders a single "Connect Figma" CTA and does not render Pull/Push/Resolve buttons',
        },
        {
            target: 'SyncActionCluster',
            kind: 'component',
            behavior: 'Disables Pull button when no drift detected',
            assertion: 'getByTestId("sync-pull").hasAttribute("disabled") === true',
            edgeCases: ['aria-label reads "Up to date"', 'Tooltip reads "No drift to pull"'],
            given: 'figmaConnected=true and driftCount=0',
            when: 'the component mounts',
            then: 'renders the Pull button disabled with aria-label "Up to date"',
        },
        {
            target: 'SyncActionCluster',
            kind: 'component',
            behavior: 'Disables Push button when localEditCount is zero',
            assertion: 'getByTestId("sync-push").hasAttribute("disabled") === true',
            edgeCases: ['Enabled when localEditCount > 0'],
            given: 'figmaConnected=true and localEditCount=0',
            when: 'the component mounts',
            then: 'renders the Push button disabled',
        },
        {
            target: 'SyncActionCluster',
            kind: 'component',
            behavior: 'Disables Resolve button when no pending conflicts',
            assertion: 'getByTestId("sync-resolve").hasAttribute("disabled") === true',
            edgeCases: [],
            given: 'figmaConnected=true and pendingConflictCount=0',
            when: 'the component mounts',
            then: 'renders the Resolve button disabled',
        },
        {
            target: 'SyncActionCluster',
            kind: 'component',
            behavior: 'Shows loading spinner during in-flight op',
            assertion: 'getByTestId("sync-pull") contains Loader2 svg; Push and Resolve are disabled',
            edgeCases: ['Loader2 replaces the Download icon'],
            given: 'syncOp="pull"',
            when: 'the component mounts',
            then: 'renders a spinner on the Pull button and disables Push and Resolve',
        },

        // ── useSyncActions hook ──────────────────────────────────────────────
        {
            target: 'useSyncActions.pull',
            kind: 'hook',
            behavior: 'Invokes flint_sync_pull via mcp.callTool',
            assertion: 'mcp.callTool was called with ("flint_sync_pull", {}) exactly once',
            edgeCases: ['onAfterSync callback fires after success'],
            given: 'figmaConnected=true and mcp.callTool mocked to resolve successfully',
            when: 'pull() is invoked from the hook',
            then: 'calls mcp.callTool with "flint_sync_pull" and emits a success notification',
        },
        {
            target: 'useSyncActions.push',
            kind: 'hook',
            behavior: 'Invokes flint_sync_push after confirm dialog accepted',
            assertion: 'mcp.callTool was called with "flint_sync_push"',
            edgeCases: ['confirmPush returning false aborts the push'],
            given: 'confirmPush returns true',
            when: 'push() is invoked',
            then: 'calls mcp.callTool with "flint_sync_push" exactly once',
        },
        {
            target: 'useSyncActions.push cancel',
            kind: 'hook',
            behavior: 'Does not invoke mcp tool when confirmPush returns false',
            assertion: 'mcp.callTool was NOT called after push() with confirm=false',
            edgeCases: [],
            given: 'confirmPush returns false',
            when: 'push() is invoked',
            then: 'blocks the MCP tool call and resolves without side effect',
        },
        {
            target: 'useSyncActions.resolve',
            kind: 'hook',
            behavior: 'Invokes flint_resolve_all with selected strategy',
            assertion: 'mcp.callTool was called with ("flint_resolve_all", { strategy: "prefer-figma" })',
            edgeCases: ['strategy prefer-local is forwarded equivalently'],
            given: 'confirmResolve returns "prefer-figma"',
            when: 'resolve("prefer-figma") is invoked',
            then: 'calls mcp.callTool with the strategy in the args payload',
        },
        {
            target: 'useSyncActions.pullOne',
            kind: 'hook',
            behavior: 'Invokes flint_sync_pull with per-token scope',
            assertion: 'mcp.callTool was called with ("flint_sync_pull", { scope: "token", tokenPath: "colors.primary" })',
            edgeCases: ['Scope arg rejected by MCP → hook surfaces error via lastError and does NOT fall back to full pull'],
            given: 'tokenPath="colors.primary" and mcp.callTool mocked to resolve successfully',
            when: 'pullOne("colors.primary") is invoked',
            then: 'calls mcp.callTool with { scope: "token", tokenPath: "colors.primary" } and emits success notification',
        },
        {
            target: 'useSyncActions.connect',
            kind: 'hook',
            behavior: 'Invokes flint_figma_connect via mcp.callTool',
            assertion: 'mcp.callTool was called with ("flint_figma_connect", { action: "connect" })',
            edgeCases: [],
            given: 'figmaConnected=false',
            when: 'connect() is invoked',
            then: 'calls mcp.callTool with flint_figma_connect and emits a toast on completion',
        },
        {
            target: 'useSyncActions.error',
            kind: 'hook',
            behavior: 'Sets lastError and emits error notification on MCP isError response',
            assertion: 'lastError.tool === "flint_sync_pull" && notificationStore.push called with severity="error"',
            edgeCases: ['autoDismissMs=8000 for errors'],
            given: 'mcp.callTool resolves with isError=true and message="network timeout"',
            when: 'pull() is invoked',
            then: 'sets lastError.tool to "flint_sync_pull" and emits an error notification with autoDismissMs=8000',
        },
        {
            target: 'useSyncActions auth-expired',
            kind: 'hook',
            behavior: 'Sets lastError.persistent=true on auth-expired MCP response',
            assertion: 'lastError.persistent === true && notificationStore.push called with severity="critical"',
            edgeCases: [],
            given: 'mcp.callTool resolves with isError=true and status-header indicating auth-expired',
            when: 'any action is invoked',
            then: 'sets lastError.persistent=true and emits a critical notification',
        },
        {
            target: 'useSyncActions serialization',
            kind: 'hook',
            behavior: 'Rejects concurrent sync actions while syncOp != null',
            assertion: 'mcp.callTool was called exactly 1 time after pull() invoked twice in succession',
            edgeCases: [],
            given: 'syncOp is currently "pull"',
            when: 'pull() is invoked a second time before the first resolves',
            then: 'blocks the second call and returns without invoking mcp.callTool a second time',
        },

        // ── 2.2 — Drift sub-tab ──────────────────────────────────────────────
        {
            target: 'TokenManager drift radio',
            kind: 'component',
            behavior: 'Renders "Drift (N)" radio button with count',
            assertion: 'getByRole("radio", { name: /drift \\(3\\)/i }) is in the document',
            edgeCases: ['Count 0 hides the badge portion but keeps the radio', 'Count = driftedTokens.length'],
            given: 'driftedTokens.length=3',
            when: 'TokenManager renders',
            then: 'renders a radio button with label "Drift (3)"',
        },
        {
            target: 'TokenGrid drift filter',
            kind: 'component',
            behavior: 'Routes to DriftGroupSection when viewMode is drift',
            assertion: 'queryByTestId("drift-group-section") !== null && queryByTestId("token-group-section") === null',
            edgeCases: [],
            given: 'viewMode="drift" and driftedTokens.length=3',
            when: 'TokenGrid renders',
            then: 'renders DriftGroupSection and does not render TokenGroupSection',
        },
        {
            target: 'TokenDriftRow color',
            kind: 'component',
            behavior: 'Renders swatches and amber ΔE chip for color drift',
            assertion: 'queryAllByRole("img", { name: /swatch/i }).length === 2 && getByText(/ΔE 3.2/i) exists',
            edgeCases: ['Chip color matches severity: amber ≤4, critical > 4'],
            given: 'drift={ tokenName:"colors.primary", localValue:"#f00", figmaValue:"#e00", deltaE:3.2 } and tokenType="color"',
            when: 'TokenDriftRow renders',
            then: 'renders two swatch elements and a ΔE chip showing "3.2"',
        },
        {
            target: 'TokenDriftRow dimension',
            kind: 'component',
            behavior: 'Renders values and omits ΔE chip for non-color drift',
            assertion: 'getByText("16px") exists && getByText("18px") exists && queryByText(/ΔE/i) === null',
            edgeCases: [],
            given: 'drift with deltaE=undefined and tokenType="dimension"',
            when: 'TokenDriftRow renders',
            then: 'renders local and figma text values and omits the ΔE chip',
        },
        {
            target: 'TokenDriftRow pullOne',
            kind: 'component',
            behavior: 'Invokes onPullOne with tokenPath when Pull-this clicked',
            assertion: 'onPullOne was called with "colors.primary" exactly once',
            edgeCases: ['Disabled while isPulling=true'],
            given: 'TokenDriftRow rendered with drift.tokenName="colors.primary"',
            when: 'user clicks the Pull-this button',
            then: 'calls onPullOne with "colors.primary" exactly once',
        },
        {
            target: 'TokenDriftRow keyboard',
            kind: 'component',
            behavior: 'Opens detail on Enter key',
            assertion: 'onSelect was called with "colors.primary"',
            edgeCases: ['Space key also triggers onSelect', 'Tab moves focus to Pull-this button'],
            given: 'TokenDriftRow focused and drift.tokenName="colors.primary"',
            when: 'user presses Enter',
            then: 'calls onSelect with "colors.primary"',
        },
        {
            target: 'DriftGroupSection empty',
            kind: 'component',
            behavior: 'Renders no-drift placeholder when driftedTokens is empty',
            assertion: 'getByText(/no drift/i) is in the document',
            edgeCases: [],
            given: 'driftedTokens=[]',
            when: 'DriftGroupSection renders',
            then: 'renders an empty-state message and no TokenDriftRow instances',
        },
        {
            target: 'DriftGroupSection grouping',
            kind: 'component',
            behavior: 'Groups drifted tokens by collection',
            assertion: 'queryAllByRole("heading", { level: 3 }).length === 2 when 2 collections have drift',
            edgeCases: ['Sort order matches TokenGroupSection (alphabetical)'],
            given: 'driftedTokens spanning 2 collections ("colors", "spacing")',
            when: 'DriftGroupSection renders',
            then: 'renders 2 collection headings',
        },

        // ── 2.3 — Connect Figma empty state ──────────────────────────────────
        {
            target: 'ConnectFigmaEmptyState disconnected',
            kind: 'component',
            behavior: 'Renders Connect primary CTA when Figma is disconnected',
            assertion: 'getByRole("button", { name: /connect figma/i }) is the primary CTA',
            edgeCases: ['Import link text "or import a tokens JSON file" also rendered'],
            given: 'figmaConnected=false and tokenCount=0',
            when: 'ConnectFigmaEmptyState renders',
            then: 'renders a "Connect Figma" button and a secondary "import" link',
        },
        {
            target: 'ConnectFigmaEmptyState connected-no-tokens',
            kind: 'component',
            behavior: 'Renders Pull primary CTA when connected but no tokens',
            assertion: 'getByRole("button", { name: /pull from figma/i }) exists && queryByRole("button", { name: /connect figma/i }) === null',
            edgeCases: [],
            given: 'figmaConnected=true and tokenCount=0',
            when: 'ConnectFigmaEmptyState renders',
            then: 'renders a "Pull from Figma" button and suppresses the Connect CTA',
        },
        {
            target: 'ConnectFigmaEmptyState has-tokens',
            kind: 'component',
            behavior: 'Returns null when tokens exist',
            assertion: 'container.firstChild === null',
            edgeCases: [],
            given: 'tokenCount=5',
            when: 'ConnectFigmaEmptyState renders',
            then: 'returns null from the render',
        },
        {
            target: 'ConnectFigmaEmptyState onConnect',
            kind: 'component',
            behavior: 'Fires onConnect prop when Connect clicked',
            assertion: 'onConnect called exactly once',
            edgeCases: ['Disabled when syncOp="connect"'],
            given: 'figmaConnected=false',
            when: 'user clicks the Connect Figma button',
            then: 'calls onConnect exactly once',
        },
        {
            target: 'ConnectFigmaEmptyState import link',
            kind: 'component',
            behavior: 'Fires onOpenImport when import text link clicked',
            assertion: 'onOpenImport called exactly once',
            edgeCases: [],
            given: 'figmaConnected=false',
            when: 'user clicks the "or import a tokens JSON file" link',
            then: 'calls onOpenImport exactly once',
        },

        // ── 2.4 — Confirm dialogs ────────────────────────────────────────────
        {
            target: 'ConfirmPushDialog content',
            kind: 'component',
            behavior: 'Renders localEditCount in dialog copy',
            assertion: 'getByText(/12 local token changes/i) is in the document',
            edgeCases: ['Singular "1 local token change"', 'Zero count suppresses the dialog (caller guard)'],
            given: 'isOpen=true and localEditCount=12',
            when: 'ConfirmPushDialog renders',
            then: 'renders "12 local token changes" in the dialog body',
        },
        {
            target: 'ConfirmPushDialog focus trap',
            kind: 'component',
            behavior: 'Keeps focus inside dialog while open',
            assertion: 'After Tab-cycling, document.activeElement is always within the dialog',
            edgeCases: [],
            given: 'dialog mounted with isOpen=true',
            when: 'user Tab-cycles through focusable elements',
            then: 'blocks focus from escaping the dialog',
        },
        {
            target: 'ConfirmPushDialog confirm',
            kind: 'component',
            behavior: 'Fires onConfirm exactly once on Confirm click',
            assertion: 'onConfirm called 1 time; onCancel not called',
            edgeCases: [],
            given: 'dialog mounted',
            when: 'user clicks the Confirm button',
            then: 'calls onConfirm exactly once',
        },
        {
            target: 'ConfirmPushDialog cancel',
            kind: 'component',
            behavior: 'Fires onCancel on Escape key',
            assertion: 'onCancel called 1 time; onConfirm not called',
            edgeCases: ['Cancel button click also fires onCancel'],
            given: 'dialog mounted',
            when: 'user presses Escape',
            then: 'calls onCancel exactly once',
        },
        {
            target: 'ConfirmResolveDialog strategy',
            kind: 'component',
            behavior: 'Forwards selected strategy on Confirm',
            assertion: 'onConfirm called with "prefer-figma"',
            edgeCases: ['Default strategy is "prefer-figma"', 'User can select "prefer-local" via radio'],
            given: 'user selects "Prefer Figma" radio',
            when: 'user clicks Confirm',
            then: 'calls onConfirm with "prefer-figma"',
        },
    ],
    risks: [
        {
            risk: 'flint_sync_pull does not accept { scope: "token", tokenPath } — per-row Pull-this silently triggers full pull or fails',
            severity: 'medium',
            mitigation: 'Verify MCP tool signature during implementation (Group A). If scope arg absent, ship Pull-this button disabled with tooltip "Full pull only" and file Phase 3 MCP change request. Do not silently upgrade to full pull.',
        },
        {
            risk: 'notificationStore 5-concurrent cap silently dismisses old toasts during a Pull→Push→Resolve burst',
            severity: 'low',
            mitigation: 'Sync toasts are 4s auto-dismiss — 3 back-to-back syncs fit well under the cap. Document the cap in useSyncActions JSDoc.',
        },
        {
            risk: 'useSyncActions unguarded window.flintAPI access throws in test environment',
            severity: 'medium',
            mitigation: 'Hook returns `ready: false` when window.flintAPI?.mcp?.callTool is undefined. All consumers check ready before invoking actions. Tests set up window.flintAPI stub in beforeEach.',
        },
        {
            risk: 'Confirm dialog focus restoration does not return focus to the source button on close',
            severity: 'low',
            commandment: 5,
            mitigation: 'Reuse FocusTrap from ImportModal which captures returnFocusTo. Test asserts document.activeElement is the Push button after Escape.',
        },
        {
            risk: 'SyncActionCluster overflows to a third row on narrow sidebar widths',
            severity: 'medium',
            mitigation: 'Use flex-wrap. When container width < 360px, collapse labels to icons only (tooltip preserves meaning). Snapshot tests at 280px / 360px / 480px.',
        },
        {
            risk: 'Figma API rate limit on Push — no retry path surfaced to user',
            severity: 'medium',
            mitigation: 'Error toast includes "Retry" actionCallback that re-invokes push(). Covered by useSyncActions error-path test.',
        },
        {
            risk: 'ViewMode persists as "drift" to localStorage — user returns with no drift tokens and sees permanent empty state',
            severity: 'low',
            mitigation: 'Hook auto-reverts viewMode from "drift" to "grid" when driftedTokens.length === 0 on mount.',
        },
        {
            risk: 'Empty state flashes before tokens load (race with fetchTokens)',
            severity: 'medium',
            mitigation: 'Gate ConnectFigmaEmptyState render on isLoading === false AND tokens.length === 0. Matches existing pattern at TokenManager.tsx:659.',
        },
        {
            risk: 'Web-build parity — server/index.ts does not mirror mcp:call-tool identically',
            severity: 'high',
            mitigation: 'flint_sync_* tools already route through mcp:call-tool on both Electron and web surfaces (StatusBar uses them today). Parity is inherited. Integration validator verifies.',
        },
        {
            risk: 'Scope creep — "while we are here, also add staleness banner / emit dropdown / impact accordion"',
            severity: 'medium',
            mitigation: 'Explicit nonGoals enumerated below. Phase 2 ships ONLY the 3 items the UX review deferred from Phase 1: sync actions, drift closure, connect empty state.',
        },
    ],
    parallelismGroups: {
        'A': ['flint-design-engineer', 'flint-state-architect', 'flint-test-writer'],
        'B': ['flint-design-engineer'],
        'C': ['flint-test-writer', 'flint-integration-validator'],
    },
    nonGoals: [
        'No emit / export dropdown in TokenManager toolbar (UX A3 — Phase 3)',
        'No TokenImpactAccordion embed inside TokenDetailPanel (UX A5 — Phase 4)',
        'No read-only identity banner replacing the TokenGrid.tsx:478 tooltip (UX A6 — Phase 4)',
        'No collapse affordance or count pill for ApprovalStagingArea (UX A7 — Phase 4)',
        'No aria-live announcements on sync event completion (UX A9 — Phase 4)',
        'No sync staleness banner ("Synced 12m ago · 3 local edits pending · 2 conflicts") (UX A4 — deferred)',
        'No OAuth flow modification — electron/figmaOAuth.ts untouched',
        'No new MCP tools — strictly UI wiring to existing tools',
        'No modification to flint_sync_pull / flint_sync_push / flint_resolve_all signatures',
        'No new IPC channels — all sync calls route through existing mcp:call-tool',
        'No new Zustand stores — useSyncActions is a hook, not a slice',
        'No FirstSyncPrompt relocation — Phase 2 elevates the empty state instead',
        'No health-bar density revamp or information hierarchy reordering (UX 5-8) — Phase 4 polish',
        'No per-conflict resolution view — bulk resolution only in Phase 2',
        'No ViewMode persistence changes — Phase 1 behavior preserved, only adds auto-revert when drift is empty',
    ],
}
