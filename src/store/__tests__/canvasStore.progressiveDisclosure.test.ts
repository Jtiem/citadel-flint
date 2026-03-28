/**
 * canvasStore.progressiveDisclosure.test.ts
 *
 * OPP-10/11/12: Progressive tab disclosure slice — canvasStore.
 *
 * Updated for GLASS.1a — right sidebar consolidated to 3 tabs:
 *   governance, properties, tokens
 *
 * Covers:
 *   1. Default state — unlockedTabs contains 'governance' and 'properties'
 *   2. Default state — seenTabs contains 'governance' and 'properties'
 *   3. Default state — unlockedLeftTabs contains 'layers'
 *   4. Default state — hasUsedBreakpoint is false
 *   5. unlockTab adds a tab to unlockedTabs (new Set reference)
 *   6. unlockTab is idempotent — calling twice with same tab is a no-op
 *   7. markTabSeen adds a tab to seenTabs (new Set reference)
 *   8. markTabSeen is idempotent
 *   9. isTabUnlocked returns true for unlocked tabs, false otherwise
 *  10. isTabNew returns true when unlocked but not seen, false when seen
 *  11. unlockLeftTab adds a tab to unlockedLeftTabs
 *  12. isLeftTabUnlocked returns true for unlocked tabs, false otherwise
 *  13. markBreakpointUsed sets hasUsedBreakpoint to true
 *  14. setPreviewBreakpoint sets hasUsedBreakpoint when breakpoint is not desktop
 *  15. setPreviewBreakpoint does NOT set hasUsedBreakpoint when desktop
 *  16. cyclePreviewBreakpoint sets hasUsedBreakpoint when result is not desktop
 *  17. Empty state edge case — unlocking a tab that is not a RightTab still works
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore, DEFAULT_UNLOCKED_TABS, DEFAULT_UNLOCKED_LEFT_TABS } from '../canvasStore'

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // Reset relevant slices before each test.
    useCanvasStore.setState({
        unlockedTabs: new Set(DEFAULT_UNLOCKED_TABS),
        seenTabs: new Set(DEFAULT_UNLOCKED_TABS),
        unlockedLeftTabs: new Set(DEFAULT_UNLOCKED_LEFT_TABS),
        hasUsedBreakpoint: false,
        previewBreakpoint: 'desktop',
    })
    ;(window as unknown as Record<string, unknown>).flintAPI = {
        saveFile: vi.fn().mockResolvedValue(undefined),
        policy: { get: vi.fn().mockResolvedValue(null) },
    }
})

// ── Default state ─────────────────────────────────────────────────────────────

describe('canvasStore — progressive disclosure — default state', () => {
    it('unlockedTabs defaults to governance and properties', () => {
        const { unlockedTabs } = useCanvasStore.getState()
        expect(unlockedTabs.has('governance')).toBe(true)
        expect(unlockedTabs.has('properties')).toBe(true)
        expect(unlockedTabs.has('tokens')).toBe(false)
    })

    it('seenTabs defaults to governance and properties (pre-seen)', () => {
        const { seenTabs } = useCanvasStore.getState()
        expect(seenTabs.has('governance')).toBe(true)
        expect(seenTabs.has('properties')).toBe(true)
        expect(seenTabs.has('tokens')).toBe(false)
    })

    it('unlockedLeftTabs defaults to layers', () => {
        const { unlockedLeftTabs } = useCanvasStore.getState()
        expect(unlockedLeftTabs.has('layers')).toBe(true)
        expect(unlockedLeftTabs.has('assets')).toBe(false)
        expect(unlockedLeftTabs.has('files')).toBe(false)
    })

    it('hasUsedBreakpoint defaults to false', () => {
        expect(useCanvasStore.getState().hasUsedBreakpoint).toBe(false)
    })

    it('DEFAULT_UNLOCKED_TABS contains governance and properties', () => {
        expect(DEFAULT_UNLOCKED_TABS.has('governance')).toBe(true)
        expect(DEFAULT_UNLOCKED_TABS.has('properties')).toBe(true)
    })

    it('DEFAULT_UNLOCKED_LEFT_TABS contains layers', () => {
        expect(DEFAULT_UNLOCKED_LEFT_TABS.has('layers')).toBe(true)
    })
})

// ── unlockTab ─────────────────────────────────────────────────────────────────

describe('canvasStore — unlockTab', () => {
    it('adds a tab to unlockedTabs', () => {
        useCanvasStore.getState().unlockTab('tokens')
        expect(useCanvasStore.getState().unlockedTabs.has('tokens')).toBe(true)
    })

    it('produces a new Set reference (triggers Zustand re-render)', () => {
        const before = useCanvasStore.getState().unlockedTabs
        useCanvasStore.getState().unlockTab('tokens')
        const after = useCanvasStore.getState().unlockedTabs
        expect(after).not.toBe(before)
    })

    it('is idempotent — calling twice with the same tab leaves state unchanged', () => {
        useCanvasStore.getState().unlockTab('tokens')
        const ref1 = useCanvasStore.getState().unlockedTabs
        useCanvasStore.getState().unlockTab('tokens')
        const ref2 = useCanvasStore.getState().unlockedTabs
        // Same Set reference on no-op (state update returns early)
        expect(ref1).toBe(ref2)
    })

    it('does not remove existing tabs when unlocking a new one', () => {
        useCanvasStore.getState().unlockTab('tokens')
        const { unlockedTabs } = useCanvasStore.getState()
        expect(unlockedTabs.has('governance')).toBe(true)
        expect(unlockedTabs.has('properties')).toBe(true)
        expect(unlockedTabs.has('tokens')).toBe(true)
    })

    it('works with arbitrary string keys (edge case)', () => {
        useCanvasStore.getState().unlockTab('custom-feature-tab')
        expect(useCanvasStore.getState().unlockedTabs.has('custom-feature-tab')).toBe(true)
    })
})

// ── markTabSeen ───────────────────────────────────────────────────────────────

describe('canvasStore — markTabSeen', () => {
    it('adds a tab to seenTabs', () => {
        // First unlock the tab
        useCanvasStore.getState().unlockTab('tokens')
        useCanvasStore.getState().markTabSeen('tokens')
        expect(useCanvasStore.getState().seenTabs.has('tokens')).toBe(true)
    })

    it('produces a new Set reference on first call', () => {
        useCanvasStore.getState().unlockTab('tokens')
        const before = useCanvasStore.getState().seenTabs
        useCanvasStore.getState().markTabSeen('tokens')
        const after = useCanvasStore.getState().seenTabs
        expect(after).not.toBe(before)
    })

    it('is idempotent — calling twice with same tab returns same Set reference', () => {
        useCanvasStore.getState().markTabSeen('tokens')
        const ref1 = useCanvasStore.getState().seenTabs
        useCanvasStore.getState().markTabSeen('tokens')
        const ref2 = useCanvasStore.getState().seenTabs
        expect(ref1).toBe(ref2)
    })
})

// ── isTabUnlocked ─────────────────────────────────────────────────────────────

describe('canvasStore — isTabUnlocked', () => {
    it('returns true for default tabs (governance, properties)', () => {
        expect(useCanvasStore.getState().isTabUnlocked('governance')).toBe(true)
        expect(useCanvasStore.getState().isTabUnlocked('properties')).toBe(true)
    })

    it('returns false for locked tabs', () => {
        expect(useCanvasStore.getState().isTabUnlocked('tokens')).toBe(false)
    })

    it('returns true after unlockTab is called', () => {
        useCanvasStore.getState().unlockTab('tokens')
        expect(useCanvasStore.getState().isTabUnlocked('tokens')).toBe(true)
    })
})

// ── isTabNew ──────────────────────────────────────────────────────────────────

describe('canvasStore — isTabNew', () => {
    it('returns false for default tabs (pre-seen)', () => {
        // governance and properties are in seenTabs by default
        expect(useCanvasStore.getState().isTabNew('governance')).toBe(false)
        expect(useCanvasStore.getState().isTabNew('properties')).toBe(false)
    })

    it('returns true for a newly-unlocked tab that has not been seen', () => {
        useCanvasStore.getState().unlockTab('tokens')
        expect(useCanvasStore.getState().isTabNew('tokens')).toBe(true)
    })

    it('returns false after markTabSeen is called', () => {
        useCanvasStore.getState().unlockTab('tokens')
        expect(useCanvasStore.getState().isTabNew('tokens')).toBe(true)
        useCanvasStore.getState().markTabSeen('tokens')
        expect(useCanvasStore.getState().isTabNew('tokens')).toBe(false)
    })

    it('returns false for a tab that is not unlocked', () => {
        // Not unlocked and not seen — still false (must be unlocked to be "new")
        expect(useCanvasStore.getState().isTabNew('tokens')).toBe(false)
    })
})

// ── unlockLeftTab / isLeftTabUnlocked ─────────────────────────────────────────

describe('canvasStore — left panel progressive tabs', () => {
    it('unlockLeftTab adds a tab to unlockedLeftTabs', () => {
        useCanvasStore.getState().unlockLeftTab('assets')
        expect(useCanvasStore.getState().unlockedLeftTabs.has('assets')).toBe(true)
    })

    it('unlockLeftTab is idempotent', () => {
        useCanvasStore.getState().unlockLeftTab('assets')
        const ref1 = useCanvasStore.getState().unlockedLeftTabs
        useCanvasStore.getState().unlockLeftTab('assets')
        const ref2 = useCanvasStore.getState().unlockedLeftTabs
        expect(ref1).toBe(ref2)
    })

    it('isLeftTabUnlocked returns true for layers by default', () => {
        expect(useCanvasStore.getState().isLeftTabUnlocked('layers')).toBe(true)
    })

    it('isLeftTabUnlocked returns false for locked left tabs', () => {
        expect(useCanvasStore.getState().isLeftTabUnlocked('assets')).toBe(false)
        expect(useCanvasStore.getState().isLeftTabUnlocked('files')).toBe(false)
    })

    it('isLeftTabUnlocked returns true after unlockLeftTab', () => {
        useCanvasStore.getState().unlockLeftTab('files')
        expect(useCanvasStore.getState().isLeftTabUnlocked('files')).toBe(true)
    })

    it('unlockLeftTab preserves layers in the set', () => {
        useCanvasStore.getState().unlockLeftTab('assets')
        expect(useCanvasStore.getState().unlockedLeftTabs.has('layers')).toBe(true)
        expect(useCanvasStore.getState().unlockedLeftTabs.has('assets')).toBe(true)
    })
})

// ── hasUsedBreakpoint ─────────────────────────────────────────────────────────

describe('canvasStore — hasUsedBreakpoint (OPP-12)', () => {
    it('markBreakpointUsed sets hasUsedBreakpoint to true', () => {
        useCanvasStore.getState().markBreakpointUsed()
        expect(useCanvasStore.getState().hasUsedBreakpoint).toBe(true)
    })

    it('setPreviewBreakpoint sets hasUsedBreakpoint when breakpoint is mobile', () => {
        useCanvasStore.getState().setPreviewBreakpoint('mobile')
        expect(useCanvasStore.getState().hasUsedBreakpoint).toBe(true)
    })

    it('setPreviewBreakpoint sets hasUsedBreakpoint when breakpoint is tablet', () => {
        useCanvasStore.getState().setPreviewBreakpoint('tablet')
        expect(useCanvasStore.getState().hasUsedBreakpoint).toBe(true)
    })

    it('setPreviewBreakpoint does NOT set hasUsedBreakpoint when breakpoint is desktop', () => {
        useCanvasStore.getState().setPreviewBreakpoint('desktop')
        expect(useCanvasStore.getState().hasUsedBreakpoint).toBe(false)
    })

    it('cyclePreviewBreakpoint sets hasUsedBreakpoint when cycling to mobile', () => {
        // Starting at desktop, cycling up → mobile
        useCanvasStore.setState({ previewBreakpoint: 'desktop' })
        useCanvasStore.getState().cyclePreviewBreakpoint('up')
        expect(useCanvasStore.getState().hasUsedBreakpoint).toBe(true)
    })

    it('cyclePreviewBreakpoint does NOT set hasUsedBreakpoint when cycling to desktop', () => {
        // Starting at tablet, cycling up → desktop
        useCanvasStore.setState({ previewBreakpoint: 'tablet' })
        useCanvasStore.getState().cyclePreviewBreakpoint('up')
        expect(useCanvasStore.getState().previewBreakpoint).toBe('desktop')
        expect(useCanvasStore.getState().hasUsedBreakpoint).toBe(false)
    })
})
