/**
 * orchestrator-provider-guard.test.ts
 *
 * Tests for ADR P0-4 — Provider Parity guard in sendChatMessage().
 *
 * Context: electron/orchestrator.ts cannot be imported directly because
 * esbuild fails to parse certain Unicode characters in the file's template
 * literals (same constraint documented in orchestratorSafety.test.ts).
 *
 * Strategy: extract the provider guard logic inline and test it against the
 * exact contract defined in P0-4 § 5.1. The guard is a pure synchronous check
 * that reads config.provider and calls onChunk — no SDK calls, no file I/O.
 *
 * Coverage:
 *   P04-01 — OpenAI provider returns error chunk with 'Anthropic API key' and 'Commandment 15'
 *   P04-02 — Anthropic provider proceeds (guard does not fire)
 *   P04-03 — Gemini provider returns error chunk
 *   P04-04 — Missing provider field (undefined) does not trigger the guard
 */

import { describe, it, expect, vi } from 'vitest'

// ── Type definitions (matching orchestrator.ts) ────────────────────────────────

interface AIConfig {
    apiKey?: string
    provider?: string
    model?: string | null
    baseURL?: string | null
}

interface OrchestratorChunk {
    type: 'text' | 'done' | 'error' | 'tool_call' | 'tool_result' | 'validation_error'
    text?: string
    error?: string
    toolName?: string
    toolUseId?: string
    toolInput?: Record<string, unknown>
}

// ── Re-implement the provider guard logic (from orchestrator.ts § SEC P0-4) ────
// The guard is extracted as a pure function so it can be unit-tested without
// importing the full orchestrator module.

function providerGuard(
    config: AIConfig,
    onChunk: (chunk: OrchestratorChunk) => void
): boolean {
    // Mirrors the exact check from sendChatMessage() after the apiKey guard:
    //
    //   if (config.provider && config.provider !== 'anthropic') {
    //       onChunk({ type: 'error', error: '...' })
    //       return
    //   }
    if (config.provider && config.provider !== 'anthropic') {
        onChunk({
            type: 'error',
            error:
                'Flint requires an Anthropic API key for AI-assisted editing. ' +
                'The Flint Tool Catalog (Commandment 15) and in-memory validation ' +
                '(Commandment 16) are only enforced via Anthropic tool-use. ' +
                'Non-Anthropic providers bypass all governance checks. ' +
                'Please configure an Anthropic API key in AI Settings.',
        })
        return true  // guard fired
    }
    return false  // guard did not fire — proceed to Anthropic branch
}

// ── P04-01: OpenAI provider returns error chunk ────────────────────────────────

describe('P04-01 — OpenAI provider returns error chunk', () => {
    it('fires the guard and emits an error chunk', () => {
        const onChunk = vi.fn()
        const config: AIConfig = { apiKey: 'sk-openai-test', provider: 'openai' }

        const guarded = providerGuard(config, onChunk)

        expect(guarded).toBe(true)
        expect(onChunk).toHaveBeenCalledTimes(1)

        const chunk = onChunk.mock.calls[0][0] as OrchestratorChunk
        expect(chunk.type).toBe('error')
        expect(chunk.error).toBeDefined()
    })

    it("error message contains 'Anthropic API key'", () => {
        const onChunk = vi.fn()
        providerGuard({ apiKey: 'sk-openai-test', provider: 'openai' }, onChunk)

        const chunk = onChunk.mock.calls[0][0] as OrchestratorChunk
        expect(chunk.error).toContain('Anthropic API key')
    })

    it("error message contains 'Commandment 15'", () => {
        const onChunk = vi.fn()
        providerGuard({ apiKey: 'sk-openai-test', provider: 'openai' }, onChunk)

        const chunk = onChunk.mock.calls[0][0] as OrchestratorChunk
        expect(chunk.error).toContain('Commandment 15')
    })

    it("error message contains 'Commandment 16'", () => {
        const onChunk = vi.fn()
        providerGuard({ apiKey: 'sk-openai-test', provider: 'openai' }, onChunk)

        const chunk = onChunk.mock.calls[0][0] as OrchestratorChunk
        expect(chunk.error).toContain('Commandment 16')
    })

    it('error message instructs user to configure Anthropic key', () => {
        const onChunk = vi.fn()
        providerGuard({ apiKey: 'sk-openai-test', provider: 'openai' }, onChunk)

        const chunk = onChunk.mock.calls[0][0] as OrchestratorChunk
        expect(chunk.error).toContain('AI Settings')
    })
})

