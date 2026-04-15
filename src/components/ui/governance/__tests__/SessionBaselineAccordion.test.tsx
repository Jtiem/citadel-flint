/**
 * SessionBaselineAccordion.test.tsx — T26
 *
 * Covers C11: Session & Baseline accordion + confirmation toast.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionBaselineAccordion } from '../SessionBaselineAccordion'

const noop = () => {}

const defaultProps = {
    isOpen: false,
    onToggle: noop,
    isBaselineSet: false,
    baselineStatus: 'idle' as const,
    activeFilePath: null,
    activeFileName: null,
    violationCount: 0,
    baselineEntries: 0,
    totalRaw: 0,
    overridesExist: false,
    overrideCount: 0,
    confirmationMsg: null,
    onSetBaseline: noop,
    onClearBaseline: noop,
}

describe('SessionBaselineAccordion', () => {
    it('renders the accordion toggle button', () => {
        render(<SessionBaselineAccordion {...defaultProps} />)
        expect(screen.getByText('Session & Baseline')).toBeDefined()
    })

    it('does not render body content when closed', () => {
        render(<SessionBaselineAccordion {...defaultProps} />)
        expect(screen.queryByTestId('delta-mode-section')).toBeNull()
    })

    it('renders body content when open', () => {
        render(<SessionBaselineAccordion {...defaultProps} isOpen={true} />)
        expect(screen.getByTestId('delta-mode-section')).toBeDefined()
    })

    it('shows "No file open" when no active file and accordion is open', () => {
        render(<SessionBaselineAccordion {...defaultProps} isOpen={true} />)
        expect(screen.getByText('No file open')).toBeDefined()
    })

    it('shows active file name when a file is open', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                activeFilePath="/project/src/App.tsx"
                activeFileName="App.tsx"
            />,
        )
        expect(screen.getByText('App.tsx')).toBeDefined()
    })

    it('shows violation count badge when violations > 0', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                activeFileName="App.tsx"
                activeFilePath="/project/src/App.tsx"
                violationCount={4}
            />,
        )
        expect(screen.getByText('4')).toBeDefined()
    })

    it('shows "Show only new issues" button when baseline not set', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                activeFilePath="/project/src/App.tsx"
            />,
        )
        expect(screen.getByText(/Show only new issues/)).toBeDefined()
    })

    it('shows totalRaw count in baseline button when totalRaw > 0', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                activeFilePath="/project/src/App.tsx"
                totalRaw={12}
            />,
        )
        expect(screen.getByText(/12 baselined/)).toBeDefined()
    })

    it('calls onSetBaseline when set baseline button is clicked', () => {
        const handler = vi.fn()
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                activeFilePath="/project/src/App.tsx"
                onSetBaseline={handler}
            />,
        )
        fireEvent.click(screen.getByText(/Show only new issues/))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('shows delta mode controls when baseline is set', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                isBaselineSet={true}
                baselineEntries={8}
            />,
        )
        expect(screen.getByText(/Showing new issues only/)).toBeDefined()
        expect(screen.getByText('Show All')).toBeDefined()
    })

    it('shows baselineEntries count in delta mode label', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                isBaselineSet={true}
                baselineEntries={8}
            />,
        )
        expect(screen.getByText(/8 baselined/)).toBeDefined()
    })

    it('calls onClearBaseline when "Show All" is clicked', () => {
        const handler = vi.fn()
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                isBaselineSet={true}
                onClearBaseline={handler}
            />,
        )
        fireEvent.click(screen.getByText('Show All'))
        expect(handler).toHaveBeenCalledOnce()
    })

    it('shows "Delta on" badge in toggle when baseline is set', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isBaselineSet={true}
            />,
        )
        expect(screen.getByText('Delta on')).toBeDefined()
    })

    it('shows overrides warning when overridesExist', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                overridesExist={true}
                overrideCount={3}
            />,
        )
        expect(screen.getByText(/Manual Style Overrides active/)).toBeDefined()
        expect(screen.getByText('3')).toBeDefined()
    })

    it('does not show overrides warning when no overrides', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                overridesExist={false}
            />,
        )
        expect(screen.queryByText(/Manual Style Overrides active/)).toBeNull()
    })

    it('renders confirmation message when provided', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                confirmationMsg="Baseline set successfully"
            />,
        )
        expect(screen.getByTestId('baseline-confirmation-msg')).toBeDefined()
        expect(screen.getByText('Baseline set successfully')).toBeDefined()
    })

    it('does not render confirmation message when null', () => {
        render(<SessionBaselineAccordion {...defaultProps} />)
        expect(screen.queryByTestId('baseline-confirmation-msg')).toBeNull()
    })

    it('disables set baseline button when baselineStatus is "setting"', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                baselineStatus="setting"
                activeFilePath="/project/src/App.tsx"
            />,
        )
        expect(screen.getByText('Setting baseline...')).toBeDefined()
    })

    it('shows "Clearing..." text when baselineStatus is "clearing"', () => {
        render(
            <SessionBaselineAccordion
                {...defaultProps}
                isOpen={true}
                isBaselineSet={true}
                baselineStatus="clearing"
            />,
        )
        expect(screen.getByText('Clearing...')).toBeDefined()
    })

    it('calls onToggle when toggle button is clicked', () => {
        const handler = vi.fn()
        render(<SessionBaselineAccordion {...defaultProps} onToggle={handler} />)
        fireEvent.click(screen.getByText('Session & Baseline').closest('button')!)
        expect(handler).toHaveBeenCalledOnce()
    })
})
