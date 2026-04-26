import type { ReviewReport, ReviewFinding } from '../../../shared/review-schema';
import { countFindings, deriveVerdict } from '../../../shared/review-schema';

const findings: ReviewFinding[] = [
  {
    id: 'SUG-1',
    title: 'Duplicated hours-formatting logic between SyncStalenessBanner and shared/syncStaleness',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/components/ui/mint/SyncStalenessBanner.tsx',
        line: 92,
        excerpt: 'function formatHours(hours: number): string { ... }',
        note: 'Local helper duplicates thresholds already in shared/syncStaleness.ts formatStaleness',
      },
      {
        file: 'shared/syncStaleness.ts',
        line: 53,
        excerpt: 'export function formatStaleness(durationMs: number): string { ... }',
      },
    ],
    observed:
      'SyncStalenessBanner.tsx defines a local formatHours(hours) helper that mirrors the 1h/48h/day pivots already implemented in shared/syncStaleness.ts formatStaleness(durationMs).',
    rationale:
      'Two formatters with near-identical thresholds invite future drift. Phase 4 will wire the threshold to flint.config.yaml and the duplication multiplies the replacement surface.',
    proposedFix:
      'Delete the local formatHours and call formatStaleness(hoursSinceSync * 3_600_000) from the shared module.',
    scope: 'one-file',
    status: 'open',
  },
  {
    id: 'SUG-2',
    title: 'Keyword-matching backstop in useSyncActions.isPersistentError is effectively dead once classification always attaches',
    severity: 'suggestion',
    evidence: [
      {
        file: 'src/hooks/useSyncActions.ts',
        line: 101,
        excerpt: '// Phase 3 backstop (removed in Phase 4): keyword matching for legacy builds.',
      },
      {
        file: 'electron/mcpClient.ts',
        line: 174,
        excerpt: 'const classification = classifyMCPError({ rawText, isError: raw.isError === true })',
      },
      {
        file: 'server/mcpClient.ts',
        line: 147,
        excerpt: 'const classification = classifyMCPError({ rawText, isError: raw.isError === true })',
      },
    ],
    observed:
      'Both Electron and web mcpClient.callTool now unconditionally attach classification to every MCPCallResult, so the keyword branch in isPersistentError only fires for the catch-branch synthesized errors (already passes undefined deliberately).',
    rationale:
      'Not a defect — the author has flagged removal for Phase 4. Recording for visibility so the follow-up is grep-able.',
    proposedFix:
      'Add a TODO(MINT.5/phase4) marker next to the keyword branch to surface it during Phase 4 cleanup.',
    scope: 'one-file',
    status: 'open',
  },
];

export const REPORT: ReviewReport = {
  meta: {
    phase: 'MINT.5-phase3',
    dimension: 'code',
    reviewer: 'flint-code-reviewer (pilot-ab scoped)',
    date: '2026-04-20',
    round: 1,
    scope: [
      '4 shared/* modules (Phase 3 additions)',
      '2 mcpClient.ts (Electron + web)',
      '3 hooks (useEmitTokens, useSyncActions, useSyncStaleness)',
      '1 store (syncStalenessStore)',
      '4 components (TokenHealthBar, EmitDropdown, ConfirmEmitDialog, SyncStalenessBanner)',
    ],
    markdownFile: 'MINT.5-phase3-code-review-2026-04-20-scoped.md',
  },
  rubric: [
    { criterion: 'No Node.js imports in src/', result: 'pass' },
    { criterion: 'No window.flintAPI inside Zustand store actions', result: 'pass' },
    { criterion: 'No cross-store imports', result: 'pass' },
    { criterion: 'Every new renderer→main IPC path has a Zod validator (MCP_TOOL_ARG_SCHEMAS covers 5 sync tools)', result: 'pass' },
    { criterion: 'SEC.3 RENDERER_ALLOWED_MCP_TOOLS updated for flint_emit_tokens with justification', result: 'pass' },
    { criterion: 'C14 Bypass Prohibition: no direct fs/git in renderer', result: 'pass' },
    { criterion: 'C5 Accessibility: ARIA roles + keyboard nav on new interactive UI', result: 'pass' },
    { criterion: 'C9 Process Boundary Law: no Node imports in src/', result: 'pass' },
    { criterion: 'Single source of truth (R8): classifyMCPError imported by both electron and server mcpClient', result: 'pass' },
    { criterion: 'Serialization guard (synchronous ref) on emit/sync dispatch', result: 'pass' },
    { criterion: 'Test coverage for all new shared modules + hooks', result: 'pass' },
    { criterion: 'No TSC errors in diffed files', result: 'pass' },
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
      'server/mcpClient.ts',
      'src/hooks/useEmitTokens.ts',
      'src/hooks/useSyncActions.ts',
      'src/hooks/useSyncStaleness.ts',
      'src/store/syncStalenessStore.ts',
      'src/components/ui/TokenHealthBar.tsx',
      'src/components/ui/mint/EmitDropdown.tsx',
      'src/components/ui/mint/ConfirmEmitDialog.tsx',
      'src/components/ui/mint/SyncStalenessBanner.tsx',
    ],
    skipped: [
      'Test files — existence confirmed via ls; content not content-reviewed under pilot A scoping',
      '.flint-context/contracts/MINT.5-phase3-contract.md — not re-read substantively',
    ],
  },
};
