/**
 * RUNTIME.1 — axe-core Runtime Adapter
 * Executable Contract
 *
 * Phase:   RUNTIME.1 (weekend sprint — Gap #3 closure)
 * Status:  APPROVED (Justin signed off on 7 design decisions 2026-04-18)
 * Date:    2026-04-18
 * Owner:   flint-architect
 * Binds against: docs/strategy/WEEKEND-PLAN-2026-04-18.md
 *
 * Phase 2 agents import these types directly. No implementation lives here.
 * This file must compile cleanly with `npx tsc --noEmit --skipLibCheck`.
 *
 * Scope:
 *   - IPC channel `runtime:run-axe` (renderer→main, Zod-validated)
 *   - Sandboxed BrowserWindow (Electron) / hidden iframe (web) that runs axe-core
 *   - `SourceAuthority` union extension: `'runtime-dom'`
 *   - axe-core rule ID → Warden rule ID map (curated)
 *   - Normalization: AxeResults → A11yViolationDetail
 *   - canvasStore.runtimeFindings slice + useRuntimeAudit hook
 *   - StatusBar RuntimeAuditPill + GovernanceDashboard merged rendering (flag-gated)
 *   - Dedup via useMergedA11yFindings hook
 *   - Feature flag `runtime.axe.enabled` in flint.config.yaml (rules.runtime.axe block)
 *
 * First-ship posture:
 *   - Flag default: false (hidden). UI surfaces not mounted until flag flipped.
 *   - IPC handler is live; programmatic callers work regardless of flag.
 *
 * Non-goals (explicit — declared in nonGoals):
 *   - No visual regression testing
 *   - No axe-core fork or rule additions
 *   - No native OS accessibility inspection
 *   - No persistence of runtime findings (ephemeral)
 *   - No live/always-on mode (on-demand only)
 *   - No modification to existing Warden rule modules
 *   - No new IPC channel for the feature flag (piggybacks on flint_get_context)
 */

import type { FlintContract } from '../../shared/contract-schema.js'

// ─── Pre-existing Component Prop Stubs ────────────────────────────────────────
//
// RUNTIME.1 appends renders to StatusBar and GovernanceDashboard. The prop
// types are declared (but not exported) in the existing components at
// src/components/editor/StatusBar.tsx:207 and
// src/components/ui/GovernanceDashboard.tsx:64. We stub them here so the
// `components` array in CONTRACT.components resolves to real TypeScript
// names rather than dangling identifiers — Phase 1.5 WARNING-2 closure.
// Phase 2 must NOT rename or modify these existing local interfaces; the
// stubs exist purely for contract self-consistency.

/** Existing StatusBar local interface (not exported in source). */
export interface StatusBarProps {
    onConnectIDE?: () => void
    isDemo?: boolean
    onOpenOwnProject?: () => void
    onManageFigma?: () => void
}

/** Existing GovernanceDashboard local interface (not exported in source). */
export interface GovernanceDashboardProps {
    onOpenExportModal?: () => void
    onOpenGovernancePanel?: () => void
    initialViolationCount?: number
    onManageRules?: () => void
    onPolicySettings?: () => void
}

// ─── Feature Flag ─────────────────────────────────────────────────────────────

/**
 * Feature flag name for the first-ship hidden rollout.
 * Resolved via flint-mcp/src/core/config.ts::isRuntimeAxeEnabled(config) and
 * surfaced to Glass through the existing flint_get_context session context
 * as `features.runtimeAxeEnabled: boolean`.
 *
 * Default: false. StatusBar RuntimeAuditPill and GovernanceDashboard
 * "Runtime Audit" accordion are not mounted when false.
 */
export const RUNTIME_AXE_FEATURE_FLAG = 'runtime.axe.enabled' as const
export type RuntimeAxeFeatureFlag = typeof RUNTIME_AXE_FEATURE_FLAG

// ─── Extended Source Authority ────────────────────────────────────────────────

/**
 * Source authority union, extended to include the new runtime-dom value.
 * Phase 2's append to flint-mcp/src/core/governance/types.ts must match this
 * exact union — tsc will break in consumer files if it drifts.
 */
export type SourceAuthority =
    | 'WCAG 2.1 AA'
    | 'WCAG 2.2 AA'
    | 'SOC2'
    | 'FDA SaMD'
    | 'HIPAA'
    | 'Section 508'
    | 'Flint Design System'
    | 'Custom'
    | 'runtime-dom'

// ─── A11y Violation Shape (re-declared for standalone compile) ────────────────

/**
 * Minimal A11yViolationDetail contract needed by the adapter and normalizer.
 * Matches flint-mcp/src/core/a11y/types.ts shape. Re-declared here so this
 * .contract.ts compiles standalone without importing from the src/ tree.
 */
export interface A11yViolationDetail {
    ruleId: string
    elementId: string
    message: string
    severity: 'critical' | 'warning' | 'info' | 'advisory'
    wcag: string
    fixable: boolean
    explanation?: string
    recovery?: string
}

// ─── Runtime Audit: Request / Response ────────────────────────────────────────

/**
 * Current state of a runtime audit invocation. Drives the StatusBar pill UI
 * and the GovernanceDashboard runtime section.
 */
export type RuntimeAuditStatus =
    | 'idle'               // never run since last file open
    | 'running'            // IPC in flight
    | 'passed'             // axe ran, no violations
    | 'violations'         // axe ran, found violations
    | 'no-preview'         // previewHtml empty or build-error state
    | 'version-mismatch'   // axe.version !== EXPECTED_AXE_VERSION
    | 'error'              // adapter threw (sandbox failed to spawn, etc.)

/**
 * Request payload for runtime:run-axe IPC channel.
 *
 * previewHtml is the rendered HTML document to audit. The main process loads
 * it into a sandboxed BrowserWindow (Electron) or hidden iframe (web) with
 * a tight CSP that does NOT inherit the primary preview's SEC.1 policy.
 *
 * Renderer sends this via window.flintAPI.runtime.runAxe(request).
 */
