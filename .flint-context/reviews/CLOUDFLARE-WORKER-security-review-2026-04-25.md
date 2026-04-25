# Cloudflare Worker — Security Review (Phase A.4)

## Re-review 2026-04-25 — VERDICT: SHIP (fix-forward)

> Plain English: all 4 issues from the previous review are resolved. The Worker now validates every event against a strict schema, neutralizes Slack injection by wrapping every dynamic field in escaped inline-code, refuses to start without a shared secret, and retains data for 14 days instead of 90. Safe to broadcast to beta testers. The earlier non-blocking warnings (timing-safe compare, rate limiting, body cap, dedup, log hygiene) remain open as fix-forward — none were re-introduced or worsened.

### Re-verification of prior blockers

| ID    | Status     | Evidence |
|-------|------------|----------|
| BLK-1 | RESOLVED   | `cloudflare-worker/src/index.ts:36-86` — Zod discriminated union over 5 literal event names (`app.launched`, `app.crashed`, `mcp.tool_called`, `audit.completed`, `session.ended`), per-event payload schemas, base envelope (`id`, `ts`, `sessionId`, `buildId`, `appVersion`, `platform`) all required and non-empty. Batch cap `.min(1).max(100)`. `safeParse` at line 126; 400 on failure with sanitized reason at line 132. Unknown event names fail the discriminated union and return 400. |
| BLK-2 | RESOLVED   | `escapeForSlackInlineCode` at lines 192-198 strips backticks (closes the inline-code span) and HTML-escapes `&`, `<`, `>`. Every dynamic field — `name`, `platform`, `buildId`, session prefix, and stringified `payload` — is escaped AND wrapped in backticks at lines 201-209. Trace: payload `<!channel> urgent` → `JSON.stringify` → `"<!channel> urgent"` → escape → `&lt;!channel&gt; urgent` → wrapped in `\`…\`` → Slack renders literally. No broadcast ping path remaining. |
| BLK-3 | RESOLVED   | Lines 109-112 — `if (!env.SHARED_SECRET || env.SHARED_SECRET.trim() === '')` returns `503 Service unavailable` with a `console.error`. The check runs before auth and before parsing, so an unconfigured Worker cannot be probed for behavior. |
| WARN-4| RESOLVED   | Line 93 — `KV_TTL_SECONDS = 60 * 60 * 24 * 14` (1,209,600s = 14 days). Applied at line 156 in `storeInKV`. |

### Regressions introduced by the fix patch

None. The only new dependency is `zod ^3.22.3` (`package.json:12`), which is a well-audited runtime validator with no native code or postinstall hooks. The schema mirrors the contract in `BETA-TELEMETRY-WIRING.contract.ts`, satisfying the "explicit coupling" comment at line 33.

### Fix-forward items (still open, not blocking)

These were warnings/suggestions in the prior review. They were not in scope for this re-review and remain unaddressed; surfacing them so they aren't lost:

1. **WARN-1** — Secret comparison at line 115 is still `provided !== env.SHARED_SECRET` (timing leak). One-line fix with `crypto.subtle.timingSafeEqual` when convenient.
2. **WARN-2** — No rate limiting. Defer until first signs of abuse.
3. **WARN-5** — Slack `catch { /* swallow */ }` at line 141 and `ctx.waitUntil(storeInKV(...))` at line 138 still silently drop errors. Add a `console.error` to each so beta operations have visibility.
4. **SUG-1** — No `Content-Length` cap before `request.json()`. Cheap to add (`if (Number(request.headers.get('content-length')) > 256_000) return 413`).
5. **SUG-2** — Slack dedup not implemented; replays still fan out.
6. **SUG-3** — Verify `wrangler tail` does not surface `X-Flint-Secret` header value before sharing logs externally.

### Re-review rubric

| Criterion | Result |
|-----------|--------|
| BLK-1 fix landed (schema validation + name allowlist) | pass |
| BLK-2 fix landed (Slack escape + inline-code wrap) | pass |
| BLK-3 fix landed (fail-closed on missing secret) | pass |
| WARN-4 fix landed (14-day retention) | pass |
| No new security regressions introduced | pass |
| Dependency footprint vetted (`zod`) | pass |

### Re-verdict

**SHIP** — all blocking findings resolved, no regressions, fix-forward items are acceptable for closed-beta launch.

---

# Original Review (2026-04-25, superseded by re-review above)

