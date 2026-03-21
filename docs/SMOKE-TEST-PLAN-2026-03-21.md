# Flint Smoke Test — March 21, 2026

Your job: walk through Flint like a first-time user and mark what works, what's broken, and what feels wrong. I handle the terminal stuff.

---

## Before you start

Ask me to "prep for smoke test." I'll reset the demo files, rebuild the engine, and confirm everything is green. You don't need to do anything until I say "ready."

If you've already closed VS Code since our last session, just open the Flint project folder in VS Code and start a new Claude Code conversation. I'll be here.

---

## Phase 1: Do the new slash commands work? (10 min)

You're in Claude Code (the chat panel in VS Code). Type these commands one at a time.

### See what's available

Type: `/flint`

- [ ] You see a clean reference card with commands grouped into **Inspect**, **Fix**, and **Ship**
- [ ] There are about 10 commands total — not a wall of 100+
- [ ] Nothing looks like infrastructure jargon (no "swarm-orchestration", no "sparc:batch-executor")

### Check that Flint is alive

Type: `/status`

- [ ] You get a response (not an error)
- [ ] It mentions your project folder

### Audit a component

Type: `/audit demos/01-rag-ui-builder/banner-compliant.tsx`

- [ ] You see a governance report right in the chat — not a tiny collapsed "tool result" line
- [ ] The report says **BLOCKED** at the top
- [ ] There's a table of Design System violations and a table of Accessibility violations
- [ ] At the bottom, it tells you what to do next in plain English (something like "say `/fix ...` to remediate")

### Fix a component

Type: `/fix demos/03-mithril-shadow-audit/drift-component.tsx`

- [ ] It first shows you a preview of what it plans to change (dry run)
- [ ] It asks if you want to apply the fixes
- [ ] Say yes — fixes apply
- [ ] It automatically re-audits and shows the improvement

### Sweep a folder

Type: `/sweep demos/**/*.tsx`

- [ ] Multiple files get audited and fixed in one pass
- [ ] You see a summary: how many files scanned, how many violations fixed, health score before/after

### Health report

Type: `/report demos/**/*.tsx`

- [ ] Health score (a number 0-100)
- [ ] Letter grade (A through F)
- [ ] Top violated rules and files listed

### Search the registry

Type: `/query announcement banner`

- [ ] Either matching components appear, or it says "no matching components" — both are fine for now

### Bill of Materials

Type: `/dbom demos/**/*.tsx`

- [ ] You see a structured inventory: tokens, components, violations

### After this phase

Tell me "reset demos." I'll put the fixture files back to their original state for the next phases.

---

## Phase 2: Does Flint Glass open? (10 min)

Tell me "launch Flint." I'll start it from the terminal.

### The window

- [ ] A dark-themed window opens with the Flint logo in the header
- [ ] No blank white screen
- [ ] No crash

### The onboarding screen

You should see "What brings you to Flint?" with three cards:

- [ ] **Prototype from Figma** — mentions needing a Figma file and component library
- [ ] **Connect my design system** — mentions auto-detecting your stack
- [ ] **Audit existing code** — mentions 50 WCAG accessibility rules
- [ ] Each card has: a title, a short description, a "You'll need" line, and numbered steps
- [ ] If you've opened projects before, recent projects appear at the bottom

**What to look for:** Do the cards feel clear? Does a first-time user know which one to pick? Is any card's description confusing or too technical?

---

## Phase 3: Audit an existing project (10 min)

### Open a project

- [ ] Click **"Audit existing code"**
- [ ] You see "Which folder should Flint audit?" with a list of what Flint will do
- [ ] Click **"Choose folder"**
- [ ] Navigate to **Documents > audit-test** and select it
- [ ] A progress spinner appears: "Setting up your project..."
- [ ] Flint opens the 3-panel layout (layers on the left, canvas in the middle, properties on the right)

### Check the layout

- [ ] The left panel shows files — you should see a `src/components/ui/` folder with 6 files
- [ ] The bottom bar (StatusBar) shows a Flint engine indicator
- [ ] Nothing looks broken or empty

### Open a component

