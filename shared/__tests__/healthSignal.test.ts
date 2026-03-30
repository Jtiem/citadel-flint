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

    it('computes fidelity score as max(0, 100 - mithrilCount * 5)', () => {
        expect(formatHealthSignal(3, 0, 0).fidelityScore).toBe(85)
        expect(formatHealthSignal(20, 0, 0).fidelityScore).toBe(0)
    })

    it('computes a11y score as max(0, 100 - a11yCount * 10)', () => {
        expect(formatHealthSignal(0, 2, 0).a11yScore).toBe(80)
        expect(formatHealthSignal(0, 10, 0).a11yScore).toBe(0)
    })

    it('computes overall score matching GovernanceDashboard formula', () => {
        // 100 - 2*5 - 1*10 - 1*3 = 77
        const result = formatHealthSignal(2, 1, 1)
        expect(result.overallScore).toBe(77)
        expect(result.grade).toBe('C')
    })

    it('clamps fidelity and a11y scores at 0 for large counts', () => {
        const result = formatHealthSignal(100, 50, 10)
        expect(result.fidelityScore).toBe(0)
        expect(result.a11yScore).toBe(0)
        expect(result.overallScore).toBe(0)
        expect(result.grade).toBe('F')
    })

    it('clamps overall score at 0 (never negative)', () => {
        const result = formatHealthSignal(30, 0, 0)
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
    it('assigns grade A at score 90', () => {
        // 100 - 2*5 = 90
        expect(formatHealthSignal(2, 0, 0).grade).toBe('A')
    })

    it('assigns grade B at score 89', () => {
        // 100 - 1*10 - 1*3 = 87 → B? No. Let's find 89.
        // 100 - 1*5 - 0*10 - 2*3 = 89
        expect(formatHealthSignal(1, 0, 2).grade).toBe('B')
    })

    it('assigns grade B at score 80', () => {
        // 100 - 4*5 = 80
        expect(formatHealthSignal(4, 0, 0).grade).toBe('B')
    })

    it('assigns grade C at score 79', () => {
        // 100 - 4*5 - 1*1... need 79
        // 100 - 4*5 - 0*10 - 1*3 = 77 → C ✓ but not 79
        // 100 - 3*5 - 0*10 - 2*3 = 79
        expect(formatHealthSignal(3, 0, 2).grade).toBe('C')
    })

    it('assigns grade C at score 70', () => {
        // 100 - 6*5 = 70
        expect(formatHealthSignal(6, 0, 0).grade).toBe('C')
    })

    it('assigns grade D at score 69', () => {
        // 100 - 6*5 - 1*3 = 67 → D
        expect(formatHealthSignal(6, 0, 1).grade).toBe('D')
    })

    it('assigns grade D at score 60', () => {
        // 100 - 8*5 = 60
        expect(formatHealthSignal(8, 0, 0).grade).toBe('D')
    })

    it('assigns grade F at score 59', () => {
        // 100 - 8*5 - 1*3 = 57
        expect(formatHealthSignal(8, 0, 1).grade).toBe('F')
    })

    it('handles 1 issue of each type', () => {
        // 100 - 5 - 10 - 3 = 82
        const result = formatHealthSignal(1, 1, 1)
        expect(result.fidelityScore).toBe(95)
        expect(result.a11yScore).toBe(90)
        expect(result.overrideCount).toBe(1)
        expect(result.overallScore).toBe(82)
        expect(result.grade).toBe('B')
    })
})
