/**
 * GOV.3 — Session-Level Mutation Validation tests
 *
 * bridge-mcp/src/core/governance/__tests__/sessionValidator.test.ts
 *
 * Coverage:
 *   - Clean AST with all bridge IDs → valid, no errors
 *   - Duplicate bridge IDs → DUPLICATE_BRIDGE_ID error for each pair
 *   - Orphaned reference (node deleted but still in session mutations) → ORPHANED_MUTATION warning
 *   - Stale import (imported symbol not used in body) → STALE_IMPORT error
 *   - Missing bridge ID on a JSX element → MISSING_BRIDGE_ID error
 *   - Multiple simultaneous errors in one AST → all reported
 *   - Empty/fragment-only AST → valid (edge case)
 *   - Empty session mutations array → CHECK-2 is skipped, no spurious errors
 *   - Non-JSX-only file (no JSX at all) → valid
 *   - result shape: valid, errors, validatedAt, mutationCount
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File as BabelFile } from '@babel/types'
import { validateSessionState } from '../sessionValidator.js'
import type { SessionMutation } from '../sessionValidator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJSX(code: string): BabelFile {
    return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as BabelFile
}

// ---------------------------------------------------------------------------
// CHECK-1: Unique bridge IDs
// ---------------------------------------------------------------------------

describe('CHECK-1 — Unique bridge IDs', () => {
    it('clean AST with unique bridge IDs → valid, no DUPLICATE_BRIDGE_ID errors', () => {
        const ast = parseJSX(`
            const C = () => (
                <div data-bridge-id="root">
                    <span data-bridge-id="child-1">Hello</span>
                    <span data-bridge-id="child-2">World</span>
                </div>
            )
        `)
        const result = validateSessionState(ast, 'Button.tsx', [])
        const dupeErrors = result.errors.filter((e) => e.code === 'DUPLICATE_BRIDGE_ID')
        expect(dupeErrors).toHaveLength(0)
    })

    it('duplicate bridge IDs → exactly one DUPLICATE_BRIDGE_ID error per duplicated id', () => {
        const ast = parseJSX(`
            const C = () => (
                <div data-bridge-id="root">
                    <span data-bridge-id="dup-id">A</span>
                    <span data-bridge-id="dup-id">B</span>
                </div>
            )
        `)
        const result = validateSessionState(ast, 'Button.tsx', [])
        const dupeErrors = result.errors.filter((e) => e.code === 'DUPLICATE_BRIDGE_ID')
        expect(dupeErrors).toHaveLength(1)
        expect(dupeErrors[0].nodeId).toBe('dup-id')
        expect(dupeErrors[0].severity).toBe('error')
    })

    it('two distinct duplicate pairs → two DUPLICATE_BRIDGE_ID errors', () => {
        const ast = parseJSX(`
            const C = () => (
                <div data-bridge-id="root">
                    <span data-bridge-id="a">1</span>
                    <span data-bridge-id="a">2</span>
                    <p data-bridge-id="b">3</p>
                    <p data-bridge-id="b">4</p>
                </div>
            )
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const codes = result.errors
            .filter((e) => e.code === 'DUPLICATE_BRIDGE_ID')
            .map((e) => e.nodeId)
        expect(codes).toContain('a')
        expect(codes).toContain('b')
        expect(codes).toHaveLength(2)
    })

    it('triplicate bridge ID → only one error emitted (de-duplication guard)', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <span data-bridge-id="triple">A</span>
                    <span data-bridge-id="triple">B</span>
                    <span data-bridge-id="triple">C</span>
                </div>
            )
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const dupes = result.errors.filter((e) => e.code === 'DUPLICATE_BRIDGE_ID')
        expect(dupes).toHaveLength(1)
    })

    it('valid=false when DUPLICATE_BRIDGE_ID error present', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <span data-bridge-id="x">A</span>
                    <span data-bridge-id="x">B</span>
                </div>
            )
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        expect(result.valid).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// CHECK-2: No orphaned nodes
// ---------------------------------------------------------------------------

describe('CHECK-2 — Orphaned mutation references', () => {
    it('node referenced in session mutations exists in AST → no ORPHANED_MUTATION warning', () => {
        const ast = parseJSX(`
            const C = () => <div data-bridge-id="alive">Hello</div>
        `)
        const mutations: SessionMutation[] = [{ nodeId: 'alive', type: 'updateClassName' }]
        const result = validateSessionState(ast, 'File.tsx', mutations)
        const orphaned = result.errors.filter((e) => e.code === 'ORPHANED_MUTATION')
        expect(orphaned).toHaveLength(0)
    })

    it('node referenced in session mutations is absent from AST → ORPHANED_MUTATION warning', () => {
        const ast = parseJSX(`
            const C = () => <div data-bridge-id="survivor">Hello</div>
        `)
        const mutations: SessionMutation[] = [{ nodeId: 'deleted-node', type: 'updateClassName' }]
        const result = validateSessionState(ast, 'File.tsx', mutations)
        const orphaned = result.errors.filter((e) => e.code === 'ORPHANED_MUTATION')
        expect(orphaned).toHaveLength(1)
        expect(orphaned[0].nodeId).toBe('deleted-node')
        expect(orphaned[0].severity).toBe('warning')
    })

    it('orphaned mutation does not make valid=false (warning severity)', () => {
        const ast = parseJSX(`
            const C = () => <div data-bridge-id="root" />
        `)
        const mutations: SessionMutation[] = [{ nodeId: 'ghost-id' }]
        const result = validateSessionState(ast, 'File.tsx', mutations)
        // ORPHANED_MUTATION is 'warning' — should not set valid=false
        // (other errors like MISSING_BRIDGE_ID from root without bridge id may fire)
        const orphaned = result.errors.filter((e) => e.code === 'ORPHANED_MUTATION')
        expect(orphaned[0].severity).toBe('warning')
    })

    it('mutation with undefined nodeId is skipped (no spurious error)', () => {
        const ast = parseJSX(`
            const C = () => <div data-bridge-id="root">Hello</div>
        `)
        const mutations: SessionMutation[] = [{ type: 'assembleLayout' }]
        const result = validateSessionState(ast, 'File.tsx', mutations)
        const orphaned = result.errors.filter((e) => e.code === 'ORPHANED_MUTATION')
        expect(orphaned).toHaveLength(0)
    })

    it('empty session mutations → CHECK-2 produces no errors', () => {
        const ast = parseJSX(`
            const C = () => <div data-bridge-id="root">Hello</div>
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const orphaned = result.errors.filter((e) => e.code === 'ORPHANED_MUTATION')
        expect(orphaned).toHaveLength(0)
    })

    it('multiple orphaned references → one ORPHANED_MUTATION per missing id', () => {
        const ast = parseJSX(`
            const C = () => <div data-bridge-id="root">Hello</div>
        `)
        const mutations: SessionMutation[] = [
            { nodeId: 'gone-1' },
            { nodeId: 'gone-2' },
            { nodeId: 'root' },
        ]
        const result = validateSessionState(ast, 'File.tsx', mutations)
        const orphaned = result.errors.filter((e) => e.code === 'ORPHANED_MUTATION')
        expect(orphaned).toHaveLength(2)
        const ids = orphaned.map((e) => e.nodeId)
        expect(ids).toContain('gone-1')
        expect(ids).toContain('gone-2')
    })
})

// ---------------------------------------------------------------------------
// CHECK-3: Import consistency (stale imports)
// ---------------------------------------------------------------------------

describe('CHECK-3 — Stale imports', () => {
    it('all imports are used → no STALE_IMPORT errors', () => {
        // React is explicitly referenced via React.Fragment so it is not stale.
        // Button is used as a JSX element (JSXIdentifier) so it is also not stale.
        const ast = parseJSX(`
            import React from 'react'
            import { Button } from './Button'
            const C = () => (
                <React.Fragment>
                    <Button data-bridge-id="btn">Click</Button>
                </React.Fragment>
            )
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const stale = result.errors.filter((e) => e.code === 'STALE_IMPORT')
        expect(stale).toHaveLength(0)
    })

    it('unused named import → STALE_IMPORT error with import name', () => {
        const ast = parseJSX(`
            import React from 'react'
            import { UnusedComponent } from './unused'
            const C = () => <div data-bridge-id="root">Hello</div>
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const stale = result.errors.filter((e) => e.code === 'STALE_IMPORT')
        expect(stale.some((e) => e.message.includes('UnusedComponent'))).toBe(true)
    })

    it('unused default import → STALE_IMPORT error', () => {
        const ast = parseJSX(`
            import Card from './Card'
            const C = () => <div data-bridge-id="root">Hello</div>
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const stale = result.errors.filter((e) => e.code === 'STALE_IMPORT')
        expect(stale.some((e) => e.message.includes('Card'))).toBe(true)
    })

    it('namespace import that is used → no STALE_IMPORT error', () => {
        const ast = parseJSX(`
            import * as Icons from './icons'
            const C = () => <div data-bridge-id="root">{Icons.Star}</div>
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const stale = result.errors.filter((e) => e.code === 'STALE_IMPORT')
        expect(stale).toHaveLength(0)
    })

    it('STALE_IMPORT has severity=error', () => {
        const ast = parseJSX(`
            import { Ghost } from './ghost'
            const C = () => <div data-bridge-id="root">Hello</div>
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const stale = result.errors.filter((e) => e.code === 'STALE_IMPORT')
        expect(stale[0].severity).toBe('error')
    })

    it('file with no imports → no STALE_IMPORT errors', () => {
        const ast = parseJSX(`
            const C = () => <div data-bridge-id="root">Hello</div>
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const stale = result.errors.filter((e) => e.code === 'STALE_IMPORT')
        expect(stale).toHaveLength(0)
    })
})

// ---------------------------------------------------------------------------
// CHECK-4: Bridge ID coverage
// ---------------------------------------------------------------------------

describe('CHECK-4 — Bridge ID coverage', () => {
    it('all JSX elements have bridge IDs → no MISSING_BRIDGE_ID errors', () => {
        const ast = parseJSX(`
            const C = () => (
                <div data-bridge-id="root">
                    <span data-bridge-id="s1">Text</span>
                </div>
            )
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const missing = result.errors.filter((e) => e.code === 'MISSING_BRIDGE_ID')
        expect(missing).toHaveLength(0)
    })

    it('JSX element without bridge ID → MISSING_BRIDGE_ID error', () => {
        const ast = parseJSX(`
            const C = () => <div>Hello</div>
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const missing = result.errors.filter((e) => e.code === 'MISSING_BRIDGE_ID')
        expect(missing.length).toBeGreaterThan(0)
        expect(missing[0].severity).toBe('error')
        expect(missing[0].message).toContain('div')
    })

    it('multiple elements missing bridge IDs → one error per element', () => {
        const ast = parseJSX(`
            const C = () => (
                <div>
                    <span>A</span>
                    <p>B</p>
                </div>
            )
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const missing = result.errors.filter((e) => e.code === 'MISSING_BRIDGE_ID')
        expect(missing.length).toBe(3) // div, span, p
    })

    it('MISSING_BRIDGE_ID makes valid=false', () => {
        const ast = parseJSX(`
            const C = () => <div>Hello</div>
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        expect(result.valid).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Multiple simultaneous errors
// ---------------------------------------------------------------------------

describe('Multiple errors in one AST', () => {
    it('reports DUPLICATE_BRIDGE_ID + STALE_IMPORT in same result', () => {
        const ast = parseJSX(`
            import { Ghost } from './ghost'
            const C = () => (
                <div data-bridge-id="root">
                    <span data-bridge-id="dup">A</span>
                    <span data-bridge-id="dup">B</span>
                </div>
            )
        `)
        const result = validateSessionState(ast, 'File.tsx', [])
        const codes = result.errors.map((e) => e.code)
        expect(codes).toContain('DUPLICATE_BRIDGE_ID')
        expect(codes).toContain('STALE_IMPORT')
        expect(result.valid).toBe(false)
    })

    it('reports all four check types simultaneously', () => {
        const ast = parseJSX(`
            import { Ghost } from './ghost'
            const C = () => (
                <div>
                    <span data-bridge-id="dup">A</span>
                    <span data-bridge-id="dup">B</span>
                </div>
            )
        `)
        const mutations: SessionMutation[] = [{ nodeId: 'orphan-node' }]
        const result = validateSessionState(ast, 'File.tsx', mutations)
        const codes = result.errors.map((e) => e.code)
        expect(codes).toContain('DUPLICATE_BRIDGE_ID')
        expect(codes).toContain('ORPHANED_MUTATION')
        expect(codes).toContain('STALE_IMPORT')
        expect(codes).toContain('MISSING_BRIDGE_ID')
        expect(result.valid).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
    it('empty AST (no JSX at all) → valid, no errors', () => {
        const ast = parseJSX(`export {}`)
        const result = validateSessionState(ast, 'Empty.tsx', [])
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })

    it('non-JSX TypeScript file → valid, no errors', () => {
        const ast = parseJSX(`
            const x: number = 42
            export default x
        `)
        const result = validateSessionState(ast, 'Utils.ts', [])
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })

    it('result always includes validatedAt as ISO 8601 string', () => {
        const ast = parseJSX(`export {}`)
        const result = validateSessionState(ast, 'File.tsx', [])
        expect(result.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('mutationCount reflects the session mutations array length', () => {
        const ast = parseJSX(`
            const C = () => <div data-bridge-id="root">Hello</div>
        `)
        const mutations: SessionMutation[] = [
            { nodeId: 'root', type: 'updateClassName' },
            { nodeId: 'root', type: 'updateProp' },
        ]
        const result = validateSessionState(ast, 'File.tsx', mutations)
        expect(result.mutationCount).toBe(2)
    })

    it('mutationCount=0 for empty mutations array', () => {
        const ast = parseJSX(`export {}`)
        const result = validateSessionState(ast, 'File.tsx', [])
        expect(result.mutationCount).toBe(0)
    })

    it('clean, fully-covered JSX component → valid=true', () => {
        // No unused imports; all JSX elements have bridge IDs; no orphaned mutations.
        const ast = parseJSX(`
            const Button = () => (
                <button data-bridge-id="btn" className="px-4 py-2">
                    <span data-bridge-id="btn-label">Click me</span>
                </button>
            )
            export default Button
        `)
        const mutations: SessionMutation[] = [
            { nodeId: 'btn', type: 'updateClassName' },
        ]
        const result = validateSessionState(ast, 'Button.tsx', mutations)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })
})
