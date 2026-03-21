# Contract: POL.1 -- Configurable Policy Engine

**Phase:** POL.1 (Sprint 5)
**Priority:** P1
**Effort:** M
**Dependencies:** None (all prerequisites ONLINE)
**Author:** flint-architect
**Created:** 2026-03-16

---

## 0. Existing Infrastructure Assessment

Before defining what POL.1 builds, it is critical to acknowledge what already exists. A significant portion of the policy engine was scaffolded during prior phases:

| Artifact | Status | What exists |
|----------|--------|-------------|
| `flint-mcp/src/core/config.ts` | ONLINE | `FlintPolicy` type, `PolicyMode`, `GovernanceDomain`, `DEFAULT_POLICY`, `DEFAULT_CONFIG` |
| `flint-mcp/src/core/config-loader.ts` | ONLINE | `loadPolicy()` reads `.flint/policy.json` with deep-merge defaults, `loadConfig()` |
| `flint-mcp/src/core/policyLoader.ts` | ONLINE | `readPolicy()`, `writePolicy()`, `mergePolicy()`, `getDefaultPolicy()` |
| `flint-mcp/src/server.ts` | ONLINE | `flint_set_policy` MCP tool (read/update/reset) with GOV.2 telemetry |
| `electron/main.ts` | ONLINE | `policy:get` IPC handler reads policy from project root |
| `electron/preload.ts` | ONLINE | `window.flintAPI.policy.get()` exposed |
| `src/types/flint-api.d.ts` | ONLINE | Renderer-side `FlintPolicy`, `PolicyMode`, `PolicyAPI` types |
| `src/store/canvasStore.ts` | ONLINE | `cachedPolicy`, `loadPolicy()`, `canExport()` reads policy for export gate |
| `flint-mcp/src/core/MithrilLinter.ts` | ONLINE | `PolicyOptions` interface, `auditAll()` accepts optional thresholds |
| `flint-mcp/src/tools/audit.ts` | ONLINE | Reads `policy.mithril.mode`, `policy.a11y.mode`, `policy.a11y.disabled_rules` |

**What POL.1 actually needs to build is the gap between what exists and the full enterprise feature set:**

1. **Per-rule mode granularity** -- current schema has category-level mode (`mithril.mode`, `a11y.mode`) but no per-rule mode map
2. **Team overlays** -- no team override mechanism exists
3. **Domain preset selection** -- `domain` field exists in `FlintPolicy` (optional) and sentinel reads it, but Glass has no UI to set it
4. **Severity floor** -- `export_gate` uses boolean flags, not a severity floor
5. **Per-visitor Mithril modes** -- all 5 visitors share one `mode`, not individually configurable
6. **`policy:write` IPC channel** -- only `policy:get` exists; no write path from Glass
7. **Glass PolicySettings UI** -- no visual policy editor exists
8. **Schema validation** -- `loadPolicy()` validates version but has no field-level validation (range checks, enum validation)
9. **Hot-reload on file change** -- no `fs.watch` on `policy.json`

---

## 1. Full `.flint/policy.json` Schema

### 1.1 JSON Schema (Version 2)

```json
{
    "version": 2,
    "domain": "general",
    "mithril": {
        "deltaE_threshold": 2.0,
        "deltaE_critical_threshold": 10.0,
        "mode": "blocking",
        "ignore_patterns": ["**/node_modules/**"],
        "rules": {
            "MITHRIL-COL": "blocking",
            "MITHRIL-TYP-001": "blocking",
            "MITHRIL-TYP-002": "blocking",
            "MITHRIL-TYP-003": "blocking",
            "MITHRIL-TYP-004": "advisory",
            "MITHRIL-TYP-005": "advisory",
            "MITHRIL-SPC-001": "advisory",
            "MITHRIL-SHD-001": "advisory",
            "MITHRIL-OPC-001": "advisory"
        }
    },
    "a11y": {
        "level": "AA",
        "mode": "blocking",
        "rules": {
            "A11Y-001": "blocking",
            "A11Y-002": "blocking",
            "A11Y-003": "advisory",
            "A11Y-007": "off"
        }
    },
    "export_gate": {
        "severity_floor": "warning",
        "block_on_overrides": true
    },
    "baseline": {
        "enabled": false
    },
    "teams": {
        "marketing": {
            "mithril": {
                "deltaE_threshold": 5.0
            }
        },
        "compliance": {
            "a11y": {
                "level": "AAA"
            }
        }
    }
}
```

### 1.2 Schema Migration

- `version: 1` files are **forward-compatible**. `loadPolicy()` already deep-merges with defaults, so missing fields resolve correctly.
- `version: 2` adds: `mithril.rules`, `a11y.rules` (per-rule mode maps), `export_gate.severity_floor`, `teams`.
- The loader must accept both `version: 1` and `version: 2`. When `version: 1` is detected, the existing `disabled_rules` array is converted to the new `rules` map internally (each disabled rule maps to `'off'`).
- The existing `export_gate.block_on_mithril` / `block_on_a11y` booleans are **deprecated** in favor of `severity_floor` + per-category `mode`. The loader preserves backward compatibility: if only the old booleans are present, they are converted to the equivalent `severity_floor` + `mode` combination.

