# Contract: GOV.1 (Rule Provenance) + GOV.2 (Override Telemetry)

## Architectural Summary

Two governance observability features that extend the existing Mithril/A11y linter output with regulatory metadata and capture every rule override event into the `governance_events` SQLite table.

**GOV.1** adds provenance metadata to every violation emitted by the linting pipeline. The metadata is a static lookup (no runtime computation) keyed by `ruleId`, returning the rule's source authority, regulatory reference, and freshness date. The data flows through three layers: (1) a provenance registry in bridge-mcp, (2) enrichment of the `bridge_audit` MCP tool output (SARIF-compatible), and (3) a "Compliance Summary" section in the ExportModal plus a new `bridge_audit_report` MCP tool for JSON export.

**GOV.2** captures override telemetry. The detection point is `governanceStore.setOverride()` -- when a user disables or changes severity on a rule via the GovernancePanel, the renderer fires a new IPC channel to record the event in the `governance_events` table. A new "Overrides (N)" badge in the StatusBar shows the session's override count, derived from an IPC query. This gives full forensic history: which rules were suppressed, by whom, when, and in which project context.

### Key Architectural Decisions

1. **Provenance registry lives in bridge-mcp** as a static TypeScript map (`ruleProvenanceRegistry.ts`). It is NOT a JSON config file -- it is code, versioned with the engine, so that provenance data is always consistent with the rules it describes.

2. **LinterWarning type is NOT modified.** Instead, provenance is resolved at query time by joining `ruleId` from the warning against the provenance registry. This avoids breaking every existing consumer of `LinterWarning` (editorStore, canvasStore, PropertiesPanel, ExportModal, GovernanceOverlay, GhostOverlay, ShieldOverlay).

3. **GOV.2 detection point is the governanceStore action**, not AST scanning for `data-bridge-override` attributes. Reason: `data-bridge-override` is a planned future attribute that does not yet exist in the codebase. The actual override mechanism today is `governanceStore.setOverride(ruleId, { enabled, severity })`, called from GovernancePanel. We intercept at that call site.

4. **GOV.2 IPC is a fire-and-forget write** -- the renderer calls `window.bridgeAPI.governance.recordOverride(...)` and does not await a meaningful return value. The main process writes to SQLite synchronously via `GovernanceEventService.recordEvent()`.

5. **StatusBar override count is fetched via IPC on mount + on each override action** -- not derived from governanceStore (which only holds the current overrides, not the historical count). The badge count comes from `window.bridgeAPI.governance.getOverrideCount()`.

---

## Impact Map

| File | Change Type | Owner Agent |
|------|------------|-------------|
| `bridge-mcp/src/core/governance/ruleProvenanceRegistry.ts` | NEW FILE -- static provenance map for all 49 rules | bridge-ast-surgeon |
| `bridge-mcp/src/core/governance/types.ts` | MODIFY -- add `RuleProvenance` interface | bridge-ast-surgeon |
| `bridge-mcp/src/core/governance/eventService.ts` | MODIFY -- add `getOverrideCount(sessionId)` method | bridge-ast-surgeon |
| `bridge-mcp/src/server.ts` | MODIFY -- register `bridge_audit_report` tool, enrich `bridge_audit` output | bridge-ast-surgeon |
| `bridge-mcp/src/tools/auditReport.ts` | NEW FILE -- `bridge_audit_report` MCP tool handler | bridge-ast-surgeon |
| `electron/main.ts` | MODIFY -- add `governance:record-override` and `governance:override-count` IPC handlers | bridge-electron-ipc |
| `electron/preload.ts` | MODIFY -- expose `governance.recordOverride()` and `governance.getOverrideCount()` on bridgeAPI | bridge-electron-ipc |
| `src/types/bridge-api.d.ts` | MODIFY -- add `GovernanceAPI`, `RuleProvenance`, `ComplianceSummary` types | bridge-state-architect |
| `src/components/ui/ExportModal.tsx` | MODIFY -- add "Compliance Summary" section with provenance data | bridge-design-engineer |
| `src/components/editor/StatusBar.tsx` | MODIFY -- add "Overrides (N)" badge | bridge-design-engineer |
| `src/components/ui/GovernancePanel.tsx` | MODIFY -- fire IPC on setOverride/resetOverride/resetAll | bridge-design-engineer |
| `bridge-mcp/src/core/governance/__tests__/ruleProvenanceRegistry.test.ts` | NEW FILE -- provenance registry tests | bridge-test-writer |
| `bridge-mcp/src/core/governance/__tests__/eventService.test.ts` | MODIFY -- add getOverrideCount tests | bridge-test-writer |
| `src/components/__tests__/ExportModal.test.tsx` | NEW FILE or MODIFY -- compliance summary rendering tests | bridge-test-writer |
| `src/components/__tests__/StatusBar.test.tsx` | NEW FILE or MODIFY -- overrides badge tests | bridge-test-writer |

