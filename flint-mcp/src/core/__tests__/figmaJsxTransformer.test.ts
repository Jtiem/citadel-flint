/**
 * figmaJsxTransformer unit tests — D2C.6
 *
 * Tests the Babel AST transformer that converts Figma MCP JSX into
 * library-specific components with token mapping and artifact cleanup.
 */

import { describe, it, expect } from 'vitest'
import { transformFigmaJsx, type TransformOptions } from '../figmaJsxTransformer.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TOKENS = [
    { name: 'colors.primary', value: '#2563eb', type: 'color' },
    { name: 'colors.foreground', value: '#09090b', type: 'color' },
    { name: 'colors.muted', value: '#71717a', type: 'color' },
    { name: 'colors.background', value: '#ffffff', type: 'color' },
    { name: 'colors.border', value: '#e4e4e7', type: 'color' },
    { name: 'colors.destructive', value: '#ef4444', type: 'color' },
    { name: 'spacing.md', value: '16px', type: 'dimension' },
]

function shadcnOpts(tokens = TOKENS): TransformOptions {
    return { library: 'shadcn', tokens }
}

function muiOpts(tokens = TOKENS): TransformOptions {
    return { library: 'mui', tokens }
}

function primengOpts(tokens = TOKENS): TransformOptions {
    return { library: 'primeng', tokens }
}

function tailwindOpts(tokens = TOKENS): TransformOptions {
    return { library: 'tailwind', tokens }
}

// ---------------------------------------------------------------------------
// Real Figma MCP fixture (from the spec)
// ---------------------------------------------------------------------------

const FIGMA_INPUT_JSX = `<div data-name="Input" data-node-id="4007:2629">
  <div data-name="Label" data-node-id="I4007:2629;180:666">
    <p className="font-['Inter:Medium',sans-serif] font-medium leading-[20px] text-[14px] text-[color:var(--foreground/default,#09090b)]">Display Name</p>
  </div>
  <div className="bg-[var(--background/default,white)] border border-[var(--border/default,#e4e4e7)]" data-name="Input" data-node-id="I4007:2629;180:667">
    <p className="font-['Inter:Medium',sans-serif] font-medium text-[14px] text-[color:var(--foreground/muted,#71717a)]">Justin Tiemann</p>
  </div>
</div>`

const FIGMA_BUTTON_JSX = `<div data-name="Button" data-node-id="100:200">
  <span>Submit</span>
</div>`

const FIGMA_CARD_JSX = `<div data-name="Card" data-node-id="200:300">
  <div data-name="Card Header" data-node-id="200:301">
    <h2>Title</h2>
  </div>
  <p>Card body content</p>
</div>`

const FIGMA_SELECT_JSX = `<div data-name="Select" data-node-id="300:400">
  <span>Choose option</span>
</div>`

const FIGMA_AVATAR_JSX = `<div data-name="Avatar" data-node-id="400:500">
  <span>JT</span>
</div>`

const FIGMA_BADGE_JSX = `<div data-name="Badge" data-node-id="500:600">
  <span>New</span>
</div>`

const FIGMA_SEPARATOR_JSX = `<div data-name="Separator" data-node-id="600:700" />`

const FIGMA_TABS_JSX = `<div data-name="Tabs" data-node-id="700:800">
  <div data-name=".Tab Item" data-node-id="700:801">
    <span>Overview</span>
  </div>
  <div data-name=".Tab Item" data-node-id="700:802">
    <span>Settings</span>
  </div>
</div>`

const FIGMA_LABEL_JSX = `<div data-name="Label" data-node-id="800:900">
  <span>Email Address</span>
</div>`

const FIGMA_TEXTAREA_JSX = `<div data-name="Textarea" data-node-id="900:1000">
  <span>Enter description...</span>
</div>`

