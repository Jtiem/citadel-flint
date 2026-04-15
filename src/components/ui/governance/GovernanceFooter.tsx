/**
 * GovernanceFooter.tsx — C7 — extracted from GovernanceDashboard (Sprint 2 refactor)
 *
 * Governance navigation footer row. Shows "Manage rules →" and/or
 * "Policy settings →" links. Only rendered when there are active violations
 * and at least one navigation prop is provided.
 *
 * Source lines: GovernanceDashboard.tsx ~2252-2288
 */

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GovernanceFooterProps {
    /** Whether the footer should be visible (tokenCount > 0 && violations exist). */
    visible: boolean
    /** Legacy: Opens the full GovernancePanel rules manager. */
    onOpenGovernancePanel?: () => void
    /** COUNSEL.4.3: Navigate to the GovernancePanel rules manager. */
    onManageRules?: () => void
    /** COUNSEL.4.3: Navigate to Policy Settings. */
    onPolicySettings?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GovernanceFooter({
    visible,
    onOpenGovernancePanel,
    onManageRules,
    onPolicySettings,
}: GovernanceFooterProps) {
    if (!visible) return null
    if (!onOpenGovernancePanel && !onManageRules && !onPolicySettings) return null

    return (
        <div className="flex items-center justify-end gap-3 border-b border-zinc-800/60 px-3 py-1.5">
            {/* Legacy "Configure rules" via onOpenGovernancePanel (S5.8) */}
            {onOpenGovernancePanel && !onManageRules && (
                <button
                    type="button"
                    onClick={onOpenGovernancePanel}
                    className="text-[10px] text-zinc-600 underline-offset-2 hover:text-indigo-400 hover:underline transition-colors"
                >
                    Configure rules
                </button>
            )}
            {/* COUNSEL.4.3: "Manage rules →" link */}
            {onManageRules && (
                <button
                    type="button"
                    onClick={onManageRules}
                    className="text-[10px] text-zinc-500 underline-offset-2 hover:text-indigo-400 hover:underline transition-colors"
                    data-testid="manage-rules-link"
                >
                    Manage rules →
                </button>
            )}
            {/* COUNSEL.4.3: "Policy settings →" link */}
            {onPolicySettings && (
                <button
                    type="button"
                    onClick={onPolicySettings}
                    className="text-[10px] text-zinc-500 underline-offset-2 hover:text-indigo-400 hover:underline transition-colors"
                    data-testid="policy-settings-link"
                >
                    Policy settings →
                </button>
            )}
        </div>
    )
}
