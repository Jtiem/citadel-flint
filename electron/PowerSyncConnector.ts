import type { PowerSyncBackendConnector, PowerSyncCredentials, AbstractPowerSyncDatabase } from '@powersync/node'

/**
 * PowerSync Connector — electron/PowerSyncConnector.ts
 *
 * Plugs the local PowerSyncDatabase instance into the remote backend (Supabase
 * or custom REST endpoint). Responsible for fetching JWTs and uploading
 * local modifications via the `uploadData` function.
 */

export class BridgePowerSyncConnector implements PowerSyncBackendConnector {
    private backendUrl: string
    private token: string

    constructor() {
        // Fallbacks for Spec Development phase until we have a real backend provisioned
        this.backendUrl = process.env.POWERSYNC_URL || ''
        this.token = process.env.POWERSYNC_TOKEN || ''
    }

    /**
     * Called by PowerSync when the connection starts, and periodically to refresh
     * the token before it expires.
     */
    async fetchCredentials(): Promise<PowerSyncCredentials | null> {
        if (!this.backendUrl || !this.token) {
            console.warn('[Bridge] PowerSync: URL or Token not configured. Sync disabled.')
            return null
        }

        return {
            endpoint: this.backendUrl,
            token: this.token,
        }
    }

    /**
     * Called by PowerSync when there are local mutations (in the upload queue)
     * that need to be pushed to the server.
     */
    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
        if (!this.backendUrl) return

        const transaction = await database.getNextCrudTransaction()
        if (!transaction) return

        try {
            console.log(`[Bridge] Uploading ${transaction.crud.length} ops for sync...`)
            // In a real implementation:
            // 1. Iterate over transaction.crud
            // 2. Perform REST / RPC calls to Supabase or your backend.
            // 3. Await successful completion before marking as complete.

            // Dummy success for now during Spec Development
            await transaction.complete()
        } catch (err) {
            console.error('[Bridge] PowerSync upload failed:', err)
            // If the upload fails, PowerSync will retry later. Do NOT call .complete()
            throw err
        }
    }
}
