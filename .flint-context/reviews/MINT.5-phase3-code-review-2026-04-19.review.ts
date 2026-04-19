/**
 * MINT.5 Phase 3 — Code Review (engine + state + types scope)
 *
 * Reviewer: flint-code-reviewer
 * Round: 1 (Cheaper-Pilot ceremony — pre-scoped review)
 * Out of scope (covered by parallel reviewers): UI components, IPC/cross-process
 * parity, shared/mcp-allowed-tools.ts.
 */

import {
    countFindings,
    deriveVerdict,
    type ReviewFinding,
    type ReviewReport,
} from '../../shared/review-schema'

const findings: ReviewFinding[] = [
    {
        id: 'SUG-1',
        title: 'Bench-driven invariant assertion has only 1 sample, undermining p95 confidence',
        severity: 'suggestion',
        evidence: [
            {
                file: 'shared/__tests__/mcp-classification.bench.ts',
                line: 109,
                excerpt: "{ iterations: 1, warmupIterations: 1 }",
                note: 'The expect(p95).toBeLessThan(5) bench runs only 1 outer iteration.',
            },
        ],
        observed:
            'The "p95 < 5ms" assertion bench at line 88-110 runs the 1000-call timing loop only once (iterations: 1, warmupIterations: 1). p95 across 1000 calls is computed inside that single run and asserted, but a single sample makes the invariant flaky on cold caches.',
        rationale:
            'Contract invariant `classification-attach-overhead` requires `< 5ms per call at p95` measured by a 1000-call loop. The implementation does measure 1000 calls, so it satisfies the letter of the invariant — but a one-shot bench can flake under CI noise. The other bench blocks (lines 40-79) correctly use 50 / 1000 iterations, so reliability is partially covered by them.',
        proposedFix:
            'Change iterations to 5–10 on the assertion bench, or convert the assertion to a plain `it()` test that loops the timing block 3× and asserts the median p95 < 5ms.',
        scope: 'one-line',
        status: 'open',
    },
    {
        id: 'SUG-2',
        title: 'useSyncStaleness mountedRef set true inside effect — minor stale-state risk on rapid disabled→enabled flips',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/hooks/useSyncStaleness.ts',
                line: 98,
                excerpt: 'mountedRef.current = true',
                note: 'mountedRef is reset to true inside useEffect, after a previous cleanup may have set it false.',
            },
            {
                file: 'src/hooks/useSyncStaleness.ts',
                line: 105,
                excerpt:
                    "if (!enabled) {\n  ...\n  return () => { mountedRef.current = false }\n}",
                note: 'Disabled branch returns a cleanup that flips mountedRef false.',
            },
        ],
        observed:
            'The polling effect re-runs on `enabled`/`pollIntervalMs` change. Each run sets mountedRef.current = true at the top, and each cleanup sets it false. Because the effect includes a disabled-path early return (line 100-108) whose cleanup also flips mountedRef false, an enabled→disabled→enabled toggle within one render pass relies on React running the new effect before any in-flight `runPoll()` resolves. This works today but is fragile.',
        rationale:
            'The mountedRef pattern is conventionally tied to component mount/unmount, not to effect re-runs. Re-using it for "is this effect generation still active" couples two concerns. Phase 3 ships only one consumer (TokenManager) and the risk is low, but the pattern is worth tightening before more consumers join (R11 already calls this out).',
        proposedFix:
            'Introduce a per-effect `cancelledRef = { current: false }` created inside the effect; check `cancelledRef.current` in `runPoll` instead of `mountedRef.current`. Keep `mountedRef` for true unmount tracking (set false only in the unmount cleanup tied to an empty-deps useEffect).',
        scope: 'one-file',
        status: 'open',
    },
    {
        id: 'SUG-3',
        title: 'Non-null assertion on optional ref bypasses TS guard',
        severity: 'suggestion',
        evidence: [
            {
                file: 'src/hooks/__tests__/useSyncStaleness.test.ts',
                line: 26,
                excerpt: 'window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>',
            },
            {
                file: 'src/hooks/__tests__/useEmitTokens.test.ts',
                line: 24,
                excerpt: 'window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>',
            },
        ],
        observed:
            'Both test files use `mcp!` non-null assertion + `as ReturnType<typeof vi.fn>` cast in their `getCallToolMock()` helper. There is no comment explaining why the cast is needed.',
        rationale:
            'Per the rubric (Type discipline): casts without explanation are warning-worthy. The cast is benign here because the global test setup wires up the mock, but a one-line comment documenting the assumption would satisfy the project convention ("no `as any` casts without a comment").',
        proposedFix:
            'Add a comment above getCallToolMock(): "// Mock attached by src/components/__tests__/setup.ts; non-null assertion is safe in test env."',
        scope: 'one-line',
        status: 'open',
    },
]

