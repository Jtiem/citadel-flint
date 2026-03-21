import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import _generate from '@babel/generator'
const generate = typeof (_generate as any).default === 'function' ? (_generate as any).default : _generate

import { emitImport, emitHook, emitHandler, emitCallback, emitConditional, emitMap, composeSlot } from '../ast-modifier.js'

function parseFixture(source: string) {
    return parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
}
function gen(ast: any): string { return generate(ast).code }

// ── CATALOG.1: emitImport ─────────────────────────────────────────────────

describe('emitImport', () => {
    it('adds a new import to a file with no imports', () => {
        const ast = parseFixture('const x = 1;')
        emitImport(ast, "import { useState } from 'react'")
        expect(gen(ast)).toContain("import { useState } from 'react'")
    })

    it('adds below existing imports', () => {
        const ast = parseFixture("import React from 'react';\nconst x = 1;")
        emitImport(ast, "import { motion } from 'framer-motion'")
        const code = gen(ast)
        expect(code.indexOf('framer-motion')).toBeGreaterThan(code.indexOf('react'))
    })

    it('merges specifiers when source already imported', () => {
        const ast = parseFixture("import { useState } from 'react';")
        emitImport(ast, "import { useEffect } from 'react'")
        const code = gen(ast)
        expect(code).toContain('useState')
        expect(code).toContain('useEffect')
        expect((code.match(/from 'react'/g) || []).length).toBe(1)
    })

    it('does not duplicate existing specifiers', () => {
        const ast = parseFixture("import { useState } from 'react';")
        emitImport(ast, "import { useState } from 'react'")
        expect((gen(ast).match(/useState/g) || []).length).toBe(1)
    })

    it('handles default imports', () => {
        const ast = parseFixture('const x = 1;')
        emitImport(ast, "import React from 'react'")
        expect(gen(ast)).toContain("import React from 'react'")
    })
})

// ── CATALOG.1: emitHook ───────────────────────────────────────────────────

describe('emitHook', () => {
    it('injects useState at top of function component', () => {
        const ast = parseFixture('function MyComponent() {\n  return <div>Hello</div>;\n}')
        emitHook(ast, 'MyComponent', 'const [count, setCount] = useState(0)')
        const code = gen(ast)
        expect(code).toContain('useState(0)')
        expect(code.indexOf('useState')).toBeLessThan(code.indexOf('return'))
    })

    it('respects position: first', () => {
        const ast = parseFixture("function MyComponent() {\n  const [name, setName] = useState('');\n  return <div/>;\n}")
        emitHook(ast, 'MyComponent', 'const [count, setCount] = useState(0)', 'first')
        const code = gen(ast)
        expect(code.indexOf('useState(0)')).toBeLessThan(code.indexOf("useState('')"))
    })

    it('respects position: last (default)', () => {
        const ast = parseFixture("function MyComponent() {\n  const [name, setName] = useState('');\n  return <div/>;\n}")
        emitHook(ast, 'MyComponent', 'const [count, setCount] = useState(0)', 'last')
        const code = gen(ast)
        expect(code.indexOf("useState('')")).toBeLessThan(code.indexOf('useState(0)'))
    })

    it('handles arrow function components', () => {
        const ast = parseFixture('const MyComponent = () => {\n  return <div>Hello</div>;\n};')
        emitHook(ast, 'MyComponent', 'const [open, setOpen] = useState(false)')
        expect(gen(ast)).toContain('useState(false)')
    })

    it('handles exported function components', () => {
        const ast = parseFixture('export default function MyComponent() {\n  return <div/>;\n}')
        emitHook(ast, 'MyComponent', 'const ref = useRef(null)')
        expect(gen(ast)).toContain('useRef(null)')
    })

    it('throws for non-existent component', () => {
        const ast = parseFixture('function Other() { return <div/>; }')
        expect(() => emitHook(ast, 'Missing', 'const x = useState(0)')).toThrow()
    })
})

// ── CATALOG.1: emitHandler ────────────────────────────────────────────────

describe('emitHandler', () => {
    it('injects handler before return', () => {
        const ast = parseFixture('function MyComponent() {\n  return <div/>;\n}')
        emitHandler(ast, 'MyComponent', 'const handleClick = () => { console.log("clicked") }')
        const code = gen(ast)
        expect(code).toContain('handleClick')
        expect(code.indexOf('handleClick')).toBeLessThan(code.indexOf('return'))
    })

    it('injects after hooks', () => {
        const ast = parseFixture("function MyComponent() {\n  const [count, setCount] = useState(0);\n  return <button/>;\n}")
        emitHandler(ast, 'MyComponent', 'const handleClick = () => { setCount(c => c + 1) }')
        const code = gen(ast)
        expect(code.indexOf('useState')).toBeLessThan(code.indexOf('handleClick'))
        expect(code.indexOf('handleClick')).toBeLessThan(code.indexOf('return'))
    })

    it('handles multiple handler injections', () => {
        const ast = parseFixture('function MyComponent() {\n  return <div/>;\n}')
        emitHandler(ast, 'MyComponent', 'const handleA = () => {}')
        emitHandler(ast, 'MyComponent', 'const handleB = () => {}')
        const code = gen(ast)
        expect(code).toContain('handleA')
        expect(code).toContain('handleB')
    })

    it('throws for non-existent component', () => {
        const ast = parseFixture('function Other() { return <div/>; }')
        expect(() => emitHandler(ast, 'Missing', 'const h = () => {}')).toThrow()
    })
})

// ── CATALOG.1: emitCallback ──────────────────────────────────────────────

