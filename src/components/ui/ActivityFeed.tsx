// TODO: GLASS.1 — relocated from right sidebar. Will move to StatusBar popover or be removed.
/**
 * ActivityFeed — src/components/ui/ActivityFeed.tsx
 *
 * Read-only log of MCP tool invocations. Polls `.flint/activity-log.jsonl`
 * every 3 seconds via the flintAPI.readFile IPC channel.
 *
 * Each JSONL line is expected to have the shape:
 *   { tool: string, input: unknown, outcome: 'success'|'error'|'blocked', durationMs?: number, timestamp: string|number }
 *
 * Displays the 50 most recent entries, newest first.
 *
 * Phase V.2 additions:
 *   - Filter bar: pill toggles for success / error / blocked outcome filtering
 *   - Search: case-insensitive filter by tool name or input summary text
 *   - "View" button on error rows that contain a file path in inputSummary
 *   - Header count badges for error and blocked entries
 *
 * Mithril Safety: all classes from Flint design token palette only.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { Activity, CheckCircle2, XCircle, ShieldAlert, Search, ExternalLink } from 'lucide-react'

// ── Activity log entry shape ──────────────────────────────────────────────────

interface ActivityEntry {
    tool: string
    input?: unknown
    outcome: 'success' | 'error' | 'blocked'
    durationMs?: number
    timestamp?: string | number
}

type OutcomeFilter = 'success' | 'error' | 'blocked'

// ── Tool label translation map ────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
    flint_status: 'Status Check',
    flint_get_context: 'Read Context',
    flint_audit: 'Design Audit',
    audit_ui_component: 'Component Audit',
    flint_fix: 'Auto-Fix',
    flint_ast_mutate: 'Code Change',
    flint_ingest_figma: 'Figma Import',
    flint_sync_tokens: 'Token Sync',
    flint_query_registry: 'Component Search',
    flint_debt_report: 'Debt Report',
    flint_annotate: 'Annotation',
    flint_vpat_report: 'Accessibility Report',
    flint_consensus_status: 'Consensus Check',
    flint_anomaly_report: 'Anomaly Detection',
    flint_theme_validate: 'Theme Validation',
    flint_compare_layouts: 'Layout Comparison',
    flint_migrate_ds: 'Design System Migration',
    flint_migrate_tw: 'Tailwind Migration',
    flint_platform_export: 'Platform Export',
    read_design_intent: 'Design Intent',
    generate_component: 'Generate Component',
    hydrate_figma_data: 'Figma Hydration',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseActivityLog(raw: string): ActivityEntry[] {
    const lines = raw.split('\n').filter((l) => l.trim().length > 0)
    const entries: ActivityEntry[] = []
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line) as ActivityEntry
            entries.push(parsed)
        } catch {
            // Skip malformed lines
        }
    }
    // Reverse so newest is first, cap at 50
    return entries.reverse().slice(0, 50)
}

function formatInputSummary(input: unknown): string {
    if (!input) return ''
    if (typeof input === 'string') return input.slice(0, 80)
    if (typeof input === 'object' && input !== null) {
        const obj = input as Record<string, unknown>
        // Prefer meaningful fields over raw JSON
        if (typeof obj.targetPath === 'string') {
            const filename = obj.targetPath.split('/').pop() ?? obj.targetPath
            return `path: ${filename}`
        }
        if (typeof obj.op === 'string') {
            const extra = typeof obj.nodeId === 'string'
                ? ` · ${obj.nodeId.slice(0, 12)}…`
                : ''
            return `op: ${obj.op}${extra}`
        }
        if (typeof obj.nodeId === 'string') {
            return `node: ${obj.nodeId.slice(0, 20)}…`
        }
    }
    try {
        return JSON.stringify(input).slice(0, 80)
    } catch {
        return ''
    }
}

function formatTimestamp(ts: string | number | undefined): string {
    if (!ts) return ''
    try {
        const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
        return String(ts)
    }
}

/**
 * Attempt to extract an absolute or relative file path from a summary string.
 * Looks for segments that look like paths (contain '/' and a file extension).
 */
function extractFilePath(summary: string): string | null {
    // Match unix-style paths with an extension
    const match = summary.match(/([./~][\w./\-@]+\.\w{1,6})/)
    return match ? match[1] : null
}

// ── Outcome badge ─────────────────────────────────────────────────────────────

