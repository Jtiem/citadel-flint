# Mint UX Review — 2026-04-17

**Reviewer:** flint-ux-critic
**Scope:** TokenManager + TokenPanel + TokenHealthBar + TokenGrid + TokenDetailPanel + token/ subtree + useTokenUsage + tokenStore, plus wiring in App.tsx and ExportModal.tsx
**Reviewer context:** Mint is 4 sprints / 18 tasks. MINT.1 shipped (graded SHIP 2026-04-11). Current state reflects MINT.1 through MINT.4 partial.

---

## Grade: B-

This is not a D and not an A. Mint has genuinely moved past the flat CRUD list — health bar, grid view, swatch fidelity, approval staging, first-sync prompt, contrast auditor, and detail panel are all present. The diagnosis is being answered.

But the B- is earned by three structural defects any designer hits within 90 seconds:

1. **Two parallel token surfaces in the codebase** — `TokenManager.tsx` (mounted) and `TokenPanel.tsx` (orphaned, with its own satellite subtree)
2. **The drift story is dead code** — `useTokenUsage.ts:84` admits "DISABLED 2026-04-12" due to a render loop. `setDriftedTokens` is never called. Consequences cascade through the whole drift narrative.
3. **Brilliant Moment 4 (Pre-Export Emission Check) is unwired** — `ExportModal` UI exists but `App.tsx:1383` mounts without passing `pendingTokenCount`

---

## Critical Issues (block a designer's job)

### C1. Drift detection is disabled end-to-end — Brilliant Moments 2 + 3 are inert

`src/hooks/useTokenUsage.ts:84-92` comment states drift "DISABLED 2026-04-12" due to a render loop. Every consumer is affected:

- `TokenManager.tsx:319-321` reads `driftedTokens`, `driftCount` — always `[]` and `0`
- `TokenHealthBar` `{driftCount} drifted` pill — always hidden
- `TokenManager.tsx:457` `pendingDriftWarnings` — always empty Set → ApprovalStagingArea's "Drift risk" badge never renders
- `App.tsx:192` `tabDriftCount = 0` always — Tokens-tab amber dot + `(N)` count never render

There IS a second, partially-working drift signal in `TokenManager.tsx:340-346` (`getSyncStatus` comparing `figmaTokens` Map against local). The health bar therefore has TWO drift sources — one live, one dead — that can disagree.

**Fix:** Either re-enable the hook's drift IPC, or refactor `TokenManager`'s working comparison into the hook so all consumers share one source. **P0**.

### C2. Two token surfaces coexist

`TokenManager.tsx` is mounted at `App.tsx:1306`. `TokenPanel.tsx` is a parallel implementation with its own `TokenDetailView`, `useContrastAudit` hook, import modal, test file, and approval staging — all unreachable. Evidence this is a fork, not a migration:

- Mounted: `TokenGroupSection` → `TokenDetailPanel.tsx` (top-level)
- Orphan: `ColorGrid.tsx` / `TypographySpecimen.tsx` / `SpacingRuler.tsx` → `TokenDetailView.tsx` (in `token/`)
- Mounted: `ApprovalStagingArea.tsx` (top-level)
- Orphan: `TokenApprovalStaging.tsx` (in `token/`)

**Fix:** Delete `TokenPanel.tsx`, its test, `token/TokenDetailView.tsx`, `token/TokenApprovalStaging.tsx`, and any subcomponents only `TokenPanel` imports. Pure dead-code removal. **P0**.

### C3. Pre-export emission check is a prop drop

`ExportModal.tsx:98-103` accepts `pendingTokenCount?: number`. MINT.4b row (lines 496–540) renders three states keyed on the prop. `App.tsx:1383` mounts `<ExportModal onClose={…}/>` — prop never supplied. Status permanently "Not configured" for every real user.

**Fix:** Three lines in App.tsx — fetch `getPendingApprovals()` when modal opens, pass `pendingTokenCount`. **P0**.

### C4. FirstSyncPrompt rendered inside the tab it's supposed to attract users to

`TokenManager.tsx:535-545`: prompt renders inside Tokens tab body. CTA `onNavigateToTokens` calls `scrollEl?.scrollTo({ top: 0 })` on the already-visible scroll container. Designer only sees the prompt after navigating to Tokens — defeating the purpose.

**Fix:** Elevate to global banner or StatusBar with cross-panel CTA, or use Tokens-tab amber dot as the pull mechanism. **P1**.

---

## Improvements for A+ (priority order)

