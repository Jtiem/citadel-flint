import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'BLK-1',
    title: 'Spec says telemetry "on by default", code defaults to opt-in (unset → no-op)',
    severity: 'blocking',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 104,
        excerpt: "if (consent.state !== 'accepted') return",
        note: 'Gates emit on accepted only; unset is silent',
      },
      {
        file: 'docs/strategy/BETA-CLOSED-PLAN.md',
        line: 12,
        excerpt: 'Telemetry: on by default, with consent dialog on first launch and a decline toggle',
      },
    ],
    observed:
      'The consent file is initialized to state="unset" on first read, and emit() returns early unless state==="accepted". The plan documents the opposite default ("on by default").',
    rationale:
      'Either the spec or the code must change before ship. The current code is the more privacy-conservative choice but loses launch-and-quit telemetry from users who never click through the consent dialog. The mismatch must be reconciled.',
    proposedFix:
      'Confirm intent with the owner. Recommended: keep code as-is (opt-in) and update plan + consent copy to "Flint Beta will send anonymous usage events..." instead of "sends".',
  },
  {
    id: 'BLK-2',
    title: 'Telemetry module is never imported or invoked',
    severity: 'blocking',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        note: 'Exports startTelemetry, setConsent, getConsent, emit, stopTelemetry — but no caller exists outside the test file.',
      },
      {
        file: 'electron/main.ts',
        note: 'Verified via grep: no import of betaTelemetry.',
      },
      {
        file: 'electron/preload.ts',
        note: 'Verified via grep: no telemetry:* channels exposed via contextBridge.',
      },
    ],
    observed:
      'grep -rn "betaTelemetry|startTelemetry|setConsent" across electron/ and src/ returns only the module itself and its test.',
    rationale:
      'No telemetry will be emitted in production. The consent dialog has no path to set state because the renderer has no IPC channel. The four event sites the spec requires (mcp.tool_called, audit.completed, etc.) have zero callers. Phase 4 cannot be marked complete in this state.',
    proposedFix:
      'Wire startTelemetry() into app.whenReady() in electron/main.ts. Add IPC channels for get/set consent. Add emit() call sites at the audit boundary, MCP tool boundary, and session lifecycle hooks.',
  },
  {
    id: 'BLK-3',
    title: 'IPC channels for consent have no Zod validator and no preload bridge',
    severity: 'blocking',
    scope: 'cross-file',
    commandment: 9,
    status: 'open',
    evidence: [
      {
        file: 'shared/ipc-validators.ts',
        note: 'No telemetry:* schemas defined.',
      },
      {
        file: 'electron/preload.ts',
        note: 'No telemetry methods exposed on window.flintAPI.',
      },
      {
        file: 'src/types/flint-api.d.ts',
        note: 'No type declarations for getConsent / setConsent on the renderer surface.',
      },
    ],
    observed:
      'There is no renderer→main IPC channel for telemetry consent, and therefore no Zod validator either.',
    rationale:
      "The consent dialog (Phase 3.3) lives in the renderer; without IPC + a validator pair, it cannot persist consent. The v2.1 contract hardening rule requires every renderer→main channel to have a validator entry — this is a hard architectural rule.",
    proposedFix:
      'Add TelemetrySetConsentInput and TelemetryConsentOutput Zod schemas in shared/ipc-validators.ts. Register telemetry:get-consent and telemetry:set-consent in main.ts. Expose via contextBridge in preload.ts. Declare on FlintAPI type.',
  },
  {
    id: 'WARN-1',
    title: 'Queue location is ~/.flint/ but spec and uninstall guide say userData/',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 44,
        excerpt: "const dir = path.join(os.homedir(), BRAND.configDir)",
      },
      {
        file: 'docs/strategy/BETA-CLOSED-PLAN.md',
        line: 121,
        excerpt: 'Queue persisted to userData/telemetry-queue.json — survives crashes',
      },
      {
        file: 'docs/strategy/BETA-CLOSED-PLAN.md',
        line: 140,
        excerpt: 'rm -rf ~/Library/Application\\ Support/Flint (macOS) or %APPDATA%\\Flint (Windows) to clear data',
      },
    ],
    observed:
      "BRAND.configDir is '.flint' so the queue lands in ~/.flint/, but the install/uninstall guide tells users to clear ~/Library/Application Support/Flint (the userData path).",
    rationale:
      'Following the documented uninstall procedure leaves consent state and queued events orphaned in ~/.flint/. Also out-of-convention for Electron apps.',
    proposedFix:
      "Replace os.homedir() + BRAND.configDir with app.getPath('userData') for the telemetry directory. Beacon's ~/.flint/context.json is unrelated and can stay where it is.",
  },
  {
    id: 'WARN-2',
    title: 'Synchronous read-modify-write on every emit creates a TOCTOU race and an O(n) hot path',
    severity: 'warning',
    scope: 'one-file',
    commandment: 12,
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 114,
        excerpt: 'const queue = readQueue(); queue.push(evt); writeQueue(queue)',
      },
    ],
    observed:
      'Each emit() does a synchronous JSON.parse of the entire queue, pushes the event, and synchronously serializes the entire queue back to disk.',
    rationale:
      "For mcp.tool_called the rate can be many events per second during an audit. The full-queue parse-and-write is O(n) per event, becoming O(n^2) per session. Two interleaved emits also lose one event (read-A, read-B, write-A+1, write-B+1). The file header's claim 'safe to call from hot paths' is not actually true.",
    proposedFix:
      'Hold events in an in-memory array; persist to disk only on the 60s flush tick and on before-quit. The crash hook already double-flushes, so durability is unchanged.',
  },
  {
    id: 'WARN-3',
    title: 'app.crashed stack traces may include absolute file paths, contradicting consent copy',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 145,
        excerpt: "emit('app.crashed', { ... stack: String(err?.stack ?? '').slice(0, 2000) })",
      },
      {
        file: 'docs/strategy/BETA-CLOSED-PLAN.md',
        line: 102,
        excerpt: 'No file contents or design data leave your machine.',
      },
    ],
    observed:
      'The crash payload sends the raw stack trace, which on macOS/Windows commonly contains absolute paths like /Users/<name>/Projects/<client>/src/...',
    rationale:
      'Project names in file paths are arguably "design data" under the consent copy. Low risk for 10 trusted beta users, but the consent text should match what is actually sent.',
    proposedFix:
      'Redact homedir from stack strings before emit (e.g. replace os.homedir() with "<home>"), or update the consent copy to call out crash stack traces explicitly.',
  },
  {
    id: 'WARN-4',
    title: 'emit() accepts arbitrary payload — no compile-time guarantee that args are not leaked',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 102,
        excerpt: 'export function emit(name: string, payload?: Record<string, unknown>): void',
      },
      {
        file: 'docs/strategy/BETA-CLOSED-PLAN.md',
        line: 114,
        excerpt: 'mcp.tool_called — tool name only, not args',
      },
    ],
    observed:
      'emit takes a free-form Record<string, unknown> payload; nothing prevents a future caller from passing tool arguments.',
    rationale:
      "The 'tool name only, not args' rule is the central privacy promise. Encoding it in the type system is cheap and turns a runtime promise into a compile-time invariant.",
    proposedFix:
      'Replace the signature with a discriminated union per event name (app.launched, app.crashed, mcp.tool_called, audit.completed, session.ended) so each event has a typed payload.',
  },
  {
    id: 'WARN-5',
    title: 'Test suite missing network-failure, malformed-queue, and uncaughtException paths',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.test.ts',
        line: 195,
        excerpt: "describe('betaTelemetry — flush behaviour', () => { it('does nothing when FLINT_TELEMETRY_URL is unset' ...",
      },
    ],
    observed:
      'The flush block only tests the unset-URL branch. There is no test for fetch rejection, fetch returning ok:false, malformed queue file on disk, X-Flint-Secret header presence, or the uncaughtException listener firing.',
    rationale:
      "The module's value prop is offline-safe queueing. None of the failure paths that justify the queue are exercised. The plan's success metric ('Crash rate < 1 per user-week') depends on app.crashed actually firing — currently untested.",
    proposedFix:
      'Add four tests: (a) fetch rejects → queue retained; (b) fetch ok:false → queue retained; (c) corrupt queue.json → readQueue returns []; (d) FLINT_TELEMETRY_SECRET set → header present.',
  },
  {
    id: 'SUG-1',
    title: 'flush() is private; cannot be triggered for debug or tests',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      { file: 'electron/betaTelemetry.ts', line: 119, excerpt: 'async function flush(): Promise<void>' },
    ],
    observed: 'flush is not exported.',
    rationale:
      'A "Flush now" debug command and direct flush integration tests both want this exported. Cost is one keyword.',
    proposedFix: 'export async function flush()',
  },
  {
    id: 'SUG-2',
    title: 'Queue has no size cap — unbounded growth if user is offline for extended periods',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      { file: 'electron/betaTelemetry.ts', line: 116, excerpt: 'queue.push(evt); writeQueue(queue)' },
    ],
    observed: 'No length check on queue before push.',
    rationale:
      "An offline user accumulating mcp.tool_called events over a week could hit megabytes of queue. Drop-oldest at, e.g., 10k events keeps the worst-case bounded.",
    proposedFix:
      'if (queue.length >= 10_000) queue.splice(0, queue.length - 9_999); queue.push(evt);',
  },
];

