# Contract: ERM — Enterprise Rule Management

**Phase:** ERM
**Status:** APPROVED
**Date:** 2026-03-26
**Architect:** flint-architect
**Builds on:** UCFG.1-7 (Unified Config), POL.1 (Policy Engine), GOV.1-2 (Provenance/Telemetry)

---

## 1. Scope

### In Scope

1. **Rule Pack Registry** — Static TypeScript registry of all available governance rule packs with metadata (domain, jurisdiction, rule count, status). Bundled with the MCP server. NOT a database.
2. **5 MCP Tools** — `flint_list_rule_packs`, `flint_enable_pack`, `flint_disable_pack`, `flint_set_rule_mode`, `flint_compliance_coverage`.
3. **Glass UI: RuleCatalogPanel** — New section within the existing GovernancePanel (full-screen modal) that shows rule packs grouped by domain with enable/disable controls.
4. **Glass UI: ComplianceProfileSelector** — Checkbox-based jurisdiction picker within the GovernancePanel header area.
5. **Glass UI: InheritanceVisualizer** — Visual chain showing where rules came from (extends resolution) in the Health tab of the right sidebar.
6. **Glass UI: CoverageBar** — Per-jurisdiction coverage percentage rendered in the GovernanceDashboard (Health tab).
7. **IPC channels** — 2 new channels for config read/write from renderer.

### Out of Scope

- Marketplace / license validation for rule packs (`requiresLicense` field is declared but not enforced)
- New governance rule implementations (existing 50 A11y + 19 Mithril rules are cataloged; coming-soon packs are metadata only)
- PowerSync / cloud sync for rule pack state
- New Zustand stores (extend `governanceStore` only)
- GDPR/PCI-DSS/SOC2 rule logic (those packs are `coming-soon` in the catalog)

---

## 2. Architecture

### Where Each Piece Lives

| Component | Process | Owner |
|-----------|---------|-------|
| `rulePackRegistry.ts` | MCP server (`flint-mcp/src/core/`) | Static TypeScript constant, no DB |
| 5 MCP tool handlers | MCP server (`flint-mcp/src/tools/rulePacks.ts`) | Request handler cases in `server.ts` |
| `flint.config.yaml` read/write | Electron main (`electron/main.ts`) | IPC handlers |
| GovernancePanel enhancements | Renderer (`src/components/ui/GovernancePanel.tsx`) | Existing component, extended |
| InheritanceVisualizer | Renderer (`src/components/ui/InheritanceVisualizer.tsx`) | New component in Health tab |
| CoverageBar | Renderer (`src/components/ui/GovernanceDashboard.tsx`) | Existing component, extended |
| governanceStore extensions | Renderer (`src/store/governanceStore.ts`) | Existing store, extended |
| IPC surface | Preload (`electron/preload.ts`) | 2 new channels |

### Data Flow

```
User clicks "Enable Pack" in GovernancePanel
  -> GovernancePanel calls window.flintAPI.governance.enablePack(packId)
  -> preload.ts forwards to ipcRenderer.invoke('governance:enable-pack', packId)
  -> electron/main.ts handler:
       1. Reads flint.config.yaml
       2. Adds preset ref to extends[] (e.g., "@flint/healthcare")
       3. Writes flint.config.yaml via FileTransactionManager
       4. Broadcasts 'governance:config-changed' to renderer
  -> GovernancePanel re-reads resolved config to update UI

User opens Glass Health tab
  -> GovernanceDashboard renders CoverageBar
  -> CoverageBar calls window.flintAPI.governance.getResolvedConfig()
  -> Returns resolved FlintProjectConfig with extends chain metadata
  -> CoverageBar computes per-jurisdiction coverage from rule pack registry
```

---

## 3. Types

### 3a. Rule Pack Registry Types (MCP-side)

