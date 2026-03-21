# Flint MCP — Demo Runbooks

Step-by-step presenter guides for all 9 demos. Each runbook is self-contained: exact tool calls, expected output highlights, and "what to say" cues for live delivery.

**Prerequisites for all demos:**
```sh
cd flint-mcp && npm install && npm run build
```
Connect an MCP client (Claude Code, Cursor, or any MCP-compatible IDE) to the Flint MCP server before stepping through any demo. The server resolves `projectRoot` from the `demos/` directory unless stated otherwise.

---

## Demo 1: The Governance Definition of Compliant — Well-structured code that still fails

**Time:** ~2 minutes
**Complexity:** Low
**Impressiveness:** High (opener hook)

### Setup
- Open `demos/01-rag-ui-builder/banner-compliant.tsx` in your IDE
- No other windows needed — the drama is in the contrast between how it looks and what Flint reports

### Steps

1. **Show the file without comment.** Let the audience read it for a moment. Flint IDs on every element, semantic HTML (`<section>`, `<h2>`, `<button>`), props-driven content, clean structure. Say: "Here's a component a developer submitted for review. Would you approve this PR?"

2. **Run the audit.** In your MCP client, call:
   ```
   audit_ui_component
     file: "demos/01-rag-ui-builder/banner-compliant.tsx"
   ```

3. **Show the violation report.** Four Mithril violations (hardcoded hex colors and spacing values), two A11y failures. Say: "Flint wouldn't. Four design system violations. Two accessibility failures. This is *banner-compliant.tsx* — the name is what a developer calls compliant."

4. **Pause. Then explain.** Say: "Every hex color in this file is hardcoded. `#0066FF` is not a design token. `[48px]` is not a design token. The next time brand blue updates in Figma, this component silently drifts. No code review catches that — it looks right at the pixel level. The governance engine reads the contract, not the intent."

5. **Transition.** Say: "Now let me show you what AI-generated code looks like with no governance at all."

### What to highlight
- The file passes a human code review: Flint IDs present, semantic HTML, no obvious bugs
- Mithril violations are hardcoded token values — `#0066FF`, `[12px]`, `[48px]`, `[16px]` — none referencing design tokens
- This is the opener because it reframes the audience's definition of "compliant" before any other demo runs

### Fixture
- `demos/01-rag-ui-builder/banner-compliant.tsx` — `AnnouncementBanner` with Flint IDs on every element, props-driven content, and zero design token references; all colors and spacing hardcoded inline

---

## Demo 1 (Extended): RAG UI Builder — Design system awareness from a vector query

**Time:** ~4 minutes
**Complexity:** Med
**Impressiveness:** High
**Note:** Not in the standard live run. Use when audience includes AI/ML engineers or when you have extra time.

### Setup
- Open `demos/01-rag-ui-builder/broken-layout.tsx` in your IDE
- Flint MCP server running; `demos/design-tokens.json` accessible
- Have Flint Glass open and showing the file in the canvas (optional but adds visual impact)

### Steps

1. **Orient the audience.** Point to the open file. Say: "This is what AI generates when it has no design system context — raw Tailwind utilities everywhere. Notice `bg-blue-500`, `text-[15px]`, `border-gray-200`. None of these reference a design token."

2. **Query the registry.** In your MCP client, call:
   ```
   flint_query_registry
     semantic_query: "notification panel with dismiss button"
     projectRoot: "<absolute path to demos/>"
     limit: 3
   ```

3. **Show the Shadow Storybook output.** The response returns up to 3 matching components with their full TypeScript prop interfaces, import paths, and usage examples. Say: "Flint ran a hybrid vector + keyword search over `sqlite-vec`. It returned `NotificationCard`, `DismissButton`, and `Stack` — the exact primitives this file needs — with their complete prop contracts."

4. **Inject the matched component.** Call `flint_ast_mutate`:
   ```
   flint_ast_mutate
     targetPath: "<absolute path to demos/01-rag-ui-builder/broken-layout.tsx>"
     mutations: [
       {
         "type": "inject",
         "args": {
           "targetId": "pricing-card-header",
           "component": "Stack",
           "props": { "gap": "spacing.16", "align": "between" }
         }
       },
       {
         "type": "fixToken",
         "args": {
           "targetId": "pricing-card-header",
           "property": "backgroundColor",
           "token": "color.primary"
         }
       }
     ]
     writeFile: true
   ```

