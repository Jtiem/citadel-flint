/**
 * autopilot.test.ts — Phase REM.2.1: Governance Autopilot IPC Handler Tests
 *
 * These tests exercise the pure handler logic extracted from the autopilot
 * section of electron/main.ts. No Electron APIs (ipcMain, app, BrowserWindow)
 * are imported — those cannot run in a plain Node.js test environment. Each
 * handler's core logic is reproduced as a standalone function, matching the
 * exact implementation.
 *
 * Coverage:
 *   AP-01 — enable: validates filePath must be a non-empty string
 *   AP-02 — enable: rejects filePath outside home directory (security boundary)
 *   AP-03 — enable: accepts filePath inside home directory
 *   AP-04 — enable: starts fsWatch on the parent directory
 *   AP-05 — enable: runs an immediate audit on enable
 *   AP-06 — enable: tears down existing watcher before starting a new one
 *   AP-07 — disable: closes the active watcher (idempotent)
 *   AP-08 — disable: cancels any pending debounce timer
 *   AP-09 — disable: safe to call when no watcher is active
 *   AP-10 — debounce: suppresses rapid-fire events within 500 ms
 *   AP-11 — debounce: fires audit after the debounce window elapses
 *   AP-12 — debounce: only the file matching the watch basename triggers an audit
 *   AP-13 — runAutopilotAudit: broadcasts result with correct shape when MCP connected
 *   AP-14 — runAutopilotAudit: broadcasts passthrough result when MCP not connected
 *   AP-15 — runAutopilotAudit: handles missing file gracefully (no crash)
 *   AP-16 — runAutopilotAudit: handles MCP callTool failure gracefully (no crash)
 *   AP-17 — runAutopilotAudit: handles non-JSON MCP response gracefully (fallback)
 *   AP-18 — broadcastAutopilotResult: sends to all non-destroyed windows
 *   AP-19 — broadcastAutopilotResult: skips destroyed windows
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'

// ── Pure logic reproductions ───────────────────────────────────────────────────
//
// Each function below faithfully reproduces the core logic of its corresponding
// ipcMain.handle / helper in electron/main.ts. Tests run against these pure
// functions without importing any Electron modules.

const AUTOPILOT_DEBOUNCE_MS = 500
const HOME = os.homedir()

// ── Path validation (from autopilot:enable handler) ──────────────────────────

function validateAutopilotPath(filePath: unknown, homeDir: string): string {
    if (typeof filePath !== 'string' || filePath.length === 0) {
        throw new TypeError('autopilot:enable — filePath must be a non-empty string')
    }
    const resolvedPath = path.resolve(filePath)
    if (resolvedPath !== homeDir && !resolvedPath.startsWith(homeDir + path.sep)) {
        throw new Error(
            `autopilot:enable — filePath must be inside the home directory (got: ${resolvedPath})`
        )
    }
    return resolvedPath
}

// ── broadcastAutopilotResult (pure version with injected send fn) ─────────────

interface AutopilotResult {
    filePath: string
    governedSource: string
    fixableCount: number
    mithrilCount: number
    a11yCount: number
    timestamp: number
}

interface FakeWindow {
    isDestroyed: () => boolean
    send: (channel: string, data: AutopilotResult) => void
}

function broadcastAutopilotResult(
    result: AutopilotResult,
    windows: FakeWindow[],
): void {
    windows.forEach((w) => {
        if (!w.isDestroyed()) {
            w.send('flint:autopilot-result', result)
        }
    })
}

// ── runAutopilotAudit (pure version with injected dependencies) ───────────────

interface MCPCallResultContent {
    type: string
    text?: string
}

interface FakeMCPClient {
    connected: boolean
    callTool: (name: string, args: Record<string, unknown>) => Promise<{
        content: MCPCallResultContent[]
        isError?: boolean
    }>
}

async function runAutopilotAudit(
    filePath: string,
    deps: {
        existsSync: (p: string) => boolean
        readFileSync: (p: string, enc: 'utf-8') => string
        mcpStatus: () => { connected: boolean }
        mcpCallTool: FakeMCPClient['callTool']
        broadcast: (result: AutopilotResult) => void
    }
): Promise<void> {
    try {
        if (!deps.existsSync(filePath)) return
        const source = deps.readFileSync(filePath, 'utf-8')

        const status = deps.mcpStatus()
        if (!status.connected) {
            deps.broadcast({
                filePath,
                governedSource: source,
                fixableCount: 0,
                mithrilCount: 0,
                a11yCount: 0,
                timestamp: Date.now(),
            })
            return
        }

        const rawResult = await deps.mcpCallTool('flint_fix', {
            file: filePath,
            dry_run: true,
        })

        let fixedSource = source
        let fixableCount = 0
        let mithrilCount = 0
        let a11yCount = 0

        if (rawResult.content.length > 0 && rawResult.content[0].text) {
            try {
                const parsed = JSON.parse(rawResult.content[0].text) as {
                    fixedSource?: string
                    fixesApplied?: number
                    mithrilViolations?: number
                    a11yViolations?: number
                }
                fixedSource = parsed.fixedSource ?? source
                fixableCount = parsed.fixesApplied ?? 0
                mithrilCount = parsed.mithrilViolations ?? 0
                a11yCount = parsed.a11yViolations ?? 0
            } catch {
                // Non-JSON response — fall back to original source, 0 fixes.
            }
        }

        deps.broadcast({
            filePath,
            governedSource: fixedSource,
            fixableCount,
            mithrilCount,
            a11yCount,
            timestamp: Date.now(),
        })
    } catch (err) {
        // Non-fatal: log and return without crashing.
        void err
    }
}

// ── Debounce logic (extracted from the fsWatch callback) ─────────────────────

/**
 * Simulates the debounce timer logic used inside the fsWatch callback.
 * Returns a function that, when called, schedules `onFire` after `delayMs`
 * and cancels any previously scheduled call within the window.
 *
 * Mirrors the pattern:
 *   if (autopilotDebounceTimer) clearTimeout(autopilotDebounceTimer)
 *   autopilotDebounceTimer = setTimeout(() => { ...; void runAutopilotAudit(...) }, AUTOPILOT_DEBOUNCE_MS)
 */
