/**
 * BETA-TELEMETRY-WIRING — Executable Contract
 *
 * Wires the existing electron/betaTelemetry.ts module into the Flint app:
 *   - IPC channels (telemetry:get-consent, telemetry:set-consent) with Zod
 *     validators in shared/ipc-validators.ts (closes BLK-3)
 *   - Module wired into app.whenReady() in electron/main.ts AND server/index.ts
 *     for web parity (closes BLK-2)
 *   - Emit sites for mcp.tool_called, audit.completed, session.ended payload
 *   - Privacy hardening: userData/ queue path, in-memory buffer, stack-trace
 *     redaction, discriminated-union emit signature (closes WARN-1..WARN-4)
 *   - First-launch React consent dialog (closes UI half of BLK-2)
 *   - Test coverage: network failure, malformed queue, secret header,
 *     uncaughtException registration (closes WARN-5)
 *
 * Phase 2 agents import the types below directly from this file.
 */

import type {
  FlintContract,
  TestBoundary,
  Invariant,
  IPCChannelContract,
  ImpactEntry,
  RiskEntry,
  ComponentContract,
  StoreSliceContract,
} from '../../shared/contract-schema';

// ─── Public Types (Phase 2 implements against these) ────────────────────────

/** Consent state machine. `unset` = never asked; opt-in default. */
export type ConsentState = 'unset' | 'accepted' | 'declined';

/** Persisted consent record + canonical IPC response shape. */
export interface ConsentRecord {
  state: ConsentState;
  /** ISO 8601 timestamp; absent until first accept/decline. */
  decidedAt?: string;
  /** UUID v4. Stable for the life of the install. */
  sessionId: string;
}

/** Renderer → main payload for telemetry:set-consent. */
export interface TelemetrySetConsentPayload {
  state: 'accepted' | 'declined';
}

/**
 * Discriminated-union of every legal telemetry event.
 *
 * This is the privacy contract enforced at the type system level (WARN-4).
 * `mcp.tool_called` carries `toolName` only — never args. Adding a new event
 * requires extending this union, which forces explicit review.
 */
export type TelemetryEvent =
  | { name: 'app.launched'; payload: { locale: string } }
  | { name: 'app.crashed'; payload: { message: string; stack: string } }
  | { name: 'mcp.tool_called'; payload: { toolName: string } }
  | {
      name: 'audit.completed';
      payload: {
        fileCount: number;
        violationCount: number;
        durationMs: number;
      };
    }
  | { name: 'session.ended'; payload: { durationMs: number } };

/**
 * Typed emit signature — privacy guarantee is a compile-time invariant.
 * Phase 2 must replace the current `emit(name, payload)` open-payload signature
 * with this overload set.
 */
export interface EmitFunction {
  <E extends TelemetryEvent>(name: E['name'], payload: E['payload']): void;
}

/** Consent dialog props (src/components/ui/TelemetryConsentDialog.tsx). */
export interface TelemetryConsentDialogProps {
  /** Called after user clicks Accept or Decline. Caller dismisses dialog. */
  onDecided: (state: 'accepted' | 'declined') => void;
}

/** Window.flintAPI surface added by this contract. */
export interface TelemetryFlintAPI {
  telemetry: {
    getConsent: () => Promise<ConsentRecord>;
    setConsent: (payload: TelemetrySetConsentPayload) => Promise<ConsentRecord>;
  };
}

// ─── Contract Sections ──────────────────────────────────────────────────────

