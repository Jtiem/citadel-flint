/**
 * PropertiesPanel — src/components/ui/PropertiesPanel.tsx
 *
 * Displays structured, token-aware property controls for the currently selected
 * VisualLayer. The raw className `<input>` has been replaced by `<ClassBuilder>`,
 * which presents categorised dropdown rows (Layout, Typography, Appearance) whose
 * options are populated exclusively from the design token store.
 *
 * Phase C.5 addition: NodeProperties — a read-only AST property grid shown above
 * the ClassBuilder. It reads className, style, and textContent directly from the
 * VisualLayer derived from the Babel AST. The active selection source is
 * canvasStore.activeSelection (set on CANVAS_CLICK) with a fallback to
 * editorStore.selectedNodeId (set by the Layer Tree).
 *
 * Phase E addition: Property Mutation Wiring + Soft Mithril Amber Warning.
 *
 *   - All className commits now route through `editorStore.applyBatch()` so they
 *     are recorded in the undo/redo history store (Phase D).
 *   - After each commit, `MithrilLinter.calculateDrift` compares each color-related
 *     class in the new className against the closest design token. If _any_ class
 *     produces a ΔE > 2.0 (a "Mithril Violation"), the ClassBuilder wrapper glows
 *     Amber and the violation bridge ID is registered in canvasStore.
 *   - textContent and style props are also now writable via `applyBatch`, replacing
 *     the old read-only PropRow display for those two fields.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState, useCallback, startTransition } from 'react'
import { Layers } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useTokenStore } from '../../store/tokenStore'
import { ClassBuilder } from '../inspector/ClassBuilder'
import { LayoutPanel } from '../inspector/LayoutPanel'
import { DriftDetector } from '../inspector/DriftDetector'
import { calculateDrift, MITHRIL_THRESHOLD } from '../../core/MithrilLinter'
import type { VisualLayer } from '../../core/ast-parser'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively searches the visual tree for a layer matching `id`. */
function findLayer(
    layers: VisualLayer[],
    id: string
): VisualLayer | undefined {
    for (const layer of layers) {
        if (layer.id === id) return layer
        const found = findLayer(layer.children, id)
        if (found !== undefined) return found
    }
    return undefined
}

/**
 * Extracts all hex-like color values from a Tailwind className string.
 * Looks for arbitrary-value color classes like `bg-[#6366f1]` or `text-[#fff]`.
 * Used to check for Mithril drift after a commit.
 */
function extractArbitraryHexColors(className: string): string[] {
    const colors: string[] = []
    // Match patterns like bg-[#abc], text-[#aabbcc], border-[#abc123]
    const re = /\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(className)) !== null) {
        colors.push(`#${m[1]}`)
    }
    return colors
}

// ── Read-only / Editable property row ─────────────────────────────────────────

interface EditablePropRowProps {
    label: string
    value: string
    onCommit: (newValue: string) => void
}

function EditablePropRow({ label, value, onCommit }: EditablePropRowProps) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            onCommit(draft)
            setEditing(false)
        } else if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
        }
    }

    return (
        <div className="flex flex-col gap-0.5 px-3 py-1.5">
            <span className="text-[9px] font-medium uppercase tracking-wider text-gray-600">
                {label}
            </span>
            {editing ? (
                <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => {
                        onCommit(draft)
                        setEditing(false)
                    }}
                    onKeyDown={handleKeyDown}
                    className="break-all rounded border border-indigo-500/50 bg-gray-800/80 px-1.5 py-0.5 font-mono text-[11px] leading-tight text-gray-100 outline-none"
                />
            ) : (
                <span
                    className="break-all cursor-text font-mono text-[11px] leading-tight text-gray-300 hover:text-white"
                    title="Click to edit"
                    onClick={() => {
                        setDraft(value)
                        setEditing(true)
                    }}
                >
                    {value || <span className="text-gray-600 italic">empty</span>}
                </span>
            )}
        </div>
    )
}

// ── Node properties grid ───────────────────────────────────────────────────────

interface NodePropertiesProps {
    layer: VisualLayer
    nodeId: string
    onCommitStyle: (value: string) => void
    onCommitText: (value: string) => void
}

function NodeProperties({ layer, onCommitStyle, onCommitText }: NodePropertiesProps) {
    const hasAnyProp =
        layer.className !== undefined ||
        layer.style !== undefined ||
        layer.textContent !== undefined

    if (!hasAnyProp) {
        return (
            <div className="px-3 py-2 text-[11px] text-gray-600">
                No readable props on this element.
            </div>
        )
    }

    return (
        <div className="flex flex-col divide-y divide-gray-800/60">
            {layer.className !== undefined && (
                <div className="flex flex-col gap-0.5 px-3 py-1.5">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-gray-600">
                        className
                    </span>
                    <span className="break-all font-mono text-[11px] leading-tight text-gray-400">
                        {layer.className}
                    </span>
                </div>
            )}
            {layer.style !== undefined && (
                <EditablePropRow
                    label="style"
                    value={layer.style}
                    onCommit={onCommitStyle}
                />
            )}
            {layer.textContent !== undefined && (
                <EditablePropRow
                    label="text"
                    value={layer.textContent}
                    onCommit={onCommitText}
                />
            )}
        </div>
    )
}

// ── PropertiesPanel ───────────────────────────────────────────────────────────

