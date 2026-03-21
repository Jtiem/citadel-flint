# Flint IDE: The "Agentic UI Operating System"

### **Architecture Specification (v6.0 — Phase M: AI Orchestrator Hardening)**

## **1. Core Identity & Philosophy**

**Flint** is the first Agentic UI Operating System. It is the strict "containment field" for high-velocity AI agents (e.g., Claude Code, OpenAI Operator). It ensures that while agents generate code at 10x speed, they are physically incapable of violating brand, accessibility, or codebase integrity standards.

* **The "Mithril" Philosophy:** Design integrity is enforced deterministically at the AST level, not via visual approximations.
* **The "Soft Mithril" UX:** Developers and agents are guided by CIEDE2000 $\Delta E$ perceptual warnings. This allows high-speed drafting but physically blocks "dirty" code from production.

---

## **2. System Architecture: The "Secure Hybrid"**

| **Layer** | **Technology** | **Strategic Role** |
| --- | --- | --- |
| **App Shell** | **Electron (v29+)** | Native OS access; strict IPC context isolation; native directory selection. |
| **Data Engine** | **SQLite + `sqlite-vec**` | Local vector embeddings for design system RAG and privacy-first context. |
| **Sync Layer** | **PowerSync SDK** | Real-time CRDT sync for team collaboration, Presence, and Tokens. |
| **Orchestration** | **Flint Auditor** | Complexity analysis routes tasks to "Flash" or "Thinking" models. AI is restricted to granular AST Tool Calls only — no raw string generation. |
| **Canvas** | **`@xyflow/react` v12** | Infinite whiteboard for visual node manipulation. |
| **Preview Engine** | **Iframe + Babel IPC** | 100% offline `srcdoc` execution with zero external dependencies. |
| **Bundling** | **ESBuild WASM** | Client-side bundler injected with React Fast Refresh for stateful hot-swapping. |

---

## **3. Functional Modules (The Hardened Core)**

### **Module A: The AST-Driven Canvas & Ghost Proxy**

* **ID-Indestructible Select:** A permanent `data-flint-id` connects the AST, Layers Panel, and Iframe.
* **Figma-Grade Drag & Drop:** A transparent "Shield" overlay captures `onMouseMove` events, bypassing Iframe event swallowing. IPC coordinates are throttled via `requestAnimationFrame` to render a Ghost Cursor.
* **AST Surgery:** On drop, Babel performs deterministic traversal to move nodes and intelligently synthesizes required React imports to the new file.

### **Module B: The Mithril Safety Layer**

* **Soft Mithril Linter (Enterprise-Grade):** Deterministic AST-level design system enforcement across every visual dimension:
  * **Color drift:** CIEDE2000 $\Delta E$ perceptual distance ($\Delta E > 2.0$ = Amber warning).
  * **Typography drift:** Font-family, font-size, font-weight, line-height, letter-spacing checked against tokens.
  * **Spacing drift:** Padding, margin, gap, width, height validated against dimension tokens.
  * **Shadow / Opacity drift:** Arbitrary values flagged when tokens exist for the category.
* **Accessibility (WCAG 2.1 AA):** Static AST rules for `img`, `button`, `a`, `input`, `select`, `textarea`, `table`, heading hierarchy, `lang`, and `tabindex` misuse.
* **The Export Gate (Hard Rule):** The system disables exports if any active entries exist in the `component_overrides` table, if any Mithril violations remain in any category, or if critical WCAG accessibility violations remain.


### **Module C: Multiplayer Sync & AI State**

* **CRDT Bucketing:** PowerSync partitions SQLite into Global (Tokens), Project (Overrides), and Presence (Cursors).
* **AST Conflict Arbiter:** Interacting with a node updates `active_flint_id` in PowerSync, visually locking the node to prevent concurrent multiplayer or agent collisions.

### **Module D: The Code-First Recovery Engine**

* **Micro-Recovery (AST Command Pattern):** Standard `Ctrl+Z` Undo generates the mathematical *inverse* of a Babel mutation. Pre-flight checks guarantee the target `data-flint-id` still exists before executing.
* **Macro-Recovery (Git Transplants):** To revert an AI hallucination, Flint extracts the specific target node from Git history (`git show HEAD`) and transplants it into the live AST, preserving concurrent teammates' work.

### **Module E: Persistence & Edge-Case Hardening**

* **Continuous Auto-Save:** The IDE operates strictly on local user directories. Every successful AST mutation triggers an immediate, automatic save to the local disk. There is no manual "Save" button.
* **Atomic Write Queue:** All disk writes route through a `FileTransactionManager` (write to `.tmp` $\rightarrow$ `fs.rename`) to survive OS crashes.
* **Transaction Batching:** Exposes `applyMutationBatch()` so AI agents can execute hundreds of AST surgeries in a single disk write/Undo entry, preventing IPC DDoS.
* **Strict Garbage Collection:** Deleting a node immediately triggers `DELETE FROM component_overrides WHERE flint_id = ?` to prevent "Zombie" export locks.


### **Module M: AI Orchestrator Hardening (Phase M)**

