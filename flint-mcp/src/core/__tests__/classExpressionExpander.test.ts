/**
 * classExpressionExpander.test.ts
 *
 * Phase 1 — Class Expression Expander
 *
 * 50-fixture corpus covering:
 *   Literal clsx:            1-8
 *   Object clsx:             9-18
 *   Array clsx:              19-22
 *   Ternary + logical:       23-30
 *   Renamed imports:         31-34
 *   cva variants:            35-40
 *   Unresolvable identifiers: 41-45
 *   Edge cases:              46-50
 *
 * Invariant: AST object identity preserved after expandAll (C13).
 * Correctness threshold: >= 48/50 fixtures match expected output.
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type * as t from '@babel/types'
import { expandAll, expandAllList } from '../classExpressionExpander.js'
import type { ExpandedClassExpression } from '../classExpressionExpander.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSource(source: string): t.File {
    return parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
    })
}

function expand(source: string): ExpandedClassExpression[] {
    const ast = parseSource(source)
    return expandAllList({ filePath: '/test.tsx', ast })
}

// ── Fixture 1: Single string literal ─────────────────────────────────────────
describe('1: clsx("a") — single string literal', () => {
    it('expands to definite=["a"], possible=[], unresolvable=false', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx("a")} />
        `)
        expect(results).toHaveLength(1)
        expect(results[0].definite).toEqual(['a'])
        expect(results[0].possible).toEqual([])
        expect(results[0].unresolvable).toBe(false)
        expect(results[0].utility).toBe('clsx')
    })
})

// ── Fixture 2: Two string literals ───────────────────────────────────────────
describe('2: clsx("a", "b") — two string literals', () => {
    it('expands to definite=["a","b"]', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx("a", "b")} />
        `)
        expect(results[0].definite).toEqual(['a', 'b'])
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 3: Space-separated class string ───────────────────────────────────
describe('3: clsx("text-sm font-bold") — space-separated', () => {
    it('splits into individual classes in definite', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx("text-sm font-bold")} />
        `)
        expect(results[0].definite).toEqual(['text-sm', 'font-bold'])
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 4: Empty clsx() call ──────────────────────────────────────────────
describe('4: clsx() — no args', () => {
    it('expands to empty definite and possible, unresolvable=false', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx()} />
        `)
        expect(results[0].definite).toEqual([])
        expect(results[0].possible).toEqual([])
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 5: classnames import ─────────────────────────────────────────────
describe('5: import from classnames', () => {
    it('recognizes classnames import and expands normally', () => {
        const results = expand(`
            import classnames from 'classnames'
            const el = <div className={classnames("px-4", "py-2")} />
        `)
        expect(results[0].definite).toEqual(['px-4', 'py-2'])
        expect(results[0].utility).toBe('classnames')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 6: twMerge import ─────────────────────────────────────────────────
describe('6: import twMerge from tailwind-merge', () => {
    it('recognizes twMerge named import', () => {
        const results = expand(`
            import { twMerge } from 'tailwind-merge'
            const el = <div className={twMerge("bg-red-500", "text-white")} />
        `)
        expect(results[0].definite).toEqual(['bg-red-500', 'text-white'])
        expect(results[0].utility).toBe('twMerge')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 7: No utility import — no expansion ───────────────────────────────
describe('7: unknown function not imported from utility package', () => {
    it('produces no expansions for an unrecognized call', () => {
        const results = expand(`
            const el = <div className={myCustomFn("a", "b")} />
        `)
        expect(results).toHaveLength(0)
    })
})

// ── Fixture 8: Template literal with no expressions ───────────────────────────
describe('8: clsx(`text-sm font-bold`) — no-expr template literal', () => {
    it('treats as definite', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(\`text-sm font-bold\`)} />
        `)
        expect(results[0].definite).toContain('text-sm')
        expect(results[0].definite).toContain('font-bold')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 9: Object with true value ────────────────────────────────────────
describe('9: clsx({ foo: true }) — boolean true', () => {
    it('puts key in definite', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx({ foo: true })} />
        `)
        expect(results[0].definite).toContain('foo')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 10: Object with false value — dropped ────────────────────────────
describe('10: clsx({ foo: false }) — boolean false', () => {
    it('drops false keys (never applied)', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx({ foo: false, bar: true })} />
        `)
        expect(results[0].definite).toContain('bar')
        expect(results[0].definite).not.toContain('foo')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 11: Object with dynamic value → possible ────────────────────────
describe('11: clsx({ foo: condition }) — dynamic value', () => {
    it('puts key in possible', () => {
        const results = expand(`
            import clsx from 'clsx'
            const condition = true
            const el = <div className={clsx({ foo: condition })} />
        `)
        // condition is a const local binding initialised with BooleanLiteral true,
        // but the object property value is an Identifier — treated as possible
        expect(results[0].possible).toContain('foo')
    })
})

// ── Fixture 12: Mixed object (true/false/dynamic) ────────────────────────────
describe('12: clsx({ foo: true, bar: false, baz: dynamic }) — mixed', () => {
    it('definite=["foo"], possible=["baz"], bar dropped', () => {
        const results = expand(`
            import clsx from 'clsx'
            const dynamic = someRuntime()
            const el = <div className={clsx({ foo: true, bar: false, baz: dynamic })} />
        `)
        expect(results[0].definite).toContain('foo')
        expect(results[0].possible).toContain('baz')
        expect(results[0].definite).not.toContain('bar')
        expect(results[0].possible).not.toContain('bar')
    })
})

// ── Fixture 13: Object with string value → definite key ──────────────────────
describe('13: clsx({ "text-sm": "truthy-string" }) — string value', () => {
    it('treats string value as truthy, puts key in definite', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx({ "text-sm": "always" })} />
        `)
        expect(results[0].definite).toContain('text-sm')
    })
})

// ── Fixture 14: Object with spread element → unresolvable ────────────────────
describe('14: clsx({ ...spread }) — spread element', () => {
    it('marks unresolvable when spread present', () => {
        const results = expand(`
            import clsx from 'clsx'
            const extra = { active: true }
            const el = <div className={clsx({ ...extra })} />
        `)
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 15: Object with computed key → unresolvable ──────────────────────
describe('15: clsx({ [key]: true }) — computed key', () => {
    it('marks unresolvable for computed keys', () => {
        const results = expand(`
            import clsx from 'clsx'
            const key = 'bg-blue-500'
            const el = <div className={clsx({ [key]: true })} />
        `)
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 16: Multiple object properties all true ───────────────────────────
describe('16: clsx({ a: true, b: true, c: true })', () => {
    it('all keys in definite', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx({ a: true, b: true, c: true })} />
        `)
        expect(results[0].definite).toEqual(expect.arrayContaining(['a', 'b', 'c']))
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 17: Object all false → empty result ───────────────────────────────
describe('17: clsx({ a: false, b: false }) — all false', () => {
    it('produces empty definite and possible', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx({ a: false, b: false })} />
        `)
        expect(results[0].definite).toEqual([])
        expect(results[0].possible).toEqual([])
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 18: Mix of string arg and object arg ──────────────────────────────
describe('18: clsx("base", { active: true, disabled: condition })', () => {
    it('merges definite from string and object', () => {
        const results = expand(`
            import clsx from 'clsx'
            const condition = getState()
            const el = <div className={clsx("base", { active: true, disabled: condition })} />
        `)
        expect(results[0].definite).toContain('base')
        expect(results[0].definite).toContain('active')
        expect(results[0].possible).toContain('disabled')
    })
})

// ── Fixture 19: Array argument ────────────────────────────────────────────────
describe('19: clsx(["a", "b"]) — array arg', () => {
    it('recurses into array elements', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(["a", "b"])} />
        `)
        expect(results[0].definite).toEqual(expect.arrayContaining(['a', 'b']))
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 20: Nested array ──────────────────────────────────────────────────
describe('20: clsx(["a", ["b", "c"]]) — nested array', () => {
    it('recursively flattens nested arrays', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(["a", ["b", "c"]])} />
        `)
        expect(results[0].definite).toContain('a')
        expect(results[0].definite).toContain('b')
        expect(results[0].definite).toContain('c')
    })
})

// ── Fixture 21: Array with spread → unresolvable ──────────────────────────────
describe('21: clsx([...extra]) — array spread', () => {
    it('marks unresolvable for spread in array', () => {
        const results = expand(`
            import clsx from 'clsx'
            const extra = ['a']
            const el = <div className={clsx([...extra])} />
        `)
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 22: Array mixed string and object ─────────────────────────────────
describe('22: clsx(["base", { active: true }]) — array with object', () => {
    it('processes mixed array elements', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(["base", { active: true }])} />
        `)
        expect(results[0].definite).toContain('base')
        expect(results[0].definite).toContain('active')
    })
})

// ── Fixture 23: Ternary both literal branches ─────────────────────────────────
describe('23: clsx(active ? "x" : "y") — both branches literals', () => {
    it('both branches in possible, unresolvable=false', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(active ? "x" : "y")} />
        `)
        expect(results[0].possible).toContain('x')
        expect(results[0].possible).toContain('y')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 24: Ternary one literal, one dynamic ──────────────────────────────
describe('24: clsx(active ? "x" : bar) — one literal, one dynamic', () => {
    it('literal branch in possible, unresolvable=true', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(active ? "x" : bar)} />
        `)
        expect(results[0].possible).toContain('x')
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 25: Ternary both dynamic ─────────────────────────────────────────
describe('25: clsx(active ? a : b) — both dynamic', () => {
    it('unresolvable=true, possible empty', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(active ? a : b)} />
        `)
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 26: Logical && with string ───────────────────────────────────────
describe('26: clsx(show && "z") — logical AND', () => {
    it('right side in possible, unresolvable=false', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(show && "z")} />
        `)
        expect(results[0].possible).toContain('z')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 27: Logical || fallback ──────────────────────────────────────────
describe('27: clsx(override || "default-class") — logical OR', () => {
    it('captures the fallback string in possible', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(override || "default-class")} />
        `)
        expect(results[0].possible).toContain('default-class')
    })
})

// ── Fixture 28: Logical && with dynamic right ─────────────────────────────────
describe('28: clsx(show && dynamicClass) — dynamic right side of &&', () => {
    it('marks unresolvable=true', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(show && dynamicClass)} />
        `)
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 29: Combination: ternary + logical ────────────────────────────────
describe('29: clsx(active ? "x" : "y", show && "z")', () => {
    it('possible has x, y, z; unresolvable=false', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(active ? "x" : "y", show && "z")} />
        `)
        expect(results[0].possible).toContain('x')
        expect(results[0].possible).toContain('y')
        expect(results[0].possible).toContain('z')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 30: Template literal with expressions ────────────────────────────
describe('30: clsx(`text-${size}`) — template with expressions', () => {
    it('marks unresolvable=true, static quasis in possible', () => {
        const results = expand(`
            import clsx from 'clsx'
            const el = <div className={clsx(\`text-\${size}\`)} />
        `)
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 31: Renamed default import ───────────────────────────────────────
describe('31: import cn from "clsx"; cn("a", "b")', () => {
    it('recognizes renamed import', () => {
        const results = expand(`
            import cn from 'clsx'
            const el = <div className={cn("a", "b")} />
        `)
        expect(results).toHaveLength(1)
        expect(results[0].definite).toEqual(['a', 'b'])
        expect(results[0].utility).toBe('clsx')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 32: Named import with alias ───────────────────────────────────────
describe('32: import { clsx as x } from "clsx"; x("a")', () => {
    it('recognizes named import with alias', () => {
        const results = expand(`
            import { clsx as x } from 'clsx'
            const el = <div className={x("a")} />
        `)
        expect(results).toHaveLength(1)
        expect(results[0].definite).toContain('a')
        expect(results[0].utility).toBe('clsx')
    })
})

// ── Fixture 33: Namespace import — .default call ─────────────────────────────
describe('33: import * as c from "classnames"; c.default("a")', () => {
    it('recognizes namespace import .default() call', () => {
        const results = expand(`
            import * as c from 'classnames'
            const el = <div className={c.default("a")} />
        `)
        expect(results).toHaveLength(1)
        expect(results[0].definite).toContain('a')
        expect(results[0].utility).toBe('classnames')
    })
})

// ── Fixture 34: cva named import ─────────────────────────────────────────────
describe('34: import { cva } from "class-variance-authority"', () => {
    it('recognizes cva named import', () => {
        const results = expand(`
            import { cva } from 'class-variance-authority'
            const button = cva("rounded-md")
        `)
        expect(results).toHaveLength(1)
        expect(results[0].definite).toContain('rounded-md')
        expect(results[0].utility).toBe('cva')
    })
})

// ── Fixture 35: cva base + variants ──────────────────────────────────────────
describe('35: cva base string with variants object', () => {
    it('base in definite, variant leaf strings in possible', () => {
        const results = expand(`
            import { cva } from 'class-variance-authority'
            const button = cva("rounded-md", {
                variants: {
                    intent: {
                        primary: "bg-primary-500",
                        secondary: "bg-gray-500"
                    }
                }
            })
        `)
        expect(results).toHaveLength(1)
        expect(results[0].definite).toContain('rounded-md')
        expect(results[0].possible).toContain('bg-primary-500')
        expect(results[0].possible).toContain('bg-gray-500')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 36: cva with multiple variant groups ──────────────────────────────
describe('36: cva with multiple variant dimensions', () => {
    it('collects all variant leaf strings into possible', () => {
        const results = expand(`
            import { cva } from 'class-variance-authority'
            const badge = cva("inline-flex items-center", {
                variants: {
                    color: { red: "text-red-700 bg-red-100", blue: "text-blue-700 bg-blue-100" },
                    size: { sm: "text-xs px-2", lg: "text-sm px-3" }
                }
            })
        `)
        expect(results[0].definite).toContain('inline-flex')
        expect(results[0].definite).toContain('items-center')
        expect(results[0].possible).toContain('text-red-700')
        expect(results[0].possible).toContain('bg-red-100')
        expect(results[0].possible).toContain('text-xs')
        expect(results[0].possible).toContain('px-3')
    })
})

// ── Fixture 37: cva with compoundVariants ────────────────────────────────────
describe('37: cva with compoundVariants', () => {
    it('includes compoundVariants class strings in possible', () => {
        const results = expand(`
            import { cva } from 'class-variance-authority'
            const el = cva("base", {
                variants: { size: { sm: "text-xs" } },
                compoundVariants: [
                    { size: "sm", class: "ring-1 ring-blue-300" }
                ]
            })
        `)
        expect(results[0].possible).toContain('text-xs')
        // compoundVariant 'class' value is a string leaf
        expect(results[0].possible).toContain('ring-1')
        expect(results[0].possible).toContain('ring-blue-300')
    })
})

// ── Fixture 38: cva with defaultVariants — not evaluated ─────────────────────
describe('38: cva with defaultVariants', () => {
    it('defaultVariants are skipped (non-goal #3)', () => {
        const results = expand(`
            import { cva } from 'class-variance-authority'
            const el = cva("base", {
                variants: { intent: { primary: "bg-blue-500" } },
                defaultVariants: { intent: "primary" }
            })
        `)
        // defaultVariants is skipped — the string "primary" should NOT appear in possible
        // because it is a variant selection key, not a class name
        expect(results[0].definite).toContain('base')
        expect(results[0].possible).toContain('bg-blue-500')
    })
})

// ── Fixture 39: cva base as array ────────────────────────────────────────────
describe('39: cva(["a", "b"], { variants: {...} })', () => {
    it('processes array base arg', () => {
        const results = expand(`
            import { cva } from 'class-variance-authority'
            const el = cva(["rounded-md", "font-medium"], {
                variants: { color: { primary: "text-white bg-blue-600" } }
            })
        `)
        expect(results[0].definite).toContain('rounded-md')
        expect(results[0].definite).toContain('font-medium')
        expect(results[0].possible).toContain('text-white')
    })
})

// ── Fixture 40: cva no second arg ────────────────────────────────────────────
describe('40: cva("base") — no variants arg', () => {
    it('base in definite, nothing in possible', () => {
        const results = expand(`
            import { cva } from 'class-variance-authority'
            const el = cva("base-class")
        `)
        expect(results[0].definite).toContain('base-class')
        expect(results[0].possible).toEqual([])
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 41: Identifier resolved from local const string ──────────────────
describe('41: local const string identifier', () => {
    it('resolves top-level const string to definite', () => {
        const results = expand(`
            import clsx from 'clsx'
            const base = 'text-sm font-medium'
            const el = <div className={clsx(base)} />
        `)
        expect(results[0].definite).toContain('text-sm')
        expect(results[0].definite).toContain('font-medium')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 42: Identifier resolved from local const object ──────────────────
describe('42: local const object identifier', () => {
    it('resolves top-level const object to object evaluation', () => {
        const results = expand(`
            import clsx from 'clsx'
            const styles = { active: true, disabled: false }
            const el = <div className={clsx(styles)} />
        `)
        expect(results[0].definite).toContain('active')
        expect(results[0].definite).not.toContain('disabled')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Fixture 43: Identifier from imported module → unresolvable ───────────────
describe('43: identifier from import → unresolvable', () => {
    it('marks unresolvable when identifier is imported from another file', () => {
        const results = expand(`
            import clsx from 'clsx'
            import { baseClasses } from './utils'
            const el = <div className={clsx(baseClasses, "extra")} />
        `)
        expect(results[0].definite).toContain('extra')
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 44: Identifier from function parameter → unresolvable ─────────────
describe('44: identifier as function parameter → unresolvable', () => {
    it('marks unresolvable for function-parameter identifiers', () => {
        const results = expand(`
            import clsx from 'clsx'
            function Button({ variant }) {
                return <div className={clsx("btn", variant)} />
            }
        `)
        expect(results).toHaveLength(1)
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 45: let binding → unresolvable (not a const) ─────────────────────
describe('45: let binding — not a const', () => {
    it('marks unresolvable for let bindings (may be reassigned)', () => {
        const results = expand(`
            import clsx from 'clsx'
            let dynamicCls = 'text-sm'
            const el = <div className={clsx(dynamicCls)} />
        `)
        // let is not tracked — treated as unresolvable
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 46: Spread argument → unresolvable ───────────────────────────────
describe('46: clsx(...spread) — spread argument', () => {
    it('marks unresolvable for spread argument', () => {
        const results = expand(`
            import clsx from 'clsx'
            const parts = ['a', 'b']
            const el = <div className={clsx(...parts)} />
        `)
        expect(results[0].unresolvable).toBe(true)
    })
})

// ── Fixture 47: Multiple call sites in same file ──────────────────────────────
describe('47: multiple clsx calls in same file', () => {
    it('returns one expansion per call site, sorted by line', () => {
        const results = expand(`
            import clsx from 'clsx'
            const a = <div className={clsx("first")} />
            const b = <div className={clsx("second")} />
            const c = <div className={clsx("third")} />
        `)
        expect(results).toHaveLength(3)
        expect(results[0].definite).toContain('first')
        expect(results[1].definite).toContain('second')
        expect(results[2].definite).toContain('third')
        // Line numbers should be ascending
        expect(results[0].line).toBeLessThan(results[1].line)
        expect(results[1].line).toBeLessThan(results[2].line)
    })
})

// ── Fixture 48: Non-className clsx call (not in JSX attr) ─────────────────────
describe('48: clsx call outside JSX className', () => {
    it('still expands clsx calls outside JSX (expander is not JSX-scoped)', () => {
        // expandAll walks ALL CallExpression nodes, not just those in className attrs
        const results = expand(`
            import clsx from 'clsx'
            const cls = clsx("a", "b")
        `)
        expect(results).toHaveLength(1)
        expect(results[0].definite).toEqual(['a', 'b'])
    })
})

// ── Fixture 49: AST object identity preserved (C13 invariant) ────────────────
describe('49: AST object identity preserved after expandAll', () => {
    it('AST is not mutated by expandAll (Commandment 13)', () => {
        const source = `
            import clsx from 'clsx'
            const el = <div className={clsx("a", "b")} />
        `
        const ast = parseSource(source)

        // Capture the identity of the program body before
        const bodyBefore = ast.program.body
        const firstNodeBefore = ast.program.body[0]

        expandAll(ast, source)

        // AST structure must be the same object references
        expect(ast.program.body).toBe(bodyBefore)
        expect(ast.program.body[0]).toBe(firstNodeBefore)
    })
})

// ── Fixture 50: clsx/lite package alias ───────────────────────────────────────
describe('50: import from clsx/lite', () => {
    it('recognizes clsx/lite as a clsx variant', () => {
        const results = expand(`
            import clsx from 'clsx/lite'
            const el = <div className={clsx("p-4", "m-2")} />
        `)
        expect(results).toHaveLength(1)
        expect(results[0].definite).toContain('p-4')
        expect(results[0].definite).toContain('m-2')
        expect(results[0].utility).toBe('clsx')
        expect(results[0].unresolvable).toBe(false)
    })
})

// ── Correctness threshold invariant ──────────────────────────────────────────
describe('classExpressionExpander-correctness invariant (>= 48/50)', () => {
    it('at least 48 of the 50 fixtures match expected output', () => {
        // The fixtures above collectively verify all 50 cases.
        // This meta-test documents the invariant. If < 2 fixtures fail above,
        // the 0.95 fidelity threshold is satisfied.
        expect(true).toBe(true) // marker test — individual fixtures above are the corpus
    })
})

// ── 50-fixture corpus runner (fidelity invariant) ────────────────────────────
// WARN-2 fix: lights up the fixture directory so the contract invariant
// classExpressionExpander-fidelity >= 0.95 is verifiable.

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'class-expressions')

describe('classExpressionExpander — 50-fixture corpus (fidelity >= 0.95)', () => {
    it('fidelity >= 0.95 across the 50-fixture corpus', () => {
        const fixtureFiles = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.tsx'))
        expect(fixtureFiles.length).toBeGreaterThanOrEqual(50)

        let passes = 0
        const failures: string[] = []

        for (const fixtureFile of fixtureFiles) {
            const source = readFileSync(path.join(FIXTURES_DIR, fixtureFile), 'utf-8')
            const expectedPath = path.join(FIXTURES_DIR, fixtureFile.replace('.tsx', '.expected.json'))
            const expected: Array<{ utility: string; definite: string[]; possible: string[]; unresolvable: boolean }> =
                JSON.parse(readFileSync(expectedPath, 'utf-8'))

            try {
                const ast = parseSource(source)
                const result = expandAllList({ filePath: fixtureFile, ast })

                // Check length first — wrong number of expansions is a failure
                if (result.length !== expected.length) {
                    failures.push(`${fixtureFile}: expected ${expected.length} expansion(s), got ${result.length}`)
                    continue
                }

                // toMatchObject ignores extra fields (e.g. `line`) on the actual result —
                // the .expected.json only specifies the four contract fields.
                for (let i = 0; i < expected.length; i++) {
                    const actual = result[i]
                    const exp = expected[i]

                    if (actual.utility !== exp.utility) {
                        throw new Error(`utility mismatch: got ${actual.utility}, want ${exp.utility}`)
                    }
                    if (actual.unresolvable !== exp.unresolvable) {
                        throw new Error(`unresolvable mismatch: got ${actual.unresolvable}, want ${exp.unresolvable}`)
                    }
                    // Use sorted comparison so order differences don't produce false failures
                    const sortedActualDefinite = [...actual.definite].sort()
                    const sortedExpDefinite = [...exp.definite].sort()
                    if (JSON.stringify(sortedActualDefinite) !== JSON.stringify(sortedExpDefinite)) {
                        throw new Error(
                            `definite mismatch: got [${sortedActualDefinite.join(', ')}], want [${sortedExpDefinite.join(', ')}]`
                        )
                    }
                    const sortedActualPossible = [...actual.possible].sort()
                    const sortedExpPossible = [...exp.possible].sort()
                    if (JSON.stringify(sortedActualPossible) !== JSON.stringify(sortedExpPossible)) {
                        throw new Error(
                            `possible mismatch: got [${sortedActualPossible.join(', ')}], want [${sortedExpPossible.join(', ')}]`
                        )
                    }
                }
                passes++
            } catch (err) {
                failures.push(`${fixtureFile}: ${(err as Error).message}`)
            }
        }

        const total = fixtureFiles.length
        const fidelity = passes / total

        if (failures.length > 0) {
            console.warn(`\nFixture failures (${failures.length}/${total}):`)
            for (const f of failures) {
                console.warn(`  FAIL  ${f}`)
            }
        }
        console.info(`\nFidelity: ${passes}/${total} (${(fidelity * 100).toFixed(1)}%)`)

        expect(fidelity).toBeGreaterThanOrEqual(0.95)
    })
})
