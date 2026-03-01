
# Bridge IDE: The "Agentic UI Operating System"

### **Architecture Specification (v5.7 — Lunar Elevator + Persistence)**

## **1. Core Identity & Philosophy**

**Bridge** is the first Agentic UI Operating System. It is the strict "containment field" for high-velocity AI agents (e.g., Claude Code, OpenAI Operator). It ensures that while agents generate code at 10x speed, they are physically incapable of violating brand, accessibility, or codebase integrity standards.

* **The "Mithril" Philosophy:** Design integrity is enforced deterministically at the AST level, not via visual approximations.
* **The "Soft Mithril" UX:** Developers and agents are guided by CIEDE2000 $\Delta E$ perceptual warnings. This allows high-speed drafting but physically blocks "dirty" code from production.

---

## **2. System Architecture: The "Secure Hybrid"**

| **Layer** | **Technology** | **Strategic Role** |
| --- | --- | --- |
| **App Shell** | **Electron (v29+)** | Native OS access; strict IPC context isolation; native directory selection. |
| **Data Engine** | **SQLite + `sqlite-vec**` | Local vector embeddings for design system RAG and privacy-first context. |
| **Sync Layer** | **PowerSync SDK** | Real-time CRDT sync for team collaboration, Presence, and Tokens. |
| **Orchestration** | **Bridge Auditor** | Complexity analysis that routes tasks to "Flash" or "Thinking" AI models. |
| **Canvas** | **`@xyflow/react` v12** | Infinite whiteboard for visual node manipulation. |
| **Preview Engine** | **Iframe + Babel IPC** | 100% offline `srcdoc` execution with zero external dependencies. |
| **Bundling** | **ESBuild WASM** | Client-side bundler injected with React Fast Refresh for stateful hot-swapping. |

---

## **3. Functional Modules (The Hardened Core)**

### **Module A: The AST-Driven Canvas & Ghost Proxy**

* **ID-Indestructible Select:** A permanent `data-bridge-id` connects the AST, Layers Panel, and Iframe.
* **Figma-Grade Drag & Drop:** A transparent "Shield" overlay captures `onMouseMove` events, bypassing Iframe event swallowing. IPC coordinates are throttled via `requestAnimationFrame` to render a Ghost Cursor.
* **AST Surgery:** On drop, Babel performs deterministic traversal to move nodes and intelligently synthesizes required React imports to the new file.

### **Module B: The Mithril Safety Layer**

* **Soft Mithril Linter:** Uses CIEDE2000 $\Delta E$ to calculate perceptual drift. If $\Delta E > 2.0$, the UI glows Amber and prompts an AST Auto-Fix.
* **The Export Gate (Hard Rule):** The system disables exports if any active entries exist in the `component_overrides` table or if critical WCAG accessibility (a11y) violations remain.

### **Module C: Multiplayer Sync & AI State**

* **CRDT Bucketing:** PowerSync partitions SQLite into Global (Tokens), Project (Overrides), and Presence (Cursors).
* **AST Conflict Arbiter:** Interacting with a node updates `active_bridge_id` in PowerSync, visually locking the node to prevent concurrent multiplayer or agent collisions.

### **Module D: The Code-First Recovery Engine**

* **Micro-Recovery (AST Command Pattern):** Standard `Ctrl+Z` Undo generates the mathematical *inverse* of a Babel mutation. Pre-flight checks guarantee the target `data-bridge-id` still exists before executing.
* **Macro-Recovery (Git Transplants):** To revert an AI hallucination, Bridge extracts the specific target node from Git history (`git show HEAD`) and transplants it into the live AST, preserving concurrent teammates' work.

### **Module E: Persistence & Edge-Case Hardening**

* **Continuous Auto-Save:** The IDE operates strictly on local user directories. Every successful AST mutation triggers an immediate, automatic save to the local disk. There is no manual "Save" button.
* **Atomic Write Queue:** All disk writes route through a `FileTransactionManager` (write to `.tmp` $\rightarrow$ `fs.rename`) to survive OS crashes.
* **Transaction Batching:** Exposes `applyMutationBatch()` so AI agents can execute hundreds of AST surgeries in a single disk write/Undo entry, preventing IPC DDoS.
* **Strict Garbage Collection:** Deleting a node immediately triggers `DELETE FROM component_overrides WHERE bridge_id = ?` to prevent "Zombie" export locks.

Phase F: Multi-file Support & Workspace Wiring

This phase transitions Bridge from a "Component Editor" to a "Project Workspace." It leverages the synthesizeImports logic already built in Phase B.
Module F.1: The File Tree UI & Explorer Service

    The Component: Create src/components/ui/FileExplorer.tsx. It must use the Zustand selector pattern.

    State Management: Add workspaceFiles: string[] and expandedFolders: Set<string> to canvasStore.ts.

    Backend Support: Update the dialog:openFolder handler in main.ts to recursively scan for supported extensions (.tsx, .ts, .jsx, .js) and return a nested tree object instead of just the primary file.

    File Switching: Clicking a file in the tree calls setActiveFile(path) in canvasStore. This must trigger a clean state wipe of editorStore.ast before loading the new content to prevent "ghost" visual layers.

Module F.2: Multi-AST Coordination

    The "Headless" Buffer: Update editorStore.ts to maintain a Map<filePath, BabelAST>.

    Cross-File logic: When dragging a component from the Canvas to a different file in the FileExplorer:

        Detach: Remove node from current editorStore.ast.

        Synthesize: Run ASTService.synthesizeImports on the node for the target file.

        Attach: Inject node into the target file's AST buffer.

        Commit: Trigger ast:save-file for both affected paths via FileTransactionManager.

