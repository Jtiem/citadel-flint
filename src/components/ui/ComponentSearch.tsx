/**
 * ComponentSearch.tsx — Phase HYDRO.1-C
 *
 * Live component registry search panel rendered in the "assets" tab of the
 * left sidebar. Queries the Flint MCP `flint_query_registry` tool with a
 * debounced text input and renders actionable Insert buttons that invoke
 * `editorStore.injectComponent` on the selected layer.
 *
 * Renderer Process only — no Node.js imports.
 * All external I/O routes through `window.flintAPI.mcp?.callTool`.
 */

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, MousePointerClick } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useNotificationStore } from '../../store/notificationStore';
import type { MCPCallResult } from '../../types/flint-api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegistrySearchResult {
  name: string;
  importPath: string;
  description?: string;
  variants?: string[];
}

// ── Shadow Storybook parser ───────────────────────────────────────────────────

/**
 * Parses the Shadow Storybook markdown returned by `flint_query_registry`.
 * Splits on `### ` headings and extracts:
 *   - Component name (heading text)
 *   - **Import**: `path`
 *   - First non-empty line after the heading as description
 *   - **Variants**: list
 */
function parseShadowStorybook(markdown: string): RegistrySearchResult[] {
  const results: RegistrySearchResult[] = [];

  // Split on section headings (### ComponentName)
  const sections = markdown.split(/\n(?=### )/);
  for (const section of sections) {
    const headingMatch = section.match(/^### (.+)/);
    if (!headingMatch) continue;
    const name = headingMatch[1].trim();

    // Extract import path: **Import**: `@/components/ui/Foo`
    const importMatch = section.match(/\*\*Import\*\*:\s*`([^`]+)`/);
    if (!importMatch) continue;
    const importPath = importMatch[1].trim();

    // Extract description: first non-empty line after the heading that is
    // not a markdown directive (**...**)
    let description: string | undefined;
    const bodyLines = section.split('\n').slice(1) // skip the heading line
    .map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('**') && !l.startsWith('---') && !l.startsWith('#'));
    if (bodyLines.length > 0) {
      description = bodyLines[0];
    }

    // Extract variants: **Variants**: default, destructive, outline
    let variants: string[] | undefined;
    const variantsMatch = section.match(/\*\*Variants\*\*:\s*(.+)/);
    if (variantsMatch) {
      variants = variantsMatch[1].split(',').map(v => v.trim()).filter(Boolean);
    }
    results.push({
      name,
      importPath,
      description,
      variants
    });
  }
  return results;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ComponentSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegistrySearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insertAlert, setInsertAlert] = useState<string | null>(null);

  // Debounce timer ref — cleared on each keystroke
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedNodeId = useEditorStore(state => state.selectedNodeId);
  const injectComponent = useEditorStore(state => state.injectComponent);
  const pushNotification = useNotificationStore(s => s.push);

  // ── Search effect ─────────────────────────────────────────────────────────

  useEffect(() => {
    // Clear previous timer
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }

    // Reset state when query is too short
    if (query.length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    debounceRef.current = setTimeout(async () => {
      try {
        if (!window.flintAPI.mcp) {
          setError('Search unavailable');
          setLoading(false);
          return;
        }
        const result: MCPCallResult = await window.flintAPI.mcp.callTool('flint_query_registry', {
          query,
          limit: 5
        });
        if (result.isError === true) {
          setError('Search unavailable');
          setResults(null);
          return;
        }
        const text = result.content[0]?.text ?? '';
        const parsed = parseShadowStorybook(text);
        setResults(parsed);
      } catch {
        setError('Search unavailable');
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // ── Insert handler ────────────────────────────────────────────────────────

  function handleInsert(component: RegistrySearchResult): void {
    if (selectedNodeId === null) {
      setInsertAlert('Select a target layer first');
      setTimeout(() => setInsertAlert(null), 3000);
      return;
    }
    const snippet = `<${component.name} />`;
    const importStmt = `import { ${component.name} } from '${component.importPath}';`;
    injectComponent(selectedNodeId, snippet, importStmt);
    pushNotification({
      type: 'mutation',
      severity: 'success',
      title: `${component.name} inserted`,
      message: 'Component added to selected layer — Cmd+Z to undo',
      autoDismissMs: 3000
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return <div className="flex flex-col gap-2">
            {/* Search Input */}
            <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search components" placeholder="Search components..." className="w-full rounded-md border border-zinc-700/60 bg-zinc-800/60 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500/60 focus:ring-0" />
                {loading && <Loader2 role="status" aria-label="Searching" className="absolute right-2.5 h-3.5 w-3.5 animate-spin text-zinc-500" />}
            </div>

            {/* Insert alert — shown when no layer is selected */}
            {insertAlert !== null && <div className="flex items-center gap-2 rounded-md border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-300">
                    <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
                    {insertAlert}
                </div>}

            {/* Empty state — no query entered */}
            {query.length < 2 && !loading && <p className="px-1 text-[var(--spacing.2, 8px)] text-zinc-500">
                    Search your component registry
                </p>}

            {/* Error state */}
            {error !== null && <p className="px-1 text-[var(--spacing.2, 8px)] text-red-400">{error}</p>}

            {/* No results state */}
            {results !== null && results.length === 0 && error === null && <p className="px-1 text-[var(--spacing.2, 8px)] text-zinc-500">No components found</p>}

            {/* Results list */}
            {results !== null && results.length > 0 && <div className="flex flex-col gap-1.5">
                    {results.map(component => <div key={component.name} className="flex items-start justify-between gap-2 rounded-md border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-2">
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-zinc-200">
                                    {component.name}
                                </div>
                                <div className="mt-0.5 truncate font-mono text-[var(--spacing.2, 8px)] text-zinc-500">
                                    {component.importPath}
                                </div>
                                {component.description && <div className="mt-0.5 truncate text-[var(--spacing.2, 8px)] text-zinc-400">
                                        {component.description}
                                    </div>}
                            </div>
                            <button type="button" onClick={() => handleInsert(component)} aria-label={`Insert ${component.name}`} className="shrink-0 rounded px-2 py-1 text-[var(--spacing.2, 8px)] font-medium text-indigo-300 hover:bg-indigo-900/30 hover:text-indigo-200 transition-colors">
                                Insert
                            </button>
                        </div>)}
                </div>}
        </div>;
}