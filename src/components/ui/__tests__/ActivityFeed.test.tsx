/**
 * ActivityFeed.test.tsx
 *
 * 10 tests for the ActivityFeed component. The component polls
 * `.bridge/activity-log.jsonl` via window.bridgeAPI.readFile and renders
 * parsed entries newest-first, capped at 50.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ActivityFeed } from '../ActivityFeed'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJSONL(entries: object[]): string {
    return entries.map((e) => JSON.stringify(e)).join('\n')
}

function makeEntry(overrides: Record<string, unknown> = {}) {
    return {
        tool: 'apply_ast_mutations',
        outcome: 'success',
        durationMs: 12,
        timestamp: new Date('2026-03-14T10:00:00Z').toISOString(),
        ...overrides,
    }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ActivityFeed', () => {
    // 1. Shows empty state when there are no entries
    it('shows empty state when no entries exist in the log', async () => {
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('')
        render(<ActivityFeed />)
        await waitFor(() => {
            expect(screen.getByText('No activity yet')).toBeDefined()
        })
    })

    // 2. Renders entries from JSONL data
    it('renders entries parsed from JSONL content', async () => {
        const raw = makeJSONL([makeEntry({ tool: 'audit_ui_component' })])
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(raw)
        render(<ActivityFeed />)
        await waitFor(() => {
            expect(screen.getByText('Component Audit')).toBeDefined()
        })
    })

    // 3. Shows tool name as badge
    it('renders the tool name inside a badge element', async () => {
        const raw = makeJSONL([makeEntry({ tool: 'bridge_get_context' })])
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(raw)
        render(<ActivityFeed />)
        await waitFor(() => {
            expect(screen.getByText('Read Context')).toBeDefined()
        })
    })

    // 4. Shows "success" outcome badge in emerald
    it('renders a success outcome badge with emerald styling', async () => {
        const raw = makeJSONL([makeEntry({ outcome: 'success' })])
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(raw)
        render(<ActivityFeed />)
        await waitFor(() => {
            const badge = document.querySelector('.text-emerald-400')
            expect(badge).not.toBeNull()
        })
    })

    // 5. Shows "error" outcome badge in red
    it('renders an error outcome badge with red styling', async () => {
        const raw = makeJSONL([makeEntry({ outcome: 'error' })])
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(raw)
        render(<ActivityFeed />)
        await waitFor(() => {
            const badge = document.querySelector('.text-red-400')
            expect(badge).not.toBeNull()
        })
    })

    // 6. Shows "blocked" outcome badge in amber
    it('renders a blocked outcome badge with amber styling', async () => {
        const raw = makeJSONL([makeEntry({ outcome: 'blocked' })])
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(raw)
        render(<ActivityFeed />)
        await waitFor(() => {
            const badge = document.querySelector('.text-amber-400')
            expect(badge).not.toBeNull()
        })
    })

    // 7. Skips malformed JSONL lines
    it('skips malformed JSONL lines without crashing', async () => {
        const raw = [
            'NOT VALID JSON %%%',
            JSON.stringify(makeEntry({ tool: 'good_tool' })),
        ].join('\n')
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(raw)
        render(<ActivityFeed />)
        await waitFor(() => {
            expect(screen.getByText('good_tool')).toBeDefined()
        })
    })

    // 8. Shows newest entries first (reversed)
    it('displays newest entries first (entries are reversed from file order)', async () => {
        const raw = makeJSONL([
            makeEntry({ tool: 'old_tool' }),
            makeEntry({ tool: 'new_tool' }),
        ])
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(raw)
        render(<ActivityFeed />)
        await waitFor(() => {
            const badges = screen.getAllByText(/old_tool|new_tool/)
            // new_tool (last in file) should appear first in the DOM
            expect(badges[0].textContent).toBe('new_tool')
        })
    })

    // 9. Caps at 50 entries
    it('renders at most 50 entries even when the log has more', async () => {
        const entries = Array.from({ length: 60 }, (_, i) =>
            makeEntry({ tool: `capped_tool_${i}` })
        )
        const raw = makeJSONL(entries)
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(raw)
        render(<ActivityFeed />)
        await waitFor(() => {
            // Each entry renders the tool name in a badge; count them
            const allBadges = screen.getAllByText(/^capped_tool_/)
            expect(allBadges.length).toBeLessThanOrEqual(50)
        })
    })

    // 10. Shows formatted timestamp
    it('renders a formatted timestamp string for each entry', async () => {
        const ts = new Date('2026-03-14T10:30:45Z').toISOString()
        const raw = makeJSONL([makeEntry({ tool: 'timestamped_tool', timestamp: ts })])
        ;(window.bridgeAPI.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(raw)
        render(<ActivityFeed />)
        await waitFor(() => {
            // The timestamp is rendered in a ml-auto span after the tool badge
            // It should be non-empty — check for any time-like text (HH:MM:SS)
            expect(screen.getByText('timestamped_tool')).toBeDefined()
            // formatTimestamp renders toLocaleTimeString — verify at least one
            // time string element is visible (contains ':')
            const allText = document.body.textContent ?? ''
            expect(allText).toMatch(/\d{1,2}:\d{2}/)
        })
    })
})
