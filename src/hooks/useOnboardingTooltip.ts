/**
 * useOnboardingTooltip — src/hooks/useOnboardingTooltip.ts
 *
 * OPP-17: Contextual one-time tooltips that teach features in context without
 * a tutorial wizard.
 *
 * Each tooltip is keyed by a stable string (e.g. 'first-violation',
 * 'health-tab-unlock', 'agents-tab-activity'). The dismissed state is
 * persisted to localStorage under `flint:tooltip:<key>` so the tooltip never
 * re-appears after the user has dismissed it, even across app restarts.
 *
 * Usage:
 *   const { shouldShow, dismiss } = useOnboardingTooltip('first-violation')
 *   if (shouldShow) return <Tooltip onDismiss={dismiss}>…</Tooltip>
 */

import { useState, useCallback } from 'react'

const STORAGE_PREFIX = 'flint:tooltip:'

/**
 * Returns `shouldShow: true` exactly once per `key` per device (until the
 * user calls `dismiss()`). Persists dismissal to localStorage.
 *
 * @param key  Stable identifier for the tooltip (e.g. 'first-violation').
 */
export function useOnboardingTooltip(key: string): {
    shouldShow: boolean
    dismiss: () => void
} {
    const storageKey = `${STORAGE_PREFIX}${key}`

    const [shouldShow, setShouldShow] = useState<boolean>(() => {
        try {
            return localStorage.getItem(storageKey) !== 'dismissed'
        } catch {
            // localStorage unavailable (e.g. private browsing with storage blocked)
            return false
        }
    })

    const dismiss = useCallback(() => {
        try {
            localStorage.setItem(storageKey, 'dismissed')
        } catch {
            // Ignore write failures — tooltip will re-appear on next load at worst
        }
        setShouldShow(false)
    }, [storageKey])

    return { shouldShow, dismiss }
}
