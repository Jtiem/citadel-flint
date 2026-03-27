/**
 * codeConnectMapper.test.ts
 *
 * Unit tests for generateCodeConnectMappings and getSupportedLibraries.
 *
 * Coverage:
 *  - Generates mappings for shadcn (15 components)
 *  - Generates mappings for MUI (12 components)
 *  - Generates mappings for PrimeNG (10 components)
 *  - Case-insensitive library names
 *  - Returns null for unknown library
 *  - Each mapping has importPath, exportName, props
 *  - Props include type information
 *  - Compound parts recorded for compound components
 *  - generatedAt is a valid ISO timestamp
 *  - getSupportedLibraries returns expected set
 */

import { describe, it, expect } from 'vitest'
import {
    generateCodeConnectMappings,
    getSupportedLibraries,
} from '../codeConnectMapper.js'
import type { CodeConnectMapping } from '../codeConnectMapper.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertBaseShape(mapping: CodeConnectMapping): void {
    expect(mapping.figmaComponentName).toBeTruthy()
    expect(typeof mapping.figmaComponentName).toBe('string')
    expect(mapping.importPath).toBeTruthy()
    expect(typeof mapping.importPath).toBe('string')
    expect(mapping.exportName).toBeTruthy()
    expect(typeof mapping.exportName).toBe('string')
    expect(mapping.props).toBeDefined()
    expect(typeof mapping.props).toBe('object')
}

function assertPropTypes(mapping: CodeConnectMapping): void {
    for (const [key, def] of Object.entries(mapping.props)) {
        expect(typeof def.type).toBe('string')
        expect(def.type.length).toBeGreaterThan(0)
        if (def.figmaProp !== undefined) {
            expect(typeof def.figmaProp).toBe('string')
        }
        if (def.mapping !== undefined) {
            expect(typeof def.mapping).toBe('object')
            // Every enum mapping key/value must be strings
            for (const [k, v] of Object.entries(def.mapping)) {
                expect(typeof k).toBe('string')
                expect(typeof v).toBe('string')
            }
        }
        void key // suppress unused variable lint warning
    }
}

// ---------------------------------------------------------------------------
// Unknown library
// ---------------------------------------------------------------------------

