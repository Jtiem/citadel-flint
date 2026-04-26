/**
 * PanelTabLabel.test.tsx — GLASSTYPO.1 Group B
 *
 * Contract testBoundaries covered:
 *  - text-transform: uppercase applied via inline style (not a utility class)
 *  - font-size uses --text-label token
 *  - letterSpacing 0.06em
 *  - active=true applies text-primary color + underline indicator
 *  - active=false applies text-secondary color
 *  - onClick fires correctly
 *  - role="tab" + aria-selected
 *  - A11y: focusable
 *  - data-schema-role="primary-content"
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PanelTabLabel from '../PanelTabLabel';

describe('PanelTabLabel primitive', () => {
  it('renders children text', () => {
    render(<PanelTabLabel>Governance</PanelTabLabel>);
    expect(screen.getByText('Governance')).toBeInTheDocument();
  });

  it('applies text-transform: uppercase via inline style', () => {
    render(<PanelTabLabel>Governance</PanelTabLabel>);
    const btn = screen.getByRole('tab');
    expect(btn).toHaveStyle({ textTransform: 'uppercase' });
  });

  it('applies fontSize via --text-label CSS custom property', () => {
    render(<PanelTabLabel>Governance</PanelTabLabel>);
    const btn = screen.getByRole('tab');
    expect(btn).toHaveStyle({ fontSize: 'var(--text-label)' });
  });

  it('applies letterSpacing: 0.06em via inline style', () => {
    render(<PanelTabLabel>Governance</PanelTabLabel>);
    const btn = screen.getByRole('tab');
    expect(btn).toHaveStyle({ letterSpacing: '0.06em' });
  });

  it('inactive state uses --text-secondary color', () => {
    render(<PanelTabLabel active={false}>Properties</PanelTabLabel>);
    const btn = screen.getByRole('tab');
    expect(btn).toHaveStyle({ color: 'var(--text-secondary)' });
  });

  it('active state uses --text-primary color', () => {
    render(<PanelTabLabel active>Governance</PanelTabLabel>);
    const btn = screen.getByRole('tab');
    expect(btn).toHaveStyle({ color: 'var(--text-primary)' });
  });

  it('active state has border-bottom (underline indicator)', () => {
    render(<PanelTabLabel active>Tab</PanelTabLabel>);
    const btn = screen.getByRole('tab');
    // Active: '2px solid var(--text-accent)'
    const style = (btn as HTMLElement).style.borderBottom;
    expect(style).toContain('var(--text-accent)');
  });

  it('inactive state has transparent border-bottom (no underline)', () => {
    render(<PanelTabLabel active={false}>Tab</PanelTabLabel>);
    const btn = screen.getByRole('tab');
    const style = (btn as HTMLElement).style.borderBottom;
    expect(style).toContain('transparent');
  });

  it('carries role="tab" attribute', () => {
    render(<PanelTabLabel>Tab</PanelTabLabel>);
    expect(screen.getByRole('tab')).toBeInTheDocument();
  });

  it('carries aria-selected="true" when active', () => {
    render(<PanelTabLabel active>Tab</PanelTabLabel>);
    expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'true');
  });

  it('carries aria-selected="false" when inactive', () => {
    render(<PanelTabLabel active={false}>Tab</PanelTabLabel>);
    expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onClick handler when clicked', () => {
    const handler = vi.fn();
    render(<PanelTabLabel onClick={handler}>Tab</PanelTabLabel>);
    fireEvent.click(screen.getByRole('tab'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('carries data-schema-role="primary-content"', () => {
    render(<PanelTabLabel>Tab</PanelTabLabel>);
    expect(screen.getByRole('tab')).toHaveAttribute('data-schema-role', 'primary-content');
  });

  it('A11y: is focusable (button element)', () => {
    render(<PanelTabLabel>Tab</PanelTabLabel>);
    const btn = screen.getByRole('tab');
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });
});
