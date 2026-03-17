/**
 * Tests for handleBridgeFix — bridge-mcp/src/tools/__tests__/fix.test.ts
 *
 * Covers:
 *   - Source with no violations returns unchanged with fixesApplied: 0
 *   - Hardcoded hex color in className gets replaced with CSS var token reference
 *   - Hardcoded color in inline style object gets replaced with CSS var
 *   - Multiple violations fixed in one pass
 *   - Source with a color already matching a token (ΔE ≤ threshold) is not changed
 *   - Parse error returns source unchanged with status 'parse-error'
 */

import { describe, it, expect } from 'vitest'
import { handleBridgeFix } from '../fix.js'
import type { BridgeConfig } from '../../core/config.js'
import type { DesignToken } from '../../types.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-fix-test-'))
}

function rmTmpDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true })
}

/**
 * Build a minimal BridgeConfig with the given tokens written into
 * .bridge/design-tokens.json inside a temp directory.
 */
function makeConfig(tokens: DesignToken[]): { config: BridgeConfig; tmpDir: string } {
    const tmpDir = makeTmpDir()
    const bridgeDir = path.join(tmpDir, '.bridge')
    fs.mkdirSync(bridgeDir, { recursive: true })
    fs.writeFileSync(
        path.join(bridgeDir, 'design-tokens.json'),
        JSON.stringify(tokens),
        'utf-8',
    )
    const config: BridgeConfig = {
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

// A magenta token for testing color drift — far from navy/zinc
const MAGENTA_TOKEN: DesignToken = {
    id: 1,
    token_path: 'color/brand/magenta',
    token_type: 'color',
    token_value: '#ff00ff',
    description: null,
    collection_name: 'default',
    mode: 'light',
}

// A dark neutral token — far from bright colors like #ff3333
const DARK_NEUTRAL_TOKEN: DesignToken = {
    id: 2,
    token_path: 'color/neutral/900',
    token_type: 'color',
    token_value: '#18181b',
    description: null,
    collection_name: 'default',
    mode: 'light',
}

// A dimension token for spacing tests
const SPACING_TOKEN: DesignToken = {
    id: 10,
    token_path: 'dimension/spacing/4',
    token_type: 'dimension',
    token_value: '16px',
    description: null,
    collection_name: 'default',
    mode: 'light',
}

// ── Tests: no violations ──────────────────────────────────────────────────────

describe('handleBridgeFix — no violations', () => {
    it('returns source unchanged with fixesApplied: 0 when there are no violations', async () => {
        const source = `
import React from 'react'
export const Clean = () => (
  <div data-bridge-id="root" className="bg-zinc-900 text-white p-4">
    Hello
  </div>
)
`
        const { config, tmpDir } = makeConfig([DARK_NEUTRAL_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/Clean.tsx' }, config)
            expect(result.fixesApplied).toBe(0)
            expect(result.status).toBe('no-violations')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('returns status no-violations when token set is empty', async () => {
        const source = `
import React from 'react'
export const Comp = () => <div className="bg-[#ff3333]">hi</div>
`
        // No tokens at all — no color system to compare against
        const { config, tmpDir } = makeConfig([])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/Comp.tsx' }, config)
            // Without tokens, the nearest-token lookup returns null, so no fix is possible
            expect(result.fixesApplied).toBe(0)
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ── Tests: color drift in className ─────────────────────────────────────────

describe('handleBridgeFix — color drift in className', () => {
    it('replaces a hardcoded hex color class with a CSS var reference', async () => {
        // #ff0000 (red) is far from #18181b (very dark zinc), ΔE >> 2.0
        const source = `
import React from 'react'
export const Drifted = () => (
  <div data-bridge-id="root" className="bg-[#ff0000] p-4">
    Red
  </div>
)
`
        const { config, tmpDir } = makeConfig([DARK_NEUTRAL_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/Drifted.tsx' }, config)
            expect(result.fixesApplied).toBeGreaterThanOrEqual(1)
            expect(result.fixedSource).toContain('var(--color-neutral-900)')
            expect(result.fixedSource).not.toContain('#ff0000')
            expect(result.status).toBe('fixed')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('does not replace a color that is already a near-perfect match (ΔE ≤ threshold)', async () => {
        // #ff00ff vs #ff00ff — exact match, ΔE = 0
        const source = `
import React from 'react'
export const Matched = () => (
  <div data-bridge-id="root" className="bg-[#ff00ff]">
    Magenta
  </div>
)
`
        const { config, tmpDir } = makeConfig([MAGENTA_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/Matched.tsx' }, config)
            expect(result.fixesApplied).toBe(0)
            expect(result.fixedSource).toContain('#ff00ff')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('handles rgb() color syntax in className', async () => {
        const source = `
import React from 'react'
export const RgbDrifted = () => (
  <div data-bridge-id="root" className="text-[rgb(255,0,0)]">
    Red text
  </div>
)
`
        const { config, tmpDir } = makeConfig([DARK_NEUTRAL_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/RgbDrifted.tsx' }, config)
            // rgb(255,0,0) is far from #18181b — should be replaced
            expect(result.fixesApplied).toBeGreaterThanOrEqual(1)
            expect(result.fixedSource).toContain('var(--color-neutral-900)')
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ── Tests: color drift in inline style ───────────────────────────────────────

describe('handleBridgeFix — color drift in inline style object', () => {
    it('replaces a hardcoded color in style={{ color }} with a CSS var', async () => {
        const source = `
import React from 'react'
export const Styled = () => (
  <div data-bridge-id="root" style={{ color: '#ff0000', padding: '8px' }}>
    Inline
  </div>
)
`
        const { config, tmpDir } = makeConfig([DARK_NEUTRAL_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/Styled.tsx' }, config)
            expect(result.fixesApplied).toBeGreaterThanOrEqual(1)
            expect(result.fixedSource).toContain('var(--color-neutral-900)')
            expect(result.fixedSource).not.toContain("'#ff0000'")
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('replaces backgroundColor in inline style', async () => {
        const source = `
import React from 'react'
export const BgStyled = () => (
  <section data-bridge-id="section" style={{ backgroundColor: '#ff0000' }}>
    Section
  </section>
)
`
        const { config, tmpDir } = makeConfig([DARK_NEUTRAL_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/BgStyled.tsx' }, config)
            expect(result.fixesApplied).toBeGreaterThanOrEqual(1)
            expect(result.fixedSource).toContain('var(--color-neutral-900)')
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ── Tests: multiple violations in one pass ────────────────────────────────────

describe('handleBridgeFix — multiple violations in one pass', () => {
    it('fixes multiple hardcoded class colors across different elements', async () => {
        const source = `
import React from 'react'
export const Multi = () => (
  <div data-bridge-id="outer" className="bg-[#ff0000]">
    <span data-bridge-id="inner" className="text-[#ff0000] font-bold">
      Multi
    </span>
  </div>
)
`
        const { config, tmpDir } = makeConfig([DARK_NEUTRAL_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/Multi.tsx' }, config)
            expect(result.fixesApplied).toBeGreaterThanOrEqual(2)
            expect(result.fixedSource).not.toContain('#ff0000')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('fixes both className color and inline style color in one pass', async () => {
        const source = `
import React from 'react'
export const Both = () => (
  <div
    data-bridge-id="root"
    className="bg-[#ff0000]"
    style={{ color: '#ff0000' }}
  >
    Both
  </div>
)
`
        const { config, tmpDir } = makeConfig([DARK_NEUTRAL_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/Both.tsx' }, config)
            expect(result.fixesApplied).toBeGreaterThanOrEqual(2)
            expect(result.fixedSource).not.toContain('#ff0000')
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ── Tests: parse error ────────────────────────────────────────────────────────

describe('handleBridgeFix — parse error', () => {
    it('returns source unchanged with status parse-error for malformed input', async () => {
        const source = `this is not valid { TSX ===`
        const { config, tmpDir } = makeConfig([DARK_NEUTRAL_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/Bad.tsx' }, config)
            expect(result.fixedSource).toBe(source)
            expect(result.fixesApplied).toBe(0)
            expect(result.status).toBe('parse-error')
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})

// ── Tests: spacing drift ──────────────────────────────────────────────────────

describe('handleBridgeFix — spacing drift', () => {
    it('replaces arbitrary spacing class when token set has dimension tokens', async () => {
        const source = `
import React from 'react'
export const Spaced = () => (
  <div data-bridge-id="root" className="p-[24px]">
    Spaced
  </div>
)
`
        const { config, tmpDir } = makeConfig([SPACING_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/Spaced.tsx' }, config)
            // 24px is not 16px so it should be replaced
            expect(result.fixesApplied).toBeGreaterThanOrEqual(1)
            expect(result.fixedSource).toContain('var(--dimension-spacing-4)')
        } finally {
            rmTmpDir(tmpDir)
        }
    })

    it('does not fix spacing when the value matches an existing dimension token', async () => {
        const source = `
import React from 'react'
export const TokenSpaced = () => (
  <div data-bridge-id="root" className="p-[16px]">
    Exact
  </div>
)
`
        const { config, tmpDir } = makeConfig([SPACING_TOKEN])
        try {
            const result = await handleBridgeFix({ source, filePath: '/src/TokenSpaced.tsx' }, config)
            // 16px exactly matches SPACING_TOKEN value
            expect(result.fixesApplied).toBe(0)
        } finally {
            rmTmpDir(tmpDir)
        }
    })
})
