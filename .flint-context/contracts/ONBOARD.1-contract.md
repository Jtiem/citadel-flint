# Contract Artifact: ONBOARD.1 — First-Launch Setup Walkthrough

**Phase:** ONBOARD.1
**Status:** APPROVED
**Date:** 2026-03-18
**Author:** flint-architect

---

## 1. Impact Map

| File | Change Type | Owner Agent | Purpose |
|------|------------|-------------|---------|
| `src/components/ui/SetupWizard.tsx` | CREATE | flint-design-engineer | 5-step full-screen wizard component |
| `src/components/ui/__tests__/SetupWizard.test.tsx` | CREATE | flint-test-writer | Unit tests for all wizard states |
| `electron/__tests__/setupIpc.test.ts` | CREATE | flint-test-writer | IPC handler tests |
| `electron/main.ts` | MODIFY | flint-electron-ipc | Add 3 IPC handlers |
| `electron/preload.ts` | MODIFY | flint-electron-ipc | Add `setup` namespace to flintAPI |
| `src/types/flint-api.d.ts` | MODIFY | flint-electron-ipc | Add setup type declarations |
| `src/App.tsx` | MODIFY | flint-design-engineer | Insert wizard gate before LaunchScreen |

---

## 2. Type Contracts

### 2.1 IDE Detection Result

```typescript
/** Returned by the setup:detect-ides IPC handler. */
interface DetectedIDE {
  /** Human-readable name shown in the wizard UI. */
  name: 'Claude Code' | 'Cursor' | 'VS Code'
  /** Absolute path to the IDE's MCP settings file. */
  settingsPath: string
  /** True when the settings file was found on disk. */
  detected: boolean
}

interface IDEDetectionResult {
  /** IDEs found (or not) on this machine, ordered by detection priority. */
  ides: DetectedIDE[]
}
```

### 2.2 First-Launch Check

```typescript
/** Returned by setup:check-first-launch. */
interface FirstLaunchStatus {
  /** True when .flint/setup.json does NOT exist or lacks the 'firstLaunchComplete' key. */
  isFirstLaunch: boolean
}
```

### 2.3 MCP Snippet Payload

```typescript
/** The JSON snippet shown to the user for copy-paste into their IDE settings. */
interface MCPSnippet {
  /** The IDE this snippet targets. */
  ide: 'Claude Code' | 'Cursor' | 'VS Code'
  /** The absolute path to the settings file where this should be pasted. */
  settingsPath: string
  /**
   * The JSON object to paste. Structure:
   * For Claude Code (~/.claude/mcp.json — top-level mcpServers key):
   *   { "mcpServers": { "flint": { "command": "node", "args": ["<serverPath>"] } } }
   *
   * For Cursor / VS Code (settings.json — nested under mcp.servers or mcpServers):
   *   { "flint": { "command": "node", "args": ["<serverPath>"] } }
   *
   * <serverPath> is the absolute path to flint-mcp/dist/server.js
   * resolved from process.resourcesPath (packaged) or __dirname (dev).
   */
  json: string
}
```

### 2.4 Setup Wizard Component State

```typescript
/** Local React state — NOT a Zustand store. */
type WizardStep = 'welcome' | 'ide-detect' | 'mcp-snippet' | 'verify' | 'done'

// Internal state shape (useState within SetupWizard):
// step: WizardStep
// detectedIDEs: DetectedIDE[] | null  (null = loading)
// selectedIDE: DetectedIDE | null     (user's choice or auto-selected)
// copied: boolean                     (snippet copied to clipboard)
// verifyStatus: 'idle' | 'checking' | 'connected' | 'error'
// verifyError: string | null          (specific failure message)
```

### 2.5 Setup Wizard Props

```typescript
interface SetupWizardProps {
  /** Called when the wizard completes or is skipped. App.tsx uses this to proceed to LaunchScreen. */
  onComplete: () => void
}
```

---

## 3. IPC Channels

