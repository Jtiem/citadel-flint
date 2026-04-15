/**
 * T22 — GovernanceFooter tests
 */
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GovernanceFooter } from '../GovernanceFooter'

describe('GovernanceFooter', () => {
    it('renders nothing when visible is false', () => {
        const { container } = render(
            <GovernanceFooter
                visible={false}
                onManageRules={vi.fn()}
                onPolicySettings={vi.fn()}
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders nothing when visible=true but no callbacks provided', () => {
        const { container } = render(<GovernanceFooter visible={true} />)
        expect(container.firstChild).toBeNull()
    })

    it('renders "Manage rules →" when onManageRules provided', () => {
        render(
            <GovernanceFooter visible={true} onManageRules={vi.fn()} />
        )
        expect(screen.getByTestId('manage-rules-link')).toHaveTextContent('Manage rules →')
    })

    it('calls onManageRules when "Manage rules →" is clicked', () => {
        const onManageRules = vi.fn()
        render(
            <GovernanceFooter visible={true} onManageRules={onManageRules} />
        )
        fireEvent.click(screen.getByTestId('manage-rules-link'))
        expect(onManageRules).toHaveBeenCalledOnce()
    })

    it('renders "Policy settings →" when onPolicySettings provided', () => {
        render(
            <GovernanceFooter visible={true} onPolicySettings={vi.fn()} />
        )
        expect(screen.getByTestId('policy-settings-link')).toHaveTextContent('Policy settings →')
    })

    it('calls onPolicySettings when "Policy settings →" is clicked', () => {
        const onPolicySettings = vi.fn()
        render(
            <GovernanceFooter visible={true} onPolicySettings={onPolicySettings} />
        )
        fireEvent.click(screen.getByTestId('policy-settings-link'))
        expect(onPolicySettings).toHaveBeenCalledOnce()
    })

    it('renders "Configure rules" (legacy) when onOpenGovernancePanel provided without onManageRules', () => {
        render(
            <GovernanceFooter visible={true} onOpenGovernancePanel={vi.fn()} />
        )
        expect(screen.getByText('Configure rules')).toBeInTheDocument()
    })

    it('does NOT render "Configure rules" when onManageRules is also provided', () => {
        render(
            <GovernanceFooter
                visible={true}
                onOpenGovernancePanel={vi.fn()}
                onManageRules={vi.fn()}
            />
        )
        expect(screen.queryByText('Configure rules')).toBeNull()
        expect(screen.getByTestId('manage-rules-link')).toBeInTheDocument()
    })

    it('calls onOpenGovernancePanel when legacy "Configure rules" is clicked', () => {
        const onOpenGovernancePanel = vi.fn()
        render(
            <GovernanceFooter visible={true} onOpenGovernancePanel={onOpenGovernancePanel} />
        )
        fireEvent.click(screen.getByText('Configure rules'))
        expect(onOpenGovernancePanel).toHaveBeenCalledOnce()
    })

    it('renders both manage-rules and policy-settings when both props provided', () => {
        render(
            <GovernanceFooter
                visible={true}
                onManageRules={vi.fn()}
                onPolicySettings={vi.fn()}
            />
        )
        expect(screen.getByTestId('manage-rules-link')).toBeInTheDocument()
        expect(screen.getByTestId('policy-settings-link')).toBeInTheDocument()
    })
})
