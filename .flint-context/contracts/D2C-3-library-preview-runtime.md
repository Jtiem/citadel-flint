# Contract: D2C.3 -- Library Preview Runtime

**Phase:** D2C.3 -- Component Library Shims for LivePreview
**Date:** 2026-03-26
**Prerequisites:** A (LivePreview srcdoc engine -- ONLINE), LIB.1 (Library Adapters + setLibrary -- ONLINE), N.4 (Vite Preview Server -- ONLINE)
**Owner:** flint-design-engineer (shim files + LivePreview integration), flint-test-writer (tests)

---

## 1. Problem Statement

When `flint_design_to_code` generates shadcn code (`<Card>`, `<Avatar>`, `<Select>`), the LivePreview srcdoc iframe cannot render it because those components do not exist in the iframe scope. The srcdoc preview path uses UMD React + Babel transpilation in an isolated iframe with no bundler and no `node_modules`. Unresolved component references produce runtime errors or blank renders.

The user should not have to paste code into another project or install dependencies. Figma URL in, rendered preview out. Zero friction.

### Scope clarification: Two preview paths

LivePreview has two rendering modes:

| Mode | When active | How it works | Library support |
|------|-------------|-------------|-----------------|
| **srcdoc** (single-file) | No project open, or editing a single `.tsx` | Babel transform in main process, UMD React/ReactDOM/Tailwind CDN inlined, `new Function()` execution | **Needs shims** (this phase) |
| **Vite dev server** (project mode) | Project folder open (`workspaceFiles != null`) | Full Vite HMR, user's own `node_modules` resolve | **No shims needed** -- real components resolve via the user's bundler |

D2C.3 targets the **srcdoc path only**. When a project is open and the Vite server is running, the user's real shadcn/MUI/PrimeNG components render natively through their bundler. Shims are the fallback for the zero-install, single-file preview experience.

### Existing state

9 component stubs already exist inline in `buildSrcdoc` at lines 108-177 of `LivePreview.tsx`:
- Badge, Button, Heading, TextField, SwitchToggle, SelectField, IconButton, Stack, Input

These are generic/design-system-agnostic stubs. They are not library-aware (e.g., `Button` always renders with a fixed Tailwind style regardless of whether shadcn or MUI is active). D2C.3 replaces this ad-hoc stub block with a structured, library-aware shim registry.

---

## 2. Architecture Decision: Option A -- Component Shims

### Chosen approach

Lightweight render-compatible shims -- not the real library components, but visual approximations built with pure Tailwind/inline styles that produce the same DOM structure and prop API surface. Each shim is 10-40 lines of plain JavaScript (no JSX, no imports -- runs inside `new Function()` in the srcdoc).

### Why shims over real components

| Option | Verdict | Reason |
|--------|---------|--------|
| A: Shims | **Selected** | Zero dependencies, 100% offline, fast, ~2KB per library |
| B: Bundled runtime | Rejected | 500KB+ per library, complex version management, build system overhead |
| C: CDN + fallback | Rejected | Violates Commandment 4 (Local-First Only) on first load |
| D: Project-aware | Future enhancement | Good for v2 but does not help the zero-install case |

### Design principles for shims

1. **Recognizable, not pixel-perfect.** A Card shim looks like a card (rounded border, shadow, padding). It does not need to match shadcn's exact border-radius or color.
2. **Same prop API.** Shims accept the same props the real component does (`variant`, `size`, `className`, `children`, `asChild`, etc.) so generated code renders without errors.
3. **Tailwind-powered.** Shims use Tailwind utility classes (the Tailwind Play CDN is already loaded in srcdoc). Library-specific CSS variables are injected as a `<style>` block.
4. **No JSX.** Shims are plain JS using `React.createElement` -- they execute inside the srcdoc's global scope where React is a UMD global.
5. **Library CSS variables.** Each library shim set includes a `<style>` block that defines the library's CSS custom properties (e.g., `--background`, `--foreground` for shadcn) so token-based classes resolve.

### What "active library" means

The active library is read from `.flint/policy.json` (`selectedLibrary` field), set by `flint_set_library`. The renderer reads it via the existing `scope:get-active-library` IPC channel (already online in `useContextSync`). D2C.3 wires this value into `buildSrcdoc` so the correct shim set is injected.

---

## 3. Impact Map

### Files to CREATE

