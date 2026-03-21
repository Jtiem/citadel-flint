import { describe, it, expect } from 'vitest'
import { queryByFigmaId, queryRegistryDeterministic } from '../core/registryService.js'
import type { ComponentEntry } from '../core/registryService.js'

// ── Test registry ────────────────────────────────────────────────────────────

const testRegistry: Record<string, ComponentEntry> = {
    Button: {
        name: 'Button',
        importPath: '@/components/ui/Button',
        figmaComponentId: 'figma:123:456',
        figmaFileKey: 'abc123',
        props: { variant: { type: 'string', required: true }, disabled: { type: 'boolean', required: false } },
    },
    Card: {
        name: 'Card',
        importPath: '@/components/ui/Card',
        figmaComponentId: 'figma:789:012',
        figmaFileKey: 'abc123',
    },
    Input: {
        name: 'Input',
        importPath: '@/components/ui/Input',
        // No figmaComponentId — not mapped
    },
}

// ── queryByFigmaId ───────────────────────────────────────────────────────────

describe('queryByFigmaId', () => {
    it('returns exact match by Figma component ID', () => {
        const result = queryByFigmaId(testRegistry, 'figma:123:456')
        expect(result).not.toBeNull()
        expect(result!.name).toBe('Button')
    })

    it('returns null for unknown Figma ID', () => {
        expect(queryByFigmaId(testRegistry, 'figma:unknown')).toBeNull()
    })

    it('returns null for empty registry', () => {
        expect(queryByFigmaId({}, 'figma:123:456')).toBeNull()
    })
})

// ── queryRegistryDeterministic ───────────────────────────────────────────────

describe('queryRegistryDeterministic', () => {
    it('uses deterministic match when Figma ID is present and found', () => {
        const result = queryRegistryDeterministic(testRegistry, 'figma:123:456', 'SomeOtherName')
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('Button')
    })

    it('falls back to keyword search when Figma ID is not found', () => {
        const result = queryRegistryDeterministic(testRegistry, 'figma:unknown', 'Button')
        expect(result.length).toBeGreaterThan(0)
        expect(result[0].name).toBe('Button')
    })

    it('falls back to keyword search when Figma ID is null', () => {
        const result = queryRegistryDeterministic(testRegistry, null, 'Card')
        expect(result.length).toBeGreaterThan(0)
        expect(result[0].name).toBe('Card')
    })

    it('deterministic match overrides keyword even with different name', () => {
        // Figma ID says Button, but query says "Card" — deterministic wins
        const result = queryRegistryDeterministic(testRegistry, 'figma:123:456', 'Card')
        expect(result[0].name).toBe('Button')
    })
})

// ── ComponentEntry figma fields ──────────────────────────────────────────────

describe('ComponentEntry figma fields', () => {
    it('supports optional figmaComponentId', () => {
        const entry: ComponentEntry = { name: 'Test', importPath: './test' }
        expect(entry.figmaComponentId).toBeUndefined()
    })

    it('supports figmaComponentId + figmaFileKey', () => {
        const entry: ComponentEntry = {
            name: 'Test',
            importPath: './test',
            figmaComponentId: 'figma:abc',
            figmaFileKey: 'file123',
        }
        expect(entry.figmaComponentId).toBe('figma:abc')
        expect(entry.figmaFileKey).toBe('file123')
    })
})
