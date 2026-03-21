/**
 * ComponentSearch.test.tsx — Phase HYDRO.1-C
 *
 * Tests for the ComponentSearch component:
 *   - Render, empty state, search debounce, single-char guard
 *   - Loading, results, insert, insert-without-selection
 *   - Error and no-results states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ComponentSearch } from '../ComponentSearch'

// ── Mock editorStore ─────────────────────────────────────────────────────────

const mockInjectComponent = vi.fn()
let mockSelectedNodeId: string | null = 'test-node-1'

vi.mock('../../../store/editorStore', () => ({
    useEditorStore: vi.fn(
        (
            selector: (state: {
                selectedNodeId: string | null
                injectComponent: typeof mockInjectComponent
            }) => unknown,
        ) => {
            const state = {
                selectedNodeId: mockSelectedNodeId,
                injectComponent: mockInjectComponent,
            }
            return selector(state)
        },
    ),
}))

// ── Mock Shadow Storybook markdown ────────────────────────────────────────────

const MOCK_STORYBOOK = `
### PrimaryButton
A primary action button component.

**Import**: \`@/components/ui/PrimaryButton\`
**Variants**: default, destructive, outline

---

### Card
Container card for content.

**Import**: \`@/components/ui/Card\`
`

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Triggers the debounce and waits for any async state updates to settle.
 * Uses vi.runAllTimersAsync() which advances all fake timers AND flushes the
 * microtask queue, ensuring async code inside setTimeout callbacks completes.
 */
async function triggerDebounce() {
    await act(async () => {
        await vi.runAllTimersAsync()
    })
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

const mockCallTool = vi.fn()
const mockPushNotification = vi.fn()

vi.mock('../../../store/notificationStore', () => ({
    useNotificationStore: vi.fn((selector: (state: { push: typeof mockPushNotification }) => unknown) =>
        selector({ push: mockPushNotification })
    ),
}))

beforeEach(() => {
    vi.useFakeTimers()
    mockSelectedNodeId = 'test-node-1'
    Object.defineProperty(window, 'flintAPI', {
        value: { mcp: { callTool: mockCallTool } },
        writable: true,
        configurable: true,
    })
    mockCallTool.mockReset()
    mockInjectComponent.mockReset()
    mockPushNotification.mockReset()
})

afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
})

// ── Test suite ────────────────────────────────────────────────────────────────

describe('ComponentSearch', () => {
    it('renders without crash — search input is visible', () => {
        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')
        expect(input).toBeDefined()
    })

    it('shows empty state when no query — "Search your component registry" visible', () => {
        render(<ComponentSearch />)
        expect(screen.getByText('Search your component registry')).toBeDefined()
    })

    it('typing triggers search after debounce — callTool called with correct args', async () => {
        mockCallTool.mockResolvedValue({
            content: [{ type: 'text', text: MOCK_STORYBOOK }],
            isError: false,
        })

        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')

        fireEvent.change(input, { target: { value: 'button' } })

        // Before the debounce fires, callTool should NOT have been called
        expect(mockCallTool).not.toHaveBeenCalled()

        await triggerDebounce()

        expect(mockCallTool).toHaveBeenCalledWith('flint_query_registry', {
            query: 'button',
            limit: 5,
        })
    })

    it('does NOT search for a single character', async () => {
        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')

        fireEvent.change(input, { target: { value: 'b' } })
        await triggerDebounce()

        expect(mockCallTool).not.toHaveBeenCalled()
    })

    it('shows loading state while callTool promise is pending', async () => {
        // Use a promise we control so it never resolves during the test
        let resolveCall!: (value: unknown) => void
        mockCallTool.mockReturnValue(new Promise((res) => { resolveCall = res }))

        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')

        // Trigger the input change
        act(() => {
            fireEvent.change(input, { target: { value: 'bu' } })
        })

        // Advance only the debounce timer (not the pending promise)
        act(() => {
            vi.advanceTimersByTime(300)
        })

        // Flush microtasks so React re-renders into loading state
        await act(async () => {
            await Promise.resolve()
        })

        // The empty state placeholder should be hidden while loading
        expect(screen.queryByText('Search your component registry')).toBeNull()
        // The spinner should be visible
        expect(screen.getByRole('status')).toBeDefined()

        // Clean up — resolve the pending promise so no timer leaks
        resolveCall({ content: [{ type: 'text', text: '' }], isError: false })
    })

    it('renders search results — both component names appear in DOM', async () => {
        mockCallTool.mockResolvedValue({
            content: [{ type: 'text', text: MOCK_STORYBOOK }],
            isError: false,
        })

        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')
        fireEvent.change(input, { target: { value: 'button' } })

        await triggerDebounce()

        expect(screen.getByText('PrimaryButton')).toBeDefined()
        expect(screen.getByText('Card')).toBeDefined()
    })

    it('Insert button calls injectComponent with correct snippet and import', async () => {
        mockCallTool.mockResolvedValue({
            content: [{ type: 'text', text: MOCK_STORYBOOK }],
            isError: false,
        })

        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')
        fireEvent.change(input, { target: { value: 'button' } })

        await triggerDebounce()

        const insertButtons = screen.getAllByText('Insert')
        expect(insertButtons.length).toBeGreaterThan(0)

        // Click the first Insert button (PrimaryButton is first in the markdown)
        fireEvent.click(insertButtons[0])

        expect(mockInjectComponent).toHaveBeenCalledWith(
            'test-node-1',
            '<PrimaryButton />',
            "import { PrimaryButton } from '@/components/ui/PrimaryButton';",
        )

        expect(mockPushNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'mutation',
                severity: 'success',
                title: 'PrimaryButton inserted',
            })
        )
    })

    it('Insert button shows amber alert when selectedNodeId is null', async () => {
        mockSelectedNodeId = null

        mockCallTool.mockResolvedValue({
            content: [{ type: 'text', text: MOCK_STORYBOOK }],
            isError: false,
        })

        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')
        fireEvent.change(input, { target: { value: 'button' } })

        await triggerDebounce()

        const insertButtons = screen.getAllByText('Insert')
        expect(insertButtons.length).toBeGreaterThan(0)

        fireEvent.click(insertButtons[0])

        expect(screen.getByText('Select a target layer first')).toBeDefined()
        expect(mockInjectComponent).not.toHaveBeenCalled()
    })

    it('shows error state when callTool rejects — "Search unavailable" appears', async () => {
        mockCallTool.mockRejectedValue(new Error('MCP not connected'))

        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')
        fireEvent.change(input, { target: { value: 'button' } })

        await triggerDebounce()

        expect(screen.getByText('Search unavailable')).toBeDefined()
    })

    it('shows "No components found" when results are empty', async () => {
        // Return markdown with no valid component sections
        mockCallTool.mockResolvedValue({
            content: [{ type: 'text', text: '# Registry\n\nNo results matched your query.' }],
            isError: false,
        })

        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')
        fireEvent.change(input, { target: { value: 'zzzzz' } })

        await triggerDebounce()

        expect(screen.getByText('No components found')).toBeDefined()
    })

    it('shows error state when callTool returns isError: true', async () => {
        // MCP server returns a structured error response (more common than promise rejection)
        mockCallTool.mockResolvedValue({
            content: [{ type: 'text', text: 'Tool execution failed: registry not initialized' }],
            isError: true,
        })

        render(<ComponentSearch />)
        const input = screen.getByPlaceholderText('Search components...')
        fireEvent.change(input, { target: { value: 'button' } })

        await triggerDebounce()

        expect(screen.getByText('Search unavailable')).toBeDefined()
    })
})
