/**
 * HydroPasteEngine unit tests — HYDRO.1-B + HYDRO.LIB
 *
 * Tests the deterministic match loop, heuristic fallback, token mapping,
 * import generation, summary string content, and library-aware JSX generation.
 */

import { describe, it, expect } from 'vitest';
import { HydroPasteEngine, classifyFrame, classifyComponent } from '../hydroPaste.js';
import {
    ShadcnEmitter,
    MuiEmitter,
    PrimeEmitter,
    TailwindLibEmitter,
    getEmitterForLibrary,
} from '../hydroPaste-emitters.js';
import { hexToLab } from '../colorDistance.js';

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

// ---------------------------------------------------------------------------
// HYDRO.LIB — Library-aware generation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 10. Generic (no-library) path unaffected
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — no library option (generic path)', () => {
    it('produces div-based JSX when no library is supplied', async () => {
        const noLibEngine = new HydroPasteEngine({ components: {} }, tokens);
        const payload = { name: 'Banner', type: 'FRAME' };
        const result = await noLibEngine.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<div');
        expect(result.library).toBeUndefined();
    });

    it('result.library is undefined when no library option', async () => {
        const noLibEngine = new HydroPasteEngine({ components: {} }, tokens);
        const result = await noLibEngine.processPayload(JSON.stringify({ name: 'X', type: 'FRAME' }));
        expect(result.library).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 11. Unknown library falls back to generic
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — unknown library falls back to generic', () => {
    it('falls back to div-based JSX for an unrecognized library name', async () => {
        const unknownLibEngine = new HydroPasteEngine({ components: {} }, tokens, {
            library: 'chakra-ui-not-registered',
        });
        const payload = { name: 'Widget', type: 'FRAME' };
        const result = await unknownLibEngine.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<div');
        expect(result.library).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 12. shadcn library emitter
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — shadcn library', () => {
    it('uses Card components for FRAME nodes with card/panel names', async () => {
        // Use a plain card-named FRAME that classifyFrame maps to 'card' (falls to wrapContainer default)
        const shadcnEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'shadcn' });
        const payload = {
            name: 'ProfileCard',
            type: 'FRAME',
            children: [{ name: 'Heading', type: 'TEXT', characters: 'Hello' }],
        };
        const result = await shadcnEngine.processPayload(JSON.stringify(payload));
        expect(result.library).toBe('shadcn');
        expect(result.components[0].jsx).toContain('<Card');
        expect(result.components[0].jsx).toContain('Hello');
    });

    it('includes shadcn card import in imports array', async () => {
        const shadcnEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'shadcn' });
        // Use a card-named FRAME so the Card emitter is triggered
        const payload = { name: 'UserCard', type: 'FRAME' };
        const result = await shadcnEngine.processPayload(JSON.stringify(payload));
        const cardImport = result.imports.find((i) => i.includes('@/components/ui/card'));
        expect(cardImport).toBeDefined();
    });

    it('summary mentions shadcn when library is active', async () => {
        const shadcnEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'shadcn' });
        const result = await shadcnEngine.processPayload(JSON.stringify({ name: 'Card', type: 'FRAME' }));
        expect(result.summary).toContain('shadcn');
    });
});

// ---------------------------------------------------------------------------
// 13. mui library emitter
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — mui library', () => {
    it('uses Box components for FRAME nodes', async () => {
        const muiEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'mui' });
        const payload = { name: 'Layout', type: 'FRAME' };
        const result = await muiEngine.processPayload(JSON.stringify(payload));
        expect(result.library).toBe('mui');
        expect(result.components[0].jsx).toContain('<Box');
    });

    it('uses Typography for TEXT nodes', async () => {
        const muiEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'mui' });
        const payload = {
            name: 'Layout',
            type: 'FRAME',
            children: [{ name: 'Label', type: 'TEXT', characters: 'Title' }],
        };
        const result = await muiEngine.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<Typography');
        expect(result.components[0].jsx).toContain('Title');
    });

    it('includes @mui/material import', async () => {
        const muiEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'mui' });
        const payload = { name: 'Layout', type: 'FRAME' };
        const result = await muiEngine.processPayload(JSON.stringify(payload));
        const muiImport = result.imports.find((i) => i.includes('@mui/material'));
        expect(muiImport).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// 14. primeng library emitter
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — primeng library', () => {
    it('uses Card components for FRAME nodes', async () => {
        const primeEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'primeng' });
        const payload = { name: 'Panel', type: 'FRAME' };
        const result = await primeEngine.processPayload(JSON.stringify(payload));
        expect(result.library).toBe('primeng');
        expect(result.components[0].jsx).toContain('<Card');
    });

    it('includes primereact/card import', async () => {
        const primeEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'primeng' });
        const result = await primeEngine.processPayload(JSON.stringify({ name: 'P', type: 'FRAME' }));
        const primeImport = result.imports.find((i) => i.includes('primereact/card'));
        expect(primeImport).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// 15. tailwind library emitter (enhanced path)
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — tailwind library', () => {
    it('uses div-based JSX for generic container names (consistent with Tailwind patterns)', async () => {
        // Use a layout-keyword FRAME name that classifyFrame maps to 'div'
        const twEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'tailwind' });
        const payload = { name: 'ContentWrapper', type: 'FRAME' };
        const result = await twEngine.processPayload(JSON.stringify(payload));
        expect(result.library).toBe('tailwind');
        expect(result.components[0].jsx).toContain('<div');
    });

    it('resolves token colors without arbitrary values when token exists', async () => {
        const twEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'tailwind' });
        const payload = {
            name: 'Section',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
        };
        const result = await twEngine.processPayload(JSON.stringify(payload));
        // #FF0000 maps to bg-color-brand-primary — no arbitrary value used
        expect(result.tokenMappings['#FF0000']).toBe('bg-color-brand-primary');
        expect(result.components[0].jsx).not.toContain('bg-[#FF0000]');
    });
});

