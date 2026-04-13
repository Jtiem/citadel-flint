/**
 * injectFlintIds — Commandment 7: ID Preservation
 *
 * Canonical implementation also exists in src/core/ast-parser.ts (renderer).
 * Keep in sync — both are small, stable, pure Babel traversals.
 */
import traverse from '@babel/traverse';
import { isJSXAttribute, isJSXIdentifier, jsxAttribute, jsxIdentifier, stringLiteral } from '@babel/types';
import type { File } from '@babel/types';
import type { NodePath } from '@babel/traverse';
import type { JSXElement } from '@babel/types';

// @ts-ignore — CJS/ESM interop
const _traverse = (traverse as any).default || traverse;

export function injectFlintIds(ast: File): void {
    _traverse(ast, {
        JSXElement(path: NodePath<JSXElement>) {
            const opening = path.node.openingElement;
            const loc = path.node.loc;
            if (loc == null) return;

            let tagName: string;
            const nameNode = opening.name;
            if (nameNode.type === 'JSXIdentifier') {
                tagName = nameNode.name;
            } else if (nameNode.type === 'JSXMemberExpression') {
                const obj = nameNode.object.type === 'JSXIdentifier' ? nameNode.object.name : '?';
                tagName = `${obj}.${nameNode.property.name}`;
            } else {
                tagName = 'unknown';
            }

            const flintId = `${tagName}:${loc.start.line}:${loc.start.column}`;

            const alreadySet = opening.attributes.some(
                (attr) =>
                    isJSXAttribute(attr) &&
                    isJSXIdentifier(attr.name) &&
                    attr.name.name === 'data-flint-id'
            );
            if (alreadySet) return;

            opening.attributes.push(
                jsxAttribute(jsxIdentifier('data-flint-id'), stringLiteral(flintId))
            );
        },
    });
}
