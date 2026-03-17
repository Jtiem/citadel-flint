/**
 * XYCanvas.drop.test.tsx — src/components/editor/__tests__/XYCanvas.drop.test.tsx
 *
 * Demo 9: Cross-File Multi-AST Drop
 *
 * Tests for drag-and-drop handling on the XYCanvas outer container.
 *
 * Covers:
 *   - Canvas renders without crashing
 *   - onDragOver prevents default when bridge component drag type is present
 *   - onDragOver does NOT prevent default for non-bridge drags
 *   - onDrop calls crossFileMove when valid drag data is present
 *   - onDrop is a no-op when no sourceFile in dataTransfer
 *   - onDrop is a no-op when activeFilePath is null
 *   - onDrop is a no-op when sourceFile === targetFile
 *   - isDragOver ring applied on dragEnter, not applied for non-bridge drags
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { XYCanvas } from '../XYCanvas'
import { useCanvasStore } from '../../../store/canvasStore'

// ── Mock @xyflow/react ────────────────────────────────────────────────────────
// ReactFlow relies on ResizeObserver and DOM measurements that jsdom cannot
// provide. A lightweight mock is sufficient because the tests focus on the
// drag/drop wrapper div, not the ReactFlow internals.

vi.mock('@xyflow/react', () => ({
    ReactFlow: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="react-flow-mock">{children}</div>
    ),
    Background: () => null,
    BackgroundVariant: { Dots: 'dots' },
    Controls: () => null,
    MiniMap: () => null,
}))

// ── Mock astBufferStore crossFileMove ─────────────────────────────────────────
// We mock the entire module so the store import in XYCanvas resolves to our spy.

const mockCrossFileMove = vi.fn().mockResolvedValue(undefined)

vi.mock('../../../store/astBufferStore', () => ({
    useASTBufferStore: {
        getState: () => ({
            crossFileMove: mockCrossFileMove,
        }),
    },
}))

// ── Constants ─────────────────────────────────────────────────────────────────

const BRIDGE_COMPONENT_FILE_TYPE = 'application/bridge-component-file'
const BRIDGE_SOURCE_ID_TYPE = 'application/bridge-source-id'

const SOURCE_PATH = '/project/src/Source.tsx'
const TARGET_PATH = '/project/src/Target.tsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a dataTransfer-like object compatible with fireEvent.
 * The `types` array must match the keys in `data` so that
 * `e.dataTransfer.types.includes(...)` works correctly.
 */
