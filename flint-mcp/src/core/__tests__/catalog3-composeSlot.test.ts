/**
 * CATALOG.3: composeSlot tests — flint-mcp/src/core/__tests__/catalog3-composeSlot.test.ts
 *
 * Tests for compound component slot composition: creating new slots,
 * appending to existing slots, error handling, and import management.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import _generate from '@babel/generator';
const generate = typeof (_generate as any).default === 'function' ? (_generate as any).default : _generate;
import { composeSlot } from '../ast-modifier.js';

function parseFixture(source: string) {
    return parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
}
function gen(ast: any): string { return generate(ast).code; }

describe('CATALOG.3: composeSlot', () => {
    it('creates a new slot when it does not exist', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"><Dialog.Body>Hello</Dialog.Body></Dialog>');
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<h2>Title</h2>');
        const code = gen(ast);
        expect(code).toContain('Dialog.Header');
        expect(code).toContain('<h2>Title</h2>');
    });

    it('appends children to an existing slot', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"><Dialog.Header><h2>Old</h2></Dialog.Header></Dialog>');
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<p>Subtitle</p>');
        const code = gen(ast);
        expect(code).toContain('<h2>Old</h2>');
        expect(code).toContain('<p>Subtitle</p>');
    });

    it('handles different component prefixes', () => {
        const ast = parseFixture('<Card data-flint-id="c1"><Card.Body>Content</Card.Body></Card>');
        composeSlot(ast, 'c1', 'Card.Footer', '<p>Footer</p>');
        const code = gen(ast);
        expect(code).toContain('Card.Footer');
        expect(code).toContain('<p>Footer</p>');
    });

    it('throws for non-existent parent flint ID', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"></Dialog>');
        expect(() => composeSlot(ast, 'missing', 'Dialog.Header', '<h2>X</h2>')).toThrow(
            /parent node not found/
        );
    });

    it('preserves existing children of the parent', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"><Dialog.Body>Body</Dialog.Body></Dialog>');
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<h2>Title</h2>');
        const code = gen(ast);
        expect(code).toContain('Dialog.Body');
        expect(code).toContain('Body');
        expect(code).toContain('Dialog.Header');
    });

    it('handles JSX snippet with multiple elements', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"></Dialog>');
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<h2>Title</h2><p>Sub</p>');
        const code = gen(ast);
        expect(code).toContain('<h2>Title</h2>');
        expect(code).toContain('<p>Sub</p>');
    });

    it('throws for invalid slot name format (no dot)', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"></Dialog>');
        expect(() => composeSlot(ast, 'dlg1', 'NoSlot', '<h2>X</h2>')).toThrow(
            /invalid slot name/
        );
    });

    it('throws for slot name with leading dot', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"></Dialog>');
        expect(() => composeSlot(ast, 'dlg1', '.Header', '<h2>X</h2>')).toThrow(
            /invalid slot name/
        );
    });

    it('throws for slot name with trailing dot', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"></Dialog>');
        expect(() => composeSlot(ast, 'dlg1', 'Dialog.', '<h2>X</h2>')).toThrow(
            /invalid slot name/
        );
    });

    it('adds import when importSnippet is provided', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"></Dialog>');
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<h2>Title</h2>', 'import { Dialog } from "@ui/dialog"');
        const code = gen(ast);
        expect(code).toContain('import { Dialog } from "@ui/dialog"');
        expect(code).toContain('Dialog.Header');
    });

    it('does not duplicate an existing import', () => {
        const ast = parseFixture('import { Dialog } from "@ui/dialog";\n<Dialog data-flint-id="dlg1"></Dialog>');
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<h2>Title</h2>', 'import { Dialog } from "@ui/dialog"');
        const code = gen(ast);
        // Count occurrences of the import source — should be exactly 1
        const matches = code.match(/@ui\/dialog/g);
        expect(matches).toHaveLength(1);
    });

    it('converts self-closing parent to open/close before inserting slot', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1" />');
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<h2>Title</h2>');
        const code = gen(ast);
        expect(code).toContain('Dialog.Header');
        expect(code).toContain('<h2>Title</h2>');
        // Should no longer be self-closing
        expect(code).toContain('</Dialog>');
    });

    it('silently returns when snippet produces no JSX elements', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"></Dialog>');
        // Plain text without JSX elements
        composeSlot(ast, 'dlg1', 'Dialog.Header', 'just text');
        const code = gen(ast);
        // Should not have created a slot since there are no JSXElement children
        expect(code).not.toContain('Dialog.Header');
    });

    it('prepends new slot before existing children (Header before Body)', () => {
        const ast = parseFixture('<Dialog data-flint-id="dlg1"><Dialog.Body>Body</Dialog.Body></Dialog>');
        composeSlot(ast, 'dlg1', 'Dialog.Header', '<h2>Title</h2>');
        const code = gen(ast);
        const headerIdx = code.indexOf('Dialog.Header');
        const bodyIdx = code.indexOf('Dialog.Body');
        expect(headerIdx).toBeLessThan(bodyIdx);
    });
});
