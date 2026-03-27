/**
 * autoUpdater.ts — electron-updater integration for Flint Glass.
 *
 * Wraps electron-updater's autoUpdater singleton with:
 *   - Beta / stable channel support (allowPrerelease flag)
 *   - Event forwarding to the renderer via BrowserWindow IPC
 *   - Graceful offline handling (Commandment 4: local-first)
 *   - Periodic update checks (every 4 hours, matching betaGuard cadence)
 *
 * Coexistence with betaGuard.ts:
 *   betaGuard  — compile-time expiry enforcement + remote kill switch.
 *   autoUpdater — real update delivery via GitHub Releases (electron-updater).
 *   Both run in parallel. betaGuard is the safety net; autoUpdater is delivery.
 *
 * The update check is the only network call this module makes.
 * It is fire-and-forget with silent error handling for offline users.
 */

import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'
import { ipcChannel } from '../shared/brand.js'

// ── Module state ─────────────────────────────────────────────────────────────

/** Reference to the main window for push event forwarding. */
let mainWin: BrowserWindow | null = null

/** Active update channel. Defaults to 'beta' during the beta period. */
let currentChannel: 'stable' | 'beta' = 'beta'

/** Handle for the periodic check interval so we can stop it on quit. */
let periodicCheckTimer: ReturnType<typeof setInterval> | null = null

/** How often to check for updates automatically (4 hours). */
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/** Delay before the initial on-launch check (10 s — lets the renderer mount first). */
const INITIAL_CHECK_DELAY_MS = 10_000

// ── Internal helpers ──────────────────────────────────────────────────────────

function send(channel: string, payload: unknown): void {
    if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send(channel, payload)
    }
}

function normalizeReleaseNotes(notes: string | Array<{ note: string }> | null | undefined): string | null {
    if (typeof notes === 'string') return notes
    if (Array.isArray(notes)) return notes.map((n) => n.note).join('\n')
    return null
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize the auto-updater. Call once after the main BrowserWindow is created.
 * Registers all event handlers and schedules the initial update check.
 */
export function initAutoUpdater(win: BrowserWindow): void {
    mainWin = win

    // Configuration — user must confirm download; install on quit for convenience.
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = currentChannel === 'beta'

    // ── Event: update-available ───────────────────────────────────────────────
    autoUpdater.on('update-available', (info) => {
        send(ipcChannel('auto-update:available'), {
            version: info.version,
            releaseNotes: normalizeReleaseNotes(info.releaseNotes),
            releaseDate: info.releaseDate,
            isBeta: info.version.includes('beta'),
        })
    })

    // ── Event: update-not-available ───────────────────────────────────────────
    // No renderer push needed — absence of the badge IS the signal.

    // ── Event: download-progress ──────────────────────────────────────────────
    autoUpdater.on('download-progress', (progress) => {
        send(ipcChannel('auto-update:progress'), {
            bytesPerSecond: progress.bytesPerSecond,
            percent: progress.percent,
            total: progress.total,
            transferred: progress.transferred,
        })
    })

    // ── Event: update-downloaded ──────────────────────────────────────────────
    autoUpdater.on('update-downloaded', (info) => {
        send(ipcChannel('auto-update:downloaded'), {
            version: info.version,
            releaseNotes: normalizeReleaseNotes(info.releaseNotes),
            releaseDate: info.releaseDate,
            isBeta: info.version.includes('beta'),
        })
    })

    // ── Event: error ──────────────────────────────────────────────────────────
    // Network errors are expected for offline users. Log but never crash.
    autoUpdater.on('error', (err) => {
        console.warn('[Flint AutoUpdate] Error:', err.message)
        send(ipcChannel('auto-update:error'), { message: err.message })
    })

    // ── Initial check (after renderer has mounted) ────────────────────────────
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {
            // Offline or no releases yet — silent.
        })
    }, INITIAL_CHECK_DELAY_MS)

    // ── Periodic check every 4 hours ──────────────────────────────────────────
    periodicCheckTimer = setInterval(() => {
        autoUpdater.checkForUpdates().catch(() => {
            // Offline — silent.
        })
    }, PERIODIC_CHECK_INTERVAL_MS)
}

/**
 * Manually trigger an update check (called from the IPC handler).
 * Returns the result from electron-updater, which callers use to extract UpdateInfo.
 */
export function checkForUpdates() {
    return autoUpdater.checkForUpdates()
}

/**
 * Begin downloading the available update.
 * Progress events are forwarded to the renderer via 'auto-update:progress'.
 */
export function downloadUpdate() {
    return autoUpdater.downloadUpdate()
}

/**
 * Quit the app and install the downloaded update.
 * This terminates the process — no code after this call executes.
 */
export function quitAndInstall(): void {
    autoUpdater.quitAndInstall()
}

/**
 * Returns the currently active update channel.
 */
export function getUpdateChannel(): 'stable' | 'beta' {
    return currentChannel
}

/**
 * Sets the active update channel.
 * Takes effect on the next checkForUpdates() call.
 */
export function setUpdateChannel(channel: 'stable' | 'beta'): void {
    currentChannel = channel
    autoUpdater.allowPrerelease = channel === 'beta'
}

/**
 * Stops the periodic update check and releases the window reference.
 * Call from the app 'will-quit' handler.
 */
export function stopAutoUpdater(): void {
    if (periodicCheckTimer) {
        clearInterval(periodicCheckTimer)
        periodicCheckTimer = null
    }
    mainWin = null
}
