# Contract Artifact: ONBOARD.1 -- First-Launch Setup Walkthrough

**Phase:** ONBOARD.1
**Status:** ONLINE (implemented, shipped, validated)
**Original Date:** 2026-03-18
**Updated:** 2026-03-21 (v2 -- reflects as-built state including R-1..R-10 fixes, Antigravity IDE, consent-first install flow, and `setup:write-mcp-config` IPC)
**Author:** flint-architect

---

## 0. Executive Summary

ONBOARD.1 is a 5-step first-launch wizard that gates the Flint Glass application before the LaunchScreen. It detects installed IDEs, auto-writes the MCP server config (with user consent), tests the internal MCP connection, and writes a completion flag to suppress the wizard on subsequent launches.

**Current state:** Fully implemented across 7 files, with 4 IPC channels, 38+ tests, and an integration validation report (SHIP verdict). Subsequent sprints added Antigravity IDE support, a consent-first install flow (R-1), copy-paste fallback (R-2), accurate verify copy (R-5), escape-key safety during writes (R-4), and accessibility improvements (R-9, R-10).

---

## 1. Impact Map (As-Built)

| File | Change Type | Owner Agent | Purpose |
|------|------------|-------------|---------|
| `src/components/ui/SetupWizard.tsx` | CREATE | flint-design-engineer | 5-step full-screen wizard with consent-first install flow |
| `src/components/ui/__tests__/SetupWizard.test.tsx` | CREATE | flint-test-writer | 38+ tests covering all steps, state transitions, R-* fixes |
| `electron/main.ts` | MODIFY | flint-electron-ipc | 4 IPC handlers (`setup:detect-ides`, `setup:check-first-launch`, `setup:complete-first-launch`, `setup:write-mcp-config`) + `getMCPServerPath()` helper + `app:reset-state` handler |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | `setup` namespace on `window.flintAPI` surface |
| `src/types/flint-api.d.ts` | MODIFY | flint-electron-ipc | `setup` property on `FlintAPI` interface |
| `src/App.tsx` | MODIFY | flint-design-engineer | Wizard gate before LaunchScreen + BetaWelcome |

---

## 2. Type Contracts (As-Built)

### 2.1 IDE Detection Result

```typescript
/** Internal type in SetupWizard.tsx. */
interface DetectedIDE {
  name: 'Claude Code' | 'Cursor' | 'VS Code' | 'Antigravity'
  settingsPath: string
  detected: boolean
}
```

### 2.2 IPC Return Shape: `setup:detect-ides`

```typescript
interface IDEDetectionResult {
  ides: Array<{
    name: 'Claude Code' | 'Cursor' | 'VS Code' | 'Antigravity'
    settingsPath: string
    detected: boolean
  }>
  /** Absolute path to flint-mcp/dist/server.js (dev or packaged). */
  mcpServerPath: string
}
```

### 2.3 First-Launch Check

```typescript
interface FirstLaunchStatus {
  isFirstLaunch: boolean
}
```

### 2.4 Write Status (Component-Local)

```typescript
type WizardStep = 'welcome' | 'ide-detect' | 'mcp-snippet' | 'verify' | 'done'
type VerifyStatus = 'idle' | 'checking' | 'connected' | 'error'
type WriteStatus = 'writing' | 'written' | 'error'
```

### 2.5 Setup Wizard Props

```typescript
interface SetupWizardProps {
  onComplete: () => void
}
```

---

## 3. IPC Channels (As-Built)

| Channel | Direction | Request Payload | Return Type | Handler Location |
|---------|-----------|----------------|-------------|-----------------|
| `setup:detect-ides` | renderer -> main | (none) | `IDEDetectionResult` | `electron/main.ts` |
| `setup:check-first-launch` | renderer -> main | (none) | `{ isFirstLaunch: boolean }` | `electron/main.ts` |
| `setup:complete-first-launch` | renderer -> main | (none) | `void` | `electron/main.ts` |
| `setup:write-mcp-config` | renderer -> main | `(ideName: string, configPath: string, mcpServerPath: string)` | `{ written: boolean }` | `electron/main.ts` |
| `app:reset-state` | renderer -> main | (none) | `void` | `electron/main.ts` |

