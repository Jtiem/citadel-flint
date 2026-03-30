# Project Initiation Implementation Plan — "The Forge"

**Date:** 2026-03-29
**Status:** PROPOSED
**Depends on:** PROJECT-INITIATION-STRATEGY.md
**Citadel Name:** Forge

---

## Overview

This plan transforms the LaunchScreen from an 8-channel decision tree into a focused 3-path experience backed by smart project detection. Work is organized into 4 sprints, each shipping a usable increment.

---

## Sprint FORGE.1 — Simplify + Fix (Reduce Noise)

**Goal:** Reduce the LaunchScreen to 3 paths, fix critical a11y issues, and improve the demo handoff.

### FORGE.1a — Three-Path LaunchScreen

**What:** Redesign LaunchScreen to show only 3 primary paths:
1. "Try Flint" — loads the demo (primary CTA for new users)
2. "Open My Project" — folder picker (primary CTA for returning users)
3. "Audit a Folder" — quick health grade (secondary, text-link style)

**Removes:**
- "New Project" blank scratchpad
- "From Figma" tile (demoted to post-first-value)
- "Governance Dashboard" tile (redundant with MCP banner)
- Expandable inline flow panels
- "More demos" disclosure (collapsed into "Try Flint" scenario picker)

**Adds:**
- Recent projects list with health grades (from last `flint_debt_report`)
- MCP Context Banner promoted to dominant position when active

**Files to touch:**
- `src/components/ui/LaunchScreen.tsx` — major redesign

### FORGE.1b — Demo-to-Project Handoff

**What:** After DemoWalkthrough Step 3 (Gate clears), show a conversion CTA instead of returning to LaunchScreen.

**Flow:**
```
Step 3 done → "Nice work! Ready to try on your own code?"
  [Open My Project]  [Try Another Demo]  [Keep Exploring]
```

**Files to touch:**
- `src/components/ui/DemoWalkthrough.tsx` — add Step 4 (handoff)
- `src/App.tsx` — handle handoff navigation

### FORGE.1c — Workspace Orientation Step

**What:** Add Step 0 to DemoWalkthrough: "Welcome to Glass" pointing at the 3-panel layout.

**Content:** "This is your canvas. Components live here. Governance results appear on the right. Let's see what Flint found."

**Files to touch:**
- `src/components/ui/DemoWalkthrough.tsx` — prepend orientation step

### FORGE.1d — LaunchScreen A11y Fixes (Critical)

**What:** Fix the 10 critical a11y issues in LaunchScreen.

**Fixes:**
1. Focus management when flow panels expand
2. `aria-live` on progress/done transitions
3. Project name in "Open this project" button label
4. Project name in "Remove from recent" button labels
5. `aria-expanded` + `aria-controls` on "More demos" toggle
6. Section label contrast (`text-zinc-600` → `text-zinc-400`)
7. Footer button contrast fix
8. Recent project path contrast fix
9. `aria-label` on web-mode footer input
10. `role="alert"` on web-mode path error

**Files to touch:**
- `src/components/ui/LaunchScreen.tsx`

### FORGE.1e — DemoWalkthrough A11y Fixes (Critical)

**What:** Fix the 6 critical a11y issues in DemoWalkthrough.

**Fixes:**
1. Move focus into dialog on mount
2. Manage focus between step transitions
3. Restore focus on dismiss
4. Add `aria-modal="true"` (or change role to `note` for non-modal)
5. Add `prefers-reduced-motion` check on transitions
6. Add `aria-hidden` to step dots and decorative icons

**Files to touch:**
- `src/components/ui/DemoWalkthrough.tsx`

### FORGE.1f — BetaWelcome + SetupWizard A11y Fixes

**What:** Fix critical a11y issues in BetaWelcome (3) and SetupWizard (4).

**BetaWelcome fixes:**
1. Focus management on arrival
2. Gradient `<h1>` contrast (solid color or ensure lightest point meets 4.5:1)
3. Subtitle contrast fix

**SetupWizard fixes:**
1. Add `role="dialog"` + `aria-labelledby` + `aria-modal`
2. Focus management on step transitions
3. `aria-pressed` on IDE selection buttons
4. Error `aria-live` regions: `polite` → `assertive`

**Files to touch:**
- `src/components/ui/BetaWelcome.tsx`
- `src/components/ui/SetupWizard.tsx`

### FORGE.1g — Gate Transition Announcements

**What:** Add screen reader announcements at every gate transition in the app lifecycle.