---

## Type Contracts (Source of Truth for Phase 2)

### New Types -- bridge-mcp (Node.js side)

```typescript
// bridge-mcp/src/core/governance/types.ts -- ADDITIONS

/**
 * Regulatory source authority that a governance rule traces back to.
 * Used by GOV.1 (Rule Provenance) to attach compliance metadata to violations.
 */
export type SourceAuthority =
    | 'WCAG 2.1 AA'
    | 'WCAG 2.2 AA'
    | 'SOC2'
    | 'FDA SaMD'
    | 'HIPAA'
    | 'Bridge Design System'
    | 'Custom'

/**
 * Provenance metadata for a single governance rule.
 * Resolved from the static ruleProvenanceRegistry keyed by ruleId.
 */
export interface RuleProvenance {
    /** The rule identifier, e.g. 'A11Y-001', 'MITHRIL-TYP-002'. */
    ruleId: string
    /** Human-readable rule name. */
    ruleName: string
    /** Which regulatory body or standard this rule satisfies. */
    sourceAuthority: SourceAuthority
    /** Specific clause or section reference, e.g. 'WCAG 2.1 SC 1.1.1'. */
    regulatoryReference: string
    /** ISO 8601 date when the rule definition was last reviewed. */
    lastUpdated: string
    /** Brief rationale for why this rule exists. */
    rationale: string
}

/**
 * Compliance summary for a single audit, aggregating provenance across
 * all detected violations. Used by ExportModal "Compliance Summary" section.
 */
export interface ComplianceSummary {
    /** Total violation count. */
    totalViolations: number
    /** Breakdown by source authority. */
    byAuthority: Record<SourceAuthority, number>
    /** Breakdown by severity. */
    bySeverity: Record<'critical' | 'warning' | 'info', number>
    /** Full provenance records for each unique violated rule. */
    violatedRules: RuleProvenance[]
    /** ISO 8601 timestamp when this summary was generated. */
    generatedAt: string
}
```

### New Types -- renderer side (mirror in bridge-api.d.ts)

```typescript
// src/types/bridge-api.d.ts -- ADDITIONS

/**
 * Regulatory source authority (renderer-side mirror of bridge-mcp type).
 */
export type SourceAuthority =
    | 'WCAG 2.1 AA'
    | 'WCAG 2.2 AA'
    | 'SOC2'
    | 'FDA SaMD'
    | 'HIPAA'
    | 'Bridge Design System'
    | 'Custom'

/**
 * Provenance metadata for a governance rule (renderer-side mirror).
 */
export interface RuleProvenance {
    ruleId: string
    ruleName: string
    sourceAuthority: SourceAuthority
    regulatoryReference: string
    lastUpdated: string
    rationale: string
}

/**
 * Compliance summary returned by the governance IPC.
 */
export interface ComplianceSummary {
    totalViolations: number
    byAuthority: Record<string, number>
    bySeverity: Record<string, number>
    violatedRules: RuleProvenance[]
    generatedAt: string
}

/**
 * IPC surface for governance telemetry operations (GOV.1 + GOV.2).
 * Exposed as window.bridgeAPI.governance.
 */
export interface GovernanceAPI {
    /**
     * Records a rule override event to the governance_events table.
     * Fire-and-forget -- the renderer does not need the result.
     *
     * @param payload.ruleId    -- The rule being overridden (e.g. 'A11Y-001').
     * @param payload.action    -- 'disable' | 'enable' | 'change_severity' | 'reset' | 'reset_all'.
     * @param payload.newValue  -- The new state: { enabled?: boolean; severity?: string } or null for reset_all.
     * @param payload.filePath  -- Active file path when the override was made.
     */
    recordOverride: (payload: {
        ruleId: string
        action: 'disable' | 'enable' | 'change_severity' | 'reset' | 'reset_all'
        newValue: { enabled?: boolean; severity?: string } | null
        filePath: string
    }) => Promise<void>

    /**
     * Returns the count of 'override' events in the current session.
     * Used by StatusBar to show "Overrides (N)" badge.
     */
    getOverrideCount: () => Promise<number>

    /**
     * Returns a ComplianceSummary for the given violation ruleIds.
     * Used by ExportModal to render the "Compliance Summary" section.
     *
     * @param ruleIds -- Deduplicated list of violated ruleIds from the current audit.
     */
    getComplianceSummary: (ruleIds: string[]) => Promise<ComplianceSummary>
}
```

