# Contract: CV2.2 -- Component Thumbnail Generator

**Phase:** CV2.2 -- Canvas Visual Mode Infrastructure
**Phase 1 (Contract):** 2026-03-20
**Owner:** flint-architect

---

## 1. Impact Map

### Files to CREATE

| File | Purpose | Owner |
|------|---------|-------|
| `electron/thumbnailGenerator.ts` | Thumbnail generation service: hidden BrowserWindow rendering, capture, cache | flint-electron-ipc |
| `electron/__tests__/thumbnailGenerator.test.ts` | Unit tests for ThumbnailGenerator | flint-test-writer |
| `src/hooks/useThumbnail.ts` | React hook that fetches a thumbnail data URL via IPC, returns loading/data/error | flint-design-engineer |
| `src/hooks/__tests__/useThumbnail.test.ts` | Hook tests (happy path, loading state, cache hit, error) | flint-test-writer |

### Files to MODIFY

| File | Change | Owner |
|------|--------|-------|
| `electron/main.ts` | Register 4 IPC handlers (`thumbnails:generate`, `thumbnails:generate-all`, `thumbnails:get`, `thumbnails:invalidate`) + auto-invalidation hook on `ast:save-file` / `ast:save-batch` | flint-electron-ipc |
| `electron/preload.ts` | Add `thumbnails` namespace to `window.flintAPI` | flint-electron-ipc |
| `src/types/flint-api.d.ts` | Add `ThumbnailsAPI` interface and `thumbnails` property on `FlintAPI` | flint-state-architect |

---

## 2. Type Contracts

### `electron/thumbnailGenerator.ts` -- Exported Types

```typescript
/**
 * Options for generating a single component thumbnail.
 */
export interface ThumbnailOptions {
    /** Absolute path to the component source file (.tsx/.jsx). */
    filePath: string;
    /** Component name (PascalCase) -- used as the cache key and filename. */
    componentName: string;
    /** Width of the captured thumbnail in CSS pixels. Default: 280. */
    width?: number;
    /** Height of the captured thumbnail in CSS pixels. Default: 180. */
    height?: number;
    /** Device pixel ratio for retina captures. Default: 2 (for crisp thumbnails). */
    deviceScaleFactor?: number;
}

/**
 * Result of a single thumbnail generation.
 */
export interface ThumbnailResult {
    /** Component name this thumbnail represents. */
    componentName: string;
    /** Absolute path to the saved PNG file in .flint/thumbnails/. */
    thumbnailPath: string;
    /** Whether this was freshly generated (true) or served from cache (false). */
    generated: boolean;
    /** Non-null when generation failed. The PNG may be a fallback placeholder. */
    error: string | null;
}

/**
 * Result of a batch thumbnail generation.
 */
export interface BatchThumbnailResult {
    /** Total components processed. */
    total: number;
    /** Successfully generated thumbnails. */
    succeeded: number;
    /** Components that failed thumbnail generation. */
    failed: number;
    /** Per-component results. */
    results: ThumbnailResult[];
}

/**
 * ThumbnailGenerator -- renders components in hidden BrowserWindows and
 * captures screenshots as PNG files.
 *
 * Design:
 *   - One hidden BrowserWindow is created per capture, then destroyed.
 *   - Async queue limits concurrency to 1 (sequential) to avoid GPU contention.
 *   - PNGs are cached in `.flint/thumbnails/{componentName}.png`.
 *   - Cache invalidation deletes the PNG; regeneration is lazy (on next get).
 */
export class ThumbnailGenerator {
    constructor(projectRoot: string);

    /**
     * Generate a thumbnail for a single component.
     * If a cached PNG exists and has not been invalidated, returns it immediately.
     */
    generate(options: ThumbnailOptions): Promise<ThumbnailResult>;

    /**
     * Batch generate thumbnails for all components listed in flint-manifest.json.
     * Processes sequentially via the internal async queue.
     */
    generateAll(): Promise<BatchThumbnailResult>;

    /**
     * Read a cached thumbnail as a base64 data URL.
     * Returns null if the thumbnail does not exist (caller should trigger generate).
     */
    get(componentName: string): Promise<string | null>;

    /**
     * Invalidate (delete) the cached thumbnail for a component.
     * The next `get()` or `generate()` call will re-render.
     */
    invalidate(componentName: string): Promise<void>;

    /**
     * Returns true if a valid cached thumbnail exists for the component.
     */
    has(componentName: string): boolean;

    /**
     * Update the project root (called when user opens a different project).
     * Resets the internal cache state.
     */
    setProjectRoot(projectRoot: string): void;

    /**
     * Clean up: close any pending BrowserWindows.
     * Called on app quit.
     */
    dispose(): void;
}
```

