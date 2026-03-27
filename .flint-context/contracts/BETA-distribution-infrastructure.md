# Contract: BETA Distribution Infrastructure

**Phase:** BETA.1 through BETA.4
**Status:** CONTRACT READY
**Author:** flint-architect
**Date:** 2026-03-27

---

## Existing State Assessment

Significant beta distribution infrastructure already exists from the 2026-03-19 implementation round (originally under the "Bridge" name, now rebranded to Flint). This contract documents the complete current state, identifies gaps, and specifies remaining work.

### Already Implemented (ONLINE)

| Component | File(s) | Status |
|-----------|---------|--------|
| electron-builder config | `electron-builder.yml` | ONLINE -- DMG/NSIS/AppImage, ASAR, source exclusion |
| Self-expiring builds | `electron/betaGuard.ts` | ONLINE -- compile-time `FLINT_BETA_EXPIRY`, remote version check, kill switch |
| Beta IPC surface | `electron/preload.ts` (lines 882-937) | ONLINE -- `beta:get-info`, `beta:submit-feedback`, `beta:load-demo-project`, push events |
| Beta type contracts | `src/types/flint-api.d.ts` (lines 2046-2095) | ONLINE -- `BetaInfo`, `BetaFeedback`, `BetaAPI` |
| In-app feedback widget | `src/components/ui/BetaFeedbackModal.tsx` | ONLINE -- category/severity/description form, saves to `~/.flint/beta-feedback.json` |
| StatusBar beta chip | `src/components/editor/StatusBar.tsx` (lines 586-604) | ONLINE -- "Beta (Xd)" chip, click opens feedback modal |
| Demo project bundling | `build-resources/demo-project/` | ONLINE -- DemoCard.tsx + design-tokens.json, temp dir copy via IPC |
| macOS entitlements | `build-resources/entitlements.mac.plist` | ONLINE -- JIT, unsigned memory, dyld, network client |
| Build scripts | `package.json` scripts | ONLINE -- `build:beta`, `build:beta:mac`, `build:beta:quick`, `build:zip` |
| Full distribution ZIP | `scripts/build-zip.sh` | ONLINE -- Glass + MCP + VSIX + starter kit + START-HERE.txt |
| Before-build hook | `scripts/before-build.cjs` | ONLINE -- Vite build before electron-builder |
| CI: PR validation | `.github/workflows/pr-validate.yml` | ONLINE -- TSC + 3 test suites |
| CI: Build + Release | `.github/workflows/build-release.yml` | ONLINE -- 3-platform matrix, publish to GitHub Releases |
| GitHub Releases publish | `electron-builder.yml` publish section | ONLINE -- provider: github, owner: Jtiem, repo: lunar-elevator-flint |
| electron-updater dep | `package.json` dependencies | ONLINE -- `electron-updater@^6.8.3` already installed |

### Gaps Remaining

| Gap | Severity | Phase |
|-----|----------|-------|
| **Auto-update wiring** -- `electron-updater` is installed as a dependency but never imported or used in `electron/main.ts`. The current version check in `betaGuard.ts` uses a custom `net.fetch` against `FLINT_BETA_VERSION_URL` instead of electron-updater's built-in `autoUpdater`. | HIGH | BETA.3 |
| **Per-platform build scripts** -- No `build:mac`, `build:win`, `build:linux`, `build:all` scripts. Only `build:beta:mac` and `build:beta` exist. Missing dedicated per-platform and release scripts. | MEDIUM | BETA.1 |
| **Release:beta script** -- No `release:beta` script that builds + publishes to GitHub Releases beta channel. | MEDIUM | BETA.1 |
| **Configurable expiry days** -- Hardcoded to 30 days in build scripts. Should accept an env var (default 90). | LOW | BETA.2 |
| **Screenshot capture** in feedback widget -- Current feedback is text-only. Requirements call for screenshot capture. | LOW | BETA.4 |
| **GitHub Issue submission** -- Feedback currently saves only to local JSON. No remote submission. | LOW | BETA.4 |
| **System metadata in feedback** -- OS version and screen dimensions not captured. | LOW | BETA.4 |
| **Beta vs. stable update channels** -- No channel separation. electron-updater supports `channel` config but it is not wired. | MEDIUM | BETA.3 |
| **Notarization config** -- Commented out in `electron-builder.yml`. Needs credential slots. | LOW | BETA.1 |

