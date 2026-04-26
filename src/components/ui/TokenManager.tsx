/**
 * TokenManager — src/components/ui/TokenManager.tsx
 *
 * MINT.1: Token Experience Foundation
 *
 * Read-only governance palette for viewing design tokens.
 * Token values are managed through your design system via MCP tools
 * (flint_approve_tokens, flint_sync_tokens) — not directly in this UI.
 *
 * MINT.1a — Token Health Bar (total, sync, coverage)
 * MINT.1b — Visual Token Grid (swatches, specimens, rulers)
 * MINT.1c — Mode Columns (light/dark side-by-side)
 * MINT.1d — Dangerous actions removed (read-only, no delete/clear/edit)
 * MINT.1e — Accessibility (aria-labels, keyboard, grid semantics)
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Upload, X, Search, LayoutGrid, List, Eye, AlertTriangle } from 'lucide-react';
import { useTokenStore } from '../../store/tokenStore';
import { useNotificationStore } from '../../store/notificationStore';
import type { DesignToken, TokenType, FigmaStatus, TokenUsageResult, ContrastPair, PendingToken } from '../../types/flint-api';
import { FocusTrap } from './FocusTrap';
import { TokenHealthBar } from './TokenHealthBar';
import { TokenGroupSection, TokenDriftView, type ViewMode, type SyncBadgeStatus } from './TokenGrid';
import { useTokenUsage } from '../../hooks/useTokenUsage';
import { useTokenHealth } from '../../hooks/useTokenHealth';
import { ContrastAuditPanel } from './ContrastAuditPanel';
import { ApprovalStagingArea } from './ApprovalStagingArea';
import { FirstSyncPrompt } from './FirstSyncPrompt';
import { TokenDetailPanel } from './TokenDetailPanel';
// MINT.5 Phase 2 — sync action surfaces
import { useSyncActions } from '../../hooks/useSyncActions';
import { ConfirmPushDialog } from './mint/ConfirmPushDialog';
import { ConfirmResolveDialog } from './mint/ConfirmResolveDialog';
import { ConnectFigmaEmptyState } from './mint/ConnectFigmaEmptyState';
import type { ResolveStrategy } from '../../../.flint-context/contracts/MINT.5-phase2.contract';
// MINT.5 Phase 3 — emit + staleness surfaces
import { SyncStalenessBanner } from './mint/SyncStalenessBanner';
import { ConfirmEmitDialog } from './mint/ConfirmEmitDialog';
import { useEmitTokens } from '../../hooks/useEmitTokens';
import { useSyncStaleness } from '../../hooks/useSyncStaleness';
import { useSyncStalenessStore } from '../../store/syncStalenessStore';
import type { EmitPlatform, EmitMode } from '../../../.flint-context/contracts/MINT.5-phase3.contract';

// ── Import Modal ──────────────────────────────────────────────────────────────

interface ImportModalProps {
  onClose: () => void;
  onImport: (json: string, collectionName: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}
function ImportModal({
  onClose,
  onImport,
  isLoading,
  error
}: ImportModalProps) {
  const [json, setJson] = useState('');
  const [collectionName, setCollectionName] = useState('Imported');
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!json.trim()) return;
    await onImport(json, collectionName);
    if (!error) onClose();
  }
  return /* Backdrop */<div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-8" onClick={onClose}>
            <FocusTrap>
            {/* Modal */}
            <div role="dialog" aria-modal="true" aria-labelledby="import-modal-title" className="mx-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <span id="import-modal-title" className="text-sm font-semibold text-zinc-200">Import Token File (JSON)</span>
                    <button type="button" onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" aria-label="Close import dialog">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
                    {/* Collection name */}
                    <div>
                        <label className="mb-1 block text-[var(--spacing.2, 8px)] font-medium uppercase tracking-wider text-zinc-500">
                            Collection name
                        </label>
                        <input value={collectionName} onChange={e => setCollectionName(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none" aria-label="Collection name for imported tokens" aria-invalid="true" />
                    </div>

                    {/* JSON textarea */}
                    <div>
                        <label className="mb-1 block text-[var(--spacing.2, 8px)] font-medium uppercase tracking-wider text-zinc-500">
                            Paste W3C Token File (JSON)
                        </label>
                        <textarea value={json} onChange={e => setJson(e.target.value)} rows={8} spellCheck={false} placeholder={'{\n  "color": {\n    "brand": {\n      "primary": { "$value": "#0066FF", "$type": "color" }\n    }\n  }\n}'} className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-2 py-2 font-mono text-[var(--spacing.3, 12px)] text-zinc-200 placeholder:text-zinc-700 focus:border-indigo-500 focus:outline-none" aria-label="Paste W3C DTCG JSON token file" />
                    </div>

                    {error && <p className="rounded bg-red-900/30 px-2 py-1.5 text-[var(--spacing.3, 12px)] text-red-400" role="alert">
                            {error}
                        </p>}

                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="flex-1 rounded border border-zinc-700 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800">
                            Cancel
                        </button>
                        <button type="submit" disabled={!json.trim() || isLoading} className="flex-1 rounded bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
                            {isLoading ? 'Importing\u2026' : 'Import'}
                        </button>
                    </div>
                </form>
            </div>
            </FocusTrap>
        </div>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function TokenManager() {
  const {
    tokens,
    isLoading,
    error,
    fetchTokens,
    importTokensJSON
  } = useTokenStore();

  // Mint code review M2/M3 (2026-04-17): unmount guard for async setState
  // chains in fetchFigmaState / fetchUsage / fetchPendingApprovals.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fire a toast whenever the store surfaces a new error
  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      useNotificationStore.getState().push({
        type: 'error',
        severity: 'warning',
        title: 'Token operation failed',
        message: error,
        autoDismissMs: 5000
      });
    }
    prevErrorRef.current = error;
  }, [error]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // View mode (MINT.1b)
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Import modal
  const [showImport, setShowImport] = useState(false);

  // MINT.1a: Usage data
  const [usageResults, setUsageResults] = useState<TokenUsageResult[]>([]);

  // MINT.2b: Filter/sort controls
  const [showDeadOnly, setShowDeadOnly] = useState(false);
  const [sortByUsage, setSortByUsage] = useState(false);

  // MINT.3a: Contrast audit state (cached after first run)
  const [contrastData, setContrastData] = useState<ContrastPair[] | null>(null);
  const [isContrastLoading, setIsContrastLoading] = useState(false);
  const [showContrastPanel, setShowContrastPanel] = useState(false);

  // MINT.3c: Approval staging state
  const [pendingTokens, setPendingTokens] = useState<PendingToken[]>([]);
  const [isPendingLoading, setIsPendingLoading] = useState(false);

  // S7.2: Figma connection state + figma tokens for sync badges
  const [figmaConnected, setFigmaConnected] = useState(false);
  const [figmaTokens, setFigmaTokens] = useState<Map<string, string>>(new Map());

  // MINT.4d: Selected token for detail panel
  const [selectedToken, setSelectedToken] = useState<DesignToken | null>(null);

  // MINT.4a: Project path for first-sync dismissal persistence
  const [projectPath, setProjectPath] = useState('');

  // MINT.5 Phase 2 §2.4 — Confirm dialog state (Push + Resolve).
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  // Track which row is currently pulling for per-row spinner.
  const [currentPullingPath, setCurrentPullingPath] = useState<string | null>(null);

  // MINT.5 Phase 3 §3.1 — Emit confirm dialog state.
  const [emitDialogOpen, setEmitDialogOpen] = useState(false);
  // Pending emit request: platforms staged while the confirm dialog is open.
  const [pendingEmitPlatforms, setPendingEmitPlatforms] = useState<EmitPlatform[]>([]);
  // Default output dir — shown in the confirm dialog. The tool resolves the
  // real path on the main side; we surface a sensible default in the UI.
  const emitOutputDir = `${projectPath || '.'}/.flint/platform-tokens`;

  // MINT.5 Phase 2 consensus FIX-1 — sourced from flint_sync_check.
  // localEditCount derives from the SyncCheckReport's tokensDrifted when the
  // recommendation is 'push_needed' (locally modified but no remote
  // connection). pendingConflictCount mirrors report.pendingConflicts.
  // These feed the Push and Resolve button disabled states and the confirm
  // dialog copy. If flint_sync_check is unavailable or errors, we default
  // to { 0, 0 } so the Push/Resolve buttons render disabled — safe fallback.
  const [syncCheckCounts, setSyncCheckCounts] = useState<{
    localEditCount: number;
    pendingConflictCount: number;
  }>({
    localEditCount: 0,
    pendingConflictCount: 0
  });

  // MINT.3a: Run contrast audit (cached)
  const runContrastAudit = useCallback(async () => {
    if (!window.flintAPI.tokens.auditContrast) return;
    setIsContrastLoading(true);
    try {
      const results = await window.flintAPI.tokens.auditContrast();
      setContrastData(results);
      setShowContrastPanel(true);
    } catch (err) {
      useNotificationStore.getState().push({
        type: 'error',
        severity: 'warning',
        title: 'Contrast audit failed',
        message: String(err),
        autoDismissMs: 5000
      });
    } finally {
      setIsContrastLoading(false);
    }
  }, []);

  // MINT.3c: Fetch pending approvals
  const fetchPendingApprovals = useCallback(async () => {
    if (!window.flintAPI.tokens.getPendingApprovals) return;
    setIsPendingLoading(true);
    try {
      const pending = await window.flintAPI.tokens.getPendingApprovals();
      if (mountedRef.current) setPendingTokens(pending);
    } catch {
      // Graceful degradation — pending approvals not available
    } finally {
      if (mountedRef.current) setIsPendingLoading(false);
    }
  }, []);

  // MINT.3c: Approve a single token
  const handleApproveToken = useCallback(async (tokenName: string) => {
    if (!window.flintAPI.tokens.approveToken) return;
    await window.flintAPI.tokens.approveToken(tokenName);
    setPendingTokens(prev => prev.filter(t => t.name !== tokenName));
    // Refresh tokens after approval
    fetchTokens().catch(console.error);
  }, [fetchTokens]);

  // MINT.3c: Reject a single token
  const handleRejectToken = useCallback(async (tokenName: string) => {
    if (!window.flintAPI.tokens.rejectToken) return;
    await window.flintAPI.tokens.rejectToken(tokenName);
    setPendingTokens(prev => prev.filter(t => t.name !== tokenName));
  }, []);

  // MINT.3c: Approve all pending tokens
  const handleApproveAll = useCallback(async () => {
    if (!window.flintAPI.tokens.approveToken) return;
    for (const token of pendingTokens) {
      await window.flintAPI.tokens.approveToken(token.name);
    }
    setPendingTokens([]);
    fetchTokens().catch(console.error);
  }, [pendingTokens, fetchTokens]);

  // MINT.3c: Reject all pending tokens
  const handleRejectAll = useCallback(async () => {
    if (!window.flintAPI.tokens.rejectToken) return;
    for (const token of pendingTokens) {
      await window.flintAPI.tokens.rejectToken(token.name);
    }
    setPendingTokens([]);
  }, [pendingTokens]);
  const fetchFigmaState = useCallback(() => {
    window.flintAPI.figma?.status().then((status: FigmaStatus) => {
      if (!mountedRef.current) return;
      const connected = status.running && (status.tokenCount ?? 0) > 0;
      setFigmaConnected(connected);
      if (connected) {
        // Read figma-tokens.json via MCP readResource
        window.flintAPI.mcp?.readResource?.('flint://tokens').then(text => {
          if (!mountedRef.current) return;
          try {
            const data = typeof text === 'string' ? JSON.parse(text) : text;
            const map = new Map<string, string>();
            // Parse flat token map or nested DTCG structure
            if (data && typeof data === 'object') {
              const entries = Array.isArray(data) ? data : Object.entries(data);
              for (const entry of entries) {
                if (Array.isArray(entry)) {
                  const [key, val] = entry;
                  map.set(String(key), typeof val === 'object' && val?.$value ? String(val.$value) : String(val));
                } else if (entry && typeof entry === 'object' && entry.token_path) {
                  map.set(String(entry.token_path), String(entry.token_value ?? ''));
                }
              }
            }
            setFigmaTokens(map);
          } catch (err) {
            console.warn('[Flint] TokenManager: failed to parse Figma token data', err);
          }
        }).catch(err => console.warn('[Flint] TokenManager: Figma sync check MCP call failed', err));
      }
    }).catch(() => {
      if (mountedRef.current) setFigmaConnected(false);
    });
  }, []);

  // MINT.1a: Fetch usage data
  const fetchUsage = useCallback(() => {
    window.flintAPI.tokens.scanUsage?.().then(results => {
      if (mountedRef.current && results) setUsageResults(results);
    }).catch(() => {
      // scanUsage not available — graceful degradation
    });
  }, []);

  // MINT.2a-2d: Token usage intelligence hook (single scan, cached)
  const localTokensForDrift = useMemo(() => tokens.map(t => ({
    token_path: t.token_path,
    token_value: t.token_value
  })), [tokens]);
  const {
    usageMap,
    deadTokenCount,
    driftedTokens,
  } = useTokenUsage(tokens.length, localTokensForDrift);

  // MINT.5 Phase 2 consensus FIX-7 (UX WARN-4) — Auto-revert removed.
  // Previously this effect silently swapped viewMode from 'drift' to 'grid'
  // when driftedTokens emptied out, which stranded the user in a new view
  // without any narration. The replacement: the drift radio stays visible
  // while the user is in drift view even after the count drops to 0, so the
  // DriftGroupSection can render its own "No drift detected" empty state
  // and the user picks when to leave. Once the user navigates away, the
  // radio hides again per the existing render gate (driftedTokens.length > 0
  // OR viewMode === 'drift').

  // MINT.5 §1.3 — Canonical health score via useTokenHealth.
  // Feeds TokenHealthBar with grade + score + bucket counts.
  const tokenHealth = useTokenHealth();

  // MINT.5 Phase 2 consensus FIX-1 — Fetch local edit + pending conflict
  // counts from flint_sync_check. Called on mount, when figmaConnected
  // changes, and whenever drift changes (pull completes, new drift detected).
  // MCP returns a JSON body we parse defensively — any shape mismatch falls
  // back to the safe { 0, 0 } default.
  const fetchSyncCheckCounts = useCallback(async () => {
    const callTool = window.flintAPI?.mcp?.callTool;
    if (typeof callTool !== 'function') return;
    try {
      const result = (await callTool('flint_sync_check', {})) as {
        isError?: boolean;
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      } | undefined;
      if (!result || result.isError === true) {
        if (mountedRef.current) {
          setSyncCheckCounts({
            localEditCount: 0,
            pendingConflictCount: 0
          });
        }
        return;
      }
      // The tool returns two content entries: a summary string and a
      // JSON body. Find the JSON body and parse.
      const body = result.content?.find(c => {
        const t = c?.text ?? '';
        return typeof t === 'string' && t.trim().startsWith('{');
      })?.text;
      if (typeof body !== 'string') return;
      const parsed = JSON.parse(body) as {
        pendingConflicts?: unknown;
        tokensDrifted?: unknown;
        recommendation?: unknown;
      };
      const pending = typeof parsed.pendingConflicts === 'number' && Number.isFinite(parsed.pendingConflicts) ? Math.max(0, Math.trunc(parsed.pendingConflicts)) : 0;
      // tokensDrifted represents local changes awaiting push ONLY when the
      // engine recommends push_needed. Otherwise they are remote drifts
      // that Pull covers — not local edits.
      const drifted = typeof parsed.tokensDrifted === 'number' && Number.isFinite(parsed.tokensDrifted) ? Math.max(0, Math.trunc(parsed.tokensDrifted)) : 0;
      const localEdits = parsed.recommendation === 'push_needed' ? drifted : 0;
      if (mountedRef.current) {
        setSyncCheckCounts({
          localEditCount: localEdits,
          pendingConflictCount: pending
        });
      }
    } catch {
      // Graceful degradation — keep previous counts on parse/IPC failure.
      if (mountedRef.current) {
        setSyncCheckCounts({
          localEditCount: 0,
          pendingConflictCount: 0
        });
      }
    }
  }, []);

  // MINT.5 Phase 2 §2.1 — useSyncActions owns the sync ops lifecycle.
  // Destructive actions are guarded by dialogs; we pass no confirmPush/
  // confirmResolve callbacks here because the dialogs are driven by open-state
  // and resolve *after* user confirms via onConfirm handlers below.
  const syncActions = useSyncActions({
    onAfterSync: useCallback(() => {
      fetchTokens().catch(console.error);
      // Re-read sync check counts after any successful sync action so
      // the Push/Resolve buttons update immediately.
      fetchSyncCheckCounts().catch(() => {/* degrade silently */});
    }, [fetchTokens, fetchSyncCheckCounts])
  });

  // Re-read sync-check counts when connection state or drift set changes.
  useEffect(() => {
    fetchSyncCheckCounts().catch(() => {/* degrade silently */});
  }, [fetchSyncCheckCounts, figmaConnected, driftedTokens.length]);

  // MINT.5 Phase 3 §3.1 — Emit tokens hook.
  // Write mode is handled via the ConfirmEmitDialog open/close cycle; we do
  // not pass a confirmWrite callback here because confirmation is driven at the
  // component layer (onEmit→setEmitDialogOpen→handleEmitConfirm→emit).
  const {
    emitOp,
    emit
  } = useEmitTokens();

  // MINT.5 Phase 3 §3.2 — Sync staleness hook.
  // Polls flint_sync_check every 60s while figmaConnected. Enabled only when
  // Figma is connected (no point in showing "stale" when there's no sync source).
  const syncStaleness = useSyncStaleness({
    projectRoot: projectPath,
    enabled: figmaConnected
  });
  const dismissedAt = useSyncStalenessStore(s => s.dismissedAt);
  const isDismissed = dismissedAt !== null;
  useEffect(() => {
    fetchTokens().catch(console.error);
    fetchFigmaState();
    fetchUsage();
    fetchPendingApprovals();
    // MINT.4a: Resolve project path for first-sync dismissal
    window.flintAPI.mcp?.readResource?.('flint://session-context').then(text => {
      try {
        const ctx = typeof text === 'string' ? JSON.parse(text) : text;
        if (ctx?.projectPath) setProjectPath(String(ctx.projectPath));
      } catch {/* ignore */}
    }).catch(() => {/* graceful degradation */});
  }, [fetchTokens, fetchFigmaState, fetchUsage, fetchPendingApprovals]);

  // S7.2: Compute sync status for each token
  const getSyncStatus = useCallback((token: DesignToken): SyncBadgeStatus | null => {
    if (!figmaConnected || figmaTokens.size === 0) return null;
    const figmaValue = figmaTokens.get(token.token_path);
    if (figmaValue === undefined) return 'local-only';
    if (figmaValue === token.token_value) return 'synced';
    return 'drifted';
  }, [figmaConnected, figmaTokens]);

  // MINT.5 §1.2: The syncStatuses array that previously fed TokenHealthBar's drift
  // pill has been removed. Drift count authority now belongs to useTokenUsage
  // (surfaced via tokenHealth.buckets.drifted). getSyncStatus is preserved because
  // TokenGroupSection still uses it for per-row SyncBadge rendering in TokenGrid.

  const usageFileCount = useMemo(() => {
    const allFiles = new Set<string>();
    for (const r of usageResults) {
      for (const f of r.files) {
        allFiles.add(f);
      }
    }
    return allFiles.size;
  }, [usageResults]);

  // MINT.5 Phase 2 §2.2 — Build the tokensByPath lookup required by
  // DriftGroupSection. Keyed on token_path so rows can join to a DesignToken
  // for type+collection metadata.
  const tokensByPath = useMemo(() => {
    const map = new Map<string, {
      token_path: string;
      token_type: string;
      collection_name: string;
    }>();
    for (const t of tokens) {
      map.set(t.token_path, {
        token_path: t.token_path,
        token_type: t.token_type,
        collection_name: t.collection_name
      });
    }
    return map;
  }, [tokens]);

  // MINT.5 Phase 2 §2.4 — Sync cluster handlers.
  // Push and Resolve open confirm dialogs; Pull fires immediately (additive).
  const handlePull = useCallback(() => {
    syncActions.pull();
  }, [syncActions]);
  const handlePush = useCallback(() => {
    setPushDialogOpen(true);
  }, []);
  const handleResolve = useCallback(() => {
    setResolveDialogOpen(true);
  }, []);
  const handleConnect = useCallback(() => {
    syncActions.connect();
  }, [syncActions]);

  // Push dialog confirm → fire push, close dialog.
  const handlePushConfirm = useCallback(async () => {
    setPushDialogOpen(false);
    await syncActions.push();
  }, [syncActions]);

  // Resolve dialog confirm → fire resolve with chosen strategy, close dialog.
  const handleResolveConfirm = useCallback(async (strategy: ResolveStrategy) => {
    setResolveDialogOpen(false);
    await syncActions.resolve(strategy);
  }, [syncActions]);

  // MINT.5 Phase 3 §3.1 — Emit dropdown handler.
  // For 'preview' mode: call emit immediately (read-shaped, no confirmation).
  // For 'write' mode: stage the platforms and open the confirm dialog.
  const handleEmit = useCallback((platforms: EmitPlatform[], mode: EmitMode) => {
    if (mode === 'preview') {
      emit(platforms, 'preview').catch(console.error);
    } else {
      // Stage write request and show confirm dialog.
      setPendingEmitPlatforms(platforms);
      setEmitDialogOpen(true);
    }
  }, [emit]);

  // Emit confirm: user confirmed write-to-disk — call emit with write mode.
  const handleEmitConfirm = useCallback(async () => {
    setEmitDialogOpen(false);
    await emit(pendingEmitPlatforms, 'write');
    setPendingEmitPlatforms([]);
  }, [emit, pendingEmitPlatforms]);

  // Emit cancel: user dismissed the confirm dialog.
  const handleEmitCancel = useCallback(() => {
    setEmitDialogOpen(false);
    setPendingEmitPlatforms([]);
  }, []);

  // Drift row Pull-this handler. Marks the row-local pulling state so the
  // DriftGroupSection can show a spinner on the correct row.
  const handlePullOne = useCallback(async (tokenPath: string) => {
    setCurrentPullingPath(tokenPath);
    try {
      await syncActions.pullOne(tokenPath);
    } finally {
      setCurrentPullingPath(null);
    }
  }, [syncActions]);

  // Drift row onSelect → open the token detail panel when the row activates.
  const handleDriftRowSelect = useCallback((tokenPath: string) => {
    const found = tokens.find(t => t.token_path === tokenPath);
    if (found) setSelectedToken(found);
  }, [tokens]);

  // Search-filtered token list (MINT.2b: dead-only filter + usage sort)
  const filteredTokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = tokens;

    // Text search
    if (q) {
      result = result.filter(t => t.token_path.toLowerCase().includes(q) || t.token_value.toLowerCase().includes(q) || t.token_type.toLowerCase().includes(q));
    }

    // MINT.2b: Dead token filter
    if (showDeadOnly && usageMap.size > 0) {
      result = result.filter(t => {
        const usage = usageMap.get(t.token_path);
        return !usage || usage.usageCount === 0;
      });
    }

    // MINT.2b: Sort by usage (ascending — dead tokens first)
    if (sortByUsage && usageMap.size > 0) {
      result = [...result].sort((a, b) => {
        const aCount = usageMap.get(a.token_path)?.usageCount ?? 0;
        const bCount = usageMap.get(b.token_path)?.usageCount ?? 0;
        return aCount - bCount;
      });
    }
    return result;
  }, [tokens, searchQuery, showDeadOnly, sortByUsage, usageMap]);

  // Group: collection_name -> token_type -> tokens[]
  const grouped = useMemo(() => {
    const map = new Map<string, Map<TokenType, DesignToken[]>>();
    for (const token of filteredTokens) {
      if (!map.has(token.collection_name)) {
        map.set(token.collection_name, new Map());
      }
      const byType = map.get(token.collection_name)!;
      if (!byType.has(token.token_type)) {
        byType.set(token.token_type, []);
      }
      byType.get(token.token_type)!.push(token);
    }
    return map;
  }, [filteredTokens]);

  // All tokens by collection (for mode pairing)
  const tokensByCollection = useMemo(() => {
    const map = new Map<string, DesignToken[]>();
    for (const token of filteredTokens) {
      if (!map.has(token.collection_name)) {
        map.set(token.collection_name, []);
      }
      map.get(token.collection_name)!.push(token);
    }
    return map;
  }, [filteredTokens]);

  // MINT.3a/3b: Build contrast map for inline badges (token_path -> pairs[])
  const contrastMap = useMemo(() => {
    if (!contrastData || contrastData.length === 0) return undefined;
    const map = new Map<string, ContrastPair[]>();
    for (const pair of contrastData) {
      // Index by foreground token
      if (!map.has(pair.fg)) map.set(pair.fg, []);
      map.get(pair.fg)!.push(pair);
    }
    return map;
  }, [contrastData]);

  // MINT.3a: Check if auditContrast is available
  const contrastAvailable = !!window.flintAPI.tokens.auditContrast;

  // MINT.3c: Compute drift warnings for pending tokens
  // (tokens whose value might cause Mithril drift violations)
  const pendingDriftWarnings = useMemo(() => {
    const warnings = new Set<string>();
    if (driftedTokens.length > 0 && pendingTokens.length > 0) {
      const driftedNames = new Set(driftedTokens.map(d => d.tokenName));
      for (const pt of pendingTokens) {
        if (driftedNames.has(pt.name)) warnings.add(pt.name);
      }
    }
    return warnings;
  }, [driftedTokens, pendingTokens]);

  // ── Render ──────────────────────────────────────────────────────────────

  return <div className="relative flex h-full flex-col text-zinc-300">
            {/* ── Toolbar ──────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <span className="text-[var(--spacing.2, 8px)] font-medium uppercase tracking-wider text-zinc-400">
                    {tokens.length} token{tokens.length !== 1 ? 's' : ''}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                    {/* MINT.1b / MINT.5 Phase 2 §2.2: View mode toggle.
                        Includes 'drift' tab when drift exists. Drift tab badge
                        count equals driftedTokens.length. The drift radio is
                        hidden when drift count is 0 (matches nonGoal: only the
                        auto-revert is added; no empty drift tab surface). */}
                    <div className="flex items-center rounded border border-zinc-700 bg-zinc-800/60" role="radiogroup" aria-label="Token view mode">
                        <button type="button" onClick={() => setViewMode('grid')} className={`rounded-l px-1.5 py-1 transition-colors ${viewMode === 'grid' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`} role="radio" aria-checked={viewMode === 'grid'} aria-label="Grid view">
                            <LayoutGrid className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => setViewMode('list')} className={`${driftedTokens.length > 0 || viewMode === 'drift' ? '' : 'rounded-r'} px-1.5 py-1 transition-colors ${viewMode === 'list' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`} role="radio" aria-checked={viewMode === 'list'} aria-label="List view">
                            <List className="h-3 w-3" />
                        </button>
                        {/* FIX-7 (UX WARN-4): keep the drift radio visible while
                            the user is viewing drift, even after the drift count
                            falls to 0. Without this, clearing drift via Pull
                            silently strands the user in an empty-looking view. */}
                        {(driftedTokens.length > 0 || viewMode === 'drift') && <button type="button" onClick={() => setViewMode('drift')} className={`rounded-r flex items-center gap-1 px-1.5 py-1 transition-colors ${viewMode === 'drift' ? 'bg-amber-600/20 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'}`} role="radio" aria-checked={viewMode === 'drift'} aria-label={`Drift (${driftedTokens.length})`} data-testid="viewmode-drift-radio">
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                <span className="text-[var(--spacing.2, 8px)] font-medium">
                                    Drift
                                </span>
                                <span className="inline-flex min-w-[14px] items-center justify-center rounded-full bg-amber-500/30 px-1 text-[var(--spacing.2, 8px)] font-semibold text-amber-200" data-testid="viewmode-drift-badge">
                                    {driftedTokens.length}
                                </span>
                            </button>}
                    </div>

                    {/* MINT.3a: Contrast audit button */}
                    <button type="button" onClick={contrastAvailable ? runContrastAudit : undefined} disabled={!contrastAvailable || isContrastLoading} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[var(--spacing.3, 12px)] text-zinc-400 transition-colors hover:border-indigo-500 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Run contrast audit" title={contrastAvailable ? 'Audit color tokens for WCAG contrast compliance' : 'Contrast audit requires token data'} data-testid="contrast-audit-button">
                        <Eye className="h-3 w-3" />
                        Contrast
                    </button>

                    <button type="button" onClick={() => setShowImport(true)} className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[var(--spacing.3, 12px)] text-zinc-400 transition-colors hover:border-indigo-500 hover:text-indigo-300">
                        <Upload className="h-3 w-3" />
                        Import JSON
                    </button>
                </div>
            </div>

            {/* ── MINT.4a: First Sync Prompt ─────────────────────────────── */}
            <FirstSyncPrompt figmaConnected={figmaConnected} tokenCount={tokens.length} projectPath={projectPath} onNavigateToTokens={() => {
      // Already on the tokens tab — scroll to top
      const scrollEl = document.querySelector('[data-testid="token-scroll-container"]');
      scrollEl?.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }} />

            {/* ── MINT.5 Phase 3 §3.2 — Sync staleness banner.
                Rendered above the health bar so it reads as a top-level alert,
                not a sub-element of the health summary. Renderless when not
                stale, not connected, or dismissed this session. */}
            {figmaConnected && <div className="px-3 pt-2" data-testid="staleness-banner-wrapper">
                    <SyncStalenessBanner isStale={syncStaleness.isStale} isDismissed={isDismissed} hoursSinceSync={syncStaleness.hoursSinceSync ?? 0} onPull={handlePull} onDismiss={syncStaleness.dismiss} />
                </div>}

            {/* ── MINT.1a: Health Bar ─────────────────────────────────────── */}
            {tokens.length > 0 && <TokenHealthBar totalTokens={tokens.length} figmaConnected={figmaConnected} usageFileCount={usageFileCount} health={tokenHealth}
    /* FIX-1 (UX BLK-1 / Code WARN-2): real localEditCount +
       pendingConflictCount from flint_sync_check. */ localEditCount={syncCheckCounts.localEditCount} pendingConflictCount={syncCheckCounts.pendingConflictCount} syncOp={syncActions.syncOp}
    /* FIX-2 (UX BLK-2): forward lastError so the bar can render
       a persistent SeverityChip on auth-expired errors. */ lastError={syncActions.lastError} onPull={handlePull} onPush={handlePush} onResolve={handleResolve} onConnect={handleConnect}
    /* MINT.5 Phase 3 §3.1 — Emit cluster props. */ emitOp={emitOp} onEmit={handleEmit} />}

            {/* ── Search bar (MINT.1e: aria-label) ────────────────────────── */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800/60 px-3 py-1.5">
                <Search size={10} className="shrink-0 text-zinc-500" aria-hidden="true" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, value, or type\u2026" aria-label="Search tokens by name, value, or type" className="flex-1 bg-transparent font-mono text-[var(--spacing.3, 12px)] text-zinc-300 placeholder-zinc-700 outline-none" aria-invalid="true" />
                {searchQuery && <span className="shrink-0 text-[var(--spacing.2, 8px)] text-zinc-500" aria-live="polite">
                        {filteredTokens.length}/{tokens.length}
                    </span>}
                {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="shrink-0 text-[var(--spacing.2, 8px)] text-zinc-500 hover:text-zinc-300" aria-label="Clear search">
                        <X size={10} />
                    </button>}
            </div>

            {/* ── MINT.2b: Usage filter/sort controls ────────────────────── */}
            {usageMap.size > 0 && <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800/60 px-3 py-1.5" data-testid="usage-controls">
                    <label className="flex items-center gap-1.5 text-[var(--spacing.2, 8px)] text-zinc-400">
                        <input type="checkbox" checked={showDeadOnly} onChange={e => setShowDeadOnly(e.target.checked)} className="h-3 w-3 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-1 focus:ring-red-400" aria-label="Show dead tokens only" aria-invalid="true" />
                        Dead only
                        {deadTokenCount > 0 && <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[var(--spacing.2, 8px)] font-medium text-red-400">
                                {deadTokenCount}
                            </span>}
                    </label>
                    <label className="flex items-center gap-1.5 text-[var(--spacing.2, 8px)] text-zinc-400">
                        <input type="checkbox" checked={sortByUsage} onChange={e => setSortByUsage(e.target.checked)} className="h-3 w-3 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-1 focus:ring-indigo-400" aria-label="Sort by usage count" aria-invalid="true" />
                        Sort by usage
                    </label>
                </div>}

            {/* ── MINT.3c: Approval Staging Area ─────────────────────────── */}
            {!isLoading && (pendingTokens.length > 0 || isPendingLoading) && <ApprovalStagingArea pendingTokens={pendingTokens} isLoading={isPendingLoading} onApprove={handleApproveToken} onReject={handleRejectToken} onApproveAll={handleApproveAll} onRejectAll={handleRejectAll} driftWarnings={pendingDriftWarnings} />}

            {/* ── Token list/grid ──────────────────────────────────────────── */}
            <div className="min-h-0 flex-1 overflow-y-auto" data-testid="token-scroll-container">
                {isLoading && <p className="px-3 py-6 text-center text-xs text-zinc-500">Loading\u2026</p>}

                {!isLoading && tokens.length > 0 && filteredTokens.length === 0 && <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <Search className="h-5 w-5 text-zinc-600" aria-hidden="true" />
                        <p className="text-xs text-zinc-500">No tokens match</p>
                        <p className="text-[var(--spacing.2, 8px)] text-zinc-400">Try a different search term</p>
                    </div>}

                {!isLoading && tokens.length === 0 && (
      /* MINT.5 Phase 2 §2.3 — ConnectFigmaEmptyState replaces
         the old tokens-empty-state block. The component itself
         decides which variant to render (disconnected / connected-
         no-tokens / has-tokens returns null). */
      <div data-testid="tokens-empty-state">
                        <ConnectFigmaEmptyState figmaConnected={figmaConnected} tokenCount={tokens.length} syncOp={syncActions.syncOp} onConnect={handleConnect} onPullFromFigma={handlePull} onOpenImport={() => setShowImport(true)} />
                    </div>)}

                {/* MINT.5 Phase 2 §2.2 — Drift sub-tab routing.
                    When viewMode === 'drift', render TokenDriftView instead of
                    TokenGroupSection. The view groups drifted tokens by
                    collection internally. */}
                {viewMode === 'drift' ? <TokenDriftView driftedTokens={driftedTokens} tokensByPath={tokensByPath} onPullOne={handlePullOne} onSelect={handleDriftRowSelect} currentPullingPath={currentPullingPath} /> : [...grouped.entries()].map(([collectionName, byType]) => <TokenGroupSection key={collectionName} collectionName={collectionName} byType={byType} viewMode={viewMode} getSyncStatus={getSyncStatus} figmaConnected={figmaConnected} allCollectionTokens={tokensByCollection.get(collectionName) ?? []} usageMap={usageMap} driftedTokens={driftedTokens} contrastMap={contrastMap} onTokenSelect={setSelectedToken} />)}

                {/* Store-level error (shown at bottom so it doesn't push content) */}
                {error && !showImport && <p className="border-t border-red-900/40 bg-red-900/10 px-3 py-2 text-[var(--spacing.3, 12px)] text-red-400" role="alert">
                        {error}
                    </p>}
            </div>

            {/* ── MINT.3a: Contrast Audit Panel ──────────────────────────── */}
            {showContrastPanel && <ContrastAuditPanel contrastData={contrastData} isLoading={isContrastLoading} onRunAudit={runContrastAudit} onClose={() => setShowContrastPanel(false)} />}

            {/* ── Import Modal ─────────────────────────────────────────────── */}
            {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={importTokensJSON} isLoading={isLoading} error={error} />}

            {/* ── MINT.4d: Token Detail Panel ─────────────────────────────── */}
            {selectedToken && <TokenDetailPanel token={selectedToken} onClose={() => setSelectedToken(null)} usageResult={usageMap.get(selectedToken.token_path) ?? null} drift={driftedTokens.find(d => d.tokenName === selectedToken.token_path) ?? null} syncStatus={getSyncStatus(selectedToken)} contrastPairs={contrastMap?.get(selectedToken.token_path)} />}

            {/* ── MINT.5 Phase 2 §2.4 — Confirm dialogs ────────────────────── */}
            <ConfirmPushDialog isOpen={pushDialogOpen} localEditCount={syncCheckCounts.localEditCount} onConfirm={handlePushConfirm} onCancel={() => setPushDialogOpen(false)} />
            <ConfirmResolveDialog isOpen={resolveDialogOpen} conflictCount={syncCheckCounts.pendingConflictCount} onConfirm={handleResolveConfirm} onCancel={() => setResolveDialogOpen(false)} />

            {/* ── MINT.5 Phase 3 §3.1 — Emit confirm dialog ───────────────── */}
            <ConfirmEmitDialog isOpen={emitDialogOpen} platforms={pendingEmitPlatforms} outputDir={emitOutputDir} onConfirm={handleEmitConfirm} onCancel={handleEmitCancel} />
        </div>;
}