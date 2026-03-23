/**
 * Tests for emitter registry -- flint-mcp/src/core/emitters/__tests__/registry.test.ts
 *
 * Covers:
 *   - registerEmitter stores a factory
 *   - getEmitter returns an emitter from the factory
 *   - getEmitter throws for unregistered platform
 *   - getAvailablePlatforms returns registered platforms
 *   - hasEmitter returns correct boolean
 *   - Multiple registrations are tracked independently
 */

import { describe, it, expect, beforeEach } from 'vitest'

// We test the exported functions. Since the registry is module-level state,
// we need to be aware that registrations persist across tests within the
// same module instance. We test in a way that accounts for this.
import {
    registerEmitter,
    getEmitter,
    getAvailablePlatforms,
    hasEmitter,
} from '../index.js'
import type { PlatformEmitter, PlatformOutput, ValidationResult, DesignToken } from '../types.js'

// ---- Mock emitter factory -----------------------------------------------------

function createMockEmitter(platform: 'tailwind' | 'css' | 'react-native' | 'swift' | 'kotlin'): PlatformEmitter {
    return {
        platform,
        defaultFilename: `mock-${platform}.txt`,
        emit(tokens: DesignToken[]): PlatformOutput {
            return {
                platform,
                code: `// mock ${platform} output`,
                filename: `mock-${platform}.txt`,
                tokenCount: tokens.length,
                skippedTokens: [],
                mimeType: 'text/plain',
            }
        },
        validate(_output: PlatformOutput): ValidationResult {
            return { valid: true, errors: [] }
        },
    }
}

// ---- Tests --------------------------------------------------------------------

describe('Emitter Registry', () => {
    it('registerEmitter stores a factory and getEmitter retrieves it', () => {
        registerEmitter('tailwind', () => createMockEmitter('tailwind'))
        const emitter = getEmitter('tailwind')
        expect(emitter.platform).toBe('tailwind')
    })

    it('getEmitter throws for an unregistered platform', () => {
        // 'kotlin' may or may not be registered depending on test order,
        // but we can test by checking a platform we know we haven't registered
        // Actually since we control registrations, let's just verify the error path
        // by using a cast to bypass type safety
        expect(() => getEmitter('flutter' as any)).toThrow('No emitter registered for platform: flutter')
    })

    it('getEmitter calls the factory each time (fresh instances)', () => {
        let callCount = 0
        registerEmitter('css', () => {
            callCount++
            return createMockEmitter('css')
        })

        getEmitter('css')
        getEmitter('css')
        expect(callCount).toBe(2) // Factory called each time
    })

    it('getAvailablePlatforms returns all registered platforms', () => {
        registerEmitter('react-native', () => createMockEmitter('react-native'))
        const platforms = getAvailablePlatforms()
        expect(platforms).toContain('tailwind')
        expect(platforms).toContain('css')
        expect(platforms).toContain('react-native')
    })

    it('hasEmitter returns true for registered platforms', () => {
        expect(hasEmitter('tailwind')).toBe(true)
        expect(hasEmitter('css')).toBe(true)
    })

    it('hasEmitter returns false for unregistered platforms', () => {
        expect(hasEmitter('flutter' as any)).toBe(false)
    })

    it('emitter emit() produces correct PlatformOutput shape', () => {
        const emitter = getEmitter('tailwind')
        const tokens: DesignToken[] = [{
            id: 1,
            token_path: 'colors.brand.primary',
            token_type: 'color',
            token_value: '#3B82F6',
            description: null,
            collection_name: 'colors',
            mode: 'default',
        }]
        const output = emitter.emit(tokens)
        expect(output).toHaveProperty('platform', 'tailwind')
        expect(output).toHaveProperty('code')
        expect(output).toHaveProperty('filename')
        expect(output).toHaveProperty('tokenCount', 1)
        expect(output).toHaveProperty('skippedTokens')
        expect(output).toHaveProperty('mimeType')
    })

    it('emitter validate() returns a ValidationResult', () => {
        const emitter = getEmitter('css')
        const output: PlatformOutput = {
            platform: 'css',
            code: ':root { --test: #fff; }',
            filename: 'variables.css',
            tokenCount: 1,
            skippedTokens: [],
            mimeType: 'text/css',
        }
        const result = emitter.validate(output)
        expect(result).toHaveProperty('valid')
        expect(result).toHaveProperty('errors')
        expect(Array.isArray(result.errors)).toBe(true)
    })
})
