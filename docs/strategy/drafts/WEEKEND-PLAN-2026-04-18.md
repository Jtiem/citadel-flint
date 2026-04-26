# Weekend Plan: Close Competitive Gaps

**Date:** 2026-04-18 (Saturday) → 2026-04-19 (Sunday)
**Author:** Justin Tiemann
**Source:** [COMPETITIVE-LANDSCAPE-2026-04-18.md](COMPETITIVE-LANDSCAPE-2026-04-18.md)
**Strategic intent:** Flint competes in the design↔code space end-to-end, not just as a downstream governance layer.

---

## Context

The competitive landscape research identified four weaknesses:

1. **No authoring / generation** — Flint sits downstream of generators
2. **No design-time Figma lint** — Stark and FigmaLint own pre-code
3. **No runtime verification** — axe-core wins at the DOM layer
4. **No docs / publishing surface** — Supernova and Knapsack host content; Flint does not

This plan closes #1, #2, and #3 over the weekend. Gap #4 is deferred — it is a multi-quarter product bet, not a weekend hack. Forcing it into 48 hours would dilute focus.

---

## Deliverables

| Gap | Deliverable | Type | Phase name |
|-----|-------------|------|------------|
| #3 | axe-core runtime adapter — boots LivePreview, runs axe, pipes into Warden SARIF | Engineering MVP | `RUNTIME.1` |
| #2 | Figma-side lint — Mithril/Warden against Figma node tree via Universal AST adapter | Engineering MVP | `FIGMA-LINT.1` |
| #1 | Mason generator-positioning content — landing-page copy, investor brief, strategy doc | Content + positioning | `POS.1` |
| #4 | Docs / publishing surface | **DEFERRED** to future sprint | — |

---

## Saturday — Runtime Adapter + Positioning

### Morning: Session prep + contracts (parallel)

**Session start protocol:**
- Territory claim in `.flint-context/ACTIVE-SWARM-TERRITORY.md` for RUNTIME.1 and FIGMA-LINT.1
- HANDOFF.md entries for both phases

**Contracts (Phase 1):**
- `flint-architect` (×2 parallel) writes:
  - `RUNTIME.1` contract + executable `.contract.ts`
  - `FIGMA-LINT.1` contract + executable `.contract.ts`
- `flint-contract-linter` validates both (Phase 1.5 gate — APPROVED / REVISE)

### Midday: Gap #3 implementation swarm

Runtime adapter is smaller — ship it first so Sunday is pure Figma-lint focus.

**Parallel group A:**
- IPC channel `runtime:run-axe` (electron main + preload + shared/ipc-validators)
- Warden ingestion of DOM-layer findings (new source authority: `runtime-dom`)
- Web-build parity in `server/index.ts`
- Test scaffolds (`it.todo` from `testBoundaries`)

**Parallel group B:**
- Glass runtime-mode toggle in StatusBar (behind feature flag)
- Violation merge in GovernanceDashboard (distinguish AST-time vs runtime source)
- Full tests (replace `it.todo` with real assertions)

**Gate:** `/review` before commit.

### Afternoon: Gap #1 positioning (background, parallel)

`flint-researcher` + content agents run in background while Gap #3 is reviewed:

- Landing-page rewrite around Angle A: "The governance layer for AI-generated UI"
- Mason positioning doc: "Generate against your design system, not a vague prompt"
- Investor brief refresh with 2026-04-18 competitive landscape findings
- Positioning notes for GitHub + Claude Code docs (Angle C fallback)

Outputs land in `docs/strategy/` and `README.md`.

### Evening: End-of-round review ceremony for Gap #3

3 parallel reviewers (UX + code + security) write full reports to `.flint-context/reviews/runtime.1-{ux,code,security}-2026-04-18.md`. Surface findings to Justin. Justin makes the grade call. Commit on SHIP.

---

## Sunday — Figma-Side Lint

### Morning: Gap #2 implementation swarm

Universal AST (V.3) is the leverage — Mithril/Warden engines stay unchanged; only the input adapter is new.

**Parallel group A:**
- `FigmaNodeAdapter` implementing `FlintNode` interface in [flint-mcp/src/core/universal-ast/](flint-mcp/src/core/universal-ast/)
- Node-type mapping: Figma FRAME/COMPONENT/INSTANCE/TEXT/VECTOR → universal node shape
- Token-reference resolution: Figma variable aliases → DTCG token paths

