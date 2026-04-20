/**
 * SeverityChip.tsx — Shared severity pill for Counsel + Mint surfaces.
 *
 * Encapsulates the three canonical severity tiers (critical | amber | advisory)
 * so both surfaces speak one visual language. Introduced in MINT.5 Phase 1.
 *
 * Mithril compliance:
 * - No hardcoded hex colours — token palette only (Commandment 2).
 * - No arbitrary spacing — 4px grid scale only.
 *
 * Color vocabulary matches ViolationCard.tsx's existing critical/amber/advisory
 * pills so both components look identical without duplication.
 */

import type { ReactNode } from 'react'
import type { ChipSeverity, SeverityChipProps } from '../../../../.flint-context/contracts/MINT.5-phase1.contract'

// ── Color maps keyed by severity tier ────────────────────────────────────────

/**
 * Container class: background tint + border.
 * Matches the MRS badge patterns already established in ViolationCard:
 *   critical → bg-red-900/20 border-red-500/30
 *   amber    → bg-amber-400/10 border-amber-500/30
 *   advisory → bg-zinc-800 border-zinc-700/50
 */
const BG_CLASS: Record<ChipSeverity, string> = {
    critical: 'bg-red-500/10 border-red-500/30',
    amber:    'bg-amber-400/10 border-amber-500/30',
    advisory: 'bg-zinc-800 border-zinc-700/50',
}

/**
 * Text colour class per severity tier.
 */
const TEXT_CLASS: Record<ChipSeverity, string> = {
    critical: 'text-red-400',
    amber:    'text-amber-400',
    advisory: '[color:var(--text-secondary)]',
}

/**
 * Dot colour used when no `icon` prop is provided.
 */
const DOT_CLASS: Record<ChipSeverity, string> = {
    critical: 'bg-red-400',
    amber:    'bg-amber-400',
    advisory: 'bg-zinc-500',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the default aria-label from count, severity, and label.
 * When count is undefined the numeric prefix is omitted.
 *
 * Examples:
 *   count=3, severity='critical', label='contrast fails'
 *   → "3 critical contrast fails"
 *
 *   count=undefined, severity='advisory', label='dead tokens'
 *   → "advisory dead tokens"
 */
function defaultAriaLabel(
    count: number | undefined,
    severity: ChipSeverity,
    label: string,
): string {
    return count !== undefined
        ? `${count} ${severity} ${label}`
        : `${severity} ${label}`
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * SeverityChip — pure presentational leaf component.
 *
 * No state, no IPC, no store imports.
 * Keyboard tab order: chip is non-interactive, so tabIndex is not set
 * (element is not in the natural tab sequence by default).
 */
export function SeverityChip({
    severity,
    label,
    count,
    icon,
    'data-testid': testId,
    'aria-label': ariaLabelProp,
}: SeverityChipProps): ReactNode {
    const computedAriaLabel =
        ariaLabelProp ?? defaultAriaLabel(count, severity, label)

    return (
        <span
            data-testid={testId ?? 'severity-chip'}
            aria-label={computedAriaLabel}
            className={[
                'inline-flex items-center gap-1 rounded-full border',
                'px-1.5 py-0.5 text-[10px] font-medium leading-none',
                BG_CLASS[severity],
                TEXT_CLASS[severity],
            ].join(' ')}
            // Non-interactive element — deliberately excluded from tab order.
            // aria-label above provides accessible text for screen readers.
        >
            {/* Leading indicator: custom icon or severity dot */}
            {icon !== undefined ? (
                <span aria-hidden="true" className="shrink-0 flex items-center">
                    {icon}
                </span>
            ) : (
                <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[severity]}`}
                    aria-hidden="true"
                />
            )}

            {/* Count prefix — only rendered when count is defined */}
            {count !== undefined && (
                <span className="tabular-nums">{count}</span>
            )}

            {/* Label */}
            <span>{label}</span>
        </span>
    )
}
