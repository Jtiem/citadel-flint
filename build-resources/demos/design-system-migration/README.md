# Demo: Design System Migration

**What you'll learn:** Flint migrates your entire design system forward safely, file by file.

## The scenario
A component library being migrated from Tailwind v3 to v4, with renamed design tokens. Some components have been updated, others haven't — this is the typical mid-migration state.

## What to try
1. Open `Button.tsx` — see deprecated Tailwind v3 class violations
2. Say **"migrate to Tailwind v4"** → `flint_migrate_tw` transforms all 6 deprecated classes
3. Open `Card.tsx` — see token reference violations (v3 paths pointing to renamed v3 tokens)
4. Say **"run migration"** → `flint_migrate_ds` renames all token references to v4 paths
5. Check the debt report — watch the score climb as violations are resolved

## The violations
**Button.tsx (6 Tailwind v3 violations):**
- `shadow-sm` → `shadow` (utility renamed in v4)
- `text-gray-600` → `text-zinc-600` (palette renamed)
- `bg-gray-100` → `bg-zinc-100` (palette renamed)
- `hover:bg-gray-200` → `hover:bg-zinc-200` (palette renamed)
- `ring-offset-2` → `ring-2 ring-offset-2` (API change)

**Card.tsx (2 token path violations):**
- `colors.primary` → `colors.brand.primary` (DTCG migration)
- `colors.gray.600` → `colors.neutral.600` (DTCG migration)

## Learning outcome
"Flint migrates your entire design system forward safely, one file at a time."
