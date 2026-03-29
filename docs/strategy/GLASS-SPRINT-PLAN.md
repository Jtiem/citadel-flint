# Glass Sprint Plan — Master Execution Document

**Date:** 2026-03-28
**Status:** ACTIVE
**Owner:** Justin Tiemann

## Source Documents (all cross-referenced here)

| Document | Date | What it contributes |
|----------|------|-------------------|
| `docs/strategy/GLASS-UX-AUDIT-2026-03-28.md` | 2026-03-28 | 19-agent full audit — info hierarchy, zone hierarchy, bugs, dead code |
| `.flint-context/plans/GOVERNANCE-UX-REVIEW.md` | 2026-03-27 | 13 OPP-GOV items — governance workflow failures, copy problems |
| `.flint-context/plans/UX-OPPORTUNITIES.md` | 2026-03-27 | 17 OPP items — noise removal, empty states, progressive disclosure |
| `docs/strategy/GLASS-BRILLIANCE-PLAN.md` | 2026-03-27 | Phase GLASS success criteria — incomplete deliverables |

## Tag Legend

- `[NEW]` — First identified in the 2026-03-28 19-agent audit
- `[KNOWN]` — Previously documented in GOVERNANCE-UX-REVIEW.md or UX-OPPORTUNITIES.md, not yet shipped
- `[GLASS.1]` — Named in GLASS-BRILLIANCE-PLAN.md success criteria; incomplete deliverable from Phase GLASS

---

## Territory Conflicts (as of 2026-03-28)

WEB-GLASS-LAUNCH-SPRINT has active claims on (plan approved, implementation not started):
- `src/App.tsx`
- `src/components/editor/StatusBar.tsx`
- `src/components/ui/LaunchScreen.tsx`
- `flint-mcp/src/server.ts`
- `server/index.ts`, `server/services/thumbnailService.ts`, `src/adapters/web-api.ts`

Items touching these files are marked ⚠️ CLAIMED. Coordinate or wait for WEB-GLASS-LAUNCH-SPRINT to complete before touching them.

---

## Sprint 1 — Critical Bugs

**Blocks release and demo. Fix first.**

