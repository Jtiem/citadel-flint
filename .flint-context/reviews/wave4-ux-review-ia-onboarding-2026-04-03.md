# Wave 4 UX Re-Audit: Information Architecture, Onboarding & Language

**Reviewer role:** IA + Onboarding + Language specialist (Reviewer 2, re-audit)
**Date:** 2026-04-03
**Surfaces reviewed:** LaunchScreen, OnboardingOverlay, DemoWalkthrough, SetupWizard, CommandPalette, GovernanceDashboard, FigmaSetupWizard, FigmaConnectionPanel, TokenPanel, ExportModal, App.tsx (shell)
**Previous review:** `wave3-ux-review-ia-onboarding-2026-04-03.md` (grade: B+)
**Overall Grade: A-**

---

## Verdict

The product has moved meaningfully from B+ to A- territory. Nine of the fifteen gaps identified in the previous review have been addressed in code. The GovernanceDashboard — previously the weakest surface at C+ — has undergone a structural redesign that resolves its most critical problem (information overload). The two-zone layout with a collapsed "Developer Controls" section fundamentally changes the first-session experience for non-technical designers. Language fixes across FigmaConnectionPanel, ExportModal, CommandPalette, and SetupWizard are all correctly implemented and improve clarity. The product is not yet at A because six gaps remain unaddressed, and the GovernanceDashboard's "Details" zone — while structurally improved — still presents a dense violation list without a file-level orientation sentence.

---

## Surface-by-Surface Table

| Surface | Previous | Current | Key Finding |
|---------|----------|---------|-------------|
| LaunchScreen | A- | A- | Unchanged. Three-path model, health grades, and demo scenario picker remain strong. "Audit a Folder" is still visually underweighted (GAP-11 not addressed). |
| OnboardingOverlay | B+ | A- | Step 3 body copy rewritten to explain the command palette clearly. MCP-aware branching now shows actionable instructions for both connected and disconnected states. |
| DemoWalkthrough | A- | A- | No changes needed; no regressions. Workspace orientation and handoff steps remain well-crafted. |
| SetupWizard | A | A | "Open your project" CTA on the done step is correct and honest about what happens next. |
| CommandPalette | B+ | A- | "Undo & History" category label is a clear improvement — the word "Undo" appears where users would search for it. |
| GovernanceDashboard | C+ | B+ | Major structural improvement. Two-zone layout resolves the critical IA overload problem. However: no file-specific orientation line, no Delta Mode onboarding tooltip, and zone divider label "Details" is vague. |
| FigmaSetupWizard | A- | A | Step label names the product. Figma Community note added. Troubleshooting section unchanged and excellent. |
| FigmaConnectionPanel | B | A- | "Token Health" header is the right vocabulary for designers. Drifted/Orphaned explanations now always-visible. |
| TokenPanel | B- | B | Empty state now has actionable guidance with a "Connect Figma" CTA. Still carries the "(read-only)" parenthetical (GAP-9 not addressed). |
| ExportModal | A- | A | "Download Compliance Report (.json)" with description is clear. Auto-fixable violations sorted first with "Quickest path to export" banner is excellent triage guidance. |
| App.tsx (shell) | B | B | No changes to shell layout. Governance tab default still shows no shell-level orientation when a project opens. |

---

## Fix Verification (Wave 3 Gaps)

| Gap | Status | Evidence |
|-----|--------|----------|
| GAP-1: GovernanceDashboard IA overload | FIXED | Two-zone layout: Health Summary (lines 1537-1647) + Developer Controls in `<details>` defaulting closed (lines 2549-2985). |
| GAP-2: No project-open orientation | PARTIAL | Effort framing text + Export gate banner provide action orientation but do not name the file or total issue count. |
| GAP-3: TokenPanel empty state | FIXED | Lines 566-587: icon, guidance copy, "Connect Figma" CTA button. |
| GAP-4: "Token Mapping" header | FIXED | Line 306: "Token Health". |
| GAP-5: Orphaned/Drifted explanations | FIXED | Lines 322-328: always-visible descriptions below each count. |
| GAP-6: CommandPalette "History" category | FIXED | Line 63: `git: 'Undo & History'`. |
| GAP-7: OnboardingOverlay Step 3 copy | FIXED | Lines 50-51: explicit command palette reference + top toolbar note. |
| GAP-8: ExportModal DBOM label | FIXED | Line 1032: "Download Compliance Report (.json)" with description. |
| GAP-9: TokenPanel "(read-only)" | NOT FIXED | `(read-only)` parenthetical with title tooltip still present at lines 492-493. |
| GAP-10: FigmaSetupWizard step label | FIXED | Line 333: "Configure Flint plugin in Figma". Line 366-368: Figma Community note. |
| GAP-11: "Audit a Folder" underweighted | NOT FIXED | LaunchScreen still tertiary text-link at `text-zinc-500`. |
| GAP-12: Delta Mode onboarding tooltip | NOT FIXED | No `useOnboardingTooltip` in GovernanceDashboard for Delta Mode. |
| GAP-13: No "what was checked" on 100 score | PARTIAL | Zero-violation state says "Your component meets all governance standards." Does not name the file or counts. |
| GAP-14: SetupWizard "Start building" | FIXED | Line 763: "Open your project". |
| GAP-15: Autopilot no explanation | PARTIAL | Description exists inside Developer Controls but not in CommandPalette where the action is invoked. |