interface OutcomeBadgeProps {
    outcome: ActivityEntry['outcome']
}

function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
    if (outcome === 'success') {
        return (
            <span className="flex items-center gap-1 rounded border border-emerald-800/40 bg-emerald-900/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                <CheckCircle2 size={9} />
                ok
            </span>
        )
    }
    if (outcome === 'error') {
        return (
            <span className="flex items-center gap-1 rounded border border-red-700/40 bg-red-900/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                <XCircle size={9} />
                error
            </span>
        )
    }
    return (
        <span className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            <ShieldAlert size={9} />
            blocked
        </span>
    )
}

// ── Filter pill ───────────────────────────────────────────────────────────────

interface FilterPillProps {
    label: string
    count: number
    active: boolean
    onToggle: () => void
    colorClasses: {
        active: string
        inactive: string
    }
}

function FilterPill({ label, count, active, onToggle, colorClasses }: FilterPillProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                active ? colorClasses.active : colorClasses.inactive
            }`}
        >
            {label}
            <span
                className={`rounded-full px-1 text-[10px] font-semibold ${
                    active ? 'bg-white/20' : 'bg-zinc-800'
                }`}
            >
                {count}
            </span>
        </button>
    )
}

// ── ActivityEntry row ─────────────────────────────────────────────────────────

interface EntryRowProps {
    entry: ActivityEntry
    index: number
}

function EntryRow({ entry, index }: EntryRowProps) {
    const summary = formatInputSummary(entry.input)
    const filePath = entry.outcome === 'error' && summary ? extractFilePath(summary) : null

    const handleViewFile = useCallback(() => {
        if (!filePath) return
        // Navigate to the file via flintAPI if available
        window.flintAPI?.openFile?.(filePath)
    }, [filePath])

    return (
        <div
            className={`px-3 py-2 hover:bg-zinc-800/30 transition-colors ${
                index > 0 ? 'border-t border-zinc-800/60' : ''
            }`}
        >
            <div className="flex items-center gap-2">
                {/* Tool badge */}
                <span
                    className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300"
                    title={entry.tool}
                >
                    {TOOL_LABELS[entry.tool] ?? entry.tool}
                </span>

                {/* Outcome */}
                <OutcomeBadge outcome={entry.outcome} />

                {/* Duration */}
                {entry.durationMs != null && (
                    <span className="text-[10px] text-zinc-600">{entry.durationMs}ms</span>
                )}

                {/* View button — only on error rows that contain a file path */}
                {filePath && (
                    <button
                        type="button"
                        onClick={handleViewFile}
                        title={`View ${filePath}`}
                        className="flex items-center gap-0.5 rounded border border-red-700/30 bg-red-900/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-900/20 hover:text-red-300"
                    >
                        <ExternalLink size={8} />
                        View
                    </button>
                )}

                {/* Timestamp — pushed right */}
                <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-700">
                    {formatTimestamp(entry.timestamp)}
                </span>
            </div>

            {/* Input summary */}
            {summary && (
                <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">
                    {summary}
                </p>
            )}
        </div>
    )
}

// ── ActivityFeed ───────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000
const LOG_PATH = '.flint/activity-log.jsonl'

export function ActivityFeed() {
    const [entries, setEntries] = useState<ActivityEntry[]>([])
    const [lastRead, setLastRead] = useState<number>(0)
    const [activeFilters, setActiveFilters] = useState<Set<OutcomeFilter>>(new Set())
    const [searchQuery, setSearchQuery] = useState('')
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchLog = async () => {
        try {
            const raw = await window.flintAPI?.readFile?.(LOG_PATH)
            if (!raw) return
            const parsed = parseActivityLog(raw)
            setEntries(parsed)
            setLastRead(Date.now())
        } catch {
            // File not found or IPC unavailable — silently ignore
        }
    }

    useEffect(() => {
        void fetchLog()
        intervalRef.current = setInterval(() => {
            void fetchLog()
        }, POLL_INTERVAL_MS)

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Derived counts ────────────────────────────────────────────────────────

    const errorCount = entries.filter((e) => e.outcome === 'error').length
    const blockedCount = entries.filter((e) => e.outcome === 'blocked').length
    const successCount = entries.filter((e) => e.outcome === 'success').length

    // ── Filter toggle handler ─────────────────────────────────────────────────

    const toggleFilter = (outcome: OutcomeFilter) => {
        setActiveFilters((prev) => {
            const next = new Set(prev)
            if (next.has(outcome)) {
                next.delete(outcome)
            } else {
                next.add(outcome)
            }
            return next
        })
    }

    // ── Filtered + searched entries ───────────────────────────────────────────

    const visibleEntries = entries.filter((entry) => {
        // Outcome filter: if no filters active, show all
        if (activeFilters.size > 0 && !activeFilters.has(entry.outcome)) {
            return false
        }

        // Search filter: match tool name or input summary (case-insensitive)
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            const toolMatch = entry.tool.toLowerCase().includes(q)
            const summaryMatch = formatInputSummary(entry.input).toLowerCase().includes(q)
            if (!toolMatch && !summaryMatch) return false
        }

        return true
    })

    return (
        <div className="flex h-full flex-col overflow-hidden bg-zinc-950">
            {/* ── Section header ── */}
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <Activity size={12} className="text-zinc-600" />
                <h3 className="flex-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Activity Feed
                </h3>

                {/* Error + blocked count badges in header */}
                {errorCount > 0 && (
                    <span className="flex items-center gap-0.5 rounded border border-red-700/40 bg-red-900/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                        <XCircle size={8} />
                        {errorCount}
                    </span>
                )}
                {blockedCount > 0 && (
                    <span className="flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                        <ShieldAlert size={8} />
                        {blockedCount}
                    </span>
                )}

                {lastRead > 0 && (
                    <span className="text-[10px] text-zinc-700">
                        {new Date(lastRead).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                        })}
                    </span>
                )}
            </div>

            {/* ── Filter bar ── */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800/60 px-3 py-2">
                <FilterPill
                    label="Success"
                    count={successCount}
                    active={activeFilters.has('success')}
                    onToggle={() => toggleFilter('success')}
                    colorClasses={{
                        active: 'border-emerald-600 bg-emerald-900/40 text-emerald-300',
                        inactive: 'border-zinc-700/50 bg-transparent text-zinc-500 hover:border-emerald-800/60 hover:text-emerald-500',
                    }}
                />
                <FilterPill
                    label="Errors"
                    count={errorCount}
                    active={activeFilters.has('error')}
                    onToggle={() => toggleFilter('error')}
                    colorClasses={{
                        active: 'border-red-600 bg-red-900/40 text-red-300',
                        inactive: 'border-zinc-700/50 bg-transparent text-zinc-500 hover:border-red-800/60 hover:text-red-500',
                    }}
                />
                <FilterPill
                    label="Blocked"
                    count={blockedCount}
                    active={activeFilters.has('blocked')}
                    onToggle={() => toggleFilter('blocked')}
                    colorClasses={{
                        active: 'border-amber-500 bg-amber-900/40 text-amber-300',
                        inactive: 'border-zinc-700/50 bg-transparent text-zinc-500 hover:border-amber-700/60 hover:text-amber-500',
                    }}
                />
            </div>

            {/* ── Search bar ── */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800/60 px-3 py-1.5">
                <Search size={10} className="shrink-0 text-zinc-600" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tool or input…"
                    className="flex-1 bg-transparent font-mono text-[11px] text-zinc-300 placeholder-zinc-700 outline-none"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="shrink-0 text-[10px] text-zinc-600 hover:text-zinc-400"
                        title="Clear search"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* ── Entry list ── */}
            <div className="flex-1 overflow-y-auto">
                {entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                        <Activity className="h-6 w-6 text-zinc-600" />
                        <p className="text-sm text-zinc-400">No activity yet</p>
                        <p className="text-xs text-zinc-500 max-w-[240px]">MCP tool invocations will appear here</p>
                    </div>
                ) : visibleEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <Search size={16} className="mb-2 text-zinc-800" />
                        <p className="text-xs text-zinc-600">No matching entries</p>
                        <p className="mt-1 text-[10px] text-zinc-700">
                            Try adjusting the filters or search query
                        </p>
                    </div>
                ) : (
                    visibleEntries.map((entry, i) => (
                        <EntryRow
                            key={`${entry.tool}-${entry.timestamp ?? i}-${i}`}
                            entry={entry}
                            index={i}
                        />
                    ))
                )}
            </div>
        </div>
    )
}
