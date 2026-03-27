/**
 * figmaTokenExtractor.ts — flint-mcp/src/core/figmaTokenExtractor.ts
 *
 * Phase D2C.4 Feature 2: Token Extraction from Figma ("Design System Discovery")
 *
 * Pure, stateless module that walks a Figma node tree and extracts every
 * visual property value, deduplicates by value, scores confidence, and
 * detects near-duplicates with existing tokens via CIEDE2000.
 *
 * This module NEVER writes to disk. All output is returned as data structures
 * for the caller (flint_extract_tokens tool) to present for human review.
 * Writing only happens after explicit approval via flint_approve_tokens.
 *
 * Commandment compliance:
 *   C1  — No writes happen here; only extraction + classification
 *   C2  — Proposes named tokens; never auto-applies
 *   C4  — Pure local processing
 *   C9  — CIEDE2000 for near-match detection
 */

import type { DesignToken, TokenType } from '../types.js'
import { hexToLab, deltaE2000 } from './sync/colorMath.js'

// ── Public types ─────────────────────────────────────────────────────────────

/** Property context where this value was found in the Figma tree. */
export type FigmaSourceProperty =
    | 'fill'
    | 'stroke'
    | 'fontSize'
    | 'fontFamily'
    | 'fontWeight'
    | 'lineHeight'
    | 'letterSpacing'
    | 'cornerRadius'
    | 'padding'
    | 'itemSpacing'
    | 'effect'
    | 'opacity'

export interface ProposedToken {
    /** Dot-separated path, e.g. "colors.brand.blue-500" */
    proposedName: string
    /** Raw value, e.g. "#3B82F6", "16", "Inter" */
    value: string
    /** DTCG token type */
    type: TokenType
    /** How many times this exact value appeared in the payload */
    usageCount: number
    /** Confidence score 0-1 based on usage count + naming signals */
    confidence: number
    /** Where in the Figma tree this value was first found */
    source: {
        nodeName: string
        nodeType: string
        property: FigmaSourceProperty
    }
}

export interface TokenExtractionOptions {
    /** Existing tokens to diff against (avoids proposing duplicates). */
    existingTokens?: DesignToken[]
    /** Minimum usage count to include a token in results. Default: 1 */
    minUsageCount?: number
    /** Minimum confidence to include. Default: 0.0 */
    minConfidence?: number
}

export interface FigmaTokenExtractionResult {
    /** Proposed tokens, sorted by confidence DESC then usageCount DESC */
    proposedTokens: ProposedToken[]
    /** Tokens that already exist in the project (exact value match) */
    existingMatches: Array<{ proposed: ProposedToken; existing: DesignToken }>
    /** Tokens that are close but not exact (deltaE < 2.0 for colors) */
    nearMatches: Array<{ proposed: ProposedToken; existing: DesignToken; deltaE: number }>
    /** Summary statistics */
    stats: {
        totalValuesScanned: number
        uniqueColors: number
        uniqueSpacing: number
        uniqueTypography: number
        uniqueRadii: number
        proposedCount: number
        existingMatchCount: number
        nearMatchCount: number
    }
}

// ── Internal accumulators ────────────────────────────────────────────────────

/** A raw collected value before deduplication. */
interface RawValue {
    value: string
    type: TokenType
    nodeName: string
    nodeType: string
    property: FigmaSourceProperty
}

// ── Figma node shape (minimal — the full tree uses [key: string]: unknown) ───

interface FigmaColor {
    r: number
    g: number
    b: number
    a?: number
}

interface FigmaFill {
    type: string
    color?: FigmaColor
}

interface FigmaEffect {
    type: string
    color?: FigmaColor
    offset?: { x: number; y: number }
    radius?: number
}

interface FigmaStyle {
    fontSize?: number
    fontFamily?: string
    fontWeight?: number
    lineHeightPx?: number
    letterSpacing?: number
}

interface FigmaNode {
    id?: string
    name?: string
    type?: string
    fills?: FigmaFill[]
    strokes?: FigmaFill[]
    effects?: FigmaEffect[]
    style?: FigmaStyle
    fontSize?: number
    fontFamily?: string
    fontWeight?: number
    lineHeightPx?: number
    letterSpacing?: number
    cornerRadius?: number
    paddingLeft?: number
    paddingRight?: number
    paddingTop?: number
    paddingBottom?: number
    itemSpacing?: number
    opacity?: number
    layoutMode?: string
    children?: FigmaNode[]
    [key: string]: unknown
}