| File | Purpose | Owner |
|------|---------|-------|
| `src/preview-vendor/shims/shadcn.js` | 15 shadcn/ui component shims (Card, Button, Input, Label, Select, Tabs, Avatar, Badge, Separator, Textarea, Dialog, Sheet, Switch, Checkbox, Alert) | flint-design-engineer |
| `src/preview-vendor/shims/mui.js` | 12 MUI component shims (Button, Card, TextField, Typography, Box, Stack, Avatar, Chip, Divider, Alert, Switch, Select) | flint-design-engineer |
| `src/preview-vendor/shims/primeng.js` | 10 PrimeNG component shims (Button, Card, InputText, Dropdown, DataTable, Panel, Avatar, Badge, Divider, Message) | flint-design-engineer |
| `src/preview-vendor/shims/index.ts` | Shim registry: maps LibraryTarget to `{ shimSource: string, cssVars: string }` | flint-design-engineer |
| `src/preview-vendor/shims/__tests__/shimRegistry.test.ts` | Registry tests: each library returns valid JS, fallback returns empty, CSS vars are valid | flint-test-writer |
| `src/components/editor/__tests__/buildSrcdoc.test.ts` | Integration tests: shim injection produces valid HTML, library switch changes shims | flint-test-writer |

### Files to MODIFY

| File | What changes | Owner |
|------|-------------|-------|
| `src/components/editor/LivePreview.tsx` | (1) Import shim registry. (2) Read `selectedLibrary` from `useContextSync` or IPC. (3) Pass library to `buildSrcdoc`. (4) `buildSrcdoc` injects library shims + CSS vars instead of hardcoded stubs. (5) Move existing generic stubs into a `generic.js` shim file as the fallback. | flint-design-engineer |

### Files NOT changed (confirmed no-touch)

| File | Why |
|------|-----|
| `electron/main.ts` | No new IPC handlers needed -- `scope:get-active-library` already exists |
| `electron/preload.ts` | No new preload surface needed -- `scope.getActiveLibrary` already exposed |
| `electron/preview/viteServer.ts` | Vite path uses real components, no shims needed |
| `src/store/editorStore.ts` | No store changes |
| `src/store/canvasStore.ts` | No store changes |
| `src/hooks/useContextSync.ts` | Already reads `selectedLibrary` -- no changes |
| `flint-mcp/src/core/libraryAdapters/*` | Adapters are for token mapping, not preview rendering |

---

## 4. Type Contracts

### ShimRegistry (src/preview-vendor/shims/index.ts)

```typescript
/**
 * A library's preview shim bundle.
 * Both fields are raw JavaScript/CSS strings ready to inject into srcdoc.
 */
export interface LibraryShimBundle {
  /**
   * Plain JavaScript that assigns component functions to `window.*`.
   * Uses React.createElement (React is a UMD global in srcdoc).
   * Example: `window.Card = function({ className, children }) { ... }`
   */
  shimSource: string

  /**
   * CSS custom properties block defining the library's design variables.
   * Example: `:root { --background: 0 0% 100%; --foreground: 222.2 84% 4.9%; }`
   */
  cssVars: string

  /** Human-readable library name for debug/logging. */
  displayName: string

  /** Number of components shimmed. */
  componentCount: number
}

/**
 * Returns the shim bundle for a given library target.
 * Returns null if no shims exist for the library (falls back to generic stubs).
 */
export function getLibraryShims(library: string | null): LibraryShimBundle | null

/**
 * Returns the generic (library-agnostic) shim bundle.
 * This is the current set of stubs (Badge, Button, etc.) extracted from LivePreview.
 * Always available as the base layer; library shims are additive.
 */
export function getGenericShims(): LibraryShimBundle
```

### buildSrcdoc signature change

```typescript
// BEFORE (current):
function buildSrcdoc(js: string, tailwindConfigJson: string): string

// AFTER:
function buildSrcdoc(
  js: string,
  tailwindConfigJson: string,
  libraryShims: LibraryShimBundle | null,
): string
```

### LivePreview component: new state

```typescript
// Read the active library via IPC (same pattern as useContextSync)
const [activeLibrary, setActiveLibrary] = useState<string | null>(null)

useEffect(() => {
  window.flintAPI?.scope?.getActiveLibrary?.()
    .then((result) => setActiveLibrary(result.library))
    .catch(() => { /* non-fatal */ })
}, [/* re-read on workspace change */])
```

No new IPC channels. No new store slices. No new component props.

---

## 5. IPC Channels

