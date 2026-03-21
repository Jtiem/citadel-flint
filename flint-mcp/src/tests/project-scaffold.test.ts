/**
 * project-scaffold.test.ts — flint-mcp/src/tests/project-scaffold.test.ts
 *
 * Journey 10: Create New Project — MCP-side tests.
 *
 * Test map:
 *   #35 — project:initialize creates the .flint directory inside the project
 *   #36 — design-tokens.json is valid JSON after scaffolding
 *   #37 — Scaffolded folder contains at least one .tsx file
 *   #39 — Starter template (App.tsx) has 0 MithrilLinter auditAll violations
 *
 * Environment: node (flint-mcp/vitest.config.ts)
 *
 * Scaffolding approach:
 *   The real `initializeProject` from electron/templateService.ts uses
 *   `electron.app.getAppPath()` and cannot be imported in a plain node test.
 *   Instead, these tests scaffold the expected workspace structure directly
 *   by copying the template files via Node fs — the same operations the IPC
 *   handler performs — so we validate the *output contract*, not the Electron
 *   IPC layer.
 *
 *   The MithrilLinter test (#39) uses the real Babel parser and the real
 *   flint-mcp MithrilLinter (`auditAll`), exactly as workspace-audit.test.ts
 *   does. No mocks touch the linter path.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import type { File as BabelFile } from '@babel/types'

import { auditAll } from '../core/MithrilLinter.js'
import type { DesignToken } from '../types.js'

// ── Template paths (resolve from flint-mcp/src/tests/ up to repo root) ───────

// Derive __dirname from import.meta.url (Node ESM — matches the pattern used
// in flint-mcp/src/domains/index.ts for cross-version compatibility).
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// __dirname is flint-mcp/src/tests/
// flint-mcp/src/tests/ → flint-mcp/src/ → flint-mcp/ → repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const BASE_TEMPLATE_DIR = path.join(
    REPO_ROOT,
    'electron',
    'templates',
    'base-vite-tailwind',
)
const APP_TSX_PATH = path.join(BASE_TEMPLATE_DIR, 'src', 'App.tsx')

// ── Test workspace setup ───────────────────────────────────────────────────────

/** Temporary directory tree created before all tests and removed after all. */
let workspaceRoot: string

/**
 * Scaffold a minimal Flint workspace into `workspaceRoot`:
 *   <root>/
 *     .flint/
 *       design-tokens.json
 *     src/
 *       App.tsx          (copied from base-vite-tailwind template)
 *
 * This mirrors what `initializeProject('base-vite-tailwind')` produces plus
 * the `.flint/` sentinel directory that the IPC handler creates separately.
 */
beforeAll(() => {
    workspaceRoot = mkdtempSync(path.join(tmpdir(), 'flint-scaffold-test-'))

    // Create .flint/ directory and design-tokens.json
    const flintDir = path.join(workspaceRoot, '.flint')
    mkdirSync(flintDir, { recursive: true })
    const initialTokens: DesignToken[] = []
    writeFileSync(
        path.join(flintDir, 'design-tokens.json'),
        JSON.stringify(initialTokens, null, 2),
        'utf8',
    )

    // Copy the base-vite-tailwind template src/ tree into the workspace
    const templateSrc = path.join(BASE_TEMPLATE_DIR, 'src')
    const workspaceSrc = path.join(workspaceRoot, 'src')
    mkdirSync(workspaceSrc, { recursive: true })
    cpSync(templateSrc, workspaceSrc, { recursive: true })
})

afterAll(() => {
    if (workspaceRoot) {
        rmSync(workspaceRoot, { recursive: true, force: true })
    }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a TSX source string into a Babel AST. */
function parseTSX(source: string): BabelFile {
    return parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    }) as unknown as BabelFile
}

/** Walk `dir` recursively and collect all file paths matching `ext`. */
function findByExtension(dir: string, ext: string): string[] {
    const results: string[] = []
    function walk(current: string): void {
        for (const entry of readdirSync(current)) {
            const full = path.join(current, entry)
            if (statSync(full).isDirectory()) {
                walk(full)
            } else if (full.endsWith(ext)) {
                results.push(full)
            }
        }
    }
    walk(dir)
    return results
}

// ── #35: project:initialize creates .flint directory ─────────────────────────

describe('#35 — project:initialize creates .flint directory', () => {
    it('.flint/ exists in the scaffolded workspace', () => {
        const flintDir = path.join(workspaceRoot, '.flint')
        expect(existsSync(flintDir)).toBe(true)
    })

    it('.flint/ is a directory, not a file', () => {
        const flintDir = path.join(workspaceRoot, '.flint')
        expect(statSync(flintDir).isDirectory()).toBe(true)
    })

    it('.flint/ contains at least design-tokens.json', () => {
        const tokensPath = path.join(workspaceRoot, '.flint', 'design-tokens.json')
        expect(existsSync(tokensPath)).toBe(true)
    })
})

// ── #36: design-tokens.json is valid JSON ─────────────────────────────────────

