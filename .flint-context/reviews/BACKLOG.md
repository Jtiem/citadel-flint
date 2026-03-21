# Code Review Backlog
**Date:** 2026-03-16
**Source:** Three parallel code review agents (Security Surface, Trust Foundation, Mass Commit Audit)
**Full reports:** `SEC-surface-review.md`, `trust-foundation-review.md`, `mass-commit-audit.md`

---

## P0 — Fix Immediately (Blocking Correctness or Active Exploitability)

### P0-1: LivePreview iframe has no sandbox attribute [SEC.1]
**File:** `src/components/editor/LivePreview.tsx`
**Source:** Agent 1 (CRITICAL)
**Issue:** The `srcdoc` iframe has no `sandbox` attribute. XSS in preview code gives the attacker full access to `window.flintAPI` — the entire IPC surface including file write, terminal spawn, and git operations.
**Attack chain:** XSS in preview → `window.parent.flintAPI.saveFile()` → arbitrary file write to project
**Fix:** Add `sandbox="allow-scripts allow-forms"` to the iframe element. Do NOT include `allow-same-origin` — that negates the protection.
**Contract required:** Yes (crosses process boundary — CSP goes in main.ts, sandbox in LivePreview.tsx)
**Maps to:** SEC.1

---

### P0-2: Figma webhook secret is hardcoded and logged [SEC.2]
**File:** `electron/ingestion-server.ts`, `electron/main.ts`
**Source:** Agent 1 (CRITICAL × 2)
**Issue:** The Figma webhook validation secret is a hardcoded string literal in the binary. It is also logged to the console on every app startup (main.ts startup sequence). Any local process can read the log or decompile the binary to extract it, then inject arbitrary payloads into the ingestion pipeline.
**Fix:** Generate `crypto.randomBytes(32).toString('hex')` per session in main.ts. Pass to ingestion-server at startup. Never log it. Never return it over IPC.
**Contract required:** Yes (secret generation in main.ts, consumption in ingestion-server.ts, removal from IPC response)
**Maps to:** SEC.2

---

### P0-3: Hardcoded secret returned to renderer over IPC [SEC.2]
**File:** `electron/main.ts` (`figma:status` handler)
**Source:** Agent 1 (HIGH)
**Issue:** The `figma:status` IPC response includes the raw secret field. The renderer (sandboxed React) should never receive the secret — it only needs to know connection status.
**Fix:** Strip the `secret` field from the `figma:status` response before it crosses the contextBridge.
**Contract required:** No (single handler change, no new files)
**Maps to:** SEC.2

---

### P0-4: OpenAI and Gemini branches bypass Commandments 15 and 16 entirely [TRUST]
**File:** `electron/orchestrator.ts:862-902`
**Source:** Agent 2 (CRITICAL)
**Issue:** The OpenAI and Gemini provider branches send plain-text chat completions with no tool-use. This means they completely bypass the AST Tool Catalog (Commandment 15) and the in-memory TSC validation loop (Commandment 16). Any user who switches to a non-Anthropic provider gets raw code string generation — exactly what Flint is designed to prevent.
**Fix:** Either (a) enforce the same tool-use constraint on all providers via their respective function-calling APIs, or (b) gate the non-Anthropic branches behind a hard error until they implement catalog compliance.
**Contract required:** Yes (architectural decision needed — gate vs. implement)
**Maps to:** Commandments 15, 16

---

### P0-5: `ImportAuditToast` references non-existent canvasStore fields [MASS]
**File:** `src/components/editor/ImportAuditToast.tsx`
**Source:** Agent 3 (CRITICAL)
**Issue:** The component calls `useCanvasStore((s) => s.lastImportWarnings)` and `clearImportWarnings()` — neither property exists in `canvasStore.ts`. The component renders silently broken (warnings always `undefined`) and throws `TypeError: clearImportWarnings is not a function` when a user dismisses the toast.
**Fix:** Either add `lastImportWarnings` + `clearImportWarnings` to `canvasStore`, or refactor `ImportAuditToast` to use `importSummaryStore` (where ingestion state actually lives).
**Contract required:** No (store field addition or component refactor, single boundary)
**Maps to:** ING phase regression

