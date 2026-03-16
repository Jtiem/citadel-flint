/**
 * LaunchScreen — src/components/ui/LaunchScreen.tsx
 *
 * Entry point rendered by App.tsx when no workspace is loaded
 * (workspaceFiles === null). Provides:
 *
 *   • New Project   — pick an empty folder, copy the base template, open it
 *   • Open Folder   — use the existing openFolder dialog + scan flow
 *   • Recent Projects — IPC-fetched list from bridge-registry.db; click to
 *                       reopen without a dialog (uses project:openPath)
 *
 * Routing contract (Commandment 1 — Code is Truth):
 *   The LaunchScreen is the absolute fallback. `workspaceFiles` being null is
 *   the single source of truth for "no project open". Once any of the three
 *   paths above succeeds, App.tsx calls setWorkspaceFiles(tree) which causes
 *   LaunchScreen to unmount and the full IDE to mount.
 */

import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Clock, Trash2, FolderCheck, Sparkles, Figma } from 'lucide-react'
import type { RecentProject } from '../../types/bridge-api'
import { FigmaSetupWizard } from './FigmaSetupWizard'

interface LaunchScreenProps {
    /** Triggers the existing `dialog:openFolder` + scan flow. */
    onOpenFolder: () => Promise<void>
    /** Triggers `dialog:selectFolder` → `project:initialize` → hydrate IDE. */
    onNewProject: () => Promise<void>
    /** Opens a known project path directly (no dialog). */
    onOpenRecent: (projectPath: string) => Promise<void>
    /** Triggers `dialog:selectFolder` → `project:initialize` with 'bridge-demo' template. */
    onLoadDemo: () => Promise<void>
}

export function LaunchScreen({ onOpenFolder, onNewProject, onOpenRecent, onLoadDemo }: LaunchScreenProps) {
    const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
    const [loading, setLoading] = useState(true)
    const [openingPath, setOpeningPath] = useState<string | null>(null)
    const [figmaSetupOpen, setFigmaSetupOpen] = useState(false)

    // ── Fetch recent projects on mount ────────────────────────────────────────
    useEffect(() => {
        window.bridgeAPI.registry
            .getRecent()
            .then(setRecentProjects)
            .finally(() => setLoading(false))
    }, [])

    const handleRemove = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        void window.bridgeAPI.registry.removeProject(id).then(() => {
            setRecentProjects((prev) => prev.filter((p) => p.id !== id))
        })
    }

    const handleOpenRecent = async (project: RecentProject) => {
        setOpeningPath(project.path)
        try {
            await onOpenRecent(project.path)
        } finally {
            setOpeningPath(null)
        }
    }

    return (
        <div className="flex h-screen flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-6 py-4">
                <div>
                    <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                        Bridge IDE
                    </h1>
                    <p className="mt-0.5 text-xs text-gray-500">Design-to-Code Platform</p>
                </div>
            </header>

            {/* ── Main content ───────────────────────────────────────────── */}
            <main className="flex flex-1 items-start justify-center overflow-y-auto pt-16">
                <div className="w-full max-w-xl px-4">
                    {/* ── Action buttons ───────────────────────────────────── */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => { void onNewProject() }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-600/20 px-4 py-3 text-sm font-medium text-indigo-300 transition-colors hover:border-indigo-500/70 hover:bg-indigo-600/30 hover:text-indigo-200"
                        >
                            <Plus size={15} />
                            New Project
                        </button>
                        <button
                            type="button"
                            onClick={() => { void onOpenFolder() }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700/60 hover:text-white"
                        >
                            <FolderOpen size={15} />
                            Open Folder
                        </button>
                    </div>

                    {/* ── Load Demo ────────────────────────────────────────── */}
                    <button
                        type="button"
                        onClick={() => { void onLoadDemo() }}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-600/10 px-4 py-3 text-sm font-medium text-purple-400 transition-colors hover:border-purple-500/60 hover:bg-purple-600/20 hover:text-purple-300"
                    >
                        <Sparkles size={15} />
                        Load Demo
                        <span className="ml-1 rounded-full bg-purple-900/60 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                            bridge-demo template
                        </span>
                    </button>

                    {/* ── Connect Figma (Phase W.2) ────────────────────────── */}
                    <button
                        type="button"
                        onClick={() => { setFigmaSetupOpen((v) => !v) }}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800/40 px-4 py-3 text-sm font-medium text-gray-400 transition-colors hover:border-gray-600 hover:bg-gray-800/60 hover:text-gray-300"
                    >
                        <Figma size={15} />
                        Connect Figma
                    </button>

                    {/* Figma setup wizard — shown when button is toggled */}
                    <FigmaSetupWizard
                        visible={figmaSetupOpen}
                        onClose={() => { setFigmaSetupOpen(false) }}
                    />

                    {/* ── Recent Projects ──────────────────────────────────── */}
                    <div className="mt-8">
                        <div className="mb-3 flex items-center gap-2">
                            <Clock size={12} className="text-gray-500" />
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                Recent Projects
                            </span>
                        </div>

                        {loading ? (
                            <div className="py-8 text-center text-xs text-zinc-500">
                                Loading…
                            </div>
                        ) : recentProjects.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-800 py-10 text-center">
                                <FolderCheck size={24} className="mx-auto mb-2 text-zinc-600" />
                                <p className="text-xs text-zinc-500">No recent projects yet.</p>
                                <p className="mt-1 text-xs text-zinc-500">
                                    Create or open a project to get started.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-800/60 rounded-lg border border-gray-800">
                                {recentProjects.map((project) => {
                                    const isOpening = openingPath === project.path
                                    // Display a short path: replace home dir with ~
                                    const shortPath = project.path.replace(
                                        /^\/Users\/[^/]+/,
                                        '~'
                                    )
                                    return (
                                        <li key={project.id}>
                                            <div
                                                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800/60"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => { void handleOpenRecent(project) }}
                                                    disabled={isOpening}
                                                    className="flex flex-1 items-center gap-3 min-w-0"
                                                >
                                                    <FolderOpen
                                                        size={15}
                                                        className="shrink-0 text-indigo-400/70 group-hover:text-indigo-400"
                                                    />
                                                    <div className="min-w-0 flex-1 text-left">
                                                        <p className="truncate text-sm font-medium text-gray-200">
                                                            {isOpening ? 'Opening…' : project.name}
                                                        </p>
                                                        <p
                                                            className="truncate font-mono text-[10px] text-zinc-500"
                                                            title={project.path}
                                                        >
                                                            {shortPath}
                                                        </p>
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label="Remove from recent"
                                                    onClick={(e) => handleRemove(e, project.id)}
                                                    className="shrink-0 rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
