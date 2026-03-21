/**
 * Motion rules — flint-mcp/src/core/a11y/rules/motion.ts
 *
 * A11Y-090: Tailwind animate-* classes must be guarded with motion-safe: or motion-reduce:
 * A11Y-091: <video> without controls attribute (or muted+autoplay) — SC 1.2.2 / 1.2.5
 * A11Y-092: <audio> without controls attribute — SC 1.2.1
 *
 * WCAG: 2.3.3 Animation from Interactions, 1.2.2 Captions, 1.2.1 Audio-only
 */

import type { A11yRule } from '../types.js'
import {
    getFlintId,
    getTagName,
    getJsxAttr,
    getAttributeStringValue,
} from '../helpers.js'

// ── A11Y-090: animate-* classes must have motion-safe/reduce guard ────────────

const rule090: A11yRule = {
    id: 'A11Y-090',
    name: 'Animation Without Reduced-Motion Guard',
    wcag: '2.3.3',
    level: 'AAA',
    category: 'motion',
    severity: 'warning',
    description:
        'Tailwind animate-* classes must be guarded with motion-safe: or motion-reduce: ' +
        'to respect the prefers-reduced-motion media query.',

    visitElement(path, _context) {
        const opening = path.node.openingElement
        const classNameAttr = getAttributeStringValue(opening, 'className')
        if (!classNameAttr) return null

        const classes = classNameAttr.split(/\s+/).filter(Boolean)

        // Find unguarded animate-* classes
        const animateClasses = classes.filter(
            (c) =>
                (c.startsWith('animate-') || c.startsWith('transition-') || c.startsWith('duration-')) &&
                !c.startsWith('motion-safe:') &&
                !c.startsWith('motion-reduce:'),
        )
        if (animateClasses.length === 0) return null

        // Check if there is any motion-safe: or motion-reduce: variant in the class list
        const hasMotionGuard = classes.some(
            (c) => c.startsWith('motion-safe:') || c.startsWith('motion-reduce:'),
        )
        if (hasMotionGuard) return null

        const tag = getTagName(path) ?? 'element'
        const elementId = getFlintId(opening, `${tag}-unguarded-animation`)

        return {
            ruleId: 'A11Y-090',
            elementId,
            message:
                `A11Y-090: <${tag}> has animation class(es) (${animateClasses.slice(0, 3).join(', ')}) ` +
                'without a prefers-reduced-motion guard. ' +
                'Wrap with motion-safe:animate-* or add motion-reduce:animate-none for users who prefer reduced motion.',
            severity: 'warning',
            wcag: '2.3.3',
            fixable: false,
        }
    },
}

// ── A11Y-091: <video> must have controls (unless muted+autoplay) ─────────────

const rule091: A11yRule = {
    id: 'A11Y-091',
    name: 'Video Missing Controls',
    wcag: '1.2.2',
    level: 'A',
    category: 'motion',
    severity: 'critical',
    description:
        '<video> elements must have a controls attribute unless they are purely decorative ' +
        '(muted + autoplay, no audio track).',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'video') return null

        const opening = path.node.openingElement

        // Has controls — compliant
        const controlsAttr = getJsxAttr(opening, 'controls')
        if (controlsAttr !== undefined) return null

        // Muted autoplay without sound is decorative — skip
        const mutedAttr = getJsxAttr(opening, 'muted')
        const autoPlayAttr = getJsxAttr(opening, 'autoPlay') ?? getJsxAttr(opening, 'autoplay')
        if (mutedAttr !== undefined && autoPlayAttr !== undefined) return null

        const elementId = getFlintId(opening, 'video-no-controls')

        return {
            ruleId: 'A11Y-091',
            elementId,
            message:
                'A11Y-091: <video> is missing the controls attribute. ' +
                'Users must be able to pause, stop, and control the volume of media. ' +
                'Add controls, or use muted+autoPlay for purely decorative background video.',
            severity: 'critical',
            wcag: '1.2.2',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added controls attribute to <video>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'controls',
                        value: '',
                    },
                },
            ],
        }
    },
}

// ── A11Y-092: <audio> must have controls ─────────────────────────────────────

const rule092: A11yRule = {
    id: 'A11Y-092',
    name: 'Audio Missing Controls',
    wcag: '1.2.1',
    level: 'A',
    category: 'motion',
    severity: 'critical',
    description: '<audio> elements must have a controls attribute.',

    visitElement(path, _context) {
        const tag = getTagName(path)
        if (tag !== 'audio') return null

        const opening = path.node.openingElement

        // Has controls — compliant
        const controlsAttr = getJsxAttr(opening, 'controls')
        if (controlsAttr !== undefined) return null

        const elementId = getFlintId(opening, 'audio-no-controls')

        return {
            ruleId: 'A11Y-092',
            elementId,
            message:
                'A11Y-092: <audio> is missing the controls attribute. ' +
                'Users must be able to control audio playback. Add controls to the element.',
            severity: 'critical',
            wcag: '1.2.1',
            fixable: true,
        }
    },

    fix(violation, _ast) {
        return {
            description: 'Added controls attribute to <audio>.',
            mutations: [
                {
                    type: 'updateProp',
                    args: {
                        nodeId: violation.elementId,
                        propName: 'controls',
                        value: '',
                    },
                },
            ],
        }
    },
}

// ── Export ────────────────────────────────────────────────────────────────────

export const motionRules: A11yRule[] = [rule090, rule091, rule092]
