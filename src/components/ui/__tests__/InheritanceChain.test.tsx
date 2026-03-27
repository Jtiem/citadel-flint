/**
 * InheritanceChain.test.tsx
 *
 * Tests for the InheritanceChain component.
 * Verifies: renders chain nodes, shows override indicators,
 * empty chain, loading state, node classification.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InheritanceChain } from '../InheritanceChain'

describe('InheritanceChain', () => {
    it('renders without crash', () => {
        render(<InheritanceChain chain={[]} />)
        expect(screen.getByText('Config Inheritance')).toBeDefined()
    })

    it('shows loading state when isLoading is true', () => {
        render(<InheritanceChain chain={[]} isLoading={true} />)
        expect(screen.getByText('Loading…')).toBeDefined()
    })

    it('shows "(no extends)" state for empty chain', () => {
        render(<InheritanceChain chain={[]} />)
        // The empty state shows a "project" node with "no extends"
        expect(screen.getByText('no extends')).toBeDefined()
    })

    it('renders the "project" label for the empty state node', () => {
        render(<InheritanceChain chain={[]} />)
        expect(screen.getByText('project')).toBeDefined()
    })

    it('renders chain nodes for a single preset', () => {
        render(<InheritanceChain chain={['@flint/healthcare']} />)
        // Shortened display: "@flint/healthcare" → "healthcare"
        expect(screen.getByText('healthcare')).toBeDefined()
    })

    it('renders multiple chain nodes', () => {
        render(
            <InheritanceChain
                chain={['@flint/wcag-aa', '@flint/healthcare']}
            />,
        )
        expect(screen.getByText('wcag-aa')).toBeDefined()
        expect(screen.getByText('healthcare')).toBeDefined()
    })

    it('renders the implicit (project) terminal node when chain is non-empty', () => {
        render(<InheritanceChain chain={['@flint/healthcare']} />)
        // The implicit terminal node renders ChainNode with ref="(project)"
        // which shows "(project)" as the display name (doesn't start with @flint/ or ./)
        expect(screen.getByText('(project)')).toBeDefined()
    })

    it('shows "preset" kind label for @flint/ refs', () => {
        render(<InheritanceChain chain={['@flint/wcag-aa']} />)
        // The kind label is rendered as a <span> with NODE_LABEL[kind]
        // For kind='preset', the label text is 'preset'
        // Use getAllByText since the terminal node has kind='project'
        const kindLabels = screen.getAllByText(/^preset$/)
        expect(kindLabels.length).toBeGreaterThan(0)
    })

    it('shows "local" kind label for local path refs', () => {
        render(<InheritanceChain chain={['./team.yaml']} />)
        // kind='local' for refs starting with './'
        const kindLabels = screen.getAllByText(/^local$/)
        expect(kindLabels.length).toBeGreaterThan(0)
        // Local path shows without "./" prefix
        expect(screen.getByText('team.yaml')).toBeDefined()
    })

    it('renders the tighten-only note when chain is non-empty', () => {
        render(<InheritanceChain chain={['@flint/healthcare']} />)
        expect(
            screen.getByText(/Inherited presets use tighten-only mode/i),
        ).toBeDefined()
    })

    it('does not render the tighten-only note for empty chain', () => {
        render(<InheritanceChain chain={[]} />)
        expect(
            screen.queryByText(/Inherited presets use tighten-only mode/i),
        ).toBeNull()
    })

    it('renders the section header', () => {
        render(<InheritanceChain chain={['@flint/wcag-aa']} />)
        expect(screen.getByText('Config Inheritance')).toBeDefined()
    })

    it('handles a long chain gracefully', () => {
        const longChain = [
            '@flint/base',
            '@flint/wcag-aa',
            '@flint/healthcare',
            './team.yaml',
        ]
        render(<InheritanceChain chain={longChain} />)
        expect(screen.getByText('base')).toBeDefined()
        expect(screen.getByText('wcag-aa')).toBeDefined()
        expect(screen.getByText('healthcare')).toBeDefined()
        expect(screen.getByText('team.yaml')).toBeDefined()
        // Implicit project node
        expect(screen.getByText('(project)')).toBeDefined()
    })
})
