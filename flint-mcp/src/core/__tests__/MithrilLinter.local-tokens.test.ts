/**
 * MithrilLinter — Local Token Object Tests (Phase 2: MITHRIL-DTO-001)
 * flint-mcp/src/core/__tests__/MithrilLinter.local-tokens.test.ts
 *
 * Covers visitLocalTokenObjects() and auditAll integration:
 *
 *   Group A — visitLocalTokenObjects
 *     A1 — Object with 3 hex colors all matching Flint tokens → 1 warning, MITHRIL-DTO-001
 *     A2 — Object with 2 matching + 1 unregistered value → message includes unregistered count
 *     A3 — Object with only 1 matching value → NO warning (threshold is ≥ 2)
 *     A4 — Object with dynamic expressions only (no literals) → no warning
 *     A5 — Policy mode 'off' → no warning
 *     A6 — Policy mode 'advisory' → severity 'warning' (advisory mode uses 'warning' severity)
 *     A7 — No tokens provided → no warning
 *
 *   Group B — auditAll integration
 *     B1 — TSX file with const tokens = { colorPrimary: '#0066FF', colorSurface: '#FFFFFF' }
 *          → auditAll returns a MITHRIL-DTO-001 warning
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import {
    visitLocalTokenObjects,
    auditAll,
} from '../MithrilLinter.js'
import type { DesignToken } from '../../types.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseJSX(code: string): File {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as File
}

/** Wrap a module-level const declaration in a minimal TSX module. */
function tsxModule(body: string): File {
    return parseJSX(body)
}

// ── Token fixtures ─────────────────────────────────────────────────────────────

const COLOR_TOKENS: DesignToken[] = [
    { id: 1, token_path: 'color.brand.primary', token_type: 'color', token_value: '#0066FF', description: null, collection_name: 'default', mode: 'default' },
    { id: 2, token_path: 'color.surface.base', token_type: 'color', token_value: '#FFFFFF', description: null, collection_name: 'default', mode: 'default' },
    { id: 3, token_path: 'color.text.primary', token_type: 'color', token_value: '#111111', description: null, collection_name: 'default', mode: 'default' },
]

const DIMENSION_TOKENS: DesignToken[] = [
    { id: 10, token_path: 'spacing.sm', token_type: 'dimension', token_value: '8', description: null, collection_name: 'default', mode: 'default' },
    { id: 11, token_path: 'spacing.md', token_type: 'dimension', token_value: '16', description: null, collection_name: 'default', mode: 'default' },
]

const ALL_TOKENS = [...COLOR_TOKENS, ...DIMENSION_TOKENS]

// ── Group A: visitLocalTokenObjects ───────────────────────────────────────────