```typescript
// flint-mcp/src/core/rulePackRegistry.ts

/**
 * Compliance domain taxonomy.
 * Maps to regulatory frameworks and design system governance categories.
 */
export type ComplianceDomain =
    | 'accessibility'
    | 'privacy'
    | 'security'
    | 'brand'
    | 'cognitive'
    | 'design-system'

/**
 * A jurisdiction or regulatory framework that a rule pack addresses.
 * Examples: "EU/EAA" (European Accessibility Act), "US/ADA", "US/HIPAA".
 */
export type Jurisdiction = string

/**
 * A single rule within a pack with its metadata.
 */
export interface RulePackEntry {
    /** Rule ID, e.g. "A11Y-001", "MITHRIL-COL" */
    id: string
    /** Human-readable rule name */
    name: string
    /** Detailed description of what the rule checks */
    description: string
    /** WCAG criterion if applicable, e.g. "1.1.1", "2.5.8" */
    wcagCriterion?: string
    /** Regulatory reference, e.g. "GDPR Art. 7", "PCI-DSS 3.4" */
    regulation?: string
    /** Current enforcement mode in the active config */
    defaultMode: 'coercive' | 'normative' | 'advisory' | 'off'
    /** Whether the rule has an auto-fix implementation */
    autoFixable: boolean
    /** Category for grouping in UI */
    category: string
}

/**
 * A governance rule pack — a logical grouping of rules addressing
 * a compliance domain or regulatory requirement.
 */
export interface RulePack {
    /** Unique pack identifier, e.g. "wcag-2.1-aa", "gdpr-consent", "pci-dss-ui" */
    id: string
    /** Human-readable display name */
    name: string
    /** Compliance domain this pack addresses */
    domain: ComplianceDomain
    /** Description of the pack's purpose and coverage */
    description: string
    /** Number of rules in the pack */
    ruleCount: number
    /** The individual rules in this pack */
    rules: RulePackEntry[]
    /** Jurisdictions/regulations this pack addresses */
    jurisdictions: Jurisdiction[]
    /** Which @flint/ preset enables this pack, if any */
    preset?: string
    /** Pack availability status */
    status: 'active' | 'available' | 'coming-soon'
    /** Reserved for future marketplace */
    requiresLicense?: boolean
}

/**
 * Per-jurisdiction coverage analysis result.
 */
export interface JurisdictionCoverage {
    /** Jurisdiction name, e.g. "EU/EAA" */
    jurisdiction: Jurisdiction
    /** Total rules addressing this jurisdiction */
    totalRules: number
    /** Rules currently active (enabled and not 'off') */
    activeRules: number
    /** Coverage as percentage (0-100) */
    coveragePercent: number
    /** Rule packs contributing to this jurisdiction */
    contributingPacks: string[]
    /** Packs available but not enabled */
    availablePacks: string[]
}

/**
 * Extends chain metadata for the InheritanceVisualizer.
 * Shows where each config section originates.
 */
export interface ConfigInheritanceNode {
    /** Source identifier: "@flint/healthcare", "./team.yaml", or "(project)" */
    source: string
    /** Which config sections this source provides/overrides */
    sections: string[]
    /** Resolution order position (0 = first/base) */
    order: number
    /** Whether this is the project's own config (final override) */
    isProjectConfig: boolean
}
```

### 3b. MCP Tool Schemas

```typescript
// ── flint_list_rule_packs ────────────────────────────────────────────
export interface ListRulePacksInput {
    /** Filter by domain. Omit for all packs. */
    domain?: ComplianceDomain
    /** Filter by status. Omit for all statuses. */
    status?: 'active' | 'available' | 'coming-soon'
    /** Filter by jurisdiction. Omit for all jurisdictions. */
    jurisdiction?: string
}

export interface ListRulePacksOutput {
    packs: RulePack[]
    summary: {
        total: number
        active: number
        available: number
        comingSoon: number
        jurisdictionsCovered: string[]
    }
}

// ── flint_enable_pack ────────────────────────────────────────────────
export interface EnablePackInput {
    /** Pack ID to enable, e.g. "wcag-2.1-aa" */
    packId: string
    /** If true, preview what would change without writing. Default false. */
    dryRun?: boolean
}

export interface EnablePackOutput {
    success: boolean
    /** What changed in flint.config.yaml */
    changes: {
        /** Preset ref added to extends[] */
        addedExtend?: string
        /** Rules activated count */
        rulesActivated: number
        /** New jurisdictions covered */
        jurisdictionsAdded: string[]
    }
    /** Tighten-only violations if the pack would relax existing rules */
    tightenOnlyViolations: string[]
    /** Updated extends list */
    resolvedExtends: string[]
}

// ── flint_disable_pack ───────────────────────────────────────────────
export interface DisablePackInput {
    /** Pack ID to disable */
    packId: string
    /** If true, preview what would change without writing. Default false. */
    dryRun?: boolean
}

export interface DisablePackOutput {
    success: boolean
    changes: {
        /** Preset ref removed from extends[] */
        removedExtend?: string
        /** Rules deactivated count */
        rulesDeactivated: number
        /** Jurisdictions no longer covered */
        jurisdictionsRemoved: string[]
    }
    /** Warning if disabling reduces coverage below thresholds */
    warnings: string[]
}

// ── flint_set_rule_mode ──────────────────────────────────────────────
export interface SetRuleModeInput {
    /** Rule ID, e.g. "A11Y-001" */
    ruleId: string
    /** New enforcement mode */
    mode: 'coercive' | 'normative' | 'advisory' | 'off'
    /** Justification required for relaxing a rule */
    justification?: string
}

export interface SetRuleModeOutput {
    success: boolean
    ruleId: string
    previousMode: string
    newMode: string
    /** Whether the change was blocked by tighten_only */
    blockedByTightenOnly: boolean
    /** Warning message if applicable */
    warning?: string
}

// ── flint_compliance_coverage ────────────────────────────────────────
export interface ComplianceCoverageInput {
    /** Specific jurisdiction to analyze. Omit for all. */
    jurisdiction?: string
    /** Include rule-level detail (verbose). Default false. */
    detailed?: boolean
}

export interface ComplianceCoverageOutput {
    /** Per-jurisdiction coverage breakdown */
    jurisdictions: JurisdictionCoverage[]
    /** Overall coverage across all jurisdictions */
    overallCoverage: number
    /** Recommendations for improving coverage */
    recommendations: string[]
    /** Inheritance chain showing where config comes from */
    inheritanceChain: ConfigInheritanceNode[]
}
```