---

## 1. Impact Map

| File | Change Type | Phase | Owner Agent |
|------|------------|-------|-------------|
| `package.json` | MODIFY -- add build scripts | BETA.1 | `flint-electron-ipc` |
| `electron-builder.yml` | MODIFY -- uncomment notarize, add `releaseInfo` | BETA.1 | `flint-electron-ipc` |
| `electron/autoUpdater.ts` | CREATE -- electron-updater integration module | BETA.3 | `flint-electron-ipc` |
| `electron/main.ts` | MODIFY -- import and initialize autoUpdater, wire IPC handlers | BETA.3 | `flint-electron-ipc` |
| `electron/betaGuard.ts` | MODIFY -- add configurable expiry days, refactor version check to coexist with autoUpdater | BETA.2 + BETA.3 | `flint-electron-ipc` |
| `electron/preload.ts` | MODIFY -- add `beta.checkForUpdates`, `beta.downloadUpdate`, `beta.installUpdate`, `beta.getUpdateChannel`, `beta.setUpdateChannel` | BETA.3 | `flint-electron-ipc` |
| `src/types/flint-api.d.ts` | MODIFY -- add `AutoUpdateAPI` types, extend `BetaAPI` | BETA.3 + BETA.4 | `flint-state-architect` |
| `src/components/ui/BetaFeedbackModal.tsx` | MODIFY -- add screenshot capture, system metadata, optional GitHub Issue submission | BETA.4 | `flint-design-engineer` |
| `src/components/editor/StatusBar.tsx` | MODIFY -- add update download progress indicator | BETA.3 | `flint-design-engineer` |
| `electron/autoUpdater.test.ts` | CREATE -- unit tests for autoUpdater module | BETA.3 | `flint-test-writer` |
| `src/components/ui/__tests__/BetaFeedbackModal.test.tsx` | CREATE -- tests for enhanced feedback modal | BETA.4 | `flint-test-writer` |

---

## 2. Type Contracts

### 2a. Auto-Update Types (new -- `src/types/flint-api.d.ts`)

```typescript
/** Progress info pushed during download. */
export interface UpdateDownloadProgress {
    /** Bytes downloaded so far. */
    bytesPerSecond: number
    /** Percentage complete (0-100). */
    percent: number
    /** Total bytes to download. */
    total: number
    /** Bytes transferred so far. */
    transferred: number
}

/** Update metadata from electron-updater. */
export interface UpdateInfo {
    /** The version string of the available update (e.g. "0.2.0-beta.1"). */
    version: string
    /** Release notes (markdown string or null). */
    releaseNotes: string | null
    /** Release date ISO string. */
    releaseDate: string
    /** Whether this is a beta channel release. */
    isBeta: boolean
}

/** Auto-update IPC surface. Exposed as window.flintAPI.autoUpdate. */
export interface AutoUpdateAPI {
    /** Manually trigger an update check. Returns null if no update, UpdateInfo if available. */
    checkForUpdates: () => Promise<UpdateInfo | null>
    /** Start downloading the available update. Progress pushed via onDownloadProgress. */
    downloadUpdate: () => Promise<void>
    /** Quit the app and install the downloaded update. */
    quitAndInstall: () => void
    /** Get the current update channel ('stable' | 'beta'). */
    getChannel: () => Promise<'stable' | 'beta'>
    /** Set the update channel. Takes effect on next check. */
    setChannel: (channel: 'stable' | 'beta') => Promise<void>
    /** Subscribe to update-available events. Returns unsubscribe fn. */
    onUpdateAvailable: (cb: (info: UpdateInfo) => void) => () => void
    /** Subscribe to download progress events. Returns unsubscribe fn. */
    onDownloadProgress: (cb: (progress: UpdateDownloadProgress) => void) => () => void
    /** Subscribe to update-downloaded (ready to install) events. Returns unsubscribe fn. */
    onUpdateDownloaded: (cb: (info: UpdateInfo) => void) => () => void
    /** Subscribe to update errors. Returns unsubscribe fn. */
    onError: (cb: (error: string) => void) => () => void
}
```

