/**
 * registryOverlay — Unit Tests
 *
 * Covers: mergeTeamRegistryOverlay (CRIT C5a deep-merge compositionRules,
 * CRIT C5b require importPath on new entries), sourceId stamping (M3),
 * and detectRegistryConflicts helper (M3).
 *
 * NOTE: Some tests are marked it.todo() because they depend on Group B
 * implementing the deep-merge and sourceId features in registryService.ts.
 * The scaffolds compile today because they only import existing types.
 *
 * Sprint 5 contract ref: .flint-context/contracts/sprint-5-registry-rag.contract.ts
 */

import { describe, it, expect } from 'vitest';
import {
    mergeTeamRegistryOverlay,
    queryRegistry,
    detectRegistryConflicts,
    RegistryMergeError,
    type ComponentEntry,
    type TeamRegistryOverlayInput,
    type RegistryConflictReport,
} from '../registryService.js';

// Import contract types for type-safety in assertions
import type {
    RegistryConflictReport,
    RegistrySourceId,
    REGISTRY_SCORE_WEIGHTS,
} from '../../../../.flint-context/contracts/sprint-5-registry-rag.contract.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_BUTTON: ComponentEntry = {
    name: 'Button',
    importPath: '@/components/Button',
    description: 'Primary action button',
    variants: ['primary', 'secondary', 'destructive'],
    tokens: ['color.primary', 'color.surface'],
    compositionRules: {
        allowedChildren: ['Icon', 'Spinner'],
        maxDepth: 2,
    },
};

const BASE_CARD: ComponentEntry = {
    name: 'Card',
    importPath: '@/components/Card',
    description: 'Layout card container',
    compositionRules: {
        allowedChildren: ['CardHeader', 'CardBody', 'CardFooter'],
        maxDepth: 3,
    },
};

const BASE_REGISTRY: Record<string, ComponentEntry> = {
    Button: BASE_BUTTON,
    Card: BASE_CARD,
};

// ── mergeTeamRegistryOverlay — basic contract ─────────────────────────────────

describe('mergeTeamRegistryOverlay — basic contract', () => {
    it('returns a new object (not the same reference as base)', () => {
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, undefined);
        expect(result).not.toBe(BASE_REGISTRY);
    });

    it('returns shallow copy of base when overlay is undefined', () => {
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, undefined);
        expect(Object.keys(result)).toEqual(expect.arrayContaining(['Button', 'Card']));
        expect(result['Button'].importPath).toBe('@/components/Button');
    });

    it('returns shallow copy when overlay has no addEntries or importOverrides', () => {
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, {});
        expect(result).not.toBe(BASE_REGISTRY);
        expect(Object.keys(result)).toEqual(expect.arrayContaining(['Button', 'Card']));
    });

    it('does not mutate the base registry', () => {
        const snapshot = JSON.parse(JSON.stringify(BASE_REGISTRY));
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                NewComp: { importPath: '@/NewComp' },
            },
        };
        mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        expect(BASE_REGISTRY).toEqual(snapshot);
    });
});

// ── CRIT C5b: importPath required for new entries ─────────────────────────────

