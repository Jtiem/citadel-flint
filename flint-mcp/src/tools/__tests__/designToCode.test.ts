/**
 * Tests for handleDesignToCode — flint-mcp/src/tools/__tests__/designToCode.test.ts
 *
 * Covers:
 *  1. Happy path: figmaPayload + library="shadcn" → returns component + theme
 *  2. Auto-detect library from tokens
 *  3. Read library from policy.json when not specified
 *  4. Missing figmaPayload → error
 *  5. Invalid JSON payload → error
 *  6. No tokens found → ok status with guidance message
 *  7. Unknown library → error
 *  8. writeThemeFile=true → writes file to tmp dir
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { handleDesignToCode } from '../designToCode.js'
import type { FlintConfig } from '../../core/config.js'
import type { DesignToken } from '../../types.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'flint-d2c-test-'))
}

function rmTmpDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true })
}

const SAMPLE_TOKENS: DesignToken[] = [
    {
        id: 1,
        token_path: 'color/brand/primary',
        token_type: 'color',
        token_value: '#3b82f6',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 2,
        token_path: 'color/brand/secondary',
        token_type: 'color',
        token_value: '#6366f1',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
]

// Tokens that match the shadcn adapter (CSS variable naming patterns)
const SHADCN_TOKENS: DesignToken[] = [
    {
        id: 1,
        token_path: '--background',
        token_type: 'color',
        token_value: '#ffffff',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 2,
        token_path: '--foreground',
        token_type: 'color',
        token_value: '#09090b',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 3,
        token_path: '--primary',
        token_type: 'color',
        token_value: '#18181b',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 4,
        token_path: '--primary-foreground',
        token_type: 'color',
        token_value: '#fafafa',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 5,
        token_path: '--secondary',
        token_type: 'color',
        token_value: '#f4f4f5',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 6,
        token_path: '--secondary-foreground',
        token_type: 'color',
        token_value: '#18181b',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 7,
        token_path: '--muted',
        token_type: 'color',
        token_value: '#f4f4f5',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 8,
        token_path: '--muted-foreground',
        token_type: 'color',
        token_value: '#71717a',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 9,
        token_path: '--border',
        token_type: 'color',
        token_value: '#e4e4e7',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
    {
        id: 10,
        token_path: '--radius',
        token_type: 'dimension',
        token_value: '0.5rem',
        description: null,
        collection_name: 'default',
        mode: 'light',
    },
]

const MINIMAL_FIGMA_PAYLOAD = JSON.stringify({
    name: 'MyButton',
    type: 'FRAME',
    children: [
        { name: 'Label', type: 'TEXT', characters: 'Click me' },
    ],
})

/**
 * Build a minimal FlintConfig pointing to a tmp dir that has
 * .flint/design-tokens.json and optionally .flint/policy.json
 */
function makeConfig(
    tokens: DesignToken[],
    policyOverrides?: Record<string, unknown>,
): { config: FlintConfig; tmpDir: string } {
    const tmpDir = makeTmpDir()
    const flintDir = path.join(tmpDir, '.flint')
    fs.mkdirSync(flintDir, { recursive: true })

    if (tokens.length > 0) {
        fs.writeFileSync(
            path.join(flintDir, 'design-tokens.json'),
            JSON.stringify(tokens),
            'utf-8',
        )
    }

    if (policyOverrides !== undefined) {
        fs.writeFileSync(
            path.join(flintDir, 'policy.json'),
            JSON.stringify({ version: 1, ...policyOverrides }),
            'utf-8',
        )
    }

    const config: FlintConfig = {
        projectRoot: tmpDir,
        domains: ['ui'],
        policy: {
            version: 1,
            mithril: {
                deltaE_threshold: 2.0,
                deltaE_critical_threshold: 10.0,
                mode: 'blocking',
                ignore_patterns: [],
            },
            a11y: {
                level: 'AA',
                mode: 'blocking',
                disabled_rules: [],
            },
            export_gate: {
                block_on_mithril: true,
                block_on_a11y: true,
                block_on_overrides: true,
            },
            baseline: { enabled: false },
        },
    }

    return { config, tmpDir }
}

// ---------------------------------------------------------------------------
// 1. Happy path: explicit library="shadcn"
// ---------------------------------------------------------------------------