### `src/types/flint-api.d.ts` -- New Interface

```typescript
/**
 * IPC surface for component thumbnail generation and retrieval.
 * Phase CV2.2: Thumbnails are static PNGs rendered via offscreen
 * BrowserWindow capture, cached in .flint/thumbnails/.
 */
export interface ThumbnailsAPI {
    /**
     * Generate a thumbnail for a single component file.
     * Returns the result with the thumbnail path or error.
     */
    generate: (payload: {
        filePath: string;
        componentName: string;
        width?: number;
        height?: number;
    }) => Promise<{
        componentName: string;
        thumbnailPath: string;
        generated: boolean;
        error: string | null;
    }>;

    /**
     * Batch generate thumbnails for all components in flint-manifest.json.
     * Processes sequentially to avoid GPU contention.
     * Returns aggregate results.
     */
    generateAll: () => Promise<{
        total: number;
        succeeded: number;
        failed: number;
        results: Array<{
            componentName: string;
            thumbnailPath: string;
            generated: boolean;
            error: string | null;
        }>;
    }>;

    /**
     * Read a cached thumbnail as a base64 data URL string.
     * Returns null if the thumbnail is not cached (caller should generate first).
     * Serving cached thumbnails from disk targets < 50ms.
     */
    get: (componentName: string) => Promise<string | null>;

    /**
     * Invalidate (delete) the cached thumbnail for a specific component.
     * Called automatically when a component file is saved via FileTransactionManager.
     * Can also be called manually for force-refresh.
     */
    invalidate: (componentName: string) => Promise<void>;
}
```

### Addition to `FlintAPI` interface

```typescript
export interface FlintAPI {
    // ... existing properties ...

    /** Component thumbnail generation and retrieval (Phase CV2.2). */
    thumbnails: ThumbnailsAPI;
}
```

### `src/hooks/useThumbnail.ts` -- Hook Contract

```typescript
/**
 * React hook for fetching component thumbnails via IPC.
 *
 * Usage:
 *   const { dataUrl, isLoading, error } = useThumbnail('Button');
 *
 * Behavior:
 *   1. On mount, calls `window.flintAPI.thumbnails.get(componentName)`.
 *   2. If null (not cached), calls `window.flintAPI.thumbnails.generate(...)`.
 *   3. After generate completes, calls `get()` again to retrieve the data URL.
 *   4. Returns loading/data/error state for the component to consume.
 *
 * The hook does NOT re-fetch on every render -- it caches the result in
 * React state and only re-fetches when `componentName` or `filePath` changes.
 */
export function useThumbnail(
    componentName: string,
    filePath: string,
): {
    dataUrl: string | null;
    isLoading: boolean;
    error: string | null;
};
```

---

## 3. IPC Channels

