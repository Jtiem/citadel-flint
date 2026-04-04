/**
 * ComponentPanel — src/components/ui/ComponentPanel.tsx
 *
 * Phase GLASS.1b: Left-sidebar component browser that replaces the Build mode
 * canvas for component discovery and insertion.
 *
 * Features:
 *   - Search bar with debounced text input (filters by component name)
 *   - Category dropdown filter (primitive/molecule/organism/page/layout/uncategorized)
 *   - Result count badge
 *   - Collapsible "Recipes" section at top
 *   - Compact card list (vertical scrollable, not a spatial canvas)
 *   - Each card: thumbnail, name, category badge, variant count, Insert button
 *   - Clicking a card loads that component's file in the editor
 *   - Insert button injects <ComponentName /> into the active file
 *   - Drag handle on each card for drag-to-insert
 *
 * Data source: componentCardStore (fetches via `components:list` IPC).
 *
 * Mithril Safety:
 *   - All className strings use palette token classes only.
 *   - No hardcoded hex, no arbitrary Tailwind values.
 *
 * Process boundary compliance:
 *   - No fs/Node imports. Cross-store coordination happens via callbacks.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Search, ChevronDown, ChevronRight, Boxes } from 'lucide-react'
import { useComponentCardStore } from '../../store/componentCardStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useEditorStore } from '../../store/editorStore'
import { useNotificationStore } from '../../store/notificationStore'
import { ComponentPanelCard } from './ComponentPanelCard'
import { EmptyState } from './EmptyState'
import { BUILTIN_RECIPES, type ComponentRecipe } from '../../data/builtinRecipes'
import type { ComponentCategory } from '../../types/flint-api'

// MED-02: Only allow characters safe for use in an ES module import specifier.
// Blocks injection of quotes, backticks, semicolons, or other code-breaking chars.
const SAFE_IMPORT_PATTERN = /^[a-zA-Z0-9@/_.-]+$/

// ── Category filter options ────────────────────────────────────────────────

const CATEGORY_OPTIONS: Array<{ value: ComponentCategory | 'all'; label: string }> = [
    { value: 'all',           label: 'All' },
    { value: 'primitive',     label: 'Primitive' },
    { value: 'molecule',      label: 'Molecule' },
    { value: 'organism',      label: 'Organism' },
    { value: 'page',          label: 'Page' },
    { value: 'layout',        label: 'Layout' },
    { value: 'uncategorized', label: 'Uncategorized' },
]

// ── Debounce hook ──────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs)
        return () => clearTimeout(timer)
    }, [value, delayMs])
    return debounced
}

// ── Recipe section ─────────────────────────────────────────────────────────

function RecipeSection() {
    const [expanded, setExpanded] = useState(false)
    const injectComponent = useEditorStore((s) => s.injectComponent)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)

    const handleInsert = useCallback(
        (recipe: ComponentRecipe) => {
            injectComponent(
                '',
                recipe.jsxSnippet,
                recipe.imports.join('\n'),
            )
        },
        [injectComponent],
    )

    return (
        <div className="border-b border-zinc-800" data-testid="recipe-section">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors"
                data-testid="recipe-section-toggle"
            >
                {expanded
                    ? <ChevronDown size={10} />
                    : <ChevronRight size={10} />}
                Recipes ({BUILTIN_RECIPES.length})
            </button>
            {expanded && (
                <div className="flex flex-col gap-1 px-3 pb-2" data-testid="recipe-section-list">
                    {BUILTIN_RECIPES.map((recipe) => (
                        <button
                            key={recipe.id}
                            type="button"
                            onClick={() => handleInsert(recipe)}
                            disabled={!activeFilePath}
                            title={recipe.description}
                            data-testid={`recipe-panel-chip-${recipe.id}`}
                            className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-left text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <span className="font-medium">{recipe.name}</span>
                            <span className="text-[10px] text-zinc-500">{recipe.category}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── ComponentPanel ─────────────────────────────────────────────────────────

export function ComponentPanel() {
    const [searchInput, setSearchInput] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<ComponentCategory | 'all'>('all')
    const debouncedSearch = useDebouncedValue(searchInput, 200)

    const cards = useComponentCardStore((s) => s.cards)
    const isLoaded = useComponentCardStore((s) => s.isLoaded)
    const isLoading = useComponentCardStore((s) => s.isLoading)
    const loadCards = useComponentCardStore((s) => s.loadCards)
    const activeFilePath = useCanvasStore((s) => s.activeFilePath)
    const activeSelection = useCanvasStore((s) => s.activeSelection)
    const setActiveFile = useCanvasStore((s) => s.setActiveFile)
    const injectComponent = useEditorStore((s) => s.injectComponent)
    const pushNotification = useNotificationStore((s) => s.push)

    // Track whether we've triggered loadCards to avoid double-firing
    const loadTriggeredRef = useRef(false)

    // Load cards on mount if not already loaded
    useEffect(() => {
        if (!isLoaded && !isLoading && !loadTriggeredRef.current) {
            loadTriggeredRef.current = true
            void loadCards()
        }
    }, [isLoaded, isLoading, loadCards])

    // Filter cards by search + category
    const filteredCards = useMemo(() => {
        const query = debouncedSearch.trim().toLowerCase()
        return cards.filter((card) => {
            const matchesSearch = query === '' || card.name.toLowerCase().includes(query)
            const matchesCategory = categoryFilter === 'all' || card.category === categoryFilter
            return matchesSearch && matchesCategory
        })
    }, [cards, debouncedSearch, categoryFilter])

    const handleSelect = useCallback(
        (filePath: string) => {
            void setActiveFile(filePath)
        },
        [setActiveFile],
    )

    const handleInsert = useCallback(
        (name: string, importPath: string) => {
            if (!activeFilePath) return

            // Require a selected node — without one the insert target is unknown
            // and the operation would silently fail.
            const targetNodeId = activeSelection ?? ''
            if (!targetNodeId) {
                pushNotification({
                    type: 'info',
                    title: 'Select an element first',
                    message: 'Click an element in the preview to set an insert target, then insert.',
                    severity: 'warning',
                    autoDismissMs: 4000,
                })
                return
            }

            // MED-02: Reject names/paths that could inject arbitrary code into the
            // import snippet string that gets written to the AST.
            if (!SAFE_IMPORT_PATTERN.test(name) || !SAFE_IMPORT_PATTERN.test(importPath)) {
                pushNotification({
                    type: 'error',
                    title: 'Invalid component',
                    message: 'Component name or import path contains invalid characters.',
                })
                return
            }

            injectComponent(
                targetNodeId,
                `<${name} />`,
                `import { ${name} } from '${importPath}';`,
            )
        },
        [activeFilePath, activeSelection, injectComponent, pushNotification],
    )

    return (
        <div className="flex h-full flex-col" data-testid="component-panel">
            {/* Search bar + category filter */}
            <div className="flex flex-col gap-1.5 border-b border-zinc-800 px-3 py-2">
                <div className="relative">
                    <Search
                        size={12}
                        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500"
                    />
                    <input
                        type="text"
                        placeholder="Search components..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        data-testid="component-panel-search"
                        className="w-full rounded border border-zinc-800 bg-zinc-900 py-1 pl-7 pr-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as ComponentCategory | 'all')}
                        data-testid="component-panel-category-filter"
                        className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 outline-none focus:border-indigo-500/50"
                    >
                        {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <span
                        className="text-[10px] text-zinc-500"
                        data-testid="component-panel-count"
                    >
                        {filteredCards.length} component{filteredCards.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Collapsible Recipes section */}
            <RecipeSection />

            {/* Component card list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                {isLoading && (
                    <div className="flex items-center justify-center py-8" data-testid="component-panel-loading">
                        <div className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
                    </div>
                )}

                {!isLoading && filteredCards.length === 0 && (
                    <div data-testid="component-panel-empty">
                        <EmptyState
                            icon={<Boxes className="h-5 w-5 text-zinc-600" />}
                            title={cards.length === 0 ? 'No components registered yet.' : 'No components match your search.'}
                            description={cards.length === 0 ? 'Open a project with a flint-manifest.json to see components here.' : undefined}
                        />
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    {filteredCards.map((card) => (
                        <ComponentPanelCard
                            key={card.id}
                            name={card.name}
                            category={card.category}
                            variantCount={card.variantCount}
                            importPath={card.importPath}
                            onSelect={() => handleSelect(card.filePath)}
                            onInsert={() => handleInsert(card.name, card.importPath)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
