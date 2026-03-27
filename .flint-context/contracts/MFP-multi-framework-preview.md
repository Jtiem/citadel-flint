# Contract: MFP — Multi-Framework Preview

> Phase MFP extends Flint Glass's LivePreview to render Vue 3 SFCs, Svelte components, and raw HTML in the same sandboxed iframe, all 100% offline.

---

## 1. Architecture Decisions

### 1.1 Where Framework Runtimes Live

All framework runtimes are vendored as static JS files in `src/preview-vendor/`, matching the existing pattern for React UMD (`react.prod.js`, `react-dom.prod.js`) and Tailwind CDN (`tailwind-cdn.js`). Each runtime file is imported with `?raw` at build time and inlined into the srcdoc string. No CDN, no network requests.

| Framework | Runtime File | Approx Size | Notes |
|-----------|-------------|-------------|-------|
| React | `react.prod.js` + `react-dom.prod.js` | ~130KB | Already vendored |
| Vue 3 | `vue.global.prod.js` | ~130KB | Vue 3.x UMD production build |
| Svelte | None at runtime | 0KB | Svelte compiles to vanilla JS; no runtime needed in iframe |
| HTML | None | 0KB | Rendered directly |

**Rationale**: Commandment 4 (Local-First Only) forbids external URLs. The existing React vendoring pattern is proven and well-understood. Vue's UMD build is self-contained. Svelte uniquely compiles away its framework, so the iframe receives only vanilla JS + DOM API calls.

**Existing Commandment 4 violation found**: `buildHtmlSrcdoc()` at line 331 references `https://cdn.tailwindcss.com`. This must be fixed as part of MFP.1 to use the already-vendored `tailwind-cdn.js` instead. This is a pre-existing bug, not a new regression.

### 1.2 Where Compilation Happens

Compilation of non-React frameworks happens in the **Electron main process** via new IPC channels, matching the existing `code:transform` pattern for React/Babel. This satisfies Commandment 9 (Process Boundary): Node.js compiler APIs cannot run in the sandboxed renderer.

| Framework | Compiler | IPC Channel | Runs In |
|-----------|---------|-------------|---------|
| React (TSX/JSX) | `@babel/core` + plugins | `code:transform` (existing) | Electron main |
| Vue 3 (.vue) | `@vue/compiler-sfc` + `@vue/compiler-dom` | `code:transform-vue` (new) | Electron main |
| Svelte (.svelte) | `svelte/compiler` | `code:transform-svelte` (new) | Electron main |
| HTML (.html) | None (passthrough) | None (renderer-side) | Renderer |

**Why not a generic `code:transform` with a framework hint?** The existing `code:transform` handler has React-specific Babel plugin configuration, import stripping, and `export default` rewriting baked in. Adding framework branching would bloat that handler and make it harder to test. Separate channels keep each transform pipeline isolated, testable, and independently deployable. The renderer dispatch logic in `LivePreview.tsx` already branches by file extension, so adding two more branches is trivial.

### 1.3 Compilation Strategies

**Vue 3**: The `@vue/compiler-sfc` package parses the SFC into `<template>`, `<script>`, `<style>` blocks. The `<template>` is compiled to a render function via `@vue/compiler-dom`. The `<script setup>` or `<script>` block is concatenated. The result is a self-contained JS module that, when executed with Vue 3's UMD global available, mounts the component. Import statements are stripped (Vue is a UMD global). The `<style>` block's CSS is returned separately and injected into a `<style>` tag in the srcdoc.

**Svelte**: The `svelte/compiler` compiles a `.svelte` file into vanilla JS + CSS. The compiler runs in `generate: 'client'` mode (Svelte 5) or `generate: 'dom'` mode (Svelte 4). The output JS creates and mounts a component using only DOM APIs -- no Svelte runtime needed in the iframe. CSS is returned separately. Import statements are stripped. The component is instantiated via `new Component({ target: document.getElementById('root') })`.

**HTML**: Unchanged. The `HtmlAdapter` injects `data-flint-id` attributes and the HTML is wrapped in `buildHtmlSrcdoc()`. The only change is fixing the Tailwind CDN URL to use the vendored `tailwind-cdn.js`.

