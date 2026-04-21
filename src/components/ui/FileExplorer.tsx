/**
 * FileExplorer — src/components/ui/FileExplorer.tsx
 *
 * Module F.1: Recursive file tree sidebar for the Flint Project Workspace.
 * Phase F.2: File nodes are drop targets for cross-file component moves.
 * Phase GLASS.2.1: WAI-ARIA tree semantics + keyboard navigation.
 *
 * Architecture:
 *   - `FileExplorer` is the root component. It subscribes ONLY to `workspaceFiles`
 *     so it only re-renders when the folder is opened or refreshed.
 *   - `FileItem` renders a single file. It subscribes to its active-file status
 *     and accepts drops from LayerTree rows (cross-file move).
 *   - `DirectoryItem` renders a folder with expand/collapse. It subscribes only
 *     to its own expanded state.
 *   - `FileNode` dispatches to `FileItem` or `DirectoryItem` so hooks are never
 *     called conditionally inside either leaf component (Rules of Hooks compliance).
 *
 * Cross-file drop protocol:
 *   When a LayerTree row is dragged over a file node, `FileItem` checks for
 *   the `application/flint-source-file` drag type before accepting the drop.
 *   On a valid drop it calls `useASTBufferStore.getState().crossFileMove(...)`,
 *   which buffers both files, performs Babel AST surgery, atomically saves via
 *   `saveFileBatch`, and pushes tagged history entries.
 *
 * Zustand selector pattern:
 *   Each `FileItem` uses `s.activeFilePath === node.path` — a boolean selector
 *   that only re-renders that one instance when its active status changes.
 *   Each `DirectoryItem` uses `s.expandedFolders.has(node.path)` with the same
 *   single-instance re-render guarantee.
 *
 * Keyboard navigation (WAI-ARIA TreeView pattern):
 *   ArrowDown/Up move between visible items, ArrowRight expands or enters child,
 *   ArrowLeft collapses or moves to parent, Home/End jump to first/last,
 *   Enter/Space select the focused item.
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { FolderOpen } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { useASTBufferStore } from '../../store/astBufferStore';
import type { FileTreeNode } from '../../types/flint-api';

// ── Tree traversal helpers ────────────────────────────────────────────────────

/**
 * Flattens the visible portion of a FileTreeNode tree into an ordered list.
 * Collapsed directories' children are excluded since they are not rendered.
 */
function flattenVisibleFileTree(nodes: FileTreeNode[], expandedFolders: Set<string>): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.type === 'directory' && expandedFolders.has(node.path) && node.children) {
      result.push(...flattenVisibleFileTree(node.children, expandedFolders));
    }
  }
  return result;
}

/**
 * Builds a map from child path to parent node. Top-level nodes have no parent.
 */
function buildFileParentMap(nodes: FileTreeNode[], parentMap: Map<string, FileTreeNode> = new Map(), parent?: FileTreeNode): Map<string, FileTreeNode> {
  for (const node of nodes) {
    if (parent) parentMap.set(node.path, parent);
    if (node.children) {
      buildFileParentMap(node.children, parentMap, node);
    }
  }
  return parentMap;
}

/**
 * Computes the depth of a node by walking the parent map.
 */
function getFileDepth(path: string, parentMap: Map<string, FileTreeNode>): number {
  let depth = 0;
  let current = parentMap.get(path);
  while (current) {
    depth++;
    current = parentMap.get(current.path);
  }
  return depth;
}

// ── FileItem ──────────────────────────────────────────────────────────────────

interface FileItemProps {
  node: FileTreeNode;
  depth: number;
  /** The path of the node that currently holds roving tabindex focus. */
  focusedPath: string | null;
  /** Setter to update the roving tabindex focus target. */
  setFocusedPath: (path: string) => void;
}

/**
 * Renders a single file node. Accepts drops from LayerTree rows to trigger
 * cross-file component moves via `crossFileMove`.
 */
