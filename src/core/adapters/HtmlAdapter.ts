/**
 * HtmlAdapter.ts — src/core/adapters/HtmlAdapter.ts
 *
 * Abstract Syntax Protocol (ASP) — Phase N.2
 *
 * Implements IBridgeAdapter for raw HTML files (.html).
 * Uses the `rehype` ecosystem (HAST — Hypertext Abstract Syntax Tree)
 * as the underlying AST representation.
 *
 * HAST structure:
 *   root → element → (element | text | comment | …)
 *   element.tagName: string (e.g. "div", "p")
 *   element.properties: Record<string, string | string[] | boolean | number>
 *   element.children: Array<HastNode>
 *
 * ID injection: `data-bridge-id` attributes are injected as HAST properties
 * (element.properties['dataBridgeId']). HAST uses camelCase property keys
 * for data attributes. rehype-stringify outputs them as `data-bridge-id`
 * (kebab-case) automatically.
 *
 * Renderer Process only — no Node.js imports.
 */

import type { IBridgeAdapter } from './types'
import type { ASTMutation, InverseMutation } from '../ASTService'
import type { VisualLayer } from '../ast-parser'

// ── rehype / unist imports ────────────────────────────────────────────────────
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Root, Element, ElementContent, Node } from 'hast'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reads the `data-bridge-id` from a HAST element's properties */
function getBridgeId(el: Element): string | undefined {
    const v = el.properties?.['dataBridgeId']
    if (typeof v === 'string') return v
    if (Array.isArray(v)) return String(v[0])
    return undefined
}

/** Reads a class string from HAST element properties */
function getClassName(el: Element): string | undefined {
    const v = el.properties?.['className']
    if (typeof v === 'string') return v || undefined
    if (Array.isArray(v)) {
        const s = v.join(' ')
        return s || undefined
    }
    return undefined
}

/**
 * Finds an element by its `data-bridge-id` in the HAST tree.
 * Returns the node and its parent + index for surgical mutations.
 */
function findById(
    root: Root,
    bridgeId: string,
): { node: Element; parent: Root | Element; idx: number } | null {
    let result: { node: Element; parent: Root | Element; idx: number } | null = null
    visit(root, 'element', (node: Element, idx: number | undefined, parent: Node | undefined) => {
        if (result !== null) return
        if (getBridgeId(node) === bridgeId && parent && idx !== undefined) {
            result = { node, parent: parent as Root | Element, idx }
        }
    })
    return result
}

/**
 * Reads the direct text content of a HAST element (first non-whitespace text child).
 */
function readTextContent(el: Element): string | null {
    for (const child of el.children) {
        if (child.type === 'text' && child.value.trim() !== '') {
            return child.value
        }
    }
    return null
}

/**
 * Deep-clones a HAST node (portable, no structuredClone dependency).
 */
function deepClone<T>(node: T): T {
    return JSON.parse(JSON.stringify(node)) as T
}

/**
 * Generates an 8-char hex ID for bridge ID injection.
 * Falls back to Math.random in environments without crypto.
 */
let _idCounter = 1
function makeId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    }
    return (++_idCounter).toString(16).padStart(8, '0')
}

// ── HtmlAdapter ───────────────────────────────────────────────────────────────

/**
 * Bridge language adapter for raw HTML files.
 *
 * Internally uses the rehype/HAST ecosystem. The `ast` type for all methods
 * is `Root` (HAST document root), but callers receive it as `unknown` per
 * the IBridgeAdapter contract.
 */
export class HtmlAdapter implements IBridgeAdapter {

    // ── Private rehype pipeline ───────────────────────────────────────────────

    private readonly _parser = unified()
        .use(rehypeParse, { fragment: false })  // parse as full HTML document

    private readonly _stringifier = unified()
        .use(rehypeStringify, { allowDangerousHtml: true })

    // ── IBridgeAdapter ────────────────────────────────────────────────────────

    parse(code: string): Root | null {
        if (!code.trim()) return null
        try {
            return this._parser.parse(code) as Root
        } catch {
            return null
        }
    }