No new IPC channels required. The existing `scope:get-active-library` channel (from Phase LIB.1) provides the active library selection. The shim registry is a pure renderer-side module -- no main-process involvement.

| Channel | Direction | Status |
|---------|-----------|--------|
| `scope:get-active-library` | renderer -> main -> renderer | Already ONLINE |

---

## 6. Store Contracts

No new store state. The active library is read via IPC as local component state in `LivePreview.tsx`, following the same pattern used by `ComponentScopePanel.tsx` (line 321) and `useContextSync.ts` (line 48).

---

## 7. Component Contracts

| Component | New State | Store Dependencies | IPC Calls |
|-----------|-----------|-------------------|-----------|
| `LivePreview` | `activeLibrary: string \| null` (local useState) | None new (existing: editorStore.rawCode, tokenStore.tokens, canvasStore.canvasMode) | `scope:get-active-library` (existing, on mount + workspace change) |

---

## 8. Shim Architecture Detail

### 8.1 File format

Each library shim file (`shadcn.js`, `mui.js`, `primeng.js`) is a plain `.js` file imported with `?raw` (Vite raw import, same pattern as `react.prod.js?raw`). The file content is a self-executing block that assigns component functions to `window.*`.

```javascript
// Example: src/preview-vendor/shims/shadcn.js (abbreviated)
// shadcn/ui component shims for Flint LivePreview
// These are visual approximations, not the real components.

window.Card = function Card({ className, children, ...rest }) {
  return React.createElement('div', {
    className: 'rounded-xl border bg-card text-card-foreground shadow ' + (className || ''),
    ...rest
  }, children);
};

window.CardHeader = function CardHeader({ className, children }) {
  return React.createElement('div', {
    className: 'flex flex-col space-y-1.5 p-6 ' + (className || ''),
  }, children);
};

// ... etc for each component
```

### 8.2 CSS variables injection

Each library shim bundle includes a CSS variables string. For shadcn, this maps to the standard shadcn CSS variable names with neutral theme defaults:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... */
  --radius: 0.5rem;
}
```

These are injected as a `<style>` block in the srcdoc `<head>`, after Tailwind CDN but before the component code. This means shadcn shims can use classes like `bg-card`, `text-foreground`, etc. and they resolve to the correct CSS custom properties.

When design tokens exist in `tokenStore`, the Tailwind config JSON already overrides these colors. The CSS variables layer provides the baseline; the Tailwind config provides project-specific overrides.

### 8.3 Injection order in buildSrcdoc

```
<head>
  1. React UMD
  2. ReactDOM UMD
  3. Tailwind CDN
  4. Tailwind config (token-derived)
  5. Library CSS variables <style> block     <-- NEW
  6. Base styles (box-sizing, body, flint-selected, etc.)
</head>
<body>
  <div id="root"></div>
  7. Code payload (JSON-encoded)
  8. React named exports as globals
  9. Generic stubs (always loaded as base)    <-- EXTRACTED from current inline
  10. Library-specific shims                   <-- NEW
  11. Execution script (new Function, render)
  12. Flint interaction proxy script
