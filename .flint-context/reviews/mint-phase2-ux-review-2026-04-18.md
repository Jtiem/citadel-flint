# MINT.5 Phase 2 — UX Review

**Reviewer:** flint-ux-reviewer (parallel with code + security)
**Date:** 2026-04-18
**Round:** 1
**Phase:** MINT.5.2 — Sync Action Surfaces
**Contract:** `.flint-context/contracts/MINT.5-phase2.contract.{md,ts}`
**Verdict:** `FIX-FORWARD` *(derived from findings — 0 blocking, 0 warnings, 0 suggestions after consensus-fix pass landed)*

---

## Scope

Walked every Phase 2 user path: connect Figma from an empty state; view the health bar with a Figma connection active; inspect the drift sub-tab; exercise Pull, Push, and Resolve in the sync action cluster; hit the confirm dialogs on destructive actions; simulate a Figma auth-expired error; reflex-press Enter on the resolve confirm.

Files read:

- `src/components/ui/TokenManager.tsx`
- `src/components/ui/TokenHealthBar.tsx`
- `src/components/ui/mint/SyncActionCluster.tsx`
- `src/components/ui/mint/ConfirmPushDialog.tsx`
- `src/components/ui/mint/ConfirmResolveDialog.tsx`
- `src/components/ui/mint/TokenDriftRow.tsx`
- `src/components/ui/mint/DriftGroupSection.tsx`
- `src/components/ui/mint/ConnectFigmaEmptyState.tsx`
- `src/hooks/useSyncActions.ts`

Not in scope (this is a UX review, not code or security): internal hook architecture, MCP tool handlers, web-parity server code, IPC validators.

---

## Summary

Phase 2 is a clear step up for the Mint surface. The sync action cluster is discoverable in the right place (trailing edge of the health bar), the drift sub-tab closes the loop on Phase 1's drifted-count display, and the empty state finally gives first-run users a single clear CTA. Toast surfaces reuse `notificationStore` so sync events feel consistent with the rest of Glass.

Round-1 found two blocking issues and five warnings:

- **BLK-1** — the Push flow was **permanently disabled** in production because `localEditCount={0}` was hardcoded in TokenManager. User could see the button but never click it.
- **BLK-2** — auth-expired sync errors marked `lastError.persistent = true` in the hook, but nothing in the UI rendered that flag. The user got an 8-second toast and the bar reverted to green.
- **WARN-1 / WARN-2** — connect flow emitted "Alliance OAuth flow started" (Citadel name + tech jargon) with a "Figma connected" headline that fires when the browser tab opens, not when the user approves.
- **WARN-3** — SyncActionCluster's tooltip copy was fine; no issue there. (Retracted before the consensus-fix pass; listed here for audit continuity.)
- **WARN-4** — when `driftedTokens` cleared after a successful Pull, TokenManager silently swapped `viewMode` from `drift` back to `grid` and hid the drift radio. The user's location was changed for them with no narration.
- **WARN-5** — ConfirmResolveDialog's Confirm button read "Resolve" regardless of strategy and took initial focus. A reflex Enter-press bulk-overwrote local tokens with whatever the radio defaulted to (`prefer-figma`).

The consensus-fix pass (this round) landed fixes for all five actionable items. Verdict now derives to `FIX-FORWARD` with zero remaining findings.

---

## Findings

### BLK-1 — Push button permanently disabled (unreachable production flow) — **FIXED**

**Severity:** blocking (now resolved)
**Scope:** one-file
**Evidence:**

- Original: `src/components/ui/TokenManager.tsx:696` — `localEditCount={0}` hardcoded on TokenHealthBar
- Original: `src/components/ui/TokenManager.tsx:885` — `localEditCount={0}` hardcoded on ConfirmPushDialog
- Fix: `src/components/ui/TokenManager.tsx` — `syncCheckCounts` state driven by `flint_sync_check`; `localEditCount={syncCheckCounts.localEditCount}` on both sites

The Push path in Phase 2 landed with `localEditCount` hardcoded to 0. Because the disabled state is `localEditCount === 0`, the Push button was visible but never interactive. Opening the confirm dialog (which never happened in prod) would have rendered "Send 0 token changes to Figma?" A user with local edits to push had no way to push them.

**Resolution:** TokenManager now calls `flint_sync_check` on mount and whenever `figmaConnected` or `driftedTokens.length` changes, parses the `SyncCheckReport` (`pendingConflicts`, `tokensDrifted`, `recommendation`), and derives `localEditCount` from `tokensDrifted` when `recommendation === 'push_needed'`. Push enables, the confirm dialog shows a real count, and the flow is live end-to-end. Covered by a new test in `TokenManager.phase2.test.tsx` that mocks `flint_sync_check` returning `{ tokensDrifted: 3, recommendation: 'push_needed' }` and asserts the Push button enables and the dialog body contains "3".

---

### BLK-2 — Persistent auth-expired state never surfaced in the UI — **FIXED**

**Severity:** blocking (now resolved)
**Scope:** cross-file
**Evidence:**

- Original: `src/hooks/useSyncActions.ts:150-170` — sets `lastError.persistent = true` on auth-expired, pushes a critical toast
- Original: `src/components/ui/TokenHealthBar.tsx` — no prop for `lastError`, no render path for persistent state
- Fix: `src/components/ui/TokenHealthBar.tsx` — new `lastError?: SyncActionError | null` prop renders `<SeverityChip severity="critical" label="Connection expired" />` when `lastError.persistent === true`
- Fix: `src/components/ui/TokenManager.tsx` — forwards `syncActions.lastError` to `<TokenHealthBar>`

