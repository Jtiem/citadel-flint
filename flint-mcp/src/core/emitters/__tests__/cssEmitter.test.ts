/**
 * CSS Custom Properties emitter tests -- flint-mcp/src/core/emitters/__tests__/cssEmitter.test.ts
 *
 * EXP.7: Tests for the CSS custom properties emitter.
 */

import { describe, it, expect } from 'vitest'
import { CSSEmitter, createCSSEmitter } from '../cssEmitter.js'
import type { DesignToken } from '../../../types.js'
import type { PlatformOutput } from '../types.js'

// -- Helpers ------------------------------------------------------------------

function makeToken(overrides: Partial<DesignToken> & Pick<DesignToken, 'token_path' | 'token_type' | 'token_value'>): DesignToken {
    return {
        id: 1,
        description: null,
        collection_name: 'default',
        mode: 'default',
        ...overrides,
    }
}

// -- Tests --------------------------------------------------------------------

describe('CSSEmitter', () => {
    const emitter = new CSSEmitter()

    // 1. Platform metadata
    it('should report platform as "css"', () => {
        expect(emitter.platform).toBe('css')
    })

    it('should have defaultFilename "variables.css"', () => {
        expect(emitter.defaultFilename).toBe('variables.css')
    })

    // 2. Empty tokens -> :root {}
    it('should produce :root {} with empty token array', () => {
        const output = emitter.emit([])
        expect(output.platform).toBe('css')
        expect(output.filename).toBe('variables.css')
        expect(output.mimeType).toBe('text/css')
        expect(output.tokenCount).toBe(0)
        expect(output.skippedTokens).toEqual([])
        expect(output.code).toContain(':root {')
        expect(output.code).toContain('}')
    })

    // 3. Color tokens -> correct CSS custom properties
    it('should emit color tokens as CSS custom properties', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#3B82F6' }),
            makeToken({ token_path: 'colors.secondary', token_type: 'color', token_value: '#9333EA' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(2)
        expect(output.code).toContain('--colors-primary: #3B82F6;')
        expect(output.code).toContain('--colors-secondary: #9333EA;')
    })

    // 4. All token types are emitted (except boolean)
    it('should emit all token types except boolean', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#000' }),
            makeToken({ token_path: 'spacing.base', token_type: 'dimension', token_value: '16px' }),
            makeToken({ token_path: 'typography.sans', token_type: 'fontFamily', token_value: 'Inter, sans-serif' }),
            makeToken({ token_path: 'typography.bold', token_type: 'fontWeight', token_value: '700' }),
            makeToken({ token_path: 'typography.normal', token_type: 'lineHeight', token_value: '1.5' }),
            makeToken({ token_path: 'typography.wide', token_type: 'letterSpacing', token_value: '0.05em' }),
            makeToken({ token_path: 'shadow.sm', token_type: 'shadow', token_value: '0 1px 2px rgba(0,0,0,0.05)' }),
            makeToken({ token_path: 'opacity.disabled', token_type: 'opacity', token_value: '0.5' }),
            makeToken({ token_path: 'meta.name', token_type: 'string', token_value: 'Flint' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(9) // all except none -- string is supported in CSS
        expect(output.code).toContain('--colors-primary: #000;')
        expect(output.code).toContain('--spacing-base: 16px;')
        expect(output.code).toContain('--typography-sans: Inter, sans-serif;')
        expect(output.code).toContain('--typography-bold: 700;')
        expect(output.code).toContain('--typography-normal: 1.5;')
        expect(output.code).toContain('--typography-wide: 0.05em;')
        expect(output.code).toContain('--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);')
        expect(output.code).toContain('--opacity-disabled: 0.5;')
        expect(output.code).toContain('--meta-name: Flint;')
    })

    // 5. Boolean tokens are skipped
    it('should skip boolean tokens and record them in skippedTokens', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'flags.darkMode', token_type: 'boolean', token_value: 'true' }),
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#FFF' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(1)
        expect(output.skippedTokens).toHaveLength(1)
        expect(output.skippedTokens[0].tokenPath).toBe('flags.darkMode')
        expect(output.skippedTokens[0].tokenType).toBe('boolean')
        expect(output.skippedTokens[0].reason).toContain('no CSS custom property equivalent')
    })

    // 6. Prefix option
    it('should apply prefix to CSS variable names when options.prefix is set', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.primary.500', token_type: 'color', token_value: '#3B82F6' }),
        ]
        const output = emitter.emit(tokens, { prefix: 'acme' })
        expect(output.code).toContain('--acme-colors-primary-500: #3B82F6;')
    })

    // 7. Token path conversion (dot to dash)
    it('should convert token paths: dots to dashes with -- prefix', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.brand.primary.500', token_type: 'color', token_value: '#ABC' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.code).toContain('--colors-brand-primary-500: #ABC;')
    })

    // 8. Validate passes for valid output
    it('should pass validation for valid emit output', () => {
        const output = emitter.emit([
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#000' }),
        ])
        const result = emitter.validate(output)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
    })

    // 9. Validate passes for empty-token output
    it('should pass validation for empty token output', () => {
        const output = emitter.emit([])
        const result = emitter.validate(output)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
    })

    // 10. Validate fails when :root is missing
    it('should fail validation when :root { is missing', () => {
        const fakeOutput: PlatformOutput = {
            platform: 'css',
            code: '.custom { --x: 1; }',
            filename: 'variables.css',
            tokenCount: 1,
            skippedTokens: [],
            mimeType: 'text/css',
        }
        const result = emitter.validate(fakeOutput)
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.message.includes(':root'))).toBe(true)
    })

    // 11. Validate fails when closing brace is missing
    it('should fail validation when closing brace is missing', () => {
        const fakeOutput: PlatformOutput = {
            platform: 'css',
            code: ':root {\n    --x: 1;',
            filename: 'variables.css',
            tokenCount: 1,
            skippedTokens: [],
            mimeType: 'text/css',
        }
        const result = emitter.validate(fakeOutput)
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.message.includes('closing brace'))).toBe(true)
    })

    // 12. Mode filtering
    it('should filter tokens by mode when options.mode is set', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#FFF', mode: 'Light' }),
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#000', mode: 'Dark' }),
        ]
        const output = emitter.emit(tokens, { mode: 'Light' })
        expect(output.tokenCount).toBe(1)
        expect(output.code).toContain('#FFF')
        expect(output.code).not.toContain('#000')
    })

    // 13. Collection filtering
    it('should filter tokens by collection when options.collection is set', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#AAA', collection_name: 'brand' }),
            makeToken({ token_path: 'colors.secondary', token_type: 'color', token_value: '#BBB', collection_name: 'other' }),
        ]
        const output = emitter.emit(tokens, { collection: 'brand' })
        expect(output.tokenCount).toBe(1)
        expect(output.code).toContain('#AAA')
        expect(output.code).not.toContain('#BBB')
    })

    // 14. Multi-mode output (Light + Dark)
    it('should emit separate selectors for multi-mode tokens', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#FFF', mode: 'Light' }),
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#000', mode: 'Dark' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(2)
        expect(output.code).toContain(':root')
        expect(output.code).toContain('[data-theme="dark"]')
        expect(output.code).toContain('#FFF')
        expect(output.code).toContain('#000')
    })

    // 15. Generated header
    it('should include a generated header comment with timestamp', () => {
        const output = emitter.emit([])
        expect(output.code).toContain('/* Generated by Flint EXP.7 -- DO NOT EDIT */')
        expect(output.code).toContain('/* Source: .flint/design-tokens.json */')
        expect(output.code).toContain('/* Generated at:')
    })

    // 16. Category grouping comments
    it('should group tokens by category with CSS comments', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.red', token_type: 'color', token_value: '#F00' }),
            makeToken({ token_path: 'spacing.sm', token_type: 'dimension', token_value: '8px' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.code).toContain('/* Colors */')
        expect(output.code).toContain('/* Spacing */')
    })

    // 17. Font family formatting
    it('should format font family values with proper quoting', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'typography.heading', token_type: 'fontFamily', token_value: "'Fira Sans', Arial, sans-serif" }),
        ]
        const output = emitter.emit(tokens)
        expect(output.code).toContain("--typography-heading: 'Fira Sans', Arial, sans-serif;")
    })

    // 18. Factory function
    it('should create an instance via createCSSEmitter factory', () => {
        const instance = createCSSEmitter()
        expect(instance).toBeInstanceOf(CSSEmitter)
        expect(instance.platform).toBe('css')
    })

    // 19. Validate fails for unbalanced braces
    it('should fail validation when braces are unbalanced', () => {
        const fakeOutput: PlatformOutput = {
            platform: 'css',
            code: ':root {\n    --x: 1;\n}\n}',
            filename: 'variables.css',
            tokenCount: 1,
            skippedTokens: [],
            mimeType: 'text/css',
        }
        const result = emitter.validate(fakeOutput)
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.message.includes('brace'))).toBe(true)
    })

    // 20. Prefix with multi-segment path
    it('should apply prefix correctly to multi-segment token paths', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'spacing.page.gutter', token_type: 'dimension', token_value: '24px' }),
        ]
        const output = emitter.emit(tokens, { prefix: 'ds' })
        expect(output.code).toContain('--ds-spacing-page-gutter: 24px;')
    })

    // 21. Validate accepts data-theme selectors
    it('should pass validation for multi-mode output with data-theme selectors', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.bg', token_type: 'color', token_value: '#FFF', mode: 'Light' }),
            makeToken({ token_path: 'colors.bg', token_type: 'color', token_value: '#111', mode: 'Dark' }),
        ]
        const output = emitter.emit(tokens)
        const result = emitter.validate(output)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
    })
})