---

### P0-6: Governance rule ID mismatch — color overrides silently broken [MASS]
**File:** `src/core/governanceRulesManifest.ts`
**Source:** Agent 3 (HIGH)
**Issue:** Manifest declares `MITHRIL-COLOR-001` and `MITHRIL-COLOR-002`. Linter emits `MITHRIL-COL` in violation messages. Rule-level overrides in the GovernancePanel for color drift rules never correlate with live violations — users toggle them and nothing changes.
**Fix:** Audit the full manifest for ID mismatches. Align manifest IDs to exact linter emission strings.
**Contract required:** No (manifest constant change)
**Maps to:** Mass commit audit

---

## P1 — Security Hardening (High Urgency, No Active Exploit Today)

### P1-1: No MCP tool allowlist [SEC.3]
**File:** `electron/main.ts` (`mcp:call-tool` handler)
**Source:** Agent 1 (HIGH)
**Issue:** The renderer can call any MCP tool via `mcp:call-tool` IPC with no validation of the tool name. A compromised renderer (e.g., via the unguarded preview iframe) can invoke any tool including destructive ones.
**Fix:** Create `electron/mcp-policy.ts` with `RENDERER_ALLOWED_MCP_TOOLS: string[]`. Add allowlist check in `mcp:call-tool` handler before forwarding.
**Contract required:** Yes (new file + handler change)
**Maps to:** SEC.3

---

### P1-2: API key stored in plaintext [SEC.4]
**File:** `electron/main.ts` (config loading)
**Source:** Agent 1 (HIGH)
**Issue:** The Anthropic API key is read from `~/.flint/config.json` as plaintext. Any process with file-read access to the home directory can exfiltrate it.
**Fix:** Use `safeStorage.encryptString` on first write, `safeStorage.decryptString` on read. Migrate existing plaintext key on first launch.
**Contract required:** No (isolated to config loading/saving in main.ts)
**Maps to:** SEC.4

---

### P1-3: Terminal spawn not restricted to project root [SEC.5]
**File:** `electron/main.ts` (`terminal:spawn` handler)
**Source:** Agent 1 (HIGH)
**Issue:** The `cwd` parameter passed to `terminal:spawn` is used without validation. The renderer can spawn a shell in `/`, `~`, or any directory — no restriction to project root.
**Fix:** Validate `cwd` is within `app.getPath('home')` or the active project root. Reject with error if outside bounds.
**Contract required:** No (single handler validation)
**Maps to:** SEC.5

---

### P1-4: `applyMutationBatch` switch statement has no exhaustiveness check [TRUST]
**File:** `src/core/ASTService.ts:348`
**Source:** Agent 2 (HIGH)
**Issue:** The switch over mutation type has no `default` clause with a `never` assertion. Adding a new mutation variant to the catalog without implementing it in `ASTService` will silently pass through — no compile-time or runtime error.
**Fix:** Add `default: { const _exhaustive: never = mutation; throw new Error(\`Unhandled mutation type: \${(mutation as any).type}\`); }`
**Contract required:** No (single-file change)
**Maps to:** Commandment 13 (AST correctness)

---

### P1-5: `editorStore.applyBatch` does not re-stamp flint IDs after structural mutations [TRUST]
**File:** `src/store/editorStore.ts:306`
**Source:** Agent 2 (HIGH)
**Issue:** After structural mutations (move, inject, wrapNode), `injectFlintIds` is not called. This violates Commandment 7 (ID Preservation) — newly created or moved nodes may lack `data-flint-id`, making them unselectable in the canvas and unaddressable by future mutations.
**Fix:** Call `injectFlintIds(ast)` at the end of `applyBatch` before calling `syncCode`.
**Contract required:** No (single-file, single call)
**Maps to:** Commandment 7

