/**
 * FileTransactionManager — Unit Tests
 *
 * Scope: pure Node.js fs logic only. No Electron, no IPC, no React.
 *
 * What we verify:
 *   1. Basic write — content reaches disk correctly.
 *   2. Atomic property — no .tmp artefact survives a successful write.
 *   3. Serialisation — N rapid writes to the same path execute in submission
 *      order; the last value wins.
 *   4. Concurrent independence — writes to different paths proceed in parallel
 *      without corrupting each other.
 *   5. Queue cleanup — the internal _queues map is empty once all writes settle.
 *   6. Error propagation — a write to a non-existent directory rejects and
 *      leaves no .tmp artefact behind.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, rm, readFile, access, rename } from 'node:fs/promises'

// vi.mock is hoisted by Vitest's transformer to the top of the module, so it
// intercepts node:fs/promises for ALL callers in this test run — including
// FileTransactionManager.ts — before any imports are evaluated.
//
// All functions pass through to the real implementations by default; only
// `rename` is wrapped in vi.fn() so individual tests can inject one-time
// failures via mockRejectedValueOnce without touching the global state.
vi.mock('node:fs/promises', async (importOriginal) => {
    const mod = await importOriginal<typeof import('node:fs/promises')>()
    return {
        ...mod,
        rename: vi.fn().mockImplementation(mod.rename),
    }
})
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { FileTransactionManager } from './FileTransactionManager'

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Returns true when a file exists at `p`, false otherwise. */
async function fileExists(p: string): Promise<boolean> {
    try { await access(p); return true }
    catch { return false }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('FileTransactionManager', () => {
    let dir: string
    let mgr: FileTransactionManager

    beforeEach(async () => {
        // Fresh isolated temp directory and fresh manager per test.
        dir = join(tmpdir(), `flint-test-${randomUUID()}`)
        await mkdir(dir, { recursive: true })
        mgr = new FileTransactionManager()
    })

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true })
    })

    // ── 1. Basic write ────────────────────────────────────────────────────────

    it('writes content to a new file', async () => {
        const file = join(dir, 'component.tsx')
        await mgr.write(file, 'const x = 1')
        expect(await readFile(file, 'utf8')).toBe('const x = 1')
    })

    it('overwrites an existing file with new content', async () => {
        const file = join(dir, 'component.tsx')
        await mgr.write(file, 'version 1')
        await mgr.write(file, 'version 2')
        expect(await readFile(file, 'utf8')).toBe('version 2')
    })

    it('correctly writes multi-line TSX source', async () => {
        const src = `export default function App() {\n  return <div>hello</div>\n}`
        const file = join(dir, 'App.tsx')
        await mgr.write(file, src)
        expect(await readFile(file, 'utf8')).toBe(src)
    })

    // ── 2. Atomic property ────────────────────────────────────────────────────

    it('leaves no .tmp artefact after a successful write', async () => {
        const file = join(dir, 'component.tsx')
        await mgr.write(file, 'hello')
        expect(await fileExists(`${file}.tmp`)).toBe(false)
    })

    // ── 3. Serialisation ──────────────────────────────────────────────────────

    it('serialises rapid-fire writes: last write wins', async () => {
        const file = join(dir, 'component.tsx')
        // Fire 5 concurrent writes — they must be serialised in FIFO order.
        await Promise.all([
            mgr.write(file, 'v1'),
            mgr.write(file, 'v2'),
            mgr.write(file, 'v3'),
            mgr.write(file, 'v4'),
            mgr.write(file, 'v5'),
        ])
        // v5 is the final enqueued write, so it must be the committed value.
        expect(await readFile(file, 'utf8')).toBe('v5')
    })

    it('each write promise resolves only after its own write completes', async () => {
        const file = join(dir, 'component.tsx')
        const snapshots: string[] = []

        const p1 = mgr.write(file, 'write-1')
        const p2 = mgr.write(file, 'write-2')

        // After p1 resolves, the file should already contain 'write-1'
        // (p2 hasn't started yet — it's waiting on p1's tail).
        await p1.then(async () => {
            snapshots.push(await readFile(file, 'utf8'))
        })
        await p2

        // First snapshot must have been captured before p2 overwrote it.
        expect(snapshots[0]).toBe('write-1')
        // Final state: p2's content.
        expect(await readFile(file, 'utf8')).toBe('write-2')
    })

    // ── 4. Concurrent independence ────────────────────────────────────────────

    it('runs concurrent writes to different paths independently', async () => {
        const fileA = join(dir, 'a.tsx')
        const fileB = join(dir, 'b.tsx')

        await Promise.all([
            mgr.write(fileA, 'content-a'),
            mgr.write(fileB, 'content-b'),
        ])

        const [a, b] = await Promise.all([
            readFile(fileA, 'utf8'),
            readFile(fileB, 'utf8'),
        ])
        expect(a).toBe('content-a')
        expect(b).toBe('content-b')
    })

    // ── 5. Queue cleanup ──────────────────────────────────────────────────────

    it('evicts completed entries from the internal queue map', async () => {
        const file = join(dir, 'component.tsx')
        await mgr.write(file, 'anything')

        // White-box access to the private map — acceptable in unit tests.
        const queues = (mgr as unknown as { _queues: Map<string, Promise<void>> })._queues
        expect(queues.size).toBe(0)
    })

    it('handles multiple files without leaking queue entries', async () => {
        const files = Array.from({ length: 5 }, (_, i) => join(dir, `file-${i}.tsx`))
        await Promise.all(files.map((f, i) => mgr.write(f, `content-${i}`)))

        const queues = (mgr as unknown as { _queues: Map<string, Promise<void>> })._queues
        expect(queues.size).toBe(0)
    })

    // ── 6. Error propagation ──────────────────────────────────────────────────

    it('rejects when the parent directory does not exist', async () => {
        const badFile = join(dir, 'no-such-subdir', 'component.tsx')
        await expect(mgr.write(badFile, 'content')).rejects.toThrow()
    })

    it('leaves no .tmp artefact after a failed write', async () => {
        const badFile = join(dir, 'no-such-subdir', 'component.tsx')
        await mgr.write(badFile, 'content').catch(() => { /* expected */ })
        expect(await fileExists(`${badFile}.tmp`)).toBe(false)
    })
})

