# Public Beta Distribution Plan

**Status:** DRAFT — pending Justin approval
**Authored:** 2026-04-26
**Owner:** Justin Tiemann
**Target:** Public download, no tester cap
**Timeline:** Phases, not days — public beta spans weeks, not a single sprint
**Decision log:**
- Signing strategy: Apple Developer Program (macOS notarization) + Azure Code Signing (Windows EV cert) — both required before public launch. SmartScreen hard-block is not acceptable for a public audience.
- Distribution: Cloudflare R2 (or equivalent CDN) for build hosting. Worker hardening (rate limiting + dedup) re-enabled before public launch.
- Auto-update: electron-updater wired to hosted release feed. Required — can't ask 1,000 people to re-download manually.
- Telemetry consent: same opt-in model as closed beta. Privacy policy + ToS drafted and counsel-reviewed before any public collection.
- Kill switch: retained but soft — public builds don't hard-expire; they show an upgrade banner instead.
- LivePreview Worker sandbox: roadmap item, not a public beta blocker. `'unsafe-eval'` stays in CSP for now, with an updated comment.

---

## Goal

Widen from 10 design partners to an open public audience. The closed beta answered "does it work?" The public beta answers "does it work for people who don't know us?" The risk profile shifts from bugs to trust: trust that the download is safe, trust that data is handled responsibly, trust that the product is stable enough to use on real work. Every phase below is about earning that trust before asking for it.

---

## Explicitly Out of Scope

Public beta is not GA. The following are deferred to 1.0:

- Paid plans, billing, or any monetization layer
- Team/org accounts and multi-user workspaces on a shared cloud instance
- SLA commitments or uptime guarantees
- Plugin marketplace or third-party rule pack store
- Mobile / tablet builds
- Full documentation site (API reference, architecture deep-dives) — the install guide and workflow guide are sufficient for beta
- Removing `'unsafe-eval'` from the CSP — requires the Worker-based LivePreview sandbox, which is a multi-week architectural project
- Windows ARM build
- Linux build

---

## Phases

Phases are ordered by dependency, not by calendar. Phase 1 must ship before Phase 2. Phases 3–5 can overlap once Phase 2 is confirmed stable.

---

### Phase 1: Security Fixes from Post-Hoc Review (Before Everything Else)

These three items were deferred from closed beta with a "fix before public beta" verdict. They go first because the later phases (signing, distribution, onboarding) are visible investments that would be embarrassing to ship on top of known unfixed warnings.

**1.1 — CSP comment correction**
Update the comment at `electron/main.ts:496–497` to accurately describe why `'unsafe-eval'` is in the production CSP. The comment currently contradicts the code. A future agent reading this comment will make a wrong assumption.

Fix: Update to reflect that both dev and production CSPs allow `'unsafe-eval'` because LivePreview's transpile-and-eval pipeline runs in the top-level renderer, not in an isolated iframe. 15-minute change.

**1.2 — Atomic token re-seed**
Wrap the `clear + insert` loop in `tokens:seed-from-project` in a `db.transaction()` call. If any insert fails mid-loop, the user is currently left with an empty token table. Mirror the fix in `server/index.ts`.

Existing pattern to copy: `electron/main.ts:4651` already uses `db.transaction()` for `insertMany`. 15-minute change + test update.

**1.3 — `projectRoot` path canonicalization**
After validating `projectRoot` as a non-empty string, call `path.resolve(projectRoot)` and check it against the currently opened workspace root before joining the path. Return an error if they don't match. Mirror in `server/index.ts`. Prevents read-path leaks on wrong-state calls.

1–2 hours including tests for the boundary check.

**Exit criteria for Phase 1:** All three fixes merged, `tsc -b` clean, no regressions in `npm test` or `cd flint-mcp && npm test`.

**Feature Budget gates:**
- Who: Engine + infrastructure (both builds)
- Behavior: A misconfigured project state cannot cause Flint to read tokens from outside the open workspace
- 80/5: 100% correctness — not a use case, a guarantee
- Cost: Low (targeted fixes, existing test patterns)
- Validated: Security reviewer identified them with file:line citations
- Trade-off: Takes priority over all cosmetic or feature work this cycle

---

### Phase 2: Code Signing + Notarization

