/**
 * GitManager — Unit Tests
 *
 * Uses real git operations in isolated temporary directories.
 * No mocks: the test environment is expected to have git available
 * (consistent with the existing ast:git-show IPC handler assumption).
 *
 * Coverage:
 *   ensureRepo   — creates .git, .gitignore, initial commit; idempotent
 *   shadowCommit — creates flint:sync commit; custom batchId; no-op cases
 *   getGitNode   — extracts JSX node by data-flint-id; null cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { GitManager } from './GitManager'

const execFileAsync = promisify(execFile)

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Returns true when a file or directory exists at `p`, false otherwise. */
async function fileExists(p: string): Promise<boolean> {
    try { await access(p); return true } catch { return false }
}

/** Returns the number of commits in the HEAD branch. */
async function commitCount(dir: string): Promise<number> {
    const { stdout } = await execFileAsync(
        'git', ['rev-list', '--count', 'HEAD'],
        { cwd: dir }
    )
    return parseInt(stdout.trim(), 10)
}

/** Returns the full SHA of the most recent commit. */
async function latestHash(dir: string): Promise<string> {
    const { stdout } = await execFileAsync(
        'git', ['rev-parse', 'HEAD'],
        { cwd: dir }
    )
    return stdout.trim()
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GitManager', () => {
    let dir: string
    let mgr: GitManager

    beforeEach(async () => {
        dir = join(tmpdir(), `flint-git-test-${randomUUID()}`)
        await mkdir(dir, { recursive: true })
        mgr = new GitManager()
    })

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true, maxRetries: 3 })
    })

    // ── ensureRepo ────────────────────────────────────────────────────────────

    describe('ensureRepo', () => {
        it('creates a .git directory', async () => {
            await mgr.ensureRepo(dir)
            expect(await fileExists(join(dir, '.git'))).toBe(true)
        })

        it('creates a .gitignore containing node_modules and .flint/tmp', async () => {
            await mgr.ensureRepo(dir)
            const content = await readFile(join(dir, '.gitignore'), 'utf8')
            expect(content).toContain('node_modules')
            expect(content).toContain('.flint/tmp')
        })

        it('creates an initial flint:init commit', async () => {
            await mgr.ensureRepo(dir)
            const { stdout } = await execFileAsync('git', ['log', '--oneline'], { cwd: dir })
            expect(stdout).toContain('flint:init')
        })

        it('produces exactly one commit on a fresh directory', async () => {
            await mgr.ensureRepo(dir)
            expect(await commitCount(dir)).toBe(1)
        })

        it('is idempotent — no error or extra commit on a second call', async () => {
            await mgr.ensureRepo(dir)
            await expect(mgr.ensureRepo(dir)).resolves.toBeUndefined()
            expect(await commitCount(dir)).toBe(1)
        })

        it('includes pre-existing files in the initial commit', async () => {
            // Simulate template files being copied before ensureRepo is called
            await writeFile(join(dir, 'App.tsx'), 'export default function App() {}')
            await mgr.ensureRepo(dir)
            // The commit should include App.tsx (git show HEAD should succeed)
            const hash = await latestHash(dir)
            const { stdout } = await execFileAsync(
                'git', ['show', `${hash}:App.tsx`],
                { cwd: dir }
            )
            expect(stdout).toContain('App')
        })
    })

    // ── shadowCommit ──────────────────────────────────────────────────────────

    describe('shadowCommit', () => {
        beforeEach(async () => {
            // Ensure a valid repo for each shadowCommit test
            await mgr.ensureRepo(dir)
        })

        it('creates a flint:sync commit when files have changed', async () => {
            await writeFile(join(dir, 'App.tsx'), 'const x = 1')
            await mgr.shadowCommit(dir)
            const { stdout } = await execFileAsync('git', ['log', '--oneline'], { cwd: dir })
            expect(stdout).toContain('flint:sync:')
            expect(await commitCount(dir)).toBe(2)
        })

        it('uses the custom batchId in the commit message', async () => {
            await writeFile(join(dir, 'App.tsx'), 'const y = 2')
            await mgr.shadowCommit(dir, 'test-batch-abc')
            const { stdout } = await execFileAsync('git', ['log', '--oneline'], { cwd: dir })
            expect(stdout).toContain('flint:sync:test-batch-abc')
        })

        it('is a no-op when the working tree is clean', async () => {
            const before = await commitCount(dir)
            await mgr.shadowCommit(dir)
            expect(await commitCount(dir)).toBe(before)
        })

        it('is a no-op in a directory that is not inside a git repo', async () => {
            const noRepo = join(tmpdir(), `flint-no-git-${randomUUID()}`)
            await mkdir(noRepo, { recursive: true })
            await expect(mgr.shadowCommit(noRepo)).resolves.toBeUndefined()
            await rm(noRepo, { recursive: true, force: true })
        })

        it('accepts cwd pointing to a subdirectory of the project', async () => {
            const subdir = join(dir, 'src')
            await mkdir(subdir, { recursive: true })
            await writeFile(join(dir, 'App.tsx'), 'const z = 3')
            // Pass the subdirectory — GitManager resolves the git root automatically
            await mgr.shadowCommit(subdir)
            const { stdout } = await execFileAsync('git', ['log', '--oneline'], { cwd: dir })
            expect(stdout).toContain('flint:sync:')
        })
    })

    // ── getGitNode ────────────────────────────────────────────────────────────

    describe('getGitNode', () => {
        it('returns the source text of the JSXElement matching dataFlintId', async () => {
            await mgr.ensureRepo(dir)
            const src = `export default function App() {
  return (
    <div data-flint-id="div:2:4" className="container">
      <span data-flint-id="span:3:6">hello</span>
    </div>
  )
}`
            const fp = join(dir, 'App.tsx')
            await writeFile(fp, src)
            await mgr.shadowCommit(dir)
            const hash = await latestHash(dir)

            const result = await mgr.getGitNode(hash, fp, 'div:2:4')
            expect(result).not.toBeNull()
            expect(result).toContain('data-flint-id="div:2:4"')
            expect(result).toContain('container')
            expect(result).toContain('hello')
        })

        it('returns the correct nested child node when inner ID is targeted', async () => {
            await mgr.ensureRepo(dir)
            const src = `export default function App() {
  return (
    <div data-flint-id="div:2:4">
      <span data-flint-id="span:3:6">world</span>
    </div>
  )
}`
            const fp = join(dir, 'App.tsx')
            await writeFile(fp, src)
            await mgr.shadowCommit(dir)
            const hash = await latestHash(dir)

            const result = await mgr.getGitNode(hash, fp, 'span:3:6')
            expect(result).not.toBeNull()
            expect(result).toContain('data-flint-id="span:3:6"')
            expect(result).toContain('world')
            // Should NOT include the outer div
            expect(result).not.toContain('div:2:4')
        })

        it('returns null for an unknown dataFlintId', async () => {
            await mgr.ensureRepo(dir)
            const fp = join(dir, 'App.tsx')
            await writeFile(fp, `export default function App() {
  return <div data-flint-id="div:1:0">hi</div>
}`)
            await mgr.shadowCommit(dir)
            const hash = await latestHash(dir)

            expect(await mgr.getGitNode(hash, fp, 'span:99:0')).toBeNull()
        })

        it('returns null for a non-existent commit hash', async () => {
            await mgr.ensureRepo(dir)
            const fp = join(dir, 'App.tsx')
            // File has never been committed — deadbeef does not exist
            expect(await mgr.getGitNode('deadbeef', fp, 'div:1:0')).toBeNull()
        })

        it('returns null when the file path is not in a git repo', async () => {
            const noRepo = join(tmpdir(), `flint-no-git-${randomUUID()}`)
            await mkdir(noRepo, { recursive: true })
            const fp = join(noRepo, 'App.tsx')
            expect(await mgr.getGitNode('HEAD', fp, 'div:1:0')).toBeNull()
            await rm(noRepo, { recursive: true, force: true })
        })
    })
})
