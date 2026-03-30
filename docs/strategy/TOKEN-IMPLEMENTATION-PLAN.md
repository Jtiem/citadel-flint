# Token Experience Implementation Plan — "The Mint"

**Date:** 2026-03-29
**Status:** PROPOSED
**Depends on:** TOKEN-EXPERIENCE-STRATEGY.md
**Citadel Name:** Mint

---

## Overview

This plan transforms the Tokens tab from a flat CRUD list into a governance-aware observability surface. Work is organized into 4 sprints, ordered by impact and infrastructure dependency. Each sprint ships a usable increment.

---

## Sprint MINT.1 — Foundation (Wire Existing Data)

**Goal:** Surface data that already exists in SQLite but Glass never shows. No new computation — just IPC handlers and UI.

**Estimated scope:** 5 new IPC handlers, 1 new component, ~400 lines backend + UI

### MINT.1a — Token Health Bar

**What:** A persistent summary bar at the top of the Tokens tab showing key metrics.

**Displays:**
- Token count (by type: color, dimension, typography, other)
- Last sync timestamp (from `sync_history` table)
- Figma connection status (from existing `figma-connection` IPC)

**Infrastructure:**
- New IPC: `tokens:get-sync-summary` — reads latest `sync_history` row + `token_source` count
- UI: `<TokenHealthBar />` component, always visible at top of Tokens tab

**Files to touch:**
- `electron/main.ts` — add `tokens:get-sync-summary` handler
- `electron/preload.ts` — expose in `window.flintAPI.tokens`
- `src/components/ui/TokenManager.tsx` — add health bar (or begin `TokenPanel.tsx`)

### MINT.1b — Visual Token Grid

**What:** Replace flat list with type-specific visual rendering.

**Renders:**
- Colors: swatch grid (4-6 per row) with token name below
- Typography: specimen text rendered in the actual font/size/weight
- Spacing: horizontal ruler with proportional markers
- Other types: enhanced list rows with type badges

**Infrastructure:** None — all data already in `tokenStore.tokens`. Pure UI work.

**Files to touch:**
- `src/components/ui/TokenPanel.tsx` (new, replaces TokenManager)
- `src/components/ui/token/ColorGrid.tsx` (new)
- `src/components/ui/token/TypographySpecimen.tsx` (new)
- `src/components/ui/token/SpacingRuler.tsx` (new)

### MINT.1c — Mode Columns

**What:** Display Light/Dark (and any other modes) side-by-side for the same token path.

**Renders:** Tokens grouped by `token_path`, with mode values in columns. Color tokens show swatches per mode. Typography shows specimens per mode.

**Infrastructure:** None — `mode` field already exists on every token. Group by `token_path`, spread modes horizontally.

**Files to touch:**
- `src/components/ui/TokenPanel.tsx` — grouping logic
- `src/components/ui/token/ModeColumns.tsx` (new)

### MINT.1d — Remove Dangerous Actions

**What:** Remove inline editing, delete buttons, and "Clear All" from Glass.

**Replace with:**
- Read-only token display (values shown but not editable)
- "Connect Figma" as primary empty-state CTA
- "Import JSON" demoted to secondary text link
- Token modifications route through MCP tools (future sprint)

**Files to touch:**
- `src/components/ui/TokenPanel.tsx` — remove edit/delete/clearAll interactions

### MINT.1e — Fix TokenManager A11y Issues

**What:** Fix the 8 accessibility issues found in the current TokenManager.

**Fixes:**
1. Add `aria-label="Search tokens"` to search input
2. Add `aria-label="Clear search"` to clear button
3. Make delete button visible on focus (not just hover)
4. Add `role="img" aria-label={token.token_value}` to color swatches
5. Add accessible text fallback for dimension bars
6. Add `htmlFor` to import modal labels
7. Add `aria-label` to modal close button
8. Use `<h3>` for collection headers instead of `<div>`

**Files to touch:**
- `src/components/ui/TokenPanel.tsx` (carried forward from TokenManager)

---

## Sprint MINT.2 — Code Truth (Flint's Moat)

**Goal:** Surface the data only Flint can show — usage counts, dead tokens, drift indicators. This is the competitive differentiator.

**Estimated scope:** 1 new service (~150 lines), 2 new IPC handlers, UI enhancements

### MINT.2a — Token Usage Scanner

**What:** A service that scans workspace ASTs and returns per-token usage counts.

**How it works:**
1. Iterate workspace files (same file set as Mithril audit)
2. For each file, parse with Babel (reuse existing AST infrastructure)
3. For each className string, check against `tokenToClass` mappings
4. Build a `Map<tokenPath, { count: number, files: string[] }>`
5. Cache result, update incrementally on file save events

