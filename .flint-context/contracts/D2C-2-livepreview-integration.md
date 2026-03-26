# Contract: D2C.2 -- LivePreview Integration

**Phase:** D2C.2 -- Wire `flint_design_to_code` Output into Glass LivePreview
**Date:** 2026-03-25
**Prerequisites:** D2C (flint_design_to_code MCP tool -- ONLINE), Phase E (FileTransactionManager -- ONLINE), Phase A (LivePreview srcdoc engine -- ONLINE), Phase F.1 (File Tree UI -- ONLINE)
**Owner:** flint-electron-ipc (IPC handler + preload), flint-design-engineer (apply hook), flint-test-writer (tests)

---

## 1. Problem Statement

`flint_design_to_code` generates multi-component page code (N section components + 1 page compositor) but the output currently lives only in the MCP tool response text. There is no pipeline to:

1. Persist the generated components as `.tsx` files on disk
2. Set the page compositor as the active editor file
3. Have LivePreview render the full page immediately
4. Refresh the file tree sidebar to reflect the new files

The designer must currently copy-paste generated code manually. D2C.2 closes this gap with a single IPC call that atomically writes all files, refreshes the workspace tree, and opens the page compositor -- at which point LivePreview picks it up through the existing `setCode` pipeline.

---

## 2. Architecture Decision: Main-Process Orchestration

### Why the main process owns the apply flow

The D2C apply operation involves:
- Creating directories (`fs.mkdir`)
- Writing N+1 files atomically (`FileTransactionManager.writeBatch`)
- Re-scanning the workspace tree (`scanDirectory`)
- Shadow-committing the new files (`GitManager.shadowCommit`)

All of these are Node.js / main-process operations (Commandment 14: no `fs` in `src/`). The renderer sends the `DesignToCodeResult` payload over IPC and receives back the new workspace tree + page file path. The renderer then calls the existing `canvasStore.setActiveFile(pagePath)` to hydrate the editor.

### Why NOT a store action

The apply flow is imperative (write files, scan, return result) not reactive state. It belongs in a React hook that calls IPC, not in a Zustand store action (which would violate the anti-pattern of calling `window.flintAPI` inside a store).

### File creation strategy: `src/components/generated/<PageName>/`

Generated files are placed under `src/components/generated/<PageName>/` inside the active project root. Rationale:

- **Deterministic path**: No user dialog required -- instant feedback.
- **Namespace isolation**: Each D2C invocation gets its own folder, preventing collisions.
- **Discoverable**: The `generated/` convention signals these are machine-produced files.
- **Overwrite-safe**: If the same page name is generated twice, files are overwritten (the user can undo via Git Time Machine).

The page compositor file is `<PageName>.tsx` at the folder root. Section components are sibling files `<SectionName>.tsx`. The theme file (if present) is written to the project root at its declared filename.

### Canvas integration: No new canvas nodes needed

Each section is a `<SectionName />` React component rendered inside the page compositor. LivePreview already renders the full component tree of the active file. Since the page compositor imports and renders all sections, the entire page appears in the single LivePreview iframe. Each section's JSX elements get `data-flint-id` attributes via `injectFlintIds` (Commandment 7), making them individually selectable in the layer tree.

If the user wants to inspect a specific section, they can click its file in the tree sidebar and LivePreview will render that section in isolation.

---

## 3. Impact Map

### Files to CREATE

| File | Purpose | Owner |
|------|---------|-------|
| `src/hooks/useDesignToCodeApply.ts` | React hook: receives `DesignToCodeResult`, calls `d2c:apply` IPC, sets active file, handles errors | flint-design-engineer |
| `src/hooks/__tests__/useDesignToCodeApply.test.ts` | Tests for the apply hook (mock IPC, verify flow) | flint-test-writer |

### Files to MODIFY