Without signed builds, public testers on macOS will hit a Gatekeeper hard block (not the dismissible "right-click → Open" path — a wall). Windows SmartScreen will block unsigned EXEs for users who don't know to click "More info." At closed-beta scale, a walkthrough video covers this. At public scale, it's a drop-off cliff.

**2.1 — Apple Developer Program enrollment**
Enroll in the Apple Developer Program ($99/year). This unlocks the Developer ID certificate needed for ad-hoc notarization. Timeline: 24–48 hours for Apple to approve the account.

**2.2 — macOS notarization pipeline**
- Add `electron-notarize` (or equivalent) to the `build:beta` script
- Wire Apple ID + app-specific password (or App Store Connect API key) as CI secrets
- Run `xcrun notarytool submit` + `xcrun stapler staple` as a post-build step
- Test on a clean macOS 15.x machine with Gatekeeper fully enabled — the app should open without any dialogs

**2.3 — Azure Code Signing + Windows EV cert**
- Enroll in the Azure Code Signing service (replaces the deprecated DigiCert EV cert process)
- Wire `AzureSignTool` into the Windows build step in CI
- SmartScreen reputation accrues over time after first signing — expect a brief "Unknown publisher" warning on the first few hundred downloads, then it clears

**2.4 — CI pipeline for signed builds**
- GitHub Actions workflow: build → sign → notarize → upload to R2
- Secrets in GitHub environment (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `AZURE_SIGNING_*`)
- Build artifacts uploaded to R2 on every tag push (`v*.*.*`)

**Exit criteria for Phase 2:** A signed `.dmg` opens on a clean macOS 15.x machine with zero dialogs. A signed `.exe` passes SmartScreen and installs without warnings.

**Feature Budget gates:**
- Who: Designer (distribution, first-touch trust)
- Behavior: A public tester can download and open Flint on macOS or Windows without needing a workaround
- 80/5: 80% — every first-time user hits this before they see a single feature
- Cost: Medium (CI pipeline, credential management, new build step)
- Validated: Closed beta confirmed the unsigned friction is real; multiple testers needed the Loom walkthrough
- Trade-off: Delays public launch by however long Apple enrollment takes (allow 1 week buffer)

---

### Phase 3: Auto-Updater

Public beta will ship multiple updates. Asking 1,000 people to re-download a `.dmg` every time is not a distribution strategy. A single broken update experience (user on v0.2.0 while the current build is v0.3.1) fragments the tester population and makes telemetry unreadable.

**3.1 — electron-updater wiring**
- Add `electron-updater` to the project
- Point it at a `latest.yml` / `latest-mac.yml` feed hosted on R2 (or GitHub Releases)
- On `app.whenReady()`, call `autoUpdater.checkForUpdatesAndNotify()`
- Respect the existing telemetry consent flag — don't make network calls until the user has opted in to telemetry (or treat the update check as non-telemetry and always allow it — decide before implementation)

**3.2 — Update UX**
- "An update is available" toast in NotificationCenter with a "Restart to update" action
- No forced updates — the user decides when to restart
- StatusBar version badge links to the changelog on click

**3.3 — Release feed**
- `latest.yml` is generated automatically by electron-builder when signing is configured (Phase 2 dependency)
- Feed hosted on R2 alongside the build artifacts
- Changelog maintained in `CHANGELOG.md` (semver, conventional format)

**3.4 — Kill switch softening**
Public builds do not hard-expire. Replace the "app has expired, quit" modal with an upgrade banner: "This build is over 90 days old. A newer version is available. [Update now]" The banner can be dismissed but reappears after 7 days. Quitting is no longer forced.

**Exit criteria for Phase 3:** Install v0.x.0, see a "new version available" toast when v0.x.1 is released, click "Restart to update," land on v0.x.1 without re-downloading.

**Feature Budget gates:**
- Who: Designer (self-service maintenance)
- Behavior: A user on an old build is informed and can update without visiting a website or emailing anyone
- 80/5: 80% — every repeat user hits this after the second release
- Cost: Medium (new IPC path, build pipeline change, R2 feed management)
- Validated: Standard expectation for any desktop app; no user signal needed
- Trade-off: Requires Phase 2 (signed builds) to be complete first

---

### Phase 4: Worker Hardening + Scale Readiness

