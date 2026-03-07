/**
 * VueAdapter.ts — src/core/adapters/VueAdapter.ts
 *
 * Abstract Syntax Protocol (ASP) — Phase N.5
 *
 * Implements IBridgeAdapter for Vue 3 Single-File Components (.vue).
 *
 * Strategy
 * ─────────
 * Vue SFCs have three blocks: <template>, <script>, and <style>.
 * Bridge only edits the **<template>** block. We leave <script> and <style>
 * entirely untouched so we don't interfere with TypeScript types,
 * Composition API setup, or scoped styles.
 *
 * The template AST produced by @vue/compiler-sfc is an "element node" tree
 * (NodeTypes.ELEMENT = 1). We traverse it to:
 *   1. Build the VisualLayer tree (read-only projection for the Layer Tree UI)
 *   2. Inject data-bridge-id attributes (by rewriting the raw source text)
 *   3. Perform AST mutations (className, text, prop, delete, move)
 *
 * Mutation strategy: We use the source `loc` (start/end offsets) embedded in
 * every AST node to surgically splice the minimum bytes into the raw .vue
 * source. This is the same "source-position splicing" used by most LSPs and
 * avoids multi-pass regeneration errors.
 *
 * Renderer Process only — no Node.js imports.
 */

import type { IBridgeAdapter } from './types'
import type { ASTMutation, InverseMutation } from '../ASTService'
import type { VisualLayer } from '../ast-parser'
import {
    parse,
    type SFCDescriptor,
} from '@vue/compiler-sfc'
import {
    NodeTypes,
    type TemplateChildNode,
    type ElementNode,
    type AttributeNode,
    type TextNode,
} from '@vue/compiler-core'

// ── ID utilities ──────────────────────────────────────────────────────────────

let _counter = 1
function makeId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return 'vue-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    }
    return 'vue-' + (++_counter).toString(16).padStart(8, '0')
}

// ── SFC helpers ───────────────────────────────────────────────────────────────

/**
 * Parses a Vue SFC string and returns the @vue/compiler-sfc descriptor.
 * Returns null on hard parse failure.
 */
function parseSfc(code: string): SFCDescriptor | null {
    try {
        const { descriptor, errors } = parse(code, { filename: 'bridge.vue' })
        if (errors.length > 0 && !descriptor.template) return null
        return descriptor
    } catch {
        return null
    }
}

/**
 * Reads the data-bridge-id prop from a Vue ElementNode.
 */
function getBridgeId(node: ElementNode): string | undefined {
    for (const prop of node.props) {
        if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'data-bridge-id') {
            return prop.value?.content ?? undefined
        }
    }
    return undefined
}

/**
 * Reads the static class attribute (if any) from a Vue ElementNode.
 * Only handles `:class` as a string literal; dynamic bindings are returned as-is.
 */
function getClassName(node: ElementNode): string | undefined {
    for (const prop of node.props) {
        if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'class') {
            return prop.value?.content ?? undefined
        }
    }
    return undefined
}

/**
 * Reads the first non-whitespace text child content of an ElementNode.
 */
function getTextContent(node: ElementNode): string | null {
    for (const child of node.children) {
        if (child.type === NodeTypes.TEXT) {
            const t = (child as TextNode).content.trim()
            if (t) return t
        }
    }
    return null
}

// ── findById — recursive search returning node + parent + index ────────────────

interface FoundNode {
    node: ElementNode
    parent: ElementNode | null  // null = top-level template child
    index: number
    parentChildren: TemplateChildNode[]
}

function findById(
    nodes: TemplateChildNode[],
    bridgeId: string,
    parent: ElementNode | null = null,
): FoundNode | null {
    for (let i = 0; i < nodes.length; i++) {
        const child = nodes[i]
        if (child.type === NodeTypes.ELEMENT) {
            const el = child as ElementNode
            if (getBridgeId(el) === bridgeId) {
                return { node: el, parent, index: i, parentChildren: nodes }
            }
            const found = findById(el.children as TemplateChildNode[], bridgeId, el)
            if (found) return found
        }
    }
    return null
}

// ── VisualLayer tree builder ───────────────────────────────────────────────────

