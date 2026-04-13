# Feature Spec: Garrison New Project Flow (Phase FORGE.NP)

## 1. Problem Statement

A designer opening Flint Glass for the first time has no way to begin the describe-and-build workflow without either navigating to an existing codebase or loading a demo that contains intentional violations. The current "New Project" path creates a project with empty `design-tokens.json`, no registry, and a Tailwind-only starter. Mithril flags everything as drift the moment the designer or AI generates any code, because there are no reference tokens. This blocks the D2C pipeline from being useful on day one.

## 2. Feature Budget Gates

1. **Who:** Designer (Glass) + Engine (MCP, because `seedTokens()` is consumed)
2. **Behavior:** A designer can now open Glass, pick a library, and immediately describe components to AI — without setup, without Mithril drift, without knowing what a design token is.
3. **80/5:** 80% use case. Every new user hits this wall. It is the literal first step.
4. **Cost:** Medium. Library picker is self-contained. Extends one existing IPC handler. No new stores or channels.
5. **Validated:** "Never require folder picker before first creative moment" came from direct user feedback. Forge redesign established 8-path launch was a known problem.
6. **Trade-off:** Deprioritizes Figma plugin auto-create-project path (deferred to FORGE.NP.2).

## 3. User Flow

1. Designer clicks **"New Project"** on LaunchScreen
2. Library picker expands inline (same pattern as demo picker): MUI (default), shadcn, PrimeNG, Tailwind-only, None
3. Designer clicks **"Create Project"**
4. Server scaffolds project with seeded tokens, registry, and config
5. Glass opens — LivePreview shows starter component, health grade A
6. One-time tooltip: "Your project is seeded with [library] tokens."
7. Designer describes what they want in their IDE — D2C pipeline uses correct adapter from first call

## 4. Technical Approach

### IPC Data Flow

```
LaunchScreen (React)
  -> onNewProject('shadcn')
    -> handleNewProject('shadcn') in App.tsx
      -> window.flintAPI.project.createScratchpad({ library: 'shadcn' })
        -> server/index.ts 'project:create-scratchpad' handler
          -> adapter.seedTokens()  [pure, no I/O]
          -> write .flint/design-tokens.json
          -> write flint.config.yaml  [selectedLibrary: shadcn]
          -> return FileTreeNode
        -> hydrateWorkspace(tree)
```

### Files to Modify

| File | Change |
|------|--------|
| `server/index.ts` | Extend `project:create-scratchpad` handler (~line 872) with optional `library` param. Call `adapter.seedTokens()`, write tokens + config. |
| `src/components/ui/LaunchScreen.tsx` | Add inline library picker (expand-in-place). Change `onNewProject` prop from `() => Promise<void>` to `(library: string) => Promise<void>`. |
| `src/App.tsx` | Pass library string through `handleNewProject` to `createScratchpad`. |
| `electron/preload.ts` | Accept optional `library` param on `createScratchpad`. |
| `src/adapters/web-api.ts` | Same signature update for web build parity. |

### A11y Requirements (Commandment 5)

- Library picker cards: `<button>` with `aria-pressed` for selection state
- Picker region: `role="group"` with `aria-labelledby`
- Create button: `aria-label` includes selected library name
- Loading spinner: `aria-label="Creating project"` with `aria-live="polite"`

## 5. What Ships in v1 vs. Deferred

### v1
- Library picker inline in LaunchScreen (5 options)
- `project:create-scratchpad` extended with `library` parameter
- `seedTokens()` called; result written to `.flint/design-tokens.json`
- `flint.config.yaml` written with `selectedLibrary`
- Generic `App.tsx` starter for all libraries
- One-time contextual nudge via `useOnboardingTooltip`

### Deferred (FORGE.NP.2)
- Per-library `App.tsx` starters with library-appropriate imports
- Figma push auto-creating a project when no project exists
- Project name field in picker
- Brand color input ("What's your primary color?")

## 6. Success Criteria

1. Create shadcn project -> `flint_design_to_code` -> zero Mithril violations (tokens pre-seeded)
2. One extra click (library selection) — same step count as loading a demo
3. `flint_get_context` returns selected library in session context
4. All existing LaunchScreen tests pass; new picker has full test coverage
