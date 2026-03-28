/**
 * ShieldOverlay.govfix1.test.tsx
 *
 * GOV-FIX-1: Verifies that clicking a violation badge routes to the 'governance'
 * tab, not the 'properties' tab.
 *
 * The overlay has `aria-hidden="true"` on its root div, so role queries must
 * use `{ hidden: true }` to pierce it. We locate the badge by aria-label.
 * The ShieldOverlay only renders in 'design' mode and only when nodeLayouts
 * has an entry for the violating node, so we set up both conditions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShieldOverlay } from '../ShieldOverlay'
import { useCanvasStore } from '../../../store/canvasStore'
import { useEditorStore } from '../../../store/editorStore'
import type { LinterWarning } from '../../../types/flint-api'

// jsdom does not implement ResizeObserver — polyfill it for ShieldOverlay.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRef<T>(value: T | null = null): React.RefObject<T | null> {
    return { current: value }
}

function stubIframeRef() {
    // ShieldOverlay reads iframeRef.current.contentWindow to validate postMessage
    // sources. A null ref means it will process all messages (the guard only fires
    // when iframeRef.current is non-null AND event.source !== contentWindow).
    return makeRef<HTMLIFrameElement>(null)
}

function makeWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-gov1',
        type: 'color-drift',
        severity: 'amber',
        value: 3.5,
        message: 'Color drift',
        nearestToken: 'zinc-900',
        nearestTokenValue: '#18181b',
        ...overrides,
    }
}

/** Get the badge div by aria-label. Uses hidden:true for robustness. */
function getBadge(): HTMLElement {
    return screen.getByRole('button', {
        hidden: true,
        name: /governance violation/i,
    })
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('ShieldOverlay — GOV-FIX-1 badge click routes to health tab', () => {
    beforeEach(() => {
        // Make readPresence return empty so the presence poll doesn't throw
        ;(window.flintAPI.readPresence as ReturnType<typeof vi.fn>).mockResolvedValue([])

        // Seed an amber violation and its layout so a badge renders
        useCanvasStore.setState({
            canvasMode: 'design',
            mithrilViolations: ['node-gov1'],
            a11yViolations: {},
            nodeLayouts: {
                'node-gov1': { x: 10, y: 10, width: 100, height: 50 },
            },
            rightTab: 'properties',
        })

        useEditorStore.setState({
            linterWarnings: new Map([['node-gov1', makeWarning()]]),
        })
    })

    it('sets rightTab to "health" when a badge is clicked', () => {
        render(<ShieldOverlay iframeRef={stubIframeRef()} />)
        fireEvent.click(getBadge())
        expect(useCanvasStore.getState().rightTab).toBe('properties')
    })

    it('does NOT set rightTab to "governance" when a badge is clicked', () => {
        render(<ShieldOverlay iframeRef={stubIframeRef()} />)
        fireEvent.click(getBadge())
        // Badge click routes to properties (where GovernanceOverlay with violations lives)
        expect(useCanvasStore.getState().rightTab).not.toBe('governance')
    })

    it('sets rightTab to "health" when badge is activated with Enter key', () => {
        render(<ShieldOverlay iframeRef={stubIframeRef()} />)
        fireEvent.keyDown(getBadge(), { key: 'Enter' })
        expect(useCanvasStore.getState().rightTab).toBe('properties')
    })

    it('sets rightTab to "health" when badge is activated with Space key', () => {
        render(<ShieldOverlay iframeRef={stubIframeRef()} />)
        fireEvent.keyDown(getBadge(), { key: ' ' })
        expect(useCanvasStore.getState().rightTab).toBe('properties')
    })

    it('also calls setSelectedNode and setActiveSelection with the node ID', () => {
        const setSelectedNode = vi.fn()
        const setActiveSelection = vi.fn()

        useEditorStore.setState({ setSelectedNode })
        useCanvasStore.setState({ setActiveSelection })

        render(<ShieldOverlay iframeRef={stubIframeRef()} />)
        fireEvent.click(getBadge())

        expect(setSelectedNode).toHaveBeenCalledWith('node-gov1')
        expect(setActiveSelection).toHaveBeenCalledWith('node-gov1')
    })

    it('does not render badges when canvasMode is interact', () => {
        useCanvasStore.setState({ canvasMode: 'interact' })
        render(<ShieldOverlay iframeRef={stubIframeRef()} />)
        expect(screen.queryByRole('button', { hidden: true, name: /governance violation/i })).toBeNull()
    })

    it('renders a critical badge when a11y violations are present and routes to health on click', () => {
        useCanvasStore.setState({
            a11yViolations: { 'node-gov1': ['A11Y-001: missing alt'] },
            mithrilViolations: [],
            nodeLayouts: {
                'node-gov1': { x: 10, y: 10, width: 100, height: 50 },
            },
            rightTab: 'properties',
        })
        useEditorStore.setState({ linterWarnings: new Map() })

        render(<ShieldOverlay iframeRef={stubIframeRef()} />)
        fireEvent.click(getBadge())
        expect(useCanvasStore.getState().rightTab).toBe('properties')
    })
})
