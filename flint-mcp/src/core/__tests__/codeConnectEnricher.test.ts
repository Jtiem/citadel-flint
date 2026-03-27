/**
 * codeConnectEnricher.test.ts
 *
 * Unit tests for enrichFromCodeConnect and resolveComponentType.
 *
 * Coverage:
 *  - Map standard component names (Button, Input, Card, etc.)
 *  - Map variant names (Button/Primary -> button)
 *  - Map alternate names (TextField -> input, Chip -> badge)
 *  - Handle unknown component names (return unmapped)
 *  - Case insensitive matching
 *  - Empty suggestions -> empty map
 *  - Multiple suggestions for same nodeId (last wins)
 *  - Confidence filtering (skip low-confidence suggestions)
 *  - Count mapped vs unmapped
 *  - Invalid / malformed input handling
 */

import { describe, it, expect } from 'vitest'
import {
    enrichFromCodeConnect,
    resolveComponentType,
} from '../codeConnectEnricher.js'
import type { CodeConnectSuggestion } from '../codeConnectEnricher.js'

// ---------------------------------------------------------------------------
// Helper: build a suggestion with defaults
// ---------------------------------------------------------------------------

function suggestion(
    nodeId: string,
    componentName: string,
    overrides?: Partial<CodeConnectSuggestion>,
): CodeConnectSuggestion {
    return {
        nodeId,
        componentName,
        source: overrides?.source ?? 'src/components/ui/button.tsx',
        label: overrides?.label ?? 'react',
        confidence: overrides?.confidence,
    }
}

// ---------------------------------------------------------------------------
// resolveComponentType — unit tests
// ---------------------------------------------------------------------------

describe('resolveComponentType', () => {
    it('maps standard component names', () => {
        expect(resolveComponentType('Button')).toBe('button')
        expect(resolveComponentType('Input')).toBe('input')
        expect(resolveComponentType('Card')).toBe('card')
        expect(resolveComponentType('Select')).toBe('select')
        expect(resolveComponentType('Avatar')).toBe('avatar')
        expect(resolveComponentType('Badge')).toBe('badge')
        expect(resolveComponentType('Tabs')).toBe('tabs')
        expect(resolveComponentType('Separator')).toBe('separator')
        expect(resolveComponentType('Checkbox')).toBe('checkbox')
        expect(resolveComponentType('Switch')).toBe('switch')
        expect(resolveComponentType('Textarea')).toBe('textarea')
        expect(resolveComponentType('Label')).toBe('label')
        expect(resolveComponentType('Alert')).toBe('alert')
    })

    it('maps variant names by stripping the suffix', () => {
        expect(resolveComponentType('Button/Primary')).toBe('button')
        expect(resolveComponentType('Button/Secondary')).toBe('button')
        expect(resolveComponentType('Card/Default')).toBe('card')
        expect(resolveComponentType('Avatar/Circle')).toBe('avatar')
        expect(resolveComponentType('Badge/Destructive')).toBe('badge')
        expect(resolveComponentType('Input/Large')).toBe('input')
    })

    it('maps alternate/alias names', () => {
        expect(resolveComponentType('TextField')).toBe('input')
        expect(resolveComponentType('TextInput')).toBe('input')
        expect(resolveComponentType('InputText')).toBe('input')
        expect(resolveComponentType('Dropdown')).toBe('select')
        expect(resolveComponentType('Combobox')).toBe('select')
        expect(resolveComponentType('Chip')).toBe('badge')
        expect(resolveComponentType('Tag')).toBe('badge')
        expect(resolveComponentType('TabBar')).toBe('tabs')
        expect(resolveComponentType('Divider')).toBe('separator')
        expect(resolveComponentType('Hr')).toBe('separator')
        expect(resolveComponentType('Toggle')).toBe('switch')
        expect(resolveComponentType('Check')).toBe('checkbox')
        expect(resolveComponentType('Banner')).toBe('alert')
        expect(resolveComponentType('Notification')).toBe('alert')
        expect(resolveComponentType('Message')).toBe('alert')
    })

    it('is case insensitive', () => {
        expect(resolveComponentType('BUTTON')).toBe('button')
        expect(resolveComponentType('button')).toBe('button')
        expect(resolveComponentType('bUtToN')).toBe('button')
        expect(resolveComponentType('TEXTFIELD')).toBe('input')
        expect(resolveComponentType('textField')).toBe('input')
        expect(resolveComponentType('CHIP')).toBe('badge')
    })

    it('returns null for unknown component names', () => {
        expect(resolveComponentType('CustomWidget')).toBeNull()
        expect(resolveComponentType('FooBar')).toBeNull()
        expect(resolveComponentType('DataTable')).toBeNull()
        expect(resolveComponentType('Calendar')).toBeNull()
    })

    it('returns null for empty/invalid input', () => {
        expect(resolveComponentType('')).toBeNull()
        expect(resolveComponentType(null as unknown as string)).toBeNull()
        expect(resolveComponentType(undefined as unknown as string)).toBeNull()
    })

    it('handles whitespace in names', () => {
        expect(resolveComponentType('  Button  ')).toBe('button')
        expect(resolveComponentType(' Card / Default ')).toBe('card')
    })

    it('matches compound names via substring', () => {
        expect(resolveComponentType('PrimaryButton')).toBe('button')
        expect(resolveComponentType('FormInput')).toBe('input')
        expect(resolveComponentType('SearchSelect')).toBe('select')
        expect(resolveComponentType('UserAvatar')).toBe('avatar')
    })

    it('prioritises textarea over text/input in substring matching', () => {
        expect(resolveComponentType('TextareaField')).toBe('textarea')
    })
})