- [ ] Click **AlertDialog.tsx** in the left panel
- [ ] The center canvas shows a rendered preview of the component
- [ ] The preview might be partial (that's OK) — it should NOT be a blank white box

### Audit from Claude Code

Switch to the Claude Code chat panel and type:

`/audit src/components/ui/AlertDialog.tsx`

(Flint should figure out you mean the audit-test project's version of this file)

- [ ] **BLOCKED** verdict
- [ ] Dashboard with violation counts
- [ ] Design System violations table
- [ ] Accessibility violations table
- [ ] "What's Next" section with plain-English guidance
- [ ] Roughly 4 design system + 3 accessibility violations

### Audit the whole library

Run `/audit` on each file. Here's what to expect:

| File | Should say |
|------|-----------|
| Button.tsx | **APPROVED** — clean, uses design tokens |
| Badge.tsx | **APPROVED** |
| Card.tsx | **BLOCKED** — hardcoded line-height, heading level skip |
| Input.tsx | **BLOCKED** — hardcoded colors, missing label |
| AlertDialog.tsx | **BLOCKED** — hardcoded colors, heading skip |
| DataTable.tsx | **BLOCKED** — hardcoded color, no table caption |

If a result doesn't match this table, note which file and what was different.

---

## Phase 4: Connect a design system (10 min)

### Start fresh
Tell me "restart Glass." I'll close and relaunch it.

### Connect flow

- [ ] Click **"Connect my design system"**
- [ ] You see "Where is your codebase?" with a description of what Flint will do
- [ ] Click **"Choose folder"** → navigate to **Documents > audit-test** → select it
- [ ] Flint opens the 3-panel layout

### Governance Dashboard

- [ ] Click the **"health"** tab in the right sidebar
- [ ] You see a circular health score ring with a letter grade inside (A through F)
- [ ] Below it: a list of the top violated rules
- [ ] There should NOT be a "Delta Mode" badge yet (you haven't set a baseline)

### Set a baseline

- [ ] Find and click **"Set Baseline"** at the bottom of the health tab
- [ ] A **"Delta Mode"** badge appears
- [ ] Hover over it — tooltip should say something like "only new violations since the baseline are counted"

---

## Phase 5: Figma plugin (15 min) — SKIP if Figma isn't open

If you don't have Figma open with a file that has components, skip this entire phase. It's not on the critical path.

### Install the plugin

- [ ] Open Figma
- [ ] Go to **Plugins > Development > Import plugin from manifest**
- [ ] Navigate to the Flint project folder > **figma-plugin** > select **manifest.json**
- [ ] The plugin appears in your plugin list

### Connect to Flint

- [ ] In Flint Glass, note the endpoint shown (should be `127.0.0.1:4545`)
- [ ] Find the connection secret (it's shown in the Flint Glass onboarding instructions for this path, or in the console — ask me if you can't find it)
- [ ] Open the Flint plugin in Figma
- [ ] Enter the endpoint and secret
- [ ] Plugin shows **"Connected"**

### Sync variables

- [ ] In the Figma plugin, click **"Sync Variables"**
- [ ] Wait a few seconds
- [ ] The sync should complete without errors

### Export a component

- [ ] In Figma, select a component instance (any button, card, etc.)
- [ ] In the plugin, click **"Export Selection"**
- [ ] In Flint Glass, the LivePreview should update to show the exported component

### Audit the export

- [ ] Switch to Claude Code and run `/audit` on whatever file was generated
- [ ] Flint should catch hardcoded values that came from Figma
- [ ] Flint should flag missing accessibility attributes

---

## Phase 6: Look at every panel (10 min)

Walk through each part of the Flint Glass UI. You're checking that nothing is broken, empty when it shouldn't be, or confusing.

### StatusBar (bottom of the window)

- [ ] Export gate indicator: shows "Blocked" or "Ready" depending on whether the current file has violations
- [ ] Figma indicator: shows connection status
- [ ] If no design tokens are loaded: you see an amber dot with "No design system" — hover it for a tooltip

**What to look for:** Is the StatusBar helpful at a glance? Can you tell the health of your project from it?

### Activity Feed

- [ ] Click the **"activity"** tab in the right sidebar
- [ ] If you haven't done anything yet: shows an empty state message like "No activity yet — Audits, fixes, imports..."
- [ ] After running an audit (from Phase 3): activity entries should appear

**What to look for:** Does the empty state message make sense to a new user? After an audit, are the entries readable?

### Governance Panel

- [ ] Click the gear/rules icon to open the Governance Panel
- [ ] You see a list of rules with on/off toggles
- [ ] Some rules show an **"In development"** badge
- [ ] Hover that badge — does the tooltip explain what it means?

**What to look for:** Is it clear what turning a rule off does? Is "In development" the right label?

### Ghost Overlay

- [ ] Open a component with violations (e.g., Card.tsx)
- [ ] Ghost overlay should highlight hardcoded CSS classes in the code
- [ ] Where no design token matches: text says **"no matching token — add this value to your design tokens"**

### Violation Tooltip

- [ ] Hover over a violation badge on the canvas
- [ ] For color drift: tooltip says something like **"ΔE 5.2 (limit: 2.0) — noticeably different"**

**What to look for:** Does "ΔE 5.2" mean anything to a designer who doesn't know color science? Should we add more context?

### Agent Dashboard

- [ ] Click the **"agents"** tab in the right sidebar
- [ ] Header says "Agent Risk Dashboard"
- [ ] Explanatory text below describes what risk scores mean

**What to look for:** Is this panel useful to you? Or is it developer-facing noise?

---

## Phase 7: Export Gate (5 min)

### Blocked export

- [ ] Open a component that has violations (e.g., AlertDialog.tsx)
- [ ] Press **Cmd+E** (or File > Export)
- [ ] Export Modal appears in a **BLOCKED** state
- [ ] If there are property overrides: explains "Values you manually changed that differ from the design system"
- [ ] Lists the specific violations

### Clean export

- [ ] Open **Button.tsx** (which passes audit)
- [ ] Press **Cmd+E**
- [ ] Export Modal shows **PASS** with a source code preview

**What to look for:** Is the blocked state scary or helpful? Does the user know what to do to get unblocked?

---

## Phase 8: Recovery & Shortcuts (5 min)

### Recovery Panel

- [ ] Click the clock icon (or find Recovery Panel in the menu)
- [ ] With no file open: shows an empty state
- [ ] With a file open but no node selected: says "Select a component in the canvas to restore from a previous version"
- [ ] If the file has version history: shows commit entries

### Keyboard shortcuts

- [ ] **Cmd+Z** — undo the last change
- [ ] **Cmd+Shift+Z** — redo
- [ ] **Cmd+O** — opens the folder picker
- [ ] **Cmd+E** — opens the Export Modal

---

## Phase 9: shadcn comparison (5 min)

This is the "why Flint matters" demo. You're comparing a well-built component library against a hand-rolled one.

Switch to Claude Code:

Type: `/audit ~/Documents/flint-audit-shadcn/src/components/ui/button.tsx`
- [ ] Result: **APPROVED** — clean, uses CSS variables, no violations

Type: `/audit ~/Documents/flint-audit-shadcn/src/components/ui/dialog.tsx`
- [ ] Result: **APPROVED**

Type: `/audit ~/Documents/audit-test/src/components/ui/AlertDialog.tsx`
- [ ] Result: **BLOCKED** — hardcoded values, missing accessibility

**What to look for:** Is the contrast clear? Would a stakeholder watching over your shoulder understand why one passes and the other doesn't?

---

## Phase 10: Demo dry run (15 min, optional)

If you have time and want to rehearse the live demo, tell me "reset demos and walk me through the demo script." I'll reset the fixtures and we'll go through it together.

---

## After testing

Tell me:
1. What passed
2. What broke (describe what you saw — I'll diagnose)
3. What felt wrong even if it technically worked (confusing labels, unclear states, dead-end flows)

I'll fix the broken things and file the UX issues.

---

## If something goes wrong

| What you see | What to do |
|-------------|-----------|
| Flint Glass window is blank/white | Tell me "Glass is blank" — I'll check the build |
| A slash command gives an error | Tell me which command and paste the error |
| "Connection refused" or "MCP not connected" | Tell me "Flint isn't connecting" — I'll check the server |
| LivePreview shows a blank iframe | Tell me "preview is blank" — I'll check the renderer |
| Figma plugin won't connect | Tell me "Figma can't connect" — I'll check the port and secret |
| Anything else weird | Screenshot it and describe what you expected vs. what happened |

You don't need to debug anything. That's my job.
