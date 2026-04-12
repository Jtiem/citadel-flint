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
 *   IDE-07 — Does not re-broadcast the same file on consecutive mtime changes (non-explicit)
 *   IDE-08 — Does not broadcast when JSON has no "path" field
 *   IDE-09 — Accepts .ts and .jsx extensions in addition to .tsx
 *   IDE-10 — Does not broadcast when activeProjectRoot is empty (graceful no-op)
 *   IDE-11 — Does not crash and does not broadcast when JSON is malformed (parse error — no crash)
 *   IDE-12 — Broadcasts explicit=true payload when extension sets explicit flag
 *   IDE-13 — Explicit flag bypasses lastPath dedup — same file re-broadcasts
 *   IDE-14 — Explicit flag does NOT bypass age guard (stale payload still rejected)
 *   IDE-15 — Second broadcast with a different file path always reaches client (regression)
 *   IDE-16 — Third click on same file (explicit) always broadcasts after different file
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
const VALID_FILE_B = path.join(PROJECT_ROOT, 'src', 'Button.tsx')
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
    expect(broadcastFn).toHaveBeenCalledWith('flint:ide-file-selected', { path: VALID_FILE, explicit: false })
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
    expect(broadcastFn).toHaveBeenCalledWith('flint:ide-file-selected', { path: VALID_FILE, explicit: false })
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

  it('IDE-07 — does not re-broadcast the same file path on consecutive mtime changes (non-explicit)', async () => {
    state.lastMtime = 500
    state.lastPath = VALID_FILE

    // mtime advances (file was touched) but path is the same and NOT explicit
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
      expect(localBroadcast).toHaveBeenCalledWith('flint:ide-file-selected', { path: file, explicit: false })
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

  // ── New tests for explicit flag and sequential broadcast regression ────────

  it('IDE-12 — broadcasts explicit:true payload when extension sets explicit flag', async () => {
    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn = vi.fn().mockResolvedValue(
      JSON.stringify({ path: VALID_FILE, ts: Date.now(), explicit: true }),
    )

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).toHaveBeenCalledOnce()
    expect(broadcastFn).toHaveBeenCalledWith('flint:ide-file-selected', { path: VALID_FILE, explicit: true })
  })

  it('IDE-13 — explicit flag bypasses lastPath dedup — same file re-broadcasts', async () => {
    // Simulate: file A was already the lastPath (e.g., loaded after first click)
    state.lastMtime = 500
    state.lastPath = VALID_FILE

    // User clicks "Open in Flint Glass" again on the same file with explicit=true
    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1500 })
    const readFileFn = vi.fn().mockResolvedValue(
      JSON.stringify({ path: VALID_FILE, ts: Date.now(), explicit: true }),
    )

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    // Must broadcast even though filePath === lastPath
    expect(broadcastFn).toHaveBeenCalledOnce()
    expect(broadcastFn).toHaveBeenCalledWith('flint:ide-file-selected', { path: VALID_FILE, explicit: true })
    expect(state.lastPath).toBe(VALID_FILE)
    expect(state.lastMtime).toBe(1500)
  })

  it('IDE-14 — explicit flag does NOT bypass age guard (stale payload still rejected)', async () => {
    state.lastMtime = 500

    const staleTs = Date.now() - 60_000 // 60 seconds ago — well past 30s limit
    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 1500 })
    const readFileFn = vi.fn().mockResolvedValue(
      JSON.stringify({ path: VALID_FILE, ts: staleTs, explicit: true }),
    )

    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    // Age guard must still fire even with explicit=true
    expect(broadcastFn).not.toHaveBeenCalled()
    expect(state.lastMtime).toBe(1500) // mtime updated regardless
  })

  it('IDE-15 — second broadcast with a different file path always reaches client (regression)', async () => {
    // Simulate the original bug: click file A (loads), then click file B (should also load)
    // Step 1: first click — file A
    state.lastMtime = 0
    state.lastPath = ''
    const statFn1 = vi.fn().mockResolvedValue({ mtimeMs: 1000 })
    const readFileFn1 = vi.fn().mockResolvedValue(
      JSON.stringify({ path: VALID_FILE, ts: Date.now(), explicit: true }),
    )
    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn: statFn1, readFileFn: readFileFn1, broadcastFn })

    expect(broadcastFn).toHaveBeenCalledTimes(1)
    expect(broadcastFn).toHaveBeenNthCalledWith(1, 'flint:ide-file-selected', { path: VALID_FILE, explicit: true })
    expect(state.lastPath).toBe(VALID_FILE)

    // Step 2: second click — file B (different file, mtime advances)
    const statFn2 = vi.fn().mockResolvedValue({ mtimeMs: 2000 })
    const readFileFn2 = vi.fn().mockResolvedValue(
      JSON.stringify({ path: VALID_FILE_B, ts: Date.now(), explicit: true }),
    )
    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn: statFn2, readFileFn: readFileFn2, broadcastFn })

    expect(broadcastFn).toHaveBeenCalledTimes(2)
    expect(broadcastFn).toHaveBeenNthCalledWith(2, 'flint:ide-file-selected', { path: VALID_FILE_B, explicit: true })
    expect(state.lastPath).toBe(VALID_FILE_B)
  })

  it('IDE-16 — third click on same original file (explicit) broadcasts after a different file', async () => {
    // File A → File B → File A again (explicit). The third click must not be
    // blocked by the lastPath dedup even though lastPath === VALID_FILE_B ≠ VALID_FILE.
    // (Different file, so lastPath dedup does NOT apply anyway — this is a
    // correctness confirmation test for the sequence: A→B→A.)

    // Seed state: File B was last broadcast
    state.lastMtime = 2000
    state.lastPath = VALID_FILE_B

    const statFn = vi.fn().mockResolvedValue({ mtimeMs: 3000 })
    const readFileFn = vi.fn().mockResolvedValue(
      JSON.stringify({ path: VALID_FILE, ts: Date.now(), explicit: true }),
    )
    await ideFileSyncTick({ activeProjectRoot: PROJECT_ROOT, state, statFn, readFileFn, broadcastFn })

    expect(broadcastFn).toHaveBeenCalledOnce()
    expect(broadcastFn).toHaveBeenCalledWith('flint:ide-file-selected', { path: VALID_FILE, explicit: true })
    expect(state.lastPath).toBe(VALID_FILE)
    expect(state.lastMtime).toBe(3000)
  })
})
