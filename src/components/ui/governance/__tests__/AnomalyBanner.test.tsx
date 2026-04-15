/**
 * T16 — AnomalyBanner tests
 */
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnomalyBanner } from '../AnomalyBanner'
import type { AnomalyAlert } from '../../../../types/flint-api'

const makeAnomaly = (type: string, message = 'test message'): AnomalyAlert => ({
    type,
    severity: 'medium',
    message,
    detected_at: '2026-04-12T10:00:00Z',
})

describe('AnomalyBanner', () => {
    it('renders nothing when anomalies is empty', () => {
        const { container } = render(
            <AnomalyBanner anomalies={[]} isDismissed={false} onDismiss={vi.fn()} />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders nothing when isDismissed is true', () => {
        const { container } = render(
            <AnomalyBanner
                anomalies={[makeAnomaly('mutation_spike')]}
                isDismissed={true}
                onDismiss={vi.fn()}
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders the banner when anomalies exist and not dismissed', () => {
        render(
            <AnomalyBanner
                anomalies={[makeAnomaly('mutation_spike')]}
                isDismissed={false}
                onDismiss={vi.fn()}
            />
        )
        expect(screen.getByTestId('anomaly-alert-banner')).toBeInTheDocument()
    })

    it('shows correct anomaly count in badge', () => {
        const anomalies = [makeAnomaly('mutation_spike'), makeAnomaly('override_spike')]
        render(
            <AnomalyBanner anomalies={anomalies} isDismissed={false} onDismiss={vi.fn()} />
        )
        const badge = screen.getByTestId('anomaly-count-badge')
        expect(badge).toHaveTextContent('2')
    })

    it('uses singular "anomaly" label for count = 1', () => {
        render(
            <AnomalyBanner
                anomalies={[makeAnomaly('risk_drift')]}
                isDismissed={false}
                onDismiss={vi.fn()}
            />
        )
        expect(screen.getByText(/Flare detected 1 anomaly/)).toBeInTheDocument()
    })

    it('uses plural "anomalies" label for count > 1', () => {
        render(
            <AnomalyBanner
                anomalies={[makeAnomaly('mutation_spike'), makeAnomaly('override_spike')]}
                isDismissed={false}
                onDismiss={vi.fn()}
            />
        )
        expect(screen.getByText(/Flare detected 2 anomalies/)).toBeInTheDocument()
    })

    it('renders each anomaly as a list item', () => {
        const anomalies = [makeAnomaly('mutation_spike'), makeAnomaly('override_spike')]
        render(
            <AnomalyBanner anomalies={anomalies} isDismissed={false} onDismiss={vi.fn()} />
        )
        expect(screen.getByTestId('anomaly-item-0')).toBeInTheDocument()
        expect(screen.getByTestId('anomaly-item-1')).toBeInTheDocument()
    })

    it('uses known description for recognized anomaly types', () => {
        render(
            <AnomalyBanner
                anomalies={[makeAnomaly('mutation_spike')]}
                isDismissed={false}
                onDismiss={vi.fn()}
            />
        )
        expect(screen.getByTestId('anomaly-item-0')).toHaveTextContent('Mutation velocity is above normal')
    })

    it('falls back to message for unknown anomaly type', () => {
        render(
            <AnomalyBanner
                anomalies={[makeAnomaly('unknown_type', 'Something unusual')]}
                isDismissed={false}
                onDismiss={vi.fn()}
            />
        )
        expect(screen.getByTestId('anomaly-item-0')).toHaveTextContent('Something unusual')
    })

    it('calls onDismiss when dismiss button is clicked', () => {
        const onDismiss = vi.fn()
        render(
            <AnomalyBanner
                anomalies={[makeAnomaly('override_spike')]}
                isDismissed={false}
                onDismiss={onDismiss}
            />
        )
        fireEvent.click(screen.getByTestId('anomaly-banner-dismiss'))
        expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('has role="alert" for screen-reader announcements', () => {
        render(
            <AnomalyBanner
                anomalies={[makeAnomaly('mutation_spike')]}
                isDismissed={false}
                onDismiss={vi.fn()}
            />
        )
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })
})