### 1.4 Preview Dispatch Architecture

The current dispatch in `LivePreview.tsx` (line ~579) is:

```
if (activeFilePath.endsWith('.html')) -> buildHtmlSrcdoc()
else -> React path (code:transform IPC -> buildSrcdoc())
```

The new dispatch uses a `PreviewStrategy` pattern. This is NOT added to `IFlintAdapter` because preview rendering is a UI concern, not an AST concern. Instead, a standalone dispatch function routes by file extension:

```
.html           -> HTML path (renderer-side, no IPC)
.vue            -> Vue path (code:transform-vue IPC -> buildVueSrcdoc())
.svelte         -> Svelte path (code:transform-svelte IPC -> buildSvelteSrcdoc())
.tsx/.ts/.jsx/.js -> React path (code:transform IPC -> buildSrcdoc())
```

### 1.5 IFlintAdapter: No Changes

`IFlintAdapter` is NOT modified. The interface is an AST surgery contract (parse, generate, mutate, undo). Preview rendering is orthogonal -- it consumes the adapter's output (source code) but handles compilation and srcdoc assembly separately. A new `SvelteAdapter` implementing `IFlintAdapter` will be created in a future phase (MFP.5, not part of this contract) for AST editing support. MFP.2-3 focus exclusively on preview rendering.

### 1.6 Interaction Proxy Script Consolidation

Both `buildSrcdoc()` (React, lines 147-311) and `buildHtmlSrcdoc()` (HTML, lines 346-406) contain duplicate copies of the Flint interaction proxy script (click-to-select, hover, drag, ghost proxy). This interaction script is framework-agnostic -- it only uses `data-flint-id` attributes and DOM APIs.

MFP.1 extracts this script into a shared constant `FLINT_INTERACTION_SCRIPT` that all four srcdoc builders reference. This eliminates 260+ lines of duplication and ensures future bug fixes apply to all frameworks simultaneously.

---

## 2. Impact Map

| File | Change Type | Owner Agent |
|------|------------|-------------|
| `src/components/editor/LivePreview.tsx` | MODIFY — extract interaction script, add dispatch routing, add `buildVueSrcdoc()` and `buildSvelteSrcdoc()` builders | flint-design-engineer |
| `src/preview-vendor/vue.global.prod.js` | NEW FILE — Vue 3 UMD production build (~130KB) | flint-electron-ipc |
| `src/preview-vendor/flint-interaction.ts` | NEW FILE — extracted interaction proxy script constant | flint-design-engineer |
| `electron/main.ts` | MODIFY — add `code:transform-vue` and `code:transform-svelte` IPC handlers | flint-electron-ipc |
| `electron/preload.ts` | MODIFY — expose `transformVue` and `transformSvelte` on `window.flintAPI` | flint-electron-ipc |
| `src/core/adapters/SvelteAdapter.ts` | NEW FILE — stub `IFlintAdapter` for `.svelte` extension registration (parse-only, mutations deferred to MFP.5) | flint-ast-surgeon |
| `src/App.tsx` | MODIFY — register SvelteAdapter for `.svelte` extension | flint-state-architect |
| `electron/main.ts` (test) | MODIFY — add tests for `code:transform-vue` and `code:transform-svelte` handlers | flint-test-writer |
| `src/components/editor/__tests__/LivePreview.vue.test.tsx` | NEW FILE — Vue preview rendering tests | flint-test-writer |
| `src/components/editor/__tests__/LivePreview.svelte.test.tsx` | NEW FILE — Svelte preview rendering tests | flint-test-writer |
| `src/preview-vendor/__tests__/interaction-script.test.ts` | NEW FILE — interaction script extraction tests | flint-test-writer |

---

## 3. Type Contracts

### 3.1 IPC Payload Types