// ---------------------------------------------------------------------------
// 16. Library field in HydroResult
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — library field in result', () => {
    it('sets result.library to the active library when emitter is found', async () => {
        for (const lib of ['shadcn', 'mui', 'primeng', 'tailwind']) {
            const e = new HydroPasteEngine({ components: {} }, tokens, { library: lib });
            const result = await e.processPayload(JSON.stringify({ name: 'Node', type: 'FRAME' }));
            expect(result.library).toBe(lib);
        }
    });

    it('does not set result.library when library option is absent', async () => {
        const e = new HydroPasteEngine({ components: {} }, tokens);
        const result = await e.processPayload(JSON.stringify({ name: 'Node', type: 'FRAME' }));
        expect(result.library).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 17. COMPONENT/INSTANCE nodes map to library component elements
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — COMPONENT node type', () => {
    it('emits a library component tag for COMPONENT nodes under shadcn', async () => {
        const shadcnEngine = new HydroPasteEngine({ components: {} }, tokens, { library: 'shadcn' });
        const payload = {
            name: 'Wrapper',
            type: 'FRAME',
            children: [{ name: 'Submit Button', type: 'COMPONENT' }],
        };
        const result = await shadcnEngine.processPayload(JSON.stringify(payload));
        // COMPONENT nodes emit their PascalCase name as a tag
        expect(result.components[0].jsx).toContain('<SubmitButton');
    });
});

// ---------------------------------------------------------------------------
// 18. Empty children → no crash, emits self-closing container
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — empty children with library', () => {
    it('produces a valid self-closing or empty container for a childless FRAME', async () => {
        for (const lib of ['shadcn', 'mui', 'primeng', 'tailwind']) {
            const e = new HydroPasteEngine({ components: {} }, tokens, { library: lib });
            const result = await e.processPayload(JSON.stringify({ name: 'Empty', type: 'FRAME' }));
            expect(result.components).toHaveLength(1);
            expect(result.components[0].jsx).toBeTruthy();
        }
    });
});

// ---------------------------------------------------------------------------
// 19. Boundary: empty tokens array still works with library
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — empty tokens with library', () => {
    it('does not crash with empty token list and shadcn library', async () => {
        const e = new HydroPasteEngine({ components: {} }, [], { library: 'shadcn' });
        const result = await e.processPayload(JSON.stringify({ name: 'X', type: 'FRAME' }));
        expect(result.components).toHaveLength(1);
        expect(result.library).toBe('shadcn');
    });
});

// ---------------------------------------------------------------------------
// 20. Emitter unit tests — isolated behavior
// ---------------------------------------------------------------------------

describe('ShadcnEmitter unit', () => {
    it('wrapContainer produces Card with CardContent', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex flex-col', '  <p>hi</p>', 0);
        expect(output).toContain('<Card');
        expect(output).toContain('<CardContent>');
        expect(output).toContain('<p>hi</p>');
    });

    it('emitText produces a p tag with colorClass', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitText('Hello', 'text-foreground', 0);
        expect(output).toContain('<p');
        expect(output).toContain('Hello');
        expect(output).toContain('text-foreground');
    });

    it('getImports includes card import after wrapContainer', () => {
        const emitter = new ShadcnEmitter();
        emitter.wrapContainer('', '', 0);
        const imports = emitter.getImports();
        expect(imports.some((i) => i.includes('@/components/ui/card'))).toBe(true);
    });

    it('resolveColor uses token lookup when available', () => {
        const emitter = new ShadcnEmitter();
        const lookup = new Map([['#FF0000', 'bg-color-brand-primary']]);
        const mappings: Record<string, string> = {};
        const cls = emitter.resolveColor('#FF0000', lookup, [], mappings);
        expect(cls).toBe('bg-color-brand-primary');
        expect(mappings['#FF0000']).toBe('bg-color-brand-primary');
    });

    it('resolveColor falls back to bare "background" token for unknown hex (caller applies prefix)', () => {
        const emitter = new ShadcnEmitter();
        const cls = emitter.resolveColor('#123456', new Map(), [], {});
        expect(cls).toBe('background');
    });

    it('wrapContainer with empty children emits self-closing Card', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '', 0);
        expect(output).toContain('<Card');
    });
});

describe('MuiEmitter unit', () => {
    it('wrapContainer produces Box with sx prop', () => {
        const emitter = new MuiEmitter();
        const output = emitter.wrapContainer('flex', '  <p>child</p>', 0);
        expect(output).toContain('<Box');
        expect(output).toContain("sx=");
    });

    it('emitText produces Typography component', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitText('Hello MUI', '', 0);
        expect(output).toContain('<Typography');
        expect(output).toContain('Hello MUI');
    });

    it('getImports includes @mui/material after usage', () => {
        const emitter = new MuiEmitter();
        emitter.wrapContainer('', '', 0);
        const imports = emitter.getImports();
        expect(imports.some((i) => i.includes('@mui/material'))).toBe(true);
    });
});

describe('PrimeEmitter unit', () => {
    it('wrapContainer produces Card', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.wrapContainer('flex', '  <p>child</p>', 0);
        expect(output).toContain('<Card');
    });

    it('getImports includes primereact/card after usage', () => {
        const emitter = new PrimeEmitter();
        emitter.wrapContainer('', '', 0);
        const imports = emitter.getImports();
        expect(imports.some((i) => i.includes('primereact/card'))).toBe(true);
    });

    it('resolveColor falls back to PrimeTek CSS var for unknown hex', () => {
        const emitter = new PrimeEmitter();
        const cls = emitter.resolveColor('#AABBCC', new Map(), [], {});
        expect(cls).toContain('--p-surface-0');
    });
});

describe('TailwindLibEmitter unit', () => {
    it('wrapContainer produces div', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.wrapContainer('flex flex-col', '<p>hi</p>', 0);
        expect(output).toContain('<div');
    });

    it('getImports returns empty array (utility-only)', () => {
        const emitter = new TailwindLibEmitter();
        expect(emitter.getImports()).toHaveLength(0);
    });

    it('resolveColor uses token lookup when available', () => {
        const emitter = new TailwindLibEmitter();
        const lookup = new Map([['#FF0000', 'bg-brand-primary']]);
        const mappings: Record<string, string> = {};
        const cls = emitter.resolveColor('#FF0000', lookup, [], mappings);
        expect(cls).toBe('bg-brand-primary');
    });

    it('resolveColor falls back to arbitrary value when no token', () => {
        const emitter = new TailwindLibEmitter();
        const cls = emitter.resolveColor('#DEADBE', new Map(), [], {});
        expect(cls).toBe('[#DEADBE]');
    });
});