export function PropertiesPanel() {
    // Canvas selection (from CANVAS_CLICK) takes precedence; Layer Tree selection
    // (editorStore.selectedNodeId) is the fallback for keyboard/tree-row selection.
    const activeSelection = useCanvasStore((s) => s.activeSelection)
    const selectedNodeId = useEditorStore((state) => state.selectedNodeId)
    const effectiveId = activeSelection ?? selectedNodeId

    const visualTree = useEditorStore((state) => state.visualTree)
    const applyBatch = useEditorStore((state) => state.applyBatch)

    const tokens = useTokenStore((s) => s.tokens)
    const setMithrilViolations = useCanvasStore((s) => s.setMithrilViolations)
    const setOverridesExist = useCanvasStore((s) => s.setOverridesExist)

    const selectedLayer =
        effectiveId !== null
            ? findLayer(visualTree, effectiveId)
            : undefined

    // Track whether the ClassBuilder is in a Mithril Violation state locally.
    // This drives the amber glow on the wrapper.
    const [hasAmberViolation, setHasAmberViolation] = useState(false)

    /**
     * Checks the newly committed className for Mithril drift.
     * If any arbitrary color class has ΔE > 2.0 against the token store,
     * marks this node as a violator and glows Amber.
     */
    const checkMithrilDrift = useCallback(
        (newClassName: string, nodeId: string) => {
            const arbitraryColors = extractArbitraryHexColors(newClassName)

            // Find the closest token value for each arbitrary color and check drift.
            const isViolating = arbitraryColors.some((hexColor) => {
                // Find the best-matching color token
                const colorTokens = tokens.filter((t) => t.token_type === 'color')
                for (const token of colorTokens) {
                    const dE = calculateDrift(hexColor, token.token_value)
                    if (dE !== null && dE > MITHRIL_THRESHOLD) {
                        return true
                    }
                }
                return false
            })

            setHasAmberViolation(isViolating)

            // Propagate to global Export Gate
            if (isViolating) {
                setMithrilViolations([nodeId])
            } else {
                setMithrilViolations([])
            }
        },
        [tokens, setMithrilViolations]
    )

    /**
     * Commits a className change via applyBatch (routes through historyStore).
     * The AST re-render is wrapped in startTransition so React keeps the UI
     * responsive; the Mithril drift check runs synchronously outside it.
     */
    function handleCommit(newClassName: string): void {
        if (effectiveId === null) return
        startTransition(() => {
            applyBatch([{ op: 'updateClassName', nodeId: effectiveId, className: newClassName }])
        })
        checkMithrilDrift(newClassName, effectiveId)
    }

    /** Commits a style prop change via applyBatch and marks the node as overridden. */
    function handleStyleCommit(value: string): void {
        if (effectiveId === null) return
        startTransition(() => {
            applyBatch([{ op: 'updateProp', nodeId: effectiveId, propName: 'style', value }])
        })
        // Optimistic update — Export Gate blocks immediately; IPC confirms async.
        setOverridesExist(true)
        if (typeof window !== 'undefined') {
            void window.bridgeAPI.tokens.upsertOverride?.(effectiveId, 'style', value)
        }
    }

    /** Commits a textContent change via applyBatch and marks the node as overridden. */
    function handleTextCommit(value: string): void {
        if (effectiveId === null) return
        startTransition(() => {
            applyBatch([{ op: 'updateProp', nodeId: effectiveId, propName: 'textContent', value }])
        })
        // Optimistic update — Export Gate blocks immediately; IPC confirms async.
        setOverridesExist(true)
        if (typeof window !== 'undefined') {
            void window.bridgeAPI.tokens.upsertOverride?.(effectiveId, 'textContent', value)
        }
    }

    if (effectiveId === null || selectedLayer === undefined) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
                <Layers className="h-8 w-8 text-gray-700" />
                <span className="text-center text-xs text-gray-600">
                    Select a layer to inspect its properties
                </span>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col gap-0">
            {/* Header */}
            <div className="flex shrink-0 items-baseline gap-2 border-b border-gray-800 px-3 py-2">
                <span className="font-mono text-xs font-semibold text-gray-200">
                    &lt;{selectedLayer.tagName}&gt;
                </span>
                <span className="text-xs text-gray-600">
                    line {selectedLayer.line}
                </span>
            </div>

            {/* Read-only / Editable AST property grid */}
            <div className="shrink-0 border-b border-gray-800/60">
                <div className="px-3 pb-1 pt-2">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-gray-600">
                        Node Properties
                    </span>
                </div>
                <NodeProperties
                    layer={selectedLayer}
                    nodeId={effectiveId}
                    onCommitStyle={handleStyleCommit}
                    onCommitText={handleTextCommit}
                />
            </div>

            {/* Auto Layout controls */}
            <div className="shrink-0">
                <LayoutPanel
                    className={selectedLayer.className ?? ''}
                    onChange={handleCommit}
                />
            </div>

            {/* Token-driven class builder — Amber glow on Mithril Violation */}
            <div
                className={`flex-1 overflow-y-auto transition-shadow duration-200 ${hasAmberViolation
                        ? 'ring-2 ring-inset ring-amber-500/70'
                        : ''
                    }`}
            >
                <ClassBuilder
                    className={selectedLayer.className ?? ''}
                    onCommit={handleCommit}
                />
            </div>

            {/* Soft Mithril drift detection */}
            <div className="shrink-0">
                <DriftDetector />
            </div>
        </div>
    )
}
