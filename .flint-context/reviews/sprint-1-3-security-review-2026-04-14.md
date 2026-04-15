# Sprints 1-3 Cross-Sprint Security Review — 2026-04-14

## Verdict: CONDITIONAL-PASS

All critical invariants (process boundary, preload surface, CSP) are intact.
Sprint 3's path sandbox is sound under realistic threat models but has one
latent TOCTOU window and one low-severity information-leak in the parse-error
log path. No blockers. Ship after logging the two findings as follow-up.

## Attack Surface Summary

| Sprint | New IPC | New preload methods | New npm deps | Renderer-side FS | dangerouslySetInnerHTML | Net new attack surface |
|--------|---------|---------------------|--------------|------------------|------------------------|------------------------|
| 1 (governor) | 0 | 0 | 0 | 0 | 0 | Internal only — Babel in visualAuditor replacing regex (net win) |
| 2 (Glass UI) | 0 | 0 | 0 | 0 | 0 | None — pure composition refactor, 18 presentational components |
| 3 (policy) | 0 | 0 | 0 | 0 | 0 | Config path resolution + strict mode (expanded, but sandboxed) |

Verified via `git diff 284a536..fadf2b5` on electron/preload.ts, electron/main.ts
(no IPC handler additions), package.json, and flint-mcp/package.json. No new
dependencies were added across all 3 sprints. `yaml` remains at ^2.7.1.

## Sprint 3 Path Sandbox Audit (config-loader.resolveExtendsRef)

This is the highest-sensitivity surface in scope — user-controlled YAML
`extends:` strings become filesystem reads. Audited line-by-line.

### Defense stack (as implemented)

1. `canonicalRoot = fs.realpathSync(projectRoot)` — resolves symlinks in the
   root up front.
2. `rootWithSep = canonicalRoot + path.sep` — prevents prefix-confusion
   attacks like `/project-evil` matching `/project` via `startsWith`.
3. `canonicalizeInside(resolved)` — realpaths the resolved target; on ENOENT,
   walks up to the nearest existing ancestor, realpaths THAT, and re-joins
   the non-existent tail. This correctly handles macOS `/var` vs `/private/var`.
4. Final check: `canonical === canonicalRoot || canonical.startsWith(rootWithSep)`.

### Findings

**PASS — `..` traversal:** The check is NOT `startsWith('..')` — it uses
`path.resolve(projectRoot, ref)` which normalizes `a/../../etc/passwd` before
the sandbox check. A ref like `./a/../../etc/passwd` is resolved, then
canonicalized, then compared against `canonicalRoot` — escape is detected.

**PASS — Absolute paths:** `path.isAbsolute(ref)` branch also runs through
`canonicalizeInside(..., false)`, so `/etc/passwd` gets canonicalized and
sandbox-rejected. Confirmed by the `config-loader.test.ts` cases for
absolute-escape.

**PASS — Symlink escape:** Because `realpathSync` resolves BOTH the root and
the target, a symlink `projectRoot/link → /etc` followed by
`./link/passwd` realpaths to `/etc/passwd` and is rejected. The sandbox is
defined in canonical space, not lexical space. This is the correct shape.

**PASS — `@flint/` preset sandbox:** `PRESETS_DIR` is resolved at module
load from `import.meta.url` → package root. It is itself canonicalized via
`fs.realpathSync(PRESETS_DIR)` inside the @flint branch. A ref like
`@flint/../../etc/passwd` becomes `PRESETS_DIR/../../etc/passwd.yaml`,
which after `path.join` normalizes and then canonicalizes OUTSIDE
`canonicalPresetsDir`, and is rejected. Sound.

**FINDING SEC-1 [LOW] — TOCTOU window in non-existent-tail walk:**
`canonicalizeInside` handles ENOENT by walking up to the nearest existing
ancestor, realpathing that, and appending the tail. This is correct at the
moment of the check, BUT the sandbox decision is made on the *ancestor's*
current symlink state. Between the check and the subsequent
`loadYamlFile(filePath)` (which calls `fs.readFileSync`), an attacker with
write access to any directory *inside* projectRoot could swap an intermediate
segment to a symlink pointing outside the sandbox. This is a classic
filesystem TOCTOU race.

- **Exploitability:** Very low in practice. Requires (a) attacker can write
  to projectRoot, (b) they can race between resolve and read, (c) they don't
  already have the ability to just write a malicious `flint.config.yaml`
  directly. Threat model is weak because anyone who can write inside
  projectRoot already owns the config.
