# Flint Glass — Full UX Audit
**Date:** 2026-03-28
**Scope:** All 19 workflow/feature areas across Flint Glass
**Primary lenses:** Info Hierarchy · Zone Hierarchy
**Method:** 19 parallel `flint-ux-critic` agents, each reading journey maps, Feature Budget Framework, CLAUDE.md, and HANDOFF.md before critiquing their assigned surface.

---

## Executive Summary

Glass has strong structural bones: the layout is right, the canvas metaphor works, and the Figma-native vocabulary in LayoutPanel and the DriftDetector's side-by-side comparison are genuinely well designed. But three systemic problems cut across every surface:

1. **Info hierarchy is inverted on almost every screen.** The most visually prominent elements carry the least actionable information. The most actionable information is buried at 10px in collapsed accordions.
2. **Zone authority is undefined.** Designer controls and developer concepts coexist without separation. Governance indicators are fragmented across 6+ surfaces. Chat and file exploration leaked into an observability tool.
3. **~6,000+ lines of dead code** from the GLASS.1 redesign are still in the repo — 17+ files that confuse future agents, inflate the maintenance surface, and in several cases represent architectural violations.

---

## Part 1 — Info Hierarchy: What's Prominent vs. What Matters

### 1.1 StatusBar (most prominent element is the least useful)

`src/components/editor/StatusBar.tsx`

The `SyncStatus` PowerSync indicator renders a `shadow-lg shadow-emerald-400/40` green glow — the most visually dominant element in the entire status bar. PowerSync database sync is infrastructure. A designer never needs to act on it. Yet it visually outranks every governance signal in the bar.

Meanwhile:
- The override warning (actionable — blocks export) is a small zinc badge
- The health grade (J3.4 — designer needs this constantly) is in the right sidebar, not the status bar
- "MCP" as a label means nothing to the designer audience; "Governance Engine" or "Flint" is correct
- Up to 11 elements with no overflow or priority ordering; on smaller windows, critical items collapse before decorative ones
- Two "Autopilot" elements appear adjacently with different functions (no disambiguation)
- The Figma popover exposes server admin controls ("Server: Running/Stopped") — developer language on a designer surface

**Fix:** Demote the green glow. Order StatusBar items by: Export Gate status → Violation count → Sync → Everything else. Relabel "MCP" to "Flint". Remove server language from the Figma popover.

---

### 1.2 GovernanceDashboard (most actionable insight is least visible)

`src/components/ui/GovernanceDashboard.tsx`

The score trend hint — `"Fix 3 issues to reach grade A"` — is styled `text-[10px] text-zinc-600` inside a collapsed accordion. This is the most directly actionable governance insight in the product. It is the least legible thing on screen.

Also:
- **Line 746:** The Export button navigates to the Tokens tab, not `ExportModal`. The primary CTA of the governance surface is broken.
- **Line 438:** `String(msg)` on a `string[]` — multiple a11y violation messages concatenated into one garbled string.
- **Line 464:** `const overrideCount = overridesExist ? 1 : 0` — boolean, not actual count. The health score formula is computing against a binary flag, not real data.

**Fix:** Promote the trend hint to prominent text below the grade ring. Fix the Export CTA. Fix the `String(msg[])` call. Fix the override count.

---

### 1.3 Canvas chrome (decorative elements dominate governance signals)

`src/components/editor/XYCanvas.tsx:69-72`

The fake macOS traffic-light dots (red/yellow/green circles) are the primary canvas chrome. They are decorative — they do nothing. Below them, `"Live Preview · srcdoc Engine"` explains the render mode to no designer ever. Meanwhile, ShieldOverlay (spatial violation badges) was killed in GLASS.1 and never replaced — the canvas has **zero governance visualization** at the spatial level.

`src/components/editor/LivePreview.tsx` — 1,409 lines, 15+ concerns. The Autopilot "Original/Governed" toggle appears without any explanation of what "Governed" means.

