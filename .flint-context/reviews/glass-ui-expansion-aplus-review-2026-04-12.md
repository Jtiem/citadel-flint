# Glass UI Expansion — A+ Code Review
**Scope:** COUNSEL.1–4, MINT.1–4, FORGE.2–4
**Date:** 2026-04-12
**Reviewer:** /review gate
**Files reviewed:** 15 (6,720 LOC)

---

## Executive Summary

Overall the Glass expansion is in good shape. Store subscription discipline is consistent, a11y scaffolding is strong, and every component respects the process boundary (no `fs`, no Node imports, no direct `ipcRenderer`). No CRITICAL findings. Two MAJOR findings center on `GovernanceDashboard.tsx`: unguarded `setTimeout` timers and a 2,788-LOC monolith that has outgrown the extraction effort. The remaining findings are MINOR.

### Grades

| File | Grade | Headline |
|---|---|---|
| `GovernanceDashboard.tsx` | **B** | Massive file (2788 LOC), unguarded timers, `.getState()` side-effect pattern works but is hard to test |
| `governance/ScoreSection.tsx` | **A** | Clean, stateless, sparkline hex values are documented and justified |
| `governance/ViolationCard.tsx` | **A-** | Duplicate `A11Y_FIX_GUIDE`/`MITH_FIX_GUIDE` with parent — cosmetic DRY issue |
| `governance/BatchActionBar.tsx` | **A+** | Exemplary — pure, typed, full ARIA, zero warts |
| `TokenManager.tsx` | **A-** | Clean subscription, correct effect deps, a11y solid; one stale-closure hazard |
| `TokenGrid.tsx` | **A** | Pure presentational, strong ARIA labels, no issues |
| `TokenHealthBar.tsx` | **A+** | Pure, well-typed, full ARIA on every pill |
| `TokenDetailPanel.tsx` | **A** | Correct Escape-key cleanup, good dialog semantics; missing focus trap |
| `ContrastAuditPanel.tsx` | **A** | Clean, accessible. Uses inline `style={{backgroundColor: pair.bgValue}}` which is correct (runtime data, not design) |
| `ApprovalStagingArea.tsx` | **A** | Good processing-state isolation per row |
| `FirstSyncPrompt.tsx` | **A** | Correct localStorage guard, per-project dismissal |
| `DetectionBanner.tsx` | **A** | Clean state, derived suggestions memoized |
| `DemoScenarioPicker.tsx` | **A+** | Pure, disables siblings during load, clean |
| `PasteAuditModal.tsx` | **A-** | Good Escape handler; error branch swallows raw tool text |
| `LaunchScreen.tsx` | **B+** | Solid but complex (822 LOC); effect with empty deps reads mutable props via closure |

---

## MAJOR Findings

### MAJOR-1 — Unguarded `setTimeout` in GovernanceDashboard (memory-leak / set-state-after-unmount hazard)

**File:** `/Users/tiemann/Lunar-Elevator-Bridge/src/components/ui/GovernanceDashboard.tsx`
**Lines:** 260, 964, 978, 1266

Five `setTimeout` calls schedule `setState` but do not retain the timer handle for cleanup on unmount. If the health tab closes, baseline clears, or deferral applies within the 2–4 s window, React will emit "Can't perform a state update on an unmounted component."

```ts
260:  setTimeout(() => setCopied(false), 2000)
964:  setTimeout(() => setConfirmationMsg(null), 4000)
978:  setTimeout(() => setConfirmationMsg(null), 4000)
1266: setTimeout(() => { setDeferSuccess(...) }, 4000)
```

Line 853 (`setRingPulse`) *does* clean up correctly — use that pattern uniformly.

**Fix:** Track handles in a `useRef<Set<number>>` cleared on unmount, or move these effects into `useEffect` blocks whose dependencies include the trigger value.

---

### MAJOR-2 — GovernanceDashboard is 2,788 LOC

**File:** `GovernanceDashboard.tsx`

The Sprint 3A refactor extracted `ScoreSection`, `ViolationCard`, `BatchActionBar` — correct direction, but the root file has grown back. It now owns: baseline logic, audit triggers, session progress, clean-state rewind, sparkline (duplicated from ScoreSection lines 292–), anomaly banner, coverage, inheritance chain, MCP history, deferral, flagging, pinning, notification piping, and fix preview drawer glue.

