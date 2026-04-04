# Flint Glass: Full UX Audit — 6-Reviewer Consensus Report
**Date:** 2026-04-02
**Scope:** Every user-facing surface of Flint Glass
**Core Question:** "Does this deliver value to a UX/UI designer or organization governing AI development?"

---

## OVERALL VERDICT: C

Glass is a technically impressive product with a broken front door. The governance engine, AST surgery, token sync, and export gate are genuinely powerful — but the user-facing experience buries that power behind developer jargon, silent failures, orphaned components, and fragmented onboarding. A designer opening Glass today cannot connect Figma (the button opens the wrong wizard), cannot discover the command palette (no visual indicator exists), and cannot understand violations (they see "MITHRIL-COL-001" instead of "Color doesn't match your palette").

---

## GRADES BY SURFACE

| Surface | Reviewer | Grade | One-Line Verdict |
|---------|----------|-------|-----------------|
| First-Run & Onboarding | R1 | **C-** | 5 overlapping onboarding flows, critical wiring bugs, jargon in first-contact copy |
| Canvas & Preview | R2 | **C+** | Infinite canvas with one object, invisible mode toggle, no hover outlines |
| Governance & Health | R3 | **C+** | Feature-dense but narratively incoherent — 35 useState in one component |
| Figma & Tokens | R4 | **D+** | Two entire components built but never mounted — Figma flow structurally broken |
| Navigation & Discovery | R5 | **C+** | Command palette invisible, 5 keyboard shortcuts total, no "you are here" |
| IDE Bridge & Connectivity | R6 | **C+** | "MCP" jargon everywhere, silent disconnects, "fix in IDE" is a dead end |

---

## TOP 10 FINDINGS (Cross-Reviewer Consensus)

### 1. "Connect Figma" Opens the Wrong Wizard [BLOCKER]
**Found by:** R1, R4, R6 (3/6 reviewers independently confirmed)

`App.tsx` line 791: `onConnectFigma={() => setShowSetupWizardModal(true)}` opens the IDE/MCP SetupWizard, not the FigmaSetupWizard. A designer clicks "Connect Figma" and sees a screen about configuring Claude Code. The FigmaSetupWizard component exists, is well-designed, and has passing tests — but is never imported or rendered in App.tsx.

**Impact:** 100% of users attempting to connect Figma from the LaunchScreen hit a dead end.

### 2. Two Purpose-Built Components Are Dead Code [CRITICAL]
**Found by:** R4

- `FigmaSetupWizard.tsx` — 3-step Figma connection wizard. Never mounted.
- `FigmaConnectionPanel.tsx` — Token mapping, sync history, pull/push. Never mounted.

Both are built, tested, and ready — but have zero runtime import paths. The StatusBar popover is doing the work of both, crammed into a 300px dropdown.

### 3. Developer Language in a Designer Tool [CRITICAL]
**Found by:** All 6 reviewers

| Term in UI | What a designer sees | Should say |
|---|---|---|
| "MCP connected" | Unknown acronym | "Connected to your editor" |
| "MCP Audit Complete" | Unknown acronym | "Audit complete" |
| "MITHRIL-COL-001" | Unknown code | "Color doesn't match your palette" |
| "Delta-E threshold" | Math jargon | "color difference limit" |
| "AST surgery" | Developer jargon | "automated code changes" |
| "ingestion server" | Infrastructure term | "Figma receiver" |
| "127.0.0.1:4545" | IP address | Never show this to a designer |
| "W3C DTCG" | Standards body acronym | "design token format" |
| "orphaned tokens" | Developer term | "removed from Figma" |
| "Tier-1 drift" | Internal classification | "simple design issues" |
| "flint-manifest.json" | Filename | "component registry" |

### 4. Five Onboarding Mechanisms With No Orchestrator [HIGH]
**Found by:** R1, R5

