import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

// Round 2 (re-review, 2026-04-25)
// ─────────────────────────────────
// Round 1 BLK-1 (schema validation), BLK-2 (Slack escape), BLK-3 (fail-closed),
// and WARN-4 (retention) all RESOLVED in code. They are intentionally absent
// from this round's `findings` array so deriveVerdict() reflects the current
// state of the Worker — see RESOLVED_FROM_ROUND_1 below for the audit trail.
// Verdict: FIX-FORWARD (3 warnings + 3 suggestions remain, none blocking).
// The round-1 markdown is preserved in the sibling .md file under
// "Original Review (… superseded …)" with per-finding RESOLVED markers.

export const RESOLVED_FROM_ROUND_1 = [
  {
    id: 'BLK-1',
    resolution:
      'cloudflare-worker/src/index.ts:36-86 — Zod discriminated union over 5 literal event names + per-event payload schemas. safeParse at 126; 400 on failure.',
  },
  {
    id: 'BLK-2',
    resolution:
      'cloudflare-worker/src/index.ts:192-209 — escapeForSlackInlineCode strips backticks and HTML-escapes &/</>; every dynamic field is escaped AND wrapped in inline-code backticks.',
  },
  {
    id: 'BLK-3',
    resolution:
      "cloudflare-worker/src/index.ts:109-112 — returns 503 when SHARED_SECRET is missing or whitespace; runs before auth check.",
  },
  {
    id: 'WARN-4',
    resolution:
      'cloudflare-worker/src/index.ts:93 — KV_TTL_SECONDS = 60*60*24*14 (14 days, down from 90).',
  },
] as const;