**Fix:** Remove or demote the traffic-light chrome. Remove "srcdoc Engine" label. The canvas needs a replacement for the removed ShieldOverlay — some spatial signal for violations. Add a tooltip or label to the Autopilot toggle.

---

### 1.4 DriftDetector (math on a designer surface)

`src/components/inspector/DriftDetector.tsx`

- `deltaE 3.2` is the primary badge. `"Minor drift"` is the tooltip. This is backwards: the human-readable label should be primary, the number secondary.
- Section header: "Drift Detection" — developer jargon. Should be "Color Alignment" or "Off-brand Colors."
- `"ΔE<2 systemizable · ΔE>5 significant drift"` in the legend — mathematical notation in a designer tool.
- `"Systemizable"` — not a word. Should be "Auto-fixable."
- Empty state says `"no match"` with no guidance on next step.

---

### 1.5 Tokens & Inspector vocabulary layer (inconsistent across all panels)

The inspector surface has three vocabulary registers operating simultaneously with no unifying layer:

| Panel | Language | Audience |
|-------|----------|----------|
| LayoutPanel | Hug, Fill, Auto Layout | Designer ✓ |
| DriftDetector | deltaE, systemizable, drift | Color scientist ✗ |
| ClassBuilder | TokenAutocomplete shows `bg-brand-primary` | Developer ✗ |
| TokenManager | "Import DTCG JSON", "DTCG JSON" | Standards-body ✗ |
| DriftDetector legend | `ΔE<2`, `ΔE>5` | Math textbook ✗ |

The Governance Education (EDU) phase reached GovernanceOverlay and GovernanceDashboard but never landed in the inspector. The inspector is where designers spend the most time. It is the highest-impact surface for vocabulary normalization.

---

## Part 2 — Zone Hierarchy: Which Areas Own Which Authority

### 2.1 Developer concepts leaking into designer surfaces

The following developer concepts are currently exposed in Glass without a designer-facing translation or gating mechanism:

| Leak | Location | What a designer sees |
|------|----------|---------------------|
| "Raw Attributes" section | PropertiesPanel:641 | HTML attribute names |
| "+ Add Prop" button | PropertiesPanel:349-355 | JSX prop injection |
| "Jump to line N" | LayerTree:345 | Source code line numbers |
| "L42" in inspector header | PropertiesPanel:602 | Line number |
| Tag badges on every layer row | LayerTree | JSX tag names (div, span, Button) |
| "Server: Running/Stopped" | StatusBar Figma popover | Process status |
| "DTCG JSON" import label | TokenManager:181 | W3C specification name |
| Tailwind class names in autocomplete | ClassBuilder / primitives | CSS framework internals |
| "AST mutation reversed" toast copy | NotificationCenter | AST engine jargon |
| "AST mutation reapplied" toast copy | NotificationCenter | AST engine jargon |
| Raw HTTP status codes in error toasts | NotificationCenter | HTTP protocol |
| "MCP" label | StatusBar | Model Context Protocol |

Per CLAUDE.md and the Feature Budget Framework Gate 1: Glass is for designers. Each item above should either be removed, relabeled with designer vocabulary, or gated behind an "Advanced" toggle.

---

### 2.2 FileExplorer is an architectural violation

`src/App.tsx:903`

CLAUDE.md explicitly states: _"Glass does NOT contain: Monaco editor panel, terminal panel, file explorer panel. Those live in the host IDE."_

`FileExplorer` is mounted as a left sidebar tab in production, is the only left panel tab lacking a `PanelErrorBoundary` (crash vector), and shows raw file paths (developer vocabulary). This is a documented architectural constraint violation.

**Fix:** Remove `FileExplorer` from Glass, or formally update CLAUDE.md to document the decision and rationale. Do not leave an architectural violation in production without documentation.

---

### 2.3 Governance indicators are fragmented across too many zones