| Mechanism | Trigger | Can co-occur? |
|-----------|---------|---------------|
| DemoWalkthrough | First launch + demo auto-load | YES — with OnboardingOverlay |
| OnboardingOverlay | First project open (localStorage) | YES — with DemoWalkthrough |
| OnboardingNudge | Fresh scaffold + 1 file + 0 tokens | YES — with above |
| TabUnlockTooltip | Tab first appears (progressive) | YES — with above |
| useOnboardingTooltip | Feature first used (localStorage) | YES — with above |

On first launch, a user can see DemoWalkthrough Step 0 AND OnboardingOverlay Step 1 simultaneously. No mutual exclusion exists. Each checks its own independent localStorage key.

### 5. Command Palette Is Invisible [HIGH]
**Found by:** R5

Cmd+K opens a well-built command palette with 12 commands + registry search. But there is zero visual indicator anywhere in the UI that it exists — no search icon, no hint text, no onboarding mention. A mouse-first designer will never find it. Additionally, Cmd+K is the VS Code convention — Figma uses Cmd+/ for quick actions.

### 6. StatusBar Information Overload [HIGH]
**Found by:** R2, R6

12+ possible chips in a 32px strip: Export Gate, Figma status, MCP status, Connect IDE, Demo indicator, Breakpoint, Scratchpad, Autopilot, Autopilot fix count, Beta chip, Auto-update, Sync status. The Export Gate — the single most important signal ("can I ship?") — gets equal visual weight with beta build indicators and localhost IP addresses.

### 7. Infinite Canvas Hosts One Object [MEDIUM-HIGH]
**Found by:** R2

The canvas uses `@xyflow/react` with MiniMap, zoom controls, and dot grid — but displays exactly one node (the LivePreview iframe). The infinite-canvas affordances create spatial expectations that are never fulfilled. Drag-to-reposition the only object on an infinite plane has no utility.

### 8. No "Fix Flow" Narrative [MEDIUM-HIGH]
**Found by:** R3, R6

The path from "violation detected" to "violation resolved" touches 5 components (GovernanceDashboard, ExportModal, FixPreviewDrawer, NotificationCenter, StatusBar) but has no connecting thread. Each component speaks independently. There is no guided "3 issues found → Fix 2 automatically → 1 needs your input → Review fix → Export ready" flow.

### 9. Silent Disconnect = Silent Degradation [MEDIUM]
**Found by:** R6

When MCP disconnects mid-session:
- StatusBar shows identical "Flint" text (connected and disconnected use the same string)
- useMCPEventListener silently stops receiving events
- GovernanceDashboard still says "fix it in your IDE" (impossible without connection)
- No banner, no notification, no indication that governance stopped working

### 10. Export Gate Pass Serves Developers, Not Designers [MEDIUM]
**Found by:** R3

When all violations are cleared and export is ready, the modal shows raw JSX source code with a "Copy to clipboard" button. A designer who just resolved governance issues wants to know "what happens next?" — not to read `<div className="flex items-center gap-2">`. No post-export guidance exists (commit? deploy? hand off?).

---

## WIRING BUGS (Confirmed by Code Review)

| Bug | Severity | File | Line |
|-----|----------|------|------|
| "Connect Figma" opens IDE SetupWizard | BLOCKER | App.tsx | 791 |
| FigmaSetupWizard never imported/rendered | CRITICAL | App.tsx | — |
| FigmaConnectionPanel never imported/rendered | CRITICAL | App.tsx | — |
| DemoWalkthrough + OnboardingOverlay render simultaneously | HIGH | App.tsx | 1137-1149 |
| `onNewProject` prop declared but never used in UI | MEDIUM | LaunchScreen.tsx | 59 |
| `onDemoSelect` not passed from App.tsx to LaunchScreen | MEDIUM | App.tsx | — |
| DemoWalkthrough Step 1 hardcodes "8 issues" | MEDIUM | DemoWalkthrough.tsx | 52 |
| StatusBar "Flint" text identical for all connection states | MEDIUM | StatusBar.tsx | 736 |
| `healthScore: null` always in context sync | LOW | useContextSync.ts | — |
| Auto-load demo failure doesn't set `demoLoadError` | LOW | App.tsx | 638 |

