/**
 * useContextSync — Writes Bridge's live state to .bridge/context.json
 * so the headless MCP server can read it via bridge_get_context.
 *
 * Subscribes to canvasStore and editorStore, assembles a BridgeContext
 * snapshot on every meaningful state change (debounced at 200 ms), and
 * calls window.bridgeAPI.syncContext. Fire-and-forget — returns nothing.
 *
 * Mount this hook once at the application root (e.g. App.tsx) so the
 * context file stays fresh throughout the session without any manual
 * orchestration by individual components.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useEditorStore } from '../store/editorStore'
import type { BridgeContext } from '../types/bridge-api'

/** Debounce interval in milliseconds. */
const DEBOUNCE_MS = 200

export function useContextSync(): void {
    // ── canvasStore slices ────────────────────────────────────────────────────
    const activeFilePath   = useCanvasStore((s) => s.activeFilePath)
    const saveState        = useCanvasStore((s) => s.saveState)
    const canvasMode       = useCanvasStore((s) => s.canvasMode)
    const mithrilViolations = useCanvasStore((s) => s.mithrilViolations)
    const a11yViolations   = useCanvasStore((s) => s.a11yViolations)

    // ── editorStore slices ────────────────────────────────────────────────────
    const selectedNodeId   = useEditorStore((s) => s.selectedNodeId)
    const cursorPosition   = useEditorStore((s) => s.cursorPosition)
    const linterWarnings   = useEditorStore((s) => s.linterWarnings)

    // Ref-based debounce timer — stable across re-renders, no state needed.
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        // Cancel any pending write from a previous render cycle.
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current)
        }

        timerRef.current = setTimeout(() => {
            timerRef.current = null

            // Guard: IPC bridge may not be available in test environments.
            if (typeof window === 'undefined' || !window.bridgeAPI?.syncContext) return

            // ── Assemble violation summary from linterWarnings Map ────────────
            // linterWarnings is Map<bridgeId, LinterWarning>. We need counts
            // broken down by category and a deduplicated list of node IDs.
            const warnings = linterWarnings instanceof Map
                ? Array.from(linterWarnings.values())
                : []

            const mithrilTypes = new Set([
                'color-drift', 'typography-drift', 'spacing-drift',
                'shadow-drift', 'opacity-drift', 'semantic-drift',
            ])
            const a11yTypes = new Set(['a11y'])

            let mithrilCount = 0
            let a11yCount = 0
            let criticalCount = 0
            const violatingNodeIds = new Set<string>()

            for (const w of warnings) {
                if (mithrilTypes.has(w.type)) mithrilCount++
                if (a11yTypes.has(w.type)) a11yCount++
                if (w.severity === 'critical') criticalCount++
                if (w.id) violatingNodeIds.add(w.id)
            }

            // ── Derive openFiles from mithrilViolations / activeFilePath ─────
            // canvasStore tracks open files in openFiles or via activeFilePath.
            // We prefer canvasStore.openFiles when available; fall back to
            // wrapping activeFilePath in an array so the field is never empty.
            const openFiles: string[] = activeFilePath ? [activeFilePath] : []

            const ctx: BridgeContext = {
                timestamp: Date.now(),
                activeFile: activeFilePath ?? null,
                selectedNodeId: selectedNodeId ?? null,
                cursorPosition: cursorPosition ?? null,
                violations: {
                    mithrilCount,
                    a11yCount,
                    criticalCount,
                    nodeIds: Array.from(violatingNodeIds),
                },
                saveState,
                canvasMode,
                openFiles,
            }

            void window.bridgeAPI.syncContext(ctx)
        }, DEBOUNCE_MS)

        // Cleanup: cancel the pending timer if the component unmounts or
        // if any dependency changes before the debounce fires.
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }
    }, [
        activeFilePath,
        saveState,
        canvasMode,
        mithrilViolations,
        a11yViolations,
        selectedNodeId,
        cursorPosition,
        linterWarnings,
    ])
}
