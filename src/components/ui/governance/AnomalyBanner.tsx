/**
 * AnomalyBanner.tsx — C1 — extracted from GovernanceDashboard (Sprint 2 refactor)
 *
 * Renders the Flare anomaly alert banner below the violations section.
 * Dismissible via an X button. Pure presentational — receives anomaly data
 * and a dismiss handler as props. Zero business logic.
 *
 * Source lines: GovernanceDashboard.tsx ~2290-2329
 */

import { AlertTriangle, X } from 'lucide-react'
import type { AnomalyAlert } from '../../../types/flint-api'

// ── Anomaly type → human-readable description ────────────────────────────────

const ANOMALY_DESCRIPTION: Record<string, string> = {
    override_spike: 'Override frequency is unusually high',
    violation_surge: 'Violation count spiked',
    violation_spike: 'Violation count spiked',
    velocity_spike: 'Mutation velocity is above normal',
    mutation_spike: 'Mutation velocity is above normal',
    risk_drift: 'Risk scores are drifting upward',
    agent_behavior_change: 'Agent behavior pattern changed',
}

function getAnomalyDescription(type: string, fallbackMessage?: string): string {
    return ANOMALY_DESCRIPTION[type] ?? fallbackMessage ?? type
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AnomalyBannerProps {
    anomalies: AnomalyAlert[]
    isDismissed: boolean
    onDismiss: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AnomalyBanner({ anomalies, isDismissed, onDismiss }: AnomalyBannerProps) {
    if (anomalies.length === 0 || isDismissed) return null

    return (
        <div
            data-testid="anomaly-alert-banner"
            className="mx-3 mt-2 rounded border border-amber-700/40 bg-amber-900/20 px-3 py-2"
            role="alert"
        >
            <div className="flex items-start gap-2">
                <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-300">
                        Flare detected {anomalies.length} {anomalies.length === 1 ? 'anomaly' : 'anomalies'}
                        <span
                            data-testid="anomaly-count-badge"
                            className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-500/20 px-1.5 py-px text-[10px] font-medium text-amber-300 leading-none"
                            aria-label={`${anomalies.length} anomalies`}
                        >
                            {anomalies.length}
                        </span>
                    </p>
                    <div className="mt-1.5 space-y-1">
                        {anomalies.map((a, idx) => (
                            <p key={idx} className="text-[10px] text-amber-400/80" data-testid={`anomaly-item-${idx}`}>
                                Unusual activity detected: {getAnomalyDescription(a.type, a.message)}
                            </p>
                        ))}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="shrink-0 rounded p-0.5 text-amber-500 hover:text-amber-300 transition-colors"
                    aria-label="Dismiss anomaly alert banner"
                    data-testid="anomaly-banner-dismiss"
                >
                    <X size={12} aria-hidden="true" />
                </button>
            </div>
        </div>
    )
}
