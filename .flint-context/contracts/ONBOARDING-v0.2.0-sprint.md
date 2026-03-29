# Contract: Onboarding Overhaul Sprint (v0.2.0)

**Date:** 2026-03-29
**Phase:** ONBOARD.2
**Target release:** v0.2.0 to jtiem/citadel-flint

---

## Impact Map

| # | Fix | Files | Change Type | Owner Agent |
|---|-----|-------|-------------|-------------|
| 1 | Wire Fix button to `flint_fix` via mcpClient | `GovernanceDashboard.tsx` | Logic change | flint-design-engineer |
| 2 | Default demo to `a11y-audit` | `App.tsx` | 1-line change | flint-design-engineer |
| 3 | DemoWalkthrough overlay | `DemoWalkthrough.tsx` (new), `App.tsx` | New component + mount | flint-design-engineer |
| 4 | Single CTA LaunchScreen | `LaunchScreen.tsx` | UI restructure | flint-design-engineer |
| 5 | Rewrite SetupWizard copy | `SetupWizard.tsx` | Copy changes | flint-design-engineer |
| 6 | Fix silent demo load failure | `App.tsx` | Error handling | flint-design-engineer |
| 7 | `flint_quickstart` MCP tool | `flint-mcp/src/tools/quickstart.ts` (new), `flint-mcp/src/server.ts` | New tool | flint-ast-surgeon |
| 8 | npm publish in CI | `.github/workflows/build-release.yml` | CI job addition | flint-electron-ipc |
| 9 | Web directory picker | `LaunchScreen.tsx` | Input type change | flint-design-engineer |
| 10 | Verify `--demo` flag | `server/cli.ts` | Verification + fix | flint-electron-ipc |

---

## Phase 0: Session Start

Update `ACTIVE-SWARM-TERRITORY.md` and `HANDOFF.md` before any agent writes code.

---

## Phase 1: Quick Wins (2 parallel agent groups)

### Group A: Content + copy changes (flint-design-engineer)

**Files touched:**
- `src/App.tsx`
- `src/components/ui/LaunchScreen.tsx`
- `src/components/ui/SetupWizard.tsx`

#### Fix 2 — Default demo to `a11y-audit`

**What:** Line 613 in `App.tsx` calls `window.flintAPI.beta?.loadDemoProject()` with no argument. The default in preload (line 915) passes `{ demoName }` but the IPC handler likely defaults to `token-drift`. Change to pass `'a11y-audit'` explicitly.

**Change:** In `App.tsx`, line 613:
```ts
// Before:
const result = await window.flintAPI.beta?.loadDemoProject()
// After:
const result = await window.flintAPI.beta?.loadDemoProject('a11y-audit')
```

Also line 703 (the LaunchScreen `onLoadDemo` callback) — same change.

**Done when:** First launch auto-loads the a11y-audit demo project, not token-drift.

#### Fix 4 — Single CTA LaunchScreen

**What:** Replace the 4-card horizontal demo gallery (lines 605-640 in `LaunchScreen.tsx`) with:
1. A single prominent "Try the demo" button that calls `onLoadDemo()` (loads a11y-audit)
2. A collapsible "More demos" section (default collapsed) containing the existing 4 cards

**Architecture:** No new state, no new IPC. Uses existing `onLoadDemo` prop. Add a `showMoreDemos` boolean local state.

**Done when:** LaunchScreen shows one CTA button prominently, other demos hidden behind a disclosure toggle.

#### Fix 5 — Rewrite SetupWizard copy

**What:** In `SetupWizard.tsx`, find all user-facing strings containing "MCP" and reframe them. The wizard helps users "add a small config file to enable AI fixing in your editor." Specific changes:

- Step 'mcp-snippet' title: "Add Flint to your editor" (not "MCP configuration")
- Any mention of "MCP server" becomes "config file"
- `buildConfigSnippet` output stays the same (it IS the config), but the surrounding copy says "paste this into your editor settings"

**Done when:** No user-facing string in SetupWizard contains "MCP". Technical accuracy preserved in the actual JSON snippet.

#### Fix 6 — Fix silent demo load failure

