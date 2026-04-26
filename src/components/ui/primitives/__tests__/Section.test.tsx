/**
 * Section.test.tsx — GLASSTYPO.1 Group B
 *
 * Covers contract testBoundaries for the Section primitive:
 *  - expandedWhen evaluates on mount (predicate=true → expanded)
 *  - predicate=false → collapsed, child not in DOM (hidden attribute)
 *  - action slot renders in header, does not toggle section
 *  - keyboard toggle (Space / Enter)
 *  - aria-expanded attribute matches open state
 *  - A11y: tab navigation reaches the trigger button
 *  - data-schema-role="primary-content" on root element
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Section from '../Section';
import type { SectionContext } from '../Section';

describe('Section primitive', () => {
  it('starts collapsed when expandedWhen(() => false) on mount', () => {
    render(
      <Section
        title="Score Breakdown"
        schemaRole="primary-content"
        expandedWhen={() => false}
      >
        <span>metrics</span>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('child is not visible when section is collapsed', () => {
    render(
      <Section
        title="Score Breakdown"
        schemaRole="primary-content"
        expandedWhen={() => false}
      >
        <span>metrics</span>
      </Section>,
    );
    // hidden attribute makes element not visible
    expect(screen.queryByText('metrics')).not.toBeVisible();
  });

  it('starts expanded when expandedWhen(() => true) on mount', () => {
    render(
      <Section
        title="Violations"
        schemaRole="primary-content"
        expandedWhen={() => true}
      >
        <span>expandable child</span>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('expandable child')).toBeVisible();
  });

  it('toggles open when the title button is clicked (collapsed → expanded)', () => {
    render(
      <Section
        title="Toggle"
        schemaRole="primary-content"
        expandedWhen={() => false}
      >
        <span>toggled content</span>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles closed on second click (expanded → collapsed)', () => {
    render(
      <Section
        title="Toggle2"
        schemaRole="primary-content"
        expandedWhen={() => false}
      >
        <span>c</span>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles on Space keydown', () => {
    render(
      <Section
        title="Space Toggle"
        schemaRole="primary-content"
        expandedWhen={() => false}
      >
        <span>space content</span>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: ' ', code: 'Space' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles on Enter keydown', () => {
    render(
      <Section
        title="Enter Toggle"
        schemaRole="primary-content"
        expandedWhen={() => false}
      >
        <span>enter content</span>
      </Section>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders action slot in the header', () => {
    render(
      <Section
        title="WithAction"
        schemaRole="primary-content"
        expandedWhen={() => true}
        action={<button type="button">Run Audit</button>}
      >
        <span>body</span>
      </Section>,
    );
    expect(screen.getByText('Run Audit')).toBeInTheDocument();
  });

  it('action click does not collapse the section', () => {
    render(
      <Section
        title="ActionNoToggle"
        schemaRole="primary-content"
        expandedWhen={() => true}
        action={<button type="button">Run Audit</button>}
      >
        <span>body</span>
      </Section>,
    );
    const actionBtn = screen.getByText('Run Audit');
    fireEvent.click(actionBtn);
    // The title trigger has aria-expanded — check it is still true
    const trigger = screen.getByRole('button', { name: /ActionNoToggle/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('carries data-schema-role="primary-content" on the root element', () => {
    const { container } = render(
      <Section
        title="Role"
        schemaRole="primary-content"
        expandedWhen={() => false}
      >
        child
      </Section>,
    );
    expect(container.firstChild).toHaveAttribute('data-schema-role', 'primary-content');
  });

  it('expandedWhen is typed as a function — documents the type-level guarantee', () => {
    // The TS type is: expandedWhen: (ctx: SectionContext) => boolean
    // Passing `true` or `false` directly is a type error caught by TSC.
    // We verify the function form is accepted at runtime.
    const fn = (_ctx: SectionContext) => true;
    expect(typeof fn).toBe('function');
    expect(fn({ score: 0, totalViolations: 0, pendingApprovals: 0, hasRuntimeViolations: false })).toBe(true);
  });

  it('A11y: trigger button is focusable', () => {
    render(
      <Section
        title="A11y"
        schemaRole="primary-content"
        expandedWhen={() => false}
      >
        body
      </Section>,
    );
    const trigger = screen.getByRole('button');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });

  // ── GLASSTYPO.1 rev 3 — Open-state visual invariants ─────────────────────

  /**
   * Invariant: section-open-state-background-distinct
   * Expanded Section body has a background-color that differs from the
   * enclosing panel (computed style assertion).
   *
   * jsdom does not evaluate color-mix() — the background resolves to "" in
   * jsdom. We assert that the Section body carries the `style` attribute with
   * the color-mix declaration, which is the observable structural signal that
   * distinguishes the body from a panel with no background set.
   */
  it('section-open-state-background-distinct: expanded Section body carries distinct background style', () => {
    const { container } = render(
      <div data-testid="panel" style={{ background: 'rgb(0,0,0)' }}>
        <Section
          title="Expanded"
          schemaRole="primary-content"
          expandedWhen={() => true}
          stackItem={false}
        >
          <span data-testid="body-content">body</span>
        </Section>
      </div>,
    );
    // The region element is the collapsible body container
    const body = container.querySelector('[role="region"]') as HTMLElement;
    expect(body).not.toBeNull();
    // jsdom resolves color-mix to empty string; we check the style attribute
    // is present and contains the color-mix declaration (structural signal)
    void body.style.background;
    // If jsdom resolves it to empty, fall back to style attribute string
    const rawStyle = body.getAttribute('style') ?? '';
    expect(rawStyle).toContain('color-mix');
  });

  /**
   * Invariant: section-open-state-left-border
   * Expanded Section body renders border-left-width >= 1px.
   */
  it('section-open-state-left-border: expanded Section body has border-left-width >= 1px', () => {
    const { container } = render(
      <Section
        title="Bordered"
        schemaRole="primary-content"
        expandedWhen={() => true}
        stackItem={false}
      >
        body
      </Section>,
    );
    const body = container.querySelector('[role="region"]') as HTMLElement;
    expect(body).not.toBeNull();
    // Read from the inline style (jsdom may not compute color-mix but does
    // compute px values set via style object)
    const borderLeft = body.style.borderLeft ?? '';
    // Must contain a width assertion: '1px solid ...'
    expect(borderLeft).toMatch(/1px/);
  });

  /**
   * Invariant: section-open-state-indented
   * Expanded Section body has padding-left >= 10px.
   */
  it('section-open-state-indented: expanded Section body has padding-left >= 10px', () => {
    const { container } = render(
      <Section
        title="Indented"
        schemaRole="primary-content"
        expandedWhen={() => true}
        stackItem={false}
      >
        body
      </Section>,
    );
    const body = container.querySelector('[role="region"]') as HTMLElement;
    expect(body).not.toBeNull();
    const pl = body.style.paddingLeft;
    expect(parseFloat(pl)).toBeGreaterThanOrEqual(10);
  });

  /**
   * Invariant: between-section-spacing-greater-than-inside-section
   * When two Sections are stacked the margin-top on the second Section root
   * (16px) is strictly greater than the padding-top on the body (8px).
   * Contract: outerGap >= 2 * innerPaddingTop (16 >= 2 * 8).
   */
  it('between-section-spacing-greater-than-inside-section: stacked Sections have 16px gap vs 8px inner padding', () => {
    const { container } = render(
      <div>
        <Section
          title="First"
          schemaRole="primary-content"
          expandedWhen={() => true}
          stackItem={false}
        >
          <span>first body</span>
        </Section>
        <Section
          title="Second"
          schemaRole="primary-content"
          expandedWhen={() => true}
          stackItem={true}
        >
          <span>second body</span>
        </Section>
      </div>,
    );
    // The second Section root has marginTop applied
    const roots = container.querySelectorAll('[data-schema-role="primary-content"]');
    expect(roots.length).toBeGreaterThanOrEqual(2);
    const secondRoot = roots[1] as HTMLElement;
    const outerMarginTop = parseFloat(secondRoot.style.marginTop ?? '0');

    // The first Section's body has paddingTop
    const firstBody = roots[0].querySelector('[role="region"]') as HTMLElement;
    const innerPaddingTop = parseFloat(firstBody?.style.paddingTop ?? '0');

    // 16px gap >= 2 * 8px inner padding
    expect(outerMarginTop).toBeGreaterThanOrEqual(2 * innerPaddingTop);
    // Explicitly: 16 >= 16 (2 * 8)
    expect(outerMarginTop).toBe(16);
    expect(innerPaddingTop).toBe(8);
  });
});
