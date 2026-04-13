import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import _generate from '@babel/generator';
import { injectFlintIds } from '../injectFlintIds.js';

// @ts-ignore — CJS/ESM interop
const generate = (_generate as any).default || _generate;

function parseJSX(code: string) {
    return parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
}

describe('injectFlintIds', () => {
    it('adds data-flint-id to bare JSX elements', () => {
        const ast = parseJSX('<div><span>hello</span></div>');
        injectFlintIds(ast);
        const output = generate(ast).code;
        expect(output).toContain('data-flint-id="div:1:0"');
        expect(output).toContain('data-flint-id="span:1:5"');
    });

    it('skips elements that already have data-flint-id', () => {
        const ast = parseJSX('<div data-flint-id="existing"><span>hi</span></div>');
        injectFlintIds(ast);
        const output = generate(ast).code;
        // div should still have its original id, not a new one
        expect(output).toContain('data-flint-id="existing"');
        // Only one data-flint-id on the div
        const divMatches = output.match(/data-flint-id="existing"/g);
        expect(divMatches).toHaveLength(1);
        // span should get a new id
        expect(output).toContain('data-flint-id="span:');
    });

    it('handles JSXMemberExpression tag names', () => {
        const ast = parseJSX('<Flex.Item>content</Flex.Item>');
        injectFlintIds(ast);
        const output = generate(ast).code;
        expect(output).toContain('data-flint-id="Flex.Item:1:0"');
    });

    it('handles nested elements', () => {
        const code = `<div>\n  <ul>\n    <li>item</li>\n  </ul>\n</div>`;
        const ast = parseJSX(code);
        injectFlintIds(ast);
        const output = generate(ast).code;
        expect(output).toContain('data-flint-id="div:1:');
        expect(output).toContain('data-flint-id="ul:2:');
        expect(output).toContain('data-flint-id="li:3:');
    });

    it('is idempotent — running twice does not duplicate IDs', () => {
        const ast = parseJSX('<div><span>hello</span></div>');
        injectFlintIds(ast);
        injectFlintIds(ast);
        const output = generate(ast).code;
        const divIds = output.match(/data-flint-id/g);
        // Should have exactly 2 data-flint-id attrs (one per element)
        expect(divIds).toHaveLength(2);
    });
});
