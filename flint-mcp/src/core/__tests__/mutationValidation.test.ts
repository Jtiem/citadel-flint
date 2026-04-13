import { describe, it, expect } from 'vitest';
import { validateMutationBatch } from '../mutationValidation.js';
import type { DesignToken } from '../../types.js';

const emptyRegistry: Record<string, unknown> = {};
const emptyTokens: DesignToken[] = [];

const populatedRegistry: Record<string, unknown> = {
    Button: { name: 'Button', category: 'atom' },
    Card: { name: 'Card', category: 'molecule' },
};

describe('validateMutationBatch', () => {
    it('passes mutations that require no governance checks', () => {
        const mutations = [
            { type: 'move', args: { sourceId: 'a', targetId: 'b', position: 'after' } },
            { type: 'updateProp', args: { nodeId: 'x', propName: 'disabled', value: true } },
            { type: 'delete', args: { nodeId: 'z' } },
        ];
        const result = validateMutationBatch(mutations, populatedRegistry, emptyTokens);
        expect(result.blocked).toBe(false);
        expect(result.errors).toHaveLength(0);
    });

    it('blocks inject of unregistered custom component', () => {
        const mutations = [
            { type: 'inject', args: { targetNodeId: 'x', jsxSnippet: '<UnknownWidget />' } },
        ];
        const result = validateMutationBatch(mutations, populatedRegistry, emptyTokens);
        expect(result.blocked).toBe(true);
        expect(result.errors[0]).toContain('UnknownWidget');
        expect(result.errors[0]).toContain('not in the project registry');
    });

    it('allows inject of registered component', () => {
        const mutations = [
            { type: 'inject', args: { targetNodeId: 'x', jsxSnippet: '<Button />' } },
        ];
        const result = validateMutationBatch(mutations, populatedRegistry, emptyTokens);
        expect(result.blocked).toBe(false);
        expect(result.errors).toHaveLength(0);
    });

    it('allows inject of HTML intrinsic elements', () => {
        const mutations = [
            { type: 'inject', args: { targetNodeId: 'x', jsxSnippet: '<div>hello</div>' } },
        ];
        // Lowercase JSX = intrinsic, so extractComponentName returns null (no uppercase match)
        const result = validateMutationBatch(mutations, populatedRegistry, emptyTokens);
        expect(result.blocked).toBe(false);
    });

    it('blocks wrap with unregistered component', () => {
        const mutations = [
            { type: 'wrap', args: { nodeId: 'x', wrapperElement: 'UnknownContainer' } },
        ];
        const result = validateMutationBatch(mutations, populatedRegistry, emptyTokens);
        expect(result.blocked).toBe(true);
        expect(result.errors[0]).toContain('UnknownContainer');
    });

    it('allows wrap with registered component', () => {
        const mutations = [
            { type: 'wrap', args: { nodeId: 'x', wrapperElement: 'Card' } },
        ];
        const result = validateMutationBatch(mutations, populatedRegistry, emptyTokens);
        expect(result.blocked).toBe(false);
    });

    it('skips registry check when registry is empty (pass-through)', () => {
        const mutations = [
            { type: 'inject', args: { targetNodeId: 'x', jsxSnippet: '<Anything />' } },
        ];
        const result = validateMutationBatch(mutations, emptyRegistry, emptyTokens);
        expect(result.blocked).toBe(false);
        expect(result.errors).toHaveLength(0);
    });

    it('allows React builtins without registration', () => {
        const mutations = [
            { type: 'wrap', args: { nodeId: 'x', wrapperElement: 'Fragment' } },
        ];
        const result = validateMutationBatch(mutations, populatedRegistry, emptyTokens);
        expect(result.blocked).toBe(false);
    });

    it('blocks composeSlot with unregistered component', () => {
        const mutations = [
            { type: 'composeSlot', args: { parentId: 'x', slotName: 'header', jsxSnippet: '<Zephyr />' } },
        ];
        const result = validateMutationBatch(mutations, populatedRegistry, emptyTokens);
        expect(result.blocked).toBe(true);
        expect(result.errors[0]).toContain('Zephyr');
    });

    it('accumulates multiple errors across mutations', () => {
        const mutations = [
            { type: 'inject', args: { targetNodeId: 'a', jsxSnippet: '<Alpha />' } },
            { type: 'wrap', args: { nodeId: 'b', wrapperElement: 'Beta' } },
        ];
        const result = validateMutationBatch(mutations, populatedRegistry, emptyTokens);
        expect(result.blocked).toBe(true);
        expect(result.errors).toHaveLength(2);
    });
});
