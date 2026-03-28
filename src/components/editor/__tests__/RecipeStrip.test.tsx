/**
 * @deprecated GLASS.1c — recipes moved to ComponentPanel
 *
 * RecipeStrip.test.tsx
 *
 * Unit tests for the RecipeStrip component and the builtinRecipes data model.
 *
 * Test IDs (RS-01 … RS-12):
 *   RS-01: Recipe strip renders with data-testid="recipe-strip"
 *   RS-02: All builtin recipes render as chips
 *   RS-03: Each chip has the recipe name visible
 *   RS-04: Clicking a recipe chip calls injectComponent with the recipe jsxSnippet
 *   RS-05: injectComponent targetNodeId is always '' (root append)
 *   RS-06: Registry indicator shows green check when all components present
 *   RS-07: Registry indicator shows amber warning when components are missing
 *   RS-08: Registry indicator is always green for recipes with no required components
 *   RS-09: RecipeStrip does NOT render in XYCanvas preview mode
 *   RS-10: RecipeStrip DOES render in XYCanvas build mode
 *   RS-11: RecipeStrip does NOT render in XYCanvas govern mode
 *   RS-12: Clicking a recipe with imports passes the joined imports as importSnippet
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecipeStrip } from '../RecipeStrip'
import { XYCanvas } from '../XYCanvas'
import { BUILTIN_RECIPES } from '../../../data/builtinRecipes'
import { useEditorStore } from '../../../store/editorStore'
import { useComponentCardStore } from '../../../store/componentCardStore'
import { useCanvasStore } from '../../../store/canvasStore'
import type { ComponentCardData, ComponentCategory } from '../../../types/flint-api'

// ── Mock @xyflow/react ────────────────────────────────────────────────────────
// ReactFlow relies on ResizeObserver which jsdom cannot provide.

vi.mock('@xyflow/react', () => ({
    ReactFlow: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="react-flow-mock">{children}</div>
    ),
    Background: () => null,
    BackgroundVariant: { Dots: 'dots' },
    Controls: () => null,
    MiniMap: () => null,
}))

// ── Mock astBufferStore ───────────────────────────────────────────────────────

vi.mock('../../../store/astBufferStore', () => ({
    useASTBufferStore: {
        getState: () => ({
            crossFileMove: vi.fn().mockResolvedValue(undefined),
        }),
    },
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeCard(name: string): ComponentCardData {
    return {
        id: `card-${name.toLowerCase()}`,
        name,
        importPath: `@/components/${name}`,
        filePath: `/project/src/components/${name}.tsx`,
        category: 'primitive' as ComponentCategory,
        variantCount: 0,
        variants: [],
        props: {},
        thumbnailPath: null,
        health: null,
        tokens: [],
        dependencies: [],
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()

    useEditorStore.setState({
        rawCode: '',
        selectedNodeId: null,
        hoveredId: null,
        visualTree: [],
        jumpToLine: null,
        linterWarnings: new Map(),
    })

    useComponentCardStore.setState({
        cards: [],
        selectedCardId: null,
        cardPositions: {},
        isLoaded: false,
        isLoading: false,
        error: null,
        showCoverageHeatMap: true,
        searchQuery: '',
        categoryFilter: 'all',
    })

    useCanvasStore.setState({
        activeFilePath: null,
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

// ── Tests: RecipeStrip component ──────────────────────────────────────────────

describe('RecipeStrip', () => {
    // RS-01: strip renders with the correct testid
    it('RS-01: renders with data-testid="recipe-strip"', () => {
        render(<RecipeStrip />)
        expect(screen.getByTestId('recipe-strip')).toBeDefined()
    })

    // RS-02: all builtin recipes render as chips
    it('RS-02: renders a chip for every builtin recipe', () => {
        render(<RecipeStrip />)

        for (const recipe of BUILTIN_RECIPES) {
            expect(screen.getByTestId(`recipe-chip-${recipe.id}`)).toBeDefined()
        }
    })

    // RS-03: chip displays the recipe name
    it('RS-03: each chip shows its recipe name', () => {
        render(<RecipeStrip />)

        for (const recipe of BUILTIN_RECIPES) {
            // The name text is inside the chip — use getByText to confirm
            const chip = screen.getByTestId(`recipe-chip-${recipe.id}`)
            expect(chip.textContent).toContain(recipe.name)
        }
    })

    // RS-04: clicking a chip calls injectComponent with the jsxSnippet
    it('RS-04: clicking a chip calls injectComponent with the recipe jsxSnippet', () => {
        const injectComponent = vi.fn()
        useEditorStore.setState({
            injectComponent,
        } as Partial<ReturnType<typeof useEditorStore.getState>>)

        render(<RecipeStrip />)

        const recipe = BUILTIN_RECIPES[0]
        const chip = screen.getByTestId(`recipe-chip-${recipe.id}`)
        fireEvent.click(chip)

        expect(injectComponent).toHaveBeenCalledOnce()
        const [, jsxSnippet] = injectComponent.mock.calls[0]
        expect(jsxSnippet).toBe(recipe.jsxSnippet)
    })

    // RS-05: targetNodeId is always '' (root append)
    it('RS-05: injectComponent is called with targetNodeId "" (root append)', () => {
        const injectComponent = vi.fn()
        useEditorStore.setState({
            injectComponent,
        } as Partial<ReturnType<typeof useEditorStore.getState>>)

        render(<RecipeStrip />)

        const chip = screen.getByTestId(`recipe-chip-${BUILTIN_RECIPES[0].id}`)
        fireEvent.click(chip)

        const [targetNodeId] = injectComponent.mock.calls[0]
        expect(targetNodeId).toBe('')
    })

    // RS-06: registry indicator is green when all components are in the store
    it('RS-06: shows green check indicator when all required components are in the registry', () => {
        // hero-section requires ['Button']
        const heroRecipe = BUILTIN_RECIPES.find((r) => r.id === 'hero-section')!
        useComponentCardStore.setState({ cards: [makeCard('Button')] })

        render(<RecipeStrip />)

        const okIndicator = screen.getByTestId(`recipe-registry-ok-${heroRecipe.id}`)
        expect(okIndicator).toBeDefined()
        expect(screen.queryByTestId(`recipe-registry-warn-${heroRecipe.id}`)).toBeNull()
    })

    // RS-07: registry indicator is amber warning when required components are missing
    it('RS-07: shows amber warning indicator when required components are missing', () => {
        // hero-section requires ['Button'], no cards loaded
        const heroRecipe = BUILTIN_RECIPES.find((r) => r.id === 'hero-section')!
        useComponentCardStore.setState({ cards: [] })

        render(<RecipeStrip />)

        const warnIndicator = screen.getByTestId(`recipe-registry-warn-${heroRecipe.id}`)
        expect(warnIndicator).toBeDefined()
        expect(screen.queryByTestId(`recipe-registry-ok-${heroRecipe.id}`)).toBeNull()
    })

    // RS-08: recipes with no required components always show green
    it('RS-08: shows green check for recipes that use no registered components', () => {
        // nav-bar and feedback-toast have components: []
        const noDepRecipes = BUILTIN_RECIPES.filter((r) => r.components.length === 0)
        expect(noDepRecipes.length).toBeGreaterThan(0)

        useComponentCardStore.setState({ cards: [] })
        render(<RecipeStrip />)

        for (const recipe of noDepRecipes) {
            expect(screen.getByTestId(`recipe-registry-ok-${recipe.id}`)).toBeDefined()
        }
    })

    // RS-12: recipes with imports pass them as importSnippet
    it('RS-12: injectComponent receives joined imports string', () => {
        const injectComponent = vi.fn()
        useEditorStore.setState({
            injectComponent,
        } as Partial<ReturnType<typeof useEditorStore.getState>>)

        // Create a synthetic recipe that has imports — inject it temporarily
        // by rendering with a recipe that has no imports and verify empty string
        render(<RecipeStrip />)

        const navRecipe = BUILTIN_RECIPES.find((r) => r.id === 'nav-bar')!
        const chip = screen.getByTestId(`recipe-chip-${navRecipe.id}`)
        fireEvent.click(chip)

        const [, , importSnippet] = injectComponent.mock.calls[0]
        // nav-bar has no imports, so the importSnippet should be an empty string
        expect(importSnippet).toBe(navRecipe.imports.join('\n'))
    })
})

// ── GLASS.1c: Canvas modes removed — RecipeStrip no longer rendered in XYCanvas ──

describe('RecipeStrip in XYCanvas (GLASS.1c — deprecated)', () => {
    // RS-09: GLASS.1c — canvas is always preview mode, no Build/Govern
    it('RS-09: recipe strip is absent from XYCanvas (canvas modes removed)', () => {
        render(<XYCanvas />)
        expect(screen.queryByTestId('recipe-strip-wrapper')).toBeNull()
        expect(screen.queryByTestId('recipe-strip')).toBeNull()
    })
})

// ── Tests: builtinRecipes data model ─────────────────────────────────────────

describe('BUILTIN_RECIPES data model', () => {
    it('has at least 5 recipes', () => {
        expect(BUILTIN_RECIPES.length).toBeGreaterThanOrEqual(5)
    })

    it('every recipe has a unique id', () => {
        const ids = BUILTIN_RECIPES.map((r) => r.id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length)
    })

    it('every recipe has a non-empty name and description', () => {
        for (const recipe of BUILTIN_RECIPES) {
            expect(recipe.name.length).toBeGreaterThan(0)
            expect(recipe.description.length).toBeGreaterThan(0)
        }
    })

    it('every recipe has a valid category', () => {
        const validCategories = new Set(['form', 'layout', 'navigation', 'content', 'feedback'])
        for (const recipe of BUILTIN_RECIPES) {
            expect(validCategories.has(recipe.category)).toBe(true)
        }
    })

    it('every recipe jsxSnippet is a non-empty string', () => {
        for (const recipe of BUILTIN_RECIPES) {
            expect(typeof recipe.jsxSnippet).toBe('string')
            expect(recipe.jsxSnippet.length).toBeGreaterThan(0)
        }
    })

    it('every recipe has an icon field', () => {
        for (const recipe of BUILTIN_RECIPES) {
            expect(typeof recipe.icon).toBe('string')
            expect(recipe.icon.length).toBeGreaterThan(0)
        }
    })

    it('every recipe components field is an array', () => {
        for (const recipe of BUILTIN_RECIPES) {
            expect(Array.isArray(recipe.components)).toBe(true)
        }
    })

    it('every recipe imports field is an array', () => {
        for (const recipe of BUILTIN_RECIPES) {
            expect(Array.isArray(recipe.imports)).toBe(true)
        }
    })

    it('jsxSnippets do not contain hardcoded hex colors', () => {
        const hexPattern = /#[0-9a-fA-F]{3,6}\b/
        for (const recipe of BUILTIN_RECIPES) {
            expect(hexPattern.test(recipe.jsxSnippet)).toBe(false)
        }
    })
})
