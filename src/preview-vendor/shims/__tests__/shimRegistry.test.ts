import { describe, it, expect } from 'vitest';
import {
  getLibraryShims,
  getGenericShims,
  getRegisteredLibraries,
  type LibraryShimBundle,
} from '../index';

// ---------------------------------------------------------------------------
// Helper assertions
// ---------------------------------------------------------------------------

function assertValidBundle(bundle: LibraryShimBundle, minComponentCount: number) {
  expect(bundle).not.toBeNull();
  expect(typeof bundle.shimSource).toBe('string');
  expect(typeof bundle.cssVars).toBe('string');
  expect(typeof bundle.displayName).toBe('string');
  expect(typeof bundle.componentCount).toBe('number');
  expect(bundle.componentCount).toBeGreaterThanOrEqual(minComponentCount);
  expect(bundle.displayName.length).toBeGreaterThan(0);
}

// ---------------------------------------------------------------------------
// getLibraryShims — known libraries
// ---------------------------------------------------------------------------

describe('getLibraryShims — shadcn', () => {
  it('returns a non-null bundle', () => {
    const bundle = getLibraryShims('shadcn');
    expect(bundle).not.toBeNull();
  });

  it('has componentCount >= 15', () => {
    const bundle = getLibraryShims('shadcn')!;
    assertValidBundle(bundle, 15);
  });

  it('displayName is "shadcn/ui"', () => {
    expect(getLibraryShims('shadcn')!.displayName).toBe('shadcn/ui');
  });

  it('shimSource contains window. assignments', () => {
    const { shimSource } = getLibraryShims('shadcn')!;
    expect(shimSource).toContain('window.');
  });

  it('shimSource contains window.Card', () => {
    const { shimSource } = getLibraryShims('shadcn')!;
    expect(shimSource).toContain('window.Card');
  });

  it('shimSource contains window.Button', () => {
    const { shimSource } = getLibraryShims('shadcn')!;
    expect(shimSource).toContain('window.Button');
  });

  it('shimSource contains window.Badge', () => {
    const { shimSource } = getLibraryShims('shadcn')!;
    expect(shimSource).toContain('window.Badge');
  });

  it('shimSource contains window.Alert', () => {
    const { shimSource } = getLibraryShims('shadcn')!;
    expect(shimSource).toContain('window.Alert');
  });

  it('cssVars contains :root {', () => {
    const { cssVars } = getLibraryShims('shadcn')!;
    expect(cssVars).toContain(':root {');
  });

  it('cssVars contains --background', () => {
    const { cssVars } = getLibraryShims('shadcn')!;
    expect(cssVars).toContain('--background');
  });

  it('cssVars contains --primary', () => {
    const { cssVars } = getLibraryShims('shadcn')!;
    expect(cssVars).toContain('--primary');
  });

  it('cssVars contains --radius', () => {
    const { cssVars } = getLibraryShims('shadcn')!;
    expect(cssVars).toContain('--radius');
  });
});

describe('getLibraryShims — mui', () => {
  it('returns a non-null bundle', () => {
    expect(getLibraryShims('mui')).not.toBeNull();
  });

  it('has componentCount >= 12', () => {
    assertValidBundle(getLibraryShims('mui')!, 12);
  });

  it('displayName is "Material UI"', () => {
    expect(getLibraryShims('mui')!.displayName).toBe('Material UI');
  });

  it('shimSource contains window. assignments', () => {
    expect(getLibraryShims('mui')!.shimSource).toContain('window.');
  });

  it('shimSource contains window.Button', () => {
    expect(getLibraryShims('mui')!.shimSource).toContain('window.Button');
  });

  it('shimSource contains window.Card', () => {
    expect(getLibraryShims('mui')!.shimSource).toContain('window.Card');
  });

  it('shimSource contains window.Typography', () => {
    expect(getLibraryShims('mui')!.shimSource).toContain('window.Typography');
  });

  it('shimSource contains window.TextField', () => {
    expect(getLibraryShims('mui')!.shimSource).toContain('window.TextField');
  });

  it('shimSource contains window.Stack', () => {
    expect(getLibraryShims('mui')!.shimSource).toContain('window.Stack');
  });

  it('shimSource contains window.Alert', () => {
    expect(getLibraryShims('mui')!.shimSource).toContain('window.Alert');
  });

  it('shimSource contains window.Avatar', () => {
    expect(getLibraryShims('mui')!.shimSource).toContain('window.Avatar');
  });

  it('shimSource contains window.Chip', () => {
    expect(getLibraryShims('mui')!.shimSource).toContain('window.Chip');
  });

  it('cssVars contains :root {', () => {
    expect(getLibraryShims('mui')!.cssVars).toContain(':root {');
  });

  it('cssVars contains --mui-primary', () => {
    expect(getLibraryShims('mui')!.cssVars).toContain('--mui-primary');
  });
});

describe('getLibraryShims — primeng', () => {
  it('returns a non-null bundle', () => {
    expect(getLibraryShims('primeng')).not.toBeNull();
  });

  it('has componentCount >= 10', () => {
    assertValidBundle(getLibraryShims('primeng')!, 10);
  });

  it('displayName is "PrimeNG"', () => {
    expect(getLibraryShims('primeng')!.displayName).toBe('PrimeNG');
  });

  it('shimSource contains window. assignments', () => {
    expect(getLibraryShims('primeng')!.shimSource).toContain('window.');
  });

  it('shimSource contains window.Button', () => {
    expect(getLibraryShims('primeng')!.shimSource).toContain('window.Button');
  });

  it('shimSource contains window.Card', () => {
    expect(getLibraryShims('primeng')!.shimSource).toContain('window.Card');
  });

  it('shimSource contains window.DataTable', () => {
    expect(getLibraryShims('primeng')!.shimSource).toContain('window.DataTable');
  });

  it('shimSource contains window.Message', () => {
    expect(getLibraryShims('primeng')!.shimSource).toContain('window.Message');
  });

  it('shimSource contains window.Dropdown', () => {
    expect(getLibraryShims('primeng')!.shimSource).toContain('window.Dropdown');
  });

  it('cssVars contains :root {', () => {
    expect(getLibraryShims('primeng')!.cssVars).toContain(':root {');
  });

  it('cssVars contains --p-primary-color', () => {
    expect(getLibraryShims('primeng')!.cssVars).toContain('--p-primary-color');
  });
});