### 3.1 Handler Specifications (As-Built)

**`setup:detect-ides`**
- Probes 4 IDE candidates in this order:
  1. **Claude Code** -- Detection: `~/.claude/settings.json` OR `~/.claude/mcp.json`. Config target: prefers `~/.claude/mcp.json` if it exists, otherwise `~/.claude/settings.json`.
  2. **Antigravity** -- Detection: `~/Library/Application Support/Antigravity/User/settings.json`. Config target: `~/.gemini/antigravity/mcp_config.json`.
  3. **Cursor** -- Detection and config: `~/Library/Application Support/Cursor/User/settings.json`.
  4. **VS Code** -- Detection and config: `~/Library/Application Support/Code/User/settings.json`.
- Uses `existsSync` for each path (synchronous, 4 stat calls).
- Also returns `mcpServerPath` via the `getMCPServerPath()` helper (mirrors `mcpClient.ts` resolution).
- Platform: macOS paths. Linux/Windows stubs planned for future (handler uses `os.homedir()` as base).

**`setup:check-first-launch`**
- Reads `path.join(os.homedir(), BRAND.configDir, 'setup.json')` (resolves to `~/.flint/setup.json`).
- File absent or JSON parse failure: `{ isFirstLaunch: true }`.
- File present with `firstLaunchComplete === true`: `{ isFirstLaunch: false }`.

**`setup:complete-first-launch`**
- Writes `{ firstLaunchComplete: true, completedAt: <unix ms> }` to `~/.flint/setup.json`.
- Creates `~/.flint/` directory if needed via `mkdirSync({ recursive: true })`.
- Uses `writeFileSync` directly (Commandment 12 exemption -- config flag, not source code).

**`setup:write-mcp-config`**
- Accepts `(ideName, configPath, mcpServerPath)`.
- Reads existing config at `configPath` (handles JSONC via `stripJsoncComments()`).
- Merges the Flint MCP entry without clobbering existing config:
  - VS Code and Antigravity: `{ mcp: { servers: { flint: { type: 'stdio', command: 'node', args: [mcpServerPath] } } } }`
  - Claude Code and Cursor: `{ mcpServers: { flint: { command: 'node', args: [mcpServerPath] } } }`
- Creates parent directory if needed.
- Returns `{ written: true }` on success; throws on failure.

**`app:reset-state`**
- Deletes `~/.flint/setup.json` to re-enable the wizard on next launch.
- The renderer calls this from the native OS menu "Reset State" handler, then clears `localStorage` and reloads.

### 3.2 MCP Server Path Resolution

```typescript
function getMCPServerPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'flint-mcp', 'dist', 'server.js')
  }
  return path.resolve(__dirname, '..', 'flint-mcp', 'dist', 'server.js')
}
```

This is defined alongside the IPC handlers in `electron/main.ts` and mirrors the `SERVER_ENTRY` constant in `electron/mcpClient.ts`.

---

## 4. Store Contracts

No Zustand stores. All wizard state is local `useState` inside `SetupWizard.tsx`.

---

## 5. Component Architecture (As-Built)

### 5.1 SetupWizard (`src/components/ui/SetupWizard.tsx`)

| Aspect | Value |
|--------|-------|
| File | `src/components/ui/SetupWizard.tsx` |
| Props | `SetupWizardProps` (`onComplete: () => void`) |
| Store dependencies | None |
| IPC calls | `window.flintAPI.setup.detectIDEs()`, `window.flintAPI.setup.writeMCPConfig()`, `window.flintAPI.setup.completeFirstLaunch()` |
| MCP calls | `window.flintAPI.mcp?.callTool('flint_status', {})` for verify step |
| Icons | `CheckCircle`, `XCircle`, `ChevronRight`, `ChevronLeft`, `Loader2`, `Copy`, `Check` from `lucide-react` |

