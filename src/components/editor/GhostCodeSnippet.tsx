/**
 * GhostCodeSnippet — src/components/editor/GhostCodeSnippet.tsx
 *
 * Floating code-snippet overlay that appears whenever a canvas node is
 * selected. Shows the relevant JSX source lines for the selected node,
 * extracted from the live rawCode in editorStore via the node's 1-based
 * line number (encoded in the selectedNodeId format "tagName:line:col").
 *
 * Design decisions:
 *   - Rendered as a React portal into document.body so parent overflow:hidden
 *     cannot clip the card (mirrors GhostOverlay pattern).
 *   - pointer-events:none on the backdrop; the card itself re-enables them.
 *   - No Monaco / CodeMirror — CSS-class-based keyword highlighting only.
 *   - Dismisses on Escape or explicit close button; resets on node change.
 *   - Shows CONTEXT_LINES lines around the node's opening tag.
 *   - Header shows the active file path and line number.
 *
 * Mithril Safety: all colour classes use Bridge design token palette.
 * No hardcoded hex values. No arbitrary spacing.
 */

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Code2, X } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Lines of context rendered above and below the target line. */
const CONTEXT_LINES = 4

// ── Lightweight syntax highlighter ────────────────────────────────────────────

/**
 * Token types for the miniature syntax highlighter.
 * Only the token kinds visible in typical JSX snippets are covered.
 */
interface Token {
    kind:
        | 'keyword'
        | 'jsx-tag'
        | 'jsx-attr'
        | 'string'
        | 'comment'
        | 'brace'
        | 'plain'
    text: string
}

/**
 * Tokenises a single source line into a flat sequence of typed tokens.
 * Uses simple sequential regex matching — deliberately not a full parser.
 * The order of patterns matters: earlier patterns take precedence.
 */
