/**
 * LivePreview.carddrop.test.tsx
 *
 * Phase CV2.5: Drag-to-Insert (card -> LivePreview -> AST)
 *
 * Tests:
 *   LP-CD-01 — Drop zone div renders with testid
 *   LP-CD-02 — onDrop with flint-component-card calls applyBatch with injectComponent op
 *   LP-CD-03 — onDrop with flint-component-card uses correct jsxSnippet and importSnippet
 *   LP-CD-04 — onDrop with malformed JSON does not throw
 *   LP-CD-05 — onDrop with flint-component-card is no-op when visualTree is empty
 *   LP-CD-06 — Drop indicator class applies on dragEnter with card MIME
 *   LP-CD-07 — Drop indicator class clears on dragLeave
 *   LP-CD-08 — Drop indicator class clears on drop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LivePreview } from '../LivePreview'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a minimal DataTransfer stub for drag events. */
function makeDataTransfer(overrides: Partial<{
    types: string[]
    data: Record<string, string>
}> = {}): DataTransfer {
    const data: Record<string, string> = overrides.data ?? {}
    const types: string[] = overrides.types ?? Object.keys(data)
    return {
        types,
        getData: (type: string) => data[type] ?? '',
        setData: vi.fn(),
        clearData: vi.fn(),
        effectAllowed: 'copy',
        dropEffect: 'copy',
        items: [],
        files: [],
    } as unknown as DataTransfer
}

/** Serialized component card payload matching the format set by ComponentCardNode. */
function makeCardPayload(overrides: Partial<{ name: string; importPath: string; filePath: string }> = {}) {
    return JSON.stringify({
        name: 'Button',
        importPath: '@/components/ui/Button',
        filePath: '/project/src/components/ui/Button.tsx',
        ...overrides,
    })
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
    // Default canvas mode is 'design' so drops are accepted
    useCanvasStore.setState({
        canvasMode: 'design',
        autopilotEnabled: false,
        governedCode: null,
        governedFixCount: 0,
    } as Parameters<typeof useCanvasStore.setState>[0])

    useEditorStore.setState({
        rawCode: 'export default function App() { return <div /> }',
        visualTree: [{ id: 'root-node-id', type: 'div', children: [], props: {} }],
    } as unknown as Parameters<typeof useEditorStore.setState>[0])
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LivePreview — CV2.5 Card Drop', () => {
    // LP-CD-01: Drop zone has testid
    it('LP-CD-01: drop zone div renders with data-testid', () => {
        render(<LivePreview />)
        expect(screen.getByTestId('live-preview-drop-zone')).toBeDefined()
    })

    // LP-CD-02: card drop calls applyBatch with injectComponent op
    it('LP-CD-02: dropping a component card calls applyBatch with injectComponent op', () => {
        const applyBatch = vi.fn()
        useEditorStore.setState({
            applyBatch,
            visualTree: [{ id: 'root-node-id', type: 'div', children: [], props: {} }],
        } as unknown as Parameters<typeof useEditorStore.setState>[0])

        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        const payload = makeCardPayload()
        const dt = makeDataTransfer({
            types: ['application/flint-component-card'],
            data: { 'application/flint-component-card': payload },
        })

        fireEvent.drop(dropZone, { dataTransfer: dt })

        expect(applyBatch).toHaveBeenCalledOnce()
        const [mutations] = applyBatch.mock.calls[0] as [Array<{ op: string }>]
        expect(mutations[0].op).toBe('injectComponent')
    })

    // LP-CD-03: card drop uses correct jsxSnippet and importSnippet
    it('LP-CD-03: card drop injects correct JSX and import snippets', () => {
        const applyBatch = vi.fn()
        useEditorStore.setState({
            applyBatch,
            visualTree: [{ id: 'root-node-id', type: 'div', children: [], props: {} }],
        } as unknown as Parameters<typeof useEditorStore.setState>[0])

        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        const payload = makeCardPayload({ name: 'Badge', importPath: '@/components/ui/Badge' })
        const dt = makeDataTransfer({
            types: ['application/flint-component-card'],
            data: { 'application/flint-component-card': payload },
        })

        fireEvent.drop(dropZone, { dataTransfer: dt })

        const [mutations] = applyBatch.mock.calls[0] as [Array<{
            op: string
            targetNodeId: string
            jsxSnippet: string
            importSnippet: string
        }>]
        const mutation = mutations[0]
        expect(mutation.targetNodeId).toBe('root-node-id')
        expect(mutation.jsxSnippet).toBe('<Badge />')
        expect(mutation.importSnippet).toBe("import { Badge } from '@/components/ui/Badge';")
    })

    // LP-CD-04: malformed JSON does not throw
    it('LP-CD-04: malformed card JSON on drop does not throw', () => {
        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        const dt = makeDataTransfer({
            types: ['application/flint-component-card'],
            data: { 'application/flint-component-card': 'NOT_VALID_JSON' },
        })

        expect(() => fireEvent.drop(dropZone, { dataTransfer: dt })).not.toThrow()
    })

    // LP-CD-05: no-op when visualTree is empty
    it('LP-CD-05: card drop is no-op when visualTree is empty', () => {
        const applyBatch = vi.fn()
        useEditorStore.setState({
            applyBatch,
            visualTree: [],
        } as unknown as Parameters<typeof useEditorStore.setState>[0])

        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        const payload = makeCardPayload()
        const dt = makeDataTransfer({
            types: ['application/flint-component-card'],
            data: { 'application/flint-component-card': payload },
        })

        fireEvent.drop(dropZone, { dataTransfer: dt })

        expect(applyBatch).not.toHaveBeenCalled()
    })

    // LP-CD-06: drop indicator class appears on dragEnter with card MIME
    it('LP-CD-06: drop indicator ring applies on dragEnter with card MIME type', () => {
        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        const dt = makeDataTransfer({
            types: ['application/flint-component-card'],
        })

        fireEvent.dragEnter(dropZone, { dataTransfer: dt })

        // The ring classes are added when isCardDragOver becomes true
        expect(dropZone.className).toContain('ring-indigo-500')
    })

    // LP-CD-07: drop indicator class clears on dragLeave (leaving to outside)
    it('LP-CD-07: drop indicator ring clears on dragLeave when leaving the zone', () => {
        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        // Enter first
        const dt = makeDataTransfer({ types: ['application/flint-component-card'] })
        fireEvent.dragEnter(dropZone, { dataTransfer: dt })
        expect(dropZone.className).toContain('ring-indigo-500')

        // Leave — relatedTarget outside the element (null simulates outside)
        fireEvent.dragLeave(dropZone, { relatedTarget: null })
        expect(dropZone.className).not.toContain('ring-indigo-500')
    })

    // LP-CD-08: drop indicator clears on drop
    it('LP-CD-08: drop indicator ring clears on drop', () => {
        const applyBatch = vi.fn()
        useEditorStore.setState({
            applyBatch,
            visualTree: [{ id: 'root-node-id', type: 'div', children: [], props: {} }],
        } as unknown as Parameters<typeof useEditorStore.setState>[0])

        render(<LivePreview />)
        const dropZone = screen.getByTestId('live-preview-drop-zone')

        const dt = makeDataTransfer({
            types: ['application/flint-component-card'],
            data: { 'application/flint-component-card': makeCardPayload() },
        })

        // Trigger enter then drop
        fireEvent.dragEnter(dropZone, { dataTransfer: dt })
        expect(dropZone.className).toContain('ring-indigo-500')

        fireEvent.drop(dropZone, { dataTransfer: dt })
        expect(dropZone.className).not.toContain('ring-indigo-500')
    })
})