### 1.3 Validation Rules

| Field | Type | Range/Constraint | Default |
|-------|------|-----------------|---------|
| `version` | `number` | `1 \| 2` | `2` |
| `domain` | `GovernanceDomain` | one of 6 known values | `'general'` |
| `mithril.deltaE_threshold` | `number` | `0.5 <= x <= 20.0` | `2.0` |
| `mithril.deltaE_critical_threshold` | `number` | `> deltaE_threshold` | `10.0` |
| `mithril.mode` | `PolicyMode` | `'blocking' \| 'advisory' \| 'off'` | `'blocking'` |
| `mithril.ignore_patterns` | `string[]` | valid glob patterns | `['**/node_modules/**']` |
| `mithril.rules` | `Record<string, PolicyMode>` | known Mithril rule IDs only | `{}` (all inherit `mithril.mode`) |
| `a11y.level` | `A11yLevel` | `'A' \| 'AA' \| 'AAA'` | `'AA'` |
| `a11y.mode` | `PolicyMode` | `'blocking' \| 'advisory' \| 'off'` | `'blocking'` |
| `a11y.rules` | `Record<string, PolicyMode>` | known A11Y rule IDs only | `{}` (all inherit `a11y.mode`) |
| `export_gate.severity_floor` | `SeverityFloor` | `'critical' \| 'warning' \| 'info'` | `'warning'` |
| `export_gate.block_on_overrides` | `boolean` | -- | `true` |
| `teams` | `Record<string, TeamOverlay>` | team name keys, partial policy values | `{}` |

---

## 2. Type Contracts

### 2.1 Core Policy Types (extend `flint-mcp/src/core/config.ts`)

```typescript
// ── Existing types (no change) ──────────────────────────────────────────────
export type PolicyMode = 'blocking' | 'advisory' | 'off'
export type A11yLevel = 'A' | 'AA' | 'AAA'
export type GovernanceDomain =
    | 'general'
    | 'healthcare'
    | 'fintech'
    | 'e-commerce'
    | 'government'
    | 'enterprise-saas'

// ── New types ───────────────────────────────────────────────────────────────

/** Export gate severity floor. Violations below this level do not block export. */
export type SeverityFloor = 'critical' | 'warning' | 'info'

/**
 * Per-rule mode overrides. Keys are rule IDs (e.g. 'MITHRIL-COL', 'A11Y-001').
 * Rules not listed inherit their category-level mode.
 */
export type RuleModeMap = Record<string, PolicyMode>

/**
 * A team overlay: a deep-partial of the policy sections that can be merged
 * on top of the project-level policy when a teamId is active.
 */
export interface TeamOverlay {
    mithril?: Partial<FlintPolicy['mithril']>
    a11y?: Partial<FlintPolicy['a11y']>
    export_gate?: Partial<FlintPolicy['export_gate']>
}

/**
 * The `.flint/policy.json` schema (v2).
 * Every field has a sensible default so a missing or partial file is safe.
 */
export interface FlintPolicy {
    /** Schema version. Must be 1 or 2. */
    version: number

    /** Industry governance domain preset. */
    domain?: GovernanceDomain

    /** Mithril design system linter settings. */
    mithril: {
        deltaE_threshold: number
        deltaE_critical_threshold: number
        mode: PolicyMode
        ignore_patterns: string[]
        /** Per-rule mode overrides. Rules not listed inherit `mode`. */
        rules: RuleModeMap
    }

    /** Accessibility linter settings. */
    a11y: {
        level: A11yLevel
        mode: PolicyMode
        /**
         * @deprecated Use `rules` map instead. Preserved for v1 backward compat.
         * Rules listed here are treated as `rules[ruleId] = 'off'` internally.
         */
        disabled_rules?: string[]
        /** Per-rule mode overrides. Rules not listed inherit `mode`. */
        rules: RuleModeMap
    }

    /** Export gate settings. */
    export_gate: {
        /**
         * Minimum severity that blocks export.
         *   'critical' -- only critical violations block
         *   'warning'  -- warning and critical block (default)
         *   'info'     -- all violations block
         */
        severity_floor: SeverityFloor
        /** Whether component property overrides block export. */
        block_on_overrides: boolean
        /**
         * @deprecated Legacy v1 fields. Preserved for backward compat.
         * When present without severity_floor, they are converted:
         *   block_on_mithril=false -> mithril.mode='advisory'
         *   block_on_a11y=false    -> a11y.mode='advisory'
         */
        block_on_mithril?: boolean
        block_on_a11y?: boolean
    }

    /** Baseline settings for suppressing known violations. */
    baseline: {
        enabled: boolean
    }

    /** Per-team policy overlays. Keyed by team slug. */
    teams?: Record<string, TeamOverlay>
}
```

### 2.2 Policy Engine Public API (`flint-mcp/src/core/policyEngine.ts`)