* **Granular AST Tool Catalog (Commandment 15):** The AI Orchestrator is constrained to a strict, versioned set of JSON Tool Calls. It is architecturally incapable of emitting raw source code strings or full-file replacements. The permitted Tool Catalog is:
  * `updateProps({ targetId: string, props: Record<string, string> })` — Modify JSX attributes on a single node.
  * `updateText({ targetId: string, text: string })` — Modify the text content of a single node.
  * `insertNode({ targetId: string, position: 'before'|'after'|'firstChild'|'lastChild', nodeType: string, props?: Record<string, string> })` — Insert a new JSX node relative to a target.
  * `wrapNode({ targetId: string, wrapperType: string, props?: Record<string, string> })` — Wrap an existing node in a new parent element.
  * `deleteNode({ targetId: string })` — Remove a node from the AST.
  * `addClassName({ targetId: string, className: string })` — Append a design-token class to a node's className.
  * `removeClassName({ targetId: string, className: string })` — Remove a specific class from a node's className.
* **In-Memory Validation Loop (Commandment 16):** After the AI emits a batch of Tool Calls, the `orchestrator.ts` synthesizes the resulting code in-memory and runs a lightweight TypeScript AST type-check pass before surfacing the confirmation UI to the user. If the AI hallucinates a component or prop that does not exist in the design system, the TS error is injected back into the AI context as a recovery prompt — the user never sees a broken diff.
* **Design System RAG Injection:** Every orchestrator prompt is prefixed with the TypeScript interfaces of the project's registered UI components, sourced via `sqlite-vec` semantic lookup. This gives the AI the exact prop shapes available, eliminating the need for it to guess.
* **Structured Outputs Enforcement:** The LLM API call is made with strict Structured Outputs / Tool Use mode enabled (Anthropic Tool Use or OpenAI `response_format: { type: 'json_schema' }`). Any non-JSON output is rejected before processing.

### Module G.1: The Scaffolding Engine

• Create a templates/ directory in the Electron main process containing a "Starter" .tsx and a default flint.db schema.

• Implement IPC project:initialize: copies template files to a user-selected directory.

### Module G.2: The Demo Hydrator

• Bundle your "Current Demo" as a static asset.

•  Add a "Reset to Demo" button that wipes the current local .flint folder and re-injects the demo state.
---

## **4. The 16 Commandments (Non-Negotiable Guardrails)**

1. **Code is Truth (The Persistence Rule):** If it isn't saved to the local `.tsx` file via the AST, it doesn't exist. Ephemeral demo states are prohibited.
2. **No Hallucinated Styling:** Every visual edit MUST be tied to a `design_token`.
3. **Composite IDs for Arrays:** Dynamic lists (e.g., `Array.map`) MUST use injected composite template IDs (e.g., `data-flint-id={`node-${index}`}`).
4. **Local-First Only:** No external URLs, no Sandpack. Preview must remain 100% offline-capable.
5. **Accessibility is a Compiler Error:** Missing a11y attributes trigger a "Critical Block" for exports.
6. **The Gatekeeper Rule:** Exports are permanently blocked if any overrides or design drift remain.
7. **Indestructible ID Preservation:** All mutations MUST preserve the `data-flint-id`.
8. **Audit-First Execution:** Every task is audited for complexity before selecting a model (Flash vs. Thinking).
9. **CIEDE2000 $\Delta E$ Logic:** Use perceptual color distance for all design system drift detection.
10. **Targeted Micro-Recovery:** Undo operations must run pre-flight AST checks before executing inverse surgery.
11. **Surgical Git Transplants:** Never execute a raw `git checkout` on a shared file; extract and transplant specific nodes.
12. **Atomic Queuing & Batching:** All file system saves must be atomic. AI mass-edits must be batched into a single transaction.
13. **Deterministic Surgery:** Use Babel AST traversal for all code changes. Never use Regex to modify source code.
14. **Documentation Autopilot (v5.7):** No code modification is "Done" until its architectural impact is mirrored in `CLAUDE.md`, `HANDOFF.md`, and `.flint-context/FLINT-PULSE.md`.
15. **Granular AST Tools Only (Phase M):** The AI Orchestrator MUST only emit operations from the versioned AST Tool Catalog (see Module M). Emitting raw code strings, full-file replacements, or regex-based patches is a hard violation.
16. **In-Memory Validation Before Confirmation (Phase M):** The `orchestrator.ts` MUST execute an in-memory TypeScript type-check on synthesized AI output before surfacing any confirmation UI to the user. TS errors must be fed back to the AI in an invisible recovery loop — never presented as a broken diff to the user.

---

### **Module O: Enterprise Component Registry (Remote Git Access)**
* **Secure Storage:** Remote repository Personal Access Tokens (PATs) and OAuth tokens are stored purely in Electron's OS-native `safeStorage` to fulfill enterprise security requirements.
* **Headless Indexing:** Core design systems are cloned invisibly to a local `~/.flint/cache` directory. An `IndexerWorker` strips and caches the exported component signatures and TypeScript interfaces.
* **Semantic RAG Injection:** Using `sqlite-vec`, AST component shapes are vectorised. The AI Orchestrator executes a cosine similarity search against user prompts, injecting only relevant enterprise component props into the LLM context to prevent hallucinations.
* **AST Auto-Importer:** Dragging a remote component onto the active canvas triggers `crossFileMove` logic that automatically injects the exact module import statement (e.g., `import { Card } from '@acme/core'`) and validates the local `package.json` dependencies.
