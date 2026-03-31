/**
 * COUNSEL.2.1 -- Defer Button in Glass
 *
 * Executable contract for the Defer Violation feature.
 * Phase 2 agents import these types directly.
 *
 * Context: GovernanceDashboard already has a partial defer UI (button, form,
 * submit handler). This contract completes the feature by:
 *   G1: Adding defer to ExportModal
 *   G2: Persisting duration + expires_at in SQLite
 *   G3: Wiring governance.deferViolation in preload
 *   G4: Post-defer visual state (badge + dim)
 *   G5: Web build parity
 */

import type { FlintContract } from '../../shared/contract-schema'

// ── Domain Types ────────────────────────────────────────────────────────────

/**
 * Supported defer duration values.
 * Displayed as radio options in the inline defer form.
 * 'Manually' means no auto-expiry -- user must explicitly revisit.
 */
export type DeferDuration = '1 day' | '3 days' | '1 week' | '1 sprint' | 'Manually'

/**
 * Component-local form state for the defer inline form.
 * Each violation row maintains its own instance keyed by cardKey.
 */
export interface DeferralFormState {
  /** User-provided reason for deferring (optional, may be empty string) */
  reason: string
  /** Selected duration from the radio group */
  duration: DeferDuration
}

/**
 * IPC payload sent from renderer to main process via governance:defer-violation.
 * This is the new 5-field signature replacing the old 4-field version.
 */
export interface DeferViolationPayload {
  /** Absolute path to the file containing the violation */
  filePath: string
  /** Rule ID (e.g. "MITH-COL-001", "A11Y-003") */
  ruleId: string
  /** data-flint-id of the specific element (optional) */
  nodeId?: string
  /** User-provided reason for deferring (optional) */
  reason?: string
  /** How long to defer before resurfacing */
  duration: DeferDuration
}

/**
 * Row shape returned by governance:get-deferred-violations IPC handler.
 * Maps 1:1 to the deferred_violations SQLite table.
 */
export interface DeferredViolationRow {
  id: number
  file_path: string
  rule_id: string
  node_id: string | null
  reason: string | null
  /** Duration string as submitted by the user (e.g. "1 week") */
  duration: string | null
  session_id: string
  /** ISO 8601 datetime when the violation was deferred */
  deferred_at: string
  /** ISO 8601 datetime when the deferral expires (NULL for 'Manually') */
  expires_at: string | null
  /** ISO 8601 datetime when the deferral was resolved (NULL if still active) */
  resolved_at: string | null
}

// ── Duration Computation ────────────────────────────────────────────────────

/**
 * Maps a DeferDuration to milliseconds offset from now.
 * Returns null for 'Manually' (no auto-expiry).
 *
 * Used by the main process IPC handler to compute expires_at.
 */
export function durationToMs(duration: DeferDuration): number | null {
  switch (duration) {
    case '1 day':    return 1 * 24 * 60 * 60 * 1000
    case '3 days':   return 3 * 24 * 60 * 60 * 1000
    case '1 week':   return 7 * 24 * 60 * 60 * 1000
    case '1 sprint': return 14 * 24 * 60 * 60 * 1000
    case 'Manually': return null
  }
}

/**
 * Computes the ISO 8601 expires_at string from a DeferDuration.
 * Returns null for 'Manually'.
 */
export function computeExpiresAt(duration: DeferDuration): string | null {
  const ms = durationToMs(duration)
  if (ms === null) return null
  return new Date(Date.now() + ms).toISOString()
}

// ── Preload Surface Contract ────────────────────────────────────────────────

/**
 * The governance.deferViolation method signature that must exist
 * in the preload's governance namespace.
 *
 * This replaces the optional `governance.deferViolation?(opts)` in flint-api.d.ts
 * and the top-level `window.flintAPI.deferViolation(file, ruleId, nodeId?, reason?)`.
 */
export interface GovernanceDeferAPI {
  deferViolation: (payload: DeferViolationPayload) => Promise<void>
}

// ── ExportModal Defer State Contract ────────────────────────────────────────

/**
 * Internal state shape that ExportModal must maintain for defer functionality.
 * All fields are component-local (useState), not in a Zustand store.
 */
export interface ExportModalDeferState {
  /** Which violation keys have the defer form expanded */
  deferFormOpen: Set<string>
  /** Per-key reason text input */
  deferReasons: Map<string, string>
  /** Per-key selected duration */
  deferDurations: Map<string, DeferDuration>
  /** Keys that show the success confirmation */
  deferSuccess: Set<string>
  /** Composite keys (file::ruleId::nodeId) of already-deferred violations, fetched on mount */
  deferredIds: Set<string>
}

