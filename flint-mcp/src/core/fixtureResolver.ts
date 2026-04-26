/**
 * FIXTURE.1 — Audit Context System
 *
 * resolveFixture(filePath, projectRoot) → ResolvedFixture
 *
 * Walks up the directory tree from `filePath` looking for `.flint-fixture.json`
 * (nearest-wins, like tsconfig.json resolution). Parses via the Zod schema.
 * Resolves the `tokens` path relative to the fixture file's own directory.
 *
 * Guards:
 * - Path-traversal: never escapes `projectRoot` (rejects with actionable error).
 * - Symlink-escape: uses fs.realpathSync to canonicalize before containment check.
 * - Malformed JSON: throws with file path + Zod issue path + short reason.
 * - Missing tokens file: sets resolvedTokensPath: null (caller surfaces the violation).
 * - Walk-up depth: capped at MAX_WALK_UP iterations.
 * - Cache: project-scoped; LRU-evicted at CACHE_MAX_ENTRIES.
 *
 * Error differentiation:
 * - ENOENT on fixture file → silently returns DEFAULT_FIXTURE (the expected case).
 * - Other fs errors (EACCES, EISDIR, etc.) → thrown with actionable message.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { ResolvedFixture } from '../../../shared/fixture-schema.js'
import { FlintFixtureSchema, DEFAULT_FIXTURE } from '../../../shared/fixture-schema.js'

const FIXTURE_FILENAME = '.flint-fixture.json'
const MAX_WALK_UP = 64
const CACHE_MAX_ENTRIES = 1024

// ─── Project-scoped cache ─────────────────────────────────────────────────────

/**
 * Cache keyed by `${resolvedRoot}\0${startDir}` so resolutions are project-scoped.
 * A cache hit means we already walked up from this directory (or found no fixture)
 * within this project root in the current process.
 *
 * The value is `null` when the walk-up from this directory found no fixture.
 *
 * NOTE (FIXTURE.1-CODE-003): Only the original `startDir` is cached per call.
 * We do NOT back-fill intermediate ancestor directories on the walk-up chain.
 * Consequence: a cousin-directory audit re-runs the walk-up from scratch; a
 * sibling-file audit hits the cache. This matches the swarm pre-warm path
 * (which iterates unique directories) and keeps cache invalidation trivial.
 */
const _cache = new Map<string, ResolvedFixture | null>()

function cacheKey(resolvedRoot: string, startDir: string): string {
  return `${resolvedRoot}\u0000${startDir}`
}

function cacheSet(key: string, value: ResolvedFixture | null): void {
  // Simple LRU: delete-then-set keeps Map insertion order as the order-of-use.
  if (_cache.has(key)) _cache.delete(key)
  _cache.set(key, value)
  // Evict oldest entries when over cap.
  while (_cache.size > CACHE_MAX_ENTRIES) {
    const oldest = _cache.keys().next().value
    if (oldest === undefined) break
    _cache.delete(oldest)
  }
}

/**
 * Clear the module-local cache. Must be called between test cases that write
 * fixture files to the filesystem. Without arguments, clears the entire cache.
 * With `projectRoot`, clears only entries for that project.
 */
export function clearFixtureCache(projectRoot?: string): void {
  if (!projectRoot) {
    _cache.clear()
    return
  }
  const resolvedRoot = path.resolve(projectRoot)
  const prefix = `${resolvedRoot}\u0000`
  for (const key of Array.from(_cache.keys())) {
    if (key.startsWith(prefix)) _cache.delete(key)
  }
}

// ─── Path-traversal guard ─────────────────────────────────────────────────────

/**
 * Returns true if `candidate` is at or beneath `root`.
 * Both paths must be already resolved to absolute paths.
 */
function isWithinRoot(candidate: string, root: string): boolean {
  const normalizedRoot = root.endsWith(path.sep) ? root : root + path.sep
  return candidate === root || candidate.startsWith(normalizedRoot)
}

/**
 * Canonicalize via fs.realpath to defeat symlink-escape attacks.
 * Returns null when the path doesn't exist (symlinks to missing targets
 * also surface as ENOENT).
 */
function canonicalize(absPath: string): string | null {
  try {
    return fs.realpathSync(absPath)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return null
    // Other errors (EACCES, ELOOP, etc.) — propagate so caller surfaces the issue.
    throw err
  }
}

// ─── Walk-up logic ────────────────────────────────────────────────────────────

/**
 * Walk up from `startDir` toward `projectRoot`, returning the first directory
 * that contains `.flint-fixture.json`, or `null` if none is found.
 *
 * Stops at `projectRoot` (inclusive). Never escapes it. Bounded by MAX_WALK_UP
 * iterations.
 */
