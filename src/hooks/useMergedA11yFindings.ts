/**
 * useMergedA11yFindings — src/hooks/useMergedA11yFindings.ts
 *
 * Pure derivation hook. Merges AST-time accessibility findings with
 * runtime-dom findings from the axe-core adapter, deduplicating by
 * (mappedWardenRuleId, elementId).
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 * Contract test boundaries:
 *   - `useMergedA11yFindings dedup`
 *   - `useMergedA11yFindings no dedup different element`
 *   - `useMergedA11yFindings runtime-only`
 *   - `useMergedA11yFindings memoization`
 *
 * Dedup rules (contract Decision #3):
 *   - Same `ruleId` AND same `elementId` across AST + runtime →
 *     single MergedA11yFinding with `sourceAuthorities: ['WCAG 2.1 AA', 'runtime-dom']`.
 *   - Different `elementId` with same `ruleId` → two separate findings.
 *   - Runtime-only finding (ruleId prefix 'RUNTIME-') → single finding
 *     with `sourceAuthorities: ['runtime-dom']` alone.
 *
 * Memoization invariant: given same input references, return same array
 * reference so React consumers (GovernanceDashboard) don't re-render on
 * no-op updates.
 *
 * Architectural notes:
 *   - Pure function wrapped in `useMemo`. No side effects, no IPC.
 *   - Does NOT read Zustand stores directly — the caller passes inputs
 *     so tests can exercise pure behavior without store state.
 *   - The companion selector version `useMergedA11yFindingsFromStore`
 *     reads from canvasStore and is what GovernanceDashboard consumes.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import type {
    A11yViolationDetail,
    MergedA11yFinding,
    RuntimeAuditResult,
    RuntimeSourceAuthority,
} from '../types/runtime-audit'

// ── Dedup key builder ────────────────────────────────────────────────────────

/**
 * Dedup key is `${ruleId}\u0001${elementId}` — the unit separator character
 * guards against false merges when a legitimate ruleId or elementId contains
 * a literal hyphen. Using a control char rather than a printable separator
 * makes pathological IDs non-forging by construction.
 */
function buildKey(ruleId: string, elementId: string): string {
    return `${ruleId}\u0001${elementId}`
}

// ── Severity merger ──────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<A11yViolationDetail['severity'], number> = {
    critical: 3,
    warning: 2,
    advisory: 1,
    info: 0,
}

/**
 * Returns the "higher" severity between two values.
 * Contract edge case `dedup`: "Merged severity is the higher of the two".
 */
function mergeSeverity(
    a: A11yViolationDetail['severity'],
    b: A11yViolationDetail['severity'],
): A11yViolationDetail['severity'] {
    return SEVERITY_WEIGHT[a] >= SEVERITY_WEIGHT[b] ? a : b
}

// ── Pure merge function (export for tests) ───────────────────────────────────

/**
 * Pure merge — safe to call outside React. Tests exercise this directly
 * so they don't need to mount a component.
 *
 * Input `astFindings` are A11yViolationDetail entries with their Warden
 * ruleId (e.g. 'A11Y-001') already assigned. Input `runtimeFindings` are
 * the normalized entries from the axe-core adapter — either already-mapped
 * Warden IDs (when axeRuleMap matched) or 'RUNTIME-<axe-id>' fallbacks.
 */
export function mergeA11yFindings(
    astFindings: A11yViolationDetail[],
    runtimeFindings: A11yViolationDetail[],
): MergedA11yFinding[] {
    const out: MergedA11yFinding[] = []
    const keyToIndex = new Map<string, number>()

    // Pass 1: AST findings — each starts with authority ['WCAG 2.1 AA'].
    for (const f of astFindings) {
        const key = buildKey(f.ruleId, f.elementId)
        keyToIndex.set(key, out.length)
        out.push({
            ...f,
            sourceAuthorities: ['WCAG 2.1 AA'] as RuntimeSourceAuthority[],
        })
    }

    // Pass 2: Runtime findings — dedup into an existing AST row when the
    // (ruleId, elementId) matches; otherwise append as a new row with the
    // single 'runtime-dom' authority.
    for (const f of runtimeFindings) {
        const key = buildKey(f.ruleId, f.elementId)
        const existingIndex = keyToIndex.get(key)

        if (existingIndex !== undefined) {
            const existing = out[existingIndex]
            // Deterministic chip order: AST first, runtime second (contract
            // edge case `GovernanceDashboard merged row`: "Chip order is
            // deterministic (AST first, runtime second)").
            out[existingIndex] = {
                ...existing,
                severity: mergeSeverity(existing.severity, f.severity),
                // Keep AST's message when both are present — AST is Flint's
                // canonical source. Runtime adds authority, not narrative.
                sourceAuthorities: [...existing.sourceAuthorities, 'runtime-dom'],
            }
        } else {
            out.push({
                ...f,
                sourceAuthorities: ['runtime-dom'] as RuntimeSourceAuthority[],
            })
            keyToIndex.set(key, out.length - 1)
        }
    }

    return out
}

// ── Hook: pure form (inputs-as-props) ────────────────────────────────────────

/**
 * Pure derivation hook. Memoized over stable inputs so referential equality
 * holds when nothing has changed (contract invariant: `useMergedA11yFindings
 * memoization` — returns same array reference on unchanged inputs).
 */
export function useMergedA11yFindings(
    astFindings: A11yViolationDetail[],
    runtimeResult: RuntimeAuditResult | null,
): MergedA11yFinding[] {
    return useMemo(() => {
        const runtimeFindings = runtimeResult?.violations ?? []
        return mergeA11yFindings(astFindings, runtimeFindings)
    }, [astFindings, runtimeResult])
}

// ── Hook: store-reading form (what GovernanceDashboard uses) ─────────────────

/**
 * Projects canvasStore.a11yViolations (Record<flintId, string[]>) into the
 * A11yViolationDetail shape the merger expects, then merges with
 * canvasStore.runtimeFindings.
 *
 * GovernanceDashboard already has a richer per-warning pipeline (see
 * `LinterWarning` consumption) — this hook exists for the "Runtime Audit"
 * accordion specifically, which needs the merged authority-aware view.
 *
 * The projection is conservative:
 *   - Each entry in a11yViolations becomes one A11yViolationDetail with
 *     the message's leading RULE-ID prefix (if any) extracted into ruleId.
 *   - When no prefix is found the ruleId falls back to 'A11Y' (matches
 *     the ruleId fallback used in GovernanceDashboard).
 *   - severity / wcag / fixable are sentinel defaults — the accordion
 *     uses ruleId + message + elementId for display; severity is kept
 *     for merge math only.
 */
export function useMergedA11yFindingsFromStore(): MergedA11yFinding[] {
    const a11yViolations = useCanvasStore((s) => s.a11yViolations)
    const runtimeFindings = useCanvasStore((s) => s.runtimeFindings)

    const astFindings = useMemo<A11yViolationDetail[]>(() => {
        const out: A11yViolationDetail[] = []
        for (const [flintId, messages] of Object.entries(a11yViolations)) {
            for (const message of messages) {
                const match = /^([A-Z0-9-]+):/.exec(message)
                const ruleId = match ? match[1] : 'A11Y'
                out.push({
                    ruleId,
                    elementId: flintId,
                    message,
                    // AST-source violations are blocking by default — match
                    // the Commandment 5 posture ("Accessibility is a
                    // Compiler Error"). The merger respects this for severity.
                    severity: 'critical',
                    wcag: '',
                    fixable: false,
                })
            }
        }
        return out
    }, [a11yViolations])

    return useMergedA11yFindings(astFindings, runtimeFindings)
}
