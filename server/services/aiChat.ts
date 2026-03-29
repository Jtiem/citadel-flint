/**
 * aiChat.ts — server/services/aiChat.ts
 *
 * AI orchestration service for the Flint Glass web server.
 *
 * Simplified version of electron/orchestrator.ts that:
 *   1. Reads API key from a config file or ANTHROPIC_API_KEY env var
 *   2. Streams Anthropic responses back via a callback
 *   3. Supports text deltas, tool_call events, and error reporting
 *
 * This does NOT include:
 *   - The full Flint Tool Catalog (Commandment 15) — that belongs in the MCP engine
 *   - In-memory Babel validation (Commandment 16) — that belongs in the MCP engine
 *   - Complexity routing (ACX.4) — simplified to a single model for web mode
 *   - safeStorage encryption (SEC.4) — not available outside Electron
 *   - MRS risk scoring / consensus gate — that belongs in the MCP engine
 *
 * The web server's AI chat is a lightweight passthrough for conversational
 * assistance. Governance enforcement happens via MCP tool calls, not here.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, existsSync } from 'node:fs'

// ── Constants ────────────────────────────────────────────────────────────────

const LOG_PREFIX = '[Flint AI]'
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 4096

/**
 * Base system prompt for the web server AI chat.
 * Intentionally minimal — the full Sentinel prompt and constraint injection
 * live in the MCP engine (electron/orchestrator.ts). The web server's chat
 * provides general design system assistance without mutation capabilities.
 */
const SYSTEM_PROMPT = `You are Flint, a design system governance assistant. You help users understand their design tokens, component registry, accessibility requirements, and governance rules.

You can answer questions about:
- Design tokens and their usage
- Component documentation and props
- Accessibility (WCAG 2.1 AA) best practices
- Governance rules and violation explanations
- Design system architecture

You do NOT perform code mutations directly. For code changes, users should use the MCP tools via their IDE (Claude Code, Cursor, VS Code).`

// ── Types ────────────────────────────────────────────────────────────────────

/** Shape of the config file at configPath. */
interface AIConfigFile {
  apiKey?: string
  provider?: string
  model?: string
  baseURL?: string
}

/** Chunk types emitted via the onChunk callback. */
export type ChatChunk =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; name: string; input: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface AIChatService {
  chat(
    messages: unknown[],
    context: unknown,
    onChunk: (chunk: ChatChunk) => void,
  ): Promise<void>
  getConfig(): { hasKey: boolean; provider: string; model: string | null; baseURL: string | null }
}

// ── Config reader ────────────────────────────────────────────────────────────

/**
 * Read the AI config from disk. Returns a normalized config object.
 * Never throws — returns safe defaults on any error.
 */