```typescript
// ── Vue Transform ────────────────────────────────────────────────────────────

/** Sent from renderer to main via 'code:transform-vue' */
interface VueTransformPayload {
  /** Raw .vue SFC source code */
  code: string;
}

/** Returned from main to renderer */
interface VueTransformResult {
  /** Compiled JS ready to execute in iframe with Vue UMD global. Null on error. */
  js: string | null;
  /** Extracted <style> block CSS. Empty string if no styles. */
  css: string;
  /** Human-readable error message. Null on success. */
  error: string | null;
}

// ── Svelte Transform ─────────────────────────────────────────────────────────

/** Sent from renderer to main via 'code:transform-svelte' */
interface SvelteTransformPayload {
  /** Raw .svelte source code */
  code: string;
}

/** Returned from main to renderer */
interface SvelteTransformResult {
  /** Compiled vanilla JS. Null on error. */
  js: string | null;
  /** Extracted CSS from <style> block. Empty string if no styles. */
  css: string;
  /** Human-readable error message. Null on success. */
  error: string | null;
}
```

### 3.2 Interaction Script Type

```typescript
// src/preview-vendor/flint-interaction.ts

/**
 * Framework-agnostic interaction proxy script.
 * Handles: click-to-select, hover, drag-start, drag-move, drag-end,
 * ghost proxy, highlight, interact mode toggle.
 *
 * Depends only on `data-flint-id` attributes being present on DOM elements.
 * Must be injected as the LAST <script> in every srcdoc document.
 */
export const FLINT_INTERACTION_SCRIPT: string;

/**
 * Framework-agnostic Flint selection/drag CSS classes.
 * Must be injected into <head> of every srcdoc document.
 */
export const FLINT_INTERACTION_STYLES: string;
```

### 3.3 Srcdoc Builder Signatures

```typescript
// All builders live in LivePreview.tsx (or a co-located module if refactored)

/** Existing React builder — signature unchanged */
function buildSrcdoc(
  js: string,
  tailwindConfigJson: string,
  libraryShims: LibraryShimBundle | null,
): string;

/** Existing HTML builder — fix CDN URL, use shared interaction script */
function buildHtmlSrcdoc(
  htmlCode: string,
  tailwindConfigJson: string,
): string;

/** NEW: Vue srcdoc builder */
function buildVueSrcdoc(
  js: string,
  css: string,
  tailwindConfigJson: string,
): string;

/** NEW: Svelte srcdoc builder */
function buildSvelteSrcdoc(
  js: string,
  css: string,
  tailwindConfigJson: string,
): string;
```

### 3.4 SvelteAdapter Stub

```typescript
// src/core/adapters/SvelteAdapter.ts

import type { IFlintAdapter } from './types';
import type { ASTMutation, InverseMutation } from '../ASTService';
import type { VisualLayer } from '../ast-parser';

/**
 * Stub adapter for Svelte (.svelte) files.
 * MFP.2-3 focuses on preview only. Full AST mutation support
 * is deferred to MFP.5.
 *
 * parse() extracts the markup section for Flint ID injection.
 * All mutation methods return no-ops or snapshot-based inversions.
 */
export class SvelteAdapter implements IFlintAdapter {
  parse(code: string): unknown | null;
  generate(ast: unknown): string;
  buildVisualTree(ast: unknown): VisualLayer[];
  injectFlintIds(ast: unknown): unknown;
  applyMutationBatch(code: string, mutations: ASTMutation[]): { code: string; inversions: InverseMutation[] };
  nodeExists(code: string, flintId: string): boolean;
  validateInMemory(code: string): string | null;
  extractNode(ast: unknown, nodeId: string): unknown | null;
  transplantNode(liveAst: unknown, historicAst: unknown, nodeId: string): void;
}

export const svelteAdapter: SvelteAdapter;
```

---

## 4. IPC Channels

| Channel | Direction | Payload | Return | Handler Location |
|---------|-----------|---------|--------|-----------------|
| `code:transform` | renderer -> main | `string` (TSX source) | `{ js: string \| null; error: string \| null }` | `electron/main.ts` (existing) |
| `code:transform-vue` | renderer -> main | `string` (.vue SFC source) | `VueTransformResult` | `electron/main.ts` (new) |
| `code:transform-svelte` | renderer -> main | `string` (.svelte source) | `SvelteTransformResult` | `electron/main.ts` (new) |

### preload.ts Surface Additions

```typescript
// Added to window.flintAPI in contextBridge.exposeInMainWorld:
transformVue: (code: string): Promise<VueTransformResult> =>
    ipcRenderer.invoke('code:transform-vue', code),

transformSvelte: (code: string): Promise<SvelteTransformResult> =>
    ipcRenderer.invoke('code:transform-svelte', code),
```