**Score: 9 of 15 gaps fully fixed, 3 partially addressed, 3 not addressed.**

---

## Remaining Gaps (Prioritized)

### P0 — None

No P0 gaps remain.

### P1 — Still degrades clarity for non-technical designers

**GAP-R1: GovernanceDashboard lacks a file-specific orientation sentence**
Effort framing text provides action orientation but does not name the active file. A designer who opened `LoginForm.tsx` sees issues but not the filename.
**Fix:** Prepend the effort framing with the active filename: "LoginForm.tsx — 3 auto-fixable, Autopilot can resolve them in one click."

**GAP-R2: TokenPanel "(read-only)" parenthetical**
Toolbar still shows `{N} tokens (read-only)`. Tells users what they cannot do without explaining why. Tooltip hidden behind title attribute.
**Fix:** Replace with context-aware status badge: "Synced from Figma" when connected, "Imported" when manually loaded.

**GAP-R3: GovernanceDashboard "Details" zone divider label is vague** (new finding)
Zone divider reads "Details" — does not communicate whether this means "details about the score" or "details about each issue."
**Fix:** "Issues to Resolve" when violations exist, or "Audit Results" as a descriptive zone label.

### P2 — Polish

**GAP-R4:** No Delta Mode onboarding tooltip — low urgency since it's behind the Developer Controls collapse.

**GAP-R5:** "Audit a Folder" underweighted on LaunchScreen — still tertiary text-link.

**GAP-R6:** Zero-violation state does not name the file that was audited.

**GAP-R7:** Autopilot description missing from CommandPalette — add subtitle: "Auto-fixes simple design issues while you work."

---

## What Now Hits A+ Quality

**ExportModal (full surface).** Clear verdicts, plain-language explanations, auto-fixable-first sorting, triage banner, "Download Compliance Report (.json)" with description, defer workflow. Every element serves the designer's primary question: "Can I ship this? If not, what do I do?"

**SetupWizard (full surface).** Consent-first, retry logic, skip-at-every-step, honest headline, "Open your project" terminal CTA. No notes.

**FigmaSetupWizard (full surface).** Named product in step label, Figma Community note, excellent troubleshooting section.

**GovernanceDashboard Health Summary zone (zone 1 only).** Score ring, grade letter, effort framing, export gate banner, sub-score breakdowns, "How is this calculated?" collapsible, and next-step coaching sentence answer the designer's primary question in under 5 seconds.

**OnboardingOverlay Step 3.** MCP-aware branching with explicit command palette reference is exactly the right adaptation to context.

---

## Does the GovernanceDashboard Pass as "Health at a Glance"?

**Yes, with qualification.**

Zone 1 is now genuinely scannable in 5 seconds. The Developer Controls collapse is the single most impactful IA fix in this wave — hiding Delta Mode, Provenance, Anomaly alerts, Pending Mutations, Audit Log, Coverage, and Inheritance drops the dashboard's cognitive load by approximately 60% for the primary designer audience.

The qualification: the "Details" zone still presents a dense list without a file-level orientation sentence. The transition from "health at a glance" to "triage workspace" is not explicitly signaled beyond the vague "Details" label.

**GovernanceDashboard grade movement: C+ → B+. Not yet A- because of the missing file-level orientation and the vague zone divider label.**

---

*Grades reflect the current state of the code as read today. The overall A- reflects genuine progress across 9 of 15 gaps, with 6 remaining gaps all at P1 or P2 severity. No P0 gaps remain.*
