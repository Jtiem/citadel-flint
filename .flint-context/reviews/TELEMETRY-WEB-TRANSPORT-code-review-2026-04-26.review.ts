import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Security pin test exercises a code mirror, not the real handler',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'server/__tests__/telemetryIpc.test.ts',
        line: 107,
        excerpt:
          "function webSetConsent(consentDir: string, payload: unknown): { state: string; ... } { ... }",
        note: 'Mirror function takes consentDir as a parameter and never reads process.env.FLINT_TELEMETRY_SECRET.',
      },
      {
        file: 'server/__tests__/telemetryIpc.test.ts',
        line: 421,
        excerpt: "process.env.FLINT_TELEMETRY_SECRET = SENTINEL",
        note: 'TEL-06 sets the env var…',
      },
      {
        file: 'server/__tests__/telemetryIpc.test.ts',
        line: 432,
        excerpt: "expect(responseBody).not.toContain(SENTINEL)",
        note: '…and asserts the mirror response body does not contain it. The mirror cannot leak it because the mirror does not read it.',
      },
      {
        file: 'server/index.ts',
        line: 3480,
        excerpt: "const webTelemetrySecret = (process.env.FLINT_TELEMETRY_SECRET ?? '').trim()",
        note: 'Real handler captures the secret in a closure at boot. The mirror has no access to that closure.',
      },
    ],
    observed:
      'TEL-06 security pin tests assert that the mirror webReadConsent/webSetConsent response bodies do not contain FLINT_TELEMETRY_SECRET. The mirror functions never reference process.env.FLINT_TELEMETRY_SECRET at all, so the assertion passes trivially regardless of whether the real handler in server/index.ts:3595–3611 leaks the secret.',
    rationale:
      'The contract invariant "secret-never-crosses-process-boundary" is not actually pinned by these tests. A future refactor that adds, e.g., a debug log or stack-trace inclusion to the real handler would not be caught.',
    proposedFix:
      'Either (a) extract consent read/write into a pure exported function that both the real handler and the test import, or (b) implement one of the live HTTP/WS round-trip placeholders in server/__tests__/index.test.ts:765–774 to exercise telemetry:get-consent through the real request pipeline.',
    commandment: 14,
  },
  {
    id: 'WARN-2',
    title: 'Mirror divergence: real emit sites can be deleted without test failure',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'server/__tests__/telemetryIpc.test.ts',
        line: 64,
        excerpt:
          "// These are close-mirror functions. If the real handler in server/index.ts changes, update these mirrors and this comment.",
        note: 'Mirror approach acknowledged in the test file but no enforcement mechanism.',
      },
      {
        file: 'server/__tests__/telemetryIpc.test.ts',
        line: 146,
        excerpt: 'async function simulateMcpCallTool(toolName, mcpResult, webEmit) { … }',
        note: 'Mirror of the real mcp:call-tool handler emit logic — TEL-01 tests run against this, not against server/index.ts.',
      },
      {
        file: 'server/index.ts',
        line: 2866,
        excerpt: "webEmit('mcp.tool_called', { toolName })",
        note: 'Real emit site — if deleted, every TEL-01 test still passes because TEL-01 calls the simulator.',
      },
      {
        file: '.flint-context/contracts/TELEMETRY-WEB-TRANSPORT.contract.md',
        line: 128,
        excerpt:
          "R5 | webEmit('mcp.tool_called') is removed from the mcp:call-tool handler — web users only emit app.launched and session.ended.",
        note: 'Contract explicitly identifies this risk and says the mitigation is a parity test — but the parity test is the mirror.',
      },
    ],
    observed:
      'All 21 telemetryIpc.test.ts tests run against locally-defined mirror functions, not against the real server/index.ts handlers. The contract\'s Risk R5 ("webEmit removed from mcp:call-tool handler") is not actually mitigated by these tests — deleting line 2866 would not fail any test.',
    rationale:
      'This is the established pattern in server/__tests__/ (live tests are it.todo because startServer() is monolithic), but the new tests should not be flagged as the R5 mitigation when they cannot fail when the emit site is deleted.',
    proposedFix:
      'Add a static-analysis test that reads server/index.ts as text and asserts it contains the four required webEmit call strings: webEmit(\'mcp.tool_called\', webEmit(\'audit.completed\', webEmit(\'app.launched\', webEmit(\'session.ended\'. Cheapest possible backstop. Or implement one of the live round-trip it.todo entries.',
  },
  {
    id: 'WARN-3',
    title: 'TEL-07 docblock contradicts the assertion (says fileCount=0, asserts =1)',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'server/__tests__/telemetryIpc.test.ts',
        line: 467,
        excerpt:
          "// TEL-07 — audit.completed defaults: tool result with no parseable JSON produces fileCount=0 and violationCount=0.",
        note: 'Docblock says fileCount=0.',
      },
      {
        file: 'server/__tests__/telemetryIpc.test.ts',
        line: 488,
        excerpt: 'expect(payload.fileCount).toBe(1)',
        note: 'Assertion says fileCount=1.',
      },
      {
        file: 'server/index.ts',
        line: 2881,
        excerpt:
          'fileCount = typeof parsed.fileCount === \'number\' ? parsed.fileCount : 1',
        note: 'Real handler defaults to 1, matching the assertion. The docblock is wrong.',
      },
    ],
    observed:
      'The TEL-07 section header comment says "produces fileCount=0 and violationCount=0", but the assertion correctly checks fileCount=1 (matching the real handler). The misleading comment is repeated near line 8 of the file in the test file\'s top-of-file docblock.',
    rationale:
      'A future maintainer triaging a failing TEL-07 will see "expected 0" in the comment and "expected 1" in the assertion and lose confidence in which is correct. The contract\'s edge-case prose is also wrong relative to the real implementation.',
    proposedFix:
      'Update the TEL-07 docblock comment to read "produces fileCount=1 (default when key missing) and violationCount=0". Optionally update the contract markdown to match.',
  },
  {
    id: 'SUG-1',
    title: 'Inline import-type for ConsentRecord could be hoisted to top of file',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/adapters/web-api.ts',
        line: 613,
        excerpt:
          "getConsent: () => invoke('telemetry:get-consent') as Promise<import('../types/flint-api').ConsentRecord>,",
      },
      {
        file: 'src/adapters/web-api.ts',
        line: 615,
        excerpt:
          "invoke('telemetry:set-consent', payload) as Promise<import('../types/flint-api').ConsentRecord>,",
      },
      {
        file: 'src/adapters/web-api.ts',
        line: 13,
        excerpt: "import { validateIPC, mcpCallToolSchema } from '../../shared/ipc-validators'",
        note: 'File already has top-of-file imports.',
      },
    ],
    observed:
      'The new namespace uses inline import("../types/flint-api").ConsentRecord twice. No other namespace in this file uses inline import() types — they use either inline structural literals or unknown.',
    rationale:
      'The contract requires Phase 2 to consume ConsentRecord without introducing new types, which the inline form satisfies. But hoisting to a top-of-file import type matches the file\'s conventions and reads more naturally.',
    proposedFix:
      "Add 'import type { ConsentRecord, TelemetrySetConsentPayload } from \"../types/flint-api\"' near line 13, then simplify the casts to 'as Promise<ConsentRecord>'. Also type the setConsent parameter as TelemetrySetConsentPayload to match TelemetryConsentDialog.tsx:33.",
  },
  {
    id: 'SUG-2',
    title: 'Global afterEach unconditionally deletes FLINT_TELEMETRY_SECRET',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'server/__tests__/telemetryIpc.test.ts',
        line: 54,
        excerpt:
          "afterEach(() => { ... vi.restoreAllMocks(); delete process.env.FLINT_TELEMETRY_SECRET })",
      },
      {
        file: 'server/__tests__/telemetryIpc.test.ts',
        line: 425,
        excerpt: 'delete process.env.FLINT_TELEMETRY_SECRET',
        note: 'TEL-06 also deletes in its scoped afterEach.',
      },
    ],
    observed:
      'The global afterEach deletes process.env.FLINT_TELEMETRY_SECRET unconditionally after every test. If the developer ran vitest from a shell with the var pre-set (e.g., to debug the live flush sink), the var is wiped from the test process after the first test.',
    rationale:
      'Tests should not mutate environment variables they did not set. This does not break correctness (vitest workers do not propagate env back to the shell), but it is a small papercut for live-debugging workflows.',
    proposedFix:
      "Capture ORIGINAL_TELEMETRY_SECRET = process.env.FLINT_TELEMETRY_SECRET at module load, then in afterEach restore (or delete if originally undefined). Same change in TEL-06's scoped afterEach.",
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'TELEMETRY-WEB-TRANSPORT',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-26',
    round: 1,
    scope: [
      'src/adapters/web-api.ts (telemetry namespace, lines 611–616)',
      'src/adapters/__tests__/web-api.test.ts (18 new tests)',
      'server/__tests__/telemetryIpc.test.ts (NEW, 21 tests)',
      'server/__tests__/index.test.ts (5 new boot smoke tests)',
      'callers: src/App.tsx 786–811, TelemetryConsentDialog.tsx, server/index.ts 3450–3612, src/types/flint-api.d.ts',
    ],
    markdownFile: 'TELEMETRY-WEB-TRANSPORT-code-review-2026-04-26.md',
  },
  rubric: [
    {
      criterion: 'No Node imports in src/adapters/web-api.ts (Commandment 9: Process Boundary)',
      result: 'pass',
    },
    {
      criterion: 'electron/betaTelemetry.ts is not imported by the renderer adapter',
      result: 'pass',
    },
    {
      criterion: 'Channel strings match the server handler keys exactly',
      result: 'pass',
      evidence:
        'telemetry:get-consent and telemetry:set-consent both registered at server/index.ts:3595 and :3599; renderer uses identical strings at web-api.ts:613–615.',
    },
    {
      criterion: 'Zod validators referenced in the contract exist in shared/ipc-validators.ts',
      result: 'pass',
      evidence:
        'telemetryGetConsentResponseSchema (line 581) and telemetrySetConsentPayloadSchema (line 588) both present.',
    },
    {
      criterion: 'New namespace shape conforms to flintAPI.telemetry in src/types/flint-api.d.ts',
      result: 'pass',
      evidence:
        'getConsent: () => Promise<ConsentRecord> and setConsent: (payload) => Promise<ConsentRecord> match d.ts lines 2088–2099.',
    },
    {
      criterion: 'npx tsc --noEmit exits 0',
      result: 'pass',
    },
    {
      criterion: 'All affected test files pass: web-api.test.ts (27/27), telemetryIpc.test.ts (21/21), index.test.ts (64 + 10 todo)',
      result: 'pass',
    },
    {
      criterion: 'Pattern matches sibling namespaces (governance, tokens, baseline) — invoke() routing, no direct fetch',
      result: 'pass',
    },
    {
      criterion:
        'Test coverage exercises the actual server handler logic (not just a mirror)',
      result: 'fail',
      evidence:
        'All 21 tests in telemetryIpc.test.ts run against close-mirror functions; the real handler in server/index.ts is not exercised. See WARN-1 and WARN-2.',
      relatedFindings: ['WARN-1', 'WARN-2'],
    },
    {
      criterion:
        'Test docblocks accurately describe the assertions',
      result: 'fail',
      evidence:
        'TEL-07 docblock says fileCount=0; assertion says fileCount=1. See WARN-3.',
      relatedFindings: ['WARN-3'],
    },
    {
      criterion: 'No `as any` casts or `@ts-ignore` introduced',
      result: 'pass',
    },
    {
      criterion:
        'No new IPC channels added (Phase frozen at v0.3.0-beta.1 per contract section 2)',
      result: 'pass',
    },
    {
      criterion:
        'Wiring complete: App.tsx → getConsent() → showTelemetryConsent → TelemetryConsentDialog → setConsent() → onDecided',
      result: 'pass',
    },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'src/adapters/web-api.ts',
      'src/adapters/__tests__/web-api.test.ts',
      'server/__tests__/telemetryIpc.test.ts',
      'server/__tests__/index.test.ts',
      'src/App.tsx (lines 786–811, 1483–1487)',
      'src/components/ui/TelemetryConsentDialog.tsx',
      'server/index.ts (lines 2855–2894, 3450–3612)',
      'src/types/flint-api.d.ts (telemetry interface, lines 1746–1764, 2088–2099)',
      'shared/ipc-validators.ts (Zod validators, lines 581–588)',
      '.flint-context/contracts/TELEMETRY-WEB-TRANSPORT.contract.md',
    ],
    skipped: [
      'electron/preload.ts — explicit non-goal per contract',
      'electron/main.ts — explicit non-goal per contract',
      'electron/betaTelemetry.ts — explicit non-goal per contract',
      'electron/thumbnailGenerator.ts — pre-existing TSC errors, out of scope',
      'electron/visualAuditor.ts — pre-existing TSC errors, out of scope',
    ],
  },
};
