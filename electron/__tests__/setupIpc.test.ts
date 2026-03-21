/**
 * setupIpc.test.ts — ONBOARD.1: First-Launch Setup IPC Handler Tests
 *
 * These tests exercise the pure handler logic extracted from electron/main.ts.
 * No Electron APIs (ipcMain, app, BrowserWindow) are imported — those cannot
 * run in a plain Node.js test environment. Instead, each handler's core logic
 * is reproduced as a standalone function, matching the exact implementation.
 *
 * Coverage:
 *   SETUP-01 — setup:detect-ides: all 4 IDEs detected when existsSync returns true
 *   SETUP-02 — setup:detect-ides: partial detection (only some files exist)
 *   SETUP-03 — setup:detect-ides: all IDEs undetected when existsSync returns false
 *   SETUP-04 — setup:detect-ides: mcpServerPath always present in response
 *   SETUP-05 — setup:detect-ides: Claude Code settingsPath is mcp.json, not settings.json
 *   SETUP-06 — setup:detect-ides: Claude Code detection checks settings.json but returns mcp.json
 *   SETUP-06b — setup:detect-ides: Claude Code detected when only mcp.json exists (no settings.json)
 *   SETUP-06c — setup:detect-ides: settingsPath prefers mcp.json when both files exist
 *   SETUP-06d — setup:detect-ides: settingsPath falls back to settings.json when mcp.json absent
 *   SETUP-07 — setup:check-first-launch: returns isFirstLaunch: true when file does not exist
 *   SETUP-08 — setup:check-first-launch: returns isFirstLaunch: false when flag is set
 *   SETUP-09 — setup:check-first-launch: returns isFirstLaunch: true on corrupt JSON
 *   SETUP-10 — setup:check-first-launch: returns isFirstLaunch: true when key is missing
 *   SETUP-11 — setup:complete-first-launch: creates ~/.flint/ directory if absent
 *   SETUP-12 — setup:complete-first-launch: writes JSON with firstLaunchComplete: true
 *   SETUP-13 — setup:complete-first-launch: written JSON includes a completedAt timestamp
 *   SETUP-14 — setup:complete-first-launch: idempotent — calling twice does not throw
 *   SETUP-21 — setup:write-mcp-config: parses JSONC with single-line // comments
 *   SETUP-22 — setup:write-mcp-config: parses JSONC with block /* *\/ comments
 *   SETUP-23 — setup:write-mcp-config: preserves comment markers inside string values
 *   SETUP-24 — setup:write-mcp-config: merges flint into existing JSONC config without clobbering
 *   SETUP-25 — stripJsoncComments: empty input returns empty string
 *   SETUP-26 — stripJsoncComments: plain JSON passes through unchanged
 *   SETUP-27 — stripJsoncComments: comment at end of file (no trailing newline) is stripped
 */

import { describe, it, expect, vi } from 'vitest'
import path from 'node:path'
import os from 'node:os'

// ── Handler logic reproductions ───────────────────────────────────────────────
//
// Each function below is a faithful copy of the logic inside the ipcMain.handle
// callback in electron/main.ts. Tests run against these pure functions.

// ── setup:detect-ides logic ───────────────────────────────────────────────────

interface DetectedIDE {
    name: 'Claude Code' | 'Cursor' | 'VS Code' | 'Antigravity'
    settingsPath: string
    detected: boolean
}

interface IDEDetectionResult {
    ides: DetectedIDE[]
    mcpServerPath: string
}

