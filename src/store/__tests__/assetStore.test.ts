/**
 * assetStore.test.ts — src/store/__tests__/assetStore.test.ts
 *
 * Tests for the asset management Zustand store.
 *
 * Covers:
 *   - Initial state shape
 *   - fetchAssets populates assets + filteredAssets
 *   - setSearch filters assets in-memory (case-insensitive)
 *   - setViewMode toggles grid/list
 *   - runAudit updates lastAuditResult
 *   - fetchAssets error handling (no crash, loading resets)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAssetStore } from '../../store/assetStore'

// ── Mock data ────────────────────────────────────────────────────────────────

const mockAssets = [
    { name: 'icon-logo.svg', tags: 'branding icon', path: '/assets/icon-logo.svg', sizeBytes: 1024, isZombie: false },
    { name: 'bg-hero.png', tags: 'background hero image', path: '/assets/bg-hero.png', sizeBytes: 204800, isZombie: false },
    { name: 'button-icon.svg', tags: 'ui component icon', path: '/assets/button-icon.svg', sizeBytes: 512, isZombie: true },
]

const mockGetMetadata = vi.fn().mockResolvedValue(mockAssets)
const mockAuditZombies = vi.fn().mockResolvedValue({ audited: 3, zombies: 1 })

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    mockGetMetadata.mockResolvedValue(mockAssets)
    mockAuditZombies.mockResolvedValue({ audited: 3, zombies: 1 })

    // Reset store state
    useAssetStore.setState({
        assets: [],
        filteredAssets: [],
        searchQuery: '',
        viewMode: 'grid',
        isLoading: false,
        lastAuditResult: null,
    })

    // Mock window.flintAPI
    ;(window as unknown as Record<string, unknown>).flintAPI = {
        assets: {
            getMetadata: mockGetMetadata,
            auditZombies: mockAuditZombies,
        },
    }
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('assetStore', () => {
    it('has correct initial state', () => {
        const state = useAssetStore.getState()
        expect(state.assets).toEqual([])
        expect(state.filteredAssets).toEqual([])
        expect(state.searchQuery).toBe('')
        expect(state.viewMode).toBe('grid')
        expect(state.isLoading).toBe(false)
        expect(state.lastAuditResult).toBeNull()
    })

    it('fetchAssets populates assets and filteredAssets', async () => {
        await useAssetStore.getState().fetchAssets()

        const state = useAssetStore.getState()
        expect(state.assets).toHaveLength(3)
        expect(state.filteredAssets).toHaveLength(3)
        expect(state.isLoading).toBe(false)
    })

    it('setSearch filters assets case-insensitively on name + tags', async () => {
        await useAssetStore.getState().fetchAssets()
        useAssetStore.getState().setSearch('Icon')

        const state = useAssetStore.getState()
        expect(state.searchQuery).toBe('icon')
        // "icon-logo.svg" and "button-icon.svg" match on name, "ui component icon" on tags
        expect(state.filteredAssets.length).toBeGreaterThanOrEqual(2)
        expect(state.filteredAssets.every((a) => a.name.includes('icon') || a.tags.includes('icon'))).toBe(true)
    })

    it('setSearch with empty string shows all assets', async () => {
        await useAssetStore.getState().fetchAssets()
        useAssetStore.getState().setSearch('icon')
        useAssetStore.getState().setSearch('')

        expect(useAssetStore.getState().filteredAssets).toHaveLength(3)
    })

    it('setViewMode toggles between grid and list', () => {
        useAssetStore.getState().setViewMode('list')
        expect(useAssetStore.getState().viewMode).toBe('list')

        useAssetStore.getState().setViewMode('grid')
        expect(useAssetStore.getState().viewMode).toBe('grid')
    })

    it('runAudit updates lastAuditResult and re-fetches', async () => {
        const result = await useAssetStore.getState().runAudit()

        expect(result).toEqual({ audited: 3, zombies: 1 })
        expect(useAssetStore.getState().lastAuditResult).toEqual({ audited: 3, zombies: 1 })
        expect(mockGetMetadata).toHaveBeenCalled()
    })

    it('fetchAssets handles errors gracefully', async () => {
        mockGetMetadata.mockRejectedValueOnce(new Error('IPC failed'))
        await useAssetStore.getState().fetchAssets()

        const state = useAssetStore.getState()
        expect(state.isLoading).toBe(false)
        expect(state.assets).toEqual([])
    })
})
