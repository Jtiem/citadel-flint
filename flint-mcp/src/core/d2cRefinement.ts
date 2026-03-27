// ---------------------------------------------------------------------------
// D2C.5 — AI Refinement Pass (Classification + Targeted Refinement)
// ---------------------------------------------------------------------------
// Phase 1: classifyWithAI() — Haiku model classifies Figma nodes to improve
//          heuristic accuracy. Returns a structured map, not code generation.
// Phase 2: refineComponent() — Sonnet model improves a single component scaffold
//          with library-idiomatic code. Validated via Babel parse before use.
//
// Both functions are pure aside from the API call. No disk I/O. No IPC.
// API key resolution: ANTHROPIC_API_KEY env → .flint/config.json → skip gracefully.
// ---------------------------------------------------------------------------

import { parse } from '@babel/parser'
import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Type contracts
// ---------------------------------------------------------------------------

export interface ClassificationResult {
    classifications: Map<string, string> // nodeId → componentType
    /** Per-node confidence scores from the AI classification (0.0-1.0) */
    confidences: Map<string, number> // nodeId → confidence
    source: 'ai' | 'fallback'
    latencyMs: number
}

export interface RefinementResult {
    code: string
    status: 'refined' | 'fallback'
    latencyMs: number
    reason?: string // why fallback was used
}

// ---------------------------------------------------------------------------
// API key resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the Anthropic API key from environment or project config.
 * Resolution order:
 *   1. ANTHROPIC_API_KEY environment variable
 *   2. .flint/config.json → anthropicApiKey field
 *   3. null (AI features skipped gracefully)
 */
export function resolveApiKey(projectRoot?: string): string | null {
    // 1. Environment variable (standard for MCP servers)
    const envKey = process.env.ANTHROPIC_API_KEY
    if (envKey && envKey.trim().length > 0) {
        return envKey.trim()
    }

    // 2. Project config file
    if (projectRoot) {
        const configFile = path.join(projectRoot, '.flint', 'config.json')
        try {
            if (fs.existsSync(configFile)) {
                const raw = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
                if (typeof raw.anthropicApiKey === 'string' && raw.anthropicApiKey.trim().length > 0) {
                    return raw.anthropicApiKey.trim()
                }
            }
        } catch {
            // Config unreadable — fall through
        }
    }

    return null
}

// ---------------------------------------------------------------------------
// Phase 1: AI Classification
// ---------------------------------------------------------------------------

const CLASSIFICATION_TIMEOUT_MS = 5000
const CLASSIFICATION_MODEL = 'claude-3-5-haiku-latest'

/**
 * Classify Figma nodes using AI to improve heuristic component recognition.
 *
 * Sends the node tree structure to Haiku for fast, cheap classification.
 * Returns a Map of nodeId → componentType overrides.
 *
 * On any failure (timeout, malformed response, missing API key) returns an
 * empty map with source='fallback'. The deterministic scaffold is never degraded.
 */
export async function classifyWithAI(
    nodeTree: unknown,
    library: string,
    apiKey: string | null,
): Promise<ClassificationResult> {
    const start = Date.now()

    // No API key → graceful skip
    if (!apiKey) {
        return {
            classifications: new Map(),
            confidences: new Map(),
            source: 'fallback',
            latencyMs: Date.now() - start,
        }
    }

    const validTypes = [
        'input', 'textarea', 'select', 'checkbox', 'switch',
        'avatar', 'badge', 'tabs', 'separator', 'alert',
        'button', 'card', 'form', 'nav', 'section', 'header', 'footer',
    ]

    const systemPrompt =
        `You are a UI component classifier. You analyze Figma design node trees and ` +
        `classify each node into the correct UI component type for the ${library} component library.\n\n` +
        `You will receive a JSON tree of Figma nodes with name, type, and children.\n\n` +
        `Your task: identify nodes and classify them as UI component types.\n\n` +
        `Output ONLY valid JSON: { "classifications": [{ "nodeId": "<node name>", "componentType": "<type>", "confidence": <0.0-1.0> }] }\n\n` +
        `Valid component types: ${validTypes.join(', ')}\n\n` +
        `Rules:\n` +
        `- Only output classifications where confidence >= 0.6\n` +
        `- Never output component types not in the valid list\n` +
        `- If no nodes can be classified, output { "classifications": [] }`

    const userPrompt =
        `Figma node tree:\n${JSON.stringify(nodeTree, null, 2)}\n\nTarget library: ${library}`

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), CLASSIFICATION_TIMEOUT_MS)

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: CLASSIFICATION_MODEL,
                max_tokens: 1024,
                messages: [
                    { role: 'user', content: userPrompt },
                ],
                system: systemPrompt,
            }),
            signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!response.ok) {
            return {
                classifications: new Map(),
                confidences: new Map(),
                source: 'fallback',
                latencyMs: Date.now() - start,
            }
        }

        const data = await response.json() as {
            content?: Array<{ type: string; text?: string }>
        }

        const text = data.content?.find(b => b.type === 'text')?.text ?? ''

        // Extract JSON from the response — handle both raw JSON and markdown-wrapped JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            return {
                classifications: new Map(),
                confidences: new Map(),
                source: 'fallback',
                latencyMs: Date.now() - start,
            }
        }

        const parsed = JSON.parse(jsonMatch[0]) as {
            classifications?: Array<{
                nodeId?: string
                componentType?: string
                confidence?: number
            }>
        }

        const classifications = new Map<string, string>()
        const confidences = new Map<string, number>()
        const validTypesSet = new Set(validTypes)

        if (Array.isArray(parsed.classifications)) {
            for (const entry of parsed.classifications) {
                if (
                    typeof entry.nodeId === 'string' &&
                    typeof entry.componentType === 'string' &&
                    typeof entry.confidence === 'number' &&
                    entry.confidence >= 0.6 &&
                    validTypesSet.has(entry.componentType)
                ) {
                    classifications.set(entry.nodeId, entry.componentType)
                    confidences.set(entry.nodeId, entry.confidence)
                }
            }
        }

        return {
            classifications,
            confidences,
            source: 'ai',
            latencyMs: Date.now() - start,
        }
    } catch {
        // Timeout, network error, parse error — all safe fallback
        return {
            classifications: new Map(),
            confidences: new Map(),
            source: 'fallback',
            latencyMs: Date.now() - start,
        }
    }
}

