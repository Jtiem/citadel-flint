/**
 * MithrilLinter — Severity Classification Tests (Phase B.1-d)
 *
 * Verifies the end-to-end pipeline that feeds the Export Gate severity UI:
 *
 *   Source JSX  →  visitClassNames / auditAll
 *               →  Map<bridgeId, LinterWarning>  (severity: 'amber' | 'critical')
 *               →  hasCriticalMithril computation (ExportModal gate)
 *
 * Coverage:
 *   1. visitClassNames — severity bucketing (amber vs critical) from real source code
 *   2. auditAll        — severity preserved through merged multi-visitor pipeline
 *   3. hasCriticalMithril — pure gate computation matching ExportModal.tsx logic
 *
 * Environment: pure Node.js — no React, no DOM, no Electron IPC.
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import { visitClassNames, auditAll, MITHRIL_THRESHOLD } from './MithrilLinter'
import type { DesignToken, LinterWarning } from '../types/bridge-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSource(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as File
}

/**
 * Replicates the `hasCriticalMithril` computation from ExportModal.tsx exactly:
 *   mithrilViolations.some((id) => linterWarnings.get(id)?.severity === 'critical')
 */
function hasCriticalMithril(
    mithrilViolations: string[],
    linterWarnings: Map<string, LinterWarning>
): boolean {
    return mithrilViolations.some(
        (id) => linterWarnings.get(id)?.severity === 'critical'
    )
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Single white token — lets visitClassNames always have something to compare against.
 * Both amber (#ebebeb) and critical (#000000) test cases use this token.
 */
const WHITE_TOKEN: DesignToken = {
    id: 1,
    token_path: 'color.white',
    token_type: 'color',
    token_value: '#ffffff',
    description: null,
    collection_name: 'Colors',
    mode: 'default',
}

/**
 * Source file with four JSX nodes for mixed-severity tests:
 *   clean-node    — no arbitrary color         → no violation
 *   amber-node    — bg-[#ebebeb] vs #ffffff    → ΔE ≈ 4.1  → amber
 *   critical-node — bg-[#000000] vs #ffffff    → ΔE ≈ 100  → critical
 *   (no bridge-id) — arbitrary color but no data-bridge-id → skipped by visitor
 */
const MIXED_SOURCE = `
export default function Fixture() {
    return (
        <div data-bridge-id="clean-node" className="bg-blue-500 p-4">
            <p data-bridge-id="amber-node" className="bg-[#ebebeb]">amber</p>
            <p data-bridge-id="critical-node" className="bg-[#000000]">critical</p>
            <p className="bg-[#cc4400]">no bridge id — visitor must skip this</p>
        </div>
    )
}`

// ── 1. visitClassNames — severity bucketing ───────────────────────────────────

describe('visitClassNames — severity bucketing (B.1-d)', () => {

    it('returns an empty map when no arbitrary color classes are present', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="bg-blue-500 text-white p-4" />
            }
        `)
        const result = visitClassNames(ast, [WHITE_TOKEN])
        expect(result.size).toBe(0)
    })

    it('returns no violation when ΔE is below MITHRIL_THRESHOLD', () => {
        // #fefefe is perceptually identical to #ffffff (ΔE ≈ 0.2 — well below 2.0)
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="bg-[#fefefe]" />
            }
        `)
        const result = visitClassNames(ast, [WHITE_TOKEN])
        expect(result.size).toBe(0)
    })

    it('assigns severity "amber" when MITHRIL_THRESHOLD < ΔE ≤ 10', () => {
        // #ebebeb (very light gray, L*≈93.1) vs #ffffff token → ΔE ≈ 4.1
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="amber-node" className="bg-[#ebebeb]" />
            }
        `)
        const result = visitClassNames(ast, [WHITE_TOKEN])
        const warning = result.get('amber-node')
        expect(warning).toBeDefined()
        // Guard: confirm the color pair actually lands in the amber ΔE range.
        // If this assertion fails the chosen color is too dark — adjust the hex.
        expect(warning!.value).toBeGreaterThan(MITHRIL_THRESHOLD)
        expect(warning!.value).toBeLessThanOrEqual(10)
        expect(warning!.severity).toBe('amber')
    })

    it('assigns severity "critical" when ΔE > 10', () => {
        // #000000 (black) vs #ffffff token → ΔE ≈ 100 — unambiguously critical
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="critical-node" className="bg-[#000000]" />
            }
        `)
        const result = visitClassNames(ast, [WHITE_TOKEN])
        const warning = result.get('critical-node')
        expect(warning).toBeDefined()
        expect(warning!.value).toBeGreaterThan(10)
        expect(warning!.severity).toBe('critical')
    })

    it('skips nodes that have no data-bridge-id attribute', () => {
        // The visitor requires data-bridge-id to key the warning — elements without
        // it must be silently ignored, not cause a crash or a spurious entry.
        const ast = parseSource(`
            export default function A() {
                return <div className="bg-[#000000]" />
            }
        `)
        const result = visitClassNames(ast, [WHITE_TOKEN])
        expect(result.size).toBe(0)
    })

    it('handles multiple nodes with mixed severities in one pass', () => {
        const ast = parseSource(MIXED_SOURCE)
        const result = visitClassNames(ast, [WHITE_TOKEN])

        expect(result.has('clean-node')).toBe(false)
        expect(result.get('amber-node')?.severity).toBe('amber')
        expect(result.get('critical-node')?.severity).toBe('critical')
        // The node without a bridge-id must not appear
        expect(result.size).toBe(2)
    })

    it('populates the message field with MITHRIL-COL prefix and ΔE value', () => {
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="bg-[#000000]" />
            }
        `)
        const result = visitClassNames(ast, [WHITE_TOKEN])
        const warning = result.get('n1')
        expect(warning?.message).toMatch(/^MITHRIL-COL:/)
        expect(warning?.message).toMatch(/ΔE/)
    })

    it('returns an empty map when the token list is empty', () => {
        // No tokens → findClosestToken returns null → no drift → no violations
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="bg-[#000000]" />
            }
        `)
        const result = visitClassNames(ast, [])
        expect(result.size).toBe(0)
    })

    it('picks the worst (highest) ΔE class per node when multiple arbitrary colors are present', () => {
        // amber-color (#ebebeb, ΔE ≈ 4) and critical-color (#000000, ΔE ≈ 100)
        // on the same node — the critical value must win.
        const ast = parseSource(`
            export default function A() {
                return <div data-bridge-id="n1" className="bg-[#ebebeb] text-[#000000]" />
            }
        `)
        const result = visitClassNames(ast, [WHITE_TOKEN])
        const warning = result.get('n1')
        expect(warning).toBeDefined()
        expect(warning!.severity).toBe('critical')
        expect(warning!.value).toBeGreaterThan(10)
    })
})

