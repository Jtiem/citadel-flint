# Beta Gate 1 — Demo Audit Loop Findings

**Date:** 2026-04-19
**Scope:** 4 rendering demo survivors after DEMO.CUT.1 Phase 1 (figma-d2c deferred to DEMO.CUT.2b)
**Verdict:** **NOT PASSING — 3 structural gaps discovered**

This is a findings document, not a sign-off. Gate 1 can't close as-is; we need to close the gaps below first.

---

## Per-Survivor Baseline

| Demo | File | Narrative Claim | Audit Reports | Tokens Loaded |
|------|------|----------------|---------------|---------------|
| Demo 03 (Mithril drift) | `demos/03-mithril-shadow-audit/drift-component.tsx` | 3 MITHRIL-COL violations (ΔE 4.6 header + ΔE 8.1 badge) | **0 Mithril**, 3 a11y (all page-landmark false positives) | **0** |
| Demo 04 (Warden UX+a11y) | `demos/04-sentinel/violating-ux.tsx` | 31 violations (Hick's + Miller's + WCAG 2.1 AA) | **APPROVED 70/70 — zero violations** | **0** |
| Dashboard-before (AI ungoverned) | `build-resources/demos/dashboard-before/MetricDashboard.tsx` | Brutalist orange, zero radius, hardcoded hex | 0 Mithril, 3 a11y (2 landmark false positives + 1 `table-no-summary`) | 38 |
| Dashboard-after (AI governed) | `build-resources/demos/dashboard-after/MetricDashboard.tsx` | Clean — compliant baseline | **4 a11y violations** (table structure + motion guard + landmark FP) | 38 |
| Multi-component-app Dashboard | `build-resources/demos/multi-component-app/Dashboard.tsx` | Grade A, 0 violations (reference) | 1 a11y (nav landmark FP) | 38 |
| Multi-component-app DataTable | `build-resources/demos/multi-component-app/DataTable.tsx` | Grade F, 8 violations (table a11y + contrast + off-token) | **1 a11y** (`table-no-summary` only) | 38 |

---

## Gap 1 — Page-level a11y rules fire against component fixtures

**Symptom:** Every demo except one reports `A11Y-050` (no `<main>` landmark), `A11Y-051` (no `<nav>` landmark), or `A11Y-010` (heading level skip). These are page-structure rules; a single-component `.tsx` fixture cannot satisfy them.

**Example:** `drift-component.tsx` is a pricing card. It can't have a `<main>` or `<nav>` landmark; those are the host page's responsibility.

**Root cause:** FIXTURE.1 was designed to declare per-directory `surface: 'component'` in `.flint-fixture.json` to suppress page-level rules for component fixtures. None of the surviving demos ship that file. The FIXTURE.1 architecture works (per `server.audit-fixture.test.ts`), but it hasn't been applied to the demo set.

**Fix:** Add `.flint-fixture.json` with `{ "surface": "component" }` to each survivor directory.

---

## Gap 2 — Mithril rules not flagging intentional drift

**Symptom:** Demos that exist *specifically to demonstrate Mithril* report zero Mithril violations.

- Demo 03 is built around ΔE 4.6 + ΔE 8.1 color drift. Audit says zero Mithril.
- Dashboard-before is narrated as "hardcoded orange, zero radius, brutalist" drift. Audit says zero Mithril.
- DataTable is narrated as "contrast + off-token colors" grade F. Audit reports zero Mithril.

**Two sub-causes:**

**2a — demos/\* not loading tokens.** `demos/03` and `demos/04` both report `Tokens Loaded: 0`. No token file means no drift baseline. `build-resources/demos/\*` reports 38 tokens loaded, so the tool's token resolver works — but the demos-root token file isn't being walked up to or the fixture path resolution for `demos/*` differs from `build-resources/demos/*`.

**2b — Rule coverage gap.** `build-resources/demos/dashboard-before/MetricDashboard.tsx` has 38 tokens loaded but still reports 0 Mithril violations. Either the drift values are outside the detection thresholds, or the rules that should catch "hardcoded orange with no token match" aren't live.

**Fix:** Investigate both. `2a` is a resolver bug in `flint-mcp`; `2b` is either a Mithril config issue or a real rule-coverage gap that needs rule work.

---

## Gap 3 — Demo 04 Warden narrative doesn't match rule coverage

**Symptom:** `violating-ux.tsx` is narrated as demonstrating Hick's Law (10-button toolbar) + Miller's Law (16 always-visible fields) + WCAG contrast — ~31 violations total. Audit reports APPROVED 70/70 passing.

**Root cause:** Warden's 50 WCAG 2.1 AA rules don't include Hick's Law or Miller's Law heuristics. The demo narrative is aspirational, not grounded in actual rule coverage. Warden doesn't currently flag "too many buttons" or "too many always-visible fields."

**Fix:** Either (a) rebuild the demo to surface violations that Warden actually catches (missing labels, bad contrast, missing landmarks at the host level, aria misuse), or (b) extend Warden with UX-heuristic rules. Option (a) is beta-scoped; option (b) is a bigger rule-engine push.

---

## What This Means for Beta Gate 1

