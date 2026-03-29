# Glass Code Review — 2026-03-28

## Verdict

**APPROVED WITH NOTES**

The Phase GLASS redesign is structurally sound. No Commandment violations were found in the reviewed files. The architecture decisions — collapsible panels in canvasStore, PanelErrorBoundary wrapping every panel, FocusTrap on modals, progressive tab disclosure — are the right calls and are implemented correctly. The codebase follows the process boundary law throughout: no `fs` or Node.js imports in `src/`, all disk access routes through `window.flintAPI`.

There are no blockers. There are several high-priority issues that should be resolved before the next release, primarily around the `canExport` call pattern, a state mutation during render, two interactive accessibility gaps, and a missing type annotation.

---

## Blockers

None.

---

## High Priority Issues

### 1. `setSetupComplete(true)` called during render — React strict violation
**File:** `src/App.tsx:683`

```tsx
if (!setupComplete) {
    // Safety fallback
    setSetupComplete(true)   // <-- setState during render body
}
```

Calling a state setter in the render body (outside `useEffect`) is a React violation. In development and React 19 strict mode this causes double-invocation and can produce infinite re-render loops. The comment says "safety fallback" but the real safety mechanism is the 3-second `setTimeout` in the `useEffect` at line 579 that always fires `setSetupComplete(true)`. This branch should never be reachable in practice; if it is, a `useEffect` is the correct mechanism.

**Fix:** Wrap in `useEffect(() => { if (!setupComplete) setSetupComplete(true) }, [setupComplete])` — or simply delete the block since the timeout fallback already covers it.

---

### 2. `canExport` called as a function in App.tsx but subscribed as a value in StatusBar — divergent gate logic
**Files:** `src/App.tsx:797-803`, `src/components/editor/StatusBar.tsx:97`

In `App.tsx`, `canExport` is subscribed from the store as an action reference and then called as a function at render time:

```tsx
// App.tsx
const canExport = useCanvasStore((s) => s.canExport)
// …
title={canExport() ? 'Export-ready' : …}
className={`… ${canExport() ? '…' : '…'}`}
{canExport() ? <ShieldCheck … /> : <ShieldAlert … />}
```

Each `canExport()` call reads `get()` internally — three separate reads of the store inside a single render. These are consistent within one render pass, but Zustand does not subscribe to the state slices read inside `canExport()` when it is called this way. The component will only re-render when the `canExport` action reference changes, which never happens. In practice the export button in the header may show stale state between a violation appearing and the next unrelated re-render.

In `StatusBar.tsx` the gate is reimplemented from scratch at line 97:

```tsx
const canExport = mithrilViolations.length === 0 && !overridesExist && Object.keys(a11yViolations).length === 0
```

This shadow reimplementation bypasses `cachedPolicy` and the per-category mode checks (`mithrilMode`, `a11yMode`) that the store's `canExport()` correctly applies. If policy is set to `advisory` for one category, the StatusBar gate will still block export while the store gate correctly allows it.

**Fix for App.tsx:** Subscribe to the three individual state slices (`mithrilViolations.length`, `overridesExist`, `Object.keys(a11yViolations).length`) and call the store's `canExport()` inside a `useMemo` that depends on them, or factor the export button into a small dedicated component that mirrors StatusBar's approach. Do not subscribe to `canExport` as an action reference.

**Fix for StatusBar.tsx:** Delete the reimplemented gate at line 97 and replace with individual slice subscriptions that feed the store's `canExport()`, so policy mode is honored.

---

### 3. Non-button interactive element — accessibility regression
**File:** `src/components/ui/GovernanceDashboard.tsx:836-845`

```tsx
<span
    role="button"
    tabIndex={0}
    onClick={(e) => { e.stopPropagation(); handleFixSingle(fixItem!) }}
    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleFixSingle(fixItem!) } }}
    …
>
    Fix
</span>
```

Using `role="button"` on a `<span>` is an anti-pattern that the project's own Warden rules flag. This is inside the same component that teaches users about accessibility. Two issues:
1. `Space` key is not handled — native `<button>` activates on both `Enter` and `Space`; this `span` only handles `Enter`. Screen reader users pressing `Space` will scroll the page instead of activating the fix.
2. There is no good reason to use a `<span>` here — the parent `<button>` wrapping the entire row is `type="button"`, so a `<button>` inside it would be invalid HTML. The correct fix is to restructure so the outer `<button>` contains only non-interactive content and the "Fix" action is a sibling `<button>` outside it, or to use a `<button type="button">` inside and rely on `e.stopPropagation()`.