    generate(ast: unknown): string {
        const root = ast as Root
        try {
            const file = this._stringifier.stringify(root)
            return String(file)
        } catch {
            return ''
        }
    }

    /**
     * Build the VisualLayer tree from the HAST by walking all Element nodes.
     * Uses the `data-bridge-id` as the layer ID for stable identity.
     */
    buildVisualTree(ast: unknown): VisualLayer[] {
        const root = ast as Root
        const result: VisualLayer[] = []

        const walk = (nodes: (ElementContent | Node)[]): VisualLayer[] => {
            const layers: VisualLayer[] = []
            for (const node of nodes) {
                if (node.type !== 'element') continue
                const el = node as Element
                const id = getBridgeId(el)
                if (!id) continue

                const layer: VisualLayer = {
                    id,
                    tagName: el.tagName,
                    line: el.position?.start.line ?? 0,
                    className: getClassName(el),
                    idAttr: typeof el.properties?.id === 'string' ? el.properties.id : undefined,
                    textContent: readTextContent(el) ?? undefined,
                    children: walk(el.children as Node[]),
                }
                layers.push(layer)
            }
            return layers
        }

        result.push(...walk(root.children as Node[]))
        return result
    }

    /**
     * Inject `data-bridge-id` attributes onto all elements that don't already
     * have one. Mutates the HAST in-place and returns it. Idempotent.
     */
    injectBridgeIds(ast: unknown): unknown {
        const root = ast as Root
        visit(root, 'element', (node: Element) => {
            if (!node.properties) node.properties = {}
            if (getBridgeId(node) === undefined) {
                node.properties['dataBridgeId'] = `html-${node.tagName}-${makeId()}`
            }
        })
        return root
    }

    /**
     * Applies an ordered batch of AST mutations in a single parse→mutate→generate cycle.
     * Returns new HTML source + inversions for undo/redo.
     */
    applyMutationBatch(
        code: string,
        mutations: ASTMutation[]
    ): { code: string; inversions: InverseMutation[] } {
        const ast = this.parse(code)
        if (ast === null) return { code, inversions: [] }

        const inversions: InverseMutation[] = []

        for (const mutation of mutations) {
            switch (mutation.op) {

                case 'updateClassName': {
                    const found = findById(ast, mutation.nodeId)
                    if (!found) { inversions.push({ op: 'restoreCode', code }); break }
                    const old = getClassName(found.node) ?? ''
                    inversions.push({ op: 'updateClassName', nodeId: mutation.nodeId, className: old })
                    found.node.properties ??= {}
                    found.node.properties['className'] = mutation.className
                    break
                }

                case 'updateTextContent': {
                    const found = findById(ast, mutation.nodeId)
                    if (!found) { inversions.push({ op: 'restoreCode', code }); break }
                    const oldText = readTextContent(found.node) ?? ''
                    inversions.push({ op: 'updateTextContent', nodeId: mutation.nodeId, text: oldText })
                    // Replace the first text child (or insert one)
                    const textIdx = found.node.children.findIndex((c) => c.type === 'text')
                    if (textIdx !== -1) {
                        ; (found.node.children[textIdx] as import('hast').Text).value = mutation.text
                    } else {
                        found.node.children.unshift({ type: 'text', value: mutation.text })
                    }
                    break
                }

                case 'updateProp': {
                    // Map Bridge prop names to HAST property keys.
                    // Most HTML attributes map 1:1 in camelCase (e.g. 'href' → 'href').
                    const found = findById(ast, mutation.nodeId)
                    if (!found) { inversions.push({ op: 'restoreCode', code }); break }
                    found.node.properties ??= {}
                    const rawVal = found.node.properties[mutation.propName]
                    let oldVal: string | boolean | null = null
                    if (typeof rawVal === 'boolean') {
                        oldVal = rawVal
                    } else if (typeof rawVal === 'string') {
                        oldVal = rawVal
                    } else if (Array.isArray(rawVal)) {
                        oldVal = String(rawVal[0])
                    } else if (typeof rawVal === 'number') {
                        oldVal = String(rawVal)
                    }
                    inversions.push({ op: 'updateProp', nodeId: mutation.nodeId, propName: mutation.propName, value: oldVal })
                    found.node.properties[mutation.propName] = mutation.value
                    break
                }

                case 'deleteNode': {
                    const found = findById(ast, mutation.nodeId)
                    if (!found) { inversions.push({ op: 'restoreCode', code }); break }
                    inversions.push({ op: 'restoreCode', code })
                    const siblings = found.parent.children as ElementContent[]
                    const actual = siblings.indexOf(found.node as ElementContent)
                    if (actual !== -1) siblings.splice(actual, 1)
                    break
                }

                case 'moveNode': {
                    // Snapshot-based inverse for structural ops
                    inversions.push({ op: 'restoreCode', code })
                    const src = findById(ast, mutation.sourceId)
                    const tgt = findById(ast, mutation.targetId)
                    if (!src || !tgt) break

                    // Remove from source
                    const srcSiblings = src.parent.children as ElementContent[]
                    const srcActual = srcSiblings.indexOf(src.node as ElementContent)
                    if (srcActual === -1) break
                    const [extracted] = srcSiblings.splice(srcActual, 1)

                    // Insert relative to target
                    const tgtSiblings = tgt.parent.children as ElementContent[]
                    const tgtActual = tgtSiblings.indexOf(tgt.node as ElementContent)
                    if (tgtActual === -1) break
                    if (mutation.position === 'before') {
                        tgtSiblings.splice(tgtActual, 0, extracted)
                    } else if (mutation.position === 'after') {
                        tgtSiblings.splice(tgtActual + 1, 0, extracted)
                    } else {
                        // inside: append as last child of target element
                        tgt.node.children.push(extracted)
                    }
                    break
                }

                default:
                    // Structural ops not yet supported (injectComponent, applyTokenFix, etc.)
                    // Use snapshot inverse so undo is always safe.
                    inversions.push({ op: 'restoreCode', code })
                    break
            }
        }

        return { code: this.generate(ast), inversions }
    }

