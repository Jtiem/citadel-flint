# Flint Smoke Test Checklist

**Date:** 2026-03-20
**Tester:** _______________
**Build:** `npm run dev` from `feat/token-optimization` branch

Use this checklist to verify every major feature path works end-to-end.
Mark each item PASS / FAIL / SKIP with notes.

---

## 1. First Launch Experience (5 min)

### 1.1 Flint Glass starts
- [ ] Run `npm run dev` from the Flint root folder
- [ ] Flint Glass window opens (dark UI, Flint logo in header)
- [ ] No crash, no white screen
- [ ] Console shows: "Ingestion server listening on http://127.0.0.1:4545"
- [ ] Console shows: "Auto-scratchpad created at ~/Flint Projects/Untitled" (first launch only)

### 1.2 JTBD Onboarding screen
- [ ] You see "What brings you to Flint?" with three cards
- [ ] Each card shows: title, description, "You'll need" line, numbered steps
- [ ] **Prototype from Figma** — description mentions Figma file + component library
- [ ] **Connect my design system** — description mentions auto-detect stack
- [ ] **Audit existing code** — description mentions 50 WCAG rules
- [ ] Recent projects appear at the bottom (if any exist)
- [ ] Clicking a recent project opens it (no error)

---

## 2. Path A: Audit Existing Code (10 min)

### 2.1 Choose the audit-test project
- [ ] Click "Audit existing code"
- [ ] You see "Which folder should Flint audit?" with bullet list of what Flint will do
- [ ] Click "Choose folder"
- [ ] Navigate to `~/Documents/audit-test` and select it
- [ ] Progress spinner appears: "Setting up your project..."
- [ ] Flint opens the 3-panel layout (layers, canvas, properties)

### 2.2 Verify project loaded
- [ ] Left panel shows file tree with `src/components/ui/` folder
- [ ] StatusBar at bottom shows Flint engine indicator
- [ ] No "MCP server is not connected" errors in console

