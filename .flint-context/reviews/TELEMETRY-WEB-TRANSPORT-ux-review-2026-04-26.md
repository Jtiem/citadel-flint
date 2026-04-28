# UX Review — TELEMETRY-WEB-TRANSPORT (web-mode consent dialog wiring)

**Reviewer:** flint-ux-critic
**Date:** 2026-04-26
**Round:** 1
**Phase:** TELEMETRY-WEB-TRANSPORT
**Scope:** First-launch telemetry consent flow in the closed-beta web build.

---

## What I evaluated

The Phase 2 fix added a `telemetry: { getConsent, setConsent }` namespace to `src/adapters/web-api.ts` (lines 611–616), backed by the `telemetry:get-consent` and `telemetry:set-consent` IPC handlers in `server/index.ts` (lines 3574–3611). The contract said: when consent is `'unset'`, the `TelemetryConsentDialog` should appear on first launch.

I traced the actual user-visible sequence end-to-end against `BETA-CLOSED-PLAN.md` Phase 3.3 and `docs/beta/INSTALL-GUIDE.md`. I checked the consent dialog component, the App-level mount effect, the early-return ordering, the file-corruption recovery path, the decline path, and the install-guide copy.

I did not run the dialog manually in a browser — this is a trace review, not a click-through. Any visual regressions (layout, colour, motion) are not in scope.

---

## Verdict

**FIX-FORWARD** — derived by `deriveVerdict()` from 0 blocking + 4 warnings + 2 suggestions.

The transport works. The dialog will render. The privacy contract holds (no telemetry events emit before consent is `accepted`). But the **timing of the dialog and the install-guide copy do not match each other**, and there's a stale dead-code branch and an a11y concern worth fixing forward.

---

## Findings

### WARN-1 — Consent dialog appears AFTER the demo workspace, not at first launch

The install guide and the closed-beta plan both promise a first-launch consent prompt:

> _"Flint will show a consent dialog asking whether it can send anonymous usage events …"_ — `docs/beta/INSTALL-GUIDE.md:53`
>
> _"first launch shows a consent dialog; events only emit after the user clicks Accept"_ — `docs/strategy/BETA-CLOSED-PLAN.md:11`

But `src/App.tsx` has four early-return gates that fire **before** the JSX containing `<TelemetryConsentDialog>` mounts:

1. `setupComplete === null` → returns `null` (line ~960)
2. `!betaWelcomeDone && betaInfo` → returns `<BetaWelcome>` (lines 970–990)
3. `!autoResumeChecked` → returns the RestoringSplash (lines 997–1006)
4. `!workspaceFiles` → returns `<LaunchScreen>` (lines 1009–1023)

The `<TelemetryConsentDialog>` only renders inside the **main return path** (line 1483–1487), as a sibling of the workspace `<div>`. It is therefore deferred until **after** the user has seen BetaWelcome, picked "Try Demo," waited for the demo to load, and the workspace has hydrated.

That is precisely the opposite of "first launch shows a consent dialog." The user actually sees:

> launch → BetaWelcome → "Try Demo" → demo workspace loads → THEN consent dialog pops over the workspace

The privacy guarantee still holds — `webEmit()` in `server/index.ts:3508` short-circuits unless consent state is `'accepted'`, so no events leak — but the UX promise in the install guide is wrong.

**Evidence:**
- `src/App.tsx:970` — BetaWelcome early return.
- `src/App.tsx:1009` — LaunchScreen early return.
- `src/App.tsx:1483-1487` — TelemetryConsentDialog rendered inside main workspace return only.
- `docs/beta/INSTALL-GUIDE.md:53` — "Flint will show a consent dialog" — implied as the first thing.

**Why it matters:** Testers reading the install guide will expect the consent dialog before the demo. A consent prompt that appears *after* the user has poked around for 5 seconds reads as an interruption, not an opening question. It also undermines the GDPR-defensible posture noted in the plan — "opt-in default with explicit Accept covers closed beta" assumes the prompt is positioned as a precondition, not a post-hoc nag.