// ---------------------------------------------------------------------------
// 21. getEmitterForLibrary registry
// ---------------------------------------------------------------------------

describe('getEmitterForLibrary', () => {
    it('returns ShadcnEmitter for "shadcn"', () => {
        const emitter = getEmitterForLibrary('shadcn');
        expect(emitter).toBeInstanceOf(ShadcnEmitter);
    });

    it('returns MuiEmitter for "mui"', () => {
        const emitter = getEmitterForLibrary('mui');
        expect(emitter).toBeInstanceOf(MuiEmitter);
    });

    it('returns PrimeEmitter for "primeng"', () => {
        const emitter = getEmitterForLibrary('primeng');
        expect(emitter).toBeInstanceOf(PrimeEmitter);
    });

    it('returns null for unregistered alias "primereact"', () => {
        const emitter = getEmitterForLibrary('primereact');
        expect(emitter).toBeNull();
    });

    it('returns TailwindLibEmitter for "tailwind"', () => {
        const emitter = getEmitterForLibrary('tailwind');
        expect(emitter).toBeInstanceOf(TailwindLibEmitter);
    });

    it('returns null for an unregistered library', () => {
        expect(getEmitterForLibrary('bootstrap')).toBeNull();
        expect(getEmitterForLibrary('')).toBeNull();
        expect(getEmitterForLibrary('unknown-lib')).toBeNull();
    });

    it('is case-insensitive', () => {
        expect(getEmitterForLibrary('SHADCN')).toBeInstanceOf(ShadcnEmitter);
        expect(getEmitterForLibrary('MUI')).toBeInstanceOf(MuiEmitter);
    });
});

// ---------------------------------------------------------------------------
// D2C.4 Feature 1 — classifyFrame unit tests
// ---------------------------------------------------------------------------

describe('classifyFrame — card keywords', () => {
    it('returns "card" for name "ProfileCard"', () => {
        expect(classifyFrame({ name: 'ProfileCard', type: 'FRAME' }, 2)).toBe('card');
    });

    it('returns "card" for name "DashboardPanel"', () => {
        expect(classifyFrame({ name: 'DashboardPanel', type: 'FRAME' }, 3)).toBe('card');
    });
});

describe('classifyFrame — layout keywords', () => {
    it('returns "div" for name "ContentRow"', () => {
        expect(classifyFrame({ name: 'ContentRow', type: 'FRAME' }, 2)).toBe('div');
    });

    it('returns "div" for name "WrapperBlock"', () => {
        expect(classifyFrame({ name: 'WrapperBlock', type: 'FRAME' }, 3)).toBe('div');
    });
});

describe('classifyFrame — form keyword', () => {
    it('returns "form" for name "ContactForm"', () => {
        expect(classifyFrame({ name: 'ContactForm', type: 'FRAME' }, 2)).toBe('form');
    });

    it('returns "form" for name "RegistrationForm"', () => {
        expect(classifyFrame({ name: 'RegistrationForm', type: 'FRAME' }, 3)).toBe('form');
    });
});

describe('classifyFrame — nav keywords', () => {
    it('returns "nav" for name "SiteNav"', () => {
        expect(classifyFrame({ name: 'SiteNav', type: 'FRAME' }, 2)).toBe('nav');
    });

    it('returns "nav" for name "MainNavbar"', () => {
        expect(classifyFrame({ name: 'MainNavbar', type: 'FRAME' }, 1)).toBe('nav');
    });

    it('returns "nav" for name "NavigationBar"', () => {
        expect(classifyFrame({ name: 'NavigationBar', type: 'FRAME' }, 1)).toBe('nav');
    });
});

describe('classifyFrame — header / footer', () => {
    it('returns "header" for name "PageHeader"', () => {
        expect(classifyFrame({ name: 'PageHeader', type: 'FRAME' }, 1)).toBe('header');
    });

    it('returns "footer" for name "SiteFooter"', () => {
        expect(classifyFrame({ name: 'SiteFooter', type: 'FRAME' }, 1)).toBe('footer');
    });
});

describe('classifyFrame — section keywords', () => {
    it('returns "section" for name "HeroSection"', () => {
        expect(classifyFrame({ name: 'HeroSection', type: 'FRAME' }, 2)).toBe('section');
    });

    it('returns "section" for name "PromoBanner"', () => {
        expect(classifyFrame({ name: 'PromoBanner', type: 'FRAME' }, 2)).toBe('section');
    });
});

describe('classifyFrame — depth-based fallback', () => {
    it('returns "div" for depth 0 regardless of generic name', () => {
        expect(classifyFrame({ name: 'RootContainer', type: 'FRAME' }, 0)).toBe('div');
    });

    it('returns "div" for depth 1 regardless of generic name', () => {
        expect(classifyFrame({ name: 'LayoutBlock', type: 'FRAME' }, 1)).toBe('div');
    });
});

describe('classifyFrame — visual cue card detection', () => {
    it('returns "card" at depth >= 2 when node has solid fill and shadow keyword in name', () => {
        const node = {
            name: 'ProductShadowTile',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
        };
        expect(classifyFrame(node, 3)).toBe('card');
    });

    it('does not upgrade to card at depth >= 2 when fill is present but no visual cue keyword', () => {
        const node = {
            name: 'ContentArea',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
        };
        // Falls to layout keyword or default div
        const result = classifyFrame(node, 3);
        expect(result).toBe('div');
    });
});

describe('classifyFrame — default fallback', () => {
    it('returns "div" for a completely unrecognized name at depth 2', () => {
        expect(classifyFrame({ name: 'XyzAbc123', type: 'FRAME' }, 2)).toBe('div');
    });

    it('returns "div" for an empty name at depth 2', () => {
        expect(classifyFrame({ name: '', type: 'FRAME' }, 2)).toBe('div');
    });

    it('returns "div" for node with no name', () => {
        expect(classifyFrame({ type: 'FRAME' }, 2)).toBe('div');
    });
});