### ruleProvenanceRegistry.ts -- Static Map Shape

```typescript
// bridge-mcp/src/core/governance/ruleProvenanceRegistry.ts

import type { RuleProvenance } from './types.js'

/**
 * Static provenance registry mapping every known ruleId to its
 * regulatory metadata. This is the single source of truth for GOV.1.
 *
 * Rules not present in this map receive a fallback provenance with
 * sourceAuthority: 'Bridge Design System' and regulatoryReference: 'N/A'.
 */
export const RULE_PROVENANCE_REGISTRY: ReadonlyMap<string, RuleProvenance> = new Map([
    // Accessibility
    ['A11Y-001', {
        ruleId: 'A11Y-001',
        ruleName: 'Image Missing Alt Text',
        sourceAuthority: 'WCAG 2.1 AA',
        regulatoryReference: 'WCAG 2.1 SC 1.1.1 (Non-text Content)',
        lastUpdated: '2025-06-05',
        rationale: 'Images must have text alternatives for screen reader users.',
    }],
    // ... all 49 rules mapped
])

/**
 * Resolve provenance for a ruleId. Returns a fallback provenance
 * when the ruleId is not in the registry (unknown/custom rules).
 */
export function resolveProvenance(ruleId: string): RuleProvenance {
    return RULE_PROVENANCE_REGISTRY.get(ruleId) ?? {
        ruleId,
        ruleName: ruleId,
        sourceAuthority: 'Bridge Design System',
        regulatoryReference: 'N/A',
        lastUpdated: new Date().toISOString().slice(0, 10),
        rationale: 'Custom or unregistered rule.',
    }
}

/**
 * Build a ComplianceSummary from a list of violated ruleIds + severity counts.
 */
export function buildComplianceSummary(
    violations: Array<{ ruleId: string; severity: 'critical' | 'warning' | 'info' }>
): ComplianceSummary { ... }
```

---

## IPC Channels

| Channel | Direction | Payload | Return |
|---------|-----------|---------|--------|
| `governance:record-override` | renderer --> main | `{ ruleId: string; action: string; newValue: object \| null; filePath: string }` | `void` |
| `governance:override-count` | renderer --> main | (none) | `number` |
| `governance:compliance-summary` | renderer --> main | `string[]` (ruleIds) | `ComplianceSummary` |

### Channel Details

**`governance:record-override`**
- Main process handler receives the payload, constructs a `GovernanceEvent` with `eventType: 'override'`, and calls `GovernanceEventService.recordEvent()`.
- The `sessionId` is derived from the app-level session UUID (set once on app launch, stored in main process memory).
- The `actor` field is set to `'user'`.
- The `metadata` field stores `{ action, newValue }` for forensic replay.

**`governance:override-count`**
- Main process queries `GovernanceEventService.queryEvents({ eventType: 'override', sessionId: currentSessionId })` and returns `results.length`.
- Alternatively uses a new `getOverrideCount(sessionId)` method on the service for efficiency (single COUNT query).

**`governance:compliance-summary`**
- Main process receives a `string[]` of ruleIds, resolves each via `resolveProvenance()`, aggregates by authority and severity, and returns a `ComplianceSummary`.
- No SQLite involved -- pure in-memory lookup from the static registry.

---

## Store Contracts

### governanceStore (MODIFY -- src/store/governanceStore.ts)