**Announces:**
- "Welcome to Flint" when BetaWelcome renders
- "Launch screen" when LaunchScreen renders
- "Demo project loaded" when demo auto-loads
- "Project loaded: [name]" when workspace opens
- "Canvas ready" when the 3-panel layout renders

**Implementation:** `aria-live="polite"` region in App.tsx that updates on gate transitions.

**Files to touch:**
- `src/App.tsx` — add gate announcement region

---

## Sprint FORGE.2 — Smart Open (Detect + Auto-Configure)

**Goal:** Make project open intelligent — detect the environment, auto-configure governance, and run a baseline audit without asking.

### FORGE.2a — Project Environment Detection

**What:** New IPC handler that reads project signals and returns a `ProjectEnvironment` manifest.

**Detects:**
- Framework (React, Vue, Svelte, Next, Nuxt, Angular) from `package.json`
- Component library (shadcn, MUI, PrimeNG, Chakra, Radix) from dependencies + config files
- CSS framework (Tailwind, CSS Modules, styled-components) from config files
- Existing design tokens (`design-tokens.json`, `tokens.json`, Tailwind theme)
- Existing `flint.config.yaml` (skip auto-configure if present)
- Existing lint configs (`.eslintrc*`, `biome.json`)
- Project scale (file count, estimated component count)
- TypeScript configuration (`tsconfig.json`)
- Monorepo markers (`pnpm-workspace.yaml`, `turbo.json`)

**Returns:**
```typescript
interface ProjectEnvironment {
  framework: string | null        // 'react' | 'vue' | 'svelte' | 'next' | ...
  componentLibrary: string | null // 'shadcn' | 'mui' | 'primeng' | ...
  cssFramework: string | null     // 'tailwind' | 'css-modules' | 'styled-components' | ...
  existingTokens: string | null   // path to token file if found
  existingConfig: boolean         // true if flint.config.yaml exists
  existingLintConfig: string[]    // paths to lint configs
  fileCount: number
  tsStrict: boolean
  isMonorepo: boolean
  packageManager: string          // 'npm' | 'pnpm' | 'yarn' | 'bun'
}
```

**Files to touch:**
- `electron/projectDetector.ts` (new — ~200 lines)
- `electron/main.ts` — add `project:detect-environment` IPC handler
- `electron/preload.ts` — expose in API surface

### FORGE.2b — Auto-Configuration from Detection

**What:** When no `flint.config.yaml` exists, generate one from detection results.

**Logic:**
- Framework → select base rule pack preset
- Component library → set library adapter via `flint_set_library`
- CSS framework → configure Mithril visitor strategy
- Existing tokens → pre-populate tokenStore
- Project scale → set complexity routing tier

**Infrastructure:** Reuses existing MCP tools (`flint_set_library`, `flint_set_policy`, `flint_reindex_registry`).

**Files to touch:**
- `electron/projectDetector.ts` — add `autoConfigureProject()` function
- `electron/main.ts` — add `project:auto-configure` IPC handler

### FORGE.2c — Baseline Audit on Open

**What:** After detection and configuration, automatically run a baseline audit and present the health grade.

**Flow:**
1. `flint_reindex_registry` — index components (background)
2. Run Mithril + Warden on all files (streamed progress)
3. Compute health score (0-100, A-F grade)
4. Present results in Glass

**Progress streaming:** New IPC event `project:baseline-progress` emits incremental updates:
- "Scanning components... (47 found)"
- "Running audit... (23/47)"
- "Computing health score..."

**Files to touch:**
- `electron/main.ts` — add `project:run-baseline` IPC handler with progress events
- `electron/preload.ts` — expose progress listener

### FORGE.2d — Detection Banner in Glass

**What:** After Smart Open completes, show a one-line detection banner in the workspace.

**Renders:** "React 19 + Tailwind 4 + shadcn/ui. 89 components. B- health. 23 fixable issues."

**Placement:** Top of canvas area, dismissible, auto-fades after 10 seconds. Clicking "23 fixable issues" opens Governance Dashboard.

**Files to touch:**
- `src/components/ui/DetectionBanner.tsx` (new)
- `src/App.tsx` — mount banner after project open

### FORGE.2e — MCP Banner Promotion

**What:** When MCP Context Banner is active, it takes over the top of LaunchScreen as the primary element.

**Renders:** Full-width card with project name, detected framework, health grade from last audit, and a single "Open in Glass" button. All other LaunchScreen paths are visually subordinated.

**Files to touch:**
- `src/components/ui/LaunchScreen.tsx` — conditional layout when MCP connected

---

## Sprint FORGE.3 — Progressive Unlocks

**Goal:** Move Figma, CI, and IDE integrations to contextual suggestions that appear after first value.

