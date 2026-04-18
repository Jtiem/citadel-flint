# Mint Code Review — 2026-04-17

**Reviewer:** /review gate (second of three surface reviews)
**Scope:** TokenManager, TokenPanel, TokenGrid, TokenHealthBar, TokenDetailPanel, `src/components/ui/token/*`, `useTokenUsage`, `useContrastAudit`, `tokenStore`, related tests, `flint-api.d.ts`
**Prior context:** `.flint-context/reviews/mint1-review-2026-04-11.md` (MINT.1 — SHIP with 2 pre-existing warnings)

## Verdict: FIX-BEFORE-SHIP

Zero Commandment violations. Zero process-boundary breaches. Zero hardcoded hex in className strings. All 176 Mint-scope tests pass. TypeScript is clean at the source-file level for the rendered surface.

But the surface carries two accumulated deferrals that are now actively harmful:

1. **Large dead-code footprint** — roughly 1,400 LOC of unused `TokenPanel`/`token/*` components plus their tests, maintained in parallel to the live `TokenManager`. Propagating fastest: every time someone edits tokens, they now have two surfaces to keep in sync, and the orphan drifts (e.g. `hasMultipleModes()` placeholder).
2. **Untyped IPC in two hooks/components** — the `window.flintAPI as any` escape hatch has spread beyond what MINT.1 flagged. All the methods the casts reach for are already declared in `flint-api.d.ts`. The casts are not needed and actively defeat the type system.

The tokenStore IPC-in-store warning (MINT.1) is still live and has widened from 8 to 10 call sites. Not blocking given the consistency pattern across other stores, but flagging for a tracked remediation.

Grade blocked on:
- Deleting `TokenPanel.tsx` + `src/components/ui/token/*` + their tests, OR
- Wiring `TokenPanel` into App.tsx and deprecating `TokenManager`

Pick one. Do not ship both.

## Blocking Issues

### B1. Dead code: `TokenPanel` and entire `src/components/ui/token/` subtree (except `TokenGrid`/`TokenHealthBar`/`TokenDetailPanel`)

**Files:**
- `src/components/ui/TokenPanel.tsx` (663 lines) — not imported anywhere in the runtime surface
- `src/components/ui/token/ColorGrid.tsx` — imported only by `TokenPanel`
- `src/components/ui/token/ModeColumns.tsx` — imported only by `TokenPanel`
- `src/components/ui/token/SpacingRuler.tsx` — imported only by `TokenPanel`
- `src/components/ui/token/TypographySpecimen.tsx` — imported only by `TokenPanel`
- `src/components/ui/token/TokenApprovalStaging.tsx` — imported only by `TokenPanel`
- `src/components/ui/token/TokenDetailView.tsx` — imported only by `TokenPanel`
- `src/components/ui/token/TokenTabBadge.tsx` — never imported (its own JSDoc suggests it "should be wired by Group A")

**Evidence:**
- `src/App.tsx:1306` mounts `<TokenManager />`
- No file imports `TokenPanel`
- `grep -rn "TokenPanel" src/` returns only the test file, internal references, and a comment in `TokenDetailView.tsx` describing where it "slides out from"

**Impact:** Contradicts the dual-audience rule and the Glass observability charter. Two parallel token surfaces = designers and developers don't know which one is canonical. Future edits to `TokenManager` (approved, shipping) will silently drift from `TokenPanel` (approved, unshipped).

**Fix:** Delete `TokenPanel.tsx`, `src/components/ui/token/*.tsx` (8 files), their test files (`TokenPanel.test.tsx`, `src/components/ui/token/__tests__/TokenDetailView.test.tsx`). If any rendering code is useful in `TokenManager` (e.g. `ModeColumns`, `SpacingRuler`), move it into `TokenGrid.tsx` first, then delete. Removal path: ~1,400 LOC + 71 tests.

### B2. `window.flintAPI as any` casts defeat the IPC contract

**Files:**
- `src/hooks/useTokenUsage.ts:57` — `const api = window.flintAPI as any`
- `src/components/ui/TokenPanel.tsx:63` — `const api = window.flintAPI as any`