1. **Unify drift computation.** Pick one source (the hook is architecturally cleaner). Re-enable the Figma drift readFile via a dedicated IPC. Wire into App.tsx, TokenHealthBar, TokenManager. Delete redundant `syncStatuses`-based pill. (Fixes C1.)
2. **Delete `TokenPanel.tsx` and satellite subtree.** Keep only components reachable from `TokenManager`. (Fixes C2.)
3. **Wire `pendingTokenCount` into ExportModal.** (Fixes C3.)
4. **Elevate FirstSyncPrompt out of Tokens tab.** Either App-shell banner or use tab amber dot. Make `onNavigateToTokens` actually switch `rightTab` to `'tokens'`. (Fixes C4.)
5. **Decide Mint's information hierarchy.** When pending > 0, ApprovalStagingArea should render FIRST (above HealthBar or at least above search). Today it appears below a full screen of chrome.
6. **`TokenTabBadge.tsx` is dead code — delete or wire it.** App.tsx has its own inline `displayLabel = 'Tokens (N)'` instead.
7. **`hasMultipleModes()` in `TokenGrid.tsx:666-673` still returns false unconditionally** — flagged in MINT.1 review for MINT.2, never fixed. "No dark mode" amber dot never renders.
8. **Health bar density.** Up to 6 pills wraps to two rows on narrow sidebar. Consider Counsel's CompactScoreSummary collapse pattern.
9. **Cross-tab vocabulary drift.** Counsel = critical/amber/advisory. Mint = drifted/dead/contrast/scale-gap. Add severity grammar to Mint pills for cross-tab coherence.
10. **ApprovalStagingArea visual weight.** Approve/Reject buttons use single-character icons — too dense at 5+ pending tokens. Consider checkbox-select + bulk approve flow.
11. **ContrastAuditPanel positioning.** Currently a panel-that-covers-the-list. Inline contrast badges (already supported via `contrastMap` + `getBestContrastGrade`) are the 80% case. Invert priority: inline-by-default, panel-on-demand.
12. **Empty state.** When tokens.length === 0, offer "Connect Figma" primary + "Import JSON" secondary. Today shows only Import.
13. **Provenance visibility buried.** TokenDetailPanel doesn't show source ("From Figma variable X, first synced 2 days ago") or last-modified. Data exists in `token_source` SQLite table.
14. **"Unused" (ColorGrid) vs "Dead" (TokenGrid) — pick one word.** Strategy uses "Dead."
15. **SYNC-002 orphan visibility.** No "Orphaned in Figma" badge for tokens present in Figma but not in project.

---

## What works brilliantly

- **Swatch grid + specimens beautiful** — ColorSwatchLarge/Small, DimensionRuler, TypographySpecimen, ShadowSwatch, OpacitySwatch (using indigo base to show effect), MotionPreview with CSS animation
- **ScaleGapWarning is clever** — inferring expected step from mode of sorted deltas, flagging gaps > 1.5x. No competitor ships this. Brilliant-Moment-worthy in its own right.
- **MINT.1 a11y foundation survived** — every sub-component has aria-labels, roles, FocusTrap on modals, keyboard parity (Enter/Space)
- **TokenRow + TokenGridCard keyboard parity** with mouse — designer-grade
- **ApprovalStagingArea distinguishes per-row from bulk processing** via separate `processingSet` and `isBulkProcessing` — avoids "all buttons disabled while one row processes" smell
- **ContrastAuditPanel "Aa" preview swatch** painting fg on bg is exactly the right primitive
- **`getBestContrastGrade` reduces many pairs to one badge per token** — right primitive for inline display

---

## Five Brilliant Moments — status check

| # | Moment | Status | Evidence |
|---|--------|--------|----------|
| 1 | First-Sync Prompt | **Shipped, mispositioned** | Prompt renders inside Tokens tab — only visible to designers already there. Per-project dismissal works. See C4. |
| 2 | Approval with Drift Warning | **Stub** | UI built; data never arrives. `driftWarnings` Set always empty due to dead drift pipeline. |
| 3 | Silent Drift Badge | **Stub** | Tab-level wiring at App.tsx:1241-1272 is live for dead data. `tabDriftCount` always 0. |
| 4 | Pre-Export Emission Check | **Stub** | UI built; `pendingTokenCount` prop never passed from App.tsx:1383. Always "Not configured." |
| 5 | Orphan Cleanup Nudge | **Shipped** | Dead-token badge per-row in TokenGrid + ColorGrid. Tooltip + filter wired. The one moment genuinely alive today. |

