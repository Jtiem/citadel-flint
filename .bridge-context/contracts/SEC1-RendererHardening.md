# Contract Artifact: SEC.1 -- Renderer Hardening

**Version:** 1.0
**Date:** 2026-03-16
**Status:** CONTRACT -- Binding specification for Phase 2 agents
**Priority:** P0
**Depends on:** None (no phase dependencies)
**Security Review Ref:** `.bridge-context/reviews/SEC-surface-review.md` findings: "srcdoc iframe has no sandbox attribute", "No CSP set via session.webRequest", "postMessage uses wildcard origin '*'"

---

## 1. Summary

Three hardening changes to the renderer layer that close the highest-priority attack surface identified in the security review:

1. **iframe sandbox attribute** -- Add `sandbox="allow-scripts allow-forms"` to the LivePreview iframe so injected code from Figma ingestion cannot escape the iframe to access `window.parent.bridgeAPI`.
2. **CSP via session.webRequest** -- Inject a Content Security Policy as an HTTP response header from the main process, providing defense-in-depth alongside the existing `<meta>` CSP in `index.html`.
3. **postMessage origin validation** -- Validate `event.origin` in the renderer's `message` event handler before processing iframe messages.

---

## 2. Impact Map

| File | Change Type | Owner Agent | Notes |
|------|------------|-------------|-------|
| `src/components/editor/LivePreview.tsx` | MODIFY | `bridge-design-engineer` | Add `sandbox` attr, add origin check in `handleMessage` |
| `electron/main.ts` | MODIFY | `bridge-electron-ipc` | Add `session.webRequest.onHeadersReceived` CSP injection in `createWindow()` |
| `src/components/editor/__tests__/LivePreview.test.tsx` | MODIFY or CREATE | `bridge-test-writer` | Tests for sandbox attr + origin rejection |
| `electron/__tests__/main-csp.test.ts` | CREATE | `bridge-test-writer` | Test that CSP header callback is registered |

---

## 3. Detailed Behavior Specification

### 3.1 iframe sandbox attribute

**File:** `src/components/editor/LivePreview.tsx` (near line 910)

The `<iframe>` element currently rendered at approximately line 910-923 has no `sandbox` attribute. Add:

```
sandbox="allow-scripts allow-forms"
```

**Critical constraint:** `allow-same-origin` MUST NOT be included. With `srcdoc` iframes, adding `allow-same-origin` gives the iframe the same origin as the parent, completely negating the sandbox. The srcdoc content executes via `new Function(code)` (line 181), so `allow-scripts` is required for the preview to function. `allow-forms` is included because user components rendered in preview may contain `<form>` elements that need to be interactable in "interact" mode.

**What still works with this sandbox:**
- `allow-scripts` -- The `new Function(code)` execution path continues to work. All inline `<script>` blocks in the srcdoc HTML continue to execute.
- `postMessage` -- The iframe's `window.parent.postMessage(...)` calls continue to work. The `postMessage` API is available regardless of sandbox restrictions. The srcdoc iframe's origin becomes `'null'` (string literal "null"), which is already the case for srcdoc iframes.
- Event listeners inside the iframe (click, hover, drag handlers installed by the Bridge interaction scripts) continue to work.
- React rendering via `ReactDOM.createRoot()` inside the iframe continues to work.

**What the sandbox blocks:**
- `window.parent.bridgeAPI` -- The iframe can no longer access the parent's `window` object or any APIs exposed on it. This is the core security fix. Previously, malicious code injected via Figma `/ingest-ast` could call `window.parent.bridgeAPI.saveFile(...)`, `window.parent.bridgeAPI.terminal.spawn(...)`, etc.
- `window.open()` -- The iframe cannot open new windows or navigate the parent.
- Top-level navigation -- The iframe cannot navigate the parent frame.
- Plugin execution -- The iframe cannot instantiate plugins.

