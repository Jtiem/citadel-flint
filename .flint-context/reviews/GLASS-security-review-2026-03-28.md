# Glass Security Review — 2026-03-28

Reviewer: Code Review Agent (claude-sonnet-4-6)
Scope: Phase GLASS structural redesign — all new and significantly modified files

---

## Verdict

**NEEDS REMEDIATION**

Two issues require a fix before ship: one SEC.3 allowlist violation in the Command Palette (tools called from the renderer that are not in `RENDERER_ALLOWED_MCP_TOOLS`) and one structural gap in the FocusTrap (no Escape-key close handler, leaving background content accessible to keyboard users). Everything else is low severity or informational.

---

## Critical (Must Fix Before Ship)

### CRIT-01 — SEC.3 Violation: `audit_ui_component` and `flint_sync_tokens` called from renderer, not in allowlist

**File:** `src/components/ui/CommandPalette.tsx` lines 169 and 277

**Attack vector:**
`RENDERER_ALLOWED_MCP_TOOLS` in `electron/mcp-policy.ts` is a defense-in-depth gate that prevents the renderer from invoking write-oriented or agent-only MCP tools. The Command Palette bypasses it for two tools that are not in the frozen allowlist:

- Line 169: `callMcp('audit_ui_component', { file: activeFilePath }, 'Audit complete')`
- Line 277: `callMcp('flint_sync_tokens', {}, 'Tokens synced from Figma')`

`audit_ui_component` is not listed in `RENDERER_ALLOWED_MCP_TOOLS` (only `flint_audit` is listed there, a different tool). `flint_sync_tokens` is explicitly excluded from the allowlist in `mcp-policy.ts` with the note "triggered by ingestion server, not Glass."

**Impact:** At runtime, the `mcp:call-tool` IPC handler will reject these calls with an access-denied error, so there is no immediate breach. However this represents:
1. A latent UI bug — both commands silently fail in production and show the "MCP not connected" fallback, which is misleading.
2. A documentation/architectural inconsistency that could lead future agents to believe the allowlist check is discretionary.

**Remediation:**
- If `audit_ui_component` is the correct tool for this command (it differs from `flint_audit` in that it takes a raw file path without needing a project context), add it to `RENDERER_ALLOWED_MCP_TOOLS` with a documented rationale. If `flint_audit` is sufficient, update line 169 to call `flint_audit` instead.
- For `flint_sync_tokens`: the comment in `mcp-policy.ts` says this is server-triggered. If a user-initiated sync from the Command Palette is a legitimate use case, add the tool to the allowlist and document it. If not, remove the Command Palette entry entirely.
- Either way, add a test to `electron/__tests__/mcp-policy.test.ts` covering both tool names.

---

## High

### HIGH-01 — FocusTrap: No Escape-key handler — background content remains reachable via assistive tech

**File:** `src/components/ui/FocusTrap.tsx` lines 99–129

**Description:**
FocusTrap correctly intercepts Tab/Shift+Tab to keep keyboard focus within a modal. However it does not handle the Escape key, and it does not set `aria-modal="true"` on its container div. The result:

1. Screen reader users in "browse mode" (NVDA, JAWS, VoiceOver) can navigate past the trap boundaries using arrow keys or virtual cursor movement regardless of the Tab trap. The `aria-modal` attribute on the dialog container is the correct signal to tell assistive technology to treat content outside the dialog as inert.

2. No Escape-key close mechanism is provided. The component accepts no `onClose` prop and fires no close event on Escape. Every consumer must implement its own Escape handler. If a consumer omits it (easy to miss), the modal can only be closed with a pointer device.

**Attack vector:** A keyboard-only user who triggers a modal has no standard path to close it if the consumer forgets to handle Escape. The trap also does not protect `aria-hidden` subtrees: screen reader virtual navigation can escape the trap entirely.

