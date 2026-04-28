# UX Review — HELLO-FLINT-PHASE-A Welcome Screen + Smart IDE Auto-Connect

**Phase:** HELLO-FLINT-A
**Reviewer:** flint-ux-critic
**Date:** 2026-04-26
**Round:** 1
**Verdict (derived):** FIX-FORWARD

## Scope Reviewed

- `src/components/ui/HelloFlintWelcome.tsx` — the new 8-state welcome component
- `src/components/ui/__tests__/HelloFlintWelcome.test.tsx` — flow coverage
- `src/App.tsx` (gates only) — gate ordering and `alreadyConnected` fast-path
- `docs/beta/INSTALL-GUIDE.md` — first-launch promise vs. reality
- `docs/strategy/FEATURE-SPEC-GUIDED-FIRST-SCREEN.md` — binding spec
- `.flint-context/contracts/HELLO-FLINT-PHASE-A.contract.md` and `.contract.ts`

## Summary

Phase A lands the right shape: one screen, one button, a silent auto-connect with an honest verify step, and graceful manual + error fallbacks. The welcome copy matches the spec verbatim. The state machine reaches every named state and the test suite exercises the core flows.

What it gets right:
- Welcome copy is verbatim from spec (heading, two-halves paragraph, "fastest way to understand," guided 5-min framing).
- Skip is a small ghost text link — no shame energy.
- Detection failure falls through to a usable `connect-confirm` panel with manual still reachable.
- Partial success shows both written and failed editors honestly (`Wrote to Cursor. Couldn't write to VS Code: file locked.`).
- Escape is blocked during writing — atomicity preserved.
- Token-only styling is enforced by static grep test.
- The `alreadyConnected` fast-path is initialized from localStorage **before** mount, satisfying the < 250ms invariant via initial state rather than effect-fired flicker.

What needs work — none of the findings block ship, but four warnings should be addressed in fast-follow before the closed-beta cohort sees it. The biggest gaps are install-guide drift (testers will be told the wrong thing about first launch) and focus management (the heading-only initial focus does not move on state transitions, breaking screen-reader and keyboard-only flows from the second panel onward).

---

## Per-question findings

### Q1 — First-launch flow

The gate ordering in `App.tsx` is correct: `setupComplete` → `TelemetryConsentDialog` → `HelloFlintWelcome` → `RestoringSplash` → `LaunchScreen`. After `onComplete()` fires, the user lands on `RestoringSplash` momentarily then `LaunchScreen` (or directly into a workspace if auto-resume succeeds). That's a reasonable next state — the user has just told Flint "yes I've connected my IDE" and the natural follow-up is "now pick a project to work on." Phase B will replace that handoff with the walkthrough; for Phase A, this sequence is honest.

One concern (SUG-1): the spec says the welcome "replaces BetaWelcome.tsx and the buried StatusBar 'Connect to IDE' affordance," but the LaunchScreen still surfaces `Connect to IDE` (`onConnectIDE={() => setShowSetupWizardModal(true)}` at App.tsx:1063). A returning user who skipped the welcome will see the legacy SetupWizard offered as a peer entry point. Not a blocker — Phase A is explicit about retaining the legacy path for power users — but the entry point's presence next to the new welcome's promise creates two paths to the same outcome.

### Q2 — Spec fidelity

The welcome panel matches the spec line-for-line (HelloFlintWelcome.tsx:329–351):
- Heading: "Welcome to Flint" ✓
- Two-halves paragraph: verbatim ✓
- "The fastest way to understand Flint is to build something." ✓
- Guided 5-minute framing with the full-loop sentence ✓
- "Let's go →" CTA ✓
- "Skip — I'll find my way around" small text link ✓
- "Build 0.3.0-beta.1 · Expires in 60 days" footer ✓

One drift (WARN-1): the spec puts the guided-tour pitch as a single inline paragraph after "The fastest way to understand Flint is to build something." The implementation pulls it into a bordered card panel (HelloFlintWelcome.tsx:342–351) with its own framing ("Let's build your first screen") and visually separates it from the connect step. The card is OK but slightly editorializes the spec — the spec's flow is "explain → invite → button," the implementation's is "explain → boxed pitch → button." The card adds visual weight that could read as a feature panel rather than a CTA pre-amble. Minor.

### Q3 — The smart auto-connect flow

The major beats are all present:
- "Let me set this up for you" framing — present (`HelloFlintWelcome.tsx:416`).
- Live detection with per-editor checks — present.
- Bulk-write picker — present, but with a subtle gap (see WARN-2).
- Done-with-preserved-servers confirmation — present (`describeWriteResult` at line 87, "Done. I added Flint to your Cursor settings — your other MCP servers are untouched.").
- "I see the green dot ✓ / Help" panel — present.
- Help panel with three concrete fixes — present.
- Manual snippet fallback — present.

