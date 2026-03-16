# Bridge Journey Maps

**Version:** 1.0
**Date:** 2026-03-15
**Covers:** Bridge Glass v7.2 + Bridge MCP (13 tools, 6 resources, 3 prompts)
**Test baseline:** 409 Glass + 366 MCP + 25 integration = 800 tests

---

## Navigation

| # | Journey | Persona | Entry Point | Key Commandments |
|---|---------|---------|-------------|-----------------|
| 1 | [First Launch](#journey-1-first-launch) | Designer | App opens | C4 (Local-First) |
| 2 | [Open Project](#journey-2-open-existing-project) | Designer | LaunchScreen / OS Menu | C1, C7 |
| 3 | [Governance Audit Loop](#journey-3-governance-audit-loop) | Designer | File opens | C2, C5, C6, C9 |
| 4 | [Export Gate](#journey-4-export-gate) | Designer | Export button | C5, C6 |
| 5 | [Canvas Interaction](#journey-5-canvas-interaction) | Designer | Click on canvas | C1, C7, C13 |
| 6 | [Recovery / Undo](#journey-6-recovery--undo) | Designer | Cmd+Z / Time Machine | C10, C11, C14 |
| 7 | [MCP Agent Workflow](#journey-7-mcp-agent-workflow) | AI Agent | MCP tool call | C8, C15, C16 |
| 8 | [Figma Import](#journey-8-figma-import) | Designer | Figma plugin | C4, C12 |
| 9 | [Developer Workflow](#journey-9-developer-workflow-contract-first) | Developer | Feature request | All |

### Reading Each Journey

Every journey uses this format per step:

| Field | What it contains |
|-------|-----------------|
| **User Action** | What the human (or AI agent) physically does |
| **System Action** | Functions, store actions, IPC calls that execute (code-level) |
| **On-ramps** | All paths that lead TO this step |
| **Off-ramps** | All paths that lead FROM this step |
| **State Changes** | Zustand store mutations |
| **IPC Calls** | Electron IPC channels that fire |
| **File Effects** | Disk reads/writes |
| **Test Coverage** | Which test(s) validate this step (ID from TestStrategy-Plan) |
| **Error States** | What can fail and what happens |
| **Commandments** | Which of the 16 apply |
| **Performance** | Expected latency budget |

---

## Journey 1: First Launch

**Persona:** Designer opening Bridge Glass for the first time
**Preconditions:** `npm install` complete, no prior project opened
**Success state:** User sees LaunchScreen with project options

### Visual Map

```
 App mounts
     |
     v
 [useContextSync starts]----> writes .bridge/context.json (200ms debounce)
     |
     v
 [canvasStore.projectRoot === null?]
     |                    |
     YES                  NO
     |                    |
     v                    v
 [LaunchScreen]      [Canvas loads project]
     |                (skip to Journey 2, step 5)
     |
     +---> "New Project"  -----> Journey 2, step 3
     +---> "Open Project" -----> Journey 2, step 1
     +---> "Recent" item  -----> Journey 2, step 4
     +---> "Connect Figma" ----> Journey 8, step 1
```

### Step 1.1: App Mounts

| Field | Detail |
|-------|--------|
| **User Action** | Launches Bridge Glass (`unset ELECTRON_RUN_AS_NODE && npm run dev`) |
| **System Action** | Electron `main.ts` boots → creates `BrowserWindow` → loads Vite dev server → React mounts `<App />` in `src/App.tsx` |
| **On-ramps** | OS app launch, `npm run dev`, OS menu "File > New Window" |
| **Off-ramps** | Step 1.2 (context sync starts) |
| **State Changes** | All Zustand stores initialize to defaults. `canvasStore`: `projectRoot: null`, `activeFile: null`, `canvasMode: 'design'`. `editorStore`: `code: ''`, `ast: null`, `linterWarnings: []` |
| **IPC Calls** | None (renderer hasn't called anything yet) |
| **File Effects** | Electron reads `bridge-registry.db` for recent projects list |
| **Test Coverage** | Glass test suite: App.tsx render tests |
| **Error States** | `ELECTRON_RUN_AS_NODE` set → window never appears (Known Issue #1). Vite dev server not running → blank window |
| **Commandments** | C4 (Local-First): No external URLs loaded during boot |
| **Performance** | Window visible < 2s, React mount < 500ms |

### Step 1.2: Context Sync Initializes

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic) |
| **System Action** | `useContextSync` hook mounts at App root. Starts 200ms debounced write of Glass state to `.bridge/context.json`. Initial write contains empty state. |
| **On-ramps** | Step 1.1 (App mount) |
| **Off-ramps** | Step 1.3 (LaunchScreen renders) |
| **State Changes** | None (hook is a side effect, doesn't modify stores) |
| **IPC Calls** | `syncContext` IPC — writes context JSON to disk via main process |
| **File Effects** | WRITE `.bridge/context.json` — `{ activeFile: null, selectedNode: null, canvasMode: 'design', violations: [] }` |
| **Test Coverage** | Test #21: `.bridge/context.json` written by useContextSync → readable by MCP server |
| **Error States** | `.bridge/` directory doesn't exist → IPC handler creates it. Write fails → silent retry on next debounce |
| **Commandments** | C4 (Local-First): Context file is local, not networked |
| **Performance** | First write < 250ms after mount |

### Step 1.3: LaunchScreen Renders

| Field | Detail |
|-------|--------|
| **User Action** | Sees the launch screen with project options |
| **System Action** | `App.tsx` checks `canvasStore.projectRoot`. If `null`, renders `<LaunchScreen />`. LaunchScreen reads recent projects from `bridge-registry.db` via IPC. |
| **On-ramps** | Step 1.2 (context sync done), closing a project (menu:close-project) |
| **Off-ramps** | "New Project" → Journey 2 step 3, "Open Project" → Journey 2 step 1, Recent item → Journey 2 step 4, "Connect Figma" → Journey 8 step 1 |
| **State Changes** | LaunchScreen local state: `recentProjects: ProjectEntry[]` populated from IPC |
| **IPC Calls** | `registry:list-projects` → returns `ProjectEntry[]` from `bridge-registry.db` |
| **File Effects** | READ `bridge-registry.db` (global registry, not per-project) |
| **Test Coverage** | Glass test suite: LaunchScreen render + recent projects display |
| **Error States** | Registry DB corrupt → empty recent list (graceful degradation). No projects → shows empty state with prominent "New" / "Open" buttons |
| **Commandments** | C4 (Local-First): Registry is local SQLite |
| **Performance** | LaunchScreen visible < 200ms after App mount |

---

## Journey 2: Open Existing Project

**Persona:** Designer opening a project folder
**Preconditions:** Project folder exists with `.tsx` files
**Success state:** Canvas shows LivePreview with first file parsed and governance audit running

### Visual Map

```
[LaunchScreen "Open"] ──or── [OS Menu "File > Open"]
         |                            |
         v                            v
    [Native File Dialog]         [IPC: menu:open-project]
         |                            |
         +---------> [Folder Selected] <---------+
                          |
                          v
                   [IPC: dialog:open-directory]
                          |
                          v
                   [main.ts: validateProjectFolder()]
                          |
                     valid?
                    /      \
                  YES       NO
                  |          |
                  v          v
         [canvasStore.      [Error toast:
          openProject()]     "No .tsx files found"]
                  |
                  v
         [Read workspace files]
         [Register in bridge-registry.db]
                  |
                  v
         [canvasStore.setActiveFile(first .tsx)]
                  |
                  v
         [editorStore.parseAST(code)]
                  |
                  v
         [editorStore.buildVisualTree(ast)]
                  |
                  v
         [MithrilLinter.lint(ast)] + [A11yLinter.lint(ast)]
                  |
                  v
         [LivePreview renders srcdoc]
         [ShieldOverlay renders badges]
         [GovernanceOverlay populates]
                  |
                  v
         [historyStore.clear()]  ← C10: fresh undo stack
                  |
                  v
         [GitManager.ensureRepo()]  ← C14: via GitManager, not raw git
                  |
                  v
         PROJECT OPEN ✓
```

### Step 2.1: User Triggers "Open Project"

| Field | Detail |
|-------|--------|
| **User Action** | Clicks "Open Project" on LaunchScreen, or uses File > Open Project in OS menu |
| **System Action** | LaunchScreen calls `window.bridgeAPI.openDirectory()`. OS menu route: `main.ts` receives `menu:open-project` IPC, calls `dialog.showOpenDialog()` |
| **On-ramps** | LaunchScreen "Open" button, OS menu File > Open, keyboard shortcut |
| **Off-ramps** | Step 2.2 (dialog opens) or cancelled (stays on LaunchScreen) |
| **State Changes** | None yet |
| **IPC Calls** | `dialog:open-directory` (renderer → main) |
| **File Effects** | None |
| **Test Coverage** | Glass test: LaunchScreen button triggers IPC |
| **Error States** | None at this step |
| **Commandments** | C14 (Bypass Prohibition): File dialog goes through bridgeAPI, not raw `fs` |
| **Performance** | Dialog opens < 100ms |

### Step 2.2: Native File Dialog

| Field | Detail |
|-------|--------|
| **User Action** | Navigates to project folder in native OS dialog, clicks "Open" |
| **System Action** | `dialog.showOpenDialog({ properties: ['openDirectory'] })` returns selected path |
| **On-ramps** | Step 2.1 |
| **Off-ramps** | Step 2.3 (folder selected) or cancelled (returns to LaunchScreen) |
| **State Changes** | None |
| **IPC Calls** | Dialog is native Electron, no additional IPC |
| **File Effects** | None |
| **Test Coverage** | Not directly tested (native OS dialog) |
| **Error States** | User cancels → `dialog.showOpenDialog` returns `{ canceled: true }` → no-op |
| **Commandments** | None |
| **Performance** | Native OS dialog, latency depends on OS |

### Step 2.3: Project Validation

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic after folder selection) |
| **System Action** | `main.ts` validates folder: checks for `.tsx` files, reads workspace structure. Registers project in `bridge-registry.db` with timestamp. Sends `project:opened` IPC event to renderer. |
| **On-ramps** | Step 2.2 (folder selected), Recent project click, New Project creation |
| **Off-ramps** | Step 2.4 (valid project) or error toast (invalid folder) |
| **State Changes** | None yet (validation is in main process) |
| **IPC Calls** | `project:opened` → renderer with `{ projectRoot, files }` |
| **File Effects** | READ: scans folder for `.tsx`/`.jsx`/`.ts` files. WRITE: `bridge-registry.db` INSERT/UPDATE project entry with path + last-opened timestamp |
| **Test Coverage** | MCP test: project validation logic |
| **Error States** | No `.tsx` files → error toast "No components found". Permission denied → error toast with path. Folder doesn't exist → error toast |
| **Commandments** | C4 (Local-First): All file reads are local |
| **Performance** | Folder scan < 500ms for typical project (< 1000 files) |

### Step 2.4: Store Hydration

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic) |
| **System Action** | Renderer receives `project:opened`. `canvasStore.openProject(projectRoot, files)` sets workspace tree. `canvasStore.setActiveFile(files[0])` triggers file load. |
| **On-ramps** | Step 2.3 (valid project) |
| **Off-ramps** | Step 2.5 (AST parsing) |
| **State Changes** | `canvasStore.setWorkspaceFiles(tree)` → workspace populated. `canvasStore.setActiveFile(primaryPath)` triggers the **Clean Slate Protocol**: (1) `editorStore.clearAST()` wipes prior AST, visual tree, and history, (2) posts `CLEAR_PREVIEW` to iframe, (3) reads file via `file:read` IPC, (4) `editorStore.setCode(content)` parses + builds visual tree + runs A11y audit. `historyStore.clear()` — fresh undo stack (C10) |
| **IPC Calls** | `readFile` (renderer → main) to load file contents |
| **File Effects** | READ: first `.tsx` file contents via `FileTransactionManager` |
| **Test Coverage** | Glass test: canvasStore.openProject state transitions |
| **Error States** | File read fails → error toast, `activeFile` stays null |
| **Commandments** | C10 (Targeted Micro-Recovery): `historyStore.clear()` prevents stale undo entries from previous project |
| **Performance** | Store hydration < 50ms, file read < 100ms |

### Step 2.5: AST Parsing + Governance Audit

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic) |
| **System Action** | `editorStore.setCode(fileContents)` triggers: (1) Babel parse → AST, (2) `injectBridgeIds(ast)` ensures every JSXElement has `data-bridge-id`, (3) `buildVisualTree(ast)` creates the node hierarchy for LayerTree, (4) `MithrilLinter.lint(ast, designTokens)` + `A11yLinter.lint(ast)` populate `linterWarnings`, (5) `canvasStore` receives `mithrilViolations` + `a11yViolations` for ShieldOverlay |
| **On-ramps** | Step 2.4 (file loaded) |
| **Off-ramps** | Step 2.6 (canvas renders), Journey 3 (if violations found) |
| **State Changes** | `editorStore`: `code`, `ast`, `visualTree`, `linterWarnings` all set. `canvasStore`: `mithrilViolations`, `a11yViolations` updated |
| **IPC Calls** | None (parsing happens in renderer via Babel) |
| **File Effects** | None (AST is in-memory) |
| **Test Coverage** | Test #11: `applyMutationBatch` → AST valid → `data-bridge-id` preserved. Test #18: `injectBridgeIds` → every JSXElement has unique ID. Test #10: CIEDE2000 reference values |
| **Error States** | Parse error (invalid JSX) → `editorStore.parseError` set, canvas shows error overlay. Linter crash → warnings empty, governance shows clean (fail-open for display, fail-closed for export) |
| **Commandments** | C7 (ID Preservation): `injectBridgeIds` runs on every parse. C9 (CIEDE2000): MithrilLinter uses perceptual color distance. C13 (Deterministic Surgery): Babel AST only |
| **Performance** | Parse < 200ms for typical component. Lint < 100ms. Total step < 350ms |

### Step 2.6: Canvas + Preview Render

| Field | Detail |
|-------|--------|
| **User Action** | Sees the project: infinite canvas with live preview, layer tree in left panel, properties in right panel, governance badges on nodes |
| **System Action** | `XYCanvas.tsx` renders with LivePreview as a draggable custom node. `LivePreview.tsx` builds `srcdoc` HTML from AST-generated code, injects it into iframe. `ShieldOverlay.tsx` reads `nodeLayouts` (from iframe `postMessage`) + `mithrilViolations` + `a11yViolations` to render severity heat tints and badges. LayerTree in left panel reads `editorStore.visualTree`. |
| **On-ramps** | Step 2.5 (AST parsed) |
| **Off-ramps** | Journey 3 (governance audit), Journey 5 (canvas interaction), Journey 4 (export), Journey 6 (recovery) |
| **State Changes** | ShieldOverlay local state: `nodeLayouts` map populated via `postMessage` from iframe |
| **IPC Calls** | None (rendering is pure React) |
| **File Effects** | None |
| **Test Coverage** | Glass test: XYCanvas renders, LivePreview srcdoc generation |
| **Error States** | Iframe fails to render → white preview (srcdoc syntax error). `nodeLayouts` empty → no badges (nodes reported via postMessage from iframe) |
| **Commandments** | C4 (Local-First): srcdoc is 100% offline, no external URLs. C7 (ID Preservation): badges key on `data-bridge-id` |
| **Performance** | Canvas render < 100ms. iframe srcdoc < 300ms. ShieldOverlay badges < 50ms |

### Step 2.7: Git Repository Check

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic, background) |
| **System Action** | `GitManager.ensureRepo(projectRoot)` checks if folder is a git repo. If not, initializes one. Creates initial shadow commit for recovery baseline. |
| **On-ramps** | Step 2.4 (project opened) — runs in parallel with step 2.5 |
| **Off-ramps** | Enables Journey 6 (Recovery / Git Time Machine) |
| **State Changes** | None in renderer stores |
| **IPC Calls** | Internal to main process (`GitManager` calls `git` CLI) |
| **File Effects** | WRITE: `.git/` directory if not present. WRITE: shadow commit |
| **Test Coverage** | Test #14: `GitManager.shadowCommit()` → `gitShow(HEAD)` → returns committed content |
| **Error States** | `git` not installed → GitManager fails silently, recovery features disabled. Folder not writable → error logged, no git features |
| **Commandments** | C14 (Bypass Prohibition): All git ops through `GitManager`, never raw `git` CLI from renderer |
| **Performance** | Git check < 500ms. Initial repo creation < 1s |

---

## Journey 3: Governance Audit Loop

**Persona:** Designer working on a component that has governance violations
**Preconditions:** Project open, file with violations loaded
**Success state:** All violations resolved, export gate clear

### Visual Map

```
[File loaded with violations]
         |
         v
[MithrilLinter.lint(ast, tokens)]      [A11yLinter.lint(ast)]
         |                                       |
         v                                       v
[editorStore.linterWarnings = [...mithril, ...a11y]]
         |
         +---------> [GovernanceOverlay] -----> violation list in right sidebar
         |                                      (rule ID, severity, description)
         |
         +---------> [ShieldOverlay] ---------> severity heat tints on nodes
         |                                      (green/amber/red backgrounds)
         |
         +---------> [ViolationTooltip] ------> hover popover on badge
         |
         +---------> [StatusBar] -------------> export gate indicator
         |                                      (red: blocked, green: clear)
         |
         v
[User sees violation] -----> "Auto-Fix" button?
         |                        |
         YES                      NO (manual fix)
         |                        |
         v                        v
[editorStore.applyBatch(         [User edits code
  fixToken mutation)]              in host IDE]
         |                        |
         v                        v
[AST mutated] <-------------------+
         |
         v
[Re-lint: MithrilLinter + A11yLinter]
         |
    violations left?
    /            \
  YES             NO
  |                |
  v                v
[Loop back]   [Export gate: GREEN]
              [GovernanceOverlay: empty]
              [ShieldOverlay: all green]
                   |
                   v
              Journey 4 (Export) unlocked
```

### Step 3.1: Linter Execution

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic on file load or code change) |
| **System Action** | Two parallel audit paths: (1) **A11y**: `editorStore.setCode()` calls `A11yLinter.audit(parsed)` inline, updates `canvasStore.setA11yViolations()`. (2) **Mithril**: `MithrilProvider.tsx` (wrapper component at App root) watches `ast` + `tokens` via useEffect, calls `auditAll(ast, tokens)` which runs 5 visitors: `visitClassNames` (CIEDE2000 color drift), `visitTypography` (TYP-001..005), `visitSpacing` (SPC-001), `visitShadows` (SHD-001), `visitOpacity` (OPC-001). `findClosestToken()` computes CIEDE2000 ΔE per color. Results go to `editorStore.setLinterWarnings()` (Map<bridgeId, LinterWarning>) and `canvasStore.setMithrilViolations()` (string[]). |
| **On-ramps** | File open (Journey 2 step 2.5), code edit (Journey 5), MCP fix applied (Journey 7), external file change |
| **Off-ramps** | Step 3.2 (violations display) if warnings found, or Journey 4 (export gate clear) if clean |
| **State Changes** | `editorStore.linterWarnings: LinterWarning[]` — each entry: `{ ruleId, severity, message, nodeId, line, column }`. `canvasStore.mithrilViolations` + `canvasStore.a11yViolations` — derived from linterWarnings, consumed by ShieldOverlay |
| **IPC Calls** | None (linting runs in renderer process) |
| **File Effects** | READ: `.bridge/design-tokens.json` for MithrilLinter token comparison |
| **Test Coverage** | Test #1: Hardcoded `#ff0000` → MITHRIL-COL → ExportGate blocks. Test #2: Missing `alt` → A11Y-001 → ExportGate blocks. Test #3: Clean file → clean audit → ExportGate allows. Test #10: CIEDE2000 reference values |
| **Error States** | Linter throws → empty warnings (fail-open for display, fail-closed for export). Design tokens file missing → MithrilLinter skips color checks (can't compare without tokens) |
| **Commandments** | C2 (No Hallucinated Styling): MithrilLinter enforces token compliance. C5 (Accessibility is Compiler Error): A11yLinter blocks export. C9 (CIEDE2000): Perceptual color distance, not RGB euclidean |
| **Performance** | MithrilLinter: < 80ms. A11yLinter: < 40ms. Combined: < 150ms |

### Step 3.2: Violation Display (Multi-Surface)

| Field | Detail |
|-------|--------|
| **User Action** | Sees violations surfaced across 4 surfaces simultaneously |
| **System Action** | Four components read from `editorStore.linterWarnings` and `canvasStore.mithrilViolations`/`a11yViolations`: (1) `GovernanceOverlay.tsx` — right sidebar list with rule IDs, severity badges, descriptions, "Auto-Fix" buttons. (2) `ShieldOverlay.tsx` — canvas heat tints: `red-500/10` for critical (ΔE > 10), `amber-500/10` for amber (2.0-10.0), no tint for clean. Badge cap: 50 badges, viewport culled with 200px margin. (3) `ViolationTooltip.tsx` — hover popover on ShieldOverlay badges showing rule details. (4) `StatusBar.tsx` — export gate indicator: red if any critical/amber violations, green if clean. |
| **On-ramps** | Step 3.1 (linter results available) |
| **Off-ramps** | Step 3.3 (user clicks Auto-Fix), Step 3.4 (user edits manually), Journey 4 (export gate check) |
| **State Changes** | ShieldOverlay local state: viewport rect for culling. ViolationTooltip local state: hovered badge ID. GovernanceOverlay local state: expanded/collapsed sections |
| **IPC Calls** | None (pure React rendering from Zustand state) |
| **File Effects** | None |
| **Test Coverage** | Glass tests: GovernanceOverlay renders violations, ShieldOverlay renders badges, StatusBar shows correct gate status |
| **Error States** | `nodeLayouts` empty → ShieldOverlay badges won't position (iframe hasn't reported layout). > 50 violations → badge cap kicks in, sorted by severity (critical first) |
| **Commandments** | C9 (CIEDE2000): Severity tiers use perceptual distance thresholds |
| **Performance** | GovernanceOverlay: < 50ms. ShieldOverlay (50 badges): < 30ms. StatusBar: < 10ms |

### Step 3.3: Auto-Fix (Token Violation)

| Field | Detail |
|-------|--------|
| **User Action** | Clicks "Auto-Fix" button on a MithrilLinter violation in GovernanceOverlay |
| **System Action** | `editorStore.applyBatch([{ type: 'fixToken', nodeId, ruleId, tokenValue }])` → `ASTService.applyMutationBatch` performs Babel traversal → finds node by `data-bridge-id` → replaces hardcoded value with token reference → generates inverse mutation for undo → `injectBridgeIds(ast)` after mutation → triggers re-lint (Step 3.1) |
| **On-ramps** | Step 3.2 (user sees violation and clicks fix) |
| **Off-ramps** | Step 3.1 (re-lint) → Step 3.2 (fewer violations) or export gate clear |
| **State Changes** | `editorStore.code` updated with fixed code. `editorStore.ast` updated. `historyStore.past` gets inverse mutation pushed. `editorStore.linterWarnings` updated after re-lint |
| **IPC Calls** | `saveFile` (renderer → main) via auto-save — fixed code persisted via `FileTransactionManager` |
| **File Effects** | WRITE: `.tsx` file via `FileTransactionManager` (atomic `.tmp` → `rename`). WRITE: shadow git commit via `GitManager` |
| **Test Coverage** | Test #6: `bridge_fix` → auto-fixes token violation → re-audit passes. Test #11: `applyMutationBatch` → AST valid → IDs preserved. Test #12: inverse generated → apply inverse → original restored. Test #13: `FileTransactionManager.write()` → atomic write |
| **Error States** | Target node deleted between display and fix → `applyBatch` no-op (C10 pre-flight check). Token value doesn't exist in design tokens → fix fails, error toast. Disk write fails → `FileTransactionManager` retry |
| **Commandments** | C1 (Code is Truth): Fix persists to `.tsx` via AST. C7 (ID Preservation): `injectBridgeIds` after mutation. C10 (Targeted Micro-Recovery): Pre-flight node existence check. C12 (Atomic Queuing): Write via `FileTransactionManager`. C13 (Deterministic Surgery): Babel traversal, not regex |
| **Performance** | Mutation: < 50ms. File write: < 100ms. Re-lint: < 150ms. Total: < 350ms |

### Step 3.4: Manual Fix (Via Host IDE)

| Field | Detail |
|-------|--------|
| **User Action** | Edits the component file in Claude Code / Cursor / VS Code |
| **System Action** | External file change detected by `fs.watch` in main process → fires `bridge:file-changed` IPC → renderer reloads file → `editorStore.setCode(newContents)` → re-parse → re-lint (Step 3.1) |
| **On-ramps** | Step 3.2 (user sees violation, decides to fix manually) |
| **Off-ramps** | Step 3.1 (re-lint after change) |
| **State Changes** | `editorStore.code`, `ast`, `visualTree`, `linterWarnings` all refreshed |
| **IPC Calls** | `bridge:file-changed` (main → renderer, push). `readFile` (renderer → main, to get new contents) |
| **File Effects** | READ: updated `.tsx` file |
| **Test Coverage** | Integration: file change detection → re-lint cycle |
| **Error States** | `fs.watch` misses change (known OS limitation) → 3s poll fallback. File deleted → `activeFile` cleared, LaunchScreen |
| **Commandments** | C1 (Code is Truth): External edits are the new truth, Glass re-parses |
| **Performance** | `fs.watch` notification: < 100ms. Reload + re-lint: < 500ms |

---

## Journey 4: Export Gate

**Persona:** Designer ready to ship code
**Preconditions:** Project open, at least one file loaded
**Success state:** Clean code exported (or violations shown with clear fix path)

### Visual Map

```
[User clicks "Export" in StatusBar]
         |
         v
[ExportModal.tsx opens]
         |
         v
[Full audit runs on all workspace files]
  MithrilLinter.lint() + A11yLinter.lint()
         |
         v
[Aggregate results]
         |
    any violations?
    /            \
  YES             NO
  |                |
  v                v
[GATE: BLOCKED]   [GATE: CLEAR]
  |                |
  v                v
[Show violation   [Export proceeds]
 breakdown:        |
 - Critical (red)  v
 - Amber (amber)  [Write output files]
 - Override count]      |
  |                     v
  v                [Success toast]
[Per-violation
 "Fix" button]
  |
  v
[Auto-fix or
 return to editor]
```

### Step 4.1: Export Triggered

| Field | Detail |
|-------|--------|
| **User Action** | Clicks export button in StatusBar, or uses keyboard shortcut |
| **System Action** | `StatusBar.tsx` dispatches `CustomEvent('bridge:open-export')`. `App.tsx` catches it, sets `showExportModal: true`. `ExportModal.tsx` mounts and runs useEffect: fetches `window.bridgeAPI.tokens.readOverrides()` and `window.bridgeAPI.governance.getComplianceSummary(ruleIds)` in parallel. Reads violation state from stores. |
| **On-ramps** | StatusBar export button, keyboard shortcut, OS menu File > Export |
| **Off-ramps** | Step 4.2 (audit runs) |
| **State Changes** | ExportModal local state: `isOpen: true`, `auditResults: null`, `isAuditing: true` |
| **IPC Calls** | None yet (audit runs client-side) |
| **File Effects** | None |
| **Test Coverage** | Glass test: ExportModal opens on trigger |
| **Error States** | No active project → export button disabled |
| **Commandments** | C6 (Gatekeeper Rule): Export gate is the enforcement point |
| **Performance** | Modal open: < 50ms |

### Step 4.2: Full Workspace Audit

| Field | Detail |
|-------|--------|
| **User Action** | Sees "Auditing..." spinner in ExportModal |
| **System Action** | For each file in workspace: read contents → parse AST → run MithrilLinter + A11yLinter. Aggregate all violations. Check `governanceStore` for active overrides. |
| **On-ramps** | Step 4.1 (export triggered) |
| **Off-ramps** | Step 4.3 (gate decision) |
| **State Changes** | ExportModal local state: `auditResults` populated with per-file violation maps |
| **IPC Calls** | `readFile` for each workspace file (batch) |
| **File Effects** | READ: all `.tsx` files in workspace. READ: `.bridge/design-tokens.json` for token comparison |
| **Test Coverage** | Test #1: Hardcoded color → blocks. Test #2: Missing alt → blocks. Test #3: Clean → allows. Test #5: `bridge_audit` tool returns correct violations |
| **Error States** | File read fails → skip file, warn in results. Linter crash → fail-closed (export blocked with "audit error" message) |
| **Commandments** | C5 (Accessibility is Compiler Error): A11y violations are blocking. C6 (Gatekeeper Rule): Any override or drift blocks export |
| **Performance** | Audit 10 files: < 2s. Audit 50 files: < 8s. Progress indicator updates per file |

### Step 4.3: Gate Decision

| Field | Detail |
|-------|--------|
| **User Action** | Sees BLOCKED (red) or CLEAR (green) status |
| **System Action** | `ExportModal` evaluates: `canExport = overrideRows.length === 0 && mithrilViolations.length === 0 && Object.keys(a11yViolations).length === 0`. Severity escalation: `hasCriticalMithril = mithrilViolations.some(id => linterWarnings.get(id)?.severity === 'critical')` — critical (ΔE > 10) gets red header + red badge, amber (2.0-10.0) gets amber styling. Compliance summary section (GOV.1) shows authority breakdown and per-rule regulatory references. |
| **On-ramps** | Step 4.2 (audit complete) |
| **Off-ramps** | BLOCKED: Step 4.4 (violation breakdown). CLEAR: Step 4.5 (export proceeds) |
| **State Changes** | ExportModal local state: `gateStatus: 'blocked' | 'clear'`, `violationsByFile`, `overrideCount` |
| **IPC Calls** | None |
| **File Effects** | None |
| **Test Coverage** | Test #1, #2, #3: gate blocks/allows correctly. Test #4: Override recorded → badge count |
| **Error States** | None (this is a pure computation on audit results) |
| **Commandments** | C5 (Accessibility): A11y violations = compiler error. C6 (Gatekeeper): Overrides and drift block export |
| **Performance** | Gate evaluation: < 10ms (simple aggregation) |

### Step 4.4: Violation Breakdown (Blocked Path)

| Field | Detail |
|-------|--------|
| **User Action** | Reviews violation list grouped by file. Can click "Fix" on individual violations or "Fix All" for auto-fixable issues. Can close modal to return to editing. |
| **System Action** | ExportModal renders violation cards: file path, rule ID, severity badge (red/amber), description, "Fix" button (if auto-fixable). Shows total counts: `N critical, M amber, K a11y, J overrides`. |
| **On-ramps** | Step 4.3 (gate blocked) |
| **Off-ramps** | "Fix" → Journey 3 step 3.3 (auto-fix). Close modal → return to canvas. "Fix All" → batch fix |
| **State Changes** | None (display only) |
| **IPC Calls** | None |
| **File Effects** | None |
| **Test Coverage** | Glass test: ExportModal shows correct violation count and severity |
| **Error States** | None |
| **Commandments** | C6 (Gatekeeper): Making the blocked state visible and actionable |
| **Performance** | Render: < 50ms |

### Step 4.5: Export Proceeds (Clear Path)

| Field | Detail |
|-------|--------|
| **User Action** | Clicks "Export" confirmation button |
| **System Action** | Writes output files to export directory via `FileTransactionManager`. Each file write is atomic (`.tmp` → `rename`). |
| **On-ramps** | Step 4.3 (gate clear) |
| **Off-ramps** | Success toast → return to canvas |
| **State Changes** | `canvasStore.saveState: 'saved'` |
| **IPC Calls** | `saveFileBatch` (renderer → main) |
| **File Effects** | WRITE: exported files via `FileTransactionManager` atomic queue |
| **Test Coverage** | Test #13: `FileTransactionManager.write()` → atomic write |
| **Error States** | Disk full → `FileTransactionManager` error → toast. Permission denied → toast with path |
| **Commandments** | C12 (Atomic Queuing): All writes via `FileTransactionManager` |
| **Performance** | Export 10 files: < 1s |

---

## Journey 5: Canvas Interaction

**Persona:** Designer editing a component visually
**Preconditions:** Project open, file loaded, canvas visible
**Success state:** Property change applied, preview updated, undo available

### Visual Map

```
[Design mode active (canvasStore.canvasMode === 'design')]
         |
         v
[ShieldOverlay intercepts mouse events]
         |
         v
[User clicks node in preview]
         |
         v
[postMessage from iframe: { type: 'NODE_CLICK', bridgeId }]
         |
         v
[editorStore.setActiveSelection(bridgeId)]
         |
         v
[Right sidebar switches to Properties tab]
[LayerTree highlights selected node]
[ShieldOverlay shows selection outline]
         |
         v
[User edits property in PropertiesPanel]
  (e.g., changes className, text content, prop value)
         |
         v
[editorStore.applyBatch([mutation])]
         |
         v
[ASTService.applyMutationBatch(ast, [mutation])]
  ├── Babel traverse → find node by data-bridge-id
  ├── Apply mutation (updateClassName / updateTextContent / updateProp)
  ├── Generate inverse mutation → push to historyStore.past
  └── injectBridgeIds(ast) → preserve IDs
         |
         v
[editorStore.syncCode()] → generate code from AST
         |
         v
[LivePreview.tsx re-renders srcdoc]
[MithrilLinter + A11yLinter re-run]
[Auto-save: saveFile IPC]
```

### Step 5.1: Node Selection

| Field | Detail |
|-------|--------|
| **User Action** | Clicks on a visual element in the LivePreview iframe |
| **System Action** | In `design` mode, the iframe's bridge-init script listens for clicks on elements with `data-bridge-id`. On click, iframe posts `{ type: 'CANVAS_CLICK', id: bridgeId }` to parent. `ShieldOverlay.tsx` message handler intercepts: (1) validates source is iframe, (2) checks presence lock via `lockedNodeIdsRef` — if locked by remote user, shows notification and blocks, (3) if clear: calls `setSelectedNode(id)` + `setActiveSelection(id)`. |
| **On-ramps** | Canvas visible in design mode. Also: LayerTree click, Properties panel node picker |
| **Off-ramps** | Step 5.2 (properties panel updates) |
| **State Changes** | `editorStore.activeSelection: string` set to bridgeId. Right sidebar auto-switches to 'properties' tab |
| **IPC Calls** | None (postMessage between iframe and parent, not Electron IPC) |
| **File Effects** | `.bridge/context.json` updated with `selectedNode: bridgeId` (via useContextSync debounce) |
| **Test Coverage** | Glass test: selection state updates on node click |
| **Error States** | Click on non-element area → no bridgeId → selection cleared. In `interact` mode → ShieldOverlay removed, clicks pass through to iframe directly (normal browser behavior) |
| **Commandments** | C7 (ID Preservation): Selection keys on `data-bridge-id` |
| **Performance** | Click → selection state: < 30ms |

### Step 5.2: Properties Panel Update

| Field | Detail |
|-------|--------|
| **User Action** | Sees selected node's properties in the right sidebar |
| **System Action** | PropertiesPanel reads `editorStore.activeSelection` → finds AST node → displays: element type, className, text content, props, layout properties (via LayoutPanel). If node has annotations → AnnotationList section shows. If node has violations → violation section shows. |
| **On-ramps** | Step 5.1 (node selected) |
| **Off-ramps** | Step 5.3 (user edits a property) |
| **State Changes** | PropertiesPanel local state refreshes from AST node data |
| **IPC Calls** | None |
| **File Effects** | None |
| **Test Coverage** | Glass test: PropertiesPanel reflects selected node |
| **Error States** | Selected node no longer in AST (deleted between selection and render) → "Node not found" message |
| **Commandments** | None directly |
| **Performance** | Panel update: < 50ms |

### Step 5.3: Property Edit

| Field | Detail |
|-------|--------|
| **User Action** | Changes a property value (className, text, prop, layout setting) |
| **System Action** | PropertiesPanel (or LayoutPanel) constructs a mutation: `{ type: 'updateClassName', nodeId, value }` or `{ type: 'updateTextContent', nodeId, value }` or `{ type: 'updateProp', nodeId, propName, propValue }`. Calls `editorStore.applyBatch([mutation])`. |
| **On-ramps** | Step 5.2 (properties visible) |
| **Off-ramps** | Step 5.4 (AST mutation applies) |
| **State Changes** | Mutation queued in `editorStore` |
| **IPC Calls** | None yet |
| **File Effects** | None yet |
| **Test Coverage** | Test #11: applyMutationBatch → AST valid. Test #12: inverse → original restored |
| **Error States** | Invalid value → mutation rejected, error toast |
| **Commandments** | C15 (Granular AST Tools): Only versioned catalog ops |
| **Performance** | Input → mutation construction: < 10ms |

### Step 5.4: AST Mutation + Preview Update

| Field | Detail |
|-------|--------|
| **User Action** | Sees preview update immediately |
| **System Action** | `editorStore.applyBatch` → `ASTService.applyMutationBatch(ast, mutations)`: (1) Babel traverse finds node by `data-bridge-id`. (2) Applies mutation. (3) Generates inverse mutation. (4) Pushes inverse to `historyStore.past`. (5) `injectBridgeIds(ast)` preserves IDs. (6) `editorStore.syncCode()` generates code string from AST. (7) `LivePreview` re-renders `srcdoc` with new code. (8) MithrilLinter + A11yLinter re-run. (9) Auto-save fires: `saveFile` IPC → `FileTransactionManager` atomic write. (10) `GitManager.shadowCommit()` for recovery baseline. |
| **On-ramps** | Step 5.3 (property edit submitted) |
| **Off-ramps** | User sees updated preview → continues editing (Step 5.1) or moves to another journey |
| **State Changes** | `editorStore.code` updated. `editorStore.ast` updated. `historyStore.past` gets inverse pushed. `editorStore.linterWarnings` refreshed. `canvasStore.saveState: 'saving' → 'saved'` |
| **IPC Calls** | `saveFile` (renderer → main) — auto-save with debounce |
| **File Effects** | WRITE: `.tsx` file via `FileTransactionManager`. WRITE: shadow git commit. UPDATE: `.bridge/context.json` via useContextSync |
| **Test Coverage** | Test #11: batch mutation atomic + IDs preserved. Test #12: inverse → original restored. Test #13: FileTransactionManager atomic write. Test #14: shadowCommit → gitShow returns content |
| **Error States** | Babel traversal fails → `applyBatch` returns error, code unchanged. Target node missing → no-op (C10 pre-flight). File write fails → retry queue in `FileTransactionManager` |
| **Commandments** | C1 (Code is Truth): Mutation saved to `.tsx`. C7 (ID Preservation): `injectBridgeIds` after every op. C10 (Targeted Micro-Recovery): Pre-flight node check. C12 (Atomic Queuing): `FileTransactionManager`. C13 (Deterministic Surgery): Babel AST only |
| **Performance** | Mutation + code gen: < 80ms. Preview update: < 200ms. Auto-save: < 100ms (debounced). Total perceived latency: < 300ms |

---

## Journey 6: Recovery / Undo

**Persona:** Designer who made a mistake or wants to explore previous states
**Preconditions:** Project open, at least one mutation in history
**Success state:** Code reverted to desired state, undo stack correct

### Visual Map

```
[User presses Cmd+Z]
         |
         v
[App.tsx keyboard handler]
  (checks: not in input/textarea focus)
         |
         v
[recoveryController.undo()]
         |
         v
[historyStore.past.length > 0?]
    /            \
  YES             NO
  |                |
  v                v
[Pop inverse     [No-op, toast
 from past]       "Nothing to undo"]
  |
  v
[Pre-flight: does target node exist in AST?]  ← C10
    /            \
  YES             NO
  |                |
  v                v
[Apply inverse   [Skip this entry,
 mutation]        try next in stack]
  |
  v
[Was this a crossFileMove?]
    /            \
  NO              YES
  |                |
  v                v
[Standard        [Cross-file undo:
 single-file      revert both source
 undo]            and target files]
  |                |
  v                v
[editorStore.syncCode()]
[LivePreview re-renders]
[Push forward mutation to historyStore.future]
         |
         v
[Cmd+Shift+Z available for Redo]

--- OR ---

[User opens Recovery Panel (Git Time Machine)]
         |
         v
[IPC: ast:git-log → returns commit history]
         |
         v
[User selects a commit + node]
         |
         v
[IPC: ast:git-show → returns node AST from that commit]
         |
         v
[transplantNode(currentAST, historicalNode)]  ← C11: surgical, not checkout
         |
         v
[Specific node reverted, surrounding code untouched]
```

### Step 6.1: Keyboard Undo (Cmd+Z)

| Field | Detail |
|-------|--------|
| **User Action** | Presses Cmd+Z (Mac) or Ctrl+Z (Windows) |
| **System Action** | `App.tsx` keydown handler checks: (1) No focused input/textarea (loose equality `!= null` guard). (2) Calls `recoveryController.undo()`. |
| **On-ramps** | Any state where canvas is focused and history exists |
| **Off-ramps** | Step 6.2 (history check) |
| **State Changes** | None yet |
| **IPC Calls** | None yet |
| **File Effects** | None yet |
| **Test Coverage** | Glass test: keyboard shortcut triggers undo |
| **Error States** | Focus guard fails → undo fires in wrong context (Known Issue #3: Monaco undo guard) |
| **Commandments** | None directly |
| **Performance** | Keydown → handler: < 5ms |

### Step 6.2: History Stack Check + Pre-flight

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic) |
| **System Action** | `recoveryController.applyUndo()`: (1) `historyStore.popUndo()` → `HistoryEntry | null`. (2) Loop through batchId-tagged entries (groups cross-file moves). (3) Branch: `group.some(e => e.filePath !== undefined)` → TRUE: `applyCrossFileUndo(group)` which calls `saveFileBatch()` atomically, evicts/reloads AST buffers with 7D hardening (`injectBridgeIds`), syncs active editor. FALSE: `applySingleFileUndo(entry)` which calls `applyInversions(rawCode, entry.inversions)` → `editorStore.syncCode(restoredCode)` → `triggerAutoSave()`. (4) `historyStore.pushFuture(redoEntry)` enables redo. |
| **On-ramps** | Step 6.1 (Cmd+Z), or programmatic undo call |
| **Off-ramps** | Step 6.3 (apply inverse) or no-op toast if history empty |
| **State Changes** | `historyStore.past` popped |
| **IPC Calls** | None |
| **File Effects** | None |
| **Test Coverage** | Test #12: inverse generated → apply inverse → original restored |
| **Error States** | Empty history → "Nothing to undo" toast. All remaining entries target deleted nodes → "Cannot undo" toast |
| **Commandments** | C10 (Targeted Micro-Recovery): Pre-flight node existence check before applying inverse |
| **Performance** | Stack check + pre-flight: < 10ms |

### Step 6.3: Apply Inverse Mutation

| Field | Detail |
|-------|--------|
| **User Action** | Sees previous state restored in preview |
| **System Action** | `editorStore.applyBatch([inverseMutation])` with `isRecovery: false` (standard undo). AST mutated, code regenerated, preview updates. Forward mutation pushed to `historyStore.future` (enables redo). Auto-save fires. |
| **On-ramps** | Step 6.2 (pre-flight passed) |
| **Off-ramps** | Canvas updated, Cmd+Shift+Z available for redo |
| **State Changes** | `editorStore.code` reverted. `historyStore.future` gets forward mutation. `canvasStore.saveState: 'saving' → 'saved'` |
| **IPC Calls** | `saveFile` (auto-save) |
| **File Effects** | WRITE: `.tsx` reverted via `FileTransactionManager`. WRITE: shadow commit |
| **Test Coverage** | Test #12: inverse → original. Test #13: atomic write. Test #14: shadow commit |
| **Error States** | Inverse mutation application fails → code unchanged, error toast, entry discarded |
| **Commandments** | C1 (Code is Truth): Undo persists to file. C12 (Atomic Queuing): via FileTransactionManager |
| **Performance** | Apply inverse: < 80ms. Total undo cycle: < 300ms |

### Step 6.4: Git Time Machine (Surgical Recovery)

| Field | Detail |
|-------|--------|
| **User Action** | Opens RecoveryPanel from toolbar or right-click menu. Browses commit history. Selects a commit and a specific node to restore. |
| **System Action** | `RecoveryPanel.tsx` calls `window.bridgeAPI.gitLog(filePath)` → executes `git log --pretty=format:%H|%s|%at` → returns `[{ hash, message, timestamp }]`. User selects commit → `editorStore.revertNodeToCommit(nodeId, hash)`: (1) `window.bridgeAPI.gitShow(filePath, hash)` → executes `git show ${hash}:${filePath}` → returns historic source. (2) `adapter.parse(historicCode)` → historic AST. (3) `adapter.parse(rawCode)` → fresh AST. (4) `adapter.transplantNode(freshAST, historicAST, nodeId)` → Babel deep clone of historic node into fresh AST. (5) `adapter.generate(freshAST)` → new code. (6) Reparse + `set({ rawCode, ast, visualTree })` + `triggerAutoSave()`. (7) `historyStore.push(inversions)` — transplant is undoable. |
| **On-ramps** | Recovery Panel button, right-click menu "Restore from history" |
| **Off-ramps** | Node restored → canvas updates, or cancel → no change |
| **State Changes** | `editorStore.code` updated with transplanted node. `historyStore.past` gets inverse for the transplant |
| **IPC Calls** | `ast:git-log` (renderer → main). `ast:git-show` (renderer → main). `saveFile` (auto-save after transplant) |
| **File Effects** | READ: git history. WRITE: `.tsx` file with transplanted node. WRITE: shadow commit |
| **Test Coverage** | Test #14: `GitManager.shadowCommit()` → `gitShow(HEAD)` → returns content |
| **Error States** | Node no longer exists in historical commit → "Node not found in that version" message. Git repo corrupt → RecoveryPanel disabled |
| **Commandments** | C11 (Surgical Git Transplants): Never `git checkout` a shared file. Extract specific node from history and transplant into live AST. C14 (Bypass Prohibition): All git ops through `GitManager` |
| **Performance** | Git log: < 500ms. Git show: < 200ms. Transplant: < 100ms |

---

## Journey 7: MCP Agent Workflow

**Persona:** AI agent (Claude Code, Cursor) connecting to Bridge MCP via stdio
**Preconditions:** MCP server running, project root configured
**Success state:** Agent runs governance audit, auto-fixes violations, verifies compliance

### Visual Map

```
[AI Agent connects to Bridge MCP via stdio]
         |
         v
[bridge_status] → { ok: true, projectRoot, version }
         |
         v
[bridge_audit({ filePath })]
         |
         v
[MithrilLinter + A11yLinter + SARIF formatter]
         |
         v
[Returns: { violations[], sarif, summary }]
         |
    violations?
    /         \
  YES          NO
  |             |
  v             v
[bridge_fix({  [Agent reports
  filePath,     "All clean"]
  ruleId })]
  |
  v
[AST mutation: fixToken / fixA11y]
  |
  v
[bridge_audit({ filePath })]  ← verify fix
  |
  v
[Clean?] ──YES──> [bridge_debt_report]
                          |
                          v
                   [Health score, grade, trend]
                          |
                          v
                   [Agent reports results to user]
```

### Step 7.1: MCP Connection + Status

| Field | Detail |
|-------|--------|
| **User Action** | AI agent establishes MCP connection (configured in `~/.claude/mcp.json`) |
| **System Action** | MCP server starts via stdio transport. `bridge_status` tool returns `{ ok, projectRoot, version, toolCount, resourceCount }` |
| **On-ramps** | Claude Code session start, Cursor MCP activation, CI pipeline |
| **Off-ramps** | Step 7.2 (agent calls audit) |
| **State Changes** | MCP server internal state: `projectRoot` set |
| **IPC Calls** | MCP JSON-RPC over stdio |
| **File Effects** | READ: project root validation |
| **Test Coverage** | MCP test: bridge_status returns correct shape |
| **Error States** | Server not installed → MCP client error. Invalid project root → status returns `{ ok: false, error }` |
| **Commandments** | None directly |
| **Performance** | Server start: < 1s. Status call: < 50ms |

### Step 7.2: Audit Execution

| Field | Detail |
|-------|--------|
| **User Action** | AI agent calls `bridge_audit({ filePath: "src/components/MyComponent.tsx" })` |
| **System Action** | `bridge-mcp/src/tools/audit.ts` handler: (1) Reads file. (2) Parses AST via Babel. (3) Runs `MithrilLinter.lint(ast, designTokens)`. (4) Runs `A11yLinter.lint(ast)`. (5) Formats as SARIF 2.1.0. (6) Records event in `governance_events` table. (7) Returns structured result. |
| **On-ramps** | Step 7.1 (connected), or any point in agent workflow |
| **Off-ramps** | Step 7.3 (fix if violations) or Step 7.5 (report if clean) |
| **State Changes** | MCP server: event recorded in SQLite |
| **IPC Calls** | MCP JSON-RPC |
| **File Effects** | READ: target `.tsx` file. READ: `.bridge/design-tokens.json`. WRITE: `governance_events` table row |
| **Test Coverage** | Test #5: `bridge_audit` → returns violations with correct ruleIds and severity. Test #1: hardcoded color detected. Test #2: missing alt detected |
| **Error States** | File not found → error response. Parse error → error response with location. Linter crash → partial results + error flag |
| **Commandments** | C8 (Audit-First): Every action starts with audit. C9 (CIEDE2000): Color distance is perceptual |
| **Performance** | Single file audit: < 500ms |

### Step 7.3: Auto-Fix

| Field | Detail |
|-------|--------|
| **User Action** | AI agent calls `bridge_fix({ filePath, ruleId })` |
| **System Action** | `bridge-mcp/src/tools/fix.ts` handler: (1) Reads file. (2) Parses AST. (3) Locates violation by ruleId + nodeId. (4) Applies deterministic fix (token replacement for Mithril, attribute addition for A11y). (5) Generates code from fixed AST. (6) Writes file via atomic write. (7) Records mutation in `mutations_ledger` table. (8) Returns `{ fixed: true, filePath, ruleId }`. |
| **On-ramps** | Step 7.2 (violations found) |
| **Off-ramps** | Step 7.4 (verify fix) |
| **State Changes** | MCP server: mutation recorded in SQLite |
| **IPC Calls** | MCP JSON-RPC |
| **File Effects** | READ: `.tsx` file. WRITE: fixed `.tsx` file (atomic). WRITE: `mutations_ledger` table row |
| **Test Coverage** | Test #6: `bridge_fix` → auto-fixes → re-audit passes. Test #15: `GovernanceEventService.recordEvent()` round-trip. Test #16: `MutationLedgerService.recordMutation()` round-trip |
| **Error States** | Rule not auto-fixable → `{ fixed: false, reason: 'manual fix required' }`. File write fails → error response, file unchanged. Node no longer exists → `{ fixed: false, reason: 'target node not found' }` |
| **Commandments** | C1 (Code is Truth): Fix persists to file. C12 (Atomic Queuing): Write via atomic pattern. C13 (Deterministic Surgery): Babel AST traversal |
| **Performance** | Fix single violation: < 300ms |

### Step 7.4: Verification Audit

| Field | Detail |
|-------|--------|
| **User Action** | AI agent calls `bridge_audit({ filePath })` again to verify |
| **System Action** | Same as Step 7.2. Should return fewer or zero violations. |
| **On-ramps** | Step 7.3 (fix applied) |
| **Off-ramps** | Still violations → Step 7.3 (fix next). Clean → Step 7.5 (report) |
| **State Changes** | New event in `governance_events` |
| **IPC Calls** | MCP JSON-RPC |
| **File Effects** | Same as Step 7.2 |
| **Test Coverage** | Test #6: fix → re-audit passes |
| **Error States** | Fix introduced new violation → agent can detect regression |
| **Commandments** | C8 (Audit-First): Verify after every mutation |
| **Performance** | < 500ms |

### Step 7.5: Debt Report

| Field | Detail |
|-------|--------|
| **User Action** | AI agent calls `bridge_debt_report({ track: true })` |
| **System Action** | `bridge_debt_report` tool: scans all workspace files, computes health score (0-100), grade (A-F), top violated rules, top violated files. If `track: true`, appends snapshot to `.bridge/debt-history.json` for trend tracking. |
| **On-ramps** | Step 7.4 (all clean), or standalone health check |
| **Off-ramps** | Agent reports to user. If Glass is open, dashboard updates (via fs.watch push) |
| **State Changes** | Debt history updated |
| **IPC Calls** | MCP JSON-RPC |
| **File Effects** | READ: all `.tsx` files. READ: `.bridge/design-tokens.json`. WRITE: `.bridge/debt-history.json` (if tracking). READ/WRITE: `governance_events` table |
| **Test Coverage** | Test #7: `bridge_debt_report` → score 0-100 with correct grade. Test #23: `bridge://dashboard` resource returns DashboardData |
| **Error States** | No files → score 100, grade A (nothing to violate). Tokens missing → partial audit |
| **Commandments** | C4 (Local-First): All data is local files and SQLite |
| **Performance** | Full project scan: < 5s for 50 files |

---

## Journey 8: Figma Import

**Persona:** Designer importing designs from Figma
**Preconditions:** Figma plugin installed, Bridge ingestion server running (port 4545)
**Success state:** Figma tokens/components appear in Bridge

### Visual Map

```
[Figma Plugin sends data to localhost:4545]
         |
    endpoint?
    /     |      \
   /      |       \
  v       v        v
[/ingest]  [/ingest-ast]  [/ingest-asset]
  |            |               |
  v            v               v
[Token      [AST payload    [Image asset
 Variables]  from Figma]     upload]
  |            |               |
  v            v               v
[normalizer.ts:  [hydrate:    [Asset stored
 Figma → W3C    Figma AST →   in project
 DTCG format]   React JSX]    directory]
  |            |
  v            v
[tokenStore.  [bridge:hydro-paste-auto IPC]
 import()]     |
  |            v
  v         [editorStore.setCode(hydrated)]
[.bridge/      |
 design-       v
 tokens.json] [Canvas renders new component]
  |
  v
[MithrilLinter now has tokens for comparison]
  |
  v
[StatusBar Figma dot: emerald (synced)]
```

### Step 8.1: Figma Plugin Sends Data

| Field | Detail |
|-------|--------|
| **User Action** | Clicks "Send to Bridge" in Figma plugin |
| **System Action** | Figma plugin sends HTTP POST to `localhost:4545` with `x-bridge-secret` auth header. Three possible endpoints: `/ingest` (design variables), `/ingest-ast` (component AST), `/ingest-asset` (images) |
| **On-ramps** | Figma plugin action, LaunchScreen "Connect Figma" link (to setup docs) |
| **Off-ramps** | Step 8.2 (token normalization) or Step 8.3 (AST hydration) or Step 8.4 (asset storage) |
| **State Changes** | `ingestion-server.ts` updates `lastWebhookAt` timestamp |
| **IPC Calls** | HTTP POST (external → loopback, not Electron IPC) |
| **File Effects** | None yet |
| **Test Coverage** | MCP test: ingestion server endpoint validation |
| **Error States** | Wrong/missing `x-bridge-secret` → 401. Server not running → connection refused. Malformed payload → 400 with validation errors |
| **Commandments** | C4 (Local-First): Loopback HTTP only, no external network |
| **Performance** | Request received: < 50ms |

### Step 8.2: Token Normalization (/ingest)

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic after plugin send) |
| **System Action** | `normalizeFigmaVariables(payload)` converts Figma Variables to normalized rows: extracts `token_path`, `token_type`, `token_value`, maps modes to separate rows. `batchUpsertTokens(tokens)` performs atomic SQLite transaction: `INSERT OR REPLACE INTO design_tokens (token_path, token_type, token_value, description, mode, collection_name, updated_at)`. Fires two IPC events: `bridge:tokens-updated` (triggers `tokenStore.fetchTokens()` in renderer) and `bridge:figma-connected` with `{ tokenCount, timestamp }`. |
| **On-ramps** | Step 8.1 (/ingest endpoint) |
| **Off-ramps** | MithrilLinter re-audits with new tokens via MithrilProvider (enables Journey 3) |
| **State Changes** | `tokenStore.tokens` refreshed via `fetchTokens()` → `window.bridgeAPI.tokens.readAll()` → SQLite SELECT. `ingestion-server.ts`: `tokenCounts` + `lastWebhookAt` updated |
| **IPC Calls** | `bridge:tokens-updated` (main → renderer, push). `bridge:figma-connected` (main → renderer, push with count + timestamp) |
| **File Effects** | WRITE: SQLite `design_tokens` table (one row per token per mode). Optional: `.bridge/design-tokens.json` on explicit export |
| **Test Coverage** | Test #17: Design tokens CRUD → token change → Mithril re-audit detects drift |
| **Error States** | Invalid Figma variables → skip malformed entries, log warning. Write fails → retry |
| **Commandments** | C2 (No Hallucinated Styling): Tokens are the source of truth for styling. C12 (Atomic Queuing): Token file written atomically |
| **Performance** | Normalization + write: < 500ms for 200 tokens |

### Step 8.3: AST Hydration (/ingest-ast)

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic after plugin send) |
| **System Action** | Ingestion server receives Figma AST payload. Validates against `BridgeSDIPayload` schema. Writes to `.bridge/current-intent.json`. Fires `bridge:hydro-paste-auto` IPC. Renderer calls `hydrate_figma_data` to convert Figma AST → React JSX. `editorStore.setCode(hydratedCode)` loads result. |
| **On-ramps** | Step 8.1 (/ingest-ast endpoint) |
| **Off-ramps** | Canvas renders imported component (Journey 5) |
| **State Changes** | `editorStore.code` set to hydrated React JSX. `editorStore.ast` parsed. `visualTree` built |
| **IPC Calls** | `bridge:hydro-paste-auto` (main → renderer). `saveFile` (auto-save after hydration) |
| **File Effects** | WRITE: `.bridge/current-intent.json`. WRITE: hydrated `.tsx` file |
| **Test Coverage** | MCP test: `hydrate_figma_data` tool produces valid JSX |
| **Error States** | Invalid Figma AST → validation error response. Hydration produces invalid JSX → parse error in renderer |
| **Commandments** | C1 (Code is Truth): Hydrated code saved to `.tsx`. C4 (Local-First): All processing local. C7 (ID Preservation): `injectBridgeIds` on hydrated AST |
| **Performance** | Hydration: < 1s for typical component. Total from Figma click to canvas: < 3s |

### Step 8.4: Asset Storage (/ingest-asset)

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic) |
| **System Action** | Image asset received, stored in project `assets/` directory. Metadata written to `assetStore`. |
| **On-ramps** | Step 8.1 (/ingest-asset endpoint) |
| **Off-ramps** | Asset available in AssetsPanel |
| **State Changes** | `assetStore`: new asset entry |
| **IPC Calls** | `bridge:asset-imported` (main → renderer) |
| **File Effects** | WRITE: image file to `assets/` directory |
| **Test Coverage** | MCP test: asset ingestion stores file correctly |
| **Error States** | Unsupported format → 400. Disk full → 500 |
| **Commandments** | C4 (Local-First): Asset stored locally |
| **Performance** | < 500ms for typical image |

---

## Journey 9: Developer Workflow (Contract-First)

**Persona:** Developer (or AI swarm) building a new Bridge feature
**Preconditions:** Feature request defined, CLAUDE.md and HANDOFF.md read
**Success state:** Feature implemented, tested, PR created, merged

### Visual Map

```
[Feature Request]
         |
         v
GIT: bridge-git-guru
  └── git checkout -b feat/<phase>-<description>
         |
         v
PHASE 1: bridge-architect
  ├── Reads affected source files
  ├── Identifies ownership (process, store, component)
  ├── Writes TypeScript interfaces for cross-boundary contracts
  ├── Checks Commandment compliance
  └── Writes Contract Artifact → .bridge-context/contracts/<name>.md
         |
         v
GIT: bridge-git-guru
  └── git commit: "docs(<phase>): add contract for <feature>"
         |
         v
PHASE 2: Parallel specialist agents
  ┌─────────────────────────────────────────────────────┐
  │  GROUP A (parallel):                                 │
  │    bridge-electron-ipc → IPC channels + preload      │
  │    bridge-state-architect → store slices + actions    │
  │                                                      │
  │  GROUP B (parallel, after A):                        │
  │    bridge-design-engineer → UI components             │
  │    bridge-test-writer → tests                        │
  └─────────────────────────────────────────────────────┘
  Each agent:
    1. Reads contract artifact
    2. Implements EXACTLY the interfaces defined
    3. Runs npx tsc --noEmit
    4. Reports contract gaps (if any → back to Phase 1)
         |
         v
GIT: bridge-git-guru (per agent)
  └── git commit: "feat(<scope>): implement <what> per contract"
  └── Pre-commit gate: TSC + relevant test suites
         |
         v
PHASE 3: bridge-integration-validator
  ├── Check 1: Full type check (npx tsc --noEmit)
  ├── Check 2: IPC symmetry (main ↔ preload ↔ renderer)
  ├── Check 3: Store isolation (no cross-store imports)
  ├── Check 4: Contract fidelity (interfaces match impl)
  ├── Check 5: Commandment compliance
  ├── Check 6: Test coverage (every new API has test)
  ├── Check 7: Process boundary (no fs in src/)
  └── Check 8: Import hygiene (no circular, no unused)
         |
    verdict?
    /     |      \
   v      v       v
 SHIP    FIX    REDESIGN
  |       |        |
  v       v        v
[PR]   [Fix +   [Back to
        re-run   Phase 1]
        Phase 3]
         |
         v
GIT: bridge-git-guru
  ├── Pre-commit gate: TSC + ALL test suites
  ├── git push -u origin <branch>
  └── gh pr create (body from contract + validation report)
         |
         v
[PR Review + Merge]
         |
         v
GIT: bridge-git-guru
  ├── git checkout main && git pull
  └── git branch -d <feature-branch>
```

### Step 9.1: Feature Branch Creation

| Field | Detail |
|-------|--------|
| **User Action** | Describes feature to implement |
| **System Action** | `bridge-git-guru` creates branch: `git checkout -b feat/<phase>-<description>` from up-to-date main |
| **On-ramps** | Feature request from user, roadmap phase, bug report |
| **Off-ramps** | Step 9.2 (architect designs contract) |
| **State Changes** | Git: new branch created |
| **IPC Calls** | None (git CLI) |
| **File Effects** | `.git/` refs updated |
| **Test Coverage** | N/A (git operation) |
| **Error States** | Uncommitted changes on main → stash first. Branch already exists → increment suffix |
| **Commandments** | None directly |
| **Performance** | < 2s |

### Step 9.2: Contract Design (Phase 1)

| Field | Detail |
|-------|--------|
| **User Action** | Reviews and approves the contract artifact |
| **System Action** | `bridge-architect` agent: (1) Reads all affected source files. (2) Identifies ownership (which process, store, component). (3) Writes TypeScript interfaces for all cross-boundary data. (4) Defines IPC channels with direction, payload, return types. (5) Specifies store state shapes, actions, selectors. (6) Lists component props and store dependencies. (7) Checks applicable Commandments. (8) Writes contract to `.bridge-context/contracts/<name>.md`. |
| **On-ramps** | Step 9.1 (branch ready) |
| **Off-ramps** | Step 9.3 (commit contract) → Step 9.4 (parallel implementation) |
| **State Changes** | Contract artifact created on disk |
| **IPC Calls** | None (planning phase) |
| **File Effects** | WRITE: `.bridge-context/contracts/<feature-name>.md` |
| **Test Coverage** | N/A (design artifact, not code) |
| **Error States** | Architect identifies Commandment conflict → redesign before proceeding. Missing information → architect requests clarification |
| **Commandments** | All applicable Commandments are checked in the contract |
| **Performance** | Varies by feature complexity. Simple: 5-10 min. Complex: 30+ min |

### Step 9.3: Contract Commit

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic via bridge-git-guru) |
| **System Action** | `bridge-git-guru` stages and commits: `docs(<phase>): add contract for <feature>` |
| **On-ramps** | Step 9.2 (contract approved) |
| **Off-ramps** | Step 9.4 (implementation begins) |
| **State Changes** | Git: contract committed |
| **IPC Calls** | None |
| **File Effects** | Git commit of contract artifact |
| **Test Coverage** | N/A |
| **Error States** | None (simple file commit) |
| **Commandments** | None |
| **Performance** | < 5s |

### Step 9.4: Parallel Implementation (Phase 2)

| Field | Detail |
|-------|--------|
| **User Action** | Spawns specialist agents (or codes manually) |
| **System Action** | Each specialist agent: (1) Reads contract artifact. (2) Implements exactly the interfaces defined. (3) Does NOT modify files outside its assignment. (4) Runs `npx tsc --noEmit` on its changes. (5) Reports any contract gaps. Parallelism: Group A (IPC + stores) runs first, Group B (UI + tests) runs after. |
| **On-ramps** | Step 9.3 (contract committed) |
| **Off-ramps** | Step 9.5 (git commit per agent) → Step 9.6 (validation) |
| **State Changes** | Source files modified per contract |
| **IPC Calls** | None (code changes, not runtime) |
| **File Effects** | WRITE: modified/new source files per contract Impact Map |
| **Test Coverage** | Each agent runs TSC. Test writer creates tests per contract |
| **Error States** | Contract gap discovered → STOP, report gap, return to Step 9.2 for revision. Type error → fix before proceeding |
| **Commandments** | C15 (Granular AST Tools): If modifying orchestrator. C9 (Process Boundary): If crossing electron/renderer |
| **Performance** | Parallel agents: 2-4x faster than sequential |

### Step 9.5: Per-Agent Commits

| Field | Detail |
|-------|--------|
| **User Action** | None (automatic via bridge-git-guru) |
| **System Action** | After each agent completes: (1) `bridge-git-guru` runs pre-commit gate (TSC + relevant test suites). (2) Stages agent's files specifically. (3) Commits: `feat(<scope>): implement <what> per contract`. |
| **On-ramps** | Step 9.4 (agent completes its work) |
| **Off-ramps** | Step 9.6 (all agents done → validation) |
| **State Changes** | Git: one commit per agent |
| **IPC Calls** | None |
| **File Effects** | Git commits |
| **Test Coverage** | Pre-commit gate validates: TSC 0 errors, relevant tests pass |
| **Error States** | TSC fails → agent must fix before commit. Tests fail → agent must fix |
| **Commandments** | None directly |
| **Performance** | Pre-commit gate: < 30s per agent |

### Step 9.6: Integration Validation (Phase 3)

| Field | Detail |
|-------|--------|
| **User Action** | Reviews validation report |
| **System Action** | `bridge-integration-validator` runs 8 checks: (1) Full type check. (2) IPC symmetry. (3) Store isolation. (4) Contract fidelity. (5) Commandment compliance. (6) Test coverage. (7) Process boundary. (8) Import hygiene. Produces report at `.bridge-context/contracts/<name>-validation.md`. |
| **On-ramps** | Step 9.5 (all agents committed) |
| **Off-ramps** | SHIP → Step 9.7 (PR). FIX → re-run affected agents → Step 9.6 again. REDESIGN → Step 9.2 |
| **State Changes** | Validation report created |
| **IPC Calls** | None (analysis phase) |
| **File Effects** | WRITE: validation report. READ: all modified source files |
| **Test Coverage** | All 25 integration tests run as part of validation |
| **Error States** | Type check fails → FIX verdict. IPC asymmetry → FIX. Store contamination → FIX or REDESIGN. Contract deviation → FIX or REDESIGN |
| **Commandments** | All 16 checked against actual code |
| **Performance** | Full validation: < 2 min |

### Step 9.7: PR Creation

| Field | Detail |
|-------|--------|
| **User Action** | Approves PR content |
| **System Action** | `bridge-git-guru`: (1) Runs full pre-commit gate (TSC + ALL test suites). (2) Pushes branch. (3) Creates PR via `gh pr create` with body from contract + validation report. (4) Returns PR URL. |
| **On-ramps** | Step 9.6 (SHIP verdict) |
| **Off-ramps** | PR review → merge → Step 9.8 (cleanup) |
| **State Changes** | Git: branch pushed, PR created on GitHub |
| **IPC Calls** | None |
| **File Effects** | None locally |
| **Test Coverage** | Full suite runs as final gate |
| **Error States** | Tests fail → cannot create PR until fixed. Push fails → check remote permissions |
| **Commandments** | None directly |
| **Performance** | Push + PR create: < 30s |

### Step 9.8: Post-Merge Cleanup

| Field | Detail |
|-------|--------|
| **User Action** | Merges PR (or approves merge) |
| **System Action** | `bridge-git-guru`: (1) `git checkout main`. (2) `git pull origin main`. (3) `git branch -d <feature-branch>`. (4) `git push origin --delete <feature-branch>`. |
| **On-ramps** | Step 9.7 (PR merged) |
| **Off-ramps** | Ready for next feature |
| **State Changes** | Git: feature branch deleted locally and remotely |
| **IPC Calls** | None |
| **File Effects** | `.git/` refs cleaned up |
| **Test Coverage** | N/A |
| **Error States** | Branch already deleted → no-op |
| **Commandments** | None |
| **Performance** | < 10s |

---

## Test Coverage Matrix

Maps every journey step to its test validation. Empty cells = no direct test coverage (acceptable per TestStrategy-Plan: "test the promises, not the plumbing").

### Safety Promise Tests (1-10)

| Test | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 | J9 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| #1 Hardcoded color → blocked | | | 3.1 | 4.2 | | | 7.2 | | |
| #2 Missing alt → blocked | | | 3.1 | 4.2 | | | 7.2 | | |
| #3 Clean code → allowed | | | 3.1 | 4.3 | | | 7.4 | | |
| #4 Override → logged | | | | 4.3 | | | | | |
| #5 bridge_audit → correct results | | | | | | | 7.2 | | |
| #6 bridge_fix → re-audit passes | | | 3.3 | | | | 7.3 | | |
| #7 bridge_debt_report → score | | | | | | | 7.5 | | |
| #8 bridge_accessibility_report | | | 3.1 | 4.2 | | | 7.2 | | |
| #9 bridge_audit_report → provenance | | | | | | | 7.2 | | |
| #10 CIEDE2000 reference values | | | 3.1 | | | | | 8.2 | |

### Data Integrity Tests (11-18)

| Test | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 | J9 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| #11 applyMutationBatch → valid + IDs | | 2.5 | 3.3 | | 5.4 | | | | |
| #12 Inverse → original restored | | | 3.3 | | 5.3 | 6.3 | | | |
| #13 FileTransactionManager atomic | | | 3.3 | 4.5 | 5.4 | | 7.3 | | |
| #14 GitManager.shadowCommit | | 2.7 | | | 5.4 | 6.4 | | | |
| #15 GovernanceEventService round-trip | | | | | | | 7.2 | | |
| #16 MutationLedgerService round-trip | | | | | | | 7.3 | | |
| #17 Token change → re-audit detects | | | 3.1 | | | | | 8.2 | |
| #18 injectBridgeIds → unique IDs | | 2.5 | | | | | | 8.3 | |

### Boundary Contract Tests (19-25)

| Test | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 | J9 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| #19 Override IPC → DB | | | | 4.3 | | | | | |
| #20 Compliance summary IPC | | | | 4.2 | | | | | |
| #21 context.json → MCP readable | 1.2 | | | | | | | | |
| #22 annotations.json → Glass | | | | | | | | | |
| #23 bridge://dashboard → data | | | | | | | 7.5 | | |
| #24 bridge://violations → audit | | | 3.1 | | | | 7.2 | | |
| #25 bridge://capabilities → tools | | | | | | | 7.1 | | |

### Coverage Summary

| Journey | Tests Covering | Gaps |
|---------|:-------------:|------|
| J1 First Launch | 1 (#21) | App mount sequence not integration-tested |
| J2 Open Project | 3 (#11, #14, #18) | Project validation, store hydration |
| J3 Governance Audit | 7 (#1, #2, #3, #6, #10, #11, #12) | Multi-surface display rendering |
| J4 Export Gate | 6 (#1, #2, #3, #4, #13, #19, #20) | Full workspace batch audit |
| J5 Canvas Interaction | 4 (#11, #12, #13, #14) | Node selection, properties panel |
| J6 Recovery / Undo | 2 (#12, #14) | Cross-file undo, keyboard handler |
| J7 MCP Agent | 10 (#5-9, #15, #16, #23-25) | Best covered journey |
| J8 Figma Import | 3 (#10, #17, #18) | Ingestion server endpoint validation |
| J9 Developer Workflow | 25 (all, via Phase 3) | Workflow is the test orchestrator |

### Recommended Additional Tests

Based on gap analysis, these tests would close the most critical coverage holes:

| # | Test | Journey Gap | Priority |
|---|------|-------------|----------|
| 26 | Project open → canvasStore hydrates → first file parsed | J2 store hydration | HIGH |
| 27 | ExportModal → full workspace audit → correct aggregate counts | J4 batch audit | HIGH |
| 28 | Cmd+Z → recoveryController → inverse applied → code reverted | J6 keyboard undo | HIGH |
| 29 | Cross-file undo → both files reverted → history stacks correct | J6 cross-file | MEDIUM |
| 30 | Node click → activeSelection → PropertiesPanel reflects node | J5 selection | MEDIUM |
| 31 | Figma /ingest → normalizer → design-tokens.json written → tokenStore refreshes | J8 token import | MEDIUM |
| 32 | fs.watch file change → re-parse → re-lint → violations updated | J3 external edit | MEDIUM |

---

## Appendix A: State Machine Summary

All Zustand stores and their journey touchpoints:

| Store | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 |
|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| editorStore | init | code, ast, visualTree, linterWarnings | linterWarnings, applyBatch | (read) | activeSelection, applyBatch, syncCode | applyBatch (inverse) | (MCP side) | setCode |
| canvasStore | projectRoot=null | projectRoot, workspaceFiles, activeFile, violations | mithrilViolations, a11yViolations | (read) | | | | |
| historyStore | | clear() | | | past push | past pop, future push | | |
| tokenStore | | | (read for linting) | | | | | import() |
| governanceStore | | | | overrides (read) | | | | |
| notificationStore | | | | | | | | |
| orchestratorStore | | | | | | | | |
| assetStore | | | | | | | | asset added |
| annotationStore | | | | | | | | |

## Appendix B: IPC Channel Map

Every IPC channel referenced in the journeys:

| Channel | Direction | Journeys | Purpose |
|---------|-----------|----------|---------|
| `dialog:openFolder` / `dialog:selectFolder` | renderer → main | J2 | Native folder picker (open vs new) |
| `project:openPath` / `project:initialize` | renderer → main | J2 | Open existing / scaffold new project |
| `registry:upsertProject` | renderer → main | J1, J2 | Register/update project in registry |
| `file:read` | renderer → main | J2, J3, J4 | Load file contents |
| `ast:save-file` | renderer → main | J3, J5, J6 | Auto-save after mutation (atomic two-phase write) |
| `saveFileBatch` | renderer → main | J4 | Export batch write |
| `syncContext` | renderer → main | J1 (continuous) | Write `.bridge/context.json` |
| `bridge:file-changed` | main → renderer | J3 | External file edit detected |
| `bridge:tokens-updated` | main → renderer | J8 | Figma token import complete |
| `bridge:hydro-paste-auto` | main → renderer | J8 | Figma AST hydration ready |
| `bridge:figma-connected` | main → renderer | J8 | Figma sync success with token count + timestamp |
| `tokens:readAll` | renderer → main | J8 | Fetch all design tokens from SQLite |
| `bridge:asset-imported` | main → renderer | J8 | Asset stored |
| `bridge:annotations-changed` | main → renderer | J7 (side) | MCP annotation written |
| `ast:git-log` | renderer → main | J6 | Commit history for Time Machine |
| `ast:git-show` | renderer → main | J6 | File at specific commit |
| `figma:status` | renderer → main | J8 | Ingestion server health |
| `tokens:readOverrides` | renderer → main | J4 | Read component_overrides table for export gate |
| `governance:getComplianceSummary` | renderer → main | J4 | Compliance summary with authority + regulatory refs |
| `governance:record-override` | renderer → main | J4 | Override telemetry |
| `transformCode` | renderer → main | J5 | Babel transform for LivePreview srcdoc |
| `menu:open-project` | main → renderer | J2 | OS menu action |
| `menu:close-project` | main → renderer | J1 | Returns to LaunchScreen |

## Appendix C: File Effects Map

Every file read/write across all journeys:

| File | Read By | Written By | Journeys |
|------|---------|------------|----------|
| `.bridge/context.json` | MCP server | useContextSync (renderer) | J1, J5 |
| `.bridge/design-tokens.json` | MithrilLinter | normalizer.ts (Figma import) | J3, J4, J7, J8 |
| `.bridge/annotations.json` | annotationStore | MCP bridge_annotate tool | J7 |
| `.bridge/activity-log.jsonl` | ActivityFeed | MCP tools (append) | J7 |
| `.bridge/current-intent.json` | read_design_intent | ingestion-server.ts | J8 |
| `.bridge/debt-history.json` | GovernanceDashboard | bridge_debt_report | J7 |
| `bridge-registry.db` | LaunchScreen | main.ts (project register) | J1, J2 |
| `bridge.db` | various | main.ts (schema init) | J2 |
| `*.tsx` (project files) | editorStore, linters | FileTransactionManager | J2-J8 |
| `.git/` | GitManager | GitManager | J2, J5, J6 |

## Appendix D: Commandment Coverage Map

Which Commandments are enforced at which journey steps:

| # | Commandment | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 | J9 |
|---|------------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| C1 | Code is Truth | | | 3.3 | | 5.4 | 6.3 | 7.3 | 8.3 | |
| C2 | No Hallucinated Styling | | | 3.1 | | | | | 8.2 | |
| C4 | Local-First Only | 1.1 | 2.3 | | 4.2 | | | 7.5 | 8.1 | |
| C5 | A11y = Compiler Error | | | 3.1 | 4.3 | | | 7.2 | | |
| C6 | Gatekeeper Rule | | | | 4.1,4.3 | | | | | |
| C7 | ID Preservation | | 2.5 | 3.3 | | 5.1,5.4 | | | 8.3 | |
| C8 | Audit-First | | | | | | | 7.2 | | |
| C9 | CIEDE2000 | | | 3.1,3.2 | | | | | | |
| C10 | Targeted Micro-Recovery | | 2.4 | 3.3 | | | 6.2 | | | |
| C11 | Surgical Git Transplants | | | | | | 6.4 | | | |
| C12 | Atomic Queuing | | | 3.3 | 4.5 | 5.4 | | 7.3 | 8.2 | |
| C13 | Deterministic Surgery | | | 3.3 | | 5.4 | | | | |
| C14 | Bypass Prohibition | | 2.1,2.7 | | | | 6.4 | | | |
| C15 | Granular AST Tools | | | | | 5.3 | | | | 9.4 |
| C16 | In-Memory Validation | | | | | | | | | 9.6 |
