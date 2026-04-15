/**
 * MoreDetailsPanel.test.tsx — T24
 *
 * Covers C9: outer accordion container for "More details" sections.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MoreDetailsPanel } from '../MoreDetailsPanel'

const noop = () => {}

describe('MoreDetailsPanel', () => {
    it('renders nothing when tokenCount is 0', () => {
        const { container } = render(
            <MoreDetailsPanel isOpen={false} onToggle={noop} tokenCount={0}>
                <div data-testid="child">child</div>
            </MoreDetailsPanel>,
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders the disclosure toggle when tokenCount > 0', () => {
        render(
            <MoreDetailsPanel isOpen={false} onToggle={noop} tokenCount={5} />,
        )
        expect(screen.getByTestId('more-details-disclosure')).toBeDefined()
        expect(screen.getByTestId('more-details-toggle')).toBeDefined()
    })

    it('shows "More details" text in the toggle button', () => {
        render(
            <MoreDetailsPanel isOpen={false} onToggle={noop} tokenCount={1} />,
        )
        expect(screen.getByText('More details')).toBeDefined()
    })

    it('does not render children when isOpen is false', () => {
        render(
            <MoreDetailsPanel isOpen={false} onToggle={noop} tokenCount={3}>
                <div data-testid="child">child content</div>
            </MoreDetailsPanel>,
        )
        expect(screen.queryByTestId('child')).toBeNull()
    })

    it('renders children when isOpen is true', () => {
        render(
            <MoreDetailsPanel isOpen={true} onToggle={noop} tokenCount={3}>
                <div data-testid="child">child content</div>
            </MoreDetailsPanel>,
        )
        expect(screen.getByTestId('child')).toBeDefined()
    })

    it('calls onToggle when the button is clicked', () => {
        const handler = vi.fn()
        render(
            <MoreDetailsPanel isOpen={false} onToggle={handler} tokenCount={2} />,
        )
        fireEvent.click(screen.getByTestId('more-details-toggle'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('sets aria-expanded=false when closed', () => {
        render(
            <MoreDetailsPanel isOpen={false} onToggle={noop} tokenCount={1} />,
        )
        const btn = screen.getByTestId('more-details-toggle')
        expect(btn.getAttribute('aria-expanded')).toBe('false')
    })

    it('sets aria-expanded=true when open', () => {
        render(
            <MoreDetailsPanel isOpen={true} onToggle={noop} tokenCount={1} />,
        )
        const btn = screen.getByTestId('more-details-toggle')
        expect(btn.getAttribute('aria-expanded')).toBe('true')
    })

    it('shows "Delta on" badge when isBaselineSet is true', () => {
        render(
            <MoreDetailsPanel isOpen={false} onToggle={noop} tokenCount={1} isBaselineSet={true} />,
        )
        expect(screen.getByText('Delta on')).toBeDefined()
    })

    it('does not show "Delta on" badge when isBaselineSet is false', () => {
        render(
            <MoreDetailsPanel isOpen={false} onToggle={noop} tokenCount={1} isBaselineSet={false} />,
        )
        expect(screen.queryByText('Delta on')).toBeNull()
    })

    it('does not show "Delta on" badge by default', () => {
        render(
            <MoreDetailsPanel isOpen={false} onToggle={noop} tokenCount={1} />,
        )
        expect(screen.queryByText('Delta on')).toBeNull()
    })

    it('renders the more-details-panel id element when open', () => {
        render(
            <MoreDetailsPanel isOpen={true} onToggle={noop} tokenCount={1} />,
        )
        expect(document.getElementById('more-details-panel')).toBeDefined()
    })
})
