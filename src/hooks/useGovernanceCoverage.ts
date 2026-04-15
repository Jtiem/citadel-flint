/**
 * useGovernanceCoverage — src/hooks/useGovernanceCoverage.ts
 *
 * H12: Compliance coverage + config inheritance data.
 *
 * Reads jurisdictionCoverage, inheritanceChain, and isLoadingConfig from
 * governanceStore (populated by the existing useGovernanceConfig hook which
 * is mounted at a higher level via GovernanceDashboard).
 *
 * This hook does NOT re-fetch — it reads from the store that useGovernanceConfig
 * already maintains. Components that consume this hook must ensure
 * useGovernanceConfig is also mounted somewhere in the tree.
 *
 * Zero .getState() in render path.
 */

import { useGovernanceStore } from '../store/governanceStore'
import type { UseGovernanceCoverageResult } from '../../.flint-context/contracts/sprint-2-glass-ui-fixes.contract'

export type { UseGovernanceCoverageResult }

export function useGovernanceCoverage(): UseGovernanceCoverageResult {
    const jurisdictionCoverage = useGovernanceStore((s) => s.jurisdictionCoverage)
    const inheritanceChain = useGovernanceStore((s) => s.inheritanceChain)
    const isLoadingConfig = useGovernanceStore((s) => s.isLoadingConfig)

    return {
        jurisdictionCoverage: jurisdictionCoverage ?? [],
        inheritanceChain,
        isLoadingConfig,
    }
}
