import { describe, it, expect } from 'vitest'
import { composeHeraldPrompt, resolveCategoryLabel } from '../heraldPrompt'
import type { HeraldViolation } from '../heraldPrompt'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const driftViolation: HeraldViolation = {
    category: 'design-drift',
    summary: 'bg-blue-500 drifts from token brand.primary (Delta-E 4.2)',
    severity: 'critical',
}

const a11yViolation: HeraldViolation = {
    category: 'accessibility',
    summary: 'Image missing alt attribute (WCAG 1.1.1)',
    severity: 'critical',
}

const overrideViolation: HeraldViolation = {
    category: 'override',
    summary: 'color-drift rule is overridden (3 components affected)',
    severity: 'warning',
}

// ── resolveCategoryLabel ──────────────────────────────────────────────────────

describe('resolveCategoryLabel', () => {
    it('returns "design drift" for all design-drift violations', () => {
        expect(resolveCategoryLabel([driftViolation])).toBe('design drift')
    })

    it('returns "accessibility" for all accessibility violations', () => {
        expect(resolveCategoryLabel([a11yViolation])).toBe('accessibility')
    })

    it('returns "override" for all override violations', () => {
        expect(resolveCategoryLabel([overrideViolation])).toBe('override')
    })

    it('returns "governance" for mixed categories', () => {
        expect(resolveCategoryLabel([driftViolation, a11yViolation])).toBe('governance')
    })

    it('returns "governance" for empty array', () => {
        expect(resolveCategoryLabel([])).toBe('governance')
    })

    it('returns "governance" for all three categories mixed', () => {
        expect(resolveCategoryLabel([driftViolation, a11yViolation, overrideViolation])).toBe('governance')
    })
})

// ── composeHeraldPrompt ───────────────────────────────────────────────────────

