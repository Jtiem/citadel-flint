/**
 * GovernanceFooter.tsx — C7 — extracted from GovernanceDashboard (Sprint 2 refactor)
 *
 * Governance navigation footer row. Shows "Manage rules" and/or
 * "Policy settings" nav-links. Only rendered when there are active violations
 * and at least one navigation prop is provided.
 *
 * GLASSTYPO.1 Group C — migrated to FooterActionBar + FooterLink primitives.
 * Nav-links use --text-secondary (NOT accent) per interaction schema §Q4.
 *
 * @schemaRole nav-link (all children)
 */

import FooterActionBar, { FooterLink } from '../primitives/FooterActionBar';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GovernanceFooterProps {
  /** Whether the footer should be visible (tokenCount > 0 && violations exist). */
  visible: boolean;
  /** Legacy: Opens the full GovernancePanel rules manager. */
  onOpenGovernancePanel?: () => void;
  /** COUNSEL.4.3: Navigate to the GovernancePanel rules manager. */
  onManageRules?: () => void;
  /** COUNSEL.4.3: Navigate to Policy Settings. */
  onPolicySettings?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * GovernanceFooter — nav-link row at the bottom of the governance panel.
 *
 * @schemaRole nav-link
 */
export function GovernanceFooter({
  visible,
  onOpenGovernancePanel,
  onManageRules,
  onPolicySettings,
}: GovernanceFooterProps) {
  if (!visible) return null;
  if (!onOpenGovernancePanel && !onManageRules && !onPolicySettings) return null;

  return (
    <FooterActionBar align="end">
      {/* Legacy "Configure rules" via onOpenGovernancePanel */}
      {onOpenGovernancePanel && !onManageRules && (
        <FooterLink
          onClick={onOpenGovernancePanel}
        >
          Configure rules
        </FooterLink>
      )}

      {/* COUNSEL.4.3: "Manage rules →" link */}
      {onManageRules && (
        <span data-testid="manage-rules-link">
          <FooterLink onClick={onManageRules}>
            Manage rules →
          </FooterLink>
        </span>
      )}

      {/* COUNSEL.4.3: "Policy settings →" link */}
      {onPolicySettings && (
        <span data-testid="policy-settings-link">
          <FooterLink onClick={onPolicySettings}>
            Policy settings →
          </FooterLink>
        </span>
      )}
    </FooterActionBar>
  );
}
