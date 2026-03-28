# Contract: GLASS.3 — Polish

**Phase:** GLASS.3
**Status:** REVISED (2026-03-28 — lint fixes applied)
**Date:** 2026-03-27
**Depends on:** GLASS.1 (some items reference structural changes), GLASS.2 (ErrorBoundaries must exist first)
**Agents:** flint-design-engineer (UI, loading states), flint-state-architect (stores)

---

## 1. Problem Statement

Glass works but doesn't feel crafted. Content pops in/out without transitions. Async panels show no loading state. Developer scaffolding leaks into the production UI. The onboarding teaches nothing. Power users have no keyboard path through violations. These details separate "functional" from "brilliant."

## 2. Work Items

### 3.1 LivePreview Loading States

**File:** `src/components/editor/LivePreview.tsx`

**A. Transform loading indicator:**
- Add `isTransforming` state (set true when IPC transform call starts, false on resolve/reject)
- When `isTransforming`: render a subtle overlay on the iframe — semi-transparent backdrop with a small spinner and "Compiling..." text
- Style: `bg-zinc-950/40` overlay, spinner uses `animate-spin`, text `text-xs text-zinc-400`
- Overlay does NOT block pointer events — user can still interact with stale preview

**B. Stale preview indicator:**
- When source code changes but transform hasn't completed: show a tiny amber dot + "Outdated" badge in the preview toolbar
- Disappears when new srcdoc loads
- Style: `bg-amber-500` dot (4px) + `text-xs text-amber-400` label

**C. Error formatting:**
- Replace raw `{transformError}` string with structured error display:
  - Error type badge (e.g., "Syntax Error", "Type Error") — derived from error message parsing
  - Formatted message (monospace, truncated with expand)
  - "This usually means..." hint for common errors (missing import, unclosed tag, undefined component)
- Style: match existing error patterns — `bg-red-900/10 border-red-700/40`

**D. Remove developer scaffolding:**
- Remove or `import.meta.env.DEV`-gate the "Quick Load" label and "Load Demo" button from the preview toolbar
- Replace with: framework badge showing detected framework (React/Vue/Svelte/HTML) — already available from `frameworkMode` state

### 3.2 Panel Collapse/Expand

**Files:** `src/App.tsx`, `src/components/ui/ResizeHandle.tsx`

**Behavior:**
- Double-click on ResizeHandle collapses the adjacent panel to 0px width
- Double-click again restores to previous width (store last width before collapse)
- Add a small chevron button (6px wide) at the edge of collapsed panels — click to expand
- Collapsed state: panel content unmounts (or `display:none`), only the chevron rail remains
- Keyboard: no shortcut needed (Cmd+B for left, Cmd+. for right could be added later)

**State migration from App.tsx local state to canvasStore:**

Currently `leftWidth` and `rightWidth` are `useState` in App.tsx (lines 112-113). Move them to canvasStore so collapse/expand state survives re-renders and is accessible to other components.

```typescript
// canvasStore — ADD these fields and actions:
leftPanelWidth: number       // default: 224 (matches current useState default)
rightPanelWidth: number      // default: 288 (matches current useState default)
leftPanelCollapsed: boolean  // default: false
rightPanelCollapsed: boolean // default: false
setLeftPanelWidth: (w: number) => void
setRightPanelWidth: (w: number) => void
toggleLeftPanel: () => void   // saves current width, sets collapsed=true, width=0
toggleRightPanel: () => void  // same
```

**App.tsx migration (required):**

- Remove `const [leftWidth, setLeftWidth] = useState(224)` (line 112)
- Remove `const [rightWidth, setRightWidth] = useState(288)` (line 113)
- Remove `handleLeftDrag` and `handleRightDrag` callbacks (lines 115-121)
- Replace with canvasStore selectors: `const leftWidth = useCanvasStore(s => s.leftPanelWidth)`
- Update `closeWorkspace` to reset: `setLeftPanelWidth(224)`, `setRightPanelWidth(288)`, `leftPanelCollapsed: false`, `rightPanelCollapsed: false`

**Minimum widths:** When not collapsed, panels still respect `PANEL_MIN` (160px). Collapsed = 0px + 6px chevron rail.

