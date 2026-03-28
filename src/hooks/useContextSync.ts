/**
 * useContextSync — Writes Flint's live state to .flint/context.json
 * so the headless MCP server can read it via flint_get_context.
 *
 * Subscribes to canvasStore and editorStore, assembles a FlintContext
 * snapshot on every meaningful state change (debounced at 200 ms), and
 * calls window.flintAPI.syncContext. Fire-and-forget — returns nothing.
 *
 * Mount this hook once at the application root (e.g. App.tsx) so the
 * context file stays fresh throughout the session without any manual
 * orchestration by individual components.
 */

import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../store/canvasStore'
import { useEditorStore } from '../store/editorStore'
import { useGovernanceStore } from '../store/governanceStore'
import { useImportSummaryStore } from '../store/importSummaryStore'
import type { FlintContext } from '../types/flint-api'

/** Debounce interval in milliseconds. */
const DEBOUNCE_MS = 200

export function useContextSync(): void {
    // ── canvasStore slices ────────────────────────────────────────────────────
    const activeFilePath    = useCanvasStore((s) => s.activeFilePath)
    const saveState         = useCanvasStore((s) => s.saveState)
    const canvasMode        = useCanvasStore((s) => s.canvasMode)
    const mithrilViolations = useCanvasStore((s) => s.mithrilViolations)
    const a11yViolations    = useCanvasStore((s) => s.a11yViolations)
    const overridesExist    = useCanvasStore((s) => s.overridesExist)

    // ── editorStore slices ────────────────────────────────────────────────────
    const selectedNodeId   = useEditorStore((s) => s.selectedNodeId)
    // cursorPosition is declared in FlintContext but not yet tracked in editorStore
    const cursorPosition: { line: number; column: number } | null = null
    const linterWarnings   = useEditorStore((s) => s.linterWarnings)
    const rawCode          = useEditorStore((s) => s.rawCode)
    const visualTree       = useEditorStore((s) => s.visualTree)

    // ── ACX.5 extension: governance + import summary ──────────────────────────
    // These are optional fields — both stores are safe to read even when no
    // project is open. Graceful degradation: null when data is unavailable.
    const overrides        = useGovernanceStore((s) => s.overrides)
    const importSummary    = useImportSummaryStore((s) => s.summary)

    // ── LIB.1: Active library (read once on mount, refreshed on file change) ──
    const [selectedLibrary, setSelectedLibrary] = useState<string | null>(null)
    useEffect(() => {
        window.flintAPI?.scope?.getActiveLibrary?.()
            .then((result) => setSelectedLibrary(result.library))
            .catch(() => { /* non-fatal */ })
    }, [activeFilePath]) // re-read when active file changes (project may change)

    // Ref-based debounce timer — stable across re-renders, no state needed.
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        // Cancel any pending write from a previous render cycle.
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current)
        }

        timerRef.current = setTimeout(() => {
            timerRef.current = null

            // Guard: IPC flint may not be available in test environments.
            if (typeof window === 'undefined' || !window.flintAPI?.syncContext) return

            // ── Assemble violation summary from linterWarnings Map ────────────
            // linterWarnings is Map<flintId, LinterWarning>. We need counts
            // broken down by category and a deduplicated list of node IDs.
            const warnings = linterWarnings instanceof Map
                ? Array.from(linterWarnings.values())
                : []

            const mithrilTypes = new Set([
                'color-drift', 'typography-drift', 'spacing-drift',
                'shadow-drift', 'opacity-drift', 'semantic-drift',
                'sync', 'inline-style-drift', 'registry',
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

            // ── ACX.5: Derive overrideCount from governanceStore ──────────────
            // Count only rules that have an explicit override (enabled=false
            // or severity changed). Active overrides signal governance posture
            // to the MCP server so agents can factor them into recommendations.
            const overrideCount = Object.keys(overrides).length

            // ── ACX.5: Derive importSummary from importSummaryStore ───────────
            // Only populated when a Figma /ingest-ast heal pass has occurred in
            // this session. Null otherwise — graceful degradation is safe.
            const importSummarySnapshot = importSummary
                ? {
                    tier1Fixed: importSummary.tier1Fixed.length,
                    tier2Flagged: importSummary.tier2Flagged.length,
                    tier3Unknown: importSummary.tier3Unknown,
                }
                : null

            // ── ACX.5: sourceExcerpt — first 200 lines of the active file ─────
            // Provides agents immediate source context without a flint_read_code
            // call. Derived synchronously from editorStore.rawCode.
            const sourceExcerpt: string | null = rawCode
                ? rawCode.split('\n').slice(0, 200).join('\n')
                : null

            // ── ACX.5: selectedNodeSummary — descriptor of the selected node ──
            // Walks the visualTree to find the selected node and its parent.
            // Returns null when no node is selected or the node is not found.
            let selectedNodeSummary: FlintContext['selectedNodeSummary'] = null
            if (selectedNodeId && visualTree.length > 0) {
                // Flatten the tree to locate node + parent in one pass.
                type LayerEntry = { layer: { id: string; tagName: string; className?: string; props?: Record<string, string | boolean>; children: typeof visualTree }; parentId: string | null }
                const stack: LayerEntry[] = visualTree.map((l) => ({ layer: l, parentId: null }))
                while (stack.length > 0) {
                    const entry = stack.pop()!
                    if (entry.layer.id === selectedNodeId) {
                        // Map props to string values only (exclude boolean props and flint-id).
                        const rawProps = entry.layer.props ?? {}
                        const stringProps: Record<string, string> = {}
                        for (const [k, v] of Object.entries(rawProps)) {
                            if (k !== 'data-flint-id' && typeof v === 'string') {
                                stringProps[k] = v
                            }
                        }
                        selectedNodeSummary = {
                            tagName: entry.layer.tagName,
                            flintId: entry.layer.id,
                            className: entry.layer.className ?? null,
                            props: stringProps,
                            childCount: entry.layer.children.length,
                            parentId: entry.parentId,
                        }
                        break
                    }
                    for (const child of entry.layer.children) {
                        stack.push({ layer: child, parentId: entry.layer.id })
                    }
                }
            }

            // ── ACX.5: violationSnapshot — structured export gate summary ─────
            // Derives exportBlocked and reason from the same sources as canExport().
            // Conservative: treats unknown policy state as blocking.
            const totalViolations = mithrilCount + a11yCount
            const mithrilBlocks = mithrilViolations.length > 0
            const a11yBlocks = Object.keys(a11yViolations).length > 0
            const exportBlockedByViolations = mithrilBlocks || a11yBlocks || overridesExist
            const exportBlockReason = exportBlockedByViolations
                ? [
                    mithrilBlocks ? `${mithrilViolations.length} Mithril violation(s)` : null,
                    a11yBlocks ? `${Object.keys(a11yViolations).length} accessibility violation(s)` : null,
                    overridesExist ? 'active component overrides' : null,
                  ].filter(Boolean).join(', ')
                : null

            const violationSnapshot: FlintContext['violationSnapshot'] = {
                total: totalViolations,
                criticalCount,
                exportBlocked: exportBlockedByViolations,
                exportBlockReason,
            }

            const ctx: FlintContext = {
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
                // ACX.5 extension fields — optional, backward compatible
                healthScore: null,
                healthGrade: null,
                overrideCount,
                importSummary: importSummarySnapshot,
                // ACX.5 new enriched fields
                sourceExcerpt,
                selectedNodeSummary,
                violationSnapshot,
                // Strategy 2/4: session persona (set by MCP prompt layer, null until classified)
                sessionPersona: null,
                // LIB.1: Active library selection
                selectedLibrary,
            }

            void window.flintAPI.syncContext(ctx)
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
        overridesExist,
        selectedNodeId,
        cursorPosition,
        linterWarnings,
        rawCode,
        visualTree,
        overrides,
        importSummary,
        selectedLibrary,
    ])
}
