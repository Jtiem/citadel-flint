/**
 * MINT.5 Phase 3 Security Review — Sync Polish + Type Safety
 * Pilot run (Lever A+B+E). Findings surfaced inline by flint-security-reviewer
 * (which lacks Write — a confirmed pilot finding); persisted by the parent
 * orchestrator into structured form for scripts/render-review.ts.
 */

import type { ReviewReport, ReviewFinding } from '../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'SUG-1',
    title: 'Tuple Zod schema vs positional invoke is functionally redundant but stylistically misleading',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    commandment: 14,
    evidence: [
      {
        file: 'electron/preload.ts',
        line: 806,
        excerpt: "validateIPC('mcp:call-tool', [name, args], mcpCallToolSchema)",
        note: "Validates a z.tuple([string, record])",
      },
      {
        file: 'electron/preload.ts',
        line: 832,
        excerpt: "ipcRenderer.invoke('mcp:call-tool', name, args)",
        note: 'Wire dispatches as two positional args, not a tuple.',
      },
    ],
    observed:
      'The Zod schema models a tuple shape, but the IPC wire actually carries two positional arguments. Validation and runtime are not modelling the same thing — they happen to validate equivalent content, but a future maintainer reading the schema may believe the wire shape is `[string, record]` when it is in fact `(string, record)`.',
    rationale:
      'No security impact today (the per-tool gate at 816 catches anything the outer gate misses, and main re-receives positional args). But future hardening of the main-side handler to use mcpCallToolSchema.parse(args) would silently fail because main sees [name, args] only via event.sender reassembly logic that does not exist.',
    proposedFix:
      'Either (a) document on the schema that the tuple is the *logical* payload not the wire payload, or (b) refactor the channel to send [name, args] as a single arg and parse on receipt. Defer to a future Zod-schema cleanup pass — not urgent.',
  },
  {
    id: 'SUG-2',
    title: 'Allowlist comment claims dryRun-default for flint_emit_tokens but no Zod schema enforces it',
    severity: 'suggestion',
    scope: 'one-file',
    status: 'open',
    evidence: [
      {
        file: 'shared/mcp-allowed-tools.ts',
        line: 11,
        note: 'Comment claims dryRun-default semantics for flint_emit_tokens',
      },
      {
        file: 'shared/ipc-validators.ts',
        line: 417,
        note: 'MCP_TOOL_ARG_SCHEMAS does NOT contain a flint_emit_tokens entry — unknown tools fall through unvalidated.',
      },
    ],
    observed:
      'flint_emit_tokens is in the SEC.3 allowlist (renderer-callable) but has no per-tool Zod schema. Per the documented contract, unknown tools "pass through unchanged" — so a malicious renderer-side call site could pass arbitrary args to flint_emit_tokens (including omitting dryRun:true) and the gate would not stop it. The dryRun-default behaviour is enforced only in useEmitTokens.ts (out of scope) and a ConfirmEmitDialog UI gate.',
    rationale:
      'By design per Phase 3 contract (5 sync tools schema\'d; emit deferred to Phase 4). But the comment in mcp-allowed-tools.ts may mislead a future reader into thinking the per-tool schema enforces dryRun. The actual defense is UI-shaped, not schema-shaped.',
    proposedFix:
      'Add flint_emit_tokens to MCP_TOOL_ARG_SCHEMAS in a follow-up phase with a schema that requires { dryRun: z.literal(true).optional() } plus the destructive form gated behind a separate allowlist tool (e.g. flint_emit_tokens_write). Track as Phase 4 backlog.',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'MINT.5-phase3',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-19',
    round: 1,
    scope: [
      'shared/ipc-validators.ts (Phase 3 additions 358-425)',
      'shared/mcp-allowed-tools.ts (full file)',
      'electron/mcpClient.ts (callTool 167-176; types 39-44)',
      'server/mcpClient.ts (callTool 140-149; types 24-29)',
      'electron/preload.ts (mcp.callTool block 797-833)',
      'server/index.ts (mcp:call-tool handler 2586-2618)',
      'shared/mcp-classification.ts (cross-checked for rubric #9 trust boundary)',
    ],
    markdownFile: 'MINT.5-phase3-security-review-2026-04-19.md',
  },
  rubric: [
    { criterion: 'SEC.3 allowlist integrity (only flint_emit_tokens added)', result: 'pass', evidence: 'shared/mcp-allowed-tools.ts:21-38 — 13 entries, Object.freeze\'d' },
    { criterion: 'Validation gate ordering (sync, before ipcRenderer.invoke)', result: 'pass', evidence: 'electron/preload.ts:806-832; server/index.ts:2588-2617 mirrors' },
    { criterion: 'Append-only Zod additions (Phase 2 untouched)', result: 'pass', evidence: 'shared/ipc-validators.ts:39-269 unchanged; Phase 3 additions in 358-425 with delimiter comments' },
    { criterion: '.strict() on all 5 new schemas', result: 'pass', evidence: 'shared/ipc-validators.ts:380, 385, 391, 398, 403' },
    { criterion: 'No info leak in validation-error envelope', result: 'pass', evidence: 'preload.ts:820-823 + server/index.ts:2605-2608 surface only "${path}: ${message}" from Zod issue; raw args never reflected' },
    { criterion: 'Cross-process parity (preload ↔ server, mcpClient electron ↔ server)', result: 'pass', evidence: 'server/mcpClient.ts:140-149 line-equivalent to electron/mcpClient.ts:167-176; both import MCP_TOOL_ARG_SCHEMAS from single source' },
    { criterion: "agentId='renderer' hardcoded path preserved", result: 'pass', evidence: 'Phase 3 does not regress; web handler at server/index.ts:2586 takes only (name, args), no agent field' },
    { criterion: 'No new IPC channels added', result: 'pass', evidence: 'preload.ts and server/index.ts add no ipcMain.handle / handlers.set beyond existing mcp:call-tool' },
    { criterion: 'Trust boundary on classification field (server-derived, not server-supplied)', result: 'pass', evidence: 'electron/mcpClient.ts:170-175 + server/mcpClient.ts:143-148 — { ...raw, classification } means locally-computed classification overrides any server-supplied value; classifier derives only from rawText/isError/status' },
    { criterion: 'Validation timing within budget (per-tool < 1ms)', result: 'pass', evidence: 'Per-tool path is single safeParse on a 2-3-key strict object; no I/O, no async' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'shared/ipc-validators.ts (Phase 3 additions only)',
      'shared/mcp-allowed-tools.ts',
      'electron/mcpClient.ts (Phase 3 sections)',
      'server/mcpClient.ts (Phase 3 sections)',
      'electron/preload.ts (mcp.callTool block 797-833)',
      'server/index.ts (mcp:call-tool handler 2586-2618)',
      'shared/mcp-classification.ts (cross-scope read for rubric #9)',
    ],
    skipped: [
      'All in-scope test files — security review focuses on production attack surface; security-relevant invariants verified via production code paths',
      'electron/preload.ts outside lines 797-833 (rest of file out of Phase 3 scope)',
    ],
  },
};
