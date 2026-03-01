# Bridge IDE — Developer Handoff

**Date:** 2026-02-26
**Status:** Phases 1–2C complete, zero TypeScript errors.
**Run:** `npm run dev`

---

## 1. Architecture Overview

Bridge is a three-process Electron app:

```
┌──────────────────────────────────────────────────────────┐
│  Main Process (Node.js / Electron)                       │
│  · Babel transform: TSX → plain JS (via IPC)             │
│  · SQLite token store (better-sqlite3)                   │
│  · IPC bridge exposed as window.bridgeAPI (preload.js)   │
└──────────────┬───────────────────────────────────────────┘
               │ contextBridge / IPC
┌──────────────▼───────────────────────────────────────────┐
│  Renderer Process (Vite + React 18 + TypeScript)         │
│  · Monaco code editor                                    │
│  · Babel AST pipeline (runs in renderer — no Node.js)    │
│  · Zustand stores (editor state, tokens)                 │
│  · Three-panel layout: Layers+Assets | Preview+Code |    │
│    Properties+Tokens                                     │
└──────────────┬───────────────────────────────────────────┘
               │ srcdoc + postMessage
┌──────────────▼───────────────────────────────────────────┐
│  iframe (sandboxed srcdoc)                               │
│  · React 18 UMD + Tailwind CDN                           │
│  · Renders user component live                           │
│  · Listens for HIGHLIGHT / HOVER / DRAG_OVER /           │
│    DRAG_CLEAR / CLEAR_HOVER messages                     │
│  · Broadcasts CANVAS_CLICK / CANVAS_HOVER /              │
│    CANVAS_HOVER_CLEAR via window.parent.postMessage      │
└──────────────────────────────────────────────────────────┘
```

The key pipeline:

```
User edits code in Monaco
  → editorStore.setCode()
  → parseCodeToAST() — Babel in renderer
  → buildVisualTree() — VisualLayer[]
  → LayerTree re-renders

Bi-directional mutations (className, moveNode, injectComponent):
  → fresh parseCodeToAST()
  → mutate AST in-place
  → generateCodeFromAST()
  → parseCodeToAST() again for clean locs
  → set({ rawCode, ast, visualTree })
  → LivePreview useEffect detects rawCode change
  → window.bridgeAPI.transformCode() → Electron main process
  → Babel strips imports, rewrites export default → window.__AppComponent
  → iframeRef.current.srcdoc = buildSrcdoc(js, tailwindConfig)
```

---

## 2. Complete File Map

### `src/core/`
| File | Purpose |
|------|---------|
| `ast-parser.ts` | **All renderer-side Babel work.** `parseCodeToAST`, `generateCodeFromAST`, `buildVisualTree`, `updateJSXClassName`. The foundational layer everything else depends on. |

### `src/store/`
| File | Key State | Key Actions |
|------|-----------|-------------|
| `editorStore.ts` | `rawCode`, `ast`, `visualTree`, `selectedNodeId`, `hoveredId`, `jumpToLine` | `setCode`, `setSelectedNode`, `setHoveredId`, `setJumpToLine`, `updateNodeProperty`, `moveLayerNode`, `injectComponent` |
| `tokenStore.ts` | `tokens: DesignToken[]` | `fetchTokens`, `ensureDemoTokens` |

### `src/utils/`
| File | Exports |
|------|---------|
| `astModifier.ts` | `DropPosition`, `moveNode()`, `injectComponent()` |
| `classMapper.ts` | `tokenToClass(tokenPath, tokenType, prefix)` — maps design tokens to Tailwind class strings |
| `layerNaming.ts` | `getLayerName(layer)` → `{ name, type, tag }` — smart display names for the layer tree |
| `layoutMapper.ts` | `LayoutCategory`, `updateLayoutClass()`, `getActiveLayoutClass()` — managed-set approach for mutually exclusive Tailwind layout classes |
| `tokenAdapter.ts` | `generateTailwindConfig(tokens)` — serialises token store to a Tailwind `extend` config JSON injected into the iframe |