function readConfigFile(configPath: string): AIConfigFile {
  try {
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf-8')
      return JSON.parse(raw) as AIConfigFile
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Could not read config at ${configPath}:`, err)
  }
  return {}
}

/**
 * Resolve the API key from the config file and environment.
 *
 * Priority:
 *   1. config.apiKey from the config file
 *   2. process.env.ANTHROPIC_API_KEY
 *
 * Note: The web server does not use safeStorage encryption (SEC.4 is
 * Electron-only). The config file stores the key in plaintext. For
 * production deployments, prefer the environment variable.
 */
function resolveApiKey(config: AIConfigFile): string | undefined {
  return config.apiKey || process.env.ANTHROPIC_API_KEY
}

// ── Message conversion ───────────────────────────────────────────────────────

interface RawMessage {
  role?: string
  content?: string
  toolName?: string
  toolUseId?: string
  toolInput?: Record<string, unknown>
}

/**
 * Convert the raw message array from the client into Anthropic SDK format.
 *
 * Handles merging consecutive same-role messages and converting tool_call /
 * tool_result messages into the proper Anthropic content block format.
 * Mirrors the conversion logic in electron/orchestrator.ts sendChatMessage().
 */
function convertMessages(raw: unknown[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []

  for (const item of raw) {
    const m = item as RawMessage
    if (!m || !m.role) continue

    if (m.role === 'user' || m.role === 'assistant') {
      const content = m.content ?? ''
      const lastMsg = messages[messages.length - 1]

      if (lastMsg && lastMsg.role === m.role) {
        // Merge consecutive same-role messages.
        // Cast through unknown[] to satisfy the SDK's strict TextBlock union
        // (which requires a `citations` field). MessageParam content arrays
        // accept the looser TextBlockParam shape at runtime.
        if (typeof lastMsg.content === 'string') {
          lastMsg.content = [
            { type: 'text' as const, text: lastMsg.content },
            { type: 'text' as const, text: content },
          ] as unknown as Anthropic.MessageParam['content']
        } else if (Array.isArray(lastMsg.content)) {
          ;(lastMsg.content as unknown[]).push({ type: 'text', text: content })
        }
      } else {
        messages.push({ role: m.role, content })
      }
    } else if (m.role === 'tool_call') {
      // Tool use blocks go into an assistant message
      const toolUseBlock = {
        type: 'tool_use' as const,
        id: m.toolUseId ?? `tool_${Date.now()}`,
        name: m.toolName ?? 'unknown',
        input: m.toolInput ?? {},
      }

      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        if (typeof lastMsg.content === 'string') {
          lastMsg.content = [{ type: 'text', text: lastMsg.content }]
        }
        ;(lastMsg.content as unknown[]).push(toolUseBlock)
      } else {
        messages.push({ role: 'assistant', content: [toolUseBlock] })
      }
    } else if (m.role === 'tool_result') {
      // Tool result blocks go into a user message
      const toolResultBlock = {
        type: 'tool_result' as const,
        tool_use_id: m.toolUseId ?? `tool_${Date.now()}`,
        content: m.content ?? '',
      }

      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.role === 'user') {
        if (typeof lastMsg.content === 'string') {
          lastMsg.content = [{ type: 'text', text: lastMsg.content }]
        }
        ;(lastMsg.content as unknown[]).push(toolResultBlock)
      } else {
        messages.push({ role: 'user', content: [toolResultBlock] })
      }
    }
    // Skip unknown roles silently
  }

  return messages
}

// ── Context formatter ────────────────────────────────────────────────────────

/**
 * Format the Glass context object into a system prompt supplement.
 * The context carries live state from the Glass UI (active file, tokens,
 * violations, canvas mode) so the AI has awareness of what the user is
 * looking at.
 */
function formatContextBlock(context: unknown): string {
  if (!context || typeof context !== 'object') return ''

  const ctx = context as Record<string, unknown>
  const parts: string[] = []

  if (ctx.activeFile && typeof ctx.activeFile === 'string') {
    parts.push(`Active file: ${ctx.activeFile}`)
  }

  if (ctx.canvasMode && typeof ctx.canvasMode === 'string') {
    parts.push(`Canvas mode: ${ctx.canvasMode}`)
  }

  if (Array.isArray(ctx.violations) && ctx.violations.length > 0) {
    parts.push(`Active violations: ${ctx.violations.length}`)
    // Include up to 5 violation summaries for context
    const summaries = ctx.violations.slice(0, 5).map((v: unknown) => {
      const viol = v as Record<string, unknown>
      return `  - [${viol.severity ?? 'warn'}] ${viol.ruleId ?? 'unknown'}: ${viol.message ?? ''}`
    })
    parts.push(summaries.join('\n'))
  }

  if (Array.isArray(ctx.tokens) && ctx.tokens.length > 0) {
    parts.push(`Design tokens loaded: ${ctx.tokens.length}`)
  }

  if (ctx.healthScore !== undefined) {
    parts.push(`Design health score: ${ctx.healthScore}`)
  }

  if (parts.length === 0) return ''

  return `\n\n---\nCurrent Glass State:\n${parts.join('\n')}\n---`
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create an AI chat service that reads its config from the given path.
 *
 * @param configPath - Absolute path to the JSON config file (e.g., ~/.flint/config.json)
 */
export function createAIChatService(configPath: string): AIChatService {
  /**
   * Stream a chat conversation to the Anthropic API and emit chunks
   * back via the onChunk callback.
   *
   * @param messages - Array of message objects from the client
   * @param context - Glass state context (active file, violations, tokens)
   * @param onChunk - Callback for each streaming event
   */
  async function chat(
    messages: unknown[],
    context: unknown,
    onChunk: (chunk: ChatChunk) => void,
  ): Promise<void> {
    const config = readConfigFile(configPath)
    const apiKey = resolveApiKey(config)

    if (!apiKey) {
      onChunk({
        type: 'error',
        message: 'No API key configured. Set ANTHROPIC_API_KEY or add apiKey to ~/.flint/config.json.',
      })
      onChunk({ type: 'done' })
      return
    }

    const model = config.model ?? DEFAULT_MODEL

    try {
      const client = new Anthropic({
        apiKey,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      })

      // Build the system prompt with optional context supplement
      const contextBlock = formatContextBlock(context)
      const systemPrompt = SYSTEM_PROMPT + contextBlock

      // Convert raw messages to Anthropic format
      const anthropicMessages = convertMessages(Array.isArray(messages) ? messages : [])

      if (anthropicMessages.length === 0) {
        onChunk({ type: 'error', message: 'No valid messages provided.' })
        onChunk({ type: 'done' })
        return
      }

      // Stream the response
      const stream = await client.messages.stream({
        model: model as Parameters<typeof client.messages.stream>[0]['model'],
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: anthropicMessages,
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            onChunk({ type: 'text_delta', text: event.delta.text })
          }
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            // Note: the web server does not declare tools, so this branch
            // only fires if the model spontaneously emits a tool_use block
            // (unlikely without tool declarations, but handled for safety).
            onChunk({
              type: 'tool_call',
              name: event.content_block.name,
              input: {},
            })
          }
        } else if (event.type === 'message_stop') {
          // Extract any tool_use blocks from the final message
          const finalMsg = await stream.finalMessage()
          for (const block of finalMsg.content) {
            if (block.type === 'tool_use') {
              onChunk({
                type: 'tool_call',
                name: block.name,
                input: block.input as Record<string, unknown>,
              })
            }
          }
        }
      }

      onChunk({ type: 'done' })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`${LOG_PREFIX} Chat error:`, errorMessage)

      // Provide helpful error messages for common failure modes
      if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
        onChunk({ type: 'error', message: 'Invalid API key. Check your Anthropic API key.' })
      } else if (errorMessage.includes('429') || errorMessage.includes('rate')) {
        onChunk({ type: 'error', message: 'Rate limited by Anthropic. Please wait a moment and try again.' })
      } else if (errorMessage.includes('overloaded') || errorMessage.includes('529')) {
        onChunk({ type: 'error', message: 'Anthropic API is overloaded. Please try again shortly.' })
      } else {
        onChunk({ type: 'error', message: `AI request failed: ${errorMessage}` })
      }

      onChunk({ type: 'done' })
    }
  }

  /**
   * Return the current AI configuration summary.
   * Used by the Glass UI to show connection status without exposing the key.
   */
  function getConfig(): { hasKey: boolean; provider: string; model: string | null; baseURL: string | null } {
    const config = readConfigFile(configPath)
    const apiKey = resolveApiKey(config)

    return {
      hasKey: !!apiKey,
      provider: config.provider ?? 'anthropic',
      model: config.model ?? DEFAULT_MODEL,
      baseURL: config.baseURL ?? null,
    }
  }

  return {
    chat,
    getConfig,
  }
}