function buildLayers(nodes: TemplateChildNode[]): VisualLayer[] {
    const result: VisualLayer[] = []
    for (const node of nodes) {
        if (node.type !== NodeTypes.ELEMENT) continue
        const el = node as ElementNode
        const id = getBridgeId(el)
        if (!id) continue
        result.push({
            id,
            tagName: el.tag,
            line: el.loc.start.line,
            className: getClassName(el),
            textContent: getTextContent(el) ?? undefined,
            children: buildLayers(el.children as TemplateChildNode[]),
        })
    }
    return result
}

// ── Source-position splice helpers ────────────────────────────────────────────
//
// @vue/compiler-sfc embeds absolute source offsets in every node's `.loc`.
// We use these to perform surgical text replacements without reparsing the
// entire file after each mutation.

/** A pending splice operation (to be applied in reverse-offset order) */
interface Splice {
    start: number   // absolute offset in the original source string
    end: number     // exclusive end offset
    replacement: string
}

/**
 * Applies a list of splice operations to `source`.
 * Splices must be sorted by `start` ascending (we sort internally).
 * The operations are applied in reverse order so earlier offsets stay valid.
 */
function applySplices(source: string, splices: Splice[]): string {
    const sorted = [...splices].sort((a, b) => b.start - a.start)
    let result = source
    for (const s of sorted) {
        result = result.slice(0, s.start) + s.replacement + result.slice(s.end)
    }
    return result
}

// ── VueAdapter ────────────────────────────────────────────────────────────────

/**
 * Bridge language adapter for Vue 3 Single-File Components (.vue).
 *
 * Internally stores the parsed SFCDescriptor as the `ast` (opaque to callers
 * as `unknown` per IBridgeAdapter contract).
 */
export class VueAdapter implements IBridgeAdapter {

    // ── IBridgeAdapter ────────────────────────────────────────────────────────

    parse(code: string): SFCDescriptor | null {
        return parseSfc(code)
    }

    generate(ast: unknown): string {
        // The SFCDescriptor does not carry regenerated source — callers that
        // need the string form must track `code` separately. `generate()` is
        // called by the layer tree and not for code emission (which goes
        // through applyMutationBatch instead).
        const descriptor = ast as SFCDescriptor
        return descriptor.source ?? ''
    }

    buildVisualTree(ast: unknown): VisualLayer[] {
        const descriptor = ast as SFCDescriptor
        if (!descriptor.template?.ast) return []
        return buildLayers((descriptor.template.ast.children as TemplateChildNode[]) ?? [])
    }

    injectBridgeIds(ast: unknown): unknown {
        // ID injection is done at the text-source level (not AST mutation) so
        // the injected attributes appear in the literal .vue file content.
        // This method returns the descriptor unchanged — the actual injection
        // happens in the text returned by applyMutationBatch with an 'inject' op,
        // but for the adapter interface we signal "done" by ensuring all
        // elements in the descriptor have IDs in-memory.
        //
        // The real injection path that mutates the file is handled by
        // `injectBridgeIdsIntoSource()` below, which is called from editorStore.
        return ast
    }

    /**
     * Injects data-bridge-id attributes into every <template> element that
     * doesn't already have one. Works on the raw source string and returns the
     * modified .vue source.
     *
     * Called from editorStore.setCode() before AST parsing to get a stable ID set.
     */
    injectBridgeIdsIntoSource(code: string): string {
        const descriptor = parseSfc(code)
        if (!descriptor?.template?.ast) return code

        const nodes = (descriptor.template.ast.children ?? []) as TemplateChildNode[]
        const splices: Splice[] = []

        const walk = (nodes: TemplateChildNode[]) => {
            for (const node of nodes) {
                if (node.type !== NodeTypes.ELEMENT) continue
                const el = node as ElementNode
                if (getBridgeId(el) === undefined) {
                    // Insert data-bridge-id as the first attribute after the tag name.
                    // el.loc.start points to '<'; the tag name ends at startTag end.
                    // We find the insertion point just before the first prop or '>'.
                    const tagEnd = el.loc.start.offset + 1 + el.tag.length
                    splices.push({
                        start: tagEnd,
                        end: tagEnd,
                        replacement: ` data-bridge-id="${makeId()}"`,
                    })
                }
                walk(el.children as TemplateChildNode[])
            }
        }
        walk(nodes)

        return applySplices(code, splices)
    }