### `src/components/editor/`
| File | Role |
|------|------|
| `CodeEditor.tsx` | Monaco editor wired to `rawCode`; respects `jumpToLine` |
| `LivePreview.tsx` | `buildSrcdoc()` + iframe. Handles all postMessage bridge traffic (5 inbound, 3 outbound). Custom DOM events `bridge:dragOver` / `bridge:dragClear` relayed from LayerTree. |
| `AssetsPanel.tsx` | Registry tile list; inline amber alert when no layer selected |

### `src/components/ui/`
| File | Role |
|------|------|
| `LayerTree.tsx` | Recursive `LayerRow`. Collapsible (`collapsedIds` Set in `LayerTree`). Full HTML5 DnD with before/after/inside indicators. Hover sync (`onMouseEnter`/`onMouseLeave`). Broadcasts `bridge:dragOver` / `bridge:dragClear` custom DOM events. |
| `PropertiesPanel.tsx` | Mounts `LayoutPanel` then `ClassBuilder` when a layer is selected |
| `TokenManager.tsx` | CRUD UI for the design token SQLite store |

### `src/components/inspector/`
| File | Role |
|------|------|
| `LayoutPanel.tsx` | Figma-style auto layout controls. `AlignmentGrid` 3×3 sub-component with axis-swap for flex-col. Flow (wrap/col/row), AlignmentGrid+Gap, W/H sizing, Padding sections. |
| `ClassBuilder.tsx` | Token-driven class picker. Tabs per token type. |
| `TokenSelect.tsx` | Reusable prefix + token-type dropdown. |

### `src/data/`
| File | Role |
|------|------|
| `componentRegistry.ts` | `RegistryEntry[]` — Button, Badge, Paragraph. Source of truth for the Assets Panel. |

### `src/App.tsx`
Three-panel shell. Left panel has **Layers / Assets** tab bar (`leftTab` state). Center: Preview (top) + Code (bottom). Right: Properties (top) + Tokens (bottom).

---

## 3. The Bi-Directional Bridge — Message Protocol

All iframe↔renderer communication uses `window.postMessage`.

### Renderer → iframe (`iframeRef.current.contentWindow.postMessage`)
| Message | Payload | Effect |
|---------|---------|--------|
| `HIGHLIGHT` | `{ id: string \| null }` | Adds/removes `.bridge-selected` (solid blue outline) |
| `HOVER` | `{ id: string }` | Adds `.bridge-hovered` (dashed slate outline) |
| `CLEAR_HOVER` | — | Removes all `.bridge-hovered` |
| `DRAG_OVER` | `{ targetId, position }` | Adds `.bridge-drop-{before\|after\|inside}` |
| `DRAG_CLEAR` | — | Removes all `.bridge-drop-*` |

### iframe → renderer (`window.parent.postMessage`)
| Message | Payload | Handler |
|---------|---------|---------|
| `CANVAS_CLICK` | `{ id: string }` | `setSelectedNode(id)` |
| `CANVAS_HOVER` | `{ id: string }` | `setHoveredId(id)` |
| `CANVAS_HOVER_CLEAR` | — | `setHoveredId(null)` |

### Renderer → iframe relay (custom DOM events → postMessage)
`LayerTree` dispatches `bridge:dragOver` and `bridge:dragClear` on `window`.
`LivePreview` listens for these and forwards them to `iframeRef.current.contentWindow`.

### iframe CSS classes injected via `buildSrcdoc`
```css
.bridge-selected  { outline: 2px solid #3b82f6 !important; background: rgba(59,130,246,0.1) !important; }
.bridge-hovered   { outline: 2px dashed #94a3b8 !important; background: rgba(148,163,184,0.1) !important; z-index: 40; }
.bridge-drop-before { box-shadow: 0 -3px 0 0 #3b82f6 !important; z-index: 50; }
.bridge-drop-after  { box-shadow: 0 3px 0 0 #3b82f6 !important; z-index: 50; }
.bridge-drop-inside { outline: 2px solid #3b82f6 !important; background: rgba(59,130,246,0.2) !important; }
```