**Evidence:** `src/types/flint-api.d.ts:207, 213, 218, 223, 228` already declare `scanUsage`, `auditContrast`, `getPendingApprovals`, `approveToken`, `rejectToken` on `TokensAPI`. The casts are not needed.

**Fix:** Remove both casts. Call `window.flintAPI.tokens.scanUsage?.()` and `window.flintAPI.tokens.getSyncSummary?.()` directly (optional-chain catches missing handlers). If `getSyncSummary` is missing from the types (it is — grep for it in `flint-api.d.ts` returns no results), add it as optional. Do not cast to `any`.

Note: B2 is effectively moot if B1 is resolved by deletion (TokenPanel goes away). But `useTokenUsage` is consumed by the live `TokenManager`, so its cast must be fixed regardless.

## Major Issues

### M1. `hasMultipleModes()` placeholder is still a liar after 6 days

**File:** `src/components/ui/TokenGrid.tsx:666-673`

```typescript
function hasMultipleModes(_token: DesignToken): boolean {
    // This is a placeholder — in practice, we would check if other tokens
    // in the same collection have a dark mode. [...] For now, we return false
    // to avoid false positives.
    return false
}
```

Called at `TokenGrid.tsx:612`: the "No dark mode" amber dot is physically unreachable. MINT.1 review flagged this on 2026-04-11. 6 days later it's still there.

**Impact:** Designer never sees the governance signal that would drive them to add a dark-mode counterpart. The entire JSX branch at line 612-617 is unreachable.

**Fix:** Accept `allTokens` or `collectionHasDarkMode: boolean` as a prop on `TokenGridCard`/`TokenGroupSection`, thread it through from the parent which already has the collection-level data. Remove the no-op function. If this can't land this sprint, the dead branch should be removed and the warning re-filed as an explicit MINT.5 task with an owner.

### M2. Missing unmount guards on async chains in `TokenManager`

**File:** `src/components/ui/TokenManager.tsx:266-337`

Five `setState` calls fire from async chains with no mounted-ref or cleanup:
- `setFigmaConnected` — line 270, 296
- `setFigmaTokens` — line 290
- `setUsageResults` — line 303
- `setPendingTokens` — line 223
- `setProjectPath` — line 333

If the Tokens tab is unmounted while any of these promises are in flight (user switches to another tab), React logs a warning and wastes the payload. `useTokenUsage` has the guard pattern (`mountedRef`), but `TokenManager` itself doesn't.

**Fix:** Either (a) wrap each async chain in an `AbortController` plumbed through to the IPC handler, or (b) add a `mountedRef` to `TokenManager` in `useEffect` and guard every `set*` inside `.then(...)`. Follow the pattern already established in `useTokenUsage.ts:54-83`.

### M3. `useContrastAudit` has no unmount guard

**File:** `src/hooks/useContrastAudit.ts:35-44`

```typescript
useEffect(() => {
    const fn = window.flintAPI.tokens?.auditContrast
    if (!fn) return
    setIsAuditing(true)
    fn()
        .then(setPairs)
        .catch(...)
        .finally(() => setIsAuditing(false))
}, [])
```

`setPairs` and `setIsAuditing` can fire after unmount. Same remediation pattern as M2. Because contrast audit is fairly slow (scans all color pairs), the unmount window is non-trivial.

### M4. `scanUsage` runs on every open, no cache

**File:** `src/hooks/useTokenUsage.ts:77-82`

Effect depends on `[scan, tokenCount]`. Re-scans every time the token count changes or the component re-mounts. For a large project this is a repeated filesystem walk across `.tsx`/`.jsx`/`.css`. No TTL cache, no stale-while-revalidate. On the Tokens tab, toggling view mode triggers a re-render but not a re-scan (good); switching away and back triggers a full rescan (bad).

**Fix:** Cache in a module-level `Map<projectPath, { results, timestamp }>` with a 30-60s TTL, or move the scan into the store (but see MINT.1 store-API warning — not without a broader architecture call).

## Minor / Nits

### N1. `TokenPanel.tsx:67` missing implicit any type annotation (caught by TSC)
```
src/components/ui/TokenPanel.tsx(67,25): error TS7006: Parameter 'err' implicitly has an 'any' type.
```
Moot if B1 is resolved by deletion.

