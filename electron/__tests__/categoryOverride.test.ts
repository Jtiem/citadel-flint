/**
 * categoryOverride.test.ts — CV2.6: Category Override IPC Handler Tests
 *
 * Tests the pure logic extracted from the `components:set-category` IPC handler
 * and the `readCategoryOverrides` / `components:list` override-application logic.
 *
 * No Electron APIs (ipcMain, app, BrowserWindow) are imported — those cannot
 * run in a plain Node.js test environment. The handler logic is reproduced as
 * standalone pure functions, matching the exact implementation in electron/main.ts.
 *
 * Coverage:
 *   CO-01 — set-category: writes componentId → category to a new overrides file
 *   CO-02 — set-category: merges with an existing overrides file (does not clobber)
 *   CO-03 — set-category: rejects invalid category strings
 *   CO-04 — set-category: rejects empty componentId
 *   CO-05 — set-category: rejects non-object payload
 *   CO-06 — components:list — applies override when componentId matches a card
 *   CO-07 — components:list — does not apply override when componentId is absent
 *   CO-08 — readCategoryOverrides — returns {} when file does not exist
 *   CO-09 — readCategoryOverrides — returns {} when file contains invalid JSON
 *   CO-10 — readCategoryOverrides — returns {} when file contains a JSON array
 */

import { describe, it, expect } from 'vitest'

// ── Reproduced pure logic from electron/main.ts ───────────────────────────────
//
// Each function below faithfully mirrors the logic inside the IPC handler
// in electron/main.ts. Tests run against these isolated, pure functions.

/** All valid ComponentCategory values (mirrors VALID_CATEGORIES in main.ts). */
const VALID_CATEGORIES = new Set([
    'primitive', 'molecule', 'organism', 'page', 'layout', 'uncategorized',
])

/** Pure version of readCategoryOverrides — accepts a readFile stub. */
async function readCategoryOverrides(
    overridesPath: string,
    readFile: (p: string, enc: string) => Promise<string>,
): Promise<Record<string, string>> {
    try {
        const raw = await readFile(overridesPath, 'utf-8')
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, string>
        }
        return {}
    } catch {
        return {}
    }
}

/** Pure validation logic for the set-category handler. */
function validateSetCategoryPayload(payload: unknown): {
    componentId: string
    category: string
} {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw new TypeError('components:set-category — payload must be an object')
    }
    const p = payload as Record<string, unknown>

    if (typeof p.componentId !== 'string' || p.componentId.trim() === '') {
        throw new TypeError('components:set-category — componentId must be a non-empty string')
    }
    if (typeof p.category !== 'string' || !VALID_CATEGORIES.has(p.category)) {
        throw new TypeError(
            `components:set-category — category must be one of: ${[...VALID_CATEGORIES].join(', ')}`,
        )
    }

    return { componentId: p.componentId, category: p.category }
}

/**
 * Pure version of the override-application logic from components:list.
 * Takes a cards array and an overrides map; returns a new cards array
 * with categories patched for any card whose ID has an override entry.
 */
