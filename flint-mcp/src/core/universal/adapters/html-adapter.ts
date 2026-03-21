/**
 * V.3 — HTML Language Adapter
 *
 * Parses HTML/Angular/Vue templates into the canonical FlintNode tree.
 * Uses a lightweight recursive-descent parser (no external dependency)
 * to handle:
 *   - Standard HTML elements with attributes
 *   - Self-closing elements (<img />, <input />, <br />)
 *   - Text nodes
 *   - Angular bindings ([class], (click), *ngIf) — preserved as attributes
 *   - Vue directives (v-if, :class, @click) — preserved as attributes
 *   - HTML comments (skipped)
 *
 * This adapter enables Flint's Mithril linter and A11y rules to run
 * on Angular Material, Vue component, and plain HTML templates.
 */

import type { LanguageAdapter, FlintMutation } from "../adapter.js";
import type { FlintDocument, FlintNode } from "../flintNode.js";
import { createNode, resetIdCounter, findById } from "../flintNode.js";

// ---------------------------------------------------------------------------
// Lightweight HTML Parser
// ---------------------------------------------------------------------------

interface ParsedElement {
    tag: string;
    attributes: Record<string, string | true>;
    children: ParsedNode[];
    selfClosing: boolean;
}

interface ParsedText {
    text: string;
}

type ParsedNode = { type: 'element'; value: ParsedElement } | { type: 'text'; value: ParsedText };

