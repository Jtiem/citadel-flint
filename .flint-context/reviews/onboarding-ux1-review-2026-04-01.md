# Flint Onboarding UX Audit — 2026-04-01
## New-User Project Creation Experience

**Review Date:** 2026-04-01  
**Focus:** First-launch experience, entry paths, friction points, onboarding sequence  
**Reviewer:** UX Audit Agent  
**Confidence:** High (code-driven analysis)

---

## Executive Summary

Flint's new-user onboarding is **fragmented and confusing**. The app sends first-time users directly into a demo with no explanation of what Flint does, no clear path to "real work," and **no entry path for users who want to start with their own code immediately**. The Figma connection flow is hidden, and the folder-opening UX is underdeveloped. Most critically: **the empty state does not explain why Flint matters or what a user should do next.**

---

## 1. Entry Paths — What Actually Works?

### What Exists:
1. **Demo auto-load (first launch only)** — `handleLoadDemo` (line 337–354)
   - Auto-loads "a11y-audit" demo on first launch, no explanation
   - Skipped if `--project` flag or URL param present
   - Falls through silently if it fails (line 639)

2. **"Try Flint" demo picker** (LaunchScreen.tsx:357–413)
   - Shows when user clicks the Play icon
   - 4 scenarios hardcoded: a11y-audit, token-drift, design-system-migration, multi-component-app
   - Each has a 2–8 min estimate and description
   - **Is functional** ✓

3. **"Open My Project" folder picker** (LaunchScreen.tsx:416–430)
   - Single click → native file dialog (Electron) or text input (web mode)
   - Calls `onOpenFolder()` → `handleOpenFolder()` (App.tsx:267–277)
   - **Is functional** ✓

4. **"Audit a Folder" link** (LaunchScreen.tsx:501–515)
   - Same as "Open My Project"
   - Text link, subtle positioning below main CTAs
   - **Confusing:** what's the difference between "Open" and "Audit"?

5. **Recent projects** (LaunchScreen.tsx:518–587)
   - Fetches from registry, shows up to 5 with health grades
   - Calls `onOpenRecent()`
   - **Is functional** ✓

6. **"Connect to IDE" button** (LaunchScreen.tsx:620–629)
   - Opens SetupWizard modal
   - For IDE/MCP configuration, not project creation
   - **Correct placement** ✓

7. **Empty state quick-picker** (LaunchScreen.tsx:465–497)
   - Shows "Or try a demo" when no recent projects exist
   - 3 buttons: E-commerce UI, Design System, Mobile App
   - **Problem:** `onDemoSelect` callback is defined in props but **never wired up in App.tsx**
   - Lines 71 in LaunchScreen.tsx define the prop, but grep shows no handler in App.tsx
   - **Dead end** ✗

### Missing Entirely:
- **Figma setup as an entry path.** LaunchScreen has no "Connect Figma to start" CTA. FigmaSetupWizard exists but is only reachable from StatusBar (inside an opened project).
- **"Create new project from template"** — no scaffolding beyond scratchpad
- **"Start from Figma file" URL** — no deep linking
- **Blank canvas with inline guidance** — users land in demo, no "skip to blank canvas" option

---

## 2. First-Launch Render Sequence

### Current Flow:
1. **App mounts** (App.tsx:88)
2. **setupComplete === null** — render nothing (line 749)
3. **useEffect fires** (line 605–655)
   - Calls `checkFirstLaunch()`
   - If first launch + no `--project` flag:
     - Auto-loads demo: `loadDemoProject('a11y-audit')`
     - Calls `hydrateWorkspace()` → opens demo into canvas
     - Sets `demoAutoLoaded = true`
4. **setSetupComplete(true)** — triggers re-render
5. **if (!workspaceFiles)** (line 782) — **FALSE** (demo loaded), skip LaunchScreen
6. **Render full canvas** with DemoWalkthrough overlay (line 1127–1145)

### What the User Sees:
1. **Splash screen** (custom app icon/logo, varies by OS) — ~1–2 seconds
2. **Black screen** (setupComplete === null rendering nothing) — ~0.5 seconds
3. **Full canvas** with:
   - DemoWalkthrough tooltip: "Welcome to Glass" (Step 0, line 37–46)
   - Demo form component in the center
   - Governance dashboard on the right showing 8 violations
   - OnboardingOverlay: "Your Canvas" / "Inspect & Edit" / "Talk to Flint" (if `flint-onboarding-complete` localStorage not set)

### Time to "Something Feels Like Flint":
- **≈3–5 seconds** of blank screen before the demo appears
- **Step 1:** "These are drift items" tooltip (line 48–54)
- **Step 2:** "Click Fix to resolve them" (line 56–62)
- **Step 3:** "The gate clears" (line 64–70)
- **Step 4:** "Nice work! Ready to try on your own code?" (line 162–219) — first conversion CTA