| File | Change | Owner |
|------|--------|-------|
| `electron/main.ts` | Add `d2c:apply` IPC handler + `workspace:rescan` IPC handler | flint-electron-ipc |
| `electron/preload.ts` | Add `designToCode: { apply }` and `rescanWorkspace` to `window.flintAPI` surface | flint-electron-ipc |
| `src/types/flint-api.d.ts` | Add `D2CApplyRequest`, `D2CApplyResult`, `DesignToCodeAPI` types; add `rescanWorkspace` | flint-electron-ipc |

### Files UNCHANGED (verified)

| File | Why unchanged |
|------|---------------|
| `src/components/editor/LivePreview.tsx` | LivePreview already renders whatever `editorStore.rawCode` contains. Once `setActiveFile` loads the page compositor, LivePreview auto-renders it. No changes needed. |
| `src/components/editor/XYCanvas.tsx` | The LivePreview node on the canvas does not change. New files appear in the sidebar tree, not as new canvas nodes. |
| `src/store/editorStore.ts` | `setCode` is called by `setActiveFile` which is already the entry point. No new actions needed. |
| `src/store/canvasStore.ts` | `setActiveFile` and `setWorkspaceFiles` already exist. The hook calls them -- no new store state. |
| `src/core/ASTService.ts` | No AST mutations happen during D2C apply. Files are written as-is from the MCP tool output. `injectFlintIds` runs in the main process before writing. |
| `electron/FileTransactionManager.ts` | Used as-is via `writeBatch`. No changes needed. |
| `electron/orchestrator.ts` | D2C is an MCP tool, not an orchestrator tool. No changes. |
| `flint-mcp/src/tools/designToCode.ts` | The MCP tool returns the result. The apply pipeline is entirely Glass-side. |

---

## 4. Type Contracts

### 4.1 IPC Payload Types

```typescript
/**
 * Request payload for the d2c:apply IPC channel.
 * Mirrors the shape of DesignToCodeResult from the MCP tool
 * but only carries the fields needed for file creation.
 */
interface D2CApplyRequest {
    /** Page name used as the folder name under src/components/generated/ */
    pageName: string
    /** Section components to write as individual .tsx files */
    components: Array<{
        name: string
        code: string
    }>
    /** Page compositor that imports and assembles all sections */
    page: {
        name: string
        code: string
    }
    /** Optional theme file to write at the project root */
    themeFile?: {
        filename: string
        code: string
    }
}

/**
 * Response from d2c:apply IPC channel.
 */
interface D2CApplyResult {
    /** Whether all files were written successfully */
    ok: boolean
    /** Absolute path to the page compositor file (for setActiveFile) */
    pageFilePath: string
    /** Absolute paths of all written component files */
    componentFilePaths: string[]
    /** Refreshed workspace file tree */
    workspaceTree: FileTreeNode
    /** Error message if ok === false */
    error?: string
}
```

### 4.2 Preload Surface Addition

```typescript
interface FlintAPI {
    // ... existing surface ...

    /** Design-to-code pipeline integration */
    designToCode: {
        /**
         * Writes generated component files to disk, refreshes the workspace
         * tree, and returns the page compositor path for setActiveFile.
         */
        apply: (request: D2CApplyRequest) => Promise<D2CApplyResult>
    }

    /**
     * Re-scans the active project directory and returns the updated FileTreeNode.
     * Useful after any operation that creates/deletes files outside the normal
     * save-file flow (D2C apply, template scaffolding, etc.).
     *
     * Returns null if no project is open (activeProjectRoot is null).
     */
    rescanWorkspace: () => Promise<FileTreeNode | null>
}
```

---

## 5. IPC Channels

| Channel | Direction | Payload Type | Return Type | Owner |
|---------|-----------|-------------|-------------|-------|
| `d2c:apply` | renderer -> main | `D2CApplyRequest` | `D2CApplyResult` | flint-electron-ipc |
| `workspace:rescan` | renderer -> main | (none) | `FileTreeNode \| null` | flint-electron-ipc |

### 5.1 `d2c:apply` Handler (main process)

Pseudocode for the IPC handler in `electron/main.ts`:

```
ipcMain.handle('d2c:apply', async (_event, request: D2CApplyRequest):
    1. Validate request shape (pageName, components array, page object)
    2. Validate activeProjectRoot is set (project must be open)
    3. Compute target directory:
       targetDir = path.join(activeProjectRoot, 'src/components/generated', request.pageName)
    4. Ensure targetDir exists:
       await mkdir(targetDir, { recursive: true })
    5. Build file batch (Map<absolutePath, content>):
       For each component:
         - Parse code with Babel
         - Run injectFlintIds on the AST (Commandment 7)
         - Generate code from the AST
         - Add to batch: path.join(targetDir, `${component.name}.tsx`) => code
       For the page compositor:
         - Parse, injectFlintIds, generate
         - Fix import paths: replace './<Name>' with './<Name>'
           (already correct since all files are siblings in the same dir)
         - Add to batch: path.join(targetDir, `${request.page.name}.tsx`) => code
       For the optional theme file:
         - Add to batch: path.join(activeProjectRoot, request.themeFile.filename) => code
    6. Security validation (same as ast:save-batch):
       - All paths must be absolute
       - All paths must end with .tsx/.ts/.jsx/.js (or theme file extension)
       - All paths must be within the user's home directory
    7. Write all files atomically:
       await fileTransactionManager.writeBatch(batch)
    8. Shadow commit:
       await gitManager.shadowCommit(targetDir)
    9. Re-scan workspace:
       const tree = await scanDirectory(activeProjectRoot)
   10. Return D2CApplyResult:
       { ok: true, pageFilePath, componentFilePaths, workspaceTree: tree }
```

### 5.2 `workspace:rescan` Handler (main process)

```
ipcMain.handle('workspace:rescan', async ():
    1. If activeProjectRoot is null, return null
    2. return await scanDirectory(activeProjectRoot)
```

This is a general-purpose utility. D2C.2 uses it, but future features (external file sync, template scaffolding) will also benefit.

---

## 6. Store Contracts

No new store state is required. The hook uses existing actions:

| Store | Existing Action Used | Purpose in D2C.2 |
|-------|---------------------|-------------------|
| `canvasStore` | `setWorkspaceFiles(tree)` | Update sidebar tree after files are created |
| `canvasStore` | `setActiveFile(pagePath)` | Open the page compositor in the editor |
| `canvasStore` | `setCanvasView('preview')` | Ensure canvas is in preview mode |
| `editorStore` | (via `setActiveFile`) | `setCode` is called internally by `setActiveFile` |
| `historyStore` | (via `setActiveFile`) | History is cleared by `setCode` for the new file |
| `notificationStore` | `addNotification(...)` | Success/error toast after apply |

---

## 7. Component Contracts

### 7.1 `useDesignToCodeApply` Hook

```typescript
/**
 * Hook: src/hooks/useDesignToCodeApply.ts
 *
 * Provides a single `applyDesignToCode` function that:
 *   1. Calls window.flintAPI.designToCode.apply(request)
 *   2. On success: updates workspace tree, opens the page file, shows toast
 *   3. On error: shows error toast
 *
 * This hook is the ONLY place IPC is called for D2C apply.
 * Components call the hook; the hook calls IPC; the hook updates stores.
 */

interface UseDesignToCodeApplyReturn {
    /** Call with a D2CApplyRequest to write files and open the page */
    applyDesignToCode: (request: D2CApplyRequest) => Promise<boolean>
    /** True while the apply IPC is in flight */
    isApplying: boolean
}

function useDesignToCodeApply(): UseDesignToCodeApplyReturn
```

**Store dependencies:** `canvasStore` (setWorkspaceFiles, setActiveFile, setCanvasView), `notificationStore` (addNotification).

**IPC calls:** `window.flintAPI.designToCode.apply`.

**Flow:**