5. **Show the diff.** Return to the file. The hardcoded `bg-blue-500` header is now `backgroundColor: var(--color-primary)` and the layout is wrapped in a typed `<Stack>` component. Say: "The AI didn't write a string of code. It emitted a structured op, Flint executed it via Babel AST traversal, and the import was synthesized automatically."

### What to highlight
- The `flint_query_registry` return includes TypeScript interfaces — the AI knows the exact prop shape before writing a single character
- Token fixup (`fixToken` op) is deterministic: Babel finds the node by `data-flint-id`, patches the value, regenerates — no regex involved
- `writeFile: true` routes through `FileTransactionManager` — atomic `.tmp` → `rename`, never a partial write

### Fixture
- `demos/01-rag-ui-builder/broken-layout.tsx` — `NotificationPanel` with hardcoded `bg-blue-500`, `text-[15px]`, `border-gray-200`, and a dismiss button with no accessible name; zero design-system component references

---

## Demo 2: Self-Correcting Verification — AI hallucinations caught before the diff

**Time:** ~3 minutes
**Complexity:** Low
**Impressiveness:** Extreme

### Setup
- Open `demos/02-self-correcting/buggy-component.tsx` in your IDE
- No other windows needed — the drama is entirely in the MCP response

### Steps

1. **Frame the problem.** Say: "This is what a capable AI produces when it misreads a prop contract. It looks like reasonable TypeScript. Let me show you the three errors the author doesn't know about."

2. **Point to the three bugs in the file.**
   - Line 60: `const DEFAULT_PAGE_SIZE: number = "25"` — `string` assigned to `number` (TS2322)
   - Line 65: `function handleRowClick(row: Row, index: string)` — extra parameter not in the `onRowClick: (row: Row) => void` contract (TS2345)
   - Line 79: `useState<keyof Row>("created_by")` — `"created_by"` is not in the `keyof Row` union (TS2322)

3. **Trigger the audit.** Call:
   ```
   audit_ui_component
     componentPath: "<absolute path to demos/02-self-correcting/buggy-component.tsx>"
   ```

4. **Show the validation output.** The response surfaces all three errors with exact TypeScript error codes, line numbers, and the type mismatch description. Say: "Flint ran `tsc --noEmit` in memory on this file before surfacing any diff. The user never saw a proposed change — the loop caught it first."

5. **Drive the point home.** Say: "In-memory TSC validation is Commandment 16. It's not optional and it's not a lint rule — it's a compiler pass that runs synchronously in the orchestrator before confirmation UI is shown. If the output doesn't type-check, it doesn't reach you."

### What to highlight
- The errors are real TypeScript errors the language server would catch — Flint's loop is not a reimplementation, it calls TSC directly
- The check happens inside `orchestrator.ts` before any IPC message leaves the main process
- This is the difference between a governance product and a linter: linters flag style, Flint blocks unsound output at the type system level

### Fixture
- `demos/02-self-correcting/buggy-component.tsx` — `DataTable` with three deliberate type errors: `string` assigned to `number` prop, extra parameter in callback, and invalid `keyof Row` literal

---

## Demo 3: Mithril Shadow Audit — Perceptual color drift detected at ΔE precision

**Time:** ~4 minutes
**Complexity:** Med
**Impressiveness:** High

### Setup
- Open `demos/03-mithril-shadow-audit/drift-component.tsx` in your IDE
- Have `demos/design-tokens.json` visible or ready to display (shows the canonical `color.primary: #0066FF`)
- Flint Glass open for the visual overlay reveal (optional but strongly recommended)

### Steps

1. **Establish context.** Say: "A designer eyeballed this pricing card straight from a Figma screenshot instead of copying the token values. It looks right at a glance. Let's see what Flint thinks."

2. **Point to the five inline style values:**
   - Header: `backgroundColor: '#0055EE'`
   - Badge: `backgroundColor: '#FF3333'`
   - Card background: `const HIGHLIGHTED_BG = '#1a1a2e'`
   - Icon color: `color: '#00AAFF'`
   - Font size: `fontSize: '15px'`

3. **Run the audit.** Call:
   ```
   audit_ui_component
     componentPath: "<absolute path to demos/03-mithril-shadow-audit/drift-component.tsx>"
   ```

