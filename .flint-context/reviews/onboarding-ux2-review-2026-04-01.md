# Flint Glass → IDE UX Bridge Audit
**Deep Review: Visual-to-Headless Handoff Friction**

**Reviewer:** UX Specialist (Design System Integrity Focus)  
**Date:** 2026-04-01  
**Scope:** All Glass-to-IDE handoff paths and disconnected-state UX

---

## CRITICAL FINDINGS

### 1. **MISSING: "Go Fix in IDE" Single-Threaded Flow After Violation Detection**

**Problem:** When Glass detects a violation (Mithril drift, a11y failure), there is **no single, obvious CTA that launches the user back to their IDE to fix it**.

**Evidence:**
- **GovernanceDashboard.tsx** (lines 1-400): Displays violations with granular fix guidance (color drift → nearest token, a11y-001 → alt attributes), but has **no "Fix in IDE" button**. The dashboard is read-only observability.
- **ExportModal.tsx** (line 183-185): Contains `handleSelectNode()` which **snap-selects the violating node on the canvas** but does NOT send the user to their IDE editor. The modal is export-gate only, not violation-fix entry.
- **StatusBar.tsx** (line 132-140): Shows `gateLabel` ("Design Drift Issues" / "Unapplied Style Changes") but the badge is **non-interactive**. No "Open in Editor" link.
- **OnboardingOverlay.tsx** (line 42-44): Step 3 teaches: *"Use the chat in your IDE (Claude Code, Cursor, or VS Code) to ask Flint to audit, fix, or generate components."* This is the **intended handoff path — but it's undocumented in Glass itself**. No affordance guides a user *how* to send a violation from Glass back to chat.

**Impact:**
- A user sees "3 Color Drift Issues" in Glass, reads the fix guide in GovernanceDashboard, but has **no affordance to pass that context to their IDE chat** without manually re-opening their editor, navigating to the file, and re-typing the issue.
- **Handoff Quality: F** — Requires manual re-context instead of frictionless pass-through.

**Grade:** **Clarity: C | Completeness: D | Friction: F | Handoff Quality: F**

---

### 2. **SEVERE: No Guidance for MCP Setup in Glass**

**Problem:** MCP is the backbone of the Glass↔IDE bridge, but Glass provides **zero help for first-time MCP setup**. Users are left to infer the connection themselves.

**Evidence:**
- **SetupWizard.tsx** (entire file): This is the only MCP setup UI. It has 3 steps: detect IDE, show MCP server snippet, write config. **But SetupWizard is only triggered by "Connect to IDE" button on LaunchScreen** (line 620-627 in LaunchScreen.tsx).
- **Trigger Path:** LaunchScreen → "Connect to IDE" button → SetupWizard modal. **This requires the user to navigate to LaunchScreen first** — if they're already viewing a project on the canvas, there's no obvious way to reach Setup.
- **StatusBar.tsx** (line 84-91): Has a `onConnectIDE` callback prop, but **the StatusBar doesn't render a "Setup MCP" button**. Only the CommandPalette (CommandPalette.tsx line 290) has "Reconnect IDE / Setup" as a fallback action.
- **OnboardingOverlay.tsx** Step 3 (line 43): "Use the chat in your IDE… Flint has full context of your open file and selected node." This **assumes MCP is already installed** with zero setup guidance in the overlay.

**Impact:**
- A first-time user sees Glass, reads "Talk to Flint" step, and has **no idea how to install the MCP server or configure their IDE**.
- The only path is: notice Glass is disconnected → search for "setup" → find CommandPalette → "Reconnect IDE / Setup" → follow SetupWizard. **Requires active help-seeking, not discovery**.
- **Completeness: D** — MCP setup is hidden behind multiple layers of UI.

**Grade:** **Clarity: C | Completeness: D | Friction: C | Handoff Quality: D**

---

### 3. **MAJOR: Disconnected State UX is Unclear**

**Problem:** When the MCP server is not running, Glass shows **minimal feedback about what's wrong or how to fix it**.

**Evidence:**
- **StatusBar.tsx** (line 145-156): Polls `window.flintAPI.mcp?.status()` every 5 seconds. When `connected === false`, the status shows `mcpConnected: false`. **But there's no UI element rendering this state to the user**.
- **LaunchScreen.tsx** (line 324-340): Shows a green "MCP connected" badge when `mcpConnected === true`, but **no amber/red badge when false**. If MCP is disconnected, the LaunchScreen is silently broken.
- **CommandPalette.tsx** (line 136-142): When MCP is not connected, trying to call a tool shows: `'MCP not connected: Start the Flint MCP server and try again'`. **This is the only helpful error message in the codebase** — but it only appears after the user tries an action.
- **ComponentSearch.tsx** (line 126): When `callTool` fails, shows "Search unavailable" but **does not explain why** (MCP down? server crashed? credentials?).

