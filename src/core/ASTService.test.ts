/**
 * ASTService — Unit Tests
 *
 * Scope: pure, headless logic. No React, no Electron IPC, no window.flintAPI.
 *
 * What we verify:
 *   1. applyMutationBatch — implements the batch engine (replaces Phase B stub).
 *   2. All parser utilities are re-exported as callable functions.
 *   3. ASTMutation type is structurally sound (checked at TS level).
 *   4. synthesizeImports correctly migrates dependencies and deduplicates.
 *   5. nodeExists — pre-flight zombie check.
 *   6. applyInversions — restores prior state from InverseMutation[].
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { ExpressionStatement, JSXElement } from '@babel/types'
import { isJSXElement } from '@babel/types'
import {
    applyMutationBatch,
    parseCodeToAST,
    generateCodeFromAST,
    buildVisualTree,
    updateJSXClassName,
    synthesizeImports,
    nodeExists,
    applyInversions,
} from './ASTService'
import type { ASTMutation, InverseMutation } from './ASTService'

// ── Test helper ───────────────────────────────────────────────────────────────

/**
 * Parses a JSX expression string (e.g. `<Button />` or `<div><Foo /></div>`)
 * and returns the root JSXElement node. Throws on parse failure.
 */
function parseJSXElement(jsx: string): JSXElement {
    const ast = parse(`(${jsx})`, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    })
    const stmt = ast.program.body[0] as ExpressionStatement
    const expr = stmt.expression
    if (!isJSXElement(expr)) throw new Error(`Expected JSXElement, got ${expr.type}`)
    return expr
}

// ── applyMutationBatch ────────────────────────────────────────────────────────

