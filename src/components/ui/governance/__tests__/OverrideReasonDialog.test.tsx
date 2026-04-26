/**
 * OverrideReasonDialog.test.tsx — CHRON.1-repair M3 tests
 *
 * Covers:
 *   - Red tier: submit disabled < 10 chars, enabled >= 10, fires with reason
 *   - Amber tier: both buttons present, "without reason" fires undefined,
 *     "with reason" fires the trimmed reason
 *   - Escape closes (fires onClose)
 *   - 2000-char hard cap enforced
 *   - Accessibility: textarea has a label, submit button has descriptive text
 *   - severityToTier mapping
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OverrideReasonDialog, severityToTier } from '../OverrideReasonDialog';
import type { OverrideReasonDialogProps } from '../OverrideReasonDialog';

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultProps(overrides: Partial<OverrideReasonDialogProps> = {}): OverrideReasonDialogProps {
  return {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ruleId: 'A11Y-031',
    ruleTitle: 'Color contrast below 4.5:1',
    severity: 'critical',
    filePath: '/src/App.tsx',
    ...overrides
  };
}

/** Locate the textarea by the dedicated data-testid. */
function getTextarea(): HTMLTextAreaElement {
  return screen.getByTestId('override-reason-textarea') as HTMLTextAreaElement;
}

// ── Tier mapping ──────────────────────────────────────────────────────────────

describe('severityToTier', () => {
  it("maps 'critical' to red", () => {
    expect(severityToTier('critical')).toBe('red');
  });
  it("maps 'red' to red", () => {
    expect(severityToTier('red')).toBe('red');
  });
  it.each(['warn', 'info', 'amber', 'advisory'] as const)("maps '%s' to amber", sev => {
    expect(severityToTier(sev)).toBe('amber');
  });
});

// ── Red tier ──────────────────────────────────────────────────────────────────

describe('OverrideReasonDialog — Red tier (critical / red)', () => {
  it('renders "Required" chip when severity is critical', () => {
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'critical'
    })} />);
    expect(screen.getByTestId('override-tier-chip').textContent).toContain('Required');
  });
  it('renders "Required" chip when severity is red', () => {
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'red'
    })} />);
    expect(screen.getByTestId('override-tier-chip').textContent).toContain('Required');
  });
  it('disables submit when reason is empty', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    const btn = screen.getByTestId('override-submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
  it('still disables submit when reason is 9 characters', () => {
    const onConfirm = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      onConfirm
    })} />);
    fireEvent.change(getTextarea(), {
      target: {
        value: '123456789'
      }
    });
    const btn = screen.getByTestId('override-submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
  it('still disables submit when reason is 10 characters of whitespace', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    fireEvent.change(getTextarea(), {
      target: {
        value: '          '
      }
    });
    const btn = screen.getByTestId('override-submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
  it('enables submit at 10 characters of non-whitespace', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    fireEvent.change(getTextarea(), {
      target: {
        value: '1234567890'
      }
    });
    const btn = screen.getByTestId('override-submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
  it('calls onConfirm with the trimmed reason when submit is clicked', () => {
    const onConfirm = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      onConfirm
    })} />);
    fireEvent.change(getTextarea(), {
      target: {
        value: '  Waived per Legal memo  '
      }
    });
    const btn = screen.getByTestId('override-submit-btn');
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Waived per Legal memo');
  });
  it('does NOT render "Override without reason" button on Red tier', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    expect(screen.queryByTestId('override-without-reason-btn')).toBeNull();
  });
  it('submit button carries descriptive accessible name', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    const btn = screen.getByTestId('override-submit-btn');
    const label = btn.getAttribute('aria-label') ?? btn.textContent ?? '';
    expect(label.toLowerCase()).toContain('override');
  });
});

// ── Amber tier ────────────────────────────────────────────────────────────────

describe('OverrideReasonDialog — Amber tier (warn / info / amber / advisory)', () => {
  it('renders "Recommended" chip', () => {
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'warn'
    })} />);
    expect(screen.getByTestId('override-tier-chip').textContent).toContain('Recommended');
  });
  it('renders both primary and secondary buttons', () => {
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'warn'
    })} />);
    expect(screen.getByTestId('override-with-reason-btn')).toBeDefined();
    expect(screen.getByTestId('override-without-reason-btn')).toBeDefined();
  });
  it('"Override without reason" calls onConfirm with undefined', () => {
    const onConfirm = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'warn',
      onConfirm
    })} />);
    fireEvent.click(screen.getByTestId('override-without-reason-btn'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });
  it('"Override with reason" is disabled when reason is empty', () => {
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'warn'
    })} />);
    const btn = screen.getByTestId('override-with-reason-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
  it('"Override with reason" enables when any non-whitespace text is typed', () => {
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'warn'
    })} />);
    fireEvent.change(getTextarea(), {
      target: {
        value: 'ok'
      }
    });
    const btn = screen.getByTestId('override-with-reason-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
  it('"Override with reason" fires onConfirm with the trimmed text', () => {
    const onConfirm = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'warn',
      onConfirm
    })} />);
    fireEvent.change(getTextarea(), {
      target: {
        value: '  Acknowledged  '
      }
    });
    fireEvent.click(screen.getByTestId('override-with-reason-btn'));
    expect(onConfirm).toHaveBeenCalledWith('Acknowledged');
  });
  it('does NOT render the Red-tier submit button on Amber', () => {
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'warn'
    })} />);
    expect(screen.queryByTestId('override-submit-btn')).toBeNull();
  });
});

