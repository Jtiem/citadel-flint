/**
 * SYNC.3 — Sync Violation Checker
 *
 * Two new violation types for the Mithril linter:
 *   SYNC-001: Token Out of Sync — local token diverged from Figma source
 *   SYNC-002: Orphaned Token — local token has no Figma variable mapping
 *
 * Uses CIEDE2000 ΔE for color comparison (threshold 2.0), string equality
 * for non-color tokens.
 */

import type Database from 'better-sqlite3'
import type { LinterWarning } from '../../types.js'
import { MITHRIL_THRESHOLD, hexToLab, deltaE2000 } from './colorMath.js'

// Re-export color math from MithrilLinter to avoid duplication.
// We import from a shared module (created below) or inline.

// ---------------------------------------------------------------------------
// DB row shape (matches token_source table)
// ---------------------------------------------------------------------------

interface TokenSourceRow {
    token_name: string
    token_value: string
    source: string
    figma_variable_id: string | null
}

// ---------------------------------------------------------------------------
// Design token file shape (flat key-value from .flint/design-tokens.json)
// ---------------------------------------------------------------------------

export interface DesignTokenFileEntry {
    token_path: string
    token_type: string
    token_value: string
}

// ---------------------------------------------------------------------------
// Core checker
// ---------------------------------------------------------------------------

/**
 * Check for SYNC-001 and SYNC-002 violations by comparing local
 * design-tokens.json against the token_source baseline table.
 */
export function checkSyncViolations(
    localTokens: DesignTokenFileEntry[],
    db: Database.Database,
    projectRoot: string,
    threshold = MITHRIL_THRESHOLD,
): LinterWarning[] {
    const warnings: LinterWarning[] = []

    // Load baseline from token_source table
    const rows = db
        .prepare('SELECT token_name, token_value, source, figma_variable_id FROM token_source WHERE project_root = ?')
        .all(projectRoot) as TokenSourceRow[]

    // Index baseline by token_name for O(1) lookup
    const baselineMap = new Map<string, TokenSourceRow>()
    for (const row of rows) {
        baselineMap.set(row.token_name, row)
    }

    for (const token of localTokens) {
        const baseline = baselineMap.get(token.token_path)

        // SYNC-002: No figma mapping
        if (!baseline || baseline.source !== 'figma') {
            warnings.push({
                id: `sync-orphan::${token.token_path}`,
                type: 'sync',
                severity: 'advisory',
                value: 0,
                message: `SYNC-002: Token '${token.token_path}' has no Figma variable mapping`,
                nearestToken: null,
                nearestTokenValue: null,
                ruleId: 'SYNC-002',
            })
            continue
        }

        // SYNC-001: Value divergence check
        if (token.token_type === 'color') {
            // Use CIEDE2000 for perceptual color comparison
            const localLab = hexToLab(token.token_value)
            const baselineLab = hexToLab(baseline.token_value)

            if (localLab && baselineLab) {
                const dE = deltaE2000(localLab, baselineLab)
                if (dE > threshold) {
                    warnings.push({
                        id: `sync-drift::${token.token_path}`,
                        type: 'sync',
                        severity: 'amber',
                        value: dE,
                        message: `SYNC-001: Token '${token.token_path}' color diverged from Figma source (ΔE ${dE.toFixed(1)})`,
                        nearestToken: token.token_path,
                        nearestTokenValue: baseline.token_value,
                        ruleId: 'SYNC-001',
                    })
                }
            }
        } else {
            // Non-color: simple string comparison
            if (token.token_value !== baseline.token_value) {
                warnings.push({
                    id: `sync-drift::${token.token_path}`,
                    type: 'sync',
                    severity: 'amber',
                    value: 1,
                    message: `SYNC-001: Token '${token.token_path}' value '${token.token_value}' differs from Figma source '${baseline.token_value}'`,
                    nearestToken: token.token_path,
                    nearestTokenValue: baseline.token_value,
                    ruleId: 'SYNC-001',
                })
            }
        }
    }

    return warnings
}