**Date:** 2026-04-25
**Reviewer:** flint-security-reviewer
**Scope:** `cloudflare-worker/src/index.ts`, `cloudflare-worker/wrangler.toml`, `cloudflare-worker/package.json`
**Verdict (derived):** **BLOCK** — security dimension with blocking findings auto-escalates per `deriveVerdict()`.

> Plain English: this Worker is a thin pipe with almost no input validation. The endpoint will work fine for friendly Glass clients, but anything with the shared secret can abuse it freely. Most issues are small, but two of them (no schema validation + Slack mrkdwn injection through `event.name`) should be fixed before broadcasting the URL to beta testers.

---

## Risk Summary

| Severity   | Count |
|------------|-------|
| Blocking   | 3     |
| Warning    | 5     |
| Suggestion | 3     |

---

## Top 3 things that should block beta ship

1. **No event-schema validation.** Worker accepts any object with an `events: []` array and forwards every event to Slack. A future Glass version (or a leaked secret + curl) can post arbitrary `name`, arbitrary `payload`, and the Worker will store it in KV for 90 days and post it to Slack. This breaks the privacy promise that "only known event types reach the server."
2. **Slack `mrkdwn` injection via `event.name` and `event.payload`.** `formatEventLine` interpolates `e.name` and `JSON.stringify(e.payload)` directly into a Slack `mrkdwn` block. An attacker who obtains the shared secret can post `{ name: "<!channel> hi", ... }` and ping every member of the workspace, or embed phishing links rendered as Slack-formatted text.
3. **`SHARED_SECRET` is optional.** If the operator forgets `wrangler secret put SHARED_SECRET`, the endpoint is wide open to the public internet — anyone can fill the KV store and spam Slack. The Worker should fail closed when no secret is configured.

---

## Findings

### [BLOCKING] BLK-1 — No schema validation; Worker forwards arbitrary event shapes
- **Evidence:** `cloudflare-worker/src/index.ts:65-74` — `request.json()` cast to `EventBatch` with no per-event validation.
- **Observed:** The Worker checks only that `batch.events` is an array. It never validates `name`, `ts`, `sessionId`, `payload` shape, or that the event name is one of the 5 known types (`app.launched | app.crashed | mcp.tool_called | audit.completed | session.ended`).
- **Rationale:** Glass-side compile-time enforcement does not protect the server. Anyone with the shared secret can post `{ events: [{ name: "🍌", payload: { whatever: "..." }, ... }] }` and the Worker will (a) persist it in KV for 90 days, (b) forward it to Slack. Spec drift (item 9) goes from "rejects unknown event" to "forwards blindly." Also blocks privacy claim integrity (item 10) — no enforcement that payloads stay minimal.
- **Proposed fix:** Add a Zod (or hand-rolled) validator. Allowlist event names. Reject payloads with extra keys for known events (or strip them). Return 400 with a machine-readable reason.
- **Scope:** one-file
- **Status:** RESOLVED (see re-review at top)

### [BLOCKING] BLK-2 — Slack mrkdwn injection via `event.name` / `event.payload`
- **Evidence:** `cloudflare-worker/src/index.ts:118-122` — ``return `• \`${e.name}\` · ... ${payload}` ``
- **Observed:** `e.name` and the stringified `e.payload` are concatenated into the Slack `mrkdwn` block without escaping. Slack mrkdwn supports `<!channel>`, `<!here>`, `<@USERID>`, link syntax `<https://evil|click>`, and rich formatting.
- **Rationale:** With BLK-1 unfixed (no name allowlist), any client with the shared secret can craft an event whose `name` mass-pings the workspace or renders phishing links inside the trusted-looking "Flint Beta" alert. Even with an event-name allowlist, `payload` JSON containing `<!channel>` would still pass through because of the 200-char slice.
- **Proposed fix:** (a) allowlist event names server-side, (b) strip/escape `<`, `>`, `@`, `!` from any user-controlled string before it enters a Slack block, or wrap each line in a `code` block which neutralizes mrkdwn directives.
- **Scope:** one-file
- **Status:** RESOLVED (see re-review at top)

