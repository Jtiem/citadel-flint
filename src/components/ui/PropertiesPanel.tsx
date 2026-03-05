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
import { Layers, AlertTriangle } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useTokenStore } from '../../store/tokenStore'
import type { LinterWarning } from '../../types/bridge-api'
import { ClassBuilder } from '../inspector/ClassBuilder'
import { LayoutPanel } from '../inspector/LayoutPanel'
import { DriftDetector } from '../inspector/DriftDetector'
import { MITHRIL_THRESHOLD } from '../../core/MithrilLinter'
import { tokenToClass } from '../../utils/classMapper'
import type { TokenType } from '../../types/bridge-api'
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

/**
 * Finds the full Tailwind class token (e.g. "bg-[#ef4343]") in `className`
 * that contains the given `hexColor` as its arbitrary value.
 * Returns null when no matching class is found.
 */
function findHardcodedClassForHex(className: string, hexColor: string): string | null {
    const lowerHex = hexColor.toLowerCase()
    return className.split(/\s+/).find((c) => c.toLowerCase().includes(`[${lowerHex}]`)) ?? null
}

/**
 * Extracts the Tailwind utility prefix from an arbitrary-value class.
 * e.g. "bg-[#ef4343]" → "bg-", "hover:text-[#fff]" → "text-" (strips variant).
 * Returns "" when the bracket index cannot be found.
 */
function extractClassPrefix(hardcodedClass: string): string {
    // Strip variant chain (hover:, focus:, etc.) to isolate the utility
    const utility = hardcodedClass.split(':').pop() ?? hardcodedClass
    const bracketIdx = utility.indexOf('[')
    return bracketIdx > 0 ? utility.slice(0, bracketIdx) : ''
}

// ── Mithril Perceptual Drift Badge + Violation Card ───────────────────────────

/** ΔE threshold for escalating amber → red (Critical Violation). */
const DRIFT_CRITICAL_THRESHOLD = 10.0

interface AmberPulseProps {
    deltaE: number
    tokenName: string
}

/**
 * Compact inline ΔE badge used inside `MithrilViolationCard`.
 * Amber for ΔE 2–10, Red for ΔE > 10.
 */