### 2b. Enhanced BetaFeedback (extend existing)

```typescript
/** Extend existing BetaFeedback with system metadata. */
export interface BetaFeedback {
    category: BetaFeedbackCategory
    description: string
    severity: BetaFeedbackSeverity
    context?: string
    /** Base64-encoded PNG screenshot, or null if user declined. */
    screenshot?: string | null
    /** System metadata auto-collected at submission time. */
    system?: {
        os: string           // e.g. "darwin-arm64"
        osVersion: string    // e.g. "25.3.0"
        screenWidth: number
        screenHeight: number
        devicePixelRatio: number
    }
}
```

### 2c. AutoUpdater Module Shape (`electron/autoUpdater.ts`)

```typescript
import type { BrowserWindow } from 'electron'

/** Initialize electron-updater. Call once after app.whenReady(). */
export function initAutoUpdater(win: BrowserWindow): void

/** Manually trigger an update check. */
export function checkForUpdates(): Promise<UpdateCheckResult | null>

/** Get the current channel. */
export function getUpdateChannel(): 'stable' | 'beta'

/** Set the update channel. */
export function setUpdateChannel(channel: 'stable' | 'beta'): void

/** Stop any polling. Call on app quit. */
export function stopAutoUpdater(): void
```

---

## 3. IPC Channels

### Existing (no changes needed)

| Channel | Direction | Payload | Return |
|---------|-----------|---------|--------|
| `beta:get-info` | renderer -> main | none | `BetaInfo` |
| `beta:submit-feedback` | renderer -> main | `BetaFeedback` | `{ saved: boolean }` |
| `beta:load-demo-project` | renderer -> main | none | `{ projectPath: string } \| { error: string }` |
| `flint:beta:update-available` | main -> renderer (push) | `BetaUpdateEvent` | -- |
| `flint:beta:expired-remote` | main -> renderer (push) | `{ message: string }` | -- |

### New (BETA.3)

| Channel | Direction | Payload | Return |
|---------|-----------|---------|--------|
| `auto-update:check` | renderer -> main | none | `UpdateInfo \| null` |
| `auto-update:download` | renderer -> main | none | `void` |
| `auto-update:install` | renderer -> main | none | -- (app quits) |
| `auto-update:get-channel` | renderer -> main | none | `'stable' \| 'beta'` |
| `auto-update:set-channel` | renderer -> main | `{ channel: 'stable' \| 'beta' }` | `void` |
| `flint:auto-update:available` | main -> renderer (push) | `UpdateInfo` | -- |
| `flint:auto-update:progress` | main -> renderer (push) | `UpdateDownloadProgress` | -- |
| `flint:auto-update:downloaded` | main -> renderer (push) | `UpdateInfo` | -- |
| `flint:auto-update:error` | main -> renderer (push) | `{ message: string }` | -- |

---

## 4. Store Contracts

No new Zustand stores are required. Auto-update state is transient and managed in component-local `useState` hooks within `StatusBar.tsx`. This avoids adding a store for state that only one component consumes and that resets on app restart.

---

## 5. Component Contracts

### 5a. StatusBar Update Indicator (BETA.3)

```
Location: src/components/editor/StatusBar.tsx (modify existing)
Props: none (new state is internal)
Store deps: none
IPC calls: window.flintAPI.autoUpdate.onUpdateAvailable,
           window.flintAPI.autoUpdate.onDownloadProgress,
           window.flintAPI.autoUpdate.onUpdateDownloaded,
           window.flintAPI.autoUpdate.downloadUpdate,
           window.flintAPI.autoUpdate.quitAndInstall

Behavior:
  - When an update is available: show a small "Update available: vX.Y.Z" badge
    next to the beta chip. Click triggers download.
  - During download: replace badge text with progress percentage + thin progress bar.
  - When downloaded: badge changes to "Restart to update". Click calls quitAndInstall.
```

