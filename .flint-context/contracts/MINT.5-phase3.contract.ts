/**
 * MINT.5 Phase 3 — Sync Polish + Type Safety
 * Executable Contract
 *
 * Phase: MINT.5 (Phase 3 of 4)
 * Status: APPROVED
 * Date: 2026-04-18
 * Owner: flint-architect
 * Builds on: MINT.5-phase2.contract.ts — re-uses SyncOp, SyncActionError, ResolveStrategy.
 * Coexists with: RUNTIME.1.contract.ts — both append-only edits to shared/ipc-validators.ts.
 *
 * Phase 2 agents import these types directly. No implementation lives here.
 * This file must compile cleanly with `npx tsc --noEmit`.
 *
 * Scope:
 *   3.1  Emit/handoff dropdown (Scout) on TokenHealthBar — flint_emit_tokens dryRun + write.
 *   3.2  Sync staleness banner (Envoy) above TokenHealthBar — staleSince > threshold.
 *   3.3  Structured MCPCallResult.classification — discriminated union, computed in mcpClient.
 *   3.4  Per-tool Zod schemas for the 5 user-invokable sync tools — preload validation gate.
 *
 * Non-goals (Phase 4): policy-based threshold, emit preview drawer, Code Connect emit,
 * keyword-fallback removal, per-result classification enforcement, accordion/aria-live,
 * density revamp, dismissal localStorage persistence.
 */

import type { LegacyFlintContract } from '../../shared/contract-schema.js'
import type { SyncActionError } from './MINT.5-phase2.contract.js'

// ─── Re-exports for Phase 2-shared types ──────────────────────────────────────

export type { SyncActionError } from './MINT.5-phase2.contract.js'

// ─── 3.1 — Emit Dropdown (Scout) ──────────────────────────────────────────────

/**
 * Platforms supported by `flint_emit_tokens`. Mirrors the tool's enum exactly.
 * Kept as a string-literal union here so renderer code is type-safe without
 * importing from flint-mcp/ (boundary preservation).
 */
export type EmitPlatform = 'tailwind' | 'css' | 'react-native' | 'swift' | 'kotlin'

/**
 * Emit mode:
 *   - 'preview' — calls `flint_emit_tokens` with `dryRun: true`. Read-shaped.
 *   - 'write'   — calls with `dryRun: false`. Destructive; requires confirmation.
 */
export type EmitMode = 'preview' | 'write'

/**
 * Current in-flight emit operation. `null` means idle. Distinguished from
 * `SyncOp` so the sync cluster spinner and the emit dropdown spinner can
 * animate independently.
 */
export type EmitOp = 'preview' | 'write' | null

/**
 * Presentational dropdown of emit platforms. Renders a trigger button + menu
 * portal. The component does not own state — the caller provides the in-flight
 * `emitOp` and an `onEmit` callback.
 */
export interface EmitDropdownProps {
    /** When true, the entire trigger is disabled (e.g. no tokens). */
    disabled?: boolean
    /** Current in-flight emit op, or null. */
    emitOp: EmitOp
    /** Fired when user picks a platform + mode from the menu. */
    onEmit: (platforms: EmitPlatform[], mode: EmitMode) => void
}

/**
 * Confirm dialog for the destructive emit (`mode='write'`). Mirrors
 * `ConfirmPushDialog` from Phase 2: FocusTrap, role=dialog, aria-modal,
 * Escape cancels, returns focus to source button on close.
 */
export interface ConfirmEmitDialogProps {
    isOpen: boolean
    /** Platforms to be written. Plural so the dialog can list them. */
    platforms: EmitPlatform[]
    /** Resolved write target. Shown to the user before they confirm. */
    outputDir: string
    onConfirm: () => void
    onCancel: () => void
}

/**
 * Hook return shape for `useEmitTokens`. Wraps `mcp.callTool('flint_emit_tokens')`
 * for both preview and write. Serializes on `emitOp`.
 */
export interface UseEmitTokensResult {
    emitOp: EmitOp
    lastError: SyncActionError | null
    /** True only when `window.flintAPI.mcp.callTool` is available. */
    ready: boolean
    /**
     * Run an emit. `mode='preview'` always proceeds; `mode='write'` proceeds
     * only after `confirmWrite` (provided in options) returns true.
     */
    emit: (platforms: EmitPlatform[], mode: EmitMode) => Promise<void>
}

export interface UseEmitTokensOptions {
    /** Confirmation callback for destructive write mode. */
    confirmWrite?: (platforms: EmitPlatform[]) => Promise<boolean>
    /** Optional callback after a successful emit. */
    onAfterEmit?: () => void
}

export type UseEmitTokensHook = (
    options?: UseEmitTokensOptions,
) => UseEmitTokensResult

// ─── 3.2 — Sync Staleness Banner (Envoy) ──────────────────────────────────────

/**
 * Default staleness threshold — 24 hours since last sync.
 * Lives in `shared/syncStaleness.ts` so Phase 4 has a single replacement target
 * when policy-based configurability is wired.
 */
export const SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT = 24

/**
 * Pure helper signature: returns true when the duration since `staleSince`
 * exceeds `thresholdHours`. Returns false when `staleSince` is null.
 *
 * Implementation lives in `shared/syncStaleness.ts`. Renderer + main both
 * consume this — no I/O, no store access.
 */
export interface IsSyncStale {
    (staleSince: string | null, thresholdHours: number, nowMs: number): boolean
}

/**
 * Pure helper: format a duration in milliseconds as a human-readable string.
 * Examples: "26 hours", "2 days", "45 minutes".
 *
 * Implementation lives in `shared/syncStaleness.ts`.
 */
export interface FormatStaleness {
    (durationMs: number): string
}

/**
 * Presentational staleness banner. Renders nothing when not stale or dismissed.
 * Caller supplies pre-computed `isStale` + `isDismissed` booleans.
 */
