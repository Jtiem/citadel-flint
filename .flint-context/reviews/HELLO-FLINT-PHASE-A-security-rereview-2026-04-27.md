# Security Re-Review — HELLO-FLINT-PHASE-A (BLK-1 / BLK-2 fix-pass verification)

**Phase:** HELLO-FLINT-A
**Reviewer:** flint-security-reviewer
**Date:** 2026-04-27
**Round:** 2 (re-review of fix-pass to 2026-04-26 BLOCK verdict)
**Scope (per request):** `server/services/mcpConfigWriter.ts`, `server/__tests__/helloFlintIpc.test.ts`. Out-of-scope: WARN-1..4 from round 1.

---

## 1. BLK-1 closure — `readExistingConfig()` always throws on parse failure

**Verdict:** PASS

**Evidence:**
- `server/services/mcpConfigWriter.ts:180-211` — `readExistingConfig()` no longer contains `catch {}`. The function has three throw sites: file-read failure (`server/services/mcpConfigWriter.ts:187-190`), `JSON.parse` failure (`server/services/mcpConfigWriter.ts:193-198`), and a new top-level-must-be-object guard (`server/services/mcpConfigWriter.ts:200-209`). All three throw `MalformedConfigError`.
- `writeMcpConfig()` (`server/services/mcpConfigWriter.ts:226-286`) calls `readExistingConfig()` at line 244 unguarded — there is no surrounding try/catch in the writer that would swallow the throw. The only adjacent catch is the `mkdirSync` block at `server/services/mcpConfigWriter.ts:235-240`, which runs BEFORE `readExistingConfig()` and only catches mkdir errors. The throw therefore propagates to the bulk writer.
- The bulk writer's catch at `server/services/mcpConfigWriter.ts:331-358` does NOT silently overwrite — it converts the typed error into a `failed[]` entry with `code: 'malformed-config'` and `return`s. No write call is reachable on this branch. The Promise.all isolates each editor in its own async function, so one editor's parse failure doesn't abort the batch.
- `checkAlreadyConnected()` at `server/services/mcpConfigWriter.ts:392-394` does keep a silent catch, but that function is read-only (no disk writes), so the silent skip is correct and cannot cause data loss.

No code path leads from a parse failure to a `fileTransactionManager.write()` call. BLK-1 is genuinely closed.

---

## 2. BLK-2 closure — runtime guard on `mcpServers` shape

**Verdict:** PASS

**Evidence:**
- `writeMcpConfig` (`server/services/mcpConfigWriter.ts:249-259`) implements the runtime guard:
  ```ts
  const rawServers = config.mcpServers
  if (
    rawServers !== null &&
    rawServers !== undefined &&
    (typeof rawServers !== 'object' || Array.isArray(rawServers))
  ) {
    throw new UnexpectedSchemaError(...)
  }
  ```
  The condition correctly accepts `null` and `undefined` (treated as empty), and rejects arrays, strings, numbers, booleans. The spread at `server/services/mcpConfigWriter.ts:262-264` is now type-safe because `rawServers` is narrowed to `null | undefined | object & !Array`. Spreading `null` yields `{}` so the null path produces the empty server map as intended.
- `checkAlreadyConnected` (`server/services/mcpConfigWriter.ts:381-391`) applies an equivalent guard before doing `'flint' in servers` — arrays, strings, numbers, booleans don't pass the test, and the editor is not classified as "connected." This eliminates the round-1 risk of misreading an array's named-property assignment as a flint entry.
- Test coverage at `server/__tests__/helloFlintIpc.test.ts:573-635` exercises array, string, null, and absent-field cases. Numbers and booleans are not explicitly tested but flow through the same `typeof !== 'object'` branch as strings, so they are covered by the same guard.

The guard is consistent across both functions that touch `mcpServers`. BLK-2 is closed.

---

## 3. Atomic-write invariant (Commandment 14)

**Verdict:** PASS

**Evidence:**
- `mcpConfigWriter.ts` has exactly one disk-write call site (`server/services/mcpConfigWriter.ts:283`): `await fileTransactionManager.write(configPath, serialized)`. No `fs.writeFile`, `fs.writeFileSync`, `fs.appendFile`, or any other write call exists in the file.
- The fix-pass added two throw paths and one guard but introduced zero new write paths. Every error path either throws (caught in bulk → failed array) or proceeds to the single FTM write call. There is no error-recovery write that could bypass the queue.
- The source-level invariant test at `server/__tests__/helloFlintIpc.test.ts:652-669` greps the source for `\bwriteFileSync\b` and `\bwriteFile\s*\(` patterns and asserts neither matches. This test still passes (run confirmed below).
- The existing `mkdirSync` call at `server/services/mcpConfigWriter.ts:237` is a directory-creation call, not a content write, and was already present in round 1.