No new state is added to this store. The store's `setOverride` and `resetOverride` actions remain unchanged in their Zustand logic. The telemetry recording is triggered from the **component layer** (GovernancePanel), not from within the store action. This preserves the anti-pattern rule: "No `window.bridgeAPI` calls inside Zustand store actions."

| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| governanceStore | (none) | (none) | (none) |

### canvasStore (NO CHANGE)

The `overridesExist` flag and `mithrilViolations` array remain unchanged. The override count for GOV.2 is a separate concern (telemetry) and is fetched directly via IPC, not derived from canvasStore.

---

## Component Contracts

### ExportModal (MODIFY)

| Aspect | Detail |
|--------|--------|
| New Props | (none -- data fetched internally) |
| New Store Deps | (none) |
| New IPC Calls | `window.bridgeAPI.governance.getComplianceSummary(ruleIds)` |
| New State | `complianceSummary: ComplianceSummary \| null` (local useState) |
| New UI Section | "Compliance Summary" section rendered after the violation lists when `!canExport`. Shows: authority breakdown badges, regulatory references per violated rule, "Export Audit Report" button. |

**Behavior:**
- On mount (alongside the existing `readOverrides` fetch), the component collects all unique ruleIds from `linterWarnings` (Mithril) and `a11yViolations` (A11y), then calls `getComplianceSummary(ruleIds)`.
- The Compliance Summary section renders after the Mithril Violations section.
- An "Export Audit Report (JSON)" button calls `navigator.clipboard.writeText(JSON.stringify(complianceSummary))` to copy the structured audit report. Future: this could trigger the `bridge_audit_report` MCP tool for a richer report.

### StatusBar (MODIFY)

| Aspect | Detail |
|--------|--------|
| New Props | (none) |
| New Store Deps | (none) |
| New IPC Calls | `window.bridgeAPI.governance.getOverrideCount()` |
| New State | `overrideCount: number` (local useState, default 0) |
| New UI | "Overrides (N)" badge between the Figma status and Export Gate chips. Amber text. Only visible when N > 0. |

**Behavior:**
- Fetches override count on mount and re-fetches after every `governance:record-override` call (via a custom event or by re-invoking after the GovernancePanel fires).
- To avoid polling, the main process pushes `bridge:governance-override-recorded` after each `recordEvent`, and the renderer subscribes via a new `onOverrideRecorded` listener in the preload surface.

### GovernancePanel (MODIFY)

| Aspect | Detail |
|--------|--------|
| New Props | (none) |
| New Store Deps | (none -- reads activeFilePath from canvasStore for context) |
| New IPC Calls | `window.bridgeAPI.governance.recordOverride(payload)` |
| New Behavior | After calling `setOverride(ruleId, override)` or `resetOverride(ruleId)` or `resetAll()`, fires a fire-and-forget IPC call to record the telemetry event. |

---

## MCP Tool: bridge_audit_report

### Tool Definition

```typescript
export const BRIDGE_AUDIT_REPORT_TOOL = {
    name: 'bridge_audit_report',
    description: 'Generate a structured compliance audit report for a component file. Returns violations enriched with provenance metadata (sourceAuthority, regulatoryReference) in JSON format suitable for SOC2/FDA SaMD audit trails.',
    inputSchema: {
        type: 'object',
        properties: {
            source: {
                type: 'string',
                description: 'Raw TSX/JSX source code to audit.',
            },
            filePath: {
                type: 'string',
                description: 'Absolute path to the file (for reporting context).',
            },
            format: {
                type: 'string',
                enum: ['json', 'sarif'],
                description: 'Output format. json returns a ComplianceSummary + full violation list. sarif returns SARIF 2.1.0 compatible output. Default: json.',
            },
        },
        required: ['source', 'filePath'],
    },
} as const
```

### Handler Behavior

1. Parse source with Babel.
2. Run `auditAll(ast, tokens)` for Mithril warnings.
3. Run `A11yLinter.audit(ast)` for a11y violations.
4. For each violation, resolve provenance via `resolveProvenance(ruleId)`.
5. Build a `ComplianceSummary`.
6. Return either the raw JSON or a SARIF 2.1.0 envelope depending on `format`.

The `ruleId` extraction from Mithril warnings requires parsing the rule code from the warning message (e.g., `MITHRIL-COL`, `MITHRIL-TYP-001`). For A11y violations, the rule code is the prefix of each message (e.g., `A11Y-001`).

