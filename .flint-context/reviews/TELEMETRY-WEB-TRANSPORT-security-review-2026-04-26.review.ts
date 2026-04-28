/**
 * TELEMETRY-WEB-TRANSPORT — Security Review (Round 1)
 *
 * Machine-readable sibling of TELEMETRY-WEB-TRANSPORT-security-review-2026-04-26.md.
 * Reviewer: flint-security-reviewer.
 *
 * Verdict is derived from finding severities via deriveVerdict() — do not edit
 * by hand. Any blocking finding in a security review escalates to BLOCK.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema'
import { countFindings, deriveVerdict } from '../../shared/review-schema'

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Telemetry schemas not registered in `ipcSchemas` map',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'shared/ipc-validators.ts',
        line: 581,
        excerpt: 'export const telemetryGetConsentResponseSchema = z.object({ … })',
        note: 'Named export only — not registered as ipcSchemas[\'telemetry:get-consent\'].response',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 588,
        excerpt: 'export const telemetrySetConsentPayloadSchema = z.object({ … })',
        note: 'Same — named export, not in the registry map',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 288,
        excerpt: 'export const getCoverageSummaryPayloadSchema = ipcSchemas[\'flint:getCoverageSummary\'].payload',
        note: 'Precedent for the correct pattern — registry-keyed plus named export alias',
      },
    ],
    observed:
      'telemetryGetConsentResponseSchema and telemetrySetConsentPayloadSchema are loose named exports outside the ipcSchemas registry. Phase 1.5 contract linter and Phase 3 integration validator key off the registry map; these channels are addressable only by direct import name and would slip past a registry-only coverage check.',
    rationale:
      'The named exports are functionally sufficient for the Electron preload (which imports them directly), but they create two parallel validation surfaces. A future refactor that moves to a registry-only contract would silently regress these channels. The gap was already flagged in BETA-TELEMETRY-WIRING-code-review-2026-04-25 and deferred; this contract inherits it. Out-of-scope per nonGoals line 309 of the contract — flag for follow-up rather than block.',
    proposedFix:
      'Add \'telemetry:get-consent\' and \'telemetry:set-consent\' entries to the ipcSchemas object in shared/ipc-validators.ts. Redefine the named exports as ipcSchemas[\'telemetry:*\'].response/payload (same pattern as getCoverageSummaryResponseSchema). No call-site changes needed because the named exports stay grep-stable.',
  },
  {
    id: 'WARN-2',
    title: 'Web adapter does not validate the response from `/api/ipc`',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'src/adapters/web-api.ts',
        line: 613,
        excerpt: 'getConsent: () => invoke(\'telemetry:get-consent\') as Promise<import(\'../types/flint-api\').ConsentRecord>',
        note: 'Cast, not a Zod parse',
      },
      {
        file: 'src/adapters/web-api.ts',
        line: 615,
        excerpt: 'invoke(\'telemetry:set-consent\', payload) as Promise<import(\'../types/flint-api\').ConsentRecord>',
        note: 'Same — cast, no validation',
      },
      {
        file: 'electron/preload.ts',
        line: 1694,
        excerpt: 'const raw = await ipcRenderer.invoke(\'telemetry:get-consent\'); return telemetryGetConsentResponseSchema.parse(raw)',
        note: 'Electron path validates with Zod — web path does not',
      },
      {
        file: 'src/adapters/web-api.ts',
        line: 514,
        excerpt: 'validateIPC(\'mcp:call-tool\', [name, args], mcpCallToolSchema)',
        note: 'Adjacent precedent — web adapter already validates other channels',
      },
    ],
    observed:
      'The web adapter casts the /api/ipc response to ConsentRecord without parsing. The Electron preload runs telemetryGetConsentResponseSchema.parse(raw) on every call. The web build inherits the same threat model — a malformed or hostile server response — but skips the runtime check.',
    rationale:
      'In Electron the server is in-process and trusted, so response validation is belt-and-braces. In the web path the server is a separate process reachable over loopback HTTP — the same boundary that warrants validation in the Electron case. Privacy impact is bounded because a malformed response causes the consent dialog to NOT show (App.tsx:802 record.state === \'unset\' falsy → no dialog → no telemetry), but the inconsistency means a future change could break the privacy fail-closed without a runtime signal.',
    proposedFix:
      'Wrap both calls with the existing schemas, mirroring electron/preload.ts:1693-1706:\n\n```ts\ntelemetry: {\n  getConsent: async () => {\n    const raw = await invoke(\'telemetry:get-consent\')\n    return telemetryGetConsentResponseSchema.parse(raw)\n  },\n  setConsent: async (payload) => {\n    const validated = telemetrySetConsentPayloadSchema.parse(payload)\n    const raw = await invoke(\'telemetry:set-consent\', validated)\n    return telemetryGetConsentResponseSchema.parse(raw)\n  },\n},\n```\n\nAdds two imports from shared/ipc-validators.ts. Touches one file. Adopts the same validation pattern already used by mcp.callTool at line 514.',
  },
  {
    id: 'WARN-3',
    title: '`/api/ipc` dispatcher accepts any channel name from any localhost client',
    severity: 'warning',
    scope: 'architectural',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'server/index.ts',
        line: 4500,
        excerpt: 'app.post(\'/api/ipc\', async (req, res) => { … const handler = handlers.get(channel) … })',
        note: 'No origin check, no auth header, no per-channel ACL — open dispatcher by string lookup',
      },
      {
        file: 'server/index.ts',
        line: 705,
        excerpt: 'app.get(\'/api/ws-token\', (_req, res) => { res.json({ token: wsSessionToken }) })',
        note: 'WS upgrade is token-gated (line 720), but /api/ipc has no equivalent — inherits from binding only',
      },
    ],
    observed:
      'Any local process — a browser extension, a malicious VS Code extension, another Electron app on the same host, a curl from a terminal — can POST to localhost:<port>/api/ipc and invoke any handler in the registry. There is no CORS preflight enforcement, no Origin allowlist, and no per-channel authorisation. The two telemetry channels are the latest addition; this is a pre-existing design choice that grew with the surface.',
    rationale:
      'This is NOT a regression introduced by the telemetry change — it predates v0.3.0-beta.1. But because the security review is for the channel addition, the right posture is to name the inherited risk on the record. A malicious local actor could read consent state, flip consent to accepted (enabling telemetry against the user\'s wishes), or invoke any other handler — file reads, MCP tool calls, etc. The web build is alpha-gated to localhost in dev, but Electron-shelled builds host it on the same loopback.',
    proposedFix:
      'Out of scope for this contract. Track as a separate hardening pass: add a per-process token to /api/ipc similar to the WS auth flow at server/index.ts:712-728, or restrict to same-origin via Origin header check. Architectural scope so the verdict math classifies it as warning-not-blocking on this contract; if reclassified to blocking it would force REDESIGN. Recommend deferring to a dedicated SEC ticket post-beta.',
  },
  {
    id: 'SUG-1',
    title: 'Inline `as Promise<…>` cast pattern',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'src/adapters/web-api.ts',
        line: 613,
        excerpt: 'as Promise<import(\'../types/flint-api\').ConsentRecord>',
        note: 'Inline dynamic-import type, not a top-level `import type`',
      },
    ],
    observed:
      'The adapter uses an inline dynamic-import type annotation rather than a top-of-file import type. Most of the file uses inline annotations, so this matches local style — but a top-level import type would be slightly more discoverable.',
    rationale:
      'Stylistic only, not a security issue. Mentioned because if WARN-2 is implemented, the file will need a real top-level import for the Zod schemas anyway, and pulling the types up at the same time is a tidy combined edit.',
    proposedFix:
      'Add `import type { ConsentRecord, TelemetrySetConsentPayload } from \'../types/flint-api\'` at the top of src/adapters/web-api.ts and remove the inline type annotations.',
  },
  {
    id: 'SUG-2',
    title: 'Buffer not cleared on consent flip from accepted → declined',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'server/index.ts',
        line: 3484,
        excerpt: 'let webTelemetryBuffer: Array<{ name: string; payload: unknown; ts: string }> = []',
        note: 'Module-scoped buffer; not cleared on consent change',
      },
      {
        file: 'server/index.ts',
        line: 3599,
        excerpt: 'handlers.set(\'telemetry:set-consent\', async (payload: unknown) => { … writeFileSync(…) return next })',
        note: 'Handler writes new state but does not clear the buffer',
      },
    ],
    observed:
      'If a user accepts, generates events, then declines before the next 60-second flush, the buffered events still flush on the next interval. The events were captured during the accepted window so this is functionally correct — but a privacy-conscious user who declined "to stop sending data" might be surprised.',
    rationale:
      'Defensible either way. Conservative-privacy reading: declining drops buffered events even though they were captured under consent. Literal-consent reading: events were captured under consent, ship them. Both are valid; the project should pick one and document it. Current behaviour is literal-consent.',
    proposedFix:
      'Either (a) document current behaviour in TelemetryConsentDialog.tsx ("Decline stops new events; previously buffered events from this session may still send"), or (b) clear the buffer on transition to declined: `if (next.state === \'declined\') webTelemetryBuffer = []`. (b) is one line in the telemetry:set-consent handler.',
  },
]

const counts = countFindings(findings)
const verdict = deriveVerdict(findings, 'security')

export const REPORT: ReviewReport = {
  meta: {
    phase: 'TELEMETRY-WEB-TRANSPORT',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-26',
    round: 1,
    scope: [
      'src/adapters/web-api.ts (telemetry namespace addition)',
      'server/index.ts (telemetry handlers + flush + dispatcher)',
      'shared/ipc-validators.ts (telemetry Zod schemas)',
      'src/types/flint-api.d.ts (ConsentRecord types)',
      'cloudflare-worker/src/index.ts (full file)',
      'electron/main.ts (FLINT_TELEMETRY_SECRET grep + telemetry handlers)',
      'electron/preload.ts (telemetry namespace)',
      'electron/betaTelemetry.ts',
      'server/__tests__/telemetryIpc.test.ts (security pin TEL-06)',
      'electron/betaTelemetry.test.ts (test isolation)',
      'src/components/ui/TelemetryConsentDialog.tsx',
      'src/App.tsx (telemetry hook lines 786-811)',
    ],
    markdownFile: 'TELEMETRY-WEB-TRANSPORT-security-review-2026-04-26.md',
  },
  rubric: [
    { criterion: 'FLINT_TELEMETRY_SECRET not referenced in any IPC response builder', result: 'pass' },
    { criterion: 'Security pin test (TEL-06) uses sentinel value, not real secret', result: 'pass' },
    { criterion: 'Cloudflare Worker fail-closed without SHARED_SECRET', result: 'pass' },
    { criterion: 'Cloudflare Worker uses timing-safe comparison for X-Flint-Secret', result: 'pass' },
    { criterion: 'Cloudflare Worker rejects oversized bodies (DOS guard, MAX_BODY_BYTES = 64KB)', result: 'pass' },
    { criterion: 'Cloudflare Worker uses discriminated union (no extra event types accepted)', result: 'pass' },
    { criterion: 'Slack mrkdwn injection neutralised (escapeForSlackInlineCode)', result: 'pass' },
    { criterion: 'Server-side webEmit() gates on consent state before pushing to buffer', result: 'pass' },
    { criterion: 'Telemetry IPC payload validated with Zod at preload (Electron path)', result: 'pass' },
    { criterion: 'Telemetry IPC response validated with Zod at preload (Electron path)', result: 'pass' },
    {
      criterion: 'Telemetry IPC response validated at web adapter (web path)',
      result: 'fail',
      evidence: 'src/adapters/web-api.ts:613-616 — cast only, no Zod parse',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'Telemetry schemas registered as entries in the ipcSchemas map',
      result: 'fail',
      evidence: 'shared/ipc-validators.ts:581-590 — named exports only, not in registry map',
      relatedFindings: ['WARN-1'],
    },
    { criterion: 'Server-side handler validates payload (web path, telemetry:set-consent)', result: 'pass' },
    { criterion: 'Web adapter introduces no new transitive imports', result: 'pass' },
    {
      criterion: '/api/ipc dispatcher has channel allowlist or origin check',
      result: 'fail',
      evidence: 'server/index.ts:4500-4539 — open dispatcher by string lookup, no auth or origin check',
      relatedFindings: ['WARN-3'],
    },
    { criterion: 'Browser cannot cause server to emit telemetry without prior accepted consent', result: 'pass' },
    { criterion: 'WebSocket upgrade authenticated via session token', result: 'pass' },
    { criterion: 'Buffer behaviour on consent flip documented or implemented', result: 'n/a' },
  ],
  findings,
  counts,
  verdict,
  scopeCoverage: {
    reviewed: [
      'src/adapters/web-api.ts',
      'server/index.ts:3456-3612',
      'server/index.ts:4500-4539 (dispatcher)',
      'shared/ipc-validators.ts:570-592',
      'src/types/flint-api.d.ts:1744-1764',
      'cloudflare-worker/src/index.ts',
      'electron/main.ts:5693-5705',
      'electron/preload.ts:1688-1707',
      'electron/betaTelemetry.ts:32',
      'electron/betaTelemetry.test.ts:80-94, 356-470',
      'server/__tests__/telemetryIpc.test.ts:400-466',
      'src/components/ui/TelemetryConsentDialog.tsx',
      'src/App.tsx:786-811',
      '.flint-context/contracts/TELEMETRY-WEB-TRANSPORT.contract.ts',
    ],
    skipped: [
      'electron/thumbnailGenerator.ts — out of scope per task framing (pre-existing TSC errors)',
      'electron/visualAuditor.ts — out of scope per task framing (pre-existing TSC errors)',
      'flint-mcp/src/server.ts — telemetry path does not invoke MCP tools',
      'Non-telemetry IPC handlers in server/index.ts and electron/main.ts — out of scope',
    ],
  },
}
