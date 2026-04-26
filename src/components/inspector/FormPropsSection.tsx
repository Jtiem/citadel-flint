/**
 * FormPropsSection — src/components/inspector/FormPropsSection.tsx
 *
 * Inspector section for form-element-specific props:
 * name, value, placeholder, type, required, disabled, checked.
 *
 * Reads prop values from the VisualLayer's `props` map. No token matching
 * applied (form props are not token-backed). Off-token flagging not relevant.
 *
 * @schemaRole support-evidence (root)
 * CONTRACT: INSPECTOR.1 Group B
 * Commandments: C2, C13 (read-only)
 */

import React from 'react';
import Section from '../ui/primitives/Section';
import PropertyRow from '../ui/primitives/PropertyRow';
import type { VisualLayer } from '../../core/ast-parser';

export interface FormPropsSectionProps {
  layer: VisualLayer;
  onCommitProp: (propName: string, value: string | undefined) => void;
  /** FIX 1: Controls whether the Section starts expanded (ODQ-3 primary-only). */
  initiallyExpanded?: boolean;
}

/** Ordered list of form prop names to display when present. */
const FORM_PROPS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'type',        label: 'Type' },
  { key: 'name',        label: 'Name' },
  { key: 'value',       label: 'Value' },
  { key: 'placeholder', label: 'Placeholder' },
  { key: 'required',    label: 'Required' },
  { key: 'disabled',    label: 'Disabled' },
  { key: 'checked',     label: 'Checked' },
];

/** Returns a displayable string for a prop value. */
function displayValue(v: string | boolean | undefined): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return v;
}

const FormPropsSection: React.FC<FormPropsSectionProps> = ({ layer, initiallyExpanded = false }) => {
  const props = layer.props ?? {};

  const rows = FORM_PROPS.map(({ key, label }) => {
    const raw = props[key];
    const display = displayValue(raw);
    if (display === null) return null;
    return (
      <PropertyRow
        key={key}
        label={label}
        value={display}
        schemaRole="support-evidence"
        mono={key === 'value' || key === 'type'}
      />
    );
  }).filter(Boolean);

  return (
    <div data-schema-role="support-evidence" data-testid="form-props-section">
      <Section
        title="Form Props"
        schemaRole="primary-content"
        expandedWhen={() => initiallyExpanded}
        stackItem={false}
      >
        {rows.length > 0 ? rows : (
          <p
            className="px-3 py-2"
            style={{ fontSize: 'var(--text-label)', color: 'var(--text-tertiary)' }}
          >
            No form props found.
          </p>
        )}
      </Section>
    </div>
  );
};

export default FormPropsSection;