const impact: ImpactEntry[] = [
  {
    file: 'shared/ipc-validators.ts',
    changeType: 'MODIFY',
    owner: 'flint-electron-ipc',
    summary:
      'Append telemetry:get-consent + telemetry:set-consent Zod schemas; export named validators telemetryGetConsentResponseSchema and telemetrySetConsentPayloadSchema.',
  },
  {
    file: 'electron/preload.ts',
    changeType: 'MODIFY',
    owner: 'flint-electron-ipc',
    summary:
      'Expose window.flintAPI.telemetry.{getConsent,setConsent} via contextBridge using validateIPC + validateIPCResponse.',
  },
  {
    file: 'electron/main.ts',
    changeType: 'MODIFY',
    owner: 'flint-electron-ipc',
    summary:
      'Register ipcMain handlers for telemetry:get-consent and telemetry:set-consent; call startTelemetry() in app.whenReady(); add emit("mcp.tool_called", { toolName }) at MCP dispatch and emit("audit.completed", {...}) at audit completion; populate session.ended duration.',
  },
  {
    file: 'electron/betaTelemetry.ts',
    changeType: 'MODIFY',
    owner: 'flint-electron-ipc',
    summary:
      'Switch queue path to app.getPath("userData"); in-memory buffer with persist-on-flush; redact /Users/<name>/ from stack traces; tighten emit() to discriminated-union signature; migrate legacy ~/.flint/telemetry-queue.json on first run.',
  },
  {
    file: 'electron/betaTelemetry.test.ts',
    changeType: 'MODIFY',
    owner: 'flint-test-writer',
    summary:
      'Add 4 tests: net.fetch rejection retains queue; malformed queue file recovers to []; X-Flint-Secret header presence/absence; process.on("uncaughtException") registration emits app.crashed.',
  },
  {
    file: 'server/index.ts',
    changeType: 'MODIFY',
    owner: 'flint-electron-ipc',
    summary:
      'Mirror telemetry:get-consent and telemetry:set-consent over WS; call startTelemetry() at server boot; same emit sites as electron/main.ts. Web-parity per feedback_web_parity_drift.',
  },
  {
    file: 'src/types/flint-api.d.ts',
    changeType: 'MODIFY',
    owner: 'flint-electron-ipc',
    summary:
      'Add telemetry namespace to FlintAPI declaration so consumers get autocomplete.',
  },
  {
    file: 'src/components/ui/TelemetryConsentDialog.tsx',
    changeType: 'CREATE',
    owner: 'flint-design-engineer',
    summary:
      'First-launch consent modal; Accept/Decline buttons; focus trap + Escape close + aria-modal/role="dialog"/aria-labelledby/aria-describedby. Calls window.flintAPI.telemetry.setConsent on click.',
  },
  {
    file: 'src/components/ui/__tests__/TelemetryConsentDialog.test.tsx',
    changeType: 'CREATE',
    owner: 'flint-test-writer',
    summary:
      'Component tests: renders when consent.state === "unset"; Accept calls setConsent({state:"accepted"}); Decline calls setConsent({state:"declined"}); focus trap holds Tab/Shift+Tab; Escape triggers Decline path.',
  },
  {
    file: 'src/App.tsx',
    changeType: 'MODIFY',
    owner: 'flint-design-engineer',
    summary:
      'Mount TelemetryConsentDialog when window.flintAPI.telemetry.getConsent() resolves to state === "unset".',
  },
];

const ipc: IPCChannelContract[] = [
  {
    channel: 'telemetry:get-consent',
    direction: 'renderer→main',
    payloadType: 'void',
    returnType: 'ConsentRecord',
    handler: 'electron/main.ts',
    validator: 'telemetryGetConsentResponseSchema',
  },
  {
    channel: 'telemetry:set-consent',
    direction: 'renderer→main',
    payloadType: 'TelemetrySetConsentPayload',
    returnType: 'ConsentRecord',
    handler: 'electron/main.ts',
    validator: 'telemetrySetConsentPayloadSchema',
  },
];

const stores: StoreSliceContract[] = [];

const components: ComponentContract[] = [
  {
    name: 'TelemetryConsentDialog',
    file: 'src/components/ui/TelemetryConsentDialog.tsx',
    propsType: 'TelemetryConsentDialogProps',
    consumesStores: [],
    emitsIPC: ['telemetry:set-consent'],
  },
];