    applyMutationBatch(
        code: string,
        mutations: ASTMutation[]
    ): { code: string; inversions: InverseMutation[] } {
        // Each mutation re-parses from the current (mutated) `code` so offsets
        // are always fresh. This is slightly less efficient but simpler and
        // correct for arbitrary batches.
        const inversions: InverseMutation[] = []
        let current = code

        for (const mutation of mutations) {
            const descriptor = parseSfc(current)
            if (!descriptor?.template?.ast) {
                inversions.push({ op: 'restoreCode', code: current })
                continue
            }

            const nodes = (descriptor.template.ast.children ?? []) as TemplateChildNode[]

            switch (mutation.op) {

                case 'updateClassName': {
                    const found = findById(nodes, mutation.nodeId)
                    if (!found) { inversions.push({ op: 'restoreCode', code: current }); break }
                    const el = found.node
                    const oldClass = getClassName(el)

                    // Find the class attribute and replace its value, or inject it.
                    const classProp = el.props.find(
                        (p) => p.type === NodeTypes.ATTRIBUTE && (p as AttributeNode).name === 'class'
                    ) as AttributeNode | undefined

                    inversions.push({ op: 'updateClassName', nodeId: mutation.nodeId, className: oldClass ?? '' })

                    if (classProp?.value) {
                        // Replace the existing attribute value
                        const valNode = classProp.value
                        current = applySplices(current, [{
                            start: valNode.loc.start.offset + 1,  // skip opening quote
                            end: valNode.loc.end.offset - 1,      // skip closing quote
                            replacement: mutation.className,
                        }])
                    } else {
                        // No class attribute yet — inject one
                        const tagEnd = el.loc.start.offset + 1 + el.tag.length
                        current = applySplices(current, [{
                            start: tagEnd,
                            end: tagEnd,
                            replacement: ` class="${mutation.className}"`,
                        }])
                    }
                    break
                }

                case 'updateTextContent': {
                    const found = findById(nodes, mutation.nodeId)
                    if (!found) { inversions.push({ op: 'restoreCode', code: current }); break }
                    const el = found.node
                    const oldText = getTextContent(el) ?? ''
                    inversions.push({ op: 'updateTextContent', nodeId: mutation.nodeId, text: oldText })

                    // Find the first text child node and replace it.
                    const textChild = el.children.find((c) => c.type === NodeTypes.TEXT) as TextNode | undefined
                    if (textChild) {
                        current = applySplices(current, [{
                            start: textChild.loc.start.offset,
                            end: textChild.loc.end.offset,
                            replacement: mutation.text,
                        }])
                    } else {
                        // No text child — insert before the closing tag.
                        // The closing tag starts at: source.lastIndexOf('</', el.loc.end.offset)
                        const closeTagOffset = current.lastIndexOf('</', el.loc.end.offset)
                        if (closeTagOffset !== -1) {
                            current = applySplices(current, [{
                                start: closeTagOffset,
                                end: closeTagOffset,
                                replacement: mutation.text,
                            }])
                        }
                    }
                    break
                }

                case 'updateProp': {
                    const found = findById(nodes, mutation.nodeId)
                    if (!found) { inversions.push({ op: 'restoreCode', code: current }); break }
                    const el = found.node
                    const existingProp = el.props.find(
                        (p) => p.type === NodeTypes.ATTRIBUTE && (p as AttributeNode).name === mutation.propName
                    ) as AttributeNode | undefined

                    // In a boolean attribute (like `disabled`), value might be absent, meaning true.
                    const oldVal = existingProp ? (existingProp.value?.content ?? true) : null
                    inversions.push({ op: 'updateProp', nodeId: mutation.nodeId, propName: mutation.propName, value: oldVal })

                    if (mutation.value === null || mutation.value === false) {
                        // Delete the prop
                        if (existingProp) {
                            // Expand start slightly to consume the preceding space if possible
                            let start = existingProp.loc.start.offset
                            while (start > 0 && current[start - 1] === ' ') start--
                            current = applySplices(current, [{
                                start,
                                end: existingProp.loc.end.offset,
                                replacement: '',
                            }])
                        }
                    } else if (mutation.value === true) {
                        // Add boolean prop
                        if (!existingProp) {
                            const tagEnd = el.loc.start.offset + 1 + el.tag.length
                            current = applySplices(current, [{
                                start: tagEnd,
                                end: tagEnd,
                                replacement: ` ${mutation.propName}`,
                            }])
                        } else if (existingProp.value) {
                            // Trim value to leave just the bare prop
                            current = applySplices(current, [{
                                start: existingProp.loc.start.offset,
                                end: existingProp.loc.end.offset,
                                replacement: mutation.propName,
                            }])
                        }
                    } else {
                        // String mutation
                        const strVal = String(mutation.value)
                        if (existingProp?.value) {
                            current = applySplices(current, [{
                                start: existingProp.value.loc.start.offset + 1,
                                end: existingProp.value.loc.end.offset - 1,
                                replacement: strVal,
                            }])
                        } else if (existingProp) {
                            // Prop exists without value (e.g. disabled) -> append value
                            current = applySplices(current, [{
                                start: existingProp.loc.start.offset,
                                end: existingProp.loc.end.offset,
                                replacement: `${mutation.propName}="${strVal}"`,
                            }])
                        } else {
                            const tagEnd = el.loc.start.offset + 1 + el.tag.length
                            current = applySplices(current, [{
                                start: tagEnd,
                                end: tagEnd,
                                replacement: ` ${mutation.propName}="${strVal}"`,
                            }])
                        }
                    }
                    break
                }

                case 'deleteNode': {
                    inversions.push({ op: 'restoreCode', code: current })
                    const found = findById(nodes, mutation.nodeId)
                    if (!found) break
                    const el = found.node
                    current = applySplices(current, [{
                        start: el.loc.start.offset,
                        end: el.loc.end.offset,
                        replacement: '',
                    }])
                    break
                }

                case 'moveNode': {
                    inversions.push({ op: 'restoreCode', code: current })
                    const src = findById(nodes, mutation.sourceId)
                    const tgt = findById(nodes, mutation.targetId)
                    if (!src || !tgt) break

                    const srcEl = src.node
                    const tgtEl = tgt.node
                    const extracted = current.slice(srcEl.loc.start.offset, srcEl.loc.end.offset)

                    // Remove source first (it may affect offsets of target)
                    const afterRemove = applySplices(current, [{
                        start: srcEl.loc.start.offset,
                        end: srcEl.loc.end.offset,
                        replacement: '',
                    }])

                    // Recalculate target offset after source removal
                    const offset = srcEl.loc.start.offset < tgtEl.loc.start.offset
                        ? srcEl.loc.end.offset - srcEl.loc.start.offset
                        : 0

                    let insertAt: number
                    if (mutation.position === 'before') {
                        insertAt = tgtEl.loc.start.offset - offset
                    } else if (mutation.position === 'after') {
                        insertAt = tgtEl.loc.end.offset - offset
                    } else {
                        // inside: append before the closing tag
                        insertAt = tgtEl.loc.end.offset - offset - (tgtEl.tag.length + 3)
                        // fallback: before closing tag
                        const closeTag = `</${tgtEl.tag}>`
                        const closeIdx = afterRemove.indexOf(closeTag, tgtEl.loc.start.offset - offset)
                        if (closeIdx !== -1) insertAt = closeIdx
                    }

                    current = applySplices(afterRemove, [{
                        start: insertAt,
                        end: insertAt,
                        replacement: extracted,
                    }])
                    break
                }

                default:
                    inversions.push({ op: 'restoreCode', code: current })
                    break
            }
        }

        return { code: current, inversions }
    }

