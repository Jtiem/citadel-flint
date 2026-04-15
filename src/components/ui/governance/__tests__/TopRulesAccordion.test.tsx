/**
 * TopRulesAccordion.test.tsx — T25
 *
 * Covers C10: top-5 violated rules accordion.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopRulesAccordion, type RuleRow } from '../TopRulesAccordion'

const noop = () => {}

const sampleRules: RuleRow[] = [
    { type: 'color-drift', severity: 'critical', count: 5 },
    { type: 'a11y', severity: 'critical', count: 3 },
    { type: 'spacing-drift', severity: 'amber', count: 2 },
]

describe('TopRulesAccordion', () => {
    it('renders the accordion toggle button', () => {
        render(
            <TopRulesAccordion
                isOpen={false}
                onToggle={noop}
                topRules={[]}
                onRuleRowClick={noop}
            />,
        )
        expect(screen.getByText('Top Triggered Rules')).toBeDefined()
    })

    it('does not render rule rows when closed', () => {
        render(
            <TopRulesAccordion
                isOpen={false}
                onToggle={noop}
                topRules={sampleRules}
                onRuleRowClick={noop}
            />,
        )
        expect(screen.queryByTestId('rule-row-color-drift')).toBeNull()
    })

    it('renders rule rows when open', () => {
        render(
            <TopRulesAccordion
                isOpen={true}
                onToggle={noop}
                topRules={sampleRules}
                onRuleRowClick={noop}
            />,
        )
        expect(screen.getByTestId('rule-row-color-drift')).toBeDefined()
        expect(screen.getByTestId('rule-row-a11y')).toBeDefined()
        expect(screen.getByTestId('rule-row-spacing-drift')).toBeDefined()
    })

    it('shows "No issues" when open with empty topRules', () => {
        render(
            <TopRulesAccordion
                isOpen={true}
                onToggle={noop}
                topRules={[]}
                onRuleRowClick={noop}
            />,
        )
        expect(screen.getByText('No issues')).toBeDefined()
    })

    it('shows count badge when topRules is non-empty', () => {
        render(
            <TopRulesAccordion
                isOpen={false}
                onToggle={noop}
                topRules={sampleRules}
                onRuleRowClick={noop}
            />,
        )
        expect(screen.getByText('3')).toBeDefined()
    })

    it('does not show count badge when topRules is empty', () => {
        render(
            <TopRulesAccordion
                isOpen={false}
                onToggle={noop}
                topRules={[]}
                onRuleRowClick={noop}
            />,
        )
        // The count badge "0" should not be rendered
        expect(screen.queryByText('0')).toBeNull()
    })

    it('calls onToggle when button is clicked', () => {
        const handler = vi.fn()
        render(
            <TopRulesAccordion
                isOpen={false}
                onToggle={handler}
                topRules={[]}
                onRuleRowClick={noop}
            />,
        )
        fireEvent.click(screen.getByText('Top Triggered Rules').closest('button')!)
        expect(handler).toHaveBeenCalledOnce()
    })

    it('calls onRuleRowClick with correct type when row clicked', () => {
        const handler = vi.fn()
        render(
            <TopRulesAccordion
                isOpen={true}
                onToggle={noop}
                topRules={sampleRules}
                onRuleRowClick={handler}
            />,
        )
        fireEvent.click(screen.getByTestId('rule-row-color-drift'))
        expect(handler).toHaveBeenCalledWith('color-drift')
    })

    it('shows TYPE_LABEL mapped values in rule rows', () => {
        render(
            <TopRulesAccordion
                isOpen={true}
                onToggle={noop}
                topRules={[{ type: 'color-drift', severity: 'critical', count: 1 }]}
                onRuleRowClick={noop}
            />,
        )
        expect(screen.getByText('Color Drift')).toBeDefined()
    })

    it('sets correct aria-expanded on toggle button', () => {
        render(
            <TopRulesAccordion
                isOpen={true}
                onToggle={noop}
                topRules={[]}
                onRuleRowClick={noop}
            />,
        )
        const btn = screen.getByText('Top Triggered Rules').closest('button')!
        expect(btn.getAttribute('aria-expanded')).toBe('true')
    })

    it('displays violation counts in rule rows', () => {
        render(
            <TopRulesAccordion
                isOpen={true}
                onToggle={noop}
                topRules={[{ type: 'a11y', severity: 'critical', count: 7 }]}
                onRuleRowClick={noop}
            />,
        )
        expect(screen.getByText('7')).toBeDefined()
    })
})
