/**
 * orchestrator.ts — electron/orchestrator.ts
 *
 * The Bridge Auditor: LLM adapter for the Orchestration Engine (Phase M).
 *
 * Responsibilities:
 *   1. Reads ~/.bridge/config.json for the API key + provider setting.
 *   2. Exposes sendChatMessage() — streams Anthropic responses with tool use.
 *   3. Defines the Bridge Tool Catalog (Phase M — Commandment 15): the exact
 *      7 granular AST operations an AI agent may request. Raw code strings
 *      and full-file replacements are structurally prohibited.
 *   4. Validates proposed mutations in-memory using Babel before surfacing
 *      any tool_call to the renderer (Commandment 16 — In-Memory Validation).
 *      TS/syntax errors feed back to the AI as invisible recovery prompts.
 *
 * Complexity Tiers (Commandment 8 — Audit-First Execution):
 *   Atomic   → 1–3 mutation ops, single node.
 *   Compound → multi-step sequences, structural changes.
 *
 * Security:
 *   • API key is read from disk in the main process. It never reaches the renderer.
 *   • All tool_use results route back through the existing IPC channels (applyBatch,
 *     saveFileBatch) so Commandments 1, 12, and 13 are structurally enforced.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { tsLspClient } from './lsp/TypeScriptLspClient'
import { vueLspClient } from './lsp/VueLspClient'
import type { ILspClient } from './lsp/types'

// ── Config ────────────────────────────────────────────────────────────────────

export interface BridgeAIConfig {
    apiKey: string
    provider: 'anthropic' | 'openai' | 'gemini'
    model?: string
    /** Optional custom API base URL for routing through corporate gateways (e.g., Cloudflare AI Gateway, Helicone). */
    baseURL?: string
}