function FileItem({
  node,
  depth,
  focusedPath,
  setFocusedPath
}: FileItemProps) {
  const isActive = useCanvasStore(s => s.activeFilePath === node.path);
  const setActiveFile = useCanvasStore(s => s.setActiveFile);
  const [isDragTarget, setIsDragTarget] = useState(false);
  const paddingLeft = depth * 12;
  function handleDragOver(e: React.DragEvent<HTMLButtonElement>): void {
    // Only accept drops that carry a flint source file — i.e. LayerTree rows.
    if (!e.dataTransfer.types.includes('application/flint-source-file')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragTarget(true);
  }
  function handleDragLeave(e: React.DragEvent<HTMLButtonElement>): void {
    // Only clear when the cursor leaves the button itself, not its children.
    const btn = e.currentTarget;
    if (btn.contains(e.relatedTarget as Node | null)) return;
    setIsDragTarget(false);
  }
  function handleDrop(e: React.DragEvent<HTMLButtonElement>): void {
    e.preventDefault();
    setIsDragTarget(false);
    const sourceNodeId = e.dataTransfer.getData('application/flint-source-id');
    const sourceFilePath = e.dataTransfer.getData('application/flint-source-file');

    // Ignore drops from the same file (single-file moves stay in LayerTree)
    // or drops that didn't originate from a LayerTree row.
    if (!sourceNodeId || !sourceFilePath || sourceFilePath === node.path) return;
    void useASTBufferStore.getState().crossFileMove(sourceFilePath, node.path, sourceNodeId, null,
    // no specific target node — append to root JSX element
    'inside');
  }
  function handleDragStart(e: React.DragEvent<HTMLButtonElement>): void {
    // Only allow dragging .tsx files (components)
    if (!node.name.endsWith('.tsx')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/flint-component-file', node.path);
    // File-level drags carry no specific node ID — the drop target uses the
    // source file's root JSX element as the composition anchor. An empty
    // string signals "whole-file compose" to the canvas drop handler.
    e.dataTransfer.setData('application/flint-source-id', '');
    e.dataTransfer.effectAllowed = 'copy';
  }
  return <button type="button" role="treeitem" aria-level={depth + 1} aria-selected={isActive} tabIndex={focusedPath === node.path ? 0 : -1} data-file-path={node.path} title={node.path} onClick={() => {
    void setActiveFile(node.path);
  }} onFocus={() => setFocusedPath(node.path)} draggable={node.name.endsWith('.tsx')} // Only components are draggable
  onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} style={{
    paddingLeft: paddingLeft + 8
  }} className={`flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[11px] transition-colors ${isDragTarget ? 'bg-indigo-400/20 text-indigo-300 outline outline-1 outline-indigo-400/50' : isActive ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'}`}>
            <span className="shrink-0 text-[var(--spacing.2, 8px)] opacity-40">◆</span>
            <span className="truncate font-mono">{node.name}</span>
        </button>;
}

// ── DirectoryItem ─────────────────────────────────────────────────────────────

interface DirectoryItemProps {
  node: FileTreeNode;
  depth: number;
  /** The path of the node that currently holds roving tabindex focus. */
  focusedPath: string | null;
  /** Setter to update the roving tabindex focus target. */
  setFocusedPath: (path: string) => void;
}
function DirectoryItem({
  node,
  depth,
  focusedPath,
  setFocusedPath
}: DirectoryItemProps) {
  const isExpanded = useCanvasStore(s => s.expandedFolders.has(node.path));
  const toggleFolder = useCanvasStore(s => s.toggleFolder);
  const paddingLeft = depth * 12;
  return <div role="treeitem" aria-level={depth + 1} aria-selected={false} aria-expanded={isExpanded} tabIndex={focusedPath === node.path ? 0 : -1} data-file-path={node.path} onFocus={e => {
    // Only set focused if this div itself got focus, not a child.
    if (e.target === e.currentTarget) setFocusedPath(node.path);
  }}>
            <button type="button" tabIndex={-1} onClick={() => toggleFolder(node.path)} style={{
      paddingLeft: paddingLeft + 8
    }} className="flex w-full items-center gap-1.5 py-[var(--spacing.1, 4px)] pr-2 text-left text-[var(--spacing.3, 12px)] text-gray-500 transition-colors hover:bg-gray-800/60 hover:text-gray-300">
                <span className="shrink-0 font-mono text-[var(--spacing.2, 8px)]">
                    {isExpanded ? '▼' : '▶'}
                </span>
                <span className="truncate">{node.name}</span>
            </button>
            {isExpanded && node.children?.map(child => <FileNode key={child.path} node={child} depth={depth + 1} focusedPath={focusedPath} setFocusedPath={setFocusedPath} />)}
        </div>;
}

// ── FileNode (dispatcher) ─────────────────────────────────────────────────────

interface FileNodeProps {
  node: FileTreeNode;
  depth?: number;
  /** The path of the node that currently holds roving tabindex focus. */
  focusedPath: string | null;
  /** Setter to update the roving tabindex focus target. */
  setFocusedPath: (path: string) => void;
}

/**
 * Dispatches to `FileItem` or `DirectoryItem` so hooks are never called
 * conditionally inside either leaf component (Rules of Hooks compliance).
 */
function FileNode({
  node,
  depth = 0,
  focusedPath,
  setFocusedPath
}: FileNodeProps) {
  if (node.type === 'file') return <FileItem node={node} depth={depth} focusedPath={focusedPath} setFocusedPath={setFocusedPath} />;
  return <DirectoryItem node={node} depth={depth} focusedPath={focusedPath} setFocusedPath={setFocusedPath} />;
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
  const workspaceFiles = useCanvasStore(s => s.workspaceFiles);
  const expandedFolders = useCanvasStore(s => s.expandedFolders);
  const toggleFolder = useCanvasStore(s => s.toggleFolder);
  const setActiveFile = useCanvasStore(s => s.setActiveFile);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  // Memoize the flattened visible tree and parent map for keyboard navigation.
  const topChildren = workspaceFiles?.children ?? [];
  const flatVisible = useMemo(() => flattenVisibleFileTree(topChildren, expandedFolders), [topChildren, expandedFolders]);
  const parentMap = useMemo(() => buildFileParentMap(topChildren), [topChildren]);

  /**
   * Moves roving tabindex focus to the given node path and scrolls it into view.
   */
  const moveFocus = useCallback((path: string) => {
    setFocusedPath(path);
    requestAnimationFrame(() => {
      const el = treeRef.current?.querySelector(`[data-file-path="${CSS.escape(path)}"]`) as HTMLElement | null;
      el?.focus();
    });
  }, []);

  /**
   * WAI-ARIA TreeView keyboard navigation handler.
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (flatVisible.length === 0) return;
    const currentIndex = focusedPath !== null ? flatVisible.findIndex(n => n.path === focusedPath) : -1;
    const currentNode = currentIndex >= 0 ? flatVisible[currentIndex] : null;
    switch (e.key) {
      case 'ArrowDown':
        {
          e.preventDefault();
          const nextIndex = currentIndex < flatVisible.length - 1 ? currentIndex + 1 : currentIndex;
          moveFocus(flatVisible[nextIndex >= 0 ? nextIndex : 0].path);
          break;
        }
      case 'ArrowUp':
        {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
          moveFocus(flatVisible[prevIndex].path);
          break;
        }
      case 'ArrowRight':
        {
          e.preventDefault();
          if (!currentNode) break;
          if (currentNode.type === 'directory' && !expandedFolders.has(currentNode.path)) {
            // Expand the collapsed directory.
            toggleFolder(currentNode.path);
          } else if (currentNode.type === 'directory' && currentNode.children && currentNode.children.length > 0) {
            // Move to first child.
            moveFocus(currentNode.children[0].path);
          }
          break;
        }
      case 'ArrowLeft':
        {
          e.preventDefault();
          if (!currentNode) break;
          if (currentNode.type === 'directory' && expandedFolders.has(currentNode.path)) {
            // Collapse the expanded directory.
            toggleFolder(currentNode.path);
          } else {
            // Move to parent.
            const parent = parentMap.get(currentNode.path);
            if (parent) moveFocus(parent.path);
          }
          break;
        }
      case 'Home':
        {
          e.preventDefault();
          if (flatVisible.length > 0) moveFocus(flatVisible[0].path);
          break;
        }
      case 'End':
        {
          e.preventDefault();
          if (flatVisible.length > 0) moveFocus(flatVisible[flatVisible.length - 1].path);
          break;
        }
      case 'Enter':
      case ' ':
        {
          e.preventDefault();
          if (currentNode) {
            if (currentNode.type === 'file') {
              void setActiveFile(currentNode.path);
            } else {
              toggleFolder(currentNode.path);
            }
          }
          break;
        }
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatVisible, focusedPath, expandedFolders, parentMap, moveFocus, setActiveFile, toggleFolder]);
  const handleOpenFolder = useCallback(async () => {
    const tree = await window.flintAPI.openFolder();
    if (!tree) return;
    useCanvasStore.getState().setWorkspaceFiles(tree as FileTreeNode);
  }, []);
  if (!workspaceFiles) {
    return <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                <FolderOpen className="h-6 w-6 text-zinc-600" />
                <p className="text-sm text-zinc-400">No project folder</p>
                <p className="text-xs text-zinc-500 max-w-[var(--spacing.12, 48px)]">Load a project to browse its file tree</p>
                <button type="button" onClick={() => void handleOpenFolder()} className="mt-1 rounded border border-indigo-500/40 bg-indigo-900/20 px-3 py-1.5 text-xs text-indigo-400 transition-colors hover:bg-indigo-900/40 hover:text-indigo-300">
                    Open Folder
                </button>
            </div>;
  }
  return <div className="py-1">
            {/* Root folder name */}
            <div className="px-3 pb-1 pt-2">
                <span className="block truncate font-mono text-[var(--spacing.2, 8px)] uppercase tracking-wider text-zinc-500" title={workspaceFiles.path}>
                    {workspaceFiles.name}
                </span>
            </div>

            {/* Tree nodes */}
            <div ref={treeRef} role="tree" aria-label="Project files" onKeyDown={handleKeyDown}>
                {workspaceFiles.children?.map(node => <FileNode key={node.path} node={node} focusedPath={focusedPath} setFocusedPath={setFocusedPath} />)}
            </div>
        </div>;
}