Violations currently appear in some combination of: LayerTree (amber triangle), PropertiesPanel (violation card + ClassBuilder glow), GovernanceOverlay, ShieldOverlay (killed in GLASS.1), ViolationTooltip, StatusBar, GovernanceDashboard.

But Warden (a11y) violations only appear in GovernanceOverlay, ShieldOverlay, and StatusBar — **not** in LayerTree or PropertiesPanel. Color drift feels more visible and urgent than accessibility violations. This inverts Commandment 5: "Accessibility is a Compiler Error."

Additionally, ShieldOverlay was killed in GLASS.1 with no replacement. The canvas has zero spatial governance visualization. The canvas is the primary zone for spatial work — losing spatial violation indicators there is a high-impact regression.

---

### 2.4 Figma sync MCP tools have no Glass UI (largest capability gap)

CLAUDE.md marks SYNC.1-4 all as ONLINE. The MCP server has 8 Figma/sync tools. **Zero have a Glass UI surface.**

| MCP Tool | Purpose | Glass UI |
|----------|---------|----------|
| `flint_figma_connect` | Alliance — OAuth/PAT connection | NONE |
| `flint_sync_pull` | Envoy — pull Figma changes | NONE |
| `flint_sync_push` | Envoy — push local to Figma | NONE |
| `flint_resolve_conflict` | Three-way diff resolution | NONE |
| `flint_resolve_all` | Bulk conflict resolution | NONE |
| `flint_sync_check` | CI sync health | NONE |
| `flint_sync_history` | Sync history export | NONE |
| `flint_extract_tokens` | Scout — token extraction | NONE |

A designer cannot pull, push, or resolve sync conflicts from Glass. They must use MCP tools via an IDE agent. The Envoy module is invisible to the designer at every level: no per-token sync state, no conflict resolution UI, no pull/push buttons.

Additionally, two parallel Figma connection models exist (loopback ingestion server vs Alliance OAuth) with no UI explanation of which path does what, when to use each, or how they relate.

---

### 2.5 AnnotationList is a read-only one-way channel

`src/components/ui/AnnotationList.tsx:163`

The annotation system only lets designers read and resolve annotations. There is no "Add annotation" affordance in Glass. Annotations can only be created by MCP agents or the CLI. The empty state reads: _"No open annotations for this node."_ — with no CTA.

This is the annotation system's most significant UX gap. A designer who opens the panel expecting to leave a note for a collaborator has no path forward.

---

## Part 3 — Critical Bugs (Fix Before Any Release)

