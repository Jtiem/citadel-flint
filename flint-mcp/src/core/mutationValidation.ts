/**
 * mutationValidation — Pre-mutation governance checks for flint_ast_mutate
 *
 * Ports the orchestrator's validateRegistryMembership + mithrilClassCheck
 * to the MCP server path. Closes the gap where MCP clients bypass CR.1-3.
 */
import { parse } from '@babel/parser';
import { auditAll } from './MithrilLinter.js';
import { HTML_INTRINSIC_TAGS, REACT_BUILTINS, REGISTRY_PASSTHROUGH } from './htmlIntrinsics.js';
import type { DesignToken } from '../types.js';

export interface MutationValidationResult {
    blocked: boolean;
    errors: string[];
    warnings: string[];
}

function isCustomComponent(name: string): boolean {
    // Lowercase = HTML intrinsic, uppercase = custom component
    if (name[0] && name[0] === name[0].toLowerCase()) return false;
    if (REGISTRY_PASSTHROUGH.has(name)) return false;
    return true;
}

function extractComponentName(mutation: { type: string; args: any }): string | null {
    if (mutation.type === 'wrap') {
        return mutation.args?.wrapperElement ?? null;
    }
    if (mutation.type === 'inject' || mutation.type === 'composeSlot') {
        const snippet: string = mutation.args?.jsxSnippet ?? '';
        // Extract the root element name from JSX snippet via regex on the opening tag
        // This is safe because we're only extracting a name, not modifying source (Commandment 13)
        const match = snippet.match(/^<([A-Z][A-Za-z0-9.]*)/);
        return match ? match[1] : null;
    }
    return null;
}

function extractClassName(mutation: { type: string; args: any }): string | null {
    if (mutation.type === 'updateClassName') {
        return mutation.args?.className ?? null;
    }
    if (mutation.type === 'inject' || mutation.type === 'assembleLayout' || mutation.type === 'composeSlot') {
        const snippet: string = mutation.args?.jsxSnippet ?? '';
        const match = snippet.match(/className="([^"]*)"/);
        return match ? match[1] : null;
    }
    return null;
}

function checkColorDrift(className: string, tokens: DesignToken[]): string | null {
    if (!className || tokens.length === 0) return null;
    try {
        const syntheticCode = `const __v = <div className="${className}" />;`;
        const ast = parse(syntheticCode, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });
        const warnings = auditAll(ast, tokens);
        if (warnings.size === 0) return null;
        const first = [...warnings.values()][0];
        return `Mithril drift in className "${className}": ${first?.message ?? 'color drift detected'}`;
    } catch {
        return null; // Parse failure on synthetic code — skip check
    }
}

export function validateMutationBatch(
    mutations: Array<{ type: string; args: any }>,
    registry: Record<string, unknown>,
    tokens: DesignToken[],
): MutationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const hasRegistry = registry && Object.keys(registry).length > 0;

    for (const mutation of mutations) {
        // CR.2: Registry membership check for component-creating ops
        if (hasRegistry && ['inject', 'wrap', 'composeSlot'].includes(mutation.type)) {
            const componentName = extractComponentName(mutation);
            if (componentName && isCustomComponent(componentName) && !registry[componentName]) {
                errors.push(
                    `Armory: Component '${componentName}' (${mutation.type}) is not in the project registry. ` +
                    `Register it via flint_reindex_registry or use a registered component.`
                );
            }
        }

        // Mithril color drift check for className mutations
        const className = extractClassName(mutation);
        if (className) {
            const drift = checkColorDrift(className, tokens);
            if (drift) {
                errors.push(drift);
            }
        }
    }

    return { blocked: errors.length > 0, errors, warnings };
}
