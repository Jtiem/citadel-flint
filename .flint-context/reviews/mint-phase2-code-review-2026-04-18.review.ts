/**
 * MINT.5 Phase 2 — Code Review (machine-readable)
 *
 * Reviewer: flint-code-reviewer (parallel with UX + security)
 * Scope: 11 production files + 6 test files + shared/ipc-validators.ts
 * Phase 2 shipped via Group A (hook + cluster + 2 dialogs) + Group B (drift row
 * + group + empty state) + Group C (TokenHealthBar, TokenGrid, TokenManager
 * integration). +105 tests, TSC 0 errors, 5/5 + 4/4 Phase 2 suites pass.
 */

import {
    countFindings,
    deriveVerdict,
    type ReviewFinding,
    type ReviewReport,
} from '../../shared/review-schema';

const findings: ReviewFinding[] = [
    {
        id: 'WARN-1',
        title: 'Auth-expired classification is keyword-based and fragile',
        severity: 'warning',
        evidence: [
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 68,
                excerpt:
                    "function isAuthExpiredError(message: string): boolean {\n    const lower = message.toLowerCase()\n    return (\n        lower.includes('auth-expired') ||\n        lower.includes('auth expired') ||\n        lower.includes('token expired') ||\n        lower.includes('connection revoked') ||\n        lower.includes('unauthorized') ||\n        lower.includes('not authorized')\n    )\n}",
                note: 'classifier decides persistent-chip vs transient-toast based on substring match of the human-readable error.text',
            },
            {
                file: 'flint-mcp/src/core/errorResponse.ts',
                line: 116,
                excerpt: '"The connection was disconnected or the access token expired"',
                note: 'upstream error text uses "access token expired" — matches the classifier',
            },
        ],
        observed:
            'Error classification (persistent vs transient) is implemented by substring-matching the MCP tool\'s human-readable text. The MCPCallResult type carries no structured status field. If upstream message wording changes (e.g. "Figma session revoked" or "401 Unauthorized") the renderer will misclassify the error and surface a transient 8s toast instead of the persistent sync-error chip the contract specifies.',
        rationale:
            'The MINT.5 Phase 2 contract §Open-Questions-5 explicitly specifies a persistent-chip vs transient-toast split based on the MCP tool response — the author acknowledged in useSyncActions.ts JSDoc "If/when a structured status field is added (Phase 3+), swap this for that field." But keyword matching makes a load-bearing UX decision on a stringly-typed signal the engine team can change unilaterally. This is a behavioural regression waiting to happen.',
        proposedFix:
            'Add a structured status field to the MCP error path (e.g. `content[].metadata?.status: "auth-expired" | "network" | ...`) surfaced by `errorResponse.ts`, then read that field in useSyncActions.ts. Interim: widen the keyword list to include "401", "403", "forbidden", "session", "reauth", and document upstream wording invariants in errorResponse.ts so the two ends stay in sync.',
        scope: 'cross-file',
        status: 'open',
    },
    {
        id: 'WARN-2',
        title: 'localEditCount hardcoded to 0 — Push + ConfirmPushDialog path unreachable in production',
        severity: 'warning',
        evidence: [
            {
                file: 'src/components/ui/TokenManager.tsx',
                line: 696,
                excerpt:
                    '/* MINT.5 Phase 2 §2.1 — sync cluster wiring.\n   localEditCount and pendingConflictCount are TODO-sourced\n   from flint_sync_check in a future sync. For now we pass\n   0 so the Push and Resolve buttons render disabled —\n   Pull still works for the common case (drift → pull). */\nlocalEditCount={0}',
            },
            {
                file: 'src/components/ui/TokenManager.tsx',
                line: 885,
                excerpt: '<ConfirmPushDialog\n    isOpen={pushDialogOpen}\n    localEditCount={0}',
                note: 'the dialog could only ever open via handlePush, which the Push button gates, but localEditCount reaches the dialog as 0 anyway',
            },
            {
                file: 'src/components/ui/mint/ConfirmPushDialog.tsx',
                line: 43,
                excerpt:
                    '`Send ${localEditCount} token changes to Figma? This will overwrite Figma variables with ${localEditCount} local token ${plural}. Continue?`',
                note: 'would render "Send 0 token changes..." if the dialog ever opened with localEditCount=0',
            },
        ],
        observed:
            'TokenManager wires `localEditCount={0}` to both `<TokenHealthBar>` (which disables the Push button in the cluster) and `<ConfirmPushDialog>` (which would display "Send 0 token changes..." copy if opened). 155 LOC of production code (ConfirmPushDialog + its handler flow + the Push button branch) + 8 passing tests in ConfirmPushDialog.test.tsx exercise a code path that cannot fire in the live app today. The Push button is permanently disabled until a future commit wires `flint_sync_check.localEditCount` through.',
        rationale:
            'Unreachable production code is a red-flag smell: (a) it accumulates maintenance burden (refactors must keep passing the dialog tests even though the dialog never renders live), (b) the integration validator SHIPped on a TODO that is not tracked anywhere I can see except the inline comment, and (c) the `ConfirmPushDialog` test at line 45 asserts copy that cannot be shown to a user. This is a classic "feature merged but permanently gated" defect — the Phase 2 contract §Risks did not call it out, and the impact-map does not list the `flint_sync_check` wiring work item.',
        proposedFix:
            'Either (a) hide the Push button entirely until `localEditCount` is sourced (safer — matches the Pull+Connect gating model already present for disconnected state), or (b) file an explicit follow-up task ticket referenced by the TODO comment and listed in HANDOFF.md. The current "render disabled with count=0" state is the worst of both worlds: the button draws attention (it\'s visible) but doesn\'t work.',
        scope: 'one-file',
        status: 'open',
    },
    {
        id: 'WARN-3',
        title: 'Auto-revert effect missing setViewMode in dep array but closure still stale-safe',
        severity: 'warning',
        evidence: [
            {
                file: 'src/components/ui/TokenManager.tsx',
                line: 349,
                excerpt:
                    "useEffect(() => {\n    if (viewMode === 'drift' && driftedTokens.length === 0) {\n        setViewMode('grid')\n    }\n}, [viewMode, driftedTokens.length])",
            },
        ],
        observed:
            'The auto-revert `useEffect` depends on `viewMode` and `driftedTokens.length` but not on `setViewMode`. React\'s `useState` setter is stable, so this is not an actual stale-closure bug — but the lint rule `react-hooks/exhaustive-deps` would complain if it were enabled, and the effect reads `driftedTokens.length` which is derived from an object reference that changes on every `useTokenUsage` rescan.',
        rationale:
            'No runtime bug today because: (a) React guarantees setState identity stability, and (b) the hook rescans on `tokens.length` rather than `driftedTokens` identity, so `driftedTokens.length` is a stable number. But the effect is subtly over-reactive: any time the token list re-renders, `driftedTokens` becomes a new array and `driftedTokens.length` may or may not change. The test `auto-reverts viewMode from drift to grid when drift empties` exercises the happy path but does not assert that the effect does not thrash when `driftedTokens` rebuilds with the same contents. A hostile data shape (e.g. drift rescanning as `[] → [] → []`) would fire the effect body 3 times in a row (all no-ops because `viewMode === "grid"` already), which is benign but noisy.',
        proposedFix:
            'Add a stable trigger: `useEffect(() => { if (viewMode === "drift" && driftedTokens.length === 0) setViewMode("grid") }, [viewMode, driftedTokens.length])`. Already correct as written — this finding is "no action needed, but document the intent in a comment so the next maintainer doesn\'t add `driftedTokens` (the array) to the dep array and introduce the thrash."',
        scope: 'one-line',
        status: 'open',
    },
    {
        id: 'WARN-4',
        title: 'mcpCallToolSchema accepts any record<unknown> — no per-tool arg validation at preload',
        severity: 'warning',
        evidence: [
            {
                file: 'shared/ipc-validators.ts',
                line: 261,
                excerpt:
                    "'mcp:call-tool': {\n    payload: z.tuple([\n      z.string().min(1),\n      z.record(z.unknown()),\n    ]),\n    response: z.unknown(),\n},",
            },
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 145,
                excerpt: "const result = await callTool(toolName, args)",
                note: 'hook forwards Record<string, unknown> to the preload boundary with no narrow type',
            },
        ],
        observed:
            'The `mcp:call-tool` Zod schema validates the tuple shape (string toolName, object args) but the `args` record is `z.record(z.unknown())` — no per-tool schema, no discriminated union on `toolName`. A compromised renderer (or a typo in useSyncActions.ts such as `mcp.callTool("flint_resolve_all", { stratergy: "prefer-figma" })`) sails through validation and reaches `mcpClient.callTool` as malformed input. This is documented in the schema comment as intentional ("Response is the MCP tool\'s raw output — intentionally unknown here because the shape varies per tool") but the justification only covers the response side.',
        rationale:
            'The Phase 2 contract §2.4 IPC Channel Contracts claims `validator: \'mcpCallToolSchema\'` gives the channel runtime validation. In practice, the validator catches "args is null" and "toolName is empty string" — both trivial misuses — but not the two failure modes the renderer is likely to produce: (a) a renaming drift where the renderer still calls a stale tool name, and (b) misspelled keys in the args object. For Phase 2 these blow up at the MCP tool level with "no such tool" / "arg missing", not silently — so practical impact is low, but the contract\'s security claim is weaker than advertised. The CLAUDE.md Architectural-Anti-Patterns note calls this "Design by Contract at the process boundary" which implies narrower guarantees.',
        proposedFix:
            'Phase 3 follow-up: split `mcp:call-tool` into per-tool schemas, or introduce a discriminated union keyed on `toolName` with a Zod schema per known tool. For now, document the intentional looseness inline in useSyncActions.ts so maintainers know the preload bridge is not a backstop for tool arg correctness.',
        scope: 'one-file',
        status: 'open',
    },
    {
        id: 'SUG-1',
        title: 'SyncActionCluster disabled-state matrix has no in-flight callback suppression on disconnected Connect',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/components/ui/mint/SyncActionCluster.tsx',
                line: 52,
                excerpt:
                    'onClick={onConnect}\ndisabled={syncOp === \'connect\'}\ndata-testid="sync-connect"',
            },
        ],
        observed:
            'The disconnected Connect button disables itself only when `syncOp === "connect"`. If syncOp is `"pull"` (implausible but theoretically possible since disconnect can happen mid-op), the Connect button stays enabled and a click fires `onConnect` which dispatch-serializes inside the hook (returns silently). User sees no feedback.',
        rationale:
            'Minor polish — the serialization guard catches this at the hook layer (no double-dispatch). But the button doesn\'t communicate the block. The connected cluster uses `opInFlight = syncOp !== null` to disable all three buttons; the disconnected branch should do the same.',
        proposedFix:
            'Change `disabled={syncOp === "connect"}` to `disabled={syncOp !== null}` for symmetry with the connected cluster.',
        scope: 'one-line',
        status: 'open',
    },
    {
        id: 'SUG-2',
        title: 'dispatch() setLastError(null) on success is after the await — very short window of stale error',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 174,
                excerpt:
                    '// Success path — clear any prior error, emit a success toast,\n// fire the onAfterSync callback so consumers can refetch.\nsetLastError(null)\npushNotification({ ... })',
            },
        ],
        observed:
            'On success, `setLastError(null)` only fires after the `await callTool(...)` resolves. A consumer reading `lastError` during the in-flight window (e.g. a persistent badge rendered from `lastError.persistent`) sees the previous error for the duration of the tool call.',
        rationale:
            'Micro-UX concern only. A user who clicks Pull after an auth-expired error sees the persistent chip stay visible until the new call returns. Arguably correct (the chip should persist while the retry is still indeterminate) — but not documented either way. The contract testBoundary `useSyncActions.pull clears lastError` only asserts the post-success state.',
        proposedFix:
            'Document the behavior in useSyncActions JSDoc: "lastError is cleared only on a subsequent successful call, not pre-emptively on dispatch. This is intentional — the persistent chip remains visible while retry is indeterminate." Or clear eagerly inside `setSyncOp(op)` if the UX team prefers the chip to disappear at click time.',
        scope: 'one-file',
        status: 'open',
    },
    {
        id: 'SUG-3',
        title: 'ConfirmResolveDialog radiogroup has sr-only legend but no visible label',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/components/ui/mint/ConfirmResolveDialog.tsx',
                line: 85,
                excerpt:
                    '<div\n    role="radiogroup"\n    aria-labelledby={radiogroupId}\n    data-testid="confirm-resolve-strategy-group"\n    className="flex flex-col gap-2"\n>\n    <span id={radiogroupId} className="sr-only">\n        Resolution strategy\n    </span>',
            },
        ],
        observed:
            'The radiogroup is labeled "Resolution strategy" via an `sr-only` span. Sighted users see only the radio labels ("Prefer Figma" / "Prefer Local") preceded by the prose "Choose a strategy to apply to all pending conflicts." The radiogroup semantic boundary is invisible in the UI.',
        rationale:
            'Not an a11y violation — the radiogroup has an accessible name. But sighted users don\'t see a heading above the radios, which is the standard form pattern. Counsel-style forms in the codebase use visible field legends; this diverges without stated reason.',
        proposedFix:
            'Either (a) promote the prose paragraph to a visible `<legend>`-style label bound to the radiogroup, or (b) add a visible "Strategy" heading above the options. Low priority — this is a polish item, not a bug.',
        scope: 'one-line',
        status: 'open',
    },
    {
        id: 'SUG-4',
        title: 'TokenManager prop drilling through TokenHealthBar — context would simplify, but size is tractable',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/components/ui/TokenManager.tsx',
                line: 685,
                excerpt:
                    '<TokenHealthBar\n    totalTokens={tokens.length}\n    figmaConnected={figmaConnected}\n    usageFileCount={usageFileCount}\n    health={tokenHealth}\n    localEditCount={0}\n    pendingConflictCount={tokenHealth.buckets.pendingConflicts}\n    syncOp={syncActions.syncOp}\n    onPull={handlePull}\n    onPush={handlePush}\n    onResolve={handleResolve}\n    onConnect={handleConnect}\n/>',
            },
            {
                file: 'src/components/ui/TokenHealthBar.tsx',
                line: 239,
                excerpt:
                    'onPull={onPull ?? (() => {})}\nonPush={onPush ?? (() => {})}\nonResolve={onResolve ?? (() => {})}',
                note: 'defensive defaults allow TokenHealthBar to render without Phase 2 wiring — pragmatic or a smell?',
            },
        ],
        observed:
            'TokenManager passes 12 props to TokenHealthBar, 8 of which are Phase 2 sync-related. TokenHealthBar forwards 8 of those unchanged to SyncActionCluster. The `onPull ?? (() => {})` pattern at TokenHealthBar:239 masks a misconfiguration where a caller forgets to wire onPull but `hasSyncCluster` still evaluates true.',
        rationale:
            'Prop drilling is fine at this depth (2 hops) and 12 props is below the "extract a context" threshold. The defensive `?? (() => {})` fallbacks are pragmatic but hide configuration errors — a caller who forgets to pass onPull sees a working-looking Pull button that does nothing. This is how the Push button is permanently broken today (WARN-2).',
        proposedFix:
            'Either (a) remove the `?? (() => {})` fallbacks and let the types enforce the wiring (onPull becomes required when hasSyncCluster is true), or (b) introduce a `SyncActionContext` provider that TokenHealthBar and future consumers read from. Neither is urgent for Phase 2.',
        scope: 'one-file',
        status: 'open',
    },
    {
        id: 'SUG-5',
        title: 'setReady useEffect runs once but could miss late-arriving window.flintAPI updates',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/hooks/useSyncActions.ts',
                line: 111,
                excerpt:
                    'useEffect(() => {\n    // Re-evaluate once on mount (covers cases where the window.flintAPI\n    // shim is attached asynchronously in dev/test).\n    if (typeof window !== \'undefined\' && typeof window.flintAPI?.mcp?.callTool === \'function\') {\n        setReady(true)\n    }\n}, [])',
            },
        ],
        observed:
            'The `ready` state is seeded by the initial useState lazy initializer AND by a post-mount useEffect that runs once with an empty dep array. If `window.flintAPI` attaches later than the first effect tick (e.g. asynchronous preload in a test harness that initializes window.flintAPI after component mount), `ready` stays `false` forever because the effect never re-runs.',
        rationale:
            'Low practical impact — the Phase 2 test setup already populates window.flintAPI in beforeEach, and production preload attaches synchronously before React mounts. But the comment in the code ("covers cases where the window.flintAPI shim is attached asynchronously") promises a more general guarantee than the implementation provides.',
        proposedFix:
            'Either strengthen the JSDoc to say "evaluated once on mount — does not re-evaluate if window.flintAPI is attached later" or replace the effect with a small polling loop bounded by a retry limit. Given the test harness works today, prefer the documentation fix.',
        scope: 'one-line',
        status: 'open',
    },
];