| Channel | Direction | Payload Type | Return Type | Notes |
|---------|-----------|-------------|-------------|-------|
| `thumbnails:generate` | Renderer -> Main | `{ filePath: string; componentName: string; width?: number; height?: number }` | `ThumbnailResult` | Generates one thumbnail |
| `thumbnails:generate-all` | Renderer -> Main | `void` | `BatchThumbnailResult` | Batch generates from flint-manifest.json |
| `thumbnails:get` | Renderer -> Main | `string` (componentName) | `string \| null` | Returns base64 data URL or null |
| `thumbnails:invalidate` | Renderer -> Main | `string` (componentName) | `void` | Deletes cached PNG |

No push events (no `ipcRenderer.on` subscriptions) -- thumbnails are pull-based. The renderer requests when it needs one.

---

## 4. Store Contracts

No new Zustand store is required. Thumbnail state is ephemeral and managed by the `useThumbnail` hook's local React state. Rationale:

- Thumbnails are derived artifacts, not source-of-truth data.
- Each component card manages its own thumbnail lifecycle independently.
- A store would violate the "no cross-store contamination" rule without adding value -- there is no case where one component needs to read another component's thumbnail state.
- The IPC `get()` call serves as the read path; no need for a reactive store layer.

---

## 5. Component Contracts

| Component | Props | Store Dependencies | IPC Calls |
|-----------|-------|--------------------|-----------|
| (Future CV2.3 Build Mode card) | `componentName: string; filePath: string` | None (uses `useThumbnail` hook) | `thumbnails.get`, `thumbnails.generate` |

The `useThumbnail` hook is the sole consumer of the `ThumbnailsAPI`. Future canvas components in CV2.3 (Build Mode cards) will use this hook. No existing components are modified in CV2.2.

---

## 6. Architectural Design

### 6.1 Rendering Pipeline

The thumbnail renderer reuses the same compilation pipeline as `LivePreview.tsx` and the `code:transform` IPC handler:

```
Component .tsx file
  |
  v
[1] Read source from disk (fs.readFile)
  |
  v
[2] Babel transform: TypeScript -> JS, strip imports, rewrite exports
    (Same transformSync pipeline as code:transform in main.ts)
  |
  v
[3] Build minimal HTML shell:
    - Inline React 18 UMD (from preview-vendor/)
    - Inline ReactDOM 18 UMD (from preview-vendor/)
    - Inline Tailwind CDN (from preview-vendor/)
    - Inject design tokens as tailwind.config
    - Embed transformed JS
    - Render component into #root
  |
  v
[4] Load HTML into hidden BrowserWindow:
    - show: false
    - webPreferences.offscreen: true
    - width/height: 280x180 (CSS px)
    - deviceScaleFactor: 2 (retina)
  |
  v
[5] Wait for 'did-finish-load' + requestAnimationFrame
    (ensures paint cycle completes)
  |
  v
[6] webContents.capturePage() -> NativeImage -> PNG Buffer
  |
  v
[7] Write PNG to .flint/thumbnails/{componentName}.png
    via fileTransactionManager (Commandment 12/14)
  |
  v
[8] Destroy hidden BrowserWindow
```

### 6.2 HTML Shell Construction

The `buildThumbnailHtml()` function mirrors `buildSrcdoc()` from `LivePreview.tsx` but with these differences:

- **No Flint interaction layer** -- no Shield overlay, no selection styles, no drag-and-drop ghost, no `data-flint-id` click handlers.
- **White background** -- thumbnails use `background: white` for a clean card appearance (not the dark `#111827` canvas background).
- **No overflow** -- `overflow: hidden` on body to prevent scrollbars in the capture.
- **Centered rendering** -- the component is rendered centered in the viewport.
- **No interactive scripts** -- no postMessage listeners, no click/hover handlers.

The preview-vendor JS files (React UMD, ReactDOM UMD, Tailwind CDN) are read once at startup and cached in memory. They are NOT re-read from disk per thumbnail.

### 6.3 Async Queue

