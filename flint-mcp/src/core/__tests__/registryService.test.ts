/**
 * registryService — Unit Tests
 *
 * Scope: queryRegistry scoring, limit enforcement, edge cases,
 *        formatShadowStorybook markdown structure.
 */

import { describe, it, expect } from 'vitest';
import {
    queryRegistry,
    formatShadowStorybook,
    type ComponentEntry,
} from '../registryService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BUTTON: ComponentEntry = {
    name: 'Button',
    importPath: '@/components/ui/Button',
    description: 'A clickable button element',
    props: {
        variant: { type: 'string', required: false, default: 'primary' },
        disabled: { type: 'boolean', required: false, default: 'false' },
        onClick: { type: '() => void', required: true },
    },
    variants: ['primary', 'secondary', 'destructive'],
    tokens: ['color.primary', 'color.surface'],
    source: 'local',
};

const CARD: ComponentEntry = {
    name: 'Card',
    importPath: '@/components/ui/Card',
    description: 'A container card with optional shadow',
    props: {
        elevated: { type: 'boolean', required: false, default: 'false' },
    },
    variants: ['flat', 'elevated'],
    tokens: ['shadow.card', 'color.surface'],
    source: 'local',
};

const BADGE: ComponentEntry = {
    name: 'Badge',
    importPath: '@/components/ui/Badge',
    description: 'Small status indicator badge',
    props: {
        label: { type: 'string', required: true },
    },
    variants: ['success', 'warning', 'error'],
    tokens: ['color.feedback'],
    source: 'local',
};

const REMOTE_INPUT: ComponentEntry = {
    name: 'Input',
    importPath: 'shadcn/ui/input',
    description: 'Text input field from remote library',
    props: {
        placeholder: { type: 'string', required: false },
        value: { type: 'string', required: true },
    },
    source: 'remote',
    remoteUrl: 'https://github.com/shadcn-ui/ui',
};

const REGISTRY: Record<string, ComponentEntry> = {
    Button: BUTTON,
    Card: CARD,
    Badge: BADGE,
    Input: REMOTE_INPUT,
};

// ── queryRegistry ─────────────────────────────────────────────────────────────

describe('queryRegistry', () => {
    it('returns components matching a single-word query by name', () => {
        const results = queryRegistry(REGISTRY, 'button');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Button');
    });

    it('returns components matching a query word in description', () => {
        const results = queryRegistry(REGISTRY, 'shadow');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Card');
    });

    it('returns components matching a query word in variants', () => {
        const results = queryRegistry(REGISTRY, 'destructive');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Button');
    });

    it('returns components matching a query word in tokens', () => {
        // 'color.surface' appears in both Button and Card
        const results = queryRegistry(REGISTRY, 'surface');
        expect(results.map(r => r.name)).toEqual(
            expect.arrayContaining(['Button', 'Card']),
        );
    });

    it('returns components sorted by score — more matching words rank higher', () => {
        // 'primary button' — Button matches both 'primary' (variant) and 'button' (name)
        // Card and Badge match neither or only one
        const results = queryRegistry(REGISTRY, 'primary button');
        expect(results[0].name).toBe('Button');
    });

    it('respects the limit parameter', () => {
        // All four components match 'component' in their descriptions...
        // Use a very broad term: 'a' appears in multiple descriptions
        // Better: query something generic like 'indicator status badge button'
        const results = queryRegistry(REGISTRY, 'indicator status badge button', 2);
        expect(results.length).toBeLessThanOrEqual(2);
    });

    it('returns empty array for an empty registry', () => {
        const results = queryRegistry({}, 'button');
        expect(results).toHaveLength(0);
    });

    it('returns empty array when no components match the query', () => {
        const results = queryRegistry(REGISTRY, 'xyzzy-no-match-zzz');
        expect(results).toHaveLength(0);
    });

    it('returns empty array for a blank query', () => {
        const results = queryRegistry(REGISTRY, '   ');
        expect(results).toHaveLength(0);
    });

    it('is case-insensitive', () => {
        const lower = queryRegistry(REGISTRY, 'BUTTON');
        const upper = queryRegistry(REGISTRY, 'button');
        expect(lower).toHaveLength(upper.length);
        expect(lower[0].name).toBe(upper[0].name);
    });

    it('handles a registry component without optional fields', () => {
        const minimal: Record<string, ComponentEntry> = {
            Minimal: { name: 'Minimal', importPath: '@/Minimal' },
        };
        const results = queryRegistry(minimal, 'minimal');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Minimal');
    });

    it('enforces a maximum limit of 50', () => {
        // Build a registry with 60 components, all matching 'widget'
        const large: Record<string, ComponentEntry> = {};
        for (let i = 0; i < 60; i++) {
            large[`Widget${i}`] = {
                name: `Widget${i}`,
                importPath: `@/Widget${i}`,
                description: 'widget component',
            };
        }
        const results = queryRegistry(large, 'widget', 100);
        expect(results.length).toBeLessThanOrEqual(50);
    });
});

// ── formatShadowStorybook ─────────────────────────────────────────────────────

