/**
 * validateFilePath.test.ts
 *
 * Tests for shared/validateFilePath.ts — the hoisted, shared file-path
 * validation function used by both electron/main.ts and server/index.ts.
 *
 * Covers:
 *   VFP-01: non-string input throws FilePathValidationError
 *   VFP-02: relative path throws FilePathValidationError
 *   VFP-03: disallowed extension throws FilePathValidationError
 *   VFP-04: valid path within homeDir is accepted and returns resolved path
 *   VFP-05: empty allowedExtensions skips extension check
 *   VFP-06: path traversal (/../) is collapsed by path.resolve and still rejected
 *            when the resolved path lands outside homeDir
 *   VFP-07: selfHostCheck callback is called with the resolved path
 *   VFP-08: selfHostCheck that throws causes validateFilePath to throw
 *   VFP-09: symlink — realpathSync fallback: file that does not exist uses
 *            logical resolved path for home-scope check (write path)
 *   VFP-10: homeDir boundary — path equal to homeDir itself is rejected
 *            (files must be inside home, not the home dir itself)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import path from 'node:path'
import { validateFilePath, FilePathValidationError } from '../validateFilePath'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const HOME = '/Users/testuser'
const VALID_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']
const VALID_FILE = '/Users/testuser/projects/my-app/src/App.tsx'

function opts(overrides: Partial<Parameters<typeof validateFilePath>[0]> = {}) {
  return {
    filePath: VALID_FILE,
    homeDir: HOME,
    allowedExtensions: VALID_EXTENSIONS,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ── VFP-01 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: non-string input (VFP-01)', () => {
  it('throws FilePathValidationError for null', () => {
    expect(() => validateFilePath(opts({ filePath: null }))).toThrow(FilePathValidationError)
  })

  it('throws FilePathValidationError for undefined', () => {
    expect(() => validateFilePath(opts({ filePath: undefined }))).toThrow(FilePathValidationError)
  })

  it('throws FilePathValidationError for a number', () => {
    expect(() => validateFilePath(opts({ filePath: 42 }))).toThrow(FilePathValidationError)
  })

  it('throws FilePathValidationError for an empty string', () => {
    expect(() => validateFilePath(opts({ filePath: '' }))).toThrow(FilePathValidationError)
  })
})

// ── VFP-02 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: relative path rejected (VFP-02)', () => {
  it('throws for a relative path', () => {
    expect(() => validateFilePath(opts({ filePath: 'projects/my-app/src/App.tsx' })))
      .toThrow(FilePathValidationError)
  })

  it('throws for a path starting with ./', () => {
    expect(() => validateFilePath(opts({ filePath: './App.tsx' })))
      .toThrow(FilePathValidationError)
  })
})

// ── VFP-03 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: disallowed extension (VFP-03)', () => {
  it('throws for a .py file when only source extensions are allowed', () => {
    expect(() =>
      validateFilePath(opts({ filePath: `${HOME}/projects/App.py` }))
    ).toThrow(FilePathValidationError)
  })

  it('throws for a file with no extension', () => {
    expect(() =>
      validateFilePath(opts({ filePath: `${HOME}/projects/Makefile` }))
    ).toThrow(FilePathValidationError)
  })

  it('throws for .tsx.bak double extension', () => {
    expect(() =>
      validateFilePath(opts({ filePath: `${HOME}/projects/App.tsx.bak` }))
    ).toThrow(FilePathValidationError)
  })
})

// ── VFP-04 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: valid path accepted (VFP-04)', () => {
  it('accepts a valid .tsx file inside homeDir and returns the resolved path', () => {
    const result = validateFilePath(opts())
    // path.resolve on an already-absolute path returns the same string
    expect(result).toBe(path.resolve(VALID_FILE))
  })

  it('accepts a .ts file', () => {
    const f = `${HOME}/projects/lib/utils.ts`
    expect(() => validateFilePath(opts({ filePath: f }))).not.toThrow()
  })

  it('accepts a .js file', () => {
    const f = `${HOME}/projects/lib/utils.js`
    expect(() => validateFilePath(opts({ filePath: f }))).not.toThrow()
  })
})

// ── VFP-05 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: empty allowedExtensions skips check (VFP-05)', () => {
  it('accepts a directory path when allowedExtensions is empty', () => {
    expect(() =>
      validateFilePath(opts({ filePath: `${HOME}/projects/my-app`, allowedExtensions: [] }))
    ).not.toThrow()
  })

  it('accepts a .json file when allowedExtensions is empty', () => {
    expect(() =>
      validateFilePath(opts({ filePath: `${HOME}/projects/package.json`, allowedExtensions: [] }))
    ).not.toThrow()
  })
})

// ── VFP-06 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: path traversal rejected when resolved path is outside homeDir (VFP-06)', () => {
  it('rejects a path that traverses outside homeDir via ..', () => {
    // /Users/testuser/../../etc/passwd.tsx resolves to /etc/passwd.tsx
    const traversal = `${HOME}/../../etc/passwd.tsx`
    expect(() => validateFilePath(opts({ filePath: traversal })))
      .toThrow(FilePathValidationError)
  })
})

// ── VFP-07 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: selfHostCheck callback is invoked (VFP-07)', () => {
  it('calls selfHostCheck with the resolved path', () => {
    const selfHostCheck = vi.fn()
    validateFilePath(opts({ selfHostCheck }))
    expect(selfHostCheck).toHaveBeenCalledWith(path.resolve(VALID_FILE))
  })

  it('does not call selfHostCheck when validation fails before reaching it', () => {
    const selfHostCheck = vi.fn()
    // Relative path — should throw before selfHostCheck is invoked
    expect(() =>
      validateFilePath(opts({ filePath: 'relative.tsx', selfHostCheck }))
    ).toThrow(FilePathValidationError)
    expect(selfHostCheck).not.toHaveBeenCalled()
  })
})

// ── VFP-08 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: selfHostCheck that throws blocks validation (VFP-08)', () => {
  it('propagates errors thrown by selfHostCheck', () => {
    const selfHostCheck = (resolved: string) => {
      if (resolved.includes('flint-source')) {
        throw new Error('self-hosted path rejected')
      }
    }
    const flintSourceFile = `${HOME}/flint-source/src/App.tsx`
    expect(() =>
      validateFilePath(opts({ filePath: flintSourceFile, selfHostCheck }))
    ).toThrow('self-hosted path rejected')
  })
})

// ── VFP-09 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: non-existent file falls through to logical path check (VFP-09)', () => {
  it('accepts a valid path for a file that does not yet exist on disk', () => {
    // This file doesn't exist; realpathSync will throw, we fall through to
    // the logical path check.
    const newFile = `${HOME}/projects/new-component-${Date.now()}.tsx`
    expect(() => validateFilePath(opts({ filePath: newFile }))).not.toThrow()
  })
})

// ── VFP-10 ─────────────────────────────────────────────────────────────────────

describe('validateFilePath: homeDir itself is outside the permitted scope (VFP-10)', () => {
  it('rejects a path equal to homeDir itself (files must be inside, not the dir)', () => {
    // The home dir path has no source extension — caught by extension check.
    // We disable extension check to confirm the home-scope check also blocks it.
    expect(() =>
      validateFilePath(opts({ filePath: HOME, allowedExtensions: [] }))
    ).toThrow(FilePathValidationError)
  })
})
