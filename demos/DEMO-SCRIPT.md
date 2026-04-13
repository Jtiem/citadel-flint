# Flint — Live Demo Script

**Order:** Demo 1 → Demo 2 → Demo 3 → Demo 4 → Demo 7 → Demo 9 → DBOM Bonus
**Audience:** Engineers and technical stakeholders
**Total time:** ~24 minutes

---

## Before You Start (5 min before doors open)

Run these three commands in sequence. Copy and paste each one.

**1. Reset the demo fixtures:**
```
cd ~/Lunar-Elevator-Bridge && git restore demos/ && git restore .flint/design-tokens.json
```

**2. Build the MCP engine:**
```
cd ~/Lunar-Elevator-Bridge/flint-mcp && npm run build
```

**3. Launch Flint:**
```
cd ~/Lunar-Elevator-Bridge && unset ELECTRON_RUN_AS_NODE && npm run dev
```

Flint Glass should open on your screen. You're ready.

---

## Opening (1 min)

> "AI writes UI code fast. The problem is that fast is not the same as safe. Tokens get hardcoded. Prop contracts get misread. Components land in codebases with no accessibility attributes, no design system references, and no way to audit them at scale.
>
> Flint is the governance layer between the AI and production. Let me show you four things it does that no other tool does."

---

## Demo 1 — The Governance Definition of Compliant (2 min)

**Open this file in your IDE:**
`demos/01-rag-ui-builder/banner-compliant.tsx`

> "Here's a component a developer submitted for review. Flint IDs on every element. Semantic HTML throughout. Well-structured props."

Let the audience look at it for a few seconds. Don't read it aloud.

> "Would you approve this PR?"

**In Claude Code, type:**
```
/audit demos/01-rag-ui-builder/banner-compliant.tsx
```

Show the violation report — five Mithril violations, three A11y failures.

> "Flint wouldn't. Five design system violations. Three accessibility failures. This is *banner-compliant.tsx* — the name is what a developer calls compliant."

**Pause.**

> "That's the difference between code review and governance infrastructure. The governance engine doesn't read intent. It reads the contract."

Transition:

> "Now let me show you what AI-generated code looks like with no governance at all."

---

## Demo 2 — AI Output That Fails Silently (3 min)

**Open this file in your IDE:**
`demos/02-self-correcting/buggy-component.tsx`

> "This is what an AI produced when it misread a prop contract. Looks completely fine."

Point to the code — you don't need to read it, just gesture at it.

> "Three type errors. A string assigned to a number. An extra callback parameter that doesn't exist in the interface. An invalid literal. All invisible without a compiler running."

**In Claude Code, type:**
```
/audit demos/02-self-correcting/buggy-component.tsx
```

Show the response.

> "Flint ran a type check in memory before surfacing this as a diff. The user never saw a proposed change. If it doesn't type-check, it doesn't reach you."

**Pause.**

> "Every AI coding tool generates diffs. Flint decides which diffs are allowed to exist."

---

## Demo 3 — Color Drift You Can't See (4 min)

**Open this file in your IDE:**
`demos/03-mithril-shadow-audit/drift-component.tsx`

> "A featured pricing card. It looks like the brand. Let me show you why it isn't."

Point to the three inline `backgroundColor` values: `#0055EE` on the header, `#0055EE` on the CTA button, and `#FF3333` on the badge.

> "The design system has two blues: primary `#0066FF` and primary-hover `#0052CC`. This developer used `#0055EE` — it sits between them. Not quite primary, not quite primary-hover. The kind of thing you get when you eyeball a color from a Figma screenshot at 75% zoom."

**In Claude Code, type:**
```
/audit demos/03-mithril-shadow-audit/drift-component.tsx
```

Show the three MITHRIL-IST-COL violations. Read the first one aloud:

> "Delta-E 4.6. This is a perceptual color distance — the same model used in ISO print production. The human threshold is 2.0. Anything above that, a person with normal vision will notice the difference under standard lighting. 4.6 means they will notice."

Point to the badge violation.

> "The badge uses `#FF3333`. Design system danger is `#DC2626`. Delta-E 8.1. Same color family — red — but at 8.1 your QA team can see the difference between these two reds in a side-by-side review."

**In Claude Code, type:**
```
/fix demos/03-mithril-shadow-audit/drift-component.tsx
```

Show the corrected file.

> "Every hardcoded hex replaced with its nearest design token. One call. Deterministic. If Delta-E exceeds 2.0, Flint fixes it or blocks export — your choice."

---

## Demo 4 — UX Law Violations (3 min)

**Open this file in your IDE:**
`demos/04-sentinel/violating-ux.tsx`

> "This is an AI-generated order management screen. Let me count something for you."

Scroll to the toolbar section and count the buttons aloud or point to them.

> "Ten buttons. All the same visual weight. No primary action. No hierarchy. This is a Hick's Law violation — the more undifferentiated choices you present, the longer it takes a user to decide. AI doesn't know about Hick's Law."

Scroll down to the form.

