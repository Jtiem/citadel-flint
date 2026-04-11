# Forge Initiation Review -- 2026-04-10

## Summary Table

| File | Grade | Critical | Major | Minor |
|------|-------|----------|-------|-------|
| `src/components/ui/LaunchScreen.tsx` | B+ | 1 | 3 | 3 |
| `electron/main.ts` (project IPC handlers) | A- | 0 | 1 | 1 |
| `electron/templateService.ts` | A | 0 | 1 | 0 |
| `electron/templates/base-vite-tailwind/` | C+ | 1 | 2 | 0 |
| `src/store/canvasStore.ts` | A | 0 | 0 | 1 |
| `src/App.tsx` (handleNewProject) | A- | 0 | 0 | 1 |

**Overall: B+** -- The "idea to one click to building" promise is delivered. The scratchpad flow is instant, error handling is present, and the old 8-channel flow is gone. The main gaps are in template completeness and Mithril compliance of the LaunchScreen itself.

---

## Per-File Review

### 1. `src/components/ui/LaunchScreen.tsx` -- Grade: B+

**CRITICAL-1: Figma plugin link is an external URL (Commandment 4 violation)**
Line 536-541: The "From Figma" tile flow contains a live `<a href="https://figma.com/community">` link. C4 says "no external URLs in preview." While this is the LaunchScreen and not the preview iframe, it still opens an external page from inside the app. Should either remove it or route through `window.flintAPI.shell.openExternal()` with a confirmation.

**MAJOR-1: 15 instances of arbitrary Tailwind text sizes (`text-[10px]`, `text-[11px]`)**
Lines 507, 616, 658, 681, 699, 702, 708, 725, 760, 766, 815, 857, 860, 876. These are Mithril violations. The Tailwind scale has `text-[10px]` -> use `text-2xs` or define a token. `text-[11px]` has no standard equivalent. These would trigger MITHRIL-IST-TYP on any audit of this file.

**MAJOR-2: No loading indicator on "New Project" button**
Line 459: `onClick={() => { void onNewProject() }}` fires but the button has no disabled/loading state. The parent `App.tsx` sets `isLoadingProject` but that state is not passed to LaunchScreen. If scratchpad creation takes >500ms (disk I/O, git init), the user can click again, potentially creating Untitled-1 and Untitled-2.

**MAJOR-3: `handleFolderStep` swallows errors silently**
Line 280-284: The catch block resets to `'folder'` step but provides zero feedback about what went wrong. If the folder dialog fails or the path is invalid, the user sees nothing.

**MINOR-1:** `AbortController` on line 184 is created but never connected to the `Promise.allSettled` calls. The timeout/abort pattern is cosmetic -- it does not actually cancel the IPC calls.

**MINOR-2:** The `done` flow step (lines 644-651) is defined but never reached -- no code path sets `setFlowStep('done')`. Dead code.

**MINOR-3:** The `progressMessage` state is set but the progress step has a hardcoded subtitle ("Detecting stack, extracting tokens...") regardless of the actual progress message content. Minor copy inconsistency.

---

### 2. `electron/main.ts` (project IPC handlers) -- Grade: A-

**MAJOR-1: `project:create-scratchpad` has no error handling for `initializeProject` failure**
Line 1594: `initializeProject(targetPath, 'base-vite-tailwind')` is called synchronously but if `cpSync` throws (e.g., disk full, permissions), the error propagates to the renderer as a raw Node.js error. Should catch and rethrow with a user-friendly message.

**MINOR-1:** `project:create-scratchpad` uses `void` fire-and-forget for `mcpClient.start()`, `loadAgentPolicy()`, and RAG seeding (lines 1620-1635). If any of these fail, the project is created but MCP/governance is silently broken. The user has no indication.

Positives:
- Path validation is solid (absolute path check, home directory containment, self-hosting guard).
- Uses `fileTransactionManager.write` for all file writes (C12 compliance).
- Template ID allowlist in `templateService.ts` prevents path traversal.
- Registry upsert + git init are both present.

---

### 3. `electron/templateService.ts` -- Grade: A

**MAJOR-1: Empty-Dir Gate uses synchronous `readdirSync`**
Line 54: For very large directories this blocks the main process. Low probability in practice (this is a newly created dir), but worth noting.

Positives:
- Clean separation of concerns.
- Template ID allowlist is correct.
- `cpSync` with `recursive: true` is the right primitive.
- Demo overlay pattern (base + demo) is clever and avoids duplication.

---

### 4. `electron/templates/base-vite-tailwind/` -- Grade: C+

