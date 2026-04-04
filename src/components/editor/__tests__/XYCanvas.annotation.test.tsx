/**
 * XYCanvas.annotation.test.tsx
 *
 * Tests for the AnnotationBadge component exported from XYCanvas.tsx.
 *
 * AnnotationBadge is module-private to XYCanvas but exported for testability.
 * It reads from useAnnotations (annotationStore) and renders inside LivePreviewNode.
 *
 * Covers:
 *   - Badge is absent when there are 0 annotations
 *   - Badge shows the correct count when open annotations exist
 *   - Badge is absent when all annotations are resolved (status !== 'open')
 *   - Badge count reflects only open annotations when mixed statuses present
 *   - Badge tooltip uses singular label for count === 1
 *   - Badge tooltip uses plural label for count > 1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnnotationBadge } from '../XYCanvas'
import { useAnnotationStore } from '../../../store/annotationStore'
import type { FlintAnnotation } from '../../../types/flint-api'

// AnnotationBadge has no XYFlow dependencies — no mock needed.

// ── Helpers ───────────────────────────────────────────────────────────────────

let _id = 0
function makeAnnotation(overrides: Partial<FlintAnnotation> = {}): FlintAnnotation {
    return {
        id: `ann-${++_id}`,
        nodeId: 'live-preview',
        filePath: '/project/src/App.tsx',
        type: 'comment',
        author: 'test-user',
        body: 'Test annotation',
        status: 'open',
        visibility: 'public',
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        ...overrides,
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    _id = 0
    useAnnotationStore.setState({ annotations: [] })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnnotationBadge', () => {
    it('badge is absent when there are 0 annotations', () => {
        useAnnotationStore.setState({ annotations: [] })
        render(<AnnotationBadge />)
        expect(screen.queryByTestId('annotation-badge')).toBeNull()
    })

    it('badge shows count "2" when 2 open annotations exist', () => {
        useAnnotationStore.setState({
            annotations: [makeAnnotation(), makeAnnotation()],
        })
        render(<AnnotationBadge />)
        const badge = screen.getByTestId('annotation-badge')
        expect(badge).toBeDefined()
        expect(badge.textContent).toContain('2')
    })

    it('badge is absent when all annotations are resolved', () => {
        useAnnotationStore.setState({
            annotations: [
                makeAnnotation({ status: 'resolved' }),
                makeAnnotation({ status: 'resolved' }),
            ],
        })
        render(<AnnotationBadge />)
        expect(screen.queryByTestId('annotation-badge')).toBeNull()
    })

    it('badge count reflects only open annotations when mixed statuses present', () => {
        useAnnotationStore.setState({
            annotations: [
                makeAnnotation({ status: 'open' }),
                makeAnnotation({ status: 'resolved' }),
                makeAnnotation({ status: 'open' }),
            ],
        })
        render(<AnnotationBadge />)
        const badge = screen.getByTestId('annotation-badge')
        expect(badge.textContent).toContain('2')
    })

    it('tooltip uses singular label when count === 1', () => {
        useAnnotationStore.setState({
            annotations: [makeAnnotation()],
        })
        render(<AnnotationBadge />)
        const tooltip = screen.getByTestId('annotation-badge-tooltip')
        expect(tooltip.textContent).toBe('1 open annotation')
    })

    it('tooltip uses plural label when count > 1', () => {
        useAnnotationStore.setState({
            annotations: [makeAnnotation(), makeAnnotation(), makeAnnotation()],
        })
        render(<AnnotationBadge />)
        const tooltip = screen.getByTestId('annotation-badge-tooltip')
        expect(tooltip.textContent).toBe('3 open annotations')
    })
})
