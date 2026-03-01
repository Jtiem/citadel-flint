import { useState, useEffect } from 'react'
import './index.css'
import { CodeEditor } from './components/editor/CodeEditor'
import { LivePreview } from './components/editor/LivePreview'
import { LayerTree } from './components/ui/LayerTree'
import { AssetsPanel } from './components/editor/AssetsPanel'
import { PropertiesPanel } from './components/ui/PropertiesPanel'
import { TokenManager } from './components/ui/TokenManager'
import { FileExplorer } from './components/ui/FileExplorer'
import { useTokenStore } from './store/tokenStore'
import { StatusBar } from './components/editor/StatusBar'
import { useCanvasStore } from './store/canvasStore'
import type { FileTreeNode } from './types/bridge-api'

// ── Primary file selection ────────────────────────────────────────────────────
// Walks the tree to find the most relevant entry point: App.tsx is preferred,
// then index.tsx, main.tsx, App.ts, index.ts, then the first file encountered.
// Uses node:path logic is unavailable in the renderer; path.basename is not
// needed here since FileTreeNode.name already contains just the filename.
function findPrimaryFile(tree: FileTreeNode): string | null {
    const files: { name: string; path: string }[] = []
    function walk(node: FileTreeNode) {
        if (node.type === 'file') files.push({ name: node.name, path: node.path })
        node.children?.forEach(walk)
    }
    walk(tree)

    const PRIORITY = ['App.tsx', 'index.tsx', 'main.tsx', 'App.ts', 'index.ts']
    for (const p of PRIORITY) {
        const found = files.find((f) => f.name === p)
        if (found) return found.path
    }
    return files[0]?.path ?? null
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
    const [leftTab, setLeftTab] = useState<'layers' | 'files' | 'assets'>('layers')
    const [ipcStatus, setIpcStatus] = useState<string>('Connecting…')
    const [ipcOk, setIpcOk] = useState<boolean>(false)
    const fetchTokens = useTokenStore((s) => s.fetchTokens)

    // Workspace persistence state
    const setActiveFile = useCanvasStore((s) => s.setActiveFile)
    const setWorkspaceFiles = useCanvasStore((s) => s.setWorkspaceFiles)
    const saveState = useCanvasStore((s) => s.saveState)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    // Extract the bare filename for display (no Node.js path module in renderer)
    const activeFileName = activeFilePath ? activeFilePath.split('/').pop() ?? null : null

    const handleOpenFolder = async () => {
        const tree = await window.bridgeAPI.openFolder()
        if (!tree) return

        // Populate the FileExplorer sidebar
        setWorkspaceFiles(tree as FileTreeNode)

        // Switch to the files tab so the user sees the tree
        setLeftTab('files')

        // Auto-open the primary file (App.tsx > index.tsx > main.tsx > first)
        const primaryPath = findPrimaryFile(tree as FileTreeNode)
        if (primaryPath) {
            await setActiveFile(primaryPath)
        }
    }

    useEffect(() => {
        window.bridgeAPI
            .ping()
            .then((response) => {
                setIpcStatus(response)
                setIpcOk(true)
            })
            .catch((err: Error) => {
                setIpcStatus(`IPC Error: ${err.message}`)
                setIpcOk(false)
            })
    }, [])

    // Re-fetch tokens whenever the Figma plugin syncs successfully.
    // The ingestion server broadcasts 'bridge:tokens-updated' after every /ingest write.
    useEffect(() => {
        window.bridgeAPI.onTokensUpdated(() => {
            console.log('⚡️ SYNC RECEIVED')
            fetchTokens()
        })
        return () => {
            window.bridgeAPI.removeTokensUpdatedListener()
        }
    }, [fetchTokens])

    return (
        <div className="flex h-screen flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
            {/* ── Top bar ────────────────────────────────────────────────── */}
            <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-6 py-3">
                {/* Left: title + active file name */}
                <div className="flex flex-col">
                    <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                        Bridge IDE
                    </h1>
                    {activeFileName && (
                        <span
                            className="max-w-[200px] truncate font-mono text-[9px] text-gray-500"
                            title={activeFilePath ?? ''}
                        >
                            {activeFileName}
                        </span>
                    )}
                </div>

                {/* Center: IPC health pill */}
                <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-2">
                    <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                            ipcOk
                                ? 'bg-emerald-400 shadow-lg shadow-emerald-400/40'
                                : 'animate-pulse bg-amber-400'
                        }`}
                    />
                    <span className="font-mono text-xs text-gray-300">
                        {ipcStatus}
                    </span>
                    <span className="text-xs text-gray-600">
                        Context Isolation ✓ · Node Integration Off ✓
                    </span>
                </div>

                {/* Right: save state + Open Folder + tech pills */}
                <div className="flex items-center gap-2">
                    {/* Save state indicator — visible only when a file is open */}
                    {saveState !== 'idle' && (
                        <div className="flex items-center gap-1.5">
                            <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${
                                    saveState === 'editing'
                                        ? 'bg-amber-400'
                                        : saveState === 'saving'
                                          ? 'animate-pulse bg-blue-400'
                                          : 'bg-emerald-400'
                                }`}
                            />
                            <span className="font-mono text-[10px] text-gray-400">
                                {saveState === 'editing'
                                    ? 'Editing…'
                                    : saveState === 'saving'
                                      ? 'Saving…'
                                      : 'Saved'}
                            </span>
                        </div>
                    )}

                    {/* Open Folder */}
                    <button
                        type="button"
                        onClick={() => { void handleOpenFolder() }}
                        className="rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:border-indigo-500/50 hover:bg-gray-700 hover:text-white"
                    >
                        Open Folder
                    </button>

                    {/* Tech pills */}
                    {[
                        'Electron',
                        'React',
                        'TypeScript',
                        'Tailwind',
                        'Monaco',
                        'Babel',
                        'SQLite',
                    ].map((tech) => (
                        <span
                            key={tech}
                            className="rounded-full border border-gray-700 bg-gray-800/50 px-2.5 py-0.5 text-xs text-gray-400"
                        >
                            {tech}
                        </span>
                    ))}
                </div>
            </header>

            {/* ── Three-panel workspace ───────────────────────────────────── */}
            {/* min-h-0 on `main` and every panel section is required:        */}
            {/* without it flex children default to min-height: auto and      */}
            {/* overflow-y-auto never engages inside flex containers.          */}
            <main className="flex min-h-0 flex-1">
                {/* Left panel: Layers / Files / Assets tabs (20%) */}
                <section className="flex min-h-0 w-1/5 flex-col border-r border-gray-800">
                    {/* Tab bar */}
                    <div className="flex shrink-0 border-b border-gray-800">
                        {(['layers', 'files', 'assets'] as const).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setLeftTab(tab)}
                                className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                                    leftTab === tab
                                        ? 'border-b-2 border-indigo-500 text-indigo-400'
                                        : 'text-gray-600 hover:text-gray-400'
                                }`}
                            >
                                {tab === 'layers' ? 'AST' : tab}
                            </button>
                        ))}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {leftTab === 'layers' && <LayerTree />}
                        {leftTab === 'files' && <FileExplorer />}
                        {leftTab === 'assets' && <AssetsPanel />}
                    </div>
                </section>

                {/* Center panel: Live Preview (top) + Code Editor (bottom) (60%) */}
                <section className="flex min-h-0 w-3/5 flex-col border-r border-gray-800">
                    {/* Top half: srcdoc live preview */}
                    <div className="flex min-h-0 flex-1 flex-col border-b border-gray-800">
                        <div className="flex shrink-0 items-center border-b border-gray-800 px-4 py-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                Live Preview · srcdoc Engine
                            </span>
                        </div>
                        <div className="min-h-0 flex-1">
                            <LivePreview />
                        </div>
                    </div>

                    {/* Bottom half: Monaco code editor */}
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex shrink-0 items-center border-b border-gray-800 px-4 py-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                Source
                            </span>
                        </div>
                        <div className="min-h-0 flex-1">
                            <CodeEditor />
                        </div>
                    </div>
                </section>

                {/* Right panel: Properties (top) + Token Manager (bottom) (20%) */}
                <section className="flex min-h-0 w-1/5 flex-col">
                    {/* Properties — upper half */}
                    <div className="flex min-h-0 flex-1 flex-col border-b border-gray-800">
                        <div className="flex shrink-0 items-center border-b border-gray-800 px-3 py-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                Properties
                            </span>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <PropertiesPanel />
                        </div>
                    </div>

                    {/* Token Manager — lower half */}
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex shrink-0 items-center border-b border-gray-800 px-3 py-2">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                Tokens
                            </span>
                        </div>
                        <div className="min-h-0 flex-1">
                            <TokenManager />
                        </div>
                    </div>
                </section>
            </main>
            <StatusBar />
        </div>
    )
}

export default App