---

## 4. Node ID Format (Critical)

Every JSXElement in the AST gets a synthetic ID:

```
"<tagName>:<1-based-line>:<0-based-column>"
Examples:
  "div:10:4"
  "Button:22:6"
  "React.Fragment:5:2"
```

This ID is:
- Produced by `buildVisualTree` in `ast-parser.ts`
- Matched in `findNode` in `astModifier.ts` (line + col only — tag name is prefix, not compared)
- Stored in `VisualLayer.id`
- Used as the `data-bridge-id` attribute value in the rendered HTML (injected by the Babel transform in the **main process**)
- Used as `selectedNodeId` and `hoveredId` in the store

**Warning:** IDs are position-based. After any AST mutation (`moveLayerNode`, `injectComponent`, `updateNodeProperty`), the code is regenerated and re-parsed. Source locations shift, so all IDs are stale after a mutation. The store always updates `visualTree` atomically with `rawCode` to keep them in sync. Never cache a node ID across a mutation boundary.

---

## 5. The AST Pipeline — What Each Function Does

### `parseCodeToAST(code: string): File | null`
Runs `@babel/parser` with `['jsx', 'typescript']` plugins. Returns `null` on parse error (normal during live typing). The store's `setCode` preserves the last valid AST when this returns null.

### `generateCodeFromAST(ast: File): string`
Runs `@babel/generator` with `retainLines: false, comments: true`. Output is always re-parseable — used as the source of truth after every mutation.

### `buildVisualTree(ast: File): VisualLayer[]`
Traverses the AST with `enter`/`exit` hooks on `JSXElement`. Builds a nested `VisualLayer[]` mirroring JSX nesting. Extracts `className`, `id` attr, and first text content (`extractJSXText` recurses into nested elements and handles JSXExpressionContainers).

### `updateJSXClassName(ast: File, nodeId: string, className: string): void`
Finds element by line:col. Updates or creates the `className` JSXAttribute in-place. Uses Babel builder functions (`jsxAttribute`, `jsxIdentifier`, `stringLiteral`).

### `moveNode(fileAST, sourceId, targetId, position): File`
Pre-validates all constraints before any mutation (prevents partial state). Removes source from parent array. Handles same-parent index recalculation by re-calling `indexOf` after removal. Three positions: `before` / `after` / `inside`.

### `injectComponent(fileAST, targetNodeId, jsxSnippet, importSnippet?): File`
Two-phase:
1. **Import**: Parses import string, checks `fileAST.program.body` for existing import from same module source, `unshift`s if absent.
2. **JSX**: Wraps snippet in `<__bridge__>…</__bridge__>`, parses, extracts first `JSXElement` child, `push`es to target's `children` array.

---

## 6. Recently Modified Files (This Session)

| File | Change |
|------|--------|
| `src/utils/astModifier.ts` | Added `injectComponent()` + two private helpers (`parseImportSnippet`, `parseJSXSnippet`). Added `@babel/parser`, `isJSXElement`, `isImportDeclaration`, `ExpressionStatement` imports. |
| `src/store/editorStore.ts` | Added `hoveredId`/`setHoveredId` state+action. Added `injectComponent` action (aliased import to avoid name clash). |
| `src/components/ui/LayerTree.tsx` | Collapsible layers (`collapsedIds` Set, chevron toggle). Hover sync (`onMouseEnter`/`onMouseLeave`, `isHovered` styling). Drag broadcast (`bridge:dragOver`/`bridge:dragClear` custom events with `lastBroadcast` dedup ref). |
| `src/components/editor/LivePreview.tsx` | CSS: `.bridge-hovered`, `.bridge-drop-*`. Message handler: `HOVER`, `CLEAR_HOVER`, `DRAG_OVER`, `DRAG_CLEAR`. Broadcaster: `_bridgeHoverId` tracker + `mouseover`/`mouseleave` on body. React: `hoveredId` effect + expanded message handler + drag relay `useEffect`. |
| `src/data/componentRegistry.ts` | **New.** Three registry entries: Button, Badge, Paragraph. |
| `src/components/editor/AssetsPanel.tsx` | **New.** Tile grid from registry. Inline amber alert when no layer selected. |
| `src/App.tsx` | Left panel now has Layers/Assets tab bar (`leftTab` state). Imports `AssetsPanel`. |

