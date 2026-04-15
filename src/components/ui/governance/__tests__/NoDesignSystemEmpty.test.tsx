/**
 * T33 — NoDesignSystemEmpty tests
 */
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NoDesignSystemEmpty } from '../NoDesignSystemEmpty'

describe('NoDesignSystemEmpty', () => {
    it('renders nothing when visible is false', () => {
        const { container } = render(
            <NoDesignSystemEmpty visible={false} onImportTokens={vi.fn()} />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders the empty state when visible is true', () => {
        render(<NoDesignSystemEmpty visible={true} onImportTokens={vi.fn()} />)
        expect(screen.getByText(/Health score measures against your design tokens/)).toBeInTheDocument()
    })

    it('renders the ShieldOff icon', () => {
        render(<NoDesignSystemEmpty visible={true} onImportTokens={vi.fn()} />)
        const icon = document.querySelector('[aria-hidden="true"]')
        expect(icon).not.toBeNull()
    })

    it('renders the "Import Tokens" button', () => {
        render(<NoDesignSystemEmpty visible={true} onImportTokens={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Import Tokens' })).toBeInTheDocument()
    })

    it('calls onImportTokens when button is clicked', () => {
        const onImportTokens = vi.fn()
        render(<NoDesignSystemEmpty visible={true} onImportTokens={onImportTokens} />)
        fireEvent.click(screen.getByRole('button', { name: 'Import Tokens' }))
        expect(onImportTokens).toHaveBeenCalledOnce()
    })

    it('contains instructional copy about Figma or tokens', () => {
        render(<NoDesignSystemEmpty visible={true} onImportTokens={vi.fn()} />)
        expect(screen.getByText(/Connect Figma or import tokens/)).toBeInTheDocument()
    })
})
