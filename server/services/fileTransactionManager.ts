/**
 * server/services/fileTransactionManager.ts
 *
 * Server-side FileTransactionManager — identical semantics to
 * electron/FileTransactionManager.ts. Kept as a sibling in server/services/
 * rather than extracted to shared/ to avoid complicating the tsconfig split.
 *
 * Commandment 14 (Bypass Prohibition): every disk write from the web server
 * MUST use this manager, never raw fs.writeFile/writeFileSync.
 *
 * Design guarantees (same as the Electron version):
 *   1. ATOMIC  — writes to <filePath>.tmp first, then fs.rename().
 *   2. SERIALISED PER PATH — rapid writes to the same path chain into FIFO.
 *   3. CONCURRENT ACROSS PATHS — independent paths do not block each other.
 *   4. SELF-CLEANING — completed queue entries are evicted automatically.
 */

import { writeFile, rename, unlink } from 'node:fs/promises'

export class FileTransactionManager {
  private readonly _queues = new Map<string, Promise<void>>()

  /**
   * Enqueues an atomic write for `filePath`.
   */
  write(filePath: string, content: string): Promise<void> {
    const tail = this._queues.get(filePath) ?? Promise.resolve()
    const next = tail.then(() => this._atomicWrite(filePath, content))

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
   * Enqueues atomic writes for every (filePath, content) pair in batch.
   */
  writeBatch(batch: Map<string, string>): Promise<void> {
    const writes: Promise<void>[] = []
    for (const [filePath, content] of batch) {
      writes.push(this.write(filePath, content))
    }
    return Promise.all(writes).then(() => undefined)
  }

  private async _atomicWrite(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.tmp`
    try {
      await writeFile(tmpPath, content, 'utf8')
      await rename(tmpPath, filePath)
    } catch (err) {
      await unlink(tmpPath).catch(() => { /* intentionally suppressed */ })
      throw err
    }
  }
}

/** Module-level singleton — import this in server services and handlers. */
export const fileTransactionManager = new FileTransactionManager()
