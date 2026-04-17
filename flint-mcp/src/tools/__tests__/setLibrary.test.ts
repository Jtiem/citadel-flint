/**
 * ARM.1 — setLibrary integration tests
 * flint-mcp/src/tools/__tests__/setLibrary.test.ts
 *
 * Scope:
 *   - flint_set_library mui seeds library component manifest into flint-manifest.json
 *   - Seeding is idempotent (calling twice does not duplicate entries)
 *   - A local 'Box' entry in the manifest survives MUI seeding (not overwritten)
 *   - Response text includes "Component seeding:" line with count
 *
 * All file system writes go to a tmp directory that is cleaned up after each test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { handleSetLibrary } from '../setLibrary.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-setlib-test-'))
}

function ensureFlintDir(projectRoot: string): string {
    const flintDir = path.join(projectRoot, '.flint')
    if (!fs.existsSync(flintDir)) {
        fs.mkdirSync(flintDir, { recursive: true })
    }
    return flintDir
}

function readManifest(projectRoot: string): Record<string, unknown> {
    const manifestPath = path.join(projectRoot, '.flint', 'flint-manifest.json')
    if (!fs.existsSync(manifestPath)) return {}
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
}

function writeManifest(projectRoot: string, data: Record<string, unknown>): void {
    ensureFlintDir(projectRoot)
    fs.writeFileSync(
        path.join(projectRoot, '.flint', 'flint-manifest.json'),
        JSON.stringify(data, null, 2) + '\n',
        'utf-8',
    )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleSetLibrary — ARM.1 component seeding', () => {
    let projectRoot: string

    beforeEach(() => {
        projectRoot = makeTmpDir()
    })

    afterEach(() => {
        fs.rmSync(projectRoot, { recursive: true, force: true })
    })

    // ── Test 1: Box is seeded after flint_set_library mui ─────────────────────

    it('seeds Box into flint-manifest.json after flint_set_library mui', () => {
        const result = handleSetLibrary({ library: 'mui', projectRoot })

        expect(result.isError).toBeFalsy()

        const manifest = readManifest(projectRoot)
        expect(Array.isArray(manifest.libraryComponents)).toBe(true)

        const libraryComponents = manifest.libraryComponents as Array<{ name: string; source: string }>
        const box = libraryComponents.find(c => c.name === 'Box')
        expect(box).toBeDefined()
        expect(box?.source).toBe('library')
    })

    // ── Test 2: Seeding is idempotent ─────────────────────────────────────────

    it('is idempotent — calling twice does not duplicate entries', () => {
        handleSetLibrary({ library: 'mui', projectRoot })
        const afterFirst = readManifest(projectRoot)
        const firstCount = (afterFirst.libraryComponents as unknown[]).length

        handleSetLibrary({ library: 'mui', projectRoot })
        const afterSecond = readManifest(projectRoot)
        const secondCount = (afterSecond.libraryComponents as unknown[]).length

        expect(secondCount).toBe(firstCount)
    })

    // ── Test 3: Local 'Box' entry survives MUI seeding ────────────────────────

    it('does not overwrite a local Box component with the library entry', () => {
        // Pre-seed a local Box entry
        writeManifest(projectRoot, {
            components: [
                {
                    name: 'Box',
                    importPath: './components/Box',
                    source: 'local',
                    description: 'Custom local Box',
                },
            ],
        })

        handleSetLibrary({ library: 'mui', projectRoot })

        const manifest = readManifest(projectRoot)
        const components = manifest.components as Array<{ name: string; source: string; description: string }>
        const localBox = components.find(c => c.name === 'Box' && c.source === 'local')
        expect(localBox).toBeDefined()
        expect(localBox?.description).toBe('Custom local Box')

        // The library Box should NOT appear in libraryComponents for 'Box'
        // (it's skipped because a local component with the same name exists)
        const libraryComponents = manifest.libraryComponents as Array<{ name: string; source: string }>
        const libraryBox = libraryComponents.find(c => c.name === 'Box')
        expect(libraryBox).toBeUndefined()
    })

    // ── Test 4: Response includes "Library components:" line ──────────────────

    it('response text includes "Library components:" line with count', () => {
        const result = handleSetLibrary({ library: 'mui', projectRoot })

        expect(result.isError).toBeFalsy()
        const text = result.content[0].text
        expect(text).toMatch(/Library components: \d+ registered/)
    })

    // ── Test 5: shadcn seeding works ──────────────────────────────────────────

    it('seeds shadcn components with source: library', () => {
        const result = handleSetLibrary({ library: 'shadcn', projectRoot })

        expect(result.isError).toBeFalsy()

        const manifest = readManifest(projectRoot)
        const libraryComponents = manifest.libraryComponents as Array<{ name: string; source: string }>
        expect(libraryComponents.length).toBeGreaterThan(0)

        for (const entry of libraryComponents) {
            expect(entry.source).toBe('library')
        }
    })

    // ── Test 6: Tailwind seeds zero components (utility-first) ────────────────

    it('seeds zero library components for tailwind (utility-first library)', () => {
        handleSetLibrary({ library: 'tailwind', projectRoot })

        const manifest = readManifest(projectRoot)
        // Either libraryComponents is absent or empty
        const libraryComponents = manifest.libraryComponents as unknown[] | undefined
        if (libraryComponents !== undefined) {
            expect(libraryComponents.length).toBe(0)
        }
    })
})
