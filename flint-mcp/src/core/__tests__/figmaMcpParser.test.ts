import { describe, it, expect } from 'vitest'
import { classifyDataName, parseFigmaMcpResponse, enrichFigmaNodes } from '../figmaMcpParser.js'

describe('classifyDataName', () => {
    it('maps exact data-name values', () => {
        expect(classifyDataName('Input')).toBe('input')
        expect(classifyDataName('Select')).toBe('select')
        expect(classifyDataName('Textarea')).toBe('textarea')
        expect(classifyDataName('Button')).toBe('button')
        expect(classifyDataName('Card')).toBe('card')
        expect(classifyDataName('Avatar')).toBe('avatar')
        expect(classifyDataName('Badge')).toBe('badge')
        expect(classifyDataName('Separator')).toBe('separator')
        expect(classifyDataName('Tabs')).toBe('tabs')
        expect(classifyDataName('Label')).toBe('label')
        expect(classifyDataName('Checkbox')).toBe('checkbox')
        expect(classifyDataName('Switch')).toBe('switch')
    })

    it('matches case-insensitively', () => {
        expect(classifyDataName('INPUT')).toBe('input')
        expect(classifyDataName('button')).toBe('button')
        expect(classifyDataName('CARD')).toBe('card')
    })

    it('matches substrings', () => {
        expect(classifyDataName('Testimonial Card')).toBe('card')
        expect(classifyDataName('Primary Button')).toBe('button')
        expect(classifyDataName('.Tab Item')).toBe('tabs')
        expect(classifyDataName('Email Input')).toBe('input')
    })

    it('returns null for decorative/structural names', () => {
        expect(classifyDataName('Icon')).toBeNull()
        expect(classifyDataName('Vector')).toBeNull()
        expect(classifyDataName('Shape')).toBeNull()
        expect(classifyDataName('Frame')).toBeNull()
        expect(classifyDataName('Group')).toBeNull()
    })

    it('returns null for unknown names', () => {
        expect(classifyDataName('Something Random')).toBeNull()
        expect(classifyDataName('Container')).toBeNull()
    })

    it('prefers textarea over input for ambiguous names', () => {
        expect(classifyDataName('TextArea Field')).toBe('textarea')
    })
})

describe('parseFigmaMcpResponse', () => {
    it('extracts data-name and data-node-id pairs', () => {
        const jsx = `<div data-name="Input" data-node-id="4007:2629"><p>test</p></div>`
        const hints = parseFigmaMcpResponse(jsx)
        expect(hints.size).toBe(1)
        expect(hints.get('4007:2629')).toEqual({ dataName: 'Input', componentType: 'input' })
    })

    it('handles data-name before data-node-id', () => {
        const jsx = `<div data-node-id="123:456" data-name="Button">Click</div>`
        const hints = parseFigmaMcpResponse(jsx)
        expect(hints.get('123:456')?.componentType).toBe('button')
    })

    it('parses multiple elements', () => {
        const jsx = `
            <div data-name="Card" data-node-id="1:1">
                <div data-name="Input" data-node-id="2:2">
                    <div data-name="Label" data-node-id="3:3"><p>Name</p></div>
                </div>
                <div data-name="Button" data-node-id="4:4">Submit</div>
            </div>
        `
        const hints = parseFigmaMcpResponse(jsx)
        expect(hints.size).toBe(4)
        expect(hints.get('1:1')?.componentType).toBe('card')
        expect(hints.get('2:2')?.componentType).toBe('input')
        expect(hints.get('3:3')?.componentType).toBe('label')
        expect(hints.get('4:4')?.componentType).toBe('button')
    })

    it('handles Figma instance IDs with I prefix', () => {
        const jsx = `<div data-name="Input" data-node-id="I4007:2629;180:667">text</div>`
        const hints = parseFigmaMcpResponse(jsx)
        expect(hints.get('I4007:2629;180:667')?.componentType).toBe('input')
    })

    it('returns empty map for empty input', () => {
        expect(parseFigmaMcpResponse('').size).toBe(0)
        expect(parseFigmaMcpResponse('no tags here').size).toBe(0)
    })

    it('handles elements without data-name', () => {
        const jsx = `<div data-node-id="1:1" className="flex">content</div>`
        const hints = parseFigmaMcpResponse(jsx)
        expect(hints.size).toBe(0)
    })

    it('parses real Figma MCP output', () => {
        const realOutput = `
            <div data-name="Input" data-node-id="4007:2629">
                <div data-name="Label" data-node-id="I4007:2629;180:666">
                    <p>Display Name</p>
                </div>
                <div data-name="Input" data-node-id="I4007:2629;180:667">
                    <p>Justin Tiemann</p>
                </div>
            </div>
            <div data-name="Textarea" data-node-id="4007:2630">
                <p>Bio</p>
            </div>
            <div data-name="Select" data-node-id="4007:2627">
                <p>Timezone</p>
            </div>
        `
        const hints = parseFigmaMcpResponse(realOutput)
        expect(hints.get('4007:2629')?.componentType).toBe('input')
        expect(hints.get('4007:2630')?.componentType).toBe('textarea')
        expect(hints.get('4007:2627')?.componentType).toBe('select')
    })
})

describe('enrichFigmaNodes', () => {
    it('sets componentType on matching nodes', () => {
        const hints = new Map([
            ['1:1', { dataName: 'Input', componentType: 'input' }],
            ['2:2', { dataName: 'Button', componentType: 'button' }],
        ])
        const nodes = [
            { id: '1:1', name: 'Frame 847', type: 'FRAME', children: [] },
            { id: '2:2', name: 'Frame 123', type: 'FRAME', children: [] },
        ]
        enrichFigmaNodes(nodes, hints)
        expect(nodes[0].componentType).toBe('input')
        expect(nodes[1].componentType).toBe('button')
    })

    it('enriches nested children', () => {
        const hints = new Map([
            ['2:2', { dataName: 'Badge', componentType: 'badge' }],
        ])
        const nodes = [
            {
                id: '1:1', name: 'Parent', type: 'FRAME',
                children: [
                    { id: '2:2', name: 'Frame 99', type: 'FRAME', children: [] },
                ],
            },
        ]
        enrichFigmaNodes(nodes as any, hints)
        expect((nodes[0].children![0] as any).componentType).toBe('badge')
    })

    it('does not set componentType when hint has null type', () => {
        const hints = new Map([
            ['1:1', { dataName: 'Icon', componentType: null as unknown as string }],
        ])
        const nodes = [{ id: '1:1', name: 'Star', type: 'FRAME', children: [] }]
        enrichFigmaNodes(nodes, hints)
        expect((nodes[0] as any).componentType).toBeUndefined()
    })

    it('matches instance IDs by base ID', () => {
        const hints = new Map([
            ['4007:2629', { dataName: 'Input', componentType: 'input' }],
        ])
        // Node has the base ID matching the hint
        const nodes = [
            { id: '4007:2629', name: 'Email', type: 'FRAME', children: [] },
        ]
        enrichFigmaNodes(nodes, hints)
        expect((nodes[0] as any).componentType).toBe('input')
    })
})