**Total onboarding steps before leaving demo: 5 (0–4)**

---

## 3. Landing State After Project Creation

### Demo Project Path:
1. User sees DemoWalkthrough Step 0: "Welcome to Glass"
2. Steps 1–3 are violation-focused ("These are drift items")
3. Step 4 (handoff) shows: "Nice work! Ready to try on your own code?"
   - CTA: "Open My Project" → triggers `onProjectHandoff?.()` (line 193)
   - **onProjectHandoff is NOT DEFINED in App.tsx**
   - Component renders but nothing happens on click ✗
   - OR: "Try Another Demo" → loops back to Step 0
   - OR: "Keep Exploring" → dismisses, user left in demo

### Folder/Recent Project Path:
1. User clicks "Open My Project" or recent project
2. Direct to canvas with the user's code
3. If no tokens: DetectionBanner shows stack (React, Tailwind, etc.)
   - Scan progress bar (if isScanning)
   - "No design tokens detected — connect Figma to get started" (line 201–215)
4. If tokens exist: "Looking clean! Export when ready." (line 180–192)

### Blank State:
- **User is NOT in a blank state.** 
- They either see demo code or their own code.
- No "start from scratch with prompts" flow.

---

## 4. Step Count: Blank Code → First Win

### Demo Path:
1. App auto-loads demo ← automatic
2. DemoWalkthrough Step 0: acknowledge "Welcome to Glass" ← 1 click
3. Step 1: read "These are drift items" → Next ← 1 click
4. Step 2: read "Click Fix to resolve them" → Next ← 1 click
5. Step 3: read "The gate clears" → Next ← 1 click
6. Step 4 (Handoff): read "Ready to try on your own code?" 
   - **Try Another Demo** → loops back to Step 0
   - OR **Open My Project** → fires onProjectHandoff (no-op) ← 1 click (dead end)
   - OR **Keep Exploring** → dismisses walkthrough

**Can the user actually FIX a violation in the demo?**
- Yes: Governance Dashboard shows "Fix All" button
- DemoWalkthrough Step 2 says "Click Fix to resolve them"
- But the user must CLOSE the walkthrough first or ignore it
- Then click "Fix All" button somewhere on the governance panel

**Reality: ~5 clicks minimum to dismiss walkthroughs, then discover "Fix All"**

### Folder Path:
1. Click "Open My Project" ← 1 click
2. Folder picker dialog appears → Select folder ← 1 more interaction
3. Project loads, DetectionBanner appears showing stack + scan progress
4. If violations exist: see "A few issues to address — try 'fix it'" (line 165–177)
   - Click "Run auto-fix" button ← 1 click
5. Violations auto-remediate, "Looking clean! Export when ready." ← first win

**Reality: ~3–4 interactions (folder picker, then fix button)**

---

## 5. Figma vs. Folder: No Clear Value Prop

### What LaunchScreen Shows:
- "Try Flint" — Play icon, demo picker ← no mention of Figma
- "Open My Project" — Folder icon, text picker ← no mention of Figma
- "Audit a Folder" — text link ← no mention of Figma
- "Connect to IDE" — Link icon, opens SetupWizard ← IDE setup, not Figma

### Figma Setup Location:
- **NOT on LaunchScreen**
- Reachable from StatusBar (line 1029) when project is open
- Also on SetupWizard step 2 (mcp-snippet) — WAIT, SetupWizard is for IDE/MCP config (SetupWizard.tsx:21, line 128–166)
- **FigmaSetupWizard is separate** (FigmaSetupWizard.tsx:25–49)
  - Has `visible`, `onClose`, `contextualMode`, `projectName` props
  - Shows 3-step flow: Verify server, Configure plugin endpoint, Wait for sync
  - **But it's never imported in App.tsx**

### Missing CTA:
- LaunchScreen should show: "Connect your design system (Figma) and code in one place"
- Or: "Design tokens power Flint — connect Figma now" (DetectionBanner does this, line 201–215)
- Or: At minimum, OnboardingOverlay should mention "Sync variables from Figma" (currently it says "Talk to Flint" — no mention of Figma)

**Grade: F — Figma is invisible to new users**

---

## 6. Demo Scenario Picker: No-Op Status

### Code Path:
1. LaunchScreen defines `onDemoSelect` prop (line 71)
2. Empty state shows 3 buttons: E-commerce, Design System, Mobile (line 471–495)
3. Each button fires `onDemoSelect('ecommerce' | 'design-system' | 'mobile')`
4. App.tsx receives this callback but **does not define a handler**