// ── 2. auditAll — end-to-end severity propagation ────────────────────────────

describe('auditAll — severity preserved through full pipeline (B.1-d)', () => {

    it('preserves critical severity through all five visitors', () => {
        const ast = parseSource(MIXED_SOURCE)
        const merged = auditAll(ast, [WHITE_TOKEN])
        expect(merged.get('critical-node')?.severity).toBe('critical')
    })

    it('preserves amber severity through all five visitors', () => {
        const ast = parseSource(MIXED_SOURCE)
        const merged = auditAll(ast, [WHITE_TOKEN])
        expect(merged.get('amber-node')?.severity).toBe('amber')
    })

    it('clean nodes produce no entry in the merged map', () => {
        const ast = parseSource(MIXED_SOURCE)
        const merged = auditAll(ast, [WHITE_TOKEN])
        expect(merged.has('clean-node')).toBe(false)
    })

    it('returns an empty map when ast has no JSX', () => {
        const ast = parseSource(`const x = 1`)
        const merged = auditAll(ast, [WHITE_TOKEN])
        expect(merged.size).toBe(0)
    })
})

// ── 3. hasCriticalMithril — ExportModal gate computation ─────────────────────
//
// This is the pure logic from ExportModal.tsx:
//   mithrilViolations.some((id) => linterWarnings.get(id)?.severity === 'critical')
//
// Tested independently of React so the gate invariant is verifiable without DOM.

