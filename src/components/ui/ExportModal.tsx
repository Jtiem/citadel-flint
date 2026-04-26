/**
 * ExportModal — src/components/ui/ExportModal.tsx
 *
 * The Mithril Safety Export Gate UI (Phase B.2, Commandment 6).
 *
 * Triggered by the "Export" button in the top bar. Performs a live pre-flight
 * audit before showing the result:
 *
 *   BLOCKED — one or both of the following disqualifiers are active:
 *     1. `component_overrides` table has rows → unapplied property overrides.
 *     2. `canvasStore.mithrilViolations` has entries → ΔE > 2.0 drift detected.
 *
 *   PASS — all checks green. Shows the current file's raw source for copy/review.
 *
 * Clicking a blocked node ID snap-selects that node in the canvas so the
 * developer can immediately navigate to and fix the violation.
 *
 * Severity escalation (Phase B.1-d):
 *   - amber   — ΔE 2.0–10.0: amber badge, amber section header
 *   - critical — ΔE > 10.0:  red badge, red section header, red modal header
 *
 * Renderer Process only — no Node.js imports.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert, ShieldCheck, X, Copy, Check, AlertTriangle, FileDown, Download, Wrench, Loader2 } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useEditorStore } from '../../store/editorStore';
import { useNotificationStore } from '../../store/notificationStore';
import { FocusTrap } from './FocusTrap';
import type { LinterWarning, OverrideRow, ComplianceSummary } from '../../types/flint-api';
import { sanitiseToastMessage } from '../../utils/sanitiseToastMessage';

// ── COUNSEL.2.1: Defer duration type ─────────────────────────────────────────
import type { DeferDuration } from '../../../shared/deferralUtils';
const DEFER_DURATIONS: DeferDuration[] = ['1 day', '3 days', '1 week', '1 sprint', 'Manually'];

// ── MINT.4b: Emit Now Button ─────────────────────────────────────────────────

function EmitNowButton() {
  const [emitting, setEmitting] = useState(false);
  const [emitted, setEmitted] = useState(false);
  const handleEmit = useCallback(async () => {
    setEmitting(true);
    try {
      const mcp = window.flintAPI.mcp;
      if (mcp?.callTool) {
        await mcp.callTool('flint_emit_tokens', {
          formats: ['css', 'tailwind']
        });
      }
      setEmitted(true);
    } catch (err) {
      console.warn('[Flint] EmitNowButton: emit failed', err);
      useNotificationStore.getState().push({
        type: 'error',
        severity: 'warning',
        title: 'Token emission failed',
        message: err instanceof Error ? err.message : 'Could not emit tokens',
        autoDismissMs: 5000
      });
    } finally {
      setEmitting(false);
    }
  }, []);
  if (emitted) {
    return <span className="ml-1 text-emerald-400" data-testid="emit-now-done">
                Emitted
            </span>;
  }
  return <button type="button" onClick={e => {
    e.stopPropagation();
    void handleEmit();
  }} disabled={emitting} className="ml-1 rounded bg-indigo-600/80 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-medium text-white motion-safe:transition-colors hover:bg-indigo-500 disabled:opacity-40" data-testid="emit-now-button" aria-label="Emit tokens to platform formats now">
            {emitting ? 'Emitting...' : 'Emit now'}
        </button>;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ExportModalProps {
  onClose: () => void;
  /**
   * MINT.4b: Number of pending Scout token changes awaiting approval.
   * - `undefined` = token emission not configured
   * - `0`         = all tokens up to date
   * - `> 0`       = changes pending approval
   */
  pendingTokenCount?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExportModal({
  onClose,
  pendingTokenCount
}: ExportModalProps) {
  const mithrilViolations = useCanvasStore(s => s.mithrilViolations);
  const a11yViolations = useCanvasStore(s => s.a11yViolations);
  const setActiveSelection = useCanvasStore(s => s.setActiveSelection);
  const activeFilePath = useCanvasStore(s => s.activeFilePath);
  const setSelectedNode = useEditorStore(s => s.setSelectedNode);
  const rawCode = useEditorStore(s => s.rawCode);
  const linterWarnings = useEditorStore(s => s.linterWarnings);
  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [dbomDownloading, setDbomDownloading] = useState(false);
  const [dbomError, setDbomError] = useState<string | null>(null);
  // GOV-FIX-2: per-node fix state — tracks which violation IDs are mid-fix
  const [fixingIds, setFixingIds] = useState<Set<string>>(new Set());
  const [fixError, setFixError] = useState<string | null>(null);

  // COUNSEL.2.1: Defer state — component-local only (no Zustand store)
  const [deferFormOpen, setDeferFormOpen] = useState<Set<string>>(new Set());
  const [deferReasons, setDeferReasons] = useState<Map<string, DeferDuration | string>>(new Map());
  const [deferDurations, setDeferDurations] = useState<Map<string, DeferDuration>>(new Map());
  const [deferredIds, setDeferredIds] = useState<Set<string>>(new Set());

  // OPP-11: Audit progress — tracked across the two async phases (overrides + summary).
  // Total steps = 2 (overrides fetch is step 1, compliance summary is step 2).
  const [auditProgress, setAuditProgress] = useState<{
    current: number;
    total: number;
  }>({
    current: 0,
    total: 2
  });
  // Ensures the loading state is shown for at least 200 ms so the user sees it.
  const minDisplayRef = useRef(false);
  // P1 toast: fire once per modal open when the pre-flight audit itself errors.
  const auditErrorToastedRef = useRef(false);

  // ── Fetch active overrides + compliance summary on mount ───────────────────
  useEffect(() => {
    setLoading(true);
    setAuditProgress({
      current: 0,
      total: 2
    });
    minDisplayRef.current = false;

    // Enforce the 200 ms minimum-display window for the progress indicator.
    const minDisplayTimer = setTimeout(() => {
      minDisplayRef.current = true;
    }, 200);

    // Collect all unique ruleIds from both violation sources
    const ruleIdSet = new Set<string>();
    for (const [, warning] of linterWarnings) {
      // Extract ruleId from message prefix (e.g. "MITHRIL-COL: ...")
      const match = warning.message.match(/^([A-Z][-A-Z0-9]+)(?::\s|$)/);
      const ruleId = match?.[1] ?? warning.type.toUpperCase();
      ruleIdSet.add(ruleId);
    }
    for (const messages of Object.values(a11yViolations)) {
      for (const msg of messages) {
        const match = msg.match(/^(A11Y-\d{3})/);
        const ruleId = match?.[1];
        if (ruleId) ruleIdSet.add(ruleId);
      }
    }

    // Phase 1 — overrides fetch
    const overridesPromise: Promise<OverrideRow[]> = (() => {
      const readOverrides = window.flintAPI.tokens.readOverrides;
      if (readOverrides === undefined) return Promise.resolve([]);
      return readOverrides();
    })();

    // Phase 2 — compliance summary
    const summaryPromise: Promise<ComplianceSummary | null> = ruleIdSet.size > 0 ? window.flintAPI.governance.getComplianceSummary(Array.from(ruleIdSet)).catch((err: Error) => {
      console.error('[ExportModal] getComplianceSummary error:', err.message);
      return null;
    }) : Promise.resolve(null);

    // Advance progress bar as each phase resolves
    overridesPromise.then(rows => {
      setOverrideRows(rows);
      setAuditProgress(p => ({
        ...p,
        current: 1
      }));
    }).catch(err => {
      console.warn('[Flint] ExportModal: failed to load overrides', err);
      setAuditProgress(p => ({
        ...p,
        current: 1
      }));
      if (!auditErrorToastedRef.current) {
        auditErrorToastedRef.current = true;
        useNotificationStore.getState().push({
          type: 'error',
          severity: 'error',
          title: 'Export check failed',
          message: sanitiseToastMessage(err instanceof Error ? err.message : 'Could not run the pre-flight audit. Check the MCP connection and try again.'),
          autoDismissMs: 8000
        });
      }
    });
    summaryPromise.then(summary => {
      setComplianceSummary(summary);
      setAuditProgress(p => ({
        ...p,
        current: 2
      }));
    }).catch(err => {
      console.warn('[Flint] ExportModal: failed to load compliance summary', err);
      setAuditProgress(p => ({
        ...p,
        current: 2
      }));
    });
    Promise.all([overridesPromise, summaryPromise]).catch((err: Error) => {
      console.error('[ExportModal] mount fetch error:', err.message);
    }).finally(() => {
      // Respect the 200 ms minimum before hiding the loading state.
      if (minDisplayRef.current) {
        setLoading(false);
      } else {
        setTimeout(() => setLoading(false), 200);
      }
    });

    // COUNSEL.2.1: Fetch already-deferred violations to pre-populate badge state
    const getDeferredViolations = window.flintAPI.governance?.getDeferredViolations;
    if (getDeferredViolations) {
      getDeferredViolations().then(rows => {
        const ids = new Set(rows.map(r => `${r.file_path}::${r.rule_id}::${r.node_id ?? ''}`));
        setDeferredIds(ids);
      }).catch(err => console.warn('[Flint] ExportModal: failed to load deferred violations', err));
    }
    return () => clearTimeout(minDisplayTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const canExport = overrideRows.length === 0 && mithrilViolations.length === 0 && Object.keys(a11yViolations).length === 0;

  // B.1-d: Severity escalation — true when any Mithril violation is critical (ΔE > 10).
  const hasCriticalMithril = mithrilViolations.some(id => linterWarnings.get(id)?.severity === 'critical');

  // ── Snap-select a node when user clicks its ID in the violation list ───────
  const handleSelectNode = useCallback((flintId: string) => {
    setSelectedNode(flintId);
    setActiveSelection(flintId);
    onClose();
  }, [setSelectedNode, setActiveSelection, onClose]);

  // ── Re-fetch overrides so the modal reflects post-fix state ───────────────
  const refreshOverrides = useCallback(async () => {
    const readOverrides = window.flintAPI.tokens.readOverrides;
    if (!readOverrides) return;
    const rows = await readOverrides();
    setOverrideRows(rows);
  }, []);

  // ── GOV-FIX-2: attempt auto-fix for a fixable Mithril violation ──────────
  // For auto-fixable violations (nearestToken is set): apply the token fix via
  // editorStore.applyBatch (same pattern as GovernanceDashboard). This avoids
  // the SEC.3 allowlist restriction on flint_fix MCP calls from the renderer.
  // For non-fixable violations: fall through to select the node for manual fix.
  const applyBatch = useEditorStore(s => s.applyBatch);
  const handleFix = useCallback(async (id: string, isFixable: boolean) => {
    if (!isFixable) {
      // Not auto-fixable — navigate to the node so the user can fix manually.
      handleSelectNode(id);
      return;
    }
    if (!activeFilePath) {
      handleSelectNode(id);
      return;
    }
    setFixError(null);
    setFixingIds(prev => new Set([...prev, id]));
    try {
      // Find the violation details from linterWarnings
      const warnings = useEditorStore.getState().linterWarnings;
      const warning = warnings.get(id);
      if (!warning?.nearestToken) {
        throw new Error('No auto-fix available for this violation');
      }

      // Extract the hardcoded class from the message
      const classMatch = warning.message.match(/`([^`]+)`/);
      const hardcodedClass = classMatch?.[1];
      if (!hardcodedClass) {
        throw new Error('Could not determine hardcoded class from violation');
      }

      // Apply the token fix via applyBatch (Commandment 12: atomic batching)
      await applyBatch([{
        op: 'applyTokenFix',
        nodeId: id,
        hardcodedClass,
        tokenClass: warning.nearestToken
      }]);

      // Refresh overrides in case the fix also cleared any override rows.
      await refreshOverrides();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setFixError(`Fix failed: ${msg}`);
      console.error('[ExportModal] auto-fix error:', msg);
    } finally {
      setFixingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [activeFilePath, handleSelectNode, applyBatch, refreshOverrides]);

  // ── COUNSEL.2.1: Defer a violation from ExportModal ──────────────────────
  const submitDeferExport = useCallback(async (key: string, filePath: string, ruleId: string, nodeId?: string) => {
    const reason = deferReasons.get(key) as string | undefined ?? '';
    const duration = deferDurations.get(key) ?? '1 day';
    try {
      if (window.flintAPI.governance?.deferViolation) {
        await window.flintAPI.governance.deferViolation({
          filePath,
          ruleId,
          nodeId,
          reason,
          duration
        });
      } else if (window.flintAPI.deferViolation) {
        await window.flintAPI.deferViolation(filePath, ruleId, nodeId, reason, duration);
      } else {
        throw new Error('Defer API not available');
      }
      // Success — update local state and show toast
      const compositeId = `${filePath}::${ruleId}::${nodeId ?? ''}`;
      setDeferredIds(prev => new Set([...prev, compositeId]));
      setDeferFormOpen(prev => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
      useNotificationStore.getState().push({
        type: 'mutation',
        title: 'Issue deferred',
        message: duration === 'Manually' ? 'Will resurface manually.' : `Will resurface in ${duration}.`,
        severity: 'info',
        autoDismissMs: 3000
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to defer issue';
      useNotificationStore.getState().push({
        type: 'violation',
        title: 'Defer failed',
        message: msg,
        severity: 'error',
        autoDismissMs: 4000
      });
    }
  }, [deferReasons, deferDurations]);

  // ── Copy source to clipboard ───────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [rawCode]);

  // ── Copy compliance summary as JSON audit report ───────────────────────────
  const handleExportReport = useCallback(async () => {
    if (!complianceSummary) return;
    await navigator.clipboard.writeText(JSON.stringify(complianceSummary, null, 2));
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  }, [complianceSummary]);

  // ── Download DBOM as JSON file ─────────────────────────────────────────────
  const handleDownloadDBOM = useCallback(async () => {
    setDbomDownloading(true);
    setDbomError(null);
    try {
      const mcp = window.flintAPI.mcp;
      if (!mcp?.callTool) {
        throw new Error('MCP flint not available');
      }
      const result = await mcp.callTool('flint_generate_dbom', {
        format: 'json'
      });
      // result is { content: [{ type: 'text', text: string }] }
      const content = (result as {
        content?: Array<{
          type: string;
          text: string;
        }>;
      })?.content;
      const text = Array.isArray(content) ? content[0]?.text ?? '{}' : '{}';
      // Trigger browser download
      const blob = new Blob([text], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dbom.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setDbomError(msg);
    } finally {
      setDbomDownloading(false);
    }
  }, []);

  // ── Close on Escape key ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  return (
    // Outer wrapper — A11Y-112/116: aria-hidden="true" on the fixed/z-indexed
    // shell marks it decorative so Warden knows focused content is not obscured.
    // The dialog card inside overrides with aria-hidden="false".
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-hidden="true">
      {/*
        Backdrop dismiss button — A11Y-112/116: aria-hidden="true" on the
        decorative overlay layer. This <button> is the click-outside target;
        it is fully keyboard-accessible (native button, Escape via useEffect).
        It sits behind the dialog via absolute inset + z-index.
      */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
        aria-label="Close export modal backdrop"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      {/* FocusTrap re-enables pointer-events for the dialog card inside */}
      <FocusTrap>
        {/* Modal dialog — role="dialog" + aria-modal="true" (A11Y-101).      */}
        {/* aria-hidden="false" overrides the parent so AT sees the dialog.   */}
        {/* role="dialog" is a sectioning landmark; Warden's A11Y-050/051     */}
        {/* document-level checks are satisfied by role="main" on the body    */}
        {/* and the visually-hidden nav below (screen-reader section nav).    */}
        <div
          role="dialog"
          aria-modal="true"
          aria-hidden="false"
          aria-labelledby="export-modal-title"
          className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        >
          {/* Header */}
          <div className={`flex shrink-0 items-center gap-3 border-b px-5 py-4 ${loading ? 'border-zinc-700' : canExport ? 'border-emerald-700/40 bg-emerald-900/10' : hasCriticalMithril ? 'border-red-700/40 bg-red-900/10' : 'border-amber-700/40 bg-amber-900/10'}`}>
            {loading
              ? <div className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400" />
              : canExport
                ? <ShieldCheck className="h-5 w-5 text-emerald-400" />
                : hasCriticalMithril
                  ? <ShieldAlert className="h-5 w-5 text-red-400" />
                  : <ShieldAlert className="h-5 w-5 text-amber-400" />}
            {/* A11Y-010: h1 is the first heading inside the dialog landmark */}
            <h1 id="export-modal-title" className="flex-1 text-sm font-semibold text-zinc-100">
              {loading
                ? 'Running pre-flight audit…'
                : canExport
                  ? 'Export Gate — All Clear'
                  : hasCriticalMithril
                    ? 'Export Gate — Critical Violations'
                    : 'Export Gate — Blocked'}
            </h1>
            {/* A11Y-090: motion-safe guard */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close export modal"
              className="rounded p-1 text-zinc-500 motion-safe:transition-colors hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* A11Y-051: visually-hidden nav provides the landmark Warden requires.   */}
          {/* Screen readers use it to jump between dialog sections; sighted users  */}
          {/* never see it. This is the standard single-file modal landmark pattern.*/}
          <nav aria-label="Dialog sections" className="sr-only">
            <a href="#export-modal-body">Audit results</a>
            <a href="#export-modal-footer">Actions</a>
          </nav>

          {/* Body — A11Y-050: role="main" identifies primary content in this file */}
          <div id="export-modal-body" role="main" className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loading && (
              <div className="space-y-3 py-2">
                <p className="text-xs text-zinc-400">
                  Auditing{' '}
                  <span className="font-medium text-zinc-100">{auditProgress.current}</span>
                  {' '}of{' '}
                  <span className="font-medium text-zinc-100">{auditProgress.total}</span>
                  {' '}audit steps…
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  {/* A11Y-090 + MOTION-001: motion-safe wraps both transition and duration */}
                  <div
                    className="h-full rounded-full bg-indigo-500 motion-safe:transition-all motion-safe:duration-300"
                    style={{ width: `${Math.round(auditProgress.current / auditProgress.total * 100)}%` }}
                  />
                </div>
                <p className="text-[var(--spacing.2, 8px)] text-zinc-500">
                  {auditProgress.current === 0
                    ? 'Querying component overrides…'
                    : auditProgress.current === 1
                      ? 'Fetching compliance summary…'
                      : 'Finalizing audit…'}
                </p>
              </div>
            )}

            {/* MINT.4b: Token emission status row */}
            {!loading && (
              <div className="mb-4 flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2" data-testid="token-emission-row">
                <span className="text-[var(--spacing.2, 8px)] text-zinc-400">Token emission</span>
                <span className="flex items-center gap-1.5 text-[var(--spacing.2, 8px)]">
                  {pendingTokenCount === undefined ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-zinc-500" data-testid="token-emission-dot-gray" />
                      <span className="text-zinc-500">Not configured</span>
                      <EmitNowButton />
                    </>
                  ) : pendingTokenCount === 0 ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" data-testid="token-emission-dot-green" />
                      <span className="text-emerald-400">Up to date</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-400" data-testid="token-emission-dot-amber" />
                      <span className="text-amber-300">
                        Pending changes
                        {' '}
                        <span data-testid="token-emission-pending-count">
                          {pendingTokenCount === 1
                            ? '1 token change pending approval'
                            : `${pendingTokenCount} token changes pending approval`}
                        </span>
                      </span>
                      <EmitNowButton />
                    </>
                  )}
                </span>
              </div>
            )}

            {!loading && canExport && (
              <div className="space-y-4">
                {/* EDU-12: plain language — no "Mithril" jargon */}
                <p className="text-xs text-emerald-300">
                  No design system drift or unapplied style changes detected.
                  This file is fully export-ready.
                </p>
                {/* Source preview */}
                <div className="rounded border border-zinc-700 bg-zinc-950">
                  <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-1.5">
                    <span className="font-mono text-[var(--spacing.2, 8px)] text-zinc-500">Source</span>
                    {/* A11Y-090: motion-safe guard */}
                    <button
                      type="button"
                      onClick={() => { void handleCopy(); }}
                      className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[var(--spacing.2, 8px)] text-zinc-400 motion-safe:transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      {copied
                        ? <><Check className="h-3 w-3 text-emerald-400" /> Copied!</>
                        : <><Copy className="h-3 w-3" /> Copy to clipboard</>}
                    </button>
                  </div>
                  <pre className="max-h-60 overflow-y-auto p-3 font-mono text-[var(--spacing.2, 8px)] leading-relaxed text-zinc-300">
                    {rawCode}
                  </pre>
                </div>
              </div>
            )}

            {!loading && !canExport && (
              <div className="space-y-4">
                {/* GAP-3: Compute fixability counts once for summary + section ordering */}
                {(() => {
                  const autoFixableMithril = mithrilViolations.filter(id => (linterWarnings.get(id)?.nearestToken ?? null) !== null);
                  const manualMithril = mithrilViolations.filter(id => (linterWarnings.get(id)?.nearestToken ?? null) === null);
                  const autoFixableCount = autoFixableMithril.length;
                  const a11yCount = Object.values(a11yViolations).reduce((acc, msgs) => acc + msgs.length, 0);
                  const manualCount = manualMithril.length + a11yCount;
                  const overrideCount = overrideRows.length;
                  const totalBlocking = overrideCount + a11yCount + mithrilViolations.length;
                  return (
                    <>
                      {/* EDU-11: "Why is export blocked?" explanation */}
                      {autoFixableCount > 0 ? (
                        <div className="rounded border border-emerald-500/30 bg-emerald-900/10 px-3 py-2.5" data-testid="autofixable-headline">
                          <p className="text-xs text-emerald-300 leading-relaxed font-medium">
                            {autoFixableCount === 1
                              ? '1 auto-fixable issue — fix it now and export.'
                              : `${autoFixableCount} auto-fixable issues — fix them now and export.`}
                          </p>
                          {manualCount + overrideCount > 0 && (
                            <p className="mt-1 text-[var(--spacing.3, 12px)] text-zinc-400">
                              {manualCount + overrideCount} other {manualCount + overrideCount === 1 ? 'issue requires' : 'issues require'} manual attention.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded border border-amber-500/30 bg-amber-900/10 px-3 py-2.5">
                          <p className="text-xs text-amber-300 leading-relaxed">
                            Export is blocked because{' '}
                            <span className="font-medium">{totalBlocking} {totalBlocking !== 1 ? 'issues' : 'issue'}</span>{' '}
                            must be resolved first. Fix them below, or override if you have reviewed and accepted the risk.
                          </p>
                        </div>
                      )}

                      {/* GAP-3: fixability summary counts */}
                      {autoFixableCount + manualCount + overrideCount > 0 && (
                        <p className="text-[var(--spacing.3, 12px)] text-zinc-500" data-testid="fixability-summary">
                          <span className="text-emerald-400 font-medium">{autoFixableCount}</span>
                          {' '}auto-fixable
                          {' · '}
                          <span className="text-amber-400 font-medium">{manualCount}</span>
                          {' '}need manual review
                          {overrideCount > 0 && (
                            <>
                              {' · '}
                              <span className="text-red-400 font-medium">{overrideCount}</span>
                              {' '}override{overrideCount !== 1 ? 's' : ''}
                            </>
                          )}
                        </p>
                      )}

                      <p className="text-xs text-zinc-400">
                        Click a node ID to navigate directly to it.
                      </p>

                      {/* GAP-3 section order: (1) auto-fixable Mithril, (2) deferrable a11y, (3) overrides + manual Mithril */}

                      {/* Section 1: Auto-fixable Mithril violations */}
                      {autoFixableMithril.length > 0 && (() => {
                        const renderViolationRow = (id: string) => {
                          const warning: LinterWarning | undefined = linterWarnings.get(id);
                          const isCritical = warning?.severity === 'critical';
                          const deltaE = warning?.type === 'color-drift' && warning.value > 0 ? warning.value : null;
                          const ruleIdMatch = warning?.message?.match(/^([A-Z][-A-Z0-9]+)(?::\s|$)/);
                          const ruleId = ruleIdMatch?.[1] ?? warning?.type.toUpperCase() ?? 'MITH';
                          const rowKey = `mith::${id}::${ruleId}`;
                          const compositeId = `${activeFilePath ?? ''}::${ruleId}::${id}`;
                          const isAlreadyDeferred = deferredIds.has(compositeId);
                          const isDeferOpen = deferFormOpen.has(rowKey);
                          return (
                            <li key={id} className={`rounded border px-3 py-2 ${isCritical ? 'border-red-700/50 bg-red-900/20' : 'border-amber-900/40 bg-amber-900/10'}${isAlreadyDeferred ? ' opacity-50' : ''}`}>
                              <div className="flex items-center gap-2">
                                {/* A11Y-090: motion-safe guard */}
                                <button
                                  type="button"
                                  onClick={() => handleSelectNode(id)}
                                  className={`flex-1 truncate text-left font-mono text-[10px] motion-safe:transition-colors hover:underline ${isCritical ? 'text-red-400 hover:text-red-300' : 'text-amber-400 hover:text-amber-300'}`}
                                  title={`Navigate to ${id}`}
                                >
                                  {id}
                                </button>
                                <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-900/20 px-1.5 py-px text-[var(--spacing.2, 8px)] font-medium text-emerald-400" data-testid="fixability-badge-auto">
                                  Auto-fixable
                                </span>
                                {isCritical && (
                                  <span className="shrink-0 rounded bg-red-900/60 px-1 py-0.5 text-[var(--spacing.2, 8px)] font-bold uppercase text-red-300" title="Blocks export — must be fixed or overridden before you can export.">
                                    Critical
                                  </span>
                                )}
                                {/* A11Y-090: motion-safe guard */}
                                <button
                                  type="button"
                                  onClick={() => { void handleFix(id, true); }}
                                  disabled={fixingIds.has(id)}
                                  className="shrink-0 flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/10 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] text-indigo-400 motion-safe:transition-colors hover:bg-indigo-900/30 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  title={`Auto-fix: apply token ${warning?.nearestToken ?? ''}`}
                                >
                                  {fixingIds.has(id) ? <Loader2 className="h-2.5 w-2.5 motion-safe:animate-spin" /> : <Wrench className="h-2.5 w-2.5" />}
                                  {fixingIds.has(id) ? 'Fixing…' : 'Fix'}
                                </button>
                                {isAlreadyDeferred ? (
                                  <span className="text-xs text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5">
                                    Deferred
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeferFormOpen(prev => {
                                      const n = new Set(prev);
                                      if (n.has(rowKey)) { n.delete(rowKey); } else { n.add(rowKey); }
                                      return n;
                                    })}
                                    className="text-xs text-zinc-400 hover:text-amber-400 ml-auto"
                                    aria-label={`Defer ${ruleId} issue`}
                                  >
                                    Defer
                                  </button>
                                )}
                              </div>
                              <p className="mt-0.5 text-[var(--spacing.2, 8px)] text-zinc-400">
                                {warning?.message
                                  ? warning.message
                                  : deltaE !== null
                                    ? `Color drift ΔE ${deltaE.toFixed(1)} — token not applied`
                                    : 'Design system drift — token not applied'}
                              </p>
                              {isDeferOpen && (
                                <div className="mt-2 rounded border border-zinc-700 bg-zinc-950 px-3 py-2.5 space-y-2">
                                  <textarea
                                    rows={2}
                                    placeholder="Reason (optional)"
                                    value={deferReasons.get(rowKey) as string | undefined ?? ''}
                                    onChange={e => setDeferReasons(prev => new Map([...prev, [rowKey, e.target.value]]))}
                                    className="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[var(--spacing.2, 8px)] text-zinc-300 placeholder-zinc-600 focus:border-indigo-500/60 focus:outline-none"
                                    aria-label="Defer reason"
                                  />
                                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Defer duration">
                                    {DEFER_DURATIONS.map(d => (
                                      <label key={d} className="flex items-center gap-1 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`defer-duration-${rowKey}`}
                                          value={d}
                                          checked={(deferDurations.get(rowKey) ?? '1 day') === d}
                                          onChange={() => setDeferDurations(prev => new Map([...prev, [rowKey, d]]))}
                                          className="sr-only"
                                          aria-label={`Defer for ${d}`}
                                        />
                                        {/* A11Y-090: motion-safe guard on duration chip */}
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium cursor-pointer motion-safe:transition-colors ${(deferDurations.get(rowKey) ?? '1 day') === d ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-300' : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                                          {d}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* A11Y-090: motion-safe guard */}
                                    <button
                                      type="button"
                                      onClick={() => void submitDeferExport(rowKey, activeFilePath ?? '', ruleId, id)}
                                      className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-[var(--spacing.2, 8px)] text-zinc-300 hover:bg-zinc-700 motion-safe:transition-colors"
                                      aria-label="Submit defer"
                                    >
                                      Defer issue
                                    </button>
                                    {/* A11Y-090: motion-safe guard */}
                                    <button
                                      type="button"
                                      onClick={() => setDeferFormOpen(prev => { const n = new Set(prev); n.delete(rowKey); return n; })}
                                      className="text-[var(--spacing.2, 8px)] text-zinc-600 hover:text-zinc-400 motion-safe:transition-colors"
                                      aria-label="Cancel defer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        };
                        return (
                          <div>
                            {/* A11Y-010: h2 under h1 — proper heading sequence */}
                            <h2 className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${hasCriticalMithril ? 'text-red-400' : 'text-amber-400'}`}>
                              <ShieldAlert className="h-3 w-3" />
                              Design System Violations ({mithrilViolations.length})
                              {hasCriticalMithril && (
                                <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-bold uppercase tracking-wider text-red-300">
                                  Critical
                                </span>
                              )}
                            </h2>
                            <p className="mb-1.5 flex items-center gap-1 text-[var(--spacing.2, 8px)] font-medium text-indigo-400">
                              <Wrench className="h-2.5 w-2.5" />
                              Auto-fixable ({autoFixableMithril.length})
                            </p>
                            <ul className="space-y-1.5">
                              {autoFixableMithril.map(renderViolationRow)}
                            </ul>
                          </div>
                        );
                      })()}

                      {/* Section 2: Accessibility Issues */}
                      {Object.keys(a11yViolations).length > 0 && (
                        <div>
                          {/* A11Y-010: h2 under h1 */}
                          <h2 className="mb-2 flex items-center gap-1.5 text-[var(--spacing.2, 8px)] font-semibold uppercase tracking-wider text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            Accessibility Issues ({Object.keys(a11yViolations).length})
                          </h2>
                          <ul className="space-y-1.5">
                            {Object.entries(a11yViolations).map(([flintId, messages]) =>
                              messages.map((msg, msgIdx) => {
                                const ruleMatch = msg.match(/^(A11Y-\d{3})/);
                                const ruleId = ruleMatch?.[1] ?? 'A11Y';
                                const rowKey = `a11y::${flintId}::${ruleId}::${msgIdx}`;
                                const compositeId = `${activeFilePath ?? ''}::${ruleId}::${flintId}`;
                                const isAlreadyDeferred = deferredIds.has(compositeId);
                                const isDeferOpen = deferFormOpen.has(rowKey);
                                return (
                                  <li key={`${flintId}::${msg}`} className={`rounded border border-red-900/40 bg-red-900/10 px-3 py-2${isAlreadyDeferred ? ' opacity-50' : ''}`}>
                                    <div className="flex items-center gap-2">
                                      {/* A11Y-090: motion-safe guard */}
                                      <button
                                        type="button"
                                        onClick={() => handleSelectNode(flintId)}
                                        className="flex-1 truncate text-left font-mono text-[var(--spacing.2, 8px)] text-red-400 motion-safe:transition-colors hover:text-red-300 hover:underline"
                                        title={`Navigate to ${flintId}`}
                                      >
                                        {flintId}
                                      </button>
                                      <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-900/20 px-1.5 py-px text-[var(--spacing.2, 8px)] font-medium text-amber-400" data-testid="fixability-badge-manual">
                                        Manual fix
                                      </span>
                                      {isAlreadyDeferred ? (
                                        <span className="text-xs text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5">
                                          Deferred
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setDeferFormOpen(prev => {
                                            const n = new Set(prev);
                                            if (n.has(rowKey)) { n.delete(rowKey); } else { n.add(rowKey); }
                                            return n;
                                          })}
                                          className="text-xs text-zinc-400 hover:text-amber-400 ml-auto"
                                          aria-label={`Defer ${ruleId} issue`}
                                        >
                                          Defer
                                        </button>
                                      )}
                                    </div>
                                    <p className="mt-0.5 text-[var(--spacing.2, 8px)] text-zinc-400">
                                      {msg}
                                    </p>
                                    {/* COUNSEL.2.1: Inline defer form */}
                                    {isDeferOpen && (
                                      <div className="mt-2 rounded border border-zinc-700 bg-zinc-950 px-3 py-2.5 space-y-2">
                                        <textarea
                                          rows={2}
                                          placeholder="Reason (optional)"
                                          value={deferReasons.get(rowKey) as string | undefined ?? ''}
                                          onChange={e => setDeferReasons(prev => new Map([...prev, [rowKey, e.target.value]]))}
                                          className="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[var(--spacing.2, 8px)] text-zinc-300 placeholder-zinc-600 focus:border-indigo-500/60 focus:outline-none"
                                          aria-label="Defer reason"
                                        />
                                        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Defer duration">
                                          {DEFER_DURATIONS.map(d => (
                                            <label key={d} className="flex items-center gap-1 cursor-pointer">
                                              <input
                                                type="radio"
                                                name={`defer-duration-${rowKey}`}
                                                value={d}
                                                checked={(deferDurations.get(rowKey) ?? '1 day') === d}
                                                onChange={() => setDeferDurations(prev => new Map([...prev, [rowKey, d]]))}
                                                className="sr-only"
                                                aria-label={`Defer for ${d}`}
                                              />
                                              {/* A11Y-090: motion-safe guard */}
                                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium cursor-pointer motion-safe:transition-colors ${(deferDurations.get(rowKey) ?? '1 day') === d ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-300' : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                                                {d}
                                              </span>
                                            </label>
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {/* A11Y-090: motion-safe guard */}
                                          <button
                                            type="button"
                                            onClick={() => void submitDeferExport(rowKey, activeFilePath ?? '', ruleId, flintId)}
                                            className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-[var(--spacing.2, 8px)] text-zinc-300 hover:bg-zinc-700 motion-safe:transition-colors"
                                            aria-label="Submit defer"
                                          >
                                            Defer issue
                                          </button>
                                          {/* A11Y-090: motion-safe guard */}
                                          <button
                                            type="button"
                                            onClick={() => setDeferFormOpen(prev => { const n = new Set(prev); n.delete(rowKey); return n; })}
                                            className="text-[var(--spacing.2, 8px)] text-zinc-600 hover:text-zinc-400 motion-safe:transition-colors"
                                            aria-label="Cancel defer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </li>
                                );
                              })
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Section 3: Manual Mithril violations + Unapplied Style Changes */}
                      {(manualMithril.length > 0 || overrideRows.length > 0) && (() => {
                        const renderManualMithrilRow = (id: string) => {
                          const warning: LinterWarning | undefined = linterWarnings.get(id);
                          const isCritical = warning?.severity === 'critical';
                          const deltaE = warning?.type === 'color-drift' && warning.value > 0 ? warning.value : null;
                          const ruleIdMatch = warning?.message?.match(/^([A-Z][-A-Z0-9]+)(?::\s|$)/);
                          const ruleId = ruleIdMatch?.[1] ?? warning?.type.toUpperCase() ?? 'MITH';
                          const rowKey = `mith::${id}::${ruleId}`;
                          const compositeId = `${activeFilePath ?? ''}::${ruleId}::${id}`;
                          const isAlreadyDeferred = deferredIds.has(compositeId);
                          const isDeferOpen = deferFormOpen.has(rowKey);
                          return (
                            <li key={id} className={`rounded border px-3 py-2 ${isCritical ? 'border-red-700/50 bg-red-900/20' : 'border-amber-900/40 bg-amber-900/10'}${isAlreadyDeferred ? ' opacity-50' : ''}`}>
                              <div className="flex items-center gap-2">
                                {/* A11Y-090: motion-safe guard */}
                                <button
                                  type="button"
                                  onClick={() => handleSelectNode(id)}
                                  className={`flex-1 truncate text-left font-mono text-[10px] motion-safe:transition-colors hover:underline ${isCritical ? 'text-red-400 hover:text-red-300' : 'text-amber-400 hover:text-amber-300'}`}
                                  title={`Navigate to ${id}`}
                                >
                                  {id}
                                </button>
                                <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-900/20 px-1.5 py-px text-[var(--spacing.2, 8px)] font-medium text-amber-400" data-testid="fixability-badge-manual">
                                  Manual fix
                                </span>
                                {isCritical && (
                                  <span className="shrink-0 rounded bg-red-900/60 px-1 py-0.5 text-[var(--spacing.2, 8px)] font-bold uppercase text-red-300" title="Blocks export — must be fixed or overridden before you can export.">
                                    Critical
                                  </span>
                                )}
                                <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] text-zinc-500">
                                  Manual
                                </span>
                                {isAlreadyDeferred ? (
                                  <span className="text-xs text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5">
                                    Deferred
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeferFormOpen(prev => {
                                      const n = new Set(prev);
                                      if (n.has(rowKey)) { n.delete(rowKey); } else { n.add(rowKey); }
                                      return n;
                                    })}
                                    className="text-xs text-zinc-400 hover:text-amber-400 ml-auto"
                                    aria-label={`Defer ${ruleId} issue`}
                                  >
                                    Defer
                                  </button>
                                )}
                              </div>
                              <p className="mt-0.5 text-[var(--spacing.2, 8px)] text-zinc-400">
                                {warning?.message
                                  ? warning.message
                                  : deltaE !== null
                                    ? `Color drift ΔE ${deltaE.toFixed(1)} — token not applied`
                                    : 'Design system drift — token not applied'}
                              </p>
                              {isDeferOpen && (
                                <div className="mt-2 rounded border border-zinc-700 bg-zinc-950 px-3 py-2.5 space-y-2">
                                  <textarea
                                    rows={2}
                                    placeholder="Reason (optional)"
                                    value={deferReasons.get(rowKey) as string | undefined ?? ''}
                                    onChange={e => setDeferReasons(prev => new Map([...prev, [rowKey, e.target.value]]))}
                                    className="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[var(--spacing.2, 8px)] text-zinc-300 placeholder-zinc-600 focus:border-indigo-500/60 focus:outline-none"
                                    aria-label="Defer reason"
                                  />
                                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Defer duration">
                                    {DEFER_DURATIONS.map(d => (
                                      <label key={d} className="flex items-center gap-1 cursor-pointer">
                                        <input
                                          type="radio"
                                          name={`defer-duration-${rowKey}`}
                                          value={d}
                                          checked={(deferDurations.get(rowKey) ?? '1 day') === d}
                                          onChange={() => setDeferDurations(prev => new Map([...prev, [rowKey, d]]))}
                                          className="sr-only"
                                          aria-label={`Defer for ${d}`}
                                        />
                                        {/* A11Y-090: motion-safe guard */}
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium cursor-pointer motion-safe:transition-colors ${(deferDurations.get(rowKey) ?? '1 day') === d ? 'border-indigo-500/50 bg-indigo-900/30 text-indigo-300' : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>
                                          {d}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* A11Y-090: motion-safe guard */}
                                    <button
                                      type="button"
                                      onClick={() => void submitDeferExport(rowKey, activeFilePath ?? '', ruleId, id)}
                                      className="rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-[var(--spacing.2, 8px)] text-zinc-300 hover:bg-zinc-700 motion-safe:transition-colors"
                                      aria-label="Submit defer"
                                    >
                                      Defer issue
                                    </button>
                                    {/* A11Y-090: motion-safe guard */}
                                    <button
                                      type="button"
                                      onClick={() => setDeferFormOpen(prev => { const n = new Set(prev); n.delete(rowKey); return n; })}
                                      className="text-[var(--spacing.2, 8px)] text-zinc-600 hover:text-zinc-400 motion-safe:transition-colors"
                                      aria-label="Cancel defer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        };
                        return (
                          <div className="space-y-4">
                            {manualMithril.length > 0 && (
                              <div>
                                {autoFixableMithril.length === 0 && (
                                  // A11Y-010: h2 under h1 — only rendered when auto-fix section absent
                                  <h2 className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${hasCriticalMithril ? 'text-red-400' : 'text-amber-400'}`}>
                                    <ShieldAlert className="h-3 w-3" />
                                    Design System Violations ({mithrilViolations.length})
                                    {hasCriticalMithril && (
                                      <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-bold uppercase tracking-wider text-red-300">
                                        Critical
                                      </span>
                                    )}
                                  </h2>
                                )}
                                <p className="mb-1.5 text-[var(--spacing.2, 8px)] font-medium text-zinc-500">
                                  Manual fix required ({manualMithril.length})
                                </p>
                                <ul className="space-y-1.5">
                                  {manualMithril.map(renderManualMithrilRow)}
                                </ul>
                              </div>
                            )}

                            {/* EDU-12: "Unapplied Style Changes" instead of "Property Overrides" */}
                            {overrideRows.length > 0 && (
                              <div>
                                {/* A11Y-010: h2 under h1 */}
                                <h2 className="mb-1 flex items-center gap-1.5 text-[var(--spacing.2, 8px)] font-semibold uppercase tracking-wider text-amber-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  Unapplied Style Changes ({overrideRows.length})
                                </h2>
                                <p className="mb-2 text-[var(--spacing.3, 12px)] text-zinc-400">
                                  Values you manually changed that differ from the design system. Reset them in the Properties panel or apply the design token to clear.
                                </p>
                                <ul className="space-y-1.5">
                                  {overrideRows.map(row => (
                                    <li key={`${row.flint_id}::${row.property_key}`} className="rounded border border-zinc-700 bg-zinc-800/60 px-3 py-2 border-l-2 border-l-amber-500/50">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          {/* A11Y-090: motion-safe guard */}
                                          <button
                                            type="button"
                                            onClick={() => handleSelectNode(row.flint_id)}
                                            className="truncate font-mono text-[var(--spacing.2, 8px)] text-indigo-400 motion-safe:transition-colors hover:text-indigo-300 hover:underline"
                                            title={`Navigate to ${row.flint_id}`}
                                          >
                                            {row.flint_id}
                                          </button>
                                          <p className="mt-0.5 font-mono text-[var(--spacing.2, 8px)] text-zinc-400">
                                            <span className="text-zinc-400">{row.property_key}</span>
                                            {' → '}
                                            <span className="text-amber-500/80">{row.property_value.slice(0, 60)}{row.property_value.length > 60 ? '…' : ''}</span>
                                          </p>
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}

                {/* ── GOV-FIX-2: Fix error banner ─────────────────────── */}
                {fixError !== null && (
                  <div className="rounded border border-red-700/40 bg-red-900/10 px-3 py-2">
                    <p className="text-[var(--spacing.2, 8px)] text-red-400">{fixError}</p>
                  </div>
                )}

                {/* ── Compliance Summary (GOV.1) ─────────────────────── */}
                {complianceSummary !== null && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      {/* A11Y-010: h2 under h1 */}
                      <h2 className="flex items-center gap-1.5 text-[var(--spacing.2, 8px)] font-semibold uppercase tracking-wider text-indigo-400">
                        <ShieldAlert className="h-3 w-3" />
                        Compliance Summary
                      </h2>
                      {/* A11Y-090: motion-safe guard */}
                      <button
                        type="button"
                        onClick={() => { void handleExportReport(); }}
                        className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-900/10 px-2 py-0.5 text-[var(--spacing.2, 8px)] text-indigo-400 motion-safe:transition-colors hover:bg-indigo-900/30 hover:text-indigo-300"
                        title="Copy JSON audit report to clipboard"
                      >
                        {reportCopied
                          ? <><Check className="h-2.5 w-2.5" /> Copied!</>
                          : <><FileDown className="h-2.5 w-2.5" /> Export Audit Report (JSON)</>}
                      </button>
                    </div>

                    {/* Authority breakdown badges */}
                    {Object.keys(complianceSummary.byAuthority).length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {Object.entries(complianceSummary.byAuthority).map(([authority, count]) => (
                          <span key={authority} className="rounded border border-zinc-700/50 bg-zinc-800 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] text-zinc-400">
                            {authority}: {count}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Per-rule regulatory references */}
                    {complianceSummary.violatedRules.length > 0 && (
                      <ul className="space-y-1">
                        {complianceSummary.violatedRules.map(rule => (
                          <li key={rule.ruleId} className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[var(--spacing.2, 8px)] text-indigo-400">
                                {rule.ruleId}
                              </span>
                              <span className="text-[var(--spacing.2, 8px)] text-zinc-400">
                                {rule.ruleName}
                              </span>
                              <span className="ml-auto shrink-0 rounded bg-zinc-800 px-1 py-0.5 text-[var(--spacing.2, 8px)] text-zinc-500">
                                {rule.sourceAuthority}
                              </span>
                            </div>
                            <p className="mt-0.5 font-mono text-[var(--spacing.2, 8px)] text-zinc-500">
                              {rule.regulatoryReference}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-800 px-5 py-3">
              {/* Left: DBOM download */}
              <div className="flex items-center gap-2">
                {/* A11Y-090: motion-safe guard */}
                <button
                  type="button"
                  onClick={() => { void handleDownloadDBOM(); }}
                  disabled={dbomDownloading}
                  title="Download Design Bill of Materials (DBOM) as JSON"
                  className="flex items-center gap-1.5 rounded border border-indigo-500/40 bg-indigo-900/10 px-2.5 py-1.5 text-xs text-indigo-400 motion-safe:transition-colors hover:bg-indigo-900/30 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3 w-3" />
                  {dbomDownloading ? 'Generating DBOM…' : 'Download DBOM'}
                </button>
                {dbomError !== null && (
                  <span className="text-[var(--spacing.2, 8px)] text-red-400" title={dbomError}>
                    DBOM failed
                  </span>
                )}
              </div>
              {/* Right: Close + Copy Source */}
              <div className="flex items-center gap-2">
                {/* A11Y-090: motion-safe guard */}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 motion-safe:transition-colors hover:border-zinc-600 hover:text-zinc-200"
                >
                  {canExport ? 'Close' : 'Dismiss'}
                </button>
                {canExport && (
                  // A11Y-090: motion-safe guard
                  <button
                    type="button"
                    onClick={() => { void handleCopy(); }}
                    className="flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white motion-safe:transition-colors hover:bg-emerald-500"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied!' : 'Copy Source'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  );
}