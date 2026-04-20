# Flint — Demo Runbooks

Presenter-facing step-by-step guides for each beta demo. Use this when walking a stakeholder through a single demo; use [DEMO-SCRIPT.md](DEMO-SCRIPT.md) for the full 10-minute sequence.

**Prerequisites:**

```sh
cd flint-mcp && npm install && npm run build
cd ~/Lunar-Elevator-Bridge && npm run dev:web
```

---

## Runbook 1 — Full Workflow (`multi-component-app`)

**Time:** ~3 min
**Citadel coverage:** Mithril + Warden + Sweep + Gate + Counsel
**Audience:** Everyone. This is the hero demo.

### Setup
- LaunchScreen → click "Try the full workflow"
- Loads `build-resources/demos/multi-component-app/`
- Components: `Dashboard.tsx` (A), `NavBar.tsx` (B), `MetricCard.tsx` (B), `AlertBanner.tsx` (D), `DataTable.tsx` (F)
- Starting health: ~65/100 (grade D)

### Steps
1. **Open the governance panel** — show the health ring at ~65.
2. **Say "sweep"** → agent calls `flint_swarm_audit_fix` with `autoFix: true`.
3. **Watch the ring climb toward ~84 (grade B)** as auto-fixable violations resolve.
4. **Click Export** in the StatusBar.
5. **Gate blocks** — dialog lists remaining manual a11y issues in `DataTable.tsx` (contrast, semantic table).
6. **Say "what's blocking export?"** → plain-language explanation.

### What to highlight
- The health score is the same number in every surface (StatusBar, dashboard, debt report, DBOM).
- Sweep is deterministic, not probabilistic — the same input produces the same output.
- Gate blocks on rules the engine can't auto-fix safely.

---

## Runbook 2 — Dashboard Before (`dashboard-before`)

**Time:** ~1 min
**Citadel coverage:** Mithril (baseline)
**Audience:** Opener for skeptical stakeholders.

### Setup
- LaunchScreen → click "AI without governance"
- Loads `build-resources/demos/dashboard-before/`
- Component: `MetricDashboard.tsx`

### Steps
1. **Let it render.** Brutalist orange, zero radius, hardcoded hex values.
2. **Say "audit"** → Mithril reports many off-token colors, bad spacing, wrong type weights.
3. **Don't fix it.** The point is to see what "no rails" produces.

### Pair with
- Run `dashboard-after` immediately after for side-by-side comparison.

---

## Runbook 3 — Dashboard After (`dashboard-after`)

**Time:** ~1 min
**Citadel coverage:** Mithril (compliant baseline)
**Audience:** Closer after `dashboard-before`.

### Setup
- LaunchScreen → click "AI with Flint"
- Loads `build-resources/demos/dashboard-after/`
- Component: `MetricDashboard.tsx`

### Steps
1. **Same prompt, constraints on.** Tokens honored, brand palette, proper radius, type pass.
2. **Say "audit"** → zero violations.

### What to highlight
- Identical prompt, different ingredient list. The difference is Flint injecting design-system context into the system prompt before the AI generates.

---

## Runbook 4 — Mithril Shadow Audit (`demos/03-mithril-shadow-audit`)

**Time:** ~2 min
**Citadel coverage:** Mithril deep-dive (CIEDE2000)
**Audience:** Designers and engineers who want to understand how Flint catches subtle drift.

### Setup
- Not in LaunchScreen picker — open the folder via `File → Open` or the `_preview` sandbox.
- File: `drift-component.tsx`

### Steps
1. **Open the component.** Pricing card with "Pro" plan highlighted.
2. **Say "audit this file"** → Mithril reports 3 MITHRIL-COL violations:
   - Header uses `#0055EE` — ΔE 4.6 from `color.primary-hover`
   - CTA button uses `#0055EE` — same drift
   - Badge uses `#FF3333` — ΔE 8.1 from `color.danger`
3. **Say "fix it"** → Flint snaps values to tokens.
4. **Re-audit** → zero violations.

### What to say
> "Your eyes miss this. ΔE 4.6 is a perceptual distance of 'just barely distinguishable' under ideal viewing conditions. In a product, it drifts silently for months until the brand team notices in a screenshot review."

---

## Runbook 5 — Sentinel UX + A11y (`demos/04-sentinel`)

**Time:** ~2 min
**Citadel coverage:** Warden + UX heuristics
**Audience:** Designers, product folks, a11y stakeholders.

### Setup
- Not in LaunchScreen picker — open via `File → Open` or `_preview` sandbox.
- File: `violating-ux.tsx`

### Steps
1. **Open the component.** An AI-generated order form: 10-button toolbar, 16 always-visible fields, no landmarks, no grouping.
2. **Say "check accessibility"** → Warden reports ~31 violations across:
   - Hick's Law (too many visible choices)
   - Miller's Law (too many fields without chunking)
   - Missing landmarks (`<main>`, `<form>` role)
   - WCAG 2.1 AA contrast failures
3. **Discuss which are auto-fixable** (landmarks, labels, roles) vs which need design rework (chunking the 16 fields into steps).

### What to say
> "Thirty-one accessibility failures in one form. An AI that didn't know the rules produced it. A designer testing for one minute would miss most of them. That's the problem Warden solves."

---

## Runbook 6 — Figma D2C (`demos/figma-d2c`) _— rebuild in-flight_

This demo is under reconstruction (DEMO.CUT.2). Do not use in beta walkthroughs until the runbook is re-written and the component renders cleanly against real MUI imports.

---

## Troubleshooting

| Symptom | Resolution |
|---------|------------|
| LaunchScreen scenarios missing | Check `build-resources/demos/` contains `multi-component-app`, `dashboard-before`, `dashboard-after`. |
| Health ring stays at 0 | Governance panel polls on mount — click the "governance" tab once. |
| Sweep does nothing | Check `flint-mcp/` is built (`npm run build`). |
| Gate doesn't block | Check Export Gate is enabled in `.flint/policy.json`. |
| ΔE values missing | Mithril requires `design-tokens.json` in the project root. |