const testBoundaries: TestBoundary[] = [
  {
    target: 'emit(mcp.tool_called)',
    kind: 'service',
    behavior:
      'MCP tool dispatch site emits a telemetry event carrying tool name only.',
    assertion: 'emitted event payload === { toolName: string } and contains no `args`, `params`, or arbitrary keys',
    edgeCases: ['consent unset → no emit', 'consent declined → no emit', 'tool name with unicode'],
    given: 'consent.state === "accepted" and the MCP dispatcher receives a tool call named "audit_ui_component" with args { filePath: "/x.tsx" }',
    when: 'electron/main.ts emits the telemetry event at the MCP boundary',
    then: 'emits exactly one event whose payload object has key set === ["toolName"] with value "audit_ui_component"',
  },
  {
    target: 'emit(audit.completed)',
    kind: 'service',
    behavior: 'Audit pipeline completion emits durationMs + counts, no file paths.',
    assertion: 'payload === { fileCount, violationCount, durationMs } with all numbers >= 0',
    edgeCases: ['fileCount === 0', 'violationCount === 0', 'consent declined → no emit'],
    given: 'an audit run finishes processing 12 files with 3 violations after 1450ms',
    when: 'the audit pipeline calls the telemetry emit hook',
    then: 'emits an event with payload { fileCount: 12, violationCount: 3, durationMs: 1450 } and no file path strings',
  },
  {
    target: 'emit(session.ended)',
    kind: 'service',
    behavior: 'before-quit handler computes session duration and emits.',
    assertion: 'payload.durationMs === Date.now() - startTimestamp at quit',
    edgeCases: ['quit < 1s after launch', 'startTelemetry never called → no throw'],
    given: 'startTelemetry() ran at t=1000 and app emits before-quit at t=61000',
    when: 'the before-quit handler fires',
    then: 'emits session.ended with payload.durationMs >= 60000',
  },
  {
    target: 'telemetry:get-consent IPC',
    kind: 'ipc-handler',
    behavior: 'Returns current consent record without mutation.',
    assertion: 'response shape matches ConsentRecord and is validated by telemetryGetConsentResponseSchema',
    edgeCases: ['no file on disk → returns { state: "unset", sessionId: <new uuid> }', 'corrupt file → returns fresh unset'],
    given: 'no consent file exists at userData/beta-consent.json',
    when: 'renderer calls window.flintAPI.telemetry.getConsent()',
    then: 'returns a ConsentRecord with state === "unset" and a valid uuid v4 sessionId',
  },
  {
    target: 'telemetry:set-consent IPC',
    kind: 'ipc-handler',
    behavior: 'Persists consent decision and stamps decidedAt.',
    assertion: 'response.state === input.state && typeof response.decidedAt === "string"',
    edgeCases: ['invalid state value → Zod rejects before handler runs', 'concurrent calls → last write wins'],
    given: 'consent.state === "unset" and renderer sends { state: "accepted" }',
    when: 'main handles telemetry:set-consent',
    then: 'writes ConsentRecord to userData/beta-consent.json with state="accepted" and ISO decidedAt, then returns it',
  },
  {
    target: 'TelemetryConsentDialog Accept',
    kind: 'component',
    behavior: 'Accept button calls setConsent and dismisses.',
    assertion: 'window.flintAPI.telemetry.setConsent called once with { state: "accepted" }; onDecided invoked with "accepted"',
    edgeCases: ['IPC rejection → dialog stays open with retry copy', 'double-click → only one IPC call'],
    given: 'the dialog is rendered with consent.state === "unset"',
    when: 'the user clicks the Accept button',
    then: 'calls window.flintAPI.telemetry.setConsent with payload { state: "accepted" } exactly once',
  },
  {
    target: 'TelemetryConsentDialog a11y focus trap',
    kind: 'component',
    behavior: 'Tab/Shift+Tab cycle within dialog; Escape closes.',
    assertion: 'document.activeElement remains within dialog root throughout cycle; aria-modal="true"; role="dialog"',
    edgeCases: ['dialog mounts with no focusable children → focuses dialog root', 'shadow DOM children'],
    given: 'the dialog is mounted and Decline has initial focus (privacy-safe default — user must affirmatively click Accept)',
    when: 'the user presses Shift+Tab from Decline',
    then: 'sets document.activeElement to the last focusable element in the dialog (Accept button)',
  },
  {
    target: 'flush() network failure path',
    kind: 'service',
    behavior: 'Failed POST retains the queue for the next interval.',
    assertion: 'queue length unchanged after rejected fetch',
    edgeCases: ['ECONNREFUSED', 'HTTP 500', 'HTTP 401'],
    given: 'queue contains 3 buffered events and net.fetch is mocked to reject with ECONNREFUSED',
    when: 'flush() is invoked',
    then: 'reads the in-memory queue, retains all 3 events, and does not throw out of flush()',
  },
  {
    target: 'malformed queue recovery',
    kind: 'service',
    behavior: 'Corrupt JSON on disk is treated as empty.',
    assertion: 'readQueue() returns [] when JSON.parse throws',
    edgeCases: ['truncated file', 'non-array root', 'binary garbage'],
    given: 'userData/telemetry-queue.json contains the bytes "{not json"',
    when: 'startTelemetry() boots and reads the queue',
    then: 'returns an empty array and does not propagate the parse error',
  },
  {
    target: 'X-Flint-Secret header gating',
    kind: 'service',
    behavior: 'Secret header sent iff FLINT_TELEMETRY_SECRET is set.',
    assertion: 'fetch.mock.calls[0][1].headers contains "X-Flint-Secret" only when env var present',
    edgeCases: ['empty string env var → header omitted', 'whitespace-only env var → header omitted'],
    given: 'FLINT_TELEMETRY_SECRET="abc123" and queue has 1 event',
    when: 'flush() POSTs to FLINT_TELEMETRY_URL',
    then: 'calls net.fetch with headers["X-Flint-Secret"] === "abc123"',
  },
  {
    target: 'uncaughtException registration',
    kind: 'service',
    behavior: 'startTelemetry registers a process.on("uncaughtException") that emits app.crashed.',
    assertion: 'emitted event name === "app.crashed" and payload.stack contains no /Users/<homedir>/ substrings',
    edgeCases: ['err is null', 'err.stack undefined', 'stack > 2000 chars (truncation)'],
    given: 'startTelemetry() has run and homedir is /Users/justin',
    when: 'a synthetic uncaughtException is fired with stack containing "/Users/justin/Projects/X.tsx:42"',
    then: 'emits app.crashed with payload.stack containing "<homedir>/Projects/X.tsx:42" and not the literal "/Users/justin/"',
  },
  {
    target: 'queue path migration',
    kind: 'service',
    behavior: 'On first run after upgrade, copies legacy ~/.flint/telemetry-queue.json into userData/.',
    assertion: 'after first startTelemetry() call, userData queue file equals legacy file contents',
    edgeCases: ['no legacy file → no error', 'userData already populated → legacy ignored', 'legacy file unreadable → no error'],
    given: '~/.flint/telemetry-queue.json contains 2 events and userData has no queue file',
    when: 'startTelemetry() runs',
    then: 'writes those 2 events to userData/telemetry-queue.json and leaves the legacy file in place',
  },
];