WARN-2 — "Both" button activation rule is narrower than the action it performs. The condition to render "Both" requires Cursor AND Claude Code to both be present (`HelloFlintWelcome.tsx:409–411`). But when "Both" is clicked, it sends `present.map(e => e.editor)` (line 443), which writes to ALL detected editors including VS Code. So a user with all three present sees a button labeled "Both" that actually means "All three." If a user has Cursor and VS Code (no Claude Code), they don't see "Both" at all and have to click each editor separately. The label/action mismatch is mild now but will read as a bug as the editor count grows.

WARN-3 — the spec wants the connect-confirm panel to feel deliberate ("◦ Found Cursor on your machine ✓ / ◦ Looking for VS Code… not found"). The implementation renders a circle-bullet `<ul>` (line 420–424) rendered with `EditorDetectionRow`. The bullet is a small open circle for not-found and a `CheckCircle2` for found. That's close to spec but the not-found row says "Looking for VS Code… not found" — the trailing "not found" is final and accurate but loses the in-progress quality of the spec's "Looking for…". Detection has already completed by the time the panel renders, so "Looking for" is misleading copy: there's no looking happening. Recommend "VS Code — not found" or just "VS Code (not installed)".

### Q4 — Failure modes

- **No editors installed:** `NONE_PRESENT` test (line 222) confirms `connect-confirm` still renders with `manually` as the only enabled button. Honest. ✓
- **"Both" → partial success:** Test `HFW-06` covers this. UI shows both success and failure messages. ✓
- **Slow detection (>5s):** No timeout guard. The `detecting` state shows a spinner forever if `detectEditors()` hangs. The catch block in `handleLetsGo` (line 182–194) only fires on rejection, not stall. (WARN-4)
- **Help panel:** Three fixes are concrete, not just docs links. But "Re-run the connection" instructs the user to *close this screen, reopen Flint, and click Let's go again* (line 587). That's a heavy ask for what could be a one-button retry inside the help panel. The user is already in `help` state with `Back to verify` available — a third option `[ Try again ]` that re-runs the write would be much friendlier. (SUG-2)
- **Manual fallback:** Works standalone — the snippet renders the `mcpServers.flint.command/args` JSON correctly. But the Copy button has no success feedback (`navigator.clipboard.writeText(snippet).catch(() => {})` at line 612). The user clicks Copy and nothing visible happens — they don't know if it worked. (WARN-5)

### Q5 — Fast-path silence

The contract calls for sub-250ms skip when an editor is already connected. The implementation handles this **two ways**, which together approach the invariant:

1. App.tsx:145–150 — `useState` initializer reads `getHasSeenHelloWelcome()` synchronously from localStorage before first render. If the user previously dismissed, `hasSeenWelcome` is `true` from frame 1 and the welcome never renders.
2. App.tsx:792–808 — useEffect calls `alreadyConnected()` after first render. If it resolves `connected:true`, sets `hasSeenWelcome(true)` which dismisses the welcome.

Path 1 is the "returning user" fast-path — silent, no flash. Path 2 is the "fresh install but already-connected editor" path — the welcome WILL flash briefly before the IPC resolves. With a typical local IPC round-trip of 30–80ms on macOS dev builds, this is usually under 250ms but not guaranteed. The component itself also fires `alreadyConnected` from inside (HelloFlintWelcome.tsx:130–146), which is a redundant call once the App-level effect lands. The double-fire is harmless but wasteful, and means if either path resolves first the user gets dismissal — which is fine for behavior but noisy in logs. (SUG-3)

### Q6 — Accessibility

- `role="dialog"`: NOT set. The component uses `role="region"` on the outer wrapper (line 236) and `<main>` for content. This is intentional per the comment block at lines 19–24, but a first-launch full-screen welcome IS modal in effect — there's no other content to navigate to. Whether this is "dialog" or "region" is debatable; for assistive tech users, `role="dialog"` plus `aria-modal="true"` would be more accurate to the lived experience. Not a blocker — Warden's landmark check passes — but a screen reader user navigating by landmarks will see "region" rather than "dialog." (SUG-4)
- **Keyboard navigation:** Tab order works (no tab traps observed). Escape skips (line 158). Enter/Space activates buttons (default behavior). ✓
- **Focus management:** The heading is focused on initial mount via `headingRef.current?.focus()` (line 151). But there is NO focus management on state transitions — when the user clicks "Let's go" and the panel changes to `detecting`, then to `connect-confirm`, focus stays on the now-unmounted "Let's go" button → fallback to body. A keyboard or screen-reader user has to tab from the top of the page back into the new panel each time. (WARN-6)
- **Live regions:** `aria-live="polite"` + `aria-atomic="true"` on `DetectingPanel`, `WritingPanel`, `VerifyPanel`. Good. But the `connect-confirm → writing → verify` sequence rapidly mounts and unmounts these regions; some screen readers (NVDA, JAWS) coalesce or drop announcements when a live region appears for under 100ms. The detection panel only shows for the duration of one IPC call. This is borderline acceptable but worth noting for QA with screen readers. (SUG-5)
- **Color contrast:** `text-zinc-600` on `bg-zinc-950` for the build footer (line 373) computes to ~3.96:1 — below the 4.5:1 WCAG AA threshold for normal text. This is "incidental" info under the AA rules but a tester relying on default macOS contrast will struggle to read the build/expiry. (WARN-7)
- All other text uses `text-zinc-100` on dark surfaces (≥ 14:1) or `text-zinc-400` on `bg-zinc-900` (~7:1) — passing. ✓