| Severity | Bug | Location |
|----------|-----|----------|
| 🔴 Critical | `canExport` hardcoded to `false` in ExportModal — 3 different answers for export state across app | `ExportModal.tsx:143-146`, `StatusBar.tsx:97`, `canvasStore.canExport()` |
| 🔴 Critical | Export button in GovernanceDashboard navigates to Tokens tab, not ExportModal | `GovernanceDashboard.tsx:746` |
| 🔴 Critical | `String(msg)` on `string[]` garbles a11y violation output | `GovernanceDashboard.tsx:438` |
| 🔴 Critical | `overrideCount = overridesExist ? 1 : 0` — boolean not count; breaks health score | `GovernanceDashboard.tsx:464` |
| 🔴 Critical | `aria-hidden="true"` on GovernancePanel backdrop hides entire dialog from screen readers | `GovernancePanel.tsx:436` |
| 🔴 Critical | Canvas has NO spatial violation indicators — ShieldOverlay killed in GLASS.1, not replaced | `XYCanvas.tsx` |
| 🔴 Critical | ComponentPanel insert dispatches with `''` targetNodeId — silent no-op every time | `ComponentPanel.tsx:156-166` |
| 🔴 Critical | Inspector primitives (Accordion, CompactSelect, TokenAutocomplete, etc.) have zero ARIA attributes — Flint enforces a11y but its own inspector fails it | `primitives.tsx` |
| 🔴 Critical | `TokenManager` ImportModal has no `role="dialog"`, no `aria-modal`, no FocusTrap | `TokenManager.tsx:168-244` |
| 🟠 High | "Connect Figma" button in OnboardingNudge opens Tokens tab, not Figma flow | `OnboardingNudge.tsx:75-77`, `App.tsx:943` |
| 🟠 High | StatusBar Disconnect button is destructive with no confirmation dialog | `StatusBar.tsx:564-572` |
| 🟠 High | `FigmaSetupWizard` references stale `secret` field that SEC.2 removed | `FigmaSetupWizard.tsx:157,337` |
| 🟠 High | App.tsx tab bars use `aria-pressed` instead of `aria-selected`; no `role="tablist"` | `App.tsx` |
| 🟠 High | Triple notification on single Figma sync event | `App.tsx:351`, `StatusBar.tsx:186`, `FigmaSetupWizard.tsx:232` |
| 🟠 High | Error toasts auto-dismiss, swallowing actionable errors | `NotificationCenter` |
| 🟠 High | `LeftTab` type at `canvasStore.ts:41` missing `'components'` — stale canonical type | `canvasStore.ts:41` |
| 🟠 High | `FileExplorer` mounted without `PanelErrorBoundary` — only left tab without one | `App.tsx:903` |
| 🟠 High | `GovernanceOverlay.tsx:322` ignores `fixMode` preference, always applies immediately | `GovernanceOverlay.tsx:322` |
| 🟠 High | No token value validation — invalid values silently poison governance pipeline | `TokenManager.tsx` |
| 🟠 High | Undo toast duration 2500ms — Redo button unreachable at normal reading speed | `NotificationCenter` |

---

## Part 4 — Dead Code to Delete (~6,000+ lines)

These files are confirmed dead — not imported in production, explicitly deprecated, or architectural violations. Delete them.

| File | Lines | Why it's dead |
|------|-------|---------------|
| `src/components/editor/ComponentCardNode.tsx` | 824 | `@deprecated GLASS.1c` — Build/Govern canvas modes removed |
| `src/components/editor/RecipeStrip.tsx` | 212 | `@deprecated GLASS.1c` — same |
| `src/components/editor/DependencyEdge.tsx` | ~50 | `@deprecated` — canvas mode removed |
| `src/components/editor/CanvasViewToggle.tsx` | ~80 | `@deprecated GLASS.1c` — canvas modes killed |
| `src/components/editor/GovernanceOverlay.tsx` | ~400 | Not imported anywhere in production |
| `src/components/editor/ShieldOverlay.tsx` | ~300 | Not imported anywhere in production |
| `src/components/editor/GhostOverlay.tsx` | ~200 | Not imported anywhere in production |
| `src/components/editor/ViolationTooltip.tsx` | ~150 | Only consumer is dead ShieldOverlay |
| `src/components/ui/AgentDashboard.tsx` | ~400 | Not mounted in App.tsx; `agents` tab doesn't exist in RightTab type |
| `src/components/ui/AgentSettingsModal.tsx` | ~200 | Only imported by dead AgentChatPanel |
| `src/components/ui/AgentChatPanel.tsx` | ~300 | Architectural violation (chat in Glass); not mounted |
| `src/components/ui/ActivityFeed.tsx` | ~250 | Polls `activity-log.jsonl` which nothing writes to; superseded by `useMCPEventListener` |
| `src/components/editor/ImportAuditToast.tsx` | ~80 | Superseded by ImportSummary |
| `src/components/ui/DiffCard.tsx` | ~150 | Only consumer is dead AgentChatPanel |
| `src/components/ui/Layout.tsx` (Stack) | ~60 | Zero consumers; broken dynamic Tailwind |
| `src/components/ui/PolicySettings.tsx` | 999 | Not imported in any production component |
| `src/components/ui/RecoveryPanel.tsx` | ~400 | Not mounted anywhere; TODO says "Will move to Command Palette" |
| `src/components/inspector/TokenSelect.tsx` | ~100 | Dead code; superseded by primitives.tsx |
| `src/hooks/useUnifiedViolations.ts` | ~120 | Purpose-built hook with no consumers |

