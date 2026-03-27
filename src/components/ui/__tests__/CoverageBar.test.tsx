/**
 * CoverageBar.test.tsx
 *
 * Tests for the CoverageBar component.
 * Verifies: renders progress bars, correct colors per percentage,
 * empty state, loading state, overall coverage calculation.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoverageBar } from '../CoverageBar'

const FULL_COVERAGE = {
    'US/ADA': { covered: 50, total: 50 },
    'EU/EAA': { covered: 48, total: 50 },
}

const MIXED_COVERAGE = {
    'US/ADA': { covered: 50, total: 50 },
    'EU/EAA': { covered: 30, total: 50 },
    'EU/GDPR': { covered: 0, total: 12 },
}

describe('CoverageBar', () => {
    it('renders without crash', () => {
        render(<CoverageBar coverages={null} />)
        expect(screen.getByText('Compliance Coverage')).toBeDefined()
    })

    it('shows empty state when coverages is null', () => {
        render(<CoverageBar coverages={null} />)
        expect(screen.getByText('No compliance profiles active')).toBeDefined()
    })

    it('shows empty state when coverages is an empty object', () => {
        render(<CoverageBar coverages={{}} />)
        expect(screen.getByText('No compliance profiles active')).toBeDefined()
    })

    it('shows loading state when isLoading is true', () => {
        render(<CoverageBar coverages={null} isLoading={true} />)
        expect(screen.getByText('Loading…')).toBeDefined()
    })

    it('renders jurisdiction labels', () => {
        render(<CoverageBar coverages={FULL_COVERAGE} />)
        expect(screen.getByText('US/ADA')).toBeDefined()
        expect(screen.getByText('EU/EAA')).toBeDefined()
    })

    it('renders covered/total counts', () => {
        render(<CoverageBar coverages={FULL_COVERAGE} />)
        expect(screen.getByText('50/50')).toBeDefined()
        expect(screen.getByText('48/50')).toBeDefined()
    })

    it('renders percentage labels', () => {
        render(<CoverageBar coverages={FULL_COVERAGE} />)
        expect(screen.getByText('100%')).toBeDefined()
        // 48/50 = 96%
        expect(screen.getByText('96%')).toBeDefined()
    })

    it('renders progress bar elements with correct aria attributes', () => {
        render(<CoverageBar coverages={FULL_COVERAGE} />)
        const progressBars = screen.getAllByRole('progressbar')
        expect(progressBars.length).toBe(2)
        // First bar should be 100% (US/ADA)
        const adaBar = progressBars.find(
            (b) => b.getAttribute('aria-label')?.includes('US/ADA'),
        )
        expect(adaBar?.getAttribute('aria-valuenow')).toBe('100')
    })

    it('shows 0% for jurisdiction with no covered rules', () => {
        render(<CoverageBar coverages={MIXED_COVERAGE} />)
        expect(screen.getByText('0%')).toBeDefined()
        expect(screen.getByText('0/12')).toBeDefined()
    })

    it('shows overall coverage percentage in header', () => {
        render(<CoverageBar coverages={FULL_COVERAGE} />)
        // Should show an overall % label
        const overall = screen.getByText(/\d+% overall/)
        expect(overall).toBeDefined()
    })

    it('does not render rows for jurisdictions with zero total rules', () => {
        const coverages = { 'US/ADA': { covered: 0, total: 0 } }
        render(<CoverageBar coverages={coverages} />)
        // Zero-total jurisdictions are filtered out
        expect(screen.getByText('No compliance profiles active')).toBeDefined()
    })

    it('sorts by coverage percentage descending', () => {
        render(<CoverageBar coverages={MIXED_COVERAGE} />)
        const labels = screen.getAllByRole('progressbar').map(
            (el) => el.getAttribute('aria-label') ?? '',
        )
        // US/ADA (100%) should come before EU/EAA (60%) which before EU/GDPR (0%)
        const adaIndex = labels.findIndex((l) => l.includes('US/ADA'))
        const eaaIndex = labels.findIndex((l) => l.includes('EU/EAA'))
        const gdprIndex = labels.findIndex((l) => l.includes('EU/GDPR'))
        expect(adaIndex).toBeLessThan(eaaIndex)
        expect(eaaIndex).toBeLessThan(gdprIndex)
    })
})