```typescript
/**
 * Sequential async queue to prevent GPU contention from multiple
 * simultaneous BrowserWindow renders.
 *
 * Design: A simple FIFO promise chain. Each new task chains onto
 * the tail promise. Concurrency is always 1.
 */
class AsyncQueue {
    private tail: Promise<void> = Promise.resolve();

    enqueue<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.tail = this.tail.then(() =>
                task().then(resolve, reject)
            ).catch(() => { /* prevent chain breakage */ });
        });
    }
}
```

### 6.4 Cache Structure

```
.flint/
  thumbnails/
    Button.png
    Card.png
    Header.png
    ...
```

- Cache key: `componentName` (PascalCase, no path)
- File format: PNG
- Resolution: 560x360 physical pixels (280x180 CSS * 2x DPR)
- Maximum cache size: 500 files (enforced by LRU eviction on `generateAll`)

### 6.5 Auto-Invalidation Hook

When `ast:save-file` or `ast:save-batch` completes successfully in `main.ts`, the handler checks whether the saved file path matches any component in `flint-manifest.json`. If it does, the corresponding thumbnail is invalidated (deleted from disk). Regeneration is **lazy** -- it only happens when the thumbnail is next requested via `thumbnails:get`.

```typescript
// In main.ts, after the existing save-file handler's shadowCommit:
async function autoInvalidateThumbnail(filePath: string): Promise<void> {
    if (!activeProjectRoot || !thumbnailGenerator) return;
    const manifestPath = path.join(activeProjectRoot, 'flint-manifest.json');
    try {
        const raw = await readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(raw);
        const components = manifest.components || {};
        for (const [name, entry] of Object.entries(components)) {
            const entryObj = entry as { importPath?: string };
            if (!entryObj.importPath) continue;
            // Resolve import path to absolute path and compare
            const resolvedPath = resolveImportPath(entryObj.importPath, activeProjectRoot);
            if (resolvedPath === filePath) {
                await thumbnailGenerator.invalidate(name);
                break;
            }
        }
    } catch {
        // Manifest missing or unparseable -- no invalidation needed
    }
}
```

### 6.6 Lifecycle

| Event | Action |
|-------|--------|
| `project:openPath` / `project:initialize` / `project:create-scratchpad` | Create or update `ThumbnailGenerator` with new `projectRoot` |
| `ast:save-file` / `ast:save-batch` success | Call `autoInvalidateThumbnail(filePath)` |
| App quit (`app.on('will-quit')`) | Call `thumbnailGenerator.dispose()` |
| Project close (`menu:close-project`) | Call `thumbnailGenerator.dispose()` |

---

## 7. Performance Requirements

| Metric | Target | How Measured |
|--------|--------|-------------|
| Single thumbnail generation | < 2,000 ms | Timer around `generate()` in tests |
| Cached thumbnail retrieval (`get()`) | < 50 ms | Timer around `get()` in tests |
| Batch generation throughput | < 2s per component | Total batch time / component count |
| Memory: preview-vendor JS cache | ~3 MB (one-time) | Loaded once at startup, shared across all renders |
| Max cache size on disk | 500 PNG files | LRU eviction in `generateAll()` |
| No main-process blocking | Queue is fully async | All I/O is `await`-based, no `Sync` calls in the generation path |

---

## 8. Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|-------------|---------|---------------|
| 4 | Local-First Only | **Yes** | Preview-vendor JS files are bundled locally (same as LivePreview). No external URLs in the hidden BrowserWindow's HTML shell. Thumbnails are PNG files on local disk. Zero network dependency. |
| 7 | ID Preservation | **No** | Thumbnail generation is read-only. It does not mutate any AST or source file. `data-flint-id` attributes are not relevant to static screenshots. |
| 12 | Atomic Queuing | **Yes** | PNG files are written via `fileTransactionManager.write()`. This ensures atomic `.tmp` -> `rename` writes, consistent with all other disk writes in Flint. |
| 13 | Deterministic Surgery | **N/A** | No AST mutation. The Babel transform is read-only (same as `code:transform`). |
| 14 | Bypass Prohibition | **Yes** | All disk writes route through `FileTransactionManager`. All disk reads use `fs.readFile` (async, non-mutating). No direct `fs.writeFile` calls. |
| 1 | Code is Truth | **N/A** | Thumbnails are derived cache artifacts, not source of truth. |
| 9 | Process Boundary | **Yes** | All Node.js operations (BrowserWindow, fs, Babel) are in `electron/`. The renderer accesses only via `window.flintAPI.thumbnails`. No `fs` or `BrowserWindow` imports in `src/`. |

