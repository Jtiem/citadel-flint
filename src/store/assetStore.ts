/**
 * Asset Store — src/store/assetStore.ts
 *
 * Phase Q: Asset Management Hub
 *
 * Zustand store for the assets_cache SQLite table. Holds the full metadata
 * list in memory after the first IPC fetch, then all search/filter operations
 * run purely in-memory (no IPC round-trips) to stay under the 30ms target.
 *
 * Renderer Process only — no Node.js imports.
 */

import { create } from 'zustand'
import type { AssetMeta } from '../types/flint-api'

// ── State shape ────────────────────────────────────────────────────────────────

interface AssetState {
    /** Full list of assets returned by the last getMetadata IPC call. */
    assets: AssetMeta[]
    /**
     * Filtered subset of `assets` matching `searchQuery`.
     * Derived in-memory — no IPC. Updated synchronously on every setSearch call.
     */
    filteredAssets: AssetMeta[]
    /** Current search query string (lower-cased). */
    searchQuery: string
    /** Layout mode for the asset grid. */
    viewMode: 'grid' | 'list'
    /** True while the initial getMetadata IPC call is in flight. */
    isLoading: boolean
    /** Result of the most recent audit run. Null until first audit. */
    lastAuditResult: { audited: number; zombies: number } | null
}

// ── Action shape ───────────────────────────────────────────────────────────────

interface AssetActions {
    /** Fetches asset metadata from the main process and populates `assets`. */
    fetchAssets: () => Promise<void>
    /**
     * Filters `assets` in-memory on `name` + `tags` (case-insensitive includes).
     * Updates `filteredAssets` synchronously — no IPC, <30ms for 1000+ rows.
     */
    setSearch: (query: string) => void
    /** Persists the chosen layout mode. */
    setViewMode: (mode: 'grid' | 'list') => void
    /**
     * Triggers the Babel AST zombie auditor in the main process.
     * Updates `lastAuditResult` and re-fetches metadata (zombie flags may change).
     */
    runAudit: () => Promise<{ audited: number; zombies: number }>
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function applyFilter(assets: AssetMeta[], query: string): AssetMeta[] {
    if (!query) return assets
    return assets.filter(
        (a) =>
            a.name.toLowerCase().includes(query) ||
            a.tags.toLowerCase().includes(query)
    )
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useAssetStore = create<AssetState & AssetActions>((set, get) => ({
    assets: [],
    filteredAssets: [],
    searchQuery: '',
    viewMode: 'grid',
    isLoading: false,
    lastAuditResult: null,

    fetchAssets: async () => {
        set({ isLoading: true })
        try {
            const assets = await window.flintAPI.assets!.getMetadata()
            const { searchQuery } = get()
            set({
                assets,
                filteredAssets: applyFilter(assets, searchQuery),
                isLoading: false,
            })
        } catch (err) {
            console.error('[AssetStore] fetchAssets failed:', err)
            set({ isLoading: false })
        }
    },

    setSearch: (query: string) => {
        const q = query.toLowerCase()
        const { assets } = get()
        set({
            searchQuery: q,
            filteredAssets: applyFilter(assets, q),
        })
    },

    setViewMode: (mode) => set({ viewMode: mode }),

    runAudit: async () => {
        const result = await window.flintAPI.assets!.auditZombies()
        set({ lastAuditResult: result })
        // Re-fetch so zombie badges reflect the updated flags immediately
        await get().fetchAssets()
        return result
    },
}))
