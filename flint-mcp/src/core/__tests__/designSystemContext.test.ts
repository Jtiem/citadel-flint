/**
 * Tests for designSystemContext — flint-mcp/src/core/__tests__/designSystemContext.test.ts
 *
 * Covers:
 *  1. buildDesignSystemContext — multiple docs, missing fields, empty input
 *  2. parseDesignSystemResponse — JSON array, wrapper object, NDJSON, single doc, invalid
 *  3. filterDocsForComponent — matching, case-insensitive, no match
 *  4. Do/don't formatting
 *  5. Props table formatting
 *  6. Related components included
 *  7. Context string stays under 2000 tokens (reasonable prompt budget)
 */

import { describe, it, expect } from 'vitest'
import {
    buildDesignSystemContext,
    parseDesignSystemResponse,
    filterDocsForComponent,
    type DesignSystemDoc,
} from '../designSystemContext.js'

// ---------------------------------------------------------------------------
// Sample docs
// ---------------------------------------------------------------------------

const buttonDoc: DesignSystemDoc = {
    componentName: 'Button',
    description: 'Primary action trigger',
    usage: 'Use for primary actions. Limit to 1 primary button per section.',
    props: [
        { name: 'variant', type: 'primary|secondary|destructive', required: false, default: 'primary' },
        { name: 'size', type: 'sm|md|lg', required: false, default: 'md' },
        { name: 'disabled', type: 'boolean', required: false },
    ],
    dosDonts: [
        { type: 'do', text: 'Use short, action-oriented labels' },
        { type: 'dont', text: 'Use more than 3 words in button text' },
    ],
    examples: ['<Button variant="primary">Save</Button>'],
    relatedComponents: ['IconButton', 'LinkButton'],
}

const cardDoc: DesignSystemDoc = {
    componentName: 'Card',
    description: 'Container for related content',
    usage: 'Cards group related information. Always include a title.',
    props: [
        { name: 'title', type: 'string', required: true },
        { name: 'elevation', type: 'number', required: false, default: '1' },
    ],
    relatedComponents: ['CardHeader', 'CardContent', 'CardFooter'],
}

const minimalDoc: DesignSystemDoc = {
    componentName: 'Separator',
}

// ---------------------------------------------------------------------------
// buildDesignSystemContext
// ---------------------------------------------------------------------------