// ---------------------------------------------------------------------------
// getLibraryShims — unknown / null / tailwind fallback
// ---------------------------------------------------------------------------

describe('getLibraryShims — fallback cases', () => {
  it('returns null for "tailwind" (no component library)', () => {
    expect(getLibraryShims('tailwind')).toBeNull();
  });

  it('returns null for null', () => {
    expect(getLibraryShims(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getLibraryShims(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getLibraryShims('')).toBeNull();
  });

  it('returns null for unknown library "bootstrap"', () => {
    expect(getLibraryShims('bootstrap')).toBeNull();
  });

  it('returns null for unknown library "antd"', () => {
    expect(getLibraryShims('antd')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getGenericShims
// ---------------------------------------------------------------------------

describe('getGenericShims', () => {
  it('returns a non-null bundle', () => {
    expect(getGenericShims()).not.toBeNull();
  });

  it('has componentCount >= 9', () => {
    assertValidBundle(getGenericShims(), 9);
  });

  it('displayName is "Generic"', () => {
    expect(getGenericShims().displayName).toBe('Generic');
  });

  it('shimSource contains window.Badge', () => {
    expect(getGenericShims().shimSource).toContain('window.Badge');
  });

  it('shimSource contains window.Button', () => {
    expect(getGenericShims().shimSource).toContain('window.Button');
  });

  it('shimSource contains window.Heading', () => {
    expect(getGenericShims().shimSource).toContain('window.Heading');
  });

  it('shimSource contains window.TextField', () => {
    expect(getGenericShims().shimSource).toContain('window.TextField');
  });

  it('shimSource contains window.SwitchToggle', () => {
    expect(getGenericShims().shimSource).toContain('window.SwitchToggle');
  });

  it('shimSource contains window.SelectField', () => {
    expect(getGenericShims().shimSource).toContain('window.SelectField');
  });

  it('shimSource contains window.IconButton', () => {
    expect(getGenericShims().shimSource).toContain('window.IconButton');
  });

  it('shimSource contains window.Stack', () => {
    expect(getGenericShims().shimSource).toContain('window.Stack');
  });

  it('shimSource contains window.Input', () => {
    expect(getGenericShims().shimSource).toContain('window.Input');
  });

  it('shimSource contains window. assignments', () => {
    expect(getGenericShims().shimSource).toContain('window.');
  });

  it('cssVars is empty string (no library-specific vars)', () => {
    expect(getGenericShims().cssVars).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getRegisteredLibraries
// ---------------------------------------------------------------------------

describe('getRegisteredLibraries', () => {
  it('returns an array of strings', () => {
    const libs = getRegisteredLibraries();
    expect(Array.isArray(libs)).toBe(true);
    libs.forEach(l => expect(typeof l).toBe('string'));
  });

  it('includes "shadcn"', () => {
    expect(getRegisteredLibraries()).toContain('shadcn');
  });

  it('includes "mui"', () => {
    expect(getRegisteredLibraries()).toContain('mui');
  });

  it('includes "primeng"', () => {
    expect(getRegisteredLibraries()).toContain('primeng');
  });

  it('does not include "tailwind"', () => {
    expect(getRegisteredLibraries()).not.toContain('tailwind');
  });

  it('does not include "generic"', () => {
    expect(getRegisteredLibraries()).not.toContain('generic');
  });

  it('has 3 entries', () => {
    expect(getRegisteredLibraries().length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Cross-bundle structural checks
// ---------------------------------------------------------------------------

describe('cross-bundle structural guarantees', () => {
  const ALL_LIBRARIES = ['shadcn', 'mui', 'primeng'] as const;

  it.each(ALL_LIBRARIES)('%s shimSource is non-empty', (lib) => {
    const bundle = getLibraryShims(lib)!;
    expect(bundle.shimSource.length).toBeGreaterThan(100);
  });

  it.each(ALL_LIBRARIES)('%s shimSource uses React.createElement', (lib) => {
    const bundle = getLibraryShims(lib)!;
    expect(bundle.shimSource).toContain('React.createElement');
  });

  it.each(ALL_LIBRARIES)('%s shimSource has no import statements', (lib) => {
    const bundle = getLibraryShims(lib)!;
    // shim files must be dependency-free for use in new Function()
    expect(bundle.shimSource).not.toMatch(/^import\s/m);
  });

  it.each(ALL_LIBRARIES)('%s cssVars is non-empty', (lib) => {
    const bundle = getLibraryShims(lib)!;
    expect(bundle.cssVars.length).toBeGreaterThan(0);
  });

  it.each(ALL_LIBRARIES)('%s componentCount matches actual window. assignments', (lib) => {
    const bundle = getLibraryShims(lib)!;
    // Count `window.X = function` patterns as a proxy for shim count
    const matches = bundle.shimSource.match(/window\.\w+ = function/g) || [];
    // Allow componentCount to be <= actual assignments (some components share families)
    expect(matches.length).toBeGreaterThanOrEqual(bundle.componentCount);
  });
});