describe('mergeTeamRegistryOverlay — C5b: require importPath for net-new entries', () => {
    it('addEntries with missing importPath throws with clear error', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                NewWidget: { description: 'no import path' },
            },
        };
        expect(() => mergeTeamRegistryOverlay(BASE_REGISTRY, overlay)).toThrow(RegistryMergeError);
    });

    it('error message format contains the entry name', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                FancyPanel: { description: 'still no import path' },
            },
        };
        expect(() => mergeTeamRegistryOverlay(BASE_REGISTRY, overlay)).toThrow(/FancyPanel/);
    });

    it('addEntries WITH importPath succeeds and entry appears in result', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Toast: { importPath: '@/components/Toast', description: 'Toast notification' },
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        expect(result['Toast']).toBeDefined();
        expect(result['Toast'].importPath).toBe('@/components/Toast');
    });

    it('updating an EXISTING entry without importPath inherits importPath from prev', () => {
        // Button already exists in the registry with importPath '@/components/Button'
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Button: {
                    description: 'Updated description — no new importPath provided',
                },
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        // importPath must be inherited from the existing entry
        expect(result['Button'].importPath).toBe('@/components/Button');
        expect(result['Button'].description).toBe('Updated description — no new importPath provided');
    });

    it('importOverrides applied after addEntries — overrides win over addEntries importPath', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Modal: { importPath: '@/components/Modal', description: 'Modal dialog' },
            },
            importOverrides: {
                Modal: '@/redesign/Modal',
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        expect(result['Modal'].importPath).toBe('@/redesign/Modal');
    });

    it('importOverrides can override existing base entries', () => {
        const overlay: TeamRegistryOverlayInput = {
            importOverrides: {
                Button: '@/v2/Button',
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        expect(result['Button'].importPath).toBe('@/v2/Button');
    });

    it('importOverrides for non-existent key is silently ignored', () => {
        const overlay: TeamRegistryOverlayInput = {
            importOverrides: {
                Nonexistent: '@/somewhere',
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        expect(result['Nonexistent']).toBeUndefined();
    });
});

// ── CRIT C5a: deep-merge compositionRules ────────────────────────────────────

describe('mergeTeamRegistryOverlay — C5a: deep-merge compositionRules', () => {
    it('base { allowedChildren, maxDepth } + overlay { forbiddenChildren } = all three fields', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Button: {
                    compositionRules: {
                        forbiddenChildren: ['InputGroup'],
                    },
                },
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        const rules = result['Button'].compositionRules!;
        expect(rules.allowedChildren).toEqual(['Icon', 'Spinner']);
        expect(rules.maxDepth).toBe(2);
        expect(rules.forbiddenChildren).toEqual(['InputGroup']);
    });

    it('overlay can explicitly replace allowedChildren (override semantics, not append)', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Button: {
                    compositionRules: {
                        allowedChildren: ['Badge'],
                    },
                },
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        const rules = result['Button'].compositionRules!;
        expect(rules.allowedChildren).toEqual(['Badge']);
        expect(rules.maxDepth).toBe(2); // preserved from base
    });

    it('when overlay omits compositionRules entirely, base compositionRules are preserved unchanged', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Button: {
                    description: 'Updated description only',
                },
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        const rules = result['Button'].compositionRules!;
        expect(rules.allowedChildren).toEqual(['Icon', 'Spinner']);
        expect(rules.maxDepth).toBe(2);
    });

    it('overlay compositionRules with all four fields fully replaces each field independently', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Card: {
                    compositionRules: {
                        allowedChildren: ['NewBody'],
                        forbiddenChildren: ['OldFooter'],
                        requiredParent: 'Page',
                        maxDepth: 1,
                    },
                },
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        const rules = result['Card'].compositionRules!;
        expect(rules.allowedChildren).toEqual(['NewBody']);
        expect(rules.forbiddenChildren).toEqual(['OldFooter']);
        expect(rules.requiredParent).toBe('Page');
        expect(rules.maxDepth).toBe(1);
    });

    // Regression guard: after C5a fix, deep merge preserves base fields
    it('post-C5a: deep merge preserves base compositionRules fields when overlay adds new fields', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Button: {
                    compositionRules: {
                        forbiddenChildren: ['InputGroup'],
                    },
                },
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        const rules = result['Button'].compositionRules!;
        // C5a fix: allowedChildren and maxDepth survive from base
        expect(rules.allowedChildren).toEqual(['Icon', 'Spinner']);
        expect(rules.maxDepth).toBe(2);
        expect(rules.forbiddenChildren).toEqual(['InputGroup']);
    });
});

// ── M3: sourceId stamping ─────────────────────────────────────────────────────

describe('mergeTeamRegistryOverlay — M3: sourceId stamping', () => {
    it('addEntries stamps sourceId = "team-overlay" on new entries', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Toast: { importPath: '@/Toast', description: 'Toast notification' },
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        expect(result['Toast'].sourceId).toBe('team-overlay');
    });

    it('existing base entries without sourceId are left unchanged', () => {
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Toast: { importPath: '@/Toast' },
            },
        };
        const result = mergeTeamRegistryOverlay(BASE_REGISTRY, overlay);
        // Button was in base without sourceId and was not touched by overlay
        expect(result['Button'].sourceId).toBeUndefined();
    });
});

