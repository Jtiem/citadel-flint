/**
 * AssetsPanel — src/components/editor/AssetsPanel.tsx
 *
 * Sidebar panel that lists injectable UI components from the registry.
 * Clicking a tile appends the component's JSX snippet to the currently
 * selected layer node and (if required) prepends its import declaration.
 *
 * If no layer is selected when a tile is clicked, a brief inline alert
 * is shown prompting the user to select a target first.
 *
 * Renderer Process only — no Node.js imports.
 */

import { useState } from 'react';
import { Package, MousePointerClick } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { componentRegistry } from '../../data/componentRegistry';
import type { RegistryEntry } from '../../data/componentRegistry';
import { ComponentSearch } from '../ui/ComponentSearch';
export function AssetsPanel() {
  const selectedNodeId = useEditorStore(state => state.selectedNodeId);
  const injectComponent = useEditorStore(state => state.injectComponent);
  const [alert, setAlert] = useState<string | null>(null);
  function handleInsert(entry: RegistryEntry): void {
    if (selectedNodeId === null) {
      setAlert('Select a target layer first.');
      // Auto-dismiss after 3 s
      setTimeout(() => setAlert(null), 3000);
      return;
    }
    injectComponent(selectedNodeId, entry.snippet, entry.importStmt);
  }
  return <div className="flex flex-col gap-3 p-3">
            {/* Live registry search */}
            <ComponentSearch />

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Inline alert — shown when no layer is selected */}
            {alert !== null && <div className="flex items-center gap-2 rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
                    <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
                    {alert}
                </div>}

            {/* Quick Insert */}
            <span className="text-[var(--spacing.2, 8px)] font-semibold uppercase tracking-wider text-zinc-400">
                Quick Insert
            </span>

            {componentRegistry.map(entry => <button key={entry.id} type="button" onClick={() => handleInsert(entry)} className="flex items-center gap-2.5 rounded-lg border border-gray-700/60 bg-gray-800/50 px-3 py-2.5 text-left transition-colors hover:border-indigo-600/50 hover:bg-gray-700/50">
                    <Package className="h-4 w-4 shrink-0 text-gray-500" />
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-gray-200">
                            {entry.name}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[var(--spacing.2, 8px)] text-zinc-500">
                            {entry.snippet}
                        </div>
                    </div>
                </button>)}
        </div>;
}