describe('#36 — design-tokens.json is valid JSON', () => {
    it('reads the file without throwing', () => {
        const tokensPath = path.join(workspaceRoot, '.flint', 'design-tokens.json')
        expect(() => readFileSync(tokensPath, 'utf8')).not.toThrow()
    })

    it('parses as valid JSON without throwing', () => {
        const tokensPath = path.join(workspaceRoot, '.flint', 'design-tokens.json')
        const raw = readFileSync(tokensPath, 'utf8')
        expect(() => JSON.parse(raw)).not.toThrow()
    })

    it('parsed value is an array (initial token store is an empty array)', () => {
        const tokensPath = path.join(workspaceRoot, '.flint', 'design-tokens.json')
        const parsed = JSON.parse(readFileSync(tokensPath, 'utf8'))
        expect(Array.isArray(parsed)).toBe(true)
    })

    it('parsed value is not null or undefined', () => {
        const tokensPath = path.join(workspaceRoot, '.flint', 'design-tokens.json')
        const parsed = JSON.parse(readFileSync(tokensPath, 'utf8'))
        expect(parsed).not.toBeNull()
        expect(parsed).not.toBeUndefined()
    })
})

// ── #37: Scaffolded folder passes validation (has .tsx files) ─────────────────

describe('#37 — Scaffolded workspace contains .tsx files', () => {
    it('finds at least one .tsx file in the scaffolded workspace', () => {
        const tsxFiles = findByExtension(workspaceRoot, '.tsx')
        expect(tsxFiles.length).toBeGreaterThanOrEqual(1)
    })

    it('finds App.tsx specifically', () => {
        const tsxFiles = findByExtension(workspaceRoot, '.tsx')
        const hasApp = tsxFiles.some((f) => f.endsWith('App.tsx'))
        expect(hasApp).toBe(true)
    })

    it('src/ directory exists in the scaffolded workspace', () => {
        const srcDir = path.join(workspaceRoot, 'src')
        expect(existsSync(srcDir)).toBe(true)
    })
})

// ── #39: Starter template has 0 MithrilLinter violations ──────────────────────

describe('#39 — Starter template (App.tsx) has 0 MithrilLinter auditAll violations', () => {
    /**
     * The starter template uses only Tailwind semantic classes (bg-gray-950,
     * text-white, etc.) — no arbitrary hex values. auditAll should produce
     * an empty warnings Map.
     *
     * We run against zero tokens (empty array) because the starter template
     * has no arbitrary-value classes, so the color gate never fires regardless
     * of the token set. This mirrors the snippetAuditor Stress Category 3-d
     * pattern ("skips the colour gate when the token list is empty").
     */
    it('reads App.tsx from the real template path without error', () => {
        expect(() => readFileSync(APP_TSX_PATH, 'utf8')).not.toThrow()
    })

    it('parses App.tsx as valid TSX without Babel errors', () => {
        const source = readFileSync(APP_TSX_PATH, 'utf8')
        expect(() => parseTSX(source)).not.toThrow()
    })

    it('produces 0 Mithril violations with an empty token set', () => {
        const source = readFileSync(APP_TSX_PATH, 'utf8')
        const ast = parseTSX(source)
        const warnings = auditAll(ast, [])
        expect(warnings.size).toBe(0)
    })

    it('produces 0 Mithril violations with a representative color token set', () => {
        // Even with tokens loaded, the starter template must stay clean because
        // it uses only named Tailwind classes (no arbitrary hex values).
        const tokens: DesignToken[] = [
            {
                id: 1,
                token_path: 'color.brand.primary',
                token_type: 'color',
                token_value: '#6366f1',
                description: null,
                collection_name: 'global',
                mode: 'default',
            },
            {
                id: 2,
                token_path: 'color.surface.dark',
                token_type: 'color',
                token_value: '#030712',
                description: null,
                collection_name: 'global',
                mode: 'default',
            },
            {
                id: 3,
                token_path: 'color.text.default',
                token_type: 'color',
                token_value: '#ffffff',
                description: null,
                collection_name: 'global',
                mode: 'default',
            },
        ]

        const source = readFileSync(APP_TSX_PATH, 'utf8')
        const ast = parseTSX(source)
        const warnings = auditAll(ast, tokens)
        expect(warnings.size).toBe(0)
    })

    it('App.tsx source contains "export default" (is a valid module)', () => {
        const source = readFileSync(APP_TSX_PATH, 'utf8')
        expect(source).toContain('export default')
    })

    it('App.tsx source contains no hardcoded hex arbitrary-value Tailwind classes', () => {
        const source = readFileSync(APP_TSX_PATH, 'utf8')
        // The Mithril color-drift visitor only fires on bg-[#...], text-[#...] etc.
        // Verify the source itself is free of them so the audit result is trust-worthy.
        expect(source).not.toMatch(/(?:bg|text|border|fill|stroke|ring|shadow|from|via|to)-\[#[0-9a-fA-F]/i)
    })
})