// ── M3: detectRegistryConflicts ───────────────────────────────────────────────

describe('detectRegistryConflicts', () => {
    it('same component name from two different sourceIds returns a RegistryConflictReport entry', () => {
        const existing: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/Button', sourceId: 'local-manifest' },
        };
        const incoming: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/v2/Button', sourceId: 'remote:acme' },
        };
        const conflicts = detectRegistryConflicts(existing, incoming);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].name).toBe('Button');
    });

    it('same component name from same sourceId produces no conflict', () => {
        const existing: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/Button', sourceId: 'local-manifest' },
        };
        const incoming: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/Button-v2', sourceId: 'local-manifest' },
        };
        const conflicts = detectRegistryConflicts(existing, incoming);
        expect(conflicts).toHaveLength(0);
    });

    it('missing sourceId on either side does not throw', () => {
        const existing: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/Button' },
        };
        const incoming: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/v2/Button', sourceId: 'remote:acme' },
        };
        expect(() => detectRegistryConflicts(existing, incoming)).not.toThrow();
        const conflicts = detectRegistryConflicts(existing, incoming);
        expect(conflicts).toHaveLength(1); // undefined !== 'remote:acme'
    });

    it('returns empty array when no conflicts exist', () => {
        const existing: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/Button', sourceId: 'local-manifest' },
        };
        const incoming: Record<string, ComponentEntry> = {
            Card: { name: 'Card', importPath: '@/Card', sourceId: 'remote:acme' },
        };
        const conflicts = detectRegistryConflicts(existing, incoming);
        expect(conflicts).toHaveLength(0);
    });

    it('conflict report shape matches RegistryConflictReport', () => {
        const existing: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/Button', sourceId: 'local-manifest' },
        };
        const incoming: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/v2/Button', sourceId: 'remote:acme' },
        };
        const conflicts = detectRegistryConflicts(existing, incoming);
        const report: RegistryConflictReport = conflicts[0];
        expect(report).toHaveProperty('name');
        expect(report).toHaveProperty('existingSourceId');
        expect(report).toHaveProperty('incomingSourceId');
        expect(report.existingSourceId).toBe('local-manifest');
        expect(report.incomingSourceId).toBe('remote:acme');
    });
});

// ── M1: field-weighted scoring ────────────────────────────────────────────────

