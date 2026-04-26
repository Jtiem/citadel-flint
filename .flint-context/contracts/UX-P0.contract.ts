/**
 * UX-P0 — Trust Gap Fixes (Beta Gate 2)
 *
 * Executable contract for the 5 P0 defects from the Glass UX audit
 * (docs/strategy/UX-AUDIT-2026-04-04.md, Theme 1: Trust Gap).
 *
 * Phase 2 agents import types from this file and implement against them.
 * Phase 1.5 contract linter validates the CONTRACT export.
 */

import type { FlintContract } from '../../shared/contract-schema';

// ─── Shared Payload Types ────────────────────────────────────────────

/** RuleOverride shape — mirrors src/store/governanceStore.ts */
export interface RuleOverrideWire {
  enabled?: boolean;
  severity?: 'critical' | 'amber' | 'advisory';
}

/** Persistence envelope for .flint/rule-overrides.json */
export interface RuleOverridesFile {
  version: 1;
  rules: Record<string, RuleOverrideWire>;
}

/** Payload for governance:save-overrides */
export interface SaveRuleOverridesPayload {
  version: 1;
  rules: Record<string, RuleOverrideWire>;
}

/** Response for governance:save-overrides */
export interface SaveRuleOverridesResponse {
  ok: true;
}

// ─── Hook Filter Contract ────────────────────────────────────────────

/**
 * New filter applied inside useGovernanceCategories.
 * A warning is VISIBLE when its rule has no override, OR its override.enabled !== false.
 * A warning is HIDDEN when overrides[warning.ruleId]?.enabled === false.
 */
export interface VisibilityFilter {
  (warning: { ruleId?: string; id: string }, overrides: Record<string, RuleOverrideWire>): boolean;
}

// ─── Toggle Reset Contract ───────────────────────────────────────────

/**
 * handleToggle must call resetOverride when the new enabled value matches the rule's
 * defaultEnabled AND no severity override exists. Otherwise setOverride.
 */
export interface ToggleDecision {
  action: 'reset' | 'set';
  payload?: { enabled: boolean };
}

// ─── StatusBar Pending-Issues Button ─────────────────────────────────

export interface PendingIssuesButtonProps {
  /** Total Mithril + A11y issues currently blocking export */
  issueCount: number;
  /** Called on click — expected to set rightTab to 'governance' */
  onOpenGovernance: () => void;
}

