/**
 * annotationStore.test.ts — src/store/__tests__/annotationStore.test.ts
 *
 * Tests for the annotation Zustand store (Phase COLLAB.4).
 *
 * Covers:
 *   - Initial state shape
 *   - fetchAnnotations populates annotations
 *   - resolveAnnotation marks as resolved and re-fetches
 *   - annotationsForNode filters by nodeId and status
 *   - restoreAnnotation optimistic undo
 *   - annotationsForNode returns empty for unknown nodeId
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAnnotationStore } from '../../store/annotationStore'

// ── Mock data ────────────────────────────────────────────────────────────────

const mockAnnotations = [
    { id: 'ann-1', nodeId: 'node-a', status: 'open', text: 'Check spacing', author: 'designer', createdAt: 1000 },
    { id: 'ann-2', nodeId: 'node-a', status: 'resolved', text: 'Color looks off', author: 'designer', createdAt: 2000 },
    { id: 'ann-3', nodeId: 'node-b', status: 'open', text: 'Needs a11y label', author: 'dev', createdAt: 3000 },
]

const mockReadAll = vi.fn().mockResolvedValue(mockAnnotations)
const mockResolve = vi.fn().mockResolvedValue(undefined)

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    mockReadAll.mockResolvedValue(mockAnnotations)
    useAnnotationStore.setState({ annotations: [] })

    ;(window as unknown as Record<string, unknown>).flintAPI = {
        annotations: {
            readAll: mockReadAll,
            resolve: mockResolve,
        },
    }
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('annotationStore', () => {
    it('has correct initial state', () => {
        const state = useAnnotationStore.getState()
        expect(state.annotations).toEqual([])
    })

    it('fetchAnnotations populates annotations from IPC', async () => {
        await useAnnotationStore.getState().fetchAnnotations()

        const state = useAnnotationStore.getState()
        expect(state.annotations).toHaveLength(3)
        expect(state.annotations[0].id).toBe('ann-1')
    })

    it('resolveAnnotation calls IPC and re-fetches', async () => {
        await useAnnotationStore.getState().fetchAnnotations()
        await useAnnotationStore.getState().resolveAnnotation('ann-1')

        expect(mockResolve).toHaveBeenCalledWith('ann-1')
        // readAll called twice: initial fetch + re-fetch after resolve
        expect(mockReadAll).toHaveBeenCalledTimes(2)
    })

    it('annotationsForNode returns only open annotations for a given nodeId', async () => {
        await useAnnotationStore.getState().fetchAnnotations()

        const nodeAAnnotations = useAnnotationStore.getState().annotationsForNode('node-a')
        // ann-1 is open for node-a; ann-2 is resolved (excluded)
        expect(nodeAAnnotations).toHaveLength(1)
        expect(nodeAAnnotations[0].id).toBe('ann-1')
    })

    it('annotationsForNode returns empty array for unknown nodeId', async () => {
        await useAnnotationStore.getState().fetchAnnotations()
        const result = useAnnotationStore.getState().annotationsForNode('nonexistent')
        expect(result).toEqual([])
    })

    it('restoreAnnotation optimistically re-inserts an annotation at the front', async () => {
        await useAnnotationStore.getState().fetchAnnotations()

        const restored = {
            id: 'ann-99',
            nodeId: 'node-c',
            status: 'open' as const,
            text: 'Restored!',
            author: 'test',
            createdAt: 9000,
        }
        useAnnotationStore.getState().restoreAnnotation(restored as never)

        const state = useAnnotationStore.getState()
        expect(state.annotations[0].id).toBe('ann-99')
        expect(state.annotations).toHaveLength(4)
    })
})
