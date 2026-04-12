/**
 * Tests for P1b — A11y Behavioral Anti-Pattern Detection
 *
 * A11Y-100: Interactive handler on non-interactive element (keyboard.ts)
 * A11Y-101: Dialog/modal missing role or aria-modal (structure.ts)
 * A11Y-102: Navigation component missing nav landmark (structure.ts)
 * A11Y-103: Form component missing form element (structure.ts)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parse } from '@babel/parser'
import { auditSync, registerRules, resetRules } from '../runner.js'
import { keyboardRules } from '../rules/keyboard.js'
import { structureRules } from '../rules/structure.js'

function parseJSX(code: string) {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
}

beforeEach(() => {
    resetRules()
    registerRules([...keyboardRules, ...structureRules])
})

afterEach(() => {
    resetRules()
})

// ── A11Y-100: Interactive handler on non-interactive element ─────────────────

describe('A11Y-100: Interactive handler on non-interactive element', () => {
    it('flags div with onClick and no role', () => {
        const ast = parseJSX(`const C = () => <div onClick={() => {}}>click me</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const violations = result.violations.filter((v) => v.ruleId === 'A11Y-100')
        expect(violations).toHaveLength(1)
        expect(violations[0].fixable).toBe(true)
        expect(violations[0].message).toContain('onClick')
    })

    it('does not flag div with onClick and role="button"', () => {
        const ast = parseJSX(`const C = () => <div onClick={() => {}} role="button">click</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-100')).toHaveLength(0)
    })

    it('does not flag div with onClick and tabIndex', () => {
        const ast = parseJSX(`const C = () => <div onClick={() => {}} tabIndex={0}>click</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-100')).toHaveLength(0)
    })

    it('flags span with onMouseDown and no role', () => {
        const ast = parseJSX(`const C = () => <span onMouseDown={() => {}}>drag me</span>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const violations = result.violations.filter((v) => v.ruleId === 'A11Y-100')
        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain('onMouseDown')
    })

    it('does not flag button with onClick (natively interactive)', () => {
        const ast = parseJSX(`const C = () => <button onClick={() => {}}>click</button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-100')).toHaveLength(0)
    })

    it('does not flag non-interactive element with no handlers', () => {
        const ast = parseJSX(`const C = () => <div className="box">just content</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-100')).toHaveLength(0)
    })

    it('does not flag div with onClick and role="link"', () => {
        const ast = parseJSX(`const C = () => <div onClick={() => {}} role="link">link</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-100')).toHaveLength(0)
    })

    it('does not flag div with onClick and role="tab"', () => {
        const ast = parseJSX(`const C = () => <div onClick={() => {}} role="tab">tab</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-100')).toHaveLength(0)
    })

    it('does not flag input with onClick (natively interactive)', () => {
        const ast = parseJSX(`const C = () => <input onClick={() => {}} />`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-100')).toHaveLength(0)
    })

    it('flags section with onKeyDown and no role', () => {
        const ast = parseJSX(`const C = () => <section onKeyDown={() => {}}>content</section>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const violations = result.violations.filter((v) => v.ruleId === 'A11Y-100')
        expect(violations).toHaveLength(1)
    })

    it('auto-fix adds role="button" and tabIndex="0"', () => {
        const ast = parseJSX(`const C = () => <div onClick={() => {}}>click</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const violation = result.violations.find((v) => v.ruleId === 'A11Y-100')!
        const rule = keyboardRules.find((r) => r.id === 'A11Y-100')!
        const fix = rule.fix!(violation, ast as any)
        expect(fix).not.toBeNull()
        expect(fix!.mutations).toHaveLength(2)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'role', value: 'button' },
        })
        expect(fix!.mutations[1]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'tabIndex', value: '0' },
        })
    })

    it('does not flag div with tabIndex={-1} and onClick', () => {
        const ast = parseJSX(`const C = () => <div onClick={() => {}} tabIndex={-1}>click</div>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-100')).toHaveLength(0)
    })
})

// ── A11Y-101: Dialog/modal missing aria-modal or role="dialog" ──────────────

describe('A11Y-101: Dialog component missing accessibility attributes', () => {
    it('flags component classified as dialog without aria-modal or role', () => {
        const ast = parseJSX(`const C = () => <Modal><p>Content</p></Modal>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const violations = result.violations.filter((v) => v.ruleId === 'A11Y-101')
        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain('Modal')
        expect(violations[0].fixable).toBe(true)
    })

    it('does not flag dialog with aria-modal="true"', () => {
        const ast = parseJSX(`const C = () => <Modal aria-modal="true"><p>Content</p></Modal>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-101')).toHaveLength(0)
    })

    it('does not flag dialog with role="dialog"', () => {
        const ast = parseJSX(`const C = () => <Modal role="dialog"><p>Content</p></Modal>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-101')).toHaveLength(0)
    })

    it('does not flag dialog with role="alertdialog"', () => {
        const ast = parseJSX(`const C = () => <Modal role="alertdialog"><p>Content</p></Modal>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-101')).toHaveLength(0)
    })

    it('does not flag native <dialog> element', () => {
        const ast = parseJSX(`const C = () => <dialog><p>Content</p></dialog>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-101')).toHaveLength(0)
    })

    it('flags Dialog component by name', () => {
        const ast = parseJSX(`const C = () => <Dialog><p>Content</p></Dialog>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-101')).toHaveLength(1)
    })

    it('auto-fix adds role="dialog" and aria-modal="true"', () => {
        const ast = parseJSX(`const C = () => <Modal><p>Content</p></Modal>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const violation = result.violations.find((v) => v.ruleId === 'A11Y-101')!
        const rule = structureRules.find((r) => r.id === 'A11Y-101')!
        const fix = rule.fix!(violation, ast as any)
        expect(fix).not.toBeNull()
        expect(fix!.mutations).toHaveLength(2)
        expect(fix!.mutations[0]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'role', value: 'dialog' },
        })
        expect(fix!.mutations[1]).toMatchObject({
            type: 'updateProp',
            args: { propName: 'aria-modal', value: 'true' },
        })
    })
})

// ── A11Y-102: Navigation component missing nav landmark ─────────────────────

describe('A11Y-102: Navigation component missing nav landmark', () => {
    it('flags navigation component without role="navigation"', () => {
        const ast = parseJSX(`const C = () => <Navigation><a href="/">Home</a></Navigation>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const violations = result.violations.filter((v) => v.ruleId === 'A11Y-102')
        expect(violations).toHaveLength(1)
        expect(violations[0].fixable).toBe(true)
    })

    it('does not flag <nav> element (has implicit navigation role)', () => {
        const ast = parseJSX(`const C = () => <nav><a href="/">Home</a></nav>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-102')).toHaveLength(0)
    })

    it('does not flag navigation component with role="navigation"', () => {
        const ast = parseJSX(`const C = () => <Navbar role="navigation"><a href="/">Home</a></Navbar>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-102')).toHaveLength(0)
    })

    it('flags Navbar component without role', () => {
        const ast = parseJSX(`const C = () => <Navbar><a href="/">Home</a></Navbar>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-102')).toHaveLength(1)
    })
})

// ── A11Y-103: Form component missing form element ───────────────────────────

describe('A11Y-103: Form component missing form landmark', () => {
    it('flags form component without <form> or role="form"', () => {
        const ast = parseJSX(`const C = () => <FormContainer><input /></FormContainer>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        const violations = result.violations.filter((v) => v.ruleId === 'A11Y-103')
        expect(violations).toHaveLength(1)
        expect(violations[0].fixable).toBe(true)
    })

    it('does not flag native <form> element', () => {
        const ast = parseJSX(`const C = () => <form><input /></form>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-103')).toHaveLength(0)
    })

    it('does not flag form component with role="form"', () => {
        const ast = parseJSX(`const C = () => <FormContainer role="form"><input /></FormContainer>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-103')).toHaveLength(0)
    })

    it('does not flag component not classified as form', () => {
        const ast = parseJSX(`const C = () => <Button onClick={() => {}}>Submit</Button>`)
        const result = auditSync(ast as any, { filePath: 'test.tsx' })
        expect(result.violations.filter((v) => v.ruleId === 'A11Y-103')).toHaveLength(0)
    })
})
