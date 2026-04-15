/**
 * T20 — GovernanceHeader tests
 */
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GovernanceHeader } from '../GovernanceHeader'
import type { CleanStateSnapshot } from '../GovernanceHeader'

const defaultProps = {
    isAuditing: false,
    activeFilePath: '/src/App.tsx',
    totalViolations: 0,
    lastAuditRanAt: null,
    isBaselineSet: false,
    govOverrideCount: 0,
    autopilotEnabled: false,
    lastCleanState: null,
    score: 100,
    onRunAudit: vi.fn(),
    onToggleAutopilot: vi.fn(),
    onRewindToClean: vi.fn(),
}

describe('GovernanceHeader', () => {
    it('renders the Run Audit button', () => {
        render(<GovernanceHeader {...defaultProps} />)
        expect(screen.getByTestId('run-audit-button')).toBeInTheDocument()
    })

    it('shows "Run Audit" label by default', () => {
        render(<GovernanceHeader {...defaultProps} />)
        expect(screen.getByTestId('run-audit-button')).toHaveTextContent('Run Audit')
    })

    it('shows "Auditing..." and spinner when isAuditing=true', () => {
        render(<GovernanceHeader {...defaultProps} isAuditing={true} />)
        expect(screen.getByTestId('run-audit-button')).toHaveTextContent('Auditing...')
    })

    it('disables audit button when activeFilePath is null', () => {
        render(<GovernanceHeader {...defaultProps} activeFilePath={null} />)
        expect(screen.getByTestId('run-audit-button')).toBeDisabled()
    })

    it('shows "Refresh Audit" when last audit is stale and violations exist', () => {
        const staleTime = Date.now() - 130_000
        render(
            <GovernanceHeader
                {...defaultProps}
                totalViolations={3}
                lastAuditRanAt={staleTime}
            />
        )
        expect(screen.getByTestId('run-audit-button')).toHaveTextContent('Refresh Audit')
    })

    it('calls onRunAudit when clicked', () => {
        const onRunAudit = vi.fn()
        render(<GovernanceHeader {...defaultProps} onRunAudit={onRunAudit} />)
        fireEvent.click(screen.getByTestId('run-audit-button'))
        expect(onRunAudit).toHaveBeenCalledOnce()
    })

    it('shows "New Issues Only" badge when isBaselineSet is true', () => {
        render(<GovernanceHeader {...defaultProps} isBaselineSet={true} />)
        expect(screen.getByText('New Issues Only')).toBeInTheDocument()
    })

    it('does not show "New Issues Only" badge when isBaselineSet is false', () => {
        render(<GovernanceHeader {...defaultProps} isBaselineSet={false} />)
        expect(screen.queryByText('New Issues Only')).toBeNull()
    })

    it('shows override count badge when govOverrideCount > 0', () => {
        render(<GovernanceHeader {...defaultProps} govOverrideCount={3} />)
        expect(screen.getByText(/3 overrides/)).toBeInTheDocument()
    })

    it('uses singular "override" for count = 1', () => {
        render(<GovernanceHeader {...defaultProps} govOverrideCount={1} />)
        expect(screen.getByText(/1 override/)).toBeInTheDocument()
    })

    it('hides override count when govOverrideCount is 0', () => {
        render(<GovernanceHeader {...defaultProps} govOverrideCount={0} />)
        expect(screen.queryByText(/override/)).toBeNull()
    })

    it('shows Autopilot toggle when totalViolations > 0', () => {
        render(<GovernanceHeader {...defaultProps} totalViolations={5} />)
        expect(screen.getByTestId('autopilot-header-toggle')).toBeInTheDocument()
    })

    it('hides Autopilot toggle when totalViolations is 0', () => {
        render(<GovernanceHeader {...defaultProps} totalViolations={0} />)
        expect(screen.queryByTestId('autopilot-header-toggle')).toBeNull()
    })

    it('calls onToggleAutopilot when autopilot button is clicked', () => {
        const onToggleAutopilot = vi.fn()
        render(
            <GovernanceHeader
                {...defaultProps}
                totalViolations={5}
                onToggleAutopilot={onToggleAutopilot}
            />
        )
        fireEvent.click(screen.getByTestId('autopilot-header-toggle'))
        expect(onToggleAutopilot).toHaveBeenCalledOnce()
    })

    it('shows Autopilot as active when autopilotEnabled=true', () => {
        render(<GovernanceHeader {...defaultProps} totalViolations={1} autopilotEnabled={true} />)
        expect(screen.getByTestId('autopilot-header-toggle')).toHaveTextContent('Autopilot On')
    })

    it('shows Autopilot as inactive when autopilotEnabled=false', () => {
        render(<GovernanceHeader {...defaultProps} totalViolations={1} autopilotEnabled={false} />)
        expect(screen.getByTestId('autopilot-header-toggle')).toHaveTextContent('Autopilot Off')
    })

    it('renders undo-to-clean button', () => {
        render(<GovernanceHeader {...defaultProps} />)
        expect(screen.getByTestId('undo-to-clean-btn')).toBeInTheDocument()
    })

    it('disables undo-to-clean button when no lastCleanState', () => {
        render(<GovernanceHeader {...defaultProps} lastCleanState={null} />)
        expect(screen.getByTestId('undo-to-clean-btn')).toBeDisabled()
    })

    it('disables undo-to-clean button when score >= 95', () => {
        const snapshot: CleanStateSnapshot = { score: 100, timestamp: new Date().toISOString() }
        render(<GovernanceHeader {...defaultProps} lastCleanState={snapshot} score={95} />)
        expect(screen.getByTestId('undo-to-clean-btn')).toBeDisabled()
    })

    it('enables undo-to-clean button when lastCleanState set and score < 95', () => {
        const snapshot: CleanStateSnapshot = { score: 100, timestamp: new Date().toISOString() }
        render(<GovernanceHeader {...defaultProps} lastCleanState={snapshot} score={70} />)
        expect(screen.getByTestId('undo-to-clean-btn')).not.toBeDisabled()
    })

    it('calls onRewindToClean when undo button clicked', () => {
        const onRewindToClean = vi.fn()
        const snapshot: CleanStateSnapshot = { score: 100, timestamp: new Date().toISOString() }
        render(
            <GovernanceHeader
                {...defaultProps}
                lastCleanState={snapshot}
                score={70}
                onRewindToClean={onRewindToClean}
            />
        )
        fireEvent.click(screen.getByTestId('undo-to-clean-btn'))
        expect(onRewindToClean).toHaveBeenCalledOnce()
    })
})
