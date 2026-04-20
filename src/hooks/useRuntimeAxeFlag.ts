/**
 * useRuntimeAxeFlag — src/hooks/useRuntimeAxeFlag.ts
 *
 * Reads the `runtime.axe.enabled` feature flag from the session context
 * surface and returns a boolean. Hidden by default on first ship
 * (absence → false).
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 * Contract invariant: `flag-off-ui-silent` — the StatusBar pill and
 * GovernanceDashboard "Runtime Audit" accordion must render ZERO DOM
 * nodes when this hook returns false.
 *
 * Architectural decisions:
 *   - No Zustand store — the flag is derived from context, not owned.
 *   - No new IPC channel — piggybacks on `window.flintAPI.context.getEnriched`
 *     which already delivers `flint_get_context` payload. Once Group A
 *     appends `features.runtimeAxeEnabled` to that payload, this hook
 *     reads it directly. Until then, the hook defaults to false — the
 *     safe first-ship posture.
 *   - Optional-chained everywhere so Vitest / headless environments and
 *     the web build degrade gracefully before Group A ships.
 *
 * Failure modes:
 *   - `window.flintAPI.context` absent → returns false (safe default).
 *   - `getEnriched()` rejects → returns false (safe default).
 *   - `features` or `features.runtimeAxeEnabled` missing from payload →
 *     returns false (safe default — absence is treated as off).
 *   - Only strict boolean `true` enables; truthy strings do not.
 */

import { useEffect, useState } from 'react'

// ── Minimal local type shim ──────────────────────────────────────────────────
//
// We don't import from flint-api.d.ts because Group A has not yet appended
// the `features` field to `EnrichedContext`. Using a minimal local interface
// keeps this hook compilable independent of Group A's delivery. When Group A
// lands the declaration merges cleanly.

interface EnrichedContextWithFeatures {
    features?: {
        runtimeAxeEnabled?: boolean
    }
}

interface FlintAPIContextNamespace {
    getEnriched?: () => Promise<EnrichedContextWithFeatures>
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Reads the `runtime.axe.enabled` feature flag.
 *
 * @returns `true` only when session context explicitly delivers
 *          `features.runtimeAxeEnabled === true`. `false` in every
 *          other case including loading, absence, or IPC failure.
 */
export function useRuntimeAxeFlag(): boolean {
    const [enabled, setEnabled] = useState<boolean>(false)

    useEffect(() => {
        let cancelled = false

        const api = (window as unknown as {
            flintAPI?: { context?: FlintAPIContextNamespace }
        }).flintAPI?.context

        if (!api?.getEnriched) {
            // No IPC surface — stay at the safe default.
            return
        }

        api.getEnriched()
            .then((ctx) => {
                if (cancelled) return
                // Strict equality check: only literal `true` enables.
                // Any other value (undefined, null, "true" string) leaves the
                // pill and accordion unmounted.
                setEnabled(ctx?.features?.runtimeAxeEnabled === true)
            })
            .catch(() => {
                // Silently fall back to the safe default. The flag-off-ui-silent
                // invariant requires that IPC errors never flip the UI on.
                if (!cancelled) setEnabled(false)
            })

        return () => {
            cancelled = true
        }
    }, [])

    return enabled
}
