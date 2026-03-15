/**
 * ActivityFeed — src/components/ui/ActivityFeed.tsx
 *
 * Read-only log of MCP tool invocations. Polls `.bridge/activity-log.jsonl`
 * every 3 seconds via the bridgeAPI.readFile IPC channel.
 *
 * Each JSONL line is expected to have the shape:
 *   { tool: string, input: unknown, outcome: 'success'|'error'|'blocked', durationMs?: number, timestamp: string|number }
 *
 * Displays the 50 most recent entries, newest first.
 *
 * Mithril Safety: all classes from Bridge design token palette only.
 */

import { useEffect, useState, useRef } from 'react'
import { Activity, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react'

// ── Activity log entry shape ──────────────────────────────────────────────────

interface ActivityEntry {
    tool: string
    input?: unknown
    outcome: 'success' | 'error' | 'blocked'
    durationMs?: number
    timestamp?: string | number
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

// ── Outcome badge ─────────────────────────────────────────────────────────────

interface OutcomeBadgeProps {
    outcome: ActivityEntry['outcome']
}

function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
    if (outcome === 'success') {
        return (
            <span className="flex items-center gap-1 rounded border border-emerald-800/40 bg-emerald-900/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                <CheckCircle2 size={9} />
                ok
            </span>
        )
    }
    if (outcome === 'error') {
        return (
            <span className="flex items-center gap-1 rounded border border-red-700/40 bg-red-900/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-400">
                <XCircle size={9} />
                error
            </span>
        )
    }
    return (
        <span className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-900/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
            <ShieldAlert size={9} />
            blocked
        </span>
    )
}

// ── ActivityEntry row ─────────────────────────────────────────────────────────

interface EntryRowProps {
    entry: ActivityEntry
    index: number
}

function EntryRow({ entry, index }: EntryRowProps) {
    const summary = formatInputSummary(entry.input)

    return (
        <div
            className={`px-3 py-2 hover:bg-zinc-800/30 transition-colors ${
                index > 0 ? 'border-t border-zinc-800/60' : ''
            }`}
        >
            <div className="flex items-center gap-2">
                {/* Tool badge */}
                <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                    {entry.tool}
                </span>

                {/* Outcome */}
                <OutcomeBadge outcome={entry.outcome} />

                {/* Duration */}
                {entry.durationMs != null && (
                    <span className="text-[10px] text-zinc-600">{entry.durationMs}ms</span>
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
const LOG_PATH = '.bridge/activity-log.jsonl'

export function ActivityFeed() {
    const [entries, setEntries] = useState<ActivityEntry[]>([])
    const [lastRead, setLastRead] = useState<number>(0)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchLog = async () => {
        try {
            const raw = await window.bridgeAPI?.readFile?.(LOG_PATH)
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

    return (
        <div className="flex h-full flex-col overflow-hidden bg-zinc-950">
            {/* ── Section header ── */}
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
                <Activity size={12} className="text-zinc-600" />
                <h3 className="flex-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Activity Feed
                </h3>
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

            {/* ── Entry list ── */}
            <div className="flex-1 overflow-y-auto">
                {entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <Activity size={20} className="mb-2 text-zinc-800" />
                        <p className="text-xs text-zinc-600">No activity yet</p>
                        <p className="mt-1 text-[10px] text-zinc-700">
                            MCP tool calls will appear here in real time
                        </p>
                    </div>
                ) : (
                    entries.map((entry, i) => (
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