// ── Color conversion helpers ─────────────────────────────────────────────────

function toHex(value: number): string {
    return Math.round(Math.max(0, Math.min(255, value * 255)))
        .toString(16)
        .padStart(2, '0')
}

function figmaColorToHex(color: FigmaColor): string {
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase()
}

// ── Common design values for confidence bonus ────────────────────────────────

const COMMON_SPACING = new Set([4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96])
const COMMON_FONT_SIZES = new Set([10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48, 64, 72, 96])
const COMMON_RADII = new Set([0, 2, 4, 6, 8, 12, 16, 24, 32, 9999])

function isCommonSpacing(value: number): boolean {
    return COMMON_SPACING.has(value)
}

function isCommonFontSize(value: number): boolean {
    return COMMON_FONT_SIZES.has(value)
}

function isCommonRadius(value: number): boolean {
    return COMMON_RADII.has(value)
}

// ── Semantic name inference ───────────────────────────────────────────────────

/**
 * Infer a semantic role for a color based on node context.
 * Returns a role slug like "surface", "text", "brand", "border".
 */
function inferColorRole(nodeName: string, property: FigmaSourceProperty): string {
    const lower = nodeName.toLowerCase()

    if (property === 'stroke') return 'border'
    if (property === 'effect') return 'shadow'

    if (/background|bg|surface|canvas|page/.test(lower)) return 'surface'
    if (/text|label|heading|title|caption|paragraph|body/.test(lower)) return 'text'
    if (/primary|brand|accent|cta|action/.test(lower)) return 'brand'
    if (/secondary|neutral|subtle/.test(lower)) return 'secondary'
    if (/error|danger|destructive|warning/.test(lower)) return 'error'
    if (/success|positive|confirm/.test(lower)) return 'success'
    if (/info|informational/.test(lower)) return 'info'
    if (/border|divider|separator|outline/.test(lower)) return 'border'
    if (/icon|glyph/.test(lower)) return 'icon'

    return 'brand'
}

/**
 * Check whether a node name contains a semantic naming signal.
 * Returns true when the name is more descriptive than a generic shape name.
 */
function hasSemanticName(nodeName: string): boolean {
    const lower = nodeName.toLowerCase()
    // Generic non-semantic names
    if (/^(frame|group|rectangle|ellipse|polygon|vector|shape|layer|node|component|instance)\s*\d*$/i.test(lower)) {
        return false
    }
    // Must contain at least one word longer than 2 chars that isn't purely numeric
    const words = lower.split(/[\s\-_/]+/)
    return words.some(w => w.length > 2 && !/^\d+$/.test(w))
}

// ── Confidence scorer ────────────────────────────────────────────────────────

function scoreConfidence(
    usageCount: number,
    nodeName: string,
    value: string,
    type: TokenType,
    hasNearMatch: boolean,
): number {
    // Frequency component
    const freqScore = usageCount >= 3 ? 0.4 : usageCount === 2 ? 0.2 : 0.1

    // Naming signal component
    const namingScore = hasSemanticName(nodeName) ? 0.3 : 0.0

    // Common design value component
    let commonScore = 0.0
    if (type === 'dimension') {
        const num = parseFloat(value)
        if (isCommonSpacing(num) || isCommonFontSize(num) || isCommonRadius(num)) {
            commonScore = 0.2
        }
    } else if (type === 'color') {
        // All colors can be common — no bonus for colors (shape is determined by usage)
        commonScore = 0.0
    }

    // Novelty bonus (not already covered by an existing token)
    const noveltyScore = hasNearMatch ? 0.0 : 0.1

    return Math.min(1.0, freqScore + namingScore + commonScore + noveltyScore)
}

// ── Tree walker ──────────────────────────────────────────────────────────────

function castNode(raw: unknown): FigmaNode | null {
    if (raw === null || typeof raw !== 'object') return null
    return raw as FigmaNode
}

