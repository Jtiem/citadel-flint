/**
 * Sprint Clarity — Executable Contract
 *
 * Phase: CLARITY
 * Date: 2026-03-29
 *
 * This file defines the TypeScript interfaces that Phase 2 agents implement
 * against. It compiles with `npx tsc --noEmit`.
 */

import type {
  FlintContract,
  ContractMeta,
  ImpactEntry,
  TestBoundary,
  RiskEntry,
} from '../../shared/contract-schema.js'

// ─── Item 2: MCP Response Shaping Types ─────────────────────────────────────

/** Added to flint_get_context response when violations are present */
export interface ContextNextStep {
  /** Plain-English recommendation for the user's next action */
  nextStep: string
}

/** Added to audit_ui_component and flint_audit responses */
export interface AuditRecommendation {
  /** One-line actionable recommendation based on audit verdict */
  recommendation: string
}

// ─── Item 3: CLI Help Output ────────────────────────────────────────────────

/** The 7 workflow situations printed by `flint-gate help` */
export interface HelpSituation {
  /** Short title (e.g., "I just installed Flint") */
  title: string
  /** The command(s) to run */
  command: string
  /** One-sentence explanation */
  description: string
}

export type HelpSituations = [
  HelpSituation,
  HelpSituation,
  HelpSituation,
  HelpSituation,
  HelpSituation,
  HelpSituation,
  HelpSituation,
]

/** Return type of the help command handler */
export type HelpCommandExitCode = 0

// ─── Item 1: Language Pass — No new types needed ────────────────────────────
// This is a string-only change. No new interfaces. Included here for
// completeness — the test boundaries below define what to verify.

// ─── Item 4: Prompt Wiring — No new types needed ───────────────────────────
// This adds prompt text referencing flint-workflow-guide. No new interfaces.

// ─── Contract Definition ────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'Sprint-Clarity',
    phase: 'CLARITY',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-03-29',
  },

  impact: [
    // Item 1: Language pass
    { file: 'src/components/ui/GovernanceDashboard.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings to "drift"/"gap"' },
    { file: 'src/components/editor/StatusBar.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/components/ui/ExportModal.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/components/ui/CommandPalette.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/components/ui/LaunchScreen.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/components/ui/DemoWalkthrough.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/components/ui/PolicySettings.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/components/ui/LayerTree.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/components/ui/PropertiesPanel.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/components/ui/BetaWelcome.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/components/mithril/MithrilProvider.tsx', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename user-facing "violation" strings' },
    { file: 'src/hooks/useOnboardingTooltip.ts', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Rename tooltip copy' },
    // Item 2: Response shaping
    { file: 'flint-mcp/src/server.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add nextStep/recommendation fields to context and audit responses' },
    // Item 3: CLI help
    { file: 'flint-ci/src/commands/help.ts', changeType: 'CREATE', owner: 'flint-design-engineer', summary: 'Conversational help command with 7 situations' },
    { file: 'flint-ci/src/cli.ts', changeType: 'MODIFY', owner: 'flint-design-engineer', summary: 'Register help subcommand' },
    { file: 'flint-ci/src/__tests__/help.test.ts', changeType: 'CREATE', owner: 'flint-test-writer', summary: 'Tests for help command output' },
    // Item 4: Prompt wiring
    { file: 'flint-mcp/src/prompts/onboard-project.ts', changeType: 'MODIFY', owner: 'flint-ast-surgeon', summary: 'Add workflow guide invocation step' },
  ],

  ipc: [],      // No IPC changes in this sprint
  stores: [],   // No store shape changes
  components: [], // No new components

  commandments: [4, 13], // Local-first, deterministic — neither at risk, listed for completeness

  testBoundaries: [
    // Item 1
    {
      target: 'GovernanceDashboard',
      kind: 'component',
      behavior: 'Renders "drift" instead of "violation" in all user-facing headings and labels',
      assertion: 'rendered text does not contain "violation" (case-insensitive)',
      edgeCases: ['zero-state message', 'baseline confirmation message', 'plural forms'],
    },
    {
      target: 'StatusBar',
      kind: 'component',
      behavior: 'Chip label says "Design Drift" not "Violation"',
      assertion: 'rendered text does not contain "violation" (case-insensitive)',
      edgeCases: ['singular vs plural', 'tooltip text', 'aria-label'],
    },
    {
      target: 'ExportModal',
      kind: 'component',
      behavior: 'Gate messaging uses "drift"/"gaps" not "violations"',
      assertion: 'rendered text does not contain "violation" (case-insensitive)',
      edgeCases: ['blocked state message', 'approved state message'],
    },
    // Item 2
    {
      target: 'flint_get_context handler',
      kind: 'service',
      behavior: 'Response includes nextStep when violations are present',
      assertion: 'returns object with nextStep string when violations.length > 0',
      edgeCases: ['no violations (nextStep absent)', 'empty project (cold start)'],
    },
    {
      target: 'audit_ui_component handler',
      kind: 'service',
      behavior: 'Response includes recommendation field',
      assertion: 'returns object with recommendation string',
      edgeCases: ['BLOCKED verdict', 'APPROVED verdict', 'no file found'],
    },
    {
      target: 'flint_audit handler',
      kind: 'service',
      behavior: 'Response includes recommendation field',
      assertion: 'returns object with recommendation string',
      edgeCases: ['BLOCKED verdict', 'APPROVED verdict', 'multiple files'],
    },
    // Item 3
    {
      target: 'helpCommand',
      kind: 'service',
      behavior: 'Prints 7 workflow situations to stdout and exits 0',
      assertion: 'output contains all 7 situation titles; exit code is 0',
      edgeCases: ['output is plain text, no ANSI escape codes in content'],
    },
    // Item 4
    {
      target: 'getOnboardProjectContent',
      kind: 'service',
      behavior: 'Output includes workflow guide invocation step',
      assertion: 'returned string contains "flint-workflow-guide" and "intent"',
      edgeCases: ['with projectRoot', 'without projectRoot'],
    },
  ],

  risks: [
    {
      risk: 'Language pass misses a rendered "violation" string in a less-visited component',
      severity: 'low',
      mitigation: 'Post-implementation grep audit across all src/ rendered strings',
    },
    {
      risk: 'Test assertions break on renamed display text',
      severity: 'low',
      mitigation: 'Update test strings in same commit as component changes',
    },
  ],

  parallelismGroups: {
    A: ['flint-design-engineer', 'flint-test-writer'],
    B: ['flint-ast-surgeon'],
  },

  nonGoals: [
    'Rename code identifiers (variable names, type names, store keys)',
    'Rename IPC channels or file names',
    'Change MCP tool names or resource URIs',
    'Change CLI output language (stays "violations" for developers)',
    'Add new UI components or panels',
    'Add new IPC channels',
    'Change linter engine, AST service, or recovery controller',
    'Change store shapes',
  ],
}
