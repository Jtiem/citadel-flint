/**
 * projectDetector.test.ts — FORGE.2a tests for shared/projectDetector.ts
 *
 * PD-01: Detects React + version from package.json
 * PD-02: Detects Tailwind v4 CSS framework
 * PD-03: Detects shadcn/ui component library (CVA + Radix combo)
 * PD-04: Detects Flint DTCG design tokens
 * PD-05: Returns defaults when no package.json exists
 * PD-06: Detects Vue framework
 * PD-07: Detects Next.js (meta-framework priority)
 * PD-08: Detects styled-components as CSS framework
 * PD-09: Detects Tokens Studio token format
 * PD-10: Detects MUI component library
 * PD-11: Detects TypeScript from tsconfig.json
 * PD-12: Counts component files via countFiles callback
 * PD-13: Detects Style Dictionary token config
 * PD-14: Detects Mantine component library
 * PD-15: Handles Tailwind config file without package dep
 */

import { describe, it, expect } from 'vitest'
import { detectProjectEnvironment, type DetectorFS } from '../projectDetector'

// ── Test helpers ──────────────────────────────────────────────────────────────

function createMockFS(files: Record<string, string>): DetectorFS {
    // Build a set of "absolute" paths for precise matching
    const resolvedPaths = new Map<string, string>()
    for (const [key, content] of Object.entries(files)) {
        // Support both '/test/package.json' and 'package.json' style keys
        const fullPath = key.startsWith('/') ? key : `/test/${key}`
        resolvedPaths.set(fullPath.replace(/\\/g, '/'), content)
    }

    return {
        readFile: async (filePath: string, _enc: 'utf-8') => {
            const normalized = filePath.replace(/\\/g, '/')
            const content = resolvedPaths.get(normalized)
            if (content !== undefined) return content
            throw new Error(`ENOENT: ${filePath}`)
        },
        exists: (filePath: string) => {
            const normalized = filePath.replace(/\\/g, '/')
            return resolvedPaths.has(normalized)
        },
        countFiles: async () => 0, // Default — tests override when needed
    }
}

