/**
 * GhostCodeSnippet.test.tsx
 *
 * 12 tests covering:
 *   - parseLineFromNodeId: valid ids, edge cases, malformed ids
 *   - extractSourceContext: windowing, boundary clamping, target offset
 *   - GhostCodeSnippet component: render conditions, dismiss, Escape key
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { parseLineFromNodeId, extractSourceContext, GhostCodeSnippet } from '../GhostCodeSnippet'
import { useEditorStore } from '../../../store/editorStore'
import { useCanvasStore } from '../../../store/canvasStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAMPLE_CODE = [
    'import React from "react"',         // line 1
    '',                                   // line 2
    'export default function Card() {',   // line 3
    '  return (',                          // line 4
    '    <div className="p-4">',           // line 5
    '      <h2>Hello</h2>',               // line 6
    '    </div>',                          // line 7
    '  )',                                 // line 8
    '}',                                  // line 9
].join('\n')

// ── parseLineFromNodeId ────────────────────────────────────────────────────────

describe('parseLineFromNodeId', () => {
    it('returns the line number from a valid node id', () => {
        expect(parseLineFromNodeId('div:5:4')).toBe(5)
    })

    it('handles single-digit line number', () => {
        expect(parseLineFromNodeId('h2:1:0')).toBe(1)
    })

    it('handles multi-digit line number', () => {
        expect(parseLineFromNodeId('Button:123:12')).toBe(123)
    })

    it('returns null for an id without colon separators', () => {
        expect(parseLineFromNodeId('nocolon')).toBeNull()
    })

    it('returns null when the line segment is not a number', () => {
        expect(parseLineFromNodeId('div:abc:0')).toBeNull()
    })

    it('returns null when line number is zero or negative', () => {
        expect(parseLineFromNodeId('div:0:4')).toBeNull()
        expect(parseLineFromNodeId('div:-1:4')).toBeNull()
    })
})

// ── extractSourceContext ───────────────────────────────────────────────────────

describe('extractSourceContext', () => {
    it('returns the correct window of lines centred on the target', () => {
        const result = extractSourceContext(SAMPLE_CODE, 5, 2)
        // lines 3-7 (0-based slice [2..6])
        expect(result.startLine).toBe(3)
        expect(result.lines).toHaveLength(5)
        expect(result.lines[result.targetOffset]).toBe('    <div className="p-4">')
    })

    it('clamps to the start of the file when target is near line 1', () => {
        const result = extractSourceContext(SAMPLE_CODE, 1, 4)
        expect(result.startLine).toBe(1)
        expect(result.targetOffset).toBe(0)
    })

    it('clamps to the end of the file when target is near the last line', () => {
        const result = extractSourceContext(SAMPLE_CODE, 9, 4)
        const lastLine = result.lines[result.lines.length - 1]
        expect(lastLine).toBe('}')
        expect(result.targetOffset).toBe(result.lines.length - 1)
    })

    it('returns a single-element array for a 1-line file', () => {
        const result = extractSourceContext('hello', 1, 4)
        expect(result.lines).toHaveLength(1)
        expect(result.lines[0]).toBe('hello')
        expect(result.startLine).toBe(1)
        expect(result.targetOffset).toBe(0)
    })
})

// ── GhostCodeSnippet component ────────────────────────────────────────────────

describe('GhostCodeSnippet', () => {
    beforeEach(() => {
        // Reset store state before each test.
        act(() => {
            useEditorStore.setState({
                selectedNodeId: null,
                rawCode: '',
            })
            useCanvasStore.setState({ activeFilePath: null })
        })
    })

    it('renders nothing when no node is selected', () => {
        render(<GhostCodeSnippet />)
        expect(screen.queryByTestId('ghost-code-snippet')).toBeNull()
    })

    it('renders nothing when rawCode is empty', () => {
        act(() => {
            useEditorStore.setState({ selectedNodeId: 'div:5:4', rawCode: '' })
        })
        render(<GhostCodeSnippet />)
        expect(screen.queryByTestId('ghost-code-snippet')).toBeNull()
    })

    it('renders the snippet card when a node is selected and code is available', () => {
        act(() => {
            useEditorStore.setState({ selectedNodeId: 'div:5:4', rawCode: SAMPLE_CODE })
            useCanvasStore.setState({ activeFilePath: '/project/src/Card.tsx' })
        })
        render(<GhostCodeSnippet />)
        expect(screen.getByTestId('ghost-code-snippet')).toBeTruthy()
    })

    it('displays the file path label', () => {
        act(() => {
            useEditorStore.setState({ selectedNodeId: 'div:5:4', rawCode: SAMPLE_CODE })
            useCanvasStore.setState({ activeFilePath: '/project/src/Card.tsx' })
        })
        render(<GhostCodeSnippet />)
        expect(screen.getByText(/src\/Card\.tsx/)).toBeTruthy()
    })

    it('displays the line number', () => {
        act(() => {
            useEditorStore.setState({ selectedNodeId: 'div:5:4', rawCode: SAMPLE_CODE })
        })
        render(<GhostCodeSnippet />)
        expect(screen.getByText('line 5')).toBeTruthy()
    })

    it('dismisses on close button click', () => {
        act(() => {
            useEditorStore.setState({ selectedNodeId: 'div:5:4', rawCode: SAMPLE_CODE })
        })
        render(<GhostCodeSnippet />)
        // Portal renders inside an aria-hidden backdrop (correct — scrim is decorative).
        // Use { hidden: true } to query elements within aria-hidden subtrees.
        const btn = within(document.body).getByRole('button', { name: /dismiss code snippet/i, hidden: true })
        fireEvent.click(btn)
        expect(screen.queryByTestId('ghost-code-snippet')).toBeNull()
    })

    it('dismisses on Escape key', () => {
        act(() => {
            useEditorStore.setState({ selectedNodeId: 'div:5:4', rawCode: SAMPLE_CODE })
        })
        render(<GhostCodeSnippet />)
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(screen.queryByTestId('ghost-code-snippet')).toBeNull()
    })

    it('renders nothing when node id has no valid line number', () => {
        act(() => {
            useEditorStore.setState({ selectedNodeId: 'nocolon', rawCode: SAMPLE_CODE })
        })
        render(<GhostCodeSnippet />)
        expect(screen.queryByTestId('ghost-code-snippet')).toBeNull()
    })
})
