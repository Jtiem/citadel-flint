/**
 * AgentDashboard.tsx — Phase AGV.2: Agent Risk Dashboard
 *
 * Displays per-agent risk posture, escalation status, and mutation history.
 * Data is fetched from the MCP resource `flint://agent-risk` via the
 * bidirectional action flint (`window.flintAPI.mcp.readResource`).
 *
 * Rendered in the right sidebar when the "agents" tab is active.
 *
 * Mithril compliance:
 *   - No hardcoded hex colours — all classes use Flint token palette.
 *   - No arbitrary spacing — all spacing from the 4 px grid scale.
 */

import { useState, useEffect, useCallback } from 'react'

// ── Types (mirror of flint-mcp AgentRiskProfile / AgentRiskSummary) ────────

interface AgentRiskProfile {
    agentId: string
    mutationCount: number
    avgRiskScore: number
    redCount: number
    amberCount: number
    greenCount: number
    overrideCount: number
    lastActive: string | null
}

interface AgentRiskSummary {
    agents: AgentRiskProfile[]
    topRiskiest: AgentRiskProfile[]
    period: string
}

// ── Types (mirror of flint-mcp ConsensusReportSummary) ──────────────────────

export interface ConsensusReportSummary {
    totalEvaluations: number
    byOutcome: {
        agree_approve: number
        agree_reject: number
        disagree: number
        error: number
        skipped: number
    }
    disagreementRate: number  // 0.0–1.0
    avgSecondaryDurationMs: number
    last24hCount: number
    recentDisagreements: unknown[]
}

// ── Risk badge helpers ──────────────────────────────────────────────────────

function riskBadgeClass(score: number): string {
    if (score >= 76) return 'bg-red-900/30 text-red-400 border border-red-700/40'
    if (score >= 51) return 'bg-amber-900/20 text-amber-400 border border-amber-500/30'
    return 'bg-emerald-900/20 text-emerald-400 border border-emerald-700/40'
}

function riskLabel(score: number): string {
    if (score >= 76) return 'Critical'
    if (score >= 51) return 'High'
    if (score >= 26) return 'Medium'
    return 'Low'
}

function formatLastActive(iso: string | null): string {
    if (!iso) return 'Never'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

// ── Consensus helpers ───────────────────────────────────────────────────────

/** Returns Tailwind colour classes for a disagreement rate value (0.0–1.0). */
export function disagreementRateClass(rate: number): string {
    if (rate > 0.15) return 'text-red-400'
    if (rate >= 0.05) return 'text-amber-400'
    return 'text-emerald-400'
}

/** Format a 0.0–1.0 rate as a percentage string, e.g. "12.3%". */
export function formatRate(rate: number): string {
    return `${(rate * 100).toFixed(1)}%`
}

// ── ConsensusGateSection ────────────────────────────────────────────────────

interface ConsensusGateSectionProps {
    summary: ConsensusReportSummary
    onViewDisagreements: () => void
}

function ConsensusGateSection({ summary, onViewDisagreements }: ConsensusGateSectionProps) {
    const { totalEvaluations, byOutcome, disagreementRate, last24hCount } = summary
    const rateClass = disagreementRateClass(disagreementRate)

    return (
        <div className="border-t border-zinc-800">
            {/* Section header */}
            <div className="flex items-center justify-between px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Consensus Gate
                </h3>
                <button
                    type="button"
                    onClick={onViewDisagreements}
                    className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    title="View disagreements"
                >
                    View disagreements
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2">
                    <span className="text-lg font-bold text-zinc-100">{totalEvaluations}</span>
                    <span className="text-[10px] text-zinc-500">Evaluations</span>
                </div>
                <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2">
                    <span className={`text-lg font-bold ${rateClass}`}>
                        {formatRate(disagreementRate)}
                    </span>
                    <span className="text-[10px] text-zinc-500">Disagreement</span>
                </div>
                <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2">
                    <span className="text-lg font-bold text-zinc-100">{last24hCount}</span>
                    <span className="text-[10px] text-zinc-500">Last 24h</span>
                </div>
            </div>

            {/* Outcome distribution */}
            <div className="flex flex-wrap gap-1 px-3 pb-3">
                {byOutcome.agree_approve > 0 && (
                    <span className="rounded bg-emerald-900/20 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">
                        approve {byOutcome.agree_approve}
                    </span>
                )}
                {byOutcome.agree_reject > 0 && (
                    <span className="rounded bg-red-900/30 px-1.5 py-0.5 font-mono text-[9px] text-red-400">
                        reject {byOutcome.agree_reject}
                    </span>
                )}
                {byOutcome.disagree > 0 && (
                    <span className="rounded bg-amber-900/20 px-1.5 py-0.5 font-mono text-[9px] text-amber-400">
                        disagree {byOutcome.disagree}
                    </span>
                )}
                {byOutcome.error > 0 && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
                        error {byOutcome.error}
                    </span>
                )}
                {byOutcome.skipped > 0 && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">
                        skipped {byOutcome.skipped}
                    </span>
                )}
                {totalEvaluations === 0 && (
                    <span className="text-[10px] text-zinc-600">No evaluations yet</span>
                )}
            </div>
        </div>
    )
}

// ── Component ───────────────────────────────────────────────────────────────