describe('emitCallback', () => {
    it('wires a simple identifier: onClick={handleClick}', () => {
        const ast = parseFixture('<button data-flint-id="btn1">Click</button>')
        emitCallback(ast, 'btn1', 'onClick', 'handleClick')
        expect(gen(ast)).toContain('onClick={handleClick}')
    })

    it('wires an inline arrow expression', () => {
        const ast = parseFixture('<input data-flint-id="inp1" />')
        emitCallback(ast, 'inp1', 'onChange', '(e) => setName(e.target.value)')
        const code = gen(ast)
        expect(code).toContain('onChange=')
        expect(code).toContain('setName')
    })

    it('replaces existing event prop', () => {
        const ast = parseFixture('<button data-flint-id="btn3" onClick={old}>Click</button>')
        emitCallback(ast, 'btn3', 'onClick', 'handleNew')
        const code = gen(ast)
        expect(code).toContain('handleNew')
        expect(code).not.toContain('{old}')
    })

    it('throws for non-existent flint ID', () => {
        const ast = parseFixture('<button data-flint-id="btn1">Click</button>')
        expect(() => emitCallback(ast, 'missing', 'onClick', 'fn')).toThrow()
    })

    it('preserves other props (Commandment 7)', () => {
        const ast = parseFixture('<button data-flint-id="btn4" className="primary" disabled>Click</button>')
        emitCallback(ast, 'btn4', 'onClick', 'handleClick')
        const code = gen(ast)
        expect(code).toContain('className="primary"')
        expect(code).toContain('disabled')
        expect(code).toContain('onClick={handleClick}')
        expect(code).toContain('data-flint-id="btn4"')
    })
})

// ── CATALOG.2: emitConditional ───────────────────────────────────────────

describe('emitConditional', () => {
    it('wraps element in AND guard', () => {
        const ast = parseFixture('<div><span data-flint-id="s1">Hello</span></div>')
        emitConditional(ast, 's1', 'isOpen', 'and')
        const code = gen(ast)
        expect(code).toContain('isOpen &&')
    })

    it('wraps element in ternary', () => {
        const ast = parseFixture('<div><span data-flint-id="s1">Hello</span></div>')
        emitConditional(ast, 's1', 'isOpen', 'ternary', '<p>Closed</p>')
        const code = gen(ast)
        expect(code).toContain('isOpen ?')
    })

    it('throws for missing node', () => {
        const ast = parseFixture('<div><span data-flint-id="s1">Hello</span></div>')
        expect(() => emitConditional(ast, 'missing', 'x', 'and')).toThrow()
    })
})

// ── CATALOG.2: emitMap ───────────────────────────────────────────────────

describe('emitMap', () => {
    it('wraps element in array.map()', () => {
        const ast = parseFixture('<ul><li data-flint-id="tpl">Item</li></ul>')
        emitMap(ast, 'tpl', 'items', 'item', 'item.id')
        const code = gen(ast)
        expect(code).toContain('.map(')
        expect(code).toContain('key={item.id}')
    })

    it('rejects index as key (Commandment 3)', () => {
        const ast = parseFixture('<ul><li data-flint-id="tpl">Item</li></ul>')
        expect(() => emitMap(ast, 'tpl', 'items', 'item', 'index')).toThrow('Commandment 3')
    })

    it('throws for missing node', () => {
        const ast = parseFixture('<ul><li data-flint-id="tpl">Item</li></ul>')
        expect(() => emitMap(ast, 'missing', 'items', 'item', 'item.id')).toThrow()
    })
})

// ── CATALOG.3: composeSlot ───────────────────────────────────────────────

describe('composeSlot', () => {
    it('creates a new slot when it does not exist', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"><Dialog.Body>Hello</Dialog.Body></Dialog>')
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<h2>Title</h2>')
        const code = gen(ast)
        expect(code).toContain('Dialog.Header')
        expect(code).toContain('Title')
    })

    it('appends children to existing slot', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"><Dialog.Header><h2>Old</h2></Dialog.Header></Dialog>')
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<p>Subtitle</p>')
        const code = gen(ast)
        expect(code).toContain('Old')
        expect(code).toContain('Subtitle')
    })

    it('throws for non-existent parent', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"></Dialog>')
        expect(() => composeSlot(ast, 'missing', 'Dialog.Header', '<h2>X</h2>')).toThrow()
    })

    it('throws for invalid slot name', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"></Dialog>')
        expect(() => composeSlot(ast, 'dlg1', 'NoSlot', '<h2>X</h2>')).toThrow()
    })
})

// ── Integration ──────────────────────────────────────────────────────────

describe('Integration: hook → handler → callback chain', () => {
    it('builds an interactive counter', () => {
        const source = 'function Counter() {\n  return <button data-flint-id="counter-btn">0</button>;\n}'
        const ast = parseFixture(source)
        emitHook(ast, 'Counter', 'const [count, setCount] = useState(0)')
        emitHandler(ast, 'Counter', 'const increment = () => setCount(c => c + 1)')
        emitCallback(ast, 'counter-btn', 'onClick', 'increment')
        const code = gen(ast)
        expect(code).toContain('useState(0)')
        expect(code).toContain('increment')
        expect(code).toContain('onClick={increment}')
        expect(code.indexOf('useState')).toBeLessThan(code.indexOf('increment ='))
        expect(code.indexOf('increment =')).toBeLessThan(code.indexOf('return'))
    })

    it('emitImport + emitHook together', () => {
        const ast = parseFixture('function App() {\n  return <div>Hello</div>;\n}')
        emitImport(ast, "import { useState } from 'react'")
        emitHook(ast, 'App', 'const [x, setX] = useState(0)')
        const code = gen(ast)
        expect(code).toContain("import { useState } from 'react'")
        expect(code).toContain('useState(0)')
        expect(code.indexOf('import')).toBeLessThan(code.indexOf('function App'))
    })
})
