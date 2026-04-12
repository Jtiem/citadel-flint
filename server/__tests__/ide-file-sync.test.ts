/**
 * server/__tests__/ide-file-sync.test.ts
 *
 * Unit tests for the IDE→Glass file sync stat-poll tick function.
 *
 * System under test: `ideFileSyncTick` imported from `server/ideFileSyncTick.ts`.
 * That is the same function used by `server/index.ts` — no separate
 * re-implementation lives in this file.
 *
 * Coverage:
 *   IDE-01 — Does not broadcast when ide-active-file.json does not exist
 *   IDE-02 — Broadcasts on first tick when the file already exists (mtime > 0, lastMtime=0)
 *   IDE-03 — Broadcasts when mtime advances and path is valid
 *   IDE-04 — Does not re-broadcast when mtime is the same (file unchanged)
 *   IDE-05 — Does not broadcast when parsed path escapes the project root
 *   IDE-06 — Does not broadcast when parsed path has a disallowed extension (.py)
 *   IDE-07 — Does not re-broadcast the same file on consecutive mtime changes
 *   IDE-08 — Does not broadcast when JSON has no "path" field
 *   IDE-09 — Accepts .ts and .jsx extensions in addition to .tsx
 *   IDE-10 — Does not broadcast when activeProjectRoot is empty (graceful no-op)
 *   IDE-11 — Does not broadcast when JSON is malformed (parse error — no crash)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { ideFileSyncTick, type IDEFileSyncState } from '../ideFileSyncTick.js'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const HOME = os.homedir()
const PROJECT_ROOT = path.join(HOME, 'test-project')
const VALID_FILE = path.join(PROJECT_ROOT, 'src', 'App.tsx')
const OUTSIDE_FILE = path.join(HOME, 'other-project', 'src', 'App.tsx')
const IDE_JSON_PATH = path.join(PROJECT_ROOT, '.flint', 'ide-active-file.json')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ideFileSyncTick (real function from server/ideFileSyncTick.ts)', () => {
  let state: IDEFileSyncState
  let broadcastFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    state = { lastMtime: 0, lastPath: '' }
    broadcastFn = vi.fn()
  })

  it('IDE-01 — does not broadcast when ide-active-file.json does not exist', async () => {
    const statFn = vi.fn().mockRejectedValue(new Error('ENOENT: no such file or directory'))
    const readFileFn = vi.fn()

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).not.toHaveBeenCalled()
    expect(statFn).toHaveBeenCalledWith(IDE_JSON_PATH)
    expect(readFileFn).not.toHaveBeenCalled()
  })

  it('IDE-02 — broadcasts on first tick when the file already exists (mtime > lastMtime=0)', async () => {
    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn = vi.fn().mockResolvedValue(JSON.stringify({ path: VALID_FILE, ts: Date.now() }))

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).toHaveBeenCalledOnce()
    expect(broadcastFn).toHaveBeenCalledWith('flint:ide-file-selected', { path: VALID_FILE })
    expect(state.lastMtime).toBe(1000)
    expect(state.lastPath).toBe(VALID_FILE)
  })

  it('IDE-03 — broadcasts when mtime advances and path is valid', async () => {
    state.lastMtime = 500
    state.lastPath = ''

    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn = vi.fn().mockResolvedValue(JSON.stringify({ path: VALID_FILE, ts: Date.now() }))

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).toHaveBeenCalledOnce()
    expect(broadcastFn).toHaveBeenCalledWith('flint:ide-file-selected', { path: VALID_FILE })
    expect(state.lastMtime).toBe(1000)
    expect(state.lastPath).toBe(VALID_FILE)
  })

  it('IDE-04 — does not broadcast when mtime is the same (file unchanged)', async () => {
    state.lastMtime = 1000
    state.lastPath = VALID_FILE

    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn = vi.fn()

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).not.toHaveBeenCalled()
    // readFile must not be called when mtime has not changed
    expect(readFileFn).not.toHaveBeenCalled()
  })

  it('IDE-05 — does not broadcast when parsed path escapes the project root', async () => {
    state.lastMtime = 500

    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn = vi.fn().mockResolvedValue(JSON.stringify({ path: OUTSIDE_FILE }))

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).not.toHaveBeenCalled()
    // mtime is still updated so we don't re-read the same bad payload
    expect(state.lastMtime).toBe(1000)
    expect(state.lastPath).toBe('')
  })

  it('IDE-06 — does not broadcast when parsed path has a disallowed extension (.py)', async () => {
    state.lastMtime = 500

    const disallowedFile = path.join(PROJECT_ROOT, 'src', 'main.py')
    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn = vi.fn().mockResolvedValue(JSON.stringify({ path: disallowedFile }))

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).not.toHaveBeenCalled()
    expect(state.lastMtime).toBe(1000)
  })

  it('IDE-07 — does not re-broadcast the same file path on consecutive mtime changes', async () => {
    state.lastMtime = 500
    state.lastPath = VALID_FILE

    // mtime advances (file was touched) but path is the same
    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1500 })
    const readFileFn = vi.fn().mockResolvedValue(JSON.stringify({ path: VALID_FILE }))

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).not.toHaveBeenCalled()
    // State is still updated — mtime advances, path stays the same
    expect(state.lastMtime).toBe(1500)
    expect(state.lastPath).toBe(VALID_FILE)
  })

  it('IDE-08 — does not broadcast when JSON has no "path" field', async () => {
    state.lastMtime = 500

    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn = vi.fn().mockResolvedValue(JSON.stringify({ file: VALID_FILE }))

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).not.toHaveBeenCalled()
    expect(state.lastMtime).toBe(1000)
  })

  it('IDE-09 — accepts .ts and .jsx extensions in addition to .tsx', async () => {
    const tsFile = path.join(PROJECT_ROOT, 'src', 'utils.ts')
    const jsxFile = path.join(PROJECT_ROOT, 'src', 'Button.jsx')

    for (const file of [tsFile, jsxFile]) {
      const localState: IDEFileSyncState = { lastMtime: 0, lastPath: '' }
      const localBroadcast = vi.fn()
      const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
      const readFileFn = vi.fn().mockResolvedValue(JSON.stringify({ path: file, ts: Date.now() }))

      await ideFileSyncTick({
        activeProjectRoot: PROJECT_ROOT,
        state: localState,
        statFn,
        readFileFn,
        broadcastFn: localBroadcast,
      })

      expect(localBroadcast).toHaveBeenCalledOnce()
      expect(localBroadcast).toHaveBeenCalledWith('flint:ide-file-selected', { path: file })
    }
  })

  it('IDE-10 — does not broadcast and does not throw when activeProjectRoot is empty', async () => {
    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn = vi.fn().mockResolvedValue(JSON.stringify({ path: VALID_FILE }))

    // Must not throw
    await expect(
      ideFileSyncTick({ activeProjectRoot: '', state, statFn, readFileFn, broadcastFn }),
    ).resolves.toBeUndefined()

    expect(broadcastFn).not.toHaveBeenCalled()
    // stat must not have been called (early return before building the path)
    expect(statFn).not.toHaveBeenCalled()
  })

  it('IDE-11 — does not crash and does not broadcast when JSON is malformed', async () => {
    state.lastMtime = 500

    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn = vi.fn().mockResolvedValue('{ "path": INVALID JSON !!!')

    // Must not throw
    await expect(
      ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn }),
    ).resolves.toBeUndefined()

    expect(broadcastFn).not.toHaveBeenCalled()
  })
})
