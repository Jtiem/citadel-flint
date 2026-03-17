/**
 * electron/ingestion/index.ts — Phase ING.1
 *
 * Barrel export for the ingestion heal pipeline.
 * Consumed by electron/ingestion-server.ts and electron/main.ts.
 */
export {
    heal,
    classifyViolation,
    snapToToken,
    TIER1_DELTA_E,
    TIER2_DELTA_E,
    TIER1_PX_DIFF,
    TIER2_PX_DIFF,
    TIER2_TYPO_PX,
    VIOLATION_CAP,
} from './IngestionAuditor.js'

export type {
    AuditorToken,
    IngestionTier,
    IngestionHealResult,
    IngestionSummary,
    IngestionFix,
    IngestionFlag,
} from './IngestionAuditor.js'