| # | Status | Tag | Item | File(s) | Complexity |
|---|--------|-----|------|---------|-----------|
| S1.1 | [ ] | [KNOWN] | `canExport` hardcoded `false` in ExportModal — 3 conflicting export-state sources. Single source must be `canvasStore.canExport()` | `ExportModal.tsx:143-146`, `StatusBar.tsx:97` ⚠️ | Contained |
| S1.2 | [ ] | [NEW] | GovernanceDashboard Export button navigates to Tokens tab, not ExportModal | `GovernanceDashboard.tsx:746` | Trivial |
| S1.3 | [ ] | [NEW] | `String(msg[])` coerces array — garbles a11y violation output in dashboard | `GovernanceDashboard.tsx:438` | Trivial |
| S1.4 | [ ] | [NEW] | `overrideCount = overridesExist ? 1 : 0` — boolean not count; breaks health score formula | `GovernanceDashboard.tsx:464` | Trivial |
| S1.5 | [ ] | [GLASS.1] | `aria-hidden="true"` on GovernancePanel backdrop hides entire dialog from screen readers | `GovernancePanel.tsx:436` | Trivial |
| S1.6 | [ ] | [GLASS.1] | ComponentPanel insert dispatches with `''` targetNodeId — silent no-op every time | `ComponentPanel.tsx:156-166` | Contained |
| S1.7 | [ ] | [GLASS.1] | Inspector primitives (Accordion, CompactSelect, TokenAutocomplete, ColorPickerSwatch, PopoverPicker) have zero ARIA — Flint enforces a11y but its own inspector fails it | `src/components/inspector/primitives.tsx` | Contained |
| S1.8 | [ ] | [GLASS.1] | TokenManager ImportModal has no `role="dialog"`, no `aria-modal`, no FocusTrap | `TokenManager.tsx:168-244` | Contained |
| S1.9 | [ ] | [NEW] | No token value validation — invalid values silently poison governance pipeline | `TokenManager.tsx` | Contained |
| S1.10 | [ ] | [KNOWN] | "Connect Figma" in OnboardingNudge opens Tokens tab, not Figma connection flow | `OnboardingNudge.tsx:75-77`, `App.tsx:943` ⚠️ | Trivial |
| S1.11 | [ ] | [NEW] | FigmaSetupWizard references stale `secret` field that SEC.2 removed | `FigmaSetupWizard.tsx:157,337` | Trivial |
| S1.12 | [ ] | [NEW] | StatusBar Disconnect is destructive with no confirmation dialog | `StatusBar.tsx:564-572` ⚠️ | Trivial |
| S1.13 | [ ] | [KNOWN] | ExportModal "Fix" button closes modal without executing fix — navigates to node, leaves violation unresolved | `ExportModal.tsx:429-438` | Contained |
| S1.14 | [ ] | [GLASS.1] | App.tsx tab bars use `aria-pressed` not `aria-selected`; no `role="tablist"` wrapper | `App.tsx` ⚠️ | Contained |
| S1.15 | [ ] | [NEW] | Triple notification fires on single Figma sync event | `App.tsx:351` ⚠️, `StatusBar.tsx:186` ⚠️, `FigmaSetupWizard.tsx:232` | Contained |
| S1.16 | [ ] | [NEW] | Error toasts auto-dismiss, swallowing actionable errors | `NotificationCenter` | Trivial |
| S1.17 | [ ] | [NEW] | `LeftTab` type at `canvasStore.ts:41` missing `'components'` — stale canonical type | `canvasStore.ts:41` | Trivial |
| S1.18 | [ ] | [GLASS.1] | `GovernanceOverlay.tsx:322` ignores `fixMode` preference, always applies immediately | `GovernanceOverlay.tsx:322` | Trivial |
| S1.19 | [ ] | [NEW] | Undo toast 2500ms — Redo button unreachable at normal reading speed; should be 5000ms | `NotificationCenter` | Trivial |

## Sprint 1 — COMPLETE (2026-03-29)

**Done (2026-03-28):** S1.2, S1.3, S1.4, S1.5, S1.6, S1.7, S1.8, S1.9, S1.11, S1.13 (already correct), S1.16, S1.17, S1.18, S1.19 + S5.1 (zero-token state)

**Done (2026-03-29):** S1.10 (OnboardingNudge → opens SetupWizard), S1.12 (Disconnect confirm dialog), S1.14 (tablist + role=tab + aria-selected), S1.15 (dedup: removed StatusBar onConnected toast)

**S1.1 verified already correct** — ExportModal.canExport is dynamically computed, not hardcoded.

---

## Sprint 2 — Dead Code Purge (COMPLETE — 2026-03-28)

**~6,000 lines of dead files. Delete — no new code written.**

