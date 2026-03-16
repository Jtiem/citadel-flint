/**
 * FileExplorer — src/components/ui/FileExplorer.tsx
 *
 * Module F.1: Recursive file tree sidebar for the Bridge Project Workspace.
 * Phase F.2: File nodes are drop targets for cross-file component moves.
 *
 * Architecture:
 *   - `FileExplorer` is the root component. It subscribes ONLY to `workspaceFiles`
 *     so it only re-renders when the folder is opened or refreshed.
 *   - `FileItem` renders a single file. It subscribes to its active-file status
 *     and accepts drops from LayerTree rows (cross-file move).
 *   - `DirectoryItem` renders a folder with expand/collapse. It subscribes only
 *     to its own expanded state.
 *   - `FileNode` dispatches to `FileItem` or `DirectoryItem` so hooks are never
 *     called conditionally (Rules of Hooks compliance).
 *
 * Cross-file drop protocol:
 *   When a LayerTree row is dragged over a file node, `FileItem` checks for
 *   the `application/bridge-source-file` drag type before accepting the drop.
 *   On a valid drop it calls `useASTBufferStore.getState().crossFileMove(...)`,
 *   which buffers both files, performs Babel AST surgery, atomically saves via
 *   `saveFileBatch`, and pushes tagged history entries.
 *
 * Zustand selector pattern:
 *   Each `FileItem` uses `s.activeFilePath === node.path` — a boolean selector
 *   that only re-renders that one instance when its active status changes.
 *   Each `DirectoryItem` uses `s.expandedFolders.has(node.path)` with the same
 *   single-instance re-render guarantee.
 */

import { useState } from 'react'
import { useCanvasStore } from '../../store/canvasStore'
import { useASTBufferStore } from '../../store/astBufferStore'
import type { FileTreeNode } from '../../types/bridge-api'

// ── FileItem ──────────────────────────────────────────────────────────────────

interface FileItemProps {
    node: FileTreeNode
    depth: number
}

/**
 * Renders a single file node. Accepts drops from LayerTree rows to trigger
 * cross-file component moves via `crossFileMove`.
 */
function FileItem({ node, depth }: FileItemProps) {
    const isActive = useCanvasStore((s) => s.activeFilePath === node.path)
    const setActiveFile = useCanvasStore((s) => s.setActiveFile)
    const [isDragTarget, setIsDragTarget] = useState(false)

    const paddingLeft = depth * 12

    function handleDragOver(e: React.DragEvent<HTMLButtonElement>): void {
        // Only accept drops that carry a bridge source file — i.e. LayerTree rows.
        if (!e.dataTransfer.types.includes('application/bridge-source-file')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setIsDragTarget(true)
    }

    function handleDragLeave(e: React.DragEvent<HTMLButtonElement>): void {
        // Only clear when the cursor leaves the button itself, not its children.
        const btn = e.currentTarget
        if (btn.contains(e.relatedTarget as Node | null)) return
        setIsDragTarget(false)
    }

    function handleDrop(e: React.DragEvent<HTMLButtonElement>): void {
        e.preventDefault()
        setIsDragTarget(false)

        const sourceNodeId = e.dataTransfer.getData('application/bridge-source-id')
        const sourceFilePath = e.dataTransfer.getData('application/bridge-source-file')

        // Ignore drops from the same file (single-file moves stay in LayerTree)
        // or drops that didn't originate from a LayerTree row.
        if (!sourceNodeId || !sourceFilePath || sourceFilePath === node.path) return

        void useASTBufferStore.getState().crossFileMove(
            sourceFilePath,
            node.path,
            sourceNodeId,
            null,      // no specific target node — append to root JSX element
            'inside',
        )
    }

    function handleDragStart(e: React.DragEvent<HTMLButtonElement>): void {
        // Only allow dragging .tsx files (components)
        if (!node.name.endsWith('.tsx')) {
            e.preventDefault()
            return
        }
        e.dataTransfer.setData('application/bridge-component-file', node.path)
        // File-level drags carry no specific node ID — the drop target uses the
        // source file's root JSX element as the composition anchor. An empty
        // string signals "whole-file compose" to the canvas drop handler.
        e.dataTransfer.setData('application/bridge-source-id', '')
        e.dataTransfer.effectAllowed = 'copy'
    }

    return (
        <button
            type="button"
            title={node.path}
            onClick={() => { void setActiveFile(node.path) }}
            draggable={node.name.endsWith('.tsx')} // Only components are draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ paddingLeft: paddingLeft + 8 }}
            className={`flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[11px] transition-colors ${isDragTarget
                    ? 'bg-indigo-400/20 text-indigo-300 outline outline-1 outline-indigo-400/50'
                    : isActive
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                }`}
        >
            <span className="shrink-0 text-[10px] opacity-40">◆</span>
            <span className="truncate font-mono">{node.name}</span>
        </button>
    )
}

// ── DirectoryItem ─────────────────────────────────────────────────────────────

interface DirectoryItemProps {
    node: FileTreeNode
    depth: number
}

function DirectoryItem({ node, depth }: DirectoryItemProps) {
    const isExpanded = useCanvasStore((s) => s.expandedFolders.has(node.path))
    const toggleFolder = useCanvasStore((s) => s.toggleFolder)

    const paddingLeft = depth * 12

    return (
        <div>
            <button
                type="button"
                onClick={() => toggleFolder(node.path)}
                style={{ paddingLeft: paddingLeft + 8 }}
                className="flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[11px] text-gray-500 transition-colors hover:bg-gray-800/60 hover:text-gray-300"
            >
                <span className="shrink-0 font-mono text-[10px]">
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

// ── FileNode (dispatcher) ─────────────────────────────────────────────────────

interface FileNodeProps {
    node: FileTreeNode
    depth?: number
}

/**
 * Dispatches to `FileItem` or `DirectoryItem` so hooks are never called
 * conditionally inside either leaf component (Rules of Hooks compliance).
 */
function FileNode({ node, depth = 0 }: FileNodeProps) {
    if (node.type === 'file') return <FileItem node={node} depth={depth} />
    return <DirectoryItem node={node} depth={depth} />
}

// ── FileExplorer ──────────────────────────────────────────────────────────────

/**
 * Renders the recursive project file tree in the left sidebar.
 *
 * This component subscribes only to `workspaceFiles` — toggling a folder or
 * changing the active file does NOT cause FileExplorer itself to re-render;
 * only the specific FileItem / DirectoryItem instances whose selector output
 * changed will update.
 */
export function FileExplorer() {
    const workspaceFiles = useCanvasStore((s) => s.workspaceFiles)

    if (!workspaceFiles) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                <span className="text-[11px] text-zinc-500">No folder open</span>
                <span className="text-[10px] text-zinc-400">
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
                    className="block truncate font-mono text-[10px] uppercase tracking-wider text-zinc-500"
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