**Impact:**
- A user opens Glass, sees no violations, tries to audit a component → ComponentSearch shows "Search unavailable" with zero context.
- No indication in the StatusBar or top-level UI that MCP is disconnected.
- **Friction: D** — Requires trial-and-error debugging to discover the root cause.

**Grade:** **Clarity: D | Completeness: C | Friction: D | Handoff Quality: C**

---

### 4. **CRITICAL: No File Identity Mapping Between Glass and IDE**

**Problem:** Glass shows `activeFilePath` and selected nodes with `data-flint-id`, but **there's no UI explaining how the IDE's open file maps to Glass's active file**. If a user selects a node in Glass and switches to their IDE, they don't know which file to look in.

**Evidence:**
- **useContextSync.ts** (line 100): Writes `activeFilePath` to `.flint/context.json`, which the MCP server reads via `flint_get_context`.
- **StatusBar.tsx** (line 96-104): Shows the `activeFilePath` in the export gate context, but **the path is never displayed to the user**. It's only used for internal state.
- **electron/main.ts** (lines 39-72): `activeProjectRoot` and `setProjectRoot()` manage the active project, but **no UI in Glass displays which project or file is "active"**.
- **IDE.2 Sync** (flint-vscode extension): Writes `ide-active-file.json` so Glass can detect when the user switches files in their editor. But **Glass provides zero UI feedback** to confirm "I see you just switched to UserAvatar.tsx — I'm syncing that file now."

**Impact:**
- User selects a button component in Glass's canvas, wants to fix it in their IDE. The `data-flint-id` is unique but **Glass doesn't tell them the file path or line number**. They must manually find the file.
- Glass polls `ide-active-file.json` to follow IDE file switches, but **provides no visual feedback**. The user has no way to confirm Glass is synchronized.
- **Clarity: F** — File mapping is invisible.

**Grade:** **Clarity: F | Completeness: C | Friction: F | Handoff Quality: D**

---

### 5. **MAJOR: Export Gate "Pass" → Silence (No Next Step Guidance)**

**Problem:** After ExportModal shows "Export Ready" (all violations cleared), the modal closes with **zero guidance** on what to do next.

**Evidence:**
- **ExportModal.tsx** (line 52-300): When `canExport === true`, renders:
  - Green shield: "Export Ready"
  - Raw source code copy button
  - Compliance summary (JSON)
  - **No "Next Steps" section**
  - **No "Commit to Git" button**
  - **No "Deploy to Production" link**
  - **No "View in Browser" button**
- **StatusBar.tsx** (line 132-140): Shows green "Export Ready" but **does not open or focus the export modal**. User must manually trigger export.
- **OnboardingOverlay.tsx** (line 30-46): Never mentions export or the post-export workflow.

**Impact:**
- User fixes all violations, exports successfully, sees green shield, modal closes. **Then what?** Do they commit? Deploy? The glass is silent.
- The export is **the success milestone**, but there's no "ship it" moment or guidance.
- **Completeness: D** — Happy path ends abruptly.

**Grade:** **Clarity: D | Completeness: D | Friction: B | Handoff Quality: C**

---

## EVIDENCE TABLE

| Finding | File | Lines | Severity | Root Cause |
|---------|------|-------|----------|-----------|
| No "Go Fix in IDE" after violation | GovernanceDashboard.tsx | 1-400 | CRITICAL | Read-only observability; no action CTA |
| Violation context doesn't flow to IDE | OnboardingOverlay.tsx | 42-44 | CRITICAL | Tutorial assumes MCP setup; no in-UI affordance |
| MCP setup hidden behind "Connect to IDE" | SetupWizard.tsx | entire | MAJOR | SetupWizard only reachable from LaunchScreen button |
| No MCP disconnected badge in StatusBar | StatusBar.tsx | 145-156 | MAJOR | mcpConnected state polled but not rendered |
| Search failures don't explain MCP down | ComponentSearch.tsx | 126 | MAJOR | Error messages lack root-cause context |
| File mapping invisible to user | electron/main.ts | 39-72 | CRITICAL | activeFilePath written to context.json; zero UI display |
| ide-active-file.json sync has no visual feedback | flint-vscode extension | — | MAJOR | Polling happens silently; no "syncing" indicator |
| Export "Ready" → no next-step guidance | ExportModal.tsx | 52-300 | MAJOR | Modal closes after success; zero post-export CTA |
| No file path / line number display in Glass | StatusBar.tsx | 96-104 | CRITICAL | activeFilePath is internal-only state |

