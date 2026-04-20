/**
 * RuntimeAuditPill.tsx — src/components/editor/RuntimeAuditPill.tsx
 *
 * Presentational StatusBar pill for the RUNTIME.1 axe-core runtime adapter.
 *
 * Contract source: .flint-context/contracts/RUNTIME.1.contract.ts
 * Contract test boundaries:
 *   - `RuntimeAuditPill idle`
 *   - `RuntimeAuditPill running`
 *   - `RuntimeAuditPill violations`
 *   - `RuntimeAuditPill keyboard`
 *
 * Visual states (driven by the `status` prop):
 *   idle             — neutral chip, "Runtime Audit" label
 *   running          — Loader2 spinner, aria-disabled (click blocked)
 *   passed           — emerald dot, "Runtime clean"
 *   violations       — amber tint for count 1–9, red tint for ≥ 10
 *   no-preview       — zinc, "No preview" (short-form caption)
 *   version-mismatch — red, "axe version mismatch"
 *   error            — red, "Runtime error"
 *
 * Commandment compliance:
 *   C2 (No Hallucinated Styling) — tints derive from the dedicated color
 *     map below, not ad-hoc literals at the call site. Matches the
 *     figmaDotColor + COVERAGE_DOT_COLOR pattern already established
 *     elsewhere in StatusBar.
 *   C5 (Accessibility is a Compiler Error) — the button always carries
 *     `aria-label="Run runtime accessibility audit"` per contract spec.
 *     Enter/Space activate it via the native button semantic; we add
 *     onKeyDown explicitly so the test for keyboard activation asserts
 *     a positive signal even in jsdom where default button behavior for
 *     Enter differs subtly from the real DOM.
 *
 * Rendering guardrail: this component renders ALWAYS when mounted. The
 * feature-flag / activeFilePath gating lives in StatusBar — the pill
 * itself has zero knowledge of context. This keeps it pure and makes
 * the `flag-off-ui-silent` invariant test straightforward (assert
 * `queryByTestId('runtime-audit-pill')` returns null at the StatusBar
 * level, not here).
 */

