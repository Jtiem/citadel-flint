# Closed Beta Distribution Plan

**Status:** APPROVED — ready to execute
**Authored:** 2026-04-23
**Owner:** Justin Tiemann
**Target:** 10 design-partner users, private distribution
**Timeline:** ~1 focused week of build work, then ongoing recruitment
**Decision log:**
- Feedback transport: Cloudflare Worker → Slack webhook (no existing Linear/Slack workspace to reuse — stand up fresh)
- Expiry window: **60 days**
- Telemetry: **opt-in** — first launch shows a consent dialog; events only emit after the user clicks Accept (revised 2026-04-25 — GDPR-defensible default; the cost is losing `app.launched` events from users who quit before deciding)

---

## Goal

Validate Flint's core workflow with 10 hand-picked users. Learn what breaks before investing in public-beta infrastructure (code signing, notarization, auto-updater, landing page, docs site).

Depth of signal over breadth. 10 users we can interview weekly > 1,000 anonymous downloads.

---

## Explicitly Out of Scope

These are deferred to the public-beta plan (separate doc, not yet written):

- Apple Developer Program enrollment / macOS notarization
- Azure Code Signing / Windows EV certificate
- Auto-updater (electron-updater + hosted release feed)
- Public landing page, marketing site, download CDN
- Documentation site beyond the one-page install guide
- The 6 deferred code warnings from A/B review (2026-04-20)
- The 2 pre-existing StatusBar test failures (RUNTIME.1 WIP) — unless they block the build
- Performance/leak audit with flint-perf-profiler — defer until telemetry surfaces an issue
- Privacy policy / ToS — consult a lawyer before public beta; closed beta with consent dialog is defensible
- flint-ci CLI runtime fix (non-beta-blocking)

---

## Phase 1: Build Pipeline (Days 1–2)

### 1.1 electron-builder configuration
- Add `electron-builder.yml` at repo root
- Targets: `dmg` (macOS universal — arm64 + x64), `nsis` (Windows x64)
- App ID: `com.flint.glass`
- Product name: `Flint`
- Bundle version wired to `package.json`
- **Exclude:** `flint-mcp/src/**/*.ts`, `flint-mcp/src/**/__tests__/**`, `server/`, `docs/`, `.flint-context/`, test fixtures
- **Include:** `flint-mcp/dist/**`, compiled `electron/dist/**`, Vite `dist/**`
- Output: `release/` (gitignored)

### 1.2 Pre-package build script
- `npm run build:beta` runs in order:
  1. `tsc -p electron`
  2. `vite build`
  3. `cd flint-mcp && npm run build`
  4. `electron-builder`
- Single command produces both `.dmg` and `.exe`
- Verify MCP `dist/` is bundled (past regression — flint-ci hit this)

### 1.3 Unsigned build acceptance
- **macOS:** ad-hoc signed (`codesign --sign -`) so the app runs, not notarized. Users right-click → Open once.
- **Windows:** unsigned. SmartScreen warns; users click "More info" → "Run anyway."
- Document both in install guide.

**Exit criteria:** `npm run build:beta` produces a `.dmg` that launches on a clean macOS machine and a `.exe` that launches on a clean Windows VM.

---

## Phase 2: Kill Switch (Day 2)

### 2.1 Expiry check
- Hardcode `BETA_EXPIRY_UTC` constant injected at build time (env var or Vite define)
- Expiry window: **60 days from build date**
- On `app.whenReady()`: if `Date.now() > BETA_EXPIRY_UTC`, show modal ("This beta build has expired. Contact justin.tiemann@gmail.com for a new build."), then `app.quit()`
- No network call — offline-safe
- Unit test: mock `Date.now()`, verify quit path

### 2.2 Version banner
- StatusBar shows `Beta · expires Jun 22` (date computed from expiry constant)
- Amber color when <7 days remain

**Exit criteria:** Building with `BETA_EXPIRY_DAYS=0` immediately shows expiry modal on launch.

---

## Phase 3: Feedback Widget (Day 3)

### 3.1 UI
- "Send Feedback" button in StatusBar (near Coverage badge)
- Modal: textarea + optional email + auto-attached context (app version, OS, last 5 MCP tool calls from `.flint/context.json`, active file path — **no file contents**)
- Submit / Cancel

### 3.2 Transport
- POST JSON to a Cloudflare Worker that forwards to a Slack webhook
- Worker code ~30 lines; deploy once
- **Fallback:** on network error, copy payload to clipboard with instructions to email it
- No telemetry SDK — one `fetch` call, zero dependencies

