/**
 * EmptyState.test.tsx
 *
 * 5 tests covering the reusable zero-data state component.
 * Tests verify icon, title, description (optional), and action button rendering.
 *
 * @module GLASS.2.3
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '../EmptyState'

describe('EmptyState', () => {
    // 1. Renders icon and title
    it('renders icon and title', () => {
        render(
            <EmptyState
                icon={<span data-testid="mock-icon">icon</span>}
                title="No items yet"
            />,
        )

        expect(screen.getByTestId('mock-icon')).toBeDefined()
        expect(screen.getByText('No items yet')).toBeDefined()
    })

    // 2. Renders description when provided
    it('renders description when provided', () => {
        render(
            <EmptyState
                icon={<span>icon</span>}
                title="No items yet"
                description="Add items to get started"
            />,
        )

        expect(screen.getByText('Add items to get started')).toBeDefined()
    })

    // 3. Does not render description when omitted
    it('does not render description when omitted', () => {
        const { container } = render(
            <EmptyState
                icon={<span>icon</span>}
                title="No items yet"
            />,
        )

        // Only the title <p> — no description paragraph
        const paragraphs = container.querySelectorAll('p')
        expect(paragraphs).toHaveLength(1)
    })

    // 4. Renders action button and calls onClick
    it('renders action button and calls onClick when clicked', () => {
        const onClick = vi.fn()

        render(
            <EmptyState
                icon={<span>icon</span>}
                title="No items yet"
                action={{ label: 'Add Item', onClick }}
            />,
        )

        const button = screen.getByRole('button', { name: 'Add Item' })
        expect(button).toBeDefined()

        fireEvent.click(button)
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    // 5. Does not render action button when omitted
    it('does not render action button when action is omitted', () => {
        render(
            <EmptyState
                icon={<span>icon</span>}
                title="No items yet"
            />,
        )

        expect(screen.queryByRole('button')).toBeNull()
    })
})
