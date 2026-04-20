/**
 * RuntimeAuditAccordion.tsx — src/components/ui/governance/RuntimeAuditAccordion.tsx
 *
 * RUNTIME.1 Glass UI: renders runtime-sourced accessibility findings from
 * the axe-core adapter inside the GovernanceDashboard MoreDetailsPanel.
 *
 * GLASSTYPO.1 Group C — migrated to Interaction Schema + token vocabulary.
 * Section labels use text-label + text-secondary (NOT uppercase utility).
 *
 * @schemaRole metadata (passive audit info — collapses by default)
 * @schemaRole support-evidence (finding rows)
 * @schemaRole state-signal (source authority chips)
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { MergedA11yFinding, RuntimeSourceAuthority } from '../../../types/runtime-audit';

// ── Source Authority chip ─────────────────────────────────────────────────────

const AUTHORITY_LABEL: Record<RuntimeSourceAuthority, string> = {
  'WCAG 2.1 AA': 'AST',
  'WCAG 2.2 AA': 'AST',
  SOC2: 'AST',
  'FDA SaMD': 'AST',
  HIPAA: 'AST',
  'Section 508': 'AST',
  'Flint Design System': 'AST',
  Custom: 'AST',
  'runtime-dom': 'Runtime',
};

export interface SourceAuthorityChipProps {
  authority: RuntimeSourceAuthority;
}

/**
 * SourceAuthorityChip — state-signal chip for AST vs Runtime authority.
 *
 * @schemaRole state-signal
 */
export function SourceAuthorityChip({ authority }: SourceAuthorityChipProps) {
  const isRuntime = authority === 'runtime-dom';
  const label = AUTHORITY_LABEL[authority] ?? authority;
  const cls = isRuntime
    ? 'bg-indigo-900/20 text-indigo-300 border border-indigo-700/40'
    : 'bg-zinc-800 text-zinc-300 border border-zinc-700';
  return (
    <span
      data-schema-role="state-signal"
      data-testid="source-authority-chip"
      data-authority={authority}
      className={`inline-flex items-center rounded px-1.5 py-0.5 ${cls}`}
      style={{
        fontSize: 'var(--text-micro)',
        fontWeight: 'var(--text-micro-weight)',
        lineHeight: 'var(--text-micro-lh)',
      }}
    >
      {label}
    </span>
  );
}

// ── Accordion props ───────────────────────────────────────────────────────────

export interface RuntimeAuditAccordionProps {
  /** All AST+runtime merged findings. Runtime-only rows filtered internally. */
  findings: MergedA11yFinding[];
}

// ── Token styles ──────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-label)',
  lineHeight: 'var(--text-label-lh)',
  fontWeight: 'var(--text-label-weight)',
  color: 'var(--text-secondary)',
};

const BODY_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-body)',
  lineHeight: 'var(--text-body-lh)',
  fontWeight: 'var(--text-body-weight)',
  color: 'var(--text-secondary)',
};

// ── Accordion ─────────────────────────────────────────────────────────────────

/**
 * RuntimeAuditAccordion — metadata section for runtime axe findings.
 *
 * @schemaRole metadata
 */
export function RuntimeAuditAccordion({ findings }: RuntimeAuditAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const runtimeOnly = findings.filter(
    (f) =>
      f.sourceAuthorities.length === 1 && f.sourceAuthorities[0] === 'runtime-dom'
  );
  const merged = findings.filter((f) => f.sourceAuthorities.length > 1);

  return (
    <section
      role="region"
      aria-labelledby="runtime-audit-accordion-heading"
      data-schema-role="metadata"
      data-testid="runtime-audit-accordion"
      className="border-t border-zinc-800/60"
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
        aria-expanded={isOpen}
        aria-controls="runtime-audit-accordion-body"
        id="runtime-audit-accordion-heading"
      >
        {isOpen ? (
          <ChevronDown size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
        ) : (
          <ChevronRight size={12} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
        )}
        <span className="flex-1" style={LABEL_STYLE}>
          Runtime Audit
        </span>
        {runtimeOnly.length + merged.length > 0 && (
          <span
            className="font-mono"
            style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)' }}
          >
            {runtimeOnly.length + merged.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div id="runtime-audit-accordion-body" className="px-3 py-2 space-y-3">
          {merged.length > 0 && (
            <div>
              {/* Section label — title-case (NOT uppercase utility) */}
              <p className="mb-1.5" style={LABEL_STYLE}>
                Agreed (AST + Runtime)
              </p>
              <ul
                role="list"
                data-testid="runtime-audit-merged-list"
                className="space-y-1.5"
              >
                {merged.map((f) => (
                  <li
                    key={`merged:${f.ruleId}:${f.elementId}`}
                    data-testid="runtime-audit-merged-row"
                    className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-zinc-800/30"
                  >
                    <div className="flex shrink-0 items-center gap-1">
                      {f.sourceAuthorities.map((auth, i) => (
                        <SourceAuthorityChip key={`${auth}-${i}`} authority={auth} />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="truncate font-mono"
                        style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
                      >
                        {f.ruleId}
                      </p>
                      <p className="truncate" style={BODY_STYLE}>
                        {f.message}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            {merged.length > 0 && (
              <p className="mb-1.5" style={LABEL_STYLE}>
                Runtime only
              </p>
            )}
            {runtimeOnly.length === 0 && merged.length === 0 ? (
              <p style={{ ...BODY_STYLE, color: 'var(--text-secondary)' }}>
                No runtime-only findings
              </p>
            ) : runtimeOnly.length === 0 ? null : (
              <ul
                role="list"
                data-testid="runtime-audit-findings-list"
                className="space-y-1.5"
              >
                {runtimeOnly.map((f) => (
                  <li
                    key={`${f.ruleId}:${f.elementId}`}
                    data-testid="runtime-audit-finding-row"
                    className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-zinc-800/30"
                  >
                    <SourceAuthorityChip authority="runtime-dom" />
                    <div className="flex-1 min-w-0">
                      <p
                        className="truncate font-mono"
                        style={{ fontSize: 'var(--text-body)', color: 'var(--text-primary)' }}
                      >
                        {f.ruleId}
                      </p>
                      <p className="truncate" style={BODY_STYLE}>
                        {f.message}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
