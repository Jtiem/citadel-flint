/**
 * handleFlintIngest unit tests — HYDRO.1-A
 *
 * Mocks node:fs to avoid real filesystem reads.
 * Tests all status code paths and token/manifest resolution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FlintConfig } from '../core/config.js';

// ---------------------------------------------------------------------------
// Mock node:fs — must be before any import that uses it
// ---------------------------------------------------------------------------

vi.mock('node:fs');

// ---------------------------------------------------------------------------
// Imports after mocking
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import { handleFlintIngest } from '../tools/ingest.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFs = vi.mocked(fs);

function makeConfig(projectRoot = '/tmp/test-project'): FlintConfig {
    return {
        projectRoot,
        policy: {
            mithril: { mode: 'warn', deltaE_threshold: 2.0, deltaE_critical_threshold: 5.0 },
            a11y: { mode: 'warn', disabled_rules: [] },
        },
    } as unknown as FlintConfig;
}

const TOKENS = JSON.stringify([
    { name: 'color.brand.primary', value: '#FF0000' },
    { name: 'color.surface', value: '#FFFFFF' },
]);

const MANIFEST = JSON.stringify({
    components: {
        PrimaryButton: {
            name: 'PrimaryButton',
            importPath: '@/components/ui/PrimaryButton',
            figmaComponentId: 'figma:abc123',
            props: { variant: { type: 'string', required: false } },
        },
    },
    resolvers: [],
});

const VALID_PAYLOAD = JSON.stringify({
    name: 'ButtonNode',
    type: 'FRAME',
    figmaComponentId: 'figma:abc123',
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
});

beforeEach(() => {
    vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Happy path: valid payload with tokens → status 'ok', components.length >= 1
// ---------------------------------------------------------------------------

describe('handleFlintIngest — happy path', () => {
    it('returns status ok and at least one component for a valid payload', async () => {
        mockFs.existsSync = vi.fn().mockReturnValue(true);
        mockFs.readFileSync = vi.fn().mockImplementation((filePath: unknown) => {
            const fp = String(filePath);
            if (fp.includes('flint-manifest.json')) return MANIFEST;
            if (fp.includes('design-tokens.json')) return TOKENS;
            throw new Error(`Unexpected readFileSync: ${fp}`);
        });

        const result = await handleFlintIngest(
            { figmaPayload: VALID_PAYLOAD },
            makeConfig(),
        );

        expect(result.status).toBe('ok');
        expect(result.components.length).toBeGreaterThanOrEqual(1);
        expect(result.imports.length).toBeGreaterThan(0);
        expect(result.summary).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// 2. No tokens file → status 'no-tokens', empty components
// ---------------------------------------------------------------------------

describe('handleFlintIngest — no tokens', () => {
    it('returns no-tokens when token file is missing', async () => {
        mockFs.existsSync = vi.fn().mockReturnValue(false);

        const result = await handleFlintIngest(
            { figmaPayload: VALID_PAYLOAD },
            makeConfig(),
        );

        expect(result.status).toBe('no-tokens');
        expect(result.components).toHaveLength(0);
        expect(result.summary).toContain('No design tokens found');
    });
});

// ---------------------------------------------------------------------------
// 3. Malformed JSON payload → status 'invalid-payload'
// ---------------------------------------------------------------------------

describe('handleFlintIngest — malformed JSON payload', () => {
    it('returns invalid-payload for malformed JSON', async () => {
        mockFs.existsSync = vi.fn().mockReturnValue(true);
        mockFs.readFileSync = vi.fn().mockImplementation((filePath: unknown) => {
            const fp = String(filePath);
            if (fp.includes('flint-manifest.json')) return MANIFEST;
            if (fp.includes('design-tokens.json')) return TOKENS;
            throw new Error(`Unexpected readFileSync: ${fp}`);
        });

        const result = await handleFlintIngest(
            { figmaPayload: '{this is not valid json' },
            makeConfig(),
        );

        expect(result.status).toBe('invalid-payload');
        expect(result.components).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 4. Empty figmaPayload string → status 'invalid-payload'
// ---------------------------------------------------------------------------

describe('handleFlintIngest — empty payload string', () => {
    it('returns invalid-payload for empty string', async () => {
        mockFs.existsSync = vi.fn().mockReturnValue(true);
        mockFs.readFileSync = vi.fn().mockImplementation((filePath: unknown) => {
            const fp = String(filePath);
            if (fp.includes('flint-manifest.json')) return MANIFEST;
            if (fp.includes('design-tokens.json')) return TOKENS;
            throw new Error(`Unexpected readFileSync: ${fp}`);
        });

        const result = await handleFlintIngest(
            { figmaPayload: '' },
            makeConfig(),
        );

        expect(result.status).toBe('invalid-payload');
        expect(result.components).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// 5. Token mappings resolve correctly
//    SOLID fill {r:1,g:0,b:0} + token #FF0000 → tokenMappings maps hex to class
// ---------------------------------------------------------------------------

describe('handleFlintIngest — token mapping resolution', () => {
    it('maps #FF0000 fill to bg-color-brand-primary token class', async () => {
        mockFs.existsSync = vi.fn().mockReturnValue(true);
        mockFs.readFileSync = vi.fn().mockImplementation((filePath: unknown) => {
            const fp = String(filePath);
            if (fp.includes('flint-manifest.json')) return MANIFEST;
            if (fp.includes('design-tokens.json')) return TOKENS;
            throw new Error(`Unexpected readFileSync: ${fp}`);
        });

        const payload = JSON.stringify({
            name: 'RedBox',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
        });

        const result = await handleFlintIngest(
            { figmaPayload: payload },
            makeConfig(),
        );

        expect(result.status).toBe('ok');
        expect(result.tokenMappings['#FF0000']).toBe('bg-color-brand-primary');
    });
});

// ---------------------------------------------------------------------------
// 6. Manifest with matching Figma component ID → component name matches
// ---------------------------------------------------------------------------

describe('handleFlintIngest — manifest deterministic match', () => {
    it('uses manifest component name when figmaComponentId matches', async () => {
        mockFs.existsSync = vi.fn().mockReturnValue(true);
        mockFs.readFileSync = vi.fn().mockImplementation((filePath: unknown) => {
            const fp = String(filePath);
            if (fp.includes('flint-manifest.json')) return MANIFEST;
            if (fp.includes('design-tokens.json')) return TOKENS;
            throw new Error(`Unexpected readFileSync: ${fp}`);
        });

        const payload = JSON.stringify({
            name: 'SomeNodeName',
            type: 'FRAME',
            figmaComponentId: 'figma:abc123',
        });

        const result = await handleFlintIngest(
            { figmaPayload: payload },
            makeConfig(),
        );

        expect(result.status).toBe('ok');
        // The component name should come from the manifest entry, not the raw node name
        expect(result.components[0].name).toBe('PrimaryButton');
    });
});

// ---------------------------------------------------------------------------
// 7. componentName override in args — behavior documented
// ---------------------------------------------------------------------------

describe('handleFlintIngest — componentName arg', () => {
    it('accepts componentName arg without throwing (documented behavior)', async () => {
        // The componentName override is accepted in args but HydroPasteEngine
        // currently ignores it — the manifest/figmaComponentId drives naming.
        // This test documents the current behavior: the tool does not crash,
        // and the override is passed through without throwing.
        mockFs.existsSync = vi.fn().mockReturnValue(true);
        mockFs.readFileSync = vi.fn().mockImplementation((filePath: unknown) => {
            const fp = String(filePath);
            if (fp.includes('flint-manifest.json')) return MANIFEST;
            if (fp.includes('design-tokens.json')) return TOKENS;
            throw new Error(`Unexpected readFileSync: ${fp}`);
        });

        const result = await handleFlintIngest(
            { figmaPayload: VALID_PAYLOAD, componentName: 'OverrideButton' },
            makeConfig(),
        );

        // Should not throw — returns a valid result regardless of componentName arg
        expect(result).toBeDefined();
        expect(['ok', 'invalid-payload', 'no-tokens', 'error']).toContain(result.status);
    });
});