// Canonical Anthropic model roster (updated March 2025)
export const ANTHROPIC_MODELS: { id: string; label: string; tier: 'fast' | 'balanced' | 'powerful' }[] = [
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', tier: 'fast' },
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', tier: 'balanced' },
    { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', tier: 'balanced' },
    { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', tier: 'powerful' },
]

const CONFIG_PATH = path.join(homedir(), '.bridge', 'config.json')
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219'

export async function readConfig(): Promise<Partial<BridgeAIConfig>> {
    try {
        if (!existsSync(CONFIG_PATH)) return {}
        const raw = await readFile(CONFIG_PATH, 'utf-8')
        return JSON.parse(raw) as Partial<BridgeAIConfig>
    } catch {
        return {}
    }
}

export async function writeConfig(config: Partial<BridgeAIConfig>): Promise<void> {
    const dir = path.dirname(CONFIG_PATH)
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
    const existing = await readConfig()
    await writeFile(CONFIG_PATH, JSON.stringify({ ...existing, ...config }, null, 2), 'utf-8')
}

export async function hasApiKey(): Promise<boolean> {
    const cfg = await readConfig()
    return typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0
}

// ── Bridge Tool Catalog (Phase M — Commandment 15) ───────────────────────────
//
// These are the ONLY 7 operations the AI is allowed to request.
// Raw code strings, full-file replacements, and regex patches are
// structurally prohibited — the LLM cannot emit them because no tool
// in this catalog accepts them.

export const BRIDGE_TOOLS: Anthropic.Tool[] = [
    {
        name: 'bridge_read_code',
        description:
            'Read the current source code of the active file. Use this FIRST to understand component structure before proposing any changes.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
        name: 'bridge_read_tokens',
        description:
            'Read all design tokens from the Bridge token store. You MUST call this before proposing any className or style change. Only use token values that appear in this list. Never invent hex colours or pixel values.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
        name: 'bridge_audit_mithril',
        description:
            'Read all current Mithril Safety violations (color drift ΔE, typography, spacing, shadow, opacity). Use this to understand design system debt before proposing changes.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
        name: 'bridge_audit_a11y',
        description:
            'Read all current WCAG 2.1 AA accessibility violations. Verify your proposed changes do not introduce new violations.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    // ── Mutation tools (Phase M — strictly granular, node-targeted) ─────────────
    {
        name: 'bridge_update_props',
        description:
            `Modify one or more JSX attributes on a single target node.

Commandment 15 rules (mandatory):
- targetId MUST be a data-bridge-id value read from bridge_read_code. Never invent IDs.
- Never remove or change a data-bridge-id attribute.
- className values MUST use Tailwind classes mapped to tokens from bridge_read_tokens.
- Only call bridge_read_tokens first if you haven't already in this turn.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the target JSX element.' },
                props: {
                    type: 'object',
                    description: 'Key-value pairs of JSX attribute names to new string values. E.g. { "className": "bg-brand-primary", "aria-label": "Submit" }',
                    additionalProperties: { type: 'string' },
                },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'props', 'reasoning'],
        },
    },
    {
        name: 'bridge_update_text',
        description: 'Modify the visible text content of a single JSX element. Use this for copy changes, label updates, and heading edits.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the target JSX element.' },
                text: { type: 'string', description: 'New text content to set.' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'text', 'reasoning'],
        },
    },
    {
        name: 'bridge_insert_node',
        description:
            `Insert a new JSX element relative to an existing target node.
position: 'before' | 'after' | 'firstChild' | 'lastChild'
Only use element types that exist in the design system read from bridge_read_tokens or the source file imports.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the reference node.' },
                position: { type: 'string', enum: ['before', 'after', 'firstChild', 'lastChild'] },
                nodeType: { type: 'string', description: 'JSX element tag name, e.g. "div", "Button", "p".' },
                props: {
                    type: 'object',
                    description: 'Optional JSX attributes for the new element.',
                    additionalProperties: { type: 'string' },
                },
                children: { type: 'string', description: 'Optional text content or JSX children (must be safe JSX).' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'position', 'nodeType', 'reasoning'],
        },
    },
    {
        name: 'bridge_wrap_node',
        description: 'Wrap an existing JSX element in a new parent element. Use for layout restructuring only.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the node to wrap.' },
                wrapperType: { type: 'string', description: 'JSX tag for the new wrapper, e.g. "div", "section".' },
                props: {
                    type: 'object',
                    description: 'Optional JSX attributes for the wrapper element.',
                    additionalProperties: { type: 'string' },
                },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'wrapperType', 'reasoning'],
        },
    },
    {
        name: 'bridge_delete_node',
        description: 'Remove a JSX element and all its children from the tree. This also clears any component_overrides rows for the deleted node.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the element to remove.' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'reasoning'],
        },
    },
    {
        name: 'bridge_add_class',
        description: 'Append one design-token Tailwind class to a node\'s className. Call bridge_read_tokens first to find valid class names.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the target node.' },
                className: { type: 'string', description: 'Single Tailwind class to add, e.g. "mt-4" or "bg-brand-primary".' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'className', 'reasoning'],
        },
    },
    {
        name: 'bridge_remove_class',
        description: 'Remove one specific Tailwind class from a node\'s className.',
        input_schema: {
            type: 'object' as const,
            properties: {
                targetId: { type: 'string', description: 'data-bridge-id of the target node.' },
                className: { type: 'string', description: 'Exact class string to remove.' },
                reasoning: { type: 'string', description: 'One-sentence explanation shown in the UI diff card.' },
            },
            required: ['targetId', 'className', 'reasoning'],
        },
    },
]

// ── System Prompt (Phase M) ───────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are the Bridge Auditor, an AI assistant integrated into Bridge IDE — the world's first Agentic UI Operating System. Your role is to make precise, design-system-compliant, accessible component edits using the Bridge tool catalog.

## Non-Negotiable Rules (Commandments 15 & 16)

1. **Granular Tools Only**: You MUST only use the tools provided. You may NEVER generate raw source code strings or full-file replacements. Every edit must target a specific data-bridge-id.

