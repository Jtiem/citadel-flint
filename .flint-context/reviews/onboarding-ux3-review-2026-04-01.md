# Onboarding UX Review: Four Entry Paths into Flint
**Date:** 2026-04-01  
**Reviewer:** UX Analysis Agent (Reviewer 3)  
**Scope:** Figma, Folder, Repo/Git, IDE Chat entry paths

---

## EXECUTIVE SUMMARY

**Strongest Path:** Folder → Flint (A-)  
**Weakest Path:** Repo/Git → Flint (D+)  
**Critical Missing Piece:** No unified entry decision tree — users don't know which surface (IDE vs. Glass) to use for what, or which path to take first.

---

## PATH GRADES

| Path | Discoverability | Friction | Completeness | Overall |
|------|-----------------|----------|--------------|---------|
| A: Figma First | C | High | B | **C+** |
| B: Folder First | A- | Low | A | **A-** |
| C: Repo/Git First | D | High | C | **D+** |
| D: IDE Chat First | C- | High | B- | **C** |

---

## PATH A: FIGMA FIRST — C+

### Discoverability: C
- Figma connection is **not a primary entry point on LaunchScreen** — only accessible post-project-open via StatusBar
- FigmaSetupWizard is a 3-step flow (check → configure → wait) but assumes loopback server is running; error cases buried in collapsed "Troubleshooting" section
- No "Connect Figma" button alongside "Open My Project" on the launch screen

### Key Friction Points
1. User must open a project first, then hunt for Figma connection — backwards from expected flow
2. Token sync requires two separate UIs: FigmaSetupWizard + FigmaConnectionPanel
3. No guidance on when to pull vs. push on first sync
4. Post-sync guidance missing — user doesn't know what to do in Glass after tokens arrive

---

## PATH B: FOLDER FIRST — A-

### Discoverability: A-
- "Open My Project" is the second primary CTA on LaunchScreen — high contrast, clear
- Health grades (A-F) visible on recent project tiles before reopening
- Auto-detection of framework/tokens works via DetectionBanner

### Key Friction Points
1. Auto-detection is async with 500ms timeout — if MCP is slow, banner doesn't appear
2. No "scan this project" CTA at launch; users must wait or manually trigger
3. Git context detection is silent — users don't see what repos are tracked

### Completeness: A
- Environment detection (framework, CSS, TypeScript, tokens) works
- Audit summary fed into DetectionBanner
- Scan progress bar with file counts
- Health grades persist

---

## PATH C: REPO/GIT FIRST — D+

### Discoverability: D
- No git-specific onboarding — git repos treated identically to plain folders
- gitManager.ensureRepo() is called silently (electron/main.ts lines ~467, 1514) with no UI indicator
- Git utilities exposed via MCP tools (ast:git-show, ast:git-log) but users don't know they exist
- No Rewind UI in Glass — commit history not surfaced

### Key Friction Points
1. Shadow commits are silent — users don't know mutations are tracked in git
2. No branch selector — can't compare governance state across branches
3. No git-aware governance ("audit all files changed in this PR")
4. Rewind feature exists in code (recoveryController) but has no Glass UI surface

---

## PATH D: IDE CHAT FIRST — C

### Discoverability: C-
- MCP tools callable from Claude Code/Cursor but setup requires SetupWizard
- Tool response is text-only JSON — users can't click to view violations in Glass
- No "open in Glass" link after an IDE audit
- Users don't learn Glass capabilities until they explicitly open it

### Key Friction Points
1. No "continue in Glass" button after IDE audit
2. MCP response doesn't mention Glass or when to use it
3. No documentation on IDE vs. Glass decision: "When should I use each?"
4. VS Code extension has diagnostics/quick-fix but Claude Code chat doesn't

---

## TOP 5 FINDINGS

1. **Figma path is hidden** — Not on LaunchScreen; only accessible post-project-open via StatusBar. Blocks the Figma→Flint journey before it starts.

2. **Git context completely invisible** — Users open a repo, git history is tracked, Rewind works in theory — but zero UI surfaces this. StatusBar shows MCP status but not git status.

3. **IDE chat → Glass handoff is missing** — After auditing in IDE chat, users have no path to Glass. MCP responses should include "For batch fixes and visual review, open Flint Glass."

4. **Auto-detect timing causes missed feedback** — Folder-first path async detection can leave users staring at a blank canvas. No "Scanning 200 files..." progress state.

5. **No "which surface?" guidance** — Users don't understand when to use IDE tools vs. Glass. Need a simple decision tree: quick one-file audit → IDE chat; full dashboard → Glass; batch visual fixes → Glass; git history → Glass.

---

## RECOMMENDATIONS

**HIGH PRIORITY**
- Add "Connect Figma" as primary option on LaunchScreen
- Add "Open in Glass" to MCP tool responses
- Show Git status in StatusBar (detected / N commits)

**MEDIUM PRIORITY**
- Implement Rewind UI in Glass right panel
- Add "What path am I on?" tooltip to each screen
- Document IDE-first workflow

**LOW PRIORITY**
- Auto-open Glass after first Figma sync
- Add async progress state to Folder scan
- Branch selector for Git path
