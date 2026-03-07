
# Bridge IDE: The "Agentic UI Operating System"

### **Architecture Specification (v7.0 — Agentic UI OS)**

## **1. Core Identity & Philosophy**

**Bridge** is the first Agentic UI Operating System. It is the strict "containment field" for high-velocity AI agents (e.g., Claude Code, OpenAI Operator). It ensures that while agents generate code at 10x speed, they are physically incapable of violating brand, accessibility, or codebase integrity standards.

* **The "Mithril" Philosophy:** Design integrity is enforced deterministically at the AST level, not via visual approximations.
* **The "Soft Mithril" UX:** Developers and agents are guided by CIEDE2000 $\Delta E$ perceptual warnings. This allows high-speed drafting but physically blocks "dirty" code from production.

---

## **2. System Architecture: The "Secure Hybrid"**

| **Layer** | **Technology** | **Strategic Role** |
| --- | --- | --- |
| **App Shell** | **Electron (v40+)** | Native OS access; strict IPC context isolation; native directory selection. |
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

### **Module E: Persistence & Edge-Edge Hardening**
* **Continuous Auto-Save:** Every successful AST mutation triggers an immediate, automatic save to the local disk.
* **Atomic Write Queue:** All disk writes route through a `FileTransactionManager` (write to `.tmp` $\rightarrow$ `fs.rename`) to survive OS crashes.
* **Transaction Batching:** Exposes `applyMutationBatch()` so AI agents can execute hundreds of AST surgeries in a single disk write.

### **Module F: Multi-AST Coordination (Phase F.2)**
* **Headless Buffers:** Maintains a `Map<filePath, BabelAST>` for cross-file surgery outside the active view.
* **Cross-File Move:** 11-step atomic operation for detaching, synthesizing imports, and attaching nodes across files.
* **Buffer Hardening:** Every buffer loaded via `loadBuffer` has `injectBridgeIds(ast)` applied immediately.

### **Module G: Global Recovery Engine & Scaffolding**
* **Recovery Controller:** `recoveryController.ts` orchestrates single-file and cross-file undo/redo stacks.
* **Scaffolding:** `registry.ts` and `templateService.ts` for project initialization and template management.
* **Registry Tracking:** `bridge-registry.db` maintains global state for local project discovery.

### **Module H: Cross-File Redo (Incremental Redo)**
* **Redo Planning:** `CrossFileMoveRedoPlan` specialized schema to re-execute complex cross-file surgeries correctly.
* **History Guard:** `isRecovery` flag prevents feedback loops in the history stack.
* **Redo Atomicity:** Re-executes the 11-step move process precisely as originally defined.

### **Module I: Interaction Modes**
* **Canvas Modes:** `canvasMode` toggles between 'design' and 'interact' in `canvasStore`.
* **Shield Gating:** Design mode enables the transparent coordinate-capture overlay (The Shield).
* **Pointer Events:** In 'interact' mode, the Shield is removed, allowing standard mouse interactions with the LivePreview contents.

### **Module J: Native OS Menu & IPC**
* **OS Menu Integration:** Native menu handlers for `new-project`, `open-project`, and `close-project` routing through `main.ts`.
* **Preload Isolation:** `window.bridgeAPI` provides safe access to native file system dialogs and Git interactions.

### **Module K: Undo Logic Hardening**
* **Void Undo Prevention:** `applyBatch` no-op guard prevents redundant history entries when mutations fail structural checks.
* **Commandment 10 Fix:** `editorStore.setCode` ensures history is preserved during file load and state sync.
* **Global Property Undoability:** All class, text, and arbitrary property edits route through the batch mutation engine.

### **Module L: Bridge Auditor / Orchestration**
* **AI Guardrails:** `orchestrator.ts` requires user confirmation for every proposed mutation.
* **Tool Catalog:** AI restricted to versioned AST tools (`updateProps`, `addClassName`, etc.).
* **Complexity Audit:** Tasks are categorized by complexity before routing to specific models.

### **Module M: AI Orchestrator Hardening**
* **Commandment 15:** Zero-generation of raw code strings. The AI model only proposes granular tool calls.
* **Commandment 16:** In-memory TSC validation loop. AI output is type-checked before appearing in the UI.
* **RAG Injection:** `sqlite-vec` provides real-time local Design System context to the model.

### **Module N.1: Designer Experience (LayoutPanel)**
* **LayoutPanel.tsx:** Figma-grade controls for Flexbox/Grid alignment and Hug/Fill sizing selects.
* **Axis-Swapping Logic:** 3x3 alignment grid responds dynamically to `flex-row` vs `flex-col`.
* **Atomic Management:** `layoutMapper.ts` handles mutually exclusive Tailwind class updates.

### **Module O: Figma Ingestion & Sync**
* **Ingestion Server:** Loopback HTTP server (port 4545). Authenticated via `x-bridge-secret`.
* **Token Normalizer:** `normalizer.ts` maps Figma Variables to W3C DTCG for PowerSync ingestion.
* **Payload Routing:** Endpoints for `/ingest` (Variables), `/ingest-asset` (Images), and `/ingest-ast` (Direct AST).
* **Auto-Hydration:** `/ingest-ast` triggers `bridge:hydro-paste-auto` for zero-click Figma-to-Bridge sync.

### **Module P: LSP Orchestrator**
* **Intelligence Layer:** TypeScript and Vue LSP clients online for cross-file intellisense.
* **Validation:** Provides background type checking and hover-documentation for component surgery.

---

## **4. The 16 Commandments (Non-Negotiable Guardrails)**

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
14. **Bypass Prohibition:** Never use `fs` or `git` directly for stateful file changes; always route through `FileTransactionManager` or `GitManager`.
15. **Granular AST Tools Only:** The AI Orchestrator MUST only emit ops from the versioned AST Tool Catalog (`updateProps`, `updateText`, `insertNode`, `wrapNode`, `deleteNode`, `addClassName`, `removeClassName`). Raw code string generation is prohibited.
16. **In-Memory Validation Loop:** `orchestrator.ts` MUST run an in-memory TSC type-check on all AI output before surfacing a confirmation UI.

---

## **5. Critical AI Directives**
1. **Architecture Spec:** Always consult `.bridge-context/architecture.md` and `.antigravityrules`.
2. **Mithril Safety:** If ΔE > 2.0, code must be auto-fixed or Amber-flagged.
3. **Persistence Rule:** All mutations MUST be atomic and saved via the `FileTransactionManager` queue.
4. **No Hallucinations:** Use Babel AST traversal for all code changes. Never use Regex for source code.
5. **Documentation Autopilot:** No session ends without a `[BRIDGE-PULSE-v7.x]` block update.