### Result:
```javascript
// LaunchScreen.tsx:471–495
<button onClick={() => onDemoSelect('ecommerce')} />  // ← onDemoSelect passed in props
```

```javascript
// App.tsx:785–792
<LaunchScreen
  onOpenFolder={() => handleOpenFolder()}
  onNewProject={() => handleNewProject()}
  onOpenRecent={(p) => handleOpenRecent(p)}
  onLoadDemo={(demoName) => handleLoadDemo(demoName)}
  onConnectIDE={() => setShowSetupWizardModal(true)}
  demoError={demoLoadError ?? undefined}
  // ← onDemoSelect NOT PROVIDED
/>
```

**Result: Silent no-op.** User clicks button, nothing happens. No error, no visual feedback.

**Grade: D — Dead code path, confusing UX**

---

## 7. Dead Ends & Confusing States

### Dead End #1: Handoff from Demo
- DemoWalkthrough Step 4 shows "Open My Project" button (line 188–197)
- Calls `onProjectHandoff?.()` (line 193)
- **Not wired in App.tsx**
- User expects to skip demo and open a real project, but nothing happens

### Dead End #2: Empty State Demo Buttons
- Shows "E-commerce UI", "Design System", "Mobile App" (line 471–495)
- Clicks are no-ops
- User confused: are these templates? Are they playable?

### Dead End #3: "Audit a Folder" vs. "Open My Project"
- Both do the same thing (open folder picker)
- Subtle wording difference confuses intent
- "Audit" suggests read-only; "Open" suggests editing

### Confusing State #1: Multiple Onboarding Overlays
- DemoWalkthrough (5 steps, Step 4 = handoff)
- OnboardingOverlay (3 steps, shown once on first project open)
- SetupWizard (5 steps, shown as non-blocking modal)
- All visible at once in some paths, layered confusingly

### Confusing State #2: No Clear "You're Done" Signal
- Export Gate closes when violations = 0, but user must know to look
- DetectionBanner says "Looking clean! Export when ready." — subtle
- No celebration, no "congrats" moment, no next step

---

## 8. Missing vs. Existing Features

### What a Typical Design Tool Has on First Run:
- **Blank canvas with template picker** ← ✗ Flint has demo only
- **"Start a new X"** (project, file, team) ← ✓ "Open My Project", ✓ scratchpad (hidden in menu)
- **"Import from Y"** (Figma, Sketch, code) ← ✗ Figma import is hidden
- **Tutorial/guided tour with skip** ← ✓ DemoWalkthrough, but only in demo
- **Contextual help ("What is X?")** ← ✗ Missing; no tooltips explaining Flint's value
- **Settings on first run** (team, workspace, preferences) ← ✓ SetupWizard, but IDE-only
- **Search/command palette** ← ✓ CommandPalette exists (line 54)
- **Sample projects** ← ✓ 4 demo scenarios (line 76–105), but empty-state picker is broken

### What Flint Offers:
- ✓ Demo walkthrough (but confusing path to own code)
- ✓ Recent projects (but not scaffolded)
- ✓ Folder opening (works, but minimal UX)
- ✓ Health grades for projects (nice touch)
- ✓ Auto-fix suggestions (detected via environment, shown in DetectionBanner)
- ✓ MCP integration (SetupWizard, but non-blocking)

---

## Grades

### Clarity: **D**
- Entry paths are unclear: "Try Flint" vs. "Open My Project" vs. "Audit a Folder"
- No value prop on first launch: why should I use this?
- Figma connection is invisible
- Demo scenario picker buttons don't explain what they'll do
- Multiple onboarding overlays layered (DemoWalkthrough + OnboardingOverlay + SetupWizard modal)

### Completeness: **C**
- Core paths exist (demo, folder, recent projects) ✓
- Figma setup path is broken/hidden ✗
- No scaffolding/template picker ✗
- No "blank canvas" entry point ✗
- Demo scenario picker is a no-op ✗
- Handoff from demo is a no-op ✗
- Missing: "Start from Figma URL" or "Paste code & audit" entry point

### Friction: **D+**
- Auto-load demo is nice (1 interaction)
- But forces users into a specific workflow (violations → fix)
- Folder picker is standard (1 interaction)
- But no guidance after opening (DetectionBanner helps, but very subtle)
- 5 clicks minimum to dismiss overlays, then another click to actually fix something
- Figma connection buried, invisible

### Delight: **C-**
- Demo walkthrough is charming (friendly tone, illustrations implied in body text)
- Health grades are a nice touch (color-coded A–F)
- "Fix All" button is intuitive
- But: no celebration/success state, no "you're awesome" moment
- Missing: delightful moments showing Flint's power (e.g., "Fixed 12 violations in 2 seconds")
- Empty state should be inviting, but it's just a plain list of buttons

