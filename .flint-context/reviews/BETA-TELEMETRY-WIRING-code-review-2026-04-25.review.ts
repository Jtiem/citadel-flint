import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Web build has no emit sites; server startTelemetry is a no-op stub',
    severity: 'warning',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'server/index.ts',
        line: 3385,
        excerpt: "function startTelemetry(): void { /* no-op for web build — no Electron app module */ }",
        note: 'Web stub never produces events.',
      },
      {
        file: 'server/index.ts',
        note: 'grep for emit("mcp.tool_called"|"audit.completed"|"session.ended") returns 0 matches',
      },
      {
        file: '.flint-context/contracts/BETA-TELEMETRY-WIRING.contract.ts',
        line: 354,
        excerpt: "name: 'web-parity', threshold: '= 0 missing mirrors'",
        note: 'Contract invariant requires same emit sites as electron/main.ts',
      },
    ],
    observed:
      'server/index.ts registers telemetry:get-consent and telemetry:set-consent IPC handlers but startTelemetry() is a no-op and there are no calls to the Electron-side telemetryEmit equivalent at MCP dispatch, audit completion, or session end.',
    rationale:
      'The contract Impact Map and the web-parity invariant explicitly require the web build to mirror the Electron emit sites, not just the IPC surface. Web users accepting consent generates no signal.',
    proposedFix:
      'Port the queue + flush + emit sites into server/index.ts (or extract a shared module that the Electron and web bridges both consume). Alternatively, downgrade the contract by adding an explicit nonGoal and renaming the phase.',
  },
  {
    id: 'WARN-2',
    title: 'migrateLegacyQueue() runs async but the caller does not await it',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 249,
        excerpt: 'void migrateLegacyQueue()',
      },
      {
        file: 'electron/betaTelemetry.ts',
        line: 252,
        excerpt: 'const seeded = loadQueueFromDisk()',
        note: 'Synchronous read fires before the async copyFile resolves.',
      },
      {
        file: 'electron/betaTelemetry.ts',
        line: 235,
        excerpt: 'await copyFile(legacy, dest)',
      },
    ],
    observed:
      'startTelemetry() invokes migrateLegacyQueue() with `void` then calls loadQueueFromDisk() on the next line. The migration uses fs/promises copyFile so the userData queue file does not exist at the time loadQueueFromDisk runs.',
    rationale:
      'Migrated events are not seeded into the in-memory buffer until the *next* boot. The inline comment ("migrate legacy queue before loading the in-memory buffer") describes an ordering the code does not provide. Functional impact is small (events are not lost on disk) but the contract testBoundary "queue path migration" then-clause is technically false within a single startTelemetry call.',
    proposedFix:
      'Replace copyFile with copyFileSync from node:fs and make migrateLegacyQueue a sync function. The file is small and the operation runs once per upgrade — sync I/O at boot is appropriate.',
  },
  {
    id: 'WARN-3',
    title: 'flush() can drop events emitted during the in-flight POST',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 201,
        excerpt: 'const combined = [...diskEvents, ...memoryBuffer]',
      },
      {
        file: 'electron/betaTelemetry.ts',
        line: 207,
        excerpt: 'const res = await net.fetch(TELEMETRY_URL, ...)',
      },
      {
        file: 'electron/betaTelemetry.ts',
        line: 213,
        excerpt: 'memoryBuffer = []',
        note: 'Discards any emit() that ran while the fetch was in flight.',
      },
    ],
    observed:
      'flush() snapshots memoryBuffer at line 201, awaits a network POST, and on success replaces memoryBuffer with []. Any emit() that ran during the await is wiped without being POSTed.',
    rationale:
      'For closed beta scale this is a small leak, but the data-loss window scales with network latency. Fix is a one-line splice rather than reassign.',
    proposedFix:
      'Capture sentLength = memoryBuffer.length before the fetch; on success call memoryBuffer.splice(0, sentLength) instead of memoryBuffer = [].',
  },
  {
    id: 'WARN-4',
    title: 'Whitespace-only FLINT_TELEMETRY_SECRET still sends the header',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 206,
        excerpt: "if (TELEMETRY_SECRET) headers['X-Flint-Secret'] = TELEMETRY_SECRET",
      },
      {
        file: '.flint-context/contracts/BETA-TELEMETRY-WIRING.contract.ts',
        line: 296,
        excerpt: "edgeCases: ['empty string env var → header omitted', 'whitespace-only env var → header omitted']",
      },
      {
        file: 'electron/betaTelemetry.test.ts',
        line: 462,
        excerpt: '// TODO: update assertion to .toBeUndefined() after WARN-5 whitespace-trim is implemented',
      },
    ],
    observed:
      'A whitespace-only FLINT_TELEMETRY_SECRET passes the truthy check at line 206 and is sent verbatim as the X-Flint-Secret header. The test for this case is intentionally permissive and labels itself TODO.',
    rationale:
      'Contract testBoundary listed the edge case explicitly. The implementation diverges from the contract; the test was relaxed instead of failing.',
    proposedFix:
      "Replace the truthy check with a trim: const secret = TELEMETRY_SECRET.trim(); if (secret) headers['X-Flint-Secret'] = secret. Update the test assertion to .toBeUndefined().",
  },
  {
    id: 'SUG-1',
    title: 'Telemetry channels are not registered in the ipcSchemas map',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'shared/ipc-validators.ts',
        line: 39,
        excerpt: 'export const ipcSchemas = { ... }',
        note: 'Map ends at line 269; no telemetry:* keys inside.',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 571,
        excerpt: 'export const telemetryGetConsentResponseSchema = z.object({...})',
        note: 'Defined as standalone exports rather than entries in ipcSchemas.',
      },
    ],
    observed:
      'All other renderer→main channels are entries in the ipcSchemas map; telemetry:get-consent and telemetry:set-consent are only addressable as named exports.',
    rationale:
      'Inconsistent registration pattern. createValidatedInvoker and validateIPC look up by channel name in the map; future contributors grepping for the channel will not find it.',
    proposedFix:
      "Add 'telemetry:get-consent' and 'telemetry:set-consent' as entries in ipcSchemas; redefine the named exports as ipcSchemas['telemetry:*'].response/payload (same pattern as getCoverageSummaryResponseSchema).",
  },
  {
    id: 'SUG-2',
    title: 'Duplicate TIPC-04 test ID in telemetryIpc.test.ts',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'electron/__tests__/telemetryIpc.test.ts',
        line: 187,
        excerpt: "it('TIPC-04 — corrupt consent file returns a fresh unset record', ...)",
      },
      {
        file: 'electron/__tests__/telemetryIpc.test.ts',
        line: 213,
        excerpt: "it('TIPC-04 — Zod response validator accepts the returned record', ...)",
      },
    ],
    observed: 'Two distinct tests share the TIPC-04 ID prefix.',
    rationale:
      'Test IDs trace contract testBoundaries to executable assertions; duplicates break the trace.',
    proposedFix: 'Rename the second to TIPC-22 (or any unused ID).',
  },
  {
    id: 'SUG-3',
    title: 'App.tsx silently hides the consent dialog on getConsent() failure',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'src/App.tsx',
        line: 796,
        excerpt: "console.warn('[Flint] App: telemetry.getConsent failed', err)",
      },
      {
        file: 'src/App.tsx',
        line: 798,
        excerpt: 'setShowTelemetryConsent(false)',
        note: 'Hides dialog rather than retrying.',
      },
    ],
    observed:
      'If window.flintAPI.telemetry.getConsent() rejects, App.tsx logs a warning and treats the user as already decided.',
    rationale:
      'A user who should see the privacy prompt will never see it. Bounded harm because emit is consent-gated, but the privacy posture becomes "no prompt + no events" rather than "prompt + opt-in".',
    proposedFix:
      'Leave showTelemetryConsent as null on error and retry once after 1s, or surface a non-blocking notification.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'BETA.TEL',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-25',
    round: 1,
    scope: [
      'electron/betaTelemetry.ts (full rewrite)',
      'electron/main.ts (IPC handlers + emit sites + startTelemetry)',
      'electron/preload.ts (telemetry namespace)',
      'server/index.ts (web parity)',
      'shared/ipc-validators.ts (Zod schemas)',
      'src/types/flint-api.d.ts (renderer types)',
      'electron/betaTelemetry.test.ts (39 tests)',
      'electron/__tests__/telemetryIpc.test.ts (31 tests)',
      'src/App.tsx (consent dialog mount)',
    ],
    markdownFile: 'BETA-TELEMETRY-WIRING-code-review-2026-04-25.md',
  },
  rubric: [
    { criterion: 'npx tsc --noEmit exits 0', result: 'pass' },
    {
      criterion:
        'Every renderer→main IPC channel has a Zod validator export in shared/ipc-validators.ts',
      result: 'pass',
      evidence:
        'telemetryGetConsentResponseSchema (line 571) and telemetrySetConsentPayloadSchema (line 578) both exported and parsed at preload and main.',
    },
    {
      criterion:
        'EmitFunction is a discriminated union; extra-key payloads fail TSC at object-literal call sites',
      result: 'pass',
    },
    {
      criterion:
        'Stack traces redact homedir for macOS / Linux / Windows',
      result: 'pass',
      evidence: 'Single regex on os.homedir() at electron/betaTelemetry.ts:141-149 covers all three OS conventions.',
    },
    {
      criterion:
        'In-memory buffer is the only emit-time write path; disk persists only on flush/quit/crash',
      result: 'pass',
    },
    {
      criterion:
        'Web parity: every electron/preload.ts telemetry:* channel is mirrored in server/index.ts with the same observable behavior',
      result: 'fail',
      evidence:
        'server/index.ts:3385 startTelemetry is a no-op; no emit sites for mcp.tool_called/audit.completed/session.ended in the web build.',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion:
        'Legacy queue migration runs before the in-memory buffer is seeded',
      result: 'fail',
      evidence:
        'electron/betaTelemetry.ts:249 uses `void migrateLegacyQueue()` (async) followed immediately by sync loadQueueFromDisk(); migrated events appear next session, not this one.',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion:
        'Whitespace-only FLINT_TELEMETRY_SECRET omits the X-Flint-Secret header',
      result: 'fail',
      evidence:
        'electron/betaTelemetry.ts:206 truthy check accepts whitespace; betaTelemetry.test.ts:462 marks the test TODO.',
      relatedFindings: ['WARN-4'],
    },
    {
      criterion:
        'All 12 contract testBoundaries map to executable assertions',
      result: 'pass',
      evidence:
        'betaTelemetry.test.ts (39 tests) + telemetryIpc.test.ts (31 tests) cover the full contract testBoundary list.',
    },
    {
      criterion:
        'No direct fs writes from the renderer; all telemetry I/O goes through window.flintAPI.telemetry',
      result: 'pass',
    },
    {
      criterion:
        'Telemetry channels are registered in the ipcSchemas map for consistent validator lookup',
      result: 'fail',
      evidence:
        'shared/ipc-validators.ts:39-269 ipcSchemas map has no telemetry:* keys; only standalone named exports at lines 571/578.',
      relatedFindings: ['SUG-1'],
    },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'electron/betaTelemetry.ts',
      'electron/betaTelemetry.test.ts',
      'electron/__tests__/telemetryIpc.test.ts',
      'electron/main.ts (telemetry-related sections)',
      'electron/preload.ts (telemetry-related sections)',
      'server/index.ts (telemetry-related sections)',
      'shared/ipc-validators.ts (BETA.TEL section)',
      'src/types/flint-api.d.ts (telemetry namespace)',
      'src/App.tsx (consent dialog mount)',
      '.flint-context/contracts/BETA-TELEMETRY-WIRING-contract.md',
      '.flint-context/contracts/BETA-TELEMETRY-WIRING.contract.ts',
    ],
    skipped: [
      'src/components/ui/TelemetryConsentDialog.tsx — UX reviewer scope',
      'src/components/ui/__tests__/TelemetryConsentDialog.test.tsx — UX reviewer scope',
      'cloudflare-worker/ — out of scope for BETA.TEL (separate Phase A.4)',
    ],
  },
};
