// ---------------------------------------------------------------------------
// HydroPasteEngine — Figma design payload → component code snippets
// ---------------------------------------------------------------------------

import { queryRegistryDeterministic, type ComponentEntry } from './registryService.js';

// Internal normalised shape used only within this module
interface NormalisedToken {
    name: string;
    value: string;
}

export interface GeneratedComponent {
    name: string;
    jsx: string;
    props: Record<string, string>;
    tokenRefs: string[];
    matchedComponent?: {
        importPath: string;
        matchMode: 'deterministic' | 'heuristic';
        figmaComponentId?: string;
        registryProps?: Record<string, { type: string; required: boolean; default?: string }>;
    };
}

export interface HydroResult {
    components: GeneratedComponent[];
    imports: string[];
    summary: string;
    tokenMappings: Record<string, string>;
}

// Figma node shapes we care about
interface FigmaNode {
    name?: string;
    type?: string;
    children?: FigmaNode[];
    fills?: FigmaFill[];
    style?: Record<string, unknown>;
    characters?: string;
    /** FIGMA-MAP.2: Figma component ID for deterministic mapping. */
    figmaComponentId?: string;
    /** FIGMA-MAP.2: Figma file key for component origin tracking. */
    figmaFileKey?: string;
    [key: string]: unknown;
}

interface FigmaFill {
    type?: string;
    color?: { r: number; g: number; b: number; a?: number };
    [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) =>
        Math.round(Math.min(255, Math.max(0, n * 255)))
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Coerce a raw token object to a normalised { name, value } shape.
 * Accepts both the design-tokens.json on-disk format { name, value } and
 * the SQLite-backed DesignToken shape { token_path, token_value }.
 */
function normaliseToken(raw: unknown): NormalisedToken | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const name = typeof r["name"] === "string" ? r["name"]
        : typeof r["token_path"] === "string" ? r["token_path"]
        : null;
    const value = typeof r["value"] === "string" ? r["value"]
        : typeof r["token_value"] === "string" ? r["token_value"]
        : null;
    if (!name || !value) return null;
    return { name, value };
}

/**
 * Build a token value→tailwind-class lookup from the token array.
 * Matches on hex color values for background/text token types.
 */