---

## 7. Immediate Next Steps — AST Parser

The AST pipeline in `ast-parser.ts` has one function per mutation type. Here is the prioritised expansion roadmap:

### 7a. Text Content Editing (`updateJSXTextContent`)
**Why:** The Properties panel can show the layer's `textContent` but cannot edit it. Users expect to click on "Edit this component…" in the inspector and retype it.

**Shape:**
```typescript
export function updateJSXTextContent(
    ast: File,
    nodeId: string,
    newText: string
): void
```

**Logic:** Find element by line:col. Iterate `path.node.children`. Find the first `JSXText` child with non-empty `value.trim()`. Replace its `value` with `newText`. If none exists, push a new `JSXText` node (`t.jsxText(newText)`).

**Store action:** `updateNodeProperty(nodeId, 'textContent', value)` — add a `propName === 'textContent'` branch alongside the existing `className` branch.

---

### 7b. Arbitrary Prop Editing (`updateJSXProp`)
**Why:** `updateJSXClassName` is `className`-only. The inspector will need to set `href`, `src`, `variant`, `disabled`, `onClick`, etc.

**Shape:**
```typescript
export function updateJSXProp(
    ast: File,
    nodeId: string,
    propName: string,
    value: string | boolean | null   // null = remove the prop
): void
```

**Logic:** Generalises the existing `updateJSXClassName` logic. For string values use `stringLiteral`. For boolean `true` use a valueless JSXAttribute (e.g. `disabled`). For boolean `false` or `null` remove the attribute entirely. For expressions (e.g. `onClick={handler}`) a JSXExpressionContainer wrapper is needed — handle separately or accept a `rawExpression: string` flag.

---

### 7c. Node Deletion (`removeNode`)
**Why:** `injectComponent` can add nodes; there is no counterpart for deletion. The Assets Panel "undo" story and a Delete key handler both need this.

**Shape:**
```typescript
export function removeNode(fileAST: File, nodeId: string): File
```

**Logic:** Find node with `findNode`. If `parentChildren === null`, the node is the JSX root — abort (cannot delete root). Otherwise, `parentChildren.splice(idx, 1)`.

**Store action:** `removeLayerNode(nodeId: string)` — same fresh-parse → mutate → regenerate cycle.

---

### 7d. `data-bridge-id` Injection — Understanding the Gap
**Current situation:** The iframe uses `document.querySelector('[data-bridge-id="…"]')` for selection, hover, and drop indicators. These attributes must exist on the rendered DOM. They are currently injected by the **Electron main process Babel transform** (the `window.bridgeAPI.transformCode` IPC call), not by the renderer-side AST pipeline.

**The risk:** The main-process transform is a black box from the renderer's perspective. If it changes (or fails to add `data-bridge-id`), selection silently breaks.

**Recommended next step:** Add a renderer-side function to `ast-parser.ts`:

```typescript
export function injectBridgeIds(ast: File): File
```

**Logic:** Traverse all `JSXElement` nodes. For each, compute the synthetic ID (`${tagName}:${line}:${col}`). Check `opening.attributes` — if no `data-bridge-id` attribute is already present, push one using `jsxAttribute(jsxIdentifier('data-bridge-id'), stringLiteral(id))`.

This makes the renderer self-sufficient: call it inside `buildSrcdoc` by running it on the fresh AST before `generateCodeFromAST`, using the resulting code as the iframe source rather than the main-process-transformed version.

**Note:** This would bypass the main process IPC for `data-bridge-id` injection, meaning the main process only needs to handle TypeScript stripping and module rewriting — which is already its core job. The attributes are additive and won't break the component's runtime behaviour.

