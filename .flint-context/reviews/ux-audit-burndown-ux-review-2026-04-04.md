# UX Audit Burn-Down Review — 2026-04-04

**Verdict: APPROVED — Grade A-**

## What shipped well (15 of 22 items addressed, 5 correctly deferred)

The strongest implementations:
- **T1.1** (rule toggles filter violations) — `isRuleDisabled()` does both embedded rule ID matching and prefix fallback. Most important fix in the set.
- **T4.4** (GhostCodeSnippet opt-in) — pill-to-panel progressive disclosure is the cleanest pattern in the codebase.
- **T5.1** (violation-to-canvas highlight) — postMessage from GovernanceDashboard to LivePreview's HIGHLIGHT_NODE handler with pulse animation and scroll-into-view.
- **T2.4** (Run Audit in export gate banner) — action placed next to problem, sidebar header is now navigation-only.
- **T4.3** (drag handle invisible until hover) — no text, icon hidden, appears on hover. Minimal and correct.

## What needs attention

1. **T1.5 (P0 — undo after demo load) is not addressed.** Only remaining P0 trust-gap item. Cmd+Z says "undone" but nothing changes. Must fix before burn-down is complete.

2. **T3.2 and T3.3 (P1 — canvas background + scrollbar)** were labeled "quick wins that fix credibility" in the audit. Neither was changed. `bg-gray-950` canvas background and missing custom scrollbar CSS remain.

3. **T5.2 preview size not persisted** — NodeResizer works but size resets to 900x600 each session. The audit spec said "Persist the last-used size in canvasStore."

4. **Residual `text-zinc-600`** on the ⌘K hint in App.tsx — a contrast issue in a file that was otherwise updated for T3.1.

## No regressions detected

All existing functionality (health score computation, export gate logic, progressive disclosure tab unlocking, delta mode, sparklines, rewind-to-clean) continues to work against the filtered violation data.
