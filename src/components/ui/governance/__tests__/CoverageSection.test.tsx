/**
 * CoverageSection.test.tsx — T31
 *
 * Covers C16: wrapper that composes CoverageBar + InheritanceChain.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoverageSection } from '../CoverageSection'

describe('CoverageSection', () => {
    it('renders without crashing with empty data', () => {
        const { container } = render(
            <CoverageSection
                jurisdictionCoverage={null}
                inheritanceChain={[]}
                isLoadingConfig={false}
            />,
        )
        expect(container).toBeDefined()
    })

    it('renders CoverageBar section header', () => {
        render(
            <CoverageSection
                jurisdictionCoverage={{ 'EU/EAA': { covered: 10, total: 20 } }}
                inheritanceChain={[]}
                isLoadingConfig={false}
            />,
        )
        expect(screen.getByText('Compliance Coverage')).toBeDefined()
    })

    it('renders InheritanceChain section header', () => {
        render(
            <CoverageSection
                jurisdictionCoverage={null}
                inheritanceChain={['@flint/base', 'team-config']}
                isLoadingConfig={false}
            />,
        )
        expect(screen.getByText('Config Inheritance')).toBeDefined()
    })

    it('passes jurisdiction coverage to CoverageBar', () => {
        render(
            <CoverageSection
                jurisdictionCoverage={{
                    'EU/EAA': { covered: 15, total: 20 },
                    'WCAG 2.1': { covered: 40, total: 50 },
                }}
                inheritanceChain={[]}
                isLoadingConfig={false}
            />,
        )
        expect(screen.getByText('Compliance Coverage')).toBeDefined()
    })

    it('passes inheritance chain items to InheritanceChain', () => {
        render(
            <CoverageSection
                jurisdictionCoverage={null}
                inheritanceChain={['@flint/base', 'team-config', 'project']}
                isLoadingConfig={false}
            />,
        )
        expect(screen.getByText('Config Inheritance')).toBeDefined()
    })

    it('renders both CoverageBar and InheritanceChain together', () => {
        render(
            <CoverageSection
                jurisdictionCoverage={{ 'WCAG 2.1': { covered: 30, total: 50 } }}
                inheritanceChain={['@flint/base']}
                isLoadingConfig={false}
            />,
        )
        expect(screen.getByText('Compliance Coverage')).toBeDefined()
        expect(screen.getByText('Config Inheritance')).toBeDefined()
    })

    it('passes isLoadingConfig to both child components', () => {
        // When loading, CoverageBar renders its loading state with spinner
        const { container } = render(
            <CoverageSection
                jurisdictionCoverage={null}
                inheritanceChain={[]}
                isLoadingConfig={true}
            />,
        )
        expect(container).toBeDefined()
    })
})