4. **Walk through the violation report.** Read the five violations aloud:
   - `#0055EE` vs `color.primary (#0066FF)` — ΔE ≈ 8.4 → amber [MITHRIL-COL]
   - `#FF3333` vs nearest token — ΔE ≈ 58.2 → critical [MITHRIL-COL]
   - `#1a1a2e` vs `color.on-surface (#111827)` — ΔE ≈ 11.6 → critical [MITHRIL-COL]
   - `#00AAFF` vs `color.primary (#0066FF)` — ΔE ≈ 18.7 → critical [MITHRIL-COL]
   - `15px` — not in token set, nearest is `fontSize.sm (14px)` [MITHRIL-TYP-002]

   Say: "That first one — `#0055EE` vs `#0066FF` — looks identical to the naked eye. CIEDE2000 is the human vision perceptual model used in print production. It says those colors are 8.4 units apart. Our threshold is 2.0."

5. **Auto-fix the violations.** Call:
   ```
   flint_fix
     targetPath: "<absolute path to demos/03-mithril-shadow-audit/drift-component.tsx>"
     writeFile: true
   ```

6. **Show the corrected file.** Every inline hex is replaced with the appropriate CSS variable (`var(--color-primary)`, `var(--color-danger)`, etc.) and the font size is updated to `var(--font-size-sm)`. Say: "One tool call. Deterministic. Every fix is traceable to a token in the design system."

### What to highlight
- CIEDE2000 is the same algorithm used in professional color management — it perceives color the way humans do, not as hex distance
- The ΔE threshold (2.0 by default, configurable via `flint_set_policy`) is the standard "just-noticeable difference" used in ISO print standards
- `flint_fix` is not "suggest a fix" — it is a batch of `fixToken` AST mutations that write the correct token references back to disk

### Fixture
- `demos/03-mithril-shadow-audit/drift-component.tsx` — `PricingCard` with 5 violations: header `#0055EE` (ΔE 8.4), badge `#FF3333` (ΔE 58.2), card background `#1a1a2e` (ΔE 11.6), icon `#00AAFF` (ΔE 18.7), and `fontSize: '15px'` (not in token set)

---

## Demo 4: The Sentinel — UX psychology enforcement as an MCP prompt

**Time:** ~4 minutes
**Complexity:** Low
**Impressiveness:** High

### Setup
- Open `demos/04-sentinel/violating-ux.tsx` in your IDE
- MCP client configured to use the `flint-sentinel` prompt (available via `ListPromptsRequestSchema`)

### Steps

1. **Show the component.** Scroll through `violating-ux.tsx`. Count the toolbar buttons aloud: "New Order, Save Draft, Submit Order, Duplicate, Export CSV, Export PDF, Print, Archive, Delete, Request Approval. That's ten. Then scroll to the form — 16 fields, all visible, no grouping."

2. **Explain what a normal linter would do.** Say: "A linter would say nothing. There are no syntax errors, no token violations. This is perfectly valid TypeScript. The problem is cognitive, not syntactic."

3. **Invoke the Sentinel prompt.** In your MCP client, invoke the `flint-sentinel` prompt and pass the component source as the user message. The Sentinel is a domain-configurable governance persona — it applies UX psychology, not just rules.

4. **Read the Sentinel's rejection.** The response will cite each named violation:
   - `SENTINEL-CL-001` — Hick's Law: 10 choices exceed the 7±2 cognitive threshold; recommended: primary actions ≤ 5, remainder in overflow menu
   - `SENTINEL-CL-002` — Miller's Law: 16 simultaneously visible fields exceed working memory capacity; recommended: progressive disclosure, 3-section stepped flow
   - `SENTINEL-VH-001` — No visual hierarchy: heading, body, label, and helper text are typographically identical
   - `SENTINEL-PD-001` — Advanced fields (`taxExemptId`, `customsHsCode`, `erpReference`) always visible; recommended: "Show advanced options" disclosure
   - `SENTINEL-A11Y-NAV` — No landmark regions: the entire screen is a flat `<div>` tree

5. **Contrast with a linter.** Say: "Notice what this is not — it's not a list of style warnings. It's a named cognitive load violation with the specific psychological principle, the threshold that was exceeded, and a concrete architectural recommendation. The Sentinel knows Hick's Law. It knows Miller's Law. It's reasoning about the human using this UI."

### What to highlight
- The `flint-sentinel` is an MCP prompt — a reusable governance persona, not a one-off prompt
- It is domain-configurable: you can scope it to healthcare (HIPAA), finance (WCAG EN 301 549), or consumer (`flint-sentinel` default)
- The rejection is structured output with named violation codes — it can be parsed by CI systems, stored in the governance events table, and tracked over time

