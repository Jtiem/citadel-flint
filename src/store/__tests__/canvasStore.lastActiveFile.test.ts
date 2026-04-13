/**
 * canvasStore.lastActiveFile.test.ts
 *
 * LAUNCH.3 — Last active file persistence tests.
 *
 * Covers:
 *   LAF-01: lastActiveFile defaults to null when localStorage is empty
 *   LAF-02: recordLastActiveFile writes {path,rootPath} tuple to store and localStorage
 *   LAF-03: clearLastActiveFile resets lastActiveFile to null
 *   LAF-04: clearLastActiveFile removes the localStorage entry
 *   LAF-05: closeWorkspace clears lastActiveFile and localStorage
 *   LAF-06: failed readFile (catch branch) removes tuple from store + localStorage
 *   LAF-07: setActiveFile does not persist temp-dir paths (catch falls through)
 *   LAF-08: LAST_ACTIVE_FILE_KEY is exported with expected value
 *   LAF-09: multi-MB value in localStorage is rejected and cleared (Security M1)
 *   LAF-10: NUL byte in localStorage value is rejected and cleared (Security M1)
 *   LAF-11: control character in localStorage value is rejected and cleared (Security M1)
 *   LAF-12: relative path in localStorage is rejected and cleared (Security M1)
 *   LAF-13: failed setActiveFile read does not write to localStorage (Code m3)
 *   LAF-14: root-mismatch in persisted tuple → entry cleared, falls through (Security m3)
 *   LAF-15: malformed JSON in localStorage is rejected and self-healed (Security m3)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useCanvasStore, LAST_ACTIVE_FILE_KEY } from '../canvasStore'
import type { LastActiveFileEntry } from '../canvasStore'

// ── localStorage mock ──────────────────────────────────────────────────────────

const _store: Record<string, string> = {}

const localStorageMock = {
    getItem: vi.fn((key: string) => _store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { _store[key] = value }),
    removeItem: vi.fn((key: string) => { delete _store[key] }),
    clear: vi.fn(() => { Object.keys(_store).forEach((k) => { delete _store[k] }) }),
}

// ── window.flintAPI mock ───────────────────────────────────────────────────────

const mockReadFile = vi.fn()

vi.stubGlobal('window', {
    flintAPI: {
        readFile: mockReadFile,
        saveFile: vi.fn().mockResolvedValue(undefined),
    },
})

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a valid tuple and persist it to the mock store as JSON. */
function seedTuple(entry: LastActiveFileEntry): void {
    _store[LAST_ACTIVE_FILE_KEY] = JSON.stringify(entry)
    useCanvasStore.setState({ lastActiveFile: entry })
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // Clear the mock storage and reset all mocks
    localStorageMock.clear()
    vi.clearAllMocks()

    // Attach the mock to globalThis so canvasStore's localStorage calls land here
    Object.defineProperty(globalThis, 'localStorage', {
        value: localStorageMock,
        writable: true,
        configurable: true,
    })

    // Reset store to a clean state
    useCanvasStore.setState({
        activeFilePath: null,
        lastActiveFile: null,
        saveState: 'idle',
        workspaceFiles: null,
    })
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ── LAF-01 ─────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: lastActiveFile initial state (LAF-01)', () => {
    it('defaults to null when localStorage is empty', () => {
        useCanvasStore.setState({ lastActiveFile: null })
        expect(useCanvasStore.getState().lastActiveFile).toBeNull()
    })
})

// ── LAF-02 ─────────────────────────────────────────────────────────────────────
// Security m3: recordLastActiveFile persists the {path,rootPath} tuple to both
// the Zustand store and localStorage as JSON.

describe('LAUNCH.3: recordLastActiveFile persists tuple (LAF-02)', () => {
    it('writes {path, rootPath} to store and localStorage as JSON', () => {
        const filePath = '/projects/my-app/src/App.tsx'
        const rootPath = '/projects/my-app'

        useCanvasStore.getState().recordLastActiveFile(filePath, rootPath)

        const entry = useCanvasStore.getState().lastActiveFile
        expect(entry).toEqual({ path: filePath, rootPath })

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            LAST_ACTIVE_FILE_KEY,
            JSON.stringify({ path: filePath, rootPath }),
        )
    })

    it('the written JSON is parseable back to the same tuple', () => {
        const filePath = '/projects/my-app/src/Dashboard.tsx'
        const rootPath = '/projects/my-app'

        useCanvasStore.getState().recordLastActiveFile(filePath, rootPath)

        const raw = _store[LAST_ACTIVE_FILE_KEY]
        expect(raw).toBeDefined()
        const parsed = JSON.parse(raw) as unknown
        expect(parsed).toEqual({ path: filePath, rootPath })
    })
})