---

## GRADES (By Dimension)

### **Clarity** (User understands what's happening)
- **C** (Barely adequate) — Glass shows tech state (MCP connected, export ready) but lacks plain-English guidance for *why* or *what next*
- **Issues:** Jargon "Mithril," "design drift," "sync" without first-time context

### **Completeness** (All steps of the flow are documented)
- **D** (Incomplete) — MCP setup is discoverable but hidden. File mapping is invisible. Post-export is silent.
- **Missing:** File identity mapping, post-export workflow, MCP-down recovery steps

### **Friction** (Ease of crossing the bridge)
- **D** (High friction) — Users must:
  - Manually re-discover their IDE after seeing violations
  - Trial-and-error to detect MCP disconnection
  - Guess at the file-to-node mapping
  - Infer next steps after successful export

### **Handoff Quality** (Seamlessness of Glass↔IDE transition)
- **D** (Fragmented) — No single-click "fix in IDE" flow. No context pass-through. No file sync feedback.

---

## TOP 5 CRITICAL FINDINGS (In Priority Order)

### **1. No "Fix in IDE" Affordance After Violation Detection (F)**
Glass detects violations but forces users to manually switch to IDE and re-contextualize the issue in chat. Expected: 1-click "Send to IDE Chat" button in GovernanceDashboard.

### **2. File Identity Invisible to User (F)**
Glass tracks `activeFilePath` and `data-flint-id` internally but never displays them to the user. A user cannot tell which file Glass is viewing or where their selected node lives in the editor.

### **3. MCP Setup Buried Behind "Connect to IDE" Button (D)**
MCP is the critical bridge infrastructure, but setup is only discoverable via LaunchScreen button or CommandPalette fallback. New users will not find it without external help.

### **4. Disconnected State Has No Visual Indicator (D)**
StatusBar polls MCP status every 5s but does not render a visual badge. ComponentSearch silently fails with "Search unavailable" instead of "MCP server not running."

### **5. Export "Pass" Has No Next Step (D)**
After successful export, the modal closes with zero guidance on commit, deploy, or review. The post-export workflow is completely undocumented in Glass.

---

## RECOMMENDATIONS (Priority Order)

### **Immediate (P0)**
1. **Add "Send to IDE" button in GovernanceDashboard** — Click → copies violation context + file path + line number to clipboard, user pastes in IDE chat
2. **Display activeFilePath + selectedNode line number in StatusBar** — Show "UserButton.tsx:42" so user knows exactly what Glass is viewing
3. **Add MCP status badge to StatusBar** — Green dot when connected, red/amber when down, with tooltip "MCP Server not running — Click to setup"

### **High (P1)**
4. **Refactor SetupWizard trigger** — Add "Setup MCP" option to CommandPalette + StatusBar context menu, not just LaunchScreen button
5. **Add visual feedback for ide-active-file.json sync** — Show brief "Syncing UserButton.tsx from editor…" toast when file switch detected
6. **Export "Ready" → "Deploy Now" workflow** — Add post-export section with Git commit template, deploy checklist, or browser preview link

### **Medium (P2)**
7. **Clarify terminology in OnboardingOverlay** — Replace "Mithril" with "design system enforcement," add MCP setup link to Step 3
8. **Enhanced error messages for MCP failures** — "MCP Server not running (port 4545). Try: Click 'Setup MCP' in StatusBar" instead of generic "Search unavailable"
9. **Add a "Sync Status" panel in StatusBar** — Show last IDE file sync timestamp, MCP connection uptime, pending context updates

---

## OVERALL GRADE

**Handoff Architecture: B- (Technically sound, UX friction high)**

| Dimension | Grade | Notes |
|-----------|-------|-------|
| **Clarity** | C | Jargon-heavy; lacks first-time context |
| **Completeness** | D | MCP setup hidden; file mapping invisible; post-export silent |
| **Friction** | D | Requires manual re-contextualization; no visual sync feedback |
| **Handoff Quality** | D | No single-click Glass→IDE flow; context must be manually re-entered |

**Summary:** Flint's Glass↔IDE bridge is **architecturally sound** (useContextSync → .flint/context.json → flint_get_context works correctly). But the **UX of crossing the bridge is fragmented**. A user cannot:
1. Click "Fix in IDE" from a violation
2. See which file Glass is viewing
3. Know if MCP is running
4. Understand what to do after exporting

**Recommendation:** Prioritize P0 fixes (visible affordances) before adding advanced features. The bridge will carry 10x more traffic once users can *see* and *navigate* it.

---

**Session End:** 2026-04-01 / Reviewer Sign-Off

