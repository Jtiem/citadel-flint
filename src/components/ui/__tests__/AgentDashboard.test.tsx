/**
 * AgentDashboard.test.tsx — Phase AGV.2
 *
 * Tests for the Agent Risk Dashboard component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AgentDashboard } from '../AgentDashboard'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockResource(data: unknown) {
    ;(window.flintAPI.mcp!.readResource as ReturnType<typeof vi.fn>).mockResolvedValue({
        contents: [{ text: JSON.stringify(data) }],
    })
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
            expect(screen.getByText('No agent activity recorded')).toBeDefined()
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
        mockResource(TWO_AGENTS)
        render(<AgentDashboard />)
        await waitFor(() => {
            expect(screen.getByText('17')).toBeDefined() // 12 + 5
            expect(screen.getByText('Mutations')).toBeDefined()
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
})
