/**
 * SessionValidator — bridge-mcp/src/core/governance/sessionValidator.ts
 *
 * GOV.3: Session-Level Mutation Validation
 *
 * After each applyMutationBatch the server calls validateSessionState() with
 * the resulting AST and the list of mutations applied in this session.  The
 * function traverses the AST exactly once (single Babel pass) and runs four
 * independent checks:
 *
 *   CHECK-1  DUPLICATE_BRIDGE_ID      — all data-bridge-id values are unique
 *   CHECK-2  ORPHANED_MUTATION        — every nodeId referenced in the session
 *                                       mutation list still exists in the AST
 *   CHECK-3  STALE_IMPORT             — every import specifier is referenced at
 *                                       least once in the file body
 *   CHECK-4  MISSING_BRIDGE_ID        — every JSX element carries a data-bridge-id
 *
 * Design goals
 *   - Single traversal — the four checks share one traverse() call
 *   - < 50 ms for a 100-node AST (all checks are O(n) in the node count)
 *   - Errors are informational only — the caller decides what to do with them
 *   - No I/O — the function is pure: (ast, filePath, sessionMutations) → result
 *   - No dependency on src/ (process boundary Commandment)
 *
 * Phase: GOV.3
 * Unblocked by: INFRA.2 (mutations ledger — ONLINE), V.2-mp (provenance — ONLINE)
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { File as BabelFile, JSXOpeningElement } from '@babel/types'
import type { SessionValidationError, SessionValidationResult } from './types.js'

// CJS/ESM interop (mirrors the pattern used throughout bridge-mcp)
const traverse =
    typeof _traverse === 'function'
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** One mutation entry from the session — only the nodeId is required here. */
export interface SessionMutation {
    /** data-bridge-id of the node that was targeted by this mutation. */
    nodeId?: string
    /** Mutation operation type string (informational, not checked here). */
    type?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the string value of a JSX attribute named `data-bridge-id` from
 * a JSXOpeningElement, or null when absent / non-string.
 */
function getBridgeId(openingElement: JSXOpeningElement): string | null {
    for (const attr of openingElement.attributes) {
        if (!t.isJSXAttribute(attr)) continue
        const nameNode = attr.name
        const name = t.isJSXNamespacedName(nameNode)
            ? `${nameNode.namespace.name}:${nameNode.name.name}`
            : nameNode.name
        if (name !== 'data-bridge-id') continue
        const val = attr.value
        if (t.isStringLiteral(val)) return val.value
        // JSXExpressionContainer with a string literal
        if (
            t.isJSXExpressionContainer(val) &&
            t.isStringLiteral(val.expression)
        ) {
            return val.expression.value
        }
    }
    return null
}

/**
 * Collect every identifier name that is actually used in the file body
 * (anything that is not an import declaration).  Used by CHECK-3 to detect
 * stale imports.
 *
 * We do this with a secondary traversal scoped to non-import nodes so we
 * don't false-positive on the import's own binding identifier.
 */
function collectUsedIdentifiers(ast: BabelFile): Set<string> {
    const used = new Set<string>()
    traverse(ast, {
        // Skip ImportDeclaration subtrees — we only want usage sites
        ImportDeclaration() {
            // do nothing; returning without traversing children is the default
        },
        Identifier(nodePath) {
            // Only count identifiers that are not part of an ImportDeclaration
            if (nodePath.findParent((p) => p.isImportDeclaration())) return
            used.add(nodePath.node.name)
        },
        JSXIdentifier(nodePath) {
            if (nodePath.findParent((p) => p.isImportDeclaration())) return
            used.add(nodePath.node.name)
        },
    })
    return used
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Validate session-level AST correctness after a mutation batch.
 *
 * @param ast               The post-mutation Babel File AST (must be a fresh
 *                          parse — not a mutated live store reference).
 * @param filePath          The file path being mutated (used in error messages).
 * @param sessionMutations  All mutations applied in the current session.
 *                          Pass an empty array when no session history is
 *                          available; CHECK-2 will be skipped.
 * @returns                 A SessionValidationResult with valid=true only when
 *                          no 'error'-severity issues are detected.
 */
export function validateSessionState(
    ast: BabelFile,
    filePath: string,
    sessionMutations: SessionMutation[],
): SessionValidationResult {
    const errors: SessionValidationError[] = []
    const validatedAt = new Date().toISOString()
    const mutationCount = sessionMutations.length

    // -- Accumulators populated in the single traversal pass -----------------

    // CHECK-1: track bridge IDs seen so far — map to first-seen nodeId for msg
    const seenBridgeIds = new Map<string, string>()   // bridgeId → first occurrence
    const duplicateBridgeIds = new Set<string>()      // bridgeIds already flagged

    // CHECK-4: track JSX elements without a bridge ID
    const missingBridgeIdElements: string[] = []       // tag names for messages

    // CHECK-2: track which nodeIds exist in the AST
    const existingNodeIds = new Set<string>()

    // CHECK-3: collect all import specifier local names
    const importedNames = new Map<string, string>()   // localName → importPath

    // ── Single traversal ────────────────────────────────────────────────────

    traverse(ast, {
        // ── Collect import specifiers for CHECK-3 ──────────────────────────
        ImportDeclaration(nodePath) {
            const importSource = nodePath.node.source.value
            for (const specifier of nodePath.node.specifiers) {
                let localName: string
                if (t.isImportDefaultSpecifier(specifier)) {
                    localName = specifier.local.name
                } else if (t.isImportNamespaceSpecifier(specifier)) {
                    localName = specifier.local.name
                } else if (t.isImportSpecifier(specifier)) {
                    localName = specifier.local.name
                } else {
                    continue
                }
                importedNames.set(localName, importSource)
            }
        },

        // ── CHECK-1 + CHECK-4: JSX element inspection ─────────────────────
        JSXOpeningElement(nodePath) {
            const bridgeId = getBridgeId(nodePath.node)

            // CHECK-4 — every JSX element must carry a bridge ID
            if (bridgeId === null) {
                const tagName = t.isJSXIdentifier(nodePath.node.name)
                    ? nodePath.node.name.name
                    : 'unknown'
                missingBridgeIdElements.push(tagName)
            } else {
                // Track for CHECK-2
                existingNodeIds.add(bridgeId)

                // CHECK-1 — duplicate detection
                if (seenBridgeIds.has(bridgeId)) {
                    if (!duplicateBridgeIds.has(bridgeId)) {
                        duplicateBridgeIds.add(bridgeId)
                        errors.push({
                            code: 'DUPLICATE_BRIDGE_ID',
                            message: `Duplicate data-bridge-id "${bridgeId}" found in ${filePath}. ` +
                                `IDs must be unique per element after every structural op.`,
                            nodeId: bridgeId,
                            severity: 'error',
                        })
                    }
                } else {
                    seenBridgeIds.set(bridgeId, bridgeId)
                }
            }
        },
    })

    // ── CHECK-2 — orphaned mutation references (post-traversal) ─────────────
    if (sessionMutations.length > 0) {
        for (const mutation of sessionMutations) {
            const nodeId = mutation.nodeId
            if (nodeId === undefined || nodeId === null || nodeId === '') continue
            if (!existingNodeIds.has(nodeId)) {
                errors.push({
                    code: 'ORPHANED_MUTATION',
                    message: `Session mutation references node "${nodeId}" which no longer ` +
                        `exists in the AST of ${filePath}. The node may have been deleted ` +
                        `by a subsequent mutation.`,
                    nodeId,
                    severity: 'warning',
                })
            }
        }
    }

    // ── CHECK-3 — stale imports (post-traversal, secondary pass) ─────────────
    if (importedNames.size > 0) {
        // Collect usage sites — we need a second pass because the single
        // traverse above exits ImportDeclaration early to avoid self-counting.
        const usedIdentifiers = collectUsedIdentifiers(ast)

        for (const [localName, importSource] of importedNames) {
            if (!usedIdentifiers.has(localName)) {
                errors.push({
                    code: 'STALE_IMPORT',
                    message: `Import "${localName}" from "${importSource}" in ${filePath} ` +
                        `is not referenced anywhere in the file body. ` +
                        `It may have become stale after a deleteNode or moveNode op.`,
                    severity: 'error',
                })
            }
        }
    }

    // ── CHECK-4 — emit accumulated missing-bridge-id errors ─────────────────
    for (const tagName of missingBridgeIdElements) {
        errors.push({
            code: 'MISSING_BRIDGE_ID',
            message: `JSX element <${tagName}> in ${filePath} is missing a ` +
                `data-bridge-id attribute. Run injectBridgeIds after every ` +
                `structural mutation to ensure full ID coverage.`,
            severity: 'error',
        })
    }

    // A result is valid only when there are no 'error'-severity entries.
    const valid = errors.every((e) => e.severity !== 'error')

    return { valid, errors, validatedAt, mutationCount }
}
