/**
 * toolEnricher.ts — Phase ACX.3: Pre-flight Context Injection
 *
 * Intercepts eligible tool calls and prepends a structured "Bridge Context
 * Preamble" to the tool's response. The preamble gives the agent target-node
 * details, active violations, and sibling context without requiring a separate
 * read call.
 *
 * Enrichment-eligible tools:
 *   - bridge_ast_mutate → MutateEnrichment (target node props, violations,
 *                          parent tag, sibling IDs)
 *   - bridge_fix        → FixEnrichment (violation details, suggested fix ops)
 *   - bridge_audit      → Token context appended to result (top violated
 *                          categories, top-3 suggested fixes)
 *
 * Read-only tools (bridge_status, bridge_query_registry, etc.) pass through
 * unchanged.
 *
 * Performance budget: < 20ms per enrichment call.
 * Graceful degradation: if any step fails, original result is returned
 * unchanged.
 */

import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { SessionContext } from './sessionContext.js'
import type { ToolEnrichment } from '../types.js'

// Re-export for consumers that import from this module
export type { ToolEnrichment }

// CJS/ESM interop — mirrors the pattern used in MithrilLinter.ts
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

export interface MutateEnrichment {
    /** Target node's current props (from live AST). */
    nodeProps: Record<string, string>
    /** Target node's current className, if present. */
    nodeClassName: string | null
    /** Parent tag + bridge ID. */
    parentContext: { tagName: string; bridgeId: string } | null
    /** Sibling node IDs for position context. */
    siblingIds: string[]
    /** Active violations on this specific node. */
    nodeViolations: Array<{
        nodeId: string
        ruleId: string
        severity: 'amber' | 'critical'
        message: string
        fixable: boolean
    }>
}

export interface FixEnrichment {
    /** Violations on the target file. */
    violations: Array<{
        nodeId: string
        ruleId: string
        severity: 'amber' | 'critical'
        message: string
        fixable: boolean
    }>
    /** Suggested high-confidence fix operations. */
    suggestedOps: Array<{
        nodeId: string
        currentClass: string
        suggestedClass: string
        confidence: 'high' | 'medium'
    }>
}

// ── AST-based node extraction ─────────────────────────────────────────────────

interface NodeASTInfo {
    nodeProps: Record<string, string>
    nodeClassName: string | null
    nodeText: string | null
    parentContext: { tagName: string; bridgeId: string } | null
    siblingIds: string[]
}

/**
 * Parse a file and extract node context for a specific bridge ID.
 *
 * Reuses the Babel parse pattern from MithrilLinter.ts.
 * Budget: the traversal is short-circuit — it stops once the target node and
 * its parent are found. Empirically < 10ms on typical component files.
 *
 * Returns null on any parse/IO failure (graceful degradation).
 */