export interface SyncStalenessBannerProps {
    /** Hours elapsed since last sync. Used for the visible duration. */
    hoursSinceSync: number
    /** Pre-computed staleness flag from `useSyncStaleness`. */
    isStale: boolean
    /** Pre-computed dismissal flag from the staleness store. */
    isDismissed: boolean
    /** Fired when user clicks the "Pull now" CTA. */
    onPull: () => void
    /** Fired when user clicks the dismiss "X". */
    onDismiss: () => void
}

/**
 * Return shape of `useSyncStaleness`. Polls `flint_sync_check` every 60s while
 * mounted. Auto-clears the dismissal when `staleSince` advances past the
 * dismissal timestamp (i.e. a fresh sync completed since the user dismissed).
 */
export interface UseSyncStalenessResult {
    /** True when the duration since last sync exceeds the threshold. */
    isStale: boolean
    /** Hours elapsed since last sync, or null if no sync recorded. */
    hoursSinceSync: number | null
    /** ISO timestamp of last sync, mirrored from SyncCheckReport.staleSince. */
    staleSince: string | null
    /** Marks the banner dismissed for the current session. */
    dismiss: () => void
}

export interface UseSyncStalenessOptions {
    /** Project root forwarded to `flint_sync_check`. */
    projectRoot: string
    /** Override the default 24h threshold (Phase 3 callers always pass the default). */
    thresholdHours?: number
    /** Override the poll cadence (default 60_000ms). Tests use a faster value. */
    pollIntervalMs?: number
    /** Skip polling when figma is disconnected. */
    enabled?: boolean
}

/**
 * Zustand slice — per-session dismissal state. No localStorage persistence.
 * `dismissedAt` reset to null on `clearDismissal()` (called by the hook
 * when a fresh sync is detected).
 */
export interface SyncStalenessStoreState {
    /** Unix ms of the last dismiss click, or null if never dismissed this session. */
    dismissedAt: number | null
    /** Sets `dismissedAt = Date.now()`. */
    dismiss: () => void
    /** Resets `dismissedAt = null`. */
    clearDismissal: () => void
}

// ─── 3.3 — Structured MCPCallResult.classification ────────────────────────────

/**
 * Discriminated union for MCP call result classification. Lifted out of the
 * useSyncActions hook so every renderer consumer benefits.
 *
 *   'auth-expired'      — Figma OAuth token expired or revoked.
 *   'rate-limited'      — Upstream API rate limit hit (Figma 429).
 *   'network-error'     — Network unreachable or DNS failure.
 *   'tool-error'        — Tool ran but returned isError=true with a domain-specific message.
 *   'validation-error'  — Renderer-side preload Zod gate rejected the call.
 *   'unknown'           — No classifier matched, or the call succeeded.
 */
export type MCPCallClassification =
    | 'auth-expired'
    | 'rate-limited'
    | 'network-error'
    | 'tool-error'
    | 'validation-error'
    | 'unknown'

/**
 * The Phase 3 extension to MCPCallResult. The optional `classification` field
 * is computed in `electron/mcpClient.ts` (and the web parity at
 * `server/mcpClient.ts`) BEFORE the result reaches the renderer.
 *
 * Marked optional in the type so legacy code paths that haven't been updated
 * can still satisfy the shape during the rollout. Phase 4 may tighten to required.
 */
export interface MCPCallResultV3 {
    content: Array<{ type: string; text?: string }>
    isError?: boolean
    classification?: MCPCallClassification
}

/**
 * Pure classifier signature. Implementation lives in `shared/mcp-classification.ts`.
 *
 *   rawText — the first text block from MCPCallResult.content, lowercased.
 *   isError — whether the result has isError=true.
 *   status  — optional structured status field if the tool surfaces one.
 *
 * Returns 'unknown' for non-error results. Returns the most specific match
 * for error results (auth-expired wins over generic tool-error).
 */
export interface ClassifyMCPError {
    (args: { rawText: string; isError: boolean; status?: string }): MCPCallClassification
}

// ─── 3.4 — Per-Tool Zod Schemas (interfaces only) ─────────────────────────────

/**
 * Argument shapes for the 5 user-invokable sync tools. The Zod schemas live
 * in `shared/ipc-validators.ts` and are derived directly from these
 * interfaces — every required field, every optional field, every union member
 * matches the case blocks in `flint-mcp/src/server.ts:3224-3298` verbatim.
 */
export interface FlintSyncPullArgs {
    projectRoot: string
    /** When provided, scopes the pull to a single token. */
    scope?: 'token'
    /** Required when scope='token'. */
    tokenPath?: string
}

export interface FlintSyncPushArgs {
    projectRoot: string
}

export interface FlintResolveAllArgs {
    projectRoot: string
    /** Resolution strategy. Maps to ResolveStrategy at the renderer boundary. */
    resolution: 'local' | 'remote'
}

export interface FlintResolveConflictArgs {
    conflictId: string
    resolution: 'local' | 'remote' | 'merged'
    /** Required when resolution='merged'. */
    mergedValue?: string
}

export interface FlintSyncCheckArgs {
    projectRoot: string
}

/**
 * Names of tools that have per-tool Zod argument schemas in
 * `shared/ipc-validators.ts`. The `MCP_TOOL_ARG_SCHEMAS` lookup map is keyed
 * by these strings. Phase 3 covers exactly the user-invokable sync tools.
 *
 * Adding a new tool to this list requires:
 *   1. Add the schema export to shared/ipc-validators.ts
 *   2. Register it in MCP_TOOL_ARG_SCHEMAS
 *   3. Append the tool name here.
 */
export const MCP_TOOL_ARG_SCHEMA_NAMES = [
    'flint_sync_pull',
    'flint_sync_push',
    'flint_resolve_all',
    'flint_resolve_conflict',
    'flint_sync_check',
] as const

export type MCPToolWithArgSchema = (typeof MCP_TOOL_ARG_SCHEMA_NAMES)[number]

// ─── 3.1 / 3.3 — TokenHealthBar Phase 3 Extension ─────────────────────────────