---

## 5. Store Contracts

No store changes required. The preview dispatch is local component state within `LivePreview.tsx`. The `LanguageRegistry` gains a `.svelte` registration in `App.tsx`, but the registry itself is unchanged.

| Store | New State | New Actions | New Selectors |
|-------|-----------|-------------|---------------|
| None | -- | -- | -- |

---

## 6. Component Contracts

| Component | Props | Consumes Store | Emits IPC |
|-----------|-------|---------------|-----------|
| `LivePreview` (modified) | unchanged | `editorStore.rawCode`, `canvasStore.activeFilePath` | `code:transform` (existing), `code:transform-vue` (new), `code:transform-svelte` (new) |

---

## 7. Commandment Checklist

- [x] **C4 Local-First Only** — All framework runtimes vendored in `src/preview-vendor/`. No CDN URLs. Fixes existing `buildHtmlSrcdoc` CDN violation.
- [x] **C7 ID Preservation** — `data-flint-id` injection continues to happen in the renderer before IPC (React path uses `injectFlintIds` from `ast-parser.ts`; HTML uses `HtmlAdapter.injectFlintIds()`; Vue uses `VueAdapter.injectFlintIdsIntoSource()`; Svelte uses a regex-safe attribute injection on the markup section before compilation).
- [x] **C9 Process Boundary (CIEDE2000 is C9 in the numbered list, but Process Boundary is the relevant law here)** — All compiler packages (`@vue/compiler-sfc`, `svelte/compiler`) run exclusively in the Electron main process. The renderer never imports them.
- [x] **C12 Atomic Queuing** — No file writes involved. Preview is read-only rendering. Not applicable.
- [x] **C13 Deterministic Surgery** — React AST operations remain Babel-based. Vue mutations use `@vue/compiler-sfc` (existing `VueAdapter`). Svelte mutations deferred to MFP.5. No regex-based source modification for AST ops.
- [x] **SEC.1 Renderer Hardening** — All preview content rendered in sandboxed `srcdoc` iframe. No changes to sandbox policy.
- [x] **C16 In-Memory Validation** — `validateInMemory()` stubs return null for Vue and Svelte adapters (matching existing pattern). Full validation deferred to LSP integration (Phase N.3).

---

## 8. Implementation Phases

### MFP.1: Preview Strategy Refactor + Interaction Script Extraction

**Value**: Eliminates 260+ lines of duplicated interaction proxy code. Creates the dispatch architecture that MFP.2 and MFP.3 plug into. Fixes existing C4 violation in `buildHtmlSrcdoc`.

**Scope**:
1. Extract the Flint interaction proxy script from `buildSrcdoc()` (lines 147-311) into `src/preview-vendor/flint-interaction.ts` as `FLINT_INTERACTION_SCRIPT` and `FLINT_INTERACTION_STYLES`.
2. Refactor `buildSrcdoc()` to reference the shared constants instead of inlining the script.
3. Refactor `buildHtmlSrcdoc()` to reference the shared constants AND replace the `cdn.tailwindcss.com` URL with the vendored `tailwind-cdn.js` import.
4. Add file-extension dispatch logic in the `useEffect` at line ~579:
   - `.html` -> HTML path (existing, now using shared interaction script)
   - `.vue` -> placeholder that shows "Vue preview: install MFP.2" message
   - `.svelte` -> placeholder that shows "Svelte preview: install MFP.3" message
   - everything else -> React path (existing, now using shared interaction script)
5. Write tests for the interaction script extraction (ensure no behavioral regression in existing React and HTML paths).

**Owner agents**: `flint-design-engineer` (refactor), `flint-test-writer` (tests)

**Dependencies**: None. Can start immediately.

### MFP.2: Vue Preview

**Value**: Vue 3 SFC files render in the Flint Glass preview with full Tailwind styling and Flint interaction (click-to-select, hover, drag).

