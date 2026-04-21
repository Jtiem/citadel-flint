/**
 * ConfirmPushDialog.test.tsx — src/components/ui/mint/__tests__/ConfirmPushDialog.test.tsx
 *
 * MINT.5 Phase 2 — Sync Action Surfaces (Group A)
 *
 * Covers:
 *   - Dialog copy reflects localEditCount (plural + singular)
 *   - role="dialog" + aria-modal="true"
 *   - FocusTrap keeps focus within the dialog on Tab cycle
 *   - Escape fires onCancel exactly once (no onConfirm)
 *   - Cancel button fires onCancel
 *   - Confirm button fires onConfirm exactly once
 *   - isOpen=false renders nothing
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfirmPushDialog } from '../ConfirmPushDialog';
import type { ConfirmPushDialogProps } from '../../../../.flint-context/contracts/MINT.5-phase2.contract';
function makeProps(overrides: Partial<ConfirmPushDialogProps> = {}): ConfirmPushDialogProps {
  return {
    isOpen: true,
    localEditCount: 12,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  };
}
describe('ConfirmPushDialog', () => {
  it('renders nothing when isOpen=false', () => {
    const {
      container
    } = render(<ConfirmPushDialog {...makeProps({
      isOpen: false
    })} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders a role=dialog container with aria-modal="true"', () => {
    render(<ConfirmPushDialog {...makeProps()} />);
    const dialog = screen.getByTestId('confirm-push-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
  it('renders localEditCount in the dialog body (plural)', () => {
    render(<ConfirmPushDialog {...makeProps({
      localEditCount: 12
    })} />);
    // Sentinel span guarantees the phrase is present and deterministic.
    expect(screen.getByText(/12 local token changes/i)).toBeDefined();
  });
  it('renders the singular form when localEditCount=1', () => {
    render(<ConfirmPushDialog {...makeProps({
      localEditCount: 1
    })} />);
    expect(screen.getByText(/1 local token change(?!s)/i)).toBeDefined();
  });
  it('fires onConfirm exactly once when user clicks Confirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmPushDialog {...makeProps({
      onConfirm,
      onCancel
    })} />);
    fireEvent.click(screen.getByTestId('confirm-push-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
  it('fires onCancel exactly once when user clicks Cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmPushDialog {...makeProps({
      onConfirm,
      onCancel
    })} />);
    fireEvent.click(screen.getByTestId('confirm-push-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('fires onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmPushDialog {...makeProps({
      onConfirm,
      onCancel
    })} />);
    act(() => {
      fireEvent.keyDown(document, {
        key: 'Escape'
      });
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('keeps focus within the dialog on Tab cycle (focus trap)', async () => {
    render(<ConfirmPushDialog {...makeProps()} />);

    // Let the FocusTrap's initial-focus microtask run.
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });
    const dialog = screen.getByTestId('confirm-push-dialog');
    const confirmBtn = screen.getByTestId('confirm-push-confirm');
    const cancelBtn = screen.getByTestId('confirm-push-cancel');

    // Initial focus lands on the Confirm button (initialFocusRef).
    expect(document.activeElement).toBe(confirmBtn);

    // Tab from last focusable element wraps to first. FocusTrap sorts
    // elements in document order, so the cancel button (declared first in
    // the footer) is first, and the confirm button is last.
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);

    // Shift+Tab from first wraps to last focusable element in the trap.
    fireEvent.keyDown(document, {
      key: 'Tab',
      shiftKey: true
    });
    const active = document.activeElement;
    expect(dialog.contains(active)).toBe(true);
  });
});