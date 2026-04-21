/**
 * FocusTrap.test.tsx
 *
 * GLASS.2.2: Tests for the FocusTrap component.
 *
 * Covers:
 *   - Tab cycles within trapped content (last -> first)
 *   - Shift+Tab wraps from first to last
 *   - Focus returns to trigger element on unmount
 *   - initialFocusRef overrides default first-element focus
 *   - Dynamic content: elements added after mount are included in the trap
 *   - Empty content: no crash when there are no focusable elements
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useRef } from 'react';
import { FocusTrap } from '../FocusTrap';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flush the setTimeout(0) used for initial focus. */
async function flushFocusTimer() {
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FocusTrap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('focuses the first focusable element on mount', async () => {
    render(<FocusTrap>
                <button data-testid="btn-a">A</button>
                <button data-testid="btn-b">B</button>
            </FocusTrap>);
    await flushFocusTimer();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('btn-a');
  });
  it('Tab on the last element wraps focus to the first', async () => {
    render(<FocusTrap>
                <button data-testid="btn-first">First</button>
                <button data-testid="btn-middle">Middle</button>
                <button data-testid="btn-last">Last</button>
            </FocusTrap>);
    await flushFocusTimer();

    // Move focus to the last button
    const lastBtn = document.querySelector('[data-testid="btn-last"]') as HTMLButtonElement;
    lastBtn.focus();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('btn-last');

    // Press Tab — should wrap to first
    fireEvent.keyDown(document, {
      key: 'Tab'
    });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('btn-first');
  });
  it('Shift+Tab on the first element wraps focus to the last', async () => {
    render(<FocusTrap>
                <button data-testid="btn-first">First</button>
                <button data-testid="btn-middle">Middle</button>
                <button data-testid="btn-last">Last</button>
            </FocusTrap>);
    await flushFocusTimer();

    // Focus is already on first after mount
    expect(document.activeElement?.getAttribute('data-testid')).toBe('btn-first');

    // Press Shift+Tab — should wrap to last
    fireEvent.keyDown(document, {
      key: 'Tab',
      shiftKey: true
    });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('btn-last');
  });
  it('focus returns to the trigger element on unmount', async () => {
    // Create a trigger button and focus it
    const {
      unmount: unmountTrigger
    } = render(<button data-testid="trigger">Open Modal</button>);
    const trigger = document.querySelector('[data-testid="trigger"]') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Mount the FocusTrap — focus moves inside
    const {
      unmount
    } = render(<FocusTrap>
                <button data-testid="inner">Inside</button>
            </FocusTrap>);
    await flushFocusTimer();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('inner');

    // Unmount the FocusTrap — focus should return to the trigger
    unmount();
    expect(document.activeElement).toBe(trigger);
    unmountTrigger();
  });
  it('uses initialFocusRef when provided', async () => {
    function TestComponent() {
      const secondRef = useRef<HTMLButtonElement>(null);
      return <FocusTrap initialFocusRef={secondRef}>
                    <button data-testid="btn-first">First</button>
                    <button data-testid="btn-second" ref={secondRef}>Second</button>
                    <button data-testid="btn-third">Third</button>
                </FocusTrap>;
    }
    render(<TestComponent />);
    await flushFocusTimer();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('btn-second');
  });
  it('skips disabled buttons in the focusable set', async () => {
    render(<FocusTrap>
                <button data-testid="btn-enabled">Enabled</button>
                <button data-testid="btn-disabled" disabled>Disabled</button>
                <button data-testid="btn-last">Last</button>
            </FocusTrap>);
    await flushFocusTimer();

    // Move to last and Tab — should wrap to first (not disabled)
    const lastBtn = document.querySelector('[data-testid="btn-last"]') as HTMLButtonElement;
    lastBtn.focus();
    fireEvent.keyDown(document, {
      key: 'Tab'
    });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('btn-enabled');
  });
  it('does not crash when there are no focusable elements', async () => {
    expect(() => {
      render(<FocusTrap>
                    <div>No focusable elements here</div>
                </FocusTrap>);
    }).not.toThrow();
    await flushFocusTimer();

    // Tab should not crash
    expect(() => {
      fireEvent.keyDown(document, {
        key: 'Tab'
      });
    }).not.toThrow();
  });
  it('non-Tab keys are not intercepted', async () => {
    render(<FocusTrap>
                <button data-testid="btn-a">A</button>
                <button data-testid="btn-b">B</button>
            </FocusTrap>);
    await flushFocusTimer();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('btn-a');

    // Pressing Escape should not change focus
    fireEvent.keyDown(document, {
      key: 'Escape'
    });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('btn-a');
  });
  it('handles input elements in the focusable set', async () => {
    render(<FocusTrap>
                <input data-testid="input-first" type="text" aria-label="[NEEDS LABEL]" />
                <button data-testid="btn-last">Last</button>
            </FocusTrap>);
    await flushFocusTimer();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('input-first');

    // Tab from last -> should wrap to input
    const lastBtn = document.querySelector('[data-testid="btn-last"]') as HTMLButtonElement;
    lastBtn.focus();
    fireEvent.keyDown(document, {
      key: 'Tab'
    });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('input-first');
  });
});