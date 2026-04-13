/**
 * Library Seed Tokens — server/services/librarySeedTokens.ts
 *
 * FORGE.NP: Provides pre-built DTCG token arrays for each supported library.
 * These are the same tokens returned by each adapter's seedTokens() method
 * in flint-mcp/src/core/libraryAdapters/, duplicated here to avoid a
 * cross-package import dependency.
 *
 * Pure data — no I/O, no adapter logic.
 */

export type SupportedLibrary = 'shadcn' | 'mui' | 'primeng' | 'tailwind' | 'none'

interface SeedToken {
    id: number
    token_path: string
    token_type: string
    token_value: string
    description: string
    collection_name: string
    mode: string
}

// ---------------------------------------------------------------------------
// shadcn/ui — neutral theme (verified against ui.shadcn.com/themes)
// ---------------------------------------------------------------------------

const SHADCN_TOKENS: SeedToken[] = [
    { id: 1,  token_path: 'shadcn.background',             token_type: 'color', token_value: '#ffffff', description: 'Default page background',            collection_name: 'shadcn', mode: 'Light' },
    { id: 2,  token_path: 'shadcn.foreground',              token_type: 'color', token_value: '#0a0a0a', description: 'Default body text color',            collection_name: 'shadcn', mode: 'Light' },
    { id: 3,  token_path: 'shadcn.primary',                 token_type: 'color', token_value: '#171717', description: 'Primary action color',               collection_name: 'shadcn', mode: 'Light' },
    { id: 4,  token_path: 'shadcn.primary-foreground',      token_type: 'color', token_value: '#fafafa', description: 'Text on primary backgrounds',        collection_name: 'shadcn', mode: 'Light' },
    { id: 5,  token_path: 'shadcn.secondary',               token_type: 'color', token_value: '#f5f5f5', description: 'Secondary action color',             collection_name: 'shadcn', mode: 'Light' },
    { id: 6,  token_path: 'shadcn.secondary-foreground',    token_type: 'color', token_value: '#171717', description: 'Text on secondary backgrounds',      collection_name: 'shadcn', mode: 'Light' },
    { id: 7,  token_path: 'shadcn.muted',                   token_type: 'color', token_value: '#f5f5f5', description: 'Muted background for subtle UI',     collection_name: 'shadcn', mode: 'Light' },
    { id: 8,  token_path: 'shadcn.muted-foreground',        token_type: 'color', token_value: '#737373', description: 'Text on muted backgrounds',          collection_name: 'shadcn', mode: 'Light' },
    { id: 9,  token_path: 'shadcn.accent',                  token_type: 'color', token_value: '#f5f5f5', description: 'Accent highlight color',             collection_name: 'shadcn', mode: 'Light' },
    { id: 10, token_path: 'shadcn.accent-foreground',       token_type: 'color', token_value: '#171717', description: 'Text on accent backgrounds',         collection_name: 'shadcn', mode: 'Light' },
    { id: 11, token_path: 'shadcn.destructive',             token_type: 'color', token_value: '#ef4444', description: 'Destructive action color',           collection_name: 'shadcn', mode: 'Light' },
    { id: 12, token_path: 'shadcn.destructive-foreground',  token_type: 'color', token_value: '#fafafa', description: 'Text on destructive backgrounds',    collection_name: 'shadcn', mode: 'Light' },
    { id: 13, token_path: 'shadcn.border',                  token_type: 'color', token_value: '#e5e5e5', description: 'Default border color',               collection_name: 'shadcn', mode: 'Light' },
    { id: 14, token_path: 'shadcn.input',                   token_type: 'color', token_value: '#e5e5e5', description: 'Input field border color',           collection_name: 'shadcn', mode: 'Light' },
    { id: 15, token_path: 'shadcn.ring',                    token_type: 'color', token_value: '#a3a3a3', description: 'Focus ring color (neutral-400)',      collection_name: 'shadcn', mode: 'Light' },
    { id: 16, token_path: 'shadcn.card',                    token_type: 'color', token_value: '#ffffff', description: 'Card surface background',            collection_name: 'shadcn', mode: 'Light' },
    { id: 17, token_path: 'shadcn.card-foreground',         token_type: 'color', token_value: '#0a0a0a', description: 'Text on card surfaces',              collection_name: 'shadcn', mode: 'Light' },
    { id: 18, token_path: 'shadcn.popover',                 token_type: 'color', token_value: '#ffffff', description: 'Popover surface background',         collection_name: 'shadcn', mode: 'Light' },
    { id: 19, token_path: 'shadcn.popover-foreground',      token_type: 'color', token_value: '#0a0a0a', description: 'Text on popover surfaces',           collection_name: 'shadcn', mode: 'Light' },
    { id: 20, token_path: 'shadcn.radius',                  token_type: 'dimension', token_value: '0.625rem', description: 'Default border radius (10px)', collection_name: 'shadcn', mode: 'Light' },
]

