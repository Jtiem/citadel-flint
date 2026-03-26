import genericSource from './generic.js?raw';
import shadcnSource from './shadcn.js?raw';
import muiSource from './mui.js?raw';
import primengSource from './primeng.js?raw';

/**
 * A library's preview shim bundle.
 * Both fields are raw JavaScript/CSS strings ready to inject into srcdoc.
 */
export interface LibraryShimBundle {
  /**
   * Plain JavaScript that assigns component functions to `window.*`.
   * Uses React.createElement (React is a UMD global in srcdoc).
   * Example: `window.Card = function({ className, children }) { ... }`
   */
  shimSource: string;

  /**
   * CSS custom properties block defining the library's design variables.
   * Example: `:root { --background: 0 0% 100%; --foreground: 222.2 84% 4.9%; }`
   */
  cssVars: string;

  /** Human-readable library name for debug/logging. */
  displayName: string;

  /** Number of components shimmed. */
  componentCount: number;
}

// CSS vars are embedded in each shim file as window.__FLINT_*_CSS constants.
// We extract them here rather than duplicating strings.

const SHADCN_CSS = `:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}`;

const MUI_CSS = `:root {
  --mui-primary: #1976d2;
  --mui-primary-light: #42a5f5;
  --mui-primary-dark: #1565c0;
  --mui-secondary: #9c27b0;
  --mui-error: #d32f2f;
  --mui-warning: #ed6c02;
  --mui-info: #0288d1;
  --mui-success: #2e7d32;
  --mui-background: #fff;
  --mui-surface: #fff;
  --mui-text-primary: rgba(0,0,0,.87);
  --mui-text-secondary: rgba(0,0,0,.6);
  --mui-divider: rgba(0,0,0,.12);
}
* { box-sizing: border-box; }
body { font-family: "Roboto","Helvetica","Arial",sans-serif; }`;

const PRIMENG_CSS = `:root {
  --p-primary-color: #6366f1;
  --p-primary-contrast-color: #fff;
  --p-primary-hover-color: #4f46e5;
  --p-surface-0: #fff;
  --p-surface-50: #f8fafc;
  --p-surface-100: #f1f5f9;
  --p-surface-200: #e2e8f0;
  --p-surface-300: #cbd5e1;
  --p-surface-400: #94a3b8;
  --p-surface-500: #64748b;
  --p-surface-600: #475569;
  --p-surface-700: #334155;
  --p-surface-800: #1e293b;
  --p-surface-900: #0f172a;
  --p-surface-950: #020617;
  --p-text-color: #334155;
  --p-text-muted-color: #64748b;
  --p-border-radius: 6px;
}`;

const GENERIC_CSS = '';

/** Registry mapping library target names to their shim bundles. */
const SHIM_REGISTRY: Record<string, LibraryShimBundle> = {
  shadcn: {
    shimSource: shadcnSource,
    cssVars: SHADCN_CSS,
    displayName: 'shadcn/ui',
    componentCount: 15,
  },
  mui: {
    shimSource: muiSource,
    cssVars: MUI_CSS,
    displayName: 'Material UI',
    componentCount: 12,
  },
  primeng: {
    shimSource: primengSource,
    cssVars: PRIMENG_CSS,
    displayName: 'PrimeNG',
    componentCount: 10,
  },
};

/**
 * Returns the shim bundle for a given library target.
 * Returns null if no shims exist for the library (falls back to generic stubs).
 */
export function getLibraryShims(library: string | null | undefined): LibraryShimBundle | null {
  if (!library) return null;
  return SHIM_REGISTRY[library] ?? null;
}

/**
 * Returns the generic (library-agnostic) shim bundle.
 * This is the current set of stubs (Badge, Button, etc.) extracted from LivePreview.
 * Always available as the base layer; library shims are additive.
 */
export function getGenericShims(): LibraryShimBundle {
  return {
    shimSource: genericSource,
    cssVars: GENERIC_CSS,
    displayName: 'Generic',
    componentCount: 9,
  };
}

/**
 * Returns all known library keys (for tooling and debug purposes).
 */
export function getRegisteredLibraries(): string[] {
  return Object.keys(SHIM_REGISTRY);
}
