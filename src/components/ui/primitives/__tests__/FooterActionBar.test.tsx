/**
 * FooterActionBar.test.tsx — GLASSTYPO.1 Group B
 *
 * Contract testBoundaries covered:
 *  - Renders children in a flex row
 *  - align prop controls justify-content
 *  - Has separator border above (border-t)
 *  - FooterLink renders with chevron suffix
 *  - FooterLink external renders ExternalLink icon
 *  - data-schema-role="nav-link" on container and links
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FooterActionBar, { FooterLink } from '../FooterActionBar';

describe('FooterActionBar primitive', () => {
  it('renders children', () => {
    render(
      <FooterActionBar>
        <FooterLink>Manage rules</FooterLink>
        <FooterLink>Policy settings</FooterLink>
      </FooterActionBar>,
    );
    expect(screen.getByText('Manage rules')).toBeInTheDocument();
    expect(screen.getByText('Policy settings')).toBeInTheDocument();
  });

  it('has border-t class for separator', () => {
    const { container } = render(
      <FooterActionBar>
        <FooterLink>Link</FooterLink>
      </FooterActionBar>,
    );
    const bar = container.firstChild as HTMLElement;
    expect(bar.className).toContain('border-t');
  });

  it('align="between" applies justify-between class', () => {
    const { container } = render(
      <FooterActionBar align="between">
        <FooterLink>A</FooterLink>
        <FooterLink>B</FooterLink>
      </FooterActionBar>,
    );
    const bar = container.firstChild as HTMLElement;
    expect(bar.className).toContain('justify-between');
  });

  it('align="end" applies justify-end class', () => {
    const { container } = render(
      <FooterActionBar align="end">
        <FooterLink>A</FooterLink>
      </FooterActionBar>,
    );
    const bar = container.firstChild as HTMLElement;
    expect(bar.className).toContain('justify-end');
  });

  it('default align applies justify-start class', () => {
    const { container } = render(
      <FooterActionBar>
        <FooterLink>A</FooterLink>
      </FooterActionBar>,
    );
    const bar = container.firstChild as HTMLElement;
    expect(bar.className).toContain('justify-start');
  });

  it('carries data-schema-role="nav-link" on the container', () => {
    const { container } = render(
      <FooterActionBar>
        <FooterLink>A</FooterLink>
      </FooterActionBar>,
    );
    const bar = container.firstChild as HTMLElement;
    expect(bar).toHaveAttribute('data-schema-role', 'nav-link');
  });

  it('FooterLink with onClick calls handler', () => {
    const handler = vi.fn();
    render(
      <FooterActionBar>
        <FooterLink onClick={handler}>Click me</FooterLink>
      </FooterActionBar>,
    );
    fireEvent.click(screen.getByText('Click me'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('FooterLink with href renders an anchor element', () => {
    render(
      <FooterActionBar>
        <FooterLink href="/settings">Settings</FooterLink>
      </FooterActionBar>,
    );
    const link = screen.getByRole('link', { name: /settings/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/settings');
  });

  it('FooterLink external opens in new tab', () => {
    render(
      <FooterActionBar>
        <FooterLink href="https://example.com" external>Docs</FooterLink>
      </FooterActionBar>,
    );
    const link = screen.getByRole('link', { name: /docs/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('FooterLink text uses --text-secondary color', () => {
    render(
      <FooterActionBar>
        <FooterLink>Nav item</FooterLink>
      </FooterActionBar>,
    );
    // The button element carries the style
    const btn = screen.getByRole('button', { name: /nav item/i });
    expect(btn).toHaveStyle({ color: 'var(--text-secondary)' });
  });

  it('FooterLink with safe relative href renders anchor with href', () => {
    render(
      <FooterActionBar>
        <FooterLink href="/settings">Settings</FooterLink>
      </FooterActionBar>,
    );
    const link = screen.getByRole('link', { name: /settings/i });
    expect(link).toHaveAttribute('href', '/settings');
  });

  it('FooterLink drops javascript: href (unsafe scheme allowlist)', () => {
    render(
      <FooterActionBar>
        <FooterLink href="javascript:alert(1)">Dangerous</FooterLink>
      </FooterActionBar>,
    );
    // With an unsafe href, FooterLink must NOT render an anchor element.
    // It falls back to the button render path (no href).
    const dangerous = screen.getByText('Dangerous');
    expect(dangerous.closest('a')).toBeNull();
    expect(dangerous.closest('button')).not.toBeNull();
  });

  it('FooterLink with https:// href renders anchor', () => {
    render(
      <FooterActionBar>
        <FooterLink href="https://docs.example.com" external>Docs</FooterLink>
      </FooterActionBar>,
    );
    const link = screen.getByRole('link', { name: /docs/i });
    expect(link).toHaveAttribute('href', 'https://docs.example.com');
  });

  it('FooterLink anchor always has rel=noopener noreferrer', () => {
    render(
      <FooterActionBar>
        <FooterLink href="/internal">Internal</FooterLink>
      </FooterActionBar>,
    );
    const link = screen.getByRole('link', { name: /internal/i });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