// ---------------------------------------------------------------------------
// 1. shadcn transforms
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — shadcn', () => {
    it('transforms Input with Label', () => {
        const result = transformFigmaJsx(FIGMA_INPUT_JSX, shadcnOpts())
        expect(result.componentCount).toBeGreaterThanOrEqual(2) // Label + inner Input
        expect(result.code).toContain('Input')
        expect(result.code).toContain('Label')
        expect(result.transformations.length).toBeGreaterThan(0)
    })

    it('transforms Button', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, shadcnOpts())
        expect(result.code).toContain('<Button>')
        expect(result.code).toContain('Submit')
        expect(result.componentCount).toBeGreaterThanOrEqual(1)
        expect(result.imports.some(i => i.includes('@/components/ui/button'))).toBe(true)
    })

    it('transforms Card with CardContent wrapper', () => {
        const result = transformFigmaJsx(FIGMA_CARD_JSX, shadcnOpts())
        expect(result.code).toContain('Card')
        expect(result.code).toContain('CardContent')
        expect(result.imports.some(i => i.includes('@/components/ui/card'))).toBe(true)
    })

    it('transforms Select into compound structure', () => {
        const result = transformFigmaJsx(FIGMA_SELECT_JSX, shadcnOpts())
        expect(result.code).toContain('Select')
        expect(result.code).toContain('SelectTrigger')
        expect(result.code).toContain('SelectValue')
        expect(result.code).toContain('SelectContent')
        expect(result.code).toContain('SelectItem')
        expect(result.imports.some(i => i.includes('@/components/ui/select'))).toBe(true)
    })

    it('transforms Avatar with AvatarFallback', () => {
        const result = transformFigmaJsx(FIGMA_AVATAR_JSX, shadcnOpts())
        expect(result.code).toContain('Avatar')
        expect(result.code).toContain('AvatarFallback')
        expect(result.imports.some(i => i.includes('@/components/ui/avatar'))).toBe(true)
    })

    it('transforms Badge', () => {
        const result = transformFigmaJsx(FIGMA_BADGE_JSX, shadcnOpts())
        expect(result.code).toContain('<Badge>')
        expect(result.code).toContain('New')
    })

    it('transforms Separator', () => {
        const result = transformFigmaJsx(FIGMA_SEPARATOR_JSX, shadcnOpts())
        expect(result.code).toContain('Separator')
        expect(result.imports.some(i => i.includes('@/components/ui/separator'))).toBe(true)
    })

    it('transforms Tabs with TabsList/TabsTrigger', () => {
        const result = transformFigmaJsx(FIGMA_TABS_JSX, shadcnOpts())
        expect(result.code).toContain('Tabs')
        expect(result.code).toContain('TabsList')
        expect(result.code).toContain('TabsTrigger')
        expect(result.imports.some(i => i.includes('@/components/ui/tabs'))).toBe(true)
    })

    it('transforms Label', () => {
        const result = transformFigmaJsx(FIGMA_LABEL_JSX, shadcnOpts())
        expect(result.code).toContain('Label')
        expect(result.code).toContain('Email Address')
    })

    it('transforms Textarea', () => {
        const result = transformFigmaJsx(FIGMA_TEXTAREA_JSX, shadcnOpts())
        expect(result.code).toContain('Textarea')
    })
})

// ---------------------------------------------------------------------------
// 2. MUI transforms
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — mui', () => {
    it('transforms Input to TextField', () => {
        const result = transformFigmaJsx(FIGMA_INPUT_JSX, muiOpts())
        expect(result.code).toContain('TextField')
        expect(result.imports.some(i => i.includes('@mui/material'))).toBe(true)
    })

    it('transforms Button with variant="contained"', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, muiOpts())
        expect(result.code).toContain('Button')
        expect(result.code).toContain('contained')
    })

    it('transforms Card with CardContent', () => {
        const result = transformFigmaJsx(FIGMA_CARD_JSX, muiOpts())
        expect(result.code).toContain('Card')
        expect(result.code).toContain('CardContent')
    })

    it('transforms Tabs with Tab components', () => {
        const result = transformFigmaJsx(FIGMA_TABS_JSX, muiOpts())
        expect(result.code).toContain('Tabs')
        expect(result.code).toContain('Tab')
    })

    it('transforms Label to Typography', () => {
        const result = transformFigmaJsx(FIGMA_LABEL_JSX, muiOpts())
        expect(result.code).toContain('Typography')
    })

    it('transforms Separator to Divider', () => {
        const result = transformFigmaJsx(FIGMA_SEPARATOR_JSX, muiOpts())
        expect(result.code).toContain('Divider')
    })
})