### FORGE.3a — Progressive Integration Suggestions

**What:** After the user has experienced the audit loop on their own code, surface integration suggestions contextually:

| Trigger | Suggestion | Where |
|---------|-----------|-------|
| Tokens detected but no Figma connection | "Connect Figma to sync tokens" | StatusBar popover |
| First export completed | "Add `flint audit` to your CI pipeline" | ExportModal success screen |
| No MCP connection after 3 sessions | "Connect your IDE for live governance" | Command Palette suggestion |
| Manual audit run 3+ times | "Set up auto-audit on save" | Notification toast |

**Infrastructure:** Track suggestion state in localStorage (seen/dismissed/acted).

**Files to touch:**
- `src/hooks/useProgressiveSuggestions.ts` (new)
- `src/components/editor/StatusBar.tsx` — Figma suggestion
- `src/components/ui/ExportModal.tsx` — CI suggestion

### FORGE.3b — Figma Setup as Contextual Flow

**What:** Move Figma setup from LaunchScreen tile to a contextual flow triggered from StatusBar Figma indicator or Command Palette.

**Trigger:** User clicks Figma indicator in StatusBar (which already exists) or types "Connect Figma" in Command Palette.

**Flow:** Same FigmaSetupWizard content, but opened as a modal from within the workspace — not from LaunchScreen. This means the user already has a project open and can see the result of connecting Figma immediately.

**Files to touch:**
- `src/components/ui/LaunchScreen.tsx` — remove Figma tile
- `src/components/ui/CommandPalette.tsx` — add "Connect Figma" action
- `src/components/editor/StatusBar.tsx` — trigger setup from indicator

### FORGE.3c — Demo Scenario Picker

**What:** Replace the hidden "More demos" gallery with a scenario picker inside the "Try Flint" flow.

**Flow:** User clicks "Try Flint" → sees 4 scenario cards (a11y, tokens, migration, full app) with descriptions and time estimates → selects one → demo loads.

**Files to touch:**
- `src/components/ui/LaunchScreen.tsx` — scenario picker within Try Flint flow
- Remove "More demos" toggle and section

---

## Sprint FORGE.4 — Brilliant Moments

**Goal:** Add the proactive, predictive interactions that make the first experience feel intelligent.

### FORGE.4a — "Paste and Audit" Entry Point

**What:** When no project is open, `Cmd+V` with JSX on clipboard opens an instant audit.

**Flow:**
1. Detect JSX in clipboard (starts with `<`, contains JSX syntax)
2. Show confirmation: "Paste this component and audit it?"
3. Create temporary scratch file, parse, run Mithril + Warden
4. Show results inline — violations, health, fix buttons

**Alternative:** A "Paste a Component" text link on LaunchScreen that opens a textarea modal.

**Files to touch:**
- `src/components/ui/PasteAudit.tsx` (new)
- `src/App.tsx` — clipboard detection when no workspace open

### FORGE.4b — Recent Projects with Health Grades

**What:** Recent projects list shows the health grade from the last audit next to each project name.

**Renders:** `my-app (B+)` with color-coded grade badge. "Last audited: 2 days ago" on hover.

**Infrastructure:** Store last health grade in `flint-registry.db` alongside project path.

**Files to touch:**
- `electron/main.ts` — add `healthGrade` column to recent projects query
- `src/components/ui/LaunchScreen.tsx` — render grade badges

### FORGE.4c — Scan Progress Streaming

**What:** Replace the generic "Detecting stack..." spinner with streamed progress.

**Renders:**
- "Found package.json — React 19 + Tailwind 4"
- "Scanning components... 47 found"
- "Running audit... 23/47"
- "Health score: B- (67/100)"

Each line appears incrementally as the backend processes.

**Files to touch:**
- `src/components/ui/LaunchScreen.tsx` — streamed progress display
- Uses `project:baseline-progress` events from FORGE.2c

### FORGE.4d — Smart Recommendations on First Audit

**What:** After the first baseline audit on a real project, show grade-based recommendations (matching the MCP `onboard-project` prompt logic).

**Logic:**
- A/B grade: "Your project is healthy. Set up CI to keep it that way."
- C grade: "23 issues found. Most are auto-fixable. Say 'fix it' in your IDE."
- D/F grade: "Your project needs attention. Start with the top 5 files."

**Files to touch:**
- `src/components/ui/DetectionBanner.tsx` — grade-based recommendation text
- Reuses scoring logic from `flint-mcp/src/prompts/onboard-project.ts`

---

## Sprint Dependency Graph

