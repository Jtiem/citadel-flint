import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'WARN-S-1',
    title: 'app.crashed.message field is not redacted',
    severity: 'warning',
    scope: 'one-line',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 267,
        excerpt: "message: String(err?.message ?? err),",
        note: 'Only `stack` is passed through redactHomedir(); `message` is raw.',
      },
      {
        file: 'electron/betaTelemetry.ts',
        line: 266,
        excerpt: "const redactedStack = redactHomedir(rawStack).slice(0, 2000)",
      },
    ],
    observed:
      'The app.crashed payload redacts stack via redactHomedir() but emits message raw. Runtime errors frequently include absolute paths in err.message (ENOENT, JSON.parse, Babel errors).',
    rationale:
      'The consent dialog promises that "no file contents or design data leave your machine." A crash message containing a project path leaks directory structure — on a designer machine often encoding client / employer names. The privacy promise is enforced for stack but silently waived for message, creating a contradiction between promise and behavior.',
    proposedFix:
      "Wrap message in redactHomedir(): `message: redactHomedir(String(err?.message ?? err))`. One-line change at electron/betaTelemetry.ts:268.",
  },
  {
    id: 'WARN-S-2',
    title: 'No HTTPS / scheme enforcement on FLINT_TELEMETRY_URL',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 31,
        excerpt: "const TELEMETRY_URL = process.env.FLINT_TELEMETRY_URL || ''",
      },
      {
        file: 'electron/betaTelemetry.ts',
        line: 207,
        excerpt: "const res = await net.fetch(TELEMETRY_URL, {",
        note: 'X-Flint-Secret header set on line 206 before this call.',
      },
    ],
    observed:
      'TELEMETRY_URL is taken from env without scheme validation. If set to http://, payloads and the X-Flint-Secret shared secret travel cleartext. No certificate pinning.',
    rationale:
      "The privacy claim depends on data going to one trusted endpoint. Accepting any URL from the environment means an attacker who can set env vars (malicious launcher, supply-chain compromise of a parent process) can both exfiltrate events and capture the shared secret to authenticate further calls.",
    proposedFix:
      "Reject non-https URLs at module init: `if (TELEMETRY_URL && !TELEMETRY_URL.startsWith('https://')) TELEMETRY_URL = ''` plus a console.warn. Optionally pin to a host allowlist for the closed beta.",
  },
  {
    id: 'WARN-S-3',
    title: 'Stack redaction does not cover non-homedir absolute paths',
    severity: 'warning',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 141,
        excerpt:
          "function redactHomedir(text: string): string { … re = new RegExp(escaped + '[\\/\\\\\\\\]?', 'g') … }",
        note: 'Only the current os.homedir() substring is redacted.',
      },
    ],
    observed:
      'redactHomedir() replaces only the running user homedir. Stack traces routinely include other absolute paths: /opt/, /private/var/folders/, /tmp/, /usr/local/lib/node_modules/, and any project opened outside the home directory (e.g., /Volumes/Clients/<client>/, /mnt/work/<employer>/).',
    rationale:
      "The contract's stack-redaction invariant is literally satisfied for the homedir, but the broader privacy claim is not. Designers on shared mounts leak organization / client names through directory paths in stack frames.",
    proposedFix:
      "Reduce stack frames to filename + line/col, stripping all directory components: `text.replace(/(?:\\/[^\\s:'\"]+\\/)+([^/\\s:'\"]+:\\d+:\\d+)/g, '<path>/$1')`. The stack still localizes the bug.",
  },
  {
    id: 'SUG-S-1',
    title: 'Web build does not mirror Electron emit sites',
    severity: 'suggestion',
    scope: 'cross-file',
    status: 'open',
    evidence: [
      {
        file: 'server/index.ts',
        line: 3385,
        excerpt: "function startTelemetry(): void { /* no-op for web build */ }",
      },
      {
        file: '.flint-context/contracts/BETA-TELEMETRY-WIRING-contract.md',
        line: 31,
        excerpt: 'Web parity: mirror IPC channels over WS; same emit sites.',
      },
    ],
    observed:
      'The web build accepts and stores consent but produces zero events. Contract §1 asserts "same emit sites as electron/main.ts" — server/index.ts has no telemetryEmit calls.',
    rationale:
      'Privacy-wise this is the safer deviation (web emits nothing regardless of consent). But it contradicts the contract\'s web-parity invariant, and a user who opts in on web sees a promise the build cannot fulfill in either direction. Worth deciding consciously rather than letting it drift.',
    proposedFix:
      'Either remove the consent dialog from the web build (no telemetry → no consent surface), or update the contract invariant to mark web as intentionally emit-disabled. Do not add web emit sites without re-evaluating the network/storage threat model for a server-deployed Glass.',
  },
  {
    id: 'SUG-S-2',
    title: 'X-Flint-Secret lives in process.env, not safeStorage',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 32,
        excerpt: "const TELEMETRY_SECRET = process.env.FLINT_TELEMETRY_SECRET || ''",
      },
    ],
    observed:
      'The shared secret authenticating the app to the telemetry endpoint is held in process memory, sourced from an env var. SEC.4 stores other Flint secrets in safeStorage with OS keychain encryption.',
    rationale:
      'For a closed beta with operator-injected secrets at packaging time, env-var trust is acceptable. Not acceptable for a public beta or production. Flagging now so the upgrade path is explicit before the threat model widens.',
    proposedFix:
      'Pre-production: move secret to safeStorage-encrypted config. Document trust model in the release runbook. No change required for the closed beta.',
  },
  {
    id: 'SUG-S-3',
    title: 'On-disk queue can grow unbounded when network is offline',
    severity: 'suggestion',
    scope: 'one-line',
    status: 'open',
    evidence: [
      {
        file: 'electron/betaTelemetry.ts',
        line: 224,
        excerpt: "persistQueue([...existing, ...memoryBuffer])",
      },
      {
        file: 'electron/betaTelemetry.ts',
        line: 212,
        excerpt: "if (res.ok) { memoryBuffer = []; persistQueue([]) }",
        note: 'Queue only cleared on successful POST.',
      },
    ],
    observed:
      'persistBuffer() always concatenates to existing disk events. If flush() keeps failing (offline, endpoint down, 5xx), the queue grows monotonically across quit + crash cycles with no size or age cap.',
    rationale:
      'Not a privacy violation — events are already consent-gated. But the launch path JSON.parses the entire queue synchronously, so unbounded growth eventually hits perceptible launch latency and disk-usage warnings.',
    proposedFix:
      'Cap queue length on persist: `persistQueue([...existing, ...memoryBuffer].slice(-1000))`. Optionally add a 14-day TTL on event timestamps.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'BETA.TEL',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-25',
    round: 1,
    scope: [
      'electron/preload.ts',
      'shared/ipc-validators.ts',
      'electron/main.ts (BETA.TEL handlers + emit sites)',
      'electron/betaTelemetry.ts',
      'server/index.ts (web parity block 3370-3426)',
      'src/types/flint-api.d.ts (telemetry surface)',
    ],
    markdownFile: 'BETA-TELEMETRY-WIRING-security-review-2026-04-25.md',
  },
  rubric: [
    { criterion: 'Consent gate prevents emit when state !== "accepted"', result: 'pass' },
    { criterion: 'mcp.tool_called payload contains only toolName', result: 'pass' },
    { criterion: 'audit.completed payload contains no file paths', result: 'pass' },
    { criterion: 'session.ended payload contains only durationMs', result: 'pass' },
    {
      criterion: 'Renderer surface exposes only getConsent + setConsent (no emit)',
      result: 'pass',
    },
    {
      criterion: 'IPC validators applied at preload AND main handler (defense in depth)',
      result: 'pass',
    },
    {
      criterion: 'Discriminated-union TelemetryEvent enforces payload shape at compile time',
      result: 'pass',
    },
    {
      criterion: 'Telemetry module imports electron; not reachable from src/',
      result: 'pass',
    },
    {
      criterion: 'Web build stub does not emit (privacy-safe degraded mode)',
      result: 'pass',
    },
    {
      criterion: 'Stack-trace homedir redaction covers macOS/Linux/Windows',
      result: 'pass',
    },
    {
      criterion: 'Crash-event message field redacted',
      result: 'fail',
      evidence: 'electron/betaTelemetry.ts:267 — message emitted raw',
      relatedFindings: ['WARN-S-1'],
    },
    {
      criterion: 'Outbound URL forced to HTTPS / scheme-checked',
      result: 'fail',
      evidence: 'electron/betaTelemetry.ts:31 — env var accepted as-is',
      relatedFindings: ['WARN-S-2'],
    },
    {
      criterion: 'Stack redaction covers non-homedir absolute paths (/opt, /Volumes, etc.)',
      result: 'fail',
      evidence: 'electron/betaTelemetry.ts:141 — only homedir substring is replaced',
      relatedFindings: ['WARN-S-3'],
    },
    {
      criterion: 'Web build mirrors all emit sites per contract §1',
      result: 'fail',
      evidence: 'server/index.ts:3385 — startTelemetry is no-op; no telemetryEmit calls',
      relatedFindings: ['SUG-S-1'],
    },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'electron/preload.ts:1670-1696',
      'shared/ipc-validators.ts:560-582',
      'electron/main.ts:16-17,821-829,2552-2557,3822-3823,5615-5627',
      'electron/betaTelemetry.ts (full file)',
      'server/index.ts:3370-3426',
      'src/types/flint-api.d.ts:1725-1745,2060-2080',
    ],
    skipped: [
      'src/components/ui/TelemetryConsentDialog.tsx — UX scope, separate reviewer',
      'cloudflare-worker/ — telemetry sink is non-goal per contract §9',
      'electron/main.ts other IPC channels — out of BETA.TEL scope',
    ],
  },
};
