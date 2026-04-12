/**
 * registryService — flint-mcp/src/core/registryService.ts
 *
 * Text-search component registry + Shadow Storybook artifact formatter.
 * Used directly by flint_query_registry as a fallback when the RAG cache
 * is cold, and by ragRegistryService as the underlying scoring engine.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PropDefinition {
    type: string;
    required: boolean;
    default?: string;
}

export interface ComponentEntry {
    name: string;
    importPath: string;
    description?: string;
    props?: Record<string, PropDefinition>;
    variants?: string[];
    /** Design tokens this component consumes. */
    tokens?: string[];
    source?: 'local' | 'remote';
    remoteUrl?: string;
    /** Figma component ID for deterministic mapping (FIGMA-MAP.1). */
    figmaComponentId?: string;
    /** Figma file key where this component is defined. */
    figmaFileKey?: string;
    /** Human-authored usage example (TSX snippet). Overrides auto-generated snippet in Shadow Storybook. */
    usageExample?: string;
    /** Composition notes: do's, don'ts, patterns for combining this with other components. */
    compositionNotes?: string;
    /** Accessibility implementation notes (beyond WCAG rules — interaction patterns, focus management). */
    a11yNotes?: string;
    /** Names of related components (e.g., "DialogHeader", "DialogFooter" for "Dialog"). */
    relatedComponents?: string[];
    /** P2.5: Structural composition rules for parent-child validation. */
    compositionRules?: {
        /** Whitelist: only these components can be nested inside this component. */
        allowedChildren?: string[];
        /** Blacklist: these components must never be nested inside this component. */
        forbiddenChildren?: string[];
        /** This component must always appear inside this parent component. */
        requiredParent?: string;
        /** Maximum nesting depth for this component (e.g., 2 prevents Card-in-Card-in-Card). */
        maxDepth?: number;
    };
}

// ── FIGMA-MAP.3: Deterministic Lookup ────────────────────────────────────────

/**
 * Look up a component by Figma component ID. Returns the first match or null.
 * This is the deterministic path — exact ID match, no heuristics.
 */
export function queryByFigmaId(
    components: Record<string, ComponentEntry>,
    figmaComponentId: string
): ComponentEntry | null {
    for (const entry of Object.values(components)) {
        if (entry.figmaComponentId === figmaComponentId) return entry
    }
    return null
}

/**
 * Deterministic-first query: try exact Figma ID match, fall back to keyword search.
 * Use this when a Figma component ID is available from the ingestion payload.
 */
