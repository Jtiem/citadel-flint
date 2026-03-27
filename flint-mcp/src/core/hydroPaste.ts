// ---------------------------------------------------------------------------
// HydroPasteEngine — Figma design payload → component code snippets
// ---------------------------------------------------------------------------

import { queryRegistryDeterministic, type ComponentEntry } from './registryService.js';
import { getEmitterForLibrary, type LibraryCodeEmitter } from './hydroPaste-emitters.js';
import { hexToLab, findNearestToken, TIER2_DELTA_E, type LabTokenEntry } from './colorDistance.js';
import { analyzeLayout, layoutClassesToString } from './layoutAnalyzer.js';

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

export interface HydroOptions {
    /** Active UI library — if set, output uses library-specific patterns. */
    library?: string
}

export interface HydroResult {
    components: GeneratedComponent[];
    imports: string[];
    summary: string;
    tokenMappings: Record<string, string>;
    /** The library used for generation, if any. Undefined means generic output. */
    library?: string;
    /** When multi-component page mode is used, this contains the compositor. */
    page?: {
        name: string;
        jsx: string;
        imports: string[];
    };
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
    /** Set by figmaMcpParser when enriching from Figma MCP data-name attributes. */
    componentType?: string;
    /** Figma auto-layout properties */
    layoutMode?: string;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    itemSpacing?: number;
    layoutSizingHorizontal?: string;
    layoutSizingVertical?: string;
    cornerRadius?: number;
    clipsContent?: boolean;
    absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
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
 * Build a token value→safe-name lookup from the token array.
 * Returns both an exact-hex Map and a pre-computed LAB array for fuzzy matching.
 * The lookup stores bare safe names WITHOUT a bg-/text- prefix so callers can
 * apply the correct prefix based on the node's color role.
 *
 * e.g. "color.brand.primary" → "color-brand-primary"
 * e.g. "brand-primary"       → "brand-primary"
 */
export function buildTokenLookup(tokens: unknown[]): {
    lookup: Map<string, string>
    labTokens: Array<LabTokenEntry>
} {
    const lookup = new Map<string, string>();
    const labTokens: Array<LabTokenEntry> = [];

    for (const raw of tokens) {
        const token = normaliseToken(raw);
        if (!token) continue;
        const rawValue = token.value?.trim();
        if (!rawValue) continue;

        // Only process hex color values
        const hexMatch = rawValue.match(/^#([0-9a-fA-F]{3,8})$/);
        if (!hexMatch) continue;

        const hex = rawValue.toUpperCase();
        const tokenName = token.name;

        // Derive a bare safe name — no bg-/text- prefix.
        const safeName = tokenName
            .replace(/\./g, "-")
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        lookup.set(hex, safeName);

        // Pre-compute LAB for fuzzy CIEDE2000 matching
        const lab = hexToLab(hex);
        if (lab !== null) {
            labTokens.push({ hex, lab, className: safeName });
        }
    }

    return { lookup, labTokens };
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
 * Resolve a fill hex to a fully-prefixed Tailwind class using the token lookup.
 * The role determines whether we apply a bg- or text- prefix:
 *   - 'background' → bg-{token}   (FRAME, RECTANGLE, etc.)
 *   - 'foreground' → text-{token} (TEXT nodes)
 *
 * Uses CIEDE2000 fuzzy matching via labTokens as a fallback when exact hex
 * lookup fails, allowing near-identical colors (ΔE < 2.0) to resolve correctly.
 *
 * Falls back to an arbitrary value class when no token matches within threshold.
 */
export function resolveColorClass(
    hex: string,
    role: 'background' | 'foreground',
    tokenLookup: Map<string, string>,
    labTokens: Array<LabTokenEntry>,
    tokenMappings: Record<string, string>,
): string {
    const match = findNearestToken(hex, tokenLookup, labTokens, TIER2_DELTA_E);
    if (match) {
        const prefixed = role === 'foreground' ? `text-${match.className}` : `bg-${match.className}`;
        tokenMappings[hex.toUpperCase()] = prefixed;
        return prefixed;
    }
    // Arbitrary value fallback — use appropriate prefix
    return role === 'foreground' ? `text-[${hex}]` : `bg-[${hex}]`;
}

// ---------------------------------------------------------------------------
// Frame / Component classifiers — D2C.4 Feature 1
// ---------------------------------------------------------------------------

/**
 * Semantic element type returned by classifyFrame.
 * Matches the element values accepted by LibraryCodeEmitter.wrapContainer.
 */
export type FrameClassification =
    | 'card'
    | 'div'
    | 'form'
    | 'nav'
    | 'section'
    | 'article'
    | 'header'
    | 'footer'

/**
 * Library-agnostic component type returned by classifyComponent.
 * Maps to library-specific markup via emitNamedComponent.
 */
export type ComponentType =
    | 'input'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'switch'
    | 'avatar'
    | 'badge'
    | 'tabs'
    | 'separator'
    | 'alert'

/** Full result from classifyComponent — null when no keyword matched. */
export interface ComponentClassification {
    type: ComponentType
    /** Keywords that triggered this match */
    matchedKeywords: string[]
}

/**
 * Classify a Figma FRAME node by name and depth into a semantic HTML wrapper type.
 *
 * Decision tree (priority order, first match wins):
 *  1. Name contains "card" or "panel"           → 'card'
 *  2. Name contains "form"                      → 'form'
 *  3. Name contains "nav", "navbar", "navigation" → 'nav'
 *  4. Name contains "header"                    → 'header'
 *  5. Name contains "footer"                    → 'footer'
 *  6. Name contains "section", "hero", "banner" → 'section'
 *  7. Depth <= 1                                → 'div'  (top-level layout)
 *  8. Has fill + visual cue keywords in name   → 'card'
 *  9. Layout/wrapper keyword names             → 'div'
 * 10. Default                                  → 'div'
 */
export function classifyFrame(node: FigmaNode, depth: number): FrameClassification {
    const name = (node.name ?? '').toLowerCase()

    // 1. Card / panel keyword
    if (name.includes('card') || name.includes('panel')) return 'card'

    // 2. Form keyword
    if (name.includes('form')) return 'form'

    // 3. Nav keywords
    if (name.includes('nav') || name.includes('navbar') || name.includes('navigation')) return 'nav'

    // 4. Header keyword
    if (name.includes('header')) return 'header'

    // 5. Footer keyword
    if (name.includes('footer')) return 'footer'

    // 6. Section / hero / banner
    if (name.includes('section') || name.includes('hero') || name.includes('banner')) return 'section'

    // 7. Shallow depth → generic div layout container
    if (depth <= 1) return 'div'

    // 8. Has a solid fill + visual cue in node name → treat as card
    const hasSolidFill = Array.isArray(node.fills) &&
        (node.fills as FigmaFill[]).some((f) => f.type === 'SOLID')
    const hasVisualCue = ['shadow', 'border', 'stroke', 'surface', 'tile'].some(kw => name.includes(kw))
    if (hasSolidFill && hasVisualCue) return 'card'

    // 9. Layout / wrapper keywords → generic div
    const layoutKeywords = ['row', 'col', 'group', 'wrapper', 'block', 'container', 'content', 'layout', 'frame']
    if (layoutKeywords.some(kw => name.includes(kw))) return 'div'

    // 10. Default
    return 'div'
}

/**
 * Classify a Figma node name into a recognized UI component type.
 *
 * Returns null when no keyword matches.
 * Evaluated in order — first match wins.
 */
export function classifyComponent(name: string, componentType?: string): ComponentClassification | null {
    // High-confidence path: componentType set by Figma MCP data-name enrichment
    if (componentType) {
        return { type: componentType as ComponentType, matchedKeywords: [`data-name:${componentType}`] }
    }

    const lower = name.toLowerCase()

    // textarea before input — "text-field" contains "field" but "text-area" / "textarea" is more specific
    if (lower.includes('textarea') || lower.includes('text-area') || lower.includes('multiline')) {
        const matched: string[] = []
        if (lower.includes('textarea')) matched.push('textarea')
        if (lower.includes('text-area')) matched.push('text-area')
        if (lower.includes('multiline')) matched.push('multiline')
        return { type: 'textarea', matchedKeywords: matched }
    }

    // input — "input" or "field" (but not preceded by "text-" which was caught above)
    if (lower.includes('input') || lower.includes('field') || lower.includes('textfield') || lower.includes('text-field')) {
        const matched: string[] = []
        if (lower.includes('input')) matched.push('input')
        if (lower.includes('field')) matched.push('field')
        if (lower.includes('textfield')) matched.push('textfield')
        if (lower.includes('text-field')) matched.push('text-field')
        return { type: 'input', matchedKeywords: matched }
    }

    // select / dropdown / combobox
    if (lower.includes('select') || lower.includes('dropdown') || lower.includes('combobox')) {
        const matched: string[] = []
        if (lower.includes('select')) matched.push('select')
        if (lower.includes('dropdown')) matched.push('dropdown')
        if (lower.includes('combobox')) matched.push('combobox')
        return { type: 'select', matchedKeywords: matched }
    }

    // checkbox / check-box
    if (lower.includes('checkbox') || lower.includes('check-box')) {
        const matched: string[] = []
        if (lower.includes('checkbox')) matched.push('checkbox')
        if (lower.includes('check-box')) matched.push('check-box')
        return { type: 'checkbox', matchedKeywords: matched }
    }

    // switch / toggle
    if (lower.includes('switch') || lower.includes('toggle')) {
        const matched: string[] = []
        if (lower.includes('switch')) matched.push('switch')
        if (lower.includes('toggle')) matched.push('toggle')
        return { type: 'switch', matchedKeywords: matched }
    }

    // avatar / profile-pic
    if (lower.includes('avatar') || lower.includes('profile-pic')) {
        const matched: string[] = []
        if (lower.includes('avatar')) matched.push('avatar')
        if (lower.includes('profile-pic')) matched.push('profile-pic')
        return { type: 'avatar', matchedKeywords: matched }
    }

    // badge / tag / chip
    if (lower.includes('badge') || lower.includes('tag') || lower.includes('chip')) {
        const matched: string[] = []
        if (lower.includes('badge')) matched.push('badge')
        if (lower.includes('tag')) matched.push('tag')
        if (lower.includes('chip')) matched.push('chip')
        return { type: 'badge', matchedKeywords: matched }
    }

    // tabs — but NOT "table"
    // Guard: "table" contains "tab" so we must exclude it explicitly
    if ((lower.includes('tab') && !lower.includes('table')) || lower === 'tabs') {
        const matched: string[] = []
        if (lower.includes('tab')) matched.push('tab')
        return { type: 'tabs', matchedKeywords: matched }
    }

    // separator / divider / hr
    if (lower.includes('separator') || lower.includes('divider') || lower === 'hr') {
        const matched: string[] = []
        if (lower.includes('separator')) matched.push('separator')
        if (lower.includes('divider')) matched.push('divider')
        if (lower === 'hr') matched.push('hr')
        return { type: 'separator', matchedKeywords: matched }
    }

    // alert / message / toast (but not "notification" inside "notifications list")
    if (lower.includes('alert') || lower.includes('message') || lower.includes('toast')) {
        const matched: string[] = []
        if (lower.includes('alert')) matched.push('alert')
        if (lower.includes('message')) matched.push('message')
        if (lower.includes('toast')) matched.push('toast')
        return { type: 'alert', matchedKeywords: matched }
    }

    return null
}

// ---------------------------------------------------------------------------
// JSX generation helpers
// ---------------------------------------------------------------------------

const TEXT_TYPES = new Set(["TEXT"]);

/**
 * Return true when a FRAME node looks like a button.
 *
 * Rules (ALL must pass to avoid false positives on generic containers):
 *   1. Exactly one child, and that child is a TEXT node.
 *   2. Either the frame NAME contains a button keyword, OR the text content
 *      itself looks like a button label (short, single-line, action-phrase).
 *      The text-content heuristic requires the frame name to be absent/generic
 *      (not a known container name) to avoid false positives.
 */
function isLikelyButton(node: FigmaNode): boolean {
    const children = node.children ?? [];
    if (children.length !== 1) return false;
    const child = children[0];
    if (child.type !== "TEXT") return false;

    const name = (node.name ?? "").toLowerCase();
    const buttonKeywords = [
        "button", "btn", "cta", "submit", "cancel", "action",
        "get started", "sign up", "log in", "learn more",
    ];

    // Name-based heuristic — frame name explicitly signals a button
    if (buttonKeywords.some((kw) => name.includes(kw))) return true;

    // Text-content heuristic — only when the frame name doesn't look like a
    // known container (banner, card, section, header, hero, layout, panel, etc.)
    // Also exclude semantic frame types that classifyFrame will handle:
    // form, nav, navbar, navigation, footer, section, hero, banner, header
    const containerKeywords = [
        "banner", "card", "section", "header", "hero", "layout",
        "panel", "container", "wrapper", "frame", "group", "row", "col",
        "heading", "headline", "title", "label", "element",
        // Semantic frame types — should fall through to classifyFrame, not become buttons
        "form", "nav", "navbar", "navigation", "footer",
    ];
    if (containerKeywords.some((kw) => name.includes(kw))) return false;

    // Short action-phrase heuristic for generically-named frames
    const text = (child.characters ?? "").trim();
    if (text.length > 0 && text.length <= 30 && !text.includes("\n")) return true;

    return false;
}

/**
 * Return true when a TEXT node looks like a section heading.
 * Only applies at shallow depth (≤3) to avoid treating body copy as headings.
 */
function isLikelyHeading(node: FigmaNode, depth: number): boolean {
    if (node.type !== "TEXT") return false;
    if (depth > 3) return false;
    const name = (node.name ?? "").toLowerCase();

    // Exclusion list — names that contain heading keywords but aren't headings
    const exclusions = ["subtitle", "subheading", "caption", "overline", "eyebrow"];
    if (exclusions.some((ex) => name.includes(ex))) return false;

    return ["heading", "headline", "title", "h1", "h2", "h3"].some((kw) =>
        name.includes(kw)
    );
}

// ---------------------------------------------------------------------------
// JSX generation
// ---------------------------------------------------------------------------

/**
 * Generic (no-library) JSX generation.
 * Produces plain div/button/h2/p output with Tailwind utility classes.
 */
function generateJSX(
    node: FigmaNode,
    tokenLookup: Map<string, string>,
    labTokens: Array<LabTokenEntry>,
    tokenMappings: Record<string, string>,
    depth = 0,
): string {
    const indent = "  ".repeat(depth);
    const nodeType = node.type ?? "FRAME";
    const name = node.name ?? "Element";

    if (TEXT_TYPES.has(nodeType)) {
        const text = typeof node.characters === "string" ? node.characters : name;
        const hex = extractFillHex(node.fills);
        const colorClass = hex
            ? ` ${resolveColorClass(hex, "foreground", tokenLookup, labTokens, tokenMappings)}`
            : "";

        // Heading heuristic for the generic path
        if (isLikelyHeading(node, depth)) {
            return `${indent}<h2 className="text-2xl font-bold${colorClass}">${text}</h2>`;
        }

        return `${indent}<p className="text-base${colorClass}">${text}</p>`;
    }

    // Button heuristic for the generic path
    if (isLikelyButton(node)) {
        const textChild = node.children![0];
        const buttonText = (textChild.characters ?? textChild.name ?? "").trim();
        const hex = extractFillHex(node.fills);
        const colorClass = hex
            ? ` ${resolveColorClass(hex, "background", tokenLookup, labTokens, tokenMappings)}`
            : "";
        return `${indent}<button className="px-4 py-2${colorClass}">${buttonText}</button>`;
    }

    const hex = extractFillHex(node.fills);
    const colorClass = hex
        ? ` ${resolveColorClass(hex, "background", tokenLookup, labTokens, tokenMappings)}`
        : "";
    const className = `flex flex-col${colorClass}`;

    const children = node.children ?? [];
    if (children.length === 0) {
        return `${indent}<div className="${className}" />`;
    }

    const childLines = children.map((child) =>
        generateJSX(child, tokenLookup, labTokens, tokenMappings, depth + 1)
    );

    return [
        `${indent}<div className="${className}">`,
        ...childLines,
        `${indent}</div>`,
    ].join("\n");
}

/**
 * Library-aware JSX generation.
 * Delegates container/text/component rendering to the supplied emitter.
 *
 * Color role separation: resolveColor returns a bare token name (no prefix).
 * This function applies "text-" for TEXT nodes and "bg-" for container nodes
 * so that neither the emitters nor the interface need to know the role.
 */
function generateJSXWithEmitter(
    node: FigmaNode,
    tokenLookup: Map<string, string>,
    labTokens: LabTokenEntry[],
    tokenMappings: Record<string, string>,
    emitter: LibraryCodeEmitter,
    depth = 0
): string {
    const nodeType = node.type ?? "FRAME";
    const nodeName = node.name ?? "Element";

    if (TEXT_TYPES.has(nodeType)) {
        const text = typeof node.characters === "string" ? node.characters : nodeName;
        const hex = extractFillHex(node.fills);

        // Resolve raw token name from emitter, then apply the text- prefix.
        // Emitters may record the bare safe-name in tokenMappings; we overwrite it
        // below with the fully-prefixed value so callers see consistent output.
        let colorClass = "";
        if (hex) {
            const raw = emitter.resolveColor(hex, tokenLookup, labTokens, tokenMappings);
            // raw is either a bare safe-name or an arbitrary-value bracket expression
            colorClass = raw.startsWith("bg-")
                ? raw.replace(/^bg-/, "text-")   // emitter returned full bg- prefix — swap to text-
                : raw.startsWith("text-")
                    ? raw                          // already has correct prefix
                    : `text-${raw}`;               // bare name — add text- prefix
            // Overwrite with the final prefixed value for consistent tokenMappings output
            tokenMappings[hex.toUpperCase()] = colorClass;
        }

        // Heading heuristic
        if (isLikelyHeading(node, depth)) {
            return emitter.emitHeading(text, colorClass, depth);
        }

        return emitter.emitText(text, colorClass, depth);
    }

    // Button heuristic — only in the emitter path
    if (isLikelyButton(node)) {
        const textChild = node.children![0];
        const buttonText = (textChild.characters ?? textChild.name ?? "").trim();
        return emitter.emitComponent("Button", {}, buttonText, depth);
    }

    const hex = extractFillHex(node.fills);
    let colorClass = "";
    if (hex) {
        const raw = emitter.resolveColor(hex, tokenLookup, labTokens, tokenMappings);
        // Apply bg- prefix for container nodes; overwrite tokenMappings with final value
        colorClass = raw.startsWith("bg-") || raw.startsWith("text-")
            ? raw                              // already has a prefix
            : `bg-${raw}`;                     // bare name — add bg- prefix
        tokenMappings[hex.toUpperCase()] = colorClass;
    }
    // Use Figma layout properties when available, fall back to generic flex-col
    const layoutStr = layoutClassesToString(analyzeLayout(node));
    const baseLayout = layoutStr || 'flex flex-col';
    const className = `${baseLayout}${colorClass ? ` ${colorClass}` : ""}`;

    const children = node.children ?? [];
    const childrenJSX = children
        .map((child) =>
            generateJSXWithEmitter(child, tokenLookup, labTokens, tokenMappings, emitter, depth + 1)
        )
        .join("\n");

    // COMPONENT or INSTANCE nodes map to library components when the name is PascalCase
    if (nodeType === "COMPONENT" || nodeType === "INSTANCE") {
        const compName = nodeName
            .split(/[\s_\-/]+/)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join("");
        return emitter.emitComponent(compName, {}, childrenJSX, depth);
    }

    // D2C.4 Feature 1: classify the frame before falling back to generic container.
    // Step 1: Check whether this node looks like a named component (Input, Select, etc.)
    const componentClassification = classifyComponent(nodeName, node.componentType);
    if (componentClassification !== null) {
        return emitter.emitNamedComponent(componentClassification.type, {}, childrenJSX, depth);
    }

    // Step 2: Classify as a semantic HTML container element
    const frameClassification = classifyFrame(node, depth);

    // 'card' and 'div' fall through to the default wrapContainer (library default)
    if (frameClassification === 'form') {
        return emitter.wrapContainer(className.replace('flex flex-col', '').trim(), childrenJSX, depth, 'form');
    }
    if (frameClassification === 'nav') {
        return emitter.wrapContainer(className, childrenJSX, depth, 'nav');
    }
    if (frameClassification === 'section') {
        return emitter.wrapContainer(className, childrenJSX, depth, 'section');
    }
    if (frameClassification === 'header') {
        return emitter.wrapContainer(className, childrenJSX, depth, 'header');
    }
    if (frameClassification === 'footer') {
        return emitter.wrapContainer(className, childrenJSX, depth, 'footer');
    }

    return emitter.wrapContainer(className, childrenJSX, depth);
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
    private readonly options: HydroOptions;

    constructor(
        manifest: Record<string, unknown>,
        tokens: unknown[],
        options?: HydroOptions
    ) {
        this.manifest = manifest;
        this.tokens = tokens;
        this.options = options ?? {};
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

        const { lookup: tokenLookup, labTokens } = buildTokenLookup(this.tokens);
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

        // Resolve active library emitter (if any)
        const activeLibrary = this.options.library?.trim().toLowerCase() || undefined;
        const emitter = activeLibrary ? getEmitterForLibrary(activeLibrary) : null;
        // Null emitter means unknown library → fall back to generic path
        const resolvedLibrary = emitter ? activeLibrary : undefined;

        const jsxBody = emitter
            ? generateJSXWithEmitter(payload, tokenLookup, labTokens, tokenMappings, emitter, 1)
            : generateJSX(payload, tokenLookup, labTokens, tokenMappings, 1);

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

        // Build imports — start with React, then registry match, then library components
        const imports: string[] = ["import React from 'react';"];

        // Prepend matched component import if available
        if (matchedEntry?.importPath) {
            imports.unshift(`import { ${componentName} } from '${matchedEntry.importPath}';`);
        }

        // Append library-specific imports (emitter tracks which components were used)
        if (emitter) {
            const libraryImports = emitter.getImports();
            for (const imp of libraryImports) {
                if (!imports.includes(imp)) {
                    imports.push(imp);
                }
            }
        }

        const registryComponentCount =
            typeof this.manifest.components === "object" &&
            this.manifest.components !== null
                ? Object.keys(this.manifest.components as object).length
                : 0;

        const libraryLabel = resolvedLibrary
            ? ` using ${resolvedLibrary}`
            : "";

        const summary =
            `Generated ${generatedComponents.length} component(s) from Figma payload "${payload.name ?? componentName}"${libraryLabel}. ` +
            `Component match: ${matchMode}. ` +
            `Token mappings resolved: ${tokenRefs.length}. ` +
            `Registry components available: ${registryComponentCount}.`;

        return {
            components: generatedComponents,
            imports,
            summary,
            tokenMappings,
            ...(resolvedLibrary !== undefined && { library: resolvedLibrary }),
        };
    }

    /**
     * Parse and validate a raw figma payload. Shared by both processPayload
     * and processPage to eliminate duplicated validation logic.
     */
    private parsePayload(figmaPayload: unknown): FigmaNode | HydroResult {
        if (figmaPayload === null || figmaPayload === undefined) {
            return { components: [], imports: [], summary: "No payload provided", tokenMappings: {} };
        }
        if (typeof figmaPayload === "string") {
            try { return JSON.parse(figmaPayload) as FigmaNode; }
            catch { return { components: [], imports: [], summary: "Invalid JSON payload", tokenMappings: {} }; }
        }
        if (typeof figmaPayload === "object") {
            return figmaPayload as FigmaNode;
        }
        return { components: [], imports: [], summary: `Unrecognized payload type: ${typeof figmaPayload}`, tokenMappings: {} };
    }

    /**
     * Process a Figma page/frame with multiple section children.
     * Each direct FRAME child becomes its own component with registry lookup.
     * A page compositor component imports and assembles them.
     *
     * Falls back to processPayload() when the root has 0-1 FRAME children.
     */
    async processPage(figmaPayload: unknown): Promise<HydroResult> {
        const parsed = this.parsePayload(figmaPayload);
        if ('components' in parsed) return parsed as HydroResult;
        const payload = parsed as FigmaNode;

        // Identify section-level children (structural Figma node types at depth 1)
        const sectionTypes = new Set(["FRAME", "COMPONENT", "INSTANCE", "COMPONENT_SET", "GROUP", "SECTION"]);
        const sections = (payload.children ?? []).filter(c => sectionTypes.has(c.type ?? ""));

        // If 0-1 sections, fall back to single-component mode (includes registry lookup)
        if (sections.length <= 1) {
            return this.processPayload(figmaPayload);
        }

        // Build shared token lookup once
        const { lookup: tokenLookup, labTokens } = buildTokenLookup(this.tokens);
        const allTokenMappings: Record<string, string> = {};
        const components = (this.manifest as { components?: Record<string, ComponentEntry> })?.components ?? {};

        const activeLibrary = this.options.library?.trim().toLowerCase() || undefined;
        const resolvedLibrary = (activeLibrary && getEmitterForLibrary(activeLibrary)) ? activeLibrary : undefined;

        const allComponents: GeneratedComponent[] = [];
        const allImports: string[] = ["import React from 'react';"];
        const usedNames = new Set<string>();

        // Process each section as its own component
        for (const section of sections) {
            let sectionName = componentNameFromNode(section) || "Section";

            // Deduplicate names: Header, Header2, Header3, ...
            const baseName = sectionName;
            let suffix = 2;
            while (usedNames.has(sectionName)) {
                sectionName = `${baseName}${suffix++}`;
            }
            usedNames.add(sectionName);

            const sectionMappings: Record<string, string> = {};

            // Registry lookup per section (FIGMA-MAP.3)
            let matchedEntry: ComponentEntry | null = null;
            let matchMode: 'deterministic' | 'heuristic' | 'none' = 'none';
            const registryResults = queryRegistryDeterministic(
                components,
                section.figmaComponentId ?? null,
                sectionName,
                1,
            );
            if (registryResults.length > 0) {
                matchedEntry = registryResults[0];
                sectionName = matchedEntry.name;
                matchMode = (matchedEntry.figmaComponentId === section.figmaComponentId)
                    ? 'deterministic' : 'heuristic';
            }

            // Fresh emitter per section — isolated import tracking
            const sectionEmitter = activeLibrary ? getEmitterForLibrary(activeLibrary) : null;

            const jsxBody = sectionEmitter
                ? generateJSXWithEmitter(section, tokenLookup, labTokens, sectionMappings, sectionEmitter, 1)
                : generateJSX(section, tokenLookup, labTokens, sectionMappings, 1);

            const jsx = [
                `export function ${sectionName}() {`,
                `  return (`,
                jsxBody,
                `  );`,
                `}`,
            ].join("\n");

            const generated: GeneratedComponent = {
                name: sectionName,
                jsx,
                props: {},
                tokenRefs: Object.values(sectionMappings),
                ...(matchedEntry && matchMode !== 'none' && {
                    matchedComponent: {
                        importPath: matchedEntry.importPath,
                        matchMode,
                        figmaComponentId: matchedEntry.figmaComponentId,
                        registryProps: matchedEntry.props,
                    },
                }),
            };

            allComponents.push(generated);

            // Collect imports
            if (matchedEntry?.importPath) {
                const regImp = `import { ${sectionName} } from '${matchedEntry.importPath}';`;
                if (!allImports.includes(regImp)) allImports.push(regImp);
            }
            if (sectionEmitter) {
                for (const imp of sectionEmitter.getImports()) {
                    if (!allImports.includes(imp)) allImports.push(imp);
                }
            }

            Object.assign(allTokenMappings, sectionMappings);
        }

        // Build page compositor
        const pageName = componentNameFromNode(payload) || "Page";
        const sectionImports = allComponents.map(c =>
            `import { ${c.name} } from './${c.name}';`
        );
        const sectionUsages = allComponents.map(c =>
            `      <${c.name} />`
        );

        const pageJsx = [
            `export function ${pageName}() {`,
            `  return (`,
            `    <main>`,
            ...sectionUsages,
            `    </main>`,
            `  );`,
            `}`,
        ].join("\n");

        const libraryLabel = resolvedLibrary ? ` using ${resolvedLibrary}` : "";
        const summary =
            `Generated ${allComponents.length} section component(s) + 1 page compositor from "${payload.name ?? pageName}"${libraryLabel}. ` +
            `Token mappings resolved: ${Object.keys(allTokenMappings).length}.`;

        return {
            components: allComponents,
            imports: allImports,
            summary,
            tokenMappings: allTokenMappings,
            ...(resolvedLibrary !== undefined && { library: resolvedLibrary }),
            page: {
                name: pageName,
                jsx: pageJsx,
                imports: [...sectionImports, "import React from 'react';"],
            },
        };
    }
}