---

## Top 5 Findings (Plain English)

### 1. First-Time Users Land in a Demo With No Escape Hatch
**Grade: F for Clarity**

When you launch Flint for the first time, the app automatically loads a demo form with governance violations already visible. You're shown a 5-step walkthrough telling you about "the canvas," "drift items," and "fix buttons." But there's nowhere to go from there — the "Open My Project" button in the final walkthrough step does nothing. You're stuck either trying another demo or manually navigating back to the launch screen. This is confusing because the app hasn't told you what Flint does or why you should care.

**What's missing:** A clear next step. The demo should end with an easy path to your own code, or a simple explanation of why Flint matters (e.g., "Flint catches design token violations and auto-fixes them").

---

### 2. Figma Connection is Invisible to New Users
**Grade: F for Completeness**

Flint's biggest feature — pulling design tokens from Figma and using them to govern your code — is completely hidden on the launch screen. The word "Figma" never appears. A user who wants to start by connecting their design system has to: (1) open a project, (2) find the StatusBar, (3) hunt for a button to connect Figma. This is backwards. Figma should be an obvious first-run option, like "Connect Your Design System" or "Sync Tokens from Figma."

**What's missing:** A "Connect Figma to start" CTA on the launch screen or in the empty state.

---

### 3. The Empty-State Demo Buttons Are Broken
**Grade: D for Friction**

When you have no recent projects, the launch screen shows three tempting buttons: "E-commerce UI," "Design System," and "Mobile App." They look clickable. But clicking them does nothing — they're wired to a callback that was never implemented in the main app. Users see these buttons, click them, and nothing happens. No error message, no feedback, just silence. This creates confusion and the feeling that the app is broken.

**What's missing:** Either wire up the callback to load a template, or remove the buttons entirely to avoid false affordance.

---

### 4. There's No Way to Start From Scratch
**Grade: D for Completeness**

Every entry point either opens an existing project or loads a demo. There's no "create a blank project" button on the launch screen. You have to: (1) click "Open My Project," (2) navigate to an empty folder, or (3) use the File menu's "New Project" (which is hidden). A typical tool would offer "New Project" or "Blank Canvas" as a primary CTA. This is a missed opportunity for users who want to start fresh.

**What's missing:** A "Create New Project" button on the launch screen that scaffolds a blank folder with basic structure (index.tsx, tokens.json, package.json).

---

### 5. Onboarding Overlays Are Layered and Confusing
**Grade: C- for Delight**

When you first open a real project, three different onboarding systems can trigger: DemoWalkthrough (if in demo), OnboardingOverlay (3-step canvas tutorial), and SetupWizard modal (IDE/MCP config). These are z-indexed on top of each other, all trying to explain different things, and none of them celebrate your first win (running an auto-fix or fixing a violation). A new user sees so many "lessons" that they give up before reaching the "congratulations, you fixed 12 violations" moment. The UX should have a clear linear path: Show value → Celebrate → Explain next step.

**What's missing:** A unified onboarding flow that ends with a success state and a clear next action (e.g., "Great! You've fixed 8 violations. Now connect Figma to enforce your design tokens automatically.").

---

## Recommendations (High Priority)

1. **Fix the handoff from demo.** Wire `onProjectHandoff` in App.tsx so users can actually leave the demo.
2. **Implement empty-state demo picker.** Wire the "E-commerce," "Design System," "Mobile App" buttons to load actual templates or remove them.
3. **Add Figma as a first-run entry path.** Show "Connect Figma" as a primary CTA on launch screen or in the handoff modal.
4. **Create a "New Project" button.** Let users start blank without navigating the file system.
5. **Consolidate onboarding.** Merge DemoWalkthrough + OnboardingOverlay into a single, linear flow that ends with a success celebration.
6. **Add contextual help.** "What is Flint?" tooltip, "Why connect Figma?" inline explanations, "What's a token drift?" definitions.
7. **Polish the empty state.** Make it inviting, not just a list of buttons. Add a sentence: "Flint enforces your design system automatically. Pick a demo or start with your own code."

---

## Conclusion

Flint's onboarding is **functional but confusing**. Core paths (demo, folder, recent projects) work, but they're poorly signposted and full of dead ends. The demo is great for understanding violations and fixes, but the handoff to "real work" is broken. Most critically, there's no clear explanation of Flint's value — a new user doesn't know what problem Flint solves or why they should use it. The app would benefit from a more linear first-run experience that leads users naturally from "understanding Flint" to "using it on their own code" to "connecting Figma to enforce their design system."