describe('applyMutationBatch', () => {

    // ── 1. Empty batch ────────────────────────────────────────────────────────

    it('returns original code and empty inversions for an empty batch', () => {
        const code = 'export default function App() { return <div /> }'
        const result = applyMutationBatch(code, [])
        expect(result.code).toBe(code)
        expect(result.inversions).toHaveLength(0)
    })

    // ── 2. Invalid code ───────────────────────────────────────────────────────

    it('returns original code and empty inversions when code is unparseable', () => {
        const code = 'this is not valid tsx !!!'
        const result = applyMutationBatch(code, [
            { op: 'updateClassName', nodeId: 'div:1:0', className: 'bg-red-500' },
        ])
        expect(result.code).toBe(code)
        expect(result.inversions).toHaveLength(0)
    })

    // ── 3. updateClassName applies change and captures inverse ────────────────

    it('applies updateClassName and produces an inverse with the old class', () => {
        const src = `export default function App() {
  return <div className="text-white">hello</div>
}`
        const mutations: ASTMutation[] = [
            { op: 'updateClassName', nodeId: 'div:2:9', className: 'text-black' },
        ]
        const { code, inversions } = applyMutationBatch(src, mutations)
        expect(code).toContain('text-black')
        expect(code).not.toContain('text-white')
        expect(inversions).toHaveLength(1)
        expect(inversions[0].op).toBe('updateClassName')
        if (inversions[0].op === 'updateClassName') {
            expect(inversions[0].className).toBe('text-white')
        }
    })

    // ── 4. Two mutations collapsed into one generate call ─────────────────────
    // Verifies the batch engine mutates both in a single parse→generate cycle.

    it('applies two updateClassName mutations and produces two inverses', () => {
        const src = `export default function App() {
  return (
    <div className="outer">
      <span className="inner">hi</span>
    </div>
  )
}`
        const mutations: ASTMutation[] = [
            { op: 'updateClassName', nodeId: 'div:3:4', className: 'new-outer' },
            { op: 'updateClassName', nodeId: 'span:4:6', className: 'new-inner' },
        ]
        const { code, inversions } = applyMutationBatch(src, mutations)
        expect(code).toContain('new-outer')
        expect(code).toContain('new-inner')
        expect(code).not.toContain('"outer"')
        expect(code).not.toContain('"inner"')
        expect(inversions).toHaveLength(2)
    })

    // ── 5. updateProp applies change and captures inverse ─────────────────────

    it('applies updateProp and produces an inverse with the old value', () => {
        const src = `export default function App() {
  return <input aria-label="old label" />
}`
        const mutations: ASTMutation[] = [
            { op: 'updateProp', nodeId: 'input:2:9', propName: 'aria-label', value: 'new label' },
        ]
        const { code, inversions } = applyMutationBatch(src, mutations)
        expect(code).toContain('new label')
        expect(inversions).toHaveLength(1)
        expect(inversions[0].op).toBe('updateProp')
        if (inversions[0].op === 'updateProp') {
            expect(inversions[0].value).toBe('old label')
            expect(inversions[0].propName).toBe('aria-label')
        }
    })

    // ── 6. moveNode produces a restoreCode inverse ────────────────────────────

    it('applies moveNode and produces a restoreCode inverse', () => {
        const src = `export default function App() {
  return (
    <div>
      <span className="a">A</span>
      <p className="b">B</p>
    </div>
  )
}`
        const mutations: ASTMutation[] = [
            {
                op: 'moveNode',
                sourceId: 'span:4:6',
                targetId: 'p:5:6',
                position: 'after',
            },
        ]
        const { inversions } = applyMutationBatch(src, mutations)
        expect(inversions).toHaveLength(1)
        expect(inversions[0].op).toBe('restoreCode')
        if (inversions[0].op === 'restoreCode') {
            // The snapshot should contain the original order
            expect(inversions[0].code).toContain('"a"')
            expect(inversions[0].code).toContain('"b"')
        }
    })

    // ── 7. deleteNode produces a restoreCode inverse ──────────────────────────

    it('applies deleteNode and produces a restoreCode inverse containing the node', () => {
        const src = `export default function App() {
  return (
    <div>
      <span className="deleteme">X</span>
    </div>
  )
}`
        const mutations: ASTMutation[] = [
            { op: 'deleteNode', nodeId: 'span:4:6' },
        ]
        const { code, inversions } = applyMutationBatch(src, mutations)
        // The span should be gone from the output
        expect(code).not.toContain('deleteme')
        expect(inversions).toHaveLength(1)
        expect(inversions[0].op).toBe('restoreCode')
        if (inversions[0].op === 'restoreCode') {
            // The snapshot must preserve the deleted node
            expect(inversions[0].code).toContain('deleteme')
        }
    })
})

// ── nodeExists ────────────────────────────────────────────────────────────────

describe('nodeExists', () => {

    it('returns true when the data-flint-id exists in the source', () => {
        const code = `export default function App() {
  return <div data-flint-id="abc123">hello</div>
}`
        expect(nodeExists(code, 'abc123')).toBe(true)
    })

    it('returns false when the data-flint-id is absent', () => {
        const code = `export default function App() {
  return <div className="foo">hello</div>
}`
        expect(nodeExists(code, 'abc123')).toBe(false)
    })

    it('returns false for unparseable code', () => {
        expect(nodeExists('not valid tsx !!!', 'abc123')).toBe(false)
    })
})

// ── applyInversions ───────────────────────────────────────────────────────────

describe('applyInversions', () => {

    it('restores code from a restoreCode snapshot, ignoring currentCode', () => {
        const snapshot = 'export default function App() { return <div className="original" /> }'
        const current = 'export default function App() { return <div className="changed" /> }'
        const inversions: InverseMutation[] = [{ op: 'restoreCode', code: snapshot }]
        expect(applyInversions(current, inversions)).toBe(snapshot)
    })

    it('applies surgical property inverses when no restoreCode is present', () => {
        const current = `export default function App() {
  return <div className="new-class">hi</div>
}`
        const inversions: InverseMutation[] = [
            { op: 'updateClassName', nodeId: 'div:2:9', className: 'old-class' },
        ]
        const restored = applyInversions(current, inversions)
        expect(restored).toContain('old-class')
        expect(restored).not.toContain('new-class')
    })

    it('restoreCode wins even when other inverses precede it in the array', () => {
        const snapshot = 'export default function App() { return <div className="snap" /> }'
        const inversions: InverseMutation[] = [
            { op: 'updateClassName', nodeId: 'div:1:0', className: 'ignored' },
            { op: 'restoreCode', code: snapshot },
        ]
        expect(applyInversions('anything', inversions)).toBe(snapshot)
    })
})