---

## 9. Test Requirements

### `electron/__tests__/thumbnailGenerator.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | **TG-01: generates a PNG file on disk** | Given a valid TSX source, `generate()` creates a `.png` file in `.flint/thumbnails/` |
| 2 | **TG-02: returns base64 data URL from get()** | After `generate()`, `get(componentName)` returns a string starting with `data:image/png;base64,` |
| 3 | **TG-03: get() returns null for non-existent thumbnail** | `get('NonExistent')` returns `null` |
| 4 | **TG-04: invalidate() deletes the cached file** | After `generate()`, `invalidate()` removes the PNG; subsequent `get()` returns `null` |
| 5 | **TG-05: invalidate() is idempotent** | Calling `invalidate()` on a non-existent thumbnail does not throw |
| 6 | **TG-06: generate() reuses cached thumbnail** | Calling `generate()` twice returns `{ generated: false }` on the second call |
| 7 | **TG-07: generate() after invalidate() re-renders** | `invalidate()` then `generate()` returns `{ generated: true }` |
| 8 | **TG-08: batch generateAll() processes all manifest components** | Given a manifest with 3 components, `generateAll()` returns `{ total: 3, succeeded: 3 }` |
| 9 | **TG-09: batch generateAll() handles missing source files** | A manifest entry with a nonexistent file produces `{ error: '...' }` in results |
| 10 | **TG-10: sequential queue prevents concurrent renders** | Two simultaneous `generate()` calls execute sequentially (second starts after first finishes) |
| 11 | **TG-11: setProjectRoot() resets cache state** | After `setProjectRoot()`, previously cached thumbnails are no longer reported by `has()` |
| 12 | **TG-12: auto-invalidation wiring** | Saving a file that matches a manifest component triggers `invalidate()` |
| 13 | **TG-13: handles Babel transform errors gracefully** | A file with invalid TSX returns a result with `error` set and does not crash the process |
| 14 | **TG-14: componentName is sanitized** | Component names with path traversal characters (`../`) are rejected |
| 15 | **TG-15: PNG dimensions are correct** | The generated PNG has expected dimensions (560x360 physical pixels at 2x DPR) |

**Note:** Tests TG-01 through TG-09, TG-11, TG-13, and TG-14 can run without a real BrowserWindow by mocking the Electron `BrowserWindow` constructor and `webContents.capturePage()`. Tests TG-10 and TG-15 are integration tests that may require the full Electron environment.

### `src/hooks/__tests__/useThumbnail.test.ts`

| # | Test | Assertion |
|---|------|-----------|
| 1 | **TH-01: returns loading state initially** | On mount, `isLoading` is `true`, `dataUrl` is `null` |
| 2 | **TH-02: returns data URL after cache hit** | When `get()` returns a data URL, `isLoading` becomes `false` and `dataUrl` is set |
| 3 | **TH-03: triggers generate on cache miss** | When `get()` returns `null`, the hook calls `generate()` then `get()` again |
| 4 | **TH-04: returns error on generation failure** | When `generate()` returns `{ error: '...' }`, `error` is set |
| 5 | **TH-05: re-fetches when componentName changes** | Changing `componentName` prop triggers a new `get()` call |
| 6 | **TH-06: does not re-fetch on unrelated re-renders** | The hook uses stable deps and does not re-fetch when parent re-renders |
| 7 | **TH-07: handles missing flintAPI gracefully** | When `window.flintAPI` is undefined (test env), returns error without crashing |

