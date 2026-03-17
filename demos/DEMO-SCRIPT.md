# Bridge MCP — 20-Minute Live Demo Script

**Order:** Demo 2, 7, 8, 9, 3
**Audience:** Engineers and technical stakeholders
**Goal:** Show that Bridge MCP is infrastructure, not tooling — it changes what AI-generated UI code is allowed to be.

---

## Opening (1 min)

"AI writes UI code fast. The problem is that fast is not the same as safe. Tokens get hardcoded. Prop contracts get misread. Components land in codebases with no accessibility attributes, no design system references, and no way to audit them at scale. Bridge is the governance layer between the AI and production. Let me show you five things it does that no other tool does."

---

## Demo 2: Self-Correcting Verification (3 min)

**File:** `demos/02-self-correcting/buggy-component.tsx`

- Open the file. "This is what an AI produced when it misread a prop contract. Looks fine."
- Point to the three errors. Don't read them all — just say: "String assigned to number. Extra callback parameter not in the interface. Invalid `keyof Row` literal. Three type errors, invisible without a compiler."
- Call `audit_ui_component`. Show the response.
- "Bridge ran `tsc --noEmit` in memory before surfacing this as a diff. The user never saw a proposed change. If it doesn't type-check, it doesn't reach you. That's Commandment 16 — in-memory validation is not optional."
- **Pause for effect.** "Every AI coding tool generates diffs. Bridge decides which diffs are allowed to exist."

---

## Demo 7: Autonomous Swarm Clean-up (3 min)

**Files:** All six `demos/**/*.tsx` fixtures

- Show the debt report first. Call `bridge_debt_report glob: "demos/**/*.tsx" format: "markdown"`.
- Read the numbers: "Six files, four with violations, health score 43, grade D."
- One call: `bridge_swarm_audit_fix glob: "demos/**/*.tsx" autoFix: true`.
- Read the summary back: "Files scanned: 6. Violations fixed: 12. Health score: 43 → 91."
- "No individual tool calls. No per-file instructions. The swarm ran audit and fix in parallel, applied every deterministic correction, and reported a per-file breakdown."
- Show `drift-component.tsx` in the `fileReports` — 5 violations → 0.
- Re-run debt report with `track: true`. "This snapshot goes into `.bridge/debt-history.json`. You can chart regressions in CI."

---

## Demo 8: Remote Component Library (3 min)

**No fixture file — live registry demo**

- Empty registry. Call `bridge_query_registry semantic_query: "primary action button"`. Show empty results. "Nothing to work with."
- Call `bridge_add_remote_library` with a public manifest URL.
- Read the result: "Added 12 components. Button, Card, Stack, TextField..." — "No git clone. No npm install. Raw manifest fetch, validated and indexed into the vector store. Done."
- Re-run the same registry query. Show `Button` returned with full TypeScript prop interface and import path.
- "That matched on meaning, not string. The query was 'primary action button'. It matched `Button` via cosine similarity on the component description embedding."
- "Add a design system once. Every agent, every RAG query, every Figma hydration call immediately benefits from it."

---

## Demo 9: Cross-File Multi-AST Drop (4 min)

**Bridge Glass running, two .tsx files in the workspace**

- Show Glass. "No code editor. No terminal. No chat. This is a read-only observability layer. The chat lives in Claude Code or Cursor — this is what Bridge shows you about your codebase."
- Point to the canvas. "Live preview, governance badges on every node, the Git Time Machine in the sidebar."
- Drag a file from the left panel onto the canvas drop zone. Show the blue ring.
- Release. "Bridge parsed the dropped file's AST, identified the top-level export, emitted an inject mutation to the active file, and synthesized the import."
- Open the active file in the IDE alongside Glass. Show the new import and component reference.
- "No clipboard. No template string. Babel AST traversal — the import was merged, not appended."
- Hit Cmd+Z. "The clone is gone. The source file was never touched. Cross-file undo tracked the inverse in `historyStore`."
- "This is the difference between a visual tool and a governance tool. Every gesture on this canvas is a structured AST operation with a full undo chain."

---

## Demo 3: Mithril Shadow Audit (4 min)

**File:** `demos/03-mithril-shadow-audit/drift-component.tsx`

- Open the file. Show it in the LivePreview node on canvas. "A pricing card. Looks like the brand."
- Point to `#0055EE`. "Brand blue is `#0066FF`. This is `#0055EE`. One channel, 17 hex units off. Can you see the difference? Neither can the designer who wrote it."
- Call `audit_ui_component`. Read the five violations.
- Land on the first one: "ΔE 8.4. CIEDE2000 — the human vision perceptual model used in ISO print production. The threshold is 2.0. Anything above 2.0 means a human with normal vision can perceive the difference under standard lighting. 8.4 means they will notice."
- "Violation two — the badge. ΔE 58.2. That's the difference between brand blue and bright red. That's not drift. That's a different color."
- Call `bridge_fix`. Show the corrected file. "Every hex replaced with its CSS variable. One call. Deterministic."
- "If Delta-E exceeds 2.0, Bridge either auto-fixes it or blocks export. That's Commandment 3."

---

## Close (2 min)

"What you just saw:

- A type-invalid AI output blocked before the user sees a diff
- A full project swept from health score 43 to 91 with one tool call
- A remote component library added and immediately queryable via RAG
- A cross-file AST composition triggered from a drag gesture with full undo
- Perceptual color drift detected and corrected deterministically

Bridge MCP runs anywhere — CI, IDE plugin, cloud. Bridge Glass is the observability layer. The governance engine is headless and scriptable. It doesn't care what IDE your team uses.

The invariant is: AI-generated UI code that violates your design system, your accessibility contract, or your type system does not reach production. That's what infrastructure means."

---

**Timing guide:**
| Demo | Target |
|------|--------|
| Opening | 1:00 |
| Demo 2 (Self-Correcting) | 3:00 |
| Demo 7 (Swarm) | 3:00 |
| Demo 8 (Remote Library) | 3:00 |
| Demo 9 (Canvas Drop) | 4:00 |
| Demo 3 (Mithril) | 4:00 |
| Close | 2:00 |
| **Total** | **20:00** |

**Contingency:** If you run long, cut Demo 8 to 2 min by skipping the re-query step (just show the ingestion result). Demo 9 can be cut to 2.5 min by skipping the Cmd+Z undo step. Do not cut Demo 2 — it is the fastest and most conceptually decisive demo in the set.