2. **No Hallucinated IDs**: Every targetId you use MUST come from the source code returned by bridge_read_code. Never invent or guess a bridge ID.

3. **No Hallucinated Styling**: Before proposing any className, call bridge_read_tokens. Only use token classes in the result.

4. **Preserve data-bridge-id**: Never remove or change a data-bridge-id attribute in any mutation.

5. **Accessibility First**: If your task touches interactive elements (button, a, input, img), call bridge_audit_a11y first. Fix violations as part of your response.

## Workflow

For every task:
1. bridge_read_code → understand the structure and collect real bridge IDs
2. bridge_read_tokens → get valid token classes (skip only for non-style tasks)
3. Propose the minimum set of granular tool calls needed
4. Always include concise reasoning in every tool call

Always be concise. The user is an engineer; skip preamble.`

// ── Chat Message Types ────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'assistant' | 'tool_call' | 'tool_result'
    content: string
    toolUseId?: string
    toolName?: string
    toolInput?: Record<string, unknown>
}

export interface OrchestratorChunk {
    type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'validation_error'
    text?: string
    toolName?: string
    toolInput?: Record<string, unknown>
    toolUseId?: string
    error?: string
}

// ── LspRouter — maps active file extension to the correct ILspClient ──────────

/**
 * Returns the appropriate ILspClient for the given file path.
 * Falls back to the TypeScript LSP for unknown/unregistered extensions.
 */
function lspForFile(filePath?: string | null): ILspClient {
    if (!filePath) return tsLspClient
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'vue') return vueLspClient
    // html — no async snippet validation needed (HtmlAdapter stub returns null)
    if (ext === 'html') return tsLspClient
    return tsLspClient  // ts / tsx / js / jsx
}

// ── Phase M → N.3/N.5: ILspClient-backed Validator (Commandment 16) ──────────
//
// Before any mutation tool call is emitted to the UI for user confirmation,
// we assemble a minimal JSX/HTML fragment from the proposed operation and run
// it through an ILspClient. If validation fails, the error is returned so the
// orchestrator can feed it back to the AI invisibly.
//
// Using ILspClient (instead of direct Babel) makes this loop framework-agnostic:
// a VueAdapter or AngularAdapter can supply a Volar or Angular LS client.

const MUTATION_TOOL_NAMES = new Set([
    'bridge_update_props',
    'bridge_update_text',
    'bridge_insert_node',
    'bridge_wrap_node',
    'bridge_delete_node',
    'bridge_add_class',
    'bridge_remove_class',
])

/**
 * Validates a single mutation tool call.
 *
 * Synchronous guards (fast, zero I/O) fire first:
 *   • data-bridge-id tampering check
 *   • compound className guard
 *   • prop value type check
 *
 * Then async LSP validation fires for structural ops that produce JSX snippets:
 *   • bridge_insert_node  — checks the new element's JSX is valid TypeScript
 *   • bridge_wrap_node    — checks the wrapper element's JSX is valid TypeScript
 *
 * @param lsp  The ILspClient to use. Defaults to the shared tsLspClient singleton.
 */
async function validateToolInput(
    toolName: string,
    input: Record<string, unknown>,
    lsp: ILspClient = tsLspClient,
): Promise<string | null> {
    if (!MUTATION_TOOL_NAMES.has(toolName)) return null  // read-only tools always pass

    // ── Synchronous guards (no I/O) ─────────────────────────────────────────────
    if (toolName === 'bridge_update_props') {
        const props = (input.props as Record<string, string>) ?? {}
        for (const [k, v] of Object.entries(props)) {
            if (k === 'data-bridge-id') {
                return 'Commandment 7 violation: data-bridge-id must never be modified.'
            }
            if (typeof v !== 'string') {
                return `Prop "${k}" value must be a plain string, not a JS expression.`
            }
        }
        return null  // prop-only changes don’t need LSP
    }

    if (toolName === 'bridge_add_class' || toolName === 'bridge_remove_class') {
        const className = typeof input.className === 'string' ? input.className : ''
        if (className.trim().includes(' ')) {
            return `className must be a single class token, not a compound string. Got: "${className}". Call this tool once per class.`
        }
        return null  // class-level changes don’t need LSP
    }

    // ── Async LSP validation (structural JSX ops) ──────────────────────────────
    let snippet: string | null = null

    if (toolName === 'bridge_insert_node') {
        const nodeType = typeof input.nodeType === 'string' ? input.nodeType : 'div'
        const children = typeof input.children === 'string' ? input.children : ''
        snippet = `const __v = <${nodeType}>${children}</${nodeType}>;`
    } else if (toolName === 'bridge_wrap_node') {
        const wrapperType = typeof input.wrapperType === 'string' ? input.wrapperType : 'div'
        snippet = `const __v = <${wrapperType}><div /></${wrapperType}>;`
    }

    if (snippet !== null) {
        return await lsp.validateSnippet(snippet)
    }

    return null  // all other ops pass by default
}

// ── Core: sendChatMessage ─────────────────────────────────────────────────────

/**
 * Sends a conversation to Anthropic and streams chunks back via the `onChunk`
 * callback, which is invoked for each text delta, tool_use block, and at completion.
 *
 * The caller (main.ts IPC handler) is responsible for forwarding each chunk to
 * the renderer via `event.sender.send('ai:chunk', chunk)`.
 */
export async function sendChatMessage(
    messages: ChatMessage[],
    onChunk: (chunk: OrchestratorChunk) => void,
    activeFilePath?: string | null,
): Promise<void> {
    const lsp = lspForFile(activeFilePath)
    const config = await readConfig()

    if (!config.apiKey) {
        onChunk({ type: 'error', error: 'No API key configured. Open AI Settings to set a key.' })
        return
    }

    try {
        if (config.provider === 'openai') {
            const OpenAI = (await import('openai')).default
            const client = new OpenAI({
                apiKey: config.apiKey,
                ...(config.baseURL ? { baseURL: config.baseURL } : {}),
            })
            const model = config.model && config.model.length > 0 ? config.model : 'gpt-4o'
            const stream = await client.chat.completions.create({
                model,
                stream: true,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...messages.filter(m => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
                ]
            })
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta
                if (delta?.content) {
                    onChunk({ type: 'text', text: delta.content })
                }
            }
            onChunk({ type: 'done' })
        } else if (config.provider === 'gemini') {
            const { GoogleGenAI } = await import('@google/genai')
            // Gemini SDK uses `baseUrl` (no trailing 'L') for the optional endpoint override.
            const ai = new GoogleGenAI({
                apiKey: config.apiKey,
                ...(config.baseURL ? { baseUrl: config.baseURL } : {}),
            })
            const model = config.model && config.model.length > 0 ? config.model : 'gemini-2.5-flash'
            const stream = await ai.models.generateContentStream({
                model,
                contents: messages.filter(m => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
                config: { systemInstruction: SYSTEM_PROMPT }
            })
            for await (const chunk of stream) {
                if (chunk.text) {
                    onChunk({ type: 'text', text: chunk.text })
                }
            }
            onChunk({ type: 'done' })
        } else {
            // Default Anthropic branch — fully supports the Bridge Tool Catalog
            const client = new Anthropic({
                apiKey: config.apiKey,
                ...(config.baseURL ? { baseURL: config.baseURL } : {}),
            })
            const model = (config.model && config.model.length > 0 ? config.model : DEFAULT_MODEL) as Parameters<typeof client.messages.stream>[0]['model']

            const anthropicMessages: Anthropic.MessageParam[] = []

            for (const m of messages) {
                if (m.role === 'user' || m.role === 'assistant') {
                    const lastMsg = anthropicMessages[anthropicMessages.length - 1]
                    if (lastMsg && lastMsg.role === m.role) {
                        if (typeof lastMsg.content === 'string') {
                            lastMsg.content = [{ type: 'text', text: lastMsg.content }, { type: 'text', text: m.content }]
                        } else {
                            lastMsg.content.push({ type: 'text', text: m.content })
                        }
                    } else {
                        anthropicMessages.push({ role: m.role, content: m.content })
                    }
                } else if (m.role === 'tool_call') {
                    const lastMsg = anthropicMessages[anthropicMessages.length - 1]
                    const toolUseBlock = {
                        type: 'tool_use' as const,
                        id: m.toolUseId!,
                        name: m.toolName!,
                        input: m.toolInput || {}
                    }
                    if (lastMsg && lastMsg.role === 'assistant') {
                        if (typeof lastMsg.content === 'string') {
                            lastMsg.content = [{ type: 'text', text: lastMsg.content }]
                        }
                        // Anthropic SDK's ContentBlock union is strict on discriminant fields;
                        // use unknown intermediate to satisfy the type checker at the push site.
                        ; (lastMsg.content as unknown as Anthropic.MessageParam['content'] & unknown[]).push(toolUseBlock)
                    } else {
                        anthropicMessages.push({
                            role: 'assistant',
                            content: [toolUseBlock]
                        })
                    }
                } else if (m.role === 'tool_result') {
                    const lastMsg = anthropicMessages[anthropicMessages.length - 1]
                    const toolResultBlock = {
                        type: 'tool_result' as const,
                        tool_use_id: m.toolUseId!,
                        content: m.content,
                    }
                    if (lastMsg && lastMsg.role === 'user') {
                        if (typeof lastMsg.content === 'string') {
                            lastMsg.content = [{ type: 'text', text: lastMsg.content }]
                        }
                        ; (lastMsg.content as unknown as Anthropic.MessageParam['content'] & unknown[]).push(toolResultBlock)
                    } else {
                        anthropicMessages.push({
                            role: 'user',
                            content: [toolResultBlock]
                        })
                    }
                }
            }

            const stream = await client.messages.stream({
                model,
                max_tokens: 4096,
                system: SYSTEM_PROMPT,
                tools: BRIDGE_TOOLS,
                messages: anthropicMessages,
            })

            for await (const event of stream) {
                if (event.type === 'content_block_delta') {
                    if (event.delta.type === 'text_delta') {
                        onChunk({ type: 'text', text: event.delta.text })
                    }
                } else if (event.type === 'content_block_start') {
                    if (event.content_block.type === 'tool_use') {
                        onChunk({
                            type: 'tool_call',
                            toolName: event.content_block.name,
                            toolUseId: event.content_block.id,
                            toolInput: {},
                        })
                    }
                } else if (event.type === 'message_stop') {
                    const finalMsg = await stream.finalMessage()
                    for (const block of finalMsg.content) {
                        if (block.type === 'tool_use') {
                            const toolInput = block.input as Record<string, unknown>

                            // ── Commandment 16: ILspClient Validation (Phase N.3) ─────────
                            // Validate the tool call before surfacing to UI.
                            // If it fails, emit a validation_error chunk so orchestratorStore
                            // can feed an invisible error tool_result back to the AI.
                            const validationError = await validateToolInput(block.name, toolInput, lsp)
                            if (validationError) {
                                console.warn(`[Bridge] Phase M validation blocked tool ${block.name}: ${validationError}`)
                                onChunk({
                                    type: 'validation_error',
                                    toolName: block.name,
                                    toolUseId: block.id,
                                    error: validationError,
                                })
                            } else {
                                onChunk({
                                    type: 'tool_call',
                                    toolName: block.name,
                                    toolUseId: block.id,
                                    toolInput,
                                })
                            }
                        }
                    }
                    onChunk({ type: 'done' })
                }

            }
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        onChunk({ type: 'error', error: `API error: ${msg}` })
    }
}