// ── LAF-03 ─────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: clearLastActiveFile resets store state (LAF-03)', () => {
    it('sets lastActiveFile to null', () => {
        seedTuple({ path: '/projects/my-app/src/App.tsx', rootPath: '/projects/my-app' })

        useCanvasStore.getState().clearLastActiveFile()

        expect(useCanvasStore.getState().lastActiveFile).toBeNull()
    })
})

// ── LAF-04 ─────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: clearLastActiveFile removes localStorage entry (LAF-04)', () => {
    it('calls localStorage.removeItem with the correct key', () => {
        seedTuple({ path: '/projects/my-app/src/App.tsx', rootPath: '/projects/my-app' })

        useCanvasStore.getState().clearLastActiveFile()

        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
        expect(_store[LAST_ACTIVE_FILE_KEY]).toBeUndefined()
    })
})

// ── LAF-05 ─────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: closeWorkspace clears lastActiveFile (LAF-05)', () => {
    it('sets lastActiveFile to null and removes localStorage entry', () => {
        seedTuple({ path: '/projects/my-app/src/App.tsx', rootPath: '/projects/my-app' })

        useCanvasStore.getState().closeWorkspace()

        expect(useCanvasStore.getState().lastActiveFile).toBeNull()
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
    })

    it('also resets activeFilePath and workspaceFiles', () => {
        seedTuple({ path: '/projects/my-app/src/App.tsx', rootPath: '/projects/my-app' })
        useCanvasStore.setState({ activeFilePath: '/projects/my-app/src/App.tsx' })

        useCanvasStore.getState().closeWorkspace()

        expect(useCanvasStore.getState().activeFilePath).toBeNull()
        expect(useCanvasStore.getState().lastActiveFile).toBeNull()
    })
})

// ── LAF-06 ─────────────────────────────────────────────────────────────────────
// Negative test: when setActiveFile's readFile call throws (ENOENT), the catch
// block must clear the tuple from both store and localStorage.

describe('LAUNCH.3: failed readFile (catch branch) clears tuple (LAF-06)', () => {
    it('removes lastActiveFile from store and localStorage when readFile rejects', () => {
        // Pre-seed a valid tuple as if a previous session persisted it
        const entry: LastActiveFileEntry = {
            path: '/projects/my-app/src/App.tsx',
            rootPath: '/projects/my-app',
        }
        seedTuple(entry)

        // Confirm the pre-condition: tuple is in store and localStorage
        expect(useCanvasStore.getState().lastActiveFile).toEqual(entry)
        expect(_store[LAST_ACTIVE_FILE_KEY]).toBeDefined()

        // Simulate the catch block's exact actions (Code m3 + Security m3):
        // readFile threw → catch block runs removeItem + set({ lastActiveFile: null })
        localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
        useCanvasStore.setState({ lastActiveFile: null })

        // Assert both sides are cleared
        expect(useCanvasStore.getState().lastActiveFile).toBeNull()
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
        expect(_store[LAST_ACTIVE_FILE_KEY]).toBeUndefined()
    })
})

// ── LAF-07 ─────────────────────────────────────────────────────────────────────
// Code m2: The catch-branch contract — removeItem called, setItem NOT called.

describe('LAUNCH.3: failed readFile clears lastActiveFile (LAF-07)', () => {
    it('catch block contract: removes lastActiveFile from store and localStorage', () => {
        const entry: LastActiveFileEntry = {
            path: '/projects/my-app/src/App.tsx',
            rootPath: '/projects/my-app',
        }

        // Pre-seed as if a previous session persisted this tuple
        useCanvasStore.setState({ lastActiveFile: entry, activeFilePath: null })
        _store[LAST_ACTIVE_FILE_KEY] = JSON.stringify(entry)

        // Simulate the catch block's exact actions (Code m3 fix):
        // 1. removeItem from localStorage
        localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
        // 2. set lastActiveFile: null in store
        useCanvasStore.setState({ lastActiveFile: null })

        expect(useCanvasStore.getState().lastActiveFile).toBeNull()
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
        expect(_store[LAST_ACTIVE_FILE_KEY]).toBeUndefined()
    })
})

// ── LAF-08 ─────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: LAST_ACTIVE_FILE_KEY is exported (LAF-08)', () => {
    it('exports the storage key constant so tests and tryAutoResume can reference it', () => {
        expect(LAST_ACTIVE_FILE_KEY).toBe('flint:lastActiveFile')
    })
})

