/**
 * A11ySection — src/components/inspector/A11ySection.tsx
 *
 * Inspector section for accessibility props:
 *   aria-label, aria-labelledby, aria-describedby, role, tabIndex
 *
 * Also surfaces any Warden violations that target the selected node, rendering
 * inline StatBadge (critical or warning) for each violation message.
 *
 * A11ySection is itself an accessibility-critical surface — its own markup
 * must satisfy Commandment 5: all interactive elements have labels, region
 * and list semantics are correct.
 *
 * @schemaRole support-evidence (root)
 * CONTRACT: INSPECTOR.1 Group B
 * Commandments: C2, C5, C13 (read-only)
 */

import React from 'react';
import Section from '../ui/primitives/Section';
import PropertyRow from '../ui/primitives/PropertyRow';
import StatBadge from '../ui/primitives/StatBadge';
import MetadataTooltip from '../ui/primitives/MetadataTooltip';
import { useCanvasStore } from '../../store/canvasStore';
import type { VisualLayer } from '../../core/ast-parser';
import { Info } from 'lucide-react';

export interface A11ySectionProps {
  layer: VisualLayer;
  onCommitProp: (propName: string, value: string | undefined) => void;
  /** FIX 1: Controls whether the Section starts expanded (ODQ-3 primary-only). */
  initiallyExpanded?: boolean;
}

// ── Prop descriptors ──────────────────────────────────────────────────────────

const ARIA_PROPS: ReadonlyArray<{
  key: string;
  label: string;
  tooltip: string;
}> = [
  {
    key: 'aria-label',
    label: 'aria-label',
    tooltip: 'Provides an accessible name for elements that lack visible text.',
  },
  {
    key: 'aria-labelledby',
    label: 'aria-labelledby',
    tooltip: 'References the id of another element whose text provides an accessible name.',
  },
  {
    key: 'aria-describedby',
    label: 'aria-describedby',
    tooltip: 'References the id of another element that provides a description.',
  },
  {
    key: 'role',
    label: 'Role',
    tooltip: 'Overrides the implicit ARIA role of an element for assistive technology.',
  },
  {
    key: 'tabIndex',
    label: 'tabIndex',
    tooltip: 'Controls keyboard focus order. 0 = natural order, -1 = programmatically focusable only, positive values create an explicit order.',
  },
];

// ── Violation severity heuristic ─────────────────────────────────────────────
// Warden stores violations as plain strings in a11yViolations[flintId].
// We treat messages containing "critical", "missing", "required", "must"
// as critical; all others as warning.
const CRITICAL_WORDS = /critical|missing|required|must\b/i;

function violationVariant(msg: string): 'critical' | 'warning' {
  return CRITICAL_WORDS.test(msg) ? 'critical' : 'warning';
}

// ── Component ─────────────────────────────────────────────────────────────────

const A11ySection: React.FC<A11ySectionProps> = ({ layer, initiallyExpanded = false }) => {
  const a11yViolations = useCanvasStore(s => s.a11yViolations);

  const props = layer.props ?? {};
  // Violations keyed by flint id (e.g. "div:10:4") or by tagName-based fallback
  const nodeViolations: string[] = a11yViolations[layer.id] ?? [];

  const propRows = ARIA_PROPS.map(({ key, label, tooltip }) => {
    const raw = props[key];
    if (raw === undefined) return null;
    const display = raw === true ? 'true' : raw === false ? 'false' : String(raw);
    return (
      <PropertyRow
        key={key}
        label={
          (
            <span className="flex items-center gap-1">
              <span className="font-mono">{label}</span>
              <MetadataTooltip content={tooltip} side="right">
                <Info size={11} aria-hidden="true" />
              </MetadataTooltip>
            </span>
          ) as unknown as string
        }
        value={display}
        schemaRole="support-evidence"
        mono
      />
    );
  }).filter(Boolean);

  const hasContent = propRows.length > 0 || nodeViolations.length > 0;

  return (
    <div data-schema-role="support-evidence" data-testid="a11y-section">
      <Section
        title="Accessibility"
        schemaRole="primary-content"
        expandedWhen={() => initiallyExpanded || nodeViolations.length > 0}
        stackItem={false}
      >
        {/* ARIA prop rows */}
        {propRows}

        {/* Warden violations for this node */}
        {nodeViolations.length > 0 && (
          <div
            role="list"
            aria-label="Accessibility violations for this element"
            className="mt-2 flex flex-col gap-1 px-3 pb-2"
          >
            {nodeViolations.map((msg, i) => (
              <div key={i} role="listitem" className="flex items-start gap-1.5">
                <StatBadge variant={violationVariant(msg)}>
                  {msg}
                </StatBadge>
              </div>
            ))}
          </div>
        )}

        {!hasContent && (
          <p
            className="px-3 py-2"
            style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}
          >
            No accessibility props or violations found.
          </p>
        )}
      </Section>
    </div>
  );
};

export default A11ySection;
