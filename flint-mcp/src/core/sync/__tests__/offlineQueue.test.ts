import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { SyncSchema } from '../syncSchema.js'
import { OfflineQueue } from '../offlineQueue.js'

describe('OfflineQueue', () => {
    let db: BetterSqlite3.Database
    let queue: OfflineQueue

    beforeEach(() => {
        db = new BetterSqlite3(':memory:')
        new SyncSchema(db)
        queue = new OfflineQueue(db)
    })

    describe('enqueue', () => {
        it('enqueues a pull operation', () => {
            const item = queue.enqueue('/proj', 'pull', { force: true })
            expect(item.id).toBeTruthy()
            expect(item.projectRoot).toBe('/proj')
            expect(item.operationType).toBe('pull')
            expect(item.status).toBe('pending')
            expect(item.retryCount).toBe(0)
            expect(item.lastError).toBeNull()
            expect(JSON.parse(item.argsJson)).toEqual({ force: true })
        })

        it('enqueues a push operation', () => {
            const item = queue.enqueue('/proj', 'push')
            expect(item.operationType).toBe('push')
            expect(JSON.parse(item.argsJson)).toEqual({})
        })
    })

    describe('getQueueSize', () => {
        it('returns 0 for empty queue', () => {
            expect(queue.getQueueSize('/proj')).toBe(0)
        })

        it('returns count of pending items', () => {
            queue.enqueue('/proj', 'pull')
            queue.enqueue('/proj', 'push')
            queue.enqueue('/other', 'pull')
            expect(queue.getQueueSize('/proj')).toBe(2)
            expect(queue.getQueueSize('/other')).toBe(1)
        })
    })

    describe('getPendingItems', () => {
        it('returns items in FIFO order', () => {
            queue.enqueue('/proj', 'pull')
            queue.enqueue('/proj', 'push')
            const items = queue.getPendingItems('/proj')
            expect(items).toHaveLength(2)
            expect(items[0].operationType).toBe('pull')
            expect(items[1].operationType).toBe('push')
        })
    })

    describe('processQueue', () => {
        it('processes all pending items on success', async () => {
            queue.enqueue('/proj', 'pull')
            queue.enqueue('/proj', 'push')

            const result = await queue.processQueue('/proj', async () => {
                // success
            })

            expect(result.processed).toBe(2)
            expect(result.failed).toBe(0)
            expect(queue.getQueueSize('/proj')).toBe(0)
        })

        it('retries failed items up to max retries', async () => {
            queue.enqueue('/proj', 'pull')

            // First attempt fails
            await queue.processQueue('/proj', async () => {
                throw new Error('network error')
            })

            // Item should still be pending with retry_count=1
            expect(queue.getQueueSize('/proj')).toBe(1)
            const items = queue.getPendingItems('/proj')
            expect(items[0].retryCount).toBe(1)
            expect(items[0].lastError).toBe('network error')
        })

        it('marks item as failed after max retries', async () => {
            queue.enqueue('/proj', 'pull')

            // Fail 5 times (MAX_RETRIES)
            for (let i = 0; i < 5; i++) {
                await queue.processQueue('/proj', async () => {
                    throw new Error(`fail-${i}`)
                })
            }

            // Should be marked as failed, not pending
            expect(queue.getQueueSize('/proj')).toBe(0)
        })

        it('returns empty result for empty queue', async () => {
            const result = await queue.processQueue('/proj', async () => {})
            expect(result.processed).toBe(0)
            expect(result.failed).toBe(0)
        })
    })

    describe('getBackoffDelay', () => {
        it('returns exponential delays', () => {
            expect(OfflineQueue.getBackoffDelay(0)).toBe(1000)
            expect(OfflineQueue.getBackoffDelay(1)).toBe(2000)
            expect(OfflineQueue.getBackoffDelay(2)).toBe(4000)
            expect(OfflineQueue.getBackoffDelay(3)).toBe(8000)
        })
    })

    describe('pruneCompleted', () => {
        it('removes old completed items', async () => {
            queue.enqueue('/proj', 'pull')
            await queue.processQueue('/proj', async () => {})

            // Prune with large age window = remove everything completed
            const removed = queue.pruneCompleted(60 * 60 * 1000)
            // Item was just created so it's within the window; use a very large age
            // to ensure it's captured, or verify the item exists and is completed
            // Actually, pruneCompleted removes items OLDER than maxAgeMs, so a just-created
            // item won't be pruned with any positive age. Let's verify the count directly.
            expect(removed).toBe(0) // just created, not old enough

            // Manually backdate the created_at to test pruning
            db.prepare("UPDATE sync_queue SET created_at = '2020-01-01T00:00:00.000Z' WHERE status = 'completed'").run()
            const removed2 = queue.pruneCompleted(1000)
            expect(removed2).toBe(1)
        })

        it('does not remove pending items', async () => {
            queue.enqueue('/proj', 'pull')
            const removed = queue.pruneCompleted(0)
            expect(removed).toBe(0)
            expect(queue.getQueueSize('/proj')).toBe(1)
        })
    })
})