### 2.3 Open a component
- [ ] Click on `AlertDialog.tsx` in the file tree
- [ ] LivePreview shows a rendered preview (may be partial — that's OK)
- [ ] No crash or blank iframe

### 2.4 Run audit from Claude Code
- [ ] Switch to Claude Code (VS Code terminal)
- [ ] Run: `/audit src/components/ui/AlertDialog.tsx`
- [ ] You see the Flint Governance Report in chat (not just a collapsed tool block)
- [ ] Report shows: BLOCKED verdict, dashboard table, Design System Violations table, Accessibility Violations table
- [ ] "What's Next" section shows natural language prompts ("Say fix it")
- [ ] Violation count matches expected: ~4 Mithril + ~3 A11y

### 2.5 Run audit on the full library
- [ ] Run audit on each component, verify:
  - `Button.tsx` → APPROVED (uses CSS variable classes, no hardcoded values)
  - `Badge.tsx` → APPROVED
  - `Card.tsx` → BLOCKED (hardcoded line-height, heading skip)
  - `Input.tsx` → BLOCKED (hardcoded colors, missing label)
  - `AlertDialog.tsx` → BLOCKED (hardcoded colors, heading skip, no landmarks)
  - `DataTable.tsx` → BLOCKED (hardcoded color, no table caption, no keyboard on th)

---

## 3. Path B: Connect Design System (10 min)

### 3.1 Start the connect flow
- [ ] Restart Flint Glass (quit and `npm run dev`)
- [ ] Click "Connect my design system"
- [ ] You see "Where is your codebase?" with bullet list
- [ ] Click "Choose folder"
- [ ] Navigate to `~/Documents/audit-test` and select it

### 3.2 Verify flint init ran
- [ ] Check that `~/Documents/audit-test/.flint/design-tokens.json` exists and has tokens
- [ ] Check that `~/Documents/audit-test/flint-manifest.json` exists and has component entries
- [ ] Flint opens the 3-panel layout

### 3.3 Check the Governance Dashboard
- [ ] Click the "health" tab in the right sidebar
- [ ] Health score ring shows a letter grade (A-F)
- [ ] Top violated rules list appears
- [ ] "Delta Mode" badge does NOT appear (no baseline set yet)

### 3.4 Set a baseline
- [ ] Click "Set Baseline" button at bottom of health tab
- [ ] "Delta Mode" badge appears with tooltip on hover
- [ ] Hover tooltip says: "only new violations since the baseline are counted"

---

## 4. Path C: Prototype from Figma (15 min)

### 4.1 Start the prototype flow
- [ ] Restart Flint Glass
- [ ] Click "Prototype from Figma"
- [ ] You see "Connect your Figma file" with numbered instruction list
- [ ] Instruction list mentions: install plugin, enter endpoint, sync variables, export selection

### 4.2 Build and install the Figma plugin
- [ ] Open a terminal and run: `cd ~/Lunar-Elevator-Flint/figma-plugin && npm run build`
- [ ] Build completes without errors (produces `code.js`)
- [ ] Open Figma → Plugins → Development → Import plugin from manifest
- [ ] Navigate to `~/Lunar-Elevator-Flint/figma-plugin/manifest.json`
- [ ] Plugin appears in the plugin list as "Flint Link" (or similar)

### 4.3 Connect plugin to Flint
- [ ] In Flint Glass, note the endpoint shown (should be `127.0.0.1:4545`)
- [ ] Note the secret shown (or find it in the console log)
- [ ] In Figma, open the Flint plugin
- [ ] Paste the endpoint and secret into the plugin settings
- [ ] Plugin shows "Connected" state

### 4.4 Sync Variables
- [ ] In the Figma plugin, click "Sync Variables"
- [ ] Flint console shows: token ingestion messages
- [ ] Check `~/Documents/audit-test/.flint/design-tokens.json` — token count should increase

### 4.5 Export a component
- [ ] In Figma, select a component instance (e.g., a Button)
- [ ] In the plugin, click "Export Selection"
- [ ] Flint console shows: `/ingest-ast: payload dispatched to renderer`
- [ ] Flint console shows: `FIGMA-MAP: persisted N component ID mapping(s)` (if component is an instance)
- [ ] LivePreview updates with the exported component

### 4.6 Audit the exported component

- [ ] Run `/audit` on the generated file
- [ ] Verify Mithril catches any hardcoded values from Figma
- [ ] Verify A11y catches any missing accessibility attributes

---

## 5. StatusBar & Panels (5 min)

### 5.1 StatusBar indicators
- [ ] Export gate shows "Blocked" or "Ready" depending on violations
- [ ] Figma indicator shows connection status
- [ ] If no tokens: amber "No design system" dot appears
- [ ] Hover on "No design system" shows helpful tooltip (not just "Connect Figma")

### 5.2 Activity Feed
- [ ] Click "activity" tab in right sidebar
- [ ] If no actions yet: shows "No activity yet — Audits, fixes, imports..." (NOT "MCP tool calls")
- [ ] After running an audit: activity entries appear

### 5.3 Governance Panel
- [ ] Click the gear/rules icon to open Governance Panel
- [ ] Rules list shows with enable/disable toggles
- [ ] Planned rules show "In development" badge (NOT "Coming soon")
- [ ] Hover on "In development" shows tooltip about future enforcement

---

## 6. Ghost Overlay & Violation Tooltip (5 min)

### 6.1 Ghost overlay on a violated component
- [ ] Open a component with hardcoded values (e.g., `Card.tsx`)
- [ ] Ghost overlay highlights hardcoded classes
- [ ] Where no token match exists: text says "no matching token — add this value to your design tokens" (NOT just "no token match")

### 6.2 Violation tooltip
- [ ] Hover over a violation badge on the canvas
- [ ] Tooltip shows violation details
- [ ] For color drift: shows "ΔE 5.2 (limit: 2.0) — noticeably different" (NOT just "ΔE 5.2")

---

## 7. Export Modal (3 min)

### 7.1 Blocked export
- [ ] Open a component with violations
- [ ] Try to export (Cmd+E or File → Export)
- [ ] Export Modal shows BLOCKED state
- [ ] If property overrides exist: shows explanation "Values you manually changed that differ from the design system"
- [ ] Mithril violations listed with severity

### 7.2 Clean export
- [ ] Open `Button.tsx` (which passes audit)
- [ ] Try to export
- [ ] Export Modal shows PASS state with source preview

---

## 8. Recovery Panel (3 min)

### 8.1 Time Machine
- [ ] Open the Recovery Panel (clock icon or menu)
- [ ] If no file is open: shows empty state
- [ ] If no node is selected: shows "Select a component in the canvas to restore from a previous version" (NOT "Select a layer to transplant")
- [ ] Git history entries appear if the file has commits

---

## 9. Agent Dashboard (2 min)

### 9.1 Agent risk view
- [ ] Click "agents" tab in right sidebar
- [ ] Header shows "Agent Risk Dashboard"
- [ ] Help text below header explains: "Risk scores are based on mutation patterns, override frequency, and error rates"

---

## 10. Keyboard Shortcuts (2 min)

- [ ] `Cmd+O` — Opens folder picker
- [ ] `Cmd+Z` — Undo works on last mutation
- [ ] `Cmd+Shift+Z` — Redo works
- [ ] `Cmd+E` — Opens Export Modal

---

## 11. shadcn/ui Library Test (5 min)

### 11.1 Audit well-structured components
- [ ] Run audit on `~/Documents/flint-audit-shadcn/src/components/ui/button.tsx`
- [ ] Result: APPROVED (uses CSS variables, no hardcoded values)
- [ ] Run audit on `~/Documents/flint-audit-shadcn/src/components/ui/dialog.tsx`
- [ ] Result: APPROVED

### 11.2 Compare with hand-rolled components
- [ ] Run audit on `~/Documents/audit-test/src/components/ui/AlertDialog.tsx`
- [ ] Result: BLOCKED (hardcoded values, missing accessibility)
- [ ] The contrast between the two libraries demonstrates Flint's value

---

## Results Summary

| Section | Tests | Pass | Fail | Skip |
|---------|-------|------|------|------|
| 1. First Launch | 7 | | | |
| 2. Audit Path | 11 | | | |
| 3. Connect Path | 6 | | | |
| 4. Figma Path | 10 | | | |
| 5. StatusBar & Panels | 7 | | | |
| 6. Ghost & Tooltip | 4 | | | |
| 7. Export Modal | 4 | | | |
| 8. Recovery Panel | 3 | | | |
| 9. Agent Dashboard | 2 | | | |
| 10. Keyboard Shortcuts | 4 | | | |
| 11. shadcn Comparison | 4 | | | |
| **Total** | **62** | | | |

### Notes
_Write any issues, unexpected behavior, or ideas here:_

---

### Blockers Found
_List anything that prevents shipping:_

---

### Follow-up Items
_Non-blocking improvements noticed during testing:_
