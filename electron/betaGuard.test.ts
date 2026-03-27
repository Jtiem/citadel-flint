/**
 * betaGuard.test.ts — Unit tests for the self-expiring beta build guard.
 *
 * What we verify:
 *   1. checkBetaExpiry — no expiry set (dev build) always passes.
 *   2. checkBetaExpiry — future expiry date passes.
 *   3. checkBetaExpiry — past expiry date triggers dialog + quit (expired build).
 *   4. checkBetaExpiry — invalid ISO string logs a warning and passes.
 *   5. getBetaInfo — returns isBeta:false when no expiry is set.
 *   6. getBetaInfo — returns correct fields when expiry is set.
 *   7. getBetaInfo — daysRemaining is 0 for an already-expired date (floor at 0).
 *   8. Configurable expiry days — FLINT_BETA_DAYS env var controls the computed
 *      expiry window in build scripts. We verify the runtime guard correctly
 *      accepts a date baked with FLINT_BETA_DAYS=7 and rejects one set to -1 days.
 *   9. startVersionCheck / stopVersionCheck — no-op when VERSION_URL is empty.
 *  10. getBetaInfo — buildId reflects FLINT_BETA_BUILD_ID env var.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── Electron mock ──────────────────────────────────────────────────────────────
// betaGuard.ts imports { app, dialog, BrowserWindow, net } from 'electron'.
// None of these exist in a Node.js test environment, so we mock the entire
// 'electron' module before importing the module under test.

vi.mock('electron', () => {
    const mockDialog = {
        showErrorBox: vi.fn(),
    }
    const mockApp = {
        quit: vi.fn(),
        getVersion: vi.fn().mockReturnValue('0.1.0'),
    }
    const mockNet = {
        fetch: vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({}),
        }),
    }
    return { dialog: mockDialog, app: mockApp, net: mockNet, BrowserWindow: class {} }
})

// ── Brand mock ─────────────────────────────────────────────────────────────────
// betaGuard.ts imports ipcChannel from '../shared/brand.js'.

vi.mock('../shared/brand.js', () => ({
    ipcChannel: (name: string) => `flint:${name}`,
}))

// ── Import helpers ─────────────────────────────────────────────────────────────

// ── ISO date helpers ───────────────────────────────────────────────────────────

/** Returns an ISO date string N days from now (positive = future, negative = past). */
function isoDateOffset(days: number): string {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0] + 'T00:00:00Z'
}

// ── Module re-load helper ──────────────────────────────────────────────────────
// betaGuard.ts reads process.env at module evaluation time (top-level const
// declarations). To test different env var combinations we must re-import the
// module fresh for each scenario via vi.resetModules() + dynamic import.

