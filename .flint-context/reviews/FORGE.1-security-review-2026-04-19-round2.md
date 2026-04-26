# FORGE.1 Security Review — Round 2 (Re-Review After Fix-Forward)

- **Phase:** FORGE.1
- **Dimension:** security
- **Reviewer:** flint-security-reviewer
- **Date:** 2026-04-19
- **Round:** 2
- **Prior verdict:** REVISE (2 HIGH + 5 MEDIUM)
- **This verdict:** **SHIP** (0 blocking, 1 suggestion)

## Summary

All 7 prior security findings are resolved with corroborating code + test
evidence. The deliberate-breakage probes for SEC-HIGH-1 (slug traversal) and
SEC-HIGH-2 (symlink attack) exercise the bypass paths and assert the post-fix
behaviour, locking the regressions. Web parity is intact across the Electron
and Express handlers — same argv shape, same env scrub, same realpath gate.

One low-severity suggestion remains: the SSRF carve-out for the Electron
desktop binary (SEC-MED-2) is documented in `server/index.ts` but not in
`electron/main.ts`, so a future reader of the Electron handler would not see
why the SSRF check is web-only. Documentation-only — does not block ship.

## Verified Controls (Per-Finding Status)

### SEC-HIGH-1 — Slug traversal (RESOLVED)

- **Electron:** `electron/main.ts:2520-2542` — slug derivation rejects
  empty / `.` / `..` / path-separator / NUL slugs and falls back to
  `randomUUID()`. A defence-in-depth `path.resolve` + `startsWith(flintProjectsDir + path.sep)`
  assertion at line 2538-2541 throws if the candidate ever escapes the
  sandbox. Boundary check is present.
- **Web:** `server/index.ts:1747-1764` — identical sanitisation and
  boundary assertion. Parity confirmed.
- **Probe:** `electron/__tests__/projectSmartOpen.test.ts:325-363` — five
  assertions covering `..`, `.`, embedded path separators, and a direct
  `resolveCloneDest('..')` call that asserts the boundary-throw fires.
  Probe exercises the vulnerable derivation path before the UUID fallback.

Status: **resolved**.

### SEC-HIGH-2 — Symlink attack via clone (RESOLVED)

- **Electron (GitManager):** `electron/GitManager.ts:255-296` —
  `core.symlinks=false` appears at argv index 1-2, BEFORE `clone` at
  index 5. Confirmed via direct read of the argv literal.
- **Web (server/index.ts):** `server/index.ts:1769-1790` — same argv
  ordering. `core.symlinks=false` precedes `clone`.
- **Probe:** `electron/__tests__/projectSmartOpen.test.ts:399-405` —
  asserts `symlinkIdx >= 0` and `cloneIdx > symlinkIdx`. The probe also
  pins the `--` separator placement (line 413-419) which prevents
  `--upload-pack=evil` style flag injection.

Status: **resolved**.

### SEC-MED-1 — Clone timeout / shallow clone (RESOLVED)

- **Electron:** `electron/GitManager.ts:263-264, 270` — `--depth=1`,
  `--single-branch`, and `timeout: 120_000` all present. Typed
  `clone-timeout` error thrown on `SIGTERM` / `ETIMEDOUT` (lines 281-283).
- **Web:** `server/index.ts:1775-1776, 1782, 1791-1795` — identical.
- **Probe:** `projectSmartOpen.test.ts:407-411` — asserts both shallow
  flags are present in the argv shape.

Status: **resolved**.

### SEC-MED-2 — SSRF policy (RESOLVED — minor doc gap)

- **Web:** `server/index.ts:1716-1745` — DNS lookup of the URL host with
  rejection of RFC1918 (`10.`, `192.168.`, `172.16-31.`), loopback
  (`127.`, `::1`), and link-local (`169.254.`, `fe80:`) ranges. DNS
  failures are best-effort (swallowed) so air-gapped legitimate clones
  are not blocked, but explicit "refusing to clone" errors are rethrown.
- **Electron:** No SSRF check, by design — the desktop binary runs in
  a user-trusted context where the user's own network policy applies.

The carve-out rationale is in the Web comment but **not** mirrored in
`electron/main.ts:2480-2547`. A reader of the Electron handler in
isolation would not see the documented threat-model reason. See suggestion
SUG-1 below.

Status: **resolved (with suggestion)**.

### SEC-MED-3 — Schema hardening (RESOLVED)

- `shared/ipc-validators.ts:449-454` — `projectSmartOpenSchema` enforces
  `min(1)`, `max(4096)`, `.strict()`, and a `\p{Cc}\p{Cf}` refine that
  rejects control + format characters.
- **Probe:** `projectSmartOpen.test.ts:202-260` — nine assertions covering
  empty, null, numeric, extra-key, control-char, and 5000-char inputs.