describe('visitLocalTokenObjects — basic detection', () => {
    it('A1: object with 3 matching hex colors → 1 warning with MITHRIL-DTO-001', () => {
        const ast = tsxModule(`
            const localTokens = {
                colorPrimary: '#0066FF',
                colorSurface: '#FFFFFF',
                colorText: '#111111',
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS)
        expect(result.size).toBe(1)
        const [warning] = result.values()
        expect(warning?.ruleId).toBe('MITHRIL-DTO-001')
        expect(warning?.type).toBe('inline-style-drift')
        expect(warning?.message).toContain('localTokens')
        expect(warning?.message).toContain('shadows')
    })

    it('A2: object with 2 matching + 1 unregistered value → message includes unregistered count', () => {
        const ast = tsxModule(`
            const localTokens = {
                colorPrimary: '#0066FF',
                colorSurface: '#FFFFFF',
                colorCustom: '#ABCDEF',
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS)
        expect(result.size).toBe(1)
        const [warning] = result.values()
        expect(warning?.message).toContain('1 values have no matching Flint token')
    })

    it('A3: object with only 1 matching value → NO warning (threshold is ≥ 2)', () => {
        const ast = tsxModule(`
            const localTokens = {
                colorPrimary: '#0066FF',
                someOtherProp: 'not-a-token',
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS)
        expect(result.size).toBe(0)
    })

    it('A4: object with dynamic expressions only → no warning', () => {
        const ast = tsxModule(`
            const localTokens = {
                colorPrimary: someVariable,
                colorSurface: anotherVariable,
                colorText: computedValue,
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS)
        expect(result.size).toBe(0)
    })

    it('A5: policy mode off → no warning', () => {
        const ast = tsxModule(`
            const localTokens = {
                colorPrimary: '#0066FF',
                colorSurface: '#FFFFFF',
                colorText: '#111111',
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS, { ruleModes: { 'MITHRIL-DTO-001': 'off' } })
        expect(result.size).toBe(0)
    })

    it('A6: policy mode advisory → severity advisory', () => {
        const ast = tsxModule(`
            const localTokens = {
                colorPrimary: '#0066FF',
                colorSurface: '#FFFFFF',
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS, { ruleModes: { 'MITHRIL-DTO-001': 'advisory' } })
        expect(result.size).toBe(1)
        const [warning] = result.values()
        expect(warning?.severity).toBe('advisory')
    })

    it('A7: no tokens provided → no warning', () => {
        const ast = tsxModule(`
            const localTokens = {
                colorPrimary: '#0066FF',
                colorSurface: '#FFFFFF',
            }
        `)
        const result = visitLocalTokenObjects(ast, [])
        expect(result.size).toBe(0)
    })
})

describe('visitLocalTokenObjects — scope and edge cases', () => {
    it('only flags module-scope declarators, not function-local objects', () => {
        // A const object inside a React component body — NOT module scope
        // Should NOT be flagged by this visitor
        const ast = tsxModule(`
            export default function MyComponent() {
                const localTokens = {
                    colorPrimary: '#0066FF',
                    colorSurface: '#FFFFFF',
                    colorText: '#111111',
                }
                return <div />
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS)
        // Function-scoped declarators are excluded
        expect(result.size).toBe(0)
    })

    it('warning message includes the variable name', () => {
        const ast = tsxModule(`
            const myDesignVariables = {
                colorPrimary: '#0066FF',
                colorSurface: '#FFFFFF',
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS)
        const [warning] = result.values()
        expect(warning?.message).toContain('myDesignVariables')
    })

    it('warning value reflects the match count', () => {
        const ast = tsxModule(`
            const localTokens = {
                colorPrimary: '#0066FF',
                colorSurface: '#FFFFFF',
                colorText: '#111111',
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS)
        const [warning] = result.values()
        expect(warning?.value).toBe(3)
    })

    it('warning includes line number from the variable declarator', () => {
        const ast = tsxModule(`
            const localTokens = {
                colorPrimary: '#0066FF',
                colorSurface: '#FFFFFF',
            }
        `)
        const result = visitLocalTokenObjects(ast, COLOR_TOKENS)
        const [warning] = result.values()
        expect(typeof warning?.line).toBe('number')
    })

    it('detects dimension tokens (px values) as token-like', () => {
        const ast = tsxModule(`
            const spacingMap = {
                sm: '8px',
                md: '16px',
                lg: '32px',
            }
        `)
        // Only sm and md match DIMENSION_TOKENS; lg does not
        const result = visitLocalTokenObjects(ast, DIMENSION_TOKENS)
        expect(result.size).toBe(1)
        const [warning] = result.values()
        expect(warning?.message).toContain('1 values have no matching Flint token')
    })
})

// ── Group B: auditAll integration ────────────────────────────────────────────

describe('auditAll integration — MITHRIL-DTO-001', () => {
    it('B1: auditAll returns a MITHRIL-DTO-001 warning for module-scope local token object', () => {
        const ast = tsxModule(`
            const tokens = {
                colorPrimary: '#0066FF',
                colorSurface: '#FFFFFF',
            }
            export default function C() { return <div data-flint-id="b1" className="text-sm" /> }
        `)
        const result = auditAll(ast, ALL_TOKENS)
        const dtoWarnings = [...result.values()].filter((w) => w.ruleId === 'MITHRIL-DTO-001')
        expect(dtoWarnings.length).toBe(1)
        expect(dtoWarnings[0]?.message).toContain('tokens')
        expect(dtoWarnings[0]?.message).toContain('shadows')
    })
})