**Summary:** 1 shipped cleanly, 1 shipped mispositioned, 3 stubs (UI built, data never arrives).

---

## Questions for Justin

1. **Re-enable drift in MINT.5, or defer to Envoy?** If Envoy, mark M2/M3 "deferred to Envoy" and delete the dead `useTokenUsage.setDriftedTokens` code. If Mint, re-enable is P0.
2. **Is `TokenPanel.tsx` paused or abandoned?** Both files existing is unsafe.
3. **Is "drift" vocabulary intentionally different from Counsel's severity grammar?**
4. **Is ApprovalStagingArea the authoritative approval queue, or does `flint_approve_tokens` via chat work in parallel?**
5. **Is `scaleGapCount` the right top-level pill, or should drift take that prominence?**

---

## Cross-Tab Coherence with Counsel

- **Severity grammar:** Counsel critical/amber/advisory vs Mint drifted/dead/contrast/scale-gap — same colors mean different things. Adopt Counsel's grammar primary, kind-of-thing secondary.
- **Density:** Counsel was "edge of overwhelming"; Mint simpler but health bar can wrap to 2 rows.
- **Health score formulas:** Counsel had FOUR competing formulas (critical defect). Mint has no numeric score — pills only. **Keep it that way.** Don't introduce a "Mint health score" without unifying with Counsel first.
- **Detail panel pattern:** Both slide from right, FocusTrap, X/Escape close. Match widths exactly for visual rhythm.

---

## Brilliant or boring?

Two clever moments worth highlighting:
- **Scale gap inference** from mode of sorted step deltas — Flint-native, no competitor ships it
- **Inline mode columns in `TokenGridCard`** — Light + Dark swatch adjacent with values below, half the space of Figma Variables

The rest is competent. ContrastAuditPanel well-built but not clever. ApprovalStagingArea well-built but generic. Overall: serious attempt at the governance vision, held back by three wiring defects.

---

## Concise summary

**Grade: B-**

Mint moved past CRUD list — swatches, specimens, mode columns, approval staging, contrast audit, detail panel, health bar, scale-gap inference all ship. Three structural defects block A-range:

1. **Drift detection dead end-to-end** — `useTokenUsage.ts:84` admits disabled 2026-04-12. Brilliant Moments 2 + 3 are stubs. Health bar carries 2 disagreeing drift pills.
2. **Two parallel token surfaces** — `TokenManager.tsx` (mounted) + `TokenPanel.tsx` (orphaned). Next contributor edits the wrong one.
3. **Pre-export emission check (BM4) unwired** — 3-line fix in App.tsx.

**Brilliant Moments status:** M1 shipped-mispositioned, M2 stub, M3 stub, M4 stub, M5 shipped.

With C1–C3 fixed, Mint reaches A- on already-shipped work. ScaleGapWarning + inline mode columns are the two cleverest moments — no competitor ships them.

---

# Mint UX Review (Second Pass) — 2026-04-17

Reviewer: design-experience agent (Opus 4.7)
Purpose: Independent read to confirm or extend the flint-ux-critic review above. Focuses on the "observability-first" target and the 4 designer jobs-to-be-done from Justin's evaluation brief.

## Provisional grade: B−

I reach the same grade as the first reviewer but via a different reasoning path and with additional findings. The first review is sharp on code-level defects (duplicate surface, disabled drift, unwired BM4). This pass adds the cross-surface coherence, sync lifecycle, and emit-path gaps that kept coming up when I tried to simulate "a designer lands here and wants to [job]."

## Top three additive findings (not covered above)

### A1. TokenHealthBar does not use the canonical health formula
`TokenHealthBar` renders 2-5 pills but never imports `shared/healthScore.ts`. There is no score, no letter grade, no single-number trust statement. Counsel hero-renders an A-F ring; Mint renders scattered counts. A designer moving between them sees two different health languages for the same project. This is the exact cross-surface drift the canonical health module (CHRON.1-repair / C2) was built to prevent — Mint is the surface that still violates it.

Fix: a `useTokenHealth()` hook that buckets {dead, drifted, scale-gaps, contrast-fails, pending-conflicts} into `{criticalCount, amberCount, advisoryCount, overrideCount}` and feeds `computeHealthScore`. Render the A-F grade as the leading element; keep the breakdown pills after it.