export interface RuntimeAuditRequest {
    /** Full HTML document to audit. Empty string triggers status: 'no-preview'. */
    previewHtml: string
    /**
     * Optional URL string used only for sandbox window title and logging.
     * Never fetched — the sandbox has network disabled.
     */
    previewUrl?: string
    /**
     * Optional filter: only run these axe-core rule IDs.
     * When absent, runs all enabled rules from the bundled axe tag set.
     */
    rules?: string[]
}

/**
 * Response payload for runtime:run-axe IPC channel.
 *
 * Normalized from axe-core's AxeResults. Violations are A11yViolationDetail
 * shapes compatible with Warden's existing consumer paths. Every violation
 * carries sourceAuthority: 'runtime-dom' (attached inline by the normalizer
 * via a sibling metadata field — the A11yViolationDetail struct itself does
 * not carry authority; it's added downstream by the merger).
 */
export interface RuntimeAuditResult {
    status: RuntimeAuditStatus
    /** ISO 8601 UTC timestamp when audit completed. */
    timestamp: string
    /** axe-core version the adapter ran. */
    axeVersion: string
    /** Total nodes axe scanned. Useful for performance invariants. */
    nodeCount: number
    /** Wall-clock duration in milliseconds. */
    durationMs: number
    /** Normalized findings. Empty unless status === 'violations'. */
    violations: A11yViolationDetail[]
    /**
     * Populated only when status === 'version-mismatch' or 'error'.
     * Never populated in normal passed/violations/no-preview flows.
     */
    error?: {
        code: string
        message: string
    }
}

// ─── Axe Rule Map ─────────────────────────────────────────────────────────────

/**
 * Curated 1:1 map of axe-core rule IDs to Warden rule IDs.
 * Lives at flint-mcp/src/core/a11y/axeRuleMap.ts.
 *
 * Key = axe-core rule ID (e.g. 'color-contrast', 'image-alt').
 * Value = Warden rule ID (e.g. 'A11Y-036', 'A11Y-001').
 *
 * axe-only rules (no Warden equivalent) are NOT present here.
 * The normalizer falls back to 'RUNTIME-<axeRuleId>' for those.
 */
export type AxeRuleMap = Readonly<Record<string, string>>

/**
 * Map resolver signature. Returns the Warden rule ID when a mapping exists,
 * null otherwise. Consumers use the null return to trigger the RUNTIME-* prefix.
 */
export type MapAxeRuleToWarden = (axeRuleId: string) => string | null

// ─── Merged Finding (AST + runtime dedup output) ──────────────────────────────

/**
 * Output shape of useMergedA11yFindings.
 * Extends A11yViolationDetail with the multi-authority array. A dedup hit
 * (same ruleId + same elementId across AST and runtime) collapses to a
 * single row with sourceAuthorities containing both values.
 */
export interface MergedA11yFinding extends A11yViolationDetail {
    sourceAuthorities: SourceAuthority[]
}

// ─── Store Slice Contract (canvasStore extension) ─────────────────────────────

/**
 * canvasStore fields added by RUNTIME.1. Phase 2's canvasStore.ts must export
 * these as part of the store interface.
 */
export interface RuntimeAuditStoreSlice {
    /** Latest runtime audit result, or null if not yet run for the active file. */
    runtimeFindings: RuntimeAuditResult | null
    /** Sets the slice. Called by useRuntimeAudit on IPC success. */
    setRuntimeFindings: (result: RuntimeAuditResult | null) => void
    /** Clears the slice. Called when activeFilePath changes. */
    clearRuntimeFindings: () => void
}

// ─── useRuntimeAudit Hook Contract ────────────────────────────────────────────

/**
 * Return shape of useRuntimeAudit. Implementation at src/hooks/useRuntimeAudit.ts.
 * The hook is the ONLY renderer-side consumer of window.flintAPI.runtime.runAxe.
 * Components must use this hook, not call the IPC surface directly.
 */
export interface UseRuntimeAuditResult {
    /** Current audit status — mirrors store but hook-local in-flight state. */
    status: RuntimeAuditStatus
    /** Last audit result, or null. Equal to canvasStore.runtimeFindings. */
    result: RuntimeAuditResult | null
    /**
     * Trigger an audit. Serialized: a second call while status === 'running'
     * is a no-op. Returns a promise that resolves when the audit finishes.
     */
    run: (request?: Partial<RuntimeAuditRequest>) => Promise<void>
    /** Resets the hook to idle and clears the store slice. */
    reset: () => void
}

// ─── RuntimeAuditPill Component Props ─────────────────────────────────────────

export interface RuntimeAuditPillProps {
    status: RuntimeAuditStatus
    /** Total violations count. Ignored unless status === 'violations'. */
    findingCount: number
    /** Click handler — triggers useRuntimeAudit.run(). */
    onClick: () => void
}

// ─── Full Machine-Readable Contract ───────────────────────────────────────────

