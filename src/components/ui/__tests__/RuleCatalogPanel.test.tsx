/**
 * RuleCatalogPanel.test.tsx
 *
 * Tests for the RuleCatalogPanel component.
 * Verifies: renders without crash, domain grouping, search filtering,
 * status badges, enable/disable buttons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { RuleCatalogPanel } from '../RuleCatalogPanel'

const DEFAULT_PROPS = {
    activePresets: [],
    onEnablePack: vi.fn(),
    onDisablePack: vi.fn(),
    isToggling: false,
}

describe('RuleCatalogPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders without crash', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        // Should show the search input
        expect(screen.getByPlaceholderText('Search packs...')).toBeDefined()
    })

    it('renders the domain filter dropdown', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        expect(screen.getByRole('combobox', { name: /filter by domain/i })).toBeDefined()
    })

    it('renders Accessibility domain group heading', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        // Domain section heading button — use getAllByRole to avoid ambiguity with dropdown
        const buttons = screen.getAllByRole('button')
        const accessibilityHeader = buttons.find(
            (b) => b.textContent?.includes('Accessibility') && b.getAttribute('aria-expanded') !== null,
        )
        expect(accessibilityHeader).toBeDefined()
    })

    it('renders Privacy domain group heading', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        const buttons = screen.getAllByRole('button')
        const privacyHeader = buttons.find(
            (b) => b.textContent?.includes('Privacy') && b.getAttribute('aria-expanded') !== null,
        )
        expect(privacyHeader).toBeDefined()
    })

    it('renders Security domain group heading', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        const buttons = screen.getAllByRole('button')
        const securityHeader = buttons.find(
            (b) => b.textContent?.includes('Security') && b.getAttribute('aria-expanded') !== null,
        )
        expect(securityHeader).toBeDefined()
    })

    it('renders Brand domain group heading', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        const buttons = screen.getAllByRole('button')
        const brandHeader = buttons.find(
            (b) => b.textContent?.includes('Brand') && b.getAttribute('aria-expanded') !== null,
        )
        expect(brandHeader).toBeDefined()
    })

    it('renders WCAG 2.1 AA pack entry', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        expect(screen.getByText('WCAG 2.1 AA')).toBeDefined()
    })

    it('shows "Active" badge for active packs', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        // WCAG 2.1 AA and Mithril Design System are status: 'active' in registry
        const activeBadges = screen.getAllByText('Active')
        expect(activeBadges.length).toBeGreaterThan(0)
    })

    it('shows "Coming Soon" badge for planned packs', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        const comingSoonBadges = screen.getAllByText('Coming Soon')
        expect(comingSoonBadges.length).toBeGreaterThan(0)
    })

    it('shows "Available" badge for available packs', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        // HIPAA UI and Custom Brand Rules are 'available'
        const availableBadges = screen.getAllByText('Available')
        expect(availableBadges.length).toBeGreaterThan(0)
    })

    it('filters packs by search query', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        const searchInput = screen.getByPlaceholderText('Search packs...')
        fireEvent.change(searchInput, { target: { value: 'WCAG' } })
        expect(screen.getByText('WCAG 2.1 AA')).toBeDefined()
        // Mithril should not be visible after filtering for WCAG
        expect(screen.queryByText('Mithril Design System')).toBeNull()
    })

    it('shows empty state when search matches nothing', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        const searchInput = screen.getByPlaceholderText('Search packs...')
        fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } })
        expect(screen.getByText('No packs match your search')).toBeDefined()
    })

    it('shows Enable button for available packs', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        // HIPAA UI is 'available' — should have an Enable button
        const enableButtons = screen.getAllByText('Enable')
        expect(enableButtons.length).toBeGreaterThan(0)
    })

    it('calls onEnablePack when Enable is clicked', () => {
        const onEnable = vi.fn()
        render(<RuleCatalogPanel {...DEFAULT_PROPS} onEnablePack={onEnable} />)
        // Find and click an Enable button
        const enableButtons = screen.getAllByText('Enable')
        fireEvent.click(enableButtons[0])
        expect(onEnable).toHaveBeenCalledTimes(1)
    })

    it('shows Disable button when a preset is active via activePresets', () => {
        render(
            <RuleCatalogPanel
                {...DEFAULT_PROPS}
                activePresets={['@flint/healthcare']}
            />,
        )
        // HIPAA UI has preset '@flint/healthcare' — should now show Disable
        const disableButtons = screen.getAllByText('Disable')
        expect(disableButtons.length).toBeGreaterThan(0)
    })

    it('calls onDisablePack when Disable is clicked', () => {
        const onDisable = vi.fn()
        render(
            <RuleCatalogPanel
                {...DEFAULT_PROPS}
                activePresets={['@flint/healthcare']}
                onDisablePack={onDisable}
            />,
        )
        const disableButtons = screen.getAllByText('Disable')
        fireEvent.click(disableButtons[0])
        expect(onDisable).toHaveBeenCalledTimes(1)
    })

    it('disables buttons when isToggling is true', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} isToggling={true} />)
        const enableButtons = screen.getAllByRole('button', { name: /enable/i })
        for (const btn of enableButtons) {
            // HTML disabled buttons have the disabled property
            expect((btn as HTMLButtonElement).disabled).toBe(true)
        }
    })

    it('filters by domain when domain filter is changed', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        const filter = screen.getByRole('combobox', { name: /filter by domain/i })
        fireEvent.change(filter, { target: { value: 'security' } })
        // Only security packs should be visible
        expect(screen.getByText('HIPAA UI')).toBeDefined()
        // WCAG 2.1 AA (accessibility domain) should be gone
        expect(screen.queryByText('WCAG 2.1 AA')).toBeNull()
    })

    it('shows the pack rule count chip', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        // WCAG 2.1 AA has 50 rules
        expect(screen.getByText('50 rules')).toBeDefined()
    })

    it('renders jurisdiction tags for packs with jurisdictions', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        // WCAG 2.1 AA covers US/ADA, EU/EAA, US/Section508
        // Use getAllByText since multiple packs may share jurisdiction strings
        const adaTags = screen.getAllByText('US/ADA')
        expect(adaTags.length).toBeGreaterThan(0)
        const eaaTags = screen.getAllByText('EU/EAA')
        expect(eaaTags.length).toBeGreaterThan(0)
    })

    it('collapses domain section when header is clicked', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        // Find the Accessibility section header button
        const buttons = screen.getAllByRole('button')
        const accessibilityHeader = buttons.find(
            (b) => b.textContent?.includes('Accessibility') && b.getAttribute('aria-expanded') !== null,
        )!
        // Initially expanded — WCAG 2.1 AA should be visible
        expect(screen.getByText('WCAG 2.1 AA')).toBeDefined()
        // Click to collapse
        fireEvent.click(accessibilityHeader)
        // After collapse, WCAG 2.1 AA should not be visible
        expect(screen.queryByText('WCAG 2.1 AA')).toBeNull()
    })

    it('shows total pack count summary', () => {
        render(<RuleCatalogPanel {...DEFAULT_PROPS} />)
        // Summary line shows "N packs · M active"
        const summary = screen.getByText(/packs · \d+ active/)
        expect(summary).toBeDefined()
    })
})