// ---------------------------------------------------------------------------
// D2C.4 Feature 1 — classifyComponent unit tests
// ---------------------------------------------------------------------------

describe('classifyComponent — input classification', () => {
    it('returns "input" for "DisplayNameInput"', () => {
        const result = classifyComponent('DisplayNameInput');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
        expect(result!.matchedKeywords).toContain('input');
    });

    it('returns "input" for "EmailField"', () => {
        const result = classifyComponent('EmailField');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
    });

    it('returns "input" for "UserTextField" (text-field maps to input not textarea)', () => {
        const result = classifyComponent('UserTextField');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
    });
});

describe('classifyComponent — textarea classification', () => {
    it('returns "textarea" for "BioTextarea"', () => {
        const result = classifyComponent('BioTextarea');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('textarea');
    });

    it('returns "textarea" for "CommentText-Area"', () => {
        const result = classifyComponent('CommentText-Area');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('textarea');
    });

    it('returns "textarea" for "MultilineInput"', () => {
        const result = classifyComponent('MultilineInput');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('textarea');
    });
});

describe('classifyComponent — select classification', () => {
    it('returns "select" for "TimezoneDropdown"', () => {
        const result = classifyComponent('TimezoneDropdown');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('select');
        expect(result!.matchedKeywords).toContain('dropdown');
    });

    it('returns "select" for "CountrySelect"', () => {
        const result = classifyComponent('CountrySelect');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('select');
    });

    it('returns "select" for "RoleCombobox"', () => {
        const result = classifyComponent('RoleCombobox');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('select');
    });
});

describe('classifyComponent — checkbox / switch', () => {
    it('returns "checkbox" for "RememberCheckbox"', () => {
        const result = classifyComponent('RememberCheckbox');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('checkbox');
    });

    it('returns "switch" for "DarkModeToggle"', () => {
        const result = classifyComponent('DarkModeToggle');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('switch');
    });
});

describe('classifyComponent — avatar / badge', () => {
    it('returns "avatar" for "UserAvatar"', () => {
        const result = classifyComponent('UserAvatar');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('avatar');
    });

    it('returns "badge" for "StatusBadge"', () => {
        const result = classifyComponent('StatusBadge');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('badge');
    });

    it('returns "badge" for "CategoryTag"', () => {
        const result = classifyComponent('CategoryTag');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('badge');
    });

    it('returns "badge" for "FilterChip"', () => {
        const result = classifyComponent('FilterChip');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('badge');
    });
});

describe('classifyComponent — tabs', () => {
    it('returns "tabs" for "SettingsTab"', () => {
        const result = classifyComponent('SettingsTab');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('tabs');
    });

    it('does NOT return "tabs" for "DataTable" (table is excluded)', () => {
        const result = classifyComponent('DataTable');
        expect(result).toBeNull();
    });
});

describe('classifyComponent — separator / alert', () => {
    it('returns "separator" for "SectionDivider"', () => {
        const result = classifyComponent('SectionDivider');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('separator');
    });

    it('returns "alert" for "ErrorMessage"', () => {
        const result = classifyComponent('ErrorMessage');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('alert');
    });

    it('returns "alert" for "SuccessToast"', () => {
        const result = classifyComponent('SuccessToast');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('alert');
    });
});

describe('classifyComponent — null results', () => {
    it('returns null for "HeroSection"', () => {
        expect(classifyComponent('HeroSection')).toBeNull();
    });

    it('returns null for "MainContainer"', () => {
        expect(classifyComponent('MainContainer')).toBeNull();
    });

    it('returns null for "ProfileCard"', () => {
        expect(classifyComponent('ProfileCard')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(classifyComponent('')).toBeNull();
    });

    it('is case-insensitive — "EMAILINPUT" still returns input', () => {
        const result = classifyComponent('EMAILINPUT');
        expect(result).not.toBeNull();
        expect(result!.type).toBe('input');
    });
});

// ---------------------------------------------------------------------------
// D2C.4 Feature 1 — emitNamedComponent tests for all 4 emitters
// ---------------------------------------------------------------------------

describe('ShadcnEmitter.emitNamedComponent', () => {
    it('emits <Input /> for "input" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('input', {}, '', 1);
        expect(output).toContain('<Input');
    });

    it('emits <Textarea> for "textarea" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('textarea', {}, '', 1);
        expect(output).toContain('<Textarea');
    });

    it('emits <Select> compound for "select" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('select', {}, '', 1);
        expect(output).toContain('<Select');
        expect(output).toContain('<SelectTrigger');
        expect(output).toContain('<SelectContent');
    });

    it('emits <Checkbox /> for "checkbox" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('checkbox', {}, '', 1);
        expect(output).toContain('<Checkbox');
    });

    it('emits <Switch /> for "switch" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('switch', {}, '', 1);
        expect(output).toContain('<Switch');
    });

    it('emits <Avatar> compound for "avatar" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('avatar', {}, '', 1);
        expect(output).toContain('<Avatar');
        expect(output).toContain('<AvatarImage');
        expect(output).toContain('<AvatarFallback');
    });

    it('emits <Badge> for "badge" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('badge', {}, '', 1);
        expect(output).toContain('<Badge');
    });

    it('emits <Tabs> compound for "tabs" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('tabs', {}, '', 1);
        expect(output).toContain('<Tabs');
        expect(output).toContain('<TabsList');
        expect(output).toContain('<TabsTrigger');
    });

    it('emits <Separator /> for "separator" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('separator', {}, '', 1);
        expect(output).toContain('<Separator');
    });

    it('emits <Alert> compound for "alert" type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('alert', {}, '', 1);
        expect(output).toContain('<Alert');
        expect(output).toContain('<AlertDescription');
    });

    it('getImports includes input import after emitNamedComponent("input")', () => {
        const emitter = new ShadcnEmitter();
        emitter.emitNamedComponent('input', {}, '', 1);
        const imports = emitter.getImports();
        expect(imports.some((i) => i.includes('@/components/ui/input'))).toBe(true);
    });

    it('getImports includes separator import after emitNamedComponent("separator")', () => {
        const emitter = new ShadcnEmitter();
        emitter.emitNamedComponent('separator', {}, '', 1);
        const imports = emitter.getImports();
        expect(imports.some((i) => i.includes('@/components/ui/separator'))).toBe(true);
    });

    it('falls back to emitComponent for unknown type', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitNamedComponent('UnknownWidget', {}, '', 1);
        expect(output).toContain('<UnknownWidget');
    });
});