// ── ASTService re-exports ─────────────────────────────────────────────────────

describe('ASTService re-exports', () => {
    it('parseCodeToAST is a function', () => {
        expect(typeof parseCodeToAST).toBe('function')
    })

    it('generateCodeFromAST is a function', () => {
        expect(typeof generateCodeFromAST).toBe('function')
    })

    it('buildVisualTree is a function', () => {
        expect(typeof buildVisualTree).toBe('function')
    })

    it('updateJSXClassName is a function', () => {
        expect(typeof updateJSXClassName).toBe('function')
    })

    it('parseCodeToAST returns null on invalid syntax', () => {
        const result = parseCodeToAST('this is not valid tsx !!!')
        expect(result).toBeNull()
    })

    it('parseCodeToAST returns a Babel File node for valid TSX', () => {
        const result = parseCodeToAST('export default function App() { return <div /> }')
        expect(result).not.toBeNull()
        expect(result?.type).toBe('File')
    })

    it('generateCodeFromAST round-trips a parsed AST back to source', () => {
        const src = 'export default function App() {\n  return <div />;\n}'
        const ast = parseCodeToAST(src)
        expect(ast).not.toBeNull()
        const regenerated = generateCodeFromAST(ast!)
        expect(regenerated).toContain('function App')
        expect(regenerated).toContain('<div')
    })

    it('buildVisualTree extracts a layer for a single JSX element', () => {
        const src = 'export default function App() { return <section /> }'
        const ast = parseCodeToAST(src)
        expect(ast).not.toBeNull()
        const tree = buildVisualTree(ast!)
        expect(tree.length).toBeGreaterThan(0)
        expect(tree.some((l) => l.tagName === 'section')).toBe(true)
    })
})

// ── ASTMutation type soundness (compile-time only) ────────────────────────────
// These assignments are never executed; TypeScript checks them at build time.

const _updateClass: ASTMutation = {
    op: 'updateClassName',
    nodeId: 'div:1:0',
    className: 'bg-red-500',
}

const _move: ASTMutation = {
    op: 'moveNode',
    sourceId: 'div:1:0',
    targetId: 'section:3:4',
    position: 'before',
}

const _delete: ASTMutation = { op: 'deleteNode', nodeId: 'span:2:2' }

const _updateProp: ASTMutation = {
    op: 'updateProp',
    nodeId: 'input:4:0',
    propName: 'aria-label',
    value: 'Search',
}

const _updateTextContent: ASTMutation = {
    op: 'updateTextContent',
    nodeId: 'p:1:0',
    text: 'Hello',
}

const _injectComponent: ASTMutation = {
    op: 'injectComponent',
    targetNodeId: 'div:1:0',
    jsxSnippet: '<span>child</span>',
}

const _applyTokenFix: ASTMutation = {
    op: 'applyTokenFix',
    nodeId: 'div:1:0',
    hardcodedClass: 'bg-[#f3f3f3]',
    tokenClass: 'bg-brand-primary',
}

// Silence noUnusedLocals — the real assertion is that tsc accepts these shapes.
void [_updateClass, _move, _delete, _updateProp, _updateTextContent, _injectComponent, _applyTokenFix]

// ── Phase E.3 — ID Preservation ───────────────────────────────────────────────
//
// Commandment 13: "Preserve IDs — the data-flint-id must never be removed or
// altered during a mutation."
//
// Every write-path operation (updateClassName, updateProp, new-prop injection)
// must leave the data-flint-id attribute byte-for-byte identical in the
// resulting AST. `nodeExists` is the AST-level oracle: it traverses with
// @babel/traverse and checks attr.value.value === flintId at the node level.