> "Eighteen fields, all visible at once. No progressive disclosure. Miller's Law says working memory holds seven items. Eighteen is more than double that. Every field you add reduces the perceived importance of the fields before it."

**In Claude Code, type:**
```
/audit demos/04-sentinel/violating-ux.tsx
```

Show the 31 violations: 18 critical (unlabeled inputs, div click handlers), 13 warnings.

> "31 accessibility violations. 18 of them critical: every input on the form is invisible to a screen reader. The governance engine doesn't need to know about UX laws — it knows about WCAG 2.1 AA, and form inputs without programmatic labels fail 1.3.1."

**Pause.**

> "Flint catches UX law violations as a side effect of enforcing accessibility standards. The two are not separate problems."

---

## Demo 7 — One Command, Whole Codebase (3 min)

> "That was one file. Let me show you what happens at scale."

**In Claude Code, type:**
```
/report demos/**/*.tsx
```

Read the numbers aloud:

> "Six files. Multiple with violations. Health score in the 40s. Grade D."

**In Claude Code, type:**
```
/sweep demos/**/*.tsx
```

Show the summary response.

> "Files scanned: six. Violations fixed across the board. Health score climbs significantly with one command."

> "No individual tool calls. No per-file instructions. The swarm ran audit and fix in parallel across all six files and gave me a breakdown per file."

Point to `drift-component.tsx` in the file reports.

> "Three color drift violations, zero remaining. That's the same file we just audited manually — now swept automatically as part of a batch."

**In Claude Code, type:**
```
/report demos/**/*.tsx track: true
```

> "This snapshot goes into version history. You can chart regressions in CI. Every deploy, Flint scores your codebase the same way."

---

## Demo 9 — Drag, Drop, Undo (4 min)

> "Everything so far has been the headless engine — running in your IDE, in CI, in the cloud. This is Flint Glass. The observability layer."

Point to the canvas.

> "No code editor. No terminal. No chat. The chat lives in Claude Code or Cursor. This is what Flint shows you about your codebase — live preview, governance badges on every component, version history in the sidebar."

Drag a file from the left panel onto the canvas drop zone. Show the blue ring as you hold it.

Release.

> "Flint parsed that file's structure, identified its top-level export, and synthesized the import into the active file."

Switch to your IDE and show the active file. Point to the new import at the top.

> "No clipboard. No template string. It was a structural operation — the import was merged, not appended."

Hit `Cmd+Z`.

> "Gone. The source file was never touched. Every gesture on this canvas is a structured operation with a full undo chain. That's the difference between a visual tool and a governance tool."

---

## Bonus — Design Bill of Materials (2 min)

> "One more thing. This shipped last sprint."

**In Claude Code, type:**
```
/dbom
```

Show the output.

> "A machine-readable manifest of every design token in your codebase, every component, whether it's compliant, and a project health score. The same idea as a software bill of materials — but for your design system."

> "You can generate this in CI on every deploy. If a token goes uncovered, you know immediately. If compliance drops, you know why."

---

## Close (2 min)

> "What you just saw:
>
> — An AI output with type errors, blocked before anyone sees a diff
> — Color drift detected by perceptual distance, fixed deterministically
> — 31 accessibility violations in a single AI-generated form, caught automatically
> — An entire codebase swept and scored with one command
> — A cross-file component composition from a drag gesture, with full undo
> — A design system bill of materials generated on demand
>
> Flint runs anywhere — CI, your IDE, the cloud. The governance engine is headless and scriptable. It doesn't care what IDE your team uses.
>
> The invariant is simple: AI-generated UI code that violates your design system, your accessibility contract, or your type system does not reach production. That's what infrastructure means."

---

## Timing Guide

| Section | Target |
|---------|--------|
| Opening | 1:00 |
| Demo 1 — Governance definition of compliant | 2:00 |
| Demo 2 — AI type errors | 3:00 |
| Demo 3 — Color drift | 4:00 |
| Demo 4 — UX law / a11y violations | 3:00 |
| Demo 7 — Swarm sweep | 3:00 |
| Demo 9 — Canvas drag/drop | 4:00 |
| DBOM Bonus | 2:00 |
| Close | 2:00 |
| **Total** | **~24:00** |

**If you're running long:** Cut the DBOM bonus first (drop 2 min). Demo 9's undo step can be skipped to save another 90 seconds. Demo 4 can be compressed to 90 seconds by skipping the Hick's/Miller's Law framing and going straight to the audit count. Demo 1 can be compressed to 90 seconds by skipping the pause beat — but don't cut it entirely. It sets the frame for everything that follows.

**If something breaks in Demo 9:** Stay calm, say "Flint Glass is the observability layer — the engine itself is headless. Everything you saw before this runs without it." Then jump to the close. The four MCP demos are the story.

**Delta-E reference card** (for Q&A):
- `#0055EE` vs `color.primary-hover (#0052CC)` → ΔE **4.6** (amber — human threshold 2.0)
- `#FF3333` vs `color.danger (#DC2626)` → ΔE **8.1** (amber — critical threshold 10.0)
- Human JND (just-noticeable difference) in CIEDE2000: ~2.3 under D65 illuminant
