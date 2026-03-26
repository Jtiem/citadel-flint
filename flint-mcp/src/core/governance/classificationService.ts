/**
 * ClassificationService — flint-mcp/src/core/governance/classificationService.ts
 *
 * Maps the project's data classification level (from `classification` in
 * flint.config.yaml) to governance behaviour adjustments.
 *
 * Higher classification levels tighten:
 *   - deltaE multiplier (lower = stricter perceptual colour checks)
 *   - Minimum audit retention period
 *   - Risk score threshold that triggers mandatory human approval
 *
 * Callers (audit tools, risk scoring, export gate) consume the profile
 * to adapt their enforcement posture without needing to know about
 * classification directly.
 *
 * Phase: UCFG.5 — Conditional Approval Gates + Scoring Weights + Data Classification
 */

import type { DataClassification } from '../config.js'

// ── Public types ─────────────────────────────────────────────────────────────

export interface ClassificationProfile {
    classification: DataClassification
    /** Multiplier applied to the configured delta_e threshold. Lower = stricter. */
    deltaEMultiplier: number
    /** Minimum number of days audit records must be retained. */
    auditRetentionDays: number
    /** Risk score (0–100) above which human approval is mandatory. */
    requireApprovalAbove: number
}

// ── Profiles ──────────────────────────────────────────────────────────────────

const PROFILES: Record<DataClassification, ClassificationProfile> = {
    public: {
        classification: 'public',
        deltaEMultiplier: 1.0,
        auditRetentionDays: 30,
        requireApprovalAbove: 80,
    },
    internal: {
        classification: 'internal',
        deltaEMultiplier: 1.0,
        auditRetentionDays: 90,
        requireApprovalAbove: 70,
    },
    confidential: {
        classification: 'confidential',
        deltaEMultiplier: 0.8,
        auditRetentionDays: 365,
        requireApprovalAbove: 50,
    },
    restricted: {
        classification: 'restricted',
        deltaEMultiplier: 0.5,
        auditRetentionDays: 2190,
        requireApprovalAbove: 30,
    },
}

// ── getClassificationProfile ──────────────────────────────────────────────────

/**
 * Returns the governance profile for the given data classification level.
 *
 * Defaults to `internal` when classification is undefined or unrecognised.
 * This is the safest default: more conservative than public, less extreme
 * than confidential/restricted, matching the expected posture for most
 * internal enterprise projects.
 */
export function getClassificationProfile(
    classification?: DataClassification
): ClassificationProfile {
    if (!classification || !(classification in PROFILES)) {
        return { ...PROFILES.internal }
    }
    return { ...PROFILES[classification] }
}