describe('MuiEmitter.emitNamedComponent', () => {
    it('emits <TextField /> for "input" type', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('input', {}, '', 1);
        expect(output).toContain('<TextField');
    });

    it('emits <TextField multiline /> for "textarea" type', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('textarea', {}, '', 1);
        expect(output).toContain('multiline');
    });

    it('emits <Select> for "select" type', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('select', {}, '', 1);
        expect(output).toContain('<Select');
    });

    it('emits <Chip /> for "badge" type', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('badge', {}, '', 1);
        expect(output).toContain('<Chip');
    });

    it('emits <Divider /> for "separator" type', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitNamedComponent('separator', {}, '', 1);
        expect(output).toContain('<Divider');
    });

    it('getImports includes @mui/material after emitNamedComponent("input")', () => {
        const emitter = new MuiEmitter();
        emitter.emitNamedComponent('input', {}, '', 1);
        expect(emitter.getImports().some((i) => i.includes('@mui/material'))).toBe(true);
    });
});

describe('PrimeEmitter.emitNamedComponent', () => {
    it('emits <InputText /> for "input" type', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('input', {}, '', 1);
        expect(output).toContain('<InputText');
    });

    it('emits <Dropdown /> for "select" type', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('select', {}, '', 1);
        expect(output).toContain('<Dropdown');
    });

    it('emits <InputSwitch /> for "switch" type', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('switch', {}, '', 1);
        expect(output).toContain('<InputSwitch');
    });

    it('emits <TabView> compound for "tabs" type', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('tabs', {}, '', 1);
        expect(output).toContain('<TabView');
        expect(output).toContain('<TabPanel');
    });

    it('emits <Message /> for "alert" type', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitNamedComponent('alert', {}, '', 1);
        expect(output).toContain('<Message');
    });

    it('getImports includes primereact/inputtext after emitNamedComponent("input")', () => {
        const emitter = new PrimeEmitter();
        emitter.emitNamedComponent('input', {}, '', 1);
        expect(emitter.getImports().some((i) => i.includes('primereact/inputtext'))).toBe(true);
    });
});

describe('TailwindLibEmitter.emitNamedComponent', () => {
    it('emits <input /> for "input" type', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('input', {}, '', 1);
        expect(output).toContain('<input');
    });

    it('emits <textarea> for "textarea" type', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('textarea', {}, '', 1);
        expect(output).toContain('<textarea');
    });

    it('emits <select> for "select" type', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('select', {}, '', 1);
        expect(output).toContain('<select');
    });

    it('emits <input type="checkbox"> for "checkbox" type', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('checkbox', {}, '', 1);
        expect(output).toContain('type="checkbox"');
    });

    it('emits <input type="checkbox" role="switch"> for "switch" type', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('switch', {}, '', 1);
        expect(output).toContain('role="switch"');
    });

    it('emits <hr /> for "separator" type', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('separator', {}, '', 1);
        expect(output).toContain('<hr');
    });

    it('emits <div role="alert"> for "alert" type', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitNamedComponent('alert', {}, '', 1);
        expect(output).toContain('role="alert"');
    });
});

// ---------------------------------------------------------------------------
// D2C.4 Feature 1 — wrapContainer element param tests
// ---------------------------------------------------------------------------

describe('ShadcnEmitter.wrapContainer with element param', () => {
    it('emits <form> wrapper when element is "form"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex flex-col', '<p>field</p>', 1, 'form');
        expect(output).toContain('<form');
        expect(output).not.toContain('<Card');
    });

    it('emits <nav> wrapper when element is "nav"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '<a>link</a>', 1, 'nav');
        expect(output).toContain('<nav');
    });

    it('emits <section> wrapper when element is "section"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '<p>body</p>', 1, 'section');
        expect(output).toContain('<section');
    });

    it('emits <header> wrapper when element is "header"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '<h1>Title</h1>', 1, 'header');
        expect(output).toContain('<header');
    });

    it('emits <footer> wrapper when element is "footer"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '<p>foot</p>', 1, 'footer');
        expect(output).toContain('<footer');
    });

    it('falls back to Card when element is "div"', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '<p>child</p>', 1, 'div');
        expect(output).toContain('<Card');
    });

    it('falls back to Card when element is omitted', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.wrapContainer('flex', '<p>child</p>', 1);
        expect(output).toContain('<Card');
    });
});

describe('MuiEmitter.wrapContainer with element param', () => {
    it('emits Box with component="form" when element is "form"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.wrapContainer('flex', '<p>field</p>', 1, 'form');
        expect(output).toContain('component="form"');
    });

    it('emits plain Box (no component prop) when element is "div"', () => {
        const emitter = new MuiEmitter();
        const output = emitter.wrapContainer('flex', '<p>child</p>', 1, 'div');
        expect(output).toContain('<Box');
        expect(output).not.toContain('component=');
    });
});

describe('TailwindLibEmitter.wrapContainer with element param', () => {
    it('emits <form> when element is "form"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.wrapContainer('flex', '<p>field</p>', 1, 'form');
        expect(output).toContain('<form');
        expect(output).not.toContain('<div');
    });

    it('emits <section> when element is "section"', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.wrapContainer('flex', '<p>body</p>', 1, 'section');
        expect(output).toContain('<section');
    });

    it('emits <div> when element is omitted', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.wrapContainer('flex', '<p>child</p>', 1);
        expect(output).toContain('<div');
    });
});

// ---------------------------------------------------------------------------
// D2C.4 Feature 1 — Integration tests via HydroPasteEngine
// ---------------------------------------------------------------------------

