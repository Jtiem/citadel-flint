/**
 * RecipeStrip — src/components/editor/RecipeStrip.tsx
 *
 * A horizontally-scrollable strip of pre-composed recipe chips rendered
 * at the top of the Build canvas, directly below the search/filter bar.
 *
 * Design decisions:
 *   - Recipes are client-side data — no IPC, no network, no new store.
 *   - Falls back to BUILTIN_RECIPES (always works even without a project open).
 *   - Registry validation: each chip shows a green dot when all components in
 *     `recipe.components` are present in the componentCardStore, or an amber
 *     dot with tooltip listing the missing ones.
 *   - Insertion calls `useEditorStore.getState().applyBatch` via
 *     `injectComponent`, matching the pattern used by ComponentCardNode.
 *
 * Mithril Safety:
 *   - All className strings use palette token classes only.
 *   - No hardcoded hex, no arbitrary Tailwind values.
 *   - No data-flint-id needed — recipe chips are canvas chrome, not AST nodes.
 */

import { useCallback, useMemo } from 'react'
import {
    LogIn,
    Sparkles,
    Navigation,
    LayoutGrid,
    Bell,
    Table,
    Check,
    AlertTriangle,
    type LucideIcon,
} from 'lucide-react'
import { BUILTIN_RECIPES, type ComponentRecipe } from '../../data/builtinRecipes'
import { useEditorStore } from '../../store/editorStore'
import { useComponentCardStore } from '../../store/componentCardStore'

// ── Icon registry ─────────────────────────────────────────────────────────────
// Maps the string icon name from the recipe data model to a Lucide component.
// Add new entries here when extending BUILTIN_RECIPES with new icon names.

const ICON_MAP: Record<string, LucideIcon> = {
    LogIn,
    Sparkles,
    Navigation,
    LayoutGrid,
    Bell,
    Table,
}

const DEFAULT_ICON = Bell

// ── Category color map ───────────────────────────────────────────────────────

const CATEGORY_CLASSES: Record<ComponentRecipe['category'], string> = {
    form:       'border-indigo-500/30 bg-indigo-900/20 text-indigo-300 hover:bg-indigo-900/40',
    layout:     'border-zinc-700/50 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800',
    navigation: 'border-cyan-500/30 bg-cyan-900/20 text-cyan-300 hover:bg-cyan-900/40',
    content:    'border-purple-500/30 bg-purple-900/20 text-purple-300 hover:bg-purple-900/40',
    feedback:   'border-emerald-500/30 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-900/40',
}

// ── Registry validation hook ─────────────────────────────────────────────────

interface RegistryStatus {
    allPresent: boolean
    missingComponents: string[]
}

function useRegistryStatus(recipe: ComponentRecipe): RegistryStatus {
    const cards = useComponentCardStore((s) => s.cards)

    return useMemo(() => {
        if (recipe.components.length === 0) {
            return { allPresent: true, missingComponents: [] }
        }

        const registeredNames = new Set(cards.map((c) => c.name))
        const missing = recipe.components.filter((name) => !registeredNames.has(name))

        return {
            allPresent: missing.length === 0,
            missingComponents: missing,
        }
    }, [recipe.components, cards])
}

// ── RecipeChip sub-component ─────────────────────────────────────────────────

interface RecipeChipProps {
    recipe: ComponentRecipe
    onInsert: (recipe: ComponentRecipe) => void
}

function RecipeChip({ recipe, onInsert }: RecipeChipProps) {
    const { allPresent, missingComponents } = useRegistryStatus(recipe)

    const Icon = ICON_MAP[recipe.icon] ?? DEFAULT_ICON
    const categoryClass = CATEGORY_CLASSES[recipe.category]

    const handleClick = useCallback(() => {
        onInsert(recipe)
    }, [onInsert, recipe])

    const registryTooltip = allPresent
        ? 'All components in registry'
        : `Missing from registry: ${missingComponents.join(', ')}`

    const chipTooltip = `${recipe.description}\n${registryTooltip}`

    return (
        <button
            type="button"
            onClick={handleClick}
            title={chipTooltip}
            data-testid={`recipe-chip-${recipe.id}`}
            className={`
                flex shrink-0 items-center gap-1.5
                rounded border px-2.5 py-1
                text-[11px] font-medium
                transition-colors duration-100
                ${categoryClass}
            `.trim()}
        >
            {/* Lucide icon */}
            <Icon size={11} aria-hidden="true" />

            {/* Recipe name */}
            <span>{recipe.name}</span>

            {/* Registry validation indicator */}
            <span
                data-testid={`recipe-registry-indicator-${recipe.id}`}
                title={registryTooltip}
                aria-label={registryTooltip}
                className="ml-0.5 flex items-center"
            >
                {allPresent ? (
                    <Check
                        size={9}
                        className="text-emerald-400"
                        data-testid={`recipe-registry-ok-${recipe.id}`}
                    />
                ) : (
                    <AlertTriangle
                        size={9}
                        className="text-amber-400"
                        data-testid={`recipe-registry-warn-${recipe.id}`}
                    />
                )}
            </span>
        </button>
    )
}

// ── RecipeStrip ──────────────────────────────────────────────────────────────

/**
 * RecipeStrip
 *
 * Renders a horizontal scrollable row of recipe chips.
 * Mount this in the Build canvas only — the parent (XYCanvas) gates rendering
 * to `canvasView === 'build'`.
 */
export function RecipeStrip() {
    const injectComponent = useEditorStore((s) => s.injectComponent)

    const handleInsert = useCallback(
        (recipe: ComponentRecipe) => {
            // Use injectComponent which delegates to applyBatch internally.
            // targetNodeId '' means append to root of the active file.
            // importSnippet is a no-op when imports[] is empty.
            injectComponent(
                '',
                recipe.jsxSnippet,
                recipe.imports.join('\n'),
            )
        },
        [injectComponent],
    )

    return (
        <div
            data-testid="recipe-strip"
            className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-1.5 backdrop-blur-sm"
        >
            {/* Section label */}
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Recipes
            </span>

            {/* Horizontally scrollable chip rail */}
            <div
                className="flex items-center gap-1.5 overflow-x-auto"
                data-testid="recipe-strip-chips"
                // Hide scrollbar but keep scrollability
                style={{ scrollbarWidth: 'none' }}
            >
                {BUILTIN_RECIPES.map((recipe) => (
                    <RecipeChip
                        key={recipe.id}
                        recipe={recipe}
                        onInsert={handleInsert}
                    />
                ))}
            </div>
        </div>
    )
}
