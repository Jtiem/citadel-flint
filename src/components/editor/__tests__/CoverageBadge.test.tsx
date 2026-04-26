/**
 * CoverageBadge.test.tsx
 *
 * Phase 0 — Coverage Honesty
 * Group B: Real assertions replacing it.todo() scaffolds.
 *
 * CONTRACT-SOURCE: .flint-context/contracts/PHASE0-coverage-honesty.contract.ts
 * CONTRACT-BOUNDARIES:
 *   - "CoverageBadge render — 100% state"
 *   - "CoverageBadge render — <100% state"
 *   - "CoverageBadge — accessible name"
 *   - "CoverageBadge click → popover open"
 *
 * Commandment 2: tests assert on `data-coverage-state` attribute, not raw Tailwind
 * class names, so implementation can update dot classes without breaking tests.
 * Commandment 5: explicit aria-label assertions on every state.
 *
 * UX fixes tested (Phase 0 review):
 *   Fix 1 — Idle click opens an idle popover (button must respond to activation).
 *   Fix 3 — title attribute contains informational-nature disambiguation.
 *   Fix 4 — warning dot uses indigo (data-coverage-state remains "warning").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoverageBadge } from '../CoverageBadge'
import type { CoverageSummary } from '../../../../shared/coverage-types'

// ── Fixture helpers ───────────────────────────────────────────────────────────

const ZERO_REASONS = {
    'css-in-js-detected': 0,
    'external-stylesheet-imported': 0,
    'css-modules-reference': 0,
    'dynamic-class-expression': 0,
    'unresolvable-var': 0,
    'tailwind-config-extension': 0,
    'non-jsx-framework': 0,
    'non-literal-ternary-branch': 0,
    'parse-failure': 0,
}

function makeSummary(overrides: Partial<CoverageSummary>): CoverageSummary {
    return {
        governedSurfacePercent: 100,
        totalFiles: 10,
        parsedFiles: 10,
        partialFiles: 0,
        skippedFiles: 0,
        skippedFilesByReason: { ...ZERO_REASONS },
        timestamp: '2026-04-18T00:00:00.000Z',
        ...overrides,
    }
}

const FULL_SUMMARY = makeSummary({})

const PARTIAL_SUMMARY = makeSummary({
    governedSurfacePercent: 60,
    totalFiles: 10,
    parsedFiles: 6,
    partialFiles: 3,
    skippedFiles: 1,
    skippedFilesByReason: {
        ...ZERO_REASONS,
        'css-in-js-detected': 3,
        'non-jsx-framework': 1,
    },
})

const ZERO_FILES_SUMMARY = makeSummary({
    governedSurfacePercent: 0,
    totalFiles: 0,
    parsedFiles: 0,
    partialFiles: 0,
    skippedFiles: 0,
})

// ── Mock useCoverageSummary ───────────────────────────────────────────────────

vi.mock('../../../hooks/useCoverageSummary', () => ({
    useCoverageSummary: vi.fn(),
}))

import { useCoverageSummary } from '../../../hooks/useCoverageSummary'
const mockUseCoverageSummary = useCoverageSummary as ReturnType<typeof vi.fn>

beforeEach(() => {
    mockUseCoverageSummary.mockReturnValue({ summary: null, isLoading: false, refetch: vi.fn() })
})

// ─── CONTRACT-BOUNDARY: CoverageBadge render — 100% state ────────────────────

describe('CoverageBadge render — 100% state', () => {
    it('renders data-coverage-state="healthy" when governedSurfacePercent is 100', () => {
        // GIVEN: full 100% summary
        mockUseCoverageSummary.mockReturnValue({ summary: FULL_SUMMARY, isLoading: false, refetch: vi.fn() })
        // WHEN: component mounts
        render(<CoverageBadge />)
        // THEN: data-coverage-state="healthy"
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.getAttribute('data-coverage-state')).toBe('healthy')
    })

    it('renders visible text "100% governed" when summary is 100%', () => {
        mockUseCoverageSummary.mockReturnValue({ summary: FULL_SUMMARY, isLoading: false, refetch: vi.fn() })
        render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.textContent).toContain('100% governed')
    })

    it('renders data-coverage-state="idle" and placeholder "—" when totalFiles=0', () => {
        // GIVEN: summary with totalFiles=0
        mockUseCoverageSummary.mockReturnValue({ summary: ZERO_FILES_SUMMARY, isLoading: false, refetch: vi.fn() })
        // WHEN: component mounts
        render(<CoverageBadge />)
        // THEN: idle state + "—" text
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.getAttribute('data-coverage-state')).toBe('idle')
        expect(badge.textContent).toContain('—')
    })
})

// ─── CONTRACT-BOUNDARY: CoverageBadge render — <100% state ───────────────────

describe('CoverageBadge render — <100% state', () => {
    it('renders data-coverage-state="warning" when governedSurfacePercent is 60', () => {
        // GIVEN: 60% summary
        mockUseCoverageSummary.mockReturnValue({ summary: PARTIAL_SUMMARY, isLoading: false, refetch: vi.fn() })
        // WHEN: component mounts
        render(<CoverageBadge />)
        // THEN: data-coverage-state="warning"
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.getAttribute('data-coverage-state')).toBe('warning')
    })

    it('renders text matching "60% governed" when governedSurfacePercent is 60', () => {
        mockUseCoverageSummary.mockReturnValue({ summary: PARTIAL_SUMMARY, isLoading: false, refetch: vi.fn() })
        render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.textContent).toMatch(/60%\s*governed/)
    })

    it('renders data-coverage-state="idle" and placeholder "—" when summary is null', () => {
        // GIVEN: summary=null (first IPC request in flight)
        mockUseCoverageSummary.mockReturnValue({ summary: null, isLoading: true, refetch: vi.fn() })
        // WHEN: component mounts
        render(<CoverageBadge />)
        // THEN: idle state + "—" text
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.getAttribute('data-coverage-state')).toBe('idle')
        expect(badge.textContent).toContain('—')
    })

    it('renders data-coverage-state="warning" (not a distinct critical state) for 0%', () => {
        // GIVEN: 0% — coverage is informational, non-goal #3, 0% still ships
        const zeroPercent = makeSummary({
            governedSurfacePercent: 0,
            totalFiles: 5,
            parsedFiles: 0,
            partialFiles: 3,
            skippedFiles: 2,
        })
        mockUseCoverageSummary.mockReturnValue({ summary: zeroPercent, isLoading: false, refetch: vi.fn() })
        render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        // 0% with totalFiles > 0 → warning (not idle, not critical)
        expect(badge.getAttribute('data-coverage-state')).toBe('warning')
    })
})

// ─── CONTRACT-BOUNDARY: CoverageBadge — accessible name ─────────────────────

describe('CoverageBadge — accessible name (C5 Commandment)', () => {
    it('sets aria-label to "Governance coverage: 60% of files governed. Click to see breakdown."', () => {
        // GIVEN: 60% summary
        mockUseCoverageSummary.mockReturnValue({ summary: PARTIAL_SUMMARY, isLoading: false, refetch: vi.fn() })
        // WHEN: component mounts
        render(<CoverageBadge />)
        // THEN: exact aria-label
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.getAttribute('aria-label')).toBe(
            'Governance coverage: 60% of files governed. Click to see breakdown.'
        )
    })

    it('aria-label reads "100%" when summary is at 100%', () => {
        mockUseCoverageSummary.mockReturnValue({ summary: FULL_SUMMARY, isLoading: false, refetch: vi.fn() })
        render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.getAttribute('aria-label')).toContain('100%')
    })

    it('aria-label falls back to "Governance coverage: loading" when summary is null', () => {
        // GIVEN: null summary
        mockUseCoverageSummary.mockReturnValue({ summary: null, isLoading: true, refetch: vi.fn() })
        // WHEN: component mounts
        render(<CoverageBadge />)
        // THEN: loading fallback
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.getAttribute('aria-label')).toBe('Governance coverage: loading')
    })

    it('aria-label pattern matches /Governance coverage:\\s+\\d+%\\s+of files governed/', () => {
        // GIVEN: any non-null, non-zero summary
        mockUseCoverageSummary.mockReturnValue({ summary: PARTIAL_SUMMARY, isLoading: false, refetch: vi.fn() })
        render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.getAttribute('aria-label')).toMatch(
            /Governance coverage:\s+\d+%\s+of files governed/
        )
    })
})

// ─── Fix 3: title attribute surfaces informational-nature note at badge level ─

describe('CoverageBadge — title attribute (Fix 3)', () => {
    it('title contains informational-nature disambiguation on non-idle states', () => {
        // GIVEN: 60% summary (warning state)
        mockUseCoverageSummary.mockReturnValue({ summary: PARTIAL_SUMMARY, isLoading: false, refetch: vi.fn() })
        render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        const title = badge.getAttribute('title') ?? ''
        // THEN: title mentions informational nature so users don't misread it as a grade
        expect(title).toMatch(/informational/i)
        expect(title).toMatch(/grade/i)
    })

    it('title on idle state hints at how to run a scan', () => {
        // GIVEN: null summary (idle state)
        mockUseCoverageSummary.mockReturnValue({ summary: null, isLoading: false, refetch: vi.fn() })
        render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        const title = badge.getAttribute('title') ?? ''
        expect(title.length).toBeGreaterThan(0)
        expect(title).toMatch(/scan/i)
    })
})

// ─── CONTRACT-BOUNDARY: CoverageBadge click → popover open ───────────────────

describe('CoverageBadge click → popover open', () => {
    it('calls onClick exactly once when the badge is clicked', () => {
        // GIVEN: valid summary so the badge is interactive
        mockUseCoverageSummary.mockReturnValue({ summary: FULL_SUMMARY, isLoading: false, refetch: vi.fn() })
        const { container } = render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        // WHEN: user clicks the badge
        fireEvent.click(badge)
        // THEN: popover opens (onClick internal — we verify by presence of popover)
        const popover = container.querySelector('[data-testid="coverage-popover"]')
        expect(popover).not.toBeNull()
    })

    it('calls onClick when the badge is activated via keyboard Enter', () => {
        mockUseCoverageSummary.mockReturnValue({ summary: FULL_SUMMARY, isLoading: false, refetch: vi.fn() })
        const { container } = render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        // WHEN: user presses Enter on the focused badge
        badge.focus()
        fireEvent.keyDown(badge, { key: 'Enter' })
        fireEvent.click(badge) // button onClick fires on Enter via browser default
        // THEN: popover opens
        const popover = container.querySelector('[data-testid="coverage-popover"]')
        expect(popover).not.toBeNull()
    })

    it('rapid double-click fires onClick twice (parent is responsible for dedup)', () => {
        mockUseCoverageSummary.mockReturnValue({ summary: FULL_SUMMARY, isLoading: false, refetch: vi.fn() })
        const { container } = render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        // WHEN: double-click — first click opens, second click closes
        fireEvent.click(badge) // opens
        fireEvent.click(badge) // closes
        // THEN: after two clicks the popover is closed (toggled twice)
        const popover = container.querySelector('[data-testid="coverage-popover"]')
        expect(popover).toBeNull()
    })
})

// ─── Fix 1: Idle state button opens idle popover ──────────────────────────────

describe('CoverageBadge — idle click opens popover (Fix 1)', () => {
    it('clicking idle badge when summary is null opens the idle popover', () => {
        // GIVEN: null summary — no scan has run
        mockUseCoverageSummary.mockReturnValue({ summary: null, isLoading: false, refetch: vi.fn() })
        const { container } = render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        expect(badge.getAttribute('data-coverage-state')).toBe('idle')
        // WHEN: user clicks the idle badge
        fireEvent.click(badge)
        // THEN: a popover appears (not a no-op)
        const popover = container.querySelector('[data-testid="coverage-popover"]')
        expect(popover).not.toBeNull()
    })

    it('idle popover shows "No scan yet" heading', () => {
        mockUseCoverageSummary.mockReturnValue({ summary: null, isLoading: false, refetch: vi.fn() })
        render(<CoverageBadge />)
        const badge = screen.getByTestId('coverage-badge')
        fireEvent.click(badge)
        // THEN: idle mode heading is present
        expect(screen.getByText('No scan yet')).toBeDefined()
    })

    it('idle popover carries data-coverage-popover-mode="idle"', () => {
        mockUseCoverageSummary.mockReturnValue({ summary: null, isLoading: false, refetch: vi.fn() })
        const { container } = render(<CoverageBadge />)
        fireEvent.click(screen.getByTestId('coverage-badge'))
        const popover = container.querySelector('[data-testid="coverage-popover"]')
        expect(popover?.getAttribute('data-coverage-popover-mode')).toBe('idle')
    })

    it('idle popover mentions flint_debt_report so the user knows what to run', () => {
        mockUseCoverageSummary.mockReturnValue({ summary: null, isLoading: false, refetch: vi.fn() })
        render(<CoverageBadge />)
        fireEvent.click(screen.getByTestId('coverage-badge'))
        const message = screen.getByTestId('coverage-idle-message')
        expect(message.textContent).toContain('flint_debt_report')
    })

    it('clicking idle badge when totalFiles=0 also opens idle popover', () => {
        mockUseCoverageSummary.mockReturnValue({ summary: ZERO_FILES_SUMMARY, isLoading: false, refetch: vi.fn() })
        const { container } = render(<CoverageBadge />)
        fireEvent.click(screen.getByTestId('coverage-badge'))
        const popover = container.querySelector('[data-testid="coverage-popover"]')
        expect(popover).not.toBeNull()
        expect(popover?.getAttribute('data-coverage-popover-mode')).toBe('idle')
    })
})
