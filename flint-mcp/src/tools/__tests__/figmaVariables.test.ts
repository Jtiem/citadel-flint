/**
 * figmaVariables.ts — Tool Handler Tests
 * flint-mcp/src/tools/__tests__/figmaVariables.test.ts
 *
 * flint_pull_variables tool handler tests.
 *
 * What we verify:
 *   1. Happy path: valid payload returns correct token count
 *   2. Missing payload returns error
 *   3. Invalid JSON returns error
 *   4. Mode filtering works (only requested mode in output)
 *   5. Token type summary in response stats
 *   6. Approval instructions present in output
 *   7. Source field includes fileKey when provided
 *   8. Payload with missing variableCollections returns error
 *   9. Empty variables returns 0 tokens
 *  10. Output tokens have correct shape for approval gateway
 */

import { describe, it, expect } from 'vitest'
import { handlePullVariables } from '../figmaVariables.js'
import type { PullVariablesOutput } from '../figmaVariables.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeValidPayload() {
    return JSON.stringify({
        variables: {
            'v1': {
                id: 'v1',
                name: 'Primary',
                resolvedType: 'COLOR',
                valuesByMode: {
                    'mode-1': { r: 0.231, g: 0.51, b: 0.965, a: 1 },
                },
                scopes: ['ALL_FILLS'],
            },
            'v2': {
                id: 'v2',
                name: 'Gap/Small',
                resolvedType: 'FLOAT',
                valuesByMode: {
                    'mode-1': 8,
                },
                scopes: ['GAP'],
            },
            'v3': {
                id: 'v3',
                name: 'Radius/Medium',
                resolvedType: 'FLOAT',
                valuesByMode: {
                    'mode-1': 12,
                },
                scopes: ['CORNER_RADIUS'],
            },
        },
        variableCollections: {
            'c1': {
                id: 'c1',
                name: 'Design System',
                modes: [{ modeId: 'mode-1', name: 'Default' }],
                variableIds: ['v1', 'v2', 'v3'],
            },
        },
    })
}

function makeMultiModePayload() {
    return JSON.stringify({
        variables: {
            'v1': {
                id: 'v1',
                name: 'Background',
                resolvedType: 'COLOR',
                valuesByMode: {
                    'light': { r: 1, g: 1, b: 1, a: 1 },
                    'dark': { r: 0.1, g: 0.1, b: 0.1, a: 1 },
                },
                scopes: ['ALL_FILLS'],
            },
        },
        variableCollections: {
            'c1': {
                id: 'c1',
                name: 'Theme',
                modes: [
                    { modeId: 'light', name: 'Light' },
                    { modeId: 'dark', name: 'Dark' },
                ],
                variableIds: ['v1'],
            },
        },
    })
}

function parseOutput(result: { content: Array<{ type: string; text: string }>; isError?: boolean }): PullVariablesOutput {
    return JSON.parse(result.content[0].text)
}

function parseError(result: { content: Array<{ type: string; text: string }>; isError?: boolean }): { error: string; detail?: string } {
    return JSON.parse(result.content[0].text)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('flint_pull_variables', () => {

    // 1. Happy path
    it('returns correct token count for valid payload', () => {
        const result = handlePullVariables({
            variablesPayload: makeValidPayload(),
        })

        expect(result.isError).toBeUndefined()

        const output = parseOutput(result)
        expect(output.tokens).toHaveLength(3)
        expect(output.stats.totalTokens).toBe(3)
    })

    // 2. Missing payload
    it('returns error when variablesPayload is missing', () => {
        const result = handlePullVariables({
            variablesPayload: '',
        })

        expect(result.isError).toBe(true)
        const err = parseError(result)
        expect(err.error).toContain('variablesPayload is required')
    })

    // 3. Invalid JSON
    it('returns error for invalid JSON payload', () => {
        const result = handlePullVariables({
            variablesPayload: 'not-valid-json{{{',
        })

        expect(result.isError).toBe(true)
        const err = parseError(result)
        expect(err.error).toContain('JSON parse failed')
    })

    // 4. Mode filtering
    it('filters to requested mode when mode parameter is set', () => {
        const result = handlePullVariables({
            variablesPayload: makeMultiModePayload(),
            mode: 'Dark',
        })

        const output = parseOutput(result)
        expect(output.tokens).toHaveLength(1)
        expect(output.tokens[0].mode).toBe('Dark')
    })

    // 5. Token type summary
    it('includes token type summary in stats', () => {
        const result = handlePullVariables({
            variablesPayload: makeValidPayload(),
        })

        const output = parseOutput(result)
        expect(output.stats.byType.color).toBe(1)
        expect(output.stats.byType.dimension).toBe(2)
    })

    // 6. Approval instructions present
    it('includes approval instructions in output', () => {
        const result = handlePullVariables({
            variablesPayload: makeValidPayload(),
        })

        const output = parseOutput(result)
        expect(output.approvalInstructions).toContain('flint_approve_tokens')
        expect(output.approvalInstructions).toContain('Figma Variables')
    })

    // 7. Source includes fileKey
    it('includes fileKey in source field when provided', () => {
        const result = handlePullVariables({
            variablesPayload: makeValidPayload(),
            fileKey: 'abc123',
        })

        const output = parseOutput(result)
        expect(output.source).toBe('figma-variables:abc123')
    })

    it('uses generic source when fileKey is not provided', () => {
        const result = handlePullVariables({
            variablesPayload: makeValidPayload(),
        })

        const output = parseOutput(result)
        expect(output.source).toBe('figma-variables')
    })

    // 8. Missing variableCollections
    it('returns error when variableCollections is missing', () => {
        const result = handlePullVariables({
            variablesPayload: JSON.stringify({ variables: {} }),
        })

        expect(result.isError).toBe(true)
        const err = parseError(result)
        expect(err.error).toContain('variableCollections')
    })

    // 9. Empty variables
    it('returns 0 tokens for empty variables object', () => {
        const result = handlePullVariables({
            variablesPayload: JSON.stringify({
                variables: {},
                variableCollections: {},
            }),
        })

        const output = parseOutput(result)
        expect(output.tokens).toHaveLength(0)
        expect(output.stats.totalTokens).toBe(0)
    })

    // 10. Output token shape matches approval gateway
    it('output tokens have path/value/type shape for approval gateway', () => {
        const result = handlePullVariables({
            variablesPayload: makeValidPayload(),
        })

        const output = parseOutput(result)
        for (const token of output.tokens) {
            expect(token).toHaveProperty('path')
            expect(token).toHaveProperty('value')
            expect(token).toHaveProperty('type')
            expect(token).toHaveProperty('collection')
            expect(token).toHaveProperty('mode')
            expect(typeof token.path).toBe('string')
            expect(typeof token.value).toBe('string')
            expect(typeof token.type).toBe('string')
        }
    })

    // 11. Multi-mode without filter produces all modes
    it('produces tokens for all modes when no filter is set', () => {
        const result = handlePullVariables({
            variablesPayload: makeMultiModePayload(),
        })

        const output = parseOutput(result)
        expect(output.tokens).toHaveLength(2)
        const modes = output.tokens.map(t => t.mode)
        expect(modes).toContain('Light')
        expect(modes).toContain('Dark')
    })

    // 12. Collection name in output
    it('includes collection name in each token', () => {
        const result = handlePullVariables({
            variablesPayload: makeValidPayload(),
        })

        const output = parseOutput(result)
        for (const token of output.tokens) {
            expect(token.collection).toBe('Design System')
        }
    })
})