### 3.3 Tab Transitions + Skeletons

**A. Tab content transitions:**
- Wrap tab content in a shared `TabTransition` component
- On tab switch: outgoing content fades out (opacity 1→0, 100ms), incoming fades in (opacity 0→1, 100ms)
- Use CSS transitions, not React animation libraries (keep bundle small)
- Apply to both left-panel tabs and right-panel tabs

**B. Skeleton loading states:**
- Create `src/components/ui/Skeleton.tsx` — reusable skeleton line/block component
- Style: `bg-zinc-800 animate-pulse rounded` with configurable height/width
- Apply skeletons to:
  - GovernanceDashboard (while health score loads): skeleton ring + skeleton lines for penalties
  - ActivityFeed (while log file loads): 3 skeleton rows
  - AgentDashboard (while agent data loads): skeleton cards — if this panel survives GLASS.1

**C. New-tab indicator upgrade:**
- Current: 4px (`h-1 w-1`) blue dot — nearly invisible
- New: 8px (`h-2 w-2`) indigo dot with a subtle `animate-pulse` for 3 seconds after appearing
- After 3 seconds: pulse stops, dot remains static until tab is visited

### 3.4 Production Cleanup

**A. Remove IPC health pill:**
- `src/App.tsx` or `src/components/editor/StatusBar.tsx`: remove the `ipcStatus` "pong" pill from the top bar / status bar
- This is debug telemetry, not user information

**B. Move Override badge:**
- Current: "Overrides (N)" in StatusBar competing for space
- New: Move override count into the Governance tab header: "Governance · 3 overrides"
- StatusBar only shows: MCP connection, Figma sync, export gate, breakpoint mode

**C. Remove or gate developer controls:**
- "Load Demo" button in LivePreview toolbar → `import.meta.env.DEV` gate (covered in 3.1D)
- Any other `console.log` debug output in production → replace with conditional `if (import.meta.env.DEV)` guards

### 3.5 Progressive Mode Disclosure (if modes survive GLASS.1)

**If GLASS.1 keeps a mode toggle (fallback design):**
- Rename: Preview → "Canvas", Build → "Library", Govern → "Health"
- Progressive reveal:
  - New project: only "Canvas" visible
  - "Library" appears when `componentCardStore.cards.length >= 3`
  - "Health" appears when first audit has run (check `governance_events` table or `linterWarnings.length > 0` ever)
- Add transition animation between modes (crossfade, 200ms)
- Show LivePreview as picture-in-picture thumbnail in Library/Health modes

**If GLASS.1 kills modes (primary design):** This item is N/A. Skip.

### 3.6 First-Audit Guided Experience

**Replace current onboarding (3 generic tooltips) with contextual guidance.**

**File:** `src/components/ui/OnboardingOverlay.tsx` (rewrite)

**Scenario A: Project with no tokens**
- Show inline card in Governance tab: `<Palette />` + "Connect your design system to start" + "Your health score measures against your design tokens" + [Import Tokens] CTA
- Dismisses when tokens are imported

**Scenario B: Project with tokens, first violation detected**
- Highlight the first violation row in GovernanceOverlay with a pulsing indigo ring
- Show contextual tooltip on the Auto-Fix button: "Click to fix — Flint replaces the hardcoded value with your design token"
- Show once, then mark `onboarding:first-fix-shown` in localStorage

**Scenario C: First export attempt**
- If export gate blocks: show tooltip on the violation count explaining "Fix these to enable export"
- If export succeeds: show celebratory toast "First successful export!" (one-time)

**Remove:** The current 3-step tooltip overlay ("Your Canvas", "Inspect & Edit", "Talk to Flint")

### 3.7 Keyboard Violation Navigation

**File:** `src/components/editor/GovernanceOverlay.tsx`

**Shortcuts (when Governance tab is focused):**
- `J` or `↓` — next violation (highlight + scroll into view)
- `K` or `↑` — previous violation
- `F` — auto-fix current violation (if auto-fixable)
- `S` — skip/dismiss current violation from view (soft hide, not override)
- `Escape` — deselect violation

**Visual feedback:**
- Currently focused violation gets indigo left-border highlight (2px)
- Selected node in canvas syncs with focused violation