**Scope**:
1. Vendor `vue.global.prod.js` (Vue 3.x production UMD) into `src/preview-vendor/`.
2. Add `code:transform-vue` IPC handler in `electron/main.ts`:
   - Parse SFC with `@vue/compiler-sfc`.parse()
   - Compile `<template>` with `@vue/compiler-dom`.compile() to render function
   - Extract `<script setup>` or `<script>` block
   - Extract `<style>` block CSS
   - Assemble JS: import bindings from Vue global, render function, script block, mount call
   - Strip import statements
   - Return `{ js, css, error }`
3. Add `transformVue` to `electron/preload.ts` contextBridge surface.
4. Implement `buildVueSrcdoc()` in `LivePreview.tsx`:
   - Inlines vendored Vue 3 UMD (`vue.global.prod.js`)
   - Inlines vendored Tailwind CDN
   - Injects Tailwind config from token store
   - Inlines the compiled JS via JSON-safe embedding (same pattern as React)
   - Inlines extracted CSS in a `<style>` tag
   - Appends the shared `FLINT_INTERACTION_SCRIPT`
   - Mounts the component via `Vue.createApp(Component).mount('#root')`
5. Wire the `.vue` dispatch branch in `LivePreview.tsx`:
   - Call `VueAdapter.injectFlintIdsIntoSource()` on `previewCode` before IPC
   - Send to `code:transform-vue` IPC
   - On success: set `iframeRef.current.srcdoc = buildVueSrcdoc(js, css, tailwindConfigJson)`
6. Write tests: IPC handler unit tests, srcdoc builder tests, integration test with a sample Vue SFC.

**Owner agents**: `flint-electron-ipc` (IPC handler + preload), `flint-design-engineer` (srcdoc builder + dispatch), `flint-test-writer` (tests)

**Dependencies**: MFP.1 (shared interaction script must exist).

**New npm dependency**: `@vue/compiler-sfc` (devDependency, Electron main process only).

### MFP.3: Svelte Preview

**Value**: Svelte components render in the Flint Glass preview with full Tailwind styling and Flint interaction.

**Scope**:
1. Add `code:transform-svelte` IPC handler in `electron/main.ts`:
   - Compile with `svelte/compiler`.compile() in `generate: 'client'` mode (Svelte 5) or `generate: 'dom'` mode (Svelte 4, fallback)
   - The compiler output is self-contained vanilla JS -- no runtime dependency
   - Extract CSS from `result.css.code`
   - Strip import statements
   - Rewrite the compiled output to assign the component constructor to `window.__SvelteComponent`
   - Return `{ js, css, error }`
2. Add `transformSvelte` to `electron/preload.ts` contextBridge surface.
3. Implement `buildSvelteSrcdoc()` in `LivePreview.tsx`:
   - NO framework runtime needed (Svelte compiles to vanilla JS)
   - Inlines vendored Tailwind CDN
   - Injects Tailwind config from token store
   - Inlines the compiled JS via JSON-safe embedding
   - Inlines extracted CSS in a `<style>` tag
   - Appends the shared `FLINT_INTERACTION_SCRIPT`
   - Mounts via `new window.__SvelteComponent({ target: document.getElementById('root') })`
4. Create `src/core/adapters/SvelteAdapter.ts` -- stub implementation:
   - `parse()`: Splits the `.svelte` source into markup/script/style sections using simple section extraction (no full compiler needed in renderer)
   - `injectFlintIds()`: Injects `data-flint-id` attributes into the markup section using the `rehype` parser (same as `HtmlAdapter`, since Svelte markup is HTML-superset)
   - `buildVisualTree()`: Walks the parsed markup to produce `VisualLayer[]`
   - All mutation methods: Return snapshot-based inversions (`{ op: 'restoreCode', code }`)
   - `nodeExists()`: Uses rehype to check for `data-flint-id` in markup section
5. Register `SvelteAdapter` for `.svelte` in `src/App.tsx`.
6. Wire the `.svelte` dispatch branch in `LivePreview.tsx`:
   - Call `svelteAdapter.injectFlintIds()` on parsed markup before IPC
   - Send to `code:transform-svelte` IPC
   - On success: set `iframeRef.current.srcdoc = buildSvelteSrcdoc(js, css, tailwindConfigJson)`
7. Write tests: IPC handler unit tests, SvelteAdapter unit tests, srcdoc builder tests, integration test with a sample Svelte component.