function tokeniseLine(line: string): Token[] {
    const tokens: Token[] = []
    let remaining = line

    const patterns: Array<[RegExp, Token['kind']]> = [
        // Single-line comments
        [/^\/\/.*/, 'comment'],
        // Strings (single or double-quoted, non-greedy)
        [/^"[^"]*"|^'[^']*'/, 'string'],
        // JSX tag names (opening or closing, e.g. <div, </div, />)
        [/^<\/?[A-Za-z][A-Za-z0-9.]*/, 'jsx-tag'],
        // JSX self-close or close angle
        [/^\/?>/, 'jsx-tag'],
        // JSX attribute names (word chars before an '=')
        [/^[a-zA-Z][a-zA-Z0-9-]*(?=\s*=)/, 'jsx-attr'],
        // JS keywords
        [/^(?:import|export|default|function|const|let|var|return|from|type|interface|extends|class|new|if|else|for|while|of|in|typeof|async|await)\b/, 'keyword'],
        // Braces / brackets
        [/^[{}[\]()]/, 'brace'],
        // Anything else: grab up to the next special character
        [/^[^<>{}[\]()"'/\s]+/, 'plain'],
        // Whitespace
        [/^\s+/, 'plain'],
        // Fallback: advance one character to prevent infinite loops
        [/^./, 'plain'],
    ]

    while (remaining.length > 0) {
        let matched = false
        for (const [re, kind] of patterns) {
            const m = re.exec(remaining)
            if (m !== null) {
                tokens.push({ kind, text: m[0] })
                remaining = remaining.slice(m[0].length)
                matched = true
                break
            }
        }
        if (!matched) {
            tokens.push({ kind: 'plain', text: remaining[0] })
            remaining = remaining.slice(1)
        }
    }

    return tokens
}

/** Maps a token kind to a Tailwind text colour class from the Bridge palette. */
function tokenClass(kind: Token['kind']): string {
    switch (kind) {
        case 'keyword':   return 'text-indigo-400'
        case 'jsx-tag':   return 'text-emerald-400'
        case 'jsx-attr':  return 'text-amber-400'
        case 'string':    return 'text-emerald-400'
        case 'comment':   return 'text-zinc-500'
        case 'brace':     return 'text-zinc-400'
        case 'plain':
        default:          return 'text-zinc-300'
    }
}

// ── HighlightedLine ────────────────────────────────────────────────────────────

interface HighlightedLineProps {
    line: string
    isTarget: boolean
    lineNumber: number
}

function HighlightedLine({ line, isTarget, lineNumber }: HighlightedLineProps) {
    const tokens = tokeniseLine(line)

    return (
        <div
            className={`flex min-w-0 ${isTarget ? 'bg-indigo-600/20' : ''}`}
            aria-current={isTarget ? 'true' : undefined}
        >
            {/* Gutter line number */}
            <span
                className={`shrink-0 select-none pr-3 text-right font-mono text-[10px] ${
                    isTarget ? 'text-indigo-400' : 'text-zinc-600'
                }`}
                style={{ minWidth: '2.5rem' }}
                aria-hidden="true"
            >
                {lineNumber}
            </span>

            {/* Highlighted token spans */}
            <span className="flex-1 overflow-hidden font-mono text-[10px] leading-relaxed">
                {tokens.map((tok, i) => (
                    <span key={i} className={tokenClass(tok.kind)}>
                        {tok.text}
                    </span>
                ))}
            </span>
        </div>
    )
}

// ── Source extraction ──────────────────────────────────────────────────────────

/**
 * Parses the 1-based target line number out of a Bridge selectedNodeId.
 * Format: "tagName:line:col", e.g. "div:12:4".
 * Returns null when the id does not match the expected format.
 */
export function parseLineFromNodeId(nodeId: string): number | null {
    const parts = nodeId.split(':')
    if (parts.length < 2) return null
    const line = parseInt(parts[1], 10)
    return Number.isFinite(line) && line > 0 ? line : null
}

/**
 * Extracts a window of lines from the full source, centred on `targetLine`.
 * Returns the extracted lines, the 1-based start line index, and the
 * 0-based offset of the target within the returned lines array.
 */
export function extractSourceContext(
    rawCode: string,
    targetLine: number,
    context = CONTEXT_LINES
): { lines: string[]; startLine: number; targetOffset: number } {
    const allLines = rawCode.split('\n')
    const totalLines = allLines.length

    // Convert to 0-based index.
    const zeroIdx = targetLine - 1
    const from = Math.max(0, zeroIdx - context)
    const to = Math.min(totalLines - 1, zeroIdx + context)

    return {
        lines: allLines.slice(from, to + 1),
        startLine: from + 1,           // back to 1-based
        targetOffset: zeroIdx - from,
    }
}

// ── GhostCodeSnippet ──────────────────────────────────────────────────────────

/**
 * Floating code snippet card.
 *
 * Visibility conditions (all must be true):
 *   1. A node is selected in editorStore (`selectedNodeId` non-null).
 *   2. We can parse a valid line number from the selectedNodeId.
 *   3. rawCode is non-empty.
 *   4. The user has not explicitly dismissed the card.
 */
export function GhostCodeSnippet() {
    const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
    const rawCode        = useEditorStore((s) => s.rawCode)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    const [dismissed, setDismissed] = useState(false)

    // Track the last-seen node id to reset dismissal on selection change.
    const [lastSeenId, setLastSeenId] = useState<string | null>(null)
    if (selectedNodeId !== lastSeenId) {
        setLastSeenId(selectedNodeId)
        if (dismissed) setDismissed(false)
    }

    // Dismiss on Escape key.
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') setDismissed(true)
    }, [])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    // Guard: nothing to show.
    if (!selectedNodeId || dismissed || !rawCode) return null

    const targetLine = parseLineFromNodeId(selectedNodeId)
    if (targetLine === null) return null

    const { lines, startLine, targetOffset } = extractSourceContext(rawCode, targetLine)

    // Derive a short display label from the file path.
    const fileLabel = activeFilePath
        ? activeFilePath.split('/').slice(-2).join('/')
        : 'unknown file'

    // The tag name is the first segment of the node id.
    const tagLabel = selectedNodeId.split(':')[0] ?? 'element'

    return createPortal(
        <div
            className="pointer-events-none fixed inset-0 z-[9000]"
            aria-hidden="true"
        >
            <div
                className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 w-[480px] rounded-lg border border-zinc-700/50 bg-zinc-900/90 shadow-2xl backdrop-blur-sm"
                role="complementary"
                aria-label={`Source snippet for ${tagLabel}`}
                data-testid="ghost-code-snippet"
            >
                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Code2 size={12} className="text-indigo-400 shrink-0" />
                        <span className="font-mono text-[10px] text-zinc-400 truncate">
                            {fileLabel}
                        </span>
                        <span className="text-[10px] text-zinc-600">·</span>
                        <span className="text-[10px] text-indigo-400 shrink-0">
                            line {targetLine}
                        </span>
                        <span className="text-[10px] text-zinc-600">·</span>
                        <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                            &lt;{tagLabel}&gt;
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        className="shrink-0 rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100 ml-2"
                        title="Dismiss snippet (Esc)"
                        aria-label="Dismiss code snippet"
                    >
                        <X size={12} />
                    </button>
                </div>

                {/* ── Code block ────────────────────────────────────────── */}
                <div
                    className="max-h-52 overflow-y-auto overflow-x-auto px-0 py-1.5"
                    data-testid="ghost-code-snippet-body"
                >
                    <pre className="m-0 p-0" aria-label="Source code context">
                        {lines.map((line, i) => (
                            <HighlightedLine
                                key={startLine + i}
                                line={line}
                                lineNumber={startLine + i}
                                isTarget={i === targetOffset}
                            />
                        ))}
                    </pre>
                </div>

                {/* ── Footer hint ───────────────────────────────────────── */}
                <div className="border-t border-zinc-800 px-3 py-1.5">
                    <p className="text-[10px] text-zinc-500 leading-tight">
                        Press <kbd className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-400">Esc</kbd> to dismiss.
                        Deselecting the node also closes this panel.
                    </p>
                </div>
            </div>
        </div>,
        document.body
    )
}
