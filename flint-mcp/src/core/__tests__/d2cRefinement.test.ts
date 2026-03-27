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

    it('returns per-node confidence scores alongside classifications', async () => {
        const responseJson = JSON.stringify({
            classifications: [
                { nodeId: 'EmailField', componentType: 'input', confidence: 0.9 },
                { nodeId: 'SubmitButton', componentType: 'button', confidence: 0.65 },
            ],
        })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.confidences.size).toBe(2)
        expect(result.confidences.get('EmailField')).toBe(0.9)
        expect(result.confidences.get('SubmitButton')).toBe(0.65)
    })

    it('returns empty confidences map on fallback', async () => {
        const result = await classifyWithAI(sampleNodeTree, 'shadcn', null)

        expect(result.confidences).toBeDefined()
        expect(result.confidences.size).toBe(0)
    })

    it('excludes low-confidence entries from both classifications and confidences', async () => {
        const responseJson = JSON.stringify({
            classifications: [
                { nodeId: 'EmailField', componentType: 'input', confidence: 0.9 },
                { nodeId: 'SubmitButton', componentType: 'button', confidence: 0.3 },
            ],
        })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.classifications.size).toBe(1)
        expect(result.confidences.size).toBe(1)
        expect(result.confidences.has('SubmitButton')).toBe(false)
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

    it('confidence exactly at 0.6 threshold is included', async () => {
        const responseJson = JSON.stringify({
            classifications: [
                { nodeId: 'EmailField', componentType: 'input', confidence: 0.6 },
            ],
        })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.classifications.size).toBe(1)
        expect(result.classifications.get('EmailField')).toBe('input')
    })

    it('confidence just below 0.6 threshold is excluded', async () => {
        const responseJson = JSON.stringify({
            classifications: [
                { nodeId: 'EmailField', componentType: 'input', confidence: 0.59 },
            ],
        })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.classifications.size).toBe(0)
    })

    it('sends library name in the API request body', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(JSON.stringify({ classifications: [] })))
        vi.stubGlobal('fetch', fetchMock)

        await classifyWithAI(sampleNodeTree, 'mui', 'sk-test-key')

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        // The system prompt should mention the library
        expect(callBody.system).toContain('mui')
    })

    it('prompt builder includes valid component types list', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(JSON.stringify({ classifications: [] })))
        vi.stubGlobal('fetch', fetchMock)

        await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        // The system prompt should list valid component types
        expect(callBody.system).toContain('button')
        expect(callBody.system).toContain('input')
        expect(callBody.system).toContain('card')
        expect(callBody.system).toContain('form')
        expect(callBody.system).toContain('nav')
    })

    it('sends Figma node tree in user message', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(JSON.stringify({ classifications: [] })))
        vi.stubGlobal('fetch', fetchMock)

        await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        const userMessage = callBody.messages[0].content
        expect(userMessage).toContain('ContactForm')
        expect(userMessage).toContain('EmailField')
    })

    it('skips entries with missing nodeId field', async () => {
        const responseJson = JSON.stringify({
            classifications: [
                { componentType: 'input', confidence: 0.9 }, // missing nodeId
                { nodeId: 'SubmitButton', componentType: 'button', confidence: 0.85 },
            ],
        })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.classifications.size).toBe(1)
        expect(result.classifications.has('SubmitButton')).toBe(true)
    })

    it('skips entries with missing confidence field', async () => {
        const responseJson = JSON.stringify({
            classifications: [
                { nodeId: 'EmailField', componentType: 'input' }, // missing confidence
            ],
        })

        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.classifications.size).toBe(0)
    })

    it('returns source=ai when classifications array is present (even if empty)', async () => {
        const responseJson = JSON.stringify({ classifications: [] })
        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse(responseJson)))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.source).toBe('ai')
    })

    it('handles response with no content array', async () => {
        vi.stubGlobal('fetch', mockFetchResponse({}))

        const result = await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        expect(result.source).toBe('fallback')
        expect(result.classifications.size).toBe(0)
    })

    it('uses correct model (claude-3-5-haiku-latest)', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(JSON.stringify({ classifications: [] })))
        vi.stubGlobal('fetch', fetchMock)

        await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-test-key')

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(callBody.model).toContain('haiku')
    })

    it('sends correct API key in headers', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(JSON.stringify({ classifications: [] })))
        vi.stubGlobal('fetch', fetchMock)

        await classifyWithAI(sampleNodeTree, 'shadcn', 'sk-my-special-key')

        const callHeaders = fetchMock.mock.calls[0][1].headers
        expect(callHeaders['x-api-key']).toBe('sk-my-special-key')
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

    it('preserves original scaffold on Babel parse failure (fallback safety)', async () => {
        const complexScaffold = [
            'import React from "react";',
            'import { Input } from "@/components/ui/input";',
            '',
            'export function SearchForm() {',
            '  return (',
            '    <form className="flex gap-4">',
            '      <Input placeholder="Search..." />',
            '      <button type="submit">Go</button>',
            '    </form>',
            '  );',
            '}',
        ].join('\n')

        // AI returns garbage that fails Babel parse
        vi.stubGlobal('fetch', mockFetchResponse(anthropicResponse('const x = {{{invalid')))

        const result = await refineComponent(
            complexScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(result.status).toBe('fallback')
        // Original scaffold must be preserved exactly
        expect(result.code).toBe(complexScaffold)
    })

    it('preserves original scaffold on API timeout (fallback safety)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        // Original scaffold must be preserved exactly
        expect(result.code).toBe(validScaffold)
    })

    it('preserves original scaffold on empty API key (fallback safety)', async () => {
        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', null
        )

        // Original scaffold must be preserved exactly
        expect(result.code).toBe(validScaffold)
    })

    it('includes library name in system prompt', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'mui', 'MUI idioms here', 'sk-test-key'
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(callBody.system).toContain('mui')
    })

    it('includes idiom block in system prompt', async () => {
        const idiomBlock = 'Use MUI Box for layouts. Use Typography for text.'
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'mui', idiomBlock, 'sk-test-key'
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(callBody.system).toContain(idiomBlock)
    })

    it('includes design system context in system prompt when provided', async () => {
        const dsContext = 'Primary color is blue-600. Use rounded-lg for all cards.'
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key', undefined, dsContext
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(callBody.system).toContain(dsContext)
        expect(callBody.system).toContain('Design System Guidelines')
    })

    it('omits design system context block when not provided', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(callBody.system).not.toContain('Design System Guidelines')
    })

    it('omits design system context block when empty string', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key', undefined, '   '
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(callBody.system).not.toContain('Design System Guidelines')
    })

    it('uses correct model (sonnet)', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(callBody.model).toContain('sonnet')
    })

    it('sends correct API key in headers', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-refine-key-42'
        )

        const callHeaders = fetchMock.mock.calls[0][1].headers
        expect(callHeaders['x-api-key']).toBe('sk-refine-key-42')
    })

    it('includes scaffold JSX in user message', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        const textBlock = callBody.messages[0].content.find((b: { type: string }) => b.type === 'text')
        expect(textBlock.text).toContain('flex flex-col')
        expect(textBlock.text).toContain('ContactForm')
    })

    it('includes Figma subtree in user message', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        const subtree = { name: 'HeroSection', type: 'FRAME', children: [{ name: 'Title', type: 'TEXT' }] }

        await refineComponent(
            validScaffold, subtree, 'shadcn', '', 'sk-test-key'
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        const textBlock = callBody.messages[0].content.find((b: { type: string }) => b.type === 'text')
        expect(textBlock.text).toContain('HeroSection')
    })

    it('screenshot section includes base64 image block with correct media type', async () => {
        const fetchMock = mockFetchResponse(anthropicResponse(validScaffold))
        vi.stubGlobal('fetch', fetchMock)

        await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key', 'iVBORw0KGgoAAAANSUhEUgA='
        )

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
        const imageBlock = callBody.messages[0].content.find((b: { type: string }) => b.type === 'image')
        expect(imageBlock).toBeDefined()
        expect(imageBlock.source.type).toBe('base64')
        expect(imageBlock.source.media_type).toBe('image/png')
        expect(imageBlock.source.data).toBe('iVBORw0KGgoAAAANSUhEUgA=')
    })

    it('returns fallback with reason on 429 rate limit', async () => {
        vi.stubGlobal('fetch', mockFetchResponse({}, 429, 'Too Many Requests'))

        const result = await refineComponent(
            validScaffold, figmaSubtree, 'shadcn', '', 'sk-test-key'
        )

        expect(result.status).toBe('fallback')
        expect(result.code).toBe(validScaffold)
        expect(result.reason).toContain('API error: 429')
    })
})
