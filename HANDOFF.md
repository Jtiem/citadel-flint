# Bridge IDE — Developer Handoff (v5.18)

**Date:** 2026-03-05
**Commit:** Phase B.1-d (Export Gate Severity Escalation) applied
**Status:** Phase B.1-d (Export Gate Severity Escalation) — **COMPLETE**
**Tests:** 160/160 passing · ΔE = 0.0 · `tsc --noEmit`: 0 errors
**Run:** `npm run dev`

---

## 1. Architecture Overview (v5.7)

Bridge is a performance-hardened, three-process Electron app designed for agentic surgery:

```
┌──────────────────────────────────────────────────────────┐
│  Main Process (Node.js / Electron)                       │
│  · FileTransactionManager: Atomic .tmp → rename queue    │
│  · SQLite + PowerSync: CRDT Persistence layer            │
## 1. Architecture Overview
**Bridge** is the first Agentic UI Operating System. It acts as a strict "containment field" around LLM-driven development, ensuring brand alignment, accessibility, and codebase integrity through AST-level determinism. **If it isn't in the AST, it doesn't exist.**

### Technical Foundation
| Layer | Tech | Role |
|-------|------|------|
| **Core** | Electron | Main/Renderer multi-process architecture |
| **Persist** | SQLite WAL | `bridge.db` (state) + `bridge-registry.db` (global) |
| **Logic** | React 19 + Zustand | Strict separation of state from UI representation |
| **Engine** | Babel | In-memory AST surgery / Live Preview code injection |

---

## 2. Module Status Map (v6.7)
| Module | ID | Status | Subsystem |
|--------|----|--------|-----------|
| Code-First Recovery | D.1 | **ONLINE** | `gitShow` IPC + `transplantNode` AST swap |
| Git Time Machine UI | D.2 | **ONLINE** | `ast:git-log` IPC + `RecoveryPanel.tsx` + `revertNodeToCommit` |
| Batch Mutation Engine | E.1 | **ONLINE** | `ASTService.applyMutationBatch` + `applyInversions` |
| FileTransactionManager | E.2 | **ONLINE** | `electron/FileTransactionManager.ts` |
| canvasStore + Auto-Save | F.1 | **ONLINE** | `canvasStore.triggerAutoSave`, `saveState` lifecycle |
| Cross-File Move | F.2 | **ONLINE** | `astBufferStore.crossFileMove` (11-step atomic) |
| Global Recovery Engine | G.1 | **ONLINE** | `recoveryController.ts` — single-file + cross-file undo |
| Scaffolding & Registry | G.2 | **ONLINE** | `LaunchScreen.tsx`, `templateService.ts`, `registry.ts` |
| Cross-File Redo | H | **ONLINE** | `CrossFileMoveRedoPlan`, `isRecovery` flag |
| Undo Void Fix | K | **ONLINE** | `editorStore.applyBatch` no-op guard + `setCode` Cmd-10 fix |
| Post-Redo Undoability | L | **ONLINE** | `historyStore.pushPast` + `crossFileMove` inversions return |
| Sharma Validation | B.1-b | **ONLINE** | `snippetAuditor.ts` with AST shadow/fragment safety |
| Multiplayer Presence | C.1 | **ONLINE** | `PresenceService.ts` + `useRemotePresence` + SQLite UPSERT + remote cursor overlay |
| AST Conflict Arbiter | C.2 | **ONLINE** | `useLockedNodeIds` + `useIsNodeLocked`. Locks Layer Tree, Properties Panel, and canvas drag for nodes held by remote users. |
| Infinite Canvas | A | **ONLINE** | `XYCanvas.tsx` — `@xyflow/react` v12. `LivePreview` hosted as a draggable custom node with chrome bar, pan/zoom/minimap. |
| Export Gate UI | B.2 | **ONLINE** | `ExportModal.tsx` + `tokens:read-overrides` IPC + Export button in top bar |
| Export Gate Severity Escalation | B.1-d | **ONLINE** | Critical (ΔE > 10) → red modal header + red row badge + "Critical" pill. Amber (2.0–10.0) → amber styling. `hasCriticalMithril` computed from `editorStore.linterWarnings`. |
| Accessibility Gate | B.3 | **ONLINE** | `A11yLinter.ts` — AST-level a11y checks (img/button/a/input). Runs on every parse; blocks exports. |
| Interaction Modes | I | **ONLINE** | `canvasMode` toggles pointer-events within LivePreview iframe via IPC message |
| Bridge Auditor / Orchestration | L | **ONLINE** | `electron/orchestrator.ts` (Anthropic Claude streaming + Bridge Tool Catalog) · `src/store/orchestratorStore.ts` · `AgentChatPanel.tsx` (🤖 tab in right panel) · `ai:chat`, `ai:get-config`, `ai:save-config` IPC in `main.ts` · `applyBatch` + `ai` namespace in `preload.ts` · Store reads `~/.bridge/config.json` for API key. Every AI-proposed mutation requires user confirmation before touching the AST. |
| AI Orchestrator Hardening | M | **ONLINE** | `orchestrator.ts` constrained to 7-op Bridge AST Tool Catalog (no raw code strings). In-memory TSC validation loop. Design system RAG via `sqlite-vec`. Structured Outputs / Tool Use API mode enforced. Commandments 15 & 16 active. |

---

## 3. Updated File Map

### `src/core/` (Services)
| File | Purpose |
|------|---------|
| `ASTService.ts` | Batch mutations, `InverseMutation` generation, `synthesizeImports`. |
| `ast-parser.ts` | Foundational Babel utilities: parse, generate, visual-tree, `injectBridgeIds`. |
| `recoveryController.ts` | `applyUndo` / `applyRedo` / `applyRedoPlan`. Phase G.1 + H. |
| `MithrilLinter.ts` | CIEDE2000 ΔE perceptual drift guard. |
| `GitService.ts` | Surgical git-transplant recovery. |

### `src/store/` (State)
| File | Key State / Role |
|------|-----------------|
| `historyStore.ts` | `past`/`future` stacks. `HistoryEntry` with `redoPlan?: RedoPlan`. `CrossFileMoveRedoPlan` type. |
| `astBufferStore.ts` | Headless multi-file AST buffers. `crossFileMove` (11 steps, `isRecovery` flag). |
| `canvasStore.ts` | Workspace tree, active file, `saveState` lifecycle. |
| `editorStore.ts` | Active-file AST, Visual Tree, `applyBatch`, `syncCode`. |
| `tokenStore.ts` | Design Token CRUD (SQLite via PowerSync). |

### `electron/`
| File | Role |
|------|------|
| `FileTransactionManager.ts` | Atomic `.tmp` → `rename` write queue. Serialised per path, concurrent across paths. |
| `GitManager.ts` | `ensureRepo` + `shadowCommit` (called after every atomic save). `getGitNode` for surgical node extraction from git history. |
| `main.ts` | IPC handlers: `saveFile`, `saveFileBatch`, `readFile`, `transformCode`, `openFolder`, `ast:git-show`, `ast:git-log`. |
| `preload.ts` | `contextBridge` exposure of `window.bridgeAPI` including `gitShow` and `gitLog`. |
| `orchestrator.ts` | **Phase M** — Anthropic Claude streaming. Constrained to Bridge AST Tool Catalog. In-memory TSC validation loop. Fetches design system interfaces from `sqlite-vec` for RAG context injection. |

### `src/components/ui/`
| File | Role |
|------|------|
| `FileExplorer.tsx` | Cross-file drag source (triggers `crossFileMove`). |
| `LayerTree.tsx` | Single-file drag reorder (triggers `editorStore.moveLayerNode`). |
| `RecoveryPanel.tsx` | **Phase D.2** — Time Machine UI. Queries `bridgeAPI.gitLog`, renders shadow-commit timeline, triggers `editorStore.revertNodeToCommit` for surgical node transplants. |
| `SyncStatus.tsx` | **Module C.1** — PowerSync sync state badge + `useSyncPresence` hook for throttled cursor broadcasting. |
| `XYCanvas.tsx` | **Module A** — Infinite whiteboard. Mounts `@xyflow/react` v12; `LivePreview` is a `livePreview` custom node type. Drag handle isolated to chrome bar to preserve Shield DnD. |
| `ExportModal.tsx` | **Phase B.2 / B.1-d** — Mithril Safety Export Gate modal. Pre-flight audit of `component_overrides` rows + ΔE violations + accessibility violations (B.3). Clickable node IDs snap-select the offending element in the canvas. Pass state shows source + Copy button. Severity escalation (B.1-d): reads `editorStore.linterWarnings` per violation ID — critical (ΔE > 10) renders red header + red row badge; amber (2.0–10.0) renders amber styling. |
| **Core Services** | |
| `A11yLinter.ts` | **Phase B.3** — Pure AST-level accessibility linter. Enforces Commandment 5. Rules: A11Y-001 (`<img>` alt), A11Y-002/003 (`<button>`/`<a>` accessible name), A11Y-004 (`<input>` label). Called inside `editorStore.setCode` on every successful parse. |

### `src/services/` & `src/hooks/`
| File | Role |
|------|------|
| `services/PresenceService.ts` | **Module C.1** — Module-level singleton. Throttled (100ms) `publishPresence` + immediate `publishPresenceImmediate` for drag-lock events. Generates stable `presenceSessionId` + `presenceUserId`. |
| `hooks/useRemotePresence.ts` | **Module C.1/C.2** — Polls `bridgeAPI.readPresence` at 5 Hz. Exports `useRemotePresence`, `useLockedNodeIds`, and `useIsNodeLocked` for multiplayer cursor overlay and AST Conflict Arbiter locking. |

---

## 4. The AST Command Pattern — Full Flows

### HistoryEntry schema
```typescript
interface HistoryEntry {
    filePath?: string        // set for cross-file (headless buffer) entries
    batchId?: string         // UUID grouping entries from one atomic operation
    inversions: InverseMutation[]   // op: 'setAttr'|'restoreCode'|...
    redoMutations: ASTMutation[]    // non-empty for single-file redo
    redoPlan?: RedoPlan      // non-empty for cross-file redo (Phase H)
}

