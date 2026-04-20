/**
 * StatBadge.test.tsx — GLASSTYPO.1 Group B
 *
 * Contract testBoundaries covered:
 *  - All 4 variants render distinct className sets (different Tailwind bg + border + text)
 *  - text-label font-size token applied via inline style
 *  - dot prop renders a colored dot element
 *  - compact prop applies tighter padding class
 *  - data-schema-role="state-signal" on every badge
 *  - data-variant attribute set correctly
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatBadge from '../StatBadge';

describe('StatBadge primitive', () => {
  it('renders children', () => {
    render(<StatBadge variant="neutral">3 issues</StatBadge>);
    expect(screen.getByText('3 issues')).toBeInTheDocument();
  });

  it('applies --text-label font-size via inline style', () => {
    render(<StatBadge variant="success">OK</StatBadge>);
    const badge = screen.getByText('OK');
    expect(badge).toHaveStyle({ fontSize: 'var(--text-label)' });
  });

  it('success variant has emerald classes', () => {
    render(<StatBadge variant="success">OK</StatBadge>);
    const badge = screen.getByText('OK');
    expect(badge.className).toContain('bg-emerald-900/20');
    expect(badge.className).toContain('text-emerald-400');
  });

  it('warning variant has amber classes', () => {
    render(<StatBadge variant="warning">Warn</StatBadge>);
    const badge = screen.getByText('Warn');
    expect(badge.className).toContain('bg-amber-900/20');
    expect(badge.className).toContain('text-amber-400');
  });

  it('critical variant has red classes', () => {
    render(<StatBadge variant="critical">3</StatBadge>);
    const badge = screen.getByText('3');
    expect(badge.className).toContain('bg-red-900/10');
    expect(badge.className).toContain('text-red-400');
  });

  it('neutral variant has zinc classes', () => {
    render(<StatBadge variant="neutral">0</StatBadge>);
    const badge = screen.getByText('0');
    expect(badge.className).toContain('bg-zinc-800');
  });

  it('all 4 variants produce distinct className sets', () => {
    const { getAllByRole } = render(
      <>
        <StatBadge variant="success">S</StatBadge>
        <StatBadge variant="warning">W</StatBadge>
        <StatBadge variant="critical">C</StatBadge>
        <StatBadge variant="neutral">N</StatBadge>
      </>,
    );
    const badges = document.querySelectorAll('[data-schema-role="state-signal"]');
    const classNames = Array.from(badges).map(b => b.className);
    // All 4 must be unique
    const unique = new Set(classNames);
    expect(unique.size).toBe(4);
  });

  it('dot=true renders a dot element', () => {
    render(<StatBadge variant="critical" dot>3</StatBadge>);
    // The dot span has aria-hidden
    const dot = document.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
    expect(dot?.className).toContain('rounded-full');
  });

  it('dot=false (default) does not render a dot', () => {
    render(<StatBadge variant="success">OK</StatBadge>);
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
  });

  it('compact=true applies tighter padding', () => {
    render(<StatBadge variant="neutral" compact>N</StatBadge>);
    const badge = screen.getByText('N');
    expect(badge.className).toContain('px-1');
    expect(badge.className).not.toContain('px-1.5');
  });

  it('carries data-schema-role="state-signal"', () => {
    render(<StatBadge variant="warning">W</StatBadge>);
    const badge = screen.getByText('W');
    expect(badge).toHaveAttribute('data-schema-role', 'state-signal');
  });

  it('carries data-variant attribute', () => {
    render(<StatBadge variant="critical">C</StatBadge>);
    expect(screen.getByText('C')).toHaveAttribute('data-variant', 'critical');
  });
});
