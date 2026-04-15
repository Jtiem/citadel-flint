/**
 * CoverageSection.tsx — C16
 *
 * Wraps CoverageBar + InheritanceChain with the data they need.
 * Rendered at the bottom of the MoreDetailsPanel content.
 * Pure presentational — all data passed as props.
 */

import { CoverageBar } from '../CoverageBar'
import { InheritanceChain } from '../InheritanceChain'

// ── Prop shape ────────────────────────────────────────────────────────────────

export interface CoverageSectionProps {
    /** Per-jurisdiction coverage map from governanceStore.jurisdictionCoverage. */
    jurisdictionCoverage: Record<string, { covered: number; total: number }> | null
    /** The config inheritance chain from governanceStore.inheritanceChain. */
    inheritanceChain: string[]
    /** True while IPC fetch is in progress. */
    isLoadingConfig: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CoverageSection({
    jurisdictionCoverage,
    inheritanceChain,
    isLoadingConfig,
}: CoverageSectionProps) {
    return (
        <>
            <CoverageBar coverages={jurisdictionCoverage} isLoading={isLoadingConfig} />
            <InheritanceChain chain={inheritanceChain} isLoading={isLoadingConfig} />
        </>
    )
}