**Infrastructure:**
- New service: `electron/tokenUsageScanner.ts` (~150 lines)
- New IPC: `tokens:usage-scan` — triggers scan, returns per-token usage map
- Incremental update: hook into existing `file-saved` events

**Files to touch:**
- `electron/tokenUsageScanner.ts` (new)
- `electron/main.ts` — add IPC handler
- `electron/preload.ts` — expose in API surface

### MINT.2b — Usage Counts in UI

**What:** Each token row/card shows usage count badge. Zero-usage tokens get "Orphan" indicator.

**Renders:**
- "14 uses" badge on token cards
- "Not used" badge with subtle warning style for orphans
- Hover tooltip on orphans: "This token exists in your system but isn't referenced in any component"

**Files to touch:**
- `src/components/ui/TokenPanel.tsx`
- `src/components/ui/token/UsageBadge.tsx` (new)

### MINT.2c — Drift Indicators

**What:** Per-token sync status with visual comparison when drifted.

**Renders:**
- Green checkmark: in sync with Figma
- Amber badge with ΔE: drifted (shows Figma value vs. local value as side-by-side swatches)
- Gray dash: no Figma link (local-only token)
- "Accept Figma Value" button on drifted tokens (triggers MCP `flint_sync_pull` for single token)

**Infrastructure:**
- IPC `tokens:get-sync-state` from MINT.1a provides the data
- `TokenSyncEngine.computeDiff()` already computes per-token diffs

**Files to touch:**
- `src/components/ui/token/DriftBadge.tsx` (new)
- `src/components/ui/TokenPanel.tsx`

### MINT.2d — Silent Drift Badge on Tab

**What:** The Tokens tab label shows a drift count badge, updated via MCP push channel.

**Triggers:** `useMCPEventListener` picks up sync events from `mcp-events.jsonl`.

**Renders:** Small numeric badge on "Tokens" tab: "3" (meaning 3 drifted tokens).

**Files to touch:**
- `src/App.tsx` or tab container — badge rendering
- Hook into existing `useMCPEventListener`

---

## Sprint MINT.3 — Accessibility + Approval

**Goal:** Close the Warden blind spot with token-level a11y auditing. Add the staging area for token approval flow.

**Estimated scope:** 1 new service (~200 lines), 1 new IPC handler, 2 new UI components

### MINT.3a — Token Contrast Auditor

**What:** A service that computes WCAG contrast ratios for semantically meaningful token pairs.

**How it works:**
1. Group color tokens by semantic role (text.*, surface.*, border.*, focus.*, interactive.*, status.*)
2. For each (foreground, background) pair, compute `wcagContrastRatio`
3. Flag pairs below 4.5:1 (normal text) or 3:1 (non-text elements)
4. Run across all modes — flag cross-mode failures separately
5. Return structured results: `{ pair: [tokenA, tokenB], ratio: number, mode: string, passes: boolean }`

**Infrastructure:**
- New service: `flint-mcp/src/core/tokenA11yAuditor.ts` (~200 lines)
- Reuses `wcagContrastRatio` from `contrast-utils.ts`
- New MCP tool: `flint_token_a11y` (or extend `flint_accessibility_report`)
- New IPC: `tokens:contrast-matrix` — returns pairing results for Glass

**Files to touch:**
- `flint-mcp/src/core/tokenA11yAuditor.ts` (new)
- `flint-mcp/src/server.ts` — register tool/resource
- `electron/main.ts` — IPC handler
- `electron/preload.ts` — expose

### MINT.3b — Contrast Badges in UI

**What:** Color token cards show contrast pairing status inline.

**Renders:**
- Small ratio badge on color tokens (e.g., "4.5:1" or "3.1:1 [!]")
- Click to expand: full pairing list with pass/fail indicators
- Cross-mode indicator: "Passes Light, Fails Dark" with mode-specific ratios

**Files to touch:**
- `src/components/ui/token/ContrastBadge.tsx` (new)
- `src/components/ui/TokenPanel.tsx`

### MINT.3c — Token Approval Staging Area

**What:** When `flint_extract_tokens` or `flint_pull_variables` returns proposed tokens, show them in a staging area within the Tokens tab.

