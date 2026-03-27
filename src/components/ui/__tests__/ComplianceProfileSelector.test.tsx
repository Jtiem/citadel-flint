/**
 * ComplianceProfileSelector.test.tsx
 *
 * Tests for the ComplianceProfileSelector component.
 * Verifies: renders checkboxes, checked state matches store, toggle callbacks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComplianceProfileSelector } from '../ComplianceProfileSelector'

const DEFAULT_PROPS = {
    activePresets: [],
    onToggleJurisdiction: vi.fn(),
    isToggling: false,
}

describe('ComplianceProfileSelector', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crash', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} />)
        expect(screen.getByText('Compliance Profiles')).toBeDefined()
    })

    it('renders the explanatory description', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} />)
        expect(
            screen.getByText(/Checking a profile enables its rule pack/i),
        ).toBeDefined()
    })

    it('renders profile labels', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} />)
        expect(screen.getByText('EU — European Accessibility Act')).toBeDefined()
        expect(screen.getByText('GDPR Consent Patterns')).toBeDefined()
        expect(screen.getByText('HIPAA (healthcare)')).toBeDefined()
    })

    it('renders checkboxes for each profile', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} />)
        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes.length).toBeGreaterThan(0)
    })

    it('marks profiles as checked when their preset is in activePresets', () => {
        render(
            <ComplianceProfileSelector
                {...DEFAULT_PROPS}
                activePresets={['@flint/healthcare']}
            />,
        )
        // HIPAA has preset '@flint/healthcare' — its checkbox should be checked
        const hipaaCheckbox = screen.getByLabelText(/hipaa \(healthcare\)/i)
        expect((hipaaCheckbox as HTMLInputElement).checked).toBe(true)
    })

    it('marks profiles as unchecked when their preset is NOT in activePresets', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} activePresets={[]} />)
        const hipaaCheckbox = screen.getByLabelText(/hipaa \(healthcare\)/i)
        expect((hipaaCheckbox as HTMLInputElement).checked).toBe(false)
    })

    it('calls onToggleJurisdiction with true when a checkbox is checked', () => {
        const onToggle = vi.fn()
        render(
            <ComplianceProfileSelector
                {...DEFAULT_PROPS}
                activePresets={[]}
                onToggleJurisdiction={onToggle}
            />,
        )
        const hipaaCheckbox = screen.getByLabelText(/hipaa \(healthcare\)/i)
        fireEvent.click(hipaaCheckbox)
        expect(onToggle).toHaveBeenCalledWith('hipaa-phi', true)
    })

    it('calls onToggleJurisdiction with false when a checked box is unchecked', () => {
        const onToggle = vi.fn()
        render(
            <ComplianceProfileSelector
                {...DEFAULT_PROPS}
                activePresets={['@flint/healthcare']}
                onToggleJurisdiction={onToggle}
            />,
        )
        const hipaaCheckbox = screen.getByLabelText(/hipaa \(healthcare\)/i)
        fireEvent.click(hipaaCheckbox)
        expect(onToggle).toHaveBeenCalledWith('hipaa-phi', false)
    })

    it('disables checkboxes for coming-soon profiles', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} />)
        // GDPR is coming-soon
        const gdprCheckbox = screen.getByLabelText(/gdpr consent patterns/i)
        expect((gdprCheckbox as HTMLInputElement).disabled).toBe(true)
    })

    it('disables all checkboxes when isToggling is true', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} isToggling={true} />)
        const checkboxes = screen.getAllByRole('checkbox')
        for (const cb of checkboxes) {
            expect((cb as HTMLInputElement).disabled).toBe(true)
        }
    })

    it('shows "Soon" badge for coming-soon profiles', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} />)
        const soonBadges = screen.getAllByText('Soon')
        expect(soonBadges.length).toBeGreaterThan(0)
    })

    it('shows region badges (EU, US)', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} />)
        const euBadges = screen.getAllByText('EU')
        const usBadges = screen.getAllByText('US')
        expect(euBadges.length).toBeGreaterThan(0)
        expect(usBadges.length).toBeGreaterThan(0)
    })

    it('shows active count in header when profiles are active', () => {
        render(
            <ComplianceProfileSelector
                {...DEFAULT_PROPS}
                activePresets={['@flint/healthcare']}
            />,
        )
        expect(screen.getByText(/\d+ active/)).toBeDefined()
    })

    it('marks always-active profiles (wcag-aa) as checked even with empty activePresets', () => {
        render(<ComplianceProfileSelector {...DEFAULT_PROPS} activePresets={[]} />)
        // EU EAA uses wcag-2.1-aa which is status: 'active' in the registry
        const euCheckbox = screen.getByLabelText(/eu — european accessibility act/i)
        expect((euCheckbox as HTMLInputElement).checked).toBe(true)
    })
})