**Proposed fix:** Hoist the `showTelemetryConsent` gate above the `betaWelcomeDone` early return, or render the dialog as a sibling of BetaWelcome/LaunchScreen so it shows before the demo auto-load. Either is one-file. Alternatively, update the install guide to describe the actual flow ("After the demo loads, Flint will ask whether…"). The first option is the better fix — it matches the plan's stated intent.

---

### WARN-2 — Install guide implies the dialog blocks the workspace; current code doesn't enforce that

`docs/beta/INSTALL-GUIDE.md:53–55`:

> _"Flint will show a consent dialog … Accept or decline; either is fine, and you can change it later in Settings."_

There is no Settings surface to change consent later. There is no IPC handler for resetting consent state besides direct file edits, no UI affordance, no menu item. A tester who declines today and wants to opt in tomorrow has no in-app path.

**Evidence:**
- `docs/beta/INSTALL-GUIDE.md:53` — promises a Settings-based change-later affordance.
- `src/components/ui/TelemetryConsentDialog.tsx` — no companion Settings component referenced.
- `electron/betaTelemetry.ts:111-116` — `setConsent()` is exposed via IPC, but no Glass UI invokes it after the first decision.
- `src/adapters/web-api.ts:611-616` — only the dialog uses `telemetry.setConsent`.

**Why it matters:** The install guide is making a promise the app cannot keep. Either the promise is false (defensible to remove from the doc) or the affordance is missing (defensible to add a one-row toggle in a Settings/About surface). Choose one before testers ask.

**Proposed fix:** Either delete "and you can change it later in Settings" from the install guide for the closed beta (cheapest), or add a one-row toggle to a Settings/About surface that calls `window.flintAPI.telemetry.setConsent({ state: 'accepted' | 'declined' })`. Reset cycles back to `unset` would require an additional flag on the IPC; that's a follow-up.

---

### WARN-3 — "Skip silently if API not wired" branch is now dead code that masks real failures

`src/App.tsx:790-810`:

```ts
const api = window.flintAPI as unknown as Record<string, unknown> & typeof window.flintAPI
const telemetryApi = api?.telemetry as
    | { getConsent?: () => Promise<{ state: string }> }
    | undefined
if (typeof telemetryApi?.getConsent !== 'function') {
    // IPC not wired yet — skip silently
    setShowTelemetryConsent(false)
    return
}
```

This branch was a pragmatic fallback while Group A's IPC was being landed. **The IPC is now wired** in both Electron (`electron/preload.ts` → `electron/betaTelemetry.ts`) and web (`src/adapters/web-api.ts:611-616` → `server/index.ts:3595-3611`). The runtime check `typeof telemetryApi?.getConsent !== 'function'` will never fail in shipping builds — it is a no-op safety net.

