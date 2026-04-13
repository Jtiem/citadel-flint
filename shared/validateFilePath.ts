/**
 * validateFilePath — shared file-path validator for the Electron main process
 * and the Express web server.
 *
 * Both callers previously duplicated this logic. This module is the single
 * source of truth. It is a pure function with no side-effects; each caller
 * injects its own `homeDir`, `allowedExtensions`, and optional `selfHostCheck`
 * so the shared module stays free of process-specific globals.
 *
 * Security guarantees (in order):
 *   1. filePath must be a non-empty string.
 *   2. filePath must be an absolute path (path.isAbsolute).
 *   3. If allowedExtensions is non-empty, filePath must end with one of them.
 *   4. path.resolve the input to collapse any ".." traversal sequences.
 *   5. fs.realpathSync the resolved path to follow symlinks — prevents escape
 *      via symlink chains.  Falls through to the logical-path check when the
 *      file does not exist yet (write path).
 *   6. The real (or resolved) path must start with homeDir + path.sep — keeps
 *      all access inside the user's home directory.
 *   7. If selfHostCheck is provided, it is called with the resolved path.
 *      Throw from within it to reject the path.
 *
 * Returns the path.resolve()d canonical path (not the raw input) so downstream
 * callers always receive a clean string free of traversal sequences.
 *
 * NOTE: Windows absolute paths are out of scope for Flint (macOS / Linux only).
 */

import path from 'node:path'
import { realpathSync } from 'node:fs'

export interface ValidateFilePathOptions {
  /** Raw, untrusted input from IPC / HTTP. */
  filePath: unknown
  /** User home directory — from `app.getPath('home')` or `os.homedir()`. */
  homeDir: string
  /**
   * File extensions that are permitted (include the leading dot, e.g. '.tsx').
   * Pass an empty array to skip the extension check (e.g. for directory paths).
   */
  allowedExtensions: readonly string[]
  /**
   * Optional self-hosting guard.  Called with the resolved canonical path after
   * all other checks pass.  Throw to reject the path.
   *
   * Electron side: `if (isFlintSourceTree(path.dirname(resolved))) throw ...`
   * Server side:   `if (selfHosting.isSelfHostedPath(resolved)) throw ...`
   */
  selfHostCheck?: (resolved: string) => void
}

export class FilePathValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FilePathValidationError'
  }
}

export function validateFilePath(opts: ValidateFilePathOptions): string {
  const { filePath, homeDir, allowedExtensions, selfHostCheck } = opts

  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new FilePathValidationError('filePath must be a non-empty string')
  }

  if (!path.isAbsolute(filePath)) {
    throw new FilePathValidationError('filePath must be an absolute path')
  }

  if (allowedExtensions.length > 0) {
    const ext = path.extname(filePath).toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      throw new FilePathValidationError(
        `filePath must end with one of: ${allowedExtensions.join(', ')}`
      )
    }
  }

  // path.resolve collapses ".." traversal sequences in the logical path.
  const resolved = path.resolve(filePath)

  // realpathSync follows symlinks to give us the canonical on-disk path.
  // Falls through gracefully when the file does not yet exist (write path).
  let real = resolved
  try {
    real = realpathSync(resolved)
  } catch {
    // File does not exist yet — use the resolved logical path for scope check.
  }

  const homeSep = homeDir + path.sep
  // The path must be INSIDE the home directory — not the home directory itself.
  // Allowing the homeDir itself (`real === homeDir`) would let a caller read or
  // write the home dir as if it were a file, which is never valid.
  if (!real.startsWith(homeSep)) {
    throw new FilePathValidationError(
      'path outside user home directory is not permitted'
    )
  }

  if (selfHostCheck) {
    selfHostCheck(resolved)
  }

  // Return the resolved (pre-symlink) canonical path — not raw input.
  return resolved
}