import { useCallback, type KeyboardEvent } from 'react'
import { Loader2, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react'
import type { RuntimeAuditStatus } from '../../types/runtime-audit'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RuntimeAuditPillProps {
    /** Current audit state. Drives icon + tint + label. */
    status: RuntimeAuditStatus
    /** Violations count. Only rendered when `status === 'violations'`. */
    findingCount: number
    /** Click handler. Ignored while `status === 'running'` (pill is aria-disabled). */
    onClick: () => void
}

// ── Color map (Commandment 2) ────────────────────────────────────────────────

/**
 * Text-color class per state. Applied directly to the button; the icon
 * inherits `currentColor`. Centralized here so C2 tests can assert on the
 * data-state attribute without coupling to Tailwind literals.
 */
const STATE_TEXT_COLOR: Record<RuntimeAuditStatus, string> = {
    idle: 'text-zinc-400 hover:text-zinc-200',
    running: 'text-zinc-300',
    passed: 'text-emerald-400 hover:text-emerald-300',
    violations: 'text-amber-400 hover:text-amber-300',
    'no-preview': 'text-zinc-400 hover:text-zinc-200',
    'version-mismatch': 'text-red-400 hover:text-red-300',
    error: 'text-red-400 hover:text-red-300',
}

/**
 * Critical-tint override when findingCount >= 10. Only applies when
 * status === 'violations'.
 */
const VIOLATIONS_CRITICAL_TEXT = 'text-red-400 hover:text-red-300'

// ── Component ─────────────────────────────────────────────────────────────────

export function RuntimeAuditPill({
    status,
    findingCount,
    onClick,
}: RuntimeAuditPillProps) {
    const isRunning = status === 'running'

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLButtonElement>) => {
            if (isRunning) return
            if (e.key === 'Enter' || e.key === ' ') {
                // Some test harnesses (jsdom) do not synthesize a click from
                // Enter by default; we explicitly fire onClick so the
                // contract `RuntimeAuditPill keyboard` test asserts true.
                // preventDefault avoids double-firing in environments that
                // DO synthesize a click.
                e.preventDefault()
                onClick()
            }
        },
        [isRunning, onClick],
    )

    // Tint: violations status escalates to critical at >= 10 findings.
    const criticalCount = status === 'violations' && findingCount >= 10
    const textColor = criticalCount
        ? VIOLATIONS_CRITICAL_TEXT
        : STATE_TEXT_COLOR[status]

    // Build the testid per state so individual state tests can scope assertions
    // without ambiguity (e.g. idle vs running both exist in happy-path sequences).
    const stateTestId = `runtime-audit-pill-${status}`

    // Title attribute doubles as the aria-label source-of-truth when the
    // visible label doesn't convey full context (e.g. 'no-preview').
    const { title, visibleLabel } = deriveLabels(status, findingCount)

    return (
        <button
            type="button"
            onClick={isRunning ? undefined : onClick}
            onKeyDown={handleKeyDown}
            aria-label="Run runtime accessibility audit"
            aria-disabled={isRunning ? true : undefined}
            aria-busy={isRunning ? true : undefined}
            data-testid="runtime-audit-pill"
            data-state={status}
            title={title}
            className={`flex min-h-[24px] items-center gap-1.5 rounded px-1.5 py-0.5 text-xs transition-colors ${
                isRunning
                    ? 'cursor-wait'
                    : 'cursor-pointer hover:bg-zinc-800'
            } ${textColor}`}
        >
            {/* The inner state pill carries its own testid so state-specific
                tests can scope to e.g. runtime-audit-pill-idle without
                competing with the wrapper's stable runtime-audit-pill testid. */}
            <span
                data-testid={stateTestId}
                className="flex items-center gap-1.5"
            >
                <StatusIcon status={status} />
                {visibleLabel}
            </span>
        </button>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: RuntimeAuditStatus }) {
    switch (status) {
        case 'running':
            return (
                <Loader2
                    data-testid="runtime-audit-spinner"
                    className="h-3 w-3 animate-spin"
                    aria-hidden="true"
                />
            )
        case 'passed':
            return <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        case 'violations':
            return <ShieldAlert className="h-3 w-3" aria-hidden="true" />
        case 'version-mismatch':
        case 'error':
            return <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        case 'idle':
        case 'no-preview':
        default:
            return <ShieldCheck className="h-3 w-3 opacity-60" aria-hidden="true" />
    }
}

// ── Label derivation (pure) ──────────────────────────────────────────────────

function deriveLabels(
    status: RuntimeAuditStatus,
    findingCount: number,
): { title: string; visibleLabel: string } {
    switch (status) {
        case 'idle':
            return {
                title: 'Audit the rendered preview with axe-core',
                visibleLabel: 'Audit runtime',
            }
        case 'running':
            return {
                title: 'Runtime audit in progress…',
                visibleLabel: 'Auditing…',
            }
        case 'passed':
            return {
                title: 'axe-core found no runtime accessibility issues',
                visibleLabel: 'Runtime clean',
            }
        case 'violations':
            return {
                title: `${findingCount} runtime accessibility issue${findingCount === 1 ? '' : 's'} — click to review`,
                visibleLabel: `${findingCount}`,
            }
        case 'no-preview':
            return {
                title:
                    'Runtime audit skipped — no preview available. Open a file to audit.',
                visibleLabel: 'No preview',
            }
        case 'version-mismatch':
            return {
                title:
                    'axe-core version mismatch detected — contact your administrator to update the runtime bundle.',
                visibleLabel: 'axe mismatch',
            }
        case 'error':
            return {
                title: 'Runtime audit failed. Click to retry.',
                visibleLabel: 'Runtime error',
            }
    }
}
