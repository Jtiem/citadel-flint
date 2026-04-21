/**
 * A11ySection tests — INSPECTOR.1 Group B
 *
 * Invariants under test:
 *  - Warden violations for the selected node render as inline StatBadge
 *  - Severity heuristic: critical-keyword violations → critical badge
 *  - No violations → empty state
 *  - ARIA props render as PropertyRow entries
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import A11ySection from '../A11ySection';
import { useCanvasStore } from '../../../store/canvasStore';
import type { VisualLayer } from '../../../core/ast-parser';
import '../../../components/__tests__/setup';

function makeLayer(partial: Partial<VisualLayer> & { tagName: string }): VisualLayer {
  return {
    id: `${partial.tagName}:5:2`,
    line: 5,
    children: [],
    ...partial,
  };
}

describe('A11ySection', () => {
  beforeEach(() => {
    // Clear a11y violations between tests
    useCanvasStore.setState({ a11yViolations: {} });
  });

  it('renders without crashing for a minimal button layer', () => {
    const layer = makeLayer({ tagName: 'button' });
    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByTestId('a11y-section')).toBeTruthy();
  });

  it('renders a Warden violation as an inline StatBadge when violations exist for the node', () => {
    const layer = makeLayer({ tagName: 'button' });
    useCanvasStore.setState({
      a11yViolations: {
        'button:5:2': ['Missing accessible name'],
      },
    });

    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);

    // Violation message should be visible
    expect(screen.getByText('Missing accessible name')).toBeTruthy();
  });

  it('renders a CRITICAL badge for a violation containing keyword "missing"', () => {
    const layer = makeLayer({ tagName: 'img' });
    useCanvasStore.setState({
      a11yViolations: {
        'img:5:2': ['missing alt attribute'],
      },
    });

    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);

    const criticalBadge = document.querySelector('[data-variant="critical"]');
    expect(criticalBadge).not.toBeNull();
  });

  it('renders a WARNING badge for a generic advisory violation', () => {
    const layer = makeLayer({ tagName: 'div' });
    useCanvasStore.setState({
      a11yViolations: {
        'div:5:2': ['Consider adding a landmark role'],
      },
    });

    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);

    const warningBadge = document.querySelector('[data-variant="warning"]');
    expect(warningBadge).not.toBeNull();
  });

  it('renders multiple violations for the same node', () => {
    const layer = makeLayer({ tagName: 'button' });
    useCanvasStore.setState({
      a11yViolations: {
        'button:5:2': [
          'Missing accessible name',
          'Consider adding a visible label',
        ],
      },
    });

    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);

    expect(screen.getByText('Missing accessible name')).toBeTruthy();
    expect(screen.getByText('Consider adding a visible label')).toBeTruthy();
  });

  it('renders aria-label prop row when present', () => {
    const layer = makeLayer({
      tagName: 'button',
      props: { 'aria-label': 'Close dialog' },
    });
    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('aria-label')).toBeTruthy();
    expect(screen.getByText('Close dialog')).toBeTruthy();
  });

  it('renders role prop row when present', () => {
    const layer = makeLayer({
      tagName: 'div',
      props: { role: 'navigation' },
    });
    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('Role')).toBeTruthy();
    expect(screen.getByText('navigation')).toBeTruthy();
  });

  it('renders empty state when no aria props and no violations', () => {
    const layer = makeLayer({ tagName: 'div' });
    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText(/no accessibility props or violations found/i)).toBeTruthy();
  });

  it('renders section title "Accessibility"', () => {
    const layer = makeLayer({ tagName: 'button' });
    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('Accessibility')).toBeTruthy();
  });

  it('does NOT render violations from a different node id', () => {
    const layer = makeLayer({ tagName: 'button' }); // id = 'button:5:2'
    useCanvasStore.setState({
      a11yViolations: {
        'div:10:4': ['Some other violation'],
      },
    });

    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.queryByText('Some other violation')).toBeNull();
  });

  it('violation list region has accessible label', () => {
    const layer = makeLayer({ tagName: 'button' });
    useCanvasStore.setState({
      a11yViolations: { 'button:5:2': ['Missing accessible name'] },
    });

    render(<A11ySection layer={layer} onCommitProp={vi.fn()} />);

    const list = document.querySelector('[role="list"][aria-label]');
    expect(list).not.toBeNull();
  });
});