**Owner agents**: `flint-electron-ipc` (IPC handler + preload), `flint-ast-surgeon` (SvelteAdapter), `flint-design-engineer` (srcdoc builder + dispatch), `flint-state-architect` (App.tsx registration), `flint-test-writer` (tests)

**Dependencies**: MFP.1 (shared interaction script must exist). Can run in parallel with MFP.2.

**New npm dependency**: `svelte` (devDependency, Electron main process only -- the compiler is part of the main svelte package).

### MFP.4: Angular Preview — Explicitly NOT Supported

**Rationale**: Angular requires a full build toolchain (Angular CLI / esbuild) with a complex compilation model (ahead-of-time compilation, dependency injection, zone.js runtime, decorator metadata). The minimal offline compilation path for an Angular component is:

1. Angular compiler (`@angular/compiler`) -- ~500KB
2. Zone.js runtime -- ~40KB
3. Angular core runtime (`@angular/core`) -- ~300KB
4. TypeScript decorators transformation
5. Angular-specific module resolution

This is a fundamentally different complexity class from Vue (single compiler, 130KB runtime) or Svelte (compiler-only, 0KB runtime). The cost-benefit ratio does not justify the engineering investment for MFP.

**Decision**: Angular files (`.component.ts`) are not supported for preview. If a user opens an Angular file, the preview pane shows a clear informational message: "Angular components are not supported for live preview. Use `ng serve` in your terminal for Angular development." This is an honest constraint, not a bug.

If user demand proves otherwise (Gate 5 of the Feature Budget Framework: "Can we validate without building it?"), Angular support can be scoped as a separate phase (MFP.6) after gathering signal.

---

## 9. Dependency Budget

| Package | Version | Size (installed) | Used In | Justification |
|---------|---------|-----------------|---------|--------------|
| `@vue/compiler-sfc` | ^3.5.x | ~650KB | Electron main only | Required for Vue SFC compilation. Includes `@vue/compiler-dom` and `@vue/compiler-core` (already in `node_modules` for the VueAdapter). |
| `svelte` | ^5.x | ~1.2MB | Electron main only | Required for Svelte compilation. The compiler is bundled within the main `svelte` package. |
| `vue` (UMD build) | 3.5.x | ~130KB (vendored) | `src/preview-vendor/vue.global.prod.js` | Runtime for Vue components in iframe. Vendored, not installed via npm. |

**Total new npm dependency weight**: ~1.85MB (devDependencies only, Electron main process only, never shipped to renderer bundle).

**Note**: `@vue/compiler-sfc` and `@vue/compiler-core` are already in `node_modules` as transitive dependencies of the existing `VueAdapter.ts`. The only truly new dependency is `svelte`.

---

## 10. Test Plan

### MFP.1 Tests

| Test | Type | File |
|------|------|------|
| `FLINT_INTERACTION_SCRIPT` contains all required message handlers (HIGHLIGHT, HOVER, DRAG_MOVE, etc.) | Unit | `src/preview-vendor/__tests__/interaction-script.test.ts` |
| `FLINT_INTERACTION_STYLES` contains all required CSS classes (.flint-selected, .flint-hovered, etc.) | Unit | `src/preview-vendor/__tests__/interaction-script.test.ts` |
| `buildSrcdoc()` output includes the shared interaction script (no inline duplication) | Unit | `src/components/editor/__tests__/LivePreview.test.tsx` |
| `buildHtmlSrcdoc()` does NOT contain `cdn.tailwindcss.com` | Unit | `src/components/editor/__tests__/LivePreview.test.tsx` |
| `buildHtmlSrcdoc()` output includes vendored Tailwind CDN | Unit | `src/components/editor/__tests__/LivePreview.test.tsx` |
| React preview still works end-to-end after refactor (regression) | Integration | `src/components/editor/__tests__/LivePreview.test.tsx` |
| HTML preview still works end-to-end after refactor (regression) | Integration | `src/components/editor/__tests__/LivePreview.test.tsx` |

### MFP.2 Tests

