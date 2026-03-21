/**
 * Tests for names-labels rules (A11Y-001 through A11Y-014)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { namesLabelsRules } from '../rules/names-labels.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(namesLabelsRules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-001: img must have alt ───────────────────────────────────────────────

describe('A11Y-001: img must have alt', () => {
    it('flags violation when alt is missing', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-001')).toBe(true)
    })

    it('passes when alt is present (even empty)', () => {
        const ast = parseJSX(`const C = () => <img src="x" alt="" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-001')).toHaveLength(0)
    })

    it('passes when alt has description', () => {
        const ast = parseJSX(`const C = () => <img src="x" alt="A cat" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-001')).toHaveLength(0)
    })

    it('auto-fix produces alt="" mutation', () => {
        const ast = parseJSX(`const C = () => <img src="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-001')!
        const rule = namesLabelsRules.find((r) => r.id === 'A11Y-001')!
        const fix = rule.fix!(v, ast as any)
        expect(fix).not.toBeNull()
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'alt', value: '' },
        })
    })

    it('auto-fix on compliant img returns no violations', () => {
        const ast = parseJSX(`const C = () => <img src="x" alt="desc" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.filter((v) => v.ruleId === 'A11Y-001')
        expect(v).toHaveLength(0)
    })

    it('handles dynamic alt conservatively (no false positive)', () => {
        const ast = parseJSX(`const C = ({ alt }) => <img src="x" alt={alt} />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        // alt attribute IS present (dynamic), so should pass A11Y-001
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-001')).toHaveLength(0)
    })
})

// ── A11Y-002: button must have accessible name ────────────────────────────────

describe('A11Y-002: button accessible name', () => {
    it('flags violation on empty button', () => {
        const ast = parseJSX(`const C = () => <button />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-002')).toBe(true)
    })

    it('passes with text content', () => {
        const ast = parseJSX(`const C = () => <button>Click me</button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-002')).toHaveLength(0)
    })

    it('passes with aria-label', () => {
        const ast = parseJSX(`const C = () => <button aria-label="Close" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-002')).toHaveLength(0)
    })

    it('auto-fix adds aria-label placeholder', () => {
        const ast = parseJSX(`const C = () => <button />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-002')!
        const rule = namesLabelsRules.find((r) => r.id === 'A11Y-002')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'aria-label', value: '[NEEDS LABEL]' },
        })
    })

    it('handles dynamic aria-label (no false positive)', () => {
        const ast = parseJSX(`const C = ({ label }) => <button aria-label={label} />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-002')).toHaveLength(0)
    })
})

// ── A11Y-003: a must have accessible name ─────────────────────────────────────

describe('A11Y-003: link accessible name', () => {
    it('flags violation on empty anchor', () => {
        const ast = parseJSX(`const C = () => <a href="/x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-003')).toBe(true)
    })

    it('passes with text content', () => {
        const ast = parseJSX(`const C = () => <a href="/x">Home</a>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-003')).toHaveLength(0)
    })

    it('passes with aria-label', () => {
        const ast = parseJSX(`const C = () => <a href="/x" aria-label="Go home" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-003')).toHaveLength(0)
    })
})

// ── A11Y-011: img alt must not be filename ────────────────────────────────────

describe('A11Y-011: img alt must not be filename', () => {
    it('flags violation when alt looks like a filename', () => {
        const ast = parseJSX(`const C = () => <img src="x" alt="photo.jpg" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-011')).toBe(true)
    })

    it('passes with descriptive alt', () => {
        const ast = parseJSX(`const C = () => <img src="x" alt="A dog in a park" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-011')).toHaveLength(0)
    })

    it('passes with empty alt (decorative)', () => {
        const ast = parseJSX(`const C = () => <img src="x" alt="" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-011')).toHaveLength(0)
    })

    it('auto-fix replaces filename alt with empty string', () => {
        const ast = parseJSX(`const C = () => <img src="x" alt="logo.png" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-011')!
        const rule = namesLabelsRules.find((r) => r.id === 'A11Y-011')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'alt', value: '' },
        })
    })

    it('flags .png, .jpg, .gif, .svg, .webp', () => {
        for (const ext of ['image.png', 'photo.jpg', 'animation.gif', 'icon.svg', 'picture.webp']) {
            const ast = parseJSX(`const C = () => <img src="x" alt="${ext}" />`)
            const result = auditSync(ast as any, { filePath: 'test.tsx' })
            expect(result.violations.some((v) => v.ruleId === 'A11Y-011')).toBe(true)
        }
    })
})

// ── A11Y-012: svg must have accessible name ───────────────────────────────────

describe('A11Y-012: svg accessible name', () => {
    it('flags violation on plain svg without aria-label or title', () => {
        const ast = parseJSX(`const C = () => <svg><path d="M0 0" /></svg>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-012')).toBe(true)
    })

    it('passes with aria-hidden="true" (decorative)', () => {
        const ast = parseJSX(`const C = () => <svg aria-hidden="true"><path d="M0 0" /></svg>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-012')).toHaveLength(0)
    })

    it('passes with aria-label', () => {
        const ast = parseJSX(`const C = () => <svg aria-label="Close icon"><path d="M0 0" /></svg>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-012')).toHaveLength(0)
    })

    it('passes with <title> child', () => {
        const ast = parseJSX(`const C = () => <svg><title>Close icon</title><path d="M0 0" /></svg>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-012')).toHaveLength(0)
    })

    it('auto-fix adds aria-hidden="true"', () => {
        const ast = parseJSX(`const C = () => <svg><path d="M0 0" /></svg>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-012')!
        const rule = namesLabelsRules.find((r) => r.id === 'A11Y-012')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'aria-hidden', value: 'true' },
        })
    })
})

// ── A11Y-014: generic link text ───────────────────────────────────────────────

describe('A11Y-014: generic link text', () => {
    it('flags "click here" text', () => {
        const ast = parseJSX(`const C = () => <a href="#">click here</a>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-014')).toBe(true)
    })

    it('flags "read more" text', () => {
        const ast = parseJSX(`const C = () => <a href="#">read more</a>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-014')).toBe(true)
    })

    it('passes with descriptive link text', () => {
        const ast = parseJSX(`const C = () => <a href="#">View documentation</a>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-014')).toHaveLength(0)
    })

    it('passes when aria-label overrides generic text', () => {
        const ast = parseJSX(`const C = () => <a href="#" aria-label="View product details">read more</a>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-014')).toHaveLength(0)
    })

    it('is not fixable (fixable: false)', () => {
        const ast = parseJSX(`const C = () => <a href="#">click here</a>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-014')
        if (v) expect(v.fixable).toBe(false)
    })
})

// ── A11Y-018: <iframe> must have title ────────────────────────────────────────

describe('A11Y-018: iframe must have title', () => {
    it('flags iframe without title', () => {
        const ast = parseJSX(`
            const C = () => <iframe src="https://example.com" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-018')).toBe(true)
    })

    it('passes iframe with title', () => {
        const ast = parseJSX(`
            const C = () => <iframe src="https://example.com" title="Embedded map" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-018')).toHaveLength(0)
    })

    it('passes iframe with dynamic title', () => {
        const ast = parseJSX(`
            const C = ({ t }) => <iframe src="x" title={t} />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-018')).toHaveLength(0)
    })

    it('fix adds placeholder title', () => {
        const ast = parseJSX(`const C = () => <iframe src="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-018')!
        const rule = namesLabelsRules.find((r) => r.id === 'A11Y-018')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0].args.propName).toBe('title')
        expect(fix!.mutations[0].args.value).toBeTruthy()
    })
})