async function loadBetaGuard() {
    vi.resetModules()
    // Re-mock after resetModules clears the registry
    vi.mock('electron', () => {
        const mockDialog = { showErrorBox: vi.fn() }
        const mockApp = { quit: vi.fn(), getVersion: vi.fn().mockReturnValue('0.1.0') }
        const mockNet = {
            fetch: vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
        }
        return { dialog: mockDialog, app: mockApp, net: mockNet, BrowserWindow: class {} }
    })
    vi.mock('../shared/brand.js', () => ({
        ipcChannel: (name: string) => `flint:${name}`,
    }))
    return import('./betaGuard.js')
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('betaGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Ensure a clean env before each test
        delete process.env.FLINT_BETA_EXPIRY
        delete process.env.FLINT_BETA_BUILD_ID
        delete process.env.FLINT_BETA_VERSION_URL
    })

    afterEach(() => {
        delete process.env.FLINT_BETA_EXPIRY
        delete process.env.FLINT_BETA_BUILD_ID
        delete process.env.FLINT_BETA_VERSION_URL
    })

    // ── 1. No expiry set (dev build) ─────────────────────────────────────────

    it('passes when FLINT_BETA_EXPIRY is not set (dev build)', async () => {
        // No env var set
        const { checkBetaExpiry } = await loadBetaGuard()
        const result = checkBetaExpiry()

        expect(result).toBe(true)

        const { dialog: mockDialog, app: mockApp } = await import('electron')
        expect(mockDialog.showErrorBox).not.toHaveBeenCalled()
        expect(mockApp.quit).not.toHaveBeenCalled()
    })

    // ── 2. Future expiry date ────────────────────────────────────────────────

    it('passes when expiry date is in the future', async () => {
        process.env.FLINT_BETA_EXPIRY = isoDateOffset(30)
        const { checkBetaExpiry } = await loadBetaGuard()
        const result = checkBetaExpiry()

        expect(result).toBe(true)

        const { dialog: mockDialog, app: mockApp } = await import('electron')
        expect(mockDialog.showErrorBox).not.toHaveBeenCalled()
        expect(mockApp.quit).not.toHaveBeenCalled()
    })

    // ── 3. Past expiry date (expired build) ──────────────────────────────────

    it('shows error and quits when expiry date is in the past', async () => {
        process.env.FLINT_BETA_EXPIRY = isoDateOffset(-1)
        process.env.FLINT_BETA_BUILD_ID = 'beta-0.1.0-20260101'

        const { checkBetaExpiry } = await loadBetaGuard()
        const result = checkBetaExpiry()

        expect(result).toBe(false)

        const { dialog: mockDialog, app: mockApp } = await import('electron')
        expect(mockDialog.showErrorBox).toHaveBeenCalledOnce()
        expect(mockDialog.showErrorBox).toHaveBeenCalledWith(
            'Flint Beta Expired',
            expect.stringContaining('beta-0.1.0-20260101'),
        )
        expect(mockApp.quit).toHaveBeenCalledOnce()
    })

    // ── 4. Invalid ISO date ──────────────────────────────────────────────────

    it('logs a warning and passes when FLINT_BETA_EXPIRY is not a valid date', async () => {
        process.env.FLINT_BETA_EXPIRY = 'not-a-date'
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const { checkBetaExpiry } = await loadBetaGuard()
        const result = checkBetaExpiry()

        expect(result).toBe(true)
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Flint Beta]'),
            'not-a-date',
        )

        consoleWarnSpy.mockRestore()
    })

    // ── 5. getBetaInfo — no expiry (dev build) ───────────────────────────────

    it('getBetaInfo returns isBeta:false when no expiry is set', async () => {
        const { getBetaInfo } = await loadBetaGuard()
        const info = getBetaInfo()

        expect(info.isBeta).toBe(false)
        expect(info.expiryDate).toBeNull()
        expect(info.daysRemaining).toBeNull()
        expect(info.buildId).toBe('dev-local')
    })

    // ── 6. getBetaInfo — with expiry set ────────────────────────────────────

    it('getBetaInfo returns correct fields when expiry is in the future', async () => {
        const expiry = isoDateOffset(45)
        process.env.FLINT_BETA_EXPIRY = expiry
        process.env.FLINT_BETA_BUILD_ID = 'beta-0.1.0-20260327'

        const { getBetaInfo } = await loadBetaGuard()
        const info = getBetaInfo()

        expect(info.isBeta).toBe(true)
        expect(info.expiryDate).toBe(expiry)
        expect(info.buildId).toBe('beta-0.1.0-20260327')
        // 45 days from now — allow ±1 for clock drift across midnight
        expect(info.daysRemaining).toBeGreaterThanOrEqual(44)
        expect(info.daysRemaining).toBeLessThanOrEqual(46)
    })

    // ── 7. getBetaInfo — daysRemaining floor at 0 for expired builds ─────────

    it('getBetaInfo returns daysRemaining:0 for an already-expired date', async () => {
        process.env.FLINT_BETA_EXPIRY = isoDateOffset(-10)

        const { getBetaInfo } = await loadBetaGuard()
        const info = getBetaInfo()

        expect(info.daysRemaining).toBe(0)
        expect(info.isBeta).toBe(true)
    })

    // ── 8. Configurable expiry via FLINT_BETA_DAYS ───────────────────────────
    // The env var is consumed by the build *scripts* (package.json / build-zip.sh),
    // which bake the computed ISO date into FLINT_BETA_EXPIRY at compile time.
    // The runtime guard only sees the baked ISO date. We simulate both extremes:
    //   a) A build baked with FLINT_BETA_DAYS=7 (short expiry — still valid if today)
    //   b) A build baked with a date already 1 day in the past (expired)

    it('accepts a build baked with a 7-day expiry when today is within the window', async () => {
        // Simulate what `FLINT_BETA_DAYS=7 npm run build:beta` bakes in
        process.env.FLINT_BETA_EXPIRY = isoDateOffset(7)

        const { checkBetaExpiry } = await loadBetaGuard()
        expect(checkBetaExpiry()).toBe(true)
    })

    it('rejects a build whose baked expiry is 1 day in the past', async () => {
        // Simulate an expired build (e.g., FLINT_BETA_DAYS=0 or built yesterday
        // with FLINT_BETA_DAYS=1 and checked today)
        process.env.FLINT_BETA_EXPIRY = isoDateOffset(-1)

        const { checkBetaExpiry } = await loadBetaGuard()
        expect(checkBetaExpiry()).toBe(false)

        const { app: mockApp } = await import('electron')
        expect(mockApp.quit).toHaveBeenCalledOnce()
    })

    // ── 9. startVersionCheck / stopVersionCheck — no-op with no URL ──────────

    it('startVersionCheck is a no-op when FLINT_BETA_VERSION_URL is not set', async () => {
        // No VERSION_URL set
        const { startVersionCheck, stopVersionCheck } = await loadBetaGuard()
        const mockWin = { webContents: { send: vi.fn() }, isDestroyed: () => false } as never

        // Should not throw and should not call net.fetch
        expect(() => startVersionCheck(mockWin)).not.toThrow()
        stopVersionCheck()

        const { net } = await import('electron')
        expect((net.fetch as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    })

    // ── 10. buildId from FLINT_BETA_BUILD_ID ─────────────────────────────────

    it('getBetaInfo uses FLINT_BETA_BUILD_ID when set', async () => {
        process.env.FLINT_BETA_EXPIRY = isoDateOffset(90)
        process.env.FLINT_BETA_BUILD_ID = 'beta-0.2.0-20261231'

        const { getBetaInfo } = await loadBetaGuard()
        const info = getBetaInfo()

        expect(info.buildId).toBe('beta-0.2.0-20261231')
    })

    it('getBetaInfo falls back to "dev-local" when FLINT_BETA_BUILD_ID is not set', async () => {
        // No BUILD_ID env var
        const { getBetaInfo } = await loadBetaGuard()
        expect(getBetaInfo().buildId).toBe('dev-local')
    })
})
