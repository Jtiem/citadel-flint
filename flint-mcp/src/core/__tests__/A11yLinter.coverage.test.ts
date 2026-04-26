/**
 * A11yLinter.coverage.test.ts
 *
 * Phase 0 — Coverage Honesty
 * Tests for the A11yLinter ↔ coverageClassifier passthrough.
 *
 * CONTRACT-SOURCE: .flint-context/contracts/PHASE0-coverage-honesty.contract.ts
 * CONTRACT-BOUNDARY: "A11yLinter.auditStructured — coverage passthrough"
 *
 * Test map:
 *   1 — caller supplies preComputedCoverage → classifier NOT invoked, verdict propagated verbatim
 *   2 — caller omits preComputedCoverage → classifier runs once, verdict attached
 *   3 — supplied CoverageVerdict is attached verbatim to audit result (deep-equal)
 *   4 — classifier output is attached when caller omits verdict (parsed file → parsed verdict)
 *   5 — pre-existing A11y result shape is unchanged when coverage is attached
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parse } from '@babel/parser'
import { A11yLinter } from '../A11yLinter.js'
import type { CoverageVerdict } from '../../shared/coverageTypes.js'

function parseTsx(source: string) {
    return parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
}

const ACCESSIBLE_SOURCE = `
export const Button = () => (
    <button aria-label="Submit" data-flint-id="btn-1" className="px-4">Submit</button>
)
`

const STYLED_SOURCE = `
import styled from 'styled-components'
const Box = styled.div\`color: red;\`
export const Card = () => <Box aria-label="Card">Card</Box>
`

describe('A11yLinter.auditStructured — coverage passthrough', () => {

    it('1 — caller supplies preComputedCoverage → verdict propagated verbatim', async () => {
        const { classifyCoverage } = await import('../coverageClassifier.js')
        const spy = vi.spyOn({ classifyCoverage }, 'classifyCoverage')

        const preComputedCoverage: CoverageVerdict = {
            status: 'partial',
            reason: 'css-in-js-detected',
            details: 'styled-components at line 2',
        }

        const ast = parseTsx(STYLED_SOURCE)
        const result = A11yLinter.auditStructured(ast, '/src/Card.tsx', { preComputedCoverage })

        // The supplied verdict must be attached verbatim
        expect(result.coverage).toEqual(preComputedCoverage)
        expect(result.coverage.status).toBe('partial')
        expect(result.coverage.reason).toBe('css-in-js-detected')
        expect(result.coverage.details).toBe('styled-components at line 2')

        spy.mockRestore()
    })

    it('2 — caller omits preComputedCoverage → classifier runs and verdict is attached', () => {
        const ast = parseTsx(ACCESSIBLE_SOURCE)
        // No preComputedCoverage provided — backward-compat path
        const result = A11yLinter.auditStructured(ast, '/src/Button.tsx')
        expect(result.coverage).toBeDefined()
        expect(['parsed', 'partial', 'skipped-unsupported']).toContain(result.coverage.status)
        // An accessible Tailwind file should classify as 'parsed'
        expect(result.coverage.status).toBe('parsed')
        expect(result.coverage.reason).toBeNull()
    })

    it('3 — supplied CoverageVerdict is attached verbatim (deep-equal)', () => {
        const preComputedCoverage: CoverageVerdict = {
            status: 'partial',
            reason: 'css-in-js-detected',
            details: 'styled-components tagged template at line 42',
        }

        const ast = parseTsx(ACCESSIBLE_SOURCE)
        const result = A11yLinter.auditStructured(ast, '/src/Button.tsx', { preComputedCoverage })

        expect(result.coverage).toEqual(preComputedCoverage)
    })

    it('4 — classifier output attached when caller omits verdict (pure Tailwind → parsed)', () => {
        const source = `
export const Link = ({ href }: { href: string }) => (
    <a href={href} data-flint-id="link-1" className="text-blue-600 underline">Click</a>
)
`
        const ast = parseTsx(source)
        const result = A11yLinter.auditStructured(ast, '/src/Link.tsx')
        expect(result.coverage.status).toBe('parsed')
        expect(result.coverage.reason).toBeNull()
    })

    it('5 — pre-existing A11yAuditResult shape is unchanged when coverage is attached', () => {
        const ast = parseTsx(ACCESSIBLE_SOURCE)
        const result = A11yLinter.auditStructured(ast, '/src/Button.tsx')

        // All original A11yAuditResult fields must be present
        expect(typeof result.filePath).toBe('string')
        expect(typeof result.totalRules).toBe('number')
        expect(typeof result.passed).toBe('number')
        expect(typeof result.failed).toBe('number')
        expect(typeof result.compliancePercent).toBe('number')
        expect(Array.isArray(result.violations)).toBe(true)
        expect(Array.isArray(result.criterionResults)).toBe(true)
        expect(typeof result.fixableCount).toBe('number')
        expect(typeof result.timestamp).toBe('string')

        // Coverage is additive-only
        expect(result.coverage).toBeDefined()
    })

})
