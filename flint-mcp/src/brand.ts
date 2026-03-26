/**
 * Single source of truth for all brand strings (MCP engine copy).
 * Keep in sync with /shared/brand.ts — or change these values to rename the product.
 */

export const BRAND = {
  /** Product name — the governance engine */
  product: 'Flint',
  /** Viewer name — the Electron observability layer */
  viewer: 'Glass',
  /** Linter name — the design system linter */
  linter: 'Mithril',

  /** Lowercase product name (identifiers, file paths) */
  productLower: 'flint',

  /** Full app title */
  appTitle: 'Flint Glass',
  /** Full viewer title */
  viewerTitle: 'Flint Glass',

  /** MCP tool name prefix (e.g., "flint_audit") */
  toolPrefix: 'flint_',
  /** MCP resource URI scheme (e.g., "flint://tokens") */
  uriScheme: 'flint://',
  /** IPC channel prefix (e.g., "flint:mcp-event") */
  ipcPrefix: 'flint:',
  /** Data attribute name for AST node IDs */
  dataIdAttr: 'data-flint-id',
  /** Console log prefix */
  logPrefix: '[Flint]',

  /** User-project config directory (e.g., ".flint/") */
  configDir: '.flint',
  /** Manifest filename */
  manifestFile: 'flint-manifest.json',
  /** Registry database filename */
  registryDb: 'flint-registry.db',

  /** Environment variable prefix */
  envPrefix: 'FLINT_',
  /** HTTP header for Figma plugin auth */
  secretHeader: 'x-flint-secret',

  /** Window.* API surface name */
  apiName: 'flintAPI',
} as const;

/** Helper: build a tool name like "flint_audit" */
export const toolName = (name: string) => `${BRAND.toolPrefix}${name}` as const;

/** Helper: build a resource URI like "flint://tokens" */
export const resourceUri = (path: string) => `${BRAND.uriScheme}${path}` as const;

/** Helper: build an IPC channel like "flint:mcp-event" */
export const ipcChannel = (name: string) => `${BRAND.ipcPrefix}${name}` as const;

/** Helper: build a log prefix like "[Flint CK.1]" */
export const logTag = (sub?: string) => sub ? `[${BRAND.product} ${sub}]` : BRAND.logPrefix;

/** Helper: build a config path like ".flint/design-tokens.json" */
export const configPath = (file: string) => `${BRAND.configDir}/${file}`;

/** Helper: build an env var like "FLINT_PROJECT_ROOT" */
export const envVar = (name: string) => `${BRAND.envPrefix}${name}` as const;

export type BrandConfig = typeof BRAND;
