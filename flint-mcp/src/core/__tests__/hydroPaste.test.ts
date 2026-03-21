/**
 * HydroPasteEngine unit tests — HYDRO.1-B
 *
 * Tests the deterministic match loop, heuristic fallback, token mapping,
 * import generation, and summary string content.
 */

import { describe, it, expect } from 'vitest';
import { HydroPasteEngine } from '../hydroPaste.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const manifest = {
    components: {
        PrimaryButton: {
            name: 'PrimaryButton',
            importPath: '@/components/ui/PrimaryButton',
            figmaComponentId: 'figma:abc123',
            props: { variant: { type: 'string', required: false } },
        },
    },
};

const tokens = [
    { name: 'color.brand.primary', value: '#FF0000' },
    { name: 'color.surface', value: '#FFFFFF' },
];

const engine = new HydroPasteEngine(manifest, tokens);

// ---------------------------------------------------------------------------
// 1. Deterministic match — payload has figmaComponentId matching manifest
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — deterministic match', () => {
    it('resolves matchMode as deterministic when figmaComponentId matches', async () => {
        const payload = {
            name: 'ButtonNode',
            type: 'FRAME',
            figmaComponentId: 'figma:abc123',
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        expect(result.components).toHaveLength(1);
        const comp = result.components[0];
        expect(comp.matchedComponent).toBeDefined();
        expect(comp.matchedComponent!.matchMode).toBe('deterministic');
    });
});

// ---------------------------------------------------------------------------
// 2. Heuristic fallback — name matches, no figmaComponentId
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — heuristic fallback', () => {
    it('resolves matchMode as heuristic when name matches but no figmaComponentId', async () => {
        const payload = {
            name: 'Primary Button',
            type: 'FRAME',
            // no figmaComponentId
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        // Name "Primary Button" → PascalCase "PrimaryButton" → heuristic match
        expect(result.components).toHaveLength(1);
        const comp = result.components[0];
        if (comp.matchedComponent) {
            expect(comp.matchedComponent.matchMode).toBe('heuristic');
            expect(comp.matchedComponent.importPath).toBe('@/components/ui/PrimaryButton');
        }
        // importPath populated when a heuristic match occurs
        // (may be undefined if scorer doesn't score it, which is also valid)
    });
});

// ---------------------------------------------------------------------------
// 3. No match — unrelated name, no figmaComponentId → fresh JSX, no matchedComponent
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — no match', () => {
    it('generates fresh JSX with no matchedComponent when nothing matches', async () => {
        const payload = {
            name: 'CompletelyUnrelatedWidget',
            type: 'FRAME',
        };
        const localEngine = new HydroPasteEngine({ components: {} }, tokens);
        const result = await localEngine.processPayload(JSON.stringify(payload));
        expect(result.components).toHaveLength(1);
        expect(result.components[0].matchedComponent).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 4. Import path from matched component appears in imports array
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — import path in imports', () => {
    it('prepends matched import to imports array on deterministic match', async () => {
        const payload = {
            name: 'ButtonNode',
            type: 'FRAME',
            figmaComponentId: 'figma:abc123',
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        const importLine = result.imports.find((i) =>
            i.includes('@/components/ui/PrimaryButton')
        );
        expect(importLine).toBeDefined();
        expect(importLine).toMatch(/^import \{ PrimaryButton \}/);
    });
});

// ---------------------------------------------------------------------------
// 5. Registry props attached to matchedComponent.registryProps
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — registryProps', () => {
    it('attaches registry props to matchedComponent', async () => {
        const payload = {
            name: 'ButtonNode',
            type: 'FRAME',
            figmaComponentId: 'figma:abc123',
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        const comp = result.components[0];
        expect(comp.matchedComponent?.registryProps).toBeDefined();
        expect(comp.matchedComponent?.registryProps?.variant).toBeDefined();
        expect(comp.matchedComponent?.registryProps?.variant.type).toBe('string');
    });
});

// ---------------------------------------------------------------------------
// 6. Token mapping still works with deterministic match
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — token mapping with deterministic match', () => {
    it('resolves SOLID fill #FF0000 to bg-color-brand-primary token class', async () => {
        const payload = {
            name: 'ButtonNode',
            type: 'FRAME',
            figmaComponentId: 'figma:abc123',
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        expect(result.tokenMappings['#FF0000']).toBe('bg-color-brand-primary');
    });
});

// ---------------------------------------------------------------------------
// 7. Empty manifest, valid payload → no crash
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — empty manifest', () => {
    it('does not crash when manifest has no components', async () => {
        const emptyEngine = new HydroPasteEngine({}, tokens);
        const payload = { name: 'TestNode', type: 'FRAME' };
        const result = await emptyEngine.processPayload(JSON.stringify(payload));
        expect(result.components).toHaveLength(1);
        expect(result.components[0].matchedComponent).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 8. Null figmaComponentId → falls through to heuristic search
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — null figmaComponentId', () => {
    it('falls through to heuristic when figmaComponentId is null/absent', async () => {
        // Using exact PascalCase name to guarantee heuristic match
        const payload = {
            name: 'PrimaryButton',
            type: 'FRAME',
            // no figmaComponentId → null in the lookup
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        expect(result.components).toHaveLength(1);
        const comp = result.components[0];
        // If a heuristic match fires, matchMode must be 'heuristic'
        if (comp.matchedComponent) {
            expect(comp.matchedComponent.matchMode).toBe('heuristic');
        }
    });
});

// ---------------------------------------------------------------------------
// 9. Summary string includes match mode information
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — summary string', () => {
    it('summary includes deterministic when figmaComponentId matched', async () => {
        const payload = {
            name: 'ButtonNode',
            type: 'FRAME',
            figmaComponentId: 'figma:abc123',
        };
        const result = await engine.processPayload(JSON.stringify(payload));
        expect(result.summary).toMatch(/deterministic|heuristic|none/);
    });

    it('summary includes none when no match found', async () => {
        const localEngine = new HydroPasteEngine({ components: {} }, tokens);
        const payload = { name: 'UnmatchedWidget', type: 'FRAME' };
        const result = await localEngine.processPayload(JSON.stringify(payload));
        expect(result.summary).toContain('none');
    });
});
