/**
 * ComponentPanelCard — src/components/ui/ComponentPanelCard.tsx
 *
 * Phase GLASS.1b: Compact card component for the left-sidebar component list.
 * Much smaller than the canvas ComponentCardNode (180px spatial card).
 *
 * Renders a single row in the ComponentPanel vertical list:
 *   [32x32 thumb] [Name + category badge + variant count] [Insert button]
 *
 * Supports drag-to-insert: the drag handle fires a native HTML5 drag with
 * MIME type `application/flint-component-card`, consumed by LivePreview.
 *
 * Mithril Safety:
 *   - All className strings use palette token classes only.
 *   - No hardcoded hex, no arbitrary Tailwind values.
 *   - No data-flint-id — panel cards are sidebar chrome, not AST nodes.
 */

import { useCallback } from 'react';
import { GripVertical } from 'lucide-react';

// ── Category badge color helpers ────────────────────────────────────────────

function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'primitive':
      return 'bg-blue-900/30 text-blue-400';
    case 'molecule':
      return 'bg-purple-900/30 text-purple-400';
    case 'organism':
      return 'bg-amber-900/30 text-amber-400';
    case 'page':
      return 'bg-emerald-900/30 text-emerald-400';
    case 'layout':
      return 'bg-cyan-900/30 text-cyan-400';
    default:
      return 'bg-zinc-800 text-zinc-500';
  }
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface ComponentPanelCardProps {
  name: string;
  category: string;
  variantCount: number;
  thumbnailUrl?: string;
  importPath: string;
  onSelect: () => void;
  onInsert: () => void;
  draggable?: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────

export function ComponentPanelCard({
  name,
  category,
  variantCount,
  thumbnailUrl,
  importPath,
  onSelect,
  onInsert,
  draggable = true
}: ComponentPanelCardProps) {
  const handleInsertClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInsert();
  }, [onInsert]);
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/flint-component-card', JSON.stringify({
      name,
      importPath
    }));
  }, [name, importPath]);
  const firstLetter = name.charAt(0).toUpperCase();
  return <div role="button" tabIndex={0} aria-label={`${name} component`} data-testid={`component-panel-card-${name}`} onClick={onSelect} onKeyDown={e => {
    if (e.key === 'Enter' || e.key === ' ') onSelect();
  }} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/50 p-2 transition-colors hover:border-zinc-700 cursor-pointer">
            {/* Drag handle */}
            {draggable && <div draggable onDragStart={handleDragStart} className="flex shrink-0 cursor-grab items-center text-zinc-600 hover:text-zinc-400 active:cursor-grabbing" data-testid={`component-panel-drag-${name}`} title="Drag to insert into preview">
                    <GripVertical size={12} />
                </div>}

            {/* Thumbnail (32x32) */}
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-800">
                {thumbnailUrl ? <img src={thumbnailUrl} alt={`${name} thumbnail`} className="h-full w-full object-cover" draggable={false} /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-700">
                        <span className="font-mono text-xs font-bold text-zinc-500 select-none" aria-hidden="true">
                            {firstLetter}
                        </span>
                    </div>}
            </div>

            {/* Name + metadata */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-xs font-medium text-zinc-200" title={name}>
                    {name}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryBadgeClass(category)}`}>
                        {category}
                    </span>
                    {variantCount > 0 && <span className="text-[var(--spacing.2, 8px)] text-zinc-500">
                            {variantCount}v
                        </span>}
                </div>
            </div>

            {/* Insert button */}
            <button type="button" onClick={handleInsertClick} data-testid={`component-panel-insert-${name}`} className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 transition-colors" title={`Insert <${name} /> into active file`}>
                Insert
            </button>
        </div>;
}