// ---------------------------------------------------------------------------
// enrichFromCodeConnect — standard mapping
// ---------------------------------------------------------------------------

describe('enrichFromCodeConnect — standard mapping', () => {
    it('maps standard component names to overrides', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('1:1', 'Button'),
            suggestion('1:2', 'Input'),
            suggestion('1:3', 'Card'),
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.overrides.size).toBe(3)
        expect(result.overrides.get('1:1')).toBe('button')
        expect(result.overrides.get('1:2')).toBe('input')
        expect(result.overrides.get('1:3')).toBe('card')
        expect(result.mappedCount).toBe(3)
        expect(result.unmappedCount).toBe(0)
    })

    it('maps variant names correctly', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('2:1', 'Button/Primary'),
            suggestion('2:2', 'Button/Secondary'),
            suggestion('2:3', 'Card/Default'),
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.overrides.get('2:1')).toBe('button')
        expect(result.overrides.get('2:2')).toBe('button')
        expect(result.overrides.get('2:3')).toBe('card')
        expect(result.mappedCount).toBe(3)
    })

    it('maps alternate names to correct types', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('3:1', 'TextField'),
            suggestion('3:2', 'Chip'),
            suggestion('3:3', 'Dropdown'),
            suggestion('3:4', 'Toggle'),
            suggestion('3:5', 'Divider'),
        ]

        const result = enrichFromCodeConnect(suggestions, 'mui')

        expect(result.overrides.get('3:1')).toBe('input')
        expect(result.overrides.get('3:2')).toBe('badge')
        expect(result.overrides.get('3:3')).toBe('select')
        expect(result.overrides.get('3:4')).toBe('switch')
        expect(result.overrides.get('3:5')).toBe('separator')
        expect(result.mappedCount).toBe(5)
        expect(result.unmappedCount).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// enrichFromCodeConnect — unknown names
// ---------------------------------------------------------------------------

describe('enrichFromCodeConnect — unknown component names', () => {
    it('counts unknowns as unmapped', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('4:1', 'Button'),
            suggestion('4:2', 'CustomWidget'),
            suggestion('4:3', 'FancyThing'),
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.overrides.size).toBe(1)
        expect(result.overrides.get('4:1')).toBe('button')
        expect(result.mappedCount).toBe(1)
        expect(result.unmappedCount).toBe(2)
    })
})

// ---------------------------------------------------------------------------
// enrichFromCodeConnect — case insensitivity
// ---------------------------------------------------------------------------

describe('enrichFromCodeConnect — case insensitive', () => {
    it('maps regardless of case', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('5:1', 'BUTTON'),
            suggestion('5:2', 'textField'),
            suggestion('5:3', 'CHIP'),
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.overrides.get('5:1')).toBe('button')
        expect(result.overrides.get('5:2')).toBe('input')
        expect(result.overrides.get('5:3')).toBe('badge')
        expect(result.mappedCount).toBe(3)
    })
})

// ---------------------------------------------------------------------------
// enrichFromCodeConnect — empty / null input
// ---------------------------------------------------------------------------

describe('enrichFromCodeConnect — empty input', () => {
    it('returns empty map for empty array', () => {
        const result = enrichFromCodeConnect([], 'shadcn')

        expect(result.overrides.size).toBe(0)
        expect(result.mappedCount).toBe(0)
        expect(result.unmappedCount).toBe(0)
    })

    it('handles non-array input gracefully', () => {
        const result = enrichFromCodeConnect(
            null as unknown as CodeConnectSuggestion[],
            'shadcn',
        )

        expect(result.overrides.size).toBe(0)
        expect(result.mappedCount).toBe(0)
        expect(result.unmappedCount).toBe(0)
    })

    it('skips entries with missing nodeId', () => {
        const suggestions = [
            { nodeId: '', componentName: 'Button', source: 'x.tsx', label: 'react' },
            { nodeId: '1:1', componentName: 'Card', source: 'x.tsx', label: 'react' },
        ] as CodeConnectSuggestion[]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.overrides.size).toBe(1)
        expect(result.overrides.get('1:1')).toBe('card')
        expect(result.unmappedCount).toBe(1)
    })

    it('skips entries with missing componentName', () => {
        const suggestions = [
            { nodeId: '1:1', componentName: '', source: 'x.tsx', label: 'react' },
        ] as CodeConnectSuggestion[]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.overrides.size).toBe(0)
        expect(result.unmappedCount).toBe(1)
    })
})