### 3c. IPC Payload Types

```typescript
// electron/preload.ts additions to governance API

/** Resolved config with extends chain metadata for Glass UI. */
export interface ResolvedConfigPayload {
    /** The fully resolved FlintProjectConfig */
    config: {
        project: string
        domain?: string
        extends?: string[]
        rules?: {
            mithril?: { mode?: string; delta_e?: number }
            accessibility?: { level?: string; mode?: string; disabled?: string[] }
        }
    }
    /** Inheritance chain for visualization */
    inheritanceChain: ConfigInheritanceNode[]
    /** Active presets (resolved extends refs) */
    activePresets: string[]
}

/** Pack enable/disable result returned from main process. */
export interface PackToggleResult {
    success: boolean
    message: string
    rulesAffected: number
    newExtends: string[]
}
```

### 3d. Glass Component Props

```typescript
// ── RuleCatalogSection (within GovernancePanel) ──────────────────────
interface RuleCatalogSectionProps {
    /** All rule packs from registry, fetched via MCP or static import */
    packs: RulePack[]
    /** Currently active preset IDs (from resolved config) */
    activePresets: string[]
    /** Callback when user enables a pack */
    onEnablePack: (packId: string) => void
    /** Callback when user disables a pack */
    onDisablePack: (packId: string) => void
    /** Loading state during pack toggle */
    isToggling: boolean
}

// ── ComplianceProfileSelector (within GovernancePanel header) ────────
interface ComplianceProfileSelectorProps {
    /** Available jurisdictions derived from rule pack registry */
    jurisdictions: string[]
    /** Currently covered jurisdictions (from active packs) */
    activeJurisdictions: string[]
    /** Callback when user toggles a jurisdiction */
    onToggleJurisdiction: (jurisdiction: string) => void
}

// ── InheritanceVisualizer (in Health tab) ────────────────────────────
interface InheritanceVisualizerProps {
    /** Ordered chain of config sources */
    chain: ConfigInheritanceNode[]
    /** Currently loading */
    isLoading: boolean
}

// ── CoverageBar (in GovernanceDashboard) ─────────────────────────────
interface CoverageBarProps {
    /** Per-jurisdiction coverage data */
    coverages: JurisdictionCoverage[]
    /** Overall coverage percentage */
    overallCoverage: number
}
```

---

## 4. MCP Tools — Full Registration Schema

### 4a. `flint_list_rule_packs`

```json
{
    "name": "flint_list_rule_packs",
    "description": "Returns all governance rule packs with their status, rule counts, domain, and jurisdiction coverage. Use to discover what compliance frameworks are available and which are currently active.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "domain": {
                "type": "string",
                "enum": ["accessibility", "privacy", "security", "brand", "cognitive", "design-system"],
                "description": "Filter packs by compliance domain."
            },
            "status": {
                "type": "string",
                "enum": ["active", "available", "coming-soon"],
                "description": "Filter packs by availability status."
            },
            "jurisdiction": {
                "type": "string",
                "description": "Filter packs by jurisdiction, e.g. 'EU/EAA', 'US/ADA'."
            }
        }
    }
}
```