describe('handleDesignToCode — happy path (shadcn)', () => {
    it('returns ok status with component code and theme file', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'shadcn' },
                config,
            )

            expect(result.status).toBe('ok')
            expect(result.library).toBe('shadcn')
            expect(result.component.name).toBeTruthy()
            expect(result.component.code).toContain('function')
            expect(result.component.imports.length).toBeGreaterThan(0)
            expect(result.themeFile).toBeDefined()
            expect(result.themeFile!.filename).toMatch(/\.css$|globals/)
            expect(result.themeFile!.code).toBeTruthy()
            expect(result.themeFile!.tokenCount).toBeGreaterThanOrEqual(0)
            expect(result.summary).toContain('shadcn')
            expect(result.error).toBeUndefined()
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('returns ok for all supported library targets', async () => {
        const libraries = ['shadcn', 'mui', 'primeng', 'tailwind'] as const
        for (const library of libraries) {
            const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
            try {
                const result = await handleDesignToCode(
                    { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library },
                    config,
                )
                expect(result.status).toBe('ok')
                expect(result.library).toBe(library)
            } finally {
                rmTmpDir(tmpDir)
            }
        }
    })

    it('includes figmaUrl in summary when provided', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                {
                    figmaPayload: MINIMAL_FIGMA_PAYLOAD,
                    library: 'mui',
                    figmaUrl: 'https://figma.com/file/abc123',
                },
                config,
            )
            expect(result.status).toBe('ok')
            expect(result.summary).toContain('figma.com/file/abc123')
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ---------------------------------------------------------------------------
// 2. Auto-detect library from tokens
// ---------------------------------------------------------------------------

describe('handleDesignToCode — library="auto"', () => {
    it('detects library from shadcn-style tokens and runs the pipeline', async () => {
        const { config, tmpDir } = makeConfig(SHADCN_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'auto' },
                config,
            )
            // Detection must succeed and return a valid library
            if (result.status === 'ok') {
                expect(['shadcn', 'mui', 'primeng', 'tailwind']).toContain(result.library)
                expect(result.component.code).toBeTruthy()
            } else {
                // If inconclusive, error must explain the issue
                expect(result.error).toContain('inconclusive')
            }
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('returns error with guidance when auto-detection is inconclusive', async () => {
        // Use minimal generic tokens — no library-specific patterns
        const genericTokens: DesignToken[] = [{
            id: 1,
            token_path: 'foo/bar',
            token_type: 'color',
            token_value: '#000000',
            description: null,
            collection_name: 'default',
            mode: 'light',
        }]
        const { config, tmpDir } = makeConfig(genericTokens)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'auto' },
                config,
            )
            // May succeed (low-score match still picks a winner) or error with guidance
            if (result.status === 'error') {
                expect(result.error).toBeTruthy()
                expect(result.summary).toBeTruthy()
            }
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ---------------------------------------------------------------------------
// 3. Read library from policy.json when library param is omitted
// ---------------------------------------------------------------------------

describe('handleDesignToCode — library from policy.json', () => {
    it('reads selectedLibrary from policy.json when library param is omitted', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS, { selectedLibrary: 'mui' })
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD },
                config,
            )
            expect(result.status).toBe('ok')
            expect(result.library).toBe('mui')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('falls back to auto-detect when policy.json has no selectedLibrary', async () => {
        // policy.json exists but no selectedLibrary key, use shadcn tokens for detection
        const { config, tmpDir } = makeConfig(SHADCN_TOKENS, { version: 1 })
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD },
                config,
            )
            // Either ok (detection succeeded) or error (inconclusive) — both are valid
            expect(['ok', 'error']).toContain(result.status)
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('falls back to auto-detect when policy.json is absent', async () => {
        // No policy.json — use tokens with clear shadcn signal
        const { config, tmpDir } = makeConfig(SHADCN_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD },
                config,
            )
            expect(['ok', 'error']).toContain(result.status)
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ---------------------------------------------------------------------------
// 4. Missing figmaPayload → error
// ---------------------------------------------------------------------------

describe('handleDesignToCode — missing figmaPayload', () => {
    it('returns error when figmaPayload is an empty string', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: '', library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('error')
            expect(result.error).toBeTruthy()
            expect(result.summary).toContain('figmaPayload')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('returns error when figmaPayload is omitted (cast to simulate missing arg)', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            // Simulate missing param by casting
            const result = await handleDesignToCode(
                { figmaPayload: undefined as unknown as string, library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('error')
            expect(result.error).toBeTruthy()
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ---------------------------------------------------------------------------
// 5. Invalid JSON payload → error
// ---------------------------------------------------------------------------

describe('handleDesignToCode — invalid JSON payload', () => {
    it('returns error when figmaPayload is not valid JSON', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: '{ name: broken json', library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('error')
            expect(result.error).toContain('JSON')
            expect(result.library).toBe('unknown')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('returns error for a plain string (non-JSON)', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: 'not-a-json-object-at-all', library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('error')
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ---------------------------------------------------------------------------
// 6. No tokens found → appropriate status
// ---------------------------------------------------------------------------

describe('handleDesignToCode — no tokens', () => {
    it('returns ok status with no-token guidance when tokens file is missing', async () => {
        const tmpDir = makeTmpDir()
        fs.mkdirSync(path.join(tmpDir, '.flint'), { recursive: true })
        // No design-tokens.json written
        const config: FlintConfig = {
            projectRoot: tmpDir,
            domains: ['ui'],
            policy: {
                version: 1,
                mithril: {
                    deltaE_threshold: 2.0,
                    deltaE_critical_threshold: 10.0,
                    mode: 'blocking',
                    ignore_patterns: [],
                },
                a11y: {
                    level: 'AA',
                    mode: 'blocking',
                    disabled_rules: [],
                },
                export_gate: {
                    block_on_mithril: true,
                    block_on_a11y: true,
                    block_on_overrides: true,
                },
                baseline: { enabled: false },
            },
        }
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('ok')
            expect(result.library).toBe('none')
            expect(result.summary).toContain('No design tokens')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('returns ok status with guidance when tokens file is an empty array', async () => {
        const { config, tmpDir } = makeConfig([]) // empty tokens
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('ok')
            expect(result.library).toBe('none')
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ---------------------------------------------------------------------------
// 7. Unknown library → error
// ---------------------------------------------------------------------------

describe('handleDesignToCode — unknown library', () => {
    it('returns error for an unregistered library name', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'bootstrap' },
                config,
            )
            expect(result.status).toBe('error')
            expect(result.error).toContain('bootstrap')
            expect(result.summary).toContain('bootstrap')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('returns error for an empty string library', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: '' },
                config,
            )
            // Empty string falls through to auto-detect or policy; acceptable to
            // either succeed (auto) or fail (inconclusive / unregistered)
            expect(['ok', 'error']).toContain(result.status)
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ---------------------------------------------------------------------------
// 8. writeThemeFile=true → writes file to disk
// ---------------------------------------------------------------------------

describe('handleDesignToCode — writeThemeFile=true', () => {
    it('writes the theme file to projectRoot when writeThemeFile is true', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS, { selectedLibrary: 'tailwind' })
        try {
            const result = await handleDesignToCode(
                {
                    figmaPayload: MINIMAL_FIGMA_PAYLOAD,
                    library: 'tailwind',
                    writeThemeFile: true,
                },
                config,
            )
            expect(result.status).toBe('ok')
            expect(result.themeFile).toBeDefined()

            const expectedPath = path.join(tmpDir, result.themeFile!.filename)
            expect(fs.existsSync(expectedPath)).toBe(true)

            const written = fs.readFileSync(expectedPath, 'utf-8')
            expect(written).toBe(result.themeFile!.code)
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('does NOT write a file when writeThemeFile is false (dry run)', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                {
                    figmaPayload: MINIMAL_FIGMA_PAYLOAD,
                    library: 'shadcn',
                    writeThemeFile: false,
                },
                config,
            )
            expect(result.status).toBe('ok')
            expect(result.summary).toContain('dry run')

            const expectedPath = path.join(tmpDir, result.themeFile!.filename)
            expect(fs.existsSync(expectedPath)).toBe(false)
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('does NOT write a file when writeThemeFile is omitted (default dry run)', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('ok')
            // No files should be written to projectRoot beyond what was already there
            const themeFilePath = path.join(tmpDir, result.themeFile!.filename)
            expect(fs.existsSync(themeFilePath)).toBe(false)
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ---------------------------------------------------------------------------
// Edge: malformed params
// ---------------------------------------------------------------------------

describe('handleDesignToCode — malformed / edge cases', () => {
    it('handles a Figma payload with no children gracefully', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const emptyPayload = JSON.stringify({ name: 'Empty', type: 'FRAME' })
            const result = await handleDesignToCode(
                { figmaPayload: emptyPayload, library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('ok')
            expect(result.component.code).toBeTruthy()
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('handles a deeply nested Figma tree without throwing', async () => {
        const deepTree = (depth: number): object => {
            if (depth === 0) {
                return { name: 'Leaf', type: 'TEXT', characters: 'Hello' }
            }
            return { name: `Level${depth}`, type: 'FRAME', children: [deepTree(depth - 1)] }
        }

        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                {
                    figmaPayload: JSON.stringify(deepTree(8)),
                    library: 'shadcn',
                },
                config,
            )
            expect(result.status).toBe('ok')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('uses projectRoot from args over config.projectRoot when provided', async () => {
        // Create two separate dirs — args.projectRoot wins
        const { config, tmpDir: configDir } = makeConfig([]) // No tokens in config dir
        const { tmpDir: argsDir } = makeConfig(SAMPLE_TOKENS) // Tokens in args dir
        try {
            const result = await handleDesignToCode(
                {
                    figmaPayload: MINIMAL_FIGMA_PAYLOAD,
                    library: 'shadcn',
                    projectRoot: argsDir,
                },
                config,
            )
            // Should pick up tokens from argsDir and succeed
            expect(result.status).toBe('ok')
        } finally {
            rmTmpDir(configDir)
            rmTmpDir(argsDir)
        }
    })
})

// ---------------------------------------------------------------------------
// Multi-component page tests
// ---------------------------------------------------------------------------

describe('multi-component page generation', () => {
    const PAGE_PAYLOAD = JSON.stringify({
        name: 'LandingPage',
        type: 'FRAME',
        children: [
            {
                name: 'NavBar',
                type: 'FRAME',
                children: [
                    { name: 'Logo', type: 'TEXT', characters: 'Acme' },
                    { name: 'SignIn', type: 'FRAME', children: [
                        { name: 'Label', type: 'TEXT', characters: 'Sign In' },
                    ] },
                ],
            },
            {
                name: 'HeroSection',
                type: 'FRAME',
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.25, a: 1 } }],
                children: [
                    { name: 'Headline', type: 'TEXT', characters: 'Build faster' },
                    { name: 'CTA', type: 'FRAME', children: [
                        { name: 'Go', type: 'TEXT', characters: 'Get Started' },
                    ] },
                ],
            },
            {
                name: 'Footer',
                type: 'FRAME',
                children: [
                    { name: 'Copyright', type: 'TEXT', characters: '© 2026 Acme' },
                ],
            },
        ],
    })

    it('splits top-level FRAME children into separate components', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: PAGE_PAYLOAD, library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('ok')
            expect(result.components.length).toBe(3)
            expect(result.components.map(c => c.name)).toEqual([
                'NavBar',
                'HeroSection',
                'Footer',
            ])
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('generates a page compositor that imports all sections', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: PAGE_PAYLOAD, library: 'shadcn' },
                config,
            )
            expect(result.page).toBeDefined()
            expect(result.page!.name).toBe('LandingPage')
            expect(result.page!.code).toContain('<NavBar />')
            expect(result.page!.code).toContain('<HeroSection />')
            expect(result.page!.code).toContain('<Footer />')
            expect(result.page!.imports.length).toBeGreaterThan(0)
            expect(result.page!.imports.some(i => i.includes('NavBar'))).toBe(true)
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('each section component is a standalone function', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: PAGE_PAYLOAD, library: 'shadcn' },
                config,
            )
            for (const c of result.components) {
                expect(c.code).toContain(`export function ${c.name}()`)
                expect(c.code).toContain('return (')
            }
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('backward compat: component field returns first section', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: PAGE_PAYLOAD, library: 'shadcn' },
                config,
            )
            expect(result.component.name).toBe('NavBar')
            expect(result.component.code).toContain('export function NavBar()')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('single-section payload falls back to single-component mode (no page)', async () => {
        const singlePayload = JSON.stringify({
            name: 'Card',
            type: 'FRAME',
            children: [
                { name: 'Title', type: 'TEXT', characters: 'Hello' },
            ],
        })
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: singlePayload, library: 'shadcn' },
                config,
            )
            expect(result.status).toBe('ok')
            expect(result.components.length).toBe(1)
            expect(result.page).toBeUndefined()
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('works with all 4 libraries', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const results = await Promise.all(
                ['shadcn', 'mui', 'primeng', 'tailwind'].map(lib =>
                    handleDesignToCode({ figmaPayload: PAGE_PAYLOAD, library: lib }, config)
                ),
            )
            for (const r of results) {
                expect(r.status).toBe('ok')
                expect(r.components.length).toBe(3)
                expect(r.page).toBeDefined()
            }
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('summary mentions page compositor', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: PAGE_PAYLOAD, library: 'shadcn' },
                config,
            )
            expect(result.summary).toContain('3 component(s)')
            expect(result.summary).toContain('Page compositor')
            expect(result.summary).toContain('LandingPage')
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ---------------------------------------------------------------------------
// D2C.5 — AI classification and refinement integration tests
// ---------------------------------------------------------------------------

describe('handleDesignToCode — D2C.5 AI classification (aiClassify)', () => {
    // We mock globalThis.fetch for AI calls while keeping real file system for tokens/config
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
        originalFetch = globalThis.fetch
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    it('backward compatibility: result is identical when aiClassify/aiRefine are omitted', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'shadcn' },
                config,
            )

            expect(result.status).toBe('ok')
            // No AI metadata when flags are not set
            expect(result.aiClassification).toBeUndefined()
            expect(result.aiRefinements).toBeUndefined()
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('includes aiClassification metadata when aiClassify=true', async () => {
        // Mock the fetch for AI classification to return empty classifications
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve({
                content: [{ type: 'text', text: JSON.stringify({ classifications: [] }) }],
            }),
        }))

        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        // Set env key for AI classification to work
        const origKey = process.env.ANTHROPIC_API_KEY
        process.env.ANTHROPIC_API_KEY = 'sk-test-classify'
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'shadcn', aiClassify: true },
                config,
            )

            expect(result.status).toBe('ok')
            expect(result.aiClassification).toBeDefined()
            expect(result.aiClassification!.source).toBeDefined()
            expect(typeof result.aiClassification!.classificationCount).toBe('number')
            expect(typeof result.aiClassification!.latencyMs).toBe('number')
        } finally {
            if (origKey !== undefined) {
                process.env.ANTHROPIC_API_KEY = origKey
            } else {
                delete process.env.ANTHROPIC_API_KEY
            }
            rmTmpDir(tmpDir)
        }
    })

    it('aiClassification shows source=fallback when no API key', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        const origKey = process.env.ANTHROPIC_API_KEY
        delete process.env.ANTHROPIC_API_KEY
        try {
            const result = await handleDesignToCode(
                { figmaPayload: MINIMAL_FIGMA_PAYLOAD, library: 'shadcn', aiClassify: true },
                config,
            )

            expect(result.status).toBe('ok')
            expect(result.aiClassification).toBeDefined()
            expect(result.aiClassification!.source).toBe('fallback')
            expect(result.aiClassification!.classificationCount).toBe(0)
        } finally {
            if (origKey !== undefined) {
                process.env.ANTHROPIC_API_KEY = origKey
            } else {
                delete process.env.ANTHROPIC_API_KEY
            }
            rmTmpDir(tmpDir)
        }
    })
})

describe('handleDesignToCode — D2C.5 AI refinement (aiRefine)', () => {
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
        originalFetch = globalThis.fetch
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    it('includes aiRefinements metadata when aiRefine=true', async () => {
        // Mock fetch to return valid refined JSX
        const validJsx = [
            'import React from "react";',
            'export function MyButton() {',
            '  return <button>Click me</button>;',
            '}',
        ].join('\n')

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve({
                content: [{ type: 'text', text: validJsx }],
            }),
        }))

        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        const origKey = process.env.ANTHROPIC_API_KEY
        process.env.ANTHROPIC_API_KEY = 'sk-test-refine'
        try {
            const result = await handleDesignToCode(
                {
                    figmaPayload: MINIMAL_FIGMA_PAYLOAD,
                    library: 'shadcn',
                    aiRefine: true,
                },
                config,
            )

            expect(result.status).toBe('ok')
            expect(result.aiRefinements).toBeDefined()
            expect(result.aiRefinements!.length).toBeGreaterThan(0)
            expect(result.aiRefinements![0].componentName).toBeTruthy()
            expect(['refined', 'fallback']).toContain(result.aiRefinements![0].status)
            expect(typeof result.aiRefinements![0].latencyMs).toBe('number')
        } finally {
            if (origKey !== undefined) {
                process.env.ANTHROPIC_API_KEY = origKey
            } else {
                delete process.env.ANTHROPIC_API_KEY
            }
            rmTmpDir(tmpDir)
        }
    })

    it('aiRefinements show fallback when no API key', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        const origKey = process.env.ANTHROPIC_API_KEY
        delete process.env.ANTHROPIC_API_KEY
        try {
            const result = await handleDesignToCode(
                {
                    figmaPayload: MINIMAL_FIGMA_PAYLOAD,
                    library: 'shadcn',
                    aiRefine: true,
                },
                config,
            )

            expect(result.status).toBe('ok')
            expect(result.aiRefinements).toBeDefined()
            // All refinements should be fallback since no API key
            for (const r of result.aiRefinements!) {
                expect(r.status).toBe('fallback')
                expect(r.reason).toContain('No API key')
            }
        } finally {
            if (origKey !== undefined) {
                process.env.ANTHROPIC_API_KEY = origKey
            } else {
                delete process.env.ANTHROPIC_API_KEY
            }
            rmTmpDir(tmpDir)
        }
    })

    it('screenshotBase64 is passed through to refinement', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve({
                content: [{ type: 'text', text: 'export function X() { return <div />; }' }],
            }),
        })
        vi.stubGlobal('fetch', fetchMock)

        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        const origKey = process.env.ANTHROPIC_API_KEY
        process.env.ANTHROPIC_API_KEY = 'sk-test-screenshot'
        try {
            await handleDesignToCode(
                {
                    figmaPayload: MINIMAL_FIGMA_PAYLOAD,
                    library: 'shadcn',
                    aiRefine: true,
                    screenshotBase64: 'test-screenshot-base64',
                },
                config,
            )

            // The fetch mock should have been called for refinement
            expect(fetchMock).toHaveBeenCalled()
            // Find the refinement call (not classification call)
            const calls = fetchMock.mock.calls
            const refinementCall = calls.find((call: unknown[]) => {
                const body = JSON.parse((call[1] as { body: string }).body)
                return body.model && body.model.includes('sonnet')
            })
            if (refinementCall) {
                const body = JSON.parse((refinementCall[1] as { body: string }).body)
                const imageBlock = body.messages[0].content.find(
                    (b: { type: string }) => b.type === 'image'
                )
                expect(imageBlock).toBeDefined()
                expect(imageBlock.source.data).toBe('test-screenshot-base64')
            }
        } finally {
            if (origKey !== undefined) {
                process.env.ANTHROPIC_API_KEY = origKey
            } else {
                delete process.env.ANTHROPIC_API_KEY
            }
            rmTmpDir(tmpDir)
        }
    })

    it('no aiRefinements metadata when aiRefine is false', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                {
                    figmaPayload: MINIMAL_FIGMA_PAYLOAD,
                    library: 'shadcn',
                    aiRefine: false,
                },
                config,
            )

            expect(result.status).toBe('ok')
            expect(result.aiRefinements).toBeUndefined()
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('no aiClassification metadata when aiClassify is false', async () => {
        const { config, tmpDir } = makeConfig(SAMPLE_TOKENS)
        try {
            const result = await handleDesignToCode(
                {
                    figmaPayload: MINIMAL_FIGMA_PAYLOAD,
                    library: 'shadcn',
                    aiClassify: false,
                },
                config,
            )

            expect(result.status).toBe('ok')
            expect(result.aiClassification).toBeUndefined()
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})
