/**
 * astModifier — Unit Tests
 *
 * Scope: pure, headless AST logic. No React, no Electron, no window.flintAPI.
 *
 * Coverage:
 *   extractNode — removes a JSXElement from its parent and returns it.
 *   insertNode  — inserts a detached JSXElement into a target AST.
 */

import { describe, it, expect } from 'vitest'
import { parseCodeToAST, generateCodeFromAST } from '../core/ast-parser'
import { extractNode, insertNode } from './astModifier'

// ── Fixtures ───────────────────────────────────────────────────────────────────

// Source file: three siblings inside a root div, each with a stable flint ID.
const SOURCE = `
import React from 'react'
export default function App() {
  return (
    <div data-flint-id="root">
      <h1 data-flint-id="heading">Hello</h1>
      <p data-flint-id="para">World</p>
      <span data-flint-id="span">!</span>
    </div>
  )
}
`

// Target file: a section with one child.
const TARGET = `
import React from 'react'
export default function Other() {
  return (
    <section data-flint-id="section">
      <em data-flint-id="em">Content</em>
    </section>
  )
}
`

// ── extractNode ────────────────────────────────────────────────────────────────

describe('extractNode', () => {
    it('removes a child element from its parent and returns it', () => {
        const ast = parseCodeToAST(SOURCE)!
        const node = extractNode(ast, 'heading')

        expect(node).not.toBeNull()
        // After extraction the generated code must no longer contain the heading.
        const code = generateCodeFromAST(ast)
        expect(code).not.toContain('data-flint-id="heading"')
        expect(code).toContain('data-flint-id="para"')
        expect(code).toContain('data-flint-id="span"')
    })

    it('returns the extracted JSXElement node', () => {
        const ast = parseCodeToAST(SOURCE)!
        const node = extractNode(ast, 'para')

        expect(node).not.toBeNull()
        expect(node!.type).toBe('JSXElement')
    })

    it('returns null when nodeId is not found', () => {
        const ast = parseCodeToAST(SOURCE)!
        expect(extractNode(ast, 'nonexistent-id')).toBeNull()
    })

    it('returns null when the element is a root (no JSXElement parent)', () => {
        // 'root' is a direct child of the ReturnStatement, not of a JSXElement.
        const ast = parseCodeToAST(SOURCE)!
        expect(extractNode(ast, 'root')).toBeNull()
    })

    it('does not remove other siblings when extracting one node', () => {
        const ast = parseCodeToAST(SOURCE)!
        extractNode(ast, 'para')

        const code = generateCodeFromAST(ast)
        expect(code).toContain('data-flint-id="heading"')
        expect(code).toContain('data-flint-id="span"')
    })
})

// ── insertNode ─────────────────────────────────────────────────────────────────

describe('insertNode', () => {
    it('inserts as last child with position "inside"', () => {
        const sourceAst = parseCodeToAST(SOURCE)!
        const targetAst = parseCodeToAST(TARGET)!

        const node = extractNode(sourceAst, 'heading')!
        const ok = insertNode(targetAst, node, 'section', 'inside')

        expect(ok).toBe(true)
        const code = generateCodeFromAST(targetAst)
        expect(code).toContain('data-flint-id="heading"')
        // Existing child must still be present.
        expect(code).toContain('data-flint-id="em"')
    })

    it('inserts as sibling before target with position "before"', () => {
        const sourceAst = parseCodeToAST(SOURCE)!
        const targetAst = parseCodeToAST(TARGET)!

        const node = extractNode(sourceAst, 'span')!
        const ok = insertNode(targetAst, node, 'em', 'before')

        expect(ok).toBe(true)
        const code = generateCodeFromAST(targetAst)
        // Both IDs must be present.
        expect(code).toContain('data-flint-id="span"')
        expect(code).toContain('data-flint-id="em"')
        // span must come before em in the output.
        expect(code.indexOf('"span"')).toBeLessThan(code.indexOf('"em"'))
    })

    it('inserts as sibling after target with position "after"', () => {
        const sourceAst = parseCodeToAST(SOURCE)!
        const targetAst = parseCodeToAST(TARGET)!

        const node = extractNode(sourceAst, 'para')!
        const ok = insertNode(targetAst, node, 'em', 'after')

        expect(ok).toBe(true)
        const code = generateCodeFromAST(targetAst)
        expect(code).toContain('data-flint-id="para"')
        expect(code).toContain('data-flint-id="em"')
        // para must come after em in the output.
        expect(code.indexOf('"em"')).toBeLessThan(code.indexOf('"para"'))
    })

    it('returns false when the target node does not exist', () => {
        const sourceAst = parseCodeToAST(SOURCE)!
        const targetAst = parseCodeToAST(TARGET)!

        const node = extractNode(sourceAst, 'heading')!
        const ok = insertNode(targetAst, node, 'nonexistent', 'inside')

        expect(ok).toBe(false)
    })

    it('returns false for "inside" when the target is self-closing', () => {
        const selfClosing = `
import React from 'react'
export default function App() {
  return (
    <div data-flint-id="root">
      <input data-flint-id="inp" />
    </div>
  )
}
`
        const sourceAst = parseCodeToAST(SOURCE)!
        const targetAst = parseCodeToAST(selfClosing)!

        const node = extractNode(sourceAst, 'heading')!
        const ok = insertNode(targetAst, node, 'inp', 'inside')

        expect(ok).toBe(false)
    })

    it('returns false for "before"/"after" when target is a root element', () => {
        // 'root' in SOURCE is a direct child of ReturnStatement, not of a
        // JSXElement, so 'before'/'after' cannot be expressed.
        const sourceAst = parseCodeToAST(SOURCE)!

        const node = extractNode(sourceAst, 'heading')!

        // We need a fresh node since extractNode already removed heading from
        // sourceAst. Re-parse to get a clean fixture.
        const freshTarget = parseCodeToAST(`
import React from 'react'
export default function X() {
  return <div data-flint-id="solo" />
}
`)!

        // 'solo' is the root element — no JSXElement parent.
        const beforeOk = insertNode(freshTarget, node, 'solo', 'before')
        expect(beforeOk).toBe(false)

        // Re-parse target for the 'after' case (AST unchanged since beforeOk is false).
        const freshTarget2 = parseCodeToAST(`
import React from 'react'
export default function X() {
  return <div data-flint-id="solo2" />
}
`)!
        const afterOk = insertNode(freshTarget2, node, 'solo2', 'after')
        expect(afterOk).toBe(false)
    })
})