function extractNodeContext(filePath: string, nodeId: string): NodeASTInfo | null {
    try {
        const source = fs.readFileSync(filePath, 'utf-8')
        const ast = parse(source, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        })

        let result: NodeASTInfo | null = null

        traverse(ast, {
            JSXElement(nodePath) {
                const openingEl = nodePath.node.openingElement

                // Check if this element has the matching data-bridge-id
                let foundId: string | null = null
                let className: string | null = null
                const props: Record<string, string> = {}

                for (const attr of openingEl.attributes) {
                    if (!t.isJSXAttribute(attr)) continue
                    const attrName = t.isJSXIdentifier(attr.name) ? attr.name.name : null
                    if (!attrName) continue

                    // Extract data-bridge-id
                    if (attrName === 'data-bridge-id') {
                        if (t.isStringLiteral(attr.value)) {
                            foundId = attr.value.value
                        } else if (
                            t.isJSXExpressionContainer(attr.value) &&
                            t.isStringLiteral(attr.value.expression)
                        ) {
                            foundId = attr.value.expression.value
                        }
                    }

                    // Extract className
                    if (attrName === 'className') {
                        if (t.isStringLiteral(attr.value)) {
                            className = attr.value.value
                        } else if (
                            t.isJSXExpressionContainer(attr.value) &&
                            t.isStringLiteral(attr.value.expression)
                        ) {
                            className = attr.value.expression.value
                        }
                    }

                    // Collect other props (truncated to 80 chars)
                    if (
                        attrName !== 'data-bridge-id' &&
                        attrName !== 'className'
                    ) {
                        let propValue: string | null = null
                        if (t.isStringLiteral(attr.value)) {
                            propValue = attr.value.value
                        } else if (attr.value === null) {
                            propValue = 'true'
                        } else if (
                            t.isJSXExpressionContainer(attr.value) &&
                            t.isStringLiteral(attr.value.expression)
                        ) {
                            propValue = attr.value.expression.value
                        }
                        if (propValue !== null) {
                            props[attrName] = propValue.slice(0, 80)
                        }
                    }
                }

                if (foundId !== nodeId) return

                // Found target node — extract text content
                let nodeText: string | null = null
                for (const child of nodePath.node.children) {
                    if (t.isJSXText(child)) {
                        const trimmed = child.value.trim()
                        if (trimmed) {
                            nodeText = trimmed.slice(0, 80)
                            break
                        }
                    }
                }

                // Extract parent context
                let parentContext: NodeASTInfo['parentContext'] = null
                const parentPath = nodePath.parentPath
                if (parentPath && parentPath.isJSXElement()) {
                    const parentOpeningEl = parentPath.node.openingElement
                    const parentTagName = t.isJSXIdentifier(parentOpeningEl.name)
                        ? parentOpeningEl.name.name
                        : t.isJSXMemberExpression(parentOpeningEl.name)
                            ? `${(parentOpeningEl.name.object as t.JSXIdentifier).name}.${parentOpeningEl.name.property.name}`
                            : 'unknown'

                    let parentBridgeId = ''
                    for (const pAttr of parentOpeningEl.attributes) {
                        if (!t.isJSXAttribute(pAttr)) continue
                        if (
                            t.isJSXIdentifier(pAttr.name) &&
                            pAttr.name.name === 'data-bridge-id'
                        ) {
                            if (t.isStringLiteral(pAttr.value)) {
                                parentBridgeId = pAttr.value.value
                            }
                        }
                    }

                    if (parentBridgeId) {
                        parentContext = { tagName: parentTagName, bridgeId: parentBridgeId }
                    }
                }

                // Extract sibling node IDs
                const siblingIds: string[] = []
                if (parentPath && parentPath.isJSXElement()) {
                    for (const sibling of parentPath.node.children) {
                        if (!t.isJSXElement(sibling)) continue
                        for (const sAttr of sibling.openingElement.attributes) {
                            if (!t.isJSXAttribute(sAttr)) continue
                            if (
                                t.isJSXIdentifier(sAttr.name) &&
                                sAttr.name.name === 'data-bridge-id' &&
                                t.isStringLiteral(sAttr.value) &&
                                sAttr.value.value !== nodeId
                            ) {
                                siblingIds.push(sAttr.value.value)
                            }
                        }
                    }
                }

                result = {
                    nodeProps: props,
                    nodeClassName: className,
                    nodeText,
                    parentContext,
                    siblingIds,
                }

                // Short-circuit the traversal
                nodePath.stop()
            },
        })

        return result
    } catch {
        return null
    }
}

// ── Token context extraction for audit enrichment ─────────────────────────────

interface AuditTokenContext {
    topViolatedCategories: Array<{ category: string; count: number }>
    topSuggestions: Array<{ ruleId: string; message: string; suggestion: string }>
}

/**
 * Parse an audit result JSON string and extract token-level context.
 * Used to append suggestions to bridge_audit results.
 */
