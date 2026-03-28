/**
 * useUnifiedViolations — src/hooks/useUnifiedViolations.ts
 *
 * GLASS.1d: Derived hook that reads from BOTH editorStore and canvasStore
 * and merges violations into a single unified list.
 *
 * This is the single consistent view of all violations for GovernanceOverlay,
 * StatusBar count, ShieldOverlay badge linking, and any future surface.
 *
 * The export gate logic in canvasStore.canExport remains untouched — this hook
 * is purely a read-side unification layer.
 *
 * Data sources:
 *   - editorStore.linterWarnings — Map<string, LinterWarning> (rich objects)
 *   - canvasStore.mithrilViolations — string[] (flint IDs with ΔE drift)
 *   - canvasStore.a11yViolations — Record<string, string[]> (flint ID → rule messages)
 *
 * Merge strategy:
 *   1. For each entry in linterWarnings, create a UnifiedViolation
 *   2. For mithrilViolations not already covered by linterWarnings, add basic entries
 *   3. For a11yViolations, create one UnifiedViolation per (flintId, ruleMessage) pair
 *   4. Deduplicate by flintId + ruleId
 */

import { useMemo } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useCanvasStore } from '../store/canvasStore'
import type { LinterWarning } from '../types/flint-api'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UnifiedViolation {
    /** Unique violation key (flintId + ruleId or index-based). */
    id: string
    /** The data-flint-id of the affected node. */
    flintId: string
    /** Violation category. */
    type: 'mithril' | 'a11y'
    /** Rule identifier extracted from the message, e.g. 'MITHRIL-COL-001', 'A11Y-IMG-ALT'. */
    ruleId: string | null
    /** Severity level normalized to a 3-tier scale. */
    severity: 'critical' | 'warning' | 'info'
    /** Human-readable violation description. */
    message: string
    /** True when a deterministic auto-fix is available. */
    autoFixAvailable: boolean
    /** The nearest token class for auto-fix, or null. */
    nearestToken: string | null
    /** Original LinterWarning if sourced from editorStore, for richer downstream use. */
    source?: LinterWarning
}

export interface UnifiedViolationResult {
    violations: UnifiedViolation[]
    totalCount: number
    autoFixableCount: number
    mithrilCount: number
    a11yCount: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extracts the rule ID from the leading prefix of a linter or a11y message.
 * Messages are formatted as `"<RULE-ID>: <description>"`.
 * Returns null when the message does not start with a recognisable rule prefix.
 */
function extractRuleId(message: string): string | null {
    const match = /^([A-Z0-9][\w-]*):/.exec(message)
    return match ? match[1] : null
}

/**
 * Maps LinterWarning severity to the unified 3-tier scale.
 * 'critical' → 'critical', 'amber' → 'warning', 'advisory' → 'info'
 */
function mapSeverity(severity: LinterWarning['severity']): UnifiedViolation['severity'] {
    switch (severity) {
        case 'critical': return 'critical'
        case 'amber':    return 'warning'
        case 'advisory': return 'info'
        default:         return 'warning'
    }
}

/**
 * Determines the violation type from a LinterWarning type field.
 * A11y warnings → 'a11y', everything else → 'mithril'.
 */
function mapType(type: LinterWarning['type']): 'mithril' | 'a11y' {
    return type === 'a11y' ? 'a11y' : 'mithril'
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useUnifiedViolations(): UnifiedViolationResult {
    const linterWarnings     = useEditorStore((s) => s.linterWarnings)
    const mithrilViolations  = useCanvasStore((s) => s.mithrilViolations)
    const a11yViolations     = useCanvasStore((s) => s.a11yViolations)

    return useMemo(() => {
        const seen = new Set<string>()
        const violations: UnifiedViolation[] = []

        // ── 1. Rich violations from editorStore.linterWarnings ────────────
        for (const [flintId, warning] of linterWarnings) {
            const ruleId = extractRuleId(warning.message)
            const dedupeKey = `${flintId}::${ruleId ?? warning.message}`

            if (seen.has(dedupeKey)) continue
            seen.add(dedupeKey)

            violations.push({
                id: dedupeKey,
                flintId,
                type: mapType(warning.type),
                ruleId,
                severity: mapSeverity(warning.severity),
                message: warning.message,
                autoFixAvailable: warning.nearestToken !== null,
                nearestToken: warning.nearestToken,
                source: warning,
            })
        }

        // ── 2. Basic mithril violations not already covered ───────────────
        for (const flintId of mithrilViolations) {
            const dedupeKey = `${flintId}::MITHRIL-DRIFT`
            if (seen.has(dedupeKey)) continue
            // Check if this flintId is already represented via linterWarnings
            if (linterWarnings.has(flintId)) continue

            seen.add(dedupeKey)
            violations.push({
                id: dedupeKey,
                flintId,
                type: 'mithril',
                ruleId: null,
                severity: 'warning',
                message: `Design token drift detected on ${flintId}`,
                autoFixAvailable: false,
                nearestToken: null,
            })
        }

        // ── 3. A11y violations — one per (flintId, ruleMessage) ───────────
        for (const [flintId, messages] of Object.entries(a11yViolations)) {
            for (const msg of messages) {
                const ruleId = extractRuleId(msg)
                const dedupeKey = `${flintId}::${ruleId ?? msg}`

                if (seen.has(dedupeKey)) continue
                seen.add(dedupeKey)

                violations.push({
                    id: dedupeKey,
                    flintId,
                    type: 'a11y',
                    ruleId,
                    severity: 'critical',
                    message: msg,
                    autoFixAvailable: false,
                    nearestToken: null,
                })
            }
        }

        // ── Derived counts ────────────────────────────────────────────────
        let autoFixableCount = 0
        let mithrilCount = 0
        let a11yCount = 0

        for (const v of violations) {
            if (v.autoFixAvailable) autoFixableCount++
            if (v.type === 'mithril') mithrilCount++
            if (v.type === 'a11y') a11yCount++
        }

        return {
            violations,
            totalCount: violations.length,
            autoFixableCount,
            mithrilCount,
            a11yCount,
        }
    }, [linterWarnings, mithrilViolations, a11yViolations])
}
