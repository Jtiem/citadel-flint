/**
 * ExportModal.govfix2.test.tsx
 *
 * GOV-FIX-2: Verifies that the "Fix" button on an auto-fixable Mithril
 * violation calls applyBatch with applyTokenFix ops (not flint_fix MCP),
 * matching the GovernanceOverlay pattern.
 *
 * Tests:
 *   - Fix button calls editorStore.applyBatch with applyTokenFix
 *   - Modal stays open after a successful fix (onClose not called)
 *   - Fix button re-fetches overrides after fix
 *   - Non-fixable violations fall through to handleSelectNode (select + close)
 *   - Error is surfaced in the modal as a fix error banner
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ExportModal } from '../ExportModal';
import { useEditorStore } from '../../../store/editorStore';
import { useCanvasStore } from '../../../store/canvasStore';
import type { LinterWarning } from '../../../types/flint-api';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeFixableWarning(id: string = 'node-fixable'): LinterWarning {
  return {
    id,
    type: 'color-drift',
    severity: 'amber',
    value: 4.2,
    message: 'Color drift ΔE 4.2: `bg-[#3f3f46]` differs from nearest token',
    nearestToken: 'zinc-700',
    nearestTokenValue: '#3f3f46'
  };
}
function makeUnfixableWarning(id: string = 'node-manual'): LinterWarning {
  return {
    id,
    type: 'color-drift',
    severity: 'amber',
    value: 6.1,
    message: 'Color drift ΔE 6.1',
    nearestToken: null,
    nearestTokenValue: null
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Default: overrides resolves empty
  ;
  (window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>).mockResolvedValue([])
  // Default: readFile returns updated code
;
  (window.flintAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('export default function Fixed() { return <div /> }')
  // Default: flint_fix succeeds
;
  (window.flintAPI.mcp.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
    content: [{
      type: 'text',
      text: '{}'
    }]
  });
});

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ExportModal — GOV-FIX-2 Fix button behaviour', () => {
  describe('auto-fixable violation', () => {
    beforeEach(() => {
      useEditorStore.setState({
        linterWarnings: new Map([['node-fixable', makeFixableWarning()]])
      });
      useCanvasStore.setState({
        mithrilViolations: ['node-fixable'],
        activeFilePath: '/project/src/Button.tsx'
      });
    });
    it('renders a "Fix" button (not a "Manual" badge) for a fixable violation', async () => {
      render(<ExportModal onClose={() => undefined} />);
      await waitFor(() => {
        expect(screen.getByTitle(/Auto-fix: apply token/i)).toBeDefined();
      });
    });
    it('calls applyBatch with applyTokenFix op (not flint_fix MCP)', async () => {
      const applyBatch = vi.fn().mockResolvedValue(undefined);
      useEditorStore.setState({
        applyBatch
      });
      render(<ExportModal onClose={() => undefined} />);
      await waitFor(() => screen.getByTitle(/Auto-fix/i));
      await act(async () => {
        fireEvent.click(screen.getByTitle(/Auto-fix/i));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(applyBatch).toHaveBeenCalledWith([{
          op: 'applyTokenFix',
          nodeId: 'node-fixable',
          hardcodedClass: 'bg-[#3f3f46]',
          tokenClass: 'zinc-700'
        }]);
      });
    });
    it('does NOT call onClose after a successful auto-fix (modal stays open)', async () => {
      const onClose = vi.fn();
      const applyBatch = vi.fn().mockResolvedValue(undefined);
      useEditorStore.setState({
        applyBatch
      });
      render(<ExportModal onClose={onClose} />);
      await waitFor(() => screen.getByTitle(/Auto-fix/i));
      await act(async () => {
        fireEvent.click(screen.getByTitle(/Auto-fix/i));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(applyBatch).toHaveBeenCalled();
      });
      expect(onClose).not.toHaveBeenCalled();
    });
    it('shows a fix error banner when applyBatch throws', async () => {
      const applyBatch = vi.fn().mockRejectedValue(new Error('Batch failed'));
      useEditorStore.setState({
        applyBatch
      });
      render(<ExportModal onClose={() => undefined} />);
      await waitFor(() => screen.getByTitle(/Auto-fix/i));
      await act(async () => {
        fireEvent.click(screen.getByTitle(/Auto-fix/i));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(screen.getByText(/Fix failed/i)).toBeDefined();
      });
    });
    it('re-fetches overrides after a successful fix', async () => {
      const readOverrides = window.flintAPI.tokens.readOverrides as ReturnType<typeof vi.fn>;
      const applyBatch = vi.fn().mockResolvedValue(undefined);
      useEditorStore.setState({
        applyBatch
      });
      readOverrides.mockResolvedValue([]);
      render(<ExportModal onClose={() => undefined} />);
      await waitFor(() => screen.getByTitle(/Auto-fix/i));
      const callCountBefore = readOverrides.mock.calls.length;
      await act(async () => {
        fireEvent.click(screen.getByTitle(/Auto-fix/i));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(readOverrides.mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });
  });
  describe('non-fixable violation', () => {
    beforeEach(() => {
      useEditorStore.setState({
        linterWarnings: new Map([['node-manual', makeUnfixableWarning()]])
      });
      useCanvasStore.setState({
        mithrilViolations: ['node-manual'],
        activeFilePath: '/project/src/Card.tsx'
      });
    });
    it('renders a "Manual" badge (not a Fix button) for a non-fixable violation', async () => {
      render(<ExportModal onClose={() => undefined} />);
      await waitFor(() => {
        expect(screen.getByText('Manual')).toBeDefined();
      });
    });
    it('does NOT call flint_fix when a non-fixable node ID is clicked', async () => {
      const callTool = window.flintAPI.mcp.callTool as ReturnType<typeof vi.fn>;
      const onClose = vi.fn();
      render(<ExportModal onClose={onClose} />);
      await waitFor(() => {
        expect(screen.getByText('node-manual')).toBeDefined();
      });

      // Clicking the node ID button (not a Fix button) should select and close
      fireEvent.click(screen.getByText('node-manual', {
        selector: 'button'
      }));
      expect(callTool).not.toHaveBeenCalledWith('flint_fix', expect.anything());
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
  describe('no active file path', () => {
    beforeEach(() => {
      useEditorStore.setState({
        linterWarnings: new Map([['node-nofile', makeFixableWarning('node-nofile')]])
      });
      useCanvasStore.setState({
        mithrilViolations: ['node-nofile'],
        activeFilePath: null
      });
    });
    it('falls back to select + close when activeFilePath is null', async () => {
      const onClose = vi.fn();
      const setSelectedNode = vi.fn();
      useEditorStore.setState({
        setSelectedNode
      });
      render(<ExportModal onClose={onClose} />);
      await waitFor(() => screen.getByTitle(/Auto-fix/i));
      await act(async () => {
        fireEvent.click(screen.getByTitle(/Auto-fix/i));
        await Promise.resolve();
      });
      await waitFor(() => {
        // With no file, handleSelectNode is called (fallback)
        expect(onClose).toHaveBeenCalledOnce();
      });
      expect(window.flintAPI.mcp.callTool).not.toHaveBeenCalledWith('flint_fix', expect.anything());
    });
  });
});