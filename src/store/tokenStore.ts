/**
 * tokenStore — src/store/tokenStore.ts
 *
 * Zustand store for design tokens. All mutations go through window.bridgeAPI
 * (the contextBridge IPC surface) so this module has zero direct SQLite
 * contact — safe to import anywhere in the Renderer Process.
 *
 * After every mutating action the store performs a full re-fetch so the UI
 * always reflects the database's authoritative state (handles UPSERT merging,
 * server-side defaults, etc.).
 */

import { create } from 'zustand'
import type { DesignToken, NewDesignToken, TokenType } from '../types/bridge-api'

// ── State ─────────────────────────────────────────────────────────────────────

interface TokenState {
    tokens: DesignToken[]
    isLoading: boolean
    error: string | null
}

// ── Actions ───────────────────────────────────────────────────────────────────

interface TokenActions {
    fetchTokens: () => Promise<void>
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
            const tokens = await window.bridgeAPI.tokens.readAll()
            set({ tokens, isLoading: false })
        } catch (err) {
            set({ error: String(err), isLoading: false })
        }
    },

    addToken: async (token: NewDesignToken) => {
        set({ error: null })
        try {
            await window.bridgeAPI.tokens.create(token)
            await get().fetchTokens()
        } catch (err) {
            set({ error: String(err) })
        }
    },

    updateToken: async (tokenPath: string, value: string) => {
        set({ error: null })
        try {
            await window.bridgeAPI.tokens.update(tokenPath, { token_value: value })
            await get().fetchTokens()
        } catch (err) {
            set({ error: String(err) })
        }
    },

    deleteToken: async (id: number) => {
        set({ error: null })
        try {
            await window.bridgeAPI.tokens.delete(id)
            // Optimistic removal — avoids a round-trip on delete
            set((state) => ({ tokens: state.tokens.filter((t) => t.id !== id) }))
        } catch (err) {
            set({ error: String(err) })
        }
    },

    clearAllTokens: async () => {
        set({ error: null })
        try {
            await window.bridgeAPI.tokens.clearAll()
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
            const defaults: NewDesignToken[] = [
                { token_path: 'color.brand.primary',     token_type: 'color', token_value: '#6366f1', description: 'Primary brand / accent color',  collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.content.primary',   token_type: 'color', token_value: '#f9fafb', description: 'Primary body text',              collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.content.secondary', token_type: 'color', token_value: '#9ca3af', description: 'Secondary / muted text',          collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.surface.card',      token_type: 'color', token_value: '#111827', description: 'Card / panel background',         collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.surface.base',      token_type: 'color', token_value: '#030712', description: 'Page / canvas background',        collection_name: 'Demo Tokens', mode: 'default' },
                { token_path: 'color.ui.border',         token_type: 'color', token_value: '#1f2937', description: 'UI border / divider color',       collection_name: 'Demo Tokens', mode: 'default' },
            ]
            await Promise.all(defaults.map((t) => window.bridgeAPI.tokens.create(t)))
            await get().fetchTokens()
        } catch (err) {
            set({ error: String(err), isLoading: false })
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

            await Promise.all(newTokens.map((t) => window.bridgeAPI.tokens.create(t)))
            await get().fetchTokens()
        } catch (err) {
            set({ error: String(err), isLoading: false })
        }
    },
}))