const REPORT: ReviewReport = {
    meta: {
        phase: 'MINT.5-phase3',
        dimension: 'code',
        reviewer: 'flint-code-reviewer',
        date: '2026-04-19',
        round: 1,
        scope: [
            'Engine helpers: shared/syncStaleness.ts, shared/mcp-classification.ts',
            'Renderer hooks: useEmitTokens, useSyncStaleness, useSyncActions (Phase 3 delta)',
            'Renderer store: syncStalenessStore',
            'Type extension: src/types/flint-api.d.ts (MCPCallResult.classification)',
            'Tests for the above',
        ],
        markdownFile: undefined,
    },
    rubric: [
        {
            criterion:
                'shared/syncStaleness.ts is pure (no fs, store, React, or window access)',
            result: 'pass',
        },
        {
            criterion:
                'shared/mcp-classification.ts is pure (no I/O, single-source classifier)',
            result: 'pass',
        },
        {
            criterion:
                'MCPCallResult.classification is optional in src/types/flint-api.d.ts (R3 graceful degrade)',
            result: 'pass',
        },
        {
            criterion:
                'MCPCallClassification union exported from src/types/flint-api.d.ts and matches contract verbatim',
            result: 'pass',
        },
        {
            criterion:
                'useSyncActions reads classification from result envelope and preserves keyword backstop when classification is undefined',
            result: 'pass',
            evidence:
                'src/hooks/useSyncActions.ts:92-110 — isPersistentError takes classification first, falls back to keyword check only when undefined.',
        },
        {
            criterion:
                'syncStalenessStore: no cross-store imports, no IPC in actions, per-session lifetime (no localStorage)',
            result: 'pass',
        },
        {
            criterion:
                'useSyncStaleness clears interval on unmount (invariant: staleness-poll-cleanup, vi.getTimerCount() === 0)',
            result: 'pass',
            evidence:
                'src/hooks/useSyncStaleness.ts:176-180 cleanup; test src/hooks/__tests__/useSyncStaleness.test.ts:238-257 verifies vi.getTimerCount() === 0.',
        },
        {
            criterion:
                'useSyncStaleness uses mountedRef + refs to avoid stale closures inside polling interval',
            result: 'pass',
        },
        {
            criterion:
                'useEmitTokens serializes via emitOpRef and gates write mode on confirmWrite when provided',
            result: 'pass',
            evidence:
                'src/hooks/useEmitTokens.ts:119,129-132 — ref guard + confirmWrite gate.',
        },
        {
            criterion:
                'isSyncStale handles null, future, and NaN inputs without throwing',
            result: 'pass',
        },
        {
            criterion:
                'classifyMCPError precedence: auth-expired > rate-limited > network-error > tool-error; success → unknown',
            result: 'pass',
        },
        {
            criterion:
                'classification-attach-overhead invariant (< 5ms p95) is measured by the bench file',
            result: 'pass',
            evidence:
                'shared/__tests__/mcp-classification.bench.ts:86-111 measures p95 across 1000 calls; see SUG-1 for sample-size note.',
        },
        {
            criterion:
                'staleness-banner-zero-when-fresh invariant (= 0 banner mounts across 100 advances) covered by hook test loop',
            result: 'pass',
            evidence:
                'src/hooks/__tests__/useSyncStaleness.test.ts:152-181',
        },
        {
            criterion:
                'No `any`, no `@ts-ignore` introduced in scope files',
            result: 'pass',
        },
        {
            criterion:
                'No Node.js imports (fs/path/child_process) in any src/ file in scope',
            result: 'pass',
        },
        {
            criterion:
                'Hook lifecycle: mountedRef guards prevent state updates after unmount in useEmitTokens and useSyncStaleness',
            result: 'pass',
        },
        {
            criterion:
                'Commandment 12 (Atomic Queuing): store transitions are single set() calls; emitOp/syncOp transitions are atomic',
            result: 'pass',
        },
        {
            criterion:
                'Commandment 14 (Bypass Prohibition): no direct fs/git imports in renderer-side scope files',
            result: 'pass',
        },
        {
            criterion:
                'Phase 2 keyword-fallback backstop preserved in useSyncActions for unclassified errors',
            result: 'pass',
            evidence:
                'src/hooks/useSyncActions.ts:100-109 keyword check fires only when classification === undefined; test useSyncActions.test.ts:416-431 confirms persistent=false on unclassified non-keyword text.',
        },
        {
            criterion:
                'No dead code or unused exports introduced',
            result: 'pass',
        },
    ],
    findings,
    counts: countFindings(findings),
    verdict: deriveVerdict(findings, 'code'),
    scopeCoverage: {
        reviewed: [
            'shared/syncStaleness.ts',
            'shared/mcp-classification.ts',
            'src/hooks/useEmitTokens.ts',
            'src/hooks/useSyncStaleness.ts',
            'src/hooks/useSyncActions.ts (Phase 3 delta)',
            'src/store/syncStalenessStore.ts',
            'src/types/flint-api.d.ts (MCPCallResult.classification + MCPCallClassification union)',
            'shared/__tests__/syncStaleness.test.ts',
            'shared/__tests__/mcp-classification.test.ts',
            'shared/__tests__/mcp-classification.bench.ts',
            'src/hooks/__tests__/useEmitTokens.test.ts',
            'src/hooks/__tests__/useSyncStaleness.test.ts',
            'src/store/__tests__/syncStalenessStore.test.ts',
            'src/hooks/__tests__/useSyncActions.test.ts (Phase 3 delta)',
        ],
        skipped: [
            'src/components/ui/mint/* — UX reviewer scope',
            'shared/ipc-validators.ts — security reviewer scope',
            'electron/preload.ts, electron/mcpClient.ts, server/mcpClient.ts, server/index.ts — security reviewer scope (cross-process parity + IPC validation)',
            'shared/mcp-allowed-tools.ts — security reviewer scope',
            'electron/__tests__/* and server/__tests__/* — security reviewer scope',
        ],
    },
}

export { REPORT }