// ---------------------------------------------------------------------------
// 3. PrimeNG transforms
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — primeng', () => {
    it('transforms Input to InputText', () => {
        const result = transformFigmaJsx(FIGMA_INPUT_JSX, primengOpts())
        expect(result.code).toContain('InputText')
        expect(result.imports.some(i => i.includes('primereact/inputtext'))).toBe(true)
    })

    it('transforms Button with label prop', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, primengOpts())
        expect(result.code).toContain('Button')
        expect(result.code).toContain('label')
    })

    it('transforms Card', () => {
        const result = transformFigmaJsx(FIGMA_CARD_JSX, primengOpts())
        expect(result.code).toContain('Card')
        expect(result.imports.some(i => i.includes('primereact/card'))).toBe(true)
    })

    it('transforms Select to Dropdown', () => {
        const result = transformFigmaJsx(FIGMA_SELECT_JSX, primengOpts())
        expect(result.code).toContain('Dropdown')
        expect(result.imports.some(i => i.includes('primereact/dropdown'))).toBe(true)
    })

    it('transforms Tabs to TabView/TabPanel', () => {
        const result = transformFigmaJsx(FIGMA_TABS_JSX, primengOpts())
        expect(result.code).toContain('TabView')
        expect(result.code).toContain('TabPanel')
    })

    it('transforms Textarea to InputTextarea', () => {
        const result = transformFigmaJsx(FIGMA_TEXTAREA_JSX, primengOpts())
        expect(result.code).toContain('InputTextarea')
    })
})

// ---------------------------------------------------------------------------
// 4. Tailwind transforms
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — tailwind', () => {
    it('transforms Input to semantic HTML input', () => {
        const result = transformFigmaJsx(FIGMA_INPUT_JSX, tailwindOpts())
        // Should use semantic HTML elements
        expect(result.code).toContain('input')
        expect(result.imports.length).toBe(0) // No library imports for Tailwind
    })

    it('transforms Button to semantic HTML button', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, tailwindOpts())
        expect(result.code).toContain('<button')
        expect(result.code).toContain('Submit')
    })
})

