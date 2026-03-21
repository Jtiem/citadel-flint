/**
 * RecoveryPanel — src/components/ui/RecoveryPanel.tsx
 *
 * The "Time Machine" macro-recovery UI for Flint IDE.
 *
 * Surfaces the git shadow-commit history for the active file and allows the
 * user to surgically transplant a single JSX element (identified by its
 * data-flint-id) from any historical commit into the live AST — without
 * touching the rest of the file (Commandment 11: Surgical Git Transplants).
 *
 * Key behaviours:
 *   • Fetches committed history via `window.flintAPI.gitLog`.
 *   • Uses `editorStore.revertNodeToCommit` for the actual AST transplant.
 *   • The transplant is pushed onto historyStore so Cmd+Z can undo it.
 *   • Empty state: renders a subtle empty-state banner when there is no
 *     history yet or no node is selected.
 *
 * Mithril Compliance:
 *   • No className hardcodes — inherits palette from Tailwind design tokens.
 *   • ΔE is not evaluated here; the Mithril Linter picks up drift after save.
 */

import { useCallback, useEffect, useState } from 'react'
import type { GitLogEntry } from '../../types/flint-api'
import { useEditorStore } from '../../store/editorStore'
import { useCanvasStore } from '../../store/canvasStore'

// ── Types ──────────────────────────────────────────────────────────────────────

type PanelStatus = 'idle' | 'loading' | 'transplanting' | 'done' | 'error'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(unix: number): string {
    const d = new Date(unix * 1000)
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function commitLabel(entry: GitLogEntry): string {
    // Strip the "flint:sync:" prefix for brevity in the UI.
    const msg = entry.message.replace(/^flint:sync:/, '').slice(0, 36)
    return msg || entry.hash
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RecoveryPanel() {
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)
    const selectedNodeId = useEditorStore((s) => s.selectedNodeId)
    const revertNodeToCommit = useEditorStore((s) => s.revertNodeToCommit)

    const [log, setLog] = useState<GitLogEntry[]>([])
    const [status, setStatus] = useState<PanelStatus>('idle')
    const [activeHash, setActiveHash] = useState<string | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Reload the git log whenever the active file changes.
    useEffect(() => {
        if (!activeFilePath) {
            setLog([])
            return
        }

        setStatus('loading')
        window.flintAPI.gitLog(activeFilePath)
            .then((entries) => {
                setLog(entries)
                setStatus('idle')
            })
            .catch(() => {
                setLog([])
                setStatus('idle')
            })
    }, [activeFilePath])

    const handleTransplant = useCallback(async (hash: string) => {
        if (!selectedNodeId) return
        setActiveHash(hash)
        setStatus('transplanting')
        setErrorMsg(null)

        try {
            await revertNodeToCommit(selectedNodeId, hash)
            setStatus('done')
            setTimeout(() => setStatus('idle'), 1800)
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            setErrorMsg(msg)
            setStatus('error')
        } finally {
            setActiveHash(null)
        }
    }, [selectedNodeId, revertNodeToCommit])

    // ── Empty States ───────────────────────────────────────────────────────────

    if (!activeFilePath) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-gray-500">
                <span className="text-lg">🗂</span>
                <span>Open a project file to view its recovery timeline.</span>
            </div>
        )
    }

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center gap-2 p-4 text-xs text-gray-400">
                <span className="animate-spin">⟳</span>
                <span>Loading history…</span>
            </div>
        )
    }

    if (log.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-gray-500">
                <span className="text-lg">⏳</span>
                <span>No shadow commits yet.</span>
                <span className="text-[10px] text-zinc-500">
                    History will appear here after the first auto-save.
                </span>
            </div>
        )
    }

    // ── Main Panel ─────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-1 px-2 py-1">
            {/* Header */}
            <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    File History ({log.length})
                </span>
                {!selectedNodeId && (
                    <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-300">
                        Select a component in the canvas to restore from a previous version
                    </span>
                )}
            </div>

            {/* Status feedback */}
            {status === 'done' && (
                <div className="mb-1 rounded border border-green-700 bg-green-900/30 px-2 py-1 text-[10px] text-green-300">
                    ✓ Transplant successful. Press Cmd+Z to undo.
                </div>
            )}
            {status === 'error' && errorMsg && (
                <div className="mb-1 rounded border border-red-700 bg-red-900/30 px-2 py-1 text-[10px] text-red-300">
                    ✗ Transplant failed: {errorMsg}
                </div>
            )}

            {/* Commit timeline */}
            <ul className="flex flex-col gap-0.5">
                {log.map((entry) => {
                    const isWorking = status === 'transplanting' && activeHash === entry.hash
                    const noSelection = !selectedNodeId

                    return (
                        <li
                            key={entry.hash}
                            className={[
                                'group flex items-start justify-between gap-2 rounded px-2 py-1.5',
                                'border border-transparent transition-colors',
                                'hover:border-gray-700 hover:bg-gray-800/60',
                            ].join(' ')}
                        >
                            {/* Commit info */}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <code className="rounded bg-gray-800 px-1 font-mono text-[10px] text-zinc-400">
                                        {entry.hash}
                                    </code>
                                    <span className="truncate text-[10px] text-gray-300">
                                        {commitLabel(entry)}
                                    </span>
                                </div>
                                <div className="mt-0.5 text-[10px] text-zinc-500">
                                    {formatTimestamp(entry.timestamp)}
                                </div>
                            </div>

                            {/* Transplant button */}
                            <button
                                onClick={() => handleTransplant(entry.hash)}
                                disabled={noSelection || status === 'transplanting'}
                                title={
                                    noSelection
                                        ? 'Select a layer in the canvas first'
                                        : `Transplant selected node from ${entry.hash}`
                                }
                                className={[
                                    'shrink-0 rounded px-2 py-0.5 text-[10px] font-medium transition-all',
                                    noSelection || status === 'transplanting'
                                        ? 'cursor-not-allowed text-zinc-500'
                                        : 'cursor-pointer text-indigo-400 opacity-0 group-hover:opacity-100',
                                    'hover:bg-indigo-900/40 hover:text-indigo-300',
                                    isWorking ? 'text-yellow-400 opacity-100' : '',
                                ].join(' ')}
                            >
                                {isWorking ? '⟳ …' : 'Transplant'}
                            </button>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

export default RecoveryPanel
