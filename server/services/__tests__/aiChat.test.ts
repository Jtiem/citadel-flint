/**
 * server/services/__tests__/aiChat.test.ts
 *
 * Tests for the AIChatService factory (server/services/aiChat.ts).
 *
 * All tests mock the Anthropic SDK — no real API calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'

// ── Anthropic SDK mock ───────────────────────────────────────────────────────
// vi.mock is hoisted before imports, so the mock is in place when aiChat.ts
// imports Anthropic.

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn()
  return { default: MockAnthropic }
})

// Import AFTER the mock declaration so the module resolves the mocked version.
import { createAIChatService } from '../aiChat.js'
import Anthropic from '@anthropic-ai/sdk'
import type { ChatChunk } from '../aiChat.js'

// ── Stream builder helpers ────────────────────────────────────────────────────

function makeAsyncIterable(events: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const e of events) yield e
    },
  }
}

function buildStream(events: unknown[], finalContent: unknown[] = []) {
  return {
    ...makeAsyncIterable(events),
    finalMessage: vi.fn().mockResolvedValue({ content: finalContent }),
  }
}

function buildSuccessClient(textParts: string[]) {
  const events = [
    ...textParts.map((t) => ({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: t },
    })),
    { type: 'message_stop' },
  ]
  return {
    messages: {
      stream: vi.fn().mockReturnValue(buildStream(events)),
    },
  }
}

function buildErrorClient(errorMsg: string) {
  return {
    messages: {
      stream: vi.fn().mockRejectedValue(new Error(errorMsg)),
    },
  }
}

/**
 * Install a mock Anthropic constructor that returns `mockInstance` from `new Anthropic()`.
 * Uses a regular function (not arrow) so vitest treats it as a constructor mock.
 */
function mockAnthropicWith(mockInstance: unknown): void {
  vi.mocked(Anthropic).mockImplementation(function (this: unknown) {
    return mockInstance
  } as unknown as new (...args: unknown[]) => InstanceType<typeof Anthropic>)
}

// ── Collector helper ──────────────────────────────────────────────────────────