**Total estimated removal: ~5,275–6,275 lines**

---

## Part 5 — Primitive Design System (Needs Replacement)

The 6 `ui/` primitives (`Button`, `Input`, `TextField`, `Heading`, `IconButton`, `SelectField`) describe a light-themed product that doesn't exist. They use `slate-*`, `white`, `bg-white`, uppercase `tracking-wider` — none of this matches the actual dark zinc/indigo Glass UI. Zero production imports.

Meanwhile, two critical patterns repeat ad-hoc across the codebase with no primitive:
- **Badge pattern:** 59+ occurrences across 23 files, all inline Tailwind compositions
- **Modal backdrop pattern:** 7+ occurrences with no shared component

Three competing `SwitchToggle` implementations exist across the codebase.

**Fix:** Delete or rewrite the 6 broken primitives to match the actual dark theme. Create a `Badge` primitive. Create a `Modal` primitive (with `role="dialog"`, `aria-modal`, FocusTrap built in).

---

## Part 6 — Onboarding & First-Launch Flow

| Component | Problem |
|-----------|---------|
| `LaunchScreen.tsx` | "New Project" CTA delivers empty canvas despite promising "Start building immediately" |
| `OnboardingOverlay.tsx` | Teaches UI geography, not action. Step 2: "Mithril warnings appear here when a token drifts beyond the Delta-E threshold" — insider jargon. Should describe what the designer can DO. |
| `SetupWizard.tsx` | Double-overlay bug (internal `fixed inset-0 z-50` + App.tsx wrapper `fixed inset-0 z-[200]`); 2 unnecessary steps (welcome + done) |
| `BetaWelcome.tsx` | Contradicts DEMO-FIRST research; beta testers get a worse experience than regular users; uses `gray-*` instead of `zinc-*` |
| `CommandPalette.tsx` | 3 commands navigate to wrong destination post-GLASS.1; no FocusTrap; missing `aria-activedescendant`; no discoverability hint in Glass |

---

## Prioritized Action Plan

### Sprint 1 — Fix Critical Bugs (blocks release / demo)

1. Fix `canExport` consistency — single source of truth: `canvasStore.canExport()`. Remove hardcoded values. (`ExportModal.tsx:143-146`, `StatusBar.tsx:97`)
2. Fix GovernanceDashboard Export button destination — must open `ExportModal`, not Tokens tab. (`GovernanceDashboard.tsx:746`)
3. Fix `String(msg[])` array coercion — map to list items. (`GovernanceDashboard.tsx:438`)
4. Fix override count — query actual count from store. (`GovernanceDashboard.tsx:464`)
5. Fix `GovernancePanel` backdrop `aria-hidden` — remove it. (`GovernancePanel.tsx:436`)
6. Fix `ComponentPanel` insert no-op — add root-element fallback or "select a layer first" guard. (`ComponentPanel.tsx:156-166`)
7. Add ARIA attributes to `primitives.tsx` — minimum: `role="combobox"` + `aria-expanded` + `aria-activedescendant` on TokenAutocomplete; `aria-expanded` on Accordion. Critical credibility issue.
8. Add `role="dialog"` + FocusTrap to `TokenManager` ImportModal.
9. Add token value validation with inline error state.
10. Fix `OnboardingNudge` "Connect Figma" button — rewire or relabel.
11. Remove `FigmaSetupWizard` stale `secret` references.
12. Add confirmation to StatusBar Disconnect button.

### Sprint 2 — Dead Code Purge

Delete all 19 files listed in Part 4. This is mechanical — no new code, just deletion. Clears ~6,000 lines, removes architectural violations, and eliminates false signals for future agents.

### Sprint 3 — Info Hierarchy: Vocabulary Normalization