function extractAuditTokenContext(
    auditResultText: string,
    projectRoot: string,
): AuditTokenContext | null {
    try {
        const result = JSON.parse(auditResultText) as {
            violations?: Array<{
                ruleId?: string
                type?: string
                severity?: string
                message?: string
            }>
            mithrilCount?: number
            a11yCount?: number
        }

        if (!result.violations || result.violations.length === 0) {
            return null
        }

        // Count violations by category (derived from ruleId prefix)
        const categoryCounts = new Map<string, number>()
        for (const v of result.violations) {
            const ruleId = v.ruleId ?? v.type ?? 'UNKNOWN'
            const category = ruleId.split('-')[0] ?? 'UNKNOWN'
            categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
        }

        // Top 10 most-violated categories
        const topViolatedCategories = Array.from(categoryCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([category, count]) => ({ category, count }))

        // Load token names for suggestion context
        let tokenNames: string[] = []
        try {
            const tokensPath = path.join(projectRoot, '.bridge', 'design-tokens.json')
            if (fs.existsSync(tokensPath)) {
                const raw = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
                const tokens = Array.isArray(raw) ? raw : Object.values(raw)
                tokenNames = (tokens as Array<{ token_path?: string }>)
                    .slice(0, 20)
                    .map((t) => t.token_path ?? '')
                    .filter(Boolean)
            }
        } catch {
            // Non-fatal
        }

        // Top 3 violations with fix suggestions
        const topSuggestions = result.violations.slice(0, 3).map((v) => {
            const ruleId = v.ruleId ?? v.type ?? 'UNKNOWN'
            const suggestion =
                ruleId.startsWith('MITHRIL') && tokenNames.length > 0
                    ? `Replace hardcoded value with a design token (e.g. ${tokenNames[0]})`
                    : ruleId.startsWith('A11Y')
                        ? 'Add required accessibility attribute (see WCAG 2.1 AA)'
                        : 'Apply nearest design token from .bridge/design-tokens.json'
            return {
                ruleId,
                message: v.message ?? 'No message',
                suggestion,
            }
        })

        return { topViolatedCategories, topSuggestions }
    } catch {
        return null
    }
}

// ── Preamble formatting ───────────────────────────────────────────────────────

function formatMutatePreamble(
    nodeId: string,
    astInfo: NodeASTInfo | null,
    nodeViolations: MutateEnrichment['nodeViolations'],
): string {
    const lines: string[] = ['--- Bridge Context Preamble ---']

    lines.push(`Target node: data-bridge-id="${nodeId}"`)

    if (astInfo) {
        if (astInfo.nodeClassName) {
            lines.push(`className: "${astInfo.nodeClassName}"`)
        }

        if (Object.keys(astInfo.nodeProps).length > 0) {
            const propsStr = Object.entries(astInfo.nodeProps)
                .map(([k, v]) => `${k}="${v}"`)
                .join(' ')
            lines.push(`Props: ${propsStr}`)
        }

        if (astInfo.nodeText) {
            lines.push(`Text content: "${astInfo.nodeText}"`)
        }

        if (astInfo.parentContext) {
            lines.push(
                `Parent: <${astInfo.parentContext.tagName} data-bridge-id="${astInfo.parentContext.bridgeId}">`,
            )
        }

        if (astInfo.siblingIds.length > 0) {
            lines.push(`Siblings: [${astInfo.siblingIds.join(', ')}]`)
        }
    }

    if (nodeViolations.length > 0) {
        lines.push('Active violations on this node:')
        for (const v of nodeViolations) {
            const fixable = v.fixable ? ' (fixable)' : ''
            lines.push(`  - ${v.ruleId} [${v.severity}]: ${v.message}${fixable}`)
        }
    } else {
        lines.push('Active violations on this node: none')
    }

    lines.push('---')
    return lines.join('\n')
}

function formatFixPreamble(filePath: string, enrich: FixEnrichment): string {
    const lines: string[] = [
        '--- Bridge Context Preamble ---',
        `File: ${filePath}`,
        `Total violations: ${enrich.violations.length}`,
    ]

    if (enrich.violations.length > 0) {
        lines.push('Violations:')
        for (const v of enrich.violations) {
            const fixable = v.fixable ? ' fixable' : ''
            lines.push(
                `  - [${v.ruleId}] node="${v.nodeId}" severity=${v.severity}${fixable}: ${v.message}`,
            )
        }
    }

    if (enrich.suggestedOps.length > 0) {
        lines.push('Suggested fixes:')
        for (const op of enrich.suggestedOps) {
            lines.push(
                `  - node="${op.nodeId}": "${op.currentClass}" -> "${op.suggestedClass}" (${op.confidence} confidence)`,
            )
        }
    }

    lines.push('---')
    return lines.join('\n')
}

function formatAuditAppendix(ctx: AuditTokenContext): string {
    const lines: string[] = ['', '--- Bridge Token Context ---']

    if (ctx.topViolatedCategories.length > 0) {
        lines.push('Top violated categories:')
        for (const { category, count } of ctx.topViolatedCategories) {
            lines.push(`  - ${category}: ${count} violation${count === 1 ? '' : 's'}`)
        }
    }

    if (ctx.topSuggestions.length > 0) {
        lines.push('Suggested fixes for top violations:')
        for (const s of ctx.topSuggestions) {
            lines.push(`  - [${s.ruleId}] ${s.suggestion}`)
        }
    }

    lines.push('---')
    return lines.join('\n')
}