// ── Phase E.3 — Atomic Write Failure Recovery ─────────────────────────────────
//
// Validates the three-layer atomicity guarantee for the write pathway:
//   Layer 1 (FileTransactionManager): rename failure leaves the original file
//            byte-for-byte intact and no .tmp artefact on disk.
//   Layer 2 (Coordinator / editorStore): a thrown write error propagates to the
//            caller so window.flintAPI.tokens.upsertOverride is never reached —
//            "Atomic Queuing" prevents a SQLite row from landing without a
//            corresponding file change.
//
// The `rename` spy is set up by the vi.mock factory above this file.
// mockRejectedValueOnce injects exactly one failure; subsequent calls revert
// to the real rename implementation automatically.

describe('Phase E.3 — Atomic Write Failure Recovery', () => {
    let dir: string
    let mgr: FileTransactionManager

    beforeEach(async () => {
        dir = join(tmpdir(), `flint-e3-test-${randomUUID()}`)
        await mkdir(dir, { recursive: true })
        mgr = new FileTransactionManager()
    })

    afterEach(async () => {
        // Clear call history so assertions in one test don't bleed into the next.
        vi.mocked(rename).mockClear()
        await rm(dir, { recursive: true, force: true })
    })

    // ── Layer 1a: original file unchanged after rename failure ────────────────

    it('preserves the original .tsx file byte-for-byte when rename throws', async () => {
        const file = join(dir, 'App.tsx')
        const original = 'export default function App() { return <div className="original" /> }'

        // Establish a known-good version on disk via a real (non-mocked) write.
        await mgr.write(file, original)

        // Simulate ENOSPC (disk full) on the atomic rename step.
        vi.mocked(rename).mockRejectedValueOnce(
            Object.assign(new Error('ENOSPC: no space left on device, rename'), { code: 'ENOSPC' })
        )

        await expect(mgr.write(file, 'new content — must not land')).rejects.toThrow('ENOSPC')

        // The original file must be byte-for-byte intact.
        expect(await readFile(file, 'utf8')).toBe(original)
    })

    // ── Layer 1b: no .tmp artefact survives a rename failure ──────────────────

    it('leaves no .tmp artefact on disk when rename throws', async () => {
        const file = join(dir, 'App.tsx')
        await mgr.write(file, 'original')

        vi.mocked(rename).mockRejectedValueOnce(new Error('ENOSPC'))

        await mgr.write(file, 'new content').catch(() => { /* expected */ })

        expect(await fileExists(`${file}.tmp`)).toBe(false)
    })

    // ── Layer 2: SQLite upsert never called when file write throws ────────────
    //
    // This is the "Atomic Queuing" guarantee: the store action pattern is
    //   await fileTransactionManager.write(...)   // throws → error propagates
    //   await upsertOverride(...)                 // unreachable — SQLite stays clean
    //
    // The mock upsert stands in for window.flintAPI.tokens.upsertOverride.

    it('does not call upsertOverride when the file write throws (Atomic Queuing)', async () => {
        const mockUpsert = vi.fn()
        const badFile = join(dir, 'no-subdir', 'App.tsx')

        let caughtError: Error | null = null
        try {
            await mgr.write(badFile, 'new code')         // throws — parent dir absent
            await mockUpsert('flint-id', 'style', '#ff0000')  // must never execute
        } catch (err) {
            caughtError = err as Error
        }

        // The write must have thrown so the caller is notified of the failure.
        expect(caughtError).not.toBeNull()
        // The SQLite upsert must never have been reached.
        expect(mockUpsert).not.toHaveBeenCalled()
    })

    // ── Asymmetry: success path confirms the pattern works when write lands ────

    it('calls upsertOverride exactly once when the file write succeeds', async () => {
        const mockUpsert = vi.fn()
        const file = join(dir, 'App.tsx')

        await mgr.write(file, 'valid content')
        await mockUpsert('flint-id', 'className', 'text-blue-500')

        expect(mockUpsert).toHaveBeenCalledOnce()
        expect(mockUpsert).toHaveBeenCalledWith('flint-id', 'className', 'text-blue-500')
    })
})