### N2. `useTokenUsage.ts:49, 53` unused parameter + setter (caught by TSC)
```
src/hooks/useTokenUsage.ts(49,5): error TS6133: 'localTokens' is declared but its value is never read.
src/hooks/useTokenUsage.ts(53,27): error TS6133: 'setDriftedTokens' is declared but its value is never read.
```

Drift detection was disabled 2026-04-12 (comment at line 84) but the parameter and unused state setter remain. Either delete them or re-enable the feature behind a new IPC. Current state is a confusing half-feature.

### N3. `TokenManager.tsx:320` unused destructured property (caught by TSC)
```
src/components/ui/TokenManager.tsx(320,21): error TS6133: 'isUsageScanning' is declared but its value is never read.
```

Destructured from `useTokenUsage` but never used in the JSX. Either wire up a scanning indicator or drop it.

### N4. Sprawling `TokenManager` component — 725 lines, 15 useState + 7 useMemo + 9 useCallback hooks

The component is doing seven jobs: search, import, health bar, grid/list toggle, contrast, pending approvals, Figma sync badging, detail panel, first-sync prompt, usage scan. Single-responsibility went out the window two sprints ago.

Not blocking — but when this next needs a change, factor out `useTokenPanelState()` that owns the non-UI concerns. The current component is hostile to incremental review.

### N5. `TokenManager.tsx:284` manual `typeof val === 'object' && val?.$value` — brittle shape narrowing
```typescript
map.set(String(key), typeof val === 'object' && val?.$value ? String(val.$value) : String(val))
```
`val` is typed `unknown` here (Object.entries result). The narrowing works but is fragile to the next MCP resource schema change. Extract a typed helper `extractFigmaTokenValue(entry: unknown): string` with a test. Not urgent.

### N6. `TokenGrid.tsx:226` and `TokenGrid.tsx:295` — regex parsing for display math

These are extracting leading numerics for width proportional rendering, not for AST surgery. C13 (Deterministic Surgery) applies to source code mutation, not to rendering math. Safe. Noted in case a reviewer flags it later.

### N7. `TokenTabBadge.tsx` has instructive JSDoc that claims Group A should wire it up. It's not wired. See B1 — delete.

### N8. `TokenDetailPanel.test.tsx:137` missing ContrastPair fields (caught by TSC)
```
error TS2739: Type '{ fg; bg; ratio; passAA; passAAA }' is missing the following properties: fgValue, bgValue
```
Add the two missing properties to the fixture.

### N9. Multiple test files import unused symbols (caught by TSC, non-fatal)

- `TokenGrid.mint2.test.tsx:16` unused `TokenGroupSection`, `ViewMode`
- `TokenManager.mint3.test.tsx:19` unused `ContrastBadgeGrade`

Remove.

### N10. `TokenPanel` has `act()` warnings in tests

Noisy test output. Every `TokenPanel` test emits `act(...)` warnings from `TokenApprovalStaging` and `TokenPanel` async updates. Moot if B1 is resolved by deletion. If kept, wrap the store update chains in `act`.

## What Works Well

- **Zero Commandment violations** — no AST mutation, no regex-on-source, no raw `fs` writes, no external URLs in preview, no `window.flintAPI` in renderer calling anything that breaks the IPC contract.
- **Zero Node.js imports in `src/`** — verified on every Mint-scoped file; clean process boundary.
- **Zero hardcoded hex in className strings** — every color token uses the Tailwind palette (zinc, emerald, amber, indigo, blue, red, purple). Inline `style={{ backgroundColor: token.token_value }}` is the correct pattern because the token value IS the governance-approved color — it would be wrong to Tailwind-class it.
- **No cross-store imports** — `tokenStore.ts` imports only zustand + its own types. No `useCanvasStore` / `useEditorStore` / `useNotificationStore` in the store body. `useNotificationStore.getState()` is called in a component `useEffect` in TokenManager (line 150), which is the sanctioned pattern.
- **A11y posture is strong** — every swatch has `role="img"` + `aria-label`, every interactive button has `aria-label`, the view toggle is a proper `role="radiogroup"`, the health bar is `role="status"`, the import modal has `role="dialog"` + `aria-modal` + `aria-labelledby`. The MINT.1 a11y work survived subsequent passes intact.
- **TokenDetailPanel uses FocusTrap + ref-on-close-button** — good focus management.
- **`deleteToken` optimistic update with rollback** — `tokenStore.ts:167-192` captures the original index, removes optimistically, restores on IPC failure. Solid.
- **Full test coverage on the Mint surface that ships** — 176/176 tests pass across 7 files. No `.todo` stubs. Token Health Bar, grid/list, mode columns, a11y, detail panel, staging, contrast audit, approvals — all have behavioral tests.