**Remediation:**
1. Add an optional `onClose` prop. When provided, listen for `keydown` with `key === 'Escape'` and invoke it.
2. Forward `role="dialog"` and `aria-modal="true"` to the container div, or require the consumer to set these attributes on the element passed as `children`. Document this requirement clearly in the component JSDoc.
3. Consider using the native `<dialog>` element for new modal usage going forward — it gets `aria-modal` semantics and Escape-close for free.

---

## Medium

### MED-01 — postMessage target origin is wildcard `'*'` for all outgoing iframe messages

**File:** `src/components/editor/LivePreview.tsx` lines 673, 681, 683, 776, 814, 820, 846, 864, 876, 886–889, 896–899

**Description:**
Every `contentWindow.postMessage(...)` call from the host to the iframe uses `'*'` as the target origin. When the iframe is in `srcdoc` mode its origin is the opaque string `'null'`, so specifying `'null'` as the target would be strictly correct. When the iframe loads a Vite preview URL (Phase N.4), the correct target would be the Vite origin (e.g., `http://localhost:5173`).

Using `'*'` means that if any attacker-controlled page were ever loaded in the iframe position (e.g., via a TOCTOU race on `previewUrl`, or a future refactor mistake), it would receive all postMessage traffic including `HIGHLIGHT` IDs, `DRAG_MOVE` coordinates, and `SET_INTERACT_MODE` states.

**Current risk level:** Low-medium. The iframe is sandboxed (`allow-scripts allow-forms`, no `allow-same-origin`) and the messages themselves do not carry secrets — they carry only flint IDs and canvas coordinates. No credentials or file paths are sent over postMessage. Still, this violates the principle of least privilege.

**Remediation:**
Store the active preview origin at the time the iframe loads (`handleIframeLoad`). Use that stored origin as the second argument to all `postMessage` calls. Fall back to `'null'` when in srcdoc mode. A helper like:

```ts
function getIframeOrigin(): string {
  return previewUrl != null
    ? new URL(previewUrl).origin
    : 'null'
}
```

would eliminate the wildcard usage.

---

### MED-02 — Drag payload `importPath` is used unsanitized in a backtick JSX snippet

**Files:**
- `src/components/editor/LivePreview.tsx` lines 1212–1213 and 1456–1457
- `src/components/ui/ComponentPanelCard.tsx` lines 71–74

**Description:**
When a component card is dropped onto the LivePreview, the `importPath` value from the drag payload is interpolated directly into a JSX `import` statement:

```ts
importSnippet: `import { ${name} } from '${importPath}';`
```

The drag payload originates from `ComponentPanelCard.handleDragStart`, which serializes `{ name, importPath }` from `componentCardStore` card data. That data ultimately comes from `flint-manifest.json` and the registry, both of which are populated by MCP agents and the ingestion server.

If an agent or a malicious Figma payload were to write a component with `importPath` containing a single quote or a newline character, the generated `importSnippet` would contain syntactically malformed or potentially injected import statements. Because this string is subsequently passed to `editorStore.applyBatch` and then through Babel AST surgery (Commandment 13), a syntax error would cause the AST parse to fail gracefully rather than execute malicious code. However, the generated code could also contain:

- A broken import that silently does nothing
- An import that points to an unexpected path if the registry is compromised

**Risk:** Low-medium in the current architecture (Babel parse will reject syntactically invalid input), but the lack of sanitization is a latent risk.

**Remediation:**
Validate `importPath` against a simple allowlist pattern (e.g., must match `^[a-zA-Z0-9@/_.-]+$`) before constructing the snippet. Reject the drop if validation fails and push a notification. Apply the same validation to `name`.

---

### MED-03 — `event.reason` from the Figma error IPC event is rendered in a notification message without sanitization

**File:** `src/components/editor/StatusBar.tsx` line 192

**Description:**
```ts
message: `HTTP ${event.statusCode}: ${event.reason}`,
```