const counts = countFindings(findings);
const verdict = deriveVerdict(findings, 'code');

export const REPORT: ReviewReport = {
  meta: {
    phase: 'beta-telemetry',
    dimension: 'code',
    reviewer: 'flint-code-reviewer',
    date: '2026-04-25',
    round: 1,
    scope: [
      'electron/betaTelemetry.ts (159 lines)',
      'electron/betaTelemetry.test.ts (207 lines)',
      'docs/strategy/BETA-CLOSED-PLAN.md (spec)',
      'cross-refs: main.ts, preload.ts, ipc-validators.ts, flint-api.d.ts, brand.ts',
    ],
    markdownFile: 'beta-telemetry-review-2026-04-25.md',
  },
  rubric: [
    {
      criterion: 'Spec event names from Phase 4.1 are all implemented and called',
      result: 'fail',
      evidence:
        'app.launched, app.crashed, session.ended emit from startTelemetry; mcp.tool_called and audit.completed have no callers anywhere.',
      relatedFindings: ['BLK-2'],
    },
    {
      criterion: 'Consent default state matches the documented "on by default" policy',
      result: 'fail',
      evidence: "Code defaults to 'unset' which gates emit; spec line 12 says 'on by default'.",
      relatedFindings: ['BLK-1'],
    },
    {
      criterion: 'Queue persists to the documented userData path',
      result: 'fail',
      evidence: 'Code uses os.homedir() + BRAND.configDir (~/.flint/), spec says userData/.',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'emit() is a no-op when consent is unset or declined',
      result: 'pass',
    },
    {
      criterion: 'Module is wired into app startup',
      result: 'fail',
      evidence: 'No import of betaTelemetry from electron/main.ts.',
      relatedFindings: ['BLK-2'],
    },
    {
      criterion: 'Renderer→main IPC channels have Zod validators in shared/ipc-validators.ts',
      result: 'fail',
      evidence: 'No telemetry:* channel exists at all.',
      relatedFindings: ['BLK-3'],
    },
    {
      criterion: 'process.on("uncaughtException") is registered for crash capture',
      result: 'pass',
    },
    {
      criterion: 'app.before-quit triggers a final flush',
      result: 'pass',
    },
    {
      criterion: 'Privacy claim ("no file contents or design data") holds for every emitted payload',
      result: 'fail',
      evidence: 'Stack traces may contain absolute paths revealing project names.',
      relatedFindings: ['WARN-3'],
    },
    {
      criterion: 'Tests cover network-failure path (fetch rejects or non-2xx)',
      result: 'fail',
      evidence: 'Only the unset-URL branch is tested.',
      relatedFindings: ['WARN-5'],
    },
    {
      criterion: 'Tests cover happy path and opt-out gating',
      result: 'pass',
    },
    {
      criterion: 'No `as any` or `@ts-ignore`',
      result: 'pass',
    },
    {
      criterion: 'Atomic file writes on the queue (no read-modify-write race)',
      result: 'fail',
      evidence: 'Each emit is read+push+write synchronously; interleaved calls drop events.',
      relatedFindings: ['WARN-2'],
    },
  ],
  findings,
  counts,
  verdict,
  scopeCoverage: {
    reviewed: [
      'electron/betaTelemetry.ts',
      'electron/betaTelemetry.test.ts',
      'docs/strategy/BETA-CLOSED-PLAN.md',
      'electron/main.ts (cross-ref)',
      'electron/preload.ts (cross-ref)',
      'shared/ipc-validators.ts (cross-ref)',
      'src/types/flint-api.d.ts (cross-ref)',
      'shared/brand.ts (cross-ref)',
    ],
    skipped: [
      'cloudflare-worker/src/** — worker transport not in scope for telemetry-module review',
      'Feedback widget (Phase 3) — separate file, separate review',
      'Expiry kill switch (Phase 2) — separate file, separate review',
    ],
  },
};