### 4b. `flint_enable_pack`

```json
{
    "name": "flint_enable_pack",
    "description": "Enables a governance rule pack by adding its preset to the project's flint.config.yaml extends chain. Validates tighten_only constraints. Use dry_run to preview changes.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "pack_id": {
                "type": "string",
                "description": "Rule pack ID to enable, e.g. 'wcag-2.1-aa', 'hipaa-phi'."
            },
            "dry_run": {
                "type": "boolean",
                "description": "When true, returns what would change without modifying the config."
            }
        },
        "required": ["pack_id"]
    }
}
```

### 4c. `flint_disable_pack`

```json
{
    "name": "flint_disable_pack",
    "description": "Disables a governance rule pack by removing its preset from the project's flint.config.yaml extends chain. Warns if this reduces compliance coverage.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "pack_id": {
                "type": "string",
                "description": "Rule pack ID to disable."
            },
            "dry_run": {
                "type": "boolean",
                "description": "When true, returns what would change without modifying the config."
            }
        },
        "required": ["pack_id"]
    }
}
```

### 4d. `flint_set_rule_mode`

```json
{
    "name": "flint_set_rule_mode",
    "description": "Changes the enforcement mode of a single governance rule. Requires justification when relaxing (coercive -> normative, normative -> advisory, etc.). Respects tighten_only constraints from inherited configs.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "rule_id": {
                "type": "string",
                "description": "Rule ID, e.g. 'A11Y-001', 'MITHRIL-COL'."
            },
            "mode": {
                "type": "string",
                "enum": ["coercive", "normative", "advisory", "off"],
                "description": "New enforcement mode."
            },
            "justification": {
                "type": "string",
                "description": "Required when relaxing enforcement. Recorded in governance audit trail."
            }
        },
        "required": ["rule_id", "mode"]
    }
}
```

### 4e. `flint_compliance_coverage`

```json
{
    "name": "flint_compliance_coverage",
    "description": "Returns per-jurisdiction compliance coverage analysis showing which regulatory frameworks are covered by active rule packs, coverage percentages, and recommendations for gaps.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "jurisdiction": {
                "type": "string",
                "description": "Specific jurisdiction to analyze, e.g. 'EU/EAA'. Omit for all."
            },
            "detailed": {
                "type": "boolean",
                "description": "Include per-rule breakdown in each jurisdiction. Default false."
            }
        }
    }
}
```

---

## 5. IPC Channels

| Channel | Direction | Payload Type | Return Type | Purpose |
|---------|-----------|-------------|-------------|---------|
| `governance:get-resolved-config` | Renderer -> Main | `void` | `ResolvedConfigPayload` | Read the fully resolved flint.config.yaml with extends chain metadata |
| `governance:toggle-pack` | Renderer -> Main | `{ packId: string, enable: boolean }` | `PackToggleResult` | Add/remove a preset ref from extends[] in flint.config.yaml |

**Why only 2 channels:**
- `flint_list_rule_packs` and `flint_compliance_coverage` are computed from the static registry + resolved config. Glass can call these via `window.flintAPI.mcp.callTool()` (bidirectional MCP action bridge, Phase W.3) OR compute them locally from the resolved config payload. The registry is duplicated as a lightweight renderer-side constant for instant UI rendering.
- `flint_set_rule_mode` goes through the existing `governance:record-override` IPC channel + `saveRuleOverrides` for persistence. No new channel needed.
- `flint_enable_pack` / `flint_disable_pack` both map to `governance:toggle-pack` which modifies `flint.config.yaml`.

---

## 6. Store Contracts

### governanceStore — Extensions

| State | Type | Purpose |
|-------|------|---------|
| `activePresets` | `string[]` | Currently active preset refs from resolved config |
| `inheritanceChain` | `ConfigInheritanceNode[]` | Extends chain for InheritanceVisualizer |
| `jurisdictionCoverage` | `JurisdictionCoverage[]` | Cached per-jurisdiction coverage |
| `isLoadingConfig` | `boolean` | Loading state for config fetch |

| Action | Signature | Purpose |
|--------|-----------|---------|
| `fetchResolvedConfig` | `() => Promise<void>` | Fetches resolved config via IPC, populates `activePresets` + `inheritanceChain` |
| `togglePack` | `(packId: string, enable: boolean) => Promise<PackToggleResult>` | Calls IPC to toggle pack, refreshes config |
| `computeCoverage` | `() => void` | Derives `jurisdictionCoverage` from `activePresets` + static registry |