```
FORGE.1a (3-Path LaunchScreen) ----+
FORGE.1b (Demo Handoff)     ------+---> FORGE.3c (Demo Scenario Picker)
FORGE.1c (Workspace Orientation) --+
FORGE.1d-g (A11y Fixes) ----------+
                                   |
FORGE.2a (Detection) ---------+   |
FORGE.2b (Auto-Configure) ----+---> FORGE.2d (Detection Banner)
FORGE.2c (Baseline Audit) ----+         |
                                        v
FORGE.2e (MCP Banner Promo) -------> FORGE.4b (Recent + Grades)
                                        |
FORGE.3a (Progressive Suggestions)      |
FORGE.3b (Figma as Contextual) --------+
                                        |
FORGE.4a (Paste and Audit)              |
FORGE.4c (Scan Progress) -----------> FORGE.4d (Smart Recommendations)
```

---

## Agent Assignments

| Task | Primary Agent | Why |
|------|--------------|-----|
| FORGE.1a | flint-design-engineer | Major UI redesign |
| FORGE.1b | flint-design-engineer | UI flow change |
| FORGE.1c | flint-design-engineer | UI addition |
| FORGE.1d | flint-accessibility | A11y critical fixes |
| FORGE.1e | flint-accessibility | A11y critical fixes |
| FORGE.1f | flint-accessibility | A11y critical fixes |
| FORGE.1g | flint-accessibility | Gate announcements |
| FORGE.2a | flint-architect (contract) + flint-electron-ipc (impl) | New service + IPC |
| FORGE.2b | flint-electron-ipc + flint-mcp-specialist | Config generation + MCP wiring |
| FORGE.2c | flint-electron-ipc | IPC handler + progress streaming |
| FORGE.2d | flint-design-engineer | UI component |
| FORGE.2e | flint-design-engineer | Conditional layout |
| FORGE.3a | flint-design-engineer + flint-state-architect | Hooks + UI triggers |
| FORGE.3b | flint-design-engineer | UI restructuring |
| FORGE.3c | flint-design-engineer | UI component |
| FORGE.4a | flint-architect (contract) + flint-design-engineer (UI) | New feature |
| FORGE.4b | flint-database + flint-design-engineer | Schema + UI |
| FORGE.4c | flint-design-engineer | Progress UI |
| FORGE.4d | flint-design-engineer | Recommendation logic |

---

## Testing Requirements

| Domain | Test Type | Location |
|--------|-----------|----------|
| ProjectEnvironment detection | Detect React/Vue/Svelte from mock package.json | `electron/__tests__/projectDetector.test.ts` |
| Auto-configuration | Correct config generated per detection | `electron/__tests__/projectDetector.test.ts` |
| Baseline audit | Progress events emitted correctly | `electron/__tests__/baseline.test.ts` |
| LaunchScreen redesign | 3 paths render, MCP banner dominates when active | `src/components/ui/__tests__/LaunchScreen.test.tsx` |
| DemoWalkthrough | Orientation step + handoff step render | `src/components/ui/__tests__/DemoWalkthrough.test.tsx` |
| A11y fixes | All 21 critical issues resolved | `src/components/ui/__tests__/` |
| Detection banner | Shows correct framework + grade + fixable count | `src/components/ui/__tests__/DetectionBanner.test.tsx` |
| Paste and Audit | JSX detection, parse, audit, display | `src/components/ui/__tests__/PasteAudit.test.tsx` |

---

## Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| LaunchScreen paths | 8+ | 3 | Count primary CTAs |
| Time from folder pick to health grade | Never (manual) | <10 seconds | Instrumentation |
| Demo walkthrough completion → own project | No handoff | Handoff CTA exists | Analytics event |
| A11y critical issues in onboarding | 21 | 0 | Re-audit |
| Framework auto-detection | None | React/Vue/Svelte/Next/Angular | Detection tests |
| Questions before first value | Multiple (tile choice, folder, wait) | One (folder pick) | Flow analysis |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Detection reads wrong package.json in monorepo | Incorrect auto-config | Use nearest package.json to selected folder, not root |
| Baseline audit slow on large projects (10K+ files) | Poor first impression | Cap initial audit at top 100 files, show partial results, continue in background |
| Removing "New Project" frustrates users who want a scratchpad | Missing workflow | Add "New Scratchpad" to Command Palette as secondary path |
| Removing Figma from LaunchScreen confuses existing users | Workflow change | Show "Figma moved to StatusBar" tooltip on first visit after redesign |
| Auto-generated config conflicts with user intent | Wrong rule pack active | Always show "Flint auto-configured for React + Tailwind. [Edit config]" with easy override |