// ── Violation extraction from SessionContext ──────────────────────────────────

function extractNodeViolations(
    ctx: SessionContext,
    nodeId: string | null,
): MutateEnrichment['nodeViolations'] {
    if (!nodeId) return []
    if (!ctx.violations.affectedNodeIds.includes(nodeId)) return []

    return [
        {
            nodeId,
            ruleId: ctx.violations.criticalCount > 0 ? 'VIOLATION-CRITICAL' : 'VIOLATION',
            severity: ctx.violations.criticalCount > 0 ? 'critical' : 'amber',
            message: `Node has ${ctx.violations.mithrilCount > 0 ? 'Mithril design system' : 'accessibility'} violations`,
            fixable: ctx.violations.hasFixableViolations,
        },
    ]
}

function buildSuggestedOps(ctx: SessionContext): FixEnrichment['suggestedOps'] {
    if (!ctx.violations.hasFixableViolations) return []

    return ctx.violations.affectedNodeIds.slice(0, 3).map((nodeId) => ({
        nodeId,
        currentClass: '(hardcoded-value)',
        suggestedClass: '(nearest-design-token)',
        confidence: 'medium' as const,
    }))
}

// ── Core enrichment functions ─────────────────────────────────────────────────

function enrichAstMutate(
    args: Record<string, unknown>,
    ctx: SessionContext,
): ToolEnrichment | null {
    const mutations = args['mutations'] as Array<Record<string, unknown>> | undefined
    const firstMutation = mutations?.[0]
    const mutArgs = firstMutation?.['args'] as Record<string, unknown> | undefined

    // Accept nodeId, targetId, sourceId — mutation types use different field names
    const nodeId = (
        mutArgs?.['nodeId'] ??
        mutArgs?.['targetId'] ??
        mutArgs?.['targetNodeId'] ??
        ''
    ) as string

    if (!nodeId) return null

    const targetPath = (args['targetPath'] ?? '') as string
    const nodeViolations = extractNodeViolations(ctx, nodeId)

    // Real AST extraction — short-circuit traversal, graceful degradation
    const astInfo = targetPath ? extractNodeContext(targetPath, nodeId) : null

    const contextPreamble = formatMutatePreamble(nodeId, astInfo, nodeViolations)

    return {
        toolName: 'bridge_ast_mutate',
        contextPreamble,
        data: {
            nodeId,
            nodeClassName: astInfo?.nodeClassName ?? null,
            parentContext: astInfo?.parentContext ?? null,
            siblingIds: astInfo?.siblingIds ?? [],
            nodeViolations,
            activeFile: ctx.activeFilePath,
            totalViolations: ctx.violations.mithrilCount + ctx.violations.a11yCount,
        },
    }
}

