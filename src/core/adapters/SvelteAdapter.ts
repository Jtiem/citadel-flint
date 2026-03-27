/**
 * SvelteAdapter.ts — src/core/adapters/SvelteAdapter.ts
 *
 * Abstract Syntax Protocol (ASP) — Phase MFP.3
 *
 * Stub implementation of IFlintAdapter for Svelte (.svelte) files.
 *
 * MFP.3 focuses on preview rendering only. Full AST mutation support
 * (structural ops, cross-file move, undo/redo) is deferred to MFP.5.
 *
 * What this adapter does today:
 *   - parse():           Splits the .svelte source into { markup, script, style } sections.
 *   - generate():        Reassembles the sections back into .svelte source.
 *   - injectFlintIds():  Injects `data-flint-id` into markup elements using a
 *                        lightweight regex-free attribute injection (Svelte markup is
 *                        an HTML superset; the compiler passes unknown attributes through).
 *   - buildVisualTree(): Walks the markup section to produce a flat VisualLayer[].
 *   - nodeExists():      Checks whether a given data-flint-id value appears in code.
 *   - applyMutationBatch(): Returns snapshot-based inversions (no-op for mutations).
 *   - All other methods: Safe stubs returning null/void.
 *
 * Renderer Process only — no Node.js imports.
 */

import type { IFlintAdapter } from './types'
import type { ASTMutation, InverseMutation } from '../ASTService'
import type { VisualLayer } from '../ast-parser'

// ── SvelteSection ─────────────────────────────────────────────────────────────

/**
 * Internal representation of a parsed .svelte file.
 * Svelte SFCs have three top-level blocks:
 *   <script [context="module"]> ... </script>
 *   <style> ... </style>
 *   everything else = markup (template)
 */
export interface SvelteSection {
    /** The template HTML markup (everything outside <script> and <style>). */
    markup: string
    /** Raw <script> block source including the tags, or empty string. */
    script: string
    /** Raw <style> block source including the tags, or empty string. */
    style: string
}

// ── ID utilities ───────────────────────────────────────────────────────────────

let _idCounter = 1

function makeId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return 'svelte-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    }
    return 'svelte-' + (++_idCounter).toString(16).padStart(8, '0')
}

// ── Section extractor ─────────────────────────────────────────────────────────

/**
 * Splits a .svelte source string into its three logical sections.
 *
 * Strategy: extract <script> and <style> blocks by pattern matching,
 * then strip them from the source to get the markup section.
 *
 * This is intentionally lightweight — we do not parse Svelte's full AST in the
 * renderer. The Svelte compiler (in the main process) handles the real work.
 */
function extractSections(code: string): SvelteSection {
    // Match <script ...> ... </script> (greedy outer, lazy inner).
    const scriptMatch = code.match(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/i)
    const script = scriptMatch ? scriptMatch[0] : ''

    // Match <style ...> ... </style>.
    const styleMatch = code.match(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/i)
    const style = styleMatch ? styleMatch[0] : ''

    // Markup = source minus script and style blocks (preserve order).
    let markup = code
    if (script) markup = markup.replace(script, '')
    if (style) markup = markup.replace(style, '')
    markup = markup.trim()

    return { markup, script, style }
}

/**
 * Reassembles a SvelteSection back into a .svelte source string.
 * Preserves the canonical Svelte block ordering: script → markup → style.
 */
function assembleSections(sections: SvelteSection): string {
    const parts: string[] = []
    if (sections.script) parts.push(sections.script)
    if (sections.markup) parts.push(sections.markup)
    if (sections.style) parts.push(sections.style)
    return parts.join('\n\n')
}

// ── data-flint-id injection into markup ───────────────────────────────────────

/**
 * Injects `data-flint-id` attributes into HTML elements in the markup string.
 *
 * Uses a targeted regex that matches the opening tag `<tagName` followed by
 * attributes. We inject the `data-flint-id` before the `>` or `/>` of the tag.
 *
 * This approach is safe for Svelte markup because:
 *   1. Svelte passes unknown HTML attributes through to the compiled output.
 *   2. We only match tags that do not already carry `data-flint-id`.
 *   3. We skip `<script`, `<style`, and HTML comments.
 *
 * Commandment 13 note: this is attribute *injection*, not source code surgery.
 * We are not modifying program logic — only adding a stable identity attribute
 * to template elements. This is the same pattern used by HtmlAdapter.
 */
function injectFlintIdsIntoMarkup(markup: string): string {
    // Match self-closing and regular opening tags, excluding script/style.
    // Group 1: tag name, Group 2: existing attributes, Group 3: self-close slash.
    return markup.replace(
        /<([a-zA-Z][a-zA-Z0-9.-]*)(\s[^>]*?|)(\/?)>/g,
        (match: string, tagName: string, attrs: string, selfClose: string) => {
            // Skip script and style tags.
            const lower = tagName.toLowerCase()
            if (lower === 'script' || lower === 'style') return match
            // Skip if already has data-flint-id.
            if (/data-flint-id\s*=/.test(attrs)) return match
            const id = makeId()
            return `<${tagName}${attrs} data-flint-id="${id}"${selfClose}>`
        }
    )
}