```typescript
/**
 * Loads and validates .flint/policy.json from the project root.
 * Returns DEFAULT_POLICY_V2 when file is missing or invalid.
 * Handles v1 -> v2 migration transparently.
 */
export function loadPolicy(projectRoot: string): FlintPolicy

/**
 * Resolves the effective policy for a given team.
 * Merge order: DEFAULT_POLICY -> project policy -> team overlay.
 * When teamId is undefined or not found in teams, returns the project policy.
 */
export function resolvePolicy(projectRoot: string, teamId?: string): FlintPolicy

/**
 * Returns the effective mode for a specific rule ID.
 * Resolution: policy.{category}.rules[ruleId] ?? policy.{category}.mode
 */
export function getRuleMode(ruleId: string, policy: FlintPolicy): PolicyMode

/**
 * Returns the effective deltaE threshold from the resolved policy.
 */
export function getDeltaEThreshold(policy: FlintPolicy): number

/**
 * Returns the effective critical deltaE threshold from the resolved policy.
 */
export function getDeltaECriticalThreshold(policy: FlintPolicy): number

/**
 * Determines whether export should be blocked given a set of violations.
 * Considers: severity_floor, per-rule modes, block_on_overrides.
 *
 * A violation blocks export when ALL of these are true:
 *   1. getRuleMode(violation.ruleId, policy) === 'blocking'
 *   2. violation.severity meets or exceeds policy.export_gate.severity_floor
 */
export function shouldBlockExport(
    violations: Array<{ ruleId: string; severity: 'info' | 'warning' | 'critical' | 'amber' }>,
    overridesExist: boolean,
    policy: FlintPolicy,
): boolean

/**
 * Validates a raw JSON object against the FlintPolicy schema.
 * Returns { valid: true, policy } on success or { valid: false, errors } on failure.
 * Used by the IPC write handler and MCP tool to reject malformed input.
 */
export function validatePolicy(raw: unknown): {
    valid: true; policy: FlintPolicy
} | {
    valid: false; errors: string[]
}
```

### 2.3 Renderer-Side Type Updates (`src/types/flint-api.d.ts`)

The `FlintPolicy` type must be updated to match section 2.1. Additionally, the `PolicyAPI` interface must add a `set` method:

```typescript
export interface PolicyAPI {
    get: () => Promise<FlintPolicy>
    /**
     * Writes a partial policy update to .flint/policy.json via the main process.
     * The main process merges the partial into the existing policy and writes atomically.
     * Returns the full merged policy after write.
     */
    set: (partial: Partial<FlintPolicy>) => Promise<FlintPolicy>
}
```

---

## 3. Impact Map

| File | Change Type | Owner Agent | Notes |
|------|------------|-------------|-------|
| `flint-mcp/src/core/config.ts` | MODIFY | flint-state-architect | Extend `FlintPolicy` with `rules` maps, `SeverityFloor`, `TeamOverlay`, `teams`, deprecation markers. Update `DEFAULT_POLICY` to v2 shape. |
| `flint-mcp/src/core/policyEngine.ts` | NEW FILE | flint-state-architect | `resolvePolicy()`, `getRuleMode()`, `getDeltaEThreshold()`, `shouldBlockExport()`, `validatePolicy()`. |
| `flint-mcp/src/core/config-loader.ts` | MODIFY | flint-state-architect | Add v1->v2 migration in `loadPolicy()`. Add field-level validation (range checks). |
| `flint-mcp/src/core/policyLoader.ts` | MODIFY | flint-state-architect | Update `mergePolicy()` to handle `rules` maps and `teams`. |
| `flint-mcp/src/core/MithrilLinter.ts` | MODIFY | flint-ast-surgeon | `auditAll()` and each visitor accept full `PolicyOptions` with per-rule mode filtering. Visitors skip nodes when their rule is `'off'` and tag warnings as `'advisory'` when mode is `'advisory'`. |
| `flint-mcp/src/core/a11y/runner.ts` | MODIFY | flint-ast-surgeon | `auditSync()` reads per-rule mode from policy. Rules with mode `'off'` are excluded. Rules with mode `'advisory'` produce violations tagged `severity: 'advisory'`. |
| `flint-mcp/src/tools/audit.ts` | MODIFY | flint-ast-surgeon | Pass per-rule modes to linters. Report `blocking` vs `advisory` in results. |
| `flint-mcp/src/server.ts` | MODIFY (additive) | flint-electron-ipc | Update `flint_set_policy` tool schema to document v2 fields. No structural change -- `mergePolicy()` already handles the write. |
| `flint-mcp/src/prompts/sentinel.ts` | MODIFY | flint-ast-surgeon | Read `deltaE_threshold` from policy into the Mithril threshold text block (currently hardcoded as 2.0). |
| `electron/main.ts` | MODIFY | flint-electron-ipc | Add `policy:set` IPC handler. Add `fs.watch` on `.flint/policy.json` for hot-reload push to renderer. |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | Expose `window.flintAPI.policy.set()` and `window.flintAPI.policy.onChanged()`. |
| `src/types/flint-api.d.ts` | MODIFY | flint-state-architect | Update `FlintPolicy` to v2 shape. Add `PolicyAPI.set()` and `PolicyAPI.onChanged()`. |
| `src/store/canvasStore.ts` | MODIFY | flint-state-architect | Update `canExport()` to use `shouldBlockExport()` logic (severity floor + per-rule modes). Wire `policy.onChanged` listener. |
| `src/components/ui/PolicySettings.tsx` | NEW FILE | flint-design-engineer | Glass settings panel in right sidebar. |
| `src/components/ui/__tests__/PolicySettings.test.tsx` | NEW FILE | flint-test-writer | Unit tests for PolicySettings. |
| `flint-mcp/src/core/__tests__/policyEngine.test.ts` | NEW FILE | flint-test-writer | Unit tests for policyEngine (validate, resolve, shouldBlockExport). |

