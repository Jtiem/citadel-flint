/**
 * Tailwind emitter tests -- flint-mcp/src/core/emitters/__tests__/tailwindEmitter.test.ts
 *
 * EXP.7: Tests for the Tailwind CSS v4 theme config emitter.
 */

import { describe, it, expect } from 'vitest'
import { TailwindEmitter, createTailwindEmitter } from '../tailwindEmitter.js'
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

describe('TailwindEmitter', () => {
    const emitter = new TailwindEmitter()

    // 1. Platform metadata
    it('should report platform as "tailwind"', () => {
        expect(emitter.platform).toBe('tailwind')
    })

    it('should have defaultFilename "tailwind.config.ts"', () => {
        expect(emitter.defaultFilename).toBe('tailwind.config.ts')
    })

    // 2. Empty tokens
    it('should produce valid output with empty token array', () => {
        const output = emitter.emit([])
        expect(output.platform).toBe('tailwind')
        expect(output.filename).toBe('tailwind.config.ts')
        expect(output.mimeType).toBe('application/typescript')
        expect(output.tokenCount).toBe(0)
        expect(output.skippedTokens).toEqual([])
        expect(output.code).toContain('export default')
        expect(output.code).toContain('satisfies Config')
        expect(output.code).toContain('theme:')
        expect(output.code).toContain('extend:')
    })

    // 3. Color tokens
    it('should map color tokens to theme.extend.colors', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.primary.500', token_type: 'color', token_value: '#3B82F6' }),
            makeToken({ token_path: 'colors.secondary', token_type: 'color', token_value: '#9333EA' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(2)
        expect(output.code).toContain('colors:')
        expect(output.code).toContain("'primary-500': '#3B82F6'")
        expect(output.code).toContain("'secondary': '#9333EA'")
    })

    // 4. Typography tokens -- fontFamily
    it('should map fontFamily tokens to theme.extend.fontFamily as arrays', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'typography.sans', token_type: 'fontFamily', token_value: "'Inter', sans-serif" }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(1)
        expect(output.code).toContain('fontFamily:')
        expect(output.code).toContain("'sans': ['Inter', 'sans-serif']")
    })

    // 5. Typography tokens -- fontWeight, lineHeight, letterSpacing
    it('should map fontWeight, lineHeight, and letterSpacing to their sections', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'typography.bold', token_type: 'fontWeight', token_value: '700' }),
            makeToken({ token_path: 'typography.normal', token_type: 'lineHeight', token_value: '1.5' }),
            makeToken({ token_path: 'typography.wide', token_type: 'letterSpacing', token_value: '0.05em' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(3)
        expect(output.code).toContain('fontWeight:')
        expect(output.code).toContain("'bold': '700'")
        expect(output.code).toContain('lineHeight:')
        expect(output.code).toContain("'normal': '1.5'")
        expect(output.code).toContain('letterSpacing:')
        expect(output.code).toContain("'wide': '0.05em'")
    })

    // 6. Spacing tokens (dimension with spacing path hints)
    it('should map dimension tokens with spacing paths to theme.extend.spacing', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'spacing.base', token_type: 'dimension', token_value: '16px' }),
            makeToken({ token_path: 'spacing.large', token_type: 'dimension', token_value: '32px' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(2)
        expect(output.code).toContain('spacing:')
        expect(output.code).toContain("'base': '16px'")
        expect(output.code).toContain("'large': '32px'")
    })

    // 7. fontSize tokens (dimension with fontSize path hints)
    it('should map dimension tokens with fontSize paths to theme.extend.fontSize', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'fontSize.heading-1', token_type: 'dimension', token_value: '2.25rem' }),
            makeToken({ token_path: 'text.body', token_type: 'dimension', token_value: '1rem' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(2)
        expect(output.code).toContain('fontSize:')
        expect(output.code).toContain("'heading-1': '2.25rem'")
        expect(output.code).toContain("'body': '1rem'")
    })

    // 8. Shadow tokens -> boxShadow
    it('should map shadow tokens to theme.extend.boxShadow', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'shadow.sm', token_type: 'shadow', token_value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(1)
        expect(output.code).toContain('boxShadow:')
        expect(output.code).toContain("'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)'")
    })

    // 9. Opacity tokens
    it('should map opacity tokens to theme.extend.opacity', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'opacity.disabled', token_type: 'opacity', token_value: '0.5' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(1)
        expect(output.code).toContain('opacity:')
        expect(output.code).toContain("'disabled': '0.5'")
    })

    // 10. Unsupported token types are skipped
    it('should skip string and boolean tokens and record them in skippedTokens', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'meta.appName', token_type: 'string', token_value: 'Flint' }),
            makeToken({ token_path: 'flags.darkMode', token_type: 'boolean', token_value: 'true' }),
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#000' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(1)
        expect(output.skippedTokens).toHaveLength(2)
        expect(output.skippedTokens[0].tokenPath).toBe('meta.appName')
        expect(output.skippedTokens[0].tokenType).toBe('string')
        expect(output.skippedTokens[0].reason).toContain('no Tailwind CSS equivalent')
        expect(output.skippedTokens[1].tokenPath).toBe('flags.darkMode')
        expect(output.skippedTokens[1].tokenType).toBe('boolean')
    })

    // 11. Token path conversion (dot to dash, first segment stripped)
    it('should convert token paths correctly: dots to dashes, strip first segment', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.brand.primary.500', token_type: 'color', token_value: '#ABC' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.code).toContain("'brand-primary-500': '#ABC'")
    })

    // 12. Single-segment path preserved
    it('should preserve single-segment token paths', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'primary', token_type: 'color', token_value: '#FFF' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.code).toContain("'primary': '#FFF'")
    })

    // 13. Validation passes for valid output
    it('should pass validation for valid emit output', () => {
        const output = emitter.emit([
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#000' }),
        ])
        const result = emitter.validate(output)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
    })

    // 14. Validation passes for empty-token output
    it('should pass validation for empty token output', () => {
        const output = emitter.emit([])
        const result = emitter.validate(output)
        expect(result.valid).toBe(true)
        expect(result.errors).toEqual([])
    })

    // 15. Validation fails for missing export default
    it('should fail validation when export default is missing', () => {
        const fakeOutput: PlatformOutput = {
            platform: 'tailwind',
            code: 'const x = {}',
            filename: 'tailwind.config.ts',
            tokenCount: 0,
            skippedTokens: [],
            mimeType: 'application/typescript',
        }
        const result = emitter.validate(fakeOutput)
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.message.includes('export default'))).toBe(true)
    })

    // 16. Validation fails for unbalanced braces
    it('should fail validation when braces are unbalanced', () => {
        const fakeOutput: PlatformOutput = {
            platform: 'tailwind',
            code: 'export default { theme: { } satisfies Config',
            filename: 'tailwind.config.ts',
            tokenCount: 0,
            skippedTokens: [],
            mimeType: 'application/typescript',
        }
        const result = emitter.validate(fakeOutput)
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.message.includes('Unbalanced braces'))).toBe(true)
    })

    // 17. Mode filtering
    it('should filter tokens by mode when options.mode is set', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#FFF', mode: 'Light' }),
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#000', mode: 'Dark' }),
        ]
        const output = emitter.emit(tokens, { mode: 'Light' })
        expect(output.tokenCount).toBe(1)
        expect(output.code).toContain("'#FFF'")
        expect(output.code).not.toContain("'#000'")
    })

    // 18. Collection filtering
    it('should filter tokens by collection when options.collection is set', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.primary', token_type: 'color', token_value: '#AAA', collection_name: 'brand' }),
            makeToken({ token_path: 'colors.secondary', token_type: 'color', token_value: '#BBB', collection_name: 'other' }),
        ]
        const output = emitter.emit(tokens, { collection: 'brand' })
        expect(output.tokenCount).toBe(1)
        expect(output.code).toContain("'#AAA'")
        expect(output.code).not.toContain("'#BBB'")
    })

    // 19. Generated header
    it('should include a generated header comment with timestamp', () => {
        const output = emitter.emit([])
        expect(output.code).toContain('// Generated by Flint EXP.7 -- DO NOT EDIT')
        expect(output.code).toContain('// Source: .flint/design-tokens.json')
        expect(output.code).toContain('// Generated at:')
    })

    // 20. Factory function
    it('should create an instance via createTailwindEmitter factory', () => {
        const instance = createTailwindEmitter()
        expect(instance).toBeInstanceOf(TailwindEmitter)
        expect(instance.platform).toBe('tailwind')
    })

    // 21. Mixed token types produce all sections
    it('should emit all theme sections when given a mix of token types', () => {
        const tokens: DesignToken[] = [
            makeToken({ token_path: 'colors.red', token_type: 'color', token_value: '#F00' }),
            makeToken({ token_path: 'spacing.sm', token_type: 'dimension', token_value: '8px' }),
            makeToken({ token_path: 'typography.mono', token_type: 'fontFamily', token_value: 'Fira Code, monospace' }),
            makeToken({ token_path: 'opacity.half', token_type: 'opacity', token_value: '0.5' }),
            makeToken({ token_path: 'shadow.md', token_type: 'shadow', token_value: '0 4px 6px rgba(0,0,0,0.1)' }),
        ]
        const output = emitter.emit(tokens)
        expect(output.tokenCount).toBe(5)
        expect(output.skippedTokens).toEqual([])
        expect(output.code).toContain('colors:')
        expect(output.code).toContain('spacing:')
        expect(output.code).toContain('fontFamily:')
        expect(output.code).toContain('opacity:')
        expect(output.code).toContain('boxShadow:')
    })
})
