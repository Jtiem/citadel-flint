/**
 * MetadataTooltip.test.tsx — GLASSTYPO.1 Group B
 *
 * Contract testBoundaries covered:
 *  - Tooltip hidden by default (not in DOM)
 *  - Hover trigger (mouseenter on wrapper span) shows tooltip with role="tooltip"
 *  - Mouseleave hides tooltip
 *  - Focus on wrapper span shows tooltip
 *  - Blur on wrapper span hides tooltip
 *  - Tooltip text uses --text-tertiary and --text-label tokens
 *  - data-schema-role="metadata" on container span
 *  - Trigger button is keyboard-focusable (tabIndex=0)
 *  - ReactNode content renders inside tooltip
 */

import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Info } from 'lucide-react';
import MetadataTooltip from '../MetadataTooltip';

/** Helper: get the outermost span (data-schema-role="metadata") */
function getWrapper(container: HTMLElement) {
  return container.querySelector('[data-schema-role="metadata"]') as HTMLElement;
}

describe('MetadataTooltip primitive', () => {
  it('does not show tooltip content by default', () => {
    render(
      <MetadataTooltip content="Tracking starts after first audit">
        <Info size={12} />
      </MetadataTooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip with role="tooltip" on mouseenter of wrapper', () => {
    const { container } = render(
      <MetadataTooltip content="hello">
        <Info size={12} />
      </MetadataTooltip>,
    );
    const wrapper = getWrapper(container);
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('hello');
  });

  it('hides tooltip on mouseleave of wrapper', () => {
    const { container } = render(
      <MetadataTooltip content="hello">
        <Info size={12} />
      </MetadataTooltip>,
    );
    const wrapper = getWrapper(container);
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus of wrapper', () => {
    const { container } = render(
      <MetadataTooltip content="focus reveal">
        <Info size={12} />
      </MetadataTooltip>,
    );
    const wrapper = getWrapper(container);
    fireEvent.focus(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('hides tooltip on blur of wrapper', () => {
    const { container } = render(
      <MetadataTooltip content="blur hide">
        <Info size={12} />
      </MetadataTooltip>,
    );
    const wrapper = getWrapper(container);
    fireEvent.focus(wrapper);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.blur(wrapper);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('tooltip text uses --text-tertiary color', () => {
    const { container } = render(
      <MetadataTooltip content="Color check">
        <Info size={12} />
      </MetadataTooltip>,
    );
    const wrapper = getWrapper(container);
    fireEvent.mouseEnter(wrapper);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveStyle({ color: 'var(--text-tertiary)' });
  });

  it('tooltip text uses --text-label font-size', () => {
    const { container } = render(
      <MetadataTooltip content="Size check">
        <Info size={12} />
      </MetadataTooltip>,
    );
    const wrapper = getWrapper(container);
    fireEvent.mouseEnter(wrapper);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveStyle({ fontSize: 'var(--text-label)' });
  });

  it('carries data-schema-role="metadata" on container', () => {
    const { container } = render(
      <MetadataTooltip content="meta">
        <Info size={12} />
      </MetadataTooltip>,
    );
    const wrapper = getWrapper(container);
    expect(wrapper).toHaveAttribute('data-schema-role', 'metadata');
  });

  it('renders ReactNode as tooltip content', () => {
    const { container } = render(
      <MetadataTooltip content={<strong data-testid="rich">Rich content</strong>}>
        <Info size={12} />
      </MetadataTooltip>,
    );
    const wrapper = getWrapper(container);
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByTestId('rich')).toBeInTheDocument();
  });

  it('trigger button is keyboard-focusable (tabIndex=0)', () => {
    render(
      <MetadataTooltip content="tab test">
        <Info size={12} />
      </MetadataTooltip>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('tabindex', '0');
  });
});
