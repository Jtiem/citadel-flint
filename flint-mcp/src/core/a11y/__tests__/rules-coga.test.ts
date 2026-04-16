/**
 * Tests for COGA Cognitive Accessibility rules (COGA-001 through COGA-008)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { cogaRules } from '../rules/coga.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules(cogaRules)
})

afterEach(() => {
    resetRules()
})

// ── COGA-001: Visible Label Required ─────────────────────────────────────────

describe('COGA-001: visible label required on form controls', () => {
    it('flags input without aria-label or id', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" placeholder="Enter name" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-001')).toBe(true)
    })

    it('flags textarea without aria-label', () => {
        const ast = parseJSX(`
            const C = () => <textarea placeholder="Write something..." />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-001')).toBe(true)
    })

    it('flags select without aria-label', () => {
        const ast = parseJSX(`
            const C = () => (
                <select>
                    <option>Option A</option>
                </select>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-001')).toBe(true)
    })

    it('passes input with aria-label', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" aria-label="Full Name" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-001')).toHaveLength(0)
    })

    it('passes input with aria-labelledby', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" aria-labelledby="name-label" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-001')).toHaveLength(0)
    })

    it('passes input with id (assumes external label)', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" id="name-field" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-001')).toHaveLength(0)
    })

    it('does not flag input type="hidden"', () => {
        const ast = parseJSX(`
            const C = () => <input type="hidden" name="csrf" value="token" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-001')).toHaveLength(0)
    })
})

// ── COGA-002: Timeout Warning ─────────────────────────────────────────────────

describe('COGA-002: session timeout without warning dialog', () => {
    it('flags role="alert" zone with session text and no dialog child', () => {
        const ast = parseJSX(`
            const C = () => (
                <div role="alert">
                    <p>Your session will expire soon.</p>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-002')).toBe(true)
    })

    it('passes when alert zone has alertdialog child', () => {
        const ast = parseJSX(`
            const C = () => (
                <div role="alert">
                    <div role="alertdialog" aria-label="Session expiring">
                        <p>Your session will expire. Extend?</p>
                        <button>Extend Session</button>
                    </div>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-002')).toHaveLength(0)
    })

    it('passes element without role="alert" even with session text', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <p>Your session will expire soon.</p>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-002')).toHaveLength(0)
    })

    it('passes role="status" with logout text and dialog child', () => {
        const ast = parseJSX(`
            const C = () => (
                <div role="status">
                    <div role="dialog">
                        <p>You will be logged out in 30 seconds.</p>
                        <button>Stay logged in</button>
                    </div>
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-002')).toHaveLength(0)
    })
})

// ── COGA-003: Form Complexity ─────────────────────────────────────────────────

describe('COGA-003: form with too many ungrouped fields', () => {
    it('flags form with 8 ungrouped inputs and no fieldset', () => {
        const ast = parseJSX(`
            const C = () => (
                <form>
                    <input type="text" aria-label="First Name" />
                    <input type="text" aria-label="Last Name" />
                    <input type="email" aria-label="Email" />
                    <input type="tel" aria-label="Phone" />
                    <input type="text" aria-label="Address" />
                    <input type="text" aria-label="City" />
                    <input type="text" aria-label="State" />
                    <input type="text" aria-label="Zip" />
                </form>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-003')).toBe(true)
    })

    it('passes form with 7 or fewer inputs', () => {
        const ast = parseJSX(`
            const C = () => (
                <form>
                    <input type="text" aria-label="First Name" />
                    <input type="text" aria-label="Last Name" />
                    <input type="email" aria-label="Email" />
                    <input type="tel" aria-label="Phone" />
                    <input type="text" aria-label="Address" />
                    <input type="text" aria-label="City" />
                    <input type="text" aria-label="State" />
                </form>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-003')).toHaveLength(0)
    })

    it('passes form with 8+ inputs when a fieldset is present', () => {
        const ast = parseJSX(`
            const C = () => (
                <form>
                    <fieldset>
                        <legend>Personal Info</legend>
                        <input type="text" aria-label="First Name" />
                        <input type="text" aria-label="Last Name" />
                        <input type="email" aria-label="Email" />
                    </fieldset>
                    <input type="tel" aria-label="Phone" />
                    <input type="text" aria-label="Address" />
                    <input type="text" aria-label="City" />
                    <input type="text" aria-label="State" />
                    <input type="text" aria-label="Zip" />
                </form>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-003')).toHaveLength(0)
    })

    it('does not flag non-form elements with many inputs', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <input aria-label="1" /><input aria-label="2" /><input aria-label="3" />
                    <input aria-label="4" /><input aria-label="5" /><input aria-label="6" />
                    <input aria-label="7" /><input aria-label="8" />
                </div>
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-003')).toHaveLength(0)
    })
})

// ── COGA-004: Clear Error Identification ─────────────────────────────────────

describe('COGA-004: error state by color only without aria-invalid', () => {
    it('flags input with border-red class but no aria-invalid', () => {
        const ast = parseJSX(`
            const C = () => (
                <input className="border-red-500" aria-label="Email" />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-004')).toBe(true)
    })

    it('flags input with text-red class but no aria-invalid', () => {
        const ast = parseJSX(`
            const C = () => (
                <input className="text-red-600 border" aria-label="Username" />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-004')).toBe(true)
    })

    it('passes input with border-red AND aria-invalid="true"', () => {
        const ast = parseJSX(`
            const C = () => (
                <input
                    className="border-red-500"
                    aria-invalid="true"
                    aria-describedby="email-error"
                    aria-label="Email"
                />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-004')).toHaveLength(0)
    })

    it('passes input with no error classes', () => {
        const ast = parseJSX(`
            const C = () => <input className="border-gray-300" aria-label="Email" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-004')).toHaveLength(0)
    })

    it('fix adds aria-invalid="true"', () => {
        const ast = parseJSX(`const C = () => <input className="border-red-500" aria-label="x" />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const v = result.violations.find((v) => v.ruleId === 'COGA-004')!
        const rule = cogaRules.find((r) => r.id === 'COGA-004')!
        const fix = rule.fix!(v, ast as any)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'aria-invalid', value: 'true' },
        })
    })

    it('does not flag elements with dynamic aria-invalid (no false positive)', () => {
        const ast = parseJSX(`
            const C = ({ isErr }) => (
                <input className="border-red-500" aria-invalid={isErr} aria-label="x" />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-004')).toHaveLength(0)
    })
})

// ── COGA-005: Help Link Consistency ──────────────────────────────────────────

describe('COGA-005: help link missing aria-label', () => {
    it('flags help link without aria-label', () => {
        const ast = parseJSX(`
            const C = () => <a href="/help">Help</a>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-005')).toBe(true)
    })

    it('flags support link without aria-label', () => {
        const ast = parseJSX(`
            const C = () => <a href="/support/faq">Get Help</a>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-005')).toBe(true)
    })

    it('passes help link with aria-label', () => {
        const ast = parseJSX(`
            const C = () => <a href="/help" aria-label="Help and support">Help</a>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-005')).toHaveLength(0)
    })

    it('passes non-help links without aria-label', () => {
        const ast = parseJSX(`
            const C = () => <a href="/about">About Us</a>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-005')).toHaveLength(0)
    })

    it('passes help link with aria-labelledby', () => {
        const ast = parseJSX(`
            const C = () => <a href="/help" aria-labelledby="help-label">Help</a>
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-005')).toHaveLength(0)
    })
})

// ── COGA-006: Redundant Entry ─────────────────────────────────────────────────

describe('COGA-006: personal data field without autocomplete', () => {
    it('flags input with name="email" and no autocomplete', () => {
        const ast = parseJSX(`
            const C = () => <input type="email" name="email" aria-label="Email" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-006')).toBe(true)
    })

    it('flags input with id="phone" and no autocomplete', () => {
        const ast = parseJSX(`
            const C = () => <input type="tel" id="phone" aria-label="Phone" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-006')).toBe(true)
    })

    it('passes input with name="email" and autocomplete', () => {
        const ast = parseJSX(`
            const C = () => <input type="email" name="email" autoComplete="email" aria-label="Email" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-006')).toHaveLength(0)
    })

    it('does not flag input with unrelated name', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" name="promo-code" aria-label="Promo Code" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-006')).toHaveLength(0)
    })

    it('does not flag submit inputs', () => {
        const ast = parseJSX(`
            const C = () => <input type="submit" name="name" value="Submit" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-006')).toHaveLength(0)
    })
})

// ── COGA-007: Plain Language ──────────────────────────────────────────────────

describe('COGA-007: placeholder text too long', () => {
    it('flags input with placeholder longer than 60 characters', () => {
        const ast = parseJSX(`
            const C = () => (
                <input
                    type="text"
                    placeholder="Enter your full legal name as it appears on your government-issued ID"
                    aria-label="Legal Name"
                />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-007')).toBe(true)
    })

    it('passes input with short placeholder', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" placeholder="Enter your name" aria-label="Name" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-007')).toHaveLength(0)
    })

    it('passes input with exactly 60 character placeholder', () => {
        const placeholder = 'A'.repeat(60)
        const ast = parseJSX(`
            const C = () => <input placeholder="${placeholder}" aria-label="Test" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-007')).toHaveLength(0)
    })

    it('flags textarea with long placeholder', () => {
        const ast = parseJSX(`
            const C = () => (
                <textarea
                    placeholder="Please provide a detailed description of your issue including all relevant information, error messages, and steps to reproduce"
                    aria-label="Description"
                />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-007')).toBe(true)
    })

    it('passes input without any placeholder', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" aria-label="Name" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-007')).toHaveLength(0)
    })
})

// ── COGA-008: Input Purpose Autocomplete ─────────────────────────────────────

describe('COGA-008: personal data input without autocomplete (normative)', () => {
    it('flags input with name matching personal data pattern and no autocomplete', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" name="fullname" aria-label="Full Name" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-008')).toBe(true)
    })

    it('flags input with id="email" and no autocomplete', () => {
        const ast = parseJSX(`
            const C = () => <input type="email" id="email" aria-label="Email Address" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.some((v) => v.ruleId === 'COGA-008')).toBe(true)
    })

    it('passes input with personal data field and autocomplete set', () => {
        const ast = parseJSX(`
            const C = () => (
                <input type="text" name="name" autoComplete="name" aria-label="Name" />
            )
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-008')).toHaveLength(0)
    })

    it('does not flag checkbox inputs even with matching name', () => {
        const ast = parseJSX(`
            const C = () => <input type="checkbox" name="email-opt-in" aria-label="Subscribe" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-008')).toHaveLength(0)
    })

    it('does not flag hidden inputs with personal data name', () => {
        const ast = parseJSX(`
            const C = () => <input type="hidden" name="email" value="user@example.com" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-008')).toHaveLength(0)
    })

    it('does not flag inputs with unrelated names', () => {
        const ast = parseJSX(`
            const C = () => <input type="text" name="promo-code" aria-label="Promo Code" />
        `)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'COGA-008')).toHaveLength(0)
    })
})