async function collectChunks(
  svc: ReturnType<typeof createAIChatService>,
  messages: unknown[],
  context: unknown = null,
): Promise<ChatChunk[]> {
  const chunks: ChatChunk[] = []
  await svc.chat(messages, context, (c) => chunks.push(c))
  return chunks
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createAIChatService', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'flint-aichat-test-'))
    vi.mocked(Anthropic).mockReset()
    delete process.env.ANTHROPIC_API_KEY
  })

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ok */ }
    delete process.env.ANTHROPIC_API_KEY
  })

  // ── getConfig ──────────────────────────────────────────────────────────────

  it('getConfig returns hasKey: false when no config file and no env var', () => {
    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    expect(svc.getConfig().hasKey).toBe(false)
  })

  it('getConfig returns hasKey: true when ANTHROPIC_API_KEY env var is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-env-key'
    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    expect(svc.getConfig().hasKey).toBe(true)
  })

  it('getConfig returns hasKey: true when apiKey present in config file', () => {
    const cfgPath = path.join(tmpDir, 'config.json')
    writeFileSync(cfgPath, JSON.stringify({ apiKey: 'sk-from-file' }))
    const svc = createAIChatService(cfgPath)
    expect(svc.getConfig().hasKey).toBe(true)
  })

  it('getConfig returns configured model from file', () => {
    const cfgPath = path.join(tmpDir, 'config.json')
    writeFileSync(cfgPath, JSON.stringify({ apiKey: 'sk-x', model: 'claude-3-haiku-20240307' }))
    const svc = createAIChatService(cfgPath)
    expect(svc.getConfig().model).toBe('claude-3-haiku-20240307')
  })

  it('getConfig returns default model when none configured', () => {
    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    expect(svc.getConfig().model).toBe('claude-sonnet-4-20250514')
  })

  it('getConfig returns baseURL from config file', () => {
    const cfgPath = path.join(tmpDir, 'config.json')
    writeFileSync(cfgPath, JSON.stringify({ apiKey: 'sk-x', baseURL: 'https://proxy.example.com' }))
    const svc = createAIChatService(cfgPath)
    expect(svc.getConfig().baseURL).toBe('https://proxy.example.com')
  })

  it('getConfig returns null baseURL when not configured', () => {
    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    expect(svc.getConfig().baseURL).toBeNull()
  })

  // ── chat — no API key ─────────────────────────────────────────────────────

  it('chat emits structured error chunk when no API key is configured', async () => {
    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    const chunks = await collectChunks(svc, [{ role: 'user', content: 'hello' }])

    expect(chunks).toHaveLength(2)
    const errChunk = chunks[0] as Extract<ChatChunk, { type: 'error' }>
    expect(errChunk.type).toBe('error')
    expect(errChunk.message).toMatch(/API key/i)
    expect(chunks[1].type).toBe('done')
  })

  it('chat does not instantiate Anthropic when no API key is present', async () => {
    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    await collectChunks(svc, [{ role: 'user', content: 'test' }])
    expect(vi.mocked(Anthropic)).not.toHaveBeenCalled()
  })

  // ── chat — empty / invalid messages ──────────────────────────────────────

  it('chat emits error when messages array is empty after conversion', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    // Mock the constructor to return a client that would succeed if called
    mockAnthropicWith(buildSuccessClient(['ok']))

    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    // Only messages with unknown roles — all filtered out
    const chunks = await collectChunks(svc, [{ role: 'system', content: 'ignored' }])
    const errChunk = chunks.find((c) => c.type === 'error') as Extract<ChatChunk, { type: 'error' }> | undefined
    expect(errChunk).toBeDefined()
    expect(errChunk!.message).toMatch(/no valid messages/i)
  })

  it('chat emits error when messages argument is not an array', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    mockAnthropicWith(buildSuccessClient(['ok']))

    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    const chunks = await collectChunks(svc, null as unknown as unknown[])
    const errChunk = chunks.find((c) => c.type === 'error')
    expect(errChunk).toBeDefined()
  })

  // ── chat — streaming success ──────────────────────────────────────────────

  it('chat forwards text_delta chunks from the stream', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    mockAnthropicWith(buildSuccessClient(['Hello', ', ', 'world']))

    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    const chunks = await collectChunks(svc, [{ role: 'user', content: 'hi' }])

    const textChunks = chunks.filter((c) => c.type === 'text_delta') as Array<Extract<ChatChunk, { type: 'text_delta' }>>
    expect(textChunks).toHaveLength(3)
    expect(textChunks.map((c) => c.text).join('')).toBe('Hello, world')
  })

  it('chat emits done chunk as the final event on successful stream', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    mockAnthropicWith(buildSuccessClient(['ok']))

    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    const chunks = await collectChunks(svc, [{ role: 'user', content: 'test' }])
    expect(chunks[chunks.length - 1].type).toBe('done')
  })

  it('chat passes model to the Anthropic SDK stream call', async () => {
    const cfgPath = path.join(tmpDir, 'config.json')
    writeFileSync(cfgPath, JSON.stringify({ apiKey: 'sk-x', model: 'claude-3-haiku-20240307' }))

    const mockClient = buildSuccessClient(['ok'])
    mockAnthropicWith(mockClient)

    const svc = createAIChatService(cfgPath)
    await collectChunks(svc, [{ role: 'user', content: 'test' }])

    expect(mockClient.messages.stream).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-haiku-20240307' }),
    )
  })

  // ── chat — API error handling ─────────────────────────────────────────────

  it('chat emits error chunk with invalid-key message on 401 authentication failure', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-bad-key'
    mockAnthropicWith(buildErrorClient('401 authentication error'))

    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    const chunks = await collectChunks(svc, [{ role: 'user', content: 'test' }])

    const errChunk = chunks.find((c) => c.type === 'error') as Extract<ChatChunk, { type: 'error' }> | undefined
    expect(errChunk).toBeDefined()
    expect(errChunk!.message).toMatch(/Invalid API key/i)
    expect(chunks[chunks.length - 1].type).toBe('done')
  })

  it('chat emits rate-limit error message on 429 response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    mockAnthropicWith(buildErrorClient('429 rate limit exceeded'))

    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    const chunks = await collectChunks(svc, [{ role: 'user', content: 'test' }])

    const errChunk = chunks.find((c) => c.type === 'error') as Extract<ChatChunk, { type: 'error' }> | undefined
    expect(errChunk).toBeDefined()
    expect(errChunk!.message).toMatch(/rate limit/i)
  })

  it('chat emits overloaded error message on 529 response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    mockAnthropicWith(buildErrorClient('529 overloaded'))

    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    const chunks = await collectChunks(svc, [{ role: 'user', content: 'test' }])

    const errChunk = chunks.find((c) => c.type === 'error') as Extract<ChatChunk, { type: 'error' }> | undefined
    expect(errChunk).toBeDefined()
    expect(errChunk!.message).toMatch(/overloaded/i)
    expect(chunks[chunks.length - 1].type).toBe('done')
  })

  it('chat always emits done as final chunk even after an error', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    mockAnthropicWith(buildErrorClient('unknown network error'))

    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    const chunks = await collectChunks(svc, [{ role: 'user', content: 'test' }])
    expect(chunks[chunks.length - 1].type).toBe('done')
  })

  // ── chat — tool_call events ───────────────────────────────────────────────

  it('chat emits tool_call chunk when content_block_start contains tool_use', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'

    const events = [
      {
        type: 'content_block_start',
        content_block: { type: 'tool_use', id: 'tu_01', name: 'flint_audit', input: {} },
      },
      { type: 'message_stop' },
    ]
    const mockClient = {
      messages: {
        stream: vi.fn().mockReturnValue(buildStream(events)),
      },
    }
    mockAnthropicWith(mockClient)

    const svc = createAIChatService(path.join(tmpDir, 'nonexistent.json'))
    const chunks = await collectChunks(svc, [{ role: 'user', content: 'audit' }])

    const toolChunk = chunks.find((c) => c.type === 'tool_call') as Extract<ChatChunk, { type: 'tool_call' }> | undefined
    expect(toolChunk).toBeDefined()
    expect(toolChunk!.name).toBe('flint_audit')
  })

  // ── context injection ─────────────────────────────────────────────────────

  it('chat appends context block to system prompt when context has activeFile', async () => {
    const cfgPath = path.join(tmpDir, 'config.json')
    writeFileSync(cfgPath, JSON.stringify({ apiKey: 'sk-x' }))

    const mockClient = buildSuccessClient(['ok'])
    mockAnthropicWith(mockClient)

    const svc = createAIChatService(cfgPath)
    await svc.chat(
      [{ role: 'user', content: 'test' }],
      { activeFile: 'src/Button.tsx', healthScore: 85 },
      () => {},
    )

    expect(mockClient.messages.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('src/Button.tsx'),
      }),
    )
  })
})
