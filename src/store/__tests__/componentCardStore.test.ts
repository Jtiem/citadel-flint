/**
 * componentCardStore.test.ts — src/store/__tests__/componentCardStore.test.ts
 *
 * Phase CV2.3: Component Cards on Canvas — store state transition tests.
 *
 * Contract: .flint-context/contracts/CV2.3-contract.md §6, §11
 *
 * Covers (13 tests, matching contract requirement):
 *   01 — Initial state is correct (empty arrays, null selection, not loading)
 *   02 — loadCards populates cards from IPC
 *   03 — loadCards merges persisted positions from IPC
 *   04 — Auto-layout fills missing positions for all loaded cards
 *   05 — selectCard updates selectedCardId
 *   06 — selectCard(null) clears selection
 *   07 — updatePosition updates a single card's position without touching others
 *   08 — clearCards resets all state to initial shape
 *   09 — toFlowNodes returns correct React Flow Node shape (type, position, data)
 *   10 — toFlowEdges returns edges when card A depends on card B's importPath
 *   11 — toFlowEdges returns empty array when no cards have dependencies
 *   12 — Auto-layout groups by category (Y positions differ between groups)
 *   13 — savePositions calls IPC with current positions (debounced — fast-forward)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useComponentCardStore } from '../componentCardStore'
import type { ComponentCardData } from '../componentCardStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<ComponentCardData> = {}): ComponentCardData {
    return {
        id: 'card-abc',
        name: 'Button',
        importPath: '@/components/ui/Button',
        filePath: '/project/src/components/primitives/Button.tsx',
        category: 'primitive',
        variantCount: 3,
        variants: [],
        props: { label: { type: 'string', required: true } },
        thumbnailPath: null,
        health: null,
        tokens: ['color.brand.primary'],
        dependencies: [],
        ...overrides,
    }
}

// ── Mock window.flintAPI ─────────────────────────────────────────────────────
//
// We mock the components namespace only. The store does not call any other
// flintAPI namespaces, so a minimal partial mock is sufficient and safe.

const mockList = vi.fn()
const mockSavePositions = vi.fn()
const mockLoadPositions = vi.fn()
const mockSetCategory = vi.fn()

// ── Mock notificationStore ────────────────────────────────────────────────────
// setCategoryOverride calls useNotificationStore.getState().push() on success/failure.
// We stub it out to avoid real notification side-effects in tests.

vi.mock('../../store/notificationStore', () => ({
    useNotificationStore: {
        getState: () => ({ push: vi.fn() }),
    },
}))

beforeEach(() => {
    // Reset store to initial state before each test.
    useComponentCardStore.setState({
        cards: [],
        selectedCardId: null,
        cardPositions: {},
        isLoaded: false,
        isLoading: false,
        error: null,
        showCoverageHeatMap: true,
    })

    mockList.mockReset()
    mockSavePositions.mockReset()
    mockLoadPositions.mockReset()
    mockSetCategory.mockReset()

    // Default happy-path returns.
    mockList.mockResolvedValue([])
    mockSavePositions.mockResolvedValue(undefined)
    mockLoadPositions.mockResolvedValue({})
    mockSetCategory.mockResolvedValue(undefined)

    // Attach to window so the store can call it (jsdom environment).
    ;(window as unknown as { flintAPI: unknown }).flintAPI = {
        components: {
            list: mockList,
            savePositions: mockSavePositions,
            loadPositions: mockLoadPositions,
            setCategory: mockSetCategory,
        },
    }

    // Use fake timers to control the 500 ms save debounce.
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

// ── Test 01: Initial state ─────────────────────────────────────────────────────

describe('componentCardStore — initial state (01)', () => {
    it('starts with empty cards, null selection, no positions, not loaded', () => {
        const state = useComponentCardStore.getState()

        expect(state.cards).toEqual([])
        expect(state.selectedCardId).toBeNull()
        expect(state.cardPositions).toEqual({})
        expect(state.isLoaded).toBe(false)
        expect(state.isLoading).toBe(false)
        expect(state.error).toBeNull()
    })
})

// ── Test 02: loadCards populates cards ────────────────────────────────────────

describe('componentCardStore — loadCards populates cards (02)', () => {
    it('fetches cards from IPC and stores them', async () => {
        const card = makeCard()
        mockList.mockResolvedValue([card])
        mockLoadPositions.mockResolvedValue({})

        await useComponentCardStore.getState().loadCards()

        const { cards, isLoaded, isLoading } = useComponentCardStore.getState()
        expect(cards).toHaveLength(1)
        expect(cards[0].id).toBe('card-abc')
        expect(cards[0].name).toBe('Button')
        expect(isLoaded).toBe(true)
        expect(isLoading).toBe(false)
    })

    it('sets isLoading to true while the IPC call is in flight', async () => {
        let resolveList!: (v: ComponentCardData[]) => void
        mockList.mockReturnValue(new Promise((r) => { resolveList = r }))
        mockLoadPositions.mockResolvedValue({})

        const loadPromise = useComponentCardStore.getState().loadCards()
        expect(useComponentCardStore.getState().isLoading).toBe(true)

        resolveList([])
        await loadPromise
        expect(useComponentCardStore.getState().isLoading).toBe(false)
    })
})

// ── Test 03: loadCards merges persisted positions ─────────────────────────────

describe('componentCardStore — loadCards merges persisted positions (03)', () => {
    it('incorporates saved positions from components:load-positions', async () => {
        const card = makeCard({ id: 'card-abc' })
        mockList.mockResolvedValue([card])
        mockLoadPositions.mockResolvedValue({
            'card-abc': { x: 100, y: 200 },
        })

        await useComponentCardStore.getState().loadCards()

        const { cardPositions } = useComponentCardStore.getState()
        expect(cardPositions['card-abc']).toEqual({ x: 100, y: 200 })
    })

    it('saved positions take precedence over auto-layout positions', async () => {
        const card = makeCard({ id: 'card-abc', category: 'primitive' })
        mockList.mockResolvedValue([card])
        // Saved position (300, 400) — far from auto-layout origin (0, 0).
        mockLoadPositions.mockResolvedValue({
            'card-abc': { x: 300, y: 400 },
        })

        await useComponentCardStore.getState().loadCards()

        const { cardPositions } = useComponentCardStore.getState()
        expect(cardPositions['card-abc']).toEqual({ x: 300, y: 400 })
    })
})

// ── Test 04: Auto-layout fills missing positions ───────────────────────────────

describe('componentCardStore — auto-layout fills missing positions (04)', () => {
    it('assigns positions to all cards when no saved positions exist', async () => {
        const cards = [
            makeCard({ id: 'card-1', name: 'Alpha', category: 'primitive' }),
            makeCard({ id: 'card-2', name: 'Beta', category: 'primitive' }),
            makeCard({ id: 'card-3', name: 'Gamma', category: 'molecule' }),
        ]
        mockList.mockResolvedValue(cards)
        mockLoadPositions.mockResolvedValue({})

        await useComponentCardStore.getState().loadCards()

        const { cardPositions } = useComponentCardStore.getState()

        // All three cards must have positions.
        expect(cardPositions['card-1']).toBeDefined()
        expect(cardPositions['card-2']).toBeDefined()
        expect(cardPositions['card-3']).toBeDefined()

        // Positions are objects with numeric x and y.
        for (const id of ['card-1', 'card-2', 'card-3']) {
            expect(typeof cardPositions[id].x).toBe('number')
            expect(typeof cardPositions[id].y).toBe('number')
        }
    })
})

// ── Test 05: selectCard updates selectedCardId ────────────────────────────────

describe('componentCardStore — selectCard (05)', () => {
    it('sets selectedCardId to the provided ID', () => {
        useComponentCardStore.getState().selectCard('card-xyz')

        expect(useComponentCardStore.getState().selectedCardId).toBe('card-xyz')
    })

    it('replaces a prior selection', () => {
        useComponentCardStore.setState({ selectedCardId: 'old-id' })
        useComponentCardStore.getState().selectCard('new-id')

        expect(useComponentCardStore.getState().selectedCardId).toBe('new-id')
    })
})

// ── Test 06: selectCard(null) clears selection ────────────────────────────────

describe('componentCardStore — selectCard(null) clears selection (06)', () => {
    it('sets selectedCardId to null when called with null', () => {
        useComponentCardStore.setState({ selectedCardId: 'card-abc' })
        useComponentCardStore.getState().selectCard(null)

        expect(useComponentCardStore.getState().selectedCardId).toBeNull()
    })
})

// ── Test 07: updatePosition updates a single card ────────────────────────────

describe('componentCardStore — updatePosition (07)', () => {
    it('updates only the specified card position', () => {
        useComponentCardStore.setState({
            cardPositions: {
                'card-a': { x: 0, y: 0 },
                'card-b': { x: 50, y: 50 },
            },
        })

        useComponentCardStore.getState().updatePosition('card-a', { x: 999, y: 888 })

        const { cardPositions } = useComponentCardStore.getState()
        expect(cardPositions['card-a']).toEqual({ x: 999, y: 888 })
        // card-b must be untouched.
        expect(cardPositions['card-b']).toEqual({ x: 50, y: 50 })
    })

    it('adds a new position for a card that had no prior entry', () => {
        useComponentCardStore.setState({ cardPositions: {} })
        useComponentCardStore.getState().updatePosition('card-new', { x: 10, y: 20 })

        expect(useComponentCardStore.getState().cardPositions['card-new']).toEqual({ x: 10, y: 20 })
    })
})

// ── Test 08: clearCards resets all state ──────────────────────────────────────

describe('componentCardStore — clearCards resets all state (08)', () => {
    it('resets to initial values after being populated', async () => {
        // Populate the store.
        useComponentCardStore.setState({
            cards: [makeCard()],
            selectedCardId: 'card-abc',
            cardPositions: { 'card-abc': { x: 100, y: 200 } },
            isLoaded: true,
            isLoading: false,
            error: null,
        })

        useComponentCardStore.getState().clearCards()

        const state = useComponentCardStore.getState()
        expect(state.cards).toEqual([])
        expect(state.selectedCardId).toBeNull()
        expect(state.cardPositions).toEqual({})
        expect(state.isLoaded).toBe(false)
        expect(state.isLoading).toBe(false)
        expect(state.error).toBeNull()
    })
})

// ── Test 09: toFlowNodes returns correct Node shape ───────────────────────────

describe('componentCardStore — toFlowNodes (09)', () => {
    it('returns a Node with type componentCard, correct position, and data', () => {
        const card = makeCard()
        useComponentCardStore.setState({
            cards: [card],
            cardPositions: { 'card-abc': { x: 120, y: 240 } },
            selectedCardId: null,
        })

        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(1)
        expect(nodes[0].id).toBe('card-abc')
        expect(nodes[0].type).toBe('componentCard')
        expect(nodes[0].position).toEqual({ x: 120, y: 240 })
        expect(nodes[0].data.card).toEqual(card)
        expect(nodes[0].data.isSelected).toBe(false)
    })

    it('marks the selected card as isSelected: true', () => {
        const card = makeCard()
        useComponentCardStore.setState({
            cards: [card],
            cardPositions: { 'card-abc': { x: 0, y: 0 } },
            selectedCardId: 'card-abc',
        })

        const nodes = useComponentCardStore.getState().toFlowNodes('govern')

        expect(nodes[0].data.isSelected).toBe(true)
    })
})

// ── Test 10: toFlowEdges returns edges for dependent cards ────────────────────

describe('componentCardStore — toFlowEdges with dependencies (10)', () => {
    it('creates an edge from source to target when source depends on target', () => {
        const cardA: ComponentCardData = makeCard({
            id: 'card-a',
            name: 'Organism',
            importPath: '@/components/organisms/Organism',
            dependencies: ['@/components/primitives/Button'],
        })
        const cardB: ComponentCardData = makeCard({
            id: 'card-b',
            name: 'Button',
            importPath: '@/components/primitives/Button',
            dependencies: [],
        })
        useComponentCardStore.setState({
            cards: [cardA, cardB],
            cardPositions: {
                'card-a': { x: 0, y: 0 },
                'card-b': { x: 250, y: 0 },
            },
        })

        const edges = useComponentCardStore.getState().toFlowEdges()

        expect(edges).toHaveLength(1)
        expect(edges[0].source).toBe('card-a')
        expect(edges[0].target).toBe('card-b')
        expect(edges[0].type).toBe('dependency')
        // Card B has no health data — targetGrade should be null.
        expect(edges[0].data?.targetGrade).toBeNull()
    })

    it('includes targetGrade from the target card health when available', () => {
        const cardA: ComponentCardData = makeCard({
            id: 'card-a',
            importPath: '@/components/organisms/Organism',
            dependencies: ['@/components/primitives/Button'],
        })
        const cardB: ComponentCardData = makeCard({
            id: 'card-b',
            name: 'Button',
            importPath: '@/components/primitives/Button',
            health: { grade: 'B', maxDeltaE: 1.2, violationCount: 1, mithrilCount: 1, a11yCount: 0 },
            dependencies: [],
        })
        useComponentCardStore.setState({
            cards: [cardA, cardB],
            cardPositions: {},
        })

        const edges = useComponentCardStore.getState().toFlowEdges()

        expect(edges[0].data?.targetGrade).toBe('B')
    })
})

// ── Test 11: toFlowEdges returns empty when no dependencies ───────────────────

describe('componentCardStore — toFlowEdges with no dependencies (11)', () => {
    it('returns empty array when cards have no dependencies', () => {
        useComponentCardStore.setState({
            cards: [
                makeCard({ id: 'card-1', dependencies: [] }),
                makeCard({ id: 'card-2', dependencies: [] }),
            ],
            cardPositions: {},
        })

        const edges = useComponentCardStore.getState().toFlowEdges()

        expect(edges).toEqual([])
    })

    it('returns empty array when store has no cards', () => {
        useComponentCardStore.setState({ cards: [] })

        const edges = useComponentCardStore.getState().toFlowEdges()

        expect(edges).toEqual([])
    })
})

// ── Test 12: Auto-layout groups by category ───────────────────────────────────

describe('componentCardStore — auto-layout groups by category (12)', () => {
    it('places molecule cards below primitive cards in the Y axis', async () => {
        const primitive = makeCard({
            id: 'prim-1',
            name: 'Button',
            filePath: '/project/src/components/primitives/Button.tsx',
            category: 'primitive',
        })
        const molecule = makeCard({
            id: 'mol-1',
            name: 'SearchBar',
            filePath: '/project/src/components/molecules/SearchBar.tsx',
            category: 'molecule',
        })

        mockList.mockResolvedValue([primitive, molecule])
        mockLoadPositions.mockResolvedValue({})

        await useComponentCardStore.getState().loadCards()

        const { cardPositions } = useComponentCardStore.getState()
        // Both must have positions.
        expect(cardPositions['prim-1']).toBeDefined()
        expect(cardPositions['mol-1']).toBeDefined()

        // The molecule group starts below the primitive group (higher Y value).
        expect(cardPositions['mol-1'].y).toBeGreaterThan(cardPositions['prim-1'].y)
    })

    it('places all primitive cards in the same or adjacent rows (x grid)', async () => {
        // 4 primitives fill exactly one row: col 0-3, y=0.
        const primitives = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((name, i) =>
            makeCard({
                id: `prim-${i}`,
                name,
                category: 'primitive',
                filePath: '/project/src/components/primitives/X.tsx',
            })
        )

        mockList.mockResolvedValue(primitives)
        mockLoadPositions.mockResolvedValue({})

        await useComponentCardStore.getState().loadCards()

        const { cardPositions } = useComponentCardStore.getState()

        // All 4 should share y=0 (same row — grid has 4 columns).
        for (let i = 0; i < 4; i++) {
            expect(cardPositions[`prim-${i}`].y).toBe(0)
        }
    })
})

// ── Test 13: savePositions calls IPC ─────────────────────────────────────────

describe('componentCardStore — savePositions calls IPC (13)', () => {
    it('calls components:save-positions after 500 ms debounce', async () => {
        useComponentCardStore.setState({
            cardPositions: {
                'card-a': { x: 10, y: 20 },
                'card-b': { x: 30, y: 40 },
            },
        })

        useComponentCardStore.getState().savePositions()

        // IPC must NOT have been called yet (debounce pending).
        expect(mockSavePositions).not.toHaveBeenCalled()

        // Advance fake timers past the 500 ms window.
        vi.advanceTimersByTime(500)

        // Wait for the Promise chain inside the debounce callback to settle.
        await vi.runAllTimersAsync()

        expect(mockSavePositions).toHaveBeenCalledOnce()
        expect(mockSavePositions).toHaveBeenCalledWith({
            'card-a': { x: 10, y: 20 },
            'card-b': { x: 30, y: 40 },
        })
    })

    it('coalesces rapid savePositions calls into one IPC call', async () => {
        useComponentCardStore.setState({
            cardPositions: { 'card-a': { x: 0, y: 0 } },
        })

        // Call savePositions 3 times in quick succession.
        useComponentCardStore.getState().savePositions()
        useComponentCardStore.getState().savePositions()
        useComponentCardStore.getState().savePositions()

        vi.advanceTimersByTime(500)
        await vi.runAllTimersAsync()

        // Exactly one IPC call despite three savePositions() calls.
        expect(mockSavePositions).toHaveBeenCalledOnce()
    })
})

// ── Edge case: error handling in loadCards ────────────────────────────────────

describe('componentCardStore — error handling in loadCards', () => {
    it('sets error state when components:list IPC rejects', async () => {
        mockList.mockRejectedValue(new Error('IPC failure'))
        mockLoadPositions.mockResolvedValue({})

        await useComponentCardStore.getState().loadCards()

        const { cards, error, isLoaded, isLoading } = useComponentCardStore.getState()
        expect(cards).toEqual([])
        expect(error).toBe('IPC failure')
        expect(isLoaded).toBe(true)
        expect(isLoading).toBe(false)
    })
})

// ── CV2.6: setCategoryOverride store tests ────────────────────────────────────

describe('componentCardStore — setCategoryOverride (CV2.6)', () => {
    // Test 14: setCategoryOverride updates card category in state optimistically
    it('14 — updates card category in local state immediately (optimistic)', () => {
        const card = makeCard({ id: 'card-abc', category: 'uncategorized' })
        useComponentCardStore.setState({ cards: [card] })

        useComponentCardStore.getState().setCategoryOverride('card-abc', 'molecule')

        const { cards } = useComponentCardStore.getState()
        expect(cards[0].category).toBe('molecule')
    })

    // Test 15: setCategoryOverride calls window.flintAPI.components.setCategory
    it('15 — calls IPC setCategory with the correct componentId and category', () => {
        const card = makeCard({ id: 'card-abc', category: 'uncategorized' })
        useComponentCardStore.setState({ cards: [card] })

        useComponentCardStore.getState().setCategoryOverride('card-abc', 'primitive')

        expect(mockSetCategory).toHaveBeenCalledOnce()
        expect(mockSetCategory).toHaveBeenCalledWith({
            componentId: 'card-abc',
            category: 'primitive',
        })
    })

    // Test 16: Other cards are not affected by the override
    it('16 — does not mutate other cards when applying override', () => {
        const cardA = makeCard({ id: 'card-a', category: 'uncategorized' })
        const cardB = makeCard({ id: 'card-b', category: 'primitive' })
        useComponentCardStore.setState({ cards: [cardA, cardB] })

        useComponentCardStore.getState().setCategoryOverride('card-a', 'organism')

        const { cards } = useComponentCardStore.getState()
        expect(cards.find((c) => c.id === 'card-b')?.category).toBe('primitive')
    })

    // Test 17: setCategoryOverride reverts on IPC failure
    it('17 — reverts card category when IPC call fails', async () => {
        mockSetCategory.mockRejectedValue(new Error('IPC error'))
        const card = makeCard({ id: 'card-abc', category: 'uncategorized' })
        useComponentCardStore.setState({ cards: [card] })

        useComponentCardStore.getState().setCategoryOverride('card-abc', 'layout')

        // Optimistic update is applied immediately.
        expect(useComponentCardStore.getState().cards[0].category).toBe('layout')

        // Flush the Promise rejection.
        await vi.runAllTimersAsync()
        // Must flush microtasks for the .catch handler to run.
        await Promise.resolve()

        // State should be reverted back.
        expect(useComponentCardStore.getState().cards[0].category).toBe('uncategorized')
    })

    // Test 18: setCategoryOverride is a no-op when cardId is not found
    it('18 — does nothing when the cardId does not exist in the store', () => {
        useComponentCardStore.setState({ cards: [] })

        // Should not throw.
        expect(() => {
            useComponentCardStore.getState().setCategoryOverride('nonexistent-id', 'molecule')
        }).not.toThrow()

        // IPC must not be called for an unknown card.
        expect(mockSetCategory).not.toHaveBeenCalled()
    })
})

// ── Governance Stickers ────────────────────────────────────────────────────────

describe('componentCardStore — addSticker', () => {
    beforeEach(() => {
        useComponentCardStore.setState({ stickers: [] })
    })

    it('S-01 — adds a sticker to the stickers array', () => {
        useComponentCardStore.getState().addSticker('card-abc', 'needs-review')

        const { stickers } = useComponentCardStore.getState()
        expect(stickers).toHaveLength(1)
        expect(stickers[0].componentId).toBe('card-abc')
        expect(stickers[0].type).toBe('needs-review')
    })

    it('S-02 — generated sticker has a non-empty id and a valid ISO timestamp', () => {
        useComponentCardStore.getState().addSticker('card-abc', 'approved')

        const { stickers } = useComponentCardStore.getState()
        const sticker = stickers[0]
        expect(typeof sticker.id).toBe('string')
        expect(sticker.id.length).toBeGreaterThan(0)
        // ISO 8601 string — parseable as a Date.
        expect(isNaN(Date.parse(sticker.createdAt))).toBe(false)
    })

    it('S-03 — stores the optional note on the sticker', () => {
        useComponentCardStore.getState().addSticker('card-abc', 'wip', 'WIP until next sprint')

        const { stickers } = useComponentCardStore.getState()
        expect(stickers[0].note).toBe('WIP until next sprint')
    })

    it('S-04 — does not add a duplicate sticker of the same type on the same card', () => {
        useComponentCardStore.getState().addSticker('card-abc', 'blocked')
        useComponentCardStore.getState().addSticker('card-abc', 'blocked')

        const { stickers } = useComponentCardStore.getState()
        expect(stickers).toHaveLength(1)
    })

    it('S-05 — allows two different sticker types on the same card', () => {
        useComponentCardStore.getState().addSticker('card-abc', 'needs-review')
        useComponentCardStore.getState().addSticker('card-abc', 'deprecated')

        const { stickers } = useComponentCardStore.getState()
        expect(stickers).toHaveLength(2)
    })

    it('S-06 — allows the same sticker type on two different cards', () => {
        useComponentCardStore.getState().addSticker('card-1', 'approved')
        useComponentCardStore.getState().addSticker('card-2', 'approved')

        const { stickers } = useComponentCardStore.getState()
        expect(stickers).toHaveLength(2)
        expect(stickers.map((s) => s.componentId)).toEqual(['card-1', 'card-2'])
    })
})

describe('componentCardStore — removeSticker', () => {
    beforeEach(() => {
        useComponentCardStore.setState({ stickers: [] })
    })

    it('S-07 — removes the sticker with the matching id', () => {
        useComponentCardStore.getState().addSticker('card-abc', 'wip')

        const before = useComponentCardStore.getState().stickers
        expect(before).toHaveLength(1)

        useComponentCardStore.getState().removeSticker(before[0].id)

        const after = useComponentCardStore.getState().stickers
        expect(after).toHaveLength(0)
    })

    it('S-08 — does not remove other stickers when removing by id', () => {
        useComponentCardStore.getState().addSticker('card-abc', 'wip')
        useComponentCardStore.getState().addSticker('card-abc', 'blocked')

        const [first, second] = useComponentCardStore.getState().stickers

        useComponentCardStore.getState().removeSticker(first.id)

        const remaining = useComponentCardStore.getState().stickers
        expect(remaining).toHaveLength(1)
        expect(remaining[0].id).toBe(second.id)
    })

    it('S-09 — is a no-op when the sticker id does not exist', () => {
        useComponentCardStore.getState().addSticker('card-abc', 'approved')

        // Remove with a non-existent id.
        expect(() => {
            useComponentCardStore.getState().removeSticker('does-not-exist')
        }).not.toThrow()

        expect(useComponentCardStore.getState().stickers).toHaveLength(1)
    })
})

describe('componentCardStore — getStickersForCard', () => {
    beforeEach(() => {
        useComponentCardStore.setState({ stickers: [] })
    })

    it('S-10 — returns only stickers for the given componentId', () => {
        useComponentCardStore.getState().addSticker('card-1', 'approved')
        useComponentCardStore.getState().addSticker('card-2', 'wip')
        useComponentCardStore.getState().addSticker('card-1', 'deprecated')

        const card1Stickers = useComponentCardStore.getState().getStickersForCard('card-1')
        expect(card1Stickers).toHaveLength(2)
        expect(card1Stickers.every((s) => s.componentId === 'card-1')).toBe(true)
    })

    it('S-11 — returns an empty array when the card has no stickers', () => {
        useComponentCardStore.getState().addSticker('card-other', 'blocked')

        const result = useComponentCardStore.getState().getStickersForCard('card-empty')
        expect(result).toEqual([])
    })

    it('S-12 — clearCards resets stickers to empty', () => {
        useComponentCardStore.getState().addSticker('card-abc', 'needs-review')
        expect(useComponentCardStore.getState().stickers).toHaveLength(1)

        useComponentCardStore.getState().clearCards()

        expect(useComponentCardStore.getState().stickers).toEqual([])
    })
})

// ── CV2.7: Search + filter tests ──────────────────────────────────────────────

describe('componentCardStore — CV2.7 setSearchQuery (19)', () => {
    it('19 — setSearchQuery updates searchQuery in state', () => {
        useComponentCardStore.getState().setSearchQuery('Button')

        expect(useComponentCardStore.getState().searchQuery).toBe('Button')
    })

    it('setSearchQuery replaces the prior query', () => {
        useComponentCardStore.setState({ searchQuery: 'old' })
        useComponentCardStore.getState().setSearchQuery('new')

        expect(useComponentCardStore.getState().searchQuery).toBe('new')
    })
})

describe('componentCardStore — CV2.7 setCategoryFilter (20)', () => {
    it('20 — setCategoryFilter updates categoryFilter in state', () => {
        useComponentCardStore.getState().setCategoryFilter('organism')

        expect(useComponentCardStore.getState().categoryFilter).toBe('organism')
    })

    it('setCategoryFilter accepts "all" to reset the filter', () => {
        useComponentCardStore.setState({ categoryFilter: 'primitive' })
        useComponentCardStore.getState().setCategoryFilter('all')

        expect(useComponentCardStore.getState().categoryFilter).toBe('all')
    })
})

describe('componentCardStore — CV2.7 toFlowNodes search filter (21)', () => {
    const buttonCard = makeCard({ id: 'card-btn', name: 'Button', category: 'primitive' })
    const inputCard = makeCard({ id: 'card-inp', name: 'Input', category: 'primitive' })
    const searchBarCard = makeCard({ id: 'card-sb', name: 'SearchBar', category: 'molecule' })

    beforeEach(() => {
        useComponentCardStore.setState({
            cards: [buttonCard, inputCard, searchBarCard],
            cardPositions: {
                'card-btn': { x: 0, y: 0 },
                'card-inp': { x: 250, y: 0 },
                'card-sb': { x: 0, y: 300 },
            },
            searchQuery: '',
            categoryFilter: 'all',
        })
    })

    it('21 — empty searchQuery returns all cards (no filter)', () => {
        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(3)
    })

    it('filters by name substring (case-insensitive)', () => {
        useComponentCardStore.setState({ searchQuery: 'button' })

        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(1)
        expect(nodes[0].id).toBe('card-btn')
    })

    it('matches uppercase query against lowercase name', () => {
        useComponentCardStore.setState({ searchQuery: 'SEARCH' })

        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(1)
        expect(nodes[0].id).toBe('card-sb')
    })

    it('returns an empty array when no card name matches the query', () => {
        useComponentCardStore.setState({ searchQuery: 'zzznomatch' })

        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(0)
    })
})

describe('componentCardStore — CV2.7 toFlowNodes category filter (22)', () => {
    const primitiveCard = makeCard({ id: 'card-prim', name: 'Button', category: 'primitive' })
    const moleculeCard = makeCard({ id: 'card-mol', name: 'SearchBar', category: 'molecule' })

    beforeEach(() => {
        useComponentCardStore.setState({
            cards: [primitiveCard, moleculeCard],
            cardPositions: {
                'card-prim': { x: 0, y: 0 },
                'card-mol': { x: 250, y: 0 },
            },
            searchQuery: '',
            categoryFilter: 'all',
        })
    })

    it('22 — categoryFilter "all" returns all cards', () => {
        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(2)
    })

    it('filters to only cards in the selected category', () => {
        useComponentCardStore.setState({ categoryFilter: 'primitive' })

        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(1)
        expect(nodes[0].id).toBe('card-prim')
    })

    it('returns empty when no card belongs to the selected category', () => {
        useComponentCardStore.setState({ categoryFilter: 'page' })

        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(0)
    })
})

describe('componentCardStore — CV2.7 toFlowNodes combined filters (23)', () => {
    const btnPrim = makeCard({ id: 'card-a', name: 'Button', category: 'primitive' })
    const inputPrim = makeCard({ id: 'card-b', name: 'Input', category: 'primitive' })
    const searchMol = makeCard({ id: 'card-c', name: 'SearchBar', category: 'molecule' })

    beforeEach(() => {
        useComponentCardStore.setState({
            cards: [btnPrim, inputPrim, searchMol],
            cardPositions: {
                'card-a': { x: 0, y: 0 },
                'card-b': { x: 250, y: 0 },
                'card-c': { x: 0, y: 300 },
            },
            searchQuery: '',
            categoryFilter: 'all',
        })
    })

    it('23 — applies both searchQuery and categoryFilter simultaneously (AND logic)', () => {
        // Search "button" + category "primitive" → only card-a matches both.
        useComponentCardStore.setState({ searchQuery: 'button', categoryFilter: 'primitive' })

        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(1)
        expect(nodes[0].id).toBe('card-a')
    })

    it('returns empty when search matches but category does not', () => {
        // "SearchBar" exists but is a molecule, not a primitive.
        useComponentCardStore.setState({ searchQuery: 'search', categoryFilter: 'primitive' })

        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(0)
    })

    it('returns empty when category matches but search does not', () => {
        // category=primitive has Button + Input, but "zzz" matches neither.
        useComponentCardStore.setState({ searchQuery: 'zzz', categoryFilter: 'primitive' })

        const nodes = useComponentCardStore.getState().toFlowNodes('build')

        expect(nodes).toHaveLength(0)
    })
})

describe('componentCardStore — CV2.7 toFlowEdges only includes visible cards (24)', () => {
    it('24 — edges are omitted when source card is filtered out', () => {
        const cardA: ComponentCardData = makeCard({
            id: 'card-a',
            name: 'Organism',
            importPath: '@/components/organisms/Organism',
            category: 'organism',
            dependencies: ['@/components/primitives/Button'],
        })
        const cardB: ComponentCardData = makeCard({
            id: 'card-b',
            name: 'Button',
            importPath: '@/components/primitives/Button',
            category: 'primitive',
            dependencies: [],
        })
        useComponentCardStore.setState({
            cards: [cardA, cardB],
            cardPositions: {
                'card-a': { x: 0, y: 0 },
                'card-b': { x: 250, y: 0 },
            },
            // Filter hides card-a (the source), so no edges should be produced.
            searchQuery: 'Button',
            categoryFilter: 'all',
        })

        const edges = useComponentCardStore.getState().toFlowEdges()

        expect(edges).toHaveLength(0)
    })

    it('edges are omitted when target card is filtered out', () => {
        const cardA: ComponentCardData = makeCard({
            id: 'card-a',
            name: 'Organism',
            importPath: '@/components/organisms/Organism',
            category: 'organism',
            dependencies: ['@/components/primitives/Button'],
        })
        const cardB: ComponentCardData = makeCard({
            id: 'card-b',
            name: 'Button',
            importPath: '@/components/primitives/Button',
            category: 'primitive',
            dependencies: [],
        })
        useComponentCardStore.setState({
            cards: [cardA, cardB],
            cardPositions: {
                'card-a': { x: 0, y: 0 },
                'card-b': { x: 250, y: 0 },
            },
            // Filter hides card-b (the target), so the edge cannot resolve.
            searchQuery: 'Organism',
            categoryFilter: 'all',
        })

        const edges = useComponentCardStore.getState().toFlowEdges()

        expect(edges).toHaveLength(0)
    })

    it('returns edges when both source and target pass the filter', () => {
        const cardA: ComponentCardData = makeCard({
            id: 'card-a',
            name: 'Organism',
            importPath: '@/components/organisms/Organism',
            category: 'organism',
            dependencies: ['@/components/primitives/Button'],
        })
        const cardB: ComponentCardData = makeCard({
            id: 'card-b',
            name: 'Button',
            importPath: '@/components/primitives/Button',
            category: 'primitive',
            dependencies: [],
        })
        useComponentCardStore.setState({
            cards: [cardA, cardB],
            cardPositions: {
                'card-a': { x: 0, y: 0 },
                'card-b': { x: 250, y: 0 },
            },
            // No filters — both cards visible.
            searchQuery: '',
            categoryFilter: 'all',
        })

        const edges = useComponentCardStore.getState().toFlowEdges()

        expect(edges).toHaveLength(1)
        expect(edges[0].source).toBe('card-a')
        expect(edges[0].target).toBe('card-b')
    })
})

describe('componentCardStore — CV2.7 clearCards resets filters (25)', () => {
    it('25 — clearCards resets searchQuery and categoryFilter to defaults', () => {
        useComponentCardStore.setState({
            cards: [makeCard()],
            searchQuery: 'button',
            categoryFilter: 'primitive',
        })

        useComponentCardStore.getState().clearCards()

        const { searchQuery, categoryFilter } = useComponentCardStore.getState()
        expect(searchQuery).toBe('')
        expect(categoryFilter).toBe('all')
    })
})

// ── Coverage Heat Map store tests ─────────────────────────────────────────────

describe('componentCardStore — showCoverageHeatMap defaults (26)', () => {
    it('26 — showCoverageHeatMap defaults to true', () => {
        expect(useComponentCardStore.getState().showCoverageHeatMap).toBe(true)
    })
})

describe('componentCardStore — toggleCoverageHeatMap (27)', () => {
    it('27 — toggleCoverageHeatMap flips showCoverageHeatMap from true to false', () => {
        useComponentCardStore.setState({ showCoverageHeatMap: true })
        useComponentCardStore.getState().toggleCoverageHeatMap()

        expect(useComponentCardStore.getState().showCoverageHeatMap).toBe(false)
    })

    it('27b — toggleCoverageHeatMap flips showCoverageHeatMap from false to true', () => {
        useComponentCardStore.setState({ showCoverageHeatMap: false })
        useComponentCardStore.getState().toggleCoverageHeatMap()

        expect(useComponentCardStore.getState().showCoverageHeatMap).toBe(true)
    })

    it('27c — repeated toggles correctly alternate the value', () => {
        useComponentCardStore.setState({ showCoverageHeatMap: true })
        const toggle = useComponentCardStore.getState().toggleCoverageHeatMap

        toggle()
        expect(useComponentCardStore.getState().showCoverageHeatMap).toBe(false)
        toggle()
        expect(useComponentCardStore.getState().showCoverageHeatMap).toBe(true)
        toggle()
        expect(useComponentCardStore.getState().showCoverageHeatMap).toBe(false)
    })
})

describe('componentCardStore — coverage summary computation (28)', () => {
    it('28 — governed count is the sum of A and B grade cards', () => {
        // A + B = governed; C/D/F = not governed.
        const cards: ComponentCardData[] = [
            makeCard({ id: 'c1', health: { grade: 'A', maxDeltaE: 0.5, violationCount: 0, mithrilCount: 0, a11yCount: 0 } }),
            makeCard({ id: 'c2', health: { grade: 'A', maxDeltaE: 0.8, violationCount: 0, mithrilCount: 0, a11yCount: 0 } }),
            makeCard({ id: 'c3', health: { grade: 'B', maxDeltaE: 1.5, violationCount: 1, mithrilCount: 1, a11yCount: 0 } }),
            makeCard({ id: 'c4', health: { grade: 'C', maxDeltaE: 3.2, violationCount: 3, mithrilCount: 2, a11yCount: 1 } }),
            makeCard({ id: 'c5', health: null }),
        ]
        useComponentCardStore.setState({
            cards,
            cardPositions: {
                'c1': { x: 0, y: 0 },
                'c2': { x: 250, y: 0 },
                'c3': { x: 500, y: 0 },
                'c4': { x: 0, y: 300 },
                'c5': { x: 250, y: 300 },
            },
            searchQuery: '',
            categoryFilter: 'all',
        })

        const nodes = useComponentCardStore.getState().toFlowNodes('govern')

        // Derive the same summary logic the XYCanvas uses.
        let gradeA = 0, gradeB = 0, gradeC = 0, gradeD = 0, gradeF = 0, noData = 0
        for (const n of nodes) {
            const grade = n.data.card.health?.grade ?? null
            if (grade === 'A') gradeA++
            else if (grade === 'B') gradeB++
            else if (grade === 'C') gradeC++
            else if (grade === 'D') gradeD++
            else if (grade === 'F') gradeF++
            else noData++
        }

        expect(gradeA).toBe(2)
        expect(gradeB).toBe(1)
        expect(gradeC).toBe(1)
        expect(gradeD).toBe(0)
        expect(gradeF).toBe(0)
        expect(noData).toBe(1)

        const governedPct = Math.round(((gradeA + gradeB) / nodes.length) * 100)
        expect(governedPct).toBe(60) // 3 out of 5 = 60%
    })

    it('28b — governed percentage is 100 when all cards are grade A', () => {
        const cards: ComponentCardData[] = [
            makeCard({ id: 'c1', health: { grade: 'A', maxDeltaE: 0.1, violationCount: 0, mithrilCount: 0, a11yCount: 0 } }),
            makeCard({ id: 'c2', health: { grade: 'A', maxDeltaE: 0.2, violationCount: 0, mithrilCount: 0, a11yCount: 0 } }),
        ]
        useComponentCardStore.setState({
            cards,
            cardPositions: { 'c1': { x: 0, y: 0 }, 'c2': { x: 250, y: 0 } },
            searchQuery: '',
            categoryFilter: 'all',
        })

        const nodes = useComponentCardStore.getState().toFlowNodes('govern')
        const gradeA = nodes.filter((n) => n.data.card.health?.grade === 'A').length
        const governedPct = Math.round((gradeA / nodes.length) * 100)

        expect(governedPct).toBe(100)
    })

    it('28c — governed percentage is 0 when all cards are grade F', () => {
        const cards: ComponentCardData[] = [
            makeCard({ id: 'c1', health: { grade: 'F', maxDeltaE: 12, violationCount: 10, mithrilCount: 8, a11yCount: 2 } }),
        ]
        useComponentCardStore.setState({
            cards,
            cardPositions: { 'c1': { x: 0, y: 0 } },
            searchQuery: '',
            categoryFilter: 'all',
        })

        const nodes = useComponentCardStore.getState().toFlowNodes('govern')
        const gradeA = nodes.filter((n) => n.data.card.health?.grade === 'A').length
        const gradeB = nodes.filter((n) => n.data.card.health?.grade === 'B').length
        const governedPct = Math.round(((gradeA + gradeB) / nodes.length) * 100)

        expect(governedPct).toBe(0)
    })
})