// ---------------------------------------------------------------------------
// 5. Token mapping
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — token mapping', () => {
    it('maps hex colors in className to token classes', () => {
        // Use a plain div (not a recognized component) so the className survives replacement
        const jsx = `<div className="text-[color:var(--foreground/default,#09090b)] bg-[#2563eb]"><p>Test</p></div>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        // Tokens should be mapped
        expect(Object.keys(result.tokenMappings).length).toBeGreaterThan(0)
    })

    it('maps foreground color token', () => {
        const jsx = `<p className="text-[color:var(--foreground/default,#09090b)]">Hello</p>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        // The hex #09090b should map to the foreground token
        const mappedValues = Object.values(result.tokenMappings)
        expect(mappedValues.some(v => v.includes('foreground'))).toBe(true)
    })

    it('maps background color token via hex bracket', () => {
        const jsx = `<div className="bg-[#2563eb]">Content</div>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.tokenMappings['#2563EB']).toBeDefined()
    })

    it('returns empty tokenMappings when no color tokens provided', () => {
        const jsx = `<div className="bg-[#2563eb]">Content</div>`
        const result = transformFigmaJsx(jsx, { library: 'shadcn', tokens: [] })
        expect(Object.keys(result.tokenMappings).length).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// 6. Font cleanup
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — font cleanup', () => {
    it('replaces Figma font encoding with Tailwind class', () => {
        const jsx = `<p className="font-['Inter:Semi_Bold',sans-serif] text-[14px]">Hello</p>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.code).toContain('font-semibold')
        expect(result.code).not.toContain("font-['Inter:Semi_Bold',sans-serif]")
    })

    it('maps Medium font weight', () => {
        const jsx = `<p className="font-['Inter:Medium',sans-serif]">Hello</p>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.code).toContain('font-medium')
    })

    it('maps Bold font weight', () => {
        const jsx = `<p className="font-['Inter:Bold',sans-serif]">Hello</p>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.code).toContain('font-bold')
    })

    it('maps Regular font weight', () => {
        const jsx = `<p className="font-['Inter:Regular',sans-serif]">Hello</p>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.code).toContain('font-normal')
    })
})

// ---------------------------------------------------------------------------
// 7. Figma artifact removal
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — artifact removal', () => {
    it('removes data-name attributes', () => {
        const jsx = `<div data-name="Frame" data-node-id="1:1"><p>Content</p></div>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.code).not.toContain('data-name')
    })

    it('removes data-node-id attributes', () => {
        const jsx = `<div data-name="Frame" data-node-id="1:1"><p>Content</p></div>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.code).not.toContain('data-node-id')
    })

    it('removes min-h-px and min-w-px classes', () => {
        const jsx = `<div className="min-h-px min-w-px flex gap-2"><p>Content</p></div>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.code).not.toContain('min-h-px')
        expect(result.code).not.toContain('min-w-px')
    })
})

// ---------------------------------------------------------------------------
// 8. Import generation
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — imports', () => {
    it('generates correct shadcn import paths', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, shadcnOpts())
        expect(result.imports).toContain(
            'import { Button } from "@/components/ui/button"',
        )
    })

    it('generates correct MUI import paths', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, muiOpts())
        expect(result.imports.some(i => i.includes('@mui/material'))).toBe(true)
    })

    it('generates correct PrimeNG import paths', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, primengOpts())
        expect(result.imports.some(i => i.includes('primereact/button'))).toBe(true)
    })

    it('generates no imports for Tailwind (semantic HTML)', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, tailwindOpts())
        expect(result.imports.length).toBe(0)
    })

    it('combines imports from the same path', () => {
        const jsx = `<div>
            <div data-name="Card" data-node-id="1:1"><p>Hi</p></div>
        </div>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        // Card and CardContent from same path should be in one import
        const cardImport = result.imports.find(i => i.includes('@/components/ui/card'))
        if (cardImport) {
            expect(cardImport).toContain('Card')
            expect(cardImport).toContain('CardContent')
        }
    })
})

// ---------------------------------------------------------------------------
// 9. Component wrapping
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — component wrapping', () => {
    it('wraps output in an exported function component', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, shadcnOpts())
        expect(result.code).toContain('export function')
        expect(result.code).toContain('return (')
    })

    it('derives component name from root data-name', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, shadcnOpts())
        // "Button" → "Button" as PascalCase component
        expect(result.code).toMatch(/export function \w+/)
    })

    it('uses fallback name when no data-name', () => {
        const jsx = `<div><p>Hello</p></div>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.code).toContain('export function FigmaComponent')
    })
})

// ---------------------------------------------------------------------------
// 10. Full page transform
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — full page', () => {
    it('transforms a page with multiple components', () => {
        const pageJsx = `<div data-name="Settings Page" data-node-id="0:1">
            <div data-name="Input" data-node-id="1:1">
                <span>Username</span>
            </div>
            <div data-name="Button" data-node-id="2:1">
                <span>Save</span>
            </div>
            <div data-name="Separator" data-node-id="3:1" />
            <div data-name="Badge" data-node-id="4:1">
                <span>Pro</span>
            </div>
        </div>`

        const result = transformFigmaJsx(pageJsx, shadcnOpts())
        expect(result.componentCount).toBeGreaterThanOrEqual(3) // At least Input + Button + Separator
        expect(result.code).toContain('Input')
        expect(result.code).toContain('Button')
        expect(result.code).toContain('Separator')
        expect(result.code).toContain('Badge')
        expect(result.transformations.length).toBeGreaterThanOrEqual(3)
    })
})