**Parallel group B:**
- New MCP tool `flint_audit_figma_frame` (inputs: `nodeId`, `fileKey`; outputs: Mithril/Warden findings pre-code)
- Server wiring in `flint-mcp/src/server.ts`
- SARIF output with source authority `figma-frame`

**Parallel group C:**
- Glass integration — "Lint this frame" action surfaces in the right sidebar when a Figma MCP response is present
- Caching layer: `.flint/figma-cache.json` with TTL to avoid rate-limit pain

### Midday: Integration + review

- `flint-integration-validator` confirms the Universal AST contract does not leak Figma-specific types into Mithril/Warden cores
- End-of-round review ceremony (3 parallel reviewers → `.flint-context/reviews/figma-lint.1-*.md`)
- Commit on SHIP

### Afternoon: Polish + HANDOFF

- Merge Gap #1 positioning content into `docs/strategy/` and update `README.md`
- Update `HANDOFF.md` with all three shipped items (RUNTIME.1, FIGMA-LINT.1, POS.1)
- Clear territory claim
- Final TSC check + full test suite — report exact pass/fail counts per Testing Standard

---

## Explicit non-goals

- **No Gap #4 work** — docs / publishing surface stays deferred. A proper product bet, not a weekend hack.
- **No Figma plugin resurrection** — Figma MCP remains the only Figma integration path per 2026-04-15 decision.
- **No new Glass panels** — Gap #2 and #3 both surface inside the existing GovernanceDashboard and right sidebar.
- **No positioning change in public channels yet** — Gap #1 content lands internally; public rollout is a separate decision after Justin reviews.

---

## Risks

| Risk | Probability | Mitigation |
|------|------------|------------|
| Figma MCP rate limits slow Gap #2 audits | HIGH | Cache node tree in `.flint/figma-cache.json` with TTL |
| axe-core iframe access blocked by SEC.1 CSP hardening | MEDIUM | Run axe in a separate sandboxed BrowserWindow, not the preview iframe |
| Parallel swarm conflicts on Warden + Universal AST hotspots | MEDIUM | Tight territory claims; Warden service owned by ONE agent at a time |
| Weekend scope overruns into Monday | MEDIUM | Gap #3 ships first and is independent; Gap #2 can slip without blocking Gap #1 |
| Review ceremony reveals a SHIP-blocker Sunday evening | LOW | Time-box to 2 review rounds; anything unresolved goes to next session |

---

## Success criteria

All three must be true before the plan is marked COMPLETE:

1. **RUNTIME.1** — axe-core findings appear in GovernanceDashboard for a demo component; full test suite green; `/review` passes; end-of-round review ceremony complete
2. **FIGMA-LINT.1** — `flint_audit_figma_frame` returns Mithril/Warden findings for a real Figma frame; Universal AST adapter tested; `/review` passes; end-of-round review ceremony complete
3. **POS.1** — landing-page copy, Mason positioning doc, and investor brief refresh committed to `docs/strategy/`; README updated with Angle A language

---

## Sequencing rationale

- **Why Gap #3 before #2?** Smaller surface area. Validates the "wrap, don't rebuild" adapter pattern before applying it to the larger Figma lint work. A Saturday win builds momentum.
- **Why #1 in background?** Content work parallelizes cleanly with engineering review cycles. No git territory conflicts.
- **Why defer #4?** Docs hosting is Supernova / Knapsack's core product. Competing there requires a dedicated product bet with hosting infrastructure, not a weekend adapter.
- **Why not do #1 first?** Positioning without the proof points (Gap #2 + #3 shipping) is marketing claims without evidence. Ship the capability, then ship the message.

---

## Post-weekend

After the weekend, the follow-ups are:
- Public rollout decision for Angle A positioning
- Gap #4 scoping: Storybook MCP partnership vs. in-house docs surface
- Extend RUNTIME.1 beyond axe: visual regression, Playwright integration
- Extend FIGMA-LINT.1: pre-code token drift (SYNC-001 at design time)
- DBOM vocabulary claim — publish spec, own the category name before incumbents do