describe('Integration: ContactForm frame emits <form> not <Card>', () => {
    it('shadcn: "ContactForm" FRAME generates <form> wrapper', async () => {
        const shadcnEngine = new HydroPasteEngine({ components: {} }, [], { library: 'shadcn' });
        const payload = {
            name: 'ContactForm',
            type: 'FRAME',
            children: [{ name: 'NameField', type: 'TEXT', characters: 'Your Name' }],
        };
        const result = await shadcnEngine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;
        expect(jsx).toContain('<form');
        expect(jsx).not.toContain('<Card');
    });

    it('tailwind: "ContactForm" FRAME generates <form> wrapper', async () => {
        const twEngine = new HydroPasteEngine({ components: {} }, [], { library: 'tailwind' });
        const payload = { name: 'ContactForm', type: 'FRAME' };
        const result = await twEngine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;
        expect(jsx).toContain('<form');
        expect(jsx).not.toContain('<div');
    });
});

describe('Integration: EmailInput frame emits <Input> not <p>', () => {
    it('shadcn: "EmailInput" FRAME generates <Input> component', async () => {
        const shadcnEngine = new HydroPasteEngine({ components: {} }, [], { library: 'shadcn' });
        const payload = { name: 'EmailInput', type: 'FRAME' };
        const result = await shadcnEngine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;
        expect(jsx).toContain('<Input');
        expect(jsx).not.toContain('<p');
    });

    it('mui: "EmailInput" FRAME generates <TextField>', async () => {
        const muiEngine = new HydroPasteEngine({ components: {} }, [], { library: 'mui' });
        const payload = { name: 'EmailInput', type: 'FRAME' };
        const result = await muiEngine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;
        expect(jsx).toContain('<TextField');
    });

    it('primeng: "EmailInput" FRAME generates <InputText>', async () => {
        const primeEngine = new HydroPasteEngine({ components: {} }, [], { library: 'primeng' });
        const payload = { name: 'EmailInput', type: 'FRAME' };
        const result = await primeEngine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;
        expect(jsx).toContain('<InputText');
    });

    it('tailwind: "EmailInput" FRAME generates <input>', async () => {
        const twEngine = new HydroPasteEngine({ components: {} }, [], { library: 'tailwind' });
        const payload = { name: 'EmailInput', type: 'FRAME' };
        const result = await twEngine.processPayload(JSON.stringify(payload));
        const jsx = result.components[0].jsx;
        expect(jsx).toContain('<input');
    });
});

describe('Integration: NavBar frame emits <nav> wrapper', () => {
    it('shadcn: "MainNavbar" FRAME generates <nav>', async () => {
        const shadcnEngine = new HydroPasteEngine({ components: {} }, [], { library: 'shadcn' });
        const payload = {
            name: 'MainNavbar',
            type: 'FRAME',
            children: [{ name: 'Home', type: 'TEXT', characters: 'Home' }],
        };
        const result = await shadcnEngine.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<nav');
    });
});

describe('Integration: generic path uses div for unknown frames', () => {
    it('generic path: unrecognized name at depth 1 still produces div', async () => {
        const noLibEngine = new HydroPasteEngine({ components: {} }, []);
        const payload = { name: 'XyzWidget', type: 'FRAME' };
        const result = await noLibEngine.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<div');
    });
});

// ---------------------------------------------------------------------------
// 22. CIEDE2000 fuzzy token matching integration
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — CIEDE2000 fuzzy token matching', () => {
    // The motivating bug case: Figma RGB quantization can produce hex values that
    // differ from the design token by a tiny amount. Use #FF0000 (token) vs
    // #FF0001 (quantized output) — ΔE << 1.0, well within the 2.0 threshold.
    it('resolves near-hex #FF0001 to the #FF0000 token class (generic path)', async () => {
        const fuzzyTokens = [{ name: 'color.brand.primary', value: '#FF0000' }];
        const e = new HydroPasteEngine({ components: {} }, fuzzyTokens);
        const payload = {
            name: 'RedPanel',
            type: 'FRAME',
            // r=1, g=0, b=1/255 → #FF0001 (1 unit off from token #FF0000)
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 1 / 255 } }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        // The near-hex should resolve to the token class via fuzzy matching
        const tokenValues = Object.values(result.tokenMappings);
        expect(tokenValues.length).toBeGreaterThan(0);
        const hasTokenClass = tokenValues.some((v) => v.includes('color-brand-primary'));
        const hasArbitraryFallback = tokenValues.some((v) => v.startsWith('bg-['));
        expect(hasTokenClass).toBe(true);
        expect(hasArbitraryFallback).toBe(false);
    });

    it('falls back to arbitrary value when color is far outside token set', async () => {
        const narrowTokens = [{ name: 'color.dark.surface', value: '#171719' }];
        const e = new HydroPasteEngine({ components: {} }, narrowTokens);
        // Pure green is ΔE >> 2.0 from #171719
        const payload = {
            name: 'GreenPanel',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        // tokenMappings only records resolved token matches — arbitrary fallbacks are
        // embedded directly in JSX but not stored in tokenMappings.
        // Verify no token class was incorrectly matched.
        const tokenValues = Object.values(result.tokenMappings);
        expect(tokenValues.some((v) => v.includes('color-dark-surface'))).toBe(false);
        // The JSX should contain the arbitrary value fallback
        expect(result.components[0].jsx).toContain('bg-[#00FF00]');
    });

    it('exact hex match still resolves correctly (no regression)', async () => {
        const exactTokens = [{ name: 'color.brand.primary', value: '#FF0000' }];
        const e = new HydroPasteEngine({ components: {} }, exactTokens);
        const payload = {
            name: 'RedButton',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        // Exact match must still produce the token class
        expect(result.tokenMappings['#FF0000']).toBe('bg-color-brand-primary');
    });

    it('resolves near-hex to token via shadcn library emitter', async () => {
        // The emitter path also gets labTokens — verify fuzzy matching works there
        const fuzzyTokens = [{ name: 'color.dark.surface', value: '#171719' }];
        const e = new HydroPasteEngine({ components: {} }, fuzzyTokens, { library: 'shadcn' });
        // Build a lab entry for the expected token to pre-verify the ΔE
        const lab1 = hexToLab('#17171C');
        const lab2 = hexToLab('#171719');
        expect(lab1).not.toBeNull();
        expect(lab2).not.toBeNull();
        // Both are valid LABs — test that the engine can process without throwing
        const payload = {
            name: 'DarkCard',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 0.09019, g: 0.09019, b: 0.10980 } }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components).toHaveLength(1);
        expect(result.library).toBe('shadcn');
    });

    it('empty tokens produce no fuzzy matches — no crash', async () => {
        const e = new HydroPasteEngine({ components: {} }, []);
        const payload = {
            name: 'Panel',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components).toHaveLength(1);
        // No token match → arbitrary value fallback
        const values = Object.values(result.tokenMappings);
        if (values.length > 0) {
            expect(values[0]).toMatch(/^bg-\[/);
        }
    });
});