// ---------------------------------------------------------------------------
// Material UI — default blue theme
// ---------------------------------------------------------------------------

const MUI_TOKENS: SeedToken[] = [
    { id: 1,  token_path: 'mui.primary.main',         token_type: 'color', token_value: '#1976d2', description: 'Primary main (blue-700)',         collection_name: 'mui', mode: 'Light' },
    { id: 2,  token_path: 'mui.primary.light',        token_type: 'color', token_value: '#42a5f5', description: 'Primary light (blue-400)',        collection_name: 'mui', mode: 'Light' },
    { id: 3,  token_path: 'mui.primary.dark',         token_type: 'color', token_value: '#1565c0', description: 'Primary dark (blue-800)',         collection_name: 'mui', mode: 'Light' },
    { id: 4,  token_path: 'mui.primary.contrastText', token_type: 'color', token_value: '#ffffff', description: 'Text on primary backgrounds',     collection_name: 'mui', mode: 'Light' },
    { id: 5,  token_path: 'mui.secondary.main',       token_type: 'color', token_value: '#9c27b0', description: 'Secondary main (purple-600)',     collection_name: 'mui', mode: 'Light' },
    { id: 6,  token_path: 'mui.secondary.light',      token_type: 'color', token_value: '#ba68c8', description: 'Secondary light (purple-300)',    collection_name: 'mui', mode: 'Light' },
    { id: 7,  token_path: 'mui.secondary.dark',       token_type: 'color', token_value: '#7b1fa2', description: 'Secondary dark (purple-800)',     collection_name: 'mui', mode: 'Light' },
    { id: 8,  token_path: 'mui.error.main',           token_type: 'color', token_value: '#d32f2f', description: 'Error main (red-700)',            collection_name: 'mui', mode: 'Light' },
    { id: 9,  token_path: 'mui.warning.main',         token_type: 'color', token_value: '#ed6c02', description: 'Warning main (orange-800)',       collection_name: 'mui', mode: 'Light' },
    { id: 10, token_path: 'mui.info.main',            token_type: 'color', token_value: '#0288d1', description: 'Info main (lightblue-700)',       collection_name: 'mui', mode: 'Light' },
    { id: 11, token_path: 'mui.success.main',         token_type: 'color', token_value: '#2e7d32', description: 'Success main (green-800)',        collection_name: 'mui', mode: 'Light' },
    { id: 12, token_path: 'mui.background.default',   token_type: 'color', token_value: '#ffffff', description: 'Default background',              collection_name: 'mui', mode: 'Light' },
    { id: 13, token_path: 'mui.background.paper',     token_type: 'color', token_value: '#ffffff', description: 'Paper surface background',        collection_name: 'mui', mode: 'Light' },
    { id: 14, token_path: 'mui.text.primary',         token_type: 'color', token_value: '#212121', description: 'Primary text color',              collection_name: 'mui', mode: 'Light' },
    { id: 15, token_path: 'mui.text.secondary',       token_type: 'color', token_value: '#757575', description: 'Secondary text color',            collection_name: 'mui', mode: 'Light' },
    { id: 16, token_path: 'mui.divider',              token_type: 'color', token_value: '#e0e0e0', description: 'Divider/border color',            collection_name: 'mui', mode: 'Light' },
    { id: 17, token_path: 'mui.shape.borderRadius',   token_type: 'dimension', token_value: '4px', description: 'Default border radius',          collection_name: 'mui', mode: 'Light' },
    { id: 18, token_path: 'mui.spacing.unit',         token_type: 'dimension', token_value: '8px', description: 'Base spacing unit',               collection_name: 'mui', mode: 'Light' },
]

