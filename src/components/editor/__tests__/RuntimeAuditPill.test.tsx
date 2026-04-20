/**
 * RuntimeAuditPill.test.tsx — Contract-derived tests for the RUNTIME.1 pill.
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 * Contract test boundaries covered here:
 *   - `RuntimeAuditPill idle`
 *   - `RuntimeAuditPill running`
 *   - `RuntimeAuditPill violations`
 *   - `RuntimeAuditPill keyboard`
 *
 * This file is PURE presentational tests — it does not exercise the hook
 * or the StatusBar double-gating. Those live in RuntimeAuditGate.test.tsx
 * and useRuntimeAudit.test.ts respectively.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RuntimeAuditPill } from '../RuntimeAuditPill';
describe('RuntimeAuditPill', () => {
  // ── Contract boundary: RuntimeAuditPill idle ──────────────────────────
  describe('idle', () => {
    it('renders data-testid="runtime-audit-pill-idle" when status is idle', () => {
      render(<RuntimeAuditPill status="idle" findingCount={0} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill-idle')).toBeDefined();
    });
    it('visible label reads "Audit runtime" on idle', () => {
      render(<RuntimeAuditPill status="idle" findingCount={0} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill').textContent).toContain('Audit runtime');
    });
    it('click fires onClick exactly once', () => {
      const onClick = vi.fn();
      render(<RuntimeAuditPill status="idle" findingCount={0} onClick={onClick} />);
      fireEvent.click(screen.getByTestId('runtime-audit-pill'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
    it('is not aria-disabled when idle', () => {
      render(<RuntimeAuditPill status="idle" findingCount={0} onClick={vi.fn()} />);
      const pill = screen.getByTestId('runtime-audit-pill');
      expect(pill.getAttribute('aria-disabled')).toBeNull();
    });
  });

  // ── Contract boundary: RuntimeAuditPill running ───────────────────────
  describe('running', () => {
    it('renders spinner with data-testid="runtime-audit-spinner"', () => {
      render(<RuntimeAuditPill status="running" findingCount={0} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-spinner')).toBeDefined();
    });
    it('is aria-disabled while running', () => {
      render(<RuntimeAuditPill status="running" findingCount={0} onClick={vi.fn()} />);
      const pill = screen.getByTestId('runtime-audit-pill');
      expect(pill.getAttribute('aria-disabled')).toBe('true');
    });
    it('click does not fire onClick while running', () => {
      const onClick = vi.fn();
      render(<RuntimeAuditPill status="running" findingCount={0} onClick={onClick} />);
      fireEvent.click(screen.getByTestId('runtime-audit-pill'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // ── Contract boundary: RuntimeAuditPill violations ────────────────────
  describe('violations', () => {
    it('renders count "5" when findingCount=5', () => {
      render(<RuntimeAuditPill status="violations" findingCount={5} onClick={vi.fn()} />);
      expect(screen.getByText('5')).toBeDefined();
    });
    it('amber tint for count 1–9', () => {
      render(<RuntimeAuditPill status="violations" findingCount={5} onClick={vi.fn()} />);
      const pill = screen.getByTestId('runtime-audit-pill');
      // Contract edge case: amber tint for count > 0 and < 10.
      expect(pill.className).toMatch(/amber/);
    });
    it('red tint for count >= 10', () => {
      render(<RuntimeAuditPill status="violations" findingCount={12} onClick={vi.fn()} />);
      const pill = screen.getByTestId('runtime-audit-pill');
      // Contract edge case: red tint for count >= 10.
      expect(pill.className).toMatch(/red/);
    });
    it('renders state-specific testid runtime-audit-pill-violations', () => {
      render(<RuntimeAuditPill status="violations" findingCount={3} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill-violations')).toBeDefined();
    });
  });

  // ── Passed / no-preview / version-mismatch / error states ─────────────
  describe('other states', () => {
    it('passed state renders state-specific testid', () => {
      render(<RuntimeAuditPill status="passed" findingCount={0} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill-passed')).toBeDefined();
      expect(screen.getByTestId('runtime-audit-pill').textContent).toContain('Runtime clean');
    });
    it('no-preview state renders state-specific testid', () => {
      render(<RuntimeAuditPill status="no-preview" findingCount={0} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill-no-preview')).toBeDefined();
    });
    it('version-mismatch state renders with red tint', () => {
      render(<RuntimeAuditPill status="version-mismatch" findingCount={0} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill-version-mismatch')).toBeDefined();
      const pill = screen.getByTestId('runtime-audit-pill');
      expect(pill.className).toMatch(/red/);
    });
    it('error state renders with red tint', () => {
      render(<RuntimeAuditPill status="error" findingCount={0} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill-error')).toBeDefined();
      const pill = screen.getByTestId('runtime-audit-pill');
      expect(pill.className).toMatch(/red/);
    });
  });

  // ── Contract boundary: RuntimeAuditPill keyboard ──────────────────────
  describe('keyboard activation', () => {
    it('Enter key fires onClick exactly once', () => {
      const onClick = vi.fn();
      render(<RuntimeAuditPill status="idle" findingCount={0} onClick={onClick} />);
      const pill = screen.getByTestId('runtime-audit-pill');
      pill.focus();
      fireEvent.keyDown(pill, {
        key: 'Enter'
      });
      expect(onClick).toHaveBeenCalledTimes(1);
    });
    it('Space key fires onClick exactly once', () => {
      const onClick = vi.fn();
      render(<RuntimeAuditPill status="idle" findingCount={0} onClick={onClick} />);
      const pill = screen.getByTestId('runtime-audit-pill');
      pill.focus();
      fireEvent.keyDown(pill, {
        key: ' '
      });
      expect(onClick).toHaveBeenCalledTimes(1);
    });
    it('other keys do not fire onClick', () => {
      const onClick = vi.fn();
      render(<RuntimeAuditPill status="idle" findingCount={0} onClick={onClick} />);
      const pill = screen.getByTestId('runtime-audit-pill');
      pill.focus();
      fireEvent.keyDown(pill, {
        key: 'a'
      });
      fireEvent.keyDown(pill, {
        key: 'Escape'
      });
      fireEvent.keyDown(pill, {
        key: 'Tab'
      });
      expect(onClick).not.toHaveBeenCalled();
    });
    it('keyboard activation is blocked while running', () => {
      const onClick = vi.fn();
      render(<RuntimeAuditPill status="running" findingCount={0} onClick={onClick} />);
      const pill = screen.getByTestId('runtime-audit-pill');
      pill.focus();
      fireEvent.keyDown(pill, {
        key: 'Enter'
      });
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // ── ARIA contract ─────────────────────────────────────────────────────
  describe('accessibility', () => {
    it('always carries aria-label "Run runtime accessibility audit"', () => {
      render(<RuntimeAuditPill status="idle" findingCount={0} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill').getAttribute('aria-label')).toBe('Run runtime accessibility audit');
    });
    it('aria-label stays constant across state changes', () => {
      const {
        rerender
      } = render(<RuntimeAuditPill status="idle" findingCount={0} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill').getAttribute('aria-label')).toBe('Run runtime accessibility audit');
      rerender(<RuntimeAuditPill status="violations" findingCount={5} onClick={vi.fn()} />);
      expect(screen.getByTestId('runtime-audit-pill').getAttribute('aria-label')).toBe('Run runtime accessibility audit');
    });
    it('button element is used so Tab focus and native activation work', () => {
      render(<RuntimeAuditPill status="idle" findingCount={0} onClick={vi.fn()} />);
      const pill = screen.getByTestId('runtime-audit-pill');
      expect(pill.tagName).toBe('BUTTON');
    });
  });
});