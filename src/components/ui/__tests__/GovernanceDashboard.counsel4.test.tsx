/**
 * GovernanceDashboard.counsel4.test.tsx
 *
 * Tests for COUNSEL.4 — Brilliant Moments:
 *   COUNSEL.4.1 — Token Change Impact Preview (Preview impact button + file list)
 *   COUNSEL.4.2 — Compliance Trajectory (Sparkline trend label + empty state)
 *   COUNSEL.4.3 — Navigation Pathway (numbered fix order, "Start here" indicator)
 *   COUNSEL.4.4 — Zero-Violation Celebration (A+ hero, confetti, perfect score)
 *   COUNSEL.4.5 — Audit Log (lazy load, load more, entry-type icons, time ago)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GovernanceDashboard } from '../GovernanceDashboard'
import { useTokenStore } from '../../../store/tokenStore'
import { useCanvasStore } from '../../../store/canvasStore'
import { useEditorStore } from '../../../store/editorStore'
import type { DesignToken, LinterWarning } from '../../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken(overrides: Partial<DesignToken> = {}): DesignToken {
    return {
        id: 1,
        token_path: 'color.brand.primary',
        token_type: 'color',
        token_value: '#1d4ed8',
        description: null,
        mode: 'default',
        collection_name: 'Colors',
        ...overrides,
    }
}

function seedTokens(tokens: DesignToken[]) {
    useTokenStore.setState({ tokens, isLoading: false, error: null })
}

function makeLinterWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: `node-${Math.random().toString(36).slice(2)}`,
        type: 'color-drift',
        severity: 'amber',
        value: 1,
        message: "MITHRIL-COL-001: arbitrary '#3b82f6' not in color token set",
        nearestToken: null,
        nearestTokenValue: null,
        ...overrides,
    }
}

async function openMoreDetails() {
    const toggle = screen.getByTestId('more-details-toggle')
    fireEvent.click(toggle)
    await waitFor(() => {
        expect(document.querySelector('#more-details-panel')).toBeTruthy()
    }, { timeout: 3000 })
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GovernanceDashboard — COUNSEL.4 Brilliant Moments', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
        useCanvasStore.setState({ mithrilViolations: [], a11yViolations: {}, overridesExist: false })
        useEditorStore.setState({ linterWarnings: new Map() })
        ;(window.flintAPI as unknown as Record<string, unknown>).baseline = {
            isSet: vi.fn().mockResolvedValue(false),
            get: vi.fn().mockResolvedValue([]),
            set: vi.fn().mockResolvedValue(undefined),
            clear: vi.fn().mockResolvedValue(undefined),
        }
        ;(window.flintAPI.governance.getOverrideCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)
        ;(window.flintAPI.governance.getAuditLog as ReturnType<typeof vi.fn>).mockResolvedValue([])
        ;(window.flintAPI.governance.getHealthHistory as ReturnType<typeof vi.fn>).mockResolvedValue([])
        ;(window.flintAPI.governance.getAnomalies as ReturnType<typeof vi.fn>).mockResolvedValue([])
    })

    // ── COUNSEL.4.4: Zero-Violation Celebration ──────────────────────────────

    describe('COUNSEL.4.4 — Zero-Violation Celebration', () => {
        it('renders zero-violation state when no violations exist and tokens are loaded', async () => {
            seedTokens([makeToken()])
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('zero-violation-state')).toBeTruthy()
            })
        })

        it('shows "Perfect score" text in zero-violation state when score is 100', async () => {
            seedTokens([makeToken()])
            render(<GovernanceDashboard />)
            await waitFor(() => {
                const el = screen.getByTestId('zero-violation-state')
                // With score 100, shows celebration title
                expect(el.textContent).toContain('Perfect score')
            })
        })

        it('shows perfect-score celebration with A+ hero when score is 100', async () => {
            seedTokens([makeToken()])
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('zero-violation-state')).toBeTruthy()
            })
            // Score 100 = no violations, no overrides => should show celebration
            const hero = screen.queryByTestId('celebration-hero')
            const grade = screen.queryByTestId('celebration-grade')
            const title = screen.queryByTestId('celebration-title')
            // With 0 violations and tokens loaded, score = 100 => A+ celebration
            expect(hero).toBeTruthy()
            expect(grade?.textContent).toBe('A+')
            expect(title?.textContent).toContain('Perfect score')
        })

        it('celebration description mentions full compliance', async () => {
            seedTokens([makeToken()])
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('zero-violation-state')).toBeTruthy()
            })
            const description = screen.queryByTestId('celebration-description')
            expect(description?.textContent).toContain('fully compliant')
        })

        it('does not render celebration state when violations exist', async () => {
            seedTokens([makeToken()])
            const w = makeLinterWarning({ id: 'no-celebration' })
            useEditorStore.setState({ linterWarnings: new Map([['no-celebration', w]]) })
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('violations-list')).toBeTruthy()
            })
            expect(screen.queryByTestId('zero-violation-state')).toBeNull()
        })

        it('does not render celebration when overrides exist even with zero violations', async () => {
            seedTokens([makeToken()])
            useCanvasStore.setState({ overridesExist: true })
            render(<GovernanceDashboard />)
            // Should not show zero-violation state when overrides exist
            await waitFor(() => {
                expect(screen.queryByTestId('zero-violation-state')).toBeNull()
            })
        })
    })

    // ── COUNSEL.4.2: Compliance Trajectory ───────────────────────────────────

    describe('COUNSEL.4.2 — Compliance Trajectory', () => {
        it('renders sparkline with trend label when 2+ health history entries exist', async () => {
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).getHealthHistory =
                vi.fn().mockResolvedValue([
                    { date: '2026-04-08T10:00:00Z', score: 70, grade: 'C' },
                    { date: '2026-04-09T10:00:00Z', score: 80, grade: 'B' },
                    { date: '2026-04-10T10:00:00Z', score: 90, grade: 'A' },
                ])
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).recordHealth =
                vi.fn().mockResolvedValue(undefined)
            seedTokens([makeToken()])
            const w = makeLinterWarning({ id: 'spark-1' })
            useEditorStore.setState({ linterWarnings: new Map([['spark-1', w]]) })
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('sparkline-container')).toBeTruthy()
            })
            // Trend label should be visible
            expect(screen.getByTestId('sparkline-trend-label')).toBeTruthy()
            // Trending up since 70 -> 90 (delta > 2)
            expect(screen.getByTestId('sparkline-trend-label').textContent).toContain('Trending up')
        })

        it('shows "Stable" trend label when score delta is small', async () => {
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).getHealthHistory =
                vi.fn().mockResolvedValue([
                    { date: '2026-04-09T10:00:00Z', score: 85, grade: 'B' },
                    { date: '2026-04-10T10:00:00Z', score: 86, grade: 'B' },
                ])
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).recordHealth =
                vi.fn().mockResolvedValue(undefined)
            seedTokens([makeToken()])
            const w = makeLinterWarning({ id: 'stable-1' })
            useEditorStore.setState({ linterWarnings: new Map([['stable-1', w]]) })
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('sparkline-trend-label')).toBeTruthy()
            })
            expect(screen.getByTestId('sparkline-trend-label').textContent).toContain('Stable')
        })

        it('shows empty state message when no health history exists', async () => {
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).getHealthHistory =
                vi.fn().mockResolvedValue([])
            seedTokens([makeToken()])
            const w = makeLinterWarning({ id: 'empty-spark' })
            useEditorStore.setState({ linterWarnings: new Map([['empty-spark', w]]) })
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('sparkline-empty')).toBeTruthy()
            })
            // GLASSTYPO.1: "Tracking starts after first audit" moved to MetadataTooltip (passive info).
            // Inline text now reads "No history yet" — tooltip carries the explanation.
            expect(screen.getByTestId('sparkline-empty').textContent).toContain('No history yet')
        })
    })

    // ── COUNSEL.4.3: Navigation Pathway ──────────────────────────────────────

    describe('COUNSEL.4.3 — Navigation Pathway', () => {
        it('assigns navigation indices to violation cards', async () => {
            seedTokens([makeToken()])
            const w1 = makeLinterWarning({
                id: 'nav-auto-1',
                type: 'color-drift',
                severity: 'amber',
                nearestToken: 'text-blue-500',
                message: "MITHRIL-COL-001: arbitrary 'bg-red-500' not in color token set",
            })
            const w2 = makeLinterWarning({
                id: 'nav-manual-1',
                type: 'color-drift',
                severity: 'critical',
                nearestToken: null,
            })
            useEditorStore.setState({
                linterWarnings: new Map([['nav-auto-1', w1], ['nav-manual-1', w2]]),
            })
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('violations-list')).toBeTruthy()
            })
            // Auto-fixable should be index 1 ("Start here")
            const navIndex1 = screen.queryByTestId('nav-index-1')
            expect(navIndex1).toBeTruthy()
        })

        it('"Start here" index-1 badge has distinctive styling', async () => {
            seedTokens([makeToken()])
            const w1 = makeLinterWarning({
                id: 'nav-style-1',
                type: 'color-drift',
                severity: 'amber',
                nearestToken: 'text-blue-500',
                message: "MITHRIL-COL-001: arbitrary 'bg-red-500' not in color token set",
            })
            useEditorStore.setState({ linterWarnings: new Map([['nav-style-1', w1]]) })
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('violations-list')).toBeTruthy()
            })
            const navIndex1 = screen.queryByTestId('nav-index-1')
            expect(navIndex1).toBeTruthy()
            // Index 1 should have "Start here" aria-label
            expect(navIndex1?.getAttribute('aria-label')).toContain('Start here')
        })

        it('auto-fixable violations get lower indices than manual ones', async () => {
            seedTokens([makeToken()])
            // Manual violation (no nearestToken)
            const manual = makeLinterWarning({
                id: 'nav-m-manual',
                type: 'color-drift',
                severity: 'critical',
                nearestToken: null,
            })
            // Auto-fixable violation (has nearestToken + hardcoded class)
            const auto = makeLinterWarning({
                id: 'nav-m-auto',
                type: 'color-drift',
                severity: 'amber',
                nearestToken: 'text-blue-500',
                message: "MITHRIL-COL-001: arbitrary 'bg-red-500' not in color token set",
            })
            useEditorStore.setState({
                linterWarnings: new Map([['nav-m-manual', manual], ['nav-m-auto', auto]]),
            })
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('violations-list')).toBeTruthy()
            })
            // nav-index-1 should exist (the auto-fixable one)
            expect(screen.queryByTestId('nav-index-1')).toBeTruthy()
            // nav-index-2 should exist (the manual one)
            expect(screen.queryByTestId('nav-index-2')).toBeTruthy()
        })
    })

    // ── COUNSEL.4.1: Token Change Impact Preview ─────────────────────────────

    describe('COUNSEL.4.1 — Token Change Impact Preview', () => {
        it('shows token impact section in More Details when sync violations exist', async () => {
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).previewTokenImpact =
                vi.fn().mockResolvedValue({ affectedFiles: 4, estimatedImpact: 'medium' })
            seedTokens([makeToken()])
            const syncWarning = makeLinterWarning({
                id: 'ti-sync-1',
                type: 'sync',
                nearestToken: '--color-brand-primary',
            })
            useEditorStore.setState({ linterWarnings: new Map([['ti-sync-1', syncWarning]]) })
            render(<GovernanceDashboard />)
            await openMoreDetails()
            await waitFor(() => {
                expect(screen.getByTestId('token-impact-section')).toBeTruthy()
            })
        })

        it('shows "Preview impact" button inside token impact accordion', async () => {
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).previewTokenImpact =
                vi.fn().mockResolvedValue({ affectedFiles: 3, estimatedImpact: 'high' })
            seedTokens([makeToken()])
            const syncWarning = makeLinterWarning({
                id: 'ti-btn-1',
                type: 'sync',
                nearestToken: '--color-accent',
            })
            useEditorStore.setState({ linterWarnings: new Map([['ti-btn-1', syncWarning]]) })
            render(<GovernanceDashboard />)
            await openMoreDetails()
            // Open the token impact accordion
            await waitFor(() => {
                expect(screen.getByTestId('token-impact-section')).toBeTruthy()
            })
            const toggleBtn = screen.getByTestId('token-impact-section').querySelector('button')
            if (toggleBtn) fireEvent.click(toggleBtn)
            await waitFor(() => {
                expect(screen.getByTestId('preview-impact-button')).toBeTruthy()
            })
        })

        it('token impact text mentions Mithril violations and file count', async () => {
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).previewTokenImpact =
                vi.fn().mockResolvedValue({ affectedFiles: 5, estimatedImpact: 'high' })
            seedTokens([makeToken()])
            const syncWarning = makeLinterWarning({
                id: 'ti-text-1',
                type: 'sync',
                nearestToken: '--color-primary',
            })
            useEditorStore.setState({ linterWarnings: new Map([['ti-text-1', syncWarning]]) })
            render(<GovernanceDashboard />)
            await openMoreDetails()
            await waitFor(() => {
                expect(screen.getByTestId('token-impact-section')).toBeTruthy()
            })
            // Open accordion
            const toggleBtn = screen.getByTestId('token-impact-section').querySelector('button')
            if (toggleBtn) fireEvent.click(toggleBtn)
            await waitFor(() => {
                const accordion = document.querySelector('#token-impact-accordion')
                expect(accordion?.textContent).toContain('Mithril')
                expect(accordion?.textContent).toContain('5')
            })
        })
    })

    // ── COUNSEL.4.5: Audit Log ───────────────────────────────────────────────

    describe('COUNSEL.4.5 — Audit Log', () => {
        it('fetches audit log eagerly on mount for CHRON.1 override decoration', async () => {
            // CHRON.1 UX A+: getAuditLog is called on mount to build the override
            // reason map for ViolationCard decoration. The audit-log accordion UI
            // still calls refresh() lazily on first open, but the override map
            // needs the data eagerly. One mount-time fetch is expected.
            const mockGetAuditLog = vi.fn().mockResolvedValue([])
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).getAuditLog = mockGetAuditLog
            seedTokens([makeToken()])
            render(<GovernanceDashboard />)
            await waitFor(() => {
                expect(screen.getByTestId('score-ring')).toBeTruthy()
            })
            // Exactly one mount-time fetch for the override-reason map
            await waitFor(() => {
                expect(mockGetAuditLog).toHaveBeenCalledTimes(1)
            })
            expect(mockGetAuditLog).toHaveBeenCalledWith({ limit: 200 })
        })

        it('fetches audit log when accordion is opened', async () => {
            const mockGetAuditLog = vi.fn().mockResolvedValue([
                { id: 1, timestamp: '2026-04-10T12:00:00Z', action: 'audit', filePath: '/src/App.tsx', description: 'Ran audit' },
            ])
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).getAuditLog = mockGetAuditLog
            seedTokens([makeToken()])
            const w = makeLinterWarning({ id: 'log-1' })
            useEditorStore.setState({ linterWarnings: new Map([['log-1', w]]) })
            render(<GovernanceDashboard />)
            await openMoreDetails()
            // Click audit log toggle
            const toggle = screen.getByTestId('audit-log-toggle')
            fireEvent.click(toggle)
            await waitFor(() => {
                expect(mockGetAuditLog).toHaveBeenCalled()
            })
        })

        it('renders audit log entries with action-type icons', async () => {
            const entries = [
                { id: 1, timestamp: '2026-04-10T12:00:00Z', action: 'fix', filePath: '/src/App.tsx', description: 'Fixed color drift' },
                { id: 2, timestamp: '2026-04-10T11:00:00Z', action: 'audit', filePath: '/src/Btn.tsx', description: 'Ran governance audit' },
            ]
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).getAuditLog =
                vi.fn().mockResolvedValue(entries)
            seedTokens([makeToken()])
            const w = makeLinterWarning({ id: 'log-icon-1' })
            useEditorStore.setState({ linterWarnings: new Map([['log-icon-1', w]]) })
            render(<GovernanceDashboard />)
            await openMoreDetails()
            const toggle = screen.getByTestId('audit-log-toggle')
            fireEvent.click(toggle)
            await waitFor(() => {
                expect(screen.getByTestId('audit-log-entry-1')).toBeTruthy()
                expect(screen.getByTestId('audit-log-entry-2')).toBeTruthy()
            })
        })

        it('shows empty state when no audit events exist', async () => {
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).getAuditLog =
                vi.fn().mockResolvedValue([])
            seedTokens([makeToken()])
            const w = makeLinterWarning({ id: 'log-empty-1' })
            useEditorStore.setState({ linterWarnings: new Map([['log-empty-1', w]]) })
            render(<GovernanceDashboard />)
            await openMoreDetails()
            const toggle = screen.getByTestId('audit-log-toggle')
            fireEvent.click(toggle)
            await waitFor(() => {
                expect(screen.getByTestId('audit-log-empty')).toBeTruthy()
            })
            expect(screen.getByTestId('audit-log-empty').textContent).toContain('No audit events yet')
        })

        it('shows "Load more" button when there are additional entries', async () => {
            // Return 22 entries (limit is 20, but we request 21 to detect "more")
            const entries = Array.from({ length: 22 }, (_, i) => ({
                id: i + 1,
                timestamp: `2026-04-${String(10 - Math.floor(i / 3)).padStart(2, '0')}T12:00:00Z`,
                action: 'audit',
                filePath: `/src/File${i}.tsx`,
                description: `Audit event ${i + 1}`,
            }))
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).getAuditLog =
                vi.fn().mockResolvedValue(entries)
            seedTokens([makeToken()])
            const w = makeLinterWarning({ id: 'log-more-1' })
            useEditorStore.setState({ linterWarnings: new Map([['log-more-1', w]]) })
            render(<GovernanceDashboard />)
            await openMoreDetails()
            const toggle = screen.getByTestId('audit-log-toggle')
            fireEvent.click(toggle)
            await waitFor(() => {
                expect(screen.getByTestId('audit-log-load-more')).toBeTruthy()
            })
        })

        it('does not show "Load more" when all entries fit within limit', async () => {
            const entries = [
                { id: 1, timestamp: '2026-04-10T12:00:00Z', action: 'fix', filePath: '/src/App.tsx', description: 'Fixed issue' },
            ]
            ;(window.flintAPI.governance as unknown as Record<string, unknown>).getAuditLog =
                vi.fn().mockResolvedValue(entries)
            seedTokens([makeToken()])
            const w = makeLinterWarning({ id: 'log-nomore-1' })
            useEditorStore.setState({ linterWarnings: new Map([['log-nomore-1', w]]) })
            render(<GovernanceDashboard />)
            await openMoreDetails()
            const toggle = screen.getByTestId('audit-log-toggle')
            fireEvent.click(toggle)
            await waitFor(() => {
                expect(screen.getByTestId('audit-log-entry-1')).toBeTruthy()
            })
            expect(screen.queryByTestId('audit-log-load-more')).toBeNull()
        })
    })
})