describe('hasCriticalMithril — ExportModal gate computation (B.1-d)', () => {

    const makeWarning = (id: string, severity: LinterWarning['severity']): LinterWarning => ({
        id,
        type: 'color-drift',
        severity,
        value: severity === 'critical' ? 80 : 4,
        message: `MITHRIL-COL: ΔE ${severity === 'critical' ? '80.0' : '4.0'}`,
        nearestToken: 'color.white',
        nearestTokenValue: '#ffffff',
    })

    it('returns false when the violations list is empty', () => {
        expect(hasCriticalMithril([], new Map())).toBe(false)
    })

    it('returns false when all violations are amber severity', () => {
        const warnings = new Map([
            ['n1', makeWarning('n1', 'amber')],
            ['n2', makeWarning('n2', 'amber')],
        ])
        expect(hasCriticalMithril(['n1', 'n2'], warnings)).toBe(false)
    })

    it('returns true when at least one violation is critical', () => {
        const warnings = new Map([
            ['n1', makeWarning('n1', 'amber')],
            ['n2', makeWarning('n2', 'critical')],
        ])
        expect(hasCriticalMithril(['n1', 'n2'], warnings)).toBe(true)
    })

    it('returns true when only critical violations exist (no amber)', () => {
        const warnings = new Map([
            ['n1', makeWarning('n1', 'critical')],
        ])
        expect(hasCriticalMithril(['n1'], warnings)).toBe(true)
    })

    it('returns false when a listed violation ID is absent from the warnings map', () => {
        // Covers stale mithrilViolations IDs that no longer have a linterWarning entry
        expect(hasCriticalMithril(['stale-id'], new Map())).toBe(false)
    })

    it('only checks IDs listed in mithrilViolations, ignoring other warnings map entries', () => {
        // warnings has a critical entry, but mithrilViolations only lists the amber one
        const warnings = new Map([
            ['amber-node', makeWarning('amber-node', 'amber')],
            ['critical-node', makeWarning('critical-node', 'critical')],
        ])
        expect(hasCriticalMithril(['amber-node'], warnings)).toBe(false)
    })

    it('returns true only on the first critical ID — short-circuits correctly', () => {
        // Five warnings: first four amber, last one critical.
        // The gate must return true regardless of list position.
        const ids = ['a', 'b', 'c', 'd', 'e']
        const warnings = new Map(
            ids.map((id, i) => [id, makeWarning(id, i === 4 ? 'critical' : 'amber')])
        )
        expect(hasCriticalMithril(ids, warnings)).toBe(true)
    })

    // Integration: derive hasCriticalMithril from a real auditAll result
    it('correctly classifies a real auditAll result as critical when ΔE > 10 nodes exist', () => {
        const ast = parseSource(MIXED_SOURCE)
        const linterWarnings = auditAll(ast, [WHITE_TOKEN])
        const mithrilViolations = [...linterWarnings.keys()]
        // MIXED_SOURCE has a critical-node — gate must be true
        expect(hasCriticalMithril(mithrilViolations, linterWarnings)).toBe(true)
    })

    it('correctly classifies a real auditAll result as false when only amber nodes exist', () => {
        const ast = parseSource(`
            export default function AmberOnly() {
                return <div data-bridge-id="n1" className="bg-[#ebebeb]" />
            }
        `)
        const linterWarnings = auditAll(ast, [WHITE_TOKEN])
        const mithrilViolations = [...linterWarnings.keys()]
        expect(hasCriticalMithril(mithrilViolations, linterWarnings)).toBe(false)
    })
})
