# UX Audit Burn-Down Code Review -- 2026-04-04

**Reviewer:** Quality Gate (Opus)
**Scope:** 8 files touched by the UX audit burn-down (T1.1-T5.3 fixes)
**Verdict:** 2 BLOCKERs, 6 WARNINGs. Fix blockers before shipping.

---

## Verification Results

```
TSC:   0 errors
Glass: 1880/1880 passing (0 new)
```

---

## BLOCKERs (must fix)

### BLOCKER 1: T5.1 HIGHLIGHT_NODE postMessage targets a non-existent data-testid

**File:** `src/components/ui/GovernanceDashboard.tsx` line 614
**File:** `src/components/editor/LivePreview.tsx` line 1513-1523

The GovernanceDashboard sends a highlight message to the iframe via:

```ts
const iframe = document.querySelector('iframe[data-testid="live-preview-iframe"]') as HTMLIFrameElement | null
iframe?.contentWindow?.postMessage({ type: 'HIGHLIGHT_NODE', nodeId }, '*')
```

But the `<iframe>` in LivePreview does NOT have `data-testid="live-preview-iframe"`. It has `title="Live Preview"` and no `data-testid` at all. The querySelector will always return `null`, so `iframe?.contentWindow?.postMessage` is a no-op. The entire T5.1 violation-to-canvas highlight feature is silently broken.

**Fix:** Add `data-testid="live-preview-iframe"` to the `<iframe>` element in LivePreview.tsx (line ~1513), or change the GovernanceDashboard selector to use `iframe[title="Live Preview"]`.

---

### BLOCKER 2: VIOLATION_TYPE_TO_RULE_PREFIX keys don't match LinterWarning.type values

**File:** `src/components/ui/GovernanceDashboard.tsx` lines 677-684

The mapping uses bare keys:
```ts
const VIOLATION_TYPE_TO_RULE_PREFIX: Record<string, string> = {
    color:      'MITHRIL-COL',
    typography: 'MITHRIL-TYP',
    spacing:    'MITHRIL-SPC',
    shadow:     'MITHRIL-SHD',
    opacity:    'MITHRIL-OPC',
    a11y:       'A11Y',
}
```

But `LinterWarning.type` is defined as:
```ts
type: 'color-drift' | 'typography-drift' | 'spacing-drift' | 'shadow-drift' | 'opacity-drift' | 'a11y' | ...
```

The keys should be `'color-drift'`, `'typography-drift'`, etc. As written, `VIOLATION_TYPE_TO_RULE_PREFIX[violationType]` returns `undefined` for every Mithril violation type, so the prefix-based fallback filter never fires. This means T1.1 (toggle-off a Mithril rule category) only works when the violation message happens to start with an explicit rule ID -- which Mithril violations DO (e.g. `MITHRIL-COL-001:`), so the feature partially works via the first code path. However, A11y violations that lack an embedded rule ID prefix will NOT be filtered. The mapping should be corrected for robustness and correctness.

**Fix:** Change the keys to match the actual type values:
```ts
'color-drift':      'MITHRIL-COL',
'typography-drift': 'MITHRIL-TYP',
'spacing-drift':    'MITHRIL-SPC',
'shadow-drift':     'MITHRIL-SHD',
'opacity-drift':    'MITHRIL-OPC',
'a11y':             'A11Y',
```

---

## WARNINGs (should fix)

### WARNING 1: Remaining text-zinc-600 contrast violations (T3.1 incomplete)

The audit identified `text-zinc-600` on dark backgrounds as a WCAG contrast failure (~2.5:1 vs required 4.5:1). Several instances remain:

- **GovernanceDashboard.tsx** lines 1566, 1588: `disabled:text-zinc-600` (acceptable -- disabled states are exempt from WCAG contrast)
- **GovernancePanel.tsx** line 39: `text-zinc-600` on the "In development" badge
- **GovernancePanel.tsx** line 216: `text-zinc-600 line-through` for disabled rule names
- **GovernancePanel.tsx** line 273: `text-zinc-600` for inactive category counts
- **GhostCodeSnippet.tsx** lines 136, 368, 372: `text-zinc-600` for line numbers and separator dots

The GovernancePanel instances are particularly problematic because users need to read rule names even when disabled. The GhostCodeSnippet separator dots are decorative and low-impact.

**Recommendation:** Replace `text-zinc-600` with `text-zinc-500` in GovernancePanel rule descriptions and category counts. The GhostCodeSnippet non-target line numbers at `text-zinc-600` could stay as they are secondary information.

---

### WARNING 2: Hardcoded hex values in XYCanvas MiniMap and Background

**File:** `src/components/editor/XYCanvas.tsx` lines 338, 345-347

```tsx
color="#374151"                                           // line 338
nodeColor="#4f46e5"                                       // line 345
style={{ background: '#111827', border: '1px solid #1f2937' }}  // line 347
```

These are props passed to `@xyflow/react` components (`Background`, `MiniMap`) which require string hex values -- they cannot accept Tailwind classes. This is a known limitation of third-party component APIs and is NOT a Mithril violation since these are prop values, not className strings. However, they should be documented with a comment explaining why.

**Recommendation:** Add a comment: `// XYFlow components require hex prop values -- not Tailwind classNames`.

---

### WARNING 3: Hardcoded hex values in LivePreview iframe-injected styles

**File:** `src/components/editor/LivePreview.tsx` lines 106, 125, 130-131