describe('buildDesignSystemContext', () => {
    it('builds context from multiple docs', () => {
        const result = buildDesignSystemContext([buttonDoc, cardDoc])

        expect(result).toContain('## Component: Button')
        expect(result).toContain('## Component: Card')
        expect(result).toContain('Primary action trigger')
        expect(result).toContain('Container for related content')
    })

    it('includes description line', () => {
        const result = buildDesignSystemContext([buttonDoc])
        expect(result).toContain('Description: Primary action trigger')
    })

    it('includes usage line', () => {
        const result = buildDesignSystemContext([buttonDoc])
        expect(result).toContain('Usage: Use for primary actions.')
    })

    it('formats props with name, type, required, and default', () => {
        const result = buildDesignSystemContext([buttonDoc])
        expect(result).toContain('Props:')
        expect(result).toContain('variant')
        expect(result).toContain('(primary|secondary|destructive)')
        expect(result).toContain('default: primary')
        expect(result).toContain('disabled')
        expect(result).toContain('(boolean)')
    })

    it('marks required props', () => {
        const result = buildDesignSystemContext([cardDoc])
        expect(result).toContain('title')
        expect(result).toContain('[required]')
    })

    it('formats do items', () => {
        const result = buildDesignSystemContext([buttonDoc])
        expect(result).toContain('Do: Use short, action-oriented labels')
    })

    it('formats dont items', () => {
        const result = buildDesignSystemContext([buttonDoc])
        expect(result).toContain("Don't: Use more than 3 words in button text")
    })

    it('includes examples', () => {
        const result = buildDesignSystemContext([buttonDoc])
        expect(result).toContain('Example: <Button variant="primary">Save</Button>')
    })

    it('includes related components', () => {
        const result = buildDesignSystemContext([buttonDoc])
        expect(result).toContain('Related: IconButton, LinkButton')
    })

    it('handles missing optional fields gracefully', () => {
        const result = buildDesignSystemContext([minimalDoc])
        expect(result).toContain('## Component: Separator')
        // Should not contain undefined or null
        expect(result).not.toContain('undefined')
        expect(result).not.toContain('null')
        // Should not contain empty lines for missing fields
        expect(result).not.toContain('Description:')
        expect(result).not.toContain('Usage:')
        expect(result).not.toContain('Props:')
    })

    it('returns empty string for empty docs array', () => {
        expect(buildDesignSystemContext([])).toBe('')
    })

    it('returns empty string for null/undefined input', () => {
        expect(buildDesignSystemContext(null as unknown as DesignSystemDoc[])).toBe('')
        expect(buildDesignSystemContext(undefined as unknown as DesignSystemDoc[])).toBe('')
    })

    it('skips docs with no componentName', () => {
        const badDoc = { componentName: '' } as DesignSystemDoc
        const result = buildDesignSystemContext([badDoc])
        expect(result).toBe('')
    })

    it('truncates examples to 2 maximum', () => {
        const manyExamples: DesignSystemDoc = {
            componentName: 'Input',
            examples: ['<Input />', '<Input type="email" />', '<Input disabled />', '<Input required />'],
        }
        const result = buildDesignSystemContext([manyExamples])
        const exampleCount = (result.match(/Example:/g) || []).length
        expect(exampleCount).toBe(2)
    })

    it('context string stays under 2000 tokens for reasonable input', () => {
        // 10 docs with all fields filled should still be reasonably sized
        const docs: DesignSystemDoc[] = Array.from({ length: 10 }, (_, i) => ({
            componentName: `Component${i}`,
            description: `Description for component ${i}`,
            usage: `Usage guidelines for component ${i}`,
            props: [
                { name: 'variant', type: 'string', required: false },
                { name: 'size', type: 'sm|md|lg', required: true },
            ],
            dosDonts: [
                { type: 'do' as const, text: `Do this for component ${i}` },
                { type: 'dont' as const, text: `Avoid this for component ${i}` },
            ],
            examples: [`<Component${i} />`, `<Component${i} variant="alt" />`],
            relatedComponents: [`Related${i}A`, `Related${i}B`],
        }))

        const result = buildDesignSystemContext(docs)
        // Rough token estimate: ~4 chars per token for English text
        const estimatedTokens = result.length / 4
        expect(estimatedTokens).toBeLessThan(2000)
    })

    it('separates multiple docs with blank lines', () => {
        const result = buildDesignSystemContext([buttonDoc, cardDoc])
        // Should have a blank line between doc sections
        expect(result).toContain('\n\n')
    })
})

// ---------------------------------------------------------------------------
// parseDesignSystemResponse
// ---------------------------------------------------------------------------

