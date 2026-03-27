/**
 * governanceStore.ts — src/store/governanceStore.ts
 *
 * Zustand v5 store for Governance Engine rule overrides and ERM state.
 *
 * The store holds:
 *   - Rule override deltas (enabled/disabled/severity) from the manifest defaults.
 *   - ERM fields (activePresets, inheritanceChain, jurisdictionCoverage, isLoadingConfig)
 *     populated by useGovernanceConfig on mount.
 *
 * Persistence falls back to localStorage when the IPC governance
 * channel is not yet wired in the main process.
 */

import { create } from 'zustand'
import { BRAND } from '../../shared/brand'
import type { RuleSeverity } from '../core/governanceRulesManifest'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RuleOverride {
    enabled?: boolean
    severity?: RuleSeverity
}

interface GovernanceState {
    // ── Original override fields ────────────────────────────────────────────
    overrides: Record<string, RuleOverride>
    setOverride: (ruleId: string, override: RuleOverride) => void
    resetOverride: (ruleId: string) => void
    resetAll: () => void
    saveToFile: () => Promise<void>
    loadFromFile: () => Promise<void>

    // ── ERM fields (Phase ERM) ──────────────────────────────────────────────
    /** Currently active @flint/ preset refs from the extends[] chain. */
    activePresets: string[]
    /** Full extends[] chain including local path refs. */
    inheritanceChain: string[]
    /**
     * Per-jurisdiction coverage derived from the active presets.
     * null when no project is open or coverage hasn't been computed yet.
     */
    jurisdictionCoverage: Record<string, { covered: number; total: number }> | null
    /** True while useGovernanceConfig is fetching resolved config from IPC. */
    isLoadingConfig: boolean

    setActivePresets: (presets: string[]) => void
    setInheritanceChain: (chain: string[]) => void
    setJurisdictionCoverage: (coverage: Record<string, { covered: number; total: number }> | null) => void
    setIsLoadingConfig: (loading: boolean) => void
}

const STORAGE_KEY = `${BRAND.productLower}:governance:overrides`

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGovernanceStore = create<GovernanceState>((set, get) => ({
    // ── Override state ─────────────────────────────────────────────────────
    overrides: {},

    setOverride(ruleId, override) {
        set((state) => ({
            overrides: {
                ...state.overrides,
                [ruleId]: { ...state.overrides[ruleId], ...override },
            },
        }))
    },

    resetOverride(ruleId) {
        set((state) => {
            const next = { ...state.overrides }
            delete next[ruleId]
            return { overrides: next }
        })
    },

    // resetAll only clears overrides — ERM fields survive reset
    resetAll() {
        set({ overrides: {} })
    },

    async saveToFile() {
        const payload = { version: 1 as const, rules: get().overrides }
        try {
            await window.flintAPI.saveRuleOverrides?.(payload)
        } catch {
            // Fallback to localStorage if IPC unavailable (e.g. test env)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(get().overrides))
        }
    },

    async loadFromFile() {
        try {
            const data = await window.flintAPI.getRuleOverrides?.()
            if (data?.rules) {
                set({ overrides: data.rules as Record<string, RuleOverride> })
                return
            }
        } catch {
            // IPC unavailable — fall through to localStorage
        }
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        try {
            const data = JSON.parse(raw) as Record<string, RuleOverride>
            set({ overrides: data })
        } catch {
            // Corrupt storage — silently ignore
        }
    },

    // ── ERM state ─────────────────────────────────────────────────────────
    activePresets: [],
    inheritanceChain: [],
    jurisdictionCoverage: null,
    isLoadingConfig: false,

    setActivePresets(presets) {
        set({ activePresets: presets })
    },

    setInheritanceChain(chain) {
        set({ inheritanceChain: chain })
    },

    setJurisdictionCoverage(coverage) {
        set({ jurisdictionCoverage: coverage })
    },

    setIsLoadingConfig(loading) {
        set({ isLoadingConfig: loading })
    },
}))