---

### 7e. Wrap / Unwrap (`wrapNode`, `unwrapNode`)
**Why needed for:** The Figma "Group Selection" mental model — select multiple layers and wrap them in a `<div>`. Or flatten a single-child wrapper.

**`wrapNode(fileAST, nodeId, wrapperTag, wrapperClassName?): File`**
Find node. Replace it in its parent array with a new JSXElement whose single child is the original node.

**`unwrapNode(fileAST, nodeId): File`**
Find node. Replace it in its parent array with its own children (spliced in). Abort if the node has ≠1 child or is the root.

---

### 7f. Duplicate Node (`duplicateNode`)
**Shape:** `duplicateNode(fileAST, nodeId): File`

Deep-clone the found JSXElement (using `@babel/types`'s `cloneNode(node, true)`). Insert the clone immediately after the original in `parentChildren`.

---

## 8. Known Constraints and Gotchas

1. **No `any` allowed** — TypeScript strict mode + `noImplicitAny`. Every Babel node type must be narrowed with `isJSXElement`, `isImportDeclaration`, etc., or cast with explicit type imports.

2. **CJS interop guard** — `@babel/traverse` and `@babel/generator` are CJS modules. Both files that import them use the same guard:
   ```typescript
   const traverse = typeof _traverse === 'function'
       ? _traverse
       : (_traverse as unknown as { default: typeof _traverse }).default
   ```
   Do not remove this — it is not redundant, it handles the vite-plugin-electron-renderer resolution path.

3. **Fresh AST on every mutation** — Never pass `editorStore.getState().ast` to a mutation function. Always call `parseCodeToAST(get().rawCode)` inside the store action to get a clean copy. The live `ast` in the store is read-only.

4. **Tailwind dynamic class generation** — All Tailwind classes used in the renderer UI must appear as literal strings in source files. Never construct class names with runtime interpolation (e.g. `pl-${depth * 4}` will never be in the generated CSS). Use `style={{ paddingLeft: depth * 14 + 8 }}` instead.

5. **Renderer process only** — No `fs`, `path`, `child_process`, or any Node.js built-in in any file under `src/`. All Node.js work goes in the Electron main process and is exposed via `window.bridgeAPI`.

6. **Self-closing abort** — Both `moveNode` (for `inside` drops) and `injectComponent` silently abort when the target `openingElement.selfClosing === true`. This is correct behaviour — `img`, `input`, `br` etc. cannot have children.

7. **`<__bridge__>` wrapper tag** — `parseJSXSnippet` wraps the user's JSX in `<__bridge__>…</__bridge__>` to give the Babel parser a valid root. This tag never appears in generated output since we extract `.children.find(isJSXElement)` before using the result.

---

## 9. Design Token System

Tokens are stored in SQLite (main process). The renderer reads them via `tokenStore.fetchTokens()`.

```typescript
interface DesignToken {
    token_path: string   // e.g. "brand/primary", "spacing/4"
    token_type: string   // e.g. "color", "spacing", "typography"
    value: string        // e.g. "#3b82f6", "1rem"
}
```

`tokenAdapter.generateTailwindConfig(tokens)` converts the flat list into a `tailwind.config` JSON extension object injected into the iframe via `<script>tailwind.config = …</script>`.

`classMapper.tokenToClass(tokenPath, tokenType, prefix)` maps a token to a Tailwind class string. The `prefix` controls the utility (e.g. `"bg-"` + `"brand/primary"` → `"bg-brand-primary"`).

`layoutMapper.ts` is **independent of tokens** — it manages mutually exclusive flex/sizing class sets. `FLEX_REQUIRED` gates which categories auto-add the base `flex` class.

---

## 10. Running and Building

```bash
npm run dev        # Electron + Vite dev server (HMR)
npm run build      # Production build
npx tsc --noEmit   # Type-check only (zero errors expected)
```

The Vite config uses `vite-plugin-electron` and `vite-plugin-electron-renderer` to handle the main/renderer split and CJS interop for Babel packages.
