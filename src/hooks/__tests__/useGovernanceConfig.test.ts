/**
 * useGovernanceConfig.test.ts — src/hooks/__tests__/useGovernanceConfig.test.ts
 *
 * Tests for the useGovernanceConfig hook.
 *
 * Covers:
 *   - Populates store on mount (activePresets, inheritanceChain)
 *   - Cleans up onConfigChanged subscription on unmount
 *   - Handles null response (no project open)
 *   - Handles IPC unavailable (graceful no-op)
 *   - togglePack optimistically updates the store on success
 *   - togglePack handles IPC failure
 *   - Re-fetches when onConfigChanged fires
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGovernanceConfig } from '../useGovernanceConfig'
import { useGovernanceStore } from '../../store/governanceStore'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeResolvedConfig(overrides: Partial<{
    activePresets: string[]
    extendsChain: string[]
}> = {}) {
    return {
        config: { project: 'test-project', extends: overrides.extendsChain ?? [] },
        extendsChain: overrides.extendsChain ?? [],
        activePresets: overrides.activePresets ?? [],
        projectRoot: '/tmp/test',
    }
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('useGovernanceConfig', () => {
    beforeEach(() => {
        // The global setup.ts beforeEach already clears mocks and resets stores.
        // We only need to configure the governance mock defaults here.
        ;(window.flintAPI.governance.getResolvedConfig as ReturnType<typeof vi.fn>)
            .mockResolvedValue(null)
        ;(window.flintAPI.governance.onConfigChanged as ReturnType<typeof vi.fn>)
            .mockReturnValue(() => {})
        ;(window.flintAPI.governance.togglePack as ReturnType<typeof vi.fn>)
            .mockResolvedValue({ success: true, extends: [] })
    })

    it('returns initial store values', () => {
        const { result } = renderHook(() => useGovernanceConfig())
        // Before async resolution the hook exposes the store's initial values
        expect(result.current.activePresets).toEqual([])
        expect(result.current.inheritanceChain).toEqual([])
    })

    it('populates activePresets in store from IPC response', async () => {
        ;(window.flintAPI.governance.getResolvedConfig as ReturnType<typeof vi.fn>)
            .mockResolvedValue(
                makeResolvedConfig({
                    activePresets: ['@flint/healthcare'],
                    extendsChain: ['@flint/healthcare'],
                }),
            )

        renderHook(() => useGovernanceConfig())

        await waitFor(() => {
            const { activePresets } = useGovernanceStore.getState()
            expect(activePresets).toEqual(['@flint/healthcare'])
        })
    })

    it('populates inheritanceChain in store from IPC response', async () => {
        ;(window.flintAPI.governance.getResolvedConfig as ReturnType<typeof vi.fn>)
            .mockResolvedValue(
                makeResolvedConfig({
                    extendsChain: ['@flint/wcag-aa', '@flint/healthcare'],
                    activePresets: ['@flint/wcag-aa', '@flint/healthcare'],
                }),
            )

        renderHook(() => useGovernanceConfig())

        await waitFor(() => {
            const { inheritanceChain } = useGovernanceStore.getState()
            expect(inheritanceChain).toEqual(['@flint/wcag-aa', '@flint/healthcare'])
        })
    })

    it('sets jurisdictionCoverage after fetching config', async () => {
        ;(window.flintAPI.governance.getResolvedConfig as ReturnType<typeof vi.fn>)
            .mockResolvedValue(
                makeResolvedConfig({
                    activePresets: ['@flint/wcag-aa'],
                    extendsChain: ['@flint/wcag-aa'],
                }),
            )

        renderHook(() => useGovernanceConfig())

        await waitFor(() => {
            const { jurisdictionCoverage } = useGovernanceStore.getState()
            // Should have computed coverage for at least one jurisdiction
            expect(jurisdictionCoverage).not.toBeNull()
        })
    })

    it('handles null response (no project open) without throwing', async () => {
        ;(window.flintAPI.governance.getResolvedConfig as ReturnType<typeof vi.fn>)
            .mockResolvedValue(null)

        expect(() => {
            renderHook(() => useGovernanceConfig())
        }).not.toThrow()
    })

    it('subscribes to onConfigChanged on mount', async () => {
        renderHook(() => useGovernanceConfig())

        await waitFor(() => {
            expect(window.flintAPI.governance.onConfigChanged).toHaveBeenCalledTimes(1)
        })
    })

    it('calls the unsubscribe function on unmount', async () => {
        const unsubscribe = vi.fn()
        ;(window.flintAPI.governance.onConfigChanged as ReturnType<typeof vi.fn>)
            .mockReturnValue(unsubscribe)

        const { unmount } = renderHook(() => useGovernanceConfig())

        await waitFor(() => {
            expect(window.flintAPI.governance.onConfigChanged).toHaveBeenCalled()
        })

        unmount()
        expect(unsubscribe).toHaveBeenCalledTimes(1)
    })

    it('handles IPC unavailable gracefully (no-op)', () => {
        // Remove governance API
        const original = window.flintAPI.governance
        ;(window as any).flintAPI = { ...window.flintAPI, governance: undefined }

        expect(() => {
            renderHook(() => useGovernanceConfig())
        }).not.toThrow()

        // Restore
        ;(window as any).flintAPI = { ...window.flintAPI, governance: original }
    })

    it('togglePack returns the IPC result', async () => {
        ;(window.flintAPI.governance.togglePack as ReturnType<typeof vi.fn>)
            .mockResolvedValue({
                success: true,
                extends: ['@flint/healthcare'],
            })

        const { result } = renderHook(() => useGovernanceConfig())

        let toggleResult: Awaited<ReturnType<typeof result.current.togglePack>> | undefined
        await act(async () => {
            toggleResult = await result.current.togglePack('@flint/healthcare', true)
        })

        expect(toggleResult?.success).toBe(true)
    })

    it('togglePack returns error when IPC is not available', async () => {
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                togglePack: undefined,
            },
        }

        const { result } = renderHook(() => useGovernanceConfig())

        let toggleResult: Awaited<ReturnType<typeof result.current.togglePack>> | undefined
        await act(async () => {
            toggleResult = await result.current.togglePack('@flint/healthcare', true)
        })

        expect(toggleResult?.success).toBe(false)
        expect(toggleResult?.error).toContain('IPC not available')
    })

    it('re-fetches config when onConfigChanged callback fires', async () => {
        let configChangedCallback: (() => void) | undefined

        ;(window.flintAPI.governance.onConfigChanged as ReturnType<typeof vi.fn>)
            .mockImplementation((cb: () => void) => {
                configChangedCallback = cb
                return () => {}
            })

        const firstConfig = makeResolvedConfig({
            activePresets: [],
            extendsChain: [],
        })
        const secondConfig = makeResolvedConfig({
            activePresets: ['@flint/healthcare'],
            extendsChain: ['@flint/healthcare'],
        })

        ;(window.flintAPI.governance.getResolvedConfig as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(firstConfig)
            .mockResolvedValueOnce(secondConfig)

        renderHook(() => useGovernanceConfig())

        // Wait for first fetch to complete
        await waitFor(() => {
            expect(window.flintAPI.governance.getResolvedConfig).toHaveBeenCalledTimes(1)
        })

        // Simulate config-changed event from main process
        await act(async () => {
            configChangedCallback?.()
        })

        // Should have called getResolvedConfig a second time
        await waitFor(() => {
            expect(window.flintAPI.governance.getResolvedConfig).toHaveBeenCalledTimes(2)
        })
    })

    it('exposes isLoading from store', () => {
        const { result } = renderHook(() => useGovernanceConfig())
        // isLoading is a boolean
        expect(typeof result.current.isLoading).toBe('boolean')
    })

    it('exposes togglePack as a function', () => {
        const { result } = renderHook(() => useGovernanceConfig())
        expect(typeof result.current.togglePack).toBe('function')
    })
})