**Duplicate code:** `Sparkline` appears once in `ScoreSection.tsx` (lines 44–65) and again verbatim in `GovernanceDashboard.tsx` starting around line 292. Delete the dashboard copy and import from `./governance/ScoreSection`.

**Fix:** Extract the baseline/delta logic into `useGovernanceDelta`, audit into `useGovernanceAudit`, and keep the component as an orchestrator <500 LOC.

---

### MAJOR-3 — `useEditorStore.getState()` inside render helper breaks testability

**File:** `GovernanceDashboard.tsx` lines 106–110

```ts
function getNodeName(id: string): string {
    const tree = useEditorStore.getState().visualTree
    const node = tree.find((n) => n.id === id)
    ...
}
```

Called during render but reads mutable store state outside subscription. This does not trigger re-render when `visualTree` changes, and makes the function untestable without global store setup. There are also several `.getState()` reads inside `useCallback` blocks (516, 1080, 1273) — those are acceptable (imperative handlers), but this one is a render-path read.

**Fix:** Subscribe to `visualTree` at component top, pass `tree` into the helper: `getNodeName(tree, id)`.

---

## MINOR Findings

### MINOR-1 — Stale-closure risk in `TokenManager.handleRejectAll` / `handleApproveAll`
**File:** `TokenManager.tsx` lines 248–264

`for (const token of pendingTokens)` awaits sequentially and mutates `pendingTokens` via `setPendingTokens([])` only at the end. If the effect re-renders mid-loop with fresh pending tokens, new ones get silently approved. Acceptable for staging but document: "snapshot semantics — new pending tokens arriving during bulk action are not included."

### MINOR-2 — `TokenDetailPanel` lacks focus trap
**File:** `TokenDetailPanel.tsx`

The component sets `role="dialog" aria-modal="true"` but does not wrap content in `<FocusTrap>` (the project's trap component used in `TokenManager`'s `ImportModal` and `PasteAuditModal`). Keyboard users can Tab out into background content.

**Fix:** Wrap the panel content in `<FocusTrap>` and set initial focus to the close button.

### MINOR-3 — Duplicate fix-guide tables in `ViolationCard.tsx` and `GovernanceDashboard.tsx`
**Files:** `ViolationCard.tsx` lines 84–200; `GovernanceDashboard.tsx` lines 136–242

`A11Y_FIX_GUIDE` and `MITH_FIX_GUIDE` are defined in both. `ViolationCard` exports them — `GovernanceDashboard` should import, not redeclare.

### MINOR-4 — `LaunchScreen.tsx` effect with `[]` deps depends on `handleOpenFolderRequest`
**File:** `LaunchScreen.tsx` lines 147–154