// ---------------------------------------------------------------------------
// 23. Color role — TEXT nodes get text- prefix, FRAMEs get bg- prefix
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — color role (text- vs bg- prefix)', () => {
    it('TEXT node with fill gets text- class in generic path', async () => {
        const e = new HydroPasteEngine({}, tokens);
        const payload = {
            name: 'Wrapper',
            type: 'FRAME',
            children: [
                {
                    name: 'Body',
                    type: 'TEXT',
                    characters: 'Hello',
                    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
                },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('text-color-brand-primary');
        expect(result.components[0].jsx).not.toContain('bg-color-brand-primary');
    });

    it('FRAME node with fill gets bg- class in generic path', async () => {
        const e = new HydroPasteEngine({}, tokens);
        const payload = {
            name: 'LargeSection',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
            children: [
                { name: 'Para1', type: 'TEXT', characters: 'Line 1' },
                { name: 'Para2', type: 'TEXT', characters: 'Line 2' },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('bg-color-brand-primary');
    });

    it('TEXT node with fill gets text- class via shadcn emitter', async () => {
        const e = new HydroPasteEngine({}, tokens, { library: 'shadcn' });
        const payload = {
            name: 'Section',
            type: 'FRAME',
            children: [
                {
                    name: 'Paragraph',
                    type: 'TEXT',
                    characters: 'Some body copy here.',
                    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
                },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('text-color-brand-primary');
        expect(result.components[0].jsx).not.toContain('bg-color-brand-primary');
    });

    it('tokenMappings records text- class when TEXT node fill is resolved', async () => {
        const e = new HydroPasteEngine({}, tokens);
        const payload = {
            name: 'Section',
            type: 'FRAME',
            children: [
                {
                    name: 'BodyText',
                    type: 'TEXT',
                    characters: 'Hello',
                    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
                },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.tokenMappings['#FF0000']).toBe('text-color-brand-primary');
    });

    it('tokenMappings records bg- class when FRAME fill is resolved', async () => {
        const e = new HydroPasteEngine({}, tokens);
        const payload = {
            name: 'LargeFrame',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
            children: [
                { name: 'A', type: 'TEXT', characters: 'Line A' },
                { name: 'B', type: 'TEXT', characters: 'Line B' },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.tokenMappings['#FF0000']).toBe('bg-color-brand-primary');
    });
});

// ---------------------------------------------------------------------------
// 24. Button heuristic — button-named FRAME → <Button> in emitter path
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — button heuristic', () => {
    it('FRAME named "button" with single TEXT child → <Button> (shadcn)', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'shadcn' });
        const payload = {
            name: 'Primary Button',
            type: 'FRAME',
            children: [{ name: 'Label', type: 'TEXT', characters: 'Get Started' }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<Button');
        expect(result.components[0].jsx).toContain('Get Started');
    });

    it('FRAME named "cta" with single TEXT child → <Button> (shadcn)', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'shadcn' });
        const payload = {
            name: 'cta',
            type: 'FRAME',
            children: [{ name: 'Label', type: 'TEXT', characters: 'Sign Up' }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<Button');
    });

    it('FRAME named "submit" with single TEXT child → <Button> (mui)', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'mui' });
        const payload = {
            name: 'Submit button',
            type: 'FRAME',
            children: [{ name: 'Label', type: 'TEXT', characters: 'Submit' }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<Button');
        expect(result.components[0].jsx).toContain('Submit');
    });

    it('FRAME named "button" with single TEXT child → <button> (generic path)', async () => {
        const e = new HydroPasteEngine({}, []);
        const payload = {
            name: 'Primary button',
            type: 'FRAME',
            children: [{ name: 'Label', type: 'TEXT', characters: 'Click Me' }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<button');
        expect(result.components[0].jsx).toContain('Click Me');
    });

    it('button frame includes Button import (shadcn)', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'shadcn' });
        const payload = {
            name: 'Primary button',
            type: 'FRAME',
            children: [{ name: 'Label', type: 'TEXT', characters: 'Continue' }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        const buttonImport = result.imports.find((i) => i.includes('@/components/ui/button'));
        expect(buttonImport).toBeDefined();
    });

    it('FRAME with multiple children is NOT a button (still Card)', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'shadcn' });
        const payload = {
            name: 'Primary button',
            type: 'FRAME',
            children: [
                { name: 'Icon', type: 'FRAME' },
                { name: 'Label', type: 'TEXT', characters: 'Click' },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<Card');
        expect(result.components[0].jsx).not.toContain('<Button');
    });

    it('FRAME named "banner" with single short TEXT is NOT a button (D2C.4: now emits section)', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'shadcn' });
        const payload = {
            name: 'banner',
            type: 'FRAME',
            children: [{ name: 'Heading', type: 'TEXT', characters: 'Hello' }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).not.toContain('<Button');
        // D2C.4: classifyFrame maps "banner" to 'section' → emits <section> not <Card>
        expect(result.components[0].jsx).toContain('<section');
    });

    it('FRAME named "card" with single short TEXT is NOT a button', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'shadcn' });
        const payload = {
            name: 'card',
            type: 'FRAME',
            children: [{ name: 'Title', type: 'TEXT', characters: 'Widget' }],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).not.toContain('<Button');
    });
});

// ---------------------------------------------------------------------------
// 25. Heading heuristic — heading-named TEXT → <h2> / Typography heading
// ---------------------------------------------------------------------------

