/**
 * governanceStore.test.ts — src/store/__tests__/governanceStore.test.ts
 *
 * State transition tests for the ERM extension fields added to governanceStore.
 *
 * Covers (ERM-2):
 *   GS-ERM-01 — Initial state: activePresets is empty array
 *   GS-ERM-02 — Initial state: inheritanceChain is empty array
 *   GS-ERM-03 — Initial state: jurisdictionCoverage is null
 *   GS-ERM-04 — Initial state: isLoadingConfig is false
 *   GS-ERM-05 — setActivePresets: replaces activePresets list
 *   GS-ERM-06 — setActivePresets: accepts empty array (clear)
 *   GS-ERM-07 — setActivePresets: does not mutate other state fields
 *   GS-ERM-08 — setInheritanceChain: replaces inheritanceChain list
 *   GS-ERM-09 — setInheritanceChain: accepts empty array (clear)
 *   GS-ERM-10 — setInheritanceChain: does not mutate other state fields
 *   GS-ERM-11 — setJurisdictionCoverage: sets coverage map
 *   GS-ERM-12 — setJurisdictionCoverage: accepts null (reset)
 *   GS-ERM-13 — setJurisdictionCoverage: does not mutate other state fields
 *   GS-ERM-14 — setIsLoadingConfig: sets to true
 *   GS-ERM-15 — setIsLoadingConfig: sets back to false
 *   GS-ERM-16 — setIsLoadingConfig: does not mutate other state fields
 *   GS-ERM-17 — Existing overrides: setOverride still works correctly
 *   GS-ERM-18 — Existing overrides: resetAll does not touch ERM fields
 *   GS-ERM-19 — Multiple sequential setActivePresets calls: last wins
 *   GS-ERM-20 — Coverage with multiple jurisdictions: all keys preserved
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useGovernanceStore } from '../governanceStore'

// ── Reset store between tests ──────────────────────────────────────────────────

beforeEach(() => {
    useGovernanceStore.setState({
        overrides: {},
        activePresets: [],
        inheritanceChain: [],
        jurisdictionCoverage: null,
        isLoadingConfig: false,
    })
})

// ── GS-ERM-01 through GS-ERM-04: Initial state ────────────────────────────────

describe('governanceStore — ERM initial state', () => {
    it('GS-ERM-01: activePresets is an empty array', () => {
        const { activePresets } = useGovernanceStore.getState()
        expect(activePresets).toEqual([])
    })

    it('GS-ERM-02: inheritanceChain is an empty array', () => {
        const { inheritanceChain } = useGovernanceStore.getState()
        expect(inheritanceChain).toEqual([])
    })

    it('GS-ERM-03: jurisdictionCoverage is null', () => {
        const { jurisdictionCoverage } = useGovernanceStore.getState()
        expect(jurisdictionCoverage).toBeNull()
    })

    it('GS-ERM-04: isLoadingConfig is false', () => {
        const { isLoadingConfig } = useGovernanceStore.getState()
        expect(isLoadingConfig).toBe(false)
    })
})

// ── GS-ERM-05 through GS-ERM-07: setActivePresets ────────────────────────────

describe('governanceStore — setActivePresets', () => {
    it('GS-ERM-05: replaces activePresets with the provided list', () => {
        const { setActivePresets } = useGovernanceStore.getState()
        setActivePresets(['@flint/healthcare', '@flint/wcag-aa'])

        const { activePresets } = useGovernanceStore.getState()
        expect(activePresets).toEqual(['@flint/healthcare', '@flint/wcag-aa'])
    })

    it('GS-ERM-06: accepts empty array to clear presets', () => {
        const { setActivePresets } = useGovernanceStore.getState()
        setActivePresets(['@flint/healthcare'])
        setActivePresets([])

        const { activePresets } = useGovernanceStore.getState()
        expect(activePresets).toEqual([])
    })

    it('GS-ERM-07: does not mutate inheritanceChain, jurisdictionCoverage, or isLoadingConfig', () => {
        useGovernanceStore.setState({
            inheritanceChain: ['./team.yaml'],
            jurisdictionCoverage: { 'EU/EAA': { covered: 5, total: 10 } },
            isLoadingConfig: true,
        })

        useGovernanceStore.getState().setActivePresets(['@flint/finance'])

        const state = useGovernanceStore.getState()
        expect(state.inheritanceChain).toEqual(['./team.yaml'])
        expect(state.jurisdictionCoverage).toEqual({ 'EU/EAA': { covered: 5, total: 10 } })
        expect(state.isLoadingConfig).toBe(true)
    })
})

// ── GS-ERM-08 through GS-ERM-10: setInheritanceChain ────────────────────────

describe('governanceStore — setInheritanceChain', () => {
    it('GS-ERM-08: replaces inheritanceChain with the provided list', () => {
        const { setInheritanceChain } = useGovernanceStore.getState()
        setInheritanceChain(['@flint/base', './team.yaml', '(project)'])

        const { inheritanceChain } = useGovernanceStore.getState()
        expect(inheritanceChain).toEqual(['@flint/base', './team.yaml', '(project)'])
    })

    it('GS-ERM-09: accepts empty array to clear the chain', () => {
        const { setInheritanceChain } = useGovernanceStore.getState()
        setInheritanceChain(['@flint/base'])
        setInheritanceChain([])

        const { inheritanceChain } = useGovernanceStore.getState()
        expect(inheritanceChain).toEqual([])
    })

    it('GS-ERM-10: does not mutate activePresets, jurisdictionCoverage, or isLoadingConfig', () => {
        useGovernanceStore.setState({
            activePresets: ['@flint/healthcare'],
            jurisdictionCoverage: { 'US/ADA': { covered: 3, total: 5 } },
            isLoadingConfig: false,
        })

        useGovernanceStore.getState().setInheritanceChain(['./local.yaml'])

        const state = useGovernanceStore.getState()
        expect(state.activePresets).toEqual(['@flint/healthcare'])
        expect(state.jurisdictionCoverage).toEqual({ 'US/ADA': { covered: 3, total: 5 } })
        expect(state.isLoadingConfig).toBe(false)
    })
})

// ── GS-ERM-11 through GS-ERM-13: setJurisdictionCoverage ────────────────────

describe('governanceStore — setJurisdictionCoverage', () => {
    it('GS-ERM-11: sets coverage map with all provided entries', () => {
        const { setJurisdictionCoverage } = useGovernanceStore.getState()
        const coverage = {
            'EU/EAA': { covered: 48, total: 50 },
            'US/ADA': { covered: 20, total: 25 },
        }
        setJurisdictionCoverage(coverage)

        const { jurisdictionCoverage } = useGovernanceStore.getState()
        expect(jurisdictionCoverage).toEqual(coverage)
    })

    it('GS-ERM-12: accepts null to reset coverage', () => {
        const { setJurisdictionCoverage } = useGovernanceStore.getState()
        setJurisdictionCoverage({ 'EU/EAA': { covered: 10, total: 10 } })
        setJurisdictionCoverage(null)

        const { jurisdictionCoverage } = useGovernanceStore.getState()
        expect(jurisdictionCoverage).toBeNull()
    })

    it('GS-ERM-13: does not mutate activePresets, inheritanceChain, or isLoadingConfig', () => {
        useGovernanceStore.setState({
            activePresets: ['@flint/wcag-aa'],
            inheritanceChain: ['@flint/wcag-aa'],
            isLoadingConfig: true,
        })

        useGovernanceStore.getState().setJurisdictionCoverage({ 'EU/EAA': { covered: 50, total: 50 } })

        const state = useGovernanceStore.getState()
        expect(state.activePresets).toEqual(['@flint/wcag-aa'])
        expect(state.inheritanceChain).toEqual(['@flint/wcag-aa'])
        expect(state.isLoadingConfig).toBe(true)
    })
})

// ── GS-ERM-14 through GS-ERM-16: setIsLoadingConfig ─────────────────────────

describe('governanceStore — setIsLoadingConfig', () => {
    it('GS-ERM-14: sets isLoadingConfig to true', () => {
        useGovernanceStore.getState().setIsLoadingConfig(true)
        expect(useGovernanceStore.getState().isLoadingConfig).toBe(true)
    })

    it('GS-ERM-15: sets isLoadingConfig back to false', () => {
        useGovernanceStore.setState({ isLoadingConfig: true })
        useGovernanceStore.getState().setIsLoadingConfig(false)
        expect(useGovernanceStore.getState().isLoadingConfig).toBe(false)
    })

    it('GS-ERM-16: does not mutate activePresets, inheritanceChain, or jurisdictionCoverage', () => {
        useGovernanceStore.setState({
            activePresets: ['@flint/pci'],
            inheritanceChain: ['@flint/pci', '(project)'],
            jurisdictionCoverage: { 'US/PCI': { covered: 15, total: 20 } },
        })

        useGovernanceStore.getState().setIsLoadingConfig(true)

        const state = useGovernanceStore.getState()
        expect(state.activePresets).toEqual(['@flint/pci'])
        expect(state.inheritanceChain).toEqual(['@flint/pci', '(project)'])
        expect(state.jurisdictionCoverage).toEqual({ 'US/PCI': { covered: 15, total: 20 } })
    })
})

// ── GS-ERM-17 through GS-ERM-18: Compatibility with existing actions ──────────

describe('governanceStore — backward compatibility', () => {
    it('GS-ERM-17: setOverride still updates overrides correctly', () => {
        useGovernanceStore.getState().setOverride('A11Y-001', { enabled: false, severity: 'warning' })

        const { overrides } = useGovernanceStore.getState()
        expect(overrides['A11Y-001']).toEqual({ enabled: false, severity: 'warning' })
    })

    it('GS-ERM-18: resetAll clears overrides but does not touch ERM fields', () => {
        useGovernanceStore.setState({
            overrides: { 'A11Y-001': { enabled: false } },
            activePresets: ['@flint/healthcare'],
            inheritanceChain: ['@flint/healthcare', '(project)'],
            jurisdictionCoverage: { 'EU/EAA': { covered: 50, total: 50 } },
            isLoadingConfig: false,
        })

        useGovernanceStore.getState().resetAll()

        const state = useGovernanceStore.getState()
        expect(state.overrides).toEqual({})
        // ERM fields must survive resetAll — it only clears overrides
        expect(state.activePresets).toEqual(['@flint/healthcare'])
        expect(state.inheritanceChain).toEqual(['@flint/healthcare', '(project)'])
        expect(state.jurisdictionCoverage).toEqual({ 'EU/EAA': { covered: 50, total: 50 } })
    })
})

// ── GS-ERM-19 through GS-ERM-20: Edge cases ──────────────────────────────────

describe('governanceStore — ERM edge cases', () => {
    it('GS-ERM-19: multiple sequential setActivePresets calls — last value wins', () => {
        const { setActivePresets } = useGovernanceStore.getState()
        setActivePresets(['@flint/healthcare'])
        setActivePresets(['@flint/finance'])
        setActivePresets(['@flint/wcag-aa', '@flint/pci'])

        expect(useGovernanceStore.getState().activePresets).toEqual(['@flint/wcag-aa', '@flint/pci'])
    })

    it('GS-ERM-20: jurisdictionCoverage preserves all jurisdiction keys', () => {
        const { setJurisdictionCoverage } = useGovernanceStore.getState()
        const coverage = {
            'EU/EAA': { covered: 48, total: 50 },
            'US/ADA': { covered: 20, total: 25 },
            'US/HIPAA': { covered: 0, total: 10 },
            'US/PCI-DSS': { covered: 5, total: 15 },
        }
        setJurisdictionCoverage(coverage)

        const stored = useGovernanceStore.getState().jurisdictionCoverage
        expect(stored).not.toBeNull()
        expect(Object.keys(stored!)).toHaveLength(4)
        expect(stored!['US/HIPAA']).toEqual({ covered: 0, total: 10 })
    })
})