```
User triggers D2C apply (from Activity Feed tool_call card, or MCP push)
  |
  v
useDesignToCodeApply.applyDesignToCode(request)
  |
  +--> setIsApplying(true)
  |
  +--> await window.flintAPI.designToCode.apply(request)
  |      |
  |      v [main process]
  |      mkdir + injectFlintIds + writeBatch + shadowCommit + scanDirectory
  |      |
  |      v [returns D2CApplyResult]
  |
  +--> canvasStore.setWorkspaceFiles(result.workspaceTree)
  |
  +--> canvasStore.setCanvasView('preview')
  |
  +--> await canvasStore.setActiveFile(result.pageFilePath)
  |      |
  |      v [existing flow]
  |      clearAST -> readFile -> setCode -> LivePreview re-renders
  |
  +--> notificationStore.addNotification({ type: 'success', ... })
  |
  +--> setIsApplying(false)
  |
  +--> return true
```

### 7.2 Where the Hook is Called

The hook is consumed by components that display MCP tool results. The primary integration point is the **Activity Feed** -- when a `flint_design_to_code` tool_call result arrives, the Activity Feed card can include an "Apply to Canvas" button that invokes `applyDesignToCode`.

A secondary integration point is the **MCP Push Channel** -- when an IDE agent calls `flint_design_to_code` and the result is pushed to Glass via `mcp-events.jsonl`, the push listener can auto-apply or surface a confirmation toast.

These UI integration points are intentionally left to the consuming component. The hook provides the capability; the caller decides the trigger.

---

## 8. Undo / Recovery Plan

### Single-operation undo via Git Time Machine

D2C apply creates new files on disk. The standard undo mechanism (Cmd+Z via historyStore) operates at the AST mutation level within a single file -- it cannot "un-create" files.

Instead, D2C apply is recoverable via two mechanisms:

1. **Git Time Machine (Phase D.2):** Every D2C apply triggers a `shadowCommit`. The user can open the Recovery Panel and revert to the commit before the D2C apply, which restores the workspace to its pre-generation state. This is the coarse-grained undo.

2. **File deletion:** The user can delete the `src/components/generated/<PageName>/` folder and re-scan the workspace. This is a manual escape hatch.

3. **Per-file editing:** Once the page compositor is open, every individual edit (className changes, node moves, etc.) goes through the normal `applyBatch` pipeline with full Cmd+Z undo support.

### Why NOT a batch AST undo

The files did not exist before D2C apply. There is no "previous code" to restore via `applyInversions`. Creating a synthetic "delete all generated files" inverse would require a new `InverseMutation` type (`deleteFile`) and modifications to `recoveryController.ts`. This is over-engineered for v1. Git Time Machine already covers this case cleanly.

### Future enhancement (not in scope)

Phase D2C.3 could add a "d2c:revert" IPC channel that deletes the generated folder and re-scans the workspace, providing a one-click undo. This is a follow-up.

---

## 9. Commandment Checklist

| # | Commandment | Applies? | How satisfied |
|---|-------------|----------|---------------|
| 1 | Code is Truth | YES | All components are written to `.tsx` files on disk via FileTransactionManager before LivePreview renders them. Nothing is ephemeral. |
| 2 | No Hallucinated Styling | PARTIAL | D2C output already uses token-mapped classes from the MCP tool. The apply pipeline does not introduce new styling. Mithril linting runs automatically when the file is loaded into the editor via `setCode`. |
| 3 | Composite IDs for Arrays | N/A | No `Array.map` elements are generated by the apply pipeline. |
| 4 | Local-First Only | YES | All processing is local. No external URLs. LivePreview remains 100% offline. |
| 5 | Accessibility is Compiler Error | YES | A11yLinter.audit runs automatically inside `editorStore.setCode` when the page compositor is loaded. Violations appear immediately. |
| 6 | Gatekeeper Rule | YES | Export Gate reads from `canvasStore.canExport()` which checks mithrilViolations and a11yViolations. These are populated on file load. |
| 7 | ID Preservation | YES | `injectFlintIds` is called on every generated component AST in the main-process handler before writing to disk. When `setCode` re-parses the file, IDs are already present. |
| 12 | Atomic Queuing | YES | All files written via `fileTransactionManager.writeBatch`. Single atomic operation. |
| 13 | Deterministic Surgery | YES | `injectFlintIds` uses Babel AST traversal. No regex on source code. |
| 14 | Bypass Prohibition | YES | All file writes go through FileTransactionManager. `mkdir` is the only direct `fs` call, and it only creates directories (not source files). |