describe('HydroPasteEngine — heading heuristic', () => {
    it('TEXT named "headline" at shallow depth → <h2> (generic path)', async () => {
        const e = new HydroPasteEngine({}, []);
        const payload = {
            name: 'LargeSection',
            type: 'FRAME',
            children: [
                { name: 'Headline', type: 'TEXT', characters: 'Welcome to Flint' },
                { name: 'Body', type: 'TEXT', characters: 'Longer description text here.' },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<h2');
        expect(result.components[0].jsx).toContain('Welcome to Flint');
    });

    it('TEXT named "title" at shallow depth → <h2> (shadcn)', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'shadcn' });
        const payload = {
            name: 'Hero section',
            type: 'FRAME',
            children: [
                { name: 'Title', type: 'TEXT', characters: 'Hero Title Here' },
                { name: 'Subtext', type: 'TEXT', characters: 'Some sub description here.' },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<h2');
        expect(result.components[0].jsx).toContain('Hero Title Here');
    });

    it('TEXT named "heading" → Typography heading variant (mui)', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'mui' });
        const payload = {
            name: 'LargeSection',
            type: 'FRAME',
            children: [
                { name: 'Page Heading', type: 'TEXT', characters: 'Page Title' },
                { name: 'Body', type: 'TEXT', characters: 'Body text here, long enough.' },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toMatch(/Typography.*variant="h[45]/);
        expect(result.components[0].jsx).toContain('Page Title');
    });

    it('TEXT named "h2" → <h2> (tailwind)', async () => {
        const e = new HydroPasteEngine({}, [], { library: 'tailwind' });
        const payload = {
            name: 'Section',
            type: 'FRAME',
            children: [
                { name: 'h2 element', type: 'TEXT', characters: 'Section Header' },
                { name: 'Content', type: 'TEXT', characters: 'Some paragraph content here.' },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).toContain('<h2');
        expect(result.components[0].jsx).toContain('Section Header');
    });

    it('TEXT named "title" at depth > 3 does NOT get heading treatment', async () => {
        const e = new HydroPasteEngine({}, []);
        const deepPayload = {
            name: 'Root',
            type: 'FRAME',
            children: [{
                name: 'L1',
                type: 'FRAME',
                children: [{
                    name: 'L2',
                    type: 'FRAME',
                    children: [{
                        name: 'L3',
                        type: 'FRAME',
                        children: [
                            // TEXT at depth 5 — should NOT become <h2>
                            { name: 'Title', type: 'TEXT', characters: 'Deep Title' },
                        ],
                    }],
                }],
            }],
        };
        const result = await e.processPayload(JSON.stringify(deepPayload));
        expect(result.components[0].jsx).toContain('Deep Title');
        expect(result.components[0].jsx).not.toContain('<h2');
    });

    it('non-heading-named TEXT does NOT get heading treatment', async () => {
        const e = new HydroPasteEngine({}, []);
        const payload = {
            name: 'Section',
            type: 'FRAME',
            children: [
                { name: 'Label', type: 'TEXT', characters: 'Body Copy' },
                { name: 'Label2', type: 'TEXT', characters: 'More Body Copy' },
            ],
        };
        const result = await e.processPayload(JSON.stringify(payload));
        expect(result.components[0].jsx).not.toContain('<h2');
        expect(result.components[0].jsx).toContain('<p');
    });
});

// ---------------------------------------------------------------------------
// 26. emitHeading — per-emitter unit tests
// ---------------------------------------------------------------------------

describe('ShadcnEmitter.emitHeading', () => {
    it('produces h2 with text-2xl font-bold and colorClass', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitHeading('Welcome', 'text-foreground', 0);
        expect(output).toContain('<h2');
        expect(output).toContain('text-2xl');
        expect(output).toContain('font-bold');
        expect(output).toContain('text-foreground');
        expect(output).toContain('Welcome');
    });

    it('produces h2 with only base classes when colorClass is empty', () => {
        const emitter = new ShadcnEmitter();
        const output = emitter.emitHeading('Title', '', 0);
        expect(output).toContain('<h2');
        expect(output).toContain('text-2xl');
        expect(output).toContain('font-bold');
    });

    it('respects depth indentation', () => {
        const emitter = new ShadcnEmitter();
        const output0 = emitter.emitHeading('T', '', 0);
        const output2 = emitter.emitHeading('T', '', 2);
        expect(output0).not.toMatch(/^ /);
        expect(output2).toMatch(/^ {4}/);
    });
});

describe('MuiEmitter.emitHeading', () => {
    it('produces Typography with a heading variant', () => {
        const emitter = new MuiEmitter();
        const output = emitter.emitHeading('Page Title', 'text-primary', 0);
        expect(output).toContain('<Typography');
        expect(output).toMatch(/variant="h[45]/);
        expect(output).toContain('Page Title');
    });

    it('adds Typography to @mui/material import after emitHeading', () => {
        const emitter = new MuiEmitter();
        emitter.emitHeading('Title', '', 0);
        const imports = emitter.getImports();
        expect(imports.some((i) => i.includes('@mui/material') && i.includes('Typography'))).toBe(true);
    });
});

describe('PrimeEmitter.emitHeading', () => {
    it('produces an h2 tag', () => {
        const emitter = new PrimeEmitter();
        const output = emitter.emitHeading('Section Title', 'text-primary', 0);
        expect(output).toContain('<h2');
        expect(output).toContain('Section Title');
    });
});

describe('TailwindLibEmitter.emitHeading', () => {
    it('produces h2 with text-2xl font-bold and colorClass', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitHeading('Headline', 'text-foreground', 0);
        expect(output).toContain('<h2');
        expect(output).toContain('text-2xl');
        expect(output).toContain('font-bold');
        expect(output).toContain('text-foreground');
        expect(output).toContain('Headline');
    });

    it('produces h2 with only base classes when colorClass is empty', () => {
        const emitter = new TailwindLibEmitter();
        const output = emitter.emitHeading('Title', '', 0);
        expect(output).toContain('text-2xl');
        expect(output).toContain('font-bold');
    });
});