Gate 1 in [docs/strategy/BETA-READINESS-CHECKLIST.md](../../docs/strategy/BETA-READINESS-CHECKLIST.md) has three open items this finding touches:

- [ ] Mithril/Warden: zero false-positive regressions on demo fixtures — **BLOCKED** by Gap 1 (landmark FP on all components).
- [ ] Audit→Fix→Re-audit loop produces a clean run on all demo files — **BLOCKED** by Gaps 1, 2a. Loop runs, but the report is wrong (both false positives and false negatives).
- [x] `/audit`, `/fix`, `/report`, `/sweep` all return human-readable output — **PASSING**. Output is well-formatted markdown with plain-English fixes and next steps.

So one of three items passes, two are blocked behind structural fixes.

---

## Recommended Next Moves (in priority order)

1. **Add `.flint-fixture.json` to all 5 survivor directories** — closes Gap 1 at the on-disk level. **DONE 2026-04-19**. Fixture files seeded:
   - `demos/03-mithril-shadow-audit/.flint-fixture.json` — updated to add `tokens: "./design-tokens.json"`
   - `demos/04-sentinel/.flint-fixture.json` — updated to add `tokens: "../design-tokens.json"` (walks up to shared)
   - `build-resources/demos/dashboard-before/.flint-fixture.json` — new, `surface: component`, points at local tokens
   - `build-resources/demos/dashboard-after/.flint-fixture.json` — new
   - `build-resources/demos/multi-component-app/.flint-fixture.json` — new
2. **Restart MCP server and re-verify Gap 1 + 2a** — the running server has a project-scoped fixture cache that won't invalidate on `.flint-fixture.json` writes mid-process. After `npm run build` and server reload, re-run the audit loop to confirm landmark rules get suppressed and tokens load for `demos/*`. **This is the critical unblocker** — if Gap 1 and 2a are purely cache-driven, they close on restart. If not, there's a live bug in the resolver or rule-gating that needs deeper investigation.
3. **Debug why `demos/*` doesn't load tokens** — if step 2 shows tokens still at 0 after restart, investigate the fixture-path walk-up in [flint-mcp/src/core/fixtureResolver.ts](../../flint-mcp/src/core/fixtureResolver.ts). Possible bug in `resolvedTokensPath` computation.
4. **Rewrite Demo 04 against Warden's actual rule set** — closes Gap 3 for beta. Warden doesn't have Hick's/Miller's; don't promise them.
5. **Decide on Gap 2b — Mithril rule coverage audit** — post-Gate 1. If `dashboard-before` is "brutalist drift" but Mithril doesn't flag it, we need to understand what Mithril's thresholds actually catch and update the narrative or the rules.

### Mid-session discovery (2026-04-19)

During step 1 I re-ran audits immediately after adding `tokens` fields to existing fixtures (03, 04). The audit tool returned **identical** results — same landmark violations, still `Tokens Loaded: 0` for `demos/*`. The live MCP server's fixture cache ignores on-disk fixture changes within a single process lifetime.

Static inspection of the code paths shows:
- [flint-mcp/src/core/A11yLinter.ts:228](../../flint-mcp/src/core/A11yLinter.ts#L228) correctly filters violations when `appliesTo: 'document'` and `surface: 'component'`
- [flint-mcp/src/core/a11y/rules/landmarks.ts:24](../../flint-mcp/src/core/a11y/rules/landmarks.ts#L24) correctly annotates A11Y-050/051 as `appliesTo: 'document'`
- [flint-mcp/src/server.ts:2059](../../flint-mcp/src/server.ts#L2059) correctly threads `fixtureSurface` into `auditWithSurface()`
- `server.audit-fixture.test.ts` has passing tests covering exactly this path

The disconnect is runtime-only. The fix for the next session is straightforward: have Justin restart the Claude Desktop / IDE connection to reload the MCP server, then re-run the audit loop. If fixtures suppress landmark rules post-restart, Gate 1 items 1 + 2 close with a follow-up verification artifact. If they still fire, there's a real runtime bug that needs debugger attention.

---

## Audit Raw Data

Baseline audits captured 2026-04-19 via `audit_ui_component` MCP tool:

- `demos/03-mithril-shadow-audit/drift-component.tsx`: BLOCKED, 3 a11y (A11Y-010 heading skip, A11Y-050 main, A11Y-051 nav), 0 Mithril, 0 tokens loaded
- `demos/04-sentinel/violating-ux.tsx`: APPROVED, 70/70 passing, 0 tokens loaded
- `build-resources/demos/dashboard-before/MetricDashboard.tsx`: BLOCKED, 3 a11y (A11Y-008 table-no-summary, A11Y-050, A11Y-051), 0 Mithril, 38 tokens loaded
- `build-resources/demos/dashboard-after/MetricDashboard.tsx`: BLOCKED, 4 a11y (div-unguarded-animation, A11Y-008, A11Y-031 table role children, A11Y-050), 0 Mithril, 38 tokens loaded
- `build-resources/demos/multi-component-app/Dashboard.tsx`: BLOCKED, 1 a11y (A11Y-051), 0 Mithril, 38 tokens loaded
- `build-resources/demos/multi-component-app/DataTable.tsx`: BLOCKED, 1 a11y (A11Y-008), 0 Mithril, 38 tokens loaded
