/**
 * StatusBar — src/components/editor/StatusBar.tsx
 *
 * VS Code-style footer strip showing the active engine states so the UI
 * reflects the actual tech running under the hood.
 *
 * Includes the Module G SyncStatus chip on the right side.
 */

import { SyncStatus } from '../ui/SyncStatus'

export function StatusBar() {
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
            <span className="ml-auto">
                <SyncStatus />
            </span>
        </footer>
    )
}