/**
 * Phase 3 extension to TokenHealthBarProps. Phase 2 added the sync cluster
 * props. Phase 3 adds the emit cluster.
 *
 * As with Phase 2, implementation may instead consume `useEmitTokens` directly
 * inside TokenHealthBar; architect preference is to keep the component
 * presentational by passing props from TokenManager.
 */
export interface TokenHealthBarPhase3Extension {
    /** Current in-flight emit op (drives spinner). */
    emitOp?: EmitOp
    /** Fired when user picks a platform from the emit dropdown. */
    onEmit?: (platforms: EmitPlatform[], mode: EmitMode) => void
}

// ─── Contract Metadata ────────────────────────────────────────────────────────

export const CONTRACT: LegacyFlintContract = {
    meta: {
        name: 'MINT.5-phase3-SyncPolishTypeSafety',
        phase: 'MINT.5.3',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-18',
        // Primary audience is designer (Glass renderer surface). Secondary
        // engine-side work in mcpClient.ts and shared/ipc-validators.ts is
        // pure plumbing — covered by the Feature Budget Framework's "engine"
        // bucket in the dual-audience rule but classified as designer here
        // because the user-visible value is in Glass.
        audience: 'designer',
    },
    impact: [
        // ── 3.1 — Emit dropdown ─────────────────────────────────────────────
        { file: 'src/components/ui/mint/EmitDropdown.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Presentational emit menu — 5 platforms, ARIA menu role, keyboard navigation, outside-click + Escape close.' },
        { file: 'src/components/ui/mint/ConfirmEmitDialog.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Confirm dialog for write-mode emit. FocusTrap + role=dialog + aria-modal + Escape cancels.' },
        { file: 'src/hooks/useEmitTokens.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'Hook owning emitOp + lastError. Wraps mcp.callTool(flint_emit_tokens). Serializes; gates write mode on confirm.' },
        { file: 'src/components/ui/mint/__tests__/EmitDropdown.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Open/close, outside-click, Escape, arrow-key navigation, click forwards (platform, mode).' },
        { file: 'src/components/ui/mint/__tests__/ConfirmEmitDialog.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'FocusTrap; Escape cancels; Confirm fires once; resolved outputDir is shown.' },
        { file: 'src/hooks/__tests__/useEmitTokens.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'preview-mode dryRun=true; write-mode requires confirm; classification propagates to lastError.' },
        { file: 'shared/mcp-allowed-tools.ts', changeType: 'MODIFY', owner: 'flint-mcp-specialist', summary: 'Append flint_emit_tokens to RENDERER_ALLOWED_MCP_TOOLS. Update JSDoc.' },
        { file: 'electron/__tests__/mcp-policy.test.ts', changeType: 'MODIFY', owner: 'flint-test-writer', summary: 'Update SEC.3 frozen-list assertion to expect the new tool.' },

        // ── 3.2 — Sync staleness banner ─────────────────────────────────────
        { file: 'shared/syncStaleness.ts', changeType: 'CREATE', owner: 'flint-electron-ipc', summary: 'Pure helpers: SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT, isSyncStale, formatStaleness. No I/O.' },
        { file: 'src/components/ui/mint/SyncStalenessBanner.tsx', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Amber banner with "Pull now" CTA + dismiss X. Renderless when not stale or dismissed. role=status, aria-live=polite.' },
        { file: 'src/store/syncStalenessStore.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'Zustand slice — dismissedAt, dismiss(), clearDismissal(). Per-session lifetime, no localStorage.' },
        { file: 'src/hooks/useSyncStaleness.ts', changeType: 'CREATE', owner: 'flint-state-architect', summary: 'Polls flint_sync_check every 60s while mounted. Returns isStale, hoursSinceSync, dismiss. Auto-clears dismissal on fresh sync.' },
        { file: 'src/components/ui/mint/__tests__/SyncStalenessBanner.test.tsx', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Renders when isStale && !isDismissed; null otherwise; CTA + dismiss callbacks fire.' },
        { file: 'src/store/__tests__/syncStalenessStore.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'dismiss sets timestamp; clearDismissal resets; selectors return correct values.' },
        { file: 'src/hooks/__tests__/useSyncStaleness.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Auto-dismissal-clear; threshold boundary; polling cleanup on unmount; disabled when figmaConnected=false.' },
        { file: 'shared/__tests__/syncStaleness.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'isSyncStale boundary cases; formatStaleness formatting (minutes/hours/days).' },

        // ── 3.3 — MCPCallResult.classification ──────────────────────────────
        { file: 'src/types/flint-api.d.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Extend MCPCallResult with optional classification field. Add MCPCallClassification union export.' },
        { file: 'shared/mcp-classification.ts', changeType: 'CREATE', owner: 'flint-electron-ipc', summary: 'Pure classifier — classifyMCPError + lookup tables. Renderer + main both consume.' },
        { file: 'electron/mcpClient.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'After receiving MCP result, attach classification via classifyMCPError. Default unknown for success.' },
        { file: 'server/mcpClient.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Web parity — same classification attach as electron/mcpClient.ts.' },
        { file: 'src/hooks/useSyncActions.ts', changeType: 'MODIFY', owner: 'flint-state-architect', summary: 'Drop isAuthExpiredError keyword helper. Use result.classification for persistent flag. Keep keyword fallback as backstop.' },
        { file: 'shared/__tests__/mcp-classification.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: '6 classification × known-trigger inputs; unknown fallback; precedence (auth-expired wins over tool-error).' },
        { file: 'shared/__tests__/mcp-classification.bench.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'vitest bench harness for classifyMCPError — 1000-call loop verifying classification-attach-overhead invariant (< 5ms per call at p95).' },
        { file: 'electron/__tests__/mcpClient.classification.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Result with auth-expired text gets classification auth-expired. Successful result gets unknown.' },
        { file: 'src/hooks/__tests__/useSyncActions.test.ts', changeType: 'MODIFY', owner: 'flint-test-writer', summary: 'Refactor auth-expired test to assert it triggers from classification field. Add test for unclassified error → persistent=false.' },

        // ── 3.4 — Per-tool Zod schemas ──────────────────────────────────────
        { file: 'shared/ipc-validators.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'APPEND-ONLY: 5 per-tool schemas (flintSyncPullArgsSchema etc.) and MCP_TOOL_ARG_SCHEMAS lookup. Coordinate with RUNTIME.1 sequencing.' },
        { file: 'electron/preload.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Pre-validate mcp.callTool args via MCP_TOOL_ARG_SCHEMAS lookup. Bad payload → validation-error envelope, no IPC fired.' },
        { file: 'server/index.ts', changeType: 'MODIFY', owner: 'flint-electron-ipc', summary: 'Web parity — same per-tool validation gate before forwarding to mcpClient.callTool.' },
        { file: 'shared/__tests__/ipc-validators.mcp-tool-schemas.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Each schema accepts good args; rejects missing projectRoot, wrong type, unknown keys (strict mode).' },
        { file: 'electron/__tests__/preload.mcp-validation.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Bad payload short-circuits without ipcRenderer.invoke. Good payload passes through. Unknown tool falls through.' },
        { file: 'server/__tests__/mcpClient.validation.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Web-parity mirror of preload validation gate test.' },

        // ── 3.1 + 3.2 — TokenHealthBar / TokenManager integration ───────────
        { file: 'src/components/ui/TokenHealthBar.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Render <EmitDropdown> adjacent to <SyncActionCluster> when figmaConnected || tokenCount > 0. Thread onEmit + emitOp.' },
        { file: 'src/components/ui/TokenManager.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Mount <SyncStalenessBanner> above TokenHealthBar. Wire useEmitTokens + useSyncStaleness. Forward callbacks down.' },
    ],
    ipc: [
        // No NEW channels in Phase 3. The existing mcp:call-tool channel gains
        // per-tool validation at the preload bridge and a classification field
        // on the response. Listed here as the consumer entry.
        {
            channel: 'mcp:call-tool',
            direction: 'renderer\u2192main',
            payloadType: '[name: string, args: Record<string, unknown>]',
            returnType: 'MCPCallResultV3',
            handler: 'electron/main.ts (existing) + server/index.ts (existing) — preload + server bridge tighten validation',
            validator: 'mcpCallToolSchema',
        },
    ],
    stores: [
        {
            store: 'syncStalenessStore',
            newState: {
                dismissedAt: 'number | null',
            },
            newActions: {
                dismiss: '() => void',
                clearDismissal: '() => void',
            },
            newSelectors: {
                useSyncStalenessDismissedAt: '() => number | null',
            },
        },
    ],
    components: [
        {
            name: 'EmitDropdown',
            file: 'src/components/ui/mint/EmitDropdown.tsx',
            propsType: 'EmitDropdownProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'ConfirmEmitDialog',
            file: 'src/components/ui/mint/ConfirmEmitDialog.tsx',
            propsType: 'ConfirmEmitDialogProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'SyncStalenessBanner',
            file: 'src/components/ui/mint/SyncStalenessBanner.tsx',
            propsType: 'SyncStalenessBannerProps',
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
            name: 'TokenManager',
            file: 'src/components/ui/TokenManager.tsx',
            propsType: 'TokenManagerProps',
            consumesStores: ['tokenStore', 'syncStalenessStore', 'notificationStore'],
            emitsIPC: ['mcp:call-tool'],
        },
    ],
    commandments: [1, 4, 5, 12, 14, 16],
    invariants: [
        {
            name: 'staleness-banner-render-latency',
            measurable: 'time from staleSince crossing the threshold to banner appearing',
            threshold: '< 16ms (one render frame at 60Hz)',
            measuredBy: 'vitest performance.now() markers around RTL render() triggered by store mutation',
        },
        {
            name: 'classification-attach-overhead',
            measurable: 'time spent in classifyMCPError per MCP call',
            threshold: '< 5ms per call at p95',
            measuredBy: 'vitest bench in shared/__tests__/mcp-classification.bench.ts (1000-call loop)',
        },
        {
            name: 'per-tool-schema-rejection-latency',
            measurable: 'time for MCP_TOOL_ARG_SCHEMAS[name].safeParse(badArgs) to return',
            threshold: '< 1ms per rejection at p95',
            measuredBy: 'vitest bench in shared/__tests__/ipc-validators.mcp-tool-schemas.test.ts',
        },
        {
            name: 'staleness-poll-cleanup',
            measurable: 'active timers after useSyncStaleness unmount',
            threshold: '= 0 timers',
            measuredBy: 'vitest vi.useFakeTimers() + assert vi.getTimerCount() === 0 after unmount',
        },
        {
            name: 'validation-gate-zero-network',
            measurable: 'ipcRenderer.invoke calls when preload-side validation fails',
            threshold: '= 0 calls',
            measuredBy: 'preload test asserts mock not invoked on bad payload',
        },
        {
            name: 'emit-renderer-allowlist-frozen',
            measurable: 'mutability of RENDERER_ALLOWED_MCP_TOOLS after Phase 3 add',
            threshold: '= 0 mutations possible (Object.isFrozen returns true)',
            measuredBy: 'electron/__tests__/mcp-policy.test.ts updated assertion',
        },
        {
            name: 'staleness-banner-zero-when-fresh',
            measurable: 'banner-render assertions while staleSince is within threshold',
            threshold: '= 0 banner mounts across 100 simulated time advances',
            measuredBy: 'hook test loops through threshold-1 down to 0 hours and asserts no mount',
        },
    ],
    testBoundaries: [
        // ── 3.1 — Emit Dropdown ─────────────────────────────────────────────
        {
            target: 'EmitDropdown open',
            kind: 'component',
            behavior: 'Opens menu on trigger click',
            assertion: 'After click, getByRole("menu") is in the document',
            edgeCases: ['Disabled trigger does not open', 'Spacebar also opens'],
            given: 'EmitDropdown rendered with disabled=false',
            when: 'user clicks the trigger button',
            then: 'renders the menu with 5 platform options',
        },
        {
            target: 'EmitDropdown close (outside-click)',
            kind: 'component',
            behavior: 'Closes menu on outside click',
            assertion: 'After click outside, queryByRole("menu") === null',
            edgeCases: ['Click inside a menu item closes after firing onEmit'],
            given: 'EmitDropdown menu open',
            when: 'user clicks outside the dropdown',
            then: 'renders no menu element after the click',
        },
        {
            target: 'EmitDropdown close (Escape)',
            kind: 'component',
            behavior: 'Closes menu on Escape key',
            assertion: 'After Escape press, queryByRole("menu") === null and focus returns to trigger',
            edgeCases: [],
            given: 'EmitDropdown menu open',
            when: 'user presses Escape',
            then: 'renders no menu element and returns focus to the trigger',
        },
        {
            target: 'EmitDropdown keyboard navigation',
            kind: 'component',
            behavior: 'Arrow keys move focus between items',
            assertion: 'After ArrowDown, document.activeElement is the next menuitem',
            edgeCases: ['ArrowUp wraps to last item from first', 'Home/End jump to bounds'],
            given: 'EmitDropdown menu open with focus on first menuitem',
            when: 'user presses ArrowDown',
            then: 'sets focus to the second menuitem',
        },
        {
            target: 'EmitDropdown onEmit (preview)',
            kind: 'component',
            behavior: 'Forwards platform + preview mode on click',
            assertion: 'onEmit was called with (["css"], "preview") exactly once',
            edgeCases: ['Each of 5 platforms fires onEmit with the right value'],
            given: 'EmitDropdown menu open and onEmit prop spied',
            when: 'user clicks the "CSS variables (preview)" menuitem',
            then: 'calls onEmit with ["css"] and "preview"',
        },
        {
            target: 'EmitDropdown onEmit (write)',
            kind: 'component',
            behavior: 'Forwards platform + write mode on click',
            assertion: 'onEmit was called with (["tailwind"], "write") exactly once',
            edgeCases: [],
            given: 'EmitDropdown menu open and onEmit prop spied',
            when: 'user clicks the "Tailwind (write to disk)" menuitem',
            then: 'calls onEmit with ["tailwind"] and "write"',
        },
        {
            target: 'EmitDropdown spinner on emitOp',
            kind: 'component',
            behavior: 'Renders spinner on trigger when emitOp is non-null',
            assertion: 'getByTestId("emit-trigger") contains Loader2 svg',
            edgeCases: ['Trigger is disabled while emitOp != null'],
            given: 'EmitDropdown rendered with emitOp="write"',
            when: 'the component mounts',
            then: 'renders a spinner inside the trigger button',
        },
        {
            target: 'ConfirmEmitDialog content',
            kind: 'component',
            behavior: 'Renders outputDir + platforms in dialog body',
            assertion: 'getByText(/Tailwind/i) and getByText(/.flint\\/platform-tokens/i) are in the document',
            edgeCases: ['Multi-platform list joins with comma'],
            given: 'isOpen=true, platforms=["tailwind"], outputDir="/proj/.flint/platform-tokens"',
            when: 'ConfirmEmitDialog renders',
            then: 'renders the platform name and the resolved outputDir in the body',
        },
        {
            target: 'ConfirmEmitDialog focus trap',
            kind: 'component',
            behavior: 'Keeps focus within dialog while open',
            assertion: 'After Tab cycling, document.activeElement remains within the dialog',
            edgeCases: [],
            given: 'dialog mounted with isOpen=true',
            when: 'user Tab-cycles through focusable elements',
            then: 'blocks focus from escaping the dialog',
        },
        {
            target: 'ConfirmEmitDialog cancel (Escape)',
            kind: 'component',
            behavior: 'Fires onCancel on Escape',
            assertion: 'onCancel called 1 time; onConfirm not called',
            edgeCases: ['Cancel button click also fires onCancel'],
            given: 'dialog mounted',
            when: 'user presses Escape',
            then: 'calls onCancel exactly once',
        },
        {
            target: 'useEmitTokens.preview',
            kind: 'hook',
            behavior: 'Invokes flint_emit_tokens with dryRun=true',
            assertion: 'mcp.callTool was called with ("flint_emit_tokens", { platforms: ["css"], dryRun: true })',
            edgeCases: ['No confirm prompted for preview mode'],
            given: 'ready=true and mcp.callTool mocked to resolve successfully',
            when: 'emit(["css"], "preview") is invoked',
            then: 'calls mcp.callTool with dryRun=true and emits a success notification',
        },
        {
            target: 'useEmitTokens.write (confirmed)',
            kind: 'hook',
            behavior: 'Invokes flint_emit_tokens with dryRun=false after confirmWrite returns true',
            assertion: 'mcp.callTool was called with ("flint_emit_tokens", { platforms: ["tailwind"], dryRun: false })',
            edgeCases: [],
            given: 'confirmWrite returns true',
            when: 'emit(["tailwind"], "write") is invoked',
            then: 'calls mcp.callTool with dryRun=false exactly once',
        },
        {
            target: 'useEmitTokens.write (cancelled)',
            kind: 'hook',
            behavior: 'Does not invoke mcp tool when confirmWrite returns false',
            assertion: 'mcp.callTool was NOT called after emit() with confirm=false',
            edgeCases: [],
            given: 'confirmWrite returns false',
            when: 'emit(["tailwind"], "write") is invoked',
            then: 'blocks the MCP tool call and resolves without side effect',
        },
        {
            target: 'useEmitTokens.classification',
            kind: 'hook',
            behavior: 'Surfaces validation-error classification on lastError',
            assertion: 'lastError.message includes the sanitized validation error',
            edgeCases: ['classification field is read from the result, not text-matched'],
            given: 'mcp.callTool resolves with isError=true and classification="validation-error"',
            when: 'emit(["css"], "preview") is invoked',
            then: 'sets lastError and emits an error notification',
        },

        // ── 3.2 — Sync Staleness Banner ─────────────────────────────────────
        {
            target: 'SyncStalenessBanner stale + visible',
            kind: 'component',
            behavior: 'Renders amber banner when stale and not dismissed',
            assertion: 'getByRole("status") is in the document with the staleness duration text',
            edgeCases: ['Visible "Pull now" CTA + dismiss "X" button'],
            given: 'isStale=true, isDismissed=false, hoursSinceSync=26',
            when: 'SyncStalenessBanner renders',
            then: 'renders the banner with "26 hours" and a Pull-now CTA',
        },
        {
            target: 'SyncStalenessBanner dismissed',
            kind: 'component',
            behavior: 'Renders nothing when dismissed',
            assertion: 'container.firstChild === null',
            edgeCases: [],
            given: 'isStale=true, isDismissed=true',
            when: 'SyncStalenessBanner renders',
            then: 'returns null from the render',
        },
        {
            target: 'SyncStalenessBanner not stale',
            kind: 'component',
            behavior: 'Renders nothing when not stale',
            assertion: 'container.firstChild === null',
            edgeCases: ['hoursSinceSync ignored when isStale=false'],
            given: 'isStale=false, isDismissed=false',
            when: 'SyncStalenessBanner renders',
            then: 'returns null from the render',
        },
        {
            target: 'SyncStalenessBanner onPull',
            kind: 'component',
            behavior: 'Fires onPull when CTA clicked',
            assertion: 'onPull called exactly once',
            edgeCases: [],
            given: 'banner rendered with isStale=true',
            when: 'user clicks the "Pull now" CTA',
            then: 'calls onPull exactly once',
        },
        {
            target: 'SyncStalenessBanner onDismiss',
            kind: 'component',
            behavior: 'Fires onDismiss when X clicked',
            assertion: 'onDismiss called exactly once',
            edgeCases: ['Keyboard Enter on dismiss button also fires onDismiss'],
            given: 'banner rendered with isStale=true',
            when: 'user clicks the dismiss X button',
            then: 'calls onDismiss exactly once',
        },
        {
            target: 'syncStalenessStore.dismiss',
            kind: 'store-action',
            behavior: 'Sets dismissedAt to current timestamp',
            assertion: 'After dismiss(), state.dismissedAt is a number close to Date.now()',
            edgeCases: ['Calling dismiss twice updates the timestamp to the latest call'],
            given: 'store initialized with dismissedAt=null',
            when: 'dismiss() is invoked',
            then: 'sets dismissedAt to the current Unix ms timestamp',
        },
        {
            target: 'syncStalenessStore.clearDismissal',
            kind: 'store-action',
            behavior: 'Resets dismissedAt to null',
            assertion: 'After clearDismissal(), state.dismissedAt === null',
            edgeCases: [],
            given: 'store with dismissedAt set to a non-null value',
            when: 'clearDismissal() is invoked',
            then: 'sets dismissedAt to null',
        },
        {
            target: 'useSyncStaleness threshold boundary',
            kind: 'hook',
            behavior: 'isStale flips at exactly threshold hours',
            assertion: 'isStale=false at threshold-1 hours; isStale=true at threshold+1 hours',
            edgeCases: ['Threshold is inclusive: exactly threshold hours = stale'],
            given: 'staleSince set to a timestamp with hoursSinceSync=24, threshold=24',
            when: 'the hook computes isStale',
            then: 'returns isStale=true',
        },
        {
            target: 'useSyncStaleness auto-clear dismissal',
            kind: 'hook',
            behavior: 'Calls clearDismissal when staleSince advances past dismissedAt',
            assertion: 'clearDismissal was called exactly once after staleSince update',
            edgeCases: [],
            given: 'dismissedAt=1000 and staleSince poll returns a fresher timestamp than 1000',
            when: 'the hook re-polls and detects the fresh sync',
            then: 'calls clearDismissal exactly once',
        },
        {
            target: 'useSyncStaleness polling cleanup',
            kind: 'hook',
            behavior: 'Clears the poll interval on unmount',
            assertion: 'After unmount, vi.getTimerCount() === 0',
            edgeCases: [],
            given: 'hook mounted with polling enabled',
            when: 'the hook is unmounted',
            then: 'sets active timer count to 0 (vi.getTimerCount() === 0)',
        },
        {
            target: 'useSyncStaleness disabled',
            kind: 'hook',
            behavior: 'Does not poll when enabled=false',
            assertion: 'mcp.callTool was NOT called when enabled=false',
            edgeCases: ['Switching enabled false→true starts polling'],
            given: 'hook mounted with enabled=false',
            when: 'the hook lifecycle runs',
            then: 'blocks all polling and isStale stays false',
        },
        {
            target: 'isSyncStale boundary',
            kind: 'service',
            behavior: 'Returns true at exactly threshold hours',
            assertion: 'isSyncStale(staleSince, 24, nowMs) === true when staleSince is exactly 24h before nowMs',
            edgeCases: ['Returns false when staleSince is null', 'Returns false when staleSince is in the future'],
            given: 'staleSince represents 24 hours before nowMs and threshold=24',
            when: 'isSyncStale is invoked',
            then: 'returns true',
        },
        {
            target: 'formatStaleness format',
            kind: 'service',
            behavior: 'Formats a duration as a human-readable string',
            assertion: 'formatStaleness(26 * 3600_000) === "26 hours"',
            edgeCases: ['Sub-hour returns "N minutes"', 'Multi-day returns "N days"'],
            given: 'durationMs = 26 * 3600_000',
            when: 'formatStaleness is invoked',
            then: 'returns "26 hours"',
        },

        // ── 3.3 — MCPCallResult.classification ─────────────────────────────
        {
            target: 'classifyMCPError auth-expired',
            kind: 'service',
            behavior: 'Returns auth-expired for known auth-failure text',
            assertion: 'classifyMCPError({ rawText: "auth-expired", isError: true }) === "auth-expired"',
            edgeCases: ['Variant text "token expired", "unauthorized", "connection revoked" all classify the same'],
            given: 'rawText contains "auth-expired" and isError=true',
            when: 'classifyMCPError is invoked',
            then: 'returns "auth-expired"',
        },
        {
            target: 'classifyMCPError rate-limited',
            kind: 'service',
            behavior: 'Returns rate-limited for known 429 text',
            assertion: 'classifyMCPError({ rawText: "rate limit exceeded", isError: true }) === "rate-limited"',
            edgeCases: ['Variant text "too many requests"'],
            given: 'rawText contains "rate limit" and isError=true',
            when: 'classifyMCPError is invoked',
            then: 'returns "rate-limited"',
        },
        {
            target: 'classifyMCPError network-error',
            kind: 'service',
            behavior: 'Returns network-error for known network-failure text',
            assertion: 'classifyMCPError({ rawText: "ECONNREFUSED", isError: true }) === "network-error"',
            edgeCases: ['DNS failure text', 'Timeout text'],
            given: 'rawText contains "ECONNREFUSED" and isError=true',
            when: 'classifyMCPError is invoked',
            then: 'returns "network-error"',
        },
        {
            target: 'classifyMCPError tool-error',
            kind: 'service',
            behavior: 'Returns tool-error for unmatched error text',
            assertion: 'classifyMCPError({ rawText: "validation failed: token_path required", isError: true }) === "tool-error"',
            edgeCases: ['Falls through when no specific classifier matches'],
            given: 'rawText is unmatched and isError=true',
            when: 'classifyMCPError is invoked',
            then: 'returns "tool-error"',
        },
        {
            target: 'classifyMCPError unknown (success)',
            kind: 'service',
            behavior: 'Returns unknown when isError=false',
            assertion: 'classifyMCPError({ rawText: "OK", isError: false }) === "unknown"',
            edgeCases: [],
            given: 'isError=false',
            when: 'classifyMCPError is invoked',
            then: 'returns "unknown"',
        },
        {
            target: 'mcpClient attaches classification',
            kind: 'service',
            behavior: 'Attaches classification field to every MCPCallResult',
            assertion: 'result.classification is defined and matches classifyMCPError output',
            edgeCases: ['Successful result gets classification=unknown', 'Error result gets specific classification'],
            given: 'electron/mcpClient.ts callTool returns a raw MCP result',
            when: 'the wrapper post-processes the result',
            then: 'sets result.classification to the classifier output',
        },
        {
            target: 'useSyncActions consumes classification',
            kind: 'hook',
            behavior: 'Sets persistent flag from result.classification, not text',
            assertion: 'lastError.persistent === true when result.classification === "auth-expired"',
            edgeCases: ['result.classification === "rate-limited" also sets persistent=true', 'unknown classification → persistent=false'],
            given: 'mcp.callTool resolves with classification="auth-expired"',
            when: 'pull() is invoked',
            then: 'sets lastError.persistent to true',
        },

        // ── 3.4 — Per-Tool Zod Schemas ──────────────────────────────────────
        {
            target: 'flintSyncPullArgsSchema accepts good args',
            kind: 'service',
            behavior: 'Accepts well-formed FlintSyncPullArgs',
            assertion: 'safeParse({ projectRoot: "/proj" }) returns success=true',
            edgeCases: ['Optional scope+tokenPath also accepted'],
            given: 'args = { projectRoot: "/proj" }',
            when: 'flintSyncPullArgsSchema.safeParse is invoked',
            then: 'returns a success result with parsed data',
        },
        {
            target: 'flintSyncPullArgsSchema rejects missing projectRoot',
            kind: 'service',
            behavior: 'Rejects payload without projectRoot',
            assertion: 'safeParse({}) returns success=false',
            edgeCases: ['Empty string also rejected'],
            given: 'args = {}',
            when: 'flintSyncPullArgsSchema.safeParse is invoked',
            then: 'returns a failure result citing missing projectRoot',
        },
        {
            target: 'flintResolveAllArgsSchema rejects bad resolution',
            kind: 'service',
            behavior: 'Rejects resolution outside the union',
            assertion: 'safeParse({ projectRoot: "/proj", resolution: "lol" }) returns success=false',
            edgeCases: ['Accepts "local" and "remote" only'],
            given: 'args.resolution is not "local" or "remote"',
            when: 'flintResolveAllArgsSchema.safeParse is invoked',
            then: 'returns a failure result citing the resolution union',
        },
        {
            target: 'preload validation gate (bad payload)',
            kind: 'ipc-handler',
            behavior: 'Short-circuits without ipcRenderer.invoke on bad payload',
            assertion: 'ipcRenderer.invoke was NOT called; result has classification="validation-error"',
            edgeCases: [],
            given: 'preload mcp.callTool invoked with tool="flint_sync_pull" and args={}',
            when: 'the validation gate runs',
            then: 'returns a validation-error envelope and blocks the IPC call',
        },
        {
            target: 'preload validation gate (good payload)',
            kind: 'ipc-handler',
            behavior: 'Forwards good payload through to ipcRenderer.invoke',
            assertion: 'ipcRenderer.invoke called with ("mcp:call-tool", "flint_sync_pull", { projectRoot: "/proj" })',
            edgeCases: ['Unknown tool name (no schema) falls through unchanged'],
            given: 'preload mcp.callTool invoked with valid args',
            when: 'the validation gate runs',
            then: 'calls ipcRenderer.invoke with the original payload',
        },
        {
            target: 'web validation gate (parity)',
            kind: 'ipc-handler',
            behavior: 'Mirrors preload validation gate behavior',
            assertion: 'mcpClient.callTool was NOT called; HTTP response carries validation-error envelope',
            edgeCases: [],
            given: 'web /api/mcp/call invoked with bad args',
            when: 'the server validation gate runs',
            then: 'returns a validation-error envelope and blocks the underlying mcpClient call',
        },
    ],
    risks: [
        {
            risk: 'shared/ipc-validators.ts merge collision with RUNTIME.1 axe schema additions',
            severity: 'medium',
            mitigation: 'Both phases append to distinct regions: RUNTIME.1 inside ipcSchemas + named exports; Phase 3 adds 5 new top-level schemas + MCP_TOOL_ARG_SCHEMAS lookup at the bottom. Sequence the two phases serially in git but textual changes do not overlap.',
        },
        {
            risk: 'flint_emit_tokens write path lets a renderer-issued call write outside projectRoot',
            severity: 'high',
            commandment: 14,
            mitigation: 'Tool already validates projectRoot via validateProjectRoot and confines outputDir under it. ConfirmEmitDialog displays the resolved outputDir before write. Renderer Zod schema constrains outputDir to a string; tool-side traversal containment is unchanged.',
        },
        {
            risk: 'MCPCallResult.classification optional → useSyncActions refactor regresses if older main process omits the field',
            severity: 'medium',
            mitigation: 'Field default computed in mcpClient.ts for every result. Hook treats undefined as "unknown" defensively. Keyword fallback survives one phase as a backstop; removed in Phase 4.',
        },
        {
            risk: 'Per-tool Zod schemas drift from the MCP server case blocks (renderer rejects what the engine accepts)',
            severity: 'high',
            mitigation: 'Schemas derived directly from flint-mcp/src/server.ts:3224-3298 case blocks. Phase 1.5 lint asserts no flint-mcp/ imports. Phase 3 tests round-trip a known-good payload through both Zod and the live tool to assert acceptance parity.',
        },
        {
            risk: 'Sync staleness polling adds 1 background timer per TokenManager mount; rapid open/close leaks timers',
            severity: 'medium',
            mitigation: 'useSyncStaleness uses useEffect cleanup to clear interval on unmount. Invariant staleness-poll-cleanup asserts vi.getTimerCount() === 0 after unmount.',
        },
        {
            risk: 'Banner shows "Last sync NaN hours ago" when staleSince is null',
            severity: 'low',
            mitigation: 'isStale is false when staleSince === null. SyncStalenessBanner returns null when !isStale. Tested explicitly.',
        },
        {
            risk: 'EmitDropdown overflows narrow Mint sidebar when sitting next to SyncActionCluster',
            severity: 'medium',
            mitigation: 'Render trigger as icon-only button with title="Emit tokens" when container width < 360px. Snapshot tests at 280/360/480px.',
        },
        {
            risk: 'Classification logic in renderer + main goes out of sync',
            severity: 'medium',
            mitigation: 'classifyMCPError lives in shared/mcp-classification.ts — single source consumed by both processes via TS module import (renderer) and Node module import (main).',
        },
        {
            risk: 'Adding flint_emit_tokens to renderer allowlist enables agent-driven token exfiltration via writable directory',
            severity: 'medium',
            commandment: 14,
            mitigation: 'Tool enforces outputDir traversal containment via validateProjectRoot. dryRun-default surface limits first-step exposure to text returns. Destructive write is gated by ConfirmEmitDialog (user-driven). AGV.1 per-agent ACL still applies on top of the renderer allowlist.',
        },
        {
            risk: 'Web-build parity drift — server/mcpClient.ts updated for classification but server/index.ts validation gate forgotten',
            severity: 'medium',
            mitigation: 'Impact map lists both files. Phase 3 integration validator diffs electron/preload.ts and server/index.ts MCP-related sections to confirm parity.',
        },
        {
            risk: 'useSyncStaleness polls flint_sync_check every 60s — many panel mounts hammer SQLite',
            severity: 'low',
            mitigation: 'Phase 3 ships only one consumer (TokenManager). 60s cadence is intentionally coarse. Future consumers should share a singleton context — Phase 4 watchpoint.',
        },
        {
            risk: 'Emit dropdown option text appears too dense in narrow sidebar',
            severity: 'low',
            mitigation: 'Menu rendered as portal overlay anchored to trigger; does not respect sidebar width.',
        },
    ],
    parallelismGroups: {
        'A': [
            'flint-electron-ipc',
            'flint-state-architect',
            'flint-design-engineer',
            'flint-mcp-specialist',
            'flint-test-writer',
        ],
        'B': [
            'flint-design-engineer',
            'flint-electron-ipc',
        ],
        'C': [
            'flint-test-writer',
            'flint-integration-validator',
        ],
    },
    nonGoals: [
        'No staleness threshold configurability via flint_set_policy — Phase 4 wires the policy schema',
        'No emit preview drawer — Phase 3 surfaces emit text via a single notification toast; full diff drawer is Phase 4',
        'No emit-as-Code-Connect — Bridge integration out of scope; emit goes to platform files only',
        'No new MCP tools — every consumed tool exists today',
        'No new IPC channels — preload validation tightening reuses mcp:call-tool',
        'No MCPCallResult.classification enforcement on every result yet — field is optional in the type',
        'No removal of Phase 2 keyword-fallback in useSyncActions — survives one phase as a backstop, removed in Phase 4',
        'No Phase 2 deferred items beyond the four named — TokenImpactAccordion, read-only banner, ApprovalStagingArea collapse, aria-live, density revamp, prefers-reduced-motion all remain Phase 4',
        'No flint_emit_tokens UI for flint_map_tokens (library mapper) — separate semantic; Phase 4 if user signal warrants',
        'No localStorage persistence of staleness dismissal — per-session by design',
        'No notification deduplication for repeated emit toasts — Phase 4 polish if it becomes annoying',
        'No changes to flint_sync_pull / flint_sync_push / flint_resolve_all / flint_resolve_conflict / flint_sync_check tool signatures — Zod schemas mirror existing case blocks exactly',
        'No FirstSyncPrompt relocation or modification',
        'No UX 5-8 from MINT.5 ceremony review (hierarchy reorder, density revamp, approval visual weight, contrast-panel inversion) — Phase 4',
    ],
}

// Suppress unused-warning for SyncActionError re-import in environments where
// only the runtime CONTRACT export is consumed. The type is part of the public
// surface for Phase 2 contract-shared consumers.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
void (null as unknown as SyncActionError)
