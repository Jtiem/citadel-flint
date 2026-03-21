/**
 * componentHealth.test.ts — CV2.4: Component Health Enrichment
 *
 * Tests the pure `computeComponentHealth` function and the async
 * `enrichComponentHealth` helper that was added to electron/main.ts.
 *
 * No Electron APIs (ipcMain, app, BrowserWindow) are imported — those cannot
 * run in a plain Node.js test environment. The pure functions are imported
 * directly from the implementation module.
 *
 * Coverage:
 *   CH-01 — grade A: 0 violations, maxDeltaE < 2.0
 *   CH-02 — grade B: 1 violation, maxDeltaE = 1.0 (≤ 2 violations, < 5.0)
 *   CH-03 — grade B: 2 violations, maxDeltaE = 4.9 (boundary)
 *   CH-04 — grade C: 3 violations, maxDeltaE = 3.0 (≤ 5 violations, < 10.0)
 *   CH-05 — grade C: 5 violations, maxDeltaE = 9.9 (boundary)
 *   CH-06 — grade D: 6 violations (≤ 10)
 *   CH-07 — grade D: 10 violations (boundary)
 *   CH-08 — grade F: 11 violations (> 10)
 *   CH-09 — maxDeltaE correctly reflects the max across all Mithril warnings
 *   CH-10 — enrichComponentHealth returns null when file cannot be read
 *   CH-11 — enrichComponentHealth returns null when auditAll throws
 *   CH-12 — grade A forces maxDeltaE check: 0 violations but deltaE ≥ 2.0 → grade B
 */

import { describe, it, expect } from 'vitest'
import { computeComponentHealth, enrichComponentHealth } from '../componentHealth.js'
import type { ComponentHealth } from '../componentHealth.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helper — build minimal auditAll / a11yAudit stubs
// ─────────────────────────────────────────────────────────────────────────────

type FakeFile = import('@babel/types').File

function makeAuditAll(warnings: Array<{ value?: number }>): (ast: FakeFile, tokens: unknown[]) => Map<string, { value?: number }> {
    return (_ast, _tokens) => {
        const map = new Map<string, { value?: number }>()
        warnings.forEach((w, i) => map.set(`node-${i}`, w))
        return map
    }
}

function makeA11yAudit(violationCount: number): (ast: FakeFile) => Record<string, string[]> {
    return (_ast) => {
        const result: Record<string, string[]> = {}
        if (violationCount > 0) {
            result['element-0'] = Array.from({ length: violationCount }, (_, i) => `violation-${i}`)
        }
        return result
    }
}

// Minimal valid TSX source that @babel/parser can handle.
const MINIMAL_TSX = `
import React from 'react';
export function Button({ label }: { label: string }) {
  return <button className="bg-blue-500 text-white px-4 py-2">{label}</button>;
}
`

// ─────────────────────────────────────────────────────────────────────────────
// computeComponentHealth — pure grade logic
// ─────────────────────────────────────────────────────────────────────────────

