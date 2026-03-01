/**
 * FileTransactionManager — electron/FileTransactionManager.ts
 *
 * Atomic, race-condition-safe write queue for the Bridge "Code is Truth" engine.
 *
 * Design guarantees:
 *   1. ATOMIC — every write goes to `<filePath>.tmp` first, then `fs.rename()`
 *      overwrites the target in a single kernel operation. Readers never observe
 *      a partially-written file, and a crash during the write leaves the original
 *      intact (only the orphaned .tmp file needs cleanup).
 *
 *   2. SERIALISED PER PATH — rapid-fire IPC save requests for the same file are
 *      chained into a sequential promise queue. The latest content always wins;
 *      no two writes to the same path execute concurrently.
 *
 *   3. CONCURRENT ACROSS PATHS — writes to different files proceed independently
 *      and never block each other.
 *
 *   4. SELF-CLEANING — promise-chain entries are evicted from the map once the
 *      tail settles, keeping memory usage bounded even under sustained load.
 *
 * Electron Main Process only — never import from src/.
 */

import { writeFile, rename, unlink } from 'node:fs/promises'

/**
 * Manages serialised, atomic file writes.
 * Export the module-level `fileTransactionManager` singleton rather than
 * instantiating this class directly.
 */
export class FileTransactionManager {
    /** Active tail promise keyed by absolute file path. */
    private readonly _queues = new Map<string, Promise<void>>()

    /**
     * Enqueues an atomic write for `filePath`.
     *
     * If a write is already in flight for this path the new write is chained
     * behind it, ensuring strict FIFO ordering without any external locking.
     *
     * @param filePath  Absolute path of the target file (must be pre-validated).
     * @param content   Complete UTF-8 content to commit to disk.
     * @returns         A Promise that resolves only once *this specific write*
     *                  has been committed — not merely queued.
     */
    write(filePath: string, content: string): Promise<void> {
        // Chain onto the existing tail so writes for the same path serialise.
        const tail = this._queues.get(filePath) ?? Promise.resolve()

        // `next` is returned to the caller — it propagates errors normally.
        const next = tail.then(() => this._atomicWrite(filePath, content))

        // `queued` is stored in the map as the new tail for subsequent writes.
        //
        // Two design rules:
        //   a) It must NEVER reject — a failed write N must not block write N+1.
        //      We achieve this by providing a rejection handler that returns void.
        //      The original error still propagates to the caller through `next`.
        //
        //   b) Eviction runs in the SAME microtask hop as `next` settling.
        //      Using `next.then(evict, evict)` instead of `next.catch().then(evict)`
        //      avoids an extra microtask tick between resolution and map cleanup,
        //      ensuring the map is empty by the time `await mgr.write(...)` resumes.
        let queued: Promise<void>
        const evict = (): void => {
            if (this._queues.get(filePath) === queued) {
                this._queues.delete(filePath)
            }
        }
        queued = next.then(evict, evict)
        this._queues.set(filePath, queued)

        return next
    }

    /**
     * Enqueues atomic writes for every `(filePath, content)` pair in `batch`
     * and resolves once **all** of them have been committed to disk.
     *
     * Each path is handled by the existing per-path FIFO queue, so:
     *   • Rapid-fire batch calls for the same path are still serialised.
     *   • Writes to different paths run concurrently (unchanged behaviour).
     *   • A failure for one path rejects the returned Promise but does not
     *     prevent the other paths from completing.
     *
     * Callers must pre-validate all paths (absolute, correct extension, within
     * the home directory) before passing them in — this method does not
     * re-validate.
     */
    writeBatch(batch: Map<string, string>): Promise<void> {
        const writes: Promise<void>[] = []
        for (const [filePath, content] of batch) {
            writes.push(this.write(filePath, content))
        }
        return Promise.all(writes).then(() => undefined)
    }

    /**
     * Performs the two-phase atomic write:
     *   1. `writeFile(tmpPath, content)` — full content lands on disk before
     *      any rename; a crash here leaves the original untouched.
     *   2. `rename(tmpPath, filePath)` — atomic replacement on POSIX/HFS+/APFS;
     *      readers see either the old or the new file, never an in-between state.
     *
     * On any failure the .tmp file is silently removed (best-effort) so stale
     * artefacts do not accumulate in the project directory.
     */
    private async _atomicWrite(filePath: string, content: string): Promise<void> {
        const tmpPath = `${filePath}.tmp`
        try {
            await writeFile(tmpPath, content, 'utf8')
            await rename(tmpPath, filePath)
        } catch (err) {
            // Best-effort cleanup — suppress secondary unlink errors.
            await unlink(tmpPath).catch(() => { /* intentionally suppressed */ })
            throw err
        }
    }
}

/** Module-level singleton — import this in electron/main.ts IPC handlers. */
export const fileTransactionManager = new FileTransactionManager()