```css
color: #fff;                    /* highlight label */
outline: 2px solid #818cf8;     /* pulse animation */
outline-color: #4f46e5;         /* pulse keyframes */
```

These are CSS styles injected into the sandboxed preview iframe via raw string templates. The iframe has no access to the Flint design token system -- it runs in an isolated sandbox. Tailwind classes are available via the vendored CDN, but keyframe animations and overlay styles must use raw CSS. This is acceptable given the architecture, but the hex values should map to indigo-400 (#818cf8) and indigo-600 (#4f46e5) semantically.

**Recommendation:** Add a comment mapping each hex to its Tailwind equivalent for maintainability.

---

### WARNING 4: postMessage uses wildcard origin

**File:** `src/components/ui/GovernanceDashboard.tsx` line 615

```ts
iframe?.contentWindow?.postMessage({ type: 'HIGHLIGHT_NODE', nodeId }, '*')
```

The wildcard `'*'` origin is used for postMessage. For srcdoc iframes this is architecturally required (srcdoc iframes have an opaque "null" origin which cannot be targeted). The existing `getIframeOrigin()` helper in LivePreview.tsx already documents this constraint. However, when a Vite preview URL is active (project mode), the origin COULD be narrowed. This is low risk since the message payload is non-sensitive (a node ID string).

**Recommendation:** Use the same `getIframeOrigin()` pattern from LivePreview to narrow the origin when possible. Low priority.

---

### WARNING 5: isRuleDisabled defined inside component body (re-created every render)

**File:** `src/components/ui/GovernanceDashboard.tsx` lines 686-705

The `isRuleDisabled` function and `VIOLATION_TYPE_TO_RULE_PREFIX` constant are defined inside the component body. The constant is re-created on every render (although this is trivially cheap). The function captures `overrides` from the outer scope implicitly via its third parameter, so it could be extracted to module scope.

**Recommendation:** Move `VIOLATION_TYPE_TO_RULE_PREFIX` to module scope (outside the component). The function already takes `ruleOverrides` as a parameter, so it can also be extracted.

---

### WARNING 6: GhostCodeSnippet state update during render (anti-pattern)

**File:** `src/components/editor/GhostCodeSnippet.tsx` lines 234-238

```ts
const [lastSeenId, setLastSeenId] = useState<string | null>(null)
if (selectedNodeId !== lastSeenId) {
    setLastSeenId(selectedNodeId)
    if (manualOpen) setManualOpen(false)
}
```

This calls `setState` during the render phase, which is a React anti-pattern. React will re-render the component synchronously before committing to the DOM, which works but triggers an unnecessary extra render cycle. This should be converted to a `useEffect` or `useMemo`.

**Recommendation:** Move to a `useEffect` with `selectedNodeId` as a dependency, or use a ref to track the previous ID.

---

## Commandment Compliance

| # | Commandment | Status |
|---|-------------|--------|
| C3 | Fresh Parse | PASS -- no direct AST mutation in changed files |
| C4 | Local-First Only | PASS -- no external URLs introduced |
| C7 | ID Preservation | PASS -- no structural ops in changed files |
| C9 | CIEDE2000 Delta-E | N/A -- no color comparisons in changed files |
| C10 | History Clear | N/A -- no setCode calls in changed files |
| C12 | Atomic Queuing | N/A -- no file writes in changed files |
| C13 | No Regex Surgery | PASS -- regex used only for message parsing, not source code modification |
| C15 | AST Catalog | N/A -- no AI orchestrator changes |
| C16 | TSC Loop | N/A -- no AI output paths changed |

---

## Process Boundary Security

| Check | Status |
|-------|--------|
| No Node.js imports in src/ | PASS |
| No @anthropic-ai/sdk in src/ | PASS |
| window.flintAPI calls have type declarations | PASS -- all calls use existing typed API surface |
| No secrets or API keys | PASS |
| CSP unchanged | PASS |

---

## State Architecture

| Check | Status |
|-------|--------|
| No store importing another store | PASS |
| No window.flintAPI inside store actions | PASS -- IPC calls are in component body/callbacks |
| Zustand selector pattern | PASS -- all components use individual selectors |

---

## Undo/Redo Coverage

N/A -- these changes are UI-only (no AST mutations introduced).

---

## Test Coverage

No new tests were added for the burn-down changes. Given these are primarily UI/visual fixes (contrast, layout compaction, event wiring), the risk is low for most items. However:

- T1.1 (rule override filtering): Should have a test verifying that `isRuleDisabled` correctly filters violations when a rule is disabled. This would have caught BLOCKER 2.
- T5.1 (highlight postMessage): Should have a test verifying the iframe selector resolves correctly.

---

## Accessibility

| Check | Status |
|-------|--------|
| New interactive elements have aria-labels | PASS -- Autopilot toggle, Run Audit buttons, export gate button all have aria-label |
| View Source pill has aria-label | PASS -- "View source code" |
| Resize handles have ARIA separator role | PASS |
| canExport() gate still blocks on violations | PASS -- unchanged |

---

## Summary

The burn-down addresses the UX audit themes well: health section compaction, Run Audit relocation, Autopilot surfaced, contrast fixes, code snippet opt-in, Quick Load removal, sidebar resize, clickable export gate. Two implementation bugs prevent the T1.1 override filtering and T5.1 canvas highlight from working. Both are straightforward fixes (correct the type mapping keys, add a data-testid to the iframe).

**Grade: B-** -- Good architectural direction, clean process boundaries, zero TSC errors, all tests pass. Downgraded from B+ due to two features that are wired but silently non-functional.
