import { describe, it, expect } from 'vitest'
import { formatHealthSignal } from '../healthSignal'

describe('formatHealthSignal', () => {
    it('returns perfect scores when all counts are zero', () => {
        const result = formatHealthSignal(0, 0, 0)
        expect(result).toEqual({
            fidelityScore: 100,
            a11yScore: 100,
            overrideCount: 0,
            overallScore: 100,
            grade: 'A',
        })
    })

    it('computes fidelity score as max(0, 100 - mithrilCount * 3)', () => {
        expect(formatHealthSignal(3, 0, 0).fidelityScore).toBe(91)
        expect(formatHealthSignal(34, 0, 0).fidelityScore).toBe(0)
    })

    it('computes a11y score as max(0, 100 - a11yCount * 10)', () => {
        expect(formatHealthSignal(0, 2, 0).a11yScore).toBe(80)
        expect(formatHealthSignal(0, 10, 0).a11yScore).toBe(0)
    })

    it('computes overall score using canonical severity-weighted formula', () => {
        // 100 - 2*3 - 1*10 - 1*3 = 81
        const result = formatHealthSignal(2, 1, 1)
        expect(result.overallScore).toBe(81)
        expect(result.grade).toBe('B')
    })

    it('clamps fidelity and a11y scores at 0 for large counts', () => {
        const result = formatHealthSignal(100, 50, 10)
        expect(result.fidelityScore).toBe(0)
        expect(result.a11yScore).toBe(0)
        expect(result.overallScore).toBe(0)
        expect(result.grade).toBe('F')
    })

    it('clamps overall score at 0 (never negative)', () => {
        const result = formatHealthSignal(50, 0, 0)
        expect(result.overallScore).toBe(0)
    })

    it('clamps overall score at 100', () => {
        const result = formatHealthSignal(0, 0, 0)
        expect(result.overallScore).toBe(100)
    })

    it('passes through override count as-is', () => {
        expect(formatHealthSignal(0, 0, 7).overrideCount).toBe(7)
    })

    // Grade boundary tests
    // Canonical: overall = 100 - a11y*10 - mithril*3 - overrides*3

    it('assigns grade A at score 90', () => {
        // 100 - 0*10 - 2*3 - 0*3 = 94 → A
        expect(formatHealthSignal(2, 0, 0).grade).toBe('A')
        // 100 - 1*10 - 0*3 - 0*3 = 90 → A
        expect(formatHealthSignal(0, 1, 0).grade).toBe('A')
    })

    it('assigns grade B at score 80-89', () => {
        // 100 - 1*10 - 1*3 - 0*3 = 87 → B
        expect(formatHealthSignal(1, 1, 0).grade).toBe('B')
    })

    it('assigns grade C at score 70-79', () => {
        // 100 - 2*10 - 3*3 - 0*3 = 71 → C
        expect(formatHealthSignal(3, 2, 0).grade).toBe('C')
    })

    it('assigns grade D at score 60-69', () => {
        // 100 - 3*10 - 3*3 - 0*3 = 61 → D
        expect(formatHealthSignal(3, 3, 0).grade).toBe('D')
    })

    it('assigns grade F at score < 60', () => {
        // 100 - 4*10 - 3*3 - 0*3 = 51 → F
        expect(formatHealthSignal(3, 4, 0).grade).toBe('F')
    })

    it('handles 1 issue of each type', () => {
        // 100 - 1*3 - 1*10 - 1*3 = 84
        const result = formatHealthSignal(1, 1, 1)
        expect(result.fidelityScore).toBe(97)
        expect(result.a11yScore).toBe(90)
        expect(result.overrideCount).toBe(1)
        expect(result.overallScore).toBe(84)
        expect(result.grade).toBe('B')
    })
})
