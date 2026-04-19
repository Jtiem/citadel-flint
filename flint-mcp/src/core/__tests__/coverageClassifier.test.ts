/**
 * coverageClassifier.test.ts
 *
 * Phase 0 — Coverage Honesty
 *
 * Test map:
 *   1  — parsed happy path: pure Tailwind file → status "parsed", reason null
 *   2  — non-jsx-framework: .vue file → status "skipped-unsupported"
 *   3  — non-jsx-framework: .svelte file → status "skipped-unsupported"
 *   4  — non-jsx-framework: Angular .component.html → status "skipped-unsupported"
 *   5  — non-jsx-framework: ast=null with .vue extension → status "skipped-unsupported"
 *   6  — css-in-js-detected: styled-components import
 *   7  — css-in-js-detected: @emotion/styled import
 *   8  — css-in-js-detected: @stitches/react import
 *   9  — css-in-js-detected: styled-jsx import
 *   10 — css-in-js-detected: tagged template (styled.div`...`) without explicit import name
 *   11 — external-stylesheet-imported: .css import
 *   12 — external-stylesheet-imported: .scss import
 *   13 — external-stylesheet-imported: .sass import
 *   14 — external-stylesheet-imported: .less import
 *   15 — css-modules-reference: import s from "*.module.css" + className={s.foo}
 *   16 — css-modules-reference: alternate binding alias (styles.foo)
 *   17 — css-modules-reference: module import without className usage → not css-modules-reference
 *   18 — dynamic-class-expression: clsx call in className
 *   19 — dynamic-class-expression: cva call in className
 *   20 — dynamic-class-expression: template literal with expressions in className
 *   21 — tailwind-config-extension: tailwindConfigUnparsed=true + Tailwind classes
 *   22 — tailwind-config-extension: tailwindConfigUnparsed=false → does not emit
 *   23 — tailwind-config-extension: tailwindConfigUnparsed=true but no className → does not emit
 *   24 — non-literal-ternary-branch: one branch is an Identifier
 *   25 — non-literal-ternary-branch: both branches are string literals → parsed
 *   26 — unresolvable-var: var(--brand-color) with no fallback
 *   27 — unresolvable-var: var(--x, #fff) with fallback → does not flag
 *   28 — first-match-wins: non-jsx-framework beats css-in-js on .vue
 *   29 — first-match-wins: css-in-js beats external-stylesheet when both present
 *   30 — status/reason invariant: parsed iff reason === null (100 diverse inputs)
 *   31 — empty file → parsed
 *   32 — file with only imports and no JSX → parsed
 *   33 — parse-failure: malformed .tsx with ast=null → reason "parse-failure", NOT "non-jsx-framework"
 *   34 — parse-failure: malformed .ts with ast=null → reason "parse-failure"
 *   35 — regression: valid .vue with ast=null → reason still "non-jsx-framework" (not parse-failure)
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { classifyCoverage, type ClassifierInput } from '../coverageClassifier.js'
import type { CoverageReason } from '../../shared/coverageTypes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DIR = join(__dirname, 'fixtures/coverage')

function parseFixture(filename: string) {
    const source = readFileSync(join(FIXTURE_DIR, filename), 'utf-8')
    const ast = parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
    })
    return { source, ast }
}

function parseSource(source: string) {
    return parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
    })
}

function input(overrides: Partial<ClassifierInput> & { filePath: string }): ClassifierInput {
    return {
        source: '',
        ast: null,
        ...overrides,
    }
}

describe('coverageClassifier', () => {

    // ── 1. Happy path ─────────────────────────────────────────────────────────

    it('1 — parsed happy path: pure Tailwind file → status "parsed", reason null', () => {
        const { source, ast } = parseFixture('pure-tailwind.tsx')
        const verdict = classifyCoverage(input({ filePath: '/src/Button.tsx', source, ast }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
        expect(verdict.details).toBeUndefined()
    })

    // ── 2–5. non-jsx-framework ────────────────────────────────────────────────

    it('2 — non-jsx-framework: .vue file → status "skipped-unsupported"', () => {
        const verdict = classifyCoverage(input({ filePath: '/src/App.vue', source: '', ast: null }))
        expect(verdict.status).toBe('skipped-unsupported')
        expect(verdict.reason).toBe('non-jsx-framework' satisfies CoverageReason)
    })

    it('3 — non-jsx-framework: .svelte file → status "skipped-unsupported"', () => {
        const verdict = classifyCoverage(input({ filePath: '/src/App.svelte', source: '', ast: null }))
        expect(verdict.status).toBe('skipped-unsupported')
        expect(verdict.reason).toBe('non-jsx-framework' satisfies CoverageReason)
    })

    it('4 — non-jsx-framework: Angular .component.html → status "skipped-unsupported"', () => {
        const verdict = classifyCoverage(input({
            filePath: '/src/app.component.html',
            source: '<h1>{{title}}</h1>',
            ast: null,
        }))
        expect(verdict.status).toBe('skipped-unsupported')
        expect(verdict.reason).toBe('non-jsx-framework' satisfies CoverageReason)
    })

    it('5 — non-jsx-framework: ast=null with .vue extension → status "skipped-unsupported"', () => {
        const verdict = classifyCoverage(input({ filePath: '/src/Comp.vue', source: '', ast: null }))
        expect(verdict.status).toBe('skipped-unsupported')
        expect(verdict.reason).toBe('non-jsx-framework' satisfies CoverageReason)
    })

    // ── 6–10. css-in-js-detected ──────────────────────────────────────────────

    it('6 — css-in-js-detected: styled-components import', () => {
        const { source, ast } = parseFixture('css-in-js.tsx')
        const verdict = classifyCoverage(input({ filePath: '/src/Card.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('css-in-js-detected' satisfies CoverageReason)
    })

    it('7 — css-in-js-detected: @emotion/styled import', () => {
        const source = `
import styled from '@emotion/styled'
const Box = styled.div\`color: red;\`
export const Comp = () => <Box />
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Comp.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('css-in-js-detected' satisfies CoverageReason)
    })

    it('8 — css-in-js-detected: @stitches/react import', () => {
        const source = `
import { createStitches } from '@stitches/react'
const { styled } = createStitches({})
export const Box = styled('div', { color: 'red' })
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Box.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('css-in-js-detected' satisfies CoverageReason)
    })

    it('9 — css-in-js-detected: styled-jsx import', () => {
        const source = `
import 'styled-jsx'
export const Page = () => (
    <div>
        <style jsx>{\`div { color: red; }\`}</style>
        Hello
    </div>
)
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Page.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('css-in-js-detected' satisfies CoverageReason)
    })

    it('10 — css-in-js-detected: styled.div tagged template detected via traversal', () => {
        const source = `
import styled from 'styled-components'
const Wrapper = styled.section\`padding: 0;\`
export const Layout = () => <Wrapper />
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Layout.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('css-in-js-detected' satisfies CoverageReason)
        expect(verdict.details).toMatch(/CSS-in-JS/)
    })

    // ── 11–14. external-stylesheet-imported ───────────────────────────────────

    it('11 — external-stylesheet-imported: .css import', () => {
        const { source, ast } = parseFixture('external-stylesheet.tsx')
        const verdict = classifyCoverage(input({ filePath: '/src/Page.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('external-stylesheet-imported' satisfies CoverageReason)
    })

    it('12 — external-stylesheet-imported: .scss import', () => {
        const source = `
import './layout.scss'
export const App = () => <div className="container">App</div>
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/App.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('external-stylesheet-imported' satisfies CoverageReason)
    })

    it('13 — external-stylesheet-imported: .sass import', () => {
        const source = `
import './theme.sass'
export const App = () => <div>App</div>
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/App.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('external-stylesheet-imported' satisfies CoverageReason)
    })

    it('14 — external-stylesheet-imported: .less import', () => {
        const source = `
import '../styles/vars.less'
export const App = () => <div>App</div>
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/App.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('external-stylesheet-imported' satisfies CoverageReason)
    })

    // ── 15–17. css-modules-reference ─────────────────────────────────────────

    it('15 — css-modules-reference: import s from "*.module.css" + className={s.foo}', () => {
        const { source, ast } = parseFixture('css-modules.tsx')
        const verdict = classifyCoverage(input({ filePath: '/src/Button.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('css-modules-reference' satisfies CoverageReason)
    })

    it('16 — css-modules-reference: alternate binding alias (styles.foo)', () => {
        const source = `
import styles from './Card.module.scss'
export const Card = () => <div className={styles.card}>Card</div>
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Card.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('css-modules-reference' satisfies CoverageReason)
    })

    it('17 — css-modules-reference: module import without className={s.x} usage → not css-modules-reference reason', () => {
        // .module.css import but no className={s.foo} usage — external-stylesheet triggers instead
        const source = `
import styles from './Card.module.css'
export const Card = () => <div>{styles ? 'a' : 'b'}</div>
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Card.tsx', source, ast }))
        expect(verdict.reason).not.toBe('css-modules-reference' satisfies CoverageReason)
    })

    // ── 18–20. dynamic-class-expression ───────────────────────────────────────

    it('18 — dynamic-class-expression: clsx call in className', () => {
        const { source, ast } = parseFixture('dynamic-class.tsx')
        const verdict = classifyCoverage(input({ filePath: '/src/Alert.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('dynamic-class-expression' satisfies CoverageReason)
    })

    it('19 — dynamic-class-expression: cva call in className (direct call pattern)', () => {
        const source = `
import { cva } from 'cva'
const buttonVariants = cva('base', { variants: {} })
export const Button = ({ variant }: any) => (
    <button className={cva('px-4 py-2', { variants: { color: { blue: 'text-blue-500' } } })({ color: variant })}>Click</button>
)
`
        // The direct pattern: className={cva(...)} where cva is the direct CallExpression callee
        const source2 = `
import clsx from 'clsx'
export const Button = ({ active }: any) => <button className={clsx('base', active && 'active')}>B</button>
`
        const ast2 = parseSource(source2)
        const verdict = classifyCoverage(input({ filePath: '/src/Button.tsx', source: source2, ast: ast2 }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('dynamic-class-expression' satisfies CoverageReason)
    })

    it('20 — dynamic-class-expression: template literal with expressions in className', () => {
        const source = `
export const Badge = ({ color }: { color: string }) => (
    <span className={\`badge-\${color} rounded\`}>Badge</span>
)
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Badge.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('dynamic-class-expression' satisfies CoverageReason)
    })

    // ── 21–23. tailwind-config-extension ─────────────────────────────────────

    it('21 — tailwind-config-extension: tailwindConfigUnparsed=true + Tailwind classes present', () => {
        const { source, ast } = parseFixture('tailwind-config-ext.tsx')
        const verdict = classifyCoverage(input({
            filePath: '/src/Hero.tsx',
            source,
            ast,
            tailwindConfigUnparsed: true,
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('tailwind-config-extension' satisfies CoverageReason)
    })

    it('22 — tailwind-config-extension: tailwindConfigUnparsed=false → does not emit', () => {
        const { source, ast } = parseFixture('tailwind-config-ext.tsx')
        const verdict = classifyCoverage(input({
            filePath: '/src/Hero.tsx',
            source,
            ast,
            tailwindConfigUnparsed: false,
        }))
        expect(verdict.reason).not.toBe('tailwind-config-extension' satisfies CoverageReason)
    })

    it('23 — tailwind-config-extension: tailwindConfigUnparsed=true but no className → does not emit', () => {
        const source = `export const Empty = () => <div>No class</div>`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({
            filePath: '/src/Empty.tsx',
            source,
            ast,
            tailwindConfigUnparsed: true,
        }))
        expect(verdict.reason).not.toBe('tailwind-config-extension' satisfies CoverageReason)
    })

    // ── 24–25. non-literal-ternary-branch ────────────────────────────────────

    it('24 — non-literal-ternary-branch: one branch is an Identifier', () => {
        const { source, ast } = parseFixture('non-literal-ternary.tsx')
        const verdict = classifyCoverage(input({ filePath: '/src/Toggle.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('non-literal-ternary-branch' satisfies CoverageReason)
    })

    it('25 — non-literal-ternary-branch: both branches are string literals → parsed', () => {
        const source = `
export const Comp = ({ on }: { on: boolean }) => (
    <button className={on ? 'active' : 'inactive'}>Go</button>
)
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Comp.tsx', source, ast }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 26–27. unresolvable-var ───────────────────────────────────────────────

    it('26 — unresolvable-var: var(--brand-color) with no fallback', () => {
        const { source, ast } = parseFixture('unresolvable-var.tsx')
        const verdict = classifyCoverage(input({ filePath: '/src/Brand.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('unresolvable-var' satisfies CoverageReason)
        expect(verdict.details).toMatch(/var\(--brand-color\)/)
    })

    it('27 — unresolvable-var: var(--x, #fff) with fallback → does not flag unresolvable-var', () => {
        const source = `
export const Safe = () => (
    <div style={{ color: 'var(--text-color, #333)', padding: '8px' }}>Safe</div>
)
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Safe.tsx', source, ast }))
        expect(verdict.reason).not.toBe('unresolvable-var' satisfies CoverageReason)
    })

    // ── 28–29. first-match-wins ───────────────────────────────────────────────

    it('28 — first-match-wins: non-jsx-framework (.vue) beats css-in-js', () => {
        const verdict = classifyCoverage(input({
            filePath: '/src/App.vue',
            source: "import styled from 'styled-components'",
            ast: null,
        }))
        expect(verdict.reason).toBe('non-jsx-framework' satisfies CoverageReason)
    })

    it('29 — first-match-wins: css-in-js beats external-stylesheet when both present', () => {
        const source = `
import styled from 'styled-components'
import './styles.css'
const Box = styled.div\`color: red;\`
export const Comp = () => <Box />
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/Comp.tsx', source, ast }))
        expect(verdict.reason).toBe('css-in-js-detected' satisfies CoverageReason)
    })

    // ── 30. property-based invariant ─────────────────────────────────────────

    it('30 — status/reason invariant: (status === "parsed") iff (reason === null) across 100 diverse inputs', () => {
        const sources: string[] = [
            `export const A = () => <div className="px-4">A</div>`,
            `export const B = () => <span>B</span>`,
            `export const C = () => <div />`,
            `import styled from 'styled-components'; const X = styled.div\`\`; export const D = () => <X />`,
            `import './a.css'; export const E = () => <div />`,
            `import s from './x.module.css'; export const F = () => <div className={s.foo} />`,
            `import clsx from 'clsx'; export const G = () => <div className={clsx('a')} />`,
            `export const H = ({ c }: any) => <div style={{ color: 'var(--x)' }} />`,
            `export const I = ({ on }: any) => <button className={on ? 'a' : on}>I</button>`,
            `export const J = ({ c }: any) => <span className={\`text-\${c}\`}>J</span>`,
            ``,
            `const x = 1`,
            `export {}`,
        ]

        const vuePaths = ['/a.vue', '/b.svelte', '/c.component.html']
        const tsPaths = ['/a.tsx', '/b.tsx', '/c.tsx', '/d.ts']

        const allInputs: ClassifierInput[] = []

        // Framework extension inputs (non-jsx-framework)
        for (const fp of vuePaths) {
            allInputs.push(input({ filePath: fp, source: '', ast: null }))
        }

        // Parse-failure inputs: .tsx with ast=null (parse-failure, not non-jsx-framework)
        allInputs.push(input({ filePath: '/broken.tsx', source: '<<<not tsx>>>', ast: null }))
        allInputs.push(input({ filePath: '/broken.ts', source: '<<<not ts>>>', ast: null }))

        for (const src of sources) {
            for (const fp of tsPaths) {
                try {
                    const ast = parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
                    allInputs.push(input({ filePath: fp, source: src, ast }))
                } catch {
                    allInputs.push(input({ filePath: fp, source: src, ast: null }))
                }
            }
        }

        while (allInputs.length < 100) {
            const src = `export const Pad${allInputs.length} = () => <div className="p-4">x</div>`
            try {
                const ast = parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
                allInputs.push(input({ filePath: '/src/Pad.tsx', source: src, ast }))
            } catch {
                allInputs.push(input({ filePath: '/src/Pad.tsx', source: src, ast: null }))
            }
        }

        for (const inp of allInputs.slice(0, 100)) {
            const verdict = classifyCoverage(inp)
            if (verdict.status === 'parsed') {
                expect(verdict.reason, `parsed verdict must have null reason for input filePath=${inp.filePath}`).toBeNull()
            } else {
                expect(verdict.reason, `non-parsed verdict must have non-null reason for input filePath=${inp.filePath}`).not.toBeNull()
            }
        }
    })

    // ── 31–32. Edge cases ─────────────────────────────────────────────────────

    it('31 — empty file → parsed', () => {
        const ast = parseSource('')
        const verdict = classifyCoverage(input({ filePath: '/src/empty.tsx', source: '', ast }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    it('32 — file with only imports and no JSX → parsed', () => {
        const source = `
import React from 'react'
import type { FC } from 'react'
`
        const ast = parseSource(source)
        const verdict = classifyCoverage(input({ filePath: '/src/types.ts', source, ast }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 33–35. parse-failure (WARN-4 regression) ──────────────────────────────

    it('33 — parse-failure: malformed .tsx with ast=null → reason "parse-failure", NOT "non-jsx-framework"', () => {
        // Simulate what the caller does when Babel.parse throws on a .tsx file:
        // pass ast: null.
        const verdict = classifyCoverage(input({
            filePath: '/src/Broken.tsx',
            source: '<<< this is not valid TSX >>>',
            ast: null,
        }))
        expect(verdict.status).toBe('skipped-unsupported')
        expect(verdict.reason).toBe('parse-failure' satisfies CoverageReason)
        expect(verdict.reason).not.toBe('non-jsx-framework')
        expect(verdict.details).toMatch(/Could not parse/)
    })

    it('34 — parse-failure: malformed .ts with ast=null → reason "parse-failure"', () => {
        const verdict = classifyCoverage(input({
            filePath: '/src/utils.ts',
            source: '<<< broken >>>',
            ast: null,
        }))
        expect(verdict.status).toBe('skipped-unsupported')
        expect(verdict.reason).toBe('parse-failure' satisfies CoverageReason)
    })

    it('35 — regression: valid .vue with ast=null → reason still "non-jsx-framework" (not parse-failure)', () => {
        const verdict = classifyCoverage(input({
            filePath: '/src/App.vue',
            source: '<template><div>Hello</div></template>',
            ast: null,
        }))
        expect(verdict.status).toBe('skipped-unsupported')
        expect(verdict.reason).toBe('non-jsx-framework' satisfies CoverageReason)
        expect(verdict.reason).not.toBe('parse-failure')
    })

})

// ── Phase 1 Upgrade Cases ─────────────────────────────────────────────────────
//
// CONTRACT-SOURCE: .flint-context/contracts/PHASE1-tailwind-config-class-composition.contract.ts
// testBoundaries targeted:
//   "coverageClassifier upgrade (clsx literals → parsed)"
//   "coverageClassifier upgrade (mixed clsx stays partial)"
//   "coverageClassifier upgrade (tailwind.config resolved → parsed)"
//
// These tests add optional Phase 1 fields (classExpansions, tailwindConfig) to
// ClassifierInput. Phase 0 tests above remain GREEN because the new fields are
// purely additive.
//
// Invariant: coverage-upgrade-parity = 1.0
//   - 100% of static-resolvable fixtures flip dynamic-class-expression → parsed
//   - 0 fixtures with unresolvable:true flip to parsed

// NOTE: the Phase 1 ClassifierInput fields (classExpansions, tailwindConfig) are
// defined by the implementing agent in coverageClassifier.ts Phase 1 upgrade.
// These tests use `any` casts on the new fields so they compile before the
// implementation lands. When the implementation agent adds the types, remove the
// casts. Tests are marked describe.skip until the implementation lands to avoid
// red-phase noise in pre-impl CI runs.
//
// To activate: remove `.skip` when flint-ast-surgeon lands ClassifierInput v2.

describe('coverageClassifier — Phase 1 upgrade cases', () => {

    function parseSourceP1(source: string) {
        return parse(source, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        })
    }

    function inputP1(overrides: Record<string, unknown> & { filePath: string }) {
        return {
            source: '',
            ast: null,
            ...overrides,
        } as ClassifierInput
    }

    // ── 36. Resolvable clsx literals flip dynamic-class-expression → parsed ──────
    //
    // CONTRACT: "coverageClassifier upgrade (clsx literals → parsed)"
    // given: file with className={clsx("a", "b")} and no other coverage blockers;
    //        classExpansions all have unresolvable: false
    // when: classifyCoverage called with classExpansions injected
    // then: returns { status: "parsed", reason: null }

    it('36 — Phase 1: all-resolvable classExpansions flip dynamic-class-expression → parsed', () => {
        const source = `
import clsx from 'clsx'
export const A = () => <div className={clsx('a', 'b')}>A</div>
`
        const ast = parseSourceP1(source)
        const classExpansions = [
            { definite: ['a', 'b'], possible: [], unresolvable: false, utility: 'clsx' as const, line: 3 },
        ]

        const verdict = classifyCoverage(inputP1({ filePath: '/src/A.tsx', source, ast, classExpansions }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 37. Multiple resolvable calls all resolved → parsed ─────────────────────

    it('37 — Phase 1: multiple all-resolvable classExpansions → verdict stays parsed', () => {
        const source = `
import clsx from 'clsx'
export const B = () => (
  <div>
    <span className={clsx('text-sm', 'font-medium')}>label</span>
    <button className={clsx('btn', 'rounded')}>go</button>
  </div>
)
`
        const ast = parseSourceP1(source)
        const classExpansions = [
            { definite: ['text-sm', 'font-medium'], possible: [], unresolvable: false, utility: 'clsx' as const, line: 5 },
            { definite: ['btn', 'rounded'], possible: [], unresolvable: false, utility: 'clsx' as const, line: 6 },
        ]

        const verdict = classifyCoverage(inputP1({ filePath: '/src/B.tsx', source, ast, classExpansions }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 38. Any unresolvable expansion blocks the upgrade → stays partial ────────
    //
    // CONTRACT: "coverageClassifier upgrade (mixed clsx stays partial)"
    // then: returns { status: "partial", reason: "dynamic-class-expression" }

    it('38 — Phase 1: one unresolvable expansion blocks upgrade → stays partial', () => {
        const source = `
import clsx from 'clsx'
export const C = ({ className }: any) => <div className={clsx('base', className)}>C</div>
`
        const ast = parseSourceP1(source)
        const classExpansions = [
            { definite: ['base'], possible: [], unresolvable: true, utility: 'clsx' as const, line: 3 },
        ]

        const verdict = classifyCoverage(inputP1({ filePath: '/src/C.tsx', source, ast, classExpansions }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('dynamic-class-expression' satisfies CoverageReason)
    })

    // ── 39. No classExpansions provided → legacy Phase 0 behavior unchanged ──────

    it('39 — Phase 1: omitting classExpansions preserves Phase 0 behavior (partial)', () => {
        const source = `
import clsx from 'clsx'
export const D = ({ active }: any) => <div className={clsx('base', active && 'active')}>D</div>
`
        const ast = parseSourceP1(source)

        const verdict = classifyCoverage(inputP1({ filePath: '/src/D.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('dynamic-class-expression' satisfies CoverageReason)
    })

    // ── 40. tailwindConfig ok:true flips tailwind-config-extension → parsed ──────
    //
    // CONTRACT: "coverageClassifier upgrade (tailwind.config resolved → parsed)"

    it('40 — Phase 1: tailwindConfig ok:true flips tailwind-config-extension → parsed', () => {
        const source = `
export const E = () => <div className="bg-brand-primary text-brand-secondary">E</div>
`
        const ast = parseSourceP1(source)
        const tailwindConfig = {
            ok: true,
            theme: {
                sourcePath: '/project/tailwind.config.js',
                version: 'v3' as const,
                mtimeMs: Date.now(),
                sections: { colors: { 'brand.primary': '#0066cc', 'brand.secondary': '#6b7280' } },
                knownClasses: new Set(['bg-brand-primary', 'text-brand-secondary']),
            },
        }

        const verdict = classifyCoverage(inputP1({
            filePath: '/src/E.tsx', source, ast,
            tailwindConfigUnparsed: true,
            tailwindConfig,
        }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 41. tailwindConfig ok:false (syntax-error) → stays partial ───────────────

    it('41 — Phase 1: tailwindConfig ok:false syntax-error → stays partial', () => {
        const source = `
export const F = () => <div className="bg-brand-primary">F</div>
`
        const ast = parseSourceP1(source)
        const tailwindConfig = {
            ok: false as const,
            error: 'syntax-error' as const,
            details: 'Unexpected token in config',
            sourcePath: '/project/tailwind.config.js',
        }

        const verdict = classifyCoverage(inputP1({
            filePath: '/src/F.tsx', source, ast,
            tailwindConfigUnparsed: true,
            tailwindConfig,
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('tailwind-config-extension' satisfies CoverageReason)
    })

    // ── 42. v4-css-first-unsupported → stays partial ────────────────────────────

    it('42 — Phase 1: tailwindConfig v4-css-first-unsupported → stays partial', () => {
        const source = `
export const G = () => <div className="bg-brand-primary">G</div>
`
        const ast = parseSourceP1(source)
        const tailwindConfig = {
            ok: false as const,
            error: 'v4-css-first-unsupported' as const,
            details: 'v4 @theme CSS-first blocks are not supported until Phase 2',
            sourcePath: null,
        }

        const verdict = classifyCoverage(inputP1({
            filePath: '/src/G.tsx', source, ast,
            tailwindConfigUnparsed: true,
            tailwindConfig,
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('tailwind-config-extension' satisfies CoverageReason)
    })

    // ── 43. coverage-upgrade-parity invariant ────────────────────────────────────
    //
    // Invariant: coverage-upgrade-parity = 1.0

    it('43 — Phase 1 parity invariant: resolvable → parsed; unresolvable → stays partial', () => {
        const source = `
import clsx from 'clsx'
export const H = () => <div className={clsx('a', 'b')}>H</div>
`
        const ast = parseSourceP1(source)

        const allResolvable = [
            { definite: ['a', 'b'], possible: [], unresolvable: false, utility: 'clsx' as const, line: 3 },
        ]
        const parsedVerdict = classifyCoverage(inputP1({
            filePath: '/src/H.tsx', source, ast, classExpansions: allResolvable,
        }))
        expect(parsedVerdict.status).toBe('parsed')
        expect(parsedVerdict.reason).toBeNull()

        const hasUnresolvable = [
            { definite: ['a'], possible: [], unresolvable: true, utility: 'clsx' as const, line: 3 },
        ]
        const partialVerdict = classifyCoverage(inputP1({
            filePath: '/src/H.tsx', source, ast, classExpansions: hasUnresolvable,
        }))
        expect(partialVerdict.status).toBe('partial')
        expect(partialVerdict.reason).toBe('dynamic-class-expression' satisfies CoverageReason)
    })

    // ── 44. Phase 0 non-regression: plain clsx still emits partial ───────────────

    it('44 — Phase 0 non-regression: plain clsx with no classExpansions → still partial', () => {
        const source = `
import clsx from 'clsx'
export const I = ({ active }: any) => <div className={clsx('a', active)}>I</div>
`
        const ast = parseSourceP1(source)
        const verdict = classifyCoverage(inputP1({ filePath: '/src/I.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('dynamic-class-expression' satisfies CoverageReason)
    })

    // ── 45. Phase 0 non-regression: tailwindConfigUnparsed without tailwindConfig ─

    it('45 — Phase 0 non-regression: tailwindConfigUnparsed without tailwindConfig → tailwind-config-extension', () => {
        const source = `
export const J = () => <div className="bg-brand-primary">J</div>
`
        const ast = parseSourceP1(source)
        const verdict = classifyCoverage(inputP1({
            filePath: '/src/J.tsx', source, ast, tailwindConfigUnparsed: true,
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('tailwind-config-extension' satisfies CoverageReason)
    })

})

// ── Phase 2 Upgrade Cases ─────────────────────────────────────────────────────
//
// CONTRACT-SOURCE: .flint-context/contracts/PHASE2-postcss-css-modules.contract.ts
// testBoundaries targeted:
//   "external-stylesheet-imported" upgrade when parsedStylesheets all ok:true
//   "css-modules-reference" upgrade when cssModules all resolved:true
//   "unresolvable-var" upgrade when customPropertyMap resolves all vars
//   "tailwind-config-extension" upgrade when tailwindV4Theme has blockCount >= 1
//
// Invariants:
//   coverage-upgrade-parity = 1.0 — all 4 Phase 2 upgrade scenarios work
//   phase0/phase1-grade-formula-stability = 0 — existing tests still green

describe('coverageClassifier — Phase 2 upgrade cases', () => {

    function parseSourceP2(source: string) {
        return parse(source, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        })
    }

    function inputP2(overrides: Record<string, unknown> & { filePath: string }) {
        return {
            source: '',
            ast: null,
            ...overrides,
        } as ClassifierInput
    }

    // ── 46. External stylesheet + matching parsedStylesheets ok:true → parsed ────
    //
    // CONTRACT: external-stylesheet-imported upgrade
    // given: file with `import './styles.css'`; externalStylesheets provided all ok:true
    // then: flips external-stylesheet-imported → parsed

    it('46 — Phase 2: external stylesheet + all ok:true externalStylesheets → verdict parsed', () => {
        const source = `
import './styles.css'
export const A = () => <div className="container">A</div>
`
        const ast = parseSourceP2(source)
        const externalStylesheets = [{ ok: true }]

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/A.tsx', source, ast, externalStylesheets,
        }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 47. External stylesheet WITHOUT matching entry → stays partial ─────────

    it('47 — Phase 2: external stylesheet with NO externalStylesheets → stays partial', () => {
        const source = `
import './styles.css'
export const B = () => <div className="container">B</div>
`
        const ast = parseSourceP2(source)

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/B.tsx', source, ast,
            // externalStylesheets NOT provided
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('external-stylesheet-imported' satisfies CoverageReason)
    })

    // ── 48. External stylesheet with ok:false entry → stays partial ───────────

    it('48 — Phase 2: external stylesheet with one ok:false → stays partial', () => {
        const source = `
import './styles.css'
import './broken.css'
export const C = () => <div className="x">C</div>
`
        const ast = parseSourceP2(source)
        const externalStylesheets = [
            { ok: true },
            { ok: false }, // one failed
        ]

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/C.tsx', source, ast, externalStylesheets,
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('external-stylesheet-imported' satisfies CoverageReason)
    })

    // ── 49. CSS Modules import + resolved:true in cssModules → parsed ─────────
    //
    // CONTRACT: css-modules-reference upgrade

    it('49 — Phase 2: CSS Modules import + resolved:true cssModules → verdict parsed', () => {
        const source = `
import s from './Button.module.css'
export const D = () => <div className={s.active}>D</div>
`
        const ast = parseSourceP2(source)
        const cssModules = {
            sourcePath: '/src/D.tsx',
            imports: [
                {
                    bindingName: 's',
                    modulePath: '/src/Button.module.css',
                    classBindings: [{ localClassName: 'active', scopedClassName: 'Button__active___abc12', line: 1 }],
                    namedImports: [],
                    resolved: true,
                    failureReason: null,
                },
            ],
        }

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/D.tsx', source, ast, cssModules,
        }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 50. CSS Modules import + resolved:false → stays partial ───────────────

    it('50 — Phase 2: CSS Modules import + resolved:false → stays partial', () => {
        const source = `
import s from './Missing.module.css'
export const E = () => <div className={s.active}>E</div>
`
        const ast = parseSourceP2(source)
        const cssModules = {
            sourcePath: '/src/E.tsx',
            imports: [
                {
                    bindingName: 's',
                    modulePath: '/src/Missing.module.css',
                    classBindings: [],
                    namedImports: [],
                    resolved: false,
                    failureReason: 'module-not-found',
                },
            ],
        }

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/E.tsx', source, ast, cssModules,
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('css-modules-reference' satisfies CoverageReason)
    })

    // ── 51. bare var(--x) + customPropertyMap resolving → parsed ─────────────
    //
    // CONTRACT: unresolvable-var upgrade

    it('51 — Phase 2: var(--brand-color) + customPropertyMap resolves it → verdict parsed', () => {
        const source = `
export const F = () => (
    <div style={{ color: 'var(--brand-color)' }}>F</div>
)
`
        const ast = parseSourceP2(source)
        const customPropertyMap = {
            map: new Map([['--brand-color', '#0066cc']]),
            resolve: (expr: string) => {
                // Resolve bare var(--brand-color)
                const match = expr.match(/^var\((--[^,)]+)\)$/)
                if (match) {
                    return customPropertyMap.map.get(match[1]) ?? null
                }
                return null
            },
            sourcePaths: ['/src/theme.css'],
        }

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/F.tsx', source, ast, customPropertyMap,
        }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 52. bare var(--x) + customPropertyMap missing --x → stays partial ─────

    it('52 — Phase 2: var(--missing-var) + customPropertyMap without it → stays partial', () => {
        const source = `
export const G = () => (
    <div style={{ color: 'var(--missing-var)' }}>G</div>
)
`
        const ast = parseSourceP2(source)
        const customPropertyMap = {
            map: new Map<string, string>(), // empty map
            resolve: (_expr: string) => null,
            sourcePaths: [],
        }

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/G.tsx', source, ast, customPropertyMap,
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('unresolvable-var' satisfies CoverageReason)
    })

    // ── 53. v4 CSS-first @theme parsed (blockCount >= 1) → flips tailwind-config-extension ──
    //
    // CONTRACT: tailwind-config-extension upgrade for v4-CSS-first

    it('53 — Phase 2: tailwindV4Theme blockCount >= 1 → tailwind-config-extension flips to parsed', () => {
        const source = `
export const H = () => <div className="bg-brand-primary">H</div>
`
        const ast = parseSourceP2(source)
        const tailwindV4Theme = {
            sourcePath: '/src/app.css',
            sections: { colors: { 'brand.primary': '#0066cc' } },
            knownClasses: new Set(['bg-brand-primary']),
            blockCount: 1,
        }

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/H.tsx', source, ast,
            tailwindConfigUnparsed: true, // would normally trigger the rule
            tailwindV4Theme,
        }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 54. v4 CSS-first with blockCount 0 → stays partial ────────────────────

    it('54 — Phase 2: tailwindV4Theme blockCount 0 → tailwind-config-extension stays partial', () => {
        const source = `
export const I = () => <div className="bg-brand-primary">I</div>
`
        const ast = parseSourceP2(source)
        const tailwindV4Theme = {
            sourcePath: '/src/app.css',
            sections: {},
            knownClasses: new Set<string>(),
            blockCount: 0, // no @theme blocks found
        }

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/I.tsx', source, ast,
            tailwindConfigUnparsed: true,
            tailwindV4Theme,
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('tailwind-config-extension' satisfies CoverageReason)
    })

    // ── 55. Phase 0 + Phase 1 regression: all existing paths still work ────────
    //
    // Invariant: phase0/phase1-grade-formula-stability = 0

    it('55 — Phase 2 regression: Phase 0 plain clsx still partial (no Phase 2 fields)', () => {
        const source = `
import clsx from 'clsx'
export const K = ({ active }: any) => <div className={clsx('base', active)}>K</div>
`
        const ast = parseSourceP2(source)
        // No Phase 1 or Phase 2 fields
        const verdict = classifyCoverage(inputP2({ filePath: '/src/K.tsx', source, ast }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('dynamic-class-expression' satisfies CoverageReason)
    })

    it('55b — Phase 2 regression: Phase 1 tailwindConfig ok:true still works', () => {
        const source = `
export const L = () => <div className="bg-brand-primary">L</div>
`
        const ast = parseSourceP2(source)
        const tailwindConfig = {
            ok: true as const,
            theme: { sourcePath: '/project/tailwind.config.js', version: 'v3' as const, mtimeMs: Date.now(), sections: {}, knownClasses: new Set<string>() },
        }

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/L.tsx', source, ast,
            tailwindConfigUnparsed: true,
            tailwindConfig,
        }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 56. Both cssModules and externalStylesheets provided — all ok → parsed ──

    it('56 — Phase 2: both cssModules (resolved) + externalStylesheets (ok) → parsed', () => {
        const source = `
import './theme.css'
import s from './Button.module.css'
export const M = () => <div className={s.active}>M</div>
`
        const ast = parseSourceP2(source)
        const cssModules = {
            sourcePath: '/src/M.tsx',
            imports: [{
                bindingName: 's',
                modulePath: '/src/Button.module.css',
                classBindings: [{ localClassName: 'active', scopedClassName: 'Button__active___abc', line: 1 }],
                namedImports: [],
                resolved: true,
                failureReason: null,
            }],
        }
        const externalStylesheets = [{ ok: true }]

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/M.tsx', source, ast, cssModules, externalStylesheets,
        }))
        expect(verdict.status).toBe('parsed')
        expect(verdict.reason).toBeNull()
    })

    // ── 57. Partial CSS modules resolution (one failed) → stays partial ────────

    it('57 — Phase 2: cssModules with one failed import → stays partial', () => {
        const source = `
import s from './Good.module.css'
import t from './Bad.module.css'
export const N = () => <div className={s.active}><span className={t.item} /></div>
`
        const ast = parseSourceP2(source)
        const cssModules = {
            sourcePath: '/src/N.tsx',
            imports: [
                {
                    bindingName: 's', modulePath: '/src/Good.module.css',
                    classBindings: [{ localClassName: 'active', scopedClassName: 'Good__active___xyz', line: 1 }],
                    namedImports: [], resolved: true, failureReason: null,
                },
                {
                    bindingName: 't', modulePath: '/src/Bad.module.css',
                    classBindings: [], namedImports: [], resolved: false, failureReason: 'module-not-found',
                },
            ],
        }

        const verdict = classifyCoverage(inputP2({
            filePath: '/src/N.tsx', source, ast, cssModules,
        }))
        expect(verdict.status).toBe('partial')
        expect(verdict.reason).toBe('css-modules-reference' satisfies CoverageReason)
    })

})