**Fix:** Restructure the violation row so the expand toggle and the fix button are siblings, not nested. Both should be `<button type="button">`.

---

### 4. Missing `type="button"` on Reconnect button in StatusBar
**File:** `src/components/editor/StatusBar.tsx:556-560`

```tsx
<button
    onClick={handleMcpReconnect}
    className="text-xs text-zinc-400 hover:text-white underline underline-offset-2 ml-0.5"
    aria-label="Reconnect Flint engine"
>
    Reconnect
</button>
```

The `type` attribute is absent. Inside a `<footer>` this is low risk but inconsistent with every other button in the file and the rest of the codebase. If this button is ever moved into a form context it will submit by default.

**Fix:** Add `type="button"`.

---

### 5. Autopilot apply div — not a button
**File:** `src/components/editor/StatusBar.tsx:645-656`

```tsx
<div
    className="flex cursor-pointer items-center gap-1.5 …"
    onClick={() => { if (governedCode && activeFilePath) { applyGovernedCode() } }}
    title="…"
>
```

This is a clickable `<div>` with no `role`, no `tabIndex`, and no keyboard handler. It is not keyboard-accessible and will not be announced correctly by screen readers. The `cursor-pointer` class indicates it is intended to be interactive.

**Fix:** Replace with `<button type="button">`.

---

## Medium Priority Issues

### 6. `demoLoadError` state declared after conditional return — React hooks ordering risk
**File:** `src/App.tsx:626`

```tsx
// Line 673: early return when setupComplete === null
if (setupComplete === null) return null

// …
if (!setupComplete) {
    setSetupComplete(true)   // Issue 1 above
}

// Line 686: conditional return for BetaWelcome

// Line 710: conditional return for LaunchScreen

// Line 626: this useState is declared BEFORE the conditional returns...
```

Actually on review `demoLoadError` is declared at line 626 which is before the conditional returns at lines 673, 687, and 710. The hook ordering is safe. However, the state is declared well after the effects that set it (line 332 `setDemoLoadError(...)`) which makes the read/write relationship harder to follow. This is a readability issue, not a bug.

**Recommendation:** Move `demoLoadError` declaration adjacent to the other boolean gates at lines 91-103 where the other launch-screen state lives.

---

### 7. `useOrchestratorStore.getState()` called inside a `useEffect` without subscription
**File:** `src/App.tsx:217-219`

```tsx
useEffect(() => {
    if (useOrchestratorStore.getState().hasConfig) unlockLeftTab('files')
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [unlockLeftTab])
```

This effect reads `orchestratorStore` via `getState()` which is a one-shot read at mount time — it does not subscribe to `hasConfig` changes. If `hasConfig` becomes true after mount (e.g. the user connects the IDE during the session), the `files` tab will never unlock. The `eslint-disable` comment suppresses the warning that would catch this.

**Fix:** Subscribe with `useOrchestratorStore((s) => s.hasConfig)` and add it to the dependency array, or use a separate `useEffect` that reacts to the `hasConfig` value.

---

### 8. `hydrateWorkspace` referenced in `useEffect` but not listed as a dependency
**File:** `src/App.tsx:622`, `src/App.tsx:669`

Multiple `useEffect` calls reference `hydrateWorkspace` (an async function defined inline in the component) with `// eslint-disable-next-line react-hooks/exhaustive-deps` suppressing the missing-dependency warning. `hydrateWorkspace` is not wrapped in `useCallback`, so it is recreated on every render. The `eslint-disable` comments are correct in that the effects are intentionally mount-only, but `hydrateWorkspace` should be wrapped in `useCallback` with its own stable dependencies to make the intent explicit and safe against future refactors.

---

### 9. Duplicate `canExport` computation in `GovernanceDashboard` vs `canvasStore`
**File:** `src/components/ui/GovernanceDashboard.tsx:667-669`

```tsx
const noViolations = mithrilCount === 0 && a11yCount === 0 && overrideCount === 0
const exportBlocked = !noViolations
```

