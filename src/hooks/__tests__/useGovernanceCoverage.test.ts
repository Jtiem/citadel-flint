/**
 * useGovernanceCoverage.test.ts
 *
 * Tests for H12: compliance coverage + config inheritance data.
 *
 * Boundaries:
 *   - Returns empty arrays and false isLoadingConfig initially
 *   - Reflects jurisdictionCoverage from governanceStore
 *   - Returns [] when jurisdictionCoverage is null
 *   - Reflects inheritanceChain from governanceStore
 *   - Reflects isLoadingConfig from governanceStore
 *   - Updates reactively when store changes
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGovernanceCoverage } from '../useGovernanceCoverage'
import { useGovernanceStore } from '../../store/governanceStore'

describe('useGovernanceCoverage', () => {
    it('returns empty jurisdictionCoverage when store is null', () => {
        useGovernanceStore.setState({ jurisdictionCoverage: null })
        const { result } = renderHook(() => useGovernanceCoverage())
        expect(result.current.jurisdictionCoverage).toEqual([])
    })

    it('returns empty jurisdictionCoverage when store is empty array', () => {
        useGovernanceStore.setState({ jurisdictionCoverage: [] as unknown as Record<string, { covered: number; total: number }> })
        const { result } = renderHook(() => useGovernanceCoverage())
        expect(result.current.jurisdictionCoverage).toEqual([])
    })

    it('reflects jurisdictionCoverage from governanceStore', () => {
        const coverage = [
            { jurisdiction: 'WCAG 2.1 AA', covered: true, packId: '@flint/wcag-aa' },
        ]
        useGovernanceStore.setState({ jurisdictionCoverage: coverage as never })
        const { result } = renderHook(() => useGovernanceCoverage())
        expect(result.current.jurisdictionCoverage).toEqual(coverage)
    })

    it('returns empty inheritanceChain initially', () => {
        const { result } = renderHook(() => useGovernanceCoverage())
        expect(result.current.inheritanceChain).toEqual([])
    })

    it('reflects inheritanceChain from governanceStore', () => {
        useGovernanceStore.setState({ inheritanceChain: ['@flint/wcag-aa', '@flint/healthcare'] })
        const { result } = renderHook(() => useGovernanceCoverage())
        expect(result.current.inheritanceChain).toEqual(['@flint/wcag-aa', '@flint/healthcare'])
    })

    it('reflects isLoadingConfig from governanceStore', () => {
        useGovernanceStore.setState({ isLoadingConfig: true })
        const { result } = renderHook(() => useGovernanceCoverage())
        expect(result.current.isLoadingConfig).toBe(true)
    })

    it('isLoadingConfig=false by default', () => {
        const { result } = renderHook(() => useGovernanceCoverage())
        expect(result.current.isLoadingConfig).toBe(false)
    })

    it('updates reactively when store jurisdictionCoverage changes', () => {
        useGovernanceStore.setState({ jurisdictionCoverage: null })
        const { result } = renderHook(() => useGovernanceCoverage())
        expect(result.current.jurisdictionCoverage).toEqual([])

        act(() => {
            useGovernanceStore.setState({
                jurisdictionCoverage: [{ jurisdiction: 'HIPAA', covered: false, packId: '@flint/healthcare' }] as never,
            })
        })

        expect(result.current.jurisdictionCoverage).toHaveLength(1)
    })

    it('updates reactively when isLoadingConfig changes', () => {
        const { result } = renderHook(() => useGovernanceCoverage())
        expect(result.current.isLoadingConfig).toBe(false)

        act(() => {
            useGovernanceStore.setState({ isLoadingConfig: true })
        })

        expect(result.current.isLoadingConfig).toBe(true)
    })
})
