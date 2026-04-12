/**
 * Rogue Intrinsic Detection — MITHRIL-REG-001
 * flint-mcp/src/core/__tests__/rogueIntrinsic.test.ts
 *
 * P2: Design System Adoption Enforcement
 *
 * Tests:
 *   1.  <button> with Button in registry → flags MITHRIL-REG-001
 *   2.  <Button> (already component) → no flag
 *   3.  <button> with no registry → no flag (visitor skips)
 *   4.  <input> with Input in registry → flags with prop hints
 *   5.  <div> (not a mapped intrinsic) → no flag
 *   6.  <select> with Select in registry → flags
 *   7.  Policy set to 'off' → no violations
 *   8.  Multiple intrinsics in one component → multiple violations
 *   9.  Registry entry with import path → included in message
 *   10. Intrinsic with no registry match → no flag
 *   11. <a> with Link in registry → flags with href prop hint
 *   12. Policy set to 'advisory' → severity is 'advisory'
 *   13. auditAll integrates rogue intrinsic warnings
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import { visitRogueIntrinsics, auditAll } from '../MithrilLinter.js'
import type { ComponentEntry } from '../registryService.js'

function parseJSX(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as File
}

// ── Sample registry entries ────────────────────────────────────────────────────

const BUTTON_ENTRY: ComponentEntry = {
    name: 'Button',
    importPath: '@/components/ui/button',
    props: {
        isDisabled: { type: 'boolean', required: false, default: 'false' },
        variant: { type: 'string', required: false },
    },
}

const INPUT_ENTRY: ComponentEntry = {
    name: 'Input',
    importPath: '@/components/ui/input',
    props: {
        isDisabled: { type: 'boolean', required: false },
        placeholder: { type: 'string', required: false },
    },
}

const SELECT_ENTRY: ComponentEntry = {
    name: 'Select',
    importPath: '@/components/ui/select',
    props: {
        isDisabled: { type: 'boolean', required: false },
    },
}

const LINK_ENTRY: ComponentEntry = {
    name: 'Link',
    importPath: '@/components/ui/link',
    props: {
        href: { type: 'string', required: true },
    },
}

const DIALOG_ENTRY: ComponentEntry = {
    name: 'Dialog',
    importPath: '@/components/ui/dialog',
}

const TEXTAREA_ENTRY: ComponentEntry = {
    name: 'Textarea',
    importPath: '@/components/ui/textarea',
}

const FULL_REGISTRY: ComponentEntry[] = [
    BUTTON_ENTRY,
    INPUT_ENTRY,
    SELECT_ENTRY,
    LINK_ENTRY,
    DIALOG_ENTRY,
    TEXTAREA_ENTRY,
]

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('visitRogueIntrinsics (MITHRIL-REG-001)', () => {
    it('1. <button> with Button in registry → flags MITHRIL-REG-001', () => {
        const ast = parseJSX(`
            export function App() {
                return <button data-flint-id="n1" className="bg-blue-500 px-4 py-2">Submit</button>
            }
        `)

        const warnings = visitRogueIntrinsics(ast, [BUTTON_ENTRY])

        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.ruleId).toBe('MITHRIL-REG-001')
        expect(w.type).toBe('registry')
        expect(w.message).toContain('<Button>')
        expect(w.message).toContain('instead of <button>')
        expect(w.severity).toBe('amber')
    })

    it('2. <Button> (already component) → no flag', () => {
        const ast = parseJSX(`
            export function App() {
                return <Button data-flint-id="n1">Submit</Button>
            }
        `)

        const warnings = visitRogueIntrinsics(ast, [BUTTON_ENTRY])
        expect(warnings.size).toBe(0)
    })

    it('3. <button> with no registry → no flag (visitor skips)', () => {
        const ast = parseJSX(`
            export function App() {
                return <button>Submit</button>
            }
        `)

        const warnings = visitRogueIntrinsics(ast, [])
        expect(warnings.size).toBe(0)
    })

    it('4. <input> with Input in registry → flags with prop hints', () => {
        const ast = parseJSX(`
            export function App() {
                return <input disabled placeholder="Name" data-flint-id="n2" />
            }
        `)

        const warnings = visitRogueIntrinsics(ast, [INPUT_ENTRY])

        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.ruleId).toBe('MITHRIL-REG-001')
        expect(w.message).toContain('<Input>')
        expect(w.message).toContain('disabled \u2192 isDisabled')
    })

    it('5. <div> (not a mapped intrinsic) → no flag', () => {
        const ast = parseJSX(`
            export function App() {
                return <div data-flint-id="n3">Hello</div>
            }
        `)

        const warnings = visitRogueIntrinsics(ast, FULL_REGISTRY)
        expect(warnings.size).toBe(0)
    })

    it('6. <select> with Select in registry → flags', () => {
        const ast = parseJSX(`
            export function App() {
                return (
                    <select data-flint-id="n4">
                        <option value="a">A</option>
                    </select>
                )
            }
        `)

        const warnings = visitRogueIntrinsics(ast, [SELECT_ENTRY])

        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.ruleId).toBe('MITHRIL-REG-001')
        expect(w.message).toContain('<Select>')
        expect(w.message).toContain('instead of <select>')
    })

    it('7. Policy set to "off" → no violations', () => {
        const ast = parseJSX(`
            export function App() {
                return <button>Submit</button>
            }
        `)

        const warnings = visitRogueIntrinsics(ast, [BUTTON_ENTRY], {
            ruleModes: { 'MITHRIL-REG-001': 'off' },
        })

        expect(warnings.size).toBe(0)
    })

    it('8. Multiple intrinsics in one component → multiple violations', () => {
        const ast = parseJSX(`
            export function App() {
                return (
                    <div>
                        <button>Submit</button>
                        <input />
                        <select><option>A</option></select>
                    </div>
                )
            }
        `)

        const warnings = visitRogueIntrinsics(ast, FULL_REGISTRY)

        expect(warnings.size).toBe(3)
        const ruleIds = [...warnings.values()].map(w => w.ruleId)
        expect(ruleIds.every(id => id === 'MITHRIL-REG-001')).toBe(true)
    })

    it('9. Registry entry with import path → included in message', () => {
        const ast = parseJSX(`
            export function App() {
                return <button>Submit</button>
            }
        `)

        const warnings = visitRogueIntrinsics(ast, [BUTTON_ENTRY])

        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.message).toContain("from '@/components/ui/button'")
    })

    it('10. Intrinsic with no registry match → no flag', () => {
        const ast = parseJSX(`
            export function App() {
                return <table><tr><td>Data</td></tr></table>
            }
        `)

        // Registry only has Button — no table component
        const warnings = visitRogueIntrinsics(ast, [BUTTON_ENTRY])
        expect(warnings.size).toBe(0)
    })

    it('11. <a> with Link in registry → flags with href prop preserved note', () => {
        const ast = parseJSX(`
            export function App() {
                return <a href="/about">About</a>
            }
        `)

        const warnings = visitRogueIntrinsics(ast, [LINK_ENTRY])

        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.ruleId).toBe('MITHRIL-REG-001')
        expect(w.message).toContain('<Link>')
        expect(w.message).toContain('instead of <a>')
        // href → href is same name, so no prop hint
        expect(w.message).not.toContain('Prop mapping')
    })

    it('12. Policy set to "advisory" → severity is "advisory"', () => {
        const ast = parseJSX(`
            export function App() {
                return <button>Submit</button>
            }
        `)

        const warnings = visitRogueIntrinsics(ast, [BUTTON_ENTRY], {
            ruleModes: { 'MITHRIL-REG-001': 'advisory' },
        })

        expect(warnings.size).toBe(1)
        const w = [...warnings.values()][0]
        expect(w.severity).toBe('advisory')
    })

    it('13. auditAll integrates rogue intrinsic warnings', () => {
        const ast = parseJSX(`
            export function App() {
                return <button data-flint-id="n1" className="bg-blue-500">Submit</button>
            }
        `)

        const warnings = auditAll(ast, [], {
            registryEntries: [BUTTON_ENTRY],
        })

        const rogueWarnings = [...warnings.values()].filter(w => w.ruleId === 'MITHRIL-REG-001')
        expect(rogueWarnings.length).toBe(1)
        expect(rogueWarnings[0].message).toContain('<Button>')
    })
})