function AmberPulse({ deltaE, tokenName }: AmberPulseProps) {
    const isCritical = deltaE > DRIFT_CRITICAL_THRESHOLD
    return (
        <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                isCritical
                    ? 'border-red-700/60 bg-red-900/30 text-red-400'
                    : 'border-amber-700/60 bg-amber-900/30 text-amber-400'
            }`}
            title={`Perceptual Drift: ${deltaE.toFixed(1)}. Closest Token: ${tokenName}.`}
        >
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
            ΔE {deltaE.toFixed(1)}
        </span>
    )
}

interface MithrilViolationCardProps {
    deltaE: number
    tokenName: string
    /** Offending arbitrary-value hex colour, e.g. "#ef4343". */
    hexColor: string
    /** Closest token's hex value, e.g. "#ef4444". */
    tokenValue: string
    /** Called when the user clicks Auto-Fix. */
    onAutoFix: () => void
}

/**
 * Expanded violation card shown in the ClassBuilder header area when a
 * Mithril Violation is active.
 *
 * Displays:
 *   - Violation header with ΔE badge
 *   - Side-by-side colour swatches: current hex → nearest token hex + path
 *   - "Auto-Fix" button that calls back to replace the offending class via AST
 */
function MithrilViolationCard({ deltaE, tokenName, hexColor, tokenValue, onAutoFix }: MithrilViolationCardProps) {
    const isCritical = deltaE > DRIFT_CRITICAL_THRESHOLD
    const borderClass = isCritical ? 'border-red-900/50' : 'border-amber-900/50'
    const bgClass     = isCritical ? 'bg-red-950/20'     : 'bg-amber-950/20'
    const btnBorder   = isCritical ? 'border-red-700/50'  : 'border-amber-700/50'
    const btnBg       = isCritical ? 'bg-red-900/20 hover:bg-red-900/40'   : 'bg-amber-900/20 hover:bg-amber-900/40'
    const btnText     = isCritical ? 'text-red-300'       : 'text-amber-300'

    return (
        <div className={`flex flex-col gap-2 border-b ${borderClass} ${bgClass} px-3 py-2`}>
            {/* Header: icon + label + ΔE badge */}
            <div className="flex items-center gap-2">
                <AlertTriangle className={`h-3 w-3 shrink-0 ${isCritical ? 'text-red-400' : 'text-amber-400'}`} />
                <span className={`text-[10px] font-semibold ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>
                    Mithril Violation
                </span>
                <AmberPulse deltaE={deltaE} tokenName={tokenName} />
            </div>

            {/* Colour comparison: current hex → token hex + path */}
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <div
                    className="h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-700"
                    style={{ backgroundColor: hexColor }}
                    title={`Current: ${hexColor}`}
                />
                <span className="font-mono text-gray-500">{hexColor}</span>
                <span className="text-gray-700">→</span>
                <div
                    className="h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-700"
                    style={{ backgroundColor: tokenValue }}
                    title={`Token: ${tokenValue}`}
                />
                <span className="min-w-0 truncate font-mono text-gray-500" title={tokenName}>{tokenName}</span>
            </div>

            {/* Auto-Fix button */}
            <button
                type="button"
                onClick={onAutoFix}
                className={`w-full rounded border ${btnBorder} ${btnBg} ${btnText} py-0.5 text-[10px] font-medium transition-colors`}
            >
                Auto-Fix → {tokenName}
            </button>
        </div>
    )
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

    const getNearestToken = useTokenStore((s) => s.getNearestToken)
    const setMithrilViolations = useCanvasStore((s) => s.setMithrilViolations)
    const setOverridesExist = useCanvasStore((s) => s.setOverridesExist)
    const setLinterWarning = useEditorStore((s) => s.setLinterWarning)
    const clearLinterWarning = useEditorStore((s) => s.clearLinterWarning)

    const selectedLayer =
        effectiveId !== null
            ? findLayer(visualTree, effectiveId)
            : undefined

    // Track whether the ClassBuilder is in a Mithril Violation state locally.
    // This drives the amber glow on the wrapper.
    const [hasAmberViolation, setHasAmberViolation] = useState(false)
    // Full violation context — drives MithrilViolationCard and the Auto-Fix action.
    const [driftResult, setDriftResult] = useState<{
        deltaE: number
        tokenName: string
        tokenValue: string
        hexColor: string
        hardcodedClass: string
        tokenClass: string
    } | null>(null)

    /**
     * Checks the newly committed className for Mithril drift.
     *
     * For each arbitrary-value hex color found in `newClassName`, we find the
     * NEAREST token (minimum ΔE). A class is only a Mithril Violation if its
     * nearest token is still > 2.0 away — i.e. there is no perceptually close
     * token it could be replaced with. We report the worst offender so the
     * MithrilViolationCard can show the exact hex, target token, and ΔE, and
     * offer a one-click Auto-Fix.
     */
    const checkMithrilDrift = useCallback(
        (newClassName: string, nodeId: string) => {
            const arbitraryColors = extractArbitraryHexColors(newClassName)

            if (arbitraryColors.length === 0) {
                setHasAmberViolation(false)
                setDriftResult(null)
                setMithrilViolations([])
                return
            }

            // Find the worst-case nearest-token drift across all hex colors.
            // "Worst" = the color whose closest token is still farthest away.
            let worst: {
                deltaE: number
                tokenName: string
                tokenValue: string
                tokenType: string
                hexColor: string
            } | null = null

            for (const hexColor of arbitraryColors) {
                const result = getNearestToken(hexColor)
                if (result !== null && (worst === null || result.deltaE > worst.deltaE)) {
                    worst = {
                        deltaE: result.deltaE,
                        tokenName: result.tokenName,
                        tokenValue: result.tokenValue,
                        tokenType: result.tokenType,
                        hexColor,
                    }
                }
            }

            const isViolating = worst !== null && worst.deltaE > MITHRIL_THRESHOLD
            setHasAmberViolation(isViolating)

            if (isViolating && worst !== null) {
                // Build the Auto-Fix payload: find the exact class containing the
                // offending hex and derive the token replacement using classMapper.
                const hardcodedClass = findHardcodedClassForHex(newClassName, worst.hexColor) ?? worst.hexColor
                const prefix = extractClassPrefix(hardcodedClass)
                const tokenClass = prefix !== ''
                    ? tokenToClass(worst.tokenName, worst.tokenType as TokenType, prefix)
                    : worst.tokenName
                setDriftResult({
                    deltaE: worst.deltaE,
                    tokenName: worst.tokenName,
                    tokenValue: worst.tokenValue,
                    hexColor: worst.hexColor,
                    hardcodedClass,
                    tokenClass,
                })
                setMithrilViolations([nodeId])
                // Persist to the rich linterWarnings map so LayerTree, Export Gate,
                // and any future consumers have immediate pre-commit feedback.
                const severity: LinterWarning['severity'] = worst.deltaE > 10 ? 'critical' : 'amber'
                setLinterWarning(nodeId, {
                    id: nodeId,
                    type: 'drift',
                    severity,
                    value: worst.deltaE,
                    message: `ΔE ${worst.deltaE.toFixed(1)} – use ${worst.tokenName}`,
                    nearestToken: worst.tokenName,
                    nearestTokenValue: worst.tokenValue,
                })
            } else {
                setDriftResult(null)
                setMithrilViolations([])
                clearLinterWarning(nodeId)
            }
        },
        [getNearestToken, setMithrilViolations, setLinterWarning, clearLinterWarning]
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

    /**
     * Applies a one-click token fix via applyBatch, replacing the offending
     * arbitrary-value hex class with the closest design-token class.
     * Clears the violation state immediately — the hardcoded hex is gone.
     */
    function handleAutoFix(): void {
        if (effectiveId === null || driftResult === null) return
        startTransition(() => {
            applyBatch([{
                op: 'applyTokenFix',
                nodeId: effectiveId,
                hardcodedClass: driftResult.hardcodedClass,
                tokenClass: driftResult.tokenClass,
            }])
        })
        setHasAmberViolation(false)
        setDriftResult(null)
        setMithrilViolations([])
        clearLinterWarning(effectiveId)
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
                className={`flex flex-1 flex-col overflow-hidden transition-shadow duration-200 ${hasAmberViolation
                        ? 'ring-2 ring-inset ring-amber-500/70'
                        : ''
                    }`}
            >
                {/* Mithril Violation card — visible when drift > MITHRIL_THRESHOLD */}
                {driftResult !== null && (
                    <MithrilViolationCard
                        deltaE={driftResult.deltaE}
                        tokenName={driftResult.tokenName}
                        hexColor={driftResult.hexColor}
                        tokenValue={driftResult.tokenValue}
                        onAutoFix={handleAutoFix}
                    />
                )}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <ClassBuilder
                        className={selectedLayer.className ?? ''}
                        onCommit={handleCommit}
                    />
                </div>
            </div>

            {/* Soft Mithril drift detection */}
            <div className="shrink-0">
                <DriftDetector />
            </div>
        </div>
    )
}