### 5b. BetaFeedbackModal Enhancements (BETA.4)

```
Location: src/components/ui/BetaFeedbackModal.tsx (modify existing)
Props: unchanged -- { open: boolean; onClose: () => void }
Store deps: none (new)
IPC calls: unchanged -- window.flintAPI.beta.submitFeedback (payload grows)

New behavior:
  - "Attach screenshot" toggle button above the submit row.
    On click: calls window.flintAPI.beta.captureScreenshot() which returns
    base64 PNG (uses BrowserWindow.capturePage() in main process).
    Shows a thumbnail preview of the captured screenshot.
  - System metadata auto-collected at submit time via:
    navigator.platform, screen.width, screen.height, devicePixelRatio.
    OS version comes from window.flintAPI.beta.getInfo() (already available).
  - Optional GitHub Issue submission: if FLINT_FEEDBACK_GITHUB_TOKEN is set
    at build time, feedback is also POSTed to GitHub Issues via the main process.
    Otherwise, local-only save is the default (respects Commandment 4).
```

---

## 6. electron-builder Configuration

### Current State

The `electron-builder.yml` is already comprehensive. Key properties:

- `appId: com.flint.glass`
- `productName: Flint Glass`
- macOS: DMG for arm64 + x64, hardened runtime, entitlements
- Windows: NSIS x64
- Linux: AppImage x64
- `asar: true` with native module unpacking
- `publish: github` (owner: Jtiem, repo: lunar-elevator-flint)
- Source code excluded from builds

### Changes Needed (BETA.1)

```yaml
# Add to electron-builder.yml under mac:

mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch:
        - arm64
        - x64
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build-resources/entitlements.mac.plist
  entitlementsInherit: build-resources/entitlements.mac.plist
  # Credential slots -- populated via environment variables.
  # To enable signing: set CSC_LINK and CSC_KEY_PASSWORD env vars.
  # To enable notarization: set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID.
  notarize:
    teamId: ${env.APPLE_TEAM_ID}
  # Note: notarize block is only active when APPLE_TEAM_ID is set.
  # electron-builder gracefully skips notarization when env vars are empty.
```

### Build Scripts (BETA.1)

Add to `package.json` scripts:

```json
{
  "build:mac": "npm run build && npx electron-builder --mac --config electron-builder.yml",
  "build:win": "npm run build && npx electron-builder --win --config electron-builder.yml",
  "build:linux": "npm run build && npx electron-builder --linux --config electron-builder.yml",
  "build:all": "npm run build && npx electron-builder -mwl --config electron-builder.yml",
  "release:beta": "npm run build && FLINT_BETA_EXPIRY=$(node -p \"new Date(Date.now()+(${FLINT_BETA_DAYS:-90})*864e5).toISOString().split('T')[0]+'T00:00:00Z'\") FLINT_BETA_BUILD_ID=beta-$(node -p \"require('./package.json').version\")-$(date +%Y%m%d) npx electron-builder --publish always --config electron-builder.yml"
}
```

---

## 7. Self-Expiry Implementation

### Current State (ONLINE)

The self-expiry system is fully implemented:

1. **Build time:** `FLINT_BETA_EXPIRY` env var set in build scripts (ISO 8601 date, default 30 days from build).
2. **Boot gate:** `checkBetaExpiry()` in `electron/betaGuard.ts` runs synchronously before any `BrowserWindow` is created. If `new Date() > expiryDate`, shows an `ErrorBox` and calls `app.quit()`.
3. **Dev passthrough:** When `FLINT_BETA_EXPIRY` is empty (dev builds), the guard returns `true` immediately.
4. **Remote override:** `startVersionCheck()` periodically fetches a manifest from `FLINT_BETA_VERSION_URL`. The manifest can override expiry (`expires` field) or kill the beta entirely (`active: false`).
5. **Renderer visibility:** `getBetaInfo()` returns `{ buildId, expiryDate, daysRemaining, isBeta }` via `beta:get-info` IPC. StatusBar displays "Beta (Xd)".

### Changes Needed (BETA.2)

