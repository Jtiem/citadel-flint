import type { ReviewReport, ReviewFinding } from '../../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'SEC-MED-1',
    severity: 'medium',
    title: 'file:read self-hosting guard bypass admits arbitrary demos/ and tmpdir reads',
    dimension: 'security',
    commandment: 14,
    evidence: [
      { file: 'server/index.ts', line: 934, excerpt: "extraAllowedRoots: [tmpRealRoot]" },
      { file: 'server/index.ts', line: 946, excerpt: "if (isDemoRead(resolved)) return" },
    ],
    observed:
      'Web file:read handler adds the OS tmpdir as an allowed root and exempts any path under <serverRoot>/demos/ from the self-hosting guard. Renderer can now read arbitrary .tsx/.ts/.jsx/.js/.html/.vue/.svelte files anywhere under os.tmpdir().',
    rationale:
      'The carve-out targets beta demo extraction (os.tmpdir()) and the repo demos/ subtree but is too broad — tmpdir accepts any extracted archive, other users cache contents under shared tmp, and the demos/ prefix match covers any future symlinks vendored into that tree. Reads only; no write vector, but the workspace boundary invariant is weakened.',
    proposedFix:
      'Pin the tmpdir exception to the specific flint-demo-* subdirectory created by beta:load-demo-project (store it on activeProjectRoot or a parallel state slot). Replace the wholesale demos/ prefix match with an allowlist of the specific demo paths advertised by the LaunchScreen manifest.',
    status: 'open',
  },
  {
    id: 'SEC-LOW-1',
    severity: 'low',
    title: 'mcp:call-tool payload schema permissive; 8 of 13 allowlisted tools lack per-tool shape gates',
    dimension: 'security',
    commandment: 9,
    evidence: [
      { file: 'shared/ipc-validators.ts', line: 261, excerpt: "payload: z.tuple([z.string().min(1), z.record(z.unknown())])" },
      { file: 'shared/ipc-validators.ts', line: 417, excerpt: "export const MCP_TOOL_ARG_SCHEMAS: Record<string, ..." },
      { file: 'shared/mcp-allowed-tools.ts', line: 21, excerpt: "RENDERER_ALLOWED_MCP_TOOLS" },
    ],
    observed:
      'MCP_TOOL_ARG_SCHEMAS only covers the 5 sync tools (pull/push/resolve_all/resolve_conflict/sync_check). The other 8 allowlisted tools — including flint_emit_tokens and flint_figma_connect — pass through the preload gate with no argument-shape validation.',
    rationale:
      'A compromised renderer (or misbehaving caller) could forward unexpected keys. Most remaining tools are read-oriented so blast radius is bounded, but flint_emit_tokens has a write path gated only by a UI dialog.',
    proposedFix:
      'Author strict Zod schemas for the remaining 8 tools and register them in MCP_TOOL_ARG_SCHEMAS. Alternatively, document a deliberate pass-through policy in mcp-allowed-tools.ts with per-tool justification.',
    status: 'open',
  },
  {
    id: 'SEC-LOW-2',
    severity: 'low',
    title: 'Classification substring matches unanchored — benign numbers can trigger auth-expired banner',
    dimension: 'security',
    commandment: null,
    evidence: [
      { file: 'shared/mcp-classification.ts', line: 48, excerpt: "'401'" },
      { file: 'shared/mcp-classification.ts', line: 60, excerpt: "'429'" },
    ],
    observed:
      'Tokens like 401/429/unauthorized are matched as unanchored substrings. A tool output such as "Found 401 tokens" would classify as auth-expired and surface the persistent Figma-connection-expired banner.',
    rationale:
      'UX-only consequence (banner copy + persistence). Classification never alters the user-visible message; sanitizer runs after classification on the original text.',
    proposedFix:
      'Anchor status-code tokens to word boundaries (\\b401\\b, \\b429\\b). Leave word patterns unanchored.',
    status: 'open',
  },
  {
    id: 'SEC-INFO-1',
    severity: 'info',
    title: 'Preload validation-gate correctly short-circuits IPC on bad args',
    dimension: 'security',
    commandment: 9,
    evidence: [
      { file: 'electron/preload.ts', line: 817, excerpt: 'return Promise.resolve({ ... classification: "validation-error" })' },
      { file: 'server/index.ts', line: 2608, excerpt: 'return { ... classification: "validation-error" }' },
    ],
    observed:
      'Both bridges construct a validation-error envelope locally and never call ipcRenderer.invoke / mcpClient.callTool when per-tool Zod parse fails. Sanitized message uses issue path + message; no payload echoing.',
    rationale:
      'Invariant validation-gate-zero-network holds on both Electron and web paths. Classification field is set consistently.',
    proposedFix: null,
    status: 'resolved',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'MINT.5-phase3',
    dimension: 'security',
    reviewer: 'flint-security-reviewer',
    date: '2026-04-20',
    round: 1,
    scope: [
      'shared/ipc-validators.ts',
      'shared/mcp-allowed-tools.ts',
      'shared/mcp-classification.ts',
      'electron/mcpClient.ts',
      'server/mcpClient.ts',
      'electron/preload.ts:diff@80d465c..1db3e7f',
      'server/index.ts:diff@80d465c..1db3e7f',
      'src/hooks/useSyncActions.ts',
    ],
    markdownFile: 'MINT.5-phase3-security-review-2026-04-20-scoped.md',
  },
  rubric: [
    { criterion: 'All renderer→main IPC channels validate input via Zod', result: 'partial' },
    { criterion: 'No Node.js module imports in src/', result: 'pass' },
    { criterion: 'No secrets hardcoded in source', result: 'pass' },
    { criterion: 'Renderer tool allowlist is main-process-owned and immutable', result: 'pass' },
    { criterion: 'Error sanitization runs before user-visible surfacing', result: 'pass' },
    { criterion: 'Classification single-source-of-truth across Electron + web', result: 'pass' },
    { criterion: 'file:read workspace boundary intact', result: 'partial' },
    { criterion: 'Validation-gate zero-network invariant', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'security'),
  scopeCoverage: {
    reviewed: [
      'shared/ipc-validators.ts',
      'shared/mcp-allowed-tools.ts',
      'shared/mcp-classification.ts',
      'electron/mcpClient.ts',
      'server/mcpClient.ts',
      'electron/preload.ts (diff)',
      'server/index.ts (diff)',
      'src/hooks/useSyncActions.ts',
    ],
    skipped: [
      'shared/errorSanitizer.ts — out of scope; behavior inferred from call site',
      'electron/main.ts mcp:call-tool handler — out of scope (Lever A = preload + diff only)',
    ],
  },
};