### A2. No sync actions live in Mint (Envoy/Alliance are invisible here)
Job 2 in Justin's list is "resolve drift" — but there is no Pull, Push, Resolve, or Connect Figma button anywhere in TokenManager. The empty state says "Connect Figma or import a tokens JSON file" and the only button is Import JSON. Drift badges render as scolds with no path to action. `flint_sync_pull`, `flint_sync_push`, `flint_resolve_all`, and `flint_figma_connect` all exist in MCP. None of them reach Mint.

Fix: three buttons in the health bar when Figma is connected (Pull, Push, Resolve); swap the empty-state CTA so "Connect Figma" is primary and "Import JSON" is secondary; route "Connect Figma" through Alliance OAuth.

### A3. Emit / map is entirely missing from Mint (Job 4 broken)
The MCP tools `flint_emit_tokens` (Tailwind, CSS, React Native, Swift, Kotlin) and `flint_map_tokens` (shadcn, MUI, PrimeNG) have zero entry point in Mint. A designer asking "give me this as a MUI theme" must know the exact MCP tool name. This is the single biggest designer-to-developer handoff moment in Flint, and it is invisible in the panel built for designers.

Fix: add an Export dropdown next to Import JSON in the toolbar. Items: Tailwind config, CSS variables, React Native StyleSheet, Swift, Kotlin, divider, MUI theme, shadcn theme, PrimeNG theme. Each item calls the corresponding MCP tool and shows a preview drawer with a "Save to…" picker.

## Additional P1-class findings

### A4. Sync lifecycle has no narration
There is no "Synced 12m ago" stamp, no "3 local edits pending push," no "2 unresolved conflicts." The designer cannot tell where they are in the sync cycle — only whether Figma is `connected: true/false`. `flint://figma-connection` and `flint_sync_history` exist but do not surface.

Fix: a one-line staleness banner above the health bar: `Synced 12m ago · 3 local edits pending · 2 conflicts`. Each segment is a button.

### A5. TokenDetailPanel does not show impact estimate
`TokenDetailPanel` lists files but not components, and has no "if you change this, N violations will appear" estimate. `TokenImpactAccordion` solves exactly that problem — but lives in GovernanceDashboard (Counsel), not in the detail view. Job 3 ("what breaks if I change this?") splits across two surfaces.

Fix: embed `TokenImpactAccordion` inside `TokenDetailPanel` directly under the Usage section, wired to `useGovernanceTokenImpact` with the current token pre-filled.

### A6. Read-only identity is whispered, not told
`TokenGrid.tsx:478` hides "Token values are managed through Figma. Use Envoy sync to update." inside a `title` tooltip on the value text. Keyboard users, screen reader users, and anyone not hovering will never see it. Mint's core identity (observability, not editing) is principle-level but currently communicated as an HTML tooltip.

Fix: explicit banner at the top of the list: "Tokens are governed by Figma. Edit in Figma, then sync with Envoy." Remove tooltip. Optional: dim the value text slightly to reinforce "this is a display, not an input."

### A7. Approval staging area has no collapse / count pill
When a big Figma sync produces 40 pending tokens, `ApprovalStagingArea` dominates the panel and pushes everything below the fold. No collapse affordance, no "3 waiting" pill to re-expand later.

Fix: collapsible section with count pill in the header. Default expanded on first appearance, collapsed on return.

### A8. `FirstSyncPrompt` dismissal is permanent with no re-entry
Once dismissed via localStorage, the "Your first Figma sync is ready — review them?" prompt is gone forever for that project. A designer who dismisses by accident has no path back.

Fix: add a "Review recent imports" link in the staging area header or toolbar so the review affordance is always reachable.

### A9. No sync event live-region
`SyncBadge` state transitions (e.g., three tokens going from `drifted` to `synced` after a pull) are not announced to screen readers. `role="status"` on the health bar is too coarse and will produce chatter.

Fix: a focused `aria-live="polite"` announcement when sync events complete — "Pull complete. 3 tokens synced."

## P2 — polish additions not in the first review

- Search input placeholder contains literal `\u2026` (line 577 of TokenManager.tsx writes `'\u2026'` in a regular single-quoted string). Users see the four characters instead of an ellipsis.
- Dead-token card uses red background — too loud for stale imports. Zinc + dashed border would communicate "stale" without emergency framing.
- Sync badge vocabulary ("Figma only", "local-only") is Citadel-accurate but reads mechanical. "Only in Figma" / "Only here" would be warmer.
- `view-mode` toggle has `role="radiogroup"` but no ArrowLeft/ArrowRight navigation.
- `MotionPreview` is charming but has no textual equivalent beyond tooltip.

## Answer to the 4 jobs-to-be-done