| Channel | Direction | Request Payload | Return Type | Handler Location |
|---------|-----------|----------------|-------------|-----------------|
| `setup:detect-ides` | renderer -> main | (none) | `IDEDetectionResult` | `electron/main.ts` |
| `setup:check-first-launch` | renderer -> main | (none) | `FirstLaunchStatus` | `electron/main.ts` |
| `setup:complete-first-launch` | renderer -> main | (none) | `void` | `electron/main.ts` |

### 3.1 Handler Specifications

**`setup:detect-ides`**
- Checks for IDE settings files in this priority order:
  1. `~/.claude/settings.json` -- if exists, report "Claude Code" (covers Antigravity)
  2. `~/Library/Application Support/Cursor/User/settings.json` -- "Cursor"
  3. `~/Library/Application Support/Code/User/settings.json` -- "VS Code"
- Uses `existsSync` for each path (synchronous, fast, no risk of blocking -- 3 stat calls)
- Returns `{ ides: DetectedIDE[] }` with `detected: true/false` for each
- Platform note: macOS paths shown above. Linux/Windows paths are out of scope for v1 but the handler should use `os.homedir()` as the base so Linux `~/.config/Code/` works with a future path table update.

**`setup:check-first-launch`**
- Reads `path.join(os.homedir(), '.flint', 'setup.json')`
- If file does not exist or JSON parse fails: `{ isFirstLaunch: true }`
- If file exists and contains `{ "firstLaunchComplete": true }`: `{ isFirstLaunch: false }`

**`setup:complete-first-launch`**
- Writes `{ "firstLaunchComplete": true, "completedAt": Date.now() }` to `~/.flint/setup.json`
- Creates `~/.flint/` directory if it does not exist (`mkdirSync({ recursive: true })`)
- Uses `writeFile` (not FileTransactionManager -- this is a config flag, not source code)

### 3.2 MCP Server Path Resolution

The MCP snippet must contain the absolute path to `flint-mcp/dist/server.js`. Resolution logic (in the `setup:detect-ides` handler or a shared helper used by the snippet step):

```typescript
import { app } from 'electron'
import path from 'node:path'

function getMCPServerPath(): string {
  if (app.isPackaged) {
    // In production: flint-mcp is bundled inside the app's resources
    return path.join(process.resourcesPath, 'flint-mcp', 'dist', 'server.js')
  }
  // In development: resolve relative to electron/ directory
  return path.resolve(__dirname, '..', 'flint-mcp', 'dist', 'server.js')
}
```

This mirrors the existing resolution in `electron/mcpClient.ts` line 75.

---

## 4. Store Contracts

No new Zustand stores. All wizard state is local `useState` inside `SetupWizard.tsx`.

---

## 5. Component Contracts

### 5.1 SetupWizard

| Aspect | Value |
|--------|-------|
| File | `src/components/ui/SetupWizard.tsx` |
| Props | `SetupWizardProps` (see section 2.5) |
| Store dependencies | None |
| IPC calls | `window.flintAPI.setup.detectIDEs()`, `window.flintAPI.setup.completeFirstLaunch()` |
| MCP calls | `window.flintAPI.mcp.callTool('flint_status', {})` for verify step |

**Step-by-step behavior:**

1. **Welcome** (`step === 'welcome'`)
   - Full-screen dark overlay with centered card
   - Heading: "Get Flint running in 2 minutes"
   - Subtext: "Flint connects to your IDE via MCP. We'll help you set it up."
   - Single CTA button: "Let's go" -> advances to `'ide-detect'`
   - No skip/dismiss on this step (it's the entry point)

2. **IDE Detection** (`step === 'ide-detect'`)
   - On mount: calls `window.flintAPI.setup.detectIDEs()`
   - Shows loading spinner while `detectedIDEs === null`
   - Lists each IDE with a radio-button selector:
     - Detected IDEs show a green checkmark + "Found" badge
     - Undetected IDEs show a gray dash + "Not found" badge but remain selectable (manual override)
   - Auto-selects the first detected IDE (or none if all undetected)
   - "Continue" button (disabled until an IDE is selected) -> advances to `'mcp-snippet'`
   - "Skip setup" link at bottom -> calls `onComplete()`

3. **MCP Snippet** (`step === 'mcp-snippet'`)
   - Heading: "Add Flint to {selectedIDE.name}"
   - Instruction text: "Copy this snippet and paste it into `{settingsPath}`"
   - Pre-formatted JSON code block with the MCP config snippet
   - Snippet format depends on IDE:
     - **Claude Code:** Full `mcp.json` object: `{ "mcpServers": { "flint": { "command": "node", "args": ["{serverPath}"] } } }`
     - **Cursor / VS Code:** The server entry only: `{ "flint": { "command": "node", "args": ["{serverPath}"] } }` with instruction to add under `mcpServers` key in settings.json
   - "Copy" button -> writes to clipboard via `navigator.clipboard.writeText()`, shows "Copied!" confirmation for 2 seconds
   - "Next" button -> advances to `'verify'`
   - "Skip" link -> calls `onComplete()` after writing the first-launch flag

4. **Verify Connection** (`step === 'verify'`)
   - "Test Connection" button
   - On click: sets `verifyStatus = 'checking'`, calls `window.flintAPI.mcp.callTool('flint_status', {})`
   - On success (result returned without error): `verifyStatus = 'connected'`, show green "Flint is live" with checkmark
   - On error: `verifyStatus = 'error'`, show red message with specific failure:
     - If `mcp.callTool` throws with connection error: "MCP server not found. Make sure you saved the config and restarted your IDE."
     - If call succeeds but returns unexpected shape: "Server registered but not responding correctly."
   - "Retry" button shown on error
   - "Continue" button (shown on success) -> advances to `'done'`
   - "Skip" link -> advances to `'done'` regardless of verify status

5. **Done** (`step === 'done'`)
   - "You're ready." heading with a success illustration/icon
   - Subtext: "Flint will audit your code and enforce your design system automatically."
   - "Start building" button -> calls `window.flintAPI.setup.completeFirstLaunch()` then `onComplete()`
   - Auto-transition: if this step is reached, the flag write happens on the CTA click (not on step entry) so the user can go back

**Global behaviors:**
- Step indicator dots at the bottom (5 dots, current highlighted)
- Back button on steps 2-4 (not on welcome or done)
- Escape key calls `onComplete()` (non-blocking requirement)
- Keyboard: Enter triggers primary CTA on each step

### 5.2 App.tsx Integration

The wizard gate is inserted BEFORE the existing LaunchScreen gate (line 346):

```tsx
// ── Setup Wizard gate (ONBOARD.1) ─────────────────────────────────────────
const [setupComplete, setSetupComplete] = useState<boolean | null>(null)

useEffect(() => {
  window.flintAPI.setup.checkFirstLaunch().then(({ isFirstLaunch }) => {
    setSetupComplete(!isFirstLaunch)
  })
}, [])

// While checking first-launch status, render nothing (avoids flash)
if (setupComplete === null) return null

// If first launch, show the wizard instead of LaunchScreen
if (!setupComplete) {
  return <SetupWizard onComplete={() => setSetupComplete(true)} />
}

// ── LaunchScreen gate (existing) ──────────────────────────────────────────
if (!workspaceFiles) {
  return <LaunchScreen ... />
}
```

This goes at approximately line 346 of `src/App.tsx`, immediately before the existing `if (!workspaceFiles)` block.

---

## 6. Preload Surface Additions

Add to `electron/preload.ts` inside the `contextBridge.exposeInMainWorld('flintAPI', { ... })` object:

```typescript
// ── ONBOARD.1: Setup Wizard IPC ──────────────────────────────────────────
setup: {
  /** Detect which IDEs are installed by checking settings file paths. */
  detectIDEs: (): Promise<{
    ides: Array<{
      name: string
      settingsPath: string
      detected: boolean
    }>
    mcpServerPath: string
  }> => ipcRenderer.invoke('setup:detect-ides'),

  /** Check if this is the first launch (no .flint/setup.json). */
  checkFirstLaunch: (): Promise<{ isFirstLaunch: boolean }> =>
    ipcRenderer.invoke('setup:check-first-launch'),

  /** Write the first-launch-complete flag to .flint/setup.json. */
  completeFirstLaunch: (): Promise<void> =>
    ipcRenderer.invoke('setup:complete-first-launch'),
},
```

Note: `detectIDEs` also returns `mcpServerPath` so the renderer can build the snippet without needing a separate IPC call. The path is resolved once in main and sent down.

---

## 7. flint-api.d.ts Additions

Add to the `FlintAPI` interface in `src/types/flint-api.d.ts`:

```typescript
setup: {
  detectIDEs: () => Promise<{
    ides: Array<{
      name: 'Claude Code' | 'Cursor' | 'VS Code'
      settingsPath: string
      detected: boolean
    }>
    mcpServerPath: string
  }>
  checkFirstLaunch: () => Promise<{ isFirstLaunch: boolean }>
  completeFirstLaunch: () => Promise<void>
}
```

---

## 8. Commandment Checklist

| # | Commandment | Applies | How Satisfied |
|---|------------|---------|---------------|
| 4 | Local-First Only | YES | IDE detection uses `existsSync` on local paths. No network calls during setup. The verify step uses the existing MCP client which is a local stdio child process. |
| 9 | Process Boundary | YES | All filesystem access (IDE detection, setup flag read/write) happens in `electron/main.ts` via IPC. Renderer uses `window.flintAPI.setup.*` only. |
| 12 | Atomic Queuing | NO | `setup.json` is a config flag, not source code. Direct `writeFile` is acceptable here -- FileTransactionManager is for source files. |
| 14 | Bypass Prohibition | PARTIAL | The setup flag write uses `fs.writeFile` directly because it is a config file in `~/.flint/`, not a project source file. This is consistent with how `ai:save-config` handles `~/.flint/config.json` in the existing codebase. |

No other commandments apply. This feature does not touch AST, tokens, design drift, undo/redo, or exports.

---

## 9. Implementation Order

### Group 1 (parallel) — IPC Layer

**Agent: flint-electron-ipc**

1. Add three IPC handlers to `electron/main.ts`:
   - `setup:detect-ides` — IDE detection logic with `existsSync`
   - `setup:check-first-launch` — read `~/.flint/setup.json`
   - `setup:complete-first-launch` — write `~/.flint/setup.json`
2. Add `setup` namespace to `electron/preload.ts`
3. Add types to `src/types/flint-api.d.ts`

### Group 2 (parallel with Group 1) — UI Component

**Agent: flint-design-engineer**

1. Create `src/components/ui/SetupWizard.tsx` — all 5 steps as described in section 5.1
2. Modify `src/App.tsx` — add wizard gate as described in section 5.2

### Group 3 (after Groups 1+2) — Tests

**Agent: flint-test-writer**

1. Create `electron/__tests__/setupIpc.test.ts`:
   - `setup:detect-ides`: returns correct structure, handles missing files, handles all-missing case
   - `setup:check-first-launch`: returns `true` when file missing, `false` when flag set, `true` on corrupt JSON
   - `setup:complete-first-launch`: creates directory if needed, writes valid JSON, idempotent on re-call
2. Create `src/components/ui/__tests__/SetupWizard.test.tsx`:
   - Renders welcome step on mount
   - Advances through all 5 steps
   - Calls `detectIDEs` on ide-detect step entry
   - Auto-selects first detected IDE
   - Manual override (selecting undetected IDE) works
   - Copy button writes to clipboard
   - Verify step: success path shows green
   - Verify step: error path shows red with message
   - Skip link calls `onComplete`
   - Escape key calls `onComplete`
   - Done step calls `completeFirstLaunch` then `onComplete`
   - Back button navigates correctly
3. Test that `App.tsx` renders wizard when `checkFirstLaunch` returns `isFirstLaunch: true`
4. Test that `App.tsx` renders LaunchScreen when `checkFirstLaunch` returns `isFirstLaunch: false`

### Group 4 (after Group 3) — Validation

**Agent: flint-integration-validator**

- Run full test suites: `npm test`, `npm run test:react`, `cd flint-mcp && npm test`
- Run `npx tsc --noEmit`
- Confirm no regressions against baseline (2,875 tests, 0 TSC errors)

---

## 10. Risks

| Risk | Severity | Mitigation | Commandment Threatened |
|------|----------|-----------|----------------------|
| `process.resourcesPath` differs between dev and packaged builds | Medium | Use `app.isPackaged` guard matching existing `mcpClient.ts` line 75 pattern | 4 (Local-First) |
| Claude Code uses `~/.claude/mcp.json` not `~/.claude/settings.json` for MCP config | High | The IDE detection checks `settings.json` to confirm Claude Code is installed. The snippet JSON must target `~/.claude/mcp.json` as the paste destination. These are different files -- detection file vs. config file. Document clearly in the UI. | None |
| Wizard blocks app on IPC failure | Medium | `checkFirstLaunch` has a 3-second timeout; on timeout, treat as `isFirstLaunch: false` (skip wizard). Wizard escape key always works. | None |
| Existing `OnboardingOverlay` conflict | Low | `OnboardingOverlay` is a post-project-open tooltip tour (localStorage-gated). `SetupWizard` is a pre-LaunchScreen full-screen wizard (file-gated). They serve different purposes at different lifecycle points. No conflict. | None |
| macOS-only IDE paths | Low | v1 is macOS only. Linux paths (`~/.config/Code/`) can be added in a follow-up by extending the path table in the IPC handler. The handler already uses `os.homedir()` as base. | None |

---

## 11. MCP Snippet Templates

### Claude Code (`~/.claude/mcp.json`)

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

User instruction: "Save this as `~/.claude/mcp.json` (create the file if it doesn't exist)."

### Cursor (`~/Library/Application Support/Cursor/User/settings.json`)

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

User instruction: "Add this to your Cursor settings.json. If a `mcpServers` key already exists, merge the `flint` entry into it."

### VS Code (`~/Library/Application Support/Code/User/settings.json`)

```json
{
  "mcp": {
    "servers": {
      "flint": {
        "command": "node",
        "args": ["{mcpServerPath}"]
      }
    }
  }
}
```

User instruction: "Add this to your VS Code settings.json. If an `mcp.servers` key already exists, merge the `flint` entry into it."

---

## 12. Visual Design Notes

- Full-screen wizard on a `bg-gray-950` background with a centered card (`max-w-lg`)
- Card uses `bg-gray-900 border border-gray-800 rounded-xl shadow-2xl`
- Primary CTA: `bg-indigo-600 hover:bg-indigo-500 text-white` (matches existing Flint palette)
- Skip links: `text-zinc-500 hover:text-zinc-400 text-xs underline`
- Code block for MCP snippet: `bg-gray-950 border border-gray-700 rounded-lg font-mono text-xs p-4` with horizontal scroll
- Step dots: same pattern as existing `OnboardingOverlay` (section 5.1 of that component)
- IDE list items: `border border-gray-700 rounded-lg p-3` with radio-style selection highlight
- Green check for detected IDEs: `text-emerald-400`
- Verify success: `text-emerald-400` with `CheckCircle` icon
- Verify error: `text-red-400` with `XCircle` icon
- Use `lucide-react` icons only (already in the project): `CheckCircle`, `XCircle`, `Copy`, `Check`, `ChevronRight`, `ChevronLeft`, `Loader2`

---

## 13. Clarifications for Claude Code MCP Path

The detection step checks `~/.claude/settings.json` to confirm Claude Code is installed. However, the MCP snippet must be pasted into `~/.claude/mcp.json` (a different file). The `DetectedIDE` type for Claude Code should set:
- `settingsPath` to `~/.claude/mcp.json` (the file the user needs to edit)
- Detection logic checks `~/.claude/settings.json` (the file that proves the IDE exists)

This distinction must be clear in both the IPC handler implementation and the wizard UI text.
