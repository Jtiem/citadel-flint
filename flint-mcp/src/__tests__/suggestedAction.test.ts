/**
 * suggestedAction.test.ts — Phase RELAY.1: Herald Context Frame
 *
 * Tests for assembleSuggestedAction() — the function that derives a
 * structured SuggestedAction from Glass session state.
 *
 * These tests cover all four priority branches described in the plan:
 *   1. exportBlocked + criticalCount > 0  → fix-violations / high
 *   2. exportBlocked + criticalCount === 0 → fix-violations / medium
 *   3. overrideCount > 0, no violations   → review-overrides / low
 *   4. clean state                        → none / low
 */

import { describe, it, expect } from 'vitest'
import { assembleSuggestedAction } from '../core/sessionContext.js'
import type { ViolationSummary } from '../types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeViolations(overrides: Partial<ViolationSummary> = {}): ViolationSummary {
    return {
        mithrilCount: 0,
        a11yCount: 0,
        amberCount: 0,
        criticalCount: 0,
        affectedNodeIds: [],
        hasFixableViolations: false,
        ...overrides,
    }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('RELAY.1: assembleSuggestedAction — fix-violations / high priority', () => {
    it('returns action="fix-violations" when exportBlocked is true and criticalCount > 0', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 3, criticalCount: 2 }),
            0,
            '/src/components/Header.tsx',
        )
        expect(result.action).toBe('fix-violations')
    })

    it('returns priority="high" when exportBlocked is true and criticalCount > 0', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 3, criticalCount: 2 }),
            0,
            '/src/components/Header.tsx',
        )
        expect(result.priority).toBe('high')
    })

    it('summary mentions the critical count and file path', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 3, criticalCount: 2 }),
            0,
            '/src/components/Header.tsx',
        )
        expect(result.summary).toContain('2 critical violation')
        expect(result.summary).toContain('/src/components/Header.tsx')
    })

    it('tool is "flint_fix" for fix-violations / high', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 3, criticalCount: 1 }),
            0,
            '/src/Button.tsx',
        )
        expect(result.tool).toBe('flint_fix')
    })

    it('toolArgs includes dry_run: true', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 3, criticalCount: 1 }),
            0,
            '/src/Button.tsx',
        )
        expect(result.toolArgs).not.toBeNull()
        expect(result.toolArgs!['dry_run']).toBe(true)
    })

    it('toolArgs.filePath matches the provided activeFilePath', () => {
        const filePath = '/src/components/Nav.tsx'
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 2, criticalCount: 2 }),
            0,
            filePath,
        )
        expect(result.toolArgs!['filePath']).toBe(filePath)
    })
})

describe('RELAY.1: assembleSuggestedAction — fix-violations / medium priority', () => {
    it('returns action="fix-violations" when exportBlocked is true and criticalCount === 0', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 4, a11yCount: 1, criticalCount: 0 }),
            0,
            '/src/components/Card.tsx',
        )
        expect(result.action).toBe('fix-violations')
    })

    it('returns priority="medium" when exportBlocked is true and criticalCount === 0', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 4, a11yCount: 1, criticalCount: 0 }),
            0,
            '/src/components/Card.tsx',
        )
        expect(result.priority).toBe('medium')
    })

    it('summary mentions total violation count and references dry_run', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 4, a11yCount: 1, criticalCount: 0 }),
            0,
            '/src/components/Card.tsx',
        )
        // 4 mithril + 1 a11y = 5 total
        expect(result.summary).toContain('5 violation')
        expect(result.summary.toLowerCase()).toContain('dry_run')
    })

    it('tool is "flint_fix" for fix-violations / medium', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 2, criticalCount: 0 }),
            0,
            '/src/index.tsx',
        )
        expect(result.tool).toBe('flint_fix')
    })

    it('toolArgs includes dry_run: true for medium priority path', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ a11yCount: 3, criticalCount: 0 }),
            0,
            '/src/layout/Footer.tsx',
        )
        expect(result.toolArgs).not.toBeNull()
        expect(result.toolArgs!['dry_run']).toBe(true)
    })
})

describe('RELAY.1: assembleSuggestedAction — review-overrides', () => {
    it('returns action="review-overrides" when overrideCount > 0 and no violations', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            3,
            '/src/components/Modal.tsx',
        )
        expect(result.action).toBe('review-overrides')
    })

    it('returns priority="low" for review-overrides', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            3,
            '/src/components/Modal.tsx',
        )
        expect(result.priority).toBe('low')
    })

    it('summary mentions the override count', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            5,
            '/src/App.tsx',
        )
        expect(result.summary).toContain('5')
        expect(result.summary.toLowerCase()).toContain('override')
    })

    it('tool is null for review-overrides', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            2,
            '/src/App.tsx',
        )
        expect(result.tool).toBeNull()
    })

    it('toolArgs is null for review-overrides', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            2,
            '/src/App.tsx',
        )
        expect(result.toolArgs).toBeNull()
    })

    it('does NOT return review-overrides when there are also violations', () => {
        // Violations take precedence via export-blocked path, but even if export
        // is not blocked, overrides+violations should NOT return review-overrides.
        const result = assembleSuggestedAction(
            false,
            makeViolations({ mithrilCount: 2 }),
            3,
            '/src/App.tsx',
        )
        expect(result.action).not.toBe('review-overrides')
    })
})

describe('RELAY.1: assembleSuggestedAction — none / clean state', () => {
    it('returns action="none" for a fully clean session', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            0,
            '/src/App.tsx',
        )
        expect(result.action).toBe('none')
    })

    it('returns priority="low" for clean state', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            0,
            '/src/App.tsx',
        )
        expect(result.priority).toBe('low')
    })

    it('summary says no action needed for clean state', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            0,
            null,
        )
        expect(result.summary.toLowerCase()).toContain('no action needed')
    })

    it('tool is null for clean state', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            0,
            '/src/App.tsx',
        )
        expect(result.tool).toBeNull()
    })

    it('toolArgs is null for clean state', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            0,
            '/src/App.tsx',
        )
        expect(result.toolArgs).toBeNull()
    })

    it('returns none when exportBlocked is false even if overrideCount is 0 and violations are 0', () => {
        const result = assembleSuggestedAction(false, makeViolations(), 0, null)
        expect(result.action).toBe('none')
    })
})

describe('RELAY.1: assembleSuggestedAction — edge cases', () => {
    it('handles null activeFilePath gracefully (uses empty string in toolArgs)', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 1, criticalCount: 1 }),
            0,
            null,
        )
        expect(result.toolArgs).not.toBeNull()
        expect(typeof result.toolArgs!['filePath']).toBe('string')
    })

    it('singular "violation" when criticalCount === 1', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 1, criticalCount: 1 }),
            0,
            '/src/Foo.tsx',
        )
        // "1 critical violation" not "1 critical violations"
        expect(result.summary).toMatch(/1 critical violation[^s]|1 critical violation$/)
    })

    it('plural "violations" when criticalCount > 1', () => {
        const result = assembleSuggestedAction(
            true,
            makeViolations({ mithrilCount: 3, criticalCount: 3 }),
            0,
            '/src/Foo.tsx',
        )
        expect(result.summary).toContain('3 critical violations')
    })

    it('singular "override" when overrideCount === 1', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            1,
            '/src/Foo.tsx',
        )
        expect(result.summary).toContain('1 rule override is active')
    })

    it('plural "overrides are" when overrideCount > 1', () => {
        const result = assembleSuggestedAction(
            false,
            makeViolations(),
            4,
            '/src/Foo.tsx',
        )
        expect(result.summary).toContain('4 rule overrides are active')
    })
})