describe('parseDesignSystemResponse', () => {
    it('parses JSON array of docs', () => {
        const input = JSON.stringify([
            { componentName: 'Button', description: 'A button' },
            { componentName: 'Card', description: 'A card' },
        ])
        const result = parseDesignSystemResponse(input)
        expect(result).toHaveLength(2)
        expect(result[0].componentName).toBe('Button')
        expect(result[1].componentName).toBe('Card')
    })

    it('parses wrapper object with results key', () => {
        const input = JSON.stringify({
            results: [
                { componentName: 'Button', description: 'A button' },
            ],
        })
        const result = parseDesignSystemResponse(input)
        expect(result).toHaveLength(1)
        expect(result[0].componentName).toBe('Button')
    })

    it('parses wrapper object with components key', () => {
        const input = JSON.stringify({
            components: [
                { componentName: 'Input', usage: 'Use for text entry' },
            ],
        })
        const result = parseDesignSystemResponse(input)
        expect(result).toHaveLength(1)
        expect(result[0].componentName).toBe('Input')
    })

    it('parses wrapper object with data key', () => {
        const input = JSON.stringify({
            data: [
                { componentName: 'Badge', description: 'A status indicator' },
            ],
        })
        const result = parseDesignSystemResponse(input)
        expect(result).toHaveLength(1)
        expect(result[0].componentName).toBe('Badge')
    })

    it('parses a single doc object', () => {
        const input = JSON.stringify({ componentName: 'Alert', description: 'Notification' })
        const result = parseDesignSystemResponse(input)
        expect(result).toHaveLength(1)
        expect(result[0].componentName).toBe('Alert')
    })

    it('normalizes name field to componentName', () => {
        const input = JSON.stringify([
            { name: 'Button', description: 'A button' },
        ])
        const result = parseDesignSystemResponse(input)
        expect(result).toHaveLength(1)
        expect(result[0].componentName).toBe('Button')
    })

    it('parses newline-delimited JSON', () => {
        const input = [
            JSON.stringify({ componentName: 'Button', description: 'A button' }),
            JSON.stringify({ componentName: 'Card', description: 'A card' }),
        ].join('\n')
        const result = parseDesignSystemResponse(input)
        expect(result).toHaveLength(2)
        expect(result[0].componentName).toBe('Button')
        expect(result[1].componentName).toBe('Card')
    })

    it('returns empty array for empty string', () => {
        expect(parseDesignSystemResponse('')).toEqual([])
    })

    it('returns empty array for whitespace-only string', () => {
        expect(parseDesignSystemResponse('   \n  ')).toEqual([])
    })

    it('returns empty array for null/undefined', () => {
        expect(parseDesignSystemResponse(null as unknown as string)).toEqual([])
        expect(parseDesignSystemResponse(undefined as unknown as string)).toEqual([])
    })

    it('returns empty array for totally invalid input', () => {
        expect(parseDesignSystemResponse('not json at all')).toEqual([])
    })

    it('skips entries without componentName or name', () => {
        const input = JSON.stringify([
            { componentName: 'Button' },
            { description: 'orphan with no name' },
            { componentName: 'Card' },
        ])
        const result = parseDesignSystemResponse(input)
        expect(result).toHaveLength(2)
    })

    it('preserves dosDonts array', () => {
        const input = JSON.stringify([{
            componentName: 'Button',
            dosDonts: [
                { type: 'do', text: 'Use labels' },
                { type: 'dont', text: 'Use icons only' },
            ],
        }])
        const result = parseDesignSystemResponse(input)
        expect(result[0].dosDonts).toHaveLength(2)
        expect(result[0].dosDonts![0].type).toBe('do')
        expect(result[0].dosDonts![1].type).toBe('dont')
    })

    it('preserves props array', () => {
        const input = JSON.stringify([{
            componentName: 'Button',
            props: [
                { name: 'variant', type: 'string', required: true, default: 'primary' },
            ],
        }])
        const result = parseDesignSystemResponse(input)
        expect(result[0].props).toHaveLength(1)
        expect(result[0].props![0].name).toBe('variant')
        expect(result[0].props![0].required).toBe(true)
        expect(result[0].props![0].default).toBe('primary')
    })

    it('preserves relatedComponents array', () => {
        const input = JSON.stringify([{
            componentName: 'Button',
            relatedComponents: ['IconButton', 'LinkButton'],
        }])
        const result = parseDesignSystemResponse(input)
        expect(result[0].relatedComponents).toEqual(['IconButton', 'LinkButton'])
    })

    it('preserves examples array', () => {
        const input = JSON.stringify([{
            componentName: 'Button',
            examples: ['<Button />', '<Button variant="destructive" />'],
        }])
        const result = parseDesignSystemResponse(input)
        expect(result[0].examples).toHaveLength(2)
    })

    it('trims componentName whitespace', () => {
        const input = JSON.stringify([{ componentName: '  Button  ' }])
        const result = parseDesignSystemResponse(input)
        expect(result[0].componentName).toBe('Button')
    })

    it('handles mixed valid and invalid NDJSON lines', () => {
        const input = [
            JSON.stringify({ componentName: 'Button' }),
            'not json',
            JSON.stringify({ componentName: 'Card' }),
        ].join('\n')
        const result = parseDesignSystemResponse(input)
        expect(result).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// filterDocsForComponent
// ---------------------------------------------------------------------------

describe('filterDocsForComponent', () => {
    const allDocs: DesignSystemDoc[] = [buttonDoc, cardDoc, minimalDoc]

    it('matches exact component name', () => {
        const result = filterDocsForComponent(allDocs, 'Button')
        expect(result).toHaveLength(1)
        expect(result[0].componentName).toBe('Button')
    })

    it('matches when component name contains doc name (ContactFormButton -> Button)', () => {
        const result = filterDocsForComponent(allDocs, 'ContactFormButton')
        expect(result).toHaveLength(1)
        expect(result[0].componentName).toBe('Button')
    })

    it('matches case-insensitively', () => {
        const result = filterDocsForComponent(allDocs, 'button')
        expect(result).toHaveLength(1)
        expect(result[0].componentName).toBe('Button')
    })

    it('returns empty when no match found', () => {
        const result = filterDocsForComponent(allDocs, 'DatePicker')
        expect(result).toHaveLength(0)
    })

    it('returns empty for empty docs', () => {
        expect(filterDocsForComponent([], 'Button')).toEqual([])
    })

    it('returns empty for empty component name', () => {
        expect(filterDocsForComponent(allDocs, '')).toEqual([])
    })

    it('returns empty for null/undefined docs', () => {
        expect(filterDocsForComponent(null as unknown as DesignSystemDoc[], 'Button')).toEqual([])
    })

    it('matches when doc name contains component name (Card matches Card)', () => {
        const result = filterDocsForComponent(allDocs, 'Card')
        expect(result).toHaveLength(1)
        expect(result[0].componentName).toBe('Card')
    })

    it('can return multiple matches', () => {
        const docsWithOverlap: DesignSystemDoc[] = [
            { componentName: 'Button' },
            { componentName: 'IconButton' },
            { componentName: 'Card' },
        ]
        const result = filterDocsForComponent(docsWithOverlap, 'Button')
        expect(result).toHaveLength(2) // Button and IconButton both match
    })
})

// ---------------------------------------------------------------------------
// Integration: parse then build context
// ---------------------------------------------------------------------------

describe('integration: parse → build', () => {
    it('parses raw JSON and builds context string', () => {
        const raw = JSON.stringify([
            {
                componentName: 'Button',
                description: 'Primary action trigger',
                usage: 'Use for main actions',
                props: [{ name: 'variant', type: 'string', required: false }],
                dosDonts: [{ type: 'do', text: 'Keep labels short' }],
            },
        ])

        const docs = parseDesignSystemResponse(raw)
        const context = buildDesignSystemContext(docs)

        expect(context).toContain('## Component: Button')
        expect(context).toContain('Description: Primary action trigger')
        expect(context).toContain('Do: Keep labels short')
    })

    it('end-to-end with wrapper object format', () => {
        const raw = JSON.stringify({
            results: [
                { name: 'Input', description: 'Text input field' },
                { name: 'Select', description: 'Dropdown selector' },
            ],
        })

        const docs = parseDesignSystemResponse(raw)
        expect(docs).toHaveLength(2)

        const context = buildDesignSystemContext(docs)
        expect(context).toContain('## Component: Input')
        expect(context).toContain('## Component: Select')
    })

    it('graceful degradation: invalid input produces empty context', () => {
        const docs = parseDesignSystemResponse('totally invalid')
        const context = buildDesignSystemContext(docs)
        expect(context).toBe('')
    })
})