| Job | Obvious in 10s? | Action path exists? |
|-----|-----------------|---------------------|
| Check health | Partial — pills yes, score no | N/A (read) |
| Resolve drift | Badges yes, action no | **Missing** — no pull / push / resolve button |
| Understand impact | Partial — files yes, component/violation count no | Must leave Mint (Counsel has it) |
| Emit code | **No** — no UI at all | **Missing** — MCP tool only |

Two of four jobs require leaving Mint. That single statistic is the gap vs. "observability-first" target.

## TokenHealthBar sub-review additions

- Canonical formula? No — does not call `shared/healthScore.ts`. Direct drift from Counsel.
- Staleness without scolding? No staleness stamp at all. Dead/drifted pills *do* scold without offering action.
- One-click pull? No button anywhere in the bar.
- Meaningful in empty state? No — bar only renders when tokens exist. An empty Mint has no health narrative (should show "N/A — connect Figma to see token health").

## Observability-first alignment

**Current position: 55% of the way.**

What's built and right:
- Read-only value display (no free-form edit).
- Usage scan + dead-token detection.
- Contrast audit (modal).
- Scale gap detection.
- Approval staging for incoming Figma tokens.
- First-sync prompt.
- Detail panel with provenance.
- Mode pairing (light/dark) in grid view.

What's missing for observability-first to fully land:
- Canonical health score + grade.
- Live drift detection (currently disabled).
- Sync action buttons (Pull / Push / Resolve / Connect).
- Emit / map buttons (downstream handoff).
- Sync staleness narration.
- Impact estimate in detail panel.
- Explicit read-only identity (banner, not tooltip).
- Sync event announcements for screen readers.

## Revised 4-sprint priority (combining both reviews)

**Sprint 1 — foundation (P0 class):**
1. Re-enable drift detection via dedicated IPC (first reviewer C1, this pass reinforces).
2. Wire TokenHealthBar to `shared/healthScore.ts` — hero score + grade pill (A1).
3. Delete `TokenPanel.tsx` and its orphan subtree (first reviewer C2).
4. Wire ExportModal `pendingTokenCount` in App.tsx (first reviewer C3).

**Sprint 2 — action (P0.3 + A2):**
5. Add Pull / Push / Resolve buttons in TokenHealthBar when Figma is connected.
6. Replace empty-state primary CTA with "Connect Figma" via Alliance OAuth.
7. Add sync staleness banner.

**Sprint 3 — emit (A3):**
8. Export dropdown in toolbar: 5 platforms + 3 library themes.
9. Preview drawer with diff against existing file + "Save to…" picker.
10. Reuse/repurpose the ExportModal scaffolding.

**Sprint 4 — polish + coherence:**
11. Fold TokenImpactAccordion into TokenDetailPanel (A5).
12. Explicit read-only banner, remove tooltip (A6).
13. Collapsible approval staging with count pill (A7).
14. Sync event aria-live announcements (A9).
15. Rewrite the 5 deleted-but-still-present tests against the new contract.
16. Fix `\u2026` literal bug (P2).
17. Dead-token visual de-escalation (P2).

## Plain-English summary for Justin

Mint is genuinely in the middle of becoming something great — the swatches, specimens, mode pairs, approval queue, detail panel, and first-sync prompt are all thoughtful and well-built. The first reviewer caught three code-level defects (a duplicate unused component, disabled drift detection, and an unwired export hook). I confirm all three and add three more that are bigger philosophical misses:

1. **Mint doesn't speak the same health language as Counsel.** Counsel gives you an A-B-C-D-F. Mint gives you pill counts. When you flip between them, you're seeing two different health stories for the same project. The fix is small — Mint just needs to call the same canonical health formula.

2. **Mint shows problems but doesn't let you fix them.** "3 tokens drifted from Figma" is rendered as a scold with no Pull or Resolve button next to it. The empty state says "Connect Figma" but only offers an "Import JSON" button. Envoy and Alliance are MCP-ready but never reach Mint.

3. **You cannot get a theme out of Mint.** A designer wanting a MUI theme file or Tailwind config to hand to a developer has to know `flint_emit_tokens library=mui`. That should be a dropdown next to Import JSON. This is the single biggest designer-developer handoff moment, and it is invisible in the one panel built for designers.

Both reviews converge on **B−**. If Sprint 1 tackles the drift-detection revival plus the health-score coherence, Mint reaches B+ quickly. Add Sprint 2 (sync actions) and Sprint 3 (emit dropdown) and it hits A− on already-shipped scaffolding — no new invention needed.