interface CrossFileMoveRedoPlan {
    type: 'crossFileMove'
    sourceFilePath: string
    sourceNodeId: string     // bridge-id, stable across restores
    targetFilePath: string
    targetNodeId: string     // always resolved (null-fallback done at push time)
    position: DropPosition
}
```

### Single-file mutation flow
```
applyBatch(mutations)
  → applyMutationBatch(rawCode, mutations) → { code, inversions }
  → parseCodeToAST(code) → set store
  → triggerAutoSave(code)
  → historyStore.push(inversions, mutations)
```

### Cross-file move flow
```
crossFileMove(srcFile, srcNode, tgtFile, tgtNode, position)
  → (11 steps): validate → load buffers → extract → insert → generate
  → saveFileBatch({srcFile: newSrcCode, tgtFile: newTgtCode})
  → batchId = crypto.randomUUID()
  → if (!options?.isRecovery):
      historyStore.push(srcInversions, [], srcFile, batchId, redoPlan)
      historyStore.push(tgtInversions, [], tgtFile, batchId)
```

### Undo flow (Cmd+Z)
```
applyUndo()
  → popUndo() → entry
  → if entry.batchId: pop all siblings with same batchId → group[]
  → if any entry.filePath:
      applyCrossFileUndo(group)
        → build batch: filePath → restoreCode
        → saveFileBatch(batch)
        → evictBuffer + loadBuffer for each file
        → syncCode active editor if needed
        → if group has redoPlan: pushFuture({ inversions:[], redoMutations:[], redoPlan })
  → else:
      applySingleFileUndo(entry)
        → applyInversions(rawCode, inversions) → restoredCode
        → syncCode(restoredCode) + triggerAutoSave(restoredCode)
        → pushFuture({ inversions:[], redoMutations: entry.redoMutations })