Minimal -- make expiry days configurable via `FLINT_BETA_DAYS` env var (default 90 instead of 30):

- **`package.json` build scripts**: Replace hardcoded `30*864e5` with `(${FLINT_BETA_DAYS:-90})*864e5`.
- **`scripts/build-zip.sh`**: Same change, line 33.

No changes needed to `betaGuard.ts` itself -- it already reads the ISO date from the env var agnostically.

---

## 8. Auto-Update Wiring (BETA.3)

### Architecture

```
electron-updater (GitHub Releases)
        |
        v
electron/autoUpdater.ts   <-- new module, owns all autoUpdater state
        |
        v  (push events via BrowserWindow.webContents.send)
electron/preload.ts        <-- new contextBridge methods under autoUpdate
        |
        v
StatusBar.tsx              <-- subscribes to push events, shows UI
```

### electron/autoUpdater.ts (new file)

```typescript
/**
 * autoUpdater.ts -- electron-updater integration for Flint Glass.
 *
 * Wraps electron-updater's autoUpdater singleton with:
 *   - Beta / stable channel support
 *   - Event forwarding to the renderer via BrowserWindow IPC
 *   - Graceful offline handling (Commandment 4: local-first)
 *
 * The update check is the ONLY network call the app makes
 * (besides the existing betaGuard version check, which this replaces
 * for production builds).
 */

import { autoUpdater } from 'electron-updater'
import { ipcChannel, logTag } from '../shared/brand.js'
import type { BrowserWindow } from 'electron'

let mainWin: BrowserWindow | null = null
let currentChannel: 'stable' | 'beta' = 'beta'  // default to beta during beta period

export function initAutoUpdater(win: BrowserWindow): void {
    mainWin = win

    // Configuration
    autoUpdater.autoDownload = false          // user must confirm
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = currentChannel === 'beta'

    // Event forwarding
    autoUpdater.on('update-available', (info) => {
        if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send(ipcChannel('auto-update:available'), {
                version: info.version,
                releaseNotes: typeof info.releaseNotes === 'string'
                    ? info.releaseNotes : null,
                releaseDate: info.releaseDate,
                isBeta: info.version.includes('beta'),
            })
        }
    })

    autoUpdater.on('download-progress', (progress) => {
        if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send(ipcChannel('auto-update:progress'), {
                bytesPerSecond: progress.bytesPerSecond,
                percent: progress.percent,
                total: progress.total,
                transferred: progress.transferred,
            })
        }
    })

    autoUpdater.on('update-downloaded', (info) => {
        if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send(ipcChannel('auto-update:downloaded'), {
                version: info.version,
                releaseNotes: typeof info.releaseNotes === 'string'
                    ? info.releaseNotes : null,
                releaseDate: info.releaseDate,
                isBeta: info.version.includes('beta'),
            })
        }
    })

    autoUpdater.on('error', (err) => {
        // Network errors are expected for offline users. Log but don't crash.
        console.warn(logTag('AutoUpdate'), 'Error:', err.message)
        if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send(ipcChannel('auto-update:error'), {
                message: err.message,
            })
        }
    })

    // Initial check on launch (after 10s delay to let the app settle)
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {
            // Offline or no releases yet. Silent.
        })
    }, 10_000)
}

export function checkForUpdates() {
    return autoUpdater.checkForUpdates()
}

export function downloadUpdate() {
    return autoUpdater.downloadUpdate()
}

export function quitAndInstall() {
    autoUpdater.quitAndInstall()
}

export function getUpdateChannel(): 'stable' | 'beta' {
    return currentChannel
}

export function setUpdateChannel(channel: 'stable' | 'beta'): void {
    currentChannel = channel
    autoUpdater.allowPrerelease = channel === 'beta'
}

export function stopAutoUpdater(): void {
    // electron-updater does not have a stop method, but we clear the window ref
    mainWin = null
}
```

### Integration in electron/main.ts