function makeDataTransfer(data: Record<string, string> = {}) {
    return {
        types: Object.keys(data),
        getData: (type: string) => data[type] ?? '',
        setData: vi.fn(),
        dropEffect: 'copy' as DataTransfer['dropEffect'],
        effectAllowed: 'copy' as DataTransfer['effectAllowed'],
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    useCanvasStore.setState({
        activeFilePath: TARGET_PATH,
        dragSourceId: null,
        activeSelection: null,
        canvasMode: 'design',
        nodeLayouts: {},
        mithrilViolations: [],
        a11yViolations: {},
        overridesExist: false,
        saveState: 'idle',
        workspaceFiles: null,
    })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('XYCanvas', () => {
    it('renders without crashing', () => {
        render(<XYCanvas />)
        expect(screen.getByTestId('xy-canvas-container')).toBeDefined()
    })

    it('renders the inner ReactFlow mock', () => {
        render(<XYCanvas />)
        expect(screen.getByTestId('react-flow-mock')).toBeDefined()
    })

    describe('onDragOver', () => {
        it('calls preventDefault when bridge component drag type is present', () => {
            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            const prevented = fireEvent.dragOver(container, {
                dataTransfer: makeDataTransfer({ [BRIDGE_COMPONENT_FILE_TYPE]: SOURCE_PATH }),
            })

            // fireEvent returns false when preventDefault was called
            expect(prevented).toBe(false)
        })

        it('does NOT call preventDefault for non-bridge drag types', () => {
            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            const prevented = fireEvent.dragOver(container, {
                dataTransfer: makeDataTransfer({ 'text/plain': 'hello' }),
            })

            // fireEvent returns true when preventDefault was NOT called
            expect(prevented).toBe(true)
        })

        it('does NOT call preventDefault when no data types are present', () => {
            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            const prevented = fireEvent.dragOver(container, {
                dataTransfer: makeDataTransfer({}),
            })

            expect(prevented).toBe(true)
        })
    })

    describe('onDrop', () => {
        it('calls crossFileMove with cloneMode: true when valid drag data is present', async () => {
            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            fireEvent.drop(container, {
                dataTransfer: makeDataTransfer({
                    [BRIDGE_COMPONENT_FILE_TYPE]: SOURCE_PATH,
                    [BRIDGE_SOURCE_ID_TYPE]: 'child-source',
                }),
            })

            await vi.waitFor(() => {
                expect(mockCrossFileMove).toHaveBeenCalled()
            })

            const callArgs = mockCrossFileMove.mock.calls[0]
            expect(callArgs[0]).toBe(SOURCE_PATH)       // sourceFile
            expect(callArgs[1]).toBe(TARGET_PATH)        // targetFile (activeFilePath)
            expect(callArgs[2]).toBe('child-source')     // sourceNodeId
            expect(callArgs[3]).toBeNull()                // targetNodeId
            expect(callArgs[4]).toBe('inside')           // position
            expect(callArgs[5]).toEqual({ cloneMode: true }) // options
        })

        it('is a no-op when no sourceFile is in dataTransfer', async () => {
            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            fireEvent.drop(container, {
                dataTransfer: makeDataTransfer({
                    [BRIDGE_SOURCE_ID_TYPE]: 'child-source',
                    // No BRIDGE_COMPONENT_FILE_TYPE
                }),
            })

            await Promise.resolve()
            expect(mockCrossFileMove).not.toHaveBeenCalled()
        })

        it('is a no-op when activeFilePath is null', async () => {
            useCanvasStore.setState({ activeFilePath: null })

            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            fireEvent.drop(container, {
                dataTransfer: makeDataTransfer({
                    [BRIDGE_COMPONENT_FILE_TYPE]: SOURCE_PATH,
                    [BRIDGE_SOURCE_ID_TYPE]: 'child-source',
                }),
            })

            await Promise.resolve()
            expect(mockCrossFileMove).not.toHaveBeenCalled()
        })

        it('is a no-op when sourceFile === activeFilePath (self-drop)', async () => {
            useCanvasStore.setState({ activeFilePath: SOURCE_PATH })

            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            fireEvent.drop(container, {
                dataTransfer: makeDataTransfer({
                    [BRIDGE_COMPONENT_FILE_TYPE]: SOURCE_PATH,
                    [BRIDGE_SOURCE_ID_TYPE]: 'child-source',
                }),
            })

            await Promise.resolve()
            expect(mockCrossFileMove).not.toHaveBeenCalled()
        })

        it('uses empty string for sourceNodeId when BRIDGE_SOURCE_ID_TYPE is absent', async () => {
            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            fireEvent.drop(container, {
                dataTransfer: makeDataTransfer({
                    [BRIDGE_COMPONENT_FILE_TYPE]: SOURCE_PATH,
                    // No BRIDGE_SOURCE_ID_TYPE
                }),
            })

            await vi.waitFor(() => {
                expect(mockCrossFileMove).toHaveBeenCalled()
            })

            const callArgs = mockCrossFileMove.mock.calls[0]
            expect(callArgs[2]).toBe('') // sourceNodeId falls through to ''
        })
    })

    describe('isDragOver visual feedback', () => {
        it('applies ring class on dragEnter with bridge component type', () => {
            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            fireEvent.dragEnter(container, {
                dataTransfer: makeDataTransfer({
                    [BRIDGE_COMPONENT_FILE_TYPE]: SOURCE_PATH,
                }),
            })

            expect(container.className).toContain('ring-2')
            expect(container.className).toContain('ring-blue-400')
        })

        it('does NOT apply ring class on dragEnter without bridge component type', () => {
            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            fireEvent.dragEnter(container, {
                dataTransfer: makeDataTransfer({ 'text/plain': 'hello' }),
            })

            expect(container.className).not.toContain('ring-2')
        })

        it('removes ring class on drop', () => {
            render(<XYCanvas />)
            const container = screen.getByTestId('xy-canvas-container')

            // First enter
            fireEvent.dragEnter(container, {
                dataTransfer: makeDataTransfer({
                    [BRIDGE_COMPONENT_FILE_TYPE]: SOURCE_PATH,
                }),
            })
            expect(container.className).toContain('ring-2')

            // Then drop — ring should be cleared
            fireEvent.drop(container, {
                dataTransfer: makeDataTransfer({
                    [BRIDGE_COMPONENT_FILE_TYPE]: SOURCE_PATH,
                }),
            })
            expect(container.className).not.toContain('ring-2')
        })
    })
})