function pkgJson(deps: Record<string, string> = {}, devDeps: Record<string, string> = {}): string {
    return JSON.stringify({
        name: 'test-project',
        dependencies: deps,
        devDependencies: devDeps,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('detectProjectEnvironment', () => {
    // PD-01: Detects React + version
    it('PD-01: detects React framework with version', async () => {
        const fs = createMockFS({
            'package.json': pkgJson({ react: '^19.1.0', 'react-dom': '^19.1.0' }),
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.framework).toEqual({ name: 'react', version: '19.1.0' })
        expect(env.uiFramework).toBe('React 19')
    })

    // PD-02: Detects Tailwind v4
    it('PD-02: detects Tailwind v4 CSS framework', async () => {
        const fs = createMockFS({
            'package.json': pkgJson({ tailwindcss: '^4.0.0' }),
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.cssFramework).toEqual({ name: 'tailwindcss', version: '4.0.0' })
        expect(env.cssFrameworkLabel).toBe('Tailwind v4')
    })

    // PD-03: Detects shadcn/ui (CVA + Radix combo)
    it('PD-03: detects shadcn/ui from CVA + Radix combo', async () => {
        const fs = createMockFS({
            'package.json': pkgJson({
                react: '^19.0.0',
                'class-variance-authority': '^0.7.0',
                '@radix-ui/react-slot': '^1.0.0',
                '@radix-ui/react-dialog': '^1.0.0',
            }),
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.componentLibrary).toEqual({ name: 'shadcn', version: '0.7.0' })
        expect(env.componentLibraryLabel).toBe('shadcn/ui')
    })

    // PD-04: Detects Flint DTCG design tokens
    it('PD-04: detects Flint DTCG design tokens', async () => {
        const fs = createMockFS({
            'package.json': pkgJson(),
            '.flint/design-tokens.json': JSON.stringify({
                color: { primary: { '$type': 'color', '$value': '#000' } },
            }),
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.hasDesignTokens).toBe(true)
        expect(env.tokenSource).toBe('flint')
        expect(env.tokenFormat).toBe('DTCG')
    })

    // PD-05: Returns defaults when no package.json
    it('PD-05: returns safe defaults when no package.json exists', async () => {
        const fs = createMockFS({})
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.framework).toBeNull()
        expect(env.cssFramework).toBeNull()
        expect(env.componentLibrary).toBeNull()
        expect(env.hasDesignTokens).toBe(false)
        expect(env.componentCount).toBe(0)
        expect(env.uiFramework).toBe('Unknown')
        expect(env.cssFrameworkLabel).toBe('Unknown')
    })

    // PD-06: Detects Vue
    it('PD-06: detects Vue framework', async () => {
        const fs = createMockFS({
            'package.json': pkgJson({ vue: '^3.4.0' }),
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.framework).toEqual({ name: 'vue', version: '3.4.0' })
        expect(env.uiFramework).toBe('Vue 3')
    })

    // PD-07: Detects Next.js (meta-framework priority over react)
    it('PD-07: detects Next.js as meta-framework over React', async () => {
        const fs = createMockFS({
            'package.json': pkgJson({ react: '^19.0.0', next: '15.1.0' }),
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.framework?.name).toBe('next')
        expect(env.uiFramework).toContain('Next.js')
    })

    // PD-08: Detects styled-components
    it('PD-08: detects styled-components as CSS framework', async () => {
        const fs = createMockFS({
            'package.json': pkgJson({ 'styled-components': '^6.0.0' }),
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.cssFramework).toEqual({ name: 'styled-components', version: '6.0.0' })
        expect(env.cssFrameworkLabel).toBe('styled-components')
    })

    // PD-09: Detects Tokens Studio
    it('PD-09: detects Tokens Studio token format', async () => {
        const fs = createMockFS({
            'package.json': pkgJson(),
            'tokens.json': '{}',
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.hasDesignTokens).toBe(true)
        expect(env.tokenSource).toBe('tokens-studio')
        expect(env.tokenFormat).toBe('Tokens Studio')
    })

    // PD-10: Detects MUI
    it('PD-10: detects MUI component library', async () => {
        const fs = createMockFS({
            'package.json': pkgJson({ '@mui/material': '^5.15.0', react: '^18.0.0' }),
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.componentLibrary).toEqual({ name: 'mui', version: '5.15.0' })
        expect(env.componentLibraryLabel).toBe('MUI')
    })

    // PD-11: Detects TypeScript
    it('PD-11: detects TypeScript from tsconfig.json', async () => {
        const fs = createMockFS({
            'package.json': pkgJson(),
            'tsconfig.json': '{}',
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.typescript).toBe(true)
    })

    // PD-12: Uses countFiles callback for component count
    it('PD-12: counts component files via countFiles callback', async () => {
        const fs = createMockFS({
            'package.json': pkgJson({ react: '^19.0.0' }),
        })
        fs.countFiles = async (_dir: string, _exts: string[]) => 89
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.componentCount).toBe(89)
    })

    // PD-13: Detects Style Dictionary
    it('PD-13: detects Style Dictionary token config', async () => {
        const fs = createMockFS({
            'package.json': pkgJson(),
            'style-dictionary.config.json': '{}',
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.hasDesignTokens).toBe(true)
        expect(env.tokenSource).toBe('style-dictionary')
        expect(env.tokenFormat).toBe('Style Dictionary')
    })

    // PD-14: Detects Mantine
    it('PD-14: detects Mantine component library', async () => {
        const fs = createMockFS({
            'package.json': pkgJson({ '@mantine/core': '^7.5.0', react: '^18.0.0' }),
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.componentLibrary).toEqual({ name: 'mantine', version: '7.5.0' })
        expect(env.componentLibraryLabel).toBe('Mantine')
    })

    // PD-15: Tailwind config without package dep
    it('PD-15: detects Tailwind from config file even without package dep', async () => {
        const fs = createMockFS({
            'package.json': pkgJson(),
            'tailwind.config.ts': 'export default {}',
        })
        const env = await detectProjectEnvironment('/test', fs)
        expect(env.cssFramework).toEqual({ name: 'tailwindcss', version: 'unknown' })
        expect(env.cssFrameworkLabel).toBe('Tailwind')
    })
})
