/**
 * Stack detector tests — flint-mcp/src/__tests__/stackDetector.test.ts
 *
 * Validates that detectStack() correctly identifies design-system frameworks
 * by mocking the Node.js `fs` module so no real disk I/O occurs.
 *
 * Test map:
 *   1  — Detects tailwind-v3 from tailwind.config.js
 *   2  — Detects tailwind-v4 from @theme block in CSS
 *   3  — Detects css-custom-props from :root { -- } in CSS
 *   4  — Detects dtcg from W3C $value/$type JSON (tokens.json)
 *   5  — Detects chakra from package.json dependency
 *   6  — Detects react UI framework from package.json
 *   7  — Detects TypeScript when tsconfig.json exists
 *   8  — Returns 'none' for an empty project (no config files, no deps)
 *   9  — Prioritizes dtcg (.flint/design-tokens.json) over tailwind config
 *   10 — Detects MUI from package.json
 *   11 — Detects Radix from package.json
 *   12 — Detects tailwind-v4 with multiple candidate CSS paths
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'

// ── Mock fs before importing the module under test ───────────────────────────
// We use a factory that captures overrides through a shared mutable map.
const mockFiles: Map<string, string | 'dir' | null> = new Map()

vi.mock('node:fs', () => {
    const MockDirent = class {
        name: string
        isDirectory_: boolean
        constructor(name: string, isDir: boolean) {
            this.name = name
            this.isDirectory_ = isDir
        }
        isDirectory() { return this.isDirectory_ }
        isFile() { return !this.isDirectory_ }
    }

    return {
        default: {
            existsSync: (p: string) => mockFiles.has(p),
            readFileSync: (p: string, _enc: string) => {
                const v = mockFiles.get(p)
                if (v === undefined || v === null || v === 'dir') {
                    throw new Error(`ENOENT: no such file: ${p}`)
                }
                return v
            },
            readdirSync: (dir: string, opts?: { withFileTypes?: boolean }) => {
                const entries: string[] = []
                for (const key of mockFiles.keys()) {
                    if (path.dirname(key) === dir) {
                        entries.push(path.basename(key))
                    }
                }
                if (opts?.withFileTypes) {
                    return entries.map((name) => {
                        const fullPath = path.join(dir, name)
                        const isDir = mockFiles.get(fullPath) === 'dir'
                        return new MockDirent(name, isDir)
                    })
                }
                return entries
            },
        },
        existsSync: (p: string) => mockFiles.has(p),
        readFileSync: (p: string, _enc: string) => {
            const v = mockFiles.get(p)
            if (v === undefined || v === null || v === 'dir') {
                throw new Error(`ENOENT: no such file: ${p}`)
            }
            return v
        },
        readdirSync: (dir: string, opts?: { withFileTypes?: boolean }) => {
            const entries: string[] = []
            for (const key of mockFiles.keys()) {
                if (path.dirname(key) === dir) {
                    entries.push(path.basename(key))
                }
            }
            if (opts?.withFileTypes) {
                return entries.map((name) => {
                    const fullPath = path.join(dir, name)
                    const isDir = mockFiles.get(fullPath) === 'dir'
                    return new (class {
                        name = name
                        isDirectory() { return isDir }
                        isFile() { return !isDir }
                    })()
                })
            }
            return entries
        },
    }
})

// Import AFTER mocks are set up
import { detectStack } from '../core/init/stackDetector.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROOT = '/project'

/**
 * Register a file in the mock filesystem.
 * Also registers every parent directory as a 'dir' sentinel so that
 * `fs.existsSync(dirPath)` returns true for intermediate paths.
 */
function file(relativePath: string, content: string): void {
    const fullPath = path.join(ROOT, relativePath)
    mockFiles.set(fullPath, content)
    // Register all parent directories
    let dir = path.dirname(fullPath)
    while (dir !== path.dirname(dir)) {
        if (!mockFiles.has(dir)) {
            mockFiles.set(dir, 'dir')
        }
        dir = path.dirname(dir)
    }
}