    nodeExists(code: string, bridgeId: string): boolean {
        const descriptor = parseSfc(code)
        if (!descriptor?.template?.ast) return false
        const nodes = (descriptor.template.ast.children ?? []) as TemplateChildNode[]
        return findById(nodes, bridgeId) !== null
    }

    /**
     * Synchronous validation is deferred to the `VueLspClient` (main process).
     * This stub always returns null so the renderer store never blocks.
     */
    validateInMemory(_code: string): string | null {
        return null
    }

    extractNode(ast: unknown, nodeId: string): unknown | null {
        const descriptor = ast as SFCDescriptor
        if (!descriptor.template?.ast) return null
        const nodes = (descriptor.template.ast.children ?? []) as TemplateChildNode[]
        const found = findById(nodes, nodeId)
        return found ? { ...found.node } : null
    }

    transplantNode(liveAst: unknown, _historicAst: unknown, _nodeId: string): void {
        // Structural transplant for Vue is a snapshot-based undo (handled by
        // the 'restoreCode' inverse). This no-op keeps the IBridgeAdapter
        // contract satisfied; the real recovery goes through Phase D's gitManager.
        void liveAst
    }
}

// ── Singleton export ──────────────────────────────────────────────────────────

/**
 * The shared VueAdapter instance.
 * Registered with LanguageRegistry in App.tsx at app startup.
 */
export const vueAdapter = new VueAdapter()