---

## P2 — Technical Debt (Important but Not Actively Breaking)

### P2-1: A11Y-007/008/009 manifest ordering is wrong [MASS]
**File:** `src/core/governanceRulesManifest.ts`
**Source:** Agent 3
**Issue:** Linter emits `A11Y-007` for tabIndex, `A11Y-008` for table headers, `A11Y-009` for html-lang. Manifest has these three in the reverse order. GovernancePanel displays the wrong rule name and description for every violation in these categories.
**Fix:** Reorder the three entries in the manifest to match linter emission order. Audit remaining A11Y entries for similar mismatches.
**Contract required:** No

---

### P2-2: 31 of 49 governance rules are orphaned — never fire [MASS]
**File:** `src/core/governanceRulesManifest.ts`
**Source:** Agent 3
**Issue:** All `BRAND-*` and `QUAL-*` category rules (31 rules) appear in the GovernancePanel as manageable rules but have no corresponding linter enforcement. Users can enable/disable them with zero effect. For a governance product this is a credibility problem.
**Fix options:** (a) Implement linter visitors for the declared rules, or (b) mark orphaned rules as `status: 'planned'` and hide them from the active GovernancePanel until implemented, or (c) remove them until they're real.
**Contract required:** Yes for (a), No for (b) or (c)

---

### P2-3: `electron/tokenMapper.ts` is 524 lines of dead code [MASS]
**File:** `electron/tokenMapper.ts`
**Source:** Agent 3
**Issue:** None of its 14 exports are imported anywhere. `electron/main.ts:1271` even duplicates one of its functions (`roundOpacity`) locally — suggesting the module was written but never wired to its consumers. The ingestion pipeline presumably uses ad-hoc normalization instead.
**Fix:** Either wire `tokenMapper` to replace the ad-hoc normalization in the ingestion pipeline (correct fix), or delete the file if it duplicates existing behavior (fast fix). Do not leave dead code in a security-critical electron process.
**Contract required:** No for deletion; Yes for wiring

---

### P2-4: No CSP via `session.webRequest` [SEC.1]
**File:** `electron/main.ts`
**Source:** Agent 1 (HIGH)
**Issue:** The renderer has no Content Security Policy injected via `session.defaultSession.webRequest.onHeadersReceived`. The `index.html` has a CSP meta tag but it allows `unsafe-eval` and `unsafe-inline`, and uses a wildcard `connect-src https:`.
**Fix:** Add `session.defaultSession.webRequest.onHeadersReceived` handler with a strict CSP. Tighten `connect-src` to specific domains. Remove `unsafe-eval` if possible (may require Vite config change).
**Contract required:** Yes (main.ts + possibly vite.config.ts)
**Maps to:** SEC.1

---

### P2-5: Add missing AST mutation test coverage [TRUST]
**File:** `src/core/ASTService.test.ts`
**Source:** Agent 2
**Issue:** `injectComponent`, `applyTokenFix`, and `updateTextContent` round-trips are untested. No adversarial input tests: nonexistent node IDs, self-move (move node to itself), self-closing element as injection target.
**Fix:** Add targeted test cases for each missing operation and each adversarial scenario.
**Contract required:** No

---

## P3 — Polish / Low Priority

### P3-1: Unconditional DevTools in production build [SEC surface]
**File:** `electron/main.ts`
**Source:** Agent 1 (MEDIUM)
DevTools opens unconditionally regardless of environment. Should be `if (!app.isPackaged)` guard.

### P3-2: BrowserWindow sandbox disabled [SEC surface]
**File:** `electron/main.ts`
**Source:** Agent 1 (MEDIUM)
`sandbox: false` in `webPreferences`. Should be `true` unless a specific Node API is needed, with each exception documented.

### P3-3: Annotations write directly via IPC bypassing FTM [SEC surface]
**File:** `electron/main.ts`
**Source:** Agent 1 (MEDIUM)
Annotation writes use direct file I/O rather than routing through `FileTransactionManager`. Violates Commandment 12 (Atomic Queuing).