| # | Status | Tag | File | Lines | Why Dead |
|---|--------|-----|------|-------|---------|
| S2.1 | [ ] | [GLASS.1] | `src/components/editor/ComponentCardNode.tsx` | 824 | `@deprecated GLASS.1c` — Build/Govern canvas modes removed |
| S2.2 | [ ] | [GLASS.1] | `src/components/editor/RecipeStrip.tsx` | 212 | `@deprecated GLASS.1c` |
| S2.3 | [ ] | [GLASS.1] | `src/components/editor/DependencyEdge.tsx` | ~50 | `@deprecated` — canvas mode removed |
| S2.4 | [ ] | [GLASS.1] | `src/components/editor/CanvasViewToggle.tsx` | ~80 | `@deprecated GLASS.1c` |
| S2.5 | [ ] | [GLASS.1] | `src/components/editor/GovernanceOverlay.tsx` | ~400 | Not imported in production post-GLASS.1 |
| S2.6 | [ ] | [GLASS.1] | `src/components/editor/ShieldOverlay.tsx` | ~300 | Not imported in production post-GLASS.1 |
| S2.7 | [ ] | [GLASS.1] | `src/components/editor/GhostOverlay.tsx` | ~200 | Not imported in production post-GLASS.1 |
| S2.8 | [ ] | [GLASS.1] | `src/components/editor/ViolationTooltip.tsx` | ~150 | Only consumer is dead ShieldOverlay |
| S2.9 | [ ] | [GLASS.1] | `src/components/ui/AgentDashboard.tsx` | ~400 | Not mounted; `agents` tab not in RightTab type |
| S2.10 | [ ] | [GLASS.1] | `src/components/ui/AgentSettingsModal.tsx` | ~200 | Only imported by dead AgentChatPanel |
| S2.11 | [ ] | [GLASS.1] | `src/components/ui/AgentChatPanel.tsx` | ~300 | Architectural violation (chat in Glass); not mounted |
| S2.12 | [ ] | [GLASS.1] | `src/components/ui/ActivityFeed.tsx` | ~250 | Polls nonexistent `activity-log.jsonl`; superseded by `useMCPEventListener` |
| S2.13 | [ ] | [NEW] | `src/components/editor/ImportAuditToast.tsx` | ~80 | Superseded by ImportSummary |
| S2.14 | [ ] | [GLASS.1] | `src/components/ui/DiffCard.tsx` | ~150 | Only consumer is dead AgentChatPanel |
| S2.15 | [ ] | [NEW] | `src/components/ui/Layout.tsx` (Stack) | ~60 | Zero consumers; broken dynamic Tailwind |
| S2.16 | [ ] | [KNOWN] | `src/components/ui/PolicySettings.tsx` | 999 | Not imported in any production component |
| S2.17 | [ ] | [KNOWN] | `src/components/ui/RecoveryPanel.tsx` | ~400 | Not mounted; TODO says "Will move to Command Palette" |
| S2.18 | [ ] | [NEW] | `src/components/inspector/TokenSelect.tsx` | ~100 | Superseded by primitives.tsx |
| S2.19 | [ ] | [GLASS.1] | `src/hooks/useUnifiedViolations.ts` | ~120 | No consumers |

**Result (2026-03-28):** 16 of 19 files deleted + 10 associated test files = 26 files, **8,442 lines removed**. 3 files kept:
- S2.14 DiffCard.tsx — actively imported by FixPreviewDrawer.tsx
- S2.15 Layout.tsx — actively imported by PropertiesPanel.tsx
- S2.16 PolicySettings.tsx — referenced by FixPreviewDrawer.tsx

CLAUDE.md module status table updated. Deleted modules marked with deletion reason and replacement notes.

---

## Sprint 3 — Vocabulary Normalization

**Replace developer/internal jargon with designer language throughout Glass.**

