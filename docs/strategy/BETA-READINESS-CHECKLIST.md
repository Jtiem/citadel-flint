# Beta Readiness Checklist

Status legend: [ ] open · [~] in progress · [x] done · [!] blocker

Target: **Private Beta**, **web build only** (Electron deferred), 5–10 invited designers.

**Distribution decision (2026-04-19):** Web-only for the private beta. Electron build is preserved in the codebase but is not part of the beta path. This collapses Gate 4 — no Apple Developer enrollment, no Azure code-signing creds, no notarization required.

---

## Gate 1 — Trust Surface (must close before invites)

- [x] Counsel: unify the two health-score formulas (single source of truth in `debtReportService`)
- [x] Counsel: dashboard verdict matches StatusBar coverage badge on every file
- [ ] Mithril/Warden: zero false-positive regressions on demo fixtures (`demos/**/*.tsx`)
- [ ] Audit→Fix→Re-audit loop produces a clean run on all demo files
- [ ] `/audit`, `/fix`, `/report`, `/sweep` all return human-readable output (no raw JSON dumps)

## Gate 2 — UX Burn-down

- [ ] All P0 issues from `docs/strategy/UX-AUDIT-2026-04-04.md` closed
- [ ] All P1 issues closed or explicitly deferred with note
- [x] Forge Sprint 1 complete (project initiation: 3 channels + smart detection)
- [ ] Mint Sprint 1 complete (token list → governance observability)
- [ ] LaunchScreen v2 shipped (2 primary actions + text link)
- [ ] New Project flow: idea → one click → describe and build (no folder picker first)
- [ ] Onboarding tour reaches "first audit" within 60 seconds for a new user

## Gate 3 — Hide What Isn't Ready

- [ ] Counsel dashboard hidden behind feature flag until Gate 1 closes
- [ ] Mint/Forge half-finished panels gated behind flags
- [ ] Figma plugin path fully removed from UI (Figma MCP only)
- [ ] Recovery/Git Time Machine entry points removed or moved to Command Palette
- [ ] No references to deleted Sprint 2 components (Shield, Ghost, ActivityFeed, RecoveryPanel)
- [ ] Strategy docs (`investor-brief`, `landing-page-copy`, `competitive`) excluded from build

## Gate 4 — Distribution (web-only)

- [x] Decide single Beta channel — **web** (decided 2026-04-19)
- [ ] Beta key / invite-gate auth in place
- [ ] Time-limited beta access (tokens expire after N weeks)
- [ ] In-app feedback widget wired to a real inbox
- [ ] Crash + telemetry pipeline (opt-in, plain-language consent)
- [ ] Hosting: pick provider (Vercel / Cloudflare Pages / etc.) and deploy `dist-web`
- [ ] Custom domain + HTTPS
- [ ] ~~Apple Developer ID + Azure signing~~ — N/A for web beta
- [ ] ~~Self-expiring desktop build~~ — N/A for web beta

## Gate 5 — Repo Hygiene

- [ ] `feat/review-renderer-pilot` merged or closed
- [ ] All in-flight contracts/reviews under `.flint-context/` resolved or archived
- [ ] `main` is green: `npm test`, `npm run test:react`, `cd flint-mcp && npm test`, `npx tsc --noEmit`
- [ ] CI runs all three test suites + TSC on every PR
- [ ] Beta tag cut from `main`, not a feature branch
- [ ] HANDOFF.md reflects actual state (no stale "in progress" entries)

## Gate 6 — Content & Comms

- [ ] One-page "What is Flint" written for the invitee email
- [ ] 90-second demo video (Mason → Mithril → Gate)
- [ ] Known-issues list published with the Beta build
- [ ] Feedback rubric: what you want testers to evaluate vs ignore

---

## Out of scope for Beta (explicitly deferred)

- Multiplayer / presence
- Annotation engine refinements beyond current state
- Variant Preview Strip, Component Recipes, Coverage Map polish (VIS.1, VIS.4, VIS.5)
- GPX marketplace UI
- VS Code extension parity work
- Vue/Svelte/HTML preview support
