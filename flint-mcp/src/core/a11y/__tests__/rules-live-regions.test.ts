/**
 * Tests for live-regions rules (EXP.6a-ext)
 *
 * A11Y-080: Alert role with wrong aria-live
 * A11Y-081: Dialog missing aria-modal
 * A11Y-082: Unnecessary assertive live region
 * A11Y-083: Live region missing aria-atomic
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { liveRegionsRules } from '../rules/live-regions.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(liveRegionsRules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-080: role="alert" with conflicting aria-live ─────────────────────────

describe('A11Y-080: alert role with wrong aria-live', () => {
    it('flags role="alert" with aria-live="polite"', () => {
        const ast = parseJSX(`
            const C = () => <div role="alert" aria-live="polite">Error!</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-080')).toBe(true)
    })

    it('flags role="status" with aria-live="assertive"', () => {
        const ast = parseJSX(`
            const C = () => <div role="status" aria-live="assertive">Saved.</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-080')).toBe(true)
    })

    it('passes role="alert" without aria-live (implicit assertive)', () => {
        const ast = parseJSX(`
            const C = () => <div role="alert">Error!</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-080')).toHaveLength(0)
    })

    it('passes role="alert" with aria-live="assertive"', () => {
        const ast = parseJSX(`
            const C = () => <div role="alert" aria-live="assertive">Error!</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-080')).toHaveLength(0)
    })

    it('fix removes conflicting aria-live', () => {
        const ast = parseJSX(`
            const C = () => <div role="alert" aria-live="polite">Error!</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-080')!
        const rule = liveRegionsRules.find((r) => r.id === 'A11Y-080')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].type).toBe('updateProp')
        expect(fix!.mutations[0].args.propName).toBe('aria-live')
        expect(fix!.mutations[0].args.value).toBeNull()
    })
})

// ── A11Y-081: role="dialog" must have aria-modal ─────────────────────────────

describe('A11Y-081: dialog missing aria-modal', () => {
    it('flags role="dialog" without aria-modal', () => {
        const ast = parseJSX(`
            const C = () => (
                <div role="dialog" aria-label="Confirm delete">
                    <button>OK</button>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-081')).toBe(true)
    })

    it('flags role="alertdialog" without aria-modal', () => {
        const ast = parseJSX(`
            const C = () => <div role="alertdialog" aria-label="Warning">Content</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-081')).toBe(true)
    })

    it('passes role="dialog" with aria-modal="true"', () => {
        const ast = parseJSX(`
            const C = () => <div role="dialog" aria-modal="true" aria-label="x">Content</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-081')).toHaveLength(0)
    })

    it('fix adds aria-modal="true"', () => {
        const ast = parseJSX(`
            const C = () => <div role="dialog" aria-label="x">Content</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-081')!
        const rule = liveRegionsRules.find((r) => r.id === 'A11Y-081')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].args.propName).toBe('aria-modal')
        expect(fix!.mutations[0].args.value).toBe('true')
    })
})

// ── A11Y-082: unnecessary assertive live region ───────────────────────────────

describe('A11Y-082: unnecessary assertive live region', () => {
    it('flags aria-live="assertive" without role="alert"', () => {
        const ast = parseJSX(`
            const C = () => <div aria-live="assertive">Update happened</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-082')).toBe(true)
    })

    it('passes aria-live="assertive" with role="alert"', () => {
        const ast = parseJSX(`
            const C = () => <div role="alert" aria-live="assertive">Error</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-082')).toHaveLength(0)
    })

    it('passes aria-live="polite"', () => {
        const ast = parseJSX(`
            const C = () => <div aria-live="polite">Status update</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-082')).toHaveLength(0)
    })

    it('fix changes assertive to polite', () => {
        const ast = parseJSX(`
            const C = () => <div aria-live="assertive">Update</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-082')!
        const rule = liveRegionsRules.find((r) => r.id === 'A11Y-082')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].args.propName).toBe('aria-live')
        expect(fix!.mutations[0].args.value).toBe('polite')
    })
})

// ── A11Y-083: aria-live regions without aria-atomic ──────────────────────────

describe('A11Y-083: live region missing aria-atomic', () => {
    it('flags aria-live region without aria-atomic', () => {
        const ast = parseJSX(`
            const C = () => <div aria-live="polite">Score: 42</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-083')).toBe(true)
    })

    it('passes aria-live region with aria-atomic="true"', () => {
        const ast = parseJSX(`
            const C = () => <div aria-live="polite" aria-atomic="true">Score: 42</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-083')).toHaveLength(0)
    })

    it('passes role="alert" (implicit aria-atomic)', () => {
        const ast = parseJSX(`
            const C = () => <div role="alert">Error!</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-083')).toHaveLength(0)
    })

    it('passes aria-live="off"', () => {
        const ast = parseJSX(`
            const C = () => <div aria-live="off">Hidden</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-083')).toHaveLength(0)
    })

    it('fix adds aria-atomic="true"', () => {
        const ast = parseJSX(`
            const C = () => <div aria-live="polite">Score</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-083')!
        const rule = liveRegionsRules.find((r) => r.id === 'A11Y-083')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].args.propName).toBe('aria-atomic')
        expect(fix!.mutations[0].args.value).toBe('true')
    })
})

describe('live-regions rules — module shape', () => {
    it('exports exactly 4 rules', () => {
        expect(liveRegionsRules).toHaveLength(4)
    })

    it('all rules have required fields', () => {
        for (const rule of liveRegionsRules) {
            expect(rule.id).toMatch(/^A11Y-\d{3}$/)
            expect(rule.wcag).toBeTruthy()
            expect(rule.severity).toMatch(/^(critical|warning|info)$/)
        }
    })
})