**Step behavior:**

1. **Welcome** (`step === 'welcome'`)
   - Full-screen `bg-zinc-950` overlay with centered `max-w-lg` card.
   - Heading: "Get {BRAND.product} running in 2 minutes"
   - Single CTA: "Let's go" advances to `ide-detect`.
   - No skip/dismiss on this step.

2. **IDE Detection** (`step === 'ide-detect'`)
   - On mount: calls `detectIDEs()`. Shows `Loader2` spinner while null.
   - Lists 4 IDEs as selectable buttons (not radio buttons).
   - Detected: green `CheckCircle` + "Found" badge. Undetected: gray "-- Not found" but still selectable.
   - Auto-selects first detected IDE.
   - R-6: Changing IDE selection resets `writeStatus` and `writeError`.
   - "Continue" disabled until selection made. "Skip setup" calls `onComplete()`.

3. **MCP Config** (`step === 'mcp-snippet'`) -- Consent-First Flow (R-1)
   - Heading: "Connecting {BRAND.product} to {selectedIDE.name}"
   - Shows the JSON snippet in a `<pre>` code block (preview-only before install).
   - Three-state flow:
     - **Pre-install** (`writeStatus === null`): Shows "Review the config above" message + "Install MCP Config" button.
     - **Installing** (`writeStatus === 'writing'`): Disabled button with spinner. Escape key blocked (R-4).
     - **Success** (`writeStatus === 'written'`): Green checkmark + "Config written" + "Continue" button.
     - **Error** (`writeStatus === 'error'`): Red error message + "Copy config snippet" clipboard button (R-2) + manual paste instructions + "Retry" button.
   - "Skip" link always advances to `verify` (R-3), never calls `completeFirstLaunch`.

4. **Verify Connection** (`step === 'verify'`)
   - R-5: Accurate copy -- "Flint is checking its internal connection. No changes to your IDE are needed."
   - "Test Connection" button calls `window.flintAPI.mcp?.callTool('flint_status', {})`.
   - Success: green "Flint is live" + "Continue" button.
   - Error: red message with context-aware text (ECONNREFUSED vs. generic).
   - "Skip" advances to done.

5. **Done** (`step === 'done'`)
   - Large `CheckCircle` icon + "You're ready." heading.
   - "Start building" button calls `completeFirstLaunch()` then `onComplete()`.

**Sub-component: `StepDots`**
- R-10: Non-color distinction -- completed steps show solid indigo dots with checkmark glyphs, current step shows outlined ring with filled inner dot, future steps show hollow rings.
- R-9: `aria-hidden="true"` on the dot container (decorative).

**Global behaviors:**
- Back button on steps 2-4 (not welcome or done).
- Escape key calls `onComplete()` unless `writeStatus === 'writing'` (R-4).
- Enter key triggers `[data-wizard-primary]` button.
- `BRAND.product` used for all product name strings.

### 5.2 App.tsx Integration

The wizard gate chain in `App.tsx` (lines 84-508):

```
setupComplete === null  --> render nothing (avoids flash)
setupComplete === false --> render <SetupWizard />
betaWelcomeDone === false --> render <BetaWelcome />
workspaceFiles === null --> render <LaunchScreen />
otherwise --> render main 3-panel workspace
```

The `setupComplete` state is initialized as `null`. A `useEffect` calls `setup?.checkFirstLaunch()` with a 3-second timeout fallback that defaults to `setupComplete = true` (skip wizard if IPC hangs). On IPC failure, the wizard is also skipped.

The native OS menu "Reset State" handler calls `setup?.resetState()`, clears `localStorage`, and reloads, which triggers the wizard again.