export function queryRegistryDeterministic(
    components: Record<string, ComponentEntry>,
    figmaComponentId: string | null,
    componentName: string,
    limit: number = 3
): ComponentEntry[] {
    // 1. Exact Figma ID match — deterministic
    if (figmaComponentId) {
        const exact = queryByFigmaId(components, figmaComponentId)
        if (exact) return [exact]
    }

    // 2. Fallback to keyword search — heuristic
    return queryRegistry(components, componentName, limit)
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score a single component against a query.
 * Each query word that appears (case-insensitively) in any searchable field
 * contributes 1 point.  Returns a non-negative integer.
 */
function scoreComponent(entry: ComponentEntry, words: string[]): number {
    let score = 0;

    const searchFields: string[] = [
        entry.name,
        entry.description ?? '',
        ...(entry.variants ?? []),
        ...(entry.tokens ?? []),
        entry.compositionNotes ?? '',
        entry.a11yNotes ?? '',
        ...(entry.relatedComponents ?? []),
    ].map(s => s.toLowerCase());

    for (const word of words) {
        for (const field of searchFields) {
            if (field.includes(word)) {
                score += 1;
                break; // one point per word per component, not per field
            }
        }
    }

    return score;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Text-search over a component registry map.
 *
 * @param components  Record keyed by component name from flint-manifest.json
 * @param query       Natural-language search string
 * @param limit       Maximum results to return (default 5)
 * @returns           Sorted slice of ComponentEntry, best match first
 */
export function queryRegistry(
    components: Record<string, ComponentEntry>,
    query: string,
    limit: number = 5,
): ComponentEntry[] {
    if (!query.trim() || Object.keys(components).length === 0) {
        return [];
    }

    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    const scored: Array<{ entry: ComponentEntry; score: number }> = [];

    for (const [name, raw] of Object.entries(components)) {
        const { name: _rawName, ...restRaw } = raw;
        const entry: ComponentEntry = { name, ...restRaw };
        const score = scoreComponent(entry, words);
        if (score > 0) {
            scored.push({ entry, score });
        }
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, Math.max(1, Math.min(limit, 50))).map(s => s.entry);
}

// ── Shadow Storybook Formatter ────────────────────────────────────────────────

/**
 * Build a markdown "Shadow Storybook" artifact from a set of component matches.
 *
 * The output is designed to give an AI agent everything it needs to use a
 * component: import path, props table, example usage, token dependencies.
 */
export function formatShadowStorybook(
    matches: ComponentEntry[],
    query: string,
): string {
    const lines: string[] = [];

    lines.push(`## Shadow Storybook — Results for "${query}"`);
    lines.push('');

    if (matches.length === 0) {
        lines.push('_No components found matching this query._');
        return lines.join('\n');
    }

    for (const component of matches) {
        lines.push(`### ${component.name}`);
        lines.push('');

        if (component.description) {
            lines.push(component.description);
            lines.push('');
        }

        const badge = component.source === 'remote' ? ' _(remote)_' : '';
        lines.push(`**Import**${badge}: \`${component.importPath}\``);
        lines.push('');

        // Props table
        if (component.props && Object.keys(component.props).length > 0) {
            lines.push('**Props**');
            lines.push('');
            lines.push('| Name | Type | Required | Default |');
            lines.push('|------|------|----------|---------|');

            for (const [propName, def] of Object.entries(component.props)) {
                const req = def.required ? 'Yes' : 'No';
                const defaultVal = def.default !== undefined ? `\`${def.default}\`` : '—';
                lines.push(`| \`${propName}\` | \`${def.type}\` | ${req} | ${defaultVal} |`);
            }

            lines.push('');
        }

        // Variants
        if (component.variants && component.variants.length > 0) {
            lines.push(`**Variants**: ${component.variants.map(v => `\`${v}\``).join(', ')}`);
            lines.push('');
        }

        // Example usage — use custom snippet when provided, fall back to auto-generated
        if (component.usageExample) {
            lines.push('**Example usage (custom)**');
            lines.push('');
            lines.push('```tsx');
            lines.push(component.usageExample);
            lines.push('```');
        } else {
            lines.push('**Example usage**');
            lines.push('');
            lines.push('```tsx');
            lines.push(buildExampleSnippet(component));
            lines.push('```');
        }
        lines.push('');

        // Composition notes
        if (component.compositionNotes) {
            lines.push('**Composition notes**');
            lines.push(component.compositionNotes);
            lines.push('');
        }

        // Accessibility notes
        if (component.a11yNotes) {
            lines.push('**Accessibility notes**');
            lines.push(component.a11yNotes);
            lines.push('');
        }

        // Related components
        if (component.relatedComponents && component.relatedComponents.length > 0) {
            lines.push(`**Related components**: ${component.relatedComponents.join(', ')}`);
            lines.push('');
        }

        // Token dependencies
        if (component.tokens && component.tokens.length > 0) {
            lines.push('**Token dependencies**');
            lines.push('');
            for (const token of component.tokens) {
                lines.push(`- \`${token}\``);
            }
            lines.push('');
        }

        if (component.remoteUrl) {
            lines.push(`**Source**: ${component.remoteUrl}`);
            lines.push('');
        }

        lines.push('---');
        lines.push('');
    }

    return lines.join('\n').trimEnd();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildExampleSnippet(component: ComponentEntry): string {
    const requiredProps = Object.entries(component.props ?? {})
        .filter(([, def]) => def.required)
        .map(([propName, def]) => {
            const placeholder = def.default ?? exampleValueForType(def.type);
            return `  ${propName}=${wrapExampleValue(placeholder, def.type)}`;
        });

    const firstVariant = component.variants?.[0];
    const variantProp = firstVariant ? `  variant="${firstVariant}"` : '';

    const propsBlock = [variantProp, ...requiredProps].filter(Boolean).join('\n');

    if (propsBlock) {
        return `import { ${component.name} } from '${component.importPath}';\n\n<${component.name}\n${propsBlock}\n/>`;
    }

    return `import { ${component.name} } from '${component.importPath}';\n\n<${component.name} />`;
}

function exampleValueForType(type: string): string {
    const t = type.toLowerCase();
    if (t === 'boolean') return 'false';
    if (t === 'number') return '0';
    if (t.startsWith('(') || t.includes('=>')) return '() => {}';
    return 'value';
}

function wrapExampleValue(value: string, type: string): string {
    const t = type.toLowerCase();
    if (t === 'string') return `"${value}"`;
    // boolean, number, function expressions get curly braces
    return `{${value}}`;
}