const invariants: Invariant[] = [
  {
    name: 'consent-gates-emit',
    measurable: 'count of telemetry events emitted while consent.state !== "accepted"',
    threshold: '= 0 events over any test run',
    measuredBy: 'vitest spy on net.fetch + buffer inspection in betaTelemetry.test.ts',
  },
  {
    name: 'ipc-validator-coverage',
    measurable: 'count of telemetry:* renderer→main channels lacking a Zod validator export in shared/ipc-validators.ts',
    threshold: '= 0 unvalidated channels',
    measuredBy: 'flint-contract-linter Phase 1.5 + manual grep for telemetryGetConsentResponseSchema and telemetrySetConsentPayloadSchema exports',
  },
  {
    name: 'stack-redaction',
    measurable: 'count of "/Users/<username>/" substrings in any emitted app.crashed payload.stack',
    threshold: '= 0 unredacted homedir paths in 1000 fuzzed stacks',
    measuredBy: 'redaction unit test with property-style fixture set in betaTelemetry.test.ts',
  },
  {
    name: 'mcp-tool-payload-shape',
    measurable: 'count of keys in any emitted mcp.tool_called payload object',
    threshold: '= 1 (only "toolName")',
    measuredBy: 'TypeScript discriminated-union compile check + runtime assertion test',
  },
  {
    name: 'queue-location',
    measurable: 'absolute path of telemetry-queue.json after startTelemetry()',
    threshold: '= app.getPath("userData") + "/telemetry-queue.json"',
    measuredBy: 'integration test with mocked app.getPath',
  },
  {
    name: 'web-parity',
    measurable: 'count of telemetry:* IPC channels in electron/preload.ts not mirrored in server/index.ts',
    threshold: '= 0 missing mirrors',
    measuredBy: 'feedback_web_parity_drift.md check + flint-integration-validator Phase 3',
  },
];

