/**
 * T17 — ZeroViolationCelebration tests
 */
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ZeroViolationCelebration } from '../ZeroViolationCelebration'

describe('ZeroViolationCelebration', () => {
    it('renders nothing when visible is false', () => {
        const { container } = render(
            <ZeroViolationCelebration score={100} ringPulse={false} isBaselineSet={false} visible={false} />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders the zero-violation state when visible', () => {
        render(
            <ZeroViolationCelebration score={85} ringPulse={false} isBaselineSet={false} visible={true} />
        )
        expect(screen.getByTestId('zero-violation-state')).toBeInTheDocument()
    })

    it('shows A+ hero badge when score is 100', () => {
        render(
            <ZeroViolationCelebration score={100} ringPulse={false} isBaselineSet={false} visible={true} />
        )
        expect(screen.getByTestId('celebration-grade')).toHaveTextContent('A+')
        expect(screen.getByTestId('celebration-title')).toHaveTextContent('Perfect score — zero violations')
        expect(screen.getByTestId('celebration-description')).toBeInTheDocument()
    })

    it('shows CheckCircle icon (not A+ hero) when score < 100', () => {
        render(
            <ZeroViolationCelebration score={85} ringPulse={false} isBaselineSet={false} visible={true} />
        )
        expect(screen.queryByTestId('celebration-grade')).toBeNull()
        expect(screen.getByTestId('zero-violation-icon')).toBeInTheDocument()
    })

    it('shows confetti when score=100 and ringPulse=true', () => {
        render(
            <ZeroViolationCelebration score={100} ringPulse={true} isBaselineSet={false} visible={true} />
        )
        expect(screen.getByTestId('celebration-confetti')).toBeInTheDocument()
    })

    it('does not show confetti when ringPulse=false', () => {
        render(
            <ZeroViolationCelebration score={100} ringPulse={false} isBaselineSet={false} visible={true} />
        )
        expect(screen.queryByTestId('celebration-confetti')).toBeNull()
    })

    it('does not show confetti when score < 100', () => {
        render(
            <ZeroViolationCelebration score={85} ringPulse={true} isBaselineSet={false} visible={true} />
        )
        expect(screen.queryByTestId('celebration-confetti')).toBeNull()
    })

    it('shows baseline copy when isBaselineSet is true and score < 100', () => {
        render(
            <ZeroViolationCelebration score={85} ringPulse={false} isBaselineSet={true} visible={true} />
        )
        expect(screen.getByText('No new issues since baseline')).toBeInTheDocument()
    })

    it('shows default copy when isBaselineSet is false and score < 100', () => {
        render(
            <ZeroViolationCelebration score={85} ringPulse={false} isBaselineSet={false} visible={true} />
        )
        expect(screen.getByText('No issues found')).toBeInTheDocument()
    })

    it('renders exactly 12 confetti particles when score=100 and ringPulse=true', () => {
        render(
            <ZeroViolationCelebration score={100} ringPulse={true} isBaselineSet={false} visible={true} />
        )
        const confetti = screen.getByTestId('celebration-confetti')
        expect(confetti.children).toHaveLength(12)
    })
})
