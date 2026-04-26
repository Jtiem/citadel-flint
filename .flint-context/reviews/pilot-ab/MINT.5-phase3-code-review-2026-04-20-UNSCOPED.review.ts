import type { ReviewReport, ReviewFinding } from '../../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'UNSCOPED-W1',
    severity: 'warning',
    domain: 'code',
    title: 'Rate-limit classification is persistent without retry signal',
    observed:
      "useEmitTokens.ts:163 sets persistent=true for classification==='rate-limited', so the toast is sticky (autoDismissMs=0, severity=critical).",
    rationale:
      'Rate-limit 429s typically self-resolve in seconds. Treating them as persistent strands the critical chip with no clearing mechanism short of a manual retry.',
    evidence: [{ file: 'src/hooks/useEmitTokens.ts', line: 163 }],
    recommendation:
      "Either attach a retry-after countdown or demote rate-limited to transient (autoDismissMs=30000).",
  },
  {
    id: 'UNSCOPED-W2',
    severity: 'warning',
    domain: 'code',
    title: 'useSyncStaleness effect missing projectRoot in deps',
    observed:
      "useSyncStaleness.ts:184 uses 'eslint-disable-next-line react-hooks/exhaustive-deps' and only depends on [enabled, pollIntervalMs]. projectRoot propagates via ref only.",
    rationale:
      'A hot project switch without toggling `enabled` delays staleness detection for the new root by up to 60s. Minor UX lag.',
    evidence: [{ file: 'src/hooks/useSyncStaleness.ts', line: 184 }],
    recommendation: 'Include projectRoot in dep array; ref already exists for steady-state.',
  },
  {
    id: 'UNSCOPED-W3',
    severity: 'warning',
    domain: 'code',
    title: 'formatHours renders negative durations',
    observed:
      'SyncStalenessBanner formatHours(-0.5) returns "-30 minutes". No negative-guard before Math.round.',
    rationale:
      'shared/syncStaleness.ts guards against future timestamps in isSyncStale, but the banner still renders unusable copy if a caller supplies a negative hoursSinceSync with isStale=true.',
    evidence: [{ file: 'src/components/ui/mint/SyncStalenessBanner.tsx', line: 92 }],
    recommendation: 'Clamp: if (hours < 0) return "a few moments"',
  },
  {
    id: 'UNSCOPED-W4',
    severity: 'warning',
    domain: 'code',
    title: 'EmitDropdown focusedIndex forward-compat risk',
    observed:
      'MENU_ITEMS is module-scoped from buildMenuItems(); focusedIndex has no clamp against length changes.',
    rationale:
      'Fine today (static platform list). Breaks silently if Phase 4 makes the list runtime-configurable.',
    evidence: [{ file: 'src/components/ui/mint/EmitDropdown.tsx', line: 78 }],
    recommendation: 'Clamp focusedIndex inside the open effect or move the list to state.',
  },
  {
    id: 'UNSCOPED-W5',
    severity: 'warning',
    domain: 'code',
    title: 'MCP per-tool validation gate duplicated across preload and web server',
    observed:
      'electron/preload.ts:810-829 and server/index.ts:2594-2616 both implement the same gate structure and envelope manually.',
    rationale:
      'Schemas are single-source, but the gate logic is copy-pasted. Drift risk if one side adds logging, telemetry, or response-shape changes.',
    evidence: [
      { file: 'electron/preload.ts', line: 810 },
      { file: 'server/index.ts', line: 2594 },
    ],
    recommendation: 'Extract validateMcpToolArgs() helper in shared/ipc-validators.ts.',
  },
  {
    id: 'UNSCOPED-W6',
    severity: 'warning',
    domain: 'code',
    title: 'classification field still optional; keyword backstop still live',
    observed:
      'MCPCallResult.classification is optional; useSyncActions.ts:97 isPersistentError retains keyword matching as backstop.',
    rationale:
      'Both main-process clients now always populate classification. The `?` keeps the legacy branch alive beyond its useful window.',
    evidence: [
      { file: 'shared/mcp-classification.ts', line: 25 },
      { file: 'electron/mcpClient.ts', line: 44 },
      { file: 'server/mcpClient.ts', line: 28 },
      { file: 'src/hooks/useSyncActions.ts', line: 92 },
    ],
    recommendation: 'Remove `?`, drop keyword backstop, bump the internal type to a required field.',
  },
  {
    id: 'UNSCOPED-W7',
    severity: 'warning',
    domain: 'code',
    title: 'ConfirmEmitDialog shows a UI-guessed output dir',
    observed:
      "TokenManager.tsx sets emitOutputDir = `${projectPath || '.'}/.flint/platform-tokens` as the string shown in the confirm dialog.",
    rationale:
      'The MCP tool resolves the actual write path on the main side; UI string may diverge. User confirms based on displayed path — divergence erodes trust.',
    evidence: [{ file: 'src/components/ui/TokenManager.tsx' }],
    recommendation:
      'Pre-flight a dryRun to learn the resolved outputDir, or pass an explicit outputDir arg through to the tool.',
  },
  {
    id: 'UNSCOPED-W8',
    severity: 'warning',
    domain: 'code',
    title: 'Network-error patterns miss EAI_AGAIN',
    observed:
      "NETWORK_ERROR_PATTERNS includes econnrefused/enotfound/etimedout/... but not 'eai_again' or 'getaddrinfo'.",
    rationale:
      "Intermittent DNS failures from Node surface as 'getaddrinfo EAI_AGAIN' and would fall through to 'tool-error' instead of the network-error branch.",
    evidence: [{ file: 'shared/mcp-classification.ts', line: 65 }],
    recommendation: "Add 'eai_again' and 'getaddrinfo' to NETWORK_ERROR_PATTERNS.",
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'MINT.5.3',
    dimension: 'code',
    reviewer: 'flint-code-reviewer (UNSCOPED control)',
    date: '2026-04-20',
    round: 1,
    scope: [
      '28 files changed in commit 1db3e7f',
      'shared/ (classification, staleness, ipc-validators, allowed-tools)',
      'electron/ (mcpClient, preload) + tests',
      'server/ (mcpClient, index) + tests',
      'src/hooks/ (useEmitTokens, useSyncActions, useSyncStaleness) + tests',
      'src/store/ (syncStalenessStore) + tests',
      'src/components/ui/ (TokenHealthBar, mint/EmitDropdown, ConfirmEmitDialog, SyncStalenessBanner) + tests',
    ],
    markdownFile: 'MINT.5-phase3-code-review-2026-04-20-UNSCOPED.md',
  },
  rubric: [
    { criterion: 'npx tsc --noEmit exits 0', result: 'pass' },
    { criterion: 'No Node.js imports in src/', result: 'pass' },
    { criterion: 'All window.flintAPI calls in hooks/components, not stores', result: 'pass' },
    { criterion: 'MCP per-tool schemas validated at both preload + server bridges', result: 'pass' },
    { criterion: 'Renderer allowlist frozen with explicit test (emit-renderer-allowlist-frozen)', result: 'pass' },
    { criterion: 'Classification parity electron↔server mcpClient', result: 'pass' },
    { criterion: 'Hook exhaustive-deps justified for refs', result: 'partial', evidence: 'projectRoot should be in deps' },
    { criterion: 'ARIA menu + dialog patterns on new UI', result: 'pass' },
    { criterion: 'Destructive write gated by ConfirmEmitDialog (Commandment 1)', result: 'pass' },
    { criterion: 'Single source of truth for MCP validation logic', result: 'partial', evidence: 'schemas SSoT; gate logic duplicated' },
    { criterion: 'Tests cover happy path + error paths + serialization', result: 'pass' },
  ],
  findings,
  counts: countFindings(findings),
  verdict: deriveVerdict(findings, 'code'),
  scopeCoverage: {
    reviewed: [
      'shared/mcp-classification.ts',
      'shared/syncStaleness.ts',
      'shared/ipc-validators.ts',
      'shared/mcp-allowed-tools.ts',
      'electron/mcpClient.ts',
      'electron/preload.ts (diff)',
      'electron/__tests__/preload.mcp-validation.test.ts',
      'electron/__tests__/mcp-policy.test.ts (diff)',
      'server/mcpClient.ts',
      'server/index.ts (diff)',
      'server/__tests__/mcpClient.test.ts (diff)',
      'src/hooks/useEmitTokens.ts',
      'src/hooks/useSyncActions.ts',
      'src/hooks/useSyncStaleness.ts',
      'src/store/syncStalenessStore.ts',
      'src/components/ui/TokenHealthBar.tsx',
      'src/components/ui/TokenManager.tsx (diff)',
      'src/components/ui/mint/EmitDropdown.tsx',
      'src/components/ui/mint/ConfirmEmitDialog.tsx',
      'src/components/ui/mint/SyncStalenessBanner.tsx',
    ],
    skipped: [
      '.flint-context/contracts/MINT.5-phase3-contract.md — spec, not code',
      '.flint-context/contracts/MINT.5-phase3.contract.ts — type contract, imported transitively',
      'shared/__tests__/mcp-classification.bench.ts — perf bench, not correctness',
    ],
  },
};
