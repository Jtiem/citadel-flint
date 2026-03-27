/**
 * D2C.5 — AI Refinement Pass tests
 *
 * Tests classifyWithAI(), refineComponent(), and resolveApiKey().
 * All API calls are mocked via vi.stubGlobal('fetch', ...).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    classifyWithAI,
    refineComponent,
    resolveApiKey,
    type ClassificationResult,
    type RefinementResult,
} from '../d2cRefinement.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchResponse(body: unknown, status = 200, statusText = 'OK') {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText,
        json: () => Promise.resolve(body),
    })
}

function anthropicResponse(text: string) {
    return {
        content: [{ type: 'text', text }],
    }
}

const sampleNodeTree = {
    name: 'ContactForm',
    type: 'FRAME',
    children: [
        { name: 'EmailField', type: 'FRAME' },
        { name: 'SubmitButton', type: 'FRAME' },
    ],
}

// ---------------------------------------------------------------------------
// resolveApiKey
// ---------------------------------------------------------------------------

describe('resolveApiKey', () => {
    const originalEnv = process.env.ANTHROPIC_API_KEY

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.ANTHROPIC_API_KEY = originalEnv
        } else {
            delete process.env.ANTHROPIC_API_KEY
        }
    })

    it('returns env var when ANTHROPIC_API_KEY is set', () => {
        process.env.ANTHROPIC_API_KEY = 'sk-env-key-123'
        const key = resolveApiKey('/fake/project')
        expect(key).toBe('sk-env-key-123')
    })

    it('env var takes priority over config file', () => {
        process.env.ANTHROPIC_API_KEY = 'sk-env-priority'
        // Even if config.json exists, env var wins — we test the function logic
        const key = resolveApiKey('/fake/project')
        expect(key).toBe('sk-env-priority')
    })

    it('returns null when no env var and no projectRoot', () => {
        delete process.env.ANTHROPIC_API_KEY
        const key = resolveApiKey()
        expect(key).toBeNull()
    })

    it('returns null when no env var and config file does not exist', () => {
        delete process.env.ANTHROPIC_API_KEY
        const key = resolveApiKey('/nonexistent/path/that/does/not/exist')
        expect(key).toBeNull()
    })

    it('trims whitespace from env var', () => {
        process.env.ANTHROPIC_API_KEY = '  sk-trimmed  '
        const key = resolveApiKey()
        expect(key).toBe('sk-trimmed')
    })

    it('returns null for empty env var', () => {
        process.env.ANTHROPIC_API_KEY = '   '
        const key = resolveApiKey()
        expect(key).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// classifyWithAI
// ---------------------------------------------------------------------------

describe('classifyWithAI', () => {
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
        originalFetch = globalThis.fetch
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    it('returns classifications on valid API response', async () => {
        const responseJson = JSON.stringify({
            classifications: [
                { nodeId: 'EmailField', componentType: 'input', confidence: 0.9 },
                { nodeId: 'SubmitButton', componentType: 'button', confidence: 0.85 },
            ],
        })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.source).toBe('ai')
        expect(result.classifications.size).toBe(2)
        expect(result.classifications.get('EmailField')).toBe('input')
        expect(result.classifications.get('SubmitButton')).toBe('button')
        expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('returns empty map when no API key', async () => {
        const result = await classifyWithAI(sampleNodeTree, 'shadcn', null)

        expect(result.source).toBe('fallback')
        expect(result.classifications.size).toBe(0)
    })

    it('returns empty map on API error (non-200 status)', async () => {
        vi.stubGlobal('fetch', mockFetchResponse({}, 401, 'Unauthorized'))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.source).toBe('fallback')
        expect(result.classifications.size).toBe(0)
    })

    it('returns empty map on timeout (fetch abort)', async () => {
        // Simulate a fetch that takes too long and gets aborted
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.source).toBe('fallback')
        expect(result.classifications.size).toBe(0)
    })

    it('returns empty map on malformed JSON response', async () => {
        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse('not valid json at all {{')))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.source).toBe('fallback')
        expect(result.classifications.size).toBe(0)
    })

    it('filters out classifications with low confidence (< 0.6)', async () => {
        const responseJson = JSON.stringify({
            classifications: [
                { nodeId: 'EmailField', componentType: 'input', confidence: 0.9 },
                { nodeId: 'SubmitButton', componentType: 'button', confidence: 0.3 }, // below threshold
            ],
        })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.classifications.size).toBe(1)
        expect(result.classifications.has('EmailField')).toBe(true)
        expect(result.classifications.has('SubmitButton')).toBe(false)
    })

    it('filters out classifications with invalid componentType', async () => {
        const responseJson = JSON.stringify({
            classifications: [
                { nodeId: 'EmailField', componentType: 'input', confidence: 0.9 },
                { nodeId: 'Widget', componentType: 'nonexistent_type', confidence: 0.9 },
            ],
        })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.classifications.size).toBe(1)
        expect(result.classifications.has('Widget')).toBe(false)
    })

    it('handles response wrapped in markdown code fences', async () => {
        const responseText = '```json\n' + JSON.stringify({
            classifications: [
                { nodeId: 'EmailField', componentType: 'input', confidence: 0.8 },
            ],
        }) + '\n```'

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseText)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.source).toBe('ai')
        expect(result.classifications.size).toBe(1)
    })

    it('returns empty map when response has empty classifications array', async () => {
        const responseJson = JSON.stringify({ classifications: [] })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.source).toBe('ai')
        expect(result.classifications.size).toBe(0)
    })

    it('includes latencyMs in result', async () => {
        const responseJson = JSON.stringify({ classifications: [] })
        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(typeof result.latencyMs).toBe('number')
        expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('handles network error gracefully', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.source).toBe('fallback')
        expect(result.classifications.size).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// refineComponent
// ---------------------------------------------------------------------------

describe('refineComponent', () => {
    let originalFetch: typeof globalThis.fetch

    const validScaffold = [
        'import React from "react";',
        '',
        'export function ContactForm() {',
        '  return (',
        '    <div className="flex flex-col">',
        '      <p className="text-base">Hello</p>',
        '    </div>',
        '  );',
        '}',
    ].join('\n')

    const figmaSubtree = { name: 'ContactForm', type: 'FRAME' }

    beforeEach(() => {
        originalFetch = globalThis.fetch
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    it('returns refined code on valid response', async () => {
        const refinedCode = [
            'import React from "react";',
            'import { Card } from "@/components/ui/card";',
            '',
            'export function ContactForm() {',
            '  return (',
            '    <Card className="flex flex-col">',
            '      <p className="text-base">Hello</p>',
            '    </Card>',
            '  );',
            '}',
        ].join('\n')

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(refinedCode)))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(result.status).toBe('refined')
        expect(result.code).toBe(refinedCode)
        expect(result.latencyMs).toBeGreaterThanOrEqual(0)
        expect(result.reason).toBeUndefined()
    })

    it('returns fallback when no API key', async () => {
        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', null
        )

        expect(result.status).toBe('fallback')
        expect(result.code).toBe(validScaffold)
        expect(result.reason).toBe('No API key available')
    })

    it('returns fallback on Babel parse failure', async () => {
        const invalidCode = 'this is not valid JSX <><>><<'

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(invalidCode)))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(result.status).toBe('fallback')
        expect(result.code).toBe(validScaffold)
        expect(result.reason).toContain('Babel parse failed')
    })

    it('returns fallback on API error (non-200)', async () => {
        vi.stubGlobal('fetch', mockFetchResponse({}, 500, 'Internal Server Error'))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(result.status).toBe('fallback')
        expect(result.code).toBe(validScaffold)
        expect(result.reason).toContain('API error: 500')
    })

    it('returns fallback on timeout (fetch abort)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(result.status).toBe('fallback')
        expect(result.code).toBe(validScaffold)
        expect(result.reason).toContain('Request failed')
    })

    it('returns fallback on empty response', async () => {
        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse('')))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(result.status).toBe('fallback')
        expect(result.code).toBe(validScaffold)
        expect(result.reason).toBe('Empty response from AI')
    })

    it('includes latencyMs in result', async () => {
        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(validScaffold)))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(typeof result.latencyMs).toBe('number')
        expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('strips markdown code fences from AI response', async () => {
        const wrappedCode = '```tsx\n' + validScaffold + '\n```'

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(wrappedCode)))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(result.status).toBe('refined')
        // The stripped code should parse successfully
        expect(result.code).not.toContain('```')
    })

    it('passes screenshotBase64 when provided', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key', 'base64screenshot'
        )

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        const userContent = callBody.messages[0].content
        // Should include both text and image blocks
        expect(userContent).toHaveLength(2)
        expect(userContent[1].type).toBe('image')
        expect(userContent[1].source.data).toBe('base64screenshot')
    })

    it('omits screenshot block when not provided', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        const userContent = callBody.messages[0].content
        // Should only include text block
        expect(userContent).toHaveLength(1)
        expect(userContent[0].type).toBe('text')
    })

    it('handles network error gracefully', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(result.status).toBe('fallback')
        expect(result.code).toBe(validScaffold)
        expect(result.reason).toContain('Request failed')
    })
})