| Test | Type | File |
|------|------|------|
| `code:transform-vue` returns valid JS for a simple SFC | Unit | `electron/__tests__/vueTransform.test.ts` |
| `code:transform-vue` returns error for malformed SFC | Unit | `electron/__tests__/vueTransform.test.ts` |
| `code:transform-vue` extracts `<style>` block CSS | Unit | `electron/__tests__/vueTransform.test.ts` |
| `code:transform-vue` handles `<script setup>` syntax | Unit | `electron/__tests__/vueTransform.test.ts` |
| `code:transform-vue` strips import statements | Unit | `electron/__tests__/vueTransform.test.ts` |
| `code:transform-vue` rejects non-string input | Unit | `electron/__tests__/vueTransform.test.ts` |
| `buildVueSrcdoc()` contains Vue UMD runtime | Unit | `src/components/editor/__tests__/LivePreview.vue.test.tsx` |
| `buildVueSrcdoc()` contains Tailwind CDN + config | Unit | `src/components/editor/__tests__/LivePreview.vue.test.tsx` |
| `buildVueSrcdoc()` contains interaction script | Unit | `src/components/editor/__tests__/LivePreview.vue.test.tsx` |
| `buildVueSrcdoc()` injects CSS in `<style>` tag | Unit | `src/components/editor/__tests__/LivePreview.vue.test.tsx` |
| `.vue` file triggers Vue preview path (dispatch) | Integration | `src/components/editor/__tests__/LivePreview.vue.test.tsx` |

### MFP.3 Tests

| Test | Type | File |
|------|------|------|
| `code:transform-svelte` returns valid JS for a simple component | Unit | `electron/__tests__/svelteTransform.test.ts` |
| `code:transform-svelte` returns error for malformed input | Unit | `electron/__tests__/svelteTransform.test.ts` |
| `code:transform-svelte` extracts CSS | Unit | `electron/__tests__/svelteTransform.test.ts` |
| `code:transform-svelte` output contains no Svelte runtime imports | Unit | `electron/__tests__/svelteTransform.test.ts` |
| `code:transform-svelte` rejects non-string input | Unit | `electron/__tests__/svelteTransform.test.ts` |
| `SvelteAdapter.parse()` returns non-null for valid `.svelte` | Unit | `src/core/adapters/__tests__/SvelteAdapter.test.ts` |
| `SvelteAdapter.injectFlintIds()` adds `data-flint-id` to elements | Unit | `src/core/adapters/__tests__/SvelteAdapter.test.ts` |
| `SvelteAdapter.buildVisualTree()` produces correct layer tree | Unit | `src/core/adapters/__tests__/SvelteAdapter.test.ts` |
| `SvelteAdapter.nodeExists()` returns true for injected IDs | Unit | `src/core/adapters/__tests__/SvelteAdapter.test.ts` |
| `SvelteAdapter.applyMutationBatch()` returns snapshot inversions | Unit | `src/core/adapters/__tests__/SvelteAdapter.test.ts` |
| `buildSvelteSrcdoc()` does NOT contain any framework runtime | Unit | `src/components/editor/__tests__/LivePreview.svelte.test.tsx` |
| `buildSvelteSrcdoc()` contains Tailwind CDN + config | Unit | `src/components/editor/__tests__/LivePreview.svelte.test.tsx` |
| `buildSvelteSrcdoc()` contains interaction script | Unit | `src/components/editor/__tests__/LivePreview.svelte.test.tsx` |
| `.svelte` file triggers Svelte preview path (dispatch) | Integration | `src/components/editor/__tests__/LivePreview.svelte.test.tsx` |

---

## 11. Implementation Order

```
Phase MFP.1 (prerequisite for all others):
  Group A (parallel):
    - flint-design-engineer: Extract interaction script, refactor buildSrcdoc + buildHtmlSrcdoc,
                             add dispatch skeleton, fix C4 violation
    - flint-test-writer:     Write interaction script extraction tests

Phase MFP.2 (depends on MFP.1):
  Group B (parallel):
    - flint-electron-ipc:    code:transform-vue IPC handler + preload surface + vendor vue.global.prod.js
    - flint-design-engineer: buildVueSrcdoc() + .vue dispatch branch
    - flint-test-writer:     Vue transform tests + Vue preview tests

Phase MFP.3 (depends on MFP.1, parallel with MFP.2):
  Group C (parallel):
    - flint-electron-ipc:    code:transform-svelte IPC handler + preload surface
    - flint-ast-surgeon:     SvelteAdapter stub
    - flint-design-engineer: buildSvelteSrcdoc() + .svelte dispatch branch
    - flint-state-architect: Register SvelteAdapter in App.tsx
    - flint-test-writer:     Svelte transform tests + SvelteAdapter tests + Svelte preview tests
```