- **Remediation:** Open the file with `fs.openSync(path, 'r')` after the
  canonical check, then `fs.fstatSync` + `fs.readFileSync(fd)` to ensure
  the fd is the canonicalized inode. Or use `fs.promises.readFile` with
  `{ path, flag: 'r' }` after an `fs.lstat` + `fs.realpath` double-check.
- **Priority:** Post-ship follow-up. Not a blocker — the prerequisite
  access already defeats the sandbox by other means.

**FINDING SEC-2 [LOW] — non-existent-tail silent failure fallback:**
Inside `canonicalizeInside`, if `fs.realpathSync(ancestor)` throws (e.g.
permission denied on the ancestor), the code falls back to
`path.resolve(resolved)` — a purely lexical path. In that branch, the
subsequent `startsWith(rootWithSep)` check is against `canonicalRoot` which
IS a realpath. On systems where `projectRoot` itself traverses a symlink
(common on macOS), this could create a false NEGATIVE (legitimate path
rejected) but not a false POSITIVE (escape missed) — because lexical
resolve cannot shorten past a realpath-expanded root. **Not exploitable**,
just noisy. Logged for completeness.

**PASS — Circular extends:** `resolveExtends` uses a `seen` set keyed on the
canonical `filePath` returned by `resolveExtendsRef`, so both lexical aliases
(`./a.yaml` vs `../dir/a.yaml`) map to the same canonical and dedupe correctly.

### YAML parser (strict mode + DoS)

