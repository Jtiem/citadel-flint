/**
 * tokenStore.errorHandling.test.ts — src/store/__tests__/tokenStore.errorHandling.test.ts
 *
 * Sprint 2A: Verify that tokenStore catch blocks use the correct error message
 * extraction pattern (not String(err)) and that deleteToken rolls back the
 * optimistic removal — at the original index — when the IPC call fails.
 *
 * Sprint 2B: Verify that importTokensJSON does NOT fire toasts itself (toast
 * responsibility moved to TokenManager component layer), and surfaces errors
 * through the store's error field instead.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTokenStore } from '../tokenStore'
import { useNotificationStore } from '../notificationStore'
import type { DesignToken } from '../../types/flint-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken(id: number): DesignToken {
    return {
        id,
        token_path: `color.test.${id}`,
        token_type: 'color',
        token_value: '#ffffff',
        collection_name: 'Test',
        mode: 'default',
    }
}

function createMockFlintTokens(overrides: Partial<typeof window.flintAPI.tokens> = {}) {
    return {
        create: vi.fn().mockResolvedValue({ id: 99 }),
        readAll: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ changes: 1 }),
        delete: vi.fn().mockResolvedValue({ changes: 1 }),
        clearAll: vi.fn().mockResolvedValue({ changes: 0 }),
        upsertOverride: vi.fn().mockResolvedValue(undefined),
        readOverrides: vi.fn().mockResolvedValue([]),
        clearOverride: vi.fn().mockResolvedValue(undefined),
        scanUsage: vi.fn().mockResolvedValue([]),
        auditContrast: vi.fn().mockResolvedValue([]),
        getPendingApprovals: vi.fn().mockResolvedValue([]),
        approveToken: vi.fn().mockResolvedValue({ ok: true }),
        rejectToken: vi.fn().mockResolvedValue({ ok: true }),
        ...overrides,
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks()
    useTokenStore.setState({ tokens: [], isLoading: false, error: null })
    useNotificationStore.setState({ notifications: [], history: [] })

    // Minimal window.flintAPI for token calls
    ;(window as unknown as Record<string, unknown>).flintAPI = {
        tokens: createMockFlintTokens(),
        watchTokens: vi.fn().mockReturnValue(() => {}),
    }
})

// ── 2A: Error message extraction ──────────────────────────────────────────────

describe('2A: tokenStore error message extraction', () => {
    it('fetchTokens sets error.message (not "[object Object]") when IPC throws an Error', async () => {
        (window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Network timeout')
        )

        await useTokenStore.getState().fetchTokens()

        const { error } = useTokenStore.getState()
        expect(error).toBe('Network timeout')
        expect(error).not.toBe('[object Object]')
    })

    it('fetchTokens handles non-Error throws (strings, plain objects)', async () => {
        (window.flintAPI.tokens.readAll as ReturnType<typeof vi.fn>).mockRejectedValue('string error')

        await useTokenStore.getState().fetchTokens()

        const { error } = useTokenStore.getState()
        expect(error).toBe('string error')
    })

    it('addToken sets error.message when IPC throws', async () => {
        (window.flintAPI.tokens.create as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Duplicate key')
        )

        await useTokenStore.getState().addToken({
            token_path: 'color.test',
            token_type: 'color',
            token_value: '#000',
            collection_name: 'Test',
            mode: 'default',
        })

        expect(useTokenStore.getState().error).toBe('Duplicate key')
    })

    it('updateToken sets error.message when IPC throws', async () => {
        (window.flintAPI.tokens.update as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Token not found')
        )

        await useTokenStore.getState().updateToken('color.test', '#fff')

        expect(useTokenStore.getState().error).toBe('Token not found')
    })

    it('clearAllTokens sets error.message when IPC throws', async () => {
        (window.flintAPI.tokens.clearAll as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Write lock')
        )

        await useTokenStore.getState().clearAllTokens()

        expect(useTokenStore.getState().error).toBe('Write lock')
    })
})

// ── 2A: deleteToken optimistic rollback ───────────────────────────────────────

describe('2A: deleteToken optimistic rollback', () => {
    it('removes token immediately (optimistic), then restores it when IPC fails', async () => {
        const token = makeToken(42)
        useTokenStore.setState({ tokens: [token], error: null })

        ;(window.flintAPI.tokens.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('IPC failure')
        )

        await useTokenStore.getState().deleteToken(42)

        const { tokens, error } = useTokenStore.getState()
        expect(tokens).toHaveLength(1)
        expect(tokens[0].id).toBe(42)
        expect(error).toBe('IPC failure')
    })

    it('keeps token removed after successful IPC delete', async () => {
        const token = makeToken(7)
        useTokenStore.setState({ tokens: [token], error: null })

        await useTokenStore.getState().deleteToken(7)

        const { tokens, error } = useTokenStore.getState()
        expect(tokens).toHaveLength(0)
        expect(error).toBeNull()
    })

    it('restores only the deleted token when multiple tokens are present', async () => {
        const t1 = makeToken(1)
        const t2 = makeToken(2)
        const t3 = makeToken(3)
        useTokenStore.setState({ tokens: [t1, t2, t3], error: null })

        ;(window.flintAPI.tokens.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('IPC failure')
        )

        await useTokenStore.getState().deleteToken(2)

        const { tokens } = useTokenStore.getState()
        expect(tokens).toHaveLength(3)
        const ids = tokens.map((t) => t.id)
        expect(ids).toContain(1)
        expect(ids).toContain(2)
        expect(ids).toContain(3)
    })

    it('restores token at original index, not appended to the tail', async () => {
        const t1 = makeToken(10)
        const t2 = makeToken(20)
        const t3 = makeToken(30)
        useTokenStore.setState({ tokens: [t1, t2, t3], error: null })

        ;(window.flintAPI.tokens.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('IPC failure')
        )

        // Delete the middle token (original index 1)
        await useTokenStore.getState().deleteToken(20)

        const { tokens } = useTokenStore.getState()
        expect(tokens).toHaveLength(3)
        // Token 20 must be back at index 1, not at the tail
        expect(tokens[0].id).toBe(10)
        expect(tokens[1].id).toBe(20)
        expect(tokens[2].id).toBe(30)
    })

    it('restores first token at index 0 on rollback', async () => {
        const t1 = makeToken(100)
        const t2 = makeToken(200)
        useTokenStore.setState({ tokens: [t1, t2], error: null })

        ;(window.flintAPI.tokens.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('IPC failure')
        )

        await useTokenStore.getState().deleteToken(100)

        const { tokens } = useTokenStore.getState()
        expect(tokens).toHaveLength(2)
        expect(tokens[0].id).toBe(100)
        expect(tokens[1].id).toBe(200)
    })

    it('does not restore when the token id was not found (safe guard)', async () => {
        useTokenStore.setState({ tokens: [], error: null })

        ;(window.flintAPI.tokens.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('IPC failure')
        )

        // Deleting an id that is not in state — no crash, no phantom token
        await useTokenStore.getState().deleteToken(999)

        expect(useTokenStore.getState().tokens).toHaveLength(0)
        expect(useTokenStore.getState().error).toBe('IPC failure')
    })
})

// ── 2B: importTokensJSON error surfacing (toast responsibility moved to component layer) ───────

describe('2B: importTokensJSON surfaces errors through store.error — no direct toasts', () => {
    it('sets store.error when JSON.parse throws SyntaxError — does NOT push a toast itself', async () => {
        await useTokenStore.getState().importTokensJSON('{ invalid json }', 'Test')

        const { error } = useTokenStore.getState()
        // Error must be surfaced through the store's error field
        expect(error).not.toBeNull()
        // Store must NOT push toasts — that is the component's responsibility
        const { notifications } = useNotificationStore.getState()
        expect(notifications).toHaveLength(0)
    })

    it('sets store.error to "No DTCG tokens found" message when JSON is valid but empty', async () => {
        await useTokenStore.getState().importTokensJSON('{}', 'Test')

        const { error } = useTokenStore.getState()
        expect(error).toContain('No DTCG tokens found')
        // No toast from the store
        const { notifications } = useNotificationStore.getState()
        expect(notifications).toHaveLength(0)
    })

    it('sets store.error when IPC create fails (non-SyntaxError) — does NOT push a toast itself', async () => {
        ;(window.flintAPI.tokens.create as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('DB write error')
        )

        const validDtcg = JSON.stringify({
            color: { primary: { $value: '#3b82f6', $type: 'color' } }
        })
        await useTokenStore.getState().importTokensJSON(validDtcg, 'Test')

        const { error } = useTokenStore.getState()
        expect(error).toBe('DB write error')
        // No toast from the store
        const { notifications } = useNotificationStore.getState()
        expect(notifications).toHaveLength(0)
    })
})