function findFixtureDir(startDir: string, projectRoot: string): string | null {
  let current = startDir

  for (let i = 0; i < MAX_WALK_UP; i++) {
    if (!isWithinRoot(current, projectRoot)) {
      // We've escaped the project root — stop.
      return null
    }

    const candidate = path.join(current, FIXTURE_FILENAME)
    if (fs.existsSync(candidate)) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      // Reached filesystem root.
      return null
    }
    if (current === projectRoot) {
      // We just checked the project root; don't walk above it.
      return null
    }
    current = parent
  }

  return null
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Resolve the audit fixture context for `filePath`.
 *
 * @param filePath     Absolute path to the file being audited.
 * @param projectRoot  Absolute path to the project root (bounds the walk-up).
 * @returns            `ResolvedFixture` — always populated; falls back to
 *                     `DEFAULT_FIXTURE` when no `.flint-fixture.json` is found.
 *
 * @throws  When the fixture file contains malformed JSON or fails Zod parse.
 *          The error message names the offending file and the Zod issue path.
 * @throws  When `fixture.tokens` resolves to a path outside `projectRoot`
 *          (path-traversal guard — includes symlink-escape protection).
 * @throws  When fixture file read fails with a non-ENOENT error (EACCES, etc.).
 */
export function resolveFixture(filePath: string, projectRoot: string): ResolvedFixture {
  const resolvedFileRaw = path.resolve(filePath)
  const resolvedRootRaw = path.resolve(projectRoot)

  // Canonicalize project root via realpath so the containment check is
  // symlink-safe. If root doesn't exist, fall back to the lexical path.
  const resolvedRoot = canonicalize(resolvedRootRaw) ?? resolvedRootRaw

  // Canonicalize the file being audited too (symlinks in the path could otherwise
  // cause the walk-up to drift outside projectRoot). Falls back to lexical when
  // the file doesn't exist (common during contract tests on synthetic paths).
  const resolvedFile = canonicalize(resolvedFileRaw) ?? resolvedFileRaw
  const startDir = path.dirname(resolvedFile)

  // ── Cache check (project-scoped) ───────────────────────────────────────────
  const key = cacheKey(resolvedRoot, startDir)
  const cached = _cache.get(key)
  if (cached !== undefined) {
    // null means "we already determined no fixture in this subtree"
    return cached ?? DEFAULT_FIXTURE
  }

  // ── Walk up ────────────────────────────────────────────────────────────────
  const fixtureDir = findFixtureDir(startDir, resolvedRoot)

  if (fixtureDir === null) {
    cacheSet(key, null)
    return DEFAULT_FIXTURE
  }

  const fixturePath = path.join(fixtureDir, FIXTURE_FILENAME)

  // Canonicalize the fixture file itself to defeat symlink-escape attacks where
  // the fixture file is a symlink pointing outside projectRoot.
  const canonicalFixturePath = canonicalize(fixturePath) ?? fixturePath
  if (!isWithinRoot(canonicalFixturePath, resolvedRoot)) {
    // Redact the resolved canonical target from the error to avoid leaking
    // filesystem layout outside projectRoot. Only echo the user-facing path.
    throw new Error(
      `[fixtureResolver] Symlink escape blocked: ${fixturePath} resolves outside the project root. ` +
        `Fix the fixture file location.`,
    )
  }

  // ── Read + parse ───────────────────────────────────────────────────────────
  let raw: string
  try {
    raw = fs.readFileSync(canonicalFixturePath, 'utf-8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') {
      // Race between existsSync and readFileSync — genuine "no fixture" case.
      cacheSet(key, null)
      return DEFAULT_FIXTURE
    }
    // Non-ENOENT errors (EACCES, EISDIR, etc.) — surface actionably, do NOT mask.
    throw new Error(
      `[fixtureResolver] Could not read fixture ${fixturePath}: ${code ?? 'unknown error'}. ` +
        `Check file permissions and that the path is a regular file.`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (_jsonErr) {
    throw new Error(
      `[fixtureResolver] Malformed JSON in ${fixturePath}. ` +
        `Verify the file is valid JSON.`,
    )
  }

  const result = FlintFixtureSchema.safeParse(parsed)
  if (!result.success) {
    const firstIssue = result.error.issues[0]
    const issuePath = firstIssue?.path.join('.') || '(root)'
    const issueMsg = firstIssue?.message || 'invalid value'
    throw new Error(
      `[fixtureResolver] Invalid fixture at ${fixturePath} — ` +
        `field "${issuePath}": ${issueMsg}. ` +
        `Fix the fixture file and re-run the audit.`,
    )
  }

  const fixture = result.data

  // ── Resolve tokens path ────────────────────────────────────────────────────
  let resolvedTokensPath: string | null = null

  if (fixture.tokens) {
    const tokensLexical = path.resolve(fixtureDir, fixture.tokens)

    // Canonicalize via realpath BEFORE the containment check to defeat
    // symlink-escape attacks on the tokens path.
    const tokensCandidate = canonicalize(tokensLexical) ?? tokensLexical

    // Path-traversal guard: tokens must stay within projectRoot.
    // Error message redacts the resolved target — only echoes user-authored fields.
    if (!isWithinRoot(tokensCandidate, resolvedRoot)) {
      throw new Error(
        `[fixtureResolver] Path traversal blocked: fixture.tokens "${fixture.tokens}" in ${fixturePath} ` +
          `resolves outside the project root. Use a path relative to the fixture file that stays within the project.`,
      )
    }

    // Missing tokens file: do NOT throw. Set null so the auditor can surface
    // "fixture declares tokens but file missing" as a violation rather than crash.
    if (fs.existsSync(tokensCandidate)) {
      resolvedTokensPath = tokensCandidate
    }
  }

  const resolved: ResolvedFixture = {
    fixture,
    source: canonicalFixturePath,
    resolvedTokensPath,
  }

  cacheSet(key, resolved)

  return resolved
}
