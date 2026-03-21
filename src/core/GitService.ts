/**
 * GitService — src/core/GitService.ts
 *
 * Renderer-side Git Transplant Service (Phase D — Commandment 11).
 *
 * Provides `getSpecificNodeFromGit`: given an absolute file path, a
 * data-flint-id, and a git commit hash, retrieves the file content at that
 * commit via IPC (`window.flintAPI.gitShow`), parses it into a temporary AST,
 * and extracts only the JSXElement that carries the matching flint ID.
 *
 * This enables surgical transplants: the caller can inject the recovered node
 * into the current AST without a destructive `git checkout`.
 *
 * Renderer Process only — all git I/O goes through IPC to the main process.
 */

import { parseCodeToAST } from './ast-parser'
import _traverse from '@babel/traverse'
import type { JSXElement } from '@babel/types'
import type { NodePath } from '@babel/traverse'

// ── CJS interop (same pattern as ast-parser.ts) ───────────────────────────────
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Retrieves the JSXElement with `data-flint-id === flintId` as it existed
 * at `commitHash` in the file at `filePath`.
 *
 * Algorithm:
 *   1. Calls `window.flintAPI.gitShow(filePath, commitHash)` → old source.
 *   2. Parses the old source into a temporary AST.
 *   3. Traverses the AST to find the first JSXElement whose `data-flint-id`
 *      attribute matches `flintId`.
 *   4. Returns the node (or null if not found / parse error / IPC error).
 *
 * Does NOT modify the working tree. Does NOT call `git checkout`.
 *
 * @param filePath   Absolute path to the source file in the user's project.
 * @param flintId   The `data-flint-id` attribute value to search for.
 * @param commitHash A full or abbreviated git commit SHA (4–64 hex chars).
 * @returns          The matching JSXElement node, or null on any failure.
 */
export async function getSpecificNodeFromGit(
    filePath: string,
    flintId: string,
    commitHash: string
): Promise<JSXElement | null> {
    // Delegate the git read to the main process via IPC.
    const oldSource = await window.flintAPI.gitShow(filePath, commitHash)
    if (oldSource === null) return null

    // Parse into a temp AST — never touches the store's live ast.
    const ast = parseCodeToAST(oldSource)
    if (ast === null) return null

    let found: JSXElement | null = null

    traverse(ast, {
        JSXElement(path: NodePath<JSXElement>) {
            for (const attr of path.node.openingElement.attributes) {
                if (
                    attr.type === 'JSXAttribute' &&
                    attr.name.type === 'JSXIdentifier' &&
                    attr.name.name === 'data-flint-id' &&
                    attr.value?.type === 'StringLiteral' &&
                    attr.value.value === flintId
                ) {
                    found = path.node
                    path.stop()
                    break
                }
            }
        },
    })

    return found
}
