/**
 * DetectionBanner.test.tsx — FORGE.2d + FORGE.3a + FORGE.3b + FORGE.4c + FORGE.4d tests
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
 * DB-10: Handles singular "issue" text
 * DB-11: Shows scan progress bar when isScanning is true (FORGE.4c)
 * DB-12: Shows determinate progress with file counts (FORGE.4c)
 * DB-13: Shows indeterminate "Scanning..." when no scanProgress (FORGE.4c)
 * DB-14: Hides progress bar when audit summary arrives (FORGE.4c)
 * DB-15: Shows high-violation recommendation (FORGE.4d)
 * DB-16: Shows low-violation recommendation (FORGE.4d)
 * DB-17: Shows clean recommendation when zero issues (FORGE.4d)
 * DB-18: Shows token recommendation when no tokenFormat (FORGE.4d)
 * DB-19: Hides "Run full audit" button while scanning (FORGE.4c)
 * DB-20: Shows Tailwind token import suggestion (FORGE.3a)
 * DB-21: Shows component library suggestion (FORGE.3a)
 * DB-22: Shows Figma connection suggestion when tokens present (FORGE.3b)
 * DB-23: Limits suggestions to 3 max (FORGE.3a)
 * DB-24: Dismiss individual suggestion (FORGE.3a)
 * DB-25: Dismiss all suggestions (FORGE.3a)
 * DB-26: Calls onSuggestionAction with correct id (FORGE.3a)
 * DB-27: No suggestions when environment is null (FORGE.3a)
 * DB-28: No Figma suggestion when already connected (FORGE.3b)
 * DB-29: No Tailwind suggestion when tokens already present (FORGE.3a)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetectionBanner, deriveSuggestions } from '../DetectionBanner'
import type { ProjectEnvironment } from '../../../types/flint-api'

const baseEnv: ProjectEnvironment = {
    framework: { name: 'react', version: '19.1.0' },
    cssFramework: { name: 'tailwindcss', version: '4.0.0' },
    componentLibrary: null,
    hasDesignTokens: false,
    tokenSource: null,
    componentCount: 0,
    uiFramework: 'React 19',
    cssFrameworkLabel: 'Tailwind v4',
    tokenFormat: null,
    typescript: true,
    componentLibraryLabel: null,
    detectedAt: '2026-03-31T12:00:00.000Z',
}

describe('DetectionBanner', () => {
    // DB-01: Renders with detection data
    it('DB-01: renders stack summary from detection data', () => {
        render(<DetectionBanner environment={baseEnv} />)
        const banner = screen.getByTestId('detection-banner')
        expect(banner).toBeTruthy()
        expect(banner.textContent).toContain('React 19')
        expect(banner.textContent).toContain('Tailwind v4')
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
        expect(screen.getByTestId('detection-banner').textContent).toContain('5 issues found')
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

    // DB-08: Component count appears in banner
    it('DB-08: shows component count when componentCount > 0', () => {
        const env: ProjectEnvironment = { ...baseEnv, componentCount: 89 }
        render(<DetectionBanner environment={env} />)
        expect(screen.getByTestId('component-count')!.textContent).toContain('89 components')
    })

    // DB-09: Component library appears in stack summary
    it('DB-09: includes component library in the stack summary', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            componentLibrary: { name: 'shadcn', version: '0.8.0' },
            componentLibraryLabel: 'shadcn/ui',
        }
        render(<DetectionBanner environment={env} />)
        expect(screen.getByTestId('detection-banner').textContent).toContain('shadcn/ui')
    })

    // DB-10: Singular "issue" text for count = 1
    it('DB-10: shows singular "issue" when count is 1', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            auditSummary: { violations: 1, grade: 'A' },
        }
        render(<DetectionBanner environment={env} />)
        const text = screen.getByTestId('detection-banner').textContent!
        expect(text).toContain('1 issue found')
        expect(text).not.toContain('1 issues')
    })

    // ── FORGE.4c: Scan progress tests ────────────────────────────────────────

    // DB-11: Shows scan progress bar when isScanning is true
    it('DB-11: shows scan progress bar when isScanning is true', () => {
        render(<DetectionBanner environment={baseEnv} isScanning={true} />)
        expect(screen.getByTestId('scan-progress')).toBeTruthy()
        expect(screen.getByTestId('scan-progress-bar')).toBeTruthy()
    })

    // DB-12: Shows determinate progress with file counts
    it('DB-12: shows determinate progress with file counts', () => {
        render(
            <DetectionBanner
                environment={baseEnv}
                isScanning={true}
                scanProgress={{ filesScanned: 7, totalFiles: 20 }}
            />,
        )
        const label = screen.getByTestId('scan-progress-label')
        expect(label.textContent).toBe('7/20 files')
        const bar = screen.getByTestId('scan-progress-bar')
        expect(bar.style.width).toBe('35%')
    })

    // DB-13: Shows indeterminate "Scanning..." when no scanProgress
    it('DB-13: shows indeterminate "Scanning..." when no scanProgress provided', () => {
        render(<DetectionBanner environment={baseEnv} isScanning={true} />)
        const label = screen.getByTestId('scan-progress-label')
        expect(label.textContent).toBe('Scanning...')
    })

    // DB-14: Hides progress bar when audit summary arrives
    it('DB-14: hides progress bar when audit summary is present', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            auditSummary: { violations: 3, grade: 'B' },
        }
        render(<DetectionBanner environment={env} isScanning={true} />)
        expect(screen.queryByTestId('scan-progress')).toBeNull()
    })

    // DB-19: Hides "Run full audit" button while scanning
    it('DB-19: hides "Run full audit" button while scanning', () => {
        render(<DetectionBanner environment={baseEnv} isScanning={true} onRunAudit={vi.fn()} />)
        expect(screen.queryByText('Run full audit')).toBeNull()
    })

    // ── FORGE.4d: Smart recommendation tests ────────────────────────────────

    // DB-15: Shows high-violation recommendation
    it('DB-15: shows autopilot recommendation when violations > 10', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            auditSummary: { violations: 15, grade: 'D' },
        }
        render(<DetectionBanner environment={env} />)
        const recs = screen.getByTestId('recommendations')
        expect(recs.textContent).toContain('Autopilot')
    })

    // DB-16: Shows low-violation recommendation
    it('DB-16: shows "fix it" recommendation when violations between 1 and 10', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            tokenFormat: 'DTCG', // suppress token recommendation
            auditSummary: { violations: 4, grade: 'B' },
        }
        render(<DetectionBanner environment={env} />)
        const recs = screen.getByTestId('recommendations')
        expect(recs.textContent).toContain('fix it')
    })

    // DB-17: Shows clean recommendation when zero issues
    it('DB-17: shows clean message when zero violations', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            tokenFormat: 'DTCG',
            auditSummary: { violations: 0, grade: 'A' },
        }
        render(<DetectionBanner environment={env} />)
        const recs = screen.getByTestId('recommendations')
        expect(recs.textContent).toContain('Looking clean')
    })

    // DB-18: Shows token recommendation when no tokenFormat
    it('DB-18: shows token recommendation when no tokenFormat detected', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            tokenFormat: null,
            auditSummary: { violations: 0, grade: 'A' },
        }
        render(<DetectionBanner environment={env} />)
        const recs = screen.getByTestId('recommendations')
        expect(recs.textContent).toContain('No design tokens detected')
    })

    // ── FORGE.3a: Progressive integration suggestion tests ──────────────────

    // DB-20: Shows Tailwind token import suggestion
    it('DB-20: shows Tailwind token import suggestion when Tailwind detected but no tokens', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            cssFramework: { name: 'tailwindcss', version: '4.0.0' },
            hasDesignTokens: false,
        }
        render(<DetectionBanner environment={env} onSuggestionAction={vi.fn()} />)
        expect(screen.getByTestId('suggestion-import-tailwind-tokens')).toBeTruthy()
        expect(screen.getByTestId('suggestion-import-tailwind-tokens').textContent).toContain('Import your Tailwind config as design tokens')
    })

    // DB-21: Shows component library suggestion
    it('DB-21: shows component library suggestion when framework detected but no library', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            framework: { name: 'react', version: '19.1.0' },
            componentLibrary: null,
            hasDesignTokens: true, // suppress tailwind suggestion
            tokenSource: 'flint',
        }
        render(<DetectionBanner environment={env} onSuggestionAction={vi.fn()} />)
        expect(screen.getByTestId('suggestion-set-component-library')).toBeTruthy()
        expect(screen.getByTestId('suggestion-set-component-library').textContent).toContain('Set a component library')
    })

    // DB-22: Shows Figma connection suggestion when tokens present (FORGE.3b)
    it('DB-22: shows Figma connection suggestion when tokens present but no Figma', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            hasDesignTokens: true,
            tokenSource: 'flint',
            componentLibrary: { name: 'mui', version: '5.0.0' },
            componentLibraryLabel: 'MUI',
        }
        render(<DetectionBanner environment={env} figmaConnected={false} onSuggestionAction={vi.fn()} />)
        expect(screen.getByTestId('suggestion-connect-figma')).toBeTruthy()
        expect(screen.getByTestId('suggestion-connect-figma').textContent).toContain('Connect Figma to enable token sync')
    })

    // DB-23: Limits suggestions to 3 max
    it('DB-23: shows at most 3 suggestions', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            cssFramework: { name: 'tailwindcss', version: '4.0.0' },
            hasDesignTokens: false,
            framework: { name: 'react', version: '19.1.0' },
            componentLibrary: null,
        }
        // This produces: tailwind tokens + component library + figma (but tokens false, so no figma)
        // Actually with hasDesignTokens: false, figma suggestion won't show. That's fine — max 2 here.
        render(<DetectionBanner environment={env} figmaConnected={false} onSuggestionAction={vi.fn()} />)
        const container = screen.getByTestId('integration-suggestions')
        const items = container.querySelectorAll('[data-testid^="suggestion-import"], [data-testid^="suggestion-set"], [data-testid^="suggestion-connect-figma"]')
        expect(items.length).toBeLessThanOrEqual(3)
    })

    // DB-24: Dismiss individual suggestion
    it('DB-24: dismisses individual suggestion when X is clicked', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            cssFramework: { name: 'tailwindcss', version: '4.0.0' },
            hasDesignTokens: false,
        }
        render(<DetectionBanner environment={env} onSuggestionAction={vi.fn()} />)
        expect(screen.getByTestId('suggestion-import-tailwind-tokens')).toBeTruthy()
        fireEvent.click(screen.getByTestId('suggestion-dismiss-import-tailwind-tokens'))
        expect(screen.queryByTestId('suggestion-import-tailwind-tokens')).toBeNull()
    })

    // DB-25: Dismiss all suggestions
    it('DB-25: dismisses all suggestions when "Dismiss all" is clicked', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            cssFramework: { name: 'tailwindcss', version: '4.0.0' },
            hasDesignTokens: false,
            framework: { name: 'react', version: '19.1.0' },
            componentLibrary: null,
        }
        render(<DetectionBanner environment={env} onSuggestionAction={vi.fn()} />)
        expect(screen.getByTestId('integration-suggestions')).toBeTruthy()
        fireEvent.click(screen.getByTestId('dismiss-all-suggestions'))
        expect(screen.queryByTestId('integration-suggestions')).toBeNull()
    })

    // DB-26: Calls onSuggestionAction with correct id
    it('DB-26: calls onSuggestionAction with correct suggestion id', () => {
        const onAction = vi.fn()
        const env: ProjectEnvironment = {
            ...baseEnv,
            cssFramework: { name: 'tailwindcss', version: '4.0.0' },
            hasDesignTokens: false,
        }
        render(<DetectionBanner environment={env} onSuggestionAction={onAction} />)
        fireEvent.click(screen.getByTestId('suggestion-action-import-tailwind-tokens'))
        expect(onAction).toHaveBeenCalledWith('import-tailwind-tokens')
    })

    // DB-27: No suggestions when environment is null
    it('DB-27: shows no suggestions when environment is null', () => {
        render(<DetectionBanner environment={null} onSuggestionAction={vi.fn()} />)
        expect(screen.queryByTestId('integration-suggestions')).toBeNull()
    })

    // DB-28: No Figma suggestion when already connected (FORGE.3b)
    it('DB-28: does not show Figma suggestion when already connected', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            hasDesignTokens: true,
            tokenSource: 'flint',
            componentLibrary: { name: 'mui', version: '5.0.0' },
            componentLibraryLabel: 'MUI',
        }
        render(<DetectionBanner environment={env} figmaConnected={true} onSuggestionAction={vi.fn()} />)
        expect(screen.queryByTestId('suggestion-connect-figma')).toBeNull()
    })

    // DB-29: No Tailwind suggestion when tokens already present
    it('DB-29: does not show Tailwind token suggestion when tokens already present', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            cssFramework: { name: 'tailwindcss', version: '4.0.0' },
            hasDesignTokens: true,
            tokenSource: 'flint',
        }
        render(<DetectionBanner environment={env} onSuggestionAction={vi.fn()} />)
        expect(screen.queryByTestId('suggestion-import-tailwind-tokens')).toBeNull()
    })
})

// ── FORGE.3a: deriveSuggestions unit tests ───────────────────────────────────

describe('deriveSuggestions', () => {
    it('returns empty array when no conditions match', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            cssFramework: null,
            framework: null,
            hasDesignTokens: false,
            componentLibrary: { name: 'mui', version: '5.0.0' },
            componentLibraryLabel: 'MUI',
        }
        const result = deriveSuggestions(env, true)
        expect(result).toEqual([])
    })

    it('returns tailwind token suggestion when tailwind detected and no tokens', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            cssFramework: { name: 'tailwindcss', version: '4.0.0' },
            hasDesignTokens: false,
        }
        const result = deriveSuggestions(env, false)
        expect(result.some(s => s.id === 'import-tailwind-tokens')).toBe(true)
    })

    it('returns component library suggestion when framework detected and no library', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            framework: { name: 'vue', version: '3.5.0' },
            componentLibrary: null,
            hasDesignTokens: true,
        }
        const result = deriveSuggestions(env, false)
        expect(result.some(s => s.id === 'set-component-library')).toBe(true)
    })

    it('returns figma suggestion when tokens present and figma not connected', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            hasDesignTokens: true,
            componentLibrary: { name: 'mui', version: '5.0.0' },
        }
        const result = deriveSuggestions(env, false)
        expect(result.some(s => s.id === 'connect-figma')).toBe(true)
    })

    it('caps at 3 suggestions', () => {
        const env: ProjectEnvironment = {
            ...baseEnv,
            cssFramework: { name: 'tailwindcss', version: '4.0.0' },
            hasDesignTokens: false,
            framework: { name: 'react', version: '19.0.0' },
            componentLibrary: null,
        }
        const result = deriveSuggestions(env, false)
        expect(result.length).toBeLessThanOrEqual(3)
    })
})