export function AgentDashboard() {
    const [data, setData] = useState<AgentRiskSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [consensusSummary, setConsensusSummary] = useState<ConsensusReportSummary | null>(null)

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await window.flintAPI.mcp?.readResource('flint://agent-risk')
            // MCP readResource returns { contents: [{ text }] }
            const raw = result as { contents?: Array<{ text?: string }> }
            const text = raw?.contents?.[0]?.text
            if (text) {
                setData(JSON.parse(text) as AgentRiskSummary)
            } else {
                setData({ agents: [], topRiskiest: [], period: 'last_7_days' })
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load agent data')
            setData(null)
        } finally {
            setLoading(false)
        }

        // Fetch consensus summary separately — failure here is non-fatal
        try {
            const consensusResult = await window.flintAPI.mcp?.callTool(
                'flint_consensus_report',
                { mode: 'summary' },
            )
            const toolRaw = consensusResult as { content?: Array<{ text?: string }> }
            const toolText = toolRaw?.content?.[0]?.text
            if (toolText) {
                setConsensusSummary(JSON.parse(toolText) as ConsensusReportSummary)
            }
        } catch {
            // Consensus gate may not be wired yet; silently skip
            setConsensusSummary(null)
        }
    }, [])

    useEffect(() => {
        void fetchData()
    }, [fetchData])

    // ── Loading state ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400" />
                <span className="mt-3 text-xs text-zinc-500">Loading agent data...</span>
            </div>
        )
    }

    // ── Error state ─────────────────────────────────────────────────────────
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

    const agents = data?.agents ?? []
    const totalMutations = agents.reduce((sum, a) => sum + a.mutationCount, 0)
    const escalatedCount = agents.filter((a) => a.redCount > 0).length

    return (
        <div className="flex flex-col">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Agent Risk Dashboard
                </h3>
                <button
                    type="button"
                    onClick={() => void fetchData()}
                    className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    title="Refresh"
                >
                    Refresh
                </button>
            </div>
            <p className="px-3 py-1.5 text-[10px] text-zinc-600 border-b border-zinc-800/50">
                Risk scores are based on mutation patterns, override frequency, and error rates. High-risk agents may need review or sandboxing.
            </p>

            {/* ── Summary chips ───────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2 px-3 py-3">
                <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2">
                    <span className="text-lg font-bold text-zinc-100">{agents.length}</span>
                    <span className="text-[10px] text-zinc-500">Agents</span>
                </div>
                <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2">
                    <span className="text-lg font-bold text-zinc-100">{totalMutations}</span>
                    <span className="text-[10px] text-zinc-500">Mutations</span>
                </div>
                <div className="flex flex-col items-center rounded bg-zinc-800/50 px-2 py-2">
                    <span className={`text-lg font-bold ${escalatedCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {escalatedCount}
                    </span>
                    <span className="text-[10px] text-zinc-500">Escalated</span>
                </div>
            </div>

            {/* ── Agent list ──────────────────────────────────────────── */}
            <div className="border-b border-t border-zinc-800 px-3 py-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Active Agents
                </h3>
            </div>

            {agents.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-600">
                    No agent activity recorded
                </p>
            ) : (
                <div className="space-y-1 px-2 py-2">
                    {agents.map((agent) => (
                        <div
                            key={agent.agentId}
                            className="flex items-center gap-2 rounded px-2 py-2 transition-colors hover:bg-zinc-800/50"
                        >
                            {/* Risk indicator dot */}
                            <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                    agent.avgRiskScore >= 76
                                        ? 'bg-red-400'
                                        : agent.avgRiskScore >= 51
                                          ? 'bg-amber-400'
                                          : 'bg-emerald-400'
                                }`}
                                aria-hidden="true"
                            />

                            {/* Agent ID + last active */}
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-mono text-xs text-zinc-200" title={agent.agentId}>
                                    {agent.agentId}
                                </span>
                                <span className="text-[10px] text-zinc-600">
                                    {formatLastActive(agent.lastActive)} · {agent.mutationCount} mutations
                                </span>
                            </div>

                            {/* Risk badge */}
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${riskBadgeClass(agent.avgRiskScore)}`}>
                                {riskLabel(agent.avgRiskScore)}
                            </span>

                            {/* Tier breakdown */}
                            <div className="flex shrink-0 items-center gap-0.5">
                                {agent.redCount > 0 && (
                                    <span className="rounded bg-red-900/30 px-1 py-0.5 font-mono text-[9px] text-red-400">
                                        {agent.redCount}
                                    </span>
                                )}
                                {agent.amberCount > 0 && (
                                    <span className="rounded bg-amber-900/20 px-1 py-0.5 font-mono text-[9px] text-amber-400">
                                        {agent.amberCount}
                                    </span>
                                )}
                                {agent.greenCount > 0 && (
                                    <span className="rounded bg-emerald-900/20 px-1 py-0.5 font-mono text-[9px] text-emerald-400">
                                        {agent.greenCount}
                                    </span>
                                )}
                            </div>

                            {/* Override indicator */}
                            {agent.overrideCount > 0 && (
                                <span
                                    className="shrink-0 rounded border border-amber-500/30 bg-amber-900/20 px-1 py-0.5 font-mono text-[9px] text-amber-400"
                                    title={`${agent.overrideCount} governance override(s)`}
                                >
                                    OVR {agent.overrideCount}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Consensus Gate ──────────────────────────────────────── */}
            {consensusSummary && (
                <ConsensusGateSection
                    summary={consensusSummary}
                    onViewDisagreements={() => {
                        void window.flintAPI.mcp?.callTool('flint_consensus_report', { mode: 'disagreements' })
                    }}
                />
            )}

            {/* ── Period label ────────────────────────────────────────── */}
            <div className="border-t border-zinc-800 px-3 py-2">
                <span className="text-[10px] text-zinc-600">
                    Period: {data?.period?.replace(/_/g, ' ') ?? 'last 7 days'}
                </span>
            </div>
        </div>
    )
}
