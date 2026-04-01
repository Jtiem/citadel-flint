/**
 * DetectionBanner.test.tsx — FORGE.2d tests
 *
 * DB-01: Renders with detection data showing framework stack
 * DB-02: Does not render when environment is null
 * DB-03: Dismisses on close button click
 * DB-04: Shows audit summary when present
 * DB-05: Shows "Run full audit" button when no audit summary
 * DB-06: Calls onRunAudit when audit button is clicked
 * DB-07: Does not show "Run full audit" when audit summary exists
 * DB-08: Shows TypeScript in the stack summary
 * DB-09: Shows component library in the stack summary
 * DB-10: Handles singular "violation" text
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetectionBanner } from '../DetectionBanner'
import type { ProjectEnvironment } from '../../../types/flint-api'

const baseEnv: ProjectEnvironment = {
    uiFramework: 'React',
    cssFramework: 'Tailwind v4',
    tokenFormat: null,
    typescript: true,
    componentLibrary: null,
    detectedAt: '2026-03-31T12:00:00.000Z',
}

describe('DetectionBanner', () => {
    // DB-01: Renders with detection data
    it('DB-01: renders stack summary from detection data', () => {
        render(<DetectionBanner environment={baseEnv} />)
        const banner = screen.getByTestId('detection-banner')
        expect(banner).toBeTruthy()
        expect(banner.textContent).toContain('React')
        expect(banner.textContent).toContain('Tailwind v4')
        expect(banner.textContent).toContain('TypeScript')
    })

    // DB-02: Does not render when environment is null
    it('DB-02: does not render when environment is null', () => {
        render(<DetectionBanner environment={null} />)
        expect(screen.queryByTestId('detection-banner')).toBeNull()
    })

    // DB-03: Dismisses on close button click
    it('DB-03: dismisses when close button is clicked', () => {
        render(<DetectionBanner environment={baseEnv} />)
        expect(screen.getByTestId('detection-banner')).toBeTruthy()
        fireEvent.click(screen.getByTestId('detection-banner-dismiss'))
        expect(screen.queryByTestId('detection-banner')).toBeNull()
    })

    // DB-04: Shows audit summary
    it('DB-04: shows audit summary when present', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            auditSummary: { violations: 5, grade: 'C' },
        }
        render(<DetectionBanner environment={env} />)
        expect(screen.getByTestId('detection-banner').textContent).toContain('5 violations found')
    })

    // DB-05: Shows "Run full audit" button when no audit summary
    it('DB-05: shows "Run full audit" button when no audit summary', () => {
        render(<DetectionBanner environment={baseEnv} onRunAudit={vi.fn()} />)
        expect(screen.getByText('Run full audit')).toBeTruthy()
    })

    // DB-06: Calls onRunAudit when clicked
    it('DB-06: calls onRunAudit when audit button is clicked', () => {
        const onRunAudit = vi.fn()
        render(<DetectionBanner environment={baseEnv} onRunAudit={onRunAudit} />)
        fireEvent.click(screen.getByText('Run full audit'))
        expect(onRunAudit).toHaveBeenCalledOnce()
    })

    // DB-07: No "Run full audit" when audit summary exists
    it('DB-07: does not show "Run full audit" when audit summary exists', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            auditSummary: { violations: 3, grade: 'B' },
        }
        render(<DetectionBanner environment={env} onRunAudit={vi.fn()} />)
        expect(screen.queryByText('Run full audit')).toBeNull()
    })

    // DB-08: TypeScript appears in stack summary
    it('DB-08: includes TypeScript in the stack summary when detected', () => {
        render(<DetectionBanner environment={baseEnv} />)
        expect(screen.getByTestId('detection-banner').textContent).toContain('TypeScript')
    })

    // DB-09: Component library appears in stack summary
    it('DB-09: includes component library in the stack summary', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            componentLibrary: 'shadcn',
        }
        render(<DetectionBanner environment={env} />)
        expect(screen.getByTestId('detection-banner').textContent).toContain('shadcn')
    })

    // DB-10: Singular "violation" text for count = 1
    it('DB-10: shows singular "violation" when count is 1', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            auditSummary: { violations: 1, grade: 'A' },
        }
        render(<DetectionBanner environment={env} />)
        const text = screen.getByTestId('detection-banner').textContent!
        expect(text).toContain('1 violation found')
        expect(text).not.toContain('1 violations')
    })
})
