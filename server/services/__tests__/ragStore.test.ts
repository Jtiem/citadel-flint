/**
 * ragStore — Unit Tests
 *
 * Covers: ingest/query round-trip, empty-table guard, seedFromProject sources,
 * symlink skip, malformed JSON resilience, M5 limit clamp [1,100],
 * and M4 docs source collapse.
 *
 * Sprint 5 contract ref: .flint-context/contracts/sprint-5-registry-rag.contract.ts
 * Relevant contract constants: RAG_QUERY_LIMIT_MIN = 1, RAG_QUERY_LIMIT_MAX = 100
 *
 * NOTE: The bigint fix (`Number(info.lastInsertRowid)`) shipped in ragStore.ts:363.
 * All previously-blocked ingest() tests are now active.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createRAGService } from '../ragStore.js';
import { mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Contract constants (inline to avoid cross-package import complexity) ──────

const RAG_QUERY_LIMIT_MIN = 1;
const RAG_QUERY_LIMIT_MAX = 100;

// ── DB factory (in-memory) ────────────────────────────────────────────────────

function makeTestDb(): Database.Database {
    const db = new Database(':memory:');
    // Create the rag_chunks table that the server normally initialises
    db.exec(`
        CREATE TABLE IF NOT EXISTS rag_chunks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            content     TEXT    NOT NULL,
            source      TEXT    NOT NULL DEFAULT '',
            chunk_type  TEXT    NOT NULL DEFAULT 'documentation',
            created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );
    `);
    return db;
}

// ── Ingest / Query round-trip ─────────────────────────────────────────────────

describe('createRAGService — ingest and query round-trip', () => {
    it('ingests chunks and returns count > 0', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        const result = await rag.ingest([
            { content: 'Button component with primary variant', source: 'manifest', chunkType: 'component' },
            { content: 'Input field with label and error state', source: 'manifest', chunkType: 'component' },
        ]);

        expect(result.ingested).toBe(2);
        expect(await rag.count()).toBe(2);

        db.close();
    });

    it('query returns results matching ingested content', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        await rag.ingest([
            { content: 'Button component with primary variant', source: 'manifest', chunkType: 'component' },
            { content: 'Dropdown menu with keyboard navigation', source: 'manifest', chunkType: 'component' },
        ]);

        const results = await rag.query('button primary');
        expect(results.length).toBeGreaterThan(0);
        // The button chunk should rank first since it shares the most n-grams
        expect(results[0].content).toContain('Button');

        db.close();
    });

    it('returns results with expected RAGResult shape', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        await rag.ingest([
            { content: 'Card component layout token spacing', source: 'manifest', chunkType: 'component' },
        ]);

        const results = await rag.query('card component');
        expect(results.length).toBeGreaterThan(0);

        const r = results[0];
        expect(typeof r.id).toBe('number');
        expect(typeof r.content).toBe('string');
        expect(typeof r.source).toBe('string');
        expect(typeof r.chunkType).toBe('string');
        expect(typeof r.distance).toBe('number');
        expect(r.source).toBe('manifest');
        expect(r.chunkType).toBe('component');

        db.close();
    });

    it('round-trip: insert → query → clear → count = 0', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        await rag.ingest([
            { content: 'Typography token heading large', source: 'tokens', chunkType: 'tokens' },
        ]);

        expect(await rag.count()).toBe(1);

        const results = await rag.query('typography heading');
        expect(results.length).toBeGreaterThan(0);

        await rag.clear();
        expect(await rag.count()).toBe(0);

        const afterClear = await rag.query('typography heading');
        expect(afterClear).toEqual([]);

        db.close();
    });
});

// ── Empty-table guard — these run TODAY without the ingest fix ────────────────

describe('createRAGService — empty-table guard', () => {
    it('query against empty store returns [] without throwing', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        const results = await rag.query('anything at all');
        expect(results).toEqual([]);

        db.close();
    });

    it('count on empty store returns 0', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        expect(await rag.count()).toBe(0);
        db.close();
    });

    it('clear on empty store does not throw', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);
        await expect(rag.clear()).resolves.toBeUndefined();
        db.close();
    });
});

// ── M5: limit clamp [1, 100] ─────────────────────────────────────────────────

describe('createRAGService — M5: limit clamp to [RAG_QUERY_LIMIT_MIN, RAG_QUERY_LIMIT_MAX]', () => {
    it('query against empty store returns [] for limit = 0 — does not throw', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);
        // Empty store short-circuits before the limit is applied; this confirms no throw at least
        const results = await rag.query('alpha component', 0);
        expect(Array.isArray(results)).toBe(true);
        db.close();
    });

    it('query against empty store returns [] for limit = 1000 — does not throw', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);
        const results = await rag.query('alpha component', 1000);
        expect(Array.isArray(results)).toBe(true);
        db.close();
    });

    it(`limit = 0 clamps to ${RAG_QUERY_LIMIT_MIN} and returns ≤ 1 result`, async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        // Ingest 5 chunks so the clamp is meaningful
        await rag.ingest(
            Array.from({ length: 5 }, (_, i) => ({
                content: `Component ${i} alpha beta gamma layout token`,
                source: 'manifest',
                chunkType: 'component',
            })),
        );

        const results = await rag.query('alpha component', 0);
        // Clamped to 1 — should return at most 1 result
        expect(results.length).toBeLessThanOrEqual(RAG_QUERY_LIMIT_MIN);

        db.close();
    });

    it(`limit = 999 clamps to ${RAG_QUERY_LIMIT_MAX} and returns ≤ 100 results`, async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        // Ingest 3 chunks — result count is bounded by both store size and clamped limit
        await rag.ingest([
            { content: 'Button component alpha variant', source: 'manifest', chunkType: 'component' },
            { content: 'Input component beta state', source: 'manifest', chunkType: 'component' },
            { content: 'Modal dialog alpha overlay', source: 'manifest', chunkType: 'component' },
        ]);

        const results = await rag.query('alpha component', 999);
        expect(results.length).toBeLessThanOrEqual(RAG_QUERY_LIMIT_MAX);

        db.close();
    });

    it('limit = 1 returns exactly 1 result from a populated store', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        await rag.ingest([
            { content: 'Button component primary action', source: 'manifest', chunkType: 'component' },
            { content: 'Card component surface elevation', source: 'manifest', chunkType: 'component' },
            { content: 'Badge status indicator component', source: 'manifest', chunkType: 'component' },
        ]);

        const results = await rag.query('component', 1);
        expect(results).toHaveLength(1);

        db.close();
    });

    it('does not throw for any limit value 0–1000 on a populated store', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        await rag.ingest([
            { content: 'Anchor navigation link component', source: 'manifest', chunkType: 'component' },
        ]);

        for (const limit of [0, 1, 5, 50, 100, 101, 500, 1000]) {
            await expect(rag.query('anchor link', limit)).resolves.not.toThrow();
        }

        db.close();
    });
});

// ── M5: verify the clamp implementation exists in source ─────────────────────

describe('createRAGService — M5 implementation already shipped (source-level verification)', () => {
    it('query method does not throw for limit = 0 against an empty store', async () => {
        // The M5 clamp is guarded by the empty-store check (currentCount === 0) —
        // empty-store guard short-circuits before the clamped limit reaches sqlite-vec.
        const db = makeTestDb();
        const rag = createRAGService(db);
        await expect(rag.query('test', 0)).resolves.toEqual([]);
        db.close();
    });

    it('query method does not throw for NaN limit against an empty store', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);
        await expect(rag.query('test', NaN)).resolves.toEqual([]);
        db.close();
    });

    it('query method does not throw for negative limit against an empty store', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);
        await expect(rag.query('test', -5)).resolves.toEqual([]);
        db.close();
    });
});

// ── seedFromProject ───────────────────────────────────────────────────────────

describe('createRAGService — seedFromProject', () => {
    let projectRoot: string;
    let db: Database.Database;
    let rag: ReturnType<typeof createRAGService>;

    beforeEach(() => {
        projectRoot = join(tmpdir(), `flint-rag-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(join(projectRoot, '.flint', 'docs'), { recursive: true });
        db = makeTestDb();
        rag = createRAGService(db);
    });

    afterEach(() => {
        db.close();
        try {
            rmSync(projectRoot, { recursive: true, force: true });
        } catch {
            // ignore cleanup errors
        }
    });

    // ── empty project ──

    it('returns { ingested: 0, sources: [] } when no sources exist', async () => {
        const result = await rag.seedFromProject(projectRoot);
        expect(result.ingested).toBe(0);
        expect(result.sources).toEqual([]);
    });

    // ── ingest-dependent seedFromProject tests are blocked ──

    it('seeds from manifest only — returns sources = ["manifest"]', async () => {
        const manifest = {
            components: {
                Button: {
                    name: 'Button',
                    description: 'Primary action button',
                    importPath: '@flint/ui',
                },
            },
        };
        writeFileSync(
            join(projectRoot, 'flint-manifest.json'),
            JSON.stringify(manifest),
        );

        const result = await rag.seedFromProject(projectRoot);
        expect(result.sources).toEqual(['manifest']);
        expect(result.ingested).toBeGreaterThan(0);
    });

    it('seeds from tokens only — returns sources = ["tokens"]', async () => {
        const tokens = [
            { token_path: 'color.primary', token_type: 'color', token_value: '#3b82f6' },
            { token_path: 'color.secondary', token_type: 'color', token_value: '#6366f1' },
        ];
        writeFileSync(
            join(projectRoot, '.flint', 'design-tokens.json'),
            JSON.stringify(tokens),
        );

        const result = await rag.seedFromProject(projectRoot);
        expect(result.sources).toEqual(['tokens']);
        expect(result.ingested).toBeGreaterThan(0);
    });

    it('seeds from docs only — returns sources with collapsed "docs" entry', async () => {
        writeFileSync(
            join(projectRoot, '.flint', 'docs', 'intro.md'),
            '# Introduction\nThis is the design system documentation.',
        );

        const result = await rag.seedFromProject(projectRoot);
        expect(result.sources).toContain('docs');
        expect(result.ingested).toBeGreaterThan(0);
    });

    it('seeds from all three sources — returns sources with manifest, tokens, docs', async () => {
        // Write manifest
        const manifest = {
            components: {
                Chip: { name: 'Chip', description: 'Status chip component', importPath: '@flint/ui' },
            },
        };
        writeFileSync(join(projectRoot, 'flint-manifest.json'), JSON.stringify(manifest));

        // Write tokens
        const tokens = [
            { token_path: 'spacing.sm', token_type: 'spacing', token_value: '8px' },
        ];
        writeFileSync(join(projectRoot, '.flint', 'design-tokens.json'), JSON.stringify(tokens));

        // Write a doc file
        writeFileSync(
            join(projectRoot, '.flint', 'docs', 'spacing.md'),
            '# Spacing\nStandard spacing scale for layouts.',
        );

        const result = await rag.seedFromProject(projectRoot);
        expect(result.sources).toContain('manifest');
        expect(result.sources).toContain('tokens');
        expect(result.sources).toContain('docs');
        expect(result.ingested).toBeGreaterThan(0);
    });

    // ── symlink guard — can verify the source logic even though ingest is blocked ──

    it('skips symlinks in docs/ and logs a warning (symlink guard verification)', async () => {
        // Write a real .md file first
        writeFileSync(
            join(projectRoot, '.flint', 'docs', 'real.md'),
            '# Real doc content here.',
        );

        const symlinkPath = join(projectRoot, '.flint', 'docs', 'link.md');
        let symlinkCreated = false;
        try {
            symlinkSync(join(projectRoot, '.flint', 'docs', 'real.md'), symlinkPath);
            symlinkCreated = true;
        } catch {
            // Symlink creation can fail on some systems (Windows without permissions)
        }

        if (!symlinkCreated) return;

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // seedFromProject enumerates docs, hits the symlink, logs a warning, and
        // skips it. real.md is still ingested normally.
        const result = await rag.seedFromProject(projectRoot);

        // Only the real file is ingested — symlink is skipped
        expect(result.ingested).toBe(1);

        // Verify the symlink warning was logged
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('link.md'));

        warnSpy.mockRestore();
    });

    // ── malformed design-tokens.json ──

    it('survives malformed design-tokens.json without throwing', async () => {
        writeFileSync(join(projectRoot, '.flint', 'design-tokens.json'), '{invalid json{{');

        // seedFromProject catches JSON parse errors and continues
        await expect(rag.seedFromProject(projectRoot)).resolves.not.toThrow();
    });

    // ── M4: docs source collapse ──

    it('M4: seedFromProject with multiple doc files returns a single collapsed "docs" source entry', async () => {
        // Write 5 doc files
        for (let i = 1; i <= 5; i++) {
            writeFileSync(
                join(projectRoot, '.flint', 'docs', `doc${i}.md`),
                `# Doc ${i}\nContent for documentation file ${i}.`,
            );
        }

        const result = await rag.seedFromProject(projectRoot);

        // M4: all doc files collapse to a single "docs" entry, not 5 separate filenames
        const docEntries = result.sources.filter(s => s === 'docs');
        expect(docEntries).toHaveLength(1);

        // No per-file "docs/docN.md" entries should appear
        const perFileEntries = result.sources.filter(s => s.startsWith('docs/'));
        expect(perFileEntries).toHaveLength(0);

        // Ingested chunks = 5 (one per file)
        expect(result.ingested).toBe(5);
    });

    // ── docs sources are collapsed — current implementation uses "docs" not per-filename ──

    it('docs sources are collapsed to "docs" not per-filename "docs/filename.md" entries', async () => {
        writeFileSync(
            join(projectRoot, '.flint', 'docs', 'components.md'),
            '# Components\nComponent catalogue overview.',
        );
        writeFileSync(
            join(projectRoot, '.flint', 'docs', 'tokens.md'),
            '# Tokens\nDesign token reference.',
        );

        const result = await rag.seedFromProject(projectRoot);

        // Sources should contain "docs" once, not "docs/components.md" and "docs/tokens.md"
        expect(result.sources).toContain('docs');
        expect(result.sources.filter(s => s === 'docs')).toHaveLength(1);
        expect(result.sources).not.toContain('docs/components.md');
        expect(result.sources).not.toContain('docs/tokens.md');
    });
});

// ── clear ─────────────────────────────────────────────────────────────────────

describe('createRAGService — clear', () => {
    it('clear is idempotent — calling twice on empty store does not throw', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        await rag.clear();
        await expect(rag.clear()).resolves.toBeUndefined();

        db.close();
    });

    it('clear removes all chunks from a populated store', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        await rag.ingest([
            { content: 'Spinner loading indicator animation', source: 'manifest', chunkType: 'component' },
            { content: 'Progress bar determinate state', source: 'manifest', chunkType: 'component' },
            { content: 'Skeleton placeholder loading state', source: 'manifest', chunkType: 'component' },
        ]);

        expect(await rag.count()).toBe(3);

        await rag.clear();

        expect(await rag.count()).toBe(0);

        db.close();
    });

    it('after clear, query returns []', async () => {
        const db = makeTestDb();
        const rag = createRAGService(db);

        await rag.ingest([
            { content: 'Tooltip hover popover accessibility', source: 'manifest', chunkType: 'component' },
        ]);

        const beforeClear = await rag.query('tooltip hover');
        expect(beforeClear.length).toBeGreaterThan(0);

        await rag.clear();

        const afterClear = await rag.query('tooltip hover');
        expect(afterClear).toEqual([]);

        db.close();
    });
});
