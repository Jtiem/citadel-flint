/**
 * useGovernanceConfig — src/hooks/useGovernanceConfig.ts
 *
 * Bridges the governance IPC surface to the governanceStore.
 * This is the ONLY place in Glass that calls window.flintAPI.governance.getResolvedConfig
 * or window.flintAPI.governance.togglePack. Components use the hook's return
 * value rather than calling IPC directly (Process Boundary Law, Commandment 14).
 *
 * Lifecycle:
 *   1. On mount: calls getResolvedConfig() → writes activePresets and
 *      inheritanceChain to governanceStore.
 *   2. Subscribes to governance:config-changed events via onConfigChanged —
 *      re-fetches on every config write (e.g. after togglePack).
 *   3. On unmount: calls the unsubscribe fn returned by onConfigChanged.
 *
 * Returns:
 *   { activePresets, inheritanceChain, isLoading, togglePack }
 *
 * Mithril Safety: data-only hook — no JSX.
 */

import { useEffect, useCallback } from 'react'
import { useGovernanceStore } from '../store/governanceStore'
import { computeJurisdictionCoverage } from '../core/rulePackRegistryClient'

// ── Return type ────────────────────────────────────────────────────────────

export interface UseGovernanceConfigReturn {
    /** Currently active @flint/ preset refs from the extends[] chain. */
    activePresets: string[]
    /** Full extends[] chain including local path refs. */
    inheritanceChain: string[]
    /** True while waiting for the IPC getResolvedConfig response. */
    isLoading: boolean
    /**
     * Adds or removes a preset from flint.config.yaml.
     * Returns the result from the main process (success + updated extends).
     */
    togglePack: (packId: string, enable: boolean) => Promise<{
        success: boolean
        extends?: string[]
        error?: string
    }>
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useGovernanceConfig(): UseGovernanceConfigReturn {
    const activePresets       = useGovernanceStore((s) => s.activePresets)
    const inheritanceChain    = useGovernanceStore((s) => s.inheritanceChain)
    const isLoading           = useGovernanceStore((s) => s.isLoadingConfig)
    const setActivePresets    = useGovernanceStore((s) => s.setActivePresets)
    const setInheritanceChain = useGovernanceStore((s) => s.setInheritanceChain)
    const setIsLoadingConfig  = useGovernanceStore((s) => s.setIsLoadingConfig)
    const setJurisdictionCoverage = useGovernanceStore((s) => s.setJurisdictionCoverage)

    // ── Fetch resolved config from main process ────────────────────────────

    const fetchConfig = useCallback(async () => {
        const api = window.flintAPI?.governance
        if (!api?.getResolvedConfig) return

        // Guard: if store actions are not available (isolated test env), skip
        if (typeof setIsLoadingConfig !== 'function') return

        setIsLoadingConfig(true)
        try {
            const result = await api.getResolvedConfig()
            if (result) {
                if (typeof setActivePresets === 'function') {
                    setActivePresets(result.activePresets ?? [])
                }
                if (typeof setInheritanceChain === 'function') {
                    setInheritanceChain(result.extendsChain ?? [])
                }
                // Derive jurisdiction coverage from active presets + static registry
                const coverage = computeJurisdictionCoverage(result.activePresets ?? [])
                if (typeof setJurisdictionCoverage === 'function') {
                    setJurisdictionCoverage(coverage)
                }
            } else {
                // No project open — clear to empty state
                if (typeof setActivePresets === 'function') setActivePresets([])
                if (typeof setInheritanceChain === 'function') setInheritanceChain([])
                if (typeof setJurisdictionCoverage === 'function') setJurisdictionCoverage(null)
            }
        } catch {
            // IPC not wired (test env, headless) — silently no-op
        } finally {
            if (typeof setIsLoadingConfig === 'function') {
                setIsLoadingConfig(false)
            }
        }
    }, [setActivePresets, setInheritanceChain, setIsLoadingConfig, setJurisdictionCoverage])

    // ── Mount: initial fetch + subscribe to config-changed events ──────────

    useEffect(() => {
        void fetchConfig()

        const api = window.flintAPI?.governance
        if (!api?.onConfigChanged) return

        // Re-fetch whenever the main process writes flint.config.yaml
        const unsubscribe = api.onConfigChanged(() => {
            void fetchConfig()
        })

        return unsubscribe
    }, [fetchConfig])

    // ── togglePack: delegate to IPC, let config-changed trigger re-fetch ──

    const togglePack = useCallback(
        async (packId: string, enable: boolean) => {
            const api = window.flintAPI?.governance
            if (!api?.togglePack) {
                return { success: false, error: 'IPC not available' }
            }

            const result = await api.togglePack(packId, enable)

            // Optimistically update the store so the UI reflects the change
            // before the config-changed event fires.
            if (result.success && result.extends) {
                const newPresets = result.extends.filter((e) => e.startsWith('@flint/'))
                if (typeof setActivePresets === 'function') setActivePresets(newPresets)
                if (typeof setInheritanceChain === 'function') setInheritanceChain(result.extends)
                if (typeof setJurisdictionCoverage === 'function') {
                    setJurisdictionCoverage(computeJurisdictionCoverage(newPresets))
                }
            }

            return result
        },
        [setActivePresets, setInheritanceChain, setJurisdictionCoverage],
    )

    return { activePresets, inheritanceChain, isLoading, togglePack }
}
