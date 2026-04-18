/**
 * useTokenUsage — src/hooks/useTokenUsage.ts
 *
 * MINT.2b/2c/2d: Hook that provides token usage intelligence and Figma drift data.
 *
 * - Calls `tokens:scan-usage` IPC on mount to get per-token usage counts
 * - Calls `tokens:read-figma-drift` IPC to detect value drift (MINT.5 re-enable)
 * - Exposes: usageMap, deadTokenCount, driftedTokens, driftCount, isScanning
 *
 * Renderer Process only — no Node.js imports.
 *
 * MINT.5 drift re-enable notes:
 * The old drift path (2026-04-12 disabled) used a shared `file:read` IPC that
 * rejected `.json` extensions, causing a render loop. The new `tokens:read-figma-drift`
 * IPC computes the diff server-side and returns a resolved TokenDrift[]. The
 * mountedRef guard prevents setState after unmount. Stable `tokenCount` dependency
 * ensures we only re-fetch when the token list actually changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { TokenUsageResult } from '../types/flint-api'

/** Drift information for a single token. */
export interface TokenDrift {
    tokenName: string
    localValue: string
    figmaValue: string
    /** CIEDE2000 ΔE for color tokens; undefined for non-color types. */
    deltaE?: number
}

export interface TokenUsageData {
    /** Map from token name to usage result. */
    usageMap: Map<string, TokenUsageResult>
    /** Total number of tokens with 0 usage across project files. */
    deadTokenCount: number
    /** Total number of tokens scanned. */
    totalScanned: number
    /** Tokens that have drifted from Figma values. */
    driftedTokens: TokenDrift[]
    /** Count of drifted tokens (convenience for badge rendering). */
    driftCount: number
    /** True while the scan is in progress. */
    isScanning: boolean
    /** Re-trigger the scan manually. */
    rescan: () => void
}

/**
 * Hook that fetches token usage intelligence from the main process.
 * Caches results until `rescan()` is called or `tokenCount` changes.
 *
 * @param tokenCount - Pass `tokens.length` from tokenStore to auto-rescan on changes.
 * @param _localTokens - Deprecated. Drift is now computed server-side via
 *   `tokens:read-figma-drift` IPC (MINT.5). This parameter is accepted for
 *   backward compatibility but is ignored. Remove at next major cleanup.
 */
export function useTokenUsage(
    tokenCount: number = 0,
    _localTokens?: Array<{ token_path: string; token_value: string }>,
): TokenUsageData {
    const [usageMap, setUsageMap] = useState<Map<string, TokenUsageResult>>(new Map())
    const [isScanning, setIsScanning] = useState(false)
    const [driftedTokens, setDriftedTokens] = useState<TokenDrift[]>([])
    const mountedRef = useRef(true)

    const scan = useCallback(async () => {
        const scanUsage = window.flintAPI?.tokens?.scanUsage
        if (typeof scanUsage !== 'function') return

        setIsScanning(true)
        try {
            const results: TokenUsageResult[] = await scanUsage()
            if (!mountedRef.current) return

            const map = new Map<string, TokenUsageResult>()
            for (const r of results) {
                map.set(r.tokenName, r)
            }
            setUsageMap(map)
        } catch {
            // IPC not wired yet or project not open — silent degradation
        } finally {
            if (mountedRef.current) setIsScanning(false)
        }
    }, [])

    // Scan on mount and when token count changes
    useEffect(() => {
        mountedRef.current = true
        scan()
        return () => { mountedRef.current = false }
    }, [scan, tokenCount])

    // MINT.5: Drift detection re-enabled via dedicated tokens:read-figma-drift IPC.
    // The new IPC computes the diff main-side (reads .flint/figma-tokens.json +
    // SQLite), returning a resolved TokenDrift[]. This avoids the renderer-side
    // file-read that caused the 2026-04-12 render loop.
    //
    // Dependencies: tokenCount only — a stable primitive that changes only when
    // the token list grows or shrinks. This prevents re-fetch on every render.
    useEffect(() => {
        let cancelled = false

        const readDrift = window.flintAPI?.tokens?.readFigmaDrift
        if (typeof readDrift !== 'function') return

        void (async () => {
            try {
                const drifts = await readDrift()
                if (cancelled) return
                setDriftedTokens(drifts)
            } catch {
                // Figma not connected or IPC not wired — silent degradation
                if (!cancelled) setDriftedTokens([])
            }
        })()

        return () => { cancelled = true }
    }, [tokenCount])

    const deadTokenCount = Array.from(usageMap.values()).filter((r) => r.usageCount === 0).length
    const totalScanned = usageMap.size

    return {
        usageMap,
        deadTokenCount,
        totalScanned,
        driftedTokens,
        driftCount: driftedTokens.length,
        isScanning,
        rescan: scan,
    }
}