**What:** In `App.tsx` line 613, `window.flintAPI.beta?.loadDemoProject()` uses optional chaining. If `beta` is undefined (web mode, or preload missing the namespace), the call silently returns `undefined` and the user sees a blank LaunchScreen.

**Changes:**
1. Wrap the auto-load in a try/catch that sets `demoLoadError` state (already exists, line 640)
2. If `window.flintAPI.beta` is undefined, set a specific error: "Demo loading is not available in this environment"
3. Surface the error via the `demoError` prop to LaunchScreen (already wired, line 346)

**Done when:** Failed demo loads show a visible error banner instead of silent failure.

**Tests required (Group A):**
- `LaunchScreen.test.tsx`: Update to verify single CTA renders, "More demos" section exists collapsed
- `SetupWizard.test.tsx`: Verify no rendered text contains "MCP" (snapshot or text content assertion)
- `App.tsx` test: Verify demoLoadError surfaces when beta API unavailable

### Group B: CI + web channel (flint-electron-ipc)

**Files touched:**
- `.github/workflows/build-release.yml`
- `server/cli.ts`

#### Fix 8 — Add npm publish to CI

**What:** Add a new job `publish-npm` that runs after `build-web` succeeds. It publishes the package to npm so `npx flint-glass` works.

**Changes to `.github/workflows/build-release.yml`:**
```yaml
  publish-npm:
    name: Publish to npm
    needs: [build-web]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci --ignore-scripts
      - run: cd flint-mcp && npm ci && npm run build
      - run: npm run build:web
      - run: npm run build:server
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**User action required:** Add `NPM_TOKEN` secret to GitHub repo settings (Settings > Secrets > Actions). This is a Classic npm token with `publish` permission from npmjs.com.

**Done when:** Tagged releases publish to npm automatically. Document the NPM_TOKEN requirement in the workflow comment header.

#### Fix 9 — Web directory picker

**What:** In `LaunchScreen.tsx`, the web-mode path input (lines 540-568) is a text `<input>` requiring users to type an absolute path. Replace with `<input type="file" webkitdirectory>` which opens a native browser directory picker.

**Changes:**
- When `isWebMode && showWebPathInput`, render a file input with `webkitdirectory` attribute
- On change, extract the common parent path from `e.target.files` (all files share a root)
- Submit that path via the existing `handleWebPathSubmit` flow

**Caveat:** `webkitdirectory` gives the browser-relative path, not an absolute server path. The server needs the files uploaded or a different mechanism. This may need to become a "drag folder onto page" interaction instead.

**DECISION NEEDED:** The `webkitdirectory` input gives relative paths from the browser sandbox, not absolute server-side paths. Two options:
1. **Server path input stays as text** but with better UX (autocomplete, validation feedback)
2. **File upload approach** where the browser sends files to the server

Recommend option 1 with improved UX (placeholder showing example path, instant validation via server ping) since web mode already requires server-side filesystem access.

#### Fix 10 — Verify `--demo` flag

**What:** Confirm `server/cli.ts` `--demo` flag works end-to-end:
1. `--demo` sets `?demo=token-drift` in browser URL (line 263) -- VERIFIED, code is correct
2. `--demo a11y-audit` sets `?demo=a11y-audit` -- VERIFIED, code is correct
3. App.tsx reads `params.has('demo')` (line 600) -- VERIFIED

**Remaining issue:** The `--demo` flag passes `projectRoot: process.cwd()` (line 254) to `startServer`, not a temp directory with demo files. The demo scaffold happens client-side via `beta:load-demo-project` IPC, which works in Electron but in web mode this IPC is handled by the Express server (must verify `server/index.ts` has the handler).

**Action:** Verify `server/index.ts` has a `beta:load-demo-project` handler. If missing, add one that scaffolds the demo to a temp dir.

**Tests required (Group B):**
- CI: Manual verification after merge (no automated test for workflow files)
- `server/cli.ts`: Unit test for `parseArgs` with `--demo`, `--demo a11y-audit`

**Done when Phase 1 is complete:**
- First launch loads a11y-audit demo
- LaunchScreen has single CTA
- SetupWizard has no "MCP" in user copy
- Demo failures show error banners
- CI publishes to npm
- `--demo` flag confirmed working

---

## Phase 2: Core Loop (sequential, depends on Phase 1)

### Fix 1 — Wire Fix button to `flint_fix` via mcpClient (flint-design-engineer)

**What:** The GovernanceDashboard already has working fix buttons (`handleFixSingle` at line 647, `handleFixAll` at line 661). These use `editorStore.applyBatch` with `applyTokenFix` ops for Mithril violations. This works for token-class fixes where the AST already has the mapping.

**The gap:** A11y violations (type `'a11y'`) have no `applyTokenFix` equivalent — they need `flint_fix` from the MCP engine to generate the correct AST mutation. Currently, a11y violations show guidance text but no actionable "Fix" button.

**Architecture:**
1. **No new IPC needed.** The `window.flintAPI.mcp.callTool` channel already exists (preload line 654).
2. In `GovernanceDashboard.tsx`, add a handler for a11y fixes:
   ```ts
   const handleA11yFix = useCallback(async (warning: LinterWarning) => {
       const filePath = useCanvasStore.getState().activeFilePath
       if (!filePath) return
       try {
           const result = await window.flintAPI.mcp.callTool('flint_fix', {
               filePath,
               ruleId: extractRuleIdFromMsg(warning.message),
               dry_run: false,
           })
           // Parse result, refresh audit
           pushNotification({ type: 'success', message: 'Fix applied' })
           // Trigger re-audit by refreshing the file
       } catch (err) {
           pushNotification({ type: 'error', message: 'Fix failed' })
       }
   }, [pushNotification])
   ```
3. Wire this into violation rows where `warning.type === 'a11y'` and the fix guide exists.
4. After fix, re-read the file to refresh the AST and trigger a re-lint.

**Commandment check:**
- C1 (Code is Truth): `flint_fix` writes to disk via AST surgery. Check.
- C12 (Atomic Queuing): `flint_fix` uses `FileTransactionManager` internally. Check.
- C13 (Deterministic Surgery): MCP fix tool uses Babel. Check.
- C9 (Process Boundary): `mcp.callTool` goes renderer -> preload -> main -> mcpClient -> MCP server. Check.

**Anti-pattern check:** `window.flintAPI.mcp.callTool` is called from a component callback, not from a store action. Correct per anti-pattern rules.

**Tests:**
- `GovernanceDashboard.test.tsx`: Mock `window.flintAPI.mcp.callTool`, verify fix button appears for a11y violations, verify it calls `flint_fix` with correct args
- Verify token-fix buttons still work (regression)

**Done when:** A11y violations in GovernanceDashboard have a working "Fix" button that calls `flint_fix` and refreshes the view.

### Fix 3 — DemoWalkthrough overlay (flint-design-engineer)

**What:** After the a11y-audit demo loads, show a 3-step tooltip walkthrough:
1. "These are violations" — points at the GovernanceDashboard health tab
2. "Click Fix" — points at a fix button in the violation list
3. "Gate clears" — points at the StatusBar export gate indicator

**Architecture:** New component `src/components/ui/DemoWalkthrough.tsx`. Follows the same pattern as `OnboardingOverlay.tsx`:
- localStorage key: `flint-demo-walkthrough-complete`
- Only shows when `demoAutoLoaded` is true (prop from App.tsx)
- 3-step state machine with Next/Skip/Done buttons
- Each step renders an absolutely-positioned tooltip card near its target area
- Self-unmounts after completion

**Mount point:** In `App.tsx`, after the canvas renders and `demoAutoLoaded === true`:
```tsx
{demoAutoLoaded && <DemoWalkthrough onDismiss={() => setDemoAutoLoaded(false)} />}
```

**No new IPC.** No new store state. Pure presentational component with localStorage persistence.

**Tests:**
- `DemoWalkthrough.test.tsx`: Renders 3 steps, advances on click, writes localStorage on complete, doesn't render when localStorage flag exists

**Done when:** First demo load shows the 3-step walkthrough, subsequent loads skip it.

---

## Phase 3: MCP Tooling (flint-ast-surgeon)

### Fix 7 — `flint_quickstart` MCP tool

**What:** New MCP tool that gives MCP-only users (no Glass, no IDE extension) a first-value experience:
1. Scaffolds a demo `.tsx` component with intentional violations into CWD
2. Runs `flint_audit` on it
3. Returns formatted results showing what Flint found

**Files:**
- `flint-mcp/src/tools/quickstart.ts` (new)
- `flint-mcp/src/server.ts` (register the tool)

**Tool spec:**
```ts
{
    name: 'flint_quickstart',
    description: 'Scaffold a demo component with design violations, audit it, and show results. Great for first-time users.',
    inputSchema: {
        type: 'object',
        properties: {
            outputDir: { type: 'string', description: 'Directory to scaffold into (default: cwd)' },
        },
    },
}
```

**Implementation:**
1. Write a hardcoded `.tsx` file with 3-4 intentional violations (hardcoded hex, missing alt, wrong spacing token)
2. Write a minimal `design-tokens.json` next to it
3. Call the internal audit function (same one `flint_audit` uses)
4. Format and return results

**Commandment check:**
- C4 (Local-First): No network calls. Scaffold is a hardcoded string written to disk. Check.
- C13 (Deterministic Surgery): The scaffold is a static template, not AST-generated. Acceptable for scaffolding (not a mutation).

**Tests:**
- `quickstart.test.ts`: Tool returns audit results, scaffolded file exists, violations detected match expected count

**Done when:** `flint_quickstart` is registered in server.ts, scaffolds a file, and returns audit results.

---

## Phase 4: Integration + Release

### Step 1: Integration validation (flint-integration-validator)

Run the full test suite across all packages:
```
npm test
npm run test:react
cd flint-mcp && npm test
npx tsc --noEmit
```

Verify:
- [ ] First launch loads a11y-audit demo
- [ ] Fix buttons work for both Mithril and a11y violations
- [ ] DemoWalkthrough appears on first demo load, not on subsequent
- [ ] LaunchScreen single CTA loads demo
- [ ] SetupWizard has no "MCP" in user text
- [ ] `flint_quickstart` tool returns expected output
- [ ] `--demo a11y-audit` works in web mode
- [ ] CI workflow syntax is valid (`act` or manual review)

### Step 2: Version bump

In `package.json`, bump `version` to `"0.2.0"`.

### Step 3: Tag + push

```bash
git tag v0.2.0
git push origin main --tags
```

This triggers the CI workflow which builds Electron + web + (new) npm publish.

---

## Decisions Needed Before Implementation

1. **Fix 9 (web directory picker):** The `webkitdirectory` browser API does not give absolute server-side paths. Recommend keeping the text input with better UX (validation, example placeholder) rather than switching to file upload. **Please confirm.**

2. **Fix 1 (Fix button scope):** The existing `handleFixSingle`/`handleFixAll` already work for Mithril token violations via `applyBatch`. The new work is specifically for a11y violations that need `flint_fix`. Should the Fix button also re-route Mithril fixes through `flint_fix` for consistency, or keep the current dual-path (local `applyBatch` for tokens, MCP `flint_fix` for a11y)? **Recommend dual-path** -- local fixes are instant, MCP round-trip adds latency.

3. **Fix 3 (DemoWalkthrough positioning):** The tooltip positions need to reference actual DOM regions (health tab, fix button, status bar). Should we use `data-testid` selectors + `getBoundingClientRect`, or hardcode approximate positions? **Recommend data-testid approach** for resilience.

---

## Risks

| Risk | Threatens | Mitigation |
|------|-----------|------------|
| `beta` namespace undefined in web mode | Fix 2, 6 | Fix 6 explicitly handles this case |
| `flint_fix` a11y rules not all auto-fixable | Fix 1 | Show fix button only for rules with auto-fix support; show guidance for others |
| `webkitdirectory` path mismatch | Fix 9 | Decision gate above; text input fallback |
| npm publish fails on first tag (package name taken) | Fix 8 | Verify `flint-glass` availability on npm before merge |
| DemoWalkthrough targets move with layout changes | Fix 3 | Use data-testid selectors, not pixel positions |
