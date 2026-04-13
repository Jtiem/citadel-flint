# Code Review — Demo Suite Audit + Integrity Fixes
**Date:** 2026-04-09
**Reviewers:** 2 parallel flint-code-reviewer agents
**Scope:** 7 files changed this session

---

## Domain 1: Demo Fixtures (TSX)

**Files:** `drift-component.tsx`, `legacy-divs.tsx`, `DemoPreview.tsx`, `original-card.tsx`

| File | Rating | Issues |
|------|--------|--------|
| `demos/03-mithril-shadow-audit/drift-component.tsx` | PASS | 1 minor (comment ΔE values corrected post-review) |
| `demos/05-semantic-refactor/legacy-divs.tsx` | PASS | 0 |
| `demos/_preview/DemoPreview.tsx` | PASS | 1 minor |
| `demos/06-macro-recovery/original-card.tsx` | PASS | 0 |

### Issues (Fixtures)

**MINOR (fixed) — `drift-component.tsx`:9-11 — ΔE comment values contradicted engine output**
File comment said ΔE 8.4 (header) and 11.2 (badge). Engine actually produces 4.6 and 8.1. Comments updated to match. Also clarified nearest token is `color.primary-hover`, not `color.primary`.

**MINOR (acknowledged) — `drift-component.tsx`:87-98 — Feature list ternaries in inline styles**
`color` and `textDecoration` on feature list items use ternary expressions (`feature.included ? '#374151' : '#9CA3AF'`). AST extractor cannot resolve ternaries → these values are not evaluated by Mithril. The three primary drift targets (header bg, badge bg, CTA bg) are all literal strings and fire correctly. Feature list ternaries are acceptable — they are not the demo's targeted violations.

---

## Domain 2: Config + Docs

**Files:** `.flint/design-tokens.json`, `demos/DEMO-SCRIPT.md`, `HANDOFF.md` (2026-04-09 entry)

| File | Rating | Issues |
|------|--------|--------|
| `.flint/design-tokens.json` | PASS (post-fix) | 1 major fixed |
| `demos/DEMO-SCRIPT.md` | PASS (post-fix) | 1 major + 2 minor (1 fixed, 2 acknowledged) |
| `HANDOFF.md` | PASS | 1 minor acknowledged |

### Issues (Config + Docs)

**MAJOR (fixed) — `.flint/design-tokens.json` — Missing `collection_name` and `mode` fields**
`DesignToken` interface in `flint-mcp/src/types.ts` requires both as non-optional `string`. All 38 entries were missing both. Added `"collection_name": "default", "mode": "default"` to every entry. MithrilLinter does not read these fields so the bug was latent — no audit failures were caused — but it violated the type contract.

**MAJOR (fixed) — `demos/DEMO-SCRIPT.md`:5 — Timing header "~27 minutes" contradicted table sum of 24**
Table: 1+2+3+4+3+3+4+2+2 = 24. Header updated to "~24 minutes".

**MINOR (acknowledged) — `demos/DEMO-SCRIPT.md` Demo 4 count "31 violations"**
The count is accurate per the actual engine audit run during this session, but Warden rule additions in future sprints could shift it. Recommended to verify before each presentation via a dry-run `/audit`. The script intentionally does not hardcode the count in the spoken line ("31" appears only in a comment-style aside, not a quoted presenter line).

**MINOR (acknowledged) — `HANDOFF.md` — "58.2" figure in root-causes table**
The HANDOFF says the prior script claimed "ΔE 8.4 and 58.2" (from the original DEMO-SCRIPT.md before this session). The 58.2 figure was in the old script for the badge; it is removed from the new script. Historical reference in HANDOFF is accurate to the prior state.

---

## Aggregate Verdict: SHIP

All major issues fixed before this review was filed. No blocking issues remain.

- Critical: 0
- Major: 2 (both fixed)
- Minor: 4 (2 fixed, 2 acknowledged as acceptable)
