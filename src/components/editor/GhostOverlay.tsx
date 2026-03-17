/**
 * GhostOverlay — src/components/editor/GhostOverlay.tsx
 *
 * A React portal that renders a floating card listing every hardcoded Tailwind
 * class on the currently selected canvas node and, where possible, suggesting
 * the nearest token-derived replacement.
 *
 * Design decisions:
 *   - Rendered into document.body via createPortal so overflow:hidden on
 *     parent containers cannot clip it.
 *   - Fixed to the top-right corner of the viewport canvas area (fallback
 *     positioning — no cross-origin postMessage required).
 *   - pointer-events: none on the backdrop so canvas drag interaction is
 *     never blocked. The dismiss button itself retains pointer-events.
 *   - Only visible when a node is selected AND that node has hardcoded classes.
 *
 * Hardcoded-class detection mirrors the logic in LayoutPanel.checkIsHardcoded:
 *   A class is hardcoded when it starts with a recognised Tailwind prefix AND
 *   is not present in the design token set for that prefix/type.
 *
 * Nearest-token matching (V1):
 *   For each hardcoded class we look for the first token whose derived class
 *   shares the same CSS prefix. If the hardcoded value uses an arbitrary syntax
 *   (e.g. p-[10px]) we additionally try to match the numeric value against
 *   dimension token values for a closer pick.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useTokenStore } from '../../store/tokenStore'
import type { DesignToken, TokenType } from '../../types/bridge-api'
import { tokenToClass } from '../../utils/classMapper'

// ── Prefix catalogue ───────────────────────────────────────────────────────────

/**
 * Every Tailwind prefix that Bridge tokens can back, paired with its
 * token type. Ordered by specificity so more-specific prefixes are tested
 * before generic ones (e.g. `border-` before `b-`).
 */
