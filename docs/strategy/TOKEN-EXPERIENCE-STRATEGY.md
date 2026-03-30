# Token Experience Strategy — "The Mint"

**Date:** 2026-03-29
**Status:** PROPOSED
**Author:** 5-agent synthesis (UX Critic, Product Planner, Accessibility Analyst, Competitive Researcher, Architect)
**Citadel Name:** **Mint** — where tokens are forged, verified, and certified for circulation

---

## Executive Summary

The Tokens tab in Flint Glass is a CRUD list sitting on top of a data lake. The backend has sync state, drift distances, coverage metrics, contrast math, provenance events, DBOM compliance, and a three-way diff engine. Glass shows a flat list with search and inline edit. Roughly 80% of what a rich token experience needs already exists in the infrastructure — it just isn't surfaced.

This document captures the complete findings from five specialist analyses and defines the vision for making Flint's token experience brilliant.

---

## Table of Contents

1. [The Diagnosis](#1-the-diagnosis)
2. [User Needs by Persona](#2-user-needs-by-persona)
3. [Current State Audit](#3-current-state-audit)
4. [Competitive Landscape](#4-competitive-landscape)
5. [Accessibility Blind Spots](#5-accessibility-blind-spots)
6. [Infrastructure Reality](#6-infrastructure-reality)
7. [The Vision: Mint](#7-the-vision-mint)
8. [Five Brilliant Moments](#8-five-brilliant-moments)
9. [What to Remove](#9-what-to-remove)
10. [Table Stakes vs. Differentiators](#10-table-stakes-vs-differentiators)
11. [Token Lifecycle Map](#11-token-lifecycle-map)
12. [Feature Budget Gate Analysis](#12-feature-budget-gate-analysis)
13. [Open Questions](#13-open-questions)

---

## 1. The Diagnosis

### The Core Problem

The TokenManager is a **token inventory tool** when it should be a **governance observability surface**. It lets you browse and edit tokens, but completely misses the question designers actually have: "Are my tokens being used correctly in my components?"

Tokens in Flint are not a design artifact to manage — they are the **standard that Mithril validates against**. The current TokenManager treats them like a database admin panel. It should treat them like a compliance dashboard.

### Three Structural Issues

**1. Editing tokens in Glass violates the architecture.**
Glass is the observability layer. Inline editing lets a designer change a token value directly, which silently changes what Mithril validates against. No provenance trail (Stamp doesn't record it), no impact analysis, no approval flow. A designer changing `brand.primary` from `#0066FF` to `#0077FF` has just changed the governance rules for the entire project with zero confirmation.

**2. Destructive actions with no safety net.**
Delete and "Clear All" remove governance standards. "Clear All" wipes the entire design system reference — if clicked, Mithril has nothing to validate against, and every component silently passes because there are no tokens to drift from. This is the opposite of governance.

**3. No connection between tokens and their usage.**
The TokenManager shows `color.brand.primary = #0066FF` but never answers: How many components use this token? Which components are drifting? What happens if I change it?

---

## 2. User Needs by Persona

### Designer (Glass User)

| Need | Current State | Gap |
|------|--------------|-----|
| See my palette at a glance | Flat list grouped by collection | No visual grid, no swatch board, no "see all colors together" |
| Know if tokens match Figma | Nothing — sync is backend-only | No drift indicators, no "last synced" timestamp, no pull/push buttons |
| Create a token from what I see | Nothing | No "promote this value to a token" flow |
| Understand token coverage | Nothing | No "X% of your components use tokens" metric |
| Preview a token change before committing | Inline edit changes immediately | No preview of downstream impact ("12 components use this token") |
| Approve extracted tokens visually | Chat-only via MCP | No staging area, no swatch preview, no per-token accept/reject |
| See accessibility implications | Nothing | No contrast pairing info on color tokens |

### Developer (VS Code / CI User)

| Need | Current State | Gap |
|------|--------------|-----|
| Emit tokens to my platform | MCP tool exists, no Glass UI | Can't trigger emission from Glass |
| Map tokens to my component library | MCP tool exists, no Glass UI | shadcn/MUI/PrimeNG mapping invisible |
| Validate token schema | No validation (S1.9 audit finding) | Invalid values silently poison pipeline |
| See token usage in code | Nothing | No reverse lookup from token to components |
| Token autocomplete in editor | Nothing | OPP-15 from journey maps, belongs in flint-vscode |

### Governance / Audit Persona

| Need | Current State | Gap |
|------|--------------|-----|
| Token drift from source of truth | Mithril catches component-level drift | No token-level drift dashboard |
| Orphaned tokens | SYNC-002 violation type exists | No UI to surface orphaned tokens |
| Token provenance | Governance events recorded in DB | No UI showing who created a token, when, from where |
| Coverage gaps | Nothing | No "these components have NO token coverage" view |
| Cross-mode compliance | Nothing | No Light/Dark contrast parity validation |

---

## 3. Current State Audit

### What Works

- Collection-by-type grouping is logical and scannable
- Color swatches and dimension bars give quick visual recognition
- Search is well-implemented for large token sets
- Empty state with import CTA follows progressive disclosure correctly
- PropertiesPanel integration (ClassBuilder + DriftDetector + MithrilViolationCard) is genuinely strong — this is where tokens come alive in context
- Progressive disclosure: tokens tab unlocks when `tokenCount > 0` with onboarding tooltip

### What's Broken

| Issue | Severity | Source |
|-------|----------|--------|
| Inline token editing has no provenance trail | Critical | UX Critic |
| "Clear All" can wipe governance baseline | Critical | UX Critic |
| Import JSON is developer workflow exposed to designers | High | UX Critic, Product Planner |
| No connection between tokens and component usage | High | All five analysts |
| Zero Figma sync visibility in Glass | High | Product Planner, Architect |
| Token value validation missing (S1.9) | High | Glass UX Audit |
| "Connect Figma" button opens wrong tab (S1.10) | Medium | Glass UX Audit |
| Search input has no `aria-label` | Medium | Accessibility Analyst |
| Delete button invisible on keyboard focus | Medium | Accessibility Analyst |
| Color swatches have no accessible equivalent | Medium | Accessibility Analyst |
| Import modal inputs lack programmatic labels | Medium | Accessibility Analyst |
| Collection headers use `<div>` not `<h3>` | Low | Accessibility Analyst |

### Accessibility Issues in Current TokenManager UI

1. **Search input** — no `aria-label`, placeholder is insufficient
2. **Clear-search button** — `title` only, no `aria-label`
3. **Delete row button** — `opacity-0` on keyboard focus, invisible to keyboard users
4. **Color swatches** — no `aria-label`, no `role="img"`, screen reader skips them
5. **Dimension bars** — purely visual, no accessible fallback
6. **Import modal** — `<label>` elements lack `htmlFor`, inputs not programmatically associated
7. **Modal close button** — icon-only, no accessible name
8. **Collection headers** — `<div>` with no semantic role, can't navigate by heading

---

## 4. Competitive Landscape

### Feature Comparison Matrix

| Feature | Figma Variables | Tokens Studio | Style Dictionary | Supernova | Specify | Flint Today |
|---------|----------------|---------------|-----------------|-----------|---------|-------------|
| Visual previews per type | Color circles, numbers | Swatches + typed | None (CLI) | Rich previews | Minimal | Flat list |
| Alias/reference display | Resolved value badge | Token Flow graph | JSON references | Visual chains | Tracking | None |
| Multi-mode/theme | Mode columns (up to 40) | Theme Groups + stacking | Platform configs | Theme views | Multi-brand | Single mode display |
| Grouping/hierarchy | Collections > Groups | Token Sets as JSON | Folder-based | Custom groups | Collections | Flat grouping |
| Search/filter | Name, value, group, type | Set-level filtering | N/A | Full-text | API-based | Name only |
| Scoping | Property-level checkboxes | N/A | N/A | N/A | N/A | N/A |
| Sync/distribution | Library publish | Git sync | CLI pipeline | Auto-sync + export | Auto PR creation | Envoy (backend) |
| Predictive features | Auto-suggest scoped | Graph Engine (algorithmic) | Transform chains | AI portal (2025) | 50+ type detection | Mithril drift |
| **Code awareness** | None | None | Output only | Snippets | Conversion | **AST-level** |

### Table Stakes (Everyone Has These)

- Visual swatches per token type (color circles, spacing rulers, type specimens)
- Grouped tree view (collection > group > token)
- Search and filter by name, value, and type
- Mode columns (Light | Dark side-by-side)
- Alias/reference badges showing resolution chain

### Flint's Exclusive Moat

No competitor has AST-level code awareness. None can show:
- **Usage counts** from real code analysis (which components reference this token)
- **Dead token detection** (defined but never used in any component)
- **Drift indicators** with perceptual distance (ΔE between token and actual code value)
- **Impact preview** before token changes (how many files affected)
- **Auto-fix integration** (snap hardcoded values to tokens via Mithril)

This is Flint's differentiator. The token panel should lean into code truth, not compete on token authoring (where Tokens Studio and Figma are stronger).

### What to Adopt

| Pattern | Source | Priority |
|---------|--------|----------|
| Mode columns side-by-side | Figma Variables | High — users expect this |
| Alias badges (resolved value on hover) | Figma Variables | Medium |
| Swatch grid for colors | All competitors | High — table stakes |
| Typography specimens | Supernova, Tokens Studio | Medium |
| Spacing ruler visualization | Tokens Studio | Medium |

### What to Skip

| Pattern | Source | Why Skip |
|---------|--------|----------|
| Token Flow graph (alias visualization) | Tokens Studio | Sprint 8+ if needed — aliases are secondary to usage |
| Graph Engine (algorithmic generation) | Tokens Studio | Flint is governance, not token authoring |
| Property scoping checkboxes | Figma | Mithril lint rules already catch misuse at a stronger level |
| Full token creation/editing UI | All | Glass is observability — authoring belongs upstream |

---

## 5. Accessibility Blind Spots

### The Core Gap: Warden Can't See Tokens

Warden's contrast rules (A11Y-060, -061, -062) only activate when colors are hardcoded hex strings in JSX (e.g., `className="text-[#ccc] bg-[#fff]"`). When components use design tokens via Tailwind classes or CSS variables, the contrast rules return null. The code explicitly states: "Risk R1: skip if either color is not resolvable."

In practice, AI-generated components will almost always use tokens or named Tailwind classes. **The contrast rules have very limited activation surface in real production code.**

### Token-Level A11y Insights Flint Should Surface

| Insight | What It Checks | Severity |
|---------|---------------|----------|
| **Contrast pairing failures** | text token vs. surface token, computed `wcagContrastRatio` | Critical |
| **Focus ring contrast** | focus ring token vs. surface tokens (WCAG 1.4.11, 3:1 minimum) | Critical |
| **Missing reduced-motion variant** | animation/transition tokens without `@reduced-motion` mode | High |
| **Color-only status tokens** | `color.status.error` exists without companion `icon.status.error` | High |
| **Cross-mode contrast parity** | Token pair passes AA in Light but fails in Dark mode | High |
| **Type scale below minimum** | `font-size` token < 12px | Medium |
| **Line-height too tight** | `line-height` token < 1.5x companion `font-size` (WCAG 1.4.12) | Medium |
| **Missing mode completeness** | Token defined in Light but absent in Dark (fallback risk) | Medium |
| **Touch target sizing** | Dimension tokens for interactive targets < 44px (WCAG 2.5.5) | Low |

### Contrast Pairing Matrix

The token panel should include a contrast matrix checking semantically meaningful pairings:

| Foreground Tokens | Background Tokens | Threshold |
|-------------------|-------------------|-----------|
| `color.text.*` | `color.surface.*`, `color.background.*` | 4.5:1 (normal text), 3:1 (large text) |
| `color.interactive.*` | `color.surface.*` | 3:1 (WCAG 1.4.11 non-text contrast) |
| `color.border.input` | `color.surface.form-field` | 3:1 |
| `color.focus.ring` | Every surface it can appear on | 3:1 |
| `color.status.*` | `color.surface.*` where status appears | 4.5:1 |
| `color.text.placeholder` | `color.surface.input` | 4.5:1 (technically applies) |

**Disabled state tokens** are exempt from contrast requirements per WCAG — surface the exemption so designers aren't confused.

### Cross-Mode Validation Requirements

1. **Mode completeness** — every token with any mode variant must have all mode variants
2. **Cross-mode contrast equivalence** — pairs passing AA in Light must also pass in Dark
3. **High-contrast mode gap warning** — flag when system has enough color tokens to warrant a high-contrast variant but none exists
4. **Dark-mode focus ring** — focus rings need 3:1 against surfaces in every mode

### Implementation Note

The `wcagContrastRatio` function already exists in `contrast-utils.ts` and is correct. The token store holds all resolved color values. The gap is purely in the data pipeline: nobody connects tokens to the contrast audit. A new `auditTokens(tokens: DesignToken[])` method on A11yLinter (or a standalone `TokenA11yAuditor`) would close this.

---

## 6. Infrastructure Reality

### Data That Exists but Glass Doesn't Show

| Data | Where It Lives | New Code Needed |
|------|----------------|-----------------|
| CIEDE2000 drift distance per color token | `MithrilLinter.findClosestToken()` | None — just surface it |
| Token coverage by type | `MithrilLinter.buildTokenCoverage()` | Cache last audit result |
| Sync baseline state (last synced value, Figma ID, hash) | `token_source` SQLite table | 1 IPC handler (~30 lines) |
| Sync diff status (7 categories) | `TokenSyncEngine.computeDiff()` | 1 IPC handler |
| Sync history (pull/push records) | `sync_history` SQLite table | 1 IPC handler (~20 lines) |
| SYNC-001/002 violations per token | `syncViolationChecker` | Already in audit output |
| DBOM compliance per token | `dbomService.ts` | 1 IPC handler (~40 lines) |
| Figma variable ID linkage | `token_source` table | Included in sync state IPC |
| Token extraction proposals (confidence, ΔE) | `figmaTokenExtractor` | Need staging UI only |
| Governance events for tokens | `governance_events` table | 1 IPC handler |
| Platform emission status | `.flint/platform-tokens/` directory | Lightweight file check |

### Cross-References That Are Possible

| Cross-Reference | How to Compute | Infra Exists? |
|----------------|---------------|---------------|
| Token → components that use it | Invert Mithril audit results (every `suggestedToken` points back) | Partial — audit exists, index by token is new |
| Token → violations it could fix | `canvasStore.mithrilViolations` with `suggestedFix` | Data exists, needs `Map` inversion |
| Token → Figma variable | `token_source.figma_variable_id` | Fully exists, zero Glass exposure |
| Token → platform outputs | Check `.flint/platform-tokens/` file existence | Would need lightweight IPC |
| Token alias chains | Parse DTCG `$value` references at import time | `flattenDTCG` currently discards alias info |

### Computed Insights We Could Derive

| Insight | Computation | New Infra? |
|---------|------------|-----------|
| Token coverage % | (tokens used / total tokens) via AST scan | New service (~150 lines) |
| Orphan detection | Tokens with zero usage references | Same scan, complement set |
| Unused-in-Figma tokens | Tokens with no `token_source` row | Simple SQL join, trivial |
| Alias chain depth | Parse `$value` references before flattening | Modify `flattenDTCG` to preserve refs |
| Scale gap analysis | Sort dimension tokens, detect non-uniform intervals | Pure math, no new infra |
| Contrast pairing validity | All (fg, bg) color token pairs through `wcagContrastRatio` | ~100-line service |
| Token drift heatmap | Per-token count of near-miss ΔE values in codebase | Per-token audit sweep |
| Sync staleness | `token_source.last_synced_at` vs. now | Trivial |

### Infrastructure Cost Summary

| Category | Effort | Details |
|----------|--------|---------|
| **Zero new infra** (wire existing data) | ~5 IPC handlers, ~150 lines | Sync state, history, DBOM, coverage, Figma linkage |
| **Small new infra** (reuse existing computation) | ~250 lines | Token usage scanner, contrast pairing matrix |
| **Medium new infra** (schema change) | ~100 lines + migration | Alias chain preservation (`alias_source` column) |
| **UI build** | New component | `TokenPanel.tsx` replacing `TokenManager.tsx` |

**Bottom line:** 80% of what a brilliant token experience needs is already computed and stored. The Tokens tab is a thin CRUD shell on a deep data lake.

---

## 7. The Vision: Mint

### Citadel Name

**Mint** — where tokens are forged, verified, and certified for circulation. The Mint doesn't just store currency — it validates purity, detects counterfeits, and tracks provenance.

### Panel Architecture

Instead of a flat list, a **multi-view observability panel** with four sections:

```
+------------------------------------------+
| Mint                            [=] [##]  |  <- List / Grid toggle
+------------------------------------------+
| [Search tokens...]     Filter: [All v]   |
+------------------------------------------+
| HEALTH BAR (always visible)              |
|  Coverage: 87%  | Drift: 3  | Orphan: 1 |
|  A11y: 2 contrast failures              |
|  Last sync: 2m ago  [Pull] [Push]       |
+------------------------------------------+
| COLORS              12 tokens            |
|  +----+ +----+ +----+ +----+            |
|  |####| |####| |####| |####|            |  <- Swatch grid
|  +----+ +----+ +----+ +----+            |
|  brand   brand   text    text            |
|  primary secondary primary muted         |
|  8 uses  3 uses  14 uses  0 uses [!]    |
+------------------------------------------+
| TYPOGRAPHY           6 tokens            |
|  Heading: Inter 24/32 Bold     12 uses  |  <- Specimen preview
|  Body: Inter 16/24 Regular     23 uses  |
+------------------------------------------+
| SPACING              5 tokens            |
|  4 - 8 -- 12 ---- 16 -------- 32       |  <- Visual ruler
|  [!] Gap: no 24px step                  |
+------------------------------------------+
| STAGING (2 pending)            [Review]  |  <- Extracted, not yet approved
+------------------------------------------+
```

### Per-Token Detail (on selection)

```
+------------------------------------------+
| <- Back to grid                          |
+------------------------------------------+
| color.brand.primary                      |
|  +--------+                              |
|  | #0066FF |  Light     Dark             |  <- Mode columns
|  +--------+  #0066FF   #3388FF          |
+------------------------------------------+
| USAGE                          14 files  |
|  Button.tsx (3 refs)                     |
|  Header.tsx (2 refs)                     |
|  Card.tsx (1 ref)                        |
|  ... 8 more                              |
+------------------------------------------+
| CONTRAST PAIRINGS                        |
|  vs. surface.default (#FFF): 3.9:1 [!]  |  <- Fails AA
|  vs. surface.card (#F8F8F8):  3.7:1 [!] |
|  vs. surface.dark (#1A1A1A): 12.1:1 [/] |
+------------------------------------------+
| DRIFT                                    |
|  Figma: #0066FF  Local: #0066FF  [/]    |  <- In sync
|  Last synced: 2h ago                     |
+------------------------------------------+
| PROVENANCE                               |
|  Created: Figma import, 2026-03-15      |
|  Last modified: flint_sync_pull, 3-28   |
+------------------------------------------+
```

### Staging Area (Token Approval Flow)

```
+------------------------------------------+
| STAGING: 5 tokens extracted from Figma   |
|  Review before adding to your system     |
+------------------------------------------+
| [/] color.accent.warm  #FF6B35          |
|     No conflicts                         |
+------------------------------------------+
| [!] color.brand.red    #CC0000          |
|     Conflicts with brand.primary         |
|     DE 4.2 — keep existing or use this? |
|     [Keep Existing] [Use Figma Value]    |
+------------------------------------------+
| [/] spacing.xl          48px             |
|     New addition                         |
+------------------------------------------+
|        [Approve All Clean] [Dismiss]     |
+------------------------------------------+
```

### Key Principles

1. **Observe, don't edit.** Token values are governance standards. Changes route through MCP with provenance recording. Glass shows state, triggers actions, never directly mutates.
2. **Code truth first.** Usage counts, drift indicators, and dead token detection are Flint's moat. Lead with what no competitor can show.
3. **Accessibility built in.** Contrast pairing data is computed automatically and shown inline — not in a separate audit step.
4. **Progressive disclosure.** Health bar appears immediately. Detail views on selection. Staging area only when pending tokens exist.

---

## 8. Five Brilliant Moments

These are interactions where Flint already has the data to act before the designer asks.

### Brilliant Moment 1 — The First-Sync Prompt

**Trigger:** Figma connection established AND `design-tokens.json` is empty or stale (older than Figma last-modified).

**What Flint does:** The Tokens tab shows a single card: "Your Figma file has N variables. Import them now?" One click triggers `flint_extract_tokens`, shows a progress spinner, then drops into the approval staging area.

**Why brilliant:** The designer doesn't know this step exists. Most users of token tools skip extraction because it's buried in docs. Flint has both signals (blank project + live Figma connection) and can act unprompted.

### Brilliant Moment 2 — Approval with Drift Warning

**Trigger:** `flint_extract_tokens` returns results.

**What Flint does:** Before asking for approval, runs every extracted token through Mithril in memory. Any token where ΔE > 2.0 against an existing token gets a warning badge: "This conflicts with your brand red (ΔE 3.1). Keep existing / Use Figma value."

**Why brilliant:** The approval step is currently binary (accept the batch). Per-token Mithril scoring at approval time turns a rubber-stamp into a governance gate. The designer sees consequences before tokens enter the system.

### Brilliant Moment 3 — The Silent Drift Badge

**Trigger:** MCP push channel receives a sync event from `flint_sync_pull`.

**What Flint does:** The Tokens tab badge silently updates to "3 drifted." No toast, no interruption. When the designer opens the tab, each drifted token shows side-by-side swatches: Figma value left, local value right, ΔE between, "Accept" button.

**Why brilliant:** Designers discover drift only when something looks wrong in review. Flint detects it in real time. A silent badge respects workflow while eliminating the mystery.

### Brilliant Moment 4 — Pre-Export Emission Check

**Trigger:** Designer opens the Export modal (Gate).

**What Flint does:** Alongside the governance audit, checks whether any tokens changed since last emission. If yes, adds one line: "4 tokens changed since last CSS/Tailwind emission. Emit now?" with a checkbox. Emission runs atomically as part of export.

**Why brilliant:** Today the designer must remember to emit tokens separately. Flint has modification timestamps. The export flow is the natural moment to catch stale platform tokens.

### Brilliant Moment 5 — Orphan Cleanup Nudge

**Trigger:** Governance audit returns SYNC-002 AND the token's usage count is 0.

**What Flint does:** Token row gets a subtle badge: "Not used in any component." Hover tooltip: "This token exists in your system but isn't referenced in any component. Safe to remove." No alarm, no blocking.

**Why brilliant:** Design systems accumulate dead tokens. Nobody goes looking. Flint already audits for this — surfacing it inline costs nothing and eliminates a category of debt.

---

## 9. What to Remove

| Current Feature | Why Remove | Replace With |
|----------------|-----------|-------------|
| **Inline value editing** | Mutates governance standard with no provenance | "Request change" routing through MCP with Stamp recording |
| **Delete button per row** | Destructive with no impact analysis | "Flag for removal" with usage count gate |
| **"Clear All" button** | Wipes entire design system reference, no undo | Remove entirely — belongs in CLI if anywhere |
| **"Import JSON" as primary CTA** | Developer workflow exposed to designers | "Connect Figma" as primary; JSON import as secondary text link |

### What to Keep

| Current Feature | Why Keep |
|----------------|---------|
| Search bar | Works well, add type/violation filters |
| Collection grouping | Logical, enhance with tree view |
| Color swatches | Good, extend to grid layout |
| Dimension bars | Good visual indicator, keep |
| Font family specimen | Good, enhance with full typography preview |
| Progressive disclosure (tab unlock) | Correct pattern, keep |

---

## 10. Table Stakes vs. Differentiators

### Table Stakes (Must Ship)

- [ ] Visual swatches per token type (color grid, spacing ruler, type specimen)
- [ ] Grouped tree view (collection > group > token)
- [ ] Search and filter by name, value, type, and violation state
- [ ] Mode columns (Light | Dark side-by-side)
- [ ] Alias/reference badges (resolved value on hover)

### Flint Differentiators (Our Moat)

- [ ] Usage count from real AST analysis
- [ ] Dead token detection (defined, never referenced)
- [ ] Drift indicator with ΔE distance
- [ ] Impact preview before token changes
- [ ] Token-level contrast auditing across modes
- [ ] Staging area with pre-approval Mithril checks
- [ ] Governance provenance per token
- [ ] Scale gap analysis (missing steps in spacing/sizing scales)
- [ ] Pre-export emission check integrated with Gate

---

## 11. Token Lifecycle Map

```
  DISCOVERY         EXTRACTION         APPROVAL           USAGE
  "What tokens       "Convert Figma     "Review and        "Tokens referenced
   exist?"            to DTCG"           accept"            in components"

  Figma connected   flint_extract_     Staging area       ClassBuilder,
  + tokens empty     tokens /           in Glass with      Mithril audit,
  -> prompt          pull_variables     per-token          usage indexing
                                        Mithril check
       |                  |                  |                  |
       v                  v                  v                  v

  DRIFT DETECTION     SYNC               EMISSION           AUDIT
  "Token != Figma     "Pull/push         "Emit to CSS,      "History,
   or token != code"   changes"           Tailwind, etc."    provenance"

  Silent drift       Pull confirm       Pre-export         Governance
  badge, per-token   in Glass,          emission check     events,
  swatch comparison  conflict UI        in Gate modal      Ledger, Stamp
```

### Where Each Stage Lives

| Stage | Engine (MCP) | Glass | IDE (VS Code) | CI |
|-------|-------------|-------|---------------|-----|
| Discovery | `flint_extract_tokens` | First-sync prompt | N/A | N/A |
| Extraction | `flint_pull_variables` | Progress indicator | N/A | N/A |
| Approval | `flint_approve_tokens` | Staging area UI | N/A | N/A |
| Usage | Mithril audit, usage indexer | Usage counts, dead badges | Token autocomplete (OPP-15) | N/A |
| Drift Detection | `flint_sync_check`, Mithril | Silent drift badge, swatch comparison | Diagnostics | `flint-gate sync` |
| Sync | `flint_sync_pull/push` | Pull confirm, conflict resolution UI | N/A | `flint-gate sync` |
| Emission | `flint_emit_tokens` | Pre-export check in Gate | N/A | `flint-gate emit` |
| Audit | Governance events, Stamp | Provenance display per token | N/A | `flint_audit_report` |

---

## 12. Feature Budget Gate Analysis

### Passes All 6 Gates (Build in Glass)

| Feature | Who | Behavior Enabled | 80%? | Maintenance | Validated? | Trade-off |
|---------|-----|-----------------|------|-------------|-----------|-----------|
| Token health bar | Designer | See system health at a glance | Yes | Low | Journey maps confirm | N/A |
| Usage count per token | Designer | Know which tokens matter | Yes | Low | No competitor does this | N/A |
| Drift comparison (swatches) | Designer | See what changed in Figma | Yes | Medium | OPP-24, OPP-26 | N/A |
| Staging area (approval) | Designer | Review before accepting | Yes | Medium | Journey 8 | N/A |
| Sync pull confirm | Designer | See what's incoming | Yes | Medium | SYNC flow | N/A |
| Pre-export emission | Designer | Prevent stale platform tokens | Yes | Low | Export flow | N/A |
| Contrast pairing badges | Designer | Know if tokens are accessible | Yes | Medium | Warden blind spot | N/A |

### Stays in MCP / CLI (No Glass UI)

| Feature | Why |
|---------|-----|
| `flint_sync_push` execution | Write to Figma is governance action — agent-initiated is correct |
| `flint_sync_check` | CI gate, headless, machine-readable |
| `flint_sync_history` export | Developer/compliance action |
| `flint_map_tokens` library mapping | Configuration in `flint.config.yaml`, not a modal |
| `flint_resolve_all` bulk resolution | Bulk without review is risky — Glass does per-token, CLI does bulk |
| Token creation from scratch | Authoring belongs upstream (Figma, Tokens Studio) |
| Token aliasing/grouping UI | Authoring tool territory, not governance |

---

## 13. Open Questions

1. **Should Glass allow token edits at all, or strictly observe?** The UX Critic says remove editing. The Product Planner says route through MCP. Either way, inline edit without provenance must go. Decision: should we keep a "request change" flow that routes through MCP, or remove all editing from Glass?

2. **Contrast matrix scope.** Computing all (fg, bg) pairs is O(n^2). For large token sets (100+ colors), should we limit to semantically named pairs only (text.* vs surface.*), or let the user select pairs?

3. **Alias chain preservation.** Requires a schema migration (add `alias_source` column). Is this worth the migration cost now, or defer to a later sprint?

4. **Token usage scanner performance.** Scanning all workspace files for token references on every tab open may be slow for large projects. Should this be cached and updated incrementally (on file save)?

5. **Scale gap analysis heuristics.** What constitutes a "gap" in a spacing scale? Linear (missing 24 between 16 and 32)? Geometric (missing 1.5x step)? User-configurable?

6. **Reduced-motion token convention.** There's no standard DTCG convention for `@reduced-motion` mode variants. Should Flint define one and document it?

---

## Appendix A: Files Referenced

### Glass UI
- `src/components/ui/TokenManager.tsx` — current implementation (to be replaced)
- `src/components/ui/PropertiesPanel.tsx` — ClassBuilder, DriftDetector, MithrilViolationCard
- `src/components/inspector/ClassBuilder.tsx` — token-driven class selection
- `src/store/tokenStore.ts` — Zustand state and actions

### MCP Engine
- `flint-mcp/src/tools/extractTokens.ts` — extract + approve
- `flint-mcp/src/tools/emitTokens.ts` — platform emission
- `flint-mcp/src/tools/mapTokens.ts` — library mapping
- `flint-mcp/src/tools/sync.ts` — sync pull/push/check
- `flint-mcp/src/core/MithrilLinter.ts` — drift detection, `findClosestToken`, `buildTokenCoverage`
- `flint-mcp/src/core/A11yLinter.ts` — Warden (needs token-aware extension)
- `flint-mcp/src/core/a11y/contrast-utils.ts` — `wcagContrastRatio` (reusable)
- `flint-mcp/src/core/sync/tokenSyncEngine.ts` — three-way diff
- `flint-mcp/src/core/sync/tokenSourceService.ts` — baseline tracking
- `flint-mcp/src/core/governance/dbomService.ts` — per-token compliance

### Electron
- `electron/main.ts` — token IPC handlers, SQLite schema
- `electron/preload.ts` — `window.flintAPI.tokens` surface
- `electron/ingestion/IngestionAuditor.ts` — token-aware heal pass

### Strategy
- `docs/strategy/JOURNEY-MAPS-UX_1.md` — OPP-07, OPP-15, OPP-24, OPP-26
- `docs/strategy/FEATURE-BUDGET-FRAMEWORK.md` — 6-gate decision framework
- `docs/strategy/BACKLOG-PRIORITIZED.md` — sprint planning