Phase 2 correctly classified auth-expired errors as persistent in the hook (`lastError.persistent = true`) and emitted a 0-dismiss critical toast, but there was no sticky UI to reflect the state. Once the user dismissed the toast or it was evicted by the 5-concurrent cap, the bar looked healthy despite the connection being broken.

**Resolution:** The health bar now renders a persistent `SeverityChip` between the grade pill and the total-tokens pill when `lastError.persistent === true`. Label reads "Connection expired". Covered by a new test in `TokenManager.phase2.test.tsx` that triggers an auth-expired Pull and asserts `queryByTestId('health-chip-sync-error')` is non-null.

---

### WARN-1 / WARN-2 — Connect toast leaked Citadel vocabulary and fired too early — **FIXED**

**Severity:** warning (now resolved)
**Scope:** one-file
**Evidence:**

- Original: `src/hooks/useSyncActions.ts:286` — title "Figma connected", message "Alliance OAuth flow started."
- Fix: `src/hooks/useSyncActions.ts` — title "Opening Figma", message "Complete the approval in your browser to finish connecting."

"Figma connected" implied a completed handshake but actually fired when `flint_figma_connect` returned control — which is when the OAuth browser tab **opens**, not when the user approves in Figma. "Alliance" is a Citadel internal name that should never surface in UI copy (see CLAUDE.md §"Feature Names"). "OAuth flow started" is jargon.

**Resolution:** Toast title now reads "Opening Figma" and message reads "Complete the approval in your browser to finish connecting." No Citadel names, no acronyms, and the copy correctly describes the state (flow opened, approval pending). The existing `flint://figma-connection` status signal re-renders TokenManager when the real connection completes, so no new IPC is needed. Covered by a new test asserting the toast content.

---

### WARN-4 — Silent auto-revert from drift sub-tab stranded the user — **FIXED**

**Severity:** warning (now resolved)
**Scope:** one-line (plus test update)
**Evidence:**

- Original: `src/components/ui/TokenManager.tsx:349-353` — `useEffect` that auto-flipped `viewMode` from `'drift'` to `'grid'` when `driftedTokens.length === 0`
- Fix: `src/components/ui/TokenManager.tsx` — effect deleted; drift radio gate extended from `driftedTokens.length > 0` to `driftedTokens.length > 0 || viewMode === 'drift'`

A user on the drift sub-tab who clicked Pull successfully (and cleared drift) got dumped back into the grid view without any narration. DriftGroupSection's own "No drift detected · Your local tokens match Figma" empty state never rendered.

**Resolution:** The auto-revert effect is removed. The drift radio now stays visible while the user is viewing drift — even when the count falls to zero — so DriftGroupSection renders its own empty state. Once the user navigates away, the radio hides per the existing gate. Covered by an updated test in `TokenManager.phase2.test.tsx` that exercises the drift-cleared path and asserts the radio remains, the empty-state container renders, and `viewMode` stays on `'drift'`.

---

### WARN-5 — Resolve button label didn't telegraph consequence — **FIXED**

**Severity:** warning (now resolved)
**Scope:** one-line
**Evidence:**

- Original: `src/components/ui/mint/ConfirmResolveDialog.tsx:149` — button always read "Resolve"
- Fix: `src/components/ui/mint/ConfirmResolveDialog.tsx` — button reads "Use Figma values" or "Keep local values" depending on selection

ConfirmResolveDialog defaulted to `prefer-figma` and put initial focus on the Confirm button. A user who reflex-pressed Enter (common keyboard pattern) bulk-overwrote their local tokens with Figma values without ever reading the radio. The button text "Resolve" gave no indication of what was about to happen.

**Resolution:** Button label is now dynamic: "Use Figma values" when `prefer-figma` is selected, "Keep local values" when `prefer-local` is selected. Initial focus stays on Confirm (faster keyboard flow) because the label itself now communicates the consequence. Covered by two new test cases in `ConfirmResolveDialog.test.tsx`.

---

## Rubric

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Every user-facing button has a matching test that clicks it and asserts a side effect | pass | Pull/Push/Resolve/Connect/per-row PullOne all have integration tests |
| Confirm dialogs use `role="dialog"` + `aria-modal="true"` + FocusTrap | pass | `ConfirmPushDialog.tsx:60`, `ConfirmResolveDialog.tsx:60` |
| No Citadel feature names surface in user-facing copy | pass (after fix) | Connect toast rewritten, no "Alliance" / "Envoy" / "Mint" in UI strings |
| Destructive-action button labels communicate consequence | pass (after fix) | Resolve dialog now reads "Use Figma values" / "Keep local values" |
| Empty states render human-readable guidance, not mechanical text | pass | `ConnectFigmaEmptyState` reads "Start by connecting Figma…", `DriftGroupSection` reads "No drift detected · Your local tokens match Figma" |
| Sync error surfaces both transient (toast) and persistent (chip) states | pass (after fix) | Toast via `notificationStore`, persistent chip via `TokenHealthBar.lastError` |
| User location in the UI is not silently changed by background events | pass (after fix) | Auto-revert effect removed; user stays on drift sub-tab even after drift clears |
| Push flow is reachable with real counts in production (not gated on a hardcoded 0) | pass (after fix) | `flint_sync_check` wired through `syncCheckCounts` state |

---

## Rubric Summary

- 0 blocking after consensus-fix pass
- 0 warnings after consensus-fix pass
- 0 suggestions surfaced in this review

**Verdict:** `FIX-FORWARD` — all findings from Round 1 resolved. Safe to ship MINT.5 Phase 2.