**Flow:**
1. MCP push channel delivers extraction results
2. Staging area appears at top of Tokens tab with proposed tokens
3. Each proposed token shows: swatch/preview, token path, value, conflict indicator
4. Conflict indicator runs Mithril in-memory: if ΔE > 2.0 against existing token, shows warning
5. Per-token: Accept / Reject. Batch: "Approve All Clean" (skips conflicted)
6. Approved tokens route through `flint_approve_tokens` MCP tool (provenance recorded)

**Infrastructure:**
- New store slice: `tokenStore.pendingTokens` (staging state)
- MCP push channel integration (existing `useMCPEventListener`)
- MCP call via `mcpClient.ts` for approval

**Files to touch:**
- `src/store/tokenStore.ts` — add `pendingTokens` slice
- `src/components/ui/token/StagingArea.tsx` (new)
- `src/components/ui/TokenPanel.tsx`

### MINT.3d — Additional A11y Token Insights

**What:** Surface non-contrast accessibility insights on tokens.

**Insights to add:**
- Missing reduced-motion variants (animation/transition tokens without motion-safe mode)
- Type scale warnings (font-size < 12px)
- Line-height compliance (< 1.5x companion font-size)
- Mode completeness warnings (token in Light but missing in Dark)
- Touch target sizing (dimension tokens for interactive elements < 44px)

**Files to touch:**
- `flint-mcp/src/core/tokenA11yAuditor.ts` — extend with non-contrast checks
- `src/components/ui/token/A11yInsight.tsx` (new)

---

## Sprint MINT.4 — Brilliant Moments

**Goal:** Add the proactive, predictive interactions that make the experience feel intelligent.

**Estimated scope:** UI enhancements + integration wiring, minimal new backend

### MINT.4a — First-Sync Prompt

**What:** When Figma is connected and tokens are empty/stale, prompt extraction automatically.

**Trigger logic:**
- `figmaConnectionStatus === 'connected'`
- AND (`tokenCount === 0` OR `lastSyncedAt < figmaLastModified`)

**Renders:** Single card in empty Tokens tab: "Your Figma file has variables. Import them now?" One-click triggers extraction → staging area (MINT.3c).

**Files to touch:**
- `src/components/ui/TokenPanel.tsx` — conditional rendering
- Reuses existing Figma connection status from `canvasStore`

### MINT.4b — Pre-Export Emission Check

**What:** Export Gate includes token emission freshness check.

**How:**
1. When ExportModal opens, check if any tokens modified since last emission
2. If yes, add a line: "N tokens changed since last emission. Emit now?" with checkbox
3. If checked, `flint_emit_tokens` runs atomically as part of export

**Infrastructure:**
- Track `lastEmittedAt` timestamp (new field in token metadata or a simple `.flint/last-emission.json`)
- Compare against `updated_at` on modified tokens

**Files to touch:**
- `src/components/ui/ExportModal.tsx` — add emission check section
- `electron/main.ts` — add `tokens:emission-freshness` IPC
- `electron/preload.ts` — expose

### MINT.4c — Scale Gap Analysis

**What:** Analyze numeric token scales (spacing, sizing, border-radius) for missing steps.

**How:**
1. Sort dimension tokens by numeric value
2. Detect interval pattern (linear or geometric)
3. Flag gaps that break the pattern (e.g., 4, 8, 16, 32 — missing 12 or 24 depending on scale type)

**Renders:** Warning badge on spacing ruler: "[!] Gap: no 24px step"

**Files to touch:**
- `src/components/ui/token/SpacingRuler.tsx` — add gap detection
- Pure client-side computation, no IPC needed

### MINT.4d — Per-Token Detail View

**What:** Clicking a token opens a detail view with usage, contrast, drift, and provenance.

**Sections:**
1. Value + mode columns + visual preview
2. Usage: file list with reference counts (from MINT.2a)
3. Contrast pairings: relevant pairs with ratios (from MINT.3a)
4. Drift status: Figma vs. local comparison (from MINT.2c)
5. Provenance: creation source, modification history (from governance events)

**Infrastructure:**
- New IPC: `tokens:get-provenance` — reads `governance_events` for a specific token path
- All other data already available from previous sprints

**Files to touch:**
- `src/components/ui/token/TokenDetail.tsx` (new)
- `electron/main.ts` — add provenance IPC
- `electron/preload.ts` — expose

### MINT.4e — Alias Chain Preservation

**What:** Preserve DTCG `$value` references during import so alias chains are visible.

**How:**
1. Modify `flattenDTCG` in tokenStore to record original `$value` reference before resolving
2. Add `alias_source` column to `design_tokens` table (nullable)
3. Display alias chain in token detail view: "Resolves from: `{color.brand.primary}`"