`event.reason` comes from the Figma ingestion server's HTTP error response (a string forwarded via the `figma-error` IPC channel from `electron/ingestion-server.ts`). This string is displayed in a toast notification. Notifications are rendered as plain text in `NotificationCenter.tsx` (confirmed at line 123: `{notification.message}`), so there is no XSS vector here.

However, if a compromised Figma plugin or SSRF payload causes the ingestion server to return a crafted `reason` string, that string reaches the UI unfiltered. Because the render path is plain text interpolation (no `dangerouslySetInnerHTML`), the concrete risk is message spoofing or UI confusion rather than code execution.

**Remediation:**
Truncate `event.reason` to a safe maximum length (e.g., 200 characters) before embedding it in the message string. Consider stripping non-printable characters on the main-process side where the event is constructed.

---

## Low / Informational

### LOW-01 — PanelErrorBoundary: `handleCopyError` copies only `error.message`, not the stack trace — this is correct

**File:** `src/components/ui/PanelErrorBoundary.tsx` lines 47–49

**Assessment:** The "Copy Error" button copies only `error.message` (not `error.stack`). This is intentional and correct for a production build. Stack traces containing file paths and line numbers are not exposed to the UI. The full error with `componentStack` is only written to `console.error`, which is appropriate for development. No action required.

---

### LOW-02 — FocusTrap: Tab-wrap logic only fires when focus is exactly at the boundary element

**File:** `src/components/ui/FocusTrap.tsx` lines 112–124

**Description:**
The Tab wrap fires only when `document.activeElement === first` (for Shift+Tab) or `document.activeElement === last` (for Tab). If focus lands outside the trap entirely (e.g., because a dynamically added element was removed while focused, causing focus to shift to `document.body`), the trap will not redirect it back. This is a minor robustness gap, not a security issue.

**Remediation (optional):** Add a `focusin` listener that checks whether `document.activeElement` is inside the container. If not, redirect focus to `first`. This would make the trap resilient to focus loss during dynamic DOM mutations.

---

### LOW-03 — `CSS.escape` usage in FileExplorer is correct

**File:** `src/components/ui/FileExplorer.tsx` line 299

**Assessment:**
```ts
treeRef.current?.querySelector(`[data-file-path="${CSS.escape(path)}"]`)
```