**Vite preview path (Phase N.4):** When `previewUrl` is non-null, the iframe uses `src={previewUrl}` pointing at a localhost Vite dev server. In this mode, the iframe is already cross-origin (localhost URL vs. the Electron renderer's `file://` or Vite URL origin). The `sandbox` attribute should still be applied for defense-in-depth, but the cross-origin boundary already provides isolation. The `sandbox` attribute applies to both `src=` and `srcdoc=` modes uniformly.

### 3.2 CSP via session.webRequest

**File:** `electron/main.ts`, inside the `createWindow()` function (after line 226, before the `loadURL`/`loadFile` call)

Add a `session.defaultSession.webRequest.onHeadersReceived` callback that injects a `Content-Security-Policy` response header. This is defense-in-depth alongside the existing `<meta>` CSP in `index.html`. The header-based CSP cannot be overridden by page content, `data:` URLs, or `blob:` URLs.

**CSP directives:**

For **development builds** (`!app.isPackaged` or `process.env.VITE_DEV_SERVER_URL` is set):

```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self' ws://localhost:* http://localhost:* http://127.0.0.1:*;
img-src 'self' data: blob:;
font-src 'self' data:;
frame-src 'self' blob: http://localhost:*;
```

For **production builds** (`app.isPackaged` and no `VITE_DEV_SERVER_URL`):

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self' http://127.0.0.1:*;
img-src 'self' data: blob:;
font-src 'self' data:;
frame-src 'self' blob: http://localhost:*;
```

**Key differences between dev and production:**
- `'unsafe-eval'` in `script-src`: Required in development for Vite HMR (Hot Module Replacement), which uses `new Function()` for module evaluation. MUST be removed in production because the only `new Function()` usage in production is inside the sandboxed srcdoc iframe, which has its own CSP context.
- `ws://localhost:*` in `connect-src`: Required in development for Vite HMR WebSocket. Not needed in production.
- `http://localhost:*` in `connect-src`: Allowed in development for Vite dev server requests. Production only needs `http://127.0.0.1:*` for the ingestion server.

**Why `'unsafe-inline'` remains:** Tailwind CSS generates inline styles on components. The existing `<style>` tags in the srcdoc content also require inline style support. Removing `'unsafe-inline'` from `style-src` would break Tailwind's runtime style injection. This is an accepted trade-off documented in the security review.

**Implementation pattern:**

The callback should be registered inside `createWindow()`, after the `BrowserWindow` is created but before `loadURL`/`loadFile`. The callback intercepts all responses and appends the CSP header:

```typescript
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = app.isPackaged ? PRODUCTION_CSP : DEVELOPMENT_CSP
    callback({
        responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [csp],
        },
    })
})
```

Where `PRODUCTION_CSP` and `DEVELOPMENT_CSP` are string constants defined above `createWindow()`.

**Import:** `session` must be added to the existing Electron import on line 1: `import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, session } from 'electron'`.

### 3.3 postMessage origin validation

**File:** `src/components/editor/LivePreview.tsx`, in the `handleMessage` function (approximately line 641)

The current `handleMessage` function processes all `MessageEvent` objects without checking `event.origin`. For srcdoc iframes, the origin is the string `'null'`. For Vite preview iframes (`src=http://localhost:PORT`), the origin is `'http://localhost:PORT'`.

Add an origin validation guard at the top of `handleMessage`, before any message processing:

```typescript
function handleMessage(e: MessageEvent): void {
    // SEC.1: Only accept messages from srcdoc iframes (origin 'null')
    // or from the Vite preview server on localhost.
    if (e.origin !== 'null' && !e.origin.startsWith('http://localhost:')) return

    if (typeof e.data !== 'object' || e.data === null) return
    // ... rest of handler unchanged
}
```

**Why `'null'` as a string:** When an iframe uses `srcdoc`, its origin is the opaque origin, which is serialized as the literal string `'null'`. This is per the HTML specification. The comparison `e.origin !== 'null'` correctly matches this.

**Why `http://localhost:`:** The Vite preview server runs on localhost. The exact port varies, so we match the prefix. This is safe because only localhost origins can send postMessages to the Electron renderer window.

**Second message handler (line 197, inside srcdoc):** The message handler inside the srcdoc HTML template (the `window.addEventListener('message', ...)` at line 197) does NOT need origin validation because once the sandbox is applied, the iframe cannot access the parent origin. Messages received inside the sandboxed iframe are already restricted to `postMessage`-based communication. The handler should continue to work unchanged.

---

## 4. IPC Changes

None. This contract does not add, remove, or modify any IPC channels.

---

## 5. Store Contracts

None. This contract does not modify any Zustand stores.

---

## 6. Component Contracts

| Component | Props Changed | Store Dependencies | IPC Calls |
|-----------|--------------|-------------------|-----------|
| `LivePreview` | No prop changes | No store changes | No IPC changes |

The only changes are: (a) `sandbox` attribute added to the `<iframe>` element, (b) origin guard added to `handleMessage`.

---

## 7. Test Requirements

### 7.1 LivePreview sandbox attribute test

**File:** `src/components/editor/__tests__/LivePreview.test.tsx` (modify existing or create)

Test SEC1-01: Render `LivePreview` and assert the `<iframe>` element has `sandbox="allow-scripts allow-forms"`.

```
- Render the LivePreview component with minimal store state (editorStore with rawCode set)
- Query the DOM for the iframe element (by title="Live Preview" or role)
- Assert: iframe.getAttribute('sandbox') === 'allow-scripts allow-forms'
- Assert: iframe.getAttribute('sandbox') does NOT contain 'allow-same-origin'
```

### 7.2 postMessage origin rejection test

**File:** `src/components/editor/__tests__/LivePreview.test.tsx`

Test SEC1-02: Dispatch a `MessageEvent` with a non-null, non-localhost origin and verify the handler ignores it.

```
- Render LivePreview with a known selectedNode in editorStore
- Dispatch: window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'CANVAS_CLICK', id: 'malicious-node' },
    origin: 'https://evil.example.com'
  }))
- Assert: editorStore selectedNode has NOT changed to 'malicious-node'
```

Test SEC1-03: Dispatch a `MessageEvent` with origin `'null'` (srcdoc) and verify it IS processed.

```
- Render LivePreview with canvasMode='design'
- Dispatch: window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'CANVAS_CLICK', id: 'bridge-test-node' },
    origin: 'null'
  }))
- Assert: editorStore selectedNode changed to 'bridge-test-node'
```

### 7.3 CSP registration test

**File:** `electron/__tests__/main-csp.test.ts`

Test SEC1-04: Verify the CSP callback is registered. This may be a unit test that mocks `session.defaultSession.webRequest.onHeadersReceived` and verifies it is called during window creation, or an integration test that inspects response headers.

At minimum, verify:
- The callback is registered (function was called)
- The returned headers include `Content-Security-Policy`
- The CSP string contains `default-src 'self'`
- In production mode: the CSP does NOT contain `'unsafe-eval'`

---

## 8. Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|-------------|---------|--------------|
| 4 | Local-First Only | Yes | CSP restricts `connect-src` to `'self'` and localhost only. No external URLs permitted. |
| 7 | ID Preservation | No | No AST mutations. |
| 13 | Deterministic Surgery | No | No code generation. |

---

## 9. Implementation Order

| Step | Agent | Parallel Group | Description |
|------|-------|---------------|-------------|
| 1 | `bridge-design-engineer` | A | Add `sandbox` attr to iframe in LivePreview.tsx |
| 2 | `bridge-design-engineer` | A | Add origin validation in `handleMessage` in LivePreview.tsx |
| 3 | `bridge-electron-ipc` | A | Add CSP `session.webRequest.onHeadersReceived` in main.ts `createWindow()` |
| 4 | `bridge-test-writer` | B (after A) | Write tests SEC1-01 through SEC1-04 |
| 5 | `bridge-test-writer` | B | Run full test suite, TSC, report counts |

Steps 1+2+3 can run in parallel (Group A). Steps 4+5 run after Group A completes.

---

## 10. Risk Assessment

**Overall Risk:** LOW

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sandbox breaks Vite preview HMR | Low | HMR uses WebSocket and script injection, both permitted by `allow-scripts`. The `src=` mode for Vite already runs cross-origin. Test with a running Vite preview. |
| `allow-forms` is too permissive | Very Low | User-authored components legitimately use `<form>` elements. Removing `allow-forms` would break interact mode for any form-containing component. |
| CSP blocks Tailwind runtime styles | Low | `'unsafe-inline'` in `style-src` prevents this. Verified against current Tailwind 4 usage. |
| Origin check rejects legitimate messages | Low | srcdoc origin is reliably `'null'`; Vite preview origin is reliably `http://localhost:PORT`. Both patterns are checked. |

---

## 11. Acceptance Criteria

- [ ] The `<iframe>` in LivePreview has `sandbox="allow-scripts allow-forms"` in the rendered DOM
- [ ] The `sandbox` attribute does NOT contain `allow-same-origin`
- [ ] `session.webRequest.onHeadersReceived` is registered in `createWindow()`
- [ ] Production CSP does not include `'unsafe-eval'` in `script-src`
- [ ] Development CSP includes `'unsafe-eval'` in `script-src`
- [ ] `handleMessage` rejects `MessageEvent` objects with origin other than `'null'` or `http://localhost:*`
- [ ] All existing LivePreview functionality (click, hover, drag, drop, interact mode, Figma paste) continues to work
- [ ] Tests SEC1-01 through SEC1-04 pass
- [ ] `npx tsc --noEmit` reports 0 errors
- [ ] Full test suite passes with 0 regressions