const risks: RiskEntry[] = [
  {
    risk: 'Renderer ships consent dialog before IPC is wired → runtime error',
    severity: 'high',
    mitigation:
      'Phase 2 Group A (IPC) must complete before Group B (UI). Group B writes its tests with mocked window.flintAPI.telemetry; integration validator confirms wiring.',
  },
  {
    risk: 'emit() callers pass arbitrary args (regression of WARN-4)',
    severity: 'high',
    commandment: 16,
    mitigation:
      'Discriminated-union EmitFunction type is the public signature; old open-payload overload is deleted. TSC blocks any caller passing extra keys.',
  },
  {
    risk: 'Stack-trace redaction misses non-/Users paths (Linux /home/, Windows C:\\Users\\)',
    severity: 'medium',
    mitigation:
      'Redaction regex covers all three OS conventions; test fixture includes one Linux + one Windows stack.',
  },
  {
    risk: 'In-memory buffer lost on hard crash before flush',
    severity: 'medium',
    mitigation:
      'process.on("uncaughtException") triggers a synchronous persist-then-flush before propagating; same pattern as before-quit.',
  },
  {
    risk: 'Web build (server/index.ts) drift — feature only works in Electron',
    severity: 'medium',
    mitigation:
      'Impact map mandates server/index.ts mirror; invariant web-parity blocks ship until both transports expose telemetry:* channels.',
  },
  {
    risk: 'Consent dialog is not screen-reader accessible (Warden self-violation)',
    severity: 'medium',
    commandment: 5,
    mitigation:
      'Component contract requires aria-modal, role=dialog, aria-labelledby, aria-describedby, focus trap, Escape close. flint-design-engineer audits with Warden against itself before commit.',
  },
];

const parallelismGroups: Record<string, string[]> = {
  // Group A: IPC + module hardening + tests run first; consent dialog mocks the API.
  A: ['flint-electron-ipc', 'flint-test-writer'],
  // Group B: UI + App mount once IPC types exist.
  B: ['flint-design-engineer', 'flint-test-writer'],
};

export const CONTRACT: FlintContract = {
  meta: {
    name: 'BETA-TELEMETRY-WIRING',
    phase: 'BETA.TEL',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-25',
    audience: 'designer',
  },
  impact,
  ipc,
  stores,
  components,
  // 2 = no hallucinated styling (consent dialog uses token-backed classes only)
  // 5 = a11y compiler error (consent dialog must be a11y-clean)
  // 12 = atomic queuing (in-memory buffer + atomic write at flush)
  // 14 = bypass prohibition (no direct fs from renderer; IPC is the only legal channel)
  // 16 = in-memory validation (Zod at the bridge + discriminated union at compile time)
  commandments: [2, 5, 12, 14, 16],
  testBoundaries,
  invariants,
  risks,
  parallelismGroups,
  nonGoals: [
    'Cloudflare Worker telemetry sink schema and auth — covered separately in Phase A.4 / cloudflare-worker review.',
    'Feedback widget UI — separate beta-distribution phase.',
    'Expiry kill switch — separate beta-distribution phase.',
    'Adding new telemetry events beyond the 5 in the discriminated union (locale, crashed, mcp.tool_called, audit.completed, session.ended). Adding a sixth event requires its own contract.',
    'Telemetry sampling/rate-limiting — out of scope for closed beta with ~10 users.',
  ],
};