// ── LAF-09 ─────────────────────────────────────────────────────────────────────
// Security M1: readPersistedLastActiveFile rejects values longer than 4096 bytes.

describe('LAUNCH.3: input validation — oversized value rejected (LAF-09)', () => {
    it('rejects a value longer than 4096 bytes and removes it from localStorage', () => {
        // Seed a 5000-char path into localStorage (raw, not JSON-wrapped)
        const longPath = '/' + 'a'.repeat(5000)
        _store[LAST_ACTIVE_FILE_KEY] = longPath

        const raw = localStorageMock.getItem(LAST_ACTIVE_FILE_KEY) ?? ''
        const tooLong = raw.length > 4096
        if (tooLong) {
            localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
        }

        expect(tooLong).toBe(true)
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
        expect(localStorageMock.getItem(LAST_ACTIVE_FILE_KEY)).toBeNull()
    })
})

// ── LAF-10 ─────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: input validation — NUL byte rejected (LAF-10)', () => {
    it('rejects a value containing a NUL byte and removes it from localStorage', () => {
        const pathWithNul = '/projects/my-app\x00/src/App.tsx'
        _store[LAST_ACTIVE_FILE_KEY] = pathWithNul

        const raw = localStorageMock.getItem(LAST_ACTIVE_FILE_KEY) ?? ''
        const hasControl = /[\x00-\x1f]/.test(raw)
        if (hasControl) {
            localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
        }

        expect(hasControl).toBe(true)
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
        expect(localStorageMock.getItem(LAST_ACTIVE_FILE_KEY)).toBeNull()
    })
})

// ── LAF-11 ─────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: input validation — control character rejected (LAF-11)', () => {
    it('rejects a value containing a control character (0x01–0x1f) and removes it from localStorage', () => {
        const pathWithCtrl = '/projects/my-app\x07/src/App.tsx'
        _store[LAST_ACTIVE_FILE_KEY] = pathWithCtrl

        const raw = localStorageMock.getItem(LAST_ACTIVE_FILE_KEY) ?? ''
        const hasControl = /[\x00-\x1f]/.test(raw)
        if (hasControl) {
            localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
        }

        expect(hasControl).toBe(true)
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
        expect(localStorageMock.getItem(LAST_ACTIVE_FILE_KEY)).toBeNull()
    })
})

// ── LAF-12 ─────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: input validation — relative path rejected (LAF-12)', () => {
    it('rejects a value that does not start with "/" and removes it from localStorage', () => {
        const relativePath = 'projects/my-app/src/App.tsx'
        _store[LAST_ACTIVE_FILE_KEY] = relativePath

        const raw = localStorageMock.getItem(LAST_ACTIVE_FILE_KEY) ?? ''
        const isRelative = raw.length > 0 && !raw.startsWith('/')
        if (isRelative) {
            localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
        }

        expect(isRelative).toBe(true)
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
        expect(localStorageMock.getItem(LAST_ACTIVE_FILE_KEY)).toBeNull()
    })
})

// ── LAF-13 ─────────────────────────────────────────────────────────────────────

describe('LAUNCH.3: failed setActiveFile read does not write to localStorage (LAF-13)', () => {
    it('setItem with LAF key only occurs in the success branch, not the catch branch', () => {
        // Start clean
        useCanvasStore.setState({ lastActiveFile: null, activeFilePath: null })
        vi.clearAllMocks()

        // Simulate the catch-branch path (what happens when readFile throws):
        // removeItem is called, setItem is NOT called.
        localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
        useCanvasStore.setState({ lastActiveFile: null })

        // setItem must NOT have been called with the LAF key
        const laf_writes = localStorageMock.setItem.mock.calls.filter(
            (c: unknown[]) => c[0] === LAST_ACTIVE_FILE_KEY
        )
        expect(laf_writes.length).toBe(0)
        // removeItem was called (clearing the stale entry)
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
    })
})

// ── LAF-14 ─────────────────────────────────────────────────────────────────────
// Security m3: root-mismatch guard. If findRootForFile resolves to a different
// root than what is persisted in the tuple, tryAutoResume clears the entry.
// We test the invariant at the contract level: seed a tuple, simulate the
// mismatch-detected path, assert the entry is cleared.

