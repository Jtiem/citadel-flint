/**
 * ExportModal.mint4b.test.tsx
 *
 * MINT.4b: Pre-export token emission check row.
 * Tests the pendingTokenCount prop and its three status states.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ExportModal } from '../ExportModal';
beforeEach(() => {
  ;
  (window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});
describe('MINT.4b — token emission row', () => {
  it('shows "Not configured" with gray dot when pendingTokenCount is undefined', async () => {
    render(<ExportModal onClose={() => undefined} />);
    await waitFor(() => {
      const row = screen.getByTestId('token-emission-row');
      expect(row.textContent).toContain('Not configured');
      expect(screen.getByTestId('token-emission-dot-gray')).toBeDefined();
    });
  });
  it('shows "Up to date" with green dot when pendingTokenCount is 0', async () => {
    render(<ExportModal onClose={() => undefined} pendingTokenCount={0} />);
    await waitFor(() => {
      const row = screen.getByTestId('token-emission-row');
      expect(row.textContent).toContain('Up to date');
      expect(screen.getByTestId('token-emission-dot-green')).toBeDefined();
    });
  });
  it('shows "Pending changes" with amber dot when pendingTokenCount > 0', async () => {
    render(<ExportModal onClose={() => undefined} pendingTokenCount={3} />);
    await waitFor(() => {
      const row = screen.getByTestId('token-emission-row');
      expect(row.textContent).toContain('Pending changes');
      expect(screen.getByTestId('token-emission-dot-amber')).toBeDefined();
    });
  });
  it('shows count in the pending label (singular)', async () => {
    render(<ExportModal onClose={() => undefined} pendingTokenCount={1} />);
    await waitFor(() => {
      expect(screen.getByTestId('token-emission-pending-count').textContent).toContain('1 token change pending approval');
    });
  });
  it('shows count in the pending label (plural)', async () => {
    render(<ExportModal onClose={() => undefined} pendingTokenCount={5} />);
    await waitFor(() => {
      expect(screen.getByTestId('token-emission-pending-count').textContent).toContain('5 token changes pending approval');
    });
  });
  it('does not show pending count element when tokens are up to date', async () => {
    render(<ExportModal onClose={() => undefined} pendingTokenCount={0} />);
    await waitFor(() => {
      expect(screen.queryByTestId('token-emission-pending-count')).toBeNull();
    });
  });
});