```typescript
// At import block:
import { initAutoUpdater, checkForUpdates, downloadUpdate,
         quitAndInstall, getUpdateChannel, setUpdateChannel,
         stopAutoUpdater } from './autoUpdater.js'

// In createWindow(), after startVersionCheck(mainWindow):
initAutoUpdater(mainWindow)

// In app.on('will-quit'):
stopAutoUpdater()

// New IPC handlers (at the bottom with other beta IPC):
ipcMain.handle('auto-update:check', async () => {
    const result = await checkForUpdates()
    if (!result?.updateInfo) return null
    const info = result.updateInfo
    return {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string'
            ? info.releaseNotes : null,
        releaseDate: info.releaseDate,
        isBeta: info.version.includes('beta'),
    }
})

ipcMain.handle('auto-update:download', () => downloadUpdate())
ipcMain.handle('auto-update:install', () => quitAndInstall())
ipcMain.handle('auto-update:get-channel', () => getUpdateChannel())
ipcMain.handle('auto-update:set-channel', (_e, payload: unknown) => {
    const { channel } = payload as { channel: string }
    if (channel !== 'stable' && channel !== 'beta') {
        throw new Error('auto-update:set-channel -- invalid channel')
    }
    setUpdateChannel(channel)
})
```

### Coexistence with betaGuard.ts

The existing `betaGuard.ts` version check (`startVersionCheck`) and the new `autoUpdater` serve different purposes:

- **betaGuard**: Compile-time expiry enforcement + remote kill switch. This is the safety net that prevents stale betas from running at all.
- **autoUpdater**: Real update delivery. Downloads and installs new versions from GitHub Releases.

Both can coexist. In production builds with `FLINT_BETA_VERSION_URL` set, betaGuard handles the kill switch while autoUpdater handles the actual download. In builds without `FLINT_BETA_VERSION_URL`, only autoUpdater runs.

---

## 9. Feedback Widget Enhancements (BETA.4)

### Screenshot Capture

New IPC channel in preload:

```typescript
// In preload.ts, beta section:
captureScreenshot: (): Promise<string> =>
    ipcRenderer.invoke('beta:capture-screenshot'),
```

New handler in main.ts:

```typescript
ipcMain.handle('beta:capture-screenshot', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) throw new Error('No focused window')
    const image = await win.capturePage()
    // Resize to max 1200px wide for reasonable file size
    const resized = image.resize({ width: Math.min(image.getSize().width, 1200) })
    return resized.toPNG().toString('base64')
})
```

### System Metadata

Collected in the renderer at submit time (no IPC needed):

```typescript
const system = {
    os: `${navigator.platform}`,
    osVersion: navigator.userAgent,  // best we can get from renderer
    screenWidth: screen.width,
    screenHeight: screen.height,
    devicePixelRatio: window.devicePixelRatio,
}
```

### GitHub Issue Submission (Optional)

When `FLINT_FEEDBACK_GITHUB_TOKEN` is set at build time, the main process posts feedback to GitHub Issues after saving locally:

```typescript
// In beta:submit-feedback handler, after local save:
const ghToken = process.env.FLINT_FEEDBACK_GITHUB_TOKEN
if (ghToken) {
    try {
        const { net } = require('electron')
        const body = JSON.stringify({
            title: `[Beta Feedback] ${fb.category} / ${fb.severity}: ${fb.description.slice(0, 80)}`,
            body: [
                `**Category:** ${fb.category}`,
                `**Severity:** ${fb.severity}`,
                `**Build:** ${getBetaInfo().buildId}`,
                `**Platform:** ${process.platform}-${process.arch}`,
                '',
                fb.description,
            ].join('\n'),
            labels: ['beta-feedback', fb.severity],
        })
        await net.fetch('https://api.github.com/repos/Jtiem/lunar-elevator-flint/issues', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ghToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
            },
            body,
        })
    } catch {
        // GitHub submission failed. Local save already succeeded. Silent.
    }
}
```

This respects Commandment 4 (local-first): the GitHub POST is best-effort, never blocks the UI, and the local save is the primary persistence path.

---

## 10. Commandment Checklist