</body>
```

The generic stubs (step 9) always load as a base layer. Library-specific shims (step 10) override any generic stubs that share the same name (e.g., library `Button` overwrites generic `Button`). This means:

- **No library selected**: Generic stubs render (current behavior preserved exactly).
- **shadcn selected**: Generic stubs load first, then shadcn shims override `Button`, `Badge`, `Input`, and add `Card`, `CardHeader`, `Select`, etc.
- **Unknown library**: Falls back to generic stubs only.

### 8.4 Shadcn component shim list (15 components)

These are the most commonly generated components from `flint_design_to_code` output and shadcn usage patterns:

| Component | Props | Visual approximation |
|-----------|-------|---------------------|
| `Card` | className, children | Rounded border, shadow, `bg-card` |
| `CardHeader` | className, children | Flex col, p-6, space-y-1.5 |
| `CardTitle` | className, children | text-lg font-semibold |
| `CardDescription` | className, children | text-sm text-muted-foreground |
| `CardContent` | className, children | p-6 pt-0 |
| `CardFooter` | className, children | flex items-center p-6 pt-0 |
| `Button` | variant, size, className, children, asChild, disabled | 6 variants (default, destructive, outline, secondary, ghost, link) |
| `Input` | type, placeholder, className, disabled | Rounded border input field |
| `Label` | className, children, htmlFor | text-sm font-medium |
| `Textarea` | placeholder, className, disabled | Rounded border textarea |
| `Badge` | variant, className, children | Inline pill, 4 variants |
| `Avatar` / `AvatarImage` / `AvatarFallback` | src, alt, className, children | Rounded circle with fallback initials |
| `Separator` | orientation, className | hr-like divider, horizontal/vertical |
| `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` / `SelectValue` | value, placeholder, children, className | Styled select with chevron |
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | value, defaultValue, children, className | Tab bar with active indicator |
| `Switch` | checked, onCheckedChange, className | Toggle switch |
| `Checkbox` | checked, onCheckedChange, className | Checkbox with check mark |
| `Alert` / `AlertTitle` / `AlertDescription` | variant, className, children | Bordered alert box |

### 8.5 MUI component shim list (12 components)

| Component | Visual approximation |
|-----------|---------------------|
| `Button` | Material ripple-free button, 3 variants (contained, outlined, text) |
| `Card` / `CardContent` / `CardActions` | Elevated surface with shadow |
| `TextField` | Outlined input with floating label |
| `Typography` | Text with variant prop (h1-h6, body1, body2, caption) |
| `Box` | Styled div (sx prop mapped to style) |
| `Stack` | Flex container with direction + spacing |
| `Avatar` | Circular avatar with fallback |
| `Chip` | Rounded pill with optional delete icon |
| `Divider` | Horizontal rule |
| `Alert` | Colored alert box with severity variants |
| `Switch` | iOS-style toggle |
| `Select` / `MenuItem` | Dropdown select |

### 8.6 PrimeNG component shim list (10 components)

| Component | Visual approximation |
|-----------|---------------------|
| `Button` | PrimeNG button with label + icon props |
| `Card` | Surface panel with header/content/footer slots |
| `InputText` | Styled text input |
| `Dropdown` | Select dropdown with placeholder |
| `DataTable` / `Column` | Basic table with headers |
| `Panel` | Collapsible section with header |
| `Avatar` | Circular/square avatar |
| `Badge` | Notification badge |
| `Divider` | Section divider |
| `Message` | Severity-colored message box |

---

## 9. Commandment Checklist

| # | Commandment | Applies | How satisfied |
|---|------------|---------|---------------|
| 1 | Code is Truth | No | Shims are runtime-only preview aids, not persisted mutations |
| 2 | No Hallucinated Styling | Yes | Shim CSS variables are derived from the library's actual default theme (verified against shadcn source, MUI defaults, PrimeNG Aura) |
| 4 | Local-First Only | **Yes** | All shim source is bundled locally via `?raw` imports. Zero network dependency. Zero CDN. |
| 7 | ID Preservation | No | Shims do not modify the AST |
| 9 | CIEDE2000 | Informational | Shim colors approximate library defaults but are not subject to drift detection (shims are not design tokens) |
| 12 | Atomic Queuing | No | No file writes involved |
| 13 | Deterministic Surgery | No | No AST modification |

---

## 10. Implementation Order

### Phase 2a: Shim Files (flint-design-engineer) -- parallelizable

Create the four shim files. No dependencies on other work.

1. Extract existing generic stubs from `LivePreview.tsx` lines 108-177 into `src/preview-vendor/shims/generic.js`
2. Write `src/preview-vendor/shims/shadcn.js` -- 15 components + CSS vars
3. Write `src/preview-vendor/shims/mui.js` -- 12 components + CSS vars
4. Write `src/preview-vendor/shims/primeng.js` -- 10 components + CSS vars
5. Write `src/preview-vendor/shims/index.ts` -- registry with `getLibraryShims()` and `getGenericShims()`

### Phase 2b: LivePreview Integration (flint-design-engineer) -- depends on 2a

Wire shims into the preview pipeline.

1. In `LivePreview.tsx`: add `activeLibrary` local state via `scope:get-active-library` IPC
2. Import `getLibraryShims, getGenericShims` from shim registry
3. Modify `buildSrcdoc` signature to accept `LibraryShimBundle | null`
4. Replace the inline stubs block (lines 108-177) with generic shims injection
5. Add library shims injection after generic shims
6. Add library CSS variables `<style>` block injection in `<head>`
7. Verify `buildHtmlSrcdoc` does NOT need shims (HTML files are static, no component resolution)

### Phase 2c: Tests (flint-test-writer) -- parallelizable with 2b

1. Write `src/preview-vendor/shims/__tests__/shimRegistry.test.ts`:
   - `getLibraryShims('shadcn')` returns non-null bundle with componentCount >= 15
   - `getLibraryShims('mui')` returns non-null bundle with componentCount >= 12
   - `getLibraryShims('primeng')` returns non-null bundle with componentCount >= 10
   - `getLibraryShims('tailwind')` returns null (Tailwind has no components to shim)
   - `getLibraryShims(null)` returns null
   - `getLibraryShims('unknown-lib')` returns null
   - `getGenericShims()` returns non-null bundle with componentCount >= 9
   - Each shim source string contains `window.` assignments (basic JS validity check)
   - Each CSS vars string contains `:root` (or is empty for libs without CSS vars)

2. Write `src/components/editor/__tests__/buildSrcdoc.test.ts`:
   - `buildSrcdoc(code, config, null)` produces HTML containing generic stubs (Badge, Button, etc.)
   - `buildSrcdoc(code, config, shadcnBundle)` produces HTML containing shadcn stubs (Card, CardHeader, etc.)
   - `buildSrcdoc(code, config, shadcnBundle)` produces HTML with shadcn CSS variables in `<head>`
   - Library shim `<script>` appears AFTER generic shim `<script>` (override order)
   - CSS variables `<style>` appears AFTER Tailwind config `<script>` (override order)

### Phase 2 parallelism

```
2a (shim files)  ------>|
                         |---> 2b (LivePreview wiring)