---

## CROSS-CUTTING THEMES

### Theme A: The Product Speaks Engineer, Not Designer
Every reviewer flagged jargon. The product was clearly built by engineers who deeply understand the domain but forgot that the audience doesn't share that vocabulary. "Mithril," "Delta-E," "MCP," "DTCG," "AST," "ingestion" — these terms appear in first-contact surfaces where a designer forms their opinion of the product.

### Theme B: Features Were Built But Never Assembled
FigmaSetupWizard and FigmaConnectionPanel are the most visible examples, but the pattern repeats: individual components are well-tested in isolation, but the App.tsx orchestration that connects them is incomplete or incorrect. The product has more capabilities than it exposes.

### Theme C: No Single Source of "What Should I Do Next?"
After detection, after Figma sync, after export pass, after first launch — the user is consistently left without guidance. Every milestone ends with silence instead of a next step.

### Theme D: Progressive Disclosure Is Applied to Panels But Not to Feature Density
The tab-unlock system (Phase PD) is well-designed. But within each tab, every feature is visible at once. GovernanceDashboard has ~35 pieces of state and anomaly banners, sparklines, provenance chips, delta mode, audit logs, pending mutations — all in one panel. Progressive disclosure should apply within panels, not just to panels.

### Theme E: The StatusBar Is a Junk Drawer
What started as a focused export-gate indicator has accumulated 12+ chips. It now serves governance, connection management, Figma sync, responsive preview, auto-update, beta feedback, and more. The primary signal is lost.

---

## COMPONENT GRADES (All Reviewers)

| Component | Grade | Reviewer |
|-----------|-------|----------|
| DetectionBanner | A- | R2 |
| FixPreviewDrawer | A- | R3 |
| TokenDetailView | B+ | R4 |
| GovernancePanel | B+ | R3 |
| NotificationCenter | B+ | R3 |
| LayoutPanel | B+ | R5 |
| Progressive Disclosure System | B+ | R5 |
| useContextSync | B+ | R6 |
| canvasStore | B+ | R2 |
| editorStore | B+ | R2 |
| ComponentPanel | B+ | R5 |
| LaunchScreen | B+ | R1 (layout good, wiring broken) |
| SetupWizard | B | R1, R6 |
| CommandPalette | B | R5, R6 |
| TokenPanel | B | R4 |
| ExportModal | B | R3, R6 |
| StatusBar | B/D+ | R2 (D+), R3 (B), R6 (B) — split verdict |
| App.tsx (layout) | B- | R2, R5 |
| App.tsx (wiring) | F/C | R4 (F for Figma), R1 (C overall) |
| LivePreview | B- | R2 |
| FigmaSetupWizard | B- | R4 (good component, never mounted) |
| AnnotationList | B- | R5 |
| useMCPEventListener | C/B | R3 (B), R6 (C) |
| DemoWalkthrough | C | R1 |
| XYCanvas | C | R2 |
| FigmaConnectionPanel | C+ | R4 (good concept, never mounted) |
| GovernanceDashboard | C | R3 |
| OnboardingOverlay | D+ | R1, R5 |
| Figma wiring (App.tsx) | F | R4 |

---

## PRIORITY RECOMMENDATIONS

### P0 — Fix Before Next User Sees This

1. **Wire FigmaSetupWizard into App.tsx.** Add `showFigmaWizardModal` state. Change `onConnectFigma` to render FigmaSetupWizard. One-file fix.
2. **Mount FigmaConnectionPanel.** Either as a right sidebar tab or replace the StatusBar Figma popover contents.
3. **Add mutual exclusion between DemoWalkthrough and OnboardingOverlay.** If demo is loaded, suppress the overlay.
4. **Replace "MCP" with "Flint" in all user-facing strings.** ~15 locations across 5 files.
5. **Differentiate StatusBar connection text.** "Flint (active)" / "Flint (offline)" / "Connecting..."