describe('formatShadowStorybook', () => {
    it('includes the query in the header', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).toContain('## Shadow Storybook — Results for "button"');
    });

    it('renders the component name as a heading', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).toContain('### Button');
    });

    it('includes the import path', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).toContain('@/components/ui/Button');
    });

    it('renders a props table with column headers', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).toContain('| Name | Type | Required | Default |');
    });

    it('lists each prop in the table', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).toContain('variant');
        expect(output).toContain('disabled');
        expect(output).toContain('onClick');
    });

    it('marks required props correctly', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        // onClick is required=true, disabled is required=false
        expect(output).toContain('Yes');
        expect(output).toContain('No');
    });

    it('renders variants', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).toContain('primary');
        expect(output).toContain('secondary');
        expect(output).toContain('destructive');
    });

    it('renders a code example block', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).toContain('```tsx');
        expect(output).toContain('```');
    });

    it('renders token dependencies', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).toContain('color.primary');
        expect(output).toContain('color.surface');
    });

    it('renders a separator between multiple components', () => {
        const output = formatShadowStorybook([BUTTON, CARD], 'surface');
        expect(output).toContain('### Button');
        expect(output).toContain('### Card');
        expect(output).toContain('---');
    });

    it('shows "(remote)" badge for remote components', () => {
        const output = formatShadowStorybook([REMOTE_INPUT], 'input');
        expect(output).toContain('_(remote)_');
    });

    it('shows the remoteUrl for remote components', () => {
        const output = formatShadowStorybook([REMOTE_INPUT], 'input');
        expect(output).toContain('https://github.com/shadcn-ui/ui');
    });

    it('returns a "no results" message for empty matches', () => {
        const output = formatShadowStorybook([], 'nothing');
        expect(output).toContain('No components found');
    });

    it('handles a component with no props gracefully', () => {
        const bare: ComponentEntry = {
            name: 'Bare',
            importPath: '@/Bare',
            description: 'Bare component',
        };
        const output = formatShadowStorybook([bare], 'bare');
        expect(output).toContain('### Bare');
        // Should not throw and should not include a props table header
        expect(output).not.toContain('| Name | Type | Required |');
    });

    // ── CK.4: Extended ComponentEntry fields ──────────────────────────────────

    it('renders custom usageExample instead of auto-generated snippet', () => {
        const custom = 'import { Button } from \'@/Button\';\n\n<Button variant="cta" onClick={handleSubmit}>Submit</Button>';
        const comp: ComponentEntry = {
            name: 'Button',
            importPath: '@/components/ui/Button',
            usageExample: custom,
        };
        const output = formatShadowStorybook([comp], 'button');
        expect(output).toContain('**Example usage (custom)**');
        expect(output).toContain(custom);
        // Must NOT contain the auto-generated header
        expect(output).not.toContain('**Example usage**\n');
    });

    it('renders auto-generated snippet when usageExample is absent', () => {
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).toContain('**Example usage**');
        expect(output).not.toContain('**Example usage (custom)**');
        // Auto-generated snippet contains the import statement
        expect(output).toContain(`import { Button } from '${BUTTON.importPath}'`);
    });

    it('renders compositionNotes section when present', () => {
        const comp: ComponentEntry = {
            name: 'Dialog',
            importPath: '@/Dialog',
            compositionNotes: 'Always pair with DialogHeader and DialogFooter. Do not nest dialogs.',
        };
        const output = formatShadowStorybook([comp], 'dialog');
        expect(output).toContain('**Composition notes**');
        expect(output).toContain('Always pair with DialogHeader and DialogFooter.');
    });

    it('renders a11yNotes section when present', () => {
        const comp: ComponentEntry = {
            name: 'Modal',
            importPath: '@/Modal',
            a11yNotes: 'Use role="dialog" and aria-modal="true". Trap focus inside modal.',
        };
        const output = formatShadowStorybook([comp], 'modal');
        expect(output).toContain('**Accessibility notes**');
        expect(output).toContain('Trap focus inside modal.');
    });

    it('renders relatedComponents list when present', () => {
        const comp: ComponentEntry = {
            name: 'Dialog',
            importPath: '@/Dialog',
            relatedComponents: ['DialogHeader', 'DialogFooter', 'DialogContent'],
        };
        const output = formatShadowStorybook([comp], 'dialog');
        expect(output).toContain('**Related components**: DialogHeader, DialogFooter, DialogContent');
    });

    it('omits new sections when fields are absent (backward compat)', () => {
        // BUTTON fixture has none of the new fields
        const output = formatShadowStorybook([BUTTON], 'button');
        expect(output).not.toContain('**Composition notes**');
        expect(output).not.toContain('**Accessibility notes**');
        expect(output).not.toContain('**Related components**');
        expect(output).not.toContain('**Example usage (custom)**');
    });
});

// ── CK.4: Extended scoring ────────────────────────────────────────────────────

describe('queryRegistry — CK.4 extended field scoring', () => {
    it('matches against compositionNotes text', () => {
        const compRegistry: Record<string, ComponentEntry> = {
            Dialog: {
                name: 'Dialog',
                importPath: '@/Dialog',
                compositionNotes: 'Pair with DialogHeader for accessible modals.',
            },
            Button: BUTTON,
        };
        const results = queryRegistry(compRegistry, 'accessible modals');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('Dialog');
    });

    it('matches against a11yNotes text', () => {
        const compRegistry: Record<string, ComponentEntry> = {
            Tooltip: {
                name: 'Tooltip',
                importPath: '@/Tooltip',
                a11yNotes: 'Use aria-describedby to associate tooltip content with trigger.',
            },
            Button: BUTTON,
        };
        const results = queryRegistry(compRegistry, 'aria-describedby');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('Tooltip');
    });

    it('matches against relatedComponents names', () => {
        const compRegistry: Record<string, ComponentEntry> = {
            Dialog: {
                name: 'Dialog',
                importPath: '@/Dialog',
                relatedComponents: ['DialogHeader', 'DialogFooter'],
            },
            Button: BUTTON,
        };
        // Searching for 'DialogFooter' should surface Dialog via its relatedComponents
        const results = queryRegistry(compRegistry, 'DialogFooter');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toBe('Dialog');
    });
});