const findings: ReviewFinding[] = [
  {
    id: 'WARN-1',
    title: 'Secret comparison is not constant-time',
    severity: 'warning',
    evidence: [
      {
        file: 'cloudflare-worker/src/index.ts',
        line: 115,
        excerpt: 'if (provided !== env.SHARED_SECRET)',
      },
    ],
    observed:
      'Plain string `!==` short-circuits on the first differing byte, leaking length and prefix information through timing.',
    rationale:
      'Workers run on shared infrastructure with variable latency, so practical exploitation is hard but not impossible. Easy and cheap to fix.',
    proposedFix:
      'Use crypto.subtle.timingSafeEqual after encoding both sides as Uint8Array. Compare lengths first.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'WARN-2',
    title: 'No rate limiting per IP or per secret',
    severity: 'warning',
    evidence: [
      {
        file: 'cloudflare-worker/src/index.ts',
        line: 96,
        note: 'fetch handler has no rate-limit logic. Batch size now capped to 100 (partial mitigation).',
      },
    ],
    observed:
      'No cf-connecting-ip-based throttle, no per-secret budget. Batch size cap of 100 is the only bound.',
    rationale:
      'A leaked secret means high-rate KV writes (cost) and Slack messages (rate-limit collisions, eventual webhook disable).',
    proposedFix:
      'Add a Durable Object or KV-backed token bucket keyed on cf-connecting-ip + secret hash. Cap to ~60 req/min.',
    scope: 'cross-file',
    status: 'open',
  },
  {
    id: 'WARN-3',
    title: 'No CORS or Origin restriction',
    severity: 'warning',
    evidence: [
      {
        file: 'cloudflare-worker/src/index.ts',
        line: 103,
        excerpt: "if (request.method !== 'POST' || url.pathname !== '/events')",
        note: 'No OPTIONS handler, no Origin check, no Access-Control-* headers.',
      },
    ],
    observed:
      'No explicit CORS rejection. Custom X-Flint-Secret header forces a preflight which the Worker does not handle, so browser misuse fails by accident.',
    rationale:
      'Defense in depth. The endpoint is for the Electron app (Node origin); browsers should be explicitly denied.',
    proposedFix:
      'Add explicit OPTIONS handler returning 405 or denying CORS.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'WARN-5',
    title: 'Errors swallowed silently (Slack + KV)',
    severity: 'warning',
    evidence: [
      {
        file: 'cloudflare-worker/src/index.ts',
        line: 141,
        excerpt: "try { await forwardToSlack(...) } catch { /* swallow */ }",
      },
      {
        file: 'cloudflare-worker/src/index.ts',
        line: 138,
        excerpt: 'ctx.waitUntil(storeInKV(events, env))',
        note: 'No .catch on the waitUntil promise.',
      },
    ],
    observed:
      'Slack 4xx/5xx, webhook disabled, KV write failure — all invisible. Operator finds out by checking the empty Slack channel.',
    rationale:
      'Operations hygiene. Beta is short; you need to know if telemetry breaks.',
    proposedFix:
      'console.error from inside the catch (Workers Observability captures stderr). Add .catch(err => console.error(...)) to the waitUntil promise.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-1',
    title: 'No body size cap',
    severity: 'suggestion',
    evidence: [
      {
        file: 'cloudflare-worker/src/index.ts',
        line: 121,
        excerpt: 'rawBody = await request.json()',
        note: 'No Content-Length check before parsing. Batch cap of 100 partially mitigates.',
      },
    ],
    observed:
      'Cloudflare hard limit is 100MB. Schema validation (max 100 events) bounds successful requests but does not bound parsing of malicious oversize bodies.',
    rationale: 'Cost and DoS surface area.',
    proposedFix: 'Reject Content-Length > 256KB before parsing.',
    scope: 'one-line',
    status: 'open',
  },
  {
    id: 'SUG-2',
    title: 'Slack forwarding has no idempotency / dedup',
    severity: 'suggestion',
    evidence: [
      {
        file: 'cloudflare-worker/src/index.ts',
        line: 160,
        excerpt: 'async function forwardToSlack(events, webhookUrl)',
      },
    ],
    observed:
      'Replaying the same batch creates duplicate Slack messages. KV is naturally idempotent because the key includes e.id, but Slack is not.',
    rationale: 'Replay attack with leaked secret = Slack channel flood.',
    proposedFix:
      'Use the batch first e.id as a KV.get lookup before forwarding to Slack; skip if seen in last N minutes.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-3',
    title: 'Observability enabled — verify secret header is not logged',
    severity: 'suggestion',
    evidence: [
      {
        file: 'cloudflare-worker/wrangler.toml',
        line: 15,
        excerpt: '[observability]\nenabled = true',
      },
    ],
    observed:
      'Cloudflare Workers Observability captures invocation metadata. Need to confirm X-Flint-Secret value is redacted in tail logs.',
    rationale:
      'If logs are shared with collaborators or stored long-term, leaked secret values would compromise the auth gate.',
    proposedFix:
      'Verify in `wrangler tail` output; if visible, rename header and document operator rotation procedure.',
    scope: 'one-line',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'CLOUDFLARE-WORKER',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-25',
    round: 2,
    scope: [
      'cloudflare-worker/src/index.ts',
      'cloudflare-worker/package.json',
    ],
    markdownFile: 'CLOUDFLARE-WORKER-security-review-2026-04-25.md',
  },
  rubric: [
    { criterion: 'Shared secret stored in env, not source', result: 'pass' },
    { criterion: 'Slack webhook URL stored in env, not source', result: 'pass' },
    {
      criterion: 'Constant-time secret comparison',
      result: 'fail',
      evidence: 'cloudflare-worker/src/index.ts:115 still uses !== on raw strings',
      relatedFindings: ['WARN-1'],
    },
    {
      criterion: 'Server-side schema validation of incoming events',
      result: 'pass',
      evidence: 'cloudflare-worker/src/index.ts:36-86 Zod discriminated union; safeParse at 126 (resolves round-1 BLK-1)',
    },
    {
      criterion: 'Event-name allowlist enforced server-side',
      result: 'pass',
      evidence: 'z.literal entries for the 5 known event names; unknown names fail discriminated union (resolves round-1 BLK-1)',
    },
    {
      criterion: 'Fail-closed when SHARED_SECRET unconfigured',
      result: 'pass',
      evidence: 'cloudflare-worker/src/index.ts:109-112 returns 503 when secret missing or whitespace (resolves round-1 BLK-3)',
    },
    {
      criterion: 'User-controlled strings escaped before Slack mrkdwn',
      result: 'pass',
      evidence: 'cloudflare-worker/src/index.ts:192-209 escape + inline-code wrap on every dynamic field (resolves round-1 BLK-2)',
    },
    {
      criterion: 'Per-IP or per-secret rate limiting',
      result: 'fail',
      evidence: 'No rate-limit logic; batch cap of 100 is partial mitigation only',
      relatedFindings: ['WARN-2'],
    },
    {
      criterion: 'Body size cap before JSON parse',
      result: 'fail',
      evidence: 'cloudflare-worker/src/index.ts:121 parses without Content-Length check',
      relatedFindings: ['SUG-1'],
    },
    {
      criterion: 'KV retention matches stated privacy claim',
      result: 'pass',
      evidence: 'cloudflare-worker/src/index.ts:93 KV_TTL_SECONDS = 14 days (resolves round-1 WARN-4)',
    },
    {
      criterion: 'Operational error visibility (Slack + KV failures logged)',
      result: 'fail',
      evidence: 'cloudflare-worker/src/index.ts:138,141 still silent swallow',
      relatedFindings: ['WARN-5'],
    },
    { criterion: 'No eval or dynamic code execution', result: 'pass' },
    { criterion: 'No unsafe runtime dependencies', result: 'pass', evidence: 'zod ^3.22.3 added — well-audited, no native code or postinstall hooks' },
    { criterion: 'KV key format is idempotent', result: 'pass' },
    { criterion: 'No regressions introduced by fix patch', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'cloudflare-worker/src/index.ts',
      'cloudflare-worker/package.json',
    ],
    skipped: [
      'cloudflare-worker/wrangler.toml — unchanged since prior review',
      'cloudflare-worker/node_modules/** — third-party, out of scope',
      'Glass-side telemetry sender — covered by beta-telemetry-wiring review',
    ],
  },
};
