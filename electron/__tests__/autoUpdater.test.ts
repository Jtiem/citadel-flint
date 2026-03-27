/**
 * autoUpdater.test.ts — BETA.3: electron-updater integration tests
 *
 * Coverage:
 *   AU-01 — initAutoUpdater sets autoDownload to false
 *   AU-02 — initAutoUpdater sets autoInstallOnAppQuit to true
 *   AU-03 — initAutoUpdater sets allowPrerelease=true for beta channel (default)
 *   AU-04 — initAutoUpdater sets allowPrerelease=false for stable channel
 *   AU-05 — checkForUpdates delegates to autoUpdater.checkForUpdates
 *   AU-06 — downloadUpdate delegates to autoUpdater.downloadUpdate
 *   AU-07 — quitAndInstall delegates to autoUpdater.quitAndInstall
 *   AU-08 — getUpdateChannel returns 'beta' by default
 *   AU-09 — setUpdateChannel switches to 'stable' and updates allowPrerelease
 *   AU-10 — setUpdateChannel switches back to 'beta' and updates allowPrerelease
 *   AU-11 — update-available event forwards correct shape to renderer
 *   AU-12 — download-progress event forwards correct shape to renderer
 *   AU-13 — update-downloaded event forwards correct shape to renderer
 *   AU-14 — error event forwards message to renderer and does not throw
 *   AU-15 — stopAutoUpdater clears the window reference (no send after stop)
 *   AU-16 — normalizes array releaseNotes to a joined string
 *   AU-17 — normalizes null releaseNotes to null
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock electron-updater ─────────────────────────────────────────────────────
// vi.mock is hoisted to the top of the module by vitest, so the factory cannot
// reference variables declared after it. vi.hoisted() runs BEFORE hoisting and
// returns a value that is safe to use inside vi.mock factories.

type UpdaterEventCallback = (...args: unknown[]) => void

const mockAutoUpdater = vi.hoisted(() => {
    const _listeners = new Map<string, UpdaterEventCallback[]>()

    return {
        autoDownload: true,
        autoInstallOnAppQuit: false,
        allowPrerelease: false,
        _listeners,
        on(event: string, cb: UpdaterEventCallback) {
            const list = _listeners.get(event) ?? []
            list.push(cb)
            _listeners.set(event, list)
        },
        emit(event: string, ...args: unknown[]) {
            const listeners = _listeners.get(event) ?? []
            for (const cb of listeners) cb(...args)
        },
        checkForUpdates: vi.fn().mockResolvedValue({ updateInfo: null }),
        downloadUpdate: vi.fn().mockResolvedValue(undefined),
        quitAndInstall: vi.fn(),
        reset() {
            this.autoDownload = true
            this.autoInstallOnAppQuit = false
            this.allowPrerelease = false
            _listeners.clear()
            this.checkForUpdates.mockReset().mockResolvedValue({ updateInfo: null })
            this.downloadUpdate.mockReset().mockResolvedValue(undefined)
            this.quitAndInstall.mockReset()
        },
    }
})

vi.mock('electron-updater', () => ({
    autoUpdater: mockAutoUpdater,
}))

// ── Mock shared/brand ─────────────────────────────────────────────────────────

vi.mock('../../shared/brand.js', () => ({
    ipcChannel: (name: string) => `flint:${name}`,
    logTag: (tag: string) => `[Flint ${tag}]`,
    BRAND: { product: 'Flint' },
}))

// ── Import module under test (after mocks are established) ────────────────────

import {
    initAutoUpdater,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    getUpdateChannel,
    setUpdateChannel,
    stopAutoUpdater,
} from '../autoUpdater'

// ── Mock BrowserWindow ────────────────────────────────────────────────────────

function makeMockWindow(destroyed = false) {
    return {
        isDestroyed: vi.fn().mockReturnValue(destroyed),
        webContents: {
            send: vi.fn(),
        },
    }
}

// ── Test setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
    mockAutoUpdater.reset()
    // Reset channel to default by calling setUpdateChannel('beta') so each test
    // starts from a clean known state, since the module is a singleton.
    setUpdateChannel('beta')
    stopAutoUpdater()
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

// ── AU-01 — autoDownload set to false ─────────────────────────────────────────

describe('AU-01 — initAutoUpdater sets autoDownload to false', () => {
    it('sets autoUpdater.autoDownload = false', () => {
        const win = makeMockWindow()
        initAutoUpdater(win as never)
        expect(mockAutoUpdater.autoDownload).toBe(false)
    })
})

// ── AU-02 — autoInstallOnAppQuit set to true ──────────────────────────────────

describe('AU-02 — initAutoUpdater sets autoInstallOnAppQuit to true', () => {
    it('sets autoUpdater.autoInstallOnAppQuit = true', () => {
        const win = makeMockWindow()
        initAutoUpdater(win as never)
        expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true)
    })
})

// ── AU-03 — allowPrerelease=true for beta channel ─────────────────────────────

describe('AU-03 — initAutoUpdater uses beta channel by default', () => {
    it('sets allowPrerelease=true when channel is beta', () => {
        setUpdateChannel('beta')
        const win = makeMockWindow()
        initAutoUpdater(win as never)
        expect(mockAutoUpdater.allowPrerelease).toBe(true)
    })
})

// ── AU-04 — allowPrerelease=false for stable channel ─────────────────────────

describe('AU-04 — initAutoUpdater respects stable channel', () => {
    it('sets allowPrerelease=false when channel is stable', () => {
        setUpdateChannel('stable')
        const win = makeMockWindow()
        initAutoUpdater(win as never)
        expect(mockAutoUpdater.allowPrerelease).toBe(false)
    })
})

// ── AU-05 — checkForUpdates delegates ────────────────────────────────────────

describe('AU-05 — checkForUpdates delegates to autoUpdater', () => {
    it('calls autoUpdater.checkForUpdates', async () => {
        mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({ updateInfo: { version: '1.0.0' } })
        await checkForUpdates()
        expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce()
    })
})

// ── AU-06 — downloadUpdate delegates ─────────────────────────────────────────

describe('AU-06 — downloadUpdate delegates to autoUpdater', () => {
    it('calls autoUpdater.downloadUpdate', async () => {
        await downloadUpdate()
        expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalledOnce()
    })
})

// ── AU-07 — quitAndInstall delegates ─────────────────────────────────────────

describe('AU-07 — quitAndInstall delegates to autoUpdater', () => {
    it('calls autoUpdater.quitAndInstall', () => {
        quitAndInstall()
        expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledOnce()
    })
})

// ── AU-08 — default channel is beta ──────────────────────────────────────────

describe('AU-08 — getUpdateChannel returns beta by default', () => {
    it('returns "beta"', () => {
        setUpdateChannel('beta') // ensure clean state
        expect(getUpdateChannel()).toBe('beta')
    })
})

// ── AU-09 — setUpdateChannel stable ──────────────────────────────────────────

describe('AU-09 — setUpdateChannel("stable") flips allowPrerelease', () => {
    it('sets allowPrerelease to false and returns stable from getUpdateChannel', () => {
        setUpdateChannel('stable')
        expect(getUpdateChannel()).toBe('stable')
        expect(mockAutoUpdater.allowPrerelease).toBe(false)
    })
})

// ── AU-10 — setUpdateChannel back to beta ────────────────────────────────────

describe('AU-10 — setUpdateChannel("beta") flips allowPrerelease back', () => {
    it('sets allowPrerelease to true', () => {
        setUpdateChannel('stable')
        setUpdateChannel('beta')
        expect(getUpdateChannel()).toBe('beta')
        expect(mockAutoUpdater.allowPrerelease).toBe(true)
    })
})

// ── AU-11 — update-available event forwarding ─────────────────────────────────

describe('AU-11 — update-available event forwards correct shape', () => {
    it('sends flint:auto-update:available with version, releaseNotes, releaseDate, isBeta', () => {
        const win = makeMockWindow()
        initAutoUpdater(win as never)

        mockAutoUpdater.emit('update-available', {
            version: '0.2.0-beta.1',
            releaseNotes: '## Fixes\n- Bug fixed',
            releaseDate: '2026-03-27T00:00:00Z',
        })

        expect(win.webContents.send).toHaveBeenCalledWith(
            'flint:auto-update:available',
            {
                version: '0.2.0-beta.1',
                releaseNotes: '## Fixes\n- Bug fixed',
                releaseDate: '2026-03-27T00:00:00Z',
                isBeta: true,
            }
        )
    })
})

// ── AU-12 — download-progress event forwarding ────────────────────────────────

describe('AU-12 — download-progress event forwards correct shape', () => {
    it('sends flint:auto-update:progress with percent, bytesPerSecond, total, transferred', () => {
        const win = makeMockWindow()
        initAutoUpdater(win as never)

        mockAutoUpdater.emit('download-progress', {
            bytesPerSecond: 500000,
            percent: 42.5,
            total: 80000000,
            transferred: 34000000,
        })

        expect(win.webContents.send).toHaveBeenCalledWith(
            'flint:auto-update:progress',
            {
                bytesPerSecond: 500000,
                percent: 42.5,
                total: 80000000,
                transferred: 34000000,
            }
        )
    })
})

// ── AU-13 — update-downloaded event forwarding ────────────────────────────────

describe('AU-13 — update-downloaded event forwards correct shape', () => {
    it('sends flint:auto-update:downloaded with UpdateInfo shape', () => {
        const win = makeMockWindow()
        initAutoUpdater(win as never)

        mockAutoUpdater.emit('update-downloaded', {
            version: '0.2.0',
            releaseNotes: null,
            releaseDate: '2026-03-28T00:00:00Z',
        })

        expect(win.webContents.send).toHaveBeenCalledWith(
            'flint:auto-update:downloaded',
            {
                version: '0.2.0',
                releaseNotes: null,
                releaseDate: '2026-03-28T00:00:00Z',
                isBeta: false,
            }
        )
    })
})

// ── AU-14 — error event does not throw ───────────────────────────────────────

describe('AU-14 — error event forwards message and does not throw', () => {
    it('sends flint:auto-update:error with the error message', () => {
        const win = makeMockWindow()
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        initAutoUpdater(win as never)

        expect(() => {
            mockAutoUpdater.emit('error', new Error('Network timeout'))
        }).not.toThrow()

        expect(win.webContents.send).toHaveBeenCalledWith(
            'flint:auto-update:error',
            { message: 'Network timeout' }
        )

        consoleSpy.mockRestore()
    })

    it('does not send to renderer when window is destroyed', () => {
        const win = makeMockWindow(true) // destroyed = true
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        initAutoUpdater(win as never)

        mockAutoUpdater.emit('error', new Error('Some error'))
        expect(win.webContents.send).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})

// ── AU-15 — stopAutoUpdater releases window reference ─────────────────────────

describe('AU-15 — stopAutoUpdater prevents sends after stop', () => {
    it('does not forward events to renderer after stop', () => {
        const win = makeMockWindow()
        initAutoUpdater(win as never)
        stopAutoUpdater()

        // Emitting after stop should not reach the window
        mockAutoUpdater.emit('update-available', {
            version: '1.0.0',
            releaseNotes: null,
            releaseDate: '2026-03-27T00:00:00Z',
        })

        expect(win.webContents.send).not.toHaveBeenCalled()
    })
})

// ── AU-16 — normalizes array releaseNotes ─────────────────────────────────────

describe('AU-16 — array releaseNotes are joined into a string', () => {
    it('joins note array entries with newlines', () => {
        const win = makeMockWindow()
        initAutoUpdater(win as never)

        mockAutoUpdater.emit('update-available', {
            version: '1.0.0',
            releaseNotes: [{ note: 'Fix A' }, { note: 'Fix B' }],
            releaseDate: '2026-03-27T00:00:00Z',
        })

        const sent = (win.webContents.send as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(sent[1].releaseNotes).toBe('Fix A\nFix B')
    })
})

// ── AU-17 — null releaseNotes stays null ──────────────────────────────────────

describe('AU-17 — null releaseNotes normalizes to null', () => {
    it('passes null releaseNotes through unchanged', () => {
        const win = makeMockWindow()
        initAutoUpdater(win as never)

        mockAutoUpdater.emit('update-available', {
            version: '1.0.0',
            releaseNotes: null,
            releaseDate: '2026-03-27T00:00:00Z',
        })

        const sent = (win.webContents.send as ReturnType<typeof vi.fn>).mock.calls[0]
        expect(sent[1].releaseNotes).toBeNull()
    })
})