Phase G: Project Lifecycle & Portability

This phase handles the "Macro" operations of the IDE—starting fresh and managing project-level metadata.
Module G.1: Scaffolding & The Template Engine

    Template Storage: Create an electron/templates/ directory containing:

        base-vite-tailwind/: A minimal functional project.

        bridge-init.sql: The schema for the component_overrides and design_tokens tables.

    IPC Implementation: New channel project:initialize.

        Payload: { targetPath: string, templateId: string }.

        Action: Uses node:fs to copy the template directory to the targetPath.

        Validation: Must verify the directory is empty and within app.getPath('home') per security constraints.

Based on the architectural foundations established in your **Bridge IDE — Architect Status Report 2:27** and our technical discussions regarding the transition from a single-file editor to a full project-based IDE, here is the exacting detail for **Phases F and G**.

---

#### **Module F.1: The File Tree UI & Explorer Service**

* **The Component:** Create `src/components/ui/FileExplorer.tsx`. It must use the `Zustand` selector pattern.
* **State Management:** Add `workspaceFiles: string[]` and `expandedFolders: Set<string>` to `canvasStore.ts`.
* **Backend Support:** Update the `dialog:openFolder` handler in `main.ts` to recursively scan for supported extensions (`.tsx`, `.ts`, `.jsx`, `.js`) and return a nested tree object instead of just the primary file.
* **File Switching:** Clicking a file in the tree calls `setActiveFile(path)` in `canvasStore`. This must trigger a clean state wipe of `editorStore.ast` before loading the new content to prevent "ghost" visual layers.

#### **Module F.2: Multi-AST Coordination**

* **The "Headless" Buffer:** Update `editorStore.ts` to maintain a `Map<filePath, BabelAST>`.
* **Cross-File logic:** When dragging a component from the Canvas to a different file in the `FileExplorer`:
1. **Detach:** Remove node from current `editorStore.ast`.
2. **Synthesize:** Run `ASTService.synthesizeImports` on the node for the target file.
3. **Attach:** Inject node into the target file's AST buffer.
4. **Commit:** Trigger `ast:save-file` for both affected paths via `FileTransactionManager`.



---

### **Phase G: Project Lifecycle & Portability**

This phase handles the "Macro" operations of the IDE—starting fresh and managing project-level metadata.

#### **Module G.1: Scaffolding & The Template Engine**

* **Template Storage:** Create an `electron/templates/` directory containing:
* `base-vite-tailwind/`: A minimal functional project.
* `bridge-init.sql`: The schema for the `component_overrides` and `design_tokens` tables.


* **IPC Implementation:** New channel `project:initialize`.
* **Payload:** `{ targetPath: string, templateId: string }`.
* **Action:** Uses `node:fs` to copy the template directory to the `targetPath`.
* **Validation:** Must verify the directory is empty and within `app.getPath('home')` per security constraints.



#### **Module G.2: The Demo Hydrator ("Sandbox Mode")**

* **The Blueprint:** Bundle a "Golden Demo" project inside the Electron `.asar` (read-only).
* **Hydration Logic:** Create a `src/services/DemoService.ts`.
1. Copies the "Golden Demo" to a temporary OS directory.
2. Points `canvasStore.activeFilePath` to the temp location.
3. Initializes a fresh `better-sqlite3` instance in the temp folder.


* **Persistence Policy:** Changes in "Demo Mode" are saved to the temp folder but discarded on app close unless the user chooses "Export Project."

#### **Module G.3: Project-Level Database (Bridge Registry)**

* **The Registry:** A global `bridge-registry.db` located in `userData`.
* **Function:** Stores a list of `recentProjects` (name, path, lastOpened).
* **UI:** Create a `src/components/ui/LaunchScreen.tsx` that appears if no `activeFilePath` is set. It displays the recent projects and the "New Project" / "Try Demo" buttons.

---

## **4. The 13 Commandments (Non-Negotiable Guardrails)**

1. **Code is Truth (The Persistence Rule):** If it isn't saved to the local `.tsx` file via the AST, it doesn't exist. Ephemeral demo states are prohibited.
2. **No Hallucinated Styling:** Every visual edit MUST be tied to a `design_token`.
3. **Composite IDs for Arrays:** Dynamic lists (e.g., `Array.map`) MUST use injected composite template IDs (e.g., `data-bridge-id={`node-${index}`}`).
4. **Local-First Only:** No external URLs, no Sandpack. Preview must remain 100% offline-capable.
5. **Accessibility is a Compiler Error:** Missing a11y attributes trigger a "Critical Block" for exports.
6. **The Gatekeeper Rule:** Exports are permanently blocked if any overrides or design drift remain.
7. **Indestructible ID Preservation:** All mutations MUST preserve the `data-bridge-id`.
8. **Audit-First Execution:** Every task is audited for complexity before selecting a model (Flash vs. Thinking).
9. **CIEDE2000 $\Delta E$ Logic:** Use perceptual color distance for all design system drift detection.
10. **Targeted Micro-Recovery:** Undo operations must run pre-flight AST checks before executing inverse surgery.
11. **Surgical Git Transplants:** Never execute a raw `git checkout` on a shared file; extract and transplant specific nodes.
12. **Atomic Queuing & Batching:** All file system saves must be atomic. AI mass-edits must be batched into a single transaction.
13. **Deterministic Surgery:** Use Babel AST traversal for all code changes. Never use Regex to modify source code.