function detectIDEs(
    existsSync: (p: string) => boolean,
    mcpServerPath: string,
): IDEDetectionResult {
    const home = os.homedir()

    const claudeSettingsPath = path.join(home, '.claude', 'settings.json')
    const claudeMcpPath = path.join(home, '.claude', 'mcp.json')

    const IDE_CANDIDATES: Array<{
        name: 'Claude Code' | 'Cursor' | 'VS Code' | 'Antigravity'
        detectionPath: string
        settingsPath: string
    }> = [
        {
            name: 'Claude Code',
            // detectionPath is unused for Claude Code — the map() below does
            // a dual check for settings.json OR mcp.json.
            detectionPath: claudeSettingsPath,
            // Prefer mcp.json (the MCP registration target) when it exists;
            // fall back to settings.json for older installs.
            settingsPath: existsSync(claudeMcpPath) ? claudeMcpPath : claudeSettingsPath,
        },
        {
            name: 'Antigravity',
            detectionPath: path.join(
                home,
                'Library',
                'Application Support',
                'Antigravity',
                'User',
                'settings.json',
            ),
            settingsPath: path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
        },
        {
            name: 'Cursor',
            detectionPath: path.join(
                home,
                'Library',
                'Application Support',
                'Cursor',
                'User',
                'settings.json',
            ),
            settingsPath: path.join(
                home,
                'Library',
                'Application Support',
                'Cursor',
                'User',
                'settings.json',
            ),
        },
        {
            name: 'VS Code',
            detectionPath: path.join(
                home,
                'Library',
                'Application Support',
                'Code',
                'User',
                'settings.json',
            ),
            settingsPath: path.join(
                home,
                'Library',
                'Application Support',
                'Code',
                'User',
                'settings.json',
            ),
        },
    ]

    const ides = IDE_CANDIDATES.map(({ name, detectionPath, settingsPath }) => ({
        name,
        settingsPath,
        // Claude Code: detected if either settings.json (older) or mcp.json (fresh) exists
        detected:
            name === 'Claude Code'
                ? existsSync(claudeSettingsPath) || existsSync(claudeMcpPath)
                : existsSync(detectionPath),
    }))

    return { ides, mcpServerPath }
}

// ── stripJsoncComments (shared by write handler and tests) ────────────────────

/**
 * Strips single-line (//) and multi-line (/* *\/) comments from a JSONC string.
 * Mirrors the implementation in electron/main.ts exactly.
 */
function stripJsoncComments(jsonc: string): string {
    let result = ''
    let inString = false
    let i = 0
    while (i < jsonc.length) {
        const ch = jsonc[i]
        const next = jsonc[i + 1]
        if (ch === '"' && (i === 0 || jsonc[i - 1] !== '\\')) {
            inString = !inString
            result += ch
            i++
        } else if (!inString && ch === '/' && next === '/') {
            while (i < jsonc.length && jsonc[i] !== '\n') i++
        } else if (!inString && ch === '/' && next === '*') {
            i += 2
            while (i < jsonc.length && !(jsonc[i] === '*' && jsonc[i + 1] === '/')) i++
            i += 2
        } else {
            result += ch
            i++
        }
    }
    return result
}

// ── setup:write-mcp-config logic ─────────────────────────────────────────────

function writeMCPConfig(
    ideName: string,
    configPath: string,
    mcpServerPath: string,
    readFileSyncOrNull: (p: string) => string | null,
    mkdirSyncFn: (dir: string, opts: { recursive: boolean }) => void,
    writeFileSyncFn: (p: string, data: string, encoding: 'utf-8') => void,
): { written: boolean } {
    mkdirSyncFn(path.dirname(configPath), { recursive: true })

    let existing: Record<string, unknown> = {}
    const raw = readFileSyncOrNull(configPath)
    if (raw !== null) {
        try {
            existing = JSON.parse(stripJsoncComments(raw)) as Record<string, unknown>
        } catch {
            // start fresh on parse error
        }
    }

    const flintEntry = { command: 'node', args: [mcpServerPath] }

    if (ideName === 'VS Code' || ideName === 'Antigravity') {
        const mcp = (existing.mcp ?? {}) as Record<string, unknown>
        const servers = (mcp.servers ?? {}) as Record<string, unknown>
        servers.flint = flintEntry
        mcp.servers = servers
        existing.mcp = mcp
    } else {
        const mcpServers = (existing.mcpServers ?? {}) as Record<string, unknown>
        mcpServers.flint = flintEntry
        existing.mcpServers = mcpServers
    }

    writeFileSyncFn(configPath, JSON.stringify(existing, null, 2), 'utf-8')
    return { written: true }
}