---

## 4. IPC Channels

| Channel | Direction | Payload Type | Return Type | Notes |
|---------|-----------|-------------|-------------|-------|
| `policy:get` | renderer -> main | `void` | `FlintPolicy` | **Exists.** No change. |
| `policy:set` | renderer -> main | `Partial<FlintPolicy>` | `FlintPolicy` | **NEW.** Merges partial into current, writes to disk, returns merged result. |
| `flint:policy-changed` | main -> renderer | `FlintPolicy` | `void` (broadcast) | **NEW.** Pushed by `fs.watch` on `.flint/policy.json` change (from MCP tool, external editor, or Glass). |

### 4.1 IPC Handler Specification: `policy:set`

```typescript
ipcMain.handle('policy:set', async (_event, partial: Partial<FlintPolicy>): Promise<FlintPolicy> => {
    if (!activeProjectRoot) {
        throw new Error('No project open')
    }
    const { validatePolicy } = await import('../flint-mcp/src/core/policyEngine.js')
    const { mergePolicy } = await import('../flint-mcp/src/core/policyLoader.js')

    // Merge first, then validate the result
    const merged = mergePolicy(activeProjectRoot, partial)
    const result = validatePolicy(merged)
    if (!result.valid) {
        throw new Error(`Invalid policy: ${result.errors.join(', ')}`)
    }

    // Broadcast to all renderer windows
    BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('flint:policy-changed', merged)
    })

    return merged
})
```

### 4.2 File Watcher Specification

The main process installs `fs.watch` on `.flint/policy.json` whenever `activeProjectRoot` is set (i.e. on project open). On change:

1. Debounce 200ms (policy files are small but editors may fire multiple write events).
2. Re-read `loadPolicy(activeProjectRoot)`.
3. Broadcast `flint:policy-changed` with the new policy to all renderer windows.

The watcher is torn down on `closeWorkspace` / project switch. This ensures external MCP tool calls (`flint_set_policy`) and manual edits to `policy.json` are reflected in Glass without requiring a restart.

---

## 5. Store Contracts

| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| `canvasStore` | (no new state -- `cachedPolicy` already exists) | `setCachedPolicy(policy)` (exists), wire `flint:policy-changed` listener | `canExport()` updated to use `shouldBlockExport()` from `policyEngine` |

### 5.1 canvasStore.canExport() -- Updated Logic

The current implementation reads `block_on_mithril` / `block_on_a11y` booleans and category-level `mode`. POL.1 replaces this with:

```typescript
canExport: () => {
    const { mithrilViolations, overridesExist, a11yViolations, cachedPolicy } = get()
    if (!cachedPolicy) {
        // No policy loaded -- use strictest defaults
        return mithrilViolations.length === 0 &&
               Object.keys(a11yViolations).length === 0 &&
               !overridesExist
    }

    // Build violation array from store state for shouldBlockExport()
    const violations: Array<{ ruleId: string; severity: string }> = []

    // Mithril violations come from editorStore.linterWarnings
    const linterWarnings = useEditorStore.getState().linterWarnings
    for (const id of mithrilViolations) {
        const w = linterWarnings.get(id)
        if (w) violations.push({ ruleId: w.ruleId ?? 'MITHRIL-COL', severity: w.severity })
    }

    // A11y violations
    for (const [, messages] of Object.entries(a11yViolations)) {
        for (const msg of messages) {
            const match = msg.match(/^(A11Y-\d{3})/)
            violations.push({ ruleId: match?.[1] ?? 'A11Y-UNKNOWN', severity: 'critical' })
        }
    }

    return !shouldBlockExport(violations, overridesExist, cachedPolicy)
}
```

**IMPORTANT architectural note:** The `shouldBlockExport` function is pure and lives in `flint-mcp`. It cannot be imported directly into the renderer (process boundary). Two options:

**Option A (recommended):** Inline the `shouldBlockExport` logic in `canvasStore.ts` as a local pure function that takes `cachedPolicy` and violations. This avoids cross-boundary imports and keeps the renderer free of MCP dependencies.

**Option B:** Expose `shouldBlockExport` via IPC. Rejected -- this would make `canExport()` async, breaking every synchronous callsite in the renderer.

Decision: **Option A**. The renderer implements a local `shouldBlockExport()` that mirrors the MCP-side logic. Both implementations are tested independently against the same test vectors.

---

