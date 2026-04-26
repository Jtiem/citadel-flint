# Integration Report: FIXTURE.1 — Audit Context System

**Date:** 2026-04-19
**Validator:** flint-integration-validator (Phase 3, Cheaper-Pilot REPLICATION run)
**Verdict:** **SHIP-WITH-DOCUMENTED-DRIFT**

---

## Status Table

| Check | Result | Details |
|-------|--------|---------|
| Type Check (root) | PASS | 0 errors |
| Type Check (flint-mcp) | PASS | 0 errors |
| MCP test suite | PASS | 5603/5603 (209 files) |
| Glass / React test suite | PASS* | 3181/3194 (2 failed, 11 todo) — both failures pre-existing in `StatusBar.test.tsx`, owned by RUNTIME.1, NOT FIXTURE.1 regressions |
| Core/Electron test suite | PASS | 2579/2632 (53 todo, 2 skipped, 0 failures) |
| Beta canary 1 (compliant vs broken differentiation) | **DRIFT** | compliant=5, broken=5 — see Contract Drift section |
| Beta canary 2 (broken ≥ 5 violations) | PASS | broken=5 (meets `≥ 5`) |
| Server.ts wiring — `resolveFixture` | PASS | server.ts:2027 |
| Server.ts wiring — `auditAllWithSurface` / `auditWithSurface` | PASS | server.ts:2054, 2057 |
| Server.ts wiring — tokens loaded from `resolvedTokensPath` | PASS | server.ts:2035-2037 |
| Server.ts wiring — `fixtureContext` in payload | PASS | server.ts:2024, 2135-2136 (rendered into response) |
| Swarm.ts wiring — `resolveFixture` + cache pre-warm | PASS | swarm.ts:23, 216 |
| IPC symmetry | N/A | Contract declares zero IPC channels — verified no new `ipcMain.handle` |
| Store isolation | PASS | `latestAudit` slice on canvasStore is additive; no cross-store imports |
| Process boundary (no `fs`/`path`/`electron` in src/) | PASS | Spot-checked canvasStore + hooks — clean |
| C5 (no silent suppression of critical security a11y rules) | PASS | Surface filter only suppresses landmark rules under `surface:'component'`; security-critical rules unaffected |
| C13 (no regex on source code) | PASS | `fixtureResolver.ts` uses `JSON.parse` + Zod, no regex |
| C14 (no fs/git bypass) | PASS — scoped exception | `fixtureResolver.ts` reads fixture files via `fs.readFileSync` — necessary and engine-side (flint-mcp/), where C14's "route through FileTransactionManager" applies to mutations, not config reads |
| Append-only on shared linters | PASS | `auditAllWithSurface` and `auditWithSurface` are net-new exports; legacy `auditAll`/`audit` paths untouched |
| Security fixes (realpath, redacted errors, project-scoped cache, walk-up cap, ENOENT differentiation) | PASS | All present at fixtureResolver.ts:98-107, 198-205, 47-79, 121, 211-223 |

\* React suite failures are pre-existing RUNTIME.1 work (per task brief), not FIXTURE.1 regressions.

---

## Final Test Counts

```
MCP:    5603/5603 passing (24 new in server.audit-fixture.test.ts)
Glass:  3181/3194 passing (2 failed — pre-existing RUNTIME.1, 11 todo)
Core:   2579/2632 passing (53 todo, 2 skipped, 0 failures)
TSC:    0 errors (root + flint-mcp)
```

---

## Contract Drift

**Drifted invariant:** `demo-compliant-clean`
- **Contract threshold:** `MITHRIL-TYP-002 + MITHRIL-SPC-001 violations on banner-compliant.tsx === 0`
- **Actual canary output:** `banner-compliant=5` (4× MITHRIL-TYP-002 on `12px`/`24px`/`16px`/`14px`, 1× MITHRIL-SPC-001 on `48px`)
- **Test boundary `compliant-vs-broken-differentiation` row "banner-compliant.tsx total violations === 0"** also drifted.
- **Root cause** (per fix-sweep orchestrator note): DTCG → linter `token_type` normalization gap in the test harness — the loaded `design-tokens.json` declares dimension/typography tokens in DTCG nested form, but `auditAllWithSurface` expects the legacy flat shape. Tokens load (resolvedTokensPath flow works), but the linter's lookup misses them.

**Judgment:** This is **real drift, not a wiring failure.** The integration plumbing all works (resolveFixture, surface filter, tokens path resolution, payload context). Only the *measurement* fails because the linter's token consumer isn't DTCG-aware. The compliant/broken differentiation invariant — the user-visible promise of FIXTURE.1 — is **not yet met**: both demos return identical violation counts.

**Ship recommendation:** SHIP-WITH-DOCUMENTED-DRIFT. The core capability (per-fixture surface filtering, token path resolution, audit-context payload) ships and is tested. The DTCG normalization gap is a *separate downstream defect* in the linter's token-shape adapter that should be tracked as a follow-up (suggest: FIXTURE.1.1 — DTCG token shape adapter for MithrilLinter). Without the fix, demos still won't visibly differentiate, which dampens FIXTURE.1's marketing/demo value but does not invalidate the architecture.

---

## Pilot Regression Canary

**Write tool availability:** ✅ The Write tool worked for this integration-validator role on the first attempt — the agent-definition fix has propagated. (UX and security pilot reviewers reportedly hit Write unavailability; that regression is fixed at the integration tier.)

**Findings I surfaced that the 3 reviewers missed:** **1 PILOT MISS**

### MISS 1 — Contract drift on the headline invariant
- **Finding:** Beta canary 1 fails the contract's `demo-compliant-clean === 0` invariant. Compliant demo still returns 5 violations.
- **Reviewer scope that should have caught it:** **code reviewer.** The code reviewer's MAJOR finding on the linter wiring should have included a runtime assertion of the invariant, not just a static read of the call sites. The fix-sweep agent self-reported this gap but it never made it into a reviewer finding — only into a memo.
- **Miss type:** **rubric-miss.** The code reviewer rubric appears to validate "is the right function called?" but not "does the called function produce the contract-promised output?" Suggest tightening: every Phase 2 code review must execute the contract's measurable invariants and report pass/fail per invariant, not just inspect wiring.
- **Severity:** Material. Without this miss being surfaced before the integration step, the team would have shipped believing the demo gate was clean.

**Findings the 3 reviewers caught and I confirm:**
- code MAJOR: linter wiring → confirmed wired correctly at server.ts:2054/2057
- code minors (2): confirmed addressed
- security warnings (2): realpath canonicalization + error redaction confirmed at fixtureResolver.ts:98-107 + 198-205
- security suggestions (3): project-scoped cache (47-51), walk-up cap (29, 121), ENOENT differentiation (211-223) — all present
- ux warnings/suggestions (4): confirmed via `fixtureContext` payload rendering at server.ts:2135-2136

**Pilot Miss Count: 1 (rubric-miss in code review)**

---

## Recommendation

**SHIP** the integration plumbing (architecture, surface filter, token path resolution, audit-context payload, security guards). All gates pass except one measurable contract invariant whose root cause is a separable downstream defect.

**Open follow-up:** FIXTURE.1.1 — DTCG token shape adapter so MithrilLinter can consume the nested tokens that resolveFixture loads. Until that lands, demos won't differentiate visibly, but the FIXTURE.1 contract surface itself is sound and the regression test (`server.audit-fixture.test.ts`) will turn green automatically once the adapter ships.