---

## 10. Implementation Order

### Phase 2a: IPC Layer (flint-electron-ipc) -- No dependencies

1. Add `D2CApplyRequest` and `D2CApplyResult` types to `src/types/flint-api.d.ts`
2. Add `workspace:rescan` IPC handler to `electron/main.ts`
3. Add `d2c:apply` IPC handler to `electron/main.ts`
4. Add `designToCode.apply` and `rescanWorkspace` to `electron/preload.ts`
5. Write tests for the IPC handler (mock FileTransactionManager + scanDirectory)

### Phase 2b: React Hook (flint-design-engineer) -- Depends on 2a types only

1. Create `src/hooks/useDesignToCodeApply.ts`
2. Write tests for the hook (mock `window.flintAPI`)

### Parallelism

Phase 2a and 2b can run in parallel because:
- The hook depends on the TypeScript interfaces (step 2a.1) but not on the handler implementation.
- The hook mocks `window.flintAPI` in tests, so it does not need the real preload.
- Both agents code against the type contracts defined in this document.

Phase 2a.1 (types) should be committed first so both agents can import them.

### Phase 3: Integration Validation

1. `flint-integration-validator` runs the full flow:
   - Open a project
   - Call `window.flintAPI.designToCode.apply` with a test payload
   - Verify files exist on disk with `data-flint-id` attributes
   - Verify `canvasStore.activeFilePath` points to the page compositor
   - Verify `editorStore.rawCode` contains the page compositor code
   - Verify `canvasStore.workspaceFiles` includes the new directory
2. Run TSC: `npx tsc --noEmit` must produce 0 errors
3. Run full test suite and report counts

---

## 11. Sequence Diagram

```
Renderer (hook)          Preload (IPC)         Main Process
     |                        |                      |
     |-- applyDesignToCode -->|                      |
     |                        |-- d2c:apply -------->|
     |                        |                      |
     |                        |              1. Validate request
     |                        |              2. mkdir generated/<PageName>/
     |                        |              3. For each component:
     |                        |                 parse -> injectFlintIds -> generate
     |                        |              4. For page compositor:
     |                        |                 parse -> injectFlintIds -> generate
     |                        |              5. fileTransactionManager.writeBatch(all)
     |                        |              6. gitManager.shadowCommit(targetDir)
     |                        |              7. scanDirectory(projectRoot)
     |                        |                      |
     |                        |<-- D2CApplyResult ---|
     |<-- D2CApplyResult -----|                      |
     |                                               |
     |-- setWorkspaceFiles(tree) -------> canvasStore |
     |-- setCanvasView('preview') ------> canvasStore |
     |-- setActiveFile(pageFilePath) ---> canvasStore |
     |                                        |
     |                          clearAST -> readFile(IPC) -> setCode
     |                                        |
     |                          LivePreview re-renders (automatic)
     |                                        |
     |-- addNotification('success') -> notificationStore |
```

---

## 12. Risks

| Risk | Severity | Commandment | Mitigation |
|------|----------|-------------|------------|
| Component code has syntax errors from MCP tool | Medium | C16 | The main process handler wraps each component in a `try/catch` around `parseCodeToAST`. If parsing fails, the file is still written as-is (so the user can fix it manually) but a warning is included in the result. `injectFlintIds` is skipped for unparseable files. |
| Import paths in page compositor are wrong | Medium | C1 | The page compositor uses relative imports (`'./<SectionName>'`). Since all files are siblings in the same directory, this is always correct. The handler validates this by checking that the import paths match the generated filenames. |
| Race condition: user opens another file before apply completes | Low | -- | The hook sets `isApplying: true` which the caller can use to disable navigation. `setActiveFile` already handles dirty-file flushing if the user navigates away. |
| Generated folder name collision with existing code | Low | -- | The `mkdir({ recursive: true })` call is idempotent. Files in an existing folder are overwritten. The shadow commit preserves the previous state for Git Time Machine recovery. |
| Theme file extension not `.tsx` -- fails `ast:save-batch` validation | Medium | C12 | Theme files (e.g., `tailwind.config.ts`, `theme.css`) may not match the `.tsx/.ts/.jsx/.js` regex. The handler writes theme files via a separate `fileTransactionManager.write` call that skips the extension check (theme files are config, not source). Alternatively, use `fs.promises.writeFile` directly for non-source files since FileTransactionManager's security check is source-file-specific. Decision: write theme files with a dedicated `writeFile` that only validates the path is within the project root and home directory, not the extension. |
| Large Figma pages generate 20+ components -- slow write | Low | C12 | `writeBatch` writes to different paths concurrently. 20 small `.tsx` files take < 100ms total on SSD. Not a concern. |