### Q7 — Voice consistency

The voice is mostly there. Designer-to-designer phrases:
- "Let me set this up for you." ✓
- "Done. I added Flint to your Cursor settings — your other MCP servers are untouched." ✓
- "If the editor was running, restart it." ✓ (vs. institutional "Please restart your IDE to load the configuration")

Drifts:
- "Writing config…" (line 493) — institutional. Spec voice would be "One sec — adding Flint" or "Setting it up."
- The Help panel header is just "Troubleshooting" (line 553) — generic and dry. Spec voice would be "Hmm. Let's check three things." or "Things to try."
- The Manual panel header is "Manual setup" (line 618) — fine but flat. Could be "Doing it by hand" to match the conversational tone.

(SUG-6)

### Q8 — Skip flow

Skip is a small text link styled as `BTN_GHOST` (`text-xs text-zinc-500 hover:text-zinc-400`). Sized and de-emphasized correctly per spec. The text is "Skip — I'll find my way around." — verbatim. ✓

### Q9 — Footer (build info)

Present, accurate, low-emphasis (`text-xs text-zinc-600`). Conditionally renders only when `buildId` is provided. Disappears in non-welcome states which is correct since it's a welcome-screen footer. The contrast issue noted in Q6 (WARN-7) applies here.

### Q10 — Install-guide alignment

The install guide at `docs/beta/INSTALL-GUIDE.md:55` says:

> After that, you land on the launch screen. Choose **Open Demo Project** to start with something ready to explore right away.

That is now wrong. After the consent dialog, the user lands on `HelloFlintWelcome`, not the LaunchScreen. The instruction to "Choose Open Demo Project" is also stale because the welcome screen offers "Let's go →" as the primary action — the demo project doesn't appear until *after* the welcome is dismissed.

A tester following this guide will see the welcome and either (a) click skip (defeating Phase A's purpose) or (b) get confused because the guide says LaunchScreen but they see the welcome. (BLK-1 — the only blocking finding.)

The guide needs the section between "First launch" and "Send feedback" rewritten to describe the new sequence: consent → welcome → IDE setup or skip → launch screen → demo. This is a one-paragraph edit but it's the document closed-beta testers will use to install, so it has to match what they see.

---

## Findings table

| ID | Severity | Title | Scope |
|----|----------|-------|-------|
| BLK-1 | blocking | Install guide describes old BetaWelcome flow, not HelloFlintWelcome | one-file |
| WARN-1 | warning | Welcome card visually editorializes the spec's inline pitch | one-file |
| WARN-2 | warning | "Both" button activation rule and action don't align | one-file |
| WARN-3 | warning | "Looking for…" copy in connect-confirm reads as in-progress when detection has finished | one-file |
| WARN-4 | warning | No timeout guard on detection — slow disk hangs the spinner forever | one-file |
| WARN-5 | warning | Manual snippet Copy button has no success feedback | one-file |
| WARN-6 | warning | No focus management on state transitions inside the welcome | one-file |
| WARN-7 | warning | Build footer `text-zinc-600` on `bg-zinc-950` fails WCAG AA contrast (~3.96:1) | one-line |
| SUG-1 | suggestion | LaunchScreen still surfaces "Connect to IDE" — duplicate path to a now-deprecated flow | cross-file |
| SUG-2 | suggestion | Help panel "Re-run connection" requires app restart; should offer in-panel retry | one-file |
| SUG-3 | suggestion | `alreadyConnected` fires from both App.tsx and HelloFlintWelcome — redundant | cross-file |
| SUG-4 | suggestion | Welcome wrapper uses `role="region"` not `role="dialog"` — landmark accuracy | one-line |
| SUG-5 | suggestion | Rapidly-mounted live regions may not announce reliably across screen readers | one-file |
| SUG-6 | suggestion | "Writing config…", "Troubleshooting", "Manual setup" headings drift from designer-voice | one-file |

## Verdict

Counts: **1 blocking, 7 warnings, 6 suggestions** → `deriveVerdict()` returns `FIX-BEFORE-SHIP`.

The single blocking finding is the install-guide drift (BLK-1) — testers will be told a different flow than the one they'll see, which is the kind of miss that reads as "this thing is half-shipped" before the tester even forms a real opinion. It's a one-paragraph doc edit. Fix it and the verdict drops to FIX-FORWARD.

The seven warnings are all real but non-blocking — focus management, copy button feedback, the "Both" button mismatch, the contrast issue, and the slow-detection timeout are tractable fixes that are worth a fast-follow round but don't gate the closed-beta cohort.

The voice / suggestion items can ride into Phase B's coach panel work where the conversational voice gets a second pass.
