/**
 * server/ideFileSyncTick.ts
 *
 * Pure tick function for the IDE→Glass file sync stat-poll loop (IDE.2).
 *
 * Extracted from the server/index.ts closure so the logic is unit-testable
 * without spinning up the full Express server. Both server/index.ts and the
 * test suite import this function — there is no separate re-implementation.
 *
 * The VS Code extension writes `.flint/ide-active-file.json` on every editor
 * focus change. One tick checks whether that file's mtime has advanced,
 * reads the new path, validates it, and calls broadcastFn if all guards pass.
 *
 * "explicit" field:
 *   The extension sets `explicit: true` when the user deliberately invokes
 *   "Open in Flint Glass" (as opposed to passive auto-follow on editor focus).
 *   When explicit=true, the `lastPath` dedup guard is bypassed so Glass always
 *   receives the broadcast — even if the same file is already loaded.
 *   Glass uses this flag to auto-load directly instead of showing an
 *   acceptance toast.
 */

import path from 'node:path'

export interface IDEFileSyncState {
  lastMtime: number
  lastPath: string
}

export interface StatResult {
  mtimeMs: number
}

export interface IDEFileSyncTickOptions {
  /** Absolute path to the project root (no trailing sep) */
  activeProjectRoot: string
  /** Mutable state shared across ticks — mutated in place */
  state: IDEFileSyncState
  /**
   * Async stat function — must throw (ENOENT-style) when the file does not
   * exist. Matches the signature of `import('node:fs/promises').stat`.
   */
  statFn: (p: string) => Promise<StatResult>
  /**
   * Async file-read function — called only when mtime has advanced.
   * Matches the signature of `import('node:fs/promises').readFile(p, 'utf-8')`.
   */
  readFileFn: (p: string) => Promise<string>
  /** Called when a valid new file path is detected */
  broadcastFn: (channel: string, data: unknown) => void
  /**
   * The name of the sub-directory inside the project root that holds
   * `ide-active-file.json` — defaults to `.flint`.
   */
  configDir?: string
}

/**
 * One tick of the IDE file sync interval.
 *
 * Mutates `opts.state.lastMtime` and `opts.state.lastPath` as a side-effect
 * so consecutive ticks can detect changes correctly.
 *
 * Guards (none of these must be triggered for a broadcast to occur):
 *   - ide-active-file.json does not exist (stat throws)         → silent skip
 *   - mtime has not advanced since last tick                     → skip
 *   - parsed JSON has no "path" field                           → skip
 *   - path is not absolute                                       → skip
 *   - path does not start with activeProjectRoot + sep           → skip
 *   - path extension is not .tsx / .ts / .jsx / .js             → skip
 *   - path equals lastPath AND explicit is not true (duplicate)  → skip
 *   - age >= 30s (stale file from previous session)              → skip
 *
 * Note: when `parsed.explicit === true` the lastPath dedup guard is bypassed
 * so that an intentional "Open in Flint Glass" command always reaches Glass
 * regardless of whether the same file was previously broadcast.
 */
export async function ideFileSyncTick(opts: IDEFileSyncTickOptions): Promise<void> {
  const {
    activeProjectRoot,
    state,
    statFn,
    readFileFn,
    broadcastFn,
    configDir = '.flint',
  } = opts

  if (!activeProjectRoot) return

  const ideJsonPath = path.join(activeProjectRoot, configDir, 'ide-active-file.json')
  const debugEnabled = process.env['FLINT_DEBUG_IDE_SYNC'] === '1'

  try {
    const { mtimeMs } = await statFn(ideJsonPath)
    if (debugEnabled) {
      console.log(`[IDE-SYNC-DEBUG] tick — mtimeMs=${mtimeMs} lastMtime=${state.lastMtime} lastPath=${state.lastPath || '(none)'}`)
    }
    if (mtimeMs > state.lastMtime) {
      state.lastMtime = mtimeMs
      const raw = await readFileFn(ideJsonPath)
      let parsed: { path?: string; ts?: number; explicit?: boolean }
      try {
        parsed = JSON.parse(raw) as { path?: string; ts?: number; explicit?: boolean }
      } catch {
        if (debugEnabled) console.log('[IDE-SYNC-DEBUG] tick — JSON parse error, skipping')
        return
      }
      const filePath = parsed.path
      const isExplicit = parsed.explicit === true
      // Ignore entries older than 30 seconds — prevents stale files from
      // previous sessions from triggering sync on server restart.
      const age = parsed.ts ? Date.now() - parsed.ts : Infinity

      if (debugEnabled) {
        console.log(`[IDE-SYNC-DEBUG] tick — parsed path=${filePath ?? '(none)'} explicit=${isExplicit} age=${age}ms lastPath=${state.lastPath || '(none)'}`)
        if (!filePath) console.log('[IDE-SYNC-DEBUG] tick SKIP — no path field in JSON')
        else if (!path.isAbsolute(filePath)) console.log('[IDE-SYNC-DEBUG] tick SKIP — path not absolute')
        else if (!filePath.startsWith(activeProjectRoot + path.sep)) console.log(`[IDE-SYNC-DEBUG] tick SKIP — path escapes root (root=${activeProjectRoot})`)
        else if (!/\.(tsx?|jsx?)$/.test(filePath)) console.log('[IDE-SYNC-DEBUG] tick SKIP — disallowed extension')
        else if (!isExplicit && filePath === state.lastPath) console.log('[IDE-SYNC-DEBUG] tick SKIP — same as lastPath, not explicit (dedup)')
        else if (age >= 30_000) console.log(`[IDE-SYNC-DEBUG] tick SKIP — age too old (${age}ms)`)
      }

      if (
        typeof filePath === 'string' &&
        path.isAbsolute(filePath) &&
        filePath.startsWith(activeProjectRoot + path.sep) &&
        /\.(tsx?|jsx?)$/.test(filePath) &&
        // Bypass lastPath dedup for explicit commands — always broadcast.
        // Auto-follow (implicit) still deduplicates to prevent spamming Glass
        // when the IDE editor focus changes without the user requesting sync.
        (isExplicit || filePath !== state.lastPath) &&
        age < 30_000
      ) {
        state.lastPath = filePath
        console.log('[IDESync] broadcasting path:', filePath, isExplicit ? '(explicit)' : '')
        broadcastFn('flint:ide-file-selected', { path: filePath, explicit: isExplicit })
      }
    } else if (debugEnabled) {
      console.log('[IDE-SYNC-DEBUG] tick SKIP — mtime unchanged')
    }
  } catch {
    // file doesn't exist yet — normal until first IDE focus change
    if (debugEnabled) console.log('[IDE-SYNC-DEBUG] tick — stat failed (file missing or unreadable)')
  }
}