describe('computeComponentHealth', () => {
    it('CH-01 — returns grade A for 0 violations and maxDeltaE < 2.0', () => {
        const result: ComponentHealth = computeComponentHealth(0, 0, 1.5)
        expect(result.grade).toBe('A')
        expect(result.violationCount).toBe(0)
        expect(result.maxDeltaE).toBe(1.5)
        expect(result.mithrilCount).toBe(0)
        expect(result.a11yCount).toBe(0)
    })

    it('CH-02 — returns grade B for 1 violation and maxDeltaE = 1.0', () => {
        const result = computeComponentHealth(1, 0, 1.0)
        expect(result.grade).toBe('B')
        expect(result.violationCount).toBe(1)
        expect(result.mithrilCount).toBe(1)
    })

    it('CH-03 — returns grade B for 2 violations and maxDeltaE = 4.9 (boundary)', () => {
        const result = computeComponentHealth(1, 1, 4.9)
        expect(result.grade).toBe('B')
        expect(result.violationCount).toBe(2)
    })

    it('CH-04 — returns grade C for 3 violations and maxDeltaE = 3.0', () => {
        const result = computeComponentHealth(2, 1, 3.0)
        expect(result.grade).toBe('C')
        expect(result.violationCount).toBe(3)
    })

    it('CH-05 — returns grade C for 5 violations and maxDeltaE = 9.9 (boundary)', () => {
        const result = computeComponentHealth(3, 2, 9.9)
        expect(result.grade).toBe('C')
        expect(result.violationCount).toBe(5)
    })

    it('CH-06 — returns grade D for 6 violations', () => {
        const result = computeComponentHealth(3, 3, 0)
        expect(result.grade).toBe('D')
        expect(result.violationCount).toBe(6)
    })

    it('CH-07 — returns grade D for exactly 10 violations (boundary)', () => {
        const result = computeComponentHealth(5, 5, 0)
        expect(result.grade).toBe('D')
        expect(result.violationCount).toBe(10)
    })

    it('CH-08 — returns grade F for 11 violations (> 10)', () => {
        const result = computeComponentHealth(6, 5, 0)
        expect(result.grade).toBe('F')
        expect(result.violationCount).toBe(11)
    })

    it('CH-12 — 0 violations but maxDeltaE >= 2.0 yields grade B (not A)', () => {
        // Grade A requires BOTH 0 violations AND deltaE < 2.0.
        const result = computeComponentHealth(0, 0, 2.0)
        expect(result.grade).toBe('B')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// enrichComponentHealth — maxDeltaE extraction and graceful degradation
// ─────────────────────────────────────────────────────────────────────────────

describe('enrichComponentHealth', () => {
    it('CH-09 — maxDeltaE is the maximum value across all Mithril warnings', async () => {
        // Create a temp file so readFile succeeds.
        const { writeFileSync, unlinkSync } = await import('node:fs')
        const { join } = await import('node:path')
        const { tmpdir } = await import('node:os')
        const tmpPath = join(tmpdir(), `flint-cv24-test-${Date.now()}.tsx`)
        writeFileSync(tmpPath, MINIMAL_TSX, 'utf-8')

        try {
            const auditAll = makeAuditAll([{ value: 3.5 }, { value: 8.2 }, { value: 1.0 }])
            const a11yAudit = makeA11yAudit(0)

            const result = await enrichComponentHealth(tmpPath, [], auditAll, a11yAudit)

            expect(result).not.toBeNull()
            expect(result!.maxDeltaE).toBe(8.2)
            expect(result!.mithrilCount).toBe(3)
        } finally {
            unlinkSync(tmpPath)
        }
    })

    it('CH-10 — returns null when file cannot be read (graceful degradation)', async () => {
        const auditAll = makeAuditAll([])
        const a11yAudit = makeA11yAudit(0)

        const result = await enrichComponentHealth(
            '/nonexistent/path/to/component.tsx',
            [],
            auditAll,
            a11yAudit,
        )

        expect(result).toBeNull()
    })

    it('CH-11 — returns null when auditAll throws (graceful degradation)', async () => {
        const { writeFileSync, unlinkSync } = await import('node:fs')
        const { join } = await import('node:path')
        const { tmpdir } = await import('node:os')
        const tmpPath = join(tmpdir(), `flint-cv24-test-${Date.now()}.tsx`)
        writeFileSync(tmpPath, MINIMAL_TSX, 'utf-8')

        try {
            const throwingAuditAll = (_ast: FakeFile, _tokens: unknown[]): Map<string, { value?: number }> => {
                throw new Error('Mithril linter crashed')
            }
            const a11yAudit = makeA11yAudit(0)

            const result = await enrichComponentHealth(tmpPath, [], throwingAuditAll, a11yAudit)

            expect(result).toBeNull()
        } finally {
            unlinkSync(tmpPath)
        }
    })
})