describe('composeHeraldPrompt', () => {
    // ── Zero violations ───────────────────────────────────────────────────────

    it('returns empty string for 0 violations', () => {
        const result = composeHeraldPrompt({ filePath: 'src/Button.tsx', violations: [] })
        expect(result).toBe('')
    })

    // ── Singular form ─────────────────────────────────────────────────────────

    it('uses singular "violation" for 1 violation', () => {
        const result = composeHeraldPrompt({
            filePath: 'src/Button.tsx',
            violations: [driftViolation],
        })
        expect(result).toContain('Fix the 1 design drift violation in')
        expect(result).not.toContain('violations')
    })

    // ── Plural form ───────────────────────────────────────────────────────────

    it('uses plural "violations" for 2+ violations', () => {
        const result = composeHeraldPrompt({
            filePath: 'src/Button.tsx',
            violations: [driftViolation, { ...driftViolation, summary: 'text-gray-700 drifts from token neutral.text' }],
        })
        expect(result).toContain('Fix the 2 design drift violations in')
    })

    // ── Category labels ───────────────────────────────────────────────────────

    it('uses "design drift" label when all violations are design-drift', () => {
        const result = composeHeraldPrompt({
            filePath: 'src/Header.tsx',
            violations: [driftViolation, { ...driftViolation, summary: 'Another drift' }],
        })
        expect(result).toContain('design drift')
    })

    it('uses "accessibility" label when all violations are accessibility', () => {
        const result = composeHeraldPrompt({
            filePath: 'src/Nav.tsx',
            violations: [a11yViolation, { ...a11yViolation, summary: 'Button missing aria-label' }],
        })
        expect(result).toContain('accessibility')
        expect(result).not.toContain('governance')
    })

    it('uses "override" label when all violations are overrides', () => {
        const result = composeHeraldPrompt({
            filePath: 'src/Sidebar.tsx',
            violations: [overrideViolation],
        })
        expect(result).toContain('override violation in')
    })

    it('uses "governance" label for mixed categories', () => {
        const result = composeHeraldPrompt({
            filePath: 'src/Header.tsx',
            violations: [driftViolation, a11yViolation, overrideViolation],
        })
        expect(result).toContain('governance')
    })

    // ── File path format ──────────────────────────────────────────────────────

    it('wraps file path in backticks', () => {
        const result = composeHeraldPrompt({
            filePath: 'src/components/Header.tsx',
            violations: [driftViolation],
        })
        expect(result).toContain('`src/components/Header.tsx`')
    })

    it('handles file paths with slashes correctly', () => {
        const result = composeHeraldPrompt({
            filePath: 'src/components/ui/Button.tsx',
            violations: [driftViolation],
        })
        expect(result).toContain('`src/components/ui/Button.tsx`')
    })

    // ── Bullet list ───────────────────────────────────────────────────────────

    it('lists each violation summary as a bullet', () => {
        const violations: HeraldViolation[] = [
            { category: 'design-drift', summary: 'bg-blue-500 drifts from token brand.primary', severity: 'critical' },
            { category: 'design-drift', summary: 'text-gray-700 drifts from token neutral.text', severity: 'warning' },
            { category: 'design-drift', summary: 'shadow-lg has no matching token', severity: 'warning' },
        ]
        const result = composeHeraldPrompt({ filePath: 'src/Header.tsx', violations })
        expect(result).toContain('- bg-blue-500 drifts from token brand.primary')
        expect(result).toContain('- text-gray-700 drifts from token neutral.text')
        expect(result).toContain('- shadow-lg has no matching token')
    })

    it('counts 3 violations correctly', () => {
        const violations: HeraldViolation[] = [
            { category: 'design-drift', summary: 'First', severity: 'critical' },
            { category: 'design-drift', summary: 'Second', severity: 'warning' },
            { category: 'design-drift', summary: 'Third', severity: 'warning' },
        ]
        const result = composeHeraldPrompt({ filePath: 'src/Header.tsx', violations })
        expect(result).toContain('Fix the 3 design drift violations')
    })

    // ── flint_fix hint ────────────────────────────────────────────────────────

    it('always ends with the flint_fix hint line', () => {
        const result1 = composeHeraldPrompt({
            filePath: 'src/A.tsx',
            violations: [driftViolation],
        })
        expect(result1.trim().split('\n').at(-1)).toBe(
            'Use `flint_fix` with dry_run:true first to preview changes.'
        )
    })

    it('flint_fix hint is always the last line regardless of violation count', () => {
        const violations: HeraldViolation[] = [
            { category: 'accessibility', summary: 'A11y issue 1', severity: 'critical' },
            { category: 'accessibility', summary: 'A11y issue 2', severity: 'warning' },
        ]
        const result = composeHeraldPrompt({ filePath: 'src/B.tsx', violations })
        const lines = result.trim().split('\n')
        expect(lines.at(-1)).toBe('Use `flint_fix` with dry_run:true first to preview changes.')
    })

    // ── Output structure ──────────────────────────────────────────────────────

    it('header is the first line', () => {
        const result = composeHeraldPrompt({
            filePath: 'src/Card.tsx',
            violations: [driftViolation],
        })
        const lines = result.split('\n')
        expect(lines[0]).toMatch(/^Fix the \d+ .+ violation/)
    })

    it('produces 3-part structure: header + bullets + hint', () => {
        const violations: HeraldViolation[] = [
            { category: 'design-drift', summary: 'bg-blue-500 drifts', severity: 'critical' },
            { category: 'design-drift', summary: 'text-gray-700 drifts', severity: 'warning' },
        ]
        const result = composeHeraldPrompt({ filePath: 'src/X.tsx', violations })
        const lines = result.split('\n')
        // Line 0: header
        expect(lines[0]).toMatch(/^Fix the 2/)
        // Lines 1–2: bullets
        expect(lines[1]).toBe('- bg-blue-500 drifts')
        expect(lines[2]).toBe('- text-gray-700 drifts')
        // Line 3: hint
        expect(lines[3]).toBe('Use `flint_fix` with dry_run:true first to preview changes.')
    })

    // ── Edge cases ────────────────────────────────────────────────────────────

    it('handles nodeId presence without including it in summary', () => {
        const violationWithNode: HeraldViolation = {
            category: 'design-drift',
            summary: 'bg-blue-500 drifts from token',
            nodeId: 'node-abc123',
            severity: 'critical',
        }
        const result = composeHeraldPrompt({
            filePath: 'src/Button.tsx',
            violations: [violationWithNode],
        })
        expect(result).toContain('- bg-blue-500 drifts from token')
        expect(result).not.toContain('node-abc123')
    })
})