### Test Validation Commands

```bash
# Run thumbnail generator tests
npm test -- --reporter verbose 2>&1 | grep -E 'thumbnailGenerator|TG-|PASS|FAIL'

# Run hook tests
npm run test:react -- --reporter verbose 2>&1 | grep -E 'useThumbnail|TH-|PASS|FAIL'

# Type check
npx tsc --noEmit
```

---

## 10. Security Considerations

| Risk | Mitigation |
|------|------------|
| **Path traversal in componentName** | Sanitize: reject any `componentName` containing `/`, `\`, `..`, or non-alphanumeric characters (except `-` and `_`). Use `componentName.replace(/[^a-zA-Z0-9_-]/g, '')`. |
| **Malicious component code in BrowserWindow** | The hidden BrowserWindow uses `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`. No preload script is loaded. The component code runs in a fully sandboxed renderer. CSP restricts to `'self'` and `'unsafe-eval'` (needed for `new Function()`). |
| **File write outside .flint/thumbnails/** | All write paths are constructed from `path.join(projectRoot, '.flint', 'thumbnails', sanitizedName + '.png')`. The `projectRoot` is validated to be within the user's home directory. |
| **Denial of service via large batch** | `generateAll()` processes sequentially with a maximum of 500 components. Excess entries are skipped with a warning. |
| **BrowserWindow leak** | Every hidden window is tracked and destroyed in a `finally` block. `dispose()` cleans up any remaining windows on shutdown. |

---

## 11. Implementation Order

### Group A (Sequential -- blocks all else)

1. **A1: `electron/thumbnailGenerator.ts`** -- Core service class
   - `AsyncQueue` helper class
   - `ThumbnailGenerator` class with `generate()`, `generateAll()`, `get()`, `invalidate()`, `has()`, `setProjectRoot()`, `dispose()`
   - `buildThumbnailHtml()` function (mirrors LivePreview's `buildSrcdoc` without interaction layer)
   - Preview-vendor file caching (read once at import time)
   - PNG write via `fileTransactionManager`
   - **Owner:** `flint-electron-ipc`

### Group B (Parallel with each other, after A1)

2. **B1: `electron/main.ts` IPC wiring** -- 4 IPC handlers + auto-invalidation hook
   - `thumbnails:generate`, `thumbnails:generate-all`, `thumbnails:get`, `thumbnails:invalidate`
   - Auto-invalidation in `ast:save-file` and `ast:save-batch` handlers
   - Lifecycle wiring (create on project open, dispose on project close/quit)
   - **Owner:** `flint-electron-ipc`

3. **B2: `electron/preload.ts` + `src/types/flint-api.d.ts`** -- IPC flint surface
   - Add `thumbnails` namespace to `contextBridge.exposeInMainWorld`
   - Add `ThumbnailsAPI` interface and `thumbnails` property to `FlintAPI`
   - **Owner:** `flint-electron-ipc`

4. **B3: `src/hooks/useThumbnail.ts`** -- React hook
   - **Owner:** `flint-design-engineer`

### Group C (After B completes)

5. **C1: `electron/__tests__/thumbnailGenerator.test.ts`** -- 15 test cases
   - **Owner:** `flint-test-writer`

6. **C2: `src/hooks/__tests__/useThumbnail.test.ts`** -- 7 test cases
   - **Owner:** `flint-test-writer`

### Parallelism Summary

```
A1 (thumbnailGenerator.ts)
  |
  +---> B1 (main.ts IPC handlers)      \
  +---> B2 (preload.ts + flint-api.d.ts) |-- all parallel
  +---> B3 (useThumbnail.ts hook)       /
          |
          +---> C1 (generator tests)  \
          +---> C2 (hook tests)       /-- parallel