**Design decision: ruleId extraction.** Currently, `LinterWarning.message` contains the ruleId as a prefix (e.g., `"MITHRIL-COL: ..."`, `"A11Y-001: ..."`). Rather than parsing this out of the message string, we add an optional `ruleId` field to `LinterWarning` that the visitors populate explicitly. This is a backward-compatible additive change:

```typescript
// bridge-mcp/src/types.ts -- LinterWarning addition
export interface LinterWarning {
    // ... existing fields ...
    /** Stable rule identifier for provenance lookup. Added by GOV.1. */
    ruleId?: string
}
```

Each visitor already knows its rule code (e.g., `MITHRIL-SPC-001`, `MITHRIL-TYP-003`). We add the `ruleId` field when constructing the warning object. Existing consumers that do not use this field are unaffected.

---

## Commandment Checklist

- [x] **C1 Code is Truth** -- GOV.1 provenance is static metadata, not a code mutation. GOV.2 writes to SQLite, not to .tsx. Neither feature modifies source code. N/A for this feature.
- [x] **C4 Local-First Only** -- All provenance data is bundled in the app (static map). No external API calls. Override telemetry writes to local SQLite.
- [x] **C5 Accessibility is a Compiler Error** -- Not weakened. Provenance enriches violation output; it does not suppress violations.
- [x] **C6 The Gatekeeper Rule** -- Export Gate is extended (Compliance Summary), not weakened. Overrides are tracked, not hidden.
- [x] **C9 Process Boundary** -- New IPC channels properly defined. No `fs` or `sqlite` in `src/`. All cross-boundary calls go through `window.bridgeAPI.governance.*`.
- [x] **C12 Atomic Queuing** -- GOV.2 writes use `GovernanceEventService.recordEvent()` which runs synchronous SQLite in the main process. No file writes involved.
- [x] **C14 Bypass Prohibition** -- Override telemetry is routed through the established GovernanceEventService, not direct SQLite calls.

---

## Implementation Order

### Group 0: Types (sequential, must come first)

| Step | File | Agent | Depends On |
|------|------|-------|------------|
| 0a | `bridge-mcp/src/core/governance/types.ts` | bridge-ast-surgeon | -- |
| 0b | `bridge-mcp/src/types.ts` | bridge-ast-surgeon | -- |
| 0c | `src/types/bridge-api.d.ts` | bridge-state-architect | -- |

### Group 1: MCP Engine (parallel within group, depends on Group 0)

| Step | File | Agent | Depends On |
|------|------|-------|------------|
| 1a | `bridge-mcp/src/core/governance/ruleProvenanceRegistry.ts` (NEW) | bridge-ast-surgeon | 0a |
| 1b | `bridge-mcp/src/core/governance/eventService.ts` (add `getOverrideCount`) | bridge-ast-surgeon | 0a |
| 1c | `bridge-mcp/src/core/MithrilLinter.ts` (add `ruleId` to warnings) | bridge-ast-surgeon | 0b |
| 1d | `bridge-mcp/src/core/A11yLinter.ts` (add `ruleId` to violation output -- see note) | bridge-ast-surgeon | 0b |
| 1e | `bridge-mcp/src/tools/auditReport.ts` (NEW) | bridge-ast-surgeon | 1a, 1c, 1d |
| 1f | `bridge-mcp/src/server.ts` (register `bridge_audit_report` tool) | bridge-ast-surgeon | 1e |

**Note on A11y ruleId:** The A11yLinter returns `A11yViolations = Record<string, string[]>` (bridgeId -> message list). The ruleId is embedded in each message string (e.g., `"A11Y-001: ..."`). For GOV.1, we do NOT change the A11yLinter return type -- we parse ruleIds from message prefixes in the auditReport handler using a simple `msg.match(/^(A11Y-\d{3})/)?.[1]` extraction. This avoids breaking the A11y violation pipeline.

### Group 2: IPC Layer (parallel, depends on Group 0)

| Step | File | Agent | Depends On |
|------|------|-------|------------|
| 2a | `electron/main.ts` | bridge-electron-ipc | 0a, 0c |
| 2b | `electron/preload.ts` | bridge-electron-ipc | 0c |