// ── Escape / close ────────────────────────────────────────────────────────────

describe('OverrideReasonDialog — close behavior', () => {
  it('Escape key fires onClose', () => {
    const onClose = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      onClose
    })} />);
    // MUI Dialog handles Escape on the role="dialog" element (the paper).
    // Dispatch to the textarea — it's focused and is a descendant of the
    // dialog, so the keydown bubbles into MUI's handler.
    const textarea = screen.getByTestId('override-reason-textarea');
    fireEvent.keyDown(textarea, {
      key: 'Escape',
      code: 'Escape'
    });
    expect(onClose).toHaveBeenCalled();
  });
  it('Cancel button fires onClose', () => {
    const onClose = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      onClose
    })} />);
    fireEvent.click(screen.getByTestId('override-cancel-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('renders nothing when open is false', () => {
    render(<OverrideReasonDialog {...defaultProps({
      open: false
    })} />);
    expect(screen.queryByTestId('override-reason-dialog')).toBeNull();
  });
});

// ── Character cap ─────────────────────────────────────────────────────────────

describe('OverrideReasonDialog — 2000 character hard cap', () => {
  it('truncates input to 2000 characters when more is pasted', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    const longInput = 'a'.repeat(2001);
    fireEvent.change(getTextarea(), {
      target: {
        value: longInput
      }
    });
    const textarea = getTextarea();
    expect(textarea.value.length).toBe(2000);
  });
  it('accepts exactly 2000 characters', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    const exactInput = 'a'.repeat(2000);
    fireEvent.change(getTextarea(), {
      target: {
        value: exactInput
      }
    });
    const textarea = getTextarea();
    expect(textarea.value.length).toBe(2000);
  });
  it('shows character count helper when reason is non-empty', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    fireEvent.change(getTextarea(), {
      target: {
        value: 'hello'
      }
    });
    expect(screen.getByText('5 / 2000')).toBeDefined();
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────────

describe('OverrideReasonDialog — accessibility', () => {
  it('textarea has an accessible label', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    const textarea = getTextarea();
    // MUI TextField connects a <label> via htmlFor; we also set aria-label.
    const ariaLabel = textarea.getAttribute('aria-label');
    expect(ariaLabel).toBe('Override reason');
  });
  it('dialog title is announced via aria-labelledby', () => {
    render(<OverrideReasonDialog {...defaultProps()} />);
    const title = document.getElementById('override-reason-dialog-title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('Color contrast below 4.5:1');
    expect(title?.textContent).toContain('A11Y-031');
  });
  it('renders the file path as context when provided', () => {
    render(<OverrideReasonDialog {...defaultProps({
      filePath: '/src/components/Button.tsx'
    })} />);
    expect(screen.getByTestId('override-file-path').textContent).toBe('/src/components/Button.tsx');
  });
  it('does not render file path row when filePath is undefined', () => {
    render(<OverrideReasonDialog {...defaultProps({
      filePath: undefined
    })} />);
    expect(screen.queryByTestId('override-file-path')).toBeNull();
  });
});

// ── Keyboard submit (Cmd/Ctrl+Enter) ──────────────────────────────────────────

describe('OverrideReasonDialog — keyboard submit', () => {
  it('Cmd+Enter submits on Red tier when reason is sufficient', () => {
    const onConfirm = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      onConfirm
    })} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, {
      target: {
        value: 'Sufficient reason here'
      }
    });
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      metaKey: true
    });
    expect(onConfirm).toHaveBeenCalledWith('Sufficient reason here');
  });
  it('Cmd+Enter does NOT submit on Red tier when reason is too short', () => {
    const onConfirm = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      onConfirm
    })} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, {
      target: {
        value: 'short'
      }
    });
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      metaKey: true
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('Ctrl+Enter submits on Amber tier with any non-empty reason', () => {
    const onConfirm = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      severity: 'warn',
      onConfirm
    })} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, {
      target: {
        value: 'ok'
      }
    });
    fireEvent.keyDown(textarea, {
      key: 'Enter',
      ctrlKey: true
    });
    expect(onConfirm).toHaveBeenCalledWith('ok');
  });
  it('plain Enter does NOT submit (allows multi-line input)', () => {
    const onConfirm = vi.fn();
    render(<OverrideReasonDialog {...defaultProps({
      onConfirm
    })} />);
    const textarea = getTextarea();
    fireEvent.change(textarea, {
      target: {
        value: 'Sufficient reason here'
      }
    });
    fireEvent.keyDown(textarea, {
      key: 'Enter'
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ── Reset on open ─────────────────────────────────────────────────────────────

describe('OverrideReasonDialog — state reset', () => {
  it('clears reason when the dialog is reopened', () => {
    const {
      rerender
    } = render(<OverrideReasonDialog {...defaultProps()} />);
    fireEvent.change(getTextarea(), {
      target: {
        value: 'first attempt'
      }
    });
    expect(getTextarea().value).toBe('first attempt');
    // Close
    act(() => {
      rerender(<OverrideReasonDialog {...defaultProps({
        open: false
      })} />);
    });
    // Reopen
    act(() => {
      rerender(<OverrideReasonDialog {...defaultProps({
        open: true
      })} />);
    });
    expect(getTextarea().value).toBe('');
  });
});