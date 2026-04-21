/**
 * ExportModal.sprint2.test.tsx
 *
 * Sprint 2B: Verify that ExportModal fires an "Export check failed"
 * error toast (at most once per modal open) when the pre-flight override
 * fetch IPC call fails entirely.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ExportModal } from '../ExportModal';
import { useNotificationStore } from '../../../store/notificationStore';
import { useCanvasStore } from '../../../store/canvasStore';
import { useEditorStore } from '../../../store/editorStore';

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ExportModal — Sprint 2B toast on pre-flight failure', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      history: []
    });
    useCanvasStore.setState({
      mithrilViolations: [],
      a11yViolations: {},
      overridesExist: false,
      activeFilePath: '/test/App.tsx'
    });
    useEditorStore.setState({
      linterWarnings: new Map(),
      rawCode: ''
    });
  });
  it('pushes an error toast when readOverrides IPC fails', async () => {
    ;
    (window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IPC channel closed'));
    render(<ExportModal onClose={vi.fn()} />);
    await waitFor(() => {
      const {
        notifications
      } = useNotificationStore.getState();
      const toast = notifications.find(n => n.title === 'Export check failed');
      expect(toast).toBeDefined();
    });
    const {
      notifications
    } = useNotificationStore.getState();
    const toast = notifications.find(n => n.title === 'Export check failed')!;
    expect(toast.severity).toBe('error');
    expect(toast.message).toContain('IPC channel closed');
  });
  it('fires the export check failed toast only once per modal open', async () => {
    ;
    (window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IPC channel closed'));
    render(<ExportModal onClose={vi.fn()} />);
    await waitFor(() => {
      const {
        notifications
      } = useNotificationStore.getState();
      expect(notifications.some(n => n.title === 'Export check failed')).toBe(true);
    });

    // Exactly one export-check toast
    const {
      notifications
    } = useNotificationStore.getState();
    const toasts = notifications.filter(n => n.title === 'Export check failed');
    expect(toasts).toHaveLength(1);
  });
  it('does NOT push an export toast when readOverrides succeeds (even with violations)', async () => {
    ;
    (window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    // Set violations — export blocked by content, not by IPC failure
    useCanvasStore.setState({
      mithrilViolations: ['node-1']
    });
    render(<ExportModal onClose={vi.fn()} />);
    await waitFor(() => {
      expect(window.flintAPI.tokens.readOverrides).toHaveBeenCalled();
    });
    const {
      notifications
    } = useNotificationStore.getState();
    const exportToast = notifications.find(n => n.title === 'Export check failed');
    expect(exportToast).toBeUndefined();
  });
});