The closed-beta Cloudflare Worker was explicitly sized for 10 users. Rate limiting and Slack dedup were deferred "until first signs of abuse." Public beta IS first signs of abuse. This phase re-enables the deferred hardening before a single public tester downloads the build.

**4.1 — Rate limiting**
- Enforce per-IP rate limits on the telemetry route: max 60 events/minute per IP (a real user session should never approach this)
- Enforce per-IP rate limits on the feedback route: max 5 submissions/hour per IP
- Return `429` with a `Retry-After` header; the client should handle this gracefully (queue the event, retry after the window)

**4.2 — Slack dedup**
- Telemetry crashes: deduplicate by `stack_hash` — don't post the same crash trace to Slack more than once per hour
- Feedback: no dedup — every feedback submission posts

**4.3 — KV write quota check**
Cloudflare Worker KV has a free-tier limit of 1,000 writes/day. At 1,000 testers each sending 10 telemetry batches/day, that's 10,000 writes — well over the free tier. Either upgrade to the paid KV plan (~$0.50/million writes beyond the first 1M) or switch telemetry storage to a D1 (SQLite) database instead of KV, which has more generous limits and easier querying.

Decision to make before implementation: KV upgrade vs. D1 migration. D1 is slightly more work but produces a queryable dataset instead of raw KV blobs. Recommended: migrate to D1 now, before public scale creates a migration headache.

**4.4 — Telemetry dashboard (minimal)**
At 10 users, tailing Slack is sufficient. At 1,000 users, it's not. Build a read-only Worker endpoint that queries D1 and returns a JSON summary: daily active users, crash rate by version, top 5 tool calls, p50/p95 feedback response time. Pipe this into a simple Observable or Retool dashboard, or just query it manually from the terminal. No custom UI required.

**Exit criteria for Phase 4:** Worker handles 1,000 simulated telemetry requests/minute without 5xx responses. Slack channel does not receive duplicate crash reports for the same stack trace.

**Feature Budget gates:**
- Who: Engine (infrastructure — affects both Glass and the backend)
- Behavior: The feedback and telemetry pipeline does not collapse under public beta load, and Slack remains a useful signal channel instead of a firehose
- 80/5: 80% — invisible to users, but the product is unusable for operators if this fails
- Cost: Low–Medium (Worker config changes, D1 migration if chosen)
- Validated: Math shows free-tier KV is insufficient at 1,000 users
- Trade-off: Deferred from closed beta precisely because it wasn't needed then

---

### Phase 5: Privacy Policy + Terms of Service

No data collection from non-acquaintances without a privacy policy. This is a legal requirement in most jurisdictions (GDPR, CCPA, PIPEDA), not a nicety. The closed-beta consent dialog is a good start but does not substitute for a formal policy document.

**5.1 — Counsel review**
Have an actual lawyer review the policy and ToS before publishing. The policy must cover: what data is collected (telemetry events, feedback submissions, no file contents), how it is stored (Cloudflare Worker + D1, US data centers), how long it is retained, how users can request deletion, and who to contact. This is not a Claude job.

**5.2 — Policy hosting**
Host at a stable URL (e.g., `flint.dev/privacy` and `flint.dev/terms`). The first-run consent dialog must link to both.

**5.3 — Updated consent copy**
Update the first-run dialog to reference the privacy policy URL and update the description to match whatever the final policy actually says. Do not finalize consent copy before the policy is written.

**5.4 — Record of consent**
Store a timestamped record in `userData/consent.json`: `{ version: "1.0", accepted: true, timestamp: "..." }`. If the policy is updated materially, bump the version and re-prompt on next launch.

**Exit criteria for Phase 5:** A lawyer has reviewed and approved the policy. The policy is live at a stable URL. The first-run dialog links to it. Consent is recorded per-user.

**Feature Budget gates:**
- Who: Both (legal compliance affects every user)
- Behavior: A public tester in the EU can read exactly what data Flint collects and request its deletion
- 80/5: 80% — required for any data collection, full stop
- Cost: Low (doc hosting, consent dialog update) + external cost (legal review)
- Validated: GDPR/CCPA are not optional; no validation needed
- Trade-off: Cannot launch public beta with telemetry enabled until this is done; the order is Phase 5 before public launch, not before worker hardening

---

### Phase 6: Public Onboarding

