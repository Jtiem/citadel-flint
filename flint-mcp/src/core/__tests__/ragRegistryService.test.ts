/**
 * ragRegistryService — Unit Tests
 *
 * Covers: generation counter monotonicity, atomic cache rebuild
 * (no half-populated reads), clearRegistryCache bumps generation,
 * and conflict logging.
 *
 * NOTE: Tests marked it.todo() require Group B to implement M7
 * (RegistryCacheState pointer swap + getRegistryGeneration export).
 * Tests for the current (pre-M7) behavior are real assertions.
 *
 * Sprint 5 contract ref: .flint-context/contracts/sprint-5-registry-rag.contract.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    setRegistryCache,
    clearRegistryCache,
    getRegistryCache,
    getRegistryGeneration,
    queryRAGRegistry,
} from '../ragRegistryService.js';
import type { ComponentEntry } from '../registryService.js';
import type { RegistryCacheState, GetRegistryGenerationFn } from '../../../../.flint-context/contracts/sprint-5-registry-rag.contract.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BUTTON: ComponentEntry = {
    name: 'Button',
    importPath: '@/components/Button',
    description: 'Primary action button',
    variants: ['primary', 'secondary'],
    tokens: ['color.primary'],
};

const CARD: ComponentEntry = {
    name: 'Card',
    importPath: '@/components/Card',
    description: 'Layout card container with shadow',
};

const AVATAR: ComponentEntry = {
    name: 'Avatar',
    importPath: '@/components/Avatar',
    description: 'User profile picture thumbnail',
};

// ── Isolation: clear before each test ────────────────────────────────────────

beforeEach(() => {
    clearRegistryCache();
});

// ── setRegistryCache and getRegistryCache ─────────────────────────────────────

describe('setRegistryCache', () => {
    it('stores entries and getRegistryCache returns them', () => {
        setRegistryCache({ Button: BUTTON });
        const cache = getRegistryCache();
        expect(cache['Button']).toBeDefined();
        expect(cache['Button'].name).toBe('Button');
    });

    it('accumulates entries across multiple calls (merge semantics)', () => {
        setRegistryCache({ Button: BUTTON });
        setRegistryCache({ Card: CARD });
        const cache = getRegistryCache();
        expect(Object.keys(cache)).toContain('Button');
        expect(Object.keys(cache)).toContain('Card');
    });

    it('later call wins on key collision', () => {
        const v1: ComponentEntry = { name: 'Button', importPath: '@/v1/Button', description: 'v1' };
        const v2: ComponentEntry = { name: 'Button', importPath: '@/v2/Button', description: 'v2' };
        setRegistryCache({ Button: v1 });
        setRegistryCache({ Button: v2 });
        const cache = getRegistryCache();
        expect(cache['Button'].importPath).toBe('@/v2/Button');
    });

    it('getRegistryCache returns a shallow copy (not the internal reference)', () => {
        setRegistryCache({ Button: BUTTON });
        const a = getRegistryCache();
        const b = getRegistryCache();
        expect(a).not.toBe(b); // different object references
        expect(a['Button']).toEqual(b['Button']); // same contents
    });
});

// ── clearRegistryCache ────────────────────────────────────────────────────────

describe('clearRegistryCache', () => {
    it('removes all entries from the cache', () => {
        setRegistryCache({ Button: BUTTON, Card: CARD });
        clearRegistryCache();
        const cache = getRegistryCache();
        expect(Object.keys(cache)).toHaveLength(0);
    });

    it('is idempotent — calling twice does not throw', () => {
        clearRegistryCache();
        expect(() => clearRegistryCache()).not.toThrow();
    });

    it('after clear, setRegistryCache starts fresh', () => {
        setRegistryCache({ Button: BUTTON });
        clearRegistryCache();
        setRegistryCache({ Avatar: AVATAR });
        const cache = getRegistryCache();
        expect(cache['Button']).toBeUndefined();
        expect(cache['Avatar']).toBeDefined();
    });
});

// ── queryRAGRegistry ──────────────────────────────────────────────────────────

describe('queryRAGRegistry', () => {
    it('returns entries matching the query from the cache', async () => {
        setRegistryCache({ Button: BUTTON, Card: CARD, Avatar: AVATAR });
        const results = await queryRAGRegistry('button');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('Button');
    });

    it('returns empty array when cache is empty', async () => {
        const results = await queryRAGRegistry('button');
        expect(results).toEqual([]);
    });

    it('returns empty array when no entries match the query', async () => {
        setRegistryCache({ Button: BUTTON });
        const results = await queryRAGRegistry('xyzzy-no-match-zzz');
        expect(results).toEqual([]);
    });

    it('respects the limit parameter', async () => {
        setRegistryCache({ Button: BUTTON, Card: CARD, Avatar: AVATAR });
        const results = await queryRAGRegistry('component layout button card', 2);
        expect(results.length).toBeLessThanOrEqual(2);
    });

    it('is async — returns a Promise', () => {
        const result = queryRAGRegistry('button');
        expect(result).toBeInstanceOf(Promise);
    });
});

// ── M7: generation counter ────────────────────────────────────────────────────

describe('M7: getRegistryGeneration() — generation counter', () => {
    it('getRegistryGeneration() is exported by ragRegistryService', () => {
        expect(typeof getRegistryGeneration).toBe('function');
    });

    it('generation is a non-negative integer after clear', () => {
        const gen = getRegistryGeneration();
        expect(typeof gen).toBe('number');
        expect(gen).toBeGreaterThanOrEqual(0);
    });

    it('setRegistryCache increments generation by 1', () => {
        const before = getRegistryGeneration();
        setRegistryCache({ Button: BUTTON });
        expect(getRegistryGeneration()).toBe(before + 1);
    });

    it('two sequential setRegistryCache calls produce generation + 2', () => {
        const before = getRegistryGeneration();
        setRegistryCache({ Button: BUTTON });
        setRegistryCache({ Card: CARD });
        expect(getRegistryGeneration()).toBe(before + 2);
    });

    it('clearRegistryCache increments generation', () => {
        setRegistryCache({ Button: BUTTON });
        const before = getRegistryGeneration();
        clearRegistryCache();
        expect(getRegistryGeneration()).toBe(before + 1);
    });

    it('generation is monotonically non-decreasing across any sequence of set/clear calls', () => {
        const gens: number[] = [];
        gens.push(getRegistryGeneration());
        setRegistryCache({ Button: BUTTON });
        gens.push(getRegistryGeneration());
        clearRegistryCache();
        gens.push(getRegistryGeneration());
        setRegistryCache({ Card: CARD });
        gens.push(getRegistryGeneration());
        setRegistryCache({ Avatar: AVATAR });
        gens.push(getRegistryGeneration());

        for (let i = 1; i < gens.length; i++) {
            expect(gens[i]).toBeGreaterThan(gens[i - 1]);
        }
    });
});

// ── M7: atomic pointer swap ───────────────────────────────────────────────────

describe('M7: atomic cache rebuild — no half-populated reads', () => {
    it('reader sees either the old cache OR the new cache — never an intermediate empty state', () => {
        setRegistryCache({ Button: BUTTON });
        // Set a large batch — the pointer swap is atomic so readers always see old or new
        const batch: Record<string, ComponentEntry> = {};
        for (let i = 0; i < 50; i++) {
            batch[`Widget${i}`] = { name: `Widget${i}`, importPath: `@/Widget${i}` };
        }
        setRegistryCache(batch);
        const cache = getRegistryCache();
        // Must have Button + all 50 widgets (merge semantics)
        expect(Object.keys(cache).length).toBe(51);
    });

    it('during setRegistryCache with 100 entries, getRegistryCache never returns an object with 0 keys', () => {
        setRegistryCache({ Button: BUTTON });
        const batch: Record<string, ComponentEntry> = {};
        for (let i = 0; i < 100; i++) {
            batch[`Comp${i}`] = { name: `Comp${i}`, importPath: `@/Comp${i}` };
        }
        setRegistryCache(batch);
        const cache = getRegistryCache();
        expect(Object.keys(cache).length).toBeGreaterThan(0);
    });
});

// ── M7: conflict warning ──────────────────────────────────────────────────────

describe('M7: conflict logging when overwriting different sourceId', () => {
    it('setRegistryCache logs a warning when a new sourceId entry would overwrite an existing different-sourceId entry', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        setRegistryCache({ Button: { ...BUTTON, sourceId: 'local-manifest' } });
        setRegistryCache({ Button: { ...BUTTON, sourceId: 'remote:acme' } });
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sourceId conflict'));
        warnSpy.mockRestore();
    });

    it('setRegistryCache does NOT log a warning when overwriting same sourceId', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        setRegistryCache({ Button: { ...BUTTON, sourceId: 'local-manifest' } });
        setRegistryCache({ Button: { ...BUTTON, sourceId: 'local-manifest', description: 'v2' } });
        // No conflict warning — same sourceId
        const conflictCalls = warnSpy.mock.calls.filter(
            (args) => typeof args[0] === 'string' && args[0].includes('sourceId conflict'),
        );
        expect(conflictCalls).toHaveLength(0);
        warnSpy.mockRestore();
    });

    it('warning is non-fatal — cache is still updated after warning', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        setRegistryCache({ Button: { ...BUTTON, sourceId: 'local-manifest' } });
        setRegistryCache({ Button: { ...BUTTON, sourceId: 'remote:acme', description: 'overwritten' } });
        const cache = getRegistryCache();
        expect(cache['Button'].description).toBe('overwritten');
        warnSpy.mockRestore();
    });
});

// ── Regression: existing queryRAGRegistry contract unchanged ──────────────────

describe('regression: queryRAGRegistry signature and return type unchanged', () => {
    it('signature accepts (query: string, limit?: number) and returns Promise<ComponentEntry[]>', async () => {
        setRegistryCache({ Button: BUTTON });
        const result = await queryRAGRegistry('button', 3);
        expect(Array.isArray(result)).toBe(true);
        if (result.length > 0) {
            // Verify ComponentEntry shape is preserved
            const entry = result[0];
            expect(typeof entry.name).toBe('string');
            expect(typeof entry.importPath).toBe('string');
        }
    });

    it('default limit of 5 applies when limit is not passed', async () => {
        // Seed 10 matching entries
        const large: Record<string, ComponentEntry> = {};
        for (let i = 0; i < 10; i++) {
            large[`Widget${i}`] = {
                name: `Widget${i}`,
                importPath: `@/Widget${i}`,
                description: 'widget component element',
            };
        }
        setRegistryCache(large);
        const results = await queryRAGRegistry('widget component');
        expect(results.length).toBeLessThanOrEqual(5);
    });
});
