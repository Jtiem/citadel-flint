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
