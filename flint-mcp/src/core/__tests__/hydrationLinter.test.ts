/**
 * hydrationLinter — P4 Anti-Hardcode Linter tests
 * flint-mcp/src/core/__tests__/hydrationLinter.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
    detectHydrationViolations,
    collectFigmaPlaceholders,
    isDataBindingHint,
    type FigmaNode,
} from '../hydrationLinter.js'

const wrap = (jsx: string): string =>
    `export default function Card() { return (${jsx}); }`

describe('hydrationLinter — detectHydrationViolations', () => {
    it('flags Lorem ipsum filler text as HYDRATION-001', () => {
        const source = wrap('<p>Lorem ipsum dolor sit amet, consectetur.</p>')
        const warnings = detectHydrationViolations(source)
        expect(warnings).toHaveLength(1)
        expect(warnings[0].ruleId).toBe('HYDRATION-001')
        expect(warnings[0].type).toBe('hydration')
        expect(warnings[0].severity).toBe('amber')
        expect(warnings[0].fixable).toBe(false)
    })

    it('flags "John Doe" placeholder names', () => {
        const source = wrap('<span>John Doe</span>')
        const warnings = detectHydrationViolations(source)
        expect(warnings).toHaveLength(1)
        expect(warnings[0].ruleId).toBe('HYDRATION-001')
    })

    it('flags placeholder prices like "$99.99"', () => {
        const source = wrap('<div>Total: $99.99</div>')
        const warnings = detectHydrationViolations(source)
        expect(warnings).toHaveLength(1)
        expect(warnings[0].message).toContain('HYDRATION-001')
    })

    it('does not flag dynamic JSX expressions {user.name}', () => {
        const source = `export default function Card({ user }: { user: { name: string } }) {
            return <span>{user.name}</span>;
        }`
        const warnings = detectHydrationViolations(source)
        expect(warnings).toHaveLength(0)
    })

    it('flags a Figma data-binding hint literal when it appears in JSX', () => {
        const figmaTree: FigmaNode = {
            type: 'FRAME',
            name: 'Card',
            children: [
                { type: 'TEXT', name: '#UserData.Name', characters: 'Ada Lovelace' },
            ],
        }
        const source = wrap('<h1>Ada Lovelace</h1>')
        const warnings = detectHydrationViolations(source, { figmaTree })
        expect(warnings).toHaveLength(1)
        expect(warnings[0].ruleId).toBe('HYDRATION-001')
        expect(warnings[0].message).toContain('Figma')
    })

    it('does not flag plain content with no Figma context and no matching pattern', () => {
        const source = wrap('<button>Submit order</button>')
        const warnings = detectHydrationViolations(source)
        expect(warnings).toHaveLength(0)
    })

    it('respects custom placeholder patterns', () => {
        const source = wrap('<p>TODO_CONTENT_HERE</p>')
        const noMatch = detectHydrationViolations(source)
        expect(noMatch).toHaveLength(0)

        const withPattern = detectHydrationViolations(source, {
            placeholderPatterns: [/TODO_CONTENT_HERE/],
        })
        expect(withPattern).toHaveLength(1)
        expect(withPattern[0].ruleId).toBe('HYDRATION-001')
    })

    it('returns empty array for JSX with no text content', () => {
        const source = `export default function Empty() { return <div />; }`
        const warnings = detectHydrationViolations(source)
        expect(warnings).toHaveLength(0)
    })

    it('flags placeholder text in alt / placeholder / aria-label attributes', () => {
        const source = `export default function Form() {
            return <input placeholder="example@example.com" aria-label="Jane Smith" />;
        }`
        const warnings = detectHydrationViolations(source)
        // Two attributes, each matching a different pattern.
        expect(warnings.length).toBeGreaterThanOrEqual(2)
        const ruleIds = warnings.map(w => w.ruleId)
        expect(ruleIds.every(r => r === 'HYDRATION-001')).toBe(true)
    })

    it('respects policy: HYDRATION-001 mode "off" returns no violations', () => {
        const source = wrap('<p>Lorem ipsum dolor sit amet.</p>')
        const warnings = detectHydrationViolations(source, {
            ruleModes: { 'HYDRATION-001': 'off' },
        })
        expect(warnings).toHaveLength(0)
    })

    it('downgrades severity to "advisory" when policy mode is advisory', () => {
        const source = wrap('<p>John Doe</p>')
        const warnings = detectHydrationViolations(source, {
            ruleModes: { 'HYDRATION-001': 'advisory' },
        })
        expect(warnings).toHaveLength(1)
        expect(warnings[0].severity).toBe('advisory')
    })

    it('flags "Jane Smith" placeholder name (name variant)', () => {
        const source = wrap('<span>Jane Smith</span>')
        const warnings = detectHydrationViolations(source)
        expect(warnings).toHaveLength(1)
    })

    it('flags placeholder date MM/DD/YYYY', () => {
        const source = wrap('<time>MM/DD/YYYY</time>')
        const warnings = detectHydrationViolations(source)
        expect(warnings).toHaveLength(1)
    })

    it('flags string literal wrapped in JSX expression container', () => {
        const source = wrap(`<p>{"John Doe"}</p>`)
        const warnings = detectHydrationViolations(source)
        expect(warnings).toHaveLength(1)
    })

    it('returns empty array gracefully on parse error', () => {
        const warnings = detectHydrationViolations('this is not (((( valid jsx')
        expect(warnings).toEqual([])
    })
})

describe('hydrationLinter — isDataBindingHint', () => {
    it('recognizes "#" prefix', () => {
        expect(isDataBindingHint('#UserData.Name')).toBe(true)
    })
    it('recognizes "{{...}}" mustache pattern', () => {
        expect(isDataBindingHint('{{product.price}}')).toBe(true)
    })
    it('recognizes ".value" / ".text" / ".label" suffixes', () => {
        expect(isDataBindingHint('username.value')).toBe(true)
        expect(isDataBindingHint('headline.text')).toBe(true)
        expect(isDataBindingHint('price.label')).toBe(true)
    })
    it('rejects plain layer names', () => {
        expect(isDataBindingHint('Card Title')).toBe(false)
        expect(isDataBindingHint(undefined)).toBe(false)
        expect(isDataBindingHint('')).toBe(false)
    })
})

describe('hydrationLinter — collectFigmaPlaceholders', () => {
    it('walks the Figma tree and collects data-hint literals', () => {
        const tree: FigmaNode = {
            type: 'FRAME',
            name: 'Card',
            children: [
                { type: 'TEXT', name: '#User.Name', characters: 'Ada Lovelace' },
                { type: 'TEXT', name: 'Decorative heading', characters: 'Welcome' },
                {
                    type: 'FRAME',
                    name: 'Inner',
                    children: [
                        { type: 'TEXT', name: '{{price}}', characters: '$1,234.00' },
                    ],
                },
            ],
        }
        const set = collectFigmaPlaceholders(tree)
        expect(set.has('Ada Lovelace')).toBe(true)
        expect(set.has('$1,234.00')).toBe(true)
        expect(set.has('Welcome')).toBe(false)
    })

    it('returns empty set when tree is undefined', () => {
        expect(collectFigmaPlaceholders(undefined).size).toBe(0)
    })
})