| # | Status | Tag | Item | File(s) | Complexity |
|---|--------|-----|------|---------|-----------|
| S3.1 | [x] | [KNOWN] | "Drift Detection" → "Color Alignment"; "systemizable" → "auto-fixable"; empty state "no match" → guidance | `DriftDetector.tsx` | Trivial |
| S3.2 | [x] | [KNOWN] | deltaE label: number is secondary, human-readable label is primary. `"deltaE 3.2"` → `"Minor drift · ΔE 3.2"` | `DriftDetector.tsx` | Trivial |
| S3.3 | [x] | [KNOWN] | Promote GovernanceDashboard trend hint from `text-[10px] text-zinc-600` to visible text | `GovernanceDashboard.tsx` | Trivial |
| S3.4 | [x] | [KNOWN] | Replace "AST mutation reversed/reapplied" toasts with designer language: "Change undone" / "Change reapplied" | `NotificationCenter` | Trivial |
| S3.5 | [x] | [NEW] | "Raw Attributes" → "Element Properties" in PropertiesPanel | `PropertiesPanel.tsx:641` | Contained |
| S3.6 | [x] | [NEW] | ClassBuilder autocomplete: Tailwind class de-emphasized to `text-zinc-600` (token name stays primary) | `primitives.tsx` | Contained |
| S3.7 | [x] | [NEW] | Tag badges in LayerTree: `opacity-0 group-hover:opacity-100` | `LayerTree.tsx` | Trivial |
| S3.8 | [x] | [NEW] | Removed "Server: Running/Stopped" row from Figma popover | `StatusBar.tsx` | Trivial |
| S3.9 | [x] | [KNOWN] | "MCP" → "Flint" in StatusBar indicator label and aria-labels | `StatusBar.tsx` | Trivial |
| S3.10 | [x] | [KNOWN] | Already done — ExportModal uses "Design System Violations" (EDU-12); StatusBar gateLabel uses "Design Drift Issues" | verified | Trivial |
| S3.11 | [x] | [KNOWN] | ΔE copy already uses human-readable labels in DriftDetector; ExportModal uses "Design System Violations" | verified | Trivial |
| S3.12 | [x] | [KNOWN] | "Delta Mode" badge → "New Issues Only" in GovernanceDashboard | `GovernanceDashboard.tsx` | Trivial |
| S3.13 | [x] | [KNOWN] | "Property overrides active" → "Manual Style Overrides active" in GovernanceDashboard | `GovernanceDashboard.tsx` | Trivial |
| S3.14 | [x] | [KNOWN] | "DTCG JSON" → "Token File (JSON)" in TokenManager | `TokenManager.tsx` | Trivial |
| S3.15 | [x] | [KNOWN] | Already done — right sidebar Governance tab already uses BarChart2; no Health/ShieldCheck collision | verified | Trivial |
| S3.16 | [x] | [KNOWN] | Already done — Scope tab removed from right sidebar; Layers import cleaned up | `App.tsx` | Trivial |
| S3.17 | [x] | [KNOWN] | Planned rules hidden by default behind "Also coming ▸" collapsible in GovernancePanel | `GovernancePanel.tsx` | Trivial |
| S3.18 | [x] | [KNOWN] | Already done — EDU-07 tab subtitles already present as visible paragraphs below tab bar | verified | Trivial |
| S3.19 | [x] | [KNOWN] | "L42" line number in PropertiesPanel header: hover-only. LayerTree jump-to-source already hover-only | `PropertiesPanel.tsx` | Trivial |

## Sprint 3 — Vocabulary Normalization (COMPLETE — 2026-03-29)

Glass: 77/77 passing | TSC: 0 errors

---

## Sprint 4 — Zone Hierarchy (COMPLETE — 2026-03-29)

**Fix which areas of Glass own which authority. Governance signals in governance zones.**

| # | Status | Tag | Item | File(s) | Complexity |
|---|--------|-----|------|---------|-----------|
| S4.1 | [x] | [NEW] | Demote SyncStatus green glow — verified absent, test added | `StatusBar.tsx` | Trivial |
| S4.2 | [x] | [NEW] | Order StatusBar: Export Gate → Figma → Flint → Connect IDE → others | `StatusBar.tsx` | Moderate |
| S4.3 | [x] | [NEW] | Remove FileExplorer from Glass left panel | `App.tsx` | Trivial |
| S4.4 | [x] | [GLASS.1] | A11y violation indicators in LayerTree (`ShieldAlert` beside Mithril badge) | `LayerTree.tsx` | Moderate |
| S4.5 | [x] | [KNOWN] | "Add note" affordance in AnnotationList with inline composer | `AnnotationList.tsx` | Contained |
| S4.6 | [x] | [GLASS.1] | Fix SetupWizard double-overlay — removed outer App.tsx wrapper | `App.tsx` | Contained |
| S4.7 | [x] | [NEW] | Removed traffic-light dots and "Live Preview · srcdoc Engine" label | `XYCanvas.tsx` | Trivial |
| S4.8 | [x] | [NEW] | LeftTab type already fixed in S1.17 | `canvasStore.ts` | Trivial |
| S4.9 | [x] | [NEW] | Toast severity policy: Critical=persistent, Error=8s, Warning=5s, Info=3s, Undo=5s | `notificationStore.ts` | Contained |
| S4.10 | [x] | [KNOWN] | Right panel tab order: governance → properties → tokens (already correct) | `App.tsx` | Trivial |
| S4.11 | [x] | [KNOWN] | Activity feed empty state in GovernanceDashboard | `GovernanceDashboard.tsx` | Contained |
| S4.12 | [x] | [KNOWN] | Scope tab empty state updated | `ComponentScopePanel.tsx` | Contained |
| S4.13 | [x] | [KNOWN] | Tokens tab empty state updated | `TokenManager.tsx` | Contained |
| S4.14 | [x] | [KNOWN] | Export Gate click when blocked → `setRightTab('governance')` not `'properties'` | `StatusBar.tsx` | Trivial |
| S4.15 | [x] | [KNOWN] | Right panel context switching already implemented (OPP-16 useEffect) | `App.tsx` | Moderate |