### 3.3 Consent copy (first-run dialog)
> "Flint Beta can send anonymous usage events and your feedback submissions to help us improve. No file contents or design data leave your machine. Telemetry is **off until you opt in.** [Accept] [Decline]"

Until the user clicks Accept, no events emit. Decline → feedback widget falls back to clipboard; telemetry stays off permanently.

**Exit criteria:** Click "Send Feedback" → message in Slack within 5 seconds.

---

## Phase 4: Telemetry (Day 3–4)

### 4.1 Events (minimum set)
- `app.launched` — version, OS, locale
- `app.crashed` — stack trace via `process.on('uncaughtException')`
- `mcp.tool_called` — tool name only, **not args**
- `audit.completed` — file count, violation count, duration
- `session.ended` — duration, active time

### 4.2 Transport
- Same Cloudflare Worker, different route
- Batch in 60-second intervals; flush on `app.quit`
- Queue persisted to `userData/telemetry-queue.json` — survives crashes
- Respects decline flag from 3.3

### 4.3 Dashboard
- Skip. With 10 users, tail the Slack channel or query Worker KV directly. A dashboard is premature.

**Exit criteria:** Launch the app → `app.launched` event visible in backend within 60 seconds.

---

## Phase 5: Install Guide (Day 4)

One markdown file rendered as a static HTML page (GitHub Gist or similar is fine). Contents:

- **macOS install:** Download `.dmg` → drag Flint to Applications → right-click Flint → Open → click "Open" in the security dialog. Screenshot each step.
- **Windows install:** Download `.exe` → double-click → "More info" → "Run anyway." Screenshot each step.
- **First launch:** What to expect — wizard walkthrough, first project.
- **Known issues:** Build expires on [date]. No auto-update. No signing yet. Email for help.
- **Feedback:** "Send Feedback" button, or email justin.tiemann@gmail.com.
- **Uninstall:** Drag to Trash / Control Panel. `rm -rf ~/Library/Application\ Support/Flint` (macOS) or `%APPDATA%\Flint` (Windows) to clear data.

**Exit criteria:** A non-technical user can install Flint following this guide without a call.

---

## Phase 6: Recruit & Ship (Days 5–7)

### 6.1 Recruit 10 users
- One-paragraph pitch: what Flint does, the ask (30-min onboarding call, 2–3 sessions over 4 weeks, 30-min exit interview), the offer (early access, direct input on roadmap)
- Targets:
  - 2 design-system leads at product companies
  - 3 senior designers who ship code
  - 2 frontend engineers who work with designers
  - 3 design-to-code curious folks
- Channels: LinkedIn, Twitter DM, existing network. No forms.
- Overshoot — invite 15 to land 10.

### 6.2 Onboarding protocol
- 30-min Zoom per user. Screen share install guide, walk through first project creation, watch them hit the first wall. Take notes.
- Private Slack/Discord channel per user (or shared if they opt in) for async feedback.

### 6.3 Shipping the build
- Upload `.dmg` + `.exe` to private S3 bucket or Dropbox link
- Rotate the link per build — no public index
- Email: "Flint Beta build 0.1.0 — download here, expires [date], install guide attached."

---

## Critical Path Order

```
Day 1–2: Phase 1 (build pipeline) → Phase 2 (expiry)
Day 3:   Phase 3 (feedback) + Phase 4 (telemetry)   [share Cloudflare Worker]
Day 4:   Phase 5 (install guide) + clean-VM verification
Day 5–7: Phase 6 (recruit + first onboardings)
```

---

## Risks

1. **Unsigned Windows builds trigger SmartScreen hard.** Some users won't click through. Mitigate with a Loom walkthrough, not just screenshots.
2. **macOS Sequoia (15.x) has tightened Gatekeeper.** Ad-hoc signing may require a one-time `xattr -cr /Applications/Flint.app`. Test on a fresh 15.x install before shipping.
3. **Cloudflare Worker free-tier request cap.** Fine for 10 users. Revisit at public-beta time.
4. **Kill switch is a hard stop.** Build in a 7-day warning window; have the next build ready before expiry fires. A beta that bricks itself without replacement is worse than no beta.
5. **Telemetry consent must be in the first-launch flow, not buried.** GDPR applies if any user is in the EU — opt-in default with explicit Accept covers closed beta. Revisit copy + record-of-consent flow before public.

---

## Success Signals (end of 4-week beta)

- 7+ of 10 users have completed at least one full audit → fix → export cycle
- At least 20 submitted feedback items
- Crash rate < 1 crash per user-week
- One clear, repeating pain point identified across ≥3 users that informs the next sprint
- One "I would pay for this" or equivalent strong signal