`yaml@^2.7.1` (Eemeli Aro's `yaml` — not `js-yaml`). Parsed via
`parseYaml(raw)` with default options, which:
- Does NOT support `!!js/function` / code execution tags (those are a
  js-yaml thing; `yaml` only supports the YAML 1.2 core schema).
- Has built-in anchor/alias expansion limits — billion-laughs (`*a` refs
  inside `*a`) is mitigated by the library's default `maxAliasCount: 100`.
- Deeply nested objects parse lazily and bounded by Node's stack — >10k
  nesting levels would stack-overflow, but `strict` mode throws a
  `ConfigValidationError` before it reaches the validators (happy path).

**PASS** on YAML parser safety. No code-execution vector, no billion-laughs
unless someone explicitly passes `{ maxAliasCount: 0 }` (we don't).

### configValidator expansion + unknown-key smuggling

The new validators (`export_gate`, `environments`, `trust.profiles`,
`enforcement`) check known keys and emit warnings, but unknown keys are
silently preserved (intentional — forward-compat). This means an attacker
who can write YAML can add arbitrary keys, which will be passed through
`deepMergeConfigs` and eventually become properties on `ResolvedPolicy`.

**PASS with note:** Since the same attacker can already set ANY config
field (they control the YAML file), extra keys add no privilege. Downstream
consumers destructure known fields only — no prototype-chain confusion.
Confirmed no `__proto__` / `constructor` / `prototype` special-casing in
`deepMergeConfigs` — each section is explicitly spread with `{ ...base, ...override }`,
which correctly ignores `__proto__` in modern V8. Safe.

### flint_set_policy v1→v2 response shape drift

`toLegacyFlintPolicy(resolved)` adapter is still exported and preserved for
Sprint 4 server.ts migration. Current renderers (`src/`) consume the v2
`ResolvedPolicy` shape. Grepped for renderer-side consumers of v1-only
fields (`.mithril.delta_e_threshold` vs `.mithril.deltaEThreshold`): both
names are present on `ResolvedPolicy.mithril` (aliased — see healthcare.ts
lines 53-54), so renderers reading either still get a defined number.
No prototype-chain type confusion surface.

**PASS.**

## IPC + Process Boundary Audit

- `git diff 284a536..fadf2b5` on `electron/preload.ts`: **no changes**.
- `git diff 284a536..fadf2b5` on `electron/main.ts`: 1 line changed
  (projectDetector async ripple), no IPC handler changes.
- Grep for `fs|child_process|node:fs|node:child_process` imports across `src/`:
  0 hits (the only match was a test allowlist string in
  `src/components/ui/__tests__/language-pass.test.ts`).
- Sprint 2's 15 new hooks and 18 new components all use `window.flintAPI`
  exclusively. No direct `ipcRenderer` usage, no Node module imports.
- `visualAuditor.ts` Babel replacement is main-process only (Electron)
  and documents its BrowserWindow sandbox (`nodeIntegration: false,
  contextIsolation: true, sandbox: true`) in the file header. Regex→AST is
  a net security improvement — regex import/export stripping on untrusted
  component source was a minor code-injection surface.

**PASS — process boundary intact.**

## Secret Handling

`config-loader.ts` parses YAML files which may contain API tokens (Figma
PAT, OAuth secrets). Audit of the log statements:

**FINDING SEC-3 [LOW-MEDIUM] — YAML parse error log leaks excerpt:**
Line 165 logs `msg` from the YAML library's parse error. The `yaml` library's
error messages include a source snippet (up to ~80 chars) around the syntax
error site. If a user's `flint.config.yaml` stores a secret like
`figma_token: abcdef123...` AND the YAML is syntactically broken nearby,
the console.error could surface a fragment of the token. Also written to
`.flint/ledger/config-events.jsonl` via `emitConfigEvent`.

- **Exploitability:** Requires (a) YAML syntax error in the config, (b)
  secret proximate to the error, (c) attacker access to stderr OR
  `.flint/ledger/config-events.jsonl`. Low-medium severity because the
  ledger file is inside the project, readable by anyone who can read the
  project, but secrets shouldn't be in the config anyway (they belong in
  environment vars).
- **Remediation:** Sanitize `msg` before logging — strip any line matching
  `/(?:token|secret|key|password|pat)[\s:=]+\S+/i` to `[redacted]`. Also
  document in CLAUDE.md that `flint.config.yaml` must NOT contain secrets.
- **Priority:** Post-ship follow-up, add to backlog.

No other log/write paths in config-loader.ts expose file contents.
Successful loads do not log content — only warnings list validation error
`path` + `message` fields, which describe the schema issue, not values.

## CSP + Renderer Hardening

- Grep for `dangerouslySetInnerHTML|eval\(|new Function` across all 18 new
  Sprint 2 governance components: **0 hits**.
- `TokenDetailPanel` FocusTrap: wraps the dialog with the existing
  `FocusTrap` component. The trap can only bound Tab/Shift+Tab — as
  expected and documented. OS-level combos (PrintScreen, Cmd+Space,
  Alt+Tab) are outside any web app's reach; this is not a findable defect.
  PASS.
- `PasteAuditModal` error state: confirmed via source read that
  `error.detail` (which may contain `err.stack`) is rendered inside
  `{expanded && <pre>...}` — conditional render, not CSS hide. The stack
  is never in the default DOM. Inspectable only after user clicks "Show
  details". **PASS.**

## Dependency Surface

`git diff 284a536..fadf2b5 --stat` on `package.json` and
`flint-mcp/package.json`: **no changes**. Zero new npm packages added
across all 3 sprints. Zero transitive dependency risk.

## TOCTOU / Race Conditions

- `config-loader.resolveExtendsRef` — see SEC-1 above (low, post-ship).
- `projectDetector.defaultCountFiles` — symlink cycle guard uses
  `realpath(current)` + visited set + `entry.isSymbolicLink() → continue`.
  Symlink bombs are defeated because symlinks are skipped outright. A
  symlink *cycle* through directories is additionally guarded by
  `visited.has(canonical)`. Depth capped at 12. **PASS** — no resource
  exhaustion vector found. The belt+braces approach (skip symlinks AND
  canonicalize AND cap depth) is correct.
- `DetectorFS.exists` async migration: no race created — each check is
  self-contained. Nothing uses the result after a delay.

## Recommendation

**SHIP.** All three sprints pass the core security invariants:
- No IPC surface expanded, no preload methods added.
- Process boundary (`src/` ↔ Node) intact.
- No new npm dependencies (zero supply-chain risk this round).
- No renderer-side HTML injection sinks.
- Sprint 3 path sandbox is correctly implemented in canonical space.
- YAML parser is safe by default (v2 `yaml` library, no `!!js/function`).
- Healthcare escalation is registry-driven — no attacker-controlled input.
- PasteAudit stack-trace hiding is conditional render (not CSS), confirmed.

### Post-ship follow-ups (file as backlog items, not blockers)

1. **SEC-1** — Replace the non-existent-tail walk in `canonicalizeInside`
   with an open-fd + fstat approach to close the TOCTOU window. Priority: low.
2. **SEC-3** — Sanitize secrets out of YAML parse-error `msg` before logging
   to console and `config-events.jsonl`. Add a docs note that
   `flint.config.yaml` must not contain secrets. Priority: low-medium.
3. **SEC-2** — Cosmetic: harden the realpath-failure fallback branch in
   `canonicalizeInside` to fail closed (reject) rather than fall through to
   lexical resolve. Priority: nit.

No critical or high findings. Ship Sprints 1-3 as-is; open tickets for the
three low-severity follow-ups.
