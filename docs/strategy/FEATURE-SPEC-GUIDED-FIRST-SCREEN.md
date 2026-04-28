# Feature Spec — Guided First Screen ("Hello, Flint")

**Status:** APPROVED (Justin, 2026-04-26)
**Audience:** Closed-beta testers, then public-beta strangers
**Replaces:** `BetaWelcome.tsx` and the buried StatusBar "Connect to IDE" affordance
**Owner direction:** Justin Tiemann

---

## The problem we're solving

A tester downloads Flint, opens it, and gets dropped into a generic welcome screen with a "Try Demo" button. They have no mental model of what Flint is, why connecting it to their IDE matters, or what the loop actually does. They click Demo, see a sample project, and never connect Flint to their AI assistant — so they're testing half the product without knowing it.

Worse: the existing BetaWelcome screen offers a button labeled "Set up IDE first" without ever explaining why. Engineer-speak. Most testers will skip it.

## The solution

A first-launch experience that **does the full Flint loop with the tester, end-to-end, in five minutes**. The tester paste a single prompt into their AI assistant, watches Flint guide the AI as it builds, sees Flint catch a custom value the AI couldn't proactively constrain, and chooses what to do about it. They leave with a real component on their canvas and a clear understanding of what Flint actually does.

## Design principles

1. **Flint does the work, not the user.** The IDE setup detects installed editors, writes the MCP config, preserves existing settings, and confirms when the connection is live. The user's only job is to verify reality matches.
2. **Earn each term.** "Token drift," "auto-fix," "MCP" — none appear before they're demonstrated. Each term gets introduced at the moment the user needs it.
3. **Tell the full story, not the janitor story.** Flint is the AI's collaborator, not its corrector. The proactive moment (AI building correctly because Flint guided it) is the hero. The reactive moment (Flint catching what couldn't be constrained) is the safety net.
4. **Honest choices, not corrections.** When drift is detected, the user is offered three paths: match an existing token, promote the new value into the system, or allow once. Flint respects the user's authority over their own design system.
5. **Real artifacts.** The component the tester builds is theirs. It stays in their project. They can keep building from it.
6. **Earned silence.** The coach goes quiet when the user is reading their IDE or watching the canvas. No filler narration.
7. **Graceful escape.** Skip-ahead, pause-and-resume, and stuck-help (after 30s of inactivity) are always available.

---

## Experience flow

### Welcome screen

Replaces `BetaWelcome.tsx`. Single primary path:

> # Welcome to Flint
>
> Flint has two halves. The app you just opened is where you see your designs, check accessibility, and review your tokens. The other half lives inside your AI assistant — Claude, Cursor, VS Code — and lets your AI use Flint while it builds for you.
>
> The fastest way to understand Flint is to build something.
>
> **Let's build your first screen** — guided, about 5 minutes. I'll walk you through the full loop — your AI building with Flint's guidance, Flint catching one thing it couldn't constrain, and you deciding what to do about it.
>
> [ Let's go → ]
>
> Skip — I'll find my way around. *(small text link)*
>
> Build 0.3.0-beta.1 · Expires in 60 days *(footer)*

### Step 0 — The silent setup

When the user clicks "Let's go," Flint runs a detection pass and presents a panel:

> **Let me set this up for you.**
>
> ◦ Found Claude Code on your machine ✓
> ◦ Found Cursor on your machine ✓
> ◦ Looking for VS Code… not found
>
> Which one should I connect first?
>
> [ Cursor ]   [ Claude Code ]   [ Both ]   [ I'll do this manually ]

User picks one. Flint reads their existing config file, merges in the Flint MCP entry while preserving every other MCP server they have configured, writes it back atomically, and presents:

> Done. I added Flint to your Cursor settings — your other MCP servers are untouched.
>
> If Cursor was running, restart it. Then look for a green dot next to "Flint" in your MCP panel.
>
> [ I see the green dot ✓ ]   [ Help — I don't see it ]

The Help panel shows three concrete fixes (full restart, check MCP menu, re-run connection), not a link to docs. The "I'll do this manually" option remains for power users — it shows them the snippet and where to paste it.

If the IDE is already connected at click time, Step 0 is skipped silently.

### Step 1 — The invitation

Glass opens with the canvas empty and a coach panel sliding in from the right (around 360px wide). The coach speaks like a friend:

> **Alright — here's what we're going to do.**
>
> Pop over to your AI chat and paste this exactly:
>
> ```
> Build me a sign-up form using my design system,
> with a custom red Submit button
> ```
>
> [ Copy ]
>
> Note that "custom red" — that part is intentional. Send it. I'll wait here. Watch the canvas when you come back.

Coach goes quiet. No spinner. No fake "thinking" dots.

### Step 2 — The proactive moment (the hero)

The moment Flint detects an MCP call from the AI, the canvas does a soft cross-fade as the component renders in. As each token is used, a tiny green tick briefly flashes beside it (`zinc-700`, `text-base`, `gap-2`).

> Look at what just happened.
>
> Every color, every spacing value, every text size — except one — came straight from your design tokens. Your AI didn't guess. It asked Flint for your system before it wrote a single line.
>
> Click any color in the form.

User clicks the input border. A small panel:

> **zinc-700** — defined in tokens.json, line 142
>
> [ Show me where ]

> Real token. Real source. Linked to your codebase. That's Flint guiding while your AI builds.

### Step 3 — The reactive moment (the safety net)

> But you asked for a custom red. Your AI did its best — used `#DC2626`. To your eye, fine. To Flint, a value that doesn't belong to your system yet.
>
> Click the badge.

The drift panel appears with three honest choices:

> **Custom red detected** — `#DC2626`
>
> Looks identical to `red-600` in your tokens. What do you want to do?
>
> [ Use red-600 instead ]   [ Add #DC2626 to my tokens as red-danger ]   [ Allow once ]

Each option behaves differently:
- **Use red-600 instead** — applies the existing token, edits the file, badge dims
- **Add #DC2626 to my tokens as red-danger** — opens a small naming UI, writes the new token to `design-tokens.json`, AND applies it to the component. The user has just extended their design system in one click.
- **Allow once** — accepts the custom value for this instance only, suppresses the badge for this file, doesn't change the token file. Suppression is per-file, per-session.

User picks one. The component updates. Toast confirms the file edit.

### Step 4 — The recap

The coach panel transforms — a sequence of one-liners that reveal one at a time, each with a small inline icon:

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

User clicks "I'm done." The coach panel slides out. The canvas is theirs.

---

## Variance handling — when the tester deviates

The flow above assumes the tester pastes the suggested prompt exactly and the AI generates the planned drift. Real testers deviate — they're designers, they're curious, they'll modify the prompt or write their own. The walkthrough must handle variance gracefully or the experience breaks for the most engaged users.

The design principle: **the walkthrough's structure is fixed (proactive moment → reactive moment → recap), but the specific content adapts to what actually happened.** No scripted line should depend on the tester pasting an exact phrase.

Four variance cases the walkthrough must handle:

### Case 1 — The tester modifies the prompt slightly

*"Build me a login form using my design system"* instead of *"sign-up form."* The AI calls Flint, builds something close to expectations. The walkthrough proceeds normally, but coach copy must avoid scripted references to specifics from the suggested prompt. Instead of *"you asked for a custom red"*, the coach says *"your AI used a value that doesn't fit your tokens yet"* — true regardless of what was asked.

### Case 2 — The tester writes a different prompt

*"Build me a card component"* or any other ask. The AI calls Flint and builds something. The walkthrough adapts:

- **Step 2 narration** reads the actual tokens used and names them in the coach copy. *"Your AI used `zinc-700`, `zinc-100`, and `text-base` — all from your design system."*
- **Step 3 click-to-source** works on whatever the AI built — no dependency on the prompt.
- **Step 4 finds the FIRST drift** in the actual output, regardless of what it is. If it's a hex color, narrate that. If it's an off-token spacing value, narrate that. The drift panel adapts to whatever was found.

### Case 3 — The AI was perfect, no drift to catch

Some AIs translate "custom red" directly to `red-600` without producing a hex value. The reactive moment (the safety-net story) has nothing to demonstrate. The walkthrough pivots honestly:

> Look at this — your AI used 100% tokens. That's how it should work most of the time.
>
> Want to see what happens when something doesn't fit? Try this:
>
> ```text
> Add a notification badge in pure crimson
> ```
>
> [ Copy ]

The follow-up prompt is designed to force a drift even with smart AIs. Once it triggers, the walkthrough resumes at Step 3 (the reactive moment).

### Case 4 — The AI didn't call Flint at all

Either the prompt was unrelated (*"What's the weather?"*) or the editor's MCP connection isn't actually live. After 30 seconds without an MCP call, the coach offers gentle recovery:

> Looks like your AI didn't talk to Flint this time. Two common reasons:
>
> ◦ Your editor needs a full restart so it picks up the new MCP server
> ◦ The prompt didn't ask for a build
>
> Want me to try the suggested prompt with you?
>
> [ Use suggested prompt ]   [ I'll try a different one ]

If the user clicks "Use suggested prompt", the walkthrough copies the prompt to clipboard automatically and prompts them to paste in their IDE — same as Step 1.

### What this implies for Phase B implementation

The walkthrough state machine has 4–5 paths instead of 1. Coach copy is templated rather than fixed strings (it interpolates tokens, drift values, and component types from the actual output). The detection layer reads what the AI actually produced, not what was expected. The drift panel is generic enough to handle any kind of violation, not just custom red.

This is more work than a scripted demo, but it's the difference between "the experience feels brittle" and "the experience feels alive." For a closed beta where every tester is a curious designer, that difference is the whole story.

---

## Phases of work

### Phase A — Welcome screen + smart IDE auto-connect

**Scope:** new welcome component, IDE detection service, MCP-config writer, atomic merge of existing settings, live "green dot" confirmation step, manual fallback path.

**Why first:** unblocks Phase B (the walkthrough cannot start without IDE connection), and the welcome screen replaces an existing component (BetaWelcome) so the integration is clean.

**Estimated complexity:** medium-high. Editor detection has cross-platform nuance (paths differ between macOS and Linux/Windows). Atomic config merge requires careful preservation of existing user settings. Connection-detection over the green-dot signal is the trickiest beat.

### Phase B — The guided walkthrough

**Scope:** coach panel component, state machine for the four-step sequence, MCP-call detection hook, real-time token-highlight animation in the canvas, click-to-source affordance polish, three-choice drift panel, "add to tokens" service, recap component.

**Why second:** depends on Phase A landing the IDE connection. The walkthrough is the brilliant moment but useless without setup.

**Detailed spec:** [FEATURE-SPEC-PHASE-B-WALKTHROUGH.md](./FEATURE-SPEC-PHASE-B-WALKTHROUGH.md) — full breakdown of components, state machine, variance handling, three sub-phases (B1 / B2 / B3), open questions, and risks.

**Estimated complexity:** high. The state machine needs to handle out-of-order events (user clicks before reading, user does steps in wrong order, user closes and reopens). The drift-panel "add to tokens" affordance writes to `design-tokens.json` — a real new feature surface that doesn't exist today.

### Phase C — Polish and post-tour persistence

**Scope:** progress save/resume on app close, "stuck for 30s" inline help, skip-ahead affordance, post-tour discoverability (LaunchScreen "Run guided tour again" entry, File menu "Open Sample" entry).

**Why third:** these are quality-of-life improvements that come into focus once the core experience is real.

**Estimated complexity:** medium. Mostly UI polish + persistence wiring.

---

## Things this spec deliberately leaves out

- A multi-demo catalog. The guided experience is the only demo for closed beta. Other sample projects can be added in a public-beta sprint when discoverability becomes a stranger-facing problem.
- A detailed backlog for "add to tokens" UX edge cases (naming conflicts, scope choice, undo). These need their own design pass once Phase B is landing.
- The voice/copy of the coach. The drafts here are the starting point, not final. The voice will be tuned during implementation as Justin reads it back in context.
- Localization. Closed beta is English-only.
- Telemetry events for the tour itself (start, complete, skip, drift-choice). Worth adding in Phase C once there's something real to measure.

## Risks and unknowns

- **Detection reliability.** Editor paths and config-file locations vary by platform and version. The detection pass needs graceful fallbacks for "Cursor is installed somewhere we didn't look."
- **Connection-detection signal.** The "I see the green dot" check is currently user-confirmed. A future version could observe the live MCP handshake and confirm automatically. For closed beta, user-confirmed is acceptable.
- **The custom-red prompt's reliability.** "Build me a sign-up form using my design system, with a custom red Submit button" needs to reliably produce the proactive + reactive flow. The demo project's tokens may need curation to make this deterministic.
- **The three-choice drift panel is a real new feature surface.** "Add to my tokens" writes to the live token file — needs careful contract design around naming, scope, and undo.

---

## Acceptance — what "done" means

A new tester downloads Flint, opens it, and within 5 minutes:
1. Has Flint connected to their IDE without ever opening a settings file themselves
2. Has paste a single prompt into their AI and watched it build
3. Has seen Flint visually prove that the AI used their design tokens
4. Has been offered a meaningful choice when a custom value was detected
5. Has a real component on their canvas they can keep editing
6. Can articulate, in their own words, what Flint does

That sixth bullet is the real test. If a tester can describe the loop after this experience, the spec succeeded. If they can't, we go back and tighten the recap.
