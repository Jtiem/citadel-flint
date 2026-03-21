(As of 2/28/2026) Please read CLAUDE.MD and HANDOFF.MD to be sure these are still relevant.

Flint IDE v5.7 Feature Scan & Gap Analysis
Based on the 
architecture.md
 (v5.7) specification and the 
HANDOFF.md
 document, I have performed a deep scan of the active codebase to identify missing features. While the core AST parser, Live Preview, and File Transaction Manager are robust and functioning, several advanced modules are entirely unbuilt or only partially stubbed.

Here is the comprehensive list of features you are missing and should consider including in your mid-to-long-term roadmap.

1. Module B: The Mithril Safety Layer
Missing: The Soft Mithril Linter (Commandment 9)
Spec: "Uses CIEDE2000 $\Delta E$ to calculate perceptual drift. If $\Delta E > 2.0$, the UI glows Amber and prompts an AST Auto-Fix."
Current State: Neither color-diff nor any CIEDE2000 math exists in the codebase or 
package.json
. There is no logic comparing Figma tokens against rendered styles in real-time.
Missing: The Export Gate (Commandments 5 & 6)
Spec: "Exports are permanently blocked if any active entries exist in the component_overrides table or if critical WCAG accessibility (a11y) violations remain."
Current State: The component_overrides table exists in SQLite, but there is no UI preventing a user from compiling/exporting dirty code. The WCAG a11y linter is entirely unbuilt.
2. Module D: The Code-First Recovery Engine
Missing / Blocked: Macro-Recovery (Commandments 10 & 11)
Spec: "Flint extracts the specific target node from Git history (git show HEAD) and transplants it into the live AST."
Current State: The IPC handler (window.flintAPI.gitShow) is stubbed in the Type definitions, but the actual AST transplant logic (
transplantNode
) is missing. Furthermore, you cannot use this feature until a Git repository is initialized and cleanly committed.
Missing: Micro-Recovery (Command Pattern Undo/Redo)
Spec: Standard Ctrl+Z Undo generates the mathematical inverse of a Babel mutation.
Current State: The 
applyInversions()
 logic exists in 
ASTService.ts
, but it is not hooked up to a Zustand history stack or keyboard shortcuts (Cmd+Z) in the actual UI.
3. Data Engine & Sync (Module C)
Missing: Vector Embeddings (SQLite-vec)
Spec: "Data Engine: SQLite + sqlite-vec Local vector embeddings for design system RAG and privacy-first context."
Current State: 
electron/store.ts
 uses standard better-sqlite3. Unsurprisingly, sqlite-vec is not in 
package.json
. There is no RAG architecture built.
Missing: PowerSync CRDT Migration
Spec: "PowerSync SDK: Real-time CRDT sync for team collaboration, Presence, and Tokens."
Current State: "Sync" relies on polling the local SQLite presence table via syncPresence and readPresence. The PowerSync Web SDK is not installed, meaning true peer-to-peer multiplayer is not functional.
4. AST Manipulation Completeness
While text editing (7a) is done, the following Inspector tasks remain:

7B (Arbitrary Props): The properties panel only allows editing className and textContent. You cannot visually edit disabled, href, src, or ARIA tags.
7C (Node Deletion): deleteNode exists in the parser, but there is no UI/keyboard shortcut (
Delete
 / Backspace on canvas) to trigger it.
7D (Renderer ID Injection): The renderer trusts the main process to inject data-flint-id. This should occur in 
ast-parser.ts
 to harden offline rendering.
Phase F (Multi-AST): Dragging a .tsx file from the Explorer onto the Canvas to inject an imported component instance is unimplemented.
5. Security & Orchestration
Missing: The Flint Auditor
Spec: "Complexity analysis that routes tasks to 'Flash' or 'Thinking' AI models."
Current State: There is no orchestration software built into the app to actively manage Claude/OpenAI calls or route tasks based on AST complexity. (Unless this refers exclusively to me, the system LLM, acting as the auditor.)
Recommended Additions to the Current Plan
If you want to reach a complete "v5.7 Feature Freeze", you must add the following epics to your Status Report:

The Mithril Linter Epic: Implement CIEDE2000 drift math and cross-reference Figma tokens with live Computed Styles.
The Export Gate Epic: Hook up WCAG axe-core or custom AST linters, and build a "Deployment UI" that physically disables the Export button based on the component_overrides database table.
The Data Engine Epic: Integrate sqlite-vec for embeddings and wire up PowerSync for remote multiplayer.