/**
 * FileExplorer — src/components/ui/FileExplorer.tsx
 *
 * Module F.1: Recursive file tree sidebar for the Bridge Project Workspace.
 *
 * Architecture:
 *   - `FileExplorer` is the root component. It subscribes ONLY to `workspaceFiles`
 *     so it only re-renders when the folder is opened or refreshed.
 *   - `FileNode` is the recursive unit. Each instance subscribes to exactly the
 *     state it needs via granular Zustand selectors:
 *       • Directory nodes: `s.expandedFolders.has(node.path)` → boolean
 *       • File nodes:      `s.activeFilePath === node.path`   → boolean
 *     Because selectors return primitives compared with `===`, toggling one
 *     folder or switching one active file only re-renders the two affected
 *     FileNode instances — not the entire sidebar.
 */

import { useCanvasStore } from '../../store/canvasStore'
import type { FileTreeNode } from '../../types/bridge-api'

// ── FileNode (recursive) ──────────────────────────────────────────────────────

interface FileNodeProps {
    node: FileTreeNode
    depth?: number
}

function FileNode({ node, depth = 0 }: FileNodeProps) {
    const paddingLeft = depth * 12

    if (node.type === 'file') {
        // Granular selector: only re-renders when THIS file's active status changes.
        const isActive = useCanvasStore((s) => s.activeFilePath === node.path)
        const setActiveFile = useCanvasStore((s) => s.setActiveFile)

        return (
            <button
                type="button"
                title={node.path}
                onClick={() => { void setActiveFile(node.path) }}
                style={{ paddingLeft: paddingLeft + 8 }}
                className={`flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[11px] transition-colors ${
                    isActive
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                }`}
            >
                <span className="shrink-0 text-[8px] opacity-40">◆</span>
                <span className="truncate font-mono">{node.name}</span>
            </button>
        )
    }

    // Directory node — granular selector: only re-renders when THIS folder's
    // expanded state changes.
    const isExpanded = useCanvasStore((s) => s.expandedFolders.has(node.path))
    const toggleFolder = useCanvasStore((s) => s.toggleFolder)

    return (
        <div>
            <button
                type="button"
                onClick={() => toggleFolder(node.path)}
                style={{ paddingLeft: paddingLeft + 8 }}
                className="flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[11px] text-gray-500 transition-colors hover:bg-gray-800/60 hover:text-gray-300"
            >
                <span className="shrink-0 font-mono text-[9px]">
                    {isExpanded ? '▼' : '▶'}
                </span>
                <span className="truncate">{node.name}</span>
            </button>
            {isExpanded &&
                node.children?.map((child) => (
                    <FileNode key={child.path} node={child} depth={depth + 1} />
                ))}
        </div>
    )
}

// ── FileExplorer ──────────────────────────────────────────────────────────────

/**
 * Renders the recursive project file tree in the left sidebar.
 *
 * This component subscribes only to `workspaceFiles` — toggling a folder or
 * changing the active file does NOT cause FileExplorer itself to re-render;
 * only the specific FileNode instances whose selector output changed will update.
 */
export function FileExplorer() {
    const workspaceFiles = useCanvasStore((s) => s.workspaceFiles)

    if (!workspaceFiles) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                <span className="text-[11px] text-gray-600">No folder open</span>
                <span className="text-[10px] text-gray-700">
                    Click "Open Folder" to load a project
                </span>
            </div>
        )
    }

    return (
        <div className="py-1">
            {/* Root folder name */}
            <div className="px-3 pb-1 pt-2">
                <span
                    className="block truncate font-mono text-[10px] uppercase tracking-wider text-gray-600"
                    title={workspaceFiles.path}
                >
                    {workspaceFiles.name}
                </span>
            </div>

            {/* Tree nodes */}
            {workspaceFiles.children?.map((node) => (
                <FileNode key={node.path} node={node} />
            ))}
        </div>
    )
}