**Glass: 78/78 passing | 1455/1455 tests | TSC: 0 errors**

---

## Sprint 5 — Governance Comprehension (COMPLETE — 2026-03-29)

**Make governance understandable and actionable, not just visible.**
*(Items from GOVERNANCE-UX-REVIEW.md not captured in prior sprints)*

Glass: 78/78 passing | 1461/1461 tests | TSC: 0 errors

| # | Status | Tag | Item | File(s) | Complexity |
|---|--------|-----|------|---------|-----------|
| S5.1 | [x] | [KNOWN] | Health score zero-state: when `tokenStore.tokens.length === 0`, show "Governance score requires design tokens" instead of 100/A | `GovernanceDashboard.tsx` | Contained |
| S5.2 | [x] | [KNOWN] | Health score formula: replace penalty weight labels with action-framing ("Fixing these would raise your score by X pts") | `GovernanceDashboard.tsx` | Trivial |
| S5.3 | [x] | [KNOWN] | Add clickable rows to GovernanceDashboard "Top Violated Rules" list — row click navigates to filtered violations | `GovernanceDashboard.tsx` | Moderate |
| S5.4 | [x] | [KNOWN] | "Fix All (N)" button when 2+ auto-fixable violations — calls `editorStore.applyBatch` with all fixable tokens | `GovernanceDashboard.tsx` | Contained |
| S5.5 | [x] | [KNOWN] | Add Defer action to violation rows; Override uses existing recordOverride IPC | `GovernanceDashboard.tsx` | Moderate |
| S5.6 | [x] | [KNOWN] | Rule descriptions in GovernancePanel rule rows (RULE_DESCRIPTIONS map + inline rendering) | `GovernancePanel.tsx` | Contained |
| S5.7 | [x] | [KNOWN] | Save vs. auto-apply: amber banner + Save(N) count badge on Rules tab; "no Save required" on Packs/Profiles | `GovernancePanel.tsx` | Trivial |
| S5.8 | [x] | [KNOWN] | "Configure rules" text link in violations footer → opens GovernancePanel | `GovernanceDashboard.tsx` | Trivial |
| S5.9 | [x] | [KNOWN] | Pin button on violation rows — keeps detail panel open (pinnedViolations Set) | `GovernanceDashboard.tsx` | Contained |
| S5.10 | [x] | [KNOWN] | Violation message: changed `truncate` to `line-clamp-2` (2 lines before ellipsis) | `GovernanceDashboard.tsx` | Trivial |
| S5.11 | [x] | [KNOWN] | "Undo this" button on mutation-type activity entries → calls `applyUndo()` | `GovernanceDashboard.tsx` | Contained |

---

## Sprint 6 — Primitive Design System

**Replace the broken primitive layer with a real one that matches Glass's actual theme.**

| # | Status | Tag | Item | File(s) | Complexity |
|---|--------|-----|------|---------|-----------|
| S6.1 | [ ] | [NEW] | Delete or rewrite 6 broken `ui/` primitives (slate/white theme, zero production imports): Button, Input, TextField, Heading, IconButton, SelectField | `src/components/ui/` | Contained |
| S6.2 | [ ] | [NEW] | Create `Badge` primitive to replace 59+ inline `text-xs px-1.5` compositions across 23 files | `src/components/ui/Badge.tsx` | Contained |
| S6.3 | [ ] | [GLASS.1] | Create `Modal` primitive with built-in `role="dialog"`, `aria-modal="true"`, FocusTrap, and consistent zinc-900 backdrop | `src/components/ui/Modal.tsx` | Moderate |
| S6.4 | [ ] | [NEW] | Reconcile 3 SwitchToggle implementations into one canonical component | app-wide | Contained |