### Group 3: UI Layer (parallel within group, depends on Groups 1 + 2)

| Step | File | Agent | Depends On |
|------|------|-------|------------|
| 3a | `src/components/ui/ExportModal.tsx` | bridge-design-engineer | 0c, 2b |
| 3b | `src/components/editor/StatusBar.tsx` | bridge-design-engineer | 0c, 2b |
| 3c | `src/components/ui/GovernancePanel.tsx` | bridge-design-engineer | 0c, 2b |

### Group 4: Tests (parallel with Group 3)

| Step | File | Agent | Depends On |
|------|------|-------|------------|
| 4a | `bridge-mcp/src/core/governance/__tests__/ruleProvenanceRegistry.test.ts` (NEW) | bridge-test-writer | 1a |
| 4b | `bridge-mcp/src/core/governance/__tests__/eventService.test.ts` (MODIFY) | bridge-test-writer | 1b |
| 4c | `src/components/__tests__/ExportModal.test.tsx` | bridge-test-writer | 3a |
| 4d | `src/components/__tests__/StatusBar.test.tsx` | bridge-test-writer | 3b |

### Group 5: Integration Review (sequential, after all)

| Step | Task | Agent | Depends On |
|------|------|-------|------------|
| 5 | Full TSC check + IPC symmetry + contract fidelity | bridge-code-reviewer | all |

---

## Session ID Strategy

GOV.2 requires a `sessionId` to scope override counts to the current Glass session. The main process generates a UUID v4 on app launch and stores it in memory (not SQLite). This is the same session concept used by the presence system. The session ID is passed to `GovernanceEventService.recordEvent()` as the `sessionId` field.

For the IPC `governance:override-count` call, the main process uses its in-memory session ID to filter. No renderer-side session tracking is needed.

---

## Push Notification for Override Count

To avoid polling in StatusBar, the main process pushes a `bridge:governance-override-recorded` event after each successful `recordEvent` call for `eventType: 'override'`. The preload surface exposes:

```typescript
// electron/preload.ts addition
governance: {
    // ... recordOverride, getOverrideCount, getComplianceSummary ...

    /** Subscribe to override recording events. Returns unsubscribe fn. */
    onOverrideRecorded: (cb: () => void): (() => void) => {
        const listener = () => cb()
        ipcRenderer.on('bridge:governance-override-recorded', listener)
        return () => ipcRenderer.removeListener('bridge:governance-override-recorded', listener)
    },
}
```

StatusBar subscribes on mount, calls `getOverrideCount()` in the callback, and unsubscribes on unmount.

---

## Risks

### R1: Provenance Registry Completeness

The static registry must cover all 49 rules from `governanceRulesManifest.ts`. If a new rule is added to the manifest without a corresponding provenance entry, `resolveProvenance()` returns a fallback with `sourceAuthority: 'Bridge Design System'`. This is safe but produces a low-quality audit report. **Mitigation:** A test in `ruleProvenanceRegistry.test.ts` iterates `GOVERNANCE_RULES_MANIFEST` and asserts every rule has a provenance entry. This test will fail on any unregistered rule addition.

### R2: A11y Violation ruleId Extraction

A11y violations store the ruleId in the message string prefix, not as a structured field. The extraction regex `msg.match(/^(A11Y-\d{3})/)` is fragile if message format changes. **Mitigation:** The regex is tested against all 10 known A11y message formats in the auditReport test suite. Long-term, the A11yLinter should be refactored to return structured violations (tracked as a separate task, not in scope for GOV.1/GOV.2).

### R3: Cross-Store Contamination (C: anti-pattern)

GOV.2 telemetry recording happens in GovernancePanel (component layer), not in governanceStore. This is intentional -- calling `window.bridgeAPI` inside a Zustand store action violates the architectural anti-pattern rule. The GovernancePanel already imports and calls `setOverride` from the store; the IPC call is a separate statement in the same event handler.

### R4: IPC Channel Naming Collision

New channels use the `governance:` prefix, which does not collide with any existing prefix (`tokens:`, `ast:`, `sync:`, `ai:`, `bridge:`, `menu:`, `dialog:`, `file:`, `registry:`, `project:`, `preview:`, `terminal:`, `code:`).

### R5: Missing `saveRuleOverrides` / `getRuleOverrides` IPC Handlers

