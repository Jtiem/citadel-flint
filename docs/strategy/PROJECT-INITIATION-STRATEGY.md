# Project Initiation Strategy — "The Forge"

**Date:** 2026-03-29
**Status:** PROPOSED
**Author:** 5-agent synthesis (UX Critic, Product Planner, Competitive Researcher, Architect, Accessibility Analyst)
**Citadel Name:** **Forge** — where new projects are ignited, their environment detected, and governance activated

---

## Executive Summary

Flint has 8 simultaneous project initiation channels on one screen. This creates analysis paralysis, not choice. The two highest-conversion channels (demo auto-load, folder audit) either end without a handoff or are buried. Meanwhile, the engine has 54 MCP tools, framework detection capability, and a proven 6-step onboarding prompt — all sitting idle because nothing triggers them when a project opens in Glass.

The gap between "project opened" and "governance active" is entirely manual. No framework detection, no token discovery, no auto-audit. The competitive benchmark (Vercel, Linear, Cursor) is: detect everything, confirm nothing, show value in under 15 seconds.

---

## Table of Contents

1. [The Diagnosis](#1-the-diagnosis)
2. [Channel Inventory](#2-channel-inventory)
3. [Channel Scoring](#3-channel-scoring)
4. [Competitive Benchmark](#4-competitive-benchmark)
5. [Infrastructure Gap](#5-infrastructure-gap)
6. [Accessibility Audit](#6-accessibility-audit)
7. [The Vision: Forge](#7-the-vision-forge)
8. [Channel Strategy](#8-channel-strategy)
9. [Brilliant Moments](#9-brilliant-moments)
10. [What to Remove or Demote](#10-what-to-remove-or-demote)
11. [Open Questions](#11-open-questions)

---

## 1. The Diagnosis

### Three Structural Problems

**1. Eight channels is not choice — it's paralysis.**
The LaunchScreen presents: New Project, From Figma, Connect Codebase, Audit a Folder, Governance Dashboard, Demo Gallery (4 demos), Recent Projects, MCP Context Banner, plus footer links. A first-time user facing 9+ clickable paths scans and dismisses rather than commits. The Feature Budget Framework asks "Is this the 80% use case?" — for a first-time user, only 2 paths matter: try the demo, or open your own project.

**2. The engine sits idle at project open.**
Flint has 54 MCP tools, 64 governance rules, token extraction, library adapters, and config inheritance. None of this activates when a project opens in Glass. The MCP `onboard-project` prompt proves the sequence works (reindex, audit, score, recommend), but Glass completely ignores it. A user opens a folder, sees one file, and wonders what to do next.

**3. "New Project" creates a false expectation.**
A blank scratchpad implies Glass can build something. It cannot — Glass is the observability layer. "New Project" is the most prominent CTA and delivers the least value. A designer clicks it, sees an empty canvas, and leaves.

### The Core Insight

**The violation IS the first value.** Unlike other tools that need the user to create something before showing value, Flint can show value on existing code immediately: "You have 47 drift items and a C+ health grade. I can fix 39 of them right now." No other tool in the competitive landscape can make this claim. The initiation experience should be designed around this insight.

---

## 2. Channel Inventory

### Channel 1: Blank Scratchpad ("New Project")

**Promise:** Start building something new, right now.
**Delivery:** Empty canvas with no content. No scaffold, no tokens, no governance.
**Gap:** Glass is observability — it has nothing to observe. The promise is creative momentum; the delivery is a blank screen.
**Time to first value:** Never reached via this channel.

### Channel 2: Demo Auto-Load (First Launch)

**Promise:** See Flint doing something real, immediately, with no setup.
**Delivery:** a11y-audit demo loads with 8 intentional violations. DemoWalkthrough guides through the fix loop.
**Gap:** After walkthrough ends, the user faces a cold LaunchScreen with no "now try your own code" handoff. The demo is a one-way door.
**Time to first value:** ~30 seconds. Fastest of all channels.

### Channel 3: Open Existing Codebase ("Connect codebase")

**Promise:** Point Flint at your project and see what's wrong.
**Delivery:** OS folder picker, scan, load first `.tsx` file, lint it.
**Gap:** Shows one file, not project health. No baseline audit, no framework detection, no governance recommendation. Silently fails for non-React projects (Vue, Svelte).
**Time to first value:** Slow — depends on having violations in the first file found.

### Channel 4: Figma Import ("From Figma")

**Promise:** Turn a Figma design into governed code in one flow.
**Delivery:** Requires OAuth, plugin install, credential exchange — 6 steps across 2 applications before the user sees anything.
**Gap:** Highest-friction channel. Sends user to generic figma.com/community page (not the actual plugin). The emotional arc is inverted: starts with an amber warning, not excitement.
**Time to first value:** Minutes, if it works at all on first attempt.

### Channel 5: One-Time Folder Audit ("Audit a folder")

**Promise:** Get a health grade for any codebase without committing.
**Delivery:** Folder scan, Mithril + Warden audit, health report.
**Gap:** After audit completes, no conversion moment — no "want to open this project and start fixing?" The clearest value proposition, buried as a low-prominence tile.
**Time to first value:** Fast — folder pick + scan time to see a grade.

### Channel 6: Auto-Resume Last Session

**Promise:** Pick up where you left off.
**Delivery:** Silently reopens last project.
**Gap:** Not a channel — a convenience behavior. Works well for returning users. Risk: reopens demo project if that was the last session.

### Channel 7: MCP Context Banner

**Promise:** Glass recognizes your IDE is connected.
**Delivery:** Banner appears when `.flint/context.json` indicates an active IDE session.
**Gap:** The most architecturally sophisticated channel and the most invisible. Competes with 8 other elements at equal visual weight. Should be the dominant element when it fires.

### Channel 8: Demo Gallery (4 Bundled Demos)

**Promise:** Choose the demo most relevant to your work.
**Delivery:** 4 demos behind a "More demos" toggle, below the fold.
**Gap:** Hidden behind disclosure. No preview cards, no outcome descriptions, no persona targeting. Redundant with Channel 2.

---

## 3. Channel Scoring

### By Persona

| Channel | Designer | Developer | Team Lead | New Evaluator |
|---------|----------|-----------|-----------|---------------|
| Blank Scratchpad | Low | Zero | Zero | Damaging |
| Demo Auto-Load | High | Low | Medium | Highest |
| Open Codebase | High intent, medium delivery | Medium | High intent | Medium |
| Figma Import | High (post-setup) | Zero | Low | Low |
| Folder Audit | Medium | Medium | Highest | High |
| Auto-Resume | All returning | All returning | All returning | N/A |
| MCP Banner | High | High | Medium | Zero |
| Demo Gallery | Medium | Low | Medium | High (if found) |

### Feature Budget Gates

| Channel | Clear Behavior? | 80% Case? | Maintenance | Passes Gates? |
|---------|----------------|-----------|-------------|---------------|
| Blank Scratchpad | No — Glass can't scaffold | 5% | Medium | Fails gate 2 |
| Demo Auto-Load | Yes | 80% for new users | Low | Passes all 6 |
| Open Codebase | Yes | 80% for returning | Medium | Passes all 6 |
| Figma Import | Yes | 5% (requires setup) | High | Fails gate 3 |
| Folder Audit | Yes | 80% for evaluators | Low | Passes 5/6 |
| Auto-Resume | Yes | 80% for returning | Low | Passes all 6 |
| MCP Banner | Yes | 80% when connected | Low | Passes 5/6 |
| Demo Gallery | Weak — hidden | 5% | Low | Fails gate 2 |

### The 80% Paths

| Persona | 80% Path | Current State |
|---------|----------|---------------|
| Designer | Demo → Open own project → See violations → Fix | Demo ends without handoff |
| Developer | MCP onboard prompt in IDE → Baseline audit | Invisible to Glass |
| Team Lead | Folder audit → Health grade → Open and remediate | Buried tile, no conversion moment |
| New Evaluator | Demo → Audit own code → See real grade | Demo and audit are disconnected |

---

## 4. Competitive Benchmark

### Patterns That Make Onboarding Brilliant

| Pattern | Who Does It | What It Means |
|---------|------------|--------------|
| **Show, don't ask** | Linear, Notion | Pre-populate with real content; user learns by interacting with a working example |
| **Detect everything, confirm nothing** | Vercel, Storybook, Cursor | Read package.json, auto-configure. Never ask what the tool can figure out itself |
| **One decision before first value** | Raycast (hotkey), Supabase (name + region) | Every additional question before value is friction that compounds |
| **The result IS the tutorial** | Linear's pre-populated board, Notion's starter page | The first artifact teaches by example |
| **Progressive disclosure, not interrogation** | Cursor's silent indexing, Raycast's extension store | Advanced config is reachable, never required |

### Anti-Patterns

| Anti-Pattern | Example | Why It Hurts |
|--------------|---------|-------------|
| Multi-step wizard with 5+ questions before value | ESLint `--init` | Decisions without context |
| Empty state after setup | Generic IDEs | "I did all that work for nothing" |
| Requiring external accounts before first value | OAuth-gated tools | Breaks flow |
| Showing all features at once | Complex dashboards | Cognitive overload |
| Separate documentation from the product | "Read the docs first" | Context switch kills momentum |

### What Flint Uniquely Can Do

1. **Auto-audit on open.** Read a codebase, run Mithril + Warden, present health score in seconds — without asking.
2. **The violation IS the first value.** Show problems on existing code immediately. "47 issues found, 39 fixable now."
3. **Deterministic fix as the aha moment.** "Fix All" with one click. No other tool in the competitive set can do this.
4. **MCP connection as ambient context.** Like Cursor's silent indexing, but for governance.

### The Gold Standard Flow

```
FIRST LAUNCH (no project):
  Auto-load demo → Health ring shows C+ → 3-step walkthrough
  → Fix All → Gate clears → "Now try your own project" CTA
  Time: ~45 seconds to aha moment

OPEN OWN PROJECT:
  Select folder → Silent detection (framework, library, tokens)
  → Auto-audit (2-3 seconds) → Health dashboard populates
  → "React + Tailwind + 89 components. B- health. 23 fixable."
  → No wizard, no questions, no integration required
  Time: ~10 seconds to first real value

PROGRESSIVE UNLOCKS (later):
  - Figma connection suggested when tokens detected
  - CI integration suggested after first export
  - IDE extension suggested when MCP would help
  - Policy customization in settings, never forced
```

---

## 5. Infrastructure Gap

### What Flint Detects at Project Open Today

Almost nothing. `scanDirectory` walks the tree for `.tsx/.ts/.jsx/.js` files and returns a `FileTreeNode`. That's it.

**Not detected:**
| Signal | How To Detect | What It Enables |
|--------|--------------|-----------------|
| Framework (React, Vue, Svelte, Next, Angular) | `package.json` dependencies | Auto-select rule pack, language adapter |
| Component library (shadcn, MUI, PrimeNG, Chakra) | `package.json` + config files | Auto-set `flint_set_library`, pre-populate mappings |
| CSS framework (Tailwind, CSS Modules, styled-components) | Config files, package.json | Choose Mithril visitor strategy |
| Existing design tokens | `design-tokens.json`, `tokens.json`, `theme.ts`, CSS vars, Tailwind config theme | Pre-populate tokenStore |
| Existing lint configs | `.eslintrc*`, `biome.json` | Avoid duplicate enforcement |
| Project scale | File count, component count | Inform complexity routing (Commandment 8) |
| Existing `flint.config.yaml` | Config-loader (exists but not triggered from Glass) | Skip setup entirely |
| TypeScript strictness | `tsconfig.json` | Calibrate in-memory TSC |
| Monorepo structure | `pnpm-workspace.yaml`, `turbo.json` | Multi-root handling |

### The Gap: "Project Opened" to "Governance Active"

**What happens today (manual steps required):**
1. Create `flint.config.yaml` or accept hidden defaults
2. Import/create design tokens
3. Trigger an audit manually
4. Configure rule packs manually

**What the MCP `onboard-project` prompt does (already proven):**
1. Read project state via `flint_get_context`
2. Check governance policy via `flint_set_policy`
3. Index components via `flint_reindex_registry`
4. Run baseline audit via `flint_debt_report`
5. Present health grade with recommendations
6. Hand off to `flint-workflow-guide`

**Glass does none of this.** The engine and Glass are completely divergent at project open.

### Data Thrown Away at Scan Time

`scanDirectory` filters to `.tsx?/.jsx?` only. Everything else is discarded:
- `package.json` (never read)
- `tailwind.config.*` (not checked)
- `tsconfig.json` (not read)
- `.flint/` directory contents (not inventoried)
- CSS/SCSS/Less files (filtered out)
- Library config files (not checked)
- Monorepo markers (not checked)

### New IPC Needed

| Channel | Purpose | Effort |
|---------|---------|--------|
| `project:detect-environment` | Scan package.json, configs, return `ProjectEnvironment` manifest | ~200 lines |
| `project:auto-configure` | Generate `flint.config.yaml` from detection results | ~150 lines |
| `project:run-baseline` | Trigger reindex + audit + debt score, stream progress | ~100 lines |

Most engine work already exists — the gap is orchestration connective tissue.

---

## 6. Accessibility Audit

### Critical Findings (21)

The first screens a user encounters — BetaWelcome, LaunchScreen, DemoWalkthrough, SetupWizard — have significant accessibility barriers:

**Focus Management (7 critical)**
1. BetaWelcome: No focus movement on arrival, no `role="dialog"`
2. LaunchScreen: Expanded flow panel receives no focus when opened
3. LaunchScreen: Progress/done state transitions invisible to screen readers
4. DemoWalkthrough: Focus not moved into dialog on mount (violates WCAG 2.4.3)
5. DemoWalkthrough: Focus not managed between step transitions
6. DemoWalkthrough: Focus not restored on dismiss
7. SetupWizard: Step transitions drop focus as DOM replaces

**Screen Reader (7 critical)**
8. LaunchScreen: "Open this project" button doesn't identify which project
9. LaunchScreen: "Remove from recent" buttons don't identify which project (N identical labels)
10. LaunchScreen: "More demos" toggle missing `aria-expanded`
11. DemoWalkthrough: `role="dialog"` without `aria-modal` — screen reader can escape
12. SetupWizard: No `role="dialog"` on modal overlay; background not inert
13. SetupWizard: IDE selection buttons have no `aria-pressed` or `role="radio"`
14. Gate hierarchy: No announcements at any gate transition (BetaWelcome → LaunchScreen → Workspace)

**Color Contrast (4 critical)**
15. Gradient `<h1>` text (pink-400 on gray-950): ~3.4:1, below 4.5:1 threshold
16. LaunchScreen section labels (`text-zinc-600` on `bg-zinc-950`): ~2.5:1
17. Footer buttons (`text-zinc-600`): ~2.5:1
18. Recent project paths (`text-zinc-600`): ~2.5:1

**Forms & Errors (3 critical)**
19. LaunchScreen: Web-mode footer path input has no label (A11Y-004)
20. LaunchScreen: Web-mode path error has no `role="alert"`
21. SetupWizard: Error `aria-live` regions use `polite` instead of `assertive`

### Warnings (13)

Decorative icons throughout all 4 components missing `aria-hidden="true"` (Lucide icons: ShieldCheck, Eye, Wrench, ChevronRight, FolderOpen, Clock, ArrowRight, X, CheckCircle, XCircle). SetupWizard's `StepDots` correctly uses `aria-hidden` — the only component that does this right.

DemoWalkthrough has no `prefers-reduced-motion` check on CSS transitions. Step dot progress indicators in DemoWalkthrough have no `aria-hidden`.

### The Demo Auto-Load A11y Gap

The first-launch experience is completely opaque to non-visual users. When the demo auto-loads:
- No announcement of context change
- No focus movement to DemoWalkthrough dialog
- Screen reader user doesn't know what happened or where they are

This is the most critical a11y gap — it's the product's first impression for every user.

---

## 7. The Vision: Forge

### Citadel Name

**Forge** — where new projects are ignited. The Forge detects the raw material (framework, library, tokens), shapes the governance profile, and fires the first audit. You arrive with code; you leave with a health grade.

### The Three-Path LaunchScreen

```
+----------------------------------------------------------+
|  Flint                                                    |
|  Governance for AI-generated UI                          |
+----------------------------------------------------------+
|                                                          |
|  [MCP CONNECTED BANNER — dominates when active]          |
|  "Your IDE project is ready: my-app (React + Tailwind)"  |
|  [Open in Glass]                                         |
|                                                          |
+----------------------------------------------------------+
|                                                          |
|  +------------------+  +------------------+              |
|  | Try Flint        |  | Open My Project  |              |
|  | See governance   |  | Point to your    |              |
|  | in action on a   |  | codebase — Flint |              |
|  | demo project     |  | detects and      |              |
|  | [Start Demo]     |  | audits it        |              |
|  +------------------+  | [Choose Folder]  |              |
|                         +------------------+              |
|                                                          |
|  Audit without opening                                   |
|  Get a health grade on any folder  [Audit a Folder]      |
|                                                          |
+----------------------------------------------------------+
|  Recent Projects                                         |
|  my-app (B+)  |  landing-page (A-)  |  dashboard (C)    |
+----------------------------------------------------------+
```

### Key Principles

1. **Three paths maximum.** Try Flint (demo), Open My Project (folder), Audit a Folder (quick grade). Everything else is demoted or contextual.
2. **MCP banner dominates when connected.** It takes over the top of the screen. It proves the Agentic OS concept in one moment.
3. **Recent projects show health grades.** Not just names — the grade from the last audit. This gives the list immediate governance context.
4. **No blank scratchpad.** Removed. Glass is observability; it needs something to observe.
5. **No Figma on LaunchScreen.** Figma setup is a post-first-value progressive unlock, surfaced from StatusBar or Command Palette.

### The Smart Project Open Flow

```
User selects folder
        |
        v
  +-- project:detect-environment --+
  |  Read package.json             |
  |  Detect framework + library    |
  |  Find existing tokens/config   |
  |  Count components              |  <- 1-2 seconds
  +--------------------------------+
        |
        v
  +-- Auto-configure (if no config) --+
  |  Generate flint.config.yaml       |
  |  Select rule pack preset          |
  |  Set library adapter              |
  +-----------------------------------+
        |
        v
  +-- Baseline audit --+
  |  Reindex registry   |
  |  Run Mithril + Warden  |
  |  Compute health score  |  <- 2-3 seconds
  +---------------------+
        |
        v
  +-- Present results --+
  |  One-line banner:                                      |
  |  "React + Tailwind + shadcn. 89 components. B- health."|
  |  Health ring populates. Top violations shown.          |
  |  "23 issues fixable now — say 'fix it' in your IDE"   |
  +-----------------------------------------------------+
```

**Total time from folder pick to health grade: under 10 seconds.**

### Demo-to-Project Handoff

After DemoWalkthrough completes, instead of dropping to a cold LaunchScreen:

```
Step 3 completes (Gate clears)
        |
        v
  "Nice work! The gate is clear."
  "Ready to try on your own code?"

  [Open My Project]    [Try Another Demo]    [Explore This Demo]
```

This converts demo momentum into action. The handoff is the missing link.

### Workspace Orientation Step

Before DemoWalkthrough points at violations, add Step 0:

```
Step 0: "Welcome to Glass"
  Points to: center canvas area
  Text: "This is your canvas. Components live here.
         Governance results appear on the right.
         Let's see what Flint found."
  [Next →]
```

One step, 5 seconds, prevents spatial confusion for first-time users.

---

## 8. Channel Strategy

### Must Be Brilliant (invest heavily)

| Channel | Why | What Changes |
|---------|-----|-------------|
| **Demo Auto-Load** | Only channel that works for every new user | Add workspace orientation step, fix post-walkthrough handoff, fix all 6 a11y issues |
| **Open Codebase (upgraded to "Smart Open")** | Highest-intent channel for Designer + Team Lead | Add environment detection, auto-configure, auto-audit, one-line banner |

### Must Be Promoted

| Channel | Why | What Changes |
|---------|-----|-------------|
| **Folder Audit** | Clearest value proposition, currently buried | Elevate to equal visual weight with "Open My Project" |
| **MCP Context Banner** | Proves the Agentic OS concept | Make it the dominant element when active, not a small banner |

### Demote or Remove

| Channel | Action | Why |
|---------|--------|-----|
| **Blank Scratchpad** | Remove | Glass can't scaffold; creates false expectation |
| **Figma Import** | Demote to post-first-value progressive unlock | Too much friction for first launch; 6 steps across 2 apps |
| **Demo Gallery** | Collapse into "Try Flint" with scenario picker | Hidden behind disclosure; redundant with auto-load |
| **Governance Dashboard tile** | Remove from LaunchScreen | MCP banner handles the IDE-connected case |

---

## 9. Brilliant Moments

### Brilliant Moment 1 — The Silent Detection Banner

**Trigger:** User opens any folder.
**What Flint does:** In 1-2 seconds, reads `package.json`, detects framework + library + CSS strategy, counts components. Presents a one-line banner: "React 19 + Tailwind 4 + shadcn/ui. 89 components found."
**Why brilliant:** The user never asked for this. Vercel does it for deployment; Flint does it for governance. The detection banner proves Flint understands the project before any manual setup.

### Brilliant Moment 2 — The Instant Health Grade

**Trigger:** Immediately after detection, auto-audit runs.
**What Flint does:** Runs Mithril + Warden across the project. Health ring animates from empty to the grade (A-F). Top 5 violations appear. "23 issues found. 17 auto-fixable."
**Why brilliant:** Under 10 seconds from folder pick to health grade. No questions asked. The user sees real problems in their real code — the most powerful proof of value possible.

### Brilliant Moment 3 — The Demo Handoff

**Trigger:** DemoWalkthrough Step 3 completes (Gate clears).
**What Flint does:** Instead of returning to LaunchScreen, shows: "Ready to try on your own code?" with a single "Open My Project" CTA.
**Why brilliant:** Converts emotional momentum ("that was cool") into productive action ("let me try it on my code"). Currently this moment is wasted — the user hits a dead end.

### Brilliant Moment 4 — The MCP Takeover

**Trigger:** `.flint/context.json` indicates an active IDE session.
**What Flint does:** LaunchScreen transforms. The MCP banner becomes the dominant element: full-width, project name, framework detection, health grade from last audit. "Your IDE project is ready. Open in Glass."
**Why brilliant:** Proves the Agentic OS concept. The user opens Glass and it already knows what they're working on. This is the Cursor "silent indexing" pattern applied to governance.

### Brilliant Moment 5 — The "Paste and Audit" Instant

**Trigger:** User pastes a component (new "Paste a Component" entry point — proposed).
**What Flint does:** Textarea, paste JSX, instant Mithril + Warden audit. Results in under 2 seconds. "3 color drifts, 1 a11y issue. Fix?"
**Why brilliant:** Fastest possible time-to-value. Zero friction. Maximum proof of concept. The user pastes their own code and sees governance in action before committing to anything.

---

## 10. What to Remove or Demote

| Current Element | Action | Replacement |
|----------------|--------|-------------|
| "New Project" (blank scratchpad) | Remove | N/A — Glass is observability, not authoring |
| "From Figma" tile on LaunchScreen | Demote to progressive unlock | Surface from StatusBar Figma indicator after first project open |
| "Governance Dashboard" tile | Remove | MCP Context Banner handles this case |
| Demo Gallery ("More demos") | Collapse into "Try Flint" | Scenario picker within the demo flow |
| 4 expandable tile inline flows | Remove | Replaced by 3-path LaunchScreen |
| BetaWelcome + DemoWalkthrough redundancy | Merge | BetaWelcome explains value; DemoWalkthrough demonstrates it. Don't explain twice. |

---

## 11. Open Questions

1. **Should "Paste a Component" be a LaunchScreen path or a Command Palette action?** It's the fastest time-to-value but may be too niche for the main screen. Could live as a `Cmd+V` shortcut when no project is open.

2. **How should auto-audit interact with large monorepos?** Scanning 10,000 files takes too long for a first-impression audit. Should we cap at top-level components? Scan only the first N files? Let the user scope after initial results?

3. **Should the demo walkthrough be skippable for returning users who haven't completed it?** Current behavior: shows once, persists to localStorage. Should it re-appear if the user dismissed it without completing?

4. **Where does the SetupWizard live post-redesign?** Currently triggered from StatusBar "Connect IDE" or LaunchScreen. If LaunchScreen is simplified, the wizard should be accessible from Command Palette and StatusBar only.

5. **Should recent projects show stale health grades?** The grade from the last audit may be outdated if the codebase changed. Should we re-audit on hover? Show "last audited: 3 days ago"?

6. **How does Smart Open interact with `flint.config.yaml` that already exists?** Detection should skip auto-configuration but still run the baseline audit. Need to distinguish "first open" from "returning open."

---

## Appendix A: Accessibility Fix List

### BetaWelcome (3 critical, 2 warning)
- Add `role="main"` or focus management on arrival
- Fix gradient `<h1>` contrast (use solid color or ensure lightest gradient point meets 4.5:1)
- Fix subtitle contrast (`text-gray-500` → `text-gray-400`)
- Add `aria-hidden="true"` to all decorative Lucide icons
- Fix "Step N" label contrast

### LaunchScreen (10 critical, 6 warning)
- Add focus management when flow panel expands
- Add `aria-live` to progress/done state transitions
- Add project name to "Open this project" button label
- Add project name to "Remove from recent" button labels
- Add `aria-expanded` + `aria-controls` to "More demos" toggle
- Fix section label contrast (`text-zinc-600` → `text-zinc-400`)
- Fix footer button contrast
- Fix recent project path contrast
- Add `aria-label` to web-mode footer path input
- Add `role="alert"` to web-mode path error
- Add `aria-hidden` to all decorative icons
- Use `<h2>` for section headers instead of `<p>`
- Add accessible label to spinner

### DemoWalkthrough (6 critical, 3 warning)
- Move focus into dialog on mount
- Manage focus between step transitions
- Restore focus on dismiss
- Add `aria-modal="true"` or change role from `dialog` to `note`
- Add `prefers-reduced-motion` check
- Add step announcement on transition
- Add `aria-hidden` to step dots and X icon

### SetupWizard (4 critical, 4 warning)
- Add `role="dialog"` + `aria-labelledby` + `aria-modal` to overlay
- Manage focus on step transitions
- Add `aria-pressed` or `role="radio"` to IDE selection buttons
- Change error `aria-live` from `polite` to `assertive`
- Add `aria-hidden` to CheckCircle/XCircle icons
- Fix heading level inconsistency (h1 vs h2)
- Add `aria-label` to config `<pre>` block
- Scope `data-wizard-primary` query to wizard subtree

### Gate Hierarchy (2 critical)
- Add screen reader announcements at gate transitions
- Add announcement + focus movement on demo auto-load

---

## Appendix B: Files Referenced

### Glass UI
- `src/components/ui/LaunchScreen.tsx` — main entry screen
- `src/components/ui/BetaWelcome.tsx` — beta welcome overlay
- `src/components/ui/DemoWalkthrough.tsx` — guided tooltip tour
- `src/components/ui/SetupWizard.tsx` — IDE connection wizard
- `src/App.tsx` — gate hierarchy, first-launch detection, auto-resume

### Electron
- `electron/main.ts` — project open handlers, scanDirectory, checkFirstLaunch
- `electron/preload.ts` — project API surface

### MCP
- `flint-mcp/src/prompts/onboard-project.ts` — MCP-side project onboarding
- `flint-mcp/src/core/config-loader.ts` — config discovery/loading

### Strategy
- `docs/strategy/JOURNEY-MAPS-UX_1.md` — Journeys 1, 2, 8, 10
- `docs/strategy/FEATURE-BUDGET-FRAMEWORK.md` — 6-gate decision framework
- `docs/strategy/BACKLOG-PRIORITIZED.md` — sprint planning