2c (tests)       ------>|
```

2a and 2c can start simultaneously (tests can be written against the contract types before shim files exist). 2b depends on 2a completing.

### Phase 3: Integration Validation (flint-integration-validator)

1. TSC: `npx tsc --noEmit` -- 0 errors
2. React tests: `npm run test:react` -- all passing
3. Manual verification: open Flint Glass, load demo, confirm generic stubs render; set library to shadcn via MCP, confirm shadcn Card/Button/etc. render in preview
4. Regression check: existing 9 stubs still render when no library is selected

---

## 11. Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Shim prop API diverges from real component API, causing generated code to error | Medium | -- | Shims accept `...rest` spread and pass through unknown props silently. Generated code always renders, even if a prop is unused. |
| Shim visual appearance misleads the designer into thinking the preview is pixel-accurate | Low | -- | Badge in preview toolbar: "Preview (approximate)" when shims are active. Or: no badge needed if the Vite path already gives pixel-perfect rendering for real projects. |
| Tailwind Play CDN class resolution conflicts with library CSS variables | Low | 4 | CSS variables are injected after Tailwind config. Tailwind's `bg-card` utility resolves to `var(--card)` which the CSS variables define. This is the documented shadcn pattern. |
| Import stripping in the Babel transform removes library imports, but shims use `window.*` globals | None | -- | The current architecture already strips all imports and relies on globals. Shims follow this exact pattern. No change needed. |
| Library updates add new components that shims don't cover | Low | -- | Unshimmed components render as `undefined` (React silently skips). The user sees nothing rather than an error. Future shim updates add coverage incrementally. |
| Large shim file size bloats the srcdoc | Low | 4 | Each library is ~2-4KB of JS (plain createElement calls). Total overhead: ~10KB across all libraries, but only one library is injected at a time. Negligible compared to React UMD (80KB) + Tailwind CDN (100KB+). |

---

## 12. Future: Option D Enhancement (v2)

After D2C.3 ships, a future phase can add project-aware preview detection:

1. On `scope:get-active-library`, also check if the user's project has `node_modules/@shadcn/ui` (or `@mui/material`, etc.)
2. If the real library is installed AND the Vite server is running: use the Vite path (already pixel-perfect)
3. If the real library is NOT installed (or no project is open): use shims (D2C.3)

This is an optimization, not a prerequisite. D2C.3's shim approach works in all cases and degrades gracefully.

---

## 13. Acceptance Criteria

1. With no library selected: existing generic stubs render (Badge, Button, etc.) -- no regression
2. With `selectedLibrary: 'shadcn'`: all 15 shadcn shims render. `<Card>` shows a rounded bordered container. `<Button variant="destructive">` shows a red button.
3. With `selectedLibrary: 'mui'`: all 12 MUI shims render. `<TextField label="Name">` shows a labeled input.
4. With `selectedLibrary: 'primeng'`: all 10 PrimeNG shims render. `<Button label="Click">` shows a labeled button.
5. Switching libraries via `flint_set_library` updates the preview on next code change
6. The Vite preview path (project mode) is unaffected -- no shims injected when `previewUrl != null`
7. All tests pass. TSC 0 errors.
