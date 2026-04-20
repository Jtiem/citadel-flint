/**
 * PropertyRow.test.tsx — GLASSTYPO.1 Group B
 *
 * Contract testBoundaries covered:
 *  - Label renders at text-label (11px) — verified via inline style
 *  - Value renders at text-body (12px) — verified via inline style
 *  - schemaRole="metadata" applies text-tertiary to value
 *  - mono=true adds font-mono class
 *  - Numeric string value auto-detects mono
 *  - hoverAction present in DOM (opacity managed by CSS group-hover)
 *  - schemaRole data attribute set correctly
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PropertyRow from '../PropertyRow';

describe('PropertyRow primitive', () => {
  it('renders label and value text', () => {
    render(<PropertyRow label="Score" value="98" />);
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('98')).toBeInTheDocument();
  });

  it('label has font-size CSS custom property --text-label', () => {
    render(<PropertyRow label="Score" value="98" />);
    const label = screen.getByText('Score');
    expect(label).toHaveStyle({ fontSize: 'var(--text-label)' });
  });

  it('value has font-size CSS custom property --text-body', () => {
    render(<PropertyRow label="Score" value="98" />);
    const value = screen.getByText('98');
    expect(value).toHaveStyle({ fontSize: 'var(--text-body)' });
  });

  it('support-evidence role applies text-primary to value', () => {
    render(<PropertyRow label="Label" value="val" schemaRole="support-evidence" />);
    const value = screen.getByText('val');
    expect(value).toHaveStyle({ color: 'var(--text-primary)' });
  });

  it('metadata role applies text-tertiary to value (compression)', () => {
    render(
      <PropertyRow
        label="Tracking since"
        value="2 days ago"
        schemaRole="metadata"
      />,
    );
    const value = screen.getByText('2 days ago');
    expect(value).toHaveStyle({ color: 'var(--text-tertiary)' });
  });

  it('mono=true adds font-mono class to value span', () => {
    render(<PropertyRow label="Width" value="320px" mono />);
    const value = screen.getByText('320px');
    expect(value.className).toContain('font-mono');
  });

  it('auto-detects numeric string and adds font-mono', () => {
    render(<PropertyRow label="Count" value="42" />);
    const value = screen.getByText('42');
    expect(value.className).toContain('font-mono');
  });

  it('non-numeric string does not get font-mono', () => {
    render(<PropertyRow label="Name" value="Button" />);
    const value = screen.getByText('Button');
    expect(value.className).not.toContain('font-mono');
  });

  it('hover actions are present in DOM', () => {
    render(
      <PropertyRow
        label="X"
        value="Y"
        actions={<button type="button">Fix</button>}
      />,
    );
    // The action node should be in the DOM even if opacity-0 via CSS
    expect(screen.getByText('Fix')).toBeInTheDocument();
  });

  it('carries data-schema-role attribute (defaults to support-evidence)', () => {
    const { container } = render(<PropertyRow label="L" value="V" />);
    const row = container.firstChild as HTMLElement;
    expect(row).toHaveAttribute('data-schema-role', 'support-evidence');
  });

  it('carries data-schema-role="metadata" when role is metadata', () => {
    const { container } = render(
      <PropertyRow label="L" value="V" schemaRole="metadata" />,
    );
    const row = container.firstChild as HTMLElement;
    expect(row).toHaveAttribute('data-schema-role', 'metadata');
  });

  it('renders ReactNode value (not just string)', () => {
    render(
      <PropertyRow label="Status" value={<span data-testid="chip">Active</span>} />,
    );
    expect(screen.getByTestId('chip')).toBeInTheDocument();
  });
});
