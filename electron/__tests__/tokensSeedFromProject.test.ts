/**
 * tokensSeedFromProject.test.ts — electron/__tests__/tokensSeedFromProject.test.ts
 *
 * Unit tests for the `tokens:seed-from-project` IPC handler.
 *
 * Pattern: the core logic from electron/main.ts is reproduced here as a pure
 * function with injected dependencies (fs read, clear, insert, broadcast) so
 * no Electron APIs (ipcMain, BrowserWindow) or native SQLite binary are
 * required in the test process. This follows the same approach used by
 * governance-ipc.test.ts, coverageIpc.test.ts, and telemetryIpc.test.ts.
 *
 * Covers:
 *   TSFP-01 — Happy path: .flint/design-tokens.json exists, valid DTCG
 *             → returns { seeded: N, source: 'project', sourcePath: <abs> }
 *   TSFP-02 — Fallback path: design-tokens.json at project root (no .flint/ prefix)
 *             → returns same shape with root-level sourcePath
 *   TSFP-03 — No DTCG file at all → returns { seeded: 0, source: 'none' }, no error key
 *   TSFP-04 — Malformed JSON → returns { seeded: 0, source: 'none', error: <string> }, does NOT throw
 *   TSFP-05 — Invalid input (empty string) → returns { seeded: 0, source: 'none', error: 'invalid project root' }
 *   TSFP-06 — Invalid input (non-string) → returns { seeded: 0, source: 'none', error: 'invalid project root' }
 *   TSFP-07 — Invalid input (undefined) → returns { seeded: 0, source: 'none', error: 'invalid project root' }
 *   TSFP-08 — DTCG flatten correctness: nested groups produce token_path with '/' separators
 *   TSFP-09 — DTCG flatten: token count in response matches actual leaf tokens in file
 *   TSFP-10 — clearAll is called before insert (seeded tokens replace, not append)
 *   TSFP-11 — broadcastTokensUpdated is called on success
 *   TSFP-12 — broadcastTokensUpdated is NOT called when no file found
 *   TSFP-13 — broadcastTokensUpdated is NOT called when JSON is malformed
 *   TSFP-14 — .flint/ candidate is checked before root-level fallback (priority order)
 *   TSFP-15 — DTCG with $description field preserves description on FlatToken
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import { flattenDtcg } from '../../shared/dtcgFlatten'

// ── Shared DTCG fixtures ──────────────────────────────────────────────────────

const SIMPLE_DTCG = {
    colors: {
        primary: {
            500: {
                $value: '#6366f1',
                $type: 'color',
                $description: 'Primary brand color',
            },
            900: {
                $value: '#1e1b4b',
                $type: 'color',
            },
        },
        neutral: {
            100: {
                $value: '#f5f5f5',
                $type: 'color',
            },
        },
    },
    spacing: {
        base: {
            $value: '4px',
            $type: 'dimension',
        },
    },
}

// 4 leaf tokens: colors/primary/500, colors/primary/900, colors/neutral/100, spacing/base
const SIMPLE_DTCG_COUNT = 4

const NESTED_DTCG = {
    brand: {
        typography: {
            heading: {
                fontFamily: {
                    $value: 'Inter',
                    $type: 'fontFamily',
                },
                fontSize: {
                    $value: '2rem',
                    $type: 'dimension',
                },
            },
        },
        color: {
            background: {
                default: {
                    $value: '#ffffff',
                    $type: 'color',
                },
            },
        },
    },
}

// ── Handler logic reproduction ────────────────────────────────────────────────
//
// Mirrors the core of the ipcMain.handle('tokens:seed-from-project', ...) in
// electron/main.ts as a pure async function. Dependencies (existsSync, readFile,
// clearAll, insertToken, broadcast) are injected so the test controls every
// boundary without touching Electron or SQLite.

interface InsertedToken {
    token_path: string
    token_type: string
    token_value: string
    description: string | null
}

interface SeedResult {
    seeded: number
    source: 'project' | 'none'
    sourcePath?: string
    error?: string
}

async function seedFromProjectHandlerLogic(
    projectRoot: unknown,
    deps: {
        existsSync: (p: string) => boolean
        readFile: (p: string, encoding: string) => Promise<string>
        clearAll: () => void
        insertToken: (t: InsertedToken) => void
        broadcast: () => void
    },
): Promise<SeedResult> {
    if (typeof projectRoot !== 'string' || projectRoot.length === 0) {
        return { seeded: 0, source: 'none', error: 'invalid project root' }
    }
    const candidates = [
        path.join(projectRoot, '.flint', 'design-tokens.json'),
        path.join(projectRoot, 'design-tokens.json'),
    ]
    let dtcgPath: string | null = null
    for (const candidate of candidates) {
        if (deps.existsSync(candidate)) {
            dtcgPath = candidate
            break
        }
    }
    if (!dtcgPath) {
        return { seeded: 0, source: 'none' }
    }
    try {
        const raw = await deps.readFile(dtcgPath, 'utf8')
        const parsed = JSON.parse(raw) as unknown
        const tokens = flattenDtcg(parsed)
        deps.clearAll()
        for (const t of tokens) {
            deps.insertToken({
                token_path: t.token_path,
                token_type: t.token_type,
                token_value: t.token_value,
                description: t.description ?? null,
            })
        }
        deps.broadcast()
        return { seeded: tokens.length, source: 'project', sourcePath: dtcgPath }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { seeded: 0, source: 'none', error: message }
    }
}

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Creates a temp directory and returns its absolute path. */
function makeTmpDir(): string {
    return mkdtempSync(path.join(os.tmpdir(), 'flint-tsfp-'))
}