### 5.3 Config Snippet Builder

The `buildConfigSnippet()` function in `SetupWizard.tsx` produces IDE-specific JSON:

- **VS Code / Cursor:** `{ "mcp.servers": { "flint": { "command": "node", "args": [mcpServerPath] } } }`
- **Claude Code / Antigravity:** `{ "mcpServers": { "flint": { "command": "node", "args": [mcpServerPath] } } }`

Note: The snippet builder differs slightly from the `setup:write-mcp-config` handler's merge logic (which uses `mcp.servers` nesting for VS Code/Antigravity and `mcpServers` for Claude Code/Cursor). The snippet is for display/copy; the handler performs the actual config merge.

---

## 6. Preload Surface (As-Built)

In `electron/preload.ts` lines 868-890:

```typescript
setup: {
  detectIDEs: () => Promise<{
    ides: Array<{ name: string; settingsPath: string; detected: boolean }>
    mcpServerPath: string
  }> => ipcRenderer.invoke('setup:detect-ides'),

  checkFirstLaunch: () => Promise<{ isFirstLaunch: boolean }> =>
    ipcRenderer.invoke('setup:check-first-launch'),

  completeFirstLaunch: () => Promise<void> =>
    ipcRenderer.invoke('setup:complete-first-launch'),

  writeMCPConfig: (ideName: string, configPath: string, mcpServerPath: string) =>
    Promise<{ written: boolean }> =>
    ipcRenderer.invoke('setup:write-mcp-config', ideName, configPath, mcpServerPath),

  resetState: () => Promise<void> => ipcRenderer.invoke('app:reset-state'),
}
```

---

## 7. flint-api.d.ts (As-Built)

In `src/types/flint-api.d.ts` lines 1547-1572:

```typescript
setup: {
  detectIDEs: () => Promise<{
    ides: Array<{
      name: 'Claude Code' | 'Cursor' | 'VS Code' | 'Antigravity'
      settingsPath: string
      detected: boolean
    }>
    mcpServerPath: string
  }>
  checkFirstLaunch: () => Promise<{ isFirstLaunch: boolean }>
  writeMCPConfig: (ideName: string, configPath: string, mcpServerPath: string) => Promise<{ written: boolean }>
  completeFirstLaunch: () => Promise<void>
  resetState: () => Promise<void>
}
```

---

## 8. Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|------------|---------|---------------|
| 4 | Local-First Only | YES | All IDE detection uses `existsSync` on local paths. No network calls. The verify step uses the local MCP stdio client. |
| 9 | Process Boundary | YES | All filesystem access happens in `electron/main.ts` via IPC. Renderer uses `window.flintAPI.setup.*` only. No `fs` imports in `src/`. |
| 12 | Atomic Queuing | EXEMPT | `setup.json` is a config flag in `~/.flint/`, not source code. Direct `writeFileSync` is acceptable (same pattern as `ai:save-config`). |
| 14 | Bypass Prohibition | EXEMPT | Same exemption as Commandment 12 -- config files, not project source. |

No other commandments apply. This feature does not touch AST, tokens, design drift, undo/redo, or exports.

---

## 9. First-Launch Flag

| Aspect | Value |
|--------|-------|
| File path | `~/.flint/setup.json` (resolved via `path.join(os.homedir(), BRAND.configDir, 'setup.json')`) |
| Content when complete | `{ "firstLaunchComplete": true, "completedAt": <unix-ms> }` |
| Checked at startup | `App.tsx` useEffect calls `setup.checkFirstLaunch()` with 3s timeout |
| Written on completion | "Start building" button on done step calls `setup.completeFirstLaunch()` |
| Reset mechanism | Native menu "Reset State" calls `setup.resetState()` (deletes file), clears localStorage, reloads |
| Config directory creation | `mkdirSync(flintDir, { recursive: true })` in `setup:complete-first-launch` handler |

---

