import { describe, it, expect } from 'vitest'
import { suggestTools, MAX_SUGGESTED_TOOLS } from '../toolSuggester.js'

describe('suggestTools', () => {
    const cleanProject = {
        tokenCount: 50,
        mithrilCount: 0,
        a11yCount: 0,
        healthScore: 95,
        figmaConnected: true,
        hasManifest: true,
    }

    const emptyProject = {
        tokenCount: 0,
        mithrilCount: 0,
        a11yCount: 0,
        healthScore: null,
        figmaConnected: false,
        hasManifest: false,
    }

    it('returns flint_audit for a clean project', () => {
        const result = suggestTools(cleanProject)
        expect(result).toHaveLength(1)
        expect(result[0].tool).toBe('flint_audit')
        expect(result[0].reason).toBe('Verify ongoing compliance')
    })

    it('suggests extract tokens and reindex for empty project', () => {
        const result = suggestTools(emptyProject)
        const tools = result.map(r => r.tool)
        expect(tools).toContain('flint_extract_tokens')
        expect(tools).toContain('flint_reindex_registry')
        expect(tools).toContain('flint_figma_connect')
    })

    it('suggests flint_fix when mithril violations exist', () => {
        const result = suggestTools({ ...cleanProject, mithrilCount: 3 })
        const fix = result.find(r => r.tool === 'flint_fix')
        expect(fix).toBeDefined()
        expect(fix!.reason).toBe('Auto-fix 3 color drifts')
    })

    it('suggests accessibility report when a11y violations exist', () => {
        const result = suggestTools({ ...cleanProject, a11yCount: 1 })
        const a11y = result.find(r => r.tool === 'flint_accessibility_report')
        expect(a11y).toBeDefined()
        expect(a11y!.reason).toBe('Review 1 accessibility gap')
    })

    it('suggests debt report when health score is low', () => {
        const result = suggestTools({ ...cleanProject, healthScore: 45 })
        const debt = result.find(r => r.tool === 'flint_debt_report')
        expect(debt).toBeDefined()
    })

    it('suggests figma connect when not connected', () => {
        const result = suggestTools({ ...cleanProject, figmaConnected: false })
        const figma = result.find(r => r.tool === 'flint_figma_connect')
        expect(figma).toBeDefined()
    })

    it('caps at MAX_SUGGESTED_TOOLS', () => {
        // All conditions true → would produce 6 suggestions without cap
        const allBad = {
            tokenCount: 0,
            mithrilCount: 5,
            a11yCount: 3,
            healthScore: 30,
            figmaConnected: false,
            hasManifest: false,
        }
        const result = suggestTools(allBad)
        expect(result.length).toBeLessThanOrEqual(MAX_SUGGESTED_TOOLS)
    })

    it('respects priority order (tokens before manifest before violations)', () => {
        const allBad = {
            tokenCount: 0,
            mithrilCount: 5,
            a11yCount: 3,
            healthScore: 30,
            figmaConnected: false,
            hasManifest: false,
        }
        const result = suggestTools(allBad)
        expect(result[0].tool).toBe('flint_extract_tokens')
        expect(result[1].tool).toBe('flint_reindex_registry')
        expect(result[2].tool).toBe('flint_fix')
    })

    it('uses singular form for 1 violation', () => {
        const result = suggestTools({ ...cleanProject, mithrilCount: 1 })
        const fix = result.find(r => r.tool === 'flint_fix')
        expect(fix!.reason).toBe('Auto-fix 1 color drift')
    })
})
