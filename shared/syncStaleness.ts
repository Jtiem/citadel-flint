/**
 * shared/syncStaleness.ts — Pure sync staleness helpers (MINT.5 Phase 3 / Envoy)
 *
 * No I/O. No store access. Consumed by both the renderer (src/) and the
 * main process (electron/, server/). Single source of truth for staleness
 * semantics so Phase 4 has exactly one replacement target when the threshold
 * becomes policy-configurable.
 */

/**
 * Default threshold — a sync older than this is considered stale.
 * Matches typical CI cadence: longer than a workday, shorter than a sprint.
 * Phase 4 will wire this to `flint.config.yaml` under `sync.stalenessThresholdHours`.
 */
export const SYNC_STALENESS_THRESHOLD_HOURS_DEFAULT = 24

/**
 * Returns `true` when the duration since `staleSince` exceeds `thresholdHours`.
 *
 * - Returns `false` when `staleSince` is `null` (no sync ever recorded).
 * - Returns `false` when `staleSince` is in the future (clock skew guard).
 * - Threshold is inclusive: exactly `thresholdHours` elapsed → stale.
 *
 * @param staleSince   ISO 8601 timestamp of the last successful sync, or null.
 * @param thresholdHours  Staleness threshold in hours.
 * @param nowMs        Current time as Unix milliseconds (injectable for testing).
 */
export function isSyncStale(
    staleSince: string | null,
    thresholdHours: number,
    nowMs: number,
): boolean {
    if (staleSince === null) return false
    const syncMs = Date.parse(staleSince)
    if (isNaN(syncMs)) return false
    const elapsedMs = nowMs - syncMs
    if (elapsedMs < 0) return false // future timestamp — clock skew
    return elapsedMs >= thresholdHours * 3_600_000
}

/**
 * Formats a duration in milliseconds as a human-readable English string.
 *
 * Examples:
 *   45 * 60_000        → "45 minutes"
 *   26 * 3_600_000     → "26 hours"
 *   3  * 86_400_000    → "3 days"
 *
 * Rounds down to the largest whole unit. Sub-minute durations → "< 1 minute".
 *
 * @param durationMs  Non-negative duration in milliseconds.
 */
export function formatStaleness(durationMs: number): string {
    if (durationMs < 60_000) return '< 1 minute'
    const minutes = Math.floor(durationMs / 60_000)
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    const hours = Math.floor(durationMs / 3_600_000)
    if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
    const days = Math.floor(durationMs / 86_400_000)
    return `${days} ${days === 1 ? 'day' : 'days'}`
}
