/**
 * StatusBar — src/components/editor/StatusBar.tsx
 *
 * VS Code-style footer strip showing the active engine states so the UI
 * reflects the actual tech running under the hood.
 *
 * Phase B addition: Export Gate chip.
 *   - Reads `mithrilViolations` + `overridesExist` from canvasStore.
 *   - Shows a green "Export Ready" shield when the file is clean.
 *   - Shows an amber "N Mithril Violation(s)" chip when ΔE violations exist.
 *   - Shows an amber "Overrides Active" chip when component_overrides is dirty.
 *   - The Export Gate is the UI surface for Commandment 6 (The Gatekeeper Rule).
 */

import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import { SyncStatus } from '../ui/SyncStatus'

export function StatusBar() {
    const mithrilViolations = useCanvasStore((s) => s.mithrilViolations)
    const overridesExist = useCanvasStore((s) => s.overridesExist)
    const canExport = mithrilViolations.length === 0 && !overridesExist

    const gateLabel = (() => {
        if (canExport) return null
        if (mithrilViolations.length > 0) {
            return `${mithrilViolations.length} Mithril Violation${mithrilViolations.length > 1 ? 's' : ''}`
        }
        return 'Overrides Active'
    })()

    return (
        <footer className="flex shrink-0 items-center gap-6 border-t border-gray-800 bg-gray-950 px-4 py-[3px]">
            <span className="text-xs text-gray-500">
                🟢 Local SQLite (better-sqlite3)
            </span>
            <span className="text-xs text-gray-500">
                ⚡ Babel AST Parser Active
            </span>
            <span className="text-xs text-gray-500">
                🔗 Electron IPC Bridge
            </span>

            {/* Export Gate — Commandment 6 (The Gatekeeper Rule) */}
            <span
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                    canExport ? 'text-emerald-500' : 'text-amber-400'
                }`}
                title={
                    canExport
                        ? 'No Mithril violations or overrides — file is export-ready'
                        : `Export blocked: ${gateLabel}`
                }
            >
                {canExport ? (
                    <>
                        <ShieldCheck className="h-3 w-3" />
                        Export Ready
                    </>
                ) : (
                    <>
                        <ShieldAlert className="h-3 w-3" />
                        {gateLabel}
                    </>
                )}
            </span>

            <span className="ml-auto">
                <SyncStatus />
            </span>
        </footer>
    )
}
