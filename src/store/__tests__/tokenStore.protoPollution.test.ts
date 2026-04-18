/**
 * tokenStore.protoPollution.test.ts
 *
 * Mint security review (2026-04-17) — H1+H2: prototype pollution chain.
 * A malicious DTCG file with `__proto__`, `constructor`, or `prototype` keys
 * must not flow into token paths that downstream code uses for bracket
 * assignment in main process. The flattenDTCG walker skips these keys.
 *
 * Defense-in-depth: SAFE_TOKEN_NAME_RE in electron/main.ts also rejects them
 * at the approve-token IPC handler.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTokenStore } from '../tokenStore'

type CreateMock = ReturnType<typeof vi.fn>

function setupFlintAPI(): CreateMock {
    const create = vi.fn(async (row: unknown) => ({ id: 1 }))
    // @ts-expect-error — test-only injection
    global.window = global.window ?? {}
    // @ts-expect-error — test-only injection
    global.window.flintAPI = {
        tokens: {
            create,
            read: vi.fn().mockResolvedValue([]),
            clear: vi.fn().mockResolvedValue({ success: true }),
        },
    }
    return create
}

describe('Mint security: flattenDTCG rejects prototype-pollution keys (H2)', () => {
    beforeEach(() => {
        useTokenStore.setState({ tokens: [], isLoading: false, error: null })
    })

    it('skips __proto__ keys in DTCG payload — Object.prototype not polluted', async () => {
        const create = setupFlintAPI()
        const malicious = {
            colors: {
                primary: { $value: '#ff0000', $type: 'color' },
            },
            __proto__: {
                polluted: { $value: 'evil', $type: 'string' },
            },
        }

        await useTokenStore.getState().importTokensJSON(JSON.stringify(malicious))

        // Verify Object.prototype is NOT polluted.
        // @ts-expect-error — checking for accidental pollution
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()

        // Legitimate token still imported.
        const allRows = create.mock.calls.map((c) => c[0] as { token_path: string })
        expect(allRows.some((r) => r.token_path === 'colors.primary')).toBe(true)
        expect(allRows.some((r) => r.token_path.includes('__proto__'))).toBe(false)
        expect(allRows.some((r) => r.token_path === 'polluted')).toBe(false)
    })

    it('skips constructor keys in DTCG payload', async () => {
        const create = setupFlintAPI()
        const malicious = {
            constructor: { evil: { $value: 'x', $type: 'string' } },
            real: { $value: '#000000', $type: 'color' },
        }
        await useTokenStore.getState().importTokensJSON(JSON.stringify(malicious))
        const allRows = create.mock.calls.map((c) => c[0] as { token_path: string })
        expect(allRows.some((r) => r.token_path.includes('constructor'))).toBe(false)
    })

    it('skips prototype keys in DTCG payload', async () => {
        const create = setupFlintAPI()
        const malicious = {
            prototype: { evil: { $value: 'x', $type: 'string' } },
            real: { $value: '#000000', $type: 'color' },
        }
        await useTokenStore.getState().importTokensJSON(JSON.stringify(malicious))
        const allRows = create.mock.calls.map((c) => c[0] as { token_path: string })
        expect(allRows.some((r) => r.token_path.includes('prototype'))).toBe(false)
    })

    it('legitimate nested DTCG still imports normally', async () => {
        const create = setupFlintAPI()
        const safe = {
            colors: {
                primary: { $value: '#ff0000', $type: 'color' },
                secondary: { $value: '#00ff00', $type: 'color' },
            },
        }
        await useTokenStore.getState().importTokensJSON(JSON.stringify(safe))
        const allRows = create.mock.calls.map((c) => c[0] as { token_path: string })
        expect(allRows.length).toBe(2)
        expect(allRows.map((r) => r.token_path).sort()).toEqual(['colors.primary', 'colors.secondary'])
    })
})
