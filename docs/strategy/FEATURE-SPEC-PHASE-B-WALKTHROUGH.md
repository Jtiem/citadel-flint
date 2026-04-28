# Feature Spec — Phase B: The Guided Walkthrough

**Status:** DRAFT — for Justin's review (2026-04-26)
**Audience:** Closed-beta testers (and eventually public-beta strangers)
**Builds on:** [FEATURE-SPEC-GUIDED-FIRST-SCREEN.md](./FEATURE-SPEC-GUIDED-FIRST-SCREEN.md) (the parent feature)
**Phase A relationship:** Phase A delivers the welcome screen + smart IDE auto-connect. Phase B picks up the moment the welcome's "Let's go" path completes — the user has Flint connected to their editor, the canvas is fresh, and they're ready to build.

---

## Intent

Phase B is **the brilliant part of the experience** — the part where Flint stops being a generic "design system tool" and starts being something the tester remembers. It's the five minutes that decide whether they tell a colleague about Flint or quietly close the app.

The walkthrough has one job: **show the tester the full Flint loop, end-to-end, using their own AI assistant, with them in the driver's seat.**

By the end of Phase B, a tester can articulate, in their own words:

1. What Flint does (it guides their AI as it writes code, then catches what guidance can't fully constrain)
2. Why connecting to their IDE matters (because that's how their AI uses Flint)
3. How the safety net works (the three honest choices when something doesn't fit)
4. What's possible from here (their canvas now has a real component they built, theirs to keep editing)

If they can't do that after the tour, the walkthrough failed. Everything in this spec exists to serve that test.

---

## The user journey

The tester has just clicked "Let's go" from Phase A's welcome screen. The auto-connect has succeeded silently. The canvas is empty. Glass is open.

### Beat 1 — The greeting (5 seconds)

A coach panel slides in from the right side of the screen, ~360px wide, with a soft shadow and a warm tone. It does not dominate — the canvas is still the larger surface.

> **Alright — here's what we're going to do together.**
>
> I'll walk you through Flint's full loop in about five minutes. By the end, you'll have built something real with your AI, watched Flint catch a value that didn't fit your system, and decided what to do about it.
>
> [ Let's start → ]   [ Skip the tour ]

The coach has a soft ambient indicator — a gentle dot that pulses while it's "speaking" or waiting. It doesn't speak again until the user clicks Start.

### Beat 2 — The invitation (Step 1)

> Pop over to your AI chat — the one in your editor. Paste this exactly:
>
> ```text
> Build me a sign-up form using my design system,
> with a custom red Submit button
> ```
>
> [ Copy ]
>
> Note that "custom red" — that part is intentional. Send it. I'll wait here. Watch the canvas when you come back.

Coach goes quiet. The pulse dot stops. **No spinner. No fake "thinking." Just presence.**

If 30 seconds pass with no MCP activity detected, an inline help link appears below the prompt: *"Stuck? See common reasons →"* — clicking it opens a small inline panel with three checkpoints (full editor restart, MCP server visible in editor's MCP panel, prompt actually sent).

### Beat 3 — The proactive moment (Step 2)

The instant Flint detects the AI's first MCP call (typically `flint_get_context` or `flint_query_registry`), the coach quietly perks back up:

> Your AI is talking to Flint right now. Watch the canvas.

The pulse resumes. As the AI streams its response, the canvas does a soft cross-fade — the empty grid fades, the form materialises in. As each token gets used in the rendered output, a tiny green tick briefly flashes beside the value (`zinc-700` ✓, `text-base` ✓, `gap-2` ✓). These flashes are subtle, ~200ms each, lower-third opacity, never blocking.

Once the form has settled (~3 seconds after rendering completes), the coach speaks:

> **Look at what just happened.**
>
> Your AI used `[interpolated list of actual tokens]` — every value from your design system. Your AI didn't guess. It asked Flint for your tokens before it wrote a single line.
>
> Click any color in the form.

The user clicks the input border (or anywhere with a color). A small floating panel appears beside the click target:

> **`[token name]`** — defined in `tokens.json`, line `[N]`
>
> [ Show me where ]

If they click "Show me where," Glass briefly highlights the token definition in the inspector, OR (if their IDE is focused-on by the OS) flashes the editor with the file open at that line. Either way, the user sees that this isn't a magic value — it's tied to their actual codebase.

> Real token. Real source. Linked to your codebase. That's Flint guiding while your AI builds.

### Beat 4 — The reactive moment (Step 3)

> But you asked for a custom red. Your AI did its best — used `#DC2626`. To your eye, fine. To Flint, a value that doesn't belong to your system yet.
>
> Click the badge.

A small badge has been pulsing gently next to the Submit button since the form rendered. The user clicks it. The drift panel expands — and this is the brilliant beat.

> **Custom red detected** — `#DC2626`
>
> Side-by-side comparison:
>
> ```
> [ swatch: #DC2626 ]   [ swatch: red-600 (#DC2626) ]
>      AI's value         your token
> ```
>
> They look the same. They are not the same.
>
> What do you want to do?
>
> [ Use red-600 instead ]   [ Add #DC2626 to my tokens as red-danger ]   [ Allow once ]

Each option behaves differently and matters:

#### "Use red-600 instead" — conform

Closes the drift by mapping the AI's value to your existing token. Standard auto-fix flow:

- Edits `Button.tsx` (or wherever the violation lived) — replaces the hex with the token class
- Toast slides in: `✓ Edited Button.tsx · line 12 · #DC2626 → bg-red-600`
- Component re-renders with the token-resolved color (visually identical)
- Badge fades

#### "Add #DC2626 to my tokens as red-danger" — extend

This is the most distinctive moment. Flint promotes the AI's custom value into a real token in the user's design system:

- A small inline naming UI appears: `red-danger` is the suggested name, user can edit
- On confirm, the new token is written to `design-tokens.json` (atomic via FileTransactionManager)
- The component is updated to use the new token (`bg-red-danger`)
- Toast: `✓ Added red-danger to your tokens · #DC2626`
- Badge fades

The user has just **extended their design system in one click**. This affordance demonstrates that Flint is not a static rulebook — it's a system that grows with them.

#### "Allow once" — override

Accepts the custom value for this instance only. Doesn't change the token file. Doesn't auto-fix the code. Suppresses the badge for this specific occurrence:

- Suppression scope: per-file, per-session (lost on app restart)
- The user can revisit this decision later via the GovernancePanel's overrides surface
- Toast: `Allowed once · this drift suppressed for this session`

After the user picks one, the coach continues:

> Done. Flint just edited [your code | your tokens | nothing — we kept your override]. Take a look in your IDE if you want to see the change.

### Beat 5 — The recap (Step 4)

The coach panel transforms — instead of a single block of text, it reveals a sequence of one-liners with small inline icons. Each line appears one at a time, with a 600ms beat between them, like the tour is closing the loop physically:

> **Two things just happened.**
>
> ◦ Your AI used your design system because Flint was there to guide it
> ◦ When something slipped past guidance, Flint surfaced the choice and let you decide
>
> *(beat)*
>
> That's the loop. Both halves. Flint guides, then catches what guidance can't cover.
>
> The form on your canvas is yours. Keep building from it, or start fresh.
>
> [ I'm done ]   [ Try another prompt ]

User clicks "I'm done." The coach panel slides out smoothly. Glass is now in its normal mode — the form is on the canvas, in the user's project, on disk. They can save it, edit it, ask their AI to add to it, or start over.

If they click "Try another prompt," the coach panel stays visible but resets to Beat 2 — ready to walk them through another generation cycle. Useful for the curious.

---

## Components to build

### 1. CoachPanel.tsx

The dockable panel that hosts the entire walkthrough's narration.

- **Position:** docks to the right side of Glass, ~360px wide, full height
- **States:** speaking (pulse dot animating), waiting (pulse static), hidden (slide-out animation)
- **Content:** receives a renderable structure from the state machine — typically a heading, body paragraphs, action buttons, optional code block
- **Accessibility:** `role="dialog"`, `aria-live="polite"` for narration changes, focus management when buttons appear
- **Animation:** 300ms slide-in on mount, 300ms slide-out on dismiss

### 2. WalkthroughOrchestrator.ts

The state machine that drives the entire experience. Owns:

- The current beat (greeting / invitation / proactive / reactive / recap)
- The narration queue (what the coach says next)
- Detection subscriptions (MCP calls, clicks, token usage, drift events)
- Recovery paths (variance handling — see below)
- Skip and pause/resume logic

This is the brain of Phase B. Everything else is presentational. The orchestrator decides what beat to be in, what content to feed the CoachPanel, and what to do when something unexpected happens.

### 3. DriftChoicePanel.tsx

The three-choice drift panel that replaces the simpler "Fix" affordance for this experience. Renders:

- The detected drift (value + nearest token + side-by-side swatches)
- The three buttons (Use existing / Add new / Allow once)
- Inline naming UI for the "Add new" path

This is a NEW component. Flint already has drift surfacing today, but the three-choice presentation is new and worth designing carefully because it's the signature beat of the experience.

### 4. AddToTokensService.ts

The service that handles the "Add new token" path. Responsibilities:

- Suggest a name based on the value (e.g. `#DC2626` → `red-danger`)
- Validate the proposed name (no collision with existing tokens)
- Atomically write the new entry to `design-tokens.json` (via FileTransactionManager)
- Update the component's code to reference the new token instead of the raw value
- Emit a tokens-updated event so the rest of Glass refreshes

This is a NEW capability. Flint can audit and auto-fix today, but it doesn't promote drifts into the token system. This service makes that real.

### 5. AllowOnceSuppression.ts

Tracks the "Allow once" overrides. Per-file, per-session, in-memory only — lost on app restart by design (closed beta scope; Phase C may persist it).

- Stores a Set of `{ filePath, ruleId, value }` triples
- The Mithril linter checks this set before flagging a drift
- The GovernancePanel can list and clear active overrides

### 6. RecapReveal.tsx

A small presentational component that animates the recap one-liner-at-a-time reveal. Pure animation; no state.

### 7. TokenHighlightOverlay.tsx

The canvas overlay that flashes green ticks beside tokens as they're used in the rendering output. Subtle, brief, non-blocking.

This requires hooking into the LivePreview's render pipeline — when a token resolves, emit an event that the overlay listens for. The overlay positions a tick at the relevant DOM coordinate, fades it in, holds for 200ms, fades it out.

### 8. ClickToSourcePopover.tsx

The "click any color → see token source" affordance. Polished version of the existing inspector behavior.

Today there's a properties inspector that shows token information for the selected node. Phase B needs the same data accessible via direct click on a color value in the rendered preview. Likely involves a small popover that anchors to the click point and offers the "Show me where" action.

---

## State machine

```
              ┌──────────────────┐
              │   GREETING       │
              │   (Beat 1)       │
              └────────┬─────────┘
                       │ user clicks "Let's start"
                       ▼
              ┌──────────────────┐
              │   INVITATION     │
              │   (Beat 2)       │◀────────────┐
              └────────┬─────────┘              │
                       │ MCP call detected      │
                       ▼                        │
              ┌──────────────────┐              │
              │   PROACTIVE      │              │
              │   (Beat 3)       │              │
              └────────┬─────────┘              │
                       │ component rendered     │
                       │ + tokens flashed       │
                       ▼                        │
              ┌──────────────────┐              │
              │   CLICK-PROOF    │              │
              │   (Beat 3 cont.) │              │
              └────────┬─────────┘              │
                       │ user clicks color      │
                       ▼                        │
              ┌──────────────────┐              │
              │   REACTIVE       │              │
              │   (Beat 4)       │              │
              └────────┬─────────┘              │
                       │ user picks a choice    │
                       ▼                        │
              ┌──────────────────┐              │
              │   RECAP          │──"try again"─┘
              │   (Beat 5)       │
              └────────┬─────────┘
                       │ user clicks "I'm done"
                       ▼
                    [ EXIT ]
```

Plus recovery branches for variance (see below).

### Transition triggers

| From | To | Trigger |
|------|----|---------|
| GREETING | INVITATION | User clicks "Let's start" |
| INVITATION | PROACTIVE | First MCP call from AI detected |
| INVITATION | STUCK_HELP | 30s of no MCP activity |
| PROACTIVE | CLICK_PROOF | Component finished rendering + token flashes complete |
| CLICK_PROOF | REACTIVE | User clicks any color in canvas |
| CLICK_PROOF | REACTIVE_FORCED | If drift exists and user hasn't clicked, after 30s coach gently nudges |
| REACTIVE | RECAP | User picks one of three options + action completes |
| RECAP | INVITATION | User clicks "Try another prompt" |
| RECAP | EXIT | User clicks "I'm done" |
| ANY | EXIT | User clicks "Skip the tour" or closes Glass |

---

## Variance handling (the four cases)

The walkthrough must handle deviation from the suggested prompt. Each case has a recovery path that keeps the structure intact.

### Case 1 — Tester modifies the prompt slightly

Example: *"Build me a login form using my design system"* instead of *"sign-up form."*

**Recovery:** The coach copy in PROACTIVE/REACTIVE doesn't reference the specific prompt. Instead of *"you asked for a custom red"*, the coach says *"your AI used a value that doesn't fit your tokens yet."* True regardless of what was asked. No state-machine change needed — the templated copy handles it.

### Case 2 — Tester writes a different prompt

Example: *"Build me a card component"* — anything that produces a renderable result.

**Recovery:** The walkthrough adapts content but keeps structure:

- PROACTIVE narration reads the actual tokens used and names them. *"Your AI used `[token list]` — all from your design system."*
- CLICK_PROOF works on whatever was built — clicking any color shows its token source.
- REACTIVE finds the FIRST drift in the actual output, regardless of category. If it's a hex color, narrate that. If it's an off-token spacing value, narrate that. The DriftChoicePanel adapts to whatever Mithril found.

The orchestrator's PROACTIVE state reads the live `editorStore.linterWarnings` Map after rendering settles. The first drift becomes the focus of REACTIVE.

### Case 3 — AI was perfect, no drift to catch

Some AIs translate "custom red" directly to `red-600` without producing a hex value. Mithril finds zero drifts.

**Recovery:** Pivot to honest acknowledgment + escalation:

> Look at this — your AI used 100% tokens. That's how it should work most of the time.
>
> Want to see what happens when something doesn't fit? Try this:
>
> ```text
> Add a notification badge in pure crimson
> ```
>
> [ Copy ]

The follow-up prompt is designed to force a drift even with smart AIs. The orchestrator returns to INVITATION state, primed for the next MCP call. When the new component renders and Mithril finds drift, transition to REACTIVE as normal.

### Case 4 — AI didn't call Flint at all

Either the prompt was unrelated (*"What's the weather?"*), the editor's MCP connection isn't actually live, or the AI just chose not to call any tools.

**Recovery:** After 30s in INVITATION with no MCP activity, transition to STUCK_HELP:

> Looks like your AI didn't talk to Flint this time. Two common reasons:
>
> ◦ Your editor needs a full restart so it picks up the new MCP server
> ◦ The prompt didn't ask for a build
>
> Want me to try the suggested prompt with you?
>
> [ Use suggested prompt ]   [ I'll try a different one ]

If "Use suggested prompt" is clicked, the prompt copies to clipboard and the coach prompts them to paste in the IDE. Returns to INVITATION state.

---

## Polish features

### Stuck-help (30-second inactivity)

Each beat has a fallback inline help link that appears after 30s of no progress. The link's content is beat-specific:

- INVITATION: "Stuck? See common reasons" → opens the three-checkpoint help panel
- PROACTIVE: "Component not appearing? Try this" → reload preview / restart MCP suggestions
- CLICK_PROOF: "Don't see anything to click? Look here" → highlights a specific clickable area
- REACTIVE: "What do these mean? Click to learn" → expands inline glossary

### Skip-ahead

A small ✕ in the upper-right of the CoachPanel, always visible. Clicking it shows a quick confirm:

> Skip the rest of the tour? You can re-run it anytime from File → Open Sample → Run guided tour.
>
> [ Yes, skip ]   [ Cancel ]

If they skip, the coach panel slides out, the canvas keeps whatever's there (no rollback), and they're in the normal Glass workspace.

### Pause and resume

If the user closes Glass mid-walkthrough, the orchestrator persists its state to disk before exit. Next launch, BEFORE Phase A's welcome screen renders, Flint detects the in-progress tour state and asks:

> You were in the middle of the tour last time. Want to pick up where you left off?
>
> [ Yes, continue ]   [ No, start over ]   [ Skip the tour ]

If continued, the orchestrator restores the state and the coach panel slides in at the exact beat they left.

---

## Sub-phase breakdown (for the architect)

Phase B is large enough that the architect may want to split it into smaller contracts. Suggested breakdown:

### Phase B1 — CoachPanel + Orchestrator + happy-path

**Scope:** CoachPanel.tsx, WalkthroughOrchestrator.ts, the five beats with templated copy, MCP-call detection, basic state transitions, RecapReveal.tsx. Variance handling stubs (orchestrator can identify each case but recovery copy is minimal).

**Acceptance:** Tester pasting the exact suggested prompt sees the full walkthrough end-to-end.

### Phase B2 — DriftChoicePanel + AddToTokensService + AllowOnceSuppression

**Scope:** the three-choice drift panel, the add-to-tokens service (writes to `design-tokens.json`), the allow-once in-memory suppression set, the GovernancePanel surface for active overrides.

**Acceptance:** All three drift-resolution paths work. New tokens land in `design-tokens.json` atomically. Allow-once suppression survives within a session.

### Phase B3 — Click-to-source + TokenHighlightOverlay + Polish

**Scope:** ClickToSourcePopover.tsx, TokenHighlightOverlay.tsx (the green-tick flashes), full variance handling (all four cases polished), stuck-help, skip-ahead, pause/resume.

**Acceptance:** A tester can deviate from the suggested prompt, get distracted, close Glass, and resume — and still complete the loop.

---

## Open questions for Justin's call

1. **The recap reveal pace.** Currently spec says 600ms beat between lines. Faster (300ms) keeps momentum. Slower (1000ms) feels weighty. What's your read?

2. **The "Add to my tokens" naming UI.** Should the suggested name (`red-danger`) be editable inline before the user confirms, or is the suggestion non-negotiable for V1 and the user can rename later in the tokens panel?

3. **The `Allow once` suppression scope.** Spec says per-file, per-session — lost on restart. Should it persist (per-file, forever) instead? Closed beta is small enough that either works; what's the right default for the closed beta?

4. **The follow-up prompt for case 3 (AI was perfect).** I drafted *"Add a notification badge in pure crimson."* That should reliably force a drift. If your testers' AIs are particularly clever and conform that too, we may need a stronger nudge. Do we want a fallback prompt? Or accept that the safety-net story is best-effort and the proactive story alone is enough?

5. **Pause and resume.** Is mid-walkthrough state-persistence worth building for closed beta? The 10 testers are unlikely to close the app mid-tour. Could defer to public beta. What's your call?

6. **The coach voice.** All copy in this spec is the friendly designer-to-designer voice you approved earlier. Worth a re-read in context — anything sounds off, change it now.

7. **The "Try another prompt" path.** If they click it after the recap, should the coach reset to Beat 2 (Invitation) ready for another generation? Or should it offer a curated second prompt with a different drift category (so they see Mithril catching, say, a typography drift instead of color)?

---

## What this spec deliberately leaves out

- **Multi-language localization.** Closed beta is English-only.
- **Telemetry events for the tour itself.** Worth adding for analytics on where testers drop off, but not in scope for Phase B's first cut. Phase C if needed.
- **The "Try another prompt" curated catalog.** If we add it (question 7), it's a Phase C task.
- **Coach customization.** Could let the user adjust the panel's position or width. Not in scope.
- **Sound effects.** Not in scope. Some demos use a soft chime on the reveal moment; for closed beta we ship silent.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Tester's AI doesn't call Flint MCP** | Medium | High (breaks the demo) | Stuck-help in INVITATION at 30s + recovery dialog |
| **Smart AI conforms even "custom red" to a token** | Medium | Medium (case 3) | Follow-up prompt designed to force drift |
| **`design-tokens.json` write conflicts with user's manual edits** | Low | High (lost work) | FileTransactionManager + atomic write + read-merge-write under lock |
| **Real-time token highlighting causes canvas jank** | Medium | Medium (degrades the moment) | Throttle the overlay; cap concurrent ticks; performance test |
| **Click-to-source on dynamically-generated DOM is unreliable** | Medium | Medium | Anchor by computed-style match, fall back to inspector |
| **Pause-and-resume state corruption across schema changes** | Low | Medium | Version the persisted state; treat unknown versions as fresh start |
| **Three-choice drift panel feels overwhelming** | Low | Medium | Test in usability with the closed-beta cohort; iterate |

---

## Acceptance — what "done" means

A new tester downloads Flint, completes Phase A (auto-connect), completes Phase B (the walkthrough), and within 5–7 minutes:

1. Has used their AI assistant to build a real component
2. Has watched Flint visually prove the AI used their tokens
3. Has been offered a meaningful choice on a custom value
4. Has either matched, extended, or overridden — and seen the result reflected in their code
5. Has a real component on their canvas they can keep editing
6. Can describe Flint's loop in their own words to a colleague

The sixth point remains the real test. If a tester's description of the experience matches the spec's framing — "Flint guides my AI as it builds, and catches what guidance can't constrain" — Phase B succeeded.