// ── Markup walker for VisualLayer tree ────────────────────────────────────────

/**
 * Produces a flat VisualLayer[] from the markup string by finding all elements
 * that carry a `data-flint-id` attribute.
 *
 * This is a simple linear scan — no full HTML parse. It is sufficient for the
 * Layer Tree UI which only needs id, tagName, and textContent.
 */
function buildLayersFromMarkup(markup: string): VisualLayer[] {
    const layers: VisualLayer[] = []
    // Match opening tags with a data-flint-id attribute.
    const tagPattern = /<([a-zA-Z][a-zA-Z0-9.-]*)\s([^>]*data-flint-id="([^"]+)"[^>]*)>/g
    let match: RegExpExecArray | null
    while ((match = tagPattern.exec(markup)) !== null) {
        const tagName = match[1]
        const attrs = match[2]
        const flintId = match[3]

        // Extract class attribute if present.
        const classMatch = attrs.match(/class="([^"]*)"/)
        const className = classMatch ? classMatch[1] : undefined

        // Best-effort: extract text immediately following the opening tag.
        const afterTag = markup.slice(match.index + match[0].length)
        const textMatch = afterTag.match(/^([^<]{1,100})/)
        const textContent = textMatch ? textMatch[1].trim() || undefined : undefined

        layers.push({
            id: flintId,
            tagName,
            line: 0, // line tracking not yet implemented for Svelte
            className: className || undefined,
            idAttr: undefined,
            textContent,
            children: [],
        })
    }
    return layers
}

// ── SvelteAdapter ─────────────────────────────────────────────────────────────

/**
 * Flint language adapter for Svelte (.svelte) files — Phase MFP.3 stub.
 *
 * The internal `ast` type is `SvelteSection` — a simple { markup, script, style }
 * split of the source. Full Babel/Svelte AST integration is deferred to MFP.5.
 */
export class SvelteAdapter implements IFlintAdapter {

    // ── IFlintAdapter ────────────────────────────────────────────────────────

    /**
     * Parse a .svelte source string into a SvelteSection.
     * Returns null for empty or whitespace-only input.
     */
    parse(code: string): SvelteSection | null {
        if (!code || !code.trim()) return null
        return extractSections(code)
    }

    /**
     * Reassemble a SvelteSection back into .svelte source text.
     */
    generate(ast: unknown): string {
        const sections = ast as SvelteSection
        if (!sections || typeof sections !== 'object') return ''
        return assembleSections(sections)
    }

    /**
     * Build a flat VisualLayer[] from the markup section.
     * Only elements that carry `data-flint-id` (after injection) appear as layers.
     */
    buildVisualTree(ast: unknown): VisualLayer[] {
        const sections = ast as SvelteSection
        if (!sections || typeof sections.markup !== 'string') return []
        return buildLayersFromMarkup(sections.markup)
    }

    /**
     * Inject `data-flint-id` attributes into all markup elements that do not
     * already carry one. Mutates the SvelteSection in-place and returns it.
     * Idempotent: safe to call multiple times.
     */
    injectFlintIds(ast: unknown): unknown {
        const sections = ast as SvelteSection
        if (!sections || typeof sections.markup !== 'string') return ast
        sections.markup = injectFlintIdsIntoMarkup(sections.markup)
        return sections
    }

    /**
     * Stub mutation handler for Svelte files.
     *
     * Full structural mutation support is deferred to MFP.5. For now, all
     * mutations return a snapshot-based inversion (`{ op: 'restoreCode', code }`)
     * so that undo/redo always has a safe fallback even if no structural op
     * was applied.
     *
     * The code is returned unchanged.
     */
    applyMutationBatch(
        code: string,
        mutations: ASTMutation[]
    ): { code: string; inversions: InverseMutation[] } {
        // Snapshot inverse: restoring to `code` is always safe.
        const inversions: InverseMutation[] = mutations.map(() => ({
            op: 'restoreCode' as const,
            code,
        }))
        return { code, inversions }
    }

    /**
     * Returns true when `data-flint-id="<flintId>"` appears anywhere in `code`.
     */
    nodeExists(code: string, flintId: string): boolean {
        return code.includes(`data-flint-id="${flintId}"`)
    }

    /**
     * In-memory validation stub.
     * Returns null (no error) — full LSP-backed validation deferred to MFP.5.
     */
    validateInMemory(_code: string): string | null {
        return null
    }

    /**
     * Node extraction stub.
     * Returns null — cross-file move support deferred to MFP.5.
     */
    extractNode(_ast: unknown, _nodeId: string): unknown | null {
        return null
    }

    /**
     * Node transplant stub.
     * No-op — Macro-Recovery Engine integration deferred to MFP.5.
     */
    transplantNode(_liveAst: unknown, _historicAst: unknown, _nodeId: string): void {
        // Not yet supported. MFP.5 will implement this via the Svelte compiler AST.
    }
}

// ── Singleton export ──────────────────────────────────────────────────────────

/**
 * The shared SvelteAdapter instance.
 * Registered with LanguageRegistry in App.tsx at app startup.
 */
export const svelteAdapter = new SvelteAdapter()