**Note:** `togglePack` calls `window.flintAPI` from the store action. This is acceptable here because the governanceStore already does this pattern with `saveToFile` and `loadFromFile` (see existing code at line 65-68 of `governanceStore.ts`). The precedent is established in this specific store.

---

## 7. Glass Components — Component Tree

```
GovernancePanel (existing, modified)
  |-- Header (modified: add ComplianceProfileSelector)
  |     |-- ComplianceProfileSelector (NEW)
  |           |-- JurisdictionCheckbox (inline)
  |
  |-- Body (modified: add tab for Rule Catalog alongside Rule List)
  |     |-- CategorySidebar (existing)
  |     |-- TabBar: "Rules" | "Rule Packs" (NEW)
  |     |-- [tab=Rules] RuleRow list (existing)
  |     |-- [tab=Packs] RuleCatalogSection (NEW)
  |           |-- PackCard (NEW, one per pack)
  |                 |-- StatusBadge (active/available/coming-soon)
  |                 |-- DomainBadge
  |                 |-- JurisdictionTags
  |                 |-- EnableToggle
  |                 |-- RuleCountChip
  |                 |-- Expandable: rule list

GovernanceDashboard (existing, modified)
  |-- [new section] Compliance Coverage
  |     |-- CoverageBar (NEW)
  |           |-- JurisdictionRow (one per jurisdiction with progress bar)
  |
  |-- [new section] Config Inheritance
  |     |-- InheritanceVisualizer (NEW)
  |           |-- ChainNode (one per extends source, connected by arrows)
```

### Component Data Flow

| Component | Reads From | IPC Calls | Store Dependencies |
|-----------|-----------|-----------|-------------------|
| ComplianceProfileSelector | `governanceStore.activePresets`, static registry | `governance:toggle-pack` | `governanceStore` |
| RuleCatalogSection | `governanceStore.activePresets`, static registry | `governance:toggle-pack` | `governanceStore` |
| CoverageBar | `governanceStore.jurisdictionCoverage` | None (derived) | `governanceStore` |
| InheritanceVisualizer | `governanceStore.inheritanceChain` | None (fetched by parent) | `governanceStore` |

---

## 8. File Map

### New Files

| File | Change Type | Owner Agent | Purpose |
|------|------------|-------------|---------|
| `flint-mcp/src/core/rulePackRegistry.ts` | CREATE | `flint-ast-surgeon` | Static rule pack registry constant + helper functions |
| `flint-mcp/src/tools/rulePacks.ts` | CREATE | `flint-ast-surgeon` | 5 MCP tool handler implementations |
| `flint-mcp/src/core/__tests__/rulePackRegistry.test.ts` | CREATE | `flint-test-writer` | Registry unit tests |
| `flint-mcp/src/tools/__tests__/rulePacks.test.ts` | CREATE | `flint-test-writer` | MCP tool handler tests |
| `src/components/ui/RuleCatalogSection.tsx` | CREATE | `flint-design-engineer` | Pack card grid with enable/disable |
| `src/components/ui/ComplianceProfileSelector.tsx` | CREATE | `flint-design-engineer` | Jurisdiction checkbox picker |
| `src/components/ui/InheritanceVisualizer.tsx` | CREATE | `flint-design-engineer` | Extends chain visualization |
| `src/components/ui/CoverageBar.tsx` | CREATE | `flint-design-engineer` | Per-jurisdiction coverage bars |
| `src/components/ui/__tests__/RuleCatalogSection.test.tsx` | CREATE | `flint-test-writer` | Component tests |
| `src/components/ui/__tests__/CoverageBar.test.tsx` | CREATE | `flint-test-writer` | Component tests |
| `src/core/rulePackRegistryClient.ts` | CREATE | `flint-state-architect` | Renderer-side lightweight registry mirror (pack metadata only, no Node.js deps) |

### Modified Files