1. Rename: "Drift Detection" → "Color Alignment"; "systemizable" → "auto-fixable"; "deltaE N.N" → human-readable label; "DTCG JSON" → "Token File"
2. Make deltaE labels primary (not tooltip). (`DriftDetector.tsx`)
3. Promote GovernanceDashboard trend hint to visible text. (`GovernanceDashboard.tsx`)
4. Replace "AST mutation reversed/reapplied" toasts with designer language.
5. Replace "Raw Attributes" → "Element Properties"; gate "+ Add Prop" behind advanced mode. (`PropertiesPanel.tsx:641`)
6. Hide Tailwind class names in ClassBuilder autocomplete by default. (`ClassBuilder.tsx`)
7. Hide tag badges in LayerTree by default (show on hover). (`LayerTree.tsx`)
8. Remove "Server: Running/Stopped" from Figma popover. (`StatusBar.tsx`)
9. Relabel "MCP" → "Flint" in StatusBar.

### Sprint 4 — Zone Hierarchy: Authority Mapping

1. Demote SyncStatus green glow in StatusBar — use low-contrast indicator.
2. Order StatusBar items by: Export Gate → Violations → Sync → Everything else.
3. Resolve `FileExplorer` architectural violation — remove from Glass or formally document exception.
4. Add a11y violation indicators to LayerTree (parity with Mithril badges). Commandment 5 demands this.
5. Add "Add annotation" affordance to AnnotationList — even a minimal "Add note" button.
6. Fix `SetupWizard` double-overlay bug.
7. Remove fake macOS traffic-light dots from canvas chrome. Remove "srcdoc Engine" label.
8. Fix `LeftTab` canonical type in `canvasStore.ts:41` — add `'components'`.
9. Toast duration policy: document and enforce by severity (Critical: persistent; Error: 8000ms; Warning: 5000ms; Info: 3000ms; Undo: 5000ms).
10. Consolidate three toast systems into one zone with explicit stacking rules.

### Sprint 5 — Primitive Design System

1. Delete or rewrite the 6 `ui/` primitives to match the actual dark zinc/indigo theme.
2. Create `Badge` primitive (replaces 59+ inline compositions).
3. Create `Modal` primitive with built-in dialog semantics, FocusTrap, and consistent backdrop.
4. Reconcile three SwitchToggle implementations into one.

### Sprint 6 — Figma Sync Glass Surface (strategic)

1. Design a unified Figma connection management panel — one entry point for both the loopback ingestion path and the Alliance OAuth path, with clear guidance on when to use each.
2. Add per-token sync state badges to TokenManager: "Figma" / "Local" / "Drifted."
3. Design conflict resolution UI for the three-way diff — the most designer-facing sync operation has no Glass surface.
4. Consider adding pull/push buttons to the existing StatusBar Figma popover as a minimal first step.

### Sprint 7 — Canvas Governance (replaces killed GLASS.1 features)

1. Design a replacement for the killed ShieldOverlay — the canvas needs spatial governance signal. Options: inline violation dots on nodes, node outline colors by health grade, or a toggle-able overlay.
2. Add Autopilot toggle explanation — tooltip or label describing "Governed" mode. (`LivePreview.tsx`)

---

## Metrics

| Category | Count |
|----------|-------|
| Critical bugs | 10 |
| High priority issues | 10 |
| Dead files to delete | 19 |
| Dead lines to remove | ~5,275–6,275 |
| Designer vocabulary leaks | 13 documented |
| Missing ARIA attributes (surfaces) | 6 |
| Toast systems (should be 1) | 3 |
| SwitchToggle implementations (should be 1) | 3 |
| Badge instances without a primitive | 59+ |
| Modal backdrops without a primitive | 7+ |
| Figma/sync MCP tools with zero Glass UI | 8 |

---

*Generated from 19 parallel UX critic agents reviewing all Glass components. Each agent independently evaluated against journey maps, Feature Budget Framework, CLAUDE.md, and the info hierarchy / zone hierarchy lenses.*
