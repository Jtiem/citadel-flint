/**
 * MithrilLinter.coverage.test.ts
 *
 * Phase 0 — Coverage Honesty
 * Tests for the MithrilLinter ↔ coverageClassifier integration.
 *
 * CONTRACT-SOURCE: .flint-context/contracts/PHASE0-coverage-honesty.contract.ts
 * CONTRACT-BOUNDARY: "MithrilLinter.auditAll — coverage propagation"
 *
 * Test map:
 *   1 — each auditAllWithCoverage call returns a result with exactly one CoverageVerdict
 *   2 — a file with zero Mithril warnings still gets a CoverageVerdict attached
 *   3 — a file with Mithril warnings gets exactly one CoverageVerdict — not duplicated
 *   4 — CoverageVerdict from auditAllWithCoverage matches classifyCoverage directly
 *   5 — auditAllWithCoverage does not alter the existing warning shape
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import { auditAllWithCoverage, auditAll } from '../MithrilLinter.js'
import { classifyCoverage } from '../coverageClassifier.js'

function parseTsx(source: string) {
    return parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
}

const CLEAN_FILE = `
export const Button = () => (
    <button data-flint-id="btn-1" className="px-4 py-2">Click</button>
)
`

const STYLED_COMPONENTS_FILE = `
import styled from 'styled-components'
const Box = styled.div\`color: red;\`
export const Card = () => <Box data-flint-id="card-1">Card</Box>
`

describe('MithrilLinter.auditAllWithCoverage — coverage propagation', () => {

    it('1 — each auditAllWithCoverage call returns a result with exactly one CoverageVerdict', () => {
        const files = [
            CLEAN_FILE,
            STYLED_COMPONENTS_FILE,
            `export const A = () => <div className="p-4">A</div>`,
        ]
        for (const source of files) {
            const ast = parseTsx(source)
            const result = auditAllWithCoverage(ast, [], { source, filePath: '/src/Test.tsx' })
            expect(result).toHaveProperty('warnings')
            expect(result).toHaveProperty('coverage')
            expect(result.coverage).not.toBeNull()
            expect(['parsed', 'partial', 'skipped-unsupported']).toContain(result.coverage.status)
        }
    })

    it('2 — a file with zero Mithril warnings still gets a CoverageVerdict attached', () => {
        const ast = parseTsx(CLEAN_FILE)
        const result = auditAllWithCoverage(ast, [], { source: CLEAN_FILE, filePath: '/src/Button.tsx' })
        expect(result.warnings.size).toBe(0)
        expect(result.coverage).not.toBeNull()
        expect(result.coverage.status).toBe('parsed')
        expect(result.coverage.reason).toBeNull()
    })

    it('3 — a file with warnings gets exactly one CoverageVerdict object — not duplicated', () => {
        const ast = parseTsx(STYLED_COMPONENTS_FILE)
        const result = auditAllWithCoverage(ast, [], {
            source: STYLED_COMPONENTS_FILE,
            filePath: '/src/Card.tsx',
        })
        // coverage is a single object (not an array)
        expect(typeof result.coverage).toBe('object')
        expect(Array.isArray(result.coverage)).toBe(false)
        expect(result.coverage.reason).toBe('css-in-js-detected')
    })

    it('4 — CoverageVerdict from auditAllWithCoverage matches classifyCoverage output exactly', () => {
        const testCases = [
            { source: CLEAN_FILE, filePath: '/src/Button.tsx' },
            { source: STYLED_COMPONENTS_FILE, filePath: '/src/Card.tsx' },
        ]
        for (const { source, filePath } of testCases) {
            const ast = parseTsx(source)
            const fromAudit = auditAllWithCoverage(ast, [], { source, filePath }).coverage
            const direct = classifyCoverage({ filePath, source, ast })
            expect(fromAudit.status).toBe(direct.status)
            expect(fromAudit.reason).toBe(direct.reason)
        }
    })

    it('5 — auditAllWithCoverage does not alter the existing warning Map shape', () => {
        const source = `
export const Box = () => (
    <div data-flint-id="box-1" className="p-4">Box</div>
)
`
        const ast = parseTsx(source)
        const oldWarnings = auditAll(ast, [])
        const newResult = auditAllWithCoverage(ast, [], { source, filePath: '/src/Box.tsx' })

        // Warnings map must be equivalent to old auditAll output
        expect(newResult.warnings.size).toBe(oldWarnings.size)
        for (const [id, warning] of oldWarnings) {
            expect(newResult.warnings.has(id)).toBe(true)
            const newWarning = newResult.warnings.get(id)!
            expect(newWarning.type).toBe(warning.type)
            expect(newWarning.severity).toBe(warning.severity)
        }

        // Coverage is additive — present on new result only
        expect(newResult.coverage).toBeDefined()
        expect(newResult.coverage.status).toBe('parsed')
    })

})