In its current form it actively obscures the only realistic failure mode left: a build where the adapter forgot to expose `telemetry`. That's a regression that should surface as a console warning at minimum, not silently suppress the consent prompt. Today, a future regression in `web-api.ts` that drops the namespace causes the dialog to silently not appear — and silently not appear means we're collecting telemetry from users we never asked. (We're not — `webEmit` short-circuits — but the UX is still wrong.)

**Evidence:**
- `src/App.tsx:795` — runtime existence check on a now-required surface.
- `src/adapters/web-api.ts:611-616` — telemetry namespace defined unconditionally.
- `electron/preload.ts` — telemetry namespace defined unconditionally.

**Why it matters:** Defensive code should defend against realistic failures, not against developer mistakes that are caught by TSC. With the typed `FlintAPI` interface declaring `telemetry` as non-optional (`src/types/flint-api.d.ts:2088`), TSC will fail if the namespace is ever dropped. The runtime check is now strictly worse than letting the typed surface enforce it.

**Proposed fix:** Replace the runtime existence check with a direct call: `void window.flintAPI.telemetry.getConsent().then(...).catch(...)`. The catch already handles IPC failure (line 805) — that branch covers the realistic failure mode. Drop the existence check.

---

### WARN-4 — Backdrop is `aria-hidden="true"` but the dialog inside it isn't a portal

`src/components/ui/TelemetryConsentDialog.tsx:74-93`:

```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
  aria-hidden="true"
  data-testid="telemetry-consent-backdrop"
>
  <FocusTrap initialFocusRef={declineRef} onClose={handleEscape}>
    <div role="dialog" aria-modal="true" aria-hidden="false" ...>
```

The pattern is: the backdrop is `aria-hidden="true"` and the inner dialog overrides it with `aria-hidden="false"`. The inline comment on line 81 acknowledges this and notes "aria-hidden=false overrides parent so AT sees the dialog."

In practice, `aria-hidden` is **inherited** by descendants in most screen reader implementations, and the override-with-false pattern is brittle: NVDA respects `aria-hidden="false"` overrides on descendants, VoiceOver and JAWS have historically been inconsistent. The reliable pattern is: backdrop has no `aria-hidden`, and the rest of the page outside the dialog gets `aria-hidden="true"` (App.tsx already does this via `aria-hidden={isAnyModalOpen || undefined}` at line 1034).

**Evidence:**
- `src/components/ui/TelemetryConsentDialog.tsx:76` — backdrop `aria-hidden="true"`.
- `src/components/ui/TelemetryConsentDialog.tsx:88` — dialog `aria-hidden="false"` override.
- `src/App.tsx:1028` — `isAnyModalOpen` already includes `showTelemetryConsent === true`.
- `src/App.tsx:1034` — main app wrapper toggles `aria-hidden` when modals are open.

**Why it matters:** A consent dialog must be reachable by AT. The Warden a11y suite has rules for `aria-hidden` interactions that the WCAG 2.2 update tightened. The current pattern works in the happy path on Chromium-based browsers but is the kind of "works in our test, fails in JAWS" issue we'd get an angry tester report on.

**Proposed fix:** Remove `aria-hidden="true"` from the backdrop entirely (line 76). The aria-hidden inheritance already works correctly because `src/App.tsx:1034` puts `aria-hidden="true"` on the main app wrapper when the dialog is open. Two `aria-hidden` mechanisms on the same modal is one too many — pick one (the App.tsx wrapper) and drop the other.

---

### SUG-1 — "What gets collected?" disclosure is collapsed by default; first-time users may not open it

`src/components/ui/TelemetryConsentDialog.tsx:125-148`:

The collected-data list is hidden behind a `<details>` element that defaults to collapsed. The headline copy says "anonymous usage events and your feedback submissions to help us improve" — that's vague enough that a privacy-conscious tester is forced to click Decline because they can't see what they're agreeing to without actively expanding the disclosure.

The copy in the disclosure list is genuinely good (line 142–146 — specific, plain English, "no IP address," "never your file contents"). It's good enough that surfacing it without a click would *increase* Accept rates from privacy-thoughtful users, not decrease them.

**Evidence:**
- `src/components/ui/TelemetryConsentDialog.tsx:126` — `<details>` element default-collapsed.
- `src/components/ui/TelemetryConsentDialog.tsx:142-146` — actual collected-data list.

**Why it matters:** A privacy-respecting consent UI should make the data list visible by default for closed beta where every tester is a known-friendly user. The default-collapsed pattern is appropriate for public-beta where the data list is long enough to overwhelm; here the list is 5 items.

**Proposed fix:** Add `open` to the `<details>` element (one-character change). Optional: drop the `<details>` wrapper entirely and render the list inline as a static `<ul>`. This is a closed-beta-only consideration; revisit before public beta.

---

### SUG-2 — Decline path leaves no acknowledgement; user can't tell whether their choice persisted

`src/components/ui/TelemetryConsentDialog.tsx:45-63`:

After clicking Decline, `onDecided('declined')` fires, which sets `showTelemetryConsent = false` in App.tsx. The dialog vanishes. There is no toast, no inline confirmation, no visible "Telemetry off" indicator anywhere.

This is fine functionally (the privacy-safe default is to be silent) but produces a small uncertainty for the user: did the click work? Should I close the app? The IPC could have failed (line 56–60 captures that case with an inline error), but a successful decline returns no signal.

The `notificationStore` is already imported elsewhere in App.tsx — a one-line `pushNotification({ type: 'info', title: 'Telemetry off', message: 'No usage data will be sent.', autoDismissMs: 4000 })` after `onDecided` would close the loop without nagging.

**Evidence:**
- `src/components/ui/TelemetryConsentDialog.tsx:55` — `onDecided(state)` is called on success.
- `src/App.tsx:1485` — `onDecided` callback is `() => setShowTelemetryConsent(false)` only.

**Why it matters:** The plan said "Decline → feedback widget falls back to clipboard; telemetry stays off permanently." (`BETA-CLOSED-PLAN.md:103`). The "stays off permanently" part is invisible to the user. A 4-second toast confirms the choice took effect and provides a moment to undo if the user mis-clicked.

**Proposed fix:** After `onDecided`, push a brief notification confirming the decision: "Telemetry off" for decline, "Telemetry on — thanks!" for accept. One-line change in App.tsx.

---

## Things I checked and found OK

These are explicitly things I looked at and decided do **not** warrant a finding:

- **Decline button has initial focus** — the privacy-safe default. Confirmed at `TelemetryConsentDialog.tsx:43, 79, 171`.
- **Escape routes to Decline** — confirmed at line 68 (`handleEscape = handleDecision('declined')`).
- **Backdrop click is a no-op** — explicitly intentional per the comment block (lines 17–19). Consent must be deliberate.
- **Visual button balance** — Decline has matching px-4 py-1.5 sizing as Accept; Accept gets indigo-600 fill while Decline gets a ghost border. The fix from prior review (Warning 4 mentioned in the file header) is in place.
- **Server-side consent file corruption recovery** — `electron/betaTelemetry.ts:95-107` and `server/index.ts:3578-3593` both fall through gracefully on parse failure, write a fresh `unset` record, and don't crash. A corrupted file does NOT make the dialog appear every launch — it makes it appear on the corruption-recovery launch only, then accept/decline writes a valid record. Verified by tracing both `readConsent` paths.
- **Server-down failure mode** — the `getConsent()` IPC call is wrapped in `try/catch` at App.tsx:805. On IPC failure, the dialog defaults to `false` (privacy-safe). The user sees the workspace; no events leak (because `webEmit` checks the actual file at emit time, and no consent file → no `accepted` state → no emission). Acceptable.
- **`webEmit` consent gate** — `server/index.ts:3508` reads the consent file on every emit. This is the right level of paranoia for a privacy-critical path; the in-memory cache is intentionally not used.
- **Privacy of the payload** — `WebTelemetryEvent` discriminated union (`server/index.ts:3470-3475`) cannot carry MCP tool arguments by construction. Verified.
- **Accept-double-click protection** — `isPending` guard at line 47 prevents duplicate `setConsent` calls.

---

## Scope note

This was a transport fix. I did not re-evaluate the dialog's overall information architecture, the consent copy beyond the "off until you opt in" line, or the broader feedback-widget flow. Those have been reviewed in earlier rounds and were not in scope per Lever A.

The 4 warnings above are **fix-forward**: none block ship. WARN-1 is the most user-visible and the one I'd prioritise — it directly contradicts the install-guide promise. WARN-2 (Settings affordance) requires picking a doc-or-code direction; either is cheap. WARN-3 (dead branch) is housekeeping. WARN-4 (aria-hidden double-up) is a quick a11y tightening that prevents a future tester report.
