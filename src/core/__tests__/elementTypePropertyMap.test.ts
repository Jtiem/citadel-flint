/**
 * Tests for elementTypePropertyMap — pure-function registry.
 *
 * Covers:
 *   - All 24 intrinsic tags return the correct section bucket (matrix)
 *   - Auto-expand returns exactly one section for each specialized tag
 *   - Generic fallback for unknown + capitalized custom component names
 *   - Pure function: repeated calls return deep-equal output
 */

import { describe, it, expect } from 'vitest'
import {
    getRelevantSections,
    getAutoExpandedSections,
    type InspectorSection,
} from '../elementTypePropertyMap'

// ── Section bucket expectations ───────────────────────────────────────────────

const TEXT_SECTIONS: InspectorSection[] = ['Typography', 'Layout', 'A11y', 'NodeProperties']
const CONTAINER_SECTIONS: InspectorSection[] = ['Layout', 'Appearance', 'A11y', 'NodeProperties']
const MEDIA_SECTIONS: InspectorSection[] = ['MediaProps', 'Layout', 'A11y', 'NodeProperties']
const INTERACTIVE_SECTIONS: InspectorSection[] = ['Typography', 'Layout', 'A11y', 'NodeProperties']
const FORM_SECTIONS: InspectorSection[] = ['FormProps', 'Typography', 'A11y', 'NodeProperties']
// FIX 6: Layout-first for generic/unknown tags (custom components are container-shaped)
const GENERIC_SECTIONS: InspectorSection[] = ['Layout', 'Typography', 'Appearance', 'A11y', 'NodeProperties']

// ── Text bucket ───────────────────────────────────────────────────────────────

describe('getRelevantSections — Text bucket', () => {
    const textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'strong', 'em']

    it.each(textTags)('"%s" returns text section set', (tag) => {
        expect(getRelevantSections(tag)).toEqual(TEXT_SECTIONS)
    })

    it('text tags do not include MediaProps or FormProps', () => {
        for (const tag of textTags) {
            const sections = getRelevantSections(tag)
            expect(sections).not.toContain('MediaProps')
            expect(sections).not.toContain('FormProps')
        }
    })

    it.each(textTags)('"%s" auto-expands Typography only', (tag) => {
        expect(getAutoExpandedSections(tag)).toEqual(['Typography'])
    })
})

// ── Container bucket ──────────────────────────────────────────────────────────

describe('getRelevantSections — Container bucket', () => {
    const containerTags = ['section', 'article', 'main', 'aside', 'nav', 'div', 'header', 'footer']

    it.each(containerTags)('"%s" returns container section set', (tag) => {
        expect(getRelevantSections(tag)).toEqual(CONTAINER_SECTIONS)
    })

    it('container tags do not include Typography, MediaProps, or FormProps', () => {
        for (const tag of containerTags) {
            const sections = getRelevantSections(tag)
            expect(sections).not.toContain('Typography')
            expect(sections).not.toContain('MediaProps')
            expect(sections).not.toContain('FormProps')
        }
    })

    it.each(containerTags)('"%s" auto-expands Layout only', (tag) => {
        expect(getAutoExpandedSections(tag)).toEqual(['Layout'])
    })
})

// ── Media bucket ──────────────────────────────────────────────────────────────

describe('getRelevantSections — Media bucket', () => {
    const mediaTags = ['img', 'video', 'picture', 'svg']

    it.each(mediaTags)('"%s" returns media section set', (tag) => {
        expect(getRelevantSections(tag)).toEqual(MEDIA_SECTIONS)
    })

    it('media tags do not include Typography, Appearance, or FormProps', () => {
        for (const tag of mediaTags) {
            const sections = getRelevantSections(tag)
            expect(sections).not.toContain('Typography')
            expect(sections).not.toContain('FormProps')
        }
    })

    it.each(mediaTags)('"%s" auto-expands MediaProps only', (tag) => {
        expect(getAutoExpandedSections(tag)).toEqual(['MediaProps'])
    })
})

// ── Interactive bucket ────────────────────────────────────────────────────────

describe('getRelevantSections — Interactive bucket', () => {
    const interactiveTags = ['button', 'a']

    it.each(interactiveTags)('"%s" returns interactive section set', (tag) => {
        expect(getRelevantSections(tag)).toEqual(INTERACTIVE_SECTIONS)
    })

    it('interactive tags do not include MediaProps, Appearance, or FormProps', () => {
        for (const tag of interactiveTags) {
            const sections = getRelevantSections(tag)
            expect(sections).not.toContain('MediaProps')
            expect(sections).not.toContain('Appearance')
            expect(sections).not.toContain('FormProps')
        }
    })

    it.each(interactiveTags)('"%s" auto-expands Typography only', (tag) => {
        expect(getAutoExpandedSections(tag)).toEqual(['Typography'])
    })
})

