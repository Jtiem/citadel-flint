/**
 * governanceStore.ts — src/store/governanceStore.ts
 *
 * Zustand v5 store for Governance Engine rule overrides.
 *
 * The store only holds *deltas* from the manifest defaults.
 * If a ruleId has no entry in `overrides`, the rule is considered
 * enabled at its defaultSeverity from GOVERNANCE_RULES_MANIFEST.
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
    overrides: Record<string, RuleOverride>
    setOverride: (ruleId: string, override: RuleOverride) => void
    resetOverride: (ruleId: string) => void
    resetAll: () => void
    saveToFile: () => Promise<void>
    loadFromFile: () => Promise<void>
}

const STORAGE_KEY = `${BRAND.productLower}:governance:overrides`

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGovernanceStore = create<GovernanceState>((set, get) => ({
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
}))
