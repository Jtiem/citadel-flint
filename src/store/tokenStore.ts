/**
 * tokenStore — src/store/tokenStore.ts
 *
 * Zustand store for design tokens. All mutations go through window.flintAPI
 * (the contextBridge IPC surface) so this module has zero direct SQLite
 * contact — safe to import anywhere in the Renderer Process.
 *
 * After every mutating action the store performs a full re-fetch so the UI
 * always reflects the database's authoritative state (handles UPSERT merging,
 * server-side defaults, etc.).
 */

import { create } from 'zustand'
import type { DesignToken, NewDesignToken, TokenType } from '../types/flint-api'
import { findClosestToken } from '../utils/tokenMatcher'

// ── State ─────────────────────────────────────────────────────────────────────

interface TokenState {
    tokens: DesignToken[]
    isLoading: boolean
    error: string | null
}

// ── Actions ───────────────────────────────────────────────────────────────────

interface TokenActions {
    fetchTokens: () => Promise<void>
    /**
     * Initialises a live subscription to the design_tokens table via
     * `window.flintAPI.watchTokens`. Calls the callback immediately with the
     * current token list, then re-syncs on every subsequent DB write
     * (create / update / delete / clearAll / Figma ingest) without requiring
     * a manual `fetchTokens()` call after each mutation.
     *
     * Returns an unsubscribe function — pass it to a `useEffect` cleanup.
     *
     * Silent no-op in test / SSR environments where `window` is undefined.
     */
    initSync: () => () => void
    addToken: (token: NewDesignToken) => Promise<void>
    /** Updates token_value for every token matching tokenPath. */
    updateToken: (tokenPath: string, value: string) => Promise<void>
    deleteToken: (id: number) => Promise<void>
    /** Removes every token from the database and clears the store. */
    clearAllTokens: () => Promise<void>
    /**
     * Parses a W3C DTCG JSON string, flattens it into NewDesignToken rows,
     * and batch-inserts via UPSERT. Existing tokens at the same
     * (token_path, mode, collection_name) composite key are updated in place.
     */
    importTokensJSON: (jsonString: string, collectionName?: string) => Promise<void>
    /**
     * Seeds a baseline set of semantic design tokens (brand, content, surface,
     * border) if the database is currently empty. Called automatically by the
     * "Load Demo" button so the payment calculator demo always renders correctly
     * even before a Figma sync has occurred.
     *
     * No-ops silently when tokens already exist — never overwrites user data.
     */
    ensureDemoTokens: () => Promise<void>
    /**
     * Synchronous selector: returns the nearest design token to `hex` and its
     * CIEDE2000 perceptual distance. Reads the current store state — no IPC
     * call needed. Returns null if no colour tokens exist or hex is unparsable.
     *
     * Used by the Mithril Perceptual Linter (Module B.1) to surface amber/red
     * drift warnings in the PropertiesPanel.
     */
    getNearestToken: (hex: string) => { tokenName: string; tokenValue: string; tokenType: string; deltaE: number } | null
}

type TokenStore = TokenState & TokenActions

// ── W3C DTCG JSON flattening ──────────────────────────────────────────────────

type DTCGRaw = Record<string, unknown>

const VALID_TYPES: ReadonlySet<string> = new Set(['color', 'dimension', 'string', 'boolean'])

