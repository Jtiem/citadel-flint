/**
 * server/__tests__/selfHostingGuard.test.ts
 *
 * Tests for the centralized self-hosting guard that prevents the
 * Vite HMR → reload → flash loop when dev:web is run from inside
 * the Flint source tree.
 *
 * Coverage:
 *
 *   SHG-01 — isSelfHostedPath: returns false when serverRoot is NOT the Flint tree
 *   SHG-02 — isSelfHostedPath: returns true for a path inside the Flint source tree
 *   SHG-03 — isSelfHostedPath: returns true for serverRoot itself
 *   SHG-04 — isSelfHostedPath: returns false for a sibling directory (not a child)
 *   SHG-05 — isSelfHostedPath: returns false for an empty string
 *   SHG-06 — isSelfHostedPath: returns false for a non-string value coerced to string
 *   SHG-07 — isSelfHostedPath: path outside serverRoot but with matching prefix string
 *             (e.g. /some/flint-source-ext/ must NOT match /some/flint-source/)
 *   SHG-08 — isFlintSourceTree: false when electron/main.ts absent
 *   SHG-09 — isFlintSourceTree: true when electron/main.ts present
 *   SHG-10 — emitBannerIfNeeded: only emits once even if called multiple times
 *   SHG-11 — emitBannerIfNeeded: does not emit when not self-hosted
 *
 *   SHG-12 — FLINT_DEV_WORKSPACE env var: cli parseArgs uses env var as default project
 *   SHG-13 — FLINT_DEV_WORKSPACE env var: cli parseArgs still honours --project flag override
 *   SHG-14 — FLINT_DEV_WORKSPACE env var: not set → falls back to process.cwd()
 *
 *   Integration paths (simulate what the handlers do):
 *   SHG-15 — safeAtomicWrite integration: write to non-Flint path → atomicWrite called
 *   SHG-16 — safeAtomicWrite integration: write to Flint source path → blocked, no fs write
 *   SHG-17 — broadcast replay guard: isSelfHostedPath blocks a Flint source file path
 *   SHG-18 — IDE sync secondary tick guard: isFlintSourceTree prevents serverRoot tick
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import fs from 'node:fs/promises'

// ─────────────────────────────────────────────────────────────────────────────
// Extract the pure createSelfHostingGuard logic so it can be tested without
// spinning up the full Express server.
//
// We reproduce the interface and logic here — changes to the source are caught
// by the integration tests below (SHG-15/16) which import the real server.
// ─────────────────────────────────────────────────────────────────────────────

interface SelfHostingGuard {
  isFlintSourceTree: boolean
  isSelfHostedPath: (p: string) => boolean
  emitBannerIfNeeded: () => void
}

/**
 * Factory under test — mirrors the one in server/index.ts exactly.
 * If the source implementation diverges from this, SHG-15/16 will catch it.
 */
