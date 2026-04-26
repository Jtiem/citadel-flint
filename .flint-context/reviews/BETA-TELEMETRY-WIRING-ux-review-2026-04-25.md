# UX Review — BETA-TELEMETRY-WIRING

**Phase:** BETA.TEL
**Reviewer:** flint-ux-critic
**Date:** 2026-04-25
**Round:** 1
**Scope:** First-launch telemetry consent surface (designer-facing)

## Verdict

`FIX-FORWARD` — derived from `deriveVerdict()` (0 blocking, 4 warnings, 3 suggestions).

The dialog is structurally sound: Warden-clean a11y plumbing, opt-in default, privacy-safe Escape route, plain-language copy. Nothing here would force me to delay the closed-beta cut. But four issues are worth tightening before we put this in front of ten testers, because once a designer sees a consent screen they read it _carefully_, and small misses cost trust.

## What I tested (UX lens)

1. Cold-launch sequencing: BetaWelcome → RestoringSplash → main app + consent modal pop-in.
2. Copy clarity at 5-second scan.
3. Decline-as-default: initial focus, Escape routing, error recovery.
4. Visual weight of Accept vs Decline.
5. A11y plumbing against the component itself (role, aria-*, focus trap, alert).
6. Reversibility — can a user change their mind later?
7. Citadel vocabulary leak.
8. Tone alignment with `BETA-CLOSED-PLAN.md` §3.3.

---

## Findings

### WARN-1 — No "you can change this later" affordance

**Severity:** warning · **Scope:** one-line · **Status:** open

**Observed.** The dialog body explains _what_ telemetry covers and confirms it's off until opt-in, but never tells the user the choice is reversible. There is no "you can change this in Settings" line and no settings entry-point linked from the modal.

**Evidence.**
- `src/components/ui/TelemetryConsentDialog.tsx:97-105` — body copy ends at "off until you opt in." No reversibility statement.
- `docs/strategy/BETA-CLOSED-PLAN.md:101-103` — the plan's own consent copy also omits reversibility.

**Rationale.** A first-time consent prompt without a "you can change your mind" out-clause biases users toward Decline (loss-aversion: "if this is permanent, I'll say no"). For a closed-beta where we _need_ telemetry signal, that's a self-inflicted wound. It also weakens our GDPR posture — withdrawal-of-consent must be as easy as granting it, and we should signal that up front.