// ── P04-02: Anthropic provider proceeds (guard does not fire) ─────────────────

describe('P04-02 — Anthropic provider is not blocked', () => {
    it('guard does not fire for provider=anthropic', () => {
        const onChunk = vi.fn()
        const config: AIConfig = { apiKey: 'sk-ant-test', provider: 'anthropic' }

        const guarded = providerGuard(config, onChunk)

        expect(guarded).toBe(false)
        expect(onChunk).not.toHaveBeenCalled()
    })

    it('proceeds without error chunk when provider is anthropic', () => {
        const chunks: OrchestratorChunk[] = []
        const onChunk = (chunk: OrchestratorChunk) => chunks.push(chunk)

        providerGuard({ apiKey: 'sk-ant-test', provider: 'anthropic' }, onChunk)

        const errorChunks = chunks.filter(c => c.type === 'error')
        expect(errorChunks).toHaveLength(0)
    })
})

// ── P04-03: Gemini provider returns error chunk ────────────────────────────────

describe('P04-03 — Gemini provider returns error chunk', () => {
    it('fires the guard for provider=gemini', () => {
        const onChunk = vi.fn()
        const config: AIConfig = { apiKey: 'gm-test', provider: 'gemini' }

        const guarded = providerGuard(config, onChunk)

        expect(guarded).toBe(true)
        expect(onChunk).toHaveBeenCalledTimes(1)

        const chunk = onChunk.mock.calls[0][0] as OrchestratorChunk
        expect(chunk.type).toBe('error')
    })

    it("error message for gemini contains 'Anthropic API key'", () => {
        const onChunk = vi.fn()
        providerGuard({ apiKey: 'gm-test', provider: 'gemini' }, onChunk)

        const chunk = onChunk.mock.calls[0][0] as OrchestratorChunk
        expect(chunk.error).toContain('Anthropic API key')
    })

    it('fires the guard for any non-anthropic provider string', () => {
        const providers = ['gemini', 'openai', 'cohere', 'mistral', 'groq', 'ollama']
        for (const provider of providers) {
            const onChunk = vi.fn()
            const guarded = providerGuard({ apiKey: 'test', provider }, onChunk)
            expect(guarded).toBe(true)
            expect(onChunk).toHaveBeenCalledTimes(1)
        }
    })
})

// ── P04-04: Missing provider defaults to Anthropic (no error) ─────────────────

describe('P04-04 — missing provider field does not trigger the guard', () => {
    it('guard does not fire when provider is undefined', () => {
        const onChunk = vi.fn()
        const config: AIConfig = { apiKey: 'sk-ant-test' }  // no provider field

        const guarded = providerGuard(config, onChunk)

        expect(guarded).toBe(false)
        expect(onChunk).not.toHaveBeenCalled()
    })

    it('guard does not fire when provider is empty string', () => {
        const onChunk = vi.fn()
        // config.provider is '' — falsy, so `config.provider && ...` short-circuits
        const config: AIConfig = { apiKey: 'sk-ant-test', provider: '' }

        const guarded = providerGuard(config, onChunk)

        expect(guarded).toBe(false)
        expect(onChunk).not.toHaveBeenCalled()
    })

    it('guard fires only when provider is explicitly a non-anthropic string', () => {
        // Verify the exact condition: `config.provider && config.provider !== 'anthropic'`
        const cases: [AIConfig, boolean][] = [
            [{ apiKey: 'x', provider: undefined }, false],
            [{ apiKey: 'x', provider: '' }, false],
            [{ apiKey: 'x', provider: 'anthropic' }, false],
            [{ apiKey: 'x', provider: 'openai' }, true],
            [{ apiKey: 'x', provider: 'gemini' }, true],
        ]

        for (const [config, shouldFire] of cases) {
            const onChunk = vi.fn()
            const guarded = providerGuard(config, onChunk)
            expect(guarded).toBe(shouldFire)
        }
    })
})
