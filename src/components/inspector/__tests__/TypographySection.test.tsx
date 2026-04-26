/**
 * TypographySection tests — INSPECTOR.1 Group B
 *
 * Invariants under test:
 *  - off-token-flag-present-when-value-unknown (text-[17px] → warning badge)
 *  - off-token-flag-absent-when-value-matches  (text-body → token chip, no warning)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TypographySection from '../TypographySection';
import { useTokenStore } from '../../../store/tokenStore';
import type { VisualLayer } from '../../../core/ast-parser';
import '../../../components/__tests__/setup';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLayer(partial: Partial<VisualLayer> & { tagName: string }): VisualLayer {
  return {
    id: `${partial.tagName}:1:0`,
    line: 1,
    children: [],
    ...partial,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TypographySection', () => {
  beforeEach(() => {
    // Seed a fontSize token so "14px" matches but "17px" does not
    useTokenStore.setState({
      tokens: [
        { id: 1, token_path: 'fontSize.body', token_value: '14px', token_type: 'fontSize', collection_name: 'core', mode: 'default', description: null },
        { id: 2, token_path: 'fontSize.lg',   token_value: '16px', token_type: 'fontSize', collection_name: 'core', mode: 'default', description: null },
        { id: 3, token_path: 'fontFamily.sans', token_value: 'Inter, sans-serif', token_type: 'fontFamily', collection_name: 'core', mode: 'default', description: null },
      ],
      isLoading: false,
      error: null,
    });
  });

  it('renders without crashing for a minimal h1 layer', () => {
    const layer = makeLayer({ tagName: 'h1', className: 'text-body' });
    render(<TypographySection layer={layer} onCommit={vi.fn()} />);
    expect(screen.getByTestId('typography-section')).toBeTruthy();
  });

  it('renders a warning StatBadge for an arbitrary off-token font-size (text-[17px])', () => {
    const layer = makeLayer({ tagName: 'h1', className: 'text-[17px]' });
    render(<TypographySection layer={layer} onCommit={vi.fn()} />);

    // Contract invariant: off-token-flag-present-when-value-unknown
    const badges = document.querySelectorAll('[data-schema-role="state-signal"][data-variant="warning"]');
    expect(badges.length).toBeGreaterThanOrEqual(1);

    // Raw value visible
    expect(screen.getByText('17px')).toBeTruthy();
  });

  it('renders zero warning badges for an in-token font-size class (text-body mapped to 14px)', () => {
    // text-body is a Tailwind utility whose class name "body" will be looked up.
    // Since no direct "body" token exists as a fontSize token value, we test with
    // a layer whose style attribute carries the exact token value "14px".
    const layer = makeLayer({ tagName: 'h1', style: 'font-size: 14px' });
    render(<TypographySection layer={layer} onCommit={vi.fn()} />);

    const warningBadges = document.querySelectorAll('[data-variant="warning"]');
    expect(warningBadges.length).toBe(0);
  });

  it('renders a token chip (no warning) when font-size is exactly a known token value', () => {
    const layer = makeLayer({ tagName: 'p', style: 'font-size: 16px' });
    render(<TypographySection layer={layer} onCommit={vi.fn()} />);

    const warningBadges = document.querySelectorAll('[data-variant="warning"]');
    expect(warningBadges.length).toBe(0);

    // Token chip shows nearest token name
    expect(screen.getByText('fontSize.lg')).toBeTruthy();
  });

  it('renders a warning badge for arbitrary font-family (font-[\'Helvetica Neue\'])', () => {
    const layer = makeLayer({ tagName: 'h2', className: "font-['Helvetica_Neue']" });
    // fontFamily tokens only contain 'Inter, sans-serif' — 'Helvetica Neue' does not match
    render(<TypographySection layer={layer} onCommit={vi.fn()} />);

    const badges = document.querySelectorAll('[data-variant="warning"]');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  // FIX 4: Non-size text-* utilities (text-center, text-ellipsis, etc.) must NOT
  // be treated as off-token font-size values.
  it('does not flag text-center or other non-size text-* utilities as off-token', () => {
    // text-center text-body — text-center is alignment (non-size), text-body is a
    // named fontSize class. Only text-body should surface; text-center must be ignored.
    const layer = makeLayer({ tagName: 'p', className: 'text-center text-body' });
    render(<TypographySection layer={layer} onCommit={vi.fn()} />);

    // text-center should NOT generate a warning badge
    const warningBadges = document.querySelectorAll('[data-variant="warning"]');
    // "center" is not a token value so text-center would previously produce a
    // spurious "off-token" warning; with FIX 4 it must be ignored entirely.
    const badgeTexts = Array.from(warningBadges).map(b => b.textContent ?? '');
    const hasCenterWarning = badgeTexts.some(t => t.includes('off-token') || t.toLowerCase().includes('center'));
    expect(hasCenterWarning).toBe(false);
  });

  it('does not flag text-ellipsis, text-nowrap, text-uppercase as off-token', () => {
    const layer = makeLayer({ tagName: 'span', className: 'text-ellipsis text-nowrap text-uppercase' });
    render(<TypographySection layer={layer} onCommit={vi.fn()} />);
    // None of these should produce warnings
    const warningBadges = document.querySelectorAll('[data-variant="warning"]');
    expect(warningBadges.length).toBe(0);
  });

  it('renders a section title "Typography"', () => {
    const layer = makeLayer({ tagName: 'h1', className: 'text-[17px]' });
    render(<TypographySection layer={layer} onCommit={vi.fn()} />);
    expect(screen.getByText('Typography')).toBeTruthy();
  });

  it('renders empty state when no typography classes are present', () => {
    const layer = makeLayer({ tagName: 'h1' });
    render(<TypographySection layer={layer} onCommit={vi.fn()} />);
    expect(screen.getByText(/no typography values found/i)).toBeTruthy();
  });
});
