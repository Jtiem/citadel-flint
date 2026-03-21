/**
 * LivePreview.test.tsx
 *
 * SEC.1 security hardening tests.
 *
 * Tests:
 *   SEC1-01 — iframe has sandbox="allow-scripts allow-forms" and NOT allow-same-origin
 *   SEC1-02 — handleMessage rejects events with a non-null, non-localhost origin
 *   SEC1-03 — handleMessage accepts events with origin 'null' (srcdoc)
 */

import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { LivePreview } from '../LivePreview'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'

// ── SEC1-01: iframe sandbox attribute ─────────────────────────────────────────

describe('LivePreview — SEC.1 iframe sandbox', () => {
    it('renders the iframe with sandbox="allow-scripts allow-forms"', async () => {
        useEditorStore.setState({ rawCode: 'export default function App() { return <div>hello</div> }' })

        render(<LivePreview />)

        await waitFor(() => {
            const iframe = document.querySelector('iframe[title="Live Preview"]')
            expect(iframe).not.toBeNull()
        })

        const iframe = document.querySelector('iframe[title="Live Preview"]')
        expect(iframe).not.toBeNull()
        expect(iframe!.getAttribute('sandbox')).toBe('allow-scripts allow-forms')
    })

    it('does not include allow-same-origin in the sandbox attribute', async () => {
        useEditorStore.setState({ rawCode: 'export default function App() { return <div>hello</div> }' })

        render(<LivePreview />)

        await waitFor(() => {
            const iframe = document.querySelector('iframe[title="Live Preview"]')
            expect(iframe).not.toBeNull()
        })

        const iframe = document.querySelector('iframe[title="Live Preview"]')
        const sandboxValue = iframe!.getAttribute('sandbox') ?? ''
        expect(sandboxValue).not.toContain('allow-same-origin')
    })
})

// ── SEC1-02: postMessage origin rejection ─────────────────────────────────────

describe('LivePreview — SEC.1 postMessage origin validation', () => {
    it('ignores MessageEvent from a non-null, non-localhost origin', async () => {
        useEditorStore.setState({ rawCode: '', selectedNodeId: null })
        useCanvasStore.setState({ canvasMode: 'design' })

        render(<LivePreview />)

        // Dispatch a malicious message from an external origin.
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'CANVAS_CLICK', id: 'malicious-node' },
                origin: 'https://evil.example.com',
            }),
        )

        // The store should NOT have been updated with the attacker's node ID.
        const { selectedNodeId } = useEditorStore.getState()
        expect(selectedNodeId).not.toBe('malicious-node')
    })

    it('ignores MessageEvent from a null-string that is NOT the opaque null origin', async () => {
        // 'null' as a non-empty non-localhost string that doesn't equal the literal 'null'
        useEditorStore.setState({ rawCode: '', selectedNodeId: null })
        useCanvasStore.setState({ canvasMode: 'design' })

        render(<LivePreview />)

        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'CANVAS_CLICK', id: 'another-bad-node' },
                origin: 'https://null.evil.com',
            }),
        )

        const { selectedNodeId } = useEditorStore.getState()
        expect(selectedNodeId).not.toBe('another-bad-node')
    })

    // ── SEC1-03: postMessage from srcdoc origin ('null') is accepted ───────────

    it('processes MessageEvent with srcdoc origin ("null") in design mode', async () => {
        useEditorStore.setState({ rawCode: '', selectedNodeId: null })
        useCanvasStore.setState({ canvasMode: 'design' })

        render(<LivePreview />)

        // srcdoc iframes report origin as the literal string 'null' per HTML spec.
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'CANVAS_CLICK', id: 'flint-test-node' },
                origin: 'null',
            }),
        )

        await waitFor(() => {
            const { selectedNodeId } = useEditorStore.getState()
            expect(selectedNodeId).toBe('flint-test-node')
        })
    })

    it('processes MessageEvent with a localhost origin in design mode', async () => {
        useEditorStore.setState({ rawCode: '', selectedNodeId: null })
        useCanvasStore.setState({ canvasMode: 'design' })

        render(<LivePreview />)

        // Vite preview server sends messages with origin http://localhost:<PORT>.
        window.dispatchEvent(
            new MessageEvent('message', {
                data: { type: 'CANVAS_CLICK', id: 'vite-preview-node' },
                origin: 'http://localhost:5173',
            }),
        )

        await waitFor(() => {
            const { selectedNodeId } = useEditorStore.getState()
            expect(selectedNodeId).toBe('vite-preview-node')
        })
    })
})
