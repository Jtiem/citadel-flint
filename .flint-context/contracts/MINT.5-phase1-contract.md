# MINT.5 Phase 1 Contract — Mint Surface Foundation

**Phase:** MINT.5 (Phase 1 of 4)
**Status:** APPROVED
**Owner:** flint-architect
**Date:** 2026-04-17
**Citadel Name:** Envoy (token sync) + Mint (token surface)
**Binds against:** `.flint-context/reviews/mint-{ux,code,security}-review-2026-04-17.md`

---

## Summary

Phase 1 hardens the Mint surface on three axes before Sprints 2-4 add sync actions, emit buttons, and polish:

1. **Security (write-path hygiene + emitter egress).** Port CHRON.1's `reasonSanitizer.ts` pattern to a new `shared/tokenValueSanitizer.ts`. Apply at 6 token write ingress points across Electron + Web + MCP. Add per-emitter escape to all 5 emitters (CSS, Tailwind, Swift, Kotlin, RN). Port `validateFilePath` to the 4 MCP tools that accept `projectRoot`.
2. **Drift re-enable.** The `useTokenUsage` drift path was disabled 2026-04-12 due to a render loop — root cause is the shared `file:read` IPC rejecting `.json` extensions, whose rejection triggered a setState → re-effect cycle. Introduce a dedicated `tokens:read-figma-drift` IPC that returns a resolved `TokenDrift[]` array; wire into 4 consumers.
3. **Cross-surface coherence.** Build `useTokenHealth` on `shared/healthScore.ts` so Mint speaks the A-F grade language Counsel already speaks. Extract a shared `SeverityChip` component. Add a governance push-channel `governance:on-token-approved` so MCP/chat-path approvals clear ApprovalStagingArea rows without a UI click.

Phase 1 ships no new user-visible Mint flows beyond what MINT.4 already implemented — it corrects the foundation so Phase 2 (sync actions) and Phase 3 (emit dropdown) land on a surface whose health language, drift detection, and write-path safety are all coherent.

---

## Open Questions for Justin

These surfaced during the read. They do not block Phase 1, but they affect Phase 2-4 scope. Answer before the Phase 1.5 lint or flag them during implementation:

1. **Sanitizer strictness for color tokens.** Round 2 security calls for a value-shape allowlist. The bar to clear: a color value of `#3b82f6; } :root { …` is dropped; a legitimate `rgb(59, 130, 246)` passes; a named CSS keyword like `transparent` passes. Do we **reject** malformed values outright (fail closed, `token_value` write refused), or **sanitize** them (strip breakout chars, log redaction, still write)? CHRON.1's precedent is sanitize-don't-reject. Phase 1 defaults to sanitize-first but surfaces a fail-closed opt-in via a config flag. Confirm default.

2. **Description length cap.** Security review suggests 4096 chars for `description` vs. 1000 for `token_value`. Confirm numbers — they feed `TOKEN_DESCRIPTION_MAX_LENGTH` / `TOKEN_VALUE_MAX_LENGTH`.

3. **Drift IPC data source.** Two options resolve identically:
   - **Option A (recommended, specified below).** Main process reads both `.flint/figma-tokens.json` and `design_tokens` SQLite, computes diff server-side, returns `TokenDrift[]`. Hook consumes a single resolved payload. Zero race, zero renderer parsing.
   - **Option B.** Expose a `readFigmaDriftFile()` method that returns the raw JSON string with extension relaxation. Hook parses and diffs client-side.

   I specified A because it (a) keeps all `.flint/*.json` parsing in one place, (b) ensures web-parity is automatic, (c) removes the fragile setState-in-effect path. Confirm.

4. **Push-channel scope.** `governance:on-token-approved` is designed for chat-path approvals via `flint_approve_tokens`. If a future UI also emits, should we emit after every `tokens:approve-token` IPC too, or only when the MCP tool is invoked? Specified: emit from BOTH paths so ApprovalStagingArea listener is the single source of truth. Confirm.

5. **`SeverityChip` naming.** Counsel uses `critical | amber | advisory`. Confirm those are the three buckets (not `error | warning | info`, not `high | medium | low`). Specified as `critical | amber | advisory`.

---

## Impact Map

Owner legend:
- `flint-electron-ipc` — IPC handlers, preload bridge, web adapter, server/index.ts parity
- `flint-ast-surgeon` — MCP tools, sync engine, emitters (pure transforms)
- `flint-state-architect` — Zustand stores, hooks, type surfaces
- `flint-design-engineer` — React components, visual chrome
- `flint-test-writer` — test scaffolds, fuzz harness

### 1.1 — Sanitization foundation (NEW files)

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `shared/tokenValueSanitizer.ts` | CREATE | flint-ast-surgeon | Mirrors `shared/reasonSanitizer.ts`. Exports `sanitizeTokenValue`, `sanitizeTokenDescription`, `SECRET_PATTERNS_EXT`, `TOKEN_VALUE_MAX_LENGTH`, `TOKEN_DESCRIPTION_MAX_LENGTH`, per-type shape validators. Zero deps. |
| `shared/tokenPath.ts` | CREATE | flint-ast-surgeon | Extracts `SAFE_TOKEN_NAME_RE` from `electron/main.ts:1115`. Exports `validateTokenPath(raw: unknown): string` throwing a `TokenPathValidationError`. Used by every writer. Zero deps. |
| `shared/__tests__/tokenValueSanitizer.test.ts` | CREATE | flint-test-writer | 60-value fuzz harness (bidi, NUL, CSS/Swift/Kotlin breakouts, high-entropy, oversized). Runs in `npm test`. |
| `shared/__tests__/tokenPath.test.ts` | CREATE | flint-test-writer | Validate `__proto__`, `constructor`, whitespace, Unicode, oversized path segments. |