| File | Change Type | Owner Agent | What Changes |
|------|------------|-------------|-------------|
| `flint-mcp/src/server.ts` | MODIFY | `flint-ast-surgeon` | Add 5 tool definitions to ListToolsRequestSchema handler + 5 case branches to CallToolRequestSchema handler |
| `src/store/governanceStore.ts` | MODIFY | `flint-state-architect` | Add `activePresets`, `inheritanceChain`, `jurisdictionCoverage`, `isLoadingConfig` state + `fetchResolvedConfig`, `togglePack`, `computeCoverage` actions |
| `src/components/ui/GovernancePanel.tsx` | MODIFY | `flint-design-engineer` | Add tab bar (Rules / Rule Packs), integrate RuleCatalogSection + ComplianceProfileSelector |
| `src/components/ui/GovernanceDashboard.tsx` | MODIFY | `flint-design-engineer` | Add CoverageBar section + InheritanceVisualizer section |
| `electron/preload.ts` | MODIFY | `flint-electron-ipc` | Add `governance.getResolvedConfig()` and `governance.togglePack()` to contextBridge surface |
| `electron/main.ts` | MODIFY | `flint-electron-ipc` | Add IPC handlers for `governance:get-resolved-config` and `governance:toggle-pack` |
| `src/types/flint-api.d.ts` | MODIFY | `flint-electron-ipc` | Add `getResolvedConfig` and `togglePack` to GovernanceAPI type |
| `src/core/governanceRulesManifest.ts` | MODIFY | `flint-ast-surgeon` | Add `packId` field to `GovernanceRule` type so rules link back to their pack |

---

## 9. Rule Pack Registry — Initial Contents

The registry ships with these packs in v1:

| Pack ID | Name | Domain | Status | Rule Count | Jurisdictions | Preset |
|---------|------|--------|--------|-----------|--------------|--------|
| `wcag-2.1-aa` | WCAG 2.1 Level AA | accessibility | **active** | 50 | EU/EAA, US/ADA, US/Section508, CA/AODA, UK/EQA | `@flint/general` |
| `mithril-design-system` | Mithril Design System Linter | design-system | **active** | 9 | (universal) | `@flint/general` |
| `brand-rules` | Brand Compliance | brand | available | 20 | (universal) | None (individual rules) |
| `hipaa-phi` | HIPAA PHI Safeguards | privacy | available | 0* | US/HIPAA | `@flint/healthcare` |
| `pci-dss-ui` | PCI-DSS UI Controls | security | coming-soon | 0 | US/PCI-DSS, EU/PSD2 | `@flint/fintech` |
| `gdpr-consent` | GDPR Consent Patterns | privacy | coming-soon | 0 | EU/GDPR, UK/UK-GDPR | `@flint/e-commerce` |
| `section-508` | Section 508 Compliance | accessibility | available | 50** | US/Section508 | `@flint/government` |
| `wcag-2.2-new` | WCAG 2.2 New Criteria | accessibility | coming-soon | 0 | EU/EAA, US/ADA | None |
| `soc2-ui` | SOC 2 UI Patterns | security | coming-soon | 0 | US/SOC2 | `@flint/enterprise-saas` |
| `cognitive-load` | Cognitive Load Reduction | cognitive | coming-soon | 0 | (universal) | None |

\* `hipaa-phi` pack has 0 dedicated rules but activates the `@flint/healthcare` preset which tightens existing rule thresholds (delta_e: 1.5, coercive mode).
\** `section-508` maps to the same 50 WCAG 2.1 AA rules but with `@flint/government` thresholds (WCAG AAA consideration, tighter scoring).

### Mapping existing rules to packs

The 50 A11Y rules (A11Y-001 through A11Y-050) all belong to `wcag-2.1-aa`.
The 9 Mithril rules (MITHRIL-COL, MITHRIL-TYP-001..005, MITHRIL-SPC-001, MITHRIL-SHD-001, MITHRIL-OPC-001) belong to `mithril-design-system`.
The 20 BRAND/QUAL rules (BRAND-TYP-001..004, BRAND-LAY-001..006, BRAND-CMP-001..006, BRAND-CNT-001..005, BRAND-MOT-001..003, QUAL-001..005) belong to `brand-rules`.

---

## 10. Commandment Checklist

| # | Commandment | Applies? | How Satisfied |
|---|------------|----------|---------------|
| 1 | Code is Truth | No | ERM modifies config files, not component source code |
| 2 | No Hallucinated Styling | Yes | All Glass UI classes use Flint design token palette (zinc, indigo, emerald, amber, red) |
| 4 | Local-First Only | Yes | Registry is a bundled static constant. No external URLs. Config read from local filesystem. |
| 6 | Gatekeeper Rule | Yes | `flint_enable_pack` / `flint_disable_pack` updates the config that the export gate reads. Changes propagate to the next audit cycle. |
| 9 | Process Boundary Law | Yes | Glass reads config via IPC only. `flint.config.yaml` read/write happens in Electron main process. No `fs` in `src/`. |
| 12 | Atomic Queuing | Yes | Config writes go through `FileTransactionManager` (`.tmp` -> `rename` pattern). |
| 13 | Deterministic Surgery | N/A | No AST modification. Config is YAML, parsed with the `yaml` npm package. |
| 14 | Bypass Prohibition | Yes | Config writes route through `FileTransactionManager`. No direct `fs.writeFile`. |