function collectFromNode(node: FigmaNode, collected: RawValue[]): void {
    const nodeName = node.name ?? 'Unknown'
    const nodeType = node.type ?? 'UNKNOWN'

    // --- Colors from fills ---
    if (Array.isArray(node.fills)) {
        for (const fill of node.fills) {
            if (fill.type === 'SOLID' && fill.color) {
                collected.push({
                    value: figmaColorToHex(fill.color),
                    type: 'color',
                    nodeName,
                    nodeType,
                    property: 'fill',
                })
            }
        }
    }

    // --- Colors from strokes ---
    if (Array.isArray(node.strokes)) {
        for (const stroke of node.strokes) {
            if (stroke.type === 'SOLID' && stroke.color) {
                collected.push({
                    value: figmaColorToHex(stroke.color),
                    type: 'color',
                    nodeName,
                    nodeType,
                    property: 'stroke',
                })
            }
        }
    }

    // --- Effects (drop shadows) ---
    if (Array.isArray(node.effects)) {
        for (const effect of node.effects) {
            if (effect.type === 'DROP_SHADOW' && effect.color) {
                collected.push({
                    value: figmaColorToHex(effect.color),
                    type: 'color',
                    nodeName,
                    nodeType,
                    property: 'effect',
                })
            }
        }
    }

    // --- Opacity ---
    if (typeof node.opacity === 'number' && node.opacity < 1.0 && node.opacity > 0) {
        collected.push({
            value: String(Math.round(node.opacity * 100) / 100),
            type: 'opacity',
            nodeName,
            nodeType,
            property: 'opacity',
        })
    }

    // --- Text nodes: typography properties ---
    const isText = nodeType === 'TEXT'
    if (isText) {
        // Font size — from node.style or direct node fields
        const fontSize = (node.style?.fontSize ?? node.fontSize)
        if (typeof fontSize === 'number' && fontSize > 0) {
            collected.push({
                value: String(fontSize),
                type: 'dimension',
                nodeName,
                nodeType,
                property: 'fontSize',
            })
        }

        // Font family
        const fontFamily = node.style?.fontFamily ?? node.fontFamily
        if (typeof fontFamily === 'string' && fontFamily.length > 0) {
            collected.push({
                value: fontFamily,
                type: 'fontFamily',
                nodeName,
                nodeType,
                property: 'fontFamily',
            })
        }

        // Font weight
        const fontWeight = node.style?.fontWeight ?? node.fontWeight
        if (typeof fontWeight === 'number') {
            collected.push({
                value: String(fontWeight),
                type: 'fontWeight',
                nodeName,
                nodeType,
                property: 'fontWeight',
            })
        }

        // Line height
        const lineHeight = node.style?.lineHeightPx ?? node.lineHeightPx
        if (typeof lineHeight === 'number' && lineHeight > 0) {
            collected.push({
                value: String(lineHeight),
                type: 'lineHeight',
                nodeName,
                nodeType,
                property: 'lineHeight',
            })
        }

        // Letter spacing
        const letterSpacing = node.style?.letterSpacing ?? node.letterSpacing
        if (typeof letterSpacing === 'number') {
            collected.push({
                value: String(letterSpacing),
                type: 'letterSpacing',
                nodeName,
                nodeType,
                property: 'letterSpacing',
            })
        }
    }

    // --- Frame nodes: layout properties ---
    const isFrame = nodeType === 'FRAME' || nodeType === 'COMPONENT' || nodeType === 'INSTANCE' || nodeType === 'GROUP'

    if (isFrame) {
        // Corner radius
        if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
            collected.push({
                value: String(node.cornerRadius),
                type: 'dimension',
                nodeName,
                nodeType,
                property: 'cornerRadius',
            })
        }

        // Padding — collect unique non-zero values
        const padValues = new Set<number>()
        for (const key of ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'] as const) {
            const v = node[key]
            if (typeof v === 'number' && v > 0) padValues.add(v)
        }
        for (const v of padValues) {
            collected.push({
                value: String(v),
                type: 'dimension',
                nodeName,
                nodeType,
                property: 'padding',
            })
        }

        // Item spacing (auto-layout gap)
        if (typeof node.itemSpacing === 'number' && node.itemSpacing > 0) {
            collected.push({
                value: String(node.itemSpacing),
                type: 'dimension',
                nodeName,
                nodeType,
                property: 'itemSpacing',
            })
        }
    }

    // --- Recurse into children ---
    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            const childNode = castNode(child)
            if (childNode !== null) {
                collectFromNode(childNode, collected)
            }
        }
    }
}