describe('generateCodeConnectMappings — unknown library', () => {
    it('returns null for an unknown library', () => {
        expect(generateCodeConnectMappings('angular')).toBeNull()
    })

    it('returns null for empty string', () => {
        expect(generateCodeConnectMappings('')).toBeNull()
    })

    it('returns null for a completely made-up string', () => {
        expect(generateCodeConnectMappings('bootstrap')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// shadcn — 15 components
// ---------------------------------------------------------------------------

describe('generateCodeConnectMappings — shadcn', () => {
    const config = generateCodeConnectMappings('shadcn')

    it('returns a non-null config', () => {
        expect(config).not.toBeNull()
    })

    it('reports library as "shadcn"', () => {
        expect(config!.library).toBe('shadcn')
    })

    it('has exactly 15 mappings', () => {
        expect(config!.mappings).toHaveLength(15)
    })

    it('includes a generatedAt ISO timestamp', () => {
        expect(() => new Date(config!.generatedAt)).not.toThrow()
        expect(new Date(config!.generatedAt).getTime()).toBeGreaterThan(0)
    })

    it('every mapping has importPath, exportName, and props', () => {
        for (const m of config!.mappings) {
            assertBaseShape(m)
        }
    })

    it('every prop has a type string', () => {
        for (const m of config!.mappings) {
            assertPropTypes(m)
        }
    })

    it('Button mapping has correct importPath', () => {
        const btn = config!.mappings.find(m => m.figmaComponentName === 'Button')
        expect(btn).toBeDefined()
        expect(btn!.importPath).toBe('@/components/ui/button')
        expect(btn!.exportName).toBe('Button')
    })

    it('Button mapping includes variant, size, disabled props', () => {
        const btn = config!.mappings.find(m => m.figmaComponentName === 'Button')!
        expect(btn.props.variant).toBeDefined()
        expect(btn.props.variant.type).toBe('enum')
        expect(btn.props.size).toBeDefined()
        expect(btn.props.disabled).toBeDefined()
        expect(btn.props.disabled.type).toBe('boolean')
    })

    it('Select mapping has compoundParts', () => {
        const sel = config!.mappings.find(m => m.figmaComponentName === 'Select')!
        expect(sel.compoundParts).toBeDefined()
        expect(sel.compoundParts!.length).toBeGreaterThan(0)
        expect(sel.compoundParts).toContain('SelectTrigger')
        expect(sel.compoundParts).toContain('SelectContent')
    })

    it('Dialog mapping has all expected compound parts', () => {
        const dialog = config!.mappings.find(m => m.figmaComponentName === 'Dialog')!
        expect(dialog.compoundParts).toContain('DialogTrigger')
        expect(dialog.compoundParts).toContain('DialogContent')
        expect(dialog.compoundParts).toContain('DialogTitle')
    })

    it('Badge variant enum includes default, secondary, destructive, outline', () => {
        const badge = config!.mappings.find(m => m.figmaComponentName === 'Badge')!
        const mapping = badge.props.variant.mapping!
        expect(mapping.default).toBeDefined()
        expect(mapping.secondary).toBeDefined()
        expect(mapping.destructive).toBeDefined()
        expect(mapping.outline).toBeDefined()
    })

    it('Switch has onCheckedChange with type function', () => {
        const sw = config!.mappings.find(m => m.figmaComponentName === 'Switch')!
        expect(sw.props.onCheckedChange.type).toBe('function')
    })

    it('all 15 component names are distinct', () => {
        const names = config!.mappings.map(m => m.figmaComponentName)
        expect(new Set(names).size).toBe(15)
    })

    it('is case-insensitive: "SHADCN" resolves to shadcn mappings', () => {
        const upper = generateCodeConnectMappings('SHADCN')
        expect(upper).not.toBeNull()
        expect(upper!.mappings).toHaveLength(15)
    })
})

// ---------------------------------------------------------------------------
// MUI — 12 components
// ---------------------------------------------------------------------------

describe('generateCodeConnectMappings — MUI', () => {
    const config = generateCodeConnectMappings('mui')

    it('returns a non-null config', () => {
        expect(config).not.toBeNull()
    })

    it('reports library as "mui"', () => {
        expect(config!.library).toBe('mui')
    })

    it('has exactly 12 mappings', () => {
        expect(config!.mappings).toHaveLength(12)
    })

    it('every mapping has importPath, exportName, and props', () => {
        for (const m of config!.mappings) {
            assertBaseShape(m)
        }
    })

    it('every prop has a type string', () => {
        for (const m of config!.mappings) {
            assertPropTypes(m)
        }
    })

    it('Button uses @mui/material/Button import path', () => {
        const btn = config!.mappings.find(m => m.figmaComponentName === 'Button')!
        expect(btn.importPath).toBe('@mui/material/Button')
    })

    it('TextField has label, variant, multiline, rows props', () => {
        const tf = config!.mappings.find(m => m.figmaComponentName === 'TextField')!
        expect(tf.props.label).toBeDefined()
        expect(tf.props.variant).toBeDefined()
        expect(tf.props.multiline.type).toBe('boolean')
        expect(tf.props.rows).toBeDefined()
    })

    it('Card has CardContent and CardActions compound parts', () => {
        const card = config!.mappings.find(m => m.figmaComponentName === 'Card')!
        expect(card.compoundParts).toContain('CardContent')
        expect(card.compoundParts).toContain('CardActions')
    })

    it('Alert severity enum includes error, warning, info, success', () => {
        const alert = config!.mappings.find(m => m.figmaComponentName === 'Alert')!
        const mapping = alert.props.severity.mapping!
        expect(mapping.error).toBeDefined()
        expect(mapping.warning).toBeDefined()
        expect(mapping.info).toBeDefined()
        expect(mapping.success).toBeDefined()
    })

    it('all 12 component names are distinct', () => {
        const names = config!.mappings.map(m => m.figmaComponentName)
        expect(new Set(names).size).toBe(12)
    })
})

// ---------------------------------------------------------------------------
// PrimeNG — 10 components
// ---------------------------------------------------------------------------

describe('generateCodeConnectMappings — PrimeNG', () => {
    const config = generateCodeConnectMappings('primeng')

    it('returns a non-null config', () => {
        expect(config).not.toBeNull()
    })

    it('reports library as "primeng"', () => {
        expect(config!.library).toBe('primeng')
    })

    it('has exactly 10 mappings', () => {
        expect(config!.mappings).toHaveLength(10)
    })

    it('every mapping has importPath, exportName, and props', () => {
        for (const m of config!.mappings) {
            assertBaseShape(m)
        }
    })

    it('every prop has a type string', () => {
        for (const m of config!.mappings) {
            assertPropTypes(m)
        }
    })

    it('Button uses primereact/button import path', () => {
        const btn = config!.mappings.find(m => m.figmaComponentName === 'Button')!
        expect(btn.importPath).toBe('primereact/button')
    })

    it('Button has label, severity, outlined, icon props', () => {
        const btn = config!.mappings.find(m => m.figmaComponentName === 'Button')!
        expect(btn.props.label).toBeDefined()
        expect(btn.props.severity).toBeDefined()
        expect(btn.props.outlined.type).toBe('boolean')
        expect(btn.props.icon).toBeDefined()
    })

    it('DataTable has Column compound part', () => {
        const dt = config!.mappings.find(m => m.figmaComponentName === 'DataTable')!
        expect(dt.compoundParts).toContain('Column')
    })

    it('Message has severity enum with warn and error', () => {
        const msg = config!.mappings.find(m => m.figmaComponentName === 'Message')!
        const mapping = msg.props.severity.mapping!
        expect(mapping.warn).toBeDefined()
        expect(mapping.error).toBeDefined()
    })

    it('all 10 component names are distinct', () => {
        const names = config!.mappings.map(m => m.figmaComponentName)
        expect(new Set(names).size).toBe(10)
    })
})

// ---------------------------------------------------------------------------
// getSupportedLibraries
// ---------------------------------------------------------------------------

describe('getSupportedLibraries', () => {
    it('returns an array', () => {
        expect(Array.isArray(getSupportedLibraries())).toBe(true)
    })

    it('includes shadcn, mui, primeng', () => {
        const libs = getSupportedLibraries()
        expect(libs).toContain('shadcn')
        expect(libs).toContain('mui')
        expect(libs).toContain('primeng')
    })

    it('has at least 3 entries', () => {
        expect(getSupportedLibraries().length).toBeGreaterThanOrEqual(3)
    })
})