```

---

## 12. Risks

| Risk | Severity | Commandment Threatened | Mitigation |
|------|----------|----------------------|------------|
| **Electron `offscreen` rendering flaky on Linux/CI** | Medium | None (functionality) | Provide a fallback that generates a placeholder SVG card (component name + icon) when `capturePage()` fails. Tests mock `capturePage()` so CI does not require a GPU. |
| **Large components overflow the 280x180 viewport** | Low | None (quality) | Apply `transform: scale(0.5)` with `transform-origin: top left` and double the viewport to capture the full component at half size. This is a future enhancement -- initial version clips. |
| **Preview-vendor files change location** | Low | C4 (Local-First) | Read the vendor files from the same `src/preview-vendor/` path used by LivePreview. If they move, both systems break simultaneously, making the issue visible immediately. However, since `thumbnailGenerator.ts` runs in Node.js (main process), it cannot use Vite's `?raw` import. Instead, read them via `fs.readFileSync` at startup, caching in module-scope variables. |
| **Manifest not available when project first opens** | Medium | None | `generateAll()` returns `{ total: 0 }` when `flint-manifest.json` is missing. The `useThumbnail` hook handles null gracefully. When the manifest is created later (e.g., after `flint init`), the next `generate()` call works normally. |
| **FileTransactionManager path validation rejects .png** | High | C12 / C14 | The existing `ast:save-file` handler validates that paths end in `.tsx/.ts/.jsx/.js`. PNG writes must bypass this specific handler and call `fileTransactionManager.write()` directly from `thumbnailGenerator.ts` (which is in the main process, so this is allowed). The `.write()` method itself has no extension restriction -- only the IPC handler does. This is safe because `thumbnailGenerator.ts` is in `electron/`, not `src/`. |
| **Stale `activeProjectRoot` after project switch** | Medium | None | `ThumbnailGenerator.setProjectRoot()` is called at every project-open event. The `autoInvalidateThumbnail` function reads `activeProjectRoot` which is already updated by the existing project-open handlers. |

---

## 13. Future Extensions (Out of Scope for CV2.2)

These are noted for architectural awareness but are NOT part of this contract:

- **CV2.9 -- Multi-breakpoint thumbnails:** `ThumbnailOptions` already includes `width`/`height` parameters. A future phase can generate mobile (375x667), tablet (768x1024), and desktop (1440x900) variants.
- **CV2.3 -- Build Mode canvas cards:** The consumer of `useThumbnail`. Will render thumbnail PNGs on React Flow nodes.
- **Thumbnail diff on save:** Compare the new thumbnail with the old one to detect visual regressions (useful for governance).
- **WebGL/Canvas component rendering:** Components using WebGL or `<canvas>` may not capture correctly with `capturePage()`. Needs investigation.

---

## 14. Acceptance Criteria

- [ ] `thumbnails:generate` produces a valid PNG file in `.flint/thumbnails/`.
- [ ] `thumbnails:get` returns a base64 data URL that renders as an `<img>` in the browser.
- [ ] `thumbnails:invalidate` removes the cached file; subsequent `get()` returns `null`.
- [ ] `thumbnails:generate-all` processes all components from `flint-manifest.json`.
- [ ] Saving a component file via `ast:save-file` auto-invalidates its thumbnail.
- [ ] No external network requests during thumbnail generation (Commandment 4).
- [ ] All PNG writes go through `FileTransactionManager` (Commandment 12/14).
- [ ] Hidden BrowserWindow is fully sandboxed (`nodeIntegration: false`, `contextIsolation: true`).
- [ ] Component names are sanitized to prevent path traversal.
- [ ] `useThumbnail` hook returns `{ dataUrl, isLoading, error }` with correct state transitions.
- [ ] 15 generator tests + 7 hook tests passing.
- [ ] `npx tsc --noEmit` produces 0 errors.
