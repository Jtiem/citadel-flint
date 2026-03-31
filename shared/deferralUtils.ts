/**
 * deferralUtils.ts — shared/deferralUtils.ts
 *
 * COUNSEL.2.1: Pure utility functions for defer-violation duration handling.
 * Shared by electron/main.ts and server/index.ts.
 *
 * No external dependencies — safe to import in both Node.js and Electron contexts.
 */

/**
 * Supported defer duration values.
 * Displayed as radio options in the inline defer form.
 * 'Manually' means no auto-expiry — the user must explicitly revisit.
 */
export type DeferDuration = '1 day' | '3 days' | '1 week' | '1 sprint' | 'Manually'

/**
 * Maps a DeferDuration to milliseconds offset from now.
 * Returns null for 'Manually' (no auto-expiry) and undefined (backward compat).
 *
 * The switch is exhaustive over all 5 DeferDuration values plus undefined.
 * TypeScript will catch any future additions to the DeferDuration union.
 */
export function durationToMs(duration: DeferDuration | undefined): number | null {
    switch (duration) {
        case '1 day':    return 1 * 24 * 60 * 60 * 1000   // 86400000
        case '3 days':   return 3 * 24 * 60 * 60 * 1000   // 259200000
        case '1 week':   return 7 * 24 * 60 * 60 * 1000   // 604800000
        case '1 sprint': return 14 * 24 * 60 * 60 * 1000  // 1209600000
        case 'Manually': return null
        case undefined:  return null
    }
}

/**
 * Computes the ISO 8601 expires_at string from a DeferDuration.
 * Returns null for 'Manually' (no auto-expiry) and undefined (backward compat).
 */
export function computeExpiresAt(duration: DeferDuration | undefined): string | null {
    const ms = durationToMs(duration)
    if (ms === null) return null
    return new Date(Date.now() + ms).toISOString()
}
