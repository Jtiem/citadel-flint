/**
 * useTokenUsage — src/hooks/useTokenUsage.ts
 *
 * MINT.2b/2c/2d: Hook that provides token usage intelligence and Figma drift data.
 *
 * - Calls `tokens:scan-usage` IPC on mount to get per-token usage counts
 * - Reads `.flint/figma-tokens.json` (if Figma connected) to detect value drift
 * - Exposes: usageMap, deadTokenCount, driftedTokens, driftCount, isScanning
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { TokenUsageResult } from '../types/flint-api'

/** Drift information for a single token. */
export interface TokenDrift {
    tokenName: string
    localValue: string
    figmaValue: string
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
 * @param localTokens - Array of { token_path, token_value } for drift comparison.
 */
export function useTokenUsage(
    tokenCount: number = 0,
    localTokens: Array<{ token_path: string; token_value: string }> = [],
): TokenUsageData {
    const [usageMap, setUsageMap] = useState<Map<string, TokenUsageResult>>(new Map())
    const [isScanning, setIsScanning] = useState(false)
    const [driftedTokens, setDriftedTokens] = useState<TokenDrift[]>([])
    const mountedRef = useRef(true)

    const scan = useCallback(async () => {
        const api = window.flintAPI as any
        if (typeof api?.tokens?.scanUsage !== 'function') return

        setIsScanning(true)
        try {
            const results: TokenUsageResult[] = await api.tokens.scanUsage()
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

    // MINT.2c: Detect drift from Figma tokens
    useEffect(() => {
        async function checkDrift() {
            try {
                // Check if Figma is connected
                const figmaStatus = await window.flintAPI.figma.status()
                if (!figmaStatus.running) {
                    setDriftedTokens([])
                    return
                }

                // Try to read figma-tokens.json via the MCP or a readFile call
                const api = window.flintAPI as any
                let figmaTokensRaw: string | null = null
                if (typeof api?.readFile === 'function') {
                    try {
                        figmaTokensRaw = await api.readFile('.flint/figma-tokens.json')
                    } catch { /* file doesn't exist */ }
                }

                if (!figmaTokensRaw) {
                    setDriftedTokens([])
                    return
                }

                const figmaTokens = JSON.parse(figmaTokensRaw) as Record<string, unknown>

                // Flatten Figma tokens into a name→value map
                const figmaMap = new Map<string, string>()
                function walk(obj: Record<string, unknown>, prefix: string) {
                    for (const [key, val] of Object.entries(obj)) {
                        if (key.startsWith('$')) continue
                        const fullPath = prefix ? `${prefix}.${key}` : key
                        if (val && typeof val === 'object' && '$value' in (val as Record<string, unknown>)) {
                            const v = (val as Record<string, unknown>).$value
                            if (typeof v === 'string') figmaMap.set(fullPath, v)
                        } else if (val && typeof val === 'object') {
                            walk(val as Record<string, unknown>, fullPath)
                        }
                    }
                }
                walk(figmaTokens, '')

                // Compare local tokens against Figma
                const drifts: TokenDrift[] = []
                for (const local of localTokens) {
                    const figmaVal = figmaMap.get(local.token_path)
                    if (figmaVal && figmaVal.toLowerCase() !== local.token_value.toLowerCase()) {
                        drifts.push({
                            tokenName: local.token_path,
                            localValue: local.token_value,
                            figmaValue: figmaVal,
                        })
                    }
                }

                if (mountedRef.current) setDriftedTokens(drifts)
            } catch {
                // Silent — drift detection is best-effort
                if (mountedRef.current) setDriftedTokens([])
            }
        }

        checkDrift()
    }, [localTokens, tokenCount])

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
