/**
 * MithrilBaselineService — Unit Tests
 * bridge-mcp/src/core/__tests__/mithrilBaseline.test.ts
 *
 * Test map:
 *   1  — captureBaseline → getBaseline returns equivalent data
 *   2  — audit with no baseline → all violations returned (backward compatible)
 *   3  — audit with baseline → only new violations returned
 *   4  — violation removed from code → not in delta (correct suppression)
 *   5  — same violation in baseline and current → suppressed
 *   6  — clearBaseline → full audit restored (hasBaseline false, all returned)
 *   7  — hasBaseline true/false transitions
 *   8  — hash determinism: same warning always produces same hash
 *   9  — multiple files in one baseline
 *  10  — empty audit → empty delta
 *  11  — auditDelta snapshotId matches stored baseline
 *  12  — captureBaseline replaces old baseline (no duplicates)
 *  13  — ruleId falls back to warning.type when ruleId absent
 *  14  — two projects maintain independent baselines
 *  15  — clearBaseline returns correct deleted row count
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { MithrilBaselineService, computeViolationHash } from '../mithrilBaseline.js'
import type { LinterWarning } from '../../types.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_A = '/projects/alpha'
const PROJECT_B = '/projects/beta'

function makeWarning(overrides: Partial<LinterWarning> = {}): LinterWarning {
    return {
        id: 'node-001',
        type: 'color-drift',
        severity: 'amber',
        value: 14.7,
        message: 'MITHRIL-COL: ΔE 14.7 – use color.primary',
        nearestToken: 'color.primary',
        nearestTokenValue: '#3b82f6',
        ruleId: 'MITHRIL-COL',
        ...overrides,
    }
}

function makeWarningMap(filePath: string, warnings: LinterWarning[]): Map<string, LinterWarning[]> {
    return new Map([[filePath, warnings]])
}

// ── Shared DB per test ─────────────────────────────────────────────────────────

let db: Database.Database
let svc: MithrilBaselineService

beforeEach(() => {
    db = new Database(':memory:')
    svc = new MithrilBaselineService(db)
})

// ── Test 1: captureBaseline → getBaseline round-trip ──────────────────────────

describe('Test 1: captureBaseline → getBaseline round-trip', () => {
    it('returns a snapshot with the same projectRoot and snapshotId', () => {
        const w = makeWarning()
        const captured = svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w]))

        expect(captured.projectRoot).toBe(PROJECT_A)
        expect(typeof captured.snapshotId).toBe('string')
        expect(captured.snapshotId.length).toBeGreaterThan(0)
        expect(captured.capturedAt).toBeTruthy()

        const retrieved = svc.getBaseline(PROJECT_A)
        expect(retrieved).not.toBeNull()
        expect(retrieved!.projectRoot).toBe(PROJECT_A)
        expect(retrieved!.snapshotId).toBe(captured.snapshotId)
        expect(retrieved!.capturedAt).toBe(captured.capturedAt)
    })

    it('fileSnapshots contain the correct file and violation count', () => {
        const w1 = makeWarning({ id: 'n1' })
        const w2 = makeWarning({ id: 'n2', ruleId: 'MITHRIL-TYP-001', type: 'typography-drift' })

        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w1, w2]))
        const baseline = svc.getBaseline(PROJECT_A)!

        expect(baseline.fileSnapshots).toHaveLength(1)
        const fs = baseline.fileSnapshots[0]
        expect(fs.filePath).toBe('src/A.tsx')
        expect(fs.violationCount).toBe(2)
        expect(fs.violationHashes).toHaveLength(2)
    })

    it('each violationHash is a 64-character hex string', () => {
        const w = makeWarning()
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w]))
        const baseline = svc.getBaseline(PROJECT_A)!
        const hash = baseline.fileSnapshots[0].violationHashes[0]
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })
})

// ── Test 2: No baseline → all violations returned (backward compatible) ────────

describe('Test 2: audit with no baseline → all violations returned', () => {
    it('auditDelta returns all violations when hasBaseline is false', () => {
        const warnings = [makeWarning({ id: 'n1' }), makeWarning({ id: 'n2' })]
        const result = svc.auditDelta(warnings, PROJECT_A)

        expect(result.hasBaseline).toBe(false)
        expect(result.snapshotId).toBeNull()
        expect(result.newViolations).toHaveLength(2)
        expect(result.baselineViolationCount).toBe(0)
    })

    it('returns all violations for an empty baseline (no prior capture)', () => {
        const result = svc.auditDelta([], PROJECT_A)
        expect(result.hasBaseline).toBe(false)
        expect(result.newViolations).toHaveLength(0)
    })
})

// ── Test 3: audit with baseline → only new violations returned ─────────────────

describe('Test 3: audit with baseline → only new violations returned', () => {
    it('suppresses existing violation and surfaces new one', () => {
        const existing = makeWarning({ id: 'node-old', ruleId: 'MITHRIL-COL', value: 14.7 })
        const brandNew = makeWarning({ id: 'node-new', ruleId: 'MITHRIL-COL', value: 20.0 })

        // Capture baseline with only the existing violation.
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [existing]))

        // Current audit has both violations.
        const result = svc.auditDelta([existing, brandNew], PROJECT_A)

        expect(result.hasBaseline).toBe(true)
        expect(result.newViolations).toHaveLength(1)
        expect(result.newViolations[0].id).toBe('node-new')
        expect(result.baselineViolationCount).toBe(1)
    })

    it('returns empty newViolations when current audit matches baseline exactly', () => {
        const w = makeWarning()
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w]))

        const result = svc.auditDelta([w], PROJECT_A)

        expect(result.newViolations).toHaveLength(0)
        expect(result.baselineViolationCount).toBe(1)
    })
})

// ── Test 4: violation removed from code → not in delta ────────────────────────

describe('Test 4: violation removed from code → not in delta (correct)', () => {
    it('when current audit is empty, delta is empty regardless of baseline', () => {
        const w = makeWarning()
        // Baseline captured when violation existed.
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w]))

        // Current audit: violation has been fixed — nothing produced.
        const result = svc.auditDelta([], PROJECT_A)

        expect(result.hasBaseline).toBe(true)
        expect(result.newViolations).toHaveLength(0)
        expect(result.baselineViolationCount).toBe(0)
    })

    it('a baseline violation absent from current audit does not appear in delta', () => {
        const w1 = makeWarning({ id: 'old-gone' })
        const w2 = makeWarning({ id: 'still-here' })

        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w1, w2]))

        // w1 was fixed; only w2 remains.
        const result = svc.auditDelta([w2], PROJECT_A)

        expect(result.newViolations).toHaveLength(0)
        expect(result.baselineViolationCount).toBe(1) // only w2 is suppressed
    })
})

// ── Test 5: same violation in baseline and current → suppressed ────────────────

describe('Test 5: same violation in baseline and current → suppressed', () => {
    it('identical warning object is suppressed', () => {
        const w = makeWarning()
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w]))

        const result = svc.auditDelta([w], PROJECT_A)

        expect(result.newViolations).toHaveLength(0)
        expect(result.baselineViolationCount).toBe(1)
    })

    it('violation with same ruleId/nodeId/value but different message is still suppressed', () => {
        const original = makeWarning({ message: 'old message text' })
        const sameViolation = makeWarning({ message: 'new message text after token rename' })

        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [original]))

        const result = svc.auditDelta([sameViolation], PROJECT_A)

        // Hash is based on ruleId|nodeId|value — message is excluded.
        expect(result.newViolations).toHaveLength(0)
        expect(result.baselineViolationCount).toBe(1)
    })
})

// ── Test 6: clearBaseline → full audit restored ────────────────────────────────

describe('Test 6: clearBaseline → full audit restored', () => {
    it('after clear, hasBaseline returns false', () => {
        const w = makeWarning()
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w]))
        expect(svc.hasBaseline(PROJECT_A)).toBe(true)

        svc.clearBaseline(PROJECT_A)
        expect(svc.hasBaseline(PROJECT_A)).toBe(false)
    })

    it('after clear, auditDelta returns all violations with hasBaseline=false', () => {
        const w1 = makeWarning({ id: 'n1' })
        const w2 = makeWarning({ id: 'n2', value: 5.0 })

        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w1]))
        svc.clearBaseline(PROJECT_A)

        const result = svc.auditDelta([w1, w2], PROJECT_A)
        expect(result.hasBaseline).toBe(false)
        expect(result.newViolations).toHaveLength(2)
        expect(result.baselineViolationCount).toBe(0)
    })
})

// ── Test 7: hasBaseline true/false transitions ─────────────────────────────────

describe('Test 7: hasBaseline true/false transitions', () => {
    it('returns false before any capture', () => {
        expect(svc.hasBaseline(PROJECT_A)).toBe(false)
    })

    it('returns true after capture', () => {
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [makeWarning()]))
        expect(svc.hasBaseline(PROJECT_A)).toBe(true)
    })

    it('returns false after clear', () => {
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [makeWarning()]))
        svc.clearBaseline(PROJECT_A)
        expect(svc.hasBaseline(PROJECT_A)).toBe(false)
    })

    it('returns false for an unknown project root even when another project has a baseline', () => {
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [makeWarning()]))
        expect(svc.hasBaseline(PROJECT_B)).toBe(false)
    })
})

// ── Test 8: hash determinism ───────────────────────────────────────────────────

describe('Test 8: hash determinism — same input always produces same hash', () => {
    it('same warning produces identical hash on repeated calls', () => {
        const w = makeWarning()
        const h1 = computeViolationHash(w)
        const h2 = computeViolationHash(w)
        expect(h1).toBe(h2)
    })

    it('different nodeId produces different hash', () => {
        const w1 = makeWarning({ id: 'node-A' })
        const w2 = makeWarning({ id: 'node-B' })
        expect(computeViolationHash(w1)).not.toBe(computeViolationHash(w2))
    })

    it('different ruleId produces different hash', () => {
        const w1 = makeWarning({ ruleId: 'MITHRIL-COL' })
        const w2 = makeWarning({ ruleId: 'MITHRIL-SPC-001' })
        expect(computeViolationHash(w1)).not.toBe(computeViolationHash(w2))
    })

    it('different value produces different hash', () => {
        const w1 = makeWarning({ value: 5.0 })
        const w2 = makeWarning({ value: 5.000001 })
        // The values differ at 6dp: "5.000000" vs "5.000001"
        expect(computeViolationHash(w1)).not.toBe(computeViolationHash(w2))
    })

    it('values within float noise at 6dp produce the same hash', () => {
        // 5.0 and 5.0000001 both round to "5.000000" at 6dp
        const w1 = makeWarning({ value: 5.0 })
        const w2 = makeWarning({ value: 5.0000001 })
        expect(computeViolationHash(w1)).toBe(computeViolationHash(w2))
    })

    it('hash is a 64-character lowercase hex string', () => {
        const hash = computeViolationHash(makeWarning())
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('when ruleId is absent, falls back to warning.type in hash input', () => {
        const withRule: LinterWarning = makeWarning({ ruleId: 'MITHRIL-COL' })
        const withoutRule: LinterWarning = {
            ...makeWarning({ ruleId: undefined }),
            type: 'MITHRIL-COL' as LinterWarning['type'],
        }
        // Both should use 'MITHRIL-COL' as the rule component → same hash.
        // (Only possible when type === ruleId; tested here for the fallback path.)
        const h1 = computeViolationHash(withRule)
        const h2 = computeViolationHash(withoutRule)
        expect(h1).toBe(h2)
    })
})

// ── Test 9: multiple files in one baseline ─────────────────────────────────────

describe('Test 9: multiple files in one baseline', () => {
    it('captures and retrieves violations from multiple files', () => {
        const wA = makeWarning({ id: 'node-A', value: 10.0 })
        const wB = makeWarning({ id: 'node-B', value: 20.0 })

        const auditMap: Map<string, LinterWarning[]> = new Map([
            ['src/A.tsx', [wA]],
            ['src/B.tsx', [wB]],
        ])

        svc.captureBaseline(PROJECT_A, auditMap)
        const baseline = svc.getBaseline(PROJECT_A)!

        expect(baseline.fileSnapshots).toHaveLength(2)
        const filePaths = baseline.fileSnapshots.map((fs) => fs.filePath).sort()
        expect(filePaths).toEqual(['src/A.tsx', 'src/B.tsx'])
    })

    it('suppresses violations from both files in the delta', () => {
        const wA = makeWarning({ id: 'node-A', value: 10.0 })
        const wB = makeWarning({ id: 'node-B', value: 20.0 })
        const wNew = makeWarning({ id: 'node-C', value: 30.0 })

        const auditMap: Map<string, LinterWarning[]> = new Map([
            ['src/A.tsx', [wA]],
            ['src/B.tsx', [wB]],
        ])

        svc.captureBaseline(PROJECT_A, auditMap)

        // Current audit has both baseline violations plus one new one.
        const result = svc.auditDelta([wA, wB, wNew], PROJECT_A)

        expect(result.newViolations).toHaveLength(1)
        expect(result.newViolations[0].id).toBe('node-C')
        expect(result.baselineViolationCount).toBe(2)
    })
})

// ── Test 10: empty audit → empty delta ────────────────────────────────────────

describe('Test 10: empty audit → empty delta', () => {
    it('empty current violations with no baseline → empty newViolations', () => {
        const result = svc.auditDelta([], PROJECT_A)
        expect(result.newViolations).toHaveLength(0)
        expect(result.baselineViolationCount).toBe(0)
        expect(result.hasBaseline).toBe(false)
    })

    it('empty current violations with baseline → empty newViolations, 0 suppressed', () => {
        const w = makeWarning()
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w]))

        const result = svc.auditDelta([], PROJECT_A)
        expect(result.hasBaseline).toBe(true)
        expect(result.newViolations).toHaveLength(0)
        expect(result.baselineViolationCount).toBe(0)
    })

    it('empty baseline (no violations captured) with new violations → all new', () => {
        // Capture an empty audit (clean project) as baseline.
        svc.captureBaseline(PROJECT_A, new Map())

        const w = makeWarning()
        const result = svc.auditDelta([w], PROJECT_A)

        // Empty capture inserts no rows → service reports no baseline.
        // All violations pass through unchanged (backward-compatible path).
        expect(result.hasBaseline).toBe(false)
        expect(result.newViolations).toHaveLength(1)
        expect(result.baselineViolationCount).toBe(0)
    })
})

// ── Test 11: auditDelta snapshotId matches stored baseline ────────────────────

describe('Test 11: auditDelta snapshotId field', () => {
    it('snapshotId in DeltaResult matches the captured snapshot', () => {
        const w = makeWarning()
        const captured = svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w]))

        const result = svc.auditDelta([w], PROJECT_A)
        expect(result.snapshotId).toBe(captured.snapshotId)
    })
})

// ── Test 12: captureBaseline replaces old baseline ────────────────────────────

describe('Test 12: captureBaseline replaces old baseline (no duplicates)', () => {
    it('second capture replaces first — old violations are gone', () => {
        const wOld = makeWarning({ id: 'old-node', value: 10.0 })
        const wNew = makeWarning({ id: 'new-node', value: 20.0 })

        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [wOld]))
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [wNew]))

        // The old violation is no longer in the baseline — it should appear as new.
        const result = svc.auditDelta([wOld, wNew], PROJECT_A)
        expect(result.newViolations).toHaveLength(1)
        expect(result.newViolations[0].id).toBe('old-node')
        expect(result.baselineViolationCount).toBe(1) // wNew suppressed
    })

    it('getBaseline after second capture returns the new snapshotId', () => {
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [makeWarning({ id: 'n1' })]))
        const second = svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [makeWarning({ id: 'n2' })]))

        const stored = svc.getBaseline(PROJECT_A)!
        expect(stored.snapshotId).toBe(second.snapshotId)
        expect(stored.fileSnapshots[0].violationCount).toBe(1)
    })
})

// ── Test 13: ruleId fallback to warning.type ──────────────────────────────────

describe('Test 13: ruleId falls back to warning.type in hash when ruleId absent', () => {
    it('warning without ruleId uses type as the rule component', () => {
        const withoutRuleId: LinterWarning = {
            id: 'node-001',
            type: 'color-drift',
            severity: 'amber',
            value: 14.7,
            message: 'some message',
            nearestToken: null,
            nearestTokenValue: null,
            // ruleId intentionally omitted
        }

        const hash = computeViolationHash(withoutRuleId)
        // Should not throw, should return a 64-char hex string
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('a warning in baseline without ruleId is still correctly suppressed in delta', () => {
        const w: LinterWarning = {
            id: 'node-x',
            type: 'spacing-drift',
            severity: 'amber',
            value: 1.0,
            message: 'no rule id',
            nearestToken: null,
            nearestTokenValue: null,
        }

        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [w]))
        const result = svc.auditDelta([w], PROJECT_A)
        expect(result.newViolations).toHaveLength(0)
        expect(result.baselineViolationCount).toBe(1)
    })
})

// ── Test 14: two projects maintain independent baselines ──────────────────────

describe('Test 14: two projects maintain independent baselines', () => {
    it('Project A baseline does not affect Project B delta', () => {
        const wA = makeWarning({ id: 'node-A' })
        const wB = makeWarning({ id: 'node-B' })

        // Capture baseline only for Project A.
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [wA]))

        // Project B has no baseline — wB should appear as new.
        const resultB = svc.auditDelta([wB], PROJECT_B)
        expect(resultB.hasBaseline).toBe(false)
        expect(resultB.newViolations).toHaveLength(1)
    })

    it('clearing Project A baseline does not affect Project B', () => {
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', [makeWarning()]))
        svc.captureBaseline(PROJECT_B, makeWarningMap('src/B.tsx', [makeWarning({ id: 'bNode' })]))

        svc.clearBaseline(PROJECT_A)

        expect(svc.hasBaseline(PROJECT_A)).toBe(false)
        expect(svc.hasBaseline(PROJECT_B)).toBe(true)
    })
})

// ── Test 15: clearBaseline returns correct row count ─────────────────────────

describe('Test 15: clearBaseline returns deleted row count', () => {
    it('returns 0 when no baseline exists', () => {
        const count = svc.clearBaseline(PROJECT_A)
        expect(count).toBe(0)
    })

    it('returns the number of deleted rows equal to the number of violations snapshotted', () => {
        const warnings = [
            makeWarning({ id: 'n1' }),
            makeWarning({ id: 'n2' }),
            makeWarning({ id: 'n3' }),
        ]
        svc.captureBaseline(PROJECT_A, makeWarningMap('src/A.tsx', warnings))

        const deleted = svc.clearBaseline(PROJECT_A)
        expect(deleted).toBe(3)
    })

    it('returns correct count for multi-file baseline', () => {
        svc.captureBaseline(PROJECT_A, new Map([
            ['src/A.tsx', [makeWarning({ id: 'n1' }), makeWarning({ id: 'n2' })]],
            ['src/B.tsx', [makeWarning({ id: 'n3' })]],
        ]))

        const deleted = svc.clearBaseline(PROJECT_A)
        expect(deleted).toBe(3)
    })
})
