/**
 * P5: Behavioral & Motion Governance tests (AnimationLinter)
 * flint-mcp/src/core/__tests__/animationLinter.test.ts
 */

import { describe, it, expect } from 'vitest'
import { parse } from '@babel/parser'
import type { File } from '@babel/types'
import {
    visitMotionDrift,
    extractDurationMs,
    extractEasing,
} from '../AnimationLinter.js'
import { auditAll } from '../MithrilLinter.js'
import type { MotionToken, DesignToken } from '../../types.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJSX(source: string): File {
    return parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        errorRecovery: true,
    }) as unknown as File
}

const MOTION_TOKENS: MotionToken[] = [
    {
        token_path: 'transition.interactive',
        token_type: 'motion',
        token_value: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
        duration: '200ms',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        property: 'all',
    },
    {
        token_path: 'transition.page',
        token_type: 'motion',
        token_value: '300ms ease-out',
        duration: '300ms',
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
    },
]

// ── Helpers tests ────────────────────────────────────────────────────────────

describe('AnimationLinter — helpers', () => {
    it('extractDurationMs parses ms and s units', () => {
        expect(extractDurationMs('200ms')).toBe(200)
        expect(extractDurationMs('0.3s ease-out')).toBe(300)
        expect(extractDurationMs('all 150ms linear')).toBe(150)
        expect(extractDurationMs('ease-out')).toBeNull()
    })

    it('extractEasing parses cubic-bezier and keywords', () => {
        expect(extractEasing('cubic-bezier(0.4, 0, 0.2, 1)')).toBe('cubic-bezier(0.4,0,0.2,1)')
        expect(extractEasing('200ms ease-in-out')).toBe('ease-in-out')
        expect(extractEasing('200ms linear')).toBe('linear')
        expect(extractEasing('200ms')).toBeNull()
    })
})

// ── Main visitor tests ──────────────────────────────────────────────────────

describe('visitMotionDrift — class-based motion drift', () => {
    it('1) duration-200 with matching motion token → suggests token swap', () => {
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" className="transition duration-200 ease-out" />)`,
        )
        const warnings = visitMotionDrift(ast, MOTION_TOKENS)
        const durationWarning = warnings.find((w) => w.message.includes('duration-200'))
        expect(durationWarning).toBeDefined()
        expect(durationWarning!.ruleId).toBe('MOTION-001')
        expect(durationWarning!.type).toBe('motion-drift')
        expect(durationWarning!.nearestToken).toBe('transition.interactive')
        expect(durationWarning!.fixable).toBe(true)
        expect(durationWarning!.severity).toBe('amber')
    })

    it('2) duration-[347ms] arbitrary value → flags MOTION-001', () => {
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" className="transition duration-[347ms]" />)`,
        )
        const warnings = visitMotionDrift(ast, MOTION_TOKENS)
        const w = warnings.find((w) => w.message.includes('duration-[347ms]'))
        expect(w).toBeDefined()
        expect(w!.ruleId).toBe('MOTION-001')
        expect(w!.nearestToken).toBeNull()
        expect(w!.fixable).toBe(false)
    })

    it('3) ease-[cubic-bezier(...)] arbitrary easing → flags MOTION-001', () => {
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" className="transition ease-[cubic-bezier(0.87,0,0.13,1)]" />)`,
        )
        const warnings = visitMotionDrift(ast, MOTION_TOKENS)
        const w = warnings.find((w) => w.message.includes('ease-[cubic-bezier'))
        expect(w).toBeDefined()
        expect(w!.ruleId).toBe('MOTION-001')
        expect(w!.nearestToken).toBeNull()
    })

    it('4) Standard ease-linear with no motion tokens → advisory only', () => {
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" className="transition ease-linear" />)`,
        )
        const warnings = visitMotionDrift(ast, [])
        const w = warnings.find((w) => w.message.includes('ease-linear'))
        expect(w).toBeDefined()
        expect(w!.severity).toBe('advisory')
        expect(w!.fixable).toBe(false)
    })

    it('5) Inline style={{ transition: "200ms ease" }} → flags with token suggestion', () => {
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" style={{ transition: '200ms ease' }} />)`,
        )
        const warnings = visitMotionDrift(ast, MOTION_TOKENS)
        const w = warnings.find((w) => w.message.includes('transition'))
        expect(w).toBeDefined()
        expect(w!.ruleId).toBe('MOTION-001')
        // 200ms matches transition.interactive duration
        expect(w!.nearestToken).toBe('transition.interactive')
    })

    it('6) animate-spin preset utility → no flag (library builtin)', () => {
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" className="animate-spin" />)`,
        )
        const warnings = visitMotionDrift(ast, MOTION_TOKENS)
        const spinWarning = warnings.find((w) => w.message.includes('animate-spin'))
        expect(spinWarning).toBeUndefined()
    })

    it('7) No motion tokens and no motion classes → skips entirely', () => {
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" className="flex items-center p-4" />)`,
        )
        const warnings = visitMotionDrift(ast, [])
        expect(warnings).toHaveLength(0)
    })

    it('8) Multiple motion classes in one element → one violation per non-token value', () => {
        const ast = parseJSX(
            `const App = () => (
                <div data-flint-id="node-1"
                     className="transition duration-[347ms] ease-[cubic-bezier(0.87,0,0.13,1)]" />
            )`,
        )
        const warnings = visitMotionDrift(ast, MOTION_TOKENS)
        // One for duration-[347ms] + one for ease-[cubic-bezier]
        const flagged = warnings.filter((w) => w.ruleId === 'MOTION-001')
        expect(flagged.length).toBe(2)
        const kinds = flagged.map((w) => w.message)
        expect(kinds.some((m) => m.includes('duration-[347ms]'))).toBe(true)
        expect(kinds.some((m) => m.includes('ease-[cubic-bezier'))).toBe(true)
    })

    it('9) Empty component → no violations', () => {
        const ast = parseJSX(`const App = () => (<></>)`)
        const warnings = visitMotionDrift(ast, MOTION_TOKENS)
        expect(warnings).toHaveLength(0)
    })

    it('10) Policy MOTION-001: off → no violations even with arbitrary values', () => {
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" className="duration-[347ms] ease-[cubic-bezier(0.87,0,0.13,1)]" />)`,
        )
        const warnings = visitMotionDrift(ast, MOTION_TOKENS, {
            ruleModes: { 'MOTION-001': 'off' },
        })
        expect(warnings).toHaveLength(0)
    })

    it('11) ease-linear with matching token → suggests swap', () => {
        const linearToken: MotionToken[] = [
            {
                token_path: 'motion.linear',
                token_type: 'motion',
                token_value: 'linear',
                easing: 'linear',
            },
        ]
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" className="transition ease-linear" />)`,
        )
        const warnings = visitMotionDrift(ast, linearToken)
        const w = warnings.find((w) => w.message.includes('ease-linear'))
        expect(w).toBeDefined()
        expect(w!.nearestToken).toBe('motion.linear')
        expect(w!.fixable).toBe(true)
    })

    it('12) auditAll integration — motion warnings merge into overall results', () => {
        const ast = parseJSX(
            `const App = () => (<div data-flint-id="node-1" className="transition duration-[999ms]" />)`,
        )
        const tokens: DesignToken[] = []
        const merged = auditAll(ast, tokens, { motionTokens: MOTION_TOKENS })
        const motionWarnings = [...merged.values()].filter(
            (w) => w.ruleId === 'MOTION-001',
        )
        expect(motionWarnings.length).toBeGreaterThan(0)
    })
})