**CRITICAL-1: Template is missing essential project files**
The template contains only 4 files: `.bridge/policy.json`, `flint-init.sql`, `src/App.tsx`, `src/index.css`. There is no `package.json`, no `index.html`, no `vite.config.ts`, no `tsconfig.json`, no `tailwind.config.*`. A project scaffolded from this template cannot be `npm install`-ed or `npm run dev`-ed. The preview iframe renders the App.tsx via Flint's internal Babel pipeline, so it "works" inside Glass, but the project is not a standalone runnable app. This breaks the promise of creating a real project.

**MAJOR-1: Template App.tsx is a demo fixture, not a starter**
The `App.tsx` is a `PricingCard` component with intentional CIEDE2000 drift violations (`#FF3333`, `#0055EE`). A user clicking "New Project" gets a project pre-loaded with governance violations. The starter template should be a clean, violation-free component.

**MAJOR-2: `.bridge/` directory is a stale brand name**
The config directory is `.bridge/` but the product was renamed to Flint. The `create-scratchpad` IPC handler writes `.flint/` config separately (lines 1597-1607), so the `.bridge/policy.json` in the template is likely ignored. Dead file from pre-rebrand.

---

### 5. `src/store/canvasStore.ts` -- Grade: A

**MINOR-1:** `closeWorkspace` does not reset `unlockedTabs` or `unlockedLeftTabs`. The comment says "persists for the lifetime of the workspace" but after closing and reopening a different project, the tabs from the previous session carry over. Intentional per the docstring, but could surprise users.

No Commandment violations. No cross-store imports. No `window.flintAPI` calls in store actions (the `triggerAutoSave` call to `window.flintAPI.saveFile` is legitimate -- it is inside the store but it is the auto-save pipeline, which is architecturally scoped here). `canExport()` correctly gates on Mithril + A11y + overrides.

---

### 6. `src/App.tsx` (handleNewProject) -- Grade: A-

**MINOR-1:** `handleNewProject` (line 315) catches errors and shows a notification with `autoDismissMs: 0` (persistent). Good. But the notification title "Failed to create project" does not suggest recovery actions (e.g., "Check disk space" or "Try again").

Positives:
- One-click flow is delivered: `createScratchpad()` -> `hydrateWorkspace()` -> canvas. No folder picker.
- Error notification uses the store notification system correctly.
- `isLoadingProject` state is managed with try/finally.

---

## Prioritized Punch List

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | CRITICAL | `templates/base-vite-tailwind/` | Missing package.json, index.html, vite.config, tsconfig | Add minimal runnable Vite+Tailwind+React project files |
| 2 | CRITICAL | `LaunchScreen.tsx` | External URL violates C4 | Remove href or route through shell.openExternal with confirmation |
| 3 | MAJOR | `templates/base-vite-tailwind/src/App.tsx` | Starter is a violation-laden demo fixture | Replace with a clean "Hello World" component using token-compliant styles |
| 4 | MAJOR | `LaunchScreen.tsx` | 15 arbitrary `text-[10px]`/`text-[11px]` Mithril violations | Replace with `text-2xs` custom token or nearest standard size (`text-xs`) |
| 5 | MAJOR | `LaunchScreen.tsx` | No double-click guard on New Project CTA | Pass `isLoadingProject` to LaunchScreen, disable button while loading |
| 6 | MAJOR | `LaunchScreen.tsx` | `handleFolderStep` catch block gives no user feedback | Show error notification or inline error message |
| 7 | MAJOR | `templates/base-vite-tailwind/.bridge/` | Stale brand directory | Rename to `.flint/` or remove (IPC handler creates `.flint/` anyway) |
| 8 | MAJOR | `main.ts` | `initializeProject` failure in scratchpad handler has no friendly error | Wrap in try/catch with descriptive message |
| 9 | MINOR | `LaunchScreen.tsx` | `done` flow step is dead code | Remove or wire up |
| 10 | MINOR | `LaunchScreen.tsx` | AbortController is decorative | Either connect to fetch or remove |
| 11 | MINOR | `App.tsx` | Error notification lacks recovery guidance | Add "Try again or check disk permissions" to message |

---

## "Idea to One Click to Building" Verdict

**Delivered, with caveats.** The scratchpad flow (`New Project` -> instant canvas) works as promised. No folder picker is required. The user lands on the canvas within seconds. However, the project they land in is not a real runnable app (missing package.json etc.), and the starter component has intentional violations baked in. For a first impression, the user sees governance warnings immediately -- which could be confusing ("I just created a fresh project, why does it already have problems?").

The JTBD tiles are well-organized and the old 8-channel flow is completely gone. The progressive disclosure from tiles to inline expansion is clean. The demo section is well-curated. Recent projects with health grades is a nice touch.

**Recommended priority:** Fix the template (items 1, 3, 7) first -- that is the user's first impression. Then address the Mithril compliance of the LaunchScreen itself (item 4) so Flint's own UI passes its own linter.