// ─── Contract ────────────────────────────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'UX-P0-TrustGap',
    phase: 'UX-P0',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-21',
    audience: 'designer',
  },

  impact: [
    {
      file: 'electron/preload.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Wire saveRuleOverrides / getRuleOverrides through contextBridge with Zod validation',
    },
    {
      file: 'electron/main.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Register governance:save-overrides / governance:get-overrides handlers; persist via FileTransactionManager',
    },
    {
      file: 'server/index.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Web-parity handlers for governance:save-overrides / governance:get-overrides',
    },
    {
      file: 'shared/ipc-validators.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Add Zod schemas for governance override save/get',
    },
    {
      file: 'src/hooks/useGovernanceCategories.ts',
      changeType: 'MODIFY',
      owner: 'flint-state-architect',
      summary: 'Filter visibleLinterWarnings/visibleA11yWarnings by governanceStore.overrides',
    },
    {
      file: 'src/components/ui/GovernancePanel.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'handleToggle resets when new enabled matches rule.defaultEnabled',
    },
    {
      file: 'src/components/editor/StatusBar.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Make pending-issues label a button with tooltip; onClick sets rightTab=governance',
    },
    {
      file: 'src/App.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Right-sidebar resize handle z-index above React Flow + 8px hit area',
    },
    {
      file: 'src/components/ui/__tests__/GovernancePanel.test.tsx',
      changeType: 'MODIFY',
      owner: 'flint-test-writer',
      summary: 'Round-trip toggle test asserting resetOverride is called',
    },
    {
      file: 'src/components/ui/__tests__/GovernanceDashboard.test.tsx',
      changeType: 'MODIFY',
      owner: 'flint-test-writer',
      summary: 'Filter test: disabled rule violation not in visibleLinterWarnings',
    },
    {
      file: 'src/components/editor/__tests__/StatusBar.test.tsx',
      changeType: 'MODIFY',
      owner: 'flint-test-writer',
      summary: 'Pending-issues button navigates to governance tab',
    },
    {
      file: 'electron/__tests__/governance-ipc.test.ts',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Round-trip save/load of overrides via IPC handler',
    },
  ],

  ipc: [
    {
      channel: 'governance:save-overrides',
      direction: 'renderer→main',
      payloadType: 'SaveRuleOverridesPayload',
      returnType: 'SaveRuleOverridesResponse',
      handler: 'electron/main.ts',
      validator: 'governanceSaveOverridesValidator',
    },
    {
      channel: 'governance:get-overrides',
      direction: 'renderer→main',
      payloadType: 'void',
      returnType: 'RuleOverridesFile | null',
      handler: 'electron/main.ts',
      // governanceGetOverridesValidator is a z.void() / z.undefined() schema — no payload.
      // Phase 2 deliverable in shared/ipc-validators.ts.
      validator: 'governanceGetOverridesValidator',
    },
  ],

  stores: [
    {
      store: 'governanceStore',
      newState: {},
      newActions: {},
      newSelectors: {},
    },
  ],

  components: [
    {
      name: 'GovernancePanel',
      file: 'src/components/ui/GovernancePanel.tsx',
      propsType: 'unchanged', // Phase 2: use existing type from source file
      consumesStores: ['governanceStore'],
      emitsIPC: ['governance:recordOverride'], // existing channel — not new in this contract
    },
    {
      name: 'StatusBar',
      file: 'src/components/editor/StatusBar.tsx',
      propsType: 'unchanged', // Phase 2: use existing type from source file
      consumesStores: ['canvasStore'],
      emitsIPC: [],
    },
  ],

  commandments: [1, 2, 4, 6, 12, 14],

  testBoundaries: [
    {
      target: 'useGovernanceCategories',
      kind: 'hook',
      behavior: 'Filters warnings for rules with enabled:false overrides',
      assertion: 'visibleLinterWarnings excludes disabled-rule warnings',
      edgeCases: [
        'rule with no override → visible',
        'rule with {enabled:true} override → visible',
        'rule with {enabled:false} override → hidden',
        'warning with missing ruleId → visible (fail-open)',
      ],
      given: 'governanceStore.overrides = { "mithril-contrast": { enabled: false } } and delta contains a warning with ruleId "mithril-contrast"',
      when: 'useGovernanceCategories renders with that delta',
      then: 'returns visibleLinterWarnings with zero entries for ruleId "mithril-contrast"',
    },
    {
      target: 'GovernancePanel.handleToggle',
      kind: 'component',
      behavior: 'Round-trip toggle clears the modified badge',
      assertion: 'resetOverride is called when new enabled matches rule.defaultEnabled and no severity override exists',
      edgeCases: [
        'default-enabled rule toggled off then on → resetOverride called on second toggle',
        'default-disabled rule toggled on then off → resetOverride called on second toggle',
        'rule with severity override → setOverride called (no reset)',
      ],
      given: 'a rule with defaultEnabled:true and no prior override',
      when: 'user toggles it off then on again',
      then: 'calls resetOverride(ruleId) on the second toggle',
    },
    {
      target: 'StatusBar pending-issues button',
      kind: 'component',
      behavior: 'Click navigates to governance tab',
      assertion: 'canvasStore.setRightTab called with "governance"',
      edgeCases: [
        'zero issues → button not rendered',
        'issueCount=1 → label reads "1 issue blocking export — view"',
        'issueCount>1 → plural label',
      ],
      given: 'canvasStore has mithrilViolations.length = 3 and canExport = false',
      when: 'user clicks the pending-issues button',
      then: 'dispatches setRightTab("governance") on the canvasStore',
    },
    {
      target: 'right-sidebar resize handle',
      kind: 'component',
      behavior: 'Pointer down on handle starts a drag, not a React Flow pan',
      assertion: 'onPointerDown handler fires and document.body.style.cursor becomes col-resize',
      edgeCases: [
        'handle z-index above the React Flow pane',
        'hit area is >= 8px wide',
        'drag moves sidebar width within min/max bounds',
      ],
      given: 'the app is rendered with the right sidebar open and a React Flow canvas mounted',
      when: 'user performs pointerdown within 4px of the sidebar left edge',
      then: 'calls the resize drag start handler and sets cursor to col-resize',
    },
    {
      target: 'demo load → undo safety',
      kind: 'store-action',
      behavior: 'Undo after demo load is a no-op toast or restores pre-demo state',
      assertion: 'recoveryController.applyUndo after loadDemoProject does not throw and emits a user-visible toast',
      edgeCases: [
        'undo with empty history → no "undone" toast',
        'undo with checkpoint → toast reads "Nothing to undo" or restores to pre-demo state',
      ],
      given: 'user invokes loadDemoProject on a fresh session with no prior history',
      when: 'user presses Cmd+Z immediately after demo load completes',
      then: 'emits a notification reading "Nothing to undo" and leaves editor state unchanged',
    },
    {
      target: 'governance:save-overrides IPC',
      kind: 'ipc-handler',
      behavior: 'Persists overrides to .flint/rule-overrides.json via FileTransactionManager',
      assertion: 'file at .flint/rule-overrides.json contains the payload after resolve',
      edgeCases: [
        'empty rules {} → file written with version:1, rules:{}',
        'malformed payload → Zod rejects before handler runs',
        'concurrent saves → FileTransactionManager serializes',
      ],
      given: 'main process receives governance:save-overrides with { version:1, rules:{ r1:{enabled:false} } }',
      when: 'the handler resolves',
      then: 'writes .flint/rule-overrides.json atomically with the exact payload',
    },
    {
      target: 'governance:get-overrides IPC',
      kind: 'ipc-handler',
      behavior: 'Loads overrides from disk or returns null',
      assertion: 'returns RuleOverridesFile matching disk contents, or null when file absent',
      edgeCases: [
        'file absent → returns null',
        'file corrupt → returns null and logs warning',
        'file valid → returns parsed RuleOverridesFile',
      ],
      given: 'a project with no .flint/rule-overrides.json on disk',
      when: 'renderer invokes governance:get-overrides',
      then: 'returns null without throwing',
    },
  ],

  invariants: [
    {
      name: 'override-filter-consistency',
      measurable: 'percentage of disabled-rule violations appearing in visibleLinterWarnings across 1000 fixture warnings',
      threshold: '= 0% (zero leakage)',
      measuredBy: 'vitest on useGovernanceCategories with synthetic override map',
    },
    {
      name: 'override-persistence-roundtrip',
      measurable: 'byte-equality of payload saved and payload subsequently loaded',
      threshold: '= 100% byte match over 50 randomized fixtures',
      measuredBy: 'electron integration test via FileTransactionManager',
    },
    {
      name: 'statusbar-gate-click-latency',
      measurable: 'time from pointerdown to rightTab state change',
      threshold: '< 50ms p95 at idle',
      measuredBy: 'vitest + React Testing Library act() timing',
    },
    {
      name: 'resize-handle-hit-reliability',
      measurable: 'successful drag starts per 100 pointerdown events within the 8px handle area over React Flow canvas',
      threshold: '>= 99/100',
      measuredBy: 'Playwright component test with synthetic pointer events',
    },
  ],

  risks: [
    {
      risk: 'Raising handle z-index breaks React Flow pan/drag in the sidebar strip',
      severity: 'medium',
      mitigation: 'Handle uses pointer-events:auto within an 8px strip only; React Flow pane keeps pointer-events:auto elsewhere',
    },
    {
      risk: 'visibleLinterWarnings filter applied in hook but other consumers read raw warnings',
      severity: 'high',
      commandment: 6,
      mitigation: 'All violation UI already funnels through useGovernanceCategories; audit by grep confirms no raw consumers remain',
    },
    {
      risk: 'Override persistence schema drift between main and renderer',
      severity: 'high',
      mitigation: 'Single Zod schema in shared/ipc-validators.ts imported by both sides; TSC enforces contract type',
    },
    {
      risk: 'Demo-load checkpoint masks real bug where syncCode bypasses history',
      severity: 'medium',
      commandment: 1,
      mitigation: 'Checkpoint is an explicit named marker; follow-up ticket tracks syncCode→applyBatch migration',
    },
  ],

  parallelismGroups: {
    A: ['flint-electron-ipc', 'flint-state-architect', 'flint-design-engineer'],
    B: ['flint-test-writer'],
    C: ['flint-integration-validator'],
  },

  nonGoals: [
    'Redesigning the GovernancePanel visual layout (Counsel scope)',
    'Migrating overrides into unified flint.config.yaml (UCFG follow-up)',
    'Adding per-file override scoping (beta is project-level only)',
    'Refactoring syncCode to route through applyBatch (tracked separately)',
  ],
};
