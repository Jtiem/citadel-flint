/**
 * useUserPrefs.ts — src/hooks/useUserPrefs.ts
 *
 * Lightweight localStorage-backed hook for renderer-only user preferences.
 * These are per-user (not per-project) preferences that survive app restarts
 * but do not belong in .flint/policy.json (which is project/team scoped).
 *
 * Pattern mirrors governanceStore.ts localStorage fallback.
 *
 * Usage:
 *   const [prefs, setPrefs] = useUserPrefs()
 *   prefs.fixMode // 'preview' | 'auto'
 *   setPrefs({ fixMode: 'auto' })
 */

import { useState, useCallback, useEffect } from 'react'
import { BRAND } from '../../shared/brand'

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * 'preview' — Show a diff preview before applying any auto-fix (default).
 * 'auto'    — Apply auto-fixes immediately without preview.
 */
export type FixMode = 'preview' | 'auto'

export interface UserPrefs {
    /** Controls whether auto-fix shows a diff preview first. */
    fixMode: FixMode
}

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: UserPrefs = {
    fixMode: 'preview',
}

const STORAGE_KEY = `${BRAND.productLower}:user-prefs`

// ── Storage helpers ────────────────────────────────────────────────────────────

function readFromStorage(): UserPrefs {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return DEFAULT_PREFS
        const parsed = JSON.parse(raw) as Partial<UserPrefs>
        return {
            fixMode: parsed.fixMode === 'auto' ? 'auto' : 'preview',
        }
    } catch {
        return DEFAULT_PREFS
    }
}

function writeToStorage(prefs: UserPrefs): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
        // Storage unavailable — silently ignore
    }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Returns current user preferences and a stable setter.
 * The setter accepts a partial patch and merges it with current state.
 * Changes are persisted immediately to localStorage.
 */
export function useUserPrefs(): [UserPrefs, (patch: Partial<UserPrefs>) => void] {
    const [prefs, setPrefsState] = useState<UserPrefs>(() => readFromStorage())

    // Re-sync from storage when another tab changes it (cross-tab support)
    useEffect(() => {
        function handleStorageEvent(e: StorageEvent) {
            if (e.key === STORAGE_KEY) {
                setPrefsState(readFromStorage())
            }
        }
        window.addEventListener('storage', handleStorageEvent)
        return () => window.removeEventListener('storage', handleStorageEvent)
    }, [])

    const setPrefs = useCallback((patch: Partial<UserPrefs>) => {
        setPrefsState((prev) => {
            const next = { ...prev, ...patch }
            writeToStorage(next)
            return next
        })
    }, [])

    return [prefs, setPrefs]
}