**Proposed fix.** Append one sentence: "You can change this any time in Settings → Privacy." Then make sure that toggle exists (or file a follow-up if it doesn't).

---

### WARN-2 — No link to what data is actually collected

**Severity:** warning · **Scope:** one-file · **Status:** open

**Observed.** The body says "anonymous usage events and your feedback submissions" without enumerating events or linking to a disclosure. The contract enumerates 5 events (`app.launched`, `app.crashed`, `mcp.tool_called` (tool name only, never args), `audit.completed`, `session.ended`), but the user can't see that list from the dialog.

**Evidence.**
- `src/components/ui/TelemetryConsentDialog.tsx:97-105` — body has no "Learn more" link, no expandable disclosure.
- `.flint-context/contracts/BETA-TELEMETRY-WIRING.contract.ts` (the `TelemetryEvent` union) — the actual scope of collection is precisely defined but invisible to the user.

**Rationale.** "Anonymous usage events" is the exact phrase that makes a privacy-conscious designer assume the worst. The Gate philosophy of this product is _show your work_ — we should do that here too. A designer who can read the event list will trust us; one who can't will Decline by default.

**Proposed fix.** Add a `<details>`/`<summary>` "What gets collected?" that lists the five events in plain English (e.g. "When the app starts (version + OS, no IP)", "When you run an audit (file count + violations, not file names)"). Keep it collapsed by default so the 5-second scan stays fast.

---

### WARN-3 — Contract says initial focus on Accept; implementation focuses Decline

**Severity:** warning · **Scope:** one-line · **Status:** open

**Observed.** The contract artifact (§5 Component Contracts, accessibility requirements) states "Initial focus on Accept button." The implementation focuses Decline as the privacy-safe default and routes Escape to Decline. The component comment acknowledges this inversion.

**Evidence.**
- `.flint-context/contracts/BETA-TELEMETRY-WIRING-contract.md:100` — "Initial focus on Accept button."
- `src/components/ui/TelemetryConsentDialog.tsx:13-15` — comment notes Decline gets initial focus per a separate "contract note"; this contradicts §5.
- `src/components/ui/TelemetryConsentDialog.tsx:38, 122` — `declineRef` is the `initialFocusRef`.

**Rationale.** The implementation's choice (Decline first) is the right UX for a privacy-respecting product, and the contract is the file that's wrong. But leaving these out of sync makes the contract artifact unfalsifiable for the next reviewer or agent — Phase 1.5's `flint-contract-linter` should have caught this and didn't. Either the contract gets corrected, or the component comment needs to point at the canonical override.

**Proposed fix.** Update `BETA-TELEMETRY-WIRING-contract.md:100` to read "Initial focus on Decline button (privacy-safe default)." Drop the orphaned "per contract note" wording in the component comment.

---

### WARN-4 — Decline button has noticeably less visual weight than Accept

**Severity:** warning · **Scope:** one-line · **Status:** open

**Observed.** Accept renders as `bg-indigo-600` filled primary; Decline renders as ghost (`text-zinc-400`, no background, no border). The copy says "off until you opt in" but the button hierarchy says "we'd really prefer you click the blue one."

**Evidence.**
- `src/components/ui/TelemetryConsentDialog.tsx:121-129` — Decline: `text-zinc-400 hover:bg-zinc-800` only.
- `src/components/ui/TelemetryConsentDialog.tsx:131-139` — Accept: `bg-indigo-600 text-zinc-100`.

**Rationale.** Decline already gets initial focus + Escape route, which partially counterbalances. But for a designer audience that reads visual hierarchy as intent, the asymmetry undercuts the "privacy-first" framing the body copy works hard to establish. The two should look closer to peers; the privacy-respecting choice should not feel like the "throwaway" option.

**Proposed fix.** Give Decline a ghost-but-visible treatment — `border border-zinc-700 text-zinc-200` or similar — so both buttons read as "two real choices" rather than "primary CTA + escape hatch." Keep Accept's indigo fill, but lower its perceptual dominance.

---

### SUG-1 — Modal piles up at end of first-launch sequence

**Severity:** suggestion · **Scope:** cross-file · **Status:** open

**Observed.** First-launch sequence is: SetupWizard (skipped) → demo auto-load → BetaWelcome modal → RestoringSplash → main app renders → consent dialog pops. That's two-to-three modal moments before the user touches the canvas. The consent modal `useEffect` runs on mount and is gated only on `getConsent` being available (`src/App.tsx:780-801`) — not on the BetaWelcome being dismissed.

**Evidence.**
- `src/App.tsx:780-801` — consent IPC fires on mount unconditionally.
- `src/App.tsx:958-978` — BetaWelcome short-circuits the render tree, so consent modal does not _visually_ overlap, but it pops the moment BetaWelcome dismisses.
- `src/App.tsx:1015` — `isAnyModalOpen` includes consent, confirming overlap-handling exists but the sequencing is back-to-back.

**Rationale.** Functionally correct (no overlap), but emotionally heavy. A new beta user sees BetaWelcome → dismisses → another modal. That's the pattern that gets called "modal hell" in onboarding teardowns. Consent doesn't have to be the literal first thing — it can wait until after the user has seen _something_ they want to keep using.

**Proposed fix.** Defer `setShowTelemetryConsent` until either (a) the user has been in the canvas for ≥30s, or (b) they trigger their first MCP tool call. Either rule means we ask after they've seen value, not before. Both are one-line changes to the consent effect.

---

### SUG-2 — Title "Usage data & feedback" is accurate but flat

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Observed.** Header reads "Usage data & feedback." Body opens "Flint Beta can send anonymous usage events and your feedback submissions to help us improve."

**Evidence.**
- `src/components/ui/TelemetryConsentDialog.tsx:91` — h2 text.

**Rationale.** Tone is technically fine but doesn't match `BETA-CLOSED-PLAN.md`'s short, friendly, designer-facing voice. A designer reading "Usage data & feedback" thinks of cookie banners; a designer reading "Help us improve Flint?" thinks of a beta partnership. Same disclosure, different relationship.

**Proposed fix.** Title: "Help us improve Flint?" Body opens with "We'd like to send anonymous usage events and your feedback to make Flint better. No file contents or design data leave your machine." Same scope, friendlier register.

---

### SUG-3 — Backdrop click is not handled

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Observed.** Clicking the dimmed backdrop does nothing. Escape routes to Decline (good). Most modals in Glass behave the same way (ExportModal does not dismiss on backdrop), so this is consistent — but a consent dialog where backdrop click silently does nothing can feel "trapped."

**Evidence.**
- `src/components/ui/TelemetryConsentDialog.tsx:67-70` — backdrop has no `onClick`.

**Rationale.** Either we explicitly route backdrop-click to Decline (matches Escape behaviour, "outside click = no thanks") or we leave it as-is for consistency. The latter is fine; I'd just ask for an explicit decision rather than an implicit non-handler. If the principle is "every consent decision must be explicit, no accidental dismiss," that's worth a comment in the component so the next maintainer doesn't add backdrop-close as a "fix."

**Proposed fix.** Add a one-line code comment explaining why backdrop click is intentionally a no-op. Or route it to Decline. Either is acceptable; the silence is what bothers me.

---

## Rubric

| Criterion | Result | Evidence |
|---|---|---|
| Dialog uses `role="dialog"` + `aria-modal="true"` + labelled/described | pass | `TelemetryConsentDialog.tsx:77-80` |
| Focus trap is mounted via shared `FocusTrap` component | pass | `TelemetryConsentDialog.tsx:71` |
| Escape key routes to privacy-safe default (Decline) | pass | `TelemetryConsentDialog.tsx:63, 71` |
| Initial focus is on the privacy-safe choice | pass | `TelemetryConsentDialog.tsx:38, 122` |
| Error state is human-readable and inline (does not dismiss) | pass | `TelemetryConsentDialog.tsx:108-115` |
| Body copy is scannable in 5 seconds | pass | `TelemetryConsentDialog.tsx:97-105` |
| Body explicitly states telemetry is off until opt-in | pass | `TelemetryConsentDialog.tsx:103-104` |
| User is told they can change their mind later | fail | WARN-1 — no reversibility copy in dialog or plan |
| User can see what events get collected | fail | WARN-2 — no event enumeration or "Learn more" |
| Contract and implementation agree on initial-focus target | fail | WARN-3 — contract says Accept, code says Decline |
| Decline button has visual weight comparable to Accept | fail | WARN-4 — ghost vs filled primary |
| Dialog uses no Citadel jargon (Mithril, Warden, Gate, etc.) | pass | `TelemetryConsentDialog.tsx:91-105` |
| Tone matches BETA-CLOSED-PLAN voice (short, friendly) | n/a | SUG-2 — flat but acceptable |
| Modal sequencing on first launch avoids stacking | n/a | SUG-1 — back-to-back, not overlapping |

---

## Scope Coverage

**Reviewed.**
- `src/components/ui/TelemetryConsentDialog.tsx` (full component, 145 lines)
- `src/App.tsx:46-47, 143-147, 776-801, 1015, 1468-1474` (mount logic, IPC effect, render gate)
- `docs/strategy/BETA-CLOSED-PLAN.md:80-128` (consent copy section, telemetry phases)
- `.flint-context/contracts/BETA-TELEMETRY-WIRING-contract.md` (component contract §5)
- `src/components/ui/FocusTrap.tsx` (a11y plumbing, lines 1-60)

**Skipped (intentional, per domain partition).**
- `electron/betaTelemetry.ts` — engine path/redaction logic, code reviewer's scope.
- `electron/main.ts` IPC handlers — code reviewer's scope.
- `shared/ipc-validators.ts` — security reviewer's scope.
- `electron/betaTelemetry.test.ts` and `TelemetryConsentDialog.test.tsx` — test files, not in UX scope.
- `server/index.ts` web parity — code reviewer's scope.
- `electron/preload.ts` contextBridge — security reviewer's scope.

---

## Counts

- blocking: 0
- warning: 4
- suggestion: 3

## Should anything block ship?

No. Nothing here is a hard "do not ship." But WARN-1 (reversibility) and WARN-2 (event disclosure) are both designer-trust issues and both one-evening fixes — I'd land them before the closed-beta invitations go out. WARN-3 is a contract correctness bug worth fixing the same day so the next reviewer doesn't trip over it. WARN-4 is a visual-hierarchy nit that we should fix because we're a design-tools company and our consent modal is read by designers.
