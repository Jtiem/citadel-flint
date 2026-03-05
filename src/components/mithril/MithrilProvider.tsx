/**
 * MithrilProvider — src/components/mithril/MithrilProvider.tsx
 *
 * Headless enforcement boundary for the Soft Mithril Safety Layer (Module B).
 *
 * On every AST change the provider runs the full Mithril safety audit across
 * ALL design system dimensions — color, typography, spacing, shadow, opacity —
 * and updates `canvasStore.mithrilViolations` and `editorStore.linterWarnings`.
 *
 * This keeps the Export Gate accurate continuously — not just when the user
 * opens the Properties Panel for a specific node and commits a class change.
 *
 * ## Algorithm
 *   1. Subscribe to `editorStore.ast` + `tokenStore.tokens`.
 *   2. On change, call `scanArbitraryColors(ast)` to collect every
 *      hardcoded hex class across all JSX nodes in the file.
 *   3. For each candidate, call `findClosestToken(rawValue, colorTokens)`
 *      to get the CIEDE2000 ΔE against the nearest design token.
 *   4. Any candidate with ΔE > `SYSTEMIZABLE_THRESHOLD` (2.0) is a
 *      "Mithril Violation". Its nodeId is added to the violation set.
 *   5. Write the deduplicated set to `canvasStore.setMithrilViolations`.
 *
 * ## Abort conditions (clears violations)
 *   - `ast` is null (no code loaded or last parse failed).
 *   - Token store has no colour tokens (nothing to compare against).
 *
 * Renderer Process only — no Node.js imports.
 * Adds no DOM nodes — renders children directly.
 */

import { useEffect, type ReactNode } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useTokenStore } from '../../store/tokenStore'
import { useCanvasStore } from '../../store/canvasStore'
import { auditAll } from '../../core/MithrilLinter'

interface MithrilProviderProps {
    children: ReactNode
}

export function MithrilProvider({ children }: MithrilProviderProps) {
    const ast = useEditorStore((s) => s.ast)
    const tokens = useTokenStore((s) => s.tokens)
    const setMithrilViolations = useCanvasStore((s) => s.setMithrilViolations)
    const setLinterWarnings = useEditorStore((s) => s.setLinterWarnings)
    const clearAllLinterWarnings = useEditorStore((s) => s.clearAllLinterWarnings)

    useEffect(() => {
        // No AST loaded — clear any stale violations from the previous file.
        if (ast === null) {
            clearAllLinterWarnings()
            setMithrilViolations([])
            return
        }

        // auditAll runs all 5 Mithril visitors: color, typography, spacing,
        // shadow, and opacity. Each returns a Map<bridgeId, LinterWarning>;
        // auditAll merges them with color violations taking priority.
        const warnings = auditAll(ast, tokens)

        // Populate the rich linterWarnings map (single source of truth).
        setLinterWarnings(warnings)

        // Keep canvasStore.mithrilViolations in sync for the Export Gate and
        // LayerTree AlertTriangle indicators (both read the string[] form).
        setMithrilViolations([...warnings.keys()])
    }, [ast, tokens, setMithrilViolations, setLinterWarnings, clearAllLinterWarnings])

    // MithrilProvider is purely a side-effect boundary — it adds no DOM nodes.
    return <>{children}</>
}
