/**
 * Tests for motion rules (EXP.6a-ext)
 *
 * A11Y-090: Animations without reduced-motion guard
 * A11Y-091: Video missing controls
 * A11Y-092: Audio missing controls
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { motionRules } from '../rules/motion.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(motionRules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-090: animate-* without motion-safe/reduce guard ─────────────────────

describe('A11Y-090: animation without reduced-motion guard', () => {
    it('flags animate-spin without motion guard', () => {
        const ast = parseJSX(`
            const C = () => <div className="animate-spin text-white">Loading</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-090')).toBe(true)
    })

    it('passes animate-spin with motion-safe guard', () => {
        const ast = parseJSX(`
            const C = () => <div className="motion-safe:animate-spin text-white">Loading</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-090')).toHaveLength(0)
    })

    it('passes animate-spin with motion-reduce variant present', () => {
        const ast = parseJSX(`
            const C = () => <div className="animate-spin motion-reduce:animate-none">Loading</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-090')).toHaveLength(0)
    })

    it('passes element with no animation classes', () => {
        const ast = parseJSX(`
            const C = () => <div className="flex items-center gap-2">Content</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-090')).toHaveLength(0)
    })
})

// ── A11Y-091: <video> must have controls ─────────────────────────────────────

describe('A11Y-091: video missing controls', () => {
    it('flags video without controls', () => {
        const ast = parseJSX(`
            const C = () => <video src="clip.mp4" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-091')).toBe(true)
    })

    it('passes video with controls', () => {
        const ast = parseJSX(`
            const C = () => <video src="clip.mp4" controls />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-091')).toHaveLength(0)
    })

    it('passes muted+autoPlay decorative video without controls', () => {
        const ast = parseJSX(`
            const C = () => <video src="bg.mp4" muted autoPlay loop />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-091')).toHaveLength(0)
    })

    it('fix adds controls attribute', () => {
        const ast = parseJSX(`
            const C = () => <video src="clip.mp4" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-091')!
        const rule = motionRules.find((r) => r.id === 'A11Y-091')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].args.propName).toBe('controls')
    })
})

// ── A11Y-092: <audio> must have controls ─────────────────────────────────────

describe('A11Y-092: audio missing controls', () => {
    it('flags audio without controls', () => {
        const ast = parseJSX(`
            const C = () => <audio src="track.mp3" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-092')).toBe(true)
    })

    it('passes audio with controls', () => {
        const ast = parseJSX(`
            const C = () => <audio src="track.mp3" controls />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-092')).toHaveLength(0)
    })

    it('fix adds controls attribute', () => {
        const ast = parseJSX(`
            const C = () => <audio src="track.mp3" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-092')!
        const rule = motionRules.find((r) => r.id === 'A11Y-092')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].args.propName).toBe('controls')
    })
})

describe('motion rules — module shape', () => {
    it('exports exactly 3 rules', () => {
        expect(motionRules).toHaveLength(3)
    })

    it('all rules have required fields', () => {
        for (const rule of motionRules) {
            expect(rule.id).toMatch(/^A11Y-\d{3}$/)
            expect(rule.wcag).toBeTruthy()
            expect(rule.severity).toMatch(/^(critical|warning|info)$/)
        }
    })
})