const counts = countFindings(findings);
const verdict = deriveVerdict(findings, 'code');

export const REPORT: ReviewReport = {
    meta: {
        phase: 'MINT.5.2',
        dimension: 'code',
        reviewer: 'flint-code-reviewer',
        date: '2026-04-18',
        round: 1,
        scope: [
            '11 production files (1 new hook, 6 new components, 3 modified components, 1 modified shared schema)',
            '9 test files — 105 new tests',
            'Binding contract: MINT.5-phase2.contract.ts + .md',
        ],
        markdownFile: 'mint-phase2-code-review-2026-04-18.md',
    },
    rubric: [
        {
            criterion: 'npx tsc --noEmit exits 0',
            result: 'pass',
            evidence: 'ran with no output; zero errors',
        },
        {
            criterion: 'All Phase 2 vitest suites pass (useSyncActions + SyncActionCluster + 2 dialogs + TokenDriftRow + DriftGroupSection + ConnectFigmaEmptyState + TokenGrid.drift-tab + TokenManager.phase2)',
            result: 'pass',
            evidence: '67 + 38 = 105 tests pass across 9 files; 0 failures, 0 skipped',
        },
        {
            criterion: 'No Node.js module imports anywhere in src/ (fs, path, child_process, sqlite, @anthropic-ai/sdk)',
            result: 'pass',
            evidence: 'grep for "require(fs|path|...)" in src/hooks/useSyncActions.ts returned no matches',
        },
        {
            criterion: 'No window.flintAPI calls inside Zustand store actions (belongs in hooks/components/services)',
            result: 'pass',
            evidence: 'useSyncActions is a hook, not a store. grep on src/store/ for useSyncActions returned no matches.',
        },
        {
            criterion: 'All renderer→main IPC channels declare a Zod validator in shared/ipc-validators.ts',
            result: 'pass',
            evidence: 'mcp:call-tool schema added at shared/ipc-validators.ts:261 with named export mcpCallToolSchema at line 294',
        },
        {
            criterion: 'Commandment 4 (Local-First) — no external URLs introduced in Phase 2 components',
            result: 'pass',
            evidence: 'ConnectFigmaEmptyState renders inline SVG FigmaMark, no fetch. TokenDriftRow renders colors via inline style only.',
        },
        {
            criterion: 'Commandment 5 (A11y) — dialogs have role="dialog" + aria-modal="true" + FocusTrap; drift row has role="button" with accessible name',
            result: 'pass',
            evidence: 'ConfirmPushDialog:59, ConfirmResolveDialog:60, TokenDriftRow:111 all conform. Tests assert role + aria-modal.',
        },
        {
            criterion: 'Commandment 12 (Atomic Queuing) — sync writes downstream of MCP tools, not renderer-local',
            result: 'n/a',
            evidence: 'No writes in Phase 2 renderer; all persistence is downstream of mcp:call-tool → electron/main.ts → FileTransactionManager',
        },
        {
            criterion: 'Commandment 14 (Bypass Prohibition) — zero fs/git imports in Phase 2 renderer files',
            result: 'pass',
            evidence: 'grep for fs/git imports in useSyncActions, SyncActionCluster, dialogs, drift row, empty state: no matches',
        },
        {
            criterion: 'New structural UI has test coverage with meaningful assertions (not just mount-doesn\'t-crash)',
            result: 'pass',
            evidence: 'useSyncActions.test covers serialization race, error classification, clearance-on-success, confirmPush/confirmResolve gates — depth is good',
        },
        {
            criterion: 'Integration validator SHIP verdict is concurred',
            result: 'pass',
            evidence: 'Integration validator called out the localEditCount=0 TODO; this review re-surfaces it as WARN-2 but does not block ship',
        },
        {
            criterion: 'MCP error classification uses a structured status field (not keyword substring match)',
            result: 'fail',
            evidence: 'useSyncActions.ts:68 uses lower.includes("auth-expired") etc. on human-readable error text — WARN-1',
        },
        {
            criterion: 'Production code paths are reachable — no rendered-but-unwireable components',
            result: 'fail',
            evidence: 'ConfirmPushDialog receives localEditCount={0} hardcoded at TokenManager.tsx:885; Push flow permanently disabled — WARN-2',
        },
        {
            criterion: 'IPC payload schemas narrow per-tool args (not a catch-all z.record(z.unknown()))',
            result: 'fail',
            evidence: 'mcpCallToolSchema at shared/ipc-validators.ts:261 accepts any record — WARN-4',
        },
    ],
    findings,
    counts,
    verdict,
    scopeCoverage: {
        reviewed: [
            'src/hooks/useSyncActions.ts',
            'src/components/ui/mint/SyncActionCluster.tsx',
            'src/components/ui/mint/ConfirmPushDialog.tsx',
            'src/components/ui/mint/ConfirmResolveDialog.tsx',
            'src/components/ui/mint/TokenDriftRow.tsx',
            'src/components/ui/mint/DriftGroupSection.tsx',
            'src/components/ui/mint/ConnectFigmaEmptyState.tsx',
            'src/components/ui/TokenHealthBar.tsx (modified)',
            'src/components/ui/TokenGrid.tsx (modified)',
            'src/components/ui/TokenManager.tsx (modified)',
            'shared/ipc-validators.ts (mcp:call-tool addition)',
            'src/hooks/__tests__/useSyncActions.test.ts',
            'src/components/ui/__tests__/SyncActionCluster.test.tsx',
            'src/components/ui/mint/__tests__/ConfirmPushDialog.test.tsx',
            'src/components/ui/mint/__tests__/ConfirmResolveDialog.test.tsx',
            'src/components/ui/mint/__tests__/TokenDriftRow.test.tsx',
            'src/components/ui/mint/__tests__/DriftGroupSection.test.tsx',
            'src/components/ui/mint/__tests__/ConnectFigmaEmptyState.test.tsx',
            'src/components/ui/__tests__/TokenGrid.drift-tab.test.tsx',
            'src/components/ui/__tests__/TokenManager.phase2.test.tsx',
            '.flint-context/contracts/MINT.5-phase2-contract.md',
            '.flint-context/contracts/MINT.5-phase2.contract.ts',
        ],
        skipped: [
            'electron/main.ts mcp:call-tool handler — pre-existing; not modified in Phase 2',
            'server/index.ts web parity — Phase 2 contract §R9 asserts inherited parity; not re-verified here',
            'flint-mcp/src/tools/* MCP tool handlers — out of Phase 2 scope (contract §Non-Goals)',
            'notificationStore.ts — consumed by hook but not modified',
            'FocusTrap.tsx — consumed by both dialogs but pre-existing and unchanged',
            'UX / visual review — handled by parallel UX reviewer',
            'Security / threat model review — handled by parallel security reviewer',
        ],
    },
};