// ---------------------------------------------------------------------------
// enrichFromCodeConnect — duplicate nodeId (last wins)
// ---------------------------------------------------------------------------

describe('enrichFromCodeConnect — duplicate nodeId', () => {
    it('last suggestion for a nodeId wins', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('6:1', 'Button'),
            suggestion('6:1', 'Card'),
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.overrides.size).toBe(1)
        expect(result.overrides.get('6:1')).toBe('card')
        // Both were mapped to known types, so mapped = 1 (unique keys), unmapped = 0
        expect(result.mappedCount).toBe(1)
        expect(result.unmappedCount).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// enrichFromCodeConnect — confidence filtering
// ---------------------------------------------------------------------------

describe('enrichFromCodeConnect — confidence filtering', () => {
    it('skips suggestions below default threshold (0.5)', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('7:1', 'Button', { confidence: 0.9 }),
            suggestion('7:2', 'Input', { confidence: 0.3 }),
            suggestion('7:3', 'Card', { confidence: 0.5 }),
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.overrides.size).toBe(2)
        expect(result.overrides.get('7:1')).toBe('button')
        expect(result.overrides.has('7:2')).toBe(false)
        expect(result.overrides.get('7:3')).toBe('card')
        expect(result.mappedCount).toBe(2)
        expect(result.unmappedCount).toBe(1)
    })

    it('respects custom minConfidence parameter', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('8:1', 'Button', { confidence: 0.8 }),
            suggestion('8:2', 'Input', { confidence: 0.7 }),
            suggestion('8:3', 'Card', { confidence: 0.6 }),
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn', 0.75)

        expect(result.overrides.size).toBe(1)
        expect(result.overrides.get('8:1')).toBe('button')
        expect(result.mappedCount).toBe(1)
        expect(result.unmappedCount).toBe(2)
    })

    it('includes suggestions without confidence field (no filtering)', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('9:1', 'Button'),  // confidence undefined
            suggestion('9:2', 'Input', { confidence: 0.9 }),
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.overrides.size).toBe(2)
        expect(result.overrides.get('9:1')).toBe('button')
        expect(result.overrides.get('9:2')).toBe('input')
    })
})

// ---------------------------------------------------------------------------
// enrichFromCodeConnect — full pipeline with all component types
// ---------------------------------------------------------------------------

describe('enrichFromCodeConnect — all supported types', () => {
    it('maps the full vocabulary of component types', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('a:1', 'Button'),
            suggestion('a:2', 'Input'),
            suggestion('a:3', 'Card'),
            suggestion('a:4', 'Select'),
            suggestion('a:5', 'Avatar'),
            suggestion('a:6', 'Badge'),
            suggestion('a:7', 'Tabs'),
            suggestion('a:8', 'Separator'),
            suggestion('a:9', 'Checkbox'),
            suggestion('a:10', 'Switch'),
            suggestion('a:11', 'Textarea'),
            suggestion('a:12', 'Label'),
            suggestion('a:13', 'Alert'),
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.mappedCount).toBe(13)
        expect(result.unmappedCount).toBe(0)
        expect(result.overrides.get('a:1')).toBe('button')
        expect(result.overrides.get('a:2')).toBe('input')
        expect(result.overrides.get('a:3')).toBe('card')
        expect(result.overrides.get('a:4')).toBe('select')
        expect(result.overrides.get('a:5')).toBe('avatar')
        expect(result.overrides.get('a:6')).toBe('badge')
        expect(result.overrides.get('a:7')).toBe('tabs')
        expect(result.overrides.get('a:8')).toBe('separator')
        expect(result.overrides.get('a:9')).toBe('checkbox')
        expect(result.overrides.get('a:10')).toBe('switch')
        expect(result.overrides.get('a:11')).toBe('textarea')
        expect(result.overrides.get('a:12')).toBe('label')
        expect(result.overrides.get('a:13')).toBe('alert')
    })
})

// ---------------------------------------------------------------------------
// enrichFromCodeConnect — mixed valid/invalid suggestions
// ---------------------------------------------------------------------------

describe('enrichFromCodeConnect — mixed valid/invalid', () => {
    it('correctly partitions mapped and unmapped counts', () => {
        const suggestions: CodeConnectSuggestion[] = [
            suggestion('m:1', 'Button'),               // mapped
            suggestion('m:2', 'UnknownThing'),          // unmapped (unknown)
            suggestion('m:3', 'Card', { confidence: 0.1 }), // unmapped (low confidence)
            suggestion('m:4', 'Select'),                // mapped
            { nodeId: '', componentName: 'Badge', source: '', label: '' }, // unmapped (empty nodeId)
            suggestion('m:5', 'Alert'),                 // mapped
        ]

        const result = enrichFromCodeConnect(suggestions, 'shadcn')

        expect(result.mappedCount).toBe(3)
        expect(result.unmappedCount).toBe(3)
        expect(result.overrides.get('m:1')).toBe('button')
        expect(result.overrides.get('m:4')).toBe('select')
        expect(result.overrides.get('m:5')).toBe('alert')
    })
})
