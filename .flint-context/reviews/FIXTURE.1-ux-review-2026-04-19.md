# FIXTURE.1 UX Review

- **Phase:** FIXTURE.1
- **Dimension:** ux
- **Reviewer:** flint-ux-critic
- **Date:** 2026-04-19
- **Round:** 1
- **Scope:** AuditContextPill component (StatusBar.tsx lines 269-316); canvasStore.ts latestAudit slice + setLatestAudit action (lines 291-308, 517, 703, 962); StatusBar.fixtureContext.test.tsx (10 tests); Contract §7 (acceptance criteria) + §13 (designer surface intent)

## Verdict

**FIX-FORWARD** — 0 blocking · 2 warnings · 2 suggestions

## Findings

### WARN-1 — Truncation threshold of 12 chars cuts useful audit-context labels mid-word

**Severity:** warning · **Scope:** one-line · **Status:** open

**Evidence:**
- `src/components/editor/StatusBar.tsx:272` — Hardcoded 12-char limit on visible pill label.
  ```
  const AUDIT_LABEL_MAX_CHARS = 12
  ```
- `src/components/editor/__tests__/StatusBar.fixtureContext.test.tsx:77` — Test fixture uses "MUI demo context" which collapses to "MUI demo con…" — the most informative word ("context") is truncated.

**Observed:** AUDIT_LABEL_MAX_CHARS is set to 12. The contract's own example fixture label "MUI demo context" renders as "MUI demo con…", cutting the most informative word.

**Rationale:** Contract §13 frames the pill as a "small but visible trust signal" so a designer doesn't need to read JSON to know which audit context applies. Truncating below typical fixture-label length defeats that goal — designers see a fragment that could mean anything.

**Proposed fix:** Raise to ~24 chars or drop the char-cap entirely and use Tailwind utilities like `max-w-[160px] truncate`. The CSS-truncated version handles variable-width fonts more honestly than a hardcoded char count.

### WARN-2 — Bare label without prefix or icon reads as a brand badge, not an audit-context signal

**Severity:** warning · **Scope:** one-line · **Status:** open

**Evidence:**
- `src/components/editor/StatusBar.tsx:313` — Pill renders {displayLabel} with no prefix, no icon, no visible context indicator.
- `src/components/editor/StatusBar.tsx:308` — aria-label correctly says "Audit context: …" but sighted users get no equivalent.

**Observed:** A small chip showing just "MUI" next to CoverageBadge + RuntimeAuditPill reads as "this project uses MUI" rather than "the auditor is interpreting this file under the MUI fixture context."

**Rationale:** Citadel-vocabulary gate: visible UI must match audience mental model. The pill is meant to convey audit context, not project tech stack. Without a prefix or icon, the semantic intent is invisible to sighted users — only screen-reader users get the framing.

**Proposed fix:** Prepend a small icon (Crosshair, Target, or similar) OR render as `Context · ${displayLabel}`. The aria-label can stay as-is.

### SUG-1 — Tooltip is mouse-only via native title=; sighted keyboard users get nothing for truncated labels

**Severity:** suggestion · **Scope:** one-line · **Status:** open · **Commandment:** 5

**Evidence:**
- `src/components/editor/StatusBar.tsx:309` — Uses native `title=` attribute.
- `src/components/editor/StatusBar.tsx:306` — Span is `role="status"` and not focusable — keyboard users cannot trigger native title tooltip.

**Observed:** Native `title` only fires on mouse hover. With WARN-1 unfixed, sighted keyboard users have no way to reveal the full label of a truncated audit-context pill.

**Rationale:** Glass already has hover-only popovers in StatusBar (CoveragePopover) so this is consistent precedent. Marked suggestion rather than warning because Commandment 5 floor is met (aria-label carries full text for screen reader users); raising to focus-revealable would exceed the floor.

**Proposed fix:** Either widen the pill (per WARN-1, removing the truncation problem entirely) OR make the span focusable (tabindex=0) with an on-focus tooltip matching the existing Figma popover pattern.

### SUG-2 — No integration test exercises the MCP → store → pill data path; setLatestAudit action never invoked in tests

**Severity:** suggestion · **Scope:** one-line · **Status:** open

**Evidence:**
- `src/components/editor/__tests__/StatusBar.fixtureContext.test.tsx:43` — All 10 tests drive the pill via useCanvasStore.setState(...) directly, bypassing the setLatestAudit action.
- `src/store/canvasStore.ts:962` — setLatestAudit action exists but is never exercised by test code.

**Observed:** All 10 tests bypass the store action by calling setState directly. The setLatestAudit action — the actual production data-flow entry point — has zero test coverage.

**Rationale:** A future refactor that narrowed the action signature could silently drop fixtureContext from incoming MCP responses while every existing test still passes. The action is the contract surface; bypassing it in tests creates a silent divergence risk.

**Proposed fix:** Add one test calling `useCanvasStore.getState().setLatestAudit({...payload})` and asserting the pill renders with the expected fixtureContext. ~6 lines.

## Rubric

| Criterion | Result | Evidence / Related findings |
|-----------|--------|-----------------------------|
| Audience match — pill is genuinely valuable to designer, not engineer-noise | pass | Pill conveys audit context label without exposing internal type names like FlintFixture or appliesTo |
| Behavior clarity — designer can state in one sentence what pill tells them | **fail** | Bare label reads as brand badge; semantic intent invisible to sighted users |
| 80% case priority — optimized for single-fixture project, not rare multi-fixture monorepo | pass |  |
| Accessibility — role="status" + aria-label decorated | pass | StatusBar.tsx:306-308 |
| Tooltip accessible to keyboard users | **fail** | Native title attribute is mouse-only; pill not focusable |
| Truncation preserves full text in tooltip + aria-label | pass | Both title and aria-label carry the full label string |
| No engineer jargon in user-visible copy ("FlintFixture", "ResolvedFixture", "appliesTo") | pass |  |
| Truncation threshold appropriate for typical fixture labels | **fail** | 12-char limit cuts contract example "MUI demo context" mid-word |
| Renderless when null — zero DOM, no whitespace badge | pass |  |
| No regression on Phase 2 surface — CoverageBadge + RuntimeAuditGate unchanged | pass |  |

## Scope Coverage

**Reviewed:**
- src/components/editor/StatusBar.tsx (Phase 3 additions only — AuditContextPill at lines 269-316)
- src/store/canvasStore.ts (Phase 3 additions only — latestAudit + setLatestAudit)
- src/components/editor/__tests__/StatusBar.fixtureContext.test.tsx (10 tests)
- .flint-context/contracts/FIXTURE.1-contract.md (§7 + §13 only)

**Skipped:**
- shared/fixture-schema.ts + flint-mcp/src/core/fixtureResolver.ts — code reviewer scope
- Rule applicability metadata (mithrilAppliesTo, A11y rule modules) — code reviewer scope
- Audit pipeline (server.ts, swarm.ts) — code reviewer scope
- Demo .flint-fixture.json files — code reviewer scope
- Path-traversal guard, untrusted JSON parsing — security reviewer scope
- Pre-existing 2 StatusBar.test.tsx Figma popover failures — owned by RUNTIME.1, out of FIXTURE.1 scope