    /**
     * Returns `true` when the element with the given `bridgeId` exists in `code`.
     * Used for zombie-node pre-flight checks before undo.
     */
    nodeExists(code: string, bridgeId: string): boolean {
        const ast = this.parse(code)
        if (ast === null) return false
        let found = false
        visit(ast, 'element', (node: Element) => {
            if (!found && getBridgeId(node) === bridgeId) found = true
        })
        return found
    }

    /**
     * In-memory HTML validation. Returns null (no error) since rehype
     * parses any HTML without hard failures. Phase N.3 will add a full
     * W3C validator integration via an LSP.
     */
    validateInMemory(_code: string): string | null {
        return null
    }

    /**
     * Extracts the HAST Element node identified by `nodeId`.
     * Returns the cloned element (opaque to callers) or null.
     */
    extractNode(ast: unknown, nodeId: string): unknown | null {
        const root = ast as Root
        const found = findById(root, nodeId)
        if (!found) return null
        const cloned = deepClone(found.node)
        // Remove from tree
        const siblings = found.parent.children as ElementContent[]
        const actual = siblings.indexOf(found.node as ElementContent)
        if (actual !== -1) siblings.splice(actual, 1)
        return cloned
    }

    /**
     * Transplants the node identified by `nodeId` from `historicAst` into
     * the matching position in `liveAst`. Used by the Macro-Recovery Engine (Phase D).
     */
    transplantNode(liveAst: unknown, historicAst: unknown, nodeId: string): void {
        const live = liveAst as Root
        const historic = historicAst as Root

        const historicFound = findById(historic, nodeId)
        if (!historicFound) return

        const liveFound = findById(live, nodeId)
        if (!liveFound) return

        const cloned = deepClone(historicFound.node)
        const siblings = liveFound.parent.children as ElementContent[]
        const actual = siblings.indexOf(liveFound.node as ElementContent)
        if (actual !== -1) siblings.splice(actual, 1, cloned as ElementContent)
    }
}

// ── Singleton export ──────────────────────────────────────────────────────────

/**
 * The shared HtmlAdapter instance.
 * Registered with LanguageRegistry in App.tsx at app startup.
 */
export const htmlAdapter = new HtmlAdapter()
