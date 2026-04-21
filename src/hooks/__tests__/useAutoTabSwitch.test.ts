/**
 * useAutoTabSwitch.test.ts — src/hooks/__tests__/useAutoTabSwitch.test.ts
 *
 * Covers:
 *   1. null→id transition switches rightTab to 'properties' (userOverrodeTab=false)
 *   2. null→id does NOT switch when userOverrodeTab=true
 *   3. id→null resets userOverrodeTab to false (via canvasStore)
 *   4. id→different-id does NOT switch rightTab
 *   5. Multiple selections after override blocked until deselect clears it
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoTabSwitch } from '../useAutoTabSwitch'
import { useCanvasStore } from '../../store/canvasStore'

// Reset the canvasStore before each test so tests are fully isolated.
beforeEach(() => {
    useCanvasStore.setState({
        activeSelection: null,
        rightTab: 'governance',
        userOverrodeTab: false,
    })
})

describe('useAutoTabSwitch', () => {
    it('null→id transition switches rightTab to "properties" when userOverrodeTab is false', () => {
        const { result: _ } = renderHook(() => useAutoTabSwitch())

        expect(useCanvasStore.getState().rightTab).toBe('governance')

        act(() => {
            useCanvasStore.getState().setActiveSelection('div:5:2')
        })

        expect(useCanvasStore.getState().rightTab).toBe('properties')
    })

    it('null→id does NOT switch rightTab when userOverrodeTab is true', () => {
        useCanvasStore.setState({ userOverrodeTab: true, rightTab: 'tokens' })

        renderHook(() => useAutoTabSwitch())

        act(() => {
            useCanvasStore.setState({ activeSelection: 'div:5:2' })
        })

        expect(useCanvasStore.getState().rightTab).toBe('tokens')
    })

    it('id→null resets userOverrodeTab to false', () => {
        useCanvasStore.setState({
            activeSelection: 'div:5:2',
            userOverrodeTab: true,
            rightTab: 'tokens',
        })

        renderHook(() => useAutoTabSwitch())

        act(() => {
            useCanvasStore.getState().setActiveSelection(null)
        })

        expect(useCanvasStore.getState().userOverrodeTab).toBe(false)
    })

    it('id→null does NOT switch rightTab (no auto-switch on deselect)', () => {
        useCanvasStore.setState({
            activeSelection: 'div:5:2',
            rightTab: 'tokens',
            userOverrodeTab: false,
        })

        renderHook(() => useAutoTabSwitch())

        act(() => {
            useCanvasStore.getState().setActiveSelection(null)
        })

        // Tab stays as tokens — deselect does not switch tabs
        expect(useCanvasStore.getState().rightTab).toBe('tokens')
    })

    it('id→different-id does NOT re-switch rightTab', () => {
        useCanvasStore.setState({
            activeSelection: 'div:5:2',
            rightTab: 'tokens',
            userOverrodeTab: false,
        })

        renderHook(() => useAutoTabSwitch())

        act(() => {
            // Direct setState simulates a new node click without going through
            // null; this covers the id→id' (no-null) transition case.
            useCanvasStore.setState({ activeSelection: 'h1:8:4' })
        })

        // No null→id transition occurred, so tab stays unchanged
        expect(useCanvasStore.getState().rightTab).toBe('tokens')
    })

    it('after deselect clears override, next null→id selection auto-switches again', () => {
        useCanvasStore.setState({
            activeSelection: 'div:5:2',
            userOverrodeTab: true,
            rightTab: 'tokens',
        })

        renderHook(() => useAutoTabSwitch())

        // Deselect resets override
        act(() => {
            useCanvasStore.getState().setActiveSelection(null)
        })

        expect(useCanvasStore.getState().userOverrodeTab).toBe(false)

        // Now re-select — should auto-switch
        act(() => {
            useCanvasStore.getState().setActiveSelection('span:3:1')
        })

        expect(useCanvasStore.getState().rightTab).toBe('properties')
    })

    it('override blocks multiple consecutive selections from switching', () => {
        useCanvasStore.setState({
            activeSelection: null,
            userOverrodeTab: true,
            rightTab: 'tokens',
        })

        renderHook(() => useAutoTabSwitch())

        // Five selection changes while override is active
        for (const id of ['a:1:1', null, 'b:2:2', null, 'c:3:3'] as (string | null)[]) {
            act(() => {
                useCanvasStore.setState({ activeSelection: id })
            })
        }

        // Tab should still be 'tokens' — override prevented every auto-switch
        // (override itself is not reset by setState directly, only by
        //  setActiveSelection(null) which we did not call here)
        expect(useCanvasStore.getState().rightTab).toBe('tokens')
    })
})
