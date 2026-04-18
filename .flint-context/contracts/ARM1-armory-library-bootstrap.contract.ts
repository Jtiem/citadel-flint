/**
 * ARM.1 — Armory Library Bootstrap
 * Executable Contract
 *
 * Phase 2 agents import these types to ensure implementation matches
 * the contract specification exactly. This file must compile cleanly
 * with `npx tsc --noEmit`.
 *
 * Problem: flint_set_library seeds tokens but not components. Mason
 * generates MUI code, then Armory blocks it with REG-001 for every
 * MUI primitive. ARM.1 auto-seeds library component manifests and
 * teaches REG-001 to trust them.
 */

import type { FlintContract } from '../../shared/contract-schema.js';

// ─── Part B: ComponentEntry.source expansion ───────────────────────

/**
 * The full source union after ARM.1.
 * registryService.ts must update ComponentEntry.source to match.
 */
export type ComponentSource = 'local' | 'remote' | 'library';

// ─── Part A: Manifest entry shape ──────────────────────────────────

/**
 * Minimal shape returned by LibraryAdapter.getComponentManifest().
 * Each entry represents a library primitive that Armory should trust.
 *
 * Adapters MAY include optional fields (description, props, variants)
 * but MUST include name, importPath, and source: 'library'.
 */
export interface ManifestEntry {
  /** PascalCase component name (e.g., "Box", "Typography") */
  name: string;
  /** Full import path (e.g., "@mui/material/Box") */
  importPath: string;
  /** Must always be 'library' for adapter-seeded entries */
  source: 'library';
  /** Brief component description (optional) */
  description?: string;
}

/**
 * The method signature to add to LibraryAdapter (in types.ts).
 * Pure function — no I/O. Returns static, bundled manifest data.
 *
 * IMPORTANT FOR PHASE 2 AGENTS:
 * The actual method on the LibraryAdapter interface must be typed as:
 *   getComponentManifest(): ComponentEntry[]
 * where ComponentEntry is imported from '../registryService.js'.
 * ManifestEntry (above) is structurally compatible with ComponentEntry
 * once source union is expanded — use it only for test assertions.
 * Do NOT type the LibraryAdapter method as ManifestEntry[] or you will
 * need an `as any` cast at the setLibrary.ts call site.
 */
export type GetComponentManifest = () => ManifestEntry[];

// ─── Manifest count thresholds (test assertions) ──────────────────

/** MUI: ~55 primary exports (Box through TableCell) */
export const MUI_MANIFEST_MIN_COUNT = 55;

/** shadcn/ui: ~20 core components (Button, Card, Dialog, etc.) */
export const SHADCN_MANIFEST_MIN_COUNT = 20;

/** PrimeNG/PrimeReact: ~15 core components (Button, DataTable, etc.) */
export const PRIMENG_MANIFEST_MIN_COUNT = 15;

/** Tailwind: utility-first, no PascalCase components. Must return []. */
export const TAILWIND_MANIFEST_MIN_COUNT = 0;

// ─── setLibrary integration ───────────────────────────────────────

/**
 * Extended result shape for flint_set_library after ARM.1.
 * The existing handler returns text content; this describes the
 * data that must now be included in the response text.
 */
export interface SetLibraryResult {
  /** Library that was set (e.g., "mui") */
  library: string;
  /** Number of tokens seeded (existing behavior) */
  tokensSeeded: number;
  /** Number of component entries seeded (new in ARM.1) */
  componentsSeeded: number;
  /** Human-readable summary message */
  message: string;
}

// ─── Test boundaries ──────────────────────────────────────────────

export const TEST_BOUNDARIES = [
  'MUI getComponentManifest returns >= 55 entries, each with name + importPath + source:library',
  'shadcn getComponentManifest returns non-empty manifest with all source:library',
  'primeng getComponentManifest returns non-empty manifest with all source:library',
  'tailwind getComponentManifest returns empty array',
  'flint_set_library mui seeds Box into registry cache',
  'Seeding is idempotent — calling twice does not duplicate entries',
  'Library entry does not overwrite local entry with same name',
  'REG-001 does NOT fire for source:library entries',
  'REG-001 DOES fire for unknown components even when library is set',
  'REG-001 DOES fire when registry is empty (existing behavior preserved)',
] as const;

// ─── Machine-readable contract ────────────────────────────────────