---

## 11. Implementation Order

### Phase ERM-1: Registry + MCP Tools (no Glass dependency)

**Parallelism group A — can run simultaneously:**

1. **`flint-ast-surgeon`**: Create `rulePackRegistry.ts` with the static registry constant and helper functions (`getPackById`, `getPacksByDomain`, `getPacksByJurisdiction`, `getActivePacksForConfig`, `computeJurisdictionCoverage`).

2. **`flint-ast-surgeon`**: Create `rulePacks.ts` tool handlers for all 5 MCP tools. Wire into `server.ts` (tool definitions + case branches).

3. **`flint-test-writer`**: Write tests for `rulePackRegistry.ts` (registry shape validation, filter functions, coverage computation) and `rulePacks.ts` (happy path, missing params, pack-not-found, tighten-only enforcement).

**Gate:** All MCP tests pass. `cd flint-mcp && npm test` green.

### Phase ERM-2: IPC + Store (blocks on ERM-1 for types only)

**Parallelism group B — can run simultaneously:**

4. **`flint-electron-ipc`**: Add 2 IPC handlers to `electron/main.ts`:
   - `governance:get-resolved-config` — calls `loadProjectConfig()` + derives inheritance chain
   - `governance:toggle-pack` — reads/writes `flint.config.yaml` via `FileTransactionManager`

   Add corresponding entries to `electron/preload.ts` and `src/types/flint-api.d.ts`.

5. **`flint-state-architect`**: Extend `governanceStore.ts` with new state slices and actions. Create `src/core/rulePackRegistryClient.ts` (renderer-side registry mirror — pure TypeScript, no Node.js imports).

**Gate:** `npx tsc --noEmit` passes. IPC round-trip tested manually or with IPC test.

### Phase ERM-3: Glass UI (blocks on ERM-2)

**Parallelism group C — can run simultaneously:**

6. **`flint-design-engineer`**: Create `RuleCatalogSection.tsx`, `ComplianceProfileSelector.tsx`. Modify `GovernancePanel.tsx` to add tab bar and integrate new sections.

7. **`flint-design-engineer`**: Create `InheritanceVisualizer.tsx`, `CoverageBar.tsx`. Modify `GovernanceDashboard.tsx` to add new sections.

8. **`flint-test-writer`**: Write component tests for all new UI components (render, interaction, loading states, empty states).

**Gate:** `npm run test:react` green. `npx tsc --noEmit` 0 errors.

### Phase ERM-4: Integration Validation

9. **`flint-integration-validator`**: End-to-end validation:
   - MCP tool -> config change -> IPC refresh -> Glass UI update
   - Enable pack -> verify extends[] updated -> verify coverage recalculated
   - Tighten-only enforcement for disable/mode-change
   - All test suites pass, TSC clean

---

## 12. Test Strategy

### MCP Layer (flint-mcp)

| Test | What | Location |
|------|------|----------|
| Registry shape | Every pack has required fields, rule counts match | `rulePackRegistry.test.ts` |
| Registry filters | `getPacksByDomain`, `getPacksByJurisdiction` return correct subsets | `rulePackRegistry.test.ts` |
| Coverage computation | `computeJurisdictionCoverage` with varying active packs | `rulePackRegistry.test.ts` |
| `flint_list_rule_packs` | Returns all packs, filters by domain/status/jurisdiction | `rulePacks.test.ts` |
| `flint_enable_pack` | Adds preset to extends, returns rule count. Handles already-enabled. | `rulePacks.test.ts` |
| `flint_enable_pack` dry_run | Returns changes without writing | `rulePacks.test.ts` |
| `flint_disable_pack` | Removes preset from extends. Handles not-enabled. | `rulePacks.test.ts` |
| `flint_set_rule_mode` | Changes mode, records justification, rejects tighten-only violations | `rulePacks.test.ts` |
| `flint_compliance_coverage` | Returns correct percentages, recommendations for gaps | `rulePacks.test.ts` |
| Pack not found | All tools return clear error for unknown pack_id | `rulePacks.test.ts` |
| Coming-soon pack enable | Returns error explaining pack is not yet available | `rulePacks.test.ts` |