const SELF_CLOSING_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function parseHTML(source: string): ParsedNode[] {
    let pos = 0;
    const len = source.length;

    function peek(): string { return source[pos] ?? ''; }
    function advance(n = 1): void { pos += n; }
    function remaining(): string { return source.slice(pos); }

    function skipWhitespace(): void {
        while (pos < len && /\s/.test(source[pos])) pos++;
    }

    function parseAttributeValue(): string {
        skipWhitespace();
        if (peek() !== '=') return '';
        advance(); // skip =
        skipWhitespace();
        const quote = peek();
        if (quote === '"' || quote === "'") {
            advance(); // skip opening quote
            let val = '';
            while (pos < len && source[pos] !== quote) {
                val += source[pos];
                advance();
            }
            advance(); // skip closing quote
            return val;
        }
        // Unquoted attribute value
        let val = '';
        while (pos < len && !/[\s>\/]/.test(source[pos])) {
            val += source[pos];
            advance();
        }
        return val;
    }

    function parseAttributes(): Record<string, string | true> {
        const attrs: Record<string, string | true> = {};
        while (pos < len) {
            skipWhitespace();
            if (peek() === '>' || peek() === '/' || pos >= len) break;

            // Attribute name — supports: class, [class], (click), *ngIf, v-if, :class, @click, data-flint-id
            let name = '';
            while (pos < len && !/[\s=>\/"']/.test(source[pos])) {
                name += source[pos];
                advance();
            }
            if (!name) break;

            skipWhitespace();
            if (peek() === '=') {
                attrs[name] = parseAttributeValue();
            } else {
                attrs[name] = true; // boolean attribute
            }
        }
        return attrs;
    }

    function parseElement(): ParsedElement {
        advance(); // skip <
        let tag = '';
        while (pos < len && !/[\s>\/]/.test(source[pos])) {
            tag += source[pos];
            advance();
        }

        const attributes = parseAttributes();
        skipWhitespace();

        // Self-closing: <br /> or <input />
        let selfClosing = false;
        if (peek() === '/') {
            advance(); // skip /
            selfClosing = true;
        }
        if (peek() === '>') advance(); // skip >

        // Void elements are always self-closing
        if (SELF_CLOSING_TAGS.has(tag.toLowerCase())) {
            selfClosing = true;
        }

        const children: ParsedNode[] = [];
        if (!selfClosing) {
            const closingTag = `</${tag}>`;
            while (pos < len) {
                const rest = remaining();
                if (rest.startsWith(closingTag)) {
                    pos += closingTag.length;
                    break;
                }
                const nodes = parseNodes(true);
                children.push(...nodes);
                if (nodes.length === 0) {
                    // Safety: advance past stuck position
                    advance();
                }
            }
        }

        return { tag, attributes, children, selfClosing };
    }

    function parseNodes(singlePass = false): ParsedNode[] {
        const nodes: ParsedNode[] = [];

        while (pos < len) {
            skipWhitespace();
            if (pos >= len) break;

            // Check for closing tag — stop parsing children
            if (remaining().startsWith('</')) break;

            // Comment: <!-- ... -->
            if (remaining().startsWith('<!--')) {
                const endIdx = source.indexOf('-->', pos + 4);
                pos = endIdx >= 0 ? endIdx + 3 : len;
                continue;
            }

            // Element: <tag ...>
            if (peek() === '<' && source[pos + 1] !== '/') {
                const element = parseElement();
                nodes.push({ type: 'element', value: element });
                if (singlePass) break;
                continue;
            }

            // Text node
            let text = '';
            while (pos < len && peek() !== '<') {
                text += source[pos];
                advance();
            }
            const trimmed = text.trim();
            if (trimmed) {
                nodes.push({ type: 'text', value: { text: trimmed } });
            }
            if (singlePass) break;
        }

        return nodes;
    }

    return parseNodes();
}

// ---------------------------------------------------------------------------
// ParsedNode → FlintNode conversion
// ---------------------------------------------------------------------------

function parsedToFlint(parsed: ParsedNode, parent: FlintNode | null): FlintNode {
    if (parsed.type === 'text') {
        return createNode({
            type: 'HTMLText',
            name: '#text',
            parent,
            metadata: { value: parsed.value.text },
        });
    }

    const el = parsed.value;
    const attrs = new Map<string, unknown>();
    for (const [k, v] of Object.entries(el.attributes)) {
        attrs.set(k, v);
    }

    const node = createNode({
        type: 'HTMLElement',
        name: el.tag,
        attributes: attrs,
        parent,
        metadata: { selfClosing: el.selfClosing },
    });

    for (const child of el.children) {
        const childNode = parsedToFlint(child, node);
        if (childNode.type !== 'HTMLText' || childNode.metadata.value) {
            node.children.push(childNode);
        }
    }

    return node;
}

// ---------------------------------------------------------------------------
// FlintNode → HTML generation
// ---------------------------------------------------------------------------

function flintToHTML(node: FlintNode, indent: number): string {
    const pad = '  '.repeat(indent);

    if (node.type === 'HTMLText') {
        const text = node.metadata.value as string | undefined;
        return text ? `${pad}${text}\n` : '';
    }

    if (node.type === 'HTMLElement') {
        const attrParts: string[] = [];
        for (const [k, v] of node.attributes) {
            if (v === true) {
                attrParts.push(k);
            } else {
                // Escape attribute values to prevent malformed HTML
                const escaped = String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                attrParts.push(`${k}="${escaped}"`);
            }
        }
        const attrStr = attrParts.length > 0 ? ' ' + attrParts.join(' ') : '';
        const isSelfClosing = node.metadata.selfClosing === true || node.children.length === 0 && SELF_CLOSING_TAGS.has(node.name.toLowerCase());

        if (isSelfClosing && node.children.length === 0) {
            return `${pad}<${node.name}${attrStr} />\n`;
        }

        let result = `${pad}<${node.name}${attrStr}>\n`;
        for (const child of node.children) {
            result += flintToHTML(child, indent + 1);
        }
        result += `${pad}</${node.name}>\n`;
        return result;
    }

    // Root/program node — just emit children
    let result = '';
    for (const child of node.children) {
        result += flintToHTML(child, indent);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class HTMLAdapter implements LanguageAdapter {
    id = 'html';
    fileExtensions = ['.html', '.htm', '.vue', '.angular.html', '.component.html'];

    parse(source: string, filePath: string): FlintDocument {
        resetIdCounter();

        const parsed = parseHTML(source);
        const root = createNode({ type: 'Document', name: 'Document', metadata: {} });

        for (const node of parsed) {
            const flintNode = parsedToFlint(node, root);
            root.children.push(flintNode);
        }

        return {
            root,
            filePath,
            language: 'html',
            parseTimestamp: Date.now(),
        };
    }

    generate(document: FlintDocument): string {
        return flintToHTML(document.root, 0).trimEnd() + '\n';
    }

    mutate(document: FlintDocument, mutation: FlintMutation): FlintDocument {
        const target = findById(document.root, mutation.targetId);
        if (!target) throw new Error(`Node not found: ${mutation.targetId}`);

        switch (mutation.type) {
            case 'setAttribute': {
                const { key, value } = mutation.args as { key: string; value: unknown };
                target.attributes.set(key, value);
                break;
            }
            case 'removeAttribute': {
                const { key } = mutation.args as { key: string };
                target.attributes.delete(key);
                break;
            }
            case 'rename': {
                const { name } = mutation.args as { name: string };
                target.name = name;
                break;
            }
            case 'removeChild': {
                const { childId } = mutation.args as { childId: string };
                target.children = target.children.filter(c => c.id !== childId);
                break;
            }
            default:
                throw new Error(`Unknown mutation type: ${mutation.type}`);
        }

        return document;
    }
}