**Command palette integration:**
- Add "Next Violation" (Cmd+]) and "Previous Violation" (Cmd+[) to CommandPalette
- Add "Fix Current Violation" to CommandPalette

### 3.8 Tab Overflow Handling

**File:** `src/App.tsx` (right sidebar tab bar)

**When tabs exceed available width:**
- Tab bar becomes horizontally scrollable (hidden scrollbar, scroll via drag or mouse wheel)
- OR: last position becomes a "..." button that opens a dropdown showing overflow tabs
- Recommendation: horizontal scroll — simpler, works with touch, no extra UI

**Additional:** Add native title tooltips on tab icons (already present but confirm all tabs have them). Consider replacing native tooltips with custom tooltips that appear faster (200ms instead of 400ms).

## 3. Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/Skeleton.tsx` | Reusable skeleton loading component |
| `src/components/ui/TabTransition.tsx` | Crossfade wrapper for tab content switching |
| `src/components/ui/__tests__/Skeleton.test.tsx` | Renders with correct animation class |

## 4. Files to Modify

| File | What Changes |
|------|-------------|
| `src/components/editor/LivePreview.tsx` | Transform loading overlay, stale badge, error formatting, remove Load Demo |
| `src/App.tsx` | Panel collapse state, tab transitions, tab overflow, IPC pill removal, override badge relocation |
| `src/components/ui/ResizeHandle.tsx` | Double-click collapse handler |
| `src/store/canvasStore.ts` | Panel collapse/expand state + actions |
| `src/components/editor/GovernanceOverlay.tsx` | Keyboard navigation (J/K/F/S), focused-violation state |
| `src/components/ui/GovernanceDashboard.tsx` | Skeleton loading state |
| `src/components/ui/OnboardingOverlay.tsx` | Full rewrite — contextual guidance replacing generic tooltips |
| `src/components/editor/StatusBar.tsx` | Remove IPC pill, remove override badge |
| `src/components/ui/CommandPalette.tsx` | Add violation navigation commands |

## 5. Test Boundaries

| Test | What it verifies |
|------|-----------------|
| LivePreview shows "Compiling..." during transform | Loading overlay appears and disappears |
| LivePreview shows "Outdated" when code changes | Stale indicator visible during async gap |
| Transform error renders structured display | No raw stack traces in UI |
| Panel collapse on double-click | Width goes to 0, chevron appears |
| Panel expand on chevron click | Restores to previous width |
| Tab content crossfades on switch | Opacity transition runs (CSS class check) |
| Skeleton renders with pulse animation | `animate-pulse` class present |
| GovernanceOverlay J/K navigates violations | Focus moves, scroll follows |
| GovernanceOverlay F triggers auto-fix | Fix applied on focused violation |
| Onboarding shows first-fix tooltip | Tooltip appears on first violation |
| Onboarding does not show after first-fix-shown | localStorage flag prevents re-show |
| No "Load Demo" in production build | Button absent when `import.meta.env.DEV` is false |
| No IPC "pong" pill in UI | Element not in rendered output |
| Tab overflow scrolls horizontally | Tabs scrollable at narrow width |

## 6. Implementation Order

**Independent (start immediately):**

1. **3.1** LivePreview polish — no dependencies
2. **3.4** Production cleanup — no dependencies
3. **3.2** Panel collapse — no dependencies (only needs canvasStore, not GLASS.1 tab changes)

**After GLASS.2:**

4. **3.3** Tab transitions + skeletons — needs ErrorBoundaries from GLASS.2.3

**After GLASS.1 merges (BLOCKED until then):**

5. **3.6** First-audit guided experience — needs GLASS.1a sidebar to know which tabs exist
6. **3.7** Keyboard violation navigation — needs GLASS.1d unified violations + `useUnifiedViolations` hook. **Do NOT start until GLASS.1d GovernanceOverlay restructure is merged.**
7. **3.8** Tab overflow — needs GLASS.1a to determine final tab count (likely 3, overflow may be N/A)
8. **3.5** Progressive mode disclosure — only if modes survive GLASS.1 (expected: N/A)

Items 1-4 can start immediately. Items 5-8 depend on GLASS.1 decisions.