A third reimplementation of the export gate, this time ignoring `cachedPolicy` entirely. All three implementations (canvasStore, StatusBar, GovernanceDashboard) will diverge under a custom policy. The store's `canExport()` should be the single source of truth, used by all three call sites.

---

### 10. `FocusTrap` does not handle `Escape` key
**File:** `src/components/ui/FocusTrap.tsx`

The WCAG 2.1 success criterion 1.4.13 and general dialog pattern best practice requires that dialogs dismissible with `Escape`. The `FocusTrap` handles `Tab`/`Shift+Tab` but does not fire an `onEscape` callback. If callers render a `FocusTrap` around a dialog without separately handling `Escape`, keyboard users cannot dismiss the dialog. The component should accept an optional `onEscape?: () => void` prop.

---

### 11. `PanelErrorBoundary` retry resets to potentially broken state
**File:** `src/components/ui/PanelErrorBoundary.tsx:43-45`

```tsx
private handleRetry = () => {
    this.setState({ hasError: false, error: null })
}
```

Resetting `hasError` to false causes the children to re-render from their current state. If the error was caused by invalid props or a store state inconsistency, the component will crash again immediately and render the error boundary a second time. The `handleRetry` behavior is acceptable for transient errors (network, async race) but misleading for structural errors. Adding a brief delay or a "force remount" pattern (via a `key` prop change) would make retries more effective.

This is low severity since the error boundary is already catching what would otherwise be a white screen — it is strictly better than nothing.

---

### 12. `ComponentPanel` empty state does not use the shared `EmptyState` component
**File:** `src/components/ui/ComponentPanel.tsx:237-253`

```tsx
{!isLoading && filteredCards.length === 0 && (
    <div
        className="flex flex-col items-center gap-2 py-8 text-center"
        data-testid="component-panel-empty"
    >
        <span className="text-xs text-zinc-500">…</span>
```

The `EmptyState` component was introduced in this same sprint for exactly this pattern. `ComponentPanel` duplicates its structure instead of using it. This is inconsistency within a single sprint.

---

## Low Priority / Tech Debt

### 13. `CanvasView` type marked deprecated but still exported
**File:** `src/store/canvasStore.ts:79`

```tsx
/**
 * @deprecated GLASS.1c — Canvas view modes removed.
 * Kept temporarily for backward compatibility with ComponentCardNode and ComponentCardStore.
 * Will be deleted in cleanup pass.
 */
export type CanvasView = 'preview' | 'build' | 'govern'
```

`ComponentCardNode` was deleted in Sprint 2 (visible in git status). If `ComponentCardStore` is the only remaining consumer, a follow-up task should be filed to remove this type and its references. Leaving deprecated types in the public API surface creates confusion for anyone reading the store types.

---

### 14. `ScoreRing` SVG uses `fontFamily="inherit"` which may not resolve in all renderers
**File:** `src/components/ui/GovernanceDashboard.tsx:162`

SVG `fontFamily="inherit"` inherits from the surrounding HTML context in browsers but may not work correctly in PDF export or screenshot tooling (e.g. Puppeteer). Given that the health score ring is a core visual element and screenshots are used for thumbnails, this is worth switching to an explicit font stack.

---

### 15. `relativeTime` in StatusBar does not update without a re-render trigger
**File:** `src/components/editor/StatusBar.tsx:68-78`

The `relativeTime` function computes a string from `Date.now()` at render time. Since there is no interval that forces periodic re-renders, the "X minutes ago" label will become stale while the popover is open. The Figma status polls every 5 seconds (`window.setInterval(fetchFigmaStatus, 5_000)`) which triggers a re-render via `setFigmaStatus` — so in practice the display refreshes every 5 seconds while the popover is open. This is acceptable but should be documented.

---

### 16. Inconsistent whitespace in Tailwind class string
**File:** `src/components/editor/StatusBar.tsx:541-543`

```tsx
className={[
    'inline-block w-2 h-2 rounded-full',
```

Width before height (`w-2 h-2`) is the reverse of the rest of the codebase which consistently uses `h-2 w-2`. This is cosmetic but Mithril's consistency mandate applies to ordering conventions.

---

## Test Coverage Gaps

### FocusTrap — `onEscape` not tested (because it doesn't exist yet — Issue 10)
Once `onEscape` is added, the test in `src/components/ui/__tests__/FocusTrap.test.tsx` must cover: Escape key fires callback, focus is restored to trigger element after Escape.

