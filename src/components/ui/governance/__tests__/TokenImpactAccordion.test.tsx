/**
 * TokenImpactAccordion.test.tsx — T28
 *
 * Covers C13: Token Change Impact Preview accordion.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
    TokenImpactAccordion,
    type TokenImpactData,
    type TokenImpactFileEntry,
} from '../TokenImpactAccordion'

const noop = () => {}

const lowImpact: TokenImpactData = {
    tokenName: 'color.brand.primary',
    affectedFiles: 1,
    estimatedImpact: 'low',
}

const highImpact: TokenImpactData = {
    tokenName: 'color.brand.secondary',
    affectedFiles: 15,
    estimatedImpact: 'high',
}

const fileDetails: TokenImpactFileEntry[] = [
    { file: 'Button.tsx', count: 3 },
    { file: 'Header.tsx', count: 1 },
]

describe('TokenImpactAccordion', () => {
    it('renders nothing when tokenImpact is null', () => {
        const { container } = render(
            <TokenImpactAccordion
                isOpen={false}
                onToggle={noop}
                tokenImpact={null}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders the section container when tokenImpact is provided', () => {
        render(
            <TokenImpactAccordion
                isOpen={false}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(screen.getByTestId('token-impact-section')).toBeDefined()
        expect(screen.getByText('Token Impact')).toBeDefined()
    })

    it('shows estimatedImpact level badge in toggle', () => {
        render(
            <TokenImpactAccordion
                isOpen={false}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(screen.getByText('low')).toBeDefined()
    })

    it('does not render body content when closed', () => {
        render(
            <TokenImpactAccordion
                isOpen={false}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(screen.queryByTestId('preview-impact-button')).toBeNull()
    })

    it('renders body content when open', () => {
        render(
            <TokenImpactAccordion
                isOpen={true}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(screen.getByTestId('preview-impact-button')).toBeDefined()
    })

    it('shows token name in impact description', () => {
        render(
            <TokenImpactAccordion
                isOpen={true}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(screen.getByText('color.brand.primary')).toBeDefined()
    })

    it('shows "Low impact" guidance text for low impact', () => {
        render(
            <TokenImpactAccordion
                isOpen={true}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(screen.getByText('Low impact — safe to change')).toBeDefined()
    })

    it('shows "High impact" guidance text for high impact', () => {
        render(
            <TokenImpactAccordion
                isOpen={true}
                onToggle={noop}
                tokenImpact={highImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(screen.getByText(/High impact — this token is widely used/)).toBeDefined()
    })

    it('renders file details list when provided', () => {
        render(
            <TokenImpactAccordion
                isOpen={true}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={fileDetails}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(screen.getByTestId('token-impact-file-list')).toBeDefined()
        expect(screen.getByText('Button.tsx')).toBeDefined()
        expect(screen.getByText('Header.tsx')).toBeDefined()
    })

    it('does not render file list when empty', () => {
        render(
            <TokenImpactAccordion
                isOpen={true}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        expect(screen.queryByTestId('token-impact-file-list')).toBeNull()
    })

    it('calls onPreviewImpact when the button is clicked', () => {
        const handler = vi.fn()
        render(
            <TokenImpactAccordion
                isOpen={true}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={handler}
            />,
        )
        fireEvent.click(screen.getByTestId('preview-impact-button'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('disables preview button when isTokenImpactLoading is true', () => {
        render(
            <TokenImpactAccordion
                isOpen={true}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={true}
                onPreviewImpact={noop}
            />,
        )
        const btn = screen.getByTestId('preview-impact-button')
        expect(btn.hasAttribute('disabled')).toBe(true)
    })

    it('calls onToggle when the accordion header is clicked', () => {
        const handler = vi.fn()
        render(
            <TokenImpactAccordion
                isOpen={false}
                onToggle={handler}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        fireEvent.click(screen.getByText('Token Impact').closest('button')!)
        expect(handler).toHaveBeenCalledOnce()
    })

    it('uses singular "violation" when affectedFiles is 1', () => {
        render(
            <TokenImpactAccordion
                isOpen={true}
                onToggle={noop}
                tokenImpact={lowImpact}
                tokenImpactDetails={[]}
                isTokenImpactLoading={false}
                onPreviewImpact={noop}
            />,
        )
        // "1" is in a <span> and "violation" is a sibling text node, so use a
        // function matcher that checks the paragraph's full textContent.
        const para = screen.getByText((_content, element) => {
            return (
                element?.tagName === 'P' &&
                (element.textContent ?? '').includes('1') &&
                (element.textContent ?? '').includes('violation')
            )
        })
        expect(para).toBeDefined()
    })
})