### P3-4: `postMessage` origin not validated [SEC surface]
**File:** `src/components/editor/LivePreview.tsx`
**Source:** Agent 1 (LOW)
`window.addEventListener('message', ...)` uses wildcard origin check. Should validate `event.origin === 'null'` (srcdoc) before processing.

### P3-5: Ingestion endpoint not rate-limited [SEC.6]
**File:** `electron/ingestion-server.ts`
**Source:** Agent 1 (not yet implemented)
No rate limiting on `/ingest-ast` or `/intent`. SEC.6 is P3 per the security plan — acknowledged.

---

## Summary Table

| ID | Priority | Area | One-line description | Contract? |
|----|----------|------|---------------------|-----------|
| P0-1 | P0 | SEC.1 | LivePreview iframe has no sandbox | Yes |
| P0-2 | P0 | SEC.2 | Webhook secret hardcoded + logged | Yes |
| P0-3 | P0 | SEC.2 | Secret returned to renderer via IPC | No |
| P0-4 | P0 | TRUST | OpenAI/Gemini bypass Cmd 15+16 | Yes |
| P0-5 | P0 | MASS | ImportAuditToast crashes on dismiss | No |
| P0-6 | P0 | MASS | Governance rule ID mismatch (color) | No |
| P1-1 | P1 | SEC.3 | No MCP tool allowlist | Yes |
| P1-2 | P1 | SEC.4 | Plaintext API key in config.json | No |
| P1-3 | P1 | SEC.5 | Terminal spawn unrestricted cwd | No |
| P1-4 | P1 | TRUST | applyMutationBatch missing default:never | No |
| P1-5 | P1 | TRUST | applyBatch skips injectFlintIds | No |
| P2-1 | P2 | MASS | A11Y-007/008/009 manifest wrong order | No |
| P2-2 | P2 | MASS | 31 orphaned governance rules | Yes (if implementing) |
| P2-3 | P2 | MASS | tokenMapper.ts is 524 lines dead code | No (delete) |
| P2-4 | P2 | SEC.1 | No CSP via session.webRequest | Yes |
| P2-5 | P2 | TRUST | Missing AST mutation test coverage | No |
| P3-1 | P3 | SEC | DevTools unconditional | No |
| P3-2 | P3 | SEC | BrowserWindow sandbox: false | No |
| P3-3 | P3 | CMD.12 | Annotations bypass FTM | No |
| P3-4 | P3 | SEC | postMessage wildcard origin | No |
| P3-5 | P3 | SEC.6 | No ingestion rate limiting | Yes |

---

## Recommended Sprint Order

**Sprint 1 (this week):**
- P0-3: Strip secret from figma:status IPC (30 min, no contract)
- P0-5: Fix ImportAuditToast canvasStore reference (1 hr, no contract)
- P0-6: Fix governance rule ID mismatch (1 hr, no contract)
- P1-2: safeStorage for API key (2 hrs, no contract)
- P1-3: Terminal cwd restriction (1 hr, no contract)
- P1-4: Add default:never to applyMutationBatch (30 min, no contract)
- P1-5: injectFlintIds after applyBatch (30 min, no contract)
- P2-1: Fix A11Y-007/008/009 manifest order (30 min, no contract)
- P2-3: Delete tokenMapper.ts (30 min, no contract)
- P3-1/3-2: DevTools guard + sandbox flag (30 min, no contract)

**Sprint 2 (next week — contract-first):**
- P0-1 + P2-4: SEC.1 full (iframe sandbox + CSP) — single contract covers both
- P0-2: SEC.2 webhook secret (per-session generation, no logging)
- P1-1: SEC.3 MCP tool allowlist

**Sprint 3:**
- P0-4: TRUST — provider parity (OpenAI/Gemini Commandment 15+16 enforcement)
- P2-2: Orphaned governance rules decision (implement, hide, or delete)
- P2-5: AST mutation test coverage gaps
