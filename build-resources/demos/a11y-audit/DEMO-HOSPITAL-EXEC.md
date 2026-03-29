# Flint — Executive Demo: Healthcare Compliance
**Audience:** Hospital systems executive (networking / IT infrastructure background)
**Total time:** ~18 minutes
**Core message:** Flint is governance infrastructure for AI-generated code — the same way network infrastructure enforces routing policy regardless of device, Flint enforces compliance regardless of which AI generates the code.

---

## What You're Running

Two apps will be open side by side during this demo:

- **Claude Code** — the terminal window where you talk to the AI. This is where prompts are typed and code is generated. Think of it as the AI's workspace.
- **Flint Glass** — the governance dashboard that opens as a separate desktop window. This is where violations appear, the live preview renders, and the Export Gate fires.

You'll switch between them deliberately. The audience sees both.

---

## Setup (Do This 5 Minutes Before)

**Step 1 — Open Terminal and run these three commands:**

```bash
cd ~/Lunar-Elevator-Bridge && git restore build-resources/demos/a11y-audit/
```
This resets all demo files to their clean starting state. Run this every time you want to reset.

```bash
cp build-resources/demos/a11y-audit/design-tokens.json .flint/design-tokens.json
```
This loads Summit Health's brand colors into Flint. Without this, the Mithril brand violations won't appear. You'll know it worked if the terminal returns with no error.

```bash
unset ELECTRON_RUN_AS_NODE && npm run dev
```
This launches Flint Glass. After about 10 seconds, a desktop app window will open. It has a dark status bar at the bottom and an empty canvas in the center. Leave it open.

**Step 2 — Open Claude Code in a separate window:**

Claude Code is a terminal-based interface. Open a new terminal window and type `claude` to start a session. You should see a prompt where you can type.

**Step 3 — Arrange your screen:**

Put Claude Code on the left half of your screen. Put Flint Glass on the right half. The audience should be able to see both. If you're presenting on a single external monitor, full-screen each one and switch between them intentionally — narrate the switch ("now let me show you what Flint sees").

**Step 4 — Confirm everything is working:**

In Claude Code, type:
```
what files are in the current directory?
```
You should get a response. In Flint Glass, the status bar at the bottom should show a green indicator. If Flint Glass shows a loading spinner that never resolves, quit and rerun `npm run dev`.

---

## Opening (2 min)

You're in Flint Glass for this. Nothing to click — just talk.

> "You spent years building network infrastructure for hospitals. The fundamental rule was simple: it doesn't matter which device connects, which vendor made the switch, which engineer configured it — the routing policy is enforced. A misconfigured endpoint can't bring down the hospital network because the infrastructure won't allow it.
>
> AI is now writing the code that runs in your patient-facing systems. And right now, there is no infrastructure layer for that. The AI decides what colors to use. The AI decides whether form fields are labeled. The AI decides whether error messages are announced to screen readers. And in most engineering teams today, the only check is a human code reviewer who probably won't catch any of it.
>
> Let me show you that happening live."

Switch to Claude Code.

---

## Round 1 — AI Without Governance (5 min)

**You are in Claude Code.**

> "I'm going to give an AI a real prompt. The kind an engineer on your team would write."

Type this prompt exactly and press Enter:

```
Build a patient intake form for Summit Health with fields for first name,
last name, date of birth, and a consent to treatment checkbox. Use React
with inline styles. Save it as PatientFormDemo.tsx.
```

The AI will start generating code. You'll see it streaming into the terminal line by line. Let it run — don't narrate the code as it appears. Turn to your audience while it generates:

> "An engineer on your team could type this prompt. They'd review the output, think it looks correct, and open a pull request."

When generation finishes, the terminal will return to the prompt. The file `PatientFormDemo.tsx` will be in your project directory.

Now type:

```
/audit PatientFormDemo.tsx
```

Wait for Flint's audit to run. This takes 3–5 seconds. The output will appear in Claude Code as a formatted list of violations.

Read the total count aloud when it appears:

> "Eight violations. Six from Warden — that's the accessibility engine — and two from Mithril, which is the brand compliance engine."

Point to the first group in the output and read selectively — don't read every violation, just these three:

> "Six WCAG 2.1 AA violations. That's the federal accessibility standard. Let me read a few:
>
> — The first name, last name, and date of birth fields have no labels. A screen reader announces them as 'edit text.' A patient using assistive technology cannot tell what they're filling in.
>
> — If a required field is missing and the form shows an error, that error is silent. Screen readers don't announce it. A patient who can't see the screen will never know why the form won't submit.
>
> — The consent to treatment checkbox cannot be operated by a screen reader. The label isn't associated with the control.
>
> This is a consent form for medical treatment. These aren't UX problems. They're patient safety failures."

Now point to the Mithril violations at the bottom of the output:

> "Separately — two brand violations. The button color the AI chose is not Summit Health's corporate blue. The perceptual distance between the two blues is measurable on the CIEDE2000 scale — the same system used in ISO print production. Your patients and your board would see the difference.
>
> The error text color is even more interesting. That violation is below the threshold of human perception. You cannot see it. Neither can your developer. Flint flags it regardless."

**Now the VoiceOver moment.**

Switch to Flint Glass. The canvas may already show a preview of the generated form — if not, it will appear within a few seconds as Flint picks up the new file.

> "I want you to hear this, not just read it."

Press `Cmd + F5` to turn on macOS VoiceOver. A voice will say "VoiceOver on."

Click once inside the Flint Glass preview panel to focus it, then press `Tab` slowly — once every 2 seconds. The VoiceOver voice will read each element aloud as you tab through the form.

The audience will hear something like: *"Edit text. Edit text. Date picker. Checkbox, unchecked. Submit button."*

No field names. No context. The consent checkbox announces no label.

> "That is what a patient using a screen reader experiences on this form. The AI had no idea."

Press `Cmd + F5` again to turn VoiceOver off.

**Now the Export Gate.**

Look at the bottom status bar of Flint Glass. You'll see a red indicator labeled "Gate: Blocked" or a red Export button. Click it.

A panel will appear listing all violations. It will not let you proceed.

> "Blocked. This code cannot leave the codebase until every one of these is resolved. That's not a warning. That's a gate."

Pause. Let the audience look at the blocked state.

> "On your network, a packet that violates the routing policy doesn't get routed. Same principle."

---

### If Live Generation Doesn't Produce 10 Violations

Claude's output varies. If the audit returns fewer violations, narrate what you see:

> "The AI got some of it right this time — [X] violations remain. The enforcement is the same."

If you need the full 10-violation version, say: "Let me pull up a version I preserved from an earlier run."

Switch to your IDE and open `build-resources/demos/a11y-audit/PatientForm.tsx`. Run `/audit` on that file and continue from there.

---

## Round 2 — The Same Prompt, With Governance (4 min)

**You are in Claude Code.**

> "Same prompt. Same AI. The difference is that Flint's governance constraints are now active — Summit Health's design token system and accessibility rules are injected into the generation context before the AI writes a single line."

Type this in Claude Code:

```
/flint_design_to_code Build a patient intake form for Summit Health with
fields for first name, last name, date of birth, and a consent to treatment
checkbox. Save it as PatientFormGoverned.tsx.
```

The difference from Round 1: `/flint_design_to_code` tells Flint's Mason pipeline to run this generation. Before Claude writes anything, Flint injects Summit Health's brand tokens and accessibility rules into the prompt. The AI doesn't choose colors — the tokens do. The AI doesn't decide whether to add labels — the rules require them.

Let it generate. Turn to your audience while it runs:

> "The AI is getting the same instruction. But now it's working inside a governed context. The design system and the accessibility contract are part of the brief."

When generation completes, type:

```
/audit PatientFormGoverned.tsx
```

When the result appears:

> "Zero violations. Every input has an explicit label. The error message carries role='alert' — it's announced immediately when it appears. The consent checkbox is properly associated. The button color references Summit Health's design token — not a hardcoded hex that drifts the moment someone eyeballs it."

**Turn VoiceOver on again: `Cmd + F5`**

Switch to Flint Glass. The preview should update to show the governed form. Click into the preview and Tab through it slowly.

The audience will hear: *"First name, required, edit text. Last name, edit text. Date of birth, date picker. I consent to treatment, checkbox unchecked. Submit intake form, button."*

> "Every field named. Consent is readable. The button says what it does."

Press `Cmd + F5` to turn VoiceOver off.

**Attempt export.**