// ── Machine-Readable Contract ───────────────────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'COUNSEL-2-1-DeferButton',
    phase: 'COUNSEL.2.1',
    status: 'DRAFT',
    owner: 'flint-architect',
    date: '2026-03-31',
  },

  impact: [
    {
      file: 'electron/main.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Add duration + expires_at columns to deferred_violations DDL; update upsert stmt; update handler signature to accept duration',
    },
    {
      file: 'electron/preload.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Add deferViolation to governance namespace with DeferViolationPayload shape',
    },
    {
      file: 'src/types/flint-api.d.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Make governance.deferViolation non-optional; align payload type with DeferViolationPayload',
    },
    {
      file: 'src/components/ui/ExportModal.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Add defer button + inline form to Mithril and a11y violation rows; fetch deferred IDs on mount',
    },
    {
      file: 'src/components/ui/GovernanceDashboard.tsx',
      changeType: 'MODIFY',
      owner: 'flint-design-engineer',
      summary: 'Post-defer visual state: show Deferred badge, dim row; fix submitDefer to prefer governance namespace',
    },
    {
      file: 'server/index.ts',
      changeType: 'MODIFY',
      owner: 'flint-electron-ipc',
      summary: 'Mirror schema + handler changes for web build parity',
    },
    {
      file: 'src/components/ui/__tests__/ExportModal.defer.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Defer button render, form interaction, submit call, success state, deferred badge',
    },
    {
      file: 'src/components/ui/__tests__/GovernanceDashboard.defer.test.tsx',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'Post-defer badge visibility, dimmed state, duration persistence',
    },
    {
      file: 'electron/__tests__/defer-ipc.test.ts',
      changeType: 'CREATE',
      owner: 'flint-test-writer',
      summary: 'IPC handler accepts duration, computes expires_at, round-trip query returns new columns',
    },
  ],

  ipc: [
    {
      channel: 'governance:defer-violation',
      direction: 'renderer\u2192main',
      payloadType: '(filePath: string, ruleId: string, nodeId?: string, reason?: string, duration?: DeferDuration)',
      returnType: 'void',
      handler: 'electron/main.ts',
    },
    {
      channel: 'governance:get-deferred-violations',
      direction: 'renderer\u2192main',
      payloadType: '(none)',
      returnType: 'DeferredViolationRow[]',
      handler: 'electron/main.ts',
    },
  ],

  stores: [],

  components: [
    {
      name: 'ExportModal',
      file: 'src/components/ui/ExportModal.tsx',
      propsType: 'ExportModalProps',
      consumesStores: ['canvasStore', 'editorStore', 'notificationStore'],
      emitsIPC: ['governance:defer-violation', 'governance:get-deferred-violations'],
    },
    {
      name: 'GovernanceDashboard',
      file: 'src/components/ui/GovernanceDashboard.tsx',
      propsType: '(internal)',
      consumesStores: ['canvasStore', 'editorStore', 'notificationStore'],
      emitsIPC: ['governance:defer-violation'],
    },
  ],

  commandments: [4, 5, 6, 12],

  testBoundaries: [
    {
      target: 'governance:defer-violation IPC handler',
      kind: 'ipc-handler',
      behavior: 'Accepts duration param, computes expires_at, stores both in SQLite',
      assertion: 'Row returned by get-deferred-violations includes duration and expires_at columns',
      edgeCases: [
        'duration is "Manually" -- expires_at must be NULL',
        'duration is omitted (backward compat) -- expires_at must be NULL, duration must be NULL',
        'Upsert same (file, ruleId, nodeId) with new duration updates expires_at',
      ],
    },
    {
      target: 'ExportModal defer button',
      kind: 'component',
      behavior: 'Each Mithril and a11y violation row renders a Defer button',
      assertion: 'Button with aria-label containing "Defer" is present for each violation row',
      edgeCases: [
        'Already-deferred violations show "Deferred" badge instead of button',
        'Clicking Defer opens inline form with reason + duration radio',
        'Submitting form calls governance.deferViolation with correct payload',
        'Success state shows confirmation and updates to Deferred badge',
      ],
    },
    {
      target: 'GovernanceDashboard post-defer visual state',
      kind: 'component',
      behavior: 'After successful defer, violation row shows Deferred badge and is visually dimmed',
      assertion: 'Element with data-testid="defer-success-{id}" is visible; row has opacity class',
      edgeCases: [
        'Deferred badge persists after success toast auto-dismisses',
        'Defer button is replaced by badge (not shown alongside it)',
      ],
    },
    {
      target: 'durationToMs',
      kind: 'service',
      behavior: 'Maps DeferDuration enum values to correct millisecond offsets',
      assertion: 'Returns correct ms for each duration; null for Manually',
      edgeCases: ['All 5 duration values are covered'],
    },
    {
      target: 'computeExpiresAt',
      kind: 'service',
      behavior: 'Produces ISO 8601 datetime string from DeferDuration',
      assertion: 'String parses to a Date in the future; null for Manually',
      edgeCases: ['Resulting date is within 1 second of expected offset'],
    },
  ],

  risks: [
    {
      risk: 'Users perceive "Defer" as "Dismiss" and stop fixing violations',
      severity: 'medium',
      commandment: 6,
      mitigation: 'Deferred violations still block export. ExportModal shows "Deferred" badge but keeps violations in the blocked list.',
    },
    {
      risk: 'ALTER TABLE on existing databases with rows',
      severity: 'low',
      mitigation: 'SQLite ALTER TABLE ADD COLUMN is safe and non-destructive. New columns default to NULL.',
    },
    {
      risk: 'Web build drift if server/index.ts is not updated in the same PR',
      severity: 'medium',
      mitigation: 'server/index.ts is in the same implementation group (Group A). CI parity check catches drift.',
    },
    {
      risk: 'GovernanceDashboard file size (1700+ lines) makes review harder',
      severity: 'low',
      mitigation: 'Changes are minimal -- adding a CSS class and swapping a button for a badge. No new component extraction needed.',
    },
  ],

  parallelismGroups: {
    A: ['flint-electron-ipc'],
    B: ['flint-test-writer'],
    C: ['flint-design-engineer'],
  },

  nonGoals: [
    'Auto-expiry enforcement (watcher that resurfaces expired deferrals) -- that is COUNSEL.2.2',
    'Deferred violations unblocking the export gate -- defer is acknowledgment, not override',
    'Defer from canvas overlay or spatial badges -- only GovernanceDashboard and ExportModal',
    'Modifying flint_defer_violation MCP tool -- it already works, this contract only adds the Glass surface',
    'Extracting DeferForm into a shared component -- both forms are <30 lines of inline JSX, extraction adds coupling for no benefit',
  ],
}