function buildTokenLookup(
    tokens: unknown[]
): Map<string, string> {
    const lookup = new Map<string, string>();

    for (const raw of tokens) {
        const token = normaliseToken(raw);
        if (!token) continue;
        const rawValue = token.value?.trim();
        if (!rawValue) continue;

        // Normalise hex values
        const hexMatch = rawValue.match(/^#([0-9a-fA-F]{3,8})$/);
        if (!hexMatch) continue;

        const hex = rawValue.toUpperCase();
        const tokenName = token.name;

        // Derive a tailwind-ish class name from the token name.
        // e.g. "color.brand.primary" → "bg-color-brand-primary"
        // e.g. "brand-primary" → "bg-brand-primary"
        const safeName = tokenName
            .replace(/\./g, "-")
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        const tailwindClass = `bg-${safeName}`;
        lookup.set(hex, tailwindClass);
    }

    return lookup;
}

/**
 * Extract the primary fill hex color from a Figma fills array.
 */
function extractFillHex(fills?: FigmaFill[]): string | null {
    if (!fills || fills.length === 0) return null;

    for (const fill of fills) {
        if (fill.type === "SOLID" && fill.color) {
            const { r, g, b } = fill.color;
            return rgbToHex(r, g, b);
        }
    }
    return null;
}

/**
 * Resolve a fill hex to a tailwind class using the token lookup,
 * falling back to an arbitrary value class.
 */
function resolveColorClass(
    hex: string,
    tokenLookup: Map<string, string>,
    tokenMappings: Record<string, string>
): string {
    const known = tokenLookup.get(hex.toUpperCase());
    if (known) {
        tokenMappings[hex.toUpperCase()] = known;
        return known;
    }
    // Arbitrary value fallback
    return `bg-[${hex}]`;
}

// ---------------------------------------------------------------------------
// JSX generation
// ---------------------------------------------------------------------------

const TEXT_TYPES = new Set(["TEXT"]);

function generateJSX(
    node: FigmaNode,
    tokenLookup: Map<string, string>,
    tokenMappings: Record<string, string>,
    depth = 0
): string {
    const indent = "  ".repeat(depth);
    const nodeType = node.type ?? "FRAME";
    const name = node.name ?? "Element";

    if (TEXT_TYPES.has(nodeType)) {
        const text = typeof node.characters === "string" ? node.characters : name;
        const hex = extractFillHex(node.fills);
        const colorClass = hex ? ` ${resolveColorClass(hex, tokenLookup, tokenMappings)}` : "";
        return `${indent}<p className="text-base${colorClass}">${text}</p>`;
    }

    const hex = extractFillHex(node.fills);
    const colorClass = hex ? ` ${resolveColorClass(hex, tokenLookup, tokenMappings)}` : "";
    const className = `flex flex-col${colorClass}`;

    const children = node.children ?? [];
    if (children.length === 0) {
        return `${indent}<div className="${className}" />`;
    }

    const childLines = children.map((child) =>
        generateJSX(child, tokenLookup, tokenMappings, depth + 1)
    );

    return [
        `${indent}<div className="${className}">`,
        ...childLines,
        `${indent}</div>`,
    ].join("\n");
}

function componentNameFromNode(node: FigmaNode): string {
    const raw = node.name ?? node.type ?? "FigmaComponent";
    // PascalCase
    return raw
        .split(/[\s_\-/]+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class HydroPasteEngine {
    private readonly manifest: Record<string, unknown>;
    private readonly tokens: unknown[];

    constructor(
        manifest: Record<string, unknown>,
        tokens: unknown[]
    ) {
        this.manifest = manifest;
        this.tokens = tokens;
    }

    async processPayload(figmaPayload: unknown): Promise<HydroResult> {
        // Guard: no payload
        if (figmaPayload === null || figmaPayload === undefined) {
            return {
                components: [],
                imports: [],
                summary: "No payload provided",
                tokenMappings: {},
            };
        }

        // Parse if string
        let payload: FigmaNode;
        if (typeof figmaPayload === "string") {
            try {
                payload = JSON.parse(figmaPayload) as FigmaNode;
            } catch {
                return {
                    components: [],
                    imports: [],
                    summary: "Invalid JSON payload",
                    tokenMappings: {},
                };
            }
        } else if (typeof figmaPayload === "object") {
            payload = figmaPayload as FigmaNode;
        } else {
            return {
                components: [],
                imports: [],
                summary: `Unrecognized payload type: ${typeof figmaPayload}`,
                tokenMappings: {},
            };
        }

        const tokenLookup = buildTokenLookup(this.tokens);
        const tokenMappings: Record<string, string> = {};

        // FIGMA-MAP.3: Deterministic component lookup by Figma ID
        let componentName = componentNameFromNode(payload);
        let matchedEntry: ComponentEntry | null = null;
        let matchMode: 'deterministic' | 'heuristic' | 'none' = 'none';

        // manifest is typed as Record<string,unknown> from disk; .components is optional
        const components = (this.manifest as { components?: Record<string, ComponentEntry> })?.components ?? {};
        const registryResults = queryRegistryDeterministic(
            components,
            payload.figmaComponentId ?? null,
            componentName,
            1,
        );

        if (registryResults.length > 0) {
            matchedEntry = registryResults[0];
            componentName = matchedEntry.name;
            matchMode = (matchedEntry.figmaComponentId === payload.figmaComponentId)
                ? 'deterministic'
                : 'heuristic';
        }

        const jsxBody = generateJSX(payload, tokenLookup, tokenMappings, 1);

        const jsx = [
            `export function ${componentName}() {`,
            `  return (`,
            jsxBody,
            `  );`,
            `}`,
        ].join("\n");

        const tokenRefs = Object.values(tokenMappings);

        const generatedComponent: GeneratedComponent = {
            name: componentName,
            jsx,
            props: {},
            tokenRefs,
            ...(matchedEntry && matchMode !== 'none' && {
                matchedComponent: {
                    importPath: matchedEntry.importPath,
                    matchMode,
                    figmaComponentId: matchedEntry.figmaComponentId,
                    registryProps: matchedEntry.props,
                },
            }),
        };

        const generatedComponents: GeneratedComponent[] = [generatedComponent];

        const imports: string[] = ["import React from 'react';"];

        // Prepend matched component import if available
        if (matchedEntry?.importPath) {
            imports.unshift(`import { ${componentName} } from '${matchedEntry.importPath}';`);
        }

        const registryComponentCount =
            typeof this.manifest.components === "object" &&
            this.manifest.components !== null
                ? Object.keys(this.manifest.components as object).length
                : 0;

        const summary =
            `Generated ${generatedComponents.length} component(s) from Figma payload "${payload.name ?? componentName}". ` +
            `Component match: ${matchMode}. ` +
            `Token mappings resolved: ${tokenRefs.length}. ` +
            `Registry components available: ${registryComponentCount}.`;

        return {
            components: generatedComponents,
            imports,
            summary,
            tokenMappings,
        };
    }
}
