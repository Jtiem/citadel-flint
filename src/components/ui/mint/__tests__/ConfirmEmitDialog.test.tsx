/**
 * ConfirmEmitDialog.test.tsx — src/components/ui/mint/__tests__/ConfirmEmitDialog.test.tsx
 *
 * MINT.5 Phase 3 — Confirm dialog for destructive emit (write-to-disk)
 *
 * Covers contract testBoundaries:
 *   - 'ConfirmEmitDialog content'      — renders outputDir + platforms in body
 *   - 'ConfirmEmitDialog focus trap'   — Tab cycles stay within dialog
 *   - 'ConfirmEmitDialog cancel (Escape)' — Escape fires onCancel, not onConfirm
 *
 * Mirrors the FocusTrap + role=dialog + aria-modal pattern from ConfirmPushDialog.test.tsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfirmEmitDialog } from '../ConfirmEmitDialog';
import type { ConfirmEmitDialogProps } from '../../../../../.flint-context/contracts/MINT.5-phase3.contract';
function makeProps(overrides: Partial<ConfirmEmitDialogProps> = {}): ConfirmEmitDialogProps {
  return {
    isOpen: true,
    platforms: ['tailwind'],
    outputDir: '/proj/.flint/platform-tokens',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  };
}

// ── Dialog rendering when closed ─────────────────────────────────────────────

describe('ConfirmEmitDialog — isOpen=false', () => {
  it('renders nothing when isOpen=false', () => {
    const {
      container
    } = render(<ConfirmEmitDialog {...makeProps({
      isOpen: false
    })} />);
    expect(container.firstChild).toBeNull();
  });
});

// ── Dialog structure ──────────────────────────────────────────────────────────

describe('ConfirmEmitDialog — dialog structure', () => {
  it('renders role="dialog" with aria-modal="true"', () => {
    render(<ConfirmEmitDialog {...makeProps()} />);
    const dialog = screen.getByTestId('confirm-emit-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
});

// ── ConfirmEmitDialog content ─────────────────────────────────────────────────
// boundary: ConfirmEmitDialog content

describe('ConfirmEmitDialog — content', () => {
  it('renders platform name and resolved outputDir in the dialog body', () => {
    // boundary: ConfirmEmitDialog content
    render(<ConfirmEmitDialog {...makeProps({
      platforms: ['tailwind'],
      outputDir: '/proj/.flint/platform-tokens'
    })} />);
    // Platform name must be visible
    expect(screen.getByText(/tailwind/i)).toBeTruthy();
    // outputDir must be visible
    expect(screen.getByText(/\.flint\/platform-tokens/i)).toBeTruthy();
  });
  it('lists multiple platforms joined with comma when platforms has multiple entries', () => {
    // boundary: ConfirmEmitDialog content (edge: multi-platform list)
    render(<ConfirmEmitDialog {...makeProps({
      platforms: ['tailwind', 'css'],
      outputDir: '/proj/.flint/platform-tokens'
    })} />);
    // Both platform names should appear
    expect(screen.getByText(/tailwind/i)).toBeTruthy();
    expect(screen.getByText(/css/i)).toBeTruthy();
  });
  it('shows the full outputDir path before the user confirms', () => {
    render(<ConfirmEmitDialog {...makeProps({
      outputDir: '/project/tokens/build'
    })} />);
    expect(screen.getByText(/\/project\/tokens\/build/i)).toBeTruthy();
  });
});

// ── ConfirmEmitDialog cancel (Escape) ─────────────────────────────────────────
// boundary: ConfirmEmitDialog cancel (Escape)

describe('ConfirmEmitDialog — cancel via Escape', () => {
  it('fires onCancel exactly once when Escape is pressed', () => {
    // boundary: ConfirmEmitDialog cancel (Escape)
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmEmitDialog {...makeProps({
      onCancel,
      onConfirm
    })} />);
    act(() => {
      fireEvent.keyDown(document, {
        key: 'Escape'
      });
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('fires onCancel when the Cancel button is clicked', () => {
    // boundary: ConfirmEmitDialog cancel (Escape) — edge: Cancel button click
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmEmitDialog {...makeProps({
      onCancel,
      onConfirm
    })} />);
    fireEvent.click(screen.getByTestId('confirm-emit-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('fires onConfirm exactly once when Confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmEmitDialog {...makeProps({
      onConfirm,
      onCancel
    })} />);
    fireEvent.click(screen.getByTestId('confirm-emit-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
  it('does NOT fire onConfirm a second time if the button is clicked rapidly (double-click guard)', () => {
    // boundary: ConfirmEmitDialog cancel (Escape) — double-click gated
    const onConfirm = vi.fn();
    render(<ConfirmEmitDialog {...makeProps({
      onConfirm
    })} />);
    const confirmBtn = screen.getByTestId('confirm-emit-confirm');
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    // Implementation should gate the second click.
    // The button may be disabled after first click, so onConfirm fires once max.
    expect(onConfirm.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

// ── ConfirmEmitDialog focus trap ──────────────────────────────────────────────
// boundary: ConfirmEmitDialog focus trap

describe('ConfirmEmitDialog — focus trap', () => {
  it('keeps focus within the dialog while open on Tab cycle', async () => {
    // boundary: ConfirmEmitDialog focus trap
    render(<ConfirmEmitDialog {...makeProps()} />);

    // Allow FocusTrap initial focus microtask to settle
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    const dialog = screen.getByTestId('confirm-emit-dialog');

    // Simulate Tab cycling — focus should remain inside the dialog
    fireEvent.keyDown(document, {
      key: 'Tab'
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, {
      key: 'Tab'
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
  it('initial focus lands on an element inside the dialog', async () => {
    render(<ConfirmEmitDialog {...makeProps()} />);
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    const dialog = screen.getByTestId('confirm-emit-dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});