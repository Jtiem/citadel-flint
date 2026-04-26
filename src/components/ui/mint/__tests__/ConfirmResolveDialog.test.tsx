/**
 * ConfirmResolveDialog.test.tsx — src/components/ui/mint/__tests__/ConfirmResolveDialog.test.tsx
 *
 * MINT.5 Phase 2 — Sync Action Surfaces (Group A)
 *
 * Covers:
 *   - isOpen=false renders nothing
 *   - role="dialog" + aria-modal="true" + radiogroup
 *   - Default strategy is "prefer-figma"
 *   - Both radio options are rendered and selectable
 *   - onConfirm fires with the currently-selected strategy
 *   - onCancel fires on Cancel click and Escape key
 *   - Radio selection reflects user input
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ConfirmResolveDialog } from '../ConfirmResolveDialog';
import type { ConfirmResolveDialogProps } from '../../../../../.flint-context/contracts/MINT.5-phase2.contract';
function makeProps(overrides: Partial<ConfirmResolveDialogProps> = {}): ConfirmResolveDialogProps {
  return {
    isOpen: true,
    conflictCount: 3,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  };
}
describe('ConfirmResolveDialog', () => {
  it('renders nothing when isOpen=false', () => {
    const {
      container
    } = render(<ConfirmResolveDialog {...makeProps({
      isOpen: false
    })} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders role=dialog with aria-modal="true" and a radiogroup', () => {
    render(<ConfirmResolveDialog {...makeProps()} />);
    const dialog = screen.getByTestId('confirm-resolve-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const group = screen.getByTestId('confirm-resolve-strategy-group');
    expect(group.getAttribute('role')).toBe('radiogroup');
  });
  it('renders both strategy options', () => {
    render(<ConfirmResolveDialog {...makeProps()} />);
    expect(screen.getByTestId('confirm-resolve-strategy-figma')).toBeDefined();
    expect(screen.getByTestId('confirm-resolve-strategy-local')).toBeDefined();
  });
  it('defaults the selection to "prefer-figma"', () => {
    render(<ConfirmResolveDialog {...makeProps()} />);
    const figmaRadio = screen.getByTestId('confirm-resolve-strategy-figma') as HTMLInputElement;
    const localRadio = screen.getByTestId('confirm-resolve-strategy-local') as HTMLInputElement;
    expect(figmaRadio.checked).toBe(true);
    expect(localRadio.checked).toBe(false);
  });
  it('onConfirm is called with "prefer-figma" when default selection is confirmed', () => {
    const onConfirm = vi.fn();
    render(<ConfirmResolveDialog {...makeProps({
      onConfirm
    })} />);
    fireEvent.click(screen.getByTestId('confirm-resolve-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('prefer-figma');
  });
  it('onConfirm is called with "prefer-local" after user selects the local radio', () => {
    const onConfirm = vi.fn();
    render(<ConfirmResolveDialog {...makeProps({
      onConfirm
    })} />);
    fireEvent.click(screen.getByTestId('confirm-resolve-strategy-local'));
    fireEvent.click(screen.getByTestId('confirm-resolve-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('prefer-local');
  });
  it('fires onCancel on Cancel button click', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmResolveDialog {...makeProps({
      onConfirm,
      onCancel
    })} />);
    fireEvent.click(screen.getByTestId('confirm-resolve-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('fires onCancel on Escape key', () => {
    const onCancel = vi.fn();
    render(<ConfirmResolveDialog {...makeProps({
      onCancel
    })} />);
    act(() => {
      fireEvent.keyDown(document, {
        key: 'Escape'
      });
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it('renders the conflict count in the heading with correct pluralization', () => {
    const {
      rerender
    } = render(<ConfirmResolveDialog {...makeProps({
      conflictCount: 1
    })} />);
    expect(screen.getByText(/Resolve 1 conflict\?/i)).toBeDefined();
    rerender(<ConfirmResolveDialog {...makeProps({
      conflictCount: 4
    })} />);
    expect(screen.getByText(/Resolve 4 conflicts\?/i)).toBeDefined();
  });

  // ── FIX-8 (UX WARN-5): dynamic Confirm button label ───────────────────────

  it('renders "Use Figma values" on the Confirm button when prefer-figma is selected', () => {
    render(<ConfirmResolveDialog {...makeProps()} />);
    const confirm = screen.getByTestId('confirm-resolve-confirm');
    expect(confirm.textContent).toMatch(/Use Figma values/i);
  });
  it('renders "Keep local values" on the Confirm button when prefer-local is selected', () => {
    render(<ConfirmResolveDialog {...makeProps()} />);
    fireEvent.click(screen.getByTestId('confirm-resolve-strategy-local'));
    const confirm = screen.getByTestId('confirm-resolve-confirm');
    expect(confirm.textContent).toMatch(/Keep local values/i);
  });
});