// ---------------------------------------------------------------------------
// PrimeNG — Aura preset base colors
// ---------------------------------------------------------------------------

const PRIMENG_TOKENS: SeedToken[] = [
    { id: 1,  token_path: 'primeng.primary.500',       token_type: 'color', token_value: '#6366f1', description: 'Primary 500 (indigo)',          collection_name: 'primeng', mode: 'Light' },
    { id: 2,  token_path: 'primeng.primary.400',       token_type: 'color', token_value: '#818cf8', description: 'Primary 400',                  collection_name: 'primeng', mode: 'Light' },
    { id: 3,  token_path: 'primeng.primary.600',       token_type: 'color', token_value: '#4f46e5', description: 'Primary 600',                  collection_name: 'primeng', mode: 'Light' },
    { id: 4,  token_path: 'primeng.primary.50',        token_type: 'color', token_value: '#eef2ff', description: 'Primary 50',                   collection_name: 'primeng', mode: 'Light' },
    { id: 5,  token_path: 'primeng.primary.900',       token_type: 'color', token_value: '#312e81', description: 'Primary 900',                  collection_name: 'primeng', mode: 'Light' },
    { id: 6,  token_path: 'primeng.surface.0',         token_type: 'color', token_value: '#ffffff', description: 'Surface white',                collection_name: 'primeng', mode: 'Light' },
    { id: 7,  token_path: 'primeng.surface.50',        token_type: 'color', token_value: '#fafafa', description: 'Surface 50',                   collection_name: 'primeng', mode: 'Light' },
    { id: 8,  token_path: 'primeng.surface.100',       token_type: 'color', token_value: '#f4f4f5', description: 'Surface 100',                  collection_name: 'primeng', mode: 'Light' },
    { id: 9,  token_path: 'primeng.surface.200',       token_type: 'color', token_value: '#e4e4e7', description: 'Surface 200',                  collection_name: 'primeng', mode: 'Light' },
    { id: 10, token_path: 'primeng.surface.500',       token_type: 'color', token_value: '#71717a', description: 'Surface 500',                  collection_name: 'primeng', mode: 'Light' },
    { id: 11, token_path: 'primeng.surface.900',       token_type: 'color', token_value: '#18181b', description: 'Surface 900',                  collection_name: 'primeng', mode: 'Light' },
    { id: 12, token_path: 'primeng.red.500',           token_type: 'color', token_value: '#ef4444', description: 'Error/danger red',             collection_name: 'primeng', mode: 'Light' },
    { id: 13, token_path: 'primeng.green.500',         token_type: 'color', token_value: '#22c55e', description: 'Success green',                collection_name: 'primeng', mode: 'Light' },
    { id: 14, token_path: 'primeng.yellow.500',        token_type: 'color', token_value: '#eab308', description: 'Warning yellow',               collection_name: 'primeng', mode: 'Light' },
    { id: 15, token_path: 'primeng.blue.500',          token_type: 'color', token_value: '#3b82f6', description: 'Info blue',                    collection_name: 'primeng', mode: 'Light' },
    { id: 16, token_path: 'primeng.borderRadius',      token_type: 'dimension', token_value: '6px', description: 'Default border radius',       collection_name: 'primeng', mode: 'Light' },
]

// ---------------------------------------------------------------------------
// Tailwind CSS v4 — canonical base scale
// ---------------------------------------------------------------------------

