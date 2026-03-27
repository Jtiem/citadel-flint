import { describe, it, expect } from 'vitest'
import { analyzeLayout, layoutClassesToString, mapToSpacingScale, mapToRadiusScale } from '../layoutAnalyzer.js'

describe('mapToSpacingScale', () => {
    it('maps standard Tailwind values', () => {
        expect(mapToSpacingScale(0)).toBe('0')
        expect(mapToSpacingScale(4)).toBe('1')
        expect(mapToSpacingScale(8)).toBe('2')
        expect(mapToSpacingScale(12)).toBe('3')
        expect(mapToSpacingScale(16)).toBe('4')
        expect(mapToSpacingScale(24)).toBe('6')
        expect(mapToSpacingScale(32)).toBe('8')
        expect(mapToSpacingScale(48)).toBe('12')
    })

    it('uses arbitrary value for non-standard values', () => {
        expect(mapToSpacingScale(18)).toBe('[18px]')
        expect(mapToSpacingScale(50)).toBe('[50px]')
    })

    it('snaps values within 1px of a scale value', () => {
        expect(mapToSpacingScale(15)).toBe('3.5')  // closest to 14
        expect(mapToSpacingScale(25)).toBe('6')    // 24 + 1
        expect(mapToSpacingScale(17)).toBe('4')    // 16 + 1, within threshold
    })
})

describe('mapToRadiusScale', () => {
    it('maps standard Tailwind radius values', () => {
        expect(mapToRadiusScale(0)).toBe('rounded-none')
        expect(mapToRadiusScale(4)).toBe('rounded')
        expect(mapToRadiusScale(6)).toBe('rounded-md')
        expect(mapToRadiusScale(8)).toBe('rounded-lg')
        expect(mapToRadiusScale(12)).toBe('rounded-xl')
        expect(mapToRadiusScale(16)).toBe('rounded-2xl')
    })

    it('returns rounded-full for very large values', () => {
        expect(mapToRadiusScale(9999)).toBe('rounded-full')
        expect(mapToRadiusScale(10000)).toBe('rounded-full')
    })

    it('uses arbitrary value for non-standard values', () => {
        expect(mapToRadiusScale(10)).toBe('rounded-[10px]')
        expect(mapToRadiusScale(20)).toBe('rounded-[20px]')
    })
})