function enrichFix(
    args: Record<string, unknown>,
    ctx: SessionContext,
): ToolEnrichment | null {
    const filePath = (args['filePath'] ?? ctx.activeFilePath ?? '') as string

    const violations: FixEnrichment['violations'] = ctx.violations.affectedNodeIds.map(
        (nodeId) => ({
            nodeId,
            ruleId: ctx.violations.criticalCount > 0 ? 'VIOLATION-CRITICAL' : 'VIOLATION',
            severity: ctx.violations.criticalCount > 0 ? ('critical' as const) : ('amber' as const),
            message: 'Design system or accessibility violation detected',
            fixable: ctx.violations.hasFixableViolations,
        }),
    )

    const suggestedOps = buildSuggestedOps(ctx)
    const enrich: FixEnrichment = { violations, suggestedOps }
    const contextPreamble = formatFixPreamble(filePath, enrich)

    return {
        toolName: 'bridge_fix',
        contextPreamble,
        data: {
            filePath,
            violationCount: violations.length,
            suggestedOpsCount: suggestedOps.length,
        },
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Determine whether a tool is enrichment-eligible.
 *
 * Mutation tools receive a prepended context preamble.
 * The audit tool receives an appended token context block.
 * All other tools pass through unchanged.
 */
export function isEnrichableTool(toolName: string): boolean {
    return (
        toolName === 'bridge_ast_mutate' ||
        toolName === 'bridge_fix' ||
        toolName === 'bridge_audit'
    )
}

/**
 * Enrich a tool call with context from the current SessionContext.
 *
 * Used for mutation tools (bridge_ast_mutate, bridge_fix) where the
 * enrichment is prepended to the tool result.
 *
 * Returns null for non-enrichable tools or when context is unavailable.
 * Never throws — enrichment is always best-effort.
 */
export function enrichToolCall(
    toolName: string,
    args: Record<string, unknown>,
    ctx: SessionContext | null,
): ToolEnrichment | null {
    try {
        if (!ctx) return null

        if (toolName === 'bridge_ast_mutate') {
            return enrichAstMutate(args, ctx)
        }

        if (toolName === 'bridge_fix') {
            return enrichFix(args, ctx)
        }

        return null
    } catch {
        return null
    }
}

/**
 * Enrich a tool result string with pre-flight context.
 *
 * This is the primary public API for ACX.3. It wraps the raw tool result
 * string and returns a new string with context injected:
 *
 *   - Mutation tools (bridge_ast_mutate, bridge_fix): context preamble
 *     prepended before the original result
 *   - Audit tools (bridge_audit): token context block appended after the
 *     original result
 *   - Read-only tools: original result returned unchanged
 *
 * Performance budget: < 20ms (AST traversal short-circuits on node find).
 * Graceful degradation: any failure returns originalResult unchanged.
 *
 * @param toolName     - The MCP tool name
 * @param toolInput    - The tool's input arguments
 * @param toolResult   - The raw tool result string (already serialised)
 * @param projectRoot  - Absolute path to the project root
 */
export function enrichToolResult(
    toolName: string,
    toolInput: Record<string, unknown>,
    toolResult: string,
    projectRoot: string,
): string {
    try {
        if (!isEnrichableTool(toolName)) {
            return toolResult
        }

        // Audit tool — append token context to the result
        if (toolName === 'bridge_audit') {
            const auditCtx = extractAuditTokenContext(toolResult, projectRoot)
            if (!auditCtx) return toolResult
            return toolResult + formatAuditAppendix(auditCtx)
        }

        // Mutation tools — prepend context preamble
        // Build a minimal session context from what we can read directly
        const minimalCtx = buildMinimalContext(toolInput, projectRoot)
        if (!minimalCtx) return toolResult

        let enrichment: ToolEnrichment | null = null

        if (toolName === 'bridge_ast_mutate') {
            enrichment = enrichAstMutate(toolInput, minimalCtx)
        } else if (toolName === 'bridge_fix') {
            enrichment = enrichFix(toolInput, minimalCtx)
        }

        if (!enrichment) return toolResult
        return enrichment.contextPreamble + '\n' + toolResult
    } catch {
        return toolResult
    }
}

/**
 * Build a minimal SessionContext from disk reads, suitable for enrichment.
 *
 * Does NOT call assembleSessionContext (which is async and potentially slow).
 * Reads only the context.json violation summary for enrichment purposes.
 */
function buildMinimalContext(
    toolInput: Record<string, unknown>,
    projectRoot: string,
): SessionContext | null {
    try {
        const contextPath = path.join(projectRoot, '.bridge', 'context.json')
        let violations = {
            mithrilCount: 0,
            a11yCount: 0,
            amberCount: 0,
            criticalCount: 0,
            affectedNodeIds: [] as string[],
            hasFixableViolations: false,
        }

        if (fs.existsSync(contextPath)) {
            try {
                const raw = JSON.parse(fs.readFileSync(contextPath, 'utf-8'))
                if (raw.violations) {
                    violations = { ...violations, ...raw.violations }
                }
            } catch {
                // Use empty violations
            }
        }

        const activeFilePath =
            (toolInput['targetPath'] ?? toolInput['filePath'] ?? null) as string | null

        return {
            assembledAt: new Date().toISOString(),
            projectRoot,
            canvas: {
                activeFile: activeFilePath,
                selectedNodeId: null,
                canvasMode: null,
                figmaConnected: false,
                saveState: null,
            },
            activeFileSource: null,
            activeFilePath,
            violations,
            tokens: {
                totalCount: 0,
                byType: {},
                top20: [],
            },
            recentMutations: [],
            healthScore: null,
            healthGrade: null,
            partial: true,
        }
    } catch {
        return null
    }
}
