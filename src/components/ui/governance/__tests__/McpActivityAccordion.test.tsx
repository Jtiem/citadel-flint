/**
 * McpActivityAccordion.test.tsx — T27
 *
 * Covers C12: MCP Activity Feed accordion.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { McpActivityAccordion, type McpActivityEvent } from '../McpActivityAccordion'

const noop = () => {}

const sampleEvents: McpActivityEvent[] = [
    { id: '1', title: 'Mutation applied', type: 'mutation', severity: 'info' },
    { id: '2', title: 'Violation detected', message: 'color-drift in Button', type: 'violation', severity: 'warning' },
    { id: '3', title: 'Sync completed', type: 'override', severity: 'info' },
]

describe('McpActivityAccordion', () => {
    it('renders the accordion toggle button', () => {
        render(
            <McpActivityAccordion isOpen={false} onToggle={noop} events={[]} onUndo={noop} />,
        )
        expect(screen.getByTestId('activity-accordion-toggle')).toBeDefined()
        expect(screen.getByText('Agent Activity')).toBeDefined()
    })

    it('does not render feed content when closed', () => {
        render(
            <McpActivityAccordion isOpen={false} onToggle={noop} events={sampleEvents} onUndo={noop} />,
        )
        expect(screen.queryByTestId('activity-feed-section')).toBeNull()
    })

    it('renders feed content when open', () => {
        render(
            <McpActivityAccordion isOpen={true} onToggle={noop} events={sampleEvents} onUndo={noop} />,
        )
        expect(screen.getByTestId('activity-feed-section')).toBeDefined()
    })

    it('shows empty state when events list is empty and accordion is open', () => {
        render(
            <McpActivityAccordion isOpen={true} onToggle={noop} events={[]} onUndo={noop} />,
        )
        expect(screen.getByText(/This feed tracks AI agent actions/)).toBeDefined()
    })

    it('shows event count badge when events exist', () => {
        render(
            <McpActivityAccordion isOpen={false} onToggle={noop} events={sampleEvents} onUndo={noop} />,
        )
        expect(screen.getByText('3')).toBeDefined()
    })

    it('does not show count badge when events is empty', () => {
        render(
            <McpActivityAccordion isOpen={false} onToggle={noop} events={[]} onUndo={noop} />,
        )
        expect(screen.queryByText('0')).toBeNull()
    })

    it('renders event titles when open', () => {
        render(
            <McpActivityAccordion isOpen={true} onToggle={noop} events={sampleEvents} onUndo={noop} />,
        )
        expect(screen.getByText('Mutation applied')).toBeDefined()
        expect(screen.getByText('Violation detected')).toBeDefined()
    })

    it('renders event message when present', () => {
        render(
            <McpActivityAccordion isOpen={true} onToggle={noop} events={sampleEvents} onUndo={noop} />,
        )
        expect(screen.getByText('color-drift in Button')).toBeDefined()
    })

    it('shows "Undo this" button for mutation-type events', () => {
        render(
            <McpActivityAccordion isOpen={true} onToggle={noop} events={sampleEvents} onUndo={noop} />,
        )
        const undoButtons = screen.getAllByText('Undo this')
        expect(undoButtons).toHaveLength(1)
    })

    it('does not show "Undo this" for non-mutation events', () => {
        render(
            <McpActivityAccordion
                isOpen={true}
                onToggle={noop}
                events={[{ id: '1', title: 'Sync done', type: 'override', severity: 'info' }]}
                onUndo={noop}
            />,
        )
        expect(screen.queryByText('Undo this')).toBeNull()
    })

    it('calls onUndo when "Undo this" is clicked', () => {
        const handler = vi.fn()
        render(
            <McpActivityAccordion
                isOpen={true}
                onToggle={noop}
                events={[{ id: '1', title: 'Mutation applied', type: 'mutation' }]}
                onUndo={handler}
            />,
        )
        fireEvent.click(screen.getByText('Undo this'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('calls onToggle when the toggle button is clicked', () => {
        const handler = vi.fn()
        render(
            <McpActivityAccordion isOpen={false} onToggle={handler} events={[]} onUndo={noop} />,
        )
        fireEvent.click(screen.getByTestId('activity-accordion-toggle'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('sets aria-expanded=true when open', () => {
        render(
            <McpActivityAccordion isOpen={true} onToggle={noop} events={[]} onUndo={noop} />,
        )
        expect(screen.getByTestId('activity-accordion-toggle').getAttribute('aria-expanded')).toBe('true')
    })

    it('sets aria-expanded=false when closed', () => {
        render(
            <McpActivityAccordion isOpen={false} onToggle={noop} events={[]} onUndo={noop} />,
        )
        expect(screen.getByTestId('activity-accordion-toggle').getAttribute('aria-expanded')).toBe('false')
    })
})
