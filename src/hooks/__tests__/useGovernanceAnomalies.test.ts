/**
 * useGovernanceAnomalies.test.ts
 *
 * Tests for H6: anomaly fetch, dismissal, provenance map.
 *
 * Boundaries:
 *   - Returns empty anomalies + empty provenanceMap on init
 *   - Fetches anomalies from IPC on mount
 *   - Handles IPC failure gracefully (pushes error notification)
 *   - Fetches provenance map when activeFilePath is set
 *   - Clears provenance map when activeFilePath becomes null
 *   - setAnomalyBannerDismissed toggles the flag
 *   - No-ops when governance API is missing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGovernanceAnomalies } from '../useGovernanceAnomalies'
import { useNotificationStore } from '../../store/notificationStore'
import { useCanvasStore } from '../../store/canvasStore'

describe('useGovernanceAnomalies', () => {
    beforeEach(() => {
        // setup.ts already resets mocks + stores; configure defaults here
        ;(window.flintAPI.governance.getAnomalies as ReturnType<typeof vi.fn>)
            .mockResolvedValue([])
        ;(window.flintAPI.governance.getProvenanceSummary as ReturnType<typeof vi.fn>)
            .mockResolvedValue({})
    })

    it('returns empty anomalies and provenanceMap initially', () => {
        const { result } = renderHook(() => useGovernanceAnomalies())
        expect(result.current.anomalies).toEqual([])
        expect(result.current.provenanceMap).toEqual({})
        expect(result.current.anomalyBannerDismissed).toBe(false)
    })

    it('fetches anomalies from IPC on mount', async () => {
        const mockAnomalies = [
            { type: 'override_spike', message: 'High override frequency' },
            { type: 'violation_surge' },
        ]
        ;(window.flintAPI.governance.getAnomalies as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockAnomalies)

        const { result } = renderHook(() => useGovernanceAnomalies())

        await waitFor(() => {
            expect(result.current.anomalies).toHaveLength(2)
        })
        expect(result.current.anomalies[0].type).toBe('override_spike')
    })

    it('handles IPC failure gracefully and pushes error notification', async () => {
        ;(window.flintAPI.governance.getAnomalies as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('IPC error'))

        renderHook(() => useGovernanceAnomalies())

        await waitFor(() => {
            const notifications = useNotificationStore.getState().notifications
            expect(notifications.some((n) => n.title === 'Anomaly data unavailable')).toBe(true)
        })
    })

    it('sets anomalies to [] on IPC failure', async () => {
        ;(window.flintAPI.governance.getAnomalies as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('IPC error'))

        const { result } = renderHook(() => useGovernanceAnomalies())

        await waitFor(() => {
            // After error, anomalies stays []
            expect(result.current.anomalies).toEqual([])
        })
    })

    it('fetches provenance map when activeFilePath is set', async () => {
        useCanvasStore.setState({ activeFilePath: '/project/src/App.tsx' })
        const mockProvenance = { 'node-1': { ruleId: 'COLOR-001', source: 'ai' } }
        ;(window.flintAPI.governance.getProvenanceSummary as ReturnType<typeof vi.fn>)
            .mockResolvedValue(mockProvenance)

        const { result } = renderHook(() => useGovernanceAnomalies())

        await waitFor(() => {
            expect(result.current.provenanceMap).toEqual(mockProvenance)
        })
        expect(window.flintAPI.governance.getProvenanceSummary).toHaveBeenCalledWith('/project/src/App.tsx')
    })

    it('clears provenanceMap when activeFilePath becomes null', async () => {
        useCanvasStore.setState({ activeFilePath: '/project/src/App.tsx' })
        ;(window.flintAPI.governance.getProvenanceSummary as ReturnType<typeof vi.fn>)
            .mockResolvedValue({ 'node-1': { ruleId: 'COLOR-001' } })

        const { result } = renderHook(() => useGovernanceAnomalies())
        await waitFor(() => {
            expect(result.current.provenanceMap).not.toEqual({})
        })

        act(() => {
            useCanvasStore.setState({ activeFilePath: null })
        })

        await waitFor(() => {
            expect(result.current.provenanceMap).toEqual({})
        })
    })

    it('setAnomalyBannerDismissed toggles the dismissed flag', async () => {
        const { result } = renderHook(() => useGovernanceAnomalies())
        expect(result.current.anomalyBannerDismissed).toBe(false)

        act(() => {
            result.current.setAnomalyBannerDismissed(true)
        })

        expect(result.current.anomalyBannerDismissed).toBe(true)
    })

    it('does not throw when getAnomalies is missing from API', () => {
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                getAnomalies: undefined,
            },
        }

        expect(() => {
            renderHook(() => useGovernanceAnomalies())
        }).not.toThrow()
    })

    it('does not throw when getProvenanceSummary is missing from API', () => {
        useCanvasStore.setState({ activeFilePath: '/project/src/App.tsx' })
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                getProvenanceSummary: undefined,
            },
        }

        expect(() => {
            renderHook(() => useGovernanceAnomalies())
        }).not.toThrow()
    })
})