## 10. IDE Detection Logic (As-Built)

### macOS Paths (Implemented)

| IDE | Detection File(s) | Config Target |
|-----|-------------------|---------------|
| Claude Code | `~/.claude/settings.json` OR `~/.claude/mcp.json` | `~/.claude/mcp.json` (preferred) or `~/.claude/settings.json` (fallback) |
| Antigravity | `~/Library/Application Support/Antigravity/User/settings.json` | `~/.gemini/antigravity/mcp_config.json` |
| Cursor | `~/Library/Application Support/Cursor/User/settings.json` | Same as detection file |
| VS Code | `~/Library/Application Support/Code/User/settings.json` | Same as detection file |

### Key Design Decisions

1. **Detection != Config for Claude Code:** The detection file proves the IDE is installed. The config file is where MCP entries go. For Claude Code, `mcp.json` is the authoritative MCP registration target (newer installs may not have `settings.json`).
2. **Antigravity is a VS Code fork:** Uses the VS Code `mcp.servers` format in the write handler, not the Claude Code `mcpServers` format. Config lives at a Gemini-specific path.
3. **Multiple IDEs can be detected:** All 4 are checked and listed. User selects one to configure.
4. **Manual override:** Undetected IDEs remain selectable so users with non-standard installations can proceed.

### Linux/Windows (Stubs -- Not Implemented)

The handler uses `os.homedir()` as base, so a future path table for Linux (`~/.config/Code/User/settings.json`) and Windows (`%APPDATA%/Code/User/settings.json`) can be added by extending the `IDE_CANDIDATES` array.

---

## 11. MCP Snippet Templates (As-Built)

### Claude Code / Antigravity (`mcpServers` format)

```json
{
  "mcpServers": {
    "flint": {
      "command": "node",
      "args": ["{mcpServerPath}"]
    }
  }
}
```

### Cursor / VS Code (`mcp.servers` format -- snippet display)

```json
{
  "mcp.servers": {
    "flint": {
      "command": "node",
      "args": ["{mcpServerPath}"]
    }
  }
}
```

Note: The `setup:write-mcp-config` handler uses a deeper merge structure for VS Code/Antigravity (`{ mcp: { servers: { flint: ... } } }`) that properly nests inside existing config. The display snippet uses the flat `mcp.servers` key for readability.

---

## 12. Test Plan (As-Shipped)

### SetupWizard.test.tsx (38+ tests)

| ID | Test |
|----|------|
| WIZ-01 | Renders welcome step on initial mount |
| WIZ-02 | "Let's go" advances to ide-detect |
| WIZ-03 | detectIDEs called when ide-detect mounts |
| WIZ-04 | Spinner while detectedIDEs is null |
| WIZ-05 | Auto-selects first detected IDE |
| WIZ-06 | Undetected IDE can be manually selected |
| WIZ-07 | "Continue" disabled with no selection |
| WIZ-08 | "Continue" advances to mcp-snippet |
| WIZ-09 | "Skip setup" calls onComplete |
| WIZ-10 | "Install MCP Config" button shown (no auto-write) |
| WIZ-11 | "Config written" after Install + writeMCPConfig resolves |
| WIZ-12 | Error state when writeMCPConfig rejects |
| WIZ-13 | Retry resets write state |
| WIZ-14 | "Continue" after success advances to verify |
| WIZ-15 | "Skip" on mcp-snippet advances to verify; no completeFirstLaunch |
| WIZ-16 | Verify success: callTool resolves, shows "Flint is live" |
| WIZ-17 | Verify error: callTool rejects, shows error |
| WIZ-18 | "Continue" on verify success advances to done |
| WIZ-19 | "Skip" on verify advances to done |
| WIZ-20 | Done step calls completeFirstLaunch then onComplete |
| WIZ-21 | Back on ide-detect returns to welcome |
| WIZ-22 | Back on mcp-snippet returns to ide-detect |
| WIZ-23 | Escape calls onComplete (when not writing) |
| WIZ-24 | Step indicator renders 5 dots |
| WIZ-24b | Antigravity appears in IDE list |
| WIZ-24c | writeMCPConfig called with Antigravity path |
| R1-A | writeMCPConfig NOT auto-called on step entry |
| R1-B | "Install MCP Config" button present before write |
| R1-C | Clicking Install calls writeMCPConfig |
| R1-D | Install button shows spinner while writing |
| R2-A | "Copy config snippet" button in error state |
| R2-B | Copy writes JSON to clipboard |
| R2-C | Manual paste instruction in error state |
| R3-A | Skip in mcp-snippet advances to verify (not done) |
| R3-B | completeFirstLaunch NOT called on skip |
| R3-C | Only done step "Start building" calls completeFirstLaunch |
| R4-A | Escape ignored while writeStatus === 'writing' |
| R5-A | Verify shows accurate copy (no "restart your IDE") |
| R5-B | Verify shows "internal connection" language |
| R6-A | writeStatus resets when IDE selection changes |
| R9-A | Status box has aria-live="polite" |
| R10-A | Completed steps show checkmark |
| R10-B | Current step shows ring indicator |