```

### Redo flow (Cmd+Shift+Z) — Phase H
```
applyRedo()
  → popRedo() → entry
  → if entry.redoPlan:
      applyRedoPlan(plan)
        → crossFileMove(...plan params..., { isRecovery: true })
           (AST surgery + file writes + editor sync; no historyStore.push)
      return
  → else if entry.redoMutations.length > 0:
      editorStore.applyBatch(entry.redoMutations)
        (generates fresh inversions, pushes to past)
```

---

## 5. Phase H Change Log

**`src/store/historyStore.ts`**
- Added `CrossFileMoveRedoPlan` interface + `RedoPlan` union type
- Added `redoPlan?: RedoPlan` to `HistoryEntry`
- Extended `push()` with optional 5th param `redoPlan?`

**`src/store/astBufferStore.ts`**
- Step 11 builds `CrossFileMoveRedoPlan` from `effectiveTargetId` (always resolved non-null)
- Passes `redoPlan` as 5th arg to source-file `push()`
- New `options?: { isRecovery?: boolean }` parameter on `crossFileMove`
- Both `historyStore.push()` calls guarded with `if (!options?.isRecovery)`

**`src/core/recoveryController.ts`**
- `applyCrossFileUndo`: extracts `redoPlan` from group, calls `pushFuture({ redoPlan })`
- `applyRedo`: dispatches to `applyRedoPlan` when `entry.redoPlan !== undefined`
- New `applyRedoPlan(plan)`: re-invokes `crossFileMove(..., { isRecovery: true })`

---

## 6. Invariants & Gotchas

1. **7D Hardening:** Every buffer loaded via `loadBuffer` has `injectBridgeIds(ast)` applied immediately. Never mutate a buffer that hasn't been hardened.
2. **`historyStore.clear()`** must be called on file-open (`canvasStore.setActiveFile`) to prevent stale undo entries from bleeding across files.
3. **macOS `ENOTEMPTY`:** In tests, use `rm({ maxRetries: 3 })` for temp directory cleanup. `force: true` alone is insufficient on APFS.
4. **Monaco coexistence:** `App.tsx` keyboard listener uses `!= null` (loose equality) to guard against `document.activeElement` being `null` — optional chaining returns `undefined` in that case, and `undefined !== null` would incorrectly block undo. Bridge undo/redo fires only outside Monaco.
5. **`isRecovery` semantics:** After a cross-file redo, `past` remains empty (no new entries pushed). The operation is re-executed atomically but is not further undo-able in this release. The architect should extend this in a future phase if post-redo undo is required.
6. **`effectiveTargetId` non-null guarantee:** The null-guard at step 3 of `crossFileMove` ensures `effectiveTargetId` is always a `string` when the `redoPlan` is built. The `as string` cast at that site is safe.
7. **`push()` clears `future`:** Every normal `historyStore.push()` call zeroes the future stack. The `pushFuture()` path does not clear `past`. Never mix them in the same flow.

---

## 7. Phase K Change Log

**`src/store/editorStore.ts`**
- **K.1 — `applyBatch` no-op guard:** Added early-return when `firstInv?.op === 'restoreCode' && firstInv.code === newCode`. Prevents void-undo entries when `moveNode` silently fails because the source node cannot be found by stale structural ID.
- **K.2 — `setCode` Commandment 10 fix:** Capture `const previousCode = get().rawCode` *before* `set()`. The previous code ran the history-clear check after `set()`, making `get().rawCode === code` always true — history was never cleared on file load.
- **K.3 — `updateNodeProperty` Phase G.2 completion:** Removed direct ast-parser calls; all three branches (className / textContent / arbitrary prop) now route through `applyBatch`, making every property edit undoable.

**`src/core/ASTService.ts`**
- Added `UpdateTextContentMutation` interface (`op: 'updateTextContent'`).
- Added `readCurrentTextContent` traversal helper.
- Added `case 'updateTextContent'` handler in `applyMutationBatch` — captures old text as surgical inverse before calling `updateJSXTextContent`.
- Extended `ASTMutation` and `InverseMutation` unions with the new type.

**`src/App.tsx`**
- **K.4 — Keyboard null safety:** Changed `!== null` to `!= null` in the Monaco focus guard. `document.activeElement?.closest(…)` returns `undefined` (not `null`) when `activeElement` is null; loose equality covers both.

---

## 8. Phase M Change Log

**`.bridge-context/architecture.md` & `.antigravityrules`**
- Updated spec to v6.0. Expanded to **16 Commandments**.
- Added **Commandment 15:** Granular AST Tools Only. Orchestrator restricted to `updateProps`, `updateText`, `insertNode`, `wrapNode`, `deleteNode`, `addClassName`, `removeClassName`.
- Added **Commandment 16:** In-Memory Validation Before Confirmation. `orchestrator.ts` must execute TSC type-check on synthesized AI output before confirmation UI; errors fed back to AI invisibly.
- Added **Module M** section defining the full AST Tool Catalog JSON schemas, Design System RAG Injection requirement, and Structured Outputs Enforcement.

**`CLAUDE.md`**
- Updated to v6.9. Added Phase M row to module table.
- Added Critical AI Directives 6 & 7 (Commandments 15 & 16).

**`HANDOFF.md`**
- Updated to Phase M status. Added `orchestrator.ts` to electron file map.
- Extended Immediate Next Steps to call out Phase M implementation in `orchestrator.ts`.

---

## 9. Phase B.1-d Change Log

**`src/components/ui/ExportModal.tsx`**
- Added `linterWarnings` selector from `useEditorStore` (reads `Map<string, LinterWarning>`).
- Added `hasCriticalMithril` derived boolean: `mithrilViolations.some(id => linterWarnings.get(id)?.severity === 'critical')`.
- Modal header escalates from amber → red border/bg/icon/title when `hasCriticalMithril` is true ("Export Gate — Critical Violations").
- Mithril violations section header color + "Critical" pill badge driven by `hasCriticalMithril`.
- Per-row rendering: each violation looks up its `LinterWarning` from `linterWarnings`; critical rows get `border-red-700/50 bg-red-900/20` + red ID button + inline "Critical" badge; amber rows get `border-amber-900/40 bg-amber-900/10` + amber ID button.
- Description line renders `warning.message` (includes exact ΔE from the linter) instead of the hardcoded "ΔE > 2.0 — token not applied" string.
- Added `type { LinterWarning }` import from `bridge-api.d.ts`.

**`src/core/MithrilLinter.severity.test.ts`** *(new file — 21 tests)*
- `visitClassNames — severity bucketing`: 8 tests covering no-violation, below-threshold, amber assignment, critical assignment, no-bridge-id skip, mixed-severity pass, message format, empty-token list, worst-ΔE-wins-per-node.
- `auditAll — severity preserved through full pipeline`: 4 tests — critical + amber preserved after all 5 merged visitors; clean nodes absent; no-JSX source → empty map.
- `hasCriticalMithril — ExportModal gate computation`: 9 tests — all pure logic cases + 2 integration tests that feed real `auditAll` output directly into the gate boolean.

---

## 10. Immediate Next Steps

- **C.1: Cloud PowerSync backend** — Wire `@powersync/node` when backend URL is provisioned. Schema + columns already ready in `electron/sync-schema.ts` + `design_tokens.version/last_modified`.
- **`revertNodeToHead` undo support** — Currently bypasses history (intentional). Consider pushing a `restoreCode` inversion if post-git-revert undo becomes a requirement.