// ── setup:check-first-launch logic ───────────────────────────────────────────

interface FirstLaunchStatus {
    isFirstLaunch: boolean
}

function checkFirstLaunch(
    readFileSyncOrThrow: (p: string, encoding: 'utf-8') => string,
): FirstLaunchStatus {
    const setupPath = path.join(os.homedir(), '.flint', 'setup.json')
    try {
        const raw = readFileSyncOrThrow(setupPath, 'utf-8')
        const parsed = JSON.parse(raw) as { firstLaunchComplete?: boolean }
        if (parsed.firstLaunchComplete === true) {
            return { isFirstLaunch: false }
        }
        return { isFirstLaunch: true }
    } catch {
        return { isFirstLaunch: true }
    }
}

// ── setup:complete-first-launch logic ────────────────────────────────────────

function completeFirstLaunch(
    mkdirSync: (p: string, opts: { recursive: boolean }) => void,
    writeFileSync: (p: string, data: string, encoding: 'utf-8') => void,
    nowMs: number,
): void {
    const flintDir = path.join(os.homedir(), '.flint')
    mkdirSync(flintDir, { recursive: true })
    const setupPath = path.join(flintDir, 'setup.json')
    writeFileSync(
        setupPath,
        JSON.stringify({ firstLaunchComplete: true, completedAt: nowMs }, null, 2),
        'utf-8',
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP-01 through SETUP-06 — setup:detect-ides
// ─────────────────────────────────────────────────────────────────────────────

describe('setup:detect-ides', () => {
    const home = os.homedir()
    const claudeDetectionPath = path.join(home, '.claude', 'settings.json')
    const claudeSettingsPath = path.join(home, '.claude', 'mcp.json')
    const antigravityDetectionPath = path.join(home, 'Library', 'Application Support', 'Antigravity', 'User', 'settings.json')
    const antigravitySettingsPath = path.join(home, '.gemini', 'antigravity', 'mcp_config.json')
    const cursorPath = path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json')
    // const vscodePath = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json')
    const MOCK_SERVER_PATH = '/usr/local/flint-mcp/dist/server.js'

    // SETUP-01: all 4 IDEs detected when all files exist
    it('returns detected: true for all 4 IDEs when all settings files exist', () => {
        const existsSync = vi.fn().mockReturnValue(true)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        expect(result.ides).toHaveLength(4)
        for (const ide of result.ides) {
            expect(ide.detected).toBe(true)
        }
    })

    // SETUP-02: partial detection — only Cursor file exists
    it('returns detected: false for IDEs whose files do not exist', () => {
        const existsSync = vi.fn().mockImplementation((p: string) => p === cursorPath)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        const claude = result.ides.find((i) => i.name === 'Claude Code')!
        const antigravity = result.ides.find((i) => i.name === 'Antigravity')!
        const cursor = result.ides.find((i) => i.name === 'Cursor')!
        const vscode = result.ides.find((i) => i.name === 'VS Code')!

        expect(claude.detected).toBe(false)
        expect(antigravity.detected).toBe(false)
        expect(cursor.detected).toBe(true)
        expect(vscode.detected).toBe(false)
    })

    // SETUP-03: all IDEs undetected when no files exist
    it('returns detected: false for every IDE when no settings files are found', () => {
        const existsSync = vi.fn().mockReturnValue(false)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        for (const ide of result.ides) {
            expect(ide.detected).toBe(false)
        }
    })

    // SETUP-04: mcpServerPath always present
    it('always includes mcpServerPath in the response', () => {
        const existsSync = vi.fn().mockReturnValue(false)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        expect(result.mcpServerPath).toBe(MOCK_SERVER_PATH)
        expect(typeof result.mcpServerPath).toBe('string')
        expect(result.mcpServerPath.length).toBeGreaterThan(0)
    })

    // SETUP-05: Claude Code settingsPath is mcp.json when mcp.json exists
    it('sets Claude Code settingsPath to ~/.claude/mcp.json when mcp.json is present', () => {
        // existsSync returns true for mcp.json so settingsPath should prefer it
        const existsSync = vi.fn().mockImplementation((p: string) => p === claudeSettingsPath)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        const claude = result.ides.find((i) => i.name === 'Claude Code')!
        expect(claude.settingsPath).toBe(claudeSettingsPath)
        expect(claude.settingsPath).toMatch(/mcp\.json$/)
        expect(claude.settingsPath).not.toMatch(/settings\.json$/)
    })

    // SETUP-06: Claude Code detected via settings.json (older install, no mcp.json)
    it('detects Claude Code when only settings.json exists (older install)', () => {
        // Only settings.json exists — mcp.json is absent
        const existsSync = vi.fn().mockImplementation((p: string) => p === claudeDetectionPath)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        const claude = result.ides.find((i) => i.name === 'Claude Code')!

        // Detection should fire — the settings.json file exists
        expect(claude.detected).toBe(true)

        // Confirm existsSync was called with the settings.json detection path
        expect(existsSync).toHaveBeenCalledWith(claudeDetectionPath)
    })

    // SETUP-06b: Claude Code detected when only mcp.json exists (fresh install)
    it('detects Claude Code when only mcp.json exists (fresh MCP-first install)', () => {
        // Only mcp.json exists — settings.json is absent
        const existsSync = vi.fn().mockImplementation((p: string) => p === claudeSettingsPath)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        const claude = result.ides.find((i) => i.name === 'Claude Code')!

        // Detection should fire — mcp.json counts as proof of Claude Code install
        expect(claude.detected).toBe(true)

        // Confirm existsSync was called with the mcp.json path
        expect(existsSync).toHaveBeenCalledWith(claudeSettingsPath)
    })

    // SETUP-06c: Claude Code settingsPath prefers mcp.json when both files exist
    it('reports mcp.json as settingsPath when both settings.json and mcp.json are present', () => {
        // Both files exist
        const existsSync = vi.fn().mockReturnValue(true)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        const claude = result.ides.find((i) => i.name === 'Claude Code')!
        expect(claude.settingsPath).toBe(claudeSettingsPath)
        expect(claude.settingsPath).toMatch(/mcp\.json$/)
    })

    // SETUP-06d: Claude Code settingsPath falls back to settings.json when mcp.json is absent
    it('reports settings.json as settingsPath when mcp.json is absent', () => {
        // Only settings.json exists — mcp.json is absent
        const existsSync = vi.fn().mockImplementation((p: string) => p === claudeDetectionPath)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        const claude = result.ides.find((i) => i.name === 'Claude Code')!
        // Falls back to settings.json since mcp.json doesn't exist
        expect(claude.settingsPath).toBe(claudeDetectionPath)
        expect(claude.settingsPath).toMatch(/settings\.json$/)
    })

    // Antigravity: settingsPath is ~/.gemini/antigravity/mcp_config.json
    it('sets Antigravity settingsPath to ~/.gemini/antigravity/mcp_config.json', () => {
        const existsSync = vi.fn().mockReturnValue(false)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        const ag = result.ides.find((i) => i.name === 'Antigravity')!
        expect(ag.settingsPath).toBe(antigravitySettingsPath)
        expect(ag.settingsPath).toMatch(/mcp_config\.json$/)
    })

    // Antigravity: detection file differs from settings file
    it('detects Antigravity via its app settings.json but reports mcp_config.json as settingsPath', () => {
        const existsSync = vi.fn().mockImplementation((p: string) => p === antigravityDetectionPath)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        const ag = result.ides.find((i) => i.name === 'Antigravity')!
        expect(ag.detected).toBe(true)
        expect(ag.settingsPath).toBe(antigravitySettingsPath)
        expect(existsSync).toHaveBeenCalledWith(antigravityDetectionPath)
        expect(existsSync).not.toHaveBeenCalledWith(antigravitySettingsPath)
    })

    // Extra: returns exactly 4 IDEs in priority order
    it('returns exactly 4 IDEs in order: Claude Code, Antigravity, Cursor, VS Code', () => {
        const existsSync = vi.fn().mockReturnValue(false)
        const result = detectIDEs(existsSync, MOCK_SERVER_PATH)

        expect(result.ides[0].name).toBe('Claude Code')
        expect(result.ides[1].name).toBe('Antigravity')
        expect(result.ides[2].name).toBe('Cursor')
        expect(result.ides[3].name).toBe('VS Code')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// SETUP-15 through SETUP-20 — setup:write-mcp-config
// ─────────────────────────────────────────────────────────────────────────────

describe('setup:write-mcp-config', () => {
    const home = os.homedir()
    const MOCK_SERVER_PATH = '/flint-mcp/dist/server.js'

    const makeHelpers = (existingContent: string | null = null) => ({
        readFile: vi.fn().mockImplementation(() => existingContent),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
    })

    // SETUP-15: Antigravity writes mcp.servers format
    it('writes mcp.servers format for Antigravity', () => {
        const configPath = path.join(home, '.gemini', 'antigravity', 'mcp_config.json')
        const { readFile, mkdir, writeFile } = makeHelpers()

        writeMCPConfig('Antigravity', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)

        const [, written] = writeFile.mock.calls[0] as [string, string, string]
        const parsed = JSON.parse(written) as { mcp: { servers: { flint: { command: string; args: string[] } } } }
        expect(parsed.mcp.servers.flint.command).toBe('node')
        expect(parsed.mcp.servers.flint.args[0]).toBe(MOCK_SERVER_PATH)
    })

    // SETUP-16: VS Code writes mcp.servers format
    it('writes mcp.servers format for VS Code', () => {
        const configPath = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json')
        const { readFile, mkdir, writeFile } = makeHelpers()

        writeMCPConfig('VS Code', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)

        const [, written] = writeFile.mock.calls[0] as [string, string, string]
        const parsed = JSON.parse(written) as { mcp: { servers: { flint: unknown } } }
        expect(parsed.mcp.servers.flint).toBeDefined()
    })

    // SETUP-17: Claude Code writes mcpServers format
    it('writes mcpServers format for Claude Code', () => {
        const configPath = path.join(home, '.claude', 'mcp.json')
        const { readFile, mkdir, writeFile } = makeHelpers()

        writeMCPConfig('Claude Code', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)

        const [, written] = writeFile.mock.calls[0] as [string, string, string]
        const parsed = JSON.parse(written) as { mcpServers: { flint: unknown } }
        expect(parsed.mcpServers.flint).toBeDefined()
        expect((parsed as Record<string, unknown>).mcp).toBeUndefined()
    })

    // SETUP-18: merges with existing config — does not clobber other entries
    it('merges flint entry into existing config without clobbering other keys', () => {
        const configPath = path.join(home, '.gemini', 'antigravity', 'mcp_config.json')
        const existing = JSON.stringify({ mcp: { servers: { other: { command: 'other' } } } })
        const { readFile, mkdir, writeFile } = makeHelpers(existing)

        writeMCPConfig('Antigravity', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)

        const [, written] = writeFile.mock.calls[0] as [string, string, string]
        const parsed = JSON.parse(written) as { mcp: { servers: Record<string, unknown> } }
        expect(parsed.mcp.servers.other).toBeDefined()
        expect(parsed.mcp.servers.flint).toBeDefined()
    })

    // SETUP-19: creates parent directory with recursive: true
    it('calls mkdirSync with recursive: true on the config parent directory', () => {
        const configPath = path.join(home, '.gemini', 'antigravity', 'mcp_config.json')
        const { readFile, mkdir, writeFile } = makeHelpers()

        writeMCPConfig('Antigravity', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)

        expect(mkdir).toHaveBeenCalledWith(path.dirname(configPath), { recursive: true })
    })

    // SETUP-20: returns { written: true }
    it('returns { written: true } on success', () => {
        const configPath = path.join(home, '.gemini', 'antigravity', 'mcp_config.json')
        const { readFile, mkdir, writeFile } = makeHelpers()

        const result = writeMCPConfig('Antigravity', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)
        expect(result).toEqual({ written: true })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// SETUP-07 through SETUP-10 — setup:check-first-launch
// ─────────────────────────────────────────────────────────────────────────────

describe('setup:check-first-launch', () => {
    // SETUP-07: returns isFirstLaunch: true when file does not exist
    it('returns { isFirstLaunch: true } when the setup file does not exist', () => {
        const readFile = vi.fn().mockImplementation(() => {
            const err = new Error('ENOENT: no such file or directory')
            ;(err as NodeJS.ErrnoException).code = 'ENOENT'
            throw err
        })

        const result = checkFirstLaunch(readFile)
        expect(result).toEqual({ isFirstLaunch: true })
    })

    // SETUP-08: returns isFirstLaunch: false when flag is set
    it('returns { isFirstLaunch: false } when setup.json contains firstLaunchComplete: true', () => {
        const readFile = vi.fn().mockReturnValue(
            JSON.stringify({ firstLaunchComplete: true, completedAt: 1700000000000 }),
        )

        const result = checkFirstLaunch(readFile)
        expect(result).toEqual({ isFirstLaunch: false })
    })

    // SETUP-09: returns isFirstLaunch: true on corrupt JSON
    it('returns { isFirstLaunch: true } when setup.json contains corrupt/unparseable JSON', () => {
        const readFile = vi.fn().mockReturnValue('{ this is not valid json %%% }')

        const result = checkFirstLaunch(readFile)
        expect(result).toEqual({ isFirstLaunch: true })
    })

    // SETUP-10: returns isFirstLaunch: true when key is missing from valid JSON
    it('returns { isFirstLaunch: true } when file exists but firstLaunchComplete key is absent', () => {
        const readFile = vi.fn().mockReturnValue(
            JSON.stringify({ someOtherKey: 'value', completedAt: 1700000000000 }),
        )

        const result = checkFirstLaunch(readFile)
        expect(result).toEqual({ isFirstLaunch: true })
    })

    // Edge: firstLaunchComplete is false (not true) — still first launch
    it('returns { isFirstLaunch: true } when firstLaunchComplete is false', () => {
        const readFile = vi.fn().mockReturnValue(
            JSON.stringify({ firstLaunchComplete: false }),
        )

        const result = checkFirstLaunch(readFile)
        expect(result).toEqual({ isFirstLaunch: true })
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// SETUP-11 through SETUP-14 — setup:complete-first-launch
// ─────────────────────────────────────────────────────────────────────────────

describe('setup:complete-first-launch', () => {
    const home = os.homedir()
    const expectedDir = path.join(home, '.flint')
    const expectedFile = path.join(expectedDir, 'setup.json')

    // SETUP-11: creates ~/.flint/ directory with recursive: true
    it('calls mkdirSync with { recursive: true } on ~/.flint/', () => {
        const mkdirSync = vi.fn()
        const writeFileSync = vi.fn()
        const now = Date.now()

        completeFirstLaunch(mkdirSync, writeFileSync, now)

        expect(mkdirSync).toHaveBeenCalledOnce()
        expect(mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true })
    })

    // SETUP-12: writes JSON with firstLaunchComplete: true
    it('writes firstLaunchComplete: true to ~/.flint/setup.json', () => {
        const mkdirSync = vi.fn()
        const writeFileSync = vi.fn()
        const now = 1700000001234

        completeFirstLaunch(mkdirSync, writeFileSync, now)

        expect(writeFileSync).toHaveBeenCalledOnce()
        const [calledPath, calledData] = writeFileSync.mock.calls[0] as [string, string, string]
        expect(calledPath).toBe(expectedFile)

        const parsed = JSON.parse(calledData) as { firstLaunchComplete: boolean; completedAt: number }
        expect(parsed.firstLaunchComplete).toBe(true)
    })

    // SETUP-13: written JSON includes a completedAt timestamp
    it('includes a numeric completedAt value in the written JSON', () => {
        const mkdirSync = vi.fn()
        const writeFileSync = vi.fn()
        const now = 1700000005678

        completeFirstLaunch(mkdirSync, writeFileSync, now)

        const [, calledData] = writeFileSync.mock.calls[0] as [string, string, string]
        const parsed = JSON.parse(calledData) as { firstLaunchComplete: boolean; completedAt: number }
        expect(parsed.completedAt).toBe(now)
        expect(typeof parsed.completedAt).toBe('number')
    })

    // SETUP-14: idempotent — calling twice does not throw
    it('does not throw when called a second time (idempotent)', () => {
        const mkdirSync = vi.fn()
        const writeFileSync = vi.fn()
        const now = Date.now()

        expect(() => {
            completeFirstLaunch(mkdirSync, writeFileSync, now)
            completeFirstLaunch(mkdirSync, writeFileSync, now)
        }).not.toThrow()

        // mkdirSync and writeFileSync are called once per invocation
        expect(mkdirSync).toHaveBeenCalledTimes(2)
        expect(writeFileSync).toHaveBeenCalledTimes(2)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// SETUP-21 through SETUP-27 — stripJsoncComments + JSONC-safe write
// ─────────────────────────────────────────────────────────────────────────────

describe('stripJsoncComments', () => {
    // SETUP-25: empty input
    it('returns empty string for empty input', () => {
        expect(stripJsoncComments('')).toBe('')
    })

    // SETUP-26: plain JSON passes through unchanged
    it('returns plain JSON unchanged', () => {
        const input = '{"editor.fontSize": 14, "workbench.colorTheme": "Default Dark+"}'
        expect(stripJsoncComments(input)).toBe(input)
    })

    // SETUP-27: trailing // comment without newline is stripped
    it('strips a single-line comment at end of file with no trailing newline', () => {
        const input = '{"key": "value"} // trailing comment'
        const result = stripJsoncComments(input)
        expect(result).toBe('{"key": "value"} ')
        // result must be valid JSON after stripping
        expect(() => JSON.parse(result.trim())).not.toThrow()
    })

    it('strips single-line // comments but preserves the rest of the value', () => {
        const input = `{
  // User settings
  "editor.fontSize": 14
}`
        const result = stripJsoncComments(input)
        expect(result).not.toContain('// User settings')
        const parsed = JSON.parse(result) as { 'editor.fontSize': number }
        expect(parsed['editor.fontSize']).toBe(14)
    })

    it('strips block /* */ comments', () => {
        const input = `{
  /* multi
     line comment */
  "editor.tabSize": 2
}`
        const result = stripJsoncComments(input)
        expect(result).not.toContain('multi')
        const parsed = JSON.parse(result) as { 'editor.tabSize': number }
        expect(parsed['editor.tabSize']).toBe(2)
    })

    it('does not strip comment markers that appear inside string values', () => {
        // The string value contains "// not a comment" — must be preserved
        const input = '{"message": "See // not a comment /* also fine */"}'
        const result = stripJsoncComments(input)
        expect(result).toBe(input)
        const parsed = JSON.parse(result) as { message: string }
        expect(parsed.message).toBe('See // not a comment /* also fine */')
    })
})

describe('setup:write-mcp-config (JSONC-safe merge)', () => {
    const home = os.homedir()
    const MOCK_SERVER_PATH = '/flint-mcp/dist/server.js'

    const makeHelpers = (existingContent: string | null = null) => ({
        readFile: vi.fn().mockImplementation(() => existingContent),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
    })

    // SETUP-21: single-line // comments in existing file do not break the merge
    it('merges flint entry into a JSONC config containing single-line comments', () => {
        const configPath = path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json')
        const jsoncContent = `{
  // Cursor user settings
  "editor.fontSize": 16,
  "mcpServers": {
    "other-server": { "command": "node", "args": ["/other/server.js"] }
  }
}`
        const { readFile, mkdir, writeFile } = makeHelpers(jsoncContent)

        writeMCPConfig('Cursor', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)

        const [, written] = writeFile.mock.calls[0] as [string, string, string]
        const parsed = JSON.parse(written) as {
            mcpServers: Record<string, unknown>
            'editor.fontSize': number
        }
        // Pre-existing server must not be clobbered
        expect(parsed.mcpServers['other-server']).toBeDefined()
        // Flint entry must be added
        expect(parsed.mcpServers['flint']).toBeDefined()
        // Pre-existing scalar setting must survive
        expect(parsed['editor.fontSize']).toBe(16)
    })

    // SETUP-22: block /* */ comments in existing file do not break the merge
    it('merges flint entry into a JSONC config containing block comments', () => {
        const configPath = path.join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json')
        const jsoncContent = `{
  /* VS Code settings
     generated by setup wizard */
  "workbench.colorTheme": "Default Dark+",
  "mcp": {
    "servers": {
      "existing": { "type": "stdio", "command": "node", "args": ["/existing.js"] }
    }
  }
}`
        const { readFile, mkdir, writeFile } = makeHelpers(jsoncContent)

        writeMCPConfig('VS Code', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)

        const [, written] = writeFile.mock.calls[0] as [string, string, string]
        const parsed = JSON.parse(written) as {
            mcp: { servers: Record<string, unknown> }
            'workbench.colorTheme': string
        }
        expect(parsed.mcp.servers['existing']).toBeDefined()
        expect(parsed.mcp.servers['flint']).toBeDefined()
        expect(parsed['workbench.colorTheme']).toBe('Default Dark+')
    })

    // SETUP-23: comment markers inside string values are preserved
    it('does not corrupt string values that contain comment-like characters', () => {
        const configPath = path.join(home, '.claude', 'mcp.json')
        const jsoncContent = `{
  "description": "see http://example.com // for details",
  "mcpServers": {}
}`
        const { readFile, mkdir, writeFile } = makeHelpers(jsoncContent)

        writeMCPConfig('Claude Code', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)

        const [, written] = writeFile.mock.calls[0] as [string, string, string]
        const parsed = JSON.parse(written) as {
            description: string
            mcpServers: Record<string, unknown>
        }
        expect(parsed.description).toBe('see http://example.com // for details')
        expect(parsed.mcpServers['flint']).toBeDefined()
    })

    // SETUP-24: JSONC config with comments is merged without clobbering other entries
    it('preserves all pre-existing entries when merging into a JSONC file', () => {
        const configPath = path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json')
        const jsoncContent = `{
  // Keep these settings
  "editor.rulers": [80, 120],
  "mcpServers": {
    "server-a": { "command": "node", "args": ["/a.js"] },
    "server-b": { "command": "node", "args": ["/b.js"] }
  }
}`
        const { readFile, mkdir, writeFile } = makeHelpers(jsoncContent)

        writeMCPConfig('Cursor', configPath, MOCK_SERVER_PATH, readFile, mkdir, writeFile)

        const [, written] = writeFile.mock.calls[0] as [string, string, string]
        const parsed = JSON.parse(written) as {
            mcpServers: Record<string, { command: string; args: string[] }>
            'editor.rulers': number[]
        }
        expect(parsed.mcpServers['server-a']).toBeDefined()
        expect(parsed.mcpServers['server-b']).toBeDefined()
        expect(parsed.mcpServers['flint']).toBeDefined()
        expect(parsed['editor.rulers']).toEqual([80, 120])
    })
})