Closed beta assumed the tester knows Justin. The TESTER-WELCOME.md is written for a design partner who got a personal invite. Public testers arrive cold — they found the product on a landing page, read a post, or followed a link. The first-touch experience must work without a 30-minute Zoom call.

**6.1 — Public install guide**
Rewrite the install guide to remove personal references ("email justin.tiemann@gmail.com"). Replace with: in-app feedback widget, public issue tracker (GitHub Issues or Linear public board), and a community Slack/Discord invite.

Remove the "Known issues: no signing yet" section — signing is resolved in Phase 2.

Add a "What is Flint?" section at the top for users who didn't read the landing page carefully.

**6.2 — First-launch experience audit**
Walk through the Garrison (first-launch wizard) as a new user who has never heard of Flint. Every step that assumes prior context is a bug. Common failure modes:
- Wizard refers to "your design system" before explaining what that means in Flint's context
- First-run audit produces violations the user doesn't understand because the error taxonomy isn't surfaced in the wizard
- Empty project state looks broken, not intentional

File these as specific bugs, not a "needs polish" note.

**6.3 — Self-service community channel**
A public Slack or Discord where testers can ask questions, report bugs, and talk to each other. At 1,000 testers, async community scales better than 1-on-1 DMs. Justin should not be the only support path.

**6.4 — Triage process**
Define before launch, not after. Suggested model:
- GitHub Issues is the canonical bug tracker (public, searchable, linkable)
- Feedback widget posts to Slack for triage, but the actionable item is a GitHub Issue
- Bug severity: P0 (data loss / crash on launch) gets a same-day patch. P1 (feature broken) gets queued for the next release. P2+ gets labeled and reviewed weekly.
- One person owns triage per week. With 1,000 testers, expect 20–40 reported issues/week at launch.

**Exit criteria for Phase 6:** A person who has never heard of Flint can download it, install it, complete the Garrison wizard, and run their first audit without contacting anyone.

---

### Phase 7: Landing Page + Download CDN

The landing page is the first thing a public tester sees. It answers: what is this, who is it for, is it safe to download.

**7.1 — What the landing page must communicate**
- What Flint does (one sentence: the governance layer that makes AI-generated UI safe to ship)
- Who it's for (designers and developers who use AI coding tools)
- What the beta is (free, early access, feedback welcome)
- Download links (macOS + Windows, signed builds)
- Privacy policy + ToS links
- A way to follow for updates (email list or Twitter/X)

It does not need to be beautiful. It needs to be honest and fast to load. A static HTML page on Cloudflare Pages is sufficient.

**7.2 — Download CDN**
Host `.dmg` and `.exe` on Cloudflare R2 with a public download URL. Wire the auto-updater feed to the same bucket. R2 has no egress fees, which matters at scale — a 200MB `.dmg` times 1,000 downloads is 200GB of egress. On S3 that's ~$18. On R2 it's $0.

**7.3 — Version page**
A simple `/releases` page listing: version number, date, changelog summary, download links. Auto-generated from `CHANGELOG.md` on deploy. Gives testers a way to track what changed without reading the commit log.

**Exit criteria for Phase 7:** A person can land on the page, understand what Flint is in under 10 seconds, download the correct build for their OS, and install it following the install guide link.

**Feature Budget gates:**
- Who: Designer (acquisition, first-touch)
- Behavior: A stranger on the internet can find, download, and install Flint without any assistance
- 80/5: 80% — every first user hits this before anything else
- Cost: Low (static site, R2 bucket, no custom backend needed)
- Validated: Required for any public distribution
- Trade-off: Deprioritizes any additional Glass feature work until this is live

---

### Phase 8: Release Ceremony

Public beta introduces a repeatable release muscle. Every release from here forward follows this process so that going to 1.0 doesn't require rebuilding it.

**8.1 — Semver convention**
- Public beta releases are `0.x.y` — minor for new features, patch for fixes
- `1.0.0` is GA, not a public beta milestone
- Every release has a `CHANGELOG.md` entry following conventional changelog format

**8.2 — Signed build smoke test**
Before pushing any release tag: install the signed build on a clean macOS VM and a clean Windows VM. Run through: launch → Garrison wizard → open a project → run audit → export. If any step fails, the release does not ship.