Status: **resolved**.

### SEC-MED-4 — Credential prompt neutralisation (RESOLVED)

- **Electron (GitManager):** `electron/GitManager.ts:261, 271-275` —
  `-c core.askPass=true` in argv plus `GIT_TERMINAL_PROMPT=0`,
  `GIT_ASKPASS=echo`, `SSH_ASKPASS=echo` in env. Typed `auth-required`
  error on credential-related stderr (lines 285-291).
- **Web:** `server/index.ts:1773, 1783-1788, 1796-1804` — identical.
- **Probe:** `projectSmartOpen.test.ts:432-445` — asserts every env var.

Status: **resolved**.

### SEC-MED-5 — Path normalisation (RESOLVED)

- **Electron:** `electron/main.ts:2559-2563` — `realpathSafe(home)` plus
  `path.resolve(input)` plus boundary assertion. Replaces the prior
  `startsWith(home)` string check.
- **Web:** `server/index.ts:1814-1822` — inline realpath import with
  fallback, then identical resolve + boundary check.
- `realpathSafe` defined at `electron/main.ts:175-182`.

Status: **resolved**.

## Probe Quality Audit (Spot Check)

The brief required confirming probes exercise the vulnerability rather than
just call the fixed happy-path. Verified:

- **SEC-HIGH-1 probe** (`projectSmartOpen.test.ts:328-336, 350-354`):
  Constructs the exact pre-fix attacker URL `https://attacker.example/foo/..`,
  walks the same `split('/').pop()` derivation, and asserts the result is
  not `..`. The defence-in-depth case (line 350-354) calls
  `resolveCloneDest('..', flintProjectsDir)` directly — bypassing
  `deriveSlug` entirely — and expects a throw. Both halves of the
  defence are independently exercised. Real probe.

- **SEC-HIGH-2 probe** (`projectSmartOpen.test.ts:399-405`): Tests the
  argv-shape contract, not a happy-path call. The probe would still
  fire RED if a future refactor moved `core.symlinks=false` AFTER `clone`
  (where git would ignore it because `-c` only applies to subsequent
  commands). The intent is locked.

  Caveat: the probe uses an in-test `buildCloneArgs` mirror function
  rather than importing from `GitManager.ts`. A drift between the two
  is the regression signal — comment at line 384-385 makes this
  explicit. Acceptable given that the test would otherwise need to boot
  Electron to invoke the real handler.

## Findings

### [SUG-1] (suggestion) Mirror SSRF carve-out rationale into Electron handler

- **Location:** `electron/main.ts:2480-2547` (around the `project:smart-open`
  handler header)
- **Observed:** `server/index.ts:1716-1745` documents *why* the SSRF check
  is web-only ("desktop is user-trusted; web server is multi-tenant"). The
  Electron handler has no parallel comment.
- **Rationale:** A future reader of the Electron handler in isolation
  could conclude SSRF is missing rather than deliberately excluded, and
  might "fix" it without realising the threat model is different. This
  is a documentation gap, not a control gap.
- **Proposed fix:** Add a 2-3 line comment block to the Electron handler
  header explaining that SSRF gating lives in `server/index.ts` only,
  with a one-sentence threat-model justification.
- **Scope:** one-file
- **Status:** open
- **Commandment:** N/A (process invariant — auditability)

## Rubric

| Criterion | Result |
|-----------|--------|
| Slug derivation rejects `.`, `..`, `/`, `\`, NUL and falls back to UUID (Electron + web) | pass |
| Final `path.resolve` + boundary assertion is present in both clone paths | pass |
| `core.symlinks=false` appears BEFORE `clone` in both argv arrays | pass |
| Clone timeout (`120_000ms`) and shallow flags (`--depth=1 --single-branch`) in both paths | pass |
| Typed `clone-timeout` error thrown on SIGTERM/ETIMEDOUT | pass |
| Web SSRF check rejects RFC1918, loopback, link-local | pass |
| Electron SSRF carve-out rationale is documented in code | fail (SUG-1) |
| `projectSmartOpenSchema` enforces `min(1)`, `max(4096)`, control-char ban, `.strict()` | pass |
| Env scrub (`GIT_TERMINAL_PROMPT`, `GIT_ASKPASS`, `SSH_ASKPASS`) + `core.askPass=true` in both paths | pass |
| Typed `auth-required` error thrown on credential-related stderr | pass |
| `realpath(home)` + `path.resolve(input)` boundary check replaces string `startsWith` in both paths | pass |
| Deliberate-breakage probes exercise the vulnerable derivation, not just the fixed happy-path | pass |

## Verdict

**SHIP** — derived from `deriveVerdict(findings, 'security')`:
0 blocking, 0 warning, 1 suggestion. The lone suggestion is documentation
only. All 7 prior findings are closed with code + test evidence.