### 1.1 — Sanitization application (MODIFY existing)

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `electron/main.ts` (lines 760-823) | MODIFY | flint-electron-ipc | `tokens:create` and `tokens:update` run `sanitizeTokenValue` + `validateTokenPath` + `sanitizeTokenDescription` before the SQL bind. Reject on hard failure (oversized, regex mismatch, prototype segment). |
| `server/index.ts` (lines 762-830) | MODIFY | flint-electron-ipc | Web-build parity — same sanitization, same rejection rules. |
| `electron/ingestion-server.ts` (lines 81-94 `upsertToken` prepared statement call site) | MODIFY | flint-electron-ipc | Apply sanitizer inside `batchUpsertTokens` before `upsertToken.run(...)`. Drop invalid entries; append to Heal summary. |
| `flint-mcp/src/tools/extractTokens.ts` (lines 270-305 `handleApproveTokens` merge loop) | MODIFY | flint-ast-surgeon | Sanitize every `incoming.value` and `incoming.path`. Rejected tokens count toward `rejectedCount`. |
| `flint-mcp/src/core/sync/tokenSyncEngine.ts` (lines 213-221 `executePull` case `modified_remote`) | MODIFY | flint-ast-surgeon | Sanitize `entry.remoteValue` before `localTokens.set(...)`. Rejected values become sync conflicts, not silent auto-merges. |
| `flint-mcp/src/core/sync/tokenFileIO.ts` (line 98 `writeFile` call) | MODIFY | flint-ast-surgeon | Sanitize every value in `obj` pre-serialize. |
| `flint-mcp/src/tools/emitTokens.ts` (lines 463-486 file-write block) | MODIFY | flint-ast-surgeon | `validateProjectRoot(args.projectRoot)` at handler entry (line ~250 before output-dir resolution). Extend `_report.json` with `{ sanitizerVersion, emittedAt, toolVersion }` header. |
| `flint-mcp/src/tools/mapTokens.ts` (lines 138-206) | MODIFY | flint-ast-surgeon | `validateProjectRoot(args.projectRoot)` at handler entry. Add extension allowlist check on `args.outputPath` (`.ts|.js|.css|.json|.scss`). |
| `flint-mcp/src/tools/extractTokens.ts` (line 254 `projectRoot` resolution) | MODIFY | flint-ast-surgeon | `validateProjectRoot` after `args.projectRoot ?? process.cwd()`. |
| `flint-mcp/src/tools/approveTokens.ts` (wherever `projectRoot` lands — if structurally separate from `extractTokens.ts`) | MODIFY | flint-ast-surgeon | Same `validateProjectRoot` gate. |
| `flint-mcp/src/tools/emitters/__shared__/emitterEscape.ts` or `flint-mcp/src/core/emitters/escape.ts` | CREATE | flint-ast-surgeon | Shared escape helpers: `escapeCssValue`, `escapeTailwindString`, `escapeSwiftStringLiteral`, `escapeKotlinStringLiteral`, `escapeReactNativeStringLiteral`. Reference: CSS escapes `}`, `*/`, `url(`, `expression(`, backslash, newline; Swift `"`, `\`, `\(`; Kotlin `"`, `\`, `$`, `${`; Tailwind beyond `\` and `'`. |
| `flint-mcp/src/core/emitters/cssEmitter.ts` | MODIFY | flint-ast-surgeon | `formatCSSValue` routes user value through `escapeCssValue`. Comment sections escape token paths for `/* */` breakouts. |
| `flint-mcp/src/core/emitters/tailwindEmitter.ts` (`escapeValue` at line 70) | MODIFY | flint-ast-surgeon | Replace with `escapeTailwindString` — full TypeScript string-literal escape (backslash, quotes, newline, CR, tab, bidi strip). |
| `flint-mcp/src/core/emitters/swiftEmitter.ts` (lines 247, 272 — string emission sites) | MODIFY | flint-ast-surgeon | Wrap every `${...}` string interpolation site in `escapeSwiftStringLiteral`. Applies to color names, typography string values, MARK comments. |
| `flint-mcp/src/core/emitters/kotlinEmitter.ts` (line 302 `const val ${t.name} = "${t.value}"`) | MODIFY | flint-ast-surgeon | Wrap value in `escapeKotlinStringLiteral`. `$` and `${` must be escaped to block Kotlin string templates. |
| `flint-mcp/src/core/emitters/reactNativeEmitter.ts` (all string emission sites) | MODIFY | flint-ast-surgeon | Wrap in `escapeTypescriptStringLiteral` (reuse Tailwind escape helper). |

### 1.2 — Drift re-enable (NEW IPC + wiring)

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `electron/main.ts` | MODIFY | flint-electron-ipc | Add `ipcMain.handle('tokens:read-figma-drift', ...)`. Handler reads `.flint/figma-tokens.json` via `FileTransactionManager`-neutral `readFile`, compares against `stmtReadAll.all()`, returns `TokenDrift[]`. Gracefully returns `[]` on missing file. |
| `server/index.ts` | MODIFY | flint-electron-ipc | Mirror handler. |
| `electron/preload.ts` (inside the `tokens` bridge around line 208) | MODIFY | flint-electron-ipc | Expose `readFigmaDrift(): Promise<TokenDrift[]>`. |
| `src/adapters/web-api.ts` (line ~305) | MODIFY | flint-electron-ipc | Mirror the web adapter method. |
| `src/types/flint-api.d.ts` (around line 228 inside `TokensAPI`) | MODIFY | flint-state-architect | Add `readFigmaDrift?: () => Promise<TokenDrift[]>` and export `TokenDrift` interface. |
| `shared/ipc-validators.ts` | MODIFY | flint-electron-ipc | Add Zod schema entry `tokens:read-figma-drift` with `payload: z.undefined()`, `response: z.array(TokenDriftSchema)`. |
| `src/hooks/useTokenUsage.ts` (line 84 disabled block + line 49, 53 unused vars) | MODIFY | flint-state-architect | Re-enable drift via the new IPC. Remove `localTokens` param (no longer needed — drift is computed main-side). Remove the unused `setDriftedTokens` no-op; replace with real setState fed from IPC. Keep the `mountedRef` guard. |
| `src/components/ui/TokenHealthBar.tsx` | MODIFY | flint-design-engineer | Remove `syncStatuses`-based drift pill block (lines 82-98). Drift is exactly `driftCount` now, from the hook, not from the `getSyncStatus` comparison. |
| `src/components/ui/TokenManager.tsx` (lines 340-346 `getSyncStatus` + 359-362 `syncStatuses`) | MODIFY | flint-design-engineer | Keep `getSyncStatus` (still drives TokenGrid per-row badges) but mark with a comment that drift-count authority belongs to `useTokenUsage`. |
| `src/App.tsx` (line 192 `tabDriftCount`) | NO CHANGE | -- | Already reads `driftedTokens.length` — becomes live automatically once hook re-enabled. |

### 1.3 — Canonical health score

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/hooks/useTokenHealth.ts` | CREATE | flint-state-architect | Consumes `useTokenUsage` + `tokenStore` + pending approvals. Buckets counts (dead→advisory, drifted→amber, contrastFails→critical, scaleGaps→advisory, pendingConflicts→amber) into `HealthScoreInput`, returns `{ score, grade, buckets }` via `computeHealthScore`. |
| `src/components/ui/TokenHealthBar.tsx` | MODIFY | flint-design-engineer | Render `<HealthGradePill grade={grade} score={score} />` as the **leading** element. Severity pills follow. Adopt `CompactScoreSummary` density pattern. |
| `src/components/ui/__tests__/useTokenHealth.test.ts` | CREATE | flint-test-writer | Assert bucket mapping correctness. |

### 1.4 — Severity grammar (NEW shared component)

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `src/components/ui/governance/SeverityChip.tsx` | CREATE | flint-design-engineer | Shared chip for Counsel + Mint. Props: `{ severity: 'critical' \| 'amber' \| 'advisory'; count?: number; label: string; icon?: ReactNode; 'data-testid'?: string }`. Uses existing Counsel color vocabulary (red / amber / zinc). |
| `src/components/ui/governance/__tests__/SeverityChip.test.tsx` | CREATE | flint-test-writer | Render per severity, a11y label shape, count pluralization. |
| `src/components/ui/TokenHealthBar.tsx` | MODIFY | flint-design-engineer | Replace ad-hoc pill elements with `<SeverityChip>` calls (dead=advisory, drift=amber, contrast-fail=critical, scale-gap=advisory, pending-conflict=amber). |
| `src/components/ui/TokenGrid.tsx` | MODIFY | flint-design-engineer | Replace per-row colored pills that duplicate severity grammar. |
| `src/components/ui/governance/ViolationCard.tsx` | MODIFY | flint-design-engineer | If it renders an ad-hoc severity chip, reuse `SeverityChip`. Phase 1 scope: survey only — do not refactor Counsel if the existing styling is already inline via props. |

### 1.5 — Dual-queue listener

| File | Change | Owner | Summary |
|------|--------|-------|---------|
| `electron/main.ts` | MODIFY | flint-electron-ipc | After successful write in `tokens:approve-token` (end of handler body, before `return { ok: true }`), broadcast `ipcChannel('governance:on-token-approved')` with `{ tokenName, source: 'glass' }`. Same broadcast after MCP `flint_approve_tokens` completes — plumbed via a single shared helper `broadcastTokenApproved(tokenName, source)`. |
| `flint-mcp/src/tools/extractTokens.ts` | MODIFY | flint-ast-surgeon | After successful merge + write, emit `mcp-events.jsonl` row `{ event: 'token-approved', tokenName, source: 'mcp' }` — the existing MCP push-channel pattern. The Electron main-process MCP listener mirror-broadcasts to `governance:on-token-approved`. |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | Bridge: `onTokenApproved(callback: (event: TokenApprovedEvent) => void): () => void` — returns unsubscribe. |
| `src/adapters/web-api.ts` | MODIFY | flint-electron-ipc | Web-parity mirror as a WS event. |
| `src/types/flint-api.d.ts` | MODIFY | flint-state-architect | Add `onTokenApproved` to the exposed surface. Export `TokenApprovedEvent`. |
| `src/components/ui/ApprovalStagingArea.tsx` | MODIFY | flint-design-engineer | Accept new prop `onExternalApproval?: (tokenName: string) => void`. Or — preferred — consume the push channel directly via `useEffect(() => window.flintAPI.tokens.onTokenApproved(...))`. Pick the lighter wiring after checking whether TokenManager already has the tokens list and can call `setPendingTokens(ps => ps.filter(...))`. Specified: **consume push channel in ApprovalStagingArea itself** so the component is self-sufficient. |
| `src/components/ui/__tests__/ApprovalStagingArea.test.tsx` | MODIFY | flint-test-writer | Test: chat-approve event arrives → row disappears without UI click. |

---

## Type Contracts

All types live in `.flint-context/contracts/MINT.5-phase1.contract.ts`. Phase 2 agents import from there. Summary:

### 1.1 — Sanitizer API

```ts
export const TOKEN_VALUE_MAX_LENGTH = 1000
export const TOKEN_DESCRIPTION_MAX_LENGTH = 4096

export interface SanitizeTokenValueResult {
    sanitized: string | null  // null when post-sanitize content is empty
    rejected: boolean          // true when value fails per-type shape allowlist
    rejectionReason: string | null
    truncated: boolean
    redacted: boolean
    strippedControlChars: boolean
}

export function sanitizeTokenValue(
    value: unknown,
    tokenType: TokenShapeCategory,
): SanitizeTokenValueResult

export function sanitizeTokenDescription(value: unknown): SanitizeReasonResult
// (reuses CHRON.1's SanitizeReasonResult shape; `redacted` catches sk-ant-, ghp_, AKIA, high-entropy)

export type TokenShapeCategory =
    | 'color' | 'dimension' | 'fontFamily' | 'fontWeight'
    | 'fontSize' | 'lineHeight' | 'letterSpacing'
    | 'shadow' | 'opacity' | 'string' | 'boolean'

// Per-emitter escape helpers (pure string transforms)
export function escapeCssValue(raw: string): string
export function escapeSwiftStringLiteral(raw: string): string
export function escapeKotlinStringLiteral(raw: string): string
export function escapeTypescriptStringLiteral(raw: string): string  // Tailwind + RN
```

### 1.1 — Path validator

```ts
export class TokenPathValidationError extends Error {}

/** Extracted from electron/main.ts:1115. Exported so every writer binds to one regex. */
export const SAFE_TOKEN_PATH_RE: RegExp

export function validateTokenPath(raw: unknown): string
// Throws TokenPathValidationError on failure; returns the validated string otherwise.

/**
 * MCP-side projectRoot validator. Mirrors shared/validateFilePath with
 * allowedExtensions: [] (directory path) and a relaxed self-host check.
 */
export function validateProjectRoot(raw: unknown, homeDir: string): string
```

### 1.2 — Drift IPC

```ts
export interface TokenDrift {
    /** Matches DesignToken.token_path. */
    tokenName: string
    /** Value currently stored in the project's design_tokens table / JSON. */
    localValue: string
    /** Value currently declared in Figma (from .flint/figma-tokens.json). */
    figmaValue: string
    /**
     * CIEDE2000 ΔE for color tokens, undefined for non-color types.
     * Present so Phase 2 can threshold drift as amber (ΔE > 2.0) without a second IPC round-trip.
     */
    deltaE?: number
}
```

### 1.3 — Token health hook

```ts
export interface TokenHealthData {
    /** 0-100 integer, canonical. */
    score: number
    /** A / B / C / D / F. */
    grade: HealthGrade
    /** Pre-bucket counts for UI breakdown. */
    buckets: {
        dead: number
        drifted: number
        scaleGaps: number
        contrastFails: number
        pendingConflicts: number
    }
    /** The HealthScoreInput input we fed computeHealthScore, exposed for debugging. */
    input: HealthScoreInput
}

export function useTokenHealth(): TokenHealthData
```

### 1.4 — Severity chip

```ts
export type ChipSeverity = 'critical' | 'amber' | 'advisory'

export interface SeverityChipProps {
    severity: ChipSeverity
    label: string
    count?: number
    icon?: ReactNode
    'data-testid'?: string
    /** a11y override, default computed from label + count. */
    'aria-label'?: string
}
```

### 1.5 — Dual-queue listener

```ts
export type TokenApprovedSource = 'glass' | 'mcp'

export interface TokenApprovedEvent {
    tokenName: string
    source: TokenApprovedSource
    timestamp: number
}

export type TokenApprovedListener = (event: TokenApprovedEvent) => void
export type UnsubscribeFn = () => void

// New method on TokensAPI (window.flintAPI.tokens)
export type OnTokenApprovedMethod = (callback: TokenApprovedListener) => UnsubscribeFn
```

---

## IPC Channel Contracts

| Channel | Direction | Payload | Response | Handler | New? |
|---------|-----------|---------|----------|---------|------|
| `tokens:read-figma-drift` | renderer→main | `undefined` | `TokenDrift[]` | `electron/main.ts` + `server/index.ts` | NEW |
| `governance:on-token-approved` | main→renderer (push) | n/a | event body = `TokenApprovedEvent` | `electron/main.ts` (broadcast) | NEW |
| `tokens:create` | renderer→main | `{ token_path, token_type, token_value, description?, mode?, collection_name? }` | `{ id: number }` | `electron/main.ts:760` | MODIFIED (adds sanitization) |
| `tokens:update` | renderer→main | `(tokenPath: string, updates: { token_type?, token_value?, description? })` | `{ changes: number }` | `electron/main.ts:794` | MODIFIED (adds sanitization) |
| `tokens:approve-token` | renderer→main | `tokenName: string` | `{ ok: boolean }` | `electron/main.ts:1117` | MODIFIED (broadcasts on success) |

**Zod schema deltas** to add to `shared/ipc-validators.ts`:

```ts
'tokens:read-figma-drift': {
    payload: z.undefined(),
    response: z.array(z.object({
        tokenName: z.string(),
        localValue: z.string(),
        figmaValue: z.string(),
        deltaE: z.number().optional(),
    })),
},
```

The existing `tokens:create`/`tokens:update` payload schemas already cap by shape — post-sanitization refinement belongs inside the handler, not the schema, so the sanitizer can produce audit telemetry.

---

## Store Contracts

Phase 1 introduces no new Zustand store slices. `useTokenHealth` is a hook, not a store, because it derives from inputs that already live in `tokenStore` + `useTokenUsage`. Future Phase 2 sync-action work may add a `syncStore`; deferred.

| Store | Change | Details |
|-------|--------|---------|
| `tokenStore` | NO CHANGE | Existing `deleteToken` optimistic rollback remains. No new actions in Phase 1. |
| `editorStore` | NO CHANGE | Unaffected. |

---

## Component Contracts

| Component | File | Props / Consumes | Emits IPC | Change |
|-----------|------|-------------------|-----------|--------|
| `SeverityChip` (NEW) | `src/components/ui/governance/SeverityChip.tsx` | `SeverityChipProps` | — | Shared leaf component |
| `TokenHealthBar` | `src/components/ui/TokenHealthBar.tsx` | Add `health: TokenHealthData` prop. Remove `syncStatuses`-derived drift pill. | — | MODIFY — now renders a leading `<HealthGradePill />` + `SeverityChip`s |
| `HealthGradePill` (NEW, inline in `TokenHealthBar.tsx`) | same file | `{ grade: HealthGrade; score: number }` | — | New in Phase 1 |
| `ApprovalStagingArea` | `src/components/ui/ApprovalStagingArea.tsx` | Subscribes to `window.flintAPI.tokens.onTokenApproved` | — | MODIFY — effect hook clears local row state on matching event |
| `TokenManager` | `src/components/ui/TokenManager.tsx` | Consumes `useTokenHealth` (passes `health` to `<TokenHealthBar>`) | — | MODIFY — drift pipeline now live, `isUsageScanning` either used or dropped (see N3) |
| `TokenGrid` | `src/components/ui/TokenGrid.tsx` | Replace ad-hoc severity pills with `SeverityChip` | — | MODIFY |

---

## Wire-Up Table (caller → callee)

| Caller | Callee | Params |
|--------|--------|--------|
| `electron/main.ts:tokens:create` handler | `sanitizeTokenValue(value, tokenType)` | validated + sanitized before `stmtCreate.run` |
| `electron/main.ts:tokens:create` handler | `validateTokenPath(token_path)` | throws `TokenPathValidationError` → caller surfaces IPC error |
| `electron/main.ts:tokens:update` handler | `sanitizeTokenValue`, `validateTokenPath`, `sanitizeTokenDescription` | same pattern; rejection → structured IPC error |
| `server/index.ts` handlers | Same three sanitizers | Identical body, imported from `shared/` |
| `electron/ingestion-server.ts:batchUpsertTokens` | Sanitizer trio | Rejected entries filtered with structured log entry |
| `flint-mcp/src/tools/extractTokens.ts:handleApproveTokens` | Sanitizer trio + `validateProjectRoot` | `validateProjectRoot` at handler entry; per-token sanitization in merge loop |
| `flint-mcp/src/core/sync/tokenSyncEngine.ts:executePull` | `sanitizeTokenValue(entry.remoteValue, tokenType)` | rejected → `createConflict` path instead of auto-merge |
| `flint-mcp/src/core/sync/tokenFileIO.ts` | Sanitizer on every `$value` before serialize | |
| `flint-mcp/src/tools/emitTokens.ts` | `validateProjectRoot`, extend `_report.json` header | |
| `flint-mcp/src/tools/mapTokens.ts` | `validateProjectRoot`, outputPath extension check | |
| `flint-mcp/src/core/emitters/cssEmitter.ts:formatCSSValue` | `escapeCssValue` | every user string value |
| `flint-mcp/src/core/emitters/tailwindEmitter.ts:escapeValue` | Replaced by `escapeTypescriptStringLiteral` | |
| `flint-mcp/src/core/emitters/swiftEmitter.ts:generateSwiftCode` | `escapeSwiftStringLiteral` | all interpolated identifier + value sites |
| `flint-mcp/src/core/emitters/kotlinEmitter.ts:generateKotlinCode` | `escapeKotlinStringLiteral` | same |
| `flint-mcp/src/core/emitters/reactNativeEmitter.ts` | `escapeTypescriptStringLiteral` | same |
| `electron/main.ts` new handler `tokens:read-figma-drift` | reads `.flint/figma-tokens.json` + `stmtReadAll.all()` | returns `TokenDrift[]` |
| `src/hooks/useTokenUsage.ts` | `window.flintAPI.tokens.readFigmaDrift()` | replaces disabled readFile block at line 84 |
| `src/hooks/useTokenHealth.ts` | `useTokenUsage`, `tokenStore`, `computeHealthScore` | emits `TokenHealthData` |
| `src/components/ui/TokenHealthBar.tsx` | `useTokenHealth` (via prop) + `SeverityChip` | |
| `src/components/ui/ApprovalStagingArea.tsx` | `window.flintAPI.tokens.onTokenApproved` | `useEffect` subscription |
| `electron/main.ts:broadcastTokenApproved` helper | `BrowserWindow.getAllWindows().forEach(w => w.webContents.send(ipcChannel('governance:on-token-approved'), event))` | called from both `tokens:approve-token` and mcp event listener |

---

## Test Boundaries

Every NEW file gets unit tests. Every modified handler gets a parity test (Electron handler + web server handler side-by-side). The fuzz harness lives in `shared/__tests__/tokenValueSanitizer.test.ts` and runs as part of `npm test`.

### 1.1 — Sanitizer

- `sanitizeTokenValue` rejects values exceeding 1000 chars.
- Strips `\u202E` (bidi override) from input `#ff0000\u202Ebeef`.
- Strips NUL byte from input `red\u0000` → `red`.
- Redacts `sk-ant-abc...` from a malformed description → `[REDACTED]`.
- Color shape allowlist: `#f00`, `#ff0000`, `rgb(255,0,0)`, `hsl(0 100% 50%)`, `transparent` all pass.
- Color shape allowlist: `red; } body {`, `url(javascript:...)`, `expression(alert(1))` all rejected.
- Dimension shape: `16px`, `1.5rem`, `0`, `50%` pass; `16px; }` rejected.
- Fuzz harness produces 60 values: 10 bidi, 10 NUL, 10 CSS-breakout, 10 Swift-breakout, 10 Kotlin-breakout, 10 high-entropy. All must sanitize without throwing and without producing output that contains any of the original breakout sequences.

### 1.1 — Path validator

- `validateTokenPath('colors.primary.500')` returns the input.
- `validateTokenPath('__proto__.polluted')` throws `TokenPathValidationError`.
- `validateTokenPath('constructor')` throws.
- `validateTokenPath('colors . primary')` throws (space in segment).
- `validateTokenPath('colors.')` throws (trailing dot).
- `validateTokenPath(42)` throws (non-string).
- `validateProjectRoot('/etc/passwd', homeDir)` throws (outside home).
- `validateProjectRoot('/Users/user/project', '/Users/user')` returns `/Users/user/project`.

### 1.1 — Emitters (egress escape)

- `cssEmitter` input `value = '#f00; } body { background:url(javascript:0) } /*'` → output contains no raw `}`, no `url(`, no `*/` breakout before the next declaration.
- `swiftEmitter` input `value = 'Inter")\nexit(1)//'` → emitted line does not close the string literal mid-value.
- `kotlinEmitter` input `value = 'Inter${x}'` → `$` emitted as `\$`, no template interpolation.
- `tailwindEmitter` extended escape: `value = '\n"test'` → emitted string literal contains `\n\"test` verbatim inside the TS literal.

### 1.1 — IPC sanitization wiring

- `electron/main.ts:tokens:create` rejects a payload whose `token_value` is 5000 chars with a structured error.
- `server/index.ts:tokens:create` produces the same rejection shape (parity test).
- `flint-mcp/src/core/sync/tokenSyncEngine.executePull` creates a conflict (not an auto-merge) when remote value fails sanitization.
- MCP `handleEmitTokens` with `projectRoot='/etc'` returns `isError: true` with a path-outside-home message.
- MCP `handleMapTokens` with `outputPath='/tmp/token.exe'` returns an extension-not-allowed error.

### 1.2 — Drift IPC

- `tokens:read-figma-drift` returns `[]` when `.flint/figma-tokens.json` is missing.
- Returns `[]` when local matches remote.
- Returns a row for each differing token; `deltaE` populated for `token_type==='color'`; `deltaE` undefined for dimension / typography.
- Invalid JSON in `figma-tokens.json` → returns `[]` (graceful), logs at warn level, does NOT throw.
- `useTokenUsage` mounts and calls the IPC exactly once per `tokenCount` change.
- Unmount during in-flight IPC call does not trigger setState (mountedRef guard).

### 1.3 — Token health hook

- Zero violations everywhere → `score: 100, grade: 'A', buckets: {dead:0,drifted:0,scaleGaps:0,contrastFails:0,pendingConflicts:0}`.
- 1 contrast fail → `criticalCount: 1` → `score: 90, grade: 'A'` (borderline).
- 2 contrast fails + 3 drifted → `criticalCount: 2, amberCount: 3` → `score: 71, grade: 'C'`.
- 10 dead tokens → `advisoryCount: 10` → `score: 90, grade: 'A'` (dead is advisory).
- Returns `buckets` object shape with stable keys.

### 1.4 — Severity chip

- Renders critical → `bg-red-500/10`, `text-red-400`.
- Renders amber → `bg-amber-400/10`, `text-amber-400`.
- Renders advisory → `bg-zinc-800`, `text-zinc-400`.
- Count pluralization: `count=0` hides count, `count=1` shows `1 X` (singular), `count=2` shows `2 Xs` (plural only when label ends with non-s).
- `aria-label` defaults to `${count} ${severity} ${label}`.

### 1.5 — Dual-queue listener

- Subscribing and unsubscribing via `onTokenApproved` removes the listener without leaking.
- `tokens:approve-token` → ApprovalStagingArea row disappears.
- `flint_approve_tokens` via MCP → the same row disappears (simulated by emitting the push event manually in the test).
- Subscribing in web mode (web-api.ts) also fires on WS event.

---

## Commandment Checklist

| # | Commandment | Applies | How Phase 1 satisfies it |
|---|-------------|---------|---------------------------|
| 1 | Code is Truth | ✓ | All sanitization writes route to `.flint/design-tokens.json` / SQLite via existing FTM queue. No ephemeral state. |
| 2 | No Hallucinated Styling | — | Phase 1 is plumbing; does not add visual drift. |
| 3 | Composite IDs for Arrays | — | n/a. |
| 4 | Local-First Only | ✓ | No network calls added. Drift IPC reads local `.flint/figma-tokens.json` only. |
| 5 | Accessibility is a Compiler Error | ✓ | `SeverityChip` requires `aria-label` semantic; `useTokenHealth` adds a sr-only live-region-ready payload (Phase 2 will actually announce). |
| 6 | Gatekeeper Rule | — | No changes to export gate logic in Phase 1. |
| 7 | ID Preservation | — | n/a. |
| 8 | Audit-First Execution | — | n/a. |
| 9 | CIEDE2000 ΔE | ✓ | `TokenDrift.deltaE` computed for color tokens using the existing CIEDE2000 utility. |
| 10 | Targeted Micro-Recovery | — | n/a. |
| 11 | Surgical Git Transplants | — | n/a. |
| 12 | Atomic Queuing | ✓ | Writes triggered by `tokens:approve-token` continue to route through `fileTransactionManager.write`. Sanitization is pre-FTM, not a bypass. |
| 13 | Deterministic Surgery | ✓ | Zero regex-on-source. Sanitizer regex operates on token values, not source code. |
| 14 | Bypass Prohibition | ✓ | MCP tools stop using `fs.writeFileSync` without `validateProjectRoot`. `validateProjectRoot` enforces the same home-scope invariant as `ast:save-file`. |
| 15 | Granular AST Tools Only | — | n/a. |
| 16 | In-Memory Validation | — | n/a (not AI-generated output). |

---

## Implementation Order

### Group A (parallel) — Foundation (no cross-deps)

All four of these agents work in parallel against zero-dep shared files and the contract `.ts` file. None of them touch the same file.

- **flint-ast-surgeon (1)** — Create `shared/tokenValueSanitizer.ts` + `shared/tokenPath.ts`.
- **flint-ast-surgeon (2)** — Create `flint-mcp/src/core/emitters/escape.ts` (shared escape helpers).
- **flint-test-writer** — Scaffold `shared/__tests__/tokenValueSanitizer.test.ts` and `shared/__tests__/tokenPath.test.ts` from the contract `testBoundaries`, using `it.todo` for assertions that depend on functions being implemented. Write the 60-value fuzz harness as a Vitest `describe.each` block.
- **flint-design-engineer (1)** — Create `src/components/ui/governance/SeverityChip.tsx` + test file.

### Group B (parallel, after Group A) — Consumers

- **flint-electron-ipc (1)** — Wire sanitization into `electron/main.ts:760-823`, `server/index.ts:762-830`, `electron/ingestion-server.ts:81-94`. Add `tokens:read-figma-drift` handler in both. Extend `electron/preload.ts` and `src/adapters/web-api.ts`. Add Zod schema entry.
- **flint-electron-ipc (2)** — Add `governance:on-token-approved` broadcast helper. Wire from `tokens:approve-token`. Wire the MCP-side mirror (listener on `mcp-events.jsonl` or direct call from orchestrator) to the same broadcast helper.
- **flint-ast-surgeon (3)** — Wire sanitization + `validateProjectRoot` into `extractTokens.ts`, `emitTokens.ts`, `mapTokens.ts`, `tokenSyncEngine.ts:executePull`, `tokenFileIO.ts`. Extend `_report.json` header.
- **flint-ast-surgeon (4)** — Apply per-emitter escape in all 5 emitters.
- **flint-state-architect** — Re-enable `useTokenUsage` drift path (removes the disabled block, calls the new IPC). Create `useTokenHealth`. Extend `src/types/flint-api.d.ts` with `readFigmaDrift`, `onTokenApproved`, `TokenDrift`, `TokenApprovedEvent`.
- **flint-design-engineer (2)** — Refactor `TokenHealthBar` to render `HealthGradePill` + `SeverityChip`s from `useTokenHealth`. Delete the redundant `syncStatuses` drift pill. Refactor `TokenGrid` to use `SeverityChip`.
- **flint-design-engineer (3)** — Wire `ApprovalStagingArea` to `onTokenApproved`.

### Group C (after Group B) — Tests and validation

- **flint-test-writer** — Fill in all `it.todo` from Group A. Add parity tests for every modified handler (Electron + web server side by side). Verify MCP test suite passes.
- **flint-integration-validator** — Verify all 5 work items land, TSC clean, every testBoundary has a matching test, CHRON.1 sanitization bar matched on every ingress point.

### Do NOT touch in Phase 1

- `TokenPanel.tsx` and the orphan `src/components/ui/token/*` subtree — deletion deferred; UX C2 / Code B1 punted until Phase 2 scope decision.
- `hasMultipleModes()` placeholder (TokenGrid.tsx:666) — M1 from code review; deferred.
- M2/M3 `useContrastAudit` unmount guards — defer to Phase 2 polish.
- Sync action buttons (A2) — Phase 2.
- Emit dropdown (A3) — Phase 3.
- Impact accordion embed in detail panel (A5) — Phase 4.

---

## Risk Register

| # | Risk | Severity | Commandment | Mitigation |
|---|------|----------|-------------|-------------|
| R1 | Over-aggressive color shape allowlist rejects a legitimate CSS Color Module 4 value (`color(display-p3 ...)` , `oklch(...)`). | medium | 2 | Allowlist supports the modern color functions explicitly (`rgb`, `rgba`, `hsl`, `hsla`, `color(`, `oklch(`, `lab(`, `hex`, `transparent`, `currentColor`, named colors). Fuzz harness includes 10 "should pass" color values + 10 "should fail". |
| R2 | Kotlin `$` escape breaks identifiers that legitimately contain `$` (rare but valid). | low | 14 | Only escape values, not identifier names. Identifiers are produced by `toKotlinIdentifier` which already strips non-alphanumerics. |
| R3 | Dual-queue listener creates a feedback loop if the MCP-path broadcast re-fires a glass-path listener that calls `flint_approve_tokens` again. | medium | 12 | `TokenApprovedEvent.source` field distinguishes origins. ApprovalStagingArea filters its own pending list — it never calls approve back. Listener is idempotent. |
| R4 | Drift IPC reads `.flint/figma-tokens.json` in main process on every hook mount. Large files (10MB+) stall main thread. | medium | 4 | Add a 2MB soft cap on the file read. Beyond that, return `[]` with a logged warning. Phase 2 can move to streaming if needed. |
| R5 | `useTokenHealth` re-derives on every render because token arrays are unstable references. | medium | — | Memoize buckets with `useMemo` keyed on stable primitives (counts, not arrays). Match the `CompactScoreSummary` pattern. |
| R6 | Phase 2 agents forget to import from `shared/tokenPath.ts` and re-declare `SAFE_TOKEN_NAME_RE` locally. | medium | — | Phase 1.5 linter check: grep for `SAFE_TOKEN_NAME_RE` declarations outside `shared/tokenPath.ts` → fail. |
| R7 | Sanitizer version in `_report.json` drifts from the actual implementation. | low | — | Export `SANITIZER_VERSION` as a constant from `shared/tokenValueSanitizer.ts`. `_report.json` reads the export. Bump on every material change. |
| R8 | `governance:on-token-approved` broadcast fires before the token is written, producing a race where ApprovalStagingArea clears the row before `tokens:read-all` reflects the write. | medium | 12 | Broadcast happens only after `fileTransactionManager.write` resolves. Handler code order enforced by test. |
| R9 | Round 2 MCP `validateProjectRoot` breaks the existing MCP dev workflow where `process.cwd()` is Flint's own repo (self-host). | low | 14 | `validateProjectRoot` uses the SAME `selfHostCheck` hook as `ast:save-file`. MCP defaults `projectRoot` to `process.cwd()` — we preserve that fallback, the check rejects only paths outside home. Running MCP from Flint's own repo is inside `$HOME` so it passes. |
| R10 | Web-build parity drift: a future contributor updates `electron/main.ts` without updating `server/index.ts`. | high | — | Parity test pattern: each modified IPC gets a shared test file that imports both handlers via test doubles and asserts identical rejection shapes. |

---

## Non-Goals

- **No `TokenPanel` deletion.** Phase 1 does not delete the orphan tree (UX C2). That is a separate Phase 2 cleanup PR.
- **No sync action buttons.** No Pull / Push / Resolve / Connect buttons in `TokenHealthBar` (UX A2). Phase 2.
- **No emit/map dropdown.** No Export button (UX A3). Phase 3.
- **No impact accordion in `TokenDetailPanel`.** (UX A5.) Phase 4.
- **No read-only identity banner rewrite.** (UX A6.) Phase 4.
- **No collapse affordance for `ApprovalStagingArea`.** (UX A7.) Phase 4.
- **No aria-live sync announcements.** (UX A9.) Phase 4 a11y polish.
- **No MRS approval prompt on `tokenSyncEngine.executePull`.** Security Round 2 M1. Scope-bounded to Phase 3.
- **No description secret scan on ingress.** Round 2 M7. Subset of Phase 1 — covered by `sanitizeTokenDescription` calling the shared `SECRET_PATTERNS`.
- **No Babel AST mutation.** Phase 1 is pure IPC + sanitizer + UI refactor — zero AST work.

---

## References

- Mint reviews: `.flint-context/reviews/mint-{ux,code,security}-review-2026-04-17.md`
- Sanitizer pattern: `shared/reasonSanitizer.ts`, `shared/ipc-validators.ts`, `shared/validateFilePath.ts`, `shared/healthScore.ts`
- CHRON.1 precedent: `.flint-context/contracts/CHRON.1-contract.md`, `.flint-context/contracts/CHRON.1.contract.ts`
- Existing token name validator: `electron/main.ts:1115` (`SAFE_TOKEN_NAME_RE`)
- Disabled drift block: `src/hooks/useTokenUsage.ts:84-92`
- Dead health-bar pill: `src/components/ui/TokenHealthBar.tsx:82-98`
- Emitter surface: `flint-mcp/src/core/emitters/{cssEmitter,tailwindEmitter,swiftEmitter,kotlinEmitter,reactNativeEmitter}.ts`
- MCP tool entry points: `flint-mcp/src/tools/{extractTokens,emitTokens,mapTokens}.ts`
- Sync write path: `flint-mcp/src/core/sync/{tokenSyncEngine,tokenFileIO}.ts`
