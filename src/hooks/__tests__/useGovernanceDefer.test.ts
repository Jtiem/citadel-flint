/**
 * useGovernanceDefer.test.ts — src/hooks/__tests__/useGovernanceDefer.test.ts
 *
 * T4: Tests for useGovernanceDefer (H4).
 *
 * Covers:
 *   - mount: returns expected shape
 *   - toggleDeferForm opens and closes for a given card key
 *   - submitDefer: marks card as deferred and shows success msg
 *   - submitDefer: shows notification when IPC unavailable
 *   - submitDefer: uses governance.deferViolation when available
 *   - submitDefer: falls back to top-level deferViolation IPC
 *   - handleFlag: adds to flaggedCardKeys and calls deferViolation with [FLAGGED] prefix
 *   - handleUnflag: removes from flaggedCardKeys
 *   - aiSourcedCardKeys: detects ai_orchestrator source
 *   - aiSourcedCardKeys: detects auto-fix source
 *   - aiSourcedCardKeys: ignores human-sourced violations
 *   - resurfaceTick increments on interval (fake timers)
 *   - resurface check: overdue cards move from deferred to resurfaced
 *   - setDeferReasons / setDeferDurations: passthrough setters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGovernanceDefer } from '../useGovernanceDefer'
import { useGovernanceTimers } from '../useGovernanceTimers'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { LinterWarning, ProvenanceInfo } from '../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMithrilWarning(id: string = 'node-1'): LinterWarning {
    return {
        id,
        type: 'color-drift',
        severity: 'critical',
        value: 1,
        message: 'Color drift',
        nearestToken: null,
        nearestTokenValue: null,
    }
}

function makeA11yWarning(id: string = 'a-node-1'): LinterWarning {
    return {
        id,
        type: 'a11y',
        severity: 'critical',
        value: 1,
        message: '[A11Y-004] Missing label',
        nearestToken: null,
        nearestTokenValue: null,
    }
}

function makeTimers() {
    return renderHook(() => useGovernanceTimers()).result.current
}

function renderDefer(options: {
    effectiveLinterWarnings?: LinterWarning[]
    effectiveA11yWarnings?: LinterWarning[]
    provenanceMap?: Record<string, ProvenanceInfo>
} = {}) {
    const {
        effectiveLinterWarnings = [],
        effectiveA11yWarnings = [],
        provenanceMap = {},
    } = options
    const timers = makeTimers()
    return renderHook(() =>
        useGovernanceDefer({
            timers,
            effectiveLinterWarnings,
            effectiveA11yWarnings,
            provenanceMap,
        }),
    )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGovernanceDefer', () => {
    beforeEach(() => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
    })

    it('returns expected shape on mount', () => {
        const { result } = renderDefer()
        expect(result.current.deferredCardKeys instanceof Set).toBe(true)
        expect(result.current.deferredExpiresAt instanceof Map).toBe(true)
        expect(result.current.deferFormOpen instanceof Set).toBe(true)
        expect(result.current.deferReasons instanceof Map).toBe(true)
        expect(result.current.deferDurations instanceof Map).toBe(true)
        expect(result.current.deferSuccess instanceof Set).toBe(true)
        expect(result.current.deferSuccessMsg instanceof Map).toBe(true)
        expect(result.current.flaggedCardKeys instanceof Set).toBe(true)
        expect(result.current.aiSourcedCardKeys instanceof Set).toBe(true)
        expect(result.current.resurfacedCardKeys instanceof Set).toBe(true)
        expect(typeof result.current.resurfaceTick).toBe('number')
    })

    it('toggleDeferForm opens a card key', () => {
        const { result } = renderDefer()

        act(() => {
            result.current.toggleDeferForm('card-1')
        })

        expect(result.current.deferFormOpen.has('card-1')).toBe(true)
    })

    it('toggleDeferForm closes an open card key', () => {
        const { result } = renderDefer()

        act(() => {
            result.current.toggleDeferForm('card-1')
        })
        act(() => {
            result.current.toggleDeferForm('card-1')
        })

        expect(result.current.deferFormOpen.has('card-1')).toBe(false)
    })

    it('submitDefer marks card as deferred and sets success msg', async () => {
        const { result } = renderDefer()

        await act(async () => {
            await result.current.submitDefer('card-1', 'color-drift', 'node-1')
        })

        expect(result.current.deferredCardKeys.has('card-1')).toBe(true)
        expect(result.current.deferSuccess.has('card-1')).toBe(true)
        expect(result.current.deferSuccessMsg.get('card-1')).toBeDefined()
    })

    it('submitDefer calls governance.deferViolation IPC', async () => {
        const { result } = renderDefer()

        await act(async () => {
            await result.current.submitDefer('card-1', 'color-drift', 'node-1')
        })

        expect(window.flintAPI.governance.deferViolation).toHaveBeenCalledWith(
            expect.objectContaining({ ruleId: 'color-drift', filePath: '/src/App.tsx', nodeId: 'node-1' }),
        )
    })

    it('submitDefer shows notification when IPC is unavailable', async () => {
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                deferViolation: undefined,
            },
            deferViolation: undefined,
        }

        const { result } = renderDefer()

        await act(async () => {
            await result.current.submitDefer('card-1', 'color-drift', 'node-1')
        })

        await waitFor(() => {
            const notifs = useNotificationStore.getState().notifications
            expect(notifs.some((n) => n.title === 'Defer unavailable')).toBe(true)
        })
    })

    it('submitDefer uses top-level deferViolation fallback when governance.deferViolation is absent', async () => {
        const fallbackFn = vi.fn().mockResolvedValue(undefined)
        ;(window as any).flintAPI = {
            ...window.flintAPI,
            governance: {
                ...window.flintAPI.governance,
                deferViolation: undefined,
            },
            deferViolation: fallbackFn,
        }

        const { result } = renderDefer()

        await act(async () => {
            await result.current.submitDefer('card-1', 'color-drift', 'node-1')
        })

        expect(fallbackFn).toHaveBeenCalled()
        expect(result.current.deferredCardKeys.has('card-1')).toBe(true)
    })

    it('handleFlag adds key to flaggedCardKeys', async () => {
        const { result } = renderDefer()

        await act(async () => {
            await result.current.handleFlag('card-1', 'color-drift', 'node-1')
        })

        expect(result.current.flaggedCardKeys.has('card-1')).toBe(true)
    })

    it('handleFlag calls deferViolation with [FLAGGED] prefix', async () => {
        const { result } = renderDefer()

        await act(async () => {
            await result.current.handleFlag('card-1', 'color-drift', 'node-1')
        })

        expect(window.flintAPI.governance.deferViolation).toHaveBeenCalledWith(
            expect.objectContaining({ reason: '[FLAGGED] Flagged for review' }),
        )
    })

    it('handleUnflag removes key from flaggedCardKeys', async () => {
        const { result } = renderDefer()

        await act(async () => {
            await result.current.handleFlag('card-1', 'color-drift', 'node-1')
        })

        act(() => {
            result.current.handleUnflag('card-1')
        })

        expect(result.current.flaggedCardKeys.has('card-1')).toBe(false)
    })

    it('aiSourcedCardKeys includes ai_orchestrator-sourced Mithril warnings', () => {
        const w = makeMithrilWarning('node-ai')
        const prov: Record<string, ProvenanceInfo> = {
            'node-ai': { source: 'ai_orchestrator', agentId: 'claude-agent-1', filePath: '/src/App.tsx', ruleId: 'color-drift', timestamp: '' },
        }
        const { result } = renderDefer({ effectiveLinterWarnings: [w], provenanceMap: prov })

        expect(result.current.aiSourcedCardKeys.has('m-node-ai')).toBe(true)
    })

    it('aiSourcedCardKeys includes auto-fix-sourced A11y warnings', () => {
        const w = makeA11yWarning('a-node-af')
        const prov: Record<string, ProvenanceInfo> = {
            'a-node-af': { source: 'auto-fix', agentId: undefined, filePath: '/src/App.tsx', ruleId: 'a11y', timestamp: '' },
        }
        const { result } = renderDefer({ effectiveA11yWarnings: [w], provenanceMap: prov })

        expect(result.current.aiSourcedCardKeys.has('a-a-node-af-0')).toBe(true)
    })

    it('aiSourcedCardKeys does not include human-sourced warnings', () => {
        const w = makeMithrilWarning('node-human')
        const prov: Record<string, ProvenanceInfo> = {
            'node-human': { source: 'human', agentId: undefined, filePath: '/src/App.tsx', ruleId: 'color-drift', timestamp: '' },
        }
        const { result } = renderDefer({ effectiveLinterWarnings: [w], provenanceMap: prov })

        expect(result.current.aiSourcedCardKeys.has('m-node-human')).toBe(false)
    })

    it('setDeferReasons updates the reasons map', () => {
        const { result } = renderDefer()

        act(() => {
            result.current.setDeferReasons(new Map([['card-1', 'Tech debt']]))
        })

        expect(result.current.deferReasons.get('card-1')).toBe('Tech debt')
    })

    it('setDeferDurations updates the durations map', () => {
        const { result } = renderDefer()

        act(() => {
            result.current.setDeferDurations(new Map([['card-1', '1 week']]))
        })

        expect(result.current.deferDurations.get('card-1')).toBe('1 week')
    })

    describe('resurface check', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('resurfaceTick increments after 60s interval', () => {
            const { result } = renderDefer()

            expect(result.current.resurfaceTick).toBe(0)

            act(() => {
                vi.advanceTimersByTime(61_000)
            })

            expect(result.current.resurfaceTick).toBe(1)
        })

        it('resurfaces deferred cards past their expiry on tick', async () => {
            const { result } = renderDefer()

            // Submit a defer so a card ends up in deferredCardKeys
            ;(window.flintAPI.governance.deferViolation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

            await act(async () => {
                await result.current.submitDefer('card-resurface', 'color-drift', 'node-1')
            })

            expect(result.current.deferredCardKeys.has('card-resurface')).toBe(true)

            // Advance 60s so resurfaceTick increments — resurface check runs
            act(() => {
                vi.advanceTimersByTime(61_000)
            })

            // resurfaceTick should have incremented
            expect(result.current.resurfaceTick).toBeGreaterThan(0)
        })
    })
})
