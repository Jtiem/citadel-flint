# Flint — Demo Script

**Audience:** Private beta designers (non-technical)
**Total time:** ~10 minutes
**Goal:** Show AI + Flint ships safer UI code than AI alone.

---

## Before You Start

1. **Build the engine:** `cd ~/Lunar-Elevator-Bridge/flint-mcp && npm run build`
2. **Launch Glass (web):** `cd ~/Lunar-Elevator-Bridge && npm run dev:web`
3. **Reset fixtures:** `git restore demos/ build-resources/demos/`

Flint Glass opens in the browser. The LaunchScreen shows three demo scenarios.

---

## Opening (30s)

> "AI writes UI code fast. Fast is not safe. Colors get eyeballed, tokens get ignored, accessibility gets skipped. You don't find out until it's in your hands.
>
> Flint is the governance layer that sits between the AI and production. Here's what that looks like."

---

## Demo 1 — AI Without Governance vs AI With Flint (2 min)

**In LaunchScreen, click "AI without governance"** → loads `dashboard-before`.

Let the audience see the dashboard — hardcoded orange, zero radius, brutalist type.

> "This is what the AI generated when nothing was enforcing the design system. The brand is purple. The tokens are there. The AI ignored both."

**Click "AI with Flint"** → loads `dashboard-after`.

Same component, generated with Flint constraints on — real tokens, brand palette, a11y pass.

> "Same prompt. Constraints on. This is the outcome we're after."

---

## Demo 2 — The Full Workflow (3 min)

**Click "Try the full workflow"** → loads `multi-component-app`.

Glass opens to a 5-component SaaS dashboard. The governance panel shows health score ~65 (grade D).

> "Five components. Mixed quality — one reference, one F-grade data table. The kind of real codebase you inherit."

**Say "sweep"** in the chat (the agent calls `flint_swarm_audit_fix`).

Watch the health ring climb from 65 → ~84 as Flint auto-fixes color drift, a11y labels, missing roles.

> "Flint fixed what it could — colors snapped to tokens, labels added, aria roles placed. The score climbs to B."

**Click Export.**

Gate blocks. The dialog lists DataTable a11y issues that need manual review — contrast, semantic table structure.

> "Gate won't let you ship what auto-fix can't reach. These need human eyes. That's the point."

---

## Demo 3 — Mithril Catches What Your Eyes Miss (2 min)

**Open `demos/03-mithril-shadow-audit/drift-component.tsx`.**

Pricing card. The "Pro" plan header and CTA look fine. They aren't.

**Say "audit"** in the chat.

Mithril reports 3 MITHRIL-COL violations. Header uses `#0055EE` — ΔE 4.6 from brand primary. Badge uses `#FF3333` — ΔE 8.1 from brand danger.

> "Your eyes miss it. The AI eyeballed colors from a Figma screenshot. Perceptually wrong, visually almost identical. CIEDE2000 catches this."

**Say "fix"** — Flint snaps the drift values back to tokens.

---

## Demo 4 — Warden Finds 31 A11y Failures (1.5 min)

**Open `demos/04-sentinel/violating-ux.tsx`.**

An AI-generated order form: 10 action buttons in a toolbar, 16 always-visible fields, no landmarks.

**Say "check accessibility."**

Warden reports 31 violations across Hick's Law, Miller's Law, landmark structure, and WCAG 2.1 AA contrast.

> "One form. Thirty-one accessibility failures. An AI that didn't know the rules produced it. A designer testing it in one minute would have missed most of them. Flint didn't."

---

## Closing (1 min)

> "You saw three things:
>
> — AI with and without governance produces different code.
> — Flint fixes what it can and gates what it can't.
> — Flint catches violations your eyes cannot see.
>
> That's the entire pitch. Everything else is a feature."

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Demo picker shows nothing | `npm run dev:web` logs show the project path — check `build-resources/demos/` is present |
| Health score doesn't animate | Refresh; the governance panel polls on mount |
| Export Gate doesn't appear | Check the StatusBar — Gate lives in the bottom-right corner |