**8.3 — Release tag → CI pipeline**
Pushing `v*.*.*` triggers: build → sign → notarize (macOS) → upload to R2 → update release feed → post to community Slack channel. Fully automated. No manual upload steps.

**8.4 — Rollback plan**
R2 retains the previous two release artifacts. If a bad build ships: revert the `latest.yml` feed to point at the previous build. The auto-updater will offer the previous version to users who updated. Document the rollback steps in a runbook so anyone can execute it, not just Justin.

**Exit criteria for Phase 8:** Ship two consecutive releases using this process. If it works twice without a manual step, it works.

---

## Dependency Order

```
Phase 1 (security fixes) → unblocks everything
Phase 2 (signing)        → required before Phase 7 (landing page) and Phase 8 (release ceremony)
Phase 3 (auto-updater)   → requires Phase 2; can be parallel with Phase 4–5
Phase 4 (Worker hardening) → independent; should complete before public launch
Phase 5 (privacy/ToS)    → independent; must complete before public launch
Phase 6 (onboarding)     → requires Phase 2 (install guide references signed builds)
Phase 7 (landing page)   → requires Phase 2 (download links) and Phase 5 (policy links)
Phase 8 (release ceremony) → requires Phase 2, 3, 7

Minimum set to open the public beta:
  Phases 1, 2, 4, 5, 6, 7 must be DONE.
  Phases 3 and 8 should be done; auto-update especially blocks a good ongoing experience.
```

---

## Risks

**R1 — Apple enrollment delay.** Apple can take 2–7 business days to approve a new Developer Program account. If this slips, everything in Phase 2 slips with it. Enroll first, before writing any code for this plan.

**R2 — SmartScreen reputation cold start.** Even with a valid Azure Code Signing EV cert, SmartScreen may show an "Unknown publisher" warning on the first several hundred downloads until enough users install without reporting it as malware. Mitigate: clear communication on the landing page ("This will show a publisher warning for the first few weeks — this is normal for new signed apps"). Cannot be shortcutted.

**R3 — Privacy policy delays public launch.** If counsel review takes weeks, either delay the launch or launch without telemetry enabled (consent dialog present but no data collected until policy is live). The latter is safe and reversible.

**R4 — Worker D1 migration breaks existing telemetry.** If the closed-beta Worker is still active during the migration, there's a gap window where events are lost. Acceptable for beta — plan for a cutover window where the old Worker is disabled before the new one is enabled, not a zero-downtime migration.

**R5 — Bug volume exceeds triage capacity.** 1,000 testers could generate 50+ issues in week one. Without a triage process defined before launch (Phase 6.4), this becomes a support hole that erodes the public beta's feedback quality. Triage ownership must be assigned before invitations go out.

**R6 — `'unsafe-eval'` surfaces as a trust concern.** Security-aware testers may notice the CSP and ask about `'unsafe-eval'`. With the updated comment from Phase 1.1, there's a clear honest answer: it's required by the LivePreview engine, bounded by the input surface, and the Worker sandbox to remove it is on the roadmap. This is not a vulnerability — it is an architectural decision with a known path to resolution.

**R7 — Auto-updater breaks a subset of installs.** The first time the auto-updater runs in production is always a risk. Mitigate: test the update path (not just the install path) on both platforms before the first post-launch release. The rollback plan in Phase 8.4 covers the worst case.

---

## Success Signals (Public Beta → GA Decision)

The question public beta answers is not "is this good?" but "is this ready for 1.0?" These signals define "ready":

- **Signing and update work invisibly.** No triage tickets about installation friction. Zero "how do I install this" questions.
- **Crash rate under 0.5 per user-week.** Closed beta targeted 1. Public beta raises the bar.
- **7-day retention above 40%.** At least 4 in 10 users who download come back after 7 days. Measures whether the core loop is compelling, not just curiosity.
- **Triage queue stays manageable.** The P0/P1 backlog does not grow week-over-week after the first two weeks. Means the team is shipping faster than bugs accumulate.
- **One repeating use case from non-design-partners.** Closed beta validated with people who know Flint. Public beta should surface at least one clear repeating use case from users who found it on their own. That use case defines the GA pitch.
- **Privacy + ToS have been in place for at least 30 days** before 1.0. Not negotiable.
- **Release ceremony executed cleanly at least 3 times.** Means the infra is trusted, not lucky.

When all six are true, open the GA conversation.