Effect captures `handleOpenFolderRequest` from closure but declares `[handleOpenFolderRequest]`. Good. However the context-detection effect on line 157 uses `[]` deps while ignoring `window.flintAPI` surface changes (acceptable, it's a mount-only probe) — flagging only because `AbortController` is created but never used to actually cancel the in-flight RPC (`Promise.allSettled` has no signal binding). The controller is decorative.

**Fix:** Either drop the `AbortController` or add a signal-aware wrapper around the two `window.flintAPI` calls.

### MINOR-5 — `PasteAuditModal.tsx` swallows raw text into warning list
**File:** `PasteAuditModal.tsx` lines 92–98

When JSON parse fails, the first 500 chars of the tool response are rendered inside the warnings `<li>`. If the tool surfaces an error object with a stack trace, the user sees unstructured noise. Render a proper error state instead.

### MINOR-6 — `ScoreSection.tsx` Sparkline uses hardcoded hex
**File:** `ScoreSection.tsx` line 59

```ts
const color = trend > 2 ? '#34d399' : trend < -2 ? '#f87171' : '#fbbf24'
```

SVG `stroke` cannot use Tailwind classes, and the code comment documents this. **Accepted as unavoidable**, but recommend moving these three constants to a shared `tokens.ts` map (`TOKEN_EMERALD_400`, etc.) so a future token rename propagates.

### MINOR-7 — `ViolationCard.tsx` `CopySnippet` uses uncancelled `setTimeout`
Same pattern as MAJOR-1 but lower blast radius. The card may unmount (via fix-apply) within the 2s copied-flash window. Wrap in `useEffect` + cleanup or track ref.

### MINOR-8 — `DetectionBanner.tsx` uses `React.useState` default import
**File:** `DetectionBanner.tsx` line 19

`import React, { useState, ... }` — project convention elsewhere drops the default `React` import (React 19 + new JSX transform). Not broken, just inconsistent.

---

## Compliance Checklist

| Check | Result |
|---|---|
| **C3 — Fresh Parse** | PASS. AST mutations go through `useEditorStore.getState().applyBatch` |
| **C4 — Local-First** | PASS. No external URLs. `FirstSyncPrompt` uses `localStorage` only. |
| **C7 — ID Preservation** | N/A (no structural mutations in reviewed files) |
| **C12 — Atomic Queuing** | PASS. All writes via `flintAPI`/store actions. |
| **C13 — No Regex Surgery** | PASS. `extractRuleIdFromMsg` regex parses log messages, not source. |
| **C15 — AST Catalog** | N/A |
| **C16 — TSC Loop** | N/A |
| **Process Boundary** | PASS. Zero `fs`/`node:`/`@anthropic-ai/sdk` imports in the 15 files. |
| **No hardcoded hex in `className`** | PASS. Only two hits (lines 149 `PasteAuditModal`, 105 `TokenManager`) are **textarea placeholders demonstrating bad code** — not applied classes. Sparkline hex is SVG-required. |
| **Store subscriptions sliced** | PASS. All consumers use `useStore((s) => s.field)` pattern; no full-store destructure. `TokenManager` line 143 destructures `useTokenStore()` — MINOR inefficiency, re-renders on any field change. |
| **Zustand-in-Zustand** | PASS. No store imports another store. |
| **`window.flintAPI` outside store actions** | PASS. All IPC calls in components/hooks. |
| **Test coverage** | PASS. Every file has `__tests__/*.test.tsx` (21 test files covering reviewed components). |

---

## Accessibility Spot-check

- **Modals** (`ImportModal`, `PasteAuditModal`) — wrapped in `FocusTrap`, `role="dialog"`, `aria-modal`, `aria-labelledby`. GOOD.
- **`TokenDetailPanel`** — dialog semantics present, focus trap MISSING. See MINOR-2.
- **Progress bars** — `BatchActionBar` uses `role="progressbar"` + `aria-valuenow/min/max`. GOOD.
- **Toggles** — `ScoreSection` category chips use `aria-pressed`. GOOD.
- **Icon-only buttons** — Every instance has `aria-label`. GOOD.
- **Status regions** — `FirstSyncPrompt`, `BatchActionBar` celebration, `TokenHealthBar` use `role="status"` + `aria-live="polite"`. GOOD.
- **Keyboard dismissal** — `TokenDetailPanel` + `PasteAuditModal` cleanly remove the `keydown` listener on unmount. GOOD.

---

## Recommended Actions (priority order)

1. **MAJOR-1**: Guard all 5 `setTimeout` calls in `GovernanceDashboard.tsx`. Pattern at line 853 is the template.
2. **MAJOR-2**: Extract `useGovernanceDelta`, `useGovernanceAudit`, delete duplicate `Sparkline`.
3. **MINOR-2**: Wrap `TokenDetailPanel` body in `<FocusTrap>`.
4. **MINOR-3**: Import `A11Y_FIX_GUIDE`/`MITH_FIX_GUIDE` from `ViolationCard.tsx` instead of redeclaring.
5. **MAJOR-3**: Subscribe to `visualTree` at component top, thread into `getNodeName`.
6. **MINOR-7**: Same timer-guard fix in `ViolationCard.CopySnippet`.
7. **MINOR-5**: Proper error state in `PasteAuditModal` when tool response isn't JSON.

No blockers. Ship after MAJOR-1 and MAJOR-3 are fixed; MAJOR-2 can be follow-up work since it's a refactoring debt, not a correctness defect.