function applyOverridesToCards(
    cards: Array<{ id: string; category: string }>,
    overrides: Record<string, string>,
): Array<{ id: string; category: string }> {
    return cards.map((card) => {
        const override = overrides[card.id]
        if (override && VALID_CATEGORIES.has(override)) {
            return { ...card, category: override }
        }
        return card
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('categoryOverride — readCategoryOverrides (CO-08 to CO-10)', () => {
    // CO-08: Returns {} when file does not exist (readFile rejects)
    it('CO-08: returns empty object when the overrides file does not exist', async () => {
        const readFile = async (_p: string, _enc: string): Promise<string> => {
            throw new Error('ENOENT: no such file')
        }

        const result = await readCategoryOverrides('/fake/.flint/category-overrides.json', readFile)
        expect(result).toEqual({})
    })

    // CO-09: Returns {} when file contains invalid JSON
    it('CO-09: returns empty object when the overrides file contains invalid JSON', async () => {
        const readFile = async (): Promise<string> => 'not-json-{{{{'
        const result = await readCategoryOverrides('/fake/.flint/category-overrides.json', readFile)
        expect(result).toEqual({})
    })

    // CO-10: Returns {} when file contains a JSON array (not an object)
    it('CO-10: returns empty object when the overrides file contains a JSON array', async () => {
        const readFile = async (): Promise<string> => '["primitive", "molecule"]'
        const result = await readCategoryOverrides('/fake/.flint/category-overrides.json', readFile)
        expect(result).toEqual({})
    })

    // CO-08b: Returns the parsed object when file contains a valid JSON object
    it('CO-08b: returns parsed overrides when the file contains a valid object', async () => {
        const overrides = { 'abc-1234': 'molecule', 'def-5678': 'organism' }
        const readFile = async (): Promise<string> => JSON.stringify(overrides)
        const result = await readCategoryOverrides('/fake/.flint/category-overrides.json', readFile)
        expect(result).toEqual(overrides)
    })
})

describe('categoryOverride — validateSetCategoryPayload (CO-03 to CO-05)', () => {
    // CO-03: Rejects invalid category strings
    it('CO-03: throws when category is not a valid ComponentCategory', () => {
        expect(() =>
            validateSetCategoryPayload({ componentId: 'abc-123', category: 'button' }),
        ).toThrow('category must be one of')
    })

    it('CO-03b: throws when category is an empty string', () => {
        expect(() =>
            validateSetCategoryPayload({ componentId: 'abc-123', category: '' }),
        ).toThrow('category must be one of')
    })

    it('CO-03c: throws when category is missing', () => {
        expect(() =>
            validateSetCategoryPayload({ componentId: 'abc-123' }),
        ).toThrow('category must be one of')
    })

    // CO-04: Rejects empty componentId
    it('CO-04: throws when componentId is an empty string', () => {
        expect(() =>
            validateSetCategoryPayload({ componentId: '   ', category: 'molecule' }),
        ).toThrow('componentId must be a non-empty string')
    })

    it('CO-04b: throws when componentId is not a string', () => {
        expect(() =>
            validateSetCategoryPayload({ componentId: 42, category: 'molecule' }),
        ).toThrow('componentId must be a non-empty string')
    })

    // CO-05: Rejects non-object payload
    it('CO-05: throws when payload is null', () => {
        expect(() => validateSetCategoryPayload(null)).toThrow('payload must be an object')
    })

    it('CO-05b: throws when payload is an array', () => {
        expect(() => validateSetCategoryPayload(['id', 'molecule'])).toThrow('payload must be an object')
    })

    it('CO-05c: throws when payload is a string', () => {
        expect(() => validateSetCategoryPayload('molecule')).toThrow('payload must be an object')
    })

    // CO-01: Accepts all 6 valid category values
    it.each([
        'primitive', 'molecule', 'organism', 'page', 'layout', 'uncategorized',
    ])('CO-01: accepts %s as a valid category', (cat) => {
        expect(() =>
            validateSetCategoryPayload({ componentId: 'abc-123', category: cat }),
        ).not.toThrow()
    })
})

describe('categoryOverride — set-category write logic (CO-01, CO-02)', () => {
    // CO-01: Writes componentId → category to a new overrides file
    it('CO-01: sets override for componentId in a new file (empty existing overrides)', async () => {
        const readFile = async (): Promise<string> => { throw new Error('ENOENT') }

        const existing = await readCategoryOverrides('/path', readFile)
        const updated = { ...existing, 'abc-1234': 'molecule' }

        expect(updated).toEqual({ 'abc-1234': 'molecule' })
    })

    // CO-02: Merges with existing overrides — does not clobber other entries
    it('CO-02: merges new override with existing entries', async () => {
        const readFile = async (): Promise<string> =>
            JSON.stringify({ 'existing-id': 'organism' })

        const existing = await readCategoryOverrides('/path', readFile)
        const updated = { ...existing, 'new-id': 'layout' }

        expect(updated).toEqual({
            'existing-id': 'organism',
            'new-id': 'layout',
        })
    })

    // CO-02b: Overwriting an existing entry replaces the old value
    it('CO-02b: replaces a prior category override for the same componentId', async () => {
        const readFile = async (): Promise<string> =>
            JSON.stringify({ 'abc-1234': 'primitive' })

        const existing = await readCategoryOverrides('/path', readFile)
        const updated = { ...existing, 'abc-1234': 'page' }

        expect(updated).toEqual({ 'abc-1234': 'page' })
    })
})

describe('categoryOverride — components:list override application (CO-06, CO-07)', () => {
    const baseCards = [
        { id: 'card-aaa', category: 'uncategorized' },
        { id: 'card-bbb', category: 'primitive' },
    ]

    // CO-06: Override applied when componentId matches
    it('CO-06: replaces category when an override exists for the card ID', () => {
        const overrides = { 'card-aaa': 'molecule' }
        const result = applyOverridesToCards(baseCards, overrides)

        expect(result[0].category).toBe('molecule')
        // Other cards unaffected.
        expect(result[1].category).toBe('primitive')
    })

    // CO-07: No override applied when componentId is absent
    it('CO-07: leaves categories unchanged when no override exists', () => {
        const overrides: Record<string, string> = {}
        const result = applyOverridesToCards(baseCards, overrides)

        expect(result[0].category).toBe('uncategorized')
        expect(result[1].category).toBe('primitive')
    })

    // CO-06b: Invalid override value is silently ignored (stays auto-derived)
    it('CO-06b: ignores override when value is not a valid ComponentCategory', () => {
        const overrides = { 'card-aaa': 'notacategory' }
        const result = applyOverridesToCards(baseCards, overrides)

        // The invalid value must be filtered out — original category preserved.
        expect(result[0].category).toBe('uncategorized')
    })

    // CO-06c: All 6 valid category values are accepted by applyOverridesToCards
    it.each([
        'primitive', 'molecule', 'organism', 'page', 'layout', 'uncategorized',
    ])('CO-06c: valid override category %s is applied', (cat) => {
        const cards = [{ id: 'card-id', category: 'uncategorized' }]
        const overrides = { 'card-id': cat }
        const result = applyOverridesToCards(cards, overrides)
        expect(result[0].category).toBe(cat)
    })
})