Click the Export button in the Flint Glass status bar. This time it opens a confirmation, not a block.

> "Approved."

Pause.

> "The AI didn't get smarter. It got governed. The infrastructure made noncompliance impossible — the same way your routing policy made misconfigured traffic impossible."

---

### If Governed Generation Doesn't Produce Zero Violations

Open `build-resources/demos/a11y-audit/PatientFormFixed.tsx`, run `/audit` on it, and continue. The violations will be zero.

---

## The Compliance Receipt (3 min)

**You are in Claude Code.**

> "Here's the question your legal team will eventually ask: 'Can you prove that every patient-facing screen your engineers shipped this quarter is ADA compliant?' Right now, the honest answer for most organizations is no.
>
> After Flint:"

Type:

```
/dbom
```

A Design Bill of Materials will be generated and printed in the terminal. It includes: every design token in the codebase, every component, whether each is compliant, what violations exist, which have been remediated, and a project health score.

> "This is the document your legal team gets. Machine-readable. Timestamped. Auditable. The same culture of documentation you built for HIPAA compliance on the network side — now applied to the UI layer."

---

## Round 3 — When the AI Itself Is the Threat (2 min)

You're still in Claude Code. No new commands needed — describe what would happen.

> "One more thing. Your engineers aren't the only ones feeding prompts into AI systems. Your vendors are. Third-party integrators are. And increasingly, AI agents are calling other AI agents. The attack surface is the prompt itself.
>
> What happens when an AI — through a compromised prompt, a supply chain attack, or a bad instruction — tries to inject code that shouldn't be there?"

> "Flint's Sentry engine scores every mutation on a risk scale from 0 to 100. An outbound network call from a patient intake form — that's a Red-tier mutation. It would be blocked before it reaches the codebase, and the attempt would be logged.
>
> Think of it as intrusion detection for AI-generated code. The same principle as your network security layer: traffic that shouldn't exist doesn't get through, and the attempt is recorded."

Pause.

> "You built infrastructure that routed packets correctly and blocked the ones that shouldn't be routed. Flint is that layer for AI code. It enforces the contract regardless of who — or what — wrote the code."

---

## Close (1 min)

> "Three things you can now do that you couldn't before:
>
> One — Know with certainty that every AI-generated patient-facing screen is WCAG 2.1 AA compliant before it ships.
>
> Two — Produce a timestamped compliance manifest on demand. When legal asks, you have the answer.
>
> Three — Block AI-generated code that deviates from your design standards or attempts unauthorized behavior — automatically, at the gate, before it touches production.
>
> Flint runs in CI, in your IDE, in the cloud. It doesn't care which AI your engineers use. The governance layer is the invariant."

---

## Timing Guide

| Section | Target |
|---------|--------|
| Opening | 2:00 |
| Round 1 — Live AI generation + audit | 5:00 |
| Round 2 — Governed generation | 4:00 |
| Compliance receipt (DBOM) | 3:00 |
| Round 3 — AI injection threat | 2:00 |
| Close | 1:00 |
| **Total** | **~17:00** |

---

## Contingencies

**VoiceOver won't start:** Skip the audio beat entirely. Say: "Normally I'd demonstrate this with a screen reader — but what you're looking at is a form where none of these inputs have names. Any assistive technology user is navigating blind."

**Audit returns a different violation count:** Narrate what appeared. "The AI got some of it right this time. The enforcement catches whatever it missed." If you need the exact 10-violation demo, switch to the PatientForm.tsx fixture.

**Flint Glass doesn't update to show the generated form:** Click anywhere in the canvas area to refresh the view. If it still doesn't appear, open the file manually via the left panel file browser.

**Export Gate doesn't fire:** Check the bottom status bar — if it shows a green indicator, the Gate may be set to warn rather than block. If you can't fix it quickly, say: "In a production Flint deployment this export would be blocked — let me show you Round 2 instead." Move on.

**Questions about which AI it works with:** "Any AI that generates code — Claude, GPT-4, Gemini, Copilot. Flint audits the output, not the model. The model is irrelevant to the governance layer."

**Questions about HIPAA specifically:** "Flint addresses the ADA accessibility layer and design system compliance. For HIPAA's PHI handling requirements, that's the data layer — Flint is the UI layer. But the compliance receipt model is directly analogous: timestamped, machine-readable, auditable."