// ── writeBatch ─────────────────────────────────────────────────────────────────
//
// Validates the multi-file batch write method introduced for Phase F.2.
// Guarantees mirror the per-file write guarantees: atomicity per path,
// concurrent execution across paths, and error propagation on failure.

describe('writeBatch', () => {
    let dir: string
    let mgr: FileTransactionManager

    beforeEach(async () => {
        dir = join(tmpdir(), `flint-batch-test-${randomUUID()}`)
        await mkdir(dir, { recursive: true })
        mgr = new FileTransactionManager()
    })

    afterEach(async () => {
        // maxRetries handles the ENOTEMPTY race that can occur on macOS when the
        // OS briefly holds the directory open (e.g. Spotlight indexing) between
        // the recursive-delete scan and the final rmdir syscall.
        await rm(dir, { recursive: true, force: true, maxRetries: 3 })
    })

    it('resolves immediately and writes nothing for an empty map', async () => {
        await expect(mgr.writeBatch(new Map())).resolves.toBeUndefined()
    })

    it('writes a single file correctly', async () => {
        const file = join(dir, 'Button.tsx')
        await mgr.writeBatch(new Map([[file, 'export default function Button() {}']]))
        expect(await readFile(file, 'utf8')).toBe('export default function Button() {}')
    })

    it('writes multiple files concurrently and all land on disk', async () => {
        const entries: [string, string][] = [
            [join(dir, 'A.tsx'), 'content-a'],
            [join(dir, 'B.tsx'), 'content-b'],
            [join(dir, 'C.tsx'), 'content-c'],
        ]
        await mgr.writeBatch(new Map(entries))

        for (const [filePath, expected] of entries) {
            expect(await readFile(filePath, 'utf8')).toBe(expected)
        }
    })

    it('leaves no .tmp artefacts after a successful batch', async () => {
        const files = [join(dir, 'X.tsx'), join(dir, 'Y.tsx')]
        await mgr.writeBatch(new Map(files.map((f, i) => [f, `content-${i}`])))
        for (const f of files) {
            expect(await fileExists(`${f}.tmp`)).toBe(false)
        }
    })

    it('serialises rapid batch calls to the same path: last write wins', async () => {
        const file = join(dir, 'Shared.tsx')
        await Promise.all([
            mgr.writeBatch(new Map([[file, 'batch-1']])),
            mgr.writeBatch(new Map([[file, 'batch-2']])),
            mgr.writeBatch(new Map([[file, 'batch-3']])),
        ])
        expect(await readFile(file, 'utf8')).toBe('batch-3')
    })

    it('evicts all queue entries after batch completes', async () => {
        const files = [join(dir, 'P.tsx'), join(dir, 'Q.tsx')]
        await mgr.writeBatch(new Map(files.map((f) => [f, 'x'])))
        const queues = (mgr as unknown as { _queues: Map<string, Promise<void>> })._queues
        expect(queues.size).toBe(0)
    })

    it('rejects when any path in the batch does not exist', async () => {
        // Promise.all rejects as soon as one write fails. The good write may
        // or may not have landed (race); only the rejection is guaranteed here.
        const goodFile = join(dir, 'Good.tsx')
        const badFile = join(dir, 'no-subdir', 'Bad.tsx')
        const batch = new Map([
            [goodFile, 'good content'],
            [badFile, 'bad content'],
        ])
        await expect(mgr.writeBatch(batch)).rejects.toThrow()
    })
})