**Infrastructure:**
- SQLite migration: add `alias_source TEXT` column
- Modify `flattenDTCG` to preserve reference info

**Files to touch:**
- `src/store/tokenStore.ts` — modify `flattenDTCG`
- `electron/main.ts` — migration + update IPC handlers
- `src/components/ui/token/TokenDetail.tsx` — alias display

---

## Sprint Dependency Graph

```
MINT.1a (Health Bar)  ----+
MINT.1b (Visual Grid) ----+---> MINT.2b (Usage in UI) ---> MINT.4d (Detail View)
MINT.1c (Mode Columns) ---+         ^
MINT.1d (Remove Edits) ---+         |
MINT.1e (A11y Fixes) -----+    MINT.2a (Usage Scanner)
                                    |
                               MINT.2c (Drift Indicators)
                                    |
                               MINT.2d (Silent Badge)
                                    |
MINT.3a (Contrast Auditor) --------> MINT.3b (Contrast UI)
                                    |
MINT.3c (Staging Area) -----------> MINT.4a (First-Sync Prompt)
                                    |
MINT.3d (A11y Insights) ----------> MINT.4d (Detail View)
                                    |
                               MINT.4b (Export Emission)
                               MINT.4c (Scale Gaps)
                               MINT.4e (Alias Chains)
```

---

## Agent Assignments

| Task | Primary Agent | Why |
|------|--------------|-----|
| MINT.1a | flint-electron-ipc | New IPC handlers |
| MINT.1b | flint-design-engineer | Pure UI, visual design |
| MINT.1c | flint-design-engineer | UI layout |
| MINT.1d | flint-design-engineer | UI simplification |
| MINT.1e | flint-accessibility | A11y fixes |
| MINT.2a | flint-architect (contract) + coder (impl) | New service, needs contract |
| MINT.2b | flint-design-engineer | UI badges |
| MINT.2c | flint-design-engineer | UI with IPC data |
| MINT.2d | flint-design-engineer | Tab badge integration |
| MINT.3a | flint-mcp-specialist | MCP engine service |
| MINT.3b | flint-design-engineer | UI component |
| MINT.3c | flint-design-engineer + flint-state-architect | New store slice + UI |
| MINT.3d | flint-accessibility + flint-mcp-specialist | A11y rules + MCP |
| MINT.4a | flint-design-engineer | Conditional UI |
| MINT.4b | flint-design-engineer + flint-electron-ipc | ExportModal + IPC |
| MINT.4c | flint-design-engineer | Client-side computation |
| MINT.4d | flint-design-engineer | Detail view assembly |
| MINT.4e | flint-database + flint-state-architect | Schema migration + store |

---

## Testing Requirements

Every task follows the Flint Testing Standard:

| Domain | Test Type | Location |
|--------|-----------|----------|
| New IPC handlers | Request/response shape + error cases | `electron/*.test.ts` |
| Token usage scanner | Correct counts + empty project + large project | `electron/__tests__/tokenUsageScanner.test.ts` |
| Token contrast auditor | Known pass/fail pairs + cross-mode + edge cases | `flint-mcp/src/core/__tests__/tokenA11yAuditor.test.ts` |
| TokenPanel component | Renders all views + empty state + staging + interactions | `src/components/ui/__tests__/TokenPanel.test.tsx` |
| Store changes | State transitions + pendingTokens lifecycle | `src/store/__tests__/tokenStore.test.ts` |
| Staging area | Approve/reject flow + conflict detection + batch approve | `src/components/ui/token/__tests__/StagingArea.test.tsx` |

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Token tab shows usage data | No | Yes | Usage counts visible on every token |
| Token-level a11y insights | 0 | Contrast + 5 insight types | Token contrast auditor active |
| Figma sync visible in Glass | No | Yes | Drift badges + sync timestamp |
| Staging area for approval | No | Yes | Extracted tokens reviewable before acceptance |
| Dangerous edits removed | 3 (edit, delete, clear) | 0 | No direct mutation from Glass |
| A11y issues in token UI | 8 | 0 | All 8 issues from audit fixed |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Token usage scan is slow on large projects | Poor UX on tab open | Cache results, update incrementally on file save |
| Contrast matrix is O(n^2) for large token sets | Computation lag | Limit to semantic pairs (text.* vs surface.*), not all-vs-all |
| Removing inline edit frustrates power users | Workflow friction | Provide clear path to MCP tool for modifications |
| Alias chain preservation requires migration | Schema change risk | Make `alias_source` nullable, no breaking change |
| Staging area + MCP push channel timing | Race condition | Debounce staging updates, show loading state |