---

## Sprint 7 — Figma Sync Surface

**The 8 Figma/sync MCP tools have zero Glass UI. The most important sync operations are invisible.**

| # | Status | Tag | Item | File(s) | Complexity |
|---|--------|-----|------|---------|-----------|
| S7.1 | [ ] | [NEW] | Unified Figma connection panel: one entry point for loopback ingestion + Alliance OAuth with explanation of when to use each | new component | Significant |
| S7.2 | [ ] | [NEW] | Per-token sync state badges in TokenManager: "Figma" / "Local" / "Drifted" | `TokenManager.tsx` | Moderate |
| S7.3 | [ ] | [NEW] | Conflict resolution UI for the three-way diff (no Glass surface today) | new component | Significant |
| S7.4 | [ ] | [NEW] | Pull/push buttons in StatusBar Figma popover as minimal first step (before S7.1 is built) | `StatusBar.tsx` ⚠️ | Contained |
| S7.5 | [ ] | [KNOWN] | ActivityFeed governance delta: show "Before: 85/B → After: 70/C" annotation on agent mutations | wherever MCP log renders | Moderate |

---

## Sprint 8 — Canvas Governance

**Spatial violation visibility was killed in GLASS.1 and never replaced. The canvas is dark.**

| # | Status | Tag | Item | File(s) | Complexity |
|---|--------|-----|------|---------|-----------|
| S8.1 | [ ] | [GLASS.1] | Spatial violation signal on canvas: replace killed ShieldOverlay. Options: (a) inline violation dots on node bounding boxes, (b) node outline tinted by health grade, (c) toggle overlay. Requires design decision. | `XYCanvas.tsx` | Significant |
| S8.2 | [ ] | [NEW] | Add explanation tooltip/label to Autopilot "Original/Governed" toggle | `LivePreview.tsx` | Trivial |
| S8.3 | [ ] | [KNOWN] | MRS pending approval state visible in governance surfaces (pending high-risk mutation should show in GovernanceDashboard) | `GovernanceDashboard.tsx`, `GovernanceOverlay.tsx` | Moderate |

---

## Test Protocol (Every Sprint Item)

Per CLAUDE.md testing standard, every implementation task must:

1. Write tests for all new/changed behavior
2. Run the full test suite:
   ```
   cd flint-mcp && npm test       # MCP engine
   npm run test:react             # Glass components
   npm test                       # Core/Electron
   ```
3. Run `npx tsc --noEmit` — must be 0 errors
4. Report in this format:
   ```
   MCP:   X/X passing (N new)
   Glass: X/X passing (N new)
   TSC:   0 errors
   ```

---

## Metrics Summary

| Metric | Current | Target |
|--------|---------|--------|
| Critical bugs | 10 | 0 |
| High priority bugs | 10 | 0 |
| Dead files | 19 | 0 |
| Dead lines | ~5,275–6,275 | 0 |
| Designer vocabulary leaks | 13+ | 0 |
| Missing ARIA surfaces | 6 | 0 |
| Toast systems (should be 1) | 3 | 1 |
| SwitchToggle implementations | 3 | 1 |
| Badge pattern instances w/o primitive | 59+ | 0 |
| Modal backdrops w/o primitive | 7+ | 0 |
| Figma/sync MCP tools w/ zero Glass UI | 8 | 0 |

---

*Single source of truth. Derived from 4 research documents. All findings cross-referenced and de-duplicated. Items tagged [NEW] are net-new discoveries from the 2026-03-28 19-agent audit. Items tagged [KNOWN] were previously documented but not shipped. Items tagged [GLASS.1] are incomplete deliverables from Phase GLASS.*