// ---------------------------------------------------------------------------
// Phase 2: Targeted Component Refinement
// ---------------------------------------------------------------------------

const REFINEMENT_TIMEOUT_MS = 15000
const REFINEMENT_MODEL = 'claude-sonnet-4-20250514'

/**
 * Refine a single component scaffold using AI.
 *
 * Sends the deterministic scaffold + Figma context to Sonnet for improvement.
 * The output is validated via Babel parse before replacing the scaffold.
 * On any validation or API failure, returns the original scaffold unchanged.
 */
export async function refineComponent(
    scaffold: string,
    figmaSubtree: unknown,
    library: string,
    idiomBlock: string,
    apiKey: string | null,
    screenshotBase64?: string,
    designSystemContext?: string,
): Promise<RefinementResult> {
    const start = Date.now()

    // No API key → graceful skip
    if (!apiKey) {
        return {
            code: scaffold,
            status: 'fallback',
            latencyMs: Date.now() - start,
            reason: 'No API key available',
        }
    }

    // Build the design system guidelines block (only when context is provided)
    const dsBlock = designSystemContext && designSystemContext.trim().length > 0
        ? `\nDesign System Guidelines:\n${designSystemContext}\n\n`
        : ''

    const systemPrompt =
        `You are a ${library} component specialist. You receive a React component ` +
        `scaffold generated from a Figma design and improve it to be production-ready ` +
        `${library} code.\n\n` +
        `${idiomBlock}\n` +
        `${dsBlock}` +
        `Rules:\n` +
        `1. ONLY use components from the ${library} library\n` +
        `2. Preserve the overall component structure — do not add new sections\n` +
        `3. Do not remove existing correct code\n` +
        `4. Do not add state management, event handlers, or business logic\n` +
        `5. Do not invent props or attributes not supported by ${library}\n` +
        `6. Fix layout issues: flex direction, gap, padding, alignment\n` +
        `7. Replace generic divs with the correct ${library} components when appropriate\n` +
        `8. Ensure all imports are correct for ${library}\n` +
        `9. Return ONLY the complete component code (imports + function), nothing else\n` +
        `10. Do NOT wrap the code in markdown code fences`

    // Build user content blocks
    const userContent: Array<{ type: string; text?: string; source?: unknown }> = []

    userContent.push({
        type: 'text',
        text:
            `Scaffold to improve:\n\`\`\`tsx\n${scaffold}\n\`\`\`\n\n` +
            `Figma subtree for reference:\n${JSON.stringify(figmaSubtree, null, 2)}`,
    })

    // Conditionally include screenshot for visual understanding
    if (screenshotBase64) {
        userContent.push({
            type: 'image',
            source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotBase64,
            },
        })
    }

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), REFINEMENT_TIMEOUT_MS)

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: REFINEMENT_MODEL,
                max_tokens: 4096,
                messages: [
                    { role: 'user', content: userContent },
                ],
                system: systemPrompt,
            }),
            signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!response.ok) {
            return {
                code: scaffold,
                status: 'fallback',
                latencyMs: Date.now() - start,
                reason: `API error: ${response.status} ${response.statusText}`,
            }
        }

        const data = await response.json() as {
            content?: Array<{ type: string; text?: string }>
        }

        let refinedCode = data.content?.find(b => b.type === 'text')?.text ?? ''

        // Strip markdown code fences if the model wraps output
        refinedCode = refinedCode
            .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gm, '')
            .replace(/```\s*$/gm, '')
            .trim()

        if (!refinedCode) {
            return {
                code: scaffold,
                status: 'fallback',
                latencyMs: Date.now() - start,
                reason: 'Empty response from AI',
            }
        }

        // Commandment 16: Validate via Babel parse before accepting
        try {
            parse(refinedCode, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
            })
        } catch (parseError: unknown) {
            const msg = parseError instanceof Error ? parseError.message : String(parseError)
            return {
                code: scaffold,
                status: 'fallback',
                latencyMs: Date.now() - start,
                reason: `Babel parse failed: ${msg}`,
            }
        }

        return {
            code: refinedCode,
            status: 'refined',
            latencyMs: Date.now() - start,
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
            code: scaffold,
            status: 'fallback',
            latencyMs: Date.now() - start,
            reason: `Request failed: ${msg}`,
        }
    }
}