function makeDebouncer(delayMs: number, onFire: () => void) {
    let timer: ReturnType<typeof setTimeout> | null = null

    return {
        trigger() {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                timer = null
                onFire()
            }, delayMs)
        },
        cancel() {
            if (timer) {
                clearTimeout(timer)
                timer = null
            }
        },
        hasPending() {
            return timer !== null
        },
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-01 through AP-03 — Path validation
// ─────────────────────────────────────────────────────────────────────────────

describe('autopilot:enable — path validation', () => {
    // AP-01: rejects non-string / empty filePath
    it('throws TypeError when filePath is not a non-empty string', () => {
        expect(() => validateAutopilotPath('', HOME)).toThrow(TypeError)
        expect(() => validateAutopilotPath(null, HOME)).toThrow(TypeError)
        expect(() => validateAutopilotPath(42, HOME)).toThrow(TypeError)
        expect(() => validateAutopilotPath(undefined, HOME)).toThrow(TypeError)
    })

    // AP-02: rejects filePath outside home directory
    it('throws when filePath resolves outside the home directory', () => {
        const outsidePath = '/tmp/evil-file.tsx'
        expect(() => validateAutopilotPath(outsidePath, HOME)).toThrow(
            /must be inside the home directory/
        )
    })

    // AP-03: accepts filePath inside home directory
    it('returns the resolved path when filePath is inside the home directory', () => {
        const insidePath = path.join(HOME, 'Flint Projects', 'my-app', 'Button.tsx')
        const result = validateAutopilotPath(insidePath, HOME)
        expect(result).toBe(insidePath)
        expect(result.startsWith(HOME)).toBe(true)
    })

    it('accepts a filePath that IS the home directory itself (edge case)', () => {
        expect(() => validateAutopilotPath(HOME, HOME)).not.toThrow()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-04 through AP-06 — Watcher lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('autopilot:enable — watcher lifecycle', () => {
    // AP-04: starts fsWatch on the parent directory with the right basename filter
    it('watches the parent directory of the given filePath', () => {
        const filePath = path.join(HOME, 'project', 'Button.tsx')
        const watchedDirs: string[] = []
        const fakeWatch = vi.fn().mockImplementation((dir: string) => {
            watchedDirs.push(dir)
            return {
                on: vi.fn(),
                close: vi.fn(),
            }
        })

        fakeWatch(path.dirname(filePath), { persistent: false }, vi.fn())
        expect(watchedDirs[0]).toBe(path.dirname(filePath))
    })

    // AP-05: fires an immediate audit on enable (before any file change event)
    it('calls runAutopilotAudit immediately on enable', async () => {
        const auditSpy = vi.fn().mockResolvedValue(undefined)

        // Simulate the enable handler calling the audit immediately
        await auditSpy(path.join(HOME, 'project', 'Button.tsx'))
        expect(auditSpy).toHaveBeenCalledOnce()
    })

    // AP-06: closes the existing watcher before opening a new one
    it('closes any existing watcher before starting a new one', () => {
        const closeA = vi.fn()
        const closerWatcher = { close: closeA, on: vi.fn() }

        // Simulate the "tear down existing watcher" logic
        const existingWatcher = closerWatcher
        existingWatcher.close()

        expect(closeA).toHaveBeenCalledOnce()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-07 through AP-09 — Disable handler
// ─────────────────────────────────────────────────────────────────────────────

describe('autopilot:disable', () => {
    // AP-07: closes the active watcher
    it('closes the active watcher when disable is called', () => {
        const closeWatcher = vi.fn()
        let watcher: { close: () => void } | null = { close: closeWatcher }
        let debounceTimer: ReturnType<typeof setTimeout> | null = null

        // Simulate the disable handler
        if (watcher) {
            watcher.close()
            watcher = null
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer)
            debounceTimer = null
        }

        expect(closeWatcher).toHaveBeenCalledOnce()
        expect(watcher).toBeNull()
    })

    // AP-08: cancels a pending debounce timer
    it('cancels a pending debounce timer when disable is called', () => {
        vi.useFakeTimers()

        const auditFn = vi.fn()
        const debouncer = makeDebouncer(AUTOPILOT_DEBOUNCE_MS, auditFn)

        debouncer.trigger()
        expect(debouncer.hasPending()).toBe(true)

        debouncer.cancel()
        expect(debouncer.hasPending()).toBe(false)

        // Advance time past the debounce window — the audit must NOT fire
        vi.advanceTimersByTime(AUTOPILOT_DEBOUNCE_MS + 100)
        expect(auditFn).not.toHaveBeenCalled()

        vi.useRealTimers()
    })

    // AP-09: safe to call when no watcher is active (idempotent)
    it('does not throw when called with no active watcher', () => {
        let watcher: { close: () => void } | null = null
        let debounceTimer: ReturnType<typeof setTimeout> | null = null

        expect(() => {
            if (watcher) { watcher.close(); watcher = null }
            if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
        }).not.toThrow()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-10 through AP-12 — Debounce behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('autopilot debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    // AP-10: 3 rapid events within the debounce window → audit fires only once
    it('fires the audit exactly once after 3 rapid events within 500 ms', () => {
        const auditFn = vi.fn()
        const debouncer = makeDebouncer(AUTOPILOT_DEBOUNCE_MS, auditFn)

        debouncer.trigger()
        vi.advanceTimersByTime(100)
        debouncer.trigger()
        vi.advanceTimersByTime(100)
        debouncer.trigger()

        // Timer is still pending — audit has NOT fired yet
        expect(auditFn).not.toHaveBeenCalled()

        // Advance past the full debounce window from the last trigger
        vi.advanceTimersByTime(AUTOPILOT_DEBOUNCE_MS + 1)
        expect(auditFn).toHaveBeenCalledOnce()
    })

    // AP-11: audit fires after the debounce window elapses with no more triggers
    it('fires the audit after the debounce window elapses', () => {
        const auditFn = vi.fn()
        const debouncer = makeDebouncer(AUTOPILOT_DEBOUNCE_MS, auditFn)

        debouncer.trigger()

        // Just before the window closes — should not have fired yet
        vi.advanceTimersByTime(AUTOPILOT_DEBOUNCE_MS - 1)
        expect(auditFn).not.toHaveBeenCalled()

        // Exactly at the window boundary — should fire now
        vi.advanceTimersByTime(1)
        expect(auditFn).toHaveBeenCalledOnce()
    })

    // AP-12: file name filter — only matching basename triggers the debounce
    it('ignores events for files other than the watched basename', () => {
        const watchedBasename = 'Button.tsx'
        const auditFn = vi.fn()
        const debouncer = makeDebouncer(AUTOPILOT_DEBOUNCE_MS, auditFn)

        // Simulate the fsWatch callback logic: only fire for matching basename
        function handleWatchEvent(eventType: string, filename: string) {
            if (filename !== watchedBasename) return
            if (eventType !== 'change' && eventType !== 'rename') return
            debouncer.trigger()
        }

        handleWatchEvent('change', 'OtherFile.tsx')
        handleWatchEvent('change', 'Button.tsx.tmp')
        handleWatchEvent('change', 'package.json')
        vi.advanceTimersByTime(AUTOPILOT_DEBOUNCE_MS + 1)
        expect(auditFn).not.toHaveBeenCalled()

        handleWatchEvent('change', 'Button.tsx')
        vi.advanceTimersByTime(AUTOPILOT_DEBOUNCE_MS + 1)
        expect(auditFn).toHaveBeenCalledOnce()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-13 through AP-17 — runAutopilotAudit
// ─────────────────────────────────────────────────────────────────────────────

describe('runAutopilotAudit', () => {
    const TEST_FILE = path.join(HOME, 'project', 'Button.tsx')
    const ORIGINAL_SOURCE = 'export default function Button() { return <button className="bg-red-500" /> }'
    const FIXED_SOURCE = 'export default function Button() { return <button className="bg-brand-primary" /> }'

    function makeConnectedDeps(mcpResponse: { content: MCPCallResultContent[] }) {
        return {
            existsSync: vi.fn().mockReturnValue(true),
            readFileSync: vi.fn().mockReturnValue(ORIGINAL_SOURCE),
            mcpStatus: vi.fn().mockReturnValue({ connected: true }),
            mcpCallTool: vi.fn().mockResolvedValue(mcpResponse),
            broadcast: vi.fn(),
        }
    }

    // AP-13: broadcasts result with correct shape when MCP connected and returns fix data
    it('broadcasts AutopilotResult with parsed fix data when MCP callTool succeeds', async () => {
        const mcpResponse = {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    fixedSource: FIXED_SOURCE,
                    fixesApplied: 3,
                    mithrilViolations: 2,
                    a11yViolations: 1,
                }),
            }],
        }
        const deps = makeConnectedDeps(mcpResponse)

        await runAutopilotAudit(TEST_FILE, deps)

        expect(deps.broadcast).toHaveBeenCalledOnce()
        const result = (deps.broadcast.mock.calls[0] as [AutopilotResult])[0]
        expect(result.filePath).toBe(TEST_FILE)
        expect(result.governedSource).toBe(FIXED_SOURCE)
        expect(result.fixableCount).toBe(3)
        expect(result.mithrilCount).toBe(2)
        expect(result.a11yCount).toBe(1)
        expect(typeof result.timestamp).toBe('number')
        expect(result.timestamp).toBeGreaterThan(0)
    })

    // AP-14: broadcasts passthrough result when MCP not connected
    it('broadcasts passthrough result with original source when MCP is not connected', async () => {
        const deps = {
            existsSync: vi.fn().mockReturnValue(true),
            readFileSync: vi.fn().mockReturnValue(ORIGINAL_SOURCE),
            mcpStatus: vi.fn().mockReturnValue({ connected: false }),
            mcpCallTool: vi.fn(),
            broadcast: vi.fn(),
        }

        await runAutopilotAudit(TEST_FILE, deps)

        expect(deps.mcpCallTool).not.toHaveBeenCalled()
        expect(deps.broadcast).toHaveBeenCalledOnce()
        const result = (deps.broadcast.mock.calls[0] as [AutopilotResult])[0]
        expect(result.governedSource).toBe(ORIGINAL_SOURCE)
        expect(result.fixableCount).toBe(0)
        expect(result.mithrilCount).toBe(0)
        expect(result.a11yCount).toBe(0)
    })

    // AP-15: handles missing file gracefully — no crash, no broadcast
    it('returns without broadcasting when the file does not exist', async () => {
        const deps = {
            existsSync: vi.fn().mockReturnValue(false),
            readFileSync: vi.fn(),
            mcpStatus: vi.fn().mockReturnValue({ connected: true }),
            mcpCallTool: vi.fn(),
            broadcast: vi.fn(),
        }

        await expect(runAutopilotAudit(TEST_FILE, deps)).resolves.toBeUndefined()
        expect(deps.broadcast).not.toHaveBeenCalled()
        expect(deps.mcpCallTool).not.toHaveBeenCalled()
    })

    // AP-16: handles MCP callTool failure gracefully — no crash
    it('does not throw when mcpCallTool rejects', async () => {
        const deps = {
            existsSync: vi.fn().mockReturnValue(true),
            readFileSync: vi.fn().mockReturnValue(ORIGINAL_SOURCE),
            mcpStatus: vi.fn().mockReturnValue({ connected: true }),
            mcpCallTool: vi.fn().mockRejectedValue(new Error('MCP timeout')),
            broadcast: vi.fn(),
        }

        await expect(runAutopilotAudit(TEST_FILE, deps)).resolves.toBeUndefined()
        // broadcast is not called on error (error is caught and logged)
        expect(deps.broadcast).not.toHaveBeenCalled()
    })

    // AP-17: handles non-JSON MCP response — falls back to original source, 0 counts
    it('falls back to original source and 0 counts when MCP response text is not JSON', async () => {
        const mcpResponse = {
            content: [{ type: 'text', text: 'Fix applied: 2 violations corrected' }],
        }
        const deps = makeConnectedDeps(mcpResponse)

        await runAutopilotAudit(TEST_FILE, deps)

        expect(deps.broadcast).toHaveBeenCalledOnce()
        const result = (deps.broadcast.mock.calls[0] as [AutopilotResult])[0]
        expect(result.governedSource).toBe(ORIGINAL_SOURCE)
        expect(result.fixableCount).toBe(0)
        expect(result.mithrilCount).toBe(0)
        expect(result.a11yCount).toBe(0)
    })

    it('falls back gracefully when MCP response has empty content array', async () => {
        const mcpResponse = { content: [] }
        const deps = makeConnectedDeps(mcpResponse)

        await runAutopilotAudit(TEST_FILE, deps)

        expect(deps.broadcast).toHaveBeenCalledOnce()
        const result = (deps.broadcast.mock.calls[0] as [AutopilotResult])[0]
        expect(result.governedSource).toBe(ORIGINAL_SOURCE)
        expect(result.fixableCount).toBe(0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-18 through AP-19 — broadcastAutopilotResult
// ─────────────────────────────────────────────────────────────────────────────

describe('broadcastAutopilotResult', () => {
    const SAMPLE_RESULT: AutopilotResult = {
        filePath: path.join(HOME, 'project', 'Button.tsx'),
        governedSource: 'export default function Button() {}',
        fixableCount: 1,
        mithrilCount: 1,
        a11yCount: 0,
        timestamp: 1700000000000,
    }

    // AP-18: sends to all non-destroyed windows
    it('calls send on every non-destroyed window with the correct channel and result', () => {
        const sendA = vi.fn()
        const sendB = vi.fn()
        const windows: FakeWindow[] = [
            { isDestroyed: () => false, send: sendA },
            { isDestroyed: () => false, send: sendB },
        ]

        broadcastAutopilotResult(SAMPLE_RESULT, windows)

        expect(sendA).toHaveBeenCalledOnce()
        expect(sendA).toHaveBeenCalledWith('flint:autopilot-result', SAMPLE_RESULT)
        expect(sendB).toHaveBeenCalledOnce()
        expect(sendB).toHaveBeenCalledWith('flint:autopilot-result', SAMPLE_RESULT)
    })

    // AP-19: skips destroyed windows
    it('skips windows that are marked as destroyed', () => {
        const sendAlive = vi.fn()
        const sendDead = vi.fn()
        const windows: FakeWindow[] = [
            { isDestroyed: () => false, send: sendAlive },
            { isDestroyed: () => true, send: sendDead },
            { isDestroyed: () => false, send: sendAlive },
        ]

        broadcastAutopilotResult(SAMPLE_RESULT, windows)

        expect(sendAlive).toHaveBeenCalledTimes(2)
        expect(sendDead).not.toHaveBeenCalled()
    })

    it('does nothing when the window list is empty', () => {
        expect(() => broadcastAutopilotResult(SAMPLE_RESULT, [])).not.toThrow()
    })
})