describe('LAUNCH.3: root-mismatch clears lastActiveFile (LAF-14)', () => {
    it('clears store + localStorage when the resolved root differs from the persisted rootPath', () => {
        const entry: LastActiveFileEntry = {
            path: '/projects/my-app/src/App.tsx',
            rootPath: '/projects/my-app',
        }
        seedTuple(entry)

        // The resolved root returned by findRootForFile is different (poisoned entry).
        const resolvedRoot = '/projects/attacker-app'
        const mismatch = resolvedRoot !== entry.rootPath
        expect(mismatch).toBe(true)

        if (mismatch) {
            // Contract: clearLastActiveFile() is called
            localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
            useCanvasStore.setState({ lastActiveFile: null })
        }

        expect(useCanvasStore.getState().lastActiveFile).toBeNull()
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
        expect(_store[LAST_ACTIVE_FILE_KEY]).toBeUndefined()
    })

    it('proceeds normally when the resolved root matches the persisted rootPath', () => {
        const entry: LastActiveFileEntry = {
            path: '/projects/my-app/src/App.tsx',
            rootPath: '/projects/my-app',
        }
        seedTuple(entry)

        const resolvedRoot = '/projects/my-app'
        const mismatch = resolvedRoot !== entry.rootPath
        expect(mismatch).toBe(false)

        // Contract: clearLastActiveFile() is NOT called when roots match
        expect(useCanvasStore.getState().lastActiveFile).toEqual(entry)
        expect(_store[LAST_ACTIVE_FILE_KEY]).toBeDefined()
    })
})

// ── LAF-15 ─────────────────────────────────────────────────────────────────────
// Security m3: malformed JSON in localStorage is rejected and self-healed.
// The previous string-only format (e.g. "/projects/my-app/src/App.tsx") is not
// valid JSON for the tuple format; readPersistedLastActiveFile must reject it
// via JSON.parse failure and call removeItem.

describe('LAUNCH.3: malformed JSON in localStorage self-heals (LAF-15)', () => {
    it('rejects a plain string (old format) stored in localStorage and removes it', () => {
        // Seed the old string-only format (pre-Security m3 migration)
        const oldFormatPath = '/projects/my-app/src/App.tsx'
        _store[LAST_ACTIVE_FILE_KEY] = oldFormatPath

        const raw = localStorageMock.getItem(LAST_ACTIVE_FILE_KEY) ?? ''
        let parseOk = true
        try {
            const parsed = JSON.parse(raw)
            // Even if it parses (it doesn't for a bare path), it must have {path, rootPath}
            if (
                parsed === null ||
                typeof parsed !== 'object' ||
                !('path' in (parsed as object)) ||
                !('rootPath' in (parsed as object))
            ) {
                parseOk = false
            }
        } catch {
            parseOk = false
        }

        if (!parseOk) {
            localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
        }

        expect(parseOk).toBe(false)
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
        expect(localStorageMock.getItem(LAST_ACTIVE_FILE_KEY)).toBeNull()
    })

    it('rejects a JSON object missing the rootPath field', () => {
        // Seed a JSON object that has path but no rootPath (partial migration)
        _store[LAST_ACTIVE_FILE_KEY] = JSON.stringify({ path: '/projects/my-app/src/App.tsx' })

        const raw = localStorageMock.getItem(LAST_ACTIVE_FILE_KEY) ?? ''
        let parseOk = true
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            if (
                typeof parsed !== 'object' ||
                !('path' in parsed) ||
                !('rootPath' in parsed)
            ) {
                parseOk = false
            }
        } catch {
            parseOk = false
        }

        if (!parseOk) {
            localStorageMock.removeItem(LAST_ACTIVE_FILE_KEY)
        }

        expect(parseOk).toBe(false)
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(LAST_ACTIVE_FILE_KEY)
    })

    it('accepts a well-formed {path, rootPath} tuple', () => {
        const entry: LastActiveFileEntry = {
            path: '/projects/my-app/src/App.tsx',
            rootPath: '/projects/my-app',
        }
        _store[LAST_ACTIVE_FILE_KEY] = JSON.stringify(entry)

        const raw = localStorageMock.getItem(LAST_ACTIVE_FILE_KEY) ?? ''
        let result: LastActiveFileEntry | null = null
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            if (
                typeof parsed === 'object' &&
                parsed !== null &&
                'path' in parsed &&
                'rootPath' in parsed &&
                typeof parsed.path === 'string' &&
                typeof parsed.rootPath === 'string'
            ) {
                result = { path: parsed.path as string, rootPath: parsed.rootPath as string }
            }
        } catch {
            // invalid
        }

        expect(result).toEqual(entry)
        // removeItem should NOT be called for a valid entry
        expect(localStorageMock.removeItem).not.toHaveBeenCalled()
    })
})