| # | Commandment | Applicable | How Satisfied |
|---|-------------|:----------:|---------------|
| 1 | Code is Truth | No | Beta infra is not AST mutation work |
| 2 | No Hallucinated Styling | No | No visual edits to user code |
| 3 | Composite IDs for Arrays | No | No array rendering in scope |
| 4 | **Local-First Only** | **YES** | Auto-update check is the only network call. Feedback saves locally first, GitHub POST is best-effort. App works fully offline. betaGuard silently handles network failures. |
| 5 | Accessibility is a Compiler Error | Partial | BetaFeedbackModal uses `role="dialog"`, `aria-modal`, `aria-label`, `aria-labelledby`. StatusBar badge has `title` text. No new a11y violations introduced. |
| 6 | The Gatekeeper Rule | No | Not export-related |
| 7 | ID Preservation | No | No AST ops |
| 8 | Audit-First Execution | No | No AI routing |
| 9 | CIEDE2000 | No | No color operations |
| 10 | Targeted Micro-Recovery | No | No undo ops |
| 11 | Surgical Git Transplants | No | No git ops |
| 12 | **Atomic Queuing** | **YES** | Feedback file writes use try/catch with JSON parse + splice. Not routed through FileTransactionManager because `~/.flint/beta-feedback.json` is outside the project workspace. This is acceptable -- FTM is for project files. |
| 13 | Deterministic Surgery | No | No AST modification |
| 14 | Bypass Prohibition | Partial | Feedback writes to `~/.flint/` (user home, not project dir) so FTM/GitManager are not applicable. |
| 15 | AST Tool Catalog Only | No | No AI orchestration |
| 16 | In-Memory Validation | No | No AI output |

### Process Boundary Compliance

All new functionality respects the process boundary:

- `electron/autoUpdater.ts` -- main process only (Node.js, electron-updater)
- `electron/preload.ts` additions -- `contextBridge` surface, no direct `ipcRenderer` exposure
- `src/components/` changes -- renderer only, calls `window.flintAPI` exclusively
- No `fs`, `sqlite`, or Node.js imports in `src/`

---

## 11. Implementation Order

### BETA.1 -- Build Scripts + Config Polish (1 agent, ~30 min)

**Owner:** `flint-electron-ipc`
**Depends on:** nothing

1. Add `build:mac`, `build:win`, `build:linux`, `build:all` scripts to `package.json`.
2. Add `release:beta` script with configurable `FLINT_BETA_DAYS` (default 90).
3. Update `electron-builder.yml`:
   - Uncomment notarize block with env var slots.
   - Add `releaseInfo` section for release notes.
4. Update `scripts/build-zip.sh` to use `FLINT_BETA_DAYS` env var.
5. Run TSC to verify no type errors introduced.

### BETA.2 -- Configurable Expiry (1 agent, ~15 min)

**Owner:** `flint-electron-ipc`
**Depends on:** BETA.1

1. Update all build scripts to use `FLINT_BETA_DAYS` (default 90) instead of hardcoded 30.
2. Verify betaGuard.ts needs no changes (it already reads ISO date from env).
3. Test: run `FLINT_BETA_DAYS=7 npm run build:beta:mac` and verify the 7-day expiry is baked in.

### BETA.3 -- Auto-Update Channel (1 agent, ~2 hours)

**Owner:** `flint-electron-ipc`
**Depends on:** BETA.1

1. Create `electron/autoUpdater.ts` per the spec above.
2. Add IPC handlers in `electron/main.ts`.
3. Add `autoUpdate` surface to `electron/preload.ts`.
4. Add `AutoUpdateAPI`, `UpdateInfo`, `UpdateDownloadProgress` types to `src/types/flint-api.d.ts`.
5. Add update indicator UI to `StatusBar.tsx`:
   - "Update available" badge with version.
   - Download progress bar.
   - "Restart to update" badge.
6. Write `electron/autoUpdater.test.ts` -- mock `electron-updater` autoUpdater, verify event forwarding and channel switching.
7. Run full test suite + TSC.

**Parallelism note:** BETA.3 and BETA.4 can run in parallel once BETA.1 is complete.

### BETA.4 -- Feedback Widget Enhancements (1 agent, ~1 hour)

**Owner:** `flint-design-engineer`
**Depends on:** BETA.1