describe('Phase E.3 — ID Preservation', () => {

    // Use a non-structural ID (no trailing `:line:col` digits) so jsxMatchesId
    // falls through to the data-flint-id attribute-value path rather than
    // attempting positional matching. Positional IDs are fine for other tests;
    // here we specifically exercise the attribute write-path.
    const FLINT_ID = 'save-btn-a3f'

    // Component with a fully-specified element carrying a flint ID.
    // FLINT_ID is passed as nodeId so the engine matches on the attribute value.
    const SOURCE = `export default function App() {
  return (
    <div>
      <button
        data-flint-id="${FLINT_ID}"
        className="text-red-500 font-bold"
        aria-label="Save"
      >
        Save
      </button>
    </div>
  )
}`

    it('data-flint-id survives an updateClassName mutation', () => {
        const { code } = applyMutationBatch(SOURCE, [
            { op: 'updateClassName', nodeId: FLINT_ID, className: 'text-blue-500 font-bold' },
        ])
        // AST-level assertion: nodeExists uses @babel/traverse and checks
        // attr.name.name === 'data-flint-id' && attr.value.value === FLINT_ID.
        expect(nodeExists(code, FLINT_ID)).toBe(true)
        // Confirm the mutation was actually applied (not a silent no-op).
        expect(code).toContain('text-blue-500')
        expect(code).not.toContain('text-red-500')
    })

    it('data-flint-id survives an updateProp mutation on an existing attribute', () => {
        const { code } = applyMutationBatch(SOURCE, [
            { op: 'updateProp', nodeId: FLINT_ID, propName: 'aria-label', value: 'Submit' },
        ])
        expect(nodeExists(code, FLINT_ID)).toBe(true)
        expect(code).toContain('"Submit"')
    })

    it('data-flint-id survives a prop injection (attribute did not previously exist)', () => {
        // updateProp on a propName not yet present synthesises a new JSXAttribute
        // and splices it into openingElement.attributes. The flint-id attr must
        // not be displaced or overwritten.
        const { code } = applyMutationBatch(SOURCE, [
            { op: 'updateProp', nodeId: FLINT_ID, propName: 'data-testid', value: 'save-btn' },
        ])
        expect(nodeExists(code, FLINT_ID)).toBe(true)
        expect(code).toContain('"save-btn"')
    })

    it('data-flint-id value is byte-for-byte identical after a multi-mutation batch', () => {
        // Apply className + new-prop in a single batch cycle.
        const { code } = applyMutationBatch(SOURCE, [
            { op: 'updateClassName', nodeId: FLINT_ID, className: 'bg-green-500' },
            { op: 'updateProp', nodeId: FLINT_ID, propName: 'aria-label', value: 'Updated' },
        ])
        // nodeExists validates the exact string value at AST attribute level —
        // it would fail if the ID were truncated, prefixed, or emptied.
        expect(nodeExists(code, FLINT_ID)).toBe(true)
        // Belt-and-suspenders: the source literal must also be present as-is.
        expect(code).toContain(`data-flint-id="${FLINT_ID}"`)
    })

    it('flint-id inversion restores original className without touching the ID', () => {
        // Apply then invert: the entire round-trip must leave the ID intact.
        const { code: mutated, inversions } = applyMutationBatch(SOURCE, [
            { op: 'updateClassName', nodeId: FLINT_ID, className: 'text-blue-500' },
        ])
        const restored = applyInversions(mutated, inversions)
        expect(nodeExists(restored, FLINT_ID)).toBe(true)
        expect(restored).toContain('text-red-500')
        expect(restored).not.toContain('text-blue-500')
    })
})

// ── synthesizeImports ─────────────────────────────────────────────────────────

