/**
 * PendingApprovalsAccordion.test.tsx — T29
 *
 * Covers C14: S8.3 MRS Pending Approvals accordion.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PendingApprovalsAccordion } from '../PendingApprovalsAccordion'
import type { PendingMutation } from '../../../../types/flint-api'

const noop = () => {}

const sampleMutations: PendingMutation[] = [
    {
        id: 1,
        type: 'addClassName',
        filePath: '/src/components/Button.tsx',
        riskScore: 72,
        riskTier: 'Amber',
        agentId: 'claude-opus',
    },
    {
        id: 2,
        type: 'updateProps',
        filePath: '/src/components/Header.tsx',
        riskScore: 91,
        riskTier: 'Red',
        agentId: undefined,
    },
]

describe('PendingApprovalsAccordion', () => {
    it('renders nothing when pendingMutations is empty', () => {
        const { container } = render(
            <PendingApprovalsAccordion
                isOpen={false}
                onToggle={noop}
                pendingMutations={[]}
                onApprove={noop}
                onReject={noop}
            />,
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders the section container when there are pending mutations', () => {
        render(
            <PendingApprovalsAccordion
                isOpen={false}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={noop}
            />,
        )
        expect(screen.getByTestId('pending-approvals-section')).toBeDefined()
        expect(screen.getByText('Pending Approvals')).toBeDefined()
    })

    it('shows count badge with pending mutation count', () => {
        render(
            <PendingApprovalsAccordion
                isOpen={false}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={noop}
            />,
        )
        expect(screen.getByText('2 pending')).toBeDefined()
    })

    it('does not render list items when closed', () => {
        render(
            <PendingApprovalsAccordion
                isOpen={false}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={noop}
            />,
        )
        expect(screen.queryByTestId('pending-approvals-list')).toBeNull()
    })

    it('renders list items when open', () => {
        render(
            <PendingApprovalsAccordion
                isOpen={true}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={noop}
            />,
        )
        expect(screen.getByTestId('pending-approvals-list')).toBeDefined()
        expect(screen.getByTestId('pending-mutation-1')).toBeDefined()
        expect(screen.getByTestId('pending-mutation-2')).toBeDefined()
    })

    it('shows mutation type and file name in each row', () => {
        render(
            <PendingApprovalsAccordion
                isOpen={true}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={noop}
            />,
        )
        expect(screen.getByText(/addClassName — Button\.tsx/)).toBeDefined()
        expect(screen.getByText(/updateProps — Header\.tsx/)).toBeDefined()
    })

    it('shows risk scores', () => {
        render(
            <PendingApprovalsAccordion
                isOpen={true}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={noop}
            />,
        )
        expect(screen.getByText('Risk: 72')).toBeDefined()
        expect(screen.getByText('Risk: 91')).toBeDefined()
    })

    it('shows agentId when present', () => {
        render(
            <PendingApprovalsAccordion
                isOpen={true}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={noop}
            />,
        )
        expect(screen.getByText('Agent: claude-opus')).toBeDefined()
    })

    it('renders approve and reject buttons for each mutation', () => {
        render(
            <PendingApprovalsAccordion
                isOpen={true}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={noop}
            />,
        )
        expect(screen.getByTestId('approve-mutation-1')).toBeDefined()
        expect(screen.getByTestId('reject-mutation-1')).toBeDefined()
        expect(screen.getByTestId('approve-mutation-2')).toBeDefined()
        expect(screen.getByTestId('reject-mutation-2')).toBeDefined()
    })

    it('calls onApprove with correct id when Approve is clicked', () => {
        const handler = vi.fn()
        render(
            <PendingApprovalsAccordion
                isOpen={true}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={handler}
                onReject={noop}
            />,
        )
        fireEvent.click(screen.getByTestId('approve-mutation-1'))
        expect(handler).toHaveBeenCalledWith(1)
    })

    it('calls onReject with correct id when Reject is clicked', () => {
        const handler = vi.fn()
        render(
            <PendingApprovalsAccordion
                isOpen={true}
                onToggle={noop}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={handler}
            />,
        )
        fireEvent.click(screen.getByTestId('reject-mutation-2'))
        expect(handler).toHaveBeenCalledWith(2)
    })

    it('calls onToggle when accordion header is clicked', () => {
        const handler = vi.fn()
        render(
            <PendingApprovalsAccordion
                isOpen={false}
                onToggle={handler}
                pendingMutations={sampleMutations}
                onApprove={noop}
                onReject={noop}
            />,
        )
        fireEvent.click(screen.getByText('Pending Approvals').closest('button')!)
        expect(handler).toHaveBeenCalledOnce()
    })
})