### ComponentPanel — insert path when `activeSelection` is null
The current test file exists (`src/components/ui/__tests__/ComponentPanel.test.tsx`) but should verify the notification that fires when insert is attempted with no selection (the guard at line 166-173 of `ComponentPanel.tsx`). This is a user-visible code path that is easy to miss in manual testing.

### `canExport` — policy mode interaction
The `canExport` action in `canvasStore` has a policy-aware code path (`mithrilMode === 'blocking'`) but the existing tests should be audited to confirm that a policy with `mithril.mode = 'advisory'` correctly returns `true` even when `mithrilViolations` is non-empty. This is the key correctness invariant for the policy system.

### `PanelErrorBoundary` — retry behavior after structural error
The existing test likely only covers the initial error rendering. A test that crashes, retries, and crashes again (asserting the error state is re-entered) would prevent a future regression where `handleRetry` silently swallows repeated errors.

---

## What's Solid

**canvasStore panel collapse logic** (`toggleLeftPanel`, `toggleRightPanel`): Correct implementation. Saves and restores width, returns a new state object so Zustand detects the change. The `_leftPanelSavedWidth` and `_rightPanelSavedWidth` private-convention fields cleanly separate the transient saved state from the rendered state.

**canvasStore `triggerAutoSave`**: The debounce implementation is correct. Re-reads `activeFilePath` at fire time (not capture time) to handle the race where `setActiveFile` is called between the debounce start and the timer. The module-level `_saveTimer` singleton with explicit null-check on each entry is the right pattern for a singleton store.

**FocusTrap**: Solid implementation. Re-queries focusable elements on every keydown rather than caching at mount — this correctly handles dynamic content (React portals, conditional renders). The `compareDocumentPosition` sort is the right way to enforce document order in jsdom. `initialFocusRef` support and focus restoration on unmount are both present. The `setTimeout(0)` defer for initial focus is correct and necessary.

**PanelErrorBoundary**: Clean class component. `componentDidCatch` logs without swallowing. The Copy Error button is a nice operational affordance. The component is correctly applied to every panel in App.tsx including the Canvas itself.

**EmptyState**: Correct micro-component. Minimal API surface, no internal state, fully prop-driven. The optional `action` pattern avoids boolean prop proliferation.

**GovernanceDashboard export gate banner**: The conditional rendering of the red/green banner at the top of the dashboard (before the score ring) is the right information architecture decision — it surfaces the most actionable signal first. The export button inside the "all clear" state is a good progressive disclosure pattern.

**canvasStore `setActiveFile` Clean Slate Protocol**: Correct ordering — flush pending save → clearAST → set path → hydrate. The lazy `import('./editorStore')` to break the circular dependency is the right call; the comment explaining why is present and accurate.

**Progressive tab unlock effects** in App.tsx (lines 198-219): Each effect watches exactly one data source. The `unlockTab` no-op guard in the store means these effects can fire repeatedly without churn. The one-time "new" dot pattern using `seenTabs` is clean.

**`aria-hidden={isAnyModalOpen || undefined}` in App.tsx:735**: Correct usage — passing `undefined` when false prevents the attribute from being written to the DOM at all, which is the correct ARIA pattern (an explicit `aria-hidden="false"` is not the same as omitting it).

**GovernanceDashboard violation card ARIA**: `aria-expanded` and `aria-controls` on the accordion buttons are correctly paired with `id` attributes on the expanded panels. The `aria-hidden="true"` on decorative icons throughout the file is consistent.

---

*Reviewed by: senior code reviewer — Phase GLASS*
*Files reviewed: src/App.tsx, src/store/canvasStore.ts, src/components/ui/ComponentPanel.tsx, src/components/ui/EmptyState.tsx, src/components/ui/FocusTrap.tsx, src/components/ui/PanelErrorBoundary.tsx, src/components/ui/GovernanceDashboard.tsx, src/components/editor/StatusBar.tsx*
*Deleted files confirmed removed: GovernanceOverlay.tsx, ShieldOverlay.tsx, GhostOverlay.tsx, ComponentCardNode.tsx, DependencyEdge.tsx, RecipeStrip.tsx, ViolationTooltip.tsx, useUnifiedViolations.ts*