### [BLOCKING] BLK-3 — `SHARED_SECRET` is optional → endpoint can be deployed wide open
- **Evidence:** `cloudflare-worker/src/index.ts:58-63` — `if (env.SHARED_SECRET)` guard; absent secret skips auth entirely.
- **Observed:** If the operator deploys without running `wrangler secret put SHARED_SECRET`, every request is accepted. There is no startup check, no warning log, no fail-closed behavior.
- **Rationale:** Closed-beta operations are easy to misconfigure. A silently-open endpoint will fill KV (storage cost), spam Slack, and let scanners catalog Flint's beta event taxonomy.
- **Proposed fix:** Treat absence of `SHARED_SECRET` as a configuration error: return `503 Service Unavailable` until the secret is set, or throw at module load (Worker will fail to start).
- **Scope:** one-line
- **Status:** RESOLVED (see re-review at top)

---

### [WARNING] WARN-1 — Secret comparison is not constant-time
- **Evidence:** `cloudflare-worker/src/index.ts:60` — `if (provided !== env.SHARED_SECRET)`
- **Observed:** Plain string `!==` short-circuits on the first differing byte, leaking length and prefix information through timing.
- **Rationale:** Workers run on shared infrastructure with variable latency, so practical exploitation is hard but not impossible (Bleichenbacher-style statistical attacks). Easy to fix; cheap insurance.
- **Proposed fix:** Use `crypto.subtle.timingSafeEqual` after encoding both sides as `Uint8Array`. Compare lengths first (early-return on length mismatch is acceptable).
- **Scope:** one-line
- **Status:** open (fix-forward)

### [WARNING] WARN-2 — No rate limiting per IP or per secret
- **Evidence:** `cloudflare-worker/src/index.ts` (entire `fetch` handler)
- **Observed:** No `cf-connecting-ip`-based throttle, no per-secret budget, no batch-size cap. Caller can POST as fast as Cloudflare's free tier will accept.
- **Rationale:** A leaked secret means unbounded KV writes (cost) and Slack messages (rate-limit collisions, eventual webhook disable). Question 4 in the audit checklist.
- **Proposed fix:** Add a Durable Object or KV-backed token bucket keyed on `cf-connecting-ip` + secret hash; cap batches to N events (e.g., 50) and requests to M/min (e.g., 60).
- **Scope:** cross-file
- **Status:** open (fix-forward; batch cap of 100 partially mitigates)

