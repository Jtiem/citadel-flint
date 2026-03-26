/**
 * ComponentScopePanel.tsx — Phase CR.4 + EN.3 + EN.4
 *
 * Visual scope editor rendered in the right sidebar when the "scope" tab
 * is active. Lets designers control which registered components the AI
 * orchestrator is allowed to use when generating code.
 *
 * EN.3 additions:
 *   - Enrichment state dots per component row (gray/amber/green)
 *   - Expandable draft review UI (description, usage example, a11y notes,
 *     composition notes, confidence badge, approve / dismiss actions)
 *   - Registry Health metric chip row below the summary chips
 *
 * EN.4 addition:
 *   - Discovery banner shown when >50% of components are bare (dismissible,
 *     one session only, with "Copy prompt" clipboard action)
 *
 * Data flow:
 *   mount → IPC scope:get-registry-and-scope + enrichment:get-drafts (parallel)
 *   checkbox toggle → optimistic UI update → debounced IPC scope:set-scope
 *   IPC failure → revert local state + notification
 *   approve/dismiss → optimistic local state update → IPC enrichment:approve
 *   IPC failure → revert + notification
 *
 * Mithril compliance:
 *   - No hardcoded hex colours — all classes use Flint token palette.
 *   - No arbitrary spacing — all spacing from the 4 px grid scale.
 *   - data-flint-id not required (panel is not canvas-selectable).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Copy, X } from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'
import type {
    ComponentScopeData,
    ComponentRegistryEntry,
    EnrichmentDraft,
    EnrichmentStats,
} from '../../types/flint-api'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Sort component names alphabetically, case-insensitive. */
function sortNames(names: string[]): string[] {
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

/**
 * Split a raw scope array into two groups:
 *   registered   — names that appear in the registry
 *   unregistered — names in scope that have no registry entry
 */
// partitionScope is reserved for future use — split scope into registered/unregistered groups
// function partitionScope(scope, registry) — see git history

/** Determine per-component enrichment dot state. */
type DotState = 'enriched' | 'draft' | 'bare'

function getDotState(
    entry: ComponentRegistryEntry,
    drafts: Record<string, EnrichmentDraft>,
    componentName: string,
): DotState {
    if (entry.description && entry.usageExample) return 'enriched'
    if (drafts[componentName]) return 'draft'
    return 'bare'
}

/** Compute health percentage (0–100). */
function healthPercent(stats: EnrichmentStats | null, registryCount: number): number {
    if (!stats || registryCount === 0) return 0
    return Math.round((stats.enriched / registryCount) * 100)
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface MetaBadgeProps {
    label: string
}
function MetaBadge({ label }: MetaBadgeProps) {
    return (
        <span className="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-500">
            {label}
        </span>
    )
}

interface EnrichmentDotProps {
    state: DotState
}
function EnrichmentDot({ state }: EnrichmentDotProps) {
    const colorClass =
        state === 'enriched'
            ? 'bg-emerald-500'
            : state === 'draft'
              ? 'bg-amber-500'
              : 'bg-zinc-600'
    const label =
        state === 'enriched' ? 'Enriched' : state === 'draft' ? 'Draft pending review' : 'Bare — no description'

    return (
        <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorClass}`}
            title={label}
            aria-label={label}
        />
    )
}

interface ConfidenceBadgeProps {
    confidence: EnrichmentDraft['confidence']
    usageFileCount: number
}
function ConfidenceBadge({ confidence, usageFileCount }: ConfidenceBadgeProps) {
    const colorClass =
        confidence === 'high'
            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-900/20'
            : confidence === 'medium'
              ? 'text-amber-400 border-amber-500/30 bg-amber-900/20'
              : 'text-red-400 border-red-700/40 bg-red-900/10'

    return (
        <span
            className={`rounded border px-1 py-0.5 text-[9px] ${colorClass}`}
        >
            {confidence} confidence · {usageFileCount} file{usageFileCount !== 1 ? 's' : ''}
        </span>
    )
}

// ── Draft Review Panel ────────────────────────────────────────────────────────

interface DraftReviewPanelProps {
    componentName: string
    draft: EnrichmentDraft
    onApprove: () => void
    onDismiss: () => void
}
function DraftReviewPanel({ componentName, draft, onApprove, onDismiss }: DraftReviewPanelProps) {
    return (
        <div
            className="mt-1 ml-6 rounded border border-amber-500/20 bg-amber-900/10 p-2 space-y-2"
            data-testid={`draft-review-${componentName}`}
        >
            {/* Description */}
            <p className="text-xs text-zinc-300">{draft.description}</p>

            {/* Usage example */}
            <pre className="overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400 font-mono whitespace-pre-wrap">
                {draft.usageExample}
            </pre>

            {/* Composition notes */}
            {draft.compositionNotes && (
                <p className="text-[10px] text-zinc-500">
                    <span className="text-zinc-400">Composition: </span>
                    {draft.compositionNotes}
                </p>
            )}

            {/* A11y notes */}
            {draft.a11yNotes && (
                <p className="text-[10px] text-zinc-500">
                    <span className="text-zinc-400">A11y: </span>
                    {draft.a11yNotes}
                </p>
            )}

            {/* Confidence + usage file count */}
            <ConfidenceBadge confidence={draft.confidence} usageFileCount={draft.usageFileCount} />

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
                <button
                    type="button"
                    onClick={onApprove}
                    className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                    Approve
                </button>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                    Dismiss
                </button>
            </div>
        </div>
    )
}

// ── Discovery Banner (EN.4) ───────────────────────────────────────────────────

const DISCOVERY_PROMPT = 'Enrich my component registry'

interface DiscoveryBannerProps {
    onDismiss: () => void
}
function DiscoveryBanner({ onDismiss }: DiscoveryBannerProps) {
    const [copied, setCopied] = useState(false)
    const pushNotification = useNotificationStore((s) => s.push)

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(DISCOVERY_PROMPT)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            pushNotification({
                type: 'error',
                title: 'Copy failed',
                message: 'Could not write to clipboard.',
                severity: 'error',
                autoDismissMs: 4000,
            })
        }
    }, [pushNotification])

    return (
        <div
            className="mx-3 mb-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3"
            data-testid="discovery-banner"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300">
                        Many components lack descriptions.
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">
                        Ask your AI:{' '}
                        <span className="font-mono text-zinc-400">
                            &quot;{DISCOVERY_PROMPT}&quot;
                        </span>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="shrink-0 p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label="Dismiss discovery banner"
                >
                    <X size={12} />
                </button>
            </div>
            <button
                type="button"
                onClick={() => void handleCopy()}
                className="mt-2 flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
                <Copy size={10} />
                {copied ? 'Copied!' : 'Copy prompt'}
            </button>
        </div>
    )
}

// ── Health Metric ─────────────────────────────────────────────────────────────

interface RegistryHealthChipProps {
    stats: EnrichmentStats | null
    registryCount: number
}
function RegistryHealthChip({ stats, registryCount }: RegistryHealthChipProps) {
    const pct = healthPercent(stats, registryCount)
    const pctColorClass =
        pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'

    const enriched = stats?.enriched ?? 0
    const draft = stats?.draft ?? 0
    const bare = stats?.bare ?? 0

    return (
        <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2 col-span-3">
            <div className="flex items-baseline gap-1">
                <span className="text-xs font-medium text-zinc-400">Registry Health:</span>
                <span
                    className={`text-xs font-bold ${pctColorClass}`}
                    data-testid="health-percentage"
                >
                    {pct}%
                </span>
            </div>
            <span className="text-[10px] text-zinc-600">
                {enriched} enriched / {draft} draft / {bare} bare
            </span>
        </div>
    )
}

// ── Component ────────────────────────────────────────────────────────────────

export function ComponentScopePanel() {
    // ── Local state ─────────────────────────────────────────────────────────
    const [data, setData] = useState<ComponentScopeData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    /**
     * Local scope mirrors data.scope but updates optimistically.
     * null = "All Components" mode; string[] = "Restricted" mode.
     */
    const [localScope, setLocalScope] = useState<string[] | null>(null)

    /** Controls whether the debounce timer is active (shown as a save dot). */
    const [saving, setSaving] = useState(false)

    /** EN.3: Enrichment drafts keyed by component name. */
    const [drafts, setDrafts] = useState<Record<string, EnrichmentDraft>>({})

    /** EN.3: Computed enrichment stats from the IPC call. */
    const [enrichmentStats, setEnrichmentStats] = useState<EnrichmentStats | null>(null)

    /** EN.3: Component name currently expanded to show draft review. */
    const [expandedDraft, setExpandedDraft] = useState<string | null>(null)

    /** EN.4: Whether the discovery banner has been dismissed this session. */
    const [bannerDismissed, setBannerDismissed] = useState(false)

    /** LIB.1: Active library selection. */
    const [activeLibrary, setActiveLibrary] = useState<string | null>(null)
    const [availableLibraries, setAvailableLibraries] = useState<Array<{ library: string; displayName: string }>>([])
    const [libraryLoading, setLibraryLoading] = useState(false)

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pushNotification = useNotificationStore((s) => s.push)

    // ── Fetch ────────────────────────────────────────────────────────────────

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            // Parallel IPC calls — registry/scope + enrichment drafts + active library.
            const [scopeResult, enrichmentResult, libraryResult] = await Promise.all([
                window.flintAPI.scope?.getRegistryAndScope(),
                window.flintAPI.enrichment?.getDrafts(),
                window.flintAPI.scope?.getActiveLibrary?.(),
            ])

            // LIB.1: Populate library state
            if (libraryResult) {
                setActiveLibrary(libraryResult.library)
                setAvailableLibraries(libraryResult.availableLibraries)
            }

            if (!scopeResult) {
                // No IPC surface — headless / test environment.
                setData({ registry: {}, scope: null, registryAvailable: false })
                setLocalScope(null)
                setDrafts({})
                setEnrichmentStats(null)
                return
            }

            setData(scopeResult)
            setLocalScope(scopeResult.scope)

            if (enrichmentResult) {
                setDrafts(enrichmentResult.drafts)
                setEnrichmentStats(enrichmentResult.enrichmentStats)
            } else {
                setDrafts({})
                setEnrichmentStats(null)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load component registry')
            setData(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchData()
        // Cleanup: cancel any pending debounce timer when the component unmounts
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
                debounceTimerRef.current = null
            }
        }
    }, [fetchData])

    // ── LIB.1: Library change handler ───────────────────────────────────────

    const handleLibraryChange = useCallback(async (newLibrary: string | null) => {
        const previous = activeLibrary
        setActiveLibrary(newLibrary)
        setLibraryLoading(true)
        try {
            const res = await window.flintAPI.scope?.setActiveLibrary?.({ library: newLibrary })
            if (res && !res.ok) {
                setActiveLibrary(previous)
                pushNotification({
                    type: 'error',
                    title: 'Library change failed',
                    message: res.error ?? 'Unknown error',
                    severity: 'error',
                    autoDismissMs: 5000,
                })
            } else if (res && res.seeded > 0) {
                pushNotification({
                    type: 'info',
                    title: 'Library tokens seeded',
                    message: `${res.seeded} base tokens added for ${newLibrary}`,
                    severity: 'info',
                    autoDismissMs: 4000,
                })
            }
        } catch {
            setActiveLibrary(previous)
        } finally {
            setLibraryLoading(false)
        }
    }, [activeLibrary, pushNotification])

    // ── Debounced persist ────────────────────────────────────────────────────

    /**
     * Schedule a scope persist. Any in-flight timer is cancelled first so
     * rapid toggles coalesce into a single IPC call (300 ms window).
     */
    const schedulePersist = useCallback(
        (nextScope: string[] | null, previousScope: string[] | null) => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
            setSaving(true)
            debounceTimerRef.current = setTimeout(async () => {
                debounceTimerRef.current = null
                try {
                    const res = await window.flintAPI.scope?.setScope({ scope: nextScope })
                    if (res && !res.ok) {
                        setLocalScope(previousScope)
                        pushNotification({
                            type: 'error',
                            title: 'Scope save failed',
                            message: res.error ?? 'Unknown error from scope:set-scope',
                            severity: 'error',
                            autoDismissMs: 5000,
                        })
                    }
                } catch (err) {
                    setLocalScope(previousScope)
                    pushNotification({
                        type: 'error',
                        title: 'Scope save failed',
                        message: err instanceof Error ? err.message : 'IPC call failed',
                        severity: 'error',
                        autoDismissMs: 5000,
                    })
                } finally {
                    setSaving(false)
                }
            }, 300)
        },
        [pushNotification],
    )

    // ── Mode toggle ──────────────────────────────────────────────────────────

    const handleModeToggle = useCallback(
        (mode: 'all' | 'restricted') => {
            if (!data) return
            const prev = localScope
            if (mode === 'all') {
                setLocalScope(null)
                schedulePersist(null, prev)
            } else {
                const allNames = Object.keys(data.registry)
                const next = allNames.length > 0 ? sortNames(allNames) : []
                setLocalScope(next)
                schedulePersist(next, prev)
            }
        },
        [data, localScope, schedulePersist],
    )

    // ── Checkbox toggle ──────────────────────────────────────────────────────

    const handleToggle = useCallback(
        (name: string, checked: boolean) => {
            if (localScope === null) return
            const prev = localScope
            let next: string[]
            if (checked) {
                next = sortNames([...localScope, name])
            } else {
                next = localScope.filter((n) => n !== name)
            }

            if (next.length === 0) {
                setLocalScope(null)
                schedulePersist(null, prev)
                pushNotification({
                    type: 'info',
                    title: 'No components restricted',
                    message: 'Switched to All Components mode.',
                    severity: 'info',
                    autoDismissMs: 4000,
                })
                return
            }

            setLocalScope(next)
            schedulePersist(next, prev)
        },
        [localScope, schedulePersist, pushNotification],
    )

    // ── Draft approve / dismiss (EN.3) ───────────────────────────────────────

    const handleDraftAction = useCallback(
        async (componentName: string, action: 'approve' | 'dismiss') => {
            // Optimistic update: remove draft from local state immediately.
            const prevDrafts = drafts
            const prevStats = enrichmentStats

            const newDrafts = { ...drafts }
            delete newDrafts[componentName]
            setDrafts(newDrafts)

            // Update stats optimistically.
            if (enrichmentStats) {
                setEnrichmentStats({
                    ...enrichmentStats,
                    draft: Math.max(0, enrichmentStats.draft - 1),
                    enriched:
                        action === 'approve'
                            ? enrichmentStats.enriched + 1
                            : enrichmentStats.enriched,
                    bare:
                        action === 'dismiss'
                            ? enrichmentStats.bare + 1
                            : enrichmentStats.bare,
                })
            }

            // Collapse expanded draft if it's the one we just acted on.
            if (expandedDraft === componentName) {
                setExpandedDraft(null)
            }

            try {
                const res = await window.flintAPI.enrichment?.approve({
                    componentName,
                    action,
                })
                if (res && !res.ok) {
                    // Revert on IPC-level error.
                    setDrafts(prevDrafts)
                    setEnrichmentStats(prevStats)
                    pushNotification({
                        type: 'error',
                        title: `${action === 'approve' ? 'Approval' : 'Dismiss'} failed`,
                        message: res.error ?? 'Unknown IPC error',
                        severity: 'error',
                        autoDismissMs: 5000,
                    })
                }
            } catch (err) {
                setDrafts(prevDrafts)
                setEnrichmentStats(prevStats)
                pushNotification({
                    type: 'error',
                    title: `${action === 'approve' ? 'Approval' : 'Dismiss'} failed`,
                    message: err instanceof Error ? err.message : 'IPC call failed',
                    severity: 'error',
                    autoDismissMs: 5000,
                })
            }
        },
        [drafts, enrichmentStats, expandedDraft, pushNotification],
    )

    // ── Derived values ───────────────────────────────────────────────────────

    const isAllMode = localScope === null
    const registryNames = data ? sortNames(Object.keys(data.registry)) : []
    const registryCount = registryNames.length

    const inScopeCount = isAllMode ? registryCount : (localScope?.length ?? 0)
    const excludedCount = isAllMode ? 0 : Math.max(0, registryCount - (localScope?.length ?? 0))

    const unregisteredNames = localScope
        ? sortNames(localScope.filter((n) => !data?.registry[n]))
        : []

    // EN.4: Show banner when >50% of components are bare and user hasn't dismissed.
    const showDiscoveryBanner =
        !bannerDismissed &&
        enrichmentStats !== null &&
        enrichmentStats.total > 0 &&
        enrichmentStats.bare > enrichmentStats.total * 0.5

    // ── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400" />
                <span className="mt-3 text-xs text-zinc-500">Loading component registry...</span>
            </div>
        )
    }

    // ── Error state ──────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center px-4 py-12">
                <span className="text-xs text-red-400">{error}</span>
                <button
                    type="button"
                    onClick={() => void fetchData()}
                    className="mt-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:border-indigo-500/50 hover:text-white"
                >
                    Retry
                </button>
            </div>
        )
    }

    // ── No project state ─────────────────────────────────────────────────────
    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center px-4 py-12">
                <span className="text-xs text-zinc-500">Open a project to manage component scope.</span>
            </div>
        )
    }

    // ── Empty registry state ─────────────────────────────────────────────────
    const showEmptyState = !data.registryAvailable || registryCount === 0

    return (
        <div className="flex flex-col">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                        Component Scope
                    </h3>
                    {saving && (
                        <span
                            className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"
                            title="Saving..."
                            aria-label="Saving scope"
                        />
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => void fetchData()}
                    className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    title="Refresh"
                >
                    Refresh
                </button>
            </div>

            {/* ── Description ─────────────────────────────────────────────── */}
            <p className="border-b border-zinc-800/50 px-3 py-1.5 text-[10px] text-zinc-600">
                Controls which components the AI can use when generating code.
            </p>

            {/* ── LIB.1: Active Library Selector ─────────────────────────── */}
            <div className="border-b border-zinc-800/50 px-3 py-2">
                <label
                    htmlFor="active-library-select"
                    className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500"
                >
                    Active Library
                </label>
                <select
                    id="active-library-select"
                    value={activeLibrary ?? ''}
                    onChange={(e) => {
                        const val = e.target.value || null
                        void handleLibraryChange(val)
                    }}
                    disabled={libraryLoading}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500 disabled:opacity-50"
                    data-testid="active-library-select"
                >
                    <option value="">(None)</option>
                    {availableLibraries.map((lib) => (
                        <option key={lib.library} value={lib.library}>
                            {lib.displayName}
                        </option>
                    ))}
                </select>
                {activeLibrary && (
                    <p className="mt-1 text-[10px] text-zinc-600">
                        AI will generate code using {activeLibrary} conventions.
                    </p>
                )}
            </div>

            {showEmptyState ? (
                /* ── Empty state ─────────────────────────────────────────── */
                <div className="flex flex-col items-center justify-center px-4 py-10">
                    <span className="text-xs font-medium text-zinc-400">No component registry found.</span>
                    <span className="mt-1.5 text-center text-[10px] text-zinc-600">
                        Create a <span className="font-mono text-zinc-500">flint-manifest.json</span> in your
                        project root to define available components.
                    </span>
                </div>
            ) : (
                <>
                    {/* ── Mode toggle ───────────────────────────────────────── */}
                    <div className="border-b border-zinc-800 px-3 py-2">
                        <div className="flex rounded border border-zinc-700 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => handleModeToggle('all')}
                                className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
                                    isAllMode
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                All Components
                            </button>
                            <button
                                type="button"
                                onClick={() => handleModeToggle('restricted')}
                                className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
                                    !isAllMode
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                Restricted
                            </button>
                        </div>
                    </div>

                    {/* ── Summary chips ─────────────────────────────────────── */}
                    <div className="grid grid-cols-3 gap-2 px-3 py-3">
                        <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2">
                            <span className="text-lg font-bold text-zinc-100">{registryCount}</span>
                            <span className="text-[10px] text-zinc-500">In Registry</span>
                        </div>
                        <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2">
                            <span className="text-lg font-bold text-zinc-100">
                                {isAllMode ? 'All' : inScopeCount}
                            </span>
                            <span className="text-[10px] text-zinc-500">In Scope</span>
                        </div>
                        <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2">
                            <span className={`text-lg font-bold ${excludedCount > 0 ? 'text-amber-400' : 'text-zinc-100'}`}>
                                {excludedCount}
                            </span>
                            <span className="text-[10px] text-zinc-500">Excluded</span>
                        </div>

                        {/* ── EN.3: Registry Health metric ──────────────── */}
                        <RegistryHealthChip stats={enrichmentStats} registryCount={registryCount} />
                    </div>

                    {/* ── EN.4: Discovery banner (shown above component list) */}
                    {showDiscoveryBanner && (
                        <DiscoveryBanner onDismiss={() => setBannerDismissed(true)} />
                    )}

                    {/* ── Component list header ─────────────────────────────── */}
                    <div className="border-b border-t border-zinc-800 px-3 py-2">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                            Components
                        </h3>
                    </div>

                    {/* ── Component list ────────────────────────────────────── */}
                    <div className="space-y-px px-2 py-1">
                        {registryNames.map((name) => {
                            const entry = data.registry[name]
                            const propCount = Object.keys(entry.props).length
                            const variantCount = entry.variants.length
                            const tokenCount = entry.consumedTokens.length
                            const isInScope = isAllMode || (localScope?.includes(name) ?? false)
                            const dotState = getDotState(entry, drafts, name)
                            const hasDraft = dotState === 'draft'
                            const isExpanded = expandedDraft === name

                            return (
                                <div key={name}>
                                    <label
                                        className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                                            isAllMode
                                                ? 'cursor-default opacity-60'
                                                : 'hover:bg-zinc-800/50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isInScope}
                                            disabled={isAllMode}
                                            onChange={(e) => handleToggle(name, e.target.checked)}
                                            className="h-3.5 w-3.5 shrink-0 accent-indigo-500"
                                            aria-label={`${name} ${isInScope ? 'in scope' : 'excluded'}`}
                                        />

                                        {/* EN.3: Enrichment dot */}
                                        <EnrichmentDot state={dotState} />

                                        <span
                                            className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-200"
                                            title={name}
                                        >
                                            {name}
                                        </span>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {propCount > 0 && (
                                                <MetaBadge label={`${propCount} props`} />
                                            )}
                                            {variantCount > 0 && (
                                                <MetaBadge label={`${variantCount} variants`} />
                                            )}
                                            {tokenCount > 0 && (
                                                <MetaBadge label={`${tokenCount} tokens`} />
                                            )}

                                            {/* EN.3: Expand toggle for draft rows */}
                                            {hasDraft && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpandedDraft(isExpanded ? null : name)
                                                    }
                                                    className="ml-1 rounded px-1 py-0.5 text-[9px] text-amber-400 hover:bg-amber-900/20 transition-colors"
                                                    aria-expanded={isExpanded}
                                                    aria-label={`${isExpanded ? 'Collapse' : 'Review'} draft for ${name}`}
                                                >
                                                    {isExpanded ? 'Close' : 'Review'}
                                                </button>
                                            )}
                                        </div>
                                    </label>

                                    {/* EN.3: Draft review panel (expanded) */}
                                    {hasDraft && isExpanded && drafts[name] && (
                                        <DraftReviewPanel
                                            componentName={name}
                                            draft={drafts[name]}
                                            onApprove={() => void handleDraftAction(name, 'approve')}
                                            onDismiss={() => void handleDraftAction(name, 'dismiss')}
                                        />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* ── Unregistered section ──────────────────────────────── */}
                    {unregisteredNames.length > 0 && (
                        <>
                            <div className="border-b border-t border-zinc-800 px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                                        Unregistered
                                    </h3>
                                    <span className="rounded border border-amber-500/30 bg-amber-900/20 px-1 py-0.5 text-[9px] text-amber-400">
                                        Not in manifest
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-px px-2 py-1">
                                {unregisteredNames.map((name) => (
                                    <label
                                        key={name}
                                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800/50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={true}
                                            onChange={(e) => handleToggle(name, e.target.checked)}
                                            className="h-3.5 w-3.5 shrink-0 accent-indigo-500"
                                            aria-label={`${name} unregistered, in scope`}
                                        />
                                        <span
                                            className="min-w-0 flex-1 truncate font-mono text-xs text-amber-400"
                                            title={name}
                                        >
                                            {name}
                                        </span>
                                        <span className="shrink-0 rounded border border-amber-500/30 bg-amber-900/20 px-1 py-0.5 text-[9px] text-amber-400">
                                            unknown
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    )
}