/** Writes a JSON file at the given path, creating parent dirs as needed. */
function writeJson(filePath: string, data: unknown): void {
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

type Deps = {
    existsSync: typeof existsSync
    readFile: (p: string, enc: string) => Promise<string>
    clearAll: () => void
    insertToken: (t: InsertedToken) => void
    broadcast: () => void
    _inserted: () => InsertedToken[]
    _clearCount: () => number
    _broadcastCount: () => number
}

/** Builds a minimal injected deps object backed by real fs in a tmp dir. */
function realFsDeps(overrides: Partial<Deps> = {}): Deps {
    const inserted: InsertedToken[] = []
    let clearCount = 0
    let broadcastCount = 0
    const deps: Deps = {
        existsSync,
        readFile: (p: string, enc: string) => readFile(p, enc as 'utf8'),
        clearAll: () => { clearCount++ },
        insertToken: (t: InsertedToken) => { inserted.push(t) },
        broadcast: () => { broadcastCount++ },
        _inserted: () => inserted,
        _clearCount: () => clearCount,
        _broadcastCount: () => broadcastCount,
        ...overrides,
    }
    return deps
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

let TMP: string

beforeEach(() => {
    TMP = makeTmpDir()
})

afterEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tokens:seed-from-project handler logic', () => {

    describe('TSFP-01 — happy path: .flint/design-tokens.json exists', () => {
        it('returns { seeded: N, source: "project", sourcePath: <abs> }', async () => {
            const dtcgPath = path.join(TMP, '.flint', 'design-tokens.json')
            writeJson(dtcgPath, SIMPLE_DTCG)
            const deps = realFsDeps()

            const result = await seedFromProjectHandlerLogic(TMP, deps)

            expect(result.source).toBe('project')
            expect(result.seeded).toBe(SIMPLE_DTCG_COUNT)
            expect(result.sourcePath).toBe(dtcgPath)
            expect(result.error).toBeUndefined()
        })

        it('inserts the correct number of tokens', async () => {
            writeJson(path.join(TMP, '.flint', 'design-tokens.json'), SIMPLE_DTCG)
            const deps = realFsDeps()

            await seedFromProjectHandlerLogic(TMP, deps)

            expect(deps._inserted()).toHaveLength(SIMPLE_DTCG_COUNT)
        })
    })

    describe('TSFP-02 — fallback path: design-tokens.json at project root', () => {
        it('finds root-level file and returns correct sourcePath', async () => {
            const rootDtcg = path.join(TMP, 'design-tokens.json')
            writeJson(rootDtcg, SIMPLE_DTCG)
            const deps = realFsDeps()

            const result = await seedFromProjectHandlerLogic(TMP, deps)

            expect(result.source).toBe('project')
            expect(result.seeded).toBe(SIMPLE_DTCG_COUNT)
            expect(result.sourcePath).toBe(rootDtcg)
        })
    })

    describe('TSFP-03 — no DTCG file at all', () => {
        it('returns { seeded: 0, source: "none" } with no error key', async () => {
            const deps = realFsDeps()

            const result = await seedFromProjectHandlerLogic(TMP, deps)

            expect(result.seeded).toBe(0)
            expect(result.source).toBe('none')
            expect('error' in result).toBe(false)
        })
    })

    describe('TSFP-04 — malformed JSON', () => {
        it('returns { seeded: 0, source: "none", error: <string> } without throwing', async () => {
            writeJson(path.join(TMP, '.flint', 'design-tokens.json'), '{}') // writeJson writes valid JSON
            // Overwrite with broken bytes directly
            writeFileSync(
                path.join(TMP, '.flint', 'design-tokens.json'),
                '{ "colors": { BROKEN',
                'utf-8',
            )
            const deps = realFsDeps()

            // Must not throw
            await expect(
                seedFromProjectHandlerLogic(TMP, deps),
            ).resolves.toMatchObject({
                seeded: 0,
                source: 'none',
            })

            // error field must be a non-empty string
            const resolved = await seedFromProjectHandlerLogic(TMP, deps)
            expect(typeof resolved.error).toBe('string')
            expect(resolved.error!.length).toBeGreaterThan(0)
        })
    })

    describe('TSFP-05–07 — invalid input', () => {
        it('TSFP-05: empty string returns invalid project root error', async () => {
            const deps = realFsDeps()
            const result = await seedFromProjectHandlerLogic('', deps)
            expect(result).toEqual({ seeded: 0, source: 'none', error: 'invalid project root' })
        })

        it('TSFP-06: number returns invalid project root error', async () => {
            const deps = realFsDeps()
            const result = await seedFromProjectHandlerLogic(42, deps)
            expect(result).toEqual({ seeded: 0, source: 'none', error: 'invalid project root' })
        })

        it('TSFP-07: undefined returns invalid project root error', async () => {
            const deps = realFsDeps()
            const result = await seedFromProjectHandlerLogic(undefined, deps)
            expect(result).toEqual({ seeded: 0, source: 'none', error: 'invalid project root' })
        })
    })

    describe('TSFP-08 — DTCG flatten: token_path uses "/" separators', () => {
        it('nested group keys join with "/" (not "." or "-")', async () => {
            writeJson(path.join(TMP, '.flint', 'design-tokens.json'), NESTED_DTCG)
            const deps = realFsDeps()

            await seedFromProjectHandlerLogic(TMP, deps)

            const paths = deps._inserted().map((t) => t.token_path)
            expect(paths).toContain('brand/typography/heading/fontFamily')
            expect(paths).toContain('brand/typography/heading/fontSize')
            expect(paths).toContain('brand/color/background/default')
            // Must NOT use dot notation
            paths.forEach((p) => expect(p).not.toContain('.'))
        })
    })

    describe('TSFP-09 — DTCG flatten: seeded count matches leaf tokens', () => {
        it('reports the exact number of $value leaves in the file', async () => {
            const dtcg = {
                one: { $value: 'a', $type: 'string' },
                two: { $value: 'b', $type: 'string' },
                three: { $value: 'c', $type: 'string' },
            }
            writeJson(path.join(TMP, 'design-tokens.json'), dtcg)
            const deps = realFsDeps()

            const result = await seedFromProjectHandlerLogic(TMP, deps)

            expect(result.seeded).toBe(3)
            expect(deps._inserted()).toHaveLength(3)
        })
    })

    describe('TSFP-10 — clearAll is called before inserts', () => {
        it('clearAll runs exactly once before any insertToken calls', async () => {
            writeJson(path.join(TMP, '.flint', 'design-tokens.json'), SIMPLE_DTCG)
            const callOrder: string[] = []
            const deps = realFsDeps({
                clearAll: () => { callOrder.push('clear') },
                insertToken: (_t) => { callOrder.push('insert') },
            })

            await seedFromProjectHandlerLogic(TMP, deps)

            expect(callOrder[0]).toBe('clear')
            expect(callOrder.filter((e) => e === 'clear')).toHaveLength(1)
            expect(callOrder.filter((e) => e === 'insert')).toHaveLength(SIMPLE_DTCG_COUNT)
        })
    })

    describe('TSFP-11 — broadcastTokensUpdated called on success', () => {
        it('broadcast fires exactly once after a successful seed', async () => {
            writeJson(path.join(TMP, '.flint', 'design-tokens.json'), SIMPLE_DTCG)
            const deps = realFsDeps()

            await seedFromProjectHandlerLogic(TMP, deps)

            expect(deps._broadcastCount()).toBe(1)
        })
    })

    describe('TSFP-12 — broadcastTokensUpdated NOT called when no file found', () => {
        it('broadcast does not fire when source === "none" (file absent)', async () => {
            const deps = realFsDeps()

            await seedFromProjectHandlerLogic(TMP, deps)

            expect(deps._broadcastCount()).toBe(0)
        })
    })

    describe('TSFP-13 — broadcastTokensUpdated NOT called on malformed JSON', () => {
        it('broadcast does not fire when JSON parse throws', async () => {
            mkdirSync(path.join(TMP, '.flint'), { recursive: true })
            writeFileSync(
                path.join(TMP, '.flint', 'design-tokens.json'),
                '<<NOT JSON>>',
                'utf-8',
            )
            const deps = realFsDeps()

            await seedFromProjectHandlerLogic(TMP, deps)

            expect(deps._broadcastCount()).toBe(0)
        })
    })

    describe('TSFP-14 — .flint/ candidate has priority over root-level fallback', () => {
        it('uses .flint/design-tokens.json when both files exist', async () => {
            const flintPath = path.join(TMP, '.flint', 'design-tokens.json')
            const rootPath = path.join(TMP, 'design-tokens.json')

            // .flint/ has 1 token; root has 4 tokens — if wrong file wins, count differs
            writeJson(flintPath, {
                single: { $value: '#fff', $type: 'color' },
            })
            writeJson(rootPath, SIMPLE_DTCG)

            const deps = realFsDeps()
            const result = await seedFromProjectHandlerLogic(TMP, deps)

            expect(result.sourcePath).toBe(flintPath)
            expect(result.seeded).toBe(1)
        })
    })

    describe('TSFP-15 — DTCG $description is preserved on FlatToken', () => {
        it('token with $description has description field set on inserted token', async () => {
            writeJson(path.join(TMP, '.flint', 'design-tokens.json'), SIMPLE_DTCG)
            const deps = realFsDeps()

            await seedFromProjectHandlerLogic(TMP, deps)

            const primaryToken = deps._inserted().find(
                (t) => t.token_path === 'colors/primary/500',
            )
            expect(primaryToken).toBeDefined()
            expect(primaryToken!.description).toBe('Primary brand color')
        })

        it('token without $description has description set to null', async () => {
            writeJson(path.join(TMP, '.flint', 'design-tokens.json'), SIMPLE_DTCG)
            const deps = realFsDeps()

            await seedFromProjectHandlerLogic(TMP, deps)

            const neutralToken = deps._inserted().find(
                (t) => t.token_path === 'colors/primary/900',
            )
            expect(neutralToken).toBeDefined()
            expect(neutralToken!.description).toBeNull()
        })
    })

})

