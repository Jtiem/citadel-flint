/**
 * FormPropsSection tests — INSPECTOR.1 Group B
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormPropsSection from '../FormPropsSection';
import type { VisualLayer } from '../../../core/ast-parser';
import '../../../components/__tests__/setup';

function makeLayer(partial: Partial<VisualLayer> & { tagName: string }): VisualLayer {
  return {
    id: `${partial.tagName}:1:0`,
    line: 1,
    children: [],
    ...partial,
  };
}

describe('FormPropsSection', () => {
  it('renders without crashing for a minimal input layer', () => {
    const layer = makeLayer({
      tagName: 'input',
      props: { type: 'email', name: 'email' },
    });
    render(<FormPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByTestId('form-props-section')).toBeTruthy();
  });

  it('renders Type and Name rows for <input type="email" name="email">', () => {
    const layer = makeLayer({
      tagName: 'input',
      props: { type: 'email', name: 'email' },
    });
    render(<FormPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('Type')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    // Both type and name have value "email" — there should be at least 2 occurrences
    const emailMatches = screen.getAllByText('email');
    expect(emailMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT render rows for props that are absent', () => {
    const layer = makeLayer({
      tagName: 'input',
      props: { type: 'text' },
    });
    render(<FormPropsSection layer={layer} onCommitProp={vi.fn()} />);
    // placeholder was not passed → should not appear as a label
    expect(screen.queryByText('Placeholder')).toBeNull();
    expect(screen.queryByText('Required')).toBeNull();
    expect(screen.queryByText('Disabled')).toBeNull();
  });

  it('renders boolean required prop as "true"', () => {
    const layer = makeLayer({
      tagName: 'input',
      props: { required: true },
    });
    render(<FormPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('Required')).toBeTruthy();
    expect(screen.getByText('true')).toBeTruthy();
  });

  it('renders placeholder when present', () => {
    const layer = makeLayer({
      tagName: 'input',
      props: { placeholder: 'Enter email' },
    });
    render(<FormPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('Placeholder')).toBeTruthy();
    expect(screen.getByText('Enter email')).toBeTruthy();
  });

  it('renders empty state when layer has no form props', () => {
    const layer = makeLayer({ tagName: 'input' });
    render(<FormPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText(/no form props found/i)).toBeTruthy();
  });

  it('renders section title "Form Props"', () => {
    const layer = makeLayer({ tagName: 'input', props: { type: 'text' } });
    render(<FormPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('Form Props')).toBeTruthy();
  });
});
