# Validation Plan: CV2.2 -- Component Thumbnail Generator

**Phase:** CV2.2 -- Canvas Visual Mode Infrastructure
**Validator:** flint-integration-validator
**Date:** 2026-03-20

---

## 1. Pre-Validation Checklist

Before running integration validation, confirm all Phase 2 deliverables exist:

- [ ] `electron/thumbnailGenerator.ts` exists and exports `ThumbnailGenerator` class
- [ ] `electron/__tests__/thumbnailGenerator.test.ts` exists with 15+ test cases
- [ ] `src/hooks/useThumbnail.ts` exists and exports `useThumbnail` hook
- [ ] `src/hooks/__tests__/useThumbnail.test.ts` exists with 7+ test cases
- [ ] `electron/main.ts` has 4 IPC handlers registered (`thumbnails:*`)
- [ ] `electron/preload.ts` has `thumbnails` namespace in `contextBridge.exposeInMainWorld`
- [ ] `src/types/flint-api.d.ts` has `ThumbnailsAPI` interface and `thumbnails` on `FlintAPI`

---

## 2. Type Safety Gate

```bash
npx tsc --noEmit
```

**Pass criteria:** 0 errors. No `@ts-ignore` or `@ts-expect-error` added.

---

## 3. Test Suite Gate

### 3.1 Core + Electron Tests

```bash
npm test -- --reporter verbose
```

**Pass criteria:** All existing tests pass + 15 new TG-* tests pass.

### 3.2 React Component Tests

```bash
npm run test:react -- --reporter verbose
```

**Pass criteria:** All existing tests pass + 7 new TH-* tests pass.

### 3.3 MCP Tests (Regression Only)

```bash
cd flint-mcp && npm test
```

**Pass criteria:** No regressions. CV2.2 does not touch MCP code, so the count should be unchanged.

### 3.4 Report Format

```
Core:  XXX/XXX passing (15 new)
Glass: XXX/XXX passing (7 new)
MCP:   XXX/XXX passing (0 new)
TSC:   0 errors
```

---

## 4. Contract Compliance Checks

### 4.1 IPC Channel Verification

For each IPC channel defined in the contract, verify:

| Channel | Check | How |
|---------|-------|-----|
| `thumbnails:generate` | Registered in main.ts | Grep for `ipcMain.handle('thumbnails:generate'` |
| `thumbnails:generate-all` | Registered in main.ts | Grep for `ipcMain.handle('thumbnails:generate-all'` |
| `thumbnails:get` | Registered in main.ts | Grep for `ipcMain.handle('thumbnails:get'` |
| `thumbnails:invalidate` | Registered in main.ts | Grep for `ipcMain.handle('thumbnails:invalidate'` |

### 4.2 Preload Surface Verification

Verify `electron/preload.ts` exposes exactly the 4 methods defined in the `ThumbnailsAPI` interface:

```bash
grep -A 20 'thumbnails:' electron/preload.ts
```

Confirm each method maps to the correct `ipcRenderer.invoke` channel.

### 4.3 Type Alignment

Verify `src/types/flint-api.d.ts`:
- `ThumbnailsAPI` interface exists with `generate`, `generateAll`, `get`, `invalidate` methods
- `FlintAPI` interface has `thumbnails: ThumbnailsAPI` property
- Method signatures match the contract (payload types, return types)

### 4.4 Hook Interface Verification

Verify `src/hooks/useThumbnail.ts`:
- Exports `useThumbnail(componentName: string, filePath: string)` function
- Return type matches `{ dataUrl: string | null; isLoading: boolean; error: string | null }`
- Uses `window.flintAPI.thumbnails.get()` and `window.flintAPI.thumbnails.generate()`
- Has proper `useEffect` cleanup (no lingering promises after unmount)

---

## 5. Commandment Compliance Verification

### C4: Local-First Only

**Check:** Inspect `buildThumbnailHtml()` in `electron/thumbnailGenerator.ts`.
- No `http://` or `https://` URLs in the HTML template
- React UMD, ReactDOM UMD, and Tailwind CDN are loaded from local files
- No `fetch()` or `XMLHttpRequest` calls

**How:** `grep -n 'http://' electron/thumbnailGenerator.ts` should return 0 matches. Same for `https://` (except CSP meta tag which uses `https:` as a protocol, not a URL -- verify this is a CSP directive, not a resource load).

### C12: Atomic Queuing