describe('synthesizeImports (Phase B — Import Synthesizer)', () => {

    // ── 1. Injects a missing named import ─────────────────────────────────────

    it('injects a named import that is absent from the target', () => {
        const originCode = `import { Button } from './ui'\nexport default function A() { return <Button /> }`
        const targetCode = `export default function B() { return <div /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<Button />')

        synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')

        const code = generateCodeFromAST(targetAST)
        expect(code).toContain('Button')
        expect(code).toContain('./ui')
    })

    // ── 2. Deduplicates identical specifier ───────────────────────────────────

    it('does not add a duplicate import when specifier already exists in target', () => {
        const originCode = `import { Button } from './ui'\nexport default function A() { return <Button /> }`
        const targetCode = `import { Button } from './ui'\nexport default function B() { return <Button /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<Button />')

        synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')

        const code = generateCodeFromAST(targetAST)
        // There must be exactly one import of Button from './ui'
        const matches = code.match(/import[^;]+Button[^;]+from\s+['"]\.\/ui['"]/g) ?? []
        expect(matches).toHaveLength(1)
    })

    // ── 3. Multiple components from different modules ─────────────────────────

    it('injects imports for multiple components from different modules', () => {
        const originCode = [
            `import { Button } from './ui'`,
            `import { Card } from './card'`,
            `export default function A() { return <div><Button /><Card /></div> }`,
        ].join('\n')
        const targetCode = `export default function B() { return <div /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<div><Button /><Card /></div>')

        synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')

        const code = generateCodeFromAST(targetAST)
        expect(code).toContain('Button')
        expect(code).toContain('./ui')
        expect(code).toContain('Card')
        expect(code).toContain('./card')
    })

    // ── 4. Skips native HTML (lowercase) elements ─────────────────────────────

    it('does not inject imports for lowercase HTML elements', () => {
        const originCode = `import { div } from './not-real'\nexport default function A() { return <div /> }`
        const targetCode = `export default function B() { return <section /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<div />')

        synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')

        const code = generateCodeFromAST(targetAST)
        expect(code).not.toContain('not-real')
    })

    // ── 5. Gracefully skips component not imported in origin ──────────────────

    it('does not throw when a PascalCase component is not imported in origin', () => {
        const originCode = `export default function A() { return <Unknown /> }`
        const targetCode = `export default function B() { return <div /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<Unknown />')

        expect(() => synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')).not.toThrow()
    })

    // ── 6. Lucide icon named imports ──────────────────────────────────────────

    it('injects Lucide icon named imports correctly', () => {
        const originCode = [
            `import { ChevronDown, Loader2 } from 'lucide-react'`,
            `export default function A() { return <div><ChevronDown /><Loader2 /></div> }`,
        ].join('\n')
        const targetCode = `export default function B() { return <div /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<div><ChevronDown /><Loader2 /></div>')

        synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')

        const code = generateCodeFromAST(targetAST)
        expect(code).toContain('lucide-react')
        expect(code).toContain('ChevronDown')
        expect(code).toContain('Loader2')
    })

    // ── 7. Default imports ────────────────────────────────────────────────────

    it('injects a default import correctly', () => {
        const originCode = `import MyIcon from './icons'\nexport default function A() { return <MyIcon /> }`
        const targetCode = `export default function B() { return <div /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<MyIcon />')

        synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')

        const code = generateCodeFromAST(targetAST)
        expect(code).toContain('MyIcon')
        expect(code).toContain('./icons')
    })

    // ── 8. Partial deduplication (target has one specifier, needs another) ────

    it('adds only the missing specifier when target already imports from the same module', () => {
        const originCode = [
            `import { Button, Dialog } from './ui'`,
            `export default function A() { return <div><Button /><Dialog /></div> }`,
        ].join('\n')
        const targetCode = `import { Button } from './ui'\nexport default function B() { return <Button /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<div><Button /><Dialog /></div>')

        synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')

        const code = generateCodeFromAST(targetAST)
        expect(code).toContain('Dialog')
        const buttonImportLines = code
            .split('\n')
            .filter((l) => l.includes('import') && l.includes('Button'))
        expect(buttonImportLines).toHaveLength(1)
    })

    // ── 9. Returns targetAST unchanged for all-lowercase subtree ─────────────

    it('returns targetAST unchanged when the subtree has no PascalCase elements', () => {
        const originCode = `export default function A() { return <div><span /></div> }`
        const targetCode = `export default function B() { return <div /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<div><span /></div>')

        const before = generateCodeFromAST(targetAST)
        synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')
        const after = generateCodeFromAST(targetAST)

        expect(after).toBe(before)
    })

    // ── 10. Preserves aliased imports (import { Foo as Bar }) ─────────────────

    it('preserves import aliases from origin when injecting', () => {
        const originCode = `import { ChevronRight as Arrow } from 'lucide-react'\nexport default function A() { return <Arrow /> }`
        const targetCode = `export default function B() { return <div /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<Arrow />')

        synthesizeImports(originAST, jsxNode, targetAST, '/src/A.tsx', '/src/B.tsx')

        const code = generateCodeFromAST(targetAST)
        expect(code).toContain('Arrow')
        expect(code).toContain('ChevronRight')
        expect(code).toContain('lucide-react')
    })

    // ── 11. Relative path resolution ──────────────────────────────────────────

    it('resolves and rewrites relative imports based on source and target paths', () => {
        const originCode = `import { Button } from '../components/ui/Button'\nexport default function A() { return <Button /> }`
        const targetCode = `export default function B() { return <div /> }`

        const originAST = parseCodeToAST(originCode)!
        const targetAST = parseCodeToAST(targetCode)!
        const jsxNode = parseJSXElement('<Button />')

        // Moving from /src/pages/Home.tsx to /src/App.tsx
        // Original import: '../components/ui/Button' (resolves to /src/components/ui/Button)
        // Target path: /src/App.tsx -> The import should become './components/ui/Button'
        synthesizeImports(
            originAST,
            jsxNode,
            targetAST,
            '/src/pages/Home.tsx',
            '/src/App.tsx'
        )

        const code = generateCodeFromAST(targetAST)
        expect(code).toContain('Button')
        // Vite handles paths with or without .tsx, but our resolver normalizes to ./
        expect(code).toContain('./components/ui/Button')
    })
})

// ── Missing operation round-trips ─────────────────────────────────────────────

describe('applyMutationBatch — injectComponent round-trip', () => {

    it('injects a component as last child and stamps a data-flint-id', () => {
        const src = `export default function App() {
  return (
    <div data-flint-id="root-div">
      <span>existing</span>
    </div>
  )
}`
        const { code, inversions } = applyMutationBatch(src, [
            {
                op: 'injectComponent',
                targetNodeId: 'root-div',
                jsxSnippet: '<button>Click me</button>',
            },
        ])
        // The injected element must appear in the output.
        expect(code).toContain('Click me')
        // injectComponent stamps a random data-flint-id on the injected node.
        expect(code).toMatch(/data-flint-id="[a-z0-9]+"/)
        // Structural inverse: snapshot
        expect(inversions).toHaveLength(1)
        expect(inversions[0].op).toBe('restoreCode')
    })

    it('injectComponent inverse restores the pre-injection source exactly', () => {
        const src = `export default function App() {
  return (
    <div data-flint-id="root-div">
      <span>existing</span>
    </div>
  )
}`
        const { code: mutated, inversions } = applyMutationBatch(src, [
            {
                op: 'injectComponent',
                targetNodeId: 'root-div',
                jsxSnippet: '<button>Click me</button>',
            },
        ])
        // Confirm mutation was applied before testing undo.
        expect(mutated).toContain('Click me')
        // Apply inversion — must restore the original (no button).
        const restored = applyInversions(mutated, inversions)
        expect(restored).not.toContain('Click me')
        expect(restored).toContain('existing')
    })

    it('injectComponent with importSnippet prepends the import declaration', () => {
        const src = `export default function App() {
  return (
    <div data-flint-id="container">
    </div>
  )
}`
        const { code } = applyMutationBatch(src, [
            {
                op: 'injectComponent',
                targetNodeId: 'container',
                jsxSnippet: '<Badge>New</Badge>',
                importSnippet: "import { Badge } from './ui'",
            },
        ])
        expect(code).toContain('Badge')
        expect(code).toContain('./ui')
    })
})

describe('applyMutationBatch — applyTokenFix round-trip', () => {

    it('replaces the hardcoded class with the token class', () => {
        const src = `export default function App() {
  return <div className="flex bg-[#f3f3f3] p-4">content</div>
}`
        const { code, inversions } = applyMutationBatch(src, [
            {
                op: 'applyTokenFix',
                nodeId: 'div:2:9',
                hardcodedClass: 'bg-[#f3f3f3]',
                tokenClass: 'bg-surface-default',
            },
        ])
        expect(code).toContain('bg-surface-default')
        expect(code).not.toContain('bg-[#f3f3f3]')
        // Other classes must be preserved.
        expect(code).toContain('flex')
        expect(code).toContain('p-4')
        // Structural inverse
        expect(inversions).toHaveLength(1)
        expect(inversions[0].op).toBe('restoreCode')
    })

    it('applyTokenFix inverse restores the original hardcoded class', () => {
        const src = `export default function App() {
  return <div className="flex bg-[#f3f3f3] p-4">content</div>
}`
        const { code: mutated, inversions } = applyMutationBatch(src, [
            {
                op: 'applyTokenFix',
                nodeId: 'div:2:9',
                hardcodedClass: 'bg-[#f3f3f3]',
                tokenClass: 'bg-surface-default',
            },
        ])
        const restored = applyInversions(mutated, inversions)
        expect(restored).toContain('bg-[#f3f3f3]')
        expect(restored).not.toContain('bg-surface-default')
    })
})

describe('applyMutationBatch — updateTextContent round-trip', () => {

    it('updates the text content of a JSX element', () => {
        const src = `export default function App() {
  return <p data-flint-id="headline">Old text</p>
}`
        const { code, inversions } = applyMutationBatch(src, [
            { op: 'updateTextContent', nodeId: 'headline', text: 'New text' },
        ])
        expect(code).toContain('New text')
        expect(code).not.toContain('Old text')
        // Property-level inverse: captures old text value
        expect(inversions).toHaveLength(1)
        expect(inversions[0].op).toBe('updateTextContent')
        if (inversions[0].op === 'updateTextContent') {
            expect(inversions[0].text).toBe('Old text')
        }
    })

    it('updateTextContent inverse restores the original text', () => {
        const src = `export default function App() {
  return <p data-flint-id="headline">Old text</p>
}`
        const { code: mutated, inversions } = applyMutationBatch(src, [
            { op: 'updateTextContent', nodeId: 'headline', text: 'New text' },
        ])
        const restored = applyInversions(mutated, inversions)
        expect(restored).toContain('Old text')
        expect(restored).not.toContain('New text')
    })
})

// ── Adversarial inputs ────────────────────────────────────────────────────────

describe('applyMutationBatch — adversarial inputs', () => {

    // ── Nonexistent node ID ───────────────────────────────────────────────────
    // When the targeted data-flint-id is not present, the batch engine must
    // not silently corrupt the AST — it should produce unchanged output rather
    // than throwing (the internal helpers are all no-ops on miss).

    it('nonexistent node ID — updateClassName on missing id produces no change', () => {
        const src = `export default function App() {
  return <div data-flint-id="real-id" className="text-white">hello</div>
}`
        const { code, inversions } = applyMutationBatch(src, [
            { op: 'updateClassName', nodeId: 'does-not-exist', className: 'text-black' },
        ])
        // No crash; original class must be preserved
        expect(code).toContain('text-white')
        expect(code).not.toContain('text-black')
        // Inversion is still recorded (captures empty string as old class since node wasn't found)
        expect(inversions).toHaveLength(1)
    })

    it('nonexistent node ID — updateProp on missing id produces no change', () => {
        const src = `export default function App() {
  return <input data-flint-id="real-input" aria-label="original" />
}`
        const { code } = applyMutationBatch(src, [
            { op: 'updateProp', nodeId: 'ghost-node', propName: 'aria-label', value: 'replaced' },
        ])
        expect(code).toContain('"original"')
        expect(code).not.toContain('"replaced"')
    })

    it('nonexistent node ID — deleteNode on missing id is a silent no-op', () => {
        const src = `export default function App() {
  return (
    <div>
      <span data-flint-id="keep-me">stay</span>
    </div>
  )
}`
        const { code } = applyMutationBatch(src, [
            { op: 'deleteNode', nodeId: 'ghost-id' },
        ])
        // Original node must remain
        expect(code).toContain('stay')
        expect(code).toContain('keep-me')
    })

    // ── Self-move ─────────────────────────────────────────────────────────────
    // moveNode with sourceId === targetId must be a no-op (astModifier guards
    // this with an early return when sourceId === targetId).

    it('self-move (sourceId === targetId) is a no-op', () => {
        const src = `export default function App() {
  return (
    <div>
      <span className="a">A</span>
      <p className="b">B</p>
    </div>
  )
}`
        const { code } = applyMutationBatch(src, [
            { op: 'moveNode', sourceId: 'span:4:6', targetId: 'span:4:6', position: 'after' },
        ])
        // The DOM order must be unchanged — span before p
        const spanIdx = code.indexOf('"a"')
        const pIdx = code.indexOf('"b"')
        expect(spanIdx).toBeGreaterThan(-1)
        expect(pIdx).toBeGreaterThan(-1)
        expect(spanIdx).toBeLessThan(pIdx)
    })

    // ── Self-closing target for injectComponent ───────────────────────────────
    // injectComponent must not crash or corrupt when the target element is
    // self-closing (e.g. <img />). astModifier returns the original AST
    // unchanged in this case.

    it('inject into self-closing element is a silent no-op', () => {
        const src = `export default function App() {
  return (
    <div data-flint-id="container">
      <img data-flint-id="img-target" src="/logo.png" />
    </div>
  )
}`
        const { code } = applyMutationBatch(src, [
            {
                op: 'injectComponent',
                targetNodeId: 'img-target',
                jsxSnippet: '<span>should not appear</span>',
            },
        ])
        // The injected text must not be present — img is self-closing
        expect(code).not.toContain('should not appear')
        // The img must still be in the output
        expect(code).toContain('img-target')
    })

    // ── Malformed TSX ─────────────────────────────────────────────────────────
    // When the source code is not valid TSX, parseCodeToAST returns null and
    // applyMutationBatch returns the original code with an empty inversions
    // array — the Babel parse error is surfaced as a safe no-op, not a throw.

    it('malformed TSX returns original code and empty inversions (parse error is not swallowed silently — safe no-op path)', () => {
        const badCode = '<div this is not valid tsx'
        const mutations: ASTMutation[] = [
            { op: 'updateClassName', nodeId: 'div:1:0', className: 'text-red-500' },
        ]
        const { code, inversions } = applyMutationBatch(badCode, mutations)
        // Returns original source unchanged
        expect(code).toBe(badCode)
        // Empty inversions — nothing was applied
        expect(inversions).toHaveLength(0)
    })

    it('completely unparseable input returns original code unchanged', () => {
        const garbage = '!!! @#$% not code at all'
        const { code, inversions } = applyMutationBatch(garbage, [
            { op: 'deleteNode', nodeId: 'anything' },
        ])
        expect(code).toBe(garbage)
        expect(inversions).toHaveLength(0)
    })
})
