import Database from 'better-sqlite3'
import { startPowerSyncWorker } from '@powersync/node/worker.js'

/**
 * PowerSync Worker — electron/powersync.worker.ts
 *
 * Dedicated background worker for the @powersync/node SDK to run better-sqlite3
 * bindings off the main JS event loop. It executes natively in its own thread.
 */

async function resolveBetterSqlite3() {
    return Database
}

startPowerSyncWorker({ loadBetterSqlite3: resolveBetterSqlite3 })