---

## 13. Visual Design (As-Built)

- Full-screen overlay: `fixed inset-0 z-50 bg-zinc-950`
- Card: `max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl`
- Primary CTA: `bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg`
- Skip links: `text-zinc-500 hover:text-zinc-400 text-xs underline`
- Code block: `bg-zinc-950 border border-zinc-700/50 rounded-lg font-mono text-xs`
- IDE list items: `rounded-lg border p-3` with `border-indigo-500/60 bg-indigo-900/20` selection highlight
- Detected badge: `text-emerald-400` with `CheckCircle`
- Verify success: `text-emerald-400` with `CheckCircle`
- Verify error: `text-red-400` with `XCircle`
- Palette: zinc scale throughout (no gray -- R-8 consistency fix)
- Icons: `lucide-react` only

---

## 14. Risks (Reviewed)

| Risk | Severity | Mitigation | Status |
|------|----------|-----------|--------|
| `process.resourcesPath` differs between dev and packaged | Medium | `app.isPackaged` guard matches `mcpClient.ts` | RESOLVED |
| Claude Code detection != config file | High | Dual-file detection: `settings.json` OR `mcp.json` for detection; `mcp.json` preferred for config | RESOLVED |
| Wizard blocks app on IPC failure | Medium | 3-second timeout fallback in App.tsx; catch clause skips wizard | RESOLVED |
| Existing OnboardingOverlay conflict | Low | Different lifecycle (post-project-open tooltip tour vs. pre-LaunchScreen wizard) | RESOLVED |
| macOS-only IDE paths | Low | v1 is macOS only; `os.homedir()` base allows future extension | ACCEPTED |
| JSONC comments in IDE settings files | Medium | `stripJsoncComments()` before `JSON.parse()` in write handler | RESOLVED |
| Write handler clobbers existing config | High | Deep merge pattern preserves all existing keys | RESOLVED |
| Consent without user action | Medium | R-1 consent-first: no write until user clicks "Install MCP Config" | RESOLVED |

---

## 15. Changelog

| Date | Change |
|------|--------|
| 2026-03-18 | v1: Original contract approved. 3 IPC channels, 3 IDEs, copy-paste only. |
| 2026-03-18 | Implementation shipped. 36 tests, SHIP verdict. |
| 2026-03-19 | R-1..R-10 fixes: consent-first install, copy fallback, accurate verify copy, escape safety, a11y. |
| 2026-03-19 | Antigravity IDE added (4th IDE). `setup:write-mcp-config` IPC added. |
| 2026-03-21 | Cleanup sprint: zinc palette consistency (R-8). |
| 2026-03-21 | v2: Contract updated to reflect as-built state. |
