/**
 * AgentDashboard.test.tsx — Phase AGV.2 + V.4
 *
 * Tests for the Agent Risk Dashboard component, including Consensus Gate section.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AgentDashboard, disagreementRateClass, formatRate } from '../AgentDashboard'
import type { ConsensusReportSummary } from '../AgentDashboard'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockResource(data: unknown) {
    ;(window.flintAPI.mcp!.readResource as ReturnType<typeof vi.fn>).mockResolvedValue({
        contents: [{ text: JSON.stringify(data) }],
    })
}

function mockCallTool(data: unknown) {
    ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: [{ text: JSON.stringify(data) }],
    })
}

const CONSENSUS_SUMMARY: ConsensusReportSummary = {
    totalEvaluations: 42,
    byOutcome: {
        agree_approve: 30,
        agree_reject: 5,
        disagree: 7,
        error: 0,
        skipped: 0,
    },
    disagreementRate: 0.1667,
    avgSecondaryDurationMs: 340,
    last24hCount: 12,
    recentDisagreements: [],
}

const CONSENSUS_LOW_DISAGREEMENT: ConsensusReportSummary = {
    totalEvaluations: 10,
    byOutcome: {
        agree_approve: 10,
        agree_reject: 0,
        disagree: 0,
        error: 0,
        skipped: 0,
    },
    disagreementRate: 0.0,
    avgSecondaryDurationMs: 200,
    last24hCount: 3,
    recentDisagreements: [],
}

const EMPTY_SUMMARY = { agents: [], topRiskiest: [], period: 'last_7_days' }

const TWO_AGENTS = {
    agents: [
        {
            agentId: 'claude-coder',
            mutationCount: 12,
            avgRiskScore: 82,
            redCount: 3,
            amberCount: 2,
            greenCount: 7,
            overrideCount: 1,
            lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        },
        {
            agentId: 'safe-bot',
            mutationCount: 5,
            avgRiskScore: 15,
            redCount: 0,
            amberCount: 0,
            greenCount: 5,
            overrideCount: 0,
            lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
    ],
    topRiskiest: [],
    period: 'last_7_days',
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('AgentDashboard', () => {
    beforeEach(() => {
        mockResource(EMPTY_SUMMARY)
        // Default: callTool returns no content (consensus section hidden)
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({})
    })

    it('renders the header', async () => {
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('Agent Risk Dashboard')).toBeDefined()
        })
    })

    it('shows empty state when no agents exist', async () => {
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/No AI agents connected this session/)).toBeDefined()
        })
    })

    it('empty state mentions MCP client names', async () => {
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/Claude Code, Cursor/)).toBeDefined()
        })
    })

    it('shows agent count in summary chip', async () => {
        mockResource(TWO_AGENTS)
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('Agents')).toBeDefined()
            // The "2" appears as agent count in the summary chip
            const agentsLabel = screen.getByText('Agents')
            const chip = agentsLabel.closest('div')
            expect(chip?.textContent).toContain('2')
        })
    })

    it('renders agent IDs', async () => {
        mockResource(TWO_AGENTS)
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('claude-coder')).toBeDefined()
            expect(screen.getByText('safe-bot')).toBeDefined()
        })
    })

    it('shows risk badge for high-risk agent', async () => {
        mockResource(TWO_AGENTS)
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('Critical')).toBeDefined()
            expect(screen.getByText('Low')).toBeDefined()
        })
    })

    it('shows total mutations in summary', async () => {
        // EDU-14 renamed "Mutations" to "Code changes"
        mockResource(TWO_AGENTS)
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('17')).toBeDefined() // 12 + 5
            expect(screen.getByText('Code changes')).toBeDefined()
        })
    })

    it('shows escalated count for agents with red mutations', async () => {
        mockResource(TWO_AGENTS)
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('1')).toBeDefined() // only claude-coder has redCount > 0
            expect(screen.getByText('Escalated')).toBeDefined()
        })
    })

    it('shows override indicator', async () => {
        mockResource(TWO_AGENTS)
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('OVR 1')).toBeDefined()
        })
    })

    it('shows error state on fetch failure', async () => {
        ;(window.flintAPI.mcp!.readResource as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('MCP not connected'),
        )
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('MCP not connected')).toBeDefined()
            expect(screen.getByText('Retry')).toBeDefined()
        })
    })

    it('shows period label', async () => {
        mockResource(EMPTY_SUMMARY)
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/last 7 days/)).toBeDefined()
        })
    })

    it('does not render consensus section when callTool returns no content', async () => {
        // EDU-14 renamed "Consensus Gate" to "AI Second Opinion"
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.queryByText('AI Second Opinion')).toBeNull()
        })
    })
})

// ── Consensus Gate section ───────────────────────────────────────────────────
// Note: EDU-14 renamed "Consensus Gate" to "AI Second Opinion" in the component.

describe('AgentDashboard — Consensus Gate section', () => {
    beforeEach(() => {
        mockResource(EMPTY_SUMMARY)
        mockCallTool(CONSENSUS_SUMMARY)
    })

    it('renders the Consensus Gate heading when summary is available', async () => {
        // EDU-14: section heading is now "AI Second Opinion"
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('AI Second Opinion')).toBeDefined()
        })
    })

    it('shows total evaluations count', async () => {
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('42')).toBeDefined()
            expect(screen.getByText('Evaluations')).toBeDefined()
        })
    })

    it('shows disagreement rate formatted as percentage', async () => {
        render(<AgentDashboard />)
        await waitFor(() => {
            // 0.1667 * 100 = 16.67% — red tier (> 15%)
            expect(screen.getByText('16.7%')).toBeDefined()
        })
    })

    it('shows last 24h count', async () => {
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('12')).toBeDefined()
            expect(screen.getByText('Last 24h')).toBeDefined()
        })
    })

    it('renders outcome distribution chips', async () => {
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText(/approve 30/)).toBeDefined()
            expect(screen.getByText(/reject 5/)).toBeDefined()
            expect(screen.getByText(/disagree 7/)).toBeDefined()
        })
    })

    it('shows "No evaluations yet" when totalEvaluations is 0', async () => {
        mockCallTool({
            ...CONSENSUS_SUMMARY,
            totalEvaluations: 0,
            byOutcome: { agree_approve: 0, agree_reject: 0, disagree: 0, error: 0, skipped: 0 },
        })
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('No evaluations yet')).toBeDefined()
        })
    })

    it('calls flint_consensus_report with mode=disagreements on "View disagreements" click', async () => {
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('View disagreements')).toBeDefined()
        })
        fireEvent.click(screen.getByText('View disagreements'))
        // callTool is called twice: once for summary fetch, once for the button click
        expect(window.flintAPI.mcp!.callTool).toHaveBeenCalledWith(
            'flint_consensus_report',
            { mode: 'disagreements' },
        )
    })

    it('hides consensus section when callTool throws', async () => {
        // EDU-14: section heading is now "AI Second Opinion"
        ;(window.flintAPI.mcp!.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('tool not found'),
        )
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.queryByText('AI Second Opinion')).toBeNull()
        })
    })

    it('shows green disagreement rate class for low rate', async () => {
        mockCallTool(CONSENSUS_LOW_DISAGREEMENT)
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('0.0%')).toBeDefined()
        })
    })
})

// ── disagreementRateClass utility ─────────────────────────────────────────────

describe('disagreementRateClass', () => {
    it('returns green class for rate below 5%', () => {
        expect(disagreementRateClass(0.0)).toBe('text-emerald-400')
        expect(disagreementRateClass(0.04)).toBe('text-emerald-400')
    })

    it('returns amber class for rate between 5% and 15% inclusive', () => {
        expect(disagreementRateClass(0.05)).toBe('text-amber-400')
        expect(disagreementRateClass(0.10)).toBe('text-amber-400')
        expect(disagreementRateClass(0.15)).toBe('text-amber-400')
    })

    it('returns red class for rate above 15%', () => {
        expect(disagreementRateClass(0.151)).toBe('text-red-400')
        expect(disagreementRateClass(1.0)).toBe('text-red-400')
    })
})

// ── formatRate utility ────────────────────────────────────────────────────────

describe('formatRate', () => {
    it('formats zero as "0.0%"', () => {
        expect(formatRate(0)).toBe('0.0%')
    })

    it('formats 0.5 as "50.0%"', () => {
        expect(formatRate(0.5)).toBe('50.0%')
    })

    it('formats 1.0 as "100.0%"', () => {
        expect(formatRate(1.0)).toBe('100.0%')
    })

    it('rounds to 1 decimal place', () => {
        expect(formatRate(0.1667)).toBe('16.7%')
        expect(formatRate(0.1234)).toBe('12.3%')
    })
})
