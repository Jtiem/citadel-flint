/**
 * TELEMETRY-WEB-TRANSPORT — Executable Contract
 *
 * Wires the existing telemetry surface into the web transport (`src/adapters/web-api.ts`),
 * which is the production path inside the Electron-shelled web build. The closed beta
 * tagged `v0.3.0-beta.1` failed a smoke test because `window.flintAPI.telemetry` was
 * `undefined` in the browser — the adapter never exposed the namespace, so the consent
 * dialog never rendered and no events ever left the renderer.
 *
 * Scope: ONE adapter file change + tests. Server handlers, IPC schemas, server-side
 * emit sites, and `electron/betaTelemetry.ts` are already in place and frozen for
 * the v0.3.0-beta.1 contract.
 *
 * Phase 2 imports types directly from `BETA-TELEMETRY-WIRING.contract` — no new types
 * are introduced. The web adapter must conform to `TelemetryFlintAPI['telemetry']`
 * already declared by the prior contract.
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
} from '../../shared/contract-schema'

// Re-export prior-contract types so Phase 2 has a single import. NO NEW TYPES.
export type {
  ConsentState,
  ConsentRecord,
  TelemetrySetConsentPayload,
  TelemetryEvent,
  EmitFunction,
  TelemetryFlintAPI,
} from './BETA-TELEMETRY-WIRING.contract'

// ─── Contract Sections ──────────────────────────────────────────────────────

const impact: ImpactEntry[] = [
  {
    file: 'src/adapters/web-api.ts',
    changeType: 'MODIFY',
    owner: 'flint-state-architect',
    summary:
      'Add a `telemetry` namespace inside the object returned by `createWebFlintAPI()`. ' +
      'Two methods: `getConsent(): Promise<ConsentRecord>` → `invoke("telemetry:get-consent")`; ' +
      '`setConsent(payload): Promise<ConsentRecord>` → `invoke("telemetry:set-consent", payload)`. ' +
      'Shape MUST match `flintAPI.telemetry` in `src/types/flint-api.d.ts` (TelemetryFlintAPI).',
  },
  {
    file: 'src/adapters/__tests__/web-api.test.ts',
    changeType: 'MODIFY',
    owner: 'flint-test-writer',
    summary:
      'Add adapter unit tests: (a) getConsent POSTs `channel: "telemetry:get-consent"` with empty args ' +
      'and returns the parsed ConsentRecord; (b) setConsent({state:"accepted"}) POSTs `channel: ' +
      '"telemetry:set-consent"`, args `[{state:"accepted"}]`, returns the updated record.',
  },
  {
    file: 'server/__tests__/telemetryIpc.test.ts',
    changeType: 'CREATE',
    owner: 'flint-test-writer',
    summary:
      'Create the parity test file. Cover: invoking `mcp:call-tool` for `audit_ui_component` while ' +
      'consent is accepted pushes one entry with `name: "mcp.tool_called"` to the in-memory ' +
      'webTelemetryBuffer and one entry with `name: "audit.completed"`.',
  },
  {
    file: 'server/__tests__/index.test.ts',
    changeType: 'MODIFY',
    owner: 'flint-test-writer',
    summary:
      'Add a smoke test that locks `startTelemetry()` boot in: after the server initializes with ' +
      'consent state `accepted`, the in-memory buffer contains an `app.launched` entry. The flush ' +
      'timer is also asserted to be set (cleared in afterEach to avoid open-handle warnings).',
  },
  {
    file: '.flint-context/contracts/TELEMETRY-WEB-TRANSPORT.contract.md',
    changeType: 'CREATE',
    owner: 'flint-architect',
    summary: 'Architect artifact (Phase 1 output).',
  },
  {
    file: '.flint-context/contracts/TELEMETRY-WEB-TRANSPORT.contract.ts',
    changeType: 'CREATE',
    owner: 'flint-architect',
    summary: 'Executable contract (this file).',
  },
]

const ipc: IPCChannelContract[] = [
  {
    channel: 'telemetry:get-consent',
    direction: 'renderer→main',
    payloadType: 'void',
    returnType: 'ConsentRecord',
    handler: 'server/index.ts:3591 (web) / electron/main.ts:5690 (legacy, unchanged)',
    // Channel takes no payload; the response is validated. Per the contract-schema
    // rule, every renderer→main channel must declare a Zod export name. We point at
    // the response validator that already exists for this channel. The shared/
    // ipc-validators.ts file currently does not register this channel inside the
    // `ipcSchemas` map (it predates the schema-map convention) but the named
    // export is live and is the canonical reference.
    validator: 'telemetryGetConsentResponseSchema',
  },
  {
    channel: 'telemetry:set-consent',
    direction: 'renderer→main',
    payloadType: 'TelemetrySetConsentPayload',
    returnType: 'ConsentRecord',
    handler: 'server/index.ts:3595 (web) / electron/main.ts:5694 (legacy, unchanged)',
    validator: 'telemetrySetConsentPayloadSchema',
  },
]

const stores: StoreSliceContract[] = []

const components: ComponentContract[] = [
  // No NEW components. TelemetryConsentDialog and App.tsx already consume
  // window.flintAPI.telemetry — they will start working as soon as the adapter
  // stops returning undefined. Listed here for traceability only.
  {
    name: 'TelemetryConsentDialog',
    file: 'src/components/ui/TelemetryConsentDialog.tsx',
    propsType: 'TelemetryConsentDialogProps',
    consumesStores: [],
    emitsIPC: ['telemetry:set-consent'],
  },
]

const commandments = [4, 13, 14]

const testBoundaries: TestBoundary[] = [
  {
    target: 'createWebFlintAPI().telemetry.getConsent',
    kind: 'service',
    behavior:
      'getConsent issues a POST to /api/ipc with channel "telemetry:get-consent" and no args, ' +
      'and returns the parsed ConsentRecord from the server response.',
    assertion: 'returns ConsentRecord; the fetch payload body is {"channel":"telemetry:get-consent","args":[]}',
    edgeCases: [
      'Server returns 500 — the underlying invoke() retries up to 3 times then rejects.',
      'Server returns { state: "unset", sessionId: "<uuid>" } — record is returned as-is, decidedAt absent.',
      'Server returns malformed JSON — fetch().json() rejects, invoke() surfaces the error to the caller.',
    ],
    given: 'A web build with global fetch mocked to resolve with { result: { state: "unset", sessionId: "abc" } }.',
    when: 'The browser calls window.flintAPI.telemetry.getConsent().',
    then: 'returns a ConsentRecord whose state is "unset" and sessionId is "abc"; the fetch was called with body containing `"channel":"telemetry:get-consent"` and `"args":[]`.',
  },
  {
    target: 'createWebFlintAPI().telemetry.setConsent',
    kind: 'service',
    behavior:
      'setConsent issues a POST to /api/ipc with channel "telemetry:set-consent" and a single ' +
      'payload arg `{ state: "accepted" | "declined" }`, returns the updated ConsentRecord.',
    assertion:
      'returns ConsentRecord with state matching the request; the fetch payload args is exactly [{ state: "accepted" }] (or "declined").',
    edgeCases: [
      'state === "declined" — same shape, different value. Tests both branches.',
      'state === "garbage" — TypeScript prevents this at compile time; not a runtime concern, no test required.',
      'Server returns 401 because the WS-token endpoint is misconfigured — invoke() rejects, caller sees an error.',
    ],
    given: 'A web build with global fetch mocked to resolve with { result: { state: "accepted", sessionId: "abc", decidedAt: "2026-04-26T00:00:00Z" } }.',
    when: 'The browser calls window.flintAPI.telemetry.setConsent({ state: "accepted" }).',
    then: 'returns a ConsentRecord whose state is "accepted" and decidedAt is set; the fetch payload contains `"channel":"telemetry:set-consent"` and `"args":[{"state":"accepted"}]`.',
  },
  {
    target: 'server `mcp:call-tool` handler — telemetry parity emit',
    kind: 'ipc-handler',
    behavior:
      'When consent state is "accepted" and the renderer invokes mcp:call-tool, the server pushes ' +
      'one entry with `name: "mcp.tool_called"` to the in-memory webTelemetryBuffer. For audit-shaped ' +
      'tools (audit_ui_component, flint_audit, flint_swarm_audit_fix) it also pushes one entry with ' +
      '`name: "audit.completed"` after the tool resolves.',
    assertion: 'buffer.length === 2 after the call; buffer[0].name === "mcp.tool_called"; buffer[1].name === "audit.completed".',
    edgeCases: [
      'Consent state is "unset" or "declined" — webEmit is a no-op; buffer length unchanged.',
      'Tool result has no JSON content — fileCount/violationCount default to 0 (existing fallback at server/index.ts:2876-2882).',
    ],
    given: 'A web server booted with consent state "accepted" and the MCP client mocked to resolve audit_ui_component with a known violation count.',
    when: 'A renderer invokes the IPC channel `mcp:call-tool` with name="audit_ui_component" and a valid args object.',
    then: 'emits two telemetry buffer entries — one with name "mcp.tool_called" carrying { toolName: "audit_ui_component" }, one with name "audit.completed" carrying numeric fileCount/violationCount/durationMs.',
  },
  {
    target: 'server boot — startTelemetry() side effect',
    kind: 'service',
    behavior:
      'Booting server/index.ts with consent "accepted" causes startTelemetry() to fire and push ' +
      'one `app.launched` entry into the in-memory buffer.',
    assertion: 'buffer contains exactly one entry with name === "app.launched" after server start.',
    edgeCases: [
      'Consent state is "unset" — webEmit is a no-op, buffer length is 0. The flush timer is still set (governance: timer runs but emits nothing).',
      'A queue file already exists on disk from a prior crashed run — startTelemetry hydrates it before emitting app.launched.',
    ],
    given: 'A clean test home directory and consent state file with `{ state: "accepted", sessionId: "<uuid>" }`.',
    when: 'The web server is constructed (the test imports/calls the same factory used by `npm run dev:web`).',
    then: 'writes one telemetry buffer entry with name "app.launched" and sets the 60-second flush interval timer.',
  },
  {
    target: 'TelemetryConsentDialog (existing component, web wiring smoke)',
    kind: 'component',
    behavior:
      'When window.flintAPI.telemetry is the web adapter and consent is unset on first paint, ' +
      'App.tsx renders <TelemetryConsentDialog/>. Clicking Accept invokes setConsent and dismisses.',
    assertion:
      'renders dialog when getConsent resolves to { state: "unset" }; on Accept, setConsent is called with { state: "accepted" } and onDecided is invoked.',
    edgeCases: [
      'getConsent rejects — App.tsx falls through the catch and the dialog is suppressed (privacy-safe).',
      'window.flintAPI.telemetry is undefined (regression case, the bug we are fixing) — App.tsx falls through the typeof guard and the dialog never renders. This boundary regresses if Phase 2 forgets to add the namespace.',
    ],
    given: 'A web-adapter window.flintAPI whose telemetry.getConsent resolves to { state: "unset", sessionId: "abc" }.',
    when: 'App mounts.',
    then: 'renders the TelemetryConsentDialog; clicking Accept calls window.flintAPI.telemetry.setConsent({ state: "accepted" }) and dismisses the dialog via onDecided("accepted").',
  },
]

const invariants: Invariant[] = [
  {
    name: 'web-telemetry-namespace-present',
    measurable:
      'Number of methods exposed on `createWebFlintAPI().telemetry` (must equal exactly the methods on `flintAPI.telemetry` in `src/types/flint-api.d.ts`).',
    threshold: '>= 2 (getConsent, setConsent), and the count must equal the count on the d.ts surface',
    measuredBy:
      'Vitest unit test in `src/adapters/__tests__/web-api.test.ts` that introspects ' +
      '`Object.keys(createWebFlintAPI().telemetry)` and asserts it matches the keys of ' +
      'TelemetryFlintAPI["telemetry"] from BETA-TELEMETRY-WIRING.contract.ts.',
  },
  {
    name: 'consent-roundtrip-latency',
    measurable: 'Wall-clock time for `getConsent()` to resolve when the server is healthy and on the same host.',
    threshold: '< 200ms at the p95 percentile measured locally over 10 sequential calls',
    measuredBy:
      'Vitest performance assertion in the web-api test suite that times 10 sequential getConsent ' +
      'calls against the in-process Express harness; fails if any single call exceeds 200ms.',
  },
  {
    name: 'secret-never-crosses-process-boundary',
    measurable: 'Number of HTTP responses returned to the browser that contain `FLINT_TELEMETRY_SECRET`.',
    threshold: '= 0 across the full integration test suite',
    measuredBy:
      'Server-side test that POSTs every telemetry IPC channel and asserts the response body never ' +
      'contains the substring of `process.env.FLINT_TELEMETRY_SECRET`. Belt-and-braces — the ' +
      'handlers do not echo the secret, but the test pins that behavior.',
  },
]

const risks: RiskEntry[] = [
  {
    risk:
      'Adapter mistypes the channel name (e.g., camelCase vs colon) and the server returns a generic ' +
      '404. The browser console shows a vague error and the consent dialog stays hidden.',
    severity: 'medium',
    commandment: 14,
    mitigation:
      'Adapter unit tests assert the exact channel string sent through fetch. Phase 1.5 grep verifies ' +
      'the validator export names match the server handler keys.',
  },
  {
    risk:
      'Phase 2 agent imports `electron/betaTelemetry.ts` "to share types," pulling Electron-only ' +
      'modules into the renderer bundle and breaking the web build.',
    severity: 'high',
    commandment: 14,
    mitigation:
      'Contract forbids this. Phase 2 imports types ONLY from `./BETA-TELEMETRY-WIRING.contract`. ' +
      'flint-code-reviewer must confirm during Phase 2.5.',
  },
  {
    risk:
      'A future engineer "exposes" FLINT_TELEMETRY_SECRET to the browser to debug a 401 from the Worker.',
    severity: 'high',
    commandment: 4,
    mitigation:
      'The secret is read from process.env in `server/index.ts:3476` and attached to the outbound ' +
      'fetch only. The browser never sends or reads the secret. Invariant `secret-never-crosses-' +
      'process-boundary` pins this with a server test.',
  },
  {
    risk:
      'A refactor removes `startTelemetry()` from the web boot path. The flush timer never runs and ' +
      'events accumulate in memory until the buffer is dropped on reload.',
    severity: 'medium',
    mitigation: 'Server-boot smoke test fails the moment the call is removed.',
  },
  {
    risk:
      'A refactor removes `webEmit("mcp.tool_called", ...)` from the `mcp:call-tool` handler. Web ' +
      'users would silently lose the most useful signal — only `app.launched` and `session.ended` ' +
      'would survive.',
    severity: 'medium',
    mitigation:
      'Parity test in `server/__tests__/telemetryIpc.test.ts` asserts both `mcp.tool_called` and ' +
      '`audit.completed` land in the buffer for an audit-tool call.',
  },
]

const parallelismGroups: Record<string, string[]> = {
  // Group A and B run concurrently — different files, no overlap.
  A: ['flint-state-architect'],
  B: ['flint-test-writer'],
  // Architect owns the contract artifacts.
  Architect: ['flint-architect'],
}

const nonGoals: string[] = [
  'Do NOT modify shared/ipc-validators.ts. The Zod exports `telemetryGetConsentResponseSchema` and `telemetrySetConsentPayloadSchema` are already correct.',
  'Do NOT modify electron/betaTelemetry.ts. The legacy module stays exactly as it is.',
  'Do NOT modify electron/preload.ts or electron/main.ts. The IPC contract for the legacy preload path is FROZEN at v0.3.0-beta.1.',
  'Do NOT add new SDK dependencies. No PostHog, no Sentry, no Snowplow. Native fetch and the existing Worker sink only.',
  'Do NOT add new emit sites. All four event types (app.launched, audit.completed, mcp.tool_called, session.ended) already fire in server/index.ts. Verify parity with tests; do not extend.',
  'Do NOT introduce a Zustand store slice for consent. Consent lives on disk; the adapter is a thin RPC.',
  'Do NOT add a browser-side queue or retry policy beyond the existing 3x retry inside `invoke()`. The buffer lives on the server.',
  'Do NOT change the FlintAPI surface in src/types/flint-api.d.ts. The web adapter conforms to the existing typed surface so App.tsx and TelemetryConsentDialog.tsx need zero edits.',
]

// ─── Final Contract Export ──────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'TELEMETRY-WEB-TRANSPORT',
    phase: 'TELEMETRY-WEB-TRANSPORT',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-26',
    audience: 'designer',
  },
  impact,
  ipc,
  stores,
  components,
  commandments,
  testBoundaries,
  invariants,
  risks,
  parallelismGroups,
  nonGoals,
}