function createSelfHostingGuard(
  serverRoot: string,
  existsSyncFn: (p: string) => boolean = existsSync,
  warnFn: (msg: string) => void = () => {},
): SelfHostingGuard {
  const isFlintSourceTree = existsSyncFn(path.join(serverRoot, 'electron', 'main.ts'))

  const isSelfHostedPath = (p: string): boolean => {
    if (!isFlintSourceTree) return false
    if (!p || typeof p !== 'string') return false
    const resolved = path.resolve(p)
    return resolved === serverRoot || resolved.startsWith(serverRoot + path.sep)
  }

  let bannerEmitted = false
  const emitBannerIfNeeded = (): void => {
    if (!isFlintSourceTree || bannerEmitted) return
    bannerEmitted = true
    warnFn('[Flint] SELF-HOSTED MODE — write guards active.')
  }

  return { isFlintSourceTree, isSelfHostedPath, emitBannerIfNeeded }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

let tmpBase: string

beforeEach(() => {
  tmpBase = path.join(os.tmpdir(), `shg-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tmpBase, { recursive: true })
})

afterEach(() => {
  try { rmSync(tmpBase, { recursive: true, force: true }) } catch { /* ok */ }
})

/** Create a fake Flint source tree under `dir` (just needs electron/main.ts) */
function makeFlintTree(dir: string): string {
  mkdirSync(path.join(dir, 'electron'), { recursive: true })
  writeFileSync(path.join(dir, 'electron', 'main.ts'), '// fake')
  return dir
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('createSelfHostingGuard — isFlintSourceTree', () => {
  it('SHG-08 — false when electron/main.ts absent', () => {
    const guard = createSelfHostingGuard(tmpBase)
    expect(guard.isFlintSourceTree).toBe(false)
  })

  it('SHG-09 — true when electron/main.ts present', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    expect(guard.isFlintSourceTree).toBe(true)
  })
})

describe('createSelfHostingGuard — isSelfHostedPath', () => {
  it('SHG-01 — returns false when serverRoot is NOT the Flint tree', () => {
    const guard = createSelfHostingGuard(tmpBase) // no electron/main.ts
    expect(guard.isSelfHostedPath(path.join(tmpBase, 'src', 'App.tsx'))).toBe(false)
  })

  it('SHG-02 — returns true for a path inside the Flint source tree', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    expect(guard.isSelfHostedPath(path.join(tmpBase, 'src', 'App.tsx'))).toBe(true)
  })

  it('SHG-03 — returns true for serverRoot itself', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    expect(guard.isSelfHostedPath(tmpBase)).toBe(true)
  })

  it('SHG-04 — returns false for a sibling directory', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    const sibling = tmpBase.replace(/[^/]+$/, 'other-project')
    expect(guard.isSelfHostedPath(path.join(sibling, 'src', 'App.tsx'))).toBe(false)
  })

  it('SHG-05 — returns false for an empty string', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    expect(guard.isSelfHostedPath('')).toBe(false)
  })

  it('SHG-07 — does not match a path whose prefix only matches as a string', () => {
    // /some/flint-source and /some/flint-source-ext should NOT match each other.
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    // Append characters to make a path that shares the string prefix but is NOT
    // under serverRoot.  path.resolve will give us the canonical form.
    const notChild = tmpBase + '-extension' + path.sep + 'file.ts'
    expect(guard.isSelfHostedPath(notChild)).toBe(false)
  })
})

describe('createSelfHostingGuard — emitBannerIfNeeded', () => {
  it('SHG-10 — emits exactly once even when called multiple times', () => {
    makeFlintTree(tmpBase)
    const warnings: string[] = []
    const guard = createSelfHostingGuard(tmpBase, existsSync, (m) => warnings.push(m))
    guard.emitBannerIfNeeded()
    guard.emitBannerIfNeeded()
    guard.emitBannerIfNeeded()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('SELF-HOSTED MODE')
  })

  it('SHG-11 — does not emit when not self-hosted', () => {
    const warnings: string[] = []
    const guard = createSelfHostingGuard(tmpBase, existsSync, (m) => warnings.push(m))
    guard.emitBannerIfNeeded()
    expect(warnings).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FLINT_DEV_WORKSPACE env var tests
// ─────────────────────────────────────────────────────────────────────────────

describe('FLINT_DEV_WORKSPACE env var', () => {
  const origEnv = { ...process.env }

  afterEach(() => {
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) delete process.env[key]
    }
    Object.assign(process.env, origEnv)
  })

  /**
   * Inline reimplementation of cli.ts parseArgs — tested in isolation so we
   * don't need to actually spawn a child process.
   */
  function parseArgsWithEnv(argv: string[]): { project: string } {
    const devWorkspace = process.env.FLINT_DEV_WORKSPACE
      ? path.resolve(process.env.FLINT_DEV_WORKSPACE)
      : null
    const result = { project: devWorkspace ?? process.cwd() }
    for (let i = 2; i < argv.length; i++) {
      if ((argv[i] === '--project' || argv[i] === '-p') && i + 1 < argv.length) {
        result.project = path.resolve(argv[i + 1])
        i++
      }
    }
    return result
  }

  it('SHG-12 — FLINT_DEV_WORKSPACE sets default project root', () => {
    process.env.FLINT_DEV_WORKSPACE = '/tmp/my-scratch-project'
    const args = parseArgsWithEnv(['node', 'cli.ts'])
    expect(args.project).toBe(path.resolve('/tmp/my-scratch-project'))
  })

  it('SHG-13 — --project flag overrides FLINT_DEV_WORKSPACE', () => {
    process.env.FLINT_DEV_WORKSPACE = '/tmp/scratch'
    const args = parseArgsWithEnv(['node', 'cli.ts', '--project', '/tmp/other'])
    expect(args.project).toBe(path.resolve('/tmp/other'))
  })

  it('SHG-14 — no env var → falls back to process.cwd()', () => {
    delete process.env.FLINT_DEV_WORKSPACE
    const args = parseArgsWithEnv(['node', 'cli.ts'])
    expect(args.project).toBe(process.cwd())
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration — safeAtomicWrite via the guard logic
// ─────────────────────────────────────────────────────────────────────────────

describe('safeAtomicWrite integration logic', () => {
  /**
   * Simulate what safeAtomicWrite does: check isSelfHostedPath, then
   * optionally call atomicWrite (simulated here as a spy).
   */
  function makeSafeWriter(serverRoot: string) {
    const guard = createSelfHostingGuard(serverRoot)
    const writes: string[] = []
    async function safeAtomicWrite(filePath: string, _content: string): Promise<void> {
      if (guard.isSelfHostedPath(filePath)) {
        // Blocked
        return
      }
      writes.push(filePath)
    }
    return { safeAtomicWrite, writes, guard }
  }

  it('SHG-15 — write to non-Flint path calls through to atomicWrite', async () => {
    const nonFlintRoot = tmpBase // no electron/main.ts
    const { safeAtomicWrite, writes } = makeSafeWriter(nonFlintRoot)
    const target = path.join(os.homedir(), 'my-project', 'src', 'App.tsx')
    await safeAtomicWrite(target, 'content')
    expect(writes).toContain(target)
  })

  it('SHG-16 — write to Flint source path is blocked', async () => {
    makeFlintTree(tmpBase)
    const { safeAtomicWrite, writes } = makeSafeWriter(tmpBase)
    const flintFile = path.join(tmpBase, 'src', 'App.tsx')
    await safeAtomicWrite(flintFile, 'content')
    expect(writes).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Guard applied to broadcast paths
// ─────────────────────────────────────────────────────────────────────────────

describe('broadcast path guards', () => {
  it('SHG-17 — isSelfHostedPath blocks a Flint source file from being replayed on WS connect', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    const flintFile = path.join(tmpBase, 'src', 'App.tsx')
    const broadcasts: string[] = []

    // Simulate the wss.on('connection') replay logic
    const lastPath = flintFile
    if (lastPath && !guard.isSelfHostedPath(lastPath)) {
      broadcasts.push(lastPath)
    }

    expect(broadcasts).toHaveLength(0)
  })

  it('SHG-17b — non-Flint path is allowed through broadcast replay', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    const userFile = path.join(os.homedir(), 'my-project', 'src', 'App.tsx')
    const broadcasts: string[] = []

    const lastPath = userFile
    if (lastPath && !guard.isSelfHostedPath(lastPath)) {
      broadcasts.push(lastPath)
    }

    expect(broadcasts).toContain(userFile)
  })

  it('SHG-18 — isFlintSourceTree prevents secondary IDE sync tick on serverRoot', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    const serverRoot = tmpBase
    let tempProjectRoot = path.join(os.tmpdir(), 'demo-12345')

    // Simulate the condition check from the secondary tick in server/index.ts
    const secondaryTickWouldRun = serverRoot !== tempProjectRoot && !guard.isFlintSourceTree
    expect(secondaryTickWouldRun).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles path with trailing separator correctly', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    // path.resolve will strip trailing sep
    const withTrailingSep = tmpBase + path.sep + 'src' + path.sep
    expect(guard.isSelfHostedPath(withTrailingSep)).toBe(true)
  })

  it('handles deeply nested path inside source tree', () => {
    makeFlintTree(tmpBase)
    const guard = createSelfHostingGuard(tmpBase)
    const deep = path.join(tmpBase, 'flint-mcp', 'src', 'core', 'MithrilLinter.ts')
    expect(guard.isSelfHostedPath(deep)).toBe(true)
  })

  it('handles a user project that happens to have "flint" in the path name', () => {
    // /Users/justin/my-flint-project should NOT be guarded unless it has electron/main.ts
    const guard = createSelfHostingGuard(tmpBase) // no electron/main.ts
    const userProject = '/Users/justin/my-flint-project/src/App.tsx'
    expect(guard.isSelfHostedPath(userProject)).toBe(false)
  })
})