### [WARNING] WARN-3 — No CORS / `Origin` restriction
- **Evidence:** `cloudflare-worker/src/index.ts:44-86` — no `Access-Control-*` headers and no `Origin` header check.
- **Observed:** A browser on any site can POST JSON to `/events` (preflight not required for `Content-Type: application/json` only if "simple"; mostly will preflight, which the Worker doesn't handle, so most browser misuse fails). However, server-to-server clients have no origin gate at all.
- **Rationale:** The endpoint is for the Electron app, which sends from a Node.js process (no origin). Browsers should be denied. With BLK-3 fixed, browser abuse needs the secret, but defense-in-depth says reject non-Electron `User-Agent` or require a custom header that browsers can't set without preflight (already happens with `X-Flint-Secret`, so this is partially mitigated — note in code).
- **Proposed fix:** Add explicit OPTIONS handler returning `Access-Control-Allow-Origin: null` (or omit ACAO entirely). Document that the `X-Flint-Secret` custom header forces a preflight, which is the de-facto browser block.
- **Scope:** one-file
- **Status:** open (fix-forward)

### [WARNING] WARN-4 — KV stores full event payload for 90 days; privacy drift risk
- **Evidence:** `cloudflare-worker/src/index.ts:89-97` — full `JSON.stringify(e)` written with 90-day TTL.
- **Observed:** The Worker preserves whatever Glass sends — including `app.crashed.stack`. Glass redacts homedir, but any other PII that slips into a future payload (file path, project name, user input) will be retained.
- **Rationale:** Audit checklist item 10 (privacy claim integrity). The privacy claim is "we forward minimal events" but the Worker silently builds a 90-day archive. If a beta tester asks "what did you keep?", the answer should match the spec, not "everything you sent us."
- **Proposed fix:** Either (a) reduce TTL to 7-14 days for closed beta, (b) strip `payload` from KV records and store only `{name, ts, sessionId}`, or (c) document the retention prominently in the beta consent dialog.
- **Scope:** one-line
- **Status:** RESOLVED (see re-review at top)

### [WARNING] WARN-5 — Errors swallowed silently (Slack + KV)
- **Evidence:** `cloudflare-worker/src/index.ts:80` — `catch { /* swallow */ }`; line 77 — `ctx.waitUntil(storeInKV(...))` with no error handler.
- **Observed:** Slack 4xx/5xx, webhook disabled, KV write failure — all invisible. Operator finds out by checking the empty Slack channel.
- **Rationale:** Operations hygiene. Beta is short; you need to know if telemetry breaks.
- **Proposed fix:** `console.error` from inside the catch (Workers Observability captures stderr); add `.catch(err => console.error(...))` to the `waitUntil` promise.
- **Scope:** one-line
- **Status:** open (fix-forward)

---

### [SUGGESTION] SUG-1 — No body size cap
- **Evidence:** `cloudflare-worker/src/index.ts:67` — `await request.json()` with no `Content-Length` check.
- **Observed:** Cloudflare's hard limit is 100MB. Nothing rejects a 50MB batch from an authenticated abuser.
- **Proposed fix:** Reject `Content-Length > 256KB` (covers ~500 well-formed events) before parsing.
- **Scope:** one-line
- **Status:** open (fix-forward; batch cap of 100 partially mitigates)

### [SUGGESTION] SUG-2 — Slack forwarding has no idempotency / dedup
- **Evidence:** `cloudflare-worker/src/index.ts:99-116`
- **Observed:** Replaying the same batch creates duplicate Slack messages. KV is naturally idempotent because the key includes `e.id`, but Slack is not.
- **Proposed fix:** Use the batch's first `e.id` as a `KV.get` lookup before forwarding to Slack; skip if seen in last N minutes.
- **Scope:** one-file
- **Status:** open (fix-forward)

### [SUGGESTION] SUG-3 — `[observability] enabled = true` may capture headers in trace logs
- **Evidence:** `cloudflare-worker/wrangler.toml:15-16`
- **Observed:** Cloudflare Workers Observability captures invocation metadata. Confirm whether `X-Flint-Secret` value is redacted in tail logs.
- **Proposed fix:** Verify in `wrangler tail` output; if the secret is visible, rename the header to a less-obvious name and document the operator should rotate if logs are shared.
- **Scope:** one-line
- **Status:** open (fix-forward)

---

## Verified Controls (passed)

- Slack webhook URL is in `wrangler secret`, not source (`wrangler.toml` comment confirms).
- KV namespace ID in `wrangler.toml` is not a secret (Cloudflare KV IDs are non-sensitive).
- KV key format `events:<ts>:<id>` is naturally idempotent for storage.
- No `eval` / dynamic code execution.
- No external dependencies beyond `@cloudflare/workers-types` (devDep only).
- 90-day TTL is set (vs unbounded retention).

---

## Rubric

| Criterion | Result |
|-----------|--------|
| Shared secret stored in env, not source | pass |
| Slack webhook URL stored in env, not source | pass |
| Constant-time secret comparison | fail (WARN-1) |
| Server-side schema validation of incoming events | fail (BLK-1) |
| Event-name allowlist | fail (BLK-1) |
| Fail-closed when secret unconfigured | fail (BLK-3) |
| User-controlled strings escaped before Slack mrkdwn | fail (BLK-2) |
| Per-IP or per-secret rate limiting | fail (WARN-2) |
| Body size cap | fail (SUG-1) |
| KV retention matches privacy claim | fail (WARN-4) |
| Operational error visibility | fail (WARN-5) |
| No `eval` / dynamic code execution | pass |
| No `unsafe` external dependencies | pass |

---

## Recommendations (priority order)

1. Fix BLK-3 (fail-closed on missing secret) — one-line.
2. Fix BLK-1 (schema validation + event-name allowlist) — pulls double-duty against BLK-2.
3. Fix BLK-2 (escape user-controlled strings before Slack) — wrap lines in code blocks.
4. Address WARN-1, WARN-5 in the same patch (cheap).
5. Decide on WARN-4 (KV retention) before broadcasting the URL — it's a privacy-claim question, not a code question.
6. Defer WARN-2 (rate limiting) and SUG-* until first signs of abuse.

## Scope Coverage

**Reviewed:**
- `cloudflare-worker/src/index.ts`
- `cloudflare-worker/wrangler.toml`
- `cloudflare-worker/package.json`

**Skipped:**
- `cloudflare-worker/node_modules/**` — third-party, out of scope for this review.
- Glass-side telemetry sender — covered by separate beta-telemetry-wiring review.
- `docs/strategy/BETA-CLOSED-PLAN.md` — read for context only, not under audit.