### Glass Layer (src)

| Test | What | Location |
|------|------|----------|
| RuleCatalogSection render | Renders pack cards, shows correct status badges | `RuleCatalogSection.test.tsx` |
| RuleCatalogSection toggle | Enable/disable callbacks fire with correct packId | `RuleCatalogSection.test.tsx` |
| ComplianceProfileSelector | Renders checkboxes, toggle fires callback | `ComplianceProfileSelector.test.tsx` (inline) |
| CoverageBar | Renders progress bars, handles 0% and 100% | `CoverageBar.test.tsx` |
| InheritanceVisualizer | Renders chain nodes in order, highlights project config | `InheritanceVisualizer.test.tsx` (inline) |
| governanceStore extensions | `fetchResolvedConfig` populates state, `togglePack` updates state | `governanceStore.test.ts` |

### Integration

| Test | What |
|------|------|
| Pack toggle round-trip | Enable pack -> config written -> re-read -> UI reflects new state |
| Tighten-only guard | Attempt to disable coercive pack when tighten_only:true -> blocked |
| Coverage recalc | Enable pack with new jurisdictions -> coverage percentages update |

---

## 13. Risks

| Risk | Severity | Commandment Threatened | Mitigation |
|------|----------|----------------------|------------|
| Config write race condition | Medium | Cmd 12 (Atomic Queuing) | All writes go through `FileTransactionManager` which serializes `.tmp` -> `rename` atomically |
| Registry drift from actual rules | Low | None | Registry is a static constant co-located with linter modules. Tests validate rule counts match `GOVERNANCE_RULES_MANIFEST`. |
| Glass reads stale config after toggle | Medium | None | IPC handler broadcasts `governance:config-changed` event after write. Store listens and re-fetches. |
| `flint.config.yaml` doesn't exist yet | Low | None | `governance:toggle-pack` handler creates the file with `project: <dirname>` + `extends: [preset]` if missing. Falls back to existing `loadYamlConfig` -> `null` -> create flow. |
| Renderer-side registry mirror diverges from MCP-side | Low | Cmd 4 (Local-First) | The renderer mirror is a build-time import from a shared location (`shared/rulePackRegistryData.ts`) or a simplified copy. Tests validate both match. |
| Pack disable breaks tighten_only invariant of downstream projects | Medium | UCFG.2 | `flint_disable_pack` warns about coverage reduction. The tighten_only check is in the config loader, not in this feature — it's already enforced. |

---

## 14. Decision Log

1. **No new Zustand store.** The `governanceStore` already owns rule overrides and governance state. Adding 4 state fields is cleaner than creating a new store.

2. **Static TypeScript registry, not SQLite.** Rule pack metadata is static, small (< 50 KB), and read-only. A database would add complexity for no benefit. The registry is a `const` array exported from a TypeScript file.

3. **Renderer-side registry mirror.** The renderer needs pack metadata for instant UI rendering without an IPC round-trip. This is a lightweight copy (names, IDs, jurisdictions, statuses) — not the full rule definitions.

4. **Tab bar in GovernancePanel, not a new tab in right sidebar.** The right sidebar already has 7 tabs (Properties, Tokens, Activity, Health, Agents, Scope, Recovery). Adding another would overcrowd it. Instead, the GovernancePanel (full-screen modal) gets a "Rule Packs" tab alongside the existing "Rules" tab.

5. **Coverage and Inheritance in Health tab.** The GovernanceDashboard already shows health score, penalties, and violations. Coverage and inheritance are natural extensions of this health view.

6. **Config modification via IPC, not via MCP callTool.** While Glass can call MCP tools via `window.flintAPI.mcp.callTool()`, modifying `flint.config.yaml` is a filesystem operation that must go through the main process. The MCP tools operate on the same config file but are invoked by IDE agents (Claude Code, Cursor), not by Glass. Glass uses dedicated IPC for its UI interactions.

7. **`flint_set_rule_mode` uses existing override infrastructure.** Individual rule mode changes are persisted via the existing `saveRuleOverrides` + `governanceStore.overrides` mechanism. They do NOT modify `flint.config.yaml` directly. This avoids config file churn for granular rule tweaks and keeps the YAML clean for pack-level decisions.