const PREFIX_CATALOGUE: ReadonlyArray<{ prefix: string; type: TokenType }> = [
    // Color
    { prefix: 'bg-', type: 'color' },
    { prefix: 'text-', type: 'color' },
    { prefix: 'border-', type: 'color' },
    { prefix: 'fill-', type: 'color' },
    { prefix: 'stroke-', type: 'color' },
    { prefix: 'from-', type: 'color' },
    { prefix: 'via-', type: 'color' },
    { prefix: 'to-', type: 'color' },
    // Dimension — spacing / sizing
    { prefix: 'p-', type: 'dimension' },
    { prefix: 'px-', type: 'dimension' },
    { prefix: 'py-', type: 'dimension' },
    { prefix: 'pt-', type: 'dimension' },
    { prefix: 'pr-', type: 'dimension' },
    { prefix: 'pb-', type: 'dimension' },
    { prefix: 'pl-', type: 'dimension' },
    { prefix: 'm-', type: 'dimension' },
    { prefix: 'mx-', type: 'dimension' },
    { prefix: 'my-', type: 'dimension' },
    { prefix: 'mt-', type: 'dimension' },
    { prefix: 'mr-', type: 'dimension' },
    { prefix: 'mb-', type: 'dimension' },
    { prefix: 'ml-', type: 'dimension' },
    { prefix: 'gap-', type: 'dimension' },
    { prefix: 'space-x-', type: 'dimension' },
    { prefix: 'space-y-', type: 'dimension' },
    { prefix: 'w-', type: 'dimension' },
    { prefix: 'h-', type: 'dimension' },
    { prefix: 'min-w-', type: 'dimension' },
    { prefix: 'min-h-', type: 'dimension' },
    { prefix: 'max-w-', type: 'dimension' },
    { prefix: 'max-h-', type: 'dimension' },
    { prefix: 'rounded-', type: 'dimension' },
    // Typography
    { prefix: 'font-', type: 'fontFamily' },
    { prefix: 'leading-', type: 'lineHeight' },
    { prefix: 'tracking-', type: 'letterSpacing' },
    // Shadow / opacity
    { prefix: 'shadow-', type: 'shadow' },
    { prefix: 'opacity-', type: 'opacity' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the first PREFIX_CATALOGUE entry that the given class starts with,
 * or null if the class has no tracked prefix.
 */
function matchPrefix(cls: string): { prefix: string; type: TokenType } | null {
    // Sort by descending prefix length so "space-x-" matches before "s-"
    for (const entry of PREFIX_CATALOGUE) {
        if (cls.startsWith(entry.prefix)) return entry
    }
    return null
}

/**
 * Builds the full set of token-derived Tailwind classes for a given
 * prefix + token-type combination.
 */
function buildTokenSet(
    tokens: DesignToken[],
    prefix: string,
    type: TokenType
): Set<string> {
    return new Set(
        tokens
            .filter((t) => t.token_type === type)
            .map((t) => tokenToClass(t.token_path, t.token_type, prefix))
    )
}

/**
 * Tries to extract a numeric pixel value from an arbitrary Tailwind class.
 * e.g. "p-[10px]" → 10, "gap-[1.5rem]" → null (rem not supported here).
 */
function extractPxValue(cls: string): number | null {
    const match = /\[(\d+(?:\.\d+)?)px\]/.exec(cls)
    return match !== null ? parseFloat(match[1]) : null
}

/**
 * For a hardcoded class, find the "nearest" token-derived class.
 *
 * Strategy:
 *   1. If the token has a numeric dimension value in px, pick the token whose
 *      px value is numerically closest to the hardcoded class's px value.
 *   2. Otherwise fall back to the first token of the same type.
 *
 * Returns null when no tokens of the matching type exist.
 */
function findNearestToken(
    cls: string,
    tokens: DesignToken[],
    prefix: string,
    type: TokenType
): string | null {
    const relevantTokens = tokens.filter((t) => t.token_type === type)
    if (relevantTokens.length === 0) return null

    const hardcodedPx = extractPxValue(cls)

    if (hardcodedPx !== null) {
        // Try to find the closest by numeric value.
        let bestToken: DesignToken | null = null
        let bestDiff = Infinity

        for (const tok of relevantTokens) {
            const tokPxMatch = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(tok.token_value.trim())
            if (tokPxMatch !== null) {
                const diff = Math.abs(parseFloat(tokPxMatch[1]) - hardcodedPx)
                if (diff < bestDiff) {
                    bestDiff = diff
                    bestToken = tok
                }
            }
        }

        if (bestToken !== null) {
            return tokenToClass(bestToken.token_path, bestToken.token_type, prefix)
        }
    }

    // Fallback: first token of the type.
    return tokenToClass(relevantTokens[0].token_path, relevantTokens[0].token_type, prefix)
}

// ── findHardcodedClasses ───────────────────────────────────────────────────────

export interface HardcodedEntry {
    /** The offending Tailwind class as written in the source. */
    hardcoded: string
    /** The nearest token-derived replacement, or null if unknown. */
    suggestion: string | null
}

/**
 * Parses a className string and returns every class that is hardcoded (i.e.
 * belongs to a tracked prefix family but is not in the current token set).
 */
export function findHardcodedClasses(
    className: string,
    tokens: DesignToken[]
): HardcodedEntry[] {
    if (!className) return []

    const classes = className.split(/\s+/).filter(Boolean)
    const results: HardcodedEntry[] = []

    // Build token sets once per unique (prefix, type) combination to avoid
    // rebuilding for every class.
    const tokenSetCache = new Map<string, Set<string>>()

    for (const cls of classes) {
        // Strip Tailwind variant prefixes (e.g. "hover:", "focus:", "dark:") before
        // matching the prefix catalogue, but keep the full class for display.
        const base = cls.replace(/^[a-z-]+:/, '')
        const entry = matchPrefix(base)
        if (entry === null) continue

        const cacheKey = `${entry.prefix}::${entry.type}`
        if (!tokenSetCache.has(cacheKey)) {
            tokenSetCache.set(cacheKey, buildTokenSet(tokens, entry.prefix, entry.type))
        }
        const tokenSet = tokenSetCache.get(cacheKey)!

        if (tokenSet.has(base)) continue // class is a valid token — not hardcoded

        const suggestion = findNearestToken(base, tokens, entry.prefix, entry.type)
        results.push({ hardcoded: cls, suggestion })
    }

    return results
}

// ── findSelectedLayerClassName ─────────────────────────────────────────────────

/**
 * Recursively walks a VisualLayer tree to find the className of the layer
 * whose ID matches `targetId`. Returns null when not found.
 */
function findLayerClassName(
    layers: import('../../core/ast-parser').VisualLayer[],
    targetId: string
): string | null {
    for (const layer of layers) {
        if (layer.id === targetId) return layer.className ?? null
        const found = findLayerClassName(layer.children, targetId)
        if (found !== null) return found
    }
    return null
}

// ── GhostOverlay ──────────────────────────────────────────────────────────────

/**
 * Floating overlay rendered as a React portal into document.body.
 *
 * Visibility conditions (all must be true):
 *   1. A node is selected (`selectedNodeId` is non-null).
 *   2. That node's className contains at least one hardcoded class.
 *   3. The user has not explicitly dismissed the card (resets on selection change).
 */
export function GhostOverlay() {
    const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
    const visualTree = useEditorStore((s) => s.visualTree)
    const tokens = useTokenStore((s) => s.tokens)
    const [dismissed, setDismissed] = useState(false)

    // Reset dismissal whenever the selection changes so a fresh node always
    // shows its overlay without requiring the user to re-open it manually.
    const [lastSeenId, setLastSeenId] = useState<string | null>(null)
    if (selectedNodeId !== lastSeenId) {
        setLastSeenId(selectedNodeId)
        if (dismissed) setDismissed(false)
    }

    // Bail early — no node selected or user dismissed.
    if (selectedNodeId === null || dismissed) return null

    const className = findLayerClassName(visualTree, selectedNodeId)
    if (className === null) return null

    const entries = findHardcodedClasses(className, tokens)
    if (entries.length === 0) return null

    return createPortal(
        // Backdrop: pointer-events none so drag interactions pass through.
        <div
            className="pointer-events-none fixed inset-0 z-[9000]"
            aria-hidden="true"
        >
            {/* Floating card — re-enables pointer-events for the dismiss button. */}
            <div
                className="pointer-events-auto absolute right-4 top-14 w-64 rounded-lg border border-amber-500/30 bg-zinc-900 shadow-xl"
                role="status"
                aria-label="Hardcoded value warnings for selected node"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                            Hardcoded Values
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        className="rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                        title="Dismiss"
                    >
                        <X size={12} />
                    </button>
                </div>

                {/* Node badge */}
                <div className="border-b border-zinc-800 px-3 py-1.5">
                    <span className="text-[10px] text-zinc-500">Node: </span>
                    <span className="font-mono text-[10px] text-zinc-400">{selectedNodeId}</span>
                </div>

                {/* Entries */}
                <ul className="max-h-52 overflow-y-auto px-3 py-2 space-y-1.5">
                    {entries.map((entry) => (
                        <li key={entry.hardcoded} className="flex flex-wrap items-center gap-1">
                            {/* Hardcoded class */}
                            <span className="font-mono text-[10px] text-amber-400 bg-amber-900/20 rounded px-1 py-0.5 border border-amber-500/30">
                                {entry.hardcoded}
                            </span>

                            {entry.suggestion !== null && (
                                <>
                                    {/* Arrow */}
                                    <span className="text-[10px] text-zinc-600" aria-label="replace with">
                                        →
                                    </span>
                                    {/* Nearest token suggestion */}
                                    <span className="font-mono text-[10px] text-indigo-400 bg-zinc-800 rounded px-1 py-0.5">
                                        {entry.suggestion}
                                    </span>
                                </>
                            )}

                            {entry.suggestion === null && (
                                <span className="text-[10px] text-zinc-600 italic">
                                    no token match
                                </span>
                            )}
                        </li>
                    ))}
                </ul>

                {/* Footer hint */}
                <div className="border-t border-zinc-800 px-3 py-1.5">
                    <p className="text-[10px] text-zinc-500 leading-tight">
                        Replace with the nearest token class to pass the Mithril gate.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    )
}
