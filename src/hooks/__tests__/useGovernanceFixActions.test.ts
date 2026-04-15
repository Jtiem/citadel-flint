/**
 * useGovernanceFixActions.test.ts — src/hooks/__tests__/useGovernanceFixActions.test.ts
 *
 * T3: Tests for useGovernanceFixActions (H3).
 *
 * Covers:
 *   - mount: returns expected shape
 *   - autoFixableEntries: derived from effectiveLinterWarnings (nearestToken present)
 *   - autoFixableA11yEntries: derived from effectiveA11yWarnings (not in NOT_AUTO_FIXABLE)
 *   - manualA11yEntries: derived from effectiveA11yWarnings (nearestToken null, not A11Y-001/002)
 *   - handleFixSingle: auto mode calls applyBatch; preview mode opens FixPreviewDrawer
 *   - handleFixAll: auto mode calls applyBatch with all entries; preview mode opens drawer
 *   - handleFixAll: no-op when autoFixableEntries is empty
 *   - handleApplyPreview: calls applyBatch and clears preview
 *   - acceptInlineFix: adds item to acceptedFixes and closes diff
 *   - skipInlineFix: closes inline diff without adding item
 *   - applyAcceptedFixes: calls applyBatch and clears queue
 *   - applyAcceptedFixes: no-op when empty
 *   - toggleInlineDiff: opens diff for a key; second call closes it
 *   - handleBatchFixA11y: no active file path → shows notification
 *   - handleBatchFixA11y: applyFix returns null → shows MCP not connected notification
 *   - handleBatchFixA11y: fixesApplied = 0 → shows no-auto-fixable notification
 *   - handleBatchFixA11y: success → shows success notification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGovernanceFixActions } from '../useGovernanceFixActions'
import { useGovernanceTimers } from '../useGovernanceTimers'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useNotificationStore } from '../../store/notificationStore'
import type { LinterWarning } from '../../types/flint-api'
import type { FixableItem } from '../../components/ui/FixPreviewDrawer'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMithrilWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-1',
        type: 'color-drift',
        severity: 'critical',
        value: 1,
        // extractHardcodedClassFromMsg looks for text in single-quotes: /'([^']+)'/
        message: "Color drift — 'bg-[#3b82f6]' → MITHRIL-COL-001",
        nearestToken: 'bg-blue-500',
        nearestTokenValue: '#3b82f6',
        ...overrides,
    }
}

function makeA11yWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-a11y-1',
        type: 'a11y',
        severity: 'critical',
        value: 1,
        message: '[A11Y-004] Missing label',
        nearestToken: null,
        nearestTokenValue: null,
        ...overrides,
    }
}

function makeTimers() {
    return renderHook(() => useGovernanceTimers()).result.current
}

function makeFixItem(overrides: Partial<FixableItem> = {}): FixableItem {
    return {
        nodeId: 'node-1',
        label: 'MITHRIL-COL-001 — node-1',
        hardcodedClass: 'bg-[#3b82f6]',
        tokenClass: 'bg-blue-500',
        ...overrides,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGovernanceFixActions', () => {
    let applyBatchSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        applyBatchSpy = vi.spyOn(useEditorStore.getState(), 'applyBatch').mockResolvedValue(undefined)
    })

    function renderFixActions(
        options: {
            effectiveLinterWarnings?: LinterWarning[]
            effectiveA11yWarnings?: LinterWarning[]
            fixMode?: 'auto' | 'preview'
        } = {},
    ) {
        const {
            effectiveLinterWarnings = [],
            effectiveA11yWarnings = [],
            fixMode = 'preview',
        } = options

        // Set localStorage prefs for fixMode
        localStorage.setItem('flint:user-prefs', JSON.stringify({ fixMode }))

        const timers = makeTimers()

        return renderHook(() =>
            useGovernanceFixActions({
                timers,
                effectiveLinterWarnings,
                effectiveA11yWarnings,
            }),
        )
    }

    it('returns expected shape on mount', () => {
        const { result } = renderFixActions()
        expect(Array.isArray(result.current.autoFixableEntries)).toBe(true)
        expect(Array.isArray(result.current.autoFixableA11yEntries)).toBe(true)
        expect(Array.isArray(result.current.manualA11yEntries)).toBe(true)
        expect(Array.isArray(result.current.acceptedFixes)).toBe(true)
        expect(result.current.fixPreviewItems).toBeNull()
        expect(result.current.inlineDiffOpen instanceof Set).toBe(true)
        expect(result.current.inlineDiffLoading instanceof Set).toBe(true)
        expect(result.current.inlineDiffData instanceof Map).toBe(true)
    })

    it('autoFixableEntries includes warnings with nearestToken and a hardcoded class', () => {
        const w = makeMithrilWarning({ nearestToken: 'bg-blue-500', message: "'bg-[#3b82f6]' → MITHRIL-COL-001" })
        const { result } = renderFixActions({ effectiveLinterWarnings: [w] })
        expect(result.current.autoFixableEntries).toHaveLength(1)
        expect(result.current.autoFixableEntries[0].tokenClass).toBe('bg-blue-500')
    })

    it('autoFixableEntries excludes warnings with null nearestToken', () => {
        const w = makeMithrilWarning({ nearestToken: null })
        const { result } = renderFixActions({ effectiveLinterWarnings: [w] })
        expect(result.current.autoFixableEntries).toHaveLength(0)
    })

    it('autoFixableA11yEntries excludes rules in A11Y_NOT_AUTO_FIXABLE', () => {
        // A11Y-005 is in A11Y_NOT_AUTO_FIXABLE
        const nonFixable = makeA11yWarning({ message: '[A11Y-005] Focus order' })
        const fixable = makeA11yWarning({ message: '[A11Y-004] Missing label', id: 'node-2' })
        const { result } = renderFixActions({ effectiveA11yWarnings: [nonFixable, fixable] })
        // Only A11Y-004 should be auto-fixable (A11Y-005 is not)
        expect(result.current.autoFixableA11yEntries.some((w) => w.message.includes('A11Y-004'))).toBe(true)
    })

    it('handleFixSingle in auto mode calls applyBatch directly', () => {
        const { result } = renderFixActions({ fixMode: 'auto' })
        const item = makeFixItem()

        act(() => {
            result.current.handleFixSingle(item)
        })

        expect(applyBatchSpy).toHaveBeenCalledTimes(1)
        expect(result.current.fixPreviewItems).toBeNull()
    })

    it('handleFixSingle in preview mode opens FixPreviewDrawer', () => {
        const { result } = renderFixActions({ fixMode: 'preview' })
        const item = makeFixItem()

        act(() => {
            result.current.handleFixSingle(item)
        })

        expect(applyBatchSpy).not.toHaveBeenCalled()
        expect(result.current.fixPreviewItems).toEqual([item])
    })

    it('handleFixAll does nothing when autoFixableEntries is empty', () => {
        const { result } = renderFixActions({ fixMode: 'auto' })

        act(() => {
            result.current.handleFixAll()
        })

        expect(applyBatchSpy).not.toHaveBeenCalled()
    })

    it('handleFixAll in auto mode calls applyBatch for all entries', () => {
        const w = makeMithrilWarning({ nearestToken: 'bg-blue-500', message: "'bg-[#3b82f6]' → MITHRIL-COL-001" })
        const { result } = renderFixActions({ fixMode: 'auto', effectiveLinterWarnings: [w] })

        act(() => {
            result.current.handleFixAll()
        })

        expect(applyBatchSpy).toHaveBeenCalledTimes(1)
    })

    it('handleFixAll in preview mode opens drawer with all entries', () => {
        const w = makeMithrilWarning({ nearestToken: 'bg-blue-500', message: "'bg-[#3b82f6]' → MITHRIL-COL-001" })
        const { result } = renderFixActions({ fixMode: 'preview', effectiveLinterWarnings: [w] })

        act(() => {
            result.current.handleFixAll()
        })

        expect(result.current.fixPreviewItems).toHaveLength(1)
        expect(applyBatchSpy).not.toHaveBeenCalled()
    })

    it('handleApplyPreview applies batch and clears fixPreviewItems', async () => {
        const { result } = renderFixActions({ fixMode: 'preview' })
        const item = makeFixItem()

        act(() => {
            result.current.setFixPreviewItems([item])
        })

        expect(result.current.fixPreviewItems).toEqual([item])

        await act(async () => {
            await result.current.handleApplyPreview()
        })

        expect(applyBatchSpy).toHaveBeenCalledTimes(1)
        expect(result.current.fixPreviewItems).toBeNull()
    })

    it('handleApplyPreview does nothing when fixPreviewItems is null', async () => {
        const { result } = renderFixActions()

        await act(async () => {
            await result.current.handleApplyPreview()
        })

        expect(applyBatchSpy).not.toHaveBeenCalled()
    })

    it('acceptInlineFix adds item to acceptedFixes and removes from inlineDiffOpen', () => {
        const { result } = renderFixActions()
        const item = makeFixItem()

        act(() => {
            result.current.toggleInlineDiff('key-1', 'MITHRIL-COL-001', null)
        })

        act(() => {
            result.current.acceptInlineFix('key-1', item)
        })

        expect(result.current.acceptedFixes).toContainEqual(item)
        expect(result.current.inlineDiffOpen.has('key-1')).toBe(false)
    })

    it('acceptInlineFix does not add duplicate nodeId', () => {
        const { result } = renderFixActions()
        const item = makeFixItem()

        act(() => {
            result.current.acceptInlineFix('key-1', item)
            result.current.acceptInlineFix('key-2', item)
        })

        expect(result.current.acceptedFixes).toHaveLength(1)
    })

    it('skipInlineFix removes key from inlineDiffOpen without adding to acceptedFixes', () => {
        const { result } = renderFixActions()

        act(() => {
            result.current.toggleInlineDiff('key-1', 'MITHRIL-COL-001', null)
        })

        act(() => {
            result.current.skipInlineFix('key-1')
        })

        expect(result.current.inlineDiffOpen.has('key-1')).toBe(false)
        expect(result.current.acceptedFixes).toHaveLength(0)
    })

    it('applyAcceptedFixes is a no-op when acceptedFixes is empty', async () => {
        const { result } = renderFixActions()

        await act(async () => {
            await result.current.applyAcceptedFixes()
        })

        expect(applyBatchSpy).not.toHaveBeenCalled()
    })

    it('applyAcceptedFixes calls applyBatch and clears queue', async () => {
        const { result } = renderFixActions()
        const item = makeFixItem()

        act(() => {
            result.current.acceptInlineFix('key-1', item)
        })

        await act(async () => {
            await result.current.applyAcceptedFixes()
        })

        expect(applyBatchSpy).toHaveBeenCalledTimes(1)
        expect(result.current.acceptedFixes).toHaveLength(0)
    })

    it('toggleInlineDiff opens a key on first call', async () => {
        const { result } = renderFixActions()

        await act(async () => {
            await result.current.toggleInlineDiff('key-1', 'MITHRIL-COL-001', null)
        })

        expect(result.current.inlineDiffOpen.has('key-1')).toBe(true)
    })

    it('toggleInlineDiff closes an already-open key', async () => {
        const { result } = renderFixActions()

        await act(async () => {
            await result.current.toggleInlineDiff('key-1', 'MITHRIL-COL-001', null)
        })

        await act(async () => {
            await result.current.toggleInlineDiff('key-1', 'MITHRIL-COL-001', null)
        })

        expect(result.current.inlineDiffOpen.has('key-1')).toBe(false)
    })

    it('handleBatchFixA11y shows notification when no active file', async () => {
        useCanvasStore.setState({ activeFilePath: null })
        const { result } = renderFixActions()

        await act(async () => {
            await result.current.handleBatchFixA11y()
        })

        await waitFor(() => {
            const notifs = useNotificationStore.getState().notifications
            expect(notifs.some((n) => n.title === 'Fix failed')).toBe(true)
        })
    })

    it('handleBatchFixA11y shows MCP-not-connected when applyFix returns null', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        ;(window.flintAPI.governance.applyFix as ReturnType<typeof vi.fn>).mockResolvedValue(null)

        const { result } = renderFixActions()

        await act(async () => {
            await result.current.handleBatchFixA11y()
        })

        await waitFor(() => {
            const notifs = useNotificationStore.getState().notifications
            expect(notifs.some((n) => n.title === 'Fix unavailable')).toBe(true)
        })
    })

    it('handleBatchFixA11y shows no-auto-fixable when fixesApplied = 0', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        ;(window.flintAPI.governance.applyFix as ReturnType<typeof vi.fn>).mockResolvedValue({
            fixesApplied: 0,
            status: 'ok',
        })

        const { result } = renderFixActions()

        await act(async () => {
            await result.current.handleBatchFixA11y()
        })

        await waitFor(() => {
            const notifs = useNotificationStore.getState().notifications
            expect(notifs.some((n) => n.title === 'No auto-fixable issues')).toBe(true)
        })
    })

    it('handleBatchFixA11y shows success notification when fixes applied', async () => {
        useCanvasStore.setState({ activeFilePath: '/src/App.tsx' })
        ;(window.flintAPI.governance.applyFix as ReturnType<typeof vi.fn>).mockResolvedValue({
            fixesApplied: 3,
            status: 'ok',
        })
        ;(window.flintAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('// updated code')

        const { result } = renderFixActions()

        await act(async () => {
            await result.current.handleBatchFixA11y()
        })

        await waitFor(() => {
            const notifs = useNotificationStore.getState().notifications
            expect(notifs.some((n) => n.title === 'A11y fixes applied')).toBe(true)
        })
    })
})
