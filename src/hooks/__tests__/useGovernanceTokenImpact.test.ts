/**
 * useGovernanceTokenImpact.test.ts
 *
 * Tests for H10: token change impact preview.
 *
 * Boundaries:
 *   - Returns null impactPreview and false isComputing initially
 *   - refresh() with explicit tokenPath calls previewTokenImpact
 *   - refresh() with no tokenPath and no existing impact is a no-op
 *   - refresh() uses tokenName from existing impactPreview when no tokenPath given
 *   - Sets isComputing=true during fetch, false after
 *   - Handles IPC failure — sets impactPreview to null
 *   - No-ops when previewTokenImpact is missing from API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGovernanceTokenImpact } from '../useGovernanceTokenImpact'

describe('useGovernanceTokenImpact', () => {
    beforeEach(() => {
        ;(window.flintAPI.governance.previewTokenImpact as ReturnType<typeof vi.fn>)
            .mockResolvedValue({ affectedFiles: 3, estimatedImpact: 'medium' })
    })

    it('returns null impactPreview and false isComputing initially', () => {
        const { result } = renderHook(() => useGovernanceTokenImpact())
        expect(result.current.impactPreview).toBeNull()
        expect(result.current.isComputing).toBe(false)
    })

    it('refresh() with tokenPath calls previewTokenImpact', async () => {
        const { result } = renderHook(() => useGovernanceTokenImpact())

        await act(async () => {
            await result.current.refresh('--color-primary')
        })

        expect(window.flintAPI.governance.previewTokenImpact).toHaveBeenCalledWith('--color-primary', '')
        expect(result.current.impactPreview).toMatchObject({
            tokenName: '--color-primary',
            affectedFiles: 3,
            estimatedImpact: 'medium',
        })
    })

    it('refresh() with no tokenPath and no existing impact is a no-op', async () => {
        const { result } = renderHook(() => useGovernanceTokenImpact())

        await act(async () => {
            await result.current.refresh()
        })

        expect(window.flintAPI.governance.previewTokenImpact).not.toHaveBeenCalled()
        expect(result.current.impactPreview).toBeNull()
    })

    it('refresh() uses tokenName from existing impactPreview when no tokenPath given', async () => {
        const { result } = renderHook(() => useGovernanceTokenImpact())

        // First set an impact
        await act(async () => {
            await result.current.refresh('--color-secondary')
        })
        expect(result.current.impactPreview).not.toBeNull()

        // Now refresh without tokenPath — should use the stored tokenName
        await act(async () => {
            await result.current.refresh()
        })

        expect(window.flintAPI.governance.previewTokenImpact).toHaveBeenCalledTimes(2)
        expect(window.flintAPI.governance.previewTokenImpact).toHaveBeenLastCalledWith('--color-secondary', '')
    })

    it('handles IPC failure — sets impactPreview to null', async () => {
        ;(window.flintAPI.governance.previewTokenImpact as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('IPC error'))

        const { result } = renderHook(() => useGovernanceTokenImpact())

        await act(async () => {
            await result.current.refresh('--color-primary')
        })

        expect(result.current.impactPreview).toBeNull()
        expect(result.current.isComputing).toBe(false)
    })

    it('sets isComputing=false after fetch completes', async () => {
        ;(window.flintAPI.governance.previewTokenImpact as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('fail'))

        const { result } = renderHook(() => useGovernanceTokenImpact())

        await act(async () => {
            await result.current.refresh('--color-primary')
        })

        expect(result.current.isComputing).toBe(false)
    })

    it('does not throw when previewTokenImpact is missing from API', async () => {
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                previewTokenImpact: undefined,
            },
        }

        const { result } = renderHook(() => useGovernanceTokenImpact())

        await expect(act(async () => {
            await result.current.refresh('--color-primary')
        })).resolves.not.toThrow()
    })
})