---

## 4. Information leakage in error messages

**Verdict:** WARNING (informational; out of strict re-review scope but flagged)

**Evidence:**
- `MalformedConfigError.message` (`server/services/mcpConfigWriter.ts:78-81`) interpolates `filePath` directly: `Could not parse your existing config at "${filePath}"`. The path is absolute and includes the user's homedir (e.g. `/Users/<username>/Library/Application Support/Cursor/User/settings.json`).
- `UnexpectedSchemaError.message` (`server/services/mcpConfigWriter.ts:96-99`) does the same: `Your editor config at "${filePath}" has an unexpected "mcpServers" field`.
- The bulk writer surfaces `err.message` to the renderer in `failed[].reason` (`server/services/mcpConfigWriter.ts:337, 346`). The renderer renders this string verbatim in the UI (`src/components/ui/HelloFlintWelcome.tsx:93, 514, 679`).

Net effect: a user whose editor config is malformed sees their own absolute path rendered in the welcome UI. This is the same exposure profile as SUG-1 from round 1 (manual panel renders absolute path) — not a new vulnerability, but the new error classes widen the surface that can leak it. Phase A has no telemetry (`nonGoals` confirmed), so the path doesn't leave the box. Phase C telemetry work is the right place to revisit. **Net new finding: 0 (this is the same SUG-1 pattern, not a regression).**

The `code` field is machine-readable and never includes a path. `detail` carries the raw `JSON.parse` error message, which JavaScript's parser sometimes embeds with line/column info but not with file paths — safe.

---

## 5. Failed-write recovery — partial batch behavior

**Verdict:** PASS

**Evidence:**
- `writeBulk` uses `Promise.all(uniqueEditors.map(async (editor) => { ... }))` (`server/services/mcpConfigWriter.ts:313-360`). Each editor's write is an isolated async function with its own try/catch (`server/services/mcpConfigWriter.ts:323-358`). A throw inside one async function pushes to `failed[]` and returns; it does not reject the outer Promise.all and does not abort siblings.
- The failed editor's original config file is byte-unchanged (verified by tests `server/__tests__/helloFlintIpc.test.ts:521-528, 538-545, 562, 577-583, 589-595`). The successful editors' writes complete normally.
- No shared mutable state across the per-editor functions other than the `written[]` and `failed[]` arrays, which are append-only via `.push()`. JavaScript's single-threaded model + array `.push` are safe under concurrent async operations.

A user with two editors detected, one malformed, gets exactly one editor wired up and one in the failed list. No half-configured state.

---

## 6. Manual-snippet fallback routing — failed array fidelity

**Verdict:** PASS

**Evidence:**
- The `failed[]` schema (`server/services/mcpConfigWriter.ts:43-62`) defines four fields per entry: `editor`, `reason`, `code?`, `detail?`. The two new typed errors set `code` to a literal `'malformed-config'` or `'unexpected-schema'` string union, which is machine-readable.
- The bulk handler's catch at `server/services/mcpConfigWriter.ts:334-351` correctly populates `code` from each typed error's `code` property. Generic errors (`server/services/mcpConfigWriter.ts:352-357`) deliberately omit `code`, which means UI logic of the form `if (failed[i].code === 'malformed-config')` correctly distinguishes "data-safety refusal" from "generic write failure."
- The UI surfaces this in `src/components/ui/HelloFlintWelcome.tsx:512-516` and `:679` (rendering the failed entries with their reason text). The `code` field is available to the UI for routing logic — though I did not audit the UI's use of it (out of scope).

The contract requirement "failed-array entries contain enough info for the UI to make the route decision" is met. Whether the UI actually routes correctly is a separate UX/integration check.

---

## 7. Test fidelity — assertions verify file is unchanged, not just that throw occurred

**Verdict:** PASS

**Evidence:**
The 12 new tests in `server/__tests__/helloFlintIpc.test.ts:516-635` split into two clusters:

BLK-1 tests (`server/__tests__/helloFlintIpc.test.ts:516-571`):
- `:517-529` — invalid JSON: captures `originalBytes = readFileSync(...)`, runs writer expecting throw, then asserts `readFileSync(configPath) === originalBytes`. Passes the "file unchanged after failure" bar.
- `:531-546` — JSONC + invalid JSON combo: same pattern, asserts byte-identical.
- `:548-563` — bulk path: also asserts `readFileSync === '{ broken json'` after the bulk call.
- `:565-570` — file-absent case: asserts the function still works (preservedEntries: 0).

BLK-2 tests (`server/__tests__/helloFlintIpc.test.ts:573-635`):
- `:574-584` — array `mcpServers`: captures original bytes, asserts byte-identical after throw.
- `:586-596` — string `mcpServers`: same pattern.
- `:598-610` — bulk path with array: asserts `result.failed[0].code === 'unexpected-schema'`.
- `:612-623` — null `mcpServers`: asserts the writer succeeds and other top-level settings are preserved.
- `:625-634` — absent field: asserts the writer succeeds and other top-level settings are preserved.

Every test that asserts a throw also asserts the file content is unchanged. No "throw and forget" pattern. The fixtures cover the four malformed-shape variants the round-1 review called out (`mcpServers: []`, `mcpServers: "string"`, `mcpServers: null`, missing field) plus the parse-failure case. Numbers and booleans are not tested directly but are covered by the same guard branch as strings.

Test run (just executed): `server/__tests__/helloFlintIpc.test.ts → 59 tests, 59 passed, 0 failed` (113ms).

---

## 8. Schema-mirror parity — `npm run validators:check` wiring

**Verdict:** FAIL

**Evidence:**
- The script exists: `package.json:39` → `"validators:check": "node scripts/check-ipc-validators-parity.js"`.
- The script file exists: `scripts/check-ipc-validators-parity.js` (verified via `find`).
- The pre-commit hook at `.git/hooks/pre-commit` runs three checks: root TSC, flint-mcp TSC, and (conditionally) flint-vscode TSC. It does NOT invoke `validators:check`. Verified by reading the entire 50-line file.
- CI workflows `.github/workflows/pr-validate.yml` and `.github/workflows/build-release.yml` contain zero references to `validators:check` or `check-ipc-validators-parity`. Verified by `grep -rn`.
- `.husky/` directory does not exist. The only pre-commit hook is `.git/hooks/pre-commit`.

The drift trap from round 1 is still open. A future commit that updates `shared/ipc-validators.ts` without updating `shared/ipc-validators.js` will pass pre-commit and pass CI, even though the runtime behavior of the web build (which loads the `.js` mirror) will diverge from the typed schema. This is a pre-existing condition (the `.js` mirror drift was warned about in round 1's WARN-1) but the agent's claim that the new script "closes" it is false — the script is dead code until it's wired in.

This is not BLK-1 or BLK-2 (and the round-1 review didn't list it as a blocker), but the agent's report misrepresented its closure. Flagging as a NEW WARNING because the agent's claim of resolution is documented and now incorrect.

---

## Summary

| Point | Verdict |
|-------|---------|
| 1. BLK-1 — `readExistingConfig()` always throws on parse failure | PASS |
| 2. BLK-2 — runtime guard consistent across `writeMcpConfig` and `checkAlreadyConnected` | PASS |
| 3. Atomic-write invariant (FileTransactionManager-only) | PASS |
| 4. Error-message info leakage | WARNING (informational; same as SUG-1, not a regression) |
| 5. Failed-write recovery preserves other editors' writes | PASS |
| 6. Failed-array carries machine-readable `code` for manual-snippet routing | PASS |
| 7. Test fidelity — file-unchanged assertions, not just throw assertions | PASS |
| 8. `validators:check` wired into pre-commit or CI | FAIL |

**Test run evidence:** `npx vitest run server/__tests__/helloFlintIpc.test.ts → 59/59 passing` (live run during this review).

---

## Verdicts

- **BLK-1 verdict:** CLOSED
- **BLK-2 verdict:** CLOSED
- **Net new findings:** 1 — WARNING: `npm run validators:check` is implemented but unwired (not in pre-commit, not in CI). The agent's claim that this closes the schema-mirror drift trap is incorrect; the trap is still open. One-line fix: add the script to `.git/hooks/pre-commit` or the `pr-validate.yml` workflow.
- **Ship recommendation:** SAFE TO COMMIT for the BLK-1/BLK-2 fix itself. Wire `validators:check` into pre-commit (one-line shell change in `.git/hooks/pre-commit`) before declaring round 1's drift trap "closed" — otherwise the round-3 review will catch it and the round-1 promise will read as broken.