// ── Deduplication + naming ───────────────────────────────────────────────────

/** Keyed by "<type>:<value>" */
interface DedupEntry {
    rawValues: RawValue[]
    usageCount: number
    // First occurrence drives the source metadata
    firstOccurrence: RawValue
}

function buildDedupMap(rawValues: RawValue[]): Map<string, DedupEntry> {
    const map = new Map<string, DedupEntry>()
    for (const rv of rawValues) {
        const key = `${rv.type}:${rv.value}`
        const existing = map.get(key)
        if (existing) {
            existing.rawValues.push(rv)
            existing.usageCount++
        } else {
            map.set(key, {
                rawValues: [rv],
                usageCount: 1,
                firstOccurrence: rv,
            })
        }
    }
    return map
}

function buildProposedName(entry: DedupEntry): string {
    const { firstOccurrence } = entry
    const { type, value, nodeName, property } = firstOccurrence

    switch (type) {
        case 'color': {
            const role = inferColorRole(nodeName, property)
            // Use last 6 hex chars as suffix
            const suffix = value.replace('#', '').toLowerCase()
            return `colors.${role}.${suffix}`
        }
        case 'dimension': {
            switch (property) {
                case 'fontSize':
                    return `typography.fontSize.${value}`
                case 'lineHeight':
                    return `typography.lineHeight.${value}`
                case 'letterSpacing':
                    return `typography.letterSpacing.${value}`
                case 'cornerRadius':
                    return `radii.${value}`
                case 'padding':
                case 'itemSpacing':
                    return `spacing.${value}`
                default:
                    return `dimension.${value}`
            }
        }
        case 'fontFamily':
            return `typography.fontFamily.${value.toLowerCase().replace(/\s+/g, '-')}`
        case 'fontWeight':
            return `typography.fontWeight.${value}`
        case 'lineHeight':
            return `typography.lineHeight.${value}`
        case 'letterSpacing':
            return `typography.letterSpacing.${value}`
        case 'opacity':
            return `opacity.${value.replace('.', '-')}`
        default:
            return `${type}.${value}`
    }
}

// ── Existing token matching ───────────────────────────────────────────────────

const NEAR_MATCH_DELTA_E_THRESHOLD = 2.0

function checkExistingTokens(
    proposed: ProposedToken,
    existingTokens: DesignToken[],
): {
    exactMatch: DesignToken | null
    nearMatch: { token: DesignToken; deltaE: number } | null
} {
    let exactMatch: DesignToken | null = null
    let nearMatch: { token: DesignToken; deltaE: number } | null = null

    for (const token of existingTokens) {
        // Exact value match (case-insensitive for colors/strings)
        if (token.token_value.toUpperCase() === proposed.value.toUpperCase()) {
            exactMatch = token
            break
        }

        // Near-match: only meaningful for colors
        if (
            proposed.type === 'color' &&
            token.token_type === 'color' &&
            nearMatch === null
        ) {
            const lab1 = hexToLab(proposed.value)
            const lab2 = hexToLab(token.token_value)
            if (lab1 !== null && lab2 !== null) {
                const deltaE = deltaE2000(lab1, lab2)
                if (deltaE < NEAR_MATCH_DELTA_E_THRESHOLD) {
                    nearMatch = { token, deltaE }
                }
            }
        }
    }

    return { exactMatch, nearMatch }
}

// ── Category counters ────────────────────────────────────────────────────────

function categorize(type: TokenType, property: FigmaSourceProperty): 'color' | 'spacing' | 'typography' | 'radii' | 'other' {
    if (type === 'color') return 'color'
    if (property === 'cornerRadius') return 'radii'
    if (property === 'padding' || property === 'itemSpacing') return 'spacing'
    if (property === 'fontSize' || property === 'fontFamily' || property === 'fontWeight' ||
        property === 'lineHeight' || property === 'letterSpacing') return 'typography'
    return 'other'
}

// ── Main export ───────────────────────────────────────────────────────────────