describe('queryRegistry — M1: field-weighted scoring', () => {
    // These tests validate the CURRENT unweighted behavior and then assert
    // the ranking contract from the contract's REGISTRY_SCORE_WEIGHTS.
    // After Group B implements M1, the todos become real assertions.

    it('name match (weight 5) scores strictly higher than compositionNotes match (weight 1)', () => {
        const REGISTRY: Record<string, ComponentEntry> = {
            Avatar: {
                name: 'Avatar',
                importPath: '@/Avatar',
            },
            ProfileWrapper: {
                name: 'ProfileWrapper',
                importPath: '@/ProfileWrapper',
                compositionNotes: 'Use with an avatar for best results',
            },
        };
        const results = queryRegistry(REGISTRY, 'avatar');
        expect(results[0].name).toBe('Avatar');
    });

    it('description match (weight 3) scores strictly higher than token match (weight 1)', () => {
        const REGISTRY: Record<string, ComponentEntry> = {
            ThemeCard: {
                name: 'ThemeCard',
                importPath: '@/ThemeCard',
                description: 'Displays primary content',
            },
            ColorSwatch: {
                name: 'ColorSwatch',
                importPath: '@/ColorSwatch',
                tokens: ['color.primary'],
            },
        };
        const results = queryRegistry(REGISTRY, 'primary');
        expect(results[0].name).toBe('ThemeCard');
    });

    it('tie-break is alphabetical by name when scores are equal', () => {
        const REGISTRY: Record<string, ComponentEntry> = {
            Bravo: {
                name: 'Bravo',
                importPath: '@/Bravo',
                description: 'widget component',
            },
            Alpha: {
                name: 'Alpha',
                importPath: '@/Alpha',
                description: 'widget component',
            },
        };
        const results = queryRegistry(REGISTRY, 'widget');
        expect(results[0].name).toBe('Alpha');
        expect(results[1].name).toBe('Bravo');
    });

    it('deterministic ordering across multiple calls with same input', () => {
        const REGISTRY: Record<string, ComponentEntry> = {
            Button: { name: 'Button', importPath: '@/Button', description: 'action' },
            Card: { name: 'Card', importPath: '@/Card', description: 'action layout' },
        };
        const r1 = queryRegistry(REGISTRY, 'action');
        const r2 = queryRegistry(REGISTRY, 'action');
        expect(r1.map(e => e.name)).toEqual(r2.map(e => e.name));
    });

    // Validate that the CURRENT scoring already puts name matches first
    it('currently: component whose name contains query ranks before description-only match', () => {
        const REGISTRY: Record<string, ComponentEntry> = {
            // "Button" name contains "button" — strong match
            Button: {
                name: 'Button',
                importPath: '@/Button',
                description: 'A clickable element',
            },
            // "ActionTrigger" — only description mentions "button"
            ActionTrigger: {
                name: 'ActionTrigger',
                importPath: '@/ActionTrigger',
                description: 'Serves as a button-like action trigger',
            },
        };

        const results = queryRegistry(REGISTRY, 'button');
        expect(results.length).toBeGreaterThan(0);
        // Button's name is an exact match — it should score higher
        expect(results[0].name).toBe('Button');
    });

    it('single-word query: name match beats notes-only match', () => {
        const REGISTRY: Record<string, ComponentEntry> = {
            Avatar: {
                name: 'Avatar',
                importPath: '@/Avatar',
                description: 'User profile picture',
            },
            ProfileWrapper: {
                name: 'ProfileWrapper',
                importPath: '@/ProfileWrapper',
                compositionNotes: 'Use with an avatar for best results',
            },
        };

        const results = queryRegistry(REGISTRY, 'avatar');
        expect(results[0].name).toBe('Avatar');
    });
});

// ── M2: PropDefinitionV2 backwards compat ─────────────────────────────────────

describe('PropDefinitionV2 — M2: new optional fields are backwards compatible', () => {
    it('existing entries without new PropDefinition fields type-check and round-trip correctly', () => {
        const entry: ComponentEntry = {
            name: 'Button',
            importPath: '@/Button',
            props: {
                variant: { type: 'string', required: false, default: 'primary' },
                disabled: { type: 'boolean', required: false },
            },
        };

        const registry: Record<string, ComponentEntry> = { Button: entry };
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Button: {
                    description: 'Updated via overlay',
                },
            },
        };

        const result = mergeTeamRegistryOverlay(registry, overlay);
        // Props from base entry must survive the overlay merge
        expect(result['Button'].props?.['variant']).toBeDefined();
        expect(result['Button'].props?.['variant'].type).toBe('string');
        expect(result['Button'].props?.['disabled']).toBeDefined();
    });

    it('new PropDefinitionV2 fields (description, enum, deprecated, translatesFrom) survive mergeTeamRegistryOverlay', () => {
        const entry: ComponentEntry = {
            name: 'Select',
            importPath: '@/Select',
            props: {
                size: {
                    type: 'string',
                    required: false,
                    default: 'md',
                    description: 'Size of the select',
                    enum: ['sm', 'md', 'lg'],
                    deprecated: false,
                    translatesFrom: 'size',
                },
            },
        };
        const registry: Record<string, ComponentEntry> = { Select: entry };
        const overlay: TeamRegistryOverlayInput = {
            addEntries: {
                Select: { description: 'Updated select' },
            },
        };
        const result = mergeTeamRegistryOverlay(registry, overlay);
        const prop = result['Select'].props?.['size'];
        expect(prop?.description).toBe('Size of the select');
        expect(prop?.enum).toEqual(['sm', 'md', 'lg']);
        expect(prop?.deprecated).toBe(false);
        expect(prop?.translatesFrom).toBe('size');
    });
});