export const CONTRACT: FlintContract = {
    meta: {
        name: 'RUNTIME.1-axe-runtime-adapter',
        phase: 'RUNTIME.1',
        status: 'APPROVED',
        owner: 'flint-architect',
        date: '2026-04-18',
        // Primary audience: designer (Glass GovernanceDashboard gains a new
        // authority source, StatusBar gains a pill — both gated behind
        // runtime.axe.enabled feature flag on first ship). Secondary engine
        // consumption is derived — the A11yLinter surface doesn't change, it
        // just accepts an extra union value. Single audience declared per schema.
        audience: 'designer',
    },

    impact: [
        {
            file: 'electron/main.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary:
                'APPEND ONLY — new IPC handler `runtime:run-axe`. Lifecycle for sandboxed BrowserWindow (create on first call, reuse, teardown on window-all-closed). Tight CSP scoped to the sandbox window only; primary preview CSP untouched.',
        },
        {
            file: 'electron/preload.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary:
                'APPEND ONLY — expose `window.flintAPI.runtime.runAxe(request): Promise<RuntimeAuditResult>`. New namespace `runtime` under flintAPI.',
        },
        {
            file: 'server/index.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary:
                'APPEND ONLY — web-parity WebSocket handler for runtime:run-axe. Uses Puppeteer (already a dep via thumbnailService) to render preview HTML in a sandboxed page and run axe. Returns identical RuntimeAuditResult shape.',
        },
        {
            file: 'src/adapters/web-api.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary:
                'APPEND ONLY — web-side window.flintAPI.runtime.runAxe adapter. HTTP POST + WS response. Mirrors Electron IPC surface exactly.',
        },
        {
            file: 'shared/ipc-validators.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary:
                'GROUP 0 (pre-Phase-2) — APPEND ONLY. Add `runtime:run-axe` entry to `ipcSchemas` with payload (RuntimeAuditRequest) and response (RuntimeAuditResult). Alias-export named validators `runtimeRunAxePayloadSchema` and `runtimeRunAxeResponseSchema` mirroring the `getCoverageSummaryPayloadSchema` / `getCoverageSummaryResponseSchema` pattern at lines 209-213. MUST be grep-able before Groups A/B/C start — preload.ts imports these at compile time. Closes BLOCKING-2 from Phase 1.5 lint.',
        },
        {
            file: 'flint-mcp/src/core/a11y/axeRuleMap.ts',
            changeType: 'CREATE',
            owner: 'flint-ast-surgeon',
            summary:
                'Curated 1:1 map of axe-core rule IDs to Warden rule IDs. Exports `AXE_RULE_MAP` constant and `mapAxeRuleToWarden(axeId): string | null`. Tests assert every mapping is a valid Warden ruleId.',
        },
        {
            file: 'flint-mcp/src/core/a11y/axeNormalizer.ts',
            changeType: 'CREATE',
            owner: 'flint-ast-surgeon',
            summary:
                'Pure function `normalizeAxeResults(raw): A11yViolationDetail[]`. Consumes axe AxeResults, maps ruleIds via axeRuleMap, falls back to RUNTIME-* prefix for axe-only rules. Deterministic.',
        },
        {
            file: 'flint-mcp/src/core/governance/types.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'APPEND ONLY — extend SourceAuthority union with `| \'runtime-dom\'`. Non-breaking — downstream consumers that render authority as string handle the new value without change.',
        },
        {
            file: 'flint-mcp/src/core/A11yLinter.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'APPEND ONLY — comment-only addition documenting that runtime-dom findings flow through a parallel pipeline and share A11yViolationDetail shape. Zero logic change; avoids merge conflict with Phase 0 coverage additions.',
        },
        {
            file: 'flint-mcp/src/core/governance/ruleProvenanceRegistry.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'APPEND ONLY — register fallback provenance entry for sourceAuthority runtime-dom so resolveProvenance() and SARIF filter recognize the value.',
        },
        {
            file: 'flint-mcp/src/core/config.ts',
            changeType: 'MODIFY',
            owner: 'flint-ast-surgeon',
            summary:
                'APPEND ONLY — extend FlintProjectConfig.rules with optional `runtime?: { axe?: { enabled?: boolean } }` block, matching the existing nested-rule pattern (rules.mithril, rules.accessibility, rules.export_gate). Export `isRuntimeAxeEnabled(config: FlintConfig): boolean` — reads YAML-resolved `rules.runtime.axe.enabled === true`, defaults to false. Append `features.runtimeAxeEnabled` to the Beacon flint_get_context session-context payload so Glass can read the flag without a new IPC channel.',
        },
        {
            file: 'src/store/canvasStore.ts',
            changeType: 'MODIFY',
            owner: 'flint-state-architect',
            summary:
                'APPEND ONLY — add runtimeFindings slice + setRuntimeFindings + clearRuntimeFindings actions. No cross-store imports. Slice cleared on activeFilePath change.',
        },
        {
            file: 'src/hooks/useRuntimeAudit.ts',
            changeType: 'CREATE',
            owner: 'flint-state-architect',
            summary:
                'Hook owning runtime audit flow. Calls window.flintAPI.runtime.runAxe, writes result to canvasStore, surfaces errors via notificationStore. Serializes concurrent calls.',
        },
        {
            file: 'src/hooks/useMergedA11yFindings.ts',
            changeType: 'CREATE',
            owner: 'flint-state-architect',
            summary:
                'Pure derivation hook. Merges canvasStore.a11yViolations with canvasStore.runtimeFindings by (mappedRuleId, elementId). Returns MergedA11yFinding[] with source-authority array. Memoized.',
        },
        {
            file: 'src/components/editor/StatusBar.tsx',
            changeType: 'MODIFY',
            owner: 'flint-design-engineer',
            summary:
                'APPEND ONLY — mount <RuntimeAuditPill> at trailing edge after CoverageBadge. DOUBLE-GATED: hidden unless (a) sessionContext.features.runtimeAxeEnabled === true AND (b) activeFilePath !== null. When the flag is false, the pill is not mounted at all (no spinner, no placeholder). First ship posture.',
        },
        {
            file: 'src/components/editor/RuntimeAuditPill.tsx',
            changeType: 'CREATE',
            owner: 'flint-design-engineer',
            summary:
                'Presentational pill: idle / running (spinner) / passed (checkmark) / violations (count) / version-mismatch / error. Keyboard Enter/Space triggers onClick.',
        },
        {
            file: 'src/components/ui/GovernanceDashboard.tsx',
            changeType: 'MODIFY',
            owner: 'flint-design-engineer',
            summary:
                'Consume useMergedA11yFindings. Render source-authority chips on each row (always live — cost is zero when runtimeFindings is null). Add a Runtime Audit accordion section for runtime-only findings (axe-only rules with RUNTIME-* prefix). ACCORDION IS FLAG-GATED: not rendered when sessionContext.features.runtimeAxeEnabled !== true.',
        },
        {
            file: 'src/types/flint-api.d.ts',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary:
                'APPEND ONLY — declare window.flintAPI.runtime namespace. Import RuntimeAuditRequest/Result/Status types from RUNTIME.1.contract.ts.',
        },
        {
            file: 'package.json',
            changeType: 'MODIFY',
            owner: 'flint-electron-ipc',
            summary: 'APPEND ONLY — add `"axe-core": "4.10.3"` (exact pin) to dependencies.',
        },
        {
            file: 'electron/__tests__/runtime-adapter.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary:
                'Adapter happy path, CSP isolation, version mismatch, empty preview, offline-mode.',
        },
        {
            file: 'flint-mcp/src/core/a11y/__tests__/axeNormalizer.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Canned AxeResults fixtures → A11yViolationDetail shape + ruleId mapping.',
        },
        {
            file: 'flint-mcp/src/core/a11y/__tests__/axeRuleMap.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Mapped axe rules resolve to Warden IDs; unmapped rules return null.',
        },
        {
            file: 'src/hooks/__tests__/useRuntimeAudit.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Happy path, serialization, error surfacing, reset on file change.',
        },
        {
            file: 'src/hooks/__tests__/useMergedA11yFindings.test.ts',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Dedup merge, different elements, runtime-only fallthrough.',
        },
        {
            file: 'src/components/editor/__tests__/RuntimeAuditPill.test.tsx',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'All status states render; keyboard activation; hidden when no file active.',
        },
        {
            file: 'src/components/ui/__tests__/GovernanceDashboard.runtime-merge.test.tsx',
            changeType: 'CREATE',
            owner: 'flint-test-writer',
            summary: 'Merged rows render with multi-authority chips; runtime-only section visible (flag-on path) and hidden (flag-off path).',
        },
        {
            file: '.flint-context/reviews/runtime.1-integration-2026-04-18.md',
            changeType: 'CREATE',
            owner: 'flint-integration-validator',
            summary:
                'Phase 3 post-Phase-2 integration report. Records: every testBoundary mapped to a matching test file + passing assertion; every invariant.threshold measured + verdict; flag-off behavior verified (pill absent, accordion absent, IPC still callable); no Phase 0 / MINT.5 regression. Verdict: SHIP / FIX / REDESIGN. Closes WARNING-1 from Phase 1.5 lint by giving flint-integration-validator a concrete owned file.',
        },
    ],

    ipc: [
        {
            channel: 'runtime:run-axe',
            direction: 'renderer→main',
            payloadType: 'RuntimeAuditRequest',
            returnType: 'RuntimeAuditResult',
            handler: 'electron/main.ts',
            validator: 'runtimeRunAxePayloadSchema',
        },
    ],

    stores: [
        {
            store: 'canvasStore',
            newState: {
                runtimeFindings: 'RuntimeAuditResult | null',
            },
            newActions: {
                setRuntimeFindings: '(result: RuntimeAuditResult | null) => void',
                clearRuntimeFindings: '() => void',
            },
            newSelectors: {},
        },
    ],

    components: [
        {
            name: 'RuntimeAuditPill',
            file: 'src/components/editor/RuntimeAuditPill.tsx',
            propsType: 'RuntimeAuditPillProps',
            consumesStores: [],
            emitsIPC: [],
        },
        {
            name: 'StatusBar',
            file: 'src/components/editor/StatusBar.tsx',
            propsType: 'StatusBarProps',
            consumesStores: ['canvasStore'],
            emitsIPC: [],
        },
        {
            name: 'GovernanceDashboard',
            file: 'src/components/ui/GovernanceDashboard.tsx',
            propsType: 'GovernanceDashboardProps',
            consumesStores: ['canvasStore', 'tokenStore'],
            emitsIPC: [],
        },
    ],

    commandments: [1, 4, 5, 6, 8, 12, 13, 14],

    invariants: [
        {
            name: 'runtime-audit-latency-p95',
            measurable:
                'end-to-end latency from useRuntimeAudit.run() call to RuntimeAuditResult resolution on a preview with ~1000 DOM nodes',
            threshold: '< 3000ms at N=1000 nodes',
            measuredBy:
                'vitest benchmark with canned 1000-node HTML fixture + performance.now() markers in electron/__tests__/runtime-adapter.bench.ts',
        },
        {
            name: 'dedup-coverage',
            measurable:
                'percentage of AST+runtime finding pairs that merge into a single MergedA11yFinding when both sources flag the same element for the same rule',
            threshold: '>= 85% across a curated 20-pair test fixture',
            measuredBy:
                'useMergedA11yFindings.test asserts merged.length / pairs.length >= 0.85',
        },
        {
            name: 'csp-sandbox-isolation',
            measurable:
                'number of runtime:run-axe invocations that mutate the primary LivePreview CSP headers',
            threshold: '= 0 mutations to primary preview session',
            measuredBy:
                'integration test loads primary preview, captures CSP headers, runs runtime audit, reasserts headers unchanged',
        },
        {
            name: 'version-mismatch-graceful',
            measurable:
                'number of runtime audit invocations that throw uncaught exceptions when axe.version !== EXPECTED_AXE_VERSION',
            threshold: '= 0 uncaught throws',
            measuredBy:
                'adapter test injects axe shim with wrong version, asserts Promise resolves with status version-mismatch (not rejects)',
        },
        {
            name: 'empty-preview-handled',
            measurable:
                'runtime audit invocation latency when previewHtml is empty string',
            threshold: '< 500ms to resolve with status no-preview',
            measuredBy:
                'adapter test passes previewHtml empty, asserts resolve within 500ms and violations length = 0',
        },
        {
            name: 'offline-resilience',
            measurable:
                'number of network requests issued by the sandbox during a runtime audit',
            threshold: '= 0 network requests made',
            measuredBy:
                'adapter integration test registers session.webRequest.onBeforeRequest counter, asserts zero after audit completes',
        },
        {
            name: 'serialization',
            measurable:
                'IPC call count after useRuntimeAudit.run() is invoked twice while status === "running"',
            threshold: '= 1 total IPC call',
            measuredBy:
                'useRuntimeAudit.test calls run() twice back-to-back, asserts window.flintAPI.runtime.runAxe invoked exactly once',
        },
        {
            name: 'flag-off-ui-silent',
            measurable:
                'DOM node count produced by RuntimeAuditPill + GovernanceDashboard "Runtime Audit" accordion when features.runtimeAxeEnabled === false',
            threshold: '= 0 DOM nodes rendered for runtime-axe surfaces',
            measuredBy:
                'integration test renders both components with flag off, asserts queryByTestId("runtime-audit-pill-idle") and queryByRole("region", { name: /runtime audit/i }) both return null',
        },
    ],

    testBoundaries: [
        // ── IPC adapter ─────────────────────────────────────────────────────
        {
            target: 'runtime:run-axe happy path',
            kind: 'ipc-handler',
            behavior: 'Returns violations for known-bad HTML',
            assertion:
                'response.violations contains an entry with ruleId === "A11Y-001"',
            edgeCases: [
                'image without alt → A11Y-001',
                'button without accessible name → A11Y-002',
                'input without label → A11Y-004',
            ],
            given: 'previewHtml containing <img src="x.png"> (missing alt)',
            when: 'runtime:run-axe IPC is invoked',
            then: 'returns a RuntimeAuditResult with status "violations" and at least one violation with ruleId "A11Y-001"',
        },
        {
            target: 'runtime:run-axe csp-isolation',
            kind: 'ipc-handler',
            behavior: 'Sandbox BrowserWindow does not mutate primary preview CSP',
            assertion:
                'primary session CSP headers identical before and after the audit',
            edgeCases: [
                'Primary preview session captured pre-audit',
                'Captured post-audit and compared field-by-field',
            ],
            given: 'primary LivePreview session has SEC.1 production CSP applied',
            when: 'runtime:run-axe is invoked with valid previewHtml',
            then: 'writes no changes to the primary preview session CSP headers',
        },
        {
            target: 'runtime:run-axe version-mismatch',
            kind: 'ipc-handler',
            behavior: 'Returns status version-mismatch when axe.version differs',
            assertion:
                'response.status === "version-mismatch" && response.error.code === "axe-version-mismatch"',
            edgeCases: [
                'Shim axe bundle with version 3.0.0 should yield mismatch',
                'Never throws',
            ],
            given: 'sandbox loads a shim axe bundle with version "3.0.0"',
            when: 'runtime:run-axe IPC is invoked',
            then: 'returns a RuntimeAuditResult with status "version-mismatch" and does not throw',
        },
        {
            target: 'runtime:run-axe empty-preview',
            kind: 'ipc-handler',
            behavior: 'Returns status no-preview for empty HTML',
            assertion:
                'response.status === "no-preview" && response.violations.length === 0',
            edgeCases: ['Resolves within 500ms', 'No sandbox window leaked'],
            given: 'previewHtml is an empty string',
            when: 'runtime:run-axe IPC is invoked',
            then: 'returns a RuntimeAuditResult with status "no-preview" and empty violations within 500ms',
        },
        {
            target: 'runtime:run-axe offline',
            kind: 'ipc-handler',
            behavior: 'Audit completes with zero network calls',
            assertion: 'networkCallCount === 0 after audit resolves',
            edgeCases: [
                'axe-core bundle must be local, not CDN',
                'Sandbox session blocks all network at webRequest.onBeforeRequest',
            ],
            given: 'sandbox network is disabled via webRequest blocker',
            when: 'runtime:run-axe is invoked with valid previewHtml',
            then: 'resolves with normal status (passed or violations) and makes zero network requests',
        },

        // ── Normalizer ──────────────────────────────────────────────────────
        {
            target: 'normalizeAxeResults mapped rule',
            kind: 'service',
            behavior: 'Maps axe color-contrast to Warden A11Y-036',
            assertion:
                'output[0].ruleId === "A11Y-036" && output[0].severity === "critical"',
            edgeCases: [
                'image-alt → A11Y-001',
                'button-name → A11Y-002',
                'label → A11Y-004',
            ],
            given: 'axe raw result with a single violation whose id is "color-contrast"',
            when: 'normalizeAxeResults is called with the raw result',
            then: 'returns an A11yViolationDetail array with ruleId "A11Y-036"',
        },
        {
            target: 'normalizeAxeResults axe-only rule',
            kind: 'service',
            behavior: 'Uses RUNTIME-* prefix for unmapped axe rules',
            assertion: 'output[0].ruleId === "RUNTIME-frame-title"',
            edgeCases: [
                'Any axe rule id not present in axeRuleMap.ts uses the prefix',
                'Prefix is literal "RUNTIME-" followed by the axe id verbatim',
            ],
            given: 'axe raw result with violation id "frame-title" (no Warden mapping)',
            when: 'normalizeAxeResults is called',
            then: 'returns an A11yViolationDetail array with ruleId "RUNTIME-frame-title"',
        },
        {
            target: 'normalizeAxeResults determinism',
            kind: 'service',
            behavior: 'Pure function — same input produces identical output',
            assertion: 'JSON.stringify(output1) === JSON.stringify(output2)',
            edgeCases: ['No random IDs', 'No wall-clock dependency in output'],
            given: 'the same canned AxeResults passed twice',
            when: 'normalizeAxeResults is called twice',
            then: 'returns byte-identical output arrays both times',
        },

        // ── Rule map ────────────────────────────────────────────────────────
        {
            target: 'mapAxeRuleToWarden known',
            kind: 'service',
            behavior: 'Returns Warden rule ID for known axe rule',
            assertion: 'mapAxeRuleToWarden("image-alt") === "A11Y-001"',
            edgeCases: [
                'Casing matches axe output exactly',
                'No trailing whitespace',
            ],
            given: 'axe rule id "image-alt"',
            when: 'mapAxeRuleToWarden is called',
            then: 'returns "A11Y-001"',
        },
        {
            target: 'mapAxeRuleToWarden unknown',
            kind: 'service',
            behavior: 'Returns null for unknown axe rule',
            assertion: 'mapAxeRuleToWarden("fictional-rule-x") === null',
            edgeCases: [],
            given: 'an axe rule id not present in axeRuleMap.ts',
            when: 'mapAxeRuleToWarden is called',
            then: 'returns null',
        },

        // ── useRuntimeAudit hook ────────────────────────────────────────────
        {
            target: 'useRuntimeAudit happy path',
            kind: 'hook',
            behavior: 'Triggers audit and writes result into canvasStore',
            assertion:
                'window.flintAPI.runtime.runAxe was called once && canvasStore.setRuntimeFindings invoked with IPC response',
            edgeCases: ['result getter reflects canvasStore.runtimeFindings'],
            given: 'window.flintAPI.runtime.runAxe mocked to resolve with status violations',
            when: 'useRuntimeAudit.run() is invoked',
            then: 'calls window.flintAPI.runtime.runAxe exactly once and sets canvasStore.runtimeFindings to the response',
        },
        {
            target: 'useRuntimeAudit serialization',
            kind: 'hook',
            behavior: 'Rejects concurrent run() calls while status=running',
            assertion:
                'window.flintAPI.runtime.runAxe was called exactly once after two back-to-back run() invocations',
            edgeCases: [
                'Second run() returns without IPC call',
                'No notification emitted for the rejected call',
            ],
            given: 'useRuntimeAudit status is "running" (first IPC in flight)',
            when: 'run() is invoked a second time before the first resolves',
            then: 'blocks the second call and invokes window.flintAPI.runtime.runAxe exactly once',
        },
        {
            target: 'useRuntimeAudit error surfacing',
            kind: 'hook',
            behavior: 'Surfaces IPC rejection via notification',
            assertion:
                'notificationStore.push called with severity "error" && canvasStore.runtimeFindings === null',
            edgeCases: [
                'autoDismissMs 8000 matches other error toast patterns',
                'Hook status returns to "error"',
            ],
            given: 'window.flintAPI.runtime.runAxe mocked to reject with Error("sandbox spawn failed")',
            when: 'run() is invoked',
            then: 'emits an error notification and leaves canvasStore.runtimeFindings null',
        },
        {
            target: 'useRuntimeAudit reset on file change',
            kind: 'hook',
            behavior: 'Clears runtime findings when activeFilePath changes',
            assertion:
                'canvasStore.clearRuntimeFindings called exactly once after activeFilePath changes',
            edgeCases: ['Does not clear when active file stays the same'],
            given: 'canvasStore.runtimeFindings is populated',
            when: 'canvasStore.activeFilePath changes to a different file',
            then: 'calls canvasStore.clearRuntimeFindings exactly once',
        },

        // ── useMergedA11yFindings hook ──────────────────────────────────────
        {
            target: 'useMergedA11yFindings dedup',
            kind: 'hook',
            behavior: 'Merges AST and runtime findings for same (ruleId, elementId)',
            assertion:
                'merged.length === 1 && merged[0].sourceAuthorities.length === 2',
            edgeCases: [
                'sourceAuthorities includes both "WCAG 2.1 AA" and "runtime-dom"',
                'Merged severity is the higher of the two',
            ],
            given: 'a11yViolations containing ruleId A11Y-001 elementId e1 and runtimeFindings containing ruleId A11Y-001 elementId e1',
            when: 'useMergedA11yFindings derivation runs',
            then: 'returns a single MergedA11yFinding with sourceAuthorities ["WCAG 2.1 AA", "runtime-dom"]',
        },
        {
            target: 'useMergedA11yFindings no dedup different element',
            kind: 'hook',
            behavior: 'Does not merge when elementIds differ',
            assertion: 'merged.length === 2',
            edgeCases: [],
            given: 'AST finding for ruleId A11Y-001 on elementId e1 and runtime finding for A11Y-001 on elementId e2',
            when: 'useMergedA11yFindings runs',
            then: 'returns two separate MergedA11yFinding entries',
        },
        {
            target: 'useMergedA11yFindings runtime-only',
            kind: 'hook',
            behavior: 'Preserves runtime-only findings with single authority',
            assertion:
                'merged[0].sourceAuthorities === ["runtime-dom"] && merged[0].ruleId.startsWith("RUNTIME-")',
            edgeCases: ['axe-only rule like frame-title'],
            given: 'no AST findings, one runtime finding with ruleId "RUNTIME-frame-title"',
            when: 'useMergedA11yFindings runs',
            then: 'returns a single MergedA11yFinding with sourceAuthorities ["runtime-dom"]',
        },
        {
            target: 'useMergedA11yFindings memoization',
            kind: 'hook',
            behavior: 'Returns same array reference when inputs unchanged',
            assertion: 'firstCall.result === secondCall.result (referential equality)',
            edgeCases: [],
            given: 'a11yViolations and runtimeFindings references unchanged between renders',
            when: 'useMergedA11yFindings runs twice',
            then: 'returns the same array reference on both calls',
        },

        // ── RuntimeAuditPill component ──────────────────────────────────────
        {
            target: 'RuntimeAuditPill idle',
            kind: 'component',
            behavior: 'Renders neutral chip when status is idle',
            assertion:
                'getByTestId("runtime-audit-pill-idle") is in the document',
            edgeCases: ['Not disabled', 'Click fires onClick'],
            given: 'status="idle" and findingCount=0',
            when: 'the pill mounts',
            then: 'renders the idle-state chip with an "Audit runtime" label',
        },
        {
            target: 'RuntimeAuditPill running',
            kind: 'component',
            behavior: 'Renders spinner while running',
            assertion: 'getByTestId("runtime-audit-spinner") is in the document',
            edgeCases: ['Button is aria-disabled but not disabled'],
            given: 'status="running"',
            when: 'the pill mounts',
            then: 'renders a Loader2 spinner inside the pill',
        },
        {
            target: 'RuntimeAuditPill violations',
            kind: 'component',
            behavior: 'Renders count when violations present',
            assertion: 'getByText("5") is in the document',
            edgeCases: [
                'Amber tint for count > 0 and < 10',
                'Red tint for count >= 10',
            ],
            given: 'status="violations" and findingCount=5',
            when: 'the pill mounts',
            then: 'renders the count "5" with an amber tint',
        },
        {
            target: 'RuntimeAuditPill keyboard',
            kind: 'component',
            behavior: 'Activates on Enter/Space',
            assertion: 'onClick invoked exactly once on Enter keydown',
            edgeCases: ['Space also triggers', 'Other keys do not'],
            given: 'pill focused and status="idle"',
            when: 'user presses Enter',
            then: 'calls onClick exactly once',
        },

        // ── StatusBar integration ───────────────────────────────────────────
        {
            target: 'StatusBar runtime pill gated',
            kind: 'component',
            behavior: 'Hides RuntimeAuditPill when no file active',
            assertion:
                'queryByTestId("runtime-audit-pill-idle") === null when activeFilePath === null',
            edgeCases: ['Appears when activeFilePath transitions from null to a file path'],
            given: 'canvasStore.activeFilePath is null',
            when: 'StatusBar renders',
            then: 'renders no RuntimeAuditPill element in the DOM',
        },

        // ── Feature flag (first-ship hidden posture) ────────────────────────
        {
            target: 'RuntimeAuditPill flag-off not mounted',
            kind: 'component',
            behavior: 'Does not mount pill when runtime.axe.enabled is false',
            assertion:
                'queryByTestId("runtime-audit-pill-idle") === null when features.runtimeAxeEnabled === false',
            edgeCases: [
                'Absence of the flag key in session context is treated as false',
                'No placeholder node rendered — the pill is fully unmounted',
            ],
            given: 'sessionContext.features.runtimeAxeEnabled is false and activeFilePath is a valid file',
            when: 'StatusBar renders',
            then: 'renders no RuntimeAuditPill element in the DOM',
        },
        {
            target: 'GovernanceDashboard runtime accordion flag-off hidden',
            kind: 'component',
            behavior: 'Hides Runtime Audit accordion when flag is disabled',
            assertion:
                'queryByRole("region", { name: /runtime audit/i }) === null when features.runtimeAxeEnabled === false',
            edgeCases: [
                'Merged-chip rendering on regular rows still works (always live)',
                'runtime-only findings in the store are not surfaced anywhere',
            ],
            given: 'sessionContext.features.runtimeAxeEnabled is false and canvasStore.runtimeFindings has a RUNTIME-frame-title entry',
            when: 'GovernanceDashboard renders',
            then: 'renders no Runtime Audit accordion region',
        },
        {
            target: 'isRuntimeAxeEnabled default false',
            kind: 'service',
            behavior: 'Resolver returns false when flag is absent from config',
            assertion: 'isRuntimeAxeEnabled(configWithoutFlag) === false',
            edgeCases: [
                'Config with rules absent → false',
                'Config with rules.runtime absent → false',
                'Config with rules.runtime.axe.enabled === undefined → false',
            ],
            given: 'a FlintConfig whose policy has no rules.runtime.axe block',
            when: 'isRuntimeAxeEnabled is called',
            then: 'returns false',
        },
        {
            target: 'isRuntimeAxeEnabled true when flag set',
            kind: 'service',
            behavior: 'Resolver returns true when flag is explicitly enabled',
            assertion: 'isRuntimeAxeEnabled(configWithFlagTrue) === true',
            edgeCases: ['Only strict boolean true enables; truthy strings do not'],
            given: 'a FlintConfig whose rules.runtime.axe.enabled === true',
            when: 'isRuntimeAxeEnabled is called',
            then: 'returns true',
        },
        {
            target: 'runtime:run-axe ipc-callable when flag off',
            kind: 'ipc-handler',
            behavior: 'IPC handler is live regardless of feature flag state',
            assertion:
                'response.status ∈ { "passed", "violations", "no-preview" } when features.runtimeAxeEnabled === false',
            edgeCases: [
                'Programmatic callers (tests, scripts) work even with flag off',
                'Only the UI surfaces are flag-gated, not the handler',
            ],
            given: 'rules.runtime.axe.enabled is false and previewHtml contains valid HTML',
            when: 'runtime:run-axe IPC is invoked directly (bypassing the pill)',
            then: 'returns a valid RuntimeAuditResult without an error status',
        },

        // ── GovernanceDashboard integration ─────────────────────────────────
        {
            target: 'GovernanceDashboard merged row',
            kind: 'component',
            behavior: 'Renders a single row with two authority chips on dedup hit',
            assertion:
                'queryAllByTestId("source-authority-chip").length === 2 within the same violation row',
            edgeCases: ['Chip order is deterministic (AST first, runtime second)'],
            given: 'canvasStore has both a11yViolations and runtimeFindings that match on (ruleId, elementId)',
            when: 'GovernanceDashboard renders',
            then: 'renders one violation row containing two source-authority chips',
        },
        {
            target: 'GovernanceDashboard runtime-only section',
            kind: 'component',
            behavior: 'Surfaces axe-only findings in dedicated accordion',
            assertion:
                'getByRole("region", { name: /runtime audit/i }) is in the document and contains a row with ruleId prefix "RUNTIME-"',
            edgeCases: [],
            given: 'canvasStore.runtimeFindings contains a RUNTIME-frame-title violation not present in a11yViolations',
            when: 'GovernanceDashboard renders',
            then: 'renders the Runtime Audit accordion containing the RUNTIME-frame-title row',
        },
    ],

    risks: [
        {
            risk:
                'Sandbox BrowserWindow leaks resources (never torn down, accumulates across project opens).',
            severity: 'medium',
            commandment: 14,
            mitigation:
                'Lifecycle bound to activeProjectRoot change. Explicit teardown on window-all-closed. Integration test asserts BrowserWindow count after 100 audits remains 1.',
        },
        {
            risk: 'axe-core bundle adds ~400KB to Electron dist and comparable to web.',
            severity: 'low',
            commandment: 4,
            mitigation:
                'Lazy-load axe bundle — only loaded into sandbox when first audit fires. Web build loads into hidden iframe on-demand.',
        },
        {
            risk: 'axe version bump silently changes finding shape.',
            severity: 'medium',
            mitigation:
                'Version pinned exactly. Adapter checks axe.version equals EXPECTED_AXE_VERSION; returns status version-mismatch on drift.',
        },
        {
            risk:
                'frame-title and iframe-specific axe rules miss nested iframes because sandbox loads flattened preview HTML.',
            severity: 'low',
            mitigation:
                'Documented as a known limitation. Future phase can inline iframe content into sandbox; not a ship-blocker.',
        },
        {
            risk:
                'axeRuleMap drifts from axe version — a new axe release adds rules we do not know about.',
            severity: 'medium',
            mitigation:
                'Contract explicitly allows RUNTIME-<axeRuleId> fallback. axeRuleMap tests are expected to fail-fast when new axe rules are not registered.',
        },
        {
            risk:
                'Web-build parity diverges — Electron BrowserWindow sandbox is not isomorphic with a Puppeteer page.',
            severity: 'high',
            mitigation:
                'Adapter surface is the IPC contract, not the implementation. Both implementations return RuntimeAuditResult. Parity test loads same HTML on both and asserts identical violations array length + first-finding ruleId.',
        },
        {
            risk:
                'GovernanceDashboard merge adds render cost that degrades existing finding list performance.',
            severity: 'medium',
            mitigation:
                'useMergedA11yFindings is memoized. Benchmark: merge of 100 AST + 100 runtime findings must complete within 20ms. Added to invariants if this surfaces during implementation.',
        },
        {
            risk:
                'User confuses runtime authority with AST authority — why does Warden say A11Y-001 but runtime says RUNTIME-image-alt?',
            severity: 'medium',
            mitigation:
                'axeRuleMap covers common cases so they map consistently to A11Y-*. RUNTIME-* prefix only appears for axe-only rules. UI chip shows both authorities when deduped.',
        },
        {
            risk:
                'CSP regression on primary preview (someone relaxes CSP thinking it is needed for axe).',
            severity: 'high',
            mitigation:
                'Separate BrowserWindow is architecturally enforced. Primary preview CSP in createWindow() is untouched. Sandbox CSP is in new function createRuntimeAuditSandbox(). Invariant csp-sandbox-isolation asserts this.',
        },
        {
            risk:
                'Offline-mode violated if axe-core pulls telemetry or analytics on first run.',
            severity: 'high',
            commandment: 4,
            mitigation:
                'axe-core 4.x is local-only. Adapter sandbox has network disabled via session.webRequest.onBeforeRequest reject-all. Invariant offline-resilience asserts zero network calls.',
        },
    ],

    parallelismGroups: {
        // Group 0 — Pre-Phase-2 Setup. Hard gate. flint-electron-ipc adds the
        // two Zod schema exports to shared/ipc-validators.ts BEFORE any other
        // agent starts. Closes BLOCKING-2 from Phase 1.5 lint (validator
        // exports must exist before preload.ts imports them at compile time).
        // Single-owner group; not parallel.
        '0': ['flint-electron-ipc'],
        // Group A — Foundation. All four agents run simultaneously, no cross-deps.
        A: ['flint-ast-surgeon', 'flint-electron-ipc', 'flint-state-architect', 'flint-test-writer'],
        // Group B — Wire-up. Design engineer joins after Group A exports stable.
        B: ['flint-ast-surgeon', 'flint-state-architect', 'flint-design-engineer', 'flint-electron-ipc'],
        // Group C — Validation. Sequential. flint-integration-validator owns
        // the integration-report impact entry, satisfying the linter's
        // "every agent in a parallelism group owns ≥ 1 impact file" rule.
        C: ['flint-test-writer', 'flint-integration-validator'],
    },

    nonGoals: [
        'No visual regression testing (Playwright screenshots, pixel diffs, layout regression are a separate category).',
        'No axe-core fork or rule additions. Flint consumes axe as a library; new Warden rules go to flint-mcp/src/core/a11y/rules/*.ts only.',
        'No native OS accessibility inspection. macOS Accessibility Inspector, Windows Narrator APIs, Linux AT-SPI are out of scope.',
        'No persistence of runtime findings in Phase RUNTIME.1. Ephemeral only; no SQLite schema changes.',
        'No live / always-on mode in Phase RUNTIME.1. On-demand trigger only. Live mode is a Phase 2 consideration after cost is measured.',
        'No changes to existing Warden rule modules. Append-only extension of SourceAuthority; rule files untouched.',
        'No changes to Phase 0 coverage calculation. governedSurfacePercent remains AST-scope.',
        'No separate IPC channel for the feature flag. The flag is read from the existing flint_get_context session-context surface as features.runtimeAxeEnabled. First ship posture is flag-default-false (hidden).',
        'No flag-defaulted-true ship in this phase. Enablement is a follow-up release after the adapter soaks in CI and local dogfood.',
    ],
}