## 6. Component Contracts

### 6.1 PolicySettings.tsx

| Property | Type | Source |
|----------|------|--------|
| `onClose` | `() => void` | Parent component (App.tsx or GovernancePanel) |

**Store dependencies:**
- `canvasStore.cachedPolicy` -- reads current policy for form initial values
- `canvasStore.loadPolicy` -- called after successful write to refresh cache

**IPC calls:**
- `window.flintAPI.policy.set(partial)` -- on form save
- `window.flintAPI.policy.get()` -- on mount (fallback if cachedPolicy is null)

**UI specification:**

```
+--------------------------------------------------------------+
| Policy Settings                                    [X Close] |
|--------------------------------------------------------------|
| Domain Preset                                                |
| [general v] dropdown (6 options)                             |
|                                                              |
| -- Mithril Design System --                                  |
| deltaE Threshold    [====O========] 2.0  (range: 0.5-20.0)  |
| Critical Threshold  [==========O==] 10.0 (range: 1.0-30.0)  |
|                                                              |
| Category Mode       [blocking v]                             |
|                                                              |
| Per-Rule Overrides                                           |
| MITHRIL-COL         [blocking v]                             |
| MITHRIL-TYP-001     [advisory v]                             |
| MITHRIL-SPC-001     [off      v]                             |
| ...                                                          |
|                                                              |
| -- Accessibility --                                          |
| Conformance Level   [AA v] dropdown (A/AA/AAA)               |
| Category Mode       [blocking v]                             |
|                                                              |
| Per-Rule Overrides                                           |
| A11Y-001            [blocking v]                             |
| A11Y-007            [advisory v]                             |
| ...                                                          |
|                                                              |
| -- Export Gate --                                             |
| Severity Floor      [warning v] (critical/warning/info)      |
| Block on Overrides  [toggle ON]                              |
|                                                              |
|--------------------------------------------------------------|
| [Reset to Defaults]                    [Cancel] [Save]       |
+--------------------------------------------------------------+
```