The existing `governanceStore` calls `window.bridgeAPI.saveRuleOverrides()` and `window.bridgeAPI.getRuleOverrides()`, but no IPC handlers exist for these in `electron/main.ts` or `electron/preload.ts`. The store falls back to localStorage. GOV.2 does NOT fix this gap -- it adds telemetry for override events, not persistence for the override state itself. The existing fallback to localStorage remains. This is a known gap tracked separately.

### R6: BridgeContext Type Missing

`useContextSync.ts` imports `BridgeContext` from `'../types/bridge-api'`, but this type is not defined in `bridge-api.d.ts`. This is a pre-existing issue not caused by GOV.1/GOV.2. The contextSync hook should be extended to include override count in the `BridgeContext.violations` object once the type is formalized, but that is a separate concern.

---

## Testing Requirements

### bridge-mcp tests (vitest.config.ts)

| Test File | Coverage Target | New Tests |
|-----------|----------------|-----------|
| `ruleProvenanceRegistry.test.ts` | `resolveProvenance()`, `buildComplianceSummary()` | 8 tests: known ruleId lookup, unknown ruleId fallback, all 49 manifest rules have entries, empty violations list, mixed severity aggregation, authority breakdown accuracy, rationale non-empty for all, lastUpdated format validation |
| `eventService.test.ts` | `getOverrideCount()` | 4 tests: returns 0 for new session, counts only override events, filters by sessionId, ignores non-override events |

### React component tests (vitest.config.react.ts)

| Test File | Coverage Target | New Tests |
|-----------|----------------|-----------|
| `ExportModal.test.tsx` | Compliance Summary rendering | 4 tests: renders compliance summary when violations exist, hides when no violations, shows authority badges, "Export Audit Report" button copies JSON |
| `StatusBar.test.tsx` | Overrides badge | 3 tests: badge hidden when count is 0, badge shows correct count, badge updates on push event |

### Edge Cases

- Empty provenance (unknown ruleId) -- must return fallback, not throw
- ruleId extraction from malformed A11y message -- must return null, not crash
- Concurrent override events -- GovernanceEventService handles rapid synchronous inserts (already proven by existing test)
- Session boundary -- override count resets on app restart (new session UUID)

### Report Format

```
[bridge-mcp]: X/Y passing (Z new)
[react]: X/Y passing (Z new)
TSC: 0 errors
```

---

## Files Summary

### New Files (4)

1. `/Users/tiemann/Lunar-Elevator-Bridge/bridge-mcp/src/core/governance/ruleProvenanceRegistry.ts`
2. `/Users/tiemann/Lunar-Elevator-Bridge/bridge-mcp/src/tools/auditReport.ts`
3. `/Users/tiemann/Lunar-Elevator-Bridge/bridge-mcp/src/core/governance/__tests__/ruleProvenanceRegistry.test.ts`
4. `/Users/tiemann/Lunar-Elevator-Bridge/.bridge-context/contracts/gov1-gov2-provenance-telemetry.md` (this file)

### Modified Files (11)

1. `/Users/tiemann/Lunar-Elevator-Bridge/bridge-mcp/src/core/governance/types.ts`
2. `/Users/tiemann/Lunar-Elevator-Bridge/bridge-mcp/src/core/governance/eventService.ts`
3. `/Users/tiemann/Lunar-Elevator-Bridge/bridge-mcp/src/core/governance/__tests__/eventService.test.ts`
4. `/Users/tiemann/Lunar-Elevator-Bridge/bridge-mcp/src/types.ts`
5. `/Users/tiemann/Lunar-Elevator-Bridge/bridge-mcp/src/server.ts`
6. `/Users/tiemann/Lunar-Elevator-Bridge/bridge-mcp/src/core/MithrilLinter.ts`
7. `/Users/tiemann/Lunar-Elevator-Bridge/electron/main.ts`
8. `/Users/tiemann/Lunar-Elevator-Bridge/electron/preload.ts`
9. `/Users/tiemann/Lunar-Elevator-Bridge/src/types/bridge-api.d.ts`
10. `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/ExportModal.tsx`
11. `/Users/tiemann/Lunar-Elevator-Bridge/src/components/editor/StatusBar.tsx`
12. `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/GovernancePanel.tsx`
