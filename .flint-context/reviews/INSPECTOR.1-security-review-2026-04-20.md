# INSPECTOR.1 — Security Review (2026-04-20)

**Reviewer:** flint-security-reviewer
**Phase:** INSPECTOR.1 — Context-Aware Properties Panel
**Scope:** Glass-side UI + store phase. No new IPC, no MCP tools, no main-process changes.
**Verdict:** **APPROVED — no blocking findings**

## Risk Summary

- CRITICAL: 0
- HIGH:     0
- MEDIUM:   0
- LOW:      2 (defense-in-depth observations)
- INFO:     1

## Threat Model Context

INSPECTOR.1 is a pure renderer-side feature: element-type → section mapping, an auto-tab-switch hook, a token-match extension for non-color categories, and Babel AST scanners for arbitrary typography/spacing classes. No new process boundary is crossed, no new data is persisted, no new IPC channel is introduced. The attack surface is limited to:

1. Rendering AST-derived values (attacker-controlled source file opened by user) into React input `value` props.
2. Parsing attacker-controlled class strings with two new regexes.
3. Traversing attacker-controlled ASTs with Babel.
4. A single new boolean store field (`userOverrodeTab`).

All four are bounded by React's default text escaping, Babel's production-hardened traversal, and Zustand's value semantics.

## Concern-by-Concern Audit

### 1. AST value → user input rendering (XSS)

**Status:** PASS.

`grep dangerouslySetInnerHTML | innerHTML=` across `src/components/inspector/**` returns zero matches. All AST-derived attribute values (`alt`, `src`, `type`, `placeholder`, `aria-label`, etc.) flow into JSX `value={...}` on native `<input>` / `<select>` / `<textarea>` elements or into text nodes — both are escaped by React by default. No `eval`, no `Function`, no `new Function` in scope.

### 2. Prototype pollution via element-type map

**Status:** PASS.

`src/core/elementTypePropertyMap.ts:104-110` uses `Set.has(tagName)` for every bucket lookup. There is no bracket-indexed plain object keyed by `tagName`, so `__proto__`, `constructor`, and `toString` cannot traverse into a bucket. Unknown tagNames (including malformed `__proto__`) fall through cleanly to `GENERIC_SECTIONS`. The `CATEGORY_TO_TOKEN_TYPE` map in `tokenMatcher.ts:223` is keyed by the typed `TokenMatchCategory` union (closed set, not attacker-controlled at runtime via `tagName`).

### 3. Token-match regex paths (ReDoS)

**Status:** PASS.

Two new regexes:

- `ARBITRARY_TYPOGRAPHY_RE` — `^(?:[\w-]+:)*(?<prefix>text|font(?:-\w+)?|leading|tracking)-\[(?<value>[^\]]+)\]$` — `astScanner.ts:91`
- `ARBITRARY_SPACING_RE` — `^(?:[\w-]+:)*(?<prefix>…)-\[(?<value>[^\]]+)\]$` — `astScanner.ts:104`

Both are anchored `^...$`, use a negated character class `[^\]]+` for the value (linear, no backtracking alternatives), and the variant-chain prefix `(?:[\w-]+:)*` cannot overlap with the literal `-[` that follows (the `:` terminator is disjoint). Token input is split on `\s+` per-class before matching, bounding individual match input to one class token. No catastrophic backtracking vector.

### 4. Store invariant: `userOverrodeTab`

**Status:** PASS with LOW observation.

`canvasStore.ts:751-759` resets `userOverrodeTab` to `false` only when `setActiveSelection(null)` is called. `markTabOverridden()` (line 1018) is idempotent and has no precondition on `activeSelection`. Auto-switch bypass logic in `useAutoTabSwitch.ts:41-45` only fires on `null → id` transitions, so a stale `userOverrodeTab === true` while `activeSelection === null` cannot cause a tab switch — the gate is the selection transition, not the flag itself. Race-free under single-threaded JS.

**LOW-1:** `markTabOverridden()` can be called while `activeSelection === null` (e.g. user clicks a right-sidebar tab with nothing selected). This has no security impact but sets a flag that will then suppress the next legitimate auto-switch. UX concern surfaced in code review; mentioning here for completeness.

### 5. Babel traversal — attacker-controlled source

**Status:** PASS.

`scanArbitraryValues` (`astScanner.ts:134-188`) uses only the standard `JSXElement` visitor with synchronous non-recursive inner loops (linear scans over `openingElement.attributes`). No custom `path.traverse()` calls, no self-referential visitors. Babel's traversal is iterative under the hood and has well-known production hardening against stack overflow on deeply nested trees. The ID-resolution inner loop terminates on first hit with `break`.

### 6. Commandment 13 (no regex on source code)

**Status:** PASS.

The arbitrary-value regexes are applied to **class-name tokens** extracted from Babel `StringLiteral` AST nodes (`astScanner.ts:173`), not to raw source text. TypographySection's size-unit discrimination regex (if any) operates on token values, not source. Commandment 13 is intact.

### 7. Commandment 14 (no fs / electron in src/)

**Status:** PASS.

`grep -rE "^import .* from ['\"](fs|path|child_process|electron|os|crypto)['\"]" src/` returns only `src/components/ui/__tests__/language-pass.test.ts` — a test file running in the Node test environment, which is the documented carve-out. No production `src/` code imports Node.js modules.

## Findings

### [LOW-1] `markTabOverridden()` accepts calls with no active selection

- **Location:** `src/store/canvasStore.ts:1018-1021`
- **Description:** The action sets `userOverrodeTab = true` unconditionally, even if `activeSelection === null`. If a caller (now or in the future) wires this to a tab click that can fire while nothing is selected, the flag will then suppress the *next* auto-switch that should fire.
- **Impact:** UX regression, not a security issue — cannot be leveraged to bypass a gate or leak data.
- **Remediation (optional):** Gate on `get().activeSelection !== null` inside `markTabOverridden`, or document the invariant in JSDoc that callers must only invoke while a selection is live. Non-blocking.

### [LOW-2] Defense-in-depth: consider freezing the element-type bucket arrays

- **Location:** `src/core/elementTypePropertyMap.ts:43, 55, 64, 73, 82, 91`
- **Description:** `TEXT_SECTIONS`, `CONTAINER_SECTIONS`, etc. are module-level mutable arrays returned by reference from `resolveBucket`. A future bug that mutates the returned array would poison the module.
- **Impact:** None today — all consumers read-only. Hardening suggestion only.
- **Remediation (optional):** `as const` or `Object.freeze()` at module load. Non-blocking.

### [INFO-1] No secrets handled by this phase

- Verified: no `safeStorage`, no API keys, no `.env` reads, no session tokens touched by the INSPECTOR.1 surface.

## Verified Controls

- React auto-escaping protects all AST-derived values rendered into inputs (no `dangerouslySetInnerHTML`).
- Element-type lookup uses `Set.has()` — no prototype traversal vector.
- New regexes are anchored and use negated character classes — no ReDoS.
- Babel traversal uses standard visitors — no custom recursion.
- No `fs` / `electron` / Node.js imports in `src/` production code (Commandment 14).
- No regex on source code — regexes operate on AST-extracted string literals only (Commandment 13).
- `userOverrodeTab` reset logic is race-free under single-threaded JS; auto-switch gated on selection transition, not flag alone.
- No new IPC channels → no new preload surface to audit.
- No new MCP tools → no new agent-reachable surface.

## Recommendations

1. Accept the two LOW findings as non-blocking hardening backlog.
2. Mark INSPECTOR.1 security APPROVED for merge.