const TAILWIND_TOKENS: SeedToken[] = [
    { id: 1,  token_path: 'tailwind.blue.50',    token_type: 'color', token_value: '#eff6ff', description: 'Blue 50',    collection_name: 'tailwind', mode: 'Light' },
    { id: 2,  token_path: 'tailwind.blue.100',   token_type: 'color', token_value: '#dbeafe', description: 'Blue 100',   collection_name: 'tailwind', mode: 'Light' },
    { id: 3,  token_path: 'tailwind.blue.500',   token_type: 'color', token_value: '#3b82f6', description: 'Blue 500',   collection_name: 'tailwind', mode: 'Light' },
    { id: 4,  token_path: 'tailwind.blue.600',   token_type: 'color', token_value: '#2563eb', description: 'Blue 600',   collection_name: 'tailwind', mode: 'Light' },
    { id: 5,  token_path: 'tailwind.blue.700',   token_type: 'color', token_value: '#1d4ed8', description: 'Blue 700',   collection_name: 'tailwind', mode: 'Light' },
    { id: 6,  token_path: 'tailwind.gray.50',    token_type: 'color', token_value: '#f9fafb', description: 'Gray 50',    collection_name: 'tailwind', mode: 'Light' },
    { id: 7,  token_path: 'tailwind.gray.100',   token_type: 'color', token_value: '#f3f4f6', description: 'Gray 100',   collection_name: 'tailwind', mode: 'Light' },
    { id: 8,  token_path: 'tailwind.gray.200',   token_type: 'color', token_value: '#e5e7eb', description: 'Gray 200',   collection_name: 'tailwind', mode: 'Light' },
    { id: 9,  token_path: 'tailwind.gray.500',   token_type: 'color', token_value: '#6b7280', description: 'Gray 500',   collection_name: 'tailwind', mode: 'Light' },
    { id: 10, token_path: 'tailwind.gray.900',   token_type: 'color', token_value: '#111827', description: 'Gray 900',   collection_name: 'tailwind', mode: 'Light' },
    { id: 11, token_path: 'tailwind.red.500',    token_type: 'color', token_value: '#ef4444', description: 'Red 500',    collection_name: 'tailwind', mode: 'Light' },
    { id: 12, token_path: 'tailwind.green.500',  token_type: 'color', token_value: '#22c55e', description: 'Green 500',  collection_name: 'tailwind', mode: 'Light' },
    { id: 13, token_path: 'tailwind.yellow.500', token_type: 'color', token_value: '#eab308', description: 'Yellow 500', collection_name: 'tailwind', mode: 'Light' },
    { id: 14, token_path: 'tailwind.white',      token_type: 'color', token_value: '#ffffff', description: 'White',      collection_name: 'tailwind', mode: 'Light' },
    { id: 15, token_path: 'tailwind.black',      token_type: 'color', token_value: '#000000', description: 'Black',      collection_name: 'tailwind', mode: 'Light' },
]

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const TOKEN_REGISTRY: Record<string, SeedToken[]> = {
    shadcn: SHADCN_TOKENS,
    mui: MUI_TOKENS,
    primeng: PRIMENG_TOKENS,
    tailwind: TAILWIND_TOKENS,
}

/**
 * Get pre-built seed tokens for a library.
 * Returns an empty array for 'none' or unknown libraries.
 */
export function getSeedTokens(library: string): SeedToken[] {
    return TOKEN_REGISTRY[library] ?? []
}

/**
 * Display metadata for the library picker UI.
 */
export const LIBRARY_OPTIONS: Array<{
    id: SupportedLibrary
    displayName: string
    description: string
}> = [
    { id: 'shadcn',   displayName: 'shadcn/ui',      description: 'CSS variables + Tailwind utilities' },
    { id: 'mui',      displayName: 'Material UI',     description: 'MUI createTheme + sx prop' },
    { id: 'primeng',  displayName: 'PrimeNG',         description: 'Aura preset + design tokens' },
    { id: 'tailwind', displayName: 'Tailwind CSS',    description: 'Utility-first, no component lib' },
    { id: 'none',     displayName: 'None',            description: 'Blank project, no tokens' },
]
