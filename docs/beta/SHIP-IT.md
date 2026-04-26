# Ship-It Runbook — Flint Closed Beta

This is your one-stop checklist to go from **code on my laptop** to **testers
downloading a build**. It's split into three one-time setup tasks and then the
actual build-and-ship commands.

One-time setup: ~45 minutes (mostly account creation). After that, producing a
new build is a single command.

---

## Part 1 — Slack workspace + incoming webhook (10 min)

The telemetry events need somewhere to land. A fresh Slack workspace is the
easiest option — free, takes minutes, and gives you a live stream you can scroll.

1. Go to **https://slack.com/get-started#/createnew**. Create a workspace called
   `flint-beta` (or whatever you like — only you will be in it).
2. Once in, create a channel called `#telemetry` and another `#feedback` (the
   second one is optional, for later).
3. Go to **https://api.slack.com/apps** → **Create New App** → **From scratch**
   → name it `Flint Beta Bot` → pick the workspace you just made.
4. In the left sidebar click **Incoming Webhooks** → turn it **On** → scroll
   down, click **Add New Webhook to Workspace** → pick `#telemetry` → click
   **Allow**.
5. Copy the webhook URL. It looks like
   `https://hooks.slack.com/services/T.../B.../...`. Keep it somewhere safe —
   it's effectively a password for posting to your channel.

**Save this for later: `SLACK_WEBHOOK_URL=<the url>`**

---

## Part 2 — Cloudflare Worker (15 min)

The Worker is the little middleman that catches telemetry events and forwards
them to Slack. Free forever at your scale.

### 2a — Cloudflare account

1. Go to **https://dash.cloudflare.com/sign-up**. Free account. Verify your
   email.
2. No need to add a domain — Workers use a free `*.workers.dev` subdomain.

### 2b — Install the command-line tool (one-time)

From a terminal in this repo:

```bash
cd cloudflare-worker
npm install
```

This installs `wrangler`, Cloudflare's deploy tool.

### 2c — Log in to Cloudflare from the terminal

```bash
npx wrangler login
```

This opens a browser, you click **Allow**, the terminal picks up the session.
One-time.

### 2d — Create the KV store (events persistence)

```bash
npx wrangler kv namespace create TELEMETRY_KV
```

The command prints an id that looks like `id = "abc123def456..."`. **Copy that
id**, open `cloudflare-worker/wrangler.toml`, and replace `REPLACE_WITH_KV_ID`
with it.

### 2e — Set the secrets

```bash
# Slack webhook (paste the URL from Part 1 when prompted):
npx wrangler secret put SLACK_WEBHOOK_URL

# Shared secret (makes a random string so strangers can't spam the endpoint).
# Generate one with: openssl rand -hex 16
# Paste the generated string when prompted:
npx wrangler secret put SHARED_SECRET
```

**Save the SHARED_SECRET value** — the app needs it too.

### 2f — Deploy

```bash
npm run deploy
```

Wrangler prints your Worker URL, something like:
`https://flint-telemetry.<your-name>.workers.dev`

Test it:

```bash
curl https://flint-telemetry.<your-name>.workers.dev/health
# → {"ok":true}
```

