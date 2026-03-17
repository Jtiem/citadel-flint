# Bridge UX Journey Maps — Agent Context Document

**Version:** 1.0  
**Date:** 2026-03-15  
**Covers:** Bridge Glass v7.2 + Bridge MCP (13 tools, 6 resources, 3 prompts)  
**Purpose:** UX-centered journey maps with balanced system detail. Optimized for consumption by AI agents (Claude Code, Cursor, MCP-connected LLMs) during development, review, and design decision-making.  
**Companion to:** `JOURNEY-MAPS.md` (full system-level technical spec)

---

## How to Use This Document (Agent Instructions)

- **Before modifying any UI component**, find the journey(s) it appears in. Check the `Touchpoints` field to locate your component.
- **Before adding a new feature**, identify which journey phase it maps to and verify it respects the emotional arc (don't introduce friction at a relief point).
- **When debugging UX issues**, use the `Thinking` field to understand what the user expects at that moment.
- **Cross-references** use the format `→ J2.4` meaning Journey 2, Phase 4.
- **Opportunities** are validated UX improvement candidates. Reference them in PR descriptions when implementing.

### Quick Lookup: Component → Journey Phase

| Component | Journey Phases |
|-----------|---------------|
| `LaunchScreen.tsx` | J1.3, J1.4 |
| `XYCanvas.tsx` | J2.5, J5.1 |
| `LivePreview.tsx` | J2.4, J5.1, J5.4 |
| `ShieldOverlay.tsx` | J2.5, J3.1, J3.2, J5.1 |
| `GovernanceOverlay.tsx` | J3.2, J3.3 |
| `ViolationTooltip.tsx` | J3.2 |
| `StatusBar.tsx` | J3.2, J4.1 |
| `ExportModal.tsx` | J4.1, J4.2, J4.3, J4.4, J4.5 |
| `PropertiesPanel.tsx` | J5.2, J5.3 |
| `LayoutPanel.tsx` | J5.2, J5.3 |
| `RecoveryPanel.tsx` | J6.4, J6.5 |
| `LayerTree` | J2.5, J5.1 |
| `MithrilLinter.ts` | J3.1, J4.2, J7.2 |
| `A11yLinter.ts` | J3.1, J4.2, J7.2 |
| `ASTService` | J3.3, J5.4, J6.3 |
| `FileTransactionManager` | J3.3, J4.5, J5.4, J6.3 |
| `GitManager` | J2.5, J6.4, J6.5 |
| `ingestion-server.ts` | J8.1, J8.2, J8.3, J8.4 |
| `normalizer.ts` | J8.2 |
| `bridge_audit` (MCP) | J7.2, J7.4 |
| `bridge_fix` (MCP) | J7.3 |
| `bridge_debt_report` (MCP) | J7.5 |

---

## Journey 1: First Launch

**Persona:** Designer opening Bridge Glass for the first time  
**Entry point:** App icon / `npm run dev`  
**Success state:** User sees clear options to start working  
**Emotional arc:** Curious → Anxious → Curious → Confident

### J1.1 — Launch app

| Lane | Detail |
|------|--------|
| **Doing** | Double-clicks Bridge Glass or runs `npm run dev` in terminal |
| **Thinking** | "Let's see what this looks like..." |
| **Feeling** | Curious |
| **Touchpoints** | Electron window, Terminal |
| **System** | Electron `main.ts` boots → `BrowserWindow` → Vite → React mounts `<App />` |
| **IPC** | None (renderer hasn't initialized) |
| **Performance** | Window visible < 2s, React mount < 500ms |
| **Commandments** | C4 (Local-First): No external URLs loaded during boot |
| **Opportunity** | Splash / loading indicator during 2s boot window |

### J1.2 — Wait for window

| Lane | Detail |
|------|--------|
| **Doing** | Watches screen, waiting for something to appear |
| **Thinking** | "Is it loading? Did it crash?" |
| **Feeling** | Anxious |
| **Touchpoints** | Blank window (briefly) |
| **System** | `useContextSync` hook mounts, writes initial `.bridge/context.json` |
| **IPC** | `syncContext` — writes context JSON to disk |
| **Performance** | First context write < 250ms after mount |
| **Error states** | `ELECTRON_RUN_AS_NODE` set → window never appears. Vite not running → blank window |
| **Opportunity** | Skeleton screen or logo animation to fill < 2s gap |

### J1.3 — See launch screen

| Lane | Detail |
|------|--------|
| **Doing** | Scans the launch screen: New, Open, Recent, Connect Figma |
| **Thinking** | "OK, what are my options here?" |
| **Feeling** | Curious |
| **Touchpoints** | `LaunchScreen.tsx`, Recent projects list |
| **System** | `App.tsx` checks `canvasStore.projectRoot === null` → renders `<LaunchScreen />`. Reads recent projects from `bridge-registry.db` via IPC |
| **IPC** | `registry:list-projects` → returns `ProjectEntry[]` |
| **Performance** | LaunchScreen visible < 200ms after mount |
| **Error states** | Registry DB corrupt → empty recent list (graceful). No projects → empty state with prominent New/Open |
| **Opportunity** | Onboarding hint for first-timers with no recent projects |

### J1.4 — Choose next action

| Lane | Detail |
|------|--------|
| **Doing** | Clicks New Project, Open Project, a recent item, or Connect Figma |
| **Thinking** | "I want to open my existing work" or "Let me start fresh" |
| **Feeling** | Confident |
| **Touchpoints** | Button click |
| **Off-ramps** | "New Project" → J2.3, "Open Project" → J2.1, Recent item → J2.4, "Connect Figma" → J8.1 |
| **Opportunity** | Clear visual hierarchy: primary action prominent |

---

## Journey 2: Open Existing Project

**Persona:** Designer opening a project folder  
**Entry point:** LaunchScreen or File > Open  
**Success state:** Sees live preview with governance badges on canvas  
**Emotional arc:** Confident → Neutral → Uncertain → Delighted → Focused

### J2.1 — Trigger open

| Lane | Detail |
|------|--------|
| **Doing** | Clicks "Open Project" button or uses File > Open |
| **Thinking** | "I know which folder my component is in" |
| **Feeling** | Confident |
| **Touchpoints** | `LaunchScreen.tsx` button, OS menu bar |
| **System** | `window.bridgeAPI.openDirectory()` or `main.ts` receives `menu:open-project` |
| **IPC** | `dialog:open-directory` (renderer → main) |
| **Performance** | Dialog opens < 100ms |
| **Commandments** | C14 (Bypass Prohibition): File dialog goes through bridgeAPI |
| **Opportunity** | Keyboard shortcut hint (Cmd+O) |

### J2.2 — Pick folder

| Lane | Detail |
|------|--------|
| **Doing** | Navigates native OS file dialog, selects project folder |
| **Thinking** | "Where did I save that project..." |
| **Feeling** | Neutral |
| **Touchpoints** | Native OS dialog |
| **System** | `dialog.showOpenDialog({ properties: ['openDirectory'] })` |
| **Error states** | User cancels → `{ canceled: true }` → no-op, returns to LaunchScreen |
| **Opportunity** | Remember last-opened directory |

### J2.3 — Validation wait

| Lane | Detail |
|------|--------|
| **Doing** | Sees brief loading state while Bridge scans the folder |
| **Thinking** | "Hopefully it finds my files" |
| **Feeling** | Uncertain |
| **Touchpoints** | Loading indicator |
| **System** | `main.ts` validates folder: checks for `.tsx` files, reads workspace structure, registers in `bridge-registry.db` |
| **IPC** | `project:opened` → renderer with `{ projectRoot, files }` |
| **Performance** | Folder scan < 500ms for typical project (< 1000 files) |
| **Error states** | No `.tsx` files → error toast. Permission denied → error toast with path |
| **Commandments** | C4 (Local-First): All file reads are local |
| **Opportunity** | Show file count as scan progresses, not just spinner |

### J2.4 — Project loads

| Lane | Detail |
|------|--------|
| **Doing** | Watches canvas populate: live preview appears, layer tree fills, badges appear |
| **Thinking** | "Oh nice, it's already showing my component!" |
| **Feeling** | Delighted |
| **Touchpoints** | Infinite canvas (`XYCanvas.tsx`), `LivePreview.tsx`, LayerTree, `ShieldOverlay.tsx` badges |
| **System** | `canvasStore.openProject()` → `setActiveFile(files[0])` triggers Clean Slate Protocol: (1) `editorStore.clearAST()`, (2) CLEAR_PREVIEW to iframe, (3) `file:read` IPC, (4) `setCode()` → parse → buildVisualTree → lint. `historyStore.clear()` — fresh undo stack. Babel parse → `injectBridgeIds(ast)` → `MithrilLinter.lint()` + `A11yLinter.lint()` |
| **IPC** | `readFile` (renderer → main) |
| **Performance** | Store hydration < 50ms, file read < 100ms, parse < 200ms, lint < 150ms. Total < 500ms |
| **Commandments** | C7 (ID Preservation): `injectBridgeIds` on every parse. C9 (CIEDE2000): Perceptual color distance. C10: Fresh undo stack |
| **Opportunity** | Staggered animation — preview first, then badges fade in |

### J2.5 — Orient to workspace

| Lane | Detail |
|------|--------|
| **Doing** | Scans the interface: left panel (layers), center (preview), right (properties), bottom (status bar). Notices red badges. |
| **Thinking** | "Red badges... looks like I have some issues to fix" |
| **Feeling** | Focused |
| **Touchpoints** | `GovernanceOverlay.tsx`, `StatusBar.tsx` (red/green gate), `ShieldOverlay.tsx` heat tints, `LayerTree` |
| **System** | `LivePreview.tsx` builds `srcdoc` from AST code, injects into iframe. `ShieldOverlay.tsx` reads `nodeLayouts` + violations for badges. `GitManager.ensureRepo()` creates `.git/` if missing + shadow commit |
| **IPC** | `transformCode` (renderer → main). Internal git CLI for GitManager |
| **Performance** | Canvas render < 400ms. Git check < 500ms |
| **Commandments** | C1 (Code is Truth). C14 (Bypass Prohibition): All git ops through GitManager |
| **Off-ramps** | → J3 (governance audit), → J5 (canvas interaction), → J4 (export) |
| **Opportunity** | Auto-highlight the most critical violation to focus attention |

---

## Journey 3: Governance Audit Loop

**Persona:** Designer working on a component that has governance violations  
**Entry point:** Badges appear on canvas after file load or edit  
**Success state:** All violations resolved, status bar turns green  
**Emotional arc:** Anxious → Frustrated → Uncertain → Delighted → Relieved

### J3.1 — Notice violations

| Lane | Detail |
|------|--------|
| **Doing** | Sees red/amber heat tints on nodes, badges on canvas, red status bar |
| **Thinking** | "Something's wrong with my component... what do these badges mean?" |
| **Feeling** | Anxious |
| **Touchpoints** | `ShieldOverlay.tsx` badges, heat tints (red-500/10 critical, amber-500/10 amber), `StatusBar.tsx` (red) |
| **System** | Two parallel audit paths: (1) A11yLinter runs inline in `setCode()`. (2) MithrilProvider watches `ast` + `tokens`, calls `auditAll()` — 5 visitors: classNames (CIEDE2000), typography (TYP-001..005), spacing (SPC-001), shadows (SHD-001), opacity (OPC-001). Results → `editorStore.linterWarnings` + `canvasStore.mithrilViolations`/`a11yViolations` |
| **IPC** | None (linting runs in renderer) |
| **Performance** | MithrilLinter: < 80ms. A11yLinter: < 40ms. Combined: < 150ms |
| **Commandments** | C2 (No Hallucinated Styling). C5 (A11y = Compiler Error). C9 (CIEDE2000) |
| **Opportunity** | Severity summary upfront: "3 critical, 2 warnings" |

### J3.2 — Investigate issue

| Lane | Detail |
|------|--------|
| **Doing** | Hovers over a badge to see violation tooltip, checks right sidebar for details |
| **Thinking** | "Hardcoded color? I thought I was using tokens..." |
| **Feeling** | Frustrated |
| **Touchpoints** | `ViolationTooltip.tsx`, `GovernanceOverlay.tsx` sidebar (rule IDs, severity, descriptions, Auto-Fix buttons), `ShieldOverlay.tsx` |
| **System** | Four surfaces read from `editorStore.linterWarnings`: GovernanceOverlay (sidebar list), ShieldOverlay (canvas heat tints, 50-badge cap, viewport culled), ViolationTooltip (hover popover), StatusBar (gate indicator) |
| **Performance** | GovernanceOverlay: < 50ms. ShieldOverlay (50 badges): < 30ms. StatusBar: < 10ms |
| **Error states** | `nodeLayouts` empty → badges won't position (iframe hasn't reported). > 50 violations → badge cap, sorted by severity |
| **Opportunity** | Show exact token suggestion inline, not just the rule name |

### J3.3 — Decide: auto-fix or manual

| Lane | Detail |
|------|--------|
| **Doing** | Sees "Auto-Fix" button next to fixable violations, weighs options |
| **Thinking** | "One-click fix? Convenient. But will it break something?" |
| **Feeling** | Uncertain |
| **Touchpoints** | Auto-Fix button in `GovernanceOverlay.tsx`, manual fix path (switch to host IDE) |
| **Opportunity** | Preview diff before applying fix |

### J3.4 — Apply auto-fix

| Lane | Detail |
|------|--------|
| **Doing** | Clicks Auto-Fix — watches badge count drop, preview updates instantly |
| **Thinking** | "Wow, that was fast. Badge is gone. Let me fix the next one." |
| **Feeling** | Delighted |
| **Touchpoints** | Preview re-renders, badge disappears, re-lint runs |
| **System** | `editorStore.applyBatch([{ type: 'fixToken', nodeId, ruleId, tokenValue }])` → `ASTService.applyMutationBatch` → Babel traverse → find by `data-bridge-id` → replace hardcoded value → generate inverse → `injectBridgeIds(ast)` → re-lint. Auto-save: `FileTransactionManager` atomic `.tmp` → `rename`. Shadow git commit |
| **IPC** | `saveFile` (renderer → main) via auto-save |
| **Performance** | Mutation: < 50ms. File write: < 100ms. Re-lint: < 150ms. Total: < 350ms |
| **Error states** | Target node deleted → no-op (C10 pre-flight). Token missing → fix fails, error toast. Disk write fails → retry |
| **Commandments** | C1 (Code is Truth). C7 (ID Preservation). C10 (Targeted Micro-Recovery). C12 (Atomic Queuing). C13 (Deterministic Surgery) |
| **Opportunity** | Celebration micro-animation when violations hit zero |

### J3.4-alt — Manual fix via host IDE

| Lane | Detail |
|------|--------|
| **Doing** | Edits the component file in Claude Code / Cursor / VS Code |
| **Thinking** | "I'll fix this myself in my editor" |
| **Feeling** | Focused |
| **Touchpoints** | External code editor |
| **System** | `fs.watch` in main process detects change → fires `bridge:file-changed` IPC → renderer reloads file → `editorStore.setCode(newContents)` → re-parse → re-lint (loops back to J3.1) |
| **IPC** | `bridge:file-changed` (main → renderer). `readFile` (renderer → main) |
| **Performance** | fs.watch notification: < 100ms. Reload + re-lint: < 500ms |
| **Error states** | `fs.watch` misses change → 3s poll fallback. File deleted → LaunchScreen |

### J3.5 — Verify: gate turns green

| Lane | Detail |
|------|--------|
| **Doing** | Checks status bar — sees green indicator. Scans canvas — no more red/amber tints |
| **Thinking** | "All clear! Ready to export." |
| **Feeling** | Relieved |
| **Touchpoints** | `StatusBar.tsx` (green), clean `ShieldOverlay.tsx`, empty `GovernanceOverlay.tsx` |
| **Off-ramps** | → J4 (export gate), → J5 (continue canvas editing) |
| **Opportunity** | Proactive nudge: "Ready to export" toast when gate clears |

---

## Journey 4: Export Gate

**Persona:** Designer ready to ship code  
**Entry point:** Clicks export in status bar  
**Success state:** Clean code exported to disk  
**Emotional arc:** Confident → Anxious → Anxious → Focused → Relieved

### J4.1 — Trigger export

| Lane | Detail |
|------|--------|
| **Doing** | Clicks the export button in the status bar |
| **Thinking** | "Time to hand this off to the dev team" |
| **Feeling** | Confident |
| **Touchpoints** | Export button in `StatusBar.tsx`, `ExportModal.tsx` opens |
| **System** | `StatusBar.tsx` dispatches `CustomEvent('bridge:open-export')`. `ExportModal.tsx` mounts, fetches `readOverrides()` + `getComplianceSummary(ruleIds)` in parallel |
| **IPC** | `tokens:readOverrides`, `governance:getComplianceSummary` |
| **Performance** | Modal open: < 50ms |
| **Commandments** | C6 (Gatekeeper Rule): Export gate is the enforcement point |
| **Opportunity** | Export shortcut (Cmd+E) and menu item |

### J4.2 — Full audit runs

| Lane | Detail |
|------|--------|
| **Doing** | Watches "Auditing..." spinner as Bridge checks every file in the workspace |
| **Thinking** | "Checking all files, not just the one I was looking at..." |
| **Feeling** | Anxious |
| **Touchpoints** | `ExportModal.tsx` audit spinner, per-file progress |
| **System** | For each workspace file: read → parse AST → MithrilLinter + A11yLinter. Aggregate all violations. Check `governanceStore` for active overrides |
| **IPC** | `readFile` for each workspace file (batch) |
| **Performance** | 10 files: < 2s. 50 files: < 8s. Progress updates per file |
| **Error states** | File read fails → skip file, warn. Linter crash → fail-closed (export blocked with "audit error") |
| **Commandments** | C5 (A11y = Compiler Error). C6 (Gatekeeper Rule) |
| **Opportunity** | Show live file count: "Auditing 7 of 12 files..." |

### J4.3 — Gate verdict

| Lane | Detail |
|------|--------|
| **Doing** | Sees either BLOCKED (red) or CLEAR (green) result |
| **Thinking** | "Please be green, please be green..." or "Yes! All clear!" |
| **Feeling** | Anxious |
| **Touchpoints** | Gate status badge, violation breakdown (if blocked), compliance summary (GOV.1) |
| **System** | `canExport = overrideRows.length === 0 && mithrilViolations.length === 0 && a11yViolations.length === 0`. Severity escalation: critical (ΔE > 10) → red, amber (2.0-10.0) → amber |
| **Performance** | Gate evaluation: < 10ms |
| **Commandments** | C5 (A11y). C6 (Gatekeeper) |
| **Opportunity** | If blocked, auto-sort by easiest-to-fix-first |

### J4.4 — Fix or export

| Lane | Detail |
|------|--------|
| **Doing** | If blocked: reviews violation list, clicks Fix buttons. If clear: clicks Export confirm |
| **Thinking** | "Just 2 more violations... almost there" or "Ship it!" |
| **Feeling** | Focused |
| **Touchpoints** | Violation cards with Fix buttons, Export confirm button |
| **Off-ramps (blocked)** | Fix → J3.4 (auto-fix loop). Close modal → return to canvas |
| **Opportunity** | "Fix all auto-fixable" batch button for blocked state |

### J4.5 — Export completes

| Lane | Detail |
|------|--------|
| **Doing** | Sees success toast, files written to disk |
| **Thinking** | "Done. Files are ready for the team." |
| **Feeling** | Relieved |
| **Touchpoints** | Success toast, file system (exported files) |
| **System** | `FileTransactionManager` atomic writes to export directory. Each file: `.tmp` → `rename` |
| **IPC** | `saveFileBatch` (renderer → main) |
| **Performance** | Export 10 files: < 1s |
| **Commandments** | C12 (Atomic Queuing) |
| **Opportunity** | Show output path, option to open in Finder/Explorer |

---

## Journey 5: Canvas Interaction

**Persona:** Designer editing a component visually  
**Entry point:** Clicks on live preview  
**Success state:** Property changed, preview updated, undo available  
**Emotional arc:** Focused → Confident → Focused → Delighted → Confident

### J5.1 — Select element

| Lane | Detail |
|------|--------|
| **Doing** | Clicks a visual element in the live preview on the canvas |
| **Thinking** | "I want to change the padding on this card" |
| **Feeling** | Focused |
| **Touchpoints** | `LivePreview.tsx` iframe, `ShieldOverlay.tsx` selection outline, LayerTree highlight |
| **System** | In `design` mode: iframe bridge-init script listens for clicks on `data-bridge-id` elements. Posts `{ type: 'CANVAS_CLICK', id: bridgeId }`. `ShieldOverlay.tsx` validates source, checks presence lock via `lockedNodeIdsRef`, calls `setSelectedNode(id)` + `setActiveSelection(id)` |
| **IPC** | None (postMessage, not Electron IPC) |
| **Performance** | Click → selection state: < 30ms |
| **Error states** | Non-element click → selection cleared. `interact` mode → clicks pass through to iframe |
| **Commandments** | C7 (ID Preservation): Selection keys on `data-bridge-id` |
| **Opportunity** | Multi-select (shift+click) for batch property changes |

### J5.2 — Inspect properties

| Lane | Detail |
|------|--------|
| **Doing** | Looks at right sidebar — sees element type, classes, props, layout, annotations |
| **Thinking** | "OK, it's a div with className 'card'. Let me tweak the spacing." |
| **Feeling** | Confident |
| **Touchpoints** | `PropertiesPanel.tsx`, `LayoutPanel.tsx`, AnnotationList |
| **System** | PropertiesPanel reads `editorStore.activeSelection` → finds AST node → displays element type, className, text content, props, layout properties, annotations, violations |
| **Performance** | Panel update: < 50ms |
| **Error states** | Node deleted between selection and render → "Node not found" |
| **Opportunity** | Show computed CSS values alongside editable props |

### J5.3 — Edit a value

| Lane | Detail |
|------|--------|
| **Doing** | Changes a className, text, or prop value in the properties panel |
| **Thinking** | "Let me swap this to 'p-6' instead of 'p-4'" |
| **Feeling** | Focused |
| **Touchpoints** | Input field in `PropertiesPanel.tsx` or `LayoutPanel.tsx` |
| **System** | Panel constructs mutation: `{ type: 'updateClassName', nodeId, value }`. Calls `editorStore.applyBatch([mutation])` |
| **Performance** | Input → mutation construction: < 10ms |
| **Commandments** | C15 (Granular AST Tools): Only versioned catalog ops |
| **Opportunity** | Token autocomplete when typing class names |

### J5.4 — See instant update

| Lane | Detail |
|------|--------|
| **Doing** | Watches the live preview re-render immediately |
| **Thinking** | "That's exactly what I wanted. Or wait... let me undo and try something else." |
| **Feeling** | Delighted |
| **Touchpoints** | `LivePreview.tsx` re-render, governance re-lint, auto-save indicator |
| **System** | Full mutation pipeline: (1) Babel traverse by `data-bridge-id`, (2) apply mutation, (3) generate inverse → push to `historyStore.past`, (4) `injectBridgeIds(ast)`, (5) `syncCode()` → code from AST, (6) LivePreview re-renders srcdoc, (7) MithrilLinter + A11yLinter re-run, (8) auto-save via `FileTransactionManager`, (9) `GitManager.shadowCommit()` |
| **IPC** | `saveFile` (renderer → main) — auto-save with debounce |
| **Performance** | Mutation + code gen: < 80ms. Preview: < 200ms. Auto-save: < 100ms. Total: < 300ms |
| **Commandments** | C1, C7, C10, C12, C13 |
| **Off-ramps** | Continue editing → J5.1. Undo → J6.1 |
| **Opportunity** | Side-by-side before/after comparison mode |

---

## Journey 6: Recovery / Undo

**Persona:** Designer who made a mistake  
**Entry point:** Cmd+Z or Recovery panel  
**Success state:** Code reverted to desired state, undo stack correct  
**Emotional arc:** Frustrated → Anxious → Relieved → Focused → Delighted

### J6.1 — Realize mistake

| Lane | Detail |
|------|--------|
| **Doing** | Sees a change in the preview they don't like, or realizes they broke something |
| **Thinking** | "Wait, that's not right. I need to go back." |
| **Feeling** | Frustrated |
| **Touchpoints** | `LivePreview.tsx` (wrong output), broken layout or styling |
| **Opportunity** | Visual diff highlighting — show what changed |

### J6.2 — Hit undo

| Lane | Detail |
|------|--------|
| **Doing** | Presses Cmd+Z instinctively |
| **Thinking** | "Please undo the last thing, not something random" |
| **Feeling** | Anxious |
| **Touchpoints** | Keyboard shortcut, `App.tsx` keydown handler |
| **System** | `App.tsx` checks: no focused input/textarea. Calls `recoveryController.undo()` → `historyStore.popUndo()` → pre-flight node existence check. Branch: cross-file → `applyCrossFileUndo(group)` with `saveFileBatch()` atomically. Single-file → `applySingleFileUndo(entry)` with `applyInversions()` |
| **Performance** | Keydown → handler: < 5ms. Stack check + pre-flight: < 10ms |
| **Error states** | Empty history → "Nothing to undo" toast. Focus guard fail → undo fires in wrong context |
| **Commandments** | C10 (Targeted Micro-Recovery): Pre-flight node check |
| **Opportunity** | Toast showing what was undone: "Reverted className change on Card" |

### J6.3 — See revert

| Lane | Detail |
|------|--------|
| **Doing** | Preview snaps back to previous state instantly |
| **Thinking** | "OK good, it's back to normal. I can breathe." |
| **Feeling** | Relieved |
| **Touchpoints** | `LivePreview.tsx` (restored), history stack updated |
| **System** | `editorStore.applyBatch([inverseMutation])` → AST reverted → code regenerated → preview updates. Forward mutation → `historyStore.future` (redo). Auto-save fires |
| **IPC** | `saveFile` (auto-save) |
| **Performance** | Apply inverse: < 80ms. Total undo cycle: < 300ms |
| **Commandments** | C1 (Code is Truth). C12 (Atomic Queuing) |
| **Opportunity** | Subtle flash/highlight on the reverted element |

### J6.4 — Browse history (optional: Git Time Machine)

| Lane | Detail |
|------|--------|
| **Doing** | Opens Recovery Panel to browse git commit history |
| **Thinking** | "I need that specific version of this button from 3 edits ago" |
| **Feeling** | Focused |
| **Touchpoints** | `RecoveryPanel.tsx`, commit timeline |
| **System** | `window.bridgeAPI.gitLog(filePath)` → `git log --pretty=format:%H|%s|%at` → returns `[{ hash, message, timestamp }]` |
| **IPC** | `ast:git-log` (renderer → main) |
| **Performance** | Git log: < 500ms |
| **Opportunity** | Visual commit timeline with preview thumbnails |

### J6.5 — Surgical transplant

| Lane | Detail |
|------|--------|
| **Doing** | Selects a specific commit + node. Bridge transplants just that node into the current AST |
| **Thinking** | "It only changed the button, not the whole file? That's incredible." |
| **Feeling** | Delighted |
| **Touchpoints** | Node picker, transplant confirmation, preview updates |
| **System** | `editorStore.revertNodeToCommit(nodeId, hash)`: (1) `gitShow(filePath, hash)` → historic source, (2) parse both ASTs, (3) `transplantNode(freshAST, historicAST, nodeId)` → Babel deep clone, (4) generate new code, (5) reparse + set state + auto-save. Transplant is undoable (inversions pushed to `historyStore`) |
| **IPC** | `ast:git-show` (renderer → main). `saveFile` (auto-save) |
| **Performance** | Git show: < 200ms. Transplant: < 100ms |
| **Commandments** | C11 (Surgical Git Transplants): Never `git checkout`. C14 (Bypass Prohibition): Through GitManager |
| **Opportunity** | Before/after comparison of transplanted node |

---

## Journey 7: MCP Agent Workflow

**Persona:** AI agent (Claude Code, Cursor) connecting via MCP  
**Entry point:** MCP stdio connection  
**Success state:** Agent verifies compliance and reports project health score  
**Emotional arc:** Neutral → Focused → Confident → Relieved → Confident

### J7.1 — Connect to Bridge

| Lane | Detail |
|------|--------|
| **Doing** | AI agent establishes MCP stdio connection, calls `bridge_status` |
| **Thinking** | [Agent: Check project health before making changes] |
| **Feeling** | Neutral |
| **Touchpoints** | MCP stdio transport, `bridge_status` response `{ ok, projectRoot, version, toolCount, resourceCount }` |
| **Performance** | Server start: < 1s. Status call: < 50ms |
| **Error states** | Server not installed → MCP client error. Invalid root → `{ ok: false, error }` |
| **Opportunity** | Auto-connect on Claude Code session start |

### J7.2 — Run audit

| Lane | Detail |
|------|--------|
| **Doing** | Calls `bridge_audit({ filePath })` — receives SARIF violations report |
| **Thinking** | [Agent: 4 violations found — 2 color, 1 a11y, 1 spacing] |
| **Feeling** | Focused |
| **Touchpoints** | `bridge_audit` MCP tool, SARIF 2.1.0 response, `governance_events` table |
| **System** | `tools/audit.ts`: read file → parse AST → `MithrilLinter.lint(ast, tokens)` + `A11yLinter.lint(ast)` → SARIF format → record in `governance_events` |
| **Performance** | Single file audit: < 500ms |
| **Commandments** | C8 (Audit-First). C9 (CIEDE2000) |
| **Opportunity** | Batch audit: audit all files in one call |

### J7.3 — Auto-fix violations

| Lane | Detail |
|------|--------|
| **Doing** | Calls `bridge_fix({ filePath, ruleId })` for each fixable violation |
| **Thinking** | [Agent: Replacing hardcoded #ff0000 with token color.danger.500] |
| **Feeling** | Confident |
| **Touchpoints** | `bridge_fix` MCP tool, atomic file write, `mutations_ledger` table |
| **System** | `tools/fix.ts`: read → parse → locate by ruleId + nodeId → deterministic fix → generate code → atomic write → record in `mutations_ledger` |
| **Performance** | Fix single violation: < 300ms |
| **Error states** | Not auto-fixable → `{ fixed: false, reason: 'manual fix required' }`. Node gone → `{ fixed: false }` |
| **Commandments** | C1 (Code is Truth). C12 (Atomic Queuing). C13 (Deterministic Surgery) |
| **Opportunity** | Fix-all batch command to reduce round trips |

### J7.4 — Verify fixes

| Lane | Detail |
|------|--------|
| **Doing** | Re-runs `bridge_audit` to confirm violations are resolved |
| **Thinking** | [Agent: Re-audit passed — 0 violations remaining] |
| **Feeling** | Relieved |
| **Touchpoints** | `bridge_audit` (verification pass), clean SARIF |
| **Performance** | < 500ms |
| **Commandments** | C8 (Audit-First): Verify after every mutation |
| **Opportunity** | Auto-verify: have `bridge_fix` return post-fix audit result |

### J7.5 — Report health

| Lane | Detail |
|------|--------|
| **Doing** | Calls `bridge_debt_report({ track: true })` for project score and trends |
| **Thinking** | [Agent: Score 87/100, Grade B+, trending up] |
| **Feeling** | Confident |
| **Touchpoints** | `bridge_debt_report` MCP tool, debt history tracking, `bridge://dashboard` resource |
| **System** | Scans all workspace files → health score (0-100), grade (A-F), top violated rules + files. If `track: true` → appends to `.bridge/debt-history.json`. If Glass is open → dashboard updates via `fs.watch` |
| **Performance** | Full project scan: < 5s for 50 files |
| **Commandments** | C4 (Local-First) |
| **Opportunity** | Slack/GitHub integration for automated health reports |

---

## Journey 8: Figma Import

**Persona:** Designer syncing designs from Figma  
**Entry point:** Figma plugin "Send to Bridge"  
**Success state:** Figma tokens and components live in Bridge, linter has tokens for comparison  
**Emotional arc:** Confident → Anxious → Delighted → Delighted → Confident

### J8.1 — Send from Figma

| Lane | Detail |
|------|--------|
| **Doing** | In Figma, clicks "Send to Bridge" plugin button |
| **Thinking** | "Let me push my latest design tokens and this component over" |
| **Feeling** | Confident |
| **Touchpoints** | Figma plugin UI, HTTP POST to `localhost:4545` with `x-bridge-secret` |
| **System** | Three endpoints: `/ingest` (design variables), `/ingest-ast` (component AST), `/ingest-asset` (images) |
| **Performance** | Request received: < 50ms |
| **Error states** | Wrong/missing `x-bridge-secret` → 401. Server not running → connection refused. Malformed payload → 400 |
| **Commandments** | C4 (Local-First): Loopback HTTP only |
| **Opportunity** | Bulk export: send all changed frames at once |

### J8.2 — Wait for sync

| Lane | Detail |
|------|--------|
| **Doing** | Switches to Bridge Glass, watches for confirmation |
| **Thinking** | "Did it go through? Is Bridge connected?" |
| **Feeling** | Anxious |
| **Touchpoints** | Figma plugin status, Bridge `StatusBar.tsx` (Figma dot) |
| **Opportunity** | Real-time sync indicator: pulsing dot during transfer |

### J8.3 — Tokens arrive

| Lane | Detail |
|------|--------|
| **Doing** | Sees StatusBar Figma dot turn emerald green. Token count updates |
| **Thinking** | "142 tokens synced. My colors and typography are up to date." |
| **Feeling** | Delighted |
| **Touchpoints** | StatusBar Figma indicator, token count, `bridge:tokens-updated` IPC |
| **System** | `normalizeFigmaVariables(payload)` → Figma Variables to W3C DTCG rows → `batchUpsertTokens()` atomic SQLite transaction → fires `bridge:tokens-updated` + `bridge:figma-connected` with `{ tokenCount, timestamp }`. `tokenStore.fetchTokens()` refreshes in renderer |
| **IPC** | `bridge:tokens-updated` (main → renderer). `bridge:figma-connected` (main → renderer) |
| **Performance** | Normalization + write: < 500ms for 200 tokens |
| **Commandments** | C2 (No Hallucinated Styling). C12 (Atomic Queuing) |
| **Opportunity** | Toast showing what changed: "12 new tokens, 3 updated" |

### J8.4 — Component hydrates

| Lane | Detail |
|------|--------|
| **Doing** | If AST was sent: sees new component appear on canvas with Bridge IDs injected |
| **Thinking** | "My Figma design is now real React code? Let me check it." |
| **Feeling** | Delighted |
| **Touchpoints** | `LivePreview.tsx` (new component), LayerTree updates, AST hydration |
| **System** | Validates against `BridgeSDIPayload` schema → writes `.bridge/current-intent.json` → fires `bridge:hydro-paste-auto` → `hydrate_figma_data` converts Figma AST → React JSX → `editorStore.setCode(hydrated)` |
| **IPC** | `bridge:hydro-paste-auto` (main → renderer). `saveFile` (auto-save) |
| **Performance** | Hydration: < 1s. Total Figma click to canvas: < 3s |
| **Commandments** | C1 (Code is Truth). C4 (Local-First). C7 (ID Preservation) |
| **Opportunity** | Side-by-side: Figma source vs hydrated React output |

### J8.5 — Governance kicks in

| Lane | Detail |
|------|--------|
| **Doing** | MithrilLinter now has tokens — re-audits everything automatically |
| **Thinking** | "Now I can see if my code matches my design system." |
| **Feeling** | Confident |
| **Touchpoints** | MithrilLinter re-runs, `ShieldOverlay.tsx` updates, `GovernanceOverlay.tsx` |
| **Off-ramps** | → J3 (governance audit with real tokens), → J5 (canvas editing) |
| **Opportunity** | Highlight which violations are new since last Figma sync |

---

## Journey 9: Developer Workflow (Contract-First)

**Persona:** Developer or AI swarm building a new Bridge feature  
**Entry point:** Feature request  
**Success state:** Feature implemented, tested, PR merged  
**Emotional arc:** Focused → Confident → Anxious → Relieved

### J9.1 — Branch + plan

| Lane | Detail |
|------|--------|
| **Doing** | Creates feature branch. `bridge-architect` reads source, writes TypeScript contracts |
| **Thinking** | "What interfaces do I need? Where are the process boundaries?" |
| **Feeling** | Focused |
| **Touchpoints** | Git branch, contract artifact (`.bridge-context/contracts/<n>.md`), source file analysis |
| **System** | `bridge-git-guru` creates branch. `bridge-architect` reads affected sources → identifies ownership (process, store, component) → writes interfaces, IPC channels, store shapes, component props → checks commandments → writes contract |
| **Performance** | Simple: 5-10 min. Complex: 30+ min |
| **Opportunity** | Auto-generate contract template from feature description |

### J9.2 — Parallel build

| Lane | Detail |
|------|--------|
| **Doing** | Specialist agents implement in parallel: IPC, stores, UI, tests — each following the contract |
| **Thinking** | "Group A builds the plumbing, Group B builds the UI on top" |
| **Feeling** | Confident |
| **Touchpoints** | Per-agent source files, `npx tsc --noEmit` gate per agent |
| **System** | Group A (parallel): `bridge-electron-ipc` (IPC + preload), `bridge-state-architect` (stores). Group B (after A): `bridge-design-engineer` (UI), `bridge-test-writer` (tests). Each reads contract → implements exact interfaces → runs TSC |
| **Error states** | Contract gap → STOP, return to J9.1 for revision. Type error → fix before proceeding |
| **Commandments** | C15 (Granular AST Tools) if modifying orchestrator |
| **Opportunity** | Progress dashboard showing each agent's status |

### J9.3 — Integration check

| Lane | Detail |
|------|--------|
| **Doing** | `bridge-integration-validator` runs 8 checks |
| **Thinking** | "Moment of truth — does it all fit together?" |
| **Feeling** | Anxious |
| **Touchpoints** | Validation report, 8-check checklist, SHIP/FIX/REDESIGN verdict |
| **System** | 8 checks: (1) Full type check (`tsc --noEmit`), (2) IPC symmetry (main ↔ preload ↔ renderer), (3) Store isolation, (4) Contract fidelity, (5) Commandment compliance, (6) Test coverage, (7) Process boundary (no `fs` in `src/`), (8) Import hygiene. All 25 integration tests run |
| **Performance** | Full validation: < 2 min |
| **Off-ramps** | SHIP → J9.4. FIX → re-run agents. REDESIGN → J9.1 |
| **Opportunity** | Incremental validation: check after each agent, not just at end |

### J9.4 — PR + ship

| Lane | Detail |
|------|--------|
| **Doing** | Full test suite passes. PR created with contract + validation report |
| **Thinking** | "Green across the board. Ready for review." |
| **Feeling** | Relieved |
| **Touchpoints** | GitHub PR, test suite results, contract traceability |
| **System** | `bridge-git-guru`: full pre-commit gate (TSC + ALL suites) → push → `gh pr create` with body from contract + validation report → post-merge cleanup (checkout main, delete branch) |
| **Performance** | Push + PR: < 30s |
| **Opportunity** | Auto-link PR to journey map steps affected |

---

## Appendix A: Emotional Patterns Across Journeys

| Journey | Low Point | Emotion | UX Lever |
|---------|-----------|---------|----------|
| J1 First Launch | J1.2 Wait for window | Anxious | Loading indicator / skeleton |
| J2 Open Project | J2.3 Validation wait | Uncertain | Progressive file count |
| J3 Governance Audit | J3.2 Investigate issue | Frustrated | Inline token suggestions |
| J4 Export Gate | J4.2-J4.3 Full audit + verdict | Anxious | Live progress + sort-by-fixability |
| J5 Canvas Interaction | (None — flow state) | — | Maintain flow, don't interrupt |
| J6 Recovery / Undo | J6.1-J6.2 Mistake + undo | Frustrated → Anxious | Clear undo feedback |
| J7 MCP Agent | (None — deterministic) | — | Reduce round trips |
| J8 Figma Import | J8.2 Wait for sync | Anxious | Real-time sync indicator |
| J9 Developer | J9.3 Integration check | Anxious | Incremental validation |

## Appendix B: Consolidated Opportunity Backlog

| ID | Journey | Opportunity | Impact |
|----|---------|-------------|--------|
| OPP-01 | J1.2 | Skeleton screen during 2s boot | First impression |
| OPP-02 | J1.3 | Onboarding hint for first-timers | Activation |
| OPP-03 | J2.3 | Progressive file count during scan | Reduce uncertainty |
| OPP-04 | J2.4 | Staggered animation for preview + badges | Delight |
| OPP-05 | J2.5 | Auto-highlight most critical violation | Focus attention |
| OPP-06 | J3.1 | Severity summary upfront | Reduce anxiety |
| OPP-07 | J3.2 | Inline token suggestion, not just rule name | Reduce frustration |
| OPP-08 | J3.3 | Preview diff before applying fix | Build trust |
| OPP-09 | J3.4 | Celebration animation at zero violations | Reward loop |
| OPP-10 | J3.5 | "Ready to export" toast when gate clears | Proactive nudge |
| OPP-11 | J4.2 | Live file count: "Auditing 7 of 12..." | Reduce anxiety |
| OPP-12 | J4.3 | Sort blocked violations by easiest-first | Reduce overwhelm |
| OPP-13 | J4.4 | "Fix all auto-fixable" batch button | Reduce friction |
| OPP-14 | J5.1 | Multi-select (shift+click) | Power users |
| OPP-15 | J5.3 | Token autocomplete for class names | Speed |
| OPP-16 | J5.4 | Before/after comparison mode | Confidence |
| OPP-17 | J6.2 | Toast showing what was undone | Clarity |
| OPP-18 | J6.4 | Visual commit timeline with thumbnails | Discovery |
| OPP-19 | J6.5 | Before/after for transplanted node | Confidence |
| OPP-20 | J7.2 | Batch audit all files in one call | Efficiency |
| OPP-21 | J7.3 | Fix-all batch command | Reduce round trips |
| OPP-22 | J7.4 | Auto-verify: fix returns post-fix audit | Efficiency |
| OPP-23 | J8.2 | Real-time sync pulsing indicator | Reduce anxiety |
| OPP-24 | J8.3 | Toast: "12 new tokens, 3 updated" | Clarity |
| OPP-25 | J8.4 | Figma source vs React side-by-side | Trust |
| OPP-26 | J8.5 | Highlight violations new since last sync | Focus |
| OPP-27 | J9.3 | Incremental validation per agent | Speed |
| OPP-28 | J9.4 | Auto-link PR to journey steps | Traceability |
| **OPP-29** | **J8.3–J8.5** | **Ingestion-Time Audit & Auto-Heal (Phase ING)** — Three-tier heal pass between hydration and editorStore. See `FEATURE-SPEC-INGESTION-HEAL.md` | **Eliminates J8 anxiety dip. HIGH priority** |

## Appendix C: Cross-Journey Flow

```
J1 (First Launch)
  ├──→ J2 (Open Project) ──→ J3 (Governance) ──→ J4 (Export)
  │                            ↑        │
  │                            │        ↓
  │                          J5 (Canvas) ←──→ J6 (Recovery)
  │
  └──→ J8 (Figma Import) ──→ J3 (with tokens)
  
J7 (MCP Agent) ──→ J3 (triggers re-audit in Glass via fs.watch)

J9 (Developer) ─── builds features that enable all other journeys
```