1. Add `beta:capture-screenshot` IPC handler in `electron/main.ts`.
2. Add `captureScreenshot` to preload beta surface.
3. Enhance `BetaFeedbackModal.tsx`:
   - Add screenshot capture button + thumbnail preview.
   - Add system metadata collection at submit time.
   - Extend the `BetaFeedback` type in `flint-api.d.ts` with `screenshot` and `system` fields.
4. Add optional GitHub Issue submission in the `beta:submit-feedback` handler (gated by `FLINT_FEEDBACK_GITHUB_TOKEN`).
5. Write `src/components/ui/__tests__/BetaFeedbackModal.test.tsx`.
6. Run full test suite + TSC.

---

## 12. Credential Requirements

| Credential | Purpose | Where to Set | When Needed |
|------------|---------|-------------|-------------|
| `GH_TOKEN` | GitHub Releases upload | GitHub Secrets | CI release builds |
| `CSC_LINK` | macOS code signing (.p12 base64) | GitHub Secrets | CI macOS builds |
| `CSC_KEY_PASSWORD` | .p12 password | GitHub Secrets | CI macOS builds |
| `APPLE_ID` | macOS notarization | GitHub Secrets | CI macOS builds |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS notarization | GitHub Secrets | CI macOS builds |
| `APPLE_TEAM_ID` | macOS notarization | GitHub Secrets | CI macOS builds |
| `WIN_CSC_LINK` | Windows Authenticode (.pfx base64) | GitHub Secrets | CI Windows builds |
| `WIN_CSC_KEY_PASSWORD` | .pfx password | GitHub Secrets | CI Windows builds |
| `FLINT_FEEDBACK_GITHUB_TOKEN` | Feedback -> GitHub Issues | Build-time env var | Optional, BETA.4 |

**Account costs:**
- Apple Developer Program: $99/year (required for notarization)
- Azure Trusted Signing or equivalent: ~$120/year (required for Windows Authenticode)
- GitHub: Free (public repo) or existing plan (private repo)

---

## 13. Risks

| Risk | Severity | Mitigation | Commandment |
|------|----------|-----------|-------------|
| Auto-update fetches from GitHub on every launch | Medium | 10-second delay, `autoDownload: false`, silent catch on network errors. The app never blocks on the check. | Cmd 4 (Local-First) |
| GitHub Issue feedback could leak file paths | Low | The `context` field already uses build ID only. New `system` metadata has no file paths. Active file path is NOT included unless we explicitly add it. | Cmd 4 |
| Screenshot capture could capture sensitive content | Low | Screenshot is user-initiated (click required), thumbnail previewed before send, local save only unless GitHub token is set. | -- |
| electron-updater requires GitHub Releases to be configured correctly | Medium | `publish` section in `electron-builder.yml` is already configured. Test with a manual `v0.1.1-beta.1` tag before relying on CI. | -- |
| macOS notarization fails without creds | None | electron-builder gracefully skips notarization when `APPLE_TEAM_ID` is empty. Local builds remain unsigned (with `xattr -cr` workaround). | -- |
| `build:all` script tries cross-compilation | Medium | Electron-builder can only build for the host OS natively (macOS builds require macOS, etc.). `build:all` only works in CI matrix or on macOS (which can cross-compile to Linux but not Windows). Document this. | -- |

---

## 14. Summary

The beta distribution infrastructure is approximately 80% built. The major gap is **BETA.3 (auto-update via electron-updater)** -- the dependency is installed but not wired. The remaining work is:

1. **BETA.1** (30 min): Polish build scripts, add per-platform scripts, make notarization config ready.
2. **BETA.2** (15 min): Trivial -- change `30` to `${FLINT_BETA_DAYS:-90}` in build scripts.
3. **BETA.3** (2 hrs): Create `autoUpdater.ts`, wire IPC, add StatusBar UI. This is the main new work.
4. **BETA.4** (1 hr): Screenshot capture, system metadata, optional GitHub Issues. Nice-to-have polish.

Total estimated effort: ~4 hours across 2 parallel agents after BETA.1 completes.