**Save for later: `FLINT_TELEMETRY_URL=https://flint-telemetry.<your-name>.workers.dev/events`**
(Note the `/events` at the end — that's the endpoint the app posts to.)

---

## Part 3 — GitHub Personal Access Token (5 min)

This lets the app turn tester feedback into private GitHub issues in the
Bridge repo.

1. Go to **https://github.com/settings/tokens** → **Fine-grained tokens** →
   **Generate new token**.
2. Settings:
   - **Name:** `Flint Beta Feedback Bot`
   - **Expiration:** 90 days (renew after closed beta)
   - **Repository access:** Only select repositories → `Jtiem/lunar-elevator-bridge`
   - **Permissions → Repository permissions:**
     - Issues: **Read and write**
     - Metadata: **Read-only** (required by GitHub, set automatically)
3. Generate, copy the token (starts with `github_pat_`). **You only see it once.**

**Save for later: `FLINT_FEEDBACK_GITHUB_TOKEN=github_pat_...`**

---

## Part 4 — Put it all together

You now have three values:

- `FLINT_TELEMETRY_URL=https://flint-telemetry.<you>.workers.dev/events`
- `FLINT_TELEMETRY_SECRET=<the shared secret from Part 2e>`
- `FLINT_FEEDBACK_GITHUB_TOKEN=github_pat_...`

Put them in a file called `.env.beta` at the repo root (gitignored — don't
commit this file):

```bash
# .env.beta
export FLINT_TELEMETRY_URL="https://flint-telemetry.<you>.workers.dev/events"
export FLINT_TELEMETRY_SECRET="<shared secret>"
export FLINT_FEEDBACK_GITHUB_TOKEN="github_pat_..."
```

Before any beta build, source the file:

```bash
source .env.beta
```

Now you can build:

```bash
# Local test build (mac only, no publish):
npm run build:beta:quick

# Full mac + windows build, no publish:
npm run build:beta

# Full release — builds AND publishes to Citadel GitHub Releases:
npm run release:beta
```

The build script prints a header showing exactly what got baked in:

```
──────────────────────────────────────────────
  Flint Beta Build
──────────────────────────────────────────────
  Build ID  : beta-0.2.0-20260423
  Expires   : 2026-06-22T00:00:00Z  (60 days)
  Telemetry : https://flint-telemetry.you.workers.dev/events
  Feedback  : configured
──────────────────────────────────────────────
```

If any of those say `<not set>`, the env var didn't load. `source .env.beta`
and try again.

---

## Part 5 — Smoke test a build

Before sending to testers:

1. Run `npm run build:beta:quick` on your Mac. Output lands in
   `release/mac-arm64/Flint Glass.app`.
2. Open the app. You should see the welcome screen.
3. Click **Try the Demo Project**.
4. Go to your Slack `#telemetry` channel. Within 60 seconds you should see an
   `app.launched` event. That confirms the full pipeline works.
5. Click the **Beta** chip in the status bar, file a test feedback. Check
   `github.com/Jtiem/lunar-elevator-bridge/issues` — a new issue should appear.

If both work, you're cleared to ship.

---

## Part 6 — Distribute to testers

1. `npm run release:beta` produces the signed mac `.dmg` + windows `.exe` and
   publishes them to the Citadel GitHub Releases page.
2. Send each tester:
   - Link to the release on `github.com/Jtiem/citadel-flint/releases`
   - The install guide at `docs/beta/INSTALL-GUIDE.md` (or paste it into the
     email)
   - A one-line reminder that the build expires in 60 days and you'll send a
     new one before then

Done.

---

## Part 7 — Troubleshooting

**"The telemetry line says `<not set>` in the build output."**
Run `echo $FLINT_TELEMETRY_URL`. If empty, you didn't `source .env.beta`. Do
that and try again.

**"Testers report Slack is silent."**
- Open the Cloudflare dashboard → Workers → `flint-telemetry` → **Logs**. If
  requests are hitting the Worker but no Slack messages appear, the webhook is
  wrong — redo Part 1 and `wrangler secret put SLACK_WEBHOOK_URL`.
- If no requests hit the Worker at all, the testers probably declined consent
  on the welcome screen. Nothing wrong — that's working as designed.

**"GitHub issues aren't being created."**
- Check the token hasn't expired (github.com/settings/tokens).
- Check the repo name. Currently `Jtiem/lunar-elevator-bridge`. Set in
  `electron/main.ts`.

**"Build expires immediately on tester's machine."**
- You shipped without `FLINT_BETA_DAYS` set properly. Check the build output
  header — the `Expires` line must be a future date. If not, rebuild.

---

## Reference — what each file does

| File | Purpose |
|------|---------|
| `cloudflare-worker/src/index.ts` | The actual Worker code |
| `cloudflare-worker/wrangler.toml` | Cloudflare deploy config (KV id goes here) |
| `scripts/build-beta.sh` | Build script — bakes env vars into the app |
| `electron/betaTelemetry.ts` | In-app telemetry service |
| `electron/betaGuard.ts` | Expiry kill switch |
| `electron/main.ts` (beta:submit-feedback) | GitHub issue forwarder |
| `docs/beta/INSTALL-GUIDE.md` | What you send to testers |
| `docs/beta/SHIP-IT.md` | This file |
