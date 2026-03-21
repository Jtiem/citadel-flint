/**
 * betaGuard.ts — Self-expiring beta build guard with remote version check.
 *
 * Compile-time environment variables:
 *   FLINT_BETA_EXPIRY    — ISO 8601 date string (default: 30 days from build)
 *   FLINT_BETA_BUILD_ID  — Human-readable build identifier (default: 'dev-local')
 *   FLINT_BETA_VERSION_URL — URL to a JSON file for remote expiry/version checks
 *
 * Behavior:
 *   1. On app.whenReady(), call `checkBetaExpiry()`.
 *      If expired → show dialog, quit, return false.
 *   2. On window creation, call `startVersionCheck(win)`.
 *      Periodically fetches the remote version manifest and pushes
 *      'beta:update-available' events to the renderer for toast display.
 */

import { app, dialog, BrowserWindow, net } from 'electron'

// ── Compile-time constants ──────────────────────────────────────────────────

const BETA_EXPIRY_ISO = process.env.FLINT_BETA_EXPIRY || ''
const BETA_BUILD_ID   = process.env.FLINT_BETA_BUILD_ID || 'dev-local'
const VERSION_URL     = process.env.FLINT_BETA_VERSION_URL || ''

// Check interval: every 4 hours
const VERSION_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

// ── Remote manifest shape ───────────────────────────────────────────────────

interface BetaManifest {
    /** Whether the beta program is still active. false = kill switch. */
    active: boolean
    /** ISO 8601 expiry override. Takes precedence over the compiled expiry. */
    expires?: string
    /** Latest available beta version string (e.g. "0.2.0-beta.3") */
    latestVersion?: string
    /** Download URL for the latest beta build */
    downloadUrl?: string
    /** Short message shown in the update toast */
    message?: string
}

// ── Expiry check (synchronous gate) ─────────────────────────────────────────

/**
 * Checks whether the beta build has expired.
 * Must be called before any BrowserWindow is created.
 *
 * Returns true if the app should continue, false if it should quit.
 */
export function checkBetaExpiry(): boolean {
    // No expiry set = dev build, always allow
    if (!BETA_EXPIRY_ISO) return true

    const expiryDate = new Date(BETA_EXPIRY_ISO)
    if (isNaN(expiryDate.getTime())) {
        console.warn('[Flint Beta] Invalid expiry date:', BETA_EXPIRY_ISO)
        return true
    }

    const now = new Date()

    if (now > expiryDate) {
        dialog.showErrorBox(
            'Flint Beta Expired',
            `This beta build (${BETA_BUILD_ID}) expired on ${expiryDate.toLocaleDateString()}.\n\n` +
            'Please contact the Flint team for an updated build.'
        )
        app.quit()
        return false
    }

    const daysRemaining = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    console.log(`[Flint Beta] Build ${BETA_BUILD_ID} — ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`)

    return true
}

// ── Remote version check (async, non-blocking) ─────────────────────────────

let versionCheckTimer: ReturnType<typeof setInterval> | null = null

/**
 * Starts periodic remote version checks. If a newer beta is available or the
 * beta program has been deactivated remotely, pushes events to the renderer.
 *
 * Safe to call when VERSION_URL is empty — it becomes a no-op.
 */
export function startVersionCheck(win: BrowserWindow): void {
    if (!VERSION_URL) return

    const check = () => void fetchManifest(win)

    // Check once on startup (after a short delay to let the renderer mount)
    setTimeout(check, 5_000)

    // Then every 4 hours
    versionCheckTimer = setInterval(check, VERSION_CHECK_INTERVAL_MS)
}

/** Stops the periodic version check. Call on app quit. */
export function stopVersionCheck(): void {
    if (versionCheckTimer) {
        clearInterval(versionCheckTimer)
        versionCheckTimer = null
    }
}

async function fetchManifest(win: BrowserWindow): Promise<void> {
    try {
        const response = await net.fetch(VERSION_URL)
        if (!response.ok) return

        const manifest: BetaManifest = await response.json() as BetaManifest

        // Kill switch — remote deactivation
        if (manifest.active === false) {
            if (!win.isDestroyed()) {
                win.webContents.send('beta:expired-remote', {
                    message: manifest.message || 'This beta has been deactivated.',
                })
            }
            return
        }

        // Remote expiry override
        if (manifest.expires) {
            const remoteExpiry = new Date(manifest.expires)
            if (!isNaN(remoteExpiry.getTime()) && new Date() > remoteExpiry) {
                if (!win.isDestroyed()) {
                    win.webContents.send('beta:expired-remote', {
                        message: `This beta expired on ${remoteExpiry.toLocaleDateString()}.`,
                    })
                }
                return
            }
        }

        // New version available
        if (manifest.latestVersion && manifest.latestVersion !== app.getVersion()) {
            if (!win.isDestroyed()) {
                win.webContents.send('beta:update-available', {
                    version: manifest.latestVersion,
                    downloadUrl: manifest.downloadUrl || '',
                    message: manifest.message || `Flint ${manifest.latestVersion} is available.`,
                })
            }
        }
    } catch {
        // Network errors are expected (offline testers). Silent fail.
    }
}

// ── Beta info for IPC ───────────────────────────────────────────────────────

/** Returns beta build metadata for the renderer. */
export function getBetaInfo(): {
    buildId: string
    expiryDate: string | null
    daysRemaining: number | null
    isBeta: boolean
} {
    if (!BETA_EXPIRY_ISO) {
        return { buildId: BETA_BUILD_ID, expiryDate: null, daysRemaining: null, isBeta: false }
    }

    const expiryDate = new Date(BETA_EXPIRY_ISO)
    const daysRemaining = Math.max(0, Math.ceil(
        (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ))

    return {
        buildId: BETA_BUILD_ID,
        expiryDate: BETA_EXPIRY_ISO,
        daysRemaining,
        isBeta: true,
    }
}