export function extractTokensFromFigma(
    payload: unknown,
    options: TokenExtractionOptions = {},
): FigmaTokenExtractionResult {
    const {
        existingTokens = [],
        minUsageCount = 1,
        minConfidence = 0.0,
    } = options

    // --- Guard: empty or non-object payload ---
    const root = castNode(payload)
    if (root === null) {
        return {
            proposedTokens: [],
            existingMatches: [],
            nearMatches: [],
            stats: {
                totalValuesScanned: 0,
                uniqueColors: 0,
                uniqueSpacing: 0,
                uniqueTypography: 0,
                uniqueRadii: 0,
                proposedCount: 0,
                existingMatchCount: 0,
                nearMatchCount: 0,
            },
        }
    }

    // --- Walk the tree ---
    const rawValues: RawValue[] = []
    collectFromNode(root, rawValues)

    const totalValuesScanned = rawValues.length

    // --- Deduplicate ---
    const dedupMap = buildDedupMap(rawValues)

    // --- Build proposed tokens, checking against existing ---
    const proposedTokens: ProposedToken[] = []
    const existingMatches: Array<{ proposed: ProposedToken; existing: DesignToken }> = []
    const nearMatches: Array<{ proposed: ProposedToken; existing: DesignToken; deltaE: number }> = []

    // Category counters (pre-filter)
    const uniqueColorValues = new Set<string>()
    const uniqueSpacingValues = new Set<string>()
    const uniqueTypographyValues = new Set<string>()
    const uniqueRadiiValues = new Set<string>()

    for (const [, entry] of dedupMap) {
        const { firstOccurrence, usageCount } = entry
        const cat = categorize(firstOccurrence.type, firstOccurrence.property)

        // Count uniques per category
        if (cat === 'color') uniqueColorValues.add(firstOccurrence.value)
        else if (cat === 'spacing') uniqueSpacingValues.add(firstOccurrence.value)
        else if (cat === 'typography') uniqueTypographyValues.add(firstOccurrence.value)
        else if (cat === 'radii') uniqueRadiiValues.add(firstOccurrence.value)

        // Apply minimum usage filter
        if (usageCount < minUsageCount) continue

        // Check existing tokens for exact and near matches
        const { exactMatch, nearMatch } = checkExistingTokens(
            {
                proposedName: '', // placeholder — built below
                value: firstOccurrence.value,
                type: firstOccurrence.type,
                usageCount,
                confidence: 0,
                source: {
                    nodeName: firstOccurrence.nodeName,
                    nodeType: firstOccurrence.nodeType,
                    property: firstOccurrence.property,
                },
            },
            existingTokens,
        )

        const hasNearMatch = nearMatch !== null || exactMatch !== null
        const confidence = scoreConfidence(
            usageCount,
            firstOccurrence.nodeName,
            firstOccurrence.value,
            firstOccurrence.type,
            hasNearMatch,
        )

        const proposed: ProposedToken = {
            proposedName: buildProposedName(entry),
            value: firstOccurrence.value,
            type: firstOccurrence.type,
            usageCount,
            confidence,
            source: {
                nodeName: firstOccurrence.nodeName,
                nodeType: firstOccurrence.nodeType,
                property: firstOccurrence.property,
            },
        }

        if (exactMatch !== null) {
            // Already exists — goes into existingMatches, not proposedTokens
            existingMatches.push({ proposed, existing: exactMatch })
        } else {
            // May have a near match (close but distinct)
            if (nearMatch !== null) {
                nearMatches.push({ proposed, existing: nearMatch.token, deltaE: nearMatch.deltaE })
            }

            // Apply minimum confidence filter
            if (confidence >= minConfidence) {
                proposedTokens.push(proposed)
            }
        }
    }

    // --- Sort by confidence DESC, then usageCount DESC ---
    proposedTokens.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence
        return b.usageCount - a.usageCount
    })

    return {
        proposedTokens,
        existingMatches,
        nearMatches,
        stats: {
            totalValuesScanned,
            uniqueColors: uniqueColorValues.size,
            uniqueSpacing: uniqueSpacingValues.size,
            uniqueTypography: uniqueTypographyValues.size,
            uniqueRadii: uniqueRadiiValues.size,
            proposedCount: proposedTokens.length,
            existingMatchCount: existingMatches.length,
            nearMatchCount: nearMatches.length,
        },
    }
}