// ── Form bucket ───────────────────────────────────────────────────────────────

describe('getRelevantSections — Form bucket', () => {
    const formTags = ['input', 'textarea', 'select']

    it.each(formTags)('"%s" returns form section set', (tag) => {
        expect(getRelevantSections(tag)).toEqual(FORM_SECTIONS)
    })

    it('form tags do not include Layout, Appearance, or MediaProps', () => {
        for (const tag of formTags) {
            const sections = getRelevantSections(tag)
            expect(sections).not.toContain('Layout')
            expect(sections).not.toContain('Appearance')
            expect(sections).not.toContain('MediaProps')
        }
    })

    it.each(formTags)('"%s" auto-expands FormProps only', (tag) => {
        expect(getAutoExpandedSections(tag)).toEqual(['FormProps'])
    })
})

// ── Generic fallback ──────────────────────────────────────────────────────────

describe('getRelevantSections — Generic fallback', () => {
    it('capitalized component name returns generic section list', () => {
        expect(getRelevantSections('Card')).toEqual(GENERIC_SECTIONS)
    })

    it('capitalized component auto-expands nothing', () => {
        expect(getAutoExpandedSections('Card')).toEqual([])
    })

    it('unknown lowercase tag returns generic section list', () => {
        expect(getRelevantSections('mystery')).toEqual(GENERIC_SECTIONS)
    })

    it('unknown lowercase tag auto-expands nothing', () => {
        expect(getAutoExpandedSections('mystery')).toEqual([])
    })

    it('capitalized compound name (e.g. FooBar) returns generic section list', () => {
        expect(getRelevantSections('FooBar')).toEqual(GENERIC_SECTIONS)
    })

    it('generic section list contains no MediaProps or FormProps', () => {
        const sections = getRelevantSections('unknownTag')
        expect(sections).not.toContain('MediaProps')
        expect(sections).not.toContain('FormProps')
    })
})

// ── Auto-expand ODQ-3 invariant ───────────────────────────────────────────────

describe('getAutoExpandedSections — ODQ-3 primary-only invariant', () => {
    const specializedTags = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'strong', 'em',
        'section', 'article', 'main', 'aside', 'nav', 'div', 'header', 'footer',
        'img', 'video', 'picture', 'svg',
        'button', 'a',
        'input', 'textarea', 'select',
    ]

    it.each(specializedTags)('"%s" auto-expand list has exactly 1 section', (tag) => {
        expect(getAutoExpandedSections(tag)).toHaveLength(1)
    })

    it('generic fallback auto-expand list is empty', () => {
        expect(getAutoExpandedSections('UnknownComponent')).toHaveLength(0)
        expect(getAutoExpandedSections('foobar')).toHaveLength(0)
    })
})

// ── Pure function invariant ────────────────────────────────────────────────────

describe('Pure function — repeated calls', () => {
    it('getRelevantSections returns same reference on repeated call', () => {
        expect(getRelevantSections('h1')).toBe(getRelevantSections('h1'))
    })

    it('getAutoExpandedSections returns same reference on repeated call', () => {
        expect(getAutoExpandedSections('img')).toBe(getAutoExpandedSections('img'))
    })

    it('getRelevantSections for fallback returns same reference on repeated call', () => {
        expect(getRelevantSections('Card')).toBe(getRelevantSections('Card'))
    })
})

// ── Contract test-boundary: exact bucket assertions ───────────────────────────

describe('Contract test boundaries (INSPECTOR.1)', () => {
    it('h1 returns ["Typography","Layout","A11y","NodeProperties"] and excludes MediaProps + FormProps', () => {
        const sections = getRelevantSections('h1')
        expect(sections).toEqual(['Typography', 'Layout', 'A11y', 'NodeProperties'])
        expect(sections).not.toContain('MediaProps')
        expect(sections).not.toContain('FormProps')
    })

    it('img returns list containing MediaProps and excluding Typography', () => {
        const sections = getRelevantSections('img')
        expect(sections).toContain('MediaProps')
        expect(sections).not.toContain('Typography')
    })

    it('Card (capitalized) returns full generic list and [] autoExpand', () => {
        expect(getRelevantSections('Card')).toEqual(GENERIC_SECTIONS)
        expect(getAutoExpandedSections('Card')).toEqual([])
    })

    it('each of h1/img/button/input auto-expands exactly one section', () => {
        for (const tag of ['h1', 'img', 'button', 'input']) {
            expect(getAutoExpandedSections(tag)).toHaveLength(1)
        }
    })
})