`CSS.escape` is applied correctly. `path` is a user-controlled file path string. Without escaping, a path containing characters like `"`, `]`, or `\` could break out of the attribute selector. The escape call is present and sufficient. No action required.

---

### LOW-04 — CommandPalette `flint_fix` command uses local `applyBatch`, not the MCP tool — correct SEC.3 bypass

**File:** `src/components/ui/CommandPalette.tsx` lines 183–195

**Assessment:**
The "Auto-fix Tier-1 Violations" command (id: `gov-fix`) deliberately does NOT call `window.flintAPI.mcp.callTool('flint_fix', ...)`. Instead it reads violations from the editor store and calls `useEditorStore.getState().applyBatch(fixOps)` directly. A comment explains: "Use applyBatch for auto-fix (flint_fix is not in SEC.3 renderer allowlist)." This is the architecturally correct pattern (Commandment 13: Babel AST surgery through the store, not MCP). No action required.

---

### LOW-05 — `useUnifiedViolations.ts` listed in the audit scope but is deleted (Sprint 2)

**Assessment:**
The file `src/hooks/useUnifiedViolations.ts` was deleted in Sprint 2 (confirmed in `CLAUDE.md` and git status). No review of a deleted file is possible. Its functionality was merged into `GovernanceDashboard.tsx` which is reviewed above. No action required.

---

### LOW-06 — `GovernanceOverlay.tsx` listed in audit scope but is deleted (Sprint 2)

**Assessment:**
The file `src/components/editor/GovernanceOverlay.tsx` does not exist in the current tree. The Fix All functionality previously in `GovernanceOverlay` now lives in `GovernanceDashboard.handleFixAll`. The Fix All path in `GovernanceDashboard` uses `editorStore.applyBatch` with the `applyTokenFix` op, which is the correct pattern. No action required.

---

## Process Boundary Audit

All reviewed `src/` files are clean of Node.js APIs.

| File | Verdict |
|---|---|
| `src/App.tsx` | Clean. All cross-boundary calls go through `window.flintAPI`. No `fs`, `require`, or `sqlite`. |
| `src/components/ui/FocusTrap.tsx` | Clean. Pure DOM manipulation, no Node.js. |
| `src/components/ui/PanelErrorBoundary.tsx` | Clean. Uses only `navigator.clipboard` and `console.error`. |
| `src/components/ui/ComponentPanel.tsx` | Clean. Uses only store selectors and `window.flintAPI` (indirectly through store actions). |
| `src/components/ui/GovernanceDashboard.tsx` | Clean. Uses `window.flintAPI.mcp?.callTool`, `window.flintAPI.baseline`, `window.flintAPI.governance` — all through contextBridge. |
| `src/components/editor/StatusBar.tsx` | Clean. All Figma status, MCP, and beta calls through `window.flintAPI`. |
| `src/components/editor/XYCanvas.tsx` | Clean. Only `@xyflow/react` and canvas store interactions. No IPC. |
| `src/store/canvasStore.ts` | Clean. No IPC calls inside the store. Mutations that need IPC (e.g., `triggerAutoSave`) delegate to `window.flintAPI.saveFile` through an action, not from within the store's reactive core. |
| `src/store/notificationStore.ts` | Clean. Pure Zustand state, no IPC. |

---

## SEC.3 Compliance

The allowlist in `electron/mcp-policy.ts` defines 7 permitted tools:

```
flint_status, flint_audit, flint_debt_report, flint_query_registry,
flint_generate_dbom, flint_accessibility_report, flint_audit_report
```

All renderer-side `mcp.callTool(...)` calls found in `src/`, with allowlist status:

| Call site | Tool | In allowlist? |
|---|---|---|
| `CommandPalette.tsx:169` | `audit_ui_component` | NO — see CRIT-01 |
| `CommandPalette.tsx:277` | `flint_sync_tokens` | NO — see CRIT-01 |
| `CommandPalette.tsx:318` | `flint_query_registry` | YES |
| `GovernanceDashboard.tsx:570` | `flint_audit` | YES |
| `ExportModal.tsx:252` | `flint_generate_dbom` | YES |
| `ComponentSearch.tsx:126` | `flint_query_registry` | YES |
| `SetupWizard.tsx:251` | `flint_status` | YES |

5 of 7 calls are compliant. 2 are violations (CRIT-01 above).

**Note:** The Command Palette `gov-fix` command (id: `gov-fix`) correctly avoids calling `flint_fix` via MCP and uses `editorStore.applyBatch` instead. This was verified at line 194.

---

## Summary of Action Items

| Priority | ID | File | Action |
|---|---|---|---|
| Must fix | CRIT-01 | `CommandPalette.tsx` | Add `audit_ui_component` to allowlist (or replace with `flint_audit`); remove or allowlist `flint_sync_tokens` |
| Must fix | HIGH-01 | `FocusTrap.tsx` | Add `onClose`/Escape prop; add `aria-modal` to container |
| Recommended | MED-01 | `LivePreview.tsx` | Replace `'*'` postMessage target with computed iframe origin |
| Recommended | MED-02 | `LivePreview.tsx`, `ComponentPanelCard.tsx` | Validate `name` and `importPath` against allowlist pattern before JSX construction |
| Recommended | MED-03 | `StatusBar.tsx` | Truncate and sanitize `event.reason` before embedding in toast message |
| Optional | LOW-02 | `FocusTrap.tsx` | Add `focusin` listener to recover from mid-session focus loss |
