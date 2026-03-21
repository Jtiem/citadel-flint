/**
 * Tests for contrast rules (A11Y-060 through A11Y-062)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { contrastRules } from '../rules/contrast.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(contrastRules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-060: Normal text contrast >= 4.5:1 ──────────────────────────────────

describe('A11Y-060: normal text contrast', () => {
    it('flags low contrast text (< 4.5:1)', () => {
        // #777777 on #ffffff = ~4.48:1 (just fails)
        const ast = parseJSX(`
            const C = () => <p className="text-[#777777] bg-[#ffffff]">Hello</p>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-060')).toBe(true)
    })

    it('passes high contrast text (>= 4.5:1)', () => {
        // #000000 on #ffffff = 21:1
        const ast = parseJSX(`
            const C = () => <p className="text-[#000000] bg-[#ffffff]">Hello</p>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-060')).toHaveLength(0)
    })

    it('skips when foreground is not resolvable (no false positive)', () => {
        const ast = parseJSX(`
            const C = () => <p className="text-gray-500 bg-[#ffffff]">Hello</p>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-060')).toHaveLength(0)
    })

    it('skips when background is not resolvable (no false positive)', () => {
        const ast = parseJSX(`
            const C = () => <p className="text-[#777777]">Hello</p>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-060')).toHaveLength(0)
    })

    it('is not fixable', () => {
        const ast = parseJSX(`
            const C = () => <p className="text-[#777777] bg-[#ffffff]">Hello</p>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-060')
        if (v) expect(v.fixable).toBe(false)
    })
})

// ── A11Y-061: Large text contrast >= 3:1 ─────────────────────────────────────

describe('A11Y-061: large text contrast', () => {
    it('flags large text with low contrast (< 3:1)', () => {
        // #aaaaaa on #ffffff = ~2.32:1 (fails large text)
        const ast = parseJSX(`
            const C = () => <h1 className="text-[#aaaaaa] bg-[#ffffff] text-2xl">Heading</h1>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-061')).toBe(true)
    })

    it('passes large text with adequate contrast (>= 3:1)', () => {
        // #595959 on #ffffff has ratio > 7:1
        const ast = parseJSX(`
            const C = () => <h1 className="text-[#595959] bg-[#ffffff] text-2xl">Heading</h1>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-061')).toHaveLength(0)
    })

    it('skips non-large text (normal text handled by A11Y-060)', () => {
        // Small text: should not fire A11Y-061
        const ast = parseJSX(`
            const C = () => <p className="text-[#aaaaaa] bg-[#ffffff] text-base">Text</p>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-061')).toHaveLength(0)
    })

    it('skips when colors not statically resolvable (no false positive)', () => {
        const ast = parseJSX(`
            const C = () => <h1 className="text-gray-500 bg-white text-2xl">Heading</h1>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-061')).toHaveLength(0)
    })
})

// ── A11Y-062: UI component non-text contrast >= 3:1 ──────────────────────────

describe('A11Y-062: UI component contrast', () => {
    it('flags input with low border/background contrast', () => {
        // border-[#dddddd] bg-[#ffffff] = ~1.18:1 (fails 3:1)
        const ast = parseJSX(`
            const C = () => <input className="border-[#dddddd] bg-[#ffffff]" aria-label="x" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-062')).toBe(true)
    })

    it('passes input with sufficient border contrast', () => {
        // border-[#767676] bg-[#ffffff] = ~4.5:1 (passes 3:1)
        const ast = parseJSX(`
            const C = () => <input className="border-[#767676] bg-[#ffffff]" aria-label="x" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-062')).toHaveLength(0)
    })

    it('skips non-UI elements (e.g., div)', () => {
        const ast = parseJSX(`
            const C = () => <div className="border-[#dddddd] bg-[#ffffff]">content</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-062')).toHaveLength(0)
    })

    it('skips when border color not resolvable (no false positive)', () => {
        const ast = parseJSX(`
            const C = () => <input className="border-gray-200 bg-white" aria-label="x" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-062')).toHaveLength(0)
    })

    it('is not fixable', () => {
        const ast = parseJSX(`
            const C = () => <input className="border-[#dddddd] bg-[#ffffff]" aria-label="x" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-062')
        if (v) expect(v.fixable).toBe(false)
    })
})
