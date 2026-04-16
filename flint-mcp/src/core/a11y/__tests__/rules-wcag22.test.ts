/**
 * Tests for WCAG 2.2 New Criteria rules (A11Y-110 through A11Y-117)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { wcag22Rules } from '../rules/wcag22.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(wcag22Rules)
})

afterEach(() => {
    resetRules()
})

// ── A11Y-110: Dragging Movements Alternative ──────────────────────────────────

describe('A11Y-110: dragging movement without pointer alternative', () => {
    it('flags onDrop without onClick', () => {
        const ast = parseJSX(`
            const C = () => (
                <div onDrop={(e) => handleDrop(e)}>drop zone</div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-110')).toBe(true)
    })

    it('flags onDragStart without pointer alternative', () => {
        const ast = parseJSX(`
            const C = () => (
                <div onDragStart={() => {}}>draggable item</div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-110')).toBe(true)
    })

    it('passes when onDrop also has onClick', () => {
        const ast = parseJSX(`
            const C = () => (
                <div onDrop={handleDrop} onClick={handleClick}>drop zone</div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-110')).toHaveLength(0)
    })

    it('passes when onDragStart has onPointerDown alternative', () => {
        const ast = parseJSX(`
            const C = () => (
                <div onDragStart={start} onPointerDown={pointerStart}>item</div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-110')).toHaveLength(0)
    })

    it('passes elements with no drag handlers at all', () => {
        const ast = parseJSX(`
            const C = () => <div onClick={fn}>plain button</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-110')).toHaveLength(0)
    })

    it('is not fixable', () => {
        const ast = parseJSX(`const C = () => <div onDrop={fn}>drop</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-110')
        if (v) expect(v.fixable).toBe(false)
    })
})

// ── A11Y-111: Target Size Minimum ─────────────────────────────────────────────

describe('A11Y-111: touch target size below 24x24px', () => {
    it('flags button with Tailwind w-4 h-4 classes', () => {
        const ast = parseJSX(`
            const C = () => (
                <button className="w-4 h-4 bg-blue-500">X</button>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-111')).toBe(true)
    })

    it('flags button with inline style width 16px height 16px', () => {
        const ast = parseJSX(`
            const C = () => (
                <button style={{ width: '16px', height: '16px' }}>X</button>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-111')).toBe(true)
    })

    it('passes button with w-8 h-8 (32px)', () => {
        const ast = parseJSX(`
            const C = () => <button className="w-8 h-8">OK</button>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-111')).toHaveLength(0)
    })

    it('passes button with inline style 32px', () => {
        const ast = parseJSX(`
            const C = () => <button style={{ width: '32px', height: '32px' }}>OK</button>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-111')).toHaveLength(0)
    })

    it('does not flag non-interactive elements with small dimensions', () => {
        const ast = parseJSX(`
            const C = () => <div className="w-4 h-4 bg-red-500" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-111')).toHaveLength(0)
    })

    it('flags button with size-3 (12px equivalent)', () => {
        const ast = parseJSX(`
            const C = () => <button className="size-3">X</button>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-111')).toBe(true)
    })
})

// ── A11Y-112: Focus Not Obscured (Minimum) ────────────────────────────────────

describe('A11Y-112: fixed/sticky overlay may obscure focused element', () => {
    it('flags fixed element with z-index without aria-hidden', () => {
        const ast = parseJSX(`
            const C = () => (
                <div className="fixed z-50 top-0 left-0 w-full bg-white">header</div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-112')).toBe(true)
    })

    it('flags sticky element with z-index', () => {
        const ast = parseJSX(`
            const C = () => (
                <div className="sticky top-0 z-10">sticky bar</div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-112')).toBe(true)
    })

    it('passes fixed element with aria-hidden="true"', () => {
        const ast = parseJSX(`
            const C = () => (
                <div className="fixed z-50 top-0" aria-hidden="true">decorative</div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-112')).toHaveLength(0)
    })

    it('passes element with fixed but no z-index', () => {
        const ast = parseJSX(`
            const C = () => <div className="fixed top-0 left-0">no z-index</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-112')).toHaveLength(0)
    })

    it('passes element with z-index but no fixed/sticky', () => {
        const ast = parseJSX(`
            const C = () => <div className="z-10 relative">relative z</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-112')).toHaveLength(0)
    })
})

// ── A11Y-113: Focus Appearance ────────────────────────────────────────────────

describe('A11Y-113: outline removed from interactive element without replacement', () => {
    it('flags button with outline-none and no focus:ring', () => {
        const ast = parseJSX(`
            const C = () => (
                <button className="outline-none bg-blue-500 text-white">Submit</button>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-113')).toBe(true)
    })

    it('flags input with focus:outline-none and no replacement', () => {
        const ast = parseJSX(`
            const C = () => (
                <input className="border focus:outline-none" aria-label="Search" />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-113')).toBe(true)
    })

    it('passes button with outline-none AND focus:ring-2', () => {
        const ast = parseJSX(`
            const C = () => (
                <button className="outline-none focus:ring-2 focus:ring-blue-500">Submit</button>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-113')).toHaveLength(0)
    })

    it('passes button with outline-none AND focus-visible:ring', () => {
        const ast = parseJSX(`
            const C = () => (
                <button className="outline-none focus-visible:ring-2">Button</button>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-113')).toHaveLength(0)
    })

    it('does not flag non-interactive elements with outline-none', () => {
        const ast = parseJSX(`
            const C = () => <div className="outline-none">plain div</div>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-113')).toHaveLength(0)
    })

    it('flags link (<a>) with outline-none and no focus:ring', () => {
        const ast = parseJSX(`
            const C = () => <a href="/about" className="outline-none">About</a>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-113')).toBe(true)
    })
})

// ── A11Y-114: Redundant Entry ─────────────────────────────────────────────────

describe('A11Y-114: same-type inputs without autocomplete', () => {
    it('flags container with two type="email" inputs without autocomplete', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <input type="email" aria-label="Email" />
                    <input type="email" aria-label="Confirm Email" />
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-114')).toBe(true)
    })

    it('passes when both email inputs have autocomplete', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <input type="email" autoComplete="email" aria-label="Email" />
                    <input type="email" autoComplete="email" aria-label="Confirm Email" />
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-114')).toHaveLength(0)
    })

    it('passes when only one email input is present', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <input type="email" aria-label="Email" />
                    <input type="text" aria-label="Name" />
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-114')).toHaveLength(0)
    })

    it('flags two tel inputs without autocomplete', () => {
        const ast = parseJSX(`
            const C = () => (
                <form>
                    <input type="tel" aria-label="Phone" />
                    <input type="tel" aria-label="Alt Phone" />
                </form>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-114')).toBe(true)
    })
})

// ── A11Y-115: Accessible Authentication — autocomplete="off" ─────────────────

describe('A11Y-115: password with autocomplete="off"', () => {
    it('flags password input with autocomplete="off"', () => {
        const ast = parseJSX(`
            const C = () => (
                <input type="password" autoComplete="off" aria-label="Password" />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-115')).toBe(true)
    })

    it('passes password input with autoComplete="current-password"', () => {
        const ast = parseJSX(`
            const C = () => (
                <input type="password" autoComplete="current-password" aria-label="Password" />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-115')).toHaveLength(0)
    })

    it('passes password input with autoComplete="new-password"', () => {
        const ast = parseJSX(`
            const C = () => (
                <input type="password" autoComplete="new-password" aria-label="New Password" />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-115')).toHaveLength(0)
    })

    it('does not flag text inputs with autocomplete="off"', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" autoComplete="off" aria-label="One-time code" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-115')).toHaveLength(0)
    })

    it('fix changes autocomplete to current-password', () => {
        const ast = parseJSX(`const C = () => <input type="password" autoComplete="off" aria-label="Password" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-115')!
        const rule = wcag22Rules.find((r) => r.id === 'A11Y-115')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'autoComplete', value: 'current-password' },
        })
    })

    it('does not flag password without autocomplete (handled by A11Y-117)', () => {
        const ast = parseJSX(`
            const C = () => <input type="password" aria-label="Password" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        // A11Y-115 only flags when autocomplete="off" is explicitly set
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-115')).toHaveLength(0)
    })
})

// ── A11Y-116: Focus Not Obscured (Enhanced) — advisory ───────────────────────

describe('A11Y-116: fixed/sticky element may partially obscure focused element (advisory)', () => {
    it('flags fixed element with z-index (advisory companion to A11Y-112)', () => {
        const ast = parseJSX(`
            const C = () => (
                <header className="fixed top-0 z-20 w-full bg-white shadow">Header</header>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-116')).toBe(true)
    })

    it('passes element with aria-hidden="true"', () => {
        const ast = parseJSX(`
            const C = () => (
                <div className="sticky z-30 top-0" aria-hidden="true">overlay</div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-116')).toHaveLength(0)
    })

    it('violation has warning severity (advisory)', () => {
        const ast = parseJSX(`const C = () => <nav className="sticky z-10 top-0">nav</nav>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-116')
        if (v) expect(v.severity).toBe('warning')
    })
})

// ── A11Y-117: Accessible Authentication (Enhanced) ───────────────────────────

describe('A11Y-117: password input requires credential autocomplete', () => {
    it('flags password input without autocomplete', () => {
        const ast = parseJSX(`
            const C = () => <input type="password" aria-label="Password" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-117')).toBe(true)
    })

    it('flags password input with non-credential autocomplete value', () => {
        const ast = parseJSX(`
            const C = () => <input type="password" autoComplete="on" aria-label="Password" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'A11Y-117')).toBe(true)
    })

    it('passes password with autoComplete="current-password"', () => {
        const ast = parseJSX(`
            const C = () => <input type="password" autoComplete="current-password" aria-label="Password" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-117')).toHaveLength(0)
    })

    it('passes password with autoComplete="new-password"', () => {
        const ast = parseJSX(`
            const C = () => <input type="password" autoComplete="new-password" aria-label="New Password" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-117')).toHaveLength(0)
    })

    it('does not flag non-password inputs', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" aria-label="Username" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-117')).toHaveLength(0)
    })

    it('fix sets autoComplete to current-password', () => {
        const ast = parseJSX(`const C = () => <input type="password" aria-label="Password" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'A11Y-117')!
        const rule = wcag22Rules.find((r) => r.id === 'A11Y-117')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'autoComplete', value: 'current-password' },
        })
    })

    it('skips dynamic autocomplete values (no false positive)', () => {
        const ast = parseJSX(`const C = ({ ac }) => <input type="password" autoComplete={ac} aria-label="Password" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-117')).toHaveLength(0)
    })
})
