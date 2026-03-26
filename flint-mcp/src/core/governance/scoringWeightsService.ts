/**
 * ScoringWeightsService — flint-mcp/src/core/governance/scoringWeightsService.ts
 *
 * Pure-function service that applies configurable scoring weights defined in
 * the `scoring.weights` section of flint.config.yaml (FlintProjectConfig).
 *
 * Weights map to the three-mode rule taxonomy (coercive/normative/advisory)
 * plus a recency modifier that inflates the score for recent violations.
 *
 * Domain presets provide sensible industry defaults when no explicit weights
 * are configured. Custom weights always take precedence over domain presets.
 *
 * Phase: UCFG.5 — Conditional Approval Gates + Scoring Weights + Data Classification
 */

import type { FlintProjectConfig, GovernanceDomain } from '../config.js'

// ── Public types ─────────────────────────────────────────────────────────────

export interface WeightedScore {
    raw: number
    weighted: number
    weights: { coercive: number; normative: number; advisory: number; recency: number }
}

// ── Weight constants ──────────────────────────────────────────────────────────

interface WeightsConfig {
    coercive: number
    normative: number
    advisory: number
    recency: number
}

const DEFAULT_WEIGHTS: WeightsConfig = {
    coercive: 0.8,
    normative: 0.6,
    advisory: 0.3,
    recency: 0.4,
}

const DOMAIN_PRESETS: Partial<Record<GovernanceDomain, WeightsConfig>> = {
    healthcare: { coercive: 0.95, normative: 0.8, advisory: 0.5, recency: 0.7 },
    fintech: { coercive: 0.9, normative: 0.7, advisory: 0.4, recency: 0.6 },
    government: { coercive: 0.95, normative: 0.85, advisory: 0.6, recency: 0.8 },
}

// ── resolveWeights ────────────────────────────────────────────────────────────

/**
 * Resolves scoring weights from config with domain preset fallback.
 *
 * Resolution order:
 *   1. Custom weights from `scoring.weights` (per key, partial override ok)
 *   2. Domain preset (when `domain` matches a known preset)
 *   3. Built-in defaults
 *
 * Custom weights override domain presets key-by-key, so you can use a
 * domain preset as a base and tweak a single weight.
 */
export function resolveWeights(
    scoring?: FlintProjectConfig['scoring'],
    domain?: string
): { coercive: number; normative: number; advisory: number; recency: number } {
    // Start with built-in defaults
    const base = { ...DEFAULT_WEIGHTS }

    // Apply domain preset if available
    if (domain && domain in DOMAIN_PRESETS) {
        const preset = DOMAIN_PRESETS[domain as GovernanceDomain]
        if (preset) {
            Object.assign(base, preset)
        }
    }

    // Apply custom weights (partial ok — only defined keys win)
    const custom = scoring?.weights
    if (custom) {
        if (typeof custom.coercive === 'number') base.coercive = custom.coercive
        if (typeof custom.normative === 'number') base.normative = custom.normative
        if (typeof custom.advisory === 'number') base.advisory = custom.advisory
        if (typeof custom.recency === 'number') base.recency = custom.recency
    }

    return base
}

// ── computeWeightedScore ──────────────────────────────────────────────────────

/**
 * Computes a weighted debt/risk score from a list of violations.
 *
 * Each violation contributes its base weight (by mode) multiplied by a
 * recency modifier derived from the optional `recency` field (0–1 where 1 =
 * most recent). Violations without a recency value use a neutral modifier of 1.
 *
 * The raw score is the unweighted violation count (number of violations).
 * The weighted score sums the per-violation contributions.
 *
 * Returns zeroed WeightedScore for an empty violations array.
 */
export function computeWeightedScore(
    violations: { mode: string; recency?: number }[],
    scoring?: FlintProjectConfig['scoring'],
    domain?: string
): WeightedScore {
    const weights = resolveWeights(scoring, domain)

    if (violations.length === 0) {
        return { raw: 0, weighted: 0, weights }
    }

    const raw = violations.length

    let weighted = 0
    for (const v of violations) {
        // Base weight by mode — default to advisory for unknown modes
        let base: number
        switch (v.mode) {
            case 'coercive':
            case 'blocking':
                base = weights.coercive
                break
            case 'normative':
                base = weights.normative
                break
            case 'advisory':
                base = weights.advisory
                break
            default:
                base = weights.advisory
        }

        // Recency modifier: 0 = oldest, 1 = newest
        // A fully-recent violation is inflated by the recency weight;
        // an old violation (recency = 0) gets no recency bonus.
        const recencyModifier = v.recency !== undefined ? 1 + v.recency * weights.recency : 1

        weighted += base * recencyModifier
    }

    return { raw, weighted, weights }
}