### Fixture
- `demos/04-sentinel/violating-ux.tsx` — `OrderManagementScreen` with 10-button toolbar (SENTINEL-CL-001), 16-field form (SENTINEL-CL-002), flat typography (SENTINEL-VH-001), always-visible advanced fields (SENTINEL-PD-001), and no ARIA landmark regions (SENTINEL-A11Y-NAV)

---

## Demo 5: Semantic Refactor — BEM div soup surgically upgraded to typed primitives

**Time:** ~5 minutes
**Complexity:** Med
**Impressiveness:** High

### Setup
- Open `demos/05-semantic-refactor/legacy-divs.tsx` in your IDE
- Optionally have the component registry loaded (Flint MCP server running with `flint-manifest.json`)

### Steps

1. **Show the before state.** Scroll through `legacy-divs.tsx`. Say: "This is a profile settings form written before the design system existed. Every layout is a `<div className='box'>` or `<div className='stack'>`. Every text node is a `<span className='text-label'>`. Inputs are raw `<input className='input-text'>`. The component renders correctly, but it's invisible to the governance engine — there's nothing to audit."

2. **Show the mapping.** Explain the upgrade table (visible in the file's header comment):
   - `<div className="box">` → `<Box>`
   - `<div className="stack">` → `<Stack>`
   - `<div className="flex-row">` → `<Inline>`
   - `<span className="text-label">` → `<Text variant="label">`
   - `<input className="input-text">` → `<TextField>`
   - `<select className="select-default">` → `<SelectField>`
   - `<button className="btn-primary">` → `<Button variant="primary">`

3. **Run the batch mutation.** Call `flint_ast_mutate` with a batch of `inject` and `updateClassName` ops targeting each structural element by its `data-flint-id`. For example:
   ```
   flint_ast_mutate
     targetPath: "<absolute path to demos/05-semantic-refactor/legacy-divs.tsx>"
     mutations: [
       { "type": "inject", "args": { "targetId": "profile-settings-root", "component": "Box", "props": {} } },
       { "type": "inject", "args": { "targetId": "profile-header-row", "component": "Inline", "props": { "align": "between" } } },
       { "type": "inject", "args": { "targetId": "profile-name-input", "component": "TextField", "props": { "label": "Display name", "id": "displayName" } } },
       { "type": "inject", "args": { "targetId": "profile-save-btn", "component": "Button", "props": { "variant": "primary", "type": "submit" } } }
     ]
     writeFile: true
   ```

4. **Show the diff.** The structural `<div>` and `<span>` primitives are replaced with typed design system components. Imports are synthesized automatically at the top of the file. Say: "The rendered output is identical. What changed is the AST — the governance engine can now audit every node, every token reference, every accessibility attribute."

5. **Run a quick audit to prove it.** Call `audit_ui_component` on the refactored file. Show the (now much shorter) violation list — the structural primitive violations are gone because the components handle their own token compliance.

### What to highlight
- Babel AST traversal means the refactor is structural, not textual — no regex can accidentally match a class name inside a string literal or a comment
- Import synthesis is automatic: `ASTService.synthesizeImports` merges the new component imports at the top of the file without duplicating existing ones
- The visual output does not change: this is a pure governance upgrade

### Fixture
- `demos/05-semantic-refactor/legacy-divs.tsx` — `ProfileSettings` form with BEM-style `<div className="box|stack|flex-row">`, `<span className="text-*">`, and raw `<input className="input-*">` / `<select className="select-*">` / `<button className="btn-*">` throughout

---

## Demo 6: Universal Macro-Recovery — Surgical AST transplant from Git history

**Time:** ~5 minutes
**Complexity:** High
**Impressiveness:** Extreme

### Setup
- Open both `demos/06-macro-recovery/corrupted-card.tsx` (active file) and `demos/06-macro-recovery/original-card.tsx` (reference) side by side
- Flint Glass open with the RecoveryPanel visible (right sidebar, History tab)
- Flint MCP server running

### Steps

1. **Show the corrupted card.** Open `corrupted-card.tsx`. Point to the two empty comment blocks:
   - Lines 181-186: "DELETED: repo-card-metrics block — the node `data-flint-id='repo-card-metrics'` is gone"
   - Lines 191-201: "CORRUPTED: repo-card-footer — action bar replaced with empty stub and a TODO comment"
   Say: "This happened because an AI refactor used `git checkout src/components/ui/RepoCard.tsx` — a global file replacement. It only needed to extract the language bar. Instead it silently reverted two sections that had been updated in the same commit."

2. **Show the health score drop.** Call:
   ```
   flint_debt_report
     glob: "demos/06-macro-recovery/corrupted-card.tsx"
     format: "markdown"
   ```
   Point to the health score (61) and the violation count — three missing `aria-label` attributes from the deleted action buttons, plus missing token references in the metrics section.

3. **Open the Git Time Machine.** In Flint Glass, open the RecoveryPanel. Show the commit list (populated by `ast:git-log` IPC). Select commit `a3f8b12` — the last known good state.

4. **Load the original node via IPC.** Say: "Flint calls `ast:git-show` — it reads the AST of the file at that specific commit, in memory, and extracts just the nodes we need by `data-flint-id`. It does not check out the file. Commandment 11: never `git checkout` a shared file."

5. **Perform the transplant.** Call:
   ```
   flint_ast_mutate
     targetPath: "<absolute path to demos/06-macro-recovery/corrupted-card.tsx>"
     mutations: [
       {
         "type": "move",
         "args": {
           "sourceId": "repo-card-metrics",
           "targetId": "repo-card-lang-bar",
           "position": "before"
         }
       },
       {
         "type": "move",
         "args": {
           "sourceId": "repo-card-footer",
           "targetId": "repo-card-root",
           "position": "lastChild"
         }
       }
     ]
     writeFile: true
   ```
   *(In practice the nodes come from the git snapshot; the op is identical.)*

6. **Show the healed card.** The `repo-card-metrics` block (stars, forks, issues, updated timestamp) and the full `repo-card-footer` action bar (Star, Fork, Watch, View on GitHub) are back. The `LanguageBar` extraction — the change that was supposed to happen — is untouched.

7. **Re-run the debt report.** Health score returns to 94. Say: "Two subtrees, one tool call, zero lines written by hand. The surrounding refactor was never touched."

### What to highlight
- Flint IDs (`data-flint-id`) are the surgical addresses — they survive reformatting, rename refactors, and line number shifts
- `ast:git-show` reads the Git object store directly, without touching the working tree
- Commandment 11 is the principle that makes this safe: you can always transplant a node from history without risk of reverting unrelated changes in the same file

### Fixture
- `demos/06-macro-recovery/corrupted-card.tsx` — `RepoCard` with deleted `repo-card-metrics` (stars/forks/issues) and broken empty `repo-card-footer` stub
- `demos/06-macro-recovery/original-card.tsx` — complete `RepoCard` at commit `a3f8b12` with intact `repo-card-metrics` and full `repo-card-footer` action bar (Star / Fork / Watch / View on GitHub)

---

## Demo 7: Autonomous Swarm Clean-up — One call, full project sweep, health score from 43 to 91

**Time:** ~3 minutes
**Complexity:** Low
**Impressiveness:** Extreme

### Setup
- MCP server running with `demos/` as the working root
- No files need to be open — the impact is the numbers

### Steps

1. **Establish the before state.** Call:
   ```
   flint_debt_report
     glob: "demos/**/*.tsx"
     format: "markdown"
     track: true
   ```
   Show the health score (expect approximately 43–55), grade (D or C), and the per-file violation breakdown. Say: "Six fixture files, four of them have violations. Health score 43. Grade D."

2. **Launch the swarm.** Call:
   ```
   flint_swarm_audit_fix
     glob: "demos/**/*.tsx"
     autoFix: true
     projectRoot: "<absolute path to demos/>"
   ```

3. **Watch the report come back.** Read the summary aloud:
   ```
   filesScanned:         6
   filesWithViolations:  4
   fixesApplied:        12
   healthBefore:        43
   healthAfter:         91
   ```
   Say: "No individual tool calls. No per-file instructions. One prompt."

4. **Show the `fileReports` array.** Each file has a `before` and `after` entry showing the specific violations fixed. Show `drift-component.tsx` going from 5 violations to 0.

5. **Re-run the debt report.** Call `flint_debt_report` again with `track: true`. Health score is now 91. Say: "And because we passed `track: true`, this snapshot is appended to `.flint/debt-history.json`. You can chart this in CI."

### What to highlight
- `flint_swarm_audit_fix` is a single registered MCP tool — not a macro, not a script, one call
- The swarm applies the same Mithril + A11y engine that runs per-file, but in parallel across the glob
- `track: true` enables trend tracking — you can gate PRs on health score regressions

### Fixture
- All six existing demo fixtures (`broken-layout.tsx`, `buggy-component.tsx`, `drift-component.tsx`, `violating-ux.tsx`, `legacy-divs.tsx`, `corrupted-card.tsx`) — combined violation count sufficient to produce a score in the D range before the sweep

---

## Demo 8: Remote Component Library — Add any GitHub library with one tool call

**Time:** ~3 minutes
**Complexity:** Low
**Impressiveness:** High

### Setup
- Start with an empty or minimal component registry (no entries for "button")
- MCP server running; network access available

### Steps

1. **Show the empty registry.** Call:
   ```
   flint_query_registry
     semantic_query: "primary action button"
     projectRoot: "<absolute path to project root>"
     limit: 3
   ```
   Response: `results: [], message: "No matching components found."` Say: "Empty registry. Nothing to RAG against."

2. **Add a remote library.** Call:
   ```
   flint_add_remote_library
     url: "https://raw.githubusercontent.com/<org>/<repo>/main/flint-manifest.json"
     projectRoot: "<absolute path to project root>"
   ```

3. **Show the ingestion result.** Response:
   ```json
   {
     "added": 12,
     "libraryName": "Acme Design System",
     "components": ["Button", "Card", "Stack", "TextField", "Badge", ...]
   }
   ```
   Say: "No git clone. No npm install. Flint fetched the raw manifest, validated it, and indexed all 12 components into the `sqlite-vec` store. Available immediately."

4. **Re-run the registry query.** Same call as step 1. Now returns `Button` with its full TypeScript prop interface, import path, and usage example from the Shadow Storybook artifact.

5. **Show the RAG vector.** Say: "That query matched `primary action button` to `Button` via cosine similarity on the component's description embedding. It didn't match on the string `button` — it matched on the meaning."

### What to highlight
- The `flint-manifest.json` format is the standard Flint registry contract — any team can publish one alongside their component library
- The fetch is fully offline after ingestion — no runtime network dependency
- The same RAG mechanism powers `flint_query_registry`, `hydrate_figma_data`, and the AI orchestrator's component selection — adding one library enriches all three

### Fixture
- No dedicated fixture file; the demo starts from an empty registry state and uses a live remote manifest URL. The `demos/design-tokens.json` token set is used for token compliance checks on any injected components.

---

## Demo 9: Cross-File Multi-AST Drop — Drag-and-drop component composition on the infinite canvas

**Time:** ~3 minutes
**Complexity:** Med
**Impressiveness:** Extreme

### Setup
- Flint Glass running (`unset ELECTRON_RUN_AS_NODE && npm run dev`)
- At least two `.tsx` files loaded in the workspace tree (visible in the left panel FileExplorer)
- Canvas showing the active file's LivePreview node

### Steps

1. **Show the starting state.** Two files visible in the left panel. Active file is open on the canvas. Say: "The left panel shows the file tree. The canvas shows a live preview of the active component. There is no terminal. There is no code editor. This is a read-only observability layer — but it can trigger mutations."

2. **Drag a file onto the canvas.** Grab a `.tsx` file from the FileExplorer left panel and drag it onto the canvas drop zone. A blue ring appears on the canvas as the drag enters the drop target. Say: "The blue ring is the drop affordance. Flint is telling you it knows what to do with this file."

3. **Release the drag.** Flint:
   - Parses the dropped file's AST (via `astBufferStore`)
   - Identifies the top-level exported component
   - Emits an `inject` mutation to the active file
   - Synthesizes the import statement

4. **Open the active file in the IDE.** The cloned component reference is there, import synthesized at the top of the file. Say: "Flint wrote an import and injected a JSX reference. It knew the component's name and export type from the AST — no guessing, no template string."

5. **Hit Cmd+Z.** The clone is removed from the active file. The source file is untouched. Say: "Undo removes exactly the node that was injected. `historyStore` tracked the inverse operation. The source file was never modified — this was always a one-way copy."

### What to highlight
- This crosses the Glass/MCP process boundary: the drag gesture in the Electron renderer triggers an IPC call to the main process, which calls `flint_ast_mutate` via the bidirectional action flint (`mcpClient.ts`)
- Import synthesis (`ASTService.synthesizeImports`) merges the new import without duplicating existing ones, regardless of the import style used in the file
- Cross-file undo (Phase H) tracks the inverse at the `historyStore` level — undoing in the active file does not require touching the source file

### Fixture
- No dedicated fixture directory for demo 9; use any two `.tsx` files in the workspace. The demo works with the existing demo fixtures or a live project. The key props are: one file visible in FileExplorer, one file active on the canvas.

---

*Last updated: 2026-03-19*
