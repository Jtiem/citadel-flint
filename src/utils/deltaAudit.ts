/**
 * deltaAudit.ts — Delta Mode violation filter (Gap 6)
 *
 * auditDelta() takes the full current violation list and strips out any
 * violation that was already present when the user set their baseline.
 * Only NEW violations (regressions introduced after the baseline snapshot)
 * are returned.
 *
 * Match key: composite (node_id, rule_id).
 * The file_path is used upstream when fetching the baseline (baseline:get),
 * so the list passed here is already scoped to the active file.
 *
 * This function is pure — no IPC, no SQLite. The caller is responsible for
 * fetching baseline entries via window.bridgeAPI.baseline.get(filePath).
 */

import type { LinterWarning, BaselineEntry } from '../types/bridge-api'

/**
 * Returns only the violations from `currentViolations` that are NOT present
 * in `baseline`. A violation is considered "known" when a baseline entry
 * exists with a matching (node_id, rule_id) composite key.
 *
 * @param currentViolations — Full set of violations from the current audit.
 *   Each entry must have `id` (data-bridge-id, used as node_id) and a rule id
 *   embedded in `message` or carried via the `ruleId` field on the extended type.
 *   In Bridge's LinterWarning the rule identifier is the violation `type`
 *   (e.g. 'color-drift', 'a11y') — the composite key is (id, type).
 * @param baseline — Rows returned by baseline:get(filePath).
 */
export function auditDelta(
    currentViolations: LinterWarning[],
    baseline: BaselineEntry[],
): LinterWarning[] {
    // Build a fast O(1) lookup set from the baseline rows.
    // Key format: "<node_id>:<rule_id>"
    const baselineSet = new Set<string>(
        baseline.map((b) => `${b.node_id}:${b.rule_id}`),
    )

    return currentViolations.filter(
        (v) => !baselineSet.has(`${v.id}:${v.type}`),
    )
}
