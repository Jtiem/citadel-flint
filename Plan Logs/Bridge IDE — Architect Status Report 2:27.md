Bridge IDE — Architect Status Report
Date: 2026-02-27 | Model handoff: Claude Sonnet 4.6 → Gemini

Project Identity
Name: Bridge IDE
Path: /Users/justintiemann/Documents/AI Coding/Lunar Elevator - Bridge
Stack: Electron 33 + Vite + React 18 + TypeScript (strict) + Tailwind v4 + Monaco Editor + Babel + better-sqlite3 + Zustand v5
Build: npm run dev (Vite dev server + Electron). Two tsconfigs: tsconfig.json (renderer/src) and tsconfig.node.json (electron/). npx tsc -b compiles both.
Tests: Vitest, npm test → 32/32 passing

What This App Is
Bridge IDE is a local-first Electron IDE for visual React component editing. Its core loop:

User opens a .tsx file → raw source loads into Monaco
Babel parses it → Babel AST stored in Zustand (editorStore.ast)
A simplified VisualLayer[] tree is built from the AST → renders in the Layer Tree panel
code:transform IPC call sends the TSX to main process → Babel injects data-bridge-id attrs + strips imports + rewrites export default → srcdoc iframe renders live preview
Clicking a node in the iframe fires CANVAS_CLICK postMessage → selection synced to both stores
AST mutations (drag, class edit, token fix, component inject) update rawCode → auto-saved to disk via FileTransactionManager (atomic two-phase write)
Security Architecture
Context Isolation: ON — renderer has zero Node.js access
Node Integration: OFF
Sandbox: OFF (required for ESM preload)
All renderer↔main communication through contextBridge (window.bridgeAPI)
File writes validated in main: absolute path, .tsx/.ts/.jsx/.js extension, within app.getPath('home')
Directory picker uses dialog.showOpenDialog — user chooses path, renderer never supplies it
Completed Phases
Phase A — FileTransactionManager + ASTService Foundation
electron/FileTransactionManager.ts — Singleton atomic file writer. Two-phase: write to <path>.tmp → fs.rename(). Per-path FIFO serialization via promise chaining. Concurrent across paths. 11 Vitest tests.
src/core/ast-parser.ts — Babel-based AST parser/generator. parseCodeToAST, generateCodeFromAST, buildVisualTree, updateJSXClassName. VisualLayer interface (id, tagName, line, className?, style?, idAttr?, textContent?, children[]).
src/core/ASTService.ts — Re-exports ast-parser. Contains ASTMutation discriminated union. applyMutationBatch stub (Phase B). synthesizeImports (Phase B — fully implemented).
Vitest config at vitest.config.ts. 21 ASTService tests.
Phase B — Import Synthesizer + Ghost Proxy Drag-and-Drop (Module H)
src/core/ASTService.ts synthesizeImports — When a JSX component moves between files, auto-injects its required imports into the target. Handles default, namespace, and named imports. Deduplicates. 21 tests.
Ghost Proxy system — LivePreview.tsx mounts a transparent Shield <div> over the iframe during drags. canvasStore.dragSourceId drives this. src/utils/astModifier.ts contains moveNode, injectComponent, applyTokenFix.
Phase C.5 — Properties Inspector Bridge
canvasStore.ts — Added activeSelection: string | null + setActiveSelection
LivePreview.tsx — CANVAS_CLICK postMessage handler now sets both editorStore.selectedNodeId and canvasStore.activeSelection
ast-parser.ts — VisualLayer extended with style?: string. Populated from both StringLiteral and JSXExpressionContainer style attributes (uses @babel/generator for object-style)
PropertiesPanel.tsx — Read-only NodeProperties sub-component displays className, style, textContent from the AST-derived VisualLayer. Uses activeSelection ?? selectedNodeId (canvas click takes priority over layer tree click)
SyncStatus.tsx — Replaced simulated 1200ms timeout with real window.bridgeAPI.ping() probe. Shows "Sync: Online (PowerSync)" (emerald) on success, "Sync: Offline" (amber) on failure. Cancellation guard on unmount.
Phase C.7 — The Persistence Loop (most recent, just completed)
electron/main.ts — Added dialog import + readdir/readFile from node:fs/promises. Registered dialog:openFolder handler (top-level, no DB dependency): shows native folder picker → scans root for .tsx/.ts/.jsx/.js → priority App.tsx → index.tsx → main.tsx → first alphabetical → returns { filePath, content } or null
electron/preload.ts — Added openFolder() method
src/types/bridge-api.d.ts — Added openFolder: () => Promise<{ filePath: string; content: string } | null> to BridgeAPI
src/store/canvasStore.ts — Extended with activeFilePath: string | null, saveState: 'idle' | 'editing' | 'saving' | 'saved', setActiveFile(filePath), triggerAutoSave(code, debounceMs?). Module-level _saveTimer for debounce. State transitions: idle → editing → saving → saved → idle (2s)
src/store/editorStore.ts — Imports useCanvasStore. setCode calls triggerAutoSave(code, 1000) (1s debounce for Monaco keystrokes). All four mutation actions (updateNodeProperty, moveLayerNode, injectComponent, applyTokenFix) call triggerAutoSave(newCode) immediately after set
src/App.tsx — Added handleOpenFolder() (calls openFolder(), sets activeFilePath before setCode so debounced save sees the path). Header: left side shows active filename below title; right side shows save state dot+label (Editing… / Saving… / Saved) and Open Folder button beside tech pills
Current File Inventory (key files)
File	Role
electron/main.ts	Main process, all ipcMain handlers
electron/preload.ts	contextBridge → window.bridgeAPI
electron/FileTransactionManager.ts	Atomic file writer singleton
electron/store.ts	SQLite init (better-sqlite3), creates design_tokens + presence tables
electron/ingestion-server.ts	HTTP server on :4545 for Figma plugin POST /ingest
src/store/canvasStore.ts	Drag state, canvas selection, file persistence + auto-save pipeline
src/store/editorStore.ts	rawCode, Babel AST, visualTree, all mutation actions
src/store/tokenStore.ts	Design token CRUD via IPC
src/core/ast-parser.ts	Babel parse/generate/buildVisualTree/updateJSXClassName
src/core/ASTService.ts	Re-exports + synthesizeImports + applyMutationBatch stub
src/utils/astModifier.ts	moveNode, injectComponent, applyTokenFix
src/components/editor/LivePreview.tsx	srcdoc iframe, Shield, Ghost Proxy, postMessage handler
src/components/editor/CodeEditor.tsx	Monaco editor wired to editorStore
src/components/ui/LayerTree.tsx	VisualLayer tree render with click-to-select
src/components/ui/PropertiesPanel.tsx	Read-only AST property inspector + ClassBuilder
src/components/ui/SyncStatus.tsx	Bottom-right sync indicator (ping-based)
src/services/PresenceService.ts	Throttled presence publisher (100ms), session UUID
src/hooks/useRemotePresence.ts	Polls readPresence at 5Hz for remote cursor overlay
src/types/bridge-api.d.ts	Full window.bridgeAPI type declarations
src/App.tsx	Root layout: 3-panel workspace + header with Open Folder + save state
IPC Channel Registry
Channel	Handler location	Payload → Response
ping	top-level	→ string
dialog:openFolder	top-level	→ { filePath, content } | null
code:transform	top-level	code: string → { js, error }
tokens:create	app.whenReady	token → { id }
tokens:read-all	app.whenReady	→ DesignToken[]
tokens:update	app.whenReady	tokenPath, updates → { changes }
tokens:delete	app.whenReady	id → { changes }
tokens:clear-all	app.whenReady	→ { changes }
sync:update-presence	app.whenReady	PresencePayload → void
sync:read-presence	app.whenReady	→ PresenceRow[]
ast:save-file	app.whenReady	filePath, content → void
server:get-status	app.whenReady	→ { running, port }
bridge:tokens-updated	push event	ingestion server → renderer
Known Stubs / Deferred Work
applyMutationBatch in ASTService.ts — throws "not implemented." Phase B stub. Batch mutations collapse N edits into one write (not yet needed, individual mutations route through editorStore directly)
PropertiesPanel mutations — currently read-only. Phase E adds write capability (className editor is already present via ClassBuilder, but style/textContent editing is deferred)
Multi-file support — synthesizeImports is built but the UI only loads one file at a time. Cross-file component moves are architecturally ready but not wired to a file tree UI
What Comes Next (Phase D)
The user stated Phase D is the recovery engine — referenced before the Phase C.7 pivot. No directive has been received yet. Based on context from earlier architecture discussions, Phase D likely involves:

Error boundary / parse-error recovery in the AST pipeline
Possibly undo/redo history for AST mutations
Conflict detection when auto-saved file is modified externally
Await the Phase D directive.

Constraints for New Work
No Node.js imports in src/ — renderer is pure browser context
All IPC payloads must be plain serializable objects
File paths: must be absolute, within home dir, .tsx/.ts/.jsx/.js only
No any types (CLAUDE.md rule)
Zustand v5 selector pattern: useStore((s) => s.field) not useStore().field
tsc -b and npm test must remain green after every change