**Check:** All PNG writes go through `fileTransactionManager.write()`.
- No direct `fs.writeFile` calls for PNG output in `thumbnailGenerator.ts`
- `fileTransactionManager` is imported and used

**How:** `grep -n 'writeFile\|writeFileSync' electron/thumbnailGenerator.ts` should return 0 matches. `grep -n 'fileTransactionManager' electron/thumbnailGenerator.ts` should return at least 1 match.

### C14: Bypass Prohibition

**Check:** Same as C12. Additionally verify no `fs.writeFile` or `fs.writeFileSync` for any stateful output.
- `fs.readFile` and `fs.readFileSync` are allowed for reading source files and vendor JS.
- `fs.existsSync` is allowed for cache existence checks.
- `fs.unlink` is allowed for cache invalidation (deletion).
- `fs.mkdir` is allowed for creating the `.flint/thumbnails/` directory.

### Process Boundary

**Check:** No Node.js imports in `src/hooks/useThumbnail.ts` or any file under `src/`.
- `grep -rn "from 'node:" src/hooks/useThumbnail.ts` should return 0 matches
- `grep -rn "require('fs')" src/hooks/useThumbnail.ts` should return 0 matches
- The hook uses only `window.flintAPI.thumbnails.*` for all operations

---

## 6. Security Verification

### 6.1 Component Name Sanitization

**Check:** `ThumbnailGenerator.generate()` rejects or sanitizes component names containing path traversal characters.

**Test:** Verify TG-14 exists and passes -- a component name like `../../../etc/passwd` should be rejected or sanitized to `etcpasswd`.

### 6.2 BrowserWindow Sandboxing

**Check:** The hidden BrowserWindow constructor options include:

```typescript
{
    show: false,
    webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        // No preload script
    }
}
```

**How:** Read the `generate()` method in `thumbnailGenerator.ts` and verify these options are set.

### 6.3 No User-Controlled HTML Injection

**Check:** The component source code is embedded via `JSON.stringify()` + `type="application/json"` (same pattern as LivePreview's `buildSrcdoc`), not via direct string interpolation into a `<script>` tag.

---

## 7. Performance Spot Checks

These are informational -- they do not block SHIP but are reported in the validation output.

| Metric | Target | Measured | Status |
|--------|--------|----------|--------|
| Single thumbnail generation | < 2,000 ms | _TBD_ | |
| Cached thumbnail retrieval | < 50 ms | _TBD_ | |
| Preview-vendor memory footprint | ~3 MB | _TBD_ | |

**Note:** Performance metrics are measured during test execution. If a BrowserWindow mock is used in tests, the generation timing is not meaningful -- only manual testing or integration tests with a real Electron environment can validate the 2-second target.

---

## 8. Integration Smoke Test

If running in a full Electron environment (not CI with mocked BrowserWindow):

1. Open a project with `flint-manifest.json` containing at least one component.
2. Call `window.flintAPI.thumbnails.generate({ filePath: '<component-path>', componentName: '<name>' })` from the DevTools console.
3. Verify a PNG file appears at `.flint/thumbnails/<name>.png`.
4. Call `window.flintAPI.thumbnails.get('<name>')` and verify a base64 data URL is returned.
5. Create an `<img>` element with that data URL as `src` and verify it renders.
6. Edit the component source file and save.
7. Call `window.flintAPI.thumbnails.get('<name>')` and verify it returns `null` (auto-invalidated).
8. Call `window.flintAPI.thumbnails.generate(...)` again and verify a new PNG is created.

---

## 9. Verdict Criteria

| Condition | Required for SHIP |
|-----------|------------------|
| TSC 0 errors | Yes |
| All existing tests pass (0 regressions) | Yes |
| 15+ generator tests pass (TG-01 through TG-15) | Yes |
| 7+ hook tests pass (TH-01 through TH-07) | Yes |
| 4 IPC channels registered in main.ts | Yes |
| Preload surface matches ThumbnailsAPI contract | Yes |
| FlintAPI type includes thumbnails property | Yes |
| C4 (Local-First) verified | Yes |
| C12/C14 (Atomic Queuing / Bypass Prohibition) verified | Yes |
| Process boundary respected (no Node.js in src/) | Yes |
| Component name sanitization present | Yes |
| BrowserWindow sandboxing present | Yes |

**Verdict options:**
- **SHIP** -- All conditions met.
- **FIX** -- Minor issues found; list specific fixes required. Re-validate after fixes.
- **REDESIGN** -- Architectural issues found; return to Phase 1 for contract revision.