function makePackageJson(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}): string {
    return JSON.stringify({ dependencies: deps, devDependencies: devDeps })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('detectStack()', () => {
    beforeEach(() => {
        mockFiles.clear()
    })

    afterEach(() => {
        mockFiles.clear()
    })

    // ── Test 1: Tailwind v3 ─────────────────────────────────────────────────
    it('detects tailwind-v3 from tailwind.config.js', async () => {
        file('package.json', makePackageJson({ react: '^18.0.0', tailwindcss: '^3.0.0' }))
        file('tailwind.config.js', `module.exports = { content: [], theme: {} }`)

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('tailwind-v3')
        expect(result.configPath).toBe(path.join(ROOT, 'tailwind.config.js'))
        expect(result.uiFramework).toBe('react')
    })

    it('detects tailwind-v3 from tailwind.config.ts', async () => {
        file('package.json', makePackageJson({ tailwindcss: '^3.4.0' }))
        file('tailwind.config.ts', `export default { content: [], theme: {} }`)

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('tailwind-v3')
        expect(result.configPath).toBe(path.join(ROOT, 'tailwind.config.ts'))
    })

    // ── Test 2: Tailwind v4 ─────────────────────────────────────────────────
    it('detects tailwind-v4 from @theme block in src/index.css', async () => {
        file('package.json', makePackageJson({ tailwindcss: '^4.0.0' }))
        file('src/index.css', `
@import "tailwindcss";

@theme {
  --color-primary: #3B82F6;
  --spacing-4: 1rem;
}
        `.trim())

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('tailwind-v4')
        expect(result.configPath).toBe(path.join(ROOT, 'src/index.css'))
        expect(result.cssFiles).toContain(path.join(ROOT, 'src/index.css'))
    })

    it('detects tailwind-v4 from @theme in app/globals.css', async () => {
        file('package.json', makePackageJson({}))
        file('app/globals.css', `@theme { --color-brand: #0066FF; }`)

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('tailwind-v4')
    })

    // ── Test 3: CSS custom properties ───────────────────────────────────────
    it('detects css-custom-props from :root in CSS file at project root', async () => {
        file('package.json', makePackageJson({}))
        // Place file at project root level so scanDir(ROOT) picks it up
        file('theme.css', `
:root {
  --color-primary: #3B82F6;
  --spacing-4: 16px;
}
        `.trim())

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('css-custom-props')
        expect(result.cssFiles.length).toBeGreaterThan(0)
        expect(result.cssFiles[0]).toContain('theme.css')
    })

    it('detects css-custom-props from :root in src/ directory', async () => {
        file('package.json', makePackageJson({}))
        file('src/vars.css', `:root { --color-bg: #fff; --font-size-base: 16px; }`)

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('css-custom-props')
        expect(result.cssFiles.some((f) => f.includes('vars.css'))).toBe(true)
    })

    // ── Test 4: DTCG token file ─────────────────────────────────────────────
    it('detects dtcg from tokens.json with $value/$type keys', async () => {
        file('package.json', makePackageJson({}))
        file('tokens.json', JSON.stringify({
            $schema: 'https://design-tokens.org/schema.json',
            color: {
                primary: { $value: '#3B82F6', $type: 'color' },
            },
        }))

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('dtcg')
        expect(result.configPath).toBe(path.join(ROOT, 'tokens.json'))
        expect(result.tokenFiles).toContain(path.join(ROOT, 'tokens.json'))
    })

    // ── Test 5: Chakra in package.json ──────────────────────────────────────
    it('detects chakra from @chakra-ui/react in package.json', async () => {
        file('package.json', makePackageJson({ '@chakra-ui/react': '^2.0.0', react: '^18.0.0' }))

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('chakra')
        expect(result.packageDeps).toContain('@chakra-ui/react')
    })

    // ── Test 6: React + TypeScript ──────────────────────────────────────────
    it('detects react UI framework and typescript flag', async () => {
        file('package.json', makePackageJson({ react: '^18.0.0', 'react-dom': '^18.0.0' }))
        file('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022' } }))

        const result = await detectStack(ROOT)

        expect(result.uiFramework).toBe('react')
        expect(result.typescript).toBe(true)
    })

    // ── Test 7: TypeScript detection alone ─────────────────────────────────
    it('detects typescript when tsconfig.json exists', async () => {
        file('package.json', makePackageJson({}))
        file('tsconfig.json', '{}')

        const result = await detectStack(ROOT)

        expect(result.typescript).toBe(true)
    })

    it('typescript is false when no tsconfig.json', async () => {
        file('package.json', makePackageJson({}))

        const result = await detectStack(ROOT)

        expect(result.typescript).toBe(false)
    })

    // ── Test 8: Empty project ───────────────────────────────────────────────
    it('returns none for an empty project', async () => {
        // No files registered in mockFiles

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('none')
        expect(result.configPath).toBeNull()
        expect(result.tokenFiles).toHaveLength(0)
        expect(result.cssFiles).toHaveLength(0)
        expect(result.packageDeps).toHaveLength(0)
    })

    // ── Test 9: DTCG prioritized over Tailwind ──────────────────────────────
    it('prioritizes .flint/design-tokens.json (dtcg) over tailwind config when both exist', async () => {
        file('package.json', makePackageJson({ tailwindcss: '^3.0.0' }))
        file('tailwind.config.js', `module.exports = { theme: {} }`)
        file('.flint/design-tokens.json', JSON.stringify([
            { id: 1, token_path: 'color.primary', token_type: 'color', token_value: '#0066FF' }
        ]))

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('dtcg')
        expect(result.configPath).toBe(path.join(ROOT, '.flint/design-tokens.json'))
    })

    // ── Test 10: MUI detection ──────────────────────────────────────────────
    it('detects mui from @mui/material in package.json', async () => {
        file('package.json', makePackageJson({ '@mui/material': '^5.0.0', react: '^18.0.0' }))

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('mui')
        expect(result.packageDeps).toContain('@mui/material')
    })

    // ── Test 11: Radix detection ────────────────────────────────────────────
    it('detects radix from @radix-ui/themes in package.json', async () => {
        file('package.json', makePackageJson({ '@radix-ui/themes': '^3.0.0', react: '^18.0.0' }))

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('radix')
        expect(result.packageDeps).toContain('@radix-ui/themes')
    })

    // ── Test 12: Tailwind v4 with alternate CSS path ─────────────────────────
    it('detects tailwind-v4 from styles/globals.css with @theme block', async () => {
        file('package.json', makePackageJson({}))
        file('styles/globals.css', `@theme { --color-brand: oklch(55% 0.2 250); }`)

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('tailwind-v4')
        expect(result.configPath).toBe(path.join(ROOT, 'styles/globals.css'))
    })

    // ── Additional: Vue + Svelte detection ──────────────────────────────────
    it('detects vue UI framework', async () => {
        file('package.json', makePackageJson({ vue: '^3.0.0' }))

        const result = await detectStack(ROOT)

        expect(result.uiFramework).toBe('vue')
    })

    it('detects svelte UI framework', async () => {
        file('package.json', makePackageJson({ svelte: '^4.0.0' }))

        const result = await detectStack(ROOT)

        expect(result.uiFramework).toBe('svelte')
    })

    // ── Empty .flint/design-tokens.json is not treated as dtcg ─────────────
    it('ignores empty .flint/design-tokens.json and falls through to tailwind', async () => {
        file('package.json', makePackageJson({ tailwindcss: '^3.0.0' }))
        file('tailwind.config.js', `module.exports = { theme: {} }`)
        file('.flint/design-tokens.json', '[]')

        const result = await detectStack(ROOT)

        expect(result.framework).toBe('tailwind-v3')
    })
})