describe('analyzeLayout', () => {
    it('maps HORIZONTAL layout to flex-row', () => {
        const classes = analyzeLayout({ layoutMode: 'HORIZONTAL' })
        expect(classes.display).toBe('flex')
        expect(classes.direction).toBe('flex-row')
    })

    it('maps VERTICAL layout to flex-col', () => {
        const classes = analyzeLayout({ layoutMode: 'VERTICAL' })
        expect(classes.display).toBe('flex')
        expect(classes.direction).toBe('flex-col')
    })

    it('returns empty display for NONE/absent layout', () => {
        expect(analyzeLayout({ layoutMode: 'NONE' }).display).toBe('')
        expect(analyzeLayout({}).display).toBe('')
    })

    it('maps primary axis alignment', () => {
        const base = { layoutMode: 'HORIZONTAL' }
        expect(analyzeLayout({ ...base, primaryAxisAlignItems: 'MIN' }).justify).toBe('justify-start')
        expect(analyzeLayout({ ...base, primaryAxisAlignItems: 'CENTER' }).justify).toBe('justify-center')
        expect(analyzeLayout({ ...base, primaryAxisAlignItems: 'MAX' }).justify).toBe('justify-end')
        expect(analyzeLayout({ ...base, primaryAxisAlignItems: 'SPACE_BETWEEN' }).justify).toBe('justify-between')
    })

    it('maps counter axis alignment', () => {
        const base = { layoutMode: 'VERTICAL' }
        expect(analyzeLayout({ ...base, counterAxisAlignItems: 'MIN' }).align).toBe('items-start')
        expect(analyzeLayout({ ...base, counterAxisAlignItems: 'CENTER' }).align).toBe('items-center')
        expect(analyzeLayout({ ...base, counterAxisAlignItems: 'MAX' }).align).toBe('items-end')
    })

    it('maps itemSpacing to gap', () => {
        expect(analyzeLayout({ layoutMode: 'VERTICAL', itemSpacing: 16 }).gap).toBe('gap-4')
        expect(analyzeLayout({ layoutMode: 'HORIZONTAL', itemSpacing: 8 }).gap).toBe('gap-2')
        expect(analyzeLayout({ layoutMode: 'VERTICAL', itemSpacing: 24 }).gap).toBe('gap-6')
    })

    it('ignores gap when no layout mode', () => {
        expect(analyzeLayout({ itemSpacing: 16 }).gap).toBe('')
    })

    it('maps uniform padding', () => {
        expect(analyzeLayout({ paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16 }).padding).toBe('p-4')
    })

    it('maps symmetric padding', () => {
        expect(analyzeLayout({ paddingTop: 8, paddingRight: 16, paddingBottom: 8, paddingLeft: 16 }).padding).toBe('px-4 py-2')
    })

    it('maps asymmetric padding', () => {
        const classes = analyzeLayout({ paddingTop: 8, paddingRight: 16, paddingBottom: 24, paddingLeft: 4 })
        expect(classes.padding).toContain('pt-2')
        expect(classes.padding).toContain('pr-4')
        expect(classes.padding).toContain('pb-6')
        expect(classes.padding).toContain('pl-1')
    })

    it('maps FILL sizing to w-full', () => {
        expect(analyzeLayout({ layoutSizingHorizontal: 'FILL' }).width).toBe('w-full')
    })

    it('maps FIXED sizing with bbox', () => {
        expect(analyzeLayout({ layoutSizingHorizontal: 'FIXED', absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 200 } }).width).toBe('w-[300px]')
    })

    it('maps corner radius', () => {
        expect(analyzeLayout({ cornerRadius: 8 }).borderRadius).toBe('rounded-lg')
        expect(analyzeLayout({ cornerRadius: 9999 }).borderRadius).toBe('rounded-full')
    })

    it('maps clipsContent to overflow-hidden', () => {
        expect(analyzeLayout({ clipsContent: true }).overflow).toBe('overflow-hidden')
        expect(analyzeLayout({ clipsContent: false }).overflow).toBe('')
    })

    it('maps flex-wrap', () => {
        expect(analyzeLayout({ layoutWrap: 'WRAP' }).wrap).toBe('flex-wrap')
    })

    it('handles a real card node', () => {
        const cardNode = {
            layoutMode: 'VERTICAL',
            primaryAxisAlignItems: 'MIN',
            counterAxisAlignItems: 'MIN',
            itemSpacing: 24,
            paddingTop: 24, paddingRight: 24, paddingBottom: 24, paddingLeft: 24,
            cornerRadius: 8,
            clipsContent: true,
            layoutSizingHorizontal: 'FILL',
        }
        const classes = analyzeLayout(cardNode)
        expect(classes.display).toBe('flex')
        expect(classes.direction).toBe('flex-col')
        expect(classes.gap).toBe('gap-6')
        expect(classes.padding).toBe('p-6')
        expect(classes.borderRadius).toBe('rounded-lg')
        expect(classes.overflow).toBe('overflow-hidden')
        expect(classes.width).toBe('w-full')
    })

    it('handles a horizontal button row', () => {
        const rowNode = {
            layoutMode: 'HORIZONTAL',
            primaryAxisAlignItems: 'MAX',
            counterAxisAlignItems: 'CENTER',
            itemSpacing: 16,
        }
        const classes = analyzeLayout(rowNode)
        const str = layoutClassesToString(classes)
        expect(str).toContain('flex')
        expect(str).toContain('flex-row')
        expect(str).toContain('justify-end')
        expect(str).toContain('items-center')
        expect(str).toContain('gap-4')
    })

    it('returns empty string for default/empty node', () => {
        expect(layoutClassesToString(analyzeLayout({}))).toBe('')
    })
})

describe('layoutClassesToString', () => {
    it('joins non-empty values', () => {
        const result = layoutClassesToString({
            display: 'flex', direction: 'flex-col', justify: '', align: 'items-center',
            gap: 'gap-4', padding: 'p-6', width: 'w-full', height: '',
            wrap: '', overflow: '', borderRadius: 'rounded-lg',
        })
        expect(result).toBe('flex flex-col items-center gap-4 p-6 w-full rounded-lg')
    })

    it('returns empty string when all values are empty', () => {
        const result = layoutClassesToString({
            display: '', direction: '', justify: '', align: '',
            gap: '', padding: '', width: '', height: '',
            wrap: '', overflow: '', borderRadius: '',
        })
        expect(result).toBe('')
    })
})