### P1 — Fix Before Showing to Designers

6. **Rewrite all Citadel/jargon terms in user-facing copy.** "Mithril" → "design system check," "Delta-E" → "color difference," etc.
7. **Add search icon + "Cmd+K" hint to header.** One component, makes the command palette discoverable.
8. **Add Cmd+/ as alias for command palette.** Figma convention.
9. **Restructure StatusBar into zones.** Primary (Export Gate), Secondary (violations + sync), Tertiary (everything else collapsed).
10. **Add non-modal reconnection banner on MCP disconnect.**

### P2 — Fix Before Public Launch

11. **Split GovernanceDashboard.** Primary surface: health score + violation list + fix buttons. Everything else behind "More details."
12. **Add "Start here" triage to violation list.** Highlight the highest-impact auto-fixable issue.
13. **Replace raw JSX in export-pass state.** Show confirmation + "What's next?" guidance.
14. **Gate "fix in IDE" prompts on connection state.** Don't tell users to talk to their IDE if no IDE is connected.
15. **Add post-Figma-sync guidance.** Auto-switch to Tokens tab, show one-time banner.
16. **Consolidate onboarding into one orchestrator.** Single state machine that sequences all 5 mechanisms.
17. **Add hover outlines in Design mode.** When hovering elements with `data-flint-id`, show selection affordance.
18. **Add a "why" step to SetupWizard.** Explain Glass↔IDE relationship before asking which IDE.
19. **Unify connections into one panel.** IDE + Figma + engine status in a single "Connections" view.
20. **Replace node IDs with human-readable names everywhere.** Extract `getNodeName()` to shared utility.

---

## FILES REVIEWED (Across All 6 Reviewers)

- `src/App.tsx`
- `src/components/ui/LaunchScreen.tsx`
- `src/components/ui/DemoWalkthrough.tsx`
- `src/components/ui/OnboardingOverlay.tsx`
- `src/components/ui/OnboardingNudge.tsx`
- `src/components/ui/SetupWizard.tsx`
- `src/components/ui/FigmaSetupWizard.tsx`
- `src/components/ui/FigmaConnectionPanel.tsx`
- `src/components/ui/GovernanceDashboard.tsx`
- `src/components/ui/GovernancePanel.tsx`
- `src/components/ui/ExportModal.tsx`
- `src/components/ui/FixPreviewDrawer.tsx`
- `src/components/ui/NotificationCenter.tsx`
- `src/components/ui/CommandPalette.tsx`
- `src/components/ui/ComponentPanel.tsx`
- `src/components/ui/AnnotationList.tsx`
- `src/components/ui/DetectionBanner.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/TabUnlockTooltip.tsx`
- `src/components/ui/token/TokenDetailView.tsx`
- `src/components/ui/token/TokenPanel.tsx`
- `src/components/ui/token/TokenApprovalStaging.tsx`
- `src/components/ui/token/TokenTabBadge.tsx`
- `src/components/editor/XYCanvas.tsx`
- `src/components/editor/LivePreview.tsx`
- `src/components/editor/StatusBar.tsx`
- `src/components/inspector/LayoutPanel.tsx`
- `src/store/canvasStore.ts`
- `src/store/editorStore.ts`
- `src/store/tokenStore.ts`
- `src/hooks/useContextSync.ts`
- `src/hooks/useMCPEventListener.ts`
- `src/hooks/useOnboardingTooltip.ts`
- `docs/strategy/FEATURE-BUDGET-FRAMEWORK.md`
- `docs/JOURNEY-MAPS.md`

---

**Session End:** 2026-04-02 / 6-Reviewer Consensus Sign-Off