export const CONTRACT: FlintContract = {
  meta: {
    name: 'ARM.1-ArmoryLibraryBootstrap',
    phase: 'ARM.1',
    status: 'APPROVED',
    owner: 'flint-architect',
    date: '2026-04-16',
  },

  impact: [
    {
      file: 'flint-mcp/src/core/libraryAdapters/types.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: 'Add getComponentManifest() to LibraryAdapter interface',
    },
    {
      file: 'flint-mcp/src/core/registryService.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: "Add 'library' to ComponentEntry.source union",
    },
    {
      file: 'flint-mcp/src/core/libraryAdapters/muiAdapter.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: 'Implement getComponentManifest() with ~55 MUI entries',
    },
    {
      file: 'flint-mcp/src/core/libraryAdapters/shadcnAdapter.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: 'Implement getComponentManifest() with shadcn entries',
    },
    {
      file: 'flint-mcp/src/core/libraryAdapters/primeAdapter.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: 'Implement getComponentManifest() with PrimeNG entries',
    },
    {
      file: 'flint-mcp/src/core/libraryAdapters/tailwindAdapter.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: 'Implement getComponentManifest() returning empty array',
    },
    {
      file: 'flint-mcp/src/tools/setLibrary.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: 'Call getComponentManifest() and seed registry + manifest',
    },
    {
      file: 'flint-mcp/src/core/MithrilLinter.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: 'Skip REG-001 for source:library entries in visitRegistryUsage',
    },
    {
      file: 'flint-mcp/src/core/errorTaxonomy.ts',
      changeType: 'MODIFY',
      owner: 'flint-ast-surgeon',
      summary: 'Update REG-001 explanation to mention library trust',
    },
  ],

  // No IPC channels — entirely within flint-mcp process
  ipc: [],

  // No Zustand store changes
  stores: [],

  // No React component changes
  components: [],

  // Applicable Commandments
  commandments: [4, 6, 13],

  testBoundaries: [
    {
      target: 'MuiAdapter.getComponentManifest',
      kind: 'service',
      behavior: 'Returns >= 55 MUI component entries',
      assertion: 'Each entry has name (string), importPath (string), source === "library"',
      edgeCases: [
        'All entries have unique names',
        'Import paths follow @mui/material/<Name> pattern',
      ],
    },
    {
      target: 'ShadcnAdapter.getComponentManifest',
      kind: 'service',
      behavior: 'Returns non-empty shadcn component manifest',
      assertion: 'Count > 0, all entries have source === "library"',
      edgeCases: ['Import paths reference correct shadcn package'],
    },
    {
      target: 'PrimengAdapter.getComponentManifest',
      kind: 'service',
      behavior: 'Returns non-empty PrimeNG/PrimeReact component manifest',
      assertion: 'Count > 0, all entries have source === "library"',
      edgeCases: ['Import paths reference correct primereact package'],
    },
    {
      target: 'TailwindAdapter.getComponentManifest',
      kind: 'service',
      behavior: 'Returns empty array (utility-first, no PascalCase components)',
      assertion: 'Length === 0',
      edgeCases: [],
    },
    {
      target: 'handleSetLibrary',
      kind: 'service',
      behavior: 'Seeds library components into registry after setting library',
      assertion: 'Registry cache contains "Box" after flint_set_library mui',
      edgeCases: [
        'Seeding is idempotent — calling twice does not duplicate entries',
        'Library entry does not overwrite local entry with same name',
        'componentsSeeded count is reported in response text',
      ],
    },
    {
      target: 'visitRegistryUsage',
      kind: 'service',
      behavior: 'REG-001 does NOT fire for source:library entries',
      assertion: 'Zero REG-001 warnings on MUI JSX when library is registered',
      edgeCases: [
        'REG-001 DOES fire for unknown components even when library is set',
        'REG-001 DOES fire when registry is empty (existing behavior preserved)',
        'Member expressions like <Dialog.Title> resolve root to registry',
      ],
    },
  ],

  risks: [
    {
      risk: 'Manifest list goes stale as libraries release new components',
      severity: 'low',
      mitigation: 'Manifests cover primary exports only. Users add extras via flint_add_remote_library.',
    },
    {
      risk: 'Idempotency bug causes duplicate registry entries',
      severity: 'medium',
      commandment: 6,
      mitigation: 'Test boundary #6 explicitly covers this. Key by name + source.',
    },
    {
      risk: 'Library entries pollute flint_query_registry results for teams wanting only local components',
      severity: 'low',
      mitigation: 'Follow-up: add source filter parameter to flint_query_registry.',
    },
  ],

  parallelismGroups: {
    A: ['flint-ast-surgeon'],
    B: ['flint-ast-surgeon'],
  },

  nonGoals: [
    'Network-fetched manifests — all data is static and bundled',
    'Library version detection (MUI v5 vs v6) — future enhancement',
    'Modifying flint_query_registry filtering — follow-up task',
    'Triggering library re-seed from flint_reindex_registry — follow-up task',
    'Glass UI changes — REG-001 results simply stop appearing for library components',
  ],
};
