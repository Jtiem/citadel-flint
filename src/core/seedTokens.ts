import type { NewDesignToken } from '../types/flint-api'

/**
 * seedTokens — src/core/seedTokens.ts
 *
 * Baseline semantic tokens defined for the Flint Design System.
 * These map logical intents (surface, text, brand) to the raw Tailwind palette.
 */
export const BASELINE_TOKENS: NewDesignToken[] = [
    { token_path: 'surface-base', token_type: 'color', token_value: '#030712', description: 'Root application background (gray-950)' },
    { token_path: 'surface-card', token_type: 'color', token_value: '#111827', description: 'Panel and card background (gray-900)' },
    { token_path: 'border-base', token_type: 'color', token_value: '#1f2937', description: 'Standard divider and border color (gray-800)' },
    { token_path: 'text-primary', token_type: 'color', token_value: '#ffffff', description: 'Primary heading and body text' },
    { token_path: 'text-secondary', token_type: 'color', token_value: '#6b7280', description: 'Secondary/subtle text (gray-500)' },
    { token_path: 'brand-primary', token_type: 'color', token_value: '#4f46e5', description: 'Main brand accent background (indigo-600)' },
    { token_path: 'brand-accent', token_type: 'color', token_value: '#818cf8', description: 'Main brand accent text/border (indigo-400)' },
    { token_path: 'success', token_type: 'color', token_value: '#34d399', description: 'Success state color (emerald-400)' },
]

/**
 * One-time seeder to populate the Flint Token Store.
 */
export async function seedTokens() {
    console.log('[Flint] Seeding baseline tokens...')
    for (const token of BASELINE_TOKENS) {
        try {
            await window.flintAPI.tokens.create(token)
        } catch (err) {
            console.error(`[Flint] Failed to create token ${token.token_path}:`, err)
        }
    }
    console.log('[Flint] Token seeding complete.')
}