function flattenDTCG(node: DTCGRaw, prefix: string, collectionName: string): NewDesignToken[] {
    const tokens: NewDesignToken[] = []

    for (const [key, child] of Object.entries(node)) {
        if (key.startsWith('$')) continue
        if (typeof child !== 'object' || child === null) continue

        const path = prefix ? `${prefix}.${key}` : key
        const childObj = child as DTCGRaw

        if ('$value' in childObj) {
            const rawType = childObj['$type']
            const rawValue = childObj['$value']
            const rawDesc = childObj['$description']

            const tokenType: TokenType =
                typeof rawType === 'string' && VALID_TYPES.has(rawType)
                    ? (rawType as TokenType)
                    : 'string'

            tokens.push({
                token_path: path,
                token_type: tokenType,
                token_value: rawValue != null ? String(rawValue) : '',
                description: typeof rawDesc === 'string' ? rawDesc : undefined,
                collection_name: collectionName,
                mode: 'default',
            })
        } else {
            tokens.push(...flattenDTCG(childObj, path, collectionName))
        }
    }

    return tokens
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useTokenStore = create<TokenStore>((set, get) => ({
    tokens: [],
    isLoading: false,
    error: null,

    fetchTokens: async () => {
        set({ isLoading: true, error: null })
        try {
            const tokens = await window.flintAPI.tokens.readAll()
            set({ tokens, isLoading: false })
        } catch (err) {
            set({ error: String(err), isLoading: false })
        }
    },

    initSync: () => {
        if (typeof window === 'undefined') return () => { }
        return window.flintAPI.watchTokens((tokens) => {
            set({ tokens, isLoading: false })
        })
    },

    addToken: async (token: NewDesignToken) => {
        set({ error: null })
        try {
            await window.flintAPI.tokens.create(token)
            // No manual fetchTokens() — watchTokens subscription delivers the update.
        } catch (err) {
            set({ error: String(err) })
        }
    },

    updateToken: async (tokenPath: string, value: string) => {
        set({ error: null })
        try {
            await window.flintAPI.tokens.update(tokenPath, { token_value: value })
            // No manual fetchTokens() — watchTokens subscription delivers the update.
        } catch (err) {
            set({ error: String(err) })
        }
    },

    deleteToken: async (id: number) => {
        set({ error: null })
        try {
            await window.flintAPI.tokens.delete(id)
            // Optimistic removal — avoids a round-trip on delete
            set((state) => ({ tokens: state.tokens.filter((t) => t.id !== id) }))
        } catch (err) {
            set({ error: String(err) })
        }
    },

    clearAllTokens: async () => {
        set({ error: null })
        try {
            await window.flintAPI.tokens.clearAll()
            set({ tokens: [] })
        } catch (err) {
            set({ error: String(err) })
        }
    },

    ensureDemoTokens: async () => {
        // No-op when tokens already exist — never overwrites Figma-synced data.
        if (get().tokens.length > 0) return

        set({ isLoading: true, error: null })
        try {
            // Semantic token set that maps directly to the payment calculator demo's
            // class names (bg-brand-primary, text-content-primary, etc.)
            // Extended (v2) with enterprise typography, shadow, and opacity tokens
            // so the Mithril Linter can enforce every visual dimension.
            const defaults: NewDesignToken[] = [
                // ── Color ─────────────────────────────────────────────────────
                { token_path: 'color.brand.primary', token_type: 'color', token_value: '#6366f1', description: 'Primary brand / accent color', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.content.primary', token_type: 'color', token_value: '#f9fafb', description: 'Primary body text', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.content.secondary', token_type: 'color', token_value: '#9ca3af', description: 'Secondary / muted text', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.surface.card', token_type: 'color', token_value: '#111827', description: 'Card / panel background', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.surface.base', token_type: 'color', token_value: '#030712', description: 'Page / canvas background', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.ui.border', token_type: 'color', token_value: '#1f2937', description: 'UI border / divider color', collection_name: 'Demo Tokens', mode: 'default' },
                // ── Typography — fontFamily ────────────────────────────────────
                { token_path: 'fontFamily.sans', token_type: 'fontFamily', token_value: 'Inter, ui-sans-serif, system-ui, sans-serif', description: 'Primary sans-serif stack', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'fontFamily.mono', token_type: 'fontFamily', token_value: 'JetBrains Mono, ui-monospace, monospace', description: 'Monospace / code stack', collection_name: 'Demo Tokens', mode: 'default' },
                // ── Typography — fontWeight ────────────────────────────────────
                { token_path: 'fontWeight.regular', token_type: 'fontWeight', token_value: '400', description: 'Normal body weight', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'fontWeight.medium', token_type: 'fontWeight', token_value: '500', description: 'Medium emphasis', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'fontWeight.semibold', token_type: 'fontWeight', token_value: '600', description: 'Semibold headings', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'fontWeight.bold', token_type: 'fontWeight', token_value: '700', description: 'Bold / strong text', collection_name: 'Demo Tokens', mode: 'default' },
                // ── Typography — lineHeight ────────────────────────────────────
                { token_path: 'lineHeight.tight', token_type: 'lineHeight', token_value: '1.25', description: 'Compact headings', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'lineHeight.normal', token_type: 'lineHeight', token_value: '1.5', description: 'Standard body copy', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'lineHeight.relaxed', token_type: 'lineHeight', token_value: '1.75', description: 'Relaxed reading text', collection_name: 'Demo Tokens', mode: 'default' },
                // ── Typography — letterSpacing ─────────────────────────────────
                { token_path: 'letterSpacing.tight', token_type: 'letterSpacing', token_value: '-0.025em', description: 'Tight headlines', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'letterSpacing.normal', token_type: 'letterSpacing', token_value: '0em', description: 'Default tracking', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'letterSpacing.wide', token_type: 'letterSpacing', token_value: '0.025em', description: 'Wide / label tracking', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'letterSpacing.widest', token_type: 'letterSpacing', token_value: '0.1em', description: 'All-caps / display labels', collection_name: 'Demo Tokens', mode: 'default' },
                // ── Shadow ────────────────────────────────────────────────────
                { token_path: 'shadow.sm', token_type: 'shadow', token_value: '0 1px 2px 0 rgb(0 0 0 / 0.05)', description: 'Subtle shadow', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'shadow.card', token_type: 'shadow', token_value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', description: 'Card elevation', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'shadow.lg', token_type: 'shadow', token_value: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', description: 'Modal / overlay elevation', collection_name: 'Demo Tokens', mode: 'default' },
                // ── Opacity ───────────────────────────────────────────────────
                { token_path: 'opacity.muted', token_type: 'opacity', token_value: '50', description: 'Disabled / muted state', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'opacity.subtle', token_type: 'opacity', token_value: '75', description: 'Subtle background tint', collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'opacity.full', token_type: 'opacity', token_value: '100', description: 'Fully opaque', collection_name: 'Demo Tokens', mode: 'default' },
            ]

            await Promise.all(defaults.map((t) => window.flintAPI.tokens.create(t)))
            // No manual fetchTokens() — watchTokens subscription delivers the update.
        } catch (err) {
            set({ error: String(err), isLoading: false })
        }
    },

    getNearestToken: (hex: string) => {
        const match = findClosestToken(hex, get().tokens)
        if (match === null) return null
        const token = get().tokens.find(t => t.token_path === match.tokenPath)
        return {
            tokenName: match.tokenPath,
            tokenValue: match.tokenValue,
            tokenType: token?.token_type ?? 'color',
            deltaE: match.deltaE,
        }
    },

    importTokensJSON: async (jsonString: string, collectionName = 'Imported') => {
        set({ isLoading: true, error: null })
        try {
            const parsed = JSON.parse(jsonString) as DTCGRaw
            const newTokens = flattenDTCG(parsed, '', collectionName)

            if (newTokens.length === 0) {
                set({
                    isLoading: false,
                    error: 'No DTCG tokens found. Ensure leaf nodes have a $value property.',
                })
                return
            }

            await Promise.all(newTokens.map((t) => window.flintAPI.tokens.create(t)))
            // No manual fetchTokens() — watchTokens subscription delivers the update.
        } catch (err) {
            set({ error: String(err), isLoading: false })
        }
    },
}))