// ---------------------------------------------------------------------------
// 11. Edge cases
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — edge cases', () => {
    it('returns empty result for empty input', () => {
        const result = transformFigmaJsx('', shadcnOpts())
        expect(result.code).toBe('')
        expect(result.imports).toEqual([])
        expect(result.componentCount).toBe(0)
    })

    it('returns empty result for whitespace-only input', () => {
        const result = transformFigmaJsx('   \n  ', shadcnOpts())
        expect(result.code).toBe('')
        expect(result.componentCount).toBe(0)
    })

    it('handles malformed JSX gracefully', () => {
        const result = transformFigmaJsx('<div data-name="Button" unclosed', shadcnOpts())
        // Should not throw; returns the original code (best-effort)
        expect(result.code).toBeDefined()
        expect(result.componentCount).toBe(0)
    })

    it('handles JSX with no recognizable components', () => {
        const jsx = `<div className="flex gap-4"><p>Plain content</p><span>More text</span></div>`
        const result = transformFigmaJsx(jsx, shadcnOpts())
        expect(result.componentCount).toBe(0)
        expect(result.code).toContain('Plain content')
    })

    it('handles null/undefined tokens gracefully', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, { library: 'shadcn', tokens: [] })
        expect(result.code).toContain('Button')
        expect(result.componentCount).toBeGreaterThanOrEqual(1)
    })

    it('tracks transformation log entries', () => {
        const result = transformFigmaJsx(FIGMA_BUTTON_JSX, shadcnOpts())
        expect(result.transformations.length).toBeGreaterThanOrEqual(1)
        const entry = result.transformations[0]
        expect(entry.nodeId).toBeDefined()
        expect(entry.from).toContain('Button')
        expect(entry.to).toBe('Button')
    })
})

// ---------------------------------------------------------------------------
// 12. Real Figma MCP output integration test
// ---------------------------------------------------------------------------

describe('figmaJsxTransformer — real Figma MCP output', () => {
    it('transforms real Input fixture to shadcn Input + Label', () => {
        const result = transformFigmaJsx(FIGMA_INPUT_JSX, shadcnOpts())

        // Should have Input and Label components
        expect(result.code).toContain('Input')
        expect(result.code).toContain('Label')

        // Should have mapped tokens
        expect(result.transformations.length).toBeGreaterThan(0)

        // Should be wrapped in a component
        expect(result.code).toContain('export function')

        // Should have cleaned font encoding
        expect(result.code).not.toContain("font-['Inter:Medium',sans-serif]")

        // data-name and data-node-id should be removed
        expect(result.code).not.toContain('data-name')
        expect(result.code).not.toContain('data-node-id')
    })

    it('transforms real Input fixture to MUI TextField', () => {
        const result = transformFigmaJsx(FIGMA_INPUT_JSX, muiOpts())
        expect(result.code).toContain('TextField')
        expect(result.code).toContain('Typography')
        expect(result.imports.some(i => i.includes('@mui/material'))).toBe(true)
    })

    it('transforms real Input fixture to PrimeNG InputText', () => {
        const result = transformFigmaJsx(FIGMA_INPUT_JSX, primengOpts())
        expect(result.code).toContain('InputText')
        expect(result.imports.some(i => i.includes('primereact/inputtext'))).toBe(true)
    })

    it('transforms real Input fixture to Tailwind semantic HTML', () => {
        const result = transformFigmaJsx(FIGMA_INPUT_JSX, tailwindOpts())
        expect(result.code).toContain('input')
        expect(result.imports.length).toBe(0)
    })
})