**Critical path**: MFP.1 -> MFP.2 and MFP.1 -> MFP.3. MFP.2 and MFP.3 are independent and can run in full parallel.

---

## 12. Risks

| Risk | Severity | Threatened Commandment | Mitigation |
|------|----------|----------------------|------------|
| Vue SFC `<script setup>` compilation may require additional Babel transforms for TypeScript in the `<script>` block | Medium | C13 (Deterministic Surgery) | The `@vue/compiler-sfc` has built-in TypeScript support via `compileScript({ id, source })`. Test with both `<script>` and `<script setup lang="ts">` during MFP.2. |
| Svelte 5 compiler API changed from Svelte 4 (`compile` vs `compileModule`) | Medium | None (compatibility) | Detect Svelte version at handler initialization. Use try/catch with fallback: try Svelte 5 API first (`svelte/compiler`.compile with `generate: 'client'`), fall back to Svelte 4 API. |
| Vendored `vue.global.prod.js` may drift from the `@vue/compiler-sfc` version, causing template compilation mismatches | Low | C4 (Local-First) | Pin both to the same Vue 3.x minor version. Add a version check in the `code:transform-vue` handler that warns if the compiler version != the vendored runtime version. |
| Interaction script extraction may subtly break the ghost proxy or drag-and-drop flow | Medium | None (regression) | MFP.1 tests explicitly verify all message handler types are present. Run the full existing LivePreview test suite as regression gate before MFP.2/3 begin. |
| Svelte compiled output may reference `svelte/internal` runtime modules that are not available in the iframe | High | C4 (Local-First) | Svelte 5's `generate: 'client'` mode with `immutable: true` produces self-contained DOM output. If internal imports leak, the `code:transform-svelte` handler must post-process them out (strip imports, inline the required runtime helpers). Add a test that verifies the compiled output contains zero `import` statements. |
| `data-flint-id` injection into Svelte markup may interfere with Svelte's template compilation | Medium | C7 (ID Preservation) | Inject `data-flint-id` attributes BEFORE sending to the compiler. The Svelte compiler treats unknown attributes as pass-through HTML attributes, so they survive compilation and appear in the DOM output. Test explicitly. |
| The existing `buildHtmlSrcdoc` CDN URL (`cdn.tailwindcss.com`) is a C4 violation that has been live | Low | C4 (Local-First) | Fixed in MFP.1. The vendored `tailwind-cdn.js` already exists in `src/preview-vendor/` and is used by `buildSrcdoc()`. The HTML builder simply needs to use the same import. |

---

## 13. Open Questions (Resolved)

**Q: Should `IFlintAdapter` grow a `buildPreviewSrcdoc()` method?**
A: No. Preview rendering is a UI concern. Adapters own AST surgery. The srcdoc builders live alongside `LivePreview.tsx` (or in `src/preview-vendor/`). The dispatch is by file extension, not by adapter method.

**Q: Should there be a single generic `code:transform` IPC channel?**
A: No. Each framework's compilation pipeline is different enough (different compiler packages, different output shapes, different mount strategies) that a single handler would become an untestable branching mess. Three focused handlers are cleaner, more testable, and independently deployable.

**Q: What about TypeScript in Vue `<script>` blocks and Svelte `<script>` blocks?**
A: `@vue/compiler-sfc` has built-in TypeScript support. Svelte 5's compiler also handles TypeScript natively with `compilerOptions: { dev: false }`. No additional Babel step is needed for either.

**Q: What about Svelte's reactivity system ($state, $derived in Svelte 5)?**
A: The Svelte compiler transforms all runes (`$state`, `$derived`, `$effect`) into vanilla JS during compilation. The compiled output has no rune syntax -- it is pure DOM manipulation code. The preview consumer never sees Svelte-specific syntax.