---

## 13. Test Plan

### Unit Tests

| Test | File | What it verifies |
|------|------|-----------------|
| `d2c:apply` creates directory and writes files | `electron/__tests__/d2cApply.test.ts` | Mock FileTransactionManager, verify `writeBatch` called with correct paths and content |
| `d2c:apply` runs injectFlintIds on each component | `electron/__tests__/d2cApply.test.ts` | Verify output files contain `data-flint-id` attributes |
| `d2c:apply` rejects when no project is open | `electron/__tests__/d2cApply.test.ts` | Verify error result when `activeProjectRoot` is null |
| `d2c:apply` handles parse errors gracefully | `electron/__tests__/d2cApply.test.ts` | Component with syntax error is written as-is, result includes warning |
| `d2c:apply` writes theme file to project root | `electron/__tests__/d2cApply.test.ts` | Verify theme file path is `projectRoot/filename`, not in generated dir |
| `workspace:rescan` returns null when no project open | `electron/__tests__/d2cApply.test.ts` | Verify null return |
| `workspace:rescan` returns fresh tree | `electron/__tests__/d2cApply.test.ts` | Verify scanDirectory called with projectRoot |
| Hook calls IPC and updates stores on success | `src/hooks/__tests__/useDesignToCodeApply.test.ts` | Mock flintAPI, verify setWorkspaceFiles + setActiveFile called |
| Hook shows error notification on failure | `src/hooks/__tests__/useDesignToCodeApply.test.ts` | Mock flintAPI to reject, verify error toast |
| Hook sets isApplying during flight | `src/hooks/__tests__/useDesignToCodeApply.test.ts` | Verify state transitions |

### Integration Tests

| Test | What it verifies |
|------|-----------------|
| Full round-trip: apply -> files on disk -> LivePreview renders | Files exist, page compositor is active file, srcdoc iframe shows content |
| Undo via Git Time Machine after D2C apply | shadowCommit created, Recovery Panel shows the commit, revert removes files |

---

## 14. Open Questions (Resolved)

### Q1: Should generated files use `export default` or named exports?

**Decision:** Named exports (`export function SectionName()`). The page compositor imports them by name. When the page compositor itself is opened in the editor, `editorStore.setCode` requires a default export for LivePreview to render it. Therefore, the main-process handler wraps the page compositor code to add `export default` if it is not already present. Section components use named exports since they are consumed by import, not rendered directly by LivePreview.

**Implementation detail:** The handler checks whether the page compositor code contains `export default`. If not, it appends `\nexport default ${pageName};` to the end of the file. This is a string append (not AST surgery) because it is a simple declaration, not a structural modification.

### Q2: Should we run Mithril linting during the apply step?

**Decision:** No. Mithril linting runs automatically when `setCode` is called after `setActiveFile` loads the page compositor. The governance overlay will immediately show any violations. Running it during apply would duplicate work and slow down the file creation step.

### Q3: Should the hook auto-apply when a D2C result arrives via MCP push?

**Decision:** No auto-apply in v1. The hook provides the capability; the consuming component decides when to call it. A future enhancement can add a "one-click apply" button to the MCP push notification or Activity Feed card. Auto-applying without user confirmation would violate the principle that AI output requires user approval before persisting to disk.
