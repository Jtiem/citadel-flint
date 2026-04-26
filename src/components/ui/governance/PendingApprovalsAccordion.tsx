/**
 * PendingApprovalsAccordion.tsx — C14
 *
 * S8.3 MRS Pending Approvals accordion section.
 * Shows mutations awaiting Amber/Red risk-tier approval.
 * Pure presentational — all data and callbacks passed as props.
 *
 * GLASSTYPO.1 Group C — migrated to Interaction Schema + token vocabulary.
 * Per contract §Governance Panel Mapping:
 *   PendingApprovals → Section with expandedWhen: (ctx) => ctx.pendingApprovals > 0
 *
 * @schemaRole primary-content (section title)
 * @schemaRole cta-secondary (Approve / Reject buttons)
 * @schemaRole state-signal (pending count badge, risk tier badge)
 */

import Section, { type SectionContext } from '../primitives/Section';
import StatBadge from '../primitives/StatBadge';
import type { PendingMutation } from '../../../types/flint-api';

// ── Constants ─────────────────────────────────────────────────────────────────

const RISK_TIER_STYLE: Record<string, string> = {
  Amber: 'border-amber-500/40 bg-amber-900/20',
  Red: 'border-red-500/40 bg-red-900/20',
};

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface PendingApprovalsAccordionProps {
  /** Whether the accordion is expanded — passed from parent for controlled state. */
  isOpen: boolean;
  /** Toggle callback. */
  onToggle: () => void;
  /** List of pending mutations awaiting approval. */
  pendingMutations: PendingMutation[];
  /** Handler: approve mutation by ID. */
  onApprove: (id: number) => void;
  /** Handler: reject mutation by ID. */
  onReject: (id: number) => void;
}

// ── Token styles ──────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
};

const BODY_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-body)',
  lineHeight: 'var(--text-body-lh)',
  fontWeight: 'var(--text-body-weight)',
};

// expandedWhen: expands iff there are pending approvals (actionable lever).
const PENDING_EXPANDED_WHEN = (ctx: SectionContext): boolean =>
  (ctx.pendingApprovals ?? 0) > 0;

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * PendingApprovalsAccordion — actionable section for mutation approvals.
 *
 * @schemaRole primary-content
 */
export function PendingApprovalsAccordion({
  pendingMutations,
  onApprove,
  onReject,
}: PendingApprovalsAccordionProps) {
  if (pendingMutations.length === 0) return null;

  const pendingCount = pendingMutations.length;

  return (
    <div data-testid="pending-approvals-section" className="border-t border-zinc-800/60">
      <Section
        title="Pending Approvals"
        schemaRole="primary-content"
        expandedWhen={PENDING_EXPANDED_WHEN}
        id="pending-approvals-accordion"
        action={
          <StatBadge variant="warning" compact>
            {pendingCount} pending
          </StatBadge>
        }
      >
        <div
          className="px-3 py-2 space-y-1.5"
          data-testid="pending-approvals-list"
        >
          {pendingMutations.map((m) => (
            <div
              key={m.id}
              className={`rounded border px-3 py-2 ${
                RISK_TIER_STYLE[m.riskTier] ??
                'border-zinc-700 bg-zinc-800/50'
              }`}
              data-testid={`pending-mutation-${m.id}`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {/* Primary content: mutation type + file */}
                  <p
                    className="truncate"
                    style={{ ...BODY_STYLE, fontWeight: 500, color: 'var(--text-primary)' }}
                  >
                    {m.type} — {m.filePath.split('/').pop() ?? m.filePath}
                  </p>

                  {/* Support-evidence: risk score + tier + agent */}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="font-mono"
                      style={{ ...LABEL_STYLE, color: 'var(--text-secondary)' }}
                    >
                      Risk: {m.riskScore}
                    </span>
                    {/* State-signal: risk tier */}
                    <StatBadge
                      variant={m.riskTier === 'Red' ? 'critical' : 'warning'}
                      compact
                    >
                      {m.riskTier}
                    </StatBadge>
                    {m.agentId && (
                      <span
                        className="truncate"
                        style={{ ...LABEL_STYLE, color: 'var(--text-tertiary)' }}
                      >
                        Agent: {m.agentId}
                      </span>
                    )}
                  </div>
                </div>

                {/* CTA-secondary: Approve / Reject */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void onApprove(m.id)}
                    data-schema-role="cta-secondary"
                    className="rounded border border-emerald-500/40 bg-emerald-900/20 px-2 py-0.5 hover:bg-emerald-900/40 transition-colors"
                    aria-label={`Approve mutation ${m.id}`}
                    data-testid={`approve-mutation-${m.id}`}
                    style={{ ...LABEL_STYLE, color: 'var(--text-accent)' }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void onReject(m.id)}
                    data-schema-role="cta-secondary"
                    className="rounded border border-red-500/40 bg-red-900/20 px-2 py-0.5 hover:bg-red-900/40 transition-colors"
                    aria-label={`Reject mutation ${m.id}`}
                    data-testid={`reject-mutation-${m.id}`}
                    style={{ ...LABEL_STYLE, color: 'var(--text-secondary)' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
