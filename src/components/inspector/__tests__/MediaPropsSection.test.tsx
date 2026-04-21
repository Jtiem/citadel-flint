/**
 * MediaPropsSection tests — INSPECTOR.1 Group B + FIX 3
 *
 * Invariants under test:
 *  - Empty alt (alt="") → neutral "decorative" StatBadge (FIX 3: WCAG-H67)
 *  - Missing alt (undefined) → nothing rendered for that prop
 *  - Non-empty alt → value shown, no badge
 *  - Off-token dimension → warning badge
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MediaPropsSection from '../MediaPropsSection';
import { useTokenStore } from '../../../store/tokenStore';
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

describe('MediaPropsSection', () => {
  beforeEach(() => {
    useTokenStore.setState({
      tokens: [
        { id: 1, token_path: 'spacing.4', token_value: '16px', token_type: 'spacing', collection: 'core' },
        { id: 2, token_path: 'spacing.8', token_value: '32px', token_type: 'spacing', collection: 'core' },
      ],
      isLoading: false,
      error: null,
    });
  });

  it('renders without crashing for a minimal img layer', () => {
    const layer = makeLayer({
      tagName: 'img',
      props: { src: '/logo.png', alt: 'Logo' },
    });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByTestId('media-props-section')).toBeTruthy();
  });

  // FIX 3: empty alt="" is WCAG-H67 valid for decorative images.
  // It should render as neutral "decorative" — NOT critical.
  it('renders a neutral "decorative" badge (not critical) for empty alt on <img>', () => {
    const layer = makeLayer({
      tagName: 'img',
      props: { src: '/img.png', alt: '' },
    });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);

    // Must NOT have a critical badge (false positive would violate WCAG H67)
    const criticalBadge = document.querySelector('[data-variant="critical"]');
    expect(criticalBadge).toBeNull();

    // Should have a neutral badge with "decorative" label
    const neutralBadge = document.querySelector('[data-variant="neutral"]');
    expect(neutralBadge).not.toBeNull();
    expect(neutralBadge?.textContent).toMatch(/decorative/i);
  });

  it('renders NO critical badge when alt is a non-empty string', () => {
    const layer = makeLayer({
      tagName: 'img',
      props: { src: '/logo.png', alt: 'Logo' },
    });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);

    const criticalBadge = document.querySelector('[data-variant="critical"]');
    expect(criticalBadge).toBeNull();
  });

  it('renders nothing for the alt prop when alt attribute is absent', () => {
    // Missing alt (undefined) → no alt row at all
    const layer = makeLayer({
      tagName: 'img',
      props: { src: '/logo.png' }, // no alt key
    });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);

    // No badge of any kind for alt
    expect(document.querySelector('[data-variant="critical"]')).toBeNull();
    expect(document.querySelector('[data-variant="neutral"]')).toBeNull();
  });

  it('shows alt text value when alt is present', () => {
    const layer = makeLayer({
      tagName: 'img',
      props: { src: '/logo.png', alt: 'Flint logo' },
    });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('Flint logo')).toBeTruthy();
  });

  it('renders an off-token warning badge for an arbitrary dimension value', () => {
    const layer = makeLayer({
      tagName: 'img',
      props: { src: '/img.png', alt: 'x', width: '13px' },
    });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);
    // 13px is not 16px or 32px → off-token
    const warningBadge = document.querySelector('[data-variant="warning"]');
    expect(warningBadge).not.toBeNull();
  });

  it('renders no warning badge for a token-matching dimension (16px)', () => {
    const layer = makeLayer({
      tagName: 'img',
      props: { src: '/img.png', alt: 'x', width: '16px' },
    });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);
    const warningBadge = document.querySelector('[data-variant="warning"]');
    expect(warningBadge).toBeNull();
  });

  it('renders video-specific props (autoplay, controls) for a video layer', () => {
    const layer = makeLayer({
      tagName: 'video',
      props: { src: '/clip.mp4', autoPlay: true, controls: true },
    });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('Autoplay')).toBeTruthy();
    expect(screen.getByText('Controls')).toBeTruthy();
  });

  it('renders viewBox for a svg layer', () => {
    const layer = makeLayer({
      tagName: 'svg',
      props: { viewBox: '0 0 24 24' },
    });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('ViewBox')).toBeTruthy();
    expect(screen.getByText('0 0 24 24')).toBeTruthy();
  });

  it('renders empty state when layer has no media props', () => {
    const layer = makeLayer({ tagName: 'img' });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText(/no media props found/i)).toBeTruthy();
  });

  it('renders section title "Media Props"', () => {
    const layer = makeLayer({ tagName: 'img', props: { src: '/x.png', alt: 'x' } });
    render(<MediaPropsSection layer={layer} onCommitProp={vi.fn()} />);
    expect(screen.getByText('Media Props')).toBeTruthy();
  });
});
