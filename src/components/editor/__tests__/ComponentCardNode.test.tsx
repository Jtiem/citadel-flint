/**
 * @deprecated GLASS.1c — component cards moved to ComponentPanel
 *
 * ComponentCardNode.test.tsx
 *
 * Phase CV2.3 — Unit tests for the ComponentCardNode custom React Flow node.
 *
 * Tests (contract §11):
 *   CCN-01: Renders in Build mode without crash — name, category badge, Insert button
 *   CCN-02: Renders in Govern mode without crash — grade letter, violation count, Delta-E
 *   CCN-03: Shows thumbnail img when thumbnailPath is set
 *   CCN-04: Shows gradient placeholder when thumbnailPath is null
 *   CCN-05: Insert button disabled when no activeFilePath
 *   CCN-06: Click calls componentCardStore.selectCard with card.id
 *   CCN-07: Selected state shows indigo ring (box-shadow style)
 *   CCN-08: Grade letter colors are correct for each grade (A-F)
 *   CCN-09: Category badge classes are correct for each category
 *   CCN-10: Build mode does NOT render grade/violations
 *   CCN-11: Govern mode does NOT render Insert button
 *   CCN-12: EXPORT BLOCKED banner appears for grade F in govern mode
 *   CCN-13: EXPORT BLOCKED banner absent for grade A in govern mode
 *   CCN-14: A11y status shows "Pass" for zero a11y violations
 *   CCN-15: A11y status shows "X violations" for non-zero a11y count
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComponentCardNode } from '../ComponentCardNode'
import { useComponentCardStore } from '../../../store/componentCardStore'
import type { GovernanceStickerType } from '../../../store/componentCardStore'
import { useCanvasStore } from '../../../store/canvasStore'
import { useEditorStore } from '../../../store/editorStore'
import type { ComponentCardData, ComponentHealth, ComponentCategory } from '../../../types/flint-api'
import type { Node, NodeProps } from '@xyflow/react'
import type { ComponentCardNodeData } from '../../../store/componentCardStore'

// ── Mock @xyflow/react ────────────────────────────────────────────────────────
// Handle components from @xyflow/react cannot render in jsdom

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>()
    return {
        ...actual,
        Handle: ({ type, position }: { type: string; position: string }) => (
            <div data-testid={`handle-${type}-${position}`} />
        ),
        Position: { Top: 'top', Bottom: 'bottom' },
    }
})

// ── Mock useThumbnail ─────────────────────────────────────────────────────────
// Avoid real IPC calls. We control dataUrl via module-level variable.

let mockDataUrl: string | null = null

vi.mock('../../../hooks/useThumbnail', () => ({
    useThumbnail: () => ({
        dataUrl: mockDataUrl,
        isLoading: false,
        error: null,
    }),
}))

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<ComponentCardData> = {}): ComponentCardData {
    return {
        id: 'test-card-id',
        name: 'Button',
        importPath: '@/components/ui/Button',
        filePath: '/project/src/components/ui/Button.tsx',
        category: 'primitive' as ComponentCategory,
        variantCount: 3,
        variants: ['default', 'ghost', 'outline'],
        props: { variant: { type: 'string', required: false } },
        thumbnailPath: null,
        health: null,
        tokens: ['bg-indigo-600', 'text-zinc-100'],
        dependencies: [],
        ...overrides,
    }
}

function makeHealth(overrides: Partial<ComponentHealth> = {}): ComponentHealth {
    return {
        grade: 'A',
        maxDeltaE: 0.3,
        violationCount: 0,
        mithrilCount: 0,
        a11yCount: 0,
        ...overrides,
    }
}

function makeNodeProps(
    card: ComponentCardData,
    isSelected: boolean,
    canvasView: 'build' | 'govern',
): NodeProps<Node<ComponentCardNodeData>> {
    return {
        id: card.id,
        data: { card, isSelected, canvasView },
        type: 'componentCard',
        selected: isSelected,
        dragging: false,
        zIndex: 1,
        isConnectable: true,
        positionAbsoluteX: 0,
        positionAbsoluteY: 0,
        // NodeProps also needs these for newer @xyflow/react versions
    } as NodeProps<Node<ComponentCardNodeData>>
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    mockDataUrl = null
    useComponentCardStore.setState({
        cards: [],
        selectedCardId: null,
        cardPositions: {},
        isLoaded: false,
        isLoading: false,
        error: null,
        showCoverageHeatMap: true,
    })
    useCanvasStore.setState({ activeFilePath: null })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ComponentCardNode', () => {
    // CCN-01: Build mode renders component name, category badge, Insert button
    it('CCN-01: renders in Build mode with name, category badge, and Insert button', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        expect(screen.getByText('Button')).toBeDefined()
        expect(screen.getByTestId(`card-category-${card.id}`)).toBeDefined()
        expect(screen.getByTestId(`card-insert-${card.id}`)).toBeDefined()
    })

    // CCN-02: Govern mode renders grade letter, violation count stat rows, Delta-E
    it('CCN-02: renders in Govern mode with grade letter, Delta-E, and A11y status', () => {
        const health = makeHealth({ grade: 'B', maxDeltaE: 1.8, a11yCount: 0, violationCount: 0 })
        const card = makeCard({ health })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.getByTestId(`card-grade-${card.id}`)).toBeDefined()
        expect(screen.getByTestId(`card-grade-${card.id}`).textContent).toBe('B')
        expect(screen.getByTestId(`card-delta-e-${card.id}`)).toBeDefined()
        expect(screen.getByTestId(`card-delta-e-${card.id}`).textContent).toBe('1.8')
        expect(screen.getByTestId(`card-a11y-${card.id}`)).toBeDefined()
        expect(screen.getByTestId(`card-a11y-${card.id}`).textContent).toBe('Pass')
    })

    // CCN-03: Shows <img> when useThumbnail returns a dataUrl
    it('CCN-03: shows thumbnail image when useThumbnail returns a dataUrl', () => {
        mockDataUrl = 'data:image/png;base64,abc123'
        const card = makeCard({ thumbnailPath: '/project/.flint/thumbnails/btn.png' })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const img = screen.getByRole('img')
        expect(img.getAttribute('src')).toBe('data:image/png;base64,abc123')
        expect(img.getAttribute('alt')).toContain('Button')
    })

    // CCN-04: Shows gradient placeholder when dataUrl is null
    it('CCN-04: shows gradient placeholder with first letter when no thumbnail', () => {
        mockDataUrl = null
        const card = makeCard({ thumbnailPath: null })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        // img should not be present
        expect(screen.queryByRole('img')).toBeNull()
        // Placeholder text with first letter 'B'
        expect(screen.getByText('B')).toBeDefined()
    })

    // CCN-05: Insert button disabled when no activeFilePath
    it('CCN-05: Insert button is disabled when no activeFilePath is set', () => {
        useCanvasStore.setState({ activeFilePath: null })
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const insertBtn = screen.getByTestId(`card-insert-${card.id}`)
        expect(insertBtn.hasAttribute('disabled')).toBe(true)
    })

    // CCN-05b: Insert button enabled when activeFilePath is set
    it('CCN-05b: Insert button is enabled when activeFilePath is set', () => {
        useCanvasStore.setState({ activeFilePath: '/project/src/App.tsx' })
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const insertBtn = screen.getByTestId(`card-insert-${card.id}`)
        expect(insertBtn.hasAttribute('disabled')).toBe(false)
    })

    // CCN-06: Clicking the card calls componentCardStore.selectCard with card.id
    it('CCN-06: clicking the card calls selectCard with the card id', () => {
        const card = makeCard()
        useComponentCardStore.setState({ cards: [card] })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const cardEl = screen.getByTestId(`component-card-${card.id}`)
        fireEvent.click(cardEl)

        expect(useComponentCardStore.getState().selectedCardId).toBe(card.id)
    })

    // CCN-07: Selected state shows indigo ring via box-shadow style
    it('CCN-07: selected card shows indigo ring style', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, true, 'build')} />)

        const cardEl = screen.getByTestId(`component-card-${card.id}`)
        expect(cardEl.getAttribute('style')).toContain('box-shadow')
        expect(cardEl.getAttribute('style')).toContain('#818cf8')
    })

    // CCN-07b: Non-selected card does NOT show the indigo ring
    it('CCN-07b: non-selected card does not show indigo ring', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const cardEl = screen.getByTestId(`component-card-${card.id}`)
        // Should have width style but NOT box-shadow
        const style = cardEl.getAttribute('style') ?? ''
        expect(style).not.toContain('box-shadow')
    })

    // CCN-08: Grade letter colors — each grade gets the right text class
    const gradeColorCases: Array<[ComponentHealth['grade'], string]> = [
        ['A', 'text-emerald-400'],
        ['B', 'text-emerald-400'],
        ['C', 'text-amber-400'],
        ['D', 'text-red-400'],
        ['F', 'text-red-400'],
    ]
    it.each(gradeColorCases)(
        'CCN-08: grade %s has correct color class (%s)',
        (grade, expectedClass) => {
            const health = makeHealth({ grade })
            const card = makeCard({ health })
            render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

            const gradeBadge = screen.getByTestId(`card-grade-${card.id}`)
            expect(gradeBadge.className).toContain(expectedClass)
        },
    )

    // CCN-09: Category badge classes
    const categoryCases: Array<[ComponentCategory, string]> = [
        ['primitive', 'text-blue-400'],
        ['molecule', 'text-purple-400'],
        ['organism', 'text-amber-400'],
        ['page', 'text-emerald-400'],
        ['layout', 'text-cyan-400'],
        ['uncategorized', 'text-zinc-500'],
    ]
    it.each(categoryCases)(
        'CCN-09: category %s has correct badge color (%s)',
        (category, expectedClass) => {
            const card = makeCard({ category })
            render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

            const badge = screen.getByTestId(`card-category-${card.id}`)
            expect(badge.className).toContain(expectedClass)
        },
    )

    // CCN-10: Build mode hides grade/violations
    it('CCN-10: Build mode does not render grade badge or violation rows', () => {
        const health = makeHealth({ grade: 'C', a11yCount: 2 })
        const card = makeCard({ health })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        // Grade badge should not exist
        expect(screen.queryByTestId(`card-grade-${card.id}`)).toBeNull()
        // Delta-E stat should not exist
        expect(screen.queryByTestId(`card-delta-e-${card.id}`)).toBeNull()
    })

    // CCN-11: Govern mode hides Insert button
    it('CCN-11: Govern mode does not render Insert button', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.queryByTestId(`card-insert-${card.id}`)).toBeNull()
    })

    // CCN-12: EXPORT BLOCKED for grade F in govern mode
    it('CCN-12: shows EXPORT BLOCKED banner for grade F component in govern mode', () => {
        const health = makeHealth({ grade: 'F', violationCount: 5 })
        const card = makeCard({ health })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.getByTestId(`card-export-blocked-${card.id}`)).toBeDefined()
        expect(screen.getByText('EXPORT BLOCKED')).toBeDefined()
    })

    // CCN-13: No EXPORT BLOCKED for grade A
    it('CCN-13: does not show EXPORT BLOCKED for grade A component', () => {
        const health = makeHealth({ grade: 'A' })
        const card = makeCard({ health })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.queryByTestId(`card-export-blocked-${card.id}`)).toBeNull()
    })

    // CCN-14: A11y "Pass" for zero violations
    it('CCN-14: A11y status shows Pass when a11yCount is 0', () => {
        const health = makeHealth({ grade: 'A', a11yCount: 0 })
        const card = makeCard({ health })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const a11yEl = screen.getByTestId(`card-a11y-${card.id}`)
        expect(a11yEl.textContent).toBe('Pass')
        expect(a11yEl.className).toContain('text-emerald-400')
    })

    // CCN-15: A11y "X violations" for non-zero count
    it('CCN-15: A11y status shows violation count when a11yCount > 0', () => {
        const health = makeHealth({ grade: 'C', a11yCount: 3 })
        const card = makeCard({ health })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const a11yEl = screen.getByTestId(`card-a11y-${card.id}`)
        expect(a11yEl.textContent).toBe('3 violations')
        expect(a11yEl.className).toContain('text-red-400')
    })

    // CCN-15b: Singular "violation" for a11yCount = 1
    it('CCN-15b: A11y status shows "1 violation" (singular) for a11yCount === 1', () => {
        const health = makeHealth({ grade: 'D', a11yCount: 1 })
        const card = makeCard({ health })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const a11yEl = screen.getByTestId(`card-a11y-${card.id}`)
        expect(a11yEl.textContent).toBe('1 violation')
    })

    // CCN-21: CV2.5 — drag handle renders in Build mode
    it('CCN-21: drag handle renders in Build mode', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const handle = screen.getByTestId(`card-drag-handle-${card.id}`)
        expect(handle).toBeDefined()
    })

    // CCN-22: CV2.5 — drag handle does NOT render in Govern mode
    it('CCN-22: drag handle does not render in Govern mode', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.queryByTestId(`card-drag-handle-${card.id}`)).toBeNull()
    })

    // CCN-23: CV2.5 — drag handle has `nodrag` class to prevent React Flow interception
    it('CCN-23: drag handle has nodrag class to prevent React Flow interception', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const handle = screen.getByTestId(`card-drag-handle-${card.id}`)
        expect(handle.className).toContain('nodrag')
    })

    // CCN-24: CV2.5 — onDragStart sets correct MIME type and serialized component data
    it('CCN-24: drag handle sets correct MIME type and component data on dragstart', () => {
        const card = makeCard({
            name: 'Button',
            importPath: '@/components/ui/Button',
            filePath: '/project/src/components/ui/Button.tsx',
        })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const handle = screen.getByTestId(`card-drag-handle-${card.id}`)

        // Simulate a dragstart event with a DataTransfer stub
        const setDataCalls: Array<[string, string]> = []
        let effectAllowed = ''
        const dataTransfer = {
            setData: (type: string, data: string) => { setDataCalls.push([type, data]) },
            get effectAllowed() { return effectAllowed },
            set effectAllowed(v: string) { effectAllowed = v },
            types: [],
            getData: () => '',
            clearData: () => {},
            items: [],
        } as unknown as DataTransfer

        fireEvent.dragStart(handle, { dataTransfer })

        // effectAllowed should be 'copy'
        expect(effectAllowed).toBe('copy')

        // MIME type should be the card-specific type
        const cardEntry = setDataCalls.find(([type]) => type === 'application/flint-component-card')
        expect(cardEntry).toBeDefined()

        const parsed = JSON.parse(cardEntry![1])
        expect(parsed.name).toBe('Button')
        expect(parsed.importPath).toBe('@/components/ui/Button')
        expect(parsed.filePath).toBe('/project/src/components/ui/Button.tsx')
    })

    // CCN-16: Govern mode shows handles for dependency edges
    it('CCN-16: Govern mode renders React Flow handles for dependency edges', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.getByTestId('handle-target-top')).toBeDefined()
        expect(screen.getByTestId('handle-source-bottom')).toBeDefined()
    })

    // CCN-17: Build mode does NOT render handles
    it('CCN-17: Build mode does not render React Flow handles', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        expect(screen.queryByTestId('handle-target-top')).toBeNull()
        expect(screen.queryByTestId('handle-source-bottom')).toBeNull()
    })

    // CCN-18: Insert button calls editorStore.injectComponent when clicked
    it('CCN-18: Insert button calls injectComponent when activeFilePath is set', () => {
        useCanvasStore.setState({ activeFilePath: '/project/src/App.tsx' })
        const injectComponent = vi.fn()
        useEditorStore.setState({ injectComponent } as Partial<ReturnType<typeof useEditorStore.getState>>)

        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const insertBtn = screen.getByTestId(`card-insert-${card.id}`)
        fireEvent.click(insertBtn)

        expect(injectComponent).toHaveBeenCalledWith(
            '',
            `<${card.name} />`,
            `import { ${card.name} } from '${card.importPath}';`,
        )
    })

    // CCN-19: Govern mode with null health shows "?" placeholder and "No audit yet" text
    it('CCN-19: Govern mode shows placeholder when health is null', () => {
        const card = makeCard({ health: null })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const gradeBadge = screen.getByTestId(`card-grade-${card.id}`)
        expect(gradeBadge.textContent).toBe('?')
        expect(screen.getByText('No audit yet')).toBeDefined()
    })

    // CCN-20: Card has correct aria attributes
    it('CCN-20: card has correct aria-label and aria-pressed attributes', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, true, 'build')} />)

        const cardEl = screen.getByTestId(`component-card-${card.id}`)
        expect(cardEl.getAttribute('aria-label')).toContain('Button')
        expect(cardEl.getAttribute('aria-pressed')).toBe('true')
    })

    // ── CV2.6: Category dropdown tests ────────────────────────────────────────

    // CCN-25: Category badge is clickable in Build mode (has role="button")
    it('CCN-25: category badge is clickable (role=button) in Build mode', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const badge = screen.getByTestId(`card-category-${card.id}`)
        expect(badge.getAttribute('role')).toBe('button')
        expect(badge.getAttribute('aria-haspopup')).toBe('listbox')
    })

    // CCN-26: Category badge is NOT interactive in Govern mode
    it('CCN-26: category badge is not a button in Govern mode', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const badge = screen.getByTestId(`card-category-${card.id}`)
        expect(badge.getAttribute('role')).toBeNull()
        expect(badge.getAttribute('aria-haspopup')).toBeNull()
    })

    // CCN-27: Clicking the badge opens the category dropdown showing all 6 options
    it('CCN-27: clicking the category badge opens a dropdown with all 6 category options', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        const badge = screen.getByTestId(`card-category-${card.id}`)
        fireEvent.click(badge)

        // Popover must appear.
        expect(screen.getByTestId(`card-category-popover-${card.id}`)).toBeDefined()

        // All 6 category options must be present.
        const expectedCategories = ['primitive', 'molecule', 'organism', 'page', 'layout', 'uncategorized']
        for (const cat of expectedCategories) {
            expect(screen.getByTestId(`category-option-${cat}`)).toBeDefined()
        }
    })

    // CCN-28: Selecting a category calls setCategoryOverride with card.id and category
    it('CCN-28: selecting a category option calls setCategoryOverride with the correct args', () => {
        const setCategoryOverride = vi.fn()
        useComponentCardStore.setState({ setCategoryOverride } as Partial<ReturnType<typeof useComponentCardStore.getState>>)

        const card = makeCard({ category: 'uncategorized' })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        // Open the dropdown.
        const badge = screen.getByTestId(`card-category-${card.id}`)
        fireEvent.click(badge)

        // Click the 'molecule' option.
        const moleculeOption = screen.getByTestId('category-option-molecule')
        fireEvent.click(moleculeOption)

        expect(setCategoryOverride).toHaveBeenCalledWith(card.id, 'molecule')
    })

    // CCN-29: Dropdown closes after selecting a category
    it('CCN-29: the category dropdown closes after a category is selected', () => {
        const card = makeCard({ category: 'uncategorized' })
        useComponentCardStore.setState({ setCategoryOverride: vi.fn() } as Partial<ReturnType<typeof useComponentCardStore.getState>>)

        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        // Open the dropdown.
        fireEvent.click(screen.getByTestId(`card-category-${card.id}`))
        expect(screen.getByTestId(`card-category-popover-${card.id}`)).toBeDefined()

        // Select a different category.
        fireEvent.click(screen.getByTestId('category-option-primitive'))

        // Popover should be closed.
        expect(screen.queryByTestId(`card-category-popover-${card.id}`)).toBeNull()
    })

    // CCN-30: Clicking the current category does NOT call setCategoryOverride
    it('CCN-30: clicking the current category does not call setCategoryOverride', () => {
        const setCategoryOverride = vi.fn()
        useComponentCardStore.setState({ setCategoryOverride } as Partial<ReturnType<typeof useComponentCardStore.getState>>)

        const card = makeCard({ category: 'primitive' })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        fireEvent.click(screen.getByTestId(`card-category-${card.id}`))
        fireEvent.click(screen.getByTestId('category-option-primitive'))

        // Clicking the current category should be a no-op.
        expect(setCategoryOverride).not.toHaveBeenCalled()
    })

    // CCN-31: Category dropdown does NOT open in Govern mode
    it('CCN-31: clicking the category badge in Govern mode does not open a dropdown', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const badge = screen.getByTestId(`card-category-${card.id}`)
        fireEvent.click(badge)

        // Popover must NOT appear in govern mode.
        expect(screen.queryByTestId(`card-category-popover-${card.id}`)).toBeNull()
    })

    // ── CV2.8: Variant Strip tests ─────────────────────────────────────────────

    // CCN-32: Variant strip renders when selected, Build mode, variantCount > 0
    it('CCN-32: variant strip renders when card is selected in Build mode with variants', () => {
        const card = makeCard({ variants: ['default', 'ghost', 'outline'], variantCount: 3 })
        useCanvasStore.setState({ activeFilePath: '/project/src/App.tsx' })
        render(<ComponentCardNode {...makeNodeProps(card, true, 'build')} />)

        expect(screen.getByTestId(`variant-strip-${card.id}`)).toBeDefined()
    })

    // CCN-33: Variant strip does NOT render when card is not selected
    it('CCN-33: variant strip does not render when card is not selected', () => {
        const card = makeCard({ variants: ['default', 'ghost'], variantCount: 2 })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        expect(screen.queryByTestId(`variant-strip-${card.id}`)).toBeNull()
    })

    // CCN-34: Variant strip does NOT render in Govern mode (even when selected)
    it('CCN-34: variant strip does not render in Govern mode', () => {
        const card = makeCard({ variants: ['default', 'ghost'], variantCount: 2 })
        render(<ComponentCardNode {...makeNodeProps(card, true, 'govern')} />)

        expect(screen.queryByTestId(`variant-strip-${card.id}`)).toBeNull()
    })

    // CCN-35: Variant strip does NOT render when variantCount is 0
    it('CCN-35: variant strip does not render when variantCount is 0', () => {
        const card = makeCard({ variants: [], variantCount: 0 })
        render(<ComponentCardNode {...makeNodeProps(card, true, 'build')} />)

        expect(screen.queryByTestId(`variant-strip-${card.id}`)).toBeNull()
    })

    // CCN-36: All variant names are rendered as chips
    it('CCN-36: all variant names are rendered as chips in the strip', () => {
        const variants = ['default', 'ghost', 'outline']
        const card = makeCard({ variants, variantCount: 3 })
        useCanvasStore.setState({ activeFilePath: '/project/src/App.tsx' })
        render(<ComponentCardNode {...makeNodeProps(card, true, 'build')} />)

        for (const variantName of variants) {
            const chip = screen.getByTestId(`variant-chip-${card.id}-${variantName}`)
            expect(chip).toBeDefined()
            expect(chip.textContent).toBe(variantName)
        }
    })

    // CCN-37: Clicking a variant chip calls injectComponent with the variant prop
    it('CCN-37: clicking a variant chip calls injectComponent with the correct variant prop', () => {
        useCanvasStore.setState({ activeFilePath: '/project/src/App.tsx' })
        const injectComponent = vi.fn()
        useEditorStore.setState({ injectComponent } as Partial<ReturnType<typeof useEditorStore.getState>>)

        const card = makeCard({ variants: ['ghost', 'outline'], variantCount: 2 })
        render(<ComponentCardNode {...makeNodeProps(card, true, 'build')} />)

        const ghostChip = screen.getByTestId(`variant-chip-${card.id}-ghost`)
        fireEvent.click(ghostChip)

        expect(injectComponent).toHaveBeenCalledWith(
            '',
            `<${card.name} variant="ghost" />`,
            `import { ${card.name} } from '${card.importPath}';`,
        )
    })

    // ── Coverage Heat Map (Design System Coverage Map) ────────────────────────

    // CCN-38: Heat overlay renders in Govern mode when showCoverageHeatMap is true
    it('CCN-38: heat overlay renders in Govern mode', () => {
        useComponentCardStore.setState({ showCoverageHeatMap: true })
        const card = makeCard({ health: makeHealth({ grade: 'D' }) })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.getByTestId(`coverage-heat-${card.id}`)).toBeDefined()
    })

    // CCN-39: Heat overlay does NOT render in Build mode
    it('CCN-39: heat overlay does NOT render in Build mode', () => {
        useComponentCardStore.setState({ showCoverageHeatMap: true })
        const card = makeCard({ health: makeHealth({ grade: 'D' }) })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        expect(screen.queryByTestId(`coverage-heat-${card.id}`)).toBeNull()
    })

    // CCN-40: Heat overlay does NOT render when showCoverageHeatMap is false (toggle off)
    it('CCN-40: heat overlay does NOT render in Govern mode when toggle is off', () => {
        useComponentCardStore.setState({ showCoverageHeatMap: false })
        const card = makeCard({ health: makeHealth({ grade: 'B' }) })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.queryByTestId(`coverage-heat-${card.id}`)).toBeNull()
    })

    // CCN-41: Grade A overlay uses transparent background (clean — no heat)
    it('CCN-41: grade A overlay background is transparent', () => {
        useComponentCardStore.setState({ showCoverageHeatMap: true })
        const card = makeCard({ health: makeHealth({ grade: 'A' }) })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const overlay = screen.getByTestId(`coverage-heat-${card.id}`)
        expect(overlay.getAttribute('style')).toContain('transparent')
    })

    // CCN-42: Grade D overlay uses red background
    it('CCN-42: grade D overlay background uses red color', () => {
        useComponentCardStore.setState({ showCoverageHeatMap: true })
        const card = makeCard({ health: makeHealth({ grade: 'D' }) })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const overlay = screen.getByTestId(`coverage-heat-${card.id}`)
        const style = overlay.getAttribute('style') ?? ''
        // Red channel dominant — rgba(239, 68, 68, ...)
        expect(style).toContain('239, 68, 68')
    })

    // CCN-43: Null health overlay uses zinc (neutral gray) background
    it('CCN-43: null health overlay background uses zinc color', () => {
        useComponentCardStore.setState({ showCoverageHeatMap: true })
        const card = makeCard({ health: null })
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const overlay = screen.getByTestId(`coverage-heat-${card.id}`)
        const style = overlay.getAttribute('style') ?? ''
        // Zinc-500 rgba: rgba(113, 113, 122, ...)
        expect(style).toContain('113, 113, 122')
    })
})

// ── Governance Stickers ────────────────────────────────────────────────────────

describe('ComponentCardNode — Governance Stickers', () => {
    beforeEach(() => {
        // Reset sticker state before each test.
        useComponentCardStore.setState({ stickers: [] })
    })

    // CCN-50: Sticker badge renders on card in Govern mode when a sticker exists
    it('CCN-50: sticker badge renders in Govern mode when the card has a sticker', () => {
        const card = makeCard()
        // Seed a sticker directly into the store.
        useComponentCardStore.setState({
            stickers: [
                {
                    id: 'sticker-1',
                    type: 'approved',
                    componentId: card.id,
                    createdAt: new Date().toISOString(),
                },
            ],
        })

        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.getByTestId(`sticker-badge-approved-${card.id}`)).toBeDefined()
    })

    // CCN-51: Sticker badges do NOT render in Build mode
    it('CCN-51: sticker badges do NOT render in Build mode', () => {
        const card = makeCard()
        useComponentCardStore.setState({
            stickers: [
                {
                    id: 'sticker-1',
                    type: 'needs-review',
                    componentId: card.id,
                    createdAt: new Date().toISOString(),
                },
            ],
        })

        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        // Strip container should not render in Build mode.
        expect(screen.queryByTestId(`sticker-strip-${card.id}`)).toBeNull()
    })

    // CCN-52: Correct color class is applied for each sticker type
    const stickerColorCases: Array<[GovernanceStickerType, string]> = [
        ['needs-review', 'text-amber-400'],
        ['approved',     'text-emerald-400'],
        ['deprecated',   'text-red-400'],
        ['wip',          'text-blue-400'],
        ['blocked',      'text-red-300'],
    ]
    it.each(stickerColorCases)(
        'CCN-52: sticker type "%s" has correct color class containing "%s"',
        (stickerType, expectedClass) => {
            const card = makeCard()
            useComponentCardStore.setState({
                stickers: [
                    {
                        id: 'sticker-1',
                        type: stickerType,
                        componentId: card.id,
                        createdAt: new Date().toISOString(),
                    },
                ],
            })

            render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

            const badge = screen.getByTestId(`sticker-badge-${stickerType}-${card.id}`)
            expect(badge.className).toContain(expectedClass)
        },
    )

    // CCN-53: Sticker picker button renders in Govern mode
    it('CCN-53: sticker picker button renders in Govern mode', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.getByTestId(`sticker-btn-${card.id}`)).toBeDefined()
    })

    // CCN-54: Sticker picker button does NOT render in Build mode
    it('CCN-54: sticker picker button does NOT render in Build mode', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'build')} />)

        expect(screen.queryByTestId(`sticker-btn-${card.id}`)).toBeNull()
    })

    // CCN-55: Clicking the sticker button opens a picker with all 5 sticker options
    it('CCN-55: clicking the sticker button shows a dropdown with 5 sticker options', () => {
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const btn = screen.getByTestId(`sticker-btn-${card.id}`)
        fireEvent.click(btn)

        expect(screen.getByTestId(`sticker-picker-${card.id}`)).toBeDefined()

        // All 5 options must appear.
        const expectedTypes = ['needs-review', 'approved', 'deprecated', 'wip', 'blocked']
        for (const type of expectedTypes) {
            expect(screen.getByTestId(`sticker-option-${type}-${card.id}`)).toBeDefined()
        }
    })

    // CCN-56: Clicking a sticker option calls addSticker and closes the picker
    it('CCN-56: clicking a sticker option calls addSticker with the correct args', () => {
        const addSticker = vi.fn()
        useComponentCardStore.setState({
            addSticker,
        } as Partial<ReturnType<typeof useComponentCardStore.getState>>)

        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        // Open the picker.
        fireEvent.click(screen.getByTestId(`sticker-btn-${card.id}`))

        // Click the 'approved' option.
        fireEvent.click(screen.getByTestId(`sticker-option-approved-${card.id}`))

        expect(addSticker).toHaveBeenCalledWith(card.id, 'approved')

        // Picker must close after selection.
        expect(screen.queryByTestId(`sticker-picker-${card.id}`)).toBeNull()
    })

    // CCN-57: Clicking a sticker badge removes it (calls removeSticker)
    it('CCN-57: clicking an existing sticker badge calls removeSticker with its id', () => {
        const removeSticker = vi.fn()
        useComponentCardStore.setState({
            removeSticker,
            stickers: [
                {
                    id: 'sticker-rm-1',
                    type: 'deprecated',
                    componentId: 'test-card-id',
                    createdAt: new Date().toISOString(),
                },
            ],
        } as Partial<ReturnType<typeof useComponentCardStore.getState>>)

        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        const badge = screen.getByTestId(`sticker-badge-deprecated-${card.id}`)
        fireEvent.click(badge)

        expect(removeSticker).toHaveBeenCalledWith('sticker-rm-1')
    })

    // CCN-58: No sticker strip element rendered when card has no stickers in Govern mode
    it('CCN-58: sticker strip is absent when the card has no stickers in Govern mode', () => {
        useComponentCardStore.setState({ stickers: [] })
        const card = makeCard()
        render(<ComponentCardNode {...makeNodeProps(card, false, 'govern')} />)

        expect(screen.queryByTestId(`sticker-strip-${card.id}`)).toBeNull()
    })
})