## Test Coverage Gaps

- No test covers the Figma token map parsing at `TokenManager.tsx:273-296` (DTCG object entries branch). Worth covering because it's the only client-side parser of the MCP `flint://tokens` resource shape.
- No test covers `TokenManager.fetchUsage` graceful degradation when `scanUsage` is undefined. The `useTokenUsage` path tests it; the direct `setUsageResults` path at line 303 is untested.
- No test for `useContrastAudit` unmount during the fetch (M3).
- No test for `TokenManager` unmount during async `figma.status()` (M2).
- `TokenDetailPanel.test.tsx:137` fixture is type-unsound — tests compile but the ContrastPair fixture is missing `fgValue`/`bgValue`. Means the "contrast pairing" rendering path is only partially exercised.

## Final Test Counts

```
MCP:   5115/5115 passing
Core:  1850/1851 passing (1 skipped, 26 todo)
Glass: 2796/2798 passing (2 pre-existing StatusBar failures, not Mint scope; 11 todo)
Mint-scope (subset of Glass): 176/176 passing across 7 files
  - TokenManager.test.tsx: 36
  - TokenManager.mint3.test.tsx: (part of 36? separate)
  - TokenGrid.mint2.test.tsx: (included)
  - TokenHealthBar.mint4c.test.tsx: (included)
  - TokenPanel.test.tsx: 47 (ORPHAN — tests dead code)
  - TokenDetailPanel.test.tsx: (included)
  - token/__tests__/TokenDetailView.test.tsx: 24 (ORPHAN — tests dead code)
  - tokenStore.errorHandling.test.ts: 14

TSC (app): 286 errors total, 10 in Mint scope
  Mint-scope errors:
  - TokenDetailPanel.test.tsx:137 — missing ContrastPair fields (N8)
  - TokenGrid.mint2.test.tsx:16 — unused imports (N9)
  - TokenManager.mint3.test.tsx:19 — unused import (N9)
  - token/__tests__/TokenDetailView.test.tsx:194 — invalid TokenType "other"
  - TokenManager.tsx:320 — unused isUsageScanning (N3)
  - TokenPanel.tsx:67 — implicit any err (N1)
  - useTokenUsage.ts:49 — unused localTokens param (N2)
  - useTokenUsage.ts:53 — unused setDriftedTokens (N2)
  - tokenStore.errorHandling.test.ts:21 — missing description field in fixture

  Non-Mint errors (286 - 10 = 276): pre-existing, not this review's scope
```

## Remediation Summary (in order)

1. **Decide the live surface.** `TokenManager` ships. `TokenPanel` does not. Delete the latter + all of `src/components/ui/token/*` except files used by `TokenManager` (`TokenGrid.tsx`, `TokenHealthBar.tsx`, `TokenDetailPanel.tsx` are at the parent level, not in `token/`). Result: -1,400 LOC, -71 tests, -6 TSC errors.
2. **Remove the two `as any` casts.** B2 — 5 min fix. Use the typed IPC surface.
3. **Fix `hasMultipleModes()` placeholder or delete the caller.** M1 — thread collection data from parent or drop the dead branch at line 612-617.
4. **Add unmount guards to TokenManager + useContrastAudit.** M2, M3 — mountedRef pattern.
5. **Clean up TSC unused-variable warnings.** N2, N3, N9 — 10 min fixes.
6. **Add fgValue/bgValue to the contrast fixture.** N8 — 2 line fix.

After those six, re-run review. If the tokenStore-calls-window-flintAPI pattern is accepted as-is (consistent with other stores), carry MINT.1 warning (a) forward unchanged. Warning (b) — `hasMultipleModes()` — is addressed by step 3.

---
Reviewer sign-off pending user approval of the deletion vs. integration call for B1.
