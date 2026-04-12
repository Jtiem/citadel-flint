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
 *   - path equals lastPath (duplicate)                           → skip
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

  try {
    const { mtimeMs } = await statFn(ideJsonPath)
    if (mtimeMs > state.lastMtime) {
      state.lastMtime = mtimeMs
      const raw = await readFileFn(ideJsonPath)
      const parsed = JSON.parse(raw) as { path?: string; ts?: number }
      const filePath = parsed.path
      // Ignore entries older than 30 seconds — prevents stale files from
      // previous sessions from triggering sync on server restart.
      const age = parsed.ts ? Date.now() - parsed.ts : Infinity
      if (
        typeof filePath === 'string' &&
        path.isAbsolute(filePath) &&
        filePath.startsWith(activeProjectRoot + path.sep) &&
        /\.(tsx?|jsx?)$/.test(filePath) &&
        filePath !== state.lastPath &&
        age < 30_000
      ) {
        state.lastPath = filePath
        console.log('[IDESync] broadcasting path:', filePath)
        broadcastFn('flint:ide-file-selected', { path: filePath })
      }
    }
  } catch {
    // file doesn't exist yet — normal until first IDE focus change
  }
}
