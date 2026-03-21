/**
 * useAutopilot — src/hooks/useAutopilot.ts
 *
 * Phase REM.2.2: Governance Autopilot lifecycle hook.
 *
 * Responsibilities:
 *   - Calls `window.flintAPI.autopilot.enable(filePath)` when the autopilot
 *     flag is turned on and an active file is open.
 *   - Subscribes to `onResult` and stores the governed diff in canvasStore via
 *     `setGovernedResult` / `clearGovernedResult`.
 *   - Disables the autopilot and clears state on unmount or when the file changes.
 *
 * Process Boundary: no Node.js imports. All cross-boundary calls go through
 * `window.flintAPI.autopilot` (optional-chained for Vitest environments).
 */

import { useEffect } from 'react'
import { useCanvasStore } from '../store/canvasStore'

export function useAutopilot(): void {
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)
    const autopilotEnabled = useCanvasStore((s) => s.autopilotEnabled)
    const setGovernedResult = useCanvasStore((s) => s.setGovernedResult)
    const clearGovernedResult = useCanvasStore((s) => s.clearGovernedResult)

    useEffect(() => {
        if (!autopilotEnabled || !activeFilePath) {
            clearGovernedResult()
            return
        }

        const api = window.flintAPI?.autopilot
        if (!api) return

        void api.enable(activeFilePath)

        const unsub = api.onResult((result) => {
            if (result.filePath === activeFilePath && result.fixableCount > 0) {
                setGovernedResult(result.governedSource, result.fixableCount)
            } else {
                clearGovernedResult()
            }
        })

        return () => {
            unsub()
            void api.disable()
            clearGovernedResult()
        }
    }, [autopilotEnabled, activeFilePath, setGovernedResult, clearGovernedResult])
}