**Accessibility requirements (Commandment 5):**
- All form controls have associated `<label>` elements
- Sliders have `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- Dropdowns use native `<select>` or `role="combobox"` with `aria-expanded`
- Focus trap within modal
- Escape key closes

**Location in Glass:** The PolicySettings panel is opened from a button in the existing GovernancePanel header (next to the save/reset buttons) or from a new "Policy" subtab in the right sidebar. The architect recommends adding a "Policy" button to the GovernancePanel header bar, which opens PolicySettings as a full-screen modal overlay (same pattern as GovernancePanel itself).

---

## 7. Sentinel Prompt Composition

The `getFlintSentinelContent()` function in `flint-mcp/src/prompts/sentinel.ts` currently hardcodes `deltaE > 2.0` in the `BASE_BLOCK` text. POL.1 modifies it to accept an optional `policy: FlintPolicy` parameter:

```typescript
export function getFlintSentinelContent(
    domain?: string,
    projectRoot?: string,
    policy?: FlintPolicy,  // NEW: optional policy for threshold injection
): string
```

When `policy` is provided:
- Replace the hardcoded `2.0` with `policy.mithril.deltaE_threshold`
- Replace the hardcoded `10.0` with `policy.mithril.deltaE_critical_threshold`
- Add a `POLICY CONFIGURATION` section listing all non-default rule modes

The fintech preset already mentions tightening to 1.0. When the resolved domain is `fintech` AND the policy has `deltaE_threshold > 1.0`, the sentinel prompt notes the discrepancy: "Warning: project policy sets deltaE to X.X, but fintech domain recommends 1.0."

---

## 8. MithrilLinter.ts Integration

### 8.1 Extended PolicyOptions

```typescript
export interface PolicyOptions {
    deltaE_threshold?: number
    deltaE_critical_threshold?: number
    /** Per-rule mode map. When a rule's mode is 'off', skip it entirely. */
    ruleModes?: Record<string, PolicyMode>
}
```

### 8.2 Visitor Changes

Each visitor receives `options?.ruleModes` and checks its own rule ID:

- `visitClassNames` checks `ruleModes?.['MITHRIL-COL']`
- `visitTypography` checks `ruleModes?.['MITHRIL-TYP-001']` through `MITHRIL-TYP-005`
- `visitSpacing` checks `ruleModes?.['MITHRIL-SPC-001']`
- `visitShadows` checks `ruleModes?.['MITHRIL-SHD-001']`
- `visitOpacity` checks `ruleModes?.['MITHRIL-OPC-001']`

When a rule's mode is `'off'`, the visitor returns an empty Map for that rule. When a rule's mode is `'advisory'`, the warning is still emitted but with `severity: 'advisory'` (a new valid severity value). The `auditAll` function passes `PolicyOptions` to all visitors (currently only `visitClassNames` receives it).

### 8.3 LinterWarning Severity Extension

The `LinterWarning.severity` type in `flint-mcp/src/types.ts` must be extended:

```typescript
severity: 'amber' | 'critical' | 'advisory'
```

`'advisory'` means the violation is reported but does not count toward export blocking.

---

## 9. A11y Runner Integration

### 9.1 RunnerOptions Extension

```typescript
export interface RunnerOptions {
    filePath: string
    tokens?: DesignToken[]
    criteria?: WCAGCriterion[]
    categories?: A11yRuleCategory[]
    /** Per-rule mode map from policy. Rules with 'off' are excluded. */
    ruleModes?: Record<string, PolicyMode>
    /** WCAG conformance level from policy. Filters rules by level. */
    conformanceLevel?: 'A' | 'AA' | 'AAA'
}
```

### 9.2 Rule Filtering Logic

In `auditSync()`, the existing `activeRules` filter is extended:

```typescript
const activeRules = registeredRules.filter((rule) => {
    // Existing criteria/categories filters...

    // POL.1: Per-rule mode from policy
    if (options.ruleModes) {
        const mode = options.ruleModes[rule.id]
        if (mode === 'off') return false
    }

    // POL.1: Conformance level filter
    if (options.conformanceLevel) {
        const levelHierarchy = { 'A': 1, 'AA': 2, 'AAA': 3 }
        const requiredLevel = levelHierarchy[options.conformanceLevel] ?? 2
        const ruleLevel = levelHierarchy[rule.level] ?? 1
        if (ruleLevel > requiredLevel) return false
    }

    return true
})
```

Violations from rules in `'advisory'` mode get `severity: 'advisory'` instead of their default severity.

---

## 10. Commandment Compliance Checklist

| # | Commandment | Applies? | How POL.1 Satisfies It |
|---|-------------|----------|----------------------|
| 1 | Code is Truth | No | POL.1 modifies `.flint/policy.json` (metadata), not source code. |
| 2 | No Hallucinated Styling | No | POL.1 does not generate visual styles. |
| 3 | Composite IDs | No | No array rendering in PolicySettings (rule list is static manifest, not dynamic data). |
| 4 | Local-First Only | YES | Policy file is local `.flint/policy.json`. No network calls. |
| 5 | Accessibility is Compiler Error | YES | PolicySettings must meet full a11y standards (labels, focus trap, keyboard nav). The a11y conformance level setting itself cannot be set to 'off' in the Glass UI -- only MCP tool or manual file edit can do this, as a safety measure. |
| 6 | The Gatekeeper Rule | YES | `shouldBlockExport()` is the new gatekeeper. It respects `severity_floor` and per-rule modes. When a rule is `'advisory'`, its violations do not block export. When `'blocking'`, they do. The override gate (`block_on_overrides`) is preserved. |
| 7 | ID Preservation | No | No AST mutations. |
| 8 | Audit-First Execution | No | POL.1 is configuration, not AI task routing. |
| 9 | CIEDE2000 deltaE Logic | YES | The configurable `deltaE_threshold` directly controls the CIEDE2000 comparison in `visitClassNames`. The default remains 2.0. |
| 10 | Targeted Micro-Recovery | No | No undo operations. |
| 11 | Surgical Git Transplants | No | No git operations. |
| 12 | Atomic Queuing | PARTIALLY | `writePolicy()` writes `.flint/policy.json` directly (not through `FileTransactionManager`) because policy.json is metadata, not source code. This is an accepted exemption documented in `policyLoader.ts`. However, the write should still be atomic: write to `.tmp`, then `fs.renameSync()`. |
| 13 | Deterministic Surgery | No | No AST modifications. |
| 14 | Bypass Prohibition | YES | Glass writes policy via `policy:set` IPC, never via direct `fs`. Main process handles the write. |
| 15 | Granular AST Tools Only | No | No AST tool catalog changes. |
| 16 | In-Memory Validation | PARTIALLY | `validatePolicy()` validates the policy schema before writing. This is the policy-level equivalent of Commandment 16's type-check. |

---

## 11. Implementation Order

### Group 0: Git Setup (Sequential -- flint-git-guru)
1. Create feature branch `feat/pol1-configurable-policy-engine`

### Group 1: Foundation (Parallel)

These three agents can run simultaneously because they touch non-overlapping files:

| Agent | Task | Files |
|-------|------|-------|
| **flint-state-architect** (1A) | Extend `FlintPolicy` type in `config.ts`, add `SeverityFloor`, `RuleModeMap`, `TeamOverlay`. Update `DEFAULT_POLICY` to v2 shape with backward compat. Create `policyEngine.ts` with `resolvePolicy`, `getRuleMode`, `getDeltaEThreshold`, `shouldBlockExport`, `validatePolicy`. Update `config-loader.ts` with v1->v2 migration + field validation. Update `policyLoader.ts` mergePolicy for rules maps + teams. Update `src/types/flint-api.d.ts` with v2 types + `PolicyAPI.set`. | `flint-mcp/src/core/config.ts`, `flint-mcp/src/core/policyEngine.ts` (new), `flint-mcp/src/core/config-loader.ts`, `flint-mcp/src/core/policyLoader.ts`, `src/types/flint-api.d.ts` |
| **flint-electron-ipc** (1B) | Add `policy:set` IPC handler in `main.ts`. Add `fs.watch` on `.flint/policy.json` with debounced `flint:policy-changed` broadcast. Expose `policy.set()` and `policy.onChanged()` in `preload.ts`. | `electron/main.ts`, `electron/preload.ts` |
| **flint-test-writer** (1C) | Write comprehensive tests for `policyEngine.ts`: validatePolicy (valid/invalid/edge cases), resolvePolicy (default/project/team merge), getRuleMode (per-rule override, category fallback), shouldBlockExport (severity floor, per-rule modes, overrides). Write v1->v2 migration tests. | `flint-mcp/src/core/__tests__/policyEngine.test.ts` (new) |

### Group 2: Linter Integration (Parallel, depends on Group 1)

| Agent | Task | Files |
|-------|------|-------|
| **flint-ast-surgeon** (2A) | Extend `PolicyOptions` in MithrilLinter with `ruleModes`. Update each visitor to skip rules with mode `'off'` and tag `'advisory'` warnings. Pass `PolicyOptions` to all 5 visitors in `auditAll()`. Extend `LinterWarning.severity` to include `'advisory'`. | `flint-mcp/src/core/MithrilLinter.ts`, `flint-mcp/src/types.ts` |
| **flint-ast-surgeon** (2B) | Extend `RunnerOptions` with `ruleModes` and `conformanceLevel`. Update `auditSync()` rule filtering. Tag advisory violations. | `flint-mcp/src/core/a11y/runner.ts` |
| **flint-ast-surgeon** (2C) | Update `handleFlintAudit()` to build `PolicyOptions.ruleModes` from `config.policy`. Pass conformance level to A11y runner. Update sentinel prompt to accept policy thresholds. | `flint-mcp/src/tools/audit.ts`, `flint-mcp/src/prompts/sentinel.ts` |

### Group 3: Glass UI (Depends on Group 1)

| Agent | Task | Files |
|-------|------|-------|
| **flint-design-engineer** (3A) | Build `PolicySettings.tsx` -- form controls for all policy fields. Wire to `policy.set()` IPC and `loadPolicy()` refresh. Accessible form with labels, focus trap, keyboard nav. | `src/components/ui/PolicySettings.tsx` (new) |
| **flint-state-architect** (3B) | Update `canvasStore.canExport()` with new `shouldBlockExport` logic (Option A inline). Wire `flint:policy-changed` listener in `App.tsx` or a dedicated hook to auto-update `cachedPolicy`. | `src/store/canvasStore.ts` |
| **flint-test-writer** (3C) | Tests for PolicySettings (renders, form interactions, save/cancel, a11y). Tests for updated canvasStore.canExport() with severity floor and per-rule modes. | `src/components/ui/__tests__/PolicySettings.test.tsx` (new) |

### Group 4: Integration Validation (Sequential, depends on Groups 2 + 3)

| Agent | Task |
|-------|------|
| **flint-integration-validator** | Run full test suite. Verify: policy read->modify->read round-trip via MCP tool. Verify: Glass PolicySettings writes and hot-reload works. Verify: MithrilLinter respects per-rule modes. Verify: A11y runner respects conformance level and per-rule modes. Verify: ExportModal behavior changes with advisory rules. Verify: TSC 0 errors. |

### Group 5: Git Finalization (Sequential -- flint-git-guru)
1. Commit per-group as each completes
2. Create PR on SHIP verdict from integration validator

---

## 12. Risks

| Risk | Severity | Commandment Threatened | Mitigation |
|------|----------|----------------------|------------|
| **Cross-store import in canvasStore** | High | Anti-pattern: cross-store contamination | Option A (inline `shouldBlockExport` logic) avoids importing policyEngine into the renderer. Both sides tested against shared test vectors. |
| **v1 -> v2 migration breaks existing projects** | Medium | Commandment 4 (local-first reliability) | Deep-merge defaults ensure every missing field resolves to a safe value. Explicit unit tests for v1 schema input. |
| **`severity: 'advisory'` breaks downstream consumers** | Medium | -- | `LinterWarning.severity` union type is extended, not replaced. Existing `'amber' \| 'critical'` consumers continue to work. `'advisory'` is only emitted when the policy explicitly sets a rule to advisory. ExportModal must handle the new value gracefully. |
| **fs.watch race condition on rapid policy edits** | Low | Commandment 12 (atomic queuing) | 200ms debounce on the watcher. Write operations use tmp->rename pattern. |
| **Team overlay merging creates unexpected combinations** | Low | -- | `resolvePolicy()` uses shallow-then-deep merge (same pattern as `loadPolicy`). Test cases cover conflicting team overlay values. |
| **PolicySettings form state drift from file** | Low | -- | Hot-reload via `flint:policy-changed` push event updates the form. If the user has unsaved changes and an external change arrives, show a "Policy changed externally -- reload?" prompt. |
| **Sentinel prompt length explosion with many rule overrides** | Low | -- | Cap the POLICY CONFIGURATION section to top-10 non-default rules with a "and N more..." trailer. |

---

## 13. Test Strategy

### 13.1 policyEngine.test.ts (flint-mcp)

| Test Category | Cases |
|---------------|-------|
| `validatePolicy` | Valid v2 policy, valid v1 policy, missing version, version 3 (rejected), deltaE below range (0.0), deltaE above range (50.0), deltaE_critical < deltaE (rejected), unknown domain (rejected), unknown rule ID in rules map (rejected), empty object (resolves to defaults), null input (rejected) |
| `loadPolicy` (v1 migration) | v1 with `disabled_rules: ['A11Y-007']` converts to `rules: { 'A11Y-007': 'off' }`, v1 `block_on_mithril: false` converts to mithril mode advisory, v1 missing fields get defaults |
| `resolvePolicy` | No teams defined returns project policy, team exists returns merged overlay, team not found returns project policy, team overlay with partial mithril section merges correctly, team overlay does not leak into base policy |
| `getRuleMode` | Rule in per-rule map returns its mode, rule not in map returns category mode, Mithril rule returns from mithril.rules, A11Y rule returns from a11y.rules |
| `shouldBlockExport` | All rules blocking + violations = blocked, all rules advisory + violations = not blocked, severity floor 'critical' + only warning violations = not blocked, severity floor 'warning' + warning violations = blocked, overrides exist + block_on_overrides true = blocked, overrides exist + block_on_overrides false = not blocked, empty violations = not blocked |

### 13.2 MithrilLinter (extended tests)

| Test | What it verifies |
|------|-----------------|
| `visitClassNames with MITHRIL-COL: 'off'` | Returns empty map when color rule is off |
| `visitClassNames with MITHRIL-COL: 'advisory'` | Returns warnings with `severity: 'advisory'` |
| `visitTypography with per-rule modes` | TYP-001 off, TYP-002 blocking: only TYP-002 violations returned |
| `auditAll passes PolicyOptions to all visitors` | All 5 visitors receive and respect ruleModes |

### 13.3 A11y Runner (extended tests)

| Test | What it verifies |
|------|-----------------|
| `conformanceLevel 'A' filters out AA/AAA rules` | Only level-A rules run |
| `conformanceLevel 'AAA' includes all rules` | All rules run |
| `ruleModes A11Y-001: 'off' excludes that rule` | A11Y-001 violations not reported |
| `ruleModes A11Y-003: 'advisory' tags severity` | A11Y-003 violations have severity 'advisory' |

### 13.4 PolicySettings.test.tsx (Glass)

| Test | What it verifies |
|------|-----------------|
| Renders without crash | Component mounts with default policy |
| deltaE slider changes value | Slider updates local state, does not call IPC until save |
| Save button calls policy.set | Clicking Save invokes `window.flintAPI.policy.set()` with correct partial |
| Cancel discards changes | Local state reverts to cachedPolicy |
| Reset to Defaults | Calls `policy.set()` with `DEFAULT_POLICY` |
| Accessibility: all labels present | Every input has associated label (axe-core or manual check) |
| Keyboard navigation | Tab order covers all controls, Escape closes |

### 13.5 canvasStore.canExport() (updated tests)

| Test | What it verifies |
|------|-----------------|
| No policy loaded: strict defaults | Same behavior as pre-POL.1 |
| severity_floor 'critical': only critical blocks | Warning violations do not block |
| Per-rule advisory: violations present but export allowed | Advisory rules do not block |
| block_on_overrides false: overrides do not block | Override gate disabled |

---

## 14. Coordination Notes

### Territory Map Updates

This contract claims the files listed in the Impact Map (section 3). The ACTIVE-SWARM-TERRITORY.md already has a POL.1 section that must be updated to reflect the full file list from this contract.

### Non-Interference Guarantees

- `flint-mcp/src/server.ts` is modified **additively only** (updating the `flint_set_policy` tool schema documentation). The tool handler itself already delegates to `mergePolicy()`, which POL.1 updates. No conflict with GOV.1/GOV.2 work.
- `electron/orchestrator.ts` is NOT touched.
- `src/store/governanceStore.ts` is NOT touched. GovernancePanel's rule toggle system (enable/disable per rule) is a separate, UI-only override mechanism. POL.1's per-rule modes in `policy.json` are the persistent, file-level policy. The two systems coexist: governanceStore overrides are session-scoped and take precedence over policy for display purposes. POL.1 does not change this relationship.

### Relationship: GovernanceStore Overrides vs. Policy Rules

| Mechanism | Scope | Persistence | Purpose |
|-----------|-------|-------------|---------|
| `governanceStore.overrides` | Glass session | localStorage / `.flint/overrides.json` | Quick toggle during development. Session-scoped designer preference. |
| `policy.json rules` | Project | `.flint/policy.json` (committed to git) | Permanent team policy. Affects MCP server, CI, and all Glass sessions. |

When both are active, the effective rule mode for Glass rendering is:
- If `governanceStore.overrides[ruleId].enabled === false`, the rule is visually off regardless of policy.
- If `governanceStore.overrides[ruleId]` is not set, the policy rule mode applies.
- This resolution happens in the renderer only (display/export gate logic). The MCP server reads policy.json directly and is not affected by Glass session overrides.