// ── flattenDtcg unit tests (shared/dtcgFlatten.ts) ────────────────────────────
//
// These exercise the shared flatten utility directly — they test the same
// contract the handler relies on without going through the full handler path.
// Kept in this file because the handler test is the primary consumer.

describe('flattenDtcg (shared utility)', () => {
    it('returns empty array for null input', () => {
        expect(flattenDtcg(null)).toEqual([])
    })

    it('returns empty array for a non-object input', () => {
        expect(flattenDtcg('string')).toEqual([])
        expect(flattenDtcg(42)).toEqual([])
    })

    it('returns empty array for an object with no $value leaves', () => {
        expect(flattenDtcg({ group: { subgroup: { noValue: true } } })).toEqual([])
    })

    it('skips keys starting with $', () => {
        const tokens = flattenDtcg({
            $schema: 'https://example.com',
            color: { $value: '#fff', $type: 'color' },
        })
        expect(tokens).toHaveLength(1)
        expect(tokens[0].token_path).toBe('color')
    })

    it('normalizes unknown $type to "string"', () => {
        const tokens = flattenDtcg({
            token: { $value: 'something', $type: 'unknownType' },
        })
        expect(tokens[0].token_type).toBe('string')
    })

    it('normalizes "number" $type to "string"', () => {
        const tokens = flattenDtcg({
            token: { $value: 42, $type: 'number' },
        })
        expect(tokens[0].token_type).toBe('string')
    })

    it('stringifies non-string $value', () => {
        const tokens = flattenDtcg({
            token: { $value: { x: 1 }, $type: 'shadow' },
        })
        expect(typeof tokens[0].token_value).toBe('string